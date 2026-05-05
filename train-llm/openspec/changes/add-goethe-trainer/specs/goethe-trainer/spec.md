## ADDED Requirements

### Requirement: Train a Goethe Language Model

The system SHALL train a Transformer language model from scratch on a corpus of Goethe's works in German.

#### Scenario: Training run completes within budget on a 16 GB laptop

- **WHEN** the training script runs on an Apple Silicon laptop with 16 GB RAM
- **THEN** the run completes within 5 minutes without out-of-memory errors

#### Scenario: Loss decreases monotonically across the run

- **WHEN** the training run executes end-to-end
- **THEN** the recorded training loss at the final logged step is lower than at the first logged step

### Requirement: Ingest Goethe Corpus

The system SHALL fetch and prepare Goethe's works from Project Gutenberg as the training corpus.

#### Scenario: Umlauts are preserved through preparation

- **WHEN** the corpus preparation step runs over raw Gutenberg files
- **THEN** the resulting training tensor preserves German characters ä, ö, ü, ß

#### Scenario: Gutenberg headers and footers are stripped

- **WHEN** raw Gutenberg files are processed
- **THEN** the prepared corpus contains only Goethe's text, not Project-Gutenberg licensing or boilerplate

### Requirement: Generate Goethe-like Samples

The system SHALL generate text samples from the trained model.

#### Scenario: Sample output is judged Goethe-like by a human reader

- **WHEN** a human reads a few hundred tokens of sampled output
- **THEN** they recognize features such as archaic phrasings (e.g. *ihr/euer*, *ach*), pseudo-classical sentence structure, or occasional Knittelvers / blank-verse rhythm

### Requirement: Persist Model Checkpoints

The system SHALL save a model checkpoint at the end of each training run.

#### Scenario: Sampling loads a saved checkpoint without retraining

- **WHEN** the user runs the sampling script after a completed training run
- **THEN** it loads the saved checkpoint and produces output without re-running training
