## Context

This is the first feature in a green-field repository (`phone-app/`). There is no existing iOS app, backend, or web client to integrate with. The change establishes seven capabilities at once (`clip-capture`, `card-content`, `deck-management`, `study-engine`, `ai-deck-generation`, `sync-service`, `web-client`), so the design must pin down enough cross-cutting choices — language stack, data model boundary, sync semantics, LLM contract — that each capability spec can be written and implemented without re-litigating them.

The user-visible workflow is: user selects text on iPhone → Share Extension → card appears in app and (after sync) on desktop web view → AI annotates with translation/explanation → card lands in a deck → study engine schedules it under `New` / `Learned` / `Due`. A separate "AI deck generation" path takes a free-form prompt and produces a populated deck.

Constraints inherited from the project:
- Anthropic Claude is the assumed LLM provider (matches `cliproxyapi`/`ANTHROPIC_API_KEY` setup in the repo `README.md`).
- Code lives under `phone-app/`; the existing `indietypst/` folder is unrelated to this change.

## Goals / Non-Goals

**Goals:**
- A single canonical card data model shared by iOS, backend, and web — no per-client variants of "what a card is".
- Capture-to-card latency on device under ~1 second for plain text (LLM enrichment may complete asynchronously).
- iPhone and desktop web views show the same library; a card created on iPhone is visible on web within a few seconds of sync.
- Spaced-repetition state for every card resolves to exactly one of `New`, `Learned`, `Due` so the progress dashboard is unambiguous.
- AI deck generation produces a fully reviewable deck (no half-empty cards) or fails loudly.
- Establish patterns (auth, sync, LLM calls) that subsequent changes can extend without rewriting.
- Make enrichment optional and pluggable: a card can be created and reviewed end-to-end without ever calling an LLM, and the LLM can be swapped for a non-LLM translator (Google Translate) on a per-card basis.

**Non-Goals:**
- Android, iPad-optimized UI, or a desktop-native (non-web) client.
- Field-level conflict resolution / CRDTs — single-user editing makes record-level last-write-wins on `updated_at` sufficient. (Offline *capture* IS in scope; see D3.)
- Importing existing Anki `.apkg` decks — deferred to a separate change.
- Audio and image cards — this change covers text, formula (rendered as TeX), and code; new content types are deferred to a separate change.
- Collaborative or shared decks between users — deferred to a separate change.
- Production-grade observability, billing, and rate-limiting — out of scope for this change. The per-user daily budget hooks (D9, D11) are designed so they can be replaced by a richer system later without a schema change.

## Decisions

### D1. Stack: SwiftUI iOS app + Node/TypeScript backend + Next.js web client

Choose SwiftUI for the iOS app (Share Extension is first-class on iOS only), a single TypeScript backend service for sync + AI orchestration, and Next.js for the web client so it can share TypeScript types with the backend.

- **Alternatives considered:** React Native for the phone app (rejected — Share Extension support on iOS through RN is fragile and we want a native share sheet); Python/FastAPI backend (rejected — would force a second type system; TS lets backend and web share the card schema verbatim).
- **Rationale:** A native iOS Share Extension is the central UX promise of `clip-capture`; that pins us to Swift for the phone. Sharing types between backend and web is the next-biggest leverage point, which pins those two to TypeScript.

### D2. One canonical card schema, owned by the backend

The backend defines the card type (id, owner, deck_id, source content, content_type, translation, scheduling state, timestamps) and exposes it via a typed REST API. iOS and web both consume this schema; iOS has a thin local mirror for offline read of already-synced cards.

- **Rationale:** Keeps `card-content` and `sync-service` from drifting. Three independent definitions of "what a card is" is the most likely failure mode for this design.
- **Trade-off:** Schema changes require coordinated client updates; mitigated by a `schema_version` field on every payload and a backend that rejects unknown versions explicitly.

### D3. Sync model: server-authoritative, cursor pull + SSE invalidation, client outbox

The backend is the source of truth. Three pieces, working together:

1. **Pull**: clients call `GET /sync?cursor=<opaque>` to fetch all changes since their cursor. The cursor is the durable, replayable mechanism.
2. **Push (server → client)**: clients also open one Server-Sent Events connection per session at `GET /sync/stream`. The backend pushes lightweight invalidation events `{ entity, id, updated_at }` to all of the user's connected clients; on receipt, the client triggers an immediate cursor pull. This is what delivers the proposal's "as soon as I add it" promise without a polling loop.
3. **Outbox (client → server)**: every client write — capture, manual entry, edit, review — goes first to a local outbox keyed by client-supplied id, and the outbox drains to the backend asynchronously with idempotent retries. Clients work offline; the backend never sees partial writes.

No bidirectional websockets, no CRDTs. Conflict resolution remains record-level last-write-wins on `updated_at`.

- **Alternatives considered:** Bidirectional WebSocket (rejected — SSE is sufficient because the only thing the server needs to push is "something changed; come pull"; SSE is simpler operationally and survives proxies); CRDT (rejected — single-user editing does not warrant the complexity); polling without SSE (rejected — battery cost on mobile and a worse "instant" feel on desktop).
- **Rationale:** Cursor pull is the durable foundation (idempotent, replayable). SSE solves the latency promise without giving up that foundation. The outbox makes offline a designed feature rather than an exception.

### D4. Content-type detection in two stages

When a card is captured: (1) a fast deterministic classifier on device picks one of `text`, `formula`, `code` from heuristics (LaTeX delimiters, fenced code, language detection); (2) the backend re-validates with the LLM only if the local classifier is uncertain (confidence below a threshold).

- **Rationale:** Keeps capture latency low for the common case (plain word) and uses the LLM only when it earns its keep. Avoids paying LLM cost on every clip.

### D5. Translation/explanation prompt is per-content-type, not per-card

The backend stores three prompt templates (one per content type). The user's per-deck "target language / explanation style" fills the template. This means a deck-level setting change does not require recomputing every card unless the user explicitly asks to re-translate.

- **Rationale:** Predictable LLM output, easier to test, and lets us cache by `(content_hash, content_type, target_style)`.

### D6. Study-engine state machine: FSRS-4.5 mapped to three buckets

Use **FSRS-4.5** (Free Spaced Repetition Scheduler) as the underlying scheduling algorithm — the same algorithm Anki has shipped since 2023 — with the published default parameters. Each card stores the FSRS state: `stability` (float), `difficulty` (float), `state` (enum: `New`, `Learning`, `Review`, `Relearning`), `step` (integer, used during Learning/Relearning), `last_reviewed_at`, `next_due_at`.

The dashboard buckets are derived from `last_reviewed_at` and `next_due_at` and are therefore agnostic to the underlying algorithm:
- `New` — `last_reviewed_at` is null.
- `Due` — `last_reviewed_at` is not null AND `next_due_at <= now`.
- `Learned` — `last_reviewed_at` is not null AND `next_due_at > now`.

Reviews are graded on FSRS's standard four-button scale: `Again`, `Hard`, `Good`, `Easy`.

- **Alternatives considered:** SM-2 / SM-2-lite (rejected — FSRS materially outperforms SM-2 on retention curves and is now the de-facto default in the spaced-repetition community; the published defaults work without per-user training); custom heuristic scheduler (rejected — no reason to invent one).
- **Rationale:** Quality over inertia. FSRS produces noticeably better schedules out of the box, has a reference implementation (`ts-fsrs`) we can depend on, and keeps the dashboard contract identical because the bucket rules are independent of the algorithm. Per-user parameter optimization is a future enhancement, not a blocker — the published defaults are well-calibrated.
- **Trade-off:** Slightly more state per card than SM-2 (six fields vs four). Negligible storage cost; the schema migration is straightforward.

### D7. AI deck generation is a single backend endpoint with a structured contract

`POST /decks/generate { prompt, target_language?, max_cards? }` returns `{ deck, cards[] }`. The backend prompts the LLM with a strict JSON schema, validates the response, and creates the deck + cards atomically. If validation fails the call returns an error — we never persist a partial deck.

- **Rationale:** Aligns with goal "produces a fully reviewable deck or fails loudly."
- **Trade-off:** A failed generation costs the user a request slot; mitigated by surfacing the model's raw error and offering a retry that reuses the same prompt.

### D8. Auth: Sign in with Apple, Google OAuth, passkeys, magic-link fallback; JWT sessions

Four authentication methods, all backed by a shared `auth_methods` join table that maps providers to `users`:

- **Sign in with Apple (SIWA)** — primary on iOS. Required by Apple App Store guidelines if other social sign-in is offered, so it is shipped from the start.
- **Google OAuth** — primary on the web client; also available on iOS.
- **Passkeys (WebAuthn)** — first-class on the web client and any device that supports them; preferred over passwords or one-time codes.
- **Magic link** — fallback for users who refuse all of the above. `POST /auth/request-link` and `GET /auth/verify`.

All four flows mint the same JWT session token (rotating signing key); the rest of the system never has to know which method was used. A single `users` row may have multiple `auth_methods` (e.g. SIWA + magic-link).

- **Alternatives considered:** Passwords (rejected — worse security and worse UX than passkeys); SIWA-only on iOS (rejected — locks users out if they prefer Google or want to share access from a non-Apple device); magic-link-only (rejected — adds friction on every cold start and has worse deliverability than OAuth).
- **Rationale:** Each method covers a real population of users. Passkeys are the highest-quality default where supported; SIWA is non-optional for the App Store; Google catches the broad consumer case; magic-link is the universal fallback. Cost is one extra table and one provider integration each — small relative to the UX gain.

### D9. Per-user daily LLM budget

Each user has a hard daily cap on LLM-backed operations (translate, classify, generate). Enforced by the backend before any provider call. Exceeding the cap returns 429 with the reset time.

- **Rationale:** Prevents a single user from exhausting the shared API key. The cap value is a config knob, not a product surface.

### D10. Pluggable enrichment with three modes: `manual`, `external`, `llm`

Every card has an `enrichment_mode` field with one of three values:

- `manual` — the user supplies `translation` and `explanation` themselves (either at capture time, or by editing a `draft` card later). The backend never calls any provider for this card. The card transitions directly from `draft` to `ready` once both fields are non-empty (or the user explicitly marks it ready with empty fields, e.g. for vocabulary they are testing as recall-only).
- `external` — the backend calls a non-LLM translation provider (Google Translate by default) to populate `translation`. `explanation` remains empty unless the user fills it in. Only meaningful for `content_type = text`; the backend rejects `external` mode for `formula` or `code`.
- `llm` — the existing path (D4, D5): the backend uses Claude to populate both `translation` and `explanation` based on `content_type`.

A deck has a `default_enrichment_mode` (defaulting to `llm`) which is used when a card is created without an explicit mode. The mode is stored on the card itself, so changing the deck default does not retroactively re-enrich existing cards.

- **Alternatives considered:** A single enrichment pipeline that always calls the LLM, with a "manual override" flag per field (rejected — leaks LLM cost and latency into the manual flow); a binary `llm` vs `manual` switch with no external translator (rejected — Google Translate is materially cheaper and faster for plain words and the user explicitly asked for it).
- **Rationale:** The "I just want a flashcard for this German word, don't think about it" use case is a first-class need. So is "I trust Google Translate for words but want Claude for code". Encoding the choice as a per-card mode keeps the data model honest and makes the UI explicit.
- **Trade-off:** Three providers (none / Google / Claude) means three code paths to keep healthy. Mitigated by a single backend interface `enrich(card) -> { translation, explanation }` with three implementations behind it; adding a fourth provider in future is one new implementation, not a rewrite.

### D11. External translator integration

Google Translate is the default `external` provider, accessed via the Cloud Translation API v3. The backend holds the API key; clients never see it. Calls are counted against a separate per-user daily *external* budget (independent of the LLM budget in D9), with the same 429 behavior on exhaustion. The provider behind `external` is configurable so we can later swap to DeepL or self-hosted alternatives without touching client code.

- **Rationale:** Keeps `external` cheap and predictable; isolates its failure modes from the LLM path; lets us migrate provider on the server side without a client release.

## Risks / Trade-offs

- **iOS Share Extension memory limits (~120 MB)** → keep the extension UI minimal; do enrichment server-side after the card is persisted, not inside the extension process.
- **LLM latency on capture** → make enrichment asynchronous: the card is created with `status: enriching` and clients show a placeholder until the backend updates it.
- **LLM hallucinated translations on technical content (formulas, code)** → constrain the prompt with content-type, ask for a verbatim reproduction of the source plus a separate explanation field, and surface the source prominently in the UI so the user can spot drift.
- **SSE connection cost on mobile** → keep the SSE channel open only while the app is foregrounded; on background, fall back to APNs silent push (or, on web, no push) and a cursor pull on next foreground.
- **Outbox conflicts when the same record is edited on two devices while offline** → record-level last-write-wins on `updated_at` resolves it; the iOS and web UIs surface the timestamp and a "this was updated elsewhere" badge so the user notices.
- **Database schema evolution** → use a migration tool from day one (no ad-hoc `ALTER TABLE`s); every payload carries `schema_version` (D2) so client and server can be deployed independently.
- **Outbox loss if the device is wiped** → the outbox is persistent (SQLite on iOS, IndexedDB on web), backed up by the OS, and writes are idempotent on retry; users who reinstall before the outbox drained will lose only un-synced drafts.

## Migration Plan

This is the first feature; there is nothing to migrate from. Deployment plan:

1. Stand up backend + Postgres + run baseline migrations.
2. Deploy web client pointed at staging backend; smoke-test auth and an empty library.
3. Ship iOS build to TestFlight pointed at staging backend; verify Share Extension end-to-end.
4. Cut over to production backend; web and iOS use the same DNS.
5. Rollback strategy: redeploy the previous backend image; clients are forward-compatible because of the `schema_version` field (D2).

## Open Questions

- Hosting target for the backend (Fly.io, Render, Cynkra-internal) — defer until we have a working local stack.
- Production Anthropic API quotas and per-user budget defaults — owner: ops.
- Whether to ship Sign in with Apple as the *only* iOS auth method or expose all four (SIWA, Google, passkeys, magic-link) at first launch. Default assumption: expose all four, with SIWA as the primary affordance on iOS.
