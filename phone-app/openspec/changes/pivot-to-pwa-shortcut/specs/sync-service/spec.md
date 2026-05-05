## ADDED Requirements

### Requirement: Personal access token authentication for non-browser clients

The backend SHALL accept long-lived personal access tokens (PATs) as an alternative to JWT session tokens on every authenticated endpoint. PATs SHALL be presented in the `Authorization: Token <raw-pat>` header. PATs SHALL be issued and revoked only via authenticated JWT-backed endpoints; PATs themselves cannot be used to mint or revoke other tokens.

A PAT SHALL be persisted as `personal_access_tokens(id, user_id, token_hash, name, created_at, last_used_at, revoked_at)`. The backend SHALL store only the SHA-256 hash of the raw token; the raw token SHALL be returned exactly once at issuance and never again. A revoked PAT (`revoked_at IS NOT NULL`) SHALL be rejected with HTTP 401 on every subsequent request.

#### Scenario: Issuing a PAT returns the raw token exactly once

- **WHEN** an authenticated user POSTs to `/auth/tokens` with a `name`
- **THEN** the backend creates a `personal_access_tokens` row whose `token_hash` is the SHA-256 of the freshly generated raw token
- **AND** the response includes the raw token in plain text
- **AND** subsequent reads of the user's tokens never include the raw token, only the metadata

#### Scenario: A request with a valid PAT is authenticated as the token's owner

- **WHEN** a request arrives with `Authorization: Token <raw-pat>` and the SHA-256 of `<raw-pat>` matches a `personal_access_tokens` row whose `revoked_at IS NULL`
- **THEN** the request is treated as authenticated for that row's `user_id`
- **AND** the row's `last_used_at` is updated to the current timestamp (best-effort, non-blocking)

#### Scenario: A request with a revoked PAT is rejected

- **WHEN** the user has revoked a PAT (`DELETE /auth/tokens/:id`) and a subsequent request arrives with that token
- **THEN** the backend responds with HTTP 401
- **AND** no records are returned, persisted, or modified

#### Scenario: A request with a malformed or unknown token is rejected

- **WHEN** a request arrives with `Authorization: Token <garbage>` whose SHA-256 does not match any `personal_access_tokens` row
- **THEN** the backend responds with HTTP 401 with the same response shape as for any other unauthenticated request

#### Scenario: PAT issuance and revocation require JWT auth

- **WHEN** a request to `POST /auth/tokens` or `DELETE /auth/tokens/:id` carries an `Authorization: Token <pat>` header (instead of a JWT `Bearer`)
- **THEN** the backend responds with HTTP 401
- **AND** the request is logged at the access-control layer as a privilege-escalation attempt

### Requirement: PATs respect per-user data isolation

A request authenticated via PAT SHALL be subject to the exact same per-user data-isolation rules as a JWT-authenticated request: every query that touches `decks` or `cards` MUST filter by the `owner_id` derived from the PAT's `user_id`, and cross-user reads MUST return HTTP 404.

#### Scenario: PAT cannot access another user's card

- **WHEN** user A's PAT is used to request a card whose `owner_id` is user B
- **THEN** the backend responds with HTTP 404 (not 403) so it does not leak existence
- **AND** the request is logged at the access-control layer
