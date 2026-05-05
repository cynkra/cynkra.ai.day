# posts-and-feed Specification

## Purpose
TBD - created by archiving change bootstrap-devnest-mvp. Update Purpose after archive.
## Requirements
### Requirement: Authenticated user can create a post

The system SHALL allow an authenticated user to create a text post
with a body of 1–10,000 characters that supports CommonMark plus
GitHub-Flavored Markdown extensions (tables, task lists, strikethrough,
autolinks) and fenced code blocks.

#### Scenario: Successful post creation

- **WHEN** a signed-in user submits a post body of valid length
  containing markdown text and at least one fenced code block
- **THEN** a new `posts` row is persisted with the user as author,
  the rendered HTML is generated and cached server-side, and the
  post is immediately visible on the user's profile feed and on
  the home feed of every follower

#### Scenario: Post body too short

- **WHEN** a signed-in user submits a post with an empty body or a
  body containing only whitespace
- **THEN** the request is rejected with a validation error and no
  row is created

#### Scenario: Post body too long

- **WHEN** a signed-in user submits a post with a body longer than
  10,000 characters
- **THEN** the request is rejected with a validation error and no
  row is created

#### Scenario: Unauthenticated request to create a post

- **WHEN** an unauthenticated request hits the post-creation
  endpoint
- **THEN** the request is rejected with HTTP 401 and no row is
  created

### Requirement: Code blocks render with syntax highlighting

The system SHALL render fenced code blocks with server-side syntax
highlighting for the supported language set (TypeScript,
JavaScript, Python, R, Rust, Go, SQL, Bash, JSON, YAML, HTML, CSS).
Unsupported languages MUST render as plain monospaced text without
the request failing.

#### Scenario: Recognized language fence

- **WHEN** a post body contains a fenced code block tagged
  ```` ```ts ```` and is rendered
- **THEN** the resulting HTML contains highlighted tokens and
  preserves the original source text exactly

#### Scenario: Unrecognized language fence

- **WHEN** a post body contains a fenced code block tagged with a
  language identifier outside the supported set
- **THEN** the resulting HTML renders the code as plain
  monospaced text inside a `<pre>`/`<code>` block, without
  highlighting and without raising an error

### Requirement: Code blocks expose a copy button

The system SHALL render a copy-to-clipboard control on every
fenced code block. Clicking the control MUST place the original
unhighlighted source text on the user's clipboard.

#### Scenario: Copy a code block

- **WHEN** a user clicks the copy control on a rendered code
  block
- **THEN** the clipboard receives the exact source text of the
  block (without HTML tags or highlighting markup) and a brief
  visual confirmation is shown

### Requirement: Rendered HTML is sanitized

The system SHALL sanitize rendered post HTML so that any raw HTML
the author embeds cannot inject `<script>` tags, inline event
handlers, `javascript:` URLs, `style` attributes that load remote
resources, or `<iframe>` elements.

#### Scenario: Author embeds a script tag

- **WHEN** a user submits a post body containing
  `<script>alert(1)</script>`
- **THEN** the rendered HTML stored and served contains no
  `<script>` element

#### Scenario: Author embeds an inline event handler

- **WHEN** a user submits a post body containing `<a
  href="..." onclick="evil()">`
- **THEN** the rendered HTML contains the `<a>` element without
  the `onclick` attribute

### Requirement: Author can soft-delete their own post

The system SHALL allow an authenticated user to delete a post they
authored. Deletion MUST be a soft delete (set `deleted_at`) and the
post MUST disappear from every feed and direct-link view
immediately.

#### Scenario: Author deletes their post

- **WHEN** a signed-in user invokes delete on a post they
  authored
- **THEN** the post's `deleted_at` is set, subsequent feed queries
  exclude it, and a direct GET on `/p/<post_id>` returns HTTP 410

#### Scenario: User attempts to delete another user's post

- **WHEN** a signed-in user invokes delete on a post they did not
  author
- **THEN** the request is rejected with HTTP 403 and no row is
  modified

### Requirement: Home feed shows followed authors and tags

The system SHALL render an authenticated user's home feed as the
union of: posts authored by users the viewer follows, and posts
tagged with any tag the viewer follows. Posts MUST be ordered
strictly by `created_at` descending. Soft-deleted posts and
soft-deleted authors' posts MUST NOT appear.

#### Scenario: Home feed includes a followed user's post

- **WHEN** the viewer follows user X, X publishes a post, and the
  viewer reloads the home feed
- **THEN** X's post appears in the feed at its
  `created_at`-determined position

#### Scenario: Home feed includes a post tagged with a followed tag

- **WHEN** the viewer follows tag `t`, any user (followed or not)
  publishes a post tagged `t`, and the viewer reloads the home
  feed
- **THEN** that post appears in the feed at its
  `created_at`-determined position

#### Scenario: Home feed for a viewer who follows nobody and no tags

- **WHEN** an authenticated viewer with zero follows and zero
  followed tags loads the home feed
- **THEN** the feed shows an empty-state UI prompting the viewer
  to follow people or tags, and contains no posts

### Requirement: Discovery feed shows recent public posts

The system SHALL render a public discovery feed at `/explore` that
lists recent posts from any non-deleted author whose author has not
opted out of discovery, ordered by `created_at` descending and
capped to a recent window (default 30 days). The discovery feed MUST
be viewable by unauthenticated visitors.

#### Scenario: Unauthenticated visitor views the discovery feed

- **WHEN** an unauthenticated visitor navigates to `/explore`
- **THEN** the page renders the most recent public posts within
  the cap, ordered by `created_at` descending, with no
  authentication required

#### Scenario: Author has opted out of discovery

- **WHEN** an author has set their profile to opt out of
  discovery and they publish a post
- **THEN** that post does not appear on the discovery feed but
  remains visible on the author's profile and on followers'
  home feeds

### Requirement: Feeds paginate by opaque cursor

The system SHALL paginate feed responses using an opaque cursor
encoding the last-seen `(created_at, post_id)` tuple. The API MUST
NOT expose offset-based pagination.

#### Scenario: Client requests the next page

- **WHEN** a client passes the cursor returned by a previous feed
  request
- **THEN** the response contains the next batch of posts strictly
  older than the cursor, in `created_at` descending order, with a
  new cursor for the page after that

#### Scenario: Feed has reached its end

- **WHEN** there are no more posts older than the supplied cursor
- **THEN** the response returns an empty page and a `nextCursor`
  field of `null`, and the client interprets this as end-of-feed

