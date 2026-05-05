# OpenSpec — train-llm

This folder is managed by **OpenSpec** (https://github.com/Fission-AI/OpenSpec). The CLI was installed via `npx openspec init --tools claude`, which also dropped the `.claude/` integration one level up.

## Layout

```
openspec/
├── specs/                          ← target state (populated when changes are archived)
└── changes/
    ├── archive/                    ← history of archived changes
    ├── add-goethe-trainer/         ← active change
    │   ├── .openspec.yaml
    │   ├── proposal.md             ← Why / What Changes / Capabilities / Impact
    │   ├── design.md               ← Context / Goals / Decisions / Risks
    │   ├── specs/goethe-trainer/
    │   │   └── spec.md             ← delta spec (ADDED Requirements + Scenarios)
    │   └── tasks.md                ← numbered checkbox tasks
    └── add-goethe-trainer.manual/  ← hand-written snapshot, see below
```

## Two views of the same project

The narrative form of this spec lives one level up:

- `../1-motivation.md` and `../2-requirements.md` — written via the `/blockr-spec` skill, free-form prose phases.

The OpenSpec form here covers the same ground in a stricter, schema-driven shape:

- `proposal.md` ≈ motivation + requirements (Why, What, Capabilities, Impact)
- `design.md` ≈ phase 3 of `/blockr-spec`
- `specs/.../spec.md` — the testable, archive-mergeable contract (no `/blockr-spec` equivalent)
- `tasks.md` ≈ phase 4 of `/blockr-spec`

Both views are kept on purpose, as a learning artifact comparing the two workflows.

## `add-goethe-trainer.manual/`

Snapshot of the change folder *before* we installed the OpenSpec CLI — three hand-written files that mirror the OpenSpec layout but don't follow the official schema (no Capabilities section, no delta-spec format, no numbered checkboxes). Kept alongside the real change to make the format diff visible.

## Useful CLI commands

```bash
# status of all changes
npx -p @fission-ai/openspec@latest openspec list

# status of one change
npx -p @fission-ai/openspec@latest openspec status --change add-goethe-trainer

# validate a change against its schema
npx -p @fission-ai/openspec@latest openspec validate add-goethe-trainer

# scaffold a new change
npx -p @fission-ai/openspec@latest openspec new change <name>
```

The `.claude/commands/opsx/` slash commands wrap these flows: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`, `/opsx:explore`. They appear after a Claude Code restart.
