import { useEffect, useId, useRef, useState } from "react";

// ===========================================================================
// The form for adding a card and for editing one. Same fields, same rules, same
// component — an edit form that drifts from the create form is how a value
// becomes enterable on one screen and impossible to correct on the other.
//
// ---------------------------------------------------------------------------
// Why the values are strings
//
// Every field is held as the string the person typed, and parsed only when the
// form is checked. The alternative — parsing on each keystroke into a number —
// cannot represent the states a half-typed number passes through. "12." is not
// a number yet, and neither is "-" or "", but all three are reasonable things
// to have on screen a moment before the value is finished. Parsing early turns
// them into NaN and either erases what was typed or reports an error at someone
// still in the middle of typing it.
//
// ---------------------------------------------------------------------------
// When errors appear
//
// Not while typing. The first check happens on submit; after that, the fields
// are re-checked on every change, so a message disappears the moment its field
// is fixed rather than at the next submit.
//
// That ordering is the whole trick. Validating from the first keystroke means
// telling someone their name is required while they are still typing the first
// letter of it — a correct statement, delivered as an accusation, about a field
// they are actively filling in. Waiting until submit means the first thing they
// hear is a complete list of what is actually wrong; re-checking afterwards
// means each item goes away as it is dealt with.
// ===========================================================================

// The empty form. Also the shape everything below expects, so the fields exist
// as controlled inputs from the first render — swapping an input from undefined
// to a value is what makes React warn about a control changing from uncontrolled
// to controlled, and it loses the cursor position when it happens.
const BLANK = {
  name: "",
  issuer: "",
  balance: "",
  apr_pct: "",
  credit_limit: "",
  min_due: "",
  due_date: "",
};

// The stored row turned back into form values.
//
// Numbers become strings because that is what an input holds, and null becomes
// "" because that is how an empty text field is spelled — value={null} is the
// uncontrolled-input warning again. String() rather than toString() so a null
// balance, which should not exist but is not worth crashing over, becomes
// "null" in a field rather than an exception during render.
function toValues(card) {
  if (!card) return BLANK;

  return {
    name: card.name ?? "",
    issuer: card.issuer ?? "",
    balance: String(card.balance ?? ""),
    apr_pct: String(card.apr_pct ?? ""),
    credit_limit: String(card.credit_limit ?? ""),
    min_due: String(card.min_due ?? ""),
    // No conversion: a `date` column arrives as "YYYY-MM-DD", which is exactly
    // what <input type="date"> holds. null — a card with no due date — becomes
    // the empty field it should be.
    due_date: card.due_date ?? "",
  };
}

// A typed string as a number, or NaN if it isn't one.
//
// Number("") is 0, which is the trap this exists to avoid: an empty balance
// would otherwise validate cleanly and save as a zero the person never entered.
// An empty field means "nothing here", never "zero". The same goes for a field
// holding only spaces.
function toNumber(raw) {
  if (raw.trim() === "") return Number.NaN;
  return Number(raw);
}

// Checks the whole form and returns a message per bad field — {} when it is
// fine. Every rule here has a matching CHECK constraint on the table, and that
// duplication is intentional: the constraints are what guarantee the data, and
// these are what explain it, in time to fix it, in words about money rather
// than about SQL.
//
// The wording avoids naming the mistake ("invalid", "must satisfy") in favour
// of saying what the field can hold. Someone reading this has mistyped a number,
// not violated a rule.
//
// Not exported. This module exports a component and nothing else, which is what
// keeps Fast Refresh able to hot-swap it — see the note in context/authContext.js
// for why that rule is worth following even for a function this small.
function validate(values) {
  const errors = {};

  if (values.name.trim() === "") {
    errors.name = "Give this card a name so you can tell it apart.";
  }

  const balance = toNumber(values.balance);
  if (Number.isNaN(balance)) {
    errors.balance = "Enter the balance as a number, like 1250.40.";
  } else if (balance < 0) {
    errors.balance = "A balance can't be less than zero.";
  }

  const apr = toNumber(values.apr_pct);
  if (Number.isNaN(apr)) {
    // Said as a percent, because that is how it is written on a statement and
    // how it is stored — 24.99 for 24.99%, never 0.2499.
    errors.apr_pct = "Enter the APR as a percent, like 24.99.";
  } else if (apr < 0 || apr > 99.999) {
    errors.apr_pct = "The APR has to be between 0 and 99.999.";
  }

  const limit = toNumber(values.credit_limit);
  if (Number.isNaN(limit)) {
    errors.credit_limit = "Enter the credit limit as a number, like 5000.";
  } else if (limit <= 0) {
    errors.credit_limit = "A credit limit has to be more than zero.";
  }

  const minDue = toNumber(values.min_due);
  if (Number.isNaN(minDue)) {
    errors.min_due = "Enter the minimum payment as a number, like 35.";
  } else if (minDue < 0) {
    errors.min_due = "A minimum payment can't be less than zero.";
  }

  // The due date is optional, so an empty field is a complete answer and there
  // is nothing to check. The one rule is about what is there, not whether it is.
  //
  // A date input normally makes this unreachable — it holds "YYYY-MM-DD" or
  // nothing, with no third option. But an input type the browser does not
  // support falls back to a plain text box, and then whatever was typed is what
  // gets sent. Catching it here means that person is told what is wrong in
  // words, in place, instead of after a round trip that comes back as a
  // Postgres cast error.
  if (
    values.due_date.trim() !== "" &&
    Number.isNaN(Date.parse(values.due_date))
  ) {
    errors.due_date = "That isn't a date we can read. Write it as 2026-09-15.";
  }

  return errors;
}

// One labelled input and its error, since there are six of them and the wiring
// that makes an error reach a screen reader is easy to do five times out of six.
//
// aria-invalid marks the field as wrong, and aria-describedby ties the message
// to the input so it is read out on focus — without it the message is visible
// text sitting near a field, related only by where it happens to be on screen.
// Both are dropped, rather than set to false/"", when the field is fine.
function Field({ id, label, error, hint, children }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="card-form__field">
      <label className="card-form__label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : hint ? hintId : undefined,
      })}
      {hint && !error && (
        <p className="card-form__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="card-form__field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

// `card` present means editing that card; absent means adding a new one.
//
// onSubmit does the saving and resolves to an error sentence, or null if it
// worked. Keeping the request in the parent is what lets this component be the
// same on both paths — it knows how to collect and check a card, and nothing
// about which query that turns into.
function CardForm({ card, onSubmit, onCancel }) {
  const editing = Boolean(card);

  const [values, setValues] = useState(() => toValues(card));
  const [errors, setErrors] = useState({});
  // Until the first submit, no field is marked wrong — see the note at the top.
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The one the server sent back, as opposed to the ones found here.
  const [serverError, setServerError] = useState(null);

  // Unique per instance, so the create form and an open edit form can be on the
  // page together without two elements sharing an id — which silently breaks
  // every label/input pairing on the second one.
  const formId = useId();
  const fieldId = (name) => `${formId}-${name}`;

  // Opening this form is what moved focus off the button that opened it — that
  // button unmounts as the form appears, and a browser has nowhere to put focus
  // except back on <body>. From there the next Tab starts at the top of the
  // document, so a keyboard user's reward for opening a form is a trip through
  // the whole page to reach it.
  //
  // Focusing the first field is the answer rather than focusing the form
  // element or its heading: the form was opened in order to type in it, and the
  // first field is where typing starts. It also scrolls the form into view for
  // everyone, which is worth having on a phone where an edit form opens well
  // below the fold.
  //
  // Empty deps: on mount only. Re-running it would drag focus back to the name
  // field mid-edit on any re-render, which is the opposite of helping.
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function handleChange(name, value) {
    const next = { ...values, [name]: value };
    setValues(next);
    // Re-check only once the form has been submitted at least once: this is
    // what clears a message as its field is corrected, without raising one at
    // someone still typing.
    if (checked) setErrors(validate(next));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const found = validate(values);
    setErrors(found);
    setChecked(true);
    setServerError(null);

    // Stop here on a bad form. Nothing is sent, so nothing can half-save.
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);

    // Parsed exactly once, here, after the values are known to be numbers.
    // apr_pct goes across as typed: 24.99 stays 24.99. Nothing divides it.
    const message = await onSubmit({
      name: values.name,
      issuer: values.issuer,
      balance: Number(values.balance),
      apr_pct: Number(values.apr_pct),
      credit_limit: Number(values.credit_limit),
      min_due: Number(values.min_due),
      // Passed through as the string it is. cards.js turns an empty one into
      // null; there is no date object anywhere in this path, and so no zone for
      // one to be misread in.
      due_date: values.due_date,
    });

    if (message) {
      setServerError(message);
      setSubmitting(false);
      return;
    }

    // No cleanup on success on purpose: saving removes this form from the page,
    // so resetting state here would be tidying a component on its way out.
  }

  return (
    <form className="card-form" onSubmit={handleSubmit} noValidate>
      <h3 className="card-form__title">
        {editing ? "Edit card" : "Add a card"}
      </h3>

      <Field id={fieldId("name")} label="Name" error={errors.name}>
        {(props) => (
          <input
            {...props}
            ref={nameRef}
            className="input"
            name="name"
            type="text"
            autoComplete="off"
            value={values.name}
            onChange={(event) => handleChange("name", event.target.value)}
            disabled={submitting}
          />
        )}
      </Field>

      <Field
        id={fieldId("issuer")}
        label="Issuer"
        hint="Optional — the bank that issued the card."
        error={errors.issuer}
      >
        {(props) => (
          <input
            {...props}
            className="input"
            name="issuer"
            type="text"
            autoComplete="off"
            value={values.issuer}
            onChange={(event) => handleChange("issuer", event.target.value)}
            disabled={submitting}
          />
        )}
      </Field>

      {/* The four numbers, paired up: two amounts, then the rate and the
          payment. type="number" brings the numeric keypad on a phone and keeps
          letters out of the field; inputMode="decimal" is what actually gets
          the decimal point onto that keypad on iOS. step is what stops the
          browser rejecting cents on its own — the default step of 1 makes
          "1250.40" invalid to the browser's own validator. */}
      <div className="card-form__row">
        <Field id={fieldId("balance")} label="Balance" error={errors.balance}>
          {(props) => (
            <input
              {...props}
              className="input input--mono"
              name="balance"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={values.balance}
              onChange={(event) => handleChange("balance", event.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        <Field
          id={fieldId("credit_limit")}
          label="Credit limit"
          error={errors.credit_limit}
        >
          {(props) => (
            <input
              {...props}
              className="input input--mono"
              name="credit_limit"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={values.credit_limit}
              onChange={(event) =>
                handleChange("credit_limit", event.target.value)
              }
              disabled={submitting}
            />
          )}
        </Field>
      </div>

      <div className="card-form__row">
        <Field
          id={fieldId("apr_pct")}
          label="APR"
          hint="A percent, as written on your statement — 24.99 for 24.99%."
          error={errors.apr_pct}
        >
          {(props) => (
            <input
              {...props}
              className="input input--mono"
              name="apr_pct"
              type="number"
              inputMode="decimal"
              // Three decimals, matching numeric(6,3) on the column.
              step="0.001"
              min="0"
              max="99.999"
              value={values.apr_pct}
              onChange={(event) => handleChange("apr_pct", event.target.value)}
              disabled={submitting}
            />
          )}
        </Field>

        <Field
          id={fieldId("min_due")}
          label="Minimum due"
          error={errors.min_due}
        >
          {(props) => (
            <input
              {...props}
              className="input input--mono"
              name="min_due"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={values.min_due}
              onChange={(event) => handleChange("min_due", event.target.value)}
              disabled={submitting}
            />
          )}
        </Field>
      </div>

      {/* On its own row rather than paired with another field: there is no
          fifth number to sit beside it, and a date input stretched across the
          full width of the form would be a very large box for a very small
          value. The width is capped in the stylesheet instead. */}
      <Field
        id={fieldId("due_date")}
        label="Due date"
        hint="Optional — when the next payment is due."
        error={errors.due_date}
      >
        {(props) => (
          <input
            {...props}
            className="input input--mono card-form__input--date"
            name="due_date"
            type="date"
            value={values.due_date}
            onChange={(event) => handleChange("due_date", event.target.value)}
            disabled={submitting}
          />
        )}
      </Field>

      {serverError && (
        <p className="card-form__error" role="alert">
          {serverError}
        </p>
      )}

      <div className="card-form__actions">
        <button
          className="button button--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Saving…" : editing ? "Save changes" : "Add card"}
        </button>
        <button
          className="button button--secondary"
          type="button"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default CardForm;
