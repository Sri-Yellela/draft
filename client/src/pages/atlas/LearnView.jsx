// client/src/pages/atlas/LearnView.jsx — ⭐ D115 P2–P3 · LEARN, the owner's "From silicon to software" tracker, and
// ⭐ D117 · LEARN AS A CIRCLE.
//
// /atlas/learn (and /app/atlas/learn). Four views: ⭐ The circle (D117 — the default: the 108 pieces on one ring, guided
// routes, the piece panel; LearnCircle.jsx), and the tracker's own three — Learning path (Step 1 → 108, one way round the
// circle, never removed: parts → phases → steps, each step's body the same piece panel), LeetCode pattern atlas,
// Concept index (searched through the ONE normaliser). Its words are verbatim (GET /api/learn); the circle's overlay is
// GET /api/learn/circle.
// ⭐ D117 C6 · ENTRY FROM ANYWHERE: an Atlas page's "Learn it", D114's popup, Your map's "Enter the course here", the
// concept index — all land on #step-<id>, and THAT PIECE opens in the circle (never the start of the path).
// ⭐ D117 C8 · PROGRESS IS EARNED, NOT TICKED: signed in, opening an item's link from here records it (POST
// /api/learn/opened), a checkpoint takes the user's own explanation, a build its link; the bar fills from that. There
// is no checkbox and no "done" button. Signed out, nothing is recorded (D115's browser ticks are no longer kept).
// ⛔ Links only: every resource opens at its source.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api.js";
import { flatSteps, phaseNumbers, stepState, nextStep, coreCounts, searchConcepts, piecesOf, unlockLine, entryFromHash, circleState } from "./learnModel.js";
import LearnCircle, { PieceBody } from "./LearnCircle.jsx";
import "./LearnView.css";

const TABS = [["circle", "The circle"], ["path", "Learning path"], ["patterns", "LeetCode pattern atlas"], ["concepts", "Concept index"]];
const NONE = Object.freeze({ marks: {}, explanations: {}, builds: {}, ticked: 0 });
const fail = (e) => ({ ok: false, message: e?.payload?.message || e?.message || "Could not save it just now." });

/** The learner's EARNED record (signed in) and the three things they can do — open, explain, build. */
function useEarned(signedIn) {
  const [earned, setEarned] = useState(NONE);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(signedIn ? "account" : "browser");
  useEffect(() => {
    if (!signedIn) { setEarned(NONE); setSaved("browser"); return undefined; }
    let live = true;
    api("/api/learn/earned").then(r => { if (live) { setEarned({ ...NONE, ...r }); setSaved("account"); } }).catch(() => live && setSaved("unsaved"));
    return () => { live = false; };
  }, [signedIn]);
  const told = useCallback((r) => {
    if (!r?.finished) return;
    setNotice(unlockLine(r.unlocked));
    setTimeout(() => setNotice(""), 4500);
  }, []);
  const mark = useCallback((id) => setEarned(e => ({ ...e, marks: { ...e.marks, [id]: e.marks[id] || Math.floor(Date.now() / 1000) } })), []);
  // The link's own click is what counts — the page sends it as the link opens (the other site is never tracked).
  const onOpen = useCallback((it) => {
    if (!signedIn || !it?.u) return;
    api("/api/learn/opened", { method: "POST", body: JSON.stringify({ id: it.id }), keepalive: true })
      .then(r => { mark(it.id); told(r); }).catch(() => setSaved("unsaved"));
  }, [signedIn, mark, told]);
  const onExplain = useCallback(async (id, text, pasted) => {
    try {
      const r = await api("/api/learn/explained", { method: "PUT", body: JSON.stringify({ id, text, pasted }) });
      const now = Math.floor(Date.now() / 1000);
      setEarned(e => ({ ...e, marks: { ...e.marks, [id]: now }, explanations: { ...e.explanations, [id]: { text, words: r.words, at: e.explanations[id]?.at || now, updated: now } } }));
      told(r);
      return r;
    } catch (e) { return fail(e); }
  }, [told]);
  const onBuild = useCallback(async (step, url, kind) => {
    try {
      const r = await api("/api/learn/built", { method: "PUT", body: JSON.stringify({ step, url, kind }) });
      const now = Math.floor(Date.now() / 1000);
      setEarned(e => ({ ...e, marks: { ...e.marks, [`${step}#build`]: now }, builds: { ...e.builds, [step]: { url, kind, at: now, updated: now } } }));
      told(r);
      return r;
    } catch (e) { return fail(e); }
  }, [told]);
  return { earned, notice, saved, onOpen, onExplain, onBuild };
}

function StepGrid({ steps, marks, next, phaseNo, onJump }) {
  let lastPhase = null;
  return (
    <nav className="lrn__grid" aria-label="All steps, grouped by phase" data-learn-grid="">
      {steps.map(s => {
        const st = stepState(s, marks);
        const label = phaseNo.get(s.phaseId);
        const head = s.phaseId !== lastPhase ? (lastPhase = s.phaseId, <span key={`h-${s.phaseId}`} className="lrn__grid-num" aria-hidden="true">{label}</span>) : null;
        const cs = circleState(st);
        const cls = ["lrn__cell", cs === "filled" ? "is-done" : cs === "half" ? "is-started" : "", next?.id === s.id ? "is-next" : "", s.lv === "a" ? "is-adv" : ""].filter(Boolean).join(" ");
        return [head, <button key={s.id} type="button" className={cls} onClick={() => onJump(s.id)} data-learn-cell={s.id}
          aria-label={`Step ${s.n}: ${s.t}${cs === "filled" ? ", finished" : cs === "half" ? ", started" : ""}${s.lv === "a" ? ", advanced" : ""}`} />];
      })}
    </nav>
  );
}

function LearnStep({ s, pieces, states, earned, signedIn, actions, open, setOpen, onJump }) {
  const st = states.get(s.id);
  return (
    <li id={`step-${s.id}`} className={`lrn__step${s.lv === "a" ? " is-advanced" : ""}`} data-learn-step={s.id}>
      <details open={open} onToggle={(e) => setOpen(s.id, e.currentTarget.open)}>
        <summary>
          <span className="lrn__step-num">Step {s.n}{s.lv && <span className={`mark ${s.lv === "a" ? "mark--warn" : "mark--dim"}`}>{s.lv === "a" ? "Advanced" : "Basics"}</span>}</span>
          <span className="lrn__step-t">{s.t}</span>
          <span className="atl__quiet">{st.bar} %</span>
        </summary>
        {s.g && <p className="lrn__goal">{s.g}</p>}
        {open && <PieceBody compact piece={s} pieces={pieces} states={states} marks={earned.marks} explanations={earned.explanations} builds={earned.builds}
          signedIn={signedIn} onSelect={onJump} {...actions} />}
        <button type="button" className="lrn__jump" onClick={() => onJump(s.id)}>Open it on the circle</button>
      </details>
    </li>
  );
}

export default function LearnView({ signedIn = false }) {
  const location = useLocation();
  const [learn, setLearn] = useState(null);
  const [circle, setCircle] = useState(null);
  const [myRoute, setMyRoute] = useState(null);
  const [err, setErr] = useState("");
  const [entry, setEntry] = useState(() => entryFromHash(location.hash));
  const [tab, setTab] = useState("circle");
  const [hideDone, setHideDone] = useState(false);
  const [basicsOnly, setBasicsOnly] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [q, setQ] = useState("");
  const { earned, notice, saved, onOpen, onExplain, onBuild } = useEarned(signedIn);

  useEffect(() => {
    let live = true;
    Promise.all([api("/api/learn"), api("/api/learn/circle").catch(() => ({ pieces: {}, routes: [] }))])
      .then(([l, c]) => { if (live) { setLearn(l); setCircle(c); } }).catch(e => live && setErr(e.message));
    return () => { live = false; };
  }, []);
  const steps = useMemo(() => flatSteps(learn), [learn]);
  const pieces = useMemo(() => (learn ? piecesOf(learn, circle) : []), [learn, circle]);
  const states = useMemo(() => new Map(pieces.map(p => [p.id, stepState(p, earned.marks)])), [pieces, earned.marks]);
  const phaseNo = useMemo(() => phaseNumbers(learn), [learn]);
  const next = nextStep(pieces, earned.marks, { basicsOnly });
  const core = coreCounts(pieces, earned.marks);
  const setOpen = useCallback((id, open) => setOpenIds(cur => { const n = new Set(cur); if (open) n.add(id); else n.delete(id); return n; }), []);
  // ⭐ C6: every jump — the grid, Up next, a pattern's or a term's step, an entry from elsewhere — opens THAT piece.
  const jump = useCallback((id) => { setEntry(id); setTab("circle"); }, []);
  useEffect(() => { const id = entryFromHash(location.hash); if (id) jump(id); }, [location.hash, jump]);
  const wantMyRoute = useCallback(() => { api("/api/learn/circle/my-route").then(setMyRoute).catch(() => setMyRoute({ name: null, targets: [] })); }, []);

  if (err) return <p className="atl__quiet" role="alert">Learn could not be loaded: {err}</p>;
  if (!learn) return <p className="atl__quiet" role="status">Opening Learn…</p>;
  const c = learn.copy || {};
  const allOpen = steps.length > 0 && steps.every(s => openIds.has(s.id));
  const shown = (s) => !(basicsOnly && s.lv === "a") && !(hideDone && states.get(s.id)?.complete);
  const concepts = searchConcepts(learn.INDEX, q);
  const stepById = new Map(steps.map(s => [s.id, s]));
  const actions = { onOpen, onExplain, onBuild };

  return (
    <div className="lrn" data-learn="">
      <header className="atl__head">
        <p className="atl__kicker">Learn · in the Atlas</p>
        <h1 className="atl__title">{c.title}</h1>
        <p className="atl__lede">{c.lede}</p>
        <p className="atl__lede"><b>{pieces.length} pieces</b> on one circle. Start anywhere. Go back to understand, go forward to grow, or go all the way round.</p>
      </header>

      <div className="lrn__tabs" role="tablist" aria-label="Views">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`lrn__tab${tab === id ? " is-on" : ""}`} onClick={() => setTab(id)} data-learn-tab={id}>{label}</button>
        ))}
      </div>

      {tab === "circle" && (
        <section role="tabpanel" aria-label="The circle" data-learn-panel="circle">
          <LearnCircle key={entry || "start"} learn={learn} pieces={pieces} circle={circle} earned={earned} signedIn={signedIn} initialSel={entry || next?.id}
            myRoute={myRoute} notice={notice} onWantMyRoute={wantMyRoute} {...actions} />
        </section>
      )}

      {tab === "path" && (
        <section role="tabpanel" aria-label="Learning path" data-learn-panel="path">
          <StepGrid steps={pieces.filter(s => !(basicsOnly && s.lv === "a"))} marks={earned.marks} next={next} phaseNo={phaseNo} onJump={jump} />
          <p className="atl__quiet" data-learn-legend="">Numbers are phases. A filled square is a finished step, a half-filled one is started, the ringed one is next, and dashed ones are advanced steps.</p>
          <p className="atl__quiet" aria-live="polite">{core.done} of {core.total} core resources opened.</p>
          {next ? (
            <p className="lrn__next" data-learn-next={next.id}>
              <b>Up next:</b> <button type="button" className="lrn__jump" onClick={() => jump(next.id)}>Step {next.n}: {next.t}</button>
              <span className="atl__quiet"> · Part {next.partIndex} · {next.phase}</span>
            </p>
          ) : <p className="atl__quiet">Every step is finished.{basicsOnly ? " Turn off “Basics first” for the advanced steps." : ""}</p>}
          <p className="lrn__intro">{c.intros?.path}</p>
          <div className="lrn__toolbar">
            <label className="lrn__switch"><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} data-learn-hide-done="" /> Hide finished items</label>
            <label className="lrn__switch"><input type="checkbox" checked={basicsOnly} onChange={e => setBasicsOnly(e.target.checked)} data-learn-basics="" /> Basics first: hide advanced steps</label>
            <button type="button" className="lrn__jump" onClick={() => setOpenIds(allOpen ? new Set() : new Set(steps.map(s => s.id)))} data-learn-open-all="">{allOpen ? "Close all steps" : "Open all steps"}</button>
          </div>
          {learn.PARTS.map((part, pi) => (
            <div key={pi} className="lrn__part">
              <h2 className="atl__h2">{part.t}</h2>
              {(part.phases || []).map(ph => {
                const list = pieces.filter(s => s.phaseId === ph.id && shown(s));
                if (!list.length) return null;
                return (
                  <div key={ph.id} className="lrn__phase">
                    <h3 className="lrn__phase-h"><span className="lrn__grid-num">{phaseNo.get(ph.id)}</span> {ph.t}</h3>
                    <ol className="lrn__steps">{list.map(s => <LearnStep key={s.id} s={s} pieces={pieces} states={states} earned={earned} signedIn={signedIn}
                      actions={actions} open={openIds.has(s.id)} setOpen={setOpen} onJump={jump} />)}</ol>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {tab === "patterns" && (
        <section role="tabpanel" aria-label="LeetCode pattern atlas" data-learn-panel="patterns">
          <p className="lrn__intro">{c.intros?.patterns}</p>
          <ul className="lrn__patterns">
            {(learn.ATLAS || []).map(p => (
              <li key={p.id} className="lrn__pattern" data-learn-pattern={p.id}>
                <h3 className="lrn__phase-h">{p.n}</h3>
                {p.line && <p className="lrn__goal">{p.line}</p>}
                {p.idea && <p><b>The idea.</b> {p.idea}</p>}
                {p.why && <p><b>Why it matters.</b> {p.why}</p>}
                {p.where?.length > 0 && <><p><b>Where it runs.</b></p><ul className="lrn__where">{p.where.map((w, i) => <li key={i}>{w}</li>)}</ul></>}
                {p.spot && <p><b>How to spot it.</b> {p.spot}</p>}
                {p.pr?.length > 0 && <p className="lrn__practice"><b>Practice.</b> {p.pr.map(([t, slug], i) => <span key={slug}>{i ? " · " : ""}<a className="atl__link" href={`https://leetcode.com/problems/${slug}/`} target="_blank" rel="noopener noreferrer">{t}</a></span>)}</p>}
                {stepById.get(p.st) && <p className="atl__quiet">Taught in <button type="button" className="lrn__jump" onClick={() => jump(p.st)}>Step {stepById.get(p.st).n}: {stepById.get(p.st).t}</button></p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "concepts" && (
        <section role="tabpanel" aria-label="Concept index" data-learn-panel="concepts">
          <p className="lrn__intro">{c.intros?.concepts}</p>
          <input className="lrn__search" type="search" value={q} onChange={e => setQ(e.target.value)} aria-label="Search terms"
            placeholder="Search, for example “cache”, “TLS” or “embedding”" autoComplete="off" data-learn-search="" />
          <p className="atl__quiet" aria-live="polite">{concepts.length} of {learn.INDEX.length} terms</p>
          <ul className="lrn__terms">
            {concepts.map(t => (
              <li key={t.term} data-learn-term={t.term}>
                <b>{t.term}</b> — {t.def}
                {stepById.get(t.st) && <span className="atl__quiet"> · <button type="button" className="lrn__jump" onClick={() => jump(t.st)}>Step {stepById.get(t.st).n}: {stepById.get(t.st).t}</button></span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="lrn__foot">
        <p className="atl__quiet" data-learn-saved={saved}>{saved === "account"
          ? `Progress is earned and saved to your account: what you open from here, explain in your own words and link as built.${earned.ticked ? ` The ${earned.ticked} item${earned.ticked === 1 ? "" : "s"} you ticked before are kept, and no longer count.` : ""}`
          : saved === "browser" ? "Sign in and draft records what you open, explain and build — progress is earned, never ticked." : "Progress could not be saved just now."}</p>
        {c.linksNote && <p className="atl__quiet">{c.linksNote}</p>}
      </footer>
    </div>
  );
}
