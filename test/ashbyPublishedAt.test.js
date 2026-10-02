// A44 (10-02): Ashby's posting API dates every posting in `publishedAt` (1,155 of 1,155 across four
// boards, probed live). The adapter read `publishedDate`, which does not exist, so all 794 active
// Ashby rows on the local board were undated — no "posted N days ago", and recency fell back to
// when we first saw the row.
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAshbyJob } from "../services/jobs/sources/ashby.js";

test("an Ashby posting keeps its publish date", () => {
  const job = normalizeAshbyJob({
    id: "a1", title: "Software Engineer", location: "San Francisco, CA", applyUrl: "https://jobs.ashbyhq.com/x/a1",
    descriptionPlain: "Build things.", isRemote: false, workplaceType: "OnSite",
    publishedAt: "2026-09-30T17:02:11.000+00:00",
  }, "Linear");
  assert.equal(job.posted_at, "2026-09-30T17:02:11.000+00:00");
});
