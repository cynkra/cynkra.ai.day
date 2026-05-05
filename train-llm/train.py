"""Real training run — informed by spike.py results.

Trains a parametric GPT on the encoded Faust corpus, prints train+val loss
periodically, and saves a checkpoint at the end.

Run from the project root, on the Mac (NOT the dev container — needs MLX):

    source .venv/bin/activate
    python train.py

If you want to override the defaults below from the CLI, edit the CONFIG block.
The expected workflow is: run spike.py first, then bump the dims here based on
its tokens/sec measurement before running train.py.
"""

from __future__ import annotations

import json
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


# === CONFIG (edit after seeing spike.py output) =============================

VOCAB = 2000
# Spike (B_medium = 1.3M params, ctx=128, batch=32) measured 0.12M tok/s on this
# Mac → 119× corpus epochs in 5 min, well into "scale up" territory per the
# HANDOVER table. Bumping to ~10M params, ctx=256.
CFG = GPTConfig(
    vocab_size=VOCAB,
    ctx_len=256,
    n_layer=6,
    n_head=8,
    n_embd=256,
)
BATCH_SIZE = 32
N_STEPS = 1000
LR = 3e-4
EVAL_EVERY = 200
EVAL_BATCHES = 10
LOG_EVERY = 50
CKPT_NAME = "model.safetensors"

# ============================================================================


def load_split(name: str) -> np.ndarray:
    p = DATA / f"{name}.bin"
    if not p.exists():
        raise SystemExit(f"missing {p} — run `python data/faust/prepare.py`")
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
    losses = []
    for _ in range(n_batches):
        x, y = get_batch()
        losses.append(float(loss_fn(model, x, y)))
    return float(np.mean(losses))


def main() -> None:
    print(f"=== train.py ===")
    print(f"config: {CFG}")
    print(f"batch_size={BATCH_SIZE}, n_steps={N_STEPS}, lr={LR}")

    train_data = load_split("train")
    val_data = load_split("val")
    print(f"train: {len(train_data):,} tokens   val: {len(val_data):,} tokens")

    model = GPT(CFG)
    mx.eval(model.parameters())
    print(f"params: {model.num_params()/1e6:.2f}M")

    opt = optim.AdamW(learning_rate=LR)
    loss_and_grad = nn.value_and_grad(model, loss_fn)

    train_batcher = make_batcher(train_data, BATCH_SIZE, CFG.ctx_len, seed=0)
    val_batcher = make_batcher(val_data, BATCH_SIZE, CFG.ctx_len, seed=1)

    CKPT_DIR.mkdir(parents=True, exist_ok=True)

    t0 = time.perf_counter()
    last_log_step = 0
    last_log_t = t0
    for step in range(1, N_STEPS + 1):
        x, y = train_batcher()
        loss, grads = loss_and_grad(model, x, y)
        opt.update(model, grads)
        mx.eval(model.parameters(), opt.state)

        if step % LOG_EVERY == 0:
            now = time.perf_counter()
            steps_per_sec = (step - last_log_step) / (now - last_log_t)
            print(f"  step {step:>5}  train_loss={float(loss):.3f}  "
                  f"({steps_per_sec:.1f} steps/s)")
            last_log_step, last_log_t = step, now

        if step % EVAL_EVERY == 0 or step == N_STEPS:
            val_loss = estimate_loss(model, val_batcher, EVAL_BATCHES)
            print(f"  step {step:>5}  val_loss  ={val_loss:.3f}")

    elapsed = time.perf_counter() - t0
    print(f"\ntraining done in {elapsed:.1f}s "
          f"({N_STEPS / elapsed:.1f} steps/s)")

    # save checkpoint (mlx.utils handles tree -> safetensors)
    from mlx.utils import tree_flatten
    flat = dict(tree_flatten(model.parameters()))
    ckpt_path = CKPT_DIR / CKPT_NAME
    mx.save_safetensors(str(ckpt_path), flat)
    cfg_dump = {
        "vocab_size": CFG.vocab_size, "ctx_len": CFG.ctx_len,
        "n_layer": CFG.n_layer, "n_head": CFG.n_head, "n_embd": CFG.n_embd,
        "n_steps": N_STEPS, "batch_size": BATCH_SIZE, "lr": LR,
    }
    (CKPT_DIR / "config.json").write_text(json.dumps(cfg_dump, indent=2))
    print(f"saved: {ckpt_path}")
    print(f"saved: {CKPT_DIR / 'config.json'}")


if __name__ == "__main__":
    main()
