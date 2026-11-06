// A location field that says nothing ("N/A", "na", "none", "-", "TBD", "unknown") is UNKNOWN, and D156 (7) omits an
// unknown value: 175 active postings read "Stripe · na". Exact match only — never guessed to be North America.
// Synthetic postings only.
import test from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderLocation } from "../shared/postingNormalize.js";
import { mapJobRow } from "../services/jobs/mapJobRow.js";

const row = (location, extra = {}) => ({ job_id: "gh::1", title: "Software Engineer", company: "Northwind", location, url: "https://example.test/1", ...extra });

test("placeholders are unknown — any case, the whole value only", () => {
  for (const v of ["N/A", "n/a", "NA", "na", "Na", "none", "None", "-", "--", "TBD", "tbd", "unknown", "Unknown", " n/a ", "N/A.", "", null, undefined, "Location not specified"]) {
    assert.equal(isPlaceholderLocation(v), true, JSON.stringify(v));
  }
});

test("a real place is never a placeholder — including ones that START with a placeholder's letters", () => {
  for (const v of ["Nashville, TN", "Remote - NA", "NA - Remote", "Naperville, IL", "Remote (US)", "Unknown Falls, MN", "None Such Street, Boston, MA", "North America", "New York, NY"]) {
    assert.equal(isPlaceholderLocation(v), false, v);
  }
});

test("the serialiser omits a placeholder location — the card reads the company alone", () => {
  for (const v of ["na", "N/A", "none", "-", "TBD", "unknown", "Location not specified", ""]) {
    assert.equal(mapJobRow(row(v)).location, null, JSON.stringify(v));
  }
  assert.equal(mapJobRow(row("Boston, MA")).location, "Boston, MA");
  assert.equal(mapJobRow(row("Nashville, TN")).location, "Nashville, TN");
});
