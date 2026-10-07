// scripts/d71Backfill.mjs — ⛔ D71: the pay-in-the-prose re-read, dry then live, on a COPY.
//
//   node scripts/d71Backfill.mjs <source db> <copy path>
//
// The same shape as d59Backfill.mjs (D71 rides D59's pass: NORMALIZER_VERSION 1 → 2 re-reads every row).
// Takes a .backup() of <source db> (opened read-only, never written), applies the migrations the copy
// lacks (141 adds pay_text_min_usd / pay_text_max_usd), runs backfillDescriptionText dry and live, and
// prints counts only — no posting text:
//   · active rows whose salary is empty, BEFORE (as the board showed them) and AFTER (with the text's pay)
//   · where the pay came from (label · description), its unit, rows with several per-location ranges
//   · rows whose location was the "Location not specified" placeholder and now carry a pay-line place
//   · a sample of before → after PAIRS as job_id + "not stated" → "$143.7k–$194.4k" (the labels, not text)
//   · ⛔ the proof that `description`, `content_hash` and every salary_* column are byte-identical.
// REVERT: the new columns are derived — discard the copy, or on a live database set NORMALIZER_VERSION
// back and the next pass re-derives the old fields (pay_text_* are then NULLed by the same write).
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import { MIGRATIONS } from "./migrations.js";
import { backfillDescriptionText, DESCRIPTION_BACKFILL_CEILING } from "../services/jobs/descriptionText.js";
import { mapJobRow } from "../services/jobs/mapJobRow.js";
import { salaryLabel } from "../shared/postingFacts.js";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error("usage: node scripts/d71Backfill.mjs <source db> <copy path>"); process.exit(2); }
if (fs.existsSync(dst)) { console.error(`refusing: ${dst} exists`); process.exit(2); }

const from = new Database(src, { readonly: true, fileMustExist: true });
await from.backup(dst);
from.close();

const db = new Database(dst);
const applied = new Set(db.prepare("SELECT id FROM schema_migrations").all().map(r => r.id));
const ran = [];
for (const m of MIGRATIONS) {
  if (applied.has(m.id)) continue;
  db.exec(m.sql);
  db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(m.id);
  ran.push(m.id);
}

const digest = () => {
  const h = crypto.createHash("sha256");
  for (const r of db.prepare(`SELECT job_id, description, content_hash, salary_min, salary_max, salary_currency,
                                     salary_min_usd, salary_max_usd, salary_period FROM scraped_jobs ORDER BY job_id`).iterate()) {
    h.update(JSON.stringify(r));
  }
  return h.digest("hex");
};
const ACTIVE = "SELECT * FROM scraped_jobs WHERE is_active = 1 AND description IS NOT NULL";
const view = () => new Map(db.prepare(ACTIVE).all().map(r => [r.job_id, mapJobRow(r)]));

const before = digest();
const shown = view();
const dry = backfillDescriptionText(db);
const passes = [];
for (;;) {
  const r = backfillDescriptionText(db, { dryRun: false, limit: DESCRIPTION_BACKFILL_CEILING, ceiling: DESCRIPTION_BACKFILL_CEILING });
  passes.push({ batch: r.batch, written: r.written, refused: r.refused });
  if (r.refused || r.batch === 0 || r.due <= r.batch) break;
}
const after = digest();
const again = backfillDescriptionText(db);
const now = view();

const tally = { salaryEmptyBefore: 0, salaryEmptyAfter: 0, gained: 0, bySource: {}, byUnit: {}, multiLocation: 0,
                placeholderLocationBefore: 0, placeLearned: 0 };
const pairs = [];
for (const [id, was] of shown) {
  const is = now.get(id);
  const wasEmpty = was.salaryMin == null && was.salaryMax == null;
  const isEmpty = is.salaryMin == null && is.salaryMax == null;
  if (wasEmpty) tally.salaryEmptyBefore++;
  if (isEmpty) tally.salaryEmptyAfter++;
  if (wasEmpty && !isEmpty) {
    tally.gained++;
    tally.bySource[is.salarySource] = (tally.bySource[is.salarySource] || 0) + 1;
    tally.byUnit[is.salaryPeriod] = (tally.byUnit[is.salaryPeriod] || 0) + 1;
    if (is.payLocations) tally.multiLocation++;
    if (pairs.length < 15) pairs.push(`${id}: not stated → ${salaryLabel(is)}`);
  }
  if (was.location === "Location not specified") {
    tally.placeholderLocationBefore++;
    if (is.location !== "Location not specified") { tally.placeLearned++; pairs.push(`${id}: location → ${is.location}`); }
  }
}

console.log(JSON.stringify({
  migrationsRun: ran,
  dry: { due: dry.due }, live: passes, dueAfter: again.due,
  active: shown.size, ...tally,
  sortAndFilterColumns: db.prepare("SELECT COUNT(*) n FROM scraped_jobs WHERE is_active = 1 AND pay_text_max_usd IS NOT NULL").get().n,
  pairs,
  descriptionContentHashAndSalaryUnchanged: before === after,
}, null, 2));
db.close();
