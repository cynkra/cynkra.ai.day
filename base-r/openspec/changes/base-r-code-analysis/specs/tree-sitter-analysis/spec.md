## ADDED Requirements

### Requirement: Parse C source files
The pipeline SHALL use the `treesitter.c` R package to parse all `.c` and `.h` files under `r-source/src/`, extracting function definitions (name + line span).

#### Scenario: Successful C parse
- **WHEN** a `.c` file is valid C
- **THEN** all function definitions are extracted with their name, file path, start line, and end line

#### Scenario: Unparseable file
- **WHEN** tree-sitter reports a parse error for a file
- **THEN** the file is logged as skipped and analysis continues

### Requirement: Parse R source files
The pipeline SHALL use the `treesitter.r` R package to parse all `.R` files under `r-source/`, extracting function definitions and all `.Internal()` / `.Primitive()` call sites.

#### Scenario: Successful R parse
- **WHEN** an `.R` file is valid R
- **THEN** function definitions and `.Internal`/`.Primitive` calls are extracted with file path and line number

#### Scenario: Unparseable R file
- **WHEN** tree-sitter reports a parse error
- **THEN** the file is logged as skipped and analysis continues

### Requirement: Most-used functions
The pipeline SHALL count how many times each function name appears as a call expression across all parsed files, for C and R separately, and produce a top-10 ranking for each.

#### Scenario: C call frequency computed
- **WHEN** all C files have been parsed
- **THEN** a ranked table of the 10 most-called C function names (by call-site count) is available

#### Scenario: R call frequency computed
- **WHEN** all R files have been parsed
- **THEN** a ranked table of the 10 most-called R function names (by call-site count) is available

### Requirement: Derive analysis facts
From the parsed data the pipeline SHALL compute:

- Top 10 largest C functions by line count
- Top 10 largest R functions by line count
- Top 10 C files by total lines of code
- Complete list of `.Internal()` and `.Primitive()` calls with their R-level names
- Count of `goto` statements across all C files, with the top offenders
- Most deeply nested C function (maximum nesting depth)
- Count of functions named `do_*` (the C dispatch convention for `.Internal`)

#### Scenario: Facts computed
- **WHEN** all source files have been parsed
- **THEN** each metric above is available as a data frame or named list for the report step
