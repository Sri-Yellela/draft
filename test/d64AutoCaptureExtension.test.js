// ⭐ D64 · AUTOMATED CAPTURE — the extension's half (extension/autoCapture.js, background.js
// maybeAutoCapture, the Options switch, the manifest's optional hosts).
//
// ⛔ The row's tests: a non-posting page sends NOTHING (zero requests) · with the setting off nothing runs
// · the permission request names only the family origins · the fill still waits for a click. The REAL
// background.js is imported against a fake `chrome` and a counting `fetch`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AUTO_CAPTURE_ORIGINS, AUTO_CAPTURE_SETTING, autoCaptureStep, autoCaptureOriginFor, hasPostingUrlShape, pageHasJobPosting,
} from "../extension/autoCapture.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));

const GH_POSTING = "https://boards.greenhouse.io/northwind/jobs/4012345";
const GH_LIST = "https://boards.greenhouse.io/northwind";

// ── A fake chrome, recording every injection; a fetch that counts every request ────────────────────
const net = { requests: [] };
const inj = { calls: [] };
let page = { jsonLd: false, extract: { ok: true, url: GH_POSTING, text: "Title: Platform Engineer\nCompany: Northwind\nLocation: Austin, TX\n\nBuild it." } };
let state = { enabled: true, granted: true };
function installChrome() {
  const local = new Map([["authToken", "tok-synthetic"]]);
  const area = (m) => ({
    get: async (k) => (k == null ? Object.fromEntries(m) : Object.fromEntries([].concat(k).filter(x => m.has(x)).map(x => [x, m.get(x)]))),
    set: async (o) => { for (const [k, v] of Object.entries(o)) m.set(k, v); },
    remove: async (k) => { for (const x of [].concat(k)) m.delete(x); },
  });
  const ev = () => ({ addListener() {}, removeListener() {} });
  globalThis.chrome = {
    storage: {
      local: { ...area(local), get: async (k) => (k === AUTO_CAPTURE_SETTING ? { [k]: state.enabled } : area(local).get(k)) },
      session: area(new Map()), sync: area(new Map()), onChanged: ev(),
    },
    runtime: { getURL: (p) => `chrome-extension://test/${p}`, onMessage: ev(), onInstalled: ev(), onStartup: ev(), sendMessage() {} },
    permissions: { contains: async () => state.granted, onRemoved: ev() },
    scripting: {
      async executeScript({ func }) {
        inj.calls.push(func.name);
        if (func.name === "pageHasJobPosting") return [{ result: page.jsonLd }];
        if (func.name === "extractJobPayload") return [{ result: page.extract }];
        return [{ result: null }];
      },
    },
    tabs: { onUpdated: ev(), onRemoved: ev(), onActivated: ev(), query: async () => [], create: async () => ({}) },
    commands: { onCommand: ev() },
    contextMenus: { create() {}, removeAll(cb) { cb?.(); }, onClicked: ev() },
    action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
    alarms: { create() {}, onAlarm: ev() },
  };
  globalThis.fetch = async (url, init = {}) => {
    net.requests.push({ url: String(url), body: init.body ?? null });
    return new Response(JSON.stringify({ success: true, discarded: false, auto: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
installChrome();
const { maybeAutoCapture } = await import("../extension/background.js");
const reset = (s = {}, p = {}) => { net.requests = []; inj.calls = []; state = { enabled: true, granted: true, ...s }; page = { ...page, jsonLd: false, ...p }; };
let tabN = 0;
const tab = (url) => ({ id: 9, url: `${url}${url.includes("?") ? "&" : "?"}n=${++tabN}` });   // a fresh URL each time (the worker remembers URLs)

// ═════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ D64 · a page that is NOT a posting sends NOTHING — zero requests, and only the local check ran", async () => {
  reset({}, { jsonLd: false });
  const r = await maybeAutoCapture(tab(GH_LIST));
  assert.equal(r.step, "check_page");
  assert.equal(r.posting, false);
  assert.deepEqual(net.requests, [], "not the page, not its address");
  assert.deepEqual(inj.calls, ["pageHasJobPosting"], "the extractor never ran");
});

test("⛔ D64 · with the setting OFF, nothing runs — no injection, no request", async () => {
  reset({ enabled: false });
  const r = await maybeAutoCapture(tab(GH_POSTING));
  assert.equal(r.step, "skip");
  assert.deepEqual(inj.calls, []);
  assert.deepEqual(net.requests, []);
});

test("⛔ D64 · without Chrome's grant (the user never accepted, or removed it), nothing runs", async () => {
  reset({ granted: false });
  assert.equal((await maybeAutoCapture(tab(GH_POSTING))).step, "skip");
  assert.deepEqual(inj.calls, []);
  assert.deepEqual(net.requests, []);
});

test("⛔ D64 · a site outside the list is never considered, whatever the page", async () => {
  reset();
  for (const u of ["https://www.linkedin.com/jobs/view/123", "https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/X_R1", "https://www.amazon.jobs/en/jobs/2912345", "https://example.com/careers/1"]) {
    assert.equal((await maybeAutoCapture(tab(u))).step, "skip", u);
  }
  assert.deepEqual(inj.calls, []);
  assert.deepEqual(net.requests, []);
});

test("⭐ D64 · a posting is read and sent ONCE, to /api/import/auto — with the page's own text", async () => {
  reset();
  const t = tab(GH_POSTING);
  const r = await maybeAutoCapture(t);
  assert.equal(r.sent, true);
  assert.equal(net.requests.length, 1);
  assert.match(net.requests[0].url, /\/api\/import\/auto$/);
  const body = JSON.parse(net.requests[0].body);
  assert.ok(body.text.includes("Platform Engineer"));
  await maybeAutoCapture(t);
  assert.equal(net.requests.length, 1, "the same URL is not sent twice");
  // A page whose URL does not say so, but carries JobPosting JSON-LD, is a posting too.
  reset({}, { jsonLd: true });
  assert.equal((await maybeAutoCapture(tab(GH_LIST))).sent, true);
});

test("⛔ D64 · the fill still waits for a click — automatic capture never fills, prepares or submits", () => {
  const bg = read("extension/background.js");
  const body = bg.slice(at(bg, "export async function maybeAutoCapture"), at(bg, "chrome.tabs.onUpdated.addListener((tabId, info, tab) => {"));
  assert.doesNotMatch(body, /prepareAndFill|runGatedHandoff|applyPlan|recordSubmitted|submit/i);
  assert.deepEqual([...new Set(inj.calls)].filter(n => !["pageHasJobPosting", "extractJobPayload"].includes(n)), []);
});

test("⛔ D64 · the permission request names ONLY the family origins — optional, public posting hosts, no gated portal", () => {
  assert.deepEqual(manifest.optional_host_permissions, [...AUTO_CAPTURE_ORIGINS], "the manifest and the code are one list");
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"], "nothing new at install time");
  for (const o of AUTO_CAPTURE_ORIGINS) {
    assert.match(o, /^https:\/\/[a-z0-9.-]+\/\*$/, `${o}: one exact host, https only`);
    assert.doesNotMatch(o, /\*\.|<all_urls>|workday|myworkdayjobs|amazon|smartrecruiters|icims|taleo|metacareers|linkedin|indeed/i, o);
  }
  const opt = read("extension/options-auto.js");
  assert.match(opt, /chrome\.permissions\.request\(\{ origins: \[\.\.\.AUTO_CAPTURE_ORIGINS\] \}\)/, "asked for at the user's click, by that list");
  assert.match(opt, /chrome\.permissions\.remove\(\{ origins: \[\.\.\.AUTO_CAPTURE_ORIGINS\] \}\)/, "and removed when switched off");
  assert.match(read("extension/options.html"), /<input type="checkbox" id="auto-capture">/);
  assert.doesNotMatch(read("extension/options.html"), /id="auto-capture" checked/, "off by default");
});

test("D64 · the decision before any read — pure, and every way to 'skip'", () => {
  assert.equal(autoCaptureStep({ enabled: true, granted: true, url: GH_POSTING }), "by_url");
  assert.equal(autoCaptureStep({ enabled: true, granted: true, url: GH_LIST }), "check_page");
  assert.equal(autoCaptureStep({ enabled: false, granted: true, url: GH_POSTING }), "skip");
  assert.equal(autoCaptureStep({ enabled: true, granted: false, url: GH_POSTING }), "skip");
  assert.equal(autoCaptureStep({ enabled: true, granted: true, url: "http://boards.greenhouse.io/x/jobs/1" }), "skip", "https only");
  assert.equal(autoCaptureOriginFor("https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01"), "https://jobs.lever.co/*");
  assert.equal(hasPostingUrlShape("https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01"), true);
  assert.equal(hasPostingUrlShape("https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01/apply"), false, "an application step is not the posting");
  assert.equal(hasPostingUrlShape("https://apply.workable.com/acme/j/9A1B2C3D4E/"), true);
});

test("D64 · the in-page posting check is self-contained and reads only JSON-LD", () => {
  const src = pageHasJobPosting.toString();
  assert.doesNotMatch(src, /\bfetch\(|chrome\.|import\(|XMLHttpRequest|sendMessage/, "it sends nothing");
  const docWith = (blocks) => ({ querySelectorAll: () => blocks.map(t => ({ textContent: t })) });
  const run = (blocks) => { globalThis.document = docWith(blocks); try { return pageHasJobPosting(); } finally { delete globalThis.document; } };
  assert.equal(run([JSON.stringify({ "@type": "JobPosting", title: "x" })]), true);
  assert.equal(run([JSON.stringify({ "@graph": [{ "@type": "Organization" }, { "@type": ["JobPosting"] }] })]), true);
  assert.equal(run([JSON.stringify({ "@type": "Organization" }), "not json"]), false);
});

test("D64 · Captured today is asked for only when the user opens it — nothing on popup open (D23)", () => {
  const pop = read("extension/popup-auto.js");
  assert.match(pop, /box\.addEventListener\('toggle', \(\) => \{ if \(box\.open\) void load\(\); \}\);/);
  const beforeToggle = pop.slice(at(pop, "chrome.storage.local.get(AUTO_CAPTURE_SETTING)"));
  assert.doesNotMatch(beforeToggle.split("box.addEventListener('toggle'")[0], /AUTO_CAPTURES/, "no server call before the user opens it");
  assert.match(read("extension/popup.html"), /<details id="auto-today" hidden>/);
});
