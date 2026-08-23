import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// tokens.css must come first: index.css and every page stylesheet read the
// custom properties it defines, so it has to be in the cascade before them.
import "./styles/tokens.css";
import "./index.css";
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
