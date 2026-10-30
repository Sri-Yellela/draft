// ⭐ D97 (lane J5) · READ, PREPARE, CAPTURE AND FILL — AUTOMATICALLY, OPT-IN, SITE BY SITE.
//
// extension/autoRead.js (the one site table, the settings, autoStep, the handlers), extension/autoReadWatcher.js (the
// classic content script), extension/options-auto.js (the switches, the disclosure, the kill switch), and the small
// `{ auto: true }` seam in extension/gated-handoff.js. The spec's tests (docs/EXTENSION_ONPAGE_SPEC.md D97 §3) and the
// owner's decisions of 10-13: both Workday hosts optional · an automatic fill may press Save and Continue, never Submit
// · local labels and counts for 30 days · an automatic fill never runs captureFormSchema.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";
import {
  SITES, OPTIONAL_ORIGINS, BEHAVIOURS, NEVER_MATCHES, AUTO_READ_KEY, LEGACY_CAPTURE_KEY, PAGE_MESSAGE, WATCHER_FILE,
  GOOD_READ_RATIO, DISCLOSURE, autoStep, defaultSettings, normaliseSettings, siteFor, readQuality, readBadgeText,
  desiredRegistrations, syncRegistrations, reconcileAutoRead, runAutoPass, handlers, onPermissionsRemoved, consentCovers,
} from "../extension/autoRead.js";
import { collectFormLabels } from "../extension/formReport.js";
import { installAutoReadChrome, settingsWith } from "../test-support/autoReadChrome.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));
const WD = ["https://*.myworkdayjobs.com/*", "https://*.myworkdaysite.com/*"];
const T = "https://zoom.wd5.myworkdayjobs.com";
const POSTING = `${T}/Zoom/job/Remote--(US)/Software-Engineer_R19749-1`;
const APPLY = `${T}/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin`;
// ⛔ D99 J13: the sender Chrome really gives the Options page. `options_page` opens it IN A TAB, so `tab` is set —
// this constant used to leave `tab` out, and so pinned the defect that refused every switch in real Chrome.
const OPTIONS_PAGE = { id: "test", url: "chrome-extension://test/options.html",
                       tab: { id: 4242, url: "chrome-extension://test/options.html" } };
const SERVER = "https://draft.test";
let tabN = 0;
const tabOf = (url) => ({ id: 5000 + (++tabN), url });

const FACTS = (o = {}) => ({ origin: T, step: "My Information", isApplyFlow: true, hasPassword: false, isReview: false, ...o });

// ── 1 · the one site table, the manifest ─────────────────────────────────────────────────────────────

// ⚠ D97 REVISED + T12, owner 10-15 — moved knowingly: SmartRecruiters joins the table (decision 2) and the optional list
// ends with T12's broad https pattern (decision 1) — OPTIONAL only; permissions and host_permissions are unchanged.
test("⛔ D97 · the manifest's optional hosts ARE the site table (5 + Workday's 2 + SmartRecruiters) then T12's pattern; permissions and host_permissions unchanged", () => {
  assert.deepEqual(manifest.optional_host_permissions, [...OPTIONAL_ORIGINS, "https://*/*"]);
  assert.deepEqual([...OPTIONAL_ORIGINS], [
    "https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*", "https://jobs.lever.co/*",
    "https://jobs.ashbyhq.com/*", "https://apply.workable.com/*", ...WD, "https://jobs.smartrecruiters.com/*",
  ]);
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  // the watcher is REGISTERED at run time, never declared — the one declared script is D99 J11's bridge, on draft's origin
  assert.deepEqual(manifest.content_scripts, [{ matches: ["https://jobsviadraft.com/*"], js: ["boardBridge.js"], run_at: "document_start", all_frames: false }], "the watcher is REGISTERED at run time, never declared");
  assert.equal(manifest.optional_permissions, undefined);
  for (const o of manifest.optional_host_permissions) assert.doesNotMatch(o, /linkedin|indeed|glassdoor|<all_urls>/i);
  // the watcher ships in the zip (scripts/buildExtension.mjs follows the registration's `js: [...]` literal)
  assert.ok(collectRequiredFiles(manifest).includes(WATCHER_FILE));
  assert.match(read("extension/autoRead.js"), new RegExp(`js: \\['${WATCHER_FILE}'\\]`));
});

test("⛔ D97 · ALL DEFAULT OFF — no consent, no site, no switch; and nothing registers", async () => {
  const d = defaultSettings();
  assert.equal(d.consent, null);
  for (const s of SITES) for (const b of BEHAVIOURS) assert.equal(d.sites[s.id][b], false, `${s.id}.${b}`);
  assert.deepEqual(normaliseSettings(undefined), d);
  const h = installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS] });   // even with every grant
  assert.deepEqual(await desiredRegistrations(d), []);
  assert.deepEqual((await syncRegistrations(d)).registered, []);
  assert.equal(h.registered.size, 0);
  // and a switch on WITHOUT consent is not on
  assert.deepEqual(await desiredRegistrations(settingsWith({ workday: { read: true } }, { consent: null })), []);
  h.restore();
});

test("⛔ D97 · never LinkedIn / Indeed / Glassdoor — not in the table, excluded from every registration, refused with a forced grant", async () => {
  for (const u of ["https://www.linkedin.com/jobs/view/1", "https://uk.indeed.com/viewjob?jk=1", "https://www.glassdoor.com/job-listing/x",
                   "https://linkedin.myworkdayjobs.com.evil.example/x"]) {
    assert.equal(siteFor(u), null, u);
  }
  const all = settingsWith(Object.fromEntries(SITES.map(s => [s.id, { read: true, prepare: true, capture: true, fill: true }])));
  for (const u of ["https://www.linkedin.com/jobs/view/1", "https://www.indeed.com/viewjob?jk=1", "https://www.glassdoor.com/x"]) {
    assert.equal(autoStep({ settings: all, url: u, granted: true }).skip, "never_host", u);
  }
  const h = installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS] });
  const regs = await desiredRegistrations(all);
  assert.equal(regs.length, SITES.length);
  for (const r of regs) assert.deepEqual(r.excludeMatches, [...NEVER_MATCHES]);
  // a forced grant and every switch on: a LinkedIn tab still runs nothing, sends nothing
  h.stores.local.set(AUTO_READ_KEY, all);
  const r = await runAutoPass(tabOf("https://www.linkedin.com/jobs/view/123"), { serverUrl: SERVER });
  assert.equal(r.skipped, "never_host");
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

// ── 2 · the decision ─────────────────────────────────────────────────────────────────────────────────

test("⛔ D97 · autoStep — the switch, the consent, Chrome's grant, the kill switch; then exactly which of the four", () => {
  const on = settingsWith({ workday: { read: true, prepare: true, capture: true, fill: true } });
  assert.equal(autoStep({ settings: on, url: APPLY, granted: false }).skip, "not_granted");
  assert.equal(autoStep({ settings: { ...on, kill: true }, url: APPLY, granted: true }).skip, "kill_switch");
  assert.equal(autoStep({ settings: settingsWith({ workday: { read: true } }, { consent: null }), url: APPLY, granted: true }).skip, "site_off");
  assert.equal(autoStep({ settings: settingsWith({ greenhouse: { read: true } }), url: APPLY, granted: true }).skip, "site_off", "another site's switch");
  assert.equal(autoStep({ settings: on, url: APPLY.replace("https:", "http:"), granted: true }).skip, "not_https");
  assert.deepEqual(autoStep({ settings: on, url: APPLY, granted: true }), { site: "workday", look: true });
  const f = { fieldCount: 18 };
  // an application step, bound: read · prepare · fill — never capture
  assert.deepEqual(autoStep({ settings: on, url: APPLY, granted: true, facts: FACTS(f), bound: true }).actions, ["read", "prepare", "fill"]);
  // unbound: read only — ⛔ nothing that sends the page's address
  assert.deepEqual(autoStep({ settings: on, url: APPLY, granted: true, facts: FACTS(f), bound: false }).actions, ["read"]);
  // a posting page: capture (the JSON-LD said so) — never on the apply flow
  assert.deepEqual(autoStep({ settings: on, url: POSTING, granted: true, facts: FACTS({ isApplyFlow: false, jsonLdPosting: true }) }).actions, ["capture"]);
  assert.deepEqual(autoStep({ settings: on, url: POSTING, granted: true, facts: FACTS({ isApplyFlow: true, jsonLdPosting: true }) }).actions, []);
  assert.deepEqual(autoStep({ settings: on, url: APPLY, granted: true, facts: FACTS({ isApplyFlow: false, jsonLdPosting: true }) }).actions, [], "an /apply stage is never a posting");
  // Review: read, never prepare or fill
  assert.deepEqual(autoStep({ settings: on, url: APPLY, granted: true, facts: FACTS({ ...f, isReview: true }), bound: true }).actions, ["read"]);
  // a sign-in page: nothing at all
  assert.equal(autoStep({ settings: on, url: APPLY, granted: true, facts: FACTS({ ...f, hasPassword: true }), bound: true }).skip, "sign_in_page");
  // a batch owns the tab (G5 refills on every load) → no automatic fill; a dismissed fill → none; the same step → none
  const base = { settings: on, url: APPLY, granted: true, facts: FACTS(f), bound: true, prepared: true };
  assert.deepEqual(autoStep({ ...base, batch: true }).actions, ["read"]);
  assert.deepEqual(autoStep({ ...base, fillStopped: true }).actions, ["read"]);
  assert.deepEqual(autoStep({ ...base, signature: "s1", lastFillSig: "s1" }).actions, ["read"]);
  assert.deepEqual(autoStep({ ...base, signature: "s2", lastFillSig: "s1" }).actions, ["read", "fill"]);
  // Fill OFF → never a fill (the keystroke is the only way); Prepare off → no fill either (it uses what Prepare built)
  const noFill = settingsWith({ workday: { read: true, prepare: true } });
  assert.ok(!autoStep({ ...base, settings: noFill }).actions.includes("fill"));
  const noPrep = settingsWith({ workday: { read: true, fill: true } });
  assert.deepEqual(autoStep({ ...base, settings: noPrep }).actions, ["read"]);
  // D64's consent covers capture on D64's own five only
  const d64 = settingsWith({ greenhouse: { capture: true, read: true }, workday: { capture: true } }, { consent: "d64-capture" });
  assert.equal(consentCovers(d64, "greenhouse", "capture"), true);
  assert.equal(consentCovers(d64, "greenhouse", "read"), false);
  assert.equal(consentCovers(d64, "workday", "capture"), false);
});

test("⛔ D97 · THE KILL SWITCH stops all four — and the handler turns every switch off, gives every access back, unregisters", async () => {
  const all = settingsWith(Object.fromEntries(SITES.map(s => [s.id, { read: true, prepare: true, capture: true, fill: true }])));
  for (const url of [APPLY, POSTING, "https://boards.greenhouse.io/x/jobs/1"]) {
    assert.equal(autoStep({ settings: { ...all, kill: true }, url, granted: true, facts: FACTS({ fieldCount: 3, jsonLdPosting: true }), bound: true }).skip, "kill_switch");
  }
  const h = installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS], page: { pageFacts: FACTS() } });
  h.stores.local.set(AUTO_READ_KEY, all);
  await syncRegistrations();
  assert.equal(h.registered.size, SITES.length);
  const r = await handlers.AUTO_READ_KILL({}, OPTIONS_PAGE);
  assert.equal(r.ok, true);
  for (const s of SITES) for (const b of BEHAVIOURS) assert.equal(r.settings.sites[s.id][b], false);
  assert.equal(h.registered.size, 0, "every watcher unregistered");
  assert.deepEqual(h.granted, new Set(), "every site's access given back");
  // a watcher already in a page, after the kill: ignored
  const p = await runAutoPass(tabOf(APPLY), { serverUrl: SERVER });
  assert.ok(p.skipped);
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

// ── 3 · registration and permissions ─────────────────────────────────────────────────────────────────

test("⛔ D97 · on → one watcher for that site only; OFF unregisters it and calls permissions.remove; a later watcher message is ignored", async () => {
  const h = installAutoReadChrome({ granted: WD, page: { pageFacts: FACTS(), collectFormLabels: { labels: ["First Name"], fieldCount: 1 } } });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({}));
  let r = await handlers.AUTO_READ_SET({ site: "workday", behaviour: "read", on: true }, OPTIONS_PAGE);
  assert.equal(r.ok, true);
  assert.deepEqual([...h.registered.keys()], ["draft-auto-read-workday"]);
  const reg = h.registered.get("draft-auto-read-workday");
  assert.deepEqual(reg.matches, WD);
  assert.deepEqual(reg.js, [WATCHER_FILE]);
  assert.equal(reg.persistAcrossSessions, true);
  r = await handlers.AUTO_READ_SET({ site: "workday", behaviour: "read", on: false }, OPTIONS_PAGE);
  assert.equal(r.ok, true);
  assert.equal(h.registered.size, 0, "unregistered");
  assert.deepEqual(h.removed, WD, "Chrome's access given back");
  // ⚠ unregistering does not remove a watcher already injected — so its next message must be ignored
  const tab = tabOf(APPLY);
  const m = await handlers[PAGE_MESSAGE]({ type: PAGE_MESSAGE, signature: "x" }, { tab, frameId: 0 });
  assert.ok(m.skipped, JSON.stringify(m));
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⛔ D97 · ON is refused without consent, and without Chrome's grant; a content script can never change a switch", async () => {
  const h = installAutoReadChrome({ granted: [] });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({}, { consent: null }));
  assert.equal((await handlers.AUTO_READ_SET({ site: "workday", behaviour: "read", on: true }, OPTIONS_PAGE)).error, "no_consent");
  h.stores.local.set(AUTO_READ_KEY, settingsWith({}));
  assert.equal((await handlers.AUTO_READ_SET({ site: "workday", behaviour: "read", on: true }, OPTIONS_PAGE)).error, "not_granted");
  h.granted.add(WD[0]); h.granted.add(WD[1]);
  const page = { tab: { id: 1, url: APPLY }, url: APPLY, frameId: 0 };
  for (const [type, msg] of [["AUTO_READ_SET", { site: "workday", behaviour: "fill", on: true }], ["AUTO_READ_CONSENT", { agree: true }],
                             ["AUTO_READ_KILL", {}], ["AUTO_READ_FORGET", {}], ["AUTO_READ_STATE", {}]]) {
    assert.equal((await handlers[type](msg, page)).error, "not_allowed", type);
  }
  assert.equal(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).sites.workday.fill, false);
  h.restore();
});

test("⛔ D99 J13 · the Options page IN A TAB can agree and switch a site on — the sender's address decides, not its tab", async () => {
  const h = installAutoReadChrome({ granted: WD });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({}, { consent: null }));
  assert.equal((await handlers.AUTO_READ_STATE({}, OPTIONS_PAGE)).ok, true, "the table loads");
  assert.equal((await handlers.AUTO_READ_CONSENT({ agree: true }, OPTIONS_PAGE)).ok, true, "\"I agree\" is recorded");
  const r = await handlers.AUTO_READ_SET({ site: "workday", behaviour: "read", on: true }, OPTIONS_PAGE);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.settings.sites.workday.read, true);
  // embedded Options (no tab) is the same page
  const embedded = { id: "test", url: "chrome-extension://test/options.html" };
  assert.equal((await handlers.AUTO_READ_SET({ site: "workday", behaviour: "read", on: false }, embedded)).ok, true);
  // ⛔ still refused: a web page (its own address, in a tab) and another extension's page
  const page = { tab: { id: 1, url: APPLY }, url: APPLY, frameId: 0 };
  assert.equal((await handlers.AUTO_READ_CONSENT({ agree: true }, page)).error, "not_allowed");
  const other = { id: "someone-else", url: "chrome-extension://test/options.html", tab: { id: 2 } };
  assert.equal((await handlers.AUTO_READ_CONSENT({ agree: true }, other)).error, "not_allowed");
  h.restore();
});

test("⛔ D97 · onInstalled (update) / onStartup reconcile: D64's switch migrates once, registrations match the grants — and nothing asks Chrome", async () => {
  const D64 = ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*", "https://jobs.lever.co/*", "https://jobs.ashbyhq.com/*", "https://apply.workable.com/*"];
  const h = installAutoReadChrome({ granted: D64 });
  chrome.permissions.request = async () => { throw new Error("permissions.request outside a click"); };
  h.stores.local.set(LEGACY_CAPTURE_KEY, true);
  const r = await reconcileAutoRead();
  assert.equal(h.stores.local.has(LEGACY_CAPTURE_KEY), false, "the D64 key is removed");
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.equal(s.consent.scope, "d64-capture");
  for (const id of ["greenhouse", "lever", "ashby", "workable"]) assert.deepEqual(s.sites[id], { read: false, prepare: false, capture: true, fill: false }, id);
  assert.deepEqual(s.sites.workday, { read: false, prepare: false, capture: false, fill: false }, "Workday is never switched on by a migration");
  assert.deepEqual(r.registered.sort(), ["draft-auto-read-ashby", "draft-auto-read-greenhouse", "draft-auto-read-lever", "draft-auto-read-workable"]);
  // a second run (onStartup) is a no-op; a registration left behind for a site now off is removed
  h.registered.set("draft-auto-read-workday", { id: "draft-auto-read-workday", matches: WD, js: [WATCHER_FILE] });
  const again = await reconcileAutoRead();
  assert.deepEqual(again.removed, ["draft-auto-read-workday"]);
  assert.equal(h.registered.size, 4);
  // the user removes Lever's access at chrome://extensions → its switches follow, its watcher goes
  h.granted.delete("https://jobs.lever.co/*");
  await onPermissionsRemoved({ origins: ["https://jobs.lever.co/*"] });
  assert.equal(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).sites.lever.capture, false);
  assert.ok(!h.registered.has("draft-auto-read-lever"));
  h.restore();
});

test("⛔ D97 · permissions.request lives in click handlers only — Options' switch, T11's 'Allow draft on <site>', and the popup's card / Always read here / second click — each as its first call, never on load or install", () => {
  const files = collectRequiredFiles(manifest).filter(f => f.endsWith(".js") || f.endsWith(".html"));
  const hits = files.filter(f => /permissions\.request\(/.test(read(`extension/${f}`))).sort();
  // ⭐ T11 (field report 10-14, owner): a form inside an ATS's frame → "one button, and permissions.request is called
  // inside that click". ⭐ D97 REVISED + T12 (owner 10-15): popup-auto.js's three clicks — the one-time card, "Always
  // read here" turned on, and the frame's second click — each pinned the same way in test/d97rT12AlwaysRead.test.js.
  // ⭐ T29 (owner 10-23: a permission is requested on the settings page): Settings → Permissions — each switch's request is
  // its first chrome call, pinned below
  // ⭐ T31 (owner 10-25): the toolbar popup is retired — its three clicks and T11's "Allow draft on <site>" are Settings'
  // now: the request happens ONLY on the extension's own settings page (a web page cannot)
  // ⭐⭐ D112 b2 (owner 10-30): + the ONE global-read ask's window (global-ask.js) — its Allow's first call, pinned in
  // test/d112GlobalRead.test.js — and Settings → Permissions' "Job postings on any site" switch (onAllowGlobal)
  assert.deepEqual(hits, ["global-ask.js", "options-auto.js", "options-permissions.js"]);
  const perm = read("extension/options-permissions.js");
  const allow = perm.slice(at(perm, "export function onAllow(api, siteId) {"), at(perm, "/** Draw the section"));
  const firstOf = (src) => { const i = at(src, "api."); return src.slice(i, i + 25); };
  assert.equal(firstOf(allow), "api.permissions.request({", "onAllow's first chrome call is the request");
  assert.ok(allow.indexOf("api.permissions.request(") < allow.indexOf("await"), "before any await");
  for (const [open, first] of [["if (box.checked) {\n          const asked = onAllow(api, id);", "onAllow(api, id)"],
    ["if (box.checked) {\n          const asked = api.permissions.request({ origins: [originPattern(origin)] });", "api.permissions.request("]]) {
    const i = at(perm, open);
    assert.ok(perm.indexOf(first, i) - i < open.length, `a switch's first call is ${first}`);
  }
  assert.equal((perm.match(/permissions\.request\(/g) || []).length, 3, "three requests: a preset site's switch (onAllow), a chosen site's, and D112's global switch (onAllowGlobal)");
  assert.doesNotMatch(perm.slice(at(perm, "async function refresh() {"), at(perm, "for (const id of DISPLAY_ORDER)")), /permissions\.request/, "never on load");
  // T11's "Allow draft on <site>": ⭐ D112 b2 — the fill's popup on the page opens the ONE global-read ask's window
  // (DOCK_ACT allow-site → openGlobalAsk), whose Allow asks Chrome — the page itself asks nothing
  assert.match(read("extension/background.js"), /'allow-site': async \(tab\) => \{\s+const r = await openGlobalAsk\(tab, \{ force: true \}\);/);
  const opt = read("extension/options-auto.js");
  const fn = opt.slice(at(opt, "export function onSwitch(api,"), at(opt, "const hhmm ="));
  const firstCall = fn.indexOf("api.");
  assert.equal(fn.slice(firstCall, firstCall + 25), "api.permissions.request({", "the request is the handler's first chrome call");
  assert.ok(fn.indexOf("api.permissions.request(") < fn.indexOf("await"), "before any await");
  // ⭐ T31: "Always read here" moved here from the popup — its request is ITS handler's first call too
  // ⭐ T31: and the one-time card's one prompt (onConsentAll) — three requests, each its handler's first call
  assert.equal((opt.match(/permissions\.request\(/g) || []).length, 3);
  const all = opt.slice(at(opt, "export function onConsentAll(api) {"), at(opt, "export function onAlwaysHere("));
  assert.equal(firstOf(all), "api.permissions.request({", "onConsentAll's first chrome call is the request");
  const here = opt.slice(at(opt, "export function onAlwaysHere(api, here) {"), at(opt, "/** The site a deep link asks about"));
  assert.equal(firstOf(here), "api.permissions.request({", "onAlwaysHere's first chrome call is the request");
  assert.ok(here.indexOf("api.permissions.request(") < here.indexOf("await"), "before any await");
});

// ── 4 · the Options page, with a stub DOM ────────────────────────────────────────────────────────────

function fakeDoc() {
  const byId = new Map();
  const make = (tag, id = null) => {
    const el = {
      tagName: tag.toUpperCase(), id, children: [], listeners: {}, attrs: {}, textContent: "", className: "", hidden: false,
      disabled: false, checked: false, type: "",
      append(...xs) { this.children.push(...xs); },
      setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
      fire(t) { for (const fn of this.listeners[t] || []) fn({ type: t }); },
    };
    return el;
  };
  for (const id of ["auto-read", "auto-status", "auto-disclosure-title", "auto-disclosure-list", "auto-agree", "auto-agreed",
                    "auto-sites-body", "auto-kill", "auto-forget", "auto-reads", "auto-reads-list"]) byId.set(id, make("div", id));
  return { getElementById: (id) => byId.get(id) || null, createElement: (t) => make(t), byId };
}

test("⛔ D97 · Options: nothing is asked on load; nothing can be switched on before 'I agree'; a switch asks Chrome FIRST, inside the click", async () => {
  const { mount } = await import("../extension/options-auto.js");
  const calls = [];
  let settings = settingsWith({}, { consent: null });
  const api = {
    permissions: { request: (o) => { calls.push(["request", o.origins]); return Promise.resolve(true); } },
    runtime: {
      sendMessage: async (m) => {
        calls.push(["message", m.type]);
        if (m.type === "AUTO_READ_STATE") return { ok: true, settings, granted: {} };
        if (m.type === "AUTO_READ_CONSENT") { settings = { ...settings, consent: { at: Date.now(), scope: "all" } }; return { ok: true, settings }; }
        if (m.type === "AUTO_READ_SET") return { ok: true };
        return { ok: true };
      },
    },
  };
  const doc = fakeDoc();
  const ui = mount(doc, api);
  await ui.ready;
  assert.deepEqual(calls, [["message", "AUTO_READ_STATE"]], "load reads the state — and asks Chrome for nothing");
  assert.equal(ui.boxes.size, SITES.length * BEHAVIOURS.length);
  for (const [k, box] of ui.boxes) { assert.equal(box.disabled, true, `${k} is switchable before consent`); assert.equal(box.checked, false); }
  // the disclosure is on the page, in the code's words
  const shown = doc.byId.get("auto-disclosure-list").children.map(c => c.textContent).join("\n");
  for (const k of ["read", "prepare", "capture", "fill", "never"]) assert.ok(shown.includes(DISCLOSURE[k]), k);
  // agree
  doc.byId.get("auto-agree").fire("click");
  await new Promise(r => setTimeout(r, 0)); await ui.ready; await new Promise(r => setTimeout(r, 0));
  await ui.refresh();
  assert.equal(ui.boxes.get("workday:read").disabled, false, "after consent, a switch can be used");
  // the click: permissions.request is the FIRST thing that happens, synchronously in the change event
  calls.length = 0;
  const box = ui.boxes.get("workday:read");
  box.checked = true;
  box.fire("change");
  assert.deepEqual(calls[0], ["request", WD], "asked inside the gesture — before any await");
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(calls[1], ["message", "AUTO_READ_SET"]);
  // turning OFF never asks Chrome
  calls.length = 0;
  box.checked = false;
  box.fire("change");
  await new Promise(r => setTimeout(r, 0));
  assert.ok(!calls.some(c => c[0] === "request"));
});

test("⛔ D97 · the disclosure is the code's truth — and the listing's promises are still in it", () => {
  assert.match(DISCLOSURE.capture, /discards it if it does not, without storing it/);
  assert.match(DISCLOSURE.capture, /A page that is not a job posting — an application form included — sends nothing/);
  assert.match(DISCLOSURE.capture, /never shared with other people/);
  assert.match(DISCLOSURE.read, /Nothing is sent anywhere/);
  assert.match(DISCLOSURE.read, /never reads what you have typed or chosen, and never a password or payment field/);
  assert.match(DISCLOSURE.read, /30 days/);
  assert.match(DISCLOSURE.prepare, /On a page draft cannot link to your own job, nothing is sent/);
  assert.match(DISCLOSURE.fill, /never submits, never goes past Review, and never ticks a box/);
  assert.match(DISCLOSURE.never, /LinkedIn, Indeed or Glassdoor/);
  // the listing's own sentence stays true and stays there (J10 adds the rest)
  assert.match(read("extension/submission/STORE_LISTING.md"), /discards an irrelevant posting without\s+storing\s+it/);
  // the Options section: real checkboxes, none checked by default, no colour literal, no capsule, both themes by tokens
  const html = read("extension/options.html");
  assert.match(html, /<section id="auto-read"/);
  assert.doesNotMatch(html, /\bchecked\b(?!\s*=\s*"?false)/, "nothing on by default");
  const css = html.slice(at(html, "/* ⭐ D97 · the automatic switches."), at(html, "</style>"));
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|999px|50%|rounded-full/i);
  for (const m of css.matchAll(/border-radius:\s*(\d+)px/g)) assert.ok(Number(m[1]) <= 12, m[0]);
  assert.match(read("extension/tokens.css"), /@media \(prefers-color-scheme: dark\)/, "the tokens carry the dark theme");
});

// ── 5 · the watcher — ten rapid changes make ONE read ────────────────────────────────────────────────

function bootWatcher() {
  const page = { step: "My Information", count: 12 };
  const sent = [];
  let observerCb = null;
  const win = { listeners: {}, addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); } };
  const document = {
    body: {}, documentElement: {},
    querySelector: (sel) => (/progressBarActiveStep/.test(sel) ? { textContent: page.step } : null),
    querySelectorAll: () => ({ length: page.count }),
  };
  class MutationObserver { constructor(cb) { observerCb = cb; } observe() {} disconnect() { observerCb = null; } }
  const sandbox = {
    window: win, document, MutationObserver, location: { origin: T, pathname: "/en-US/Zoom/job/x/apply/applyManually" },
    chrome: { runtime: { sendMessage: (m) => { sent.push(m); return Promise.resolve(); } } },
    setTimeout: (...a) => setTimeout(...a), clearTimeout: (t) => clearTimeout(t), Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(read("extension/autoReadWatcher.js"), sandbox);
  return { page, sent, mutate: () => observerCb?.([]), win };
}

test("⛔ D97 · the watcher: ten mutation bursts in one second make exactly ONE read; a re-render without a step change makes none", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
  try {
    const w = bootWatcher();
    mock.timers.tick(900);
    assert.equal(w.sent.length, 1, "the page's first look");
    assert.deepEqual(Object.keys(w.sent[0]).sort(), ["signature", "type"]);
    assert.equal(w.sent[0].type, PAGE_MESSAGE);
    for (let i = 0; i < 10; i++) { w.page.step = `Step ${i}`; w.page.count = 12 + i; w.mutate(); mock.timers.tick(100); }
    assert.equal(w.sent.length, 1, "nothing while the burst lasts");
    mock.timers.tick(800);
    assert.equal(w.sent.length, 2, "ONE read for the ten changes");
    assert.match(w.sent[1].signature, /\|Step 9\|21$/);
    // re-renders that do not change the step or the count: nothing
    for (let i = 0; i < 10; i++) { w.mutate(); mock.timers.tick(100); }
    mock.timers.tick(5000);
    assert.equal(w.sent.length, 2);
    // a never-ending burst still reads within the max wait (3 s)
    for (let i = 0; i < 40; i++) { w.page.step = `Busy ${i}`; w.mutate(); mock.timers.tick(100); }
    assert.ok(w.sent.length >= 3, "the max wait bounds a page that never stops changing");
    // pagehide disconnects it
    const n = w.sent.length;
    for (const fn of w.win.listeners.pagehide) fn({});
    w.page.step = "After"; w.mutate(); mock.timers.tick(5000);
    assert.equal(w.sent.length, n);
  } finally { mock.timers.reset(); }
  const src = read("extension/autoReadWatcher.js");
  assert.doesNotMatch(src, /^\s*(import|export)\s/m, "a classic script");
  assert.doesNotMatch(src, /\bfetch\(|XMLHttpRequest|sendBeacon|\.value\b|\.checked\b|selectedIndex|innerText|innerHTML/, "no network, no value");
  assert.match(src, new RegExp(`type: '${PAGE_MESSAGE}'`));
});

// ── 6 · one pass — what each switch reads and sends ──────────────────────────────────────────────────

const SENTINEL = "SENTINEL-CHOSEN-OPTION-Bahamas";

test("⛔ D97 · Read makes ZERO network requests — the labels and counts stay on this computer, never a value", async () => {
  const h = installAutoReadChrome({ granted: WD, page: {
    pageFacts: FACTS(),
    collectFormLabels: { labels: ["First Name*", "Last Name*", "Country"], fieldCount: 4 },
  } });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { read: true } }));
  const r = await runAutoPass(tabOf(APPLY), { serverUrl: SERVER, signature: "a" });
  assert.deepEqual(r.done, ["read"]);
  assert.deepEqual(h.net, [], "nothing sent — not the URL, not a label");
  assert.equal(r.quality.line, "3 of 4 fields recognised — partial read — check these");
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.deepEqual(s.reads[0].labels, ["First Name*", "Last Name*", "Country"]);
  assert.equal(s.reads[0].host, "zoom.wd5.myworkdayjobs.com");
  assert.ok(!JSON.stringify(s.reads[0]).includes("applyManually"), "the host, never the path");
  assert.ok(h.injected.includes("renderBadge"), "the small badge — never a modal");
  const badge = h.injectedArgs.find(x => x.name === "renderBadge").args;
  assert.equal(badge[0], "ready");
  assert.equal(badge[1].text, "3 of 4 fields recognised — partial read — check these");
  h.restore();
});

test("⛔ D97 · the label reader never reads a value — a chosen dropdown option never appears (Workday labels a button by itself)", () => {
  const el = (tag, attrs = {}, children = [], text = "") => {
    const node = {
      tagName: tag.toUpperCase(), attrs, children: [], text, parent: null,
      get type() { return attrs.type || (tag === "button" ? "submit" : ""); },
      get id() { return attrs.id || ""; },
      get value() { throw new Error("value read"); },
      getAttribute(n) { return n in attrs ? attrs[n] : null; },
      get textContent() { return node.text + node.children.map(c => c.textContent).join(""); },
      closest(sel) { let n = node; while (n) { if (n.tagName === sel.toUpperCase()) return n; n = n.parent; } return null; },
      remove() { if (node.parent) node.parent.children = node.parent.children.filter(c => c !== node); },
      cloneNode() { return el(tag, { ...attrs }, node.children.map(c => c.cloneNode(true)), node.text); },
      querySelectorAll(list) {
        const sels = list.split(",").map(s => s.trim().match(/^([a-z]*)(?:\[([a-z-]+)(?:="([^"]*)")?\])?$/));
        const hit = (n) => sels.some(m => m && (!m[1] || n.tagName === m[1].toUpperCase()) && (!m[2] || (m[2] in n.attrs && (m[3] === undefined || n.attrs[m[2]] === m[3]))));
        const out = []; const walk = (n) => { for (const c of n.children) { if (hit(c)) out.push(c); walk(c); } }; walk(node); return out;
      },
    };
    for (const c of children) { c.parent = node; node.children.push(c); }
    return node;
  };
  const flow = el("div", { "data-automation-id": "applyFlowPage" }, [
    el("div", { id: "c-label" }, [], "Country"),
    el("button", { id: "c", "aria-haspopup": "listbox", "aria-labelledby": "c-label c", "aria-label": `Country ${SENTINEL}` }, [], SENTINEL),
    el("label", {}, [el("button", { "aria-haspopup": "listbox" }, [], SENTINEL)], "State "),
    el("input", { type: "text", autocomplete: "cc-number", "aria-label": "Card number" }),
    el("input", { type: "password", "aria-label": "Password" }),
  ]);
  const root = el("html", {}, [el("form", {}, [el("input", { type: "search", "aria-label": "Search jobs" })]), flow]);
  const saved = { document: globalThis.document, CSS: globalThis.CSS };
  globalThis.document = { querySelector: (s) => root.querySelectorAll(s)[0] || null };
  globalThis.CSS = { escape: (s) => s };
  try {
    const out = collectFormLabels();
    assert.deepEqual(out.labels, ["Country", "State"], "the apply flow, not the header search; no card number, no password");
    assert.equal(out.fieldCount, 2);
    assert.ok(!JSON.stringify(out).includes(SENTINEL), JSON.stringify(out));
  } finally { Object.assign(globalThis, saved); }
});

test("⛔ D97 · a Workday APPLICATION page with Capture on sends ZERO requests — the extractor never runs where applyFlowPage exists", async () => {
  const h = installAutoReadChrome({ granted: WD, page: {
    pageFacts: FACTS({ isApplyFlow: true }),
    collectFormLabels: { labels: ["Country"], fieldCount: 1 },
    pageHasJobPosting: true,
    // were it ever run here, the generic fallback would carry the chosen answers
    extractJobPayload: { ok: true, url: APPLY, title: "Software Engineer", company: "Zoom", text: `Country: ${SENTINEL}` },
  } });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { capture: true } }));
  for (const url of [APPLY, POSTING]) {
    const r = await runAutoPass(tabOf(url), { serverUrl: SERVER });
    assert.deepEqual(r.done, [], url);
  }
  assert.deepEqual(h.net, []);
  assert.ok(!h.injected.includes("extractJobPayload"));
  assert.ok(!h.injected.includes("pageHasJobPosting"), "an application page is not even checked for a posting");
  h.restore();
});

test("⭐ D97 · a Workday POSTING with Capture on is sent once to /api/import/auto, binds the tab — and no request body ever holds a chosen value", async () => {
  const h = installAutoReadChrome({ granted: WD, page: {
    pageFacts: FACTS({ isApplyFlow: false, step: "" }), collectFormLabels: { labels: [], fieldCount: 0 }, pageHasJobPosting: true,
    extractJobPayload: { ok: true, url: `${POSTING}?source=linkedin`, title: "Software Engineer", company: "Zoom", text: "Title: Software Engineer\nCompany: Zoom" },
  }, respond: () => ({ status: 200, body: { success: true, auto: true, job: { id: "wd::zoom::R19749" } } }) });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { capture: true } }));
  const tab = tabOf(`${POSTING}?source=linkedin`);
  const r = await runAutoPass(tab, { serverUrl: SERVER });
  assert.equal(r.capture.sent, true);
  assert.equal(h.net.length, 1);
  assert.match(h.net[0].url, /\/api\/import\/auto$/);
  assert.equal(h.stores.session.get(`bind:${tab.id}`)?.jobId, "wd::zoom::R19749", "the tab is bound to the captured job");
  for (const q of h.net) assert.ok(!String(q.body).includes(SENTINEL));
  h.restore();
});

test("⛔ D97 · Prepare WITHOUT a binding sends nothing; with one it is the only request, once per job", async () => {
  const h = installAutoReadChrome({ granted: WD, page: { pageFacts: FACTS(), collectFormLabels: { labels: ["First Name"], fieldCount: 1 } },
    respond: (url) => (/\/api\/apply\/prepare$/.test(url)
      ? { status: 200, body: { ok: true, packetId: 41, job: { jobId: "wd::zoom::R19749", title: "Software Engineer", company: "Zoom" }, origins: [T] } }
      : { status: 404, body: {} }) });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { read: true, prepare: true } }));
  const tab = tabOf(APPLY);
  let r = await runAutoPass(tab, { serverUrl: SERVER, signature: "1" });
  assert.deepEqual(r.done, ["read"]);
  assert.deepEqual(h.net, [], "unbound: not the address, not a hash");
  const { bindTab } = await import("../extension/tabBinding.js");
  await bindTab(tab, { jobId: "wd::zoom::R19749", title: "Software Engineer", company: "Zoom", via: "capture" });
  r = await runAutoPass(tab, { serverUrl: SERVER, signature: "2" });
  assert.deepEqual(r.done, ["read", "prepare"]);
  assert.equal(r.prepare.ok, true);
  assert.deepEqual(h.net.map(x => x.url), [`${SERVER}/api/apply/prepare`]);
  assert.deepEqual(Object.keys(JSON.parse(h.net[0].body)).sort(), ["boundJobId", "url"]);
  const badge = h.injectedArgs.filter(x => x.name === "renderBadge").at(-1).args[1].text;
  assert.equal(badge, "1 of 1 ready — press Ctrl+Shift+Y");
  await runAutoPass(tab, { serverUrl: SERVER, signature: "3" });
  assert.equal(h.net.length, 1, "prepared once per job per tab, not at every step");
  h.restore();
});

test("⛔ D97 · Fill OFF → no fill without the keystroke; a password (sign-in) page → nothing read, nothing filled", async () => {
  const h = installAutoReadChrome({ granted: WD, page: { pageFacts: FACTS(), collectFormLabels: { labels: ["Email"], fieldCount: 1 } } });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { read: true } }));
  const tab = tabOf(APPLY);
  const { bindTab } = await import("../extension/tabBinding.js");
  await bindTab(tab, { jobId: "j", via: "capture" });
  const r = await runAutoPass(tab, { serverUrl: SERVER });
  assert.ok(!r.done.includes("fill") && !r.done.includes("prepare"));
  assert.ok(!h.injected.some(n => ["probeFormShape", "applyPlan", "advanceWizard"].includes(n)));
  assert.deepEqual(h.net, []);
  h.page.pageFacts = FACTS({ hasPassword: true, step: "Sign In" });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { read: true, prepare: true, fill: true, capture: true } }));
  const s = await runAutoPass(tabOf(APPLY), { serverUrl: SERVER });
  assert.equal(s.skipped, "sign_in_page");
  assert.ok(!h.injected.includes("collectFormLabels") || h.injected.lastIndexOf("collectFormLabels") < h.injected.lastIndexOf("pageFacts"),
    "the labels of a sign-in page are not read");
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⛔ D97 · the watcher's pass is one at a time per tab — a step change during a pass runs ONE more pass after it", async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  let facts = 0;
  const h = installAutoReadChrome({ granted: WD, page: {
    pageFacts: async () => { facts++; if (facts === 1) await gate; return FACTS(); },
    collectFormLabels: { labels: ["A"], fieldCount: 1 },
  } });
  const tab = tabOf(APPLY);
  h.tab = tab;
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { read: true } }));
  const first = handlers[PAGE_MESSAGE]({ signature: "s1" }, { tab, frameId: 0 });
  await new Promise(r => setTimeout(r, 5));
  for (let i = 2; i <= 10; i++) assert.equal((await handlers[PAGE_MESSAGE]({ signature: `s${i}` }, { tab, frameId: 0 })).queued, true);
  release();
  await first;
  assert.equal(facts, 2, "ten messages during one pass → the pass, then ONE trailing pass");
  assert.equal((await handlers[PAGE_MESSAGE]({ signature: "x" }, { tab, frameId: 3 })).ignored, "not_a_top_frame");
  h.restore();
});

test("D97 · read quality — a named, PROVISIONAL threshold (owner decides)", () => {
  assert.equal(GOOD_READ_RATIO, 0.8);
  assert.match(read("extension/autoRead.js"), /⚠ PROVISIONAL — the owner decides/);
  assert.equal(readQuality({ total: 18, recognised: 14 }).line, "14 of 18 fields recognised — partial read — check these");
  assert.equal(readQuality({ total: 18, recognised: 15 }).line, "15 of 18 fields recognised — good read");
  assert.equal(readQuality({ total: 0 }).total, 0);
  assert.equal(readBadgeText(readQuality({ total: 18, recognised: 14 }), { prepared: true }), "14 of 18 ready — press Ctrl+Shift+Y");
  // stored reads keep 30 days, labels only
  const old = normaliseSettings({ reads: [{ site: "workday", at: Date.now() - 31 * 86400000, labels: ["x"] }, { site: "workday", at: Date.now(), labels: ["y"], value: SENTINEL }] });
  assert.equal(old.reads.length, 1);
  assert.ok(!JSON.stringify(old).includes(SENTINEL));
});

// ── 7 · the automatic FILL — the real handoff, the real routes ───────────────────────────────────────

function mountServer() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("UPDATE users SET form_schema_capture=1 WHERE id=1").run();   // ⛔ consent ON — an automatic fill still never captures
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume',unixepoch()-100)").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('wd::zoom::R19749','Software Engineer','Zoom',?,?,'t','hz',unixepoch()-86400)`).run(POSTING, POSTING);
  db.prepare("INSERT INTO user_jobs (user_id, job_id, starred) VALUES (1, 'wd::zoom::R19749', 1)").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  applyRoutes(app, db, (q, r, n) => n(), () => ({ field_map: { first_name: "Ada", last_name: "Example", email: "ada@example.test" }, handler_map: {}, custom_answers: {} }),
    async () => ({ error: "no model in tests" }), async () => Buffer.from("%PDF-1.4 synthetic"), async () => ({}), () => null);
  app.use("/api/import", createImportJobRouter(db));
  const server = app.listen(0);
  return { db, base: `http://127.0.0.1:${server.address().port}`, stop: () => { server.close(); db.close(); } };
}

const field = (index, label, extra = {}) => ({ index, label, type: "text", name: `f${index}`, id: `f${index}`, required: false, options: null, ...extra });
const SHAPE = (url, step) => ({
  hasForm: true, url, origin: T, hasPassword: false,
  wizard: { step, nextText: step === "Review" ? "Submit" : "Save and Continue", isReview: step === "Review" },
  fields: step === "Review" ? [] : [
    field(0, "First Name*"), field(1, "Last Name*"), field(2, "Email*", { type: "email" }),
    field(3, "I agree to the terms and conditions and certify that the information is true", { type: "checkbox" }),
    field(4, "Signature", { type: "text" }),
  ],
});

async function autoFillRun(srv, { auto }) {
  let step = "My Information";
  const tab = tabOf(APPLY);
  const h = installAutoReadChrome({ granted: WD, passthrough: true, tab, page: {
    pageFacts: () => FACTS({ step }),
    collectFormLabels: () => ({ labels: SHAPE(APPLY, step).fields.map(f => f.label), fieldCount: SHAPE(APPLY, step).fields.length }),
    probeFormShape: () => SHAPE(APPLY, step),
    applyPlan: (args) => ({ filled: args[0].map(s => ({ field: s.label, name: s.name, verified: true })), skipped: [], resume: null }),
    findMissingRequired: [],
    advanceWizard: () => { step = "Review"; return { ok: true, text: "Save and Continue" }; },
    wizardState: () => ({ step, errors: 0 }),
    renderOverlay: { ok: true, rendered: true }, renderBadge: { rendered: true }, badgeDismissed: false, removeReviewPanel: null,
  } });
  h.stores.local.set(AUTO_READ_KEY, settingsWith({ workday: { read: true, prepare: true, fill: true } }));
  const { bindTab } = await import("../extension/tabBinding.js");
  await bindTab(tab, { jobId: "wd::zoom::R19749", title: "Software Engineer", company: "Zoom", via: "capture" });
  let out;
  if (auto) out = await runAutoPass(tab, { serverUrl: srv.base, signature: "my-info" });
  else {
    const gh = await import("../extension/gated-handoff.js");
    out = await gh.prepareAndFill({ serverUrl: srv.base, tab });
  }
  return { h, out };
}

test("⛔ D97 · an AUTOMATIC fill: Save and Continue yes, Submit never, stops at Review; no consent / attestation / signature control; NEVER /api/apply/form-schema", async (t) => {
  const srv = mountServer(); t.after(srv.stop);
  // the control arm: a fill the user started (the keystroke's path) DOES send the form's structure when consent is on
  const manual = await autoFillRun(srv, { auto: false });
  assert.equal(manual.out.ok, true, manual.out.message);
  assert.ok(manual.h.net.some(r => /\/api\/apply\/form-schema$/.test(r.url) && r.method === "POST"), "the manual fill captures — proving the arm");
  manual.h.restore();
  srv.db.prepare("DELETE FROM apply_gate_packets").run();

  const { h, out } = await autoFillRun(srv, { auto: true });
  assert.deepEqual(out.done, ["read", "prepare", "fill"], JSON.stringify(out));
  assert.equal(out.fill.ok, true);
  assert.equal(out.fill.stoppedAt, "review", "it walked to Review and stopped there");
  assert.ok(!h.net.some(r => /\/api\/apply\/form-schema/.test(r.url)), "no consent read, no structure sent");
  assert.equal(h.injected.filter(n => n === "advanceWizard").length, 1, "Save and Continue once (owner 10-13) — never at Review");
  for (const { name, args } of h.injectedArgs.filter(x => x.name === "applyPlan")) {
    for (const s of args[0]) assert.doesNotMatch(s.label, /agree|certify|signature/i, `${name} was given ${s.label}`);
    assert.equal(args[2].auto, true, "the fill knows it is automatic");
  }
  // ⛔ no request body carries an answer the server prepared, or anything the page held
  for (const r of h.net) assert.ok(!String(r.body || "").includes("ada@example.test"), r.url);
  h.restore();
});

test("⛔ D97 · the gated-handoff seam is small: `auto` skips captureFormSchema, rides into applyPlan's options, and prepare can stop before the fill", () => {
  const src = read("extension/gated-handoff.js");
  assert.match(src, /const capture = opts\.auto\n\s+\? \{ attempted: false, reason: 'automatic_fill' \}\n\s+: await captureFormSchema\(/);
  assert.match(src, /if \(opts\.auto\) return \{ neverFillSource: NEVER_FILL_RE\.source, auto: true \};\n\s+return \{ neverFillSource: NEVER_FILL_RE\.source \};/);
  assert.match(src, /export async function prepareAndFill\(\{ serverUrl, tab, \.\.\.opts \}\)/);
  assert.match(src, /if \(opts\.fill === false\) return \{ ok: true, prepared: true,/);
  // the wizard's allowlist is unchanged: only a visible, enabled Save and Continue / Continue / Next is ever pressed
  assert.match(src, /const continueText = \/\^\(save and continue\|save & continue\|continue\|next\)\$\/i;/);
});

// ── 8 · the server: a discarded automatic capture changes NO table ──────────────────────────────────

test("⛔ D97 · a DISCARDED automatic capture changes no table's row count — the whole database, before and after", async (t) => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (7,1,'Current','engineering','general',1)").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use("/api/import", createImportJobRouter(db));
  const server = app.listen(0); t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const counts = () => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()
    .map(({ name }) => [name, db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get().n]));
  const before = counts();
  const res = await fetch(`${base}/api/import/auto`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${APPLY.replace("/apply/applyManually", "")}`, text: "Title: Enterprise Account Executive\nCompany: Zoom\nLocation: Austin, TX\n\nOwn a sales quota and close new business with enterprise customers." }) });
  const body = await res.json();
  assert.equal(body.discarded, true, JSON.stringify(body));
  assert.deepEqual(counts(), before, "a discarded posting leaves no row anywhere");
  // and the route canonicalises a Workday address before its per-URL brake (the brake keys per job)
  const route = read("routes/importJob.js");
  const auto = route.slice(at(route, 'router.post("/auto"'), at(route, "autoCaptureBrake(db"));
  assert.match(auto, /const url = pageKeyOf\(raw\)\?\.canonicalUrl \|\| raw;/);
});
