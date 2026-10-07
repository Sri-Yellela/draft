// O80c (owner, 10-07): "yes packets should carry a resume — that's the whole point."
//
// A handoff packet is the candidate finishing an application in their own browser; the extension fills
// the answers and attaches the résumé from the release's resumeUrl. But a preview DEFERS generation to
// approval (AL2), and a packet's hold never reaches an approval — so every packet D52 measured had
// resume_artifact_id NULL (the same gap as O73b). attachPacketResume writes it in the background.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { draftSlots } from "../services/draftSlots.js";
import { packetLife } from "../client/src/lib/draftHouseExceptions.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function mount(generate) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Synthetic','ada@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  // A provider outside v1 scope (an .example host, which never resolves): the run holds provider_review_only BEFORE any
  // browser and parks a profile-only packet — the early-hold path.
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,is_active)
              VALUES ('wk::1','Engineer','Northwind','https://careers.northwind.example/apply/1','https://careers.northwind.example/apply/1','t','h1',1)`).run();
  const calls = [];
  const gen = async (userId, jobId, tool) => { calls.push({ userId, jobId, tool }); return generate(db, userId, jobId); };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(),
    // A synthetic profile payload, so the canonical packet has answers to carry.
    () => ({ field_map: {}, custom_answers: {},
             handler_map: { "first-name": "Ada", "last-name": "Synthetic", email: "ada@example.test" } }),
    gen, noop, noop, () => null);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { db, calls, post, stop: () => server.close() };
}
const waitFor = async (fn, ms = 5000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); } return fn(); };
const packetOf = (db) => db.prepare("SELECT * FROM apply_gate_packets WHERE job_id='wk::1' ORDER BY id DESC").get();
const events = (db) => db.prepare("SELECT event FROM apply_job_logs WHERE job_id='wk::1' ORDER BY id").pluck().all();

test("O80c · a packet carries its résumé — written once, linked on the packet AND the run-job, no extra slot", async () => {
  const t = mount((db, userId, jobId) => {
    const id = db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,updated_at) VALUES (?,?,'Northwind','Engineer','<p>r</p>',unixepoch())")
      .run(userId, jobId).lastInsertRowid;
    return { html: "<p>r</p>", resumeId: id, atsScore: 81 };
  });
  try {
    assert.equal((await t.post("/api/apply/runs", { jobIds: ["wk::1"], mode: "auto", surface: "board" })).status, 202);
    assert.ok(await waitFor(() => packetOf(t.db)?.resume_artifact_id != null), `no résumé on the packet — events: ${events(t.db)}`);
    const pk = packetOf(t.db);
    assert.equal(JSON.parse(pk.answers_json).resumeArtifactId, pk.resume_artifact_id, "the packet body agrees with its column");
    const rj = t.db.prepare("SELECT status, reason_code, resume_artifact_id, resume_ats_score FROM apply_run_jobs WHERE job_id='wk::1'").get();
    assert.deepEqual([rj.status, rj.reason_code], ["held_review", "provider_review_only"], "the hold is unchanged");
    assert.equal(rj.resume_artifact_id, pk.resume_artifact_id); assert.equal(rj.resume_ats_score, 81);
    assert.equal(t.calls.length, 1, "one generation");
    assert.ok(events(t.db).includes("packet_resume_ready"));
    assert.equal(draftSlots(t.db, 1).used, 1, "the Draft's own slot — the packet's résumé costs no second one");
  } finally { t.stop(); }
});

test("O80c · a failed generation never changes the hold — the packet stays, fillable, and says so", async () => {
  const t = mount(() => ({ error: "tools service 503", errorCode: "tools_unavailable" }));
  try {
    await t.post("/api/apply/runs", { jobIds: ["wk::1"], mode: "auto", surface: "board" });
    assert.ok(await waitFor(() => events(t.db).includes("packet_resume_failed")), `events: ${events(t.db)}`);
    const pk = packetOf(t.db);
    assert.ok(pk, "the packet survived");
    assert.equal(pk.resume_artifact_id, null);
    assert.equal(pk.consumed_at, null);
    assert.equal(t.db.prepare("SELECT status FROM apply_run_jobs WHERE job_id='wk::1'").pluck().get(), "held_review");
  } finally { t.stop(); }
});

test("O80c · only packets — a preview waiting for approval still defers its résumé to the approval (AL2)", () => {
  const src = read("routes/apply.js");
  // The attach hangs off createGatePacket alone, and shouldBuildPacket keeps awaiting_approval out of it.
  assert.match(src, /if \(resumeArtifactId == null\) \{\n\s+attachPacketResume\(\{ packetId, runId, runJobId, userId, jobId, toolType \}\)/);
  // One caller that may GENERATE. D56's prepared packet is the second caller, and it never generates:
  // it passes allowGenerate: false, so a manual packet only ever reuses the résumé the user made.
  const callers = src.match(/\n\s+attachPacketResume\(\{ packetId[^)]*\)/g) || [];
  assert.equal(callers.filter(c => !/allowGenerate: false/.test(c)).length, 1, "one generating caller");
  assert.equal(callers.length, 2, "the generating caller and D56's prepared, non-generating one");
  assert.match(src, /if \(artifactId == null && !allowGenerate\) \{/);
  // ⛔ The kill switch is read right before the model call.
  assert.match(src, /if \(artifactId == null\) \{\n\s+if \(fullAutoDisabled\(\)\) \{/);
  // ⛔ The early holds run before `const toolType` — they must not read it (TDZ would lose the packet).
  assert.match(src, /toolType: run\.tool_type \|\| "generate",/);
});

test("O80c · Draft House says whether the packet carries its résumé", () => {
  const H = 3600000;
  assert.match(packetLife({ ageMs: H, staleAfterMs: 72 * H, resumeAvailable: true }).line, /^Ready to fill, with its résumé — fresh for/);
  assert.match(packetLife({ ageMs: H, staleAfterMs: 72 * H, resumeAvailable: false }).line, /Prepare again writes one/);
});
