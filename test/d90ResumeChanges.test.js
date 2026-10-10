// D90 P1 (docs/WHAT_WE_CHANGED_SPEC.md §7): "what we changed" — every test red when its rule is removed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { compareResumes, wordDiff, alignBullets } from "../services/resumeChanges.js";
import { recordBaseUpload, listBaseUploads, hashBase } from "../services/baseResumeHistory.js";
import { saveBaseResumeRecord } from "../services/simpleApplyProfile.js";
import { storeGeneratedResume } from "../services/generatedResumes.js";
import { renderStructuredResume, buildStructuredResume } from "../services/resumeFormatter.js";
import { snapshotResumeForRecord } from "../services/applicationArtifacts.js";
import { createResumeChangesRouter } from "../routes/resumeChanges.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const BASE = `Avery Sample
avery@example.com | 555-010-0199
SUMMARY
Backend engineer building logistics services.
TECHNICAL SKILLS
Languages: Python, Go, SQL
Tools: PostgreSQL, Docker
EXPERIENCE
Northwind Logistics | Remote
Software Engineer | Jan 2022 – Present
• Built a Python service that routes 40,000 shipments a day
• Cut PostgreSQL query time by 60% by redesigning indexes
• Ran the on-call rotation for the platform team
Contoso Retail | Boston, MA
Junior Developer | Jun 2020 – Dec 2021
• Maintained Go microservices for checkout
EDUCATION
State University | B.S. Computer Science | 2020`;

const tailor = (text, edits) => edits.reduce((t, [a, b]) => t.replace(a, b), text);

test("⛔ D90: an identical pair has zero changes", () => {
  const r = compareResumes({ before: BASE, after: BASE });
  assert.equal(r.summary.identical, true);
  assert.deepEqual([r.summary.rewritten, r.summary.added, r.summary.removed], [0, 0, 0]);
});

test("⛔ D90: without ids, a lightly reworded bullet aligns to ITS original; a new one is Added, a dropped one Removed", () => {
  const after = tailor(BASE, [
    ["• Built a Python service that routes 40,000 shipments a day", "• Built a Python and PostgreSQL service that routes 40,000 shipments a day"],
    ["• Ran the on-call rotation for the platform team", "• Wrote the runbooks the support team uses"],
  ]);
  const r = compareResumes({ before: BASE, after });
  const role = r.sections.find(s => s.title === "EXPERIENCE").entries[0];
  const rewritten = role.bullets.find(b => b.status === "rewritten");
  assert.match(rewritten.before, /^Built a Python service/, "aligned to its own original, not a different bullet");
  assert.ok(role.bullets.some(b => b.status === "added" && /runbooks/.test(b.after)));
  assert.ok(role.bullets.some(b => b.status === "removed" && /on-call/.test(b.before)));
  assert.equal(role.bullets.filter(b => b.status === "unchanged").length, 1);
  assert.deepEqual([r.summary.rewritten, r.summary.added, r.summary.removed], [1, 1, 1]);
});

test("⛔ D90: the word diff marks exactly the changed words", () => {
  assert.deepEqual(wordDiff("Built a service across three regions", "Built a fast service across three regions, in Docker"), [
    { op: "same", text: "Built a" }, { op: "add", text: "fast" }, { op: "same", text: "service across three regions,", was: "service across three regions" }, { op: "add", text: "in Docker" }]);
  assert.deepEqual(alignBullets(["a b c"], ["a b c"])[0].status, "unchanged");
});

test("⛔ D90: terms gained are only those ABSENT before and PRESENT after, each with its source; an invented one is 'untraced' and counted", () => {
  const after = tailor(BASE, [["• Maintained Go microservices for checkout", "• Maintained Go and Kubernetes microservices for checkout on Kafka"]]);
  const r = compareResumes({ before: BASE, after, claims: { skills: ["Kubernetes"] }, afterReport: { tier1_matched: ["Python", "Go", "Kubernetes", "Kafka"], tier1_missing: ["Terraform"] } });
  assert.deepEqual(r.summary.termsGained, [{ term: "Kubernetes", source: "claims" }, { term: "Kafka", source: "untraced" }]);
  assert.equal(r.summary.untraced, 1);
  assert.deepEqual(r.summary.requirementsMissing, ["Terraform"]);
  const two = compareResumes({ before: after, after: tailor(after, [["for checkout on Kafka", "for checkout on Kafka with Docker"]]), base: BASE, afterReport: { tier1_matched: ["Docker"] } });
  assert.deepEqual(two.summary.termsGained, [], "Docker was already in the before side");
});

test("⛔ D90: employer, title and dates never change — a change is SHOWN in roleChanges, not hidden", () => {
  const after = tailor(BASE, [["Software Engineer | Jan 2022 – Present", "Senior Software Engineer | Jan 2020 – Present"]]);
  const r = compareResumes({ before: BASE, after });
  assert.equal(r.roleChanges.length, 1);
  assert.match(r.roleChanges[0].after.role, /Senior/);
  assert.equal(r.summary.identical, false);
});

test("⛔ D90: the comparison is pure and fast — no model, no network, no database; a typical résumé in well under 100 ms", () => {
  const src = read("services/resumeChanges.js");
  assert.doesNotMatch(src, /from ["'](?:node:)?(?:http|https|net)["']|anthropic|openai|toolsService|better-sqlite3|fetch\(/i);
  const after = renderStructuredResume(buildStructuredResume(tailor(BASE, [["Cut PostgreSQL", "Reduced PostgreSQL"]])));
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) compareResumes({ before: BASE, after });
  assert.ok((performance.now() - t0) / 20 < 100);
});

// ── the store and the endpoints, on the real tables (test/fixtures/d90Schema.sql + migration 157) ──
function setup() {
  const db = new Database(":memory:");
  db.exec(fs.readFileSync(path.join(root, "test/fixtures/d90Schema.sql"), "utf8"));
  db.exec(MIGRATIONS.find(m => m.id === "157_base_resume_uploads").sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'avery', 'x'), (2, 'blake', 'x')").run();
  db.prepare(`INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, seniority, is_active) VALUES (7, 1, 'p', 'engineering', 'engineering', 'mid', 1)`).run();
  db.prepare("INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash) VALUES ('j1', 'q', 'Fabrikam', 'Backend Engineer', 'h')").run();
  return db;
}
async function serve(t, db, userId = 1) {
  const app = express();
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  app.use(createResumeChangesRouter({ db, requireAuth: (_q, _s, n) => n() }));
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json() }; };
}
const gen = (db, text, score, baseScore) => storeGeneratedResume(db, { userId: 1, jobId: "j1", job: { company: "Fabrikam", title: "Backend Engineer" },
  html: renderStructuredResume(buildStructuredResume(text)), atsScore: score, baseAtsScore: baseScore, domainProfileId: 7,
  atsReport: { tier1_matched: ["Python", "Kubernetes"], tier1_missing: ["Terraform"] } });

test("⛔ D90: every distinct upload is kept (the same text twice adds nothing), and each version records the upload it came from", () => {
  const db = setup();
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE, "v1.txt");
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE, "again.txt");
  assert.equal(listBaseUploads(db, 1, 7).length, 1);
  gen(db, tailor(BASE, [["Cut PostgreSQL", "Reduced PostgreSQL"]]), 70, 60);
  const BASE2 = BASE.replace("Ran the on-call rotation", "Led the on-call rotation");
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE2, "v2.txt");
  gen(db, BASE2, 72, 61);
  const uploads = listBaseUploads(db, 1, 7);
  assert.equal(uploads.length, 2);
  const v = db.prepare("SELECT version, base_upload_id FROM resume_versions ORDER BY version").all();
  assert.deepEqual(v.map(x => x.base_upload_id), uploads.map(u => u.id), "v1 from the first upload, v2 from the second");
  assert.equal(recordBaseUpload(db, { userId: 1, profileId: 7, content: BASE }), uploads[0].id);
  assert.equal(db.prepare("SELECT content_hash FROM base_resume_uploads WHERE id = ?").pluck().get(uploads[0].id), hashBase(BASE));
});

test("⛔ D90: by default a version is compared with ITS upload — even after a newer upload; the user may pick any two", async (t) => {
  const db = setup();
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE, "v1.txt");
  gen(db, tailor(BASE, [["Cut PostgreSQL", "Reduced PostgreSQL"]]), 70, 60);
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE.replace("Ran the on-call rotation", "Led the on-call rotation"), "v2.txt");
  const get = await serve(t, db);
  const d = await get("/api/jobs/j1/resume-changes");
  assert.equal(d.status, 200);
  assert.equal(d.body.baseKnown, true);
  assert.deepEqual([d.body.summary.rewritten, d.body.summary.added, d.body.summary.removed], [1, 0, 0], "only the tailoring — not the later base edit");
  const list = await get("/api/jobs/j1/resume-versions");
  const [u1, u2] = list.body.uploads.map(u => u.ref);
  const picked = await get(`/api/jobs/j1/resume-changes?from=${u2}&to=version:1`);
  assert.equal(picked.body.summary.rewritten, 2, "against the newer upload: the tailoring AND the base edit");
  const uploadsOnly = await get(`/api/jobs/j1/resume-changes?from=${u1}&to=${u2}`);
  assert.equal(uploadsOnly.body.summary.rewritten, 1, "two uploads compare too");
  assert.deepEqual(d.body.scores.map(s => [s.label, s.atsScore]), [["Base", 60], ["Tailored v1", 70]], "the strip is the STORED scores, in order");
});

test("⛔ D90: 'What we sent' is the snapshot at apply and does not change when the résumé is regenerated", async (t) => {
  const db = setup();
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE, "v1.txt");
  gen(db, tailor(BASE, [["Cut PostgreSQL", "Reduced PostgreSQL"]]), 70, 60);
  const rec = db.prepare("INSERT INTO application_records (user_id, job_id, state, origin) VALUES (1, 'j1', 'submitted', 'manual')").run().lastInsertRowid;
  assert.equal(snapshotResumeForRecord(db, { userId: 1, jobId: "j1", statfs: () => ({ bavail: 1e9, bsize: 4096, blocks: 2e9 }) }).stored, true);
  gen(db, tailor(BASE, [["Cut PostgreSQL", "Slashed PostgreSQL"], ["Ran the on-call", "Owned the on-call"]]), 75, 60);
  const get = await serve(t, db);
  const sent = await get(`/api/applications/${rec}/resume-sent`);
  assert.equal(sent.status, 200);
  assert.equal(sent.body.to.label, "What we sent");
  assert.equal(sent.body.to.sentFromVersion, 1);
  assert.equal(sent.body.summary.rewritten, 1, "what was SENT (v1), not the later v2");
});

test("⛔ D90: another user's job or application is a 404; no eligibility or EEO field is in any response", async (t) => {
  const db = setup();
  db.prepare("UPDATE user_profile SET requires_sponsorship = 1 WHERE user_id = 1").run();
  saveBaseResumeRecord(db, { userId: 1, profileId: 7 }, BASE, "v1.txt");
  gen(db, tailor(BASE, [["Cut PostgreSQL", "Reduced PostgreSQL"]]), 70, 60);
  const other = await serve(t, db, 2);
  assert.equal((await other("/api/jobs/j1/resume-changes")).status, 404);
  assert.equal((await other("/api/jobs/j1/resume-versions")).status, 404);
  assert.equal((await other("/api/jobs/j1/resume-changes?from=upload:1&to=version:1")).status, 404);
  const own = await serve(t, db, 1);
  const body = JSON.stringify((await own("/api/jobs/j1/resume-changes")).body);
  assert.doesNotMatch(body, /sponsorship|work_auth|visa|clearance|gender|ethnicity|veteran|disability|avery@example\.com|555-010-0199/i);
});
