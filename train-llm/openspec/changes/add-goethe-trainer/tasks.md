## 1. Setup

> Code is written here in the dev container at `/workspace/cynkra.ai.day/train-llm/`; tasks 1.2–1.4 run from a **host-Mac terminal** at `~/git/cynkra/cynkra.ai.day/train-llm/` (same directory via bind mount).

- [x] 1.1 ~~Decide code location~~ — locked: container `/workspace/cynkra.ai.day/train-llm/` ↔ host `~/git/cynkra/cynkra.ai.day/train-llm/`
- [x] 1.2 ~~Add .gitignore~~ — done as project-local `train-llm/.gitignore` (cleaner than touching cynkra.ai.day root); covers `.venv/`, data artifacts, checkpoints, logs
- [x] 1.3 (host) Created `.venv` and activated
- [x] 1.4 (host) Installed `requirements.txt` — mlx 0.29.3, mlx-lm 0.29.1, tokenizers 0.22.2, numpy 2.0.2; `mx.default_device()` → `Device(gpu, 0)`
- [x] 1.5 ~~Clone / study `mlx-examples/transformer_lm`~~ — written from memory + standard nanoGPT idioms; first-run on Mac may need small API patches (see HANDOVER.md "Things that might break")

## 2. Corpus

> All of §2 done end-to-end in the dev container via `data/faust/prepare.py` (run with `uv run --with tokenizers --with numpy data/faust/prepare.py`). Outputs sit on the bind mount, ready for the Mac.

- [x] 2.1 Downloaded Faust I (PG #2229, 218 KB) + Faust II (PG #3160, 746 KB) from Project Gutenberg (UTF-8, German)
- [x] 2.2 Stripped PG START/END markers + leading "Produced by" lines; UTF-8 / umlauts preserved
- [x] 2.3 Concatenated → `data/faust/faust.txt` (886,072 chars; bigger than the 600 KB estimate because Faust II is ~3× longer than I)
- [x] 2.4 Trained byte-level BPE (HF `tokenizers`, vocab=2000) → `data/faust/tokenizer.json`
- [x] 2.5 Encoded corpus → 324,259 uint16 tokens; 90/10 split into `train.bin` (291,833) / `val.bin` (32,426)

## 3. Spike — lunch-break throughput measurement (~30 min)

> Implementation = inside dev container. **Execution (runs, measurements) = host-Mac terminal.** Same split applies to §4, §5, §6.

- [x] 3.1 Compared BPE at vocab=1k / 2k / 4k via `data/faust/compare_vocab.py`. Result: 4k packs whole archaic words into single tokens (`'Mephistopheles'` → 1 token, `'ewig'`, `'schön'` → 1 token each); 2k keeps morpheme-ish splits (`'Mephistopheles'` → 6 tokens); 1k is too coarse (doesn't even merge `'nun'`). 2k is the right starting hypothesis; 4k worth trying if loss plateaus and we want richer per-token signal.
- [x] 3.2 Implemented minimal MLX transformer (parametric `model.py` + `spike.py` Config A: 2 layers, embd=64, ctx=64, ~100k params)
- [x] 3.3 (host) Ran `python spike.py`. A_small (2×2×64, ctx=64): 0.36M params, 160.7 steps/s, 0.33M tok/s, 125 MB peak. B_medium (4×4×128, ctx=128): 1.32M params, 28.2 steps/s, 0.12M tok/s, 612 MB peak. Loss after 100 steps: 5.74 / 5.19. First-try clean — no MLX API patches needed.
- [x] 3.4 Spike script also runs Config B (4 layers, embd=128, ctx=128) — the 4× scale; user reads results in `python spike.py` output
- [x] 3.5 (host) Budget block: at B_medium throughput, 5-min budget = 34.6M tokens = **119× corpus epochs**. Way deep in "scale up" territory.
- [x] 3.6 (host) Locked dims: `n_layer=6, n_head=8, n_embd=256, ctx_len=256`, batch=32, n_steps=1000 → 5.82M params. Captured back into `design.md § Model architecture`.

## 4. Model

> All implemented in `model.py` (parametric via `GPTConfig`). Dummy-batch forward-pass verification deferred to first-run on Mac since MLX is Apple-only.

- [x] 4.1 Implemented `nn.Embedding` for tokens + learned positional embedding (`model.py` `GPT.__init__`)
- [x] 4.2 Implemented Transformer block: pre-LN + multi-head causal self-attention + residual; pre-LN + MLP (4× expansion, GELU) + residual (`Block`, `CausalSelfAttention`, `MLP`)
- [x] 4.3 Stacked N blocks + final LayerNorm + linear output head (`GPT.__call__`)
- [x] 4.4 (host) Spike's first forward pass exercised model end-to-end at two configs without shape errors — dummy-batch verification done.

## 5. Training

> Implementation in `train.py` (real loop) and `spike.py` (degenerate loop for measurement). Execution on Mac.

- [x] 5.1 Implemented training step: `loss_fn` + `nn.value_and_grad` + `optim.AdamW` + `mx.eval(model.parameters(), opt.state)` (in both `spike.py` and `train.py`)
- [x] 5.2 Implemented `make_batcher` that draws random windows from `np.memmap`'d `train.bin`/`val.bin` (`spike.py` and `train.py`)
- [x] 5.3 Implemented periodic train + val loss logging at `LOG_EVERY` / `EVAL_EVERY` steps (`train.py`)
- [x] 5.4 (host) Spike smoke-run passed — both configs stepped without errors, loss decreased monotonically.
- [x] 5.5 (host) `python train.py` — 1000 steps in 262.1s (4m22s, 3.8 steps/s), train_loss 7.6 → 3.51, val_loss 4.96 → 4.16. Mild val gap (~0.65) by end = expected pure-Faust overfit.
- [x] 5.6 (host) Saved: `checkpoints/model.safetensors` and `checkpoints/config.json`.

## 6. Sampling

> Implementation in `sample.py`. Execution on Mac.

- [x] 6.1 Implemented greedy token-by-token generation with sliding-window context cropping (`sample.py` `greedy_generate`)
- [x] 6.2 (host) Sampled with `"Habe nun, ach! Philosophie"`, `"Mephistopheles spricht:"`, `"Verweile doch!"`. Output: recognizably Goethe-like — play structure with `MEPHISTOPHELES.` character labels, archaic phrasings (`Ich bin ich mir nicht`, `Und seid's nicht`, `Ich kannst du`), apostrophe contractions. Greedy decoding mode-collapses into repetition (expected from argmax); top-k/top-p (§7.2) is the natural fix.
- [x] 6.3 (host) No iteration needed for first-run success criterion. If pursued: longer training, larger model, or stochastic sampling.

## 7. Stretch

- [ ] 7.1 Run a longer training run on the Mac Mini (64 GB)
- [ ] 7.2 Implement top-k / top-p sampling
- [ ] 7.3 Implement resume-from-checkpoint
