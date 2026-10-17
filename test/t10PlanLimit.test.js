// T10 row 21 · THE PLAN'S LIMIT — the two refusals no test reached (docs/EXTENSION_SCENARIOS.md, 43k).
// services/extensionResume.js start(): preflight() answers "plan_limit" (checkLimit resume_generate) or "upgrade_required"
// (monetisation on, the plan's tool not enabled) — server.js's preflight. Each must refuse BEFORE anything is spent:
// its own status and fixed sentence, the allowance beside it, no draft slot used, no generation row, nothing queued, no
// model call. And the extension's résumé view shows that sentence as it is. SYNTHETIC people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createExtensionResumeService, USER_ERRORS } from "../services/extensionResume.js";
import { at } from "../test-support/sourceAnchors.js";

function setup(preflight) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','FREE')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content) VALUES (10,1,'base.txt',?)").run("Ada Example — engineer. ".repeat(10));
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,discovered_at,is_active) VALUES
    ('greenhouse::100','Software Engineer','Example Co','Remote','https://boards.greenhouse.io/example/jobs/100','t','h',unixepoch(),1)`).run();
  let generated = 0;
  const service = createExtensionResumeService({ db, preflight, renderPdf: async () => Buffer.from("%PDF"),
    defer: (fn) => setImmediate(fn), log: { error() {}, warn() {} },
    generate: async () => { generated++; return { version: 1 }; } });
  return { db, service, generated: () => generated };
}

for (const [code, status] of [["plan_limit", 429], ["upgrade_required", 403]]) {
  test(`⛔ row 21 · ${code}: refused BEFORE anything is spent — ${status}, the fixed sentence, no slot, no generation, no model call`, async () => {
    const { db, service, generated } = setup(() => code);
    const r = service.start(1, { jobId: "greenhouse::100" });
    assert.equal(r.status, status);
    assert.equal(r.body.code, code);
    assert.equal(r.body.error, USER_ERRORS[code].message);
    assert.ok("allowance" in r.body, "the allowance is said beside it");
    assert.equal(db.prepare("SELECT COUNT(*) FROM draft_slot_uses").pluck().get(), 0, "no draft slot used");
    assert.equal(db.prepare("SELECT COUNT(*) FROM extension_resume_generations").pluck().get(), 0, "no generation row");
    await new Promise(z => setTimeout(z, 20));
    assert.equal(generated(), 0, "no model call");
  });
}

test("row 21 · the extension's résumé view shows each refusal's own sentence — never the generic one", async () => {
  const { resumePanelModel } = await import("../extension/resumePanel.js");
  for (const code of ["plan_limit", "upgrade_required"]) {
    const m = resumePanelModel({ job: { jobId: "greenhouse::100", title: "Software Engineer", company: "Example Co" },
      error: { error: USER_ERRORS[code].message, code } });
    assert.equal(m.state, "error");
    assert.ok(JSON.stringify(m).includes(USER_ERRORS[code].message), `${code}: its sentence is shown`);
  }
});

test("row 21 · server.js's preflight mints both — upgrade_required when the plan's tool is off, plan_limit from checkLimit", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const i = at(src, "  preflight: (userId) => {");
  const block = src.slice(i, at(src, "\n  },", i));
  assert.match(block, /if \(!allowed\) return "upgrade_required";/);
  assert.match(block, /if \(!checkLimit\(db, userId, "resume_generate"\)\.allowed\) return "plan_limit";/);
  assert.ok(at(block, "\"upgrade_required\"") < at(block, "\"plan_limit\""), "the plan's tool is checked before its limit");
});
