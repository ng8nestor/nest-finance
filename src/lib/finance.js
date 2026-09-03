// ===========================================================================
// The arithmetic of carrying a balance. Numbers in, numbers out.
//
// Nothing here imports React, Supabase, or a formatter, and nothing here
// returns a string. Every function takes a card row (or a list of them) and
// returns a number, a boolean, or null. That constraint is the point of the
// file rather than a stylistic preference:
//
//   The sums are testable without a browser. A function that reads state or
//   builds JSX can only be checked by rendering something; a function that
//   maps numbers to numbers can be checked by calling it.
//
//   There is one copy of each formula. The monthly interest on a card is
//   computed in exactly one place, so the figure in the bleed meter and the
//   figure behind a card's warning badge cannot disagree — they are the same
//   call. Arithmetic written inline in a component is arithmetic that will be
//   written again, slightly differently, in the next component that needs it.
//
//   Presentation stays out of the numbers. These functions do not decide that
//   an unknown utilisation shows as an em dash or that a zero total should be
//   hidden behind an invitation; they say "null" and let the screen decide.
//   See lib/format.js for the other half of that split.
//
// ---------------------------------------------------------------------------
// Units, and the one division by 100
//
// The columns are dollars — balance, credit_limit, min_due — except apr_pct,
// which is a percent written the way it is spoken: 24.99 means 24.99%. That is
// the representation everywhere in this codebase, from the column through
// lib/cards.js to the field in the form.
//
// Interest, though, has to be computed from the fraction. The conversion
// happens once, in monthlyInterest below, and nowhere else — not in a
// component, not in the formatter (lib/format.js formats 24.99 as "24.99%"
// with no arithmetic at all, and formats a ratio with style:"percent", which
// takes the fraction form as given). One conversion means one place where the
// two representations meet, instead of every screen having to know which of
// the two it is holding.
//
// ---------------------------------------------------------------------------
// Why every function can return null
//
// Division is the reason. balance / credit_limit is a fine formula right up
// until the limit is 0, at which point JavaScript hands back Infinity, or NaN
// if the balance is 0 too — and both of those propagate. Infinity survives a
// sum, formats as "$∞", and compares as greater than any threshold, so a
// single bad row turns into a page of confident nonsense. NaN is quieter and
// worse: it fails every comparison, so `utilisation > 0.3` is false for it and
// a card silently reads as healthy.
//
// So no division here runs without first checking its denominator, and every
// function that cannot answer returns null. null is not a number, does not
// survive arithmetic unnoticed, and is the one value a caller cannot mistake
// for a result.
//
// The column constraints in docs/schema.sql make most of this unreachable:
// balance, apr_pct, credit_limit and min_due are all NOT NULL, and
// credit_limit carries `check (credit_limit > 0)`. The guards are here anyway,
// because "the database will not allow it" is a claim about the database, and
// this file is also handed rows straight out of a form, out of a test, and out
// of whatever the next feature builds.
// ===========================================================================

// The percent-to-fraction conversion named once, so the 100 below reads as a
// unit change rather than a magic number. See the note above: this is the only
// division by 100 in the codebase.
const PERCENT_PER_WHOLE = 100;

const MONTHS_PER_YEAR = 12;

// A second, unrelated 100. This one is not a unit conversion between two ways
// of writing a rate; it is the rounding grain of a dollar amount, used by
// toCents below. Naming them separately is what keeps a later edit to one from
// being read as an edit to both.
const CENTS_PER_DOLLAR = 100;

// The share of a credit line that can sit on it before the number is worth
// reacting to. Thirty percent is the figure the scoring models are usually
// described in terms of, and it is exported rather than written as 0.3 in a
// component for the usual reason: the bar's threshold marker, the colour of
// the percentage above it, and the colour of each card's own figure are all
// the same rule, and a rule that exists in three places is three rules.
export const UTILIZATION_THRESHOLD = 0.3;

// A value from a row as a usable number, or null.
//
// Number() rather than trusting the input, for the same reason lib/format.js
// coerces: PostgREST sends numeric columns as JSON numbers, but the same rows
// also arrive from a form, and numeric(12,2) is one driver setting away from
// arriving as a string. Number("1250.40") is 1250.4 and Number("") is 0 — the
// second of which is the trap, so an empty string is rejected before it can
// become a confident zero.
//
// Number.isFinite is doing three jobs at once: it rejects NaN, and it rejects
// both infinities, which is what stops a bad value from entering a sum at all.
function toFinite(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// A dollar amount rounded to the cent.
//
// Money is decimal and binary floating point is not, so 0.1 + 0.2 is
// 0.30000000000000004 and an interest figure comes out of a multiplication
// with a tail of digits that are not really there. Rounding at the point each
// amount becomes an amount keeps that tail from accumulating through the sums
// below — and keeps a total from disagreeing in the last decimal place with
// the figures a person can add up on screen themselves.
function toCents(amount) {
  return Math.round(amount * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR;
}

// What one card costs to hold for a month, in dollars.
//
// The APR is an annual rate, so it is divided by twelve to get the monthly
// one. That is the simple-interest reading of the number, and it is the right
// one here: it answers "what did this month cost me", which is the question
// the meter on the dashboard asks. It is deliberately not a compounding or
// average-daily-balance calculation — those need a statement cycle, a payment
// date, and a transaction history, none of which this app has, and inventing
// them would make the figure less true rather than more precise.
export function monthlyInterest(card) {
  const balance = toFinite(card?.balance);
  const apr = toFinite(card?.apr_pct);

  if (balance === null || apr === null) return null;

  return toCents(balance * (apr / PERCENT_PER_WHOLE / MONTHS_PER_YEAR));
}

// Every card's monthly interest, added up.
//
// An empty list totals 0, not null: nobody owing anything genuinely pays zero
// interest, and that is a real answer rather than a missing one. What the
// dashboard does with a zero — show an invitation instead of a row of noughts
// — is the screen's decision, not this function's.
//
// A card whose interest cannot be computed makes the whole total null, rather
// than being skipped. Skipping is the tempting option because it always
// produces a figure, and that is exactly what is wrong with it: the figure
// would be too low, in the app's most prominent number, with nothing on screen
// saying so. A person would read a smaller bleed than they actually have and
// have no way to know. Refusing to total is a visible gap; quietly totalling
// the rows we happen to like is an invisible lie about money.
export function totalMonthlyBleed(cards) {
  if (!Array.isArray(cards)) return null;

  let total = 0;

  for (const card of cards) {
    const interest = monthlyInterest(card);
    if (interest === null) return null;
    total += interest;
  }

  return toCents(total);
}

// The same figure over a year.
//
// Twelve times the monthly total, and not a re-derivation from the APRs: the
// annual number sits directly under the monthly one on screen, and the two
// have to be the same fact stated twice. Deriving them separately would let
// rounding put them a cent apart, which is small, visible, and impossible to
// explain to someone looking at both at once.
//
// It is a projection, not a forecast — what the next twelve months cost if
// nothing changes. The screen says so in those words rather than presenting it
// as a prediction the app cannot make.
export function annualBleed(cards) {
  const monthly = totalMonthlyBleed(cards);
  if (monthly === null) return null;

  return toCents(monthly * MONTHS_PER_YEAR);
}

// How much of one card's credit line is being used, as a fraction: 0.42 means
// 42%. A fraction rather than a spoken percent because that is what
// Intl.NumberFormat's style:"percent" consumes, so the number reaches the
// screen without anyone multiplying it back up — see formatRatio in
// lib/format.js.
//
// The guard is `limit > 0`, not `limit !== 0`. Written as a not-equal it would
// pass a negative limit through and produce a negative utilisation, which
// renders as "-40%" and compares as comfortably under the threshold. A ratio
// of a balance to a credit line only means anything when there is a credit
// line, so that is what is checked.
//
// Over-limit balances are left alone: a ratio above 1 is a true statement
// about a real situation, and clamping it here would hide it. The bar that
// draws it caps its own fill at the track width, which is a drawing problem,
// solved where the drawing happens.
export function cardUtilization(card) {
  const balance = toFinite(card?.balance);
  const limit = toFinite(card?.credit_limit);

  if (balance === null || limit === null || limit <= 0) return null;

  return balance / limit;
}

// The same ratio across every card: total balances over total credit lines.
//
// Deliberately not the average of the per-card ratios. Those are two different
// numbers and only this one is meaningful — a $50 balance on a $500 card and a
// $9,000 balance on a $10,000 card average to 55%, while the actual share of
// available credit in use is 86%. Averaging a ratio gives every card an equal
// vote regardless of size, which is not how a credit line works.
//
// Null when there are no cards, since the denominator is then 0 — and "no
// utilisation" is the honest answer for someone with no credit lines, not 0%,
// which would read as the healthiest possible position.
export function overallUtilization(cards) {
  if (!Array.isArray(cards)) return null;

  let balances = 0;
  let limits = 0;

  for (const card of cards) {
    const balance = toFinite(card?.balance);
    const limit = toFinite(card?.credit_limit);

    // Same reasoning as the total above: one unusable row makes the answer
    // unknown rather than quietly shifting it.
    if (balance === null || limit === null) return null;

    balances += balance;
    limits += limit;
  }

  if (limits <= 0) return null;

  return balances / limits;
}

// Whether paying only the minimum on this card leaves the balance larger than
// it started.
//
// This is the one calculation in the file that changes what someone should do
// rather than describing where they are. When a month's interest exceeds the
// minimum payment, the card is not being paid down at all: the payment lands,
// the interest is added, and the balance ends the month higher than it began.
// Nothing on a statement says this — the statement shows a payment received —
// which is why it earns a badge on the card rather than a figure among the
// others.
//
// False, not null, when the numbers are unusable. The three states are "the
// balance grows", "it doesn't", and "we can't tell", and only the first is
// worth a warning; folding the third into it would put an alarming red flag on
// a card because of a missing field. An unknown is not a warning.
export function balanceGrowsFlag(card) {
  const interest = monthlyInterest(card);
  const minimum = toFinite(card?.min_due);

  if (interest === null || minimum === null) return false;

  return interest > minimum;
}

// Whether a utilisation ratio is above the threshold — the single rule behind
// every red-or-green decision in the dashboard.
//
// Strictly greater than, so 30% exactly counts as under: the threshold is a
// ceiling to stay at or below, and a figure sitting precisely on it has not
// crossed anything.
//
// null is false rather than an error. A card with no usable credit limit has
// no utilisation to be high, and the screen renders nothing for it at all; a
// caller that asks anyway gets the non-alarming answer.
export function isUtilizationHigh(ratio) {
  if (ratio === null || !Number.isFinite(ratio)) return false;

  return ratio > UTILIZATION_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Payoff order
//
// Two ways to sequence the same debts, and the only two this app offers.
// Avalanche pays the highest interest rate first, which costs the least in
// total interest. Snowball pays the smallest balance first, which clears whole
// cards soonest. Neither is a calculation about money — no figure on screen
// changes when the order does — so nothing below computes anything. They are
// orderings, and they return the cards in one.
//
// Both copy before sorting. Array.prototype.sort mutates in place, and the
// array these are handed is the one hooks/useCards.js is holding in state:
// sorting it directly would rewrite React's own copy behind its back, so the
// summary above the list and the list itself would be reading an array that
// changed without a render. The spread is not a defensive habit here, it is
// the difference between a pure function and a bug.
//
// ---------------------------------------------------------------------------
// Why the tie-breaks go three deep
//
// Two cards at 24.99%, or two at $1,200.00, are a real and ordinary thing —
// people carry cards from the same issuer on the same terms, and round-number
// balances collide. A comparator that returns 0 for them leaves their relative
// order to whatever the input order happened to be, and the input order is a
// fetch away from changing: today it is created_at descending out of
// lib/cards.js, tomorrow it is whatever the next query orders by. The ranks on
// screen would silently swap between one load and the next, on a list whose
// whole purpose is to say which card to pay first.
//
// So each comparator falls through to a second financial key, and then to the
// id — which is unique, so the chain can never reach the end still undecided.
// The second key is chosen to mean something rather than to merely break the
// tie: at equal APRs the larger balance is accruing more, and at equal
// balances the higher APR is costing more. The order stays defensible if
// anyone asks why one of two identical-looking cards is above the other.
// ---------------------------------------------------------------------------

// The two payoff strategies, as the ids the rest of the app passes around.
//
// These moved down here from lib/payoff.js when the simulator arrived, and the
// move is worth a note because the ids read like vocabulary rather than
// arithmetic. The reason is dependency direction: simulatePayoff below has to
// pick a target card each month "by the active strategy", which means this file
// now needs to map an id to one of the two orders directly beneath it. Reaching
// up to payoff.js for the ids would make the two modules import each other —
// and the alternative, writing the literal "snowball" in an if-statement here
// while payoff.js holds the constant, is exactly the drift that having a
// constant was meant to prevent.
//
// So the id lives beside the sort it names, and lib/payoff.js re-exports both.
// Nothing else changed: every component still asks payoff.js what the
// strategies are, because that is still the module that answers questions
// about strategies — which one is the default, how many cards make an order
// worth showing, whether a string off localStorage is one of them.
export const AVALANCHE = "avalanche";
export const SNOWBALL = "snowball";

const ASCENDING = 1;
const DESCENDING = -1;

// One comparison between two values that may be null, in either direction.
//
// Nulls sort last both ways, which is why the direction is applied to the
// difference rather than to the whole result. A card with an unusable APR
// cannot be placed by APR, and the bottom of the list is the honest place for
// it: sorting it to the top under a "pay this first" heading would be an
// instruction derived from a value we do not have. The columns behind these
// are NOT NULL in the schema, so this is the defensive branch — but these
// functions are also handed rows straight out of a form, before any database
// has checked them.
function compareValues(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  return (left - right) * direction;
}

// The last resort, and the reason the order is stable across loads. Ids are
// uuids: arbitrary as an ordering, but unique, which is the only property
// being asked of them here.
function compareIds(left, right) {
  const a = String(left?.id ?? "");
  const b = String(right?.id ?? "");

  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// Highest APR first — the cheapest way out, in total interest paid.
export function avalancheOrder(cards) {
  if (!Array.isArray(cards)) return [];

  return [...cards].sort(
    (a, b) =>
      compareValues(toFinite(a?.apr_pct), toFinite(b?.apr_pct), DESCENDING) ||
      compareValues(toFinite(a?.balance), toFinite(b?.balance), DESCENDING) ||
      compareIds(a, b),
  );
}

// Smallest balance first — the fastest way to have one fewer card.
export function snowballOrder(cards) {
  if (!Array.isArray(cards)) return [];

  return [...cards].sort(
    (a, b) =>
      compareValues(toFinite(a?.balance), toFinite(b?.balance), ASCENDING) ||
      compareValues(toFinite(a?.apr_pct), toFinite(b?.apr_pct), DESCENDING) ||
      compareIds(a, b),
  );
}

// Where one card's APR sits between the lowest and highest in the set, as a
// fraction: 1 is the worst rate someone is carrying, 0 the best of a bad lot.
//
// It exists so the screen can shade a card by how expensive its rate is, and
// it is deliberately relative rather than absolute. There is no such thing as
// a hot APR in the abstract — the honest absolute scale would put 22%, 24% and
// 25% at nearly the same shade, which is true and useless, since the question
// a payoff list answers is "which of mine is worst", not "is this bad by
// national standards". The APR itself is printed on every card for the
// absolute answer.
//
// All-equal rates, and a set of one, come back as 1 rather than 0. With no
// spread there is no cooler card to contrast with, and shading every card down
// to nothing would say these rates are mild when what is actually true is that
// they are all the same.
//
// Unusable rows on other cards are skipped instead of poisoning the result,
// which is the opposite of what totalMonthlyBleed does with them — and for the
// opposite reason. A total that quietly drops rows is a figure someone acts on
// that is wrong by the amount it dropped. This is a shade, it sits beside the
// rate it describes, and one unreadable neighbour is no reason to stop
// colouring the rest.
export function aprHeat(card, cards) {
  const apr = toFinite(card?.apr_pct);

  if (apr === null || !Array.isArray(cards)) return null;

  let lowest = null;
  let highest = null;

  for (const other of cards) {
    const rate = toFinite(other?.apr_pct);
    if (rate === null) continue;

    if (lowest === null || rate < lowest) lowest = rate;
    if (highest === null || rate > highest) highest = rate;
  }

  if (lowest === null || highest === lowest) return 1;

  return (apr - lowest) / (highest - lowest);
}

// ---------------------------------------------------------------------------
// Payoff simulation
//
// Everything above this line describes where someone is standing. This part
// answers the other question — when does it end, and what does getting there
// cost — and it is the only thing in the file that iterates.
//
// It is a simulation rather than a formula, and that is a deliberate choice
// rather than a shortcut not taken. There is a closed-form expression for the
// number of months it takes to clear a *single* balance at a fixed payment,
// and it is genuinely exact. It is also useless here, because the thing being
// modelled is not one balance: it is a set of them, where the payment on each
// depends on which ones are still alive, the target switches the moment a card
// hits zero, and the freed-up minimum from that card lands on the next one.
// Those are discrete events, one per month, and a formula that assumed them
// away would be answering an easier question very precisely.
//
// So the loop below is the specification, not an implementation of one. Each
// month happens the way a month happens.
//
// ---------------------------------------------------------------------------
// Rounding
//
// Every amount is passed through toCents at the moment it becomes an amount —
// after the interest multiplication, after each subtraction, on every running
// total. That is not defensive habit. A payoff runs sixty to four hundred
// iterations, each with a multiplication by a rate like 0.0208333…, and the
// binary-float residue from an unrounded pass compounds across them: totals
// drift into digits that do not exist in dollars, a balance lands on
// 0.0000000001 instead of zero and the card is never cleared, and the loop
// runs to its cap on a debt that was actually paid off. Rounding at each step
// keeps every intermediate value a real dollars-and-cents figure, which is
// also what makes the total interest agree with a column of monthly figures
// someone adds up by hand.
// ---------------------------------------------------------------------------

// The backstop, not the guard.
//
// The real protection against an endless loop is the arithmetic check below —
// it recognises the non-terminating case up front and says so in the result,
// which is a thing the screen can explain to a person. This is the second line
// of defence behind it: if some input gets past that check and still fails to
// converge, the loop stops here rather than hanging the tab.
//
// Fifty years. Far past any real payoff — the slowest plausible one is fifteen
// or twenty — so it can only be reached by a case the guard failed to catch,
// which is exactly when a backstop should fire. Reaching it is reported as a
// debt that does not clear, because from the reader's point of view that is
// what a payoff beyond half a century is.
const MAX_SIMULATED_MONTHS = 600;

// The cards as the loop needs them: mutable working copies, with the monthly
// rate worked out once instead of on every iteration.
//
// Null if any row is unusable, matching totalMonthlyBleed rather than aprHeat.
// The same reasoning applies and applies harder here: a payoff date computed
// from a subset of someone's debt is not a slightly optimistic date, it is a
// date for a different debt, and nothing on screen would say which cards it
// left out.
//
// The keys `id`, `balance` and `apr_pct` are named to match the card rows on
// purpose — avalancheOrder and snowballOrder read exactly those three, so the
// comparators sort these working copies without a translation step, and the
// order the simulation follows is the same order the list on screen is in.
function toSimulationCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return null;

  const debts = [];

  for (const card of cards) {
    const balance = toFinite(card?.balance);
    const apr = toFinite(card?.apr_pct);
    const minimum = toFinite(card?.min_due);

    if (balance === null || apr === null || minimum === null) return null;

    // Negative money is not a state this simulates. The schema forbids all
    // three, so this is the form-and-tests branch — and a negative balance
    // would otherwise "clear" instantly and drag the payoff date backwards.
    if (balance < 0 || apr < 0 || minimum < 0) return null;

    debts.push({
      id: card?.id,
      apr_pct: apr,
      balance: toCents(balance),
      minimum: toCents(minimum),
      // The one division by 100, reached the same way monthlyInterest reaches
      // it. Held as a fraction per month because the loop multiplies by it
      // once per card per month and the conversion is not a per-iteration fact.
      rate: apr / PERCENT_PER_WHOLE / MONTHS_PER_YEAR,
    });
  }

  return debts;
}

// The cards in the order the chosen strategy pays them, over whatever is left.
//
// Avalanche is the else branch, exactly as in orderCards in lib/payoff.js: an
// unrecognised strategy simulates the cheaper order rather than throwing. The
// two functions agree because they are the same decision, and they have to —
// a simulation that paid the cards down in a different order from the list on
// screen would be a projection of a plan nobody is following.
function orderedBy(debts, strategy) {
  return strategy === SNOWBALL ? snowballOrder(debts) : avalancheOrder(debts);
}

// A calendar month, `months` from now, as the first of that month.
//
// The first rather than today's day-of-month, because the simulation has no
// day in it. It counts whole months, so the honest output is a month — and
// formatMonth in lib/format.js renders it as one ("March 2029"). Anchoring to
// the 1st also sidesteps the classic overflow: January 31st plus one month is
// March 3rd in JavaScript, which would be a payoff date in the wrong month.
//
// Local parts in, UTC date out. getFullYear/getMonth read the month the person
// is actually living in, and Date.UTC pins the result to midnight UTC so the
// formatter — which is fixed to UTC, see the note in lib/format.js — prints
// back the same month it was given, in every timezone.
function monthsFromNow(today, months) {
  const start = today instanceof Date ? today : new Date(today);
  if (Number.isNaN(start.getTime())) return null;

  return new Date(Date.UTC(start.getFullYear(), start.getMonth() + months, 1));
}

// The result for a debt that never clears.
//
// A shape, not a null and not a throw. Null is already this file's word for
// "we could not work it out", and this is the opposite of that: it is a
// definite, computed finding — the payments do not cover the interest — and it
// is the single most important thing the simulator can tell someone. It comes
// back as a result with `clears: false` so the screen can say it in words.
//
// Every figure alongside it is null rather than 0 or Infinity. There is no
// payoff date, so there is no date; the total interest is unbounded, so it is
// not a number. `balances` is empty for the same reason: charting the balance
// climbing would need a horizon to stop at, and any horizon this file picked
// would be an invention. The line simply is not drawn, and the sentence
// explains why — see components/PayoffSimulator.jsx.
function neverClears() {
  return {
    clears: false,
    months: null,
    totalInterest: null,
    payoffDate: null,
    balances: [],
  };
}

// Sum a field across the working cards, to the cent.
function totalOf(debts, read) {
  let total = 0;
  for (const debt of debts) total += read(debt);
  return toCents(total);
}

// Paying this debt down, month by month, at this extra payment, in this order.
//
// Returns null when the cards cannot be simulated at all — an unusable row, an
// empty list, a negative extra payment — keeping the file's one meaning for
// null. Everything else comes back as a result object:
//
//   clears        whether the debt is ever paid off at all
//   months        whole months until the last balance hits zero
//   totalInterest every cent of interest paid on the way there
//   payoffDate    the month that lands in, as a Date
//   balances      the total owed at the end of each month, for the chart —
//                 index 0 is today, so its length is months + 1
//
// `today` is a parameter with a default rather than a call to new Date() in
// the body, which is what keeps this function pure in the sense the rest of
// the file is: called with a date it is deterministic and testable, and the
// default is a convenience for the screen, which always means now.
export function simulatePayoff(
  cards,
  extraPayment,
  strategy,
  today = new Date(),
) {
  const debts = toSimulationCards(cards);
  if (debts === null) return null;

  const extra = toFinite(extraPayment);
  if (extra === null || extra < 0) return null;

  const monthlyExtra = toCents(extra);

  // Owed right now. This is index 0 of the chart series — the point every line
  // starts from — and the value the terminating check is made against.
  let owed = totalOf(debts, (debt) => debt.balance);
  const balances = [owed];

  // Nothing owed is not a degenerate case to reject: it is a debt that is
  // already paid, and zero months is the true answer. Returning early also
  // keeps it away from the guard below, which would otherwise read "no
  // payments, no interest" as a debt that never clears.
  if (owed === 0) {
    return {
      clears: true,
      months: 0,
      totalInterest: 0,
      payoffDate: monthsFromNow(today, 0),
      balances,
    };
  }

  // ---------------------------------------------------------------------
  // The guard: does this debt clear at all?
  //
  // Every month, the same amount goes out — the sum of every minimum, plus
  // the extra. That total does not fall as cards are cleared, because a
  // cleared card's minimum is not saved, it is rolled onto the next card
  // (step 3 in the loop). So the payment is a constant, and the question is
  // only whether it beats the interest.
  //
  // If it does not, the balance ends every month higher than it started, next
  // month's interest is therefore larger, and the gap widens forever. No cap
  // and no amount of patience changes that, which is why this is checked
  // before the loop rather than discovered by it.
  //
  // If it does, termination is guaranteed: the balance strictly falls, so
  // interest falls with it, so the margin between payment and interest only
  // grows. The loop below cannot fail to end.
  //
  // Strictly greater, so a payment exactly equal to the interest counts as
  // never clearing — because it is. The balance would sit unchanged forever.
  // ---------------------------------------------------------------------
  const committed = toCents(
    totalOf(debts, (debt) => debt.minimum) + monthlyExtra,
  );
  const firstInterest = totalOf(debts, (debt) =>
    toCents(debt.balance * debt.rate),
  );

  if (committed <= firstInterest) return neverClears();

  let months = 0;
  let totalInterest = 0;

  // One pass per month, until nothing is owed. `owed` is recomputed from the
  // cards at the end of each pass, so the condition is reading the same total
  // the chart is drawn from rather than a separate tally that could disagree.
  while (owed > 0 && months < MAX_SIMULATED_MONTHS) {
    months += 1;

    // -- 1. Interest, before anything is paid ----------------------------
    // Interest first, because that is the order it happens in: the month's
    // charge lands on the balance and the payment arrives against the total
    // that includes it. Paying first and charging interest on the remainder
    // would quietly understate every figure this function returns.
    for (const debt of debts) {
      if (debt.balance <= 0) continue;

      const interest = toCents(debt.balance * debt.rate);
      debt.balance = toCents(debt.balance + interest);
      totalInterest = toCents(totalInterest + interest);
    }

    // -- 2 & 3. Minimums, and the pool -----------------------------------
    // The pool starts as the extra payment and collects everything not spent
    // on a minimum. Three things feed it, and they are the same thing seen
    // from three angles: money committed to this debt that no minimum needs.
    let pool = monthlyExtra;

    for (const debt of debts) {
      // A card with a balance takes its minimum — but no more than it owes.
      // Capping at the balance is what stops a $50 minimum from being paid
      // into a $12 balance and losing the other $38; the remainder falls
      // through to the pool below, where it goes to work on the target.
      const due = Math.min(debt.minimum, Math.max(debt.balance, 0));

      if (due > 0) debt.balance = toCents(debt.balance - due);

      // Step 3, and the engine of the whole method: whatever this card did
      // not need of its minimum joins the pool. For a card cleared in an
      // earlier month that is the entire minimum — it is done, and the money
      // that used to hold it steady now goes at the next card instead. This
      // is why a payoff accelerates rather than running at a constant rate,
      // and it is a single subtraction.
      pool = toCents(pool + (debt.minimum - due));
    }

    // -- 4. The pool, onto the target ------------------------------------
    // The order is recomputed every month, over the cards that still have a
    // balance, because the strategy is a rule and not a fixed queue: under
    // snowball the smallest balance changes hands as cards shrink, and a
    // queue frozen at month one would stop matching the order shown on the
    // dashboard.
    const remaining = orderedBy(
      debts.filter((debt) => debt.balance > 0),
      strategy,
    );

    // The whole pool goes at the first card in that order — the single target
    // — and the loop is here for one reason: the pool can be larger than the
    // target's balance. When it is, the card is cleared and the remainder
    // moves to the next card in the same order, in the same month, rather
    // than being paid into a zero balance and lost. Nobody sends a bank $900
    // to settle $300 and shrugs at the change.
    for (const debt of remaining) {
      if (pool <= 0) break;

      const payment = Math.min(pool, debt.balance);
      debt.balance = toCents(debt.balance - payment);
      pool = toCents(pool - payment);
    }

    // -- The month, recorded ---------------------------------------------
    // One point per month for the chart, and the loop's own condition. A card
    // that reached zero this month is simply a card with no balance from here
    // on: nothing removes it from the array, because its minimum is still
    // needed by step 3 above every month for the rest of the run.
    owed = totalOf(debts, (debt) => debt.balance);
    balances.push(owed);
  }

  // Falling out of the loop still owing something means the backstop fired,
  // not that the debt was paid. Reported as a debt that does not clear: after
  // fifty years the distinction between "never" and "not in any timeframe
  // worth showing" is not one a person needs drawn for them.
  if (owed > 0) return neverClears();

  return {
    clears: true,
    months,
    totalInterest,
    payoffDate: monthsFromNow(today, months),
    balances,
  };
}
