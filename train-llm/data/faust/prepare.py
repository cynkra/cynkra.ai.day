"""End-to-end corpus prep for the Goethe trainer.

Downloads Faust I + II from Project Gutenberg, strips the PG header/footer,
concatenates, trains a 2k-vocab byte-level BPE tokenizer on the result, and
encodes the corpus to uint16 train.bin / val.bin tensors (90/10 split).

Run from the project root:

    uv run --with tokenizers --with numpy data/faust/prepare.py

Idempotent — re-running overwrites all outputs in place.

Outputs (all in data/faust/):
  raw/faust1.txt, raw/faust2.txt   downloaded Project Gutenberg files
  faust.txt                        cleaned, concatenated training text
  tokenizer.json                   trained BPE tokenizer (HF tokenizers format)
  train.bin, val.bin               uint16 token arrays (numpy.fromfile-loadable)
  meta.json                        vocab_size, token counts, source URLs
"""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

# --- config ------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"

# Project Gutenberg IDs for Goethe's Faust in German (UTF-8).
# Faust I  = "Faust: Der Tragoedie erster Teil"  PG #2229
# Faust II = "Faust: Der Tragoedie zweiter Teil" PG #3160
SOURCES = [
    ("faust1.txt", "https://www.gutenberg.org/cache/epub/2229/pg2229.txt"),
    ("faust2.txt", "https://www.gutenberg.org/cache/epub/3160/pg3160.txt"),
]

VOCAB_SIZE = 2000
TRAIN_FRAC = 0.9


# --- download ----------------------------------------------------------------

def download(url: str, dest: Path) -> str:
    """Fetch url to dest as UTF-8 text. Cached: skips download if dest exists."""
    if dest.exists():
        print(f"  cached: {dest.name} ({dest.stat().st_size:,} bytes)")
        return dest.read_text(encoding="utf-8")
    print(f"  downloading: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "goethe-trainer/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    text = raw.decode("utf-8")
    dest.write_text(text, encoding="utf-8")
    print(f"  saved: {dest.name} ({len(raw):,} bytes)")
    return text


# --- header/footer stripping -------------------------------------------------

START_RE = re.compile(
    r"\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*",
    re.IGNORECASE,
)
END_RE = re.compile(
    r"\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*",
    re.IGNORECASE,
)


def strip_gutenberg(text: str, name: str) -> str:
    """Remove Project Gutenberg's licensing preamble and trailing license."""
    start = START_RE.search(text)
    end = END_RE.search(text)
    if not start or not end:
        sys.exit(
            f"ERROR: could not locate PG start/end markers in {name} "
            f"(start={bool(start)}, end={bool(end)})"
        )
    body = text[start.end() : end.start()]
    # Trim leading/trailing whitespace and any "Produced by ..." / "Transcriber's note"
    # that often live just after the START marker.
    lines = body.splitlines()
    # Drop blank lines and "Produced by" / "Anmerkungen zur Transkription" lines at top.
    drop_prefixes = (
        "produced by",
        "anmerkungen zur transkription",
        "transcriber",
        "[anmerkung",
    )
    while lines and (
        not lines[0].strip()
        or lines[0].strip().lower().startswith(drop_prefixes)
    ):
        lines.pop(0)
    return "\n".join(lines).strip() + "\n"


# --- BPE training ------------------------------------------------------------

def train_bpe(corpus_path: Path, out_path: Path, vocab_size: int) -> None:
    from tokenizers import Tokenizer
    from tokenizers.models import BPE
    from tokenizers.pre_tokenizers import ByteLevel
    from tokenizers.decoders import ByteLevel as ByteLevelDec
    from tokenizers.trainers import BpeTrainer

    tok = Tokenizer(BPE())
    tok.pre_tokenizer = ByteLevel(add_prefix_space=False)
    tok.decoder = ByteLevelDec()
    trainer = BpeTrainer(
        vocab_size=vocab_size,
        initial_alphabet=ByteLevel.alphabet(),
        show_progress=False,
    )
    tok.train(files=[str(corpus_path)], trainer=trainer)
    tok.save(str(out_path))
    print(f"  trained BPE: {out_path.name} (vocab={tok.get_vocab_size()})")


# --- encode + split ----------------------------------------------------------

def encode_and_split(corpus_path: Path, tok_path: Path, out_dir: Path,
                     train_frac: float) -> dict:
    import numpy as np
    from tokenizers import Tokenizer

    tok = Tokenizer.from_file(str(tok_path))
    text = corpus_path.read_text(encoding="utf-8")
    ids = tok.encode(text).ids
    arr = np.asarray(ids, dtype=np.uint16)
    n_train = int(len(arr) * train_frac)
    train, val = arr[:n_train], arr[n_train:]
    train.tofile(out_dir / "train.bin")
    val.tofile(out_dir / "val.bin")
    print(f"  encoded: {len(arr):,} tokens "
          f"(train={len(train):,}, val={len(val):,})")
    return {
        "total_chars": len(text),
        "total_tokens": int(len(arr)),
        "train_tokens": int(len(train)),
        "val_tokens": int(len(val)),
        "compression_chars_per_token": round(len(text) / len(arr), 2),
    }


# --- sanity check ------------------------------------------------------------

def sanity_check(tok_path: Path) -> None:
    """Tokenize a few classic Faust lines and print the splits."""
    from tokenizers import Tokenizer
    tok = Tokenizer.from_file(str(tok_path))
    samples = [
        "Habe nun, ach! Philosophie",
        "Werd ich zum Augenblicke sagen:",
        "Verweile doch! du bist so schoen!",
        "Mephistopheles",
    ]
    print("\n  --- sanity: BPE token splits ---")
    for s in samples:
        enc = tok.encode(s)
        toks = [tok.id_to_token(i) for i in enc.ids]
        print(f"  {s!r}")
        print(f"    -> {toks}")


# --- main --------------------------------------------------------------------

def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)

    # Phase 1: download
    print("[1/4] download")
    parts = []
    for name, url in SOURCES:
        text = download(url, RAW / name)
        parts.append((name, text))

    # Phase 2: strip + concat
    print("\n[2/4] strip Project Gutenberg headers/footers + concat")
    cleaned = []
    for name, text in parts:
        body = strip_gutenberg(text, name)
        print(f"  {name}: {len(text):,} chars -> {len(body):,} chars cleaned")
        cleaned.append(body)
    corpus = "\n\n".join(cleaned)
    corpus_path = HERE / "faust.txt"
    corpus_path.write_text(corpus, encoding="utf-8")
    print(f"  wrote: faust.txt ({len(corpus):,} chars)")

    # Phase 3: BPE
    print(f"\n[3/4] train BPE tokenizer (vocab={VOCAB_SIZE})")
    tok_path = HERE / "tokenizer.json"
    train_bpe(corpus_path, tok_path, VOCAB_SIZE)

    # Phase 4: encode + split
    print(f"\n[4/4] encode + split (train_frac={TRAIN_FRAC})")
    stats = encode_and_split(corpus_path, tok_path, HERE, TRAIN_FRAC)

    # Manifest
    meta = {
        "vocab_size": VOCAB_SIZE,
        "train_frac": TRAIN_FRAC,
        "sources": dict(SOURCES),
        **stats,
    }
    (HERE / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"\n  wrote: meta.json")

    sanity_check(tok_path)

    print("\nDONE. Files in data/faust/:")
    for p in sorted(HERE.iterdir()):
        if p.is_file():
            print(f"  {p.name:20s} {p.stat().st_size:>10,} bytes")


if __name__ == "__main__":
    main()
