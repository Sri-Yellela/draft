// ⭐ D180 P2 (45o) · MESSAGES — conversations, Requests (people you aren't connected to: one message until you accept),
// the ones you sent that wait, and one conversation with its job cards. Mute · report · block. Text is drawn as text:
// no link is made clickable (a stranger's link stays plain words — the spec). Real time on the sync stream (45r: a
// network_message event re-reads the list / the open conversation); polled every 15 s as the fallback.
// "No AI reads this conversation unless you ask" — and nothing here asks.
// ⭐ 46f (owner 11-11): these are the PARTS of the Messages page (pages/network/MessagesPage.jsx, /app/messages): the
// list (useInbox + Inbox) and one conversation (Thread). Network keeps only People.
// ⭐ D197 Wave 2 #14 · M5 (47m, lane public — the approved mock `network`, Letters): the list is three Gazetteers (Messages ·
// Requests · Waiting for them: NAME · LAST LINE · WHEN · the unread count as .mark-count); the conversation's strip is
// ‹ ALL LETTERS · CORRESPONDENCE · <NAME> · a plate menu (Mute / Unmute · Report the conversation · Block <name>); a stranger's
// request is a clay-tint ticket-shaped card (Accept = the clay point while it shows); each message a CorrespondenceLetter
// (yours on the region tint; removed → THIS MESSAGE WAS REMOVED; a job → its ticket / NO LONGER OPEN); the report is the
// plate ReportBlock; the composer is the Send ticket (Ctrl / ⌘ + Enter sends). Every hook the tests read stays.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { useSyncEvents } from "../../hooks/useSyncEvents.js";   // D180 (45r): real time; the poll below stays the fallback
import { Gazetteer } from "../../plate/Lists.jsx";
import { Drawer, Skeleton } from "../../plate/PlateState.jsx";
import { CorrespondenceLetter, SendTicket, ReportBlock, PersonName } from "../../plate/Correspondence.jsx";

const POLL_MS = 15_000;
const when = (s) => new Date(s * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase();
const pbtn = (label, onClick, extra = {}) => <button type="button" className="pl-btn pl-btn--paper" onClick={onClick} {...extra}>{label}</button>;

function Thread({ id, onBack, onChanged }) {
  const [t, setT] = useState(null);
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(null);   // { kind, id }
  const [reason, setReason] = useState("spam");
  const end = useRef(null);
  const load = useCallback(() => api(`/api/network/messages/${id}`).then(r => {
    setT(r);
    try { window.dispatchEvent(new Event("rm:network-read")); } catch { /* no window */ }   // 46f: the dock's count follows at once
  }).catch(e => setSaid(e.message)), [id]);
  useEffect(() => { load(); const iv = setInterval(load, POLL_MS); return () => clearInterval(iv); }, [load]);
  // ⭐ D180 (45r): real time — the sync stream says THIS conversation changed (never its words); read it again now.
  useSyncEvents({ network_message: (e) => { if (!e?.threadId || Number(e.threadId) === Number(id)) load(); } });
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [t?.messages?.length]);
  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
  if (!t) return said ? <p className="pl-body" role="status">{said}</p> : <Skeleton label="Opening the conversation…" lines={4}/>;

  const send = async () => {
    if (!text.trim()) return;
    try { await api("/api/network/messages", { method: "POST", body: JSON.stringify({ to: t.with.handle, text }) }); setText(""); setSaid(""); load(); onChanged?.(); }
    catch (e) { setSaid(e.message); }
  };
  const answer = async (accept) => {
    try { await api(`/api/network/messages/${id}/${accept ? "accept" : "decline"}`, { method: "POST", body: "{}" }); onChanged?.(); accept ? load() : onBack(); }
    catch (e) { setSaid(e.message); }
  };
  const doReport = async () => {
    try { await api("/api/network/report", { method: "POST", body: JSON.stringify({ kind: reporting.kind, id: reporting.id, reason }) }); setSaid("Reported — thank you. They aren't told who reported."); setReporting(null); }
    catch (e) { setSaid(e.message); }
  };
  const doBlock = async () => {
    if (!window.confirm(`Block ${t.with.name}? Neither of you can message or connect until you unblock.`)) return;
    try { await api(`/api/network/${encodeURIComponent(t.with.handle)}/block`, { method: "POST", body: "{}" }); onChanged?.(); onBack(); }
    catch (e) { setSaid(e.message); }
  };
  const mute = async () => { try { await api(`/api/network/messages/${id}/${t.muted ? "unmute" : "mute"}`, { method: "POST", body: "{}" }); setMenu(false); load(); onChanged?.(); } catch (e) { setSaid(e.message); } };
  const hide = async (mid) => { try { await api(`/api/network/message/${mid}/hide`, { method: "POST", body: "{}" }); load(); } catch (e) { setSaid(e.message); } };
  const canWrite = t.status === "open" || (t.mine && !t.messages.some(m => m.mine));
  const them = { name: t.with.name, href: `/in/${encodeURIComponent(t.with.handle)}` };

  return (
    <section data-msg-thread={id} style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-label={`Correspondence with ${t.with.name}`}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="pl-btn pl-btn--paper" onClick={onBack}>‹ All letters</button>
        <span className="pl-label">CORRESPONDENCE · <a href={them.href} style={{ color: "var(--pl-ink)" }}>{String(t.with.name).toUpperCase()}</a></span>
        <span className="pl-grow"/>
        <span className="pl-rel">
          <button type="button" className="pl-btn pl-btn--paper" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>Mute · Report · Block</button>
          {menu && (
            <div className="pl-menu pl-drop" role="menu" style={{ right: 0 }}>
              <button type="button" role="menuitem" className="pl-btn pl-btn--paper" onClick={mute}>{t.muted ? "Unmute" : "Mute"}</button>
              <button type="button" role="menuitem" className="pl-btn pl-btn--paper" onClick={() => { setReporting({ kind: "thread", id }); setMenu(false); }}>Report the conversation</button>
              <button type="button" role="menuitem" className="pl-btn pl-btn--paper" onClick={doBlock}>Block {t.with.name}</button>
            </div>
          )}
        </span>
      </div>
      <span className="pl-label pl-muted" data-no-ai="">No AI reads this conversation unless you ask.</span>
      {t.fromStranger && (
        <div className="pl-ticket" data-tone="clay-tint" data-msg-request="" style={{ flex: "none" }}>
          <div className="pl-ticket__head">
            <span className="pl-label">A REQUEST · {String(t.with.name).toUpperCase()} ISN'T A CONNECTION</span>
            <span className="pl-ticket__line">{t.with.name} isn't a connection. Reply only if you accept — links here aren't clickable.</span>
          </div>
          <div aria-hidden="true" className="pl-tear"/>
          <span className="pl-ticket__go" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="pl-btn pl-btn--primary" onClick={() => answer(true)}>Accept</button>
            {pbtn("Decline", () => answer(false))}
            {pbtn("Report", () => setReporting({ kind: "thread", id }))}
          </span>
        </div>
      )}
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {t.messages.map(m => (
          <li key={m.id} data-msg={m.id} className={m.mine ? "msg--mine" : undefined}>
            <CorrespondenceLetter from={m.mine ? {} : them} mine={!!m.mine} when={when(m.at)} removed={!!m.removed} text={m.text}
              job={m.kind === "job" ? (m.job ? { title: m.job.title, company: m.job.company, place: m.job.location, href: m.job.path } : false) : null}
              actions={<>
                {pbtn("Delete for me", () => hide(m.id))}
                {!m.mine && !m.removed && pbtn("Report", () => setReporting({ kind: "message", id: m.id }))}
              </>}/>
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
      {reporting && <ReportBlock data-msg-reporting={reporting.kind} reason={reason} onReason={setReason} onSend={doReport} onCancel={() => setReporting(null)}/>}
      {said && <p className="pl-label pl-muted" role="status">{said}</p>}
      {canWrite ? (
        <SendTicket kicker={`A LETTER · TO ${String(t.with.name).toUpperCase()}`} placeholder="Write a message" maxLength={4000} note="Ctrl + Enter sends."
          value={text} onChange={setText} onSend={send} clay={!t.fromStranger}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}/>
      ) : <p className="pl-body pl-muted">{t.status === "request" && t.mine ? "They haven't accepted yet — one message until they do." : "Accept the request to reply."}</p>}
    </section>
  );
}

export { Thread };

// ⭐ 46f: the conversation list, read live (sync stream + the 15 s poll) — Messages' page draws it beside the open one.
export function useInbox() {
  const [box, setBox] = useState(null);
  const [said, setSaid] = useState("");
  const load = useCallback(() => api("/api/network/messages").then(setBox).catch(e => setSaid(e.message)), []);
  useEffect(() => { load(); const iv = setInterval(load, POLL_MS); return () => clearInterval(iv); }, [load]);
  useSyncEvents({ network_message: () => load() });   // D180 (45r): a new message → the list (and its unread counts) now
  return { box, said, load };
}

export function Inbox({ box, said, openId = null, onOpen }) {
  if (!box) return said ? <p className="pl-body" role="status">{said}</p> : <Skeleton label="Opening your messages…" lines={4}/>;
  const cols = [
    { key: "title", label: "NAME", render: (t) => (
      <button type="button" className="pl-btn pl-btn--paper" onClick={() => onOpen(t.id)} data-msg-row={t.id}
        aria-current={Number(openId) === Number(t.id) ? "true" : undefined} style={{ justifyContent: "flex-start" }}>
        <PersonName name={t.with.name}/>
      </button>) },
    { key: "last", label: "LAST LINE", render: (t) => <span style={{ overflowWrap: "anywhere" }}>{t.preview || "—"}{t.muted ? " · muted" : ""}</span> },
    { key: "when", label: "WHEN", kind: "mono", render: (t) => when(t.lastAt) },
    { key: "n", label: "", render: (t) => (t.unread > 0 ? <span className="mark-count" aria-label={`${t.unread} unread`}>{t.unread}</span> : null) },
  ];
  const list = (label, rows) => <Gazetteer label={label} cols={cols} rows={rows.map((t) => ({ ...t, id: t.id }))} rowClick onRow={(t) => onOpen(t.id)}/>;
  return (
    <div data-messages-pane="" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div data-msg-threads="">
        {box.threads.length === 0
          ? <Drawer kicker="NOT YET" text="No conversations yet — Send a job from the deck, or write from a connection's page."/>
          : list("Messages", box.threads)}
      </div>
      {box.requests.length > 0 && <div data-msg-requests="">{list(`Requests · ${box.requests.length}`, box.requests)}</div>}
      {box.sent.length > 0 && <div data-msg-sent="">{list(`Waiting for them · ${box.sent.length}`, box.sent)}</div>}
    </div>
  );
}
