// services/jobs/jobTagTransfer.js — D29: EXPORT THE POSTINGS THE TAGGER COULD NOT TAG, THE OWNER TAGS
// THEM, IMPORT THE TAGS BACK. The same manual-sweep shape as D20's slug harvest and U2/U3's enrichment
// transfer, and the D17 rule: no model call — a person reads the posting and picks from the vocabulary.
//
// ⛔ THE RULES AT THE TRUST BOUNDARY (enrichmentTransfer.js's, kept):
//   · every exported row carries `basis` — the tag basis it was exported at. A posting whose basis has
//     moved (its title, location or text changed) is REFUSED: a tag picked for the old text must not
//     land on the new one.
//   · every value is checked against the closed vocabulary (jobTags.js OWNER_FIELDS); a value outside it
//     is refused, not coerced.
//   · ALL-OR-NOTHING: one refused row refuses the file, naming every bad line. The board is always
//     "before this file" or "after this file".
//   · an EMPTY cell is no opinion — it never clears a tag.
//   · owner tags are stored in tag_owner_json and survive every re-tag (jobTags.js mergeOwner).
import { OWNER_FIELDS, formatPlaceList, tagBasis, deriveTags, mergeOwner, writeTags } from "./jobTags.js";

export const EXPORT_COLUMNS = ["job_id", "basis", "title", "company", "location",
  "level", "job_function", "employment", "workplace", "places"];
const TAG_COLUMNS = ["level", "job_function", "employment", "workplace", "places"];
const MISSING_SQL = {
  level: "sj.tag_level IS NULL",
  job_function: "sj.tag_function IS NULL",
  employment: "sj.tag_employment IS NULL",
  workplace: "sj.tag_workplace IS NULL",
  places: "NOT EXISTS (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND p.state IS NOT NULL)",
};

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** RFC 4180, enough of it: quoted cells, doubled quotes, CRLF or LF. */
export function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  const src = String(text || "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

const ROW_SQL = `
  SELECT sj.job_id, sj.title, sj.company, sj.location, sj.workplace_type, sj.employment_type, sj.experience_level,
         sj.enriched_at, LENGTH(COALESCE(sj.description_text, sj.description)) AS description_length, sj.tag_owner_json,
         sj.description_basis, sj.description_fields,
         sj.tag_level, sj.tag_function, sj.tag_employment, sj.tag_workplace,
         (SELECT m.role_key FROM job_role_map m WHERE m.job_id = sj.job_id AND m.source_profile_id IS NULL
           ORDER BY m.rowid LIMIT 1) AS role_key
    FROM scraped_jobs sj`;

/**
 * The CSV of active postings missing `tag` (or any tag, when `tag` is "any"), newest first.
 * @returns {{ csv: string, rows: number }}
 */
export function buildTagExport(db, { tag = "any", limit = 500 } = {}) {
  const missing = tag === "any" ? `(${Object.values(MISSING_SQL).join(" OR ")})` : MISSING_SQL[tag];
  if (!missing) throw new Error(`unknown tag "${tag}" — one of any, ${Object.keys(MISSING_SQL).join(", ")}`);
  const rows = db.prepare(`${ROW_SQL} WHERE sj.is_active = 1 AND ${missing}
    ORDER BY COALESCE(sj.discovered_at, sj.scraped_at) DESC LIMIT ?`).all(Math.max(1, Math.min(5000, limit)));
  const placesOf = db.prepare("SELECT country, state, metro FROM job_tag_places WHERE job_id = ?");
  const lines = [EXPORT_COLUMNS.join(",")];
  for (const r of rows) {
    lines.push([r.job_id, tagBasis(r), r.title, r.company, r.location,
      r.tag_level, r.tag_function, r.tag_employment, r.tag_workplace,
      formatPlaceList(placesOf.all(r.job_id))].map(csvCell).join(","));
  }
  return { csv: lines.join("\r\n") + "\r\n", rows: rows.length };
}

/**
 * Plan an import. Nothing is written. A row's cells that equal what the posting already carries are
 * not changes; only a cell that differs becomes an owner tag.
 * @returns {{ ok: boolean, rows: number, changes: {job_id:string, set:object}[], rejected: {line:number, job_id?:string, reason:string}[] }}
 */
export function planTagImport(db, csvText) {
  const table = parseCsv(csvText);
  const rejected = [], changes = [];
  if (!table.length) return { ok: false, rows: 0, changes, rejected: [{ line: 1, reason: "the file is empty" }] };
  const header = table[0].map(h => h.trim());
  for (const col of ["job_id", "basis"]) {
    if (!header.includes(col)) rejected.push({ line: 1, reason: `the header has no "${col}" column` });
  }
  if (rejected.length) return { ok: false, rows: 0, changes, rejected };
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const get = db.prepare(`${ROW_SQL} WHERE sj.job_id = ?`);
  const placesOf = db.prepare("SELECT country, state, metro FROM job_tag_places WHERE job_id = ?");
  const seen = new Set();
  table.slice(1).forEach((cells, k) => {
    const line = k + 2;
    const jobId = (cells[idx.job_id] || "").trim();
    if (!jobId) { rejected.push({ line, reason: "no job_id" }); return; }
    if (seen.has(jobId)) { rejected.push({ line, job_id: jobId, reason: "this job_id appears twice in the file" }); return; }
    seen.add(jobId);
    const row = get.get(jobId);
    if (!row) { rejected.push({ line, job_id: jobId, reason: "no such posting" }); return; }
    if ((cells[idx.basis] || "").trim() !== tagBasis(row)) {
      rejected.push({ line, job_id: jobId, reason: "the posting changed since it was exported (basis moved) — export it again" });
      return;
    }
    const current = { level: row.tag_level, job_function: row.tag_function, employment: row.tag_employment,
      workplace: row.tag_workplace, places: formatPlaceList(placesOf.all(jobId)) };
    const set = {};
    for (const col of TAG_COLUMNS) {
      if (idx[col] === undefined) continue;
      const v = (cells[idx[col]] || "").trim();
      if (!v) continue;                               // empty = no opinion
      if (!OWNER_FIELDS[col](v)) { rejected.push({ line, job_id: jobId, reason: `"${v}" is not a ${col} value` }); return; }
      if (v !== (current[col] ?? "")) set[col] = v;
    }
    if (Object.keys(set).length) changes.push({ job_id: jobId, set });
  });
  return { ok: rejected.length === 0, rows: table.length - 1, changes, rejected };
}

/** Apply a plan that came back ok — all of it, in one transaction, or nothing. */
export function applyTagImport(db, plan, { by = "owner" } = {}) {
  if (!plan.ok) throw new Error("refused: the plan has rejected rows — fix the file and plan again");
  const get = db.prepare(`${ROW_SQL} WHERE sj.job_id = ?`);
  const desc = db.prepare("SELECT COALESCE(description_text, description) AS description FROM scraped_jobs WHERE job_id = ?");
  const setOwner = db.prepare("UPDATE scraped_jobs SET tag_owner_json = ? WHERE job_id = ?");
  db.transaction(() => {
    for (const c of plan.changes) {
      const row = get.get(c.job_id);
      let owner = {};
      try { owner = row.tag_owner_json ? JSON.parse(row.tag_owner_json) : {}; } catch { owner = {}; }
      owner = { ...owner, ...c.set, by, at: Math.floor(Date.now() / 1000) };
      setOwner.run(JSON.stringify(owner), c.job_id);
      const tags = mergeOwner(deriveTags({ ...row, description: desc.get(c.job_id)?.description || "" }), owner);
      writeTags(db, c.job_id, tags, tagBasis(row));
    }
  })();
  return { written: plan.changes.length };
}
