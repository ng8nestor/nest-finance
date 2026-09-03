import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Order matters, and it is the cascade's order, not an alphabetical one.
//
//   tokens.css    first, because everything below reads the custom properties
//                 it defines and a var() cannot resolve against a declaration
//                 that has not been parsed yet.
//   index.css     the reset and the app shell.
//   controls.css  the shared .button and .input primitives. After the reset so
//                 it can build on it, and before any component stylesheet so a
//                 component can still override one of its values by naming it —
//                 the two selectors carry the same specificity, so the later
//                 one wins and "later" is decided right here.
import "./styles/tokens.css";
import "./index.css";
import "./styles/controls.css";
import App from "./App.jsx";

// Step 2 of 4: this file is the entry point — the bridge from plain HTML to React.
//
// How we got here: the browser loads index.html, which contains an empty
// <div id="root"></div> and one <script type="module" src="/src/main.jsx">.
// Loading that script runs the code below.
//
// createRoot() hands React that empty div and .render() fills it with <App />.
// From this point on, everything on the page is drawn by React — index.html is
// never touched again, which is exactly what makes this a single-page app.
//
// StrictMode is a development-only helper. It renders components twice on purpose
// to surface bugs from impure render logic. It disappears in production builds.
//
// Next stop: App.jsx, which decides what to show based on the URL.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
