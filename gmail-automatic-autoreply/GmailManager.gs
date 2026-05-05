// ---------------------------------------------------------------------------
// GmailManager.gs
// Reads and updates Gmail vacation responder settings via the Gmail REST API
// (Advanced Gmail Service). GmailApp does not expose vacation responder methods.
// ---------------------------------------------------------------------------

/**
 * Returns the current vacation responder state.
 * "Active" means enableAutoReply is true AND endTime is in the future —
 * Gmail never auto-clears enableAutoReply after endTime passes, so checking
 * the flag alone is not sufficient.
 *
 * @returns {{ enabled: boolean, startTime: Date|null, endTime: Date|null, message: string }}
 */
function getCurrentVacationState() {
  var settings = Gmail.Users.Settings.getVacation('me');
  var now = new Date();

  // startTime and endTime are epoch milliseconds returned as strings (int64).
  var startTime = settings.startTime ? new Date(parseInt(settings.startTime)) : null;
  var endTime   = settings.endTime   ? new Date(parseInt(settings.endTime))   : null;
  var message   = settings.responseBodyPlainText || '';

  // Treat as active only if the flag is set AND the window has not expired.
  var enabled = !!settings.enableAutoReply && (endTime === null || endTime > now);

  return { enabled: enabled, startTime: startTime, endTime: endTime, message: message };
}

/**
 * Configures the Gmail vacation responder for the given OOO interval.
 * Skips the API call if the responder is already configured with matching dates and message.
 *
 * @param {{ start: Date, end: Date }} interval  - start is the first OOO day, end is the last.
 * @returns {boolean} true if the responder was updated, false if already correct.
 */
function configureAutoreply(interval) {
  var startTime = startOfDay_(interval.start);
  // endTime = end of the last OOO day in the script's timezone.
  var endTime = endOfDay_(interval.end);
  var message = buildMessage_(interval.end);

  var current = getCurrentVacationState();

  // Idempotency: skip if already configured with the same window and message.
  if (
    current.enabled &&
    current.startTime && Math.abs(current.startTime - startTime) < 60000 &&
    current.endTime   && Math.abs(current.endTime   - endTime)   < 60000 &&
    current.message === message
  ) {
    return false;
  }

  Gmail.Users.Settings.updateVacation({
    enableAutoReply: true,
    responseBodyPlainText: message,
    startTime: startTime.getTime().toString(),
    endTime: endTime.getTime().toString()
  }, 'me');

  return true;
}

/**
 * Disables the Gmail vacation responder.
 * Handles both the active case and the expired-but-still-set case (enableAutoReply
 * stays true in the API after endTime passes until explicitly cleared).
 * Skips the API call if the responder is already disabled.
 *
 * @returns {boolean} true if the responder was disabled, false if already off.
 */
function disableAutoreply() {
  var settings = Gmail.Users.Settings.getVacation('me');

  if (!settings.enableAutoReply) return false;

  Gmail.Users.Settings.updateVacation({ enableAutoReply: false }, 'me');
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Substitutes {available_date} in AUTOREPLY_MESSAGE_TEMPLATE with the first
 * working day after the last OOO day (skips Saturday and Sunday).
 * e.g. last OOO day = Friday → available_date = Monday.
 */
function buildMessage_(lastOooDay) {
  var available = nextWorkingDay_(lastOooDay);
  var formatted = Utilities.formatDate(available, Session.getScriptTimeZone(), 'MMMM d, yyyy');
  return AUTOREPLY_MESSAGE_TEMPLATE.replace(/\{available_date\}/g, formatted);
}

/** Returns the first working day (Mon–Fri) strictly after the given date. */
function nextWorkingDay_(date) {
  var d = new Date(date);
  d.setDate(d.getDate() + 1);
  var day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
  if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
  return d;
}

/** Returns a Date set to 00:00:00.000 on the given day (local time). */
function startOfDay_(date) {
  var d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a Date set to 23:59:59.999 on the given day (local time). */
function endOfDay_(date) {
  var d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
