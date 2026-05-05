## 1. Project Setup

- [x] 1.1 Create `analyse.R` as the main entry-point script
- [x] 1.2 Create a `DESCRIPTION` file listing R package dependencies (`treesitter`, `treesitter.r`, `treesitter.c`, `fs`, `dplyr`, `glue`) in the `Imports:` field

## 2. Source Clone

- [x] 2.1 Implement shallow clone step in `analyse.R`: skip if `r-source/` exists, otherwise run `git clone --depth 1`

## 3. C Source Analysis

- [x] 3.1 Walk all `.c` and `.h` files under `r-source/src/` using `fs::dir_ls()`
- [x] 3.2 Parse each file with `treesitter.c`; collect function definitions (name, file, start line, end line); log and skip unparseable files
- [x] 3.3 Compute top-10 largest C functions by line count
- [x] 3.4 Compute top-10 largest C files by total lines
- [x] 3.5 Count `goto` statements across all C files and identify the top-offending files; extract one representative snippet
- [x] 3.6 Count functions named `do_*` and collect a sample list
- [x] 3.7 Compute maximum nesting depth per function and identify the deepest one; extract a code snippet
- [x] 3.8 Count call-site occurrences of each function name across all C files; produce a top-10 most-called table

## 4. R Source Analysis

- [x] 4.1 Walk all `.R` files under `r-source/` using `fs::dir_ls(recurse = TRUE)`
- [x] 4.2 Parse each file with `treesitter.r`; collect function definitions and all `.Internal()` / `.Primitive()` call sites; log and skip unparseable files
- [x] 4.3 Compute top-10 largest R functions by line count
- [x] 4.4 Build a complete inventory table of `.Internal` and `.Primitive` calls (R name → C entry point)
- [x] 4.5 Count call-site occurrences of each function name across all R files; produce a top-10 most-called table

## 5. Report Generation

- [x] 5.1 Create a `render_report()` function (or inline code) that assembles all facts into `report.md`
- [x] 5.2 Write the **Overview** section (file, line, and function counts for C and R)
- [x] 5.3 Write the **Biggest Functions** section with two markdown tables (C and R top-10)
- [x] 5.4 Write the **`.Internal` / `.Primitive` Dispatch System** section with explanation and full inventory table
- [x] 5.5 Write the **C Dispatch Layer: `do_*` functions** section
- [x] 5.6 Write the **`goto` in the Wild** section with counts, top files table, and fenced C snippet
- [x] 5.7 Write the **Deepest Nesting** section with the function name and a fenced C snippet
- [x] 5.8 Write the **Cool Facts** section: a curated bullet list of 5–10 surprising findings derived from the data
- [x] 5.9 Verify `report.md` renders correctly (check headings, tables, fenced blocks)
