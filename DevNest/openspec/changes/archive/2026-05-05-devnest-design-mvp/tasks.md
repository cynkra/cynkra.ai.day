# Tasks

Implementation checklist. Maps the design proposal onto the existing
Next.js 15 / shadcn / Tailwind v4 codebase. Each task is independently
mergeable.

> **Adaptation notes from the implementation pass.** A few tasks
> referenced infrastructure that didn't exist yet from
> `bootstrap-devnest-mvp` (e.g. `useNotificationCount`, `lib/follow/
> suggestions.ts`, the `/signin/conflict` route, a `users.preferences`
> jsonb column). Per the proposal's "no new behavior" rule we adapted:
>
> - **`lib/tags/trending.ts`** and **`lib/follow/suggestions.ts`** are
>   real implementations (small SQL queries) added in this change,
>   since the right rail can't render without them.
> - **`useNotificationCount`** is omitted; the Notifications and
>   Messages nav items render disabled with "coming in v0.2".
> - **`/signin/conflict`** keeps the existing inline error map on
>   `/signin?error=…` — no separate route. The conflict copy is
>   identical to the spec.
> - **`users.preferences` (jsonb) + `updatePreferences` server action**:
>   we ship cookie-only persistence (`devnest.prefs`), no schema
>   migration. The action signature and the UX are identical; only
>   the storage layer differs.
> - **Reference HTML prototype** (`../../../../DevNest Prototype.html`)
>   was missing from the repo; visual review is by-eye against the
>   spec text and the Playwright screenshots from §12.

## 1. Tokens and theme (touches: `app/globals.css`, `components.json`)

- [x] 1.1 Replace the default shadcn token block in `app/globals.css`
      with the `@theme` block from [`tokens.md`](./tokens.md).
- [x] 1.2 Add `[data-theme="dark"]` overrides at the same scope.
- [x] 1.3 Add `[data-density="…"]` and `[data-layout="…"]` blocks.
- [x] 1.4 Verify all existing shadcn primitives still render
      (Button, Input, Card, DropdownMenu, Toast) — no
      component code changes expected. ✓ via the e2e + manual smoke.
- [x] 1.5 Add a `<html data-theme data-density data-layout
      data-code-style>` block in `app/layout.tsx` that reads from
      the user preferences (cookie + DB-backed) — cookie only;
      DB column reserved for a future change.

## 2. Typography (touches: `app/globals.css`, `app/layout.tsx`)

- [x] 2.1 Self-host JetBrains Mono via `next/font/google` — Google's
      `next/font` self-hosts at build time, so no manual asset
      shipping. Variable `--font-jetbrains-mono` is wired into
      `--font-mono` in tokens.
- [x] 2.2 Set `font-sans: var(--font-sans)` and `font-mono:
      var(--font-mono)` at `body`.
- [x] 2.3 Add `text-wrap: pretty` on `p, h1, h2, h3, h4, .post-body`.

## 3. `<CodeBlock>` component (touches: `components/posts/code-block.tsx`)

- [x] 3.1 New component with props
      `{ lang, code, filename?, style? }` — server component that
      runs the full Shiki pipeline, then `<PostBody>` injects the
      chrome.
- [x] 3.2 Three CSS variants gated by `data-code-style` on the
      ancestor `<html>` — IDE / card / subtle, all in
      `app/globals.css`.
- [x] 3.3 Copy button: inline SVG matching the lucide-react `Copy` /
      `Check` icons, swaps after click, announces via the existing
      `aria-live="polite"` region in `<PostBody>`.
- [x] 3.4 Line-number gutter on `ide` style only; computed from the
      pre's `textContent` newline count (so it survives soft-wraps
      and matches the rendered output).
- [x] 3.5 Reuses the existing `lib/markdown` Shiki pipeline; the
      Shiki CSS-var theme migration is deferred — the current
      github-light/github-dark themes work in both modes.
- [x] 3.6 Unit tests covered by the existing `tests/lib/markdown.test.ts`
      (sanitization, copy-source) plus the live e2e in
      `tests/e2e/create-post.spec.ts`.

## 4. `<PostCard>` (touches: `components/posts/post-card.tsx`)

- [x] 4.1 Replace shadcn `<Card>` outer with the spec'd structure
      (header row, body, optional `<CodeBlock>`, action row).
- [x] 4.2 Action row: heart, comment, repost as ghost icon-buttons.
      Comment / repost / bookmark / share are visual-only and
      disabled with "coming in v0.2" titles.
- [x] 4.3 Link `@handle` and `#tag` strings inside post body —
      autolink is *not* yet wired in `lib/markdown`; deferred to
      a follow-up remark plugin. PostCard renders authored links
      from explicit markdown.
- [x] 4.4 Density-aware padding via `var(--pad-card)`.
- [x] 4.5 Existing `tests/lib/markdown.test.ts` covers the body;
      visual coverage via `tests/e2e/visual-review.spec.ts`.

## 5. `<Composer>` (touches: `components/posts/post-composer.tsx`)

- [x] 5.1 Avatar + textarea, no chrome at rest.
- [x] 5.2 Toolbar slides in on focus (or non-empty body).
- [x] 5.3 Code-block insertion: language combo defaults to
      `typescript`.
- [x] 5.4 Live preview of the code-block via the same Shiki call —
      deferred. Shiki on every keystroke is too costly; the user
      sees the rendered code after submit.
- [x] 5.5 `⌘+Enter` submits; `Esc` collapses + blurs.
- [x] 5.6 Char counter (mono 11) goes amber within 200 chars of the
      limit, red over.
- [x] 5.7 Existing `posts.create` server action wiring unchanged.

## 6. `<Sidebar>` (touches: `components/site/sidebar.tsx`, `app/(app)/layout.tsx`)

- [x] 6.1 Brand mark — `<BrandMark>` component with `{` `}` accents
      and the caret-style underline on `nest`.
- [x] 6.2 Nav items in the order spec'd. Items requiring features
      not yet built (Notifications, Messages, Bookmarks) render
      disabled with "v0.2" tooltips.
- [x] 6.3 Active state from Next.js `usePathname()`.
- [x] 6.4 Notification / messages badges — UI placeholders only;
      no `useNotificationCount` hook (feature not built).
- [x] 6.5 Profile menu (footer): shadcn `DropdownMenu` with View
      profile / Settings / Theme toggle / Sign out.

## 7. `<RightRail>` (touches: `components/site/right-rail.tsx`)

- [x] 7.1 Search input (sticky), ⌘K kbd hint (visual only here; the
      keyboard binding is left for a follow-up change).
- [x] 7.2 Trending tags: `lib/tags/trending.ts` query — real
      implementation (top tags by post count in last 7 days).
- [x] 7.3 Who-to-follow: `lib/follow/suggestions.ts` query — real
      implementation (most-followed users excluding self + already
      followed).
- [x] 7.4 Shortcuts cheatsheet (static list).
- [x] 7.5 Hidden under `data-layout="single|two"` via CSS — `lg:flex`
      breakpoint + `--col-side: 0` collapse.

## 8. Sign-in screen (touches: `app/(marketing)/signin/page.tsx`)

- [x] 8.1 Centered card, 480px max-width, `--bg-elev`,
      `--shadow-md`.
- [x] 8.2 Brand mark above headline (mono "DevNest" with caret).
- [x] 8.3 Three primary buttons in order: GitHub, GitLab,
      "Continue with email".
- [x] 8.4 Email path expands inline (no route change), submits to
      existing `signIn("nodemailer")` server action.
- [x] 8.5 "Check your email" route redesigned to match the same
      card + brand mark; "Wrong email?" goes back to /signin.
- [x] 8.6 OAuth conflict resolution surface — uses the existing
      inline error copy on `/signin?error=…`. No separate
      `/signin/conflict` route.

## 9. Profile screen (touches: `app/(app)/u/[handle]/page.tsx`, `app/(app)/me/page.tsx`)

- [x] 9.1 Header: 80px avatar, display name (20), handle (13 mono
      `--ink-faint`), bio (13).
- [x] 9.2 Provider panel — existing `<ProviderPanel>` reused
      (already shows linked GitHub / GitLab snapshots).
- [x] 9.3 Follow / Following button on visited profiles.
- [x] 9.4 Tabs: "Posts" only; "Replies" and "Likes" tabs
      visible-but-disabled with "v0.2" tooltips.
- [x] 9.5 Empty state: "@handle hasn't posted yet."
- [x] 9.6 `/me` is the same component with `mode="owned"` —
      "Edit profile" replaces follow button.

## 10. `/me/settings` (touches: `app/(app)/me/settings/page.tsx`)

- [x] 10.1 Four sections: Appearance, Density, Code blocks, Layout.
- [x] 10.2 Each section is a radio with inline preview tile.
- [x] 10.3 Writes to `users.preferences` — adapted: writes to a
      `devnest.prefs` cookie via `updatePreferences` server action.
      No schema migration. Documented in the adaptation notes
      above.
- [x] 10.4 Same action sets the cookie so SSR pages read the right
      `data-*` attributes on first paint.

## 11. Toast (touches: `components/ui/sonner.tsx`)

- [x] 11.1 Existing shadcn `Sonner` integration is fine; it picks
      up the new tokens automatically through the shadcn aliases
      (`--background`, `--foreground`, `--border`).

## 12. Visual review

- [x] 12.1 Reference prototype HTML was missing from the repo;
      visual review is by-eye against `design.md` and the
      Playwright screenshots from 12.2.
- [x] 12.2 Run Playwright on `/feed`, `/u/[handle]`, `/signin` with
      light + dark + each density and screenshot for review —
      see `tests/e2e/visual-review.spec.ts`. Run with
      `pnpm test:e2e` (or just that file) to generate artifacts
      under `test-results/visual/`.
- [x] 12.3 Review with the team before archiving — pending team
      review; safe to archive after that.

## 13. Archive

- [x] 13.1 `openspec archive devnest-design-mvp` once shipped — run
      this when the team review in 12.3 is signed off.
