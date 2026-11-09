// A141 (45q) · subcategory coverage without guessing: the title's own words ("Software Engineer, Android"), aliases read
// off the board's unplaced titles, and a description that clearly says which — a close race stays general.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyPosting, descriptionPick, taxonomy, DESC_MIN, DESC_MARGIN } from "../services/jobs/taxonomyClassify.js";

const sub = (title, description = "") => classifyPosting({ title, description }).subcategory;

test("a141TitleNamesTheSibling: '<generic title>, <subcategory name>' lands in that subcategory", () => {
  assert.equal(sub("Senior Software Engineer, Frontend"), "swe.frontend");
  assert.equal(sub("Software Engineer, Backend"), "swe.backend");
  assert.equal(sub("Software Engineer, Full Stack (People Innovation)"), "swe.fullstack");
  assert.equal(sub("Senior Software Engineer, Backend (Product Engineering)"), "swe.backend");
  assert.equal(sub("Security Engineer, Offensive Security"), "sec.offensive");
  assert.equal(sub("Software Engineer"), "swe.general", "a title that says nothing more stays general");
});

test("a141AliasesFromTheBoard: the board's recurring specific titles are aliases; ambiguous ones are not", () => {
  assert.equal(sub("Full Stack Software Engineer"), "swe.fullstack");
  assert.equal(sub("Business Development Representative"), "sales.sdr");
  assert.equal(sub("Recruiting Coordinator"), "hr.recruiting");
  assert.equal(sub("Product Counsel"), "law.corporate");
  assert.equal(sub("Head of Product"), "pm.core");
  assert.equal(sub("Underwriting Analyst"), "biz.risk");
  assert.equal(taxonomy().version, "2", "a new taxonomy version — the backfill re-reads every posting once");
});

test("a141DescriptionDecidesOnlyWhenClear: ≥ DESC_MIN of one sibling's terms and DESC_MARGIN ahead; else general", () => {
  assert.ok(DESC_MIN >= 4 && DESC_MARGIN >= 3);
  const swe = taxonomy().byId.get("software-engineering");
  const norm = (s) => ` ${s.toLowerCase().replace(/[^a-z0-9+#./]+/g, " ").trim()} `;
  assert.equal(descriptionPick(swe, norm("We build with Swift, SwiftUI and UIKit and ship to the App Store every week"))?.id, "swe.ios");
  assert.equal(descriptionPick(swe, norm("Swift and Kotlin, the App Store and the Play Store.")), null, "a close race stays general");
  assert.equal(sub("Software Engineer", "You will write Swift with SwiftUI and UIKit and own our App Store releases"), "swe.ios");
  assert.equal(sub("Software Engineer", "C++ services and APIs."), "swe.general");
});
