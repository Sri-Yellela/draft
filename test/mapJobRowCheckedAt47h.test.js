// ⭐ 47h (47f's gap 4 (c)) · a job carries WHEN THE CRAWL LAST SAW IT LIVE (scraped_at → checkedAt, unix seconds), so the
// plate ticket can say "LIVE · CHECKED TODAY" from data instead of leaving it out. Not the posting's own date (postedAt).
import test from "node:test";
import assert from "node:assert/strict";
import { mapJobRow } from "../services/jobs/mapJobRow.js";

test("47h · mapJobRow: checkedAt = scraped_at (or a live row's checkedAt); none → null, never 0", () => {
  const base = { job_id: "j1", title: "Data Engineer", company: "Acme", source: "greenhouse" };
  assert.equal(mapJobRow({ ...base, scraped_at: 1764000000 }).checkedAt, 1764000000);
  assert.equal(mapJobRow({ ...base, checkedAt: 1764000123 }).checkedAt, 1764000123);
  assert.equal(mapJobRow({ ...base }).checkedAt, null);
  assert.equal(mapJobRow({ ...base, scraped_at: null }).checkedAt, null);
  assert.notEqual(mapJobRow({ ...base, scraped_at: 1764000000, posted_at: "2026-11-01" }).postedAt, 1764000000, "postedAt stays the posting's");
});
