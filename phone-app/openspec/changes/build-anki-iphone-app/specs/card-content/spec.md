## ADDED Requirements

### Requirement: Canonical card schema

The system SHALL define a single card schema used by the iOS app, the backend, and the web client. Every card SHALL have: `id`, `owner_id`, `deck_id`, `source_text`, `source_url` (nullable), `content_type` (one of `text`, `formula`, `code`), `translation` (nullable until enrichment completes), `explanation` (nullable until enrichment completes), `status` (one of `draft`, `enriching`, `ready`, `failed`), `schema_version`, `created_at`, `updated_at`.

#### Scenario: Card created from capture has required fields

- **WHEN** a draft card is created from a capture event
- **THEN** the card has a non-empty `id`, `owner_id`, `source_text`, `created_at`, and `schema_version`
- **AND** `status` is `draft` or `enriching`
- **AND** `translation` and `explanation` may be null

#### Scenario: Backend rejects unknown schema version

- **WHEN** a client uploads a card payload with a `schema_version` the backend does not support
- **THEN** the backend rejects the request with HTTP 400 and an error code `unsupported_schema_version`
- **AND** no card is persisted

### Requirement: Content-type detection

The system SHALL classify each captured card into exactly one `content_type` of `text`, `formula`, or `code`. Detection SHALL run on device first using deterministic heuristics; if confidence is below a configured threshold, the backend SHALL re-classify using the LLM.

#### Scenario: LaTeX selection is classified as formula

- **WHEN** a user captures the selection `$\hat{\beta} = (X^T X)^{-1} X^T y$`
- **THEN** the card's `content_type` is `formula` after classification

#### Scenario: Fenced code block is classified as code

- **WHEN** a user captures a selection that begins and ends with triple backticks and contains recognizable programming syntax
- **THEN** the card's `content_type` is `code`

#### Scenario: Plain word is classified as text without LLM

- **WHEN** a user captures a single common dictionary word
- **THEN** the on-device classifier sets `content_type = text` with confidence above the threshold
- **AND** the backend does not invoke the LLM for re-classification

### Requirement: Automatic translation and explanation

When a card reaches the backend with `status = enriching`, the backend SHALL produce a `translation` and `explanation` appropriate to the card's `content_type` and the deck's configured target language / explanation style. On success, the card's `status` becomes `ready`.

#### Scenario: Word is translated into the deck's target language

- **WHEN** a user captures the German word "Schadenfreude" into a deck whose target language is English
- **THEN** the resulting card has a non-empty English `translation` and an English `explanation`
- **AND** the card's `status` is `ready`

#### Scenario: Code snippet is explained, not translated

- **WHEN** a card has `content_type = code`
- **THEN** the backend leaves `translation` equal to the source verbatim and populates `explanation` with a description of what the code does in the deck's target language

#### Scenario: Enrichment failure surfaces

- **WHEN** the LLM call for enrichment fails after retries
- **THEN** the card's `status` becomes `failed` with a non-empty `last_error` field
- **AND** the user can request a retry from the client

### Requirement: Source text is preserved verbatim

The system SHALL store the user's original captured selection in `source_text` exactly as provided, with no LLM-generated rewrites. The `translation` and `explanation` fields are separate; modifying them MUST NOT alter `source_text`.

#### Scenario: Re-translation does not change source

- **WHEN** a user requests re-translation of an existing card
- **THEN** `source_text` is unchanged after the operation
- **AND** only `translation`, `explanation`, and `updated_at` may change
