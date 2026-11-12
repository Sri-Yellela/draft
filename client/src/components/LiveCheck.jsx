// ⭐ A186-CAPTCHA (1) · SOLVE IT HERE — when an application meets a visible check (a CAPTCHA) after Submit, the run keeps
// the employer's page open for a few minutes and shows it here, live. The person clicks the check themselves; the run
// sees it clear, reads the confirmation and records the application as sent. routes/apply.js /api/apply/live*.
// ⛔ draft never answers the check — these are the person's own clicks, sent into that page.
// ⭐ A186-CAPTCHA (1b) · NO TIME LIMIT: a check nobody solved in time stays here (held) — Solve it here re-fills the form
// from what the first run made (no new draft, nothing re-written) and opens the check live when it comes up, so the five
// minutes start while the person is watching. Several held checks → Solve them one after another (the batch queue).
// A nudge's link (?check=<runJobId>) points at its row.
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
  // 46j: short polls for the newest frame, never a held-open stream — the app owns ONE long-lived connection per origin
  // (useSyncEvents); a second one starves the board's requests of a socket (boardSecondLoadParity).
  useEffect(() => {
    let stop = false, after = 0, timer = null, misses = 0;
    const tick = async () => {
      if (stop) return;
      try {
        const qs = authContextQuery();
        const r = await fetch(`/api/apply/live/${encodeURIComponent(session.runJobId)}/frame?after=${after}${qs ? `&${qs}` : ""}`,
          { credentials: "include", cache: "no-store" });
        if (r.status === 404) { setEnded("done"); return; }
        if (r.status === 200) { const d = await r.json(); after = d.at; setFrame(d); }
        misses = 0;
      } catch { if (++misses >= 10) { setEnded((x) => x || "closed"); return; } }
      if (!stop) timer = setTimeout(tick, 350);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
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

const RERUN_WORDS = {
  opening: "Opening the form again…",
  filling: "Filling it from your saved answers and résumé…",
  live: "The check is open — solve it below.",
  no_live: "The check came up, and no live view could open.",
};

/**
 * The person's checks: live sessions (a run waiting right now) and held checks (no deadline — Solve it here re-runs them
 * from what was made). Polls every 5 s, every second while a re-run is opening.
 */
export default function LiveCheck() {
  const [sessions, setSessions] = useState([]);
  const [held, setHeld] = useState([]);
  const [reruns, setReruns] = useState([]);
  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(null);
  const [said, setSaid] = useState("");
  const [tick, setTick] = useState(0);
  const autoOpened = useRef(new Set());
  const linked = (() => { try { return Number(new URLSearchParams(window.location.search).get("check")) || null; } catch { return null; } })();

  const load = useCallback(() => api("/api/apply/live").then(r => {
    setSessions(r.sessions || []); setHeld(r.held || []); setReruns(r.reruns || []); setQueue(r.queue || []);
  }).catch(() => {}), []);
  const busy = reruns.some(x => !x.endedAt) || queue.length > 0;
  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) load(); };
    run();
    const t = setInterval(() => { run(); setTick(n => n + 1); }, busy ? 1000 : 5000);
    return () => { alive = false; clearInterval(t); };
  }, [load, busy]);

  // A re-run reached its check: open the live view by itself — the person pressed Solve it here and is waiting for it.
  useEffect(() => {
    for (const x of reruns) {
      if (x.state === "live" && !x.endedAt && !autoOpened.current.has(x.runJobId) && sessions.some(s => String(s.runJobId) === String(x.runJobId))) {
        autoOpened.current.add(x.runJobId);
        setOpen(String(x.runJobId));
      }
    }
  }, [reruns, sessions]);

  const solve = useCallback(async (runJobId) => {
    setSaid("");
    try { const r = await api(`/api/apply/run-jobs/${encodeURIComponent(runJobId)}/solve-check`, { method: "POST" }); if (r?.message) setSaid(r.message); }
    catch (e) { setSaid(e.message || "That didn't start — try again in a moment."); }
    load();
  }, [load]);
  const solveAll = useCallback(async (stop = false) => {
    setSaid("");
    try { await api("/api/apply/solve-checks", { method: "POST", body: JSON.stringify(stop ? { stop: true } : {}) }); }
    catch (e) { setSaid(e.message || "That didn't start — try again in a moment."); }
    load();
  }, [load]);

  // The panel's held row (Draft House) asks through an event, so there is one way to start a re-run.
  useEffect(() => {
    const on = (e) => { const id = e?.detail?.runJobId; if (id != null) solve(id); };
    window.addEventListener("draft:solve-check", on);
    return () => window.removeEventListener("draft:solve-check", on);
  }, [solve]);

  const rerunOf = (id) => reruns.find(x => String(x.runJobId) === String(id)) || null;
  const sessionOf = (id) => sessions.find(s => String(s.runJobId) === String(id)) || null;
  // One line per check: the held ones (newest first), then any live session that is not a held row (a run waiting now).
  const ids = [...held.map(h => String(h.runJobId)), ...sessions.map(s => String(s.runJobId)).filter(id => !held.some(h => String(h.runJobId) === id))];
  const n = ids.length;
  if (!n && !open && !reruns.length) return null;
  void tick;
  return (
    <div data-live-check="" role="region" aria-label="A quick check is waiting"
      style={{ border: `1px solid ${C.WARNING}`, padding: 10, margin: "8px 0" }}>
      <b style={{ fontSize: ts(14) }}>{n <= 1 ? "An application needs a quick check" : `${n} applications need a quick check`}</b>
      <div style={{ fontSize: ts(13), color: C.INK_MUTED }}>The employer's site asked for a CAPTCHA after Submit. Everything else is filled — solve the check and draft sends it. There's no rush: it waits here until you're back.</div>
      {held.length > 1 && (
        <div style={{ marginTop: 6 }}>
          {queue.length
            ? <DepthButton onClick={() => solveAll(true)}>Stop after this one ({queue.length} waiting)</DepthButton>
            : <DepthButton data-solve-all="" onClick={() => solveAll(false)} disabled={busy}>Solve all {held.length}, one after another</DepthButton>}
        </div>
      )}
      {said && <div role="status" style={{ fontSize: ts(13), marginTop: 4 }}>{said}</div>}
      {ids.map(id => {
        const h = held.find(x => String(x.runJobId) === id) || null;
        const s = sessionOf(id);
        const x = rerunOf(id);
        const going = x && !x.endedAt;
        return (
          <div key={id} data-check-row={id} ref={(el) => { if (el && linked && String(linked) === id && !el.dataset.seen) { el.dataset.seen = "1"; el.scrollIntoView?.({ block: "center" }); } }}
            style={{ marginTop: 8, ...(linked && String(linked) === id ? { outline: `2px solid ${C.WARNING}`, outlineOffset: 2 } : {}) }}>
            {h && <div style={{ fontSize: ts(13) }}>{[h.title, h.company].filter(Boolean).join(" · ") || "An application"}</div>}
            {s ? (
              <DepthButton primary onClick={() => setOpen(open === id ? null : id)}>{open === id ? "Hide" : "Solve it here"}</DepthButton>
            ) : (
              <DepthButton primary data-solve-check={id} disabled={!!going} onClick={() => solve(id)}
                title="Opens the form again with your saved answers and the same résumé, presses Submit, and shows you the check — no new draft is used.">
                {going ? "Opening…" : "Solve it here"}
              </DepthButton>
            )}
            <span style={{ fontSize: ts(12), color: C.INK_MUTED, marginLeft: 8 }}>
              {going ? `${RERUN_WORDS[x.state] || "Working…"} ${Math.max(0, Math.round((Date.now() - x.startedAt) / 1000))} s`
                : s ? `waits until ${new Date(s.expiresAt).toLocaleTimeString()}`
                : x?.message || (queue.map(String).includes(id) ? "Next in line" : "")}
            </span>
            {open === id && s && <Viewer session={s} onClose={() => setOpen(null)} />}
          </div>
        );
      })}
    </div>
  );
}
