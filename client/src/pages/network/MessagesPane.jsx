// ⭐ D180 P2 (45o) · MESSAGES — conversations, Requests (people you aren't connected to: one message until you accept),
// the ones you sent that wait, and one conversation with its job cards. ⋯ = mute · report · block. Text is drawn as text:
// no link is made clickable (a stranger's link stays plain words — the spec). Real time on the sync stream (45r: a
// network_message event re-reads the list / the open conversation); polled every 15 s as the fallback.
// "No AI reads this conversation unless you ask" — and nothing here asks.
// ⭐ 46f (owner 11-11): these are the PARTS of the Messages page (pages/network/MessagesPage.jsx, /app/messages): the
// list (useInbox + Inbox) and one conversation (Thread). Network keeps only People.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";
import { useSyncEvents } from "../../hooks/useSyncEvents.js";   // D180 (45r): real time; the poll below stays the fallback

const POLL_MS = 15_000;
const when = (s) => new Date(s * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const REASONS = [["spam", "Spam"], ["harassment", "Harassment"], ["scam", "A scam"], ["inappropriate", "Inappropriate"], ["other", "Something else"]];

function MessageJobCard({ job }) {   // (not JobCard: the board's card has that name — A93)
  if (!job) return <div className="msg-job msg-job--gone">This job is no longer open.</div>;
  return (
    <a className="msg-job" href={job.path} data-msg-job={job.id}>
      <b>{job.title}</b><span>{[job.company, job.location].filter(Boolean).join(" · ")}</span>
      <span className="msg-job__go">Open the job →</span>
    </a>
  );
}

function Thread({ id, onBack, onChanged }) {
  const [t, setT] = useState(null);
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(null);   // { kind, id }
  const [reason, setReason] = useState("spam");
  const end = useRef(null);
  const load = useCallback(() => api(`/api/network/messages/${id}`).then(setT).catch(e => setSaid(e.message)), [id]);
  useEffect(() => { load(); const iv = setInterval(load, POLL_MS); return () => clearInterval(iv); }, [load]);
  // ⭐ D180 (45r): real time — the sync stream says THIS conversation changed (never its words); read it again now.
  useSyncEvents({ network_message: (e) => { if (!e?.threadId || Number(e.threadId) === Number(id)) load(); } });
  useEffect(() => { end.current?.scrollIntoView?.({ block: "end" }); }, [t?.messages?.length]);
  if (!t) return <p className="net__quiet" role="status">{said || "Opening the conversation…"}</p>;

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

  return (
    <section className="msg-thread" data-msg-thread={id}>
      <header className="msg-thread__head">
        <button type="button" className="net__back" onClick={onBack}>‹ All messages</button>
        <a href={`/in/${encodeURIComponent(t.with.handle)}`} className="msg-thread__who">{t.with.name}</a>
        <span className="msg-thread__menu">
          <DepthButton onClick={() => setMenu(m => !m)} aria-expanded={menu}>⋯</DepthButton>
          {menu && (
            <span className="msg-menu" role="menu">
              <button type="button" role="menuitem" onClick={mute}>{t.muted ? "Unmute" : "Mute"}</button>
              <button type="button" role="menuitem" onClick={() => { setReporting({ kind: "thread", id }); setMenu(false); }}>Report the conversation</button>
              <button type="button" role="menuitem" onClick={doBlock}>Block {t.with.name}</button>
            </span>
          )}
        </span>
      </header>
      <p className="net__quiet msg-thread__ai" data-no-ai="">No AI reads this conversation unless you ask.</p>
      {t.fromStranger && (
        <div className="msg-req" data-msg-request="">
          <p>{t.with.name} isn't a connection. Reply only if you accept — links here aren't clickable.</p>
          <div className="net__row">
            <DepthButton primary onClick={() => answer(true)}>Accept</DepthButton>
            <DepthButton onClick={() => answer(false)}>Decline</DepthButton>
            <DepthButton onClick={() => setReporting({ kind: "thread", id })}>Report</DepthButton>
          </div>
        </div>
      )}
      <ol className="msg-list">
        {t.messages.map(m => (
          <li key={m.id} className={`msg${m.mine ? " msg--mine" : ""}`} data-msg={m.id}>
            {m.removed ? <span className="net__quiet">This message was removed.</span> : <>
              {m.text && <p className="msg__text">{m.text}</p>}
              {m.kind === "job" && <MessageJobCard job={m.job} />}
            </>}
            <span className="msg__meta">{when(m.at)}
              {" · "}<button type="button" className="msg__act" onClick={() => hide(m.id)}>Delete for me</button>
              {!m.mine && !m.removed && <>{" · "}<button type="button" className="msg__act" onClick={() => setReporting({ kind: "message", id: m.id })}>Report</button></>}
            </span>
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
      {reporting && (
        <div className="msg-report" data-msg-reporting={reporting.kind}>
          <label>Why are you reporting this?{" "}
            <select value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <div className="net__row"><DepthButton primary onClick={doReport}>Send the report</DepthButton><DepthButton onClick={() => setReporting(null)}>Cancel</DepthButton></div>
        </div>
      )}
      {said && <p className="net__said" role="status">{said}</p>}
      {canWrite ? (
        <div className="msg-compose">
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={3} placeholder="Write a message" aria-label="Write a message"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
          <DepthButton primary onClick={send}>Send</DepthButton>
        </div>
      ) : <p className="net__quiet">{t.status === "request" && t.mine ? "They haven't accepted yet — one message until they do." : "Accept the request to reply."}</p>}
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
  if (!box) return <p className="net__quiet" role="status">{said || "Opening your messages…"}</p>;
  const row = (t) => (
    <li key={t.id}>
      <button type="button" className="msg-row" onClick={() => onOpen(t.id)} data-msg-row={t.id} aria-current={Number(openId) === Number(t.id) ? "true" : undefined}>
        <span className="net-person__tile" aria-hidden="true">{String(t.with.name || "?").charAt(0).toUpperCase()}</span>
        <span className="net-person__main">
          <b>{t.with.name}</b>
          <span className="net-person__sub">{t.preview || " "}</span>
        </span>
        <span className="msg-row__meta">{when(t.lastAt)}{t.unread > 0 && <b className="msg-row__n" aria-label={`${t.unread} unread`}>{t.unread}</b>}{t.muted ? " · muted" : ""}</span>
      </button>
    </li>
  );
  return (
    <div data-messages-pane="">
      <section className="net__sec" data-msg-threads="">
        <h2>Messages</h2>
        {box.threads.length === 0 ? <p className="net__quiet">No conversations yet — Send a job from the deck, or write from a connection's page.</p>
          : <ul className="net__list">{box.threads.map(row)}</ul>}
      </section>
      {box.requests.length > 0 && <section className="net__sec" data-msg-requests=""><h2>Requests · {box.requests.length}</h2><ul className="net__list">{box.requests.map(row)}</ul></section>}
      {box.sent.length > 0 && <section className="net__sec" data-msg-sent=""><h2>Waiting for them · {box.sent.length}</h2><ul className="net__list">{box.sent.map(row)}</ul></section>}
    </div>
  );
}
