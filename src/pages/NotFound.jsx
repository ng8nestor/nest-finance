import { Link } from "react-router-dom";

// Rendered for any URL that no other route matched (the "*" route in App.jsx).
//
// <Link> instead of <a>: an <a> makes the browser throw away the page and ask
// the server for a whole new document. <Link> intercepts the click, updates the
// URL via the History API, and lets the router swap in the matching page — no
// network round trip, no full reload.
function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>That URL doesn&rsquo;t match anything here.</p>
      <Link to="/">Back home</Link>
    </main>
  );
}

export default NotFound;
