// D78 C — Jobo, the paid jobo.world feed, is RETIRED. Owner: "retire Jobo since we are doing our
// own crawls". Production held 0 source='jobo' rows when it went.
//
// What went: the adapter (services/jobs/sources/jobo.js), cacheJoboFeed and its cost-guard helpers
// in aggregator.js, the 04:00 cron block in server.js, the smoke-test script, JOBO_* env vars, and
// jobo's membership of the pipeline-health crawl set.
//
// What STAYS, deliberately: 'jobo' as VOCABULARY. The source filter's enum, the automation tier,
// the tag registry and the logo host all still know the word — vendored clients and saved filters
// send it, and a stored row's source must still render. Removing the producer is not removing the
// value. This guard is red if the producer comes back, and red if the vocabulary is taken too.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSourceStatus } from "../services/jobs/aggregator.js";
import { SOURCES, isValid, invalidEntries, labelFor } from "../shared/jobFilterOptions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function jsFilesUnder(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFilesUnder(rel));
    else if (/\.(m?js|cjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

test("D78 C: the Jobo adapter is gone", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "services/jobs/sources/jobo.js")), false,
    "services/jobs/sources/jobo.js must not exist — Jobo is retired");
  assert.equal(fs.existsSync(path.join(ROOT, "scripts/joboSyncSmokeTest.js")), false,
    "the smoke test drove the retired feed");
});

test("D78 C: nothing in services/, routes/ or server.js imports a jobo source or calls cacheJoboFeed", () => {
  const files = [...jsFilesUnder("services"), ...jsFilesUnder("routes"), "server.js"];
  const offenders = [];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    // Code only: a comment may say what used to be here.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    if (/from\s+['"][^'"]*sources\/jobo(\.js)?['"]/.test(code)) offenders.push(`${rel}: imports sources/jobo`);
    if (/\bcacheJoboFeed\b/.test(code)) offenders.push(`${rel}: references cacheJoboFeed`);
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});

test("D78 C: the source status, and therefore the crawl set, no longer lists jobo", () => {
  const names = getSourceStatus().map((s) => s.name);
  assert.ok(names.length > 0, "getSourceStatus still reports the live sources");
  assert.equal(names.includes("jobo"), false, "getSourceStatus must not list jobo");
  const adminDb = fs.readFileSync(path.join(ROOT, "routes/adminDb.js"), "utf8");
  const crawl = adminDb.match(/const CRAWL_SOURCES = [^;]*;/);
  assert.ok(crawl, "routes/adminDb.js still declares CRAWL_SOURCES");
  assert.doesNotMatch(crawl[0], /jobo/, "CRAWL_SOURCES must not add jobo back");
});

test("D78 C: the 'jobo' VALUE survives in the source enum — valid and labelled, no longer offered", () => {
  assert.equal(isValid(SOURCES, "jobo"), true,
    "shared/jobFilterOptions.js must still ACCEPT 'jobo' — vendored clients and saved filters send it");
  assert.deepEqual(invalidEntries(SOURCES, "greenhouse,jobo"), [], "a saved filter naming jobo is not refused");
  assert.equal(labelFor(SOURCES, "jobo"), "Jobo", "a stored jobo row still renders its source");
  assert.equal(SOURCES.options.some((o) => o.value === "jobo"), false,
    "nothing writes jobo any more, so the drawer must not offer a provider that can only return zero rows");
});
