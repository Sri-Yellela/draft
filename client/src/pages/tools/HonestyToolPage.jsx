// client/src/pages/tools/HonestyToolPage.jsx — ⭐ D141 · THE RÉSUMÉ HONESTY CHECK (owner 11-02). Free, no account.
//
// "Will your AI résumé get you caught?" Upload any résumé — one another AI tool wrote included — and, optionally, the
// original it came from and the job it targets. Line by line: what the original does not support, the interview risk,
// and the fix — reword to what's true, or earn it. POST /api/standalone/honesty (services/honestyCheck.js); the server
// keeps nothing. A PDF is read on the server in memory; Word is read here (mammoth), text as is.
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../styles/theme.jsx";
import { PublicPage } from "../../components/PublicChrome.jsx";   // 47m (D197, M5): the plate public nav + footer replace the tools dock
import { C } from "../../styles/colorTokens.js";
import { markStyle } from "../../styles/mark.js";
import { ts } from "../../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size
import { carryResume } from "../../lib/signupCarry.js";   // D141 (46y): sign up to save and fix — the ATS hook's carry, reused

/** The checked résumé as a File the account's upload reads (a pasted text becomes resume.txt). Memory only. */
function checkedResumeFile(file, text) {
  if (file) return file;
  const t = String(text || "").trim();
  return t ? new File([t], "resume.txt", { type: "text/plain" }) : null;
}

const RISK = { high: { label: "High risk", colour: C.DANGER }, medium: { label: "Medium risk", colour: C.WARNING } };

async function addFile(fd, field, file, text) {
  if (file) {
    const ext = String(file.name || "").split(".").pop().toLowerCase();
    if (ext === "pdf") { fd.append(field, file); return; }
    if (ext === "docx") {
      const mammoth = (await import("mammoth")).default;
      fd.append(`${field}_text`, (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value);
      return;
    }
    fd.append(`${field}_text`, await file.text());
    return;
  }
  if (text.trim()) fd.append(`${field}_text`, text);
}

function FileOrText({ label, hint, file, setFile, text, setText, theme }) {
  const ref = useRef();
  const box = { width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${theme.border}`, background: theme.surface,
    color: theme.text, fontSize: ts(13), outline: "none", boxSizing: "border-box", lineHeight: 1.5 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: ts(13), fontWeight: 700, color: theme.text }}>{label}</div>
      <div style={{ fontSize: ts(11), color: theme.textMuted }}>{hint}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="button" onClick={() => ref.current?.click()}
          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${theme.border}`, background: "transparent", color: theme.text, cursor: "pointer", fontSize: ts(12) }}>
          {file ? `✓ ${file.name}` : "Upload PDF, Word or text"}
        </button>
        {file && <button type="button" onClick={() => setFile(null)} style={{ background: "none", border: "none", color: theme.textMuted, cursor: "pointer", fontSize: ts(12) }}>remove</button>}
        <input ref={ref} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
      </div>
      {!file && <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="…or paste the text" style={{ ...box, resize: "vertical" }} />}
    </div>
  );
}

export function HonestyToolPage() {
  const { theme } = useTheme();
  const [resume, setResume] = useState(null), [resumeText, setResumeText] = useState("");
  const [original, setOriginal] = useState(null), [originalText, setOriginalText] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  const resultRef = useRef(null);
  useEffect(() => { if (result) resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, [result]);

  const submit = async () => {
    if (!resume && !resumeText.trim()) { setError("Add the résumé to check."); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const fd = new FormData();
      await addFile(fd, "resume", resume, resumeText);
      await addFile(fd, "original", original, originalText);
      if (jdText.trim()) fd.append("jd_text", jdText);
      const r = await fetch("/api/standalone/honesty", { method: "POST", credentials: "include", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || d.error || "The check failed");
      setResult(d);
      // D141 (46y): "sign up to save and fix" — the checked résumé rides into the account made next (lib/signupCarry.js,
      // memory only; the server still keeps nothing — d141NoStorageWithoutSignup).
      carryResume(checkedResumeFile(resume, resumeText), { from: "honesty", flagged: d.flagged ?? 0 });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const lines = result ? result.lines.filter(l => !onlyFlagged || l.risk !== "low") : [];
  const s = result?.summary;
  return (
    <PublicPage region="II" data-tool-page="">
      <main style={{ flex: 1, maxWidth: 760, margin: "0 auto", padding: "48px 16px", width: "100%", boxSizing: "border-box" }}>
        <h1 className="pl-mk-hero__title" style={{ marginBottom: 10 }}>
          Will your AI résumé get you caught?
        </h1>
        <p style={{ fontSize: ts(15), color: theme.textMuted, marginBottom: 28, lineHeight: 1.6 }}>
          Check any résumé — including one an AI tool rewrote — against the original it came from. See, line by line, what you
          can't back up in an interview, and how to make it true. Free, no account, and nothing you upload is kept.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <FileOrText label="The résumé to check" hint="The version you plan to send." theme={theme}
            file={resume} setFile={setResume} text={resumeText} setText={setResumeText} />
          <FileOrText label="Your original (recommended)" hint="The résumé it was made from — what's true. Without it, every number and skill is simply a claim you'll be asked to back."
            theme={theme} file={original} setFile={setOriginal} text={originalText} setText={setOriginalText} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: ts(13), fontWeight: 700 }}>The job (optional)</div>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={5} placeholder="Paste the job description to see which of its terms were added"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${theme.border}`, background: theme.surface, color: theme.text,
                fontSize: ts(13), resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
          </div>
          {error && <div style={{ fontSize: ts(12), color: C.DANGER, fontWeight: 600 }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{ padding: 12, borderRadius: 8, border: "none",
            background: loading ? theme.surfaceHigh : theme.accent, color: loading ? theme.textMuted : C.ON_ACCENT,
            fontSize: ts(14), fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
            {loading ? "Checking…" : "Check my résumé"}
          </button>
        </div>

        {result && (
          <div ref={resultRef} data-honesty-result="" style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 80 }}>
            <div style={{ padding: "16px 18px", borderRadius: 10, background: theme.surface, border: `1px solid ${theme.border}`, lineHeight: 1.6, fontSize: ts(14) }}>
              <div style={{ fontWeight: 800, fontSize: ts(16), marginBottom: 6 }}>
                {result.flagged ? `${result.flagged} line${result.flagged === 1 ? "" : "s"} you may not be able to defend` : "Nothing stands out"}
                {result.high ? ` · ${result.high} high risk` : ""}
              </div>
              {result.comparedTo === "none" && <div style={{ color: theme.textMuted }}>Checked without an original — add it to see what was added.</div>}
              {s?.unsupportedSkills?.length > 0 && <div>Skills your original never names: <strong>{s.unsupportedSkills.join(", ")}</strong></div>}
              {s?.years && <div>Claims {s.years.claimed} years{s.years.original != null ? ` (your original: ${s.years.original})` : ""}.</div>}
              {s?.seniority && <div>Claims the title "{s.seniority.claimed}"{s.seniority.original ? ` (your original: "${s.seniority.original}")` : ""}.</div>}
              {result.keywords && (
                <div style={{ marginTop: 6 }}>
                  The job's key terms in this résumé: <strong>{result.keywords.inResume} of {result.keywords.total}</strong>
                  {result.keywords.inOriginal != null && <> (your original: {result.keywords.inOriginal} of {result.keywords.total})</>}.
                  {result.keywords.addedUnsupported?.length > 0 && <> Added without support: <strong>{result.keywords.addedUnsupported.join(", ")}</strong>.</>}
                </div>
              )}
            </div>
            <label style={{ fontSize: ts(12), color: theme.textMuted, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={onlyFlagged} onChange={e => setOnlyFlagged(e.target.checked)} /> Only the lines that need attention
            </label>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {lines.map((l, i) => (
                <li key={i} data-honesty-line={l.risk} style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, fontSize: ts(13), lineHeight: 1.55 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    {RISK[l.risk] && <span style={markStyle(RISK[l.risk].colour)}>{RISK[l.risk].label}</span>}
                    <span style={{ fontWeight: 600 }}>{l.text}</span>
                  </div>
                  {l.flags.map((f, k) => <div key={k} style={{ marginTop: 4, color: theme.text }}>• {f.text}</div>)}
                  {l.probe && <div style={{ marginTop: 4, color: theme.textMuted }}>{l.probe}</div>}
                  {l.fix && (
                    <div style={{ marginTop: 6 }}>
                      {l.fix.reword ? <div><strong>What's true (your original):</strong> {l.fix.reword}</div>
                        : result.comparedTo === "original" && <div><strong>Nothing in your original is close</strong> — remove it, or earn it.</div>}
                      {l.fix.earn?.length > 0 && (
                        <div style={{ marginTop: 2 }}><strong>Earn it:</strong>{" "}
                          {l.fix.earn.map((e, k) => <span key={e.term}>{k ? " · " : ""}<a href={e.href} style={{ color: theme.accentText }}>learn {e.term}</a></span>)}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            {/* ⭐ D141 (46y): SIGN UP TO SAVE AND FIX. The <Link> keeps this page session, so the résumé carried above reaches
                Job Profiles in the new account (offered as a profile's base résumé, with what to fix). A reload drops it. */}
            <div data-honesty-signup="" style={{ padding: "14px 18px", borderRadius: 8, background: theme.surfaceHigh, fontSize: ts(13), border: `1px solid ${theme.border}`, lineHeight: 1.55 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Save it and fix it in draft</div>
              <div style={{ color: theme.textMuted, marginBottom: 8 }}>
                Create an account and this résumé comes with you as your profile's base résumé
                {result.flagged ? <>, with the {result.flagged} line{result.flagged === 1 ? "" : "s"} to fix</> : null}
                {" "}— tailored from what you've actually done from then on. Nothing is kept until you sign up.
              </div>
              <Link to="/register" data-honesty-signup-link="" style={{ color: theme.accentText, fontWeight: 700, textDecoration: "none" }}>Sign up to save and fix →</Link>
            </div>
          </div>
        )}
      </main>
      </PublicPage>
  );
}
