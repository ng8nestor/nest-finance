import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
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
// AuthProvider sits inside BrowserRouter, not outside it. The provider itself
// needs no router, but keeping the router as the outermost wrapper means
// anything the auth layer grows later — redirecting after a token expires, say
// — can reach the navigation hooks. Nesting it the other way would put the
// provider above the router and cut it off from them.
//
// It wraps Routes rather than being placed on individual pages so that exactly
// one provider exists for the app's lifetime. A provider per route would be
// destroyed and rebuilt on every navigation, which means unsubscribing and
// resubscribing to auth changes — and a fresh `loading: true` each time, so
// every page transition would start by not knowing who is signed in.
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* The app shell: a single column holding the header and, beneath it,
            whichever page the router resolved to. It is what owns the viewport
            height now — see the note on .app in index.css for why that moved off
            the individual pages the moment a header appeared above them. */}
        <div className="app">
          {/* Outside Routes, so it is one element that persists across every
              navigation rather than four copies that each mount and unmount
              with the page under them. It reads the current path itself to stay
              off the landing page — see the note in the component. */}
          <SiteHeader />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            {/* The gate goes here, in the route table, rather than inside
                Dashboard itself. It keeps the rule visible in the one place
                someone looks to find out what the app's URLs do, and it means
                Dashboard never renders at all for a signed-out visitor — not
                even for the frame before a check inside it could redirect. */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
