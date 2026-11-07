// ⛔ Owner 11-07: "in the admin panel design an override to decide which user gets what level of access to site. the
// reviewer from yc should be able to visit current state of site. i should be able decide who gets what level of
// access" — picked: Full · Standard · No access. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setAccessLevel, accessLevelOf, personDetail, ACCESS_LEVELS, isSuspended } from "../services/userAdmin.js";
import { resolveEntitlement, hasFullAccess } from "../services/entitlementResolver.js";
import { checkLimit } from "../services/limitEnforcer.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ADMIN = { kind: "admin", ref: "admin:adm_owner" };
function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, plan_tier) VALUES (11, 'yc-reviewer', 'x', 'BASIC'), (12, 'someone', 'x', 'BASIC')").run();
  return db;
}
const level = (db, id) => accessLevelOf(db.prepare("SELECT status, full_access FROM users WHERE id = ?").get(id));

test("accessThreeLevels: Full · Standard · No access, set with a reason and one audit row each", () => {
  const db = db0();
  assert.deepEqual(ACCESS_LEVELS, ["full", "standard", "none"]);
  assert.equal(level(db, 11), "standard", "an account starts Standard");
  assert.throws(() => setAccessLevel(db, { userId: 11, level: "full", reason: "", actorId: ADMIN }), /reason/i);
  assert.throws(() => setAccessLevel(db, { userId: 11, level: "admin", reason: "YC review", actorId: ADMIN }), /one of full, standard, none/);
  setAccessLevel(db, { userId: 11, level: "full", reason: "YC reviewer", actorId: ADMIN });
  assert.equal(level(db, 11), "full");
  assert.equal(personDetail(db, 11).account.access, "full");
  assert.throws(() => setAccessLevel(db, { userId: 11, level: "full", reason: "again", actorId: ADMIN }), /already has Full/);
  setAccessLevel(db, { userId: 12, level: "none", reason: "spam signups", actorId: ADMIN });
  assert.equal(level(db, 12), "none");
  assert.equal(isSuspended(db, 12), true, "No access is the existing gate: refused on every request");
  setAccessLevel(db, { userId: 12, level: "standard", reason: "cleared", actorId: ADMIN });
  assert.equal(level(db, 12), "standard");
  assert.equal(isSuspended(db, 12), false);
  const rows = db.prepare("SELECT action, reason, before_json, after_json FROM admin_audit_log WHERE action = 'user.access.set' ORDER BY id").all();
  assert.deepEqual(rows.map(r => [r.reason, JSON.parse(r.before_json).access, JSON.parse(r.after_json).access]),
    [["YC reviewer", "standard", "full"], ["spam signups", "standard", "none"], ["cleared", "none", "standard"]]);
});

test("accessFullLiftsThePlanNotTheSafetyCaps: the top plan's tools, unlimited résumés, the most Drafts — never auto-apply or the A+ swap", () => {
  const db = db0();
  const before = (k) => resolveEntitlement(db, 11, k, { ctx: { monetisation: true } });
  assert.equal(before("a_plus_enabled").value, false, "BASIC with monetisation on: no A+");
  const capBefore = before("apply_daily_submission_cap").value;
  setAccessLevel(db, { userId: 11, level: "full", reason: "YC reviewer", actorId: ADMIN });
  assert.equal(hasFullAccess(db, 11), true);
  const r = (k) => resolveEntitlement(db, 11, k, { ctx: { monetisation: true } });
  assert.deepEqual([r("a_plus_enabled").value, r("a_plus_enabled").source], [true, "access"]);
  assert.equal(r("generate_enabled").value, true);
  assert.equal(r("resume_generations_per_day").value, null, "unlimited");
  assert.equal(r("draft_slots").value, 100, "the ceiling");
  assert.equal(r("apply_daily_submission_cap").value, capBefore, "the apply-safety caps are untouched");
  assert.equal(r("a_plus_default").value, false, "Full never swaps Generate for A+");
  assert.equal(r("auto_apply_mode").source === "access", false, "auto-apply is hard — never lifted");
  db.prepare("INSERT INTO user_limits (user_id, daily_resumes, monthly_resumes) VALUES (11, 0, 0)").run();
  assert.equal(checkLimit(db, 11, "resume_generate").allowed, true, "no plan limit applies to Full");
  setAccessLevel(db, { userId: 11, level: "standard", reason: "review over", actorId: ADMIN });
  assert.equal(checkLimit(db, 11, "resume_generate").allowed, false, "Standard is the plan's limits again");
});

test("accessIsTheAdminsControl: the route behind requireAdmin signs a No-access account out; the person page offers all three", () => {
  const route = read("routes/adminPeople.js");
  const r = route.slice(at(route, 'r.post("/:id/access", requireAdmin, async (req, res) => {'), at(route, 'r.post("/:id/plan", requireAdmin,'));
  assert.match(r, /setAccessLevel\(db, \{ userId: id\(req\), level: req\.body\?\.level, reason: reasonOf\(req\), actorId: actor\(req\) \}\)/);
  assert.match(r, /if \(out\.signOut\) await signOutEverywhere\(id\(req\), "admin_access_none"\);/);
  const ui = read("client/src/panels/adminPeople.jsx");
  assert.match(ui, /\[\["full", "Full — everything, no plan limits"\], \["standard", "Standard — the plan's limits"\], \["none", "No access — refused and signed out"\]\]/);
  assert.match(ui, /run: \(v\) => post\("\/access", \{ level: v\.level, reason: v\.reason \}\)/);
});
