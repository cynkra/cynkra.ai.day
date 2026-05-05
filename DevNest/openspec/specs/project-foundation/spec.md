# project-foundation Specification

## Purpose
TBD - created by archiving change bootstrap-devnest-mvp. Update Purpose after archive.
## Requirements
### Requirement: Application boots only with valid configuration

The system SHALL parse and validate every required environment
variable at process start. The process MUST refuse to start (exit
non-zero) when any required variable is missing or fails its schema
check, and MUST NOT defer the failure to first request.

#### Scenario: All required env vars present and valid

- **WHEN** the process starts with a `DATABASE_URL`, `AUTH_SECRET`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITLAB_CLIENT_ID`,
  `GITLAB_CLIENT_SECRET`, `EMAIL_FROM`, and SMTP/email-provider
  credentials, all matching the configuration schema
- **THEN** the process completes startup, binds to the configured
  port, and begins serving requests

#### Scenario: Required env var missing

- **WHEN** the process starts without `DATABASE_URL` set
- **THEN** the process exits with a non-zero code and prints a
  human-readable message naming the missing variable, before any
  port is bound

#### Scenario: Required env var malformed

- **WHEN** the process starts with `DATABASE_URL` set to a value
  that is not a valid Postgres connection URL
- **THEN** the process exits with a non-zero code and prints a
  message identifying the offending variable and the validation
  error, before any port is bound

### Requirement: Health endpoint reports application and database status

The system SHALL expose a `GET /api/health` endpoint that returns
HTTP 200 with a JSON body of shape
`{ status: "ok" | "degraded", db: "ok" | "down", version: string }`
when the application can serve traffic, and HTTP 503 with the same
shape when the database is unreachable.

#### Scenario: Application up, database reachable

- **WHEN** the application is running and a connection to the
  configured Postgres database succeeds within 1 second
- **THEN** `GET /api/health` returns HTTP 200 with `status: "ok"`
  and `db: "ok"`

#### Scenario: Database unreachable

- **WHEN** the application is running but the Postgres database
  cannot be reached within 1 second
- **THEN** `GET /api/health` returns HTTP 503 with `status:
  "degraded"` and `db: "down"`

### Requirement: Every request has a stable request id

The system SHALL attach a request id to every inbound HTTP request,
preserve any client-supplied `x-request-id` header when present and
well-formed, generate one otherwise, and include the same id in every
response header and every log line emitted while handling that
request.

#### Scenario: Client supplies a valid request id

- **WHEN** a request arrives with `x-request-id: abc-123` (matching
  the accepted format)
- **THEN** the response includes `x-request-id: abc-123` and every
  log line for that request includes `requestId: "abc-123"`

#### Scenario: Client does not supply a request id

- **WHEN** a request arrives without an `x-request-id` header
- **THEN** the system generates a new request id, returns it in the
  response `x-request-id` header, and includes it in every log
  line for that request

### Requirement: Unhandled errors do not leak internals

The system SHALL render a user-facing error page for unhandled
exceptions. In production builds, the page MUST NOT expose stack
traces, internal file paths, SQL, or environment values; it MUST
display the request id so a user can quote it in a support request.

#### Scenario: Server error in production build

- **WHEN** a route handler throws an unhandled exception while
  `NODE_ENV === "production"`
- **THEN** the response is HTTP 500 with a generic error page that
  shows the request id and contains no stack trace, file path, SQL
  string, or env value

#### Scenario: Server error in development build

- **WHEN** a route handler throws an unhandled exception while
  `NODE_ENV !== "production"`
- **THEN** the response includes the full stack trace and error
  details to aid local debugging

### Requirement: Per-route error boundaries isolate failures

The system SHALL place error boundaries at each authenticated
route group (at minimum: `feed`, profile, and post-creation routes)
so that an exception in one route group does not prevent rendering
of other authenticated route groups.

#### Scenario: Profile route throws while feed is healthy

- **WHEN** the profile route group throws during render and the
  user navigates to the feed
- **THEN** the feed renders normally and the profile route group
  shows its scoped error UI with the request id

