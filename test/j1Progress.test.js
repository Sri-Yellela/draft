// J1 · D96 §2–§3 — ONE JOB, A BINDING THAT FOLLOWS THE TAB, AND PROGRESS THE POPUP REMEMBERS.
//
// Owner, 10-13 (Zoom's Workday, the unpacked v1.5.2): "nothing persists — close the popup or reload and it is zero"
// · "fill says capture it first while the popup says it is already in the imports". What v1.5.2 built (the server's
// one key, services/jobPageKey.js; the tab binding, extension/tabBinding.js) is pinned in test/workdayStages.test.js;
// this file pins what J1 adds:
//   · extension/progress.js — one record per job in chrome.storage.local: no answer value, 30 days, the last five
//     "In progress", cleared on Disconnect, on sign-out and when another account connects;
//   · the writes where the events happen — capture, "Read this page", Prepare, the fill, the review panel, "I submitted
//     it" — and the popup reading it on open with NO page read and NO message (D23);
//   · the binding is the only thing sent (as boundJobId), and a fill on a bound tab never says "capture it first";
//   · the server's /api/import/context names the page's key and canonical posting, so the extension parses no URL.
// Every guard here was seen red with its rule removed (the injections are listed in the J1 report). Synthetic people.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createImportJobRouter } from "../routes/importJob.js";
import applyRoutes from "../routes/apply.js";
import { recordPageKey } from "../services/jobPageKey.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const T = "https://zoom.wd5.myworkdayjobs.com";
const OWNER_URL = `${T}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
const POSTING = `${T}/Zoom/job/Remote--(US)/Software-Engineer_R19749-1`;
const DAY = 24 * 60 * 60 * 1000;

// ── chrome.*: both storage areas, and a record of everything that would leave the popup ─────────────
function chromeStub({ tabUrl = OWNER_URL, tabId = 7 } = {}) {
  const stores = { local: new Map(), session: new Map() };
  const area = (m) => ({
    async get(k) {
      if (k == null) return Object.fromEntries(m);
      const keys = [].concat(k);
      return Object.fromEntries(keys.filter(x => m.has(x)).map(x => [x, structuredClone(m.get(x))]));
    },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(k) { for (const x of [].concat(k)) m.delete(x); },
  });
  const out = { messages: [], injected: [], opened: [] };
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session) },
    runtime: { sendMessage: async (m) => { out.messages.push(m); return null; }, getURL: (p) => `chrome-extension://test/${p}` },
    tabs: { query: async () => [{ id: tabId, url: tabUrl }], create: (o) => out.opened.push(o.url) },
    scripting: { executeScript: async (x) => { out.injected.push(x); return [{ result: null }]; } },
  };
  return { stores, out };
}
// A fresh module instance is what a service-worker restart (or a browser restart) gives the extension.
let instance = 0;
const fresh = (p) => import(`../extension/${p}?i=${++instance}`);

// ── the record ──────────────────────────────────────────────────────────────────────────────────────

test("⛔ J1: a progress record holds NO answer value — whatever a caller hands it", async () => {
  const { stores } = chromeStub();
  const { progress, PROGRESS_KEY } = await fresh("progress.js");
  await progress.patch({ jobId: "gh-zoom-1" }, {
    title: "Software Engineer", company: "Zoom",
    filled: { n: 14, of: 18, needYou: 2, check: 3, values: ["Ada", "Example"], answers: { first_name: "Ada" } },
    read: { at: 1, stage: "applyManually", fieldCount: 18, html: "<input value='Ada'>" },
    answers: [{ field: "First Name*", value: "Ada" }], value: "Ada", text: "the page's text",
  });
  const raw = JSON.stringify(stores.local.get(PROGRESS_KEY));
  for (const leaked of ["Ada", "Example", "values", "answers", "html", "the page's text", "First Name"]) {
    assert.ok(!raw.includes(leaked), `the stored record carries ${leaked}: ${raw}`);
  }
  const r = await progress.get({ jobId: "gh-zoom-1" });
  assert.deepEqual(Object.keys(r).sort(), ["captured", "company", "filled", "jobId", "jobKey", "link", "postingUrl",
    // + "resume" by D98 §4 (lane J6): the on-page panel's generation for this job — { at, id, status, attached }, no value.
    // + "addresses" and "ats" by T14 (field report 10-14): where the job was seen (origin + path + identifier params) and
    //   its last score — so a new tab on a known address binds at once and the card comes back without a read.
    "prepared", "read", "resume", "reviewed", "submitted", "title", "updatedAt", "addresses", "ats"].sort(), "exactly the D96 §3 shape (+ D98's résumé step, + T14's addresses and ats)");
  assert.deepEqual(r.filled, { n: 14, of: 18, needYou: 2, check: 3 });
  assert.deepEqual(r.read, { at: 1, stage: "applyManually", fieldCount: 18 });
  delete globalThis.chrome;
});

test("⛔ J1: progress SURVIVES — the popup closing, the page reloading, a browser restart (session storage gone)", async () => {
  const { stores } = chromeStub();
  const a = await fresh("progress.js");
  await a.progress.patch({ jobId: "gh-zoom-1" }, { title: "Software Engineer", company: "Zoom", captured: { at: Date.now() } });
  stores.session.clear();                                  // a browser restart discards chrome.storage.session
  const b = await fresh("progress.js");                    // a new service worker / a new popup
  const r = await b.progress.get({ jobId: "gh-zoom-1" });
  assert.equal(r?.title, "Software Engineer", "the record outlived the restart");
  assert.equal((await b.progress.list()).length, 1);
  assert.ok(stores.local.has(b.PROGRESS_KEY), "it lives in chrome.storage.local");
  delete globalThis.chrome;
});

test("⛔ J1: kept 30 days from its last change — then gone from the popup and from storage", async () => {
  const { stores } = chromeStub();
  const { progress, PROGRESS_KEY, PROGRESS_RETENTION_MS } = await fresh("progress.js");
  assert.equal(PROGRESS_RETENTION_MS, 30 * DAY);
  const now = Date.now();
  stores.local.set(PROGRESS_KEY, { v: 1, owner: null, records: {
    old: { jobId: "old", title: "Old", updatedAt: now - 31 * DAY },
    kept: { jobId: "kept", title: "Kept", updatedAt: now - 29 * DAY },
  } });
  assert.equal(await progress.get({ jobId: "old" }), null, "a 31-day-old record is not shown");
  assert.equal((await progress.get({ jobId: "kept" }))?.title, "Kept");
  assert.deepEqual((await progress.list()).map(r => r.jobId), ["kept"]);
  await progress.patch({ jobId: "new" }, { title: "New" });
  assert.deepEqual(Object.keys(stores.local.get(PROGRESS_KEY).records).sort(), ["kept", "new"], "the next write drops it from storage");
  delete globalThis.chrome;
});

test("J1: 'In progress' is the last five jobs, newest first", async () => {
  chromeStub();
  const { progress, IN_PROGRESS_LIMIT } = await fresh("progress.js");
  assert.equal(IN_PROGRESS_LIMIT, 5);
  for (let i = 1; i <= 7; i++) {
    await progress.patch({ jobId: `j${i}` }, { title: `Job ${i}` });
    await new Promise(r => setTimeout(r, 2));
  }
  assert.deepEqual((await progress.list()).map(r => r.jobId), ["j7", "j6", "j5", "j4", "j3"]);
  delete globalThis.chrome;
});

test("⛔ J1: ONE record per job — found on LinkedIn, read on Workday, the page key joins the same record", async () => {
  chromeStub();
  const p = await fresh("progress.js");
  // the capture on LinkedIn: the job id only (the capture's answer names no Workday key)
  await p.noteCapture({ success: true, jobId: "gh-zoom-1", link: "https://jobsviadraft.com/jobs/gh-zoom-1" },
    { title: "Software Engineer", company: "Zoom" });
  // "Read this page" on the Workday stage: the server names the same job, the page's key and its canonical posting
  await p.noteContext({ posting: { known: true, jobId: "gh-zoom-1", title: "Software Engineer", company: "Zoom", captured: true, capturedAt: 1 },
    ats: { type: "workday", stage: "applyManually" },
    pageKey: { key: "workday|zoom|zoom|R19749", rev: 1, canonicalUrl: POSTING } }, null);
  const all = await p.progress.list();
  assert.equal(all.length, 1, "one job, one record");
  assert.equal(all[0].jobKey, "workday|zoom|zoom|R19749");
  assert.equal(all[0].postingUrl, POSTING, "the CANONICAL posting — stage, locale and ?source= stripped by the server");
  assert.notEqual(all[0].captured.at, 1, "the capture the extension saw is kept, not replaced by an older server time");
  assert.equal(all[0].read.stage, "applyManually");
  assert.equal((await p.progress.get({ jobKey: "workday|zoom|zoom|R19749" }))?.jobId, "gh-zoom-1", "findable by its key");
  // ⛔ the extension parses no ATS URL: the key and the canonical address come from the server's answer
  const src = read("extension/progress.js");
  assert.doesNotMatch(src, /myworkdayjobs|greenhouse\.io|lever\.co|ashbyhq|R\\d|requisition/i, "progress.js parses an ATS URL");
  assert.ok(!fs.existsSync("extension/jobKey.js"), "a second URL parser in the extension (A93: the same thing is built once)");
  delete globalThis.chrome;
});

test("⛔ J1: the words — Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you", async () => {
  const { progressLine, standWords, whenWords } = await fresh("progress.js");
  const t = (h, m) => new Date(2026, 9, 13, h, m).getTime();
  const now = t(12, 0);
  const r = { captured: { at: t(10, 41) }, read: { at: t(10, 42) }, prepared: { at: t(10, 43) },
    filled: { n: 14, of: 18, needYou: 2, check: 3 }, reviewed: { at: t(10, 50) }, submitted: { at: t(10, 55) } };
  assert.equal(progressLine(r, now), "Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you · 3 to check · Reviewed · Submitted");
  assert.equal(progressLine({ captured: { at: t(10, 41) }, filled: { n: 4, of: null, needYou: 1, check: 0 } }, now), "Captured 10:41 · Filled 4 · 1 needs you");
  assert.equal(whenWords(new Date(2026, 9, 11, 9, 5).getTime(), now), "11 Oct", "before today it is the day, not a time");
  assert.equal(standWords(r), "Submitted");
  assert.equal(standWords({ filled: { n: 14, of: 18 } }), "Filled 14 of 18");
  assert.equal(progressLine(null), "");
});

// ── cleared: Disconnect, sign-out, another account ───────────────────────────────────────────────────
function fetchStub(routes) {
  const seen = [];
  globalThis.fetch = async (url, init = {}) => {
    seen.push(String(url));
    for (const [re, answer] of routes) if (re.test(String(url))) return typeof answer === "function" ? answer() : answer;
    throw new Error(`unexpected fetch ${url}`);
  };
  return seen;
}
const json = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const realFetch = globalThis.fetch;

test("⛔ J1: Disconnect clears every job's progress", async () => {
  const { stores } = chromeStub();
  const { progress, PROGRESS_KEY } = await import("../extension/progress.js");
  const auth = await import("../extension/auth.js");
  await progress.clearAll();
  await progress.patch({ jobId: "gh-zoom-1" }, { title: "Software Engineer" });
  stores.local.set("authToken", "tok");
  fetchStub([[/revoke-extension-token/, json(200, { ok: true })]]);
  await auth.disconnect("https://jobsviadraft.test");
  assert.equal(stores.local.has(PROGRESS_KEY), false, "Disconnect left the progress behind");
  globalThis.fetch = realFetch; delete globalThis.chrome;
});

test("⛔ J1: sign-out clears it; an unreachable server does NOT; another account connecting clears it", async () => {
  const { stores } = chromeStub();
  const { progress, PROGRESS_KEY } = await import("../extension/progress.js");
  const auth = await import("../extension/auth.js");
  const seed = async () => { await progress.clearAll(); await progress.patch({ jobId: "gh-zoom-1" }, { title: "Software Engineer" }); };

  // offline: no token, and the bootstrap cannot reach the server → nothing is cleared
  await seed();
  fetchStub([[/extension-token/, () => { throw new Error("offline"); }]]);
  assert.equal((await auth.getIdentity("https://jobsviadraft.test")).authenticated, false);
  assert.equal(stores.local.has(PROGRESS_KEY), true, "an unreachable server is not a sign-out");

  // signed out: no token, and the website says there is no session → cleared
  fetchStub([[/extension-token/, json(401, { error: "auth" })]]);
  await auth.getIdentity("https://jobsviadraft.test");
  assert.equal(stores.local.has(PROGRESS_KEY), false, "a sign-out left the progress behind");

  // a token the server no longer honours AND no session to trade → signed out → cleared
  await seed();
  stores.local.set("authToken", "revoked");
  fetchStub([[/\/api\/auth\/me/, json(401, {})], [/extension-token/, json(401, {})]]);
  await auth.getIdentity("https://jobsviadraft.test");
  assert.equal(stores.local.has(PROGRESS_KEY), false, "a revoked token with no session is a sign-out");

  // ada's records, then blake connects → cleared before blake sees ada's jobs
  await seed();
  stores.local.set("authToken", "tok");
  fetchStub([[/\/api\/auth\/me/, json(200, { authenticated: true, user: { username: "ada" } })]]);
  await auth.getIdentity("https://jobsviadraft.test");
  assert.equal(await progress.owner(), "ada");
  fetchStub([[/\/api\/auth\/me/, json(200, { authenticated: true, user: { username: "blake" } })]]);
  await auth.getIdentity("https://jobsviadraft.test");
  assert.equal(await progress.get({ jobId: "gh-zoom-1" }), null, "another account saw the first account's jobs");
  // a server error is not a sign-out either
  await seed();
  fetchStub([[/\/api\/auth\/me/, json(500, {})]]);
  await auth.getIdentity("https://jobsviadraft.test");
  assert.ok(await progress.get({ jobId: "gh-zoom-1" }), "a 500 is not a sign-out");
  globalThis.fetch = realFetch; delete globalThis.chrome;
});

// ── the popup ────────────────────────────────────────────────────────────────────────────────────────
function fakeDoc() {
  const els = {};
  const el = (id) => ({
    id, hidden: true, textContent: "", className: "", children: [], listeners: {},
    append(...xs) { this.children.push(...xs); }, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
    setAttribute() {},
    set textContent(v) { this._t = v; if (v === "") this.children = []; }, get textContent() { return this._t ?? ""; },
  });
  return { els, getElementById: (id) => (els[id] ||= el(id)), createElement: (t) => el(`<${t}>`) };
}

test("⛔ J1 · D23: the popup opens KNOWING the job and where it stands — no page read, no message, no server call", async () => {
  const { stores, out } = chromeStub({ tabUrl: `${T}/Zoom/login` });
  const seen = fetchStub([]);
  const { progress } = await import("../extension/progress.js");
  const { bindTab } = await import("../extension/tabBinding.js");
  await progress.clearAll();
  stores.local.set("authIdentity", { authenticated: true, username: "ada" });
  await bindTab({ id: 7, url: OWNER_URL }, { jobId: "gh-zoom-1", title: "Software Engineer", company: "Zoom", via: "capture" });
  const t = (h, m) => new Date(2026, 9, 13, h, m).getTime();
  await progress.patch({ jobId: "gh-zoom-1" }, { title: "Software Engineer", company: "Zoom", postingUrl: POSTING,
    captured: { at: t(10, 41) }, read: { at: t(10, 42) }, prepared: { at: t(10, 43) }, filled: { n: 14, of: 18, needYou: 2, check: 0 } });
  await new Promise(r => setTimeout(r, 2));
  await progress.patch({ jobId: "lever-1" }, { title: "Data Engineer", company: "Fabrikam", link: "https://jobsviadraft.com/jobs/lever-1", captured: { at: t(9, 0) } });
  out.messages.length = 0; out.injected.length = 0;

  const { renderProgress } = await fresh("popup-progress.js");
  const doc = fakeDoc();
  const shown = await renderProgress(doc, t(12, 0));
  assert.deepEqual(out.messages, [], "the popup asked the service worker something on open");
  assert.deepEqual(out.injected, [], "the popup read the page on open");
  assert.deepEqual(seen, [], "the popup asked the server something on open");
  assert.equal(shown.current, "gh-zoom-1", "a later stage of the same origin is the bound job");
  assert.equal(doc.els["progress-job"].textContent, "Software Engineer at Zoom");
  assert.equal(doc.els["progress-line"].textContent, "Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you");
  assert.equal(doc.els.progress.hidden, false);
  assert.deepEqual(shown.list, ["lever-1", "gh-zoom-1"], "the In progress list, newest change first");
  assert.equal(doc.els["in-progress"].hidden, false);
  // an entry opens its posting (or the job on draft) — never anything else
  const rows = doc.els["in-progress-list"].children;
  const zoomRow = rows.find(li => li.children[0].textContent === "Software Engineer at Zoom");
  zoomRow.children[2].listeners.click[0]();
  assert.deepEqual(out.opened, [POSTING]);
  // signed out → nothing is shown
  stores.local.delete("authIdentity");
  const doc2 = fakeDoc();
  assert.deepEqual(await renderProgress(doc2, t(12, 0)), { current: null, list: [] });
  globalThis.fetch = realFetch; delete globalThis.chrome;
  // the popup loads it, and has the two blocks, in the site's tokens (both themes) — no capsule
  const html = read("extension/popup.html");
  assert.match(html, /<script type="module" src="popup-progress\.js"><\/script>/);
  assert.match(html, /id="progress" class="pk" hidden/);
  assert.match(html, /id="in-progress" hidden/);
  const block = html.slice(at(html, "/* ⭐ D96 §3 · progress */"), at(html, "/* ⭐ D96 §3 end */"));
  assert.ok(block.length > 40, "the progress styles are marked");
  assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b|rgba?\(|999px|50%/i, "a colour literal or a capsule in the progress styles");
});

// ── the writes, where the events happen — the REAL handoff against the REAL routes ──────────────────
const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
let ATS_PORT, atsProc, FPOST, FAPPLY, FAMILIES;
async function startAts() {
  if (atsProc) return;
  const { APPLY_ORIGIN_FAMILIES } = await import("../services/applyOrigins.js");
  ATS_PORT = await freePort();
  atsProc = spawn(process.execPath, ["scripts/fakeAts.js"], { env: { ...process.env, PORT: String(ATS_PORT) }, stdio: "ignore" });
  FPOST = `http://localhost:${ATS_PORT}`;
  FAPPLY = `http://127.0.0.1:${ATS_PORT}`;
  FAMILIES = [...APPLY_ORIGIN_FAMILIES, { ats: "fake-two-origin", origins: [FPOST, FAPPLY], jobIdPattern: /\/twoorigin\/(?:jobs|apply)\/(\d+)/ }];
  for (let i = 0; i < 100; i++) {
    try { const r = await realFetch(`${FPOST}/twoorigin/jobs/1`); if (r.ok) return; } catch {}
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error("fake ATS did not start");
}
test.after(() => { atsProc?.kill(); });

function mountServer() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume',unixepoch()-100)").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const hooks = applyRoutes(app, db, (q, r, n) => n(), () => ({ field_map: { first_name: "Ada", last_name: "Example", email: "ada@example.test", phone: "555-0100" }, handler_map: {}, custom_answers: {} }),
    async () => ({ error: "no model in tests" }), async () => Buffer.from("%PDF-1.4 synthetic"), async () => ({}), () => null, { applyOriginFamilies: FAMILIES });
  app.use("/api/import", createImportJobRouter(db));
  const server = app.listen(0);
  return { db, hooks, base: `http://127.0.0.1:${server.address().port}`, stop: () => { server.close(); db.close(); } };
}

async function probeFromFixture(url) {
  const html = await (await realFetch(url)).text();
  const labels = new Map([...html.matchAll(/<label[^>]*for="([^"]+)"[^>]*>([^<]*)<\/label>/g)].map(m => [m[1], m[2].trim()]));
  const fields = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)]
    .map(m => ({ tag: m[1], attrs: m[2] }))
    .map(({ tag, attrs }) => ({ type: (attrs.match(/type="([^"]+)"/)?.[1] || tag).toLowerCase(),
      name: attrs.match(/name="([^"]+)"/)?.[1] || null, id: attrs.match(/id="([^"]+)"/)?.[1] || null }))
    .filter(f => !["hidden", "submit", "button"].includes(f.type))
    .map((f, index) => ({ index, ...f, label: labels.get(f.id) || "", required: false, options: null }));
  return { hasForm: /<form/.test(html), url, origin: new URL(url).origin, fields };
}

test("⛔ J1: Prepare → fill → I submitted it write the job's progress — counts only, the posting never asked again", async (t) => {
  await startAts();
  globalThis.fetch = realFetch;
  const srv = mountServer(); t.after(srv.stop);
  const { stores } = chromeStub();
  stores.local.set("authToken", "t");
  let tab = { id: 7, url: `${FAPPLY}/twoorigin/apply/45` };
  chrome.tabs.query = async () => [tab];
  chrome.scripting.executeScript = async ({ func, args = [] }) => {
    if (func.name === "probeFormShape") return [{ result: await probeFromFixture(tab.url) }];
    if (func.name === "applyPlan") return [{ result: { filled: args[0].map(s => ({ field: s.label, name: s.name, verified: true })), skipped: [], resume: null } }];
    if (func.name === "findMissingRequired") return [{ result: [{ label: "Why us?" }] }];
    return [{ result: { ok: true, rendered: true } }];
  };
  srv.db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('two::45','Platform Engineer','Contoso Logistics',?,?,'t','h45',unixepoch()-86400)`).run(`${FPOST}/twoorigin/jobs/45`, `${FPOST}/twoorigin/jobs/45`);
  srv.db.prepare(`INSERT INTO resumes (user_id,job_id,company,role,apply_mode,html,ats_score,ats_report,domain_profile_id,created_at,updated_at)
    VALUES (1,'two::45','Contoso Logistics','Platform Engineer','TAILORED','<p>tailored</p>',71,'{}',10,unixepoch(),unixepoch())`).run();
  const gh = await import("../extension/gated-handoff.js");
  const { progress, PROGRESS_KEY } = await import("../extension/progress.js");
  await progress.clearAll();

  const filled = await gh.prepareAndFill({ serverUrl: srv.base, tab });
  assert.equal(filled.ok, true, filled.message);
  let r = await progress.get({ jobId: "two::45" });
  assert.ok(r?.prepared?.at, "Prepare is remembered");
  assert.ok(r.prepared.packetId, "with the packet's id (the packet stays on the server)");
  assert.equal(r.title, "Platform Engineer");
  // ⭐ J4 (D96 §5): the counts ARE the review panel's — filled · of · needs you · to check — so the popup and the
  // panel say the same three numbers. Every field on the page is a panel row, so "needs you" counts each one draft
  // could not fill, not only the required one the badge names.
  assert.ok(filled.panel, "the fill reports the panel's counts");
  assert.equal(r.filled.n, filled.panel.filled);
  assert.ok(r.filled.n > 0);
  assert.equal(r.filled.of, filled.panel.of, "of how many questions the panel lists");
  assert.equal(r.filled.needYou, filled.panel.needYou, "what the panel lists under Needs you");
  assert.ok(r.filled.needYou >= 1, "a required field left empty needs you");
  assert.equal(r.filled.check, filled.panel.check);
  assert.equal(r.read.fieldCount, (await probeFromFixture(tab.url)).fields.length, "the page's field count, read");
  const sub = await gh.recordSubmitted({ serverUrl: srv.base, tab });
  assert.equal(sub.ok, true, sub.message);
  r = await progress.get({ jobId: "two::45" });
  assert.ok(r.submitted?.at, "I submitted it is remembered");
  // ⛔ no value reached the record: the synthetic answers and the address the fill typed are not in it
  const raw = JSON.stringify(stores.local.get(PROGRESS_KEY));
  for (const v of ["Ada", "Example", "ada@example.test", "555-0100"]) assert.ok(!raw.includes(v), `the record holds ${v}`);
  // the review panel's "ready" (background.js GATE_REVIEW_STATE → noteReviewed) is remembered too
  const { noteReviewed } = await import("../extension/progress.js");
  await noteReviewed({ ready: true }, { jobId: "two::45" });
  assert.ok((await progress.get({ jobId: "two::45" })).reviewed?.at);
  await noteReviewed({ ready: false }, { jobId: "two::45" });
  delete globalThis.chrome;
});

test("⛔ J1: a fill on a BOUND tab names the job and never says 'capture it first'; with no binding and no match it names Capture", async (t) => {
  await startAts();
  globalThis.fetch = realFetch;
  const srv = mountServer(); t.after(srv.stop);
  const { stores } = chromeStub();
  stores.local.set("authToken", "t");
  const tab = { id: 9, url: `${FAPPLY}/twoorigin/apply/46` };
  chrome.tabs.query = async () => [tab];
  const gh = await import("../extension/gated-handoff.js");
  const { bindTab, clearBinding } = await import("../extension/tabBinding.js");
  await clearBinding(9);
  let r = await gh.runGatedHandoff({ serverUrl: srv.base, tab });
  assert.equal(r.reason, "unknown");
  assert.equal(r.message, "draft doesn't know this job — Capture adds it.", "no binding, no match: the ONE button that adds it (T16)");
  // the tab is linked to a job (a recognised posting) the user has not captured: the job is NAMED, never "capture it first"
  await bindTab(tab, { jobId: "two::46", title: "Platform Engineer", company: "Contoso Logistics", via: "recognised" });
  r = await gh.runGatedHandoff({ serverUrl: srv.base, tab });
  assert.doesNotMatch(r.message, /capture it first/, r.message);
  assert.match(r.message, /Platform Engineer at Contoso Logistics/);
  // a posting draft holds but that is no longer live, and was never the user's: not on their board — named, and ONE button
  srv.db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at,is_active)
    VALUES ('two::46','Platform Engineer','Contoso Logistics',?,?,'t','h46',unixepoch()-86400,0)`).run(`${FPOST}/twoorigin/jobs/46`, `${FPOST}/twoorigin/jobs/46`);
  r = await gh.runGatedHandoff({ serverUrl: srv.base, tab });
  assert.equal(r.reason, "not_on_board");
  assert.doesNotMatch(r.message, /capture it first/, r.message);
  assert.match(r.message, /^Platform Engineer at Contoso Logistics isn't on your board yet — Capture adds it\.$/);
  // ⭐ BINDING FIRST + D99: the same posting LIVE on the board, bound to this tab (identify's "a board job not yet yours")
  // — the binding's rule applies even where the address names it: Prepare is offered, never "capture it first"
  srv.db.prepare("UPDATE scraped_jobs SET is_active = 1 WHERE job_id = 'two::46'").run();
  r = await gh.runGatedHandoff({ serverUrl: srv.base, tab });
  assert.equal(r.reason, "prepare", r.message);
  assert.equal(r.canPrepare, true);
  delete globalThis.chrome;
});

test("⛔ J1: the binding is set, used, cleared as spec'd — and only its job id is ever sent", () => {
  const bg = read("extension/background.js");
  const gh = read("extension/gated-handoff.js");
  const tb = read("extension/tabBinding.js");
  assert.match(tb, /chrome\.storage\.session/, "the binding lives in session storage");
  assert.doesNotMatch(tb, /chrome\.storage\.local|fetch\(|authedFetch/, "the binding is never persisted or sent");
  assert.match(bg, /if \(message\.type === 'UNBIND_TAB'\) \{[\s\S]{0,200}clearBinding\(tab\?\.id\)/, "Unlink this page clears it");
  // every request body that mentions the binding carries its job id, and nothing else of it
  for (const src of [gh, bg, read("extension/progress.js"), read("extension/popup-progress.js")]) {
    for (const m of src.matchAll(/JSON\.stringify\(\{([^}]*)\}\)/g)) {
      const body = m[1];
      // the one allowed mention is the hint itself; anything else of the binding in a body is the binding being sent
      assert.doesNotMatch(body.replace(/boundJobId: bound\?\.jobId \?\? null/g, ""), /\bbound\b|binding|boundAt|dock/,
        `a request carries the binding: ${body}`);
      assert.doesNotMatch(body, /progress|record\b/, `a request carries a progress record: ${body}`);
    }
  }
  // ⛔ progress never leaves the browser: nothing in either progress module can make a request
  for (const f of ["extension/progress.js", "extension/popup-progress.js"]) {
    assert.doesNotMatch(read(f), /\bfetch\(|authedFetch|XMLHttpRequest|sendBeacon|WebSocket/, `${f} can send something`);
  }
  // the wiring this lane owns
  assert.match(gh, /await notePrepared\(body\)/, "Prepare writes its progress");
  assert.match(gh, /await noteFill\(result, \{ jobId: held\?\.packet\?\.jobId \?\? null, bound \}\)/, "the fill writes its progress");
  assert.match(gh, /await noteSubmitted\(result, \{ jobId: held\?\.packet\?\.jobId \?\? bound\?\.jobId \?\? null \}\)/, "I submitted it writes its progress");
});

// ── the server half: the page's key and canonical posting, in the answer the popup already asks for ──
test("⛔ J1: /api/import/context names the page's key and its canonical posting — the extension parses no URL", async (t) => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('gh-zoom-1','Software Engineer','Zoom','Remote (US)','https://boards.greenhouse.io/zoom/jobs/9001','https://boards.greenhouse.io/zoom/jobs/9001','t','h1',unixepoch()-86400)`).run();
  recordPageKey(db, OWNER_URL, "gh-zoom-1");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use("/api/import", createImportJobRouter(db));
  const server = app.listen(0); t.after(() => { server.close(); db.close(); });
  const ask = (url) => realFetch(`http://127.0.0.1:${server.address().port}/api/import/context`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) }).then(r => r.json());
  const ctx = await ask(OWNER_URL);
  assert.deepEqual(ctx.pageKey, { key: "workday|zoom|zoom|R19749", rev: 1, canonicalUrl: POSTING });
  assert.equal(ctx.posting.jobId, "gh-zoom-1");
  assert.equal((await ask("https://boards.greenhouse.io/zoom/jobs/9001")).pageKey, null, "no key where the ATS gives none");
  assert.equal((await ask("not a url")).pageKey, null);
});
