## 1. Supersede the iOS-native plan

- [x] 1.1 In `phone-app/openspec/changes/build-anki-iphone-app/tasks.md`, mark every task in section 7 (7.1-7.10) as superseded with a note `[superseded by pivot-to-pwa-shortcut]`. Do NOT delete them; archival of `build-anki-iphone-app` will record the supersedure.
- [x] 1.2 Remove the `phone-app/ios/.gitkeep` placeholder and the `phone-app/ios/` directory itself; remove the `ios/` ignore lines from `phone-app/.gitignore` and `phone-app/.prettierignore`.
- [ ] 1.3 Update `phone-app/README.md` (when section 10 of `build-anki-iphone-app` writes it, this task lands there) so the iPhone instructions reference the PWA + Shortcut path, not Xcode.

## 2. Backend: personal access tokens

- [x] 2.1 Add a new `node-pg-migrate` migration `phone-app/backend/migrations/<ts>_personal_access_tokens.ts` that creates `personal_access_tokens(id uuid pk, user_id uuid not null fk users on delete cascade, token_hash bytea not null unique, name text not null, created_at timestamptz not null default now(), last_used_at timestamptz, revoked_at timestamptz)` and indexes `(user_id, revoked_at)`.
- [x] 2.2 Add `phone-app/backend/src/auth/pat.ts` exporting `issueToken(db, userId, name)` (returns the raw token once; persists only the SHA-256 hash) and `verifyToken(db, raw)` (returns `userId | null`; updates `last_used_at` best-effort, refuses revoked tokens).
- [x] 2.3 In `phone-app/backend/src/auth/plugin.ts`, extend the `onRequest` hook so that when `Authorization: Token <raw>` is present and no `Bearer` JWT is, the hook resolves `req.userId` via `verifyToken`. Reject malformed/unknown/revoked tokens with HTTP 401 using the same response shape as the JWT branch.
- [x] 2.4 In `phone-app/backend/src/auth/routes.ts`, add `POST /auth/tokens` (JWT-required; body `{ name }`; returns `{ id, name, raw_token, created_at }` exactly once) and `DELETE /auth/tokens/:id` (JWT-required; sets `revoked_at`). Both endpoints MUST reject `Authorization: Token` callers with HTTP 401 (PATs cannot manage other PATs).
- [x] 2.5 Add `GET /auth/tokens` (JWT-required) returning `{ tokens: [{ id, name, created_at, last_used_at, revoked_at }] }` for the user's own tokens.
- [x] 2.6 Add a unit test `phone-app/backend/src/auth/pat.test.ts` covering: issuance returns raw once and stores only the hash; verification accepts a valid token; verification rejects a revoked token; verification rejects a token whose hash does not match any row; revocation is idempotent; `last_used_at` is updated on a successful verify.
- [x] 2.7 Add a unit test `phone-app/backend/src/auth/plugin.test.ts` covering: `Authorization: Bearer <jwt>` still works; `Authorization: Token <raw>` works for non-PAT-management endpoints; `Authorization: Token <raw>` is rejected on `POST /auth/tokens` and `DELETE /auth/tokens/:id`; an unknown token returns HTTP 401.

## 3. Backend: cards endpoint accepts Shortcut payloads

- [x] 3.1 Confirm `POST /cards` (defined in `build-anki-iphone-app` section 3.1) works when authenticated via PAT. If `POST /cards` is not yet implemented, add a minimal version that accepts `{ id, source_text, source_url?, content_type?, deck_id?, schema_version }` and creates a draft card under the authenticated user, applying the deck's `default_enrichment_mode` per the existing `card-content` spec. Auto-create the per-user `Inbox` deck on first use if `deck_id` is omitted.
- [x] 3.2 Add an integration test `phone-app/backend/src/routes/cards-pat.test.ts` (or extend the existing cards test): POST a card with `Authorization: Token <pat>`, assert the row is owned by the PAT's user, assert the deck defaults to `Inbox`.
- [x] 3.3 Reject `enrichment_mode = external` for `content_type` of `formula` or `code` exactly as `card-content` requires (defers to existing `build-anki-iphone-app` task 4.9 for the actual rejection logic; this change adds no new validation rules).

## 4. Web client: PWA shell

- [ ] 4.1 In `phone-app/web/`, scaffold a Web App Manifest at `public/manifest.webmanifest` with name, short_name, start_url `/`, display `standalone`, theme_color, background_color, and icon set (192x192, 512x512, plus iOS-specific 180x180 apple-touch-icon).
- [ ] 4.2 Reference the manifest from the root layout (`<link rel="manifest" href="/manifest.webmanifest">`); add iOS-specific tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`).
- [ ] 4.3 Implement a service worker at `public/service-worker.js` (or via `next-pwa` / Workbox) that caches the application shell with a stale-while-revalidate strategy. The cache version SHALL be tied to the build hash so a deploy invalidates stale shells.
- [ ] 4.4 Register the service worker from a client-only React component on first mount; expose a kill-switch URL (`/sw-unregister`) that calls `navigator.serviceWorker.getRegistration()` then `.unregister()` for users stranded on a bad service worker.
- [ ] 4.5 Add an offline indicator that listens to `navigator.onLine` and `online`/`offline` events; show a non-blocking banner when offline; do not block the UI.
- [ ] 4.6 Add a one-time iPhone install instruction card: shown only on iOS Safari (UA sniff is fine here) and only if the user has not yet dismissed it; persist dismissal in `localStorage` under `pwa-install-dismissed-v1`.

## 5. Web client: Setup-on-iPhone page

- [ ] 5.1 Add a `/settings/iphone` route in the PWA (Next.js page) that requires authentication.
- [ ] 5.2 On that page, render numbered installation instructions (Add to Home Screen → Generate API Token → Download Shortcut → paste token → done) with screenshots/icons.
- [ ] 5.3 Render a list of the user's existing tokens via `GET /auth/tokens`, showing `name`, `created_at`, `last_used_at`, and a "Revoke" button per row that calls `DELETE /auth/tokens/:id` and refreshes the list.
- [ ] 5.4 Render a "Generate API Token" form (`name` input + submit) that calls `POST /auth/tokens` and, on success, displays the raw token alongside a copy-to-clipboard button. After the user navigates away from the success view, the raw token MUST NOT be retrievable from the UI.
- [ ] 5.5 Render a "Download Shortcut" link that points to `/shortcuts/anki-clip.shortcut` (a static asset).

## 6. iOS Shortcut

- [ ] 6.1 Build the Shortcut once by hand in Apple's Shortcuts app on iPhone or iPad: receive shared text, prompt for an optional deck name (default `Inbox`), POST to `https://<backend>/cards` with body `{ id: <uuid generated in shortcut>, source_text: <shared text>, source_url: <shared URL or empty>, schema_version: 1 }` and header `Authorization: Token <stored PAT>`, show a success or error notification based on HTTP status.
- [ ] 6.2 Store the PAT inside the Shortcut as a private dictionary value (not as plain text in a comment); store the backend host as a separate dictionary value so the Shortcut can be re-used across staging and production.
- [ ] 6.3 Export the Shortcut to a `.shortcut` file via the iOS Shortcuts app and commit to `phone-app/web/public/shortcuts/anki-clip.shortcut`.
- [ ] 6.4 Add a sibling `phone-app/web/public/shortcuts/README.md` that explains, step by step, how to rebuild the Shortcut from scratch in case Apple changes the file format. Include the exact actions, the JSON body shape, and the auth header format.

## 7. Verification

- [ ] 7.1 Local end-to-end: install the PWA on a real iPhone via Safari "Add to Home Screen", sign in, generate a PAT, install the Shortcut, capture text from Safari, confirm the new card appears in the PWA within 5 seconds via SSE-driven cursor pull.
- [ ] 7.2 Verify PAT scoping: invoke the Shortcut with user A's PAT and request a card whose `owner_id` is user B (via a debug HTTP client, not the Shortcut). Confirm HTTP 404.
- [ ] 7.3 Verify revocation: revoke the PAT in the PWA, invoke the Shortcut, confirm HTTP 401 and a clear iOS notification.
- [ ] 7.4 Verify offline-PWA behavior: take the iPhone offline, open the home-screen-installed PWA, create a card via "New card", confirm the card is queued in IndexedDB; bring the device online, confirm the card uploads via the existing outbox drainer.
- [ ] 7.5 Verify offline-Shortcut behavior: take the iPhone offline, invoke the Shortcut, confirm an iOS error notification and that no card is persisted on device or backend.
- [ ] 7.6 Verify install instruction card: load the PWA on iPhone for the first time, confirm the card appears; dismiss it; refresh; confirm the card does NOT appear.

## 8. Documentation

- [ ] 8.1 Update `phone-app/README.md` env-vars section to remove anything Apple-Developer-Program-specific (Apple service ID, Apple private key) from required-for-iOS to optional-for-Sign-in-with-Apple-on-web; clarify that the iPhone path requires only the PWA + the Shortcut.
- [ ] 8.2 Add a "Distribution" section to `phone-app/README.md` documenting that the project is intentionally App-Store-free, why (cost of the Apple Developer Program), and how iPhone users install (Add to Home Screen + Shortcut).
- [ ] 8.3 Cross-link the PWA's "Setup on iPhone" page from the project README and from the PWA's main navigation under Settings.
