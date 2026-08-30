// Translates Supabase auth errors into sentences meant for a person.
//
// The strings Supabase returns are written for developers: "Invalid login
// credentials", "AuthApiError: User already registered", "Failed to fetch".
// They describe an API, not a situation; they are not phrased for someone who
// has just mistyped a password; and their exact wording changes between
// releases, so any UI that renders them directly is quietly coupled to the
// vendor's changelog. Nothing from the server is ever put on screen — every
// error passes through here first.
//
// Matching is done on `error.code`, not on the message. Codes are a documented,
// stable part of the API; the human-readable text beside them is not. An
// The codes below marked as confirmed were observed coming back from this
// project's own auth server; the rest are documented codes kept as a safety net
// for paths that are harder to trigger by hand (a rate limit, a disabled
// sign-up). An unrecognised code falls through to a deliberately vague,
// blameless sentence:
// if we did not anticipate the failure it is far more likely to be our problem
// than the user's, and guessing out loud ("your account may be locked") would
// be worse than admitting nothing useful is known.

const MESSAGES = {
  // Sign in
  // Confirmed against the live project.
  invalid_credentials:
    "That email and password don't match an account. Check them and try again.",
  email_not_confirmed:
    "Confirm your email address before logging in — check your inbox for the link we sent.",

  // Sign up
  user_already_exists:
    "An account with that email already exists. Try logging in instead.",
  email_exists:
    "An account with that email already exists. Try logging in instead.",
  weak_password:
    "That password is too easy to guess. Use at least six characters.",
  signup_disabled: "New accounts aren't being accepted right now.",

  // Input the server rejected before doing any work.
  //
  // The two empty-form cases produce different codes, which is worth knowing
  // because neither message is guessable from the code name. Submitting the
  // sign-in form empty is "validation_failed" ("missing email or phone");
  // submitting the sign-up form empty is read as an attempt at an anonymous
  // sign-in — an unrelated Supabase feature, switched off for this project —
  // and comes back as "anonymous_provider_disabled". From the user's side both
  // are simply an empty form.
  validation_failed: "Enter a valid email address and a password.",
  anonymous_provider_disabled: "Enter an email address and a password.",
  email_address_invalid: "That doesn't look like a valid email address.",

  // Rate limiting. Two separate codes, one situation as far as the user is
  // concerned: they pressed the button too many times.
  over_request_rate_limit: "Too many attempts. Wait a minute, then try again.",
  over_email_send_rate_limit:
    "Too many emails sent to that address. Wait a few minutes, then try again.",
};

const NETWORK =
  "Couldn't reach the server. Check your internet connection and try again.";

const UNKNOWN = "Something went wrong on our end. Please try again.";

export function describeAuthError(error) {
  if (!error) return null;

  const known = MESSAGES[error.code];
  if (known) return known;

  // Network failures never carry a code, because the request never reached
  // Supabase to be given one. Worth separating from UNKNOWN: "check your
  // connection" is something the user can actually act on, whereas "try again"
  // is all we can offer when the server itself misbehaved.
  if (
    error.name === "AuthRetryableFetchError" ||
    error.message === "Failed to fetch" ||
    error.message === "Load failed" // Safari's wording for the same thing
  ) {
    return NETWORK;
  }

  return UNKNOWN;
}
