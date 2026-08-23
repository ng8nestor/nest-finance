import { Link } from "react-router-dom";
import "./NotFound.css";

// Rendered for any URL that no other route matched (the "*" route in App.jsx).
//
// <Link> instead of <a>: an <a> makes the browser throw away the page and ask
// the server for a whole new document. <Link> intercepts the click, updates the
// URL via the History API, and lets the router swap in the matching page — no
// network round trip, no full reload.
function NotFound() {
  return (
    <main className="not-found">
      <p className="not-found__code">404</p>
      <h1 className="not-found__title">Page not found</h1>
      <p className="not-found__message">
        That URL doesn&rsquo;t match anything here.
      </p>
      <Link className="not-found__link" to="/">
        Back home
      </Link>
    </main>
  );
}

export default NotFound;
