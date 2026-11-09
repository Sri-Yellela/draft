// A157 (45q, owner 11-09) · a company's own address /<company>, its postings under it /<company>/<id>, the name opens the
// page, the employer's apply link lives on the page, and the Companies tab is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { companySlug, companyPagePath, companyPagePathFromSlug, jobPagePath, boardIdFromPath, RESERVED, isReserved } from "../shared/companyPaths.js";

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("a157CompanyOwnAddress: /<company>, its jobs at /<company>/<id>; a reserved word lives under /companies/", () => {
  assert.equal(companySlug("Stripe, Inc."), "stripe");
  assert.equal(companyPagePath("Stripe"), "/stripe");
  assert.equal(jobPagePath("Stripe", 48213), "/stripe/48213");
  assert.equal(jobPagePath("Stripe", "x"), null);
  assert.equal(companyPagePathFromSlug("jobs"), "/companies/jobs", "a company never takes one of draft's words");
  assert.equal(jobPagePath("Jobs", 7), "/companies/jobs/7");
  assert.equal(boardIdFromPath("/stripe/48213"), 48213);
  assert.equal(boardIdFromPath("/jobs/stripe-backend-engineer-48213"), 48213, "the old form still reads");
  assert.equal(boardIdFromPath("/stripe"), null);
});

test("a157ReservedCoversEveryRoute: every first path segment draft serves is reserved (derived from the code)", () => {
  const segs = new Set();
  for (const m of read("client/src/App.jsx").matchAll(/path="\/([a-z0-9-]+)/g)) segs.add(m[1]);
  for (const f of ["server.js", ...fs.readdirSync(new URL("../routes/", import.meta.url)).map(x => `routes/${x}`)]) {
    for (const m of read(f).matchAll(/app\.(?:get|post|put|patch|delete|use)\(\s*"\/([a-z0-9-]+)(?=[/"?])/g)) segs.add(m[1]);
  }
  const missing = [...segs].filter(s => !isReserved(s));
  assert.deepEqual(missing, [], `add to RESERVED in shared/companyPaths.js: ${missing.join(", ")}`);
  assert.ok(RESERVED.has("app") && RESERVED.has("api") && RESERVED.has("jobs"));
});

test("a157NameOpensPage: the name links to the company page (with the job), the logo too; applying is ApplyLink", () => {
  const link = read("client/src/components/CompanyLink.jsx");
  assert.match(link, /const to = companyPath\(company, \{ inApp, job: jobId \}\);/);
  assert.match(link, /<Link className=\{cls\} to=\{to\} data-company-page-link=""/);
  assert.match(link, /export function ApplyLink\(/);
  assert.match(read("client/src/components/JobBubble.jsx"), /navigate\(companyPath\(job\.company, \{ job: id \}\)\)/, "the row's logo opens the page");
  const page = read("client/src/pages/companies/CompanyPage.jsx");
  assert.match(page, /data-company-focus=\{focus\.jobId\}/, "the job the reader opened, first");
  assert.match(page, /<ApplyLink href=\{focus\.applyUrl\}/);
  assert.match(page, /<ApplyLink href=\{j\.applyUrl\} jobId=\{j\.jobId\}/, "Apply beside each open job");
  const server = read("server.js");
  assert.ok(server.indexOf('app.get(["/:company/:id(') > server.indexOf('app.get("/jobs/:slug"'), "draft's own routes win");
  assert.ok(server.indexOf('app.get(["/:company/:id(') < server.indexOf('app.get("*"'), "before the app's fallback");
  assert.match(server, /res\.redirect\(301, `\/\$\{s\}/, "/companies/<slug> answers with the company's own address");
});
