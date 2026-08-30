import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { SITE_NAME } from "../lib/site.js";
import "./Auth.css";

// The page at "/login". Structurally the twin of Signup.jsx — the two share
// Auth.css rather than each owning a near-identical stylesheet, since they are
// deliberately the same screen with different words on it.
function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    const { error: message } = await signIn(email, password);

    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }

    // Success. The session is already in the auth context by now — signIn
    // resolved after onAuthStateChange fired — so this navigation lands on a
    // dashboard whose ProtectedRoute sees a session and lets it through.
    //
    // Deliberately unpaired with setSubmitting(false): leaving the button in
    // its pending state through the navigation avoids a flash of "Log in" on a
    // form that is on its way off screen.
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Log in to {SITE_NAME}</h1>
        <p className="auth__subtitle">Welcome back.</p>

        <form className="auth__form" onSubmit={handleSubmit} noValidate>
          <div className="auth__field">
            <label className="auth__label" htmlFor="login-email">
              Email
            </label>
            {/* The ids are prefixed per page so that they stay unique to the
                document even if these forms are ever rendered side by side —
                a duplicate id silently breaks the label/input pairing. */}
            <input
              className="auth__input"
              id="login-email"
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
            <label className="auth__label" htmlFor="login-password">
              Password
            </label>
            <input
              className="auth__input"
              id="login-password"
              name="password"
              type="password"
              // The existing credential, so a password manager should fill it.
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}

          <button className="auth__submit" type="submit" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="auth__alt">
          New here?{" "}
          <Link className="auth__link" to="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Login;
