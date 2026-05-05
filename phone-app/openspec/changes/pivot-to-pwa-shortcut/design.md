## Context

The `build-anki-iphone-app` change designed a native iOS app + Share Extension as the primary capture surface, with App-Group-shared SQLite as the local outbox. Apple gates two pieces of that design behind the paid Apple Developer Program ($99/year): App-Store / TestFlight distribution AND the App Group entitlement itself. A free Apple ID can run a Swift app on the developer's own device but cannot use App Groups, which means the Share-Extension-to-main-app outbox handoff cannot be built without paying. We have decided not to pay for the program, indefinitely, so the iOS-native path is structurally unavailable rather than just inconvenient.

Foundation work from `build-anki-iphone-app` is already done: shared canonical types, a Fastify backend scaffold, the database migration with users / auth_methods / decks / cards / etc., JWT issuance, and the per-user-isolation repository pattern (12 of 82 tasks complete). None of that work is wasted by this pivot — only the iOS-native section is replaced.

## Goals / Non-Goals

**Goals:**

- Provide a free, indefinite distribution path that any iPhone user can adopt without an Apple Developer account.
- Preserve the central UX promise of `clip-capture` — "select text on iPhone → flashcard" — through a single tap from the iOS share sheet.
- Keep the PWA, the desktop web client, and the iPhone experience as a single codebase with one outbox model (IndexedDB).
- Authenticate the iOS Shortcut without ever launching a browser flow on every capture.
- Leave the backend's existing JWT-based session for the PWA untouched; PAT support is additive.

**Non-Goals:**

- Re-creating the Share Extension's full UI (mode picker, deck picker, etc.) inside Shortcuts. The Shortcut is a fast capture path; rich editing happens in the PWA after sync.
- Offline capture while the PWA is closed. iOS Safari does not give a PWA reliable background execution; without it we cannot drain an outbox while the app is killed. The Shortcut posts directly to the backend over the network, so capture works even when the PWA is not open, but it requires connectivity at the moment of capture.
- Native iOS notifications, background fetch, badging. The PWA gets web push only, and only on iOS 16.4+ when installed to home screen.
- Importing existing native iOS code from the abandoned design. There is none — the iOS section never started.

## Decisions

### D1. iOS capture is an Apple Shortcut, not a Share Extension

Ship a single `.shortcut` file (built in Apple's Shortcuts app, exported, committed under `phone-app/web/public/shortcuts/`). The Shortcut accepts shared text from the iOS share sheet, prompts the user (optionally) for a deck name, and POSTs to `https://<backend>/cards` with `Authorization: Token <pat>`.

- **Alternatives considered**: AltStore-sideloaded native app (rejected — still needs paid program for App Groups; 7-day re-sign cycle; macOS dependency). PWA-only with no Shortcut (rejected — there is no Web Share Target API on iOS Safari, so the PWA cannot appear in the share sheet). Universal Links + Safari intent handler (rejected — same Web Share Target gap; would require leaving the source app).
- **Rationale**: A Shortcut appears in the iOS share sheet without any Apple Developer account, persists across reinstalls, can be shared via an iCloud URL, and can run a single HTTPS POST. It directly satisfies the share-sheet requirement.
- **Trade-off**: Shortcut UI is constrained (text fields, lists, no rich custom views). Rich editing and enrichment-mode override happen in the PWA after capture, not in the Shortcut.

### D2. The PWA is the only first-class client

The Next.js web client gains a Web App Manifest, a service worker (offline shell + cached library read), and an install prompt. iPhone users add it to home screen; desktop users install via Chrome/Edge. Review, library management, AI deck generation, account settings, and Shortcut provisioning all live in the PWA.

- **Rationale**: One UI codebase across desktop and mobile is significantly cheaper than two. The features that the Share Extension uniquely offered (one-tap capture from any app) are covered by the Shortcut. Everything else the PWA can do equally well or better than a native iOS app.
- **Trade-off**: PWA on iOS has known limits — no background sync that survives app close, web push only on iOS 16.4+, no system-level integrations beyond what Safari exposes. We accept these.

### D3. Authentication for the Shortcut: long-lived Personal Access Tokens (PATs)

Add a `personal_access_tokens` table (`id`, `user_id`, `token_hash`, `name`, `last_used_at`, `created_at`, `revoked_at`) and two endpoints behind the existing JWT middleware: `POST /auth/tokens` (issue) and `DELETE /auth/tokens/:id` (revoke). The PWA's "Setup on iPhone" page calls these, displays the raw token once, and provides a copy-to-clipboard button. The user pastes the token into the Shortcut's "API token" field; the Shortcut stores it in the iOS keychain (Shortcuts' built-in "Get Text from Input → Set Variable" with private storage).

The auth middleware (`backend/src/auth/plugin.ts`) learns to accept `Authorization: Token <raw>` in addition to `Authorization: Bearer <jwt>`. Token verification: SHA-256 the raw token, look up by `token_hash`, reject if `revoked_at IS NOT NULL`, update `last_used_at` (best-effort, non-blocking).

- **Alternatives considered**: Embed the JWT in the Shortcut (rejected — JWTs are short-lived; re-issuing them requires the user to redo the OAuth/passkey flow on phone, which we are explicitly trying to avoid). Device flow OAuth (rejected — too many round-trips for a Shortcut; Shortcut's HTTP support is limited). Static API key per user with no rotation (rejected — PATs are barely more work and revocable).
- **Rationale**: PATs are exactly the right shape for this: long-lived, scoped to one user, individually revocable, and pasteable into a Shortcut once. The backend changes are small (one table, two endpoints, one extra branch in the auth plugin).
- **Trade-off**: A PAT is bearer-equivalent to the JWT. If the user's iPhone is compromised, an attacker can read all the user's flashcards via the API. Mitigated by `last_used_at` (so the user can spot suspicious usage from the PWA settings page) and one-click revocation. Acceptable for a personal flashcard app.

### D4. Sync semantics are unchanged

Cursor-pull (`GET /sync?cursor=…`) and SSE invalidation (`GET /sync/stream`) work the same regardless of whether the caller is the desktop PWA, the iOS PWA, or the Shortcut. The Shortcut is a write-only client (it only POSTs new cards), so it does not participate in sync. The PWA — desktop or installed on iPhone — opens the SSE channel while foregrounded and pulls on each invalidation, exactly as the original design specified.

- **Rationale**: Reusing existing semantics is free. The Shortcut never reads from the backend.

### D5. PWA outbox is the only client-side outbox

The IndexedDB outbox in the PWA covers every PWA write (manual entry, edit, review grade, deck create / update / delete). It does NOT cover Shortcut captures, because the Shortcut runs outside the PWA. A Shortcut capture is a synchronous POST: success or failure is observed immediately by the user via the Shortcut's notification step. If the POST fails (no connectivity, server down), the Shortcut shows an error and the user re-runs it later.

- **Alternatives considered**: Have the Shortcut write to a server-hosted outbox for retry (rejected — duplicates the offline-capture story; Shortcut already gives the user enough signal to retry manually; we'd need a second, server-managed outbox semantic). Have the PWA poll for "pending Shortcut captures" (rejected — the Shortcut and the PWA already share the same backend, so a successful Shortcut POST is just a normal card creation that the PWA's SSE-driven cursor pull surfaces).
- **Trade-off**: Capture-while-offline-and-PWA-closed is gone. We accept this — it was always best-effort on iOS, and the user can either (a) open the PWA before going offline so its outbox is live, or (b) re-run the Shortcut when online.

### D6. Distribution & installation flow

1. User signs in to the PWA in Safari on iPhone.
2. PWA prompts "Install to Home Screen" via a one-time banner (per iOS conventions — there's no Beforeinstallprompt event on iOS Safari, so this is a static instruction card).
3. PWA's "Setup on iPhone" page exposes:
   - "Download Shortcut" button → serves `/shortcuts/anki-clip.shortcut` (a static asset; iOS opens it in the Shortcuts app on tap).
   - "Generate API Token" button → calls `POST /auth/tokens`, displays the raw token once, copy-to-clipboard.
   - Numbered instructions: open the Shortcut in the Shortcuts app, paste the token, save.
4. User shares any text → taps the Shortcut in the share sheet → done.

The `.shortcut` file is built once by hand in Apple's Shortcuts app and exported. It is regenerated only when the API contract changes. We do not generate Shortcuts programmatically — Apple's `.shortcut` format is signed and undocumented; hand-built and committed is the right tradeoff.

### D7. Backend changes are minimal and additive

- One new table (`personal_access_tokens`) added in a new migration (`backend/migrations/<ts>_personal_access_tokens.ts`).
- Two new endpoints (`POST /auth/tokens`, `DELETE /auth/tokens/:id`) registered in `backend/src/auth/routes.ts` behind the existing JWT-required middleware.
- One additional branch in the `onRequest` hook in `backend/src/auth/plugin.ts` that recognizes `Authorization: Token <raw>` and resolves it to a `userId`.
- No change to JWT issuance, no change to the four existing auth methods, no change to per-user isolation.

## Risks / Trade-offs

- **PWA on iOS is a moving target** → Apple has historically restricted PWA capabilities (e.g., the brief "no PWA in EU" episode in 2024). Mitigated by (a) keeping the architecture client-agnostic so a future native client could swap in, and (b) keeping the Shortcut path independent of PWA capability.
- **Shortcut UX is less polished than a Share Extension** → no rich preview, no inline mode picker without an extra prompt, share-sheet icon is generic. Mitigated by exposing mode override and deck assignment in the PWA where editing is rich; the Shortcut is opinionated about "send to default deck, default mode" and the user adjusts later.
- **PAT is a long-lived bearer credential** → leakage risks. Mitigated by `last_used_at`, one-click revoke, and recommending the user generate a fresh PAT per device.
- **Capture-while-offline disappears** → user-visible regression vs. the original design. Mitigated by clear in-PWA messaging on the "Setup on iPhone" page and by the PWA's own IndexedDB outbox handling the offline case for manual entry once the PWA is open.
- **`.shortcut` file is opaque** → if Apple changes the format, our committed shortcut may stop opening on newer iOS. Mitigated by including a plain-text "Build it yourself" recipe in the same setup page so a user can recreate the Shortcut from scratch in 60 seconds.
- **Service-worker bugs strand users** → a bad service-worker deploy on the PWA can lock users out of updates. Mitigated by a kill-switch URL the user can visit to unregister the worker, and a versioned cache that auto-evicts on backend version bumps.

## Migration Plan

1. Mark the `build-anki-iphone-app` change's section 7 (iOS app + Share Extension) as superseded; do not start any of those tasks.
2. Run the additive backend migration introducing `personal_access_tokens`.
3. Extend the auth plugin (`backend/src/auth/plugin.ts`) to accept `Authorization: Token <raw>` in addition to `Bearer <jwt>`. Add `POST /auth/tokens` and `DELETE /auth/tokens/:id` to `backend/src/auth/routes.ts`.
4. Build the PWA shell (manifest, service worker, install instructions) on top of the Next.js scaffold from `build-anki-iphone-app` task 8.1.
5. Build the "Setup on iPhone" page in the PWA.
6. Build the iOS Shortcut once by hand in Apple's Shortcuts app, export, commit to `phone-app/web/public/shortcuts/anki-clip.shortcut`.
7. Smoke-test end-to-end on a real iPhone: install PWA → generate PAT → install Shortcut → capture text → see card in PWA.
8. Update the `phone-app/README.md` so the iOS instructions reference the PWA + Shortcut path, not Xcode.

Rollback: revert the auth-plugin change and drop the migration. The PWA continues to work with JWTs only, and the Shortcut simply stops authenticating until a fix is redeployed.

## Open Questions

- iOS Safari currently allows web push only when the PWA is added to home screen and the user has explicitly granted notification permission. We will surface this in the Setup page, but we should decide whether to *require* push (cleaner cross-device updates) or treat it as optional (keep SSE-while-foregrounded as the only push mechanism on iOS).
- Whether to bundle multiple Shortcuts (e.g., "capture as text", "capture as code", "capture into 'Inbox'") or ship a single multi-prompt Shortcut. Default assumption: one Shortcut, one extra prompt for deck selection that the user can dismiss to fall back to Inbox.
- Should the PAT be scoped (cards-only) or full-account? Default assumption: full-account for now; scope it later if we add more endpoints we'd want to keep off the Shortcut.
