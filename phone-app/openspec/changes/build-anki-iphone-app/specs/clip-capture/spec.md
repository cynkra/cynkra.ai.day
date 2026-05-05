## ADDED Requirements

### Requirement: iOS Share Extension accepts text selections

The iOS app SHALL register a Share Extension that appears in the system share sheet for any text-bearing UTI (`public.plain-text`, `public.utf8-plain-text`, `public.rtf`, `public.html`). When invoked, the extension SHALL receive the selected text and create a draft card associated with the signed-in user.

#### Scenario: User shares a selected word from Safari

- **WHEN** a signed-in user selects a word in Safari and taps the app's icon in the iOS share sheet
- **THEN** a draft card is created on device within 1 second containing the selected text and the source URL of the page
- **AND** the card is enqueued for upload to the backend

#### Scenario: User shares from an app that provides only HTML

- **WHEN** a user shares a selection that is delivered as HTML
- **THEN** the extension extracts the visible text and creates a draft card from it
- **AND** the original HTML is discarded after extraction

### Requirement: Share Extension works without a full app launch

The Share Extension SHALL be able to create and persist a draft card without launching the main app process. The user SHALL NOT be required to switch into the main app to complete capture.

#### Scenario: Capture while main app is not running

- **WHEN** the main iOS app is not in the foreground or background and the user invokes the Share Extension
- **THEN** the draft card is persisted to the shared app group container
- **AND** a system notification confirms capture
- **AND** the card appears in the main app the next time it is opened, without re-prompting the user

### Requirement: All client writes go through a local outbox

Every client (iOS app, iOS Share Extension, web client) SHALL persist new and updated records to a durable local outbox before contacting the backend. A background drainer SHALL upload outbox entries to the backend asynchronously, retrying with exponential backoff. Each outbox entry carries a client-supplied `id` so retries are idempotent on the backend.

The outbox SHALL be durable across process restarts: SQLite-backed in the iOS App Group container (so the Share Extension and main app share one outbox), and IndexedDB-backed in the web client.

#### Scenario: Capture while offline persists to outbox

- **WHEN** a user captures a selection on iPhone while the device is offline
- **THEN** the draft card is written to the iOS outbox with `pending_upload` status
- **AND** the user sees the card in their local library view immediately

#### Scenario: Outbox drains when network returns

- **WHEN** network connectivity returns to a device with non-empty outbox entries
- **THEN** the drainer uploads each entry via the appropriate endpoint (`POST /cards`, `PATCH /cards/:id`, etc.)
- **AND** on backend acknowledgement, the outbox entry transitions to `synced` and is eligible for cleanup

#### Scenario: Retry uses the same client-supplied id

- **WHEN** an outbox upload fails with a network error and is retried
- **THEN** the retry sends the same client-supplied `id` as the original attempt
- **AND** the backend persists exactly one record (idempotent)

#### Scenario: Web client write also goes through outbox

- **WHEN** a user creates or edits a card on the web client
- **THEN** the write is persisted to the web outbox (IndexedDB) before any network call
- **AND** the local UI reflects the change immediately, regardless of network status

#### Scenario: Outbox survives process restart

- **WHEN** an iOS or web client process exits with non-empty outbox entries
- **THEN** on the next process start the drainer resumes uploading those entries from the persistent store

### Requirement: Web clipper accepts selections from desktop browsers

The web client SHALL provide a clipping mechanism (browser bookmarklet or extension) that lets a signed-in user send a desktop browser selection to their library as a draft card.

#### Scenario: User clips a code snippet from a desktop browser

- **WHEN** a signed-in user selects a code snippet on a webpage and triggers the clipper
- **THEN** a card is created in the user's library with the selected text and the page URL as source
- **AND** the card appears in the web client's library view without a manual refresh

### Requirement: Captured cards record their origin

Every card created via capture SHALL store the source surface (`ios-share`, `web-clipper`) and, when available, the source URL or app bundle identifier.

#### Scenario: Origin is preserved across sync

- **WHEN** a card is captured on iPhone via the Share Extension from Safari
- **THEN** the persisted card has `source = ios-share` and a non-empty `source_url`
- **AND** the same fields are present when the card is fetched from the web client

### Requirement: Manual card entry without capture

In addition to the Share Extension and web clipper, the iOS app and the web client SHALL each provide a "New card" form that lets a user create a card by typing `source_text` directly, choosing the target deck, and (optionally) supplying `translation` and `explanation`. This path SHALL NOT require any text-selection event.

#### Scenario: User adds a card by typing it on iPhone

- **WHEN** a signed-in user opens the iPhone app, taps "New card", types "Schadenfreude", chooses a deck with `default_enrichment_mode = manual`, types "joy at another's misfortune" as the translation, and saves
- **THEN** a card is persisted with that exact `source_text`, that exact `translation`, `enrichment_mode = manual`, and `status = ready`
- **AND** no LLM and no external translation provider call is made for that card

#### Scenario: User adds a card by typing it on the web

- **WHEN** a signed-in user opens the web client, opens the "New card" form, types `source_text`, selects an enrichment mode of `external`, and saves
- **THEN** a card is created with the chosen mode and the backend invokes the configured external translator (not the LLM) to populate `translation`

### Requirement: Capture flow exposes enrichment-mode choice

When a card is created from any capture surface (Share Extension, web clipper, manual entry form), the user SHALL be able to override the deck's `default_enrichment_mode` for that single card before it is persisted. The Share Extension's UI SHALL keep this control to a single tap so it does not slow down rapid capture.

#### Scenario: Share Extension lets user pick manual on the fly

- **WHEN** a user invokes the Share Extension and, before tapping "Save", changes the enrichment mode from the deck default to `manual`
- **THEN** the persisted card has `enrichment_mode = manual` regardless of the deck's default
- **AND** no provider call is made for that card
