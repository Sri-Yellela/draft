// 46b · SAP SuccessFactors Career Site Builder as a crawled source (services/jobs/sources/successfactors.js). SYNTHETIC
// pages in the two templates measured live on 11-10 (schema.org microdata; labelled tokens), an invented employer.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fetchCompanyJobs, parseSitemap, postingOf, robotsAllowsJobs, isCsbHost } from "../services/jobs/sources/successfactors.js";
import { ATS_FETCHERS } from "../services/companyList.js";
import { seedItems } from "../services/seedCandidates.js";
import { probeHostKey } from "../services/companyCandidates.js";

const HOST = "careers.examplebuild.com";
const loc = (id, t) => `<url><loc>https://${HOST}/job/${t}/${id}/</loc><lastmod>2026-11-07</lastmod></url>`;
const SITEMAP = `<?xml version="1.0"?><urlset>${loc(1440001, "Boston-Senior-Project-Manager-MA-02110")}${loc(1440002, "Toronto-Estimator-ON")}`
  + `${loc(1440003, "Austin-Carpenter-Foreman-TX")}${loc(1440004, "Denver-Project-Engineer-CO")}<url><loc>https://other.example.org/job/x/1440009/</loc></url>`
  + `<url><loc>https://${HOST}/go/Professionals/9919400/</loc></url></urlset>`;
const MICRODATA = (title, city, region, country, date) => `<html><body>
  <span itemprop="title" class="rtltextaligneligible">${title}</span>
  <span itemprop="jobLocation" itemscope><span itemprop="address" itemscope><meta itemprop="addressLocality" content="${city}"><meta itemprop="addressRegion" content="${region}">
  <meta itemprop="addressCountry" content="${country}"><meta itemprop="postalCode" content="02110"></span></span>
  <meta itemprop="datePosted" content="${date}">
  <span itemprop="description" class="rtltextaligneligible"><div><span>Lead the &amp; build.</span><div><p>Own schedules and budgets for a hospital project.</p></div></div></span>
  <span class="joblayouttoken-label">Employment Type:&nbsp;</span><span class="x">Full time</span></body></html>`;
const LABELLED = (title, where) => `<html><body>
  <span xml:lang="en-US" itemprop="title" class="rtltextaligneligible">${title}
  </span>
  <span class="joblayouttoken-label" role="heading" aria-level="2">Job Location:&nbsp;
        </span>

    <span xml:lang="en-US" class="rtltextaligneligible">${where}
    </span>
  <span itemprop="description" class="rtltextaligneligible"><div><p>Field engineering on a federal campus.</p></div></span></body></html>`;

function fake(pages, { robots = "User-agent: *\nDisallow: /applybutton/\nDisallow: /services/\n" } = {}) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (url.endsWith("/robots.txt")) return { data: robots };
    if (url.endsWith("/sitemap.xml")) return { data: SITEMAP };
    const id = /\/(\d+)\/$/.exec(url)?.[1];
    if (pages[id] instanceof Error) throw pages[id];
    if (!pages[id]) throw Object.assign(new Error("404"), { status: 404 });
    return { data: pages[id] };
  };
  return { get, calls };
}

test("SuccessFactors: the sitemap's /job/ pages only, this host only, each once", () => {
  const e = parseSitemap(SITEMAP, HOST);
  assert.deepEqual(e.map(x => x.id), ["1440001", "1440002", "1440003", "1440004"]);
  assert.equal(e[0].titleHint, "Boston Senior Project Manager MA 02110");
  assert.equal(e[0].url, `https://${HOST}/job/Boston-Senior-Project-Manager-MA-02110/1440001/`);
});

test("SuccessFactors: both templates read — microdata (B&V's) and labelled tokens (Hensel Phelps')", () => {
  const a = postingOf(MICRODATA("Senior Project Manager", "Boston", "MA", "US", "2026-10-23T02:00:00Z"));
  assert.equal(a.title, "Senior Project Manager");
  assert.deepEqual(a.place, { city: "Boston", region: "MA", country: "US" });
  assert.equal(a.datePosted, "2026-10-23T02:00:00.000Z");
  assert.match(a.html, /Own schedules and budgets/);
  assert.equal(a.employmentType, "Full time");
  const b = postingOf(LABELLED("Lead Quality Control Engineer", "Oak Ridge, TN"));
  assert.equal(b.title, "Lead Quality Control Engineer");
  assert.deepEqual(b.place, { city: "Oak Ridge", region: "TN", country: "US" }, "a US state code + a city is the posting's own US place");
  assert.equal(b.datePosted, null, "no date on the page → aged from first seen, never invented");
  assert.equal(postingOf("<html>no title, no description</html>"), null);
});

test("SuccessFactors: fetches by the query before any detail, drops non-US, keeps a company when one page fails", async () => {
  const { get, calls } = fake({
    1440001: MICRODATA("Senior Project Manager", "Boston", "MA", "US", "2026-10-23T02:00:00Z"),
    1440002: MICRODATA("Estimator", "Toronto", "ON", "CA", "2026-10-20T00:00:00Z"),
    1440004: new Error("timeout"),
  });
  const jobs = await fetchCompanyJobs(HOST, "Example Build", ["project", "estimator"], { get });
  assert.deepEqual(jobs.map(j => [j.title, j.location, j.source]), [["Senior Project Manager", "Boston, MA", "successfactors"]]);
  assert.ok(!calls.some(u => u.includes("1440003")), "the carpenter posting's title does not match — never fetched");
  assert.match(jobs[0].description, /hospital project/);
  assert.equal(jobs[0].posted_at, "2026-10-23T02:00:00.000Z");
});

test("SuccessFactors: robots.txt is respected; only a public host is a slug; wired as a source and a seed", async () => {
  assert.equal(robotsAllowsJobs("User-agent: *\nDisallow: /job/\n"), false);
  assert.equal(robotsAllowsJobs("User-agent: *\nDisallow: /\n"), false);
  assert.equal(robotsAllowsJobs("User-agent: Googlebot\nDisallow: /\nUser-agent: *\nDisallow: /services/\n"), true);
  const { get, calls } = fake({}, { robots: "User-agent: *\nDisallow: /job/\n" });
  await assert.rejects(fetchCompanyJobs(HOST, "X", [], { get }), (e) => e.status === 403);
  assert.ok(!calls.some(u => u.endsWith("/sitemap.xml")), "nothing past robots.txt");
  for (const bad of ["localhost", "10.0.0.1", "careers.corp", "a b.com", "careers.example.com:8443", "https://careers.bv.com"]) assert.equal(isCsbHost(bad), false, bad);
  assert.equal(isCsbHost("careers.bv.com"), true);
  await assert.rejects(fetchCompanyJobs("127.0.0.1", "X", [], { get }), (e) => e.status === 404);
  assert.equal(typeof ATS_FETCHERS.successfactors, "function");
  assert.equal(probeHostKey({ ats_type: "successfactors", ats_slug: HOST }), `successfactors:${HOST}`, "one probe queue per site");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sf-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ found: [{ company: "Example Build", atsType: "successfactors", slug: HOST }, { company: "Bad", atsType: "successfactors", slug: "localhost" }] }));
  assert.deepEqual(seedItems(f).map(i => [i.ats.slug, i.ats.url]), [[HOST, `https://${HOST}/`]], "a bad host is dropped, not guessed");
  const real = JSON.parse(fs.readFileSync("content/companies/candidates-nontech-45s.json", "utf8"));
  assert.deepEqual(real.found.filter(x => x.atsType === "successfactors").map(x => x.slug).sort(), ["careers.bv.com", "careers.henselphelps.com"]);
});
