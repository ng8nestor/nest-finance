import {
  totalMonthlyBleed,
  annualBleed,
  overallUtilization,
  isUtilizationHigh,
  UTILIZATION_THRESHOLD,
} from "../lib/finance.js";
import { formatCurrency, formatRatio } from "../lib/format.js";
import { useCountUp } from "../hooks/useCountUp.js";
import "./DebtCommandCenter.css";

// ===========================================================================
// The dashboard's summary, above the list of cards.
//
// Two figures, in a deliberate order of weight. The monthly interest is the
// focal element of the whole screen — the largest thing on it, in the debt
// colour, counting up as the page loads. The utilisation bar sits underneath
// at a fraction of the size. Everything else on the dashboard is smaller than
// both.
//
// That ranking is the design. A dashboard that gives six numbers equal
// prominence is six numbers nobody reads; this one answers a single question
// first — what is this costing me — and offers the rest as context for it.
// Interest is the right question to lead with because it is the figure a
// statement never states. A statement shows a balance, a minimum, and a due
// date, and the cost of waiting is spread invisibly across all three.
//
// ---------------------------------------------------------------------------
// No arithmetic here
//
// Every number on screen comes out of lib/finance.js and goes straight into a
// formatter from lib/format.js. This component decides what to show and how
// prominently; it never decides what a figure is. The two places that look
// like exceptions are not:
//
//   The bar's width is set through a CSS custom property holding the raw
//   ratio, and the multiplication into a percentage happens in a calc() in the
//   stylesheet. That is a unit conversion at the point of drawing, not a
//   calculation — see the note in DebtCommandCenter.css.
//
//   The count-up interpolates toward the total each frame, in
//   hooks/useCountUp.js. That is animation timing, not finance; the number it
//   counts to is the one finance.js produced.
// ===========================================================================

// The three states this section can be in, before it is a summary, are the
// same three the list below it has — and each one is answered differently
// here.
function DebtCommandCenter({ cards, loading, error }) {
  const monthly = totalMonthlyBleed(cards);
  const annual = annualBleed(cards);
  const utilization = overallUtilization(cards);

  // The count-up writes into the element this ref lands on. Called before any
  // of the early returns below it, because a hook has to run on every render or
  // React loses track of which call is which; it does nothing for the null it
  // receives while the cards are loading, and nothing for a ref that is not
  // attached to anything in the branches that return early.
  //
  // formatCurrency is passed rather than called: the hook formats each frame's
  // figure itself, and it can only be trusted not to restart the count because
  // that function is defined once at module scope in lib/format.js.
  const countingRef = useCountUp(monthly, formatCurrency);

  // A failed request is reported once, by the list below, next to the button
  // that retries it. Repeating the message here would be the same failure
  // stated twice on one screen, and a summary of numbers we do not have is not
  // a thing to render at all.
  if (error) return null;

  // Not a spinner and not an empty box: a line of text the same shape as the
  // panel that replaces it, so the page below does not jump when the figures
  // arrive. This is also why the summary is not simply hidden while loading —
  // it is the tallest element on the screen, and appearing late would push the
  // entire dashboard down under the reader's eye.
  if (loading) {
    return (
      <section
        className="command-center command-center--quiet"
        aria-busy="true"
      >
        <p className="command-center__status">
          Adding up what your debt costs…
        </p>
      </section>
    );
  }

  // Nobody's first dashboard should open on a wall of zeros. "$0.00 a month"
  // is arithmetically correct for an account with no cards and reads as a
  // finished answer — the best possible one — rather than as a screen waiting
  // to be filled in. An invitation says the same thing honestly.
  //
  // No button on it, deliberately. The list immediately below is already
  // offering "Add your first card", and two buttons doing one thing on an
  // otherwise empty screen is one too many — the same call CardList makes
  // about its own header button.
  if (cards.length === 0) {
    return (
      <section className="command-center command-center--quiet">
        <p className="command-center__invitation">
          Add a card and this is where you&rsquo;ll see what it costs you every
          month.
        </p>
      </section>
    );
  }

  const high = isUtilizationHigh(utilization);

  return (
    <section className="command-center" aria-labelledby="bleed-heading">
      {/* Plain language, and money leaving rather than a metric. "Monthly
          interest" is what this is; "leaving your pocket every month" is what
          it means, and the second one is the sentence someone acts on. */}
      <h2 className="command-center__label" id="bleed-heading">
        Leaving your pocket every month
      </h2>

      <p className="command-center__bleed">
        {/* The animated digits are hidden from assistive technology and the
            settled figure is exposed instead. A screen reader has no way to
            watch a number climb — it would either announce the value at
            whatever instant it was asked, which is a figure that was true for
            one frame, or, in a live region, read seventy of them. The count is
            a visual argument; the fact is the total.

            The animated span renders empty and is filled by the hook before
            the browser paints, so there is no frame in which it is blank —
            see hooks/useCountUp.js on why that is a layout effect. */}
        <span ref={countingRef} aria-hidden="true" />
        <span className="command-center__settled">
          {formatCurrency(monthly)}
        </span>
      </p>

      {/* Only the amount is in the mono face. The rule this app holds to is
          that digits go in DM Mono so they line up, and prose never does — a
          whole sentence set in it reads as a code sample, and the figure stops
          standing out from the words around it precisely because they now
          share its texture. */}
      <p className="command-center__annual">
        <span className="command-center__annual-amount">
          {formatCurrency(annual)}
        </span>{" "}
        over the next year, if the balances stay where they are
      </p>

      {/* The clarification that makes the number mean something. Someone
          seeing a figure this size next to their cards could reasonably read
          it as what they pay each month; it is what they pay for nothing. */}
      <p className="command-center__note">
        Interest only. None of it reduces what you owe.
      </p>

      <div className="usage">
        <div className="usage__header">
          <h3 className="usage__label">Credit used</h3>
          <p
            className={
              high ? "usage__value usage__value--high" : "usage__value"
            }
          >
            {formatRatio(utilization)}
          </p>
        </div>

        {/* Skipped entirely when there is no ratio to draw, rather than drawn
            empty. An unfilled bar is a claim — that utilisation is zero — and
            null means we could not work it out. */}
        {utilization !== null && (
          <div
            className="usage__meter"
            // The raw ratio, handed to CSS as a number. Strings rather than
            // numbers because React appends "px" to numeric style values for
            // properties it does not recognise as unitless, and "0.42px" is
            // not a ratio.
            style={{
              "--fill": String(utilization),
              "--threshold": String(UTILIZATION_THRESHOLD),
            }}
            // The percentage is already on screen as text directly above, and
            // the threshold is stated in words directly below. The bar adds
            // nothing an assistive technology cannot already read, so it is
            // decoration here rather than content — announcing it would be the
            // same figure a third time.
            aria-hidden="true"
          >
            <div className="usage__track">
              <div
                className={
                  high ? "usage__fill usage__fill--high" : "usage__fill"
                }
              />
            </div>
            <div className="usage__threshold" />
          </div>
        )}

        {/* The threshold written out of the same constant the bar is drawn
            from, so the mark on the bar and the number in the sentence cannot
            drift apart. */}
        <p className="usage__scale">
          Keeping this at or below {formatRatio(UTILIZATION_THRESHOLD)} of your
          total credit line is what lenders look for.
        </p>
      </div>
    </section>
  );
}

export default DebtCommandCenter;
