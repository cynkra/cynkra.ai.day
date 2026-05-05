## ADDED Requirements

### Requirement: Count arguments per named R function
`analyse.R` SHALL collect the number of formal parameters for every top-level named R function encountered during the existing R parse loop, using `node_named_child_count` on the `parameters` node of each matched `function_definition`.

#### Scenario: Function with known arity is counted correctly
- **WHEN** a named R function with N declared parameters is parsed
- **THEN** the stored `args` value for that function SHALL equal N

### Requirement: Rank R functions by argument count
`analyse.R` SHALL produce a `top15_r_args` data frame containing the 15 R functions with the highest argument count, including columns `Function`, `File`, and `Args`.

#### Scenario: Top-15 table is populated
- **WHEN** all R source files have been parsed
- **THEN** `top15_r_args` SHALL have exactly 15 rows ordered descending by `Args`
