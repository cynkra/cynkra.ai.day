"""Real training run — informed by spike.py results.

Trains a parametric GPT on the encoded Faust corpus, prints train+val loss
periodically, saves periodic checkpoints, tracks best-val, and early-stops
when val_loss climbs PATIENCE evals in a row.

    source .venv/bin/activate
    python train.py
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np

from model import GPT, GPTConfig

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "faust"
CKPT_DIR = HERE / "checkpoints"


# === CONFIG ==================================================================

# Vocab=4k retokenize: each token packs ~3.15 chars vs 2.73 at 2k → richer
# per-token signal, fewer total tokens (281k vs 324k).
TOKENIZER = "tokenizer-4k.json"
TRAIN_BIN = "train-4k.bin"
VAL_BIN = "val-4k.bin"

# Bigger model + longer context + dropout regularization for the 2-hour budget.
# Spike: 17.45M params, ctx=512, batch=32, drop=0.1 → 0.61 steps/s, 12.5 GB peak.
CFG = GPTConfig(
    vocab_size=4000,
    ctx_len=512,
    n_layer=8,
    n_head=8,
    n_embd=384,
    dropout=0.1,
)
BATCH_SIZE = 32
N_STEPS = 5000               # cap; early-stop usually trips first
LR = 3e-4
WARMUP_STEPS = 100           # linear warmup, then constant
EVAL_EVERY = 100
EVAL_BATCHES = 20
LOG_EVERY = 50
CKPT_EVERY = 500             # snapshot every N steps to checkpoints/snap-{step}/
PATIENCE = 5                 # early-stop after this many evals without val improvement

# ============================================================================


def load_split(name: str) -> np.ndarray:
    p = DATA / name
    if not p.exists():
        raise SystemExit(f"missing {p} — re-run prepare.py / retokenize first")
    return np.memmap(p, dtype=np.uint16, mode="r")


def make_batcher(data: np.ndarray, batch_size: int, ctx_len: int, seed: int):
    n = len(data) - ctx_len - 1
    rng = np.random.default_rng(seed)

    def get_batch():
        ix = rng.integers(0, n, size=batch_size)
        x = np.stack([data[i : i + ctx_len].astype(np.int32) for i in ix])
        y = np.stack([data[i + 1 : i + 1 + ctx_len].astype(np.int32) for i in ix])
        return mx.array(x), mx.array(y)

    return get_batch


def loss_fn(model: GPT, x: mx.array, y: mx.array) -> mx.array:
    logits = model(x)
    V = logits.shape[-1]
    return nn.losses.cross_entropy(
        logits.reshape(-1, V), y.reshape(-1), reduction="mean"
    )


def estimate_loss(model: GPT, get_batch, n_batches: int) -> float:
    model.eval()
    losses = []
    for _ in range(n_batches):
        x, y = get_batch()
        losses.append(float(loss_fn(model, x, y)))
    model.train()
    return float(np.mean(losses))


def save_checkpoint(model: GPT, ckpt_dir: Path, cfg_dump: dict) -> None:
    from mlx.utils import tree_flatten
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    flat = dict(tree_flatten(model.parameters()))
    mx.save_safetensors(str(ckpt_dir / "model.safetensors"), flat)
    (ckpt_dir / "config.json").write_text(json.dumps(cfg_dump, indent=2))


def main() -> None:
    print(f"=== train.py ===")
    print(f"config: {CFG}")
    print(f"tokenizer={TOKENIZER}, batch={BATCH_SIZE}, n_steps={N_STEPS}, "
          f"lr={LR}, patience={PATIENCE}")

    train_data = load_split(TRAIN_BIN)
    val_data = load_split(VAL_BIN)
    print(f"train: {len(train_data):,} tokens   val: {len(val_data):,} tokens")

    model = GPT(CFG)
    mx.eval(model.parameters())
    print(f"params: {model.num_params()/1e6:.2f}M")

    opt = optim.AdamW(learning_rate=LR)
    loss_and_grad = nn.value_and_grad(model, loss_fn)

    train_batcher = make_batcher(train_data, BATCH_SIZE, CFG.ctx_len, seed=0)
    val_batcher = make_batcher(val_data, BATCH_SIZE, CFG.ctx_len, seed=1)

    cfg_dump = {
        "vocab_size": CFG.vocab_size, "ctx_len": CFG.ctx_len,
        "n_layer": CFG.n_layer, "n_head": CFG.n_head, "n_embd": CFG.n_embd,
        "dropout": CFG.dropout,
        "batch_size": BATCH_SIZE, "lr": LR,
        "tokenizer": TOKENIZER,
    }

    CKPT_DIR.mkdir(parents=True, exist_ok=True)
    BEST_DIR = CKPT_DIR / "best"
    LAST_DIR = CKPT_DIR / "last"

    model.train()
    t0 = time.perf_counter()
    last_log_step = 0
    last_log_t = t0
    best_val = float("inf")
    best_step = 0
    no_improve_count = 0

    for step in range(1, N_STEPS + 1):
        # linear warmup then constant
        if step <= WARMUP_STEPS:
            opt.learning_rate = LR * step / WARMUP_STEPS

        x, y = train_batcher()
        loss, grads = loss_and_grad(model, x, y)
        opt.update(model, grads)
        mx.eval(model.parameters(), opt.state)

        if step % LOG_EVERY == 0:
            now = time.perf_counter()
            steps_per_sec = (step - last_log_step) / (now - last_log_t)
            elapsed = now - t0
            print(f"  step {step:>5}  train_loss={float(loss):.3f}  "
                  f"({steps_per_sec:.2f} sps, {elapsed/60:.1f}m elapsed)")
            last_log_step, last_log_t = step, now

        if step % EVAL_EVERY == 0 or step == N_STEPS:
            val_loss = estimate_loss(model, val_batcher, EVAL_BATCHES)
            improved = val_loss < best_val - 1e-3
            tag = " *new best*" if improved else ""
            print(f"  step {step:>5}  val_loss  ={val_loss:.3f}"
                  f"  (best={best_val:.3f}@{best_step}){tag}")

            if improved:
                best_val = val_loss
                best_step = step
                no_improve_count = 0
                save_checkpoint(model, BEST_DIR, {**cfg_dump, "step": step,
                                                 "val_loss": val_loss})
            else:
                no_improve_count += 1
                if no_improve_count >= PATIENCE:
                    print(f"  early-stop: no val improvement for "
                          f"{PATIENCE} consecutive evals")
                    break

        if step % CKPT_EVERY == 0:
            snap_dir = CKPT_DIR / f"snap-{step}"
            save_checkpoint(model, snap_dir, {**cfg_dump, "step": step})
            print(f"  checkpoint: {snap_dir.name}")

    elapsed = time.perf_counter() - t0
    print(f"\ntraining done in {elapsed:.1f}s  ({step} steps, "
          f"best_val={best_val:.3f} @ step {best_step})")

    # save final state as `last/`
    save_checkpoint(model, LAST_DIR, {**cfg_dump, "step": step,
                                       "val_loss": float("nan")})

    # default `checkpoints/{model.safetensors,config.json}` points at best-val
    if BEST_DIR.exists():
        for f in ["model.safetensors", "config.json"]:
            shutil.copy(BEST_DIR / f, CKPT_DIR / f)
        print(f"top-level checkpoint = best-val snapshot (step {best_step})")


if __name__ == "__main__":
    main()
