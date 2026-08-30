import { createContext } from "react";

// The context object itself, and nothing else.
//
// It sits apart from AuthContext.jsx — which holds the provider — because of
// Fast Refresh. React Refresh can only hot-swap a module whose every export is
// a component; a module exporting both <AuthProvider> and this object falls
// back to a full page reload on each edit, and reloading the auth provider
// tears down its subscription and re-reads the session from localStorage, so
// whatever you were testing resets under you. Three small modules keep the
// whole auth layer hot-updatable:
//
//   authContext.js       this object          (no components, no hooks)
//   AuthContext.jsx      <AuthProvider>       (component only)
//   ../hooks/useAuth.js  useAuth()            (the way components read it)
//
// The filename casing is the repo's existing rule rather than a near-miss on
// AuthContext.jsx: PascalCase files export a component, camelCase ones do not —
// the same distinction that separates Landing.jsx from site.js.
//
// null as the default value, rather than an empty object, so useAuth() can tell
// "no provider above me in the tree" apart from "a provider that happens to
// have no session". Only useAuth() should read this; components go through the
// hook, which carries the provider check.
export const AuthContext = createContext(null);
