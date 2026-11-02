import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBambooJob } from "../services/jobs/sources/bamboohr.js";
import { ATS_FETCHERS } from "../services/companyList.js";
import { DIRECT_ATS_SOURCES } from "../services/jobs/directApplyFilter.js";

// A112 (11-02): BambooHR is a crawled source. Its list carries no text or date; the detail does. A synthetic opening
// in the shapes BambooHR's public /careers/list and /careers/{id}/detail return.

const LISTING = { id: "52", jobOpeningName: "Financial Analyst", employmentStatusLabel: "Full-Time",
  location: { city: "Austin", state: "Texas" }, isRemote: null, locationType: "0" };
const DETAIL = { jobOpeningShareUrl: "https://synthco.bamboohr.com/careers/52", jobOpeningName: "Financial Analyst",
  employmentStatusLabel: "Full-Time", location: { city: "Austin", state: "Texas", addressCountry: "United States" },
  description: "<p><b>About Synthco</b></p><p>Build the monthly forecast in Excel and SQL.</p>", datePosted: "2026-10-20",
  minimumExperience: "Mid-level", locationType: "0" };

test("A112: a BambooHR opening — the slug in its id (BambooHR ids repeat across companies), text and date from the detail", () => {
  const j = normalizeBambooJob("synthco", LISTING, DETAIL, "Synthco");
  assert.equal(j.source, "bamboohr");
  assert.equal(j.req_id, "synthco-52");
  assert.match(j.id, /synthco-52$/);
  assert.equal(j.url, "https://synthco.bamboohr.com/careers/52");
  assert.equal(j.location, "Austin, Texas, United States");
  assert.match(j.description, /monthly forecast in Excel and SQL/);
  assert.doesNotMatch(j.description, /<p>/);
  assert.equal(j.posted_at, "2026-10-20");
  assert.notEqual(normalizeBambooJob("othco", LISTING, DETAIL, "Othco").id, j.id);
});

test("A112: a remote BambooHR opening reads as Remote", () => {
  const j = normalizeBambooJob("synthco", { ...LISTING, isRemote: true }, { ...DETAIL, locationType: "1" }, "Synthco");
  assert.equal(j.location, "Remote");
  assert.equal(j.remote, true);
});

test("A112: BambooHR is registered where every crawled source is — the fetcher and the direct-ATS set", () => {
  assert.equal(typeof ATS_FETCHERS.bamboohr, "function");
  assert.ok(DIRECT_ATS_SOURCES.has("bamboohr"));
});

test("A112: a Gem posting — the posting's offices name its place when its own location is blank", async () => {
  const { normalizeGemJob } = await import("../services/jobs/sources/gem.js");
  const j = normalizeGemJob({ id: "abc", requisition_id: "R4", title: "Senior Customer Success Manager",
    absolute_url: "https://jobs.gem.com/gemco/abc", content: "<div>Own the renewals of our enterprise customers.</div>",
    first_published_at: "2026-10-09T19:17:02.814Z", location: { name: "" }, location_type: "in_office",
    offices: [{ location: { name: "" }, name: "San Francisco (On-Site) OR Remote" }], employment_type: "full_time" }, "Gemco");
  assert.equal(j.source, "gem");
  assert.equal(j.location, "San Francisco (On-Site) OR Remote");
  assert.match(j.description, /renewals of our enterprise customers/);
  assert.equal(j.posted_at, "2026-10-09T19:17:02.814Z");
  assert.ok(DIRECT_ATS_SOURCES.has("gem") && typeof ATS_FETCHERS.gem === "function");
});
