## Context

This is a greenfield project with no existing codebase. The goal is to synchronize a user's Google Calendar OOO events with Gmail's vacation autoreply feature. Both APIs are part of the Google Workspace ecosystem.

The system runs on a daily Apps Script time-based trigger. It fetches upcoming OOO events, computes the next/current OOO interval, and pre-configures the Gmail vacation responder with a `startTime` and `endTime` so Gmail handles activation and deactivation automatically. The script runs as the authenticated Google account — no OAuth credentials files or token management required.

## Goals / Non-Goals

**Goals:**
- Detect OOO events in Google Calendar via the built-in `outOfOffice` event type (all-day events only)
- Pre-configure Gmail vacation autoreply with correct start/end dates so Gmail handles activation/deactivation automatically
- Disable Gmail vacation autoreply when no current or upcoming OOO event exists
- Support a configurable autoreply message template with optional `{return_date}` placeholder
- Run as a Google Apps Script project on a daily time-based trigger — no local machine or credentials required

**Non-Goals:**
- Real-time webhook-based triggering (polling is sufficient for OOO granularity)
- Multi-user / multi-account support in the first version
- UI or web dashboard
- Sending replies on behalf of the user (only the autoreply setting is managed)
- Support for non-Google calendar/mail providers

## Decisions

### Runtime: Google Apps Script

**Decision**: Implement as a Google Apps Script project with a time-based installable trigger (daily).

**Rationale**: Apps Script runs inside Google's infrastructure as the user's own account. It calls Calendar and Gmail APIs directly via built-in services (`CalendarApp`, `GmailApp`, `MailApp`) with no OAuth credentials, no token management, and no local machine required. Sharing is straightforward: the `.gs` files live in git; other users paste them into a new Apps Script project at `script.google.com` and add a trigger.

**Alternatives considered**:
- Python + cron: requires a machine that's always on and manual OAuth credential management.
- Cloud Run + Cloud Scheduler: correct architecture for multi-user or production use, but significant GCP setup overhead for a personal tool.

---

### OOO Event Detection: `eventType: 'outOfOffice'`

**Decision**: Identify OOO events by the built-in `eventType: 'outOfOffice'` attribute via the Advanced Calendar Service (Calendar REST API v3). Only all-day events (those with a `date` field, not `dateTime`) are considered.

**Rationale**: Uses Google's own semantic rather than fragile keyword matching. All-day scope eliminates edge cases around timed events and exclusive end-date handling.

**Alternatives considered**:
- Keyword matching on event title: flexible but requires user configuration and is ambiguous.
- Dedicated OOO calendar: requires extra calendar setup by the user.

---

### Scheduling: Apps Script time-based trigger, daily

**Decision**: A daily time-based trigger is sufficient. Gmail is pre-configured with `startTime` and `endTime` so it handles activation/deactivation automatically — the script does not need to run at the exact moment an OOO period starts or ends.

**Rationale**: OOO events are planned in advance. Configuring Gmail a day (or weeks) ahead with the correct start/end dates is more robust than polling to catch transitions in real time.

---

### Event Fetch: Recursive window extension

**Decision**: Start with a 90-day lookahead window. After fusing intervals, if any interval extends beyond the window end, extend the window to that interval's end, fetch events in the gap, re-fuse, and repeat. Cap at 10 iterations as a safety valve.

**Rationale**: A fixed window can miss events that overlap the boundary — e.g. an event starting on day 89 (within window) that overlaps with one starting on day 91 (outside window). Recursive extension guarantees all overlapping events are captured regardless of where they fall relative to the initial window boundary.

**Alternatives considered**:
- No upper bound (fetch all future events): correct but over-fetches; 50-result cap would be needed anyway.
- Extend window on overlap: this is the chosen approach.

---

### Gmail Pre-configuration: startTime + endTime

**Decision**: Configure the Gmail vacation responder with both `startTime` (OOO interval start) and `endTime` (last OOO day, inclusive), enabling it in advance for future OOO periods.

**Rationale**: Gmail natively supports scheduled vacation responders via these fields. This decouples the script's run time from the OOO transition time, making a daily trigger sufficient.

---

### Autoreply State Management: Idempotent

**Decision**: On each run, compare the desired Gmail state (derived from the calendar) with the actual state. Call the Gmail API only if they differ.

**Rationale**: Avoids unnecessary API calls. If the user manually changes the autoreply between runs, the next daily run will restore the script-managed state (documented behavior, accepted trade-off).

**Implementation note — `enableAutoReply` is never automatically cleared by Gmail**: After `endTime` passes, Gmail stops sending replies but leaves `enableAutoReply: true` in the API response indefinitely. Do not use `enableAutoReply === false` as a signal that the responder is already off. Instead, define "currently active" as `enableAutoReply === true AND endTime > now`. When no upcoming OOO interval exists and the responder is in this expired-but-still-set state, the script must still call `updateVacation` to set `enableAutoReply: false` and clean up.

---

### Notifications: Email on change and on error

**Decision**: Send an email to `Session.getActiveUser().getEmail()` whenever the autoreply is updated or disabled. On any unhandled exception, send an error email with the stack trace and re-throw.

**Rationale**: Silent failures in a background sync are hard to notice. Email notification via `MailApp.sendEmail()` requires no configuration in Apps Script and surfaces both successful changes and errors.

## Risks / Trade-offs

- **Overlapping or adjacent OOO events** → Mitigation: Intervals are fused; consecutive or overlapping events are merged into a single period (e.g. a Mon–Thu block followed by a Friday event is treated as one Mon–Fri period).
- **OOO event near the 90-day window boundary** → Mitigation: Recursive window extension ensures events that straddle the boundary are correctly fused with events just outside it.
- **Responder active past the last OOO day** → By design: the interval end is extended to the day before `available_date` (e.g. through Sunday for a Friday OOO) so the responder stays active while the user cannot yet respond. The daily run on Saturday/Sunday sees the interval as still current and makes no change.
- **User manually changes autoreply** → Trade-off: The next daily run will restore the script-managed state. This is documented and accepted.
- **Rate limits** → Mitigation: A single run makes at most 3–5 API calls (calendar fetch + possible extensions + gmail read/write); well within Google API quotas.
- **Apps Script quota** → Mitigation: Daily trigger uses negligible quota. Apps Script free tier allows 6 min/day execution time; this script runs in under a second.

## Migration Plan

1. Copy the `.gs` files from this repo into a new project at `script.google.com`
2. In the Apps Script editor: click **+** next to Services → select **Google Calendar API** → Add (the default GCP project handles API enablement automatically — no Cloud Console steps needed)
3. Edit the configuration constants at the top of the script (message template, etc.)
4. Run the script once manually to verify it works
5. Add a time-based trigger: Edit → Current project's triggers → Add trigger → time-driven → Day timer
6. To disable: remove the trigger and optionally run `disableAutoreply()` manually to clear the current autoreply
