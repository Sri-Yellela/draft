import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { capturedAtsAtApply } from "../routes/apply.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import applicationArtifactRoutes from "../routes/applicationArtifacts.js";
import { recordSubmission, recordSubmissionFromPipeline, markPending } from "../services/applicationRecords.js";
import {
  encodeArtifact, decodeArtifact, ArtifactCorruptError, snapshotResumeForRecord, readResumeArtifact,
  compressArtifacts, volumeRoomFor, artifactFilename, SOURCES, MAX_ARTIFACT_RAW_BYTES,
} from "../services/applicationArtifacts.js";
import { normalizeResumeHtml } from "../services/resumeFormatter.js";

// D16 (owner, 10-03): the résumé an application SENT is kept with the application — compressed at
// rest, expanded on demand, and a corrupt copy FAILS LOUDLY instead of downloading as an empty file.
// SYNTHETIC candidate throughout.

const NOW = Math.floor(Date.now() / 1000);

function resumeHtml(tag = "v1", roles = 4) {
  const lines = ["Alex Example", "Software Engineer", "alex@example.test | 555-0100", "", "SUMMARY",
    `Engineer who builds data platforms (${tag}).`, "", "EXPERIENCE"];
  for (let i = 0; i < roles; i++) {
    lines.push(`Example Corp ${i} — Engineer`, `20${15 + i} – 20${16 + i}`);
    for (let b = 0; b < 6; b++) lines.push(`- Built the ${["event", "billing", "search"][b % 3]} pipeline serving ${b + 1}0k requests a second, cutting latency ${b + 5}%.`);
    lines.push("");
  }
  lines.push("SKILLS", "Go, TypeScript, PostgreSQL, Kafka", "", "EDUCATION", "Example University — B.S. 2014");
  return normalizeResumeHtml(lines.join("\n"));
}

function seed() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO'), (2,'bob','x','PRO')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
              VALUES ('j1','Backend Engineer','Northwind, Inc.','https://northwind.example/jobs/1',
                      'https://job-boards.greenhouse.io/northwind/jobs/1','t','h1',?),
                     ('j2','Data Engineer','Contoso','https://contoso.example/jobs/2',
                      'https://contoso.example/jobs/2','t','h2',?)`).run(NOW - 5 * 86400, NOW - 5 * 86400);
  return db;
}
const putResume = (db, userId, jobId, html) => db.prepare(`
  INSERT INTO resumes (user_id, job_id, company, role, html, updated_at) VALUES (?, ?, 'Northwind, Inc.', 'Backend Engineer', ?, unixepoch())
  ON CONFLICT(user_id, job_id) DO UPDATE SET html = excluded.html, updated_at = excluded.updated_at
`).run(userId, jobId, html);
const record = (db, userId = 1, jobId = "j1", extra = {}) => recordSubmission(db, {
  userId, jobId, capturedAtsAtApply,
  input: { submittedAt: (NOW - 3600) * 1000, method: "company_site", reference: "R-1042", ...extra },
});
const recordId = (db, userId = 1, jobId = "j1") =>
  db.prepare("SELECT id FROM application_records WHERE user_id=? AND job_id=?").pluck().get(userId, jobId);

function mount(db, userId = 1) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId, planTier: "PRO" }; next(); });
  const pass = (_req, _res, next) => next();
  applicationRecordRoutes(app, db, pass, { capturedAtsAtApply });
  applicationArtifactRoutes(app, db, pass);
  const server = app.listen(0);
  return { base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}

// ── the codec ─────────────────────────────────────────────────────────────────────────────────

test("brotli round-trips a real-shaped résumé and stores it at well under a third of its size", () => {
  const html = resumeHtml();
  const enc = encodeArtifact(html, "br");
  assert.equal(enc.encoding, "br");
  assert.equal(enc.rawBytes, Buffer.byteLength(html));
  assert.ok(enc.storedBytes * 3 < enc.rawBytes, `ratio ${(enc.rawBytes / enc.storedBytes).toFixed(2)} — HTML should compress > 3x`);
  const row = { body: enc.body, encoding: enc.encoding, sha256: enc.sha256, raw_bytes: enc.rawBytes };
  assert.equal(decodeArtifact(row).toString("utf8"), html);
  for (const e of ["gzip", "identity"]) {
    const x = encodeArtifact(html, e);
    assert.equal(decodeArtifact({ body: x.body, encoding: e, sha256: x.sha256, raw_bytes: x.rawBytes }).toString("utf8"), html, e);
  }
});

test("⛔ a corrupt artifact THROWS — a flipped byte, a wrong checksum, a wrong length, nothing, an unknown encoding", () => {
  const enc = encodeArtifact(resumeHtml(), "br");
  const good = { id: 7, record_id: 3, body: enc.body, encoding: "br", sha256: enc.sha256, raw_bytes: enc.rawBytes };
  const flipped = Buffer.from(enc.body); flipped[Math.floor(flipped.length / 2)] ^= 0xff;
  const cases = {
    "flipped byte": { ...good, body: flipped },
    "truncated": { ...good, body: enc.body.subarray(0, enc.body.length - 9) },
    "checksum": { ...good, sha256: "0".repeat(64) },
    "no checksum": { ...good, sha256: null },
    "length": { ...good, raw_bytes: enc.rawBytes + 1 },
    "empty": { ...good, body: Buffer.alloc(0), encoding: "identity", raw_bytes: null },
    // an empty file whose checksum and length MATCH (the hash of zero bytes) is still not a résumé
    "empty, consistently": { ...good, body: Buffer.alloc(0), encoding: "identity", raw_bytes: 0,
      sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
    "null body": { ...good, body: null },
    "encoding": { ...good, encoding: "zstd" },
  };
  for (const [name, row] of Object.entries(cases)) {
    assert.throws(() => decodeArtifact(row), (e) => e instanceof ArtifactCorruptError && e.code === "artifact_corrupt", name);
  }
  assert.ok(decodeArtifact(good).length > 0, "and the untouched row decodes");
});

// ── the snapshot: what was SENT, not what the résumé says now ──────────────────────────────────

test("recording a submission keeps the résumé as it was; a regeneration afterwards does not change the download", () => {
  const db = seed();
  const sent = resumeHtml("as sent");
  putResume(db, 1, "j1", sent);
  const out = record(db);
  assert.equal(out.artifact.stored, true);
  putResume(db, 1, "j1", resumeHtml("regenerated later"));
  const got = readResumeArtifact(db, 1, recordId(db));
  assert.equal(got.artifact.source, SOURCES.SNAPSHOT);
  assert.equal(got.artifact.html, sent, "the copy, not the working résumé");
  const row = db.prepare("SELECT * FROM application_artifacts").get();
  assert.equal(row.encoding, "br");
  assert.equal(row.media_type, "text/html");
  assert.ok(row.stored_bytes < row.raw_bytes / 3);
});

test("the FIRST snapshot is kept: a re-record (recorded → verified) does not replace it", () => {
  const db = seed();
  putResume(db, 1, "j1", resumeHtml("first"));
  const first = record(db, 1, "j1", { reference: null, evidenceText: "no company named" });
  assert.equal(first.state, "recorded");
  assert.equal(first.artifact.stored, true);
  putResume(db, 1, "j1", resumeHtml("second"));
  const second = record(db, 1, "j1", { reference: "R-2001" });
  assert.equal(second.state, "verified");
  assert.equal(second.artifact.reason, "already_stored");
  assert.match(readResumeArtifact(db, 1, recordId(db)).artifact.html, /first/);
  assert.equal(db.prepare("SELECT COUNT(*) FROM application_artifacts").pluck().get(), 1);
});

test("the pipeline's submission (a Draft) snapshots too", () => {
  const db = seed();
  putResume(db, 1, "j1", resumeHtml("draft run"));
  db.prepare("INSERT INTO apply_runs (id, user_id, status) VALUES (5, 1, 'running')").run();
  db.prepare("INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, finished_at) VALUES (9, 5, 1, 'j1', 'submitted', ?)").run(NOW - 60);
  const out = recordSubmissionFromPipeline(db, { userId: 1, jobId: "j1", runJobId: 9, capturedAtsAtApply });
  assert.equal(out.artifact.stored, true);
  assert.match(readResumeArtifact(db, 1, recordId(db)).artifact.html, /draft run/);
});

test("no résumé, a low volume, or an oversize résumé: nothing is stored, and recording STILL succeeds", () => {
  const db = seed();
  const none = record(db);
  assert.equal(none.artifact.reason, "no_resume");
  assert.equal(none.state, "verified");

  const lowDb = seed();
  putResume(lowDb, 1, "j1", resumeHtml());
  const file = { name: "C:/vol/draft.db" };
  const low = { blocks: 1000, bsize: 1024 * 1024, bavail: 50 };   // 1000 MB volume, 50 MB free
  assert.equal(volumeRoomFor(file, 2000, { statfs: () => low }).ok, false, "below the 150 MB reserve");
  assert.equal(volumeRoomFor(file, 2000, { statfs: () => ({ ...low, bavail: 600 }) }).ok, true);
  markPending(lowDb, 1, "j1", "manual");
  const onVolume = { name: "C:/vol/draft.db", prepare: (sql) => lowDb.prepare(sql) };   // a file-backed db, as seen by statfs
  const refused = snapshotResumeForRecord(onVolume, { userId: 1, jobId: "j1", statfs: () => low });
  assert.equal(refused.reason, "storage_full");
  assert.equal(lowDb.prepare("SELECT COUNT(*) FROM application_artifacts").pluck().get(), 0);
  assert.equal(snapshotResumeForRecord(onVolume, { userId: 1, jobId: "j1", statfs: () => ({ ...low, bavail: 600 }) }).stored, true);

  const bigDb = seed();
  putResume(bigDb, 1, "j1", "<p>" + "x".repeat(MAX_ARTIFACT_RAW_BYTES) + "</p>");
  assert.equal(record(bigDb).artifact.reason, "too_large");
});

// ── the route ─────────────────────────────────────────────────────────────────────────────────

test("GET /api/applications/:recordId/resume — the stored copy, as an attachment, sandboxed, labelled", async () => {
  const db = seed();
  const sent = resumeHtml("as sent");
  putResume(db, 1, "j1", sent);
  record(db);
  const { base, stop } = mount(db);
  try {
    const r = await fetch(`${base}/api/applications/${recordId(db)}/resume`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/html/);
    assert.match(r.headers.get("content-disposition"), /^attachment; filename="resume-northwind-inc-backend-engineer\.html"$/);
    assert.equal(r.headers.get("x-artifact-source"), "snapshot_at_record");
    assert.match(r.headers.get("content-security-policy"), /\bsandbox\b/);
    assert.match(r.headers.get("content-security-policy"), /default-src 'none'/);
    assert.equal(r.headers.get("cache-control"), "private, no-store");
    assert.equal(await r.text(), sent);
    const inline = await fetch(`${base}/api/applications/${recordId(db)}/resume?inline=1`);
    assert.match(inline.headers.get("content-disposition"), /^inline;/);
  } finally { stop(); }
});

test("another user's record is 404 not_found; a record with no résumé anywhere is 404 artifact_missing", async () => {
  const db = seed();
  putResume(db, 1, "j1", resumeHtml());
  record(db);
  markPending(db, 1, "j2", "manual");
  const bob = mount(db, 2);
  const ada = mount(db, 1);
  try {
    const theirs = await fetch(`${bob.base}/api/applications/${recordId(db)}/resume`);
    assert.equal(theirs.status, 404);
    assert.equal((await theirs.json()).error, "not_found");
    for (const bad of ["0", "abc", "999999"]) {
      assert.equal((await (await fetch(`${ada.base}/api/applications/${bad}/resume`)).json()).error, "not_found", bad);
    }
    const missing = await fetch(`${ada.base}/api/applications/${recordId(db, 1, "j2")}/resume`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error, "artifact_missing");
  } finally { bob.stop(); ada.stop(); }
});

test("a record with no copy serves the WORKING résumé and says so (current_resume)", async () => {
  const db = seed();
  markPending(db, 1, "j1", "manual");                 // a pending record never snapshots
  putResume(db, 1, "j1", resumeHtml("working copy"));
  const { base, stop } = mount(db);
  try {
    const r = await fetch(`${base}/api/applications/${recordId(db)}/resume`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("x-artifact-source"), "current_resume");
    assert.match(await r.text(), /working copy/);
    assert.equal(db.prepare("SELECT COUNT(*) FROM application_artifacts").pluck().get(), 0, "a read never writes a copy");
  } finally { stop(); }
});

test("⛔ a corrupt stored copy answers 500 artifact_corrupt — never a 200 with an empty or partial file", async () => {
  const db = seed();
  putResume(db, 1, "j1", resumeHtml());
  record(db);
  const row = db.prepare("SELECT id, body FROM application_artifacts").get();
  const broken = Buffer.from(row.body); broken[10] ^= 0xff;
  db.prepare("UPDATE application_artifacts SET body = ? WHERE id = ?").run(broken, row.id);
  const { base, stop } = mount(db);
  const errors = []; const orig = console.error; console.error = (...a) => errors.push(a.join(" "));
  try {
    const r = await fetch(`${base}/api/applications/${recordId(db)}/resume`);
    assert.equal(r.status, 500);
    assert.match(r.headers.get("content-type"), /json/);
    const body = await r.json();
    assert.equal(body.error, "artifact_corrupt");
    assert.match(body.message, /damaged/);
    assert.ok(errors.some(e => /CORRUPT/.test(e)), "and it is logged");
  } finally { console.error = orig; stop(); }
});

// ── dual path, re-encoding, backfill ─────────────────────────────────────────────────────────

test("an 'identity' row reads; compressArtifacts re-encodes it to brotli, verified, and backfill is labelled", () => {
  const db = seed();
  const env = { APPLICATION_ARTIFACT_ENCODING: "identity" };
  putResume(db, 1, "j1", resumeHtml("plain"));
  recordSubmission(db, { userId: 1, jobId: "j1", capturedAtsAtApply,
    input: { submittedAt: (NOW - 3600) * 1000, method: "company_site", reference: "R-1" } });
  db.prepare("DELETE FROM application_artifacts").run();
  assert.equal(snapshotResumeForRecord(db, { userId: 1, jobId: "j1", env }).stored, true);
  const plain = db.prepare("SELECT * FROM application_artifacts").get();
  assert.equal(plain.encoding, "identity");
  assert.equal(plain.stored_bytes, plain.raw_bytes);
  assert.match(readResumeArtifact(db, 1, recordId(db)).artifact.html, /plain/);

  // j2: verified with no copy (recorded before D16)
  putResume(db, 1, "j2", resumeHtml("legacy"));
  recordSubmission(db, { userId: 1, jobId: "j2", capturedAtsAtApply,
    input: { submittedAt: (NOW - 3600) * 1000, method: "company_site", reference: "R-2" } });
  db.prepare("DELETE FROM application_artifacts WHERE record_id = ?").run(recordId(db, 1, "j2"));

  const dry = compressArtifacts(db, { backfill: true });
  assert.equal(dry.reencoded, 1);
  assert.equal(dry.backfillCandidates, 1);
  assert.equal(db.prepare("SELECT encoding FROM application_artifacts").pluck().get(), "identity", "a dry run writes nothing");

  const done = compressArtifacts(db, { apply: true, backfill: true });
  assert.equal(done.backfilled, 1);
  assert.ok(done.after * 3 < done.before);
  const rows = db.prepare("SELECT record_id, encoding, source FROM application_artifacts ORDER BY record_id").all();
  assert.deepEqual(rows.map(r => r.encoding), ["br", "br"]);
  assert.equal(rows.find(r => r.record_id === recordId(db, 1, "j2")).source, "backfill");
  assert.match(readResumeArtifact(db, 1, recordId(db)).artifact.html, /plain/);

  const bad = db.prepare("SELECT id, body FROM application_artifacts LIMIT 1").get();
  db.prepare("UPDATE application_artifacts SET encoding='identity', body = ? WHERE id = ?").run(Buffer.from("tampered"), bad.id);
  const report = compressArtifacts(db, { apply: true });
  assert.equal(report.corrupt.length, 1, "a corrupt row is reported, not re-encoded");
});

// ── retention: the copy lives exactly as long as its record ──────────────────────────────────

test("the copy goes with its record and with the account; it has no user_id of its own (account merge needs no plan)", () => {
  const db = seed();
  putResume(db, 1, "j1", resumeHtml());
  record(db);
  assert.equal(db.prepare("SELECT COUNT(*) FROM application_artifacts").pluck().get(), 1);
  const cols = db.prepare("PRAGMA table_info(application_artifacts)").all().map(c => c.name);
  assert.ok(!cols.includes("user_id"), "mergeAccounts refuses any user_id table it has no plan for");
  db.prepare("DELETE FROM users WHERE id = 1").run();
  assert.equal(db.prepare("SELECT COUNT(*) FROM application_artifacts").pluck().get(), 0, "account deletion cascades");

  const db2 = seed();
  putResume(db2, 1, "j1", resumeHtml());
  record(db2);
  db2.prepare("DELETE FROM application_records").run();
  assert.equal(db2.prepare("SELECT COUNT(*) FROM application_artifacts").pluck().get(), 0, "record deletion cascades");
});

test("filenames are ASCII slugs", () => {
  assert.equal(artifactFilename({ company: "Café Ñandú, Inc.", role: "Staff Engineer / Platform" }), "resume-cafe-nandu-inc-staff-engineer-platform.html");
  assert.equal(artifactFilename({}), "resume.html");
});

// ── wiring ────────────────────────────────────────────────────────────────────────────────────

test("server.js mounts the route; no server-side PDF is added; migration 125 is in both runners", () => {
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(server, /import applicationArtifactRoutes from "\.\/routes\/applicationArtifacts\.js";/);
  assert.match(server, /applicationArtifactRoutes\(app, db, requireAuth\);/);
  const route = fs.readFileSync(new URL("../routes/applicationArtifacts.js", import.meta.url), "utf8");
  assert.doesNotMatch(route, /htmlToPdf\(|launchBrowser|puppeteer/, "a PDF is printed by the browser, never by the server here");
  assert.ok(MIGRATIONS.some(m => m.id === "125_application_artifacts"));
  assert.match(server, /id: "125_application_artifacts"/);
});
