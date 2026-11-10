// ⭐ FIRST PRIORITY (B)-3 (45o, owner 11-08) · Apply for me never jumps family silently — the spec's named tests:
// b3FamilyChangePausesApplyForMe · b3LevelChangeDoesNotPause. Synthetic résumés only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { getRegistry } from "../routes/domainProfiles.js";
import { followProfileText } from "../services/resumeOnboarding.js";
import { snapshotForReplace, recordReplacement, undoReplacement } from "../services/profileReplace.js";
import { familyMoved, pauseOnFamilyMove, applyPausedForFamily, answerFamilyMove } from "../services/placement.js";

const BACKEND = "Jordan Example\nSenior Backend Engineer, Northwind (2019 - present)\nBuilt APIs and services on Postgres and Kafka queues; owned databases and on-call.\nSoftware Engineer, Contoso (2015 - 2019)";
const CONSTRUCTION = "Jordan Example\nConstruction Project Manager, Brickworks (2016 - present)\nRan site schedules, subcontractors, budgets and safety for commercial builds.\nAssistant Project Manager, Mason & Co (2012 - 2016)";
function freshDb(mode = "auto") {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'a', 'x')").run();
  db.prepare("UPDATE users SET send_mode = ? WHERE id = 1").run(mode);
  db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (10, 1, 'My job profile', 'general', 'general', 1)").run();
  followProfileText(db, 10, BACKEND, { registry: getRegistry() });
  return db;
}
const before = (db) => snapshotForReplace(db, 1, 10, { content: BACKEND, name: "old.pdf" });
const row = (db) => db.prepare("SELECT domain, placement_category, placement_subcategory, apply_paused_at FROM domain_profiles WHERE id = 10").get();

test("b3FamilyChangePausesApplyForMe · a category move on full auto pauses Apply for me; the scheduler skips; Keep lifts it", () => {
  const db = freshDb("auto");
  const snap = before(db);
  followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  const r = pauseOnFamilyMove(db, 1, 10, snap.domainProfile);
  assert.equal(r.paused, true);
  assert.ok(applyPausedForFamily(db, 1));
  answerFamilyMove(db, 1, true);
  assert.equal(applyPausedForFamily(db, 1), false);
  assert.equal(row(db).domain, "pm_construction", "Keep follows the new family");
  const sched = fs.readFileSync("services/autoScheduler.js", "utf8");
  assert.match(sched, /if \(mode === "apply" && applyPausedForFamily\(db, u\.id\)\) \{ res\.push\(\{ userId: u\.id, skipped: "family_changed" \}\); return res; \}/);   // A166: the tick body is runOneUser
});

test("b3 · Change back restores the old family; Undo of the replace also lifts the pause", () => {
  const db = freshDb("auto");
  const was = row(db);
  const snap = before(db);
  followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  pauseOnFamilyMove(db, 1, 10, snap.domainProfile);
  answerFamilyMove(db, 1, false);
  const back = row(db);
  assert.equal(back.placement_category, was.placement_category);
  assert.equal(back.domain, was.domain);
  assert.equal(back.apply_paused_at, null);
  // Undo
  const snap2 = before(db);
  followProfileText(db, 10, CONSTRUCTION, { registry: getRegistry() });
  pauseOnFamilyMove(db, 1, 10, snap2.domainProfile);
  const rid = recordReplacement(db, 1, 10, snap2, { lines: [] }, { name: "new.pdf" });
  undoReplacement(db, 1, rid);
  assert.equal(row(db).apply_paused_at, null, "Undo lifts the pause with the placement");
  assert.throws(() => answerFamilyMove(db, 1, true), /Nothing is waiting/);
});

test("b3LevelChangeDoesNotPause · level-only / same-category moves, first placements and semi mode never pause", () => {
  assert.equal(familyMoved({ placement_category: "swe", placement_level: "mid" }, { placement_category: "swe", placement_level: "senior" }), false);
  assert.equal(familyMoved({ placement_category: "swe", placement_subcategory: "swe.backend" }, { placement_category: "swe", placement_subcategory: "swe.frontend" }), false);
  assert.equal(familyMoved({ placement_category: null }, { placement_category: "swe" }), false, "a first placement isn't a move");
  const db = freshDb("auto");
  const snap = before(db);
  followProfileText(db, 10, BACKEND.replace("Senior Backend", "Staff Backend"), { registry: getRegistry() });
  assert.equal(pauseOnFamilyMove(db, 1, 10, snap.domainProfile).paused, false);
  const semi = freshDb("semi");
  const s2 = before(semi);
  followProfileText(semi, 10, CONSTRUCTION, { registry: getRegistry() });
  assert.equal(pauseOnFamilyMove(semi, 1, 10, s2.domainProfile).paused, false, "semi never sends — it just follows");
  assert.equal(applyPausedForFamily(semi, 1), false);
});

test("b3 · wired: the replace route pauses, What changed shows Keep · Change back", () => {
  const dp = fs.readFileSync("routes/domainProfiles.js", "utf8");
  assert.match(dp, /familyPause = pauseOnFamilyMove\(db, req\.user\.id, profile\.id, snap\.domainProfile\)/);
  assert.match(fs.readFileSync("routes/profileSections.js", "utf8"), /\/api\/profile\/apply-for-me\/:answer/);
  const ui = fs.readFileSync("client/src/pages/profile/YourProfile.jsx", "utf8");
  assert.match(ui, /l\.what === "apply_for_me" \? \(/);
  assert.match(ui, /data-family-keep=""/);
  assert.match(ui, /data-family-change-back=""/);
});
