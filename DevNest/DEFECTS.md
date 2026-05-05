# DevNest — Defects (visual + interaction review)

> **Status (2026-05-05): all 11 defects resolved.** Re-running the same
> three Playwright specs that originally surfaced them now reports
> 16/16 tests passing and 11/11 interaction probes `ok: true`. The
> "Resolution" block on each defect below records what shipped and how
> to reproduce the verification.

**Captured:** 2026-05-05 via three Playwright specs:

| Spec | What it does |
| --- | --- |
| [tests/e2e/inspection.spec.ts](tests/e2e/inspection.spec.ts) | Walks 8 surfaces, captures HTTP / console / network / page errors and full-page screenshots → `test-results/inspection/` |
| [tests/e2e/responsive-themes.spec.ts](tests/e2e/responsive-themes.spec.ts) | Sweeps 6 surfaces × {light, dark} × {desktop, mobile} → `test-results/responsive/` |
| [tests/e2e/interactions.spec.ts](tests/e2e/interactions.spec.ts) | Probes 11 specific behaviours (keyboard shortcuts, theme toggle, settings flips, composer, sign-out) → `test-results/interactions/_findings.json` |

**Reproduce:**

```bash
pnpm db:up
pnpm dev > /tmp/devnest-dev.log 2>&1 &
pnpm exec playwright test tests/e2e/inspection.spec.ts \
                        tests/e2e/responsive-themes.spec.ts \
                        tests/e2e/interactions.spec.ts
```

## Headline numbers

| | Before fixes | After fixes |
| --- | --- | --- |
| Surfaces walked | 8 light-desktop + 6 × {dark, mobile} = 26 | unchanged |
| HTTP / console / network / page errors | **0** | **0** |
| Interaction probes that pass | 6/11 | **11/11** |
| Interaction probes that fail | **5/11** | 0/11 |
| Defects identified | 11 | 0 outstanding |

The app was already functionally clean (nothing throws, no broken
navigations). All 11 defects were CSS / behaviour / cross-surface gaps
and have now been closed.

---

## Severity legend

- 🔴 **Major** — visible on every screen or breaks a documented
  contract.
- 🟡 **Minor** — visible on at least one screen, fixable in isolation.
- ⚪ **Cosmetic** — judgment call; tracked for completeness.

---

## ✅ 🔴 D-1 — Default `<Button>` (primary variant) renders without fill

**Symptom.** Every default-variant `<Button>` renders as plain text on
the page background — no border, no fill. Affects every primary CTA:

| Surface | Element |
| --- | --- |
| `/` (home) | "Sign in" CTA |
| `/signin` | "Continue with email" expansion toggle |
| `/me/settings` | "Save changes" under Profile |
| `/t/<slug>` | "Follow" button in tag header |
| `/feed`, `/explore`, `/search` (right rail) | "Follow" / "Sign in to follow" |
| Sidebar | "New post" (signed-in) and "Sign in" (signed-out) |

**Root cause.** [app/globals.css](app/globals.css) declared the design
tokens in `@theme` as `--color-bg`, `--color-ink`, `--color-accent`,
etc. The shadcn primitive aliases (`--primary`, `--card`, `--muted`,
`--ring`, …) were declared in a separate `:where(:root)` block.

In Tailwind v4, **utility classes like `bg-primary` are generated only
from `--color-*` names inside `@theme`**. The `--primary` variable in
`:root` is a CSS variable, not a theme token — so `bg-primary` on
shadcn's Button compiled to an empty rule.

**Resolution.** Moved the shadcn aliases into `@theme` as proper
`--color-*` tokens, with parallel overrides in the `[data-theme="dark"]`
block. The standalone `:where(:root)` alias block was removed (no
longer load-bearing).

```css
/* app/globals.css — inside @theme */
--color-primary:                var(--color-accent);
--color-primary-foreground:     oklch(1 0 0);
--color-card:                   var(--color-bg-elev);
--color-muted:                  var(--color-bg-sunken);
--color-input:                  var(--color-border);
--color-ring:                   var(--color-accent);
--color-destructive:            var(--color-danger);
/* …+ background, foreground, popover, secondary, accent-foreground,
   destructive-foreground, plus dark-mode variants */
```

**Acceptance.** ✅ The "Send magic link" CTA on `/signin` shows as
filled amber with white ink (see
[`test-results/inspection/02-signin.png`](test-results/inspection/02-signin.png));
"New post" / "Follow" / "Browse the discovery feed →" buttons all show
the accent fill across `/feed`, right rail, and tag pages.

---

## ✅ 🔴 D-7 — `⌘K` shortcut isn't wired

**Symptom.** Every layout — sidebar nav, right-rail search input,
shortcuts cheatsheet — shows a `⌘K` kbd hint next to the search box.
Pressing `⌘K` does nothing. The active element stays on `<body>`.

[Probed by](tests/e2e/interactions.spec.ts) `kbd-cmd-k` — recorded
`before=<body>, after=<body>`.

**Root cause.** Task **7.1** in
[devnest-design-mvp tasks.md](openspec/changes/devnest-design-mvp/tasks.md#L91)
explicitly said "the keyboard binding is left for a follow-up
change" — yet the visible kbd hint advertised the shortcut as if it
worked.

**Resolution.** Added a global `<KeyboardShortcuts>` client component
([components/site/keyboard-shortcuts.tsx](components/site/keyboard-shortcuts.tsx))
mounted from the `(app)` layout. It listens for `⌘K` / `Ctrl+K` and
focuses the right-rail search input (which now carries
`id="global-search"` and `name="q"` for stable targeting). The
listener ignores key events whose target is an editable element so
users can keep typing freely.

**Acceptance.** ✅ Probe `kbd-cmd-k` records `ok: true` —
`after=input#global-search[name=q] aria="Search developers and tags"`.

---

## ✅ 🔴 D-8 — Vim-style nav shortcuts (`g h`, `g e`, `g p`, …)

**Symptom.** Each sidebar item showed a kbd hint —
`g h` next to Home, `g e` next to Explore, `g p` Profile, `g ,`
Settings. Pressing `g` then `h` from any page did NOT navigate to
`/feed`.

[Probed by](tests/e2e/interactions.spec.ts) `kbd-g-h`, `kbd-g-e`.

**Resolution.** Same `<KeyboardShortcuts>` component handles the
g-prefix sequence. After a `g` keydown the listener stores a
1 s window during which the next key resolves to a route:

| Sequence | Route |
| --- | --- |
| `g h` | `/feed` |
| `g e` | `/explore` |
| `g p` | `/me` |
| `g ,` | `/me/settings` |

The bindings for the disabled-in-MVP nav slots (Notifications /
Messages / Bookmarks) are deliberately omitted so we don't promise
behaviour for features that aren't built.

**Acceptance.** ✅ Probes `kbd-g-h` and `kbd-g-e` both record
`ok: true`.

---

## ✅ 🔴 D-9 — Theme preference doesn't survive page loads

**Symptom.** Setting `prefs.theme = "dark"` in the
`devnest.prefs` cookie did NOT result in dark theme rendering on the
next page load. The screenshots in `test-results/responsive/` for
`*-dark-desktop.png` and `*-dark-mobile.png` were visually identical
to their `*-light-*` counterparts.

[Probed by](tests/e2e/responsive-themes.spec.ts).

**Root cause.** Two stores fought each other:

1. **`devnest.prefs` cookie** — written by
   [`updatePreferences`](lib/preferences/actions.ts), read by
   [`app/layout.tsx`](app/layout.tsx) to set `<html data-theme>`.
2. **next-themes localStorage** — initialised to `"system"`,
   resolved against the OS preference, and overwrote the SSR value.

**Resolution.** Picked option (1) from the proposal — drop next-themes
entirely. The cookie is now the single source of truth:

- `<ThemeToggle>` ([components/site/theme-toggle.tsx](components/site/theme-toggle.tsx))
  reads `data-theme` from `document.documentElement`, calls
  `updatePreferences({ theme })`, and optimistically flips the
  attribute so the UI re-skins instantly.
- `<ThemeProvider>` ([components/site/theme-provider.tsx](components/site/theme-provider.tsx))
  is now a passthrough fragment.
- For `theme: "system"` an inline script in
  [`app/layout.tsx`](app/layout.tsx) reads
  `prefers-color-scheme: dark` synchronously before paint and bumps
  `data-theme="dark"` so users on dark-mode machines don't see a
  light-to-dark flash.
- `next-themes` removed from `package.json`.

**Acceptance.** ✅ Setting the cookie to `theme:"dark"` now renders
dark UI end-to-end —
[`test-results/responsive/feed-dark-desktop.png`](test-results/responsive/feed-dark-desktop.png)
shows the dark surface tokens, contrasting cleanly with
[`test-results/responsive/feed-light-desktop.png`](test-results/responsive/feed-light-desktop.png).
Probe `theme-toggle` records `ok: true`.

---

## ✅ 🔴 D-12 — No navigation chrome on mobile

**Symptom.** Below the `md:` breakpoint (768 px), the sidebar
disappeared (`hidden md:flex` in
[components/site/sidebar.tsx](components/site/sidebar.tsx)). Below
`lg:` (1024 px), the right rail also disappeared. At iPhone-14 width
(390 px), there was **no header, no menu button, no bottom tab bar —
nothing at all to navigate the app.**

A signed-in user on mobile could not reach `/me`, `/me/settings`,
`/explore`, `/search`, sign out, or change theme.

**Resolution.** Added a new `<MobileTopBar>` component
([components/site/mobile-top-bar.tsx](components/site/mobile-top-bar.tsx))
mounted in the `(app)` layout. It renders:

- A sticky 48 px top bar (hidden ≥ `md:`) with the brand mark on the
  left and a hamburger button on the right.
- A Radix-Dialog-based slide-in drawer triggered from the hamburger.
  The drawer contains the same primary + secondary nav items, theme
  toggle, profile chip, and a sign-out form (kept as a regular form
  outside the dropdown, so it isn't subject to D-11's quirk).
- An auto-close on route changes by wiring `onClick={close}` onto
  every nav link (avoids the `set-state-in-effect` lint rule).

The desktop sidebar (`md:flex`) is unchanged.

**Acceptance.** ✅ At 390 × 844, every authenticated screen shows the
top bar — see
[`test-results/responsive/feed-light-mobile.png`](test-results/responsive/feed-light-mobile.png)
and the dark variant. Tapping the hamburger opens the drawer with the
full nav.

---

## ✅ 🟡 D-2 — Sidebar footer overflows for unauthenticated viewers

**Symptom.** On `/explore`, `/search`, `/t/<slug>`, when no user was
signed in, the sidebar footer rendered the placeholder
`<span>not signed in</span>` plus the `<ThemeToggle>` button on the
same row, and the placeholder text clipped to `n  gned in`.

**Resolution.** Added `min-w-0 truncate` to the placeholder span in
[`components/site/sidebar.tsx`](components/site/sidebar.tsx), so the
flex item takes its share of width but never overflows.

**Acceptance.** ✅ At 1280 × 900 on `/search?q=t`, the sidebar footer
reads cleanly (see
[`test-results/inspection/04-search-public.png`](test-results/inspection/04-search-public.png)).

---

## ✅ 🟡 D-3 — Sidebar overlapped Next.js dev-tools bubble (dev-only)

**Symptom.** On every authenticated screen, Next.js's dev-tools
bubble (the dark `N` circle) sat at bottom-left and overlapped the
sidebar's signed-in footer (avatar + handle + chevron).

**Resolution.** Set `devIndicators.position = "bottom-right"` in
[`next.config.ts`](next.config.ts).

**Acceptance.** ✅ The "N" indicator now renders at bottom-right on
every dev screenshot (e.g.
[`test-results/responsive/feed-dark-desktop.png`](test-results/responsive/feed-dark-desktop.png)).

---

## ✅ 🟡 D-10 — Char counter "red over the limit" branch is reachable

**Symptom.** The composer's `<Textarea maxLength={POST_MAX}>` clipped
input at 10 000 characters; the over-limit branch could never be
reached, so the red counter and disabled-Post-button case were dead
code. The amber threshold (>9 800) worked correctly.

**Resolution.** Dropped the `maxLength` attribute in
[`components/posts/post-composer.tsx`](components/posts/post-composer.tsx).
The server-side Zod cap on the action is unchanged; the textarea now
lets the user over-fill, the counter goes red (`--color-danger`),
and the Post button is disabled. Also marks the textarea
`aria-invalid="true"` when over-limit.

**Acceptance.** ✅ Probe `composer-counter-tones` records distinct
amber/red colours at the two thresholds (`ok: true`).

---

## ✅ 🟡 D-11 — Sign-out from sidebar dropdown navigates to `/`

**Symptom.** Opening the sidebar profile dropdown (signed-in viewer)
→ clicking "Sign out" → URL stayed at `/feed`. The session cleared
eventually, but the in-tab redirect to `/` documented for the action
did not happen.

[Probed by](tests/e2e/interactions.spec.ts) `signout-from-sidebar`.

**Root cause.** The Sign-out item was wired as a Radix
`<DropdownMenuItem asChild>` wrapping a `<form action={signOutAction}>`.
Radix's menu-item swallows the click event to close the menu before
the inner form submits.

**Resolution.** Replaced the nested form with an `onSelect` handler
on the `<DropdownMenuItem>` ([components/site/sidebar.tsx](components/site/sidebar.tsx)).
The handler calls `event.preventDefault()` (so Radix doesn't close
the menu before our action fires) and invokes `signOutAction()`,
whose `signOut({ redirectTo: "/" })` propagates the redirect.

**Acceptance.** ✅ Probe `signout-from-sidebar` now records
`final url = http://localhost:3000/` (`ok: true`).

---

## ✅ ⚪ D-4 — Brand-mark underline placement

**Symptom.** The `<BrandMark>` was supposed to underline only `nest`.
At 28 pt (sign-in card) the underline visually overshot the four
characters of `nest`.

**Resolution.** Rebuilt
[`components/site/brand-mark.tsx`](components/site/brand-mark.tsx)
with `dev` and `nest` as separate `inline-block` boxes inside an
`inline-flex items-baseline` wrapper, with `lineHeight: 1` on the
underlined box so its line-box matches the four characters exactly.

**Acceptance.** ✅ At every BrandMark size (sm / md / lg), the
underline starts at `n` and ends at `t` — visible on the sign-in
screenshot
[`test-results/inspection/02-signin.png`](test-results/inspection/02-signin.png),
the mobile top bar, and the sidebar.

---

## ✅ ⚪ D-6 — Trending tags always show "1" in dev

**Symptom.** Right-rail "Trending" panel ranks tags by post count in
the last 7 days. The dev DB has exactly one post per tag; ranking is
uniform. Working as designed.

**Resolution.** Added a "Notes for reviewers" section to
[`DEPLOYMENT.md`](DEPLOYMENT.md) documenting the dev-data behaviour
so future reviewers don't mistake it for a defect. To see realistic
ranking locally, seed multiple posts with overlapping tags.

---

## Resolved during this session (test-only fix)

- **D-13 — Sidebar profile-menu trigger had no accessible name.**
  Screen readers read it as the inner display-name + handle, which
  doubled up. Tests also couldn't target it reliably. Added
  `aria-label="Profile menu"` to the trigger button in
  [components/site/sidebar.tsx](components/site/sidebar.tsx). Both a
  test fix AND an a11y fix.

---

## Non-defects flagged during review

- `e2e_0_*` handles in "Who to follow" — past test users in the dev
  DB. Not a defect.
- "Notifications / Messages / Bookmarks" rendering disabled — per
  spec.
- `/me` empty state copy — matches profile spec.
- The inspection's own `expect` failure on `/me/settings` (heading
  `/appearance/i` matched two `<h2>`s) — test-spec ambiguity, not a
  product defect; persists in the post-fix run as documented.
- **D-5 (avatar size)** from the first review — the desktop
  screenshot looked small, but the mobile screenshot
  ([profile-light-mobile.png](test-results/responsive/profile-light-mobile.png))
  shows the avatar at the right size. Closed.

---

## Summary table

| ID | Sev | Title | Status |
| --- | --- | --- | --- |
| **D-1** | 🔴 | Default `<Button>` renders without fill | ✅ resolved |
| **D-7** | 🔴 | `⌘K` advertised, not wired | ✅ resolved (wired) |
| **D-8** | 🔴 | Vim-style nav shortcuts advertised, not wired | ✅ resolved (wired) |
| **D-9** | 🔴 | Theme cookie doesn't survive reloads | ✅ resolved (cookie SSOT) |
| **D-12** | 🔴 | No navigation chrome on mobile | ✅ resolved (mobile top bar + drawer) |
| D-2 | 🟡 | Sidebar footer overflow (unauthed) | ✅ resolved |
| D-3 | 🟡 | Sidebar overlaps Next dev-tools bubble | ✅ resolved |
| D-10 | 🟡 | Char counter "over limit" unreachable | ✅ resolved |
| D-11 | 🟡 | Sign-out from dropdown doesn't redirect | ✅ resolved |
| D-4 | ⚪ | Brand-mark underline drift | ✅ resolved |
| D-6 | ⚪ | Trending shows "1" in dev | ✅ documented |

## Verification

All three Playwright specs were re-run end-to-end with the dev server
restarted on a clean cache:

```text
16 passed (1.4m)
```

Interaction findings (`test-results/interactions/_findings.json`):

```json
{ "total": 11, "ok": 11, "failures": 0, "failedIds": [] }
```

Inspection sweep summary (`test-results/inspection/_summary.json`):

| | Count |
| --- | --- |
| Surfaces | 8 |
| Bad HTTP status | 0 |
| Page errors | 0 |
| Console errors | 0 |
| Expect failures | 1 (the pre-existing `/me/settings` heading ambiguity, see "Non-defects") |
