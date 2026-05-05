## Why

We want to train a small language model from scratch ourselves to understand the LLM training pipeline from the inside — corpus prep, tokenization, training loop, sampling, checkpointing. Learning experience is the goal; the trained model itself does not have to be useful.

## What Changes

- Add a new Goethe-language-model training pipeline (nanoGPT-style) using **Apple MLX**
- Ingest **Faust I + II** from Project Gutenberg, UTF-8 with umlauts preserved (~600 KB)
- Train a **BPE tokenizer** (HuggingFace `tokenizers`, vocab ~2k starting hypothesis) on the corpus itself
- Run a lunch-break throughput **spike** before the real run: measure tokens/sec on the actual hardware and back into model dims and vocab size empirically
- Implement a small Transformer sized to a 16 GB Apple Silicon laptop with ≤5 min per training run (single-digit-millions parameters; final dims locked by the spike)
- Implement greedy sample generation that produces recognizably Goethe-like German text
- Save a model checkpoint at the end of each run so sampling does not require retraining

## Capabilities

### New Capabilities

- `goethe-trainer`: end-to-end pipeline that ingests a Goethe corpus, trains a small Transformer language model on Apple Silicon, and generates Goethe-like text samples from the trained model

### Modified Capabilities

(none — greenfield project, no existing specs)

## Impact

- **Code:** new project subfolder at `/workspace/cynkra.ai.day/train-llm/` (Cynkra dev day repo); no existing code modified
- **Specs:** adds `specs/goethe-trainer/`
- **Dependencies:** Apple MLX (`mlx`, `mlx-lm`), HuggingFace `tokenizers`; no R component required
- **Hardware:** target = 16 GB Apple Silicon laptop; stretch = Mac Mini (64 GB) for multi-hour runs
- **Out of scope:** SOTA performance, fine-tuning an existing model, multi-GPU, cloud GPU, RLHF / instruct-tuning, hand-rolled tokenizer, code corpus, reproducibility on third-party machines, tie-in to blockr (`qwen-trainer` is a separate concern)
