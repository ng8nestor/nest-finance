## Step 0B — router shell

2026-08-15 · branch `feat/router-shell`
This is a React + Vite app in JavaScript — no TypeScript. Set up React Router with two routes: / rendering a Landing page component that displays "nest" and a short tagline, and a catch-all * rendering a NotFound page. Create src/pages/ and src/lib/ directories. Do not install or configure any additional dependencies — no Supabase, no styling libraries, no UI kits, no CSS frameworks. Do not add any styling beyond what already exists. Add a vercel.json containing an SPA rewrite so client-side routes don't 404 on a hard refresh, and explain in a comment why a static host needs that rewrite. Comment main.jsx and App.jsx so a student can follow the path from index.html → main.jsx → App.jsx → router → page.
