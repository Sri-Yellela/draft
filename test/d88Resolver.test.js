// D88 P1 (owner, 10-09): ONE resolver for every per-user cap and permission — and NO change in any default.
// Each test compares the resolver with the computation the old code did, across the inputs that decide it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { FEATURES, FEATURE_KEYS, DECK_SIZE_DEFAULT, BYO_DAILY_CAP_DEFAULT } from "../shared/entitlements.js";
import { resolveEntitlement, resolveAll } from "../services/entitlementResolver.js";
import { canUseGenerate, canUseAPlusResume, PLAN_TIERS } from "../services/entitlements.js";
import { draftSlotLimit, draftSlots } from "../services/draftSlots.js";
import { DECK_SIZE } from "../services/dailyDraft.js";
import { checkLimit } from "../services/limitEnforcer.js";
import { setSetting, FULL_AUTO_KEY } from "../services/appSettings.js";

function db() {
  const d = new Database(":memory:");
  d.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'BASIC', aplus_resume INTEGER DEFAULT 0);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
    CREATE TABLE user_limits (user_id INTEGER PRIMARY KEY, daily_resumes INTEGER, monthly_resumes INTEGER, monthly_ats_scores INTEGER,
      daily_job_scrapes INTEGER, monthly_job_scrapes INTEGER, monthly_pdf_exports INTEGER, monthly_apply_runs INTEGER);
    CREATE TABLE usage_events (id INTEGER PRIMARY KEY, user_id INTEGER, event_type TEXT, success INTEGER, created_at INTEGER);
  `);
  d.prepare("INSERT INTO users (id, username, plan_tier) VALUES (1, 'u', 'BASIC')").run();
  return d;
}
const r = (d, f, opts) => resolveEntitlement(d, 1, f, opts);

test("D88 P1: every feature resolves, and the registry's two fallbacks are the old ones", () => {
  const d = db();
  assert.deepEqual(Object.keys(resolveAll(d, 1)), FEATURE_KEYS);
  assert.equal(DECK_SIZE_DEFAULT, DECK_SIZE, "the draft-slot fallback is the Deck's size");
  assert.equal(BYO_DAILY_CAP_DEFAULT, 50);
});

test("D88 P1: Generate and A+ — the same plan rule as requireToolEntitlement, monetisation on and off", () => {
  const d = db();
  for (const tier of [...PLAN_TIERS, null, "bogus"]) {
    d.prepare("UPDATE users SET plan_tier = ? WHERE id = 1").run(tier);
    for (const on of [true, false]) {
      const env = { MONETISATION_ENABLED: on ? "1" : "0" };
      assert.equal(r(d, "generate_enabled", { env }).value, on ? canUseGenerate(tier) : true, `generate ${tier} ${on}`);
      assert.equal(r(d, "a_plus_enabled", { env }).value, on ? canUseAPlusResume(tier) : true, `a+ ${tier} ${on}`);
    }
  }
  d.prepare("UPDATE users SET plan_tier = 'PRO' WHERE id = 1").run();
  assert.equal(r(d, "a_plus_enabled", { env: { MONETISATION_ENABLED: "1" } }).source, "plan");
});

test("D88 P1: draft slots — draftSlotLimit(env) for every env value, and draftSlots reports it", () => {
  const d = db();
  for (const v of [undefined, "7", "0", "-3", "abc", "12.9", "500"]) {
    const env = v === undefined ? {} : { DAILY_DRAFT_SLOTS: v };
    assert.equal(r(d, "draft_slots", { env }).value, draftSlotLimit(env), `DAILY_DRAFT_SLOTS=${v}`);
  }
  assert.equal(draftSlots(d, 1, { env: { DAILY_DRAFT_SLOTS: "7" } }).limit, 7);
  assert.equal(draftSlots(d, 1, { env: {} }).limit, DECK_SIZE);
});

test("D88 P1: résumé limits — user_limits is the override, unlimited without a row; checkLimit still refuses at the limit", () => {
  const d = db();
  assert.deepEqual([r(d, "resume_generations_per_day").value, r(d, "resume_generations_per_day").source], [null, "system"]);
  d.prepare("INSERT INTO user_limits (user_id, daily_resumes, monthly_resumes) VALUES (1, 2, NULL)").run();
  assert.deepEqual([r(d, "resume_generations_per_day").value, r(d, "resume_generations_per_day").source], [2, "override"]);
  assert.equal(r(d, "resume_generations_per_month").value, null);
  const now = Math.floor(Date.now() / 1000);
  for (let i = 0; i < 2; i++) d.prepare("INSERT INTO usage_events (user_id, event_type, success, created_at) VALUES (1, 'resume_generate', 1, ?)").run(now);
  const c = checkLimit(d, 1, "resume_generate");
  assert.equal(c.allowed, false);
  assert.equal(c.limit, 2);
});

test("D88 P1: the A+ swap — users.aplus_resume is the override, off otherwise", () => {
  const d = db();
  assert.deepEqual([r(d, "a_plus_default").value, r(d, "a_plus_default").source], [false, "system"]);
  d.prepare("UPDATE users SET aplus_resume = 1 WHERE id = 1").run();
  assert.deepEqual([r(d, "a_plus_default").value, r(d, "a_plus_default").source], [true, "override"]);
});

test("D88 P1: the plugin — the operator's switch is GLOBAL, and the cap reads the same setting with the same bounds", () => {
  const d = db();
  assert.deepEqual([r(d, "plugin_byo").value, r(d, "plugin_byo").source], [false, "global"], "OFF by default");
  setSetting(d, "byom_enabled", true);
  assert.deepEqual([r(d, "plugin_byo").value, r(d, "plugin_byo").source], [true, "system"]);
  for (const [v, want] of [[null, 50], ["5", 5], ["0", 50], ["1000", 1000], ["2000", 50], ["x", 50]]) {
    if (v === null) d.prepare("DELETE FROM app_settings WHERE key = 'byom_daily_cap'").run(); else setSetting(d, "byom_daily_cap", v);
    assert.equal(r(d, "byo_daily_cap").value, want, `byom_daily_cap=${v}`);
  }
});

test("D88 P1: the apply caps — the same env variables and fallbacks", () => {
  const d = db();
  const cases = { apply_daily_queue_cap: ["APPLY_DAILY_QUEUE_CAP", 40], apply_daily_approval_cap: ["APPLY_DAILY_APPROVAL_CAP", 30], apply_daily_submission_cap: ["APPLY_DAILY_CAP", 25] };
  for (const [f, [name, dflt]] of Object.entries(cases)) {
    assert.equal(r(d, f, { env: {} }).value, dflt);
    assert.equal(r(d, f, { env: { [name]: "9" } }).value, 9);
    assert.equal(r(d, f, { env: { [name]: "0" } }).value, dflt);
  }
});

test("⛔ D88 P1: full auto stays LOCKED unless proven AND the kill switch is off — and no override reaches it", () => {
  const d = db();
  const mode = (proven, env = {}) => r(d, "auto_apply_mode", { env, ctx: { fullAutoProven: proven } });
  assert.deepEqual([mode(false).value, mode(false).source], ["locked", "global"]);
  setSetting(d, FULL_AUTO_KEY, true);
  assert.equal(mode(true).value, "locked", "the kill switch");
  setSetting(d, FULL_AUTO_KEY, false);
  assert.equal(mode(true).value, "unlocked");
  assert.equal(FEATURES.auto_apply_mode.hard, true, "a hard feature skips the override layer");
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /\nconst FULL_AUTO_PROVEN = false;\r?\n/, "still false in the code");
});

test("D88 P1: the order holds — global beats override beats plan beats system; a ceiling holds an override only", () => {
  const d = db();
  setSetting(d, "byom_daily_cap", "5");
  assert.equal(r(d, "byo_daily_cap").source, "global");
  d.prepare("INSERT INTO user_limits (user_id, daily_resumes) VALUES (1, 3)").run();
  assert.equal(r(d, "resume_generations_per_day").source, "override");
  assert.equal(r(d, "draft_slots", { env: { DAILY_DRAFT_SLOTS: "500" } }).value, 500, "the system default is never clamped");
});

test("D88 P1: the call sites read the resolver", () => {
  const read = (f) => fs.readFileSync(f, "utf8");
  assert.match(read("services/draftSlots.js"), /resolveEntitlement\(db, userId, "draft_slots", \{ env \}\)\.value/);
  assert.match(read("services/limitEnforcer.js"), /resolveEntitlement\(db, userId, 'resume_generations_per_day'\)/);
  assert.match(read("services/byom/policy.js"), /resolveEntitlement\(db, null, "plugin_byo"\)/);
  // 10-09: the cap is read PER USER (an admin's override is enforced); still through the resolver.
  assert.match(read("services/byom/policy.js"), /resolveEntitlement\(db, (?:null|userId), "byo_daily_cap"\)/);
  const server = read("server.js");
  assert.match(server, /resolveEntitlement\(db, req\.user\?\.id, tool === "a_plus_resume" \? "a_plus_enabled" : "generate_enabled"/);
  const apply = read("routes/apply.js");
  for (const f of ["apply_daily_submission_cap", "apply_daily_queue_cap", "apply_daily_approval_cap", "auto_apply_mode"]) assert.match(apply, new RegExp(`resolveEntitlement\\(db, null, "${f}"`));
});
