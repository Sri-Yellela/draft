#!/usr/bin/env node
/**
 * Queue 37 — retire the stored rows the US-only gate would not admit. DRY RUN BY DEFAULT.
 *
 * The ingestion gate (services/jobs/aggregator.js holdOutOfMarket) retires a non-US row the next
 * time its source is crawled successfully. This does the same for the rows already stored, NOW,
 * and for any source that is not being crawled (a failed sync, a retired provider, the legacy
 * LinkedIn and live-search write-backs) — rows a crawl would never revisit.
 *
 * What it does with --apply, in one transaction:
 *   UPDATE scraped_jobs SET is_active = 0      (reversible — never a DELETE)
 *   INSERT OR REPLACE INTO rejected_jobs … reason 'out_of_market:<reason>'
 * The rejected_jobs record is what keeps hiringSignals from reading the retirement as roles
 * closing, and what lets a later crawl clear it if the posting turns out to name a US location
 * (Greenhouse's structured offices are read at ingestion and are not stored, so a row whose
 * location field is "N/A" can be held out here and re-admitted by its next crawl — by design).
 *
 * ⛔ Brake: refuses when the retirement would exceed --max-share of the active board (default
 * 0.5, the same default as services/jobs/cleanupBrake.js). The local measurement was 28.7%.
 * ⛔ Never run against production without the owner's go. It prints the database it opened.
 *
 * Usage: node scripts/q37RetireOutOfMarket.mjs [--db <path>] [--apply] [--max-share 0.5]
 */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { usEligibility } from "../services/jobs/usLocation.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const val = (f, d = null) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const APPLY = args.includes("--apply");
const MAX_SHARE = Number(val("--max-share", "0.5"));
const dbPath = val("--db") || path.join(ROOT, "data", "resume_master.db");

/** Pure: which active rows to retire, and why. Exported for the test. */
export function planRetirement(rows) {
  const retire = [];
  const byReason = {}, bySource = {};
  for (const r of rows) {
    const e = usEligibility({ location: r.location, description: r.description });
    if (e.admit) continue;
    retire.push({ job_id: r.job_id, title: r.title, company: r.company, source: r.source, reason: e.reason, location: r.location });
    byReason[e.reason] = (byReason[e.reason] || 0) + 1;
    bySource[r.source] = (bySource[r.source] || 0) + 1;
  }
  return { active: rows.length, retire, byReason, bySource, share: rows.length ? retire.length / rows.length : 0 };
}

export function run({ db, apply = false, maxShare = 0.5, now = Math.floor(Date.now() / 1000), log = console.log }) {
  const rows = db.prepare("SELECT job_id, title, company, source, location, description FROM scraped_jobs WHERE is_active = 1").all();
  const plan = planRetirement(rows);
  log(`active ${plan.active} · would retire ${plan.retire.length} (${(100 * plan.share).toFixed(1)}%)`);
  log("  by reason " + JSON.stringify(plan.byReason));
  log("  by source " + JSON.stringify(plan.bySource));
  if (plan.share > maxShare) {
    log(`⛔ REFUSED — ${(100 * plan.share).toFixed(1)}% exceeds --max-share ${maxShare}. Nothing written.`);
    return { ...plan, applied: false, refused: true };
  }
  if (!apply) { log("dry run — nothing written. Re-run with --apply."); return { ...plan, applied: false, refused: false }; }
  const demote = db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = ?");
  const reject = db.prepare(`INSERT OR REPLACE INTO rejected_jobs (job_id, title, company, source, reason, rejected_at)
                             VALUES (?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    for (const r of plan.retire) {
      demote.run(r.job_id);
      reject.run(r.job_id, r.title || "", r.company || "", r.source || "", "out_of_market:" + r.reason, now);
    }
  })();
  log(`retired ${plan.retire.length}.`);
  return { ...plan, applied: true, refused: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`database ${dbPath}${APPLY ? "  (--apply: WRITING)" : "  (dry run)"}`);
  const db = new Database(dbPath, { readonly: !APPLY });
  const r = run({ db, apply: APPLY, maxShare: MAX_SHARE });
  process.exit(r.refused ? 2 : 0);
}
