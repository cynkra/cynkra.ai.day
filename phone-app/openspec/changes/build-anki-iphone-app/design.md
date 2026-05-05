## Context

This is the first feature in a green-field repository (`phone-app/`). There is no existing iOS app, backend, or web client to integrate with. The change establishes seven capabilities at once (`clip-capture`, `card-content`, `deck-management`, `study-engine`, `ai-deck-generation`, `sync-service`, `web-client`), so the design must pin down enough cross-cutting choices — language stack, data model boundary, sync semantics, LLM contract — that each capability spec can be written and implemented without re-litigating them.

The user-visible workflow is: user selects text on iPhone → Share Extension → card appears in app and (after sync) on desktop web view → AI annotates with translation/explanation → card lands in a deck → study engine schedules it under `New` / `Learned` / `Due`. A separate "AI deck generation" path takes a free-form prompt and produces a populated deck.

Constraints inherited from the project:
- Cynkra dev day: a one-day green-field build, so we optimize for a thin end-to-end vertical slice over completeness.
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

**Non-Goals:**
- Android, iPad-optimized UI, or a desktop-native (non-web) client.
- Offline-first conflict resolution; first version assumes the device is online when capturing.
- Importing existing Anki `.apkg` decks.
- Audio/image cards; v1 is text, formula (rendered as TeX), and code only.
- Collaborative or shared decks between users.
- Production-grade observability, billing, or rate-limiting beyond a hard per-user daily LLM-call cap.

## Decisions

### D1. Stack: SwiftUI iOS app + Node/TypeScript backend + Next.js web client

Choose SwiftUI for the iOS app (Share Extension is first-class on iOS only), a single TypeScript backend service for sync + AI orchestration, and Next.js for the web client so it can share TypeScript types with the backend.

- **Alternatives considered:** React Native for the phone app (rejected — Share Extension support on iOS through RN is fragile and we want a native share sheet); Python/FastAPI backend (rejected — would force a second type system; TS lets backend and web share the card schema verbatim).
- **Rationale:** A native iOS Share Extension is the central UX promise of `clip-capture`; that pins us to Swift for the phone. Sharing types between backend and web is the next-biggest leverage point, which pins those two to TypeScript.

### D2. One canonical card schema, owned by the backend

The backend defines the card type (id, owner, deck_id, source content, content_type, translation, scheduling state, timestamps) and exposes it via a typed REST API. iOS and web both consume this schema; iOS has a thin local mirror for offline read of already-synced cards.

- **Rationale:** Keeps `card-content` and `sync-service` from drifting. Three independent definitions of "what a card is" is the most likely failure mode for this design.
- **Trade-off:** Schema changes require coordinated client updates; mitigated by a `schema_version` field on every payload and a backend that rejects unknown versions explicitly.

### D3. Sync model: server-authoritative, last-write-wins on a single device

The backend is the source of truth. Each client calls `GET /sync?since=<cursor>` to pull changes and `POST /cards` / `PATCH /cards/:id` to push. No CRDTs, no merge logic.

- **Alternatives considered:** Real-time websockets (rejected for v1 — adds infra, polling every few seconds is enough for the desktop "as soon as I add it" feel); CRDT (rejected — overkill for a one-day build with effectively single-device editing).
- **Rationale:** Capture happens on iPhone; the desktop web client is mostly read+review. Single-writer-at-a-time is realistic.

### D4. Content-type detection in two stages

When a card is captured: (1) a fast deterministic classifier on device picks one of `text`, `formula`, `code` from heuristics (LaTeX delimiters, fenced code, language detection); (2) the backend re-validates with the LLM only if the local classifier is uncertain (confidence below a threshold).

- **Rationale:** Keeps capture latency low for the common case (plain word) and uses the LLM only when it earns its keep. Avoids paying LLM cost on every clip.

### D5. Translation/explanation prompt is per-content-type, not per-card

The backend stores three prompt templates (one per content type). The user's per-deck "target language / explanation style" fills the template. This means a deck-level setting change does not require recomputing every card unless the user explicitly asks to re-translate.

- **Rationale:** Predictable LLM output, easier to test, and lets us cache by `(content_hash, content_type, target_style)`.

### D6. Study-engine state machine: SM-2-lite mapped to three buckets

Each card stores `interval_days`, `ease`, `last_reviewed_at`, `next_due_at`. The dashboard derives the bucket:
- `New` — never reviewed (`last_reviewed_at` is null).
- `Due` — `next_due_at <= now`.
- `Learned` — everything else (reviewed at least once, not yet due).

- **Alternatives considered:** Full Anki SM-2 with learning steps and lapses (rejected for v1 — too much surface area for a one-day build); FSRS (rejected — needs a training set).
- **Rationale:** Three buckets is exactly what the proposal asks the dashboard to show. SM-2-lite gives a believable schedule without inventing a new algorithm.

### D7. AI deck generation is a single backend endpoint with a structured contract

`POST /decks/generate { prompt, target_language?, max_cards? }` returns `{ deck, cards[] }`. The backend prompts the LLM with a strict JSON schema, validates the response, and creates the deck + cards atomically. If validation fails the call returns an error — we never persist a partial deck.

- **Rationale:** Aligns with goal "produces a fully reviewable deck or fails loudly."
- **Trade-off:** A failed generation costs the user a request slot; mitigated by surfacing the model's raw error and offering a retry that reuses the same prompt.

### D8. Auth: email + magic link, JWT sessions

Single-factor magic-link auth. Backend issues a JWT (rotating signing key) used by both iOS app and web client.

- **Rationale:** Cheapest path to "the same library on phone and computer" without password UX. Acceptable for v1; real auth is a Non-Goal.

### D9. Per-user daily LLM budget

Each user has a hard daily cap on LLM-backed operations (translate, classify, generate). Enforced by the backend before any provider call. Exceeding the cap returns 429 with the reset time.

- **Rationale:** Prevents a single user from exhausting the shared API key. The cap value is a config knob, not a product surface.

## Risks / Trade-offs

- **iOS Share Extension memory limits (~120 MB)** → keep the extension UI minimal; do enrichment server-side after the card is persisted, not inside the extension process.
- **LLM latency on capture** → make enrichment asynchronous: the card is created with `status: enriching` and clients show a placeholder until the backend updates it.
- **LLM hallucinated translations on technical content (formulas, code)** → constrain the prompt with content-type, ask for a verbatim reproduction of the source plus a separate explanation field, and surface the source prominently in the UI so the user can spot drift.
- **Sync polling cost / battery** → poll only when the app is foregrounded or when a push notification (Apple Push) signals new server-side activity (e.g. a deck-generation job finished).
- **Single-writer assumption breaks if the user edits the same card on two devices** → last-write-wins is acceptable for v1; document the limitation in the web UI.
- **Database schema lock-in from a one-day build** → use a migration tool from day one (no ad-hoc `ALTER TABLE`s) so v2 can evolve cleanly.
- **No offline capture in v1** → if the iPhone is offline, the Share Extension queues the raw selection locally and retries on next launch; we accept that the card will not be visible on web until the queue drains.

## Migration Plan

This is the first feature; there is nothing to migrate from. Deployment plan:

1. Stand up backend + Postgres + run baseline migrations.
2. Deploy web client pointed at staging backend; smoke-test auth and an empty library.
3. Ship iOS build to TestFlight pointed at staging backend; verify Share Extension end-to-end.
4. Cut over to production backend; web and iOS use the same DNS.
5. Rollback strategy: redeploy the previous backend image; clients are forward-compatible because of the `schema_version` field (D2).

## Open Questions

- Hosting target for the backend (Fly.io, Render, Cynkra-internal) — defer until we have a working local stack.
- Pricing/limits for the Anthropic API key in production vs. the dev-day proxy — owner: ops.
- Do we need a "review on iPhone" surface for v1, or is web-only review acceptable while iPhone stays capture-focused? Default assumption: iPhone has review too, since the data model and scheduling support it for free.
