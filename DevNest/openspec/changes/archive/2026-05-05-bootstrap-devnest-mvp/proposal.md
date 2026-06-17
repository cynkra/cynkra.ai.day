## Why

DevNest is a greenfield social network built for software developers. The
product vision spans a full social platform (profiles, feed, tags/follows,
code snippets, OAuth, deep GitHub/GitLab integration, interactions, DMs,
notifications, trust & safety), but shipping all of that as one change
would be unreviewable and unfinishable. This change establishes the
foundation and a focused MVP slice so the team has a working,
demonstrable product to iterate on, with the remaining vision items
explicitly scoped as follow-up changes.

## What Changes

- **Establish the project**: scaffold a Next.js (App Router) + TypeScript
  + Postgres codebase with the baseline tooling (auth, ORM, styling,
  testing, CI) needed by every later feature. Detailed stack choices
  belong in design.md.
- **Ship MVP capabilities** (items 1–5 of the product vision):
  - **Auth**: sign in with GitHub or GitLab OAuth, with email
    magic-link as fallback.
  - **Developer profiles**: rich profile page with headline, bio,
    avatar from the OAuth provider, and a basic surface for repos /
    top languages pulled from the connected GitHub/GitLab account
    (depth of integration kept minimal here; full integration is a
    follow-up change covering item 6).
  - **Posts and feed**: authenticated users can create text posts
    that support fenced code blocks with syntax highlighting and
    one-click copy. Logged-in users see a chronological feed of
    posts from people they follow plus a public discovery feed.
  - **Tags and follows**: posts can carry topic tags; users can
    follow other users and tags. Following drives the home feed.
- **Define non-goals for this change** so reviewers know what's
  intentionally deferred:
  - Interactions beyond plain post creation (comments, reactions,
    reposts, quote-posts) — deferred to a later change covering
    item 7.
  - Direct messaging (item 8), notifications (item 9), and trust &
    safety tooling (item 10) — each its own later change.
  - Deep GitHub/GitLab integration (contribution graphs, repo
    pinning, language stats) beyond what OAuth gives us for free —
    deferred to a follow-up change covering item 6.
  - Algorithmic ranking of the feed — chronological only in MVP.

## Capabilities

### New Capabilities

- `project-foundation`: baseline behavioral contract for the platform
  itself — environment configuration, health check, request-id
  propagation, error pages, and the rules for how every later
  capability plugs in. Lives here so that "the app boots and is
  observable" has a spec, not just code.
- `auth`: GitHub OAuth, GitLab OAuth, and email magic-link sign-in;
  session lifecycle (issue, refresh, revoke, sign-out); account
  linking when the same email is used across providers.
- `developer-profiles`: viewing and editing a developer profile —
  handle, display name, headline, bio, avatar, linked OAuth
  identities, and a minimal "from GitHub/GitLab" panel populated at
  sign-in.
- `posts-and-feed`: creating, viewing, and deleting a user's own
  text-with-code posts; rendering fenced code blocks with syntax
  highlighting and a copy button; the home feed (people you follow)
  and the public discovery feed, both chronological.
- `tags-and-follows`: attaching topic tags to a post; following and
  unfollowing users and tags; the follow graph that drives the home
  feed and the discovery surfaces for finding people and tags.

### Modified Capabilities

<!-- None: this is the first change in a greenfield project. -->

## Impact

- **Code**: creates the entire repository — Next.js app, Postgres
  schema, OAuth callbacks, feed rendering, profile pages. Nothing
  to migrate; nothing to break.
- **APIs**: introduces the first internal route handlers / server
  actions — exact surface to be designed in design.md.
- **Dependencies**: Next.js, React, TypeScript, a Postgres ORM
  (Prisma or Drizzle — picked in design.md), an auth library
  (Auth.js / NextAuth or equivalent), a syntax-highlighting library
  (Shiki or Prism), and the test stack (Vitest + Testing Library +
  Playwright).
- **Infrastructure**: requires a Postgres database (managed Postgres
  for prod, local Docker for dev), GitHub and GitLab OAuth apps,
  and an SMTP provider for magic-link email. Concrete hosting choice
  deferred to design.md.
- **Follow-up changes**: items 6–10 of the product vision each
  become their own OpenSpec change, building on the foundation laid
  here.
