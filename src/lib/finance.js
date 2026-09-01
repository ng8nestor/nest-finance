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
