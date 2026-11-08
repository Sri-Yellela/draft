#!/usr/bin/env node
// ⭐ D151 Rule 5 · SETTLE A SCALE FIXTURE ONCE — run the server's own background passes (descriptions, tags, levels) to
// completion on the fixture, so `npm run test:scale` measures the STEADY STATE production is in (its board is tagged),
// not a 100k-posting cold backlog. Without this the boot's tag / level walk — sliced to ≈ 50 ms since a3dc58a, so it takes
// minutes at 100k — runs through the suite's load window and every request queues behind it (seen 11-08: stalls of 1–3 s
// logged next to "[tags] (boot) tagged 50 of …").
//   node scripts/scaleSettleFixture.mjs --fixture tmp/scale-100k
// Refuses anything outside tmp/ (never the real database). Idempotent: a settled fixture is a no-op.
import path from "node:path";
import Database from "better-sqlite3";
import { tagStaleJobs } from "../services/jobs/jobTags.js";
import { readStaleLevels } from "../services/jobs/levelRead.js";
import { backfillDescriptionText, registerDescriptionBasis, sweepStaleDescriptionBasis } from "../services/jobs/descriptionText.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const dir = path.resolve(arg("--fixture", "tmp/scale-100k"));
if (!/[\\/]tmp[\\/]scale-/.test(dir)) { console.error(`REFUSING: ${dir} is not a tmp/scale-* fixture`); process.exit(2); }
const db = new Database(path.join(dir, "resume_master.db"));
registerDescriptionBasis(db);
const t0 = Date.now();
let d = 0, t = 0, l = 0, b = 0;
// migration 219's catch-up (the boot runs it in 1,000-row slices — 11 s of main-thread time in an 11-08 load window).
for (;;) { const r = sweepStaleDescriptionBasis(db, { rows: 20000 }); b += r.reset || 0; if (r.done) break; }
for (;;) { const r = backfillDescriptionText(db, { dryRun: false, limit: 5000, ceiling: 5000 }); d += r.written || 0; if (!r.written) break; }
for (;;) { const r = tagStaleJobs(db, { limit: 5000 }); t += r.tagged || 0; if (!r.tagged) break; }
for (;;) { const r = readStaleLevels(db, { limit: 5000 }); l += r.read || 0; if (!r.read) break; process.stdout.write(`\rlevels ${l}`); }
db.close();
console.log(`\nsettled ${dir}: basis sweep ${b} reset, descriptions ${d}, tags ${t}, levels ${l} in ${Math.round((Date.now() - t0) / 1000)} s`);
