// 46a (after A161 and Oracle) · Taleo career sections as a crawled source: the section's portal number, its own jobboard
// REST list (columns by their declared roles), and the description out of each posting page's initialHistory field.
// SYNTHETIC tenant and postings; no network (stand-in `get` / `post`).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fetchCompanyJobs, parseSlug, portalOf, rowOf, descriptionOf, jobUrl } from "../services/jobs/sources/taleo.js";
import { harvestPairOf } from "../services/slugHarvest.js";
import { ATS_FETCHERS } from "../services/companyList.js";
import { seedItems } from "../services/seedCandidates.js";

const SLUG = "examplebuild|ex";
const detailPage = (text) => {
  const fields = ["ftlx0", "ftlUtil_resetPage$requisitionDescriptionInterface", "descRequisition", "1", `!*!<p>${text}</p>${" Build bridges and roads.".repeat(12)}`,
    `!*!<p>Required Qualifications: a bachelor's degree.</p>${" Field work.".repeat(25)}`,
    `Tell us about a person who might be interested in working for our organization.${" x".repeat(120)}`];
  return `<html><input type="hidden" name="initialHistory" id="initialHistory" value="${encodeURIComponent(fields.join("!|!"))}"></html>`;
};
const listRow = (n, title, place = "United States-Massachusetts-Boston", date = "Nov 5, 2026") =>
  ({ jobId: String(9000 + n), contestNo: String(100 + n), column: [title, JSON.stringify([place]), date], linkedColumn: 0, locationsColumns: [1] });

function fake(rows, { total = rows.length, portal = "101430233", noDetail = [] } = {}) {
  const calls = [];
  const get = async (url) => {
    calls.push(["GET", url]);
    if (url.includes("jobsearch.ftl")) return { data: portal ? `<script>var x="/careersection/rest/jobboard/searchjobs?portal=${portal}";</script>` : "<html></html>" };
    const job = url.match(/job=(\d+)/)?.[1];
    if (noDetail.includes(job)) { const e = new Error("gone"); e.response = { status: 404 }; throw e; }
    return { data: detailPage(`Posting ${job}`) };
  };
  const post = async (url, body) => {
    calls.push(["POST", url, body.pageNo]);
    return { data: { requisitionList: rows.slice((body.pageNo - 1) * 25, body.pageNo * 25), pagingData: { pageSize: 25, totalCount: total } } };
  };
  return { get, post, calls };
}

test("Taleo: the portal from the section's page, every list page, US postings with their description; a failed detail keeps the row", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => listRow(i, `Project Engineer ${i}`));
  rows[2] = listRow(2, "Project Engineer 2", "Canada-Ontario-Toronto");
  const { get, post, calls } = fake(rows, { noDetail: ["105"] });
  const jobs = await fetchCompanyJobs(SLUG, "Example Build", [], { get, post, sleep: async () => {} });
  assert.equal(calls.filter(c => c[0] === "POST").length, 2, "two list pages for 30 postings");
  assert.ok(calls.some(c => c[0] === "POST" && c[1].includes("portal=101430233")), "the list asks the section's own portal");
  assert.equal(jobs.length, 29, "the Toronto posting is dropped");
  const by = Object.fromEntries(jobs.map(j => [j.title, j]));
  const j0 = by["Project Engineer 0"];
  assert.equal(j0.source, "taleo"); assert.equal(j0.location, "Boston, Massachusetts");
  assert.equal(j0.url, jobUrl(parseSlug(SLUG), "100"));
  assert.match(j0.description, /Posting 100/); assert.match(j0.description, /bachelor's degree/);
  assert.doesNotMatch(j0.description, /Tell us about a person/, "the referral prompt is not the posting");
  assert.match(String(j0.posted_at), /^2026-11-05/);
  assert.ok(by["Project Engineer 5"], "a posting whose page failed is still listed from its row");
});

test("Taleo: columns are read by their declared roles, not their positions; a query skips postings before their pages", async () => {
  const r = rowOf({ jobId: "1", contestNo: "7", column: ["Oct 30, 2026", "[\"United States-Texas-Austin\",\"United States-Remote\"]", "Estimator"], linkedColumn: 2, locationsColumns: [1] });
  assert.deepEqual([r.title, r.places, r.dateText], ["Estimator", ["United States-Texas-Austin", "United States-Remote"], "Oct 30, 2026"]);
  const { get, post, calls } = fake([listRow(1, "Superintendent"), listRow(2, "Senior Project Manager")]);
  const jobs = await fetchCompanyJobs(SLUG, "Example Build", ["project"], { get, post, sleep: async () => {} });
  assert.deepEqual(jobs.map(j => j.title), ["Senior Project Manager"]);
  assert.ok(!calls.some(c => c[0] === "GET" && c[1].includes("job=101")));
  assert.equal(portalOf("<html>nothing</html>"), null);
  assert.equal(descriptionOf("<html>no field</html>"), "");
});

test("Taleo: a section with no portal is a dead board; the slug is <tenant>|<section>; wired as a source", async () => {
  const { get, post } = fake([], { portal: null });
  await assert.rejects(fetchCompanyJobs(SLUG, "X", [], { get, post }), (e) => e.status === 404);
  for (const bad of ["exa mple|ex", "examplebuild|", "www|ex", "examplebuild|../x"]) assert.equal(parseSlug(bad), null, bad);
  assert.deepEqual(harvestPairOf("https://examplebuild.taleo.net/careersection/ex/jobdetail.ftl?job=1"), { atsType: "taleo", slug: SLUG });
  assert.deepEqual(harvestPairOf("https://examplebuild.taleo.net/careersection/iam/accessmanagement/login.jsf"), { unsupported: "taleo" }, "the sign-in path names no section");
  assert.equal(typeof ATS_FETCHERS.taleo, "function");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "taleo-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ found: [{ company: "Example Build", atsType: "taleo", slug: SLUG }] }));
  assert.deepEqual(harvestPairOf(seedItems(f)[0].ats.url), { atsType: "taleo", slug: SLUG }, "the seed's board URL round-trips");
});
