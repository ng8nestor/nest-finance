// Translates errors from the credit_cards table into sentences meant for a
// person. The companion to authErrors.js, and deliberately the same shape: one
// lookup keyed on a stable code, a named case for network failures, and a
// blameless fallback for everything we did not anticipate.
//
// It is a separate module from cards.js for the same reason describeAuthError
// lives apart from the auth actions that call it: what the app *does* and how
// it *speaks* are two different concerns, and keeping the sentences in one file
// means they can be read — and rewritten — as a group, without hunting through
// query code for them.
//
// ---------------------------------------------------------------------------
// What the codes are
//
// These are not auth codes. A failed query comes back with either a Postgres
// SQLSTATE — a five-character code fixed by the SQL standard and by Postgres,
// far more stable than anything else in this stack — or a PGRSTxxx code from
// PostgREST, the HTTP layer Supabase puts in front of the database. Both are
// documented and both survive version bumps; the English message beside them is
// neither. So, as in authErrors.js, matching is on the code and the server's
// own message is never rendered.
//
// ---------------------------------------------------------------------------
// Why a check violation should be rare
//
// The form validates the same rules the table's CHECK constraints enforce, so
// in normal use 23514 never reaches a user. It is kept because the two are
// separate pieces of code that can drift, and because the constraints — not the
// form — are what actually guarantee the data. If this message ever appears in
// front of someone, the honest reading is that the form let through something
// the database refused, which is a bug on our side; the sentence says what was
// rejected without pretending to know which field caused it.

const MESSAGES = {
  // A CHECK constraint said no: a negative balance, a limit at or below zero,
  // an APR outside 0–99.999. All four constraints share this one code, and the
  // constraint name is only available in the message text we have already
  // decided not to read, so the sentence names the fields rather than the field.
  23514:
    "Those figures aren't valid: balance and minimum due can't be negative, " +
    "the credit limit must be above zero, and the APR must be under 100%.",

  // NOT NULL violation. Kept as a backstop rather than as an expected case:
  // the obvious way to produce one is an insert with no session, where user_id
  // defaults to a null auth.uid() — but that request is stopped by row-level
  // security first and arrives as 42501 below (checked against this project's
  // own database, not assumed). Nothing else in the payload is nullable, so if
  // this ever does fire, "try again" is genuinely all we know.
  23502: "Something went wrong saving that. Please try again.",

  // The row's user_id points at an auth.users row that no longer exists.
  23503: "That account no longer exists. Try logging out and back in.",

  // Row-level security refused the statement outright, which in this app means
  // one thing: the request carried no usable session. Since the client never
  // sends a user_id, the only way to fail `with check (auth.uid() = user_id)`
  // is for auth.uid() to be null — and an update or delete aimed at someone
  // else's row does not land here at all, because the USING clause filters it
  // out and it comes back as PGRST116 instead.
  //
  // So this is worded as the expired session it is, rather than as an
  // accusation of trying to reach someone else's data.
  42501: "Your session has expired. Log in again to continue.",

  // A number too large for the column: numeric(12,2) tops out just under ten
  // billion, numeric(6,3) just under a thousand.
  22003: "That number is too large. Check the amount and try again.",

  // Text sent where the column wanted a number or a date. The form parses
  // before it submits, so this means something got past that.
  "22P02":
    "Those figures aren't in a format we can save. Check them and try again.",

  // PostgREST: the request expected exactly one row and found none. On an
  // update or a delete that means the card is gone — deleted here in another
  // tab, or never ours to begin with, which row-level security makes look
  // identical and should: either way there is nothing to act on.
  PGRST116: "That card isn't there any more. Refresh to see the current list.",

  // PostgREST: the JWT was missing, malformed, or expired by the time it
  // reached the API.
  PGRST301: "Your session has expired. Log in again to continue.",
};

const NETWORK =
  "Couldn't reach the server. Check your internet connection and try again.";

const UNKNOWN = "Something went wrong on our end. Please try again.";

export function describeCardError(error) {
  if (!error) return null;

  const known = MESSAGES[error.code];
  if (known) return known;

  // No code at all means the request never arrived — the same reasoning as in
  // authErrors.js, and worth keeping separate from UNKNOWN because "check your
  // connection" is something the reader can actually act on.
  if (
    error.message === "Failed to fetch" ||
    error.message === "Load failed" || // Safari's wording for the same thing
    error.message === "NetworkError when attempting to fetch resource." // Firefox's
  ) {
    return NETWORK;
  }

  return UNKNOWN;
}
