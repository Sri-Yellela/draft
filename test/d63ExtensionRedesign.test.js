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

// ⭐ T31 (owner 10-25: "as much info moved away from the current panels as possible; info relayed when it is needed"):
// the toolbar popup is retired, and D63 (2)(3)(4)(6) with it — the job card leading the popup, the marks and the packet
// summary before Fill it, the today ring. The score is the dock's ATS tab's; what a fill will do is said by the fill;
// nothing counts toward anything (test/d56ManualHandoff.test.js). The server half of (2) — the read-page answer's score
// pair and logo — stays pinned below.

test("⭐ D63 (1) · the in-page badge is a depth box, and each of the four states carries an ICON as well as a colour", () => {
  const src = read("extension/autofill-badge.js");
  assert.doesNotMatch(src, /border-radius:\s*(999|9999|50%)/, "no capsule (D60)");
  // ⭐ T26 (owner, 10-19: "too many colours… choppy"): the line is no longer a tinted, bordered box — it sits on the dock's
  // one surface; its state's colour is the icon's alone (still an icon AND a colour)
  assert.match(src, /\.bar \{[^}]*background: transparent; \}/);
  assert.doesNotMatch(src.slice(at(src, ".bar {"), at(src, ".st {")), /border/);
  assert.match(src, /\.st \{[^}]*color: var\(--c-\$\{tone\}\); \}/);
  for (const s of ["progress", "required", "done", "unrecognised"]) assert.match(src, new RegExp(`\\b${s}: '<path d=`), `${s} has no icon`);
  assert.match(src, /<span class="st" data-role="icon" aria-hidden="true"><svg viewBox="0 0 24 24">\$\{ICON\}<\/svg><\/span>/);
  // ⭐ T21: the count is written in the markup (the bar is patched in place), so the mark may hold it.
  assert.match(src, /<span class="n" data-role="count" aria-hidden="true">(?:\$\{missing\.length\})?<\/span>/, "the count is a rectangular mark");
  assert.match(src, /\.x \{[^}]*border-radius: 8px;/, "× is a square");
  // The four sentences are unchanged.
  for (const t of ["Autofill in progress", "Complete required fields", "Filled — review and submit", "isn't recognised — nothing was filled"]) assert.ok(src.includes(t), t);
});

test("⭐ D63 (5) · no underlined text link on the extension's pages; LinkedIn and shortcuts live on the options page (⭐ T31: the only page now)", () => {
  const html = code(read("extension/options.html"));
  const css = code(read("extension/ui.css"));
  assert.doesNotMatch(html + css, /text-decoration:\s*underline/, "an underlined link");
  assert.doesNotMatch(html, /<a\s/, "a web link on the settings page");
  // ⭐ T31: in Settings → Account
  assert.match(read("extension/options.html"), /<section id="account"[\s\S]*<button class="btn" id="btn-linkedin" type="button">Sign in with LinkedIn<\/button>/);
  assert.match(read("extension/options.js"), /getElementById\('btn-linkedin'\)\?\.addEventListener\('click', \(\) => \{\s*chrome\.runtime\.sendMessage\(\{ type: 'OPEN_LINKEDIN_IMPORT' \}\)/);
  assert.match(html, /<section id="shortcuts"[\s\S]*Keyboard shortcuts/);
  // (7) Capture and Fill stay one shortcut, one right-click — and the toolbar press — away (test/t22PopupLauncher.test.js)
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.commands["capture-job"].suggested_key.default, "Ctrl+Shift+K");
  assert.equal(manifest.commands["fill-gated-application"].suggested_key.default, "Ctrl+Shift+Y");
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
