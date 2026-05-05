# Handover — Goethe trainer

When you sit down at the Mac after lunch, this is the path from here to a
trained model. The corpus is already prepared and on disk via the bind mount;
you only need to set up MLX and run three scripts.

## What's already done (in the dev container)

- **Corpus prepared end-to-end.** `data/faust/prepare.py` ran successfully here.
  On disk, ready to use:
  - `data/faust/faust.txt` — 886 KB cleaned, concatenated Faust I + II
  - `data/faust/tokenizer.json` — 2k-vocab byte-level BPE
  - `data/faust/train.bin` — 291,833 tokens (uint16, ≈570 KB)
  - `data/faust/val.bin` — 32,426 tokens
  - `data/faust/meta.json` — manifest
- **MLX code written:** `model.py`, `spike.py`, `train.py`, `sample.py`.
  ⚠ Written without being able to execute MLX (Linux container). Expect to
  fix small API mismatches on first run — diff against `mlx-examples/transformer_lm`
  if anything blows up.
- **Spec updated.** Locked decisions are in `openspec/changes/add-goethe-trainer/`.

## What to do on the Mac

### 1. One-time setup (~2 min)

```bash
cd ~/git/cynkra/cynkra.ai.day/train-llm

# Create a venv (use whichever you prefer; uv is faster if installed)
python3 -m venv .venv          # or:  uv venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt    # or:  uv pip install -r requirements.txt

# Verify MLX picked up Metal (should print "Device(gpu, 0)" or similar)
python -c "import mlx.core as mx; print(mx.default_device())"
```

If MLX install fails, common fixes:
- `pip install --upgrade pip` first (mlx wheels need recent pip)
- Make sure you're on **Apple Silicon** Python (`python -c "import platform; print(platform.machine())"` → should say `arm64`, not `x86_64`)

### 2. Spike — measure throughput on this hardware (~1–2 min)

```bash
python spike.py
```

This trains two tiny models (Config A: 2 layers, embd=64; Config B: 4 layers,
embd=128) for 100 steps each, then reports tokens/sec, peak memory, and a
back-of-envelope budget calculation: at the measured throughput, how many
tokens fit in a 5-minute training run, and how many epochs over the
324k-token corpus that is.

**Expected runtime:** under 2 min total if MLX is working. If it hangs >10 min
or OOMs, something's wrong — check the model size and ctx_len.

### 3. Pick locked dims, edit train.py (~2 min)

Open `train.py`, find the `=== CONFIG ===` block at the top. The defaults are
identical to spike Config B (n_layer=4, n_head=4, n_embd=128, ctx=128). If the
spike said "you have headroom for 10× more compute", bump the dims (more layers,
wider embd, longer ctx). If it said "barely enough", shrink them.

Quick guide based on what the spike reports:

| If `epochs` (from spike output) is... | Action |
|---|---|
| > 50 | Scale up: try `n_layer=6, n_embd=256, ctx=256` (~10M params) |
| 5–50 | Defaults are fine for a first run |
| < 5 | Shrink ctx or layers; budget too tight |

Also bump `N_STEPS` if you want a longer run. Default 2000 steps × batch 32
× ctx 128 = 8.2M tokens consumed = ~25× the corpus.

### 4. Train (~5 min, or whatever your spike said)

```bash
python train.py
```

You should see train_loss dropping from ~7.6 to under 4 within a few hundred
steps (random init = log(2000) ≈ 7.6; lower = model is learning). val_loss
should track train_loss; if val_loss plateaus while train_loss keeps dropping,
you're overfitting (expected on pure Faust — that's the trade-off we accepted).

Saves to `checkpoints/model.safetensors` and `checkpoints/config.json` at the
end.

### 5. Sample — does it look like Goethe? (~5 sec)

```bash
python sample.py                           # default prompt: "Habe nun, ach! Philosophie"
python sample.py "Mephistopheles spricht:" --max 400
python sample.py "Verweile doch!"
```

The success criterion (per `2-requirements.md`): generates recognizably
Goethe-like German — archaic phrasings, classical sentence structures,
ideally hints of Knittelvers/blank-verse rhythm. If output is gibberish but
loss decreased monotonically, that's still a "pipeline works" win — just
train longer or scale model up.

## Things that might break (and what to do)

- **MLX import error** → wrong Python arch (Rosetta? x86 brew Python?). Use
  Apple Silicon native python3.
- **`mx.metal` doesn't exist** → fine, peak-memory reporting just becomes
  `None`. Doesn't break the run.
- **`mx.split` / `mx.softmax` / `nn.value_and_grad` API mismatch** → MLX moves
  fast. Check `python -c "import mlx; print(mlx.__version__)"` and consult
  https://github.com/ml-explore/mlx-examples/tree/main/transformer_lm for the
  current idioms; patch model.py / spike.py / train.py.
- **Loss = NaN immediately** → likely lr too high; halve `LR` in train.py.
- **Loss stuck at log(vocab) ≈ 7.6** → optimizer not actually updating;
  check that `mx.eval(model.parameters(), opt.state)` runs each step.
- **OOM** → reduce `BATCH_SIZE`, then `ctx_len`, then `n_embd`.

## After it works

Capture spike's final numbers + chosen dims back into the spec:

- `openspec/changes/add-goethe-trainer/design.md` § "Model architecture" — replace "TBD" with actual dims
- `openspec/changes/add-goethe-trainer/tasks.md` §3.6 — mark done with the chosen config
- Mark §4, §5, §6 done as you walk through them

Then start a fresh Claude session in this folder and run `/opsx:apply
add-goethe-trainer` to keep walking the task list, or `/opsx:archive` once
everything's checked off.
