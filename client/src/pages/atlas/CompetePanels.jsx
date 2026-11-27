// ⭐ A154 / D172 (4) (45s, owner 11-08: "build league and challenges, can merge them later") · ATLAS → COMPETE: this week's
// league and the challenges. Drawn only when their switch is on (AtlasPage asks GET /api/atlas/compete); the server answers
// 404 otherwise. ⛔ The rules (D172): opt-in, a handle is all anyone sees, points only from proof, leave any time, nobody
// below you is named "behind", the feed shows proof — never a failure; challenges earn no points; extended time and an
// untimed mode are always offered (D142).
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";
import { PanelHead } from "./AtlasPanels.jsx";
import { barHref, MODE_WORDS } from "./competeModel.js";
import "./CompetePanels.css";

// ⭐ 47m (D197 Wave 2 #11, M5; D203 (1) (2)): the league is the Logbook's Standings on Your map now (Logbook.jsx Standings —
// join, the tier as a stamp, the rows, the promotion line, the gap, the pod's proof, Leave); /atlas/league forwards there.

/** One run of five: the server serves a question and keeps the clock; the page shows it and sends the choice. */
function Runner({ start, onDone }) {
  const [q, setQ] = useState(start.question);
  const [n, setN] = useState(start.number);
  const [last, setLast] = useState(null);
  const [end, setEnd] = useState(null);
  const [busy, setBusy] = useState(false);
  const pick = async (i) => {
    setBusy(true);
    try {
      const r = await api(`/api/atlas/challenges/${start.runId}/answer`, { method: "POST", body: JSON.stringify({ questionId: q.id, chosen: i }) });
      setLast(r);
      if (r.done) { setEnd(r); onDone?.(r); } else { setQ(r.question); setN(r.number); }
    } catch (e) { setLast({ error: e.message || "Could not send." }); } finally { setBusy(false); }
  };
  if (end) return <p className="cmp-score" data-challenge-score={end.score} role="status"><b>{end.line}</b></p>;
  return (
    <section className="cmp-card" data-challenge-runner={start.kind}>
      <p className="atl__quiet">Question {n} of {start.total} · {MODE_WORDS[start.mode]}{q.seconds ? ` · ${q.seconds} seconds` : ""}</p>
      <p className="cmp-q" data-challenge-q={q.id}>{q.stem}</p>
      <ol className="cmp-choices">
        {(q.choices || []).map((c, i) => <li key={i}><DepthButton onClick={() => pick(i)} disabled={busy}>{c}</DepthButton></li>)}
      </ol>
      {last && !last.error && <p className="atl__quiet" role="status">{last.correct ? (last.inTime ? "Right." : "Right, but past the timer.") : "Not that one."}{last.why ? ` ${last.why}` : ""}</p>}
      {last?.error && <p className="atl__quiet" role="alert">{last.error}</p>}
    </section>
  );
}

function ModePick({ mode, onMode }) {
  return (
    <div className="cmp-modes" role="group" aria-label="Time" data-challenge-modes="">
      {Object.entries(MODE_WORDS).map(([k, w]) => <DepthButton key={k} pressed={mode === k} onClick={() => onMode(k)}>{w}</DepthButton>)}
    </div>
  );
}

export function ChallengesPanel({ base }) {
  const [c, setC] = useState(null);
  const [roles, setRoles] = useState([]);
  const [role, setRole] = useState("");
  const [mode, setMode] = useState("timed");
  const [run, setRun] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");
  const load = useCallback(() => api("/api/atlas/challenges").then(setC).catch(e => setErr(e.message || "Challenges could not be read.")), []);
  useEffect(() => {
    load();
    api("/api/audit/roles").then(r => { setRoles(r.roles || []); if (r.roles?.[0]) setRole(r.roles[0].slug); }).catch(() => setRoles([]));
  }, [load]);
  const startTime = async () => { setErr(""); try { setRun(await api("/api/atlas/challenges/time-attack", { method: "POST", body: JSON.stringify({ role, mode }) })); } catch (e) { setErr(e.message); } };
  const startDuel = async () => { setErr(""); try { setRun(await api("/api/atlas/challenges/duel", { method: "POST", body: JSON.stringify({ mode }) })); } catch (e) { setErr(e.message); } };
  const share = async (token) => {
    try {
      const r = await api(`/api/atlas/challenges/bar/${encodeURIComponent(token)}/share`, { method: "POST" });
      const url = `${window.location.origin}${barHref(r.shareCode)}`;
      try { await navigator.clipboard?.writeText(url); setCopied(url); } catch { setCopied(url); }
      load();
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="atl-pan cmp" data-atlas-panel-body="challenges">
      <PanelHead eyebrow="Compete" title="Challenges" lead={c?.rule || "Challenges earn no points — points come only from proof."} />
      {err && <p className="atl__quiet" role="alert">{err}</p>}
      {run && <Runner start={run} onDone={() => load()} />}
      {run && <p><button type="button" className="atl__link" onClick={() => setRun(null)}>Back to challenges</button></p>}
      {!run && c && (
        <div className="cmp-grid">
          <section className="cmp-card" data-challenge="beat-the-bar">
            <h2 className="atl__h2">Beat the bar</h2>
            <p className="atl__quiet">Take the 3-minute audit for a role and share your score. The link shows the score and the role, nothing about you.</p>
            {c.bars.length === 0
              ? <Link className="atl__link" to={`${base}/the-audit`}>Take the audit →</Link>
              : <ul className="cmp-bars">{c.bars.map(b => (
                <li key={b.token} data-bar={b.token}><span>{b.line}</span>{" "}
                  {b.shareCode ? <Link className="atl__link" to={barHref(b.shareCode)}>Shared link</Link>
                    : <DepthButton onClick={() => share(b.token)}>Share the score</DepthButton>}</li>))}</ul>}
            {copied && <p className="atl__quiet" role="status">Link copied: {copied}</p>}
          </section>
          <section className="cmp-card" data-challenge="time-attack">
            <h2 className="atl__h2">Time attack</h2>
            <p className="atl__quiet">Five reviewed questions for a role, {c.timeAttack.seconds} seconds each — or extended time, or untimed.</p>
            {c.timeAttack.best && <p data-challenge-best={c.timeAttack.best.score}>Your best this week: <b>{c.timeAttack.best.score} of {c.timeAttack.best.total}</b> ({MODE_WORDS[c.timeAttack.best.mode]}).</p>}
            <label className="cmp-field">Role
              <select value={role} onChange={(e) => setRole(e.target.value)} data-challenge-role="">
                {roles.map(r => <option key={r.slug} value={r.slug}>{r.title}</option>)}
              </select>
            </label>
            <ModePick mode={mode} onMode={setMode} />
            <span data-challenge-start="time-attack"><DepthButton primary onClick={startTime} disabled={!role}>Start</DepthButton></span>
          </section>
          <section className="cmp-card" data-challenge="friday-duel">
            <h2 className="atl__h2">Friday duel</h2>
            <p className="atl__quiet">{c.duel.words || "The same five questions as everyone in your pod this week."}</p>
            {!c.duel.available && c.duel.why === "not_member" && <Link className="atl__link" to={`${base}/league`}>Join this week's league →</Link>}
            {c.duel.available && (
              <>
                {c.duel.scores.length > 0 && <ol className="cmp-duel" data-duel-scores="">{c.duel.scores.map(s => <li key={s.handle} className={s.you ? "is-you" : ""}><b>{s.handle}</b> {s.score} of {s.total}</li>)}</ol>}
                {c.duel.played ? <p className="atl__quiet">You've played this week's duel.</p>
                  : c.duel.open ? <><ModePick mode={mode} onMode={setMode} /><span data-challenge-start="duel"><DepthButton primary onClick={startDuel}>Start the duel</DepthButton></span></>
                    : <p className="atl__quiet" data-duel-closed="">Opens on Friday.</p>}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** /atlas/bar/<code> — a shared score: the line and the role to try. Public; nothing about who shared it. */
export function SharedBar({ base, code }) {
  const [s, setS] = useState(undefined);
  useEffect(() => { api(`/api/atlas/bar/${encodeURIComponent(code)}`).then(setS).catch(() => setS(null)); }, [code]);
  return (
    <div className="atl-pan cmp" data-atlas-panel-body="bar">
      {s === undefined && <p className="atl__quiet" role="status">Opening…</p>}
      {s === null && <p className="atl__quiet" role="status">That link doesn't open a score.</p>}
      {s && (
        <section className="cmp-card" data-shared-bar="">
          <PanelHead eyebrow="Beat the bar" title={s.line} />
          <Link className="atl__link" to={`${base}/the-audit`}>Take the {s.role.title} audit →</Link>
        </section>
      )}
    </div>
  );
}
