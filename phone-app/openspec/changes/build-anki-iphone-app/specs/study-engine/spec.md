## ADDED Requirements

### Requirement: Every card has scheduling state

The system SHALL store on every card: `interval_days` (integer, default 0), `ease` (float, default 2.5), `last_reviewed_at` (nullable timestamp), `next_due_at` (nullable timestamp).

#### Scenario: Newly created card has empty scheduling state

- **WHEN** a card is first created
- **THEN** `interval_days = 0`, `ease = 2.5`, `last_reviewed_at = null`, `next_due_at = null`

### Requirement: Progress dashboard classifies every card into exactly one bucket

The system SHALL classify every `ready` card into exactly one of `New`, `Learned`, `Due`. The classification rules are:

- `New` — `last_reviewed_at` is null.
- `Due` — `last_reviewed_at` is not null AND `next_due_at` is not null AND `next_due_at <= now`.
- `Learned` — `last_reviewed_at` is not null AND (`next_due_at` is null OR `next_due_at > now`).

Cards with `status` other than `ready` SHALL NOT appear in any bucket.

#### Scenario: Never-reviewed card appears as New

- **WHEN** the dashboard is computed for a user who has a card with `status = ready` and `last_reviewed_at = null`
- **THEN** that card is counted in the `New` bucket and not in `Learned` or `Due`

#### Scenario: Reviewed card past its due date appears as Due

- **WHEN** the dashboard is computed and a card has `last_reviewed_at` in the past and `next_due_at` earlier than now
- **THEN** that card is counted in the `Due` bucket and not in `New` or `Learned`

#### Scenario: Reviewed card not yet due appears as Learned

- **WHEN** the dashboard is computed and a card has `last_reviewed_at` in the past and `next_due_at` in the future
- **THEN** that card is counted in the `Learned` bucket and not in `New` or `Due`

#### Scenario: Cards in enrichment are excluded

- **WHEN** the dashboard is computed and a card has `status = enriching` or `status = failed`
- **THEN** that card is not counted in any of `New`, `Learned`, `Due`

### Requirement: Reviewing a card updates its scheduling state

When a user reviews a card and grades the answer, the system SHALL update `last_reviewed_at` to now, recompute `interval_days` and `ease` using an SM-2-derived schedule, and set `next_due_at = now + interval_days`.

#### Scenario: Correct first review moves card to Learned

- **WHEN** a user reviews a `New` card and grades it as correct
- **THEN** `last_reviewed_at` is set to now, `interval_days >= 1`, and `next_due_at` is in the future
- **AND** the card moves out of the `New` bucket and into `Learned`

#### Scenario: Failed review schedules card for soon

- **WHEN** a user reviews a card and grades it as incorrect
- **THEN** `interval_days` is reset toward zero and `next_due_at` is no later than 24 hours from now
- **AND** on the next dashboard computation, once `next_due_at <= now`, the card appears as `Due`

### Requirement: Per-deck progress is reportable

The system SHALL be able to report the count of cards in each of `New`, `Learned`, `Due` for a single deck and for the user's whole library.

#### Scenario: Deck dashboard returns three counts

- **WHEN** a client requests the progress for a specific deck
- **THEN** the response includes integer counts for `new`, `learned`, and `due`
- **AND** the three counts sum to the number of `ready` cards in that deck
