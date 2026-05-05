# Train LLM — Requirements

## Success criterion

By the end of the weekend, the model generates **recognizably Goethe-like German text** — archaic phrasings (*ihr/euer*, *ach*, *o weh*), pseudo-classical sentence structures, ideally an occasional Knittelvers or blank-verse rhythm. A sample of a few hundred tokens, judged by eye. No BLEU, no perplexity benchmark as the target — just "does this look like Goethe or not".

A loss curve that decreases monotonically is a precondition, not the success criterion.

## Corpus

Goethe — works from Project Gutenberg in German (Faust I+II, Werther, Wilhelm Meister, poems, etc.). Order of magnitude MB, comparable to the classic tiny-Shakespeare corpus. UTF-8, umlauts preserved.

## Hardware constraint

**The first version must run on a 16 GB laptop (Apple Silicon).** If that turns out to be too tight, we fall back to a 32 GB laptop before going to the Mac Mini. The Mac Mini is for longer runs later, not for the first iteration.

## Iteration time

**One training run of the first version: ~5 minutes.** This dictates model size, batch size, and token budget. Once the pipeline is standing and we feel confident, a later run can be longer (hours to days on the Mac Mini).

## Model size

Start small — exact parameter count follows from the two constraints above (16 GB RAM, 5 min/run). Likely in the single-digit-millions parameter range for the first version. Will be made concrete in design.

## Not in scope

- State-of-the-art performance
- Fine-tuning an existing model
- Multi-GPU or multi-machine training
- Cloud GPU
- RLHF, instruct-tuning, chat format
- Hand-rolled tokenizer (use an existing library)
- Code corpus (separate follow-up project after Goethe)
- Reproducibility on other people's machines — "runs on ours" is enough
- Fixed artifact form (script vs. notebook vs. README) — emerges while writing

## Stretch goals (not committed)

- Longer run on the Mac Mini (several hours to days), larger model
- Sample generation with top-k / top-p, not just greedy
- Resume training from checkpoint

## Open points for design

- Tech stack: PyTorch (MPS backend) vs. Apple MLX vs. something else
- Tokenizer: char-level vs. BPE (e.g. via the `tokenizers` library)
- Concrete model architecture and size (layers, heads, embedding dim)
- Language: Python (default for the nanoGPT world) vs. an R component, where feasible
