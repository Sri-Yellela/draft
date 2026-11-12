// ⭐ D88 P2 + P4 · user management — the row's ⛔ TESTS that apply to this phase (39d). Each was mutated red and
// restored (the commit message lists them). Synthetic people only.
import { allowLegacyAdminRows } from "../test-support/legacyAdminRows.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { resolveEntitlement } from "../services/entitlementResolver.js";
import { setOverride, clearOverride, setStatus, addNote, listPeople, personDetail, isSuspended, checkOverrideValue, UserAdminError } from "../services/userAdmin.js";
import { draftSlots } from "../services/draftSlots.js";
import { setSetting } from "../services/appSettings.js";
import { at } from "../test-support/sourceAnchors.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SERVER = lf("server.js");

function people() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  allowLegacyAdminRows(db);   // a pre-162 admin row, to prove it is never listed (test-support/legacyAdminRows.js)
  db.prepare("INSERT INTO users (id, username, password_hash, is_admin, plan_tier) VALUES (1, 'admin', 'x', 1, 'PRO')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, plan_tier) VALUES (2, 'ada', 'x', 'BASIC'), (3, 'grace', 'x', 'PLUS')").run();
  db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (0, 'system', 'x')").run();
  db.prepare(`INSERT INTO user_profile (user_id, first_name, last_name, email, phone, requires_sponsorship, work_auth, gender, ethnicity, veteran_status, disability_status, visa_type, has_clearance)
              VALUES (2, 'Ada', 'Lovelace', 'ada@example.com', '+1 555 0100', 'yes', 'citizen', 'f', 'x', 'no', 'no', 'H1B', 1)`).run();
  return db;
}
const REASON = "support ticket 12";

test("D88 · the resolver's order holds with an override: the override beats the plan and the system; a global switch beats the override", () => {
  const db = people();
  assert.equal(resolveEntitlement(db, 2, "draft_slots").source, "system");
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 25, reason: REASON, actorId: 1 });
  const r = resolveEntitlement(db, 2, "draft_slots");
  assert.deepEqual([r.value, r.source], [25, "override"]);
  assert.match(r.detail, /override by an admin — support ticket 12/);
  // the plugin: an override cannot reopen it while the operator's switch is off (GLOBAL wins)
  setOverride(db, { userId: 2, featureKey: "plugin_byo", value: true, reason: REASON, actorId: 1 });
  assert.equal(resolveEntitlement(db, 2, "plugin_byo").source, "global");
  setSetting(db, "byom_enabled", "1");
  assert.deepEqual([resolveEntitlement(db, 2, "plugin_byo").value, resolveEntitlement(db, 2, "plugin_byo").source], [true, "override"]);
  // another user is untouched
  assert.equal(resolveEntitlement(db, 3, "draft_slots").source, "system");
});

test("D88 · ⛔ a per-user override cannot unlock full auto or pass a ceiling — refused, with the reason", () => {
  const db = people();
  assert.throws(() => setOverride(db, { userId: 2, featureKey: "auto_apply_mode", value: "unlocked", reason: REASON, actorId: 1 }), /cannot be set per user/);
  assert.throws(() => setOverride(db, { userId: 2, featureKey: "draft_slots", value: 101, reason: REASON, actorId: 1 }), /cannot go above 100/);
  assert.throws(() => checkOverrideValue("plugin_byo", "yes"), /on or off/);
  assert.throws(() => checkOverrideValue("nope", 1), /no feature called nope/);
  // even a row written behind the service's back cannot reach full auto: the resolver never reads an override for a hard feature
  db.prepare("INSERT INTO user_entitlement_overrides (user_id, feature_key, value_json, reason) VALUES (2, 'auto_apply_mode', '\"unlocked\"', 'x')").run();
  assert.equal(resolveEntitlement(db, 2, "auto_apply_mode", { env: { APPLY_FULL_AUTO_DISABLED: "1" } }).value, "locked");
  db.prepare("INSERT INTO user_entitlement_overrides (user_id, feature_key, value_json, reason) VALUES (3, 'draft_slots', '500', 'x')").run();
  assert.equal(resolveEntitlement(db, 3, "draft_slots").value, 100, "a row past the ceiling is clamped by the resolver");
});

test("D88 · the cap is enforced where it is used: an override on draft_slots is the limit the server's draft check reads", () => {
  const db = people();
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 2, reason: REASON, actorId: 1 });
  assert.equal(draftSlots(db, 2).limit, 2);
  db.prepare("INSERT INTO draft_slot_uses (user_id, kind, job_id) VALUES (2, 'generate', 'a'), (2, 'generate', 'b')").run();
  assert.equal(draftSlots(db, 2).remaining, 0);
  assert.ok(at(SERVER, "if (slots.remaining <= 0) return res.status(429).json(slotsExhausted(slots));") > 0, "/api/generate refuses at zero");
  clearOverride(db, { userId: 2, featureKey: "draft_slots", reason: REASON, actorId: 1 });
  assert.equal(draftSlots(db, 2).limit, 10, "cleared: back to the system's 10");
});

test("D88 · an expired override is not live; clearing never deletes — the row is revoked and kept", () => {
  const db = people();
  const { id } = setOverride(db, { userId: 2, featureKey: "draft_slots", value: 30, reason: REASON, actorId: 1, expiresAt: Math.floor(Date.now() / 1000) + 3600 });
  db.prepare("UPDATE user_entitlement_overrides SET expires_at = unixepoch() - 1 WHERE id = ?").run(id);
  assert.equal(resolveEntitlement(db, 2, "draft_slots").source, "system");
  assert.throws(() => setOverride(db, { userId: 2, featureKey: "draft_slots", value: 30, reason: REASON, actorId: 1, expiresAt: 5 }), /in the future/);
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 30, reason: REASON, actorId: 1 });
  clearOverride(db, { userId: 2, featureKey: "draft_slots", reason: REASON, actorId: 1 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_entitlement_overrides WHERE user_id = 2").get().n, 2, "both rows kept");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM user_entitlement_overrides WHERE user_id = 2 AND revoked_at IS NOT NULL").get().n, 1);
});

test("D88 · ⛔ every admin write writes an audit row with its reason, and the person's timeline shows it", () => {
  const db = people();
  assert.throws(() => setOverride(db, { userId: 2, featureKey: "draft_slots", value: 5, reason: "", actorId: 1 }), /Say why/);
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 5, reason: REASON, actorId: 1 });
  clearOverride(db, { userId: 2, featureKey: "draft_slots", reason: "back to normal", actorId: 1 });
  setStatus(db, { userId: 2, status: "suspended", reason: "abuse report", actorId: 1 });
  setStatus(db, { userId: 2, status: "active", reason: "resolved", actorId: 1 });
  addNote(db, { userId: 2, body: "called on 10-09", actorId: 1 });
  const t = personDetail(db, 2).activity;
  assert.deepEqual(t.map(a => a.action), ["user.note", "user.unsuspend", "user.suspend", "user.override.clear", "user.override.set"]);
  assert.deepEqual(t.slice(1).map(a => a.reason), ["resolved", "abuse report", "back to normal", REASON]);
  assert.ok(t.every(a => a.actor === "admin"));
  assert.deepEqual(t.find(a => a.action === "user.override.set").after.value, 5);
  // the routes write through the same service — plan, sign-out and reset links write their own rows
  const routes = lf("routes/adminPeople.js");
  for (const action of ["user.plan", "user.sign_out_everywhere", "user.reset_link"]) assert.match(routes, new RegExp(`action: "${action.replace(".", "\\.")}"`));
});

test("D88 · ⛔ no eligibility, EEO, phone or address field appears in any module", () => {
  const db = people();
  const all = JSON.stringify(personDetail(db, 2)) + JSON.stringify(listPeople(db, {}));
  for (const banned of ["sponsorship", "work_auth", "gender", "ethnicity", "veteran", "disability", "visa", "clearance", "H1B", "555 0100", "phone", "address"]) {
    assert.ok(!all.toLowerCase().includes(banned.toLowerCase()), `${banned} reached a module`);
  }
  assert.equal(personDetail(db, 2).account.email, "ada@example.com", "the contact the work needs is there");
});

test("D88 · a suspended account cannot sign in, call the API or use its connected apps; an admin, the system and yourself cannot be suspended", () => {
  const db = people();
  setStatus(db, { userId: 2, status: "suspended", reason: "abuse report", actorId: 1 });
  assert.equal(isSuspended(db, 2), true);
  assert.equal(isSuspended(db, 3), false);
  assert.throws(() => setStatus(db, { userId: 1, status: "suspended", reason: REASON, actorId: 3 }), /admin account cannot be suspended/);
  assert.throws(() => setStatus(db, { userId: 0, status: "suspended", reason: REASON, actorId: 1 }), /system account/);
  assert.throws(() => setStatus(db, { userId: 3, status: "suspended", reason: REASON, actorId: 3 }), /your own account/);
  // sign-in, every authenticated request, and the plugin's token check
  const strategy = SERVER.slice(at(SERVER, "async function localSignInVerify("), at(SERVER, "passport.serializeUser("));
  assert.ok(at(strategy, 'if (user.status === "suspended") return done(null, false') > at(strategy, "if (!user || !passwordOk)"));
  const auth = SERVER.slice(at(SERVER, "function requireAuth(req, res, next) {"), at(SERVER, "function requireAdmin(req, res, next) {"));
  assert.match(auth, /if \(req\.user\?\.id != null && isSuspended\(db, req\.user\.id\)\) return res\.status\(403\)/);
  assert.match(lf("services/byom/oauthServer.js"), /status === "suspended"\) return null;/);
  // suspending ends the sessions
  assert.match(lf("routes/adminPeople.js"), /if \(out\.status === "suspended"\) await signOutEverywhere\(id\(req\), "admin_suspend"\);/);
});

test("D88 · the list: the system account is never listed; search and filters; the numbers on top", () => {
  const db = people();
  setStatus(db, { userId: 3, status: "suspended", reason: REASON, actorId: 1 });
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 4, reason: REASON, actorId: 1 });
  const all = listPeople(db, {});
  // ⛔ D95 (owner 10-12): the list is USER accounts only — the legacy admin row is neither listed nor counted.
  assert.deepEqual(all.rows.map(r => r.username).sort(), ["ada", "grace"]);
  assert.deepEqual(all.counts, { total: 2, activeWeek: 0, suspended: 1, withOverride: 1 });
  assert.deepEqual(listPeople(db, { q: "lovelace" }).rows.map(r => r.id), [2]);
  assert.deepEqual(listPeople(db, { q: "ada@example" }).rows.map(r => r.id), [2]);
  assert.deepEqual(listPeople(db, { filter: "suspended" }).rows.map(r => r.id), [3]);
  assert.deepEqual(listPeople(db, { filter: "override" }).rows.map(r => r.id), [2]);
  assert.deepEqual(listPeople(db, { filter: "admins" }).rows.map(r => r.id).includes(1), false, "D95: no filter reaches an admin");
  assert.equal(listPeople(db, {}).rows.find(r => r.id === 2).drafts.limit, 4);
});

test("D88 · the router is admin-only twice over, sets no password, and impersonates no one", () => {
  assert.match(SERVER, /app\.use\("\/api\/admin\/people", requireAdmin, createAdminPeopleRouter\(\{/);
  const routes = lf("routes/adminPeople.js");
  const handlers = [...routes.matchAll(/r\.(get|post|put|patch|delete)\("([^"]+)", ([^,]+),/g)];
  assert.ok(handlers.length >= 8);
  assert.deepEqual(handlers.filter(h => h[3] !== "requireAdmin").map(h => h[2]), []);
  assert.doesNotMatch(routes.replace(/^\/\/.*$/gm, ""), /password_hash|hashPassword|impersonat/i);
  assert.ok(UserAdminError);
});

test("D88 P5 · Settings shows the user's own allowance — an override as theirs, never money, never the A+ swap or its source", async () => {
  const { selfAllowance, SELF_FEATURES } = await import("../services/userAdmin.js");
  const db = people();
  setOverride(db, { userId: 2, featureKey: "draft_slots", value: 25, reason: "support ticket 9", actorId: 1 });
  setOverride(db, { userId: 2, featureKey: "a_plus_default", value: true, reason: "testing the swap", actorId: 1 });
  db.prepare("INSERT INTO usage_events (user_id, event_type, purpose, cost_usd, success) VALUES (2, 'resume_generate', 'resume_generate', 0.07, 1)").run();
  const s = selfAllowance(db, 2);
  assert.equal(s.drafts.limit, 25);
  assert.equal(s.plan, "basic");
  const all = JSON.stringify(s);
  assert.doesNotMatch(all, /a_plus_default|swap|override|support ticket|testing the swap|cost|usd|\$|¢|source|detail/i);
  assert.ok(!SELF_FEATURES.includes("a_plus_default"));
  // D100 (owner 10-30): automatic sending is available unless the operator's kill switch is on.
  assert.equal(s.features.find(f => f.key === "auto_apply_mode").value, "available");
  assert.match(SERVER, /app\.get\("\/api\/account\/allowance", requireAuth, \(req, res\) => \{\n  try \{ res\.json\(selfAllowance\(db, req\.user\.id\)\); \}/);
});
