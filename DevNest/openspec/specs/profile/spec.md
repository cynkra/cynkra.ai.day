# Profile — visual spec

Behavior is fully specified by
`bootstrap-devnest-mvp/specs/developer-profiles/`. This file
specifies *visual* requirements only.

## Header

- Avatar 80px, top-left.
- To its right: display name (20 sans, weight 600), handle (13
  mono `--ink-faint`, prefixed `@`), and bio (13 sans, max 280
  chars, `text-wrap: pretty`).
- Headline (one line, 13 mono `--ink-muted`) sits between handle
  and bio. Empty profiles omit it.
- Right side of the header: action button.
  - Visited (and not following): primary `[Follow]`.
  - Visited (and following): outline `[Following]`, hover swaps
    to outline-danger `[Unfollow]` after 200ms hover.
  - Owned: outline `[Edit profile]` (links to `/me`).

## Provider panel

A single `--bg-sunken` card under the header, full main-column
width, padding 14 horizontal / 12 vertical. Anatomy per linked
provider:

- 16px GitHub or GitLab mark, `--ink-muted`.
- Provider handle in 13 mono.
- Tiny pill (mono 10, uppercase) marking "verified email" or
  "unverified" per `bootstrap-devnest-mvp/specs/auth`.
- A right-aligned timestamp "linked 3w ago" in 11 mono
  `--ink-faint`.

If the user has linked both GitHub and GitLab, two rows. If
neither is linked (email-only sign-in), the panel is omitted.

## Tabs

- Posts (active in MVP).
- Replies (visible-but-disabled).
- Likes (visible-but-disabled).
- Mono 11 tooltip "v0.2" on the disabled tabs.

## Posts list

Same `<PostCard>` vocabulary as `/feed`, gap 12. Pagination cursor
identical to feed.

## Empty state

- For visited profiles: "@handle hasn't posted yet." (16
  `--ink-muted`, centered).
- For owned profile: same line + a primary `[Write your first
  post]` linking to `/feed` with the composer focused.

## Soft-deleted profile

Per `design.md` § States: a single empty card with "This account
is no longer available." in `--ink-muted`. No avatar. No actions.
HTTP status remains 404 in MVP.
