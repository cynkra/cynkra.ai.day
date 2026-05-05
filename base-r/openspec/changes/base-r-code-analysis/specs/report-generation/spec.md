## ADDED Requirements

### Requirement: Single markdown report
The pipeline SHALL write all findings to a single `report.md` file in the project root. The file SHALL be self-contained and render correctly on GitHub.

#### Scenario: Report written
- **WHEN** all analysis facts have been computed
- **THEN** `report.md` is created (or overwritten) with all sections populated

### Requirement: Report structure
`report.md` SHALL contain the following sections in order:

1. **Overview** — total file counts, line counts, and function counts for C and R
2. **Biggest Functions** — tables of top-10 largest C and R functions
3. **The `.Internal` / `.Primitive` Dispatch System** — explanation + full inventory table of R functions that call into C via these mechanisms
4. **C Dispatch Layer: `do_*` functions** — count and sample list of `do_*` functions
5. **`goto` in the Wild** — count of `goto` uses, top-offending files, and a code snippet
6. **Deepest Nesting** — the most deeply nested C function with a snippet
7. **Cool Facts** — a curated bullet list of 5–10 surprising or delightful findings derived from the data

#### Scenario: All sections present
- **WHEN** `report.md` is generated
- **THEN** every section listed above appears as a `##` heading with content beneath it

### Requirement: Tables use markdown syntax
All tabular data in the report SHALL use standard GitHub-flavored markdown tables.

#### Scenario: Table rendered
- **WHEN** a table is written
- **THEN** it uses `|`-delimited columns with a header separator row

### Requirement: Code snippets use fenced blocks
All source code excerpts SHALL appear in fenced code blocks with the appropriate language tag (`c` or `r`).

#### Scenario: Code block written
- **WHEN** a source excerpt is included
- **THEN** it is wrapped in triple-backtick fences with a language identifier
