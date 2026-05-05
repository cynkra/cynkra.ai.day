## ADDED Requirements

### Requirement: Tags are first-class normalized entities

The system SHALL store every tag as a row in `tags` with a
canonical lowercase slug of 1–32 characters from `[a-z0-9-]`,
created on first use. Multiple casings or surrounding whitespace
of the same tag MUST resolve to the same `tags` row.

#### Scenario: First use of a tag creates a row

- **WHEN** a user creates the first post tagged with `#TypeScript`
- **THEN** a single `tags` row with slug `typescript` is created
  and the post is associated to it via `post_tags`

#### Scenario: Subsequent use of the same tag in different casing

- **WHEN** another post is later created tagged with `#typescript`
  or `#TYPESCRIPT` or `#  TypeScript  `
- **THEN** no new `tags` row is created; the existing
  `typescript` row is reused for the `post_tags` association

#### Scenario: Invalid tag is rejected

- **WHEN** a user attempts to attach a tag whose normalized slug
  is empty, longer than 32 characters, or contains characters
  outside `[a-z0-9-]`
- **THEN** the post-creation request is rejected with a
  validation error and no `tags` or `post_tags` row is created

### Requirement: Posts can carry up to five tags

The system SHALL accept 0–5 tags per post at creation time. The
limit MUST be enforced at the validation boundary, not relied on
implicitly downstream.

#### Scenario: Post created with valid tag count

- **WHEN** a user creates a post with 0, 1, 3, or 5 tags
- **THEN** the post is persisted and exactly that many
  `post_tags` rows are created

#### Scenario: Post created with too many tags

- **WHEN** a user creates a post with more than 5 tags
- **THEN** the request is rejected with a validation error and no
  rows are created

### Requirement: Authenticated user can follow and unfollow other users

The system SHALL allow an authenticated user to follow another
user and to unfollow them. Follows are asymmetric: a follow from A
to B does not imply a follow from B to A.

#### Scenario: Follow another user

- **WHEN** signed-in user A invokes follow on user B
- **THEN** a `follows` row `(follower_id = A, target_user_id =
  B)` exists, B's posts appear in A's home feed, and the action
  is idempotent if repeated

#### Scenario: Unfollow another user

- **WHEN** signed-in user A invokes unfollow on user B and a
  follow exists
- **THEN** the corresponding `follows` row is deleted, B's posts
  no longer appear in A's home feed, and the action is idempotent
  if repeated

#### Scenario: User attempts to follow themselves

- **WHEN** signed-in user A invokes follow on themselves
- **THEN** the request is rejected with a validation error and no
  row is created

### Requirement: Authenticated user can follow and unfollow tags

The system SHALL allow an authenticated user to follow a tag and
to unfollow it. Following a tag drives inclusion of posts carrying
that tag into the user's home feed.

#### Scenario: Follow a tag

- **WHEN** signed-in user A invokes follow on tag `t`
- **THEN** a `tag_follows` row `(user_id = A, tag_id = t)` exists,
  posts tagged `t` appear in A's home feed regardless of author,
  and the action is idempotent if repeated

#### Scenario: Unfollow a tag

- **WHEN** signed-in user A invokes unfollow on tag `t` and a
  follow exists
- **THEN** the corresponding `tag_follows` row is deleted, posts
  tagged `t` no longer appear in A's home feed solely on the
  basis of the tag, and the action is idempotent if repeated

### Requirement: Follower and following counts are visible on profiles

The system SHALL display, on each profile page, the count of users
the profile owner follows and the count of users following them.
These counts MUST exclude soft-deleted users on either side.

#### Scenario: Profile of a user with active followers

- **WHEN** a visitor views the profile of a user followed by 7
  active users and following 3 active users (and there are no
  soft-deleted users on either side)
- **THEN** the profile shows "Followers: 7" and "Following: 3"

#### Scenario: Counts exclude soft-deleted users

- **WHEN** of the 7 followers, 2 have been soft-deleted
- **THEN** the profile shows "Followers: 5"

### Requirement: Tag pages list posts and follower count

The system SHALL render a public page at `/t/<slug>` that shows
the tag display name, the count of users following the tag, and a
chronological list of recent non-deleted posts carrying the tag,
paginated by the same opaque cursor as the main feeds.

#### Scenario: Visitor views a tag page

- **WHEN** any visitor (authenticated or not) navigates to
  `/t/typescript` and at least one non-deleted post carries that
  tag
- **THEN** the page renders the tag, its follower count, and the
  most recent posts ordered by `created_at` descending

#### Scenario: Visitor views a tag with no posts

- **WHEN** a visitor navigates to `/t/<slug>` for a tag that
  exists but currently has no non-deleted posts
- **THEN** the page renders the tag header, follower count, and
  an empty-state message

#### Scenario: Visitor views a tag that has never been used

- **WHEN** a visitor navigates to `/t/<slug>` for a slug that has
  no `tags` row
- **THEN** the system returns HTTP 404 with a "tag not found"
  page

### Requirement: Discovery surfaces help users find people and tags

The system SHALL provide a search/discovery surface that, given a
query string, returns matching users (by handle and display name)
and matching tags (by slug and display name). Both result sets
MUST exclude soft-deleted users and tags with zero non-deleted
posts.

#### Scenario: Query matches users and tags

- **WHEN** a visitor searches for `react`
- **THEN** the results page lists users whose handle or display
  name contains `react`, and tags whose slug or display name
  contains `react`, each with a follow control when the visitor
  is authenticated

#### Scenario: Query matches nothing

- **WHEN** a visitor searches for a string with no matching users
  or tags
- **THEN** the results page renders an empty state for both
  sections without raising an error

