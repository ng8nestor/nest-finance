## Step 0B — router shell

2026-08-15 · branch `feat/router-shell`

> This is a React + Vite app in JavaScript — no TypeScript. Set up React Router with two routes: / rendering a Landing page component that displays "nest" and a short tagline, and a catch-all * rendering a NotFound page. Create src/pages/ and src/lib/ directories. Do not install or configure any additional dependencies — no Supabase, no styling libraries, no UI kits, no CSS frameworks. Do not add any styling beyond what already exists. Add a vercel.json containing an SPA rewrite so client-side routes don't 404 on a hard refresh, and explain in a comment why a static host needs that rewrite. Comment main.jsx and App.jsx so a student can follow the path from index.html → main.jsx → App.jsx → router → page.

## Step 1 — design tokens

2026-08-23 · branch `feat/design-tokens`

> Create src/styles/tokens.css defining our design system as CSS custom properties on :root, and import it once in main.jsx. Replace src/index.css with a minimal reset that consumes these tokens. Comment each group explaining the choice.
>
> Colors: --bg: #0a0a0c, --surface-1: #121216, --surface-2: #1A1A20, --surface-raised: #24242B, --border: rgba(236,231,222,0.09), --text: #ECE7DE, --text-secondary: rgba(236,231,222,0.64), --text-muted: rgba(236,231,222,0.40), --debt: #F26749, --progress: #5FC08A, --goal: #E0A24E, --info: #6C9BF0.
>
> Type: --font-ui: Nunito, --font-mono: "DM Mono", each with system fallbacks. Sizes: --text-caption: 12px, --text-label: 14px, --text-body: 16px, --text-h3: 20px, --text-h2: 24px, --text-h1: 32px, --text-display: 48px. Line heights: body 1.6, h1 1.2, display 1.0.
>
> Spacing on a 4px base: --space-1 through --space-9 with values 4, 8, 12, 16, 24, 32, 48, 64, 96.
>
> Radius: --radius-sm: 8px, --radius-md: 12px, --radius-lg: 16px, --radius-xl: 24px, --radius-full: 999px.
>
> Motion: --dur-fast: 120ms, --dur-base: 200ms, --dur-slow: 320ms, --ease: cubic-bezier(0.2, 0.8, 0.2, 1). Add a global prefers-reduced-motion: reduce rule that disables animations and transitions.
>
> Load Nunito (400, 500, 600, 700) and DM Mono (400, 500) from Google Fonts in index.html with preconnect hints and display=swap.
>
> Then restyle the Landing and NotFound pages using only these tokens — no hardcoded colors or pixel values anywhere in component CSS. Set public/brand/nest-logo-minimal-transparent.png as the favicon in index.html. On the Landing page, show public/brand/nest-name-transparent.png as the wordmark with the tagline beneath it. Keep both pages simple and centered.
>
> Do not install any dependencies. Do not add Supabase, auth, or any CSS framework.

## Step 1B — brand assets, border token

2026-08-23 · branch `feat/design-tokens`

> Update index.html to use /brand/nest-favicon.png as the favicon, and Landing.jsx to use /brand/nest-name-web.png for the wordmark. Also, in NotFound.css, replace calc(var(--space-1) / 4) with a new --border-width: 1px token added to tokens.css.

## Step 2 — email authentication

2026-08-29 · branch `feat/auth`

> Connect this app to Supabase and add email authentication. Read the credentials from the existing .env.local — do not hardcode them.
>
> Install @supabase/supabase-js. Create src/lib/supabase.js exporting a single configured client, reading VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from import.meta.env.
>
> Create an auth context in src/context/AuthContext.jsx that holds the current session, subscribes to onAuthStateChange, exposes user, session, loading, signUp, signIn, and signOut, and cleans up its subscription on unmount. Wrap the app in it.
>
> Add three routes: /signup, /login, and /dashboard. Signup and login are email-and-password forms with proper labels, real loading states on submit, and inline error messages in plain language — never a raw Supabase error string. Dashboard shows the logged-in user's email and a sign-out button.
>
> Create a ProtectedRoute component that redirects to /login when there's no session, and renders nothing while the session is still loading — not a redirect, since redirecting during the loading state would kick out users who are actually signed in. Wrap /dashboard in it.
>
> Style everything with the existing tokens only. No hardcoded colors or pixel values.
>
> Comment the auth context and ProtectedRoute thoroughly — explain what a session is, where it's stored, and how the app knows the user is signed in after a page refresh.
>
> Do not create any database tables, do not add card CRUD, and do not add password reset or OAuth providers.

## Step 2B — danger tokens, hook split

2026-08-29 · branch `feat/auth`

> Add --danger: #F26749 and --danger-bg: rgba(242, 103, 73, 0.12) to tokens.css in a new semantic group, with a comment explaining that it shares a hex with --debt deliberately but means "something went wrong" rather than "this is debt" — so the two can diverge later without hunting through components. Apply --danger to the auth form error text and --danger-bg to its container background. Keep role="alert".
>
> Move the useAuth hook out of AuthContext.jsx into src/hooks/useAuth.js and remove the eslint-disable. Update all imports.
>
> Add "Log in" and "Sign up" links to the Landing page beneath the tagline, styled with existing tokens.

## Step 2C — sign-in copy

2026-08-29 · branch `feat/auth`

> tandardize all sign-in language to "Log in". Update the Login page heading to "Log in to nest" and its submit button to "Log in". Leave signup wording as is.

## Step 3 — credit card CRUD

2026-09-01 · branch `feat/card-crud`

> Build credit card CRUD against the existing credit_cards table in Supabase. The table has: id, user_id, name, issuer, balance, apr_pct, credit_limit, min_due, due_date, created_at. Row-level security is already enabled with policies matching auth.uid() = user_id.
>
> Create src/lib/cards.js with functions to list, create, update, and delete cards. Never send user_id from the client on insert — set a database default of auth.uid() instead, or explain why that isn't possible here and set it from the session.
>
> On /dashboard, show the user's cards as a list. Each card displays name, issuer, balance, APR, credit limit, and minimum due. Numbers use --font-mono; currency is formatted with Intl.NumberFormat, not string concatenation. Empty state is an invitation to add the first card, not an apology.
>
> Add a form to create a card, and edit and delete actions on each existing one. Delete asks for confirmation first. Validate in the form: name required, balance and minimum due at least 0, credit limit above 0, APR between 0 and 99.999. Show inline errors in plain language.
>
> Handle three states explicitly and visibly: loading, error, and empty. Errors from Supabase get mapped to plain language, same pattern as authErrors.js.
>
> APR is stored as a percent number — 24.99 means 24.99%. Never divide by 100 anywhere in a component.
>
> Style with existing tokens only. No new dependencies. Do not build the dashboard metrics, utilization, the bleed meter, avalanche/snowball, or the simulator — those are later steps.

## Step 3B — due date

2026-09-01 · branch `feat/card-crud`

> Add due_date to the card form as an optional date input, display it on each card, and include it in create and edit. Format it for display with Intl.DateTimeFormat, not string slicing. It stays nullable — a card with no due date shows nothing rather than a placeholder.

## Step 4 — debt command center

2026-09-01 · branch `feat/debt-command-center`

> Build the Debt Command Center on /dashboard, above the existing card list. Create src/lib/finance.js holding every calculation as a pure function — no React, no Supabase, just numbers in and numbers out. Components import from it and never do arithmetic inline.
>
> The functions:
>
> ```
> monthlyInterest(card) = balance * (apr_pct / 100 / 12), rounded to cents. This is the only place in the codebase that divides by 100.
> totalMonthlyBleed(cards) = sum of monthlyInterest across all cards.
> annualBleed(cards) = totalMonthlyBleed * 12.
> cardUtilization(card) = balance / credit_limit.
> overallUtilization(cards) = sum(balances) / sum(credit_limits).
> balanceGrowsFlag(card) = monthlyInterest(card) > min_due.
> ```
>
> Guard every division against a zero or missing denominator — return null, not NaN or Infinity, and let the UI decide what to show.
>
> The display, in this order of visual weight:
>
> One, the bleed meter as the single focal element. Monthly total in --text-display, DM Mono, --debt, with the annual figure beneath it in a smaller size. Label it in plain language — this is money leaving, not a statistic. Animate it counting up on load over roughly 1200ms with --ease. This is the only animation in the app. Under prefers-reduced-motion: reduce the final value renders immediately with no count.
>
> Two, overall utilization as a percentage with a progress bar. Above 30% uses --debt; at or below uses --progress. Show the 30% threshold on the bar.
>
> Three, per-card utilization on each existing card in the list, same color rule.
>
> Four, on any card where balanceGrowsFlag is true, a flag reading that the minimum payment doesn't cover the monthly interest, so the balance grows even when paid on time. Use --danger styling and make it a badge on the card, not a separate section.
>
> Empty state: with no cards, show an invitation to add one rather than a row of zeros.
>
> Tokens only. No new dependencies. Do not build avalanche/snowball ordering or the payoff simulator — those are Steps 5 and 6.
