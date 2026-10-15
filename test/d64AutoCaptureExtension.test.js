// ⭐ D64 · AUTOMATED CAPTURE — the extension's half. Since D97 (owner, 10-13) it is the Capture column of the per-site
// switches (extension/autoRead.js runAutoPass, the Options table, the manifest's optional hosts); extension/autoCapture.js
// keeps D64's names, derived from the one site table.
//
// ⛔ The row's tests: a non-posting page sends NOTHING (zero requests) · with the switch off nothing runs · the
// permission request names only the table's origins · capture never fills. The REAL autoRead.js runs against a fake
// `chrome` and a counting `fetch` (test-support/autoReadChrome.mjs).
//
// ⚠ D97, owner 10-13 — CHANGED KNOWINGLY, not rot: two assertions of this file used to say Workday is never
// automatically captured and never an optional origin. The owner reversed that (Workday's two public hosts are
// optional host permissions, asked for only when the user switches Workday on). They now say so, and the rules that
// remain — no LinkedIn / Indeed / Glassdoor, nothing on an application page — are asserted instead.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// D97 (coordinator, J5 merge): extension/autoCapture.js — D64's names kept as a shim over autoRead.js — is deleted;
// nothing shipped imported it once background.js's D64 block gave way to autoRead.js (A93: nothing dead).
import {
  AUTO_READ_KEY, LEGACY_CAPTURE_KEY, OPTIONAL_ORIGINS, MANIFEST_OPTIONAL_HOSTS, ANY_SITE_PATTERN, runAutoPass, siteFor, hasPostingUrlShape, pageHasJobPosting,
} from "../extension/autoRead.js";
const AUTO_CAPTURE_ORIGINS = OPTIONAL_ORIGINS;
import { installAutoReadChrome, settingsWith } from "../test-support/autoReadChrome.mjs";
import { at } from "../test-support/sourceAnchors.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));

const GH_POSTING = "https://boards.greenhouse.io/northwind/jobs/4012345";
const GH_LIST = "https://boards.greenhouse.io/northwind";
const GH = ["https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*"];
const EXTRACT = { ok: true, url: GH_POSTING, title: "Platform Engineer", company: "Northwind", text: "Title: Platform Engineer\nCompany: Northwind\nLocation: Austin, TX\n\nBuild it." };

let tabN = 0;
function setup({ on = true, granted = true, jsonLd = false } = {}) {
  const h = installAutoReadChrome({
    granted: granted ? GH : [],
    page: {
      pageFacts: () => ({ origin: "https://boards.greenhouse.io", step: "", isApplyFlow: false, hasPassword: false, isReview: false }),
      collectFormLabels: { labels: [], fieldCount: 0 },
      pageHasJobPosting: jsonLd,
      extractJobPayload: EXTRACT,
    },
    respond: () => ({ status: 200, body: { success: true, discarded: false, auto: true } }),
  });
  h.stores.local.set(AUTO_READ_KEY, settingsWith(on ? { greenhouse: { capture: true } } : {}));
  return h;
}
const tab = (url) => ({ id: 900 + (++tabN), url: `${url}${url.includes("?") ? "&" : "?"}n=${tabN}` });   // a fresh URL each time

// ═════════════════════════════════════════════════════════════════════════════════════════════════

test("⛔ D64 · a page that is NOT a posting sends NOTHING — zero requests, and only the local checks ran", async () => {
  const h = setup({ jsonLd: false });
  const r = await runAutoPass(tab(GH_LIST), { serverUrl: "https://draft.test" });
  assert.deepEqual(r.done, []);
  assert.deepEqual(h.net, [], "not the page, not its address");
  assert.ok(!h.injected.includes("extractJobPayload"), "the extractor never ran");
  assert.ok(h.injected.includes("pageHasJobPosting"), "the JSON-LD was checked in the page");
  h.restore();
});

test("⛔ D64 · with the switch OFF, nothing runs — no injection, no request", async () => {
  const h = setup({ on: false });
  const r = await runAutoPass(tab(GH_POSTING), { serverUrl: "https://draft.test" });
  assert.equal(r.skipped, "site_off");
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⛔ D64 · without Chrome's grant (the user never accepted, or removed it), nothing runs", async () => {
  const h = setup({ granted: false });
  assert.equal((await runAutoPass(tab(GH_POSTING), { serverUrl: "https://draft.test" })).skipped, "not_granted");
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⛔ D64 · a site outside the table is never considered, whatever the page — LinkedIn, Indeed, Glassdoor included", async () => {
  const h = setup();
  for (const u of ["https://www.linkedin.com/jobs/view/123", "https://www.indeed.com/viewjob?jk=1", "https://www.glassdoor.com/job-listing/x",
                   "https://www.amazon.jobs/en/jobs/2912345", "https://example.com/careers/1"]) {
    assert.ok((await runAutoPass(tab(u), { serverUrl: "https://draft.test" })).skipped, u);
  }
  assert.deepEqual(h.injected, []);
  assert.deepEqual(h.net, []);
  h.restore();
});

test("⭐ D64 · a posting is read and sent ONCE, to /api/import/auto — with the page's own text", async () => {
  const h = setup();
  const t = tab(GH_POSTING);
  const r = await runAutoPass(t, { serverUrl: "https://draft.test" });
  assert.equal(r.capture.sent, true);
  assert.equal(h.net.length, 1);
  assert.match(h.net[0].url, /\/api\/import\/auto$/);
  assert.ok(JSON.parse(h.net[0].body).text.includes("Platform Engineer"));
  await runAutoPass(t, { serverUrl: "https://draft.test" });
  assert.equal(h.net.length, 1, "the same URL is not sent twice");
  h.restore();
  // A page whose URL does not say so, but carries JobPosting JSON-LD, is a posting too.
  const h2 = setup({ jsonLd: true });
  assert.equal((await runAutoPass(tab(GH_LIST), { serverUrl: "https://draft.test" })).capture.sent, true);
  h2.restore();
});

test("⛔ D64 · capture never fills, prepares or submits — capture on alone runs nothing but the posting's read", async () => {
  const h = setup();
  await runAutoPass(tab(GH_POSTING), { serverUrl: "https://draft.test" });
  assert.deepEqual([...new Set(h.injected)].filter(n => !["pageFacts", "collectFormLabels", "pageHasJobPosting", "extractJobPayload"].includes(n)), []);
  assert.ok(h.net.every(r => /\/api\/import\/auto$/.test(r.url)), "no prepare, match, mint or fill request");
  const src = read("extension/autoRead.js");
  const body = src.slice(at(src, "async function autoCapture(tab, serverUrl)"), at(src, "export async function runAutoPass"));
  assert.doesNotMatch(body, /prepareAndFill|runGatedHandoff|applyPlan|recordSubmitted|submit/i);
  h.restore();
});

// ⚠ D97 REVISED + T12, owner 10-15 — CHANGED KNOWINGLY, not rot: SmartRecruiters joins the preset table (decision 2), and
// the manifest's optional list ends with the broad https pattern so "Always read here" can ask for ONE company origin
// from the popup's click (decision 1). The preset table is still the only list the consent asks for; the pattern is
// never itself requested (test/d97rT12AlwaysRead.test.js).
test("⛔ D64 → D97 · the permission request names ONLY the table's origins — optional, never LinkedIn / Indeed / Glassdoor", () => {
  assert.deepEqual(manifest.optional_host_permissions, [...MANIFEST_OPTIONAL_HOSTS], "the manifest and the code are one list");
  assert.deepEqual([...MANIFEST_OPTIONAL_HOSTS], [...AUTO_CAPTURE_ORIGINS, ANY_SITE_PATTERN], "the presets, then T12's pattern — last");
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"], "nothing new at install time");
  for (const o of AUTO_CAPTURE_ORIGINS) {
    // D97, owner 10-13: Workday's two public hosts are the ONLY preset wildcard, one level under the vendor's own domain.
    assert.match(o, /^https:\/\/(?:[a-z0-9.-]+|\*\.myworkday(?:jobs|site)\.com)\/\*$/, `${o}: one host (or Workday's tenant wildcard), https only`);
    assert.doesNotMatch(o, /<all_urls>|amazon|icims|taleo|metacareers|linkedin|indeed|glassdoor/i, o);
  }
  const opt = read("extension/options-auto.js");
  assert.match(opt, /const origins = origin \? \[originPattern\(origin\)\] : site \? \[\.\.\.site\.origins\] : null;\n\s+const asked = checked && origins \? api\.permissions\.request\(\{ origins \}\) : null;/,
    "asked for at the user's click, by the site's list (or the one custom origin)");
  assert.match(read("extension/autoRead.js"), /chrome\.permissions\.remove\(\{ origins: \[\.\.\.site\.origins\] \}\)/, "and given back when switched off");
  assert.doesNotMatch(read("extension/options.html"), /type="checkbox"[^>]*\bchecked\b/, "off by default");
});

test("D64 · the URL checks before any read — pure: which site, and whether the URL itself says posting", () => {
  // The switch / grant half of D64's old decision is autoRead.js autoStep's, pinned in test/j5AutoRead.test.js.
  assert.equal(hasPostingUrlShape(GH_POSTING), true);
  assert.equal(hasPostingUrlShape(GH_LIST), false, "a board list is checked in the page, not taken from the URL");
  assert.equal(siteFor("http://boards.greenhouse.io/x/jobs/1"), null, "https only");
  assert.equal(siteFor("https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01")?.id, "lever");
  assert.equal(siteFor("https://zoom.wd5.myworkdayjobs.com/Zoom/job/X_R1")?.id, "workday", "D97, owner 10-13");
  assert.equal(siteFor("https://www.linkedin.com/jobs/view/1"), null);
  assert.equal(hasPostingUrlShape("https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01"), true);
  assert.equal(hasPostingUrlShape("https://jobs.lever.co/acme/3f6a2c1e-0b1d-4c55-9a7e-2d4f8b6c9e01/apply"), false, "an application step is not the posting");
  assert.equal(hasPostingUrlShape("https://apply.workable.com/acme/j/9A1B2C3D4E/"), true);
  assert.equal(LEGACY_CAPTURE_KEY, "autoCaptureEnabled", "D64's key, kept only to migrate it");
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
  const beforeToggle = pop.slice(at(pop, "api.storage.local.get(AUTO_READ_KEY)"));
  assert.doesNotMatch(beforeToggle.split("box.addEventListener('toggle'")[0], /AUTO_CAPTURES/, "no server call before the user opens it");
  assert.match(read("extension/popup.html"), /<details id="auto-today" hidden>/);
});
