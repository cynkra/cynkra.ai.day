## REMOVED Requirements

### Requirement: iOS Share Extension accepts text selections

**Reason**: Native iOS Share Extension distribution requires the Apple Developer Program ($99/year) for App Store / TestFlight delivery, and its data-sharing model relies on App Groups, which is also gated behind the paid program. We have decided not to pay the membership. Capture from the iOS share sheet is preserved by a different mechanism (see `iOS Shortcut accepts text selections` below).

**Migration**: Users no longer install a Share Extension. They install an Apple Shortcut from the PWA's "Setup on iPhone" page; the Shortcut appears in the system share sheet and posts directly to `POST /cards`.

### Requirement: Share Extension works without a full app launch

**Reason**: Removed together with the Share Extension itself.

**Migration**: The replacement Apple Shortcut runs as a system service inside the Shortcuts app, not inside our process. It does not require any of our app to be running.

## MODIFIED Requirements

### Requirement: All client writes go through a local outbox

Every PWA client write (manual entry, edit, review grade, deck create / update / delete) SHALL be persisted to a durable IndexedDB outbox before contacting the backend. A background drainer SHALL upload outbox entries asynchronously, retrying with exponential backoff. Each outbox entry carries a client-supplied `id` so retries are idempotent on the backend.

The PWA's IndexedDB outbox is the only client-side outbox in the system. The iOS Shortcut is a write-only, online-only client and does NOT participate in this outbox; its capture is a synchronous HTTPS POST and the user observes success or failure immediately via the Shortcut's notification step.

#### Scenario: PWA write while offline persists to outbox

- **WHEN** a user creates or edits a card in the PWA while the device is offline
- **THEN** the write is persisted to the IndexedDB outbox with `pending_upload` status
- **AND** the local UI reflects the change immediately
- **AND** when network connectivity returns the drainer uploads the entry to the backend

#### Scenario: Retry uses the same client-supplied id

- **WHEN** an outbox upload fails with a network error and is retried
- **THEN** the retry sends the same client-supplied `id` as the original attempt
- **AND** the backend persists exactly one record (idempotent)

#### Scenario: Outbox survives PWA process restart

- **WHEN** the PWA process exits (tab close, OS reload) with non-empty outbox entries
- **THEN** on the next PWA load the drainer resumes uploading those entries from IndexedDB

#### Scenario: Shortcut capture does NOT use the outbox

- **WHEN** the iOS Shortcut is invoked from the share sheet
- **THEN** the Shortcut posts the new card directly to `POST /cards` over HTTPS
- **AND** if the POST fails, the Shortcut surfaces the error via its notification step
- **AND** no local outbox is involved (the user is expected to retry the Shortcut when online)

### Requirement: Captured cards record their origin

Every card created via capture SHALL store the source surface (`ios-shortcut`, `web-clipper`, `manual`) and, when available, the source URL.

#### Scenario: Origin is preserved across sync

- **WHEN** a card is captured on iPhone via the iOS Shortcut from Safari
- **THEN** the persisted card has `source = ios-shortcut` and a non-empty `source_url` when Safari supplied one
- **AND** the same fields are present when the card is fetched from the PWA on any device

### Requirement: Manual card entry without capture

The PWA SHALL provide a "New card" form that lets a user create a card by typing `source_text` directly, choosing the target deck, and (optionally) supplying `translation` and `explanation`. This path SHALL NOT require any text-selection event. The PWA's "New card" form is reachable from desktop and from the home-screen-installed PWA on iPhone.

#### Scenario: User adds a card by typing it on iPhone PWA

- **WHEN** a signed-in user opens the home-screen-installed PWA on iPhone, taps "New card", types "Schadenfreude", chooses a deck with `default_enrichment_mode = manual`, types "joy at another's misfortune" as the translation, and saves
- **THEN** a card is persisted with that exact `source_text`, that exact `translation`, `enrichment_mode = manual`, and `status = ready`
- **AND** no LLM and no external translation provider call is made for that card

#### Scenario: User adds a card by typing it on the web

- **WHEN** a signed-in user opens the PWA on desktop, opens the "New card" form, types `source_text`, selects an enrichment mode of `external`, and saves
- **THEN** a card is created with the chosen mode and the backend invokes the configured external translator (not the LLM) to populate `translation`

### Requirement: Capture flow exposes enrichment-mode choice

When a card is created from the web clipper or the PWA's "New card" form, the user SHALL be able to override the deck's `default_enrichment_mode` for that single card before it is persisted.

The iOS Shortcut SHALL keep capture to a single share-sheet tap by default. The Shortcut MAY include an optional, dismissible prompt for enrichment mode; if the prompt is dismissed or the field is left empty, the deck's `default_enrichment_mode` is used. Mode changes after capture happen in the PWA, not in the Shortcut.

#### Scenario: Web clipper lets user pick manual on the fly

- **WHEN** a user invokes the web clipper and, before submitting, changes the enrichment mode from the deck default to `manual`
- **THEN** the persisted card has `enrichment_mode = manual` regardless of the deck's default
- **AND** no provider call is made for that card

#### Scenario: Shortcut capture defaults to deck mode when no override is given

- **WHEN** a user invokes the iOS Shortcut without supplying an enrichment mode
- **THEN** the persisted card has `enrichment_mode` equal to the target deck's `default_enrichment_mode`

## ADDED Requirements

### Requirement: iOS Shortcut accepts text selections from the system share sheet

The system SHALL provide a downloadable Apple Shortcut (`.shortcut` file) that registers in the iOS system share sheet and accepts shared text. When invoked, the Shortcut SHALL post a draft card to the backend's `POST /cards` endpoint over HTTPS, authenticated with the user's personal access token (PAT). The Shortcut SHALL surface success or failure via the iOS notification step. The Shortcut SHALL NOT require any Apple Developer Program membership to install or use.

#### Scenario: User shares a selected word from Safari via the Shortcut

- **WHEN** a user with the Shortcut installed selects a word in Safari, taps "Share", and taps the Shortcut's icon in the share sheet
- **THEN** the Shortcut posts the selection to `POST /cards` with `Authorization: Token <pat>`
- **AND** on `200 OK` the Shortcut shows a success notification
- **AND** the new card appears in the PWA on the user's other devices via the existing sync mechanism

#### Scenario: Shortcut capture without connectivity surfaces an error

- **WHEN** a user invokes the Shortcut while the device is offline
- **THEN** the Shortcut shows an error notification including a message that connectivity is required
- **AND** no card is persisted on device (the Shortcut has no local outbox)

#### Scenario: Shortcut authentication uses a personal access token

- **WHEN** the Shortcut is invoked
- **THEN** the HTTPS request to `POST /cards` carries `Authorization: Token <raw-pat>` (NOT a JWT)
- **AND** the backend authenticates the request via the personal-access-token path (see `sync-service` spec)

#### Scenario: Shortcut failure on revoked token surfaces clearly

- **WHEN** the user has revoked the PAT in the PWA settings, then invokes the Shortcut
- **THEN** the backend returns HTTP 401 and the Shortcut shows a notification asking the user to generate and paste a new PAT
- **AND** no card is persisted

### Requirement: PWA hosts the Shortcut and personal-access-token provisioning

The PWA SHALL provide a "Setup on iPhone" page that:

- Serves the Shortcut as a static asset (`/shortcuts/anki-clip.shortcut`).
- Lets the signed-in user generate a personal access token via `POST /auth/tokens` and copy it to the clipboard.
- Lists existing tokens with their `name`, `created_at`, and `last_used_at`, and lets the user revoke any of them via `DELETE /auth/tokens/:id`.
- Includes step-by-step instructions for installing the Shortcut and pasting the PAT.

#### Scenario: User generates a PAT and installs the Shortcut

- **WHEN** a signed-in user opens the "Setup on iPhone" page in Safari, taps "Generate API Token", and copies the displayed token
- **THEN** the token is persisted on the backend as a `personal_access_tokens` row with the SHA-256 hash, never the raw value
- **AND** the user is shown the raw token exactly once
- **AND** the user taps "Download Shortcut", iOS opens the file in the Shortcuts app, the user pastes the token into the Shortcut's API-token field, and saves

#### Scenario: Revoking a PAT immediately invalidates Shortcut auth

- **WHEN** a user taps "Revoke" on a token row in the PWA
- **THEN** the backend sets `revoked_at` on the corresponding row
- **AND** any subsequent request from the Shortcut carrying that token is rejected with HTTP 401
