// Owner 11-02 ("none of the samples work now"): a trial account whose profile was made from one sample could not pick
// another — POST /api/domain-profiles/from-resume refused it (409 has_profile). A sample now switches a sample-made profile.
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { startFromResume } from "../services/resumeOnboarding.js";
import { samples, sampleIdForText, activeSampleId, RESUME_CHOICES } from "../services/trial.js";

function db0() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, domain_profile_complete INTEGER);
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, profile_name TEXT, role_family TEXT, domain TEXT, seniority TEXT,
      target_titles TEXT, selected_keywords TEXT, selected_verbs TEXT, selected_tools TEXT, is_active INTEGER, made_from_resume INTEGER);
    CREATE TABLE profile_base_resumes (profile_id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT, name TEXT);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY);
    INSERT INTO users (id) VALUES (1);`);
  return db;
}
const deps = (db) => ({
  registry: null,
  saveBaseResume: (pid, text, name) => db.prepare(`INSERT INTO profile_base_resumes (profile_id, user_id, content, name) VALUES (?, 1, ?, ?)
    ON CONFLICT(profile_id) DO UPDATE SET content = excluded.content, name = excluded.name`).run(pid, text, name),
  readProfile: () => null,
  isSampleSwap: (text) => !!sampleIdForText(text) && !!activeSampleId(db, 1),
});

test("sampleSwap: only A and B are offered; a profile made from C is switched to A, not refused", () => {
  assert.deepEqual([...RESUME_CHOICES], ["A", "B"]);
  const db = db0();
  const first = startFromResume(db, 1, { content: samples().C.resumeText, name: "sample-c.txt" }, deps(db));
  assert.equal(activeSampleId(db, 1), "C");
  const second = startFromResume(db, 1, { content: samples().A.resumeText, name: "sample-a.txt" }, deps(db));
  assert.equal(second.profileId, first.profileId, "the same profile, switched");
  assert.equal(activeSampleId(db, 1), "A");
  assert.equal(db.prepare("SELECT COUNT(*) FROM domain_profiles").pluck().get(), 1);
});

test("sampleSwap: a non-sample résumé on an account that has a profile is still refused (409)", () => {
  const db = db0();
  startFromResume(db, 1, { content: samples().B.resumeText, name: "sample-b.txt" }, deps(db));
  const own = "Jane Doe\n" + "Built data pipelines in Python and SQL for a logistics company. ".repeat(10);
  assert.throws(() => startFromResume(db, 1, { content: own, name: "mine.txt" }, deps(db)), e => e.status === 409);
});
