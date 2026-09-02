import { useCallback, useState } from "react";
import { DEFAULT_STRATEGY, isStrategy } from "../lib/payoff.js";

// ===========================================================================
// The selected payoff strategy, remembered between visits.
//
// ---------------------------------------------------------------------------
// Why localStorage and not a column
//
// Because the choice is a preference about how a list is sorted, not a fact
// about someone's debt. Nothing in the database changes when it flips, no
// figure on the dashboard moves, and no other device needs to be told. A
// credit_cards row is a record of money owed; a sort order is a view setting,
// and giving it a table would mean a migration, an RLS policy, a request on
// every dashboard load, and a loading state for a radio button.
//
// The cost of that decision is honest and small: the choice does not follow
// anyone to a second browser, and clearing site data forgets it. Both are
// acceptable for a preference whose worst failure is one extra click. If it
// ever needs to be per-account, this hook is the one place that would change.
//
// ---------------------------------------------------------------------------
// Why every access is wrapped
//
// localStorage throws rather than returning null in more situations than it
// looks: Safari's private mode has historically thrown on write, an iframe
// with third-party storage blocked throws on read, and a browser configured to
// refuse site data throws on both. An unhandled throw in a lazy state
// initialiser takes down the render, which would mean a dashboard that shows
// nothing because it could not remember which of two sorts you preferred.
//
// So both accesses fall back rather than fail. The strategy is state either
// way — the app works perfectly with a preference that resets on reload, and
// that is exactly what someone with storage disabled gets.
// ===========================================================================

// Namespaced, because localStorage is one flat store shared with whatever else
// runs on this origin — including the Supabase client's session tokens, which
// are sitting a few keys away under a name of their own choosing.
const STORAGE_KEY = "nest.payoff-strategy";

function readStoredStrategy() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isStrategy(stored) ? stored : DEFAULT_STRATEGY;
  } catch {
    // Storage unavailable. The default is a working answer, not a failure.
    return DEFAULT_STRATEGY;
  }
}

export function usePayoffStrategy() {
  // A function, not a value: passed this way React calls it once, on the first
  // render, instead of hitting localStorage on every render and discarding the
  // result. A synchronous read is fast, but it is not free, and the list below
  // it re-renders on every card edit.
  const [strategy, setStrategy] = useState(readStoredStrategy);

  // The write happens here rather than in an effect watching `strategy`. An
  // effect would also fire on mount, storing the value that was just read back
  // out of storage, and it would make the persistence a consequence of the
  // state changing rather than of the person choosing — which is what it
  // actually is.
  const choose = useCallback((next) => {
    if (!isStrategy(next)) return;

    setStrategy(next);

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies to this session; it just will not survive a
      // reload. Nothing on screen should mention it — a person who has turned
      // off site storage does not need an app telling them so.
    }
  }, []);

  // A tuple, in the shape of useState, because that is what this is: state and
  // the one way to set it. hooks/useCards.js returns an object because it
  // returns seven unrelated things and the names are load-bearing at the call
  // site; two things in a fixed order are not helped by being named twice.
  return [strategy, choose];
}
