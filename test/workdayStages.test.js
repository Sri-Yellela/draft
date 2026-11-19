// EXTENSION · ONE JOB ACROSS WORKDAY'S STAGES (owner, 10-12, the unpacked v1.5.1 on Zoom's Workday posting).
// "The same job is not recognised before and after creating an account, or when the page moves to the next stage"
// · "Autofill says draft doesn't know this job while the popup says it was already on the board" · "The Copy sheet
// lists only 4 answers" · "it is drawn in the popup, which closes … and has no way to close" · "Captured today shows 0".
// Each guard red when its line is removed. Real routes on the full schema; a synthetic user; nothing reaches Zoom.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { workdayKeyOf, pageKeyOf, recordPageKey } from "../services/jobPageKey.js";
import { resolvePageJob, userHasJob, copySheetRows } from "../services/manualHandoff.js";
import { pageMatchesPacket } from "../services/applyOrigins.js";
import { renderCopySheetPanel } from "../extension/copy-sheet-panel.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";
import { D191_HOSTS, D191_BOARD_HOSTS, D191_CONTENT_SCRIPTS } from "../test-support/d191Manifest.mjs";   // ⭐ D191: the boards at install (owner 11-18)

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const T = "https://zoom.wd5.myworkdayjobs.com";
const OWNER_URL = `${T}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
const POSTING = `${T}/Zoom/job/Remote--(US)/Software-Engineer_R19749-1`;
const STAGES = [
  POSTING, `${POSTING}/apply`, `${POSTING}/apply/applyManually`, `${POSTING}/apply/useMyLastApplication`,
  `${T}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1`, `${POSTING}?source=linkedin`, `${POSTING}/apply?source=linkedin`,
  `${T}/en-US/Zoom/job/Remote--%28US%29/Software-Engineer_R19749-1/apply/useMyLastApplication?source=linkedin`, OWNER_URL,
];
// A Zoom page that names no requisition — the job board's own home (NOT a sign-in URL: those are added only from
// what the owner pastes). It stands in for "a stage whose address carries no requisition id".
const NO_REQ = `${T}/en-US/Zoom`;

test("⛔ the owner's exact URL resolves to the same key as the plain posting URL — and every stage does", () => {
  const k = workdayKeyOf(OWNER_URL);
  assert.equal(k.key, "workday|zoom|zoom|R19749");
  assert.equal(k.rev, 1, "the repost suffix is kept as rev, not in the key");
  assert.equal(k.stage, "applyManually");
  assert.equal(k.locale, "en-US");
  assert.equal(k.location, "Remote (US)", "brackets and the double hyphen decoded");
  assert.equal(k.title, "Software Engineer");
  assert.equal(k.canonicalUrl, POSTING, "stage, query and locale stripped");
  for (const u of STAGES) {
    assert.equal(pageKeyOf(u)?.key, k.key, u);
    assert.equal(pageKeyOf(u)?.canonicalUrl, POSTING, `one spelling: ${u}`);
  }
  assert.equal(pageKeyOf(`${T}/Zoom/job/Remote--(US)/Software-Engineer_R19749-2`)?.key, k.key, "-2 is the same requisition");
  assert.notEqual(pageKeyOf(`${T}/Zoom/job/Remote--(US)/Software-Engineer_R20000`)?.key, k.key, "another requisition is another job");
  assert.equal(pageKeyOf(NO_REQ), null, "no requisition, no key — the tab binding names that page's job");
  assert.equal(pageKeyOf("https://boards.greenhouse.io/zoom/jobs/123"), null);
});

// ── the server, full schema, real routes ──────────────────────────────────────────────────────────
const PAYLOAD = {
  field_map: { first_name: "Ada", last_name: "Example", email: "ada@example.test", phone: "555-0100" },
  handler_map: {}, custom_answers: { "Why do you want to work at Zoom?": "Video for everyone.", "Are you 18 or older?": "Yes" },
};
function mount() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO'), (2,'blake','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  // the board's copy of the job came from ANOTHER ATS — the owner's case
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('gh-zoom-1','Software Engineer','Zoom','Remote (US)','https://boards.greenhouse.io/zoom/jobs/9001','https://boards.greenhouse.io/zoom/jobs/9001','t','h1',unixepoch()-86400),
           ('gh-zoom-2','Product Manager','Zoom','Remote (US)','https://boards.greenhouse.io/zoom/jobs/9002','https://boards.greenhouse.io/zoom/jobs/9002','t','h2',unixepoch()-86400)`).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.get("x-user") || 1), planTier: "PRO" }; next(); });
  applyRoutes(app, db, (q, r, n) => n(), () => PAYLOAD, async () => ({ error: "no model in tests" }),
    async () => Buffer.from("%PDF-1.4 synthetic"), async () => ({}), () => null, {});
  app.use("/api/import", createImportJobRouter(db));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, user = 1) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-user": String(user) }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  return { db, base, post, stop: () => { server.close(); db.close(); } };
}
// what a capture leaves for the user: a job_captures row with the CANONICAL posting URL (importJob strips the stage)
const captured = (db, user, jobId, url) => db.prepare(`INSERT INTO job_captures (user_id, job_id, url, origin, action) VALUES (?, ?, ?, 'capture', 'attached')`).run(user, jobId, url);

test("⛔ every stage resolves to the board job its key was captured into — even when the board's copy is another ATS's", (t) => {
  const { db, stop } = mount(); t.after(stop);
  for (const u of STAGES) assert.equal(resolvePageJob(db, 1, u).job, null, "before any capture, draft does not know it");
  recordPageKey(db, OWNER_URL, "gh-zoom-1");
  for (const u of STAGES) {
    const p = resolvePageJob(db, 1, u);
    assert.equal(p.job?.jobId, "gh-zoom-1", u);
    assert.equal(p.how, "page_key");
  }
  assert.equal(resolvePageJob(db, 1, `${T}/Zoom/job/Remote--(US)/Software-Engineer_R20000/apply`).job, null, "another requisition is not this job");
  assert.equal(resolvePageJob(db, 1, NO_REQ).job, null);
});

test("⛔ a capture makes the job YOURS — fill and prepare no longer say 'capture it first' or 'not on your board'", async (t) => {
  const { db, post, stop } = mount(); t.after(stop);
  recordPageKey(db, OWNER_URL, "gh-zoom-1");
  let m = await post("/api/apply/handoff/match", { url: OWNER_URL });
  assert.equal(m.body.state, "not_on_board", "known to draft, not yet yours");
  captured(db, 1, "gh-zoom-1", POSTING);
  assert.equal(userHasJob(db, 1, "gh-zoom-1"), true, "a capture is in your imports");
  for (const u of STAGES) {
    m = await post("/api/apply/handoff/match", { url: u });
    assert.equal(m.body.state, "prepare", u);
    assert.equal(m.body.job?.jobId, "gh-zoom-1");
    assert.doesNotMatch(m.body.message, /capture it first/);
  }
  // prepare from a stage: the packet's addresses include the tenant the USER captured from — and only this requisition
  const p = await post("/api/apply/prepare", { url: `${POSTING}/apply/applyManually` });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.fillsHere, true, "the packet fills on the Workday stage page");
  assert.ok(p.body.origins.includes(T), p.body.origins.join(","));
  const row = db.prepare("SELECT * FROM apply_gate_packets WHERE id = ?").get(p.body.packetId);
  assert.ok(row);
  assert.equal(pageMatchesPacket({ url: `${T}/Zoom/job/Remote--(US)/Product-Manager_R20000/apply`, origins: [T], pageKeys: ["workday|zoom|zoom|R19749"] }).reason,
    "other_job", "another Zoom requisition never receives this packet");
  // ⛔ the tenant joins ONLY through the user's own capture: another user's packet for the job does not gain it
  assert.equal(userHasJob(db, 2, "gh-zoom-1"), false);
});

test("⛔ the TAB BINDING names the job where the address cannot — honoured only for a job on the user's board", async (t) => {
  const { db, post, stop } = mount(); t.after(stop);
  let m = await post("/api/apply/handoff/match", { url: NO_REQ });
  assert.equal(m.body.state, "unknown", "no key, no binding: draft truly does not know it");
  // D99: a posting live on the board is on every user's board — the hint names it before any capture
  m = await post("/api/apply/handoff/match", { url: NO_REQ, boundJobId: "gh-zoom-1" });
  assert.equal(m.body.job?.jobId, "gh-zoom-1", "a live board job is on your board");
  assert.equal(m.body.how, "binding");
  // retired, it is on a board only through a capture
  db.prepare("UPDATE scraped_jobs SET is_active = 0 WHERE job_id = 'gh-zoom-1'").run();
  m = await post("/api/apply/handoff/match", { url: NO_REQ, boundJobId: "gh-zoom-1" });
  assert.equal(m.body.state, "unknown", "a binding to a retired job that is not yours is ignored");
  captured(db, 1, "gh-zoom-1", POSTING);
  m = await post("/api/apply/handoff/match", { url: NO_REQ, boundJobId: "gh-zoom-1" });
  assert.equal(m.body.job?.jobId, "gh-zoom-1");
  assert.equal(m.body.how, "binding");
  assert.equal(m.body.state, "prepare");
  m = await post("/api/apply/handoff/match", { url: NO_REQ, boundJobId: "gh-zoom-1" }, 2);
  assert.equal(m.body.state, "unknown", "another user's binding hint cannot reach this user's job");
  // the same page, prepare and the Copy sheet honour it too
  const p = await post("/api/apply/prepare", { url: NO_REQ, boundJobId: "gh-zoom-1" });
  assert.equal(p.status, 200);
  const s = await post("/api/apply/copy-sheet", { url: NO_REQ, boundJobId: "gh-zoom-1" });
  assert.equal(s.body.source, "packet", "the PREPARED answers, not the profile's");
  assert.equal(s.body.job?.jobId, "gh-zoom-1");
  assert.ok(s.body.rows.some(r => r.label === "Why do you want to work at Zoom?"), "saved answers are on the sheet");
  // a fill releases (consumes) the packet — the sheet still shows the answers prepared for this application
  db.prepare("UPDATE apply_gate_packets SET consumed_at = unixepoch() WHERE user_id = 1").run();
  const after = await post("/api/apply/copy-sheet", { url: NO_REQ, boundJobId: "gh-zoom-1" });
  assert.equal(after.body.source, "packet", "after the fill, still the PREPARED answers (the walk found this)");
});

test("⛔ the walk's two findings: the canonical posting keeps the page's scheme; the extractor reads Workday's own header", () => {
  assert.equal(pageKeyOf("http://zoom.wd5.myworkdayjobs.com/Zoom/job/Software-Engineer_R19749-1/apply").canonicalUrl, "http://zoom.wd5.myworkdayjobs.com/Zoom/job/Software-Engineer_R19749-1",
    "an address the page is on — a forced https made the packet refuse the stage page");
  assert.match(read("extension/extractor.js"), /const header = firstText\(\['\[data-automation-id="jobPostingHeader"\]'\]\);\s*if \(header && !ld\?\.title\) title = header;/);
});

test("⛔ (owner 10-13) found on LinkedIn, applied on Workday: the Workday page is the job YOU captured on LinkedIn — and one capture there joins it", async (t) => {
  const { db, post, stop } = mount(); t.after(stop);
  // the owner's LinkedIn page: …/jobs/search-results/?currentJobId=4478302778 — captured there, stored under LinkedIn's address
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('li-4478302778','Software Engineer','Zoom','United States (Remote)','https://www.linkedin.com/jobs/view/4478302778','https://www.linkedin.com/jobs/view/4478302778','t','h9',unixepoch()-3600)`).run();
  captured(db, 1, "li-4478302778", "https://www.linkedin.com/jobs/view/4478302778");
  const p = resolvePageJob(db, 1, OWNER_URL);
  assert.equal(p.job?.jobId, "li-4478302778", "the Workday stage is the job the user captured on LinkedIn");
  assert.equal(p.how, "title_company");
  assert.equal(resolvePageJob(db, 2, OWNER_URL).job, null, "never another user's capture");
  const m = await post("/api/apply/handoff/match", { url: OWNER_URL });
  assert.equal(m.body.state, "prepare", "Fill on Workday offers Prepare — not 'capture it first'");
  // one capture on the Workday page JOINS the LinkedIn job (location wording differs, so a fingerprint would not)
  const text = "Title: Software Engineer\nCompany: Zoom\nLocation: Remote (US)\n\nBuild Zoom's next video platform in TypeScript and Go. You will design services, review code and ship weekly. This role is remote within the United States.";
  const cap = await post("/api/import/job", { url: OWNER_URL, text });
  assert.equal(cap.body.capture?.jobId, "li-4478302778", "joined, not a second job");
  assert.equal(db.prepare("SELECT job_id FROM job_page_keys WHERE page_key = 'workday|zoom|zoom|R19749'").pluck().get(), "li-4478302778", "the key now names it");
  const prep = await post("/api/apply/prepare", { url: OWNER_URL });
  assert.equal(prep.body.fillsHere, true, "and the packet fills on the Workday page, through the user's own capture there");
  // two captured jobs with that title at that company is a question, not an answer
  const { db: db2, stop: stop2 } = mount(); t.after(stop2);
  for (const id of ["li-a", "li-b"]) {
    db2.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,search_query,_hash,discovered_at) VALUES (?, 'Software Engineer','Zoom','Remote',?, 't', ?, unixepoch())`).run(id, `https://www.linkedin.com/jobs/view/${id}`, `h-${id}`);
    captured(db2, 1, id, `https://www.linkedin.com/jobs/view/${id}`);
  }
  assert.equal(resolvePageJob(db2, 1, OWNER_URL).job, null, "ambiguous → no guess");
});

test("⛔ the Copy sheet carries everything the packet does — not only the canonical fields", () => {
  const sheet = copySheetRows({
    answers: [{ field: "First name", name: "first_name", value: "Ada" }, { field: "Work authorization", name: "work_auth", value: "Yes", eligibility: true }],
    savedAnswers: [{ question: "Why Zoom?", answer: "Video.", eligibility: false, optIn: false }, { question: "Text me offers?", answer: "No", optIn: true }],
    workedHere: { company: "Zoom", answer: "No" },
    entries: { work: [{ title: "Engineer", company: "Contoso", from: { year: 2021 }, current: true }], education: [{ degree: "BS", field: "CS", school: "State", to: { year: 2020 } }] },
    unresolved: [{ field: "Salary expectation", name: "salary" }],
  });
  const labels = sheet.rows.map(r => r.label);
  assert.equal(labels[0], "Work authorization", "eligibility first");
  for (const l of ["First name", "Why Zoom?", "Worked at Zoom before?", "Work 1", "Education 1"]) assert.ok(labels.includes(l), l);
  assert.ok(!labels.includes("Text me offers?"), "an opt-in is never put on the sheet");
  assert.equal(sheet.unanswered.length, 1);
});

test("⛔ capture from a stage stores the POSTING, a second capture is idempotent and says so, and 'Captured today' counts one", async (t) => {
  const { db, post, base, stop } = mount(); t.after(stop);
  // the text the extension's extractor sends (extension/extractor.js): labelled lines, a blank line, the posting
  const text = "Title: Software Engineer\nCompany: Zoom\nLocation: Remote (United States)\nWork Type: Remote\n\n"
    + "About the role. Build Zoom's next video platform in TypeScript and Go. You will design services, review code and ship weekly. "
    + "Requirements: 3+ years building distributed systems. This role is remote within the United States.";
  const first = await post("/api/import/job", { url: OWNER_URL, text });
  assert.equal(first.status, 200, JSON.stringify(first.body).slice(0, 400));
  const jobId = first.body.capture.jobId;
  assert.equal(db.prepare("SELECT url FROM job_captures WHERE user_id = 1 ORDER BY id DESC LIMIT 1").pluck().get(), POSTING, "the stage URL is stored as its posting");
  assert.equal(db.prepare("SELECT job_id FROM job_page_keys WHERE page_key = 'workday|zoom|zoom|R19749'").pluck().get(), jobId, "the key is recorded");
  const again = await post("/api/import/job", { url: `${POSTING}/apply/useMyLastApplication?source=linkedin`, text });
  assert.equal(again.body.capture.jobId, jobId, "the same job from another stage");
  assert.equal(again.body.capture.alreadyCaptured, true);
  assert.match(again.body.capture.message, /^Already captured — .* is on your board and in your imports\.$/);
  const today = await fetch(`${base}/api/import/today`, { headers: { "x-user": "1" } }).then(r => r.json());
  assert.equal(today.today, 1, "two captures of one job count once");
  // the popup's context knows it on every stage, and says it was captured
  const ctx = await post("/api/import/context", { url: OWNER_URL });
  assert.equal(ctx.body.posting.jobId, jobId);
  assert.equal(ctx.body.posting.captured, true);
  assert.equal(ctx.body.ats?.requisition, "R19749");
});

test("⛔ one wording after a capture that matched a board job", () => {
  const src = read("services/jobs/captureOutcome.js");
  assert.match(src, /`\$\{label\} is on your board and in your imports\.`/);
  assert.doesNotMatch(src, /matched a job draft already had/);
});

// ── the extension ─────────────────────────────────────────────────────────────────────────────────
function chromeStub() {
  const store = new Map();
  globalThis.chrome = { storage: { session: {
    async get(k) { return store.has(k) ? { [k]: store.get(k) } : {}; },
    async set(o) { for (const [k, v] of Object.entries(o)) store.set(k, v); },
    async remove(k) { store.delete(k); },
  } } };
  return store;
}

test("⛔ the binding: set by a capture, used first, valid only on its origin, cleared on tab close, replaced by another job", async () => {
  const store = chromeStub();
  const { bindTab, bindingForTab, clearBinding, bindingLine } = await import("../extension/tabBinding.js");
  const tab = { id: 7, url: OWNER_URL };
  await bindTab(tab, { jobId: "gh-zoom-1", title: "Software Engineer", company: "Zoom", via: "capture" });
  assert.equal((await bindingForTab({ id: 7, url: NO_REQ }))?.jobId, "gh-zoom-1", "a later page on the same origin keeps it");
  assert.equal(await bindingForTab({ id: 7, url: "https://www.linkedin.com/jobs/view/1" }), null, "another origin does not");
  assert.equal(await bindingForTab({ id: 8, url: NO_REQ }), null, "never shared across tabs");
  assert.match(bindingLine(await bindingForTab(tab)), /^Using Software Engineer at Zoom, captured \d{2}:\d{2}$/);
  await bindTab(tab, { jobId: "gh-zoom-2", title: "Product Manager", company: "Zoom", via: "recognised" });
  assert.equal((await bindingForTab(tab)).jobId, "gh-zoom-2", "a different recognised posting replaces it");
  await clearBinding(7);
  assert.equal(store.size, 0);
  const bg = read("extension/background.js");
  assert.match(bg, /chrome\.tabs\.onRemoved\.addListener\(\(tabId\) => \{[\s\S]{0,160}void clearBinding\(tabId\);/, "cleared when the tab closes");
  assert.match(bg, /if \(result\?\.success && result\.jobId\) \{\s*await bindTab\(tab, \{ jobId: result\.jobId/, "set by a capture");
  // ⭐ BINDING FIRST (owner 10-15): a recognised posting binds in the ONE identify step every press runs first
  assert.match(read("extension/identify.js"), /const binding = await bindTab\(tab, \{ jobId: out\.job\.jobId, title: out\.job\.title, company: out\.job\.company, via: 'recognised'/, "set by a recognised posting");
  assert.match(bg, /const identity = url \? await identifyAndBind\(tab/, "…which Read runs first");
  const gh = read("extension/gated-handoff.js");
  for (const route of ["/api/apply/handoff/match", "/api/apply/prepare", "/api/apply/copy-sheet", "/api/apply/handoff/submitted"]) {
    const i = gh.indexOf(`'${route}'`);
    assert.ok(i > 0, route);
    assert.match(gh.slice(i, i + 260), /boundJobId: bound\?\.jobId \?\? null/, `${route} sends the binding`);
  }
  // ⛔ never written to the server as such: only the job id rides along, as a hint
  assert.doesNotMatch(gh + bg, /boundAt[^\n]*JSON\.stringify|JSON\.stringify\([^)]*binding/, "the binding record itself is never sent");
  delete globalThis.chrome;
});

test("⛔ no new permission — no tabs, no webNavigation; the manifest's list is pinned", () => {
  const m = JSON.parse(read("extension/manifest.json"));
  assert.deepEqual([...m.permissions].sort(), ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"]);
  assert.deepEqual(m.host_permissions, [...D191_HOSTS]);
  assert.ok(!m.permissions.includes("tabs") && !m.permissions.includes("webNavigation"));
});

test("⛔ a capture says so on its page, the Copy sheet opens in the page, and Unlink is the ATS tab's (⭐ T31: the retired popup's lines)", () => {
  // the popup's "Captured ✓ — <job>" and its counts went with it; the capture's own toast says the server's words, on the
  // page, as it happens — and the press says a job already yours through the intent line (test/t31ToolbarPress.test.js)
  const bg = read("extension/background.js");
  assert.match(bg, /func: showCaptureToast, args: \[result\.message, !!result\.success, toastTheme\(\)\]/);
  // the Copy sheet is the dock's tab, drawn in the page
  assert.match(bg, /async function copySheetPanel\(tab\) \{[\s\S]{0,200}drawInDock\(tab\.id, renderCopySheetPanel,/);
  assert.match(read("extension/resumePanel.js"), /ibtn\(\{ role: 'unbind', label: `Unlink this page from \$\{m\.job\}`, icon: 'unlink' \}\)/);
  assert.match(bg, /unbind: async \(tab\) => \{ await clearBinding\(tab\.id\);/);
});

// ── the Copy sheet panel in a REAL Chrome, on the Workday-shaped fixture ─────────────────────────────
const { resolveBrowserExecutable } = await import("../services/browserLauncher.js");
let browserPath = null;
try { browserPath = (await resolveBrowserExecutable())?.path || null; } catch { browserPath = null; }
const NO_CHROME = browserPath && fs.existsSync(browserPath) ? false : "no Chrome on this machine (services/browserLauncher.js found none)";
const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });

test("⛔ the Copy sheet panel stays through a page click and a field focus, Closes, Esc closes, minimises, docks — both themes, no capsules", { skip: NO_CHROME, timeout: 120000 }, async (t) => {
  const port = await freePort();
  const ats = spawn(process.execPath, ["scripts/fakeAts.js"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  t.after(() => ats.kill());
  const stage = `http://localhost:${port}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(stage)).ok) break; } catch {} await new Promise(r => setTimeout(r, 50)); }
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const sheet = { source: "packet", job: { title: "Software Engineer", company: "Zoom" }, dock: "right",
    rows: [{ label: "Work authorization", value: "Yes", eligibility: true }, { label: "First name", value: "Ada" }, { label: "Why Zoom?", value: "Video." }],
    unanswered: [{ label: "Salary expectation" }] };
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    await page.goto(stage);
    // ⭐ T17: the Copy sheet is the dock's tab — dock.js first, as the service worker's drawInDock injects it
    await page.evaluate(fs.readFileSync("extension/dock.js", "utf8"));
    await page.evaluate(`window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { cb && cb(null); } } };
      (${renderCopySheetPanel.toString()})(${JSON.stringify(sheet)}, ${JSON.stringify({ light: C_LIGHT, dark: C_DARK })})`);
    const open = () => page.evaluate(() => !!document.getElementById("rm-copy-sheet-panel"));
    assert.equal(await open(), true, `${scheme}: drawn`);
    // the page's own work goes on: a click into a field and typing — the panel stays, the field keeps what was typed
    await page.click('input[name="firstName"]');
    await page.keyboard.type("Typed by hand");
    // Read BEFORE Save and Continue: since J2 the step really changes (Workday re-renders the step), so My
    // Information's input is gone afterwards — what the field held is checked while it is still on the page.
    assert.equal(await page.$eval('input[name="firstName"]', el => el.value), "Typed by hand", "the panel never writes a field");
    await page.click("#next-step");
    assert.equal(await open(), true, `${scheme}: survives a field focus and a page click`);
    assert.equal(await page.evaluate(() => window.__wd.step()), "myExperience", "the click was a real step change, the URL unchanged");
    // ⭐ T17: on this narrow page the dock steps out of the way of the field being typed in — to the slim bar when no
    // side is clear of it. The person opens it again; the sheet is as it was.
    await page.evaluate(() => { if (document.getElementById("rm-draft-dock").dataset.collapsed === "true") document.getElementById("rm-draft-dock").shadowRoot.querySelector('[data-role="expand"]').click(); });
    const facts = await page.evaluate(() => {
      const root = document.getElementById("rm-copy-sheet-panel").shadowRoot;
      const p = root.querySelector(".p");
      const radii = [...root.querySelectorAll("button, .p, .note")].map(el => parseFloat(getComputedStyle(el).borderTopLeftRadius));
      return { rows: root.querySelectorAll("li").length, attest: root.querySelector("li.elig .k").textContent, sub: root.querySelector(".t small").textContent,
        // ⭐ T26: the sheet paints no surface of its own (the dock's frame is the one); its controls are painted from the tokens
        unanswered: root.querySelector("[data-unanswered]")?.dataset.unanswered, own: getComputedStyle(p).backgroundColor,
        bg: getComputedStyle(root.querySelector("[data-copy]")).backgroundColor, maxRadius: Math.max(...radii) };
    });
    assert.equal(facts.rows, 3);
    assert.match(facts.attest, /you are attesting to this/);
    assert.equal(facts.sub, "Software Engineer at Zoom · prepared answers", "says which job and the source");
    assert.equal(facts.unanswered, "1");
    assert.ok(facts.maxRadius <= 10, `D60: no capsule (max radius ${facts.maxRadius}px)`);
    const want = scheme === "dark" ? C_DARK.SURFACE_SOLID : C_LIGHT.SURFACE_SOLID;
    const hex = (rgb) => "#" + rgb.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    assert.equal(hex(facts.bg), want.toUpperCase(), `${scheme}: painted from the ${scheme} tokens`);
    assert.equal(facts.own, "rgba(0, 0, 0, 0)", `${scheme}: no surface of its own`);
    // Copy says so (or, with no clipboard in headless, selects the value)
    await page.evaluate(() => document.getElementById("rm-copy-sheet-panel").shadowRoot.querySelectorAll("[data-copy]")[1].click());
    await new Promise(r => setTimeout(r, 150));
    // ⭐ T26: Copy is an icon — what it says is its name
    const label = await page.evaluate(() => document.getElementById("rm-copy-sheet-panel").shadowRoot.querySelectorAll("[data-copy]")[1].getAttribute("aria-label"));
    assert.match(label, /^(Copied|Select and copy)$/);
    // ⭐ T17: Collapse (the old Minimise) and the side are the DOCK's — one window for every view
    const dock = (sel) => page.evaluate((s) => document.getElementById("rm-draft-dock").shadowRoot.querySelector(s).click(), sel);
    await dock('[data-role="collapse"]');
    assert.equal(await page.evaluate(() => document.getElementById("rm-draft-dock").dataset.collapsed), "true");
    assert.equal(await page.evaluate(() => document.getElementById("rm-copy-sheet-panel").getBoundingClientRect().height), 0, "collapsed: the sheet is out of the way");
    await dock('[data-role="expand"]');
    // the side button sends it to the OTHER side (it may already have stepped left, out of the field's way)
    const sideBefore = await page.evaluate(() => document.getElementById("rm-draft-dock").dataset.side);
    await dock('[data-role="dock"]');
    const sideAfter = await page.evaluate(() => document.getElementById("rm-draft-dock").dataset.side);
    assert.equal(sideAfter, sideBefore === "left" ? "right" : "left");
    const r = await page.evaluate(() => { const b = document.getElementById("rm-draft-dock").getBoundingClientRect(); return { l: b.left, r: innerWidth - b.right }; });
    assert.equal(sideAfter === "left" ? r.l : Math.round(r.r) <= 8 + 16, sideAfter === "left" ? 8 : true, `snapped to the ${sideAfter} edge: ${JSON.stringify(r)}`);
    // Esc closes it
    await page.keyboard.press("Escape");
    assert.equal(await open(), false, `${scheme}: Esc closes`);
    // and the Close button does
    await page.evaluate(`(${renderCopySheetPanel.toString()})(${JSON.stringify(sheet)}, ${JSON.stringify({ light: C_LIGHT, dark: C_DARK })})`);
    await dock('[aria-label="Close the panel"]');
    assert.equal(await open(), false, `${scheme}: Close closes`);
    await page.close();
  }
});
