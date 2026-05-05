## ADDED Requirements

### Requirement: Read current autoreply status
The system SHALL read the current Gmail vacation responder settings to determine whether the autoreply is enabled and what its configured start and end times are.

#### Scenario: Autoreply is enabled
- **WHEN** the Gmail API returns vacation settings with `enableAutoReply: true`
- **THEN** the system returns the enabled state, startTime, and endTime

#### Scenario: Autoreply is disabled
- **WHEN** the Gmail API returns vacation settings with `enableAutoReply: false`
- **THEN** the system returns disabled state

#### Scenario: API error
- **WHEN** the Gmail API returns an error
- **THEN** the system raises an exception with a descriptive error message

---

### Requirement: Configure autoreply with start and end date
The system SHALL configure the Gmail vacation responder with both a `startTime` and `endTime`, allowing Gmail to handle activation and deactivation automatically. This enables pre-configuration for future OOO events.

#### Scenario: OOO interval is current or upcoming, autoreply not yet configured correctly
- **WHEN** the calendar watcher returns an OOO interval and the current Gmail settings differ (different start, end, or disabled)
- **THEN** the system sets `enableAutoReply: true` with the interval's start date as `startTime` and last OOO day as `endTime`

#### Scenario: Already configured correctly
- **WHEN** the Gmail autoreply is already enabled with matching startTime and endTime
- **THEN** the system makes no API call (idempotent)

#### Scenario: Message template with return date placeholder
- **WHEN** the configured message template contains `{return_date}`
- **THEN** the system substitutes `{return_date}` with the last OOO day formatted as a human-readable date (e.g. `May 22, 2026`)

---

### Requirement: Disable autoreply
The system SHALL disable the Gmail vacation autoreply when no current or upcoming OOO interval exists.

#### Scenario: Autoreply is enabled and no OOO interval exists
- **WHEN** the calendar watcher returns no active or upcoming OOO interval and the Gmail autoreply is enabled
- **THEN** the system disables the autoreply

#### Scenario: Autoreply already disabled
- **WHEN** no OOO interval exists and the Gmail autoreply is already disabled
- **THEN** the system makes no API call (idempotent)
