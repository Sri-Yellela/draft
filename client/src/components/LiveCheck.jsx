// ⭐ A186-CAPTCHA (1) · SOLVE IT HERE — when an application meets a visible check (a CAPTCHA) after Submit, the run keeps
// the employer's page open for a few minutes and shows it here, live. The person clicks the check themselves; the run
// sees it clear, reads the confirmation and records the application as sent. routes/apply.js /api/apply/live*.
// ⛔ draft never answers the check — these are the person's own clicks, sent into that page.
import { useEffect, useRef, useState, useCallback } from "react";
import { api, authContextQuery } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import DepthButton from "./DepthButton.jsx";
import { ts } from "../themes/shapes.js";

function Viewer({ session, onClose }) {
  const [frame, setFrame] = useState(null);
  const [ended, setEnded] = useState(null);
  const [said, setSaid] = useState("");
  const imgRef = useRef(null);
  useEffect(() => {
    const qs = authContextQuery();
    const es = new EventSource(`/api/apply/live/${encodeURIComponent(session.runJobId)}/stream${qs ? `?${qs}` : ""}`, { withCredentials: true });
    es.onmessage = (e) => {
      let d = null; try { d = JSON.parse(e.data); } catch { return; }
      if (d.ended) { setEnded(d.ended); es.close(); return; }
      setFrame(d);
    };
    es.onerror = () => { es.close(); setEnded((x) => x || "closed"); };
    return () => es.close();
  }, [session.runJobId]);
  const send = useCallback(async (body) => {
    try { await api(`/api/apply/live/${encodeURIComponent(session.runJobId)}/input`, { method: "POST", body: JSON.stringify(body) }); setSaid(""); }
    catch (e) { setSaid(e.message || "That click did not reach the page."); }
  }, [session.runJobId]);
  const at = (e) => {
    const img = imgRef.current; if (!img || !frame) return null;
    const r = img.getBoundingClientRect();
    return { x: Math.round((e.clientX - r.left) * (frame.w / r.width)), y: Math.round((e.clientY - r.top) * (frame.h / r.height)) };
  };
  return (
    <div data-live-check-viewer="" style={{ marginTop: 8 }}>
      {ended ? (
        <div role="status" style={{ fontSize: ts(13), color: C.INK_MUTED }}>
          The check is no longer waiting — the run has moved on. Its result shows in your applications in a moment.
          {" "}<DepthButton onClick={onClose}>Close</DepthButton>
        </div>
      ) : !frame ? <div style={{ fontSize: ts(13), color: C.INK_MUTED }}>Loading the employer's page…</div> : (
        <>
          <div style={{ fontSize: ts(13), marginBottom: 6 }}>Solve the check on the page below — click it as you would on the site. draft submits as soon as it clears.</div>
          <img ref={imgRef} alt="The employer's application page, live" draggable={false}
            src={`data:image/jpeg;base64,${frame.jpeg}`}
            onClick={(e) => { const p = at(e); if (p) send({ type: "click", ...p }); }}
            onWheel={(e) => { const p = at(e); if (p) send({ type: "scroll", ...p, dy: e.deltaY }); }}
            tabIndex={0} onKeyDown={(e) => { if (e.key.length === 1 || ["Enter", "Tab", "Backspace", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) { e.preventDefault(); send({ type: "key", key: e.key }); } }}
            style={{ width: "100%", maxWidth: 960, border: `1px solid ${C.INK_MUTED}`, cursor: "pointer", display: "block" }} />
          {said && <div role="alert" style={{ fontSize: ts(13), color: C.DANGER, marginTop: 4 }}>{said}</div>}
        </>
      )}
    </div>
  );
}

/** A line per live check waiting for this person, each opening its live view. Polls every 5 s while mounted. */
export default function LiveCheck() {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => api("/api/apply/live").then(r => { if (alive) setSessions(r.sessions || []); }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!sessions.length && !open) return null;
  return (
    <div data-live-check="" role="region" aria-label="A quick check is waiting"
      style={{ border: `1px solid ${C.WARNING}`, padding: 10, margin: "8px 0" }}>
      <b style={{ fontSize: ts(14) }}>{sessions.length === 1 ? "An application needs a quick check" : `${sessions.length} applications need a quick check`}</b>
      <div style={{ fontSize: ts(13), color: C.INK_MUTED }}>The employer's site asked for a CAPTCHA after Submit. Everything else is filled — solve the check and draft sends it.</div>
      {sessions.map(s => (
        <div key={s.runJobId} style={{ marginTop: 6 }}>
          <DepthButton primary onClick={() => setOpen(open === s.runJobId ? null : s.runJobId)}>
            {open === s.runJobId ? "Hide" : "Solve it here"}
          </DepthButton>
          <span style={{ fontSize: ts(12), color: C.INK_MUTED, marginLeft: 8 }}>
            waits until {new Date(s.expiresAt).toLocaleTimeString()}
          </span>
          {open === s.runJobId && <Viewer session={s} onClose={() => setOpen(null)} />}
        </div>
      ))}
    </div>
  );
}
