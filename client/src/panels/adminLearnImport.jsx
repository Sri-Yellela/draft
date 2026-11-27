// ⭐ D118 P2 · ADMIN → ATLAS → IMPORT CONTENT — the Learn content changes with no deploy and no restart.
//
// The owner picks his tracker page (.html) or the extracted JSON (.json):
//   · a PAGE is extracted HERE, in his browser, by the same extractor the script uses (shared/learnTracker.js), its data
//     block run in an origin-less sandboxed iframe with no network (adminLearnSandbox.js)
//   · ⛔ only the JSON is sent: the server never evaluates an upload (routes/learnAdmin.js, d118ServerNeverEvaluatesUpload).
// The server validates it against the schema and answers a DIFF by id — added / changed / removed phases, steps, items,
// patterns, concepts — and how many learners' marks sit on removed ids (kept, never deleted). Nothing is written until
// Apply; Apply carries the version the preview was made against, so a stale preview is refused.
//   GET /api/admin/learn/content · POST /api/admin/learn/import/preview { content } · POST …/import/apply { content, base }
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { Btn, row, quiet, sub, callout } from "./adminKit.jsx";
import { learnFileFromUpload } from "./adminLearnSandbox.js";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const KIND_WORDS = [["steps", "Steps"], ["items", "Items"], ["patterns", "Patterns"], ["concepts", "Concepts"], ["phases", "Phases"]];
const ids = (list) => (list.length > 12 ? `${list.slice(0, 12).join(", ")} … +${list.length - 12}` : list.join(", "));

function DiffView({ diff, progress }) {
  return (
    <div data-learn-diff="" style={{ display: "grid", gap: 4, fontSize: ts(12), color: C.INK }}>
      {diff.same && <span style={quiet}>Nothing changed — the file is what is live.</span>}
      {KIND_WORDS.map(([k, label]) => {
        const d = diff[k];
        if (!d.added.length && !d.changed.length && !d.removed.length) return null;
        return (
          <div key={k} data-learn-diff-kind={k}>
            <b>{label}</b>{" "}
            <span style={quiet}>+{d.added.length} added · {d.changed.length} changed · −{d.removed.length} removed</span>
            {d.added.length > 0 && <div style={quiet}>added: {ids(d.added)}</div>}
            {d.changed.length > 0 && <div style={quiet}>changed: {ids(d.changed)}</div>}
            {d.removed.length > 0 && <div style={quiet}>removed: {ids(d.removed)}</div>}
          </div>
        );
      })}
      {diff.parts && <span style={quiet}>The parts' names or order changed.</span>}
      {diff.copy && <span style={quiet}>The page's words (title, intro, legend) changed.</span>}
      {progress && (
        <span style={quiet} data-learn-diff-progress="">
          Learners' progress: {progress.marks} mark(s) from {progress.learners} learner(s) — all kept.
          {progress.onRemovedIds > 0 ? ` ${progress.onRemovedIds} sit on removed ids: they stay stored and count again if the id comes back.` : ""}
        </span>
      )}
    </div>
  );
}

export function AtlasImportContent({ say }) {
  const [live, setLive] = useState(null);
  const [picked, setPicked] = useState(null);   // { name, content }
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);
  const loadLive = useCallback(() => api("/api/admin/learn/content").then(setLive).catch(() => setLive(null)), []);
  useEffect(() => { loadLive(); }, [loadLive]);

  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { say({ ok: false, text: e.message }); } finally { setBusy(false); } };
  const pick = (file) => act(async () => {
    setPreview(null); setErrors(null); setPicked(null);
    if (!file) return;
    const content = await learnFileFromUpload(file);
    setPicked({ name: file.name, content });
    try { setPreview(await api("/api/admin/learn/import/preview", { method: "POST", body: JSON.stringify({ content }) })); }
    catch (e) { if (e.status === 400) { setErrors(e.payload?.errors || [{ at: "file", reason: e.message }]); return; } throw e; }
  });
  const apply = () => act(async () => {
    let r;
    try { r = await api("/api/admin/learn/import/apply", { method: "POST", body: JSON.stringify({ content: picked.content, base: preview.base }) }); }
    catch (e) {
      if (e.status === 409) { say({ ok: false, text: "The live content changed since this preview — pick the file again." }); setPreview(null); return; }
      if (e.status === 400) { setErrors(e.payload?.errors || [{ at: "file", reason: e.message }]); return; }
      throw e;
    }
    const a = r.atlas || {};
    say({ ok: true, text: `Learn content is live (version ${r.version}). Atlas: ${a.definitionsUpdated || 0} definition(s) updated, ${a.filled || 0} filled, ${a.conceptsAdded || 0} concept(s) and ${a.patternsAdded || 0} pattern(s) added, ${a.published || 0} published. Progress kept.` });
    setPicked(null); setPreview(null); loadLive();
  });

  return (
    <div data-learn-import="" style={{ ...sub, marginBottom: 12, display: "grid", gap: 8 }}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <b style={{ fontSize: ts(13), color: C.INK }}>Import content</b>
        {live && <span style={quiet} data-learn-live="">Live: version {live.version}{live.by ? ` · ${live.by}` : ""}{live.source?.counts ? ` · ${live.source.counts.steps} steps · ${live.source.counts.items} items · ${live.source.counts.patterns} patterns · ${live.source.counts.concepts} concepts` : ""}</span>}
      </div>
      <span style={quiet}>Pick the tracker page (.html) or its extracted JSON. A page is read here in your browser; only its data is sent. Nothing changes until you press Apply, and learners' progress is kept.</span>
      <input type="file" accept=".html,.htm,.json,text/html,application/json" disabled={busy} aria-label="Tracker page or JSON"
        onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} data-learn-file="" style={{ fontSize: ts(12), color: C.INK }} />
      {errors && <div style={callout(C.DANGER)} data-learn-errors="">Refused — nothing was saved: {errors.slice(0, 8).map(x => `${x.at}: ${x.reason}`).join(" · ")}{errors.length > 8 ? ` … +${errors.length - 8}` : ""}</div>}
      {preview && (
        <div style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: ts(12), color: C.INK }}>{picked?.name}: {preview.counts.steps} steps · {preview.counts.items} items · {preview.counts.patterns} patterns · {preview.counts.concepts} concepts</span>
          <DiffView diff={preview.diff} progress={preview.progress} />
          <div style={row}>
            <Btn size="compact" primary disabled={busy || preview.diff.same} onClick={apply} data-learn-apply="">Apply</Btn>
            <Btn size="compact" disabled={busy} onClick={() => { setPreview(null); setPicked(null); }} data-learn-cancel="">Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
