## Why

The accepted plan in `build-anki-iphone-app` ships a native iOS app plus a Share Extension. That path requires the Apple Developer Program ($99/year), and the Share Extension's data-sharing design relies on **App Groups**, a capability Apple gates behind the same paid program. We do not want to pay the membership and we want the project to remain runnable end-to-end without it indefinitely (not just for a dev-day demo). A free path that preserves the "select text on iPhone → flashcard" promise is therefore needed before any iOS work begins.

## What Changes

- **BREAKING** Drop the native iOS app and Share Extension targets entirely. The 10 tasks in section 7 of `build-anki-iphone-app/tasks.md` are superseded by this change.
- **BREAKING** Drop the iOS App Group / shared SQLite outbox. iOS no longer has any native local store.
- Make the web client an installable Progressive Web App (PWA). iPhone users install it via Safari's "Add to Home Screen"; the same UI runs on desktop.
- Replace the iOS Share Extension with a published **Apple Shortcut** (`.shortcut` file) that accepts a text selection from the iOS share sheet and posts it to `POST /cards` over HTTPS. The Shortcut is the iOS capture surface; iOS notifications confirm success.
- The PWA's IndexedDB outbox is now the only client-side outbox in the system; iPhone usage rides on the same outbox via the PWA.
- Add **personal access tokens (PATs)**: long-lived bearer tokens that the user generates in the PWA settings page and pastes into the Shortcut once. The backend accepts PATs alongside JWTs on the same endpoints.
- Add a PWA "Setup on iPhone" page that hosts the `.shortcut` download and the PAT issue/revoke UI.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `clip-capture`: Replace the iOS-Share-Extension requirements with iOS-Shortcut-based capture; narrow the durable-outbox requirement to the web client (no native iOS outbox); keep manual entry, web clipper, and enrichment-mode override.
- `web-client`: Add installable-PWA, on-iPhone review/manage, and Shortcut + PAT provisioning requirements.
- `sync-service`: Add a personal-access-token authentication path (alongside JWT); drop the assumption that any non-PWA client exists; keep cursor-pull and SSE invalidation semantics unchanged.

## Impact

- **Deleted** `phone-app/ios/` (Xcode targets, Share Extension, App Group config). Section 7 of `build-anki-iphone-app/tasks.md` becomes a no-op.
- **New** backend dependencies: a `personal_access_tokens` table and `POST /auth/tokens` / `DELETE /auth/tokens/:id` endpoints; the existing auth middleware learns a second header format (`Authorization: Token <pat>` in addition to `Bearer <jwt>`).
- **New** web assets: `phone-app/web/public/shortcuts/anki-clip.shortcut` (built by hand in Apple's Shortcuts app, exported, and committed) plus a "Setup on iPhone" route in the PWA.
- **Modified** web client: PWA manifest, service worker for offline shell + push fallback, install prompt UX.
- **Distribution**: no App Store, no TestFlight, no $99/year. Users install the Shortcut via a `https://www.icloud.com/shortcuts/...`-style link or by opening the `.shortcut` file directly on iOS.
- **Trade-offs documented in `design.md`**: lose offline-while-app-killed capture, lose rich Share-Extension UI (Shortcut UI is constrained), lose UTI-level handling of RTF/HTML beyond what Shortcuts gives us.
