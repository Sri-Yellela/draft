// ⭐⭐ D112 item 4 (T35 = A — GLOBAL READ) and design call b2 (the permission ask: a small window that closes itself).
//
// Owner 10-30: "T35, we will go for global read … no clicks needed and making ui changes as needed." The extension asks
// ONCE for the optional https://*/* pattern — from a small extension window over the posting ("Let draft read job
// postings on any site?" · Allow / Not now, with the no-posting-sends-nothing line) — and then reads postings by itself
// on any site: a local detector (extension/jobSignals.js + globalReadDetector.js) decides whether a page is a job page;
// only then does the step watcher start and the usual pass run, and the dock appears on a posting by itself.
//
// ⛔ STILL TRUE, AND PINNED HERE: a page that is not a posting sends NOTHING (not its address, not a hash); an irrelevant
// posting is discarded and not stored; LinkedIn / Indeed / Glassdoor are never read (D78 — the one NEVER list); nothing
// is captured into a shared board from browsing (the capture is the user's own account's, as D64's).
//
// Unit level, against the REAL modules with a fake `chrome` (test-support/autoReadChrome.mjs + windows/tabs fakes below)
// and the REAL content scripts run in a node `vm` with a fake page. The real-Chrome half — the window opened by a real
// press, answered Not now, closed, the posting tab focused again — is test/d112GlobalReadChrome.test.js.
// Synthetic companies and people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import Database from "better-sqlite3";
import {
  handlers, runAutoPass, scopeFor, desiredRegistrations, openTabsAfterConsent, defaultSettings, normaliseSettings, onPermissionsAdded,
  popupAutoView, globalAskDue, AUTO_READ_KEY, NEVER_HOSTS, NEVER_MATCHES, GLOBAL_ORIGINS, OWN_MATCHES, SITES, GLOBAL_REGISTRATION_ID,
} from "../extension/autoRead.js";
import { openGlobalAsk, handlers as ASK_HANDLERS, onWindowRemoved, askWindow, GLOBAL_ASK } from "../extension/globalRead.js";
import { onAllow, onNotNow } from "../extension/global-ask.js";
import { toolbarPress, relayFor } from "../extension/toolbarPress.js";
import { installAutoReadChrome } from "../test-support/autoReadChrome.mjs";
import { MIGRATIONS } from "../scripts/migrations.js";
import { importJob } from "../services/jobs/importJob.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SERVER = "https://draft.test";
const ANY = "https://*/*";
const ASK_PAGE = { id: "test", url: "chrome-extension://test/global-ask.html?tab=7", tab: { id: 99, windowId: 500 } };
const OPTIONS_PAGE = { id: "test", url: "chrome-extension://test/options.html" };
const CAREERS = "https://careers.northwind.test";
const POSTING = `${CAREERS}/jobs/4471-platform-engineer`;
const BLOG = "https://news.example.test/2026/10/30/a-story";
let tabN = 0;
const tabOf = (url, windowId = 1) => ({ id: 7000 + (++tabN), url, windowId });
const globalOn = () => ({ ...defaultSettings(), global: { at: Date.now() }, globalAsk: { at: Date.now(), answer: "allow" } });
const FACTS = (o = {}) => ({ origin: CAREERS, step: "", frames: [], isApplyFlow: false, hasPassword: false, isReview: false, ...o });
const stored = (h) => normaliseSettings(h.stores.local.get(AUTO_READ_KEY));

/** The fake chrome, with the windows and tabs calls the ask makes — every one recorded in h.win. */
function withWindows(h, tabs = []) {
  h.win = [];
  let nextWin = 500;
  chrome.windows = {
    create: async (o) => { const w = { id: ++nextWin, ...o }; h.win.push(["create", o]); return w; },
    update: async (id, o) => { h.win.push(["update", id, o]); return { id }; },
    remove: async (id) => { h.win.push(["remove", id]); },
    get: async (id) => ({ id, left: 100, top: 50, width: 1280, height: 900 }),
    onRemoved: { addListener() {} },
  };
  chrome.tabs.get = async (id) => tabs.find(t => t.id === id) || null;
  chrome.tabs.update = async (id, o) => { h.win.push(["tab", id, o]); return { id }; };
  chrome.tabs.query = async () => tabs.map(t => ({ ...t }));
  return h;
}

// ── the content scripts, run for real in a vm with a fake page ──────────────────────────────────────────────────────
/** A fake page: its address, JSON-LD tags, iframes and inputs (type / name / autocomplete only — never a value). */
function fakePage(href, { jsonld = [], iframes = [], inputs = [], top = true } = {}) {
  const matchInput = (sel, i) => sel.split(",").map(s => s.trim()).some(s => {
    let m = s.match(/^input\[type="([^"]+)"\]$/); if (m) return i.type === m[1];
    m = s.match(/^input\[name\*="([^"]+)" i\]$/); if (m) return String(i.name || "").toLowerCase().includes(m[1]);
    m = s.match(/^input\[autocomplete="([^"]+)"\]$/); if (m) return i.autocomplete === m[1];
    return false;
  });
  const document = {
    querySelectorAll: (sel) => (sel === 'script[type="application/ld+json"]' ? jsonld.map(t => ({ textContent: t }))
      : sel === "iframe[src]" ? iframes.map(src => ({ src })) : []),
    querySelector: (sel) => inputs.find(i => matchInput(sel, i)) || null,
  };
  return { document, location: { href }, top };
}
const SIGNALS_SRC = read("extension/jobSignals.js");
const DETECTOR_SRC = read("extension/globalReadDetector.js");
/** Run jobSignals.js + globalReadDetector.js on a fake page. → what it sent, scheduled, listened to, and stored. */
function runDetector(page) {
  const sent = [], timers = [], listeners = [], net = [], storage = [];
  const ctx = {
    URL, JSON, Date, Array, String, Number, Promise,
    document: page.document, location: page.location,
    chrome: { runtime: { sendMessage: (m) => { sent.push(m); return Promise.resolve({ ok: true }); } },
      storage: { local: { set: (o) => storage.push(o), get: () => ({}) } } },
    fetch: (u) => { net.push(u); return Promise.resolve(null); },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    addEventListener: (type) => listeners.push(type),
  };
  ctx.window = ctx;
  ctx.top = page.top ? ctx : {};
  vm.createContext(ctx);
  vm.runInContext(SIGNALS_SRC, ctx);
  vm.runInContext(DETECTOR_SRC, ctx);
  // the one late re-check, run now (the page has not changed)
  for (const t of timers.splice(0)) { ctx.Date = { now: () => Date.now() + 5000 }; t.fn(); }
  return { sent, listeners, net, storage, signals: ctx.__draftJobSignals };
}
const JSONLD = JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Platform Engineer", hiringOrganization: { name: "Northwind" } });

// ═══ d112NonPostingSendsNothing ═══════════════════════════════════════════════════════════════════════════════════
test("⛔ d112NonPostingSendsNothing · the detector on a page that is not a job page sends NOTHING — no message, no request, no storage — on a news story, a sign-in page, a newsletter form, a careers address with no form", () => {
  const pages = [
    fakePage(BLOG),
    fakePage("https://bank.example.test/login", { inputs: [{ type: "email", name: "email" }, { type: "password", name: "password" }] }),
    fakePage("https://shop.example.test/", { inputs: [{ type: "email", name: "newsletter_email" }] }),
    fakePage("https://www.example.test/careers", {}),                                   // a careers address, nothing to read
    fakePage("https://www.example.test/contact", { inputs: [{ type: "file", name: "attachment" }, { type: "email", name: "email" }] }),   // a form, not a job address
    fakePage("http://insecure.example.test/jobs/1", { jsonld: [JSONLD] }),              // not https
  ];
  for (const p of pages) {
    const r = runDetector(p);
    assert.deepEqual(r.sent, [], `${p.location.href}: a message was sent`);
    assert.deepEqual(r.net, [], `${p.location.href}: a request was made`);
    assert.deepEqual(r.storage, [], `${p.location.href}: storage was written`);
  }
  // a job page: ONE message, and it carries the reason word only — never the address
  const yes = runDetector(fakePage(POSTING, { jsonld: [JSONLD] }));
  assert.deepEqual(JSON.parse(JSON.stringify(yes.sent)), [{ type: "AUTO_READ_DETECTED", why: "json_ld" }]);   // (a vm object: compared as data)
  assert.ok(!JSON.stringify(yes.sent).includes("northwind"), "the message names no address");
  // the detector watches nothing but navigation (no MutationObserver, one late check)
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");   // the code, not its comments
  assert.doesNotMatch(code(DETECTOR_SRC), /MutationObserver|setInterval/);
  assert.doesNotMatch(code(SIGNALS_SRC + DETECTOR_SRC),/fetch\(|XMLHttpRequest|storage\.|\.value\b/, "no request, no storage, no value read");
});

test("⛔ d112NonPostingSendsNothing · the worker's pass under global read: the page no longer a job page → nothing read, written or sent; a job page that is not a POSTING → never the extractor, never /api/import", async () => {
  const h = installAutoReadChrome({ granted: [ANY], page: { jobSignalsInPage: { job: false, why: null } } });
  h.stores.local.set(AUTO_READ_KEY, globalOn());
  const before = JSON.stringify(h.stores.local.get(AUTO_READ_KEY));
  const r = await runAutoPass(tabOf(BLOG), { serverUrl: SERVER });
  assert.equal(r.skipped, "not_a_job_page");
  assert.deepEqual(h.net, [], "nothing sent");
  assert.equal(JSON.stringify(h.stores.local.get(AUTO_READ_KEY)), before, "nothing written");
  assert.deepEqual(h.injected, ["file:jobSignals.js", "jobSignalsInPage"], "only the detector ran — no pageFacts, no labels, no extractor");
  h.restore();

  // an application form on a careers address (a job page) with no JSON-LD and no posting shape: read locally, never sent
  const f = installAutoReadChrome({ granted: [ANY], page: {
    jobSignalsInPage: { job: true, why: "apply_form" }, pageFacts: FACTS(), pageHasJobPosting: false,
    collectFormLabels: { labels: ["First name", "Email"], fieldCount: 2 },
    extractJobPayload: { ok: true, url: `${CAREERS}/apply`, title: "x", company: "Northwind", text: "would be sent" },
  } });
  f.stores.local.set(AUTO_READ_KEY, globalOn());
  const p = await runAutoPass(tabOf(`${CAREERS}/careers/apply`), { serverUrl: SERVER });
  assert.deepEqual(p.done, ["read"], "the labels are read, locally");
  assert.ok(!f.injected.includes("extractJobPayload"), "the extractor never ran");
  assert.ok(!f.net.some(q => /\/api\/import/.test(q.url)), "nothing was captured");
  for (const q of f.net) assert.ok(!String(q.url + q.body).includes("northwind"), `the page's address left: ${q.url}`);
  f.restore();
});

test("⛔ d112NonPostingSendsNothing · global read OFF (never agreed, refused, or the kill switch) → the detector's message starts nothing and nothing is registered", async () => {
  for (const s of [defaultSettings(), { ...globalOn(), kill: true }, { ...defaultSettings(), globalAsk: { at: Date.now(), answer: "later" } }]) {
    const h = installAutoReadChrome({ granted: [ANY] });
    h.stores.local.set(AUTO_READ_KEY, s);
    const r = await handlers.AUTO_READ_DETECTED({}, { tab: tabOf(POSTING), frameId: 0, url: POSTING });
    assert.equal(r.ok, false);
    assert.deepEqual(h.injected, []);
    assert.deepEqual(await desiredRegistrations(normaliseSettings(s)), []);
    h.restore();
  }
  // agreed but Chrome's grant gone → nothing either
  const g = installAutoReadChrome({ granted: [] });
  g.stores.local.set(AUTO_READ_KEY, globalOn());
  assert.equal((await handlers.AUTO_READ_DETECTED({}, { tab: tabOf(POSTING), frameId: 0, url: POSTING })).ignored, "not_granted");
  assert.deepEqual(await desiredRegistrations(globalOn()), []);
  g.restore();
});

// ═══ d112IrrelevantDiscarded ═════════════════════════════════════════════════════════════════════════════════════
test("⛔ d112IrrelevantDiscarded · a posting on a site no list names is read by itself — and when the server discards it, the extension keeps nothing (no binding, no Undo, no 'Added' toast); the dock still appears, collapsed", async () => {
  const h = installAutoReadChrome({ granted: [ANY], page: {
    jobSignalsInPage: { job: true, why: "json_ld" }, pageFacts: FACTS(), pageHasJobPosting: true,
    collectFormLabels: { labels: [], fieldCount: 0 }, launcherInPage: { ok: true, drawn: true },
    extractJobPayload: { ok: true, url: POSTING, title: "Account Executive", company: "Northwind", text: "Title: Account Executive\nCompany: Northwind" },
  }, respond: () => ({ status: 200, body: { discarded: true, reason: "role_mismatch", auto: true } }) });
  h.stores.local.set(AUTO_READ_KEY, globalOn());
  const tab = tabOf(POSTING);
  const r = await runAutoPass(tab, { serverUrl: SERVER });
  assert.deepEqual(r.done, ["capture"]);
  assert.equal(r.capture.discarded, true);
  assert.equal(h.net.length, 1);
  assert.match(h.net[0].url, /\/api\/import\/auto$/, "the user's OWN account's automatic capture — never a shared board");
  assert.equal(h.stores.session.get(`bind:${tab.id}`), undefined, "not bound");
  assert.ok(!h.injected.includes("renderRelay"), "no 'Added to your board' toast");
  assert.equal(r.launcher?.ok, true, "the dock appears on the posting by itself (collapsed)");
  h.restore();
});

test("⛔ d112IrrelevantDiscarded · the server: an automatic capture from an arbitrary careers site that is not relevant stores NOTHING — no posting, no capture row, no refusal, no URL", async () => {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (7,1,'Current','engineering','general',1)`).run();
  const text = ["Title: Enterprise Account Executive", "Company: Northwind", "Location: Austin, TX", "", "Own a sales quota and close new business."].join("\n");
  const r = await importJob({ url: POSTING, text }, { db: d, userId: 1, auto: true });
  assert.equal(r.discarded, true);
  for (const t of ["scraped_jobs", "job_captures", "rejected_jobs", "user_jobs"]) assert.equal(d.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
});

// ═══ d112NoBlockedSites ═════════════════════════════════════════════════════════════════════════════════════════
test("⛔ d112NoBlockedSites · LinkedIn / Indeed / Glassdoor are never read under global read — the ONE never list (D78) excludes them from the registration, the worker refuses them, the detector refuses them; draft's own site too", async () => {
  const BLOCKED = ["https://www.linkedin.com/jobs/view/123", "https://uk.indeed.com/viewjob?jk=1", "https://www.glassdoor.com/job-listing/x", "https://linkedin.com/jobs/1"];
  const s = globalOn();
  for (const u of BLOCKED) assert.equal(scopeFor(s, u).skip, "never_host", u);
  assert.ok(scopeFor(s, "https://jobsviadraft.com/app").skip, "draft's own site");
  assert.equal(scopeFor(s, POSTING).global, true, "any other https site is global read's");
  // the detector's own copy of the list IS autoRead.js's (the same source)
  assert.ok(SIGNALS_SRC.includes(`var NEVER_HOSTS = ${NEVER_HOSTS.toString()};`), "jobSignals.js carries autoRead.js NEVER_HOSTS, unchanged");
  for (const u of BLOCKED) assert.deepEqual(runDetector(fakePage(u, { jsonld: [JSONLD], inputs: [{ type: "file" }, { type: "email" }] })).sent, [], u);
  assert.deepEqual(runDetector(fakePage("https://jobsviadraft.com/jobs/1", { jsonld: [JSONLD] })).sent, [], "draft's own site");

  const h = withWindows(installAutoReadChrome({ granted: [ANY] }), BLOCKED.map((url, i) => ({ id: 900 + i, url, windowId: 1 })));
  h.stores.local.set(AUTO_READ_KEY, globalOn());
  const [reg] = await desiredRegistrations(globalOn());
  assert.equal(reg.id, GLOBAL_REGISTRATION_ID);
  assert.deepEqual(reg.matches, [ANY]);
  assert.deepEqual(reg.excludeMatches, [...NEVER_MATCHES, ...OWN_MATCHES]);
  assert.deepEqual(reg.js, ["jobSignals.js", "globalReadDetector.js"]);
  assert.deepEqual((await openTabsAfterConsent()).injected, [], "no blocked tab gets the detector");
  for (const u of BLOCKED) {
    assert.equal((await handlers.AUTO_READ_DETECTED({}, { tab: tabOf(u), frameId: 0, url: u })).ok, false, u);
    assert.equal((await runAutoPass(tabOf(u), { serverUrl: SERVER })).skipped, "never_host", u);
  }
  assert.deepEqual(h.injected, [], "nothing ran on any of them");
  assert.deepEqual(h.net, []);
  h.restore();
});

// ═══ d112PermissionAskedOnce ════════════════════════════════════════════════════════════════════════════════════
test("⭐ d112PermissionAskedOnce · the FIRST press opens the one ask; any answer ends it — the next press asks nothing; the ask requests exactly https://*/*, as its click's first call", async () => {
  const posting = { id: 7, url: POSTING, windowId: 1 };
  const h = withWindows(installAutoReadChrome({ granted: [] }), [posting]);
  const deps = (auto) => ({
    state: async () => ({ exists: false }), openDock: async () => ({ ok: true }), identity: async () => ({ authenticated: true }),
    context: async () => ({}), relay: async () => null, openBoard: async () => null, auto: async () => auto, ask: (t) => openGlobalAsk(t),
  });
  const view = () => popupAutoView({ settings: stored(h), url: POSTING, granted: { global: h.granted.has(ANY) } });
  assert.equal(globalAskDue(defaultSettings()), true);
  assert.equal(view().globalAsk, true, "never asked: due");
  const p1 = await toolbarPress(posting, deps(view()));
  assert.equal(p1.asked, true, "the press opened the ask");
  assert.equal(h.win.filter(w => w[0] === "create").length, 1);
  const [, opts] = h.win.find(w => w[0] === "create");
  assert.equal(opts.type, "popup", "a small extension window (chrome.windows.create type popup)");
  assert.equal(opts.url, "chrome-extension://test/global-ask.html?tab=7", "over THIS posting's tab");
  assert.ok(opts.width <= 480 && opts.height <= 400, "small");
  assert.deepEqual(relayFor({ identity: { authenticated: true }, ctx: {}, auto: { globalAsk: true, card: true, cardSite: "Greenhouse" } }), [],
    "no per-site offer beside it — the window asks");
  // Not now
  await ASK_HANDLERS.GLOBAL_ASK_ANSWER({ answer: "later", tabId: 7 }, ASK_PAGE);
  assert.equal(view().globalAsk, false, "answered: never due again");
  const p2 = await toolbarPress(posting, deps(view()));
  assert.equal(p2.asked, undefined);
  assert.equal(h.win.filter(w => w[0] === "create").length, 1, "asked ONCE");
  assert.deepEqual(h.requested, [], "Not now asked Chrome nothing");
  // the dock's Allow (a person's press) may still open it — forced — and a granted global read never asks again
  assert.equal((await openGlobalAsk(posting, { force: true })).opened, true);
  h.granted.add(ANY);
  assert.equal((await ASK_HANDLERS.GLOBAL_ASK_ANSWER({ answer: "allow", tabId: 7 }, ASK_PAGE)).global, true);
  assert.equal((await openGlobalAsk(posting, { force: true })).already, true, "granted and on: nothing to ask");
  h.restore();

  // the window's Allow: the request is the FIRST call, for exactly the broad pattern, then the click is said to the worker
  const calls = [];
  const api = { permissions: { request: (o) => { calls.push(["request", o.origins]); return Promise.resolve(true); } },
    runtime: { sendMessage: async (m) => { calls.push(["message", m.type, m.answer || m.kind]); return { ok: true }; } } };
  const r = await onAllow(api, 7);
  assert.deepEqual(calls[0], ["request", [ANY]]);
  assert.deepEqual(GLOBAL_ORIGINS, [ANY]);
  assert.deepEqual(calls.slice(1), [["message", "AUTO_READ_PENDING", "global"], ["message", "GLOBAL_ASK_ANSWER", "allow"]]);
  assert.equal(r.granted, true);
  const src = read("extension/global-ask.js");
  const fn = src.slice(at(src, "export function onAllow(api, tabId) {"), at(src, "/** Not now"));
  assert.ok(fn.indexOf("api.permissions.request(") < fn.indexOf("await") && fn.indexOf("api.permissions.request(") < fn.indexOf("send("), "nothing before the request");
});

test("⭐ d112PermissionAskedOnce · Chrome's grant finishes the click even if the window died at the prompt (T20); a grant with no click turns nothing on; the grant taken away turns global read off", async () => {
  const h = withWindows(installAutoReadChrome({ granted: [] }), [{ id: 7, url: POSTING, windowId: 1 }]);
  assert.equal((await handlers.AUTO_READ_PENDING({ kind: "global" }, ASK_PAGE)).kind, "global");
  h.granted.add(ANY);
  const r = await onPermissionsAdded({ origins: [ANY] });
  assert.equal(r.pending, "global");
  assert.equal(r.done.ok, true);
  assert.ok(stored(h).global?.at);
  assert.deepEqual(r.registered, [GLOBAL_REGISTRATION_ID]);
  assert.deepEqual(r.done.injected, [7], "the posting tab already open gets the detector at once");
  await handlers.AUTO_READ_GLOBAL_OFF({}, OPTIONS_PAGE);
  assert.equal(stored(h).global, null);
  assert.deepEqual(h.removed, [ANY], "the access given back");
  h.restore();
  const n = installAutoReadChrome({ granted: [ANY] });
  assert.equal((await onPermissionsAdded({ origins: [ANY] })).done, null, "no click behind the grant: nothing on");
  assert.equal(stored(n).global, null);
  n.restore();
});

// ═══ d112bWindowClosesOnAnswer ══════════════════════════════════════════════════════════════════════════════════
test("⭐ d112bWindowClosesOnAnswer · Allow (granted), Allow (Chrome refused) and Not now each CLOSE the window; only the ask page may answer", async () => {
  for (const [answer, grant, recorded] of [["allow", true, "allow"], ["refused", false, "refused"], ["later", false, "later"], ["allow", false, "refused"]]) {
    const h = withWindows(installAutoReadChrome({ granted: grant ? [ANY] : [] }), [{ id: 7, url: POSTING, windowId: 1 }]);
    const o = await openGlobalAsk({ id: 7, url: POSTING, windowId: 1 });
    assert.equal(askWindow().windowId, o.windowId);
    assert.equal((await ASK_HANDLERS.GLOBAL_ASK_ANSWER({ answer, tabId: 7 }, { id: "test", url: POSTING, tab: { id: 7 } })).error, "not_allowed", "a web page cannot answer");
    const r = await ASK_HANDLERS.GLOBAL_ASK_ANSWER({ answer, tabId: 7 }, ASK_PAGE);
    assert.equal(r.answer, recorded, `${answer}/${grant}`);
    assert.ok(h.win.some(w => w[0] === "remove" && w[1] === o.windowId), `${answer}: the window is closed`);
    assert.equal(askWindow(), null);
    assert.equal(stored(h).globalAsk.answer, recorded);
    assert.equal(!!stored(h).global, recorded === "allow", "global read is on only with Chrome's grant");
    h.restore();
  }
  assert.equal(GLOBAL_ASK.title, "Let draft read job postings on any site?");
  assert.equal(GLOBAL_ASK.promise, "A page that is not a job posting sends nothing — not its address, not a hash.");
  assert.deepEqual([GLOBAL_ASK.allow, GLOBAL_ASK.later], ["Allow", "Not now"]);
  // the page shows those words, and nothing in it is a capsule (D60)
  const html = read("extension/global-ask.html");
  for (const id of ["ask-title", "ask-promise", "ask-allow", "ask-later"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /999px|border-radius:\s*50%|#[0-9a-f]{3,6}\b/i);
});

// ═══ d112bFocusReturnsToPosting ═════════════════════════════════════════════════════════════════════════════════
test("⭐ d112bFocusReturnsToPosting · on either answer — and when the window is closed with its own ✕ — focus returns to the posting tab (its window, then the tab), where the dock appears", async () => {
  const posting = { id: 7, url: POSTING, windowId: 3 };
  const h = withWindows(installAutoReadChrome({ granted: [ANY], page: { jobSignalsInPage: { job: true, why: "json_ld" } } }), [posting]);
  await openGlobalAsk(posting);
  const r = await ASK_HANDLERS.GLOBAL_ASK_ANSWER({ answer: "allow", tabId: 7 }, ASK_PAGE);
  assert.equal(r.focused, true);
  const tail = h.win.filter(w => w[0] !== "create");
  assert.deepEqual(tail, [["remove", 501], ["update", 3, { focused: true }], ["tab", 7, { active: true }]], "closed, then the posting's window and tab");
  assert.deepEqual(r.injected, [7], "the posting tab got the detector before the focus came back — its dock follows by itself");
  assert.ok(h.injected.includes("file:globalReadDetector.js"));
  h.restore();

  const x = withWindows(installAutoReadChrome({ granted: [] }), [posting]);
  const o = await openGlobalAsk(posting);
  assert.deepEqual(await onWindowRemoved(o.windowId), { ours: true, focused: true, tabId: 7 });
  assert.deepEqual(x.win.slice(-2), [["update", 3, { focused: true }], ["tab", 7, { active: true }]]);
  assert.equal(stored(x).globalAsk, null, "the ✕ is not an answer — nothing recorded");
  assert.deepEqual(await onWindowRemoved(12345), { ours: false }, "another window: nothing");
  x.restore();
  // background.js wires it: the answer handler and windows.onRemoved; the dock's Allow opens the ask, never a Settings tab
  const bg = read("extension/background.js");
  assert.match(bg, /chrome\.windows\?\.onRemoved\?\.addListener\(\(windowId\) => \{ void onAskWindowRemoved\(windowId\)/);
  const act = bg.slice(at(bg, "'allow-site': async (tab) => {"), at(bg, "'always-here': async"));
  assert.match(act, /openGlobalAsk\(tab, \{ force: true \}\)/);
  assert.doesNotMatch(act, /options\.html#permissions/, "the Settings-tab trip is gone");
});

// ═══ d112bNotNowNoPrompt ════════════════════════════════════════════════════════════════════════════════════════
test("⛔ d112bNotNowNoPrompt · Not now raises NO Chrome prompt — it says 'later' to the worker, which records it and grants nothing", async () => {
  const calls = [];
  const api = { permissions: { request: () => { calls.push("request"); return Promise.resolve(true); } },
    runtime: { sendMessage: async (m) => { calls.push(`${m.type}:${m.answer}`); return { ok: true }; } } };
  await onNotNow(api, 7);
  assert.deepEqual(calls, ["GLOBAL_ASK_ANSWER:later"], "no request");
  const src = read("extension/global-ask.js");
  assert.doesNotMatch(src.slice(at(src, "export function onNotNow(api, tabId) {"), at(src, "/** Fill the page's words")), /permissions/);
  const h = withWindows(installAutoReadChrome({ granted: [] }), [{ id: 7, url: POSTING, windowId: 1 }]);
  await openGlobalAsk({ id: 7, url: POSTING, windowId: 1 });
  const r = await ASK_HANDLERS.GLOBAL_ASK_ANSWER({ answer: "later", tabId: 7 }, ASK_PAGE);
  assert.equal(r.global, false);
  assert.deepEqual(h.requested, []);
  assert.equal(h.granted.has(ANY), false);
  assert.deepEqual(h.registered.size, 0, "nothing registered");
  h.restore();
});

// ── the new version ─────────────────────────────────────────────────────────────────────────────────────────────
test("D112 · a NEW extension version (1.6.0) — no new required permission, the broad pattern only optional, the new files shipped", async () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  // the new version was 1.6.0; later versions (1.6.1, 46j) keep its permission set
  assert.ok(manifest.version.split(".").map(Number).reduce((a, n, i) => a || (n !== [1, 6, 0][i] ? (n > [1, 6, 0][i] ? 1 : -1) : 0), 0) >= 0, `manifest v${manifest.version} is below 1.6.0`);
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.ok(manifest.optional_host_permissions.includes(ANY));
  const { collectRequiredFiles } = await import("../scripts/buildExtension.mjs");
  const files = collectRequiredFiles(manifest);
  for (const f of ["jobSignals.js", "globalReadDetector.js", "global-ask.html", "global-ask.js", "globalRead.js"]) assert.ok(files.includes(f), f);
  // every preset ATS host is an ATS host to the detector (so a preset site's page is still read under global read)
  const signals = runDetector(fakePage("https://x.test/")).signals;
  for (const s of SITES) {
    const host = { greenhouse: "boards.greenhouse.io", lever: "jobs.lever.co", ashby: "jobs.ashbyhq.com", workable: "apply.workable.com",
      workday: "acme.wd5.myworkdayjobs.com", smartrecruiters: "jobs.smartrecruiters.com" }[s.id];
    assert.equal(signals(fakePage(`https://${host}/x`).document, { href: `https://${host}/x` }, true).why, "ats_host", s.id);
  }
  const why = read("extension/MANIFEST_RATIONALE.md");
  assert.match(why, /D112 \(owner 10-30, T35 = A — GLOBAL READ, v1\.6\.0\): `https:\/\/\*\/\*` IS NOW REQUESTED, WHOLE, ONCE/);
});
