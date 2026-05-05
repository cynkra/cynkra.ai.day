"""Compare BPE token splits at vocab sizes 1k, 2k, 4k.

Runs in the dev container (no MLX needed):

    uv run --with tokenizers data/faust/compare_vocab.py

Trains three byte-level BPE tokenizers on the cleaned Faust corpus and prints
how each one tokenizes a handful of classic Faust lines side-by-side. Useful
for the §3.1 task ("eyeball whether vocab=2k is the right starting point").

Saves alt tokenizers to data/faust/tokenizer-{1k,4k}.json so the canonical
tokenizer.json (= 2k, used by everything else) isn't touched.
"""

from __future__ import annotations

from pathlib import Path

from tokenizers import Tokenizer
from tokenizers.models import BPE
from tokenizers.pre_tokenizers import ByteLevel
from tokenizers.decoders import ByteLevel as ByteLevelDec
from tokenizers.trainers import BpeTrainer

HERE = Path(__file__).resolve().parent
CORPUS = HERE / "faust.txt"

VOCABS = [1000, 2000, 4000]

SAMPLES = [
    "Habe nun, ach! Philosophie",
    "Werd ich zum Augenblicke sagen:",
    "Verweile doch! du bist so schön!",
    "Mephistopheles spricht zu Faust:",
    "Im Anfang war die Tat",
    "Das ewig Weibliche zieht uns hinan",
]


def train(vocab_size: int) -> Tokenizer:
    tok = Tokenizer(BPE())
    tok.pre_tokenizer = ByteLevel(add_prefix_space=False)
    tok.decoder = ByteLevelDec()
    trainer = BpeTrainer(
        vocab_size=vocab_size,
        initial_alphabet=ByteLevel.alphabet(),
        show_progress=False,
    )
    tok.train(files=[str(CORPUS)], trainer=trainer)
    return tok


def main() -> None:
    if not CORPUS.exists():
        raise SystemExit(f"missing {CORPUS} — run prepare.py first")

    print(f"corpus: {CORPUS.name} ({CORPUS.stat().st_size:,} bytes)")
    print(f"training {len(VOCABS)} BPE tokenizers...")
    toks = {}
    for v in VOCABS:
        t = train(v)
        toks[v] = t
        # Save alts; don't overwrite the canonical 2k that the pipeline uses
        if v != 2000:
            out = HERE / f"tokenizer-{v//1000}k.json"
            t.save(str(out))
            print(f"  saved: {out.name}")
    print()

    for s in SAMPLES:
        print(f">>> {s}")
        for v, t in toks.items():
            ids = t.encode(s).ids
            toks_str = [t.id_to_token(i) for i in ids]
            print(f"  {v:4d} ({len(ids):2d} toks): {toks_str}")
        print()


if __name__ == "__main__":
    main()
