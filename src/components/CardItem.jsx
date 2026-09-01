import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatDate, formatPercent } from "../lib/format.js";

// One card in the list: what it holds, and the two things you can do to it.
//
// Editing is not handled here. The parent swaps this component out for a
// <CardForm> when a card is being edited, so there is one form on the page at a
// time and this component stays what it looks like — a card being displayed.
// Deleting is handled here, because the confirmation is part of the row.

// A label above its number.
//
// <dl> rather than a stack of divs: a description list is exactly what this is —
// terms and the values belonging to them — and it means a screen reader reads
// "Balance, one thousand two hundred fifty dollars and forty cents" instead of
// two unrelated strings that happen to sit near each other.
//
// The mono face is on the value only. Digits in DM Mono are all one width, so
// the figures line up down the column no matter what they are; running the
// labels through it too would just make the words worse.
//
// `debt` marks the one figure on a card that is money owed. It is a prop rather
// than a :first-child rule in the stylesheet because which figure that is, is a
// fact about the data — reordering the list below should not silently move the
// colour onto whatever ends up first.
function Figure({ label, value, debt }) {
  return (
    <div className="card__figure">
      <dt className="card__figure-label">{label}</dt>
      <dd
        className={
          debt
            ? "card__figure-value card__figure-value--debt"
            : "card__figure-value"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CardItem({ card, onEdit, onDelete }) {
  // null when the card has no due date, which is the normal state of a card
  // nobody has entered one for. The <Figure> below is skipped entirely in that
  // case: no row, no label, no dash. A placeholder would put an empty promise
  // on screen — a labelled slot implies there is something that belongs in it,
  // and for most cards there simply isn't.
  const dueDate = formatDate(card.due_date);

  // Deleting is in two steps, and this is which one we are on.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const keepRef = useRef(null);

  // Pressing Delete removes that button from the page and puts the two
  // confirmation buttons where it was — which drops keyboard focus onto the
  // body, leaving anyone not using a mouse with no idea where they are and a
  // question on screen they cannot answer without tabbing from the top.
  //
  // Focus moves to "Keep it", the harmless choice. Never to the confirm button:
  // someone who pressed Delete and then Enter — or Space, still held from
  // activating the first button — would have deleted a card in one gesture
  // without reading the question.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const message = await onDelete(card.id);

    if (message) {
      setError(message);
      setDeleting(false);
      setConfirming(false);
      return;
    }

    // Nothing on success: the card is gone from the parent's list, so this
    // component is unmounted before any state set here could be read.
  }

  return (
    <li className="card">
      <div className="card__heading">
        <h3 className="card__name">{card.name}</h3>
        {/* Only rendered when there is one. An empty line under the name would
            reserve space for a fact this card doesn't have. */}
        {card.issuer && <p className="card__issuer">{card.issuer}</p>}
      </div>

      <dl className="card__figures">
        <Figure label="Balance" value={formatCurrency(card.balance)} debt />
        {/* apr_pct arrives as the percent it is — 24.99 — and is formatted as
            one. No arithmetic between the column and the screen. */}
        <Figure label="APR" value={formatPercent(card.apr_pct)} />
        <Figure
          label="Credit limit"
          value={formatCurrency(card.credit_limit)}
        />
        <Figure label="Minimum due" value={formatCurrency(card.min_due)} />
        {/* Last, and next to the minimum payment it belongs with. Formatted by
            Intl and pinned to UTC — see lib/format.js for why a date column read
            through new Date() otherwise shows the day before. */}
        {dueDate && <Figure label="Due date" value={dueDate} />}
      </dl>

      {error && (
        <p className="card__error" role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <div className="card__confirm">
          <p className="card__confirm-question">
            {/* The card is named in the question. A bare "Are you sure?" asks
                about whichever row the pointer happened to be over; naming it
                is what makes the answer an informed one. */}
            Delete {card.name}? This can&rsquo;t be undone.
          </p>
          <div className="card__actions">
            <button
              className="card__action card__action--danger"
              type="button"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              className="card__action"
              type="button"
              ref={keepRef}
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <div className="card__actions">
          <button
            className="card__action"
            type="button"
            onClick={() => onEdit(card.id)}
          >
            Edit
          </button>
          <button
            className="card__action"
            type="button"
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

export default CardItem;
