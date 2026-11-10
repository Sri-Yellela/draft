// 46a (after A161; owner 11-09 "… Oracle after iCIMS") · Oracle Recruiting Cloud as a crawled source: the Candidate
// Experience site's own public REST list + detail. SYNTHETIC tenant and postings; no network (a stand-in `get`).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fetchCompanyJobs, parseSlug, jobUrl } from "../services/jobs/sources/oracle.js";
import { harvestPairOf } from "../services/slugHarvest.js";
import { ATS_FETCHERS, validateBoard } from "../services/companyList.js";
import { seedItems } from "../services/seedCandidates.js";

const HOST = "fa-test-saasfaprod1.fa.ocs.oraclecloud.com", SITE = "CX_1", SLUG = `${HOST}|${SITE}`;
const req = (id, title, country = "US", loc = "Boston, MA, United States", wt = "ORA_ONSITE") =>
  ({ Id: String(id), Title: title, PostedDate: "2026-11-01", PrimaryLocation: loc, PrimaryLocationCountry: country, WorkplaceTypeCode: wt, secondaryLocations: [] });

function fakeGet(all, details, { total = all.length } = {}) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    const u = decodeURIComponent(url);
    if (u.includes("/recruitingCEJobRequisitions?")) {
      const off = Number(u.match(/offset=(\d+)/)[1]);
      return { data: { items: [{ TotalJobsCount: total, requisitionList: all.slice(off, off + 25) }] } };
    }
    const id = u.match(/Id="(\d+)"/)[1];
    if (!details[id]) { const e = new Error("gone"); e.response = { status: 404 }; throw e; }
    return { data: { items: [details[id]] } };
  };
  return { get, calls };
}

test("Oracle: pages the list to TotalJobsCount, reads each US posting's detail, drops non-US, keeps a posting whose detail fails", async () => {
  const all = Array.from({ length: 30 }, (_, i) => req(100 + i, `Project Manager ${i}`));
  all[3] = req(103, "Project Manager 3", "CA", "Toronto, ON, Canada");
  all[4] = req(104, "Remote Estimator", "US", "", "ORA_REMOTE");
  const details = Object.fromEntries(all.map(r => [r.Id, { Title: r.Title, ExternalDescriptionStr: `<p>Run ${r.Title} work.</p>`, ExternalPostedStartDate: "2026-11-05T10:00:00+00:00", PrimaryLocation: r.PrimaryLocation }]));
  delete details["110"];
  const { get, calls } = fakeGet(all, details);
  const jobs = await fetchCompanyJobs(SLUG, "Example Builders", [], { get, sleep: async () => {} });
  assert.equal(calls.filter(u => u.includes("recruitingCEJobRequisitions?")).length, 2, "two list pages for 30 postings");
  assert.equal(jobs.length, 29, "the Canadian posting is dropped");
  const by = Object.fromEntries(jobs.map(j => [j.title, j]));
  assert.equal(by["Project Manager 0"].source, "oracle");
  assert.equal(by["Project Manager 0"].url, jobUrl(HOST, SITE, "100"));
  assert.match(by["Project Manager 0"].description, /Run Project Manager 0 work/);
  assert.match(String(by["Project Manager 0"].posted_at), /^2026-11-05/);
  assert.equal(by["Remote Estimator"].location, "Remote"); assert.equal(by["Remote Estimator"].remote, true);
  assert.ok(by["Project Manager 10"], "a posting whose detail failed is still listed from its list row");
  assert.match(String(by["Project Manager 10"].posted_at), /^2026-11-01/);
});

test("Oracle: a query skips postings by title before their details are asked for", async () => {
  const all = [req(1, "Superintendent"), req(2, "Senior Project Manager")];
  const details = { 1: { Title: "Superintendent" }, 2: { Title: "Senior Project Manager" } };
  const { get, calls } = fakeGet(all, details);
  const jobs = await fetchCompanyJobs(SLUG, "Example Builders", ["project"], { get, sleep: async () => {} });
  assert.deepEqual(jobs.map(j => j.title), ["Senior Project Manager"]);
  assert.ok(!calls.some(u => decodeURIComponent(u).includes('Id="1"')));
});

test("Oracle: the slug is <oraclecloud host>|<site> — never another host; wired as a source end to end", async () => {
  assert.deepEqual(parseSlug(SLUG), { host: HOST, site: SITE });
  for (const bad of ["evil.example.com|CX_1", `${HOST}|`, `${HOST}|../x`, "localhost|CX_1"]) assert.equal(parseSlug(bad), null, bad);
  await assert.rejects(fetchCompanyJobs("evil.example.com|CX_1", "X", [], { get: async () => { throw new Error("must not fetch"); } }), (e) => e.status === 404);
  assert.deepEqual(harvestPairOf(`https://${HOST}/hcmUI/CandidateExperience/en/sites/${SITE}/job/123`), { atsType: "oracle", slug: SLUG });
  assert.deepEqual(harvestPairOf(`https://${HOST}/fscmUI/other`), { unsupported: "oracle" }, "another Oracle page names no career site");
  assert.equal(typeof ATS_FETCHERS.oracle, "function");
  const dead = await validateBoard({ atsType: "oracle", slug: SLUG, company: "X", fetchers: { oracle: async () => { const e = new Error("nf"); e.status = 404; throw e; } } });
  assert.equal(dead.state, "dead");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "oracle-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ found: [{ company: "Example Builders", atsType: "oracle", slug: SLUG }, { company: "Bad", atsType: "oracle", slug: "evil.example.com|CX_1" }] }));
  const items = seedItems(f);
  assert.equal(items.length, 1, "a non-Oracle host is dropped at import");
  assert.deepEqual(harvestPairOf(items[0].ats.url), { atsType: "oracle", slug: SLUG }, "the seed's board URL round-trips");
});
