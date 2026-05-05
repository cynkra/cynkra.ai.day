// ---------------------------------------------------------------------------
// GmailManager.gs
// Reads and updates Gmail vacation responder settings.
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
  var responder = GmailApp.getVacationResponder();
  var now = new Date();

  var startTime = responder.getStartTime() ? new Date(responder.getStartTime()) : null;
  var endTime   = responder.getEndTime()   ? new Date(responder.getEndTime())   : null;
  var message   = responder.getResponseBodyPlainText() || '';

  // Treat as active only if the flag is set AND the window has not expired.
  var enabled = responder.isEnabled() && (endTime === null || endTime > now);

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

  GmailApp.setVacationResponder(true, message, null, null, false, false, startTime, endTime);
  return true;
}

/**
 * Disables the Gmail vacation responder.
 * Handles both the active case and the expired-but-still-set case (enableAutoReply
 * stays true in the API after endTime passes until explicitly cleared).
 * Skips the API call if the responder is already disabled and not in expired state.
 *
 * @returns {boolean} true if the responder was disabled, false if already off.
 */
function disableAutoreply() {
  var responder = GmailApp.getVacationResponder();

  // If enableAutoReply is already false there is nothing to do.
  if (!responder.isEnabled()) return false;

  GmailApp.setVacationResponder(false);
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Substitutes {return_date} in AUTOREPLY_MESSAGE_TEMPLATE with the last OOO day
 * formatted as a human-readable date (e.g. "May 22, 2026").
 */
function buildMessage_(lastOooDay) {
  var formatted = Utilities.formatDate(
    lastOooDay,
    Session.getScriptTimeZone(),
    'MMMM d, yyyy'
  );
  return AUTOREPLY_MESSAGE_TEMPLATE.replace('{return_date}', formatted);
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
