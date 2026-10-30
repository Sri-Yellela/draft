// services/jobs/levelRead.js — ⭐ D106 P1 · the level a posting ASKS for, stored so the board can filter on it.
//
// shared/postingLevel.js readLevel over the posting's normalised text → scraped_jobs.level_read (entry | early | mid |
// senior | NULL) and level_reasons (JSON, the asks in words). Run with the tag pass (boot and every 10 minutes) over
// rows whose title or text length changed since they were read — level_read_basis — so a second pass over an
// unchanged board touches nothing. The title's disagreement is not stored: it is the title and this read, said at
// read time (levelOfRow).
import crypto from "node:crypto";
import { readLevel, levelDisagreement } from "../../shared/postingLevel.js";

export const LEVEL_READER_VERSION = 1;

const basisOf = (r) => crypto.createHash("sha1")
  .update(JSON.stringify([LEVEL_READER_VERSION, r.title, r.text_length ?? 0])).digest("hex").slice(0, 16);

/** @returns {{ scanned: number, read: number }} */
export function readStaleLevels(db, { limit = 5000 } = {}) {
  const rows = db.prepare(`SELECT job_id, title, level_read_basis, LENGTH(COALESCE(description_text, description)) AS text_length
    FROM scraped_jobs WHERE is_active = 1 OR level_read_basis IS NULL`).all();
  const text = db.prepare(`SELECT COALESCE(description_text, description) FROM scraped_jobs WHERE job_id = ?`).pluck();
  const write = db.prepare(`UPDATE scraped_jobs SET level_read = ?, level_reasons = ?, level_read_basis = ? WHERE job_id = ?`);
  let read = 0;
  db.transaction(() => {
    for (const r of rows) {
      if (read >= limit) break;
      const basis = basisOf(r);
      if (r.level_read_basis === basis) continue;
      const l = readLevel(text.get(r.job_id) || "");
      write.run(l.level, JSON.stringify({ reasons: l.reasons, years: l.years }), basis, r.job_id);
      read++;
    }
  })();
  return { scanned: rows.length, read };
}

/** A board row → { read, reasons, years, disagreement } or null when nothing was read. */
export function levelOfRow(row) {
  if (!row || row.level_read == null) return null;
  let extra = {};
  try { extra = JSON.parse(row.level_reasons || "{}") || {}; } catch { extra = {}; }
  const read = { level: row.level_read, reasons: Array.isArray(extra.reasons) ? extra.reasons : [], years: extra.years ?? null };
  return { read: read.level, reasons: read.reasons, years: read.years, disagreement: levelDisagreement(row.title, read) };
}
