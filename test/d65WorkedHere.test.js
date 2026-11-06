// ⭐ D65 residual · "HAVE YOU WORKED HERE BEFORE?" READS THE RÉSUMÉ THE PACKET CARRIES.
//
// D65 made the packet's work history and skills come from the résumé it carries, and attachPacketResume
// re-reads them when a résumé is attached after the packet was built. But the packet's `workedHere`
// (D55 f) was computed from the autofill payload, and that payload's history was read from the BASE
// résumé — so a tailored résumé that dropped a role still answered "Yes" for that employer.
// routes/apply.js now derives the history from the packet's own entries (withCarriedWorkHistory) and
// rebuilds the stored answer once the résumé is known (refreshPacketWorkedHere). Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { at } from "../test-support/sourceAnchors.js";

// The base résumé has the Fabrikam internship; the résumé written for the Fabrikam job DROPPED it.
const BASE = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind | Senior Software Engineer
Jan 2022 – Present
- Built the billing service in Go

Fabrikam | Intern
Jun 2018 – Aug 2018
- Tested the payroll app

SKILLS
Languages: Go, Python, SQL`;
const TAILORED = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind | Senior Software Engineer
Jan 2022 – Present
- Built the billing service in Go

SKILLS
Languages: Go, SQL`;

function mount(generate) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Synthetic','ada@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt',?,unixepoch())").run(BASE);
  // An .example host (never resolves): the run holds provider_review_only before any browser and parks a
  // profile-only packet with NO résumé — the packet is built before its résumé is known.
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,is_active)
              VALUES ('wh::1','Engineer','Fabrikam','https://careers.fabrikam.example/apply/1','https://careers.fabrikam.example/apply/1','t','h1',1)`).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(),
    () => ({ field_map: {}, custom_answers: {},
             handler_map: { "first-name": "Ada", "last-name": "Synthetic", email: "ada@example.test" } }),
    async (userId, jobId) => generate(db, userId, jobId), noop, noop, () => null);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { db, post, stop: () => server.close() };
}
const waitFor = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); } return fn(); };
const packetOf = (db) => db.prepare("SELECT * FROM apply_gate_packets WHERE job_id='wh::1' ORDER BY id DESC").get();
const events = (db) => db.prepare("SELECT event FROM apply_job_logs WHERE job_id='wh::1' ORDER BY id").pluck().all();

test("⛔ D65 residual · a tailored résumé that dropped the employer no longer answers 'worked here' Yes from the base résumé", async () => {
  const t = mount((db, userId, jobId) => {
    const id = db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,updated_at) VALUES (?,?,'Fabrikam','Engineer',?,unixepoch())")
      .run(userId, jobId, TAILORED).lastInsertRowid;
    return { html: TAILORED, resumeId: id, atsScore: 80 };
  });
  try {
    assert.equal((await t.post("/api/apply/runs", { jobIds: ["wh::1"], mode: "auto", surface: "board" })).status, 202);
    assert.ok(await waitFor(() => events(t.db).includes("packet_resume_ready")), `events: ${events(t.db)}`);
    const body = JSON.parse(packetOf(t.db).answers_json);
    assert.ok(!body.entries.work.some(w => /Fabrikam/.test(w.company || "")), "the carried résumé has no Fabrikam role");
    assert.equal(body.workedHere.company, "Fabrikam");
    assert.notEqual(body.workedHere.answer, "Yes", "the base résumé's internship must not answer for the tailored one");
    assert.deepEqual([body.workedHere.answer, body.workedHere.reason], ["No", "not_in_work_history"],
      "the answer the CARRIED résumé's work history gives");
  } finally { t.stop(); }
});

test("D65 residual · with no résumé attached the packet still carries the base résumé — and the base's history answers Yes", async () => {
  const t = mount(() => ({ error: "tools service 503", errorCode: "tools_unavailable" }));
  try {
    await t.post("/api/apply/runs", { jobIds: ["wh::1"], mode: "auto", surface: "board" });
    assert.ok(await waitFor(() => events(t.db).includes("packet_resume_failed")), `events: ${events(t.db)}`);
    const body = JSON.parse(packetOf(t.db).answers_json);
    assert.ok(body.entries.work.some(w => /Fabrikam/.test(w.company || "")));
    assert.deepEqual([body.workedHere.answer, body.workedHere.reason], ["Yes", "in_work_history"]);
  } finally { t.stop(); }
});

test("D65 residual · every packet build derives the answer from its own entries, and the attach rebuilds it", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  const create = src.slice(at(src, "function createGatePacket("), at(src, "const PREPARED_REASON"));
  // D96 §4 (J8) wraps both in withSavedAnswerRecords — the work history is still carried from the packet's own entries.
  assert.match(create, /autofillPayload: withSavedAnswerRecords\(userId, withCarriedWorkHistory\(userId, autofillPayload, entries\)\),/);
  const prepared = src.slice(at(src, "function prepareManualPacket("), at(src, "async function processRunJob("));
  // ⭐ D165 (3) (changed on purpose): the payload is built for THIS job (its role + location pick the scoped salary answer).
  assert.match(prepared, /autofillPayload: withSavedAnswerRecords\(userId, withCarriedWorkHistory\(userId, buildAutofillPayload\(profile, "APPLY", job\.company, jobId\), entries\)\),/);
  const attach = src.slice(at(src, "async function attachPacketResume("), at(src, "function packetEntriesFor("));
  assert.equal((attach.match(/refreshPacketWorkedHere\(packetId, userId, entries\)/g) || []).length, 2,
    "both the tailored attach and the base-only branch");
});
