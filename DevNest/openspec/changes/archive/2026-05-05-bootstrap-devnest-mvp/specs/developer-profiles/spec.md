## ADDED Requirements

### Requirement: Every user has a unique handle

The system SHALL assign every user a globally unique handle of 3–32
characters drawn from `[a-z0-9_]`, case-insensitive at uniqueness
check time. Handles MUST be addressable in URLs as
`/u/<handle>`.

#### Scenario: Handle suggested at sign-up is unique

- **WHEN** a new user signs in for the first time and the system
  suggests a handle derived from their OAuth username, and that
  handle is not already taken
- **THEN** the user is assigned that handle and `/u/<handle>`
  resolves to their profile

#### Scenario: Handle suggested at sign-up collides

- **WHEN** the suggested handle is already taken by another user
- **THEN** the system appends or modifies the handle (e.g., a
  numeric suffix) until it is unique, and assigns the resulting
  handle to the new user

#### Scenario: User attempts to set an invalid handle

- **WHEN** a user submits a profile edit with a handle that
  contains characters outside `[a-z0-9_]`, or is shorter than 3 or
  longer than 32 characters
- **THEN** the request is rejected with a validation error and the
  existing handle is unchanged

#### Scenario: User attempts to set a taken handle

- **WHEN** a user submits a profile edit with a handle already in
  use by another user (case-insensitive)
- **THEN** the request is rejected with a "handle already taken"
  error and the existing handle is unchanged

### Requirement: Profile page is publicly viewable

The system SHALL render a public profile page at `/u/<handle>` that
displays the user's display name, headline, bio, avatar, linked
provider badges (GitHub / GitLab when present), and their post feed
in reverse-chronological order.

#### Scenario: Visitor views an existing user's profile

- **WHEN** any visitor (authenticated or not) navigates to
  `/u/jane`
- **THEN** the page renders Jane's display name, headline, bio,
  avatar, linked-provider badges, and her most recent posts
  ordered newest first

#### Scenario: Visitor views a non-existent handle

- **WHEN** a visitor navigates to `/u/<handle>` for a handle that
  does not exist
- **THEN** the system returns HTTP 404 with a "user not found"
  page

### Requirement: Authenticated user can edit their own profile

The system SHALL allow an authenticated user to update their handle,
display name, headline (≤ 120 characters), bio (≤ 500 characters),
and to disconnect a linked OAuth identity (provided at least one
sign-in method remains).

#### Scenario: Successful profile edit

- **WHEN** a signed-in user submits a profile edit with valid
  handle, display name, headline, and bio
- **THEN** the system persists the change, the profile page
  reflects it on next view, and the change is visible to other
  visitors

#### Scenario: User attempts to edit another user's profile

- **WHEN** a signed-in user submits an edit request targeting a
  user id other than their own
- **THEN** the request is rejected with HTTP 403 and no record is
  modified

#### Scenario: User attempts to disconnect their last sign-in method

- **WHEN** a signed-in user has only one linked sign-in method
  (e.g., only GitHub) and attempts to disconnect it
- **THEN** the request is rejected with a message explaining that
  at least one sign-in method must remain

### Requirement: Provider profile data is captured at sign-in

The system SHALL fetch and persist a snapshot of the
provider-supplied profile (avatar URL, public profile URL, top
language list when available, public repo count when available) in
`provider_profiles` at every successful sign-in via that provider,
and SHALL display these snapshot fields on the profile page.

#### Scenario: GitHub sign-in updates the snapshot

- **WHEN** a user signs in with GitHub and the GitHub API returns
  their public profile
- **THEN** the user's `provider_profiles` row for `provider =
  "github"` is upserted with the latest avatar URL, profile URL,
  top languages, and public repo count, and the profile page
  shows the refreshed values

#### Scenario: Provider API call fails during sign-in

- **WHEN** a user signs in with GitHub but the GitHub profile API
  call fails
- **THEN** sign-in still succeeds, the existing snapshot (if any)
  is preserved unchanged, and the profile page falls back to the
  prior snapshot or omits provider-derived fields

### Requirement: Soft-deleted users are inaccessible

The system SHALL respect the `users.deleted_at` flag: when a user
is soft-deleted, their profile MUST return HTTP 410 Gone, and their
posts MUST NOT appear in any feed or search result.

#### Scenario: Visiting a soft-deleted user's profile

- **WHEN** a visitor navigates to `/u/<handle>` for a user whose
  `deleted_at` is set
- **THEN** the system returns HTTP 410 with a "this profile is no
  longer available" page

#### Scenario: Soft-deleted user's posts are filtered from feeds

- **WHEN** any feed query (home, discovery, profile, tag) executes
  and a candidate post belongs to a soft-deleted user
- **THEN** that post is excluded from the result set

