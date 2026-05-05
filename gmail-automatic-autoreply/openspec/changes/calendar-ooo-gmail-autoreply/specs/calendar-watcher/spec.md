## ADDED Requirements

### Requirement: Fetch OOO calendar events with recursive window extension
The system SHALL fetch all-day events of type `outOfOffice` from the user's primary calendar, starting from today with an initial lookahead of 90 days. If any fused interval extends beyond the current window end, the window SHALL be extended to cover that interval and additional events SHALL be fetched, repeating until no fused interval exceeds the window boundary.

Only all-day events (those with a `date` field rather than a `dateTime` field in the Calendar API response) are considered. Timed events are ignored.

OOO events are identified by `eventType: 'outOfOffice'` via the Advanced Calendar Service (Calendar REST API v3). Keyword matching on event titles is not used.

#### Scenario: No OOO events in window
- **WHEN** there are no all-day `outOfOffice` events from today onward
- **THEN** the system returns an empty interval list without error

#### Scenario: All events fit within initial window
- **WHEN** all fetched events start and end within the initial 90-day window
- **THEN** the system returns the fused intervals without additional fetches

#### Scenario: Interval extends beyond window boundary
- **WHEN** after fusing, one or more intervals extend beyond the current window end
- **THEN** the system extends the window to the maximum interval end date, fetches events in `[old_window_end, new_window_end]`, merges them into the event set, re-fuses, and repeats until no interval exceeds the window end

#### Scenario: Pathological chain (safety cap)
- **WHEN** the recursive extension has iterated 10 times without stabilizing
- **THEN** the system stops extending and works with the intervals collected so far

#### Scenario: API error
- **WHEN** the Calendar API returns an error during any fetch
- **THEN** the system raises an exception and does not modify Gmail settings

---

### Requirement: Fuse overlapping OOO intervals
The system SHALL merge overlapping (not merely adjacent) all-day OOO events into contiguous intervals.

The exclusive end-date convention of the Calendar API (e.g. an OOO event covering Mon–Wed has `end.date = Thursday`) SHALL be accounted for: the last OOO day is `end.date - 1 day`.

#### Scenario: Non-overlapping events
- **WHEN** two OOO events have no date overlap
- **THEN** they are returned as two separate intervals

#### Scenario: Overlapping events
- **WHEN** two or more OOO events overlap (one starts before the other ends)
- **THEN** they are merged into a single interval spanning `min(starts)` to `max(ends)`

#### Scenario: Multiple overlapping events
- **WHEN** events A, B, C overlap such that A∩B ≠ ∅ and B∩C ≠ ∅ but A∩C = ∅
- **THEN** all three are merged into one interval

---

### Requirement: Select next or current OOO interval
The system SHALL select the single interval to act on: the first fused interval whose end date is after today (i.e., currently active or upcoming).

#### Scenario: One interval active now
- **WHEN** today falls within a fused interval
- **THEN** that interval is returned as the active OOO period

#### Scenario: Future interval, none active now
- **WHEN** no interval contains today but a future interval exists
- **THEN** the earliest future interval is returned so Gmail can be pre-configured

#### Scenario: No current or future intervals
- **WHEN** all fused intervals have already ended
- **THEN** the system returns no active interval (desired Gmail state: autoreply off)
