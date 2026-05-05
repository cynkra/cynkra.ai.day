## ADDED Requirements

### Requirement: Generate-deck endpoint accepts a free-form prompt

The backend SHALL expose an endpoint that accepts `{ prompt: string, target_language?: string, max_cards?: integer }` and returns a newly created deck plus the cards that populate it. The default `max_cards` SHALL be 20 and the maximum SHALL be 100.

#### Scenario: User generates a deck from a prompt

- **WHEN** a signed-in user submits the prompt "Create a deck with basic formulas describing OLS"
- **THEN** the endpoint creates a new deck whose `name` reflects the prompt (e.g. "OLS — basic formulas") and whose `topic` is a kebab-case derivation
- **AND** the response includes a non-empty list of cards, each with `content_type` set, `source_text` populated, and `status = ready`

### Requirement: Generation is atomic

The system SHALL persist the generated deck and its cards in a single transaction. If validation of the LLM response fails, NEITHER the deck NOR any cards SHALL be persisted.

#### Scenario: Invalid LLM response leaves no partial state

- **WHEN** the LLM returns a response that fails schema validation
- **THEN** no deck and no cards are created
- **AND** the endpoint responds with HTTP 422 and an error code `generation_invalid_output`
- **AND** the error response includes a human-readable reason and the model's raw output truncated to a configured length

### Requirement: Generated cards conform to the canonical card schema

Every card returned by generation SHALL satisfy the same schema and validation rules as captured cards (see `card-content`). In particular, every generated card MUST have `source_text`, a valid `content_type`, and `status = ready` with `translation` and `explanation` populated.

#### Scenario: Generated formula cards include both source and explanation

- **WHEN** a deck is generated for "basic formulas describing OLS"
- **THEN** each generated formula card has `content_type = formula`, a `source_text` containing valid LaTeX, and a non-empty `explanation`

### Requirement: Generation is bounded by the user's daily LLM budget

The system SHALL count a generation request against the user's daily LLM budget. If the user has insufficient budget, the request SHALL be rejected before any provider call is made.

#### Scenario: User over budget cannot generate

- **WHEN** a user whose daily LLM budget is exhausted submits a generation request
- **THEN** the endpoint responds with HTTP 429 and an error code `daily_budget_exceeded`
- **AND** the response includes the timestamp at which the budget resets
- **AND** no LLM provider call is made

### Requirement: Generation does not duplicate decks silently

If the user already has a deck whose `name` matches the proposed name, the system SHALL either disambiguate the new deck's name or return an error indicating the conflict; it MUST NOT silently merge into the existing deck.

#### Scenario: Disambiguation on name collision

- **WHEN** generation would produce a deck named "OLS — basic formulas" and one already exists with that name for the same user
- **THEN** the new deck is created with a disambiguated name (e.g. "OLS — basic formulas (2)")
- **AND** no card is added to the pre-existing deck
