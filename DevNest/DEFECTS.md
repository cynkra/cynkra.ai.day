# DevNest — Defects (visual review)

**Captured:** 2026-05-05 via [tests/e2e/inspection.spec.ts](tests/e2e/inspection.spec.ts)
**Surfaces walked:** `/`, `/signin`, `/explore`, `/search?q=t`, `/feed`, `/me`, `/me/settings`, `/t/typescript`
**Viewport:** 1280 × 900, light theme (system → light), comfortable density, three-column layout
**Reproduce:**

```bash
pnpm db:up
pnpm dev > /tmp/devnest-dev.log 2>&1 &
pnpm exec playwright test tests/e2e/inspection.spec.ts
# screenshots + JSON: test-results/inspection/
```

The inspection itself ran clean — **0 HTTP errors, 0 console errors, 0
uncaught page exceptions, 0 non-2xx network responses**. Every defect
below is visual / CSS, not functional.

---

## Severity legend

- 🔴 **Major** — visible on every screen, breaks the design contract.
- 🟡 **Minor** — visible on at least one screen, fixable in isolation.
- ⚪ **Cosmetic** — judgment call; tracked for completeness.

---

## 🔴 D-1 — Default `<Button>` (primary variant) renders without fill

**Symptom.** Every default-variant shadcn `<Button>` renders as plain
text on the page background, with no border and no fill. Affects:

| Surface | Element |
|---|---|
| `/` (home) | "Sign in" CTA |
| `/signin` | "Continue with email" (the inline-expand toggle) |
| `/me/settings` | "Save changes" button under Profile |
| `/t/<slug>` | "Follow" button in the tag header |
| `/feed`, `/explore`, `/search` (right rail) | "Follow" buttons next to each "Who to follow" entry |
| Sidebar | "New post" button (signed-in) and "Sign in" button (signed-out) |

Outline-variant buttons render correctly. Ghost works. Only the default
(primary) variant is broken.

**Root cause.** [app/globals.css](app/globals.css) declares the design
tokens in `@theme` as `--color-bg`, `--color-ink`, `--color-accent`,
etc. The shadcn primitive aliases (`--primary`, `--primary-foreground`,
`--card`, `--muted`, etc.) are declared in a separate `:where(:root)`
block.

In Tailwind v4, **utility classes like `bg-primary` are generated only
from `--color-*` names inside `@theme`**. The `--primary` variable in
`:root` is a regular CSS variable but produces no utility — so the
`bg-primary` class on shadcn's Button is empty (no rule attached).

**Fix.** Move the shadcn aliases into `@theme` as `--color-*` tokens.
Either:

```css
/* app/globals.css */
@theme {
  /* … existing DevNest tokens … */
  --color-primary:              oklch(0.62 0.16 35); /* same as --color-accent */
  --color-primary-foreground:   oklch(1 0 0);
  --color-card:                 oklch(1.00 0.000 0);
  --color-card-foreground:      oklch(0.22 0.01  270);
  --color-muted:                oklch(0.97 0.005 270);
  --color-muted-foreground:     oklch(0.45 0.01  270);
  --color-secondary:            oklch(0.97 0.005 270);
  --color-secondary-foreground: oklch(0.22 0.01  270);
  --color-destructive:          oklch(0.58 0.20 25);
  --color-destructive-foreground: oklch(0.985 0 0);
  --color-input:                oklch(0.92 0.005 270);
  --color-ring:                 oklch(0.62 0.16 35);
}
```

…and matching dark-theme overrides under `[data-theme="dark"]`.

The `:where(:root) { --primary: var(--color-accent); … }` block can
then be removed (the `--color-*` names ARE the source of truth).

**Acceptance:** the home `Sign in` CTA shows as filled amber with white
ink; matches the design.md § `<Button>` `primary` row.

---

## 🟡 D-2 — Sidebar footer overflows for unauthenticated viewers

**Symptom.** On `/explore`, `/search`, `/t/<slug>`, when no user is
signed in, the sidebar footer renders the placeholder
`<span>not signed in</span>` plus the `<ThemeToggle>` button on the
same row. The "not signed in" text is clipped behind the theme-toggle
sun icon — visible as `n  gned in` with a circular icon overlapping
the middle.

Most visible on `/search?q=t` ([screenshot](test-results/inspection/04-search-public.png)),
bottom-left.

**Root cause.** [components/site/sidebar.tsx](components/site/sidebar.tsx) — the
unauthenticated branch of `<ProfileMenu>` lays out the placeholder
text and the toggle in a `flex items-center justify-between gap-2`,
but the available width inside `--col-nav: 240px` minus padding is
not enough for the long placeholder. There's no `truncate` / `min-w-0`
on the text and no shrink-0 on the button.

**Fix.** Either shorten the placeholder or fix the layout:

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

(Adding `truncate` requires the parent to allow shrinking; the current
`flex items-center justify-between gap-2` already does.) Better: drop
the placeholder entirely and only render `<ThemeToggle>` for
unauthenticated viewers.

**Acceptance:** at viewport 1280 × 900 on `/search?q=t`, the sidebar
footer reads cleanly with no overlap.

---

## 🟡 D-3 — Sidebar profile menu (signed-in) overlaps the Next.js dev-tools bubble

**Symptom.** On `/feed`, `/me`, `/me/settings`, `/t/<slug>` the
sidebar's signed-in footer (avatar + handle + chevron) sits at
bottom-left. Next.js's dev-tools bubble (the dark circle with `N`)
also lives at bottom-left in dev. They overlap, clipping the avatar
and the start of the handle.

Visible on every authenticated screenshot.

**Root cause.** Pure layout coincidence — Next.js's bubble has a
fixed bottom-left position; our sidebar footer also lives at
bottom-left. **In production this defect disappears** (the bubble is
dev-only), so this is a development-experience issue, not a
shipped-product defect.

**Fix.** Either:

1. Accept it as a dev-only quirk and document it in
   [DEPLOYMENT.md](DEPLOYMENT.md).
2. Move the sidebar footer up by a row (~32 px) **only in dev** via a
   `process.env.NODE_ENV !== "production"` guard.
3. Shift the dev-tools bubble to a different corner — Next.js exposes
   a `devIndicators` config that hides or repositions it.

(2) and (3) both fix the visual; (1) is the cheapest. Recommend (3)
via `next.config.ts`:

```diff
 const nextConfig: NextConfig = {
+  devIndicators: {
+    position: "bottom-right",
+  },
 };
```

**Acceptance:** the avatar + handle in the sidebar footer is fully
visible at viewport 1280 × 900.

---

## ⚪ D-4 — Brand-mark underline placement may be off by one character

**Symptom.** The `<BrandMark>` is supposed to render
`{ devnest }` with an accent-coloured underline beneath the
`nest` segment only ([design.md § Sidebar](openspec/changes/devnest-design-mvp/design.md#sidebar-left-nav-three-column-layout)).
At 28-pt size on the sign-in card the underline visually appears to
extend further than the four characters of `nest` — looks like it
spans the last 5–6 characters.

**Root cause.** [components/site/brand-mark.tsx](components/site/brand-mark.tsx)
wraps the `nest` span with `borderBottom: "1.5px solid var(--color-accent)"`.
The `padding-bottom: 1` and zero left padding pushes the visual
position. When the parent `<span class="mono">` swaps to JetBrains
Mono, the kerning shifts the bound box of "nest" so the border
visually starts inside "v".

**Fix.** Use `<u>`-style underline with explicit bounds, or render
"dev" + "nest" with `display: inline-block` so each is its own line
box:

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

**Acceptance:** at every brand-mark size (sm / md / lg), the underline
starts exactly at the `n` and ends exactly at the `t`.

---

## ⚪ D-5 — Profile header avatar may be undersized vs spec

**Symptom.** Spec ([profile/spec.md](openspec/changes/devnest-design-mvp/specs/profile/spec.md))
says "Avatar 80px, top-left." On the `/me` and `/u/<handle>`
screenshots the avatar (with "E2" initials) appears noticeably
smaller than 80 px relative to the surrounding type. Hard to be
certain without measuring; the class is `size-20` (5 rem = 80 px) so
the size *should* be right.

**Likely root cause.** None — `size-20` resolves to 80 px in Tailwind's
default theme. But the avatar may visually "shrink" because the
inner `<AvatarFallback>` content (the "E2" mono initials) is sized
relative to the avatar container, and shadcn's `<AvatarFallback>` text
defaults to `font-medium` at small size — the whitespace inside
makes the avatar feel smaller.

**Fix.** Verify by measurement (not screenshot eyeballing). If
genuinely small, the `Avatar` component classes are reading the
shadcn ones unchanged — but our `--color-muted` and contrast may need
a stronger placeholder background. Likely no code change needed; just
note for QA.

**Acceptance:** measure on a real browser → element box is exactly
80 × 80 px; the "E2" initials fill comfortably without looking lost.

---

## ⚪ D-6 — Trending tags always show "1" in dev

**Symptom.** Right-rail "Trending" panel ranks tags by post count in
the last 7 days. In dev every tag has exactly one post (the e2e tests
each create one), so the entire ranking is uniform.

**Root cause.** Working as designed; just an artifact of dev data.

**Fix.** Skip — nothing to do. Worth noting in DEPLOYMENT.md so
reviewers don't read it as a defect at first glance.

---

## Non-defects flagged during review

- `e2e_0_1777982775678` etc. handles in "Who to follow" — these are
  past e2e test users left in the dev DB. Not a defect; consider a
  `pnpm db:reset-dev` script that truncates only the e2e accounts.
- "Notifications / Messages / Bookmarks" rendering disabled in the
  sidebar — per design (item 9 of the original product vision is a
  non-goal of bootstrap-mvp; placeholders + v0.2 tooltips are
  intentional).
- `/me` empty state for a fresh user shows
  "@<handle> hasn't posted yet." — matches
  [profile/spec.md § Empty state](openspec/changes/devnest-design-mvp/specs/profile/spec.md).
- The inspection's own `expect` failure on `/me/settings` (heading
  `/appearance/i` matched two `<h2>`s) is a test-spec ambiguity, not
  a product defect; the heading hierarchy is correct.

---

## Summary

| ID | Severity | Title | Effort |
|---|---|---|---|
| D-1 | 🔴 Major | Default `<Button>` renders without fill | ~10 min (token move) |
| D-2 | 🟡 Minor | Sidebar footer overflows for unauthed viewers | ~5 min |
| D-3 | 🟡 Minor | Sidebar overlaps Next dev-tools bubble | ~2 min (next.config) |
| D-4 | ⚪ Cosmetic | Brand-mark underline placement | ~10 min |
| D-5 | ⚪ Cosmetic | Profile avatar size verification | requires measure |
| D-6 | ⚪ Cosmetic | Trending shows "1" in dev | no fix |

**Recommended fix order:** D-1 → D-3 → D-2 → D-4. D-1 alone resolves
the "looks broken" first impression on every page that has a primary
CTA.

After fixes, re-run `pnpm exec playwright test tests/e2e/inspection.spec.ts`
and diff the new screenshots against the originals in
`test-results/inspection/`.
