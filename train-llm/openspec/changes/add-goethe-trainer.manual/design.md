# Design — Add Goethe Trainer

> Status: **open**. To be worked out in phase 3 of the `/blockr-spec` flow. Stub, so that the OpenSpec layout is complete.

## To be decided

- **Tech stack:** PyTorch (MPS backend) vs. Apple MLX vs. JAX
- **Tokenizer:** char-level (simpler, slower learning) vs. BPE via the `tokenizers` library (closer to real LLMs)
- **Model architecture:** layers / heads / embedding dim, concrete numbers fitting the 16 GB / 5 min budget
- **Corpus preparation:** how Goethe gets from Project Gutenberg into a tensor (download, UTF-8 cleanup, splits)
- **Reference implementation:** which existing mini-repo to anchor on (Karpathy's `nanoGPT`, MLX examples from `mlx-examples`, ...)

## Constraints already decided (from requirements)

- First version must run on a 16 GB Apple Silicon laptop (32 GB as fallback)
- One training run ≤ 5 minutes in the first version
- No multi-GPU, no cloud
- No hand-rolled tokenizer
