## ADDED Requirements

### Requirement: Web client mirrors the iPhone library

The web client SHALL display the signed-in user's decks and cards from the backend. Cards created on iPhone SHALL appear in the web client without requiring any manual action beyond the page being open or refreshed.

#### Scenario: Card created on iPhone shows up on web

- **WHEN** a signed-in user captures a card on iPhone and the backend has acknowledged the upload
- **THEN** the same user's web client, on its next sync cycle (within a few seconds while the page is open), displays the card in the appropriate deck

### Requirement: Web client shows progress dashboard

The web client SHALL display, per deck and across the entire library, the counts of cards in `New`, `Learned`, and `Due` as defined by the study engine.

#### Scenario: Dashboard reflects bucket counts

- **WHEN** a user opens the dashboard
- **THEN** for each deck the UI shows three numeric counts labeled `New`, `Learned`, `Due`
- **AND** the counts equal those returned by the study-engine progress endpoint for that deck

### Requirement: Web client supports review

The web client SHALL allow a user to start a review session for a deck and grade cards. Submitting a grade SHALL update the card's scheduling state via the backend and the dashboard counts SHALL update accordingly.

#### Scenario: Reviewing a Due card moves it to Learned

- **WHEN** a user starts a review session for a deck that has at least one `Due` card and grades that card as correct
- **THEN** the card is no longer counted in `Due`
- **AND** the card is counted in `Learned`
- **AND** the change is reflected on the iPhone after its next sync

### Requirement: Web client surfaces enrichment status

The web client SHALL visually distinguish cards whose `status` is `enriching` or `failed` from `ready` cards, and SHALL allow the user to retry enrichment for `failed` cards.

#### Scenario: Failed enrichment exposes a retry action

- **WHEN** a card has `status = failed`
- **THEN** the web UI shows a visible failure indicator on that card and a "Retry" control
- **AND** triggering "Retry" causes the backend to re-attempt enrichment

### Requirement: Web client triggers AI deck generation

The web client SHALL provide a UI for AI deck generation that submits a prompt to the backend and, on success, navigates the user to the newly generated deck.

#### Scenario: User generates a deck from the web

- **WHEN** a user submits the prompt "Create a deck with basic formulas describing OLS" via the generation UI
- **THEN** the web client calls the generation endpoint, displays an in-progress indicator, and on success opens the newly created deck
- **AND** every card in the generated deck is rendered with its source and explanation
