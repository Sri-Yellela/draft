import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { keptAnswers, keepAnswers, keptCoverLetter, coverLetterOnce, partKeyOf } from "../services/payloadParts.js";

// ⭐ A198 (46j, owner 11-13: "make sure once any part of the payload is made its retained and recorded as such, like an
// idempotency key, so that the loop doesnt fail"): a drafted / picked answer and the cover letter are kept per person ×
// posting (migration 274) and every later run of the job reuses them — first write wins.
const db0 = () => { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; };

test("a198: answers are kept once (first write wins, normalised keys), per person × posting", () => {
  const db = db0();
  assert.equal(keepAnswers(db, { userId: 1, jobId: "j1", answers: { "Why us? *": "Because A.", "Years with Python": "6+" }, runJobId: 9 }), 2);
  assert.equal(keepAnswers(db, { userId: 1, jobId: "j1", answers: { "why us": "Because B.", "New question": "x" } }), 1, "the first answer stays");
  assert.deepEqual(keptAnswers(db, { userId: 1, jobId: "j1" }), { "Why us? *": "Because A.", "Years with Python": "6+", "New question": "x" });
  assert.deepEqual(keptAnswers(db, { userId: 2, jobId: "j1" }), {}, "another person's answers are theirs");
  assert.deepEqual(keptAnswers(db, { userId: 1, jobId: "j2" }), {}, "another posting's answers are its own");
  assert.equal(partKeyOf("Why us? *"), partKeyOf("why us"));
});

test("a198: the cover letter is written once per job and reused", async () => {
  const db = db0();
  let writes = 0;
  const write = async () => { writes++; return { html: `<p>letter ${writes}</p>` }; };
  const a = await coverLetterOnce(db, { userId: 1, jobId: "j1", write });
  const b = await coverLetterOnce(db, { userId: 1, jobId: "j1", write });
  assert.equal(writes, 1);
  assert.equal(a.html, "<p>letter 1</p>");
  assert.equal(b.html, "<p>letter 1</p>");
  assert.equal(b.kept, true);
  assert.equal(keptCoverLetter(db, { userId: 1, jobId: "j2" }), null);
  const failed = await coverLetterOnce(db, { userId: 1, jobId: "j3", write: async () => ({ error: "no_api_key" }) });
  assert.deepEqual(failed, { error: "no_api_key" }, "a failed write keeps nothing and says why");
});

test("a198: a database without the table degrades to 'nothing kept', never a failed run", () => {
  const db = new Database(":memory:");
  assert.deepEqual(keptAnswers(db, { userId: 1, jobId: "j" }), {});
  assert.equal(keepAnswers(db, { userId: 1, jobId: "j", answers: { a: "b" } }), 0);
  assert.equal(keptCoverLetter(db, { userId: 1, jobId: "j" }), null);
});

test("a198 wiring: a run reuses kept answers before drafting and keeps what it drafts; every cover letter path goes through coverLetterOnce; the re-run's payload carries them", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /generateCoverLetterForApply = typeof writeCoverLetterOnce === "function"\n\s+\? \(userId, jobId\) => coverLetterOnce\(db, \{ userId, jobId, write: \(\) => writeCoverLetterOnce\(userId, jobId\) \}\)/);
  assert.match(src, /const kept = keptAnswers\(db, \{ userId, jobId \}\);\n\s+if \(Object\.keys\(kept\)\.length\) \{\n\s+autofillPayload\.drafted_answers = \{ \.\.\.kept,/);
  assert.match(src, /!keptKeys\.has\(partKeyOf\(t\)\)/);
  assert.match(src, /keepAnswers\(db, \{ userId, jobId, answers: drafted, source: "drafted", runJobId \}\);/);
  assert.match(src, /if \(p && Object\.keys\(kept\)\.length\) p\.drafted_answers = \{ \.\.\.kept, \.\.\.\(p\.drafted_answers \|\| \{\}\) \};/);
  const block = (s) => { const i = at(s, 'id: "274_apply_payload_parts"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
  assert.equal(block(fs.readFileSync("server.js", "utf8")), block(fs.readFileSync("scripts/migrations.js", "utf8")), "the migration is identical in both runners");
});
