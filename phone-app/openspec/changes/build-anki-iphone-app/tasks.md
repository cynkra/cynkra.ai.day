## 1. Project setup

- [ ] 1.1 Create directory layout under `phone-app/`: `phone-app/ios/`, `phone-app/backend/`, `phone-app/web/`, `phone-app/shared/`
- [ ] 1.2 Initialize TypeScript workspace at `phone-app/` (pnpm or npm) with sub-packages for `backend`, `web`, and `shared`
- [ ] 1.3 In `phone-app/shared/`, define the canonical card and deck types (mirrors the schema from `card-content` and `deck-management` specs); export `schema_version` constant
- [ ] 1.4 Set up linting, formatting, and a single CI script that builds backend, web, and shared

## 2. Backend foundations

- [ ] 2.1 Scaffold an Express (or Fastify) TypeScript service in `phone-app/backend/`
- [ ] 2.2 Add Postgres + a migration tool (e.g. `node-pg-migrate` or `drizzle-kit`); create initial migration with tables: `users`, `decks`, `cards`, `magic_link_tokens`, `llm_usage`
- [ ] 2.3 Implement JWT issuance and verification middleware; reject unauthenticated requests with HTTP 401
- [ ] 2.4 Implement magic-link auth: `POST /auth/request-link` and `GET /auth/verify` that issues a JWT bound to the user
- [ ] 2.5 Add per-user data isolation: every query that touches `decks` or `cards` MUST filter by `owner_id` derived from the JWT; cross-user access returns HTTP 404

## 3. Card and deck APIs (sync-service + card-content + deck-management)

- [ ] 3.1 Implement `POST /cards` accepting a client-supplied `id` (idempotent on retry) and `schema_version`; reject unknown versions with HTTP 400
- [ ] 3.2 Implement `PATCH /cards/:id` for source/translation/explanation/deck updates; only `updated_at`-newer wins (last-write-wins)
- [ ] 3.3 Implement `POST /decks`, `PATCH /decks/:id`, and `DELETE /decks/:id` (reject delete of non-empty deck without a `move_to` or `delete_cards` parameter; HTTP 409 `deck_not_empty`)
- [ ] 3.4 Implement `GET /decks` returning decks grouped by `topic`, with an `Untagged` group for decks with no topic
- [ ] 3.5 Auto-create a per-user `Inbox` deck on first capture if no deck is specified
- [ ] 3.6 Implement `GET /sync?cursor=<opaque>` returning all changes since the cursor and a new cursor; first-call (no cursor) returns full library

## 4. Card content enrichment

- [ ] 4.1 Implement on-device-style content-type detector as a TS module in `phone-app/shared/` so iOS (via FFI or re-implementation) and backend share rules; covers `text` / `formula` / `code` with a confidence score
- [ ] 4.2 Wire backend re-classification: when a card arrives with low-confidence type, call the LLM with a strict classification prompt and persist the result
- [ ] 4.3 Implement enrichment worker (in-process for v1): when a card transitions to `status = enriching`, generate `translation` and `explanation` via three prompt templates (one per content type) parameterised by the deck's `target_language` and `explanation_style`
- [ ] 4.4 On enrichment failure, set `status = failed` and `last_error`; expose `POST /cards/:id/retry` to re-enqueue
- [ ] 4.5 Implement per-user daily LLM budget: enforce before any provider call; return HTTP 429 with `daily_budget_exceeded` and reset timestamp; record usage in `llm_usage`

## 5. Study engine

- [ ] 5.1 Add scheduling fields (`interval_days`, `ease`, `last_reviewed_at`, `next_due_at`) to the `cards` migration
- [ ] 5.2 Implement SM-2-lite update function: given the previous state and a grade, return the new `interval_days`, `ease`, and `next_due_at`
- [ ] 5.3 Implement `POST /cards/:id/review` that applies the update and persists new state
- [ ] 5.4 Implement bucket classifier and `GET /decks/:id/progress` returning `{ new, learned, due }`; ensure `enriching` and `failed` cards are excluded
- [ ] 5.5 Implement `GET /progress` returning library-wide bucket counts

## 6. AI deck generation

- [ ] 6.1 Define a strict JSON schema for the LLM response (deck name, topic, list of cards with `source_text` + `content_type`)
- [ ] 6.2 Implement `POST /decks/generate` accepting `{ prompt, target_language?, max_cards? }` (default 20, max 100); enforce per-user daily LLM budget before any provider call
- [ ] 6.3 On valid LLM response: persist deck and all cards in a single transaction with `status = ready`, `translation`/`explanation` populated, scheduling state at defaults; return the deck and cards
- [ ] 6.4 On invalid LLM response: return HTTP 422 `generation_invalid_output` with reason and truncated raw output; persist nothing
- [ ] 6.5 Disambiguate deck name on collision (`(2)`, `(3)`, ...); never merge into an existing deck

## 7. iOS app and Share Extension (clip-capture)

- [ ] 7.1 Create the iOS app and Share Extension targets in Xcode under `phone-app/ios/`; configure a shared App Group container
- [ ] 7.2 Implement Share Extension that registers for plain-text, UTF-8 plain-text, RTF, and HTML UTIs; for HTML, extract visible text and discard the markup
- [ ] 7.3 In the extension, persist a draft card to the shared App Group container including `source_text`, `source_url` (when available), `source = ios-share`; show a system-style confirmation
- [ ] 7.4 Implement upload queue in the main app: read drafts from the App Group on launch and on background refresh; upload via `POST /cards` with idempotent client-supplied `id`
- [ ] 7.5 Implement offline behaviour: drafts created without network stay in `pending_upload` until connectivity returns
- [ ] 7.6 Implement local sync mirror: pull via `GET /sync?cursor=...` on app foreground; cache to a SQLite store for offline read
- [ ] 7.7 Implement deck list, card list, and review UI on iOS (so review is possible on phone, per design.md open question default)

## 8. Web client (web-client)

- [ ] 8.1 Scaffold Next.js app in `phone-app/web/` consuming `phone-app/shared/` types
- [ ] 8.2 Implement magic-link sign-in flow against the backend
- [ ] 8.3 Implement library view: list of decks grouped by topic; deck view: list of cards with visible distinction for `enriching` and `failed` statuses (with retry control on `failed`)
- [ ] 8.4 Implement dashboard: per-deck and library-wide `New` / `Learned` / `Due` counts
- [ ] 8.5 Implement review session: pull a deck's `Due` and `New` cards, grade them, post to `/cards/:id/review`, refresh dashboard counts
- [ ] 8.6 Implement AI deck generation UI: prompt input, in-progress state, navigation to the new deck on success, error surfacing on 422 / 429
- [ ] 8.7 Implement near-real-time sync polling (e.g. every 5s while tab is foregrounded) using the cursor endpoint
- [ ] 8.8 Implement web clipper (browser bookmarklet to start; extension if time allows): captures the current selection and page URL and posts a card with `source = web-clipper`

## 9. End-to-end verification

- [ ] 9.1 Local end-to-end: capture a word on iPhone simulator → confirm card appears in web client within 5 seconds
- [ ] 9.2 Local end-to-end: trigger AI deck generation for "Create a deck with basic formulas describing OLS" → confirm deck and cards are created and reviewable
- [ ] 9.3 Local end-to-end: review a `Due` card on web → confirm it moves to `Learned` and the change is reflected on iPhone after sync
- [ ] 9.4 Verify per-user isolation: with two test users, confirm user A cannot fetch user B's card (HTTP 404)
- [ ] 9.5 Verify schema-version rejection: send a payload with an unknown `schema_version` and confirm HTTP 400 `unsupported_schema_version`

## 10. Deploy and document

- [ ] 10.1 Deploy backend + Postgres to staging; configure `ANTHROPIC_API_KEY`
- [ ] 10.2 Deploy web client to staging pointing at staging backend
- [ ] 10.3 Push iOS build to TestFlight pointing at staging backend; run the Share Extension end-to-end
- [ ] 10.4 Cut over to production; document rollback (redeploy previous backend image; clients are forward-compatible thanks to `schema_version`)
- [ ] 10.5 Add a short `phone-app/README.md` summarising local dev, env vars, and the daily LLM budget knob
