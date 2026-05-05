## Why

The R language source code at https://github.com/wch/r-source is a large, historically rich C/R codebase that is opaque to most R users and contributors. This change produces a single, shareable markdown document packed with surprising and illuminating facts about base R's internals — surfaced automatically via tree-sitter parsing of the source.

## What Changes

- Shallow-clone (depth 1) `wch/r-source` to get the current source snapshot without full history
- Parse C and R sou
rce files with tree-sitter to extract structural facts (function counts, longest functions, most-called internals, naming patterns, etc.)
- Render all findings into one self-contained `report.md` with the most interesting and coolest facts about the R source code

## Capabilities

### New Capabilities

- `source-clone`: Shallow-clone (depth=1) `wch/r-source` and confirm the tree is ready for analysis
- `tree-sitter-analysis`: Use tree-sitter to parse C and R files; extract facts such as top functions by line count, most-referenced symbols, `.Internal`/`.Primitive` call inventory, and structural curiosities
- `report-generation`: Compile findings into a single `report.md` with prose, tables, and code snippets highlighting the coolest discoveries

### Modified Capabilities

## Impact

- Requires `git` (shallow clone) and tree-sitter tooling (e.g. `tree-sitter` CLI or a Python/Node binding)
- No runtime services; entirely a local batch pipeline
- Output is one markdown file (`report.md`)
