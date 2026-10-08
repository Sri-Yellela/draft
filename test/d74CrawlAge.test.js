// ⭐ D74 P2 · CRAWL AGE IN ADMIN — each source's last SUCCESSFUL crawl and how old it is.
//
// The glance (Admin → Glance → Ingestion, client/src/panels/adminOps.jsx) already read
// pipelineHealth()'s per-source lastSuccessAt — pipeline_runs, run_kind 'source_sync', status 'ok' —
// but showed only the last RUN, which a failing source keeps fresh. services/adminGlance.js now judges
// the age (crawlAge: amber past 30h, red past 54h or never) and the Ingestion table shows it as a mark.
// No new route: the existing /api/admin/glance carries it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createAdminDbRouter } from "../routes/adminDb.js";
import { at } from "../test-support/sourceAnchors.js";
import { buildGlance, crawlAge, CRAWL_AGE_AMBER_HOURS, CRAWL_AGE_RED_HOURS } from "../services/adminGlance.js";

const H = 3600;
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("D74 P2 · the thresholds: ok up to 30h, amber past 30h, red past 54h, red when no crawl ever succeeded", () => {
  assert.equal(CRAWL_AGE_AMBER_HOURS, 30);
  assert.equal(CRAWL_AGE_RED_HOURS, 54);
  const now = 1_800_000_000;
  const tone = (h) => crawlAge({ lastSuccessAt: now - h * H, health: "ok", now }).tone;
  assert.equal(tone(1), "ok");
  assert.equal(tone(30), "ok");
  assert.equal(tone(30.1), "amber");
  assert.equal(tone(54), "amber");
  assert.equal(tone(54.1), "red");
  assert.deepEqual(crawlAge({ lastSuccessAt: null, health: "never_ran", now }), { hours: null, tone: "red" });
  assert.equal(crawlAge({ lastSuccessAt: now - 100 * H, health: "live_search_only", now }).tone, "not_crawled",
    "a source the daily crawl never calls has no crawl age to judge");
  assert.equal(crawlAge({ lastSuccessAt: now - 100 * H, health: "paused", now }).tone, "not_crawled");
});

test("⛔ D74 P2 · end to end: pipeline_runs → pipelineHealth() → the glance's crawl age — only an 'ok' source_sync counts", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const now = Math.floor(Date.now() / 1000);
  const run = db.prepare(`INSERT INTO pipeline_runs (run_kind, source, status, started_at, finished_at, fetched, written, unchanged)
                          VALUES (?, ?, ?, ?, ?, 10, 5, 5)`);
  run.run("source_sync", "greenhouse", "ok", now - 40 * H, now - 40 * H + 60);
  run.run("source_sync", "greenhouse", "failed", now - 1 * H, now - 1 * H + 60);     // a newer FAILURE: not a success
  run.run("source_sync", "lever", "ok", now - 20 * H, now - 20 * H + 60);
  run.run("source_sync", "ashby", "ok", now - 60 * H, now - 60 * H + 60);
  run.run("enrichment", "workable", "ok", now - 1 * H, now - 1 * H + 60);           // not a crawl
  const health = createAdminDbRouter(db).pipelineHealth();
  const g = buildGlance(db, { health, now });
  const by = Object.fromEntries(g.ingestion.sources.map(s => [s.name, s]));
  assert.equal(by.greenhouse.lastSuccessAt, now - 40 * H, "the last OK run, not the newer failed one");
  assert.equal(by.greenhouse.crawlAge.tone, "amber", "aged from the last SUCCESS — the failed run an hour ago does not freshen it");
  assert.equal(by.lever.crawlAge.tone, "ok");
  assert.equal(by.ashby.crawlAge.tone, "red");
  assert.equal(by.workable.lastSuccessAt, null, "an enrichment run is not a crawl");
  assert.equal(by.workable.crawlAge.tone, "red");
  assert.ok(Math.abs(by.greenhouse.crawlAge.hours - 40) < 0.1);
  assert.deepEqual(g.ingestion.crawlAgeHours, { amber: 30, red: 54 });
});

test("D74 P2 · the Ingestion table shows the crawl age as a MARK (D60) — on the existing glance, no second card", () => {
  const ops = read("client/src/panels/adminOps.jsx");
  assert.match(ops, /const CRAWL_AGE_COLOR = \{ ok: C\.SUCCESS, amber: C\.WARNING, red: C\.DANGER, not_crawled: C\.INK_FAINT \};/);
  assert.match(ops, /style=\{markStyle\(CRAWL_AGE_COLOR\[a\.tone\] \|\| C\.INK_FAINT\)\}/);
  assert.match(ops, /\{ key: "crawlAge", label: "last ok crawl", render: r => <CrawlAgeMark r=\{r\}\/> \},/);
  const fn = ops.slice(at(ops, "function CrawlAgeMark("), at(ops, "export function GlanceTab("));
  assert.doesNotMatch(fn, /borderRadius|999/, "no capsule — the mark carries its own shape");
  // The glance computes it; the panel never re-derives the thresholds.
  assert.doesNotMatch(ops, /\b(30|54) \* 3600\b/);
});
