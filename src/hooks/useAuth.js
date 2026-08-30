import { useContext } from "react";
import { AuthContext } from "../context/authContext.js";

// The only supported way to read the auth context. Every component goes through
// this hook rather than calling useContext(AuthContext) itself, which keeps the
// guard below on every single read instead of on the ones someone remembered.
//
// It lives in its own module, apart from the provider it reads, for Fast
// Refresh — see the note in context/authContext.js for the full reasoning and
// how the three modules divide up.
//
// The guard turns a confusing downstream failure — "cannot read properties of
// null (reading 'loading')", thrown from whichever component happened to call
// this first, which is rarely the one that is actually wrong — into a sentence
// naming the real mistake: something is rendering outside the provider.
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      "useAuth() was called outside <AuthProvider>. Check that the component " +
        "renders below the provider in App.jsx.",
    );
  }

  return context;
}
