import { useCards } from "../hooks/useCards.js";
import DebtCommandCenter from "../components/DebtCommandCenter.jsx";
import PayoffStrategy from "../components/PayoffStrategy.jsx";
import CardList from "../components/CardList.jsx";
import PayoffSimulator from "../components/PayoffSimulator.jsx";
import { usePayoffStrategy } from "../hooks/usePayoffStrategy.js";
import { orderCards } from "../lib/payoff.js";
import "./Dashboard.css";

// The page at "/dashboard", rendered only inside <ProtectedRoute>.
//
// It no longer touches the auth context at all. The two things that needed it —
// the address you are signed in as and the way to sign out — now live in the
// persistent header, where they are reachable from every screen rather than
// from the bottom of this one. What is left here is the debt: a figure, a
// choice, a list, and a question about them, in that order.
function Dashboard() {
  // One request, two readers. The summary and the list are computed from the
  // same array in the same render, so the total above can never describe a set
  // of cards different from the one below it — see hooks/useCards.js for why
  // that is worth lifting the fetch out of CardList for.
  //
  // `error` is still renamed on the way out even though the sign-out failure it
  // used to share this page with has moved up to the header. The name says what
  // the failure was about rather than that it is the only one here, which is
  // what keeps it right if a second one ever arrives.
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

  return (
    <main className="dashboard">
      {/* The page's own title, not the cards' — the section below names itself,
          and two headings both reading "Your cards" would be one heading and an
          echo.

          No wordmark above it any more. The persistent header carries the mark
          on every screen now, and a second one here would be the same brand
          twice in the top two hundred pixels of the page. */}
      <h1 className="dashboard__title">Dashboard</h1>

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
    </main>
  );
}

export default Dashboard;
