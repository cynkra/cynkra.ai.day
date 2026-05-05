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
  message("Cloning wch/r-source (full clone, this may take a while) ...")
  ret <- system2("git", c("clone", "https://github.com/wch/r-source", "r-source"))
  if (ret != 0L) stop("git clone failed")
} else {
  message("r-source/ already present, skipping clone.")
  is_shallow <- tryCatch(
    system2("git", c("-C", "r-source", "rev-parse", "--is-shallow-repository"),
            stdout = TRUE, stderr = FALSE) == "true",
    error = function(e) FALSE
  )
  if (isTRUE(is_shallow)) {
    message("Shallow clone detected, unshallowing ...")
    system2("git", c("-C", "r-source", "fetch", "--unshallow"))
  }
}

message("Running git-recon audit ...")
if (!file_exists("git-recon.sh")) {
  download.file(
    "https://gist.githubusercontent.com/gadenbuie/463ff1e9f3b0f48cddc44db2224d286b/raw",
    "git-recon.sh", quiet = TRUE, mode = "wb"
  )
  Sys.chmod("git-recon.sh", "0755")
}
recon_script <- readLines("git-recon.sh")
recon_script <- recon_script[!grepl("read -r _", recon_script)]
writeLines(recon_script, "git-recon-nointeract.sh")

recon_raw <- system2(
  "bash",
  args   = c("git-recon-nointeract.sh", "r-source"),
  stdout = TRUE,
  stderr = FALSE,
  env    = c(paste0("HOME=", Sys.getenv("HOME")), "TERM=dumb")
)
recon_out <- gsub("\x1b\\[[0-9;]*[mKHJ]", "", recon_raw)

sha <- system2("git", c("-C", "r-source", "rev-parse", "HEAD"),
               stdout = TRUE, stderr = FALSE)
gh_link <- function(file, line = NULL) {
  url <- paste0("https://github.com/wch/r-source/blob/", sha, "/", file)
  if (!is.null(line)) url <- ifelse(is.na(line), url, paste0(url, "#L", line))
  paste0("[", file, "](", url, ")")
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

q_c_fn      <- query(c_lang, "(function_definition declarator: (function_declarator declarator: (identifier) @name)) @fn")
q_c_call    <- query(c_lang, "(call_expression function: (identifier) @name)")
q_c_goto    <- query(c_lang, "(goto_statement) @goto")
q_c_comment <- query(c_lang, "(comment) @comment")

c_fns        <- list()
c_calls_all  <- character(0)
c_goto_files <- list()
c_comments   <- list()

message("Parsing C files ...")
for (path in c_files) {
  parsed <- safe_parse(c_parser, path)
  if (is.null(parsed)) next
  root <- tree_root_node(parsed$tree)

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

  call_caps   <- query_captures(q_c_call, root)
  c_calls_all <- c(c_calls_all,
                   vapply(call_caps$node, node_text, character(1L)))

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

  com_caps <- query_captures(q_c_comment, root)
  for (cn in com_caps$node) {
    c_comments[[length(c_comments) + 1L]] <- list(
      text = node_text(cn),
      path = parsed$path,
      line = point_row(node_start_point(cn)) + 1L
    )
  }
}

message(sprintf("  %d C functions found", length(c_fns)))

c_fns_df <- tibble(
  name  = vapply(c_fns, `[[`, character(1L), "name"),
  path  = vapply(c_fns, `[[`, character(1L), "path"),
  lines = vapply(c_fns, `[[`, integer(1L),   "lines")
) |> mutate(file = path_rel(path, "r-source"))

top10_c_fns <- slice_max(c_fns_df, lines, n = 10L, with_ties = FALSE) |>
  select(Function = name, File = file, Lines = lines)

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

total_gotos <- sum(vapply(c_goto_files, `[[`, integer(1L), "count"))
top_goto <- tibble(
  File  = path_rel(vapply(c_goto_files, `[[`, character(1L), "path"), "r-source"),
  Gotos = vapply(c_goto_files, `[[`, integer(1L), "count")
) |> arrange(desc(Gotos)) |> head(10L)

best_goto_idx  <- which.max(vapply(c_goto_files, `[[`, integer(1L), "count"))
goto_snip_info <- c_goto_files[[best_goto_idx]]
goto_snip      <- extract_snippet(goto_snip_info$text, goto_snip_info$node)

do_fns <- filter(c_fns_df, grepl("^do_", name)) |> arrange(name)

message("Computing nesting depths ...")
deepest <- list(depth = 0L, name = "", path = "", node = NULL, text = "")
for (fd in c_fns) {
  d <- tryCatch(max_nesting(fd$node), error = function(e) 0L)
  if (d > deepest$depth)
    deepest <- list(depth = d, name = fd$name, path = fd$path,
                    node = fd$node, text = fd$text)
}
deep_snip <- extract_snippet(deepest$text, deepest$node, max_lines = 30L)

message("Analysing comments ...")
comment_texts <- vapply(c_comments, `[[`, character(1L), "text")
comment_paths <- vapply(c_comments, `[[`, character(1L), "path")
comment_lines <- vapply(c_comments, function(x) as.integer(x$line), integer(1L))

has_year <- lengths(regmatches(comment_texts,
                               gregexpr("\\b(19[7-9][0-9]|200[0-5])\\b",
                                        comment_texts))) > 0L
clean_comment <- function(x, width = 120L) {
  x <- gsub("\\s+", " ", trimws(x))
  ifelse(nchar(x) > width, paste0(substr(x, 1L, width), "…"), x)
}

old_comments_df <- tibble(
  text = comment_texts[has_year],
  path = comment_paths[has_year],
  line = comment_lines[has_year],
  year = as.integer(regmatches(
    comment_texts[has_year],
    regexpr("\\b(19[7-9][0-9]|200[0-5])\\b", comment_texts[has_year])
  ))
) |>
  arrange(year) |>
  mutate(File = path_rel(path, "r-source"), Comment = clean_comment(text))

flag_pattern <- "TODO|FIXME|HACK|XXX|BUG|KLUDGE"
flagged_idx  <- grepl(flag_pattern, comment_texts, ignore.case = TRUE)
flagged_df   <- tibble(
  raw     = comment_texts[flagged_idx],
  Comment = clean_comment(comment_texts[flagged_idx]),
  File    = path_rel(comment_paths[flagged_idx], "r-source"),
  Line    = comment_lines[flagged_idx]
) |>
  mutate(Tag = toupper(sub(paste0(".*(", flag_pattern, ").*"), "\\1",
                           raw, ignore.case = TRUE))) |>
  select(-raw) |>
  arrange(Tag, File) |>
  head(20L)

defined_c_fns <- unique(c_fns_df$name)
top10_c_calls <- sort(table(c_calls_all[c_calls_all %in% defined_c_fns]),
                      decreasing = TRUE) |>
  head(10L) |>
  as.data.frame(stringsAsFactors = FALSE) |>
  setNames(c("Function", "Call Sites")) |>
  mutate(`Call Sites` = as.integer(`Call Sites`))

# ── 4. R analysis ─────────────────────────────────────────────────────────────

message("Walking R files ...")
r_files <- dir_ls("r-source", recurse = TRUE, regexp = "\\.R$", type = "file")
message(sprintf("  %d R files", length(r_files)))

q_r_fn        <- query(r_lang, "(binary_operator lhs: (identifier) @name rhs: (function_definition parameters: (parameters) @params) @fn)")
q_r_call      <- query(r_lang, "(call function: (identifier) @name)")
q_r_internal  <- query(r_lang, '(call function: (identifier) @fn (#eq? @fn ".Internal")) @call')
q_r_primitive <- query(r_lang, '(call function: (identifier) @fn (#eq? @fn ".Primitive")) @call')
q_r_comment   <- query(r_lang, "(comment) @comment")

r_fns        <- list()
r_calls_all  <- character(0)
r_internals  <- character(0)
r_primitives <- character(0)
r_comments   <- list()

message("Parsing R files ...")
for (path in r_files) {
  parsed <- safe_parse(r_parser, path)
  if (is.null(parsed)) next
  root <- tree_root_node(parsed$tree)

  caps         <- query_captures(q_r_fn, root)
  fn_nodes     <- caps$node[caps$name == "fn"]
  fn_names     <- vapply(caps$node[caps$name == "name"], node_text, character(1L))
  params_nodes <- caps$node[caps$name == "params"]
  for (i in seq_along(fn_nodes)) {
    r_fns[[length(r_fns) + 1L]] <- list(
      name  = fn_names[[i]],
      path  = parsed$path,
      lines = node_lines(fn_nodes[[i]]),
      args  = as.integer(node_named_child_count(params_nodes[[i]]))
    )
  }

  call_caps   <- query_captures(q_r_call, root)
  r_calls_all <- c(r_calls_all,
                   vapply(call_caps$node, node_text, character(1L)))

  int_caps <- query_captures(q_r_internal, root)
  for (cn in int_caps$node[int_caps$name == "call"]) {
    txt <- node_text(cn)
    m <- regmatches(txt, regexpr("\\.Internal\\(([[:alnum:]._]+)", txt))
    if (length(m) > 0L)
      r_internals <- c(r_internals, sub("\\.Internal\\(", "", m))
  }

  prim_caps <- query_captures(q_r_primitive, root)
  for (cn in prim_caps$node[prim_caps$name == "call"]) {
    txt <- node_text(cn)
    m <- regmatches(txt, regexpr('"([^"]+)"', txt))
    if (length(m) > 0L)
      r_primitives <- c(r_primitives, gsub('"', '', m))
  }

  com_caps <- query_captures(q_r_comment, root)
  for (cn in com_caps$node) {
    r_comments[[length(r_comments) + 1L]] <- list(
      text = node_text(cn),
      path = parsed$path,
      line = point_row(node_start_point(cn)) + 1L
    )
  }
}

message(sprintf("  %d R functions found", length(r_fns)))

r_fns_df <- tibble(
  name  = vapply(r_fns, `[[`, character(1L), "name"),
  path  = vapply(r_fns, `[[`, character(1L), "path"),
  lines = vapply(r_fns, `[[`, integer(1L),   "lines"),
  args  = vapply(r_fns, `[[`, integer(1L),   "args")
) |> mutate(file = path_rel(path, "r-source"))

top10_r_fns <- slice_max(r_fns_df, lines, n = 10L, with_ties = FALSE) |>
  select(Function = name, File = file, Lines = lines)

top15_r_args <- slice_max(r_fns_df, args, n = 15L, with_ties = FALSE) |>
  select(Function = name, File = file, Args = args)

top10_r_calls <- sort(table(r_calls_all), decreasing = TRUE) |>
  head(10L) |>
  as.data.frame(stringsAsFactors = FALSE) |>
  setNames(c("Function", "Call Sites")) |>
  mutate(`Call Sites` = as.integer(`Call Sites`))

dispatch_df <- bind_rows(
  tibble(Name = unique(r_internals), Type = ".Internal"),
  tibble(Name = unique(r_primitives), Type = ".Primitive")
) |> arrange(Type, Name)

# ── 5. Duplicates & uncalled functions ───────────────────────────────────────

dup_c_fns <- c_fns_df |>
  count(name, name = "definitions") |>
  filter(definitions > 1L) |>
  arrange(desc(definitions)) |>
  left_join(
    c_fns_df |> group_by(name) |>
      summarise(files = paste(unique(file), collapse = ", "), .groups = "drop"),
    by = "name"
  ) |>
  head(20L)

dup_r_fns <- r_fns_df |>
  count(name, name = "definitions") |>
  filter(definitions > 1L) |>
  arrange(desc(definitions)) |>
  left_join(
    r_fns_df |> group_by(name) |>
      summarise(files = paste(unique(file), collapse = ", "), .groups = "drop"),
    by = "name"
  ) |>
  head(20L)

called_c <- unique(c_calls_all)
uncalled_c <- c_fns_df |>
  filter(!name %in% called_c, !grepl("^do_", name)) |>
  distinct(name, .keep_all = TRUE) |>
  select(Function = name, File = file, Lines = lines) |>
  head(20L)

called_r <- unique(r_calls_all)
uncalled_r <- r_fns_df |>
  filter(!name %in% called_r) |>
  distinct(name, .keep_all = TRUE) |>
  select(Function = name, File = file, Lines = lines) |>
  head(20L)

n_dup_c    <- nrow(c_fns_df |> count(name) |> filter(n > 1L))
n_dup_r    <- nrow(r_fns_df |> count(name) |> filter(n > 1L))
n_uncall_c <- nrow(c_fns_df |> filter(!name %in% called_c, !grepl("^do_", name)) |>
                     distinct(name))
n_uncall_r <- nrow(r_fns_df |> filter(!name %in% called_r) |> distinct(name))

# ── 6. Funny comments & interesting names ────────────────────────────────────

message("Mining funny comments and names ...")

funny_pat <- paste0(
  "\\b(evil|ugly|horrible|wrong|broken|hack|magic|weird|strange|awful|",
  "terrible|insane|crazy|stupid|dumb|silly|nonsense|bizarre|absurd|",
  "ridiculous|pathetic|oops|yikes|sigh|argh|ugh|damn|crap|mess|disaster|",
  "unfortunate|suspicious|nasty|filthy|gross|obscure|mysterious|bogus|",
  "dubious|treacherous|monstrous|baffling|puzzling|confusing|annoying|",
  "painful|frustrating|surprising|shocking|unbelievable|incredible)\\b"
)

all_comments <- c(
  lapply(c_comments, function(x) c(x, lang = "C")),
  lapply(r_comments, function(x) c(x, lang = "R"))
)
all_texts <- vapply(all_comments, `[[`, character(1L), "text")
all_paths <- vapply(all_comments, `[[`, character(1L), "path")
all_lines <- vapply(all_comments, function(x) as.integer(x$line), integer(1L))
all_langs <- vapply(all_comments, `[[`, character(1L), "lang")

funny_idx <- grepl(funny_pat, all_texts, ignore.case = TRUE) |
             grepl("[[:alpha:]]!", all_texts) |
             grepl("[[:alpha:]]\\?", all_texts)
funny_df <- tibble(
  Comment = clean_comment(all_texts[funny_idx]),
  File    = path_rel(all_paths[funny_idx], "r-source"),
  Line    = all_lines[funny_idx],
  Lang    = all_langs[funny_idx]
) |>
  filter(nchar(Comment) <= 200) |>
  arrange(Lang, File) |>
  head(25L)

long_c_names <- c_fns_df |>
  mutate(nchar = nchar(name)) |>
  slice_max(nchar, n = 15L, with_ties = FALSE) |>
  select(Function = name, File = file, `Name Length` = nchar)

long_r_names <- r_fns_df |>
  mutate(nchar = nchar(name)) |>
  slice_max(nchar, n = 15L, with_ties = FALSE) |>
  select(Function = name, File = file, `Name Length` = nchar)

# ── 6. Overview numbers ───────────────────────────────────────────────────────

n_c_files    <- length(c_files)
n_r_files    <- length(r_files)
n_c_fns      <- nrow(c_fns_df)
n_r_fns      <- nrow(r_fns_df)
n_internals  <- length(unique(r_internals))
n_primitives <- length(unique(r_primitives))
n_do_fns     <- nrow(do_fns)

# ── 6. Write report.md ────────────────────────────────────────────────────────

message("Writing report.md ...")

report <- c(
  "# Base R Source Code: Cool Facts",
  "",
  "> Generated by `analyse.R` from a depth-1 clone of [wch/r-source](https://github.com/wch/r-source).",
  "",

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

  "## Biggest Functions",
  "",
  "### Top 10 Largest C Functions",
  "",
  md_table(mutate(top10_c_fns, File = gh_link(File))),
  "",
  "### Top 10 Largest R Functions",
  "",
  md_table(mutate(top10_r_fns, File = gh_link(File))),
  "",
  "### Top 10 Largest C Files",
  "",
  md_table(mutate(top10_c_files, File = gh_link(File))),
  "",

  "## Most-Used Functions",
  "",
  "### Top 10 Most-Called Internal C Functions",
  "",
  md_table(top10_c_calls),
  "",
  "### Top 10 Most-Called R Functions",
  "",
  md_table(top10_r_calls),
  "",

  "## Most Arguments",
  "",
  "The R functions with the highest number of formal parameters:",
  "",
  md_table(mutate(top15_r_args, File = gh_link(File))),
  "",

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
  glue("In total, **{n_internals} `.Internal`** and **{n_primitives} `.Primitive`** entries were found. A sample:"),
  "",
  md_table(head(dispatch_df, 10L)),
  "",

  "## C Dispatch Layer: `do_*` Functions",
  "",
  glue(
    "By convention, every `.Internal` call routes to a C function whose name starts with `do_`. ",
    "There are **{n_do_fns}** such functions. A sample (first 20 alphabetically):"
  ),
  "",
  md_table(
    do_fns |> head(20L) |>
      select(Function = name, File = file, Lines = lines) |>
      mutate(File = gh_link(File))
  ),
  "",

  "## `goto` in the Wild",
  "",
  glue("Base R's C source contains **{total_gotos} `goto` statements**, ",
       "mostly used for error-handling cleanup. Top files:"),
  "",
  md_table(mutate(top_goto, File = gh_link(File))),
  "",
  glue("A `goto` from {gh_link(path_rel(goto_snip_info$path, 'r-source'))}:\n"),
  "```c",
  goto_snip,
  "```",
  "",

  "## Deepest Nesting",
  "",
  glue(
    "The most deeply nested C function is **`{deepest$name}`** ",
    "in {gh_link(path_rel(deepest$path, 'r-source'))} ",
    "with a `{{}}` nesting depth of **{deepest$depth}**."
  ),
  "",
  "```c",
  deep_snip,
  "```",
  "",

  "## Duplicate Function Names",
  "",
  glue("**{n_dup_c} C function names** are defined in more than one file (typically `static` helpers ",
       "reimplemented per translation unit). Top repeats:"),
  "",
  md_table(dup_c_fns |> rename(Function = name, Definitions = definitions, Files = files)),
  "",
  glue("**{n_dup_r} R function names** are defined more than once across the R library source:"),
  "",
  md_table(dup_r_fns |> rename(Function = name, Definitions = definitions, Files = files)),
  "",

  "## Functions Never Called Within r-source",
  "",
  paste0(
    "These functions have no call site anywhere in the r-source tree. ",
    "For R functions this is expected — they are the public API, called by users and packages. ",
    "For C functions (excluding `do_*` dispatch handlers), it may indicate dead code, ",
    "or functions exposed only through the R C API for package authors."
  ),
  "",
  glue("**{n_uncall_c} C functions** (non-`do_*`) have no call site in r-source. Sample:"),
  "",
  md_table(mutate(uncalled_c, File = gh_link(File))),
  "",
  glue("**{n_uncall_r} R functions** have no call site in r-source. Sample:"),
  "",
  md_table(mutate(uncalled_r, File = gh_link(File))),
  "",

  "## Old & Odd Comments",
  "",
  glue("There are **{nrow(old_comments_df)} C comments** that mention a year between 1970 and 2005. The oldest:"),
  "",
  md_table(head(old_comments_df, 10L) |>
    mutate(File = gh_link(File, line)) |>
    select(Year = year, File, Comment)),
  "",
  glue("**{nrow(flagged_df)} comments** carry a TODO / FIXME / HACK / XXX marker:"),
  "",
  md_table(flagged_df |> mutate(File = gh_link(File, Line)) |> select(Tag, File, Comment)),
  "",

  "## Funny & Colorful Comments",
  "",
  "Comments containing strong opinions, exclamations, or evocative adjectives (C and R combined):",
  "",
  md_table(funny_df |> mutate(File = gh_link(File, Line)) |> select(Comment, File, Lang)),
  "",

  "## Interesting Function Names",
  "",
  "### Longest C Function Names",
  "",
  md_table(mutate(long_c_names, File = gh_link(File))),
  "",
  "### Longest R Function Names",
  "",
  md_table(mutate(long_r_names, File = gh_link(File))),
  "",

  "## Git Repository Audit",
  "",
  paste0(
    "Output of [`git-recon`](https://gist.github.com/gadenbuie/463ff1e9f3b0f48cddc44db2224d286b) ",
    "— bus factor, tag cadence, velocity, churn hotspots, and more:"
  ),
  "",
  "```",
  paste(recon_out, collapse = "\n"),
  "```",
  "",

  "## Cool Facts",
  "",
  glue("- R's C implementation defines **{n_c_fns} functions** across {n_c_files} files — far more than most users imagine."),
  glue("- The biggest single C function, `{top10_c_fns$Function[1]}`, spans **{top10_c_fns$Lines[1]} lines** of C."),
  glue("- The biggest single R function, `{top10_r_fns$Function[1]}`, spans **{top10_r_fns$Lines[1]} lines** of R."),
  glue("- The most-called internal C function is `{top10_c_calls$Function[1]}` ({top10_c_calls[['Call Sites']][1]} call sites)."),
  glue("- The most-called R function is `{top10_r_calls$Function[1]}` ({top10_r_calls[['Call Sites']][1]} call sites)."),
  glue("- **{total_gotos} `goto` statements** appear in the C source, mostly for error-handling cleanup."),
  glue("- **{n_do_fns}** C functions follow the `do_*` naming convention, one per `.Internal` entry."),
  glue("- There are **{n_r_fns} named R functions** defined in the base R library source files."),
  glue("- The dispatch bridge has **{n_internals + n_primitives} entries** connecting R names to C implementations."),
  glue("- The R function with the most arguments is `{top15_r_args$Function[1]}` with {top15_r_args$Args[1]} parameters."),
  ""
)

writeLines(report, "report.md")
message("Done — report.md written.")
