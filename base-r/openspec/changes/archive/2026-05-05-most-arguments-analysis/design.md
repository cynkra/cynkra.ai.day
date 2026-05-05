## Context

`analyse.R` already parses all R source files with `treesitter.r` and collects function definitions via a `binary_operator` query. The parsed nodes include a `parameters` child whose child count equals the number of formal arguments. The report pipeline writes sections sequentially into a character vector before `writeLines`.

## Goals / Non-Goals

**Goals:**
- Add a parameter-count ranking to the existing single-pass R parsing loop
- Insert a new "Most Arguments" section into `report.md`
- Add one Cool Facts bullet for the top result

**Non-Goals:**
- Counting arguments of anonymous functions or functions defined inside other functions
- Tracking default-value complexity or variadic (`...`) usage separately

## Decisions

**Reuse existing parse loop** — Rather than a second pass over R files, capture parameter counts inside the current `for (path in r_files)` loop where `query_captures` already matches `(binary_operator lhs: (identifier) @name rhs: (function_definition) @fn)`. Extend the result list with an `args` field derived from `node_child_count(params_node)`.

Alternatives considered: separate script (rejected — redundant clone/parse overhead), post-hoc regex on source text (rejected — brittle).

**node_child_count for parameter count** — The `parameters` node's named children correspond to individual parameters. `node_named_child_count` gives the clean count excluding punctuation tokens.

## Risks / Trade-offs

- [Risk] `node_named_child_count` may differ by grammar version → Mitigation: validate against a known function with a fixed arity (e.g., `base::format.Date` with ~10 args) during development.
- [Risk] Very long parameter lists may include `...` counted as one argument → accepted; document in the report section.
