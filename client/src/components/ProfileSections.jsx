// ── D101 · THE PROFILE IN SECTIONS, AND APPLICATION DEFAULTS (UI slice 3; A105 finding 1) ──────────────
//
// One read (GET /api/profile/sections): the sections filled from the résumé on first open, Application defaults
// (each SET or NOT SET), "n of 10", and — after a newer base résumé — an OFFER to use it (never applied silently).
//   · A section is edited in place and saved on its own (PUT /api/profile/sections/:section) — no page-wide Save.
//   · An Application default saves the moment it changes (PUT /api/profile/defaults/:key); "Not set" clears it, and
//     a not-set default is never an answer: the form's question waits in Needs you (D101 rule 3).
//   · These ARE what the fill reads for work authorisation, sponsorship, clearance, preferences and self-ID — the
//     overlay in services/structuredProfile.js (withApplicationDefaults). Nothing else on the page sets them.
//   · Experience shows the company's logo, or a SQUARE initial tile (D60: no capsule, no circle on a non-avatar).
//   · ⭐ D109 · PROOF: each experience bullet and each project can link evidence — a repository, a live demo, a paper,
//     a write-up (https only, a kind, a short label; PUT /api/profile/evidence). Each bullet wears the claim guard's
//     mark, "Evidence linked" / "No evidence linked" (services/resumeClaimGuard.js markBacking) — tailoring keeps the
//     backed ones first when it must choose. The optional public proof page (/p/<handle>) lists the projects and their
//     links; OFF until the user turns it on, nothing private on it. ⛔ draft certifies nothing: the links are the
//     candidate's own, and no word here or on the page claims draft checked them.
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { useAtlasSlugs, atlasHref } from "../lib/atlasLinks.js";
import { EEO_DECLINE } from "../../../shared/savedAnswers.js";

const NOT_SET = "Not set — I'll answer on each form";
// The words a self-ID question is usually answered in; the stored value is the text, so the fill matches the form's own.
const SELF_ID = {
  gender: ["Male", "Female", "Non-binary / third gender"],
  ethnicity: ["Hispanic or Latino", "White (not Hispanic or Latino)", "Black or African American", "Asian",
    "Native Hawaiian or Other Pacific Islander", "American Indian or Alaska Native", "Two or more races"],
  veteran: ["I am a protected veteran", "I am not a protected veteran"],
  disability: ["Yes, I have a disability", "No, I do not have a disability"],
};
const WORDS = { yes: "Yes", no: "No", hybrid_only: "Hybrid only", none: "None", confidential: "Confidential", secret: "Secret",
  top_secret: "Top Secret", ts_sci: "TS/SCI", can_obtain: "Can obtain one" };
const SOURCE = { resume: "from your résumé", user: "", needs_you: "answered in Needs you", imported: "from your profile" };

function Box({ title, right, children, theme }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div className="rm-section-label" style={{ flex: 1 }}>{title}</div>{right}
      </div>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: "16px 20px", boxShadow: theme.shadowSm }}>
        {children}
      </div>
    </section>
  );
}

function LogoTile({ logo, initial, theme }) {
  const box = { width: 32, height: 32, borderRadius: 6, flexShrink: 0, border: `1px solid ${theme.border}` };
  return logo
    ? <img src={logo} alt="" style={{ ...box, objectFit: "contain", background: C.SURFACE_SOLID }} />
    : <span aria-hidden="true" style={{ ...box, display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 14, color: theme.textMuted, background: theme.surfaceHigh }}>{initial || "?"}</span>;
}

// ── D109 · evidence on a claim ────────────────────────────────────────────────────────────────────
const EVIDENCE_KINDS = [["repository", "Repository"], ["demo", "Live demo"], ["paper", "Paper"], ["writeup", "Write-up"]];
const KIND_WORD = Object.fromEntries(EVIDENCE_KINDS);
const BACKED_WORDS = { backed: "Evidence linked", unbacked: "No evidence linked" };

function BackingMark({ backed }) {
  return <span data-backing={backed ? "backed" : "unbacked"} style={markStyle(backed ? C.SUCCESS : C.INK_MUTED)}>
    {backed ? BACKED_WORDS.backed : BACKED_WORDS.unbacked}</span>;
}

/** One claim's links, and the inline form that replaces them (PUT /api/profile/evidence; [] removes them). */
function EvidenceLinks({ target, claim, links, onSaved, theme }) {
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = { height: 30, padding: "0 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface,
    color: theme.text, fontSize: 12, boxSizing: "border-box", width: "100%" };
  const save = async () => {
    setBusy(true); setErr("");
    try {
      const items = draft.filter(x => String(x.url || "").trim()).map(x => ({ kind: x.kind, label: x.label, url: x.url.trim() }));
      onSaved(await api("/api/profile/evidence", { method: "PUT", body: JSON.stringify({ target, claim, items }) }));
      setDraft(null);
    } catch (e) { setErr(e.message || "Not saved."); } finally { setBusy(false); }
  };
  if (!draft) {
    return (
      <span data-evidence={target} style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", alignItems: "baseline", fontSize: 12 }}>
        {links.map(l => (
          <a key={l.id ?? l.url} href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: theme.text }}>
            <span style={{ color: theme.textMuted }}>{KIND_WORD[l.kind] || l.kind}:</span> {l.label}</a>
        ))}
        <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(links.length ? links.map(l => ({ ...l })) : [{ kind: "repository", label: "", url: "" }])}>
          {links.length ? "Edit evidence" : "+ Link evidence"}</button>
      </span>
    );
  }
  const setAt = (i, k, v) => setDraft(d => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div data-evidence-editor={target} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, padding: 8,
      border: `1px solid ${theme.border}`, borderRadius: 8 }}>
      {draft.map((x, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, alignItems: "end" }}>
          <select style={input} value={x.kind} onChange={e => setAt(i, "kind", e.target.value)} aria-label="Kind">
            {EVIDENCE_KINDS.map(([k, w]) => <option key={k} value={k}>{w}</option>)}
          </select>
          <input style={input} value={x.label || ""} maxLength={60} placeholder="Short label" aria-label="Label"
            onChange={e => setAt(i, "label", e.target.value)} />
          <input style={input} type="url" value={x.url || ""} placeholder="https://…" aria-label="Address"
            onChange={e => setAt(i, "url", e.target.value)} />
          <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(d => d.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {draft.length < 5 && <button className="rm-btn rm-btn-ghost rm-btn-sm"
          onClick={() => setDraft(d => [...d, { kind: "repository", label: "", url: "" }])}>+ Another link</button>}
        <div style={{ flex: 1 }} />
        <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
        <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {err && <span role="alert" style={{ fontSize: 12, color: C.DANGER }}>{err}</span>}
    </div>
  );
}

/** D109 P3 · the public proof page: OFF by default; an address; what it shows. */
function ProofPageSetting({ theme }) {
  const [s, setS] = useState(null);
  const [handle, setHandle] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    api("/api/profile/proof-page").then(r => { setS(r); setHandle(r.handle || ""); }).catch(e => setErr(e.message || "Could not load."));
  }, []);
  const send = async (enabled, extra = {}) => {
    setErr("");
    try { const r = await api("/api/profile/proof-page", { method: "PUT", body: JSON.stringify({ enabled, handle: handle.trim() || null, ...extra }) }); setS(r); setHandle(r.handle || ""); }
    catch (e) { setErr(e.message || "Not saved."); }
  };
  const muted = { fontSize: 12, color: theme.textMuted };
  if (!s) return <span style={muted}>{err || "Loading…"}</span>;
  const url = s.handle ? `${window.location.origin}/p/${s.handle}` : null;
  return (
    <div data-proof-page={s.enabled ? "on" : "off"} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p style={{ ...muted, margin: 0, lineHeight: 1.6 }}>
        A public page listing your projects and the links you added to them — for an application's website field. It shows
        your name and your projects only: no email, phone or address. It says the links are supplied by you; draft does not
        open, check or vouch for them. <b>Off</b> until you turn it on.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={muted}>{window.location.host}/p/</span>
        <input value={handle} onChange={e => setHandle(e.target.value.toLowerCase())} placeholder="your-name" aria-label="Page address"
          style={{ height: 32, padding: "0 8px", borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontSize: 13 }} />
        <span style={markStyle(s.enabled ? C.SUCCESS : C.INK_MUTED)}>{s.enabled ? "On" : "Off"}</span>
        {s.enabled
          ? <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => send(false)}>Turn off</button>
          : <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={() => send(true)} disabled={!handle.trim()}>Turn on</button>}
      </div>
      {s.enabled && url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>{url}</a>}
      {/* ⭐ D178-4: what you proved in Atlas is its own yes — OFF until ticked, even with the page on. */}
      {s.enabled && (
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13 }} data-proof-page-learning={s.showLearning ? "on" : "off"}>
          <input type="checkbox" checked={!!s.showLearning} onChange={e => send(true, { showLearning: e.target.checked })} />
          <span>Also show what you've proven in Atlas — the modules you finished, the skills you passed a quick check in or
            showed with a build, and your builds, each with its date. No points or levels.</span>
        </label>
      )}
      {err && <span role="alert" style={{ fontSize: 12, color: C.DANGER }}>{err}</span>}
    </div>
  );
}

const ymLabel = (v) => (v ? new Date(`${v}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "");

/** A list section edited in place: rows → one form per row while editing → Save sends the whole list. */
function ListEditor({ items, blank, fields, render, onSave, theme, addLabel }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = { height: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
    color: theme.text, fontSize: 13, boxSizing: "border-box", width: "100%" };
  if (!draft) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 && <span style={{ fontSize: 12, color: theme.textMuted }}>Nothing here yet.</span>}
        {items.map((x, i) => <div key={x.id ?? i}>{render(x)}</div>)}
        <div><button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(items.map(x => ({ ...x })))}>
          {items.length ? "Edit" : addLabel}</button></div>
      </div>
    );
  }
  const setAt = (i, k, v) => setDraft(d => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const save = async () => {
    setBusy(true); setErr("");
    try { await onSave(draft); setDraft(null); } catch (e) { setErr(e.message || "Not saved."); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {draft.map((x, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8,
          paddingBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
          {fields.map(f => (
            <label key={f.k} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: theme.textMuted,
              gridColumn: f.wide ? "1 / -1" : undefined }}>
              {f.label}
              {f.type === "check" ? (
                <input type="checkbox" checked={!!x[f.k]} onChange={e => setAt(i, f.k, e.target.checked)} />
              ) : f.type === "lines" ? (
                <textarea rows={4} style={{ ...input, height: "auto", padding: 8 }} value={(x[f.k] || []).join("\n")}
                  onChange={e => setAt(i, f.k, e.target.value.split("\n"))} />
              ) : (
                <input type={f.type || "text"} style={input} value={x[f.k] ?? ""} disabled={f.k === "end" && x.current}
                  onChange={e => setAt(i, f.k, e.target.value)} />
              )}
            </label>
          ))}
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(d => d.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(d => [...d, { ...blank }])}>{addLabel}</button>
        <div style={{ flex: 1 }} />
        <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
        <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {err && <span role="alert" style={{ fontSize: 12, color: C.DANGER }}>{err}</span>}
    </div>
  );
}

function DefaultRow({ item, onSet, theme, busy }) {
  const sel = { height: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
    color: theme.text, fontSize: 13, width: "100%", boxSizing: "border-box" };
  const choices = item.values || (SELF_ID[item.key] ? [EEO_DECLINE, ...SELF_ID[item.key]] : null);
  const [text, setText] = useState(item.value || "");
  useEffect(() => { setText(item.value || ""); }, [item.value]);
  return (
    <label data-default={item.key} data-set={item.set ? "true" : "false"}
      style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 600, color: theme.textMuted }}>
      <span>{item.label}{item.set && SOURCE[item.source] ? <span style={{ fontWeight: 400 }}> · {SOURCE[item.source]}</span> : null}</span>
      {choices ? (
        <select style={sel} value={item.value ?? ""} disabled={busy}
          onChange={e => onSet(item.key, e.target.value === "" ? null : e.target.value)}>
          <option value="">{NOT_SET}</option>
          {item.value && !choices.includes(item.value) && <option value={item.value}>{item.value}</option>}
          {choices.map(v => <option key={v} value={v}>{WORDS[v] || v}</option>)}
        </select>
      ) : (
        <input style={sel} value={text} placeholder={NOT_SET} disabled={busy}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const v = text.trim() || null; if (v !== (item.value || null)) onSet(item.key, v); }} />
      )}
    </label>
  );
}

/**
 * D112 d2 · the degree the forms answer with: DERIVED from the entries below (the highest level wins), with a
 * Change override for a form that needs something else (PUT /api/profile/education-override). "Use the section"
 * clears it. Eligibility (D104) reads the same value.
 */
function HighestDegree({ education, onSaved, theme }) {
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const e = education || {};
  const muted = { fontSize: 12, color: theme.textMuted };
  const input = { height: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
    color: theme.text, fontSize: 13, boxSizing: "border-box", width: "100%" };
  const send = async (body) => {
    setErr("");
    try { onSaved(await api("/api/profile/education-override", { method: "PUT", body: JSON.stringify(body) })); setDraft(null); }
    catch (x) { setErr(x.message || "Not saved."); }
  };
  const line = [e.degree, e.field].filter(Boolean).join(", ") || null;
  return (
    <div data-highest-degree={e.source || "none"} style={{ marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 4 }}>Highest degree — what forms are given</div>
      {!draft ? (
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: theme.text, fontWeight: 700 }}>
            {line || <span style={muted}>None yet — add a school below.</span>}
          </span>
          {(e.school || e.year) && <span style={muted}>{[e.school, e.year].filter(Boolean).join(" · ")}</span>}
          <span style={muted}>{e.source === "override" ? "· changed for forms" : e.source === "section" ? "· from your highest entry" : ""}</span>
          <div style={{ flex: 1 }} />
          <button className="rm-btn rm-btn-ghost rm-btn-sm"
            onClick={() => setDraft({ degree: e.degree || "", field: e.field || "", school: e.school || "", year: e.year || "" })}>Change</button>
          {e.source === "override" && <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => send({})}>Use the section</button>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {[["degree", "Degree"], ["field", "Field"], ["school", "School"], ["year", "Year (YYYY)"]].map(([k, label]) => (
            <label key={k} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: theme.textMuted }}>
              {label}
              <input style={input} value={draft[k]} onChange={x => setDraft(d => ({ ...d, [k]: x.target.value }))} />
            </label>
          ))}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setDraft(null)}>Cancel</button>
            <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={() => send(Object.fromEntries(Object.entries(draft)
              // Only what DIFFERS from the section is an override — the rest keeps following the entries.
              .filter(([k, v]) => String(v || "").trim() !== String(e.derived?.[k] || ""))))}>Save</button>
          </div>
        </div>
      )}
      {err && <span role="alert" style={{ fontSize: 12, color: C.DANGER }}>{err}</span>}
    </div>
  );
}

// ⭐ A140 (owner 11-08: "make the skills and keywords bold in the work experience extracted instead of the separate
// sections"): every skill / keyword on file — the Skills section's own and the job profile's extracted skills + keywords
// (`highlight`, from ProfilePanel) — is drawn BOLD where a bullet says it. Nothing is dropped: a term no bullet says is
// listed once under the experience, and the Skills list stays editable inside a closed fold.
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function termsRegex(terms) {
  const list = [...new Set((terms || []).map((x) => String(x || "").trim()).filter((x) => x.length >= 2))]
    .sort((a, b) => b.length - a.length).slice(0, 300);
  if (!list.length) return null;
  return new RegExp(`(?<![A-Za-z0-9+#])(${list.map(escRe).join("|")})(?![A-Za-z0-9+#])`, "gi");
}
export function BoldTerms({ text, re }) {
  if (!re || !text) return text || null;
  const parts = String(text).split(re);
  return parts.map((part, i) => (i % 2 === 1 ? <b key={i} data-term="">{part}</b> : part));
}

// ⭐ D183 P1 · THE PROFILE PAGE DRAWS ITS SECTIONS WITH THESE SAME EDITORS (pages/profile/YourProfile.jsx) — nothing is built
// twice. `parts` picks what this mount draws (status · summary · experience · projects · proofpage · education · skills ·
// links · defaults; all when omitted), `titles` renames a box (Summary → About), `eyeFor(id)` puts the section's eye in
// its box's corner, `slots` puts the page's own sections between them (Skills + Where you fit after Experience,
// Achievements after Projects), `renderLink` draws a link (GitHub / LinkedIn as their marks), and `onChanged` tells the
// page a section was saved (its header and skills re-read).
export default function ProfileSections({ theme, highlight = [], parts = null, titles = {}, eyeFor = null, slots = {}, renderLink = null, onChanged = null }) {
  const part = (x) => !parts || parts.includes(x);
  const eye = (id) => (eyeFor ? eyeFor(id) : null);
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [summary, setSummary] = useState(null);
  // ⭐ D105 P5: a skill with a PUBLISHED Atlas page links to it (resolved in one request, cached for the page).
  const atlasSlugs = useAtlasSlugs((p?.sections?.skills || []).map(x => x?.name));

  const load = useCallback(async () => {
    try { setP(await api("/api/profile/sections")); } catch (e) { setMsg(e.message || "Could not load your profile."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSection = async (section, body) => { setP(await api(`/api/profile/sections/${section}`, { method: "PUT", body: JSON.stringify(body) })); onChanged?.(); };
  const setDefault = async (key, value) => {
    setBusyKey(key); setMsg("");
    try {
      const r = await api(`/api/profile/defaults/${key}`, { method: "PUT", body: JSON.stringify({ value }) });
      setP(prev => ({ ...prev, defaults: r.defaults }));
    } catch (e) { setMsg(e.message || "Not saved."); } finally { setBusyKey(null); }
  };
  const useResume = async () => {
    try { setP(await api("/api/profile/sections/use-resume", { method: "POST" })); onChanged?.(); } catch (e) { setMsg(e.message || "Could not use it."); }
  };

  if (!p) return <p style={{ fontSize: 12, color: theme.textMuted }}>{msg || "Loading your profile…"}</p>;
  const s = p.sections;
  // A140: the terms to bold — the Skills section's + the job profile's extracted skills and keywords.
  const allTerms = [...new Set([...(s.skills || []).map((x) => String(x?.name || "").trim()), ...highlight.map((x) => String(x || "").trim())].filter(Boolean))];
  const termRe = termsRegex(allTerms);
  const bulletText = (s.experience || []).flatMap((x) => [x.title || "", ...(x.bullets || [])]).join(" · ");
  const unsaid = allTerms.filter((term) => { const r = termsRegex([term]); return !(r && r.test(bulletText)); });
  const muted = { fontSize: 12, color: theme.textMuted };
  return (
    <div data-profile-sections="">
      {part("status") && <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <span data-completeness="" style={markStyle(p.completeness.done === p.completeness.of ? C.SUCCESS : C.INFO)}>
          {p.completeness.done} of {p.completeness.of} complete</span>
        {p.suggestion && (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", ...muted }} data-resume-suggestion="">
            Your newer résumé reads differently.
            <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={useResume}>Use it</button>
          </span>
        )}
      </div>}
      {msg && <p role="alert" style={{ ...muted, color: C.DANGER }}>{msg}</p>}

      {part("summary") && <Box title={titles.summary || "Summary"} right={eye("about")} theme={theme}>
        {summary == null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 13, color: theme.text, whiteSpace: "pre-wrap" }}>{s.summary || <span style={muted}>No summary yet.</span>}</span>
            <div><button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setSummary(s.summary || "")}>Edit</button></div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea rows={5} value={summary} onChange={e => setSummary(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="rm-btn rm-btn-ghost rm-btn-sm" onClick={() => setSummary(null)}>Cancel</button>
              <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={async () => {
                try { await saveSection("summary", { summary }); setSummary(null); } catch (e) { setMsg(e.message); }
              }}>Save</button>
            </div>
          </div>
        )}
      </Box>}

      {part("experience") && <Box title={titles.experience || "Your experience"} right={eye("experience")} theme={theme}>
        <ListEditor theme={theme} items={s.experience} addLabel="+ Add a role"
          blank={{ company: "", title: "", location: "", start: "", end: "", current: false, bullets: [] }}
          fields={[{ k: "company", label: "Company" }, { k: "title", label: "Title" }, { k: "location", label: "Location" },
            { k: "start", label: "Start", type: "month" }, { k: "end", label: "End", type: "month" }, { k: "current", label: "Current", type: "check" },
            { k: "bullets", label: "What you did (one per line)", type: "lines", wide: true }]}
          onSave={(items) => saveSection("experience", { items: items.map(x => ({ ...x, bullets: (x.bullets || []).filter(b => b.trim()) })) })}
          render={(x) => (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <LogoTile logo={x.logo} initial={x.initial} theme={theme} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{x.title || "—"} · {x.company}</div>
                <div style={muted}>{[ymLabel(x.start), x.current ? "Present" : ymLabel(x.end)].filter(Boolean).join(" – ")}{x.location ? ` · ${x.location}` : ""}</div>
                {x.bullets.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                    {x.bullets.map((b, bi) => (
                      <li key={bi} data-bullet="" style={{ fontSize: 13, color: theme.text }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span><BoldTerms text={b} re={termRe} /></span><BackingMark backed={!!x.marks?.[bi]?.backed} />
                        </div>
                        <EvidenceLinks theme={theme} target="bullet" claim={b} links={x.evidence?.[bi] || []} onSaved={setP} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )} />
      </Box>}

      {part("experience") && unsaid.length > 0 && (
        <p data-terms-unsaid="" style={{ ...muted, margin: "-8px 0 20px", lineHeight: 1.7 }}>
          Also on your résumé: {unsaid.map((term, i) => <span key={term}>{i ? ", " : ""}<b style={{ color: theme.text }}>{term}</b></span>)}
        </p>
      )}

      {slots.afterExperience || null}

      {part("projects") && <Box title={titles.projects || "Projects"} right={eye("projects")} theme={theme}>
        <ListEditor theme={theme} items={s.projects || []} addLabel="+ Add a project" blank={{ name: "", description: "" }}
          fields={[{ k: "name", label: "Project" }, { k: "description", label: "What it is (optional)", wide: true }]}
          onSave={(items) => saveSection("projects", { items: items.map(x => ({ name: x.name, description: x.description })) })}
          render={(x) => (
            <div data-project="">
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{x.name}</span><BackingMark backed={!!x.backed} />
              </div>
              {x.description && <div style={muted}>{x.description}</div>}
              <EvidenceLinks theme={theme} target="project" claim={x.name} links={x.evidence || []} onSaved={setP} />
            </div>
          )} />
      </Box>}

      {slots.afterProjects || null}

      {part("proofpage") && <Box title="Proof page" theme={theme}>
        <ProofPageSetting theme={theme} />
      </Box>}

      {part("education") && <Box title={titles.education || "Education"} right={eye("education")} theme={theme}>
        <HighestDegree theme={theme} education={p.education} onSaved={setP} />
        <ListEditor theme={theme} items={s.education} addLabel="+ Add a school"
          blank={{ school: "", degree: "", field: "", start: "", end: "" }}
          fields={[{ k: "school", label: "School" }, { k: "degree", label: "Degree" }, { k: "field", label: "Field" },
            { k: "start", label: "Start", type: "month" }, { k: "end", label: "End", type: "month" }]}
          onSave={(items) => saveSection("education", { items })}
          render={(x) => (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{x.school}</div>
              <div style={muted}>{[x.degree, x.field].filter(Boolean).join(", ")}{x.end ? ` · ${ymLabel(x.end)}` : ""}</div>
            </div>
          )} />
      </Box>}

      {/* A140: the Skills list is no longer its own section — its skills are bold in the experience above (or listed under
          it); the list stays editable here, folded. */}
      {part("skills") && <details data-skills-edit="" style={{ marginBottom: 20 }}>
        <summary style={{ ...muted, cursor: "pointer", marginBottom: 10 }}>Edit your skills ({(s.skills || []).length})</summary>
        <ListEditor theme={theme} items={s.skills} addLabel="+ Add a skill" blank={{ name: "", category: "" }}
          fields={[{ k: "name", label: "Skill" }, { k: "category", label: "Group (optional)" }]}
          onSave={(items) => saveSection("skills", { items })}
          render={(x) => <span style={{ ...markStyle(C.INK_MUTED) }}>{atlasSlugs[String(x.name ?? "").trim()]
            ? <a href={atlasHref(atlasSlugs[String(x.name ?? "").trim()])} target="_blank" rel="noopener noreferrer" data-atlas-link=""
                title={`About ${x.name} in the Atlas`} style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>{x.name}</a>
            : x.name}</span>} />
      </details>}

      {part("links") && <Box title={titles.links || "Links"} right={eye("links")} theme={theme}>
        <ListEditor theme={theme} items={s.links} addLabel="+ Add a link" blank={{ kind: "website", url: "" }}
          fields={[{ k: "kind", label: "Kind (LinkedIn, GitHub, website)" }, { k: "url", label: "Address (https://…)", type: "url" }]}
          onSave={(items) => saveSection("links", { items })}
          render={(x) => (renderLink ? renderLink(x)
            : <span style={{ fontSize: 13, color: theme.text }}>{x.kind}: <a href={x.url} target="_blank" rel="noreferrer">{x.url}</a></span>)} />
      </Box>}

      {part("defaults") && <Box title="Application defaults" theme={theme}
        right={<span style={muted}>Saved as you change them</span>}>
        <p style={{ ...muted, margin: "0 0 12px", lineHeight: 1.6 }} data-defaults-rule="">
          What draft answers when a form asks. <b>Not set</b> is never answered for you — the question waits for you in
          Needs you, and what you answer there is saved here. <b>{EEO_DECLINE}</b> is an answer: the form's own decline is picked.
        </p>
        {p.defaults.map(g => (
          <div key={g.group} data-default-group={g.group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: theme.text, marginBottom: 8 }}>{g.label}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {g.items.map(it => <DefaultRow key={it.key} item={it} theme={theme} busy={busyKey === it.key} onSet={setDefault} />)}
            </div>
          </div>
        ))}
      </Box>}
    </div>
  );
}
