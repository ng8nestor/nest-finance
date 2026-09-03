import { Link } from "react-router-dom";
import { SITE_NAME, SITE_TAGLINE } from "../lib/site.js";
import "./Landing.css";

// The page rendered at "/" — the last stop in the chain that starts in
// index.html. A page is just a component; nothing about it is special to React
// Router. It only becomes "the page for /" because App.jsx maps it to that path.
//
// The stylesheet is imported here rather than pulled into index.css. Vite
// bundles it either way, but co-locating it means the styles for this screen
// live next to the markup they describe, and deleting the page deletes its CSS
// with it. index.css stays a reset and nothing else.
//
// The wordmark is an <img> inside the <h1> rather than a background image: it
// is the page's heading, so it needs to be real content with real alt text.
// Screen readers announce "nest, heading level 1"; a CSS background would
// announce nothing at all. The file comes from public/, which Vite copies to
// the site root untouched — hence the absolute "/brand/..." path.
function Landing() {
  return (
    <main className="landing">
      <h1 className="landing__mark">
        <img
          className="landing__wordmark"
          src="/brand/nest-name-web.png"
          alt={SITE_NAME}
        />
      </h1>
      <p className="landing__tagline">{SITE_TAGLINE}</p>

      {/* The only way into the app. <nav> rather than a bare <div>: it is a set
          of navigation links, so a screen reader can jump straight to it, and
          the aria-label distinguishes it from any other nav added later.

          Sign up carries the accent fill and log in the outlined treatment —
          the same two-tier button language used on the auth pages, so the
          weight of each control matches what it does. */}
      <nav className="landing__actions" aria-label="Account">
        <Link className="button button--secondary" to="/login">
          Log in
        </Link>
        <Link className="button button--primary" to="/signup">
          Sign up
        </Link>
      </nav>
    </main>
  );
}

export default Landing;
