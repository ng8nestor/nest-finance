import { useEffect, useRef, useState } from "react";
import {
  formatCurrency,
  formatDate,
  formatPercent,
  formatRatio,
} from "../lib/format.js";
import {
  balanceGrowsFlag,
  cardUtilization,
  isUtilizationHigh,
} from "../lib/finance.js";

// One card in the list: what it holds, and the two things you can do to it.
//
// `rank` and `heat` both come from the parent and neither is computed here.
// The rank is this card's place in the selected payoff order, which only the
// list knows; the heat is where its APR sits among every card's, which only
// the list can compare. Both arrive null when there is nothing to say — too
// few cards for an order, or a rate that cannot be read — and both are simply
// not drawn in that case.
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
// `tone` names what a figure means, and the stylesheet decides what that looks
// like. It is a prop rather than a :first-child rule because which figure is
// money owed is a fact about the data — reordering the list below should not
// silently move the colour onto whatever ends up first.
//
// Two tones are used: "debt" for the balance, which is money owed, and
// "progress" for a utilisation that is within the threshold, which is the one
// thing on a card worth reading as good news. Everything else passes no tone
// and stays in the ordinary text colour. Colouring all six figures would be
// the same as colouring none of them, since nothing would stand out.
function Figure({ label, value, tone }) {
  return (
    <div className="card__figure">
      <dt className="card__figure-label">{label}</dt>
      <dd
        className={
          tone
            ? `card__figure-value card__figure-value--${tone}`
            : "card__figure-value"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function CardItem({ card, rank, heat, restoreFocus, onEdit, onDelete }) {
  // null when the card has no due date, which is the normal state of a card
  // nobody has entered one for. The <Figure> below is skipped entirely in that
  // case: no row, no label, no dash. A placeholder would put an empty promise
  // on screen — a labelled slot implies there is something that belongs in it,
  // and for most cards there simply isn't.
  const dueDate = formatDate(card.due_date);

  // Both from lib/finance.js, both nullable, and neither computed here. The
  // card's share of its credit line, and whether a month's interest on it
  // exceeds the minimum payment.
  const utilization = cardUtilization(card);
  const growing = balanceGrowsFlag(card);

  // Deleting is in two steps, and this is which one we are on.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const keepRef = useRef(null);
  const deleteRef = useRef(null);
  const editRef = useRef(null);

  // Whether the confirmation was open on the previous render, so the effect
  // below can tell "it just closed" from "it has never been open". A ref rather
  // than state: it is read inside an effect to decide what that effect does,
  // and storing it in state would schedule a render for a value nothing draws.
  const wasConfirming = useRef(false);

  // Both directions of the confirmation swap, because both of them replace the
  // button that was focused with a different one.
  //
  // Opening: pressing Delete removes that button from the page and puts the two
  // confirmation buttons where it was, which drops keyboard focus onto the body
  // — leaving anyone not using a mouse with no idea where they are and a
  // question on screen they cannot answer without tabbing from the top.
  //
  // Focus moves to "Keep it", the harmless choice. Never to the confirm button:
  // someone who pressed Delete and then Enter — or Space, still held from
  // activating the first button — would have deleted a card in one gesture
  // without reading the question.
  //
  // Closing: "Keep it" unmounts itself, so focus has to be put back on the
  // Delete button it came from. That is the rule the whole app follows now —
  // a control that dismisses something returns focus to the control that
  // summoned it — and it is what makes backing out of the confirmation cost one
  // keystroke instead of a walk down the page.
  //
  // A failed delete lands here too: the request sets confirming back to false,
  // so focus returns to Delete with the error message announced beside it.
  useEffect(() => {
    if (confirming) {
      keepRef.current?.focus();
    } else if (wasConfirming.current) {
      deleteRef.current?.focus();
    }

    wasConfirming.current = confirming;
  }, [confirming]);

  // Set by the list when this card's edit form closes. The Edit button that
  // opened that form was unmounted along with the whole card, so the focus has
  // to be restored by the card that takes its place — this one, freshly
  // mounted, which is the only thing holding a reference to the new button.
  //
  // See the note in CardList.jsx on why the request is a card id passed down
  // rather than a ref held up there.
  useEffect(() => {
    if (restoreFocus) editRef.current?.focus();
  }, [restoreFocus]);

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
        {/* The payoff rank, and the card's APR read as a temperature.

            Two facts in one badge because they are two halves of one question
            — which card to pay, and how much this one is costing to leave
            alone — and because a card with a rank chip and a separate heat
            swatch would be two decorations competing for the same corner.

            The number is stated in words for anyone not reading the colour,
            and the colour is never the only thing saying anything: the rank is
            a digit, and the rate it shades is printed in full among the
            figures below. Someone who cannot tell the shades apart loses
            nothing but the glance. */}
        {rank !== null && rank !== undefined && (
          <p
            className="card__rank"
            // The heat as a bare number, for the stylesheet to turn into an
            // opacity — the same division of labour the utilisation bar uses
            // for its width. A string rather than a number because React
            // appends "px" to numeric style values for properties it does not
            // recognise as unitless.
            //
            // Left unset when the APR cannot be read, so the rule's own
            // default takes over and the badge draws cold rather than
            // inventing a temperature for a rate nobody knows.
            style={heat === null ? undefined : { "--heat": String(heat) }}
          >
            <span className="card__rank-mark" aria-hidden="true">
              {rank}
            </span>
            <span className="card__rank-label">Number {rank} to pay off</span>
          </p>
        )}

        <div className="card__titles">
          <h3 className="card__name">{card.name}</h3>
          {/* Only rendered when there is one. An empty line under the name would
              reserve space for a fact this card doesn't have. */}
          {card.issuer && <p className="card__issuer">{card.issuer}</p>}
        </div>
      </div>

      {/* The one thing on a card that changes what someone should do rather
          than describing where they are: paying the minimum on this card
          leaves the balance larger than it started.

          A badge on the card rather than a warnings section further down the
          page, because the fact belongs to this card and is meaningless
          without it — a list of alerts elsewhere would make the reader carry
          a card's name from one part of the screen to another to act on it.

          The feedback tokens, not --debt. Every other number on this card is
          a measurement of money owed, which is an ordinary state to be in;
          this is a warning that something is going wrong, which is what
          --danger is for. See the note in tokens.css on why the two are held
          apart even while they share a value. */}
      {growing && (
        <p className="card__flag">
          <strong className="card__flag-mark">Balance growing</strong>
          The minimum payment doesn&rsquo;t cover a month&rsquo;s interest on
          this card, so the balance goes up even when you pay on time.
        </p>
      )}

      <dl className="card__figures">
        <Figure
          label="Balance"
          value={formatCurrency(card.balance)}
          tone="debt"
        />
        {/* apr_pct arrives as the percent it is — 24.99 — and is formatted as
            one. No arithmetic between the column and the screen. */}
        <Figure label="APR" value={formatPercent(card.apr_pct)} />
        <Figure
          label="Credit limit"
          value={formatCurrency(card.credit_limit)}
        />
        {/* Straight after the two figures it is the ratio of, and skipped
            entirely when there is no usable credit limit to divide by — the
            same reasoning as the due date below. A labelled slot implies there
            is something that belongs in it.

            Same colour rule as the overall figure in the summary above, from
            the same function: over 30% is --debt, at or under is --progress.
            Two thresholds that agreed by coincidence would be one bug away
            from disagreeing. */}
        {utilization !== null && (
          <Figure
            label="Utilization"
            value={formatRatio(utilization)}
            tone={isUtilizationHigh(utilization) ? "debt" : "progress"}
          />
        )}
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
              className="button button--secondary button--danger"
              type="button"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              className="button button--secondary"
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
            className="button button--secondary"
            type="button"
            ref={editRef}
            onClick={() => onEdit(card.id)}
          >
            Edit
          </button>
          <button
            className="button button--secondary"
            type="button"
            ref={deleteRef}
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
