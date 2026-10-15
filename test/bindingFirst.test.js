// ⭐ BINDING FIRST (owner 10-15) + T15 + T16 — identify and bind BEFORE anything else; one truth for "prepared"; no
// message tells the user to do the extension's work.
//
// The owner: "manual read on a new job seems logical but how would we even know if it's on the board if it is manual,
// so that has to be the first thing, binding and then the rest. and it has to work flawlessly."
//   · extension/identify.js identifyAndBind — the address → the embedded ATS form's address (≤ 3) → the page's text
//     through the capture's matcher (POST /api/extension/page) → BIND (the tab, the job's record) → only then anything.
//     Each outcome its own sentence and action; a failed identify binds nothing and prepares nothing.
//   · extension/tabState.js runFillChain — re-identifies only off the bound job's known addresses; a page naming no job
//     keeps the binding (Workday's sign-in); T15: a bound job's Fill never ends "Nothing is prepared".
//   · background.js popupContext — identify-first; the questions after it go WITH the binding.
//   · T15 — the popup's "prepared" is the server packet (made / expires / field count), never a local count.
//   · T16 — a repo-wide guard: no user-facing string instructs the user to run an earlier step.
//   · The scenario matrix runs in a REAL Chrome: test-support/walks/bindingFirst.mjs (SKIP, with the reason, without one).
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { findChrome, startApi, defaultSeed } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const W = "https://zoom.wd5.myworkdayjobs.com";
const APPLY = `${W}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
const realFetch = globalThis.fetch;

function chromeStub({ tabUrl = APPLY, tabId = 7, username = "ada" } = {}) {
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
  const out = { injected: [], fetched: [] };
  const tab = { id: tabId, url: tabUrl };
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session) },
    runtime: { id: "test", sendMessage: async () => null, getURL: (p) => `chrome-extension://test/${p}`, getManifest: () => ({ version: "0" }) },
    tabs: { query: async () => [tab] },
    scripting: { executeScript: async (x) => { out.injected.push(x); return [{ result: null }]; } },
  };
  if (username) stores.local.set("authIdentity", { authenticated: true, username });
  return { stores, out, tab };
}
const done = () => { delete globalThis.chrome; globalThis.fetch = realFetch; };
let instance = 0;
const fresh = (p) => import(`../extension/${p}?bf=${++instance}`);
const bindingsOf = (stores) => [...stores.session.keys()].filter(k => k.startsWith("bind:"));

// ── identify: the outcomes, each its own sentence and action ────────────────────────────────────────────────────────
test("⭐ identityOutcome: seven outcomes — only 'mine' and 'on_board' bind; each its own sentence and ONE action", async () => {
  chromeStub();
  const { identityOutcome, BINDS, STOPS } = await fresh("identify.js");
  const job = { known: true, jobId: "j1", title: "Software Engineer", company: "Zoom", how: "page_key" };
  const cases = [
    [{ ok: true, posting: { ...job, onBoard: true, mine: true }, kind: "job" }, "mine", true, "fill", /^On your board — Software Engineer at Zoom\.$/],
    [{ ok: true, posting: { ...job, onBoard: true, mine: false }, kind: "job" }, "on_board", true, "fill", /^On the draft board — Software Engineer at Zoom\.$/],
    // (c) a job draft once held, no longer live and never yours: "not on the board" + Capture (which links the record)
    [{ ok: true, posting: { ...job, onBoard: false, mine: false }, kind: "job" }, "not_on_board", false, "capture", /no longer on the draft board — Capture adds it/],
    [{ ok: true, posting: { known: false, title: "Robotics Engineer", company: "Newco" }, kind: "job" }, "not_on_board", false, "capture", /^Robotics Engineer at Newco isn't on draft yet — Capture adds it/],
    [{ ok: true, posting: null, kind: "not_a_job" }, "not_a_job", false, null, /doesn't look like a job posting/],
    [{ ok: true, posting: null, kind: "unread" }, "unread", false, null, /couldn't read this page/],
    [{ ok: false, error: "signed_out" }, "signed_out", false, "sign_in", /^Sign in to draft/],
    [{ ok: false, error: "rate_limited" }, "unavailable", false, "retry", /couldn't be reached/],
    [null, "unavailable", false, "retry", /couldn't be reached/],
  ];
  for (const [lookup, outcome, bind, action, words] of cases) {
    const o = identityOutcome(lookup);
    assert.equal(o.outcome, outcome, JSON.stringify(lookup));
    assert.equal(o.bind, bind, outcome);
    assert.equal(o.action, action, outcome);
    assert.match(o.message, words, outcome);
    assert.equal(BINDS.includes(o.outcome), bind);
  }
  assert.deepEqual([...STOPS], ["signed_out", "unavailable"]);
  done();
});

test("⭐ identifyAndBind: the address names the job → ONE question (no page text sent), the tab bound and the address recorded BEFORE it returns", async () => {
  const { stores, tab } = chromeStub();
  const { identifyAndBind } = await fresh("identify.js");
  const asked = [];
  let textRead = 0;
  const r = await identifyAndBind(tab, { serverUrl: "https://draft.test",
    frames: async () => ["https://job-boards.greenhouse.io/embed/job_app?token=1"],
    text: async () => { textRead++; return { ran: true, text: "Title: X" }; },
    lookup: async (_s, q) => { asked.push(q); return { ok: true, kind: "job", posting: { known: true, jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom", onBoard: true, mine: true }, ats: { state: "ready", score: 72, band: "strong" } }; } });
  assert.equal(r.outcome, "mine");
  assert.equal(asked.length, 1);
  assert.equal(asked[0].text, undefined, "the address named the job: the page's text is not sent");
  assert.deepEqual(asked[0].frameUrls, ["https://job-boards.greenhouse.io/embed/job_app?token=1"]);
  assert.equal(textRead, 0, "nor even read");
  const b = stores.session.get("bind:7");
  assert.equal(b.jobId, "wd-zoom-1");
  assert.equal(b.via, "recognised");
  assert.equal(b.ats.score, 72);
  const rec = stores.local.get("jobProgress").records["wd-zoom-1"];
  assert.ok(rec.read.at, "Page read");
  assert.ok(rec.addresses.length > 0, "this address is now one the job is known at (T14)");
  done();
});

test("⛔ identifyAndBind: a failed identify binds NOTHING and writes nothing — signed out, unreachable, not a job, unread, not on the board", async () => {
  const answers = {
    signed_out: { ok: false, error: "signed_out" },
    unavailable: { ok: false, error: "unavailable" },
    not_a_job: { ok: true, posting: null, kind: "unread" },          // the page was read (ran) and held no posting
    unread: { ok: true, posting: null, kind: "unread" },
    not_on_board: { ok: true, posting: { known: false, title: "Robotics Engineer", company: "Newco" }, kind: "job" },
  };
  for (const [outcome, answer] of Object.entries(answers)) {
    const { stores, tab } = chromeStub();
    const { identifyAndBind } = await fresh("identify.js");
    const asked = [];
    const r = await identifyAndBind(tab, { serverUrl: "https://draft.test", frames: async () => [],
      text: async () => (outcome === "not_a_job" ? { ran: true, text: "" } : outcome === "not_on_board" ? { ran: true, text: "Title: Robotics Engineer" } : { ran: false, text: "" }),
      lookup: async (_s, q) => { asked.push(q); return answer; } });
    assert.equal(r.outcome, outcome);
    assert.equal(r.bind, false);
    assert.equal(r.binding, null);
    assert.deepEqual(bindingsOf(stores), [], `${outcome} bound the tab`);
    assert.equal(stores.local.get("jobProgress"), undefined, `${outcome} wrote a progress record`);
    // the page's text is sent only when the address and the frame named nothing — and there WAS text
    assert.equal(asked.filter(q => q.text).length, outcome === "not_on_board" ? 1 : 0, outcome);
    done();
  }
});

test("⭐ lookupPage sends at most 3 http(s) frame addresses and reads `mine` and `kind`; a 401 is 'signed out'", async () => {
  const { stores } = chromeStub();
  stores.local.set("authToken", "t");
  const bodies = [];
  let status = 200;
  globalThis.fetch = async (_u, init) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify(status === 200
    ? { kind: "job", posting: { known: true, jobId: "j1", title: "T", company: "C", how: "frame", onBoard: true, mine: false }, ats: null, basis: null }
    : { error: "not_signed_in" }), { status, headers: { "content-type": "application/json" } }); };
  const { lookupPage } = await fresh("boardJob.js");
  const r = await lookupPage("https://draft.test", { url: "https://careers.employer.test/apply",
    frameUrls: ["javascript:alert(1)", "https://a.test/1", "https://b.test/2", "https://c.test/3", "https://d.test/4"] });
  assert.deepEqual(bodies[0].frameUrls, ["https://a.test/1", "https://b.test/2", "https://c.test/3"]);
  assert.equal(r.posting.mine, false);
  assert.equal(r.posting.how, "frame");
  assert.equal(r.kind, "job");
  status = 401;
  const out = await lookupPage("https://draft.test", { url: "https://careers.employer.test/apply" });
  assert.equal(out.error, "signed_out");
  done();
});

// ── the chain: identify first, re-identify only off the job's known addresses, T15 ───────────────────────────────────
test("⭐ runFillChain: identify comes BEFORE any fill or prepare; a failed identify fills and prepares NOTHING", async () => {
  chromeStub();
  const { runFillChain } = await fresh("tabState.js");
  for (const outcome of ["not_on_board", "not_a_job", "unread", "signed_out", "unavailable"]) {
    const calls = [];
    const r = await runFillChain({
      state: async () => null,
      identify: async () => { calls.push("identify"); return { outcome, bind: false, job: null, action: outcome === "not_on_board" ? "capture" : null, message: `the ${outcome} sentence` }; },
      fill: async () => { calls.push("fill"); return { ok: true }; },
      prepare: async () => { calls.push("prepare"); return { ok: true }; },
    });
    assert.deepEqual(calls, ["identify"], outcome);
    assert.equal(r.ok, false);
    assert.equal(r.reason, outcome);
    assert.equal(r.message, `the ${outcome} sentence`, "the outcome's own sentence, nothing led in front of it");
    assert.equal(r.action, outcome === "not_on_board" ? "capture" : null);
  }
  done();
});

test("⭐ runFillChain (a)(b): a bound tab re-identifies only OFF its job's known addresses; a page naming no job keeps the binding; signed out stops it; another named job stops it", async () => {
  chromeStub();
  const { runFillChain } = await fresh("tabState.js");
  const run = async (state, identity) => {
    const calls = [];
    const r = await runFillChain({ state: async () => state,
      identify: async () => { calls.push("identify"); return identity; },
      fill: async () => { calls.push("fill"); return { ok: true, message: "Filled 2 field(s)." }; },
      prepare: async () => { calls.push("prepare"); return { ok: true }; } });
    return { r, calls };
  };
  // (b) at an address the job is known at: no identify (T14's no-re-read)
  let x = await run({ jobId: "j1", atKnownAddress: true }, null);
  assert.deepEqual(x.calls, ["fill"]);
  // off its known addresses: identify first — and a page naming no job keeps the binding (Workday's sign-in)
  for (const outcome of ["not_a_job", "unread", "not_on_board"]) {
    x = await run({ jobId: "j1", atKnownAddress: false }, { outcome, bind: false, job: outcome === "not_on_board" ? { title: "Fake", company: "Co" } : null, message: "m" });
    assert.deepEqual(x.calls, ["identify", "fill"], outcome);
    assert.equal(x.r.ok, true, outcome);
  }
  // (a) a page naming ANOTHER job: identify rebinds (it bound it) and the press goes on for that job
  x = await run({ jobId: "j1", atKnownAddress: false }, { outcome: "mine", bind: true, job: { jobId: "j2" }, message: "On your board — B." });
  assert.deepEqual(x.calls, ["identify", "fill"]);
  // …but a job draft holds that is NOT live and not yours, named on a tab bound to another: stop, never fill the old one
  x = await run({ jobId: "j1", atKnownAddress: false }, { outcome: "not_on_board", bind: false, job: { jobId: "j9", title: "Old" }, action: "capture", message: "Old is no longer on the draft board — Capture adds it to your jobs." });
  assert.deepEqual(x.calls, ["identify"]);
  // draft could not ask: stop whatever the binding
  x = await run({ jobId: "j1", atKnownAddress: false }, { outcome: "signed_out", bind: false, job: null, action: "sign_in", message: "Sign in to draft…" });
  assert.deepEqual(x.calls, ["identify"]);
  assert.equal(x.r.action, "sign_in");
  done();
});

test("⛔ T15: a bound job's Fill NEVER ends 'Nothing is prepared' — expired, absent or an old server's origin_mismatch → prepare, then fill, in one press", async () => {
  chromeStub();
  const { runFillChain } = await fresh("tabState.js");
  for (const miss of [{ reason: "packet_stale", canPrepare: true, message: "The answers prepared for this page have expired — Fill prepares fresh ones before it fills." },
                      { reason: "prepare", canPrepare: true, message: "Nothing is prepared for this page yet — X is on your board, and Fill prepares your answers before it fills." },
                      { reason: "stale", canPrepare: true, message: "x" },
                      { reason: "origin_mismatch", canPrepare: false, message: "Nothing is prepared for this page." }]) {
    const calls = [];
    const r = await runFillChain({ state: async () => ({ jobId: "j1", atKnownAddress: true }), identify: async () => null,
      fill: async () => { calls.push("fill"); return { ok: false, ...miss }; },
      prepare: async () => { calls.push("prepare"); return { ok: true, prepared: true, filled: [1, 2], message: "Filled 2 field(s)." }; } });
    assert.deepEqual(calls, ["fill", "prepare"], miss.reason);
    assert.equal(r.ok, true, miss.reason);
    assert.doesNotMatch(r.message, /Nothing is prepared/, miss.reason);
    assert.equal(r.message, "Prepared your answers. Filled 2 field(s).");
  }
  // an UNBOUND tab's origin_mismatch is not prepared for (nothing says which job it is) — identify would have stopped it
  const calls = [];
  await runFillChain({ state: async () => null, identify: async () => ({ outcome: "mine", bind: true, job: { jobId: "j1" } }),
    fill: async () => { calls.push("fill"); return { ok: false, reason: "origin_mismatch" }; }, prepare: async () => { calls.push("prepare"); return { ok: true }; } });
  assert.deepEqual(calls, ["fill", "prepare"], "identify bound it: it is a bound job now");
  done();
});

test("⭐ tabStateFor says whether THIS address is one the bound job is known at", async () => {
  const { stores } = chromeStub();
  const { tabStateFor } = await fresh("tabState.js");
  const { progress } = await fresh("progress.js");
  await progress.patch({ jobId: "wd-zoom-1" }, { title: "Software Engineer", company: "Zoom", addresses: [APPLY] });
  stores.session.set("bind:7", { origin: W, jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom", via: "recognised", boundAt: Date.now(), dock: "right" });
  assert.equal((await tabStateFor({ id: 7, url: APPLY })).atKnownAddress, true);
  assert.equal((await tabStateFor({ id: 7, url: `${W}/Zoom/login` })).atKnownAddress, false, "the same site, an address the job was never seen at");
  done();
});

// ── popupContext: identify-first, then the questions WITH the binding ───────────────────────────────────────────────
test("⭐ popupContext is identify-first: identify → (stop on 'could not ask') → context + match with the binding → prepare only when bound", () => {
  const bg = read("extension/background.js");
  const ctx = bg.slice(at(bg, "async function popupContext"), at(bg, "async function previewActiveTab"));
  const i = (s) => ctx.indexOf(s);
  assert.ok(i("identifyAndBind(tab") > 0);
  assert.ok(i("identifyAndBind(tab") < i("'/api/import/context'"), "identify before the board question");
  assert.ok(i("identifyAndBind(tab") < i("pageMatchFor(RESUME_MASTER_URL, tab)"), "identify before the match");
  assert.ok(i("IDENTITY_STOPS.includes(identity.outcome)") < i("'/api/import/context'"), "a failed 'could not ask' asks nothing more");
  assert.match(ctx, /if \(origin && binding && queue\?\.canPrepare/, "prepares only for a bound tab");
  assert.match(ctx, /await notePacketState\(binding\.jobId, queue\?\.packets \|\| \[\]\)/, "T15: the server packet is what is remembered");
  assert.doesNotMatch(bg, /function pageLookup|lookupPage\(/, "one identify path — no second page lookup");
  // the chain's identify is the same function
  const hg = bg.slice(at(bg, "async function handleGatedHandoff"), at(bg, "async function reportHandoff"));
  assert.match(hg, /identify: \(\) => identifyAndBind\(tab, \{ serverUrl: RESUME_MASTER_URL \}\)/);
  assert.doesNotMatch(hg, /read: \(\) => popupContext/);
  // ⛔ consent unchanged: the popup's open never identifies (D23) — the autoRead switches never call the chain either
  assert.doesNotMatch(read("extension/popup.js").slice(0, read("extension/popup.js").indexOf("async function readPage")), /POPUP_CONTEXT/);
  assert.doesNotMatch(read("extension/autoRead.js"), /identifyAndBind|runFillChain/);
});

// ── T15: one truth for "prepared" ───────────────────────────────────────────────────────────────────────────────────
test("⭐ T15: the record keeps the SERVER packet's made / expires / field count; the popup says 'Prepared 6h ago — expired' when it has gone off", async () => {
  const { stores } = chromeStub();
  const { progress, notePacketState, notePrepared, progressLine, preparedParts, standWords } = await fresh("progress.js");
  const now = Date.now();
  await notePacketState("j1", [
    { packetId: 3, jobId: "j1", createdAt: now - 60_000, staleAfterMs: 72 * 3600_000, answerCount: 12 },
    { packetId: 2, jobId: "j1", createdAt: now - 7200_000, staleAfterMs: 72 * 3600_000, answerCount: 9 },
    { packetId: 9, jobId: "other", createdAt: now, staleAfterMs: 1, answerCount: 99 },
  ]);
  let r = await progress.get({ jobId: "j1" });
  assert.deepEqual({ ...r.prepared }, { at: now - 60_000, packetId: "3", expiresAt: now - 60_000 + 72 * 3600_000, answerCount: 12 });
  assert.match(progressLine(r, now), /Answers prepared \d\d:\d\d · 12 fields · expire /);
  // the prepare route's answer carries the packet's facts too
  await notePrepared({ ok: true, packetId: 4, job: { jobId: "j2", title: "T", company: "C" }, packet: { createdAt: now - 6 * 3600_000, expiresAt: now - 1, answerCount: 7 } });
  r = await progress.get({ jobId: "j2" });
  assert.equal(r.prepared.answerCount, 7);
  assert.deepEqual(preparedParts(r.prepared, now), ["Prepared 6h ago — expired"]);
  assert.equal(standWords(r), "Prepared — expired");
  // a record from before T15 (no expiry known) still says "Answers prepared" — never a made-up count
  assert.deepEqual(preparedParts({ at: now }, now), ["Answers prepared"]);
  // no packet listed for the job: nothing written
  assert.equal(await notePacketState("j3", []), null);
  assert.ok(!JSON.stringify(stores.local.get("jobProgress")).includes("answers\""), "counts only, never an answer");
  done();
});

test("⭐ T15 + BINDING FIRST on the server: /prepare returns the packet's facts; a live board job bound to the tab is preparable where its address names it", async (t) => {
  const api = await startApi({ seed: (db) => {
    defaultSeed(db);
    db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at,is_active)
      VALUES ('board-1','Platform Engineer','Contoso Logistics','Remote','https://jobs.contoso.test/careers/48151','https://jobs.contoso.test/careers/48151','t','hb1',unixepoch()-60,1)`).run();
  } });
  t.after(() => api.stop());
  const post = (p, body) => realFetch(`${api.origin}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  const url = "https://jobs.contoso.test/careers/48151";
  // identify: a live board job, not yet Ada's
  const id = await post("/api/extension/page", { url });
  assert.equal(id.body.posting.jobId, "board-1");
  assert.equal(id.body.posting.onBoard, true);
  assert.equal(id.body.posting.mine, false);
  // unbound, the address alone: not hers — not preparable
  const unbound = await post("/api/apply/handoff/match", { url, boundJobId: null });
  assert.equal(unbound.body.state, "not_on_board");
  assert.equal(unbound.body.canPrepare, false);
  assert.match(unbound.body.message, /Capture adds it/);
  // bound to it by the identify: the binding's rule (D99) — Prepare is offered and works
  const bound = await post("/api/apply/handoff/match", { url, boundJobId: "board-1" });
  assert.equal(bound.body.state, "prepare");
  assert.equal(bound.body.canPrepare, true);
  assert.doesNotMatch(bound.body.message, /in the draft popup|capture it first/i);
  // a hint naming ANOTHER job changes nothing for the job the address names
  assert.equal((await post("/api/apply/handoff/match", { url, boundJobId: "gh-zoom-1" })).body.state, "not_on_board");
  const prep = await post("/api/apply/prepare", { url, boundJobId: "board-1" });
  assert.equal(prep.status, 200, JSON.stringify(prep.body));
  const row = api.db.prepare("SELECT created_at, answers_json FROM apply_gate_packets WHERE id = ?").get(prep.body.packetId);
  assert.equal(prep.body.packet.createdAt, row.created_at * 1000);
  assert.equal(prep.body.packet.expiresAt, row.created_at * 1000 + 72 * 3600 * 1000);
  assert.equal(prep.body.packet.answerCount, JSON.parse(row.answers_json).answers.length, "the popup's count is the packet's");
  // and the identify request is what binding-first asks first — named by the walk's request log in a real Chrome
  assert.ok(api.requests.some(r => r.path === "/api/extension/page"));
});

// ── T16: no message tells the user to do the extension's work ───────────────────────────────────────────────────────
// A user-facing string that sends the user back to an earlier step ("press … in the draft popup", "capture it first",
// "press Read this page … then open this again"). Where the extension can do the step it does; where it truly cannot,
// the message names ONE button ("Capture adds it", "Allow draft on Greenhouse", "Read this page now").
const INSTRUCTS = [
  /in the draft popup/i,
  /capture it (first|to fill|again)/i,
  /then open (this|it) again/i,
  /press\s+[\\"“']*(Read this page|Prepare this application)/i,
  /run it again in draft/i,
  /open the (draft )?popup( again)?( on [^.'"`]{0,60})?, then/i,
];
function* codeFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", "submission", "dist", "build", "__tests__"].includes(e.name)) yield* codeFiles(p); }
    else if (/\.(m?js|jsx|html)$/.test(e.name) && !/\.test\./.test(e.name)) yield p;
  }
}
test("⛔ T16: a repo-wide guard — no user-facing string tells the user to run an earlier step", () => {
  const roots = ["extension", "routes", "services", "shared", "client/src"].filter(d => fs.existsSync(d));
  const files = [...roots.flatMap(r => [...codeFiles(r)]), "server.js"];
  const hits = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, n) => {
      const t = line.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;   // a comment describes; it is not shown
      for (const re of INSTRUCTS) if (re.test(line)) hits.push(`${f}:${n + 1}  ${t.slice(0, 140)}`);
    });
  }
  assert.deepEqual(hits, [], `instructing sentences:\n${hits.join("\n")}`);
  // the guard bites: each pattern catches the sentence it was written for
  for (const s of ["press \"Prepare this application\" in the draft popup", "capture it first.", "press Read this page in the draft popup, then open this again",
    "Run it again in Draft to prepare fresh ones.", "Open the popup on the application page, then press Copy sheet."]) {
    assert.ok(INSTRUCTS.some(re => re.test(s)), s);
  }
  // and the ONE-button sentences stay allowed
  for (const s of ["This job isn't on your board yet — Capture adds it.", "Allow draft on Greenhouse to fill it.", "Read this page now"]) {
    assert.ok(!INSTRUCTS.some(re => re.test(s)), s);
  }
});

// ── the real Chrome: the scenario matrix ───────────────────────────────────────────────────────────────────────────
const chromeBin = await findChrome();
test("⭐ BINDING FIRST in a REAL Chrome — the matrix: on your board · a board job not yet yours · not on the board → Capture · not a job · unreachable / signed out; (a) a page naming no job keeps the binding; T15 expired / absent → one press; identify before any prepare or mint",
  { skip: chromeBin.skip || false, timeout: 600000 }, async () => {
    const lines = [];
    const r = await runScenario("bindingFirst", { log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n") || lines.slice(-20).join("\n"));
  });
