# Design

## Audience and stance

DevNest's audience is software developers. Two consequences:

1. **Information density is a feature.** Developers happily read
   small monospace numbers, expect keyboard shortcuts to be visible,
   and prefer one dense screen to three sparse ones. The default
   density is *comfortable*, not *spacious*.
2. **Visual chrome must not compete with code.** Posts are read for
   their code, not their decoration. The post card is a quiet frame
   around the syntax-highlighted block; the surrounding UI uses
   muted neutrals so syntax colors stay legible.

The look is closer to a developer tool (Linear, GitHub, Vercel
dashboard) than to a consumer social product. No gradients on
backgrounds, no rounded full-width hero images, no decorative
illustration — but **not** austere brutalism either. Rounded corners,
generous gaps, and a small amount of warm accent color keep it
human.

## Tokens

All values live in [`tokens.md`](./tokens.md) as a copy-pasteable
Tailwind v4 `@theme` block. This section explains the *intent* behind
each scale; the file has the literal values.

### Color

A 6-step neutral ramp + a single warm accent.

| Token | Role |
|---|---|
| `--bg`, `--bg-elev`, `--bg-sunken` | Page, raised surface (cards), sunken surface (input fields, code) |
| `--ink`, `--ink-muted`, `--ink-faint` | Body, secondary, tertiary text |
| `--border`, `--border-strong` | Hairlines and emphasized hairlines |
| `--accent`, `--accent-bg`, `--accent-ink` | Single brand accent — used sparingly: primary buttons, focus ring, active nav, "verified" check, follow state |
| `--danger`, `--warn`, `--ok` | Toasts, status dots, destructive buttons |
| `--syn-keyword`, `--syn-string`, `--syn-num`, `--syn-fn`, `--syn-comment` | Code-block syntax tokens |

The dark theme is **not** an inversion. `--bg` in dark mode is
`oklch(0.18 0.005 270)` — a near-black with a touch of cool — and
contrast steps are tuned by hand. Both themes pass WCAG AA on
`--ink`-on-`--bg` and `--accent-ink`-on-`--accent-bg`.

### Type

| Family | Used for |
|---|---|
| `--font-sans` | UI body, headings, post copy |
| `--font-mono` | Handles, kbd hints, timestamps, code blocks, status bar, all "data" |

The mono family is load-bearing: any time a value is technical
(`@handle`, `g h`, `4.8k`, `78ms`), it renders in mono. This is what
makes the product *feel* like it's for developers without resorting
to gimmicks.

A 7-step type scale: 11 / 12 / 13 / 14 / 16 / 20 / 28.

- 11 mono — kbd hints, status bar, gutter
- 12 — secondary metadata, side-panel titles
- 13 — body, post copy
- 14 — primary navigation, button labels, headings inside cards
- 16 — page titles
- 20 — empty-state titles, sign-in headline
- 28 — only the brand mark and the sign-in hero

### Spacing

A 4px base. Multiples in use: 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40.
Larger values (48, 64) appear only on the sign-in screen.

Density preference scales the *internal* paddings of compose surfaces
and post cards by ±2px per side; outer gaps stay constant so columns
don't reflow.

### Radius

| Token | Value | Used on |
|---|---|---|
| `--radius-sm` | 4 | Inputs, kbd keys, tag chips |
| `--radius` | 8 | Cards, buttons, panels |
| `--radius-lg` | 12 | Modal sheets, the command-palette overlay (out of scope here, reserved) |

### Shadow

Three steps. Used sparingly — borders carry most of the surface
separation work.

- `--shadow-sm` — hover state on cards, dropdowns
- `--shadow-md` — toast, sticky composer focus
- (no `-lg`; if you need it, you're probably solving the wrong
  problem at the layout level)

### Motion

- 120ms ease-out for hover/active state changes.
- 180ms ease-out for toast enter, modal enter.
- Reduced-motion users get instantaneous transitions; respected via
  `prefers-reduced-motion`.

## Typography rules

- Body copy is **13 / 1.55**. Lower line-height than a marketing site
  because posts are dense.
- Headings are weight 600, never bold (700+). The mono family is
  used at weight 500 for handles and kbd hints, weight 400 for
  data and timestamps.
- `text-wrap: pretty` on every paragraph and heading.
- Post copy uses 14 with `text-wrap: pretty` and respects soft line
  breaks from the source markdown.

## Components

The vocabulary, in order of how often it appears.

### `<Button>`

Three variants × three sizes. Existing shadcn `Button` is the
implementation; only the **token values** change.

| Variant | Visual | Used for |
|---|---|---|
| `primary` | Filled `--accent`, white ink | The single dominant CTA per surface — "Sign in", "Post", "Follow" |
| `outline` | 1px `--border-strong`, transparent fill | Secondary actions, "Following" (followed state of Follow), filter chips |
| `ghost` | No border, hover fill `--hover` | Tertiary actions, dismiss buttons, nav rail |

Sizes: `sm` (28px), `md` (32px, default), `lg` (40px). Icon-only
variants must keep a 32px hit target minimum even at `sm`.

### `<Input>`

- Single visible state at rest: `--bg-sunken`, 1px `--border` hairline.
- On focus: `--accent` 1px ring, no fill change.
- Prefix slot for icons (`<Icon name="explore"/>` for search).
- Suffix slot for kbd hints (`⌘K` in mono 11, color `--ink-faint`).

### `<Avatar>`

Deterministic placeholder: handle hashed to a hue in OKLCH (chroma
0.05, lightness 0.6 light / 0.55 dark) with the first letter as a
mono uppercase glyph. **No emoji**. When the OAuth provider returns
an avatar, that wins; otherwise the placeholder is durable enough
to ship.

Sizes: 24 / 32 (default) / 48 / 80 (profile header).

### `<Tag>` / `<Hashtag>`

`#typescript` style. Mono 12, `--ink-muted` color, hover lifts to
`--ink`. Chips with backgrounds are reserved for *active* tag
filters; default tags are inline-text.

### `<PostCard>`

The single most-rendered component in the product. Anatomy:

```
┌─────────────────────────────────────────────────────┐
│  [avatar]  Display Name  @handle · time ·   [… more]│
│                                                      │
│  Body copy in 14 / 1.55, supports inline @mentions   │
│  and #tags as muted links.                           │
│                                                      │
│  ┌── code (optional, see <CodeBlock>) ──────────────┐│
│  │  filename.ts                              [copy]  ││
│  │  1  const greet = (name: string) => …             ││
│  │  2    `Hello, ${name}`;                            ││
│  └────────────────────────────────────────────────────┘│
│                                                      │
│  #typescript  #react                                 │
│                                                      │
│  ♡ 42    💬 7    ⤴ 3                          🔖 ⤴  │
└─────────────────────────────────────────────────────┘
```

- Outer card: `--bg-elev`, `--border`, `--radius`, padding 16.
- Header row: 13 sans + 11 mono for handle and time.
- Body: 14 with `text-wrap: pretty`.
- Tags: a row of 12-mono links, gap 8.
- Action row: ghost-icon buttons, `--ink-faint` until hover/active.
  Active states use `--accent` (like) and `--ok` (repost).

`density=compact` reduces card padding to 12 and action-row height
to 28. `density=spacious` raises them to 20 and 36.

### `<CodeBlock>` — *the bespoke piece*

The defining piece of UI. Three styles, all tokenized — the user
preference `code.style` swaps between them.

#### `style: ide` (default)

Mimics an editor pane.

- Header bar: `--bg-sunken`, 28px tall, with the language pill
  (mono 10, uppercase, letter-spacing 0.06em) on the left and a
  `[copy]` ghost-button on the right.
- Optional filename slot left of the language pill: mono 11,
  `--ink-muted`, prefixed with `●` if "modified".
- Body: monospace 12, line-height 1.65, 12px horizontal padding,
  10px vertical.
- Gutter on by default in `ide` style: 32px, mono 11,
  `--ink-faint`, right-aligned, `border-right: 1px var(--border)`.
- Background: `--bg` in light mode, `oklch(0.16 0.01 270)` in dark.

#### `style: card`

Same content, no chrome. The block is a card with rounded corners
and a copy button floated in the top-right on hover. No gutter,
no header bar. Lighter on the page, used inside dense conversation
threads.

#### `style: subtle`

Inline-feeling. No background, no border — just monospace text on
the post-card background with a left rule (`2px solid var(--border)`)
and an offset of 12px. For tiny snippets (< 4 lines).

The user-preference `code.style` is set in
`/me/settings`; it is a `data-code-style` attribute on `<html>` and
the component reads it via CSS so a single render handles all three.

### `<Composer>`

The compose surface lives at the top of `/feed`. Anatomy:

- Avatar (32) + textarea, no border at rest, focus reveals the
  toolbar row below.
- Toolbar: `[code]`, `[image]` (greyed, "soon"), `[poll]` (greyed,
  "soon"), `[tag]`, character counter (mono 11), `[Post]` button
  (primary, disabled until non-empty).
- Pressing `[code]` reveals an inline code-block editor: a language
  picker (combo, default `typescript` per
  `bootstrap-devnest-mvp`/specs/posts) and a textarea that previews
  in real time using the same Shiki pipeline as rendered posts.
- `⌘+Enter` posts; `Esc` collapses the toolbar.

### `<Sidebar>` (left nav, three-column layout)

- Brand mark at top: `{}` glyph in `--accent` + "devnest" wordmark
  with a mono caret-blinking accent on `nest`.
- Nav items: 32px tall, icon-left (Lucide, 16px), label, kbd hint
  on the right (mono 11, `--ink-faint`).
- Active state: `--accent-bg` background, `--accent-ink` text.
- Footer: avatar + name + handle, click = open profile menu.

Items, in order: **Home, Explore, Notifications, Messages,
Bookmarks, Profile, Settings.** A "New post" primary button sits
between the two nav groups.

The Notifications and Messages items show a numeric badge
(mono 10, `--accent` fill) when count > 0.

### `<RightRail>` (three-column layout only)

Three side-panels stacked, gap 16:

1. **Search** (sticky at top, ⌘K kbd hint).
2. **Trending tags** — top 5, ranked, mono numerals 01–05 in the
   gutter, tag + post count.
3. **Who to follow** — three suggestions with avatar, name, headline,
   `[Follow]` / `[Following]` button.
4. **Shortcuts cheatsheet** — small mono table of the 4 most
   common kbd shortcuts.

Below those, a tiny mono row of legal links (terms, privacy, status).

### `<Toast>`

Single instance, bottom-center, 180ms enter, 1800ms dwell, 180ms
exit. `--bg-elev` with 1px `--border-strong`, `--shadow-md`. Icon
slot for status (check / x / info). Toasts are the sole feedback
mechanism for follow/unfollow, post created, post deleted.

## Layouts

Three layouts, switchable from `/me/settings` (and reflected in the
tokens via `data-layout` on `<html>`):

| `data-layout` | Columns | When to use |
|---|---|---|
| `single` | Main only | Mobile, narrow windows, "focus" preference |
| `two` | Sidebar + Main | Tablet, "balanced" preference |
| `three` | Sidebar + Main + RightRail | Default on ≥ 1280px |
| `wide` | Sidebar + Main + RightRail, looser gaps | Ultra-wide displays |

The breakpoints downgrade gracefully: `three` → `two` < 1180px,
`two` → `single` < 760px, regardless of preference.

## Preferences

User preferences set on `/me/settings` and persisted on
`users.preferences` (jsonb). They map onto `data-*` attributes on
`<html>` so CSS does the rest with zero JS in the render path.

| Preference | Values | Default | `<html>` attribute |
|---|---|---|---|
| Theme | `light`, `dark`, `system` | `system` | `data-theme="light\|dark"` (resolved client-side from system) |
| Density | `compact`, `comfortable`, `spacious` | `comfortable` | `data-density` |
| Code style | `ide`, `card`, `subtle` | `ide` | `data-code-style` |
| Layout | `single`, `two`, `three`, `wide` | `three` | `data-layout` |

Each is a radio control on `/me/settings` with an inline preview
card showing the change. No "save" button — preferences write on
change, debounced 200ms.

## States and edge cases

- **Loading**: skeleton card matches the post-card outline at 60%
  opacity. No spinners except inside buttons (the existing shadcn
  spinner is fine).
- **Empty**: short copy + a single primary CTA, never illustration.
  Empty feed: "Follow some developers and tags to see posts here.
  → [Explore]". Empty profile: "@handle hasn't posted yet."
- **Error**: a card with a mono `request_id` line at the bottom so
  users can paste it into a bug report. Matches the request-id
  propagation already in `bootstrap-devnest-mvp`.
- **Soft-deleted profile (HTTP 410 future)**: today the profile
  shows a single empty card with "This account is no longer
  available." in `--ink-muted`. No avatar, no actions. Behavioral
  spec for the 410 is deferred.

## Accessibility

- Focus ring: 2px `--accent` outline with 2px offset, on every
  interactive element. Never removed.
- Keyboard: every action specified in the prototype is reachable
  by keyboard (full kbd map lives with the future "configurability"
  change). Sign-in form has labelled inputs and explicit
  error-region `aria-live="polite"`.
- Color contrast: AA verified on every `--ink`/`--bg` pair and on
  every `--accent-ink`/`--accent-bg` pair. Syntax tokens are
  contrast-tuned per theme.
- Reduced motion: 120ms / 180ms transitions collapse to 0ms.
- The avatar placeholder always carries an `aria-label` of the
  user's display name so screen readers don't announce a hue.
