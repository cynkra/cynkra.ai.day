## ADDED Requirements

### Requirement: Run on a time-based Apps Script trigger
The system SHALL be implemented as a Google Apps Script project and invoked via a time-based installable trigger (daily frequency). No local machine, daemon, or external scheduler is required. The script runs as the authenticated Google account and accesses Calendar and Gmail APIs without OAuth credentials files.

#### Scenario: Trigger fires
- **WHEN** the Apps Script time-based trigger fires
- **THEN** the system performs a full sync cycle: fetch OOO intervals, compute desired Gmail state, apply changes if needed

---

### Requirement: Synchronize OOO state
The system SHALL orchestrate the calendar watcher and Gmail autoreply manager to keep the Gmail vacation responder in sync with the user's OOO calendar events.

#### Scenario: OOO interval found, Gmail not yet configured correctly
- **WHEN** the calendar watcher returns a current or upcoming OOO interval and the Gmail settings differ
- **THEN** the system updates Gmail and sends a confirmation email to the user

#### Scenario: No OOO interval, autoreply currently enabled
- **WHEN** no current or upcoming OOO interval exists and the Gmail autoreply is enabled
- **THEN** the system disables the autoreply and sends a confirmation email to the user

#### Scenario: State already in sync
- **WHEN** the desired and actual Gmail states match
- **THEN** the system exits without making any API call or sending any email

---

### Requirement: Email notification on successful change
The system SHALL send an email to the script owner (`Session.getActiveUser().getEmail()`) whenever the Gmail vacation responder is updated or disabled.

#### Scenario: Autoreply configured
- **WHEN** the system enables or updates the Gmail autoreply
- **THEN** an email is sent with subject "OOO autoreply configured" and a body summarising the OOO period and the message that will be sent to correspondents

#### Scenario: Autoreply disabled
- **WHEN** the system disables the Gmail autoreply
- **THEN** an email is sent with subject "OOO autoreply disabled"

---

### Requirement: Email notification on error
The system SHALL catch all unhandled exceptions, send an error email to the script owner, and re-throw the exception so that Apps Script also marks the run as failed.

#### Scenario: Any exception during sync
- **WHEN** an exception is raised at any point during the sync cycle
- **THEN** an email is sent with subject "OOO sync ERROR" containing the error message and stack trace, and the exception is re-thrown
