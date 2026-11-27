// ⭐ D180 P1 (45o) · NETWORK — People: requests to you, your connections, requests you sent, people you may know, people you
// blocked. Behind the network switch (OFF by default; the server answers 404 not_available and this page says so).
// ⭐ 46f: Messages (/app/messages, MessagesPage) and the feed (/app/feed, FeedPage) are their own places in the dock now.
// /app/network?connect=<handle> (from a person's public page) asks before sending — never a silent request.
// ⛔ D60: no capsules. Colours from tokens only.
import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import { LegHeader } from "../../plate/Plates.jsx";
import { Gazetteer } from "../../plate/Lists.jsx";
import { StatusTag } from "../../plate/Marks.jsx";

import { Drawer } from "../../plate/PlateState.jsx";
import { PersonName, SendTicket } from "../../plate/Correspondence.jsx";
import SealedLetterDoorstep from "../../plate/drawings/SealedLetterDoorstep.jsx";
import CampsGazetteer from "../../plate/drawings/CampsGazetteer.jsx";
import { CorrespondenceFrame, CorrespondenceLoading } from "./CorrespondenceFrame.jsx";

// ⭐ D197 Wave 2 #14 · M5 (47m, lane public — the approved mock `network`, People): every row of network.md §2 has its home —
// the ask card (?connect=) as a Send ticket at the top, the composer (?message=, Message) as the Send ticket, the requests /
// your people / asked, waiting / maybe you know / blocked as Gazetteers (NAME · WHO · ACT); the status words verbatim; the
// footnote "never from an address book" kept on screen. A person row keeps its hook (data-net-person).
const who = (p) => [p.headline, p.label, p.why].filter(Boolean).join(" · ") || "—";
const nameCol = { key: "title", label: "NAME", render: (r) => <PersonName name={r.title} href={`/in/${encodeURIComponent(r.handle)}`}/> };
const rowsOf = (list) => list.map((p) => ({ ...p, id: p.handle, title: p.name, who: who(p), note: p.note ? `“${p.note}”` : "—" }));
const btn = (label, onClick, kind = "paper") => <button key={label} type="button" className={`pl-btn pl-btn--${kind}`} onClick={onClick}>{label}</button>;
const acts = (...nodes) => <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>{nodes}</span>;
const personRow = (r) => ({ "data-net-person": r.handle });

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
  // ⭐ 46f (owner 11-11): Feed and Messages are their own places now (/app/feed, /app/messages); Network is People. An old
  // address (?tab=feed, ?tab=messages[&thread=<id>] — notifications, bookmarks) lands on the new page.
  const oldTab = params.get("tab");
  useEffect(() => {
    if (oldTab === "feed") navigate("/app/feed", { replace: true });
    else if (oldTab === "messages") navigate(params.get("thread") ? `/app/messages?thread=${encodeURIComponent(params.get("thread"))}` : "/app/messages", { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldTab]);
  const [writing, setWriting] = useState(null);   // a connection's handle
  const [draft, setDraft] = useState("");
  const writeTo = async (handle) => {
    try {
      const r = await api("/api/network/messages", { method: "POST", body: JSON.stringify({ to: handle, text: draft }) });
      setWriting(null); setDraft(""); navigate(`/app/messages?thread=${r.threadId}`);
    } catch (e) { setSaid(e.message || "The message didn't go through."); }
  };

  const load = useCallback(async () => {
    try {
      setNet(await api("/api/network"));
      setSugg(await api("/api/network/suggestions"));
    } catch (e) { if (e?.status === 404 || /not_available/.test(String(e?.message))) setOff(true); else setSaid(e.message || "Your network couldn't load."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ⭐ D183 P4 (46a): /app/network?message=<handle> (the public page's Message) opens the composer for that person — the
  // server decides: a connection gets the conversation, anyone else a message REQUEST (capped a day, never past a block).
  const messageTo = new URLSearchParams(location.search).get("message");
  useEffect(() => { if (messageTo && !off) setWriting(messageTo); }, [messageTo, off]);
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

  // ⭐ 46q (A222, owner 11-16): with the network switch off (A169) the page is not a place — it goes to the board.
  if (off) return <Navigate to="/app/jobs" replace data-network-off="" />;
  if (!net) return <CorrespondenceLoading view="People" words={said || "Opening your network…"}/>;
  const connected = (net.connections || []).some((c) => c.handle === writing);
  // the page's ONE clay point: a request waiting on you (Accept); with none, the open Send ticket's Send (network.md §6)
  const requestWaiting = net.incoming.length > 0;

  return (
    <CorrespondenceFrame view="People" data-network-page="" said={said}
      line="People you know on draft. A request stays a request until they accept; you can block anyone, any time.">
      {asking && (
        <section data-net-ask={asking.handle}>
          {asking.relation === "none" ? (
            <SendTicket kicker={`A REQUEST · TO ${String(asking.handle).toUpperCase()}`} to={`Connect with ${asking.handle}?`} rows={2} maxLength={300}
              placeholder="A note (optional)" value={note} onChange={setNote} send="Send request" clay={!requestWaiting}
              onSend={() => request(asking.handle, note || null)} onCancel={() => { setAsking(null); navigate("/app/network", { replace: true }); }}/>
          ) : <Drawer kicker="A REQUEST" text={({ self: "That's your own page.", connected: "You're already connected.", requested: "Your request is waiting.",
            incoming: "They've asked you — see Requests below.", blocked: "You can't connect with this person." })[asking.relation] || ""}/>}
        </section>
      )}

      {writing && (
        <section data-net-writing={writing}>
          <SendTicket kicker={`A LETTER · TO ${String(writing).toUpperCase()}`} to={`Message ${writing}`} maxLength={4000}
            note={!connected ? <span data-net-writing-request="">You aren't connected — this arrives as a message request they can accept or decline.</span> : null}
            value={draft} onChange={setDraft} clay={!requestWaiting} onSend={() => writeTo(writing)} onCancel={() => setWriting(null)}/>
        </section>
      )}

      {net.incoming.length > 0 && (
        <section aria-labelledby="nw-req" data-net-incoming="">
          <LegHeader n={1} id="nw-req" meta="A REQUEST STAYS A REQUEST UNTIL YOU ACCEPT · THEY AREN'T TOLD IF YOU DECLINE" title={`Waiting on you · ${net.incoming.length}`}/>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 260px", minWidth: 0 }} className="pl-platehero">
              <div className="pl-platehero__frame" style={{ "--pl-aspect": "360 / 220" }}><SealedLetterDoorstep/></div>
            </div>
            <div style={{ flex: "999 1 520px", minWidth: 0 }}>
              <Gazetteer label="Requests" rowProps={personRow} rows={rowsOf(net.incoming)}
                cols={[nameCol, { key: "who", label: "WHO" }, { key: "note", label: "THEIR NOTE" }, { key: "s", label: "", render: () => <StatusTag>WAITING ON YOU</StatusTag> },
                  { key: "a", label: "", render: (p) => acts(btn("Accept", () => act(p.handle, "accept", "Connected."), "primary"),
                    btn("Decline", () => act(p.handle, "decline", "Declined — they aren't told.")), btn("Block", () => act(p.handle, "block", "Blocked."))) }]}/>
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="nw-people" data-net-connections="">
        <LegHeader n={net.incoming.length ? 2 : 1} id="nw-people" meta={`YOUR PEOPLE · ${net.connections.length} CONNECTION${net.connections.length === 1 ? "" : "S"} · ANYONE'S PUBLIC PAGE HAS CONNECT`} title="The gazetteer of people"/>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginTop: 16, alignItems: "flex-start" }}>
          <div style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
            {net.connections.length === 0
              ? <Drawer kicker="NOT YET" text="No connections yet. People you may know are below, and anyone's public page has Connect."/>
              : <Gazetteer label={`Your people · ${net.connections.length}`} rowProps={personRow} rows={rowsOf(net.connections)}
                  cols={[nameCol, { key: "who", label: "WHERE THEY ARE" },
                    { key: "a", label: "", render: (p) => acts(btn("Message", () => { setWriting(p.handle); setDraft(""); }, "ink"),
                      btn("Remove", () => act(p.handle, "remove", "Removed.")), btn("Block", () => act(p.handle, "block", "Blocked."))) }]}/>}
            {net.outgoing.length > 0 && (
              <div data-net-outgoing="">
                <Gazetteer label={`Asked, waiting · ${net.outgoing.length}`} rowProps={personRow} rows={rowsOf(net.outgoing)}
                  cols={[nameCol, { key: "who", label: "WHO" }, { key: "a", label: "", render: (p) => btn("Withdraw", () => act(p.handle, "withdraw", "Withdrawn.")) }]}/>
              </div>
            )}
            <div data-net-suggestions="" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="pl-label">MAYBE YOU KNOW</span>
              {sugg?.why && <p className="pl-body pl-muted">{sugg.why}</p>}
              {sugg && !sugg.why && sugg.people.length === 0 && <Drawer kicker="NOT YET" text="No one yet — only people whose page is public are suggested."/>}
              {sugg?.people?.length > 0 && (
                <Gazetteer label="Maybe you know" rowProps={personRow} rows={rowsOf(sugg.people)}
                  cols={[nameCol, { key: "who", label: "WHY" }, { key: "a", label: "", render: (p) => btn("Connect", () => request(p.handle)) }]}/>
              )}
              <p className="pl-body pl-muted">Suggestions come only from public pages that share your workplace or school — never from an address book.</p>
            </div>
            {net.blocked.length > 0 && (
              <div data-net-blocked="">
                <Gazetteer label={`Blocked · ${net.blocked.length}`} rowProps={personRow} rows={rowsOf(net.blocked)}
                  cols={[nameCol, { key: "a", label: "", render: (p) => btn("Unblock", () => act(p.handle, "unblock", "Unblocked.")) }]}/>
              </div>
            )}
          </div>
          <div style={{ flex: "1 1 260px", minWidth: 0 }} className="pl-platehero">
            <div className="pl-platehero__frame" style={{ "--pl-aspect": "360 / 220" }}><CampsGazetteer/></div>
          </div>
        </div>
      </section>
    </CorrespondenceFrame>
  );
}
