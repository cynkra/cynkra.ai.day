"""Sampling from a trained Goethe checkpoint.

Supports greedy, temperature, top-k, and repetition penalty. The argmax-only
mode (greedy) produces fluent but mode-collapsing text; with temperature +
top-k + a small repetition penalty, the same checkpoint produces
dramatically more varied output.

    source .venv/bin/activate
    python sample.py                                              # defaults
    python sample.py "Habe nun, ach!" --max 400 --temp 0.9 --topk 40 --rep 1.15
    python sample.py "Verweile doch!" --greedy                    # old behaviour
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


def load_model(ckpt_dir: Path = CKPT_DIR) -> tuple[GPT, Tokenizer]:
    cfg_path = ckpt_dir / "config.json"
    ckpt_path = ckpt_dir / "model.safetensors"
    if not cfg_path.exists() or not ckpt_path.exists():
        raise SystemExit(f"missing checkpoint — run train.py first ({ckpt_dir})")
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

    tokenizer_name = cfg_dict.get("tokenizer", "tokenizer.json")
    tok = Tokenizer.from_file(str(DATA / tokenizer_name))
    return model, tok


def sample_next(
    logits: mx.array,
    history_ids: list[int],
    *,
    temperature: float,
    top_k: int | None,
    rep_penalty: float,
    rep_window: int,
) -> int:
    """Pick the next token from a (V,) logits vector.

    logits   — model output for the last position, shape (V,)
    history_ids — tokens generated so far (for repetition penalty)
    temperature — 0 = greedy argmax; >0 = sample from softened distribution
    top_k    — if set, only consider the top_k highest-logit tokens
    rep_penalty — divide logits of recent tokens by this; 1.0 = off
    rep_window — how many recent tokens to apply rep_penalty to
    """
    if temperature <= 0:
        return int(mx.argmax(logits).item())

    # Repetition penalty: scale down logits of tokens that recently appeared.
    # Penalising recent tokens nudges the model away from the greedy attractor
    # without forbidding repetition outright.
    if rep_penalty != 1.0 and history_ids:
        recent = set(history_ids[-rep_window:])
        # build a vector of penalties; do it in numpy-equivalent with mlx
        penalties = mx.ones(logits.shape)
        # we need to set penalty[id] = rep_penalty for each id in recent.
        # mlx doesn't have a clean scatter for this; do it via list -> mx.array.
        idx = mx.array(list(recent), dtype=mx.int32)
        penalties = penalties.tolist()
        for i in recent:
            penalties[i] = rep_penalty
        penalties = mx.array(penalties)
        # for positive logits: divide; for negative: multiply (standard CTRL-style)
        logits = mx.where(logits > 0, logits / penalties, logits * penalties)

    logits = logits / temperature

    if top_k is not None and top_k > 0 and top_k < logits.shape[-1]:
        # keep only the top_k logits, set the rest to -inf
        # mlx has argpartition but it's simpler to use sort
        sorted_logits = mx.sort(logits)
        kth = sorted_logits[-top_k]
        logits = mx.where(logits < kth, mx.array(-1e9), logits)

    probs = mx.softmax(logits, axis=-1)
    next_id = mx.random.categorical(mx.log(probs + 1e-9))
    return int(next_id.item())


def generate(
    model: GPT,
    tok: Tokenizer,
    prompt: str,
    max_new: int,
    temperature: float,
    top_k: int | None,
    rep_penalty: float,
    rep_window: int,
    seed: int,
) -> str:
    mx.random.seed(seed)
    ctx_len = model.cfg.ctx_len
    ids = tok.encode(prompt).ids
    if not ids:
        ids = [0]

    for _ in range(max_new):
        cond = ids[-ctx_len:] if len(ids) > ctx_len else ids
        x = mx.array([cond])
        logits = model(x)[0, -1, :]
        nxt = sample_next(
            logits, ids,
            temperature=temperature, top_k=top_k,
            rep_penalty=rep_penalty, rep_window=rep_window,
        )
        ids.append(nxt)

    return tok.decode(ids)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("prompt", nargs="?", default="Habe nun, ach! Philosophie")
    p.add_argument("--max", type=int, default=300, dest="max_new")
    p.add_argument("--temp", type=float, default=0.9,
                   help="sampling temperature (0 = greedy)")
    p.add_argument("--topk", type=int, default=40,
                   help="top-k cutoff (0 = no cutoff)")
    p.add_argument("--rep", type=float, default=1.15,
                   help="repetition penalty (1.0 = off)")
    p.add_argument("--rep-window", type=int, default=64,
                   help="rep penalty looks at last N tokens")
    p.add_argument("--greedy", action="store_true",
                   help="shortcut for --temp 0 (deterministic argmax)")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--ckpt", type=str, default=None,
                   help="path to checkpoint directory (default: checkpoints/)")
    args = p.parse_args()

    if args.greedy:
        args.temp = 0.0

    ckpt_dir = Path(args.ckpt) if args.ckpt else CKPT_DIR
    model, tok = load_model(ckpt_dir)

    print(f"--- ckpt: {ckpt_dir.name}  temp={args.temp} topk={args.topk} "
          f"rep={args.rep} seed={args.seed} ---")
    print(f"--- prompt ---\n{args.prompt}\n")
    print(f"--- generating {args.max_new} tokens ---")
    out = generate(
        model, tok, args.prompt, args.max_new,
        temperature=args.temp, top_k=args.topk,
        rep_penalty=args.rep, rep_window=args.rep_window,
        seed=args.seed,
    )
    print(out)


if __name__ == "__main__":
    main()
