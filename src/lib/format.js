// Turning stored numbers into the strings a person reads.
//
// Two rules hold this file together.
//
// First: no string concatenation. "$" + amount.toFixed(2) is wrong in ways that
// only show up later — it has no thousands separators, it puts the symbol on
// the wrong side for most of the world's currencies, and it silently prints
// "$NaN" when handed something that isn't a number. Intl.NumberFormat is the
// platform's own answer to all of that, it ships in every browser this app
// supports, and it costs nothing to use.
//
// Second: the formatters are built once, here, at module scope. Constructing an
// Intl.NumberFormat is genuinely expensive — it resolves a locale and builds a
// pattern — and a list of cards re-rendering would otherwise construct one per
// figure per render. Built once and reused, they are effectively free.
//
// The locale is pinned to "en-US" rather than left to the browser. The amounts
// in this app are US dollars: there is no currency column on credit_cards and
// nothing converts anything. Passing undefined would let a browser set to
// de-DE render a dollar figure as "1.234,56 $" — correctly formatted German
// for a number that is not German. Pinning the locale to match the fixed
// currency keeps the two from disagreeing. The day the app holds more than one
// currency, that is the day this takes a currency argument.

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// APR is stored the way it is spoken: 24.99 means 24.99%. It is never a
// fraction anywhere in this codebase — not in the column, not in a component,
// not here.
//
// Which rules out style: "percent". That option assumes the *fraction* form and
// multiplies by 100 on the way out, so it would render our 24.99 as "2,499%".
// The usual workaround — divide by 100 on the way in — would mean the app holds
// two different representations of one number and every screen has to know
// which one it has. That is the bug this avoids by never doing the division.
//
// style: "unit" with unit: "percent" formats the number as given and appends
// the sign as part of the pattern. No arithmetic, no concatenation.
//
// Two decimals minimum so a column of rates lines up under the mono face; three
// maximum because apr_pct is numeric(6,3) and 99.999 is a real, storable rate
// whose last digit should not be rounded away.
const PERCENT = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

// A utilisation ratio, as a percentage.
//
// This is the other half of the note above, and the reason both formatters can
// exist in one file without contradicting each other. style: "unit" formats the
// number as given, which is what an APR needs: apr_pct holds 24.99 and means
// 24.99%. style: "percent" assumes the *fraction* form and multiplies by 100
// itself, which is what a utilisation needs: cardUtilization() returns 0.42 and
// means 42%.
//
// Two representations, two formatters, and — the part that matters — no
// arithmetic in either. Nothing here converts between the forms; each function
// is simply pointed at the form its input already has. The one place the two
// representations meet is the APR division in lib/finance.js.
//
// No decimal places. A utilisation is a rough position, not a measurement:
// "42%" is the whole of what someone does with it, and "41.7%" implies a
// precision that a balance changing daily does not have.
const RATIO = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

// A due date, as a day someone would say out loud.
//
// ---------------------------------------------------------------------------
// Why the formatter is pinned to UTC
//
// due_date is a Postgres `date`: a calendar day, with no time of day and no
// zone attached. It arrives as "2026-09-15" and means the fifteenth, full stop.
//
// new Date("2026-09-15") does not preserve that. A bare date string is parsed
// as midnight *UTC*, producing an instant — and an instant rendered by a
// formatter left on the local zone is a different day for everyone west of
// Greenwich. In New York that instant is 8pm on the 14th, so a card would show
// a due date one day before the one that was entered, on every machine in the
// Americas, and correctly everywhere else. That combination is what makes the
// bug survive review: it looks right where it is usually looked at.
//
// timeZone: "UTC" reverses exactly the shift the parse introduced. The day is
// read as UTC and printed as UTC, so it comes back out as the day it went in,
// in every zone.
//
// dateStyle rather than a hand-assembled day/month/year, for the same reason
// the currency above is not built by concatenation: the order of the parts, the
// separators, and the month's name are all locale decisions, and Intl already
// knows them.
const DATE = new Intl.DateTimeFormat("en-US", {
  // "Sep 15, 2026" — unambiguous about which number is the month, which a
  // numeric format is not, and short enough to sit in a column beside the
  // amounts.
  dateStyle: "medium",
  timeZone: "UTC",
});

// PostgREST sends numeric columns as JSON numbers, so these normally receive a
// number already. Number() is here for the case where that assumption slips —
// a string arriving from a form, a column read through a different path — since
// Intl throws on a string rather than coercing it, and a thrown formatter takes
// the whole page down over a cosmetic detail.
//
// A value that genuinely isn't a number gets an em dash: "we don't have this"
// is a true statement, where "$NaN" is noise that looks like a bug in the money
// rather than a gap in the data.
const MISSING = "—";

export function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return MISSING;
  return CURRENCY.format(amount);
}

export function formatPercent(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return MISSING;
  return PERCENT.format(rate);
}

// The em dash rather than null, matching the two above rather than formatDate.
//
// Callers that want to render nothing at all already have a cleaner way to know
// that: the finance functions return null for a card with no usable credit
// limit, so the check happens before the value ever reaches a formatter. By the
// time something is being formatted, the intent is to show it — so the fallback
// here is for the case where a number was expected and turned out not to be
// one, which is exactly what "—" says.
export function formatRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return MISSING;
  return RATIO.format(ratio);
}

// null rather than the em dash the three above fall back to, and that difference
// is deliberate. A card without a balance would be a card missing something it
// is supposed to have, which is worth marking; a card without a due date is
// simply a card nobody has entered a due date for. The caller renders nothing
// at all in that case — see components/CardItem.jsx — rather than a dash
// standing in for a fact that was never promised.
export function formatDate(value) {
  if (!value) return null;

  const day = new Date(value);
  if (Number.isNaN(day.getTime())) return null;

  return DATE.format(day);
}

// A month, as a month — "March 2029".
//
// The payoff simulator counts whole months and has no day in it, so this is
// the whole of what simulatePayoff knows. formatDate would render the same
// Date as "Mar 1, 2029", which is a day, and a day is a claim: it would tell
// someone their debt clears on a Thursday, when what was computed is the
// month it lands in. The precision has to match the arithmetic that produced
// it, and a payoff four years out is a month at best.
//
// Long month rather than short. The figure it labels is a small one, printed
// once, in a place someone stops to read, and "March 2029" is how it would be
// said out loud — the abbreviation on a card's due date is there to fit a
// column of them, which this is not.
//
// UTC for the same reason as the formatter above, and it is load-bearing here
// rather than defensive: simulatePayoff builds its date with Date.UTC, so the
// only reading that returns the month it was given is a UTC one. Left on the
// local zone, everyone west of Greenwich would see the previous month.
const MONTH = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  timeZone: "UTC",
});

// Money with the middle digits taken out — "$12K".
//
// For the axis of the payoff chart and nothing else. An axis is a scale, not a
// figure: it exists so a line can be read against it, and "$12,480.00" repeated
// six times down the side of a chart is six times the ink for a precision
// nobody is reading off it. Every exact number in that panel is printed as
// text, in full, beside the chart.
//
// notation: "compact" is Intl's own answer, so the thresholds and the letters
// come from the locale rather than from a hand-rolled divide-by-a-thousand.
const COMPACT_CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 0,
});

// null rather than the em dash, matching formatDate: both of these take a date
// that a caller is expected to have checked for, and both leave "render
// nothing at all" available as the answer. simulatePayoff returns a null
// payoffDate for a debt that never clears, and the screen has a sentence for
// that case rather than a dash where a date would go.
export function formatMonth(value) {
  if (!value) return null;

  const month = new Date(value);
  if (Number.isNaN(month.getTime())) return null;

  return MONTH.format(month);
}

export function formatCompactCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return MISSING;
  return COMPACT_CURRENCY.format(amount);
}
