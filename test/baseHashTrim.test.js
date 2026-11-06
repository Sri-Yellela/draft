// A base résumé is hashed over ONE normalisation (services/baseResumeHistory.js normaliseBaseText: CRLF → LF, ends
// trimmed). The upload record hashed the untrimmed text while the extension's base (extensionResume.js baseResumeFor)
// trimmed first, so a base saved with a trailing newline never matched the tailored version the web app made from it:
// the extension made — and charged a slot for — a second one. Synthetic people only; no model is called.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { hashBase, normaliseBaseText, recordBaseUpload } from "../services/baseResumeHistory.js";
import { baseResumeFor, createExtensionResumeService } from "../services/extensionResume.js";
import { storeGeneratedResume } from "../services/generatedResumes.js";

const BODY = "Ada Example — Software Engineer. Built distributed systems in Go and Python for six years; led a team of four; " +
  "shipped a payments ledger; wrote the on-call runbook; mentored two engineers; reduced p99 latency by 40%.";
const SAVED = `${BODY}\r\n\r\n  `;   // what an upload can leave at the end: a blank line and stray spaces
const oldHash = (t) => crypto.createHash("sha256").update(String(t).replace(/\r\n/g, "\n")).digest("hex");   // the pre-fix form

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content) VALUES (10,1,'base.txt',?)").run(SAVED);
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at) VALUES
    ('wd-zoom-1','Software Engineer','Zoom','Remote (US)','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R1','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R1/apply','t','h1',unixepoch())`).run();
  db.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (1,'wd-zoom-1','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R1','capture','attached')").run();
  const calls = [];
  const service = createExtensionResumeService({ db, generate: async () => { calls.push(1); throw new Error("no model in this test"); },
    renderPdf: async () => Buffer.from("%PDF"), defer: () => {}, log: { error() {}, warn() {} } });
  const slots = () => db.prepare("SELECT COUNT(*) FROM draft_slot_uses WHERE user_id=1").pluck().get();
  return { db, service, calls, slots };
}

test("one normalisation: CRLF, and whitespace at either end, never change a base's hash", () => {
  assert.equal(normaliseBaseText(SAVED), BODY);
  assert.equal(hashBase(SAVED), hashBase(BODY));
  assert.equal(hashBase(`\n ${BODY}\n`), hashBase(BODY));
  assert.notEqual(hashBase(BODY), hashBase(BODY + " more"), "content still changes it");
  const { db } = fixture();
  const id = recordBaseUpload(db, { userId: 1, profileId: 10, content: SAVED });
  const stored = db.prepare("SELECT content, content_hash FROM base_resume_uploads WHERE id = ?").get(id);
  assert.equal(stored.content, SAVED, "the upload's text is kept as saved");
  assert.equal(stored.content_hash, baseResumeFor(db, 1).hash, "the upload record and the extension's base hash agree");
});

test("a base ending in whitespace: the extension reuses the web app's tailored version — no slot, no model", () => {
  const { db, service, calls, slots } = fixture();
  storeGeneratedResume(db, { userId: 1, jobId: "wd-zoom-1", job: { company: "Zoom", title: "Software Engineer" },
    html: "<div>Ada Example web version</div>", atsScore: 77, baseAtsScore: 60, domainProfileId: 10 });
  const r = service.start(1, { jobId: "wd-zoom-1" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.status, "ready");
  assert.equal(r.body.fromExisting, true);
  assert.equal(slots(), 0);
  assert.equal(calls.length, 0);
});

test("an upload stored BEFORE the fix (untrimmed hash) still matches — re-hashed from its kept content", () => {
  const { db, service, slots } = fixture();
  // the row as the old code wrote it, and a web version made from it
  const uploadId = Number(db.prepare("INSERT INTO base_resume_uploads (user_id, profile_id, name, content, content_hash, source) VALUES (1, 10, 'base.txt', ?, ?, 'upload')")
    .run(SAVED, oldHash(SAVED)).lastInsertRowid);
  assert.notEqual(oldHash(SAVED), hashBase(SAVED), "the fixture really is in the old form");
  storeGeneratedResume(db, { userId: 1, jobId: "wd-zoom-1", job: { company: "Zoom", title: "Software Engineer" },
    html: "<div>Ada Example web version</div>", atsScore: 77, baseAtsScore: 60, domainProfileId: 10 });
  db.prepare("UPDATE resume_versions SET base_upload_id = ? WHERE user_id = 1").run(uploadId);
  db.prepare("DELETE FROM base_resume_uploads WHERE id != ?").run(uploadId);   // only the legacy row is left
  const r = service.start(1, { jobId: "wd-zoom-1" });
  assert.equal(r.body.fromExisting, true, JSON.stringify(r.body));
  assert.equal(slots(), 0);
  assert.equal(db.prepare("SELECT content_hash FROM base_resume_uploads WHERE id = ?").pluck().get(uploadId), hashBase(SAVED));
  // and saving the same text again adds no second row
  assert.equal(recordBaseUpload(db, { userId: 1, profileId: 10, content: SAVED }), uploadId);
});

test("a row with no edge whitespace keeps its stored hash — nothing else is rewritten", () => {
  const { db } = fixture();
  const id = recordBaseUpload(db, { userId: 1, profileId: 10, content: BODY });
  assert.equal(db.prepare("SELECT content_hash FROM base_resume_uploads WHERE id = ?").pluck().get(id), oldHash(BODY),
    "for trimmed text the new hash IS the old hash, so rows already stored need nothing");
});
