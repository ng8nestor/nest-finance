import { useCallback, useEffect, useState } from "react";
import { listCards, createCard, updateCard, deleteCard } from "../lib/cards.js";

// ===========================================================================
// The signed-in user's cards: the request, the three states it can be in
// before it is a list, and the three writes that change it.
//
// ---------------------------------------------------------------------------
// Why this is a hook rather than state inside CardList
//
// It was state inside CardList until the dashboard grew a second thing that
// needs the same rows. The bleed meter and the utilisation bar are computed
// from every card at once, and they sit above the list rather than inside it,
// so the list can no longer be the only component that knows what the cards
// are.
//
// The two obvious ways out are both wrong. Having the summary fetch its own
// copy would mean two requests for the same rows on every dashboard load, two
// loading states that can disagree, and — worse — a stale total sitting above
// a list that has already been edited, because adding a card would update one
// copy and not the other. Passing the summary a prop out of CardList would put
// the section that renders the list in charge of data for a section rendered
// above it, which is the same coupling with a longer name.
//
// So the fetch moves up to the page that owns both, and lives here rather than
// in Dashboard.jsx so that the page stays a layout and this stays testable
// without one.
//
// ---------------------------------------------------------------------------
// Loading, error, empty
//
// Four states, not one, and the distinction is the same one ProtectedRoute
// draws between "don't know yet" and "nobody":
//
//   loading   The request is in flight. We do not know what is there yet.
//   error     The request failed. We still do not know what is there.
//   empty     The request succeeded and the answer is "no cards".
//   list      The request succeeded and there are cards.
//
// `cards.length === 0` cannot tell them apart — it is true before the answer
// arrives, true after a failure, and true for a genuinely empty account, which
// call for a wait, a retry, and an invitation respectively. That is why
// `loading` and `error` are state rather than something inferred, and it is
// why this hook returns all three.
//
// It matters twice over now. The summary above the list must not total an
// empty array into a confident $0.00 a month while the real cards are still in
// flight — a zero bleed is the best possible news, and showing it to someone
// who is about to be shown four figures instead is the one mistake this screen
// cannot afford to make.
// ===========================================================================

export function useCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bumped by retry(), which is all a retry is: ask for the list once more. A
  // counter rather than a boolean so that pressing it twice runs it twice.
  const [attempt, setAttempt] = useState(0);

  // The retry, and the reason `loading` is moved back to true here rather than
  // at the top of the effect below. Setting state synchronously inside an
  // effect makes React render, run the effect, and render again — a cascade
  // the linter rightly objects to. Pressing the button is the event that
  // starts a load, so it is the button that puts the section back into its
  // loading state; the effect is then purely the request.
  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    // StrictMode runs this effect twice in development. `cancelled` stops the
    // first run's in-flight request from writing state after its cleanup — the
    // same guard, for the same reason, as the one in AuthContext.jsx.
    let cancelled = false;

    listCards().then(({ cards: rows, error: message }) => {
      if (cancelled) return;

      // On failure the previous list is deliberately left alone rather than
      // cleared. A retry that fails should not also take away what was already
      // on screen.
      if (message) setError(message);
      else setCards(rows);

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // The three write paths. Each resolves to an error sentence for the
  // component that asked, or null if it worked — the form and the card row own
  // showing that message, since it belongs next to the thing that failed
  // rather than at the top of the section.
  //
  // On success the local list is updated from the row the database returned,
  // instead of re-fetching. The response is the stored row, so the list is
  // already what a re-fetch would produce, and refetching would mean a second
  // round trip and a flash of the loading state over a list that is on screen
  // and correct. The summary recomputes from the same array, so the totals
  // above move in the same render as the row below.
  //
  // useCallback on all four so that the object handed to the page is stable
  // across renders — the count-up in the meter restarts whenever its target
  // changes, and a handler identity changing on every render is the kind of
  // thing that quietly turns into a re-run of everything downstream.

  const create = useCallback(async (fields) => {
    const { card, error: message } = await createCard(fields);
    if (message) return message;

    // Prepended, because listCards() sorts newest first — the new card belongs
    // at the top for the same reason it is sorted that way.
    setCards((current) => [card, ...current]);
    return null;
  }, []);

  const update = useCallback(async (id, fields) => {
    const { card, error: message } = await updateCard(id, fields);
    if (message) return message;

    setCards((current) => current.map((row) => (row.id === id ? card : row)));
    return null;
  }, []);

  const remove = useCallback(async (id) => {
    const { error: message } = await deleteCard(id);
    if (message) return message;

    setCards((current) => current.filter((row) => row.id !== id));
    return null;
  }, []);

  return { cards, loading, error, retry, create, update, remove };
}
