// ⭐ T24 · THE INTENT MODEL — which path the user is on in a tab (WORKLOG "FIELD REPORT UPDATE 4 — 10-15", T24 governs).
//
//   extension/intentModel.js   decidePath / pathWords / localTells — pure, deterministic
//   extension/intent.js        the worker: the Draft button (INTENT_DRAFT), the dock's answer (INTENT_CHOOSE), the line
//   routes/extensionDraft.js   the server: the board's Draft (routes/apply.js startRun) + the résumé (extensionResume.start)
//
// The WORKLOG's list, each test named for it. Synthetic people and jobs only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { createExtensionDraftRouter, parseIntentSettings, INTENT_SETTINGS as SERVER_SETTINGS, INTENT_DEFAULTS as SERVER_DEFAULTS } from "../routes/extensionDraft.js";
import { createExtensionResumeService } from "../services/extensionResume.js";
import { decidePath, pathWords, localTells, PATH_QUESTION } from "../extension/intentModel.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import { INTENT_SETTINGS as EXT_SETTINGS, INTENT_DEFAULTS as EXT_DEFAULTS } from "../extension/intentSettings.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const JOB = "greenhouse::4400101";
const JOB2 = "greenhouse::4400102";

// ── the pure model ──────────────────────────────────────────────────────────────────────────────────────────────────
const FORM = { hasForm: true, signInWall: false };
const SERVER = { drafted: false, status: null, applyMode: "semi", autoLocked: true, held: false };
const SLOTS = { remaining: 10, limit: 10 };
const tells = (o = {}) => ({ control: null, boardIntent: null, pathChoice: null, sequence: {}, page: FORM, server: SERVER,
  resume: { state: "none" }, field: { present: true }, slots: SLOTS, settings: {}, ...o });

test("T24 · Draft before any fill → drafted, ONE draft queued and ONE résumé queued (two slots)", () => {
  const d = decidePath(tells({ control: "draft" }));
  assert.equal(d.mode, "drafted");
  assert.equal(d.by, "control");
  assert.equal(d.draft, "queue");
  assert.equal(d.resume, "queue");
  assert.equal(d.need, 2, "a Draft and a new generation each use one");
  assert.equal(pathWords(d).line, "Drafted — résumé queued, ready in about 40 s.", "the dock names the path");
});

test("T24 · Draft AFTER a fill with a résumé attached tracks the application and does NOT regenerate", () => {
  for (const attached of [{ resume: { state: "none", attachedOnPage: true } }, { field: { present: true, holdsFile: true } }]) {
    const d = decidePath(tells({ control: "draft", sequence: { fillStarted: true, filled: 12 }, ...attached }));
    assert.equal(d.mode, "drafted");
    assert.equal(d.draft, "track");
    assert.equal(d.resume, "skip_attached");
    assert.equal(d.need, 1, "no generation is counted");
  }
  // without one attached, a Draft after a fill still queues it — the sequence alone is not "attached"
  assert.equal(decidePath(tells({ control: "draft", sequence: { filled: 3 } })).resume, "queue");
});

test("T24 · Fill with no Draft is the manual path and never generates — the résumé waits for the row's press", () => {
  const d = decidePath(tells({ control: "fill" }));
  assert.equal(d.mode, "manual");
  assert.equal(d.draft, "none");
  assert.equal(d.resume, "on_cue");
  assert.equal(pathWords(d).line, "Filling by hand — a résumé on cue.");
  const row = decidePath(tells({ control: "resume_row", sequence: { filled: 4 } }));
  assert.equal(row.mode, "manual");
  assert.equal(row.resume, "queue", "only the row's own press starts one");
  // a fill on a tab already drafted fills THAT application
  assert.equal(decidePath(tells({ control: "fill", sequence: { draftedHere: true } })).mode, "drafted");
});

test("T24 · a résumé already known is attached, one in flight is JOINED — never a second", () => {
  const ready = decidePath(tells({ control: "draft", resume: { state: "ready" } }));
  assert.equal(ready.resume, "attach");
  assert.equal(ready.need, 1);
  const flying = decidePath(tells({ control: "draft", resume: { state: "in_flight" } }));
  assert.equal(flying.resume, "join");
  assert.equal(flying.need, 1);
  assert.match(pathWords(flying).line, /being made, ready in about 40 s/);
  assert.equal(decidePath(tells({ control: "draft", resume: { state: "made" } })).need, 1, "a version already made is reused free");
});

test("T24 · 0 of 10 slots is said BEFORE queuing; 1 left for a Draft + résumé offers the Draft alone", () => {
  const none = decidePath(tells({ control: "draft", slots: { remaining: 0, limit: 10 } }));
  assert.equal(none.refuse?.reason, "slots");
  assert.match(none.refuse.message, /0 of your 10 drafts left/);
  assert.notEqual(none.mode, "drafted");
  assert.equal(none.draft, "none");
  const one = decidePath(tells({ control: "draft", slots: { remaining: 1, limit: 10 } }));
  assert.equal(one.refuse?.reason, "slots_short");
  assert.equal(pathWords(one).buttons[0].resume, "skip", "the one button drafts it without the résumé");
  assert.equal(decidePath(tells({ control: "draft", slots: { remaining: 1, limit: 10 }, resumeAnswer: "skip" })).refuse, null);
});

test("T24 · full auto stays refused, and a portal sign-in wall gives the semi path", () => {
  assert.equal(decidePath(tells({ control: "draft" })).applyMode, "semi");
  assert.equal(decidePath(tells({ control: "draft", server: { ...SERVER, applyMode: "full", autoLocked: true } })).applyMode, "semi",
    "the server's lock holds whatever the account says");
  // were auto ever unlocked, the wall alone keeps it semi (D36's gated hand-off)
  assert.equal(decidePath(tells({ control: "draft", server: { ...SERVER, applyMode: "full", autoLocked: false } })).applyMode, "full");
  const wall = decidePath(tells({ control: "draft", page: { hasForm: true, signInWall: true }, server: { ...SERVER, applyMode: "full", autoLocked: false } }));
  assert.equal(wall.applyMode, "semi");
  assert.match(pathWords(wall).line, /sign in yourself; draft never does/);
});

test("T24 · the two settings change the behaviour", () => {
  const ask = decidePath(tells({ control: "draft", settings: { onDraft: "ask" } }));
  assert.equal(ask.resume, "ask");
  assert.equal(ask.ask?.kind, "resume");
  assert.notEqual(ask.mode, "drafted", "nothing is drafted until the answer");
  assert.equal(decidePath(tells({ control: "draft", settings: { onDraft: "ask" }, resumeAnswer: "queue" })).resume, "queue");
  assert.equal(decidePath(tells({ control: "draft", settings: { onDraft: "ask" }, resumeAnswer: "skip" })).resume, "skip_chosen");
  const never = decidePath(tells({ control: "fill", settings: { manualResume: "never" } }));
  assert.equal(never.resume, "never");
  assert.equal(pathWords(never).line, "Filling by hand — no résumé offered (your setting).");
});

test("T24 · conflicting or absent tells on a form ASK ONCE — and a remembered answer is used, never guessed", () => {
  const first = decidePath(tells());
  assert.equal(first.ask?.kind, "path");
  assert.equal(first.ask.question, PATH_QUESTION);
  assert.equal(pathWords(first).remember, true, "with Remember my choice");
  assert.equal(decidePath(tells({ boardIntent: "view" })).ask?.kind, "path", "the board said view, the page is a form — they disagree");
  assert.equal(decidePath(tells({ boardIntent: "apply" })).ask?.kind, "path", "apply says the user means to apply, not which path");
  assert.equal(decidePath(tells({ asked: true })).ask, null, "asked once");
  const manual = decidePath(tells({ settings: { remembered: "manual" } }));
  assert.equal(manual.mode, "manual");
  assert.equal(manual.ask, null);
  const drafted = decidePath(tells({ settings: { remembered: "drafted" } }));
  assert.equal(drafted.mode, null, "⛔ D17: a remembered Draft is OFFERED, never done without a press");
  assert.equal(drafted.draft, "none");
  assert.equal(pathWords(drafted).buttons[0].choice, "drafted");
  // the user's own choice on this tab and the sequence answer it without a question
  assert.equal(decidePath(tells({ pathChoice: "manual" })).mode, "manual");
  assert.equal(decidePath(tells({ sequence: { filled: 2 } })).mode, "manual");
  assert.equal(decidePath(tells({ server: { ...SERVER, drafted: true } })).mode, "drafted");
});

test("T24 · page type: a posting with no form allows only Draft — 'view'", () => {
  const d = decidePath(tells({ page: { hasForm: false } }));
  assert.equal(d.mode, "view");
  assert.equal(pathWords(d).buttons.map(b => b.choice).join(), "drafted");
  assert.equal(decidePath(tells({ page: { hasForm: null }, boardIntent: "view" })).mode, "view");
  assert.equal(decidePath(tells({ page: { hasForm: null } })).mode, null, "not enough to say");
});

test("⛔ T24 · deterministic: the same tells give the same path, and the model reads no clock, no randomness, no history", () => {
  const t = tells({ control: "draft", resume: { state: "in_flight" } });
  assert.deepEqual(decidePath(t), decidePath(structuredClone(t)));
  const src = read("extension/intentModel.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /Date\.now|new Date|Math\.random|chrome\.|fetch\(|localStorage|^import /m);
});

test("T24 · the board's intent reaches the tab's tells through the binding", () => {
  assert.equal(localTells({ binding: { via: "board", board: { intent: "apply" } } }).boardIntent, "apply");
  assert.equal(localTells({ binding: { via: "board", board: {} } }).boardIntent, "view", "a board tab with no word is 'view'");
  assert.equal(localTells({ binding: { via: "capture" } }).boardIntent, null);
  assert.equal(localTells({ binding: { path: "manual" } }).pathChoice, "manual");
  assert.equal(localTells({ record: { drafted: { at: 1 }, filled: { n: 3 } } }).sequence.draftedHere, true);
});

test("T24 · the extension's settings vocabulary is the server's", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(EXT_SETTINGS)), JSON.parse(JSON.stringify(SERVER_SETTINGS)));
  assert.deepEqual({ ...EXT_DEFAULTS }, { ...SERVER_DEFAULTS });
  assert.deepEqual(parseIntentSettings(null), { onDraft: "queue", manualResume: "on_cue", remembered: null });
  assert.deepEqual(parseIntentSettings('{"onDraft":"ask","manualResume":"sometimes"}'), { onDraft: "ask", manualResume: "on_cue", remembered: null });
});

// ── the bridge: the board's apply vs view ─────────────────────────────────────────────────────────────────────────
function runBridge(reply = { ok: true }) {
  const listeners = [];
  const toWorker = [];
  const win = { location: { origin: "https://jobsviadraft.com" }, addEventListener: (t, fn) => { if (t === "message") listeners.push(fn); }, postMessage: () => {} };
  win.top = win;
  vm.runInNewContext(read("extension/boardBridge.js"), {
    window: win, location: win.location, document: { documentElement: { dataset: {} } },
    navigator: { userActivation: { isActive: true } }, crypto: { randomUUID: () => "n-24" },
    chrome: { runtime: { lastError: undefined, sendMessage: (m, cb) => { toWorker.push(m); cb(reply); } } },
  });
  const deliver = (data) => { for (const fn of listeners) fn({ source: win, origin: win.location.origin, data }); };
  return { deliver, toWorker };
}

test("T24 · the board's apply vs view intent is carried by the bridge — one word, and junk is dropped", async () => {
  const b = runBridge();
  const open = (o) => ({ source: "draft-board", type: "OPEN_JOB", jobId: "gh-24", nonce: "n-24", ...o });
  b.deliver(open({ intent: "apply" }));
  b.deliver(open({ intent: "view" }));
  b.deliver(open({ intent: "https://evil.example" }));
  b.deliver(open({}));
  assert.equal(JSON.stringify(b.toWorker.map(m => m.intent ?? null)), JSON.stringify(["apply", "view", null, null]));
  // the board page: "apply" is sent, the default "view" is sent as nothing (an Open posting is unchanged)
  const { handOffToExtension } = await import("../client/src/lib/openPosting.js");
  const posted = [];
  const win = { location: { origin: "https://jobsviadraft.com" }, addEventListener() {}, removeEventListener() {}, postMessage: (d) => posted.push(d) };
  void handOffToExtension("gh-24", { win, nonce: "n", timeoutMs: 5, intent: "apply" });
  void handOffToExtension("gh-24", { win, nonce: "n", timeoutMs: 5, intent: "view" });
  void handOffToExtension("gh-24", { win, nonce: "n", timeoutMs: 5 });
  assert.deepEqual(posted.map(p => p.intent ?? null), ["apply", null, null]);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /label: "Apply yourself", href: row\.applyUrl, onClick: \(e\) => postingClick\(row, e, \{ intent: "apply" \}\)/);
});

const REAL_FETCH = globalThis.fetch;
function chromeStub({ jobs = {} } = {}) {
  const session = new Map();
  const local = new Map();
  const created = [];
  globalThis.chrome = {
    runtime: { id: "ext-id", getURL: (p) => `chrome-extension://ext-id/${p}`, lastError: undefined },
    storage: {
      local: { async get(k) { return String(k).includes("Token") ? { [k]: "tok" } : local.has(k) ? { [k]: local.get(k) } : {}; },
               async set(o) { for (const [k, v] of Object.entries(o)) local.set(k, v); }, async remove(k) { local.delete(k); } },
      session: { async get(k) { return session.has(k) ? { [k]: session.get(k) } : {}; },
                 async set(o) { for (const [k, v] of Object.entries(o)) session.set(k, v); }, async remove(k) { session.delete(k); } },
    },
    tabs: { async create(o) { created.push(o); return { id: 700 + created.length }; }, async query() { return []; } },
  };
  globalThis.fetch = async (url) => {
    const id = decodeURIComponent(String(url).split("/api/extension/job/")[1] || "");
    const body = jobs[id];
    if (!body) return { ok: false, status: 404, json: async () => ({ error: "not_on_board" }) };
    return { ok: true, status: 200, json: async () => body };
  };
  return { session, created };
}

test("T24 · through the bridge the board's intent sets the tab's TabState: apply → intent apply; view → mode 'view' on a posting", async (t) => {
  const s = chromeStub({ jobs: { "gh-24": { job: { jobId: "gh-24", title: "Data Engineer", company: "Synthco", url: "https://boards.greenhouse.io/synthco/jobs/24" }, ats: null } } });
  t.after(() => { delete globalThis.chrome; globalThis.fetch = REAL_FETCH; });
  const { handlers, configureBoardOpen, resetBoardOpenLimit } = await import("../extension/boardOpen.js");
  const { tabStateFor } = await import("../extension/tabState.js");
  configureBoardOpen({ serverUrl: "https://jobsviadraft.com" });
  const SENDER = { id: "ext-id", frameId: 0, url: "https://jobsviadraft.com/app/board", tab: { id: 5, index: 1, url: "https://jobsviadraft.com/app/board" } };
  resetBoardOpenLimit();
  assert.deepEqual(await handlers.OPEN_JOB({ type: "OPEN_JOB", jobId: "gh-24", via: "board", intent: "apply" }, SENDER), { ok: true });
  const applyTab = { id: 701, url: "https://boards.greenhouse.io/synthco/jobs/24" };
  const a = await tabStateFor(applyTab, { adopt: false });
  assert.equal(a.intent, "apply");
  assert.equal(s.session.get("bind:701").board.intent, "apply");
  assert.deepEqual(await handlers.OPEN_JOB({ type: "OPEN_JOB", jobId: "gh-24", via: "board" }, SENDER), { ok: true });
  const v = await tabStateFor({ id: 702, url: "https://boards.greenhouse.io/synthco/jobs/24" }, { adopt: false });
  assert.equal(v.intent, "view");
  assert.equal(v.mode, "view", "a tab the board opened to VIEW is on the view path");
  assert.notEqual(a.mode, "view", "…and one it opened to APPLY is not");
});

// ── the worker: one press, the right calls ────────────────────────────────────────────────────────────────────────
function fakeDeps({ server = {}, draftReply = null, record = null, probe = { controls: 6, signInWall: false, files: [{ label: "Resume/CV", name: "resume", id: "", required: true, holdsFile: false }] } } = {}) {
  const calls = { draft: [], draw: [], saved: [], paths: [], drafted: [], resumes: [] };
  let state = { drafted: false, ...server.draft };
  const answer = () => ({ status: 200, body: { ok: true, draft: { drafted: state.drafted, status: state.drafted ? "queued" : null },
    resume: { state: server.resume || (state.drafted ? "in_flight" : "none") }, slots: server.slots || { remaining: 10, limit: 10 },
    applyMode: "semi", autoLocked: true, held: false, settings: server.settings || {} } });
  let binding = { jobId: JOB, via: "recognised" };
  const deps = {
    tabState: async () => ({ jobId: JOB, title: "Backend Engineer", company: "Synthco" }),
    identify: async () => null,
    binding: async () => binding,
    record: async () => record,
    probe: async () => probe,
    serverTells: async () => answer(),
    draft: async (jobId, o) => {
      calls.draft.push({ jobId, ...o });
      if (draftReply) return draftReply;
      if (state.drafted) return { status: 200, body: { ok: true, already: true, resume: { state: "in_flight" } } };
      state = { drafted: true };
      return { status: 202, body: { ok: true, draft: { runId: 1, waiting: false }, resume: o.resume ? { id: "erg_" + "a".repeat(24), status: "queued" } : null } };
    },
    settings: async () => ({ onDraft: "queue", manualResume: "on_cue", remembered: null }),
    saveSettings: async (p) => { calls.saved.push(p); return p; },
    setPath: async (_tab, p) => { calls.paths.push(p); binding = { ...binding, path: p }; },
    noteDrafted: async (j) => { calls.drafted.push(j); },
    noteResume: async (j, r) => { calls.resumes.push(r); },
    draw: async (_tab, w) => { calls.draw.push(w); },
  };
  return { deps, calls };
}
const TAB = { id: 42, url: "https://boards.greenhouse.io/synthco/jobs/4400101" };

test("T24 · the Draft button: ONE draft with ONE résumé; a second press queues nothing more", async () => {
  const { runDraft, resetIntentMemory } = await import("../extension/intent.js");
  resetIntentMemory();
  const { deps, calls } = fakeDeps();
  const first = await runDraft(TAB, { control: "draft" }, deps);
  assert.equal(first.ok, true, first.message);
  assert.deepEqual(calls.draft, [{ jobId: JOB, resume: true }], "one Draft, with its résumé");
  assert.equal(calls.resumes.length, 1);
  assert.deepEqual(calls.paths, ["drafted"]);
  assert.equal(calls.draw.at(-1).line, "Drafted — résumé queued, ready in about 40 s.", "the dock names the path");
  const second = await runDraft(TAB, { control: "draft" }, deps);
  assert.equal(second.already, true);
  assert.equal(calls.draft.length, 1, "the server said drafted — the second press sends nothing");
  assert.match(calls.draw.at(-1).line, /^Drafted — in Draft House — its résumé is being made/);
});

test("T24 · 0 of 10 slots: said on the dock, and nothing is sent", async () => {
  const { runDraft } = await import("../extension/intent.js");
  const { deps, calls } = fakeDeps({ server: { slots: { remaining: 0, limit: 10 } } });
  const r = await runDraft(TAB, { control: "draft" }, deps);
  assert.equal(r.ok, false);
  assert.match(r.message, /0 of your 10 drafts left/);
  assert.equal(calls.draft.length, 0);
  assert.equal(calls.draw.at(-1).tone, "refuse");
});

test("T24 · Draft after a fill with the résumé attached sends resume:false — the attached file is never regenerated", async () => {
  const { runDraft } = await import("../extension/intent.js");
  const { deps, calls } = fakeDeps({ record: { filled: { n: 9, of: 12 }, resume: { id: "erg_" + "b".repeat(24), attached: 5 } } });
  const r = await runDraft(TAB, { control: "draft" }, deps);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(calls.draft, [{ jobId: JOB, resume: false }]);
  assert.match(calls.draw.at(-1).line, /tracking this application — the résumé already attached stays/);
});

test("T24 · a fill never drafts and never generates; the dock says the manual path (and 'never' when set)", async () => {
  const { showPath } = await import("../extension/intent.js");
  const { deps, calls } = fakeDeps({ record: { filled: { n: 3, of: 12 } } });
  const r = await showPath(TAB, { control: "fill" }, deps);
  assert.equal(r.decision.mode, "manual");
  assert.equal(calls.draft.length, 0);
  assert.equal(calls.draw.at(-1).line, "Filling by hand — a résumé on cue.");
  const never = fakeDeps({ server: { settings: { manualResume: "never" } } });
  await showPath(TAB, { control: "fill" }, never.deps);
  assert.equal(never.calls.draw.at(-1).line, "Filling by hand — no résumé offered (your setting).");
});

test("T24 · onDraft 'ask': the Draft press asks first, queues only on the answer", async () => {
  const { runDraft, choose } = await import("../extension/intent.js");
  const { deps, calls } = fakeDeps({ server: { settings: { onDraft: "ask" } } });
  const asked = await runDraft(TAB, { control: "draft" }, deps);
  assert.equal(asked.asked, true);
  assert.equal(calls.draft.length, 0, "nothing until the answer");
  const r = await choose(TAB, { choice: "drafted", resume: "skip" }, deps);
  assert.equal(r.ok, true, r.message);
  assert.deepEqual(calls.draft, [{ jobId: JOB, resume: false }]);
});

test("T24 · the dock asks ONCE on an application form, and Remember keeps the answer with the account", async () => {
  const { showPath, choose, resetIntentMemory } = await import("../extension/intent.js");
  resetIntentMemory();
  const { deps, calls } = fakeDeps();
  const first = await showPath(TAB, {}, deps);
  assert.equal(first.decision.ask?.kind, "path");
  assert.equal(calls.draw.at(-1).line, PATH_QUESTION);
  const again = await showPath(TAB, {}, deps);
  assert.equal(again.decision.ask, null, "asked once");
  const r = await choose(TAB, { choice: "manual", remember: true }, deps);
  assert.equal(r.ok, true);
  assert.deepEqual(calls.saved, [{ remembered: "manual" }]);
  assert.deepEqual(calls.paths, ["manual"]);
  assert.equal(calls.draft.length, 0);
  assert.equal(calls.draw.at(-1).line, "Filling by hand — a résumé on cue.");
});

test("⛔ T24 · the worker's messages: Draft from the popup only, the answer from the dock's own click only", async (t) => {
  chromeStub();
  t.after(() => { delete globalThis.chrome; globalThis.fetch = REAL_FETCH; });
  const { handlers } = await import("../extension/intent.js");
  const page = { id: "ext-id", frameId: 0, url: "https://evil.example/", tab: { id: 3, url: "https://evil.example/" } };
  assert.deepEqual(await handlers.INTENT_DRAFT({ type: "INTENT_DRAFT", trigger: "click" }, page), { ok: false, error: "not_allowed" });
  assert.deepEqual(await handlers.INTENT_DRAFT({ type: "INTENT_DRAFT" }, { id: "ext-id", url: "chrome-extension://ext-id/popup.html" }), { ok: false, error: "not_allowed" });
  assert.deepEqual(await handlers.INTENT_CHOOSE({ type: "INTENT_CHOOSE", choice: "drafted" }, page), { ok: false, error: "not_allowed" }, "no click");
  assert.deepEqual(await handlers.INTENT_CHOOSE({ type: "INTENT_CHOOSE", choice: "drafted", trigger: "click" }, { ...page, frameId: 3 }), { ok: false, error: "not_allowed" }, "a child frame");
  assert.deepEqual(await handlers.INTENT_SETTINGS({ type: "INTENT_SETTINGS" }, page), { ok: false, error: "not_allowed" });
  // the dock's buttons answer only a TRUSTED click
  // ⭐ T27: the line is the dock's popup — its press reaches the answer with isTrusted, and a script's click is ignored
  assert.match(read("extension/intent.js"), /if \(!answer\.trusted\) return 'ignore';/);
});

test("⛔ T24 · Draft drafts — the toolbar press's Draft (⭐ T31: the retired popup's button) runs the same runDraft; the fill's résumé row reads the account's setting", () => {
  assert.match(read("extension/background.js"), /draft: async \(tab\) => \{ const r = await runDraft\(tab, \{ control: 'draft' \}\);/);
  const gh = read("extension/gated-handoff.js");
  assert.match(gh, /const setting = opts\.resumeOnCue \|\| await resumeOnCueSetting\(serverUrl\)/);
  // ⛔ the extension never asks for no review
  for (const f of ["extension/intent.js", "extension/intentModel.js", "extension/toolbarPress.js"]) assert.doesNotMatch(read(f).replace(/^\s*\/\/.*$/gm, ""), /approvalMode/);
});

// ── the server: the board's Draft, one implementation ─────────────────────────────────────────────────────────────
function serverFixture({ holdUser = true, hasBase = true } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash, plan_tier) VALUES (1, 'synthetic-ada', 'x', 'PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id, user_id, profile_name, role_family, domain, is_active) VALUES (10, 1, 'SWE', 'engineering', 'software', 1)").run();
  db.prepare("INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (1, 'Ada', 'Synthetic', 'ada@example.test')").run();
  if (hasBase) {
    db.prepare("INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at) VALUES (10, 1, 'r.txt', ?, unixepoch())")
      .run("Ada Synthetic — Backend engineer. Built payment APIs in Go and Postgres for five years; led a team of four. ".repeat(3));
  }
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, title, company, location, url, apply_url, search_query, _hash, discovered_at, is_active)
                          VALUES (?, ?, 'Synthco', 'Remote', ?, ?, 't', ?, unixepoch(), 1)`);
  ins.run(JOB, "Backend Engineer", "https://boards.greenhouse.io/synthco/jobs/4400101", "https://boards.greenhouse.io/synthco/jobs/4400101", "h1");
  ins.run(JOB2, "Platform Engineer", "https://boards.greenhouse.io/synthco/jobs/4400102", "https://boards.greenhouse.io/synthco/jobs/4400102", "h2");
  // a held line: the Draft is admitted and WAITS — no browser is ever started by these tests
  if (holdUser) db.prepare("INSERT INTO app_settings (key, value) VALUES ('apply_user_hold:1', '1')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  const hooks = applyRoutes(app, db, (_req, _res, next) => next(), noop, noop, noop, noop);
  const resume = createExtensionResumeService({ db, generate: async () => { throw new Error("never in these tests"); },
    renderPdf: async () => Buffer.from("%PDF"), defer: () => {}, log: { error() {}, warn() {} } });
  app.use(createExtensionDraftRouter({ db, requireAuth: (_req, _res, next) => next(), isExtension: (req) => req.headers["x-test-extension"] === "1",
    draftForExtension: hooks.draftForExtension, draftStateOf: hooks.draftStateOf, runBar: hooks.runBar, resume }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, body, ext = true) => fetch(`${base}${path}`, { method,
    headers: { "content-type": "application/json", ...(ext ? { "x-test-extension": "1" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
  const count = (sql) => db.prepare(sql).pluck().get();
  return { db, call, count, resume, close: () => server.close() };
}

test("⭐ T24 · server: Draft before any fill queues exactly ONE drafted application and ONE generation; a second Draft queues nothing more", async () => {
  const f = serverFixture();
  try {
    const r = await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click" });
    assert.equal(r.status, 202, JSON.stringify(r.body));
    assert.equal(f.count("SELECT COUNT(*) FROM apply_run_jobs WHERE job_id = 'greenhouse::4400101'"), 1);
    assert.equal(f.count("SELECT COUNT(*) FROM extension_resume_generations WHERE job_id = 'greenhouse::4400101'"), 1);
    assert.equal(f.count("SELECT approval_mode FROM apply_runs"), "required", "⛔ it waits for review — the board's Draft");
    assert.equal(r.body.slots.used, 2, "a Draft and a generation: two of the ten");
    assert.equal(r.body.applyMode, "semi");
    assert.equal(r.body.autoLocked, false, "D100: AUTO is the user's to choose (no proof lock); this Draft still waits");
    assert.match(r.body.resume.id, /^erg_/);
    const again = await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click" });
    assert.equal(again.status, 200);
    assert.equal(again.body.already, true);
    assert.equal(f.count("SELECT COUNT(*) FROM apply_run_jobs"), 1, "never queued twice");
    assert.equal(f.count("SELECT COUNT(*) FROM extension_resume_generations"), 1, "never a second generation");
    assert.equal(f.count("SELECT COUNT(*) FROM draft_slot_uses"), 1);
    // the tells the extension reads
    const t = await f.call("GET", `/api/extension/draft/${encodeURIComponent(JOB)}`);
    assert.equal(t.body.draft.drafted, true);
    assert.equal(t.body.resume.state, "in_flight");
  } finally { f.close(); }
});

test("⭐ T24 · server: a generation in flight is JOINED — the Draft spends one slot, not two", async () => {
  const f = serverFixture();
  try {
    const g = f.resume.start(1, { jobId: JOB });
    assert.equal(g.status, 202);
    assert.equal((await f.call("GET", `/api/extension/draft/${encodeURIComponent(JOB)}`)).body.resume.state, "in_flight");
    const r = await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click" });
    assert.equal(r.status, 202, JSON.stringify(r.body));
    assert.equal(r.body.resume.id, g.body.id, "the same generation");
    assert.equal(r.body.resume.alreadyRequested, true);
    assert.equal(f.count("SELECT COUNT(*) FROM extension_resume_generations"), 1);
    assert.equal(r.body.slots.used, 2, "the generation's one + the Draft's one");
  } finally { f.close(); }
});

test("⭐ T24 · server: 0 of 10 slots is said BEFORE queuing — nothing is written", async () => {
  const f = serverFixture();
  try {
    const ins = f.db.prepare("INSERT INTO draft_slot_uses (user_id, kind, job_id) VALUES (1, 'generate', ?)");
    for (let i = 0; i < 10; i++) ins.run(`other-${i}`);
    const r = await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click" });
    assert.equal(r.status, 429);
    assert.equal(r.body.error, "draft_slots_exhausted");
    assert.match(r.body.message, /You have 0 of your 10 drafts left/);
    assert.equal(f.count("SELECT COUNT(*) FROM apply_run_jobs"), 0);
    assert.equal(f.count("SELECT COUNT(*) FROM extension_resume_generations"), 0);
    // one left: the Draft + a NEW résumé need two — said, with the Draft alone offered; resume:false then drafts
    f.db.prepare("DELETE FROM draft_slot_uses WHERE job_id = 'other-0'").run();
    const short = await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click" });
    assert.equal(short.body.error, "draft_slots_short");
    assert.equal(short.body.canDraftOnly, true);
    assert.equal(f.count("SELECT COUNT(*) FROM apply_run_jobs"), 0);
    const only = await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click", resume: false });
    assert.equal(only.status, 202, JSON.stringify(only.body));
    assert.equal(only.body.resumeSkipped, "not_asked");
    assert.equal(f.count("SELECT COUNT(*) FROM extension_resume_generations"), 0);
  } finally { f.close(); }
});

test("⛔ T24 · server: full auto is still refused — the extension's surface may not ask for no review, and its Draft never does", async () => {
  const f = serverFixture();
  try {
    const r = await f.call("POST", "/api/apply/runs", { jobIds: [JOB2], mode: "auto", surface: "extension", approvalMode: "auto" });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "approval_mode_forbidden_for_surface");
    const plain = await f.call("POST", "/api/apply/runs", { jobIds: [JOB2], mode: "auto", approvalMode: "auto" });
    assert.equal(plain.status, 403, "D100: a user in SEMI (the default) — the check is the server's");
    assert.equal(plain.body.error, "full_auto_not_chosen");
    const src = read("routes/extensionDraft.js");
    assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /approvalMode/, "the extension's Draft never names one");
    assert.match(read("routes/apply.js"), /const draftForExtension = \(user, jobId\) =>\n\s+startRun\(user\.id, normalisePlanTier\(user\?\.planTier\), \[String\(jobId\)\], \{ mode: "auto" \}\);/);
  } finally { f.close(); }
});

test("⛔ T24 · server: a click only, the extension only, the user's own job only", async () => {
  const f = serverFixture();
  try {
    assert.equal((await f.call("POST", "/api/extension/draft", { boundJobId: JOB })).body.error, "trigger_required");
    assert.equal((await f.call("POST", "/api/extension/draft", { boundJobId: JOB, trigger: "click" }, false)).status, 403);
    assert.equal((await f.call("POST", "/api/extension/draft", { boundJobId: "greenhouse::nope", trigger: "click" })).body.error, "not_your_job");
    assert.equal(f.count("SELECT COUNT(*) FROM apply_run_jobs"), 0);
  } finally { f.close(); }
});

test("T24 · server: the two settings live with the account — defaults, a merged PUT, a bad value refused and nothing half-stored", async () => {
  const f = serverFixture();
  try {
    assert.deepEqual((await f.call("GET", "/api/settings/extension-intent", undefined, false)).body, { onDraft: "queue", manualResume: "on_cue", remembered: null });
    assert.deepEqual((await f.call("PUT", "/api/settings/extension-intent", { onDraft: "ask" }, false)).body, { onDraft: "ask", manualResume: "on_cue", remembered: null });
    const bad = await f.call("PUT", "/api/settings/extension-intent", { manualResume: "never", remembered: "always" }, false);
    assert.equal(bad.status, 400);
    assert.deepEqual((await f.call("GET", "/api/settings/extension-intent", undefined, false)).body.manualResume, "on_cue", "nothing half-stored");
    await f.call("PUT", "/api/settings/extension-intent", { remembered: "manual" }, false);
    assert.equal((await f.call("GET", `/api/extension/draft/${encodeURIComponent(JOB)}`)).body.settings.remembered, "manual");
  } finally { f.close(); }
});

test("T24 · migration 168 is additive and byte-identical in both runners; no new browser storage key", () => {
  const raw = (p) => fs.readFileSync(p, "utf8");
  const id = "168_extension_intent_settings";
  const block = (s) => { const i = at(s, `      id: "${id}"`); return s.slice(lastAt(s, "    {", i), at(s, "\n    },", i)); };
  assert.equal(block(raw("server.js")), block(raw("scripts/migrations.js")));
  assert.match(block(raw("scripts/migrations.js")), /ALTER TABLE users ADD COLUMN extension_intent TEXT;/);
  assert.doesNotMatch(block(raw("server.js")), /\bDROP\b|DELETE FROM|UPDATE \w+ SET/i);
  const ids = MIGRATIONS.map(m => m.id);
  assert.equal(ids[ids.indexOf(id) - 1], "167_extension_resume_cause", "the next number after the highest at the time");
  for (const f of ["extension/intent.js", "extension/intentModel.js", "extension/intentSettings.js", "extension/options-intent.js"]) {
    assert.doesNotMatch(read(f).replace(/^\s*\/\/.*$/gm, ""), /chrome\.storage|localStorage/, `${f} keeps nothing in the browser`);
  }
});

// ── the real thing: the extension in a real Chrome, the real Draft route, the dock's own clicks ──────────────────────
const { findChrome } = await import("../test-support/extensionBrowser.mjs");
const { runScenario } = await import("../test-support/walkExtension.mjs");
const chromeBin = await findChrome();
test("⭐ T24 walk: the dock asks once and remembers with the account; ONE application and ONE résumé; a second Draft queues nothing; the switch — in a real Chrome",
  { skip: chromeBin.skip || false, timeout: 300000 }, async () => {
    const lines = [];
    const r = await runScenario("intentPath", { log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
  });
