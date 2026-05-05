# indietypst — Glossary

Terms used across indietypst design docs, specs, and code. Alphabetical.

## Air-gapped build
A render-time scenario in which no network access is available. indietypst
must support this: all fonts and assets are vendored inside the template
package at scaffold time, and `quarto render` is the only network-touching
step we *cannot* control (Quarto itself may fetch extensions). See
[design.md](./design.md) goal 5.

## Backend
The engine that converts the intermediate document into PDF. indiedown's
backend is **LaTeX** (via Pandoc + a TeX distribution). indietypst's backend
is **Typst**.

## Corporate design (CD)
The set of fonts, logos, colors, geometry, title-page layout, and other
visual conventions that define an organization's identity. An indietypst
*template package* encodes one corporate design.

## Design generator
An R function that returns Typst markup, called from a `.qmd` document or
from `pre_processor.R` to construct dynamic content (title pages, headers,
signature blocks). Direct analogue of indiedown's LaTeX-emitting helpers
such as `cd_page_title()`.

## `defaults.yaml`
First customization layer. YAML defaults injected into a document's Quarto
metadata (e.g. `papersize`, `fontsize`, `mainfont`, margin equivalents).
Located at `inst/indietypst/defaults.yaml` in a template package. Direct
analogue of indiedown's `default.yaml`.

## `dr_typst()`
Toolchain diagnostic. Reports versions of R, Quarto, Typst, and indietypst,
and runs a sample render to confirm the environment works. Analogue of
`indiedown::dr_down()`.

## indiedown
The original cynkra package this project reimagines. Scaffolds R packages
that act as customized R Markdown PDF templates, built via Pandoc and
LaTeX. See [`upstream/indiedown/`](../upstream/indiedown/) for the
reference implementation.

## indietypst
This project. A clean-rewrite reimagining of indiedown that targets
**Quarto** as the authoring system and **Typst** as the backend. Not API-
compatible with indiedown.

## `<<indietypst_path>>`
Variable substituted (at render or scaffold time) into `defaults.yaml` and
`preamble.typ` so users can reference assets relative to the installed
extension, e.g. `<<indietypst_path>>/fonts/regular.ttf`. Analogue of
indiedown's `<<indiedown_path>>`.

## knitr
The R-chunk execution engine. Quarto can use either knitr or Jupyter to
execute code chunks; indietypst documents typically use knitr because R
users author in `.qmd` with R chunks.

## `preamble.typ`
Second customization layer. A Typst snippet (`#set` rules, `#show` rules,
`#import` statements, design constants) loaded at the top of every rendered
document. Located at `inst/indietypst/preamble.typ`. Analogue of
indiedown's `preamble.tex`.

## `pre_processor.R`
Third customization layer. An R hook executed before render to mutate Quarto
metadata or build inputs based on document state — for example, picking
different margins when `twocolumn: true` is set. Located at
`inst/indietypst/pre_processor.R`. Direct analogue of indiedown's hook of
the same name.

## Quarto
Open-source scientific publishing system, successor to R Markdown.
Supports multiple output formats including PDF via LaTeX *or* Typst.
indietypst targets `format: typst` exclusively.

## Quarto extension
A directory under `_extensions/<name>/` providing custom formats, filters,
or shortcodes. indietypst templates ship as Quarto extensions so they can
be consumed by any Quarto user (`quarto add ...`). The R package wrapping
the extension is the primary user-facing surface, but the extension is the
runtime artifact.

## Quarto format
A named output configuration invoked via `format: <name>` in a `.qmd`
document's YAML header. An indietypst template typically registers one
format such as `mydown-pdf` that wires up `defaults.yaml`, `preamble.typ`,
and the Typst backend.

## Set rule / show rule
Typst language constructs (`#set heading(...)`, `#show: doc => ...`) used
for global styling. They replace most of what `preamble.tex` did in
indiedown, but live in `preamble.typ` rather than as an opaque preamble
string.

## Skeleton
The starter `.qmd` document and example assets included in a generated
template package, intended to demonstrate every customization point and
serve as a starting `.qmd` for the user. Analogue of indiedown's
`skeleton.Rmd`.

## Template package
The R package produced by `create_indietypst_package("mydown")`. Wraps a
Quarto extension under `inst/_extensions/<name>/`, design assets under
`inst/indietypst/`, and R-side helpers (output format wrappers, design
generators, font helpers).

## Typst
A modern open-source typesetting system. Single binary, fast incremental
builds, programmable markup. The PDF backend used by indietypst.

## Typst package
A reusable Typst module distributable via Typst's own package system
(`typst.toml`). indietypst v1 keeps design code inside the Quarto extension
rather than as a separate Typst package; this may be revisited.
