## Context

The project directory is currently empty (no source files). This change builds a self-contained batch pipeline that clones the R source, parses it with tree-sitter, and writes one `report.md`. There are no existing services or data models to preserve.

The target repository (`wch/r-source`) is a GitHub mirror of the official R SVN repository. It is large (~200 MB shallow), so a depth-1 clone is mandatory to keep the pipeline fast.

## Goals / Non-Goals

**Goals:**
- Shallow-clone `wch/r-source` (one commit, no history)
- Parse C (`.c`, `.h`) and R (`.R`) files with tree-sitter
- Produce a single `report.md` with curated, surprising facts

**Non-Goals:**
- Full git history analysis
- Interactive querying or LLM integration
- Ongoing CI or scheduled refreshes
- Parsing Fortran, Java, or other languages in the repo

## Decisions

### Language: R for the pipeline

**Decision**: Write the analysis script in R.

**Why**: The `treesitter.r` and `treesitter.c` CRAN packages provide first-class tree-sitter bindings directly in R. R is also well-suited for file-walking (`fs`), data wrangling (`dplyr`), and markdown generation. No cross-language bridge needed.

**Alternatives considered**: Python (good tree-sitter support but an extra runtime dependency); pure shell + ctags (no structured AST access).

---

### Tree-sitter grammars: C and R

**Decision**: Use `treesitter.c` for `.c`/`.h` files and `treesitter.r` for `.R` files.

**Why**: These are the two dominant languages in the r-source tree. Fortran and Java stubs exist but are peripheral; parsing them adds complexity with minimal analytical payoff.

---

### Facts to surface

**Decision**: Focus on structural metrics and quirks that are surprising to an R user:

- Total function count in C vs R, with top-10 largest functions by line count
- Most-referenced C symbols across files (call graph proxy)
- Complete inventory of `.Internal()` and `.Primitive()` calls from R source, showing which R functions dispatch to C
- Longest C files and longest R files
- Naming convention patterns (ALLCAPS macros, `do_*` C dispatch functions, `R_*` globals)
- Fun/unusual finds: oldest-looking comments, deepest nesting, files with most `goto` statements

**Why**: These facts are both technically grounded (all derived from AST queries) and genuinely surprising to most R users.

---

### Output: single `report.md`

**Decision**: All findings go into one self-contained markdown file with section headers, tables, and fenced code blocks.

**Why**: Easy to share, render on GitHub, and read without tooling. No database, no JSON intermediates exposed to the user.

## Risks / Trade-offs

- [Tree-sitter grammar version drift] → Pin exact package versions via `renv` or document in `DESCRIPTION`
- [Shallow clone may still be slow on CI/low-bandwidth] → Document expected clone size (~200 MB); the pipeline is a one-shot local script, not CI
- [R grammar coverage gaps] → Some exotic R syntax may not parse cleanly; log unparsed files and continue
- [Report becomes stale] → The script is idempotent and can be re-run; no mitigation needed for a demo artifact

