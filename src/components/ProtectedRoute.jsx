import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

// ===========================================================================
// A gate around any route that requires a signed-in user.
//
// The question "is this person signed in?" has three answers, not two, and this
// component exists almost entirely because the third one is easy to forget:
//
//   loading      We do not know yet. The Supabase client is still reading the
//                session back out of localStorage — see the long note in
//                AuthContext.jsx. Every page load and every refresh starts here.
//   signed in    A session exists. Render the page.
//   signed out   Loading has finished and there is no session. Go to /login.
//
// ---------------------------------------------------------------------------
// Why loading renders nothing instead of redirecting
//
// While loading, `session` is null — exactly what it is for a signed-out
// visitor. The two states are indistinguishable by value, and only `loading`
// tells them apart.
//
// Treat loading as signed-out and the bug is immediate and total: someone who
// is genuinely signed in refreshes /dashboard, this component runs on the first
// render (before the session has been read back from localStorage), sees null,
// and redirects. The redirect always wins that race, because it happens
// synchronously on the first render while the restore is still in flight. The
// session then arrives a moment later — to a component that has already been
// navigated away from. The user is sitting on the login page, still holding
// perfectly valid tokens, wondering why the app keeps forgetting them.
//
// Waiting costs a frame or two. Getting it wrong makes the app unusable on
// refresh, so the wait is not a trade-off; it is just correct.
//
// ---------------------------------------------------------------------------
// Why null and not a spinner
//
// The restore is normally a few milliseconds — a synchronous localStorage read
// with no network involved unless the access token has aged out. A spinner
// that appears and vanishes within one or two frames is a flash of noise, and
// reads as jank rather than as progress. If this ever gets genuinely slow (a
// cold token refresh over a bad connection), this is the line where a real
// loading state belongs.
// ===========================================================================
function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  // Still restoring: commit to nothing. Not a redirect, not the page.
  if (loading) return null;

  // Settled, and nobody is signed in.
  //
  // `replace` swaps the protected URL out of the history stack instead of
  // pushing /login on top of it. Without it, pressing Back from the login page
  // returns to /dashboard, which redirects straight back to /login — the Back
  // button looks broken because it is caught in a two-entry loop.
  if (!session) return <Navigate to="/login" replace />;

  // Settled, and there is a session.
  return children;
}

export default ProtectedRoute;
