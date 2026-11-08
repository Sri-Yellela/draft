// ⭐ D150 T05–T08 (45l) · THE 3-MINUTE AUDIT, /audit — "Do you clear the bar?" (audit-sketch.html, approved 11-04).
// Public, no sign-in: pick a role (T04's list, with open counts) and a level → the role card (pay as the middle half of
// postings that state it, "market data, not a promise", the three most-asked requirements) → six questions one at a time
// (the skill as the eyebrow, the scenario as the headline, four large choices; keys 1–4, Enter) with the WHY after each
// answer → the result (n of 6, strong / to work on, what closes the distance, the open roles, the share line, Try another
// role) → keep it (signed in: claimed at once; signed out: sign up, and the result is kept on return). A thin progress bar;
// no timer. Server: services/audit/auditSession.js. ⛔ "strong / to work on", never a grade. ⛔ D60, tokens only.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api.js";
import "./AuditPage.css";

const TOKEN_KEY = "draft-audit-token";
const words = (s) => String(s || "").replace(/-/g, " ");
const money = (v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`);
const save = (t) => { try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ } };
const saved = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };

export default function AuditPage({ signedIn = false }) {
  const [sp] = useSearchParams();
  const [roles, setRoles] = useState(null);
  const [role, setRole] = useState(sp.get("role") || "");
  const [level, setLevel] = useState("mid");
  const [card, setCard] = useState(null);
  const [run, setRun] = useState(null);       // { token, total, number, question }
  const [after, setAfter] = useState(null);   // the answer's why, before Continue
  const [result, setResult] = useState(null);
  const [kept, setKept] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { api("/api/audit/roles").then((d) => { setRoles(d.roles || []); if (!role && d.roles?.[0]) setRole(d.roles[0].slug); }).catch(() => setRoles([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const chosenRole = roles?.find((r) => r.slug === role) || null;
  useEffect(() => {
    if (!role) return undefined;
    let live = true;
    setCard(null);
    api(`/api/audit/role/${encodeURIComponent(role)}?level=${encodeURIComponent(level)}`).then((c) => { if (live) setCard(c); }).catch(() => {});
    return () => { live = false; };
  }, [role, level]);

  // T07 · back from sign-up with ?keep=1: keep the result at once.
  const keep = useCallback(async (token) => {
    try { const r = await api(`/api/audit/${encodeURIComponent(token)}/claim`, { method: "POST" }); setResult(r); setKept(true); }
    catch (e) { setMsg(/already/.test(String(e.message)) ? "This result is already kept." : (e.message || "It couldn't be kept.")); }
  }, []);
  useEffect(() => {
    const t = sp.get("token") || saved();
    if (!t || !sp.get("keep")) return;
    api(`/api/audit/${encodeURIComponent(t)}/result`).then((r) => { setResult({ ...r, token: t }); if (signedIn && !r.claimed) keep(t); }).catch(() => {});
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setMsg("");
    try {
      const r = await api("/api/audit/start", { method: "POST", body: JSON.stringify({ role, level }) });
      save(r.token); setRun(r); setAfter(null); setResult(null); setKept(false);
    } catch (e) { setMsg(e.message || "The audit couldn't start."); }
  };
  const answer = async (i) => {
    if (!run || after) return;
    try {
      const r = await api(`/api/audit/${encodeURIComponent(run.token)}/answer`, { method: "POST", body: JSON.stringify({ questionId: run.question.id, chosen: i }) });
      setAfter({ ...r, picked: i });
    } catch (e) { setMsg(e.message || "That answer didn't save — try again."); }
  };
  const next = async () => {
    if (!after) return;
    if (after.done) {
      const r = await api(`/api/audit/${encodeURIComponent(run.token)}/result`);
      setResult({ ...r, token: run.token }); setRun(null); setAfter(null);
      if (signedIn) keep(run.token);
      return;
    }
    setRun({ ...run, number: after.number, question: after.question }); setAfter(null);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (!run) return;
      if (!after && /^[1-4]$/.test(e.key) && run.question?.choices?.[Number(e.key) - 1]) answer(Number(e.key) - 1);
      else if (after && e.key === "Enter") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── the result (T06) ──
  if (result) {
    const shareUrl = `${window.location.origin}/audit?role=${encodeURIComponent(result.role.slug)}`;
    return (
      <main className="au" data-audit-result="">
        <p className="au__eyebrow">{result.role.title}{result.role.level ? ` · ${result.role.level}` : ""}</p>
        <h1 className="au__h">{result.right} of {result.of}</h1>
        <div className="au__stats">
          {result.strong.length > 0 && <div className="au__stat"><b>Strong</b><span>{result.strong.join(", ")}</span></div>}
          {result.toWork.length > 0 && <div className="au__stat"><b>To work on</b><span>{result.toWork.join(", ")}</span></div>}
          {result.openRoles != null && <div className="au__stat"><b>{result.openRoles.toLocaleString("en-US")}</b><span>open roles match this bar</span></div>}
        </div>
        {result.closes.length > 0 && (
          <section className="au__sec" data-audit-closes="">
            <h2>What closes the distance</h2>
            <ul>{result.closes.map((c) => <li key={`${c.kind}:${c.path}`}><Link to={`${signedIn ? "/app" : ""}${c.path}`}>{c.label}</Link></li>)}</ul>
          </section>
        )}
        <section className="au__sec">
          {kept || result.claimed
            ? <p data-audit-kept="">Kept — {result.role.title} is now your destination, and the skills you were strong on show as checked. <Link to="/app/atlas/your-skills">See your skills</Link></p>
            : signedIn
              ? <button type="button" className="au__btn au__btn--primary" onClick={() => keep(result.token)}>Keep this result</button>
              : <Link className="au__btn au__btn--primary" to={`/register?returnTo=${encodeURIComponent(`/audit?keep=1&token=${result.token}`)}`}>Keep it — sign up free</Link>}
          <button type="button" className="au__btn" data-audit-share="" onClick={() => {
            const text = `${result.share} ${shareUrl}`;
            if (navigator.share) navigator.share({ text, url: shareUrl }).catch(() => {}); else navigator.clipboard?.writeText(text).then(() => setMsg("Copied — your answers are never in it.")).catch(() => {});
          }}>Share</button>
          <button type="button" className="au__btn" onClick={() => { setResult(null); setKept(false); }}>Try another role</button>
          <Link className="au__btn" to={`${signedIn ? "/app" : ""}/jobs`}>See the open roles</Link>
        </section>
        {msg && <p className="au__msg" role="status">{msg}</p>}
      </main>
    );
  }

  // ── a question (T05) ──
  if (run?.question) {
    const q = run.question;
    return (
      <main className="au" data-audit-question={q.id}>
        <div className="au__progress" aria-label={`${run.number} of ${run.total}`}><i style={{ width: `${Math.round(((run.number - (after ? 0 : 1)) / run.total) * 100)}%` }} /></div>
        <p className="au__eyebrow">{q.skills.map(words).join(" · ")}</p>
        <h1 className="au__q">{q.stem}</h1>
        <div className="au__choices" role="group" aria-label="Choices">
          {q.choices.map((c, i) => (
            <button key={i} type="button" className="au__choice" disabled={!!after}
              data-state={after ? (i === after.correctIndex ? "right" : i === after.picked ? "wrong" : "") : ""}
              onClick={() => answer(i)}><span className="au__key">{i + 1}</span>{c}</button>
          ))}
        </div>
        {after && (
          <div className="au__why" data-audit-why="" role="status">
            <b>{after.correct ? "Right." : "Not quite."}</b> {after.why.chosen}
            {!after.correct && after.why.right && <p><b>The stronger move:</b> {after.why.rightChoice} — {after.why.right}</p>}
            <button type="button" className="au__btn au__btn--primary" onClick={next}>{after.done ? "See where you stand" : "Continue"} ↵</button>
          </div>
        )}
        <p className="au__quiet">{run.number} of {run.total}</p>
        {msg && <p className="au__msg" role="status">{msg}</p>}
      </main>
    );
  }

  // ── pick the role (T05 (1)) and the card (T04) ──
  return (
    <main className="au" data-audit-start="">
      <h1 className="au__h">Do you clear the bar?</h1>
      <p className="au__lead">Six questions, about three minutes. No account, nothing about you kept.</p>
      {roles === null ? <p className="au__quiet">Opening…</p> : !roles.length ? <p className="au__quiet">No role can be audited yet.</p> : (
        <>
          <div className="au__pick">
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" data-audit-role="">
              {roles.map((r) => <option key={r.slug} value={r.slug}>{r.title} · {r.openPostings.toLocaleString("en-US")} open</option>)}
            </select>
            <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level">
              {(chosenRole?.levels?.length ? chosenRole.levels : ["mid", "senior"]).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          {card && (
            <section className="au__card" data-audit-card="">
              <p className="au__eyebrow">{card.title}{card.level ? ` · ${card.level}` : ""}</p>
              <p className="au__cardline">{card.openThisWeek?.toLocaleString("en-US")} open{card.payRange && !card.payRange.hidden ? ` · ${money(card.payRange.p25Usd)}–${money(card.payRange.p75Usd)} (the middle half of ${card.payRange.n} that state pay)` : ""}</p>
              {card.payRange?.hidden && <p className="au__quiet">{card.payRange.why}</p>}
              {card.topRequirements?.length > 0 && <p>Asked for most: {card.topRequirements.map((r) => r.name).join(" · ")}</p>}
              <p className="au__quiet">{card.said}</p>
            </section>
          )}
          <button type="button" className="au__btn au__btn--primary" onClick={start} data-audit-go="">Start the audit</button>
        </>
      )}
      {msg && <p className="au__msg" role="status">{msg}</p>}
    </main>
  );
}
