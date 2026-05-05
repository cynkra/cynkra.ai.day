## 1. Extend R parse loop in analyse.R

- [x] 1.1 Add `args = node_named_child_count(params_node)` capture inside the existing `for (path in r_files)` loop, alongside the `lines` capture, storing it in each `r_fns` list entry
- [x] 1.2 After building `r_fns_df`, add an `args` column derived from the stored counts

## 2. Compute top-15 ranking

- [x] 2.1 Derive `top15_r_args` using `slice_max(r_fns_df, args, n = 15L, with_ties = FALSE)` selecting `Function`, `File`, and `Args` columns

## 3. Add report section

- [x] 3.1 Insert a `## Most Arguments` section into the `report` character vector (after the existing "Most-Used Functions" section), containing `md_table(mutate(top15_r_args, File = gh_link(File)))`
- [x] 3.2 Add a Cool Facts bullet: `glue("- The R function with the most arguments is \`{top15_r_args$Function[1]}\` with {top15_r_args$Args[1]} parameters.")`

## 4. Verify

- [x] 4.1 Re-run `Rscript analyse.R` and confirm `report.md` contains the `## Most Arguments` section with 15 rows and the new Cool Facts bullet
