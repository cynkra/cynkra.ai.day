# DevNest

A social network for software developers — share posts with code, follow
tags and people, see what your peers are building.

> Built as the OpenSpec change `bootstrap-devnest-mvp` (see
> [`openspec/changes/bootstrap-devnest-mvp/`](openspec/changes/bootstrap-devnest-mvp/)).
> The Cynkra R-skills marketplace docs that previously lived here are at
> [`README.cynkra-r-skills.md`](README.cynkra-r-skills.md).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Database | Postgres 16 + Drizzle ORM (`postgres-js` driver) |
| Auth | Auth.js (NextAuth v5) — GitHub, GitLab, email magic-link |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Markdown | `unified` (remark + rehype) + Shiki (syntax highlighting) |
| Tests | Vitest (unit + component) + Playwright (e2e) |
| Tooling | pnpm 9, ESLint 9 (flat config), Prettier 3 |

## Prerequisites

- **Node** ≥ 20.18 (`.nvmrc` pins major 20)
- **pnpm** 9.15.x (auto-activated via Corepack — `packageManager` is set in `package.json`)
- **Docker** (for local Postgres + Mailhog)

```bash
# One-time on a new machine
corepack enable
nvm install 20 && nvm use
```

## Quick start

```bash
# 1. Install deps
pnpm install

# 2. Start Postgres (5432) and Mailhog (SMTP 1025, UI http://localhost:8025)
pnpm db:up

# 3. Copy env defaults and (optionally) plug in real OAuth credentials
cp .env.example .env.local
# Edit .env.local — see "Environment variables" below.

# 4. Apply migrations against the local Postgres
pnpm db:migrate

# 5. Run the dev server (http://localhost:3000)
pnpm dev
```

Sign in at [/signin](http://localhost:3000/signin) using the email
magic-link path — the link arrives in the local
[Mailhog UI](http://localhost:8025).

## Environment variables

All env vars are validated at process start by [`lib/env.ts`](lib/env.ts);
missing or malformed values crash the server with a named error. Copy
[`.env.example`](.env.example) to `.env.local` and fill in.

| Variable | Required for | Notes |
|---|---|---|
| `NEXTAUTH_URL` | Auth.js OAuth callbacks | `http://localhost:3000` in dev |
| `AUTH_SECRET` | Session signing | ≥ 32 chars; `openssl rand -base64 32` |
| `DATABASE_URL` | Postgres connection | `postgres://devnest:devnest@localhost:5432/devnest` for local Docker |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth | Register at https://github.com/settings/developers — see below |
| `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET` | GitLab OAuth | Register at https://gitlab.com/-/profile/applications — see below |
| `EMAIL_SERVER_HOST` / `EMAIL_SERVER_PORT` | Magic-link email | `localhost` / `1025` for Mailhog in dev |
| `EMAIL_SERVER_USER` / `EMAIL_SERVER_PASSWORD` | SMTP auth | Empty in dev (Mailhog accepts anonymous) |
| `EMAIL_FROM` | Magic-link sender | e.g. `DevNest <noreply@devnest.local>` |

### Registering OAuth apps

**GitHub** (https://github.com/settings/developers → New OAuth App):

| Field | Value |
|---|---|
| Application name | DevNest (local) |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |
| Required scopes | `read:user`, `user:email` (granted at sign-in) |

Copy the Client ID and "Generate a new client secret" → paste into
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

**GitLab** (https://gitlab.com/-/profile/applications):

| Field | Value |
|---|---|
| Name | DevNest (local) |
| Redirect URI | `http://localhost:3000/api/auth/callback/gitlab` |
| Confidential | ✓ |
| Scopes | `read_user` |

Save → copy the Application ID and Secret into `GITLAB_CLIENT_ID` /
`GITLAB_CLIENT_SECRET`.

The wiring works without these credentials — magic-link sign-in via
Mailhog is enough for local dev. OAuth only matters when you want to
test those flows end-to-end.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (HMR) on http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | ESLint flat config |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` | Vitest (unit + component, ~100 tests) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright (sign-in + create-post against the running dev server) |
| `pnpm db:up` / `pnpm db:down` | Start/stop Postgres + Mailhog containers |
| `pnpm db:generate` | Generate a migration from the current Drizzle schema |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |
| `pnpm db:push` | Push schema directly (dev convenience; CI uses `migrate`) |
| `pnpm db:studio` | Open Drizzle Studio (browser-based DB explorer) |

## Migrations

Migrations live in [`drizzle/`](drizzle/). Each `.sql` is auto-generated
by `pnpm db:generate` from the schema in [`lib/db/schema/`](lib/db/schema/);
each is paired with a hand-written `.down.sql` (Drizzle-kit doesn't
auto-generate down migrations).

Workflow:

```bash
# 1. Edit a schema file in lib/db/schema/
# 2. Generate the migration
pnpm db:generate
# 3. Review the generated SQL, write the paired .down.sql
# 4. Apply to dev DB
pnpm db:migrate
# 5. Commit the schema change AND both .sql files
```

CI runs `drizzle-kit migrate` (not `push`), so any drift between schema
and migrations fails the build.

## Project layout

```
app/                    # Next.js App Router
├── (app)/              # Authenticated routes
│   ├── feed/           # Home feed (followed users + tags + own posts)
│   ├── me/             # Current-user profile + /me/settings
│   ├── u/[handle]/     # Public user profiles
│   └── t/[slug]/       # Tag pages
├── (marketing)/        # Public routes
│   ├── explore/        # Discovery feed (recent public posts)
│   └── signin/         # Sign-in + check-email
├── api/                # Auth callbacks, /api/health
├── search/             # Search across users + tags
└── layout.tsx          # Root layout (header, theme provider, toaster)

components/             # Reusable UI
├── ui/                 # shadcn primitives
├── posts/              # PostCard, PostBody, PostComposer, FeedList
├── profile/, follow/, search/, site/

lib/
├── auth/               # NextAuth helpers, handle suggestion, requireUser
├── db/                 # Drizzle client + schema/
├── feed/               # Home / discovery / profile / tag feed queries + cursor
├── follow/             # Follow actions, counts, queries
├── markdown/           # remark + rehype + Shiki pipeline
├── posts/              # createPost / deletePost actions
├── profile/            # Profile queries + updateProfile / disconnectProvider
├── providers/          # GitHub / GitLab profile fetch helpers
├── search/, tags/

drizzle/                # Migration .sql files (committed)
tests/                  # Vitest unit/component
└── e2e/                # Playwright specs

middleware.ts           # Request-id propagation
auth.ts                 # NextAuth config (providers + callbacks + adapter)
```

## Core concepts

- **Cursor pagination**: feeds (home, discovery, profile, tag) all use
  the same opaque base64url cursor over `(created_at, post_id)`. See
  [`lib/feed/cursor.ts`](lib/feed/cursor.ts).
- **Soft delete everywhere**: `posts.deleted_at` and `users.deleted_at`
  are filtered out by every read; the [`live()` helper in
  `lib/db/posts.ts`](lib/db/posts.ts) enforces this.
- **Markdown HTML cache**: posts are rendered to HTML once on creation
  (`posts.body_html`, `posts.body_html_version`); re-rendered lazily
  when [`RENDERER_VERSION`](lib/markdown/index.ts) bumps.
- **Conservative account linking**: OAuth identities only auto-link to
  an existing user when the provider has verified the email
  (`profile.email_verified === true`). Otherwise users see a
  conflict-resolution screen on `/signin`.
- **Request-id propagation**: every request gets an `x-request-id`
  (preserved when valid, generated otherwise); the root layout echoes
  it into the DOM so client error pages can quote it.

## Open questions / future work

Tracked in [the design doc](openspec/changes/bootstrap-devnest-mvp/design.md#open-questions):

- Managed Postgres choice for prod (Neon, Supabase, or other)
- Magic-link rate-limiting before opening sign-up to the public
- OAuth access-token storage (encryption at rest)
- HTTP 410 for soft-deleted profiles (currently 404 — App Router has no
  built-in `gone()` helper)

Items 6–10 from the original product vision (deep GitHub integration,
post interactions, DMs, notifications, trust & safety) are explicit
non-goals of this change and will land as separate OpenSpec proposals.

## License

MIT — see [LICENSE](LICENSE).
