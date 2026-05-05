# Feed — visual spec

Behavior is fully specified by `bootstrap-devnest-mvp/specs/posts-and-feed/`
and `bootstrap-devnest-mvp/specs/tags-and-follows/`. This file
specifies *visual* requirements only.

## Page layout

- Three-column on `data-layout="three"` (default ≥ 1280px):
  Sidebar 240px · Main flex · RightRail 320px. Max main column
  width 640px. Outer page padding 0 (rails own their own
  padding); inner main padding 20.
- Tabs row at the top of main: "Following" (active by default
  on `/feed`), "Discover", "Tags I follow". 14 sans, with a
  2px `--accent` underline under the active tab.

## Composer

Always present at the top of `/feed`, sticky under the tabs row.
Anatomy described in [`../../design.md` § <Composer>](../../design.md#composer).

## Post list

- Vertical list of `<PostCard>`, gap 12 (`comfortable` density).
- Cursor-paginated using the existing `lib/feed/cursor.ts` helper.
- Loading: skeleton card matching the post-card outline at 60%
  opacity, three of them.
- End of feed: a mono 11 `--ink-faint` row, "you're all caught up."

## Empty state

When the user follows nobody:

- Centered in main, 16 `--ink-muted`: "Follow some developers and
  tags to see posts here."
- Single primary button: `[Explore]` → `/explore`.

## RightRail

Per [`../../design.md` § <RightRail>](../../design.md#rightrail-three-column-layout-only).
The rail panels are rendered server-side from existing queries
(`lib/tags/trending.ts`, `lib/follow/suggestions.ts`).

## Discovery feed (`/explore`)

Same layout, same post-card vocabulary, but:

- Tabs row replaced with a single 14-sans heading: "Recent
  posts" + a small 11-mono "from anyone you don't follow" beside
  it.
- No composer (page is publicly viewable per
  `bootstrap-devnest-mvp`).
- Above the feed, a row of trending-tag chips (active filter
  state styles).
