// A111 P1 (11-02): the crawl across industries found shift, floor, store and branch-counter roles placed in business /
// sales / management by the generic coordinator | specialist | associate | manager rules. D127's red-flag rule: HELD.
// Titles are the measured ones from the crawl (data/a111/wrong.json, the DB copy's diff), plus the near misses that
// must stay placed — computing titles share words with them ("Data Warehouse Engineer", "Kernel Driver Engineer").
import test from "node:test";
import assert from "node:assert/strict";
import { categoryOf } from "../services/jobs/professionalScope.js";

const HELD = [
  "Target Security Specialist", "Seasonal Target Security Specialist - Flow Center", "Production Associate - 2nd Shift",
  "Production Associate 3rd Shift", "Vans: Sales Lead - Northstar Mall", "Personal Banker Associate I",
  "Retail Personal Banker Associate II", "Kitchen Operations Associate, DashMart", "Female Locker Room Associate, Seattle",
  "Retail Shop Manager on Duty, Brickell", "Warehouse Returns Associate - Night Shift", "Manufacturing Associate - Kitting (Temp)",
  "Asset Protection Coordinator - Dallas Galleria", "General Manager - Maine Mall", "Fleet Operations Associate (Overnight Shift)",
];
// Computing titles that share a held word. ⚠ Both read held:unknown before A111 too (D78's csScope does not list them —
// its own gap, not this rule's); asserted here only that the non-professional rule never catches them.
const NOT_NON_PROFESSIONAL = ["Data Warehouse Engineer", "Linux Kernel Driver Engineer", "Distribution Center Manager"];
const PLACED = [
  ["Distribution Center Manager", "management"],
  ["Senior Financial Analyst, Primal Kitchen", "business"], ["Manager, Merchandising - Seasonal Decor & Faux Plants", "management"],
  ["Assortment Strategist, Outlet", "business"], ["Principal Product Manager, Kitchen Commercial Lead", "management"],
  ["Business Analyst", "business"], ["Account Executive", "sales"], ["Associate Counsel", "legal"], ["Research Associate", "science"],
  ["Security Engineer", "computing"], ["Information Security Risk Specialist", "business"],
];

test("a111NonProfessionalHeld: shift, floor, store and branch-counter roles are held, never placed", () => {
  for (const title of HELD) {
    const v = categoryOf({ title });
    assert.equal(v.inScope, false, `${title} → ${v.category}`);
    assert.equal(v.reason, "held:non_professional", title);
  }
});

test("a111NearMissesStayPlaced: titles sharing a word with a held role keep their category", () => {
  for (const [title, category] of PLACED) assert.equal(categoryOf({ title }).category, category, title);
  for (const title of NOT_NON_PROFESSIONAL) assert.notEqual(categoryOf({ title }).reason, "held:non_professional", title);
});

test("a111ScienceFamilyKnown: a science profile with no title signal reads as low confidence, not unknown", () => {
  assert.equal(categoryOf({ title: "Bench Lead II", roleKey: "science" }).reason, "held:low_confidence");
});
