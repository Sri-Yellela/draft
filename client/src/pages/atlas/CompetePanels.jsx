// ⭐ A154 / D172 (4) (45s, owner 11-08: "build league and challenges, can merge them later") · ATLAS → COMPETE: this week's
// league and the challenges. Drawn only when their switch is on (AtlasPage asks GET /api/atlas/compete); the server answers
// 404 otherwise. ⛔ The rules (D172): opt-in, a handle is all anyone sees, points only from proof, leave any time, nobody
// below you is named "behind", the feed shows proof — never a failure; challenges earn no points; extended time and an
// untimed mode are always offered (D142).
import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api.js";
import DepthButton from "../../components/DepthButton.jsx";
import { PanelHead } from "./AtlasPanels.jsx";
import { resetWords, moveOf, wayOf, barHref, MODE_WORDS } from "./competeModel.js";
import "./CompetePanels.css";

function TierBadge({ tier }) {
  return (
    <svg className={`cmp-badge cmp-badge--${tier.n}`} viewBox="0 0 40 46" role="img" aria-label={`${tier.name} tier`} data-league-badge={tier.name}>
      <path className="cmp-badge__shield" d="M20 2 L37 8 V22 C37 33 29 41 20 44 C11 41 3 33 3 22 V8 Z" />
      <path className="cmp-badge__star" d="M20 13 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

const LeagueAvatar = ({ handle, big = false }) => (
  <span className={`cmp-av cmp-av--${wayOf(handle)}${big ? " cmp-av--big" : ""}`} aria-hidden="true">{String(handle || "?").slice(0, 1).toUpperCase()}</span>
);

function JoinCard({ league, onJoined }) {
  const [handle, setHandle] = useState(league.suggestion || "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true); setMsg("");
    try { onJoined(await api("/api/atlas/league/join", { method: "POST", body: JSON.stringify({ handle: handle.trim() }) })); }
    catch (e) { setMsg(e.message || "Could not join."); } finally { setBusy(false); }
  };
  return (
    <section className="cmp-card" data-league-join="">
      <h2 className="atl__h2">Join {league.pod.name}</h2>
      <p className="atl__quiet">{league.rule}</p>
      <label className="cmp-field">Your handle
        <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={24} autoComplete="off" spellCheck={false} data-league-handle="" />
      </label>
      <span data-league-join-go=""><DepthButton primary onClick={join} disabled={busy || !handle.trim()}>{busy ? "Joining…" : "Join this week's league"}</DepthButton></span>
      {msg && <p className="atl__quiet" role="alert">{msg}</p>}
      <p className="atl__quiet">{resetWords(league.resetsIn)} — Monday 00:00 UTC.</p>
    </section>
  );
}

export function LeaguePanel({ base }) {
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api("/api/atlas/league").then(setLeague).catch(e => setErr(e.message || "The league could not be read.")), []);
  useEffect(() => { load(); }, [load]);
  const leave = async () => {
    try { await api("/api/atlas/league", { method: "DELETE" }); await load(); } catch (e) { setErr(e.message || "Could not leave."); }
  };
  return (
    <div className="atl-pan cmp" data-atlas-panel-body="league">
      <PanelHead eyebrow="Compete" title="This week's league" lead="Opt-in pods by school and field. Points come only from proof." />
      {err && <p className="atl__quiet" role="alert">{err}</p>}
      {!league && !err && <p className="atl__quiet" role="status">Opening the league…</p>}
      {league && !league.member && <JoinCard league={league} onJoined={setLeague} />}
      {league?.member && (
        <>
          <section className="cmp-head" data-league-pod={league.pod.size}>
            <TierBadge tier={league.tier} />
            <div>
              <p className="cmp-head__line" data-league-line="">{league.line}</p>
              <p className="atl__quiet" data-league-reset={league.resetsIn}>{resetWords(league.resetsIn)}</p>
            </div>
          </section>
          <ol className="cmp-podium" aria-label="The top three" data-league-podium="">
            {league.podium.map(r => (
              <li key={r.handle} className={`cmp-podium__p cmp-podium__p--${r.place}${r.you ? " is-you" : ""}`} data-podium-place={r.place}>
                <LeagueAvatar handle={r.handle} big={r.place === 1} />
                <span className="cmp-podium__place">{r.place}</span>
                <b className="cmp-podium__h">{r.handle}</b>
                <span className="atl__quiet">{r.points} points</span>
              </li>
            ))}
          </ol>
          <ol className="cmp-rows" data-league-rows="">
            {league.rows.map(r => {
              const mv = moveOf(r.move);
              return (
                <li key={r.handle} className={`cmp-row${r.you ? " is-you" : ""}${league.promotionLine && r.place === league.promotionLine ? " cmp-row--line" : ""}`}
                  data-league-row={r.place} data-league-you={r.you ? "" : undefined}>
                  <span className="cmp-row__place">{r.place}</span>
                  <LeagueAvatar handle={r.handle} />
                  <span className="cmp-row__h">{r.handle}{r.you ? " (you)" : ""}</span>
                  {mv.sign && <span className={`cmp-move cmp-move--${mv.sign}`} data-league-move={r.move}>{mv.words}</span>}
                  <span className="cmp-row__pts">{r.points}</span>
                </li>
              );
            })}
          </ol>
          {league.promotionLine && <p className="atl__quiet" data-league-promotion="">The line sits under place {league.promotionLine}: everyone above it moves up to {league.tier.next} on Monday.</p>}
          {league.gap && (
            <section className="cmp-gap" data-league-gap={league.gap.points}>
              <p className="cmp-gap__words">{league.gap.words}</p>
              <div className="cmp-gap__bar" aria-hidden="true"><i style={{ width: `${Math.max(6, Math.min(100, 100 - league.gap.points))}%` }} /></div>
              <div className="cmp-gap__acts">
                <span data-league-close=""><DepthButton primary onClick={() => navigate(league.gap.move.kind === "check" ? `${base}/your-skills` : `${base}/your-run`)}>
                  {league.gap.move.label} · +{league.gap.move.points}</DepthButton></span>
                <Link className="atl__link" to={`${base}/challenges`} data-league-challenge="">Challenge someone</Link>
              </div>
            </section>
          )}
          {league.feed.length > 0 && (
            <section className="cmp-feed" aria-label="Proof in your pod" data-league-feed="">
              <h2 className="atl__h2">In your pod</h2>
              <ul>{league.feed.map((f, i) => <li key={`${f.handle}-${f.at}-${i}`}><b>{f.handle}</b> {f.words} <span className="cmp-feed__pts">+{f.points}</span></li>)}</ul>
            </section>
          )}
          <footer className="cmp-foot" data-league-foot="">
            <p className="atl__quiet">{league.footer}</p>
            <span data-league-leave=""><DepthButton onClick={leave}>Leave the league</DepthButton></span>
          </footer>
        </>
      )}
    </div>
  );
}

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
            <p className="atl__quiet">Take the 3-minute audit for a role, keep the result, and share the score — the link shows the score and the role, nothing about you.</p>
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
