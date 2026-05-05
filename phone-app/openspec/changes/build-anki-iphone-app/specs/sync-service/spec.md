## ADDED Requirements

### Requirement: Backend is the source of truth

The backend SHALL be the authoritative store for users, decks, cards, and scheduling state. Clients SHALL treat their local data as a cache of backend state.

#### Scenario: Conflict resolves to last-write-wins

- **WHEN** the same card is modified on two devices and both updates reach the backend
- **THEN** the update with the later `updated_at` timestamp is retained
- **AND** the older update's changes are overwritten

### Requirement: Authenticated API

The backend SHALL require authentication on every non-public endpoint. The system SHALL support email + magic-link sign-in and issue a JWT that authorizes subsequent requests.

#### Scenario: Unauthenticated request is rejected

- **WHEN** a client calls a non-public endpoint without a valid JWT
- **THEN** the backend responds with HTTP 401 and does not reveal data

#### Scenario: Magic-link flow issues a JWT

- **WHEN** a user requests a magic link for their email and clicks it within the validity window
- **THEN** the backend issues a JWT bound to that user
- **AND** subsequent requests carrying the JWT succeed for that user's resources only

### Requirement: Pull-by-cursor sync

The backend SHALL expose a sync endpoint that returns all changes to the user's decks and cards since a client-supplied cursor. The response SHALL include a new cursor that the client uses on the next call. The cursor SHALL be opaque to clients.

#### Scenario: Cursor advances after first sync

- **WHEN** a client calls sync with no cursor (first sync)
- **THEN** the response contains all of the user's decks and cards plus a cursor
- **AND** a subsequent sync call using that cursor returns only changes that occurred after the first call

#### Scenario: Idempotent re-sync

- **WHEN** a client calls sync twice with the same cursor and no server-side changes occurred between the calls
- **THEN** the second response returns no decks and no cards (only an unchanged cursor)

### Requirement: Push endpoints for cards and decks

The backend SHALL accept create and update requests for cards and decks. Every create SHALL accept a client-generated `id` so retries are idempotent.

#### Scenario: Idempotent retry of card creation

- **WHEN** a client creates a card with a specific `id` and, after a network error, retries the same request with the same `id`
- **THEN** the backend persists exactly one card with that `id`
- **AND** the second response is a success (HTTP 200 or 201) with the same card payload as the first

### Requirement: Per-user data isolation

The backend SHALL ensure that a user's queries and mutations only ever touch records owned by that user. Cross-user reads or writes MUST be impossible from the public API.

#### Scenario: User A cannot fetch User B's card

- **WHEN** user A authenticates and requests a card whose `owner_id` is user B
- **THEN** the backend responds with HTTP 404 (not 403) so it does not leak existence
- **AND** the request is logged at the access-control layer

### Requirement: Schema versioning on every payload

Every request and response that carries cards or decks SHALL include a `schema_version` field. The backend SHALL reject payloads with an unsupported version.

#### Scenario: Unsupported version is rejected

- **WHEN** a client sends a payload with a `schema_version` the backend does not recognize
- **THEN** the backend responds with HTTP 400 and an error code `unsupported_schema_version`
- **AND** no data is persisted or returned
