// ⭐ FIELD REPORT 10-14 (owner, production, the real Stripe job opened from the board) — T2, T3, T6.
//
//   T2  the page is matched to the board's copy by the ATS's own job id — Stripe's careers page
//       (…/careers/listing/software-engineer-backend/8198280?gh_jid=8198280) is greenhouse::8198280, which the board
//       stores as stripe.com/jobs/search?gh_jid=8198280 (measured in production, 10-14). Lever, Ashby, Workable and
//       SmartRecruiters by the same rule; a capture LINKS to the job and never makes a second row.
//   T3  ATS without a capture: the board job's report, or the base résumé against the page's own text.
//   T6  why a generation failed is recorded as a code (`cause`) and shown in Options → "Show details" — never in the
//       user's sentence; the details carry no token, no answer value and no page query.
// Synthetic people and postings only (the Stripe ids are the public posting's, which is the case being fixed).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { atsJobKeyOf, jobIdForAtsKey, pageKeyOf } from "../services/jobPageKey.js";
import { resolvePageJob } from "../services/manualHandoff.js";
import { pageJobForExtension, createExtensionJobRouter } from "../routes/extensionJob.js";
import { computeFingerprint } from "../services/jobs/schema.js";
import { importJob } from "../services/jobs/importJob.js";
import { createExtensionResumeService, causeOf, causeView } from "../services/extensionResume.js";
import { USER_ERRORS } from "../services/extensionResume.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const STRIPE_PAGE = "https://stripe.com/careers/listing/software-engineer-backend/8198280?gh_jid=8198280";
const STRIPE_BOARD = "https://stripe.com/jobs/search?gh_jid=8198280";

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at,is_active,fingerprint,description)
                          VALUES (?,?,?,?,?,?,'t',?,unixepoch(),1,?,?)`);
  const row = (id, title, company, location, url, desc = "Build APIs in Go and Postgres for payments.") =>
    ins.run(id, title, company, location, url, null, `h-${id}`, computeFingerprint({ company, title, location }), desc);
  row("greenhouse::8198280", "Software Engineer, Backend", "Stripe", "San Francisco, CA", STRIPE_BOARD);
  row("lever::1bbaf909-5ff3-4ed6-87ca-f7ff007a169c", "Backend Engineer", "Synthify", "New York, NY", "https://jobs.lever.co/synthify/1bbaf909-5ff3-4ed6-87ca-f7ff007a169c");
  row("ashby::06e1d3a8-2706-4ed9-9fe6-8b69607de18e", "Platform Engineer", "Notionly", "Remote (US)", "https://jobs.ashbyhq.com/notionly/06e1d3a8-2706-4ed9-9fe6-8b69607de18e/application");
  row("workable::BEF96D80EF", "Data Engineer", "Workco", "Austin, TX", "https://apply.workable.com/j/BEF96D80EF/apply");
  row("smartrecruiters::744000012345678", "SRE", "Visaly", "Denver, CO", "https://jobs.smartrecruiters.com/Visaly/744000012345678-sre");
  row("import::text-only", "Staff Engineer", "Textco", "Boston, MA", "https://careers.textco.test/staff");
  return db;
}

// ── T2 · identity ───────────────────────────────────────────────────────────────────────────────────────────────────
test("T2 · atsJobKeyOf names the board's id for every family the board holds — and embedded ids are marked", () => {
  const k = (u) => { const x = atsJobKeyOf(u); return x && `${x.jobId}${x.embedded ? " (embedded)" : ""}`; };
  assert.equal(k(STRIPE_PAGE), "greenhouse::8198280 (embedded)");
  assert.equal(k(STRIPE_BOARD), "greenhouse::8198280 (embedded)");
  assert.equal(k("https://boards.greenhouse.io/stripe/jobs/8198280"), "greenhouse::8198280");
  assert.equal(k("https://job-boards.greenhouse.io/stripe/jobs/8198280?gh_src=x"), "greenhouse::8198280");
  assert.equal(k("https://boards.greenhouse.io/embed/job_app?for=stripe&token=8198280"), "greenhouse::8198280");
  assert.equal(k("https://jobs.lever.co/synthify/1BBAF909-5ff3-4ed6-87ca-f7ff007a169c/apply"), "lever::1bbaf909-5ff3-4ed6-87ca-f7ff007a169c");
  assert.equal(k("https://jobs.ashbyhq.com/notionly/06e1d3a8-2706-4ed9-9fe6-8b69607de18e/application"), "ashby::06e1d3a8-2706-4ed9-9fe6-8b69607de18e");
  assert.equal(k("https://www.notionly.test/careers?ashby_jid=06e1d3a8-2706-4ed9-9fe6-8b69607de18e"), "ashby::06e1d3a8-2706-4ed9-9fe6-8b69607de18e (embedded)");
  assert.equal(k("https://apply.workable.com/workco/j/BEF96D80EF/"), "workable::BEF96D80EF");
  assert.equal(k("https://apply.workable.com/j/BEF96D80EF/apply"), "workable::BEF96D80EF");
  assert.equal(k("https://jobs.smartrecruiters.com/Visaly/744000012345678-sre"), "smartrecruiters::744000012345678");
  for (const none of ["https://stripe.com/jobs", "https://jobs.lever.co/synthify", "https://example.test/?gh_jid=abc", "ftp://x/?gh_jid=8198280", "not a url"]) {
    assert.equal(atsJobKeyOf(none), null, none);
  }
  assert.equal(pageKeyOf(STRIPE_PAGE), null, "the Workday page key is untouched — T2 adds an identity, it changes no canonicalisation");
});

test("⛔ T2 · an embedded id is accepted only for a job of THAT site — any page can carry ?gh_jid=", () => {
  const db = freshDb();
  assert.equal(jobIdForAtsKey(db, STRIPE_PAGE), "greenhouse::8198280", "Stripe's careers page is Stripe's job");
  assert.equal(jobIdForAtsKey(db, "https://careers.stripe.com/x?gh_jid=8198280"), "greenhouse::8198280", "a subdomain of the same site");
  assert.equal(jobIdForAtsKey(db, "https://evil.test/apply?gh_jid=8198280"), null, "another site naming Stripe's id is not Stripe's page");
  assert.equal(jobIdForAtsKey(db, "https://stripe.com/x?gh_jid=1111"), null, "an id the board does not hold");
  // a job stored under the ATS's own host, embedded on the employer's: the company names the site
  db.prepare("UPDATE scraped_jobs SET url='https://boards.greenhouse.io/stripe/jobs/8198280' WHERE job_id='greenhouse::8198280'").run();
  assert.equal(jobIdForAtsKey(db, STRIPE_PAGE), "greenhouse::8198280", "the company is the site's name");
  assert.equal(jobIdForAtsKey(db, "https://stripe.evil.test/?gh_jid=8198280"), null);
});

test("⭐ T2 · the popup's lookup (resolvePageJob) finds the board job the owner opened — how: ats_id", () => {
  const db = freshDb();
  const page = resolvePageJob(db, 1, STRIPE_PAGE);
  assert.equal(page.job?.jobId, "greenhouse::8198280");
  assert.equal(page.how, "ats_id");
  assert.equal(resolvePageJob(db, 1, "https://jobs.lever.co/synthify/1bbaf909-5ff3-4ed6-87ca-f7ff007a169c/apply").job?.jobId,
    "lever::1bbaf909-5ff3-4ed6-87ca-f7ff007a169c", "a Lever apply page is its posting's job");
  assert.equal(resolvePageJob(db, 1, "https://jobs.smartrecruiters.com/Visaly/744000012345678-sre").job?.jobId, "smartrecruiters::744000012345678");
  assert.equal(resolvePageJob(db, 1, "https://evil.test/?gh_jid=8198280").job, null);
});

test("⭐ T2 · a capture of the Stripe page LINKS to the board job — no second row", async () => {
  const db = freshDb();
  const before = db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get();
  const text = "Title: Software Engineer, Backend\nCompany: Stripe\nLocation: San Francisco, CA\n\n" + "Build APIs in Go. ".repeat(20);
  const out = await importJob({ url: STRIPE_PAGE, text }, { db, userId: 1 });
  assert.equal(out.job.id ?? out.job.jobId ?? out.job.job_id, "greenhouse::8198280");
  assert.equal(out.capture.matchedExisting, true, out.capture.message);
  assert.equal(db.prepare("SELECT COUNT(*) FROM scraped_jobs").pluck().get(), before, "the capture made a second row");
});

// ── T3 · ATS without a capture ──────────────────────────────────────────────────────────────────────────────────────
const deps = (over = {}) => {
  const calls = { board: [], page: [] };
  return { calls, deps: {
    scoreFor: (u, id) => { calls.board.push(id); return { score: 66, band: "strong", scorable: true, matched: ["go"], missing: ["kafka"] }; },
    scoreText: (u, job) => { calls.page.push(job); return { score: 41, band: "moderate", scorable: true, matched: ["python"], missing: ["rust"] }; },
    hasBaseResume: () => true, ...over } };
};

test("⭐ T3 · the board job by address: its own report (the board's number), never a capture first", () => {
  const db = freshDb();
  const { calls, deps: d } = deps();
  const out = pageJobForExtension(db, 1, { url: STRIPE_PAGE, text: "" }, d);
  assert.deepEqual({ ...out.posting }, { known: true, jobId: "greenhouse::8198280", title: "Software Engineer, Backend", company: "Stripe", how: "ats_id", onBoard: true, mine: false });
  assert.equal(out.kind, "job", "BINDING FIRST: the response says what the page is");
  assert.equal(out.basis, "board");
  assert.equal(out.ats.score, 66);
  assert.deepEqual(calls.board, ["greenhouse::8198280"]);
  assert.equal(calls.page.length, 0);
});

test("⭐ T3 · an address that names nothing: the CAPTURE'S OWN matcher on the page's text finds the board job", () => {
  const db = freshDb();
  const { deps: d } = deps();
  const text = "Title: Staff Engineer\nCompany: Textco\nLocation: Boston, MA\n\n" + "Lead the platform team. ".repeat(10);
  const out = pageJobForExtension(db, 1, { url: "https://careers.textco.test/jobs/staff-engineer?ref=li", text }, d);
  assert.equal(out.posting.jobId, "import::text-only");
  assert.equal(out.posting.how, "capture_match");
  assert.equal(out.basis, "board");
});

test("⭐ T3 · a page draft does not hold is scored against ITS OWN TEXT — and nothing is written", () => {
  const db = freshDb();
  const count = () => ["scraped_jobs", "job_captures", "ats_only_reports", "user_jobs"].map(t => db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get()).join(",");
  const before = count();
  const { calls, deps: d } = deps();
  const text = "Title: Robotics Engineer\nCompany: Newco\nLocation: Pittsburgh, PA\n\nWrite Python and C++ for arms. ".repeat(3);
  const out = pageJobForExtension(db, 1, { url: "https://newco.test/jobs/robotics", text }, d);
  assert.deepEqual(out.posting, { known: false, title: "Robotics Engineer", company: "Newco" });
  assert.equal(out.basis, "page");
  assert.equal(out.ats.score, 41);
  assert.match(calls.page[0].description, /Python and C\+\+/, "the page's own text is what was scored");
  assert.equal(count(), before, "the lookup wrote something");
  // no base résumé → said, not a guess
  const none = pageJobForExtension(db, 1, { url: "https://newco.test/jobs/robotics", text }, deps({ hasBaseResume: () => false }).deps);
  assert.deepEqual(none.ats, { state: "no_base_resume" });
  assert.equal(none.basis, null);
  // nothing to go on
  assert.deepEqual(pageJobForExtension(db, 1, { url: "https://newco.test/", text: "" }, d), { kind: "unread", posting: null, ats: null, basis: null });
  // text was read and it is no posting — "not a job", which is not the same sentence as "could not read the page"
  assert.equal(pageJobForExtension(db, 1, { url: "https://newco.test/", text: "Welcome to Newco. We make arms." }, d).kind, "not_a_job");
});

test("⭐ BINDING FIRST · an employer page naming no job is identified by its embedded ATS form's frame (≤ 3 frames)", () => {
  const db = freshDb();
  const { deps: d } = deps();
  const frame = "https://job-boards.greenhouse.io/embed/job_app?for=stripe&token=8198280";
  const out = pageJobForExtension(db, 1, { url: "https://careers.employer.test/apply", text: "", frameUrls: ["https://evil.test/x", frame] }, d);
  assert.equal(out.posting?.jobId, "greenhouse::8198280");
  assert.equal(out.posting.how, "frame");
  assert.equal(out.kind, "job");
  // a fourth frame is never looked at, and a non-http frame is ignored
  const four = pageJobForExtension(db, 1, { url: "https://careers.employer.test/apply", text: "",
    frameUrls: ["javascript:alert(1)", "https://a.test/", "https://b.test/", frame] }, d);
  assert.equal(four.posting, null);
  assert.equal(four.kind, "unread");
});

test("⛔ T3 · POST /api/extension/page is the extension's own credential only, rate-limited, and wired to the board's scorer", async (t) => {
  const db = freshDb();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; req.isExt = req.get("x-ext") !== "0"; next(); });
  app.use(createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: (req) => req.isExt, ...deps().deps, limit: { limit: 2, windowMs: 60_000 } }));
  const server = app.listen(0); t.after(() => server.close());
  const post = (ext = true) => fetch(`http://127.0.0.1:${server.address().port}/api/extension/page`, { method: "POST",
    headers: { "content-type": "application/json", "x-ext": ext ? "1" : "0" }, body: JSON.stringify({ url: STRIPE_PAGE, text: "" }) });
  assert.equal((await post(false)).status, 403, "a browser tab is refused");
  const ok = await post();
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).posting.jobId, "greenhouse::8198280");
  await post();
  assert.equal((await post()).status, 429);
  const server_ = read("server.js");
  assert.match(server_, /scoreText: \(userId, job\) => scorePageTextForBase\(userId, job\),/);
  const fn = server_.slice(at(server_, "function scorePageTextForBase"), at(server_, "// ── generateResumeForApply"));
  assert.match(fn, /atsBasisForProfile\(userId, activeProfile\)/, "the same basis as the board and the approval screen");
  assert.match(fn, /scoreJobForBasis\(job, basis\.runtimeBasis\)/, "the same scorer");
  assert.doesNotMatch(fn, /storeAtsReport|INSERT|UPDATE/, "a page's score is never stored");
});

test("T3 · the extension asks on the press, binds what it finds, and shows the page's score with where it came from", async () => {
  const bg = read("extension/background.js");
  const ctx = bg.slice(at(bg, "async function popupContext"), at(bg, "async function previewActiveTab"));
  // ⭐ BINDING FIRST: the press identifies (and binds) the page before anything else — the page lookup is the identify's
  assert.match(ctx, /const identity = url \? await identifyAndBind\(tab, \{ serverUrl: RESUME_MASTER_URL \}\)/);
  assert.match(ctx, /const page = identity\?\.lookup/);
  assert.match(ctx, /board\.posting = \{ \.\.\.board\.posting, known: true, jobId: p\.jobId/, "a page draft names becomes the popup's posting");
  assert.match(read("extension/companion.js"), /'ATS scored from this page'/);
  const panel = read("extension/resumePanel.js");
  assert.match(panel, /const id = await identifyAndBind\(tab, \{ serverUrl: url\(\) \}\)/, "the panel's Read identifies and binds first too");
  assert.match(read("extension/identify.js"), /lookup\(serverUrl, \{ url, frameUrls, text: read\.text \}\)/, "the text goes only when the address and frame named nothing");
  const { resumePanelModel } = await import("../extension/resumePanel.js");
  const m = resumePanelModel({ report: { state: "ready", score: 41, band: "moderate", matched: ["python"], missing: ["rust"], basis: "page" } });
  assert.equal(m.state, "nojob");
  assert.equal(m.report.note, "Your base résumé, scored against this page.");
  assert.equal(m.report.action, null, "no board report to open for a job draft does not hold");
  assert.equal(resumePanelModel({ report: { state: "ready", score: 66, band: "strong" } }).report, null, "an unlinked tab never shows a board report");
});

// ── T6 · the cause, and the details view ────────────────────────────────────────────────────────────────────────────
test("T6 · causeOf names the stage and the code — never a message", () => {
  const e = Object.assign(new Error("400 {\"error\":{\"message\":\"Your credit balance is too low to access the Anthropic API\"}}"), { code: "upstream_model_failure" });
  assert.equal(causeOf(e), "tools_service:upstream_model_failure");
  assert.equal(causeOf(Object.assign(new Error("x"), { code: "tools_service_unreachable" })), "tools_service:tools_service_unreachable");
  assert.equal(causeOf(Object.assign(new Error("gone"), { code: "job_vanished" })), "job:job_vanished");
  assert.equal(causeOf(new TypeError("boom")), "server:typeerror");
  assert.equal(causeOf({ code: "Has Spaces $0.04" }), "server:error", "a code that is not a code is not stored");
  assert.deepEqual(causeView("tools_service:upstream_model_failure"), { stage: "tools_service", code: "upstream_model_failure" });
  assert.equal(causeView("free text with spaces"), null);
});

test("⭐ T6 regression · the owner's failure: the tools service refuses the model call → cause recorded, sentence generic, slot back", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content) VALUES (10,1,'base.txt',?)").run("Ada Example — engineer. ".repeat(10));
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,discovered_at,is_active) VALUES
    ('greenhouse::8198280','Software Engineer, Backend','Stripe','San Francisco, CA',?,'t','h',unixepoch(),1)`).run(STRIPE_BOARD);
  const service = createExtensionResumeService({ db, renderPdf: async () => Buffer.from("%PDF"), defer: (fn) => setImmediate(fn), log: { error() {}, warn() {} },
    generate: async () => { throw Object.assign(new Error("400 {\"type\":\"error\",\"error\":{\"message\":\"Your credit balance is too low to access the Anthropic API.\"}}"), { name: "ToolsServiceError", code: "upstream_model_failure", status: 400, permanent: true }); } });
  const started = service.start(1, { jobId: "greenhouse::8198280" });
  const id = started.body.id;
  let v;
  for (let i = 0; i < 200; i++) { v = service.get(1, id).body; if (v.status === "failed") break; await new Promise(z => setTimeout(z, 5)); }
  const row = db.prepare("SELECT status, error_code, cause, refund_reason FROM extension_resume_generations WHERE id=?").get(id);
  assert.deepEqual(row, { status: "failed", error_code: "unavailable", cause: "tools_service:upstream_model_failure", refund_reason: "server failure" });
  assert.equal(v.error.message, USER_ERRORS.unavailable.message, "the user's sentence stays the generic one");
  assert.deepEqual(v.cause, { stage: "tools_service", code: "upstream_model_failure" }, "the code is in the view, for Show details");
  assert.doesNotMatch(JSON.stringify(v), /credit|balance|anthropic|\$/i, "no money or provider words reach the extension");
  assert.equal(v.slot.refunded, true);
});

test("T6 · migration 167 is additive and byte-identical in both runners", () => {
  const raw = (p) => fs.readFileSync(p, "utf8");
  const block = (s, id) => { const i = at(s, `      id: "${id}"`); return s.slice(lastAt(s, "    {", i), at(s, "\n    },", i)); };
  const id = "167_extension_resume_cause";
  assert.equal(block(raw("server.js"), id), block(raw("scripts/migrations.js"), id));
  assert.match(block(raw("server.js"), id), /ALTER TABLE extension_resume_generations ADD COLUMN cause TEXT;/);
  assert.doesNotMatch(block(raw("server.js"), id), /\bDROP\b|DELETE FROM|UPDATE \w+ SET/i);
});

test("⛔ T6 · Show details: off by default, the Options page only, named fields — no token, no query, no answer value", async () => {
  const d = await import("../extension/diagnostics.js");
  assert.equal(d.pathShape("/api/extension/resume/erg_0123abcd/pdf?x=1"), "/api/extension/resume/:id/pdf");
  assert.equal(d.pathShape("/api/extension/job/greenhouse%3A%3A8198280"), "/api/extension/job/:id");
  d.noteAnswer("/api/extension/resume", 502, { error: "unavailable", message: "Your credit balance is too low", token: "secret" });
  d.noteAnswer("/api/import/context", 200);
  d.notePageRead(7, { url: "https://stripe.com/careers/listing/x?gh_jid=8198280&email=ada@example.test#top", known: true, jobId: "greenhouse::8198280", how: "ats_id" });
  const out = d.detailsOf({ hasToken: true, identity: { authenticated: true, username: "ada" }, tabs: [{ id: 7,
    binding: { jobId: "greenhouse::8198280", via: "recognised", boundAt: 1, origin: "https://stripe.com" },
    progress: { jobKey: "k", read: { at: 1 }, filled: { n: 3 }, answers: { secret: "yes" } },
    resume: { id: "erg_0123abcd", status: "failed" }, view: { status: "failed", error: { code: "unavailable" }, cause: { stage: "tools_service", code: "upstream_model_failure" }, slot: { refunded: true } } }] });
  const s = JSON.stringify(out);
  assert.equal(out.tabs[0].page, "stripe.com/careers/listing/x", "host and path only");
  assert.deepEqual(out.tabs[0].progress.steps, ["read", "filled"], "which steps — never their values");
  assert.deepEqual(out.tabs[0].generation.cause, { stage: "tools_service", code: "upstream_model_failure" });
  assert.equal(out.account.tokenHeld, true);
  for (const leak of [/secret/, /ada@example/, /gh_jid/, /credit balance/, /"username"/]) assert.doesNotMatch(s, leak);
  assert.ok(out.answers.some(a => a.path === "/api/extension/resume" && a.status === 502 && a.code === "unavailable"));

  const html = read("extension/options.html");
  assert.match(html, /<input type="checkbox" id="details-show">/, "unticked by default");
  assert.match(html, /<script type="module" src="options-details\.js"><\/script>/);
  const page = read("extension/options-details.js");
  assert.doesNotMatch(page, /innerHTML|chrome\.storage/, "shown as text, remembered nowhere");
  const bg = read("extension/background.js");
  assert.match(bg, /if \(message\.type === 'DIAGNOSTICS'\) \{\s*if \(sender\?\.id !== chrome\.runtime\.id \|\| !String\(sender\?\.url \|\| ''\)\.startsWith\(chrome\.runtime\.getURL\('options\.html'\)\)\)/,
    "only the extension's own Options page may ask");
  assert.doesNotMatch(read("extension/diagnostics.js"), /chrome\.storage\.\w+\.(get|set|remove)\(/, "memory only — the policy's count of stored things is unchanged");
  assert.match(read("extension/auth.js"), /try \{\s*if \(res\.ok\) noteAnswer\(path, res\.status\);/, "the record never fails a request");
});
