// T29 (owner, 10-19) · THE SETTINGS PAGE TAKES EVERYTHING ELSE — "Any permission-related stuff and anything else moves to
// the extension's SETTINGS PAGE, which opens when we have to change a setting." Owner 10-23: a permission is requested
// HERE (a web page cannot): the dock's popup opens options.html#permissions and the one click there asks Chrome.
//
// · every section the dock's gear or a popup may open exists, by the id the service worker allows (SETTINGS_SECTIONS),
//   and a deep link lands on it · Settings → Permissions: one switch per site; on = permissions.request first; off =
//   the worker gives the site back (AUTO_READ_REVOKE: its four switches off, its frame hints forgotten, Chrome's grant
//   removed, unless a chosen site still reads its form) · Chrome's own onAdded / onRemoved redraw both sections.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { handlers, AUTO_READ_KEY } from "../extension/autoRead.js";
import { installAutoReadChrome, settingsWith } from "../test-support/autoReadChrome.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const HTML = read("extension/options.html");
const BG = read("extension/background.js");
const OPTIONS_PAGE = { id: "test", url: "chrome-extension://test/options.html", tab: { id: 4242, url: "chrome-extension://test/options.html" } };
const WD = ["https://*.myworkdayjobs.com/*", "https://*.myworkdaysite.com/*"];

test("T29 ① every section a dock control may open is on the page, by the id the service worker allows, with a heading that takes the focus", () => {
  const allowed = BG.slice(at(BG, "const SETTINGS_SECTIONS = Object.freeze(["), at(BG, "]);", at(BG, "const SETTINGS_SECTIONS")))
    .match(/'([a-z-]+)'/g).map(s => s.slice(1, -1));
  assert.deepEqual(allowed, ["permissions", "account", "auto-read", "intent", "answers", "details", "shortcuts"]);
  for (const id of allowed) {
    assert.match(HTML, new RegExp(`<section id="${id}" aria-labelledby="${id}-h">`), `no #${id} section`);
    assert.match(HTML, new RegExp(`<h1 class="logo-face" id="${id}-h" tabindex="-1">`), `#${id}'s heading cannot take the focus`);
  }
  const js = read("extension/options.js");
  assert.match(js, /addEventListener\('hashchange', landOnSection\);\nlandOnSection\(\);/, "a deep link lands on load and on a later hash");
  assert.match(js, /section\.querySelector\('h1'\)\?\.focus\(\{ preventScroll: true \}\);/);
  // ⭐ audit 10-25: "#%" cannot stop the page's script
  assert.match(js, /try \{ id = decodeURIComponent\(location\.hash\.slice\(1\)\); \} catch \{ return; \}/);
  assert.match(js, /chrome\.tabs\.create\(\{ url: `\$\{RESUME_MASTER_URL\}\/app\/saved-answers` \}\)/, "Saved answers opens the web app's list");
  assert.match(HTML, /<script src="config\.js"><\/script>\n  <script src="options\.js"><\/script>\n  <script type="module" src="options-permissions\.js"><\/script>/);
});

test("T29 ② one line under each heading — no paragraph of instructions left on the page", () => {
  for (const m of HTML.matchAll(/<p class="subtitle">([\s\S]*?)<\/p>/g)) {
    const words = m[1].replace(/<[^>]+>|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(words.length <= 110 && !m[1].includes("\n"), `more than one line: "${words}"`);
  }
  assert.doesNotMatch(HTML, /This page used to record a\s+custom combination/, "the long shortcuts paragraph is back on screen");
});

// ── the Permissions section, with a stub DOM and a stub chrome ──────────────────────────────────────────────────
function fakeDoc() {
  const byId = new Map();
  const make = (tag, id = null) => {
    const el = { tagName: tag.toUpperCase(), id, children: [], listeners: {}, attrs: {}, dataset: {}, textContent: "", className: "", checked: false, type: "",
      append(...xs) { this.children.push(...xs); }, setAttribute(k, v) { this.attrs[k] = String(v); },
      addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }, fire(t) { for (const fn of this.listeners[t] || []) fn({ type: t }); } };
    Object.defineProperty(el, "textContent", { get() { return this._t || ""; }, set(v) { this._t = v; if (v === "") this.children = []; } });
    return el;
  };
  for (const id of ["perm-rows", "perm-status"]) byId.set(id, make("div", id));
  return { getElementById: (id) => byId.get(id) || null, createElement: (t) => make(t), byId };
}
const boxesOf = (el) => el.children.flatMap(r => r.children).flatMap(l => l.children || []).filter(c => c.tagName === "INPUT");

test("T29 ③ Settings → Permissions: a switch per site; ON asks Chrome FIRST (inside the click); OFF asks the worker to give the site back; other grants are listed", async () => {
  const { mount } = await import("../extension/options-permissions.js");
  const calls = [];
  const added = [];
  let grants = ["https://jobsviadraft.com/*", ...WD, "https://careers.acme.test/*", "https://other.test/*"];
  const api = {
    runtime: { getManifest: () => ({ host_permissions: ["https://jobsviadraft.com/*"] }),
      sendMessage: async (m) => { calls.push(["message", m.type, m.site || m.origin || null]);
        if (m.type === "AUTO_READ_STATE") return { ok: true, granted: { workday: true }, customGranted: { "https://careers.acme.test": true }, settings: { custom: { "https://careers.acme.test": {} } } };
        return { ok: true }; } },
    permissions: { request: (o) => { calls.push(["request", o.origins.join(" ")]); return Promise.resolve(true); },
      remove: async (o) => { calls.push(["remove", o.origins.join(" ")]); grants = grants.filter(g => !o.origins.includes(g)); return true; },
      getAll: async () => ({ origins: grants }), onAdded: { addListener: (fn) => added.push(fn) }, onRemoved: { addListener: (fn) => added.push(fn) } },
  };
  const doc = fakeDoc();
  const m = mount(doc, api);
  await m.ready;
  const rows = doc.byId.get("perm-rows");
  const names = rows.children.map(r => r.children[0].children[1].textContent);
  assert.deepEqual(names, ["Workday", "Greenhouse", "Lever", "Ashby", "Workable", "SmartRecruiters", "careers.acme.test", "other.test"],
    "the presets in the options page's order, then a site chosen with Always read here, then any other grant");
  const boxes = boxesOf(rows);
  assert.deepEqual(boxes.map(b => b.checked), [true, false, false, false, false, false, true, true]);
  assert.ok(boxes.every(b => /^Allow draft on /.test(b.attrs["aria-label"])), "every switch is named");
  assert.equal(calls.filter(c => c[0] === "request").length, 0, "⛔ nothing is requested on load");
  // ON: the request is the change handler's FIRST call — before any message, before any await
  calls.length = 0;
  boxes[1].checked = true; boxes[1].fire("change");
  assert.deepEqual(calls[0], ["request", "https://boards.greenhouse.io/* https://job-boards.greenhouse.io/*"], "Greenhouse: Chrome is asked, synchronously, first");
  await new Promise(r => setTimeout(r, 10));
  // OFF on a preset: the worker gives it back (one writer)
  calls.length = 0;
  const wd = boxesOf(rows)[0];
  wd.checked = false; wd.fire("change");
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(calls[0], ["message", "AUTO_READ_REVOKE", "workday"]);
  assert.ok(!calls.some(c => c[0] === "request"));
  // OFF on any other grant: removed here
  calls.length = 0;
  const other = boxesOf(rows).at(-1);
  other.checked = false; other.fire("change");
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(calls[0], ["remove", "https://other.test/*"]);
  assert.equal(added.length, 2, "Chrome's onAdded and onRemoved redraw the sections");
});

test("T29 ④ AUTO_READ_REVOKE — a site given back: its four switches off, its frame hints forgotten, its watcher gone, Chrome's grant removed; an extension page only", async () => {
  const h = installAutoReadChrome({ granted: WD });
  h.stores.local.set(AUTO_READ_KEY, { ...settingsWith({ workday: { read: true, prepare: true } }), custom: {}, frameHints: { "https://careers.acme.test": "workday" } });
  assert.equal((await handlers.AUTO_READ_SET({ site: "workday", behaviour: "fill", on: true }, OPTIONS_PAGE)).ok, true);
  assert.equal((await handlers.AUTO_READ_REVOKE({ site: "workday" }, { id: "x", url: "https://evil.test/", tab: { id: 1 } })).error, "not_allowed");
  assert.equal((await handlers.AUTO_READ_REVOKE({ site: "nope" }, OPTIONS_PAGE)).error, "bad_site");
  const r = await handlers.AUTO_READ_REVOKE({ site: "workday" }, OPTIONS_PAGE);
  assert.equal(r.ok, true);
  assert.equal(r.kept, false);
  assert.deepEqual(r.settings.sites.workday, { read: false, prepare: false, capture: false, fill: false });
  assert.deepEqual(r.settings.frameHints, {}, "the frame it was found in is forgotten");
  assert.deepEqual(h.removed, WD, "Chrome's access given back");
  assert.equal(h.registered.size, 0, "its watcher is gone");
  h.restore();
});

test("T29 ⑤ audit 10-25 — a revoke the worker refuses says so; a revoke clears a consent still waiting on Chrome for that site", async () => {
  const { mount } = await import("../extension/options-permissions.js");
  const api = {
    runtime: { getManifest: () => ({ host_permissions: [] }),
      sendMessage: async (m) => (m.type === "AUTO_READ_STATE" ? { ok: true, granted: { workday: true }, customGranted: {}, settings: { custom: {} } } : { ok: false, error: "not_allowed" }) },
    permissions: { request: () => Promise.resolve(true), remove: async () => true, getAll: async () => ({ origins: [] }), onAdded: { addListener() {} }, onRemoved: { addListener() {} } },
  };
  const doc = fakeDoc();
  await mount(doc, api).ready;
  const wd = boxesOf(doc.byId.get("perm-rows"))[0];
  wd.checked = false; wd.fire("change");
  await new Promise(r => setTimeout(r, 10));
  assert.equal(doc.byId.get("perm-status").textContent, "Could not turn Workday off — try again.");
  // the worker: a pending consent covering the site is cleared by its revoke
  const h = installAutoReadChrome({ granted: WD });
  h.stores.local.set(AUTO_READ_KEY, { ...settingsWith({}), custom: {}, frameHints: {} });
  assert.equal((await handlers.AUTO_READ_PENDING({ kind: "all" }, OPTIONS_PAGE)).ok, true);
  assert.equal((await handlers.AUTO_READ_STATE({}, OPTIONS_PAGE)).pending, "all");
  await handlers.AUTO_READ_REVOKE({ site: "workday" }, OPTIONS_PAGE);
  assert.equal((await handlers.AUTO_READ_STATE({}, OPTIONS_PAGE)).pending, null, "a waiting consent cannot switch the revoked site back on");
  h.restore();
});

test("T29 ⑥ (T31) Settings → Account — who the extension acts as, named as text; Sign in and Disconnect; the LinkedIn sign-in", () => {
  const js = read("extension/options.js");
  const acct = js.slice(at(js, "async function showAccount(fresh = false) {"), at(js, "document.getElementById('btn-sign-in')"));
  assert.match(acct, /chrome\.runtime\.sendMessage\(\{ type: 'GET_IDENTITY', fresh \}\)/);
  assert.match(acct, /name\.textContent = id\.username \|\| 'your account';/, "a username is never parsed");
  assert.match(acct, /id\.accountIsAdmin \? ' · not acting as admin' : ''/, "an admin sees the extension is deliberately not one");
  assert.doesNotMatch(acct, /innerHTML/);
  assert.match(js, /getElementById\('btn-disconnect'\)\?\.addEventListener\('click', async \(\) => \{[\s\S]*?type: 'DISCONNECT'/);
  assert.match(js, /getElementById\('btn-sign-in'\)\?\.addEventListener\('click', \(\) => \{\n  chrome\.tabs\.create\(\{ url: `\$\{RESUME_MASTER_URL\}\/login` \}\)/);
  assert.match(HTML, /<section id="account" aria-labelledby="account-h">[\s\S]*id="btn-sign-in"[\s\S]*id="btn-disconnect"[\s\S]*id="btn-linkedin"[\s\S]*<\/section>/);
});
