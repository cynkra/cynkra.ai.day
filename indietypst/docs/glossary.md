# indietypst — Glossary

Terms used across indietypst design docs, specs, and code. Alphabetical.

## Air-gapped build
A render-time scenario in which no network access is available. indietypst
must support this end-to-end: after a one-time scaffold + bootstrap on a
networked machine, subsequent renders touch only the local filesystem.
Three things have to be made offline-safe:

1. **Template assets** (fonts, logos, images) — vendored inside the
   template package.
2. **Typst registry packages** (`@preview/...`, `@local/...`) — staged
   into the project's `.quarto/` cache via [`quarto call
   typst-gather`](https://quarto.org/docs/advanced/typst/typst-gather.html)
   during scaffolding. Quarto 1.9+ also auto-stages packages on first
   render.
3. **Quarto's own caches** — primed during scaffolding (`bootstrap`
   helper) so Quarto does not reach out for extension updates,
   syntax-highlighting themes, or remote includes at render time.

`quarto render` itself does not phone home if all referenced resources
resolve locally; the work is in making sure they do. See
[design.md](./design.md) goal 6.

## Backend
The engine that converts the intermediate document into PDF. indiedown's
backend is **LaTeX** (via Pandoc + a TeX distribution). indietypst's backend
is **Typst**.

## Corporate design (CD)
The set of fonts, logos, colors, geometry, title-page layout, and other
visual conventions that define an organization's identity. An indietypst
*template package* encodes one corporate design.

## cynkradown
The cynkra house-style template, ported from indiedown to indietypst as the
project's primary validation target. It exists as its own template
package; nothing cynkra-specific lives in indietypst itself.

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

## Font fallback
indietypst templates declare a font stack: a proprietary brand font first,
then a freely licensable equivalent shipped with the package. Renders
silently use the brand font when present on the build machine and the
bundled font otherwise, so the same `.qmd` produces a brand-correct PDF
on a configured workstation and a still-acceptable PDF on a vanilla CI
runner.

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

## `install_indietypst_extension()` / `check_indietypst_extension()`
R helpers that copy (or symlink) the bundled Quarto extension into a
user's Quarto project and verify that Quarto can resolve it from there.
They wrap [`quarto::quarto_add_extension()`](https://quarto-dev.github.io/quarto-r/reference/quarto_add_extension.html).
The split is necessary because R library paths and Quarto's extension
search paths are unrelated.

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
runtime artifact. Because R library paths and Quarto's extension search
paths are unrelated, indietypst exposes
`install_indietypst_extension(project)` and `check_indietypst_extension(project)`
to bridge the two — building on
[`quarto::quarto_add_extension()`](https://quarto-dev.github.io/quarto-r/reference/quarto_add_extension.html)
rather than reinventing it.

## Quarto format
A named output configuration invoked via `format: <name>` in a `.qmd`
document's YAML header. An indietypst template typically registers one
format such as `mytypst-pdf` that wires up `defaults.yaml`, `preamble.typ`,
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
The R package produced by `create_indietypst_package("mytypst")`. Wraps a
Quarto extension under `inst/_extensions/<name>/`, design assets under
`inst/indietypst/`, and R-side helpers (output format wrappers, design
generators, font helpers).

## Typst
A modern open-source typesetting system. Single binary, fast incremental
builds, programmable markup. The PDF backend used by indietypst.

## `typst-gather`
[Quarto subcommand](https://quarto.org/docs/advanced/typst/typst-gather.html)
(`quarto call typst-gather`) that resolves and stages Typst registry
packages into a project's `.quarto/` cache. indietypst runs this during
scaffolding to make subsequent renders air-gap-safe.

## Typst package
A reusable Typst module distributable via Typst's own package system
(`typst.toml`). indietypst v1 keeps design code inside the Quarto extension
rather than as a separate Typst package; this may be revisited.
