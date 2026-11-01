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

const wrap = { boxSizing: "border-box", width: "min(760px, calc(100% - 32px))", margin: "48px auto", color: "var(--color-text)" };
const card = { boxSizing: "border-box", padding: 16, borderRadius: 6, border: "1px solid var(--color-border)",
  background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 };
const mark = { alignSelf: "flex-start", fontSize: 12, padding: "2px 8px", borderRadius: 6, borderLeft: "3px solid var(--color-primary)",
  background: "var(--color-surface-offset)", color: "var(--color-text-muted)" };

const CHOICES = [
  { id: "A", title: "Sample A", line: "A new-grad software engineer: one internship, a TA role, two projects." },
  { id: "B", title: "Sample B", line: "A mid-level ML / data engineer: four years across two employers." },
];

export default function TryPage({ authUser }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authUser) return;
    api("/api/trial/start", { method: "POST" }).then(() => setTrialIntent(false)).catch(() => {});
  }, [authUser]);

  if (!authUser) {
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 32, lineHeight: 1.2, margin: "0 0 12px" }}>Try draft: the board, tailored résumés, and applications sent for you</h1>
        <p style={{ fontSize: 17, margin: "0 0 8px" }}>Takes about 4 minutes, then a short survey.</p>
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px" }}>
          Sign up, pick a sample résumé (or use your own), and use the whole site: the jobs matched to that résumé, résumés
          tailored to each one, and 2 Drafts filled and sent for you. Drafts made from a sample go to draft's practice form,
          never to a real employer.
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
        {CHOICES.map(c => (
          <div key={c.id} style={card} data-trial-choice={c.id}>
            <span style={mark}>Sample, a fictional person</span>
            <strong style={{ fontSize: 18 }}>{c.title}</strong>
            <span>{c.line}</span>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Drafts go to draft's practice form, never to the employer.</span>
            <DepthButton wrap primary disabled={!!busy} onClick={() => choose(c.id)}>{busy === c.id ? "Setting up…" : `Use ${c.title}`}</DepthButton>
          </div>
        ))}
        <div style={card} data-trial-choice="own">
          <span style={mark}>Your own</span>
          <strong style={{ fontSize: 18 }}>Use my own résumé</strong>
          <span>Upload a PDF or Word file on the next screen.</span>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Drafts go to the real employer, each one only after you approve it.</span>
          <DepthButton wrap disabled={!!busy} onClick={() => choose("own")}>{busy === "own" ? "Opening…" : "Use my own résumé"}</DepthButton>
        </div>
      </div>
      {error && <p role="alert" style={{ marginTop: 16, color: "var(--color-warning)" }}>{error}</p>}
    </div>
  );
}
