// ⭐ D180 P1 (45o) · NETWORK — People: requests to you, your connections, requests you sent, people you may know, people you
// blocked. Behind the network switch (OFF by default; the server answers 404 not_available and this page says so). Messages
// (P2, MessagesPane) and the feed (P3, FeedPane — 45r) are their own tabs.
// /app/network?connect=<handle> (from a person's public page) asks before sending — never a silent request.
// ⛔ D60: no capsules. Colours from tokens only.
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";
import MessagesPane from "./MessagesPane.jsx";   // D180 P2
import FeedPane from "./FeedPane.jsx";   // D180 P3 (45r)
import "./NetworkPage.css";

function Person({ p, children }) {
  return (
    <li className="net-person" data-net-person={p.handle}>
      <span className="net-person__tile" aria-hidden="true">{String(p.name || "?").trim().charAt(0).toUpperCase()}</span>
      <span className="net-person__main">
        <a href={`/in/${encodeURIComponent(p.handle)}`} className="net-person__name">{p.name}</a>
        {(p.headline || p.label || p.why) && <span className="net-person__sub">{[p.headline, p.label, p.why].filter(Boolean).join(" · ")}</span>}
        {p.note && <span className="net-person__note">“{p.note}”</span>}
      </span>
      <span className="net-person__acts">{children}</span>
    </li>
  );
}

export default function NetworkPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [net, setNet] = useState(null);
  const [sugg, setSugg] = useState(null);
  const [off, setOff] = useState(false);
  const [said, setSaid] = useState("");
  const [asking, setAsking] = useState(null);   // { handle, relation } from ?connect=
  const [note, setNote] = useState("");
  // ⭐ D180 P2 (45o): People · Messages (?tab=messages; ?thread=<id> opens one); Message a connection from People.
  const params = new URLSearchParams(location.search);
  // ⭐ D180 P3 (45r): Feed · Messages · People (the spec's order); People stays the default address (/app/network).
  const tab = ["messages", "feed"].includes(params.get("tab")) ? params.get("tab") : "people";
  const setTab = (t) => navigate(t === "people" ? "/app/network" : `/app/network?tab=${t}`);
  const [writing, setWriting] = useState(null);   // a connection's handle
  const [draft, setDraft] = useState("");
  const writeTo = async (handle) => {
    try {
      const r = await api("/api/network/messages", { method: "POST", body: JSON.stringify({ to: handle, text: draft }) });
      setWriting(null); setDraft(""); navigate(`/app/network?tab=messages&thread=${r.threadId}`);
    } catch (e) { setSaid(e.message || "The message didn't go through."); }
  };

  const load = useCallback(async () => {
    try {
      setNet(await api("/api/network"));
      setSugg(await api("/api/network/suggestions"));
    } catch (e) { if (e?.status === 404 || /not_available/.test(String(e?.message))) setOff(true); else setSaid(e.message || "Your network couldn't load."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const connectTo = new URLSearchParams(location.search).get("connect");
  useEffect(() => {
    if (!connectTo || off) return;
    api(`/api/network/relation/${encodeURIComponent(connectTo)}`).then(r => setAsking({ handle: connectTo, relation: r.relation })).catch(() => {});
  }, [connectTo, off]);

  const act = async (handle, action, okWords) => {
    try { await api(`/api/network/${encodeURIComponent(handle)}/${action}`, { method: "POST", body: "{}" }); setSaid(okWords); load(); }
    catch (e) { setSaid(e.message || "That didn't go through."); }
  };
  const request = async (handle, withNote = null) => {
    try {
      await api("/api/network/request", { method: "POST", body: JSON.stringify({ handle, note: withNote }) });
      setSaid("Request sent."); setAsking(null); setNote("");
      if (connectTo) navigate("/app/network", { replace: true });
      load();
    } catch (e) { setSaid(e.message || "The request didn't go through."); }
  };

  if (off) return (
    <main className="net" data-network-off="">
      <h1 className="net__title">Network</h1>
      <p className="net__quiet">This isn't available yet.</p>
    </main>
  );
  if (!net) return <main className="net"><p className="net__quiet" role="status">{said || "Opening your network…"}</p></main>;

  return (
    <main className="net" data-network-page="">
      <header className="net__head">
        <h1 className="net__title">Network</h1>
        <p className="net__quiet">People you know on draft. A request stays a request until they accept; you can block anyone, any time.</p>
      </header>
      {said && <p className="net__said" role="status">{said}</p>}
      <div className="net__tabs" role="tablist" aria-label="Network" data-net-tabs="">
        <button type="button" role="tab" aria-selected={tab === "feed"} onClick={() => setTab("feed")}>Feed</button>
        <button type="button" role="tab" aria-selected={tab === "messages"} onClick={() => setTab("messages")}>Messages</button>
        <button type="button" role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")}>People</button>
      </div>
      {tab === "feed" && <FeedPane />}
      {tab === "messages" &&<MessagesPane key={params.get("thread") || "list"} initialThread={params.get("thread") ? Number(params.get("thread")) : null} />}
      {tab === "people" && <>

      {asking && (
        <section className="net__sec net__ask" data-net-ask={asking.handle}>
          {asking.relation === "none" ? (
            <>
              <h2>Connect with {asking.handle}?</h2>
              <input className="net__note" value={note} maxLength={300} onChange={e => setNote(e.target.value)} placeholder="A note (optional)" aria-label="A note with your request" />
              <div className="net__row">
                <DepthButton primary onClick={() => request(asking.handle, note || null)}>Send request</DepthButton>
                <DepthButton onClick={() => { setAsking(null); navigate("/app/network", { replace: true }); }}>Not now</DepthButton>
              </div>
            </>
          ) : <p className="net__quiet">{({ self: "That's your own page.", connected: "You're already connected.", requested: "Your request is waiting.",
            incoming: "They've asked you — see Requests below.", blocked: "You can't connect with this person." })[asking.relation] || ""}</p>}
        </section>
      )}

      {net.incoming.length > 0 && (
        <section className="net__sec" data-net-incoming="">
          <h2>Requests · {net.incoming.length}</h2>
          <ul className="net__list">{net.incoming.map(p => (
            <Person key={p.handle} p={p}>
              <DepthButton primary onClick={() => act(p.handle, "accept", "Connected.")}>Accept</DepthButton>
              <DepthButton onClick={() => act(p.handle, "decline", "Declined — they aren't told.")}>Decline</DepthButton>
              <DepthButton onClick={() => act(p.handle, "block", "Blocked.")}>Block</DepthButton>
            </Person>))}</ul>
        </section>
      )}

      <section className="net__sec" data-net-connections="">
        <h2>Connections · {net.connections.length}</h2>
        {net.connections.length === 0 ? <p className="net__quiet">No connections yet. People you may know are below, and anyone's public page has Connect.</p> : (
          <ul className="net__list">{net.connections.map(p => (
            <Person key={p.handle} p={p}>
              <DepthButton primary onClick={() => { setWriting(p.handle); setDraft(""); }}>Message</DepthButton>
              <DepthButton onClick={() => act(p.handle, "remove", "Removed.")}>Remove</DepthButton>
              <DepthButton onClick={() => act(p.handle, "block", "Blocked.")}>Block</DepthButton>
            </Person>))}</ul>
        )}
      </section>

      {net.outgoing.length > 0 && (
        <section className="net__sec" data-net-outgoing="">
          <h2>Sent · {net.outgoing.length}</h2>
          <ul className="net__list">{net.outgoing.map(p => (
            <Person key={p.handle} p={p}><DepthButton onClick={() => act(p.handle, "withdraw", "Withdrawn.")}>Withdraw</DepthButton></Person>))}</ul>
        </section>
      )}

      <section className="net__sec" data-net-suggestions="">
        <h2>People you may know</h2>
        {sugg?.why && <p className="net__quiet">{sugg.why}</p>}
        {sugg && !sugg.why && sugg.people.length === 0 && <p className="net__quiet">No one yet — only people whose page is public are suggested.</p>}
        {sugg?.people?.length > 0 && (
          <ul className="net__list">{sugg.people.map(p => (
            <Person key={p.handle} p={p}><DepthButton onClick={() => request(p.handle)}>Connect</DepthButton></Person>))}</ul>
        )}
        <p className="net__quiet">Suggestions come only from public pages that share your workplace or school — never from an address book.</p>
      </section>
      {writing && (
        <section className="net__sec" data-net-writing={writing}>
          <h2>Message {writing}</h2>
          <textarea className="net__note" rows={3} maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message" aria-label="Write a message" />
          <div className="net__row"><DepthButton primary onClick={() => writeTo(writing)}>Send</DepthButton><DepthButton onClick={() => setWriting(null)}>Cancel</DepthButton></div>
        </section>
      )}

      {net.blocked.length > 0 && (
        <section className="net__sec" data-net-blocked="">
          <h2>Blocked · {net.blocked.length}</h2>
          <ul className="net__list">{net.blocked.map(p => (
            <Person key={p.handle} p={p}><DepthButton onClick={() => act(p.handle, "unblock", "Unblocked.")}>Unblock</DepthButton></Person>))}</ul>
        </section>
      )}
      </>}
    </main>
  );
}
