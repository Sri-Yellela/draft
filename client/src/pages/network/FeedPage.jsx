// ⭐ 46f (owner 11-11: "build a page for feed and messaging into the menu with their own pages and interface fully built") ·
// THE FEED's own place, /app/feed: the posts column (FeedPane — the composer, my posts and my connections', newest first,
// Helpful, comments, report / delete) beside a side column (What you share).
// Behind the network switch, like D180's Network: off → straight to the board, /app/jobs (46q A222).
// ⭐ D197 Wave 2 #14 · M5 (47m, lane public — the approved mock `network`, Dispatches): the Correspondence frame (Region VI,
// "Your correspondence", the page's own line kept), 03 Dispatches with the notice board of field reports (ported from the
// approved Drawings sheet) in the side column above What you share. ⚠ agent's pick (owner may reverse; network.md §3 asked
// "strike or keep"): the side card *Your people* is struck — the area nav's People · Dispatches · Letters now carries
// exactly its two links, so nothing is lost.
import { Navigate } from "react-router-dom";
import FeedPane, { WhatYouShare } from "./FeedPane.jsx";
import { useNetworkOn } from "./networkSwitch.js";
import { LegHeader } from "../../plate/Plates.jsx";
import NoticeBoardReports from "../../plate/drawings/NoticeBoardReports.jsx";
import { CorrespondenceFrame, CorrespondenceLoading } from "./CorrespondenceFrame.jsx";

export default function FeedPage() {
  const on = useNetworkOn();
  if (on === null) return <CorrespondenceLoading view="Dispatches" words="Opening your feed…"/>;
  // ⭐ 46q (A222, owner 11-16): with the network switch off (A169) the page is not a place — it goes to the board.
  if (!on) return <Navigate to="/app/jobs" replace data-network-off="" />;
  return (
    <CorrespondenceFrame view="Dispatches" data-feed-page="" line="What your connections share, newest first — never ranked, and no AI reads it.">
      <section aria-labelledby="nw-disp">
        <LegHeader n={1} id="nw-disp" meta="NEWEST FIRST · NEVER RANKED · NO AI READS IT" title="Dispatches"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "999 1 520px", minWidth: 0 }}><FeedPane share={false} /></div>
          <aside style={{ flex: "1 1 250px", maxWidth: 360, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }} aria-label="About your feed">
            <div className="pl-platehero"><div className="pl-platehero__frame" style={{ "--pl-aspect": "360 / 220" }}><NoticeBoardReports/></div></div>
            <WhatYouShare />
          </aside>
        </div>
      </section>
    </CorrespondenceFrame>
  );
}
