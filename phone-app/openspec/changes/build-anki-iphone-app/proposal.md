## Why

Learners hit unfamiliar terms — vocabulary, math/stats formulas, code snippets — across many surfaces (browser, chat, PDFs, IDEs) and lose them before they can study. Existing flashcard tools like Anki require manual entry and do not natively translate, parse formulas, or generate decks on demand. We want a single iPhone-first workflow that turns any selection into a reviewable card with the right translation, syncs to a desktop view, and lets users grow decks either by hand or via an AI generator.

## What Changes

- Add an iOS app with an iOS Share Extension that accepts text selections (words, formulas, code) from any app or browser and creates flashcards.
- Add automatic translation/explanation for captured items, with type detection (natural-language word vs. math formula vs. code) and a per-deck target language / explanation style.
- Support three enrichment modes per card: `manual` (the user types the translation/explanation themselves, no LLM call), `external` (use a non-LLM translator such as Google Translate), or `llm` (Claude). The mode can be set per-card and defaulted per-deck.
- Add a deck model that groups cards by topic (e.g. `grammar`, `themes`, `OLS-formulas`) and supports nested topics.
- Add a backend sync service so cards and decks created on iPhone are immediately available in a web view on the user's computer.
- Add a spaced-repetition study engine that classifies every card into exactly one of `New`, `Learned`, or `Due`, with per-deck progress dashboards.
- Add an AI deck generator: given a free-form prompt (e.g. "Create a deck with basic formulas describing OLS"), produce a fully populated deck of cards ready to study.
- Add minimal user accounts so the same library is reachable from iPhone and web.

## Capabilities

### New Capabilities
- `clip-capture`: iOS Share Extension and web clipper entry points that accept a selection and turn it into a draft card.
- `card-content`: card data model, content-type detection (text/formula/code), and automatic translation/explanation generation.
- `deck-management`: decks, topics, and the assignment of cards to decks (manual or AI-generated).
- `study-engine`: spaced-repetition scheduling and the `New` / `Learned` / `Due` progress classification.
- `ai-deck-generation`: prompt-driven generation of a full deck of cards on a requested topic.
- `sync-service`: backend API and account model that keep iPhone and web views consistent in near real time.
- `web-client`: read-and-review web view of the user's library, decks, and progress on desktop.

### Modified Capabilities

_None — this is a green-field project; no existing specs are being changed._

## Impact

- New iOS app (Swift / SwiftUI) including a Share Extension target.
- New backend service (REST/JSON over HTTPS, plus a Server-Sent Events stream for sync invalidation) for sync, auth, and AI orchestration; introduces a Postgres database for users, decks, cards, FSRS review state, and auth methods.
- New web client for desktop access.
- New dependency on a Postgres-backed job queue (`pg-boss`) for durable, retryable enrichment jobs — uses the existing Postgres instance, no extra infrastructure component.
- New dependency on an LLM provider (Anthropic Claude) for translation, type detection, and AI deck generation; requires API key handling and a per-user request budget.
- New optional dependency on an external translation provider (Google Translate as the default external backend); requires its own API key and is opt-in per card or per deck.
- New auth integrations: Sign in with Apple, Google OAuth, passkeys (WebAuthn), and a magic-link fallback. Each requires its own provider configuration; all four mint the same JWT session.
- New dependency on the `ts-fsrs` reference implementation of the FSRS-4.5 spaced-repetition algorithm.
- Client-side: each client (iOS app, iOS Share Extension, web client) gains a durable local outbox (SQLite on iOS, IndexedDB on web) used by every write path.
- Establishes the project's first specs under `openspec/specs/`; future changes will modify these capabilities rather than re-defining them.
