import { useId, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { simulatePayoff } from "../lib/finance.js";
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonth,
} from "../lib/format.js";
import "./PayoffSimulator.css";

// ===========================================================================
// The payoff simulator, at the bottom of the dashboard.
//
// It is last on the page because it is the only part of the dashboard that is
// not a fact. Everything above it reports what is true right now — what the
// debt costs, what the cards are, which order to pay them in — and this asks a
// question instead: what happens if you put more at it. That belongs after the
// facts, not among them.
//
// One control, four figures, one chart. The slider is the whole interface: no
// text field to type a number into, no form to submit, no "calculate" button.
// Someone dragging it is not entering data, they are looking for the point
// where the answer changes, and every one of those affordances would put a
// step between the drag and the answer.
//
// ---------------------------------------------------------------------------
// Two simulations, every render
//
// The panel is a comparison, so it runs the model twice: once at the slider's
// value, and once at zero. The second one is the baseline — what happens if
// nothing changes — and it is what "saved" is measured against. Neither figure
// means anything alone: $4,000 of interest is not good or bad until you know
// the alternative was $11,000.
//
// Both are memoised on the inputs they actually depend on, which is why the
// baseline does not recompute while the slider moves — it does not depend on
// the slider. A run is a few hundred iterations over a handful of cards, so
// this is cheap either way; the memo is here to keep a drag from doing work it
// does not need rather than to rescue it from being slow.
//
// No arithmetic on money here, with two exceptions that prove the rule: the
// two "saved" figures are a subtraction of one result from the other. They are
// differences between two numbers this component was handed, not a formula —
// there is no third way to compute what a saving is — and pushing them into
// lib/finance.js would mean a function whose whole body is one minus sign.
// ===========================================================================

// The slider's range, in dollars a month.
//
// Zero to a thousand because that is the span where the answer is interesting.
// Below zero is not a payment, and above a thousand the curve has flattened —
// the months saved by the eleventh hundred dollars are a fraction of those
// saved by the first, so a wider range would spend most of its travel on
// differences too small to see.
//
// Twenty-five dollar steps for the same reason a utilisation shows no decimal
// places. Someone is choosing roughly how much they can find each month, not
// specifying a figure to the dollar, and forty stops across the track is a
// slider that answers to a nudge — where a thousand of them would make every
// drag a small act of precision nobody asked for.
const MIN_EXTRA = 0;
const MAX_EXTRA = 1000;
const EXTRA_STEP = 25;

// Where the slider starts.
//
// Not zero, which is the tempting default because it is the honest baseline.
// The trouble is that it is also the state in which this panel says nothing: at
// zero the two simulations are the same simulation, the two lines lie exactly
// on top of each other, and every "saved" figure reads $0.00 — a panel that
// opens looking broken and has to be poked before it makes its point.
//
// A hundred is a real amount of money and a plausible one to find, so the panel
// arrives already answering the question it exists to ask. The slider's left
// end is right there for anyone who wants the baseline on its own, and the
// sentence under the figures says so when they get there.
const DEFAULT_EXTRA = 100;

// The two series. Named once here because three things have to agree on each —
// the line, the legend swatch, and the tooltip row — and a legend whose colours
// drifted from the chart is worse than no legend at all.
//
// The tokens are the app's semantic accents, used for what they mean rather
// than for how they look: the baseline is --debt because it is the debt left
// alone, and the line with the extra payment on it is --progress because that
// is this app's token for a balance coming down. Nothing here picks a colour.
//
// They are handed to Recharts as `var(...)` strings, which reach the SVG as
// stroke values and resolve against the cascade like any other token. The
// alternative — reading computed styles in JavaScript to hand the library a
// hex code — would take the one set of colours the stylesheet does not control
// and freeze them at render time.
const WITH_EXTRA = { key: "withExtra", color: "var(--progress)" };
const MINIMUMS_ONLY = { key: "minimumsOnly", color: "var(--debt)" };

// A year, for the axis ticks below.
const MONTHS_PER_YEAR = 12;

// The chart's rows: one per month, holding whichever series still has a
// balance to report at that point.
//
// The two runs are different lengths — that difference is the entire subject of
// the panel — so the shorter series simply stops. `null` rather than 0 past the
// end of a run, because 0 would draw the line flat along the axis for years
// after the debt was paid, which is a picture of still being in debt at zero
// dollars. A null is a gap, and Recharts ends the line at the last real point.
//
// The month a run ends *on* is a real point: it is the zero. That is the moment
// the whole chart is about, so both lines land on the axis rather than
// stopping a month short of it.
function toChartRows(withExtra, minimumsOnly) {
  const a = withExtra?.balances ?? [];
  const b = minimumsOnly?.balances ?? [];
  const span = Math.max(a.length, b.length);

  const rows = [];

  for (let month = 0; month < span; month += 1) {
    rows.push({
      month,
      [WITH_EXTRA.key]: month < a.length ? a[month] : null,
      [MINIMUMS_ONLY.key]: month < b.length ? b[month] : null,
    });
  }

  return rows;
}

// Ticks once a year, plus the last month.
//
// Left to itself Recharts picks evenly spaced round numbers, which on a 47
// month axis gives ticks at 0, 12, 23, 35, 46 — none of which is a number
// anybody counts in. Years are how a payoff is actually discussed, and the
// final month is the one the panel is about, so it is never left off.
function yearTicks(span) {
  const ticks = [];
  for (let month = 0; month < span; month += MONTHS_PER_YEAR) ticks.push(month);

  const last = span - 1;
  // Only when it does not crowd the tick before it — two labels a month apart
  // overlap and read as one smudge.
  if (last > 0 && last - ticks[ticks.length - 1] > 1) ticks.push(last);

  return ticks;
}

// The tooltip, written out rather than configured through Recharts' props.
//
// Its own tooltip is a white box with a grey border and a default sans stack —
// three decisions taken by a library that has never seen this app's tokens.
// Every one of them would have to be overridden by prop anyway, so it is less
// code and less indirection to render the markup and let the stylesheet dress
// it like everything else on the page.
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="simulator__tooltip">
      <p className="simulator__tooltip-month">
        {label === 0 ? "Today" : `Month ${label}`}
      </p>
      {payload.map((entry) => (
        <p className="simulator__tooltip-row" key={entry.dataKey}>
          {/* The swatch takes the series' own stroke, so it cannot disagree
              with the line it stands for. */}
          <span
            className="simulator__tooltip-swatch"
            style={{ background: entry.stroke }}
          />
          <span className="simulator__tooltip-label">{entry.name}</span>
          <span className="simulator__tooltip-value">
            {formatCurrency(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

// One figure and its label. Up to four of these make the row under the slider.
//
// The label goes under the figure rather than over it. Someone scanning this
// row is looking for the numbers; the words are there to say what a number is
// once it has already caught the eye.
function Figure({ label, value, tone }) {
  return (
    <div className="simulator__figure">
      <p
        className={
          tone
            ? `simulator__value simulator__value--${tone}`
            : "simulator__value"
        }
      >
        {value}
      </p>
      <p className="simulator__figure-label">{label}</p>
    </div>
  );
}

function PayoffSimulator({ cards, loading, error, strategy }) {
  // Local state, not lifted and not persisted. Unlike the payoff strategy —
  // which is a standing preference about how the list is ordered, and is
  // remembered between visits — this is a question being asked in the moment.
  // Restoring yesterday's $325 on a later visit would present a number someone
  // tried out once as though it were a plan they had made.
  const [extra, setExtra] = useState(DEFAULT_EXTRA);

  // The slider and its output are two elements that have to be tied together,
  // and useId keeps that pairing correct even if this component is ever
  // rendered twice on one page.
  const sliderId = useId();

  const withExtra = useMemo(
    () => simulatePayoff(cards, extra, strategy),
    [cards, extra, strategy],
  );

  // The baseline. Deliberately not dependent on `extra` — this is the "if
  // nothing changes" run, and it is the same run at every slider position.
  const minimumsOnly = useMemo(
    () => simulatePayoff(cards, MIN_EXTRA, strategy),
    [cards, strategy],
  );

  const rows = useMemo(
    () => toChartRows(withExtra, minimumsOnly),
    [withExtra, minimumsOnly],
  );

  // The same three states the rest of the dashboard has, answered the way
  // PayoffStrategy answers them: silence. The list below has already said that
  // the cards are loading or that the request failed, and a payoff projection
  // for cards we do not have is not a thing to render a skeleton of.
  if (loading || error) return null;

  // Null means the cards could not be simulated — an empty list, or a row
  // missing a balance, an APR or a minimum. See simulatePayoff: it refuses
  // rather than quietly projecting a payoff for a subset of someone's debt.
  if (withExtra === null || minimumsOnly === null) return null;

  // Nothing owed. The panel would compute a payoff date of this month and a
  // saving of nothing, which is arithmetically right and reads as a strange
  // way to congratulate someone who has already paid everything off.
  if (rows[0]?.[WITH_EXTRA.key] === 0) return null;

  // Whether the two runs are comparable at all. Both figures on the right of
  // the row are differences, and a difference against a debt that never clears
  // is not a large number — it is not a number.
  const comparable = withExtra.clears && minimumsOnly.clears;

  const interestSaved = comparable
    ? minimumsOnly.totalInterest - withExtra.totalInterest
    : null;
  const monthsSaved = comparable
    ? minimumsOnly.months - withExtra.months
    : null;

  // At the left end of the slider the two runs are identical, so the baseline
  // would be drawn directly underneath the other line — two colours fighting
  // over the same pixels, implying a difference that is not there. At zero
  // extra only one line is true, so only one is drawn, and the legend renames
  // the remaining one to match.
  const showBaseline = extra > MIN_EXTRA && minimumsOnly.clears;

  const withExtraName =
    extra > MIN_EXTRA ? `With ${formatCurrency(extra)} extra` : "Minimums only";

  return (
    <section className="simulator" aria-labelledby="simulator-heading">
      <header className="simulator__header">
        <h2 className="simulator__heading" id="simulator-heading">
          What an extra payment does
        </h2>
        <p className="simulator__intro">
          Anything you pay above the minimums goes at one card at a time, in the
          order you chose above. Here is where that lands.
        </p>
      </header>

      <div className="simulator__control">
        {/* The label and the amount share a line: the slider's value is the
            label's own right-hand side, so the number appears where the eye
            already is rather than somewhere else on the panel. */}
        <div className="simulator__slider-header">
          <label className="simulator__slider-label" htmlFor={sliderId}>
            Extra each month
          </label>
          {/* <output> rather than a span, because that is what this is: a value
              produced by a control. In the mono face like every other figure in
              the app, and here it earns its keep twice over — the number
              changes forty times during a drag, and a proportional face would
              make the row twitch sideways on every step. */}
          <output className="simulator__amount" htmlFor={sliderId}>
            {formatCurrency(extra)}
          </output>
        </div>

        {/* A native range input, styled rather than rebuilt. It arrives with
            keyboard support, the correct role, arrow-key and page-key stepping,
            and its value announced on every change — all of which a div with a
            drag handler would have to reimplement, and most of which it would
            get wrong.

            valueAsNumber rather than Number(value): the browser has already
            parsed it, and a range input cannot hold a non-numeric string. */}
        <input
          className="simulator__slider"
          id={sliderId}
          type="range"
          min={MIN_EXTRA}
          max={MAX_EXTRA}
          step={EXTRA_STEP}
          value={extra}
          onChange={(event) => setExtra(event.target.valueAsNumber)}
          // The formatted amount, so it is announced as money rather than as a
          // bare number somewhere in a range of a thousand.
          aria-valuetext={formatCurrency(extra)}
        />

        <div className="simulator__scale" aria-hidden="true">
          <span>{formatCurrency(MIN_EXTRA)}</span>
          <span>{formatCurrency(MAX_EXTRA)}</span>
        </div>
      </div>

      {/* The figures. The first two describe the run with the extra payment on
          it; the second two are what it bought, which is why those carry the
          progress colour and the first two do not — a payoff date is a fact
          about a plan, not a gain. */}
      <div className="simulator__figures">
        {withExtra.clears ? (
          <>
            <Figure label="Debt-free" value={formatMonth(withExtra.payoffDate)} />
            <Figure
              label="Interest paid"
              value={formatCurrency(withExtra.totalInterest)}
            />
          </>
        ) : (
          // The extra payment is not enough either. A date and a total would
          // both read "never", stated twice, so the pair collapses into one
          // cell and the sentence below carries the explanation.
          <Figure label="Debt-free" value="Never" tone="debt" />
        )}

        {comparable && (
          <>
            <Figure
              label="Interest saved"
              value={formatCurrency(interestSaved)}
              tone="progress"
            />
            <Figure
              label={monthsSaved === 1 ? "Month sooner" : "Months sooner"}
              value={String(monthsSaved)}
              tone="progress"
            />
          </>
        )}
      </div>

      {/* The three things that can be true, said in words. Each is the reason
          the figures above look the way they do, and none of them is inferable
          from a chart with a line missing. */}
      {!minimumsOnly.clears && withExtra.clears && (
        <p className="simulator__verdict">
          On the minimums alone, this debt never clears &mdash; the interest
          each month is larger than the payments, so the balance grows however
          long you keep at it. That is why there is no saving to show against
          it: there is nothing to compare to.{" "}
          <strong className="simulator__verdict-strong">
            The extra {formatCurrency(extra)} a month is what makes paying this
            off possible at all.
          </strong>
        </p>
      )}

      {!withExtra.clears && (
        <p className="simulator__verdict">
          Even with {formatCurrency(extra)} on top, the payments do not cover
          what the interest adds each month, so the balance keeps climbing. It
          takes more than this slider offers &mdash; or a lower rate &mdash; to
          turn this one around.
        </p>
      )}

      {comparable && extra === MIN_EXTRA && (
        <p className="simulator__verdict">
          That is the path you are on now: the minimums and nothing else. Drag
          the slider to see what any amount above them changes.
        </p>
      )}

      {/* Drawn only when there is something to draw. A run that never clears
          has no series at all — see simulatePayoff on why it does not invent a
          horizon to chart — and an empty chart frame is worse than none. */}
      {rows.length > 1 && (
        <figure className="simulator__chart-figure">
          {/* The legend is markup, not <Legend>. Recharts' own sits inside the
              SVG with its own type scale and spacing, and it would be the one
              piece of text on this page not set from the tokens. */}
          <figcaption className="simulator__legend">
            <span className="simulator__legend-item">
              <span
                className="simulator__legend-swatch"
                style={{ background: WITH_EXTRA.color }}
              />
              {withExtraName}
            </span>
            {showBaseline && (
              <span className="simulator__legend-item">
                <span
                  className="simulator__legend-swatch"
                  style={{ background: MINIMUMS_ONLY.color }}
                />
                Minimums only
              </span>
            )}
          </figcaption>

          {/* The height lives in the stylesheet, on this wrapper, so it is a
              multiple of the spacing scale like every other dimension in the
              app — hence height="100%" below rather than a pixel count written
              into a component. */}
          <div className="simulator__chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                {/* Horizontal rules only. Vertical ones would divide the plot
                    into a grid of boxes and compete with the lines for it; the
                    question this chart answers is "how much is left", which is
                    read against the horizontal. */}
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="2 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  ticks={yearTicks(rows.length)}
                  tickFormatter={(month) => (month === 0 ? "now" : `${month}mo`)}
                  stroke="var(--border)"
                  tickLine={false}
                  // Typography is set in the stylesheet, on the <text> these
                  // produce — see the note there. Passing it here would mean
                  // font sizes as raw numbers inside a component.
                  tick={{ className: "simulator__tick" }}
                />
                <YAxis
                  tickFormatter={formatCompactCurrency}
                  stroke="var(--border)"
                  tickLine={false}
                  tick={{ className: "simulator__tick" }}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
                />

                {/* The baseline is drawn first so the line that matters sits
                    on top of it where the two meet. */}
                {showBaseline && (
                  <Line
                    type="monotone"
                    dataKey={MINIMUMS_ONLY.key}
                    name="Minimums only"
                    stroke={MINIMUMS_ONLY.color}
                    strokeWidth={2}
                    // No dot per month. At forty-odd points they merge into a
                    // beaded line and stop meaning anything; the tooltip is how
                    // a single month gets read.
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey={WITH_EXTRA.key}
                  name={withExtraName}
                  stroke={WITH_EXTRA.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  // Animation off, and this is the one that matters: the chart
                  // redraws on every step of a drag, and a tween per redraw
                  // would leave the line permanently chasing the slider instead
                  // of answering it.
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}
    </section>
  );
}

export default PayoffSimulator;
