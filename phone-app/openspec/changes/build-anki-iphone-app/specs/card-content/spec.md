## ADDED Requirements

### Requirement: Canonical card schema

The system SHALL define a single card schema used by the iOS app, the backend, and the web client. Every card SHALL have: `id`, `owner_id`, `deck_id`, `source_text`, `source_url` (nullable), `content_type` (one of `text`, `formula`, `code`), `enrichment_mode` (one of `manual`, `external`, `llm`), `translation` (nullable until enrichment completes), `explanation` (nullable until enrichment completes), `status` (one of `draft`, `enriching`, `ready`, `failed`), `schema_version`, `created_at`, `updated_at`.

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

### Requirement: Manual enrichment mode

When a card has `enrichment_mode = manual`, the system SHALL NOT call any LLM or external translation provider for that card. The user SHALL be able to provide `translation` and `explanation` themselves at any time, including leaving them empty. A manual card transitions from `draft` to `ready` when the user marks it ready (explicitly or by saving the edit form).

#### Scenario: Manual card never triggers a provider call

- **WHEN** a card is created with `enrichment_mode = manual`
- **THEN** the backend does NOT make any LLM provider call for that card
- **AND** the backend does NOT make any external translator call for that card
- **AND** the card's `status` does NOT enter `enriching`

#### Scenario: User saves a manual card with their own translation

- **WHEN** a user creates a card with `enrichment_mode = manual` and supplies `translation = "schadenfreude (joy at another's misfortune)"`
- **THEN** the card is persisted with that exact `translation` and `status = ready`
- **AND** no part of `translation` is rewritten by the backend

#### Scenario: User saves a manual card with empty translation

- **WHEN** a user explicitly marks a manual card ready with empty `translation` and `explanation`
- **THEN** the card is persisted with `status = ready` and both fields empty
- **AND** the card is reviewable (it appears in `New` per the study-engine bucket rules)

### Requirement: External translator enrichment mode

When a card has `enrichment_mode = external`, the backend SHALL populate `translation` by calling the configured external (non-LLM) translation provider — Google Translate by default — using the deck's target language. The backend SHALL NOT populate `explanation` in this mode; the user MAY add it manually later. External mode SHALL only be valid for `content_type = text`.

#### Scenario: External mode translates a word with Google Translate

- **WHEN** a user captures the German word "Schadenfreude" into a deck with target language English and `enrichment_mode = external`
- **THEN** the backend calls the configured external translation provider (not the LLM) with that word and target language
- **AND** the resulting card has a non-empty `translation`, an empty `explanation`, and `status = ready`

#### Scenario: External mode is rejected for code

- **WHEN** a card creation request specifies `enrichment_mode = external` and `content_type = code`
- **THEN** the backend rejects the request with HTTP 400 and an error code `external_mode_unsupported_for_content_type`
- **AND** no card is persisted

#### Scenario: External mode is rejected for formula

- **WHEN** a card creation request specifies `enrichment_mode = external` and `content_type = formula`
- **THEN** the backend rejects the request with HTTP 400 and an error code `external_mode_unsupported_for_content_type`
- **AND** no card is persisted

#### Scenario: External translator failure surfaces

- **WHEN** the external translator call fails after retries
- **THEN** the card's `status` becomes `failed` with a non-empty `last_error` field
- **AND** the user can request a retry, or switch the card's `enrichment_mode` to `manual` or `llm`

### Requirement: Card creation accepts an enrichment-mode override

When a card is created, the request MAY include an explicit `enrichment_mode`. When the field is omitted, the backend SHALL use the deck's `default_enrichment_mode`.

#### Scenario: Mode override is honoured

- **WHEN** a user creates a card with explicit `enrichment_mode = manual` in a deck whose `default_enrichment_mode` is `llm`
- **THEN** the persisted card has `enrichment_mode = manual`
- **AND** no LLM call is made for that card

#### Scenario: Mode falls back to deck default

- **WHEN** a user creates a card without specifying `enrichment_mode` in a deck whose `default_enrichment_mode` is `external`
- **THEN** the persisted card has `enrichment_mode = external`

### Requirement: User can change a card's enrichment mode

The system SHALL allow a user to change an existing card's `enrichment_mode`. Changing the mode SHALL NOT automatically re-run enrichment; the user MUST explicitly trigger a re-enrichment to repopulate `translation` and `explanation`.

#### Scenario: Switching mode does not silently overwrite fields

- **WHEN** a user switches a card from `manual` to `llm`
- **THEN** the existing `translation` and `explanation` are unchanged until the user explicitly requests re-enrichment

#### Scenario: Explicit re-enrichment uses the new mode

- **WHEN** a user has switched a card from `manual` to `llm` and triggers re-enrichment
- **THEN** the backend calls the LLM and populates `translation` and `explanation` from the LLM output
- **AND** `source_text` is unchanged

### Requirement: Source text is preserved verbatim

The system SHALL store the user's original captured selection in `source_text` exactly as provided, with no LLM-generated rewrites. The `translation` and `explanation` fields are separate; modifying them MUST NOT alter `source_text`.

#### Scenario: Re-translation does not change source

- **WHEN** a user requests re-translation of an existing card
- **THEN** `source_text` is unchanged after the operation
- **AND** only `translation`, `explanation`, and `updated_at` may change
