// T31 (owner, 10-25) · THE TOOLBAR ICON IS THE DOCK'S TOGGLE, AND A PAGE IS TOLD ONLY WHAT IT NEEDS — "info should be
// relayed when it is needed, relevant and makes sense to see; everything else moved away, or into the background."
//
// extension/toolbarPress.js: relayFor (what the press says about a page — the popups, or nothing), fillRelay (what a
// fill says that only a popup can carry), toolbarPress (the toggle, the read, the relay — its browser work handed in).
// background.js: the press is chrome.action.onClicked; the popups' buttons are DOCK_ACT, the person's click only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { relayFor, fillRelay, toolbarPress } from "../extension/toolbarPress.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const BG = read("extension/background.js");
const SIGNED_IN = { authenticated: true, username: "ada" };
const texts = (specs) => specs.map(s => `${s.kind}: ${s.text}${(s.actions || []).length ? ` [${s.actions.map(a => a.id).join(", ")}]` : ""}`);

test("T31 ① relayFor — each page is told only what it calls for, and most pages nothing at all", () => {
  assert.deepEqual(texts(relayFor({ identity: { authenticated: false } })), ["question: Sign in to draft to use it here. [sign-in]"]);
  assert.deepEqual(relayFor({ identity: SIGNED_IN, ctx: null }), [], "nothing read, nothing said");
  // a posting draft does not hold: the two things one does with it
  assert.deepEqual(texts(relayFor({ identity: SIGNED_IN, ctx: { identity: { bind: false, action: "capture" }, binding: null } })),
    ["question: Add this job to draft? [capture, draft]"]);
  // a posting already yours: the intent line says it (intent.js), with its own switch — never said twice
  assert.deepEqual(relayFor({ identity: SIGNED_IN, ctx: { identity: { bind: true }, posting: { known: true, title: "Software Engineer", company: "Zoom" } } }), []);
  // a packet that exists is not news on every page — only answers THIS press prepared are
  assert.deepEqual(relayFor({ identity: SIGNED_IN, ctx: { prepared: false, packets: [{ stale: false }], binding: { title: "Software Engineer" } } }), []);
  // answers prepared on a form: Fill, when you are ready
  assert.deepEqual(texts(relayFor({ identity: SIGNED_IN, ctx: { prepared: true, binding: { title: "Software Engineer", company: "Zoom" } } })),
    ["toast: Answers prepared for Software Engineer at Zoom — fill when you are ready. [fill]"]);
  // prepared, but for another address of the application: the server's own sentence
  assert.deepEqual(texts(relayFor({ identity: SIGNED_IN, ctx: { handoff: { state: "elsewhere", message: "This application fills at careers.zoom.test." } } })),
    ["toast: This application fills at careers.zoom.test."]);
  // the company notice is said too, after
  assert.deepEqual(texts(relayFor({ identity: SIGNED_IN, ctx: { notice: "You applied here 28 Sep · 2 other roles at Zoom" } })),
    ["toast: You applied here 28 Sep · 2 other roles at Zoom"]);
  // a page that is none of these: silence — no job card, no ring, no recent list
  assert.deepEqual(relayFor({ identity: SIGNED_IN, ctx: { identity: { bind: false, action: null }, recent: [{ title: "x" }], posting: null } }), []);
  // the server asks for a sign-in on this page
  assert.deepEqual(texts(relayFor({ identity: SIGNED_IN, ctx: { identity: { action: "sign_in", message: "Sign in to draft to read this page." } } })),
    ["question: Sign in to draft to read this page. [sign-in]"]);
});

test("T31 ② fillRelay — a frame to allow opens Settings → Permissions; a form not recognised offers Report; anything else says nothing more", () => {
  assert.deepEqual(texts(fillRelay({ reason: "frame_needs_permission", site: { name: "Greenhouse" }, message: "This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it." })),
    ["question: This application form is inside a Greenhouse frame. Allow draft on Greenhouse to fill it. [allow-site]"]);
  const nr = fillRelay({ reason: "form_not_recognised", message: "This form isn't recognised — nothing was filled." });
  assert.deepEqual(texts(nr), ["toast: This form isn't recognised — nothing was filled. [report]"]);
  assert.equal(nr[0].id, "rm-draft-status-toast", "it replaces the status line's own news of it — said once");
  assert.deepEqual(fillRelay({ ok: true }), []);
  assert.deepEqual(fillRelay({ ok: false, reason: "no_form" }), []);
});

test("T31 ③ toolbarPress — a page draft cannot run on opens the board; an open dock closes; a closed one opens, reads (signed in only) and relays", async () => {
  const run = async (tab, { state = { exists: false }, identity = SIGNED_IN, ctx = null, opened = { ok: true }, stateThrows = false } = {}) => {
    const calls = [];
    const r = await toolbarPress(tab, {
      state: async () => { calls.push("state"); if (stateThrows) throw new Error("no access"); return state; },
      collapse: async () => { calls.push("collapse"); }, openDock: async () => { calls.push("open"); return opened; },
      identity: async () => { calls.push("identity"); return identity; }, context: async () => { calls.push("read"); return ctx; },
      relay: async (_t, specs) => { calls.push(`relay ${specs.length}`); }, openBoard: async () => { calls.push("board"); },
    });
    return { r, calls };
  };
  const web = { id: 7, url: "https://careers.zoom.test/jobs/1" };
  assert.deepEqual((await run({ id: 7, url: "chrome://extensions" })).calls, ["board"]);
  assert.deepEqual((await run(web, { stateThrows: true })).calls, ["state", "board"], "a page Chrome keeps from extensions");
  assert.deepEqual((await run(web, { state: { exists: true, collapsed: false } })).calls, ["state", "collapse"], "open → closed: nothing read");
  const open = await run(web, { state: { exists: true, collapsed: true }, ctx: { identity: { bind: false, action: "capture" } } });
  assert.deepEqual(open.calls, ["state", "open", "identity", "read", "relay 1"]);
  assert.equal(open.r.did, "opened");
  assert.deepEqual((await run(web, { identity: { authenticated: false } })).calls, ["state", "open", "identity", "relay 1"], "⛔ signed out: nothing is read");
  assert.deepEqual((await run(web, { ctx: { identity: { bind: false } } })).calls, ["state", "open", "identity", "read"], "nothing to say: no popup");
  assert.deepEqual((await run(web, { opened: { ok: false } })).calls, ["state", "open", "board"]);
});

test("T31 ④ the service worker: the press is chrome.action.onClicked; DOCK_ACT answers the person's click in a page's TOP frame, on THAT tab; the walks' TOOLBAR_PRESS is the extension's pages' only", () => {
  assert.match(BG, /chrome\.action\.onClicked\.addListener\(\(tab\) => \{ void pressToolbar\(tab\)\.catch\(\(\) => null\); \}\);/);
  const act = BG.slice(at(BG, "if (msg?.type !== 'DOCK_ACT') return false;"), at(BG, "// The walks press the toolbar"));
  assert.match(act, /if \(!act \|\| msg\.trigger !== 'click' \|\| sender\?\.frameId !== 0 \|\| !sender\?\.tab\?\.id\) \{ sendResponse\(\{ ok: false \}\); return true; \}/);
  assert.match(act, /act\(sender\.tab\)/, "it acts on the tab the click came from — never the active one");
  const acts = BG.slice(at(BG, "const DOCK_ACTS = Object.freeze({"), at(BG, "chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {\n  if (msg?.type !== 'DOCK_ACT')"));
  for (const a of ["capture", "draft", "fill", "'sign-in'", "'allow-site'", "report", "'report-send'"]) assert.match(acts, new RegExp(`\\n  ${a}: async`), `no ${a}`);
  assert.match(acts, /'allow-site': async \(\) => \{ await chrome\.tabs\.create\(\{ url: chrome\.runtime\.getURL\('options\.html#permissions'\) \}\);/, "a permission is asked on the settings page");
  assert.doesNotMatch(acts, /permissions\.request/, "⛔ never from a page");
  const tp = BG.slice(at(BG, "if (msg?.type !== 'TOOLBAR_PRESS') return false;"));
  assert.match(tp.slice(0, 400), /if \(sender\?\.id !== chrome\.runtime\.id \|\| !String\(sender\?\.url \|\| ''\)\.startsWith\(chrome\.runtime\.getURL\(''\)\)\) \{ sendResponse\(\{ ok: false \}\); return true; \}/);
  // every fill relays what only a popup can carry — once, through reportHandoff
  assert.match(BG.slice(at(BG, "async function reportHandoff(tab, result) {")).slice(0, 400), /const relay = fillRelay\(result\);/);
});

test("T31 ⑤ the page-side relay: a press reaches DOCK_ACT on the person's own click only", () => {
  const tp = read("extension/toolbarPress.js");
  const r = tp.slice(at(tp, "export function renderRelay(specs, theme) {"), at(tp, "/** Injected, TOP frame: is draft's dock on this page"));
  assert.match(r, /if \(!answer\.trusted\) return 'ignore';/);
  assert.match(r, /chrome\.runtime\.sendMessage\(\{ type: 'DOCK_ACT', act: answer\.action, trigger: 'click' \}/);
  assert.doesNotMatch(r, /innerHTML/, "it draws nothing itself — the popup layer escapes every word");
});

// ═══ the real extension, pressed ═════════════════════════════════════════════════════════════════════════════
const { findChrome } = await import("../test-support/extensionBrowser.mjs");
const chromeFound = await findChrome();
test("T31 · the toolbar press on the REAL extension — asked about a posting draft does not hold, Capture on the person's click (a script's sends nothing), the toggle, a job of yours said once", { skip: chromeFound.skip || false, timeout: 300000 }, async () => {
  const { runScenario } = await import("../test-support/walkExtension.mjs");
  const lines = [];
  const r = await runScenario("toolbarPress", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL") || l.startsWith("OBSERVED")).join("\n"));
});

test("T31 ⑥ automatic reading is OFFERED by the press only where it would work — a site you might choose, or the one-time setup on a preset site — and set up in Settings", async () => {
  const signed = { authenticated: true };
  assert.deepEqual(texts(relayFor({ identity: signed, ctx: {}, auto: { here: { host: "careers.acme.test", on: false } } })),
    ["toast: Read careers.acme.test's application pages for you automatically? [always-here]"]);
  assert.deepEqual(relayFor({ identity: signed, ctx: {}, auto: { here: { host: "careers.acme.test", on: true } } }), [], "already chosen: nothing");
  assert.deepEqual(texts(relayFor({ identity: signed, ctx: {}, auto: { card: true, cardSite: "Greenhouse" } })),
    ["toast: draft can read Greenhouse application pages for you automatically. [auto-setup, auto-later]"]);
  assert.deepEqual(relayFor({ identity: signed, ctx: {}, auto: { card: true, cardSite: null } }), [], "the setup is offered on a preset site only — not on every page");
  // the worker: the site is the TAB's origin, never a message's; Settings opens at #auto-read with it
  const acts = BG.slice(at(BG, "'always-here': async (tab) => {"), at(BG, "'auto-setup': async"));
  assert.match(acts, /const origin = customOriginFor\(tab\?\.url\);/);
  assert.match(acts, /chrome\.runtime\.getURL\(`options\.html\?\$\{q\}#auto-read`\)/);
  // Settings: the deep link is validated; the switch asks Chrome first
  const { hereFromSearch } = await import("../extension/options-auto.js");
  assert.deepEqual(hereFromSearch("?here=https%3A%2F%2Fcareers.acme.test&frames=greenhouse,nope"),
    { origin: "https://careers.acme.test", host: "careers.acme.test", frames: ["greenhouse"],
      origins: ["https://careers.acme.test/*", "https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"] });
  for (const bad of ["?here=https%3A%2F%2Fwww.linkedin.com", "?here=https%3A%2F%2Fboards.greenhouse.io", "?here=javascript%3Aalert(1)", "?here=http%3A%2F%2Facme.test", ""])
    assert.equal(hereFromSearch(bad), null, `accepted: ${bad}`);
});
