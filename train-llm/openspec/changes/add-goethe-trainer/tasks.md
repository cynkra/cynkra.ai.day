## 1. Setup

> Code is written here in the dev container at `/workspace/cynkra.ai.day/train-llm/`; tasks 1.2–1.4 run from a **host-Mac terminal** at `~/git/cynkra/cynkra.ai.day/train-llm/` (same directory via bind mount).

- [x] 1.1 ~~Decide code location~~ — locked: container `/workspace/cynkra.ai.day/train-llm/` ↔ host `~/git/cynkra/cynkra.ai.day/train-llm/`
- [x] 1.2 ~~Add .gitignore~~ — done as project-local `train-llm/.gitignore` (cleaner than touching cynkra.ai.day root); covers `.venv/`, data artifacts, checkpoints, logs
- [ ] 1.3 (host) `cd ~/git/cynkra/cynkra.ai.day/train-llm && python3 -m venv .venv && source .venv/bin/activate`
- [ ] 1.4 (host) `pip install -r requirements.txt`  *(file already created with `mlx`, `mlx-lm`, `tokenizers`, `numpy`)*
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
- [ ] 3.3 (host) `python spike.py` — runs 100 steps on the encoded train.bin, prints tokens/sec + peak RAM
- [x] 3.4 Spike script also runs Config B (4 layers, embd=128, ctx=128) — the 4× scale; user reads results in `python spike.py` output
- [ ] 3.5 (host) Read `=== budget ===` block at end of `spike.py` output
- [ ] 3.6 (host) Edit `train.py` CONFIG block with final dims; capture chosen config back into `design.md` § "Model architecture" and tick this

## 4. Model

> All implemented in `model.py` (parametric via `GPTConfig`). Dummy-batch forward-pass verification deferred to first-run on Mac since MLX is Apple-only.

- [x] 4.1 Implemented `nn.Embedding` for tokens + learned positional embedding (`model.py` `GPT.__init__`)
- [x] 4.2 Implemented Transformer block: pre-LN + multi-head causal self-attention + residual; pre-LN + MLP (4× expansion, GELU) + residual (`Block`, `CausalSelfAttention`, `MLP`)
- [x] 4.3 Stacked N blocks + final LayerNorm + linear output head (`GPT.__call__`)
- [ ] 4.4 (host) First run of `python spike.py` exercises the forward pass end-to-end — counts as the dummy-batch shape verification

## 5. Training

> Implementation in `train.py` (real loop) and `spike.py` (degenerate loop for measurement). Execution on Mac.

- [x] 5.1 Implemented training step: `loss_fn` + `nn.value_and_grad` + `optim.AdamW` + `mx.eval(model.parameters(), opt.state)` (in both `spike.py` and `train.py`)
- [x] 5.2 Implemented `make_batcher` that draws random windows from `np.memmap`'d `train.bin`/`val.bin` (`spike.py` and `train.py`)
- [x] 5.3 Implemented periodic train + val loss logging at `LOG_EVERY` / `EVAL_EVERY` steps (`train.py`)
- [ ] 5.4 (host) `python spike.py` is the smoke run — verifies nothing explodes before committing to a full training run
- [ ] 5.5 (host) `python train.py` — full training, ≤5 min, verify loss decreases
- [ ] 5.6 (host) `train.py` saves to `checkpoints/model.safetensors` + `config.json` at end — verify file lands

## 6. Sampling

> Implementation in `sample.py`. Execution on Mac.

- [x] 6.1 Implemented greedy token-by-token generation with sliding-window context cropping (`sample.py` `greedy_generate`)
- [ ] 6.2 (host) `python sample.py "Habe nun, ach! Philosophie"` — eyeball output for Goethe-likeness
- [ ] 6.3 (host) Iterate on training duration / model dims if output is unsatisfying

## 7. Stretch

- [ ] 7.1 Run a longer training run on the Mac Mini (64 GB)
- [ ] 7.2 Implement top-k / top-p sampling
- [ ] 7.3 Implement resume-from-checkpoint
