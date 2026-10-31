// client/src/pages/atlas/LearnView.jsx — ⭐ D115 P2–P3 · LEARN, the owner's "From silicon to software" tracker, as is.
//
// /atlas/learn (and /app/atlas/learn). Three views, the tracker's own: Learning path (parts → phases → steps: the goal,
// the items by kind with optional ones marked, the checkpoints — "answer out loud as if teaching a friend"),
// LeetCode pattern atlas, Concept index (searched through the ONE normaliser). The tracker's controls: Up next, Hide
// finished items, Basics first (its lv 'a' steps hidden), Open all steps. Its words are verbatim (GET /api/learn).
// PROGRESS (P3): signed in → the account (GET / PUT /api/learn/progress, so it follows the person); signed out → this
// browser (try/catch-guarded), offered to the account on sign-in. The step grid is draft's: rounded squares in the
// bubble standard's shape (D113 UI), draft's tokens and four themes — not the tracker's palette or fonts.
// ⛔ Links only: every resource opens at its source.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api.js";
import { flatSteps, phaseNumbers, stepState, nextStep, coreCounts, searchConcepts, checkpointId, readLocal, writeLocal, clearLocal,
  localAsImport } from "./learnModel.js";
import "./LearnView.css";

const KIND_ORDER = ["Video", "Playlist", "Article", "Book", "Course", "Guide", "Sandbox", "Practice", "Lab", "Build", "Project", "Atlas"];
const TABS = [["path", "Learning path"], ["patterns", "LeetCode pattern atlas"], ["concepts", "Concept index"]];

/** The learner's marks: the account's when signed in (the browser's are offered to it once), else the browser's. */
function useMarks(signedIn) {
  const [marks, setMarks] = useState(() => (signedIn ? {} : readLocal()));
  const [saved, setSaved] = useState(signedIn ? "account" : "browser");
  useEffect(() => {
    if (!signedIn) { setMarks(readLocal()); setSaved("browser"); return undefined; }
    let live = true;
    (async () => {
      const local = readLocal();
      if (Object.keys(local).length) {
        try { await api("/api/learn/progress/import", { method: "POST", body: JSON.stringify({ marks: localAsImport(local) }) }); clearLocal(); } catch { /* kept for next time */ }
      }
      try { const r = await api("/api/learn/progress"); if (live) setMarks(Object.fromEntries((r.marks || []).map(m => [m.id, m.at]))); setSaved("account"); }
      catch { if (live) setSaved("unsaved"); }
    })();
    return () => { live = false; };
  }, [signedIn]);
  const toggle = useCallback((id) => {
    setMarks(cur => {
      const on = !cur[id];
      const next = { ...cur };
      if (on) next[id] = Math.floor(Date.now() / 1000); else delete next[id];
      if (signedIn) api("/api/learn/progress", { method: "PUT", body: JSON.stringify({ id, on }) }).catch(() => setSaved("unsaved"));
      else if (!writeLocal(next)) setSaved("unsaved");
      return next;
    });
  }, [signedIn]);
  return { marks, toggle, saved };
}

function StepGrid({ steps, marks, next, phaseNo, onJump }) {
  let lastPhase = null;
  return (
    <nav className="lrn__grid" aria-label="All steps, grouped by phase" data-learn-grid="">
      {steps.map(s => {
        const st = stepState(s, marks);
        const label = phaseNo.get(s.phaseId);
        const head = s.phaseId !== lastPhase ? (lastPhase = s.phaseId, <span key={`h-${s.phaseId}`} className="lrn__grid-num" aria-hidden="true">{label}</span>) : null;
        const cls = ["lrn__cell", st.complete ? "is-done" : st.started ? "is-started" : "", next?.id === s.id ? "is-next" : "", s.lv === "a" ? "is-adv" : ""].filter(Boolean).join(" ");
        return [head, <button key={s.id} type="button" className={cls} onClick={() => onJump(s.id)} data-learn-cell={s.id}
          aria-label={`Step ${s.n}: ${s.t}${st.complete ? ", finished" : st.started ? ", started" : ""}${s.lv === "a" ? ", advanced" : ""}`} />];
      })}
    </nav>
  );
}

function Item({ it, on, toggle }) {
  return (
    <li className="lrn__item" data-learn-item={it.id}>
      <label className="lrn__check">
        <input type="checkbox" checked={!!on} onChange={() => toggle(it.id)} aria-label={`Done: ${it.t}`} />
      </label>
      <span>
        {it.u ? <a className="atl__link" href={it.u} target="_blank" rel="noopener noreferrer">{it.t}</a> : <b>{it.t}</b>}
        {it.s && <span className="atl__quiet"> · {it.s}</span>}
        {it.o ? <span className="mark mark--dim lrn__opt">optional</span> : null}
        {it.n && <span className="lrn__note">{it.n}</span>}
      </span>
    </li>
  );
}

function LearnStep({ s, marks, toggle, open, setOpen }) {
  const st = stepState(s, marks);
  const kinds = [...new Set((s.items || []).map(it => it.k))].sort((a, b) => (KIND_ORDER.indexOf(a) + 99) % 99 - (KIND_ORDER.indexOf(b) + 99) % 99);
  return (
    <li id={`step-${s.id}`} className={`lrn__step${s.lv === "a" ? " is-advanced" : ""}`} data-learn-step={s.id}>
      <details open={open} onToggle={(e) => setOpen(s.id, e.currentTarget.open)}>
        <summary>
          <span className="lrn__step-num">Step {s.n}{s.lv && <span className={`mark ${s.lv === "a" ? "mark--warn" : "mark--dim"}`}>{s.lv === "a" ? "Advanced" : "Basics"}</span>}</span>
          <span className="lrn__step-t">{s.t}</span>
          <span className="atl__quiet">{st.done} of {st.total}</span>
        </summary>
        {s.g && <p className="lrn__goal">{s.g}</p>}
        {kinds.map(k => (
          <div key={k} className="lrn__kind">
            <h4 className="lrn__kind-h">{k}</h4>
            <ul className="lrn__items">{(s.items || []).filter(it => it.k === k).map(it => <Item key={it.id} it={it} on={marks[it.id]} toggle={toggle} />)}</ul>
          </div>
        ))}
        {(s.c || []).length > 0 && (
          <div className="lrn__kind">
            <h4 className="lrn__kind-h">Checkpoints — answer out loud as if teaching a friend</h4>
            <ul className="lrn__items">
              {s.c.map((c, i) => {
                const id = checkpointId(s.id, i);
                return (
                  <li key={id} className="lrn__item" data-learn-checkpoint={id}>
                    <label className="lrn__check"><input type="checkbox" checked={!!marks[id]} onChange={() => toggle(id)} aria-label={`Explained: ${c}`} /></label>
                    <span>{c}{marks[id] ? <span className="atl__quiet"> · explained {new Date(marks[id] * 1000).toLocaleDateString()}</span> : null}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </details>
    </li>
  );
}

export default function LearnView({ signedIn = false }) {
  const location = useLocation();
  const [learn, setLearn] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("path");
  const [hideDone, setHideDone] = useState(false);
  const [basicsOnly, setBasicsOnly] = useState(false);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [q, setQ] = useState("");
  const { marks, toggle, saved } = useMarks(signedIn);

  useEffect(() => { let live = true; api("/api/learn").then(d => live && setLearn(d)).catch(e => live && setErr(e.message)); return () => { live = false; }; }, []);
  const steps = useMemo(() => flatSteps(learn), [learn]);
  const phaseNo = useMemo(() => phaseNumbers(learn), [learn]);
  const next = nextStep(steps, marks, { basicsOnly });
  const core = coreCounts(steps, marks);
  const setOpen = useCallback((id, open) => setOpenIds(cur => { const n = new Set(cur); if (open) n.add(id); else n.delete(id); return n; }), []);
  const jump = useCallback((id) => {
    setTab("path"); setOpen(id, true);
    setTimeout(() => document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }, [setOpen]);
  // An Atlas page's "Learn it: Part 3 · … · Step 2" (and D114's popup) lands on #step-<id>, opened.
  useEffect(() => { const m = location.hash.match(/^#step-(.+)$/); if (m && steps.length) jump(decodeURIComponent(m[1])); }, [location.hash, steps.length, jump]);

  if (err) return <p className="atl__quiet" role="alert">Learn could not be loaded: {err}</p>;
  if (!learn) return <p className="atl__quiet" role="status">Opening Learn…</p>;
  const c = learn.copy || {};
  const allOpen = steps.length > 0 && steps.every(s => openIds.has(s.id));
  const shown = (s) => !(basicsOnly && s.lv === "a") && !(hideDone && stepState(s, marks).complete);
  const concepts = searchConcepts(learn.INDEX, q);
  const stepById = new Map(steps.map(s => [s.id, s]));

  return (
    <div className="lrn" data-learn="">
      <header className="atl__head">
        <p className="atl__kicker">Learn · in the Atlas</p>
        <h1 className="atl__title">{c.title}</h1>
        <p className="atl__lede">{c.lede}</p>
      </header>
      <StepGrid steps={steps.filter(s => !(basicsOnly && s.lv === "a"))} marks={marks} next={next} phaseNo={phaseNo} onJump={jump} />
      <p className="atl__quiet" data-learn-legend="">Numbers are phases. A filled square is a finished step, a half-filled one is started, the ringed one is next, and dashed ones are advanced steps.</p>
      <p className="atl__quiet" aria-live="polite">{core.done} of {core.total} core resources done.</p>

      <section className="atl__section" aria-labelledby="lrn-next">
        <h2 className="atl__h2" id="lrn-next">Up next</h2>
        {next ? (
          <p className="lrn__next" data-learn-next={next.id}>
            <button type="button" className="lrn__jump" onClick={() => jump(next.id)}>Step {next.n}: {next.t}</button>
            <span className="atl__quiet"> · Part {next.partIndex} · {next.phase}</span>
            {next.g && <span className="lrn__note">{next.g}</span>}
          </p>
        ) : <p className="atl__quiet">Every step is finished.{basicsOnly ? " Turn off “Basics first” for the advanced steps." : ""}</p>}
      </section>

      <div className="lrn__tabs" role="tablist" aria-label="Views">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`lrn__tab${tab === id ? " is-on" : ""}`} onClick={() => setTab(id)} data-learn-tab={id}>{label}</button>
        ))}
      </div>

      {tab === "path" && (
        <section role="tabpanel" aria-label="Learning path" data-learn-panel="path">
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
                const list = steps.filter(s => s.phaseId === ph.id && shown(s));
                if (!list.length) return null;
                return (
                  <div key={ph.id} className="lrn__phase">
                    <h3 className="lrn__phase-h"><span className="lrn__grid-num">{phaseNo.get(ph.id)}</span> {ph.t}</h3>
                    <ol className="lrn__steps">{list.map(s => <LearnStep key={s.id} s={s} marks={marks} toggle={toggle} open={openIds.has(s.id)} setOpen={setOpen} />)}</ol>
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
        <p className="atl__quiet" data-learn-saved={saved}>{saved === "account" ? "Progress is saved to your account." : saved === "browser" ? "Progress is saved in this browser — sign in and it moves to your account." : "Progress could not be saved just now."}</p>
        {c.linksNote && <p className="atl__quiet">{c.linksNote}</p>}
      </footer>
    </div>
  );
}
