## Why

The `bootstrap-devnest-mvp` change defined the behavioral contract for
items 1–5 of the product vision (auth, profiles, posts, feed, tags).
It did not commit to a visual language. The first time anyone implements
a screen — sign-in, feed, profile — they will reach for shadcn defaults
and end up with a generic SaaS look. That decision is much cheaper to
make once, deliberately, before five contributors have each guessed at
type, density, color, and code-block treatment.

This change proposes the **visual and interaction design** for the MVP
slice already specified by `bootstrap-devnest-mvp`. It does not add new
behavior; it constrains *how* the existing behavior looks and feels so
the surface stays coherent as the team builds it out.

## What Changes

- **Establish a design system** for DevNest tuned to a developer
  audience: monospace-aware typography, IDE-style code blocks,
  high information density without crowding, and a calm palette
  that doesn't compete with syntax highlighting.
- **Define the visual anatomy of the MVP screens** already specified
  in `bootstrap-devnest-mvp`:
  - Sign-in (`/signin`): GitHub / GitLab / email magic-link, with the
    conflict-resolution surface for unverified-email collisions.
  - Home feed (`/feed`): three-column layout, composer with embedded
    code-block insertion, post cards.
  - Public discovery feed (`/explore`): same post-card vocabulary,
    same right rail, no follow-graph filtering.
  - Developer profile (`/u/[handle]`, `/me`): header with handle,
    headline, bio, linked-providers panel, posts list.
- **Specify the code-block component**: the single most distinctive
  piece of UI in the product. IDE chrome, language pill, copy button,
  optional filename, line-number variant.
- **Specify the post composer**: text + fenced code with syntax
  highlighting preview, tag autocomplete, character counter,
  visibility toggle.
- **Provide design tokens** as Tailwind v4 `@theme` variables so the
  existing shadcn setup adopts them with no rework — only the token
  values change.
- **Define density, theme, and layout knobs** as user-visible
  preferences that map to CSS data-attributes on `<html>`, with
  sensible defaults documented in design.md.

## Non-goals

- **No new behavior.** Anything not already in the active `specs/`
  produced by `bootstrap-devnest-mvp` is out of scope. Settings JSON,
  command palette, keybindings editor, marketplace, and extensions
  were explored visually but are *not* part of this change — they
  would belong to a future change covering items 6+ of the product
  vision.
- **No animation system.** Hover/focus transitions and a single
  toast animation are specified; broader motion choices are deferred.
- **No icon set selection.** The codebase already uses
  `lucide-react`; this design uses Lucide names throughout.
- **No marketing pages.** The existing `(marketing)/explore` and
  `(marketing)/signin` routes are covered, but the marketing-site
  surface (landing, pricing, about) is not.

## Capabilities

### Modified Capabilities

- `auth` — adds the visual spec for `/signin`, the magic-link
  "check your email" state, and the OAuth-conflict resolution screen.
  No behavioral change.
- `developer-profiles` — adds the visual spec for the profile header,
  linked-providers panel, and the empty/owned/visited variants of
  `/u/[handle]`. No behavioral change.
- `posts-and-feed` — adds the visual spec for the feed page,
  post card, composer, and code-block component. No behavioral
  change.
- `tags-and-follows` — adds the visual spec for the trending-tags
  panel, who-to-follow panel, and the follow/unfollow button states.
  No behavioral change.

### New Capabilities

- `design-system`: the tokens, typography scale, component
  vocabulary, and density/theme/layout preferences that every later
  visual change must build on. This capability is what makes
  "the team adds a new screen and it looks like DevNest" a
  reviewable property rather than a hope.

## Reference prototype

A clickable HTML prototype of every screen described here ships
alongside this change at `../../../../DevNest Prototype.html` (i.e.
the project root, one level above the `handoff/` folder). Open it in
any modern browser — no build step. It is the source of truth for the
visual decisions; this proposal extracts the rules so they can be
reviewed and committed alongside the code.

The prototype renders three layouts (single, two, three columns),
two themes (light, dark), three densities (compact, comfortable,
spacious), and three code-block styles (IDE, card, subtle). Those
knobs become the user-facing preferences specified in
[`design.md` § Preferences](./design.md#preferences).

## Impact

- **Code**: introduces a `tokens.css` (or extends `app/globals.css`)
  with the variables in [`tokens.md`](./tokens.md). Updates the
  shadcn theme so existing primitives pick up DevNest tokens
  without rewriting components. Adds a `<CodeBlock>` component
  (the one bespoke piece) under `components/posts/`.
- **APIs**: none. No new server actions, no schema changes.
- **Dependencies**: none added. Tailwind v4, shadcn, and
  `lucide-react` are already in the stack.
- **Storybook / visual review**: out of scope for this change. The
  prototype linked above stands in for it.
- **Follow-up changes**: a future "configurability" change can add
  the IDE-style surfaces (settings.json editor, command palette,
  keybindings, marketplace, extension framework) on top of the
  vocabulary established here.
