## Context

DevNest is a brand-new product. There is no existing codebase, no
deployed environment, and no team conventions to inherit. The proposal
commits us to a Next.js + Postgres TypeScript stack and an MVP slice
covering project foundation, auth, profiles, posts/feed, and
tags/follows. This design pins down the concrete technology choices,
data model, code layout, and operational defaults so that the
follow-up `tasks.md` is unambiguous and so that later changes (item 6
GitHub/GitLab depth, item 7 interactions, item 8 DMs, item 9
notifications, item 10 trust & safety) inherit a coherent foundation.

The audience is the developers (likely 1–3 people in a hackathon
context) who will implement the MVP, plus reviewers who need to
sanity-check the architecture before any code lands.

## Goals / Non-Goals

**Goals:**

- Pick a single, opinionated stack so we stop arguing and start
  shipping.
- Define a relational data model that supports the MVP and has clear
  extension points for later changes (interactions, DMs,
  notifications) without retrofits.
- Decide how authentication, sessions, and OAuth provider linking
  work end-to-end so `auth` can be implemented without further
  design rounds.
- Decide how feed reads scale at our likely traffic (hundreds, not
  millions, of users) — without over-engineering for the future.
- Specify code layout, configuration, observability, and deployment
  defaults so that "the app boots and is observable"
  (`project-foundation` capability) is concretely implementable.

**Non-Goals:**

- Designing item 6 (deep GitHub/GitLab integration), item 7
  (interactions), item 8 (DMs), item 9 (notifications), or item 10
  (trust & safety). Each gets its own change. We only commit here to
  not painting them into a corner.
- Picking a long-term hosting provider beyond "this works on Vercel
  and on a generic Node host." Final infra is a deployment-day
  decision.
- Algorithmic feed ranking. MVP feed is strictly chronological.
- Real-time/streaming UX (websockets, SSE). Posts and follows are
  request/response only in MVP.

## Decisions

### D1. Framework: Next.js 15 (App Router) + React 19 + TypeScript (strict)

- Next.js gives us routing, server-side rendering, server actions,
  middleware, and a clean dev/prod story in one box. App Router is
  the current default and unblocks React Server Components, which we
  use for read-heavy pages (profile, feed) to keep client JS small.
- TypeScript with `strict: true`,
  `noUncheckedIndexedAccess: true`, and
  `exactOptionalPropertyTypes: true`. These are non-negotiable on
  day one; turning them on later is far more painful.
- **Alternatives considered**:
  - Remix / React Router v7 framework mode — equally good
    technically; chose Next.js for the larger ecosystem and the
    fact that Vercel's free tier removes one infra decision.
  - SvelteKit — smaller bundle, smaller team experience. Skipped
    to stay within "TS full-stack" as chosen.
  - SPA + separate API — strictly more work for no MVP benefit.

### D2. Database: Postgres 16, accessed via Drizzle ORM

- Postgres is the safe default: relational integrity for the
  follow graph, full-text search for tags, JSONB for the
  GitHub/GitLab profile blob.
- **Drizzle** over Prisma: Drizzle's schema is a TypeScript file (no
  separate `prisma generate` step), its query API is closer to SQL
  (which matters when we tune feed reads), and migrations are plain
  SQL files we can review. Prisma's developer ergonomics are
  arguably nicer for CRUD, but feed reads will eventually want
  hand-tuned SQL and Drizzle gives us a clean ramp.
- **Alternatives considered**:
  - Prisma — fine choice; rejected for the reasons above plus the
    runtime engine binary that complicates serverless deploys.
  - Raw SQL via `postgres.js` — too little structure for a 1–3
    person team that doesn't have a dedicated SQL person.
  - SQLite — tempting for a hackathon demo but the ORM pivot cost
    later is not worth it given Postgres in dev via Docker is
    trivial.
- Local dev: `docker compose up` brings up Postgres on port 5432.

### D3. Auth: Auth.js (NextAuth v5) with GitHub, GitLab, and Email providers

- Auth.js handles the OAuth dance, session storage, CSRF, and the
  magic-link email flow out of the box. We use the Drizzle adapter
  so accounts/sessions/users live in our Postgres next to the rest
  of the data model — no separate auth DB.
- Sessions are database sessions (not JWT). DB sessions let us
  revoke sign-in instantly, which we will need the moment trust &
  safety (item 10) exists.
- **Account linking**: when a sign-in provider returns an email that
  already exists on a user record, we link the new
  `accounts` row to the existing `users` row only when the email
  is verified by the provider. Otherwise the user is shown a "this
  email is already in use, sign in with the original method first
  to link" screen. This is the conservative default and is what
  `allowDangerousEmailAccountLinking` would otherwise bypass — we
  do not enable that flag.
- Magic-link email via Resend (or any SMTP for dev). The provider is
  configurable; the code does not depend on Resend specifically.
- **Alternatives considered**:
  - Clerk / WorkOS / Stytch — faster to set up, but lock-in for a
    hackathon project is unacceptable and we lose direct access to
    the user/account tables.
  - Hand-rolled OAuth — entirely doable; not worth the time when
    Auth.js exists.

### D4. Data model (MVP)

The core tables:

- `users` — id (cuid2), handle (unique, citext), display_name,
  headline, bio, avatar_url, created_at, deleted_at.
- `accounts` — Auth.js account rows (provider, provider_account_id,
  user_id, access_token, refresh_token, expires_at, token_type,
  scope, id_token). One row per linked OAuth provider.
- `sessions` — Auth.js session rows.
- `verification_tokens` — Auth.js magic-link tokens.
- `provider_profiles` — per-(user, provider) snapshot of the
  GitHub/GitLab profile we fetched at sign-in: avatar, top
  languages, public repo count, html_url. Stored as JSONB plus a
  few indexed columns. This is the seam where item 6 (deep
  integration) plugs in later — it can extend this table without
  touching `users`.
- `posts` — id (cuid2), author_id (FK users), body (markdown text,
  ≤ 10 KB), created_at, deleted_at. Code is part of `body` as
  fenced ` ```lang ` blocks; we render it server-side with Shiki
  on read. No separate "snippet" entity in MVP.
- `tags` — id (cuid2), slug (unique, citext, ≤ 32 chars),
  display_name, created_at. Tags are first-class so `tags-and-
  follows` can let users follow a tag without us having to store
  it on every post as a string.
- `post_tags` — many-to-many (post_id, tag_id). Composite PK.
- `follows` — (follower_id, target_user_id, created_at). Composite
  PK. Asymmetric (Twitter-style), not symmetric (Facebook-style).
- `tag_follows` — (user_id, tag_id, created_at). Composite PK.

Indexes:

- `users(handle)` unique.
- `posts(author_id, created_at desc)` for profile feeds.
- `posts(created_at desc)` for the global discovery feed (with a
  `where deleted_at is null` partial index).
- `follows(follower_id, target_user_id)` PK doubles as a covering
  index for "who do I follow"; reverse index `follows(target_user_id,
  follower_id)` for "who follows me".
- `post_tags(tag_id, post_id)` for tag feeds.

Soft deletes (`deleted_at`) on `users` and `posts` so item 10
moderation can suspend without losing referential integrity.

### D5. Feed reads: SQL JOIN, no fan-out, paginated by cursor

- Home feed query is a single SQL: posts where `author_id IN
  (select target_user_id from follows where follower_id = $me)
  union posts whose tags I follow`, ordered by `created_at desc`,
  paginated by `(created_at, id)` cursor.
- This scales to tens of thousands of users and tens of millions
  of posts as long as the indexes above exist. We deliberately do
  not write a fan-out-on-write timeline cache; if and when we need
  it, we can add it without changing the API surface.
- Public discovery feed is the same query without the follow
  filter, capped at recent N days for cost.

### D6. Code rendering: server-side syntax highlighting via Shiki

- Markdown → HTML pipeline: `remark` + `remark-gfm` for parsing,
  `rehype-shiki` for highlighting fenced code blocks, sanitized
  with `rehype-sanitize`. All on the server (RSC), so the client
  ships zero highlighter JS.
- Languages: ship a fixed set initially (TypeScript, JavaScript,
  Python, R, Rust, Go, SQL, Bash, JSON, YAML, HTML, CSS, C, C++, C#, Java). Anything
  else falls back to plain text. The set is a constant so it's
  easy to extend.
- Copy button: a small client component (`use client`) wraps each
  rendered `<pre>`. It uses `navigator.clipboard.writeText`. No
  third-party copy lib.
- **Alternatives considered**: Prism (smaller, but worse
  TypeScript / TSX support); client-side Shiki (ships ~MB of
  highlighter to every visitor — unacceptable); CodeMirror (the
  authoring side may eventually want it, but not for read-only
  rendering).

### D7. UI: Tailwind CSS v4 + shadcn/ui

- Tailwind for utility styling. shadcn/ui as the component
  starter — we copy components into the repo rather than depend
  on a UI package, so we can edit them freely.
- Dark mode via Tailwind's `dark:` variant + a system/preference
  toggle.
- Accessibility: shadcn/ui builds on Radix primitives, which give
  us correct focus management, ARIA, and keyboard nav for free.
  Every interactive element is a real semantic element
  (`<button>`, `<a>`, etc.).
- **Alternatives considered**: Mantine, Chakra — heavier, harder
  to customize, lock you into their design system. CSS modules /
  vanilla CSS — fine but we lose the speed of Tailwind iteration.

### D8. Validation at boundaries: Zod

- Every server action and route handler validates its input with a
  Zod schema. The schema is the source of truth for the type that
  flows into the handler.
- Database query results are typed by Drizzle and trusted inside
  the boundary; we do not re-validate them.
- External API responses (GitHub, GitLab) are parsed through Zod
  before being persisted, since they are an untrusted boundary.

### D9. Code layout

```
/                       # repo root
├── app/                # Next.js App Router
│   ├── (marketing)/    # public landing, /about, /signin
│   ├── (app)/          # authenticated routes
│   │   ├── feed/
│   │   ├── me/         # current-user profile (was `@me/` — `@` is a Next.js parallel-route slot)
│   │   └── u/[handle]/ # other users' profiles
│   ├── api/            # OAuth callbacks, webhooks
│   └── layout.tsx
├── components/         # reusable UI (mostly RSC)
│   └── ui/             # shadcn/ui copies
├── lib/
│   ├── auth/           # Auth.js config, providers, session helpers
│   ├── db/             # Drizzle schema, migrations, query helpers
│   ├── feed/           # feed query + cursor pagination
│   ├── markdown/       # remark/rehype pipeline + Shiki
│   └── env.ts          # parsed, typed process.env (Zod)
├── server/
│   └── actions/        # server actions, one file per capability
├── drizzle/            # generated SQL migrations (committed)
├── tests/
│   ├── unit/           # Vitest
│   └── e2e/            # Playwright
└── docker-compose.yml  # local Postgres + Mailhog
```

### D10. Configuration & secrets

- All env vars are parsed through `lib/env.ts` (Zod) on cold
  start. Importing `env` anywhere returns the typed, validated
  object. Missing or malformed vars crash the process at boot,
  not at first use.
- Secrets are never logged. The error pages strip
  `process.env.NODE_ENV !== "production"` details from production
  responses.
- `.env.example` is committed; `.env.local` is gitignored.

### D11. Observability & error handling

- Request-id middleware: every request gets a `x-request-id`
  header (preserved if the client sent one, otherwise generated).
  Logs include it; error pages echo it so users can quote it.
- Structured logs (`pino`) → stdout. No log shipping config in
  this change; logs land on whatever the host gives us.
- A `/api/health` route returns `{status: "ok", db: "ok"}`. CI
  smoke tests call it after `next start` to detect cold-boot
  breakage.
- Error boundary at the route-group level (not just root) so an
  exploding profile doesn't take down `/feed`.

### D12. Testing strategy

- **Unit / integration**: Vitest. Run against a real ephemeral
  Postgres (Docker via `pg-mem` is too divergent for the queries
  we'll write). Each test acquires a transaction and rolls it back.
- **Component**: React Testing Library + `user-event`. Queries by
  role/label, never by test-id (per project rules).
- **E2E**: Playwright. One smoke flow at a minimum: sign in via
  the email magic-link path → create a post with a code block →
  see it in the feed.
- Coverage: aim for ≥ 70% on `lib/` and `server/actions/`; UI
  coverage is opportunistic.

### D13. CI

- GitHub Actions: matrix-free single job — install (pnpm), typecheck,
  lint (`eslint` + `eslint-plugin-react-hooks`), unit tests against
  Postgres service container, build (`next build`), e2e against the
  built app.
- Migrations: `drizzle-kit push` is for dev only; CI runs
  `drizzle-kit migrate` against the Postgres service so we catch
  forgotten migrations.
- Required to merge to `main`. Branch protection on day one.

### D14. Deployment story (loose, intentionally)

- Primary target: Vercel for the Next.js app, a managed Postgres
  (Neon, Supabase, or a Cynkra-hosted box) for the DB, Resend for
  email. Nothing in the code assumes Vercel — `next start` on a
  generic Node host works the same.
- Two environments: `preview` (per-PR via Vercel) and `prod`.
  `staging` is deferred until we have real users.

## Risks / Trade-offs

- **Read-heavy feed query without a cache** → if the user base
  grows faster than expected, the feed query may need a Redis
  cache or a fan-out-on-write timeline. Mitigation: the API
  surface is paginated by opaque cursor, so we can swap the
  implementation without breaking clients.
- **Auth.js is moving fast (v5 just stabilized)** → version churn
  may force migrations. Mitigation: pin the major; treat upgrades
  as their own changes; isolate Auth.js usage in `lib/auth/` so a
  later swap (e.g., to Lucia or hand-rolled) touches few files.
- **Drizzle is younger than Prisma** → fewer Stack Overflow
  answers, occasional rough edges. Mitigation: we keep raw-SQL
  escape hatches in `lib/db/` and our migrations are plain SQL,
  so a bailout to Prisma or `postgres.js` is mechanical, not
  architectural.
- **Email-magic-link UX is worse than OAuth** → some users will
  bounce. Mitigation: GitHub and GitLab cover the developer
  audience; email is a fallback, not the headline path.
- **No moderation tooling on day one** → spam can show up the
  moment we go public. Mitigation: keep the product invite-only or
  closed-beta until item 10 (trust & safety) ships. Feed
  visibility flags exist on `posts` from day one to make later
  shadow-banning a one-line query change.
- **Soft deletes everywhere** → easy to forget the
  `where deleted_at is null` clause and leak deleted content.
  Mitigation: a single `db.posts.live()` helper that every read
  goes through; lint rule (or at minimum a code review checklist)
  forbids direct `select(...).from(posts)` outside `lib/db/`.
- **Server-side Shiki adds non-trivial cost per render** →
  highlighting a long post adds ~10–50 ms. Mitigation: we cache
  rendered post HTML in Postgres (`posts.body_html`,
  `posts.body_html_version`) and re-render only when the body
  changes or the renderer version bumps.

## Migration Plan

Not applicable — there is no existing system. Initial deploy is a
fresh DB created from the first Drizzle migration. Rollback for the
first deploy = redeploy nothing (the previous state is "site does
not exist"). For each subsequent deploy in this change:

- Forward: `drizzle-kit migrate` runs in CI against the target DB
  before the new app version goes live.
- Backward: every migration is paired with a hand-written down
  migration in `drizzle/` (Drizzle does not auto-generate these,
  so reviewers must check).

## Open Questions

- **Hosting provider for prod Postgres**: Neon, Supabase, or a
  Cynkra-hosted box? Decide before first prod deploy. Affects
  connection pooling (Neon's serverless driver vs. plain `pg`).
- **Handle reservation policy**: do we let users pick any handle, or
  reserve obvious ones (e.g., `admin`, `support`, single-letter)?
  Punted to first-week feedback; the schema enforces uniqueness,
  the policy is data, not code.
- **Default visibility of new accounts**: discoverable in search
  by default, or opt-in? Lean toward discoverable (it is a social
  product) but flag for a privacy review.
- **Magic-link rate limiting**: Auth.js does not rate-limit by
  default. We need a story before opening sign-up to the
  internet — likely a simple in-DB throttle. May land in this
  change or as a follow-up.
- **GitHub/GitLab token storage**: we store OAuth access tokens for
  the deep-integration follow-up. Encrypt at rest? Default Auth.js
  stores them plaintext in `accounts`. Resolve before going public,
  not before MVP.
