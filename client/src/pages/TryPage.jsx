// ⭐ D124 · /try — the trial's one link (owner 11-01: quick sign-up first, then the WHOLE site with a sample résumé or
// their own). Signed out: one screen and Start → the normal sign-up, remembering the intent so the account comes back
// here. Signed in: the account becomes a trial account and picks a résumé; a sample goes through the SAME onboarding
// an upload does (POST /api/domain-profiles/from-resume), so the board is read from it as for every user.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";

export const TRIAL_INTENT_KEY = "draft.trialIntent";
export function setTrialIntent(on) {
  try { on ? localStorage.setItem(TRIAL_INTENT_KEY, "1") : localStorage.removeItem(TRIAL_INTENT_KEY); } catch { /* storage blocked */ }
}
export function hasTrialIntent() {
  try { return localStorage.getItem(TRIAL_INTENT_KEY) === "1"; } catch { return false; }
}

// Owner 11-01 (bug: the text was cut off on the right): one column, no fixed width, a 16 px gutter, text that wraps.
const wrap = { boxSizing: "border-box", width: "100%", maxWidth: "min(680px, 100%)", margin: "88px auto 48px", paddingInline: 16,   // clear of the fixed nav
  color: "var(--color-text)", overflowWrap: "anywhere" };
const card = { boxSizing: "border-box", padding: 16, borderRadius: 6, border: "1px solid var(--color-border)",
  background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 };
const mark = { alignSelf: "flex-start", fontSize: 12, padding: "2px 8px", borderRadius: 6, borderLeft: "3px solid var(--color-primary)",
  background: "var(--color-surface-offset)", color: "var(--color-text-muted)" };

// D124 amended (owner 11-01): six samples by category. The server says which are OFFERED today — a sample whose category
// has fewer than 10 good picks is hidden, never padded with another category's jobs (GET /api/trial/samples).
const CHOICES = [
  { id: "A", title: "Sample A", line: "A new-grad software engineer: one internship, a TA role, two projects." },
  { id: "B", title: "Sample B", line: "A mid-level ML / data engineer: four years across two employers." },
  { id: "C", title: "Sample C", line: "A mid-level mechanical engineer: five years in thermal and automotive design." },
  { id: "D", title: "Sample D", line: "An early-career electrical engineer: power electronics and a utility internship." },
  { id: "E", title: "Sample E", line: "A business / financial analyst: three years in forecasting and requirements." },
  { id: "F", title: "Sample F", line: "A project / operations manager: seven years in medical devices and packaging." },
];

export default function TryPage({ authUser }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [offered, setOffered] = useState(null);

  useEffect(() => {
    if (!authUser) return;
    api("/api/trial/samples").then(r => setOffered(new Set(r.samples.filter(x => x.offered).map(x => x.id))))
      .catch(() => setOffered(new Set(["A", "B"])));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    api("/api/trial/start", { method: "POST" }).then(() => setTrialIntent(false)).catch(() => {});
  }, [authUser]);

  if (!authUser) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: "clamp(30px, 6vw, 48px)", lineHeight: 1.15, margin: "0 0 12px", overflowWrap: "anywhere" }} data-try-heading="">See how draft finds, tailors and applies</h1>
        <p style={{ fontSize: 17, margin: "0 0 8px" }}>About 8 minutes, then a short survey.</p>
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px" }}>
          Pick a sample résumé, look through the jobs we match to it, choose 2, and watch draft tailor the résumé and fill out
          each application. It's a demonstration: nothing is sent to an employer.
        </p>
        <DepthButton primary onClick={() => { setTrialIntent(true); navigate("/register?trial=1"); }}>Start</DepthButton>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          Already have an account?{" "}
          <a href="/login" onClick={(e) => { e.preventDefault(); setTrialIntent(true); navigate("/login?trial=1"); }}>Sign in</a>
        </p>
      </div>
    );
  }

  async function choose(choice) {
    setBusy(choice); setError("");
    try {
      const picked = await api("/api/trial/resume", { method: "POST", body: JSON.stringify({ choice }) });
      if (picked.sample) {
        try {
          await api("/api/domain-profiles/from-resume", { method: "POST", body: JSON.stringify({ content: picked.sample.content, name: picked.sample.name }) });
        } catch (e) {
          if (e.status !== 409) throw e;
          setError("This account already has a résumé, so the sample was not added. Open the app to use the one you have.");
          setBusy(null);
          return;
        }
      }
      navigate("/app");
    } catch (e) {
      setError(e.message || "That did not work. Try again.");
      setBusy(null);
    }
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Pick a résumé</h1>
      <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px" }}>
        The board, the matches and the tailored résumés all come from the résumé you pick. You can switch later in Job profiles.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {CHOICES.filter(c => offered?.has(c.id)).map(c => (
          <div key={c.id} style={card} data-trial-choice={c.id}>
            <span style={mark}>Sample, a fictional person</span>
            <strong style={{ fontSize: 18 }}>{c.title}</strong>
            <span>{c.line}</span>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Drafts go to draft's practice form, never to the employer.</span>
            <DepthButton wrap primary disabled={!!busy} onClick={() => choose(c.id)}>{busy === c.id ? "Setting up…" : `Use ${c.title}`}</DepthButton>
          </div>
        ))}
        {/* ⭐ Owner 11-01: "omit own resumes entirely for the tour" — the trial is a complete demonstration on a sample. */}
      </div>
      {error && <p role="alert" style={{ marginTop: 16, color: "var(--color-warning)" }}>{error}</p>}
    </div>
  );
}
