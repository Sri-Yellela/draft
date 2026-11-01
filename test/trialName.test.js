import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { needsName, saveTrialName, trialState, startTrial, analyticsCsv } from "../services/trial.js";

// Owner 11-01: "we are supplying sample resumes so we need to collect names of signed up people too unless google sign
// up does it". The samples carry fictional names, so the ACCOUNT's name is the record of who tried it. Synthetic people.

process.env.DRAFT_TRIAL = "on";

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, full_access) VALUES (1, 'form', 'x', 0), (2, 'octocat', 'x', 0), (3, 'mailonly', 'x', 0), (4, 'noprofile', 'x', 0)").run();
  const p = db.prepare("INSERT INTO user_profile (user_id, first_name, last_name, full_name, email) VALUES (?, ?, ?, ?, ?)");
  p.run(1, "Avery", "Quinn", "Avery Quinn", "avery@example.com");           // the email form: first + last required
  p.run(2, "octocat", null, "octocat", "octo@example.com");                  // GitHub with no public name: a handle
  p.run(3, "sam@example.com", null, "sam@example.com", "sam@example.com");   // a provider that gave only an email
  return db;
}

test("trialNeedsNameWhenSignUpGaveNone: a handle, an email or no profile asks; a first + last name does not", () => {
  const db = db0();
  assert.equal(needsName(db, 1), false);
  assert.equal(needsName(db, 2), true);
  assert.equal(needsName(db, 3), true);
  assert.equal(needsName(db, 4), true);
  assert.equal(trialState(db, 2).needsName, true, "the trial's state says so, so /try asks before the samples");
  assert.equal(startTrial(db, 1).needsName, false);
});

test("trialSaveName: first + last stored on the account (updated or created); blanks and markup refused", () => {
  const db = db0();
  assert.deepEqual(saveTrialName(db, 2, { first_name: "  Morgan ", last_name: "Lee  " }), { ok: true, needsName: false });
  assert.deepEqual(db.prepare("SELECT first_name, last_name, full_name, email FROM user_profile WHERE user_id = 2").get(),
    { first_name: "Morgan", last_name: "Lee", full_name: "Morgan Lee", email: "octo@example.com" }, "the email is kept");
  saveTrialName(db, 4, { first_name: "Riley", last_name: "Park" });
  assert.equal(needsName(db, 4), false, "a profile row is created when there was none");
  for (const bad of [{ first_name: "", last_name: "X" }, { first_name: "A", last_name: "" }, { first_name: "a@b.c", last_name: "D" },
    { first_name: "<b>", last_name: "D" }, { first_name: "A".repeat(81), last_name: "D" }]) {
    assert.throws(() => saveTrialName(db, 3, bad), (e) => e.status === 400 && e.code === "bad_name", JSON.stringify(bad));
  }
  assert.equal(needsName(db, 3), true);
});

test("trialCsvNamesBehindContactToggle: the export carries name + sign-up email only when emails are asked for", () => {
  const db = db0();
  db.prepare("UPDATE users SET trial_at = unixepoch(), trial_resume = 'A'").run();
  const plain = analyticsCsv(db, { includeEmails: false });
  assert.doesNotMatch(plain.split("\n")[0], /\bname\b|account_email/);
  assert.doesNotMatch(plain, /Avery|avery@example\.com/);
  const withContact = analyticsCsv(db, { includeEmails: true });
  assert.match(withContact.split("\n")[0], /^name,account_email,sample,/);
  assert.match(withContact, /\nAvery Quinn,avery@example\.com,A,/);
});

test("trialNameRouteAndPage: POST /api/trial/name is signed-in only, and /try asks before the samples", () => {
  const routes = fs.readFileSync("routes/trial.js", "utf8");
  assert.match(routes, /app\.post\("\/api\/trial\/name", requireAuth,/);
  const page = fs.readFileSync("client/src/pages/TryPage.jsx", "utf8");
  assert.match(page, /setNeedsName\(!!st\?\.needsName\)/);
  assert.ok(page.indexOf("if (needsName)") < page.indexOf("Pick a résumé"), "the name comes before the samples");
  assert.match(page, /api\("\/api\/trial\/name"/);
});
