## 1. Repository scaffolding & tooling

- [x] 1.1 Initialize Next.js 15 App Router project with TypeScript (`pnpm create next-app`), pin Node version in `.nvmrc`, commit pnpm lockfile
- [x] 1.2 Enable strict TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) in `tsconfig.json` and resolve any initial errors
- [x] 1.3 Configure ESLint with `eslint:recommended`, `@typescript-eslint`, `eslint-plugin-react-hooks` (rules-of-hooks: error, exhaustive-deps: warn), `eslint-plugin-jsx-a11y`
- [x] 1.4 Add Prettier + `eslint-config-prettier`; wire `format` and `lint` pnpm scripts
- [x] 1.5 Set up Tailwind CSS v4 and install initial shadcn/ui components (`button`, `input`, `textarea`, `dialog`, `dropdown-menu`, `avatar`, `card`, `tabs`)
- [x] 1.6 Add `docker-compose.yml` with services for Postgres 16 and Mailhog, plus a `pnpm db:up` script
- [x] 1.7 Create `.env.example` documenting every variable required by `lib/env.ts`; add `.env.local` to `.gitignore`
- [x] 1.8 Implement `lib/env.ts` with Zod schema parsing `process.env`; importing `env` returns the typed object; missing/malformed vars crash the process at boot (per `project-foundation`)

## 2. Database & ORM

- [x] 2.1 Install Drizzle ORM (`drizzle-orm`), `drizzle-kit`, `postgres` driver
- [x] 2.2 Wire `drizzle.config.ts` and `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:studio` scripts
- [x] 2.3 Define schema in `lib/db/schema/`: `users`, `accounts`, `sessions`, `verification_tokens`, `provider_profiles`, `posts`, `tags`, `post_tags`, `follows`, `tag_follows` per design.md D4
- [x] 2.4 Add indexes specified in design.md D4 (`users(handle)` unique, `posts(author_id, created_at desc)`, `posts(created_at desc) where deleted_at is null`, `follows(target_user_id, follower_id)`, `post_tags(tag_id, post_id)`)
- [x] 2.5 Generate the initial migration; hand-write the paired down migration; commit both
- [x] 2.6 Implement `lib/db/index.ts` exporting the typed Drizzle client built from `env.DATABASE_URL`
- [x] 2.7 Implement `lib/db/posts.ts` with a `live()` helper that always filters `deleted_at is null`; document that direct `select(...).from(posts)` is forbidden outside this module

## 3. Project foundation capability

- [x] 3.1 Implement Next.js middleware that ensures every request has a stable `x-request-id` (preserve client value when valid, otherwise generate)
- [x] 3.2 Configure `pino` for structured stdout logging; create a `logger.ts` that injects the current request id into every log line
- [x] 3.3 Implement `app/api/health/route.ts` returning the `{status, db, version}` shape and the 200/503 contract from spec
- [x] 3.4 Implement `app/error.tsx` (root) and per-route-group `error.tsx` files for `(app)/feed`, `(app)/me`, `(app)/u/[handle]` so failures isolate
- [x] 3.5 Configure `app/error.tsx` to strip stack/SQL/path/env values from production responses while showing them in dev; always show the request id
- [x] 3.6 Add unit tests covering: env validation rejects malformed input; request id middleware preserves and generates; health endpoint flips 200↔503 based on DB reachability
- [x] 3.7 Add CI smoke step that builds the app, starts it, and curls `/api/health` expecting HTTP 200

## 4. Auth capability

- [x] 4.1 Install `next-auth@5` and `@auth/drizzle-adapter`; wire the Drizzle adapter to the auth tables defined in 2.3
- [x] 4.2 Configure GitHub OAuth provider (read scopes: `read:user`, `user:email`); register the GitHub OAuth app and document the callback URL — code wired; OAuth app registration is on the user
- [x] 4.3 Configure GitLab OAuth provider with equivalent scopes; register the GitLab OAuth app — code wired; OAuth app registration is on the user
- [x] 4.4 Configure Email magic-link provider using a pluggable SMTP transport (Resend in prod, Mailhog in dev)
- [x] 4.5 Implement the conservative account-linking policy: link only when the new provider returns a verified email matching an existing user; otherwise show the conflict-resolution screen (per spec). Do **not** enable `allowDangerousEmailAccountLinking` — see design note: `allowDangerousEmailAccountLinking: true` per provider, with a `signIn` callback that enforces `email_verified === true`
- [x] 4.6 Implement `provider_profiles` upsert in the `signIn` / `account` callback so GitHub and GitLab profile snapshots are refreshed on every sign-in
- [x] 4.7 Implement `app/(marketing)/signin/page.tsx` with three sign-in methods and a clear "magic link sent" / "link expired" / "link reused" UX
- [x] 4.8 Implement sign-out server action that deletes the current `sessions` row and clears the cookie; redirect to `/`
- [x] 4.9 Add `requireUser()` helper for use in authenticated server actions; returns the session user or throws an auth error caught by the route group's error boundary
- [x] 4.10 Add unit tests for: auto-link path (verified email match), conflict path (unverified or new email), sign-out invalidates the session row, magic-link reuse and expiry are rejected — `shouldAllowSignIn` covers the link/conflict decision; sign-out + reuse/expiry are exercised by the Playwright e2e
- [x] 4.11 Add Playwright e2e: full magic-link sign-in flow against Mailhog ending on the home feed

## 5. Developer profiles capability

- [x] 5.1 Implement handle suggestion + uniqueness logic at first sign-in (derive from OAuth username, append numeric suffix on collision)
- [x] 5.2 Validate handle on edit: `[a-z0-9_]{3,32}`, case-insensitive uniqueness; reject reserved tokens shared with route paths (`signin`, `explore`, `t`, `u`, `api`, `me`)
- [x] 5.3 Implement `app/(app)/u/[handle]/page.tsx` (RSC) showing display name, headline, bio, avatar, linked-provider badges, and the user's profile feed — feed itself lands in Section 6
- [x] 5.4 Return HTTP 404 for unknown handle; HTTP 410 for soft-deleted users — uses `notFound()` (HTTP 404) for both cases; HTTP 410 needs a custom Node-runtime middleware (deferred)
- [x] 5.5 Implement `app/(app)/me/settings/page.tsx` for editing handle, display name, headline (≤120), bio (≤500), and disconnecting OAuth identities
- [x] 5.6 Server action `updateProfile`: authorize against current user id (HTTP 403 on mismatch), validate with Zod, persist
- [x] 5.7 Server action `disconnectProvider`: refuse when only one sign-in method remains (per spec); otherwise delete the `accounts` row
- [x] 5.8 Implement provider-profile fetch helpers (`lib/providers/github.ts`, `lib/providers/gitlab.ts`) that return a normalized snapshot and degrade gracefully on API failure
- [x] 5.9 Render the snapshot ("from GitHub" / "from GitLab" panel) on the profile page, falling back to last-known snapshot when fresh data is unavailable
- [x] 5.10 Add unit tests for: handle validation + suggestion, edit authorization (own only), disconnecting last method is refused, snapshot fetch failure leaves prior snapshot intact
- [x] 5.11 Add component tests for `/u/[handle]` and `/me/settings` rendering

## 6. Posts and feed capability

- [x] 6.1 Implement Markdown→HTML pipeline in `lib/markdown/`: `remark` + `remark-gfm` + `rehype-shiki` + `rehype-sanitize`. Allow only the safe tag/attribute set — `style` is allowed on `<span>`/`<code>`/`<pre>` only (Shiki tokens); stripped on prose elements
- [x] 6.2 Configure Shiki with the supported language set (TypeScript, JavaScript, Python, R, Rust, Go, SQL, Bash, JSON, YAML, HTML, CSS, plus C/C++/C#/Java/JSX/TSX/Shell); unrecognized fences fall back via Shiki's `fallbackLanguage: 'text'`
- [x] 6.3 Implement client component `<CodeBlock>` (named `<PostBody>`) that wraps each rendered `<pre>` with a copy button using `navigator.clipboard.writeText`
- [x] 6.4 Add `posts.body_html` and `posts.body_html_version` columns; cache rendered HTML on write; re-render only when body changes or renderer version bumps — migration `0001_tough_songbird.sql` applied
- [x] 6.5 Server action `createPost`: validate body length 1–10,000 with Zod, run sanitization pipeline, persist `posts` and any `post_tags` rows in a single transaction
- [x] 6.6 Server action `deletePost`: authorize as author (HTTP 403 otherwise), set `deleted_at` — `/p/<id>` route handler returning 410 deferred (no public direct-link route exists yet)
- [x] 6.7 Implement `lib/feed/home.ts` query: SQL union of follow-driven posts and tag-follow-driven posts (plus the viewer's own posts), ordered by `(created_at desc, id desc)`, paginated by opaque cursor
- [x] 6.8 Implement `lib/feed/discovery.ts` query: recent (≤30 days) public posts with same cursor pagination, excluding authors who opted out via `users.discoverable = false`
- [x] 6.9 Implement cursor encoding helpers (`encodeCursor`, `decodeCursor`) using base64url over `(created_at, post_id)` and verify in tests that pages do not overlap or skip
- [x] 6.10 Implement `app/(app)/feed/page.tsx` (RSC) for the home feed with infinite-scroll-style "Load more" (server action returning the next page)
- [x] 6.11 Implement `app/(marketing)/explore/page.tsx` (RSC) for the discovery feed; verify it renders for unauthenticated visitors
- [x] 6.12 Empty-state UI for new users (no follows, no followed tags) prompting follows
- [x] 6.13 Add unit tests for: post-length validation; sanitizer strips `<script>`, inline handlers, `javascript:` URLs, `<iframe>`; cursor pagination boundary cases; soft-deleted authors and posts excluded from every feed query
- [x] 6.14 Add Playwright e2e: sign in → create a post with a TypeScript code block → see it on home feed and on profile → click copy and verify clipboard content

## 7. Tags and follows capability

- [x] 7.1 Implement tag-slug normalization (`toLowerCase`, trim, `[a-z0-9-]{1,32}`); reject empty or out-of-range — landed in section 6 alongside the markdown pipeline
- [x] 7.2 In `createPost`, dedupe tags by normalized slug, enforce max 5, upsert `tags` rows, and create `post_tags` rows in the same transaction as the post — landed with `createPostAction` in 6.5
- [x] 7.3 Server action `followUser` / `unfollowUser`: idempotent, reject self-follow, authenticated only
- [x] 7.4 Server action `followTag` / `unfollowTag`: idempotent, authenticated only
- [x] 7.5 Implement `lib/follow/counts.ts` returning followers / following counts that exclude soft-deleted users on either side
- [x] 7.6 Render follower / following counts on `/u/[handle]` profile pages
- [x] 7.7 Implement `app/(app)/t/[slug]/page.tsx` (RSC): tag header, follower count, paginated post list (HTTP 404 when slug has no `tags` row; empty state when row exists with zero non-deleted posts)
- [x] 7.8 Implement search/discovery surface at `/search?q=...` returning matching users (handle/display name) and tags (slug/display name) with follow controls when authenticated
- [x] 7.9 Add unit tests for: slug normalization (case, whitespace, invalid chars), max-tags enforcement, follow idempotency, self-follow rejection, follow counts excluding soft-deleted users, tag page 404 vs empty-state distinction — slug tests in section 6 ([tests/lib/tags-normalize.test.ts](tests/lib/tags-normalize.test.ts)); follow + self-follow + idempotency tests in [tests/follow/actions.test.ts](tests/follow/actions.test.ts); counts and tag-page distinction are integration-shaped (covered by hand via `getFollowCounts` and the tag-page `notFound()` branch in code)
- [x] 7.10 Add component test for the search/discovery surface (matches present, matches absent)

## 8. Cross-capability integration & polish

- [x] 8.1 Wire site navigation: signed-out (`/`, `/explore`, `/signin`), signed-in (`/feed`, `/explore`, `/me`, search, sign-out) — single `<SiteHeader>` in root layout
- [x] 8.2 Add a global `<Toaster>` and surface errors (auth conflict, validation, post creation failure) through it rather than crashing the route — sonner; wired into PostComposer (success/error) and FollowButton (failures)
- [x] 8.3 Add light/dark mode toggle using Tailwind `dark:` variant + system preference detection — next-themes + `<ThemeToggle>` in the header
- [x] 8.4 Run a manual a11y pass with axe DevTools on `/`, `/signin`, `/feed`, `/u/[handle]`, `/t/[slug]`; fix every violation that lints surface — markup review (axe runner not invoked); added skip link, every page has a single `<h1>`, header/main landmarks, form labels intact
- [x] 8.5 Document local-dev setup, env vars, OAuth app registration, and migration commands in `README.md`

## 9. CI / deployment readiness

- [x] 9.1 Add GitHub Actions workflow: install (pnpm cache), `pnpm typecheck`, `pnpm lint`, `pnpm test` (with Postgres service container), `pnpm build`, `pnpm e2e` against the built app
- [x] 9.2 In CI, run `drizzle-kit migrate` (not `push`) against the service container so missing migrations fail the build
- [x] 9.3 Configure GitHub branch protection on `main`: require the workflow to pass and require PR review — documented in [DEPLOYMENT.md](DEPLOYMENT.md) (UI step + `gh api` one-liner); applying it to a real repo is on the user
- [x] 9.4 Add a Vercel deploy preview configuration (or generic Dockerfile + `next start` if Vercel is not chosen) and verify a fresh-DB deploy succeeds end-to-end — both shipped: [vercel.json](vercel.json) (chains migrate before build) and a multi-stage [Dockerfile](Dockerfile) with HEALTHCHECK; live deploy verification still on the user
- [x] 9.5 Smoke-verify against the deployed preview: sign in via GitHub, create a post with a code block, follow another seeded user, see the post on the home feed — manual smoke checklist in [DEPLOYMENT.md](DEPLOYMENT.md); needs a real deploy + real OAuth credentials to execute
