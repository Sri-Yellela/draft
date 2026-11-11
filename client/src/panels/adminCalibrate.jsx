// ⭐ D125 · ADMIN → DATA → ATS CALIBRATION (owner 11-01: "a manual enrichment task for me to compare and calibrate the
// ats module against … including scores and ats words detection"). Three views of services/atsCalibration.js:
//   THE SET     the frozen postings and their progress, the résumés they are paired with (add one), a new version, and
//               the optional assist (a batch to paste into a Claude chat HE runs — draft calls no model; the answer
//               comes back as suggestions he accepts or rejects).
//   ONE POSTING the text (the boilerplate the board ignores shown faded) beside draft's reading: every detected skill,
//               verb and competency marked right / wrong in one press, a skill moved must ↔ nice, what draft missed
//               typed in; per résumé the CURRENT score, band and breakdown, "feels too low · right · too high" and his
//               own 0–100. Saved as he goes; "Done" counts it.
//   RESULTS     precision / recall, must / nice accuracy, ρ against his scores, the bias per band, the worst pairs, the
//               fixes they point to (one press queues each for the agent), and the baseline the gate holds the scorer to.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import DepthButton from "../components/DepthButton.jsx";
import { C } from "../styles/colorTokens.js";
import { markStyle } from "../styles/mark.js";
import { Panel, row, quiet, sub, field } from "./adminKit.jsx";
import { ts } from "../themes/shapes.js";   // A116 (46g): inline sizes follow Settings → Text size

const BASE = "/api/admin/ats-calibration";
const send = (path, method, body) => api(`${BASE}${path}`, { method, body: JSON.stringify(body || {}) });
const f3 = (x) => (x == null ? "—" : x.toFixed(2));
const toggle = (on, tone = C.ACCENT_INK) => ({ border: `1px solid ${on ? tone : C.BORDER}`, background: on ? `color-mix(in srgb, ${tone} 14%, transparent)` : "transparent",
  color: C.INK, borderRadius: 6, padding: "3px 8px", fontSize: ts(12), cursor: "pointer", fontFamily: "inherit" });
// punctuation, bullets and case set aside, so "- Design, build…" is the counted " - Design, build…"
const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const FEEL = [["too_low", "too low"], ["right", "right"], ["too_high", "too high"]];

// ── one posting ─────────────────────────────────────────────────────────────────────────────────

function Terms({ title, terms, marks, onMark, tiers, onTier }) {
  if (!terms.length) return <div style={quiet}>{title}: none found.</div>;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: ts(13), marginBottom: 6 }}>{title} <span style={quiet}>({terms.length})</span></div>
      {terms.map(({ term, tier }) => (
        <div key={term} data-cal-term={term} style={{ ...row, gap: 6, margin: "3px 0" }}>
          <span style={{ minWidth: 140, fontSize: ts(13) }}>{term}</span>
          <button type="button" style={toggle(marks[term] === "right", C.SUCCESS)} onClick={() => onMark(term, "right")} data-cal-right="">right</button>
          <button type="button" style={toggle(marks[term] === "wrong", C.DANGER)} onClick={() => onMark(term, "wrong")} data-cal-wrong="">wrong</button>
          {onTier && (
            <button type="button" style={toggle((tiers[term] || tier) === "nice", C.INFO)} title="must ↔ nice"
              onClick={() => onTier(term, (tiers[term] || tier) === "must" ? "nice" : "must")}>{tiers[term] || tier}</button>
          )}
        </div>
      ))}
    </div>
  );
}

function AddTerms({ label, list, onChange }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (t && !list.some(x => x.toLowerCase() === t.toLowerCase())) onChange([...list, t]); setV(""); };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: ts(13), marginBottom: 6 }}>{label}</div>
      <div style={row}>
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} style={{ ...field, flex: 1, minWidth: 160 }}
          placeholder="type a term draft missed, Enter to add" aria-label={label}/>
        <DepthButton onClick={add}>Add</DepthButton>
      </div>
      <div style={{ ...row, gap: 6, marginTop: 6 }}>
        {list.map(t => (
          <span key={t} style={markStyle(C.SUCCESS)}>{t} <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(list.filter(x => x !== t))}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.INK_MUTED }}>×</button></span>
        ))}
      </div>
    </div>
  );
}

function Suggestions({ s, onAccept }) {
  if (!s) return null;
  const groups = [["wrong", "Wrongly found", "wrong"], ["missed", "Missed skills", "missed"], ["verbsMissed", "Missed verbs", "verbsMissed"], ["nice", "Only nice-to-have", "nice"]];
  const any = groups.some(([k]) => (s[k] || []).length);
  if (!any) return null;
  return (
    <div style={{ ...sub, marginBottom: 12 }} data-cal-suggestions="">
      <div style={{ fontWeight: 800, fontSize: ts(13) }}>The chat's suggestions — yours to accept</div>
      <div style={quiet}>Nothing here counts until you accept it.</div>
      {groups.map(([k, label]) => (s[k] || []).length ? (
        <div key={k} style={{ marginTop: 6 }}><span style={{ fontSize: ts(12), fontWeight: 700 }}>{label}: </span>
          {(s[k] || []).map(t => <button key={t} type="button" style={{ ...toggle(false), margin: 2 }} onClick={() => onAccept(k, t)}>+ {t}</button>)}
        </div>
      ) : null)}
    </div>
  );
}

function Posting({ id, onOpen, onBack }) {
  const [v, setV] = useState(null);
  const [rev, setRev] = useState(null);
  const [saved, setSaved] = useState("");
  const timer = useRef(null);
  useEffect(() => { setV(null); api(`${BASE}/item/${id}`).then((d) => { setV(d); setRev(d.review); }).catch((e) => setV({ error: e.message })); }, [id]);
  const save = useCallback((next, now = false) => {
    setRev(next); setSaved("saving…");
    clearTimeout(timer.current);
    const go = () => send(`/item/${id}`, "PUT", next).then(() => setSaved("saved")).catch((e) => setSaved(`not saved: ${e.message}`));
    if (now) return go();
    timer.current = setTimeout(go, 500);
    return null;
  }, [id]);
  if (!v) return <Panel title="ATS calibration" purpose="Loading the posting…"/>;
  if (v.error) return <Panel title="ATS calibration" purpose={v.error}/>;
  const r = rev;
  const mark = (kind) => (term, m) => save({ ...r, marks: { ...r.marks, [kind]: { ...r.marks[kind], [term]: r.marks[kind][term] === m ? undefined : m } } });
  const counted = v.counted || [];
  const countedKeys = counted.map(norm).filter(Boolean);
  const lines = String(v.text || "").split("\n");
  const accept = (k, t) => {
    if (k === "wrong") return mark("skills")(t, "wrong");
    if (k === "missed") return save({ ...r, added: { ...r.added, skills: [...r.added.skills, t] } });
    if (k === "verbsMissed") return save({ ...r, added: { ...r.added, verbs: [...r.added.verbs, t] } });
    return save({ ...r, tiers: { ...r.tiers, [t]: "nice" } });
  };
  return (
    <div data-cal-posting={v.id}>
      <div style={{ ...row, justifyContent: "space-between", marginBottom: 10 }}>
        <div style={row}>
          <DepthButton onClick={onBack}>← The set</DepthButton>
          <span style={quiet}>Posting {v.position} of {v.of} · set v{v.version} · {saved}</span>
        </div>
        <div style={row}>
          {v.prev && <DepthButton onClick={() => onOpen(v.prev)}>Previous</DepthButton>}
          <DepthButton primary data-cal-done="" onClick={async () => { await save({ ...r, done: true }, true); if (v.next) onOpen(v.next); else onBack(); }}>
            {r.done ? "Done ✓ — next" : "Done — next"}
          </DepthButton>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <Panel title={`${v.title}`} purpose={`${v.company} · ${v.category || "—"}${v.discipline ? ` · ${v.discipline}` : ""} · level ${v.level || "unread"}. Faded lines are what the board does not count: sections such as About us and About the role, and the company's boilerplate.`}>
          <div style={{ maxHeight: 640, overflowY: "auto", fontSize: ts(13), lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }} data-cal-text="">
            {lines.map((l, k) => {
              const lk = norm(l);
              const live = !lk || !counted.length || countedKeys.some(s => s.includes(lk) || lk.includes(s));
              return <div key={k} style={{ color: live ? C.INK : C.INK_FAINT }}>{l || " "}</div>;
            })}
          </div>
        </Panel>
        <div>
          <Panel title="draft's reading" purpose="Mark each one: right or wrong. A skill's last box moves it between must-have and nice-to-have.">
            <Suggestions s={r.suggestions} onAccept={accept}/>
            <Terms title="Skills" terms={v.reading.skills || []} marks={r.marks.skills} onMark={mark("skills")} tiers={r.tiers}
              onTier={(t, tier) => save({ ...r, tiers: { ...r.tiers, [t]: tier } })}/>
            <AddTerms label="Skills draft missed" list={r.added.skills} onChange={(l) => save({ ...r, added: { ...r.added, skills: l } })}/>
            <Terms title="Action verbs" terms={(v.reading.verbs || []).map(term => ({ term }))} marks={r.marks.verbs} onMark={mark("verbs")}/>
            <AddTerms label="Verbs draft missed" list={r.added.verbs} onChange={(l) => save({ ...r, added: { ...r.added, verbs: l } })}/>
            <Terms title="Competencies" terms={(v.reading.competencies || []).map(term => ({ term }))} marks={r.marks.competencies} onMark={mark("competencies")}/>
          </Panel>
          <Panel title="The scores" purpose="Today's scorer, for each résumé. How does each feel? Your own number is optional.">
            {v.pairs.map(p => {
              const s = r.scores[p.resumeId] || {};
              const set = (patch) => save({ ...r, scores: { ...r.scores, [p.resumeId]: { ...s, ...patch } } });
              return (
                <div key={p.resumeId} style={{ ...sub, marginBottom: 8 }} data-cal-pair={p.resumeId}>
                  <div style={{ ...row, justifyContent: "space-between" }}>
                    <b>{p.label}</b>
                    <span>{p.score == null ? "not scorable" : <><b style={{ fontSize: ts(18) }}>{p.score}</b> · {p.band}</>}</span>
                  </div>
                  {p.declined.length > 0 && <div style={quiet}>Declined: {p.declined.join("; ")}</div>}
                  <div style={{ fontSize: ts(12), margin: "4px 0", color: C.INK_MUTED }}>
                    <span style={{ color: C.SUCCESS }}>matched</span> {p.matched.slice(0, 12).join(", ") || "—"}<br/>
                    <span style={{ color: C.DANGER }}>missing</span> {p.missing.slice(0, 12).join(", ") || "—"}
                  </div>
                  <div style={row}>
                    <span style={quiet}>feels</span>
                    {FEEL.map(([k, label]) => <button key={k} type="button" style={toggle(s.feel === k)} onClick={() => set({ feel: s.feel === k ? null : k })}>{label}</button>)}
                    <input type="number" min={0} max={100} value={s.own ?? ""} placeholder="your 0–100" aria-label={`Your score for ${p.label}`}
                      onChange={(e) => set({ own: e.target.value === "" ? null : Number(e.target.value) })} style={{ ...field, width: 110 }}/>
                  </div>
                </div>
              );
            })}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ── the set ─────────────────────────────────────────────────────────────────────────────────────

function Assist({ items, onImported }) {
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const copy = async () => {
    const ids = items.filter(i => !i.done).slice(0, 10).map(i => i.id);
    if (!ids.length) return setMsg("Every posting is reviewed.");
    const b = await send("/assist", "POST", { ids });
    const text = `${b.instructions}\n\n${JSON.stringify(b.items, null, 1)}`;
    try { await navigator.clipboard.writeText(text); setMsg(`Copied ${ids.length} postings — paste them into a Claude chat, then paste its JSON answer below.`); }
    catch { setMsg("Could not copy — your browser blocked the clipboard."); }
    return null;
  };
  const load = () => send("/assist/import", "POST", { answer }).then(r => { setMsg(`Suggestions kept for ${r.items} postings — accept or reject them on each posting.`); setAnswer(""); onImported(); })
    .catch(e => setMsg(e.message));
  return (
    <Panel title="Optional: a second opinion" purpose="Copy the next 10 unreviewed postings for a Claude chat you run yourself; paste its answer back. It arrives as suggestions — nothing counts until you accept it.">
      <div style={row}><DepthButton onClick={copy} data-cal-assist-copy="">Copy this batch for a Claude chat</DepthButton></div>
      <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder='Paste the chat&apos;s JSON answer ({"items": [...]})'
        style={{ ...field, width: "100%", boxSizing: "border-box", marginTop: 8 }} aria-label="The chat's answer"/>
      <div style={{ ...row, marginTop: 6 }}><DepthButton onClick={load} disabled={!answer.trim()}>Import as suggestions</DepthButton><span style={quiet}>{msg}</span></div>
    </Panel>
  );
}

function Results() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => api(`${BASE}/results`).then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (err) return <Panel title="Results" purpose={err}/>;
  if (!d) return <Panel title="Results" purpose="Measuring today's scorer on the set…"/>;
  if (!d.reviewed) return <Panel title="Results" purpose="Nothing reviewed yet — mark a posting Done and its numbers appear here."/>;
  const box = (label, x, hint) => (
    <div style={{ ...sub, minWidth: 120 }}><div style={{ fontSize: ts(22), fontWeight: 800 }}>{f3(x)}</div><div style={quiet}>{label}{hint ? ` · ${hint}` : ""}</div></div>
  );
  return (
    <Panel title="Results" purpose={`Today's scorer on the ${d.reviewed} postings you have marked Done (set v${d.version}). Terms the scorer finds that you never judged are counted apart: skills ${d.unjudged.skills}, verbs ${d.unjudged.verbs}.`} data-cal-results="">
      <div style={{ ...row, alignItems: "stretch" }}>
        {box("skills precision", d.skills.precision)}{box("skills recall", d.skills.recall)}
        {box("verbs precision", d.verbs.precision)}{box("verbs recall", d.verbs.recall)}
        {box("must / nice right", d.tierAccuracy)}{box("ρ draft vs you", d.rho, `${d.rhoPairs} pairs; 0.72 to beat`)}
      </div>
      <h3 style={{ fontSize: ts(14), margin: "14px 0 6px" }}>Skills by discipline</h3>
      {Object.entries(d.byDiscipline).map(([k, x]) => <div key={k} style={{ fontSize: ts(13) }}>{k}: precision {f3(x.precision)} · recall {f3(x.recall)}</div>)}
      <h3 style={{ fontSize: ts(14), margin: "14px 0 6px" }}>How the scores felt, by band</h3>
      {Object.entries(d.bias).map(([b, x]) => <div key={b} style={{ fontSize: ts(13) }}>{b}: too low {x.too_low} · right {x.right} · too high {x.too_high}</div>)}
      {d.worst.length > 0 && <>
        <h3 style={{ fontSize: ts(14), margin: "14px 0 6px" }}>The 10 widest gaps</h3>
        {d.worst.map((w, k) => <div key={k} style={{ fontSize: ts(13) }}>{w.company} — {w.title} · {w.resume}: draft {w.draft}, you {w.own} ({w.gap > 0 ? "+" : ""}{w.gap})</div>)}
      </>}
      <h3 style={{ fontSize: ts(14), margin: "14px 0 6px" }}>The fixes this points to</h3>
      {d.fixes.length ? d.fixes.map(fx => (
        <div key={`${fx.kind}:${fx.term}`} style={{ ...row, margin: "3px 0" }} data-cal-fix={fx.kind}>
          <span style={markStyle(C.INFO)}>{fx.kind}</span><b style={{ fontSize: ts(13) }}>{fx.term}</b><span style={{ fontSize: ts(12), color: C.INK_MUTED }}>{fx.why}</span>
          <DepthButton onClick={() => send("/fix", "POST", fx).then(load)}>Queue for the agent</DepthButton>
        </div>
      )) : <div style={quiet}>None yet.</div>}
      <h3 style={{ fontSize: ts(14), margin: "14px 0 6px" }}>The gate</h3>
      <div style={{ fontSize: ts(13), marginBottom: 6 }}>
        {d.baseline ? (d.gate?.ok ? "Nothing has fallen below the baseline." : `Below the baseline: ${d.gate.drops.map(x => `${x.metric} ${f3(x.was)} → ${f3(x.is)}`).join("; ")}`)
          : "No baseline yet. Record one once enough postings are reviewed; scripts/d125GoldGate.mjs then fails any change that lowers these numbers."}
      </div>
      <DepthButton onClick={() => send("/baseline", "POST").then(load)} data-cal-baseline="">Record today's numbers as the baseline</DepthButton>
    </Panel>
  );
}

export function CalibrateTab() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(null);
  const [view, setView] = useState("set");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(() => api(BASE).then(setD).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (open) return <Posting id={open} onOpen={setOpen} onBack={() => { setOpen(null); load(); }}/>;
  if (err) return <Panel title="ATS calibration" purpose={err}/>;
  if (!d) return <Panel title="ATS calibration" purpose="Loading…"/>;
  const build = () => { setBusy(true); send("/build", "POST").then(load).catch(e => setErr(e.message)).finally(() => setBusy(false)); };
  return (
    <div data-admin-calibrate="">
      <div role="tablist" style={{ ...row, marginBottom: 12 }}>
        {[["set", "The set"], ["results", "Results"]].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} style={toggle(view === k)} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>
      {view === "results" ? <Results/> : <>
        <Panel title="ATS calibration" purpose={d.version
          ? `Set v${d.version}: ${d.done} of ${d.items.length} postings reviewed. Each posting is frozen as it was when the set was made, so every later change to the scorer is measured on the same pairs. About 2 minutes a posting.`
          : "No set yet. Make one: 20 computing and 20 other-field postings, entry to senior, each frozen with draft's reading."}>
          <div style={row}>
            <DepthButton primary onClick={build} disabled={busy} data-cal-build="">{busy ? "Making the set…" : d.version ? `Make a new set (v${d.version + 1})` : "Make the set"}</DepthButton>
            {d.version && <span style={quiet}>A new version starts a fresh review; earlier versions are kept.</span>}
          </div>
          <div style={{ marginTop: 12 }}>
            {d.items.map((i, k) => (
              <button key={i.id} type="button" onClick={() => setOpen(i.id)} data-cal-item={i.id}
                style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", textAlign: "left", padding: "6px 8px", border: "none",
                         borderBottom: `1px solid ${C.BORDER}`, background: "transparent", color: C.INK, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ width: 24, ...quiet }}>{k + 1}</span>
                <span style={{ flex: 1, fontSize: ts(13) }}><b>{i.title}</b> · {i.company}</span>
                <span style={quiet}>{i.discipline || i.category} · {i.level || "—"}</span>
                <span style={markStyle(i.done ? C.SUCCESS : C.BAND_UNKNOWN)}>{i.done ? "done" : "to do"}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="The résumés each posting is scored against" purpose="The trial's samples, your own (copied from your user account — the admin account has no résumé) and any you paste. Add yours before making the set, so its reading includes it.">
          {d.resumes.map(r => <div key={r.id} style={{ fontSize: ts(13) }}>{r.label} <span style={quiet}>· {r.source.split(":")[0]}</span></div>)}
          <div style={{ ...row, marginTop: 10 }}>
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Your username or email" style={{ ...field, minWidth: 220 }} aria-label="Your account"/>
            <DepthButton disabled={!who.trim()} data-cal-copy-own="" onClick={() => send("/resume", "POST", { who }).then(() => { setWho(""); setNote("Copied."); load(); }).catch(e => setNote(e.message))}>Copy my résumé</DepthButton>
            <span style={quiet}>{note}</span>
          </div>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. 'Mechanical, senior'" style={field} aria-label="Résumé label"/>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste the résumé's text" style={field} aria-label="Résumé text"/>
            <div><DepthButton disabled={text.trim().length < 200} onClick={() => send("/resume", "POST", { label, text }).then(() => { setLabel(""); setText(""); load(); }).catch(e => setErr(e.message))}>Add this résumé</DepthButton></div>
          </div>
        </Panel>
        {d.version && <Assist items={d.items} onImported={load}/>}
        {d.fixes?.length > 0 && (
          <Panel title="Queued for the agent" purpose="Fixes you sent from Results.">
            {d.fixes.map(fx => <div key={fx.id} style={{ fontSize: ts(13) }}>{fx.kind} · <b>{fx.term}</b> — {fx.why} <span style={quiet}>({fx.status})</span></div>)}
          </Panel>
        )}
      </>}
    </div>
  );
}
