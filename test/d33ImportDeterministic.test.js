// D33 part 5 — D17: ONLY RÉSUMÉ GENERATION MAY CALL A MODEL. Import called Haiku (IMPORT_MODEL_ID)
// and fell back to the deterministic read only when the balance was gone — so the only import route
// the product has answered 503 "not funded" on an unfunded balance. Inverted and then removed:
// deterministic first, model never. A JobPosting in the HTML (JSON-LD), else the extension's
// labelled block (jobFromLabelledText). Nothing readable is a 400 that says so — never a 503.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importJob, jobFromHtml, jobFromLabelledText } from "../services/jobs/importJob.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { usEligibility } from "../services/jobs/usLocation.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active)
             VALUES (7,1,'Current','engineering','general',1)`).run();
  return d;
}
const block = (loc) => `Title: Platform Engineer\nCompany: Northwind\nLocation: ${loc}\nWork Type: Remote\n` +
  "Own the deploy pipeline and the developer platform. ".repeat(4);

test("a capture is filed with NO model client at all — inserted, recorded, on the board", async () => {
  const d = db();
  const r = await importJob({ url: "https://northwind.example.com/careers/platform", text: block("Remote (United States)") },
    { db: d, userId: 1 });
  assert.equal(r.capture.outcome, "inserted");
  assert.equal(r.capture.onBoard, true, "'Remote (United States)' is positive US evidence");
  assert.equal(r.job.title, "Platform Engineer");
  assert.equal(r.degraded, undefined, "there is no degraded mode: the deterministic read IS the read");
  const cap = d.prepare("SELECT origin, action, out_of_market FROM job_captures").get();
  assert.deepEqual({ ...cap }, { origin: "capture", action: "inserted", out_of_market: 0 });
  d.close();
});

test("the bare-'Remote' capture is filed AND told why it is held — not a 503, not a silent success", async () => {
  const d = db();
  const r = await importJob({ url: "https://northwind.example.com/careers/platform-2", text: block("Remote") }, { db: d, userId: 1 });
  assert.equal(r.capture.outcome, "held");
  assert.equal(r.capture.reason, "remote_region_unstated");
  assert.match(r.capture.message, /without saying from where/);
  d.close();
});

test("a schema.org JobPosting in HTML is read structurally, remote-from-the-US included", () => {
  const ld = { "@context": "https://schema.org", "@type": "JobPosting", title: "Data Engineer",
    hiringOrganization: { "@type": "Organization", name: "Fabrikam" }, jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "USA" }, description: "<p>Pipelines.</p>" };
  const html = `<html><head><script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebPage" }, ld] })}</script></head></html>`;
  const job = jobFromHtml({ url: "https://fabrikam.example/jobs/1", html });
  assert.equal(job.title, "Data Engineer");
  assert.equal(job.company, "Fabrikam");
  assert.equal(job.location, "Remote (USA)");
  assert.equal(usEligibility({ location: job.location, description: job.description }).admit, true);
  assert.equal(job.salary_min ?? null, null, "nothing is inferred");
  // An office posting reads its address.
  const office = jobFromHtml({ html: `<script type="application/ld+json">${JSON.stringify({ ...ld, jobLocationType: undefined,
    jobLocation: { address: { addressLocality: "Austin", addressRegion: "TX", addressCountry: "US" } } })}</script>` });
  assert.equal(office.location, "Austin, TX, US");
  // No title or no employer: no job.
  assert.equal(jobFromHtml({ html: `<script type="application/ld+json">${JSON.stringify({ ...ld, hiringOrganization: null })}</script>` }), null);
  assert.equal(jobFromHtml({ html: "<p>no data</p>" }), null);
  assert.equal(jobFromLabelledText({ text: "Senior Engineer at Acme" }), null);
});

async function post(d, body) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use("/api/import", createImportJobRouter(d));
  const server = app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/import/job`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { code: r.status, body: await r.json() };
  } finally { server.close(); }
}

test("over HTTP: unreadable text is a 400 that says why; a readable capture is a 200 with its capture object", async () => {
  const d = db();
  const bad = await post(d, { url: "https://www.linkedin.com/jobs/view/1", text: "just some prose" });
  assert.equal(bad.code, 400);
  assert.match(bad.body.error, /Could not read a job title and employer/);
  const ok = await post(d, { url: "https://northwind.example.com/careers/3", text: block("Boston, MA") });
  assert.equal(ok.code, 200);
  assert.equal(ok.body.capture.outcome, "inserted");
  d.close();
});

test("⛔ no model on the import path: no call, no model id, no client, no 503-on-unfunded", () => {
  const svc = read("services/jobs/importJob.js");
  assert.doesNotMatch(svc, /callModel\(|IMPORT_MODEL_ID|MODEL_HAIKU|anthropicModels|modelCall\.js|\banthropic\b/);
  const route = read("routes/importJob.js");
  assert.doesNotMatch(route, /status\(503\)|isPermanentModelFailure|not\s+"?\s*\+?\s*"?currently funded/);
  assert.match(route, /export function createImportJobRouter\(db\) \{/);
  assert.match(read("server.js"), /app\.use\("\/api\/import", requireAuth, createImportJobRouter\(db\)\);/);
});

test("the D17 ratchets agree: import_job is gone from BOTH the A80 known list and the PUBLIC set", () => {
  const sites = read("test/d17ModelCallSites.test.js");
  const routing = read("test/providerRouting.test.js");
  const known = sites.slice(at(sites, "const KNOWN_VIOLATIONS"), at(sites, "]);", at(sites, "const KNOWN_VIOLATIONS")));
  assert.doesNotMatch(known, /"import_job"/, "d17ModelCallSites still lists import_job as a known violation");
  const expected = /const expected = new Set\((\[[^\]]*\])\);/.exec(routing);
  assert.ok(expected, "providerRouting's PUBLIC set moved");
  assert.doesNotMatch(expected[1], /import_job/, "providerRouting still expects import_job on the free-tier route");
  // And every purpose the PUBLIC set expects is still a known violation or allowed — one story, not two.
  for (const p of JSON.parse(expected[1].replace(/'/g, '"'))) assert.match(known, new RegExp(`"${p}"`));
});
