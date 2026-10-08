// client/src/panels/adminEnrichment.jsx — D83 BUILD 1 / 1b / 1c: Admin → Enrichment, one page, six steps.
//
// Built to the owner's sketch (admin-enrichment.html, "Enrichment — the six steps"). The rules it is judged by:
// one sentence of purpose · the state as NUMBERS with no click · one obvious next step · a path where a step unlocks
// only when the one before is done and says why it waits · every write has a confirm and an undo · plain words and
// real controls (the source is a dropdown of the board's real sources). Project codes live behind a ? tooltip only.
//
// ⛔ NOTHING HERE CALLS A MODEL, AND NO API KEY IS ASKED FOR (BUILD 1c). The page splits the export into pieces,
// checks each reply against the importer's own rules the instant it is uploaded, and joins them — all in the browser,
// with shared/enrichmentChunks.js, the SAME functions the CLI runs. The human carries each piece to an ordinary chat
// and back. Every request on this page goes to /api/admin/enrichment/*.
//
// ⛔ THE LIMITS ARE READ, NEVER COPIED: the backlog, coverage, sources and the 500-row cap come from GET /overview; the
// allowed values and the instructions come from shared/enrichmentRules.js via enrichmentPrompt().
//
// ⛔ APPLY IS LOCKED UNTIL A CLEAN DRY RUN OF THAT EXACT FILE (applyGate) and re-locks the moment the file changes.
// The two safety switches (fill empty columns only · refuse changed postings) stay ON and are shown as on; turning
// one off is an explicit, labelled expert action, and resets whenever the file changes.
import { useState, useEffect, useCallback, useRef } from "react";
import { api, authHeaders, authContextQuery, downloadBlob } from "../lib/api.js";
import { C } from "../styles/colorTokens.js";
import { markStyle, LOGO_FACE } from "../styles/mark.js";
import DepthButton from "../components/DepthButton.jsx";
import {
  enrichmentPrompt, buildPieces, checkPiece, redoPiece, mergeFilled, applyGate, refusalCounts, withoutRefused,
  DEFAULT_CHUNK_ROWS,
} from "../../../shared/enrichmentChunks.js";

const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
const pctOf = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const kb = (bytes) => `about ${Math.max(1, Math.round(bytes / 1024))} KB`;
const day = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "—");
const fileStamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
const PRACTICE_ROWS = 20;

// ── small parts ──────────────────────────────────────────────────────────────────────────────────

// A ? that holds the project vocabulary (and any detail) out of the main text. A perfect circle — allowed (D60).
function Help({ tip }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", verticalAlign: "middle", marginLeft: 5 }}>
      <button type="button" aria-label={tip} title={tip} data-tip={tip}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        style={{ width: 18, height: 18, borderRadius: "50%", border: `1px solid ${C.BORDER_STRONG}`, padding: 0,
                 background: "transparent", color: C.INK_FAINT, fontWeight: 700, fontSize: 11, lineHeight: 1, cursor: "help" }}>?</button>
      {open && (
        <span role="tooltip" style={{ position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)",
          width: 240, background: C.INK, color: C.SURFACE_SOLID, fontWeight: 500, fontSize: 11.5, lineHeight: 1.4, padding: "8px 10px",
          borderRadius: 8, zIndex: 9, textAlign: "left" }}>{tip}</span>
      )}
    </span>
  );
}

function Mark({ tone, children }) { return <span style={markStyle(tone)}>{children}</span>; }

function NumberBox({ value, label, good }) {
  return (
    <div style={{ background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
      <b style={{ display: "block", font: "400 34px/1 'Instrument Serif', Georgia, serif", color: good ? C.SUCCESS : C.ACCENT_INK }}>{value}</b>
      <span style={{ fontSize: 11.5, color: C.INK_FAINT }}>{label}</span>
    </div>
  );
}

function CoverageBar({ label, filled, total, gain = 0 }) {
  const p = pctOf(filled, total), add = pctOf(gain, total);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 96px", gap: 10, alignItems: "center", fontSize: 12, padding: "3px 0" }}>
      <span>{label}</span>
      <div style={{ height: 8, borderRadius: 4, background: C.BORDER, overflow: "hidden", position: "relative" }}
        role="meter" aria-label={`${label}: ${p}% filled`} aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ position: "absolute", inset: "0 auto 0 0", width: `${p}%`, background: p < 40 ? C.WARNING : C.ACCENT, borderRadius: 4 }}/>
        {add > 0 && <u style={{ position: "absolute", top: 0, bottom: 0, left: `${p}%`, width: `${add}%`, background: C.SUCCESS, opacity: 0.55 }}/>}
      </div>
      <span style={{ textAlign: "right", font: "700 12px ui-monospace, monospace" }}>
        {p}%{add > 0 && <span style={{ color: C.SUCCESS }}> → {Math.round((p + add) * 10) / 10}%</span>}
      </span>
    </div>
  );
}

const panel = { background: C.SURFACE_SOLID, border: `1px solid ${C.BORDER}`, borderRadius: 16, padding: "18px 20px", marginBottom: 14 };
const h2 = { font: `800 italic 20px/1.1 ${LOGO_FACE}`, color: C.INK, margin: 0 };
const what = { fontSize: 13, color: C.INK_MUTED, margin: "6px 0 16px", maxWidth: "80ch" };
const row = { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" };
const quiet = { fontSize: 12, color: C.INK_FAINT };
const sub = { border: `1px solid ${C.BORDER}`, borderRadius: 11, padding: "11px 13px", background: C.CANVAS };
const callout = (tone) => ({ borderLeft: `3px solid ${tone}`, background: `color-mix(in srgb, ${tone} 10%, transparent)`,
  borderRadius: "0 9px 9px 0", padding: "8px 11px", fontSize: 12, color: C.INK_MUTED });
const field = { background: C.SURFACE_INPUT, border: `1px solid ${C.BORDER_CONTROL}`, color: C.INK, borderRadius: 9,
  padding: "8px 10px", fontWeight: 500, fontSize: 12.5 };

function Step({ n, state, title, children }) {
  const active = state === "active", done = state === "done";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, display: "grid", placeItems: "center", marginTop: 10,
        font: `800 italic 14px ${LOGO_FACE}`, border: `1px solid ${active ? C.ACCENT : done ? C.SUCCESS : C.BORDER}`,
        background: active ? C.ACCENT : done ? C.SUCCESS_QUIET : C.CANVAS, color: active ? C.ON_ACCENT : done ? C.SUCCESS : C.INK_FAINT }}>{n}</div>
      <section aria-current={active ? "step" : undefined} aria-label={`Step ${n}: ${title}`}
        style={{ background: C.SURFACE_SOLID, border: `1px solid ${active ? C.ACCENT_INK : C.BORDER}`,
          borderLeft: `4px solid ${active ? C.ACCENT : done ? C.SUCCESS : C.BORDER}`, borderRadius: 13, padding: "12px 15px",
          opacity: state === "locked" ? 0.6 : 1 }}>
        <div style={{ ...row }}>
          <h3 style={{ font: `800 italic 15px/1.1 ${LOGO_FACE}`, color: C.INK, flex: 1, margin: 0 }}>{title}</h3>
          {done ? <Mark tone={C.SUCCESS}>Done</Mark> : active ? <Mark tone={C.ACCENT_INK}>Your turn</Mark> : <Mark tone={C.INK_FAINT}>Waiting</Mark>}
        </div>
        {state !== "locked" && <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>}
      </section>
    </div>
  );
}

function Dialog({ title, children, onCancel, confirmLabel, onConfirm, busy }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCancel]);
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: C.SCRIM, display: "grid", placeItems: "center", zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ background: C.SURFACE_MODAL, border: `1px solid ${C.BORDER}`, borderRadius: 16, padding: 20, maxWidth: 440 }}>
        <h4 style={{ font: `800 italic 17px ${LOGO_FACE}`, color: C.INK, margin: "0 0 8px" }}>{title}</h4>
        <div style={{ fontSize: 12.5, color: C.INK_MUTED }}>{children}</div>
        <div style={{ ...row, marginTop: 14 }}>
          <DepthButton onClick={onCancel}>Go back</DepthButton>
          <DepthButton primary disabled={busy} onClick={onConfirm} autoFocus>{busy ? "Working…" : confirmLabel}</DepthButton>
        </div>
      </div>
    </div>
  );
}

// ── the raw upload, as DBInspector's round trip sends it (application/x-ndjson, flags in the query) ──
async function postImport(text, { apply, overwrite, allowStale }) {
  const qs = new URLSearchParams();
  if (apply) qs.set("apply", "1");
  if (overwrite) qs.set("overwrite", "1");
  if (allowStale) qs.set("allowStale", "1");
  const ctx = authContextQuery();
  if (ctx) for (const [k, v] of new URLSearchParams(ctx)) qs.set(k, v);
  const r = await fetch(`/api/admin/enrichment/import?${qs}`, {
    method: "POST", credentials: "include", headers: authHeaders({ "Content-Type": "application/x-ndjson" }), body: text,
  });
  const payload = await r.json().catch(() => ({ error: `HTTP ${r.status} (no JSON body)` }));
  return { ok: r.ok, payload };
}

// ── the page ─────────────────────────────────────────────────────────────────────────────────────

export function EnrichmentTab() {
  const [ov, setOv] = useState(null);                 // GET /overview — the numbers, loaded on open
  const [batches, setBatches] = useState([]);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState(PRACTICE_ROWS);
  const [source, setSource] = useState("");
  const [clean, setClean] = useState(true);
  const [exp, setExp] = useState(null);               // { text, name, rows, pieces:[{…, replies:[], check}] }
  const [importText, setImportText] = useState("");   // the joined (or chosen) import file
  const [importName, setImportName] = useState("");
  const [redo, setRedo] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [allowStale, setAllowStale] = useState(false);
  const [dry, setDry] = useState(null);               // { forText, plan, body }
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [applied, setApplied] = useState(null);
  const [undoPlan, setUndoPlan] = useState(null);
  const [copied, setCopied] = useState(false);
  const replyInputs = useRef({});
  const fileInput = useRef(null);

  const load = useCallback(() => {
    api("/api/admin/enrichment/overview").then(setOv).catch((e) => setErr(e.message));
    api("/api/admin/enrichment/batches?source=import&kind=enrichment&limit=20").then((b) => setBatches(b.batches || [])).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);               // ⛔ the numbers load without a click

  const cap = ov?.importRowCap ?? null;
  const prompt = enrichmentPrompt();

  // A new import file voids the dry run AND both expert switches: a verdict belongs to the bytes it was made for.
  const setFile = (text, name) => {
    setImportText(text); setImportName(name); setDry(null); setApplied(null); setOverwrite(false); setAllowStale(false);
  };

  // ── step 2 · export ──
  const doExport = async () => {
    setBusy("export"); setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(rows) });
      if (source) qs.set("source", source);
      const ctx = authContextQuery();
      if (ctx) for (const [k, v] of new URLSearchParams(ctx)) qs.set(k, v);
      const r = await fetch(`/api/admin/enrichment/export?${qs}`, { credentials: "include", headers: authHeaders() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Export failed (${r.status})`);
      const text = await r.text();
      const { rows: n, pieces, removedParagraphs } = buildPieces(text, { size: DEFAULT_CHUNK_ROWS, clean });
      if (!n) throw new Error("Nothing to export — no posting needs enrichment for this choice.");
      const name = `enrichment-export-${fileStamp()}.jsonl`;
      await downloadBlob(new Blob([text], { type: "application/x-ndjson" }), name);
      setExp({ text, name, rows: n, removedParagraphs, pieces: pieces.map((p) => ({ ...p, replies: [], check: null })) });
      setFile("", ""); setRedo("");
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // ── step 3 · pieces ──
  const pieceName = (p) => `piece-${String(p.n).padStart(2, "0")}-of-${String(p.of).padStart(2, "0")}.jsonl`;
  const downloadPiece = (p) => downloadBlob(new Blob([p.text], { type: "application/x-ndjson" }), pieceName(p));
  const downloadRedoRows = (p) => downloadBlob(new Blob([redoPiece(p.text, p.replies)], { type: "application/x-ndjson" }),
    pieceName(p).replace(".jsonl", "-redo.jsonl"));
  const uploadReply = async (i, file, { replace }) => {
    if (!file) return;
    const text = await file.text();
    setExp((x) => {
      const pieces = x.pieces.map((p, k) => {
        if (k !== i) return p;
        const replies = [...(replace ? [] : p.replies), { name: file.name, text }];
        return { ...p, replies, check: checkPiece(p.text, replies) };
      });
      return { ...x, pieces };
    });
    setFile("", "");          // a changed reply means the joined file is out of date
  };
  const allChecked = Boolean(exp?.pieces.length) && exp.pieces.every((p) => p.check?.checked);
  const join = () => {
    const replies = exp.pieces.flatMap((p) => p.replies);
    const { files, redo: r } = mergeFilled(exp.text, replies, { max: cap ?? undefined });
    setRedo(r);
    setFile(files[0] || "", `import-${fileStamp()}.jsonl`);
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { setErr("The browser refused the copy — select the instructions and copy them by hand."); }
  };

  // ── step 4 · dry run ──
  const runDry = async () => {
    setBusy("dry"); setErr(null);
    try {
      const { ok, payload } = await postImport(importText, { apply: false, overwrite, allowStale });
      if (!ok) { setErr(payload.error || "The rehearsal failed."); setDry(null); }
      else setDry({ forText: importText, plan: payload.plan, body: payload });
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };
  const takeOutRefused = () => {
    const { text, refused } = withoutRefused(importText, dry.plan.rejected);
    setRedo((r) => r + refused);
    setFile(text, importName.replace(/(\.jsonl)?$/, "-clean.jsonl"));
  };

  // ── step 5 · apply ──
  const gate = applyGate(dry, importText);
  const doApply = async () => {
    setBusy("apply"); setErr(null);
    try {
      const { ok, payload } = await postImport(importText, { apply: true, overwrite, allowStale });
      if (!ok) setErr(payload.error || "The import was refused. Nothing was written.");
      else { setApplied(payload); setConfirm(false); load(); }
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // ── undo (every past import) — the dry run says what it restores, then a confirm, then the apply quotes its count ──
  const askUndo = async (b) => {
    setBusy("undo-plan"); setErr(null);
    try { setUndoPlan({ batch: b, ...(await api(`/api/admin/enrichment/batches/${b.id}/revert`, { method: "POST", body: "{}" })) }); }
    catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };
  const doUndo = async () => {
    setBusy("undo"); setErr(null);
    try {
      await api(`/api/admin/enrichment/batches/${undoPlan.batchId}/revert`, {
        method: "POST", body: JSON.stringify({ apply: true, expectRestorable: undoPlan.restorable }) });
      if (applied?.batchId === undoPlan.batchId) setApplied(null);
      setUndoPlan(null); load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  };

  // ── where the path stands ──
  const step = applied ? 6 : gate.unlocked ? 5 : importText ? 4 : exp ? 3 : 2;
  const stateOf = (n) => (n === 1 || n < step ? "done" : n === step ? "active" : "locked");
  const plan = dry && dry.forText === importText ? dry.plan : null;
  const refusals = plan ? refusalCounts(plan.rejected) : [];
  const skillsGroup = ov?.groups.find((g) => g.key === "skills");
  // The projection is a dry run's "after" — once applied, the reloaded numbers ARE the after, so it is not added again.
  const projecting = Boolean(plan) && !applied;
  const projectedGain = (g) => (projecting ? Math.max(0, ...g.columns.map((c) => plan.perColumn?.[c] || 0)) : 0);
  const backlog = ov?.backlog;
  const scoredShare = ov ? pctOf(ov.newPostings.scored, ov.newPostings.total) : null;

  return (
    <div>
      {err && <div role="alert" style={{ ...callout(C.DANGER), marginBottom: 12, color: C.DANGER }}>{err}</div>}
      <input type="file" accept=".jsonl,.ndjson,.json,.txt,text/plain" hidden ref={fileInput}
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setFile(await f.text(), f.name); setRedo(""); } e.target.value = ""; }}/>

      {/* ── the panel: purpose, numbers, coverage ── */}
      <div style={panel}>
        <h2 style={h2}>Enrichment</h2>
        <p style={what}>
          Fills in the skills, level and other facts the board is missing, so new postings can be scored. <b>No AI runs
          inside draft</b><Help tip="You fill the file with a model or by hand OUTSIDE the product, then import it. draft only checks and imports it (design rule D17)."/> — you
          fill the file outside, then import it back, and every import can be undone.
        </p>
        {!ov ? <p style={quiet}>Counting…</p> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
              <NumberBox value={num(backlog)} label="postings need enrichment"/>
              <NumberBox value={ov.newPostings.total ? `${scoredShare}%` : "—"}
                label={`of new postings (last ${ov.newPostings.days} days) have a fit score`}/>
              <NumberBox value={num(ov.imports.count)} label="imports so far — each can be undone"/>
              <NumberBox value={backlog ? `≈ ${Math.ceil(backlog / ov.importRowCap)}` : "0"} label={`batches of ${ov.importRowCap} to clear it`} good={!backlog}/>
            </div>
            <p style={{ font: `800 italic 11.5px/1 ${LOGO_FACE}`, color: C.INK_FAINT, margin: "0 0 8px" }}>
              How full each column is, across the active board ({num(ov.board)} postings){projecting ? " — and after this import" : ""}
            </p>
            {ov.groups.map((g) => <CoverageBar key={g.key} label={g.label} filled={g.filled} total={g.total} gain={projectedGain(g)}/>)}
          </>
        )}
      </div>

      {/* ── the six steps ── */}
      <Step n={1} state={stateOf(1)} title="Count what needs enriching">
        <p style={{ fontSize: 12.5, color: C.INK_MUTED, margin: 0 }}>
          Done automatically when the page opens. Counted above: <b>{num(backlog)}</b> postings have a description, were
          seen in the last {ov?.freshnessGateDays ?? "few"} days, and have never been enriched or have changed since.
        </p>
      </Step>

      <Step n={2} state={stateOf(2)} title="Export a batch">
        {exp ? (
          <div style={row}>
            <p style={{ fontSize: 12.5, color: C.INK_MUTED, margin: 0 }}>
              Saved as <b>{exp.name}</b> in your <b>Downloads folder</b> — {num(exp.rows)} postings.
            </p>
            <DepthButton size="compact" onClick={() => { setExp(null); setFile("", ""); setRedo(""); }}>Start a different batch</DepthButton>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12.5, margin: 0 }}><b>Start small.</b> Do a practice batch of <b>{PRACTICE_ROWS}</b> (one piece) to
              learn the path, then 60, then {cap ?? "the most one import takes"}.</p>
            <div style={row}>
              <label style={quiet} htmlFor="enr-rows">How many</label>
              <input id="enr-rows" type="number" value={rows} min={1} max={cap ?? undefined} step={10} style={{ ...field, width: 90 }}
                onChange={(e) => setRows(Math.max(1, Math.min(cap ?? Infinity, Math.round(+e.target.value || 1))))}/>
              {cap != null && <Help tip={`${cap} is the most one import takes comfortably.`}/>}
              <label style={{ ...quiet, display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)}/> Clean the text
              </label>
              <Help tip="Removes HTML and boilerplate such as equal-opportunity, benefits and about-us paragraphs from the pieces' copy. Nothing about the role, the pay, eligibility or where the work happens is cut, nothing is shortened, and your stored postings are never changed."/>
              <label style={quiet} htmlFor="enr-source">Source</label>
              <select id="enr-source" value={source} onChange={(e) => setSource(e.target.value)} style={field}>
                <option value="">Any source</option>
                {(ov?.sources || []).map((s) => <option key={s.value} value={s.value}>{s.value} ({num(s.count)})</option>)}
              </select>
              <DepthButton primary disabled={busy === "export" || !ov} onClick={doExport}>
                {busy === "export" ? "Exporting…" : `Export ${num(rows)} postings`}
              </DepthButton>
            </div>
            <div style={row}>
              <span style={quiet}>Already have a filled import file?</span>
              <DepthButton size="compact" onClick={() => fileInput.current?.click()}>Choose it and go to the dry run</DepthButton>
            </div>
          </>
        )}
      </Step>

      <Step n={3} state={stateOf(3)} title="Fill it outside the product">
        {exp && (
          <>
            <div style={callout(C.SUCCESS)}>
              <b>No terminal and no API key.</b> This page cut your export into <b>{exp.pieces.length} piece{exp.pieces.length === 1 ? "" : "s"}</b>
              {exp.removedParagraphs ? ` (and left ${num(exp.removedParagraphs)} boilerplate paragraphs out of the copies)` : ""}, checks
              each reply against the importer's own rules the moment you upload it, and joins them. The only outside step is an
              ordinary chat with a model (Claude or any assistant) — <b>nothing in draft calls one.</b>
            </div>
            <div style={sub}>
              <h5 style={{ font: `800 italic 13px ${LOGO_FACE}`, color: C.INK, margin: "0 0 4px" }}>How each piece works</h5>
              <ol style={{ listStyle: "decimal", paddingLeft: 20, fontSize: 12.5, color: C.INK_MUTED, margin: "0 0 6px" }}>
                <li><b>Download</b> the piece — it lands in your Downloads folder.</li>
                <li>In a chat with a model (not inside draft), <b>attach the file</b> and paste the instructions below.</li>
                <li><b>Save the model's reply as a file</b> (for example <code>piece-01.reply.jsonl</code>).</li>
                <li><b>Upload the reply here</b> — it is checked straight away.</li>
              </ol>
              <pre aria-label="The instructions for the model" style={{ background: C.CANVAS_SHADE, border: `1px solid ${C.BORDER}`, borderRadius: 9,
                padding: "10px 12px", font: "500 11.5px/1.55 ui-monospace, monospace", color: C.INK_MUTED, maxHeight: 160, overflow: "auto",
                whiteSpace: "pre-wrap", margin: "6px 0" }}>{prompt}</pre>
              <div style={row}>
                <DepthButton size="compact" onClick={copyPrompt}>{copied ? "Copied" : "Copy the instructions"}</DepthButton>
                <span style={{ fontSize: 11.5, color: C.INK_FAINT }}>They include every allowed value — read from the importer, so they cannot go out of date.</span>
              </div>
            </div>
            <div style={sub}>
              <h5 style={{ font: `800 italic 13px ${LOGO_FACE}`, color: C.INK, margin: "0 0 4px" }}>
                Your pieces — {exp.pieces.filter((p) => p.check?.checked).length} of {exp.pieces.length} done
              </h5>
              {exp.pieces.map((p, i) => (
                <div key={p.n} style={{ borderTop: `1px dashed ${C.BORDER}`, padding: "7px 0" }}>
                  <div style={{ ...row, fontSize: 12, color: C.INK_FAINT }}>
                    <b style={{ font: `800 italic 13px ${LOGO_FACE}`, color: C.INK, minWidth: 110 }}>Piece {p.n} of {p.of}</b>
                    <span>{p.rows} postings · {kb(p.bytes)}</span>
                    <DepthButton size="compact" onClick={() => downloadPiece(p)}>Download</DepthButton>
                    <input type="file" accept=".jsonl,.ndjson,.json,.txt,text/plain" hidden ref={(el) => { replyInputs.current[i] = el; }}
                      onChange={(e) => { uploadReply(i, e.target.files?.[0], { replace: p.check?.checked || !p.replies.length }); e.target.value = ""; }}/>
                    <DepthButton size="compact" primary={!p.check?.checked} onClick={() => replyInputs.current[i]?.click()}>
                      {p.check?.checked ? "Replace the reply" : p.replies.length ? "Upload a second reply" : "Upload the reply"}
                    </DepthButton>
                    {!p.check ? <Mark tone={C.INK_FAINT}>Waiting</Mark>
                      : p.check.checked ? <Mark tone={C.SUCCESS}>Checked — {p.check.valid} of {p.check.total} rows valid</Mark>
                      : <Mark tone={C.WARNING}>{p.check.problems.length} row{p.check.problems.length === 1 ? "" : "s"} to fix</Mark>}
                  </div>
                  {p.check && !p.check.checked && (
                    <div style={{ ...callout(C.WARNING), marginTop: 6 }}>
                      <b>Not accepted yet.</b> {p.check.valid} of {p.check.total} rows are valid and kept. These need another try:
                      <ul style={{ listStyle: "disc", margin: "4px 0", paddingLeft: 20 }}>
                        {p.check.problems.slice(0, 8).map((x, k) => <li key={k}><code>{x.jobId ?? `line ${x.line}`}</code> — {x.why}</li>)}
                        {p.check.problems.length > 8 && <li>… and {p.check.problems.length - 8} more</li>}
                      </ul>
                      <div style={row}>
                        <DepthButton size="compact" onClick={() => downloadRedoRows(p)}>Download just these rows</DepthButton>
                        <span>Fill them the same way, then <b>Upload a second reply</b> — the valid rows above are kept.</span>
                      </div>
                    </div>
                  )}
                  {p.check?.checked && p.check.empty > 0 && (
                    <div style={{ fontSize: 11.5, color: C.INK_FAINT, marginTop: 4 }}>{p.check.empty} came back with nothing filled — nothing to write for those.</div>
                  )}
                </div>
              ))}
              <p style={{ fontSize: 12, margin: "6px 0 0" }}>A reply with a bad row is <b>not</b> accepted silently: the page lists the rows and keeps the good ones for a second try.</p>
            </div>
            <div style={row}>
              <DepthButton primary={!importText} disabled={!allChecked} onClick={join}>Join the pieces</DepthButton>
              {!allChecked && <span style={quiet}>Unlocks when every piece shows Checked.</span>}
              {importText && <span style={quiet}>Joined into <b>{importName}</b> and ready for the dry run.</span>}
            </div>
          </>
        )}
      </Step>

      <Step n={4} state={stateOf(4)} title="Dry run">
        <div style={callout(C.INFO)}>
          <b>What is a dry run?</b> A rehearsal. draft reads your file and tells you exactly what it <b>would</b> change —
          <b> nothing is saved.</b> If the rehearsal is clean, <b>Apply</b> unlocks for that exact file.
        </div>
        <div style={row}>
          <label style={quiet}>File</label>
          <b style={{ fontSize: 12.5 }}>{importName || "—"}</b>
          <DepthButton size="compact" onClick={() => fileInput.current?.click()}>Or choose an import file you already have</DepthButton>
          {importText && <DepthButton size="compact" onClick={() => downloadBlob(new Blob([importText], { type: "application/x-ndjson" }), importName)}>Save a copy</DepthButton>}
        </div>
        <div style={row}>
          {!overwrite && !allowStale
            ? <Mark tone={C.SUCCESS}>Both safety switches on</Mark>
            : <Mark tone={C.DANGER}>A safety switch is OFF</Mark>}
          <Help tip="'Fill empty columns only' leaves a value already on the board alone. 'Refuse changed postings' refuses a row whose posting text changed since you exported. Both stay ON unless you turn one off below."/>
        </div>
        <details style={{ fontSize: 12, color: C.INK_MUTED }}>
          <summary style={{ cursor: "pointer" }}>Expert: turn a safety switch off</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <label><input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setDry(null); }}/> Replace values already on the board (overwrite)</label>
            <label><input type="checkbox" checked={allowStale} onChange={(e) => { setAllowStale(e.target.checked); setDry(null); }}/> Write to postings whose text changed since the export</label>
            <span style={quiet}>Either one resets when the file changes, and needs a new dry run.</span>
          </div>
        </details>
        <div style={row}>
          <DepthButton primary={!plan} disabled={!importText || busy === "dry"} onClick={runDry}>
            {busy === "dry" ? "Rehearsing…" : "Run the rehearsal (dry run)"}
          </DepthButton>
          <span style={quiet}>Nothing is written.</span>
        </div>
        {plan && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr><th style={th}>What the rehearsal found</th><th style={{ ...th, textAlign: "right" }}>Rows</th></tr></thead>
              <tbody>
                <tr><td style={td}>Matched to postings on the board</td><td style={tdn}>{num(plan.matched)}</td></tr>
                <tr><td style={td}>Would be written</td><td style={{ ...tdn, color: C.SUCCESS }}>{num(plan.wouldWrite)}</td></tr>
                <tr><td style={td}>Already filled — nothing to change</td><td style={tdn}>{num(plan.unchanged)}</td></tr>
                {refusals.map((r) => (
                  <tr key={r.kind}><td style={td}>Refused — {r.words}</td><td style={{ ...tdn, color: C.WARNING }}>{num(r.count)}</td></tr>
                ))}
              </tbody>
            </table>
            {skillsGroup && projecting && (
              <div style={callout(C.SUCCESS)}>
                <b>Skills coverage {pctOf(skillsGroup.filled, skillsGroup.total)}% → {pctOf(skillsGroup.filled + projectedGain(skillsGroup), skillsGroup.total)}% if you apply</b>
                {" "}(the bars at the top show every column).
              </div>
            )}
            {refusals.length > 0 && (
              <div style={callout(C.WARNING)}>
                <div style={row}>
                  <span>The importer takes a file whole or not at all, so <b>Apply stays locked</b> while any row is refused.</span>
                  <DepthButton size="compact" primary onClick={takeOutRefused}>Take out the {plan.rejected.length} refused rows and rehearse again</DepthButton>
                </div>
              </div>
            )}
          </>
        )}
        {redo && (
          <div style={row}>
            <span style={quiet}>{redo.trim().split("\n").length} posting(s) to fill again later — nothing is lost.</span>
            <DepthButton size="compact" onClick={() => downloadBlob(new Blob([redo], { type: "application/x-ndjson" }), `redo-${fileStamp()}.jsonl`)}>Download the redo file</DepthButton>
          </div>
        )}
      </Step>

      <Step n={5} state={stateOf(5)} title="Apply">
        <p style={{ fontSize: 12.5, color: C.INK_MUTED, margin: 0 }}>
          Writes <b>{num(plan?.wouldWrite)} postings</b>, all or nothing. You can undo it afterwards.
        </p>
        <div style={row}>
          <DepthButton primary disabled={!gate.unlocked || !!applied} onClick={() => setConfirm(true)}>Apply the import…</DepthButton>
          <span style={quiet}>{gate.why}</span>
        </div>
      </Step>

      <Step n={6} state={stateOf(6)} title="Check — or undo">
        {applied && (
          <p style={{ fontSize: 12.5, color: C.INK_MUTED, margin: 0 }}>
            <b>Applied — import #{applied.batchId}, {num(applied.written)} postings written.</b> About 30 seconds from now the
            fit scores refresh on their own. Check the numbers at the top; <b>Undo</b> is in Past imports below.
            {applied.warning && <span style={{ display: "block", color: C.DANGER, marginTop: 6 }}>{applied.warning}</span>}
          </p>
        )}
      </Step>

      {/* ── past imports, an Undo on every one ── */}
      <div style={{ ...panel, marginTop: 6 }}>
        <h2 style={{ ...h2, fontSize: 16 }}>Past imports</h2>
        <p style={{ ...what, marginBottom: 6 }}>Every import is a batch. <b>Undo</b> puts the columns back as they were before it.</p>
        {!batches.length ? <p style={quiet}>No imports yet.</p> : batches.map((b) => (
          <div key={b.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 12, alignItems: "center",
            padding: "9px 0", borderTop: `1px dashed ${C.BORDER}`, fontSize: 12 }}>
            <b style={{ font: `800 italic 13px ${LOGO_FACE}`, color: C.INK }}>#{b.id}</b>
            <span>{day(b.started_at)} — {num(b.rows_written)} postings written{b.reverted_at ? ` · undone ${day(b.reverted_at)}` : ""}</span>
            {b.reverted_at ? <Mark tone={C.INK_FAINT}>Undone</Mark>
              : <DepthButton size="compact" disabled={busy === "undo-plan"} onClick={() => askUndo(b)}>Undo</DepthButton>}
          </div>
        ))}
      </div>

      {confirm && (
        <Dialog title="Apply this import?" confirmLabel={`Apply — write ${num(plan?.wouldWrite)} postings`}
          onCancel={() => setConfirm(false)} onConfirm={doApply} busy={busy === "apply"}>
          <p>This writes <b>{num(plan?.wouldWrite)} postings</b>. All or nothing. You can undo it from Past imports.</p>
          <p style={quiet}>Dry run: clean · file: {importName}{overwrite || allowStale ? " · ⚠ a safety switch is OFF" : " · both safety switches on"}</p>
        </Dialog>
      )}
      {undoPlan && (
        <Dialog title={`Undo import #${undoPlan.batchId}?`} confirmLabel={`Undo — restore ${num(undoPlan.restorable)} postings`}
          onCancel={() => setUndoPlan(null)} onConfirm={doUndo} busy={busy === "undo"}>
          <p>This puts <b>{num(undoPlan.restorable)} postings</b> back exactly as they were before this import, and returns them to the
            "need enrichment" count.</p>
          {undoPlan.changedSince > 0 && <p style={{ color: C.WARNING }}>{num(undoPlan.changedSince)} of them were changed again after this import; that later change is lost too.</p>}
          {undoPlan.alreadyReverted && <p style={{ color: C.WARNING }}>This import was already undone once.</p>}
        </Dialog>
      )}
    </div>
  );
}

const th = { fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.INK_FAINT, textAlign: "left",
  padding: "5px 8px", borderBottom: `1px solid ${C.BORDER}` };
const td = { padding: "6px 8px", borderBottom: `1px dashed ${C.BORDER}`, color: C.INK_MUTED };
const tdn = { ...td, font: "600 12px ui-monospace, monospace", color: C.INK, textAlign: "right" };
