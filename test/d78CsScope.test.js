// ⛔ D78 B · COMPUTER SCIENCE ONLY. Each red when removed:
// the owner's IN and OUT lists, case by case (TPM and engineering manager IN; solutions / sales engineering,
// IT support, hardware and ASIC OUT whatever the family; a clear CS title rescues an unplaced posting) · the
// two word traps ("it" is not IT, "HTML" is not ML) · the gate only COUNTS until scope_enforce is on · enforced:
// a NEW out-of-scope posting is never written, an EXISTING one is retired, an APPLIED one is kept · the sweep
// is dry by default, refuses past its ceiling, retires (never deletes) and judges by the STORED family · the
// crawl judges an existing row BEFORE the hash check · the 03:30 cron has no early return that skips a sweep.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { csScopeOf, scopeReport } from "../services/jobs/csScope.js";
import { scopeGate, sweepScope, SCOPE_REASON } from "../services/jobs/boardScope.js";
import { setPolicy, readPolicy } from "../services/jobs/boardAge.js";

const NOW = Math.floor(Date.parse("2026-10-08T12:00:00Z") / 1000);
const inScope = (title, roleKey) => csScopeOf({ title, roleKey }).inScope;

test("⛔ D78 B: the owner's IN list — CS families, data analyst, embedded, TPM, engineering manager", () => {
  for (const [t, k] of [
    ["Senior Software Engineer, Backend", "engineering"],
    ["Data Scientist, Core Experimentation", "data"],
    ["Senior Data Analyst - Reconciliation", "data"],
    ["Firmware Engineer", "engineering_embedded_firmware"],
    ["Technical Program Manager, Public Sector", "pm"],
    ["Engineering Manager, Infrastructure", "general"],
    ["Director of Engineering", "general"],
  ]) assert.equal(inScope(t, k), true, `${t} (${k}) is computer science`);
});

test("⛔ D78 B: the owner's OUT list — whatever family the classifier filed it under", () => {
  for (const [t, k] of [
    ["Product Manager, Pricing", "pm"],
    ["Senior Product Designer", "design"],
    ["Account Executive, Enterprise", "sales"],
    ["Solutions Engineer", "engineering"],
    ["Sales Engineer", "engineering"],
    ["Systems Administrator", "engineering"],
    ["IT Support Specialist", "general"],
    ["Mechanical Engineer", "engineering"],
    ["ASIC Design Engineer", "engineering"],
    ["Data Center Electrical Engineer", "general"],
    ["Senior Recruiter", "hr"],
  ]) assert.equal(inScope(t, k), false, `${t} (${k}) is out of scope`);
});

test("⛔ D78 B: a clear CS title rescues an unplaced posting; an unplaced posting with no CS signal is out", () => {
  assert.equal(inScope("Forward Deployed Engineer, Privy", "general"), true);
  assert.equal(inScope("Software Engineer", null), true);
  assert.equal(inScope("Researcher, Alignment", "general"), true);
  assert.equal(csScopeOf({ title: "Business Value Consultant", roleKey: "general" }).reason, "out:general_no_cs_signal");
});

test("⛔ D78 B: the word traps — 'it' is not IT, HTML is not ML, Email is not AI", () => {
  assert.equal(inScope("Make it Engineer", "general"), false, "no rule should fire on the word 'it' — and nothing CS here either");
  assert.equal(csScopeOf({ title: "Make it Engineer", roleKey: "engineering" }).reason, "family:engineering", "'it' is not an IT title");
  assert.equal(inScope("HTML Email Producer", "general"), false, "HTML is not ML, Email is not AI");
  assert.equal(inScope("ML Engineer", "general"), true);
});

test("scopeReport counts in, out, by reason, family and company", () => {
  const r = scopeReport([{ title: "Software Engineer", roleKey: "engineering", company: "A" }, { title: "Recruiter", roleKey: "hr", company: "A" }]);
  assert.deepEqual([r.total, r.in, r.out, r.byCompany.A], [2, 1, 1, { in: 1, out: 1 }]);
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'u1', 'x')").run();
  return db;
}
function insert(db, id, title, roleKey) {
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, source, is_active, discovered_at)
    VALUES (?, 't', ?, ?, 'Acme', ?, 'greenhouse', 1, ?)`).run(id, `h-${id}`, title, `https://example.com/${id}`, NOW - 86400);
  if (roleKey) db.prepare("INSERT INTO job_role_map (job_id, role_key, matched_by) VALUES (?, ?, 'ats_cache')").run(id, roleKey);
}
const active = (db, id) => db.prepare("SELECT is_active FROM scraped_jobs WHERE job_id = ?").pluck().get(id);
const reason = (db, id) => db.prepare("SELECT reason FROM rejected_jobs WHERE job_id = ?").pluck().get(id);
const PM = { title: "Product Manager, Pricing", company: "Acme", source: "greenhouse" };

test("⛔ D78 B: the gate only COUNTS until scope_enforce is on — it starts off", () => {
  const db = db0();
  insert(db, "pm", PM.title, "pm");
  assert.equal(readPolicy(db).scope_enforce, 0, "it starts report-only");
  assert.equal(scopeGate(db, PM, "pm", { exists: true, roleKey: "pm", now: NOW }), "would_drop");
  assert.equal(scopeGate(db, PM, "new", { exists: false, roleKey: "pm", now: NOW }), "would_drop");
  assert.equal(active(db, "pm"), 1);
  assert.equal(db.prepare("SELECT COUNT(*) FROM rejected_jobs").pluck().get(), 0, "report-only writes nothing");
  assert.equal(scopeGate(db, { ...PM, title: "Software Engineer" }, "swe", { exists: false, roleKey: "engineering", now: NOW }), "keep");
});

test("⛔ D78 B: enforced — a NEW out-of-scope posting is never written, an EXISTING one retired, an APPLIED one kept", () => {
  const db = db0();
  insert(db, "pm", PM.title, "pm");
  insert(db, "applied", PM.title, "pm");
  db.prepare("INSERT INTO user_jobs (user_id, job_id, applied) VALUES (1, 'applied', 1)").run();
  setPolicy(db, { scope_enforce: true });
  const policy = readPolicy(db);
  assert.equal(scopeGate(db, PM, "new", { exists: false, roleKey: "pm", now: NOW, policy }), "rejected_new");
  assert.equal(reason(db, "new"), SCOPE_REASON);
  assert.equal(scopeGate(db, PM, "pm", { exists: true, roleKey: "pm", now: NOW, policy }), "scoped_out");
  assert.deepEqual([active(db, "pm"), reason(db, "pm")], [0, "out_of_scope"]);
  assert.equal(scopeGate(db, PM, "applied", { exists: true, roleKey: "pm", now: NOW, policy }), "keep", "an application keeps its posting");
  assert.equal(active(db, "applied"), 1);
});

test("⛔ D78 B: the sweep — dry by default, judges the STORED family, keeps applied, retires (never deletes) starred", () => {
  const db = db0();
  for (let i = 0; i < 10; i++) insert(db, `swe${i}`, "Software Engineer", "engineering");
  insert(db, "pm", PM.title, "pm");
  insert(db, "applied", PM.title, "pm");
  insert(db, "starred", "Senior Recruiter", "hr");
  insert(db, "stored", "Platform Engineer", "sales");          // the stored family decides, not a re-read of the title
  db.prepare("INSERT INTO user_jobs (user_id, job_id, applied) VALUES (1, 'applied', 1)").run();
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'starred', 1)").run();
  const dry = sweepScope(db, { now: NOW });
  assert.deepEqual([dry.dryRun, dry.candidates, dry.appliedKept], [true, 3, 1]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(), 14, "the dry run changed nothing");
  const run = sweepScope(db, { dryRun: false, now: NOW });
  assert.equal(run.retired, 3);
  assert.deepEqual(["pm", "starred", "stored", "applied", "swe0"].map(id => active(db, id)), [0, 0, 0, 1, 1]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE job_id = 'starred'").pluck().get(), 1, "retired, NEVER deleted");
  assert.equal(reason(db, "starred"), "out_of_scope", "the reason is the undo");
});

test("⛔ D78 B: NO share ceiling (owner 10-08) — a real pass retires every out-of-scope posting, even 60% of the board", () => {
  const db = db0();
  for (let i = 0; i < 6; i++) insert(db, `pm${i}`, PM.title, "pm");
  for (let i = 0; i < 4; i++) insert(db, `swe${i}`, "Software Engineer", "engineering");
  const r = sweepScope(db, { dryRun: false, now: NOW });
  assert.deepEqual([r.retired, "refused" in r], [6, false]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1").pluck().get(), 4);
  assert.doesNotMatch(fs.readFileSync("services/jobs/boardScope.js", "utf8"), /CEILING_SHARE|\bforce\b/, "the ceiling and its force are gone, not dormant");
});

test("⛔ D78: the crawl's age and scope counters count only rows that were ON THE BOARD — the gates still run on every stored row", () => {
  const src = fs.readFileSync("services/jobs/aggregator.js", "utf8").replace(/\r\n/g, "\n");
  assert.ok(src.includes("SELECT job_id, _hash, is_active FROM scraped_jobs WHERE source = ?"), "the existing-row read carries is_active");
  assert.ok(src.includes("const activeIds = new Set(existingRows.filter(r => r.is_active === 1)"), "the active set is built from it");
  for (const c of ["agedOut++", "wouldAgeOut++", "scopedOut++", "wouldScopeOut++"]) {
    const line = src.split("\n").find(l => l.includes(c));
    assert.ok(line && line.includes("activeIds.has(jobId)"), `${c} is guarded by activeIds`);
  }
  assert.ok(src.includes('if (age === "aged_out") { if (activeIds.has(jobId)) agedOut++; continue; }'), "an inactive aged row still stops before the touch");
  assert.ok(src.includes('if (scope === "scoped_out") { if (activeIds.has(jobId)) scopedOut++; continue; }'), "an inactive scoped row still stops before the touch");
});

test("⛔ D78 B: the crawl judges an EXISTING row before the hash check, and a NEW one after classifying", () => {
  const src = fs.readFileSync("services/jobs/aggregator.js", "utf8").replace(/\r\n/g, "\n");
  const pre = src.indexOf("const scope = scopeGate(db, job, jobId, { exists, roleKey: storedFamily(");
  const hash = src.indexOf("const contentHash = fingerprintJob(job);");
  const post = src.indexOf("const scope = scopeGate(db, job, jobId, { exists, roleKey: verdict.roleKey");
  const verdict = src.indexOf("const verdict = classifyJob(");
  assert.ok(pre > 0 && hash > pre, "the existing-row gate precedes the hash check");
  assert.ok(post > verdict, "the new-row gate follows classification");
  assert.match(src, /outOfScope, scopedOut, wouldScopeOut \},/, "the run details carry the counts");
});

test("⛔ D78 B: the 03:30 cron guards each sweep on its own — no early return skips the scope sweep", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const start = at(src, 'cron.schedule("30 3 * * *"');
  const body = src.slice(start, at(src, "\n});", start));
  assert.ok(body.includes("sweepScope(db, { dryRun: false })"), "the cron runs the scope sweep");
  assert.doesNotMatch(body.replace(/\/\/.*$/gm, ""), /\breturn\b/, "a return in the age block would skip the scope sweep");
});
