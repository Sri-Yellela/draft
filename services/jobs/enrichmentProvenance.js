// services/jobs/enrichmentProvenance.js — ⛔ D84 F2 · CRAWLER PLACEHOLDERS ARE NOT ENRICHMENT.
//
// The owner's rehearsal (10-09): `summary` was pre-filled on 20 of 20 rows as the first 300 characters verbatim
// ("ABOUT US…"), `normalized_title` as the lowercased title, `experience_level` by a title heuristic (8 of 20 wrong),
// `workplace_type` on 12 of 20 where the text is silent. "Fill empty only" then refused every model answer for those
// columns, because they were not empty. So every enrichment column has a PROVENANCE (scraped_jobs.enrichment_provenance,
// migration 151, a JSON map):
//
//   crawler_fallback   a guess the crawl made — counts as EMPTY for "fill empty only" and may be replaced
//   source             the ATS stated it                     ┐
//   board_location     the board's own location states it   ├ stated — never replaced without OVERWRITE
//   import             an enrichment import wrote it          │
//   owner              the owner set it                       ┘
//
// The crawl writes the map on insert (schema.js normalizeJob); every import marks what it wrote. A row from before
// migration 151 has no map — its provenance is DETECTED (below), at boot by backfillProvenance and at plan time by
// isPlaceholder, so a missing map can never make an imported value look like a placeholder: an import batch's own
// record wins over every detection rule.
import { levelFromTitle } from "../../shared/levelMapping.js";
import { normalizeWorkplaceType, inferClearanceRequired } from "./schema.js";
import { nextRowidRange } from "./rowidWalk.js";

export const PLACEHOLDER = "crawler_fallback";
export const STATED = ["source", "board_location", "import", "owner"];

// The title ladder the crawl used BEFORE D84 (Staff / Principal → senior, VP → lead) — kept only to RECOGNISE the
// guesses it stored; nothing writes with it.
function legacyLevelFromTitle(title) {
  if (!title) return null;
  const t = title.toLowerCase();
  if (/\b(intern(?:ship)?|co.?op)\b/.test(t)) return "intern";
  if (/\b(c-suite|chief\s+executive|ceo\b|cto\b|cfo\b|coo\b|cpo\b)\b/.test(t)) return "executive";
  if (/\b(director|vice\s+president|\bvp\b|head\s+of)\b/.test(t)) return "lead";
  if (/\b(manager|lead\b)\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?|principal|staff)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry.?level|new.?grad|graduate\b|associate\b)\b/.test(t)) return "entry";
  return "mid";
}

export function parseProvenance(json) {
  try { const m = JSON.parse(json || "null"); return m && typeof m === "object" && !Array.isArray(m) ? m : null; } catch { return null; }
}

/**
 * Where a stored value came from, by detection — for a row with no map. `imported` is the set of columns a live
 * import batch wrote on this row (its own record beats every rule).
 */
export function detectProvenance(row, column, imported = new Set()) {
  const v = row[column];
  if (v == null) return null;
  if (imported.has(column)) return "import";
  const title = String(row.title ?? "").trim();
  switch (column) {
    case "summary": return String(v) === String(row.description ?? "").trim().slice(0, 300) ? PLACEHOLDER : "source";
    case "normalized_title": return String(v) === title.toLowerCase() ? PLACEHOLDER : "source";
    case "experience_level":
      return v === legacyLevelFromTitle(title) || v === (levelFromTitle(title) ?? "mid") ? PLACEHOLDER : "source";
    case "workplace_type":
      if (normalizeWorkplaceType(null, null, "", row.location) === v) return "board_location";
      return normalizeWorkplaceType(null, null, title, "") === v ? PLACEHOLDER : "source";
    case "is_clearance_required": return inferClearanceRequired(title) === v ? PLACEHOLDER : "source";
    default: return "source";
  }
}

/** True when the stored value of `column` is a crawler guess — the importer then treats it as empty. */
export function isPlaceholder(row, column, imported) {
  if (row[column] == null) return false;
  const map = parseProvenance(row.enrichment_provenance);
  if (map && column in map) return map[column] === PLACEHOLDER;
  return detectProvenance(row, column, imported) === PLACEHOLDER;
}

/** The columns live enrichment imports wrote on one row (from the batches' own records). */
export function importedColumns(db, jobId) {
  const out = new Set();
  try {
    const rows = db.prepare(`SELECT r.filled_json FROM enrichment_batch_rows r JOIN enrichment_batches b ON b.id = r.batch_id
      WHERE r.job_id = ? AND b.source = 'import' AND b.reverted_at IS NULL`).all(jobId);
    for (const r of rows) {
      const p = parseProvenance(r.filled_json) ?? {};
      for (const c of [...(p.filled ?? []), ...(p.corrected ?? [])]) out.add(c);
    }
  } catch { /* no batch tables on this schema: nothing was imported */ }
  return out;
}

/** The map after an import wrote `columns` — each becomes `import`. */
export function markImported(json, columns) {
  const map = parseProvenance(json) ?? {};
  for (const c of columns) map[c] = "import";
  return JSON.stringify(map);
}

/**
 * ⛔ The boot backfill: every row with NO map gets one by detection. NULL-only, so after the first boot it is a
 * no-op; bounded by `ceiling` rows a call. A crawler-guessed `experience_level` is re-derived with the shared
 * mapping (D84 F2: Staff / Principal were stored as `senior`) — the crawl's OWN guess, never an import's value.
 */
const ENRICHED = ["summary", "normalized_title", "experience_level", "workplace_type", "skills_json", "salary_min_usd",
  "salary_max_usd", "salary_period", "is_h1b_sponsor", "requires_work_auth", "is_clearance_required", "org_unit_raw"];
const SELECT_UNMAPPED = `SELECT job_id, title, location, description, ${ENRICHED.join(", ")} FROM scraped_jobs
    WHERE enrichment_provenance IS NULL`;

export function backfillProvenance(db, { ceiling = 5000 } = {}) {
  return fillProvenance(db, db.prepare(`${SELECT_UNMAPPED} LIMIT ?`).all(ceiling));
}

// ⛔ A123 (8) (11-05) · THE BOOT'S PASS IS A ROWID WALK WITH A HIGH-WATER MARK, NOT A SCAN OF THE BOARD.
// `WHERE enrichment_provenance IS NULL` has no index, and the column sits after `description`, so on a settled board
// (nothing NULL) backfillProvenance above read every row's overflow chain to find nothing: 18.7 s of the 66297c3 boot
// (production, 11-05 00:16Z, no "backfilled" line), 4.5 s on the laptop's 84k copy. The walk reads `rows` consecutive
// rowids a slice and records the last one in app_settings; once it has passed the end, a later boot starts from that
// mark, so it reads only the rows inserted since (the crawl writes a map on insert anyway). A row below the mark that
// somehow has no map is not lost: the importer detects its provenance per row at plan time (isPlaceholder).
export const PROVENANCE_WALK_KEY = "a123_provenance_walk_v1";
export function backfillProvenanceSlice(db, { rows = 500 } = {}) {
  const get = db.prepare("SELECT value FROM app_settings WHERE key = ?");
  const from = Number(get.get(PROVENANCE_WALK_KEY)?.value) || 0;
  const range = nextRowidRange(db, from, rows);
  let res = { scanned: 0, written: 0, remappedLevels: 0, placeholders: 0 };
  db.transaction(() => {
    if (range.to > from) {
      res = fillProvenance(db, db.prepare(`${SELECT_UNMAPPED} AND rowid > ? AND rowid <= ?`).all(from, range.to));
    }
    db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(PROVENANCE_WALK_KEY, String(Math.max(from, range.to)));
  })();
  return { ...res, from, to: Math.max(from, range.to), done: !range.more };
}

function fillProvenance(db, rows) {
  const write = db.prepare("UPDATE scraped_jobs SET enrichment_provenance = ?, experience_level = ? WHERE job_id = ?");
  let written = 0, remappedLevels = 0, placeholders = 0;
  db.transaction(() => {
    for (const r of rows) {
      const imported = importedColumns(db, r.job_id);
      const map = {};
      for (const c of ENRICHED) {
        const p = detectProvenance(r, c, imported);
        if (p) map[c] = p;
        if (p === PLACEHOLDER) placeholders++;
      }
      let level = r.experience_level;
      if (map.experience_level === PLACEHOLDER) {
        const next = levelFromTitle(r.title) ?? "mid";
        if (next !== level) { level = next; remappedLevels++; }
      }
      write.run(JSON.stringify(map), level, r.job_id);
      written++;
    }
  })();
  return { scanned: rows.length, written, remappedLevels, placeholders };
}
