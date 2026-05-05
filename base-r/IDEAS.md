# Future Ideas

## GitHub usage data for exported R functions

For each exported R function (those with no `.` prefix in `r_fns_df`), make a
GitHub Code Search API call to count how many files across GitHub reference it.
This gives a rough popularity ranking grounded in real-world usage rather than
call sites within r-source itself.

```r
# sketch
gh_code_count <- function(fn_name) {
  url <- paste0("https://api.github.com/search/code?q=", fn_name, "+language:R")
  resp <- httr2::request(url) |>
    httr2::req_headers(Authorization = paste("Bearer", Sys.getenv("GITHUB_PAT"))) |>
    httr2::req_perform()
  httr2::resp_body_json(resp)$total_count
}
```

Rate limit is 10 requests/minute for authenticated users, so batch carefully
or use the `X-RateLimit-*` headers to pace requests.

## Cyclomatic complexity for C functions

tree-sitter already parses `if`, `for`, `while`, `switch`, `&&`, `||` nodes —
count decision points per function to produce a McCabe complexity score.
Helps identify functions that are genuinely hard to reason about vs. just long.

## Call graph visualisation

From the C call-site data we already collect, build a directed graph
(e.g. with `igraph`) and render it for a subsystem like `src/main/eval.c`.
Highlight `do_*` entry points as roots.

## Diff analysis across R versions

Do two shallow clones at different tags (e.g. `R-4-3-0` and `R-4-4-0`) and
diff the parsed function tables to find functions added, removed, or grown
significantly between releases.

## Cross-reference with CRAN download counts

Match exported R function names against the `cranlogs` API to see which base R
functions are most depended on by CRAN packages — a different signal from GitHub
search, more structured.

## Dead-code confirmation via `nm` / `objdump`

Complement the tree-sitter unused-function list with symbol table analysis:
build R from source and run `nm --defined-only` on the shared library to see
which C symbols actually make it into the final binary.

## Documentation coverage

Check which R functions in `r_fns_df` have a matching `.Rd` file in
`r-source/src/library/*/man/`. Functions without docs are either internal or
underdocumented public API.

## Function introduction dates from NEWS

Parse `r-source/doc/NEWS` (and the versioned `NEWS.0`, `NEWS.1`, `NEWS.2` files)
to find the first mention of each function name. R's NEWS entries follow a
regular pattern (`\item \code{foo()}`) that is easy to match with a regex or a
dedicated tree-sitter grammar for the NEWS format. Cross-referencing with
`r_fns_df` gives an approximate "added in R x.y.z" date for every base R
function.

## Longest-lived comments

Pair the year-stamped comment list with `git log --follow -S` (on the full
history, not a shallow clone) to find comments that have survived unchanged
since their original year — true fossils in the codebase.
