// ---------------------------------------------------------------------------
// CalendarWatcher.gs
// Fetches OOO events from Google Calendar and returns the next/current fused
// OOO interval, or null if none exists.
// ---------------------------------------------------------------------------

/**
 * Fetches all-day outOfOffice events from the primary calendar in [windowStart, windowEnd).
 * Returns an array of {start: Date, end: Date} where end is the last OOO day (inclusive),
 * accounting for the Calendar API's exclusive end-date convention.
 *
 * @param {Date} windowStart
 * @param {Date} windowEnd
 * @returns {{start: Date, end: Date}[]}
 */
function fetchOooEvents_(windowStart, windowEnd) {
  var response = Calendar.Events.list('primary', {
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    eventTypes: ['outOfOffice'],
    singleEvents: true,
    orderBy: 'startTime'
  });

  var events = [];
  (response.items || []).forEach(function(item) {
    // All-day events have start.date; timed events have start.dateTime — skip timed.
    if (!item.start || !item.start.date) return;

    var startDate = parseDate_(item.start.date);
    // The Calendar API uses an exclusive end date for all-day events:
    // an OOO event covering Mon–Wed has end.date = Thursday.
    // Subtract one day to get the actual last OOO day (inclusive).
    var endDate = parseDate_(item.end.date);
    endDate.setDate(endDate.getDate() - 1);

    events.push({ start: startDate, end: endDate });
  });

  return events;
}

/**
 * Merges overlapping intervals. Input array is sorted by start in place.
 * Two intervals are merged only when they overlap (start of one is on or before end of other),
 * not merely when they are adjacent.
 *
 * @param {{start: Date, end: Date}[]} events
 * @returns {{start: Date, end: Date}[]}
 */
function fuseIntervals_(events) {
  if (events.length === 0) return [];

  events.sort(function(a, b) { return a.start - b.start; });

  var fused = [{ start: events[0].start, end: events[0].end }];

  for (var i = 1; i < events.length; i++) {
    var current = fused[fused.length - 1];
    var next = events[i];
    // Overlap: next starts on or before current ends.
    if (next.start <= current.end) {
      if (next.end > current.end) current.end = next.end;
    } else {
      fused.push({ start: next.start, end: next.end });
    }
  }

  return fused;
}

/**
 * Returns the next or current fused OOO interval (first interval whose end >= today),
 * or null if no such interval exists.
 *
 * Starts with a LOOKAHEAD_DAYS window. If any fused interval extends beyond the window
 * boundary, the window is extended and additional events are fetched, up to
 * MAX_WINDOW_EXTENSIONS times, ensuring events that straddle the boundary are captured.
 *
 * @returns {{start: Date, end: Date}|null}
 */
function getNextOooInterval() {
  var today = startOfDay_(new Date());
  var windowStart = today;
  var windowEnd = addDays_(today, LOOKAHEAD_DAYS);

  var allEvents = fetchOooEvents_(windowStart, windowEnd);
  var fused = fuseIntervals_(allEvents);

  for (var i = 0; i < MAX_WINDOW_EXTENSIONS; i++) {
    // Find the maximum end date across all fused intervals.
    var maxEnd = fused.reduce(function(m, iv) { return iv.end > m ? iv.end : m; }, windowEnd);

    // If no interval reaches beyond the current window, we're done.
    if (maxEnd <= windowEnd) break;

    // Extend: fetch events in the gap [windowEnd, maxEnd+1day] and re-fuse.
    var newWindowEnd = addDays_(maxEnd, 1);
    var extra = fetchOooEvents_(windowEnd, newWindowEnd);
    windowEnd = newWindowEnd;

    if (extra.length === 0) break;

    allEvents = allEvents.concat(extra);
    fused = fuseIntervals_(allEvents);
  }

  // Return the first interval whose end is on or after today.
  for (var j = 0; j < fused.length; j++) {
    if (fused[j].end >= today) return fused[j];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parses a YYYY-MM-DD string into a local midnight Date. */
function parseDate_(dateStr) {
  var parts = dateStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/** Returns a new Date set to midnight (start of day) in local time. */
function startOfDay_(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a new Date offset by n days. */
function addDays_(date, n) {
  var d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
