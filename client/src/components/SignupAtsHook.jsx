// ── The signup hook: a real ATS check, before any account (queue 30) ────────────────────────
//
// docs/BRAND_OUTLAY_AND_MOTION.md §Login: "paste a job description, get a real score, now sign up to
// keep it." Value first, account second. It calls the public /api/standalone/ats — the SAME
// deterministic v4 scorer the board ranks by, free and unlimited (OWNER 23), ZERO model calls — and
// shows a BAND, never a number (G5). "Keep it" is literal: lib/signupCarry.js carries the scored
// résumé into the account created next, where Job Profiles offers it as the first base résumé.
import { useRef, useState } from "react";
import { C } from "../styles/colorTokens.js";
import { glass } from "../styles/glass.js";
import { AtsBandCard, fromStandaloneResult } from "./AtsReport.jsx";
import { carryResume } from "../lib/signupCarry.js";

export default function SignupAtsHook({ onKeep }) {
  const [file, setFile] = useState(null);
  const [jd, setJd] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const score = async (e) => {
    e.preventDefault();
    if (!file || !jd.trim()) { setError("Add your résumé (PDF) and paste a job posting."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      fd.append("jd_text", jd);
      const r = await fetch("/api/standalone/ats", { method: "POST", credentials: "include", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "That could not be scored.");
      setResult(d);
      carryResume(file, { band: d.band });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const field = { width: "100%", boxSizing: "border-box", borderRadius: 12, border: `1px solid ${C.BORDER_CONTROL}`,
                  background: C.SURFACE_INPUT, color: C.INK, fontSize: 13.5, fontFamily: "inherit", outline: "none" };

  return (
    <section aria-labelledby="ats-hook-title" data-ats-hook
      style={{ ...glass({ radius: 22 }), backgroundColor: C.SURFACE_SOLID, padding: "22px 22px 20px", width: "100%", maxWidth: 440, boxSizing: "border-box" }}>
      <div id="ats-hook-title" style={{ fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.1, color: C.INK }}>
        Try it before you sign up.
      </div>
      <p style={{ fontSize: 13.5, color: C.INK_MUTED, lineHeight: 1.55, margin: "8px 0 14px" }}>
        Your résumé and one posting, read the way an applicant-tracking system reads them. Free, no account,
        and nothing is sent anywhere.
      </p>
      {!result ? (
        <form onSubmit={score} style={{ display: "grid", gap: 10 }}>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ ...field, padding: "12px 14px", textAlign: "left", cursor: "pointer", borderStyle: "dashed", fontWeight: 700 }}>
            {file ? `✓ ${file.name}` : "Your résumé — PDF, up to 5 MB"}
          </button>
          <input ref={fileRef} type="file" accept=".pdf" aria-label="Your résumé (PDF)" style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={5} aria-label="The job posting"
            placeholder="Paste a job posting…" style={{ ...field, padding: "10px 14px", resize: "vertical", lineHeight: 1.5 }} />
          {error && <div role="alert" style={{ fontSize: 12.5, color: C.DANGER, fontWeight: 600 }}>{error}</div>}
          <button type="submit" disabled={busy}
            style={{ ...glass({ radius: 999 }), padding: "11px 0", fontWeight: 800, fontSize: 14, color: C.INK, cursor: busy ? "default" : "pointer" }}>
            {busy ? "Reading it…" : "Check the fit"}
          </button>
        </form>
      ) : (
        <div aria-live="polite">
          {/* A52: the band card from the ONE report implementation (components/AtsReport.jsx) — the
              band, what it means, why the scorer declined — not a hand-drawn copy of it. */}
          <AtsBandCard report={fromStandaloneResult(result)} band={result.band} compact />
          <p style={{ fontSize: 13.5, color: C.INK, lineHeight: 1.55, margin: "14px 0 12px" }}>
            Keep it: create an account and this résumé comes with you — every job on the board gets read against it,
            and ten good ones are dealt to you each day.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" onClick={onKeep}
              style={{ background: C.ACCENT, color: C.ON_ACCENT, border: `1px solid ${C.ACCENT_INK}`, borderRadius: 999,
                       padding: "10px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
              Create my account →
            </button>
            <button type="button" onClick={() => { setResult(null); }}
              style={{ background: "transparent", border: "none", color: C.ACCENT_INK, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Try another posting
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
