# indietypst — Design Document

Status: Draft (2026-05-05, rev 2)
Authors: cynkra dev day
Replaces: nothing yet — net-new project, takes inspiration from
[indiedown](https://github.com/cynkra/indiedown).

## Background

[indiedown](https://github.com/cynkra/indiedown) is a cynkra R package that
scaffolds *another* R package, which acts as a customized R Markdown PDF
template encoding a corporate design (fonts, geometry, title pages, logos…).
Its toolchain is **R Markdown → knitr → Pandoc → LaTeX → PDF**. Customization
happens in three layers:

1. `inst/indiedown/default.yaml` — Pandoc YAML defaults.
2. `inst/indiedown/preamble.tex` — extra LaTeX preamble.
3. `inst/indiedown/pre_processor.R` — runtime R hook mutating Pandoc args.

The model works, but the LaTeX backend brings real friction: a TeX
distribution must be installed, builds are slow, error messages are opaque,
and non-trivial customizations push users into LaTeX they would rather not
write.

In parallel, two things happened:

- **Typst** matured into a viable typesetting system: single binary, fast
  incremental builds, modern programmable markup, growing package ecosystem.
- **Quarto** became the de-facto successor to R Markdown and gained native
  Typst support via `format: typst`.

**indietypst** is a clean-rewrite reimagining of indiedown built on this new
substrate.

## Goals

1. **Scaffold corporate-design templates that build to PDF via Typst.**
   `create_indietypst_package("mytypst")` produces a self-contained R package
   that wraps a Quarto extension and renders `.qmd` documents to PDF using
   the Typst backend.

2. **Mirror indiedown's three-layer customization model**, adapted to the new
   stack:
   - `defaults.yaml` — Quarto YAML defaults for `format: typst`.
   - `preamble.typ` — Typst snippet (`#set` / `#show` rules, imports,
     design constants) injected at the top of every rendered document.
   - `pre_processor.R` — R hook that runs before render to mutate metadata
     or generate Typst inputs from document state (e.g. twocolumn → tighter
     margins). Likely implemented as a Quarto pre-render script and/or a
     Lua filter (see Open questions).

3. **Quarto-native distribution, R-package-native UX.** Templates ship as a
   Quarto extension (`_extensions/<name>/`) so they are usable by any Quarto
   user. The *primary* user-facing handle remains an R package:
   `create_indietypst_package()`, font helpers, and a diagnostic. Because R
   library paths and Quarto's extension search paths differ across systems,
   we do **not** assume installing the R package automatically makes the
   extension visible to Quarto. Instead the package provides:
   - `install_indietypst_extension(project = ".")` — copies (or symlinks)
     the bundled `_extensions/<name>/` into a Quarto project, building on
     [`quarto::quarto_add_extension()`](https://quarto-dev.github.io/quarto-r/reference/quarto_add_extension.html).
   - `check_indietypst_extension(project = ".")` — verifies the extension
     is resolvable from the given project.

4. **Keep R as the design-generator language.** R functions returning Typst
   markup are the supported way to express dynamic title pages, headers,
   and signature blocks (analogue of indiedown's `cd_page_title()`). Where
   sensible, build on existing tooling rather than reinvent — see Prior art.

5. **Fonts: self-contained bundle with system fallback.** The shipped
   template renders without any system fonts using vendored, freely
   licensable fonts (e.g. open-source equivalents of the brand font). When
   matching proprietary fonts are present on the build machine, the
   template uses them automatically and falls back to the bundled fonts
   otherwise. Font *acquisition* (e.g. `use_indietypst_gfonts()`) happens
   at scaffold time, never at render time.

6. **Air-gapped builds.** After a one-time setup, rendering must not
   require any network access. This includes:
   - All assets (fonts, logos, images) vendored inside the template
     package.
   - Typst registry packages (`@preview/...`) staged into the project's
     `.quarto/` cache via [`quarto call
     typst-gather`](https://quarto.org/docs/advanced/typst/typst-gather.html)
     during scaffolding, so render time only reads from the cache.
   - Quarto's own caches primed during scaffolding; a `bootstrap` helper
     performs the warm-up so air-gapped CI environments can take over.

7. **Toolchain diagnostic.** Provide `dr_typst()` (or equivalent) that
   reports versions of R, Quarto, Typst, and indietypst, validates
   extension installation, runs a sample render, and reports whether the
   environment is air-gap-ready. Mirrors `indiedown::dr_down()`.

8. **Migration story — templates and documents.** Document and tool-assist
   two flows:
   - *Template porting:* mapping table and worked example for converting
     an existing indiedown template package into an indietypst template
     package (LaTeX preamble → Typst preamble, Pandoc YAML → Quarto YAML,
     LaTeX generators → Typst generators).
   - *Document porting:* tooling to convert existing `.Rmd` documents
     authored against an indiedown template into `.qmd` documents
     against the equivalent indietypst template, so users do not have
     to retype historical reports. Initial implementation may be a
     `port_rmd_to_qmd()` helper plus targeted Pandoc options; full
     fidelity is not required, but layout-equivalent output is.

9. **Concrete validation targets.** The framework is validated against
   real templates from day one, not against synthetic skeletons:
   - **`cynkradown`** — port the cynkra house style as the primary
     reference template and the canonical migration case.
   - At least one second template (e.g. a letter or a report variant)
     to keep the framework honest about not over-fitting to one design.

## Non-goals (v1)

- **No LaTeX/PDF-via-LaTeX support.** A clean rewrite is the whole point;
  dual-backend operation is explicitly out of scope.
- **No HTML, EPUB, or Word output in v1** — but the architecture is
  designed not to preclude them. Other Quarto formats are intended as
  follow-up projects (`indiehtml`, …); we keep the customization model
  format-aware (e.g. don't bake "Typst" into the public R API where a
  generic name would do) so adding them later does not require a redesign.
- **No API compatibility with indiedown.** Function names, file paths, and
  concepts will change where Typst/Quarto idiom calls for it.
- **No bundled Typst toolchain.** indietypst depends on Quarto's bundled
  Typst (or system Typst). We do not ship a `tinytex`-style installer for
  Typst in v1; that may be revisited.
- **No R Markdown (`.Rmd`) authoring path as a v1 requirement.** Note this
  is distinct from goal 8: porting existing `.Rmd` documents to `.qmd` is
  in scope; continuing to author *new* documents in `.Rmd` is not.
- **No cynkra-only framework.** `cynkradown` is the first concrete
  template (goal 9), but indietypst itself stays generic — anything
  cynkra-specific lives in the `cynkradown` template package, not in
  indietypst.
- **No web preview, gallery, or SaaS.** Users get preview via `quarto
  preview` / `typst watch`.
- **No general-purpose Typst tooling** beyond what an indietypst template
  needs (no `typst.toml` editor, no Typst-package authoring, etc.).

## Three-layer customization — mapping

| Layer | indiedown | indietypst |
|---|---|---|
| Static format defaults | `inst/indiedown/default.yaml` (Pandoc YAML) | `inst/indietypst/defaults.yaml` (Quarto YAML for `format: typst`) |
| Engine-level styling | `inst/indiedown/preamble.tex` (LaTeX preamble) | `inst/indietypst/preamble.typ` (Typst `#set`/`#show` rules, imports) |
| Dynamic, metadata-aware | `inst/indiedown/pre_processor.R` (mutates Pandoc args) | `inst/indietypst/pre_processor.R` (Quarto pre-render script and/or Lua filter; mutates Quarto metadata / Typst inputs) |
| Asset-path substitution | `<<indiedown_path>>` | `<<indietypst_path>>` |
| Design generators | R functions returning LaTeX | R functions returning Typst markup |
| Fonts | `use_indiedown_gfonts()` | `use_indietypst_gfonts()` (or equivalent), vendored at scaffold time, system fallback at render time |

## Distribution model

A template package generated by `create_indietypst_package("mytypst")`
looks roughly like:

```
mytypst/
  DESCRIPTION
  NAMESPACE
  R/
    mytypst.R                # output format wrapper
    cd_page_title.R          # design generators (Typst)
    cd_*.R                   # other corporate-design helpers
  inst/
    indietypst/
      defaults.yaml
      preamble.typ
      pre_processor.R
      fonts/
      res/
    _extensions/
      mytypst/
        _extension.yml       # Quarto extension manifest
        mytypst.typ          # extension entry; imports preamble.typ
        ...
```

Two routes for use, both starting from the installed R package:

- **R-first**: `install.packages("mytypst")` (or `devtools::install()`),
  then `mytypst::install_indietypst_extension(project = ".")` to wire the
  extension into the user's Quarto project, then `format: mytypst-pdf` in
  the `.qmd`.
- **Quarto-first**: `quarto add cynkra/mytypst` against the
  `_extensions/mytypst/` directory shipped in the package's git
  repository — no R install required at render time (scaffolding still
  needs R).

## Prior art and positioning

A focused survey turned up an active landscape; indietypst is positioned
as the corporate-design scaffolder that none of these projects fully
covers, while leaning on several of them for plumbing.

**Most adjacent — explicit positioning required**

- [`kazuyanagimoto/typstcv`](https://github.com/kazuyanagimoto/typstcv) —
  the closest architectural analogue: an R package whose helpers emit
  Typst markup, paired with a Quarto Typst extension. Different domain
  (CVs) but same shape. *We borrow the architecture; indietypst
  generalizes it to corporate-design templates.*
- [`mcanouil/quarto-mcanouil`](https://github.com/mcanouil/quarto-mcanouil)
  — single-author branded Quarto theming spanning HTML/Typst/Reveal.
  *We position against this as a reusable, scaffolded, multi-tenant
  alternative.*
- [`quarto-ext/typst-templates`](https://github.com/quarto-ext/typst-templates)
  (IEEE, AMS, letter, fiction, poster, dept-news) — reference for
  partials structure and Lua-filter-driven metadata handling. *Read,
  borrow patterns, do not depend on (no contributions accepted).*

**Build on, do not reinvent**

- [`quarto-dev/quarto-r`](https://quarto-dev.github.io/quarto-r) — provides
  `quarto_add_extension()`, `quarto_create_project()`. Goal 3's
  install/check functions wrap these.
- [`y-sunflower/r2typ`](https://github.com/y-sunflower/r2typ) — "htmltools
  for Typst": turns R expressions into Typst markup. Strong candidate as
  the foundation of our design generator layer.
- [`typr`](https://cran.r-project.org/package=typr) — compile Typst from
  R, with fallback to Quarto-bundled Typst. Useful for the diagnostic and
  any pre-render rendering we need outside Quarto.
- [`freierson/typstable`](https://github.com/freierson/typstable) —
  R-driven Typst tables for Quarto. Recommend, do not bundle.
- [Quarto's `typst-gather`](https://quarto.org/docs/advanced/typst/typst-gather.html)
  + Quarto 1.9 auto-staging of `@preview`/`@local` packages — solves
  air-gapped Typst registry vendoring out of the box (goal 6).
- [Quarto Project Scripts](https://quarto.org/docs/projects/scripts.html)
  (`pre-render` hook) — likely surface for `pre_processor.R`.
- Lua filters reading `meta` (canonical pattern in
  [`quarto-ext/typst-templates`](https://github.com/quarto-ext/typst-templates))
  — secondary surface for metadata-driven Typst rewriting.

**Design references (Typst Universe and the wider Quarto Typst ecosystem)**

- CV/letter/report packages on [Typst
  Universe](https://typst.app/universe/): `modern-cv`, `basic-resume`,
  `letter-pro`, `biz-report`, `clean-math-thesis`, `bookly`.
- Branded community Quarto+Typst extensions:
  [`mvuorre/quarto-preprint`](https://github.com/mvuorre/quarto-preprint),
  [`mps9506/quarto-lapreprint`](https://github.com/mps9506/quarto-lapreprint),
  [`wjschne/apaquarto`](https://github.com/wjschne/apaquarto),
  [`kazuyanagimoto/quarto-academic-typst`](https://github.com/kazuyanagimoto/quarto-academic-typst).

**Gap assessment.** No project combines (a) opinionated R-package
scaffolder for corporate-design Quarto+Typst extensions, (b) the
R-functions-emit-Typst pattern beyond CVs/tables, and (c) indiedown's
three-layer customization model. The closest competitor (`quarto-mcanouil`)
is a single-author brand kit, not a scaffolder. The gap is real.

## Open questions

1. **Quarto extension naming/co-existence** — should the R package and
   the Quarto extension share a name, or should the format be namespaced
   (e.g. `mytypst` vs `mytypst-pdf`)?
2. **Typst-package layer** — Typst's own package system (`typst.toml`)
   could carry the design code instead of, or in addition to, an
   in-extension `preamble.typ`. v1 picks the simpler in-extension route;
   revisit once Typst's package registry stabilizes.
3. **`pre_processor.R` execution surface** — Quarto pre-render script
   vs. Lua filter vs. a hybrid. Needs a prototype against `cynkradown`'s
   real metadata-driven needs.
4. **Diagnostic name** — `dr_typst()` is the obvious mirror of
   `dr_down()`; open to better names.
5. **Air-gapped scaffolding** — `use_indietypst_gfonts()` reaches the
   network. Acceptable at scaffold time, but should be skippable for
   fully offline setups (allow user-provided font dir).
6. **Document porting fidelity** — how close to the original LaTeX-rendered
   PDF do we promise the converted `.qmd` to render? Worth scoping
   before promising migration.
7. **Generic vs. Typst-only API names** — non-goal carve-out for HTML
   later means the public R API names should be format-agnostic where
   possible. Concrete naming pass needed before v1 release.
