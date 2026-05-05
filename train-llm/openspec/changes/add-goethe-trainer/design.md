## Context

A weekend learning project to walk the LLM training pipeline end-to-end on local Apple Silicon hardware. Greenfield — no existing system to extend. Two scaling stages: laptops (16/24/32 GB) for fast iteration, Mac Mini (64 GB) for longer runs as a stretch goal. Cloud GPUs are not in play.

## Goals / Non-Goals

**Goals:**
- Walk every step of the pipeline (corpus → tokenizer → model → training → sampling) at least once
- Be able to explain every block of the training code afterwards
- Produce sample output that reads as recognizably Goethe-like to a human

**Non-Goals:**
- State-of-the-art performance, automated benchmarks
- Fine-tuning a pretrained model (LoRA/QLoRA, MLX-LM)
- Multi-GPU, multi-machine, or cloud-GPU training
- RLHF, instruct-tuning, chat formatting
- Production-grade trainer; this is a learning artifact
- Reproducibility on machines other than ours

## Decisions

### Tech stack — Apple MLX

Chosen over PyTorch/MPS and JAX. Rationale: the project's goal is to learn the LLM training pipeline, and on Apple Silicon the one capability the hardware has that nothing else does is unified memory. MLX exploits it directly; PyTorch/MPS abstracts it away. Smaller ecosystem and slightly less portable, but neither is a project goal.

### Tokenizer — BPE

Chosen over char-level. Rationale: BPE converges faster per token on a tiny corpus, and vocab size becomes a tuning knob for Goethe-likeness — a small vocab (1–2k) keeps archaic spellings as multi-token sequences (orthographic texture), a larger vocab (8k+) packs whole archaic words into single tokens (lexical character).

- Library: HuggingFace `tokenizers` (Rust core, clean Python API, actively maintained)
- Trained on the Goethe corpus itself; not reused from a German-news BPE
- Vocab size: **2k** (locked). Empirically compared 1k / 2k / 4k via `data/faust/compare_vocab.py`: 4k packs whole archaic words into single tokens (`'Mephistopheles'` → 1 token), 2k keeps morpheme-ish splits, 1k is too coarse. 2k is the right balance of texture vs. per-token signal for this corpus size; 4k is the natural escalation if loss plateaus.

### Corpus — Faust I + II only

Chosen over a broader Goethe selection (Werther, Wilhelm Meister, poems). ~600 KB, roughly half of tinyShakespeare. Accept overfitting risk in exchange for the cleanest Knittelvers/blank-verse signal — the model essentially learns "be Mephisto", which is a satisfying outcome for a learning project.

### Repo location — `/workspace/cynkra.ai.day/train-llm/` (write here, run from host Mac)

Project lives as a subfolder of the **Cynkra dev day repo** (`/workspace/cynkra.ai.day/`), per that repo's convention ("Create a subfolder within the repo and set it as your project directory"). Code, spec, corpus, tokenizer, checkpoints — all live in this one directory. The directory is bind-mounted from the host Mac:

| Side | Path |
|---|---|
| Dev container (this Claude session writes here) | `/workspace/cynkra.ai.day/train-llm/` |
| Host Mac (terminal runs scripts here) | `~/git/cynkra/cynkra.ai.day/train-llm/` |

The split of responsibilities:

- **Inside the dev container (this Claude session):** write all the Python scripts, the BPE training file, the tokenizer/encoder, the model code, the training loop, the sampling script.
- **Outside the dev container (host Mac terminal):** create the Python venv, `pip install mlx mlx-lm tokenizers`, run the scripts. MLX is Apple-only; the venv binaries are macOS-native, so the venv is not usable from inside the container — that's fine.

`.venv/`, downloaded corpus files, tokenizer artifacts, and checkpoints should be added to `.gitignore` at the **cynkra.ai.day root** (which currently ignores `.Rproj.user`, `.Rhistory`, `.Rdata`, `.httr-oauth`, `.DS_Store`, `.quarto`) before committing anything code-side. Per the dev-day README, work should also live on a branch like `train-llm-main`.

### Reference implementation

Anchor on `mlx-examples/transformer_lm`. Read and adapt rather than implement from zero — the goal is to understand a working pipeline, not to invent one.

### Spike — lunch-break throughput measurement

Before implementing the real model, run a ~30-minute spike: smallest possible MLX transformer (~100k params), 100 training steps on a 100 KB slice of Faust, measure tokens/sec and peak RAM, scale 4× and repeat. Output: one number (tokens/sec) plus a locked model size and BPE vocab size for the real run. See `tasks.md` §3.

### Model architecture

Sized to the budget (16 GB RAM, ≤5 min/run): few layers, embedding dim ~128–256, context length 128–256, single-digit-millions parameters total. **Final numbers locked by the spike** — its job is to measure tokens/sec on the actual hardware and back into what fits the 5-minute budget.

## Risks / Trade-offs

- **MLX ecosystem gaps** → if some convenience is missing in MLX, port the relevant 20 lines from PyTorch rather than swapping the whole stack
- **Pure Faust overfits early** → expected; if loss plateaus before sampling looks Goethe-like, scale model up gently rather than restart, and consider adding Werther as a fallback corpus extension
- **Goethe output unrecognizable** → acceptable as long as loss decreases monotonically and we can explain every block of code; "Goethe-like output" is the soft goal

## Open Questions

All design-level questions resolved. Remaining unknowns are empirical and resolved by the spike (tasks §3):

- BPE vocab size (~2k starting hypothesis)
- Exact model dims and context length
