// D23 (owner, 10-04) — the companion with a MANUAL CONTEXT TRIGGER, in the SITE'S exact visual
// language. Supersedes the open half of D13.
//
//   1. Context detection is NEVER automatic on popup open. Until "Read this page" (or R) is pressed
//      the popup shows the four actions unchanged, injects nothing into the page and asks the server
//      nothing about it. Every read of every page begins with a click or a keystroke.
//   2. ⛔ No new storage, no new permission, no new disclosure: the six storage keys and the
//      permission set are PINNED here, so neither can grow without this file failing.
//   3. The look is the site's: tokens generated from client/src/styles/colorTokens.js (never a hand
//      copy), the self-hosted logo face, the /draft mark from the site's own D19 masks, the /d on the
//      Draft action, D1's depth on every control, radius 11–13, prefers-reduced-motion.
//      (The colour-literal half lives in test/colorLiteralGuard.test.js.)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { staleExtensionTokens, renderExtensionTokens, COPIED_ASSETS } from "../scripts/buildExtensionTokens.mjs";
import { collectRequiredFiles } from "../scripts/buildExtension.mjs";
import { C_LIGHT, C_DARK } from "../client/src/styles/colorTokens.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const manifest = JSON.parse(read("extension/manifest.json"));

// ── 2. The promises that made C win ──────────────────────────────────────────────────────────────

test("⛔ D23: the permission set is exactly activeTab + scripting + storage, and the one host", () => {
  // + contextMenus by D55 decision B (10-07) — a decided addition, not D23's.
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://jobsviadraft.com/*"]);
  // + optional_host_permissions by D64 (owner, 10-07: automated capture) — a decided addition, not D23's:
  // granted only when the user switches automatic capture on, public job-posting hosts only, and
  // exactly D64's list (never a gated portal) — since D97 derived from extension/autoRead.js's site table.
  // + Workday's two public hosts by D97, owner 10-13 (a deliberate reversal of D64's "no gated portal" line): optional,
  // asked for only when the user switches Workday on in Options, and exactly extension/autoRead.js's site table.
  assert.deepEqual(manifest.optional_host_permissions, [
    "https://boards.greenhouse.io/*", "https://job-boards.greenhouse.io/*", "https://jobs.lever.co/*",
    "https://jobs.ashbyhq.com/*", "https://apply.workable.com/*",
    "https://*.myworkdayjobs.com/*", "https://*.myworkdaysite.com/*",
  ]);
  for (const k of ["optional_permissions", "content_scripts",
                   "web_accessible_resources", "externally_connectable", "declarative_net_request"]) {
    assert.equal(manifest[k], undefined, `manifest.${k} appeared — that is a new permission or exposure`);
  }
  // The self-hosted faces reach the review overlay as BYTES (FontFace), not as a URL the page loads,
  // precisely so that no web_accessible_resources entry is needed.
  assert.match(read("extension/gated-handoff.js"), /fetch\(chrome\.runtime\.getURL\('fonts\/poppins-latin-800-italic\.woff2'\)\)/);
  assert.match(read("extension/review-overlay.js"), /new FontFace\(LOGO_FACE, bytes\.buffer/);
});

test("⛔ D23: the storage keys are exactly the six the listing names — no more, no other kind", () => {
  const files = collectRequiredFiles(manifest).filter((f) => f.endsWith(".js"));
  const code = Object.fromEntries(files.map((f) => [f, read(`extension/${f}`)]));
  const keys = [];
  for (const [f, src] of Object.entries(code)) {
    for (const m of src.matchAll(/chrome\.storage\.(local|session)\.set\(\s*\{\s*(\[[^\]]+\]|[A-Za-z_$][\w$]*)\s*:/g)) {
      keys.push(`${m[1]}:${m[2]}`);
    }
    // One key per write: a second key in the same object literal would slip past the count.
    for (const m of src.matchAll(/chrome\.storage\.(?:local|session)\.set\(\s*\{([^}]*)\}/g)) {
      assert.ok(!/,\s*(\[[^\]]+\]|[A-Za-z_$][\w$]*)\s*:/.test(m[1].replace(/\{[^}]*\}/g, "")) || /\.\.\./.test(m[1]),
        `${f} writes more than one key in one call: ${m[0].slice(0, 80)}`);
    }
    assert.doesNotMatch(src, /\b(localStorage|sessionStorage|indexedDB)\b|chrome\.cookies|chrome\.storage\.sync\.set/,
      `${f} stores something outside chrome.storage.local/session`);
  }
  // + local:[AUTO_CAPTURE_SETTING] by D64 (owner, 10-07) — the automatic-capture switch, a decided and
  // disclosed addition (the privacy page's storage list, STORE_LISTING, PRIVACY_RECONCILIATION).
  // + session:[bindKey(tabId)] by v1.5.2 (owner, 10-12) — the tab binding, which job a tab is on; disclosed in the
  // privacy page's storage list, STORE_LISTING and PRIVACY_RECONCILIATION in the same change.
  // + local:[PROGRESS_KEY] by D96 §3 (owner, 10-13) — where each application stands (captured · read · prepared ·
  // filled n of m · reviewed · submitted), no answer value, 30 days, cleared on Disconnect / sign-out; disclosed in the
  // privacy page's storage list, STORE_LISTING and PRIVACY_RECONCILIATION in the same change.
  // ⇄ local:[AUTO_CAPTURE_SETTING] → local:[AUTO_READ_KEY] by D97 (owner, 10-13): D64's switch became one of four
  // per-site switches; the one key holds the switches, the consent, and the read-quality labels and counts (30 days,
  // never a value). autoCaptureEnabled is migrated once and removed, never written again — the count is unchanged.
  assert.deepEqual(keys.sort(), [
    "local:[AUTO_READ_KEY]",
    "local:[IDENTITY_KEY]", "local:[PROGRESS_KEY]", "local:[TOKEN_KEY]", "local:lastCapture",
    "session:[batchKey(tabId)]", "session:[bindKey(tabId)]", "session:[sessionKey(tabId)]", "session:lastGatedHandoff",
  ].sort(), "the extension's storage keys changed — that is a new disclosure (D23: none allowed)");
  assert.match(code["tabBinding.js"], /const bindKey = \(tabId\) => `\$\{BIND_PREFIX\}\$\{tabId\}`;/);
  assert.match(code["tabBinding.js"], /export const BIND_PREFIX = 'bind:';/);
  assert.match(code["progress.js"], /export const PROGRESS_KEY = 'jobProgress';/);
  assert.match(code["autoRead.js"], /export const AUTO_READ_KEY = 'autoRead';/);
  const auth = code["auth.js"];
  assert.match(auth, /const TOKEN_KEY = ['"]authToken['"]/);
  assert.match(auth, /const IDENTITY_KEY = ['"]authIdentity['"]/);
  const gh = code["gated-handoff.js"];
  assert.match(gh, /sessionKey = \(tabId\) => `gate:\$\{tabId\}`/);
  assert.match(gh, /batchKey = \(tabId\) => `batch:\$\{tabId\}`/);
});

// ── 1. The manual trigger, exercised: the REAL popup.js against a stub DOM and chrome.* ────────────

function fakeEl(id) {
  const el = {
    id, style: {}, textContent: "", className: "", disabled: false, title: "", hidden: false,
    dataset: {}, children: [], listeners: {},
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    append(...xs) { this.children.push(...xs); },
    set innerHTML(v) { this.children = []; this._html = v; }, get innerHTML() { return this._html || ""; },
  };
  return el;
}

function bootPopup({ preview, context, tabUrl = "https://jobs.example.test/role/1" }) {
  const els = {};
  const sent = [];
  const messages = [];
  const injected = [];
  const docListeners = {};
  const document = {
    getElementById: (id) => (els[id] ||= fakeEl(id)),
    createElement: (t) => fakeEl(`<${t}>`),
    addEventListener: (t, fn) => (docListeners[t] ||= []).push(fn),
  };
  const answers = { PROBE_AUTH: { authenticated: true, username: "ada" }, PREVIEW_ACTIVE_TAB: preview, POPUP_CONTEXT: context };
  const chrome = {
    runtime: { sendMessage: async (m) => { sent.push(m.type); messages.push(m); return answers[m.type] ?? null; }, openOptionsPage() {} },
    tabs: { query: async () => [{ id: 7, url: tabUrl }], create() {} },
    storage: { local: { get: async () => ({}) } },
    scripting: { executeScript: async (x) => { injected.push(x); return [{ result: "" }]; } },
  };
  const sandbox = { document, chrome, window: { close() {} }, setTimeout, clearTimeout, console, URL, Promise, Date };
  vm.createContext(sandbox);
  vm.runInContext(read("extension/config.js"), sandbox);
  vm.runInContext(read("extension/companion.js"), sandbox);
  vm.runInContext(read("extension/popup.js"), sandbox);
  const settle = () => new Promise((r) => setTimeout(r, 20));
  return { els, sent, messages, injected, docListeners, settle };
}

const POSTING = { capturable: true, ok: true, title: "Data Engineer", company: "Fabrikam", location: "Boston, MA" };
const POSTING_CTX = { packets: [], posting: { known: false, saved: false }, recent: [] };

test("⛔ D23: opening the popup reads NOTHING — no preview, no context call, no injection", async () => {
  const p = bootPopup({ preview: POSTING, context: POSTING_CTX });
  await p.settle();
  // §8 row 15 / decision D (owner, 10-07): the TODAY RING is asked for on open — it is the ACCOUNT's
  // quota (the day's Draft slots), not the page: the message carries no tab and no URL (checked below),
  // and background.js answers it from /api/draft/slots alone. Nothing about the page is read on open.
  // v1.5.2 (owner, 10-12): "Captured: N today · M already on your board" is asked for on open on the same terms — the
  // ACCOUNT's captures (GET /api/import/today), no tab and no URL in the message.
  assert.deepEqual(p.sent, ["PROBE_AUTH", "TODAY_RING", "CAPTURED_TODAY"], `the popup asked for ${p.sent.join(", ")} on open`);
  assert.deepEqual(Object.keys(p.messages.find(m => m.type === "TODAY_RING")), ["type"], "the ring's message carries something about the page");
  assert.deepEqual(Object.keys(p.messages.find(m => m.type === "CAPTURED_TODAY")), ["type"], "the count's message carries something about the page");
  assert.equal(p.injected.length, 0, "the popup injected into the page on open");
  // The four actions are there, unchanged and enabled; the companion is not.
  for (const id of ["btn-capture-job", "btn-fill", "btn-ats", "btn-resume"]) {
    assert.notEqual(p.els[id]?.style.display, "none", `${id} is hidden before the press`);
    assert.equal(p.els[id]?.disabled ?? false, false, `${id} is disabled on a web page before the press`);
  }
  assert.equal(p.els["btn-read-page"].style.display, "flex", "the trigger is not offered");
  assert.notEqual(p.els["companion"]?.style.display, "block");
  assert.notEqual(p.els["posting-actions"]?.style.display, "flex");
});

test("D23: the press reads the page once — a posting -> Capture it + Score it + 'Not on your board yet'", async () => {
  const p = bootPopup({ preview: POSTING, context: POSTING_CTX });
  await p.settle();
  for (const fn of p.els["btn-read-page"].listeners.click) fn({});
  await p.settle();
  assert.deepEqual(p.sent.slice(3).sort(), ["POPUP_CONTEXT", "PREVIEW_ACTIVE_TAB"]);
  assert.equal(p.els["posting-actions"].style.display, "flex");
  assert.equal(p.els["ctx-line"].textContent, "Not on your board yet");
  assert.equal(p.els["preview-company"].textContent, "Fabrikam");
  assert.equal(p.els["btn-read-page"].style.display, "none");
  // A second press (or a held key) does not read again.
  for (const fn of p.els["btn-read-page"].listeners.click) fn({});
  await p.settle();
  assert.equal(p.sent.length, 5, "the page was read twice");
});

test("D23: the keystroke is the same press (R, no modifier); a modified R is not", async () => {
  const p = bootPopup({ preview: null, context: { packets: [{ packetId: 3, createdAt: Date.now() - 2 * 86400000,
    stale: false, answerCount: 14, unresolvedCount: 0, resumeAvailable: true }], recent: [] } });
  await p.settle();
  const key = (o) => { for (const fn of p.docListeners.keydown) fn({ preventDefault() {}, ...o }); };
  key({ key: "r", ctrlKey: true });
  await p.settle();
  assert.deepEqual(p.sent, ["PROBE_AUTH", "TODAY_RING", "CAPTURED_TODAY"], "Ctrl+R read the page");
  key({ key: "r" });
  await p.settle();
  assert.equal(p.els["btn-fill-primary"].style.display, "flex", "a form you drafted -> Fill it");
  assert.equal(p.els["ctx-line"].textContent, "You drafted this 2 days ago · résumé ready · 14 fields prepared");
});

test("D23: neither -> recent captures, after the press; on chrome:// Capture is disabled, never hidden", async () => {
  const p = bootPopup({ preview: { capturable: false }, tabUrl: "chrome://extensions/",
    context: { packets: [], posting: null, recent: [{ jobId: "a", title: "Platform Engineer", company: "Tailspin", capturedAt: Date.now() }] } });
  await p.settle();
  assert.equal(p.els["btn-capture-job"].disabled, true, "Capture is offered on a page that cannot be captured");
  assert.notEqual(p.els["btn-capture-job"].style.display, "none");
  for (const fn of p.els["btn-read-page"].listeners.click) fn({});
  await p.settle();
  assert.equal(p.els["recent"].style.display, "block");
  assert.equal(p.els["recent-list"].children.length, 1);
  assert.equal(p.els["btn-capture-job"].disabled, true);
});

test("D23: the server half is unchanged — D13's /api/import/context, with D4's parser, not a second one", () => {
  const route = read("routes/importJob.js");
  assert.match(route, /detectKnownAtsMatch/);
  for (const f of ["extension/popup.js", "extension/companion.js", "extension/background.js"]) {
    assert.doesNotMatch(read(f), /greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs/i,
      `${f} parses ATS URLs itself — the server's detectKnownAtsMatch is the one parser`);
  }
});

// ── 3. The visual language ─────────────────────────────────────────────────────────────────────

test("⛔ D23: the extension's tokens, faces and mark are GENERATED from the site's — never stale", async () => {
  assert.deepEqual(await staleExtensionTokens(), [],
    "extension design assets differ from the site's — run: node scripts/buildExtensionTokens.mjs");
  const { "tokens.css": css } = await renderExtensionTokens();
  // Spot-check the values travel, light and dark (D19's mark tokens among them).
  assert.match(css, new RegExp(`--c-logo-word: ${C_LIGHT.LOGO_WORD};`));
  assert.match(css, new RegExp(`--c-logo-slash: ${C_LIGHT.LOGO_SLASH};`));
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  assert.ok(css.includes(`--c-ink: ${C_DARK.INK};`));
  for (const rel of Object.keys(COPIED_ASSETS)) {
    assert.ok(collectRequiredFiles(manifest).includes(rel), `${rel} is not reachable, so it would not ship`);
  }
});

test("⛔ D23: no font or style request leaves the extension", () => {
  for (const f of ["extension/popup.html", "extension/options.html", "extension/ui.css", "extension/tokens.css",
                   "extension/review-overlay.js", "extension/extractor.js"]) {
    assert.doesNotMatch(read(f), /fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*['"]?https?:/i, `${f} asks a third party for a font`);
  }
  const css = read("extension/tokens.css");
  assert.match(css, /font-family: 'Poppins';\n  font-style: italic;\n  font-weight: 800;/, "the logo face is not declared");
  assert.doesNotMatch(css, /url\(https?:/, "a face is loaded from the network");
});

test("⛔ D23: D1's depth on every control, square geometry 11–13, reduced motion respected", () => {
  const ui = read("extension/ui.css");
  const rule = (sel) => { const m = ui.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`)); return m ? m[2] : ""; };
  for (const sel of [".sq", ".btn"]) {
    const r = rule(sel);
    assert.match(r, /box-shadow: var\(--c-depth-rest\)/, `${sel} has no resting depth`);
    const radius = Number((r.match(/border-radius: (\d+)px/) || [])[1]);
    assert.ok(radius >= 11 && radius <= 13, `${sel} radius ${radius} is outside 11–13`);
  }
  assert.match(ui, /\.sq:hover:not\(:disabled\), \.sq:focus-visible,\n\.btn:hover:not\(:disabled\), \.btn:focus-visible \{ box-shadow: var\(--c-depth-hover\); transform: translateY\(-2px\); \}/);
  assert.match(ui, /\.sq:active:not\(:disabled\), \.btn:active:not\(:disabled\) \{ transform: translateY\(0\); box-shadow: var\(--c-depth-press\); \}/);
  assert.match(rule(".sq--primary"), /box-shadow: var\(--c-depth-accent\)/, "the primary's shadow is not tinted orange");
  assert.match(ui, /@media \(prefers-reduced-motion: reduce\) \{\n  \.sq, \.btn, \.link, \.mb \{ transition: none; \}/);   // D63: the depth links too
  // D1's values are the site's tokens — the extension reads the same names.
  assert.equal(C_LIGHT.DEPTH_REST, "0 3px 8px rgba(30,25,21,0.11), inset 0 1px 0 rgba(255,255,255,0.66)");
  assert.match(C_LIGHT.DEPTH_ACCENT, /^0 3px 9px rgba\(253,70,0,0\.34\)/);

  const ov = read("extension/review-overlay.js");
  // v1.5.1 (D60): the 28px overlay button is radius 8 — 11 on 28 read as a capsule; the near-capsule guard
  // (test/d60CompactRadius.test.js) holds the proportion. The 11–13 rule above is for the full-size controls.
  assert.match(ov, /\.rm-btn \{[^}]*border-radius: 8px;[^}]*box-shadow: var\(--c-depth-rest\)/);
  assert.match(ov, /\.rm-btn:hover:not\(:disabled\), #\$\{ID\} \.rm-btn:focus-visible \{ box-shadow: var\(--c-depth-hover\); transform: translateY\(-2px\); \}/);
  assert.match(ov, /\.rm-btn:active:not\(:disabled\) \{ transform: translateY\(0\); box-shadow: var\(--c-depth-press\); \}/);
  assert.match(ov, /\.rm-btn\.primary \{[^}]*box-shadow: var\(--c-depth-accent\)/);
  assert.match(ov, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(ov, /@media \(prefers-color-scheme: dark\) \{ #\$\{ID\} \{ \$\{varsOf\(theme\.dark\)\} \} \}/);
  assert.match(read("extension/gated-handoff.js"), /theme: await overlayTheme\(\),/, "the overlay is not handed the tokens");
});

test("⛔ D23: the mark is /draft per D19 (orange slash, ink word) and the Draft action carries /d", () => {
  const html = read("extension/popup.html");
  assert.match(html, /<span class="mark" role="img" aria-label="draft"><span class="mark-slash"><\/span><span class="mark-word"><\/span><\/span>/);
  const ui = read("extension/ui.css");
  assert.match(ui, /\.mark \.mark-slash \{ background: var\(--c-logo-slash\);[^}]*url\(brand\/wordmark-slash\.png\)/);
  assert.match(ui, /\.mark \.mark-word  \{ background: var\(--c-logo-word\);[^}]*url\(brand\/wordmark-letters\.png\)/);
  assert.equal(C_LIGHT.LOGO_WORD, C_LIGHT.INK, "D19: in light mode the word is ink");
  assert.equal(C_LIGHT.LOGO_SLASH, C_LIGHT.ACCENT, "D19: the slash is the orange");
  const draftAt = at(html, 'id="btn-resume"');
  const draft = html.slice(draftAt, at(html, "</button>", draftAt));
  assert.match(draft, /<span class="draft-d" aria-hidden="true">\/d<\/span>/);
  assert.match(html, /class="sq sq--primary" id="btn-resume" aria-label="Open draft"/);
  assert.match(read("extension/review-overlay.js"), /<div class="rm-mark" aria-hidden="true"><span class="rm-slash">\/<\/span>draft<\/div>/);
  // Both pages take the site's tokens and controls.
  for (const f of ["extension/popup.html", "extension/options.html"]) {
    const h = read(f);
    assert.ok(h.indexOf('href="tokens.css"') > -1 && h.indexOf('href="tokens.css"') < h.indexOf('href="ui.css"'), `${f} does not load tokens.css before ui.css`);
  }
});
