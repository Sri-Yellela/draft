// ⭐ A172 (46b, the WORKLOG's "why Mass General Brigham / Moderna Workday read thin"): two real gaps, measured live.
// (1) Moderna's Workday list puts the PLACE in bulletFields[0] and sends no locationsText — every posting read "Not
//     specified" (0 of 252 US) and every posting in one city shared one id (bulletFields[0] was the id).
// (2) Mass General Brigham writes "Waltham-MA": the US gate read "City, ST" but not "City-ST" — 148 of 300 dropped.
// Synthetic list rows in each tenant's shape.
import test from "node:test";
import assert from "node:assert/strict";
import { workdayIdOf, workdayLocationOf } from "../services/jobs/sources/workday.js";
import { usEligibility } from "../services/jobs/usLocation.js";

test("a172WorkdayIdAndPlaceFromTheBullets: a place-first tenant gets its own ids and places; a req-id-first tenant is unchanged", () => {
  const placeFirst = { externalPath: "/job/Cambridge-Massachusetts/Senior-AI-Engineer_R20172", bulletFields: ["Cambridge, Massachusetts", "Digital", "R20172"] };
  const twin = { externalPath: "/job/Cambridge-Massachusetts/Scientist_R20180", bulletFields: ["Cambridge, Massachusetts", "Research", "R20180"] };
  assert.equal(workdayIdOf(placeFirst), "R20172");
  assert.notEqual(workdayIdOf(placeFirst), workdayIdOf(twin), "two postings in one city are two postings");
  assert.equal(workdayLocationOf(placeFirst), "Cambridge, Massachusetts");
  const reqFirst = { externalPath: "/job/Boston/Nurse_JR-0042117", locationsText: "Boston-MA", bulletFields: ["JR-0042117", "Posted Today"] };
  assert.equal(workdayIdOf(reqFirst), "JR-0042117", "the id the board has always stored for this tenant");
  assert.equal(workdayLocationOf(reqFirst), "Boston-MA");
  assert.equal(workdayIdOf({ externalPath: "/job/X/Engineer_R555", bulletFields: ["Remote - US", "Digital"] }), "R555", "the path's own requisition id");
  assert.equal(workdayLocationOf({ bulletFields: ["R1234"] }), "Not specified");
});

test("a172CityDashState: 'Waltham-MA' is Massachusetts; 'Bangalore-IN' stays India; a foreign 'City - Country' stays foreign", () => {
  for (const l of ["Waltham-MA", "Somerville-MA", "Chestnut Hill - MA", "Remote - US"]) assert.equal(usEligibility({ location: l }).admit, true, l);
  for (const l of ["Bangalore-IN", "Toronto-ON", "Oxford - England", "Warsaw - Poland"]) assert.equal(usEligibility({ location: l }).admit, false, l);
});
