// services/jobs/descriptionText.js — ⛔ D59 part 5 · THE NORMALISED TEXT GOES IN A NEW COLUMN.
//
// A76's blind-file grades (ats_corpus_grades) and the enrichment imports are keyed on `content_hash` —
// sha1(title|description) (enrichmentSelection.computeContentHash). Rewriting a stored description would
// change every affected hash and mark every graded row stale, while the owner's grading (O69) is still
// pending against the CURRENT text. So `description` and `content_hash` are NEVER written here:
//
//   description_text      shared/postingNormalize.js's text — markup-free, the known label lines removed.
//                         NULL when it would equal `description` (the text IS the description), so a
//                         plain-text posting costs no second copy. Readers take
//                         COALESCE(description_text, description).
//   description_fields    the label block's fields, JSON (date posted, country, location, workstyle,
//                         travel, relocation, requisition id, employment type, pay) — NULL when none.
//   req_citizenship       citizen_only | us_person | none_stated            (shared/postingRequirements.js)
//   req_clearance         none | unspecified | public_trust | secret | top_secret | ts_sci
//   req_clearance_status  active_required | interim_ok | ability_to_obtain | NULL
//   req_polygraph         1 | 0
//   description_basis     "v<NORMALIZER_VERSION>:<sha1 prefix of description>" — NULL = never read.
//
// NULL req_* means NOT READ YET (unknown), never "none" — the board's filter keeps such a row.
// ⛔ FRESHNESS: description_basis is a hash of the description these were read from. A re-crawl that
// changes `description` leaves the basis behind, so freshText() stops serving the old text at once and
// the next pass (DESCRIPTION_STALE_SQL compares the basis with the description as it is now) re-reads it.
//
// ⛔ D17: deterministic — no model call. ⛔ It never answers the CANDIDATE's eligibility.
import crypto from "node:crypto";
import { normalizePosting, NORMALIZER_VERSION } from "../../shared/postingNormalize.js";
import { postingRequirements } from "../../shared/postingRequirements.js";
import { parseSalaryText } from "./salaryText.js";

export const BASIS_PREFIX = `v${NORMALIZER_VERSION}:`;
// The SQL function the stale query uses — the same descriptionBasis, so SQL and JS cannot disagree.
export const BASIS_FN = "d59_description_basis";
export const DESCRIPTION_STALE_SQL = `(description_basis IS NULL OR description_basis != ${BASIS_FN}(description))`;
const fnRegistered = new WeakSet();
export function registerDescriptionBasis(db) {
  if (fnRegistered.has(db)) return;
  db.function(BASIS_FN, { deterministic: true }, (d) => descriptionBasis(d));
  fnRegistered.add(db);
}
// ⛔ THE BRAKE (D53's sweep): a backfill refuses to write more rows than this in one call.
export const DESCRIPTION_BACKFILL_CEILING = 5000;

export function descriptionBasis(description) {
  return BASIS_PREFIX + crypto.createHash("sha1").update(String(description ?? "")).digest("hex").slice(0, 16);
}

/** Every derived column for one stored description. Pure. */
export function deriveDescriptionColumns(description) {
  const n = normalizePosting(description);
  const fields = { ...n.fields };
  if (fields.payRange) {
    const pay = parseSalaryText(fields.payRange);
    if (pay) fields.pay = pay;
  }
  const req = postingRequirements(n);
  const hasText = description != null && String(description).trim() !== "";
  return {
    description_text: n.changed && hasText ? n.text : null,
    description_fields: Object.keys(fields).length ? JSON.stringify(fields) : null,
    req_citizenship: hasText ? req.citizenship : null,
    req_clearance: hasText ? req.clearance : null,
    req_clearance_status: hasText ? req.clearanceStatus : null,
    req_polygraph: hasText ? (req.polygraph ? 1 : 0) : null,
    description_basis: descriptionBasis(description),
  };
}

const WRITE_SQL = `UPDATE scraped_jobs SET description_text = @description_text, description_fields = @description_fields,
    req_citizenship = @req_citizenship, req_clearance = @req_clearance, req_clearance_status = @req_clearance_status,
    req_polygraph = @req_polygraph, description_basis = @description_basis WHERE job_id = @job_id`;

/** Read one posting's description and write its derived columns. Returns the columns, or null. */
export function refreshDescriptionText(db, jobId) {
  const row = db.prepare("SELECT job_id, description FROM scraped_jobs WHERE job_id = ?").get(jobId);
  if (!row) return null;
  const cols = deriveDescriptionColumns(row.description);
  db.prepare(WRITE_SQL).run({ ...cols, job_id: row.job_id });
  return cols;
}

/**
 * THE BACKFILL — every row whose description was never read (or was read by an older normaliser).
 * ⛔ Dry run by default, like D53's sweep: it reports what it WOULD write. With dryRun:false it writes,
 * unless the batch exceeds `ceiling`, in which case it REFUSES and writes none. `limit` takes the batch
 * in slices (the boot pass takes 2,000 a pass). It never touches `description` or `content_hash`.
 * @returns {{ dryRun, due, batch, written, refused, changedText, withFields, requirements: object }}
 */
export function backfillDescriptionText(db, { dryRun = true, ceiling = DESCRIPTION_BACKFILL_CEILING, limit = null, log = null } = {}) {
  registerDescriptionBasis(db);
  const due = db.prepare(`SELECT COUNT(*) AS n FROM scraped_jobs WHERE ${DESCRIPTION_STALE_SQL}`).get().n;
  const rows = db.prepare(`SELECT job_id, description FROM scraped_jobs WHERE ${DESCRIPTION_STALE_SQL} ORDER BY rowid${limit ? " LIMIT ?" : ""}`)
    .all(...(limit ? [limit] : []));
  const derived = rows.map(r => ({ job_id: r.job_id, ...deriveDescriptionColumns(r.description) }));
  const requirements = { citizen_only: 0, us_person: 0, clearance: 0, polygraph: 0 };
  for (const d of derived) {
    if (d.req_citizenship === "citizen_only") requirements.citizen_only++;
    if (d.req_citizenship === "us_person") requirements.us_person++;
    if (d.req_clearance && d.req_clearance !== "none") requirements.clearance++;
    if (d.req_polygraph) requirements.polygraph++;
  }
  const summary = {
    dryRun, due, batch: rows.length, written: 0, refused: false,
    changedText: derived.filter(d => d.description_text != null).length,
    withFields: derived.filter(d => d.description_fields != null).length,
    requirements,
  };
  if (dryRun) return summary;
  if (rows.length > ceiling) {
    log?.({ kind: "description_text_backfill", refused: true, batch: rows.length, ceiling });
    return { ...summary, refused: true };
  }
  const write = db.prepare(WRITE_SQL);
  db.transaction(() => { for (const d of derived) write.run(d); })();
  log?.({ kind: "description_text_backfill", written: derived.length, changedText: summary.changedText });
  return { ...summary, written: derived.length };
}

/**
 * Were this row's derived columns read from the description it holds NOW? A row whose description was
 * rewritten since (a re-crawl, a fetch on open) is not — its text, fields and requirements are not served.
 */
export function isFresh(row) {
  return !!row && row.description_basis != null && row.description_basis === descriptionBasis(row.description);
}
/** The normalised text, only while it is fresh — else null (the reader falls back to `description`). */
export function freshText(row) {
  return row && row.description_text != null && isFresh(row) ? row.description_text : null;
}

/** The readers' rule: the normalised text when there is a fresh one, else the stored description. */
export function postingText(row) {
  if (!row) return null;
  return freshText(row) ?? row.description ?? null;
}

/** A job object as the SCORER should read it — its description is the (fresh) normalised text. */
export function withPostingText(job) {
  const t = freshText(job);
  return t == null ? job : { ...job, description: t };
}

export function parseDescriptionFields(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { const v = JSON.parse(raw); return v && typeof v === "object" ? v : null; } catch { return null; }
}
