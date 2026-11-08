// D41 (owner, 10-06) — THE CAPTURED JOB: not findable, no salary, no logo.
//
// Found 10-06 from the code (production reads were refused by the permission layer, so the owner's
// own capture — ashby/hims-and-hers — was not looked up by job_id):
//   (a) a capture with no POSITIVE US evidence was inserted, HELD by the US-only gate (is_active = 0)
//       and auto-STARRED — so it sat in ★ and was absent from ALL, which is exactly what the owner saw.
//       ALL now admits the user's own rows whatever the discovery scope, and a capture no longer stars.
//   (b) the capture path read the extractor's `Salary:` line and dropped it; the JSON-LD read ignored
//       `baseSalary`; Ashby's parser read only summaryComponents. All three now read the stated pay.
//   (c) a captured company's logo waited for the 6-hourly pass; it is queued at capture time, from the
//       employer's own site when the page names it, never from the ATS host.
//   (d) no US evidence → no capture: refused before any write, with one of two messages.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importJob, jobFromHtml, jobFromLabelledText } from "../services/jobs/importJob.js";
import { captureMarket, usEvidenceInText } from "../services/jobs/usLocation.js";
import { parseSalaryText, salaryFromJsonLd } from "../services/jobs/salaryText.js";
import { recentCaptures, REFUSAL_MESSAGES } from "../services/jobs/captureOutcome.js";
import { candidateDomains } from "../services/jobs/companyLogoStore.js";
import { at } from "../test-support/sourceAnchors.js";

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active)
             VALUES (7,1,'Current','engineering','general',1)`).run();
  return d;
}
const block = ({ location, salary = null, body = "Build the platform." }) =>
  [`Title: Platform Engineer`, `Company: Northwind`, `Location: ${location}`, ...(salary ? [`Salary: ${salary}`] : []), ``, body].join("\n");
const capture = (d, opts, n = 1) =>
  importJob({ url: `https://northwind.example.com/careers/platform-${n}`, text: block(opts) }, { db: d, userId: 1 });
const counts = (d) => ({
  jobs: d.prepare("SELECT COUNT(*) AS n FROM scraped_jobs").get().n,
  userJobs: d.prepare("SELECT COUNT(*) AS n FROM user_jobs").get().n,
});

// ── (d) no US evidence → no capture ─────────────────────────────────────────────────────────────

test("D41(d) · a NON-US page is refused — 'based outside the US' — and ZERO rows are written", async () => {
  const d = db();
  await assert.rejects(capture(d, { location: "London, United Kingdom" }),
    (e) => e.name === "ImportRefusedError" && e.kind === "non_us" && e.message === REFUSAL_MESSAGES.non_us);
  assert.deepEqual(counts(d), { jobs: 0, userJobs: 0 });
  const rec = d.prepare("SELECT * FROM job_captures").all();
  assert.equal(rec.length, 1, "the attempt is recorded so the owner can see what was turned away");
  assert.equal(rec[0].action, "refused_not_us");
  assert.match(rec[0].job_id, /^refused:[0-9a-f]{16}:non_us_location$/, "a placeholder no join can mistake for a posting");
  // …and visible, worded, in the user's recent captures.
  const [recent] = recentCaptures(d, 1, 5);
  assert.equal(recent.outcome, "refused");
  assert.equal(recent.message, REFUSAL_MESSAGES.non_us);
  d.close();
});

test("D41(d) · a bare-'Remote' page with NO evidence is refused with the OTHER message — never 'outside the US'", async () => {
  const d = db();
  await assert.rejects(capture(d, { location: "Remote" }),
    (e) => e.kind === "unconfirmed" && e.message === REFUSAL_MESSAGES.unconfirmed && !/outside the US/.test(e.message));
  assert.deepEqual(counts(d), { jobs: 0, userJobs: 0 });
  d.close();
});

test("D41(d) · a bare-'Remote' page WITH a USD range is accepted — the page is evidence a crawl never had", async () => {
  const d = db();
  const r = await capture(d, { location: "Remote", salary: "$150,000 – $180,000 USD" });
  const row = d.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(r.job.id);
  assert.equal(row.is_active, 1, "admitted by the page, so the location-only gate must not hold it");
  assert.equal(r.capture.outcome, "inserted");
  d.close();
});

test("D41(d) · the evidence a page can carry", () => {
  assert.equal(usEvidenceInText("You must be authorized to work in the United States."), "us_named");
  assert.equal(usEvidenceInText("Our team sits in Austin, TX and Denver, CO."), "us_city");
  assert.equal(usEvidenceInText("Base pay $140K – $170K."), "usd_pay");
  assert.equal(usEvidenceInText("Base pay CA$140,000 – CA$170,000."), null, "another dollar is not USD");
  assert.equal(usEvidenceInText("Toronto, ON or Vancouver, BC."), null);
  assert.equal(captureMarket({ location: "Remote", description: "", pageText: "US-based role" }).admit, true);
  assert.equal(captureMarket({ location: "Berlin, Germany", pageText: "United States" }).kind, "non_us",
    "positive non-US evidence is never overridden by a page mention");
});

test("D41(d) · the route answers 422 with the message as `error` — which every extension build shows", () => {
  const route = fs.readFileSync("routes/importJob.js", "utf8");
  assert.match(route, /err instanceof ImportRefusedError[\s\S]*?status\(422\)\.json\(\{ error: err\.message, refused: true, kind: err\.kind/);
  const ext = fs.readFileSync("extension/captureResult.js", "utf8");
  assert.match(ext, /if \(status < 200 \|\| status >= 300\) return fail\(body\.error/, "the published extension shows body.error on a non-2xx");
});

// ── (b) salary ──────────────────────────────────────────────────────────────────────────────────

test("D41(b) · the extractor's Salary line is kept — every format the row names", () => {
  const job = jobFromLabelledText({ url: "https://northwind.example.com/j/1",
    text: block({ location: "Boston, MA", salary: "$150,000 – $180,000 USD" }) });
  assert.equal(job.salary_min, 150000);
  assert.equal(job.salary_max, 180000);
  assert.equal(job.salary_currency, "USD");
  assert.equal(job.salary_min_usd, 150000, "the USD columns the board's salary filter reads");
  for (const [text, want] of [
    ["$150K–$180K", [150000, 180000, "USD", "annual"]],
    ["150K-180K USD", [150000, 180000, "USD", "annual"]],
    ["$45 - $60 per hour", [45, 60, "USD", "hourly"]],
    ["$123K – $185K • Offers Equity", [123000, 185000, "USD", "annual"]],
  ]) {
    const s = parseSalaryText(text);
    assert.deepEqual([s.salary_min, s.salary_max, s.salary_currency, s.salary_period], want, text);
  }
  assert.equal(parseSalaryText("Join a team of 50 - 100 people"), null, "a range with no currency is not pay");
});

test("D41(b) · JSON-LD baseSalary is read", () => {
  const ld = { "@type": "JobPosting", title: "Data Engineer", hiringOrganization: { name: "Fabrikam" },
    jobLocation: { address: { addressLocality: "Austin", addressRegion: "TX", addressCountry: "US" } },
    baseSalary: { "@type": "MonetaryAmount", currency: "USD",
      value: { "@type": "QuantitativeValue", minValue: 140000, maxValue: 170000, unitText: "YEAR" } } };
  const job = jobFromHtml({ url: "https://fabrikam.example/jobs/1", html: `<script type="application/ld+json">${JSON.stringify(ld)}</script>` });
  assert.deepEqual([job.salary_min, job.salary_max, job.salary_currency], [140000, 170000, "USD"]);
  assert.equal(salaryFromJsonLd({ currency: "USD", value: { value: 55, unitText: "HOUR" } }).salary_period, "hourly");
});

test("D41(b) · Ashby's summary strings are read when it sends no Salary component", () => {
  const src = fs.readFileSync("services/jobs/sources/ashby.js", "utf8");
  assert.match(src, /parseSalaryText\(comp\.scrapeableCompensationSalarySummary \|\| comp\.compensationTierSummary/);
});

// ── (a) ALL is the whole set ────────────────────────────────────────────────────────────────────

test("D41(a) · a capture does NOT star, and ALL admits the user's own rows whatever the scope", async () => {
  const d = db();
  const r = await capture(d, { location: "Boston, MA" }, 9);
  const uj = d.prepare("SELECT * FROM user_jobs WHERE user_id = 1 AND job_id = ?").get(r.job.id);
  assert.equal(uj.starred, 0, "★ is what the user chose to save");
  assert.equal(uj.domain_profile_id, 7);
  d.close();
  const server = fs.readFileSync("server.js", "utf8");
  // The discovery scope never hides a row the user made their own: starred, drafted, captured.
  assert.match(server, /const ownRowsSql = `uj\.starred = 1\s+OR uj\.resume_generated = 1\s+OR EXISTS \(SELECT 1 FROM job_captures jc WHERE jc\.job_id = sj\.job_id AND jc\.user_id = \$\{ownUid\}\)/);
  assert.match(server, /OR NOT EXISTS \(SELECT 1 FROM job_role_map m WHERE m\.job_id = sj\.job_id\)\s+OR \$\{ownRowsSql\}/);
  // ★ is ALL plus its predicate — the same statement, one more clause.
  assert.match(server, /const starredSql = savedTab \? `AND uj\.starred = 1 AND sj\.job_id IN \(SELECT s\.job_id FROM user_jobs s WHERE s\.user_id = \$\{starUid\} AND s\.starred = 1\)` : '';/ /* ⭐ D151 Rule 4 (11-08, changed on purpose) */);
  // /d no longer hides a drafted job behind the role bucket or the title filter.
  const pending = server.slice(at(server, "function pendingJobsQuery"), at(server, 'app.get("/api/categories"'));
  assert.doesNotMatch(pending, /JOIN job_role_map|profileTitleSql/);
});

// ── (c) logo ────────────────────────────────────────────────────────────────────────────────────

test("D41(c) · the logo comes from the employer's own site — never the ATS host", () => {
  const c = candidateDomains("Hims And Hers", ["https://www.forhims.com", "https://jobs.ashbyhq.com/hims-and-hers/abc"]);
  assert.ok(c.some(x => x.domain === "forhims.com" && x.evidence === "careers"), "the employer's site is a trusted candidate");
  assert.ok(!c.some(x => /ashbyhq|greenhouse|lever/.test(x.domain)), "an ATS host is never a company's logo");
  const route = fs.readFileSync("routes/importJob.js", "utf8");
  assert.match(route, /queueLogo\(\{ company: result\.job\.company, urls \}\)/, "queued at capture time");
  assert.match(route, /\[result\.employerSite, result\.job\.url/, "the employer's site first");
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /queueLogo: process\.env\.COMPANY_LOGOS === "off" \? null : \(target\) => resolveCaptureLogo\(db, target\)/);
});
