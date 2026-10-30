// ── A104 · START FROM YOUR RÉSUMÉ — the first screen of a new account ─────────────────────────────────────
// One drop (or one pick) → POST /api/domain-profiles/from-resume: the first job profile (domain, level, titles,
// keywords read from the résumé), the résumé as its base, the profile's sections and empty contact fields. The board
// and the deck work on the next screen. The five-step wizard stays one press away, for anyone who prefers it.
import { useRef, useState } from "react";
import { api } from "../lib/api.js";
import { parseResumeFile } from "../lib/parseResumeFile.js";
import { C } from "../styles/colorTokens.js";

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
    <div data-start-from-resume="" onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); start(e.dataTransfer.files?.[0]); }}
      style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start", padding: compact ? 0 : 4,
        outline: over ? `2px dashed ${C.ACCENT_INK}` : "none", outlineOffset: 6, borderRadius: 6 }}>
      <input ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; start(f); }} />
      <button type="button" className="dbx-depth" disabled={busy} onClick={() => input.current?.click()}
        style={{ border: "none", padding: "10px 16px", background: C.ACCENT, color: C.ON_ACCENT, fontWeight: 800, cursor: busy ? "wait" : "pointer", fontFamily: "inherit" }}>
        {busy ? "Reading…" : "Upload your résumé"}
      </button>
      <span style={{ fontSize: 12.5, color: C.INK_MUTED, lineHeight: 1.5 }}>
        PDF or Word — or drop it here. draft reads your field, level, titles and skills from it and sets up your first job profile.
      </span>
      {msg && <span role="status" style={{ fontSize: 12.5, color: C.INK }}>{msg}</span>}
      {onManual && (
        <button type="button" onClick={onManual} style={{ border: 0, background: "none", padding: 0, color: C.ACCENT_INK,
          fontWeight: 700, fontSize: 12.5, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>
          Set it up by hand instead
        </button>
      )}
    </div>
  );
}
