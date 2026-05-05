## Why

Managing Gmail vacation autoreplies manually is error-prone — users forget to enable them before going OOO or forget to disable them after returning. Since OOO periods are already tracked in Google Calendar, the autoreply should be set and cleared automatically based on those events.

## What Changes

- New Google Apps Script project with a daily time-based trigger that monitors Google Calendar for OOO events
- Pre-configures Gmail vacation autoreply with the correct start and end dates whenever an OOO event is found; Gmail handles activation/deactivation automatically
- Disables Gmail vacation autoreply when no current or upcoming OOO event exists
- Configurable autoreply message template with optional `{return_date}` placeholder
- No credentials or OAuth setup required — the script runs as the user's own Google account

## Capabilities

### New Capabilities

- `calendar-watcher`: Polls Google Calendar for OOO events and detects start/end transitions
- `gmail-autoreply-manager`: Enables, updates, and disables Gmail vacation autoreply via the Gmail API
- `ooo-sync-orchestrator`: Coordinates the watcher and autoreply manager — the main entry point that ties the two together and runs on a schedule

### Modified Capabilities

## Impact

- Depends on Google Calendar API (read access to calendar events)
- Depends on Gmail API (read/write access to vacation settings)
- Requires OAuth2 credentials with scopes: `https://www.googleapis.com/auth/calendar.readonly` and `https://www.googleapis.com/auth/gmail.settings.basic`
- New project — no existing code is affected
