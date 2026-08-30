import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext.js";
import { supabase } from "../lib/supabase.js";
import { describeAuthError } from "../lib/authErrors.js";

// ===========================================================================
// The single source of truth for "who is signed in".
//
// ---------------------------------------------------------------------------
// What a session is
//
// When someone signs in, Supabase's auth server checks the password and hands
// back a *session*. A session is a plain object holding four things: an access
// token, a refresh token, an expiry timestamp, and a copy of the user record
// (id, email, when they signed up).
//
// The access token is a JWT — a short string, signed by the auth server, that
// says in effect "the bearer of this is user 4f3a…, and this claim is good
// until 14:52". Because it is signed, any server can verify it without looking
// anything up in a database; because it is short-lived (an hour by default), a
// stolen one stops working quickly. The refresh token is the long-lived half:
// it can be traded for a fresh access token, and the Supabase client does that
// on a timer in the background, before the current one expires, without
// anything in this file being involved.
//
// Note what a session is *not*: there is no `isLoggedIn` boolean anywhere in
// this app, and no server we poll to ask. "Signed in" means exactly one thing —
// do we currently hold a session? That single question is what this file
// answers for every other component.
//
// ---------------------------------------------------------------------------
// Where the session is stored
//
// In localStorage, written by the Supabase client itself, under a key derived
// from the project reference (roughly "sb-<project-ref>-auth-token"). We never
// touch that key: the client owns reading it, writing it, and keeping it fresh.
// Reaching into it by hand would mean two pieces of code maintaining the same
// value, which is how the two drift apart.
//
// localStorage is the important detail, because of what it survives. It is
// scoped to the origin, and it persists across tab closes, browser restarts,
// and reboots — it has no expiry of its own. That is why staying signed in is
// the default behaviour here rather than a "remember me" feature: the tokens
// simply outlive the page that created them. (The flip side: it is readable by
// any JavaScript running on this origin, which is the reason the access token
// is deliberately short-lived and privileges live in row-level security on the
// server rather than in the token.)
//
// ---------------------------------------------------------------------------
// How the app knows you are signed in after a page refresh
//
// A refresh destroys everything React is holding. This provider is constructed
// from scratch, its useState below starts at null again, and no variable in
// memory survives. What survives is the localStorage entry.
//
// So on mount the client reads that entry back, checks the expiry, silently
// trades the refresh token for a new access token if it has aged out, and hands
// us the restored session. That restore is asynchronous — it may involve a
// network round trip — and that asynchrony is the entire reason `loading`
// exists below.
//
// For the first moments of every page load the app genuinely does not yet know
// whether anyone is signed in. "Don't know yet" has to be a state distinct from
// "nobody is signed in", because the two look identical (session === null) and
// call for opposite behaviour: one means wait, the other means redirect to the
// login page. Collapsing them is the classic bug that throws signed-in users
// out on every refresh. ProtectedRoute.jsx is where that distinction is spent.
// ===========================================================================

// The context object lives in authContext.js; see that file for why the
// provider, the context, and the hook are three separate modules.

export function AuthProvider({ children }) {
  // The session as we last saw it. null means signed out — or not yet known,
  // which is what `loading` disambiguates.
  const [session, setSession] = useState(null);

  // Starts true: on the very first render we have asked the client for the
  // stored session but have not heard back. Set to false once, by whichever of
  // the two paths below reports first, and never set back to true — after the
  // initial restore, auth changes arrive instantly from memory and there is
  // nothing left to wait for.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // React's StrictMode mounts, unmounts, and remounts every component in
    // development, specifically to prove that effects clean up after
    // themselves. This effect therefore runs twice locally. `cancelled` stops
    // the first run's in-flight getSession() from resolving into setState after
    // its subscription has already been torn down.
    let cancelled = false;

    // --- Path 1: restore -------------------------------------------------
    // Read back whatever session localStorage is holding, refreshing the token
    // first if it has expired. Resolving with { session: null } is a normal
    // answer — it means nobody is signed in — not an error condition.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    // --- Path 2: listen --------------------------------------------------
    // Every subsequent change in auth state arrives through this callback:
    // signing in, signing out, a background token refresh replacing the access
    // token, and — because the client watches the storage key — a sign-out
    // performed in another tab of the same browser. We take whatever session it
    // gives us; null means signed out.
    //
    // The callback stays deliberately synchronous. The Supabase client invokes
    // these listeners while holding an internal lock, so awaiting another
    // supabase.auth.* call in here can deadlock. Store the session, nothing
    // more.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setLoading(false);
    });

    // --- Cleanup ---------------------------------------------------------
    // Without unsubscribe(), the client holds a reference to that callback
    // forever. Two things then go wrong: it keeps firing after this component
    // is gone, writing to state that no longer exists, and every remount adds
    // another listener on top of the last, so a few navigations leave a stack
    // of stale listeners all reacting to the same event.
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []); // Empty deps: subscribe once for the life of the provider.

  // Memoised so that components consuming this context re-render when the
  // session actually changes, rather than on every render of this provider —
  // a fresh object literal is a new value to React every time.
  const value = useMemo(() => {
    // Each action below returns { error } where error is either null or a
    // sentence already safe to render. Raw Supabase errors stop here and never
    // reach a component; see lib/authErrors.js for why.

    async function signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        return { error: describeAuthError(error), needsConfirmation: false };
      }

      // With email confirmation enabled (the default for a new project), a
      // successful sign-up creates the user but returns *no session*: the
      // account exists and cannot be used until the emailed link is clicked.
      // The caller has to say so rather than sending them to a dashboard they
      // would immediately be bounced out of.
      //
      // This is also what a sign-up for an already-registered address looks
      // like. Supabase answers identically on purpose — telling the browser
      // "that email is taken" would let anyone test which addresses have
      // accounts here — so "check your inbox" is both the honest and the
      // correct thing to show.
      return { error: null, needsConfirmation: data.session === null };
    }

    async function signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      // On success the returned session is deliberately discarded: the listener
      // above is already firing with that same session, and keeping one writer
      // for `session` means the two can never race or disagree.
      return { error: error ? describeAuthError(error) : null };
    }

    async function signOut() {
      // Clears the tokens from localStorage and revokes the refresh token
      // server-side. The listener above then fires with null, which is what
      // actually flips the app back to its signed-out state.
      const { error } = await supabase.auth.signOut();
      return { error: error ? describeAuthError(error) : null };
    }

    return {
      session,
      // The user record lives inside the session, so it is derived rather than
      // stored — one fewer piece of state that could fall out of step. Exposed
      // separately because components almost always want `user.email`, not the
      // tokens wrapped around it.
      user: session?.user ?? null,
      loading,
      signUp,
      signIn,
      signOut,
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
