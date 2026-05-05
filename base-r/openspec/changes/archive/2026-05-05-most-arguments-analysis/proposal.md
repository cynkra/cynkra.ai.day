## Why

The existing `report.md` surfaces many structural curiosities of base R's internals, but does not yet highlight which R functions expose the most arguments — a revealing indicator of API complexity and historical accumulation of parameters.

## What Changes

- Add a tree-sitter query on R function definitions to count `parameters` children per function
- Compute a top-15 ranking of R functions by argument count
- Insert a new **Most Arguments** section into `report.md` with a table and a Cool Facts bullet

## Capabilities

### New Capabilities

- `most-args-analysis`: Query R function definitions for parameter count; rank and report the top functions by number of arguments

### Modified Capabilities

- `report-generation`: Add a "Most Arguments" section and a corresponding Cool Facts bullet to `report.md`

## Impact

- Only `analyse.R` changes (new tree-sitter query + ranking logic + report section)
- No new R package dependencies; uses existing `treesitter`, `treesitter.r`, `dplyr`, `glue`
- Output remains a single `report.md`
