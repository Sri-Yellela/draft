// T10 rows 18 and 19 · THE ACCOUNT STATES — no base résumé; a résumé but no job profile (open item 4).
//
// The real routes (routes/apply.js prepare / match / Copy sheet; routes/extensionResume.js with the generation STUBBED —
// test-support/extensionResumeStub.mjs) on a full in-memory schema, and the review row's résumé choices
// (gated-handoff.js resumeFilesFor) against those answers. What each state must say and do:
//   (18) NO BASE RÉSUMÉ — the answers are still prepared and filled; the résumé is said to be absent ("attach one
//        yourself"); "Attach my résumé" is not offered; ⛔ "Generate and attach" is not offered either — a generation is
//        made FROM the base résumé, so the button could only be refused; a Generate that arrives anyway is refused with
//        "Upload your résumé in draft first." before anything is spent (no generation row, no Draft slot, no model call).
//   (19) A RÉSUMÉ BUT NO JOB PROFILE — the account-level résumé is the base: prepare works, "Attach my résumé" is
//        offered and the PDF is served, and a generation starts.
// Synthetic person (Ada Example) only.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { mountExtensionResume, BASE_RESUME } from "../test-support/extensionResumeStub.mjs";

const URL_ = "https://boards.greenhouse.io/synthco/jobs/9001";
const PAYLOAD = { field_map: { first_name: "Ada", last_name: "Example", email: "ada@example.test" }, handler_map: {}, custom_answers: {} };

function mount({ profile = true, resume = "none" } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  if (profile) db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  if (resume === "account") db.prepare("INSERT INTO base_resume (user_id,name,content) VALUES (1,'base.txt',?)").run(BASE_RESUME);
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('gh-1','Software Engineer','Synthco','Remote (US)',?,?,'t','h1',unixepoch()-86400)`).run(URL_, URL_);
  db.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (1,'gh-1',?,'capture','attached')").run(URL_);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  applyRoutes(app, db, (q, r, n) => n(), () => PAYLOAD, async () => ({ error: "no model in tests" }),
    async () => Buffer.from("%PDF-1.4 synthetic"), async () => ({}), () => null, {});
  app.use("/api/import", createImportJobRouter(db));
  const ctl = mountExtensionResume(app, db, { userId: 1, profileId: profile ? 10 : null });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body) => fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => null), type: r.headers.get("content-type") }));
  return { db, ctl, base, call, stop: () => { server.close(); db.close(); } };
}

// the review row's choices, as the extension asks them — chrome.storage + a fetch that reaches the test server with the
// extension's token (the stub's router lets every request through as user 1)
async function rowChoices(base) {
  const local = new Map([["authToken", "tok-ada"]]);
  globalThis.chrome = {
    storage: {
      local: { async get(k) { const ks = k == null ? [...local.keys()] : [].concat(k); return Object.fromEntries(ks.filter(x => local.has(x)).map(x => [x, local.get(x)])); },
        async set(o) { for (const [k, v] of Object.entries(o)) local.set(k, v); }, async remove(k) { for (const x of [].concat(k)) local.delete(x); } },
      session: { async get() { return {}; }, async set() {}, async remove() {} },
    },
    runtime: { sendMessage: async () => null, getURL: (p) => `chrome-extension://test/${p}`, onMessage: { addListener() {} } },
  };
  try {
    const { resumeFilesFor } = await import("../extension/gated-handoff.js");
    return await resumeFilesFor(base, "gh-1", { setting: "on_cue" });
  } finally { delete globalThis.chrome; }
}

test("⭐ row 18 · NO BASE RÉSUMÉ: the answers are still prepared, and the résumé is said to be absent", async (t) => {
  const { call, stop } = mount({ profile: true, resume: "none" }); t.after(stop);
  const m = await call("POST", "/api/apply/handoff/match", { url: URL_ });
  assert.equal(m.body.state, "prepare", "a job of yours with nothing prepared — Fill prepares it");
  const p = await call("POST", "/api/apply/prepare", { url: URL_ });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.resume, "none");
  assert.ok(p.body.packet.answerCount >= 3, "the profile's answers are prepared without a résumé");
  assert.equal(p.body.message, "Prepared — your answers. No current résumé for this job, so attach one yourself.");
  const sheet = await call("POST", "/api/apply/copy-sheet", { url: URL_ });
  assert.equal(sheet.body.source, "packet");
  assert.ok(sheet.body.rows.some(r => r.name === "email" && r.value === "ada@example.test"), "the Copy sheet lists the prepared answers");
});

test("⛔ row 18 · NO BASE RÉSUMÉ: no 'Attach my résumé', no 'Generate and attach' — and a Generate sent anyway spends nothing", async (t) => {
  const { ctl, base, call, stop } = mount({ profile: true, resume: "none" }); t.after(stop);
  assert.deepEqual((await call("GET", "/api/extension/base-resume")).body, { exists: false, fileName: null });
  assert.equal((await call("GET", "/api/extension/base-resume/pdf/file")).status, 404);
  const files = await rowChoices(base);
  assert.equal(files.base, false, "no 'Attach my résumé' without a résumé to attach");
  assert.equal(files.generate, false, "⛔ no 'Generate and attach' — a generation is made from the base résumé, so it could only be refused");
  assert.equal(files.tailored, null);
  const g = await call("POST", "/api/extension/resume", { boundJobId: "gh-1", trigger: "click" });
  assert.equal(g.status, 409);
  assert.equal(g.body.error, "Upload your résumé in draft first.");
  assert.equal(ctl.generations().length, 0, "no generation row");
  assert.equal(ctl.slots(), 0, "no Draft slot spent");
  assert.equal(ctl.calls.length, 0, "no model call");
});

test("⭐ row 19 · A RÉSUMÉ BUT NO JOB PROFILE: the account's résumé is the base — prepare works, Attach my résumé is offered and served, a generation starts", async (t) => {
  const { ctl, base, call, stop } = mount({ profile: false, resume: "account" }); t.after(stop);
  const p = await call("POST", "/api/apply/prepare", { url: URL_ });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.ok(p.body.packet.answerCount >= 3);
  const info = (await call("GET", "/api/extension/base-resume")).body;
  assert.equal(info.exists, true);
  assert.match(info.fileName, /^Ada_Example.*\.pdf$/);
  const pdf = await call("GET", "/api/extension/base-resume/pdf/file");
  assert.equal(pdf.status, 200);
  assert.equal(pdf.type, "application/pdf");
  assert.ok(ctl.rendered.at(-1).includes("distributed systems"), "rendered from the account's résumé");
  const files = await rowChoices(base);
  assert.equal(files.base, true);
  assert.equal(files.generate, true, "with a base résumé, Generate and attach is offered on cue");
  const g = await call("POST", "/api/extension/resume", { boundJobId: "gh-1", trigger: "click" });
  assert.equal(g.status, 202, JSON.stringify(g.body));
  assert.ok(["queued", "generating", "ready"].includes(g.body.status), g.body.status);
  const done = await (async () => { for (let i = 0; i < 100; i++) { const r = ctl.generations(); if (r[0]?.status === "ready") return r; await new Promise(z => setTimeout(z, 20)); } return ctl.generations(); })();
  assert.deepEqual(done.map(r => r.status), ["ready"], "ONE generation, made from the account's résumé");
  assert.equal(ctl.slots(), 1);
});
