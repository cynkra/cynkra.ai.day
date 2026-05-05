# indietypst — Design Document

Status: Draft (2026-05-05)
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
   `create_indietypst_package("mydown")` produces a self-contained R package
   that wraps a Quarto extension and renders `.qmd` documents to PDF using
   the Typst backend.

2. **Mirror indiedown's three-layer customization model**, adapted to the new
   stack:
   - `defaults.yaml` — Quarto YAML defaults for `format: typst`.
   - `preamble.typ` — Typst snippet (`#set` / `#show` rules, imports,
     design constants) injected at the top of every rendered document.
   - `pre_processor.R` — R hook that runs before render to mutate metadata
     or generate Typst inputs from document state (e.g. twocolumn → tighter
     margins).

3. **Quarto-native distribution, R-package-native UX.** Templates ship as a
   Quarto extension (`_extensions/<name>/`), so Quarto users can `quarto add`
   them and get the format they expect. The *primary* user-facing handle is
   still an R package: `create_indietypst_package()`, font helpers, and a
   diagnostic. Installing the R package places the bundled Quarto extension
   where Quarto can find it.

4. **Keep R as the design-generator language.** R functions returning Typst
   markup are the supported way to express dynamic title pages, headers, and
   signature blocks (analogue of indiedown's `cd_page_title()`).

5. **Air-gapped builds.** Once the template R package is installed, rendering
   must not require network access. Fonts, logos, and any other assets are
   vendored inside the package; font helpers download at *scaffold* time, not
   render time.

6. **Toolchain diagnostic.** Provide a `dr_typst()` (or equivalent) command
   that reports versions of R, Quarto, Typst, and indietypst, and runs a
   sample render, mirroring `indiedown::dr_down()`.

7. **Migration story.** Document the conceptual mapping from indiedown to
   indietypst (LaTeX preamble → Typst preamble, Pandoc YAML → Quarto YAML,
   LaTeX generators → Typst generators) so existing indiedown users can port
   a template without guesswork.

## Non-goals

- **No LaTeX/PDF-via-LaTeX support.** A clean rewrite is the whole point;
  dual-backend operation is explicitly out of scope.
- **No HTML, EPUB, or Word output.** PDF only. Other Quarto formats remain
  available to users via Quarto itself, but indietypst does not customize
  them.
- **No API compatibility with indiedown.** Function names, file paths, and
  concepts will change where Typst/Quarto idiom calls for it.
- **No bundled Typst toolchain.** indietypst depends on Quarto's bundled
  Typst (or system Typst). We do not ship a `tinytex`-style installer for
  Typst in v1; that may be revisited.
- **No R Markdown (`.Rmd`) authoring as a v1 requirement.** A compatibility
  shim that lets users author in `.Rmd` is *considered* (Pandoc → Typst is
  technically possible) but is a stretch goal, not a hard requirement.
- **No cynkra-specific corporate design.** indietypst is the framework; the
  cynkra house style is a downstream template package.
- **No web preview, gallery, or SaaS.** Users get preview via `quarto
  preview` / `typst watch`.
- **No general-purpose Typst tooling** (no aim to wrap `typst.toml` editing,
  package authoring, etc. beyond what an indietypst template needs).

## Three-layer customization — mapping

| Layer | indiedown | indietypst |
|---|---|---|
| Static format defaults | `inst/indiedown/default.yaml` (Pandoc YAML) | `inst/indietypst/defaults.yaml` (Quarto YAML for `format: typst`) |
| Engine-level styling | `inst/indiedown/preamble.tex` (LaTeX preamble) | `inst/indietypst/preamble.typ` (Typst `#set`/`#show` rules, imports) |
| Dynamic, metadata-aware | `inst/indiedown/pre_processor.R` (mutates Pandoc args) | `inst/indietypst/pre_processor.R` (mutates Quarto metadata / Typst inputs) |
| Asset-path substitution | `<<indiedown_path>>` | `<<indietypst_path>>` |
| Design generators | R functions returning LaTeX | R functions returning Typst markup |
| Fonts | `use_indiedown_gfonts()` | `use_indietypst_gfonts()` (or equivalent), vendored at scaffold time |

## Distribution model

A template package generated by `create_indietypst_package("mydown")` looks
roughly like:

```
mydown/
  DESCRIPTION
  NAMESPACE
  R/
    mydown.R                 # output format wrapper
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
      mydown/
        _extension.yml       # Quarto extension manifest
        mydown.typ           # extension entry; imports preamble.typ
        ...
```

Two routes for use:

- **R-first**: `install.packages("mydown")` (or `devtools::install()`),
  then in a `.qmd` set `format: mydown-pdf` (or call an R wrapper).
- **Quarto-first**: `quarto add mydown` against the `_extensions/mydown/`
  directory shipped in the package, no R install required at render time
  (though scaffolding still needs R).

## Open questions

1. **R Markdown compatibility shim** — feasible via Pandoc's Typst writer,
   but worth the v1 cost? Default answer: stretch goal, document only.
2. **Quarto extension naming/co-existence** — should the R package and the
   Quarto extension share a name, or should the format be namespaced (e.g.
   `mydown` vs `mydown-pdf`)?
3. **Typst-package layer** — Typst's own package system (`typst.toml`) could
   carry the design code instead of, or in addition to, an in-extension
   `preamble.typ`. v1 picks the simpler in-extension route; revisit once
   Typst's package registry stabilizes.
4. **`pre_processor.R` execution surface** — Quarto pre-render scripts vs.
   knitr hooks vs. a custom Lua filter. Needs a prototype.
5. **Diagnostic name** — `dr_typst()` is the obvious mirror of `dr_down()`;
   open to better names.
6. **Air-gapped scaffolding** — `use_indietypst_gfonts()` reaches the
   network. Acceptable at scaffold time, but should be skippable for fully
   offline setups (allow user-provided font dir).
