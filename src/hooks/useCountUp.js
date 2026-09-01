import { useLayoutEffect, useRef } from "react";

// ===========================================================================
// The count-up behind the dashboard's bleed meter, and the only animation in
// the app.
//
// Everything else that moves here is a transition — a hover changing colour, a
// border lighting up on focus — which is the interface acknowledging that you
// touched it. This is different in kind: nobody touched anything. The number
// climbs because the climb is part of what the number says. A monthly interest
// figure that is simply present reads as a fact about an account; the same
// figure counting up from nothing reads as money accumulating, which is what
// it is. That is the whole justification for it, and it is why there is not a
// second one anywhere in the app.
//
// ---------------------------------------------------------------------------
// Why the timing is read out of CSS
//
// The duration and the curve are tokens — --dur-count and --ease — and this
// file reads them back out of the cascade rather than restating them as
// JavaScript constants.
//
// The alternative is one line shorter and quietly wrong. Writing 1200 and
// [0.2, 0.8, 0.2, 1] here would create a second definition of two values that
// already exist in styles/tokens.css, in a file nobody editing the motion
// scale would think to open. The count would then keep its old curve while
// every transition in the app moved to a new one, and the app would stop
// feeling like one object — which is precisely the failure the token system
// exists to prevent.
//
// Reading them at run time costs one getComputedStyle call per animation, once
// per mount, which is nothing next to the frames that follow it.
//
// ---------------------------------------------------------------------------
// Reduced motion
//
// The global rule in tokens.css collapses CSS animations and transitions to
// ~0ms under prefers-reduced-motion: reduce, but it cannot reach an animation
// JavaScript is driving frame by frame — requestAnimationFrame does not
// consult a media query. So this asks directly, and when the answer is yes it
// sets the final value once and never schedules a frame at all.
//
// Not a faster count, and not a shorter one: no count. The setting is not a
// preference for less movement, it is a request for none, and for someone with
// a vestibular disorder a 200ms sprint through the same digits is the same
// problem in less time.
// ===========================================================================

// Used only when the tokens cannot be read — a test environment with no
// stylesheet attached, or a browser that hands back an empty string for a
// custom property mid-load. These are a safety net for an unstyled page, not a
// second home for the values: styles/tokens.css is where they are decided, and
// if these ever disagree with it, these are the ones that are wrong.
const FALLBACK_DURATION_MS = 1200;
const FALLBACK_EASE = [0.2, 0.8, 0.2, 1];

// cubic-bezier(x1, y1, x2, y2), with whitespace and signs allowed where CSS
// allows them. Anything else — a keyword like `ease-out`, a `linear()` curve,
// a steps() function — simply does not match, and the fallback is used. A
// partial parse would be worse than no parse.
const CUBIC_BEZIER =
  /^cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/;

// Newton–Raphson converges on this curve in a handful of steps; eight is well
// past the point where another one changes a pixel. The epsilon guards the
// division below — a flat stretch of the curve has a slope near zero, and
// dividing by it would throw the estimate off to infinity in a single step.
const NEWTON_STEPS = 8;
const MIN_SLOPE = 1e-6;

function readToken(name) {
  // The tokens are declared on :root, so that is where they are read from.
  // getComputedStyle resolves the cascade, so this is the value actually in
  // effect, not the one written in the file.
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

// --dur-count as a number of milliseconds.
//
// CSS time values come in two units and both are legal in a token, so a bare
// parseFloat would read "1.2s" as 1.2ms and finish the animation before the
// first frame. Checking for the seconds unit is cheaper than being wrong by a
// factor of a thousand.
function readDuration() {
  const raw = readToken("--dur-count");
  const value = Number.parseFloat(raw);

  if (!Number.isFinite(value) || value <= 0) return FALLBACK_DURATION_MS;
  if (raw.endsWith("ms")) return value;
  if (raw.endsWith("s")) return value * 1000;

  return FALLBACK_DURATION_MS;
}

function readEase() {
  const match = CUBIC_BEZIER.exec(readToken("--ease"));
  if (!match) return FALLBACK_EASE;

  const points = match.slice(1, 5).map(Number);
  return points.every(Number.isFinite) ? points : FALLBACK_EASE;
}

// One axis of a cubic Bézier whose first and last control points are pinned to
// 0 and 1 — which is what a CSS easing curve is, so only the two middle
// control points vary. This is the polynomial form of the curve, expanded so
// each evaluation is three multiplications rather than a recursive
// interpolation.
function axis(a1, a2, t) {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;

  return ((a * t + b) * t + c) * t;
}

// The same polynomial differentiated, for the Newton step below.
function axisSlope(a1, a2, t) {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;

  return (3 * a * t + 2 * b) * t + c;
}

// A CSS easing curve as a function from elapsed fraction to eased fraction.
//
// The curve is parametric: both x and y are functions of a parameter t that is
// not itself time. So the eased value at 40% of the duration is not axis(y, 0.4)
// — it is the curve's y at whichever t makes its x equal 0.4, and finding that
// t means solving a cubic. Newton–Raphson does it: start with t = x, which is
// already close for the shallow curves CSS easing uses, and step toward the
// root a few times.
//
// Skipping the solve and using axis(y1, y2, x) directly is a common shortcut
// and it visibly changes the motion — most of the character of a curve like
// cubic-bezier(0.2, 0.8, 0.2, 1) lives in how unevenly x advances.
function toEasing([x1, y1, x2, y2]) {
  return function ease(progress) {
    // Endpoints returned exactly rather than solved for. The solve would land
    // a rounding error away from 0 and 1, and at the end of a count that error
    // is a final figure a cent off the one the rest of the page shows.
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    let t = progress;

    for (let step = 0; step < NEWTON_STEPS; step += 1) {
      const slope = axisSlope(x1, x2, t);
      if (Math.abs(slope) < MIN_SLOPE) break;

      t -= (axis(x1, x2, t) - progress) / slope;
    }

    return axis(y1, y2, t);
  };
}

function prefersReducedMotion() {
  // Optional-chained because matchMedia is absent in some non-browser
  // environments, and a missing media-query API should not take the dashboard
  // down over an animation.
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

// Counts a number up from zero and writes it into an element. Returns the ref
// to put on that element.
//
// ---------------------------------------------------------------------------
// Why this writes to the DOM instead of returning a value
//
// The obvious shape for this hook is to hold the current figure in state and
// return it, letting the component re-render each frame. That works, and it is
// wrong twice over.
//
// It re-renders the entire summary — heading, utilisation bar, threshold mark,
// the sentence underneath — around seventy times to change one string, when
// nothing but that string is different. React is fast enough to get away with
// it here, which is exactly why it is the kind of thing that gets copied into
// a place where it is not.
//
// And it puts a setState in an effect body on every frame, which React now
// warns about by name: an effect that immediately sets state is a render that
// causes another render. The rule is pointing at something real. A count-up is
// not state the application has — no other component can ask what the number
// currently is, nothing branches on it, and it is discarded the moment it
// settles. It is a visual effect on one text node, so it is applied to that
// text node.
//
// `format` turns the running number into the string to display, and must be a
// stable function — the module-level formatters in lib/format.js are, which is
// what this is built for. A formatter defined inside a component body would be
// a new identity on every render and would restart the count each time.
//
// ---------------------------------------------------------------------------
// Why a layout effect
//
// The element renders empty and is filled in here. useLayoutEffect runs after
// the DOM is updated but before the browser paints, so the first frame a
// person sees already has the starting figure in it. A plain useEffect runs
// after paint, which would show an empty gap for one frame and then the
// number — a flicker at exactly the moment the panel appears.
//
// It matters more under reduced motion, where this hook writes the final total
// once and stops. That has to happen before paint, or the accommodation for
// people who asked not to see movement would itself be a flash of change.
export function useCountUp(target, format) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null) return;

    // Nothing to count toward. The bleed total is null while the cards are
    // loading and null again if they cannot be totalled (see lib/finance.js),
    // and the caller renders something else entirely in both cases — but the
    // formatter is still asked, so the element is never left holding a stale
    // figure from a previous target.
    if (target === null || !Number.isFinite(target)) {
      node.textContent = format(target);
      return;
    }

    // Two ways to arrive at "show the total, do not count to it".
    //
    // The first is the accommodation: someone has asked their system not to
    // animate things. Not a faster count and not a shorter one — no count. The
    // setting is a request for none, and a 200ms sprint through the same
    // digits is the same problem in less time.
    //
    // The second is a background tab, and it is a correctness guard rather
    // than a nicety. Browsers pause requestAnimationFrame in a hidden
    // document, so a count started there would write $0.00 and then stop, for
    // as long as the tab stays in the background. A stalled count-up is not a
    // missing animation; it is the app's largest, most prominent figure
    // stating that this person's debt costs them nothing. Whatever else this
    // screen does, it must never do that, so a document that cannot animate
    // gets the number instead.
    if (prefersReducedMotion() || document.hidden) {
      node.textContent = format(target);
      return;
    }

    const duration = readDuration();
    const ease = toEasing(readEase());

    let frame = 0;
    let startedAt = null;

    function step(now) {
      // The first callback's timestamp is the start, rather than a
      // performance.now() taken when the effect ran. Between those two moments
      // sits however long the browser took to reach the next frame, and
      // counting that as elapsed time makes the animation start partway
      // through — visibly, on a slow first paint, which is exactly when this
      // runs.
      if (startedAt === null) startedAt = now;

      // Guarded in readDuration, which never returns zero or a negative.
      const progress = Math.min((now - startedAt) / duration, 1);

      if (progress < 1) {
        node.textContent = format(target * ease(progress));
        frame = requestAnimationFrame(step);
        return;
      }

      // The target itself on the last frame, not target * ease(1). They agree
      // to within floating-point noise, and this is a dollar figure sitting
      // next to other dollar figures derived from the same total — "to within
      // noise" is not close enough when a cent of disagreement is visible.
      node.textContent = format(target);
    }

    // Zero before the first frame rather than leaving the element empty, or
    // holding a previous total for one paint and then jumping back to nothing
    // to count up again.
    node.textContent = format(0);
    frame = requestAnimationFrame(step);

    // StrictMode mounts twice in development, and without this the first
    // mount's loop would keep running alongside the second — two animations
    // writing to the same text node.
    return () => cancelAnimationFrame(frame);
  }, [target, format]);

  return ref;
}
