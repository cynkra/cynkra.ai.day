# auth Specification

## Purpose
TBD - created by archiving change bootstrap-devnest-mvp. Update Purpose after archive.
## Requirements
### Requirement: Sign in with GitHub OAuth

The system SHALL allow visitors to sign in via GitHub OAuth. On
successful callback, the system MUST create a user record (if none
exists for the returned identity) or attach the GitHub identity to
an existing user (per the account-linking requirement), establish an
authenticated session, and redirect the user to their post-sign-in
landing page.

#### Scenario: First-time GitHub sign-in

- **WHEN** a visitor with no existing account clicks "Sign in with
  GitHub", grants the requested scopes, and the GitHub callback
  returns a verified email and profile
- **THEN** the system creates a new `users` row, an associated
  `accounts` row with `provider = "github"`, persists a snapshot
  of the GitHub profile in `provider_profiles`, establishes a
  database-backed session, and redirects the user to the home feed

#### Scenario: Returning GitHub sign-in

- **WHEN** a visitor with an existing GitHub-linked account clicks
  "Sign in with GitHub" and the OAuth callback succeeds
- **THEN** the system reuses the existing `users` row, refreshes
  the `provider_profiles` snapshot, establishes a new session, and
  redirects the user to the home feed

#### Scenario: GitHub sign-in cancelled or failed

- **WHEN** the GitHub callback returns an error (user denied
  access, invalid state, expired code, or any non-success
  response)
- **THEN** no user, account, or session record is created or
  modified, and the visitor is returned to the sign-in page with a
  generic error message that does not reveal which step failed

### Requirement: Sign in with GitLab OAuth

The system SHALL allow visitors to sign in via GitLab OAuth using
the same flow shape as GitHub: callback creates or reuses a user
record, links the GitLab identity, snapshots the provider profile,
and establishes a session.

#### Scenario: First-time GitLab sign-in

- **WHEN** a visitor with no existing account clicks "Sign in with
  GitLab", grants the requested scopes, and the GitLab callback
  returns a verified email and profile
- **THEN** the system creates a new `users` row, an associated
  `accounts` row with `provider = "gitlab"`, persists a
  `provider_profiles` snapshot, establishes a session, and
  redirects to the home feed

#### Scenario: GitLab callback returns unverified email

- **WHEN** the GitLab callback returns an email whose `email_verified`
  flag is false
- **THEN** the system does not auto-link the identity to an existing
  user with the same email; it either creates a new account if no
  match exists, or shows the conflict-resolution screen described
  under "Account linking on verified email match"

### Requirement: Sign in with email magic link

The system SHALL allow visitors to sign in via a single-use,
time-limited email link as a fallback to OAuth.

#### Scenario: Successful magic-link sign-in

- **WHEN** a visitor submits an email address on the sign-in page,
  receives the magic-link email, and clicks the link within its
  validity window
- **THEN** the system creates or retrieves the matching `users`
  row, marks the email as verified, establishes a session, and
  redirects to the home feed

#### Scenario: Magic link reused after consumption

- **WHEN** a visitor clicks a magic link that has already been
  consumed
- **THEN** the system rejects the request, does not establish a
  session, and shows a "this link has already been used" page

#### Scenario: Magic link expired

- **WHEN** a visitor clicks a magic link more than its validity
  window after issuance
- **THEN** the system rejects the request, does not establish a
  session, and shows a "this link has expired" page with an
  option to request a new one

### Requirement: Account linking on verified email match

The system SHALL link a new OAuth identity to an existing user
account only when the OAuth provider returns a verified email that
matches the existing user's verified email. When the email is
unverified or the user has not previously verified an email, the
system MUST NOT silently link.

#### Scenario: Linking a verified GitHub identity to an existing GitLab user

- **WHEN** a user previously signed in via GitLab with verified
  email `dev@example.com`, then later signs in via GitHub which
  returns the same verified email
- **THEN** the system attaches a new `accounts` row with `provider
  = "github"` to the existing `users` row, refreshes both
  `provider_profiles` snapshots, and establishes a session as the
  existing user

#### Scenario: Conflicting unverified email

- **WHEN** an OAuth provider returns an email that matches an
  existing user's email but the provider has not verified it
- **THEN** the system does not link automatically; it presents a
  page instructing the visitor to first sign in with their
  original method, then connect the new provider from settings

### Requirement: Sign-out terminates the session

The system SHALL provide an authenticated sign-out action that
invalidates the user's current session immediately and redirects to
the public landing page.

#### Scenario: Authenticated user signs out

- **WHEN** an authenticated user invokes the sign-out action
- **THEN** the corresponding `sessions` row is deleted, the
  session cookie is cleared in the response, and a subsequent
  request to any authenticated route returns the visitor to the
  sign-in page

### Requirement: Sessions are server-revocable

The system SHALL store sessions in the database (not as
self-contained JWTs) so that an administrative action can revoke
any session by deleting its row, and so that sign-out takes effect
on the next request without waiting for a token to expire.

#### Scenario: Administrative session revocation

- **WHEN** a `sessions` row for a logged-in user is deleted out of
  band (e.g., by an operator query)
- **THEN** the next request from that user's browser is treated as
  unauthenticated, regardless of any session cookie still present

