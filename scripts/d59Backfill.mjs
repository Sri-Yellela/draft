// scripts/d59Backfill.mjs — ⛔ D59 step 1: the description_text backfill, dry then live, on a COPY.
//
//   node scripts/d59Backfill.mjs <source db> <copy path>
//
// Takes a .backup() of <source db> to <copy path> (the source is opened read-only and never written),
// applies any migration the copy has not recorded, then runs backfillDescriptionText dry and live and
// prints the counts the D59 row asks for: how many stored descriptions carry `<p`, `&lt;` or `\"`, how
// many rows the normaliser changed, how many carried a label block, the requirements found — and the
// ⛔ proof that `description` and `content_hash` are byte-identical before and after.
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import { MIGRATIONS } from "./migrations.js";
import { backfillDescriptionText, DESCRIPTION_BACKFILL_CEILING } from "../services/jobs/descriptionText.js";

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error("usage: node scripts/d59Backfill.mjs <source db> <copy path>"); process.exit(2); }
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
  for (const r of db.prepare("SELECT job_id, description, content_hash FROM scraped_jobs ORDER BY job_id").iterate()) {
    h.update(`${r.job_id}\u0000${r.description ?? "\u0001"}\u0000${r.content_hash ?? "\u0001"}\u0000`);
  }
  return h.digest("hex");
};
const count = (where) => db.prepare(`SELECT COUNT(*) AS n FROM scraped_jobs WHERE ${where}`).get().n;
const shapes = {
  total: count("1"),
  active: count("COALESCE(is_active,1) = 1"),
  withDescription: count("description IS NOT NULL AND TRIM(description) != ''"),
  "contains <p": count("description LIKE '%<p%'"),
  "contains &lt;": count("description LIKE '%&lt;%'"),
  'contains \\"': count("description LIKE '%\\\"%'"),
};

const before = digest();
const dry = backfillDescriptionText(db);
const passes = [];
for (;;) {
  const r = backfillDescriptionText(db, { dryRun: false, limit: DESCRIPTION_BACKFILL_CEILING, ceiling: DESCRIPTION_BACKFILL_CEILING });
  if (r.refused) { passes.push(r); break; }
  passes.push(r);
  if (r.batch === 0 || r.due <= r.batch) break;
}
const after = digest();
const again = backfillDescriptionText(db);

const fields = {};
for (const r of db.prepare("SELECT description_fields FROM scraped_jobs WHERE description_fields IS NOT NULL").iterate()) {
  for (const k of Object.keys(JSON.parse(r.description_fields))) fields[k] = (fields[k] ?? 0) + 1;
}
const req = db.prepare(`SELECT req_citizenship AS c, req_clearance AS k, req_clearance_status AS s, req_polygraph AS p, COUNT(*) AS n
  FROM scraped_jobs WHERE req_citizenship IS NOT NULL AND (req_citizenship != 'none_stated' OR req_clearance != 'none')
  GROUP BY 1,2,3,4 ORDER BY n DESC`).all();

console.log(JSON.stringify({
  migrationsRun: ran, shapes,
  dry: { due: dry.due, changedText: dry.changedText, withFields: dry.withFields, requirements: dry.requirements },
  live: passes.map(p => ({ batch: p.batch, written: p.written, refused: p.refused, changedText: p.changedText })),
  dueAfter: again.due,
  stored: {
    descriptionText: count("description_text IS NOT NULL"),
    descriptionFields: count("description_fields IS NOT NULL"),
    fieldsByLabel: fields,
    requirements: req,
  },
  descriptionAndContentHashUnchanged: before === after,
}, null, 2));
db.close();
