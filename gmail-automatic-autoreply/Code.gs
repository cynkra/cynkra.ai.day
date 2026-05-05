// ---------------------------------------------------------------------------
// Code.gs
// Main entry point. Run sync() manually or attach a daily time-based trigger.
// ---------------------------------------------------------------------------

function sync() {
  try {
    console.log('=== OOO sync started ===');
    var me = Session.getActiveUser().getEmail();
    var interval = getNextOooInterval();

    if (interval !== null) {
      console.log('OOO interval found, calling configureAutoreply');
      var updated = configureAutoreply(interval);
      if (updated) {
        console.log('Autoreply configured, sending confirmation email to %s', me);
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
      } else {
        console.log('Autoreply already correctly configured, no change needed');
      }
    } else {
      console.log('No OOO interval found, calling disableAutoreply');
      var disabled = disableAutoreply();
      if (disabled) {
        console.log('Autoreply disabled, sending confirmation email to %s', me);
        MailApp.sendEmail(
          me,
          'OOO autoreply disabled',
          'No upcoming OOO events were found. Your Gmail vacation responder has been disabled.'
        );
      } else {
        console.log('Autoreply already disabled, no change needed');
      }
    }

    console.log('=== OOO sync complete ===');
  } catch (e) {
    console.error('OOO sync failed: %s\n%s', e.message, e.stack);
    try {
      MailApp.sendEmail(
        Session.getActiveUser().getEmail(),
        'OOO sync ERROR',
        'The OOO sync script encountered an error:\n\n' + e.message + '\n\n' + e.stack
      );
    } catch (_) {}
    throw e;
  }
}
