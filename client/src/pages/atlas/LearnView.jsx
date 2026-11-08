// client/src/pages/atlas/LearnView.jsx — ⭐ D115 P2–P3 · LEARN, the owner's "From silicon to software" tracker, and
// ⭐ D117 · LEARN AS A CIRCLE.
//
// ⭐ D178 · THE CIRCLE, AND ONLY THE CIRCLE: the course page's "The circle" view (/atlas/library/silicon-to-software?view=circle;
// /atlas/learn redirects there). The 108 pieces on one ring, guided routes, the piece panel (LearnCircle.jsx) — where a
// piece's links are opened, its checkpoints explained and its build linked. The tracker's other three views moved to their
// homes (the translation table): Learning path → the course's Modules view · LeetCode pattern atlas → its own course
// (Coding interview patterns) · Concept index → Explore → Glossary. Its words are verbatim (GET /api/learn); the
// circle's overlay is GET /api/learn/circle.
// ⭐ D117 C6 · ENTRY FROM ANYWHERE: an Atlas page's "Learn it", D114's popup, Your map's "Enter the course here", the
// concept index — all land on #step-<id>, and THAT PIECE opens in the circle (never the start of the path).
// ⭐ D117 C8 · PROGRESS IS EARNED, NOT TICKED: signed in, opening an item's link from here records it (POST
// /api/learn/opened), a checkpoint takes the user's own explanation, a build its link; the bar fills from that. There
// is no checkbox and no "done" button. Signed out, nothing is recorded (D115's browser ticks are no longer kept).
// ⛔ Links only: every resource opens at its source.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../lib/api.js";
import { nextStep, piecesOf, unlockLine, entryFromHash } from "./learnModel.js";
import LearnCircle from "./LearnCircle.jsx";
import "./LearnView.css";

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

export default function LearnView({ signedIn = false }) {
  const location = useLocation();
  const [learn, setLearn] = useState(null);
  const [circle, setCircle] = useState(null);
  const [myRoute, setMyRoute] = useState(null);
  const [err, setErr] = useState("");
  const [entry, setEntry] = useState(() => entryFromHash(location.hash));
  const { earned, notice, saved, onOpen, onExplain, onBuild } = useEarned(signedIn);

  useEffect(() => {
    let live = true;
    Promise.all([api("/api/learn"), api("/api/learn/circle").catch(() => ({ pieces: {}, routes: [] }))])
      .then(([l, c]) => { if (live) { setLearn(l); setCircle(c); } }).catch(e => live && setErr(e.message));
    return () => { live = false; };
  }, []);
  const pieces = useMemo(() => (learn ? piecesOf(learn, circle) : []), [learn, circle]);
  const next = nextStep(pieces, earned.marks);
  // ⭐ C6: every way in — an Atlas page's "Learn it", the popup, the Glossary, a station — opens THAT piece.
  useEffect(() => { const id = entryFromHash(location.hash); if (id) setEntry(id); }, [location.hash]);
  const wantMyRoute = useCallback(() => { api("/api/learn/circle/my-route").then(setMyRoute).catch(() => setMyRoute({ name: null, targets: [] })); }, []);

  if (err) return <p className="atl__quiet" role="alert">Learn could not be loaded: {err}</p>;
  if (!learn) return <p className="atl__quiet" role="status">Opening Learn…</p>;
  const c = learn.copy || {};

  return (
    <div className="lrn" data-learn="">
      <p className="atl__lede"><b>{pieces.length} pieces</b> on one circle. Start anywhere. Go back to understand, go forward to grow, or go all the way round.</p>
      <section aria-label="The circle" data-learn-panel="circle">
        <LearnCircle key={entry || "start"} learn={learn} pieces={pieces} circle={circle} earned={earned} signedIn={signedIn} initialSel={entry || next?.id}
          myRoute={myRoute} notice={notice} onWantMyRoute={wantMyRoute} onOpen={onOpen} onExplain={onExplain} onBuild={onBuild} />
      </section>

      <footer className="lrn__foot">
        <p className="atl__quiet" data-learn-saved={saved}>{saved === "account"
          ? `Progress is earned and saved to your account: what you open from here, explain in your own words and link as built.${earned.ticked ? ` The ${earned.ticked} item${earned.ticked === 1 ? "" : "s"} you ticked before are kept, and no longer count.` : ""}`
          : saved === "browser" ? "Sign in and draft records what you open, explain and build — progress is earned, never ticked." : "Progress could not be saved just now."}</p>
        {c.linksNote && <p className="atl__quiet">{c.linksNote}</p>}
      </footer>
    </div>
  );
}
