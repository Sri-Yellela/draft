import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import axios from "axios";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createSlugHarvestRouter } from "../routes/slugHarvest.js";
import { createCompaniesRouter } from "../routes/companies.js";
import { validateBoard, descriptionCoverage } from "../services/companyList.js";
import { googleJobs } from "../services/jobs/sources/serpapi.js";
import {
  harvestPairOf, poolFromResults, planSweep, serpSearch, familyConversion, HARVEST_QUERIES, DAILY_SEARCH_CAP, EXHAUSTED_AFTER,
} from "../services/slugHarvest.js";

// D20 — the slug harvest in the daily manual sweep. The searches are D4's twenty real SerpApi
// responses (trimmed to their links: test/fixtures/serpapiD20), so no search is spent here; the ATS
// boards are fake fetchers, so no board is contacted.
const TWENTY = JSON.parse(fs.readFileSync(new URL("./fixtures/serpapiD20/twentySearches.json", import.meta.url), "utf8"));
const byQuery = new Map(TWENTY.map(d => [d.search_parameters.q, d]));
const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const described = { title: "Engineer", location: "Austin, TX", description: "Build things in Austin, TX.", url: "https://x/1", company: "Acme" };
const liveFetcher = async () => [described];
const fetchersAll = Object.fromEntries(["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee", "workday"].map(t => [t, liveFetcher]));

function mount({ search, account = async () => ({ left: 200 }), validate, fetchers = fetchersAll } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const calls = [];
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => { req.user = { id: 7 }; next(); });
  const s = search || (async q => { calls.push(q); return byQuery.get(q) || { jobs_results: [] }; });
  app.use("/h", createSlugHarvestRouter(db, (_q, _s, n) => n(), { search: s, account, validate, fetchers, configured: () => true }));
  app.use("/c", createCompaniesRouter(db, (_q, _s, n) => n(), { fetchers }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body, raw = false) => fetch(base + path, { method,
    headers: { "content-type": raw ? "application/x-ndjson" : "application/json" },
    body: body == null ? undefined : raw ? body : JSON.stringify(body) })
    .then(async r => { const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; } return { status: r.status, body: b }; });
  return { db, calls, call, stop: () => server.close() };
}

async function waitSweep(s, id) {
  for (let i = 0; i < 200; i++) {
    const r = await s.call("GET", `/h/sweeps/${id}`);
    if (r.body.finished_at) return r.body;
    await new Promise(res => setTimeout(res, 10));
  }
  throw new Error("sweep never finished");
}

async function sweep(s, queries = null) {
  const dry = await s.call("POST", "/h/sweep", { queries });
  const go = await s.call("POST", "/h/sweep", { queries, confirm: true, expectQueries: dry.body.expectQueries });
  assert.equal(go.status, 202, JSON.stringify(go.body));
  return waitSweep(s, go.body.sweepId);
}

test("D4's twenty searches pool to the 40 crawlable pairs and 10 adapter-less ones the yield doc reports", () => {
  const pairs = new Map(); const unsupported = {}; let links = 0, atsLinks = 0;
  for (const d of TWENTY) {
    const r = poolFromResults(d);
    links += r.links; atsLinks += r.atsLinks;
    for (const [k, p] of r.pairs) pairs.set(k, p);
    for (const [v, n] of Object.entries(r.unsupported)) unsupported[v] = (unsupported[v] || 0) + n;
  }
  const by = {};
  for (const p of pairs.values()) by[p.atsType] = (by[p.atsType] || 0) + 1;
  assert.deepEqual([links, atsLinks, pairs.size], [1031, 52, 40]);
  assert.deepEqual(by, { workday: 25, ashby: 9, smartrecruiters: 3, lever: 1, workable: 1, recruitee: 1 });
  assert.equal(Object.values(unsupported).reduce((a, b) => a + b, 0), 10, "icims 4, jazzhr 2, oracle, eightfold, gem, pinpoint");
  assert.ok(pairs.has("ashby:coder") && pairs.has("workday:5|westernalliancebank|wab"));
});

test("URLs → pairs: Workday keeps its site (and its case) past a locale, the myworkdaysite and Greenhouse embed forms parse", () => {
  assert.deepEqual(harvestPairOf("https://boeing.wd1.myworkdayjobs.com/en-US/EXTERNAL_CAREERS/job/Seattle/X_123"), { atsType: "workday", slug: "1|boeing|EXTERNAL_CAREERS" });
  assert.deepEqual(harvestPairOf("https://wd3.myworkdaysite.com/recruiting/Acme/Careers/job/1"), { atsType: "workday", slug: "3|acme|Careers" });
  assert.deepEqual(harvestPairOf("https://boards.greenhouse.io/embed/job_app?for=anduril&token=1"), { atsType: "greenhouse", slug: "anduril" });
  assert.deepEqual(harvestPairOf("https://jobs.ashbyhq.com/coder/0f6b1c2e-1111-2222-3333-444455556666"), { atsType: "ashby", slug: "coder" });
  assert.deepEqual(harvestPairOf("https://careers-lmi.icims.com/jobs/1/job"), { unsupported: "icims" });
  assert.equal(harvestPairOf("https://www.linkedin.com/jobs/view/1"), null);
  assert.equal(harvestPairOf("not a url"), null);
});

test("⛔ a pool, never a pairing: nothing records which job a slug was found under", () => {
  const r = poolFromResults(TWENTY[0]);
  for (const p of r.pairs.values()) assert.deepEqual(Object.keys(p).sort(), ["atsType", "slug", "url"]);
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const cols = db.prepare("SELECT name FROM pragma_table_info('slug_harvest_pool')").pluck().all();
  for (const c of cols) assert.doesNotMatch(c, /job|title|employer/, `slug_harvest_pool.${c} would attach a slug to a job`);
});

test("SerpApi is pinned to hl=en, gl=us, United States — and never sends the chips/num/start that came back empty", async () => {
  const savedGet = axios.get;
  let seen = null;
  axios.get = async (url, opts) => { seen = { url, params: opts?.params }; return { data: { jobs_results: [] } }; };
  try { await serpSearch("data engineer"); } finally { axios.get = savedGet; }
  assert.equal(seen.url, "https://serpapi.com/search");
  assert.deepEqual([seen.params.engine, seen.params.hl, seen.params.gl, seen.params.location, seen.params.q],
                   ["google_jobs", "en", "us", "United States", "data engineer"]);
  for (const k of ["chips", "num", "start"]) assert.equal(seen.params[k], undefined, k);
  // The pin cannot be overridden by a caller.
  axios.get = async (url, opts) => { seen = { url, params: opts?.params }; return { data: {} }; };
  try { await googleJobs({ q: "x", hl: "es-419", gl: "mx" }); } finally { axios.get = savedGet; }
  assert.deepEqual([seen.params.hl, seen.params.gl], ["en", "us"]);
});

test("⛔ D17: the harvest makes no model call and nothing schedules it", () => {
  for (const f of ["services/slugHarvest.js", "routes/slugHarvest.js"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");   // the comments say "no cron"
    assert.doesNotMatch(code, /anthropic|openai|groq|messages\.create|setInterval|cron/i, `${f} must stay deterministic and manual`);
  }
});

test("a sweep is dry first, spends exactly the searches the operator saw, and pools what is new", async () => {
  const s = mount();
  try {
    const dry = await s.call("POST", "/h/sweep", {});
    assert.equal(dry.body.dryRun, true);
    assert.equal(dry.body.expectQueries.length, DAILY_SEARCH_CAP);
    assert.equal(s.calls.length, 0, "a dry run searches nothing");
    const wrong = await s.call("POST", "/h/sweep", { confirm: true, expectQueries: ["software engineer"] });
    assert.equal(wrong.status, 409);
    assert.equal(s.calls.length, 0);
    const done = await sweep(s);
    assert.deepEqual(s.calls, dry.body.expectQueries);
    assert.equal(done.searches, DAILY_SEARCH_CAP);
    assert.ok(done.new_pairs > 0);
    assert.equal(s.db.prepare("SELECT COUNT(*) FROM slug_harvest_pool").pluck().get(), done.new_pairs);
    assert.equal(s.db.prepare("SELECT COUNT(*) FROM slug_harvest_pool WHERE state = 'live'").pluck().get(), done.new_pairs, "every new pair validated");
    assert.ok(done.queries.every(q => q.language === "en/us"));
    // Today's cap is spent: the next plan searches nothing.
    const after = await s.call("POST", "/h/sweep", {});
    assert.deepEqual([after.body.expectQueries.length, after.body.plan.remainingToday], [0, 0]);
    assert.equal((await s.call("POST", "/h/sweep", { confirm: true, expectQueries: [] })).status, 409);
  } finally { s.stop(); }
});

test("⚠ the quota is read before any search: unreadable refuses, too few left refuses", async () => {
  const a = mount({ account: async () => { throw Object.assign(new Error("x"), { response: { status: 401 } }); } });
  const b = mount({ account: async () => ({ left: 3 }) });
  try {
    for (const [s, code] of [[a, 503], [b, 409]]) {
      const dry = await s.call("POST", "/h/sweep", {});
      const go = await s.call("POST", "/h/sweep", { confirm: true, expectQueries: dry.body.expectQueries });
      assert.equal(go.status, code);
      assert.equal(s.calls.length, 0, "no search was spent");
      assert.equal(s.db.prepare("SELECT COUNT(*) FROM slug_harvest_sweeps").pluck().get(), 0);
    }
  } finally { a.stop(); b.stop(); }
});

test("a failed search stops the sweep — the rest are not spent", async () => {
  const seen = [];
  const s = mount({ search: async q => { seen.push(q); if (seen.length === 2) throw Object.assign(new Error("x"), { response: { status: 429 } }); return byQuery.get(q); } });
  try {
    const done = await sweep(s);
    assert.equal(seen.length, 2);
    assert.equal(done.searches, 1);
    assert.match(done.error, /429.*not spent/);
  } finally { s.stop(); }
});

test("⛔ the stopping rule: a family whose last searches found nothing new leaves the default plan", async () => {
  const s = mount({ search: async () => ({ jobs_results: [] }) });
  try {
    const hr = HARVEST_QUERIES.filter(x => x.family === "hr").map(x => x.q);
    for (let i = 0; i < EXHAUSTED_AFTER; i++) {
      await sweep(s, hr);
      s.db.prepare("UPDATE slug_harvest_sweeps SET started_at = started_at - 86400 * 2").run();   // yesterday's sweeps
    }
    const fam = familyConversion(s.db).find(f => f.family === "hr");
    assert.deepEqual([fam.searches, fam.newPairs, fam.exhausted], [EXHAUSTED_AFTER, 0, true]);
    const plan = planSweep(s.db);
    assert.ok(!plan.queries.some(q => q.family === "hr"));
    assert.ok(plan.skipped.some(x => x.family === "hr" && /found nothing new/.test(x.reason)));
    assert.ok(plan.queries.length === DAILY_SEARCH_CAP, "the cap is spent on families still converting");
  } finally { s.stop(); }
});

test("a configured company is never pooled — including a Workday tenant under another site", async () => {
  const s = mount();
  try {
    s.db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Coder','ashby','coder',1), ('WAB','workday','5|westernalliancebank|other',0)").run();
    await sweep(s, ["software engineer"]);
    const keys = s.db.prepare("SELECT ats_type || ':' || slug_key FROM slug_harvest_pool").pluck().all();
    assert.ok(!keys.includes("ashby:coder"));
    assert.ok(!keys.some(k => k.includes("westernalliancebank")));
  } finally { s.stop(); }
});

test("⛔ never enable at 0% description coverage — unless the detail fetch reaches the text", async () => {
  const bare = async () => [{ title: "Engineer", location: "Austin, TX", description: null, url: "https://x/1" }];
  const gh = await validateBoard({ atsType: "greenhouse", slug: "acme", fetchers: { greenhouse: bare }, describe: async () => ({ ok: true }) });
  assert.deepEqual([gh.ok, gh.state], [false, "no_descriptions"], "greenhouse has no detail fetch to fall back on");
  const srDead = await validateBoard({ atsType: "smartrecruiters", slug: "Acme", fetchers: { smartrecruiters: bare }, describe: async () => ({ ok: false }) });
  assert.equal(srDead.state, "no_descriptions");
  const srOk = await validateBoard({ atsType: "smartrecruiters", slug: "Acme", fetchers: { smartrecruiters: bare }, describe: async () => ({ ok: true }) });
  assert.deepEqual([srOk.ok, srOk.state, srOk.descriptions.reachable], [true, "live", 1]);
  assert.equal((await descriptionCoverage([described], "greenhouse")).inline, 1);
  // The admin add-company route inherits it.
  const s = mount({ fetchers: { greenhouse: bare } });
  try {
    const r = await s.call("POST", "/c", { company: "Acme", atsType: "greenhouse", slug: "acme", confirm: true, expectState: "live" });
    assert.equal(r.status, 409);
    assert.equal(r.body.validation.state, "no_descriptions");
  } finally { s.stop(); }
});

test("export → review → import: dry first, whole file or nothing, idempotent, audited", async () => {
  const s = mount();
  try {
    await sweep(s, ["product manager"]);
    const exp = await s.call("GET", "/h/export");
    const lines = exp.body.trim().split("\n").map(l => JSON.parse(l));
    assert.equal(lines[0]._meta.format, "draft.slug-harvest.v1");
    const rows = lines.slice(1);
    assert.ok(rows.length >= 3 && rows.every(r => r.decision === null && r.exported_state === "live"));
    rows[0].decision = "add"; rows[0].company = "First Co";
    rows[1].decision = "skip";
    const file = [lines[0], ...rows].map(l => JSON.stringify(l)).join("\n");

    const companies = () => s.db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get();
    const before = companies();
    const dry = await s.call("POST", "/h/import", file, true);
    assert.deepEqual([dry.body.dryRun, dry.body.plan.wouldAdd, dry.body.plan.wouldSkip, dry.body.plan.expectWrites], [true, 1, 1, 2]);
    assert.equal(companies(), before, "a dry run writes nothing");
    assert.equal((await s.call("POST", "/h/import", { jsonl: file, apply: true, expectWrites: 5 })).status, 409, "the apply names the dry run's count");
    const ok = await s.call("POST", "/h/import", { jsonl: file, apply: true, expectWrites: 2 });
    assert.deepEqual([ok.body.applied, ok.body.written, ok.body.companiesAdded], [true, 2, 1]);
    assert.equal(companies(), before + 1);
    const added = s.db.prepare("SELECT * FROM company_ats_list WHERE company = 'First Co'").get();
    assert.equal(added.active, 1);
    assert.equal(s.db.prepare("SELECT action FROM admin_audit_log ORDER BY id DESC LIMIT 1").pluck().get(), "company_add");

    // Idempotent: the same file again changes nothing and opens no import.
    const again = await s.call("POST", "/h/import", { jsonl: file, apply: true, expectWrites: 0 });
    assert.deepEqual([again.body.applied, again.body.written, again.body.plan.unchanged], [true, 0, 2]);
    assert.equal(s.db.prepare("SELECT COUNT(*) FROM slug_harvest_imports").pluck().get(), 1);
    // Exported again, the decided pairs are gone from the review file.
    const exp2 = (await s.call("GET", "/h/export?format=json")).body;
    assert.equal(exp2.rows.length, rows.length - 2);
  } finally { s.stop(); }
});

test("the import guards: invalid value, unknown pair, concurrency, stale — and one bad row writes nothing", async () => {
  let state = "live";
  const s = mount({ validate: async () => (state === "live"
    ? { ok: true, state: "live", jobs: 1, us: 1, sample: [], descriptions: { note: "1 of 1 inline" } }
    : { ok: true, state: "empty", jobs: 0, us: 0, sample: [] }) });
  try {
    await sweep(s, ["data analyst"]);
    const { meta, rows } = (await s.call("GET", "/h/export?format=json")).body;
    const file = rs => [meta, ...rs].map(l => JSON.stringify(l)).join("\n");
    const [a, b, c] = rows;
    const cases = [
      [{ ...a, decision: "maybe" }, "invalid_value"],
      [{ ...a, decision: "add", company: "" }, "invalid_value"],
      [{ ...a, decision: "add", company: "A", ats_type: "ashby", slug: "never-harvested" }, "unknown_pair"],
    ];
    for (const [row, kind] of cases) {
      const r = await s.call("POST", "/h/import", { jsonl: file([row, { ...b, decision: "skip" }]), apply: true, expectWrites: 2 });
      assert.equal(r.status, 422, kind);
      assert.equal(r.body.plan.rejected[0].kind, kind);
    }
    assert.equal(s.db.prepare("SELECT COUNT(*) FROM slug_harvest_pool WHERE decision IS NOT NULL").pluck().get(), 0, "whole file or nothing");
    assert.equal((await s.call("POST", "/h/import", { jsonl: JSON.stringify({ ...a, decision: "skip" }) })).body.plan.rejected[0].kind, "invalid_value", "no _meta line");

    // concurrency: configured by someone else since the export.
    s.db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active) VALUES ('Taken', ?, ?, 1)").run(a.ats_type, a.slug);
    const taken = await s.call("POST", "/h/import", { jsonl: file([{ ...a, decision: "add", company: "Taken" }]) });
    assert.deepEqual([taken.body.plan.rejected[0].kind, taken.body.plan.rejected[0].now], ["concurrency", "configured"]);
    // concurrency: decided "skip" by an import, then a file says "add".
    await s.call("POST", "/h/import", { jsonl: file([{ ...b, decision: "skip" }]), apply: true, expectWrites: 1 });
    const flip = await s.call("POST", "/h/import", { jsonl: file([{ ...b, decision: "add", company: "B" }]) });
    assert.deepEqual([flip.body.plan.rejected[0].kind, flip.body.plan.rejected[0].now], ["concurrency", "skip"]);
    // stale: the board changed between the export and the import.
    state = "empty";
    const stale = await s.call("POST", "/h/import", { jsonl: file([{ ...c, decision: "add", company: "C" }]) });
    assert.equal(stale.body.plan.rejected[0].kind, "stale");
    assert.match(stale.body.plan.rejected[0].error, /exported as "live", the board now reads "empty"/);
  } finally { s.stop(); }
});

test("revert is dry first, disables (never deletes) what the import added, and puts the pairs back", async () => {
  const s = mount();
  try {
    await sweep(s, ["account executive"]);
    const { meta, rows } = (await s.call("GET", "/h/export?format=json")).body;
    const file = [meta, { ...rows[0], decision: "add", company: "Rev Co" }, { ...rows[1], decision: "skip" }].map(l => JSON.stringify(l)).join("\n");
    const imp = await s.call("POST", "/h/import", { jsonl: file, apply: true, expectWrites: 2 });
    const id = imp.body.importId;
    const dry = await s.call("POST", `/h/imports/${id}/revert`, {});
    assert.deepEqual([dry.body.dryRun, dry.body.restorable, dry.body.pairs.length], [true, 2, 2]);
    assert.match(dry.body.pairs.find(p => p.now.decision === "add").after.company, /Rev Co \(disabled\)/);
    assert.equal(s.db.prepare("SELECT active FROM company_ats_list WHERE company = 'Rev Co'").pluck().get(), 1, "dry run changes nothing");
    assert.equal((await s.call("POST", `/h/imports/${id}/revert`, { apply: true, expectRestorable: 9 })).status, 409);
    const done = await s.call("POST", `/h/imports/${id}/revert`, { apply: true, expectRestorable: 2 });
    assert.deepEqual([done.body.restored, done.body.companiesDisabled], [2, 1]);
    assert.equal(s.db.prepare("SELECT active FROM company_ats_list WHERE company = 'Rev Co'").pluck().get(), 0, "disabled, still there");
    assert.equal(s.db.prepare("SELECT COUNT(*) FROM slug_harvest_pool WHERE decision IS NOT NULL").pluck().get(), 0);
    assert.equal((await s.call("POST", `/h/imports/${id}/revert`, { apply: true, expectRestorable: 0 })).status, 409, "once only");
    // Re-adding after a revert re-enables the same company row rather than duplicating it.
    const again = await s.call("POST", "/h/import", { jsonl: [meta, { ...rows[0], decision: "add", company: "Rev Co" }].map(l => JSON.stringify(l)).join("\n"), apply: true, expectWrites: 1 });
    assert.equal(again.body.companiesAdded, 1);
    assert.deepEqual(s.db.prepare("SELECT COUNT(*) n, MAX(active) a FROM company_ats_list WHERE company = 'Rev Co'").get(), { n: 1, a: 1 });
  } finally { s.stop(); }
});

test("the harvest is mounted admin-only and the admin panel carries it", () => {
  const server = read("server.js");
  assert.match(server, /app\.use\("\/api\/admin\/slug-harvest", requireAdmin, createSlugHarvestRouter\(db, requireAdmin\)\)/);
  const ui = read("client/src/panels/adminOps.jsx");
  assert.match(ui, /export function SlugHarvestSection/);
  assert.match(ui, /<SlugHarvestSection theme=\{theme\}\/>/);
});
