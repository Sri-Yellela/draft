// ⭐ D66 · A BASE-RÉSUMÉ-ONLY PAYLOAD (services/baseResumeOnly.js, routes/apply.js, routes/account.js,
// migration 139). The REAL apply router, mounted with a model stub that COUNTS its calls.
//
// ⛔ The row's tests: with the setting on, zero model calls on Draft / Prepare / packet · the packet carries
// the base résumé · (D58) no tailored score where none was made. Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { baseResumeOnlyState, baseOnlyGeneration, activeBaseResume } from "../services/baseResumeOnly.js";
import { at } from "../test-support/sourceAnchors.js";

const BASE = `Ada Synthetic
Software Engineer | ada@example.invalid

EXPERIENCE
Northwind — Senior Software Engineer
Jan 2022 – Present
- Built the billing service in Go

SKILLS
Languages: Go, SQL`;
const PAYLOAD = { field_map: { first_name: "Ada", last_name: "Synthetic", email: "ada@example.invalid" }, handler_map: {}, custom_answers: {} };

function mount({ baseOnly = true } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier,base_resume_only) VALUES (1,'ada','x','PRO',?)").run(baseOnly ? 1 : 0);
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Synthetic','ada@example.invalid')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt',?,unixepoch()-100)").run(BASE);
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
              VALUES ('gh::1','Platform Engineer','Northwind','https://boards.greenhouse.io/northwind/jobs/1','https://boards.greenhouse.io/northwind/jobs/1','t','h1',unixepoch()-86400)`).run();
  const model = { calls: 0 };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const hooks = applyRoutes(app, db, (q, r, n) => n(), () => PAYLOAD,
    async () => { model.calls++; return { html: "<p>tailored</p>", resumeId: 99, atsScore: 88 }; },
    async () => Buffer.from("%PDF-1.4 synthetic"), async () => ({}), () => null, {});
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  return { db, hooks, base, model, stop: () => { server.close(); db.close(); } };
}
const settle = () => new Promise(r => setTimeout(r, 60));

test("⛔ D66 · with the setting on, the generator NEVER calls the model — it answers with the base résumé", async () => {
  const t = mount({ baseOnly: true });
  try {
    const g = await t.hooks.resumeForApply(1, "gh::1", "generate");
    assert.equal(t.model.calls, 0);
    assert.equal(g.baseOnly, true);
    assert.equal(g.resumeId, null, "no tailored artifact was made");
    assert.match(g.html, /Northwind/);
  } finally { t.stop(); }
});

test("D66 · with the setting OFF, the generator is the model, exactly as before", async () => {
  const t = mount({ baseOnly: false });
  try {
    const g = await t.hooks.resumeForApply(1, "gh::1", "generate");
    assert.equal(t.model.calls, 1);
    assert.equal(g.resumeId, 99);
  } finally { t.stop(); }
});

test("⛔ D66 · Prepare with the setting on: zero model calls, the packet carries the BASE résumé and serves it", async () => {
  const t = mount({ baseOnly: true });
  try {
    // A current tailored résumé exists for this job — base-only still sends the base one.
    t.db.prepare(`INSERT INTO resumes (id,user_id,job_id,company,role,html,ats_score,domain_profile_id) VALUES (5,1,'gh::1','Northwind','Platform Engineer','<p>tailored</p>',90,10)`).run();
    const p = t.hooks.prepareManualPacket({ userId: 1, jobId: "gh::1" });
    assert.equal(p.ok, true, JSON.stringify(p));
    assert.equal(p.resume, "base");
    await settle();
    assert.equal(t.model.calls, 0);
    const row = t.db.prepare("SELECT resume_artifact_id, answers_json FROM apply_gate_packets WHERE id=?").get(p.packetId);
    assert.equal(row.resume_artifact_id, null, "no tailored artifact on the packet");
    const packet = JSON.parse(row.answers_json);
    assert.equal(packet.resumeSource, "base");
    assert.equal(packet.entries?.resumeSource, "base", "work history and skills read from the base résumé (D65)");
    assert.ok(packet.entries.work.some(w => /Northwind/.test(w.company)));
    const r = await fetch(`${t.base}/api/apply/gate-packets/${p.packetId}/resume`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-type"), "application/pdf");
    // D58: the packet names no tailored score, because none was made.
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM resumes WHERE user_id=1").pluck().get(), 1, "the tailored one is kept, never overwritten");
  } finally { t.stop(); }
});

test("D66 · base-only with no base résumé: the packet fills answers only, and says so — still no model call", async () => {
  const t = mount({ baseOnly: true });
  try {
    t.db.prepare("DELETE FROM profile_base_resumes").run();
    const p = t.hooks.prepareManualPacket({ userId: 1, jobId: "gh::1" });
    assert.equal(p.resume, "none");
    await settle();
    assert.equal(t.model.calls, 0);
    assert.match(t.db.prepare("SELECT message FROM apply_job_logs WHERE event='packet_resume_absent'").pluck().get() || "", /no base résumé/, "said, not swallowed");
    assert.deepEqual(baseOnlyGeneration(t.db, 1).errorCode, "no_base_resume");
  } finally { t.stop(); }
});

test("D66 · the setting: the user's switch, or a plan that forces it — and off by default", () => {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','BASIC')").run();
  assert.deepEqual(baseResumeOnlyState(d, 1), { on: false, source: null }, "default off — no plan forces it today");
  assert.deepEqual(baseResumeOnlyState(d, 1, { forcedTiers: ["BASIC"] }), { on: true, source: "plan" }, "the tier flag");
  d.prepare("UPDATE users SET base_resume_only = 1 WHERE id = 1").run();
  assert.deepEqual(baseResumeOnlyState(d, 1), { on: true, source: "setting" });
  assert.equal(activeBaseResume(d, 1), null);
});

test("D66 · the settings route and the Account switch", () => {
  const acc = fs.readFileSync("routes/account.js", "utf8");
  assert.match(acc, /router\.get\("\/api\/settings\/base-resume-only"/);
  assert.match(acc, /router\.put\("\/api\/settings\/base-resume-only"/);
  assert.match(acc, /typeof req\.body\?\.on !== "boolean"/, "a malformed body is refused, never half-stored");
  const ui = fs.readFileSync("client/src/panels/AccountPanel.jsx", "utf8");
  assert.match(ui, /Use my base résumé for applications/);
  assert.match(ui, /<BaseResumeOnly \/>/);
});

test("D66 · one wrapper holds the setting for every résumé the router asks for", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8").replace(/\r\n/g, "\n");
  const wrap = src.slice(at(src, "const generateResumeForApplyModel = generateResumeForApply;"), at(src, "const buildAutofillPayloadBase = buildAutofillPayload;"));
  assert.match(wrap, /if \(baseResumeOnlyState\(db, userId\)\.on\) return baseOnlyGeneration\(db, userId\);/);
  // Every generation site in the router calls the (wrapped) name — none reaches the model another way.
  assert.equal([...src.matchAll(/generateResumeForApplyModel\(/g)].length, 1, "the model is called from the wrapper only");
});

test("D66 · migration 139 is byte-identical in both runners", () => {
  const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "139_base_resume_only"'); return s.slice(i, at(s, "`,", i)); };
  assert.equal(block("server.js"), block("scripts/migrations.js"));
});
