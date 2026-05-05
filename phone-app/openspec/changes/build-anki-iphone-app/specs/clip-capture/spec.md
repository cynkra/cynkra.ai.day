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

### Requirement: Capture queues offline

If the device is offline at the moment of capture, the draft card SHALL be persisted locally and uploaded automatically the next time the device has network connectivity.

#### Scenario: Capture in airplane mode

- **WHEN** a user shares a selection while the device is offline
- **THEN** the draft card is stored in a local queue with a `pending_upload` status
- **AND** when the device regains network, the app uploads the queued card to the backend without user action

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
