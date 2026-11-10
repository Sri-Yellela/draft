// 46a (A161, owner 11-09 "… and icims support too") · iCIMS as a crawled source: the sitemap lists the tenant's postings,
// each page's JSON-LD JobPosting is the posting; a datePosted most of the board shares is an import stamp, dropped.
// SYNTHETIC tenant and postings; no network (a stand-in `get`).
import test from "node:test";
import assert from "node:assert/strict";
import { fetchCompanyJobs, parseSitemap, jobPostingOf, importStamps, isTenantSlug } from "../services/jobs/sources/icims.js";
import { harvestPairOf } from "../services/slugHarvest.js";
import { ATS_FETCHERS, validateBoard } from "../services/companyList.js";
import { seedItems } from "../services/seedCandidates.js";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const SLUG = "careers-examplebuild";
const H = `https://${SLUG}.icims.com`;
const sitemap = (ids) => `<?xml version='1.0'?><urlset><url><loc>${H}/jobs/search</loc></url>${ids.map(([id, t]) =>
  `<url><loc>${H}/jobs/${id}/${t}/job</loc><lastmod>2026-11-09T19:16:18-05:00</lastmod></url>`).join("")}<url><loc>https://other.icims.com/jobs/9/x/job</loc></url></urlset>`;
const page = (p) => `<html><head><script type="application/ld+json">${JSON.stringify({ "@context": "http://schema.org", "@type": "JobPosting", ...p })}</script></head><body>x</body></html>`;
const addr = (city, region, country = "US") => ({ address: { "@type": "PostalAddress", addressLocality: city, addressRegion: region, addressCountry: country } });

function fakeGet(pages, xml) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    if (url.endsWith("/sitemap.xml")) return { data: xml };
    const id = url.match(/\/jobs\/(\d+)\//)?.[1];
    if (!pages[id]) { const e = new Error("gone"); e.response = { status: 404 }; throw e; }
    return { data: pages[id] };
  };
  return { get, calls };
}

test("A161: parseSitemap keeps only this tenant's /jobs/<id>/…/job pages, once each, with the URL's title", () => {
  const xml = sitemap([["101", "project-manager%2c-k-12"], ["102", "senior-scheduler"], ["101", "project-manager%2c-k-12"]]);
  assert.deepEqual(parseSitemap(xml, SLUG), [
    { id: "101", url: `${H}/jobs/101/project-manager%2c-k-12/job`, titleHint: "project manager, k 12" },
    { id: "102", url: `${H}/jobs/102/senior-scheduler/job`, titleHint: "senior scheduler" },
  ]);
  assert.equal(jobPostingOf("<html>no json</html>"), null);
  assert.equal(jobPostingOf(page({ title: "A" })).title, "A");
});

test("A161: postings are read from JSON-LD; a board-wide import stamp is NOT a posting date; a real one is kept; non-US dropped", async () => {
  const ids = Array.from({ length: 6 }, (_, i) => [String(200 + i), `role-${i}`]);
  const pages = {};
  ids.forEach(([id], i) => { pages[id] = page({ title: `Role ${i}`, description: "<h2>Overview</h2><p>Build things.</p>", employmentType: "FULL_TIME",
    datePosted: `2024-11-10T00:30:0${i}.000Z`, jobLocation: [addr("Boston", "MA")] }); });
  pages["205"] = page({ title: "Role 5", description: "<p>x</p>", datePosted: "2026-11-01T12:00:00.000Z", jobLocation: [addr("New Haven", "CT")] });
  pages["204"] = page({ title: "Role 4", description: "<p>x</p>", datePosted: "2024-11-10T00:30:04.000Z", jobLocation: [addr("San Juan", null, "PR"), addr("Toronto", "ON", "CA")] });
  const { get } = fakeGet(pages, sitemap(ids));
  const jobs = await fetchCompanyJobs(SLUG, "Example Build Co", [], { get });
  assert.equal(jobs.length, 5, "the posting with no US place is dropped");
  const byTitle = Object.fromEntries(jobs.map(j => [j.title, j]));
  assert.equal(byTitle["Role 0"].posted_at ?? null, null, "the shared 2024-11-10T00:30 stamp is dropped");
  assert.match(String(byTitle["Role 5"].posted_at), /^2026-11-01/, "a date the board does not share is kept");
  assert.equal(byTitle["Role 0"].source, "icims");
  assert.equal(byTitle["Role 0"].location, "Boston, MA");
  assert.equal(byTitle["Role 0"].url, `${H}/jobs/200/role-0/job`);
  assert.match(byTitle["Role 0"].description, /Build things/);
  assert.equal(importStamps([{ datePosted: "2026-01-01T00:00:00Z" }, { datePosted: "2026-02-01T00:00:00Z" }]).size, 0, "a small board never reads as stamped");
});

test("A161 (46a): an address placeholder (\"UNAVAILABLE\") is unknown — not a foreign country, not the location text", async () => {
  const ids = [["401", "sterile-processing-tech"], ["402", "clinic-receptionist"]];
  const pages = {
    401: page({ title: "Sterile Processing Tech", jobLocation: [{ address: { addressCountry: "UNAVAILABLE", addressLocality: "UNAVAILABLE", addressRegion: "ND", postalCode: "58501" } }] }),
    402: page({ title: "Clinic Receptionist", jobLocation: [{ address: { addressCountry: "UNAVAILABLE", addressLocality: "Bismarck", addressRegion: "ND" } }] }),
  };
  const { get } = fakeGet(pages, sitemap(ids));
  const jobs = await fetchCompanyJobs(SLUG, "Example Health", [], { get });
  assert.equal(jobs.length, 2, "CommonSpirit's whole board was dropped as non-US before this");
  const by = Object.fromEntries(jobs.map(j => [j.title, j]));
  assert.equal(by["Sterile Processing Tech"].location, "ND, United States", "a US state + ZIP is the address's own US evidence");
  assert.equal(by["Clinic Receptionist"].location, "Bismarck, ND");
});

test("A161 (46a): an all-placeholder address falls back to the page's own Location header — a US state only", async () => {
  const header = (v) => `<div class="iCIMS_JobHeaderData"><dt>Location</dt><dd>${v}</dd></div>`;
  const allUnavailable = { address: { addressCountry: "UNAVAILABLE", addressLocality: "UNAVAILABLE", addressRegion: "UNAVAILABLE", postalCode: "58501" } };
  const pages = {
    501: page({ title: "Sterile Tech", jobLocation: [allUnavailable] }).replace("</body>", `${header("ND-Bismarck")}</body>`),
    502: page({ title: "Nurse Toronto", jobLocation: [allUnavailable] }).replace("</body>", `${header("ON-Toronto")}</body>`),
  };
  const { get } = fakeGet(pages, sitemap([["501", "sterile-tech"], ["502", "nurse-toronto"]]));
  const jobs = await fetchCompanyJobs(SLUG, "Example Health", [], { get });
  const by = Object.fromEntries(jobs.map(j => [j.title, j]));
  assert.equal(by["Sterile Tech"].location, "Bismarck, ND", "the header's US state + city");
  assert.equal(by["Nurse Toronto"].location, "Not specified", "a Canadian province is never read as a US state; the board's US gate decides");
});

test("A161: a query skips postings by the URL's title before their pages are asked for; one unreadable page never drops the board", async () => {
  const ids = [["301", "project-manager"], ["302", "superintendent"], ["303", "assistant-project-manager"]];
  const pages = { 301: page({ title: "Project Manager", jobLocation: [addr("Boston", "MA")] }) };   // 303 answers 404
  const { get, calls } = fakeGet(pages, sitemap(ids));
  const jobs = await fetchCompanyJobs(SLUG, "Example Build Co", ["project"], { get });
  assert.deepEqual(jobs.map(j => j.title), ["Project Manager"]);
  assert.ok(!calls.some(u => u.includes("/302/")), "the superintendent page is never fetched for a 'project' query");
});

test("A161: wired as a source — harvest, fetchers, validateBoard's dead slug, the seed's board URL", async () => {
  assert.deepEqual(harvestPairOf(`${H}/jobs/101/x/job?in_iframe=1`), { atsType: "icims", slug: SLUG });
  assert.deepEqual(harvestPairOf("https://www.icims.com/careers"), { unsupported: "icims" }, "iCIMS's own site is not a tenant");
  assert.equal(isTenantSlug("jobs"), false); assert.equal(isTenantSlug(SLUG), true);
  assert.equal(typeof ATS_FETCHERS.icims, "function");
  const dead = await validateBoard({ atsType: "icims", slug: SLUG, company: "X", fetchers: { icims: async () => { const e = new Error("nf"); e.response = { status: 404 }; throw e; } } });
  assert.equal(dead.state, "dead");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "a161-")), "c.json");
  fs.writeFileSync(f, JSON.stringify({ found: [{ company: "Example Build Co", atsType: "icims", slug: SLUG, industry: "construction" }] }));
  assert.equal(seedItems(f)[0].ats.url, `${H}/jobs/search`);
  assert.deepEqual(harvestPairOf(seedItems(f)[0].ats.url), { atsType: "icims", slug: SLUG });
});
