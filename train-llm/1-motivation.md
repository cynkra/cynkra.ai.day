# Train LLM — Motivation

## What this is about

We want to train a small language model from scratch ourselves, in order to understand the process from the inside — data preparation, tokenization, training loop, evaluation, checkpointing. nanoGPT-style: a manageable Transformer model on a classical corpus (e.g. Goethe), possibly later on code.

## What's in the foreground

**Learning experience, not product.** The artifact at the end — the trained model — does not have to be useful. What matters is that we have walked the pipeline once and know where the pitfalls are. If a useful model or some reusable infrastructure for further experiments falls out of the learning project later, that's a bonus, not a requirement.

## Out of scope

- **No fine-tuning**, no LoRA/QLoRA on an existing model. That is a separate toolchain (MLX, Transformers, PEFT) and a different learning experience — deliberately deferred.
- **No blockr connection.** The existing `qwen-trainer` spec addresses a different problem (prompt-engineering for Qwen 3 in air-gapped environments). Here we are about the training process as such.
- **No cloud GPUs.** Everything runs on our own hardware.

## Hardware and scale

Two stages:

- **Iteration on laptops** (16 / 24 / 32 GB RAM, Apple Silicon). Fast experiments, small models, small corpora — tiny-Goethe style.
- **Longer runs on the Mac Mini in the office** (64 GB RAM, fully spec'd, runs as a server). When a weekend run of several hours to days seems worth it, it runs there.

## Time frame

Weekend project. If by the end of a weekend the first token output is there and we understand the pipeline, the goal is reached.

## Language and tooling

Open. R is the house default, some Python is around, new tools are fine. The choice gets made in design — likely lands on Python/PyTorch or Apple MLX, since that is where the Mac optimizations live.

## Corpus

First choice: Goethe (small, classical, fast feedback loop). A later variant might use code for a tiny coding model — but only after stage 1 is solid.
