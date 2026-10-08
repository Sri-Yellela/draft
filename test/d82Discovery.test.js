import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  hiringThreadMonth, pickHiringThreads, hnText, parsePost, parseJobAd, mergeCandidates, collectHn, MAX_REQUESTS, THREAD_MONTHS,
} from "../services/jobs/hnDiscovery.js";
import {
  runHnDiscovery, runCandidateProbe, poolCandidates, resetBreaker, BREAKER_AFTER, discoveryPaused, rankScore,
} from "../services/companyCandidates.js";
import { createCompaniesRouter } from "../routes/companies.js";

// ⛔ D82 B/C/E — the HN discovery job, the candidate pool, the nightly read-only probe and their guards.
// No network: the HN API is a fixture behind an injected fetchJson, the probe an injected function.

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const noSleep = async () => {};
const OFF = {};                                   // an env with no DISCOVERY_PAUSED

// ── the HN fixture: the thread list, two monthly threads, the jobs feed ─────────────────────────────
const post = (header, body = "") => `${header}<p>${body}`;
const THREADS = {
  hits: [
    { objectID: "300", title: "Ask HN: Who is hiring? (October 2026)" },
    { objectID: "299", title: "Ask HN: Who wants to be hired? (October 2026)" },
    { objectID: "200", title: "Ask HN: Who is hiring? (September 2026)" },
    { objectID: "201", title: "Ask HN: Freelancer? Seeking freelancer? (September 2026)" },
  ],
};
const ITEMS = {
  300: { children: [
    { text: post("Acme Robotics | Senior Backend Engineer | San Francisco, CA | Full-time",
      'Apply: <a href="https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme-robotics&#x2F;abc">https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme-...</a>') },
    { text: post("Pear VC | Software Engineers across our portfolio | Remote (US)", "https://jobs.ashbyhq.com/pear-vc") },
    { text: post("Deny Corp | Platform Engineer | NYC", "https://jobs.lever.co/denycorp") },
    { text: post("Eurocorp | Backend Engineer | Berlin, Germany | Onsite", "https://boards.greenhouse.io/eurocorp") },
    { text: post("Bakery Co | Head Baker | Austin, TX", "https://boards.greenhouse.io/bakeryco") },
    { text: post("Profile Co (YC S22) | Software Engineer | Remote (US)", "https://www.ycombinator.com/companies/profile-co") },
    { text: null },                                                   // a deleted post
  ] },
  200: { children: [
    { text: post("Acme Robotics | ML Engineer | San Francisco, CA", "https://jobs.ashbyhq.com/acme-robotics") },
  ] },
};
const FEED = { hits: [
  { title: "Rocketship (YC W24) Is Hiring a Founding Engineer", url: "https://jobs.lever.co/rocketship", created_at_i: 1790000000 },
] };
function fakeHn({ fail = false } = {}) {
  const calls = [];
  const fetchJson = async (url) => {
    calls.push(url);
    if (fail) throw new Error("ECONNRESET");
    if (url.includes("author_whoishiring")) return THREADS;
    if (url.includes("tags=job")) return FEED;
    const id = url.split("/items/")[1];
    return ITEMS[id] || { children: [] };
  };
  return { calls, fetchJson };
}
const snapshot = (db, skip = []) => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all()
  .filter((t) => !skip.includes(t)).map((t) => [t, JSON.stringify(db.prepare(`SELECT * FROM "${t}"`).all())]));

// ── the parsing core ───────────────────────────────────────────────────────────────────────────────
test("the parsing core: monthly threads only, newest first; HTML links become their href; a YC profile page is not a board", () => {
  assert.equal(hiringThreadMonth("Ask HN: Who is hiring? (October 2026)"), "2026-10");
  assert.equal(hiringThreadMonth("Ask HN: Who wants to be hired? (October 2026)"), null);
  assert.deepEqual(pickHiringThreads(THREADS.hits).map((t) => t.month), ["2026-10", "2026-09"]);
  assert.match(hnText('a <a href="https:&#x2F;&#x2F;x.com&#x2F;y">x.co...</a> &amp; b'), /https:\/\/x\.com\/y & b/);
  const acme = parsePost(ITEMS[300].children[0].text);
  assert.deepEqual([acme.company, acme.ats.atsType, acme.ats.slug, acme.usHint], ["Acme Robotics", "ashby", "acme-robotics", true]);
  assert.equal(parsePost(ITEMS[300].children[3].text), null, "clearly outside the US");
  assert.equal(parsePost(ITEMS[300].children[4].text), null, "not a CS role");
  const yc = parsePost(ITEMS[300].children[5].text);
  assert.equal(yc.ats, null, "ycombinator.com/companies is a profile, never an ATS link");
  assert.equal(yc.yc, "S22");
  const ad = parseJobAd(FEED.hits[0]);
  assert.deepEqual([ad.company, ad.yc, ad.ats.atsType], ["Rocketship", "W24", "lever"]);
  const merged = mergeCandidates([{ ...acme, month: "2026-10", via: "who" }, { ...acme, month: "2026-09", via: "who" }], { recentMonths: ["2026-10", "2026-09"] });
  assert.deepEqual([merged.length, merged[0].n_months, merged[0].recent4, merged[0].last], [1, 2, 2, "2026-10"]);
});

test("collectHn spends at most the thread list + 12 threads + the jobs feed, spaced", async () => {
  const many = { hits: Array.from({ length: 20 }, (_, i) => ({ objectID: String(i), title: `Ask HN: Who is hiring? (${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][i % 12]} ${2025 - Math.floor(i / 12)})` })) };
  const calls = []; let sleeps = 0;
  await collectHn({ fetchJson: async (u) => { calls.push(u); return u.includes("author_whoishiring") ? many : { children: [], hits: [] }; },
    sleep: async () => { sleeps++; } });
  assert.equal(MAX_REQUESTS, 1 + THREAD_MONTHS + 1);
  assert.equal(calls.length, MAX_REQUESTS);
  assert.equal(sleeps, calls.length - 1, "every request after the first waits");
});

// ── ⛔ the row's tests ─────────────────────────────────────────────────────────────────────────────
test("⛔ a discovery job writes NO company — it only pools candidates (and a pipeline_runs row)", async () => {
  const db = freshDb();
  const before = db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get();
  const { fetchJson } = fakeHn();
  db.prepare("INSERT INTO crawler_denylist (domain, reason) VALUES ('lever.co', 'test')").run();
  const r = await runHnDiscovery(db, { env: OFF, fetchJson, sleep: noSleep });
  assert.equal(r.ran, true);
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get(), before, "company_ats_list untouched");
  assert.deepEqual(db.prepare("SELECT company, ats_type, ats_slug, status FROM company_candidates ORDER BY company").all().map((c) => `${c.company}:${c.ats_type}:${c.ats_slug}:${c.status}`),
    ["Acme Robotics:ashby:acme-robotics:new"]);
  const run = db.prepare("SELECT run_kind, source, status, written FROM pipeline_runs WHERE run_kind = 'discovery'").all();
  assert.deepEqual(run, [{ run_kind: "discovery", source: "hn", status: "ok", written: 1 }]);
  // The probe job adds no company either.
  await runCandidateProbe(db, { env: OFF, sleep: noSleep, probe: async () => ({ state: "live", jobs: 10, cs: 6, csOpen: 8, cs30: 3, pct30: 40, pct120: 75, usPct: 90 }) });
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get(), before);
});

test("⛔ the probe never writes outside its own table", async () => {
  const db = freshDb();
  poolCandidates(db, [{ company: "Acme", ats: { atsType: "ashby", slug: "acme", url: "https://jobs.ashbyhq.com/acme" }, sources: { who: 1 } },
                      { company: "Beta", ats: { atsType: "lever", slug: "beta", url: "https://jobs.lever.co/beta" }, sources: { who: 1 } }], { source: "hn" });
  const own = ["company_candidates", "pipeline_runs", "discovery_breakers"];
  const before = snapshot(db, own);
  const seen = [];
  const r = await runCandidateProbe(db, { env: OFF, sleep: noSleep, probe: async (b) => { seen.push(b.slug); return { state: "live", jobs: 4, cs: 2, csOpen: 3, cs30: 1, pct120: 66, usPct: 100 }; } });
  assert.deepEqual([r.probed, seen.sort().join()], [2, "acme,beta"]);
  assert.deepEqual(snapshot(db, own), before, "no table but the pool and its bookkeeping changed");
  const rows = db.prepare("SELECT status, rank_score, evidence_json FROM company_candidates").all();
  assert.ok(rows.every((x) => x.status === "probed" && x.rank_score === rankScore({ state: "live", cs: 2, cs30: 1 }) && JSON.parse(x.evidence_json).admit === "ok"));
});

test("⛔ a deny-listed host and a VC / portfolio board are never queued; a rejected candidate is never re-queued", () => {
  const db = freshDb();
  db.prepare("INSERT INTO crawler_denylist (domain, reason) VALUES ('lever.co', 'owner')").run();
  const out = poolCandidates(db, [
    { company: "Deny Corp", ats: { atsType: "lever", slug: "denycorp", url: "https://jobs.lever.co/denycorp" } },
    { company: "Pear VC", ats: { atsType: "ashby", slug: "pear-vc", url: "https://jobs.ashbyhq.com/pear-vc" } },
    { company: "Acme Staffing", ats: { atsType: "ashby", slug: "ts", url: "https://jobs.ashbyhq.com/ts" } },
    { company: "Good", ats: { atsType: "ashby", slug: "good", url: "https://jobs.ashbyhq.com/good" } },
  ], { source: "hn" });
  assert.deepEqual(out.skipped, { denied_host: 1, portfolio_board: 1, staffing_agency: 1 });
  assert.deepEqual(db.prepare("SELECT ats_slug FROM company_candidates").pluck().all(), ["good"]);
  db.prepare("UPDATE company_candidates SET status = 'rejected'").run();
  poolCandidates(db, [{ company: "Good", ats: { atsType: "ashby", slug: "GOOD", url: "https://jobs.ashbyhq.com/GOOD" } }], { source: "hn" });
  assert.deepEqual(db.prepare("SELECT status FROM company_candidates").pluck().all(), ["rejected"], "dedup is case-insensitive and keeps the owner's rejection");
  // Already configured (migration 056 seeds stripe) is never queued.
  assert.deepEqual(poolCandidates(db, [{ company: "Stripe Inc", ats: { atsType: "greenhouse", slug: "stripe", url: "https://boards.greenhouse.io/stripe" } }], { source: "hn" }).skipped, { configured: 1 });
});

test("⛔ the circuit breaker opens after three consecutive failures — and then nothing is requested", async () => {
  const db = freshDb();
  const hn = fakeHn({ fail: true });
  for (let i = 0; i < BREAKER_AFTER; i++) assert.equal((await runHnDiscovery(db, { env: OFF, fetchJson: hn.fetchJson, sleep: noSleep })).failed, true);
  assert.equal(db.prepare("SELECT open FROM discovery_breakers WHERE source = 'hn'").pluck().get(), 1);
  const calls = hn.calls.length;
  const blocked = await runHnDiscovery(db, { env: OFF, fetchJson: hn.fetchJson, sleep: noSleep });
  assert.deepEqual([blocked.ran, blocked.reason, hn.calls.length], [false, "breaker_open", calls]);
  // Two failures then a success do not open it; only the owner's reset closes an open one.
  resetBreaker(db, "hn");
  const good = fakeHn();
  assert.equal((await runHnDiscovery(db, { env: OFF, fetchJson: good.fetchJson, sleep: noSleep })).ran, true);
  assert.equal(db.prepare("SELECT failures FROM discovery_breakers WHERE source = 'hn'").pluck().get(), 0);
  // The probe has its own breaker: every probe erroring three nights running opens it.
  poolCandidates(db, [{ company: "Z", ats: { atsType: "ashby", slug: "z", url: "https://jobs.ashbyhq.com/z" } }], { source: "hn" });
  for (let i = 0; i < BREAKER_AFTER; i++) await runCandidateProbe(db, { env: OFF, sleep: noSleep, probe: async () => { throw new Error("timeout"); } });
  assert.equal(db.prepare("SELECT open FROM discovery_breakers WHERE source = 'probe'").pluck().get(), 1);
  assert.equal(db.prepare("SELECT open FROM discovery_breakers WHERE source = 'hn'").pluck().get(), 0, "per source");
});

test("⛔ DISCOVERY_PAUSED stops every job before it reads anything — and still writes its pipeline_runs row", async () => {
  assert.equal(discoveryPaused({ DISCOVERY_PAUSED: "1" }), true);
  assert.equal(discoveryPaused({}), false);
  const db = freshDb();
  poolCandidates(db, [{ company: "Z", ats: { atsType: "ashby", slug: "z", url: "https://jobs.ashbyhq.com/z" } }], { source: "hn" });
  const hn = fakeHn();
  let probes = 0;
  const env = { DISCOVERY_PAUSED: "1" };
  const a = await runHnDiscovery(db, { env, fetchJson: hn.fetchJson, sleep: noSleep });
  const b = await runCandidateProbe(db, { env, sleep: noSleep, probe: async () => { probes++; return { state: "live" }; } });
  assert.deepEqual([a.reason, b.reason, hn.calls.length, probes], ["paused", "paused", 0, 0]);
  assert.deepEqual(db.prepare("SELECT source, status FROM pipeline_runs WHERE run_kind = 'discovery' ORDER BY id").all().map((r) => `${r.source}:${r.status}`),
    ["hn:skipped_unconfigured", "probe:skipped_unconfigured"]);
});

// ── the owner's review ───────────────────────────────────────────────────────────────────────────
test("Approve is dry first, then backs up, passes the disk gate and adds WITH evidence; Reject keeps the row", async () => {
  const db = freshDb();
  poolCandidates(db, [{ company: "Acme", ats: { atsType: "ashby", slug: "acme", url: "https://jobs.ashbyhq.com/acme" }, sources: { who: 2 }, n_months: 2, last: "2026-10" },
                      { company: "Quiet", ats: { atsType: "ashby", slug: "quiet", url: "https://jobs.ashbyhq.com/quiet" } },
                      { company: "Nope", ats: { atsType: "ashby", slug: "nope", url: "https://jobs.ashbyhq.com/nope" } }], { source: "hn" });
  await runCandidateProbe(db, { env: OFF, sleep: noSleep, probe: async ({ slug }) => slug === "quiet"
    ? { state: "live", cs: 0, csOpen: 4, pct120: 0, usPct: 100 } : { state: "live", cs: 5, csOpen: 6, cs30: 2, pct30: 33, pct120: 83, usPct: 100 } });
  const ids = db.prepare("SELECT ats_slug, id FROM company_candidates").all().reduce((m, r) => ({ ...m, [r.ats_slug]: r.id }), {});
  const backups = [];
  const app = express();
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use("/c", createCompaniesRouter(db, (_q, _s, n) => n(), { gate: () => ({ ok: true }), backup: (l) => { backups.push(l); return { filename: "b.db" }; }, env: OFF }));
  const server = app.listen(0);
  const call = (path, body) => fetch(`http://127.0.0.1:${server.address().port}/c${path}`, { method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json() }));
  try {
    const before = db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get();
    const dry = await call("/candidates/approve", { ids: [ids.acme, ids.quiet] });
    assert.deepEqual([dry.body.dryRun, dry.body.eligible.map((e) => e.id), dry.body.refused.map((r) => r.reason)], [true, [ids.acme], ["none_recent"]]);
    assert.equal(db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get(), before, "the dry run adds nothing");
    assert.equal((await call("/candidates/approve", { ids: [ids.acme, ids.quiet], confirm: true, expectIds: [ids.acme, ids.quiet] })).status, 409);
    const ok = await call("/candidates/approve", { ids: [ids.acme, ids.quiet], confirm: true, expectIds: [ids.acme] });
    assert.equal(ok.status, 200);
    assert.deepEqual(backups, ["pre-d82-candidates"]);
    const added = db.prepare("SELECT company, evidence FROM company_ats_list WHERE ats_slug = 'acme'").get();
    assert.match(added.evidence, /^hn 2026-10, 2 month\(s\) hiring; candidate #\d+; probe \d{4}-\d{2}-\d{2}: 5 in-scope <= 120d of 6/);
    assert.equal(db.prepare("SELECT status FROM company_candidates WHERE id = ?").pluck().get(ids.acme), "added");
    await call("/candidates/reject", { ids: [ids.nope] });
    const list = await call("/candidates");
    assert.equal(list.body.counts.rejected, 1);
    assert.equal(list.body.discovery.paused, false);
  } finally { server.close(); }
});

test("Admin draws the Candidates table, status as a mark (D60), behind the existing Companies card", () => {
  const ops = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(ops, /<DiscoveryCandidates theme=\{theme\} onAdded=\{load\}\/>/);
  assert.match(ops, /render: r => <span style=\{markStyle\(CANDIDATE_TONE\[r\.status\] \|\| C\.INK_FAINT\)\}>\{r\.status\}<\/span>/);
  assert.match(ops, /expectIds: dry\.eligible\.map\(e => e\.id\)/, "Approve confirms exactly what the dry run listed");
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /cron\.schedule\("0 6 \* \* 1", \(\) => \{\r?\n  runHnDiscovery\(db\)/, "HN weekly");
  assert.match(server, /cron\.schedule\("30 6 \* \* \*", \(\) => \{\r?\n  runCandidateProbe\(db\)/, "the probe nightly");
});
