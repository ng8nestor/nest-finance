// The one Supabase client for the whole app.
//
// createClient() returns more than an HTTP wrapper: the instance owns the auth
// state — the tokens in localStorage, the background timer that refreshes them
// before they expire, and the list of onAuthStateChange listeners. Creating a
// second client would mean two objects independently reading and writing the
// same storage key, each unaware of the other's refreshes. So it is created
// exactly once, here, and every other module imports this instance rather than
// calling createClient again.
//
// The credentials come from .env.local, never from source. Vite reads that file
// when the dev server starts and again at build time, and substitutes
// `import.meta.env.VITE_*` with the literal string in the output. Only names
// prefixed VITE_ are exposed to the browser — that prefix is the guard that
// stops an unrelated secret in the same file from being bundled by accident.
//
// The anon key is a *publishable* key: it is designed to ship in a browser
// bundle, identifies the project, and carries no privileges of its own —
// everything it can reach is governed by row-level security on the server. It
// still lives in .env.local (which is gitignored) rather than in this file, so
// the project's configuration sits in one place and swapping environments is a
// matter of changing a file, not editing code.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail at startup rather than at the first login attempt. A missing variable
// otherwise surfaces as an opaque "Invalid URL" thrown from deep inside the
// client, at the moment someone presses a button; this names what is missing
// and where to put it. Note the restart: Vite reads .env.local once, at boot,
// so editing it while the dev server is running changes nothing.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Copy .env.example to .env.local, " +
      "fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
