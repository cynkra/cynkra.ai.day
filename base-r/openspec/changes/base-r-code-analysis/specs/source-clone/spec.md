## ADDED Requirements

### Requirement: Shallow clone of wch/r-source
The pipeline SHALL perform a depth-1 git clone of `https://github.com/wch/r-source` into a local `r-source/` directory. If the directory already exists, the clone step SHALL be skipped.

#### Scenario: Fresh clone
- **WHEN** `r-source/` does not exist
- **THEN** the script runs `git clone --depth 1 https://github.com/wch/r-source r-source/` and proceeds

#### Scenario: Directory already present
- **WHEN** `r-source/` already exists
- **THEN** the script skips cloning and proceeds with the existing directory

