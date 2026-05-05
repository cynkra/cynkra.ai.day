"""Greedy sampling from a trained Goethe checkpoint.

Run from the project root, on the Mac (NOT the dev container — needs MLX):

    source .venv/bin/activate
    python sample.py                                  # default prompt
    python sample.py "Habe nun, ach!"                 # custom prompt
    python sample.py "Habe nun, ach!" --max 500       # longer sample
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import mlx.core as mx
from tokenizers import Tokenizer

from model import GPT, GPTConfig

HERE = Path(__file__).resolve().parent
DATA = HERE / "data" / "faust"
CKPT_DIR = HERE / "checkpoints"


def load_model() -> tuple[GPT, Tokenizer]:
    cfg_path = CKPT_DIR / "config.json"
    ckpt_path = CKPT_DIR / "model.safetensors"
    if not cfg_path.exists() or not ckpt_path.exists():
        raise SystemExit(
            f"missing checkpoint — run train.py first ({CKPT_DIR})"
        )
    cfg_dict = json.loads(cfg_path.read_text())
    cfg = GPTConfig(
        vocab_size=cfg_dict["vocab_size"],
        ctx_len=cfg_dict["ctx_len"],
        n_layer=cfg_dict["n_layer"],
        n_head=cfg_dict["n_head"],
        n_embd=cfg_dict["n_embd"],
    )
    model = GPT(cfg)
    weights = list(mx.load(str(ckpt_path)).items())
    model.load_weights(weights)
    mx.eval(model.parameters())

    tok = Tokenizer.from_file(str(DATA / "tokenizer.json"))
    return model, tok


def greedy_generate(model: GPT, tok: Tokenizer, prompt: str, max_new: int) -> str:
    ctx_len = model.cfg.ctx_len
    ids = tok.encode(prompt).ids
    if not ids:
        ids = [0]  # avoid empty input
    idx = mx.array([ids])  # (1, T)

    for _ in range(max_new):
        # crop to last ctx_len tokens (sliding window)
        cond = idx if idx.shape[1] <= ctx_len else idx[:, -ctx_len:]
        logits = model(cond)              # (1, T, V)
        next_logits = logits[:, -1, :]    # (1, V)
        next_id = mx.argmax(next_logits, axis=-1, keepdims=True)  # (1, 1)
        idx = mx.concatenate([idx, next_id], axis=1)
        mx.eval(idx)

    out_ids = idx.tolist()[0]
    return tok.decode(out_ids)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("prompt", nargs="?", default="Habe nun, ach! Philosophie",
                   help="seed text")
    p.add_argument("--max", type=int, default=200, dest="max_new",
                   help="number of new tokens to generate (default 200)")
    args = p.parse_args()

    model, tok = load_model()
    print(f"--- prompt ---\n{args.prompt}\n")
    print(f"--- generating {args.max_new} tokens (greedy) ---")
    out = greedy_generate(model, tok, args.prompt, args.max_new)
    print(out)


if __name__ == "__main__":
    main()
