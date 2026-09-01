import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { useCards } from "../hooks/useCards.js";
import DebtCommandCenter from "../components/DebtCommandCenter.jsx";
import CardList from "../components/CardList.jsx";
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

  // One request, two readers. The summary and the list are computed from the
  // same array in the same render, so the total above can never describe a set
  // of cards different from the one below it — see hooks/useCards.js for why
  // that is worth lifting the fetch out of CardList for.
  // `error` is renamed on the way out. The page already has one — the sign-out
  // failure below — and the two are unrelated failures of unrelated actions.
  // Sharing one name would mean the next person reading this has to work out
  // which of two things went wrong from context.
  const {
    cards,
    loading,
    error: cardsError,
    retry,
    create,
    update,
    remove,
  } = useCards();

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
        {/* The page's own title, not the cards' — the section below names
            itself, and two headings both reading "Your cards" would be one
            heading and an echo. */}
        <h1 className="dashboard__title">Dashboard</h1>
      </header>

      {/* Above the list, and first on the page after its title, because it is
          the answer to the question someone opens this screen with. The list
          below is the detail behind it.

          Both sections are handed the same loading and error state rather than
          this page rendering one spinner over the pair of them. They are the
          same request, but they are not the same statement: the list says "we
          are still fetching your cards" and the summary says "we are still
          adding up what they cost", and a single generic message in place of
          both would be less true than either. */}
      <DebtCommandCenter cards={cards} loading={loading} error={cardsError} />

      <CardList
        cards={cards}
        loading={loading}
        error={cardsError}
        onRetry={retry}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
      />

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
