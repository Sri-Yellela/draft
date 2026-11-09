// ⭐ FIRST PRIORITY (B)-1 (45o, owner 11-08) · ONE PLACEMENT, ONE SOURCE — the spec's named tests: b1PlacementWritesJobProfileRole
// · b1RegistryMapsToTaxonomy · b1LowConfidenceAsks. Synthetic résumés only.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { taxonomy } from "../services/jobs/taxonomyClassify.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { placeText, writePlacement, storedPlacement, registryKeyFor, pickPlacement, PLACE_MIN_CONFIDENCE } from "../services/placement.js";
import { followProfileText } from "../services/resumeOnboarding.js";

const BACKEND = "Jordan Example\nSenior Backend Engineer, Northwind (2019 - present)\nBuilt APIs and services on Postgres and Kafka queues; owned databases and on-call.\nSoftware Engineer, Contoso (2015 - 2019)";
const CONSTRUCTION = "Sam Example\nConstruction Project Manager, Brickworks (2016 - present)\nRan site schedules, subcontractors, budgets and safety for commercial builds.\nAssistant Project Manager, Mason & Co (2012 - 2016)";
function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')").run();
  db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (10, 1, 'My job profile', 'general', 'general', 1), (11, 1, 'Second', 'engineering', 'engineering', 0)").run();
  return db;
}

test("b1RegistryMapsToTaxonomy · every taxonomy category (and each mapped subcategory) names a real D101 registry key", () => {
  const tax = taxonomy(), reg = getRegistry();
  assert.ok(tax.registryMap, "the map travels with the taxonomy");
  for (const c of tax.categories) assert.ok(reg[tax.registryMap.categories[c.id]], `${c.id} → ${tax.registryMap.categories[c.id]}`);
  for (const [s, k] of Object.entries(tax.registryMap.subcategories)) {
    assert.ok(tax.categories.some(c => c.subs.some(x => x.id === s)), `${s} is a subcategory`);
    assert.ok(reg[k], `${s} → ${k}`);
  }
  assert.equal(registryKeyFor("project-program-management", "proj.construction"), "pm_construction", "a subcategory's entry wins");
  assert.equal(registryKeyFor("project-program-management", "proj.agile"), "project_management", "else its category's");
});

test("b1PlacementWritesJobProfileRole · a placed résumé writes the job profile's domain / family AND its placement", () => {
  const db = freshDb();
  const p = placeText(BACKEND, { titles: ["Senior Backend Engineer", "Software Engineer"] });
  assert.equal(p.placed, true);
  assert.equal(p.category, "software-engineering");
  assert.equal(p.subcategory, "swe.backend");
  assert.ok(p.confidence >= PLACE_MIN_CONFIDENCE);
  writePlacement(db, 10, p, getRegistry());
  const row = db.prepare("SELECT domain, role_family, placement_category, placement_subcategory, placement_confidence FROM domain_profiles WHERE id = 10").get();
  assert.deepEqual([row.domain, row.role_family, row.placement_category, row.placement_subcategory], ["engineering", "engineering", "software-engineering", "swe.backend"]);
  const s = storedPlacement(db, 1);
  assert.equal(s.subName, "Backend", "the profile page reads the same placement");
  assert.equal(db.prepare("SELECT placed_at FROM domain_profiles WHERE id = 11").pluck().get(), null, "B-4: the other profile is untouched");
});

test("b1 · a construction-PM résumé through followProfileText moves the role across families via the map", () => {
  const db = freshDb();
  const out = followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  assert.equal(out.placement?.placed, true);
  assert.equal(out.placement.category, "project-program-management");
  const row = db.prepare("SELECT domain, placement_subcategory FROM domain_profiles WHERE id = 10").get();
  assert.equal(row.domain, "pm_construction");
  assert.equal(row.placement_subcategory, "proj.construction");
});

test("b1LowConfidenceAsks · below the line nothing is guessed: the role stays, the page asks, a pick writes it", () => {
  const db = freshDb();
  const p = placeText("Notes\nThings I did", { titles: ["Generalist"] });
  assert.equal(p.placed, false);
  writePlacement(db, 10, p, getRegistry());
  const row = db.prepare("SELECT domain, placement_category, placed_at FROM domain_profiles WHERE id = 10").get();
  assert.equal(row.domain, "general", "the role is left as it was");
  assert.equal(row.placement_category, null);
  assert.ok(row.placed_at != null);
  assert.deepEqual(storedPlacement(db, 1), { asks: true, confidence: p.confidence }, "the page says: we couldn't place you — pick your role");
  pickPlacement(db, 1, "mkt.seo", getRegistry());
  const after = db.prepare("SELECT domain, placement_subcategory, placement_confidence FROM domain_profiles WHERE id = 10").get();
  assert.deepEqual([after.domain, after.placement_subcategory, after.placement_confidence], ["digital_marketing", "mkt.seo", 1]);
  assert.throws(() => pickPlacement(db, 1, "nope.nope", getRegistry()), (e) => e.code === "bad_role");
});
