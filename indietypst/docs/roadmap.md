# indietypst — Roadmap

Status: Draft (2026-05-05, rev 2)

This roadmap is written for the team that will actually build indietypst:
**R developers/engineers with limited Quarto and Typst experience**, who
need confidence that the full toolchain works on real documents before
any abstraction is committed to.

The strategy is **"play the whole game"**: from the first week the team
runs the full path — pick a real cynkra document already rendered with
indiedown, replicate it end-to-end as a Quarto+Typst document driven by
a minimal `cynkradown` R package, compare PDFs, learn what is missing,
add the next document. The framework (`indietypst`) is *extracted* from
working `cynkradown` code once the patterns are obvious; it is not
designed up front.

## Operating principles

1. **Vertical slices, not horizontal phases.** Each iteration takes one
   real document end-to-end (`.qmd` → Quarto → Typst → PDF, driven by
   a `cynkradown` R package) and ends with a side-by-side review against
   the indiedown-rendered original. No iteration is "pure design" or
   "pure plumbing".
2. **Crude is fine. Duplicate before you abstract.** First three
   iterations may hardcode and copy-paste shamelessly. The framework
   emerges from observed duplication, not from speculation.
3. **Every iteration produces a PDF.** A change that has not produced a
   reviewable PDF in the last 24 h does not exist.
4. **Compare-to-original is the acceptance test.** Every iteration ends
   with the new PDF placed next to the indiedown-rendered original and
   reviewed by at least one non-author. Acceptable visual deltas are
   recorded; surprises become tasks.
5. **Steal aggressively.** `quarto-r`, `r2typ`, `typst-gather`,
   `quarto-ext/typst-templates`, Typst Universe packages cover most of
   the plumbing. See [design.md § Prior art](design.md). Do not
   reinvent.
6. **`indietypst` is harvested, not designed.** It does not exist as a
   real package until at least three documents have been rendered
   through `cynkradown` and the duplication is obvious.

## Iteration 0 — Toolchain spike (~2 days, parallel)

Goal: every contributor has rendered *something* through the full path
and confirmed the local toolchain works. No real document yet.

Per contributor:

- Render the indiedown sample report from
  [`upstream/indiedown`](../upstream/indiedown/) to PDF locally.
- Render the same content as a hand-typed `.qmd` with `format: typst`
  and the stock Quarto Typst format. PDFs will not match — that is the
  point.
- Skim the Typst tutorial (https://typst.app/docs/tutorial/) and the
  prior-art shortlist in [design.md § Prior art](design.md); clone and
  render **one** of `kazuyanagimoto/typstcv`,
  `mcanouil/quarto-mcanouil`, `quarto-ext/typst-templates`.

Exit criterion: a 5-line PR per contributor adding their name and the
prior-art project they cloned to `docs/onboarding.md`.

## Iteration 1 — Document A end-to-end through `cynkradown` (~1 week)

Goal: render **one** real cynkra document through the full path. No
indietypst, no scaffolder, no abstraction. The point is to see the whole
game.

- Pick **Document A**: the simplest real cynkra report already rendered
  with indiedown — minimal title page, plain prose, a few sections, no
  fancy tables.
- Create `cynkradown/` as a hand-written R package containing:
  - `inst/_extensions/cynkradown/` — minimal Quarto extension (started
    from `quarto-ext/typst-templates/dept-news` or similar).
  - `inst/indietypst/preamble.typ` — Typst `#set`/`#show` rules pulled
    over from `preamble.tex` by hand.
  - `inst/indietypst/defaults.yaml` — Quarto YAML.
  - `R/install_extension.R` — wraps `quarto::quarto_add_extension()`
    to wire the bundled extension into a project.
  - `R/cd_page_title.R` — one design generator returning Typst markup,
    raw strings, no abstraction.
- Convert the source `.Rmd` to `.qmd` by hand (mechanical for prose,
  case-by-case for chunks). No `port_rmd_to_qmd()` helper yet.
- Render. Compare side-by-side with the indiedown-rendered original.

Acceptance: PDF reviewed against original by one non-author. Visual
deltas listed in `cynkradown/NOTES.md` with severity.

Explicit non-goals of this iteration:

- No `indietypst` package.
- No font helper, no `dr_typst()`, no `pre_processor.R`.
- No "design system". Hardcode everything; we have one document.

## Iteration 2 — Document B (~1 week)

Goal: render a **structurally different** cynkra document through
`cynkradown`. The diff between Iterations 1 and 2 is where the
customization vocabulary starts to emerge.

- Pick **Document B**: a cynkra letter, or a two-column report — must
  differ from A in layout (not just content).
- Extend `cynkradown` minimally to handle B without breaking A.
- Where A and B require *different* Typst settings driven by metadata
  (e.g. `twocolumn: true`), introduce
  `inst/indietypst/pre_processor.R` for the first time. Prototype it
  as a Quarto pre-render script *and* as a Lua filter; pick one based
  on which is less awkward for the actual rule.
- If a design generator can be reused between A and B, do so — but do
  not invent ones speculatively.

Acceptance: both A and B render via `quarto render` against the same
installed `cynkradown`, both reviewed against originals.

What we learn: which of indiedown's three customization layers we
actually need at this scale, and what their Typst-flavoured shapes look
like.

## Iteration 3 — Document C, with edge cases (~1 week)

Goal: render a third cynkra document that breaks something. The point
is to discover where `cynkradown` is brittle while it is still small
enough to refactor cheaply.

- Pick **Document C**: something with at least one non-trivial element —
  tables (`kableExtra`-like in indiedown), figures with captions in a
  brand style, a custom title page with a logo, or a long signature
  block.
- Extend `cynkradown` to handle C. Refactor freely; no compatibility
  guarantees yet.
- Introduce font handling here: at least one declared brand font with
  a system fallback to a bundled open-source equivalent (see
  [design.md goal 5](design.md)).

Acceptance: A, B, C all render against the same `cynkradown`. PDFs
reviewed. `cynkradown/NOTES.md` summarizes the duplication and patterns
the team observed across the three iterations — this list is the
input to Iteration 4.

## Iteration 4 — Extract `indietypst` from `cynkradown` (~1.5 weeks)

Goal: now that three documents have been rendered, the duplication
between `cynkradown`'s pieces and "what every template will need" is
visible. Extract that into `indietypst`.

- Refactor `cynkradown` so that anything generic moves into a new
  `indietypst/` R package.
- Implement `create_indietypst_package("...")` to produce a package
  that, when filled in with assets equivalent to `cynkradown`'s,
  renders A, B, and C identically to the current hand-built version.
- Implement `install_indietypst_extension()`,
  `check_indietypst_extension()`, `dr_typst()` (versions, extension
  resolution, sample render).
- Implement `use_indietypst_gfonts()` (scaffold-time only).

Acceptance test (this is the iteration's gate, not a side check):

```r
# Throw away the current hand-built cynkradown.
unlink("cynkradown", recursive = TRUE)

# Regenerate it via the scaffolder.
indietypst::create_indietypst_package("cynkradown")
# Drop in assets (fonts, logos, defaults.yaml, preamble.typ,
# pre_processor.R, design generators) from a snapshot.
# Render A, B, C — PDFs match the Iteration 3 outputs.
```

If documents stop rendering or look different, indietypst is wrong, not
the documents.

## Iteration 5 — Second template via the scaffolder (~1 week)

Goal: prove the framework is not an over-fit to cynkra. Build a second
template *only* through `create_indietypst_package()` and assets —
nobody hand-edits `indietypst` package internals during this iteration.

- Pick a non-cynkra style: a generic letter, or a permissively-licensed
  reproduction of a public report design.
- Render at least one document with it.

Acceptance: PDF reviewed. Any required hand-edits to `indietypst`
itself are tasks for a follow-up iteration; the iteration *passes*
only if the scaffolder + assets were enough.

## Iteration 6 — Air-gapped and document migration (~1 week)

Goal: brown-field flow.

- `bootstrap_indietypst_project()` runs `quarto call typst-gather` and
  primes Quarto's caches. See
  [design.md goal 6](design.md).
- `port_rmd_to_qmd()` mechanically converts an indiedown `.Rmd` to a
  `.qmd` against the equivalent `indietypst` template. Run it on the
  three documents from Iterations 1–3 and confirm the renders still
  match. (Documents A, B, C were converted by hand earlier; we are
  validating the automated conversion against a known-good target.)

Acceptance:

- All three documents render successfully on a machine with no network
  access (post-bootstrap).
- `port_rmd_to_qmd()` produces a `.qmd` that renders to a PDF
  acceptably close to the hand-converted version.

## Iteration 7 — Hardening and docs (~1 week)

Goal: ship-ready.

- Vignettes mirroring indiedown: `vignette("indietypst")`,
  `vignette("walkthrough")`, `vignette("customize")`. Walkthrough is
  a guided replay of Iterations 1–3 with simplified assets.
- Tests covering scaffolder, install/check, diagnostic, and one full
  render per template.
- CI: render `cynkradown` (A, B, C) and the second template on every
  PR; visual-diff against committed reference PDFs.
- CRAN-readiness pass.
- Close (or explicitly punt) the open questions in
  [design.md](design.md).

Acceptance: green CI on a clean machine; one external user (a cynkra
employee not on the project) creates and renders a template following
only the vignettes.

## UX assessment

Because every iteration ends in a side-by-side PDF review against a real
indiedown-rendered original, UX assessment is continuous, not a separate
checkpoint. The standing format:

- 30–45 min review at the end of each iteration.
- One non-author reviewer (designer preferred when available; cynkra
  document author for content-fidelity questions).
- Both PDFs printed on A4 *and* shown on screen; reviewer marks deltas
  in three buckets: brand-correct, acceptable, must-fix.
- Outcomes appended to `cynkradown/NOTES.md` (Iterations 1–3) and to
  `indietypst/NOTES.md` (Iterations 4+).

## Cross-cutting

- **Source of truth for "real documents":** a small archive in
  `cynkradown/inst/examples/` containing the original `.Rmd`, its
  indiedown-rendered PDF, the converted `.qmd`, and the new PDF. Every
  iteration adds at least one entry.
- **Definition of v1:** Iteration 7 acceptance met, plus the open
  questions in [design.md](design.md) closed or explicitly punted.
- **What we will not build before v1:** HTML/EPUB/Word backends; bundled
  Typst installer; web preview; template gallery; Typst-package
  authoring tooling. (See [design.md § Non-goals](design.md).)

## Risk register

| Risk | Mitigation |
|---|---|
| Team blocks on Typst syntax in Iteration 1 | Pair-program; pick the simplest Document A; copy heavily from `quarto-ext/typst-templates/dept-news`. |
| Premature framework extraction | Iteration 4 is *not allowed* until three documents render through `cynkradown`. |
| `cynkradown` over-fits the framework | Iteration 5 explicitly forbids hand-edits to `indietypst`; second template proves generalization. |
| `pre_processor.R` execution surface (Quarto pre-render vs. Lua filter) chosen wrong | Iteration 2 prototypes both before deciding. |
| Quarto/Typst version churn | Pin versions in `dr_typst()` and CI. |
| Air-gapped story slips | Iteration 6 has a hard offline-render gate; v1 not declared without it. |
| Document migration looks impractical | If `port_rmd_to_qmd()` cannot get acceptably close in Iteration 6, demote to a documented manual procedure rather than blocking v1. |
