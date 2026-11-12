// D99 J11 · THE BRIDGE — the draft board hands a job to the extension (owner, 10-14: "build the bridge").
//
//   client/src/lib/openPosting.js  — the ONE way the web app opens a posting
//   extension/boardBridge.js       — the one declared content script, on jobsviadraft.com only
//   extension/boardOpen.js         — the worker: asks draft's server, opens the SERVER's address, binds the tab
//
// Synthetic jobs only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DRAFT = "https://jobsviadraft.com";

// ── a page window: postMessage delivers to this window's listeners, async, as a browser does ──────────────────────────
function fakeWindow({ nonce = null, origin = DRAFT } = {}) {
  const listeners = new Set();
  const opened = [];
  const posted = [];
  const win = {
    location: { origin },
    document: { documentElement: { dataset: nonce ? { draftExtension: nonce } : {} } },
    addEventListener: (t, fn) => { if (t === "message") listeners.add(fn); },
    removeEventListener: (t, fn) => { if (t === "message") listeners.delete(fn); },
    postMessage(data, targetOrigin, source = win) {
      posted.push({ data, targetOrigin });
      setTimeout(() => { for (const fn of [...listeners]) fn({ source, origin, data }); }, 0);
    },
    open: (url, target, features) => { opened.push({ url, target, features }); return {}; },
    opened, posted, listeners,
  };
  return win;
}
/** The extension's side of the page: answers each OPEN_JOB with `answer` (as boardBridge.js would). */
function extensionAnswers(win, answer, { nonce = win.document.documentElement.dataset.draftExtension } = {}) {
  win.addEventListener("message", (e) => {
    const d = e.data;
    if (d?.source === "draft-board" && d.type === "OPEN_JOB") {
      win.postMessage({ source: "draft-extension", type: "OPEN_JOB_RESULT", nonce, ...answer(d) }, win.location.origin);
    }
  });
}

const { openPosting, postingClick, extensionNonce, handOffToExtension } = await import("../client/src/lib/openPosting.js");

test("⛔ openPosting: no extension → the page opens its own link, exactly as before", async () => {
  const win = fakeWindow();
  const r = await openPosting({ jobId: "gh-1", applyUrl: "https://boards.greenhouse.io/synthco/jobs/1" }, { win });
  assert.equal(r.via, "link");
  assert.deepEqual(win.opened.map(o => o.url), ["https://boards.greenhouse.io/synthco/jobs/1"]);
  assert.match(win.opened[0].features, /noopener/);
  assert.equal(win.posted.length, 0, "nothing is posted to a page with no extension");
});

test("⛔ openPosting: with the extension it hands over a JOB ID only — never an address — and opens nothing itself", async () => {
  const win = fakeWindow({ nonce: "n-1" });
  extensionAnswers(win, () => ({ ok: true }));
  const r = await openPosting({ jobId: "gh-1", applyUrl: "https://boards.greenhouse.io/synthco/jobs/1" }, { win });
  assert.equal(r.via, "extension");
  assert.equal(win.opened.length, 0, "the extension opened it — the page must not open a second tab");
  const sent = win.posted.find(p => p.data.source === "draft-board");
  assert.deepEqual(Object.keys(sent.data).sort(), ["jobId", "nonce", "source", "type"]);
  assert.equal(sent.data.jobId, "gh-1");
  assert.equal(sent.data.nonce, "n-1");
  assert.equal(sent.targetOrigin, DRAFT, "posted to this origin only, never '*'");
  assert.doesNotMatch(JSON.stringify(sent.data), /greenhouse/, "the address is never sent");
});

test("⛔ openPosting: the extension says no (not on the board, signed out, …) → the page opens its own link", async () => {
  for (const error of ["not_on_board", "signed_out", "no_address", "rate_limited", "no_click"]) {
    const win = fakeWindow({ nonce: "n-2" });
    extensionAnswers(win, () => ({ ok: false, error }));
    const r = await openPosting({ jobId: "gh-1", url: "https://jobs.lever.co/synthco/1" }, { win });
    assert.equal(r.via, "link", error);
    assert.equal(win.opened.length, 1, error);
  }
});

test("⛔ openPosting: a reply with the wrong nonce, or from another window, is ignored — the page falls back", async () => {
  const win = fakeWindow({ nonce: "n-3" });
  extensionAnswers(win, () => ({ ok: true }), { nonce: "someone-else" });
  const r = await handOffToExtension("gh-1", { win, nonce: "n-3", timeoutMs: 60 });
  assert.deepEqual(r, { ok: false, error: "timeout" });
  const win2 = fakeWindow({ nonce: "n-4" });
  win2.addEventListener("message", (e) => {
    if (e.data?.source === "draft-board") win2.postMessage({ source: "draft-extension", type: "OPEN_JOB_RESULT", nonce: "n-4", ok: true }, DRAFT, { other: true });
  });
  assert.deepEqual(await handOffToExtension("gh-1", { win: win2, nonce: "n-4", timeoutMs: 60 }), { ok: false, error: "timeout" });
});

test("postingClick: a plain click hands over; a modified click (new tab / window) is the browser's", () => {
  const win = fakeWindow({ nonce: "n-5" });
  const ev = (o = {}) => ({ button: 0, defaultPrevented: false, prevented: false, preventDefault() { this.prevented = true; }, currentTarget: { href: "https://x.test/1" }, ...o });
  const plain = ev();
  assert.equal(postingClick({ jobId: "gh-1" }, plain, { win }), true);
  assert.equal(plain.prevented, true);
  for (const mod of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
    const e = ev(mod);
    assert.equal(postingClick({ jobId: "gh-1" }, e, { win }), false, JSON.stringify(mod));
    assert.equal(e.prevented, false);
  }
  const none = ev();
  assert.equal(postingClick({ jobId: "gh-1" }, none, { win: fakeWindow() }), false, "no extension → the link is followed");
  assert.equal(none.prevented, false);
  assert.equal(postingClick({}, ev(), { win }), false, "no job id → the link is followed");
  assert.equal(extensionNonce(win.document), "n-5");
});

// ── the content script, run as Chrome runs it: in the page's window, with chrome.runtime ─────────────────────────────
function runBridge({ origin = DRAFT, top = true, active = true, reply = { ok: true } } = {}) {
  const listeners = [];
  const toPage = [];
  const toWorker = [];
  const dataset = {};
  const win = {
    location: { origin },
    addEventListener: (t, fn) => { if (t === "message") listeners.push(fn); },
    postMessage: (data, targetOrigin) => toPage.push({ data, targetOrigin }),
  };
  win.top = top ? win : {};
  const sandbox = {
    window: win, location: win.location, document: { documentElement: { dataset } },
    navigator: { userActivation: { isActive: active } }, crypto: { randomUUID: () => "nonce-xyz" },
    chrome: { runtime: { lastError: undefined, sendMessage: (m, cb) => { toWorker.push(m); cb(reply); } } },
  };
  vm.runInNewContext(read("extension/boardBridge.js"), sandbox);
  const deliver = (data, { source = win, from = origin } = {}) => { for (const fn of listeners) fn({ source, origin: from, data }); };
  return { dataset, deliver, toPage, toWorker, win, sandbox };
}
const OPEN = (o = {}) => ({ source: "draft-board", type: "OPEN_JOB", jobId: "gh-1", nonce: "nonce-xyz", ...o });

test("⛔ boardBridge: marks the page, and forwards a job id — only a well-formed one, from this window, this origin, this nonce, during a click", () => {
  const b = runBridge();
  assert.equal(b.dataset.draftExtension, "nonce-xyz", "the page can tell the extension is here");
  const t0 = Date.now();
  b.deliver(OPEN({ at: 1, url: "https://evil.example/phish" }));
  const { at, ...fromPage } = b.toWorker[0] || {};
  assert.equal(JSON.stringify([fromPage]), JSON.stringify([{ type: "OPEN_JOB", jobId: "gh-1", via: "board" }]), "a job id and nothing else reaches the worker");
  assert.ok(Number.isFinite(at) && at >= t0 && at <= Date.now(), `…stamped with the bridge's OWN clock when the click was handed over, never the page's (${at})`);
  assert.equal(JSON.stringify(b.toPage.at(-1)), JSON.stringify({ data: { source: "draft-extension", type: "OPEN_JOB_RESULT", nonce: "nonce-xyz", ok: true }, targetOrigin: DRAFT }));

  const refused = [
    ["another window", OPEN(), { source: {} }],
    ["another origin", OPEN(), { from: "https://evil.example" }],
    ["no nonce", OPEN({ nonce: undefined })],
    ["a wrong nonce", OPEN({ nonce: "guess" })],
    ["another type", OPEN({ type: "FILL" })],
  ];
  for (const [why, data, o] of refused) {
    const r = runBridge();
    r.deliver(data, o);
    assert.equal(r.toWorker.length, 0, why);
  }
  const bad = runBridge();
  bad.deliver(OPEN({ jobId: "../../etc" }));
  bad.deliver(OPEN({ jobId: { url: "https://evil.example" } }));
  assert.equal(bad.toWorker.length, 0, "a malformed job id is never forwarded");
  const idle = runBridge({ active: false });
  idle.deliver(OPEN());
  assert.equal(idle.toWorker.length, 0, "no click, no tab: a page script cannot open tabs on its own");
  assert.equal(idle.toPage.at(-1).data.error, "no_click");
  const frame = runBridge({ top: false });
  assert.equal(frame.dataset.draftExtension, undefined, "a frame is never bridged");
});

test("⛔ boardBridge reads nothing from the page and makes no request", () => {
  const src = read("extension/boardBridge.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|querySelector|innerText|textContent|\.value\b|chrome\.storage|document\.cookie/);
});

// ── the worker ──────────────────────────────────────────────────────────────────────────────────────────────────────
const REAL_FETCH = globalThis.fetch;   // restored after each stub — the walk below needs the real one
function workerStub({ jobs = {} } = {}) {
  const session = new Map();
  const created = [];
  const requests = [];
  globalThis.chrome = {
    runtime: { id: "ext-id", getURL: (p) => `chrome-extension://ext-id/${p}` },
    storage: {
      local: { async get(k) { return k === "rmExtensionToken" || String(k).includes("Token") ? { [k]: "tok" } : {}; }, async set() {}, async remove() {} },
      session: {
        async get(k) { return session.has(k) ? { [k]: session.get(k) } : {}; },
        async set(o) { for (const [k, v] of Object.entries(o)) session.set(k, v); },
        async remove(k) { session.delete(k); },
      },
    },
    tabs: {
      async create(o) { created.push(o); return { id: 900 + created.length }; },
      async query() { return created.length ? [{ id: 900 + created.length, url: created.at(-1).url }] : []; },
    },
  };
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const id = decodeURIComponent(String(url).split("/api/extension/job/")[1] || "");
    const body = jobs[id];
    if (!body) return { ok: false, status: 404, json: async () => ({ error: "not_on_board" }) };
    return { ok: true, status: 200, json: async () => body };
  };
  return { session, created, requests };
}
const SENDER = { id: "ext-id", frameId: 0, url: `${DRAFT}/app/board`, tab: { id: 5, index: 2, url: `${DRAFT}/app/board` } };
const JOB = { job: { jobId: "gh-1", title: "Data Engineer", company: "Synthco", url: "https://boards.greenhouse.io/synthco/jobs/1", logo: null, reportPath: "/app/job/gh-1" },
              ats: { state: "ready", score: 72, band: "strong", matched: ["sql"], missing: ["dbt"] } };

test("⛔ OPEN_JOB: opens the SERVER's address for a job on the user's board, binds the tab 'board', with the report", async (t) => {
  const s = workerStub({ jobs: { "gh-1": JOB } });
  t.after(() => { delete globalThis.chrome; globalThis.fetch = REAL_FETCH; });
  const { handlers, configureBoardOpen, resetBoardOpenLimit } = await import("../extension/boardOpen.js");
  const { bindingForTab, bindingLine } = await import("../extension/tabBinding.js");
  configureBoardOpen({ serverUrl: DRAFT }); resetBoardOpenLimit();
  const r = await handlers.OPEN_JOB({ type: "OPEN_JOB", jobId: "gh-1", via: "board", url: "https://evil.example/phish" }, SENDER);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(s.created.map(c => c.url), ["https://boards.greenhouse.io/synthco/jobs/1"], "the server's address, never the page's");
  assert.equal(s.created[0].openerTabId, 5);
  assert.ok(s.requests.every(u => u.startsWith(`${DRAFT}/api/`)), "asked of draft's server only");
  const b = await bindingForTab({ id: 901, url: "https://job-boards.greenhouse.io/synthco/jobs/1" });
  assert.equal(b?.jobId, "gh-1", "bound — and the Greenhouse redirect twin keeps the binding");
  assert.equal(b.via, "board");
  assert.equal(b.board.ats.score, 72);
  assert.match(bindingLine(b), /opened from your board/);
  const popup = await handlers.BOARD_TAB({ type: "BOARD_TAB" }, { id: "ext-id", url: "chrome-extension://ext-id/popup.html" });
  assert.equal(popup.board?.jobId, "gh-1");
  assert.equal(popup.board.ats.score, 72);
  assert.deepEqual(await handlers.BOARD_TAB({ type: "BOARD_TAB" }, SENDER), { ok: false, error: "not_allowed" }, "a page never asks BOARD_TAB");
});

test("⛔ OPEN_JOB: a forged / other user's id opens nothing; only draft's top frame may ask; rate-limited", async (t) => {
  const s = workerStub({ jobs: { "gh-1": JOB, "gh-noaddr": { ...JOB, job: { ...JOB.job, jobId: "gh-noaddr", url: null } } } });
  t.after(() => { delete globalThis.chrome; globalThis.fetch = REAL_FETCH; });
  const { handlers, configureBoardOpen, resetBoardOpenLimit, OPEN_LIMIT } = await import("../extension/boardOpen.js");
  configureBoardOpen({ serverUrl: DRAFT }); resetBoardOpenLimit();
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-not-mine", via: "board" }, SENDER), { ok: false, error: "not_on_board" });
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-noaddr", via: "board" }, SENDER), { ok: false, error: "no_address" });
  for (const [why, sender] of [
    ["another site", { ...SENDER, url: "https://evil.example/", tab: { ...SENDER.tab, url: "https://evil.example/" } }],
    ["a frame", { ...SENDER, frameId: 3 }],
    ["another extension", { ...SENDER, id: "other-ext" }],
    ["an extension page (no tab)", { id: "ext-id", url: "chrome-extension://ext-id/popup.html" }],
  ]) {
    assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1", via: "board" }, sender), { ok: false, error: "not_allowed" }, why);
  }
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1" }, SENDER), { ok: false, error: "not_allowed" }, "via 'board' only");
  assert.equal(s.created.length, 0, "nothing was opened");
  resetBoardOpenLimit();
  for (let i = 0; i < OPEN_LIMIT.limit; i++) assert.equal((await handlers.OPEN_JOB({ jobId: "gh-1", via: "board" }, SENDER)).ok, true);
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1", via: "board" }, SENDER), { ok: false, error: "rate_limited" });
});

test("⛔ ONE TAB (open item 2): past its budget from the click the worker opens nothing and says too_slow — the page, still waiting, opens its own link", async (t) => {
  const s = workerStub({ jobs: { "gh-1": JOB } });
  t.after(() => { delete globalThis.chrome; globalThis.fetch = REAL_FETCH; });
  const { handlers, configureBoardOpen, resetBoardOpenLimit, OPEN_BUDGET_MS } = await import("../extension/boardOpen.js");
  configureBoardOpen({ serverUrl: DRAFT }); resetBoardOpenLimit();
  // a click handed over long ago (a cold worker, a busy machine): the page has given up waiting — nothing is opened
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1", via: "board", at: Date.now() - OPEN_BUDGET_MS - 50 }, SENDER), { ok: false, error: "too_slow" });
  // a lookup that outlasts the budget: the same
  const fast = globalThis.fetch;
  globalThis.fetch = async (u) => { await new Promise(r => setTimeout(r, OPEN_BUDGET_MS - 300)); return fast(u); };
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1", via: "board", at: Date.now() - 400 }, SENDER), { ok: false, error: "too_slow" });
  assert.equal(s.created.length, 0, "no tab — the page's own link is the one tab");
  assert.deepEqual(await bindingsOf(s), [], "and nothing bound");
  // within the budget it opens, as before; an `at` from the future is read as now
  globalThis.fetch = fast;
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1", via: "board", at: Date.now() }, SENDER), { ok: true });
  assert.deepEqual(await handlers.OPEN_JOB({ jobId: "gh-1", via: "board", at: Date.now() + 60_000 }, SENDER), { ok: true });
  assert.equal(s.created.length, 2);
  // the page waits LONGER than the budget (so the worker's answer decides), and less than Chrome's ~5 s click activation
  const page = Number(/const HANDOFF_TIMEOUT_MS = (\d+);/.exec(read("client/src/lib/openPosting.js"))?.[1]);
  assert.ok(page >= OPEN_BUDGET_MS + 1000 && page <= 4500, `the page waits ${page} ms; the worker's budget is ${OPEN_BUDGET_MS} ms`);
});
const bindingsOf = async (s) => [...s.session.keys()].filter(k => k.startsWith("bind:"));

test("⛔ the worker routes the bridge (⭐ T31: the retired popup's 'From your board — … · ATS 72' went with it; the score is the dock's ATS tab's)", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /import \{ handlers as BOARD_OPEN_HANDLERS, configureBoardOpen \} from '\.\/boardOpen\.js';/);
  assert.match(bg, /configureBoardOpen\(\{ serverUrl: RESUME_MASTER_URL \}\);\s*chrome\.runtime\.onMessage\.addListener\(\(msg, sender, sendResponse\) => \{\s*const handle = BOARD_OPEN_HANDLERS\[msg\?\.type\];/);
});

// ── every board surface opens a posting through the helper ─────────────────────────────────────────────────────────
const SRC = "client/src";
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name))
    : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []);
}
const FILES = walk(SRC).map(f => [f.replace(/\\/g, "/"), read(f)]);

test("⛔ no posting is opened with a bare window.open — every one goes through lib/openPosting.js", () => {
  // Each remaining window.open is NOT a posting, and says why here.
  const ALLOWED = {
    "client/src/lib/api.js": "printResume — a blank print window",
    "client/src/components/ByomResumeChoice.jsx": "a model host's own page (D86 BYOM)",
    "client/src/panels/IntegrationsPanel.jsx": "a model host's own page (D86 BYOM)",
    "client/src/components/AttemptResume.jsx": "the attempt's résumé PDF, when the editor cannot open (D171 FIX 4) — a file, not a posting",
    // 46i: AutoApplyContext's Open & fill now goes through openPosting (intent "apply") — the extension's lookup opens
    // apply_url || url, the same address the packet was built from, so the packet's origins still match; it left the list.
  };
  const found = FILES.filter(([, s]) => /window\.open\(/.test(s)).map(([f]) => f);
  for (const f of found) assert.ok(ALLOWED[f], `${f} opens a window directly — a posting must go through openPosting()`);
  for (const f of Object.keys(ALLOWED)) assert.ok(found.includes(f), `${f} no longer opens a window — drop it from the allow-list`);
});

test("⛔ every <a> to a posting hands over through postingClick (or is the one CompanyLink)", () => {
  const POSTING_HREF = /href=\{[^}]*(applyUrl|job\.url|\.url \|\||applyHref)[^}]*\}/;
  const misses = [];
  for (const [f, s] of FILES) {
    for (let i = s.indexOf("<a "); i !== -1; i = s.indexOf("<a ", i + 3)) {
      const end = s.indexOf("</a>", i);
      const tag = s.slice(i, end === -1 ? i + 600 : end);
      const open = tag.slice(0, tag.search(/>\s*[^\s=]/) + 1 || tag.length);
      if (POSTING_HREF.test(open) && !/postingClick\(/.test(tag)) misses.push(`${f}: ${open.slice(0, 90)}`);
    }
  }
  assert.deepEqual(misses, []);
  assert.match(read(`${SRC}/components/CompanyLink.jsx`), /postingClick\(\{ jobId, url: href \}, e, \{ url: href \}\)/);
  for (const f of ["components/JobCard.jsx", "panels/JobsPanel.jsx", "panels/DatabasePanel.jsx"]) {
    assert.match(read(`${SRC}/${f}`), /openPosting\(/, `${f} opens postings through the helper`);
  }
});

// ── the real thing: the extension, its content script, the real lookup route and the web app's real helper ─────────
const chromeBin = await findChrome();
test("⛔ J11 walk: a trusted click opens the SERVER's address bound 'via board'; no click, nothing; not on the board → the page's link — in a real Chrome", { skip: chromeBin.skip || false, timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("boardBridge", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
});
