## ADDED Requirements

### Requirement: Decks group cards by topic

The system SHALL provide a `Deck` entity with: `id`, `owner_id`, `name`, `topic` (free-form string, e.g. `grammar`, `themes`, `OLS-formulas`), `target_language` (nullable), `explanation_style` (nullable), `default_enrichment_mode` (one of `manual`, `external`, `llm`; default `llm`), `created_at`, `updated_at`. Every card SHALL belong to exactly one deck.

#### Scenario: New card is assigned to a deck

- **WHEN** a card is created from capture and the user has selected a deck
- **THEN** the card's `deck_id` is the chosen deck's id
- **AND** the deck is owned by the same user as the card

#### Scenario: Capture without a chosen deck lands in the default Inbox

- **WHEN** a card is created from capture and no deck has been selected
- **THEN** the card is placed in a per-user `Inbox` deck that the system creates lazily on first capture

### Requirement: Decks can be browsed by topic

The system SHALL allow a user to list their decks and filter or group them by `topic`.

#### Scenario: Listing decks groups them by topic

- **WHEN** a user opens the deck list
- **THEN** decks are returned grouped by their `topic` value
- **AND** decks with no topic are returned under a `Untagged` group

### Requirement: Cards can be moved between decks

The system SHALL allow a user to reassign a card from one deck to another. Moving a card MUST preserve its scheduling state (the card does not reset to `New`).

#### Scenario: Move preserves study progress

- **WHEN** a user moves a card with `status = ready` and a non-null `last_reviewed_at` from deck A to deck B
- **THEN** the card's `deck_id` becomes deck B's id
- **AND** `last_reviewed_at`, `interval_days`, and `ease` are unchanged

### Requirement: Deleting a deck requires explicit handling of its cards

The system SHALL NOT delete cards as a side effect of deleting a deck. The user SHALL be required to either move the deck's cards to another deck or explicitly confirm deletion of all cards in the deck.

#### Scenario: Deleting a non-empty deck without confirmation is rejected

- **WHEN** a user attempts to delete a deck that still contains cards, without specifying a destination deck or a delete-cards confirmation
- **THEN** the backend rejects the request with HTTP 409 and an error code `deck_not_empty`

#### Scenario: Deleting a deck with cards-move

- **WHEN** a user deletes a deck and specifies a destination deck for the cards
- **THEN** all cards in the deleted deck have their `deck_id` updated to the destination deck before the deck is removed
- **AND** their scheduling state is preserved

### Requirement: Deck default enrichment mode applies on capture

When a card is created without an explicit `enrichment_mode`, the system SHALL set the new card's `enrichment_mode` to the deck's `default_enrichment_mode`. Changing a deck's `default_enrichment_mode` SHALL NOT modify the `enrichment_mode` of cards that already exist in that deck.

#### Scenario: New card inherits the deck default

- **WHEN** a deck has `default_enrichment_mode = manual` and the user creates a card in that deck without specifying a mode
- **THEN** the new card has `enrichment_mode = manual`
- **AND** no LLM call is made for that card

#### Scenario: Existing cards are unaffected when the deck default changes

- **WHEN** a deck contains cards with `enrichment_mode = llm` and the user changes the deck's `default_enrichment_mode` to `manual`
- **THEN** the existing cards' `enrichment_mode` values are unchanged
- **AND** only cards created after the change use the new default
