// ⭐ D124 · /try — the trial's one link (owner 11-01: quick sign-up first, then the WHOLE site with a sample résumé or
// their own). Signed out: one screen and Start → the normal sign-up, remembering the intent so the account comes back
// here. Signed in: the account becomes a trial account and picks a résumé; a sample goes through the SAME onboarding
// an upload does (POST /api/domain-profiles/from-resume), so the board is read from it as for every user.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { parseResumeFile } from "../lib/parseResumeFile.js";

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

// ⭐ A111 · "Use my own résumé" — ONLY while Admin → Trial's switch is on (app setting trial_own_resume, off by default;
// GET /api/trial/samples says). A PDF or Word file (the one reader, lib/parseResumeFile.js) or pasted text → POST
// /api/trial/resume { choice: "own" }: the field is read first and NOTHING is saved unless it is live today (10 good picks
// in its own category); a live field goes on through the normal onboarding (from-resume), exactly as a sample does.
const pasteBox = { boxSizing: "border-box", width: "100%", minHeight: 140, padding: "10px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
  background: "var(--color-surface)", color: "var(--color-text)", font: "inherit", fontSize: 14 };
function OwnResumeCard({ disabled, busy, onRead }) {
  const input = useRef(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const fromFile = async (file) => {
    if (!file) return;
    setMsg(`Reading ${file.name}…`);
    try {
      const t = await parseResumeFile(file);
      if (!String(t || "").trim()) throw new Error("No text could be read from that file. Try the PDF or Word version, or paste the text.");
      setMsg("");
      onRead(t, file.name);
    } catch (e) { setMsg(e.message || "Could not read that résumé."); }
  };
  return (
    <div style={card} data-trial-own-resume="">
      <span style={mark}>Your own résumé</span>
      <strong style={{ fontSize: 18 }}>Use my own résumé</strong>
      <span>Upload a PDF or Word file, or paste the text. We read your field and show you the jobs we match to it.</span>
      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Still a demonstration: Drafts go to draft's practice form, never to the employer.</span>
      <input ref={input} type="file" accept=".pdf,.docx,.txt" hidden data-own-file="" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; fromFile(f); }}/>
      <DepthButton wrap primary disabled={disabled} onClick={() => input.current?.click()}>{busy ? "Reading your résumé…" : "Upload a PDF or Word file"}</DepthButton>
      <DepthButton wrap disabled={disabled} onClick={() => setPaste(p => !p)} data-own-paste-toggle="">{paste ? "Hide the text box" : "Paste the text instead"}</DepthButton>
      {paste && (
        <>
          <textarea style={pasteBox} aria-label="Your résumé's text" placeholder="Paste your whole résumé here" value={text} data-own-paste=""
            onChange={(e) => setText(e.target.value)}/>
          <DepthButton wrap primary disabled={disabled || !text.trim()} onClick={() => onRead(text, "pasted-resume.txt")} data-own-read="">Read my résumé</DepthButton>
        </>
      )}
      {msg && <span role="status" style={{ fontSize: 13 }}>{msg}</span>}
    </div>
  );
}

/** The field, in plain words, once read: live → Continue; not live → the honest line, the samples still offered below. */
function OwnReading({ own, busy, onContinue }) {
  // the reading sits above the cards: brought into view, so a phone that pressed Read at the bottom sees it
  const box = useRef(null);
  useEffect(() => { box.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }); }, [own]);
  if (own.live) {
    return (
      <div style={{ ...card, marginBottom: 16, scrollMarginTop: 88, borderLeft: "3px solid var(--color-primary)" }} data-own-field={own.field?.category || ""} role="status" ref={box}>
        <span style={mark}>Your field</span>
        <strong style={{ fontSize: 18 }} data-own-field-words="">{own.field?.words}</strong>
        <span>{own.picks} good picks from your field today, best match first, each with its score and why.</span>
        <DepthButton wrap primary disabled={!!busy} onClick={onContinue} data-own-continue="">{busy === "own-go" ? "Setting up…" : "Continue with my résumé"}</DepthButton>
      </div>
    );
  }
  return (
    <div style={{ ...card, marginBottom: 16, scrollMarginTop: 88, borderLeft: "3px solid var(--color-warning)" }} data-own-not-live="" role="status" ref={box}>
      <span style={mark}>Your field</span>
      <strong style={{ fontSize: 18 }}>Your field isn't live yet</strong>
      <span>
        {own.field?.words ? <>We read your résumé as <b>{own.field.words}</b>. </> : <>We couldn't place your résumé in a field we cover yet. </>}
        {own.reason === "too_few_picks"
          ? `Today there are ${own.picks} good picks in it, and the trial shows 10, so we'd rather not pad it with another field's jobs.`
          : "draft covers business, finance, management, engineering, computing and a few more professional fields today, and adds more as employers join."}
      </span>
      <span>{own.samples?.length ? "Try a sample instead: they show exactly what draft does." : "No sample is open today either. Come back soon."}</span>
    </div>
  );
}

export default function TryPage({ authUser }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [offered, setOffered] = useState(null);
  // Owner 11-01: the samples carry fictional names, so a sign-up that gave none of the tester's own (a GitHub handle, an
  // email) is asked for it once, before the samples.
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState({ first_name: "", last_name: "" });
  const [ownOn, setOwnOn] = useState(false);   // A111: the switch, from the server — off unless Admin → Trial turned it on
  const [own, setOwn] = useState(null);         // the résumé's reading: { live, field, picks, own?, reason?, samples? }

  useEffect(() => {
    if (!authUser) return;
    api("/api/trial/samples").then(r => { setOffered(new Set(r.samples.filter(x => x.offered).map(x => x.id))); setOwnOn(r.ownResume === true); })
      .catch(() => setOffered(new Set(["A", "B"])));
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return;
    api("/api/trial/start", { method: "POST" }).then((st) => { setTrialIntent(false); setNeedsName(!!st?.needsName); }).catch(() => {});
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

  // A111: the résumé read for its field first; nothing is saved unless the field is live today.
  async function readOwn(content, fileName) {
    setBusy("own"); setError(""); setOwn(null);
    try {
      const r = await api("/api/trial/resume", { method: "POST", body: JSON.stringify({ choice: "own", content, name: fileName }) });
      setOwn({ live: true, ...r });
    } catch (e) {
      if (e.status === 409 && e.payload?.error === "field_not_live") setOwn({ live: false, ...e.payload });
      else setError(e.message || "That did not work. Try again.");
    }
    setBusy(null);
  }
  async function continueOwn() {
    setBusy("own-go"); setError("");
    try {
      await api("/api/domain-profiles/from-resume", { method: "POST", body: JSON.stringify({ content: own.own.content, name: own.own.name }) });
      navigate("/app");
    } catch (e) {
      setError(e.status === 409 ? "This account already has a résumé, so this one was not added. Open the app to use the one you have." : e.message || "That did not work. Try again.");
      setBusy(null);
    }
  }

  async function saveName(e) {
    e.preventDefault();
    setBusy("name"); setError("");
    try {
      await api("/api/trial/name", { method: "POST", body: JSON.stringify(name) });
      setNeedsName(false);
    } catch (err) {
      setError(err.message || "That did not work. Try again.");
    }
    setBusy(null);
  }

  if (needsName) {
    const field = { boxSizing: "border-box", width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--color-border)",
      background: "var(--color-surface)", color: "var(--color-text)", font: "inherit" };
    return (
      <div style={wrap}>
        <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>What's your name?</h1>
        <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px" }}>
          The résumés you'll try are fictional people, so we ask for yours once. It stays with your account.
        </p>
        <form onSubmit={saveName} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }} data-trial-name="">
          <input style={field} placeholder="First name" autoComplete="given-name" value={name.first_name} autoFocus
            onChange={e => setName(n => ({ ...n, first_name: e.target.value }))}/>
          <input style={field} placeholder="Last name" autoComplete="family-name" value={name.last_name}
            onChange={e => setName(n => ({ ...n, last_name: e.target.value }))}/>
          <DepthButton primary type="submit" disabled={!!busy || !name.first_name.trim() || !name.last_name.trim()}>
            {busy === "name" ? "Saving…" : "Continue"}
          </DepthButton>
        </form>
        {error && <p role="alert" style={{ marginTop: 16, color: "var(--color-warning)" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>Pick a résumé</h1>
      <p style={{ color: "var(--color-text-muted)", margin: "0 0 20px" }}>
        The board, the matches and the tailored résumés all come from the résumé you pick. You can switch later in Job profiles.
      </p>
      {own && <OwnReading own={own} busy={busy} onContinue={continueOwn}/>}
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
        {/* ⭐ Owner 11-01: "omit own resumes entirely for the tour" — the trial is a complete demonstration on a sample.
            A111 (owner 11-02): the own-résumé pathway, ONLY with Admin → Trial's switch on (off by default). */}
        {ownOn && <OwnResumeCard disabled={!!busy} busy={busy === "own"} onRead={readOwn}/>}
      </div>
      {error && <p role="alert" style={{ marginTop: 16, color: "var(--color-warning)" }}>{error}</p>}
    </div>
  );
}
