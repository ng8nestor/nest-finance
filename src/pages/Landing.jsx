import { SITE_NAME, SITE_TAGLINE } from "../lib/site.js";

// The page rendered at "/" — the last stop in the chain that starts in
// index.html. A page is just a component; nothing about it is special to React
// Router. It only becomes "the page for /" because App.jsx maps it to that path.
function Landing() {
  return (
    <main>
      <h1>{SITE_NAME}</h1>
      <p>{SITE_TAGLINE}</p>
    </main>
  );
}

export default Landing;
