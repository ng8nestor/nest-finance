import { useState } from "react";
import { useAuth } from "../hooks/useAuth.js";
import { useCards } from "../hooks/useCards.js";
import DebtCommandCenter from "../components/DebtCommandCenter.jsx";
import PayoffStrategy from "../components/PayoffStrategy.jsx";
import CardList from "../components/CardList.jsx";
import PayoffSimulator from "../components/PayoffSimulator.jsx";
import { usePayoffStrategy } from "../hooks/usePayoffStrategy.js";
import { orderCards } from "../lib/payoff.js";
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

  // Which order the list is in, remembered between visits — see
  // hooks/usePayoffStrategy.js for why that lives in localStorage rather than
  // in a table. It is state on the page rather than inside either component
  // below because both need it: the toggle shows it, and the list is sorted by
  // it. Owning it here is what stops those two from being able to disagree.
  const [strategy, setStrategy] = usePayoffStrategy();

  // The same rows the summary is adding up, in payoff order. A copy — see the
  // note in lib/finance.js on why neither sort touches the array the hook is
  // holding.
  //
  // Only the list is given the ordered copy. The summary above totals every
  // card and the order of a sum is not a thing, so handing it the sorted array
  // would suggest it depended on something it does not.
  const ordered = orderCards(cards, strategy);

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

      {/* Between the two, because it belongs to both: it is a decision made
          about the figure above and answered by the order of the list below.
          It renders nothing until there are at least two cards to put in an
          order — see the component. */}
      <PayoffStrategy
        cards={cards}
        loading={loading}
        error={cardsError}
        strategy={strategy}
        onChange={setStrategy}
      />

      <CardList
        cards={ordered}
        loading={loading}
        error={cardsError}
        onRetry={retry}
        onCreate={create}
        onUpdate={update}
        onDelete={remove}
      />

      {/* Below the list, because it is the only thing on this page that is not
          a fact. The panels above report what is true — what the debt costs,
          what the cards are, which order to pay them in — and this one asks a
          question about it, which is a thing to do after reading them rather
          than instead of it.

          It takes the strategy but not a setter: the choice is made once, by
          the control above, and a second place to change it would be two
          controls for one preference. The extra payment it does own is state
          of its own — see the component on why that one is not lifted. */}
      <PayoffSimulator
        cards={cards}
        loading={loading}
        error={cardsError}
        strategy={strategy}
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
