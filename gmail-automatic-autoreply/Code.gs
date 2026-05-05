// ---------------------------------------------------------------------------
// Code.gs
// Main entry point. Run sync() manually or attach a daily time-based trigger.
// ---------------------------------------------------------------------------

/**
 * Synchronises Gmail vacation responder with Google Calendar OOO events.
 * Call this function directly or attach it to a daily time-based trigger.
 */
function sync() {
  try {
    var me = Session.getActiveUser().getEmail();
    var interval = getNextOooInterval();

    if (interval !== null) {
      var updated = configureAutoreply(interval);
      if (updated) {
        var message = buildMessage_(interval.end);
        var startStr = Utilities.formatDate(interval.start, Session.getScriptTimeZone(), 'MMMM d, yyyy');
        var endStr   = Utilities.formatDate(interval.end,   Session.getScriptTimeZone(), 'MMMM d, yyyy');
        MailApp.sendEmail(
          me,
          'OOO autoreply configured',
          'Your Gmail vacation responder has been configured.\n\n' +
          'OOO period: ' + startStr + ' – ' + endStr + '\n\n' +
          'Message your correspondents will receive:\n' + message
        );
      }
    } else {
      var disabled = disableAutoreply();
      if (disabled) {
        MailApp.sendEmail(
          me,
          'OOO autoreply disabled',
          'No upcoming OOO events were found. Your Gmail vacation responder has been disabled.'
        );
      }
    }
  } catch (e) {
    try {
      MailApp.sendEmail(
        Session.getActiveUser().getEmail(),
        'OOO sync ERROR',
        'The OOO sync script encountered an error:\n\n' + e.message + '\n\n' + e.stack
      );
    } catch (_) {
      // If sending the error email also fails, swallow that error and re-throw the original.
    }
    throw e;
  }
}
