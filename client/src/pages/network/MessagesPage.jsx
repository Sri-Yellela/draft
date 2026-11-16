// ⭐ 46f (owner 11-11: "build a page for feed and messaging into the menu with their own pages and interface fully built") ·
// MESSAGES' own place, /app/messages: the conversation list (Messages · Requests · Waiting for them — live on the sync
// stream, polled as the fallback) beside the open conversation (?thread=<id>). On a phone it is one or the other.
// Behind the network switch, like D180's Network: off → "This isn't available yet." (data-network-off).
// ⛔ D60: no capsules. Colours from tokens only (NetworkPage.css).
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Inbox, Thread, useInbox } from "./MessagesPane.jsx";
import { useNetworkOn } from "./networkSwitch.js";
import "./NetworkPage.css";

function Messages() {
  const location = useLocation();
  const navigate = useNavigate();
  const open = Number(new URLSearchParams(location.search).get("thread")) || null;
  const { box, said, load } = useInbox();
  const openThread = (id) => navigate(id ? `/app/messages?thread=${id}` : "/app/messages");
  return (
    <div className={`msg-cols${open ? " msg-cols--open" : ""}`} data-messages-cols="">
      <div className="msg-cols__list"><Inbox box={box} said={said} openId={open} onOpen={openThread} /></div>
      <div className="msg-cols__thread">
        {open
          ? <Thread key={open} id={open} onBack={() => { openThread(null); load(); }} onChanged={load} />
          : <p className="net__quiet msg-cols__none" data-msg-none="">Pick a conversation, or write to a connection from <Link to="/app/network">Network</Link>.</p>}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const on = useNetworkOn();
  if (on === null) return <main className="net net--wide"><p className="net__quiet" role="status">Opening your messages…</p></main>;
  // ⭐ 46q (A222, owner 11-16): with the network switch off (A169) the page is not a place — it goes to the board.
  if (!on) return <Navigate to="/app/jobs" replace data-network-off="" />;
  return (
    <main className="net net--wide" data-messages-page="">
      <header className="net__head">
        <h1 className="net__title">Messages</h1>
        <p className="net__quiet">No AI reads your conversations unless you ask. Messages are kept sealed; people who aren't connections land in Requests.</p>
      </header>
      <Messages />
    </main>
  );
}
