import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { SITE_NAME } from "../lib/site.js";
import "./Auth.css";

// The page at "/signup". A controlled form: React holds the field values in
// state and the inputs render whatever state says, so there is one copy of the
// truth rather than a DOM value and a JS value drifting apart.
function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // A real pending state, not a decorative one: it is set before the network
  // call and cleared on every path out of it, so the button reflects work that
  // is actually in flight. It also disables the fields and the button, which is
  // what stops a double submit from creating two requests.
  const [submitting, setSubmitting] = useState(false);

  // Already translated into plain language by the auth context — see
  // lib/authErrors.js. A raw Supabase string never reaches this state.
  const [error, setError] = useState(null);

  // Sign-up succeeded but produced no session, because the account needs to be
  // confirmed by email first. The form is replaced with an explanation rather
  // than left looking like nothing happened.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(event) {
    // A form's default action is a full page navigation, which would reload the
    // app from scratch and throw away every piece of state above.
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    const { error: message, needsConfirmation } = await signUp(email, password);

    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }

    if (needsConfirmation) {
      setAwaitingConfirmation(true);
      setSubmitting(false);
      return;
    }

    // Email confirmation is switched off for this project, so sign-up returned
    // a session and the listener in AuthContext has already stored it — they
    // are signed in. `replace` keeps /signup out of the history stack, so Back
    // from the dashboard does not return to a form they have finished with.
    navigate("/dashboard", { replace: true });
  }

  if (awaitingConfirmation) {
    return (
      <main className="auth">
        <div className="auth__card">
          <h1 className="auth__title">Check your email</h1>
          <p className="auth__subtitle">
            We sent a confirmation link to <strong>{email}</strong>. Open it to
            finish setting up your account, then log in.
          </p>
          <Link
            className="button button--secondary auth__secondary-action"
            to="/login"
          >
            Go to log in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Create your {SITE_NAME} account</h1>
        <p className="auth__subtitle">
          One account keeps your balances and goals in sync.
        </p>

        {/* noValidate turns off the browser's own validation bubbles. They are
            styled by the browser, worded by the browser, and appear in a
            different place from our own messages — so the form would have two
            unrelated ways of telling you the same thing. The inputs keep their
            type and required attributes for semantics and autofill. */}
        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          <div className="auth__field">
            {/* htmlFor matched to the input's id is what makes the label part
                of the control: clicking it focuses the field, and a screen
                reader announces "Email, edit text" instead of just "edit text".
                A placeholder is not a label — it disappears as soon as you
                type, exactly when you might need to check what you are in. */}
            <label className="auth__label" htmlFor="signup-email">
              Email
            </label>
            <input
              className="input"
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="signup-password">
              Password
            </label>
            <input
              className="input"
              id="signup-password"
              name="password"
              type="password"
              // "new-password" rather than "current-password" tells a password
              // manager to offer to generate and save one, instead of trying to
              // fill an existing credential into a field for a new account.
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
            <p className="auth__hint">At least six characters.</p>
          </div>

          {/* role="alert" makes a screen reader announce this the moment it
              appears — without it, a sighted user sees the error and everyone
              else is left with a form that silently did nothing. */}
          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}

          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth__alt">
          Already have an account?{" "}
          <Link className="auth__link" to="/login">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Signup;
