// ⭐ T20 · AUTO-READ AFTER CONSENT READS THE TAB ALREADY OPEN — no press (owner, FIELD REPORT UPDATE 4, 10-15:
// "after the auto-read permission is granted, the page STILL needs a manual Read").
//
// Two causes, both MEASURED in a real Chrome (the P0 walk — headed, Chrome's own prompt answered through Windows UI
// Automation; test/t20AutoReadChrome.test.js runs the headless half in the suite):
//   (1) the popup CLOSES the moment chrome.permissions.request opens Chrome's prompt, so the popup's code after
//       `await request(...)` never ran — Chrome granted every site, but no consent was recorded, nothing registered,
//       nothing read, not even after a reload. → the popup says the click to the worker in the same turn
//       (AUTO_READ_PENDING), and the worker finishes the consent on permissions.onAdded.
//   (2) a registered content script runs on pages loaded AFTER it is registered — the tab open at the consent was never
//       given the watcher. → every consent injects the watcher into the already-open tabs it covers.
//
// The REAL autoRead.js handlers and popup-auto.js against a fake `chrome` (test-support/autoReadChrome.mjs).
// Synthetic people and companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SITES, OPTIONAL_ORIGINS, AUTO_READ_KEY, PENDING_MS, pendingClick, handlers, normaliseSettings, openTabsAfterConsent,
  onPermissionsAdded, defaultSettings,
} from "../extension/autoRead.js";
import { installAutoReadChrome, settingsWith } from "../test-support/autoReadChrome.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const EXT = { id: "test", url: "chrome-extension://test/popup.html" };
const GH = ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"];
const LEVER = ["https://jobs.lever.co/*"];
const ACME = "https://careers.acme.test";
const GH_APPLY = "https://job-boards.greenhouse.io/acme/jobs/8198280";
const ACME_APPLY = `${ACME}/jobs/search?gh_jid=8198280`;
const WATCHER = "file:autoReadWatcher.js";

/** The fake chrome with several tabs open (the stub's own tabs.query answers one). */
function withTabs(h, tabs) { chrome.tabs.query = async () => tabs.map(t => ({ ...t })); return h; }
const injectedTargets = (h) => h.injectedArgs.filter(x => x.name === WATCHER).map(x => x.target);
const stored = (h) => normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
const OPEN = [
  { id: 1, url: GH_APPLY },                                    // a preset site, on and granted
  { id: 2, url: "https://www.linkedin.com/jobs/view/123" },    // ⛔ never
  { id: 3, url: "https://jobs.lever.co/acme/0b9f1c2e-1111-4222-8333-944455556666" },  // a preset site Chrome did not grant
  { id: 4, url: "http://job-boards.greenhouse.io/acme/jobs/1" },  // http
  { id: 5, url: ACME_APPLY },                                  // a custom site, not allowed (yet)
  { id: 6 },                                                   // a tab whose address the extension may not see
];

test("⭐ T20 · openTabsAfterConsent — the watcher goes into every OPEN tab of a site that is on AND granted, and nowhere else", async () => {
  const h = withTabs(installAutoReadChrome({ granted: [...GH] }), OPEN);
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ greenhouse: { read: true, prepare: true }, lever: { read: true } }));
  const r = await openTabsAfterConsent();
  assert.deepEqual(r.injected, [1], "only the granted Greenhouse tab — not LinkedIn, not ungranted Lever, not http, not an unallowed site");
  assert.deepEqual(injectedTargets(h), [{ tabId: 1, allFrames: false }], "a preset site's top frame, as its registration");
  assert.deepEqual(h.injected.filter(n => n !== WATCHER), [], "nothing is READ here — only the watcher goes in; the pass decides");
  h.restore();
});

test("⭐ T20 · a custom site's open tab gets the watcher in EVERY frame (its form is the embedded ATS frame — T11 / T12)", async () => {
  const h = withTabs(installAutoReadChrome({ granted: [`${ACME}/*`, ...GH] }), OPEN);
  const s = defaultSettings();
  s.custom[ACME] = { read: true, prepare: true, capture: false, fill: false, frames: ["greenhouse"], at: Date.now() };
  h.stores.local.set(AUTO_READ_KEY, s);
  assert.deepEqual((await openTabsAfterConsent()).injected, [5]);
  assert.deepEqual(injectedTargets(h), [{ tabId: 5, allFrames: true }]);
  h.restore();
});

test("⛔ T20 · the kill switch, no consent, or a switch off → nothing is injected anywhere", async () => {
  for (const settings of [settingsWith({ greenhouse: { read: true } }, { kill: true }), settingsWith({ greenhouse: { read: true } }, { consent: null }),
    settingsWith({}), defaultSettings()]) {
    const h = withTabs(installAutoReadChrome({ granted: [...GH, ...LEVER, `${ACME}/*`] }), OPEN);
    h.stores.local.set(AUTO_READ_KEY, settings);
    assert.deepEqual((await openTabsAfterConsent()).injected, [], JSON.stringify(settings).slice(0, 80));
    assert.equal(injectedTargets(h).length, 0);
    h.restore();
  }
});

test("⭐ T20 · the card's consent (popup alive) → the OPEN tab gets the watcher at once; an Options switch turned on does the same", async () => {
  const h = withTabs(installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS] }), OPEN);
  const r = await handlers.AUTO_READ_CONSENT_ALL({ agree: true }, EXT);
  assert.equal(r.ok, true);
  assert.deepEqual(r.injected, [1, 3], "Greenhouse and Lever (both granted now) — never LinkedIn, never http");
  h.restore();

  const o = withTabs(installAutoReadChrome({ granted: [...LEVER] }), OPEN);
  o.stores.local.set(AUTO_READ_KEY, settingsWith({}, { consent: "all" }));
  const on = await handlers.AUTO_READ_SET({ site: "lever", behaviour: "read", on: true }, EXT);
  assert.equal(on.ok, true);
  assert.deepEqual(on.injected, [3], "Options → Lever on reads the Lever tab already open");
  const off = await handlers.AUTO_READ_SET({ site: "lever", behaviour: "read", on: false }, EXT);
  assert.equal(off.injected, undefined, "turning OFF injects nothing");
  assert.deepEqual(injectedTargets(o), [{ tabId: 3, allFrames: false }]);
  o.restore();
});

test("⭐ T20 · THE POPUP CLOSED AT THE PROMPT: the pending click + Chrome's grant (onAdded) finish the consent in the worker, and the open tab is read", async () => {
  const h = withTabs(installAutoReadChrome({ granted: [] }), OPEN);
  // the click: the request (the popup dies here), and — in the same turn — the click said to the worker
  assert.deepEqual(await handlers.AUTO_READ_PENDING({ kind: "all" }, EXT), { ok: true, kind: "all" });
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined, "a pending click writes NO setting");
  assert.deepEqual([...h.stores.session.keys()], [], "nor any other storage - it lives in the worker's memory (D23: no new key)");
  // Chrome grants (the user pressed Allow in Chrome's prompt) → onAdded
  OPTIONAL_ORIGINS.forEach(o => h.granted.add(o));
  const r = await onPermissionsAdded({ origins: [...OPTIONAL_ORIGINS] });
  assert.equal(r.pending, "all");
  assert.equal(r.done.ok, true);
  const s = stored(h);
  assert.ok(s.consent2?.at, "the consent is recorded — by the worker");
  for (const site of SITES) assert.deepEqual(s.sites[site.id], { read: true, prepare: true, capture: false, fill: false }, site.id);
  assert.deepEqual([...h.registered.keys()].sort(), SITES.map(x => `draft-auto-read-${x.id}`).sort());
  assert.deepEqual(r.done.injected, [1, 3], "the tabs already open are read with no press");
  assert.equal(pendingClick(), null, "finished once");
  // a second onAdded (another grant later) finds nothing pending and turns nothing more on
  const again = await onPermissionsAdded({ origins: [] });
  assert.equal(again.pending, null);
  h.restore();
});

test("⭐ T20 · 'Always read here' and the second click, finished by the worker when the popup died", async () => {
  const h = withTabs(installAutoReadChrome({ granted: [] }), OPEN);
  await handlers.AUTO_READ_PENDING({ kind: "site", origin: ACME, frames: ["greenhouse"] }, EXT);
  [`${ACME}/*`, ...GH].forEach(o => h.granted.add(o));
  const r = await onPermissionsAdded({ origins: [`${ACME}/*`, ...GH] });
  assert.equal(r.done.ok, true);
  assert.deepEqual(stored(h).custom[ACME].frames, ["greenhouse"]);
  assert.deepEqual(injectedTargets(h), [{ tabId: 5, allFrames: true }], "the careers tab, every frame");
  h.restore();

  const f = withTabs(installAutoReadChrome({ granted: [`${ACME}/*`] }), OPEN);
  const s = defaultSettings();
  s.custom[ACME] = { read: true, prepare: true, capture: false, fill: false, frames: [], at: Date.now() };
  f.stores.local.set(AUTO_READ_KEY, s);
  await handlers.AUTO_READ_PENDING({ kind: "frame", origin: ACME, site: "greenhouse" }, EXT);
  GH.forEach(o => f.granted.add(o));
  assert.equal((await onPermissionsAdded({ origins: GH })).done.ok, true);
  assert.deepEqual(stored(f).custom[ACME].frames, ["greenhouse"]);
  assert.deepEqual(f.registered.get("draft-auto-read-c-careers.acme.test").matches, [`${ACME}/*`, ...GH]);
  f.restore();
});

test("⛔ T20 · a grant with NO click behind it, an expired click, a partial grant, or a refused one turns NOTHING on", async () => {
  // no pending click: e.g. the user granted from chrome://extensions — consent is never inferred
  let h = withTabs(installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS] }), OPEN);
  let r = await onPermissionsAdded({ origins: [...OPTIONAL_ORIGINS] });
  assert.equal(r.done, null);
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined, "nothing written");
  assert.equal(h.registered.size, 0);
  assert.equal(injectedTargets(h).length, 0);
  h.restore();
  // expired
  h = withTabs(installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS] }), OPEN);
  await handlers.AUTO_READ_PENDING({ kind: "all" }, EXT);
  const realNow = Date.now;
  Date.now = () => realNow() + PENDING_MS + 1;
  try { r = await onPermissionsAdded({ origins: [...OPTIONAL_ORIGINS] }); } finally { Date.now = realNow; }
  assert.equal(pendingClick(), null, "an expired click is dropped");
  assert.equal(r.done, null);
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined);
  h.restore();
  // partial: the click asked for the whole set, Chrome holds only Greenhouse (granted earlier, elsewhere)
  h = withTabs(installAutoReadChrome({ granted: [...GH] }), OPEN);
  await handlers.AUTO_READ_PENDING({ kind: "all" }, EXT);
  r = await onPermissionsAdded({ origins: [...GH] });
  assert.equal(r.done, null);
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined);
  await handlers.AUTO_READ_PENDING_CLEAR({}, EXT);
  h.restore();
  // refused: Chrome adds nothing, so onAdded never fires — and the popup that lived to see it drops the click
  h = withTabs(installAutoReadChrome({ granted: [] }), OPEN);
  await handlers.AUTO_READ_PENDING({ kind: "all" }, EXT);
  await handlers.AUTO_READ_PENDING_CLEAR({}, EXT);
  assert.equal(pendingClick(), null);
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined);
  assert.equal(injectedTargets(h).length, 0, "a refused grant reads nothing");
  h.restore();
});

test("⛔ T20 · the pending click: only from the extension's own pages; its origins are the worker's, never the message's; never LinkedIn; the kill switch drops it", async () => {
  const h = installAutoReadChrome({ granted: [] });
  const page = { tab: { id: 1, url: GH_APPLY }, url: GH_APPLY, frameId: 0 };
  assert.equal((await handlers.AUTO_READ_PENDING({ kind: "all" }, page)).error, "not_allowed", "a content script cannot arm it");
  assert.equal((await handlers.AUTO_READ_PENDING_CLEAR({}, page)).error, "not_allowed");
  assert.equal((await handlers.AUTO_READ_PENDING({ kind: "everything" }, EXT)).error, "bad_site");
  assert.equal((await handlers.AUTO_READ_PENDING({ kind: "site", origin: "https://www.linkedin.com" }, EXT)).error, "bad_site");
  assert.equal((await handlers.AUTO_READ_PENDING({ kind: "site", origin: "https://boards.greenhouse.io" }, EXT)).error, "bad_site", "a preset site is the card's");
  await handlers.AUTO_READ_PENDING({ kind: "all", origins: ["https://*/*"] }, EXT);
  assert.deepEqual(pendingClick().origins, [...OPTIONAL_ORIGINS], "the message's own list is ignored");
  await handlers.AUTO_READ_KILL({}, EXT);
  assert.equal(pendingClick(), null, "the kill switch drops a click still waiting for Chrome");
  h.restore();
});

test("⛔ T20 · D23 + the gesture: Settings says the click AFTER the request, in the same turn (nothing awaited before either); background.js finishes it on onAdded; injection only from consent", () => {
  // ⭐ T31: the retired popup's three clicks are Settings' (options-auto.js) — the one-time card's one prompt, and
  // "Always read here" (with the frame-only second click folded into it for a site already chosen)
  const pop = read("extension/options-auto.js");
  for (const [start, end] of [
    ["export function onConsentAll(api) {", "export function onAlwaysHere("],
    ["export function onAlwaysHere(api, here) {", "/** The site a deep link asks about"],
  ]) {
    const fn = pop.slice(at(pop, start), at(pop, end));
    const req = fn.indexOf("api.permissions.request(");
    const pend = fn.indexOf("type: 'AUTO_READ_PENDING'");
    assert.ok(req > 0 && pend > req, `${start}: the request first, then the pending click`);
    assert.ok(fn.indexOf("await") > pend, `${start}: nothing awaited before the request or the pending click`);
    assert.ok(fn.indexOf("return (async") > pend, `${start}: said synchronously, before the async part`);
  }
  // the page injects nothing: the module never names scripting, and only the worker's consents inject
  assert.doesNotMatch(pop, /scripting\./);
  const ar = read("extension/autoRead.js");
  const callers = [...ar.matchAll(/await afterConsent\(/g)].length;
  assert.equal(callers, 6, "consentAll · allowSite · allowFrame · an Options switch ON (preset · custom) · ⭐ D112 consentGlobal");
  const bg = read("extension/background.js");
  assert.match(bg, /chrome\.permissions\?\.onAdded\?\.addListener\(\(added\) => \{ void onPermissionsAdded\(added\); \}\);/);
  assert.doesNotMatch(bg, /openTabsAfterConsent/, "background.js never injects on its own — not on install, startup or popup open");
});
