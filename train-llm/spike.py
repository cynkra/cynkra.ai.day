"""Lunch-break throughput spike.

Goal: measure tokens/sec and peak memory at two model sizes, so we can pick
real-run dimensions for ≤5 min of training on the host Mac (16 GB Apple Silicon).
Per design.md §"Spike" and tasks.md §3.

Run from the project root, on the Mac (NOT the dev container — needs MLX):

    source .venv/bin/activate
    python spike.py
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path

import mlx.core as mx
import mlx.nn as nn
import mlx.optimizers as optim
import numpy as np

from model import GPT, GPTConfig

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "faust"


# --- spike configs (vocab is fixed by the trained tokenizer = 2000) ---------

@dataclass
class SpikeRun:
    name: str
    cfg: GPTConfig
    batch_size: int
    n_steps: int


VOCAB = 2000

RUNS = [
    SpikeRun(
        name="A_small",
        cfg=GPTConfig(vocab_size=VOCAB, ctx_len=64, n_layer=2, n_head=2, n_embd=64),
        batch_size=32,
        n_steps=100,
    ),
    SpikeRun(
        name="B_medium",
        cfg=GPTConfig(vocab_size=VOCAB, ctx_len=128, n_layer=4, n_head=4, n_embd=128),
        batch_size=32,
        n_steps=100,
    ),
]


# --- data loader -------------------------------------------------------------

def load_train() -> np.ndarray:
    bin_path = DATA / "train.bin"
    if not bin_path.exists():
        raise SystemExit(
            f"missing {bin_path} — run `python data/faust/prepare.py` first"
        )
    return np.memmap(bin_path, dtype=np.uint16, mode="r")


def make_batcher(data: np.ndarray, batch_size: int, ctx_len: int):
    n = len(data) - ctx_len - 1
    rng = np.random.default_rng(0)

    def get_batch():
        ix = rng.integers(0, n, size=batch_size)
        x = np.stack([data[i : i + ctx_len].astype(np.int32) for i in ix])
        y = np.stack([data[i + 1 : i + 1 + ctx_len].astype(np.int32) for i in ix])
        return mx.array(x), mx.array(y)

    return get_batch


# --- training step -----------------------------------------------------------

def loss_fn(model: GPT, x: mx.array, y: mx.array) -> mx.array:
    logits = model(x)                                # (B, T, V)
    V = logits.shape[-1]
    return nn.losses.cross_entropy(
        logits.reshape(-1, V), y.reshape(-1), reduction="mean"
    )


# --- spike runner ------------------------------------------------------------

def run_spike(run: SpikeRun, data: np.ndarray) -> dict:
    print(f"\n--- {run.name}: "
          f"n_layer={run.cfg.n_layer}, n_head={run.cfg.n_head}, "
          f"n_embd={run.cfg.n_embd}, ctx={run.cfg.ctx_len}, "
          f"batch={run.batch_size} ---")

    model = GPT(run.cfg)
    mx.eval(model.parameters())  # materialise lazy init
    n_params = model.num_params()
    print(f"  params: {n_params/1e6:.2f}M")

    opt = optim.AdamW(learning_rate=3e-4)
    loss_and_grad = nn.value_and_grad(model, loss_fn)
    get_batch = make_batcher(data, run.batch_size, run.cfg.ctx_len)

    # reset memory counter before timed loop (Apple Silicon Metal backend)
    if hasattr(mx, "metal") and hasattr(mx.metal, "reset_peak_memory"):
        mx.metal.reset_peak_memory()

    # warmup (1 step, not timed) — first call compiles kernels
    x, y = get_batch()
    loss, grads = loss_and_grad(model, x, y)
    opt.update(model, grads)
    mx.eval(model.parameters(), opt.state)
    loss_start = float(loss)

    t0 = time.perf_counter()
    last_loss = loss_start
    for step in range(run.n_steps):
        x, y = get_batch()
        loss, grads = loss_and_grad(model, x, y)
        opt.update(model, grads)
        mx.eval(model.parameters(), opt.state)
        last_loss = float(loss)
    dt = time.perf_counter() - t0

    tokens_per_step = run.batch_size * run.cfg.ctx_len
    tokens_total = tokens_per_step * run.n_steps
    tok_per_sec = tokens_total / dt
    steps_per_sec = run.n_steps / dt

    peak_mb = None
    if hasattr(mx, "metal") and hasattr(mx.metal, "get_peak_memory"):
        peak_mb = mx.metal.get_peak_memory() / (1024 * 1024)

    print(f"  step 1   loss: {loss_start:.3f}")
    print(f"  step {run.n_steps:<3} loss: {last_loss:.3f}")
    print(f"  time: {dt:.2f}s  ({steps_per_sec:.1f} steps/s, "
          f"{tok_per_sec/1e6:.2f}M tokens/s)")
    if peak_mb is not None:
        print(f"  peak memory: {peak_mb:,.0f} MB")

    return {
        "name": run.name,
        "n_params": n_params,
        "tok_per_sec": tok_per_sec,
        "steps_per_sec": steps_per_sec,
        "peak_mb": peak_mb,
        "loss_start": loss_start,
        "loss_end": last_loss,
    }


# --- main --------------------------------------------------------------------

def main() -> None:
    print("=== Goethe trainer spike — throughput measurement ===")
    data = load_train()
    print(f"corpus: {len(data):,} train tokens (vocab={VOCAB})")

    results = [run_spike(r, data) for r in RUNS]

    # Back-of-envelope budget calculation: at the larger config's throughput,
    # how many tokens fit in a 5-minute training run? How many epochs over
    # our 324k-token corpus is that?
    biggest = results[-1]
    BUDGET_SEC = 5 * 60
    tokens_in_budget = biggest["tok_per_sec"] * BUDGET_SEC
    epochs = tokens_in_budget / len(data)

    print("\n=== budget ===")
    print(f"At {biggest['name']} throughput "
          f"({biggest['tok_per_sec']/1e6:.2f}M tok/s):")
    print(f"  5-min budget = {tokens_in_budget/1e6:.1f}M tokens")
    print(f"             = {epochs:.0f}× corpus epochs ({len(data):,} tokens/epoch)")
    print()
    print("If epochs >> 10: consider scaling model up (more layers / wider) so "
          "compute doesn't go to repeating the corpus.")
    print("If epochs < 1:   model is too big or context too long for the budget.")
    print()
    print("Pick locked dims for train.py based on these numbers, then update")
    print("design.md / tasks.md §3.6 with the chosen config.")


if __name__ == "__main__":
    main()
