## 1. Project Setup

- [ ] 1.1 Create project directory structure (`src/`, `tests/`, config files)
- [ ] 1.2 Create `requirements.txt` with `google-api-python-client`, `google-auth-oauthlib`, `google-auth-httplib2`, `pyyaml`
- [ ] 1.3 Create `config.yaml` template with all configurable options (calendar ID, OOO keywords, message template, credentials path, token path)
- [ ] 1.4 Add `.gitignore` entries for `token.json`, `credentials.json`, and `*.pyc`

## 2. Google API Authentication

- [ ] 2.1 Implement `auth.py` with OAuth2 flow using `google-auth-oauthlib` — loads credentials from file, persists token, handles refresh
- [ ] 2.2 Support `--auth` flag in CLI to run the interactive OAuth2 consent flow and exit
- [ ] 2.3 Write clear error message when token is invalid/revoked, instructing user to delete token file and re-run with `--auth`

## 3. Configuration Loader

- [ ] 3.1 Implement `config.py` to load `config.yaml` and apply environment variable overrides (`GOOGLE_CREDENTIALS_PATH`, `GOOGLE_TOKEN_PATH`, `OOO_KEYWORDS`, `CALENDAR_ID`)
- [ ] 3.2 Validate required config keys on startup and exit with descriptive error if missing

## 4. Calendar Watcher

- [ ] 4.1 Implement `calendar_watcher.py` — query Google Calendar API for events in the lookahead window
- [ ] 4.2 Implement keyword-based OOO event detection (case-insensitive match, configurable keyword list)
- [ ] 4.3 Handle all-day events: treat them as spanning 00:00:00–23:59:59 UTC on each covered date
- [ ] 4.4 Implement `get_active_ooo_period()` — returns `(is_active: bool, end_time: datetime | None)` based on current UTC time
- [ ] 4.5 Handle overlapping OOO events by returning the latest end time

## 5. Gmail Autoreply Manager

- [ ] 5.1 Implement `gmail_manager.py` — read current vacation responder settings via Gmail API
- [ ] 5.2 Implement `enable_autoreply(end_time, message)` — sets vacation responder with correct dates and message
- [ ] 5.3 Implement `disable_autoreply()` — disables vacation responder
- [ ] 5.4 Implement idempotency checks — skip API call if current state already matches desired state
- [ ] 5.5 Implement `{return_date}` substitution in message template (formatted as `YYYY-MM-DD`)

## 6. OOO Sync Orchestrator

- [ ] 6.1 Implement `orchestrator.py` — tie together calendar watcher and Gmail manager into a single sync cycle
- [ ] 6.2 Log all actions taken (enabled, disabled, no change) with timestamps
- [ ] 6.3 On any API failure, log error and exit with non-zero exit code without modifying settings

## 7. CLI Entry Point

- [ ] 7.1 Implement `main.py` with argument parsing: no flags (normal run), `--auth`, `--dry-run`
- [ ] 7.2 Wire `--dry-run` to skip Gmail API write calls and only log the intended action

## 8. Tests

- [ ] 8.1 Write unit tests for OOO keyword detection (case sensitivity, partial matches)
- [ ] 8.2 Write unit tests for all-day event time normalization
- [ ] 8.3 Write unit tests for overlapping event end-time resolution
- [ ] 8.4 Write unit tests for idempotency logic in Gmail manager (no API call when state matches)
- [ ] 8.5 Write unit tests for `{return_date}` template substitution

## 9. Documentation

- [ ] 9.1 Write `README.md` with setup instructions: Google Cloud project creation, API enablement, credentials download, first-run auth, cron setup
- [ ] 9.2 Document all config file options with examples
- [ ] 9.3 Add example `config.yaml` with commented fields
