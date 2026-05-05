# analyse.R — Base R source analysis via tree-sitter
# Run from the project root: Rscript analyse.R

needed <- c("treesitter", "treesitter.r", "treesitter.c", "fs", "dplyr", "glue")
missing_pkgs <- needed[!vapply(needed, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing_pkgs) > 0L) {
  message("Installing: ", paste(missing_pkgs, collapse = ", "))
  install.packages(missing_pkgs)
}

suppressPackageStartupMessages({
  library(treesitter)
  library(treesitter.r)
  library(treesitter.c)
  library(fs)
  library(dplyr)
  library(glue)
})

# ── 1. Shallow clone ──────────────────────────────────────────────────────────

if (!dir_exists("r-source")) {
  message("Cloning wch/r-source (depth 1) ...")
  ret <- system2("git", c("clone", "--depth", "1",
                           "https://github.com/wch/r-source", "r-source"))
  if (ret != 0L) stop("git clone failed")
} else {
  message("r-source/ already present, skipping clone.")
}

# ── 2. Helpers ────────────────────────────────────────────────────────────────

c_lang   <- treesitter.c::language()
r_lang   <- treesitter.r::language()
c_parser <- parser(c_lang)
r_parser <- parser(r_lang)

file_text <- function(path) {
  tryCatch(
    paste(readLines(path, warn = FALSE), collapse = "\n"),
    error = function(e) NULL
  )
}

safe_parse <- function(p, path) {
  txt <- file_text(path)
  if (is.null(txt)) return(NULL)
  tree <- tryCatch(parser_parse(p, txt), error = function(e) NULL)
  if (is.null(tree)) {
    message("  skipping (parse error): ", path_rel(path, "r-source"))
    return(NULL)
  }
  list(tree = tree, text = txt, path = as.character(path))
}

node_lines <- function(node) {
  as.integer(point_row(node_end_point(node)) - point_row(node_start_point(node)) + 1L)
}

extract_snippet <- function(text, node, max_lines = 25L) {
  lines <- strsplit(text, "\n", fixed = TRUE)[[1]]
  s <- point_row(node_start_point(node)) + 1L
  e <- min(length(lines), point_row(node_end_point(node)) + 1L)
  if (e - s + 1L > max_lines) e <- s + max_lines - 1L
  paste(lines[s:e], collapse = "\n")
}

# Iterative max compound_statement nesting depth within a node
max_nesting <- function(root_node) {
  stack  <- list(list(node = root_node, pdepth = 0L))
  max_d  <- 0L
  while (length(stack) > 0L) {
    n      <- length(stack)
    frame  <- stack[[n]]
    stack  <- stack[-n]
    my_d   <- if (node_type(frame$node) == "compound_statement")
                frame$pdepth + 1L
              else
                frame$pdepth
    if (my_d > max_d) max_d <- my_d
    for (k in node_named_children(frame$node))
      stack[[length(stack) + 1L]] <- list(node = k, pdepth = my_d)
  }
  max_d
}

md_table <- function(df) {
  header <- paste0("| ", paste(names(df), collapse = " | "), " |")
  sep    <- paste0("| ", paste(rep("---", ncol(df)), collapse = " | "), " |")
  rows   <- apply(df, 1, function(r) paste0("| ", paste(r, collapse = " | "), " |"))
  paste(c(header, sep, rows), collapse = "\n")
}

# ── 3. C analysis ─────────────────────────────────────────────────────────────

message("Walking C files ...")
c_files <- dir_ls("r-source/src", recurse = TRUE,
                  regexp = "\\.(c|h)$", type = "file")
message(sprintf("  %d C/H files", length(c_files)))

q_c_fn   <- query(c_lang, "(function_definition declarator: (function_declarator declarator: (identifier) @name)) @fn")
q_c_call <- query(c_lang, "(call_expression function: (identifier) @name)")
q_c_goto <- query(c_lang, "(goto_statement) @goto")

c_fns        <- list()
c_calls_all  <- character(0)
c_goto_files <- list()

message("Parsing C files ...")
for (path in c_files) {
  parsed <- safe_parse(c_parser, path)
  if (is.null(parsed)) next
  root <- tree_root_node(parsed$tree)

  # Function definitions
  caps     <- query_captures(q_c_fn, root)
  fn_nodes <- caps$node[caps$name == "fn"]
  fn_names <- vapply(caps$node[caps$name == "name"], node_text, character(1L))
  for (i in seq_along(fn_nodes)) {
    c_fns[[length(c_fns) + 1L]] <- list(
      name  = fn_names[[i]],
      path  = parsed$path,
      lines = node_lines(fn_nodes[[i]]),
      node  = fn_nodes[[i]],
      text  = parsed$text
    )
  }

  # Call sites
  call_caps   <- query_captures(q_c_call, root)
  c_calls_all <- c(c_calls_all,
                   vapply(call_caps$node, node_text, character(1L)))

  # goto statements
  goto_caps <- query_captures(q_c_goto, root)
  n_goto    <- length(goto_caps$node)
  if (n_goto > 0L) {
    c_goto_files[[length(c_goto_files) + 1L]] <- list(
      path  = parsed$path,
      count = n_goto,
      node  = goto_caps$node[[1L]],
      text  = parsed$text
    )
  }
}

message(sprintf("  %d C functions found", length(c_fns)))

# Derived tables
c_fns_df <- tibble(
  name  = vapply(c_fns, `[[`, character(1L), "name"),
  path  = vapply(c_fns, `[[`, character(1L), "path"),
  lines = vapply(c_fns, `[[`, integer(1L),   "lines")
) |> mutate(file = path_rel(path, "r-source"))

# Task 3.3 — top-10 largest C functions
top10_c_fns <- slice_max(c_fns_df, lines, n = 10L, with_ties = FALSE) |>
  select(Function = name, File = file, Lines = lines)

# Task 3.4 — top-10 largest C files
top10_c_files <- tibble(path = c_files) |>
  mutate(
    lines = vapply(path, function(p) {
      txt <- file_text(p)
      if (is.null(txt)) 0L
      else length(strsplit(txt, "\n", fixed = TRUE)[[1L]])
    }, integer(1L)),
    File = path_rel(path, "r-source")
  ) |>
  slice_max(lines, n = 10L, with_ties = FALSE) |>
  select(File, Lines = lines)

# Task 3.5 — goto
total_gotos <- sum(vapply(c_goto_files, `[[`, integer(1L), "count"))
top_goto <- tibble(
  File  = path_rel(vapply(c_goto_files, `[[`, character(1L), "path"), "r-source"),
  Gotos = vapply(c_goto_files, `[[`, integer(1L), "count")
) |> arrange(desc(Gotos)) |> head(10L)

best_goto_idx  <- which.max(vapply(c_goto_files, `[[`, integer(1L), "count"))
goto_snip_info <- c_goto_files[[best_goto_idx]]
goto_snip      <- extract_snippet(goto_snip_info$text, goto_snip_info$node)

# Task 3.6 — do_* functions
do_fns <- filter(c_fns_df, grepl("^do_", name)) |> arrange(name)

# Task 3.7 — deepest nesting
message("Computing nesting depths ...")
deepest <- list(depth = 0L, name = "", path = "", node = NULL, text = "")
for (fd in c_fns) {
  d <- tryCatch(max_nesting(fd$node), error = function(e) 0L)
  if (d > deepest$depth)
    deepest <- list(depth = d, name = fd$name, path = fd$path,
                    node = fd$node, text = fd$text)
}
deep_snip <- extract_snippet(deepest$text, deepest$node, max_lines = 30L)

# Task 3.8 — most-called C functions
top10_c_calls <- sort(table(c_calls_all), decreasing = TRUE) |>
  head(10L) |>
  as.data.frame(stringsAsFactors = FALSE) |>
  setNames(c("Function", "Call Sites")) |>
  mutate(`Call Sites` = as.integer(`Call Sites`))

# ── 4. R analysis ─────────────────────────────────────────────────────────────

message("Walking R files ...")
r_files <- dir_ls("r-source", recurse = TRUE, regexp = "\\.R$", type = "file")
message(sprintf("  %d R files", length(r_files)))

q_r_fn        <- query(r_lang, "(binary_operator lhs: (identifier) @name rhs: (function_definition) @fn)")
q_r_call      <- query(r_lang, "(call function: (identifier) @name)")
q_r_internal  <- query(r_lang, '(call function: (identifier) @fn (#eq? @fn ".Internal")) @call')
q_r_primitive <- query(r_lang, '(call function: (identifier) @fn (#eq? @fn ".Primitive")) @call')

r_fns        <- list()
r_calls_all  <- character(0)
r_internals  <- character(0)
r_primitives <- character(0)

message("Parsing R files ...")
for (path in r_files) {
  parsed <- safe_parse(r_parser, path)
  if (is.null(parsed)) next
  root <- tree_root_node(parsed$tree)

  # Task 4.2 — named function definitions
  caps     <- query_captures(q_r_fn, root)
  fn_nodes <- caps$node[caps$name == "fn"]
  fn_names <- vapply(caps$node[caps$name == "name"], node_text, character(1L))
  for (i in seq_along(fn_nodes)) {
    r_fns[[length(r_fns) + 1L]] <- list(
      name  = fn_names[[i]],
      path  = parsed$path,
      lines = node_lines(fn_nodes[[i]])
    )
  }

  # Task 4.5 — call frequency
  call_caps   <- query_captures(q_r_call, root)
  r_calls_all <- c(r_calls_all,
                   vapply(call_caps$node, node_text, character(1L)))

  # Task 4.4 — .Internal calls (extract inner function name via regex)
  int_caps <- query_captures(q_r_internal, root)
  for (cn in int_caps$node[int_caps$name == "call"]) {
    txt <- node_text(cn)
    m <- regmatches(txt, regexpr("\\.Internal\\(([[:alnum:]._]+)", txt))
    if (length(m) > 0L)
      r_internals <- c(r_internals, sub("\\.Internal\\(", "", m))
  }

  # Task 4.4 — .Primitive calls (argument is a quoted string)
  prim_caps <- query_captures(q_r_primitive, root)
  for (cn in prim_caps$node[prim_caps$name == "call"]) {
    txt <- node_text(cn)
    m <- regmatches(txt, regexpr('"([^"]+)"', txt))
    if (length(m) > 0L)
      r_primitives <- c(r_primitives, gsub('"', '', m))
  }
}

message(sprintf("  %d R functions found", length(r_fns)))

r_fns_df <- tibble(
  name  = vapply(r_fns, `[[`, character(1L), "name"),
  path  = vapply(r_fns, `[[`, character(1L), "path"),
  lines = vapply(r_fns, `[[`, integer(1L),   "lines")
) |> mutate(file = path_rel(path, "r-source"))

# Task 4.3 — top-10 largest R functions
top10_r_fns <- slice_max(r_fns_df, lines, n = 10L, with_ties = FALSE) |>
  select(Function = name, File = file, Lines = lines)

# Task 4.5 — most-called R functions
top10_r_calls <- sort(table(r_calls_all), decreasing = TRUE) |>
  head(10L) |>
  as.data.frame(stringsAsFactors = FALSE) |>
  setNames(c("Function", "Call Sites")) |>
  mutate(`Call Sites` = as.integer(`Call Sites`))

# Task 4.4 — dispatch table
dispatch_df <- bind_rows(
  tibble(Name = unique(r_internals), Type = ".Internal"),
  tibble(Name = unique(r_primitives), Type = ".Primitive")
) |> arrange(Type, Name)

# ── 5. Overview numbers ───────────────────────────────────────────────────────

n_c_files   <- length(c_files)
n_r_files   <- length(r_files)
n_c_fns     <- nrow(c_fns_df)
n_r_fns     <- nrow(r_fns_df)
n_internals <- length(unique(r_internals))
n_primitives <- length(unique(r_primitives))
n_do_fns    <- nrow(do_fns)

# ── 6. Write report.md ────────────────────────────────────────────────────────

message("Writing report.md ...")

report <- c(
  "# Base R Source Code: Cool Facts",
  "",
  "> Generated by `analyse.R` from a depth-1 clone of [wch/r-source](https://github.com/wch/r-source).",
  "",

  ## Overview
  "## Overview",
  "",
  md_table(tibble(
    Metric = c(
      "C/H source files", "R source files",
      "C functions defined", "R functions defined",
      "`.Internal` dispatch entries", "`.Primitive` dispatch entries",
      "`do_*` C dispatch functions", "Total `goto` statements"
    ),
    Count = c(
      n_c_files, n_r_files,
      n_c_fns, n_r_fns,
      n_internals, n_primitives,
      n_do_fns, total_gotos
    )
  )),
  "",

  ## Biggest functions
  "## Biggest Functions",
  "",
  "### Top 10 Largest C Functions",
  "",
  md_table(top10_c_fns),
  "",
  "### Top 10 Largest R Functions",
  "",
  md_table(top10_r_fns),
  "",
  "### Top 10 Largest C Files",
  "",
  md_table(top10_c_files),
  "",

  ## Most-used functions
  "## Most-Used Functions",
  "",
  "### Top 10 Most-Called C Functions",
  "",
  md_table(top10_c_calls),
  "",
  "### Top 10 Most-Called R Functions",
  "",
  md_table(top10_r_calls),
  "",

  ## .Internal / .Primitive
  "## The `.Internal` / `.Primitive` Dispatch System",
  "",
  paste0(
    "When you call a base R function like `nchar()` or `sum()`, R often dispatches ",
    "immediately into C. Two mechanisms handle this:\n\n",
    "- **`.Internal(fn(...))`** — routes to a registered C function via an internal table. ",
    "Most base R functions use this path.\n",
    "- **`.Primitive(\"name\")`** — wires a symbol directly to a C primitive at startup, ",
    "bypassing normal dispatch overhead. Used for operators (`+`, `[`, etc.) and the ",
    "hottest built-ins."
  ),
  "",
  glue("In total, **{n_internals} `.Internal`** and **{n_primitives} `.Primitive`** entries were found."),
  "",
  md_table(dispatch_df),
  "",

  ## do_* functions
  "## C Dispatch Layer: `do_*` Functions",
  "",
  glue(
    "By convention, every `.Internal` call routes to a C function whose name starts with `do_`. ",
    "There are **{n_do_fns}** such functions. A sample (first 20 alphabetically):"
  ),
  "",
  md_table(
    do_fns |> head(20L) |>
      select(Function = name, File = file, Lines = lines)
  ),
  "",

  ## goto
  "## `goto` in the Wild",
  "",
  glue(
    "Despite being considered harmful since 1968, base R's C source contains ",
    "**{total_gotos} `goto` statements**. Top offending files:"
  ),
  "",
  md_table(top_goto),
  "",
  glue("A `goto` from `{path_rel(goto_snip_info$path, 'r-source')}`:\n"),
  "```c",
  goto_snip,
  "```",
  "",

  ## Deepest nesting
  "## Deepest Nesting",
  "",
  glue(
    "The most deeply nested C function is **`{deepest$name}`** ",
    "in `{path_rel(deepest$path, 'r-source')}` ",
    "with a `{{}}` nesting depth of **{deepest$depth}**."
  ),
  "",
  "```c",
  deep_snip,
  "```",
  "",

  ## Cool facts
  "## Cool Facts",
  "",
  glue("- R's C implementation defines **{n_c_fns} functions** across {n_c_files} files — far more than most users imagine."),
  glue("- The biggest single C function, `{top10_c_fns$Function[1]}`, spans **{top10_c_fns$Lines[1]} lines** of C."),
  glue("- The biggest single R function, `{top10_r_fns$Function[1]}`, spans **{top10_r_fns$Lines[1]} lines** of R."),
  glue("- The most-called C function is `{top10_c_calls$Function[1]}` ({top10_c_calls[['Call Sites']][1]} call sites)."),
  glue("- The most-called R function is `{top10_r_calls$Function[1]}` ({top10_r_calls[['Call Sites']][1]} call sites)."),
  glue("- **{total_gotos} `goto` statements** survive in the C source — a relic of pre-ANSI C style."),
  glue("- **{n_do_fns}** C functions follow the `do_*` naming convention, one per `.Internal` entry."),
  glue("- There are **{n_r_fns} named R functions** defined in the base R library source files."),
  glue("- The dispatch bridge has **{n_internals + n_primitives} entries** connecting R names to C implementations."),
  ""
)

writeLines(report, "report.md")
message("Done — report.md written.")
