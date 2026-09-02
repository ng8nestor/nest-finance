import { useState } from "react";
import CardForm from "./CardForm.jsx";
import CardItem from "./CardItem.jsx";
import { aprHeat } from "../lib/finance.js";
import { RANKABLE_MINIMUM } from "../lib/payoff.js";
import "./Cards.css";

// ===========================================================================
// The cards section of the dashboard: the list, the form that adds to it, and
// the three states a list fetched over a network can be in before it is a list.
//
// ---------------------------------------------------------------------------
// Where the cards come from
//
// From props, since the dashboard grew a summary above this section that is
// computed from the same rows. The request, the loading and error states, and
// the three writes all live in hooks/useCards.js now, called once by the page —
// see the note there for why one fetch shared beats two components each
// fetching their own.
//
// What stayed here is the state that is genuinely about this section: which
// form is open. The page has no interest in whether a card is being edited, and
// lifting that too would be lifting for its own sake.
//
// ---------------------------------------------------------------------------
// Loading, error, empty
//
// These are four different things and each gets its own screen:
//
//   loading   The request is in flight. We do not know what is there yet.
//   error     The request failed. We still do not know what is there.
//   empty     The request succeeded and the answer is "no cards".
//   list      The request succeeded and there are cards.
//
// The two easy mistakes are collapsing the first three into one blank area, and
// collapsing empty into loading — both of which show a signed-in person a page
// that appears to have lost their data. `cards.length === 0` is meaningless on
// its own: it is the state before the answer arrives, the state after a failure,
// and the state of a genuinely empty account, and those call for a wait, a
// retry, and an invitation respectively. Only `loading` and `error` can tell
// them apart, which is why both are passed in rather than being inferred.
//
// The same distinction ProtectedRoute draws between "don't know yet" and
// "nobody", one layer down.
//
// ---------------------------------------------------------------------------
// The order, and the two things drawn from it
//
// This section does not sort. The array arrives in the order the selected
// payoff strategy puts it in — the page owns that choice because the toggle
// above the list shows it too — so a card's position here *is* its payoff
// rank, and the rank passed to each card is simply where it sits.
//
// That is deliberately not the same thing as its heat. The rank comes from the
// order; the heat comes from the APR, whichever order is selected. Under
// snowball they visibly disagree, and that disagreement is the honest picture:
// the expensive card glowing three rows down is exactly what snowball costs
// you, and hiding it by shading the list top-to-bottom would turn the colour
// into a second copy of the rank rather than a fact about the rate.
// ===========================================================================

function CardList({
  cards,
  loading,
  error,
  onRetry,
  onCreate,
  onUpdate,
  onDelete,
}) {
  // Which form, if any, is open. Only one can be: `adding` for a new card, and
  // `editingId` for the card being edited, which renders in that card's place.
  // Opening either closes the other, so the page never asks for two cards at
  // once with two Save buttons that look alike.
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // The two writes that close a form when they succeed. The write itself
  // belongs to the page — the summary above recomputes from the same array —
  // but "and then put the form away" is this section's business, so it is
  // wrapped here rather than being something useCards() has to know about.
  //
  // Each returns an error sentence for the form that asked, or null if it
  // worked. The form owns showing that message, since it belongs next to the
  // fields that produced it.

  async function handleCreate(fields) {
    const message = await onCreate(fields);
    if (message) return message;

    setAdding(false);
    return null;
  }

  async function handleUpdate(id, fields) {
    const message = await onUpdate(id, fields);
    if (message) return message;

    setEditingId(null);
    return null;
  }

  function startAdding() {
    setEditingId(null);
    setAdding(true);
  }

  function startEditing(id) {
    setAdding(false);
    setEditingId(id);
  }

  return (
    <section className="cards" aria-labelledby="cards-heading">
      <header className="cards__header">
        <h2 className="cards__heading" id="cards-heading">
          Your cards
        </h2>

        {/* The header's Add button appears only once there is a list to add to.
            With no cards the invitation below is the way in, and two buttons
            offering the same thing on an otherwise empty screen is one too
            many. It also goes away while the form is open, since the form is
            the thing it opens. */}
        {!loading && !error && cards.length > 0 && !adding && (
          <button className="cards__add" type="button" onClick={startAdding}>
            Add a card
          </button>
        )}
      </header>

      {/* Said in words, not spun as an animation. aria-busy tells assistive
          technology the region is still filling in, so the wait is announced
          rather than being a silent stretch of nothing. */}
      {loading && (
        <p className="cards__status" aria-busy="true">
          Loading your cards…
        </p>
      )}

      {error && (
        <div className="cards__error" role="alert">
          <p>{error}</p>
          {/* A dead end is what makes an error page feel broken. The failure
              here is usually momentary — a dropped connection, a slow
              round trip — so the fix is one button, not a page reload. */}
          <button className="cards__retry" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {adding && (
        <CardForm onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      )}

      {/* The empty state. Not an apology, and not "no records found" — there is
          nothing wrong here. Someone has just signed up and has not told us
          anything yet, so the screen says what to do first and what it gets
          them. */}
      {!loading && !error && cards.length === 0 && !adding && (
        <div className="cards__empty">
          <p className="cards__empty-title">Start with one card.</p>
          <p className="cards__empty-body">
            Add the balance, the APR and the minimum payment, and{" "}
            {/* Kept concrete about the next step rather than promising
                features that are not built yet. */}
            everything you owe on it stays in one place.
          </p>
          <button
            className="cards__empty-action"
            type="button"
            onClick={startAdding}
          >
            Add your first card
          </button>
        </div>
      )}

      {!loading && cards.length > 0 && (
        <ul className="cards__list">
          {cards.map((card, index) =>
            // The edit form takes the card's place in the list rather than
            // opening above or below it, so the thing being edited stays where
            // the eye left it.
            card.id === editingId ? (
              <li className="cards__editing" key={card.id}>
                <CardForm
                  card={card}
                  onSubmit={(fields) => handleUpdate(card.id, fields)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <CardItem
                key={card.id}
                card={card}
                // Position in the list, one-based, and null when there are too
                // few cards for an order to mean anything — the same threshold
                // that decides whether the toggle above is on screen at all,
                // from the same constant, so a card can never be numbered by a
                // control the reader cannot see.
                rank={cards.length < RANKABLE_MINIMUM ? null : index + 1}
                // Computed against the whole list rather than passed down from
                // the page, because it is a fact about this card among these
                // cards. lib/finance.js does the arithmetic; this hands it the
                // set to compare against.
                heat={aprHeat(card, cards)}
                onEdit={startEditing}
                onDelete={onDelete}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

export default CardList;
