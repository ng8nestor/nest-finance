import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import NotFound from "./pages/NotFound.jsx";

// ---------------------------------------------------------------------------
// Why the project needs vercel.json
//
// These routes exist only in JavaScript, in the browser, after main.jsx has run.
// The server hosting this app knows nothing about them — the build output is
// just index.html plus some JS and CSS files. There is no /about.html on disk.
//
// In-app navigation works because <Link> never asks the server for anything: it
// rewrites the URL locally and Routes re-renders. But a hard refresh (or pasting
// a URL, or a bookmark) sends a real GET /some/route to the static host. The
// host looks for a file at that path, finds nothing, and returns its own 404 —
// our JS never loads, so the router never gets a chance to handle it.
//
// vercel.json fixes that by rewriting every request to /index.html, so any URL
// serves the same app shell, main.jsx runs, and the router resolves the path on
// the client. Unmatched paths then land on the "*" route below — a real 404 page
// rendered by us instead of by the host. The rewrite doesn't shadow real files:
// existing static assets are served first, so the JS and CSS bundles still load.
//
// (The explanation lives here rather than in vercel.json itself because Vercel
// parses that file as strict JSON — comments and unknown keys fail the build.)
// ---------------------------------------------------------------------------

// Step 3 of 4: App is the router shell. It renders no UI of its own — its whole
// job is to look at the current URL and decide which page component to show.
//
// The three pieces:
//
//   BrowserRouter  Watches the address bar (via the browser History API) and
//                  makes the current URL available to everything inside it.
//   Routes         Looks at all the <Route> children and picks the ONE best
//                  match for the current URL. Only that one renders.
//   Route          A single mapping: this path -> this component.
//
// "*" is the catch-all. Routes prefers the most specific match, so "/" wins on
// the home page and "*" only takes over when nothing else matched — that makes
// it the 404. Add new routes above it; order in the file doesn't matter, but
// keeping "*" last matches how people read it.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
