// ⭐ 47m · THE CHECKPOINT BOX AND THE BUILD LINK — one copy (A93), worn by a Gazetteer entry (AtlasGazetteer.jsx) and by the
// circle view of a route (LearnCircle.jsx, drawn inside the Gazetteer's plate pages). C8 (2): a checkpoint is explained in
// the reader's own words (>= 25, never a paste of 25+); C8 (3): the link to what was built (D109's proof-link rule on the server).
import { useState } from "react";
import { pasteVerdict } from "./learnModel.js";
import { wordCount, EXPLAIN_MIN_WORDS } from "../../../../shared/learnStepState.js";

/** One checkpoint, explained in the reader's own words (≥ 25 words, never a paste of 25+) — the circle's rule, kept. */
export function Explain({ id, question, saved, signedIn, onExplain }) {
  const [text, setText] = useState(saved?.text || "");
  const [pasted, setPasted] = useState(0);
  const [say, setSay] = useState("");
  const words = wordCount(text);
  if (!signedIn) return <li className="pl-gz-check" data-learn-checkpoint={id}><span className="pl-gz-check__q">{question}</span></li>;
  return (
    <li className="pl-gz-check" data-learn-checkpoint={id} data-done={saved ? "" : undefined}>
      <label className="pl-gz-check__q" htmlFor={`gz-exp-${id}`}>{question}</label>
      <textarea id={`gz-exp-${id}`} className="pl-gz-check__box" value={text} data-learn-explain={id} placeholder="Explain it in your own words, as if teaching a friend (25 words or more)"
        onChange={(e) => { setText(e.target.value); setSay(""); }}
        onPaste={(e) => { const v = pasteVerdict(e.clipboardData?.getData("text") || ""); if (v.refused) { e.preventDefault(); setSay(v.message); } else setPasted((p) => Math.max(p, v.words)); }}/>
      <div className="pl-gz-check__foot">
        <span aria-live="polite">{say || (saved ? `Explained · ${words} words` : `${words} of ${EXPLAIN_MIN_WORDS} words`)}</span>
        <button type="button" className="pl-btn" disabled={words < EXPLAIN_MIN_WORDS || text === saved?.text} data-learn-save={id}
          onClick={async () => { const r = await onExplain(id, text, pasted); setSay(r?.ok ? "Saved. The square lights when every checkpoint is explained." : r?.message || "Could not save it just now."); if (r?.ok) setPasted(0); }}>
          {saved ? "Save my changes" : "Save my explanation"}</button>
      </div>
    </li>
  );
}
export function BuildLink({ step, saved, onBuild, signedIn = true }) {
  const [url, setUrl] = useState(saved?.url || "");
  const [kind, setKind] = useState(saved?.kind || "repository");
  const [say, setSay] = useState("");
  return (
    <div data-learn-build={step}>
      <p className="pl-gz-empty">This entry asks you to build something. Link it (a repository or a live demo) to light it.</p>
      {signedIn ? <div className="pl-gz-build">
        <select className="pl-gz-input" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What the link is"><option value="repository">Repository</option><option value="demo">Live demo</option></select>
        <input type="url" className="pl-gz-input pl-gz-input--grow" value={url} onChange={(e) => { setUrl(e.target.value); setSay(""); }} placeholder="https://github.com/you/your-project" aria-label="The link to what you built"/>
        <button type="button" className="pl-btn" disabled={!url.trim() || url === saved?.url} data-learn-build-save="" onClick={async () => { const r = await onBuild(step, url.trim(), kind); setSay(r?.ok ? "Linked." : r?.message || "Could not save it just now."); }}>Save the link</button>
      </div> : null}
      {say ? <p className="pl-gz-foot" aria-live="polite">{say}</p> : null}
    </div>
  );
}
