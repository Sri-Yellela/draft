// T13 + T14 (field report 10-14) · ONE PRESS DOES THE WHOLE CHAIN, AND A TAB FOR THE SAME JOB KNOWS IT AT ONCE.
//
// The owner, on Stripe's application page: "opened the application, still have to read the page, still have to capture
// it on every open, still have to click prepare answers, clicking fill and it still fails."
//   · T13 — pressing Fill (the popup's button or Ctrl+Shift+Y) reads the page if the tab does not know its job, prepares
//     if nothing is prepared, then fills, and says what it did; "Read this page" also prepares. Consent unchanged: only
//     the press runs the chain; the automatic switches call the handoff directly (extension/tabState.js runFillChain).
//   · T14 — a new tab, a new application URL or a reopened popup for the SAME job binds at once (tabState.js
//     tabStateFor; the job's seen addresses, tabBinding.js addressClaim / knownJobForAddress) and asks for no capture,
//     read or prepare again — a local comparison: no page read, no request (D23).
//   · The scenario rows (36) "a new tab for the same job — no re-capture, no re-read" and (37) "Fill from a cold tab with
//     every auto switch off" run in a REAL Chrome: test-support/walks/fillChain.mjs (SKIP, with the reason, without one).
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const W = "https://zoom.wd5.myworkdayjobs.com";
const POSTING = `${W}/Zoom/job/Remote--(US)/Software-Engineer_R19749-1`;
const APPLY = `${W}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
const STRIPE = "https://stripe.com/careers/listing/software-engineer-backend/8198280?gh_jid=8198280";

const realFetch = globalThis.fetch;
const done = () => { delete globalThis.chrome; globalThis.fetch = realFetch; };
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
  const out = { messages: [], injected: [], fetched: [] };
  const tab = { id: tabId, url: tabUrl };
  globalThis.chrome = {
    storage: { local: area(stores.local), session: area(stores.session) },
    runtime: { id: "test", sendMessage: async (m) => { out.messages.push(m); return null; }, getURL: (p) => `chrome-extension://test/${p}` },
    tabs: { query: async () => [tab] },
    scripting: { executeScript: async (x) => { out.injected.push(x); return [{ result: null }]; } },
  };
  globalThis.fetch = async (u) => { out.fetched.push(String(u)); throw new Error("no network in this test"); };
  if (username) stores.local.set("authIdentity", { authenticated: true, username });
  return { stores, out, tab };
}
let instance = 0;
const fresh = (p) => import(`../extension/${p}?i=${++instance}`);

// ── T13 · the chain, step by step (pure: every step injected) ─────────────────────────────────────────────────────
test("⛔ T13: Fill from a COLD tab reads, prepares and fills in ONE press — and says what it did", async () => {
  chromeStub();
  const { runFillChain } = await fresh("tabState.js");
  const calls = [];
  const r = await runFillChain({
    state: async () => { calls.push("state"); return null; },                       // the tab does not know its job
    // ⭐ BINDING FIRST: the read IS the identify — it binds before anything else (extension/identify.js)
    identify: async () => { calls.push("identify"); return { outcome: "mine", bind: true, job: { jobId: "j1" } }; },
    fill: async () => { calls.push("fill"); return { ok: false, reason: "prepare", canPrepare: true, message: "Nothing is prepared for this page yet." }; },
    prepare: async () => { calls.push("prepare"); return { ok: true, prepared: true, filled: [1, 2, 3], message: "Filled 3 field(s) across 1 step(s)." }; },
  });
  assert.deepEqual(calls, ["state", "identify", "fill", "prepare"], "identify → fill → prepare-and-fill, in that order, each once");
  assert.equal(r.ok, true);
  assert.deepEqual(r.did, ["read", "prepared"]);
  assert.equal(r.message, "Read this page and prepared your answers. Filled 3 field(s) across 1 step(s).");
  assert.equal(r.fillMessage, "Filled 3 field(s) across 1 step(s).");
  done();
});

test("⛔ T13: \"Read this page\" leaves the answers prepared — the Fill that follows prepares nothing again", async () => {
  chromeStub();
  const { runFillChain } = await fresh("tabState.js");
  const calls = [];
  // after Read (which bound the tab, noted this address and prepared), the Fill on that page identifies nothing again
  // and prepares nothing again — a packet already fills it
  const r = await runFillChain({
    state: async () => ({ jobId: "j1", atKnownAddress: true }),
    identify: async () => { calls.push("identify"); return null; },
    fill: async () => { calls.push("fill"); return { ok: true, filled: [1], message: "Filled 1 field(s)." }; },
    prepare: async () => { calls.push("prepare"); return { ok: true }; },
  });
  assert.deepEqual(calls, ["fill"]);
  assert.deepEqual(r.did, []);
  // and popupContext really prepares: after the read binds the tab, a job of yours with nothing (or something stale)
  // prepared is prepared — fill:false — and the queue re-read so the popup offers Fill
  const bg = read("extension/background.js");
  const ctx = bg.slice(at(bg, "async function popupContext"), at(bg, "async function previewActiveTab"));
  assert.match(ctx, /queue\?\.canPrepare && \(queue\.state === 'prepare' \|\| queue\.state === 'stale'\)/);
  assert.match(ctx, /prepareAndFill\(\{ serverUrl: RESUME_MASTER_URL, tab, fill: false \}\)/, "Read prepares and does NOT fill");
  assert.match(ctx, /url, origin, prepared,/, "the popup is told the read prepared");
  done();
});

test("⛔ T13: a page with no application form says WHY — and where the prepared answers wait", async () => {
  chromeStub();
  const { runFillChain, chainMessage } = await fresh("tabState.js");
  const r = await runFillChain({
    state: async () => null, identify: async () => ({ outcome: "mine", bind: true, job: { jobId: "j1" } }),
    fill: async () => ({ ok: false, reason: "no_form", prepared: true, message: "No application form found on this page. Nothing was released." }),
    prepare: async () => { throw new Error("must not prepare on a page with no form"); },
  });
  assert.equal(r.ok, false);
  assert.match(r.message, /No application form found on this page/);
  assert.match(r.message, /Your answers are prepared — open the application form and press Fill there\./);
  // T11e's sentence (the other lane) passes through as the server / handoff words it — never replaced
  assert.equal(chainMessage([], { ok: false, reason: "frame_needs_permission", message: "This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it." }),
    "This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it.");
  done();
});

test("⛔ T13: a bound tab is not read again; prepare runs at most once; an expired token gets one fresh attempt", async () => {
  chromeStub();
  const { runFillChain, needsPrepare } = await fresh("tabState.js");
  const calls = [];
  const bound = await runFillChain({
    state: async () => ({ jobId: "j1", atKnownAddress: true }), identify: async () => { calls.push("identify"); },
    fill: async () => { calls.push("fill"); return { ok: true, message: "Filled 4 field(s)." }; }, prepare: async () => calls.push("prepare"),
  });
  assert.deepEqual(calls, ["fill"], "a tab that knows its job HERE is never read (identified) again by the press");
  assert.deepEqual(bound.did, []);
  assert.equal(bound.message, "Filled 4 field(s).");
  // prepare that still is not enough is reported, never looped
  let fills = 0;
  const stuck = await runFillChain({
    state: async () => ({ jobId: "j1", atKnownAddress: true }), identify: async () => null,
    fill: async () => { fills++; return { ok: false, reason: "prepare", canPrepare: true, message: "x" }; },
    prepare: async () => ({ ok: false, reason: "not_this_address", message: "This page isn't one of this application's addresses." }),
  });
  assert.equal(fills, 1);
  assert.equal(stuck.message, "Prepared your answers. This page isn't one of this application's addresses.");
  // T5: an expired token between the mint and the exchange — one fresh attempt, no more
  let n = 0;
  const retried = await runFillChain({ state: async () => ({ jobId: "j1", atKnownAddress: true }), identify: async () => null, prepare: async () => null,
    fill: async () => (++n === 1 ? { ok: false, reason: "token_expired", message: "Handoff refused: token_expired." } : { ok: true, message: "Filled 2 field(s)." }) });
  assert.equal(n, 2);
  assert.equal(retried.ok, true);
  // what prepare clears — and what it never touches
  for (const r of [{ canPrepare: true }, { reason: "prepare" }, { reason: "stale" }, { reason: "packet_stale" }]) assert.equal(needsPrepare({ ok: false, ...r }), true, JSON.stringify(r));
  for (const reason of ["no_form", "frame_needs_permission", "not_signed_in", "network_error", "not_this_address", "unknown", "not_on_board"]) {
    assert.equal(needsPrepare({ ok: false, reason }), false, reason);
  }
  assert.equal(needsPrepare({ ok: true, canPrepare: true }), false);
  // a step that throws is a plain failure, never an unhandled rejection — and an identify that threw binds and fills nothing
  let filledAnyway = false;
  const thrown = await runFillChain({ state: async () => { throw new Error("x"); }, identify: async () => { throw new Error("y"); },
    fill: async () => { filledAnyway = true; throw new Error("z"); }, prepare: async () => null });
  assert.equal(thrown.ok, false);
  assert.equal(filledAnyway, false, "BINDING FIRST: nothing fills a page no identify named");
  assert.match(thrown.message, /^draft couldn't tell which job this is — nothing was filled\.$/);
  done();
});

test("⛔ T13 · consent unchanged: ONLY the press runs the chain — both triggers, one implementation; the auto switches never do", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /if \(message\.type === 'FILL_ACTIVE_TAB'\) \{\s*handleGatedHandoff\(\)/, "the popup's Fill");
  assert.match(bg, /if \(command === 'fill-gated-application'\) \{ void handleGatedHandoff\(\); return; \}/, "Ctrl+Shift+Y");
  const hg = bg.slice(at(bg, "async function handleGatedHandoff"), at(bg, "async function reportHandoff"));
  assert.match(hg, /runFillChain\(\{/);
  assert.equal((bg.match(/runFillChain\(/g) || []).length, 1, "the chain has one caller: the press");
  // the automatic switches call the handoff itself, never the chain or the read-that-prepares
  const auto = read("extension/autoRead.js");
  assert.doesNotMatch(auto, /runFillChain|handleGatedHandoff|POPUP_CONTEXT|popupContext/);
  // no new permission
  const manifest = JSON.parse(fs.readFileSync("extension/manifest.json", "utf8"));
  assert.ok(!manifest.permissions.includes("tabs") && !manifest.permissions.includes("webNavigation"), "T14 needs no tabs / webNavigation");
});

// ── T14 · the addresses a job has been seen at ──────────────────────────────────────────────────────────────────────
test("⛔ T14: an address is kept as origin + path + identifier parameters — never a tracker, a credential or a fragment", async () => {
  chromeStub();
  const { addressOf } = await fresh("tabBinding.js");
  assert.equal(addressOf(APPLY), `${W}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually`, "?source=linkedin is a tracker");
  assert.equal(addressOf(STRIPE), "https://stripe.com/careers/listing/software-engineer-backend/8198280?gh_jid=8198280", "an identifier stays");
  assert.equal(addressOf("https://x.example/jobs/12345/?utm_source=a&token=abc123&session=9f9f9f&redirect=https%3A%2F%2Fevil&email=ada%40example.test#app"),
    "https://x.example/jobs/12345");
  assert.equal(addressOf("https://x.example/apply?first_name=Ada&id=777"), "https://x.example/apply?id=777", "a typed value (no digit) is never kept");
  assert.equal(addressOf("chrome://extensions/"), null);
  assert.equal(addressOf("not a url"), null);
  done();
});

test("⛔ T14: a seen address claims the same page, a page under it and the page in another language — and nothing else", async () => {
  chromeStub();
  const { addressClaim, knownJobForAddress } = await fresh("tabBinding.js");
  // the exact address in a new tab
  assert.ok(addressClaim(APPLY, APPLY) > 0);
  // the posting claims its application stages, with or without the language segment
  assert.ok(addressClaim(POSTING, APPLY) > 0, "a later stage of the posting");
  assert.ok(addressClaim(POSTING, `${POSTING}/apply`) > 0);
  // …but a stage never claims its posting's siblings, another job, or another origin
  assert.equal(addressClaim(APPLY, POSTING), 0, "a child never claims its parent");
  assert.equal(addressClaim(POSTING, `${W}/Zoom/job/Remote--(US)/Data-Engineer_R20001-1/apply`), 0);
  assert.equal(addressClaim(POSTING, POSTING.replace("zoom.wd5", "evil.wd5")), 0);
  // Stripe's path names the posting; the same posting's apply page under it is claimed, another listing is not
  assert.ok(addressClaim(STRIPE, "https://stripe.com/careers/listing/software-engineer-backend/8198280/apply") > 0);
  assert.equal(addressClaim(STRIPE, "https://stripe.com/careers/listing/software-engineer-frontend/8200001?gh_jid=8200001"), 0);
  // an id that lives only in the query must be on the tab's address too
  const search = "https://stripe.com/jobs/search?gh_jid=8198280";
  assert.ok(addressClaim(search, "https://stripe.com/jobs/search?gh_jid=8198280&utm_source=x") > 0);
  assert.equal(addressClaim(search, "https://stripe.com/jobs/search?gh_jid=9999999"), 0);
  assert.equal(addressClaim(search, "https://stripe.com/jobs/search"), 0, "the bare search page is every job's");
  // a bare origin or a one-segment path never claims anything
  assert.equal(addressClaim("https://stripe.com", "https://stripe.com/careers/listing/x/8198280"), 0);
  assert.equal(addressClaim("https://stripe.com/jobs", "https://stripe.com/jobs/listing/x/8198280"), 0);
  // the most specific claim wins; two jobs claiming equally → neither (the user's Read decides)
  const zoom = { jobId: "wd-1", addresses: [POSTING] };
  const zoomApply = { jobId: "wd-2", addresses: [`${POSTING}/apply`] };
  assert.equal(knownJobForAddress([zoom, zoomApply], APPLY)?.jobId, "wd-2");
  assert.equal(knownJobForAddress([zoom, { jobId: "wd-3", addresses: [POSTING] }], APPLY), null, "a tie binds to neither");
  assert.equal(knownJobForAddress([zoom, { jobId: "wd-1", addresses: [POSTING] }], APPLY)?.jobId, "wd-1", "the same job twice is no tie");
  assert.equal(knownJobForAddress([], APPLY), null);
  done();
});

test("⛔ T14: a NEW tab on a known address binds at once — no read, no request; another account's records bind nothing", async () => {
  const { stores, out } = chromeStub({ tabUrl: APPLY, tabId: 42 });
  const { progress, noteContext } = await import("../extension/progress.js");
  await progress.clearAll();
  // tab 7 read the posting earlier: the server named the job and its canonical address; the score came with it
  await noteContext({ posting: { known: true, jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom" },
    pageKey: { key: "workday|zoom|zoom|R19749", canonicalUrl: POSTING } }, null, { url: POSTING, ats: { score: 72, band: "strong" } });
  const rec = await progress.get({ jobId: "wd-zoom-1" });
  assert.deepEqual(rec.addresses, [POSTING]);
  assert.deepEqual({ score: rec.ats.score, band: rec.ats.band }, { score: 72, band: "strong" });
  const { tabStateFor, handlers } = await fresh("tabState.js");
  // now a NEW tab (42) on the application stage — never read, never captured, never prepared there
  const st = await tabStateFor({ id: 42, url: APPLY });
  assert.equal(st?.jobId, "wd-zoom-1");
  assert.equal(st.via, "known");
  assert.equal(st.read, true, "its progress comes with it");
  assert.deepEqual({ score: st.ats.score, state: st.ats.state }, { score: 72, state: "ready" });
  assert.equal(stores.session.get("bind:42")?.jobId, "wd-zoom-1", "the binding is WRITTEN — the card is never a picture without the state");
  assert.deepEqual(out.injected, [], "the page was read");
  assert.deepEqual(out.fetched, [], "the server was asked");
  // the popup's TAB_STATE: only an extension page may ask
  assert.deepEqual(await handlers.TAB_STATE({ type: "TAB_STATE" }, { id: "test", url: "https://evil.example/" }), { ok: false, error: "not_allowed" });
  const viaPopup = await handlers.TAB_STATE({ type: "TAB_STATE" }, { id: "test", url: "chrome-extension://test/popup.html" });
  assert.equal(viaPopup.state?.jobId, "wd-zoom-1");
  // an address no job was seen at stays unbound ("This tab is not linked to a job yet" is then the truth)
  assert.equal(await tabStateFor({ id: 43, url: "https://other.example/careers/123456" }), null);
  // records that belong to ANOTHER account never bind a tab
  await progress.claim("ada");
  stores.local.set("authIdentity", { authenticated: true, username: "grace" });
  assert.equal(await tabStateFor({ id: 44, url: APPLY }), null, "another account's job bound the tab");
  done();
});

test("⛔ T14: the popup draws the tab's state on open — the card, the bound line, Fill — and reads nothing from the page", () => {
  const els = {};
  const sent = [];
  const el = (id) => (els[id] ||= { id, style: {}, textContent: "", className: "", hidden: false, disabled: false, title: "", dataset: {}, children: [],
    listeners: {}, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, append(...x) { this.children.push(...x); }, setAttribute() {},
    set innerHTML(v) { this.children = []; }, get innerHTML() { return ""; } });
  const events = [];
  const document = { getElementById: el, createElement: (t) => el(`<${t}>${Math.random()}`), addEventListener() {}, dispatchEvent: (e) => events.push(e.type) };
  const state = { jobId: "wd-zoom-1", title: "Software Engineer", company: "Zoom", via: "known", captured: false, read: true, prepared: true,
    ats: { score: 72, band: "strong", state: "ready" }, logo: null };
  const answers = { PROBE_AUTH: { authenticated: true, username: "ada" }, TAB_STATE: { ok: true, state } };
  const chrome = {
    runtime: { sendMessage: async (m) => { sent.push(m.type); return answers[m.type] ?? null; }, openOptionsPage() {} },
    tabs: { query: async () => [{ id: 42, url: APPLY }], create() {} },
    storage: { local: { get: async () => ({}) } },
    scripting: { executeScript: async () => { throw new Error("the popup read the page on open"); } },
  };
  const sandbox = { document, chrome, window: { close() {} }, setTimeout, clearTimeout, console, URL, Promise, Date, Event: class { constructor(t) { this.type = t; } } };
  vm.createContext(sandbox);
  for (const f of ["extension/config.js", "extension/companion.js", "extension/popup.js"]) vm.runInContext(read(f), sandbox);
  return new Promise((r) => setTimeout(r, 30)).then(() => {
    assert.deepEqual(sent, ["PROBE_AUTH", "TODAY_RING", "CAPTURED_TODAY", "TAB_STATE"], "no POPUP_CONTEXT, no PREVIEW_ACTIVE_TAB on open");
    assert.equal(els["bound"].style.display, "block");
    assert.equal(els["bound-line"].textContent, "On draft — Software Engineer at Zoom");
    assert.equal(els["preview-title"].textContent, "Software Engineer");
    assert.equal(els["job-preview"].style.display, "grid");
    assert.equal(els["btn-fill-primary"].style.display, "flex", "Fill is the action — it reads and prepares itself if it must");
    assert.equal(els["btn-read-page"].textContent, "Read again", "never asks for a FIRST read of a tab it knows");
    assert.ok(events.includes("draft:tabstate"), "the progress block repaints for the newly bound tab");
  });
});

test("⛔ T14: the progress record keeps addresses through the whitelist — capped, deduplicated, accumulated", async () => {
  const { stores } = chromeStub();
  const { progress, noteAddress, noteCapture, MAX_ADDRESSES, PROGRESS_KEY } = await import("../extension/progress.js");
  await progress.clearAll();
  await noteCapture({ success: true, jobId: "j9", link: null }, { title: "T", company: "C", url: `${APPLY}&token=secret123` }, APPLY);
  let r = await progress.get({ jobId: "j9" });
  assert.deepEqual(r.addresses, [`${W}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually`], "the same page once; no token, no tracker");
  for (let i = 0; i < 12; i++) await noteAddress("j9", `https://x.example/jobs/${10000 + i}`);
  r = await progress.get({ jobId: "j9" });
  assert.equal(r.addresses.length, MAX_ADDRESSES);
  assert.equal(r.addresses[0], "https://x.example/jobs/10011", "newest first");
  assert.ok(!JSON.stringify(stores.local.get(PROGRESS_KEY)).includes("secret123"));
  await progress.patch({ jobId: "j9" }, { addresses: ["javascript:alert(1)", "chrome://x"] });
  assert.equal((await progress.get({ jobId: "j9" })).addresses.length, MAX_ADDRESSES, "a non-web address is dropped");
  done();
});

// ── the real Chrome: rows (36) and (37) ─────────────────────────────────────────────────────────────────────────────
const chromeBin = await findChrome();
test("⛔ T13 + T14 in a REAL Chrome — Fill from a cold tab (every auto switch off) reads, prepares and fills; Read prepares; the apply URL in a NEW tab: the real popup shows the job and its progress and its Fill works with no prior press; no form says why",
  { skip: chromeBin.skip || false, timeout: 400000 }, async () => {
    const lines = [];
    const r = await runScenario("fillChain", { log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
  });
