// ---------------------------------------------------------------------------
// Configuration — edit these values before running for the first time.
// ---------------------------------------------------------------------------

// Number of days to look ahead for OOO events on the initial fetch.
var LOOKAHEAD_DAYS = 90;

// Maximum number of times the fetch window may be extended to capture OOO
// events that overlap the initial window boundary.
var MAX_WINDOW_EXTENSIONS = 10;

// Autoreply message template.
// {available_date} is replaced with the first working day after the last OOO day
// (e.g. if OOO ends on a Friday, {available_date} will be the following Monday).
var AUTOREPLY_MESSAGE_TEMPLATE =
  "Thank you for your email. I am currently out of the office and will not " +
  "see this message before {available_date}. I will be available again on " +
  "{available_date} and will get back to you then.";
