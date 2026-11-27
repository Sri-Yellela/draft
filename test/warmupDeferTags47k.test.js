// ⭐ 47k (the zero-downtime lane, owner 11-26 decision 6, lever (1)) · WARMUP_DEFER_TAGS=1 takes job_role_map and the
// tags' first slice out of the ready gate (production 47j: 1.7–2.6 s + 0.7 s of a 3.4–3.6 s listen → ready). Pins:
//   · flag OFF (the default) = the old gate, unchanged: every step holds ready, the snapshot has no new fields, and
//     settled() is run()'s own promise;
//   · flag ON = ready flips without the two; they run right after, in their order (the tags read the role map's
//     bucket), timed as "deferred" and logged; settled() waits for them, and the board-fit pass / ready walks wait on it;
//   · in the gap a read sees the PERSISTED state — the last pass's buckets and tags — and a posting neither step has
//     reached reads soft-null (no bucket, NULL tags → kept as unknown), never an error and never a hidden row.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { createBootWarmup } from "../services/boot/bootWarmup.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { backfillRoleMap } from "../services/jobs/backfillRoleMap.js";
import { tagStaleJobs } from "../services/jobs/jobTags.js";
import { buildJobFilters } from "../services/jobs/jobQuery.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const quietLog = () => { const lines = []; return { lines, log: (...a) => lines.push(a.join(" ")), error: (...a) => lines.push(a.join(" ")), warn() {} }; };
const DEFERRED = ["job_role_map", "job tags (first slice)"];

function queue(w, ran) {
  w.add("index", () => ran.push("index"));
  w.add("job_role_map", () => ran.push("job_role_map"));
  w.add("job tags (first slice)", () => ran.push("tags"));
  w.add("cleanup", () => ran.push("cleanup"));
}

test("47k flag OFF: the old gate — every step before ready, no new snapshot fields, settled() is run()", async () => {
  const ran = [];
  const out = quietLog();
  const w = createBootWarmup({ log: out });   // server.js passes defer: [] unless WARMUP_DEFER_TAGS=1
  queue(w, ran);
  w.listening();
  const p = w.run();
  assert.equal(w.settled(), p, "with nothing deferred settled() is the same promise");
  assert.deepEqual(w.snapshot().pending, ["index", "job_role_map", "job tags (first slice)", "cleanup"]);
  const snap = await p;
  assert.deepEqual(ran, ["index", "job_role_map", "tags", "cleanup"], "the role map and tags hold ready, in their place");
  assert.deepEqual(Object.keys(snap).sort(), ["listenMs", "pending", "readyMs", "state", "timeline"], "the snapshot is today's shape");
  assert.ok(snap.timeline.every(t => t.phase === "warm-up"));
  assert.doesNotMatch(out.lines.join("\n"), /deferred/);
  // an explicit empty list is the same
  const ran2 = [];
  const w2 = createBootWarmup({ log: quietLog(), defer: [] });
  queue(w2, ran2);
  await w2.run();
  assert.deepEqual(ran2, ran);
});

test("47k flag ON: ready flips before the two run; they run after it, in order; settled() waits for them", async () => {
  const ran = [];
  const out = quietLog();
  const w = createBootWarmup({ log: out, defer: DEFERRED });
  queue(w, ran);
  w.listening();
  assert.deepEqual(w.snapshot().pending, ["index", "cleanup"], "/api/health/ready's pending list no longer names them");
  assert.deepEqual(w.snapshot().deferred, DEFERRED);
  const snap = await w.run();
  assert.equal(w.ready, true);
  assert.deepEqual(ran, ["index", "cleanup"], "ready did not await the role map or the tags");
  assert.deepEqual(snap.deferred, DEFERRED, "still to run at ready");
  assert.equal(snap.settledMs, null);
  assert.match(out.lines.join("\n"), /\[boot\] ready at \d+ ms .*deferred until after ready: job_role_map, job tags \(first slice\)/);
  const settled = await w.settled();
  assert.deepEqual(ran, ["index", "cleanup", "job_role_map", "tags"], "the role map before the tags (they read its bucket)");
  assert.deepEqual(settled.deferred, []);
  assert.ok(settled.settledMs >= settled.readyMs);
  assert.deepEqual(settled.timeline.filter(t => t.phase === "deferred").map(t => t.name), DEFERRED);
  const log = out.lines.join("\n");
  assert.match(log, /\[boot\] deferred step "job_role_map" done at \d+ ms \(took \d+ ms\)/);
  assert.match(log, /\[boot\] deferred step "job tags \(first slice\)" done at \d+ ms \(took \d+ ms\)/);
  assert.match(log, /\[boot\] deferred warm-up done at \d+ ms \(ready at \d+ ms\)/);
});

test("47k flag ON: the deferred work starts on ready by itself, and a failing deferred step is not fatal", async () => {
  const ran = [];
  const out = quietLog();
  const w = createBootWarmup({ log: out, defer: DEFERRED });
  w.add("job_role_map", () => { throw new Error("disk full"); });
  w.add("job tags (first slice)", () => ran.push("tags"));
  await w.run();
  // nobody called settled(): the steps still run (server.js's ready chain calls it too, but must not be the trigger)
  for (let i = 0; i < 50 && !ran.length; i++) await new Promise(r => setImmediate(r));
  assert.deepEqual(ran, ["tags"]);
  const s = await w.settled();
  assert.deepEqual(s.timeline.map(t => [t.name, t.phase, t.ok]), [["job_role_map", "deferred", false], ["job tags (first slice)", "deferred", true]]);
  assert.match(out.lines.join("\n"), /deferred step "job_role_map" failed \(not fatal\).*disk full/);
});

test("47k server.js: the flag, its default, the names, and everything that reads their work waits on settled()", () => {
  const s = read("server.js");
  const decl = at(s, "const WARMUP_DEFERRED_STEPS = [");
  assert.match(s, /const WARMUP_DEFERRED_STEPS = \["job_role_map", "job tags \(first slice\)"\];/);
  assert.match(s.slice(decl, decl + 400), /defer: process\.env\.WARMUP_DEFER_TAGS === "1" \? WARMUP_DEFERRED_STEPS : \[\] \}\);/,
    "default OFF: anything but exactly \"1\" defers nothing");
  // each name is a real step's name — a renamed step would silently fall back into the gate
  assert.match(s, /BOOT\.add\("job_role_map", \(\) => \{/);
  assert.match(s, /BOOT\.add\("job tags \(first slice\)", \(\) => runJobTagPassSliced\("boot"\)\)/);
  assert.ok(at(s, 'BOOT.add("job_role_map"') < at(s, 'BOOT.add("job tags (first slice)"'), "added in dependency order");
  // the board-fit boot pass: after its delay from ready, and only once the deferred steps have run
  const run = at(s, "BOOT.run().then(() => setTimeout(() => {");
  const fit = s.slice(run, at(s, "BOARD_FIT_BOOT_DELAY_MS", run));
  assert.match(fit, /BOOT\.settled\(\)\.then\(\(\) => scheduleBoardFitForAll\("boot"\)\);/);
  // the ready walks (classify reads the role map's bucket) chain on settled(), not on ready
  const chain = s.slice(run, at(s, 'classifyBacklog.run("boot"', run));
  assert.match(chain, /\.unref\?\.\(\)\)\.then\(\(\) => BOOT\.settled\(\)\)\.then\(\(\) => \{/);
  // the staging measurement's clock marks
  assert.match(s, /console\.log\(`\[boot\] job tags boot walk done at \$\{Math\.round\(process\.uptime\(\) \* 1000\)\} ms`\)/);
  assert.match(read("scripts/warmupMeasure.mjs"), /WARMUP_DEFER_TAGS: mode === "on" \? "1" : ""/);
});

// ── what a request reads in the gap ─────────────────────────────────────────────────────────────────────────────────
function migratedDb() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  return d;
}
function seed(d, id, title, location) {
  d.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, description, location, is_active)
             VALUES (?, 't', ?, ?, 'Synthetic Co', ?, 'greenhouse', 'Build services. Fully remote role.', ?, 1)`)
    .run(id, `h-${id}`, title, `https://example.com/${id}`, location);
}
const row = (d, id) => d.prepare(`SELECT sj.tag_basis, sj.tag_workplace, sj.tag_function,
    (SELECT m.role_key FROM job_role_map m WHERE m.job_id = sj.job_id LIMIT 1) AS role_key FROM scraped_jobs sj WHERE sj.job_id = ?`).get(id);

test("47k in the gap: reads see the last pass's persisted buckets / tags, and a new posting soft-null — kept, not hidden", () => {
  const d = migratedDb();
  // the previous boot / interval pass: "old" was bucketed and tagged
  seed(d, "old", "Senior Software Engineer", "Remote");
  backfillRoleMap(d);
  tagStaleJobs(d);
  const before = row(d, "old");
  assert.ok(before.role_key, "the earlier pass bucketed it");
  assert.ok(before.tag_basis, "the earlier pass tagged it");
  // crawled while the old container was down; the new boot's deferred steps have not reached it yet
  seed(d, "new", "Backend Engineer", "Remote");
  const gapNew = row(d, "new");
  assert.equal(gapNew.role_key, null, "no bucket yet");
  assert.equal(gapNew.tag_basis, null, "no tags yet");
  assert.deepEqual(row(d, "old"), before, "the persisted state is what the gap reads");
  // the board's soft-null filter keeps the untagged row (as unknown) — it is not hidden by the deferral
  const f = buildJobFilters({ work_models: ["remote"] });
  const visible = () => d.prepare(`SELECT sj.job_id FROM scraped_jobs sj WHERE sj.is_active = 1 ${f.sql} ORDER BY sj.job_id`).all(...f.params).map(r => r.job_id);
  const unknown = () => d.prepare(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE sj.is_active = 1 ${f.sql} AND ${f.established.unclassifiedSql}`).get(...f.params).n;
  const gapVisible = visible();
  assert.ok(gapVisible.includes("new"), "an untagged posting stays on the board in the gap");
  // the deferred steps then run (server.js: the same backfillRoleMap + tag pass, after ready)
  backfillRoleMap(d);
  tagStaleJobs(d);
  const after = row(d, "new");
  assert.ok(after.role_key && after.tag_basis, "after the deferred steps the new posting is bucketed and tagged");
  assert.deepEqual(row(d, "old"), before, "the old posting is untouched (idempotent on a settled row)");
  assert.ok(unknown() <= 1);
  d.close();
});
