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
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
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

export default function ProfileSections({ theme }) {
  const [p, setP] = useState(null);
  const [msg, setMsg] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    try { setP(await api("/api/profile/sections")); } catch (e) { setMsg(e.message || "Could not load your profile."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveSection = async (section, body) => setP(await api(`/api/profile/sections/${section}`, { method: "PUT", body: JSON.stringify(body) }));
  const setDefault = async (key, value) => {
    setBusyKey(key); setMsg("");
    try {
      const r = await api(`/api/profile/defaults/${key}`, { method: "PUT", body: JSON.stringify({ value }) });
      setP(prev => ({ ...prev, defaults: r.defaults }));
    } catch (e) { setMsg(e.message || "Not saved."); } finally { setBusyKey(null); }
  };
  const useResume = async () => {
    try { setP(await api("/api/profile/sections/use-resume", { method: "POST" })); } catch (e) { setMsg(e.message || "Could not use it."); }
  };

  if (!p) return <p style={{ fontSize: 12, color: theme.textMuted }}>{msg || "Loading your profile…"}</p>;
  const s = p.sections;
  const muted = { fontSize: 12, color: theme.textMuted };
  return (
    <div data-profile-sections="">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <span data-completeness="" style={markStyle(p.completeness.done === p.completeness.of ? C.SUCCESS : C.INFO)}>
          {p.completeness.done} of {p.completeness.of} complete</span>
        {p.suggestion && (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", ...muted }} data-resume-suggestion="">
            Your newer résumé reads differently.
            <button className="rm-btn rm-btn-primary rm-btn-sm" onClick={useResume}>Use it</button>
          </span>
        )}
      </div>
      {msg && <p role="alert" style={{ ...muted, color: C.DANGER }}>{msg}</p>}

      <Box title="Summary" theme={theme}>
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
      </Box>

      <Box title="Experience" theme={theme}>
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
              </div>
            </div>
          )} />
      </Box>

      <Box title="Education" theme={theme}>
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
      </Box>

      <Box title="Skills" theme={theme}>
        <ListEditor theme={theme} items={s.skills} addLabel="+ Add a skill" blank={{ name: "", category: "" }}
          fields={[{ k: "name", label: "Skill" }, { k: "category", label: "Group (optional)" }]}
          onSave={(items) => saveSection("skills", { items })}
          render={(x) => <span style={{ ...markStyle(C.INK_MUTED) }}>{x.name}</span>} />
      </Box>

      <Box title="Links" theme={theme}>
        <ListEditor theme={theme} items={s.links} addLabel="+ Add a link" blank={{ kind: "website", url: "" }}
          fields={[{ k: "kind", label: "Kind (LinkedIn, GitHub, website)" }, { k: "url", label: "Address (https://…)", type: "url" }]}
          onSave={(items) => saveSection("links", { items })}
          render={(x) => <span style={{ fontSize: 13, color: theme.text }}>{x.kind}: <a href={x.url} target="_blank" rel="noreferrer">{x.url}</a></span>} />
      </Box>

      <Box title="Application defaults" theme={theme}
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
      </Box>
    </div>
  );
}
