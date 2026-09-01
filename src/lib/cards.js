import { supabase } from "./supabase.js";
import { describeCardError } from "./cardErrors.js";

// ===========================================================================
// Every read and write of the credit_cards table.
//
// Components never call supabase.from("credit_cards") themselves. They call the
// four functions below, which is what keeps the column list, the ordering, the
// shape of the payload, and the error handling in one place instead of spread
// across whichever screens happen to touch cards.
//
// ---------------------------------------------------------------------------
// The return shape
//
// Each function resolves to an object holding the data and an `error` that is
// either null or a sentence already safe to put on screen. The raw PostgrestError
// stops here and never reaches a component — the same contract the auth actions
// in AuthContext.jsx keep, for the same reason (see lib/authErrors.js).
//
// Nothing throws. A caller writes:
//
//   const { cards, error } = await listCards();
//
// and handles both outcomes with an `if`, rather than wrapping every call in a
// try/catch and hoping the thing it caught has a `.message` worth showing.
//
// ---------------------------------------------------------------------------
// Where user_id comes from, and why it is not in this file
//
// It is filled in by the database. The column carries `default auth.uid()`, so
// Postgres reads the user id out of the JWT that PostgREST attaches to the
// request and writes it itself. There is no user_id in any payload below, and
// no import of the session here.
//
// This is worth doing rather than reading session.user.id and sending it along,
// even though the insert policy — `with check (auth.uid() = user_id)` — would
// reject a mismatched id anyway. Two reasons:
//
//   The client stops being able to express the wrong thing. A user_id sent from
//   the browser is a value the browser chose, which means every insert path has
//   to be checked for having chosen it correctly, and a refactor that reads the
//   id from a stale closure produces a request the server is right to reject and
//   the user has no way to understand. A value the client cannot send is a value
//   that cannot be wrong.
//
//   Ownership ends up defined once. auth.uid() is already what all four RLS
//   policies compare against; making it the default means the value written and
//   the value checked come from the same function call on the same request,
//   rather than from two places that have to agree.
//
// The failure mode is the good one. With no valid session auth.uid() is null,
// the insert policy's `auth.uid() = user_id` evaluates to null rather than
// true, and the row is refused (42501, mapped to "your session has expired")
// instead of being quietly stored owned by nobody. The NOT NULL on the column
// is a second line behind that, never reached in practice.
//
// ---------------------------------------------------------------------------
// Units
//
// balance, credit_limit and min_due are dollar amounts. apr_pct is a percent
// written the way it is spoken: 24.99 means 24.99%. Nothing in this file, or in
// anything that reads from it, divides that by 100 — see lib/format.js.
// ===========================================================================

// The columns any card-shaped result carries. Named explicitly rather than
// select("*") so that adding a column to the table doesn't silently change what
// every screen receives, and so the payload stays as small as the UI needs.
//
// user_id is left out on purpose: row-level security means every row that comes
// back is already this user's, so returning the id would be shipping a fact the
// client has no use for.
const COLUMNS =
  "id, name, issuer, balance, apr_pct, credit_limit, min_due, due_date, created_at";

// Builds the row payload from a caller's fields, one property at a time.
//
// The explicit copy is the point. Spreading the caller's object straight into
// the request would let anything it happens to be carrying — a user_id, an id,
// a leftover form key like `confirmDelete` — travel to the database, where an
// unknown column is an error and a known one is worse. Listing the fields means
// only these fields can ever be written.
//
// Text is trimmed, and an empty issuer becomes null rather than "". The column
// is nullable precisely so "no issuer recorded" has a representation; an empty
// string would be a second way to say the same thing, and every reader would
// then have to handle both. due_date is nulled the same way, for the same
// reason — and because Postgres rejects "" as a date outright, so the empty
// string is not merely redundant here, it is an error waiting to be sent.
//
// The numeric fields are passed through as given. Callers validate before they
// get here (see components/CardForm.jsx); coercing in this layer would turn a
// blank field into a confident 0, which is a far worse outcome than the error a
// blank field earns.
function toRow(fields) {
  return {
    name: fields.name.trim(),
    issuer: fields.issuer?.trim() ? fields.issuer.trim() : null,
    balance: fields.balance,
    apr_pct: fields.apr_pct,
    credit_limit: fields.credit_limit,
    min_due: fields.min_due,
    // An <input type="date"> hands over "YYYY-MM-DD" — already the wire format
    // Postgres wants for a `date`, so there is nothing to convert. Optional, so
    // an untouched field goes across as null.
    due_date: fields.due_date?.trim() ? fields.due_date.trim() : null,
  };
}

// Every card belonging to the signed-in user.
//
// There is no user_id filter in the query, and that is not an oversight: the
// select policy adds `auth.uid() = user_id` to the statement inside Postgres,
// so the filter exists — it is just enforced somewhere the browser cannot
// remove it. A .eq("user_id", …) here would be a second copy of the same rule,
// in the one place where it guarantees nothing.
//
// Newest first, so a card just added appears at the top of the list next to the
// form that created it rather than below however many rows already exist.
export async function listCards() {
  const { data, error } = await supabase
    .from("credit_cards")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) return { cards: [], error: describeCardError(error) };

  // `data` is [] for a user with no cards — an empty list, not an error, and
  // the caller's empty state depends on being able to tell those apart.
  return { cards: data, error: null };
}

// Adds a card. See the note above on user_id: it is absent here on purpose.
//
// The insert selects the row back because the database fills in more than it
// was sent — the id, created_at, and user_id — and returning the stored row
// lets the caller add it to a list without re-fetching or guessing at values it
// does not have.
export async function createCard(fields) {
  const { data, error } = await supabase
    .from("credit_cards")
    .insert(toRow(fields))
    .select(COLUMNS)
    .single();

  if (error) return { card: null, error: describeCardError(error) };

  return { card: data, error: null };
}

// Edits one card.
//
// Same reasoning as the list: no user_id in the payload and no user_id in the
// filter. The update policy restricts the statement to rows this user owns, so
// an id belonging to someone else matches nothing — and because a Postgres
// UPDATE policy with no WITH CHECK clause reuses its USING expression for the
// new row as well, a request cannot hand a card to another user either.
//
// Matching nothing is reported rather than passed over. Without .single() an
// update that touched no rows resolves successfully with an empty array, and
// the screen would show a save that never happened; .single() turns that into
// PGRST116, which describeCardError renders as "that card isn't there any more".
export async function updateCard(id, fields) {
  const { data, error } = await supabase
    .from("credit_cards")
    .update(toRow(fields))
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) return { card: null, error: describeCardError(error) };

  return { card: data, error: null };
}

// Removes one card, permanently.
//
// The trailing select is doing the same job it does on update. A delete that
// matches no row — already gone, or never this user's — is not an error in SQL;
// it simply affects zero rows and returns 200. Asking for the deleted row back
// with .single() is what separates "removed it" from "there was nothing there",
// so the UI can say which happened instead of reporting success either way.
export async function deleteCard(id) {
  const { error } = await supabase
    .from("credit_cards")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  return { error: error ? describeCardError(error) : null };
}
