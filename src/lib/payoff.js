import { avalancheOrder, snowballOrder } from "./finance.js";

// ===========================================================================
// Which payoff order is selected, as a value the whole app agrees on.
//
// Three things need to know that there are exactly two strategies: the toggle
// that offers them, the hook that stores the choice in localStorage, and the
// page that sorts the list by it. Left to themselves each would grow its own
// copy of the pair — a string in a radio's value, a different string in a
// stored key, a third in an if-statement — and the day a third strategy
// arrives, or one is renamed, two of the three would be updated. Hence one
// module: the ids, the guard, and the mapping from an id to the sort.
//
// The labels are not here. "Avalanche" and "Snowball" are words on a button,
// and words on a button belong to the component that draws it — the same split
// lib/finance.js and lib/format.js keep between a number and its rendering.
// ===========================================================================

export const AVALANCHE = "avalanche";
export const SNOWBALL = "snowball";

// Highest interest rate first. The default because it is the one that costs
// less, and a default that quietly costs someone money is not a neutral
// choice — the toggle beside it makes the other order one click away for
// anyone who wants it.
export const DEFAULT_STRATEGY = AVALANCHE;

// How many cards it takes before an order is a thing worth showing.
//
// Two. One card has no payoff order — a rank of "1" on the only card someone
// owns states nothing, and a control offering two ways to sort a list of one
// is a question with one answer. Exported rather than written as a bare 2 in
// both the toggle and the list for the same reason UTILIZATION_THRESHOLD is
// exported from lib/finance.js: the rule is one rule, and the two places that
// apply it have to agree or the ranks appear without the control that explains
// them.
export const RANKABLE_MINIMUM = 2;

// Whether a value is one of the two strategies.
//
// The guard exists because one of the callers reads from localStorage, which
// is a string store anyone can edit and which outlives every version of this
// app. Whatever comes back from it is untrusted input — a value from a build
// six months ago, a hand-typed experiment, or null on a browser that has never
// seen this app — and the only safe reading of "not one of the two" is to fall
// back to the default rather than to sort by a strategy that does not exist.
export function isStrategy(value) {
  return value === AVALANCHE || value === SNOWBALL;
}

// The cards in the selected order.
//
// Avalanche is the else branch rather than a lookup with a default, so an
// unrecognised strategy sorts by the cheaper order instead of throwing or
// returning the list untouched. There is no state in which this screen should
// render an unordered list under a heading that promises an order.
export function orderCards(cards, strategy) {
  return strategy === SNOWBALL ? snowballOrder(cards) : avalancheOrder(cards);
}
