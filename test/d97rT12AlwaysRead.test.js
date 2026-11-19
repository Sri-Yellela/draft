// ⭐ D97 REVISED + T12 · READ AUTOMATICALLY AFTER ONE CONSENT, AND "ALWAYS READ HERE" (owner 10-14 / 10-15).
//
// The owner: "read has got to be automatic, we will seek permissions" (FIELD REPORT UPDATE 3), and the four decisions of
// 10-15 (43j): (1) the OPTIONAL host pattern https://*/* for T12 — nothing at install, each request names one origin
// from a click; (2) SmartRecruiters joins the preset sites; (3) the frames known before the click are LOCAL knowledge
// only (the tab's job, the frame site a press found, URL hints), with a second click as the fallback; (4) the one-time
// consent card lives in the popup only.
//
// The spec's tests: before consent nothing runs anywhere · one consent turns on the preset set with ONE prompt, the
// request the click's first call · a refusal leaves everything off · a company domain is offered "Always read here",
// asked inside the click, a refusal leaves it off, revoking removes the registration, Options lists the same sites ·
// LinkedIn / Indeed / Glassdoor never · the kill switch · the manifest: https://*/* only in the OPTIONAL list.
//
// The REAL autoRead.js handlers, the REAL options-auto.js and options-permissions.js (⭐ T31: the retired popup's card and
// "Always read here" are Settings' now) against a stub DOM and a fake `chrome`
// (test-support/autoReadChrome.mjs). Synthetic people and companies only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";
import {
  SITES, OPTIONAL_ORIGINS, MANIFEST_OPTIONAL_HOSTS, ANY_SITE_PATTERN, BEHAVIOURS, AUTO_READ_KEY, PAGE_MESSAGE, CARD, ALWAYS,
  defaultSettings, normaliseSettings, autoStep, scopeFor, popupAutoView, customOriginFor, looksLikeJobPage, knownFrameSites, siteById,
  desiredRegistrations, syncRegistrations, runAutoPass, handlers, onPermissionsRemoved, siteFor, hasPostingUrlShape, autoLine, pendingClick,
} from "../extension/autoRead.js";
import { installAutoReadChrome, settingsWith } from "../test-support/autoReadChrome.mjs";
import { at } from "../test-support/sourceAnchors.js";
import { D191_HOSTS, D191_CONTENT_SCRIPTS } from "../test-support/d191Manifest.mjs";   // ⭐ D191: the boards at install (owner 11-18)

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));
const EXT = { id: "test", url: "chrome-extension://test/options.html" };        // Settings, an extension page
const ACME = "https://careers.acme.test";
const ACME_APPLY = `${ACME}/jobs/search?gh_jid=8198280`;
const ACME_PATTERN = `${ACME}/*`;
const GH = ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"];
const GH_FRAME = "https://job-boards.greenhouse.io/embed/job_app?for=acme&token=8198280";
const WD_APPLY = "https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually";
const SERVER = "https://draft.test";
let tabN = 0;
const tabOf = (url) => ({ id: 9000 + (++tabN), url });
const FACTS = (origin, o = {}) => ({ origin, step: "", isApplyFlow: false, hasPassword: false, isReview: false, frames: [], ...o });

/** The popup / Options pages talk to the REAL handlers, as from the extension's own page. */
const wire = (h) => { chrome.runtime.sendMessage = async (m) => { const fn = handlers[m?.type]; return fn ? fn(m, EXT) : null; }; return h; };

// ── a stub DOM for the popup and Options ────────────────────────────────────────────────────────────────────────────
function fakeDoc(ids) {
  const byId = new Map();
  const make = (tag, id = null) => ({
    tagName: tag.toUpperCase(), id, children: [], listeners: {}, attrs: {}, dataset: {}, textContent: "", className: "", hidden: false,
    disabled: false, checked: false, type: "",
    append(...xs) { this.children.push(...xs); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    fire(t) { for (const fn of this.listeners[t] || []) fn({ type: t }); },
  });
  for (const id of ids) byId.set(id, make("div", id));
  return { getElementById: (id) => byId.get(id) || null, createElement: (t) => make(t), byId };
}
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)); };

/**
 * A fake chrome API for the settings page's clicks: records every call in order, the request first. ⭐ T31 (owner
 * 10-25): the toolbar popup is retired — its one-time card (one prompt for every preset site) and its "Always read here"
 * are Settings' (options-auto.js onConsentAll / onAlwaysHere); the dock's press OFFERS them (toolbarPress.js relayFor,
 * test/t31ToolbarPress.test.js) and Settings asks Chrome. The same handlers answer.
 */
function settingsApi(h, { grant = true } = {}) {
  const calls = [];
  const api = {
    permissions: {
      request: (o) => { calls.push(["request", [...o.origins]]); if (grant) o.origins.forEach(x => h.granted.add(x)); return Promise.resolve(grant); },
      contains: (o) => chrome.permissions.contains(o),
    },
    runtime: { sendMessage: async (m) => { calls.push(["message", m.type]); const fn = handlers[m?.type]; return fn ? fn(m, EXT) : null; } },
    storage: chrome.storage,
    tabs: { query: async () => (h.tab ? [h.tab] : []) },
  };
  return { api, calls };
}
/** What the dock's offer carries to Settings for this tab: the tab's origin and the frames draft knows it embeds. */
const hereFor = async (url, { jobId = null, noted = null } = {}) => {
  const { hereFromSearch } = await import("../extension/options-auto.js");
  const frames = knownFrameSites({ url, jobId, noted });
  return hereFromSearch(`?${new URLSearchParams({ here: customOriginFor(url), ...(frames.length ? { frames: frames.join(",") } : {}) })}`);
};

// ── 1 · the manifest ────────────────────────────────────────────────────────────────────────────────────────────────

test("⛔ manifest: https://*/* ONLY in optional_host_permissions — nothing new in host_permissions or permissions; ⭐ D112: requested whole ONLY by the one global-read ask and its Settings switch", () => {
  assert.deepEqual(manifest.optional_host_permissions, [...MANIFEST_OPTIONAL_HOSTS]);
  assert.equal(manifest.optional_host_permissions.at(-1), ANY_SITE_PATTERN);
  assert.equal(manifest.optional_host_permissions.filter(o => o === ANY_SITE_PATTERN).length, 1);
  assert.deepEqual(manifest.host_permissions, [...D191_HOSTS], "nothing at install");
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.deepEqual(manifest.optional_permissions, ["cookies"], "⭐⭐ D112 item 7: the one optional API permission");
  for (const k of ["host_permissions", "permissions"]) {
    assert.ok(!(manifest[k] || []).some(x => /\*:\/\/\*|https?:\/\/\*\/|<all_urls>/.test(x)), `${k} holds a broad pattern`);
  }
  // ⛔ SmartRecruiters joins the preset table (decision 2) — one host, https
  assert.ok(OPTIONAL_ORIGINS.includes("https://jobs.smartrecruiters.com/*"));
  assert.equal(siteFor("https://jobs.smartrecruiters.com/Acme/744000012345678-software-engineer")?.id, "smartrecruiters");
  assert.equal(hasPostingUrlShape("https://jobs.smartrecruiters.com/Acme/744000012345678-software-engineer"), true);
  // the pattern lives in ONE constant and no request names it: every request in the shipped code is a site's list, the
  // presets, one origin's pattern, or a known frame's origins
  const files = collectRequiredFiles(manifest).filter(f => f.endsWith(".js"));
  const withPattern = files.filter(f => read(`extension/${f}`).includes("'https://*/*'"));
  // (formReport.js names it as a context-menu link filter — D55's "Save link to draft" — which grants nothing)
  assert.deepEqual(withPattern, ["autoRead.js", "formReport.js"]);
  assert.match(read("extension/formReport.js"), /targetUrlPatterns: Object\.freeze\(\['http:\/\/\*\/\*', 'https:\/\/\*\/\*'\]\)/);
  for (const f of files) {
    const src = read(`extension/${f}`);
    assert.doesNotMatch(src, /permissions\.request\([^)]*(ANY_SITE_PATTERN|MANIFEST_OPTIONAL_HOSTS|\*:\/\/|https:\/\/\*\/\*)/, f);
  }
  // ⭐⭐ D112 (owner 10-30, T35 = A): T12's "the pattern itself is never requested" is REVERSED, deliberately — the broad
  // pattern is requested whole (GLOBAL_ORIGINS) in exactly two clicks: the ask window's Allow and Settings' global switch
  const global = files.filter(f => /permissions\.request\(\{ origins: \[\.\.\.GLOBAL_ORIGINS\] \}\)/.test(read(`extension/${f}`))).sort();
  assert.deepEqual(global, ["global-ask.js", "options-permissions.js"]);
  // the rationale and the listing say so
  const why = read("extension/MANIFEST_RATIONALE.md");
  assert.match(why, /`https:\/\/\*\/\*`/);
  assert.match(why, /reversed for the OPTIONAL list only/i);
  assert.match(why, /nothing is granted at install/i);
  assert.match(why, /`https:\/\/jobs\.smartrecruiters\.com\/\*`/);
  const listing = read("extension/submission/STORE_LISTING.md");
  assert.match(listing, /https:\/\/\*\/\*/);
  assert.match(listing, /Always read here/);
});

// ── 2 · before consent ──────────────────────────────────────────────────────────────────────────────────────────────

test("⛔ before consent NOTHING runs anywhere — no registration, no pass, with every grant in place; the popup shows the card", async () => {
  const h = installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS, ACME_PATTERN], page: { pageFacts: FACTS(ACME), collectFormLabels: { labels: ["First Name"], fieldCount: 1 } } });
  const d = defaultSettings();
  assert.equal(d.consent2, null);
  assert.deepEqual(d.custom, {});
  assert.deepEqual(await desiredRegistrations(d), []);
  for (const url of [WD_APPLY, "https://job-boards.greenhouse.io/acme/jobs/8198280", ACME_APPLY]) {
    const r = await runAutoPass(tabOf(url), { serverUrl: SERVER });
    assert.ok(r.skipped, `${url} ran: ${JSON.stringify(r)}`);
  }
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  const v = popupAutoView({ settings: d, url: WD_APPLY, granted: { sites: { workday: true } } });
  assert.equal(v.card, true);
  assert.equal(v.line, null, "nothing says it reads before consent");
  h.restore();
});

test("⛔ an existing install (v1, agreed in Options) keeps its switches and STILL sees the card — no silent widening", () => {
  const v1 = settingsWith({ workday: { read: true } });            // v: 1, consent scope 'all'
  const s = normaliseSettings(v1);
  assert.equal(s.v, 2);
  assert.equal(s.consent2, null, "consent2 is never inferred");
  assert.deepEqual(s.sites.workday, { read: true, prepare: false, capture: false, fill: false });
  assert.deepEqual(s.sites.greenhouse, { read: false, prepare: false, capture: false, fill: false }, "nothing new is switched on");
  assert.equal(popupAutoView({ settings: s, url: WD_APPLY, granted: { sites: { workday: true } } }).card, true);
});

// ── 3 · the one-time card ───────────────────────────────────────────────────────────────────────────────────────────

test("⭐ ONE consent turns on the preset set with ONE prompt — the request is the click's first call; Capture and Fill stay off", async () => {
  const h = wire(installAutoReadChrome({ granted: [] }));
  h.tab = tabOf(WD_APPLY);
  // ⭐ T31: the press offers it on a preset site before any consent; Settings' "Allow on these sites" is the click
  assert.equal(popupAutoView({ settings: defaultSettings(), url: WD_APPLY }).card, true, "offered before any consent");
  const { onConsentAll } = await import("../extension/options-auto.js");
  const { api, calls } = settingsApi(h);
  const r = onConsentAll(api);
  assert.deepEqual(calls[0], ["request", [...OPTIONAL_ORIGINS]], "asked inside the gesture, before anything else");
  const done = await r;
  await flush();
  assert.equal(calls.filter(c => c[0] === "request").length, 1, "ONE prompt for the whole set");
  // ⭐ T20: then — in the same turn, after the request — the click is said to the worker (Chrome's answer can outlive the
  // handler), and the page's own consent message follows when it lives to see the grant
  assert.deepEqual(calls[1], ["message", "AUTO_READ_PENDING"]);
  assert.deepEqual(calls[2], ["message", "AUTO_READ_CONSENT_ALL"]);
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.ok(s.consent2?.at, "the consent is recorded");
  for (const site of SITES) {
    assert.deepEqual(s.sites[site.id], { read: true, prepare: true, capture: false, fill: false }, site.id);
  }
  assert.deepEqual([...h.registered.keys()].sort(), SITES.map(x => `draft-auto-read-${x.id}`).sort(), "every preset site's watcher");
  assert.equal(done.message, CARD.done);
  assert.equal(popupAutoView({ settings: s, url: WD_APPLY }).card, false, "never offered again once agreed");
  // ⭐ T20: the tab already open on a site just allowed is given the watcher at once — no reload, no press
  assert.deepEqual(h.injectedArgs.filter(x => x.name === "file:autoReadWatcher.js").map(x => x.target), [{ tabId: h.tab.id, allFrames: false }]);
  assert.equal(pendingClick(), null, "the pending click is finished");
  h.restore();
});

test("⛔ a refusal of the card's prompt leaves EVERYTHING off and says so — nothing is written", async () => {
  const h = wire(installAutoReadChrome({ granted: [] }));
  h.tab = tabOf(WD_APPLY);
  const { onConsentAll } = await import("../extension/options-auto.js");
  const { api, calls } = settingsApi(h, { grant: false });
  const r = await onConsentAll(api);
  await flush();
  // T20: the click was said to the worker (it cannot know yet that Chrome will refuse), and dropped on the refusal —
  // nothing that turns anything on is sent
  assert.deepEqual(calls, [["request", [...OPTIONAL_ORIGINS]], ["message", "AUTO_READ_PENDING"], ["message", "AUTO_READ_PENDING_CLEAR"]], "no consent after a refusal");
  assert.equal(pendingClick(), null, "the refused click is dropped");
  assert.ok(!h.injected.includes("file:autoReadWatcher.js"), "nothing injected");
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined, "nothing written");
  assert.equal(h.registered.size, 0);
  assert.equal(r.message, CARD.refused);
  assert.match(CARD.refused, /nothing is on/);
  // and the handler itself refuses without Chrome's grant, and from anything but an extension page
  assert.equal((await handlers.AUTO_READ_CONSENT_ALL({ agree: true }, EXT)).error, "not_granted");
  h.granted.add(GH[0]); h.granted.add(GH[1]);
  const page = { tab: { id: 1, url: WD_APPLY }, url: WD_APPLY, frameId: 0 };
  assert.equal((await handlers.AUTO_READ_CONSENT_ALL({ agree: true }, page)).error, "not_allowed");
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined);
  h.restore();
});

test("D97 REVISED · 'Not now' hides the offer for two weeks and changes no switch", async () => {
  const h = wire(installAutoReadChrome({ granted: [] }));
  // ⭐ T31: the dock's offer's Later (DOCK_ACT auto-later) is the worker's AUTO_READ_LATER, as the popup card's was
  assert.match(read("extension/background.js"), /'auto-later': async \(\) => \{\n\s+await AUTO_READ_HANDLERS\.AUTO_READ_LATER\(/);
  assert.equal((await handlers.AUTO_READ_LATER({}, EXT)).ok, true);
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.ok(Number.isFinite(s.later));
  assert.equal(s.consent2, null);
  assert.equal(popupAutoView({ settings: s, url: WD_APPLY }).card, false);
  assert.equal(popupAutoView({ settings: s, url: WD_APPLY, now: s.later + 15 * 86400000 }).card, true, "it asks once more later");
  h.restore();
});

// ── 4 · T12 · "Always read here" ────────────────────────────────────────────────────────────────────────────────────

test("⭐ T12 · a company domain that looks like a job page is offered 'Always read here' — never a preset site, draft's own, or LinkedIn / Indeed / Glassdoor", () => {
  const s = defaultSettings();
  const v = popupAutoView({ settings: s, url: ACME_APPLY });
  assert.equal(v.here?.origin, ACME);
  assert.equal(v.here.on, false);
  assert.deepEqual(v.here.frames.map(f => f.id), ["greenhouse"], "gh_jid= names Greenhouse — a URL hint, no frame read");
  assert.deepEqual(v.here.origins, [ACME_PATTERN, ...GH], "the click will ask for this origin and its known ATS frame");
  assert.equal(v.disclose, true, "the disclosure shows on first use");
  assert.equal(popupAutoView({ settings: s, url: "https://stripe.com/jobs/listing/backend-engineer/7104562" }).here?.origin, "https://stripe.com");
  // not a job-looking address, and not bound → not offered
  assert.equal(popupAutoView({ settings: s, url: "https://acme.test/blog/hello" }).here, null);
  assert.equal(popupAutoView({ settings: s, url: "https://acme.test/blog/hello", bound: true }).here?.origin, "https://acme.test", "a tab bound to a job is offered");
  for (const u of ["https://www.linkedin.com/jobs/view/1", "https://www.indeed.com/viewjob?jk=1", "https://www.glassdoor.com/job-listing/x",
                   "https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01", "https://acme.wd5.myworkdayjobs.com/en-US/acme/job/x",
                   "https://jobsviadraft.com/app/jobs", "http://careers.acme.test/jobs/1", "https://127.0.0.1/jobs/1", "https://localhost/jobs"]) {
    assert.equal(popupAutoView({ settings: s, url: u, bound: true }).here, null, u);
    assert.equal(customOriginFor(u), null, u);
  }
  assert.equal(looksLikeJobPage("https://careers.acme.test/"), true);
  assert.equal(looksLikeJobPage("https://acme.test/about"), false);
  // the other local hints: the tab's bound job names its family; the frame a press found is remembered per origin
  assert.deepEqual(knownFrameSites({ url: "https://acme.test/careers/123", jobId: "lever::acme::3f6a2c1e" }), ["lever"]);
  assert.deepEqual(knownFrameSites({ url: "https://acme.test/careers/123?ashby_jid=9", noted: "greenhouse" }), ["greenhouse", "ashby"]);
  assert.deepEqual(knownFrameSites({ url: "https://job-boards.greenhouse.io/acme/jobs/1?gh_jid=1" }), [], "a site's own frames are not 'embedded'");
});

test("⭐ T12 · the switch asks Chrome INSIDE the click, for this origin + its known frame; a refusal leaves it off", async () => {
  const h = wire(installAutoReadChrome({ granted: [] }));
  h.tab = tabOf(ACME_APPLY);
  // offered at once on this page (⭐ T31: by the dock's press — relayFor; the words are Settings')
  assert.equal(popupAutoView({ settings: defaultSettings(), url: ACME_APPLY }).here?.origin, ACME);
  const here = await hereFor(ACME_APPLY);
  assert.match(ALWAYS.hint(here.host, here.frames.map(id => siteById(id).name)), /careers\.acme\.test and Greenhouse — this site only/);
  const { onAlwaysHere } = await import("../extension/options-auto.js");
  const { api, calls } = settingsApi(h, { grant: false });
  const r = onAlwaysHere(api, here);
  assert.deepEqual(calls[0], ["request", [ACME_PATTERN, ...GH]], "the request is the click's first call");
  const done = await r;
  await flush();
  assert.deepEqual(calls.map(c => c.join(" ")), [`request ${ACME_PATTERN},${GH.join(",")}`, "message AUTO_READ_PENDING", "message AUTO_READ_PENDING_CLEAR"], "refused → no consent sent");
  assert.ok(!h.injected.includes("file:autoReadWatcher.js"), "nothing injected");
  assert.equal(h.stores.local.get(AUTO_READ_KEY), undefined, "nothing written");
  assert.equal(h.registered.size, 0);
  assert.equal(done.message, ALWAYS.refused("careers.acme.test"));
  h.restore();
});

test("⭐ T12 · granted → Read + Prepare on for THIS origin (Capture, Fill off), one registration covering it and its frame in every frame; the pass runs in the frame", async () => {
  const h = wire(installAutoReadChrome({ granted: [], page: {
    pageFacts: (_args, target) => (target?.frameIds ? FACTS("https://job-boards.greenhouse.io") : FACTS(ACME, { frames: [GH_FRAME] })),
    collectFormLabels: { labels: ["First Name *", "Last Name *", "Email *", "Phone"], fieldCount: 4 },
  } }));
  h.tab = tabOf(ACME_APPLY);
  const { onAlwaysHere } = await import("../extension/options-auto.js");
  const { api, calls } = settingsApi(h);
  await onAlwaysHere(api, await hereFor(ACME_APPLY));
  await flush();
  assert.deepEqual(calls.map(c => c.join(" ")), [`request ${ACME_PATTERN},${GH.join(",")}`, "message AUTO_READ_PENDING", "message AUTO_READ_ALLOW_SITE"]);
  // ⭐ T20: the careers tab already open is given the watcher in EVERY frame (its form is the Greenhouse frame)
  assert.deepEqual(h.injectedArgs.filter(x => x.name === "file:autoReadWatcher.js").map(x => x.target), [{ tabId: h.tab.id, allFrames: true }]);
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.deepEqual(s.custom[ACME], { read: true, prepare: true, capture: false, fill: false, frames: ["greenhouse"], at: s.custom[ACME].at });
  assert.equal(s.consent2, null, "T12 does not turn on the preset set");
  assert.equal(s.sites.greenhouse.read, false, "nor Greenhouse's own pages");
  const reg = h.registered.get("draft-auto-read-c-careers.acme.test");
  assert.deepEqual(reg?.matches, [ACME_PATTERN, ...GH]);
  assert.equal(reg.allFrames, true, "all_frames — the form is in the ATS frame");
  assert.deepEqual(reg.excludeMatches, ["https://*.linkedin.com/*", "https://*.indeed.com/*", "https://*.glassdoor.com/*"]);
  assert.deepEqual(reg.js, ["autoReadWatcher.js"]);
  assert.equal(h.registered.size, 1, "nothing else is registered");
  assert.equal(popupAutoView({ settings: s, url: ACME_APPLY, granted: { here: true, sites: {} } }).here?.on, true, "chosen: the press offers it no more");
  // autoStep accepts the custom origin; the top pass leaves the form to the frame's own pass
  const tab = h.tab;
  const top = await runAutoPass(tab, { serverUrl: SERVER, signature: "top" });
  assert.deepEqual(top.done, [], "the top page's own controls are not the application");
  assert.ok(!h.injected.includes("collectFormLabels"), "the form is read in its frame, not the top page");
  // the frame's message
  const m = await handlers[PAGE_MESSAGE]({ type: PAGE_MESSAGE, signature: "frame" }, { tab, frameId: 7, url: GH_FRAME });
  assert.deepEqual(m.done, ["read"], JSON.stringify(m));
  const lastLabels = h.injectedArgs.filter(x => x.name === "collectFormLabels").length;
  assert.equal(lastLabels, 1);
  assert.deepEqual(h.net, [], "Read sends nothing (unbound: Prepare sends nothing either)");
  const after = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.equal(after.reads[0].host, "careers.acme.test", "the site the user is on — never a path");
  assert.equal(after.reads[0].site, "custom");
  assert.equal(after.reads[0].total, 4);
  assert.match(autoLine(after, "careers.acme.test"), /^Reading automatically on this site · last read \d\d:\d\d$/);
  // a frame message from a site NOT allowed there, or from a non-ATS frame, does nothing
  assert.equal((await handlers[PAGE_MESSAGE]({ signature: "x" }, { tab, frameId: 8, url: "https://jobs.lever.co/acme/1" })).skipped, "frame_not_allowed");
  assert.equal((await handlers[PAGE_MESSAGE]({ signature: "x" }, { tab, frameId: 9, url: "https://ads.example.test/x" })).ignored, "not_a_top_frame");
  h.restore();
});

test("⭐ T12 · a frame NOT known before the click: the first grant covers the page; a pass notes the frame; the SECOND click asks for it", async () => {
  const URL0 = `${ACME}/careers/backend-engineer`;          // no hint in the address, no binding
  const h = wire(installAutoReadChrome({ granted: [], page: {
    pageFacts: () => FACTS(ACME, { frames: [GH_FRAME] }), collectFormLabels: { labels: ["Email me new jobs"], fieldCount: 1 },
  } }));
  h.tab = tabOf(URL0);
  const { onAlwaysHere } = await import("../extension/options-auto.js");
  let p = settingsApi(h);
  await onAlwaysHere(p.api, await hereFor(URL0));
  await flush();
  assert.deepEqual(p.calls[0], ["request", [`${ACME}/*`]], "only the page — nothing was known about its frame");
  // the automatic pass on the page finds the Greenhouse frame it may not read yet, and remembers which site (local)
  await runAutoPass(h.tab, { serverUrl: SERVER, signature: "1" });
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.equal(s.frameHints[ACME], "greenhouse");
  // the press now offers the second click (⭐ T31: relayFor's frameAsk); Settings asks for the frame alone
  const v = popupAutoView({ settings: s, url: URL0, granted: { here: true, sites: {} } });
  assert.deepEqual([v.frameAsk?.site, v.frameAsk?.name], ["greenhouse", "Greenhouse"]);
  const ask = await hereFor(URL0, { noted: s.frameHints[ACME] });
  const here = { ...ask, existing: true, frames: ["greenhouse"], origins: [...GH] };
  p = settingsApi(h);
  const done = await onAlwaysHere(p.api, here);
  assert.deepEqual(p.calls[0], ["request", GH], "the second click's first call");
  await flush();
  assert.deepEqual(p.calls[1], ["message", "AUTO_READ_PENDING"]);
  assert.deepEqual(p.calls[2], ["message", "AUTO_READ_ALLOW_FRAME"], "a site already chosen only gains its frame — its own switches stay as they are");
  assert.equal(done.message, "draft reads Greenhouse's form on careers.acme.test now.");
  assert.deepEqual(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).custom[ACME].frames, ["greenhouse"]);
  assert.deepEqual(h.registered.get("draft-auto-read-c-careers.acme.test").matches, [`${ACME}/*`, ...GH], "the registration now covers the frame");
  h.restore();
});

test("⭐ T12 · revoking removes the registration — at chrome://extensions, from Settings → Permissions' switch, and by Remove in Options (which lists the same sites)", async () => {
  const h = wire(installAutoReadChrome({ granted: [ACME_PATTERN, ...GH] }));
  const allow = () => handlers.AUTO_READ_ALLOW_SITE({ origin: ACME, frames: ["greenhouse"] }, EXT);
  assert.equal((await allow()).ok, true);
  assert.ok(h.registered.has("draft-auto-read-c-careers.acme.test"));
  // (1) Chrome takes the origin away → the site goes, its watcher goes
  h.granted.delete(ACME_PATTERN);
  await onPermissionsRemoved({ origins: [ACME_PATTERN] });
  assert.deepEqual(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).custom, {});
  assert.equal(h.registered.size, 0);
  // (2) its switch turned off (⭐ T31: Settings → Permissions' row for a chosen site — the popup's switch is retired) →
  // the access is given back, the frame site too (nothing else needs it); turning off never asks Chrome
  h.granted.add(ACME_PATTERN);
  await allow();
  const requested = [];
  const { mount: mountPermissions } = await import("../extension/options-permissions.js");
  const pdoc = fakeDoc(["perm-rows", "perm-status"]);
  pdoc.byId.get("perm-rows").textContent = "";
  const papi = {
    runtime: { getManifest: () => ({ host_permissions: ["https://jobsviadraft.com/*"] }), sendMessage: async (m) => { const fn = handlers[m?.type]; return fn ? fn(m, EXT) : null; } },
    permissions: { request: (o) => { requested.push(o.origins); return Promise.resolve(true); }, remove: async () => true, getAll: async () => ({ origins: [...h.granted] }),
      onAdded: { addListener() {} }, onRemoved: { addListener() {} } },
  };
  await mountPermissions(pdoc, papi).ready;
  const permRows = pdoc.byId.get("perm-rows").children;
  const chosen = permRows.find(r => r.children[0].children[1].textContent === "careers.acme.test");
  assert.ok(chosen, "Settings → Permissions lists the chosen site");
  const sw = chosen.children[0].children[0];
  assert.equal(sw.checked, true);
  sw.checked = false; sw.fire("change");
  await flush();
  assert.deepEqual(requested, [], "turning off never asks Chrome");
  assert.deepEqual(h.removed.slice(-3), [ACME_PATTERN, ...GH]);
  assert.equal(h.registered.size, 0);
  // (3) Options lists the same site, with the same four switches and Remove
  h.granted.add(ACME_PATTERN); GH.forEach(o => h.granted.add(o));
  await allow();
  const { mount } = await import("../extension/options-auto.js");
  const ids = ["auto-read", "auto-status", "auto-disclosure-title", "auto-disclosure-list", "auto-agree", "auto-agreed",
    "auto-sites-body", "auto-kill", "auto-forget", "auto-reads", "auto-reads-list", "auto-custom", "auto-custom-body", "auto-custom-empty"];
  const doc = fakeDoc(ids);
  const optCalls = [];
  const api = {
    permissions: { request: (o) => { optCalls.push(["request", o.origins]); return Promise.resolve(true); } },
    runtime: { sendMessage: async (m) => { optCalls.push(["message", m.type]); return handlers[m.type](m, { id: "test", url: "chrome-extension://test/options.html" }); } },
  };
  const ui = mount(doc, api);
  await ui.ready;
  const rows = doc.byId.get("auto-custom-body").children;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].children[0].children[0].textContent, "careers.acme.test");
  assert.equal(doc.byId.get("auto-custom").hidden, false);
  assert.equal(doc.byId.get("auto-custom-empty").hidden, true);
  for (const b of BEHAVIOURS) assert.ok(ui.boxes.has(`${ACME}:${b}`), b);
  assert.equal(ui.boxes.get(`${ACME}:read`).checked, true);
  assert.equal(ui.boxes.get(`${ACME}:capture`).checked, false, "Capture stays off");
  // Options' Capture switch for the custom site: asks Chrome for the one origin FIRST
  optCalls.length = 0;
  const cap = ui.boxes.get(`${ACME}:capture`);
  cap.checked = true; cap.fire("change");
  assert.deepEqual(optCalls[0], ["request", [ACME_PATTERN]]);
  await flush();
  assert.equal(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).custom[ACME].capture, true);
  // Remove
  ui.removes.get(ACME).fire("click");
  await flush();
  assert.deepEqual(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).custom, {});
  assert.equal(h.registered.size, 0, "unregistered");
  assert.ok(h.removed.includes(ACME_PATTERN), "the access given back");
  h.restore();
});

test("⛔ T12 · LinkedIn / Indeed / Glassdoor never — the handler refuses them (and preset sites, draft's own, http) whatever Chrome grants", async () => {
  const h = installAutoReadChrome({ granted: ["https://www.linkedin.com/*", "https://www.indeed.com/*", "https://www.glassdoor.com/*", "https://jobsviadraft.com/*", ...GH] });
  for (const origin of ["https://www.linkedin.com", "https://www.indeed.com", "https://www.glassdoor.com", "https://uk.indeed.com",
                        "https://job-boards.greenhouse.io", "https://jobsviadraft.com", "http://careers.acme.test", "https://careers.acme.test:8443"]) {
    assert.equal((await handlers.AUTO_READ_ALLOW_SITE({ origin, frames: [] }, EXT)).error, "bad_site", origin);
  }
  // a forced entry in storage is dropped on read, and a forced pass refuses
  h.stores.local.set(AUTO_READ_KEY, { ...settingsWith({}), custom: { "https://www.linkedin.com": { read: true, prepare: true, frames: [] } } });
  assert.deepEqual(normaliseSettings(h.stores.local.get(AUTO_READ_KEY)).custom, {});
  assert.equal((await runAutoPass(tabOf("https://www.linkedin.com/jobs/view/1"), { serverUrl: SERVER })).skipped, "never_host");
  assert.equal(scopeFor(normaliseSettings({ custom: { [ACME]: { read: true, frames: ["greenhouse"] } } }), ACME_APPLY, "https://www.linkedin.com/embed").skip, "never_host");
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⛔ THE KILL SWITCH stops everything — custom sites removed, their access given back, the remembered frame sites forgotten, the card offered again", async () => {
  const h = wire(installAutoReadChrome({ granted: [...OPTIONAL_ORIGINS, ACME_PATTERN] }));
  await handlers.AUTO_READ_CONSENT_ALL({ agree: true }, EXT);
  await handlers.AUTO_READ_ALLOW_SITE({ origin: ACME, frames: ["greenhouse"] }, EXT);
  h.stores.local.set(AUTO_READ_KEY, { ...h.stores.local.get(AUTO_READ_KEY), frameHints: { "https://stripe.com": "greenhouse" } });
  await syncRegistrations();
  assert.equal(h.registered.size, SITES.length + 1);
  const r = await handlers.AUTO_READ_KILL({}, EXT);
  assert.equal(r.ok, true);
  assert.deepEqual(r.settings.custom, {});
  assert.deepEqual(r.settings.frameHints, {});
  for (const s of SITES) for (const b of BEHAVIOURS) assert.equal(r.settings.sites[s.id][b], false);
  assert.equal(h.registered.size, 0);
  assert.ok(h.removed.includes(ACME_PATTERN), "the custom site's access too");
  assert.deepEqual(h.granted, new Set());
  for (const url of [ACME_APPLY, WD_APPLY]) assert.equal(autoStep({ settings: r.settings, url, granted: true }).skip, "kill_switch");
  assert.equal(popupAutoView({ settings: r.settings, url: WD_APPLY }).card, true, "the card can turn it back on");
  h.restore();
});

test("⛔ T12 · a custom site's sign-in page reads nothing; Capture and Fill stay separate and default OFF", async () => {
  const h = installAutoReadChrome({ granted: [ACME_PATTERN], page: {
    pageFacts: FACTS(ACME, { hasPassword: true }), collectFormLabels: { labels: ["Password"], fieldCount: 2 }, pageHasJobPosting: true,
  } });
  await handlers.AUTO_READ_ALLOW_SITE({ origin: ACME, frames: [] }, EXT);
  const r = await runAutoPass(tabOf(`${ACME}/jobs/123`), { serverUrl: SERVER });
  assert.equal(r.skipped, "sign_in_page");
  assert.ok(!h.injected.includes("collectFormLabels"));
  // a custom posting with Capture OFF (the default) sends nothing; turned on in Options, it captures (JSON-LD)
  h.page.pageFacts = FACTS(ACME);
  h.page.collectFormLabels = { labels: [], fieldCount: 0 };
  const s = normaliseSettings(h.stores.local.get(AUTO_READ_KEY));
  assert.deepEqual(autoStep({ settings: s, url: `${ACME}/jobs/123`, granted: true, facts: FACTS(ACME, { jsonLdPosting: true, fieldCount: 0 }) }).actions, []);
  assert.deepEqual(autoStep({ settings: { ...s, custom: { [ACME]: { ...s.custom[ACME], capture: true } } }, url: `${ACME}/jobs/123`, granted: true,
    facts: FACTS(ACME, { jsonLdPosting: true, fieldCount: 0 }) }).actions, ["capture"]);
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⛔ Settings' requests are each the FIRST call of their click handler — nothing awaited before them — and nothing asks on open (⭐ T31: the popup's three moved here)", () => {
  const src = read("extension/options-auto.js");
  for (const [start, end] of [["export function onConsentAll(api) {", "export function onAlwaysHere("],
                              ["export function onAlwaysHere(api, here) {", "/** The site a deep link asks about"],
                              ["export function onSwitch(api, {", "const hhmm ="]]) {
    const fn = src.slice(at(src, start), at(src, end));
    const first = fn.indexOf("api.");
    assert.equal(fn.slice(first, first + 25), "api.permissions.request({", `${start} — the request is its first chrome call`);
    assert.ok(fn.indexOf("api.permissions.request(") < fn.indexOf("await"), `${start} — before any await`);
  }
  // the page asks only from a click: "Allow on these sites" and the "Always read <site>" switch's change
  const draw = src.slice(at(src, "export function mount("), at(src, "/** ⭐ T29: the section as mounted"));
  assert.match(draw, /all\.addEventListener\('click', \(\) => \{\n\s+const asked = onConsentAll\(api\);/);
  assert.match(draw, /box\.addEventListener\('change', \(\) => \{\n\s+if \(!box\.checked\) return;\n\s+const asked = onAlwaysHere\(api, here\);/);
  assert.equal((draw.match(/permissions\.request\(/g) || []).length, 0, "mount itself asks nothing");
  // the offer's site comes from the TAB (background.js DOCK_ACT always-here), validated on the page (hereFromSearch)
  assert.match(read("extension/background.js"), /'always-here': async \(tab\) => \{\n\s+const origin = customOriginFor\(tab\?\.url\);/);
});

test("D97 REVISED · the copy is the code's truth — the card and the switch say Capture and Fill stay off, and the privacy page names the new sites", () => {
  assert.match(CARD.points[2], /does not add jobs to your account or fill forms for you unless you turn those on in Settings/);
  assert.match(ALWAYS.first, /never what you type or a password or payment field/);
  const privacy = read("client/src/pages/marketing/PrivacyPage.jsx");
  assert.match(privacy, /SmartRecruiters/);
  assert.match(privacy, /Always read here/);
  assert.match(privacy, /one\s+prompt/i);
});
