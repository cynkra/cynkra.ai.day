# DevNest — Defects (visual + interaction review)

**Captured:** 2026-05-05 via three Playwright specs:

| Spec | What it does |
|---|---|
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

| | Count |
|---|---|
| Surfaces walked | 8 light-desktop + 6 × {dark, mobile} = 26 |
| HTTP / console / network / page errors | **0** |
| Interaction probes that pass | 6/11 |
| Interaction probes that fail | **5/11** |
| Defects identified | 11 |

The app is functionally clean (nothing throws, no broken navigations,
no network errors). All defects are CSS / behaviour / cross-surface
gaps.

---

## Severity legend

- 🔴 **Major** — visible on every screen or breaks a documented
  contract.
- 🟡 **Minor** — visible on at least one screen, fixable in isolation.
- ⚪ **Cosmetic** — judgment call; tracked for completeness.

---

## 🔴 D-1 — Default `<Button>` (primary variant) renders without fill

**Symptom.** Every default-variant `<Button>` renders as plain text on
the page background — no border, no fill. Affects every primary CTA:

| Surface | Element |
|---|---|
| `/` (home) | "Sign in" CTA |
| `/signin` | "Continue with email" expansion toggle |
| `/me/settings` | "Save changes" under Profile |
| `/t/<slug>` | "Follow" button in tag header |
| `/feed`, `/explore`, `/search` (right rail) | "Follow" / "Sign in to follow" |
| Sidebar | "New post" (signed-in) and "Sign in" (signed-out) |

**Root cause.** [app/globals.css](app/globals.css) declares the design
tokens in `@theme` as `--color-bg`, `--color-ink`, `--color-accent`,
etc. The shadcn primitive aliases (`--primary`, `--card`, `--muted`,
`--ring`, …) are declared in a separate `:where(:root)` block.

In Tailwind v4, **utility classes like `bg-primary` are generated only
from `--color-*` names inside `@theme`**. The `--primary` variable in
`:root` is a CSS variable, not a theme token — so `bg-primary` on
shadcn's Button compiles to an empty rule.

**Fix.** Move the shadcn aliases into `@theme` as `--color-*` tokens.

```css
/* app/globals.css */
@theme {
  /* … existing DevNest tokens … */
  --color-primary:                oklch(0.62 0.16 35); /* same as --color-accent */
  --color-primary-foreground:     oklch(1 0 0);
  --color-card:                   oklch(1.00 0.000 0);
  --color-card-foreground:        oklch(0.22 0.01  270);
  --color-muted:                  oklch(0.97 0.005 270);
  --color-muted-foreground:       oklch(0.45 0.01  270);
  --color-secondary:              oklch(0.97 0.005 270);
  --color-secondary-foreground:   oklch(0.22 0.01  270);
  --color-destructive:            oklch(0.58 0.20 25);
  --color-destructive-foreground: oklch(0.985 0 0);
  --color-input:                  oklch(0.92 0.005 270);
  --color-ring:                   oklch(0.62 0.16 35);
}
```

…and matching dark-theme overrides under `[data-theme="dark"]`. Once
the tokens live in `@theme`, the `:where(:root) { --primary: var(--color-accent); … }`
block can be deleted.

**Acceptance.** The home `Sign in` CTA shows as filled amber with
white ink; matches design.md § `<Button>` `primary` row. Re-run
`pnpm exec playwright test tests/e2e/inspection.spec.ts` and visually
diff the new screenshots against the originals.

---

## 🔴 D-7 — `⌘K` shortcut isn't wired

**Symptom.** Every layout — sidebar nav, right-rail search input,
shortcuts cheatsheet — shows a `⌘K` kbd hint next to the search box.
Pressing `⌘K` does nothing. The active element stays on `<body>`.

[Probed by](tests/e2e/interactions.spec.ts) `kbd-cmd-k` — recorded
`before=<body>, after=<body>`.

**Root cause.** Task **7.1** in
[devnest-design-mvp tasks.md](openspec/changes/devnest-design-mvp/tasks.md#L91)
explicitly says "the keyboard binding is left for a follow-up
change" — yet the visible kbd hint advertises the shortcut as if it
works. The UI promises something it doesn't deliver.

**Fix options.**

1. **Wire it.** Add a global `keydown` listener (e.g. in the root
   layout or a small client component) that intercepts `Cmd/Ctrl+K`,
   focuses the search input. ~15 min.
2. **Remove the kbd hint** until the binding is wired. The hint lives
   in [components/site/right-rail.tsx](components/site/right-rail.tsx)
   (`<kbd>⌘K</kbd>` next to the search input) and the Shortcuts
   cheatsheet in the same file. ~2 min.

(1) is the right end-state. (2) is the right *immediate* fix — better
to omit a hint than to lie about it.

**Acceptance.** Either: (a) `⌘K` from anywhere in the app focuses the
search input, or (b) the `⌘K` hint disappears.

---

## 🔴 D-8 — Vim-style nav shortcuts (`g h`, `g e`, `g p`, …) don't work

**Symptom.** Each sidebar item shows a kbd hint —
`g h` next to Home, `g e` next to Explore, `g n` next to Notifications,
`g m` Messages, `g b` Bookmarks, `g p` Profile, `g ,` Settings.
Pressing `g` then `h` from any page does NOT navigate to `/feed`.

[Probed by](tests/e2e/interactions.spec.ts) `kbd-g-h`, `kbd-g-e` —
both recorded the URL unchanged after the keystrokes.

**Root cause.** Same as D-7: visual hint advertised, binding deferred.

**Fix.** Either implement the bindings (a small global key-sequence
listener — `g` + next key, with a 1 s timeout window — wired to
`router.push()`) or strip the hints until the bindings ship. Same
two-tier choice as D-7.

**Acceptance.** Either: (a) `g h` from anywhere navigates to `/feed`
(and the rest of the sequences work), or (b) the kbd hints next to
sidebar items are gone.

---

## 🔴 D-9 — Theme preference doesn't survive page loads (cookie ↔ next-themes desync)

**Symptom.** Setting `prefs.theme = "dark"` in the
`devnest.prefs` cookie does NOT result in dark theme rendering on the
next page load. The screenshots in `test-results/responsive/` for
`*-dark-desktop.png` and `*-dark-mobile.png` are visually identical
to their `*-light-*` counterparts.

[Probed by](tests/e2e/responsive-themes.spec.ts) — cookie set to
`{theme:"dark"}` before navigation; rendered surface stays light.

**Root cause.** Two stores of the theme preference fight each other:

1. **Our `devnest.prefs` cookie** — written by the
   [updatePreferences server action](lib/preferences/actions.ts);
   read by the [root layout](app/layout.tsx) to set
   `<html data-theme="…">` on first paint.
2. **next-themes localStorage** — written by `setTheme()` calls from
   the [`<ThemeToggle>`](components/site/theme-toggle.tsx); read by
   `<NextThemeProvider>` on hydration.

After hydration, next-themes sees its localStorage default
(`"system"`), resolves it to the OS preference (light, on this dev
machine), and overwrites our server-set `data-theme="dark"`. End
result: **the cookie-stored preference is silently ignored**.

The interactions probe `theme-toggle` does pass — but only because it
clicks the in-app toggle (which writes localStorage) and immediately
reads the attribute. It never tests round-tripping across a reload.

**Fix.** Make the two stores agree. Pick one of:

1. **Cookie is the source of truth** — drop `next-themes`. Our
   `<html data-theme>` is already SSR-rendered from the cookie; we
   just need a small client component to call `updatePreferences` on
   theme-toggle click and apply the data attribute optimistically.
2. **Stay on next-themes, sync the cookie** — use next-themes's
   `onChange` callback (or wrap `setTheme`) to write the cookie
   whenever the theme changes. Cookie remains the SSR source.
3. **Stay on next-themes, drop the cookie for theme** — keep
   `density`, `layout`, `codeStyle` in the cookie; theme lives in
   localStorage only. Accept FOUC on first paint.

(1) is the cleanest given we already own a server action; (2) keeps
the existing library. (3) is the cheapest but regresses
"no FOUC."

**Acceptance.** Setting the cookie to `theme:"dark"` results in
`<html data-theme="dark">` after the page has hydrated; visual diff
between `feed-light-desktop.png` and `feed-dark-desktop.png` shows
distinct light / dark UIs.

---

## 🔴 D-12 — No navigation chrome on mobile

**Symptom.** Below the `md:` breakpoint (768 px), the sidebar
disappears (it's `hidden md:flex` in
[components/site/sidebar.tsx](components/site/sidebar.tsx)). Below
`lg:` (1024 px), the right rail also disappears
([right-rail.tsx](components/site/right-rail.tsx)). At iPhone-14
width (390 px), there is **no top header, no menu button, no bottom
tab bar — nothing at all to navigate the app.**

A signed-in user on mobile cannot reach `/me`, `/me/settings`,
`/explore`, `/search`, sign out, or change theme. The only way out is
typing a URL in the browser bar.

Visible on every `*-light-mobile.png` and `*-dark-mobile.png`
screenshot in `test-results/responsive/`.

**Root cause.** When the sidebar was introduced (Section 6 of the
design change), the previous `<SiteHeader>` was removed from the root
layout because the desktop sidebar replaced it. No mobile fallback
was added.

**Fix.** One of:

1. **A mobile top header** with a menu button that opens the sidebar
   in a sheet / drawer. shadcn's `<Sheet>` is already in the
   ecosystem; ~30 min.
2. **A bottom tab bar** for mobile (Home, Explore, Search, Me) —
   matches modern social-app conventions; ~45 min.
3. **Always-on top header on mobile** with a hamburger that toggles
   sidebar visibility — minimal change, ~15 min.

For the MVP, (3) is the smallest delta. (1) is the conventional
answer.

**Acceptance.** At 390 × 844 viewport, every authenticated page
exposes a navigation affordance to reach `/feed`, `/explore`,
`/search`, `/me`, `/me/settings`, sign-out.

---

## 🟡 D-2 — Sidebar footer overflows for unauthenticated viewers

**Symptom.** On `/explore`, `/search`, `/t/<slug>`, when no user is
signed in, the sidebar footer renders the placeholder
`<span>not signed in</span>` plus the `<ThemeToggle>` button on the
same row. The "not signed in" text is clipped — visible as
`n  gned in` with the toggle icon overlapping.

Most visible on `/search?q=t`
([screenshot](test-results/inspection/04-search-public.png)),
bottom-left.

**Root cause.** [components/site/sidebar.tsx](components/site/sidebar.tsx)
unauthenticated branch lays out the placeholder text and the toggle
in `flex items-center justify-between gap-2`, with no `truncate` /
`min-w-0` on the text.

**Fix.**

```diff
-<span className="text-[var(--color-ink-faint)] font-mono text-[11px]">
-  not signed in
-</span>
-<ThemeToggle />
+<span className="text-[var(--color-ink-faint)] truncate font-mono text-[11px]">
+  not signed in
+</span>
+<ThemeToggle />
```

Or drop the placeholder for unauthed viewers and just render the
theme toggle.

**Acceptance.** At 1280 × 900 on `/search?q=t`, the sidebar footer
reads cleanly.

---

## 🟡 D-3 — Sidebar overlaps the Next.js dev-tools bubble (dev-only)

**Symptom.** On every authenticated screen, Next.js's dev-tools
bubble (the dark `N` circle) sits at bottom-left and overlaps the
sidebar's signed-in footer (avatar + handle + chevron).

**In production this defect disappears** — the bubble is dev-only.

**Fix.**

```diff
 const nextConfig: NextConfig = {
+  devIndicators: {
+    position: "bottom-right",
+  },
 };
```

Two-line change in `next.config.ts`.

**Acceptance.** No visible overlap between the sidebar avatar and any
Next.js indicator at 1280 × 900 in dev.

---

## 🟡 D-10 — Char counter "red over the limit" branch is unreachable

**Symptom.** Design says (composer):

> Char counter (mono 11) goes amber within 200 chars of the limit,
> red over.

The composer's `<Textarea maxLength={POST_MAX}>` clips input at
10 000 characters — the over-limit case can never be reached via
keyboard input or paste, so the red branch never fires. The amber
threshold (>9 800) works correctly.

[Probed by](tests/e2e/interactions.spec.ts) `composer-counter-tones`
— same color (`oklch(0.72 0.16 85)`, the warn token) at 9 900 and at
10 001 (clipped to 10 000).

**Root cause.** [post-composer.tsx](components/posts/post-composer.tsx)
has both the maxLength clamp and a `> POST_MAX` branch in
`counterTone`. They contradict: either the user can over-fill (red
state useful) or maxLength is enforced (red state dead code).

**Fix options.**

1. **Drop `maxLength` from the textarea**, let the user type past the
   limit, and show red + a disabled Post button. Server-side Zod
   already enforces the cap — the client just visualizes it. ~5 min.
2. **Drop the `>POST_MAX` branch** in `counterTone` since it's dead
   code. Lazy spec compliance. ~1 min.

(1) is the right fix; the spec was written assuming over-fill is
possible.

**Acceptance.** Pasting 10 200 characters into the composer renders
the counter `10200/10000` in `--color-danger`, and the Post button is
disabled.

---

## 🟡 D-11 — Sign-out from the sidebar dropdown doesn't navigate to `/`

**Symptom.** Opening the sidebar profile dropdown (signed-in
viewer) → clicking "Sign out" → URL stays at `/feed`. The session
appears to clear (next page load lands on `/signin`), but the in-tab
redirect to `/` documented for the action does not happen.

[Probed by](tests/e2e/interactions.spec.ts) `signout-from-sidebar` —
recorded `final url = http://localhost:3000/feed`.

**Likely root cause.** The Sign out button is wired as:

```tsx
<DropdownMenuItem asChild>
  <form action={signOutAction} className="w-full">
    <button type="submit" …>Sign out</button>
  </form>
</DropdownMenuItem>
```

Radix's `<DropdownMenuItem asChild>` swallows the click event to
close the menu before the inner form submits. The form action runs
but doesn't propagate the redirect because the menu close handler
calls `event.preventDefault()` first.

**Fix.** Don't nest a form inside `<DropdownMenuItem asChild>`.
Either:

1. Use a plain menu item with an `onSelect` handler (Radix's
   recommended pattern):

   ```diff
   -<DropdownMenuItem asChild>
   -  <form action={signOutAction} className="w-full">
   -    <button type="submit" …>Sign out</button>
   -  </form>
   -</DropdownMenuItem>
   +<DropdownMenuItem
   +  onSelect={(e) => {
   +    e.preventDefault();
   +    void signOutAction();
   +  }}
   +>
   +  <LogOut className="size-4" /> Sign out
   +</DropdownMenuItem>
   ```

2. Move sign-out out of the dropdown — make "Sign out" a plain link
   to a dedicated `/signout` route handler. Heavier but a11y-cleaner.

(1) is the right fix.

**Acceptance.** Clicking Sign out from the dropdown lands the visitor
on `/` with no auth cookie; reload of any `(app)` route redirects
to `/signin`.

---

## ⚪ D-4 — Brand-mark underline placement may be off by one character

**Symptom.** The `<BrandMark>` is supposed to underline only `nest`.
At 28-pt size on the sign-in card the underline visually appears to
extend further than the four characters of `nest`.

**Fix.** [components/site/brand-mark.tsx](components/site/brand-mark.tsx)
— rebuild `dev` + `nest` as separate `inline-block` boxes so each
line-box is bound exactly:

```diff
-<span className="text-foreground">
-  dev
-  <span
-    className="relative"
-    style={{
-      borderBottom: "1.5px solid var(--color-accent)",
-      paddingBottom: 1,
-    }}
-  >
-    nest
-  </span>
-</span>
+<span className="text-foreground inline-flex items-baseline">
+  <span>dev</span>
+  <span
+    className="inline-block"
+    style={{
+      borderBottom: "1.5px solid var(--color-accent)",
+      lineHeight: 1,
+    }}
+  >
+    nest
+  </span>
+</span>
```

**Acceptance.** At every BrandMark size (sm / md / lg), the underline
starts exactly at `n` and ends at `t`.

---

## ⚪ D-6 — Trending tags always show "1" in dev

**Symptom.** Right-rail "Trending" panel ranks tags by post count in
the last 7 days. Dev DB has exactly one post per tag; ranking is
uniform. Working as designed.

**Fix.** None. Worth a one-liner in
[DEPLOYMENT.md](DEPLOYMENT.md) so reviewers know.

---

## Resolved during this session

- **D-13 — Sidebar profile-menu trigger had no accessible name.**
  Screen readers read it as the inner display-name + handle, which
  doubles up. Tests also couldn't target it reliably. Added
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
  product defect.
- **D-5 (avatar size)** from the first review — the desktop
  screenshot looked small, but the mobile screenshot
  ([profile-light-mobile.png](test-results/responsive/profile-light-mobile.png))
  shows the avatar at the right size. Closed.

---

## Summary table

| ID | Sev | Title | Fix effort |
|---|---|---|---|
| **D-1** | 🔴 | Default `<Button>` renders without fill | ~10 min |
| **D-7** | 🔴 | `⌘K` advertised, not wired | 2 min (remove hint) or 15 min (wire) |
| **D-8** | 🔴 | Vim-style nav shortcuts advertised, not wired | 2 min (remove hints) or 30 min (wire) |
| **D-9** | 🔴 | Theme cookie doesn't survive reloads | ~30 min (sync cookie ↔ next-themes) |
| **D-12** | 🔴 | No navigation chrome on mobile | ~15 min (mobile header w/ hamburger) |
| D-2 | 🟡 | Sidebar footer overflow (unauthed) | ~5 min |
| D-3 | 🟡 | Sidebar overlaps Next dev-tools bubble | ~2 min |
| D-10 | 🟡 | Char counter "over limit" unreachable | ~5 min |
| D-11 | 🟡 | Sign-out from dropdown doesn't redirect | ~10 min |
| D-4 | ⚪ | Brand-mark underline drift | ~10 min |
| D-6 | ⚪ | Trending shows "1" in dev | no fix |

## Recommended fix order

1. **D-1** — single token-block edit, fixes every primary CTA across
   the app. Biggest impact per minute.
2. **D-12** — mobile chrome. Without this the app is unusable on
   phones; nothing else helps a mobile user.
3. **D-9** — theme persistence. Users who pick dark mode expect it to
   stick.
4. **D-7 + D-8** — at minimum, hide the kbd hints until they work
   (~5 min total for both).
5. **D-11** — sign-out behaviour.
6. **D-3** — dev-only bubble, easy.
7. The rest as appetite allows.

After fixes, re-run all three specs and diff:

```bash
pnpm exec playwright test \
  tests/e2e/inspection.spec.ts \
  tests/e2e/responsive-themes.spec.ts \
  tests/e2e/interactions.spec.ts
```
