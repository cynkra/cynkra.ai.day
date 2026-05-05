# indietypst — Roadmap

Status: Draft (2026-05-05)

This roadmap is written for the team that will actually build indietypst:
**R developers/engineers with limited Quarto and Typst experience**, who
need to **produce many design prototypes early** so the corporate-design
UX can be assessed before any abstraction is committed to.

It deliberately:

- front-loads hands-on learning in Typst itself, not in R,
- defers abstraction until after several throwaway prototypes exist,
- treats UX assessment (rendered PDFs reviewed by humans, side-by-side)
  as a first-class checkpoint, not an afterthought,
- leans on existing tools (see [design.md § Prior art](design.md)) rather
  than re-implementing them.

## Operating principles

1. **Build before you abstract.** No R wrapper until ≥6 hand-written
   `.typ` prototypes exist and have been reviewed.
2. **Throwaway is fine.** Phase 1 prototypes are not the codebase. Expect
   to delete most of them.
3. **Render every day.** A prototype that has not produced a PDF in the
   last 24 h does not exist.
4. **Steal aggressively.** `r2typ`, `quarto-r`, `typst-gather`,
   `quarto-ext/typst-templates`, and Typst Universe packages cover most
   of the plumbing. Do not reinvent them. See
   [design.md § Prior art](design.md).
5. **One reviewer not on the team.** Every UX checkpoint shows rendered
   PDFs to at least one person who did not author them. Designers
   preferred; non-authors otherwise.
6. **Keep cynkradown honest.** indietypst is validated against
   `cynkradown` and one second template (a letter or report variant) at
   every phase from P3 onward.

## Phase 0 — Onboarding (parallel, ~3 days)

Goal: every contributor can render a Typst document, a Quarto+Typst
document, and an indiedown PDF on their own machine, and has read enough
prior art to know what already exists.

Each contributor:

- Works through the Typst tutorial (https://typst.app/docs/tutorial/).
- Renders one indiedown sample PDF from
  [`upstream/indiedown`](../upstream/indiedown/) and reads its `R/` and
  `inst/mypackage/` sources.
- Builds one document by hand following [Quarto's Typst
  guide](https://quarto.org/docs/output-formats/typst.html).
- Clones and renders **one** project from the prior-art shortlist:
  `kazuyanagimoto/typstcv`, `mcanouil/quarto-mcanouil`, or
  `quarto-ext/typst-templates`.

Exit criterion: each contributor opens a 5-line PR adding their name and
the prior-art project they cloned to `docs/onboarding.md`.

## Phase 1 — Throwaway design prototypes (~1.5 weeks, fan out)

Goal: explore the design space in raw Typst before committing to any
abstraction.

- Each contributor produces **≥6 distinct `.typ` prototypes** under
  `prototypes/<author>/<name>/main.typ`. Plain Typst, no Quarto, no R.
- Coverage matrix the team should hit collectively (not per person):
  title pages, running headers/footers, code blocks, figures, tables,
  signature blocks, two-column variants, letter format.
- Borrow shapes from `modern-cv`, `letter-pro`, `biz-report`,
  `quarto-mcanouil`. Cite the source in a one-line comment in `main.typ`.
- Each prototype includes a `README.md` with: what it explores, what
  worked, what didn't, one screenshot.

UX checkpoint at half-time and end of phase:

- 60-min review with one external reviewer.
- Print-quality PDFs, A4, side-by-side on a wall or in a slide deck.
- Output: a written list of ~10 patterns to support and ~5 to drop.

Exit criterion: the patterns list is committed as
`docs/prototype-patterns.md` and at least one cynkra-house-style draft
is among the kept prototypes.

**Explicit non-goals of this phase:** R code, Quarto, package skeletons,
font helpers, abstraction of any kind.

## Phase 2 — Promote the best prototypes into Quarto+Typst (~1 week)

Goal: confirm the chosen designs survive being driven by markdown content
instead of hand-typed Typst, and pick **one** Quarto extension structure
to build on.

- Pick the 2–3 strongest Phase 1 prototypes.
- Re-implement each as a hand-written Quarto extension under
  `prototypes/quarto/<name>/_extensions/<name>/`. Still no R.
- Drive each from the *same* `.qmd` body so the comparison is honest.
- Borrow the partials structure from `quarto-ext/typst-templates`.

UX checkpoint:

- Render the same `.qmd` against each candidate extension.
- 30-min review; pick one.

Exit criterion: one canonical Quarto extension layout selected and
documented in `docs/extension-layout.md`.

## Phase 3 — Hand-build cynkradown as a real R package (~1 week)

Goal: produce one working corporate-design template the indietypst
scaffolder will later mass-produce. No scaffolder yet.

- Create `cynkradown/` as a hand-written R package (sibling of
  `indietypst/`).
- Implement the three customization layers from
  [design.md § Three-layer customization](design.md):
  - `inst/indietypst/defaults.yaml`
  - `inst/indietypst/preamble.typ`
  - `inst/indietypst/pre_processor.R` (start with a Quarto pre-render
    script; revisit Lua filter alternative if needed)
- One design generator (e.g. `cd_page_title()`). Build on
  [`r2typ`](https://github.com/y-sunflower/r2typ) if it fits; otherwise
  use raw strings.
- `install_indietypst_extension()` + `check_indietypst_extension()`
  wrapping `quarto::quarto_add_extension()`.

UX checkpoint:

- Render the cynkra "annual report" sample from indiedown's archives
  through cynkradown.
- Side-by-side with the LaTeX-rendered original; reviewer notes
  pixel/typography deltas.

Exit criterion: cynkradown renders a non-trivial document end-to-end on
a clean machine that has only R, Quarto, and the bundled fonts.

## Phase 4 — Generalize into the indietypst scaffolder (~1.5 weeks)

Goal: reverse-engineer the hand-built cynkradown into
`create_indietypst_package("mytypst")`.

- Implement `create_indietypst_package()` to produce a package
  byte-equivalent to (or at least PDF-equivalent to) cynkradown's
  hand-built form.
- Implement `use_indietypst_gfonts()` (scaffold-time download only).
- Implement `dr_typst()` reporting versions, extension installability,
  and a sample render.
- Add one second template (letter or report variant) to validate that
  the scaffolder is generic.

Exit criterion: a fresh user can run

```r
create_indietypst_package("acme")
# install acme, then
acme::install_indietypst_extension(project = "demo/")
quarto::quarto_render("demo/report.qmd")
```

and get a PDF without editing anything by hand.

## Phase 5 — Air-gap and migration (~1 week)

Goal: brown-field flow.

- Wire `quarto call typst-gather` into a `bootstrap_indietypst_project()`
  helper so Typst registry packages, fonts, and Quarto caches are staged
  on a networked machine.
- Implement font system fallback (declared font stack, brand → bundled).
- Build `port_rmd_to_qmd()` and run it on a real indiedown user's
  archive (cynkra reports). Document residual manual steps.

UX checkpoint:

- Render a ported document on a fully air-gapped machine. Reviewer
  confirms output matches.

Exit criterion: documented end-to-end migration of one real cynkra
document, plus one offline-render reproduction.

## Phase 6 — Hardening and docs (~1 week)

Goal: ship-ready.

- Vignettes mirroring indiedown: `vignette("indietypst")`,
  `vignette("walkthrough")`, `vignette("customize")`.
- Tests covering the scaffolder, install/check helpers, diagnostic, and
  one full render per template.
- CI: render cynkradown and the second template on every PR; compare
  against committed reference PDFs (visual diff).
- CRAN-readiness check.

Exit criterion: green CI on a clean install; one external user (a cynkra
employee not on the project) successfully creates and renders a template
following only the vignettes.

## Cross-cutting

- **Review cadence:** UX checkpoints at the end of P1, P2, P3, P5. Each
  is a 30–60 min session with one non-author reviewer; outcomes
  committed to the relevant `docs/*.md`.
- **Definition of v1:** Phase 6 exit criterion met, plus the seven open
  questions in [design.md](design.md) closed (or explicitly punted with
  a written rationale).
- **What we will not build before v1:** HTML/EPUB/Word backends; bundled
  Typst installer; web preview; template gallery; Typst-package authoring
  tooling. (See [design.md § Non-goals](design.md).)

## Risk register

| Risk | Mitigation |
|---|---|
| Team underestimates Typst learning curve | Phase 0 is real; do not skip. |
| Premature abstraction | P1 forbids R/Quarto. P2 forbids the scaffolder. |
| `pre_processor.R` execution surface unsuitable | Prototype both Quarto pre-render *and* Lua filter in P3 before deciding. |
| Quarto/Typst version churn | Pin versions in `dr_typst()` and CI. |
| `cynkradown` over-fits the framework | A second template is required from P4 onward. |
| Air-gapped story slips | P5 has a hard exit gate; do not declare v1 without an offline render. |
