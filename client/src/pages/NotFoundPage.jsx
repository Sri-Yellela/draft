// ⭐ D197 Wave 2 #22 · M5 (47m, lane public) · THE 404 — "Off the map" (the approved mock `off-the-map`, docs/revamp/
// errors.md §1 + §5): the public nav, the edge of the known map, the status kept in words (404 · NO PAGE AT [the path]), ONE
// way back as the page's clay point (Back to the front door → /), and two other roads (Open jobs, Atlas). Every mount keeps
// its meaning: the catch-all signed out, /pricing with the lever off ("off means absent" — it answers as any unknown path),
// a bad / reserved /<company>, a non-numeric /<company>/<id>. (A client-drawn page is a soft 404 for crawlers; the server's
// own 404s keep their real status — services/publicChrome.js.) Signed in, unknown paths still go to /app (App.jsx).
import { useLocation } from "react-router-dom";
import { OffTheMap } from "../plate/PublicPages.jsx";
import { PublicPage, usePublicGo } from "../components/PublicChrome.jsx";

export default function NotFoundPage() {
  const { pathname } = useLocation();
  const go = usePublicGo();
  const where = String(pathname || "/").slice(0, 60).toUpperCase();
  return (
    <PublicPage region="I" clay={false} data-not-found="">
      <OffTheMap onGo={go}
        kicker={["404", `NO PAGE AT ${where}`]}
        title="Off the map"
        lead="There's no page at this address — it may have moved, or the link was mistyped."
        back={{ title: "Back to the front door", go: "Go →", href: "/" }}
        roads={[
          { kicker: "THE MARKET", title: "Open jobs", line: "Every job on draft, open to read.", go: "Browse →", href: "/jobs" },
          { kicker: "ATLAS · VOL. I", title: "Atlas", line: "The skills each role asks for, drawn as a map you walk.", go: "Open Atlas →", href: "/atlas" },
        ]}/>
    </PublicPage>
  );
}
