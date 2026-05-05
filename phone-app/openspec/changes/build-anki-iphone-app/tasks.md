## 1. Project setup

- [x] 1.1 Create directory layout under `phone-app/`: `phone-app/ios/`, `phone-app/backend/`, `phone-app/web/`, `phone-app/shared/`
- [x] 1.2 Initialize TypeScript workspace at `phone-app/` (pnpm or npm) with sub-packages for `backend`, `web`, and `shared`
- [x] 1.3 In `phone-app/shared/`, define the canonical card and deck types (mirrors the schema from `card-content` and `deck-management` specs), including `enrichment_mode` on `Card` and `default_enrichment_mode` on `Deck`; export `schema_version` constant
- [x] 1.4 Set up linting, formatting, and a single CI script that builds backend, web, and shared

## 2. Backend foundations

- [x] 2.1 Scaffold an Express (or Fastify) TypeScript service in `phone-app/backend/`
- [x] 2.2 Add Postgres + a migration tool (e.g. `node-pg-migrate` or `drizzle-kit`); create initial migration with tables: `users`, `auth_methods`, `passkey_credentials`, `magic_link_tokens`, `decks`, `cards`, `llm_usage`, `external_usage`
- [x] 2.3 Implement JWT issuance and verification middleware (rotating signing key); reject unauthenticated requests with HTTP 401; all auth flows mint the same JWT shape
- [x] 2.4 Implement Sign in with Apple: `POST /auth/apple` exchanging the Apple identity token for a JWT and creating/linking the `auth_methods` row
- [x] 2.5 Implement Google OAuth: `GET /auth/google/start` and `GET /auth/google/callback` (PKCE), creating/linking the `auth_methods` row and minting a JWT
- [x] 2.6 Implement passkey (WebAuthn) registration and authentication: `POST /auth/passkey/register/options`, `POST /auth/passkey/register/verify`, `POST /auth/passkey/login/options`, `POST /auth/passkey/login/verify`; persist credentials in `passkey_credentials`
- [x] 2.7 Implement magic-link fallback: `POST /auth/request-link` and `GET /auth/verify` issuing a JWT bound to the user
- [x] 2.8 Add per-user data isolation: every query that touches `decks` or `cards` MUST filter by `owner_id` derived from the JWT; cross-user access returns HTTP 404

## 3. Card and deck APIs (sync-service + card-content + deck-management)

- [ ] 3.1 Implement `POST /cards` accepting a client-supplied `id` (idempotent on retry) and `schema_version`; reject unknown versions with HTTP 400
- [ ] 3.2 Implement `PATCH /cards/:id` for source/translation/explanation/deck updates; only `updated_at`-newer wins (last-write-wins)
- [ ] 3.3 Implement `POST /decks`, `PATCH /decks/:id`, and `DELETE /decks/:id` (reject delete of non-empty deck without a `move_to` or `delete_cards` parameter; HTTP 409 `deck_not_empty`)
- [ ] 3.4 Implement `GET /decks` returning decks grouped by `topic`, with an `Untagged` group for decks with no topic
- [ ] 3.5 Auto-create a per-user `Inbox` deck on first capture if no deck is specified
- [ ] 3.6 Implement `GET /sync?cursor=<opaque>` returning all changes since the cursor and a new cursor; first-call (no cursor) returns full library
- [ ] 3.7 Implement `GET /sync/stream` Server-Sent Events endpoint authenticated by JWT; on every persisted record write (cards, decks, enrichment updates, deck-generation completions), publish `{ entity, id, updated_at }` to all open SSE connections owned by that user; SSE event bodies SHALL NOT carry record payloads
- [ ] 3.8 Wire the SSE publisher into every backend write path (POST/PATCH cards, POST/PATCH/DELETE decks, enrichment worker, deck generator, review endpoint) via a single in-process pub/sub abstraction so no write path can forget to invalidate

## 4. Card content enrichment

- [ ] 4.1 Implement on-device-style content-type detector as a TS module in `phone-app/shared/` so iOS (via FFI or re-implementation) and backend share rules; covers `text` / `formula` / `code` with a confidence score
- [ ] 4.2 Wire backend re-classification: when a card arrives with low-confidence type, call the LLM with a strict classification prompt and persist the result
- [ ] 4.3 Install `pg-boss` and bootstrap its schema in Postgres; configure a single `enrich-card` job queue with retry policy (exponential backoff, max 5 attempts) and a dead-letter handler that sets the card's `status = failed` with `last_error` populated
- [ ] 4.4 Implement the enrichment worker as a pg-boss subscriber: when a card transitions to `status = enriching`, enqueue an `enrich-card` job; the worker generates `translation` and `explanation` via three prompt templates (one per content type) parameterised by the deck's `target_language` and `explanation_style`
- [ ] 4.5 On enrichment failure (after pg-boss has exhausted retries), set `status = failed` and `last_error`; expose `POST /cards/:id/retry` to re-enqueue
- [ ] 4.6 Implement per-user daily LLM budget: enforce before any provider call; return HTTP 429 with `daily_budget_exceeded` and reset timestamp; record usage in `llm_usage`
- [ ] 4.7 Define a single backend `enrich(card)` interface with three implementations: `manual` (no-op), `external` (Google Translate), `llm` (Claude); dispatch by `card.enrichment_mode`
- [ ] 4.8 Implement Google Translate adapter: API key from env, target language from the deck, populates `translation` only; expose configuration knob to swap to another non-LLM provider later
- [ ] 4.9 Reject `enrichment_mode = external` for `content_type` of `formula` or `code` with HTTP 400 `external_mode_unsupported_for_content_type`
- [ ] 4.10 Skip the enrichment worker entirely for `enrichment_mode = manual`: card transitions `draft → ready` on user save (including with empty `translation`/`explanation`); never invoke any provider
- [ ] 4.11 Add a separate per-user daily *external* budget independent from the LLM budget; record usage in `external_usage`; 429 on exhaustion
- [ ] 4.12 Implement `PATCH /cards/:id` mode change that updates `enrichment_mode` without re-enriching; ensure `POST /cards/:id/retry` uses the card's *current* mode

## 5. Study engine

- [ ] 5.1 Add FSRS scheduling fields to the `cards` migration: `stability` (float, nullable), `difficulty` (float, nullable), `srs_state` (enum: `new`, `learning`, `review`, `relearning`; default `new`), `step` (integer, default 0), `last_reviewed_at` (nullable), `next_due_at` (nullable)
- [ ] 5.2 Add `ts-fsrs` (or equivalent FSRS-4.5 reference implementation) as a dependency; wrap it in a `scheduleReview(card, grade)` function that takes the four-button grade (`Again`/`Hard`/`Good`/`Easy`) and returns the new FSRS state plus `next_due_at`
- [ ] 5.3 Implement `POST /cards/:id/review` accepting a `grade` of `Again` | `Hard` | `Good` | `Easy`; apply `scheduleReview`; persist the new FSRS state and emit an SSE invalidation event
- [ ] 5.4 Implement bucket classifier and `GET /decks/:id/progress` returning `{ new, learned, due }`; ensure `enriching` and `failed` cards are excluded
- [ ] 5.5 Implement `GET /progress` returning library-wide bucket counts

## 6. AI deck generation

- [ ] 6.1 Define a strict JSON schema for the LLM response (deck name, topic, list of cards with `source_text` + `content_type`)
- [ ] 6.2 Implement `POST /decks/generate` accepting `{ prompt, target_language?, max_cards? }` (default 20, max 100); enforce per-user daily LLM budget before any provider call
- [ ] 6.3 On valid LLM response: persist deck and all cards in a single transaction with `status = ready`, `translation`/`explanation` populated, scheduling state at defaults; return the deck and cards
- [ ] 6.4 On invalid LLM response: return HTTP 422 `generation_invalid_output` with reason and truncated raw output; persist nothing
- [ ] 6.5 Disambiguate deck name on collision (`(2)`, `(3)`, ...); never merge into an existing deck

## 7. iOS app and Share Extension (clip-capture)

- [ ] 7.1 Create the iOS app and Share Extension targets in Xcode under `phone-app/ios/`; configure a shared App Group container so the extension and main app share one local database
- [ ] 7.2 Implement Share Extension that registers for plain-text, UTF-8 plain-text, RTF, and HTML UTIs; for HTML, extract visible text and discard the markup
- [ ] 7.3 Implement a SQLite-backed local outbox in the App Group container; the Share Extension and main app both write new and updated records to the outbox before any network call
- [ ] 7.4 Implement an outbox drainer in the main app: on app launch, on background refresh, and on network availability change, upload pending entries via the appropriate endpoint with idempotent client-supplied `id`s and exponential-backoff retries
- [ ] 7.5 Implement local sync mirror: pull via `GET /sync?cursor=...` on app foreground; cache records to the SQLite store for offline read
- [ ] 7.6 Implement SSE consumer: while the app is foregrounded, hold an open `GET /sync/stream` connection and trigger a cursor pull on each invalidation event
- [ ] 7.7 Implement deck list, card list, and review UI on iOS so review (`Again`/`Hard`/`Good`/`Easy` grading) is possible on phone
- [ ] 7.8 Add an enrichment-mode picker to the Share Extension UI (single tap to override deck default to `manual` / `external` / `llm`); persist the chosen mode on the outbox entry
- [ ] 7.9 Add a "New card" form in the iOS main app for typing `source_text`, `translation`, `explanation` and choosing the deck and mode without going through the share sheet
- [ ] 7.10 Add a per-card mode-change action (e.g. swipe action or detail-view control) that calls `PATCH /cards/:id` (via the outbox) to switch `enrichment_mode`; offer "Re-enrich now" as a separate action

## 8. Web client (web-client)

- [ ] 8.1 Scaffold Next.js app in `phone-app/web/` consuming `phone-app/shared/` types
- [ ] 8.2 Implement sign-in surface offering passkey (WebAuthn) as the primary affordance, Google OAuth as the secondary, and magic-link as the fallback; persist the JWT in an HTTP-only cookie
- [ ] 8.3 Implement an IndexedDB-backed outbox; every write (create card, edit card, review, deck create/update/delete, manual entry) is persisted locally first and drained to the backend asynchronously with idempotent client-supplied `id`s and exponential-backoff retries
- [ ] 8.4 Implement library view: list of decks grouped by topic; deck view: list of cards with visible distinction for `enriching` and `failed` statuses (with retry control on `failed`)
- [ ] 8.5 Implement dashboard: per-deck and library-wide `New` / `Learned` / `Due` counts
- [ ] 8.6 Implement review session: pull a deck's `Due` and `New` cards; grade with `Again`/`Hard`/`Good`/`Easy`; post review through the outbox; refresh dashboard counts
- [ ] 8.7 Implement AI deck generation UI: prompt input, in-progress state, navigation to the new deck on success, error surfacing on 422 / 429
- [ ] 8.8 Implement SSE consumer: while a tab is foregrounded, hold an open `GET /sync/stream` connection and trigger a cursor pull on each invalidation event; on background, suspend the SSE and resume on tab focus
- [ ] 8.9 Implement web clipper (browser extension preferred, bookmarklet as a stopgap): captures the current selection and page URL and writes a card to the outbox with `source = web-clipper`
- [ ] 8.10 Add a "New card" form in the web client for typing `source_text`, `translation`, `explanation` and choosing the deck and `enrichment_mode`
- [ ] 8.11 Surface the per-card `enrichment_mode` in the deck and card views, with an inline control to switch mode and a separate "Re-enrich" button
- [ ] 8.12 Add a deck settings panel that lets the user set `default_enrichment_mode` for the deck
- [ ] 8.13 Add an account settings page where the user can register additional auth methods (e.g. add a passkey to an account that signed up with Google) and revoke them

## 9. End-to-end verification

- [ ] 9.1 Local end-to-end: capture a word on iPhone simulator → confirm card appears in web client within 5 seconds
- [ ] 9.2 Local end-to-end: trigger AI deck generation for "Create a deck with basic formulas describing OLS" → confirm deck and cards are created and reviewable
- [ ] 9.3 Local end-to-end: review a `Due` card on web → confirm it moves to `Learned` and the change is reflected on iPhone after sync
- [ ] 9.4 Verify per-user isolation: with two test users, confirm user A cannot fetch user B's card (HTTP 404)
- [ ] 9.5 Verify schema-version rejection: send a payload with an unknown `schema_version` and confirm HTTP 400 `unsupported_schema_version`
- [ ] 9.6 Verify manual mode end-to-end: create a card with `enrichment_mode = manual` (typed by hand), confirm no LLM and no Google Translate call is recorded in usage tables, and the card is reviewable
- [ ] 9.7 Verify external mode end-to-end: create a `text` card with `enrichment_mode = external`, confirm Google Translate is called (not the LLM) and `translation` is populated
- [ ] 9.8 Verify external-mode rejection: attempt to create a `code` card with `enrichment_mode = external`; confirm HTTP 400 `external_mode_unsupported_for_content_type`
- [ ] 9.9 Verify SSE invalidation: open the web client (SSE connected), capture a card on iPhone simulator, assert the web client receives an `{ entity, id, updated_at }` event within 1 second and renders the card after its cursor pull
- [ ] 9.10 Verify outbox durability: take an iOS client offline, capture three cards, kill and relaunch the app while still offline, then bring the app online; assert all three cards reach the backend exactly once
- [ ] 9.11 Verify FSRS scheduling: given a card in a known FSRS state, apply each of `Again`/`Hard`/`Good`/`Easy` and assert `next_due_at` matches the `ts-fsrs` reference output within tolerance
- [ ] 9.12 Verify multi-method auth: sign in once via Sign in with Apple, once via Google OAuth, once via passkey, once via magic-link; confirm all four mint a JWT that authorizes the same set of resources for the same user

## 10. Deploy and document

- [ ] 10.1 Deploy backend + Postgres to staging; configure `ANTHROPIC_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, Sign in with Apple service ID + private key, Google OAuth client id/secret, JWT signing keys, and pg-boss schema
- [ ] 10.2 Deploy web client to staging pointing at staging backend
- [ ] 10.3 Push iOS build to TestFlight pointing at staging backend; run the Share Extension end-to-end
- [ ] 10.4 Cut over to production; document rollback (redeploy previous backend image; clients are forward-compatible thanks to `schema_version`)
- [ ] 10.5 Add a short `phone-app/README.md` summarising local dev, env vars (LLM, Google Translate, OAuth providers, JWT signing keys), the three enrichment modes, the auth methods, the SSE channel, and the daily LLM and external-translator budget knobs
