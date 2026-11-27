// ⭐ 46f (owner 11-11: "build a page for feed and messaging into the menu with their own pages and interface fully built") ·
// MESSAGES' own place, /app/messages: the conversation list (Messages · Requests · Waiting for them — live on the sync
// stream, polled as the fallback) beside the open conversation (?thread=<id>). On a phone it is one or the other.
// Behind the network switch, like D180's Network: off → straight to the board, /app/jobs (46q A222).
// ⭐ D197 Wave 2 #14 · M5 (47m, lane public — the approved mock `network`, Letters): the Correspondence frame (Region VI), 04
// Letters: the letter list left, the open correspondence right (one at a time below 980 px, ?thread=<id> kept); nothing open
// → the drawer with the same words and its link; the post rack of letters (ported from the approved Drawings sheet) above
// the list while nothing is open.
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Inbox, Thread, useInbox } from "./MessagesPane.jsx";
import { useNetworkOn } from "./networkSwitch.js";
import { LegHeader } from "../../plate/Plates.jsx";
import { Drawer } from "../../plate/PlateState.jsx";
import LettersPostRack from "../../plate/drawings/LettersPostRack.jsx";
import { useViewport } from "../../hooks/useViewport.js";
import { CorrespondenceFrame, CorrespondenceLoading } from "./CorrespondenceFrame.jsx";

function Messages() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = useViewport().w < 980;   // the shell's phone width (one at a time below 980 px)
  const open = Number(new URLSearchParams(location.search).get("thread")) || null;
  const { box, said, load } = useInbox();
  const openThread = (id) => navigate(id ? `/app/messages?thread=${id}` : "/app/messages");
  return (
    <div data-messages-cols="" data-open={open ? "true" : "false"} style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" }}>
      {!phone || !open ? (
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          {!open ? <div className="pl-platehero"><div className="pl-platehero__frame" style={{ "--pl-aspect": "360 / 220" }}><LettersPostRack/></div></div> : null}
          <Inbox box={box} said={said} openId={open} onOpen={openThread} />
        </div>
      ) : null}
      {!phone || open ? (
        <div style={{ flex: "999 1 480px", minWidth: 0 }}>
          {open
            ? <Thread key={open} id={open} onBack={() => { openThread(null); load(); }} onChanged={load} />
            : <Drawer kicker="NOTHING OPEN" data-msg-none="">Pick a conversation, or write to a connection from <Link to="/app/network">Network</Link>.</Drawer>}
        </div>
      ) : null}
    </div>
  );
}

export default function MessagesPage() {
  const on = useNetworkOn();
  if (on === null) return <CorrespondenceLoading view="Letters" words="Opening your messages…"/>;
  // ⭐ 46q (A222, owner 11-16): with the network switch off (A169) the page is not a place — it goes to the board.
  if (!on) return <Navigate to="/app/jobs" replace data-network-off="" />;
  return (
    <CorrespondenceFrame view="Letters" data-messages-page=""
      line="No AI reads your conversations unless you ask. Messages are kept sealed; people who aren't connections land in Requests.">
      <section aria-labelledby="nw-let">
        <LegHeader n={1} id="nw-let" meta="SEALED · A STRANGER'S LINK IS NEVER CLICKABLE" title="Letters"/>
        <div style={{ marginTop: 16 }}><Messages /></div>
      </section>
    </CorrespondenceFrame>
  );
}
