# Add Goethe Trainer

## Why

We want to train a small language model from scratch ourselves, in order to understand the process from the inside — data preparation, tokenization, training loop, evaluation, checkpointing. nanoGPT-style, classical corpus (Goethe).

Learning experience is the foreground. The artifact at the end — the trained model — does not have to be useful. What matters is that the pipeline has been walked once and we know where the pitfalls are. If a useful model or some reusable training infrastructure falls out of the learning project later: bonus, not requirement.

## What Changes

We build a minimal training pipeline:

- Corpus: works of Goethe from Project Gutenberg (Faust I+II, Werther, Wilhelm Meister, poems, etc.), UTF-8, umlauts preserved
- Model: nanoGPT-style Transformer, single-digit millions of parameters
- Training: runs on a 16 GB Apple Silicon laptop, one iteration run ≤5 minutes
- Sample generation: produces recognizably Goethe-like German text (archaic phrasings, pseudo-classical sentence structures)
- Tech stack choice (PyTorch/MPS vs. Apple MLX vs. JAX) is decided in design
- Tokenizer choice (char-level vs. BPE) is decided in design

Scaling stage 2 (Mac Mini, 64 GB, multi-hour runs) is a stretch goal, not committed.

## Impact

- **Code:** entirely new project, no existing code is modified
- **Specs:** none — `specs/` stays empty, because this change itself is the first target state (see `../README.md`)
- **Repos:** code location still to be decided (likely a standalone repo `train-llm/` or `goethe-trainer/`, not inside a blockr package)
- **Dependencies:** Python stack (PyTorch or MLX, tokenizer library). No R component required

## Out of Scope

- State-of-the-art performance, benchmarks
- Fine-tuning an existing model (LoRA/QLoRA, MLX-LM)
- Multi-GPU or multi-machine training, cloud GPU
- RLHF, instruct-tuning, chat format
- Hand-rolled tokenizer (use an existing library)
- Code corpus / coding model — separate follow-up project after Goethe
- Reproducibility on other people's machines — "runs on ours" is enough
- Connection to blockr (the existing `qwen-trainer` spec addresses a different problem: prompt-engineering for air-gapped environments)

## Success Criteria

By the end of the weekend:

1. A training run completes cleanly (loss decreases monotonically)
2. Sample output is recognizably Goethe-like (judged by eye, no automated benchmark)
3. We can explain every block in the training code (tokenizer, embedding, attention, loss, optimizer step)
