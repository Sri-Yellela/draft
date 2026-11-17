import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createDomainProfilesRouter } from "../routes/domainProfiles.js";
import { coverLetterOnDemand } from "../routes/apply.js";
import { samples, sampleRoleFamily } from "../services/sampleResumes.js";

// D123 P6e, draft's half (the audit's R9 + R10, owner 11-01):
//   R9  — the apply cover letter is a paid Haiku call; it is written only when the form shows a cover-letter upload.
//   R10 — a trial sample's job profile names the sample's own role family, so the tools service never classifies it.
// The samples are fictional people (content/trial).

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("p6eCoverLetterOnlyWhenAsked: the generator runs on the first call only, and never without one", async () => {
  let made = 0;
  const lazy = coverLetterOnDemand(async () => { made++; return "/tmp/cl.pdf"; });
  assert.equal(made, 0, "creating it writes nothing — a form with no cover slot never calls it");
  assert.equal(await lazy(), "/tmp/cl.pdf");
  assert.equal(await lazy(), "/tmp/cl.pdf", "a second cover slot (another frame, the next step) reuses the first");
  assert.equal(made, 1);
  const failing = coverLetterOnDemand(async () => { throw new Error("model down"); });
  assert.equal(await failing(), null, "a failure is no cover letter, never a crash in the upload step");
});

test("p6eCoverLetterOnlyWhenAsked: no apply path starts the cover letter before the form is seen", () => {
  const apply = read("routes/apply.js");
  const calls = [...apply.matchAll(/generateCoverLetterForApply\(userId, jobId\)/g)].map(m => apply.slice(m.index - 80, m.index));
  assert.equal(calls.length, 4, "CASE A, B and C + the Solve it here re-run (46j)");
  for (const before of calls) assert.match(before, /coverLetterOnDemand\(\(\) => $/, "each one only inside coverLetterOnDemand");
  assert.doesNotMatch(apply, /coverLetterPathPromise/, "no eager promise is handed to autoApply any more");
  const automation = read("services/applyAutomation.js");
  assert.match(automation, /coverLetterOnDemand {6}= null,/);
  // the upload step resolves it at a cover slot, and a combined résumé / cover slot still falls through to the résumé
  assert.match(automation, /const clPath = slot\.isCover && !coverUploaded && coverLetterPath\n\s+\? \(typeof coverLetterPath === "function" \? await coverLetterPath\(\) : coverLetterPath\) : null;/);
  assert.match(automation, /if \(clPath && fs\.existsSync\(clPath\)\) \{[\s\S]{0,120}\} else if \(slot\.isResume/);
});

test("p6eTrialSampleSendsRoleFamily: a sample's job profile takes the sample's family; another résumé keeps the inference", async () => {
  for (const s of Object.values(samples())) assert.ok(s.roleFamily, `sample ${s.id} names its role family`);
  assert.equal(sampleRoleFamily("Riley Sample\nnot a sample at all"), null);

  // 45p D184 S-1 (0e4f5b0c): G, H and I are the TEST SET — placed like any résumé, so sampleRoleFamily names none for
  // them on purpose; only the trial samples (A–F) carry their own family into the job profile (pin moved on purpose).
  for (const s of Object.values(samples()).filter(s => s.testSet)) assert.equal(sampleRoleFamily(s.resumeText), null, `test-set ${s.id} names no family`);
  for (const s of Object.values(samples()).filter(s => !s.testSet)) {
    const db = new Database(":memory:");
    for (const m of MIGRATIONS) db.exec(m.sql);
    db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'tester','x')").run();
    db.prepare("INSERT INTO user_profile (user_id) VALUES (1)").run();
    const app = express();
    app.use(express.json({ limit: "2mb" }));
    app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
    app.use("/api/domain-profiles", createDomainProfilesRouter(db, null, () => {}, {}));
    const server = app.listen(0);
    try {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/domain-profiles/from-resume`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: s.resumeText, name: `sample-${s.id.toLowerCase()}.txt` }) });
      assert.equal(r.status, 200, await r.clone().text());
      const out = await r.json();
      assert.equal(db.prepare("SELECT role_family FROM domain_profiles WHERE id=?").pluck().get(out.profileId), s.roleFamily, `sample ${s.id}`);
    } finally { server.close(); db.close(); }
  }
});
