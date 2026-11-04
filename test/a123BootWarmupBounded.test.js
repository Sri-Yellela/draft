// A123 (44r, 11-04) · what D151 Rule 1 left: the warm-up's whole-board passes held the event loop for ≈ 65 s on production's
// 20:31Z deploy, and a volume-backed Railway service never overlaps its old and new containers, so every request in that
// window failed (dial timeouts, 499 / 502). Four passes were the cost; each is now bounded or skipped when settled:
//   (1) the ATS term-weight refresh at boot — skipped when any refresh is on record in the last 24 h (the cron owns it);
//   (2) the description pass's stale scan — an index read on description_basis (migration 219's trigger clears it on a
//       changed description) instead of a JS hash of every description; a one-time sliced sweep catches older changes;
//   (3) the 'general' re-file — skipped while the classifier's source is the one the last full pass ran with;
//   (4) the startup cleanup's history + ghost rollups — skipped at boot when they ran in the last 20 h.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import {
  backfillDescriptionText, descriptionBasis, DESCRIPTION_STALE_SQL, sweepStaleDescriptionBasis, BASIS_SWEEP_KEY, BASIS_PREFIX,
} from "../services/jobs/descriptionText.js";
import { remapGeneralRows, classifierFingerprint, REMAP_SETTLED_KEY } from "../services/jobs/remapGeneralRoles.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function migratedDb() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  return d;
}
function seed(d, id, description, title = "Software Engineer") {
  d.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, is_active)
             VALUES (?, 't', ?, ?, 'Synthetic Co', ?, 'greenhouse', ?, 1)`).run(id, `h-${id}`, title, `https://example.com/${id}`, description);
}
const stale = (d) => d.prepare(`SELECT job_id FROM scraped_jobs WHERE ${DESCRIPTION_STALE_SQL} ORDER BY job_id`).all().map(r => r.job_id);
const basis = (d, id) => d.prepare("SELECT description_basis AS b FROM scraped_jobs WHERE job_id = ?").get(id).b;

test("A123 (2) · a changed description clears its basis (migration 219), so the stale scan needs no hash", () => {
  const d = migratedDb();
  seed(d, "a", "Build services in Go."); seed(d, "b", "Write SQL.");
  assert.deepEqual(stale(d), ["a", "b"], "never read → stale");
  backfillDescriptionText(d, { dryRun: false });
  assert.deepEqual(stale(d), [], "a settled board has nothing stale");
  assert.equal(basis(d, "a"), descriptionBasis("Build services in Go."));
  d.prepare("UPDATE scraped_jobs SET description = ? WHERE job_id = 'a'").run("Build services in Rust.");
  assert.equal(basis(d, "a"), null, "the trigger cleared the basis");
  d.prepare("UPDATE scraped_jobs SET description = description, title = 'Senior' WHERE job_id = 'b'").run();
  assert.equal(basis(d, "b"), descriptionBasis("Write SQL."), "an unchanged description keeps its basis");
  assert.deepEqual(stale(d), ["a"]);
  // another normaliser version's basis is stale too (outside this version's prefix range)
  d.prepare("UPDATE scraped_jobs SET description_basis = ? WHERE job_id = 'b'").run("v0:" + "0".repeat(16));
  assert.deepEqual(stale(d), ["a", "b"]);
  assert.ok(basis(d, "a") === null && BASIS_PREFIX.endsWith(":"));
  const r = backfillDescriptionText(d, { dryRun: false });
  assert.equal(r.written, 2);
  assert.deepEqual(stale(d), []);
  d.close();
});

test("A123 (2) · the stale scan reads the basis index, never the description", () => {
  const d = migratedDb();
  const plan = d.prepare(`EXPLAIN QUERY PLAN SELECT job_id FROM scraped_jobs WHERE ${DESCRIPTION_STALE_SQL}`).all().map(r => r.detail).join(" | ");
  assert.match(plan, /idx_scraped_jobs_description_basis/, plan);
  assert.doesNotMatch(DESCRIPTION_STALE_SQL, /\(description\)/, "no function of the description in the stale scan");
  d.close();
});

test("A123 (2) · the one-time sweep resets a basis left behind before the trigger, in slices, and remembers it is done", () => {
  const d = migratedDb();
  for (const id of ["a", "b", "c", "d", "e"]) seed(d, id, `Posting ${id}.`);
  backfillDescriptionText(d, { dryRun: false });
  // a change from before migration 219: the description moved, the basis did not
  d.exec("DROP TRIGGER d151_description_basis_reset");
  d.prepare("UPDATE scraped_jobs SET description = 'Rewritten.' WHERE job_id IN ('b', 'e')").run();
  assert.deepEqual(stale(d), [], "the index scan alone cannot see these");
  const slices = [];
  for (let i = 0; i < 10; i++) { const r = sweepStaleDescriptionBasis(d, { rows: 2 }); slices.push(r); if (r.done) break; }
  assert.equal(slices.length, 3, "five rows, two a slice");
  assert.equal(slices.reduce((n, r) => n + r.reset, 0), 2);
  assert.deepEqual(stale(d), ["b", "e"]);
  assert.equal(d.prepare("SELECT value FROM app_settings WHERE key = ?").get(BASIS_SWEEP_KEY).value, "done");
  assert.deepEqual(sweepStaleDescriptionBasis(d), { done: true, from: null, to: null, reset: 0 }, "done stays done");
  d.close();
});

test("A123 (3) · the boot's 'general' re-file is skipped while the classifier is unchanged", () => {
  const d = migratedDb();
  seed(d, "a", "", "Brex Rotational Program");
  d.prepare(`INSERT INTO job_role_map (job_id, role_key, role_family, source_profile_id, confidence, matched_by)
             VALUES ('a', 'general', 'general', NULL, 0.5, 'classifier')`).run();
  const first = remapGeneralRows(d, { skipIfSettled: true });
  assert.equal(first.skipped, undefined, "never run → it runs");
  assert.equal(first.scanned, 1);
  assert.equal(d.prepare("SELECT value FROM app_settings WHERE key = ?").get(REMAP_SETTLED_KEY).value, classifierFingerprint());
  assert.equal(remapGeneralRows(d, { skipIfSettled: true }).skipped, true, "settled → skipped");
  assert.equal(remapGeneralRows(d).scanned, 1, "without the flag (the scripts, the tests) it always runs");
  d.prepare("UPDATE app_settings SET value = 'older' WHERE key = ?").run(REMAP_SETTLED_KEY);
  assert.equal(remapGeneralRows(d, { skipIfSettled: true }).scanned, 1, "a changed classifier → it runs again");
  assert.equal(remapGeneralRows(d, { dryRun: true }).scanned, 1);
  d.close();
});

test("A123 (3) · the fingerprint covers every file the re-file's decision reads", () => {
  const src = read("services/jobs/remapGeneralRoles.js");
  for (const f of ["backfillRoleMap.js", "classifyJob.js", "collarClassifier.js", "jobTaxonomy.js", "../jobClassifier.js"]) {
    assert.ok(src.includes(`"./${f}"`) || src.includes(`"${f}"`), f);
  }
  assert.match(classifierFingerprint(), /^[0-9a-f]{16}$/);
});

test("A123 (1) (2) (3) (4) · server.js: the boot skips settled work and the sweep runs after the warm-up", () => {
  const s = read("server.js");
  const weights = s.slice(at(s, "// ⛔ 44r (11-04) · NOT ON EVERY DEPLOY."), at(s, "runTermWeightRefresh(\"boot\");") + 40);
  assert.match(weights, /if \(termWeightRefreshRanWithin\(24 \* 3600\)\)/);
  assert.match(s, /function termWeightRefreshRanWithin\(seconds/);
  assert.match(s, /remapGeneralRows\(db, \{ skipIfSettled: true \}\)/);
  const cleanup = s.slice(at(s, "function runExpiredJobsCleanup("), at(s, "STARRED ROWS ARE RETIRED"));
  assert.match(cleanup, /const startup = cleanupRunsThisProcess\+\+ === 0;/);
  assert.match(cleanup, /if \(startup && rollupsRanWithin\(20 \* 3600\)\)/);
  assert.match(cleanup, /markRollupsRan\(\);/);
  const cron = s.slice(at(s, "const g = scoreGhosts(db);\n    markRollupsRan();"), at(s, "[Cron] ghost score:"));
  assert.ok(cron.length > 0, "the crawl cron marks the rollups too");
  assert.match(s, /setTimeout\(runDescriptionBasisSweep, 120 \* 1000\)\.unref\(\);/);
  const migIds = MIGRATIONS.map(m => m.id);
  assert.ok(migIds.includes("219_boot_bounded_scans"));
  assert.ok(s.includes('id: "219_boot_bounded_scans"'), "the server's list carries it too");
});

test("A123 · the cleanup's expiry scans read an index on scraped_at, built by the warm-up before the cleanup runs", () => {
  const s = read("server.js");
  const idx = at(s, 'BOOT.add("index: scraped_jobs.scraped_at"');
  assert.ok(idx < at(s, 'BOOT.add("startup expired-jobs cleanup"'), "built before the cleanup step");
  const d = migratedDb();
  d.exec("CREATE INDEX IF NOT EXISTS idx_scraped_jobs_scraped_at ON scraped_jobs(scraped_at)");
  const plan = d.prepare("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM scraped_jobs WHERE scraped_at < ? AND is_active = 1").all(0).map(r => r.detail).join(" | ");
  assert.match(plan, /idx_scraped_jobs_scraped_at/, plan);
  d.close();
});
