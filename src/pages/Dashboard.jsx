import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { SITE_NAME } from "../lib/site.js";
import "./Dashboard.css";

// The page at "/dashboard", rendered only inside <ProtectedRoute>.
//
// Because of that wrapper, this component can read `user` without a null check:
// ProtectedRoute renders nothing while the session is loading and redirects
// when there is none, so by the time this runs a session — and therefore a
// user — is guaranteed to exist. Putting the guard in one place is what keeps
// every protected page from repeating it.
function Dashboard() {
  const { user, signOut } = useAuth();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(null);

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);

    const { error: message } = await signOut();

    if (message) {
      setError(message);
      setSigningOut(false);
      return;
    }

    // No navigate() on success, on purpose. Signing out clears the session, the
    // listener in AuthContext sets it to null, ProtectedRoute re-renders and
    // sends us to /login on its own. Adding a redirect here would be a second
    // route to the same outcome — one that would then need updating in step
    // with the first.
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <p className="dashboard__brand">{SITE_NAME}</p>
        <h1 className="dashboard__title">You&rsquo;re logged in</h1>
      </header>

      <section className="dashboard__panel">
        <h2 className="dashboard__panel-label">Account</h2>
        <p className="dashboard__email">{user.email}</p>
      </section>

      {error && (
        <p className="dashboard__error" role="alert">
          {error}
        </p>
      )}

      <button
        className="dashboard__sign-out"
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? "Logging out…" : "Log out"}
      </button>
    </main>
  );
}

export default Dashboard;
