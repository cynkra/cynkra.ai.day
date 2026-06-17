---
name: devnest-playwright
description: |
  End-to-end workflow for debugging the DevNest Next.js app with the
  Playwright MCP. Covers starting the dev server, connecting Playwright,
  iterating with screenshots and console logs, sign-in via Mailhog, and
  cleaning up.
argument-hint: "<task description>"
---

# devnest-playwright

Debug the DevNest app interactively using the Playwright MCP server.

## Setup

The Playwright MCP server should be configured in the user's Claude config
(typically `.claude/mcp.json`). On macOS dev machines no special browser
install is needed beyond the once-off `pnpm exec playwright install chromium`
that already ran during section-9 setup.

If Playwright can't find a browser, run:

```bash
pnpm exec playwright install chromium
```

Do NOT spend time hand-installing Chrome — Playwright self-hosts a pinned
Chromium under `~/Library/Caches/ms-playwright/`.

## Workflow

### Step 0 — Decide what you're debugging

Most defect hunts come in two shapes:

| Shape | Example | Approach |
|---|---|---|
| **Server-side** (RSC render error, DB / Auth.js issue, server action throw) | "/feed returns 500", "post creation silently no-ops" | Tail the dev-server log, hit the route, read the log, fix server code |
| **Client-side** (layout, hydration, JS error, focus, shadcn variant) | "code-block copy button doesn't appear in dark mode" | Drive Playwright through the UI, screenshot, read console messages, inspect DOM |

Most issues turn out to be a mix; have both telemetry channels open from the
start.

### Step 1 — Make sure the supporting services are up

```bash
# Postgres + Mailhog (for magic-link sign-in)
pnpm db:up

# Verify Postgres
docker exec devnest-postgres pg_isready -U devnest -d devnest
# Verify Mailhog UI
curl -sI http://localhost:8025 | head -1   # expect 200
```

If migrations haven't run on this DB:

```bash
DATABASE_URL=postgres://devnest:devnest@localhost:5432/devnest pnpm db:migrate
```

### Step 2 — Start the dev server

Free port 3000 first (see **Killing the App** below), then:

```bash
pnpm dev > /tmp/devnest-dev.log 2>&1 &
```

Wait and verify:

```bash
until grep -qE 'Ready in|Local:' /tmp/devnest-dev.log 2>/dev/null; do sleep 1; done
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000  # expect 200
```

If it doesn't return 200, **always read the log first**:

```bash
tail -50 /tmp/devnest-dev.log
```

Common patterns:

- `Cannot apply unknown utility class …` — Tailwind v4 token mismatch in
  `app/globals.css` (token defined in `:root`, referenced as a utility).
  Fix: declare the token in `@theme` instead.
- `Functions are not valid as a child of Client Components` — a server
  component is passing a function (render prop / action) into a client
  component as `children`. Fix: pass `ReactNode` instead, or split the
  client/server boundary differently.
- `[auth][error] Error: Provider with id "…" not found` — the magic-link
  URL extracted from Mailhog has a quoted-printable artefact (`=3D` etc.).
  Decode QP before regex-matching.
- `relation "…" does not exist` — Postgres migrations haven't run on this
  DB. Run `pnpm db:migrate`.

### Step 3 — Connect with Playwright MCP

1. `browser_navigate` to `http://localhost:3000`
2. `browser_wait_for` 2-3 s for Next.js compile + RSC stream
3. `browser_take_screenshot` to confirm

Key surfaces to walk:

- `/` — public landing
- `/signin` — auth card, three providers, "Continue with email" expansion
- `/feed` — sidebar + composer + feed (signed-in)
- `/explore` — public discovery feed
- `/u/<handle>` — public profile page
- `/t/<slug>` — tag page
- `/me` — current-user profile (signed-in)
- `/me/settings` — profile edit + appearance / density / code blocks / layout
- `/search?q=react` — search results
- `/api/health` — JSON health probe (200/503)

### Step 4 — Sign in via magic link

Real GitHub / GitLab OAuth requires registered apps + valid credentials in
`.env.local`. The fast path is the magic-link flow which doesn't require
any external service:

1. `browser_navigate` `http://localhost:3000/signin`
2. `browser_click` the "Continue with email" button (the email input is
   collapsed by default per the design)
3. `browser_type` an email like `e2e-<timestamp>@local`
4. `browser_click` "Send magic link" — page redirects to `/signin/check-email`
5. Fetch the link from Mailhog's API and visit it:

```bash
curl -s 'http://localhost:8025/api/v2/messages?limit=1' \
  | jq -r '.items[0].Content.Body' \
  | python3 -c '
import sys, re
body = sys.stdin.read()
# Mailhog ships quoted-printable; decode soft breaks + =XX hex.
body = re.sub(r"=\r?\n", "", body)
body = re.sub(r"=([0-9A-Fa-f]{2})", lambda m: chr(int(m.group(1), 16)), body)
m = re.search(r"https?://[^\s\"<>]*/api/auth/callback/[^\s\"<>]+", body)
print(m.group(0) if m else "")
'
```

Then `browser_navigate` to that URL — you'll land on `/feed` signed in.

### Step 5 — Debug Loop

Repeat as needed:

1. **Screenshot** — `browser_take_screenshot` for visual state
2. **Snapshot** — `browser_snapshot` for the accessibility tree + element refs
3. **Interact** — `browser_click`, `browser_type`, `browser_fill_form` to
   drive the UI
4. **Read logs**:
   - `browser_console_messages` for client-side JS errors
   - `tail -100 /tmp/devnest-dev.log` for server-side errors
   - `docker exec devnest-postgres psql -U devnest -d devnest -c "select …"`
     when you suspect DB state
5. **Modify code** — Next.js HMR usually picks up changes, but
   `app/globals.css` token edits or `next.config.ts` changes need a server
   restart (Step 6 + Step 2).

### Step 6 — Killing the App

```bash
# Find the PID
lsof -ti :3000

# Kill it
kill -9 $(lsof -ti :3000) 2>/dev/null; sleep 1

# Verify port is free
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000
# 000 (connection refused) means the port is free
```

If you started it from a Bash tool with `run_in_background`, prefer
`TaskStop <task_id>` so the wrapper exits cleanly too.

---

## Server-side debug logging

`lib/logger.ts` already exposes a request-scoped pino logger. Add log lines
where you need them:

```ts
import { getLogger } from "@/lib/logger";

export async function someServerAction() {
  const log = await getLogger();
  log.info({ userId, target }, "follow attempted");
}
```

The logs land in `/tmp/devnest-dev.log` (or wherever you redirected stdout).
They include the request id from the middleware, so you can correlate a
client-visible error reference back to the server log line.

## Client-side debug logging

`lib/logger.ts` is server-only. For client components, use plain
`console.log` / `console.error` and pull them with
`browser_console_messages`. The `<PostBody>` and `<FollowButton>` already
log errors to the console for the same reason.

## Database introspection

DevNest's MVP DB is small enough to query directly during a debug session:

```bash
# All recent posts
docker exec devnest-postgres psql -U devnest -d devnest \
  -c "select id, author_id, length(body), deleted_at, created_at from posts order by created_at desc limit 5;"

# A user's follow graph
docker exec devnest-postgres psql -U devnest -d devnest \
  -c "select count(*) as following from follows where follower_id = 'USER_ID';"

# Currently linked OAuth identities
docker exec devnest-postgres psql -U devnest -d devnest \
  -c "select user_id, provider from accounts;"
```

## Playwright MCP Tool Reference

| Tool | Purpose |
|---|---|
| `browser_navigate` | Go to a URL |
| `browser_take_screenshot` | Capture the current viewport as image |
| `browser_snapshot` | Get accessibility tree with element refs |
| `browser_click` | Click an element by ref |
| `browser_type` | Type text into a focused element |
| `browser_console_messages` | Retrieve recent JS console output |
| `browser_drag` | Drag from one element to another |
| `browser_wait_for` | Wait for text/time |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_select_option` | Select dropdown option |

All tools are prefixed with `mcp__playwright__` when called via the MCP
integration.

## Tips

- **First Next.js compile is slow** — 3-5 s on a cold start, sometimes
  longer. Wait for "Ready in …" in the dev log, OR for the actual page
  HTML, before screenshotting.
- **RSC streams** — pages render in stages; if a panel is missing, wait
  another second. Use `browser_wait_for` with text content rather than a
  fixed delay.
- **Always snapshot before clicking** — `browser_snapshot` first, then
  `browser_click` with the ref. Don't guess at selectors.
- **Theme / density / layout changes** are CSS-variable-driven, not
  full re-renders. After flipping a preference you don't need to reload.
- **Toasts** appear bottom-right (sonner). They're outside the main DOM
  tree (portal) — query by role `status` or `alert`.
- **Magic-link emails** stay in Mailhog forever for the dev session;
  always work with the most recent message and use the recipient address
  to match.
- **Port conflicts** — if 3000 is busy, kill the old process (Step 6).
  Don't let Next.js auto-fall to 3001 in CI scenarios — the e2e
  config assumes 3000.
- **Multiple sessions** — each `pnpm dev` runs one server. Stop it before
  starting a new one.

## When to write a real test instead

Interactive Playwright is for exploration. When you reproduce a defect or
verify a fix that's worth keeping locked in, write a Playwright spec under
`tests/e2e/`. The existing `tests/e2e/_helpers.ts` has a
`signInViaMagicLink(page, request, workerIndex)` helper that's already
used by the magic-link and create-post specs.
