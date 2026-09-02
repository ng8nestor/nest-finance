import { AVALANCHE, RANKABLE_MINIMUM, SNOWBALL } from "../lib/payoff.js";
import "./PayoffStrategy.css";

// ===========================================================================
// The payoff order control, between the summary and the list.
//
// It sits there because it is neither: the panel above says what the debt
// costs, the list below is the debt, and this is the one decision on the
// screen — which of them to pay first. Putting it above the summary would make
// a sorting preference the first thing on a page whose first thing is a
// number; putting it inside the list header would make it look like a filter.
//
// ---------------------------------------------------------------------------
// Radios, not buttons
//
// Two <input type="radio"> in a <fieldset> with a <legend>, styled to look
// like a segmented control. The markup is doing work that would otherwise have
// to be rebuilt by hand: the group is announced with its legend, the selected
// option is announced as selected, arrow keys move between the two, and the
// pair takes one tab stop rather than two. A pair of <button>s would look
// identical and would say nothing about being a choice — the state would live
// only in a class name, which is to say only for people who can see it.
//
// The inputs themselves are hidden and their labels carry the styling. That is
// a visual technique, not a semantic one: the radios are still there, still
// focusable, still what the browser and any assistive technology are reading.
// See the note in PayoffStrategy.css on where the focus ring goes, which is
// the one thing this technique breaks if you let it.
// ===========================================================================

// The two options, in the order they are offered. Avalanche first because it
// is the default and the cheaper one; a control whose first option is not its
// default reads as though something has already been changed.
//
// The gloss under each name is what the sort actually does. "Avalanche" and
// "Snowball" are the names these methods have, not descriptions of them —
// nobody arrives knowing which one is which, and a control that requires you
// to already know the jargon to use it is a control for people who do not need
// it.
const OPTIONS = [
  { id: AVALANCHE, name: "Avalanche", gloss: "Highest rate first" },
  { id: SNOWBALL, name: "Snowball", gloss: "Smallest balance first" },
];

function PayoffStrategy({ cards, loading, error, strategy, onChange }) {
  // Nothing to order, or nothing to order yet. The list below already says
  // which of those it is — it is loading, it failed, or it is empty with an
  // invitation — and a sort control floating above any of those three messages
  // would be offering to arrange something that is not there.
  //
  // The same silence covers a single card: see RANKABLE_MINIMUM in
  // lib/payoff.js for why one card has no payoff order.
  if (loading || error || cards.length < RANKABLE_MINIMUM) return null;

  return (
    <section className="payoff">
      <fieldset className="payoff__choice">
        <legend className="payoff__legend">Pay them off by</legend>

        <div className="payoff__options">
          {OPTIONS.map((option) => (
            <label className="payoff__option" key={option.id}>
              {/* Controlled: `checked` comes from the strategy the page is
                  holding, so the radio and the order of the list below it are
                  the same fact rather than two that have to be kept in step.
                  onChange fires only for the option being turned on, which is
                  why there is nothing here handling the one being turned
                  off. */}
              <input
                className="payoff__input"
                type="radio"
                name="payoff-strategy"
                value={option.id}
                checked={strategy === option.id}
                onChange={() => onChange(option.id)}
              />
              <span className="payoff__pill">
                <span className="payoff__name">{option.name}</span>
                <span className="payoff__gloss">{option.gloss}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* One sentence, and it does not change with the selection.
          
          The temptation is to explain the chosen option — which would mean
          telling someone who picked snowball that they are paying more, every
          time they look at their own dashboard. The tradeoff is what is worth
          saying, and it is worth saying once: both orders pay the debt off,
          neither is a mistake, and the difference between them is a real one
          about which kind of progress keeps a person going.
          
          Written the way it would be said out loud. No "total interest paid",
          no "psychological", no numbers — someone reading this has already
          seen the biggest number they are going to see today, directly
          above. */}
      <p className="payoff__tradeoff">
        Avalanche costs you less in interest overall, while snowball clears
        whole cards sooner &mdash; so it comes down to whether you need the
        cheaper path or the one that feels like it&rsquo;s working.
      </p>
    </section>
  );
}

export default PayoffStrategy;
