## 1. Project Setup

- [ ] 1.1 Create `appsscript.json` manifest with required OAuth scopes (`calendar.readonly`, `gmail.settings.basic`, `gmail.send`) and Advanced Calendar Service declaration
- [ ] 1.2 Create file structure: `Config.gs`, `CalendarWatcher.gs`, `GmailManager.gs`, `Code.gs`

## 2. Configuration

- [ ] 2.1 Implement `Config.gs` with top-of-file constants: `LOOKAHEAD_DAYS` (default 90), `MAX_WINDOW_EXTENSIONS` (default 10), `AUTOREPLY_MESSAGE_TEMPLATE` (default with `{return_date}` placeholder)

## 3. Calendar Watcher

- [ ] 3.1 Implement `fetchOooEvents_(windowStart, windowEnd)` in `CalendarWatcher.gs` using Advanced Calendar Service (`Calendar.Events.list`) — filter for `eventType = 'outOfOffice'` and all-day events only (items where `start.date` exists, not `start.dateTime`)
- [ ] 3.2 Implement interval fusion: sort fetched events by start date, merge overlapping intervals accounting for Calendar API's exclusive end date convention (`end.date` is the day *after* the last OOO day)
- [ ] 3.3 Implement recursive window extension: after fusing, if any interval's end exceeds the current window end, fetch events in `[windowEnd, intervalEnd]`, merge into the set, re-fuse, repeat — cap at `MAX_WINDOW_EXTENSIONS` iterations
- [ ] 3.4 Implement `getNextOooInterval()` as the public entry point: initialise window as `[today, today + LOOKAHEAD_DAYS]`, run fetch + fuse + extend loop, return the first fused interval whose end is after today, or `null` if none

## 4. Gmail Manager

- [ ] 4.1 Implement `getCurrentVacationState()` in `GmailManager.gs` using `GmailApp.getVacationResponder()` — return `{ enabled, startTime, endTime, message }`. Define "currently active" as `enabled === true AND endTime > now` (Gmail never auto-clears the `enabled` flag after `endTime` passes)
- [ ] 4.2 Implement `configureAutoreply(interval)`: call `GmailApp.setVacationResponder(...)` with `startTime` = interval start, `endTime` = last OOO day end-of-day (user's script timezone via `Session.getScriptTimeZone()`), and message with `{return_date}` substituted as a human-readable date
- [ ] 4.3 Implement `disableAutoreply()`: call `GmailApp.setVacationResponder(false, ...)` to clear the responder — handles both active and expired-but-still-set states
- [ ] 4.4 Implement idempotency in both `configureAutoreply` and `disableAutoreply`: compare desired state (startTime, endTime, message) with current state and skip the API call if already matching

## 5. OOO Sync Orchestrator

- [ ] 5.1 Implement `sync()` in `Code.gs` as the main entry point: call `getNextOooInterval()`, read current Gmail state, call `configureAutoreply` or `disableAutoreply` only if state differs
- [ ] 5.2 Send confirmation email via `MailApp.sendEmail(Session.getActiveUser().getEmail(), ...)` when autoreply is configured or disabled — include OOO period dates and the message text in the body
- [ ] 5.3 Wrap entire `sync()` body in `try/catch`: on exception send error email with subject "OOO sync ERROR" containing `e.message` and `e.stack`, then re-throw so Apps Script marks the run as failed

## 6. Documentation

- [ ] 6.1 Write `README.md` with setup instructions: copy `.gs` files into a new project at `script.google.com`, enable Google Calendar API via Services (+ icon), edit config constants in `Config.gs`, run `sync()` once manually to verify, add a time-based trigger (daily)
- [ ] 6.2 Document the `{return_date}` placeholder and the exclusive-end-date convention in inline comments in `Config.gs` and `CalendarWatcher.gs`
