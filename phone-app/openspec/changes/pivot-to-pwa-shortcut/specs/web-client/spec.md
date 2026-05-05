## ADDED Requirements

### Requirement: Web client is an installable PWA on iPhone and desktop

The web client SHALL be a Progressive Web App: it SHALL ship a Web App Manifest, a service worker that caches the application shell for offline-first load, and an icon set suitable for iOS home-screen installation. iPhone users SHALL be able to install it via Safari's "Add to Home Screen"; desktop users SHALL be able to install it via the browser's install affordance where supported (Chrome, Edge, Safari on macOS).

#### Scenario: User installs the PWA on iPhone

- **WHEN** a signed-in user opens the web client in Safari on iPhone, taps Share, and taps "Add to Home Screen"
- **THEN** the PWA is added to the home screen with the configured app name and icon
- **AND** opening the PWA from the home screen launches it standalone (no browser chrome)
- **AND** the user is still signed in (the JWT cookie persists across the install)

#### Scenario: PWA shell loads while offline after first online visit

- **WHEN** a user has visited the PWA online at least once and later opens it while offline
- **THEN** the application shell loads from the service worker's cache
- **AND** the user sees a clear "offline" indicator and any cached library content
- **AND** writes are queued in the IndexedDB outbox per the `clip-capture` spec

### Requirement: PWA supports review and library management on iPhone

The PWA, when installed on iPhone, SHALL allow a user to review cards (`Again`/`Hard`/`Good`/`Easy` grading), view per-deck and library-wide progress, edit cards, switch a card's `enrichment_mode`, and trigger AI deck generation — all without leaving the PWA. The same UI SHALL work on desktop.

#### Scenario: User reviews a Due card on iPhone PWA

- **WHEN** a user opens the iPhone-installed PWA, navigates to a deck with at least one `Due` card, and grades it `Good`
- **THEN** the PWA posts the review through its IndexedDB outbox (synchronously to the backend if online; asynchronously when network returns)
- **AND** the dashboard counts for that deck reflect the new state on the next sync cycle

### Requirement: PWA hosts the Setup-on-iPhone page

The PWA SHALL provide a "Setup on iPhone" page that:

- Serves the iOS Shortcut file (`/shortcuts/anki-clip.shortcut`) as a static asset.
- Generates and revokes personal access tokens via `POST /auth/tokens` and `DELETE /auth/tokens/:id`.
- Displays a one-time view of each newly generated PAT with copy-to-clipboard.
- Lists existing tokens by `name`, `created_at`, `last_used_at`.
- Provides numbered installation instructions for iPhone users.

#### Scenario: Setup page shows the new PAT exactly once

- **WHEN** a user generates a new PAT
- **THEN** the page displays the raw token alongside a "Copy to clipboard" button
- **AND** after the user navigates away from the success view, the raw token is no longer retrievable from the UI
- **AND** the new token appears in the listing as `<name> · created <timestamp> · never used` until the Shortcut first uses it

### Requirement: PWA install flow is discoverable on first iPhone visit

The PWA SHALL show a one-time, dismissible card on first iPhone visit explaining how to install via "Add to Home Screen". Because iOS Safari does not fire the standard `beforeinstallprompt` event, this card SHALL be a static instruction (with a screenshot) rather than a programmatic prompt.

#### Scenario: First-visit install card is shown then dismissed

- **WHEN** a signed-in user opens the web client in Safari on iPhone for the first time
- **THEN** the PWA shows an install instruction card with a "Got it" dismiss control
- **AND** dismissing it persists a flag in `localStorage` so the card does not reappear on subsequent visits

## MODIFIED Requirements

### Requirement: Web client mirrors the iPhone library

The web client (running as a regular browser tab on desktop or as the home-screen-installed PWA on iPhone) SHALL display the signed-in user's decks and cards from the backend. Cards captured via the iOS Shortcut and cards created from any other PWA instance SHALL appear in the web client without requiring any manual action beyond the page being open or refreshed.

#### Scenario: Card captured via Shortcut shows up in PWA

- **WHEN** a signed-in user invokes the iOS Shortcut to capture a selection and the backend has acknowledged the upload
- **THEN** the same user's PWA, on its next sync cycle (within a few seconds while the page is open), displays the card in the appropriate deck
- **AND** the SSE invalidation event for that card is delivered to all of the user's open PWA instances

### Requirement: Web client supports review

The PWA SHALL allow a user — on desktop or on iPhone via the home-screen-installed PWA — to start a review session for a deck and grade cards. Submitting a grade SHALL update the card's scheduling state via the backend (through the IndexedDB outbox) and the dashboard counts SHALL update accordingly.

#### Scenario: Reviewing a Due card moves it to Learned

- **WHEN** a user starts a review session for a deck that has at least one `Due` card and grades that card as correct
- **THEN** the card is no longer counted in `Due`
- **AND** the card is counted in `Learned`
- **AND** the change is reflected on every other open PWA instance (desktop or iPhone) after its next sync
