// client/src/pages/tools/ATSToolPage.jsx — Standalone ATS scorer
import { useState, useRef } from "react";
// ⛔ `Link` WAS USED FOUR TIMES IN THIS FILE AND NEVER IMPORTED, so the page threw
// "ReferenceError: Link is not defined" the moment it rendered — it has never worked. Found while
// verifying the extension's ATS button in a real browser; a build succeeds because JSX compiles an
// undefined identifier to a runtime lookup, and nothing here is covered by a rendering test.
// That was the THIRD reason that button was broken, after the dead route and the ignored ?jd=.
import { Link, useSearchParams } from "react-router-dom";
import { useTheme } from "../../styles/theme.jsx";
import { Footer } from "../../components/Footer.jsx";
import ScrollDock from "../../components/ScrollDock.jsx";
import { C } from "../../styles/colorTokens.js";
import { AtsReport, fromStandaloneResult } from "../../components/AtsReport.jsx";

// ⛔ NO SCORE DONUT (09-30). It printed a Haiku model's own 0–100 on a ≥75/≥50 ramp — a different
// number, on a different scale, from the one the product ranks by. The route now runs the same v4
// scorer as the board and answers with a BAND; see server.js /api/standalone/ats.
//
// ⛔ A52 · AND THE SAME REPORT. This page drew its own copy — a band card and three chip rows —
// which had already drifted thinner than the board's (no competencies, no generic language, no
// matched verbs). It renders components/AtsReport.jsx now, the one implementation; the route's
// result is converted by fromStandaloneResult and the band the route computed is passed through.
// No claims here: there is no profile, so every chip is read-only.

export function ATSToolPage() {
  const { theme } = useTheme();
  // ?jd= IS THE JOB TEXT THE EXTENSION ALREADY READ. Its popup extracts the posting from the page
  // and encodes it into the URL; before this the page ignored it and opened an empty textarea, so
  // the extension's ATS button asked the user to paste in text it had already captured. The other
  // half of the same defect was that the URL pointed at /ats-score, which was never a route at all
  // (see App.jsx's legacy aliases and docs/EXTENSION_DIAGNOSIS.md §4) — fixing only one of the two
  // leaves the button still not working.
  //
  // Read as the INITIAL value, not synced: once the page is open the textarea is the user's, and a
  // later re-render must not overwrite an edit with the URL it arrived on.
  const [searchParams] = useSearchParams();
  const [pdfFile,   setPdfFile]   = useState(null);
  const [jdText,    setJdText]    = useState(() => searchParams.get("jd") || "");
  const [jobTitle,  setJobTitle]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState("");
  const fileRef = useRef();

  const submit = async () => {
    if (!pdfFile || !jdText.trim()) { setError("Upload a PDF and paste a job description."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("resume", pdfFile);
      fd.append("jd_text", jdText);
      if (jobTitle.trim()) fd.append("job_title", jobTitle.trim());
      const r = await fetch("/api/standalone/ats", { method: "POST", credentials: "include", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Scoring failed");
      setResult(d);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="scroll-dock-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column",
                  background: theme.bg, color: theme.text,
                  fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <ScrollDock variant="tools" />

      <main style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "48px 24px", width: "100%" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 900,
                     fontFamily: "'Barlow Condensed', sans-serif",
                     letterSpacing: "-1px", marginBottom: 10, color: theme.text }}>
          See how well your resume matches any job
        </h1>
        <p style={{ fontSize: 15, color: theme.textMuted, marginBottom: 36, lineHeight: 1.6 }}>
          Upload your resume and paste a job description. See how well they match — the same fit bands the job board ranks by — with the skills the posting asks for that your resume shows, and the ones it does not. Free, no account.
        </p>

        {/* Upload + JD */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* PDF upload */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${pdfFile ? theme.accent : theme.border}`,
              borderRadius: 10, padding: "28px 20px", textAlign: "center",
              cursor: "pointer", background: theme.surface,
              transition: "border-color 0.15s",
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }}
              onChange={e => setPdfFile(e.target.files?.[0] || null)}/>
            <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>
              {pdfFile ? `✓ ${pdfFile.name}` : "Click to upload your resume PDF"}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>PDF only · max 5 MB</div>
          </div>

          {/* The title is optional: the scorer reads it (seniority, and which term weights apply), and
              a pasted posting may not start with one. */}
          <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
            placeholder="Job title (optional — e.g. Backend Engineer)"
            style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${theme.border}`,
                     background: theme.surface, color: theme.text, fontSize: 13, outline: "none", boxSizing: "border-box" }}/>

          {/* JD text area */}
          <textarea
            value={jdText} onChange={e => setJdText(e.target.value)}
            placeholder="Paste the job description here…"
            rows={8}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 8,
              border: `1.5px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 13, resize: "vertical",
              outline: "none", boxSizing: "border-box", lineHeight: 1.6,
            }}
          />

          {error && <div style={{ fontSize: 12, color: C.DANGER, fontWeight: 600 }}>{error}</div>}

          <button onClick={submit} disabled={loading} style={{
            padding: "12px", borderRadius: 8, border: "none",
            background: loading ? theme.surfaceHigh : theme.accent,
            color: loading ? theme.textMuted : C.ON_ACCENT,
            fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
          }}>
            {loading ? "Matching…" : "Check my match"}
          </button>
        </div>

        {/* Results */}
        {result && (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}` }}>
              <AtsReport report={fromStandaloneResult(result)} band={result.band} />
            </div>

            <div style={{
              padding: "16px 20px", borderRadius: 8,
              background: theme.surfaceHigh, fontSize: 13, color: theme.text,
              border: `1px solid ${theme.border}`,
            }}>
              Want a version of your resume written for this job?{" "}
              <Link to="/tools/generate" style={{ color: theme.accentText, fontWeight: 700, textDecoration: "none" }}>
                Generate a focused resume →
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Upsell */}
      <section style={{ borderTop: `1px solid ${theme.border}`, padding: "48px 24px", background: theme.surface }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6, color: theme.text }}>
            You know where you stand. Here is what else Draft does.
          </h2>
          <p style={{ color: theme.textMuted, marginBottom: 28 }}>
            The full platform rewrites your resume, discovers matching jobs, and applies automatically.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
            {[
              { title: "AI Resume Generator", desc: "Rewrites your resume around this job, from what you have actually done" },
              { title: "Job Discovery",        desc: "A board ranked by how well each job fits you" },
              { title: "Auto Apply",            desc: "Apply to matched roles in one click" },
            ].map(f => (
              <div key={f.title} style={{ padding: 20, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg }}>
                <div style={{ fontWeight: 700, marginBottom: 6, color: theme.text }}>{f.title}</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{f.desc}</div>
              </div>
            ))}
          </div>
          <Link to="/login">
            <button style={{ padding: "10px 28px", borderRadius: 6, border: "none",
                             background: theme.accent, color: C.ON_ACCENT, fontWeight: 700, cursor: "pointer" }}>
              Get full access →
            </button>
          </Link>
        </div>
      </section>

      <Footer/>
    </div>
  );
}
