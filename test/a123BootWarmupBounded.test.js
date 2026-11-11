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
// ── A123 (8) (44t, 11-05) · the provenance backfill and the tag / level scans read bounded rowid ranges ──────────────
import { nextRowidRange } from "../services/jobs/rowidWalk.js";
import { backfillProvenanceSlice, PROVENANCE_WALK_KEY } from "../services/jobs/enrichmentProvenance.js";
import { tagStaleJobs as tagStale8 } from "../services/jobs/jobTags.js";
import { readStaleLevels as readLevels8 } from "../services/jobs/levelRead.js";

const provNull = (d) => d.prepare("SELECT COUNT(*) AS n FROM scraped_jobs WHERE enrichment_provenance IS NULL").get().n;
const mark = (d) => Number(d.prepare("SELECT value FROM app_settings WHERE key = ?").get(PROVENANCE_WALK_KEY)?.value);

test("A123 (8) · nextRowidRange: consecutive (from, to] ranges cover every row once, `more` false at the end", () => {
  const d = migratedDb();
  for (let i = 0; i < 12; i++) seed(d, `r${i}`, `Text ${i}.`);
  const seen = [];
  let from = 0, guard = 0;
  for (;;) {
    const r = nextRowidRange(d, from, 5);
    seen.push(...d.prepare("SELECT rowid AS r FROM scraped_jobs WHERE rowid > ? AND rowid <= ?").all(r.from, r.to).map(x => x.r));
    if (!r.more) break;
    from = r.to;
    assert.ok(++guard < 10, "the walk ends");
  }
  assert.equal(seen.length, 12);
  assert.equal(new Set(seen).size, 12, "no row read twice");
  assert.equal(nextRowidRange(d, from, 5).more, false);
});

test("A123 (8) · the provenance walk fills a slice at a time, keeps its mark, then reads only rows inserted since", () => {
  const d = migratedDb();
  for (let i = 0; i < 7; i++) seed(d, `p${i}`, `Build services ${i}.`);
  assert.equal(provNull(d), 7);
  const a = backfillProvenanceSlice(d, { rows: 3 });
  assert.equal(a.done, false);
  assert.equal(provNull(d), 4, "only the first 3 rowids were read");
  let r = a, n = 1;
  while (!r.done) { r = backfillProvenanceSlice(d, { rows: 3 }); assert.ok(++n < 6); }
  assert.equal(provNull(d), 0);
  const end = mark(d);
  // settled: a further slice starts at the mark and reads nothing
  const again = backfillProvenanceSlice(d, { rows: 3 });
  assert.equal(again.scanned, 0);
  assert.equal(again.done, true);
  assert.equal(mark(d), end, "the mark holds");
  // a new posting past the mark is the only row the next boot reads
  seed(d, "p-new", "A new posting.");
  const fresh = backfillProvenanceSlice(d, { rows: 3 });
  assert.equal(fresh.scanned, 1);
  assert.equal(provNull(d), 0);
  assert.ok(mark(d) > end);
});

test("A123 (8) · a ranged tag / level scan reads only its range; the full walk tags everything once", () => {
  const d = migratedDb();
  for (let i = 0; i < 10; i++) seed(d, `t${i}`, `Senior engineer, 5+ years, remote ${i}.`);
  const first = nextRowidRange(d, 0, 4);
  const t = tagStale8(d, { limit: 200, range: first });
  assert.equal(t.scanned, 4, "only the range's rows");
  const l = readLevels8(d, { limit: 100, range: first });
  assert.ok(l.scanned <= 4, "levels: only the range's rows");
  let from = first.to;
  for (;;) {
    const r = nextRowidRange(d, from, 4);
    tagStale8(d, { limit: 200, range: r }); readLevels8(d, { limit: 100, range: r });
    if (!r.more) break;
    from = r.to;
  }
  assert.equal(tagStale8(d).tagged, 0, "settled after one walk");
});

test("A123 (8) · a range that hit its limit is re-read before the walk moves on", () => {
  const d = migratedDb();
  for (let i = 0; i < 6; i++) seed(d, `l${i}`, `Engineer ${i}.`);
  const r = nextRowidRange(d, 0, 6);
  assert.equal(tagStale8(d, { limit: 2, range: r }).tagged, 2);
  assert.equal(tagStale8(d, { limit: 2, range: r }).tagged, 2, "the same range again: the next stale rows");
  assert.equal(tagStale8(d, { limit: 2, range: r }).tagged, 2);
  assert.equal(tagStale8(d, { limit: 2, range: r }).tagged, 0);
});

test("A123 (8) · server.js: the provenance step and the tag pass walk in rowid ranges, one walk at a time", () => {
  const s = read("server.js");
  const prov = at(s, 'BOOT.add("enrichment provenance"');
  assert.ok(at(s, "backfillProvenanceSlice(db, { rows: PROVENANCE_SLICE_ROWS })", prov) > prov);
  assert.match(s, /if \(!provFill\.done\) setTimeout\(slice, 50\)\.unref\(\)/);
  assert.doesNotMatch(s, /backfillProvenance\(db\)/, "the whole-board statement is not called at boot");
  const walk = at(s, "function runJobTagPassSliced(trigger) {");
  assert.ok(at(s, "if (jobTagWalk) return;", walk) > walk, "an interval finding a walk running skips");
  assert.ok(at(s, "nextRowidRange(db, w.from, JOB_TAG_SLICE_ROWS)", walk) > walk);
  assert.match(s, /setTimeout\(runJobTagWalkSlice, 50\)\.unref\(\)/);
});
// ── A123 (9) (11-05) · job_role_map's "active and unmapped" read and the logo repair: no whole-table read at boot ─────
import { UNMAPPED_SQL, backfillRoleMap } from "../services/jobs/backfillRoleMap.js";
import { ACTIVE_JOB_INDEX } from "../services/jobs/rowidWalk.js";
import { GENERAL_ONLY_SQL } from "../services/jobs/remapGeneralRoles.js";
import { backfillCompanyLogosSlice, LOGO_WALK_KEY } from "../services/jobs/backfillCompanyLogos.js";

const planOf = (d, sql) => d.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map(r => r.detail).join(" | ");
function indexedDb() {
  const d = migratedDb();
  d.exec(`CREATE INDEX IF NOT EXISTS ${ACTIVE_JOB_INDEX} ON scraped_jobs(job_id, is_active)`);
  return d;
}

test("A123 (9) · a123ActiveRowsReadTheIndex: the unmapped / 'general' reads use (job_id, is_active); the category backfill keeps its own index", () => {
  const d = indexedDb();
  for (let i = 0; i < 30; i++) seed(d, `a${i}`, `Text ${i}.`);
  const unmapped = planOf(d, UNMAPPED_SQL);
  assert.match(unmapped, new RegExp(`SCAN sj USING INDEX ${ACTIVE_JOB_INDEX}`), unmapped);
  assert.doesNotMatch(unmapped, /SCAN sj USING INDEX sqlite_autoindex|SCAN sj(?! USING)/, unmapped);
  const general = planOf(d, GENERAL_ONLY_SQL);
  assert.doesNotMatch(general, /SCAN sj(?! USING (COVERING )?INDEX)/, general);
  // ⚠ the class's regression: an (is_active, …) index would win this plan from board_category's
  const cat = planOf(d, "SELECT job_id, title, description, company FROM scraped_jobs WHERE is_active = 1 AND board_category IS NULL LIMIT 100");
  assert.match(cat, /idx_scraped_jobs_(board|active)_category/, cat);   // A175 (46d): migration 268's partial index on active rows' category is the same search, narrower
  assert.equal(backfillRoleMap(d).inserted, 30, "the backfill still finds what is unmapped");
  assert.equal(backfillRoleMap(d).scanned, 0);
  d.close();
});

test("A123 (9) · server.js: the index is built by the warm-up before job_role_map, not by a migration before listen", () => {
  const s = read("server.js");
  const idx = at(s, 'BOOT.add("index: scraped_jobs (job_id, is_active)"');
  assert.ok(idx < at(s, 'BOOT.add("job_role_map"'), "built before the backfill reads it");
  assert.ok(at(s, "CREATE INDEX IF NOT EXISTS ${ACTIVE_JOB_INDEX} ON scraped_jobs(job_id, is_active)", idx) > idx);
  assert.ok(!MIGRATIONS.some(m => m.sql.includes(ACTIVE_JOB_INDEX)), "a whole-table index build never holds the port");
  assert.doesNotMatch(read("services/jobs/backfillRoleMap.js"), /ACTIVE_JOB_INDEX/, "not in a classifier-fingerprint file: touching one re-runs the 22k-row re-file");
});

test("A123 (9) · the logo repair walks rowid ranges from a mark; a settled board reads only rows inserted since", () => {
  const d = migratedDb();
  for (let i = 0; i < 7; i++) seed(d, `g${i}`, `Text ${i}.`);
  d.prepare("UPDATE scraped_jobs SET company = 'Stripe', company_icon_url = 'https://logo.clearbit.com/stripe.com'").run();
  const first = backfillCompanyLogosSlice(d, { rows: 3 });
  assert.equal(first.scanned, 3);
  assert.equal(first.done, false);
  let r = first, n = 1;
  while (!r.done) { r = backfillCompanyLogosSlice(d, { rows: 3 }); assert.ok(++n < 6); }
  assert.equal(d.prepare("SELECT COUNT(*) AS n FROM scraped_jobs WHERE company_icon_url LIKE 'https://logo.clearbit.com/%'").get().n, 0);
  const end = Number(d.prepare("SELECT value FROM app_settings WHERE key = ?").get(LOGO_WALK_KEY).value);
  assert.equal(backfillCompanyLogosSlice(d, { rows: 3 }).scanned, 0, "settled: nothing re-read");
  seed(d, "g-new", "New.");
  d.prepare("UPDATE scraped_jobs SET company = 'Stripe', company_icon_url = 'https://logo.clearbit.com/stripe.com' WHERE job_id = 'g-new'").run();
  const fresh = backfillCompanyLogosSlice(d, { rows: 3 });
  assert.equal(fresh.scanned, 1);
  assert.equal(fresh.updated + fresh.cleared, 1);
  assert.ok(Number(d.prepare("SELECT value FROM app_settings WHERE key = ?").get(LOGO_WALK_KEY).value) > end);
  assert.match(LOGO_WALK_KEY, /^company_logo_walk:[0-9a-f]{12}$/, "the key carries the retired-host list");
  const s = read("server.js");
  const step = at(s, 'BOOT.add("company logo urls"');
  assert.ok(at(s, "backfillCompanyLogosSlice(db, { rows: LOGO_SLICE_ROWS })", step) > step);
  assert.match(s, /if \(!logoFill\.done\) setTimeout\(slice, 50\)\.unref\(\)/);
  d.close();
});
