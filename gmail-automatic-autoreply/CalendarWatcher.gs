// ---------------------------------------------------------------------------
// CalendarWatcher.gs
// ---------------------------------------------------------------------------

/**
 * Fetches all-day outOfOffice events from the primary calendar in [windowStart, windowEnd).
 * Returns an array of {start: Date, end: Date} where end is the last OOO day (inclusive).
 */
function fetchOooEvents_(windowStart, windowEnd) {
  console.log('Fetching OOO events from %s to %s', windowStart.toISOString(), windowEnd.toISOString());

  var response = Calendar.Events.list('primary', {
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250
  });

  var items = response.items || [];
  console.log('Calendar API returned %s events (all types)', items.length);

  var events = [];
  items.forEach(function(item) {
    // Filter: outOfOffice event type only.
    if (item.eventType !== 'outOfOffice') return;
    // Filter: all-day only (start.date present, not start.dateTime).
    if (!item.start || !item.start.date) return;

    var startDate = parseDate_(item.start.date);
    // Calendar API end.date is exclusive (day after last OOO day), so subtract one day.
    var endDate = parseDate_(item.end.date);
    endDate.setDate(endDate.getDate() - 1);

    console.log('OOO event found: %s → %s (raw end: %s)', item.start.date, formatDate_(endDate), item.end.date);
    events.push({ start: startDate, end: endDate });
  });

  console.log('%s all-day OOO events found in window', events.length);
  return events;
}

/**
 * Merges overlapping intervals. Intervals are merged only when they overlap,
 * not merely when they are adjacent.
 */
function fuseIntervals_(events) {
  if (events.length === 0) return [];

  events.sort(function(a, b) { return a.start - b.start; });

  var fused = [{ start: events[0].start, end: events[0].end }];

  for (var i = 1; i < events.length; i++) {
    var current = fused[fused.length - 1];
    var next = events[i];
    if (next.start <= current.end) {
      if (next.end > current.end) current.end = next.end;
    } else {
      fused.push({ start: next.start, end: next.end });
    }
  }

  console.log('Interval fusion: %s events → %s intervals', events.length, fused.length);
  return fused;
}

/**
 * Returns the next or current fused OOO interval, or null if none.
 */
function getNextOooInterval() {
  var today = startOfDay_(new Date());
  var windowStart = today;
  var windowEnd = addDays_(today, LOOKAHEAD_DAYS);

  console.log('Starting OOO interval search. Today: %s, initial window end: %s', formatDate_(today), formatDate_(windowEnd));

  var allEvents = fetchOooEvents_(windowStart, windowEnd);
  var fused = fuseIntervals_(allEvents);

  for (var i = 0; i < MAX_WINDOW_EXTENSIONS; i++) {
    var maxEnd = fused.reduce(function(m, iv) { return iv.end > m ? iv.end : m; }, windowEnd);

    if (maxEnd <= windowEnd) break;

    console.log('Window extension %s: extending to %s', i + 1, formatDate_(maxEnd));
    var newWindowEnd = addDays_(maxEnd, 1);
    var extra = fetchOooEvents_(windowEnd, newWindowEnd);
    windowEnd = newWindowEnd;

    if (extra.length === 0) break;

    allEvents = allEvents.concat(extra);
    fused = fuseIntervals_(allEvents);
  }

  for (var j = 0; j < fused.length; j++) {
    if (fused[j].end >= today) {
      console.log('Next OOO interval: %s → %s', formatDate_(fused[j].start), formatDate_(fused[j].end));
      return fused[j];
    }
  }

  console.log('No current or upcoming OOO interval found');
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate_(dateStr) {
  var parts = dateStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function startOfDay_(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays_(date, n) {
  var d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
