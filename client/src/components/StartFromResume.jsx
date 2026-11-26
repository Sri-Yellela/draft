// ── A104 · START FROM YOUR RÉSUMÉ — the first screen of a new account ─────────────────────────────────────
// One drop (or one pick) → POST /api/domain-profiles/from-resume: the first job profile (domain, level, titles,
// keywords read from the résumé), the résumé as its base, the profile's sections and empty contact fields. The board
// and the deck work on the next screen. The five-step wizard stays one press away, for anyone who prefers it.
import { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { parseResumeFile } from "../lib/parseResumeFile.js";
// ⛔ 47j w1-market (D197 Wave 1 #2): drawn as plate pieces (.pl-btn, .pl-mk-notice, .pl-mk-drop — plate/plate.css); it is
// the deck's empty state on the plate market (its one mount). The upload, its route and its words are unchanged.

const LEVEL = { junior: "entry level", mid: "mid level", senior: "senior", executive: "executive" };

export default function StartFromResume({ onDone, onManual, compact = false }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [over, setOver] = useState(false);

  const start = async (file) => {
    if (!file) return;
    setBusy(true); setMsg(`Reading ${file.name}…`);
    try {
      const text = await parseResumeFile(file);
      if (!String(text || "").trim()) throw new Error("No text could be read from that file — try the PDF or Word version.");
      const r = await api("/api/domain-profiles/from-resume", { method: "POST", body: JSON.stringify({ content: text, name: file.name }) });
      const i = r.inferred || {};
      setMsg(`Set up as ${i.profileName || "your job profile"} · ${LEVEL[i.seniority] || i.seniority || ""}${i.titles?.length ? ` · ${i.titles.slice(0, 3).join(", ")}` : ""}. You can refine it any time.`);
      onDone?.(r);
    } catch (e) {
      setMsg(e.message || "Could not read that résumé.");
    } finally { setBusy(false); }
  };

  return (
    <div data-start-from-resume="" className={compact ? "pl-mk-drop pl-mk-drop--compact" : "pl-mk-drop"} data-over={over ? "true" : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); start(e.dataTransfer.files?.[0]); }}>
      <input ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; start(f); }} />
      <button type="button" className="pl-btn pl-btn--primary" disabled={busy} aria-busy={busy || undefined} onClick={() => input.current?.click()}>
        {busy ? "Reading…" : "Upload your résumé"}
      </button>
      <span className="pl-mk-notice">
        PDF or Word — or drop it here. draft reads your field, level, titles and skills from it and sets up your first job profile.
      </span>
      {msg && <span role="status" className="pl-mk-notice pl-mk-notice--ink">{msg}</span>}
      {/* ⭐ D150 T08: the first screen offers the 3-minute audit beside the résumé — either order leads to the map. */}
      <a href="/audit" data-start-audit="" className="pl-mk-notice__link">Or take the 3-minute audit first</a>
      {onManual && (
        <button type="button" onClick={onManual} className="pl-mk-notice__link">
          Set it up by hand instead
        </button>
      )}
    </div>
  );
}
