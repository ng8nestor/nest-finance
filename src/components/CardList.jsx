import { useEffect, useState } from "react";
import { listCards, createCard, updateCard, deleteCard } from "../lib/cards.js";
import CardForm from "./CardForm.jsx";
import CardItem from "./CardItem.jsx";
import "./Cards.css";

// ===========================================================================
// The cards section of the dashboard: the list, the form that adds to it, and
// the three states a list fetched over a network can be in before it is a list.
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
// them apart, which is why both exist as state rather than being inferred.
//
// The same distinction ProtectedRoute draws between "don't know yet" and
// "nobody", one layer down.
// ===========================================================================

function CardList() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Bumped by "Try again", which is all a retry is: ask for the list once more.
  // A counter rather than a boolean so that pressing it twice runs it twice.
  const [attempt, setAttempt] = useState(0);

  // The retry, and the reason `loading` is moved back to true here rather than
  // at the top of the effect below. Setting state synchronously inside an effect
  // makes React render, run the effect, and render again — a cascade the linter
  // rightly objects to. Pressing the button is the event that starts a load, so
  // it is the button that puts the section back into its loading state; the
  // effect is then purely the request.
  function retry() {
    setLoading(true);
    setLoadError(null);
    setAttempt((n) => n + 1);
  }

  // Which form, if any, is open. Only one can be: `adding` for a new card, and
  // `editingId` for the card being edited, which renders in that card's place.
  // Opening either closes the other, so the page never asks for two cards at
  // once with two Save buttons that look alike.
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    // StrictMode runs this effect twice in development. `cancelled` stops the
    // first run's in-flight request from writing state after its cleanup — the
    // same guard, for the same reason, as the one in AuthContext.jsx.
    let cancelled = false;

    listCards().then(({ cards: rows, error }) => {
      if (cancelled) return;

      // On failure the previous list is deliberately left alone rather than
      // cleared. A retry that fails should not also take away what was already
      // on screen.
      if (error) setLoadError(error);
      else setCards(rows);

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // The three write paths. Each resolves to an error sentence for the component
  // that asked, or null if it worked — the form and the card row own showing
  // that message, since it belongs next to the thing that failed rather than at
  // the top of the section.
  //
  // On success the local list is updated from the row the database returned,
  // instead of re-fetching. The response is the stored row, so the list is
  // already what a re-fetch would produce, and refetching would mean a second
  // round trip and a flash of the loading state over a list that is on screen
  // and correct.

  async function handleCreate(fields) {
    const { card, error } = await createCard(fields);
    if (error) return error;

    // Prepended, because listCards() sorts newest first — the new card belongs
    // at the top for the same reason it is sorted that way.
    setCards((current) => [card, ...current]);
    setAdding(false);
    return null;
  }

  async function handleUpdate(id, fields) {
    const { card, error } = await updateCard(id, fields);
    if (error) return error;

    setCards((current) => current.map((row) => (row.id === id ? card : row)));
    setEditingId(null);
    return null;
  }

  async function handleDelete(id) {
    const { error } = await deleteCard(id);
    if (error) return error;

    setCards((current) => current.filter((row) => row.id !== id));
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
        {!loading && !loadError && cards.length > 0 && !adding && (
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

      {loadError && (
        <div className="cards__error" role="alert">
          <p>{loadError}</p>
          {/* A dead end is what makes an error page feel broken. The failure
              here is usually momentary — a dropped connection, a slow
              round trip — so the fix is one button, not a page reload. */}
          <button className="cards__retry" type="button" onClick={retry}>
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
      {!loading && !loadError && cards.length === 0 && !adding && (
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
          {cards.map((card) =>
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
                onEdit={startEditing}
                onDelete={handleDelete}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

export default CardList;
