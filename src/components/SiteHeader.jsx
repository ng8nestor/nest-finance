import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { SITE_NAME } from "../lib/site.js";
import "./SiteHeader.css";

// ===========================================================================
// The app's one persistent header. Rendered by App.jsx above the router, so it
// is the same element across every navigation rather than a strip each page
// draws for itself — which is what makes it a frame around the app instead of
// a component four pages happen to agree on.
//
// ---------------------------------------------------------------------------
// Why the landing page is the exception
//
// "/" is a full-screen hero whose entire content is the wordmark, a tagline and
// two buttons. A header above it would put the same mark on the screen twice,
// at two sizes, a few hundred pixels apart — which reads as a mistake rather
// than as branding. The header carries navigation for people who are inside the
// app; the landing page is the thing they are outside of.
//
// ---------------------------------------------------------------------------
// Signed in and signed out
//
// Signed out, this is a wordmark and nothing else: a way back to the start from
// the login form, the signup form, or a 404. There are no navigation links to
// add, because there is nowhere else to go — offering "Log in" here would put a
// second copy of the button the page below is already showing.
//
// Signed in, it grows the two things that had nowhere else to live: who you are
// signed in as, and the way out. Both used to sit at the bottom of the
// dashboard, which meant the only route to signing out was to scroll past every
// card you own to reach it.
// ===========================================================================
function SiteHeader() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(null);

  if (pathname === "/") return null;

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
    <header className="site-header">
      <div className="site-header__bar">
        {/* Home for a signed-out visitor is the landing page; for a signed-in
            one it is the dashboard, because the landing page has nothing on it
            they have not already got past. One link either way — a wordmark
            that goes somewhere different depending on who is looking is still
            one control, and it is the one every app puts in this corner. */}
        <Link
          className="site-header__home"
          to={user ? "/dashboard" : "/"}
          aria-label={`${SITE_NAME} — home`}
        >
          <img
            className="site-header__wordmark"
            src="/brand/nest-name-web.png"
            alt={SITE_NAME}
          />
        </Link>

        {user && (
          <div className="site-header__account">
            {/* The address is a label for the log-out button beside it, not a
                thing to read: it answers "which account is this" at a glance
                and is otherwise the quietest text on the screen. Long addresses
                truncate rather than wrap — see the note in the stylesheet — and
                the title attribute keeps the whole of it reachable. */}
            <p className="site-header__email" title={user.email}>
              {user.email}
            </p>
            <button
              className="button button--secondary site-header__sign-out"
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Logging out…" : "Log out"}
            </button>
          </div>
        )}
      </div>

      {/* Below the bar rather than inside it, so a failed sign-out does not
          reshuffle the header's one row while someone is reading it. role=alert
          because nothing else on the page will have changed — the button they
          pressed is simply enabled again, and without the announcement a screen
          reader user is left with a control that appears to have done
          nothing. */}
      {error && (
        <p className="site-header__error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}

export default SiteHeader;
