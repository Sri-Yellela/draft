// ⭐ D187 HB-INFRA · HB-1 (the client), HB-2 (the spend guard), HB-3 (the tables), HB-4 (the mapper) — ALL OFFLINE.
// d171's rule: tests never call the live API. The fixture is the Search API reference's own example job
// (docs/research/hirebase-api.md) plus edge cases.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import { createHirebaseClient, createRateLimiter, hirebaseConfig, readUsageHeaders, HirebaseQuotaError, HirebaseRefusedError } from "../services/hirebase/client.js";
import { checkSpend, usedSoFar, MONTH_CAP_KEY } from "../services/hirebase/spendGuard.js";
import { mapHirebaseJob, normalizeHirebaseJob, salaryPeriodOf, sanitizeHirebaseJob } from "../services/hirebase/mapJob.js";
import { setSetting } from "../services/appSettings.js";

const EXAMPLE = {"_id": "6a2f14a48bea0df96e26ac7b", "company_name": "CompanyXYZ", "job_title": "Senior Python Engineer", "job_title_raw": "Senior Python Engineer - Remote", "description": "<p>… cleaned/summarized description …</p>", "application_link": "https://jobs.workable.com/view/nqSdYtJwQ/...", "job_categories": ["Software Engineer Jobs", "Engineering Jobs", "Information Technology Jobs"], "job_type": "Full Time", "location_type": "Remote", "location_raw": "TELECOMMUTE; British Columbia, Canada", "locations": [{"city": null, "region": null, "country": "Canada", "coordinates": {"type": "Point", "coordinates": [-123.12, 49.28]}, "bbox": [-123.2, 49.0, -122.9, 49.3], "address": "British Columbia, Canada"}], "salary_range": {"min": 150000, "max": 210000, "currency": "USD", "period": "yearly"}, "yoe_range": {"min": 2, "max": 5}, "experience_level": "Senior", "education_level": "Bachelor's degree", "skills": ["Python", "FastAPI", "Distributed systems"], "technologies": ["Python", "PostgreSQL", "AWS"], "benefits": ["401k matching", "Remote-first", "Equity"], "requirements_summary": "5+ years Python; distributed systems experience", "team": "Platform Engineering", "language": "en", "visa_sponsored": false, "recruiter_agency": false, "offers_equity": false, "date_posted": "2026-06-07", "job_board": "workable", "job_board_link": "https://jobs.workable.com/company/...", "job_slug": "senior-python-engineer-17", "company_slug": "companyxyz", "company_link": "companyxyz.com", "company_logo": "https://logos.hirebase.org/.../companyxyz-320x320-q95.jpg", "md5_hash": "d6b5d4e7b99d23b082b46e49c22c168f", "platform_job_id": "ad88b6ba-a905-4850-ad79-73beb0e97766", "coolness_score": 6.4, "flexibility_score": 6.1, "compensation_value_score": 6.0, "benefits_score": 5.0, "impact_autonomy_score": 7.1, "prestige_score": 5.2, "growth_score": 6.2, "meta_completeness": false, "company_data": {"description_summary": "CompanyXYZ builds …", "linkedin_link": "https://www.linkedin.com/company/companyxyz", "size_range": {"min": 51, "max": 200}, "industries": ["Tech, Software & IT Services"], "subindustries": ["AI & ML"], "services": ["Platform", "APIs"], "type": "Startup", "is_recruiting_agency": false, "is_3rd_party_agency": false}};

function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const ENV_LIVE = { HIREBASE_KEY: "k-test", HIREBASE_ENABLED: "1", HIREBASE_DRY_RUN: "0" };
const quiet = { log() {}, warn() {}, error() {} };
const res = (status, json, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])), text: async () => JSON.stringify(json) });

test("HB-3: migration 270 is byte-identical in both runners and only ADDS", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "270_hirebase_ingestion"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  const sql = block("server.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE)\b/);
  const db = fixtureDb();
  for (const t of ["hirebase_raw", "hirebase_runs", "hirebase_usage"]) assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE name = ?").get(t), t);
  const cols = db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name);
  for (const c of ["source_id", "platform_job_id", "first_ingested"]) assert.ok(cols.includes(c), c);
});

test("hbDryRunSendsNothing: OFF and DRY-RUN by default; a dry run returns the exact request, fetch never called", async () => {
  assert.deepEqual(hirebaseConfig({}), { key: null, enabled: false, dryRun: true });
  let calls = 0;
  const fetchImpl = async () => { calls++; return res(200, { jobs: [] }); };
  for (const env of [{}, { HIREBASE_KEY: "k", HIREBASE_ENABLED: "1" }]) {
    const c = createHirebaseClient({ db: fixtureDb(), fetchImpl, env, log: quiet });
    const r = await c.search({ job_category: ["Software Engineer Jobs"], limit: 100 });
    assert.equal(r.dryRun, true); assert.equal(r.maxUnits, 100);
    assert.equal(r.request.url, "https://api.hirebase.org/v2/jobs/search");
    assert.deepEqual(r.request.body.job_category, ["Software Engineer Jobs"]);
  }
  assert.equal(calls, 0);
});

test("hbSpendGuardRefusesOverCap: a request that would cross the month or the day is refused BEFORE it is sent; free calls pass", async () => {
  const db = fixtureDb();
  assert.equal(checkSpend(db, 100).ok, true);
  db.prepare("INSERT INTO hirebase_usage (day, meter, units) VALUES (?, 'm_jobs_api_calls', 450)").run(new Date().toISOString().slice(0, 10).slice(0, 8) + "01");
  assert.equal(checkSpend(db, 100).reason, "month_cap", "450 + 100 > 500 (Free)");
  assert.equal(checkSpend(db, 0).ok, true, "the estimate and the expired feed cost nothing");
  setSetting(db, MONTH_CAP_KEY, "25000");
  assert.equal(checkSpend(db, 100).ok, true);
  // Hirebase's own Included-Used wins over our sum when it is higher (their meter is the truth)
  db.prepare("INSERT INTO hirebase_usage (day, meter, units, included_used, period_end, updated_at) VALUES ('2099-01-01', 'm_jobs_api_calls', 0, 24950, '2999-01-01T00:00:00Z', 9999999999)").run();
  assert.equal(usedSoFar(db).fromHeaders, true);
  assert.equal(checkSpend(db, 100).reason, "month_cap");
  let calls = 0;
  const c = createHirebaseClient({ db, fetchImpl: async () => { calls++; return res(200, {}); }, env: ENV_LIVE, log: quiet });
  await assert.rejects(c.search({ limit: 100 }), (e) => e instanceof HirebaseRefusedError && e.code === "month_cap");
  assert.equal(calls, 0);
});

test("hbTellsQuotaFromRateLimit: Retry-After waits and retries; X-Billing-Code limit_exceeded stops, never retried", async () => {
  const slept = [];
  const sleep = async (ms) => { slept.push(ms); };
  let n = 0;
  const rateThenOk = async () => (++n === 1 ? res(429, { detail: "Rate limit exceeded. Try again in 2s." }, { "Retry-After": 2 })
    : res(200, { jobs: [EXAMPLE], total_count: 1 }, { "Hirebase-Usage-Meter": "m_jobs_api_calls", "Hirebase-Usage-Included-Used": 1, "Hirebase-Usage-Included-Limit": 500 }));
  const db = fixtureDb();
  const c = createHirebaseClient({ db, fetchImpl: rateThenOk, env: ENV_LIVE, sleep, log: quiet });
  const r = await c.search({ limit: 1 });
  assert.equal(r.units, 1); assert.equal(n, 2); assert.ok(slept.some(ms => ms >= 2000));
  assert.equal(db.prepare("SELECT included_used FROM hirebase_usage").pluck().get(), 1, "the usage headers are recorded");
  let q = 0;
  const quota = async () => { q++; return res(429, { detail: "You've reached your plan's included usage of 500 for this period." }, { "X-Billing-Code": "limit_exceeded", "Retry-After": 1 }); };
  const c2 = createHirebaseClient({ db: fixtureDb(), fetchImpl: quota, env: ENV_LIVE, sleep, log: quiet });
  await assert.rejects(c2.search({ limit: 1 }), (e) => e instanceof HirebaseQuotaError);
  assert.equal(q, 1, "a quota 429 is never retried, even with a Retry-After");
});

test("hbClientRateLimit: never more than 100 requests in any 60 s window", async () => {
  let t = 0; const sleeps = [];
  const lim = createRateLimiter({ now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
  for (let i = 0; i < 100; i++) await lim.take();
  assert.equal(sleeps.length, 0);
  await lim.take();
  assert.ok(t >= 60_000, "the 101st waits for the window");
  assert.ok(lim.inWindow() <= 100);
});

test("readUsageHeaders: every Hirebase-Usage-* header read; an un-metered response is null", () => {
  const h = new Map([["hirebase-usage-meter", "m_jobs_api_calls"], ["hirebase-usage-included-limit", "500"], ["hirebase-usage-included-used", "37"],
    ["hirebase-usage-included-remaining", "463"], ["hirebase-usage-overage-mode", "block"]]);
  assert.deepEqual(readUsageHeaders(h), { meter: "m_jobs_api_calls", includedLimit: 500, includedUsed: 37, includedRemaining: 463, overageUsed: null,
    overageMode: "block", periodStart: null, periodEnd: null });
  assert.equal(readUsageHeaders(new Map()), null);
});

test("hbContactFieldsNeverStored: contact_email / contact_phone and the *_score ratings are dropped before storing", () => {
  const withContact = { ...EXAMPLE, contact_email: "hm@example.com", contact_phone: "+1 555 0100" };
  const raw = sanitizeHirebaseJob(withContact);
  assert.equal("contact_email" in raw, false); assert.equal("contact_phone" in raw, false);
  assert.equal(Object.keys(raw).some(k => /_score$/.test(k)), false);
  const m = mapHirebaseJob(withContact);
  assert.doesNotMatch(JSON.stringify(m), /hm@example\.com|555 0100|coolness_score/);
});

test("hbMapperFields: the docs' example job → normalizeJob's contract, every location, the raw description, salary periods", () => {
  const { posting, extras } = normalizeHirebaseJob({ ...EXAMPLE, description_raw: "<h2>About</h2><p>Full ATS text with <b>Kubernetes</b>.</p>",
    locations: [...EXAMPLE.locations, { city: "Seattle", region: "Washington", country: "United States" }] });
  assert.equal(posting.id, "hirebase::6a2f14a48bea0df96e26ac7b");
  assert.equal(posting.source, "hirebase");
  assert.equal(posting.title, "Senior Python Engineer"); assert.equal(posting.company, "CompanyXYZ");
  assert.equal(posting.url, EXAMPLE.application_link);
  assert.match(posting.description, /Full ATS text with Kubernetes/, "description_raw, not the summary");
  assert.equal(posting.workplace_type, "remote");
  assert.equal(posting.salary_period, "annual"); assert.equal(posting.salary_min, 150000);
  assert.deepEqual(extras.locations, ["Canada", "Seattle, Washington"], "every location, not only the first");
  assert.equal(extras.platform_job_id, "ad88b6ba-a905-4850-ad79-73beb0e97766");
  assert.equal(extras.job_board, "workable"); assert.equal(extras.team, "Platform Engineering");
  assert.equal(extras.company.domain, "companyxyz.com"); assert.equal(extras.company.sizeRange.min, 51);
  assert.equal(extras.hints.experience_level, "Senior", "a hint — draft's level read decides");
  for (const [p, want] of [["year", "annual"], ["yearly", "annual"], ["hour", "hourly"], ["hourly", "hourly"], ["monthly", "monthly"], ["daily", null], [null, null]]) {
    assert.equal(salaryPeriodOf(p), want, String(p));
  }
  // the summary when no raw description was asked for; an incomplete listing is not landed
  assert.match(mapHirebaseJob(EXAMPLE).input.description, /cleaned\/summarized description/);
  assert.equal(mapHirebaseJob({ ...EXAMPLE, application_link: "" }), null);
});

test("hbAllCallsThroughGuard + hbNoLiveCallInTests: only the client names Hirebase's API, and no test sends to it", () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.name === "node_modules" || e.name.startsWith(".") ? []
    : e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(m?js|jsx)$/.test(e.name) ? [path.join(dir, e.name)] : []);
  const files = [...walk("services"), ...walk("routes"), ...walk("scripts"), "server.js"];
  const naming = files.filter(f => /api\.hirebase\.org/.test(fs.readFileSync(f, "utf8"))).map(f => f.replace(/\\/g, "/"));
  assert.deepEqual(naming, ["services/hirebase/client.js"], "every Hirebase request goes through the one client (and its guard)");
  const client = fs.readFileSync("services/hirebase/client.js", "utf8");
  assert.ok(at(client, "const guard = checkSpend(db, maxUnits);") < at(client, "await fetchImpl(url"), "the guard runs before any send");
  for (const f of fs.readdirSync("test").filter(n => /^hb.*\.test\.js$/.test(n))) {
    assert.doesNotMatch(fs.readFileSync(path.join("test", f), "utf8"), /globalThis\.fetch|fetchImpl:\s*fetch\b/, `${f} never hands the client a real fetch`);
  }
});
