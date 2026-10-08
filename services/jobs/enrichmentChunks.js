// services/jobs/enrichmentChunks.js — SPLIT an enrichment export into model-sized chunks, and MERGE the filled
// chunks back into import files the importer will accept.
//
// The manual round trip (routes/enrichment.js, D17): Admin → Database → Enrichment Round Trip → export JSONL →
// fill each line's `enrichment` object OUTSIDE the product → import, dry run first. A 500-row export is ~2.5 MB of
// posting text — too much for one model conversation — so it is split into chunks of ~30, each filled separately,
// and the results merged back. The merge is where a model's mistakes are caught, BEFORE the upload: the importer
// is all-or-nothing, so one bad row anywhere refuses the whole file.
//
// ⛔ The rules are the importer's own, imported — `validateColumn` and ENRICHMENT_COLUMNS from
// enrichmentTransfer.js / enrichmentSelection.js — never a second copy that could drift from them.
//   · `content_hash` is RESTORED from the export, whatever the model returned: it is the export's own value
//     (the staleness interlock compares it with the board's CURRENT text at import), so a model that dropped
//     or mangled it must not turn a good row into a rejected one — or a stale one into an accepted one.
//   · Only `job_id`, `content_hash` and `enrichment` go into the import file; `source` is dropped.
//   · A row whose every value is null is DROPPED (it would write nothing) and reported.
//   · Rejected and missing rows are written back in EXPORT format (`redo`), so they can be split again.
// Read-only with respect to the database: this file never opens one.
import { ENRICHMENT_COLUMNS } from "./enrichmentSelection.js";
import { validateColumn, parseJsonl } from "./enrichmentTransfer.js";
import { EXPERIENCE_LEVELS, WORK_MODELS, values } from "../../shared/jobFilterOptions.js";

export const DEFAULT_CHUNK_ROWS = 30;
export const DEFAULT_IMPORT_ROWS = 500;      // routes/enrichment.js PRACTICAL_IMPORT_ROWS

/** The instructions to give the model with each chunk — the importer's rules, in words. */
export function enrichmentPrompt() {
  return [
    "You will receive JSON lines, one job posting per line. For EACH line, output exactly one JSON line:",
    '{"job_id": <copied unchanged>, "content_hash": <copied unchanged>, "enrichment": { ... }}',
    "Do NOT output the `source` block. Output JSONL only — no commentary, no code fences, no blank lines.",
    "",
    "Fill `enrichment` from the posting's OWN text (source.title + source.description) only. Use null when the text",
    "does not say. Allowed keys — no others:",
    "  skills_json: array of {\"skill\": \"<name>\", \"type\": \"hard\" | \"soft\"} — hard = a named tool, language, framework,",
    "    platform or technique the posting asks for (checkable on a résumé); soft = a way of working. 5–25 entries.",
    `  experience_level: one of ${values(EXPERIENCE_LEVELS).join(" | ")} | null`,
    `  workplace_type: one of ${values(WORK_MODELS).join(" | ")} | null`,
    "  salary_min_usd, salary_max_usd: whole numbers in US dollars (not strings), only when the posting states pay;",
    "    otherwise null. Never estimate.",
    "  salary_period: annual | hourly | monthly | null",
    "  is_h1b_sponsor, requires_work_auth, is_clearance_required: 1 or 0 ONLY when the posting explicitly says so;",
    "    otherwise null. Never infer eligibility.",
    "  summary: one plain sentence, at most 300 characters.",
    "  normalized_title: the role's plain title without level or team, at most 200 characters.",
    "  org_unit_raw: the team or organisation named in the posting, at most 120 characters, or null.",
  ].join("\n");
}

/** Split an export's JSONL into chunks of `size` posting lines (the _meta header is dropped). */
export function splitExport(exportText, { size = DEFAULT_CHUNK_ROWS } = {}) {
  if (!(Number.isInteger(size) && size > 0)) throw new Error("size must be a positive integer");
  const { rows, meta, errors } = parseJsonl(exportText);
  if (errors.length) throw new Error(`the export has ${errors.length} unparseable line(s), first at line ${errors[0].line}`);
  const lines = rows.map((r) => JSON.stringify(r.obj));
  const chunks = [];
  for (let i = 0; i < lines.length; i += size) chunks.push(lines.slice(i, i + size));
  return { meta, rows: lines.length, chunks };
}

// A model's output: strip code fences and stray prose lines; keep what parses as an object with a job_id.
function parseFilled(text) {
  const out = [], junk = [];
  String(text ?? "").split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("```")) return;
    const start = line.indexOf("{");
    if (start < 0) { junk.push({ line: i + 1, text: line.slice(0, 80) }); return; }
    try { out.push({ line: i + 1, obj: JSON.parse(line.slice(start)) }); }
    catch { junk.push({ line: i + 1, text: line.slice(0, 80) }); }
  });
  return { out, junk };
}

/**
 * Merge filled chunks against the export they came from.
 * @param exportText the ORIGINAL export JSONL
 * @param filled     [{ name, text }] — each filled chunk
 * @returns {{ files: string[], redo: string, report: object }}
 */
export function mergeFilled(exportText, filled = [], { max = DEFAULT_IMPORT_ROWS } = {}) {
  const exp = parseJsonl(exportText);
  const byId = new Map(exp.rows.map((r) => [String(r.obj.job_id), r.obj]));
  const accepted = new Map();
  const rejected = [], duplicates = [], emptyDropped = [], junk = [];
  for (const { name, text } of filled) {
    const p = parseFilled(text);
    junk.push(...p.junk.map((j) => ({ file: name, ...j })));
    for (const { line, obj } of p.out) {
      const at = { file: name, line };
      const jobId = obj?.job_id == null ? null : String(obj.job_id);
      if (!jobId) { rejected.push({ ...at, jobId: null, error: "no job_id" }); continue; }
      const orig = byId.get(jobId);
      if (!orig) { rejected.push({ ...at, jobId, error: "job_id is not in the export" }); continue; }
      if (accepted.has(jobId) || duplicates.some((d) => d.jobId === jobId)) { duplicates.push({ ...at, jobId }); continue; }
      const e = obj.enrichment;
      if (!e || typeof e !== "object" || Array.isArray(e)) { rejected.push({ ...at, jobId, error: "no enrichment object" }); continue; }
      const unknown = Object.keys(e).filter((k) => !ENRICHMENT_COLUMNS.includes(k));
      if (unknown.length) { rejected.push({ ...at, jobId, error: `unknown column(s): ${unknown.join(", ")}` }); continue; }
      const clean = {};
      let bad = null;
      for (const [k, v] of Object.entries(e)) {
        const r = validateColumn(k, v);
        if (!r.ok) { bad = `${k}: ${r.error}`; break; }
        if (r.value !== undefined) clean[k] = v;                 // the raw value: the importer re-validates it identically
      }
      if (bad) { rejected.push({ ...at, jobId, error: bad }); continue; }
      if (!Object.keys(clean).length) { emptyDropped.push({ ...at, jobId }); continue; }
      accepted.set(jobId, { job_id: orig.job_id, content_hash: orig.content_hash, enrichment: clean });   // hash RESTORED
    }
  }
  const rows = [...accepted.values()];
  const files = [];
  for (let i = 0; i < rows.length; i += max) files.push(rows.slice(i, i + max).map((r) => JSON.stringify(r)).join("\n") + "\n");
  const done = new Set(accepted.keys());
  const missing = [...byId.keys()].filter((id) => !done.has(id) && !rejected.some((r) => r.jobId === id) && !emptyDropped.some((r) => r.jobId === id));
  const redoIds = new Set([...rejected.map((r) => r.jobId).filter(Boolean), ...missing, ...emptyDropped.map((r) => r.jobId)]);
  const redo = [...byId.values()].filter((o) => redoIds.has(String(o.job_id))).map((o) => JSON.stringify(o)).join("\n");
  const perColumn = Object.fromEntries(ENRICHMENT_COLUMNS.map((c) => [c, rows.filter((r) => c in r.enrichment).length]));
  return {
    files, redo: redo ? redo + "\n" : "",
    report: { exported: byId.size, accepted: rows.length, rejected, duplicates, emptyDropped, missing, junk, perColumn, importFiles: files.length },
  };
}
