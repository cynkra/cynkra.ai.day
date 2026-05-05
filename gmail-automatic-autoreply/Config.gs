// ---------------------------------------------------------------------------
// Configuration — edit these values before running for the first time.
// ---------------------------------------------------------------------------

// Number of days to look ahead for OOO events on the initial fetch.
var LOOKAHEAD_DAYS = 90;

// Maximum number of times the fetch window may be extended to capture OOO
// events that overlap the initial window boundary.
var MAX_WINDOW_EXTENSIONS = 10;

// Autoreply message template.
// {return_date} is replaced with the last OOO day formatted as "May 22, 2026".
// If you do not want a return-date placeholder, remove {return_date}.
var AUTOREPLY_MESSAGE_TEMPLATE =
  "Thank you for your email. I am currently out of the office and will " +
  "return on {return_date}. I will reply as soon as possible after my return.";
