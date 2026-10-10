// D86 §6: the reviewer account — synthetic, idempotent, never on a board, reset after destructive tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { seedReviewerDemo, resetReviewerDemo, DemoError, DEMO_USERNAME, DEMO_EMAIL, DEMO_POSTINGS, DEMO_CLAIMS, DEMO_DAILY_CAP, DEMO_RESUME } from "../services/reviewerDemo.js";
import { listProfileClaims } from "../services/profileSignalAggregator.js";
import { dailyCap } from "../services/byom/policy.js";

const root = path.resolve(import.meta.dirname, "..");
const SCHEMA = fs.readFileSync(path.join(root, "test/fixtures/reviewerDemoSchema.sql"), "utf8");
const PW = "Synthetic-Reviewer-Pw-2026";

function fresh() {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  return db;
}
const count = (db, sql, ...a) => db.prepare(sql).pluck().get(...a);

test("⛔ D86 §6: the reviewer account is created with its résumé, three claims, the plugin on and a cap of 100", () => {
  const db = fresh();
  assert.throws(() => seedReviewerDemo(db, {}), DemoError, "no password, no account");
  const out = seedReviewerDemo(db, { password: PW });
  assert.equal(out.created, true);
  const u = db.prepare("SELECT * FROM users WHERE username = ?").get(DEMO_USERNAME);
  assert.equal(u.is_admin, 0);
  assert.equal(u.byom_enabled, 1);
  assert.equal(count(db, "SELECT email FROM user_profile WHERE user_id = ?", u.id), DEMO_EMAIL);
  const profileId = count(db, "SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1", u.id);
  assert.equal(count(db, "SELECT content FROM profile_base_resumes WHERE user_id = ? AND profile_id = ?", u.id, profileId), DEMO_RESUME);
  assert.deepEqual(listProfileClaims(db, { userId: u.id, profileId }).skills.sort(), [...DEMO_CLAIMS].sort());
  assert.equal(dailyCap(db, u.id), DEMO_DAILY_CAP);
  assert.notEqual(u.password_hash, PW, "the password is stored hashed");
});

test("⛔ D86 §6: the twelve sample postings have stable ids, say they are samples, and are on NO board (inactive)", () => {
  const db = fresh();
  seedReviewerDemo(db, { password: PW });
  const rows = db.prepare("SELECT job_id, title, description, is_active FROM scraped_jobs ORDER BY job_id").all();
  assert.deepEqual(rows.map(r => r.job_id), Array.from({ length: 12 }, (_, i) => `demo-job-${String(i + 1).padStart(3, "0")}`));
  for (const r of rows) {
    assert.equal(r.is_active, 0, `${r.job_id} would appear on a board`);
    assert.match(r.title, /sample posting for review/);
    assert.match(r.description, /not a real job/);
  }
  assert.match(DEMO_POSTINGS.find(p => p.job_id === "demo-job-007").description, /Kafka/, "the refusal prompt's posting asks for Kafka");
  assert.doesNotMatch(DEMO_RESUME, /Kafka/, "and the résumé has none, so adding it is refused");
  assert.equal(count(db, "SELECT COUNT(*) FROM apply_run_jobs"), 12, "every sample is in the reviewer's Draft House");
});

test("⛔ D86 §6: seeding twice is idempotent; a reset removes what reviewers made and keeps the password", () => {
  const db = fresh();
  const { userId } = seedReviewerDemo(db, { password: PW });
  const hash = count(db, "SELECT password_hash FROM users WHERE id = ?", userId);
  seedReviewerDemo(db, {});
  assert.equal(count(db, "SELECT COUNT(*) FROM users WHERE username = ?", DEMO_USERNAME), 1);
  assert.equal(count(db, "SELECT COUNT(*) FROM apply_run_jobs WHERE user_id = ?", userId), 12);
  assert.equal(count(db, "SELECT COUNT(*) FROM user_entitlement_overrides WHERE user_id = ? AND revoked_at IS NULL", userId), 1);
  db.prepare("INSERT INTO resumes (user_id, job_id, company, role, html, updated_at) VALUES (?, 'demo-job-001', 'x', 'y', '<p>x</p>', unixepoch())").run(userId);
  db.prepare("INSERT INTO mcp_audit (user_id, tool, outcome) VALUES (?, 'draft_submit_resume_patch', 'ok')").run(userId);
  resetReviewerDemo(db);
  assert.equal(count(db, "SELECT COUNT(*) FROM resumes WHERE user_id = ?", userId), 0);
  assert.equal(count(db, "SELECT COUNT(*) FROM mcp_audit WHERE user_id = ?", userId), 0);
  assert.equal(count(db, "SELECT password_hash FROM users WHERE id = ?", userId), hash, "a reset does not change the password");
});

test("⛔ D86 §6: the seed refuses to touch an account that only shares the username", () => {
  const db = fresh();
  db.prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, 'h', 0)").run(DEMO_USERNAME);
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (1, 'someone@else.test')").run();
  assert.throws(() => seedReviewerDemo(db, { password: PW }), /not the reviewer account/);
  assert.throws(() => resetReviewerDemo(db), /not the reviewer account/);
  assert.equal(count(db, "SELECT COUNT(*) FROM scraped_jobs"), 0, "nothing was written");
});
