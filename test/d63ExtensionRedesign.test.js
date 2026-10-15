// ⛔ D63 (owner 10-07, "approving all suggestions") · THE EXTENSION, REDESIGNED to extension-latest.html,
// tab "Suggested". Each test here is one of the row's listed checks, and goes red when its change is removed:
//   (1) the in-page badge is a depth box — no capsule — and every state shows an ICON as well as a colour
//   (2) the popup leads with the job card (logo tile, logo face, the D50 number box) — the read-page answer
//       carries the score, the logo and "résumé ready", and the data SENT does not grow
//   (3) the packet before you fill: "Résumé tailored · 62 → 81 · Fields prepared 14 · Will stop and ask 2"
//   (4) status as MARKS · (5) no underlined text link — LinkedIn and shortcuts on the options page
//   (6) the ring says "your cap" · (7) Capture and Score side by side, the shortcut on the primary
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createImportJobRouter } from "../routes/importJob.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");

// ── the real popup.js against a stub DOM (the d23 harness, with innerHTML-free children) ──────────
function fakeEl(id) {
  const attrs = {};
  return {
    id, style: {}, textContent: "", className: "", disabled: false, title: "", hidden: false, dataset: {}, children: [], listeners: {},
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    append(...xs) { this.children.push(...xs); },
    setAttribute(k, v) { attrs[k] = v; }, getAttribute(k) { return attrs[k]; },
    set innerHTML(v) { this.children = []; this._html = v; }, get innerHTML() { return this._html || ""; },
  };
}
const textOf = (el) => (typeof el === "string" ? el : [el.textContent || "", ...(el.children || []).map(textOf)].join(""));

function bootPopup({ preview, context, slots = null }) {
  const els = {};
  const document = {
    getElementById: (id) => (els[id] ||= fakeEl(id)),
    createElement: (t) => fakeEl(`<${t}>`),
    addEventListener() {},
  };
  const answers = { PROBE_AUTH: { authenticated: true, username: "ada" }, PREVIEW_ACTIVE_TAB: preview, POPUP_CONTEXT: context, TODAY_RING: slots };
  const chrome = {
    runtime: { sendMessage: async (m) => answers[m.type] ?? null, openOptionsPage() {} },
    tabs: { query: async () => [{ id: 7, url: "https://jobs.example.test/role/1" }], create() {} },
    storage: { local: { get: async () => ({}) } },
    scripting: { executeScript: async () => [{ result: "" }] },
  };
  const sandbox = { document, chrome, window: { close() {} }, setTimeout, clearTimeout, console, URL, Promise, Date, Number, String, Math };
  vm.createContext(sandbox);
  for (const f of ["config.js", "companion.js", "popup.js"]) vm.runInContext(read(`extension/${f}`), sandbox);
  const settle = () => new Promise((r) => setTimeout(r, 25));
  const press = async () => { for (const fn of els["btn-read-page"].listeners.click) fn({}); await settle(); };
  return { els, settle, press };
}

const POSTING = { capturable: true, ok: true, title: "Data Engineer", company: "Fabrikam", location: "Boston, MA" };

test("⭐ D63 (2) · the popup leads with the job card — the company, the D50 number box, a first-party logo or the letter", async () => {
  const p = bootPopup({ preview: POSTING, context: { packets: [], recent: [],
    posting: { known: true, saved: false, resumeReady: true, logo: "https://icons.duckduckgo.com/ip3/fabrikam.com.ico",
               scores: { base: 73, tailored: null, shown: 73, tailoredShown: false } } } });
  await p.settle(); await p.press();
  assert.equal(p.els["job-preview"].style.display, "grid");
  assert.equal(p.els["preview-company"].textContent, "Fabrikam");
  assert.equal(p.els["preview-title"].textContent, "Data Engineer · Boston, MA");
  assert.equal(p.els["preview-score"].className, "nb");
  assert.equal(textOf(p.els["preview-score"]), "73ATS", "the serif number and its ATS caption");
  // ⛔ A third-party logo address is NOT loaded from the extension — the letter tile is drawn instead.
  assert.equal(p.els["preview-tile"].textContent, "F");
  assert.equal(p.els["preview-tile"].children.length, 0, "no <img> to a third-party host");
  // No score → the dashed box, no digits.
  const q = bootPopup({ preview: POSTING, context: { packets: [], recent: [], posting: { known: false, saved: false, scores: null } } });
  await q.settle(); await q.press();
  assert.equal(q.els["preview-score"].className, "nb none");
  assert.equal(textOf(q.els["preview-score"]), "ATS");
  // A first-party stored logo IS drawn.
  const r = bootPopup({ preview: POSTING, context: { packets: [], recent: [], posting: { known: true, logo: "/api/company-logo/abc", scores: null } } });
  await r.settle(); await r.press();
  assert.match(r.els["preview-tile"].children[0]?.src || "", /^https?:\/\/[^/]+\/api\/company-logo\/abc$/);
});

test("⭐ D63 (3)(4) · on a form with a packet: marks, and the packet summary shows the TAILORED score before Fill it", async () => {
  const p = bootPopup({ preview: null, context: { recent: [], packets: [{ packetId: 3, createdAt: Date.now() - 2 * 86400000,
    stale: false, answerCount: 14, unresolvedCount: 2, resumeAvailable: true, company: "Duolingo", title: "Software Engineer II",
    scores: { base: 62, tailored: 81, shown: 81, tailoredShown: true, lower: false } }] } });
  await p.settle(); await p.press();
  const rows = p.els["packet-summary"].children.map(textOf);
  assert.deepEqual(rows, ["Résumétailored · 62 → 81", "Fields prepared14", "Will stop and ask2"]);
  assert.equal(p.els["packet-summary"].hidden, false);
  assert.equal(p.els["btn-fill-primary"].style.display, "flex");
  const marks = p.els["facts"].children;
  assert.deepEqual(marks.map(m => m.className), ["mkr ok", "mkr dim"]);
  assert.deepEqual(marks.map(textOf), ["Résumé ready", "Drafted 2d ago"]);
  assert.equal(textOf(p.els["preview-score"]), "81tailored", "the number is the résumé that would be sent");
  assert.match(read("extension/popup.html"), /id="btn-fill-primary"[^>]*>Fill it <kbd>⌃⇧Y<\/kbd>/);
});

test("⭐ D63 (6) · the ring says what it counts — 'your cap'; it stays a circle", async () => {
  const p = bootPopup({ preview: POSTING, context: null, slots: { used: 3, limit: 10 } });
  await p.settle();
  assert.equal(p.els["today-text"].textContent, "3 of 10 · your cap");
  assert.match(read("extension/popup.html"), /<circle class="ring-track"/);
});

test("⭐ D63 (1) · the in-page badge is a depth box, and each of the four states carries an ICON as well as a colour", () => {
  const src = read("extension/autofill-badge.js");
  assert.doesNotMatch(src, /border-radius:\s*(999|9999|50%)/, "no capsule (D60)");
  assert.match(src, /\.bar \{[^}]*border-radius: 12px;[^}]*border-left: 4px solid var\(--c-\$\{tone\}\);/);
  for (const s of ["progress", "required", "done", "unrecognised"]) assert.match(src, new RegExp(`\\b${s}: '<path d=`), `${s} has no icon`);
  assert.match(src, /<span class="st" data-role="icon" aria-hidden="true"><svg viewBox="0 0 24 24">\$\{ICON\}<\/svg><\/span>/);
  // ⭐ T21: the count is written in the markup (the bar is patched in place), so the mark may hold it.
  assert.match(src, /<span class="n" data-role="count" aria-hidden="true">(?:\$\{missing\.length\})?<\/span>/, "the count is a rectangular mark");
  assert.match(src, /\.n \{[^}]*border-radius: 6px;/);
  assert.match(src, /\.x \{[^}]*border-radius: 8px;/, "× is a square");
  // The four sentences are unchanged.
  for (const t of ["Autofill in progress", "Complete required fields", "Filled — review and submit", "isn't recognised — nothing was filled"]) assert.ok(src.includes(t), t);
});

test("⭐ D63 (5) · no underlined text link in the popup; LinkedIn and shortcuts live on the options page", () => {
  const html = code(read("extension/popup.html"));
  const css = code(read("extension/ui.css"));
  assert.doesNotMatch(html + css, /text-decoration:\s*underline/, "an underlined link");
  assert.doesNotMatch(html, /<a\s/, "a web link in the popup");
  assert.doesNotMatch(html, /id="btn-linkedin"|Keyboard shortcuts/);
  assert.match(html, /<button class="mb" id="btn-copy-sheet"[\s\S]*<button class="mb" id="btn-report-form"[\s\S]*<button class="mb" id="btn-settings"[^>]*>[\s\S]*More<\/button>/);
  assert.match(read("extension/options.html"), /<button class="btn" id="btn-linkedin">Sign in with LinkedIn<\/button>/);
  assert.match(read("extension/options.js"), /getElementById\('btn-linkedin'\)\?\.addEventListener\('click', \(\) => \{\s*chrome\.runtime\.sendMessage\(\{ type: 'OPEN_LINKEDIN_IMPORT' \}\)/);
  // (7) Capture with the shortcut on the primary. ⭐ T22: Score left the row (the score is the job card's number and the
  // dock's ATS tab), and the four tiles left the popup — Capture and Fill stay one shortcut or one right-click away
  // (test/t22PopupLauncher.test.js); the Draft button stays.
  assert.match(html, /<div class="btn-row" id="posting-actions"[\s\S]*Capture it <kbd>⌃⇧K<\/kbd>/);
  assert.doesNotMatch(html, /id="btn-score-primary"/);
  for (const id of ["btn-capture-primary", "btn-fill-primary", "btn-resume", "btn-open-dock"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("⭐ D63 (2) · server: the read-page answer carries the score pair, the logo and résumé-ready — for YOUR active profile", async () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x'),(2,'bo','x')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,search_query,company,title,_hash,url,is_active,updated_at,company_icon_url)
              VALUES ('lever:fab:1','','Fabrikam','Data Engineer','h','https://jobs.lever.co/fabrikam/1',1,unixepoch(),'/api/company-logo/fab')`).run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (5,1,'P','engineering','general',1),(6,2,'Q','engineering','general',1)").run();
  db.prepare("INSERT INTO ats_only_reports (user_id,job_id,domain_profile_id,ats_report,ats_score) VALUES (1,'lever:fab:1',5,'{}',62),(2,'lever:fab:1',6,'{}',40)").run();
  const ask = async (userId) => {
    const app = express(); app.use(express.json());
    app.use((req, _res, next) => { req.user = { id: userId }; next(); });
    app.use("/api/import", createImportJobRouter(db, null));
    const server = app.listen(0);
    try {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api/import/context`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "https://jobs.lever.co/fabrikam/1" }) });
      return (await r.json()).posting;
    } finally { server.close(); }
  };
  let p = await ask(1);
  assert.equal(p.logo, "/api/company-logo/fab");
  assert.deepEqual([p.scores.base, p.scores.tailored, p.scores.shown, p.resumeReady], [62, null, 62, false], "the base score for YOUR profile");
  db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,ats_score,base_ats_score) VALUES (1,'lever:fab:1','Fabrikam','Data Engineer','<p>x</p>',81,62)").run();
  p = await ask(1);
  assert.deepEqual([p.scores.base, p.scores.tailored, p.scores.shown, p.scores.tailoredShown, p.resumeReady], [62, 81, 81, true, true]);
  assert.equal((await ask(2)).scores.shown, 40, "another user's résumé and score never leak");
  // The request is unchanged: the popup still sends only { url } (background.js).
  assert.match(read("extension/background.js"), /authedFetch\(RESUME_MASTER_URL, '\/api\/import\/context', \{\s*method: 'POST', headers: \{ 'Content-Type': 'application\/json' \}, body: JSON\.stringify\(\{ url \}\),/);
});

test("D63 · the review overlay's provenance chips are marks, and its bar is square-ended (D60)", () => {
  const src = read("extension/review-overlay.js");
  const pill = src.slice(at(src, "#${ID} .rm-pill {", 0, "the chip rule"), at(src, "#${ID} .rm-pill.ok", 0, "its ok tone"));
  assert.match(pill, /border-radius: 6px;/);
  assert.match(pill, /border-left: 3px solid var\(--mk\);/);
  assert.match(src, /\.rm-bar \{[^}]*border-radius: 2px;/);
  assert.doesNotMatch(src, /border-radius:\s*999px/);
});
