# Tasks — Add Goethe Trainer

> Status: **stub**. To be worked out in phase 4 of the `/blockr-spec` flow, once design is settled. Tasks are deliberately kept as rough stages, not yet broken down into code-level steps.

## 1. Setup

- [ ] Decide on code location (standalone repo `train-llm/` or `goethe-trainer/`)
- [ ] Set up Python environment (venv / uv), install tech stack (per design)

## 2. Corpus

- [ ] Fetch Goethe works from Project Gutenberg
- [ ] Strip Gutenberg headers/footers, normalize UTF-8
- [ ] Train/val split
- [ ] Train tokenizer or build char vocabulary (per design)

## 3. Model

- [ ] Implement model module (embedding, n × Transformer block, output head)
- [ ] Test forward pass on a batch, shape check

## 4. Training

- [ ] Write training loop (load batch → forward → loss → backward → step)
- [ ] Loss logging (e.g. simple print, or TensorBoard if low effort)
- [ ] Save checkpoint at end of run
- [ ] First run on 16 GB laptop, ≤5 min, verify loss decreases monotonically

## 5. Sampling

- [ ] Sample script: prompt → model → token-by-token generation
- [ ] Inspect output, judge against Goethe criterion

## 6. Stretch

- [ ] Longer run on Mac Mini (64 GB), larger model
- [ ] Top-k / top-p sampling instead of greedy
- [ ] Resume from checkpoint
