// ⭐ D191 · THE EXTENSION AS draft's FRONT DOOR (owner 11-12) — what 46m built, and what was already there, pinned:
//   (1) draft's styling and the person's Appearance (already: extension/tokens.js carries every site theme; dockHost.js
//       reads GET /api/settings/appearance) · (2d) the employer's card on a posting, from draft's own records · P1 the
//   person's day as the press's home line and a toolbar badge of today's undecided matches · P4 signed out: the employer
//   from draft's PUBLIC data, and Sign up · (5b) a Sent from the extension recorded as such, counted in Admin · (6) no
//   <all_urls>. ⛔ Nothing here calls a model (the owner's rule, 11-14).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { extensionHome, badgeText, companyCard } from "../services/extensionHome.js";
import { relayFor, companyLine, homeLine } from "../extension/toolbarPress.js";
import { companyFacts } from "../extension/boardJob.js";
import { recordSubmission, USER_METHODS, SERVER_METHODS, SUBMIT_METHODS } from "../services/applicationRecords.js";
import { extensionSent } from "../services/submitFamilies.js";
import { EXT_THEMES } from "../extension/tokens.js";
import { at } from "../test-support/sourceAnchors.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");
const SIGNED_IN = { authenticated: true };

function homeDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, run_id INTEGER, user_id INTEGER, job_id TEXT, status TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, starred INTEGER DEFAULT 0, disliked INTEGER DEFAULT 0);
    CREATE TABLE daily_drafts (user_id INTEGER, profile_id INTEGER, draft_date TEXT, position INTEGER, job_id TEXT, band TEXT, card_json TEXT);
    INSERT INTO apply_run_jobs (run_id, user_id, job_id, status) VALUES (1, 7, 'a', 'submitted'), (1, 7, 'b', 'held_review'), (1, 7, 'c', 'held_gate'), (1, 8, 'z', 'held_review');
    INSERT INTO user_jobs VALUES (7, 'd2', 0, 1);
    INSERT INTO daily_drafts (user_id, profile_id, draft_date, position, job_id) VALUES (7, 1, '2026-11-14', 0, 'd1'), (7, 1, '2026-11-14', 1, 'd2'), (7, 1, '2026-11-14', 2, 'b'), (7, 1, '2026-11-14', 3, 'd4');`);
  return db;
}

test("d191BadgeShowsNewMatches — today's dealt cards the person hasn't decided; the badge says it; per-user reads only", () => {
  const db = homeDb();
  const h = extensionHome(db, 7, { date: "2026-11-14" });
  assert.equal(h.newMatches, 2, "d1 and d4 (d2 passed, b drafted)");
  assert.equal(h.needsYou, 2); assert.equal(h.drafted, 3); assert.equal(h.sent, 1);
  assert.equal(badgeText(h), "2");
  assert.equal(badgeText({ newMatches: 0 }), ""); assert.equal(badgeText({ newMatches: 140 }), "99+"); assert.equal(badgeText(null), "");
  assert.equal(extensionHome(db, 7, { date: "2026-11-13" }).newMatches, null, "not dealt yet → no number");
  // never a board pass: the module reads apply_run_jobs, user_jobs and daily_drafts — not scraped_jobs' board
  const src = read("services/extensionHome.js");
  const home = src.slice(at(src, "export function extensionHome"), at(src, "export function badgeText"));
  assert.doesNotMatch(home, /scraped_jobs|boardPage|callTask/);
  // the worker asks at most every few minutes, on a page load or a press — never on a timer
  const bg = read("extension/background.js");
  assert.match(bg, /const HOME_EVERY_MS = 5 \* 60 \* 1000;/);
  assert.match(bg, /onUpdated\?\.addListener\?\.\(\(_id, info\) => \{ if \(info\?\.status === 'complete'\) void extensionHomeFacts\(\)/);
  assert.doesNotMatch(bg.slice(at(bg, "const HOME_EVERY_MS"), at(bg, "async function publicCompanyCard")), /setInterval|chrome\.alarms/);
});

test("d191PanelMatchNoModelCall — the press's answer (match + the employer's card) and the home view call no model", () => {
  const code = (f) => read(f).replace(/^\s*\/\/.*$/gm, "").replace(/\/\/[^\n"'`]*$/gm, "");   // code, not the prose about it
  for (const f of ["services/extensionHome.js", "routes/extensionJob.js"]) assert.doesNotMatch(code(f), /callTask|anthropic|assistant\.chat/, f);
  const r = read("routes/extensionJob.js");
  assert.match(r, /ats, basis: ats\.state === "ready" \? "board" : null, company: cardOf\(db, row\.company, url\) \};/);
  assert.match(r, /router\.get\("\/api\/extension\/home", requireAuth,/);
});

test("the employer's card: the record, open jobs on draft, the H-1B record, its page — read-only", () => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, domain TEXT);
    CREATE TABLE company_aliases (alias_key TEXT PRIMARY KEY, company_id INTEGER, evidence TEXT);
    CREATE TABLE job_company (job_id TEXT PRIMARY KEY, company_id INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, is_active INTEGER);
    INSERT INTO companies VALUES (1, 'kestrel-labs', 'Kestrel Labs', 'kestrel.example');
    INSERT INTO company_aliases VALUES ('name:kestrel-labs', 1, 'name');
    INSERT INTO job_company VALUES ('j1', 1), ('j2', 1), ('j3', 1);
    INSERT INTO scraped_jobs VALUES ('j1', 1), ('j2', 1), ('j3', 0);`);
  const before = db.prepare("SELECT COUNT(*) FROM company_aliases").pluck().get();
  const c = companyCard(db, { company: "Kestrel Labs" });
  assert.deepEqual({ name: c.name, known: c.known, openJobs: c.openJobs, href: c.href }, { name: "Kestrel Labs", known: true, openJobs: 2, href: "https://jobsviadraft.com/companies/kestrel-labs" });
  assert.equal(companyCard(db, { company: "Nobody Co" }).known, false);
  assert.equal(db.prepare("SELECT COUNT(*) FROM company_aliases").pluck().get(), before, "nothing written");
  assert.equal(companyCard(db, { company: "" }), null);
});

test("the extension takes the card's named fields only, and links only to draft's own site", () => {
  assert.deepEqual(companyFacts({ name: " Kestrel ", openJobs: 4.7, sponsorship: { text: "Filed 12 certified LCAs in FY2025" }, href: "https://jobsviadraft.com/companies/kestrel", extra: "x" }),
    { name: "Kestrel", openJobs: 4, sponsorship: "Filed 12 certified LCAs in FY2025", href: "https://jobsviadraft.com/companies/kestrel" });
  assert.equal(companyFacts({ name: "K", href: "https://evil.example/x" }).href, null);
  assert.equal(companyFacts({ name: "" }), null);
  assert.equal(companyFacts(null), null);
});

test("D191 (2d) / P1 · the press says the employer's card on a posting, and the day only when nothing else is said", () => {
  const card = { name: "Kestrel", openJobs: 23, sponsorship: "Filed 412 certified LCAs in FY2025", href: "https://jobsviadraft.com/companies/kestrel" };
  assert.equal(companyLine(card), "Kestrel: Filed 412 certified LCAs in FY2025 · 23 open jobs on draft");
  assert.equal(companyLine({ name: "Quiet Co", openJobs: 0, sponsorship: null }), null, "nothing to say → nothing said (T31)");
  const ctx = { identity: { action: "capture", bind: false }, company: card };
  const specs = relayFor({ identity: SIGNED_IN, ctx, home: { newMatches: 3, needsYou: 1 } });
  assert.deepEqual(specs.map(s => s.id), ["draft-relay", "draft-company"], "the capture question + the card; no home line on top of a question");
  assert.deepEqual(specs[1].actions.map(a => a.id), ["open-company"]);
  const quiet = relayFor({ identity: SIGNED_IN, ctx: { identity: null }, home: { newMatches: 3, needsYou: 1, drafted: 2, sent: 0 } });
  assert.equal(quiet.length, 1); assert.equal(quiet[0].text, "Today: 3 new matches · 1 needs you · 2 drafted");
  assert.deepEqual(quiet[0].actions.map(a => a.id), ["open-ask", "open-draft"], "Open = the extension's panel; Matches = draft's board");
  assert.equal(homeLine({ newMatches: 0, needsYou: 0, drafted: 0, sent: 0 }), null);
});

test("d191SignedOutShowsCompanyCard — signed out: Sign in, then the employer from draft's public data and Sign up", () => {
  const specs = relayFor({ identity: { authenticated: false }, card: { name: "Kestrel", openJobs: 5, sponsorship: null } });
  assert.deepEqual(specs.map(s => s.id), ["draft-relay", "draft-company"]);
  assert.match(specs[1].text, /^Kestrel: 5 open jobs on draft — sign up to see your match and apply with one click\.$/);
  assert.deepEqual(specs[1].actions.map(a => a.id), ["sign-up"]);
  assert.equal(relayFor({ identity: { authenticated: false } }).length, 1, "no card → just Sign in");
  const r = read("routes/extensionJob.js");
  const pub = r.slice(at(r, 'router.get("/api/extension/company"'), at(r, "return router;"));
  assert.ok(!/requireAuth/.test(pub), "public — no account");
  assert.match(pub, /okCompany\(String\(req\.ip/);
  const bg = read("extension/background.js");
  assert.match(bg, /fetch\(`\$\{RESUME_MASTER_URL\}\/api\/extension\/company\?\$\{q\}`, \{ credentials: 'omit' \}\)/, "no cookie sent");
  for (const act of ["'open-company'", "'open-draft'", "'open-needs'", "'sign-up'"]) assert.ok(bg.includes(`${act}: async`), act);
});

test("d191SourceExtensionInTrace — a Sent the extension reports is method 'extension' (server-written), counted in Admin", () => {
  assert.ok(SUBMIT_METHODS.extension);
  assert.deepEqual([...SERVER_METHODS], ["draft", "extension"]);
  assert.ok(!USER_METHODS.includes("extension") && !USER_METHODS.includes("draft"), "a person can't claim either");
  const r = read("routes/apply.js");
  assert.match(r, /serverMethod: fromExtension \? "extension" : null/);
  assert.match(r, /const fromExtension = \(\(\) => \{ try \{ return isExtensionCredential\(req\); \}/);
  assert.throws(() => recordSubmission({}, { userId: 1, jobId: "j", input: { submittedAt: Date.now(), method: "extension" } }), /How did you submit it/);
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE application_records (id INTEGER PRIMARY KEY, method TEXT, submitted_at INTEGER);
    INSERT INTO application_records (method, submitted_at) VALUES ('extension', unixepoch() - 86400), ('extension', unixepoch() - 20 * 86400), ('ats_portal', unixepoch());`);
  assert.deepEqual(extensionSent(db), { d7: 1, d30: 2 });
  assert.match(read("client/src/panels/adminOps.jsx"), /sent from the extension, last \$\{days\} days/);
});

test("d191StylingFromDraftTokens / d191ThemeFromAppearanceSetting — every site theme, from the account's Appearance", () => {
  const site = fs.readdirSync(path.join(ROOT, "client", "src", "themes")).filter(f => /-(light|dark)\.js$/.test(f)).map(f => f.replace(/\.js$/, "")).sort();
  for (const id of site) assert.ok(EXT_THEMES[id], `the extension carries ${id}`);
  assert.match(read("extension/dockHost.js"), /GET \/api\/settings\/appearance/);
});

test("d191NoAllUrlsPermission — activeTab, storage, scripting, contextMenus; draft's own origin; every ATS host optional", () => {
  const m = JSON.parse(read("extension/manifest.json"));
  assert.deepEqual([...m.permissions].sort(), ["activeTab", "contextMenus", "scripting", "storage"]);
  assert.deepEqual(m.host_permissions, ["https://jobsviadraft.com/*"]);
  assert.ok(!JSON.stringify(m.permissions).includes("<all_urls>") && !m.host_permissions.includes("<all_urls>"));
  assert.ok(!m.permissions.includes("tabs") && !m.permissions.includes("history") && !m.permissions.includes("webRequest"), "nothing that watches browsing");
});

test("d191NeverAutoSubmits — the extension still never sends without the person's press (D36 / A207)", () => {
  const sub = read("extension/extensionSubmit.js");
  assert.match(sub, /trusted|isTrusted/, "the one press is a trusted one");
  const bg = read("extension/background.js");
  assert.doesNotMatch(bg.slice(at(bg, "const HOME_EVERY_MS"), at(bg, "async function publicCompanyCard")), /submit/i);
});

test("D191 (2e) / (3) / P5 · the extension's panel runs the SITE's engine, mirrored byte-identical, and asks no model", async () => {
  const norm = (p) => read(p);
  assert.equal(norm("extension/assistantEngine.js"), norm("shared/assistantEngine.js"), "change both copies of the engine");
  assert.equal(norm("extension/assistantVoice.js"), norm("shared/assistantVoice.js"), "change both copies of the voice helper");
  assert.equal(norm("extension/commands-v1.json"), norm("content/assistant/commands-v1.json"), "change both copies of the vocabulary");
  const ask = norm("extension/ask.js");
  assert.match(ask, /import COMMANDS from '\.\/commands-v1\.json' with \{ type: 'json' \};/);
  assert.doesNotMatch(ask, /assistant\/ask|anthropic|\/v1\/messages/, "no model route");
  assert.doesNotMatch(ask, /const RESUME_MASTER_URL = 'https:\/\/jobsviadraft\.com';/, "draft's address comes from the worker — one source");
  assert.match(ask, /t3: \(\) => \(\{ ask: /, "T3 is not offered here");
  const bg = norm("extension/background.js");
  assert.match(bg, /const fromOwnPage = \(sender\) => sender\?\.id === chrome\.runtime\.id && String\(sender\?\.url \|\| ''\)\.startsWith\(chrome\.runtime\.getURL\('ask\.html'\)\);/);
  assert.match(bg, /msg\.act === 'draft' \|\| msg\.act === 'capture' \? DOCK_ACTS\[msg\.act\] : null/, "only the dock's own Capture / Draft");
  const m = JSON.parse(norm("extension/manifest.json"));
  assert.ok(m.commands["open-ask-draft"] && !m.commands["open-ask-draft"].suggested_key, "a shortcut the person binds (no new default key)");
  const { CONTEXT_MENUS, MENU_ASK } = await import("../extension/formReport.js");
  assert.ok(CONTEXT_MENUS.some(i => i.id === MENU_ASK && i.title === "Ask Tiny…"), "46n: the panel's chat is Tiny");
  // the board takes the panel's search by address, once
  const bs = norm("client/src/lib/boardSearch.js");
  assert.match(bs, /export const SEARCH_PARAM = "search";/);
  assert.match(bs, /u\.searchParams\.delete\(SEARCH_PARAM\);/);
});

test("46n · the card asks the H-1B record by the posting's own company string first (as the board does), then the record's name", () => {
  const src = read("services/extensionHome.js");
  assert.match(src, /for \(const key of \[\.\.\.new Set\(\[name, rec\?\.name\]\.filter\(Boolean\)\)\]\) \{/);
  assert.match(src, /sponsorshipFactFor\(db, key\); if \(f\) \{ sponsorship = /);
});

test("46n · the panel's chat is Tiny, with the fox: the same name and face as on draft and the PDF-tools site; no 'Ask draft' left on screen", () => {
  const html = read("extension/ask.html");
  assert.match(html, /<title>Tiny — draft<\/title>/);
  assert.match(html, /<span class="tiny-face" id="ask-tiny-face" aria-hidden="true"><\/span>/);
  assert.match(html, /<h2 id="ask-tiny-name">Tiny<\/h2>/);
  assert.match(html, /aria-label="Tell Tiny what to do"/);
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ""), /Ask draft/, "nothing the person sees says Ask draft");
  assert.match(html, /\.tiny-face \{[^}]*width: 32px; height: 32px; border-radius: 50%;/, "the fox's well is a perfect circle (D60)");
  const ask = read("extension/ask.js");
  assert.match(ask, /import \{ tinySvg, TINY_NAME \} from '\.\/tinyMascot\.js';/);
  assert.match(ask, /\$\('ask-tiny-face'\)\.innerHTML = tinySvg\(\{ size: 26 \}\);/);
  assert.equal(read("extension/tinyMascot.js"), read("shared/tinyMascot.js"), "change both copies of the mascot");
  assert.match(JSON.parse(read("extension/manifest.json")).commands["open-ask-draft"].description, /Tiny$/);
});

test("A211 (b) · the home view counts the applications waiting to be sent from this browser; the press and the panel offer the runner", async () => {
  const { EXTENSION_SUBMIT_REASONS } = await import("../services/extensionHome.js");
  const ext = await import("../extension/extensionSubmit.js");
  assert.deepEqual([...EXTENSION_SUBMIT_REASONS], [...ext.EXTENSION_SUBMIT_REASONS], "the server's list = the extension's (change both)");
  const db = homeDb();
  db.exec(`ALTER TABLE apply_run_jobs ADD COLUMN hidden_at INTEGER;
    CREATE TABLE apply_gate_packets (id INTEGER PRIMARY KEY, user_id INTEGER, run_job_id INTEGER, gate_reason TEXT, consumed_at INTEGER, created_at INTEGER DEFAULT (unixepoch()));
    INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, hidden_at) VALUES (50, 2, 7, 'h', 'held_gate', unixepoch());
    INSERT INTO apply_gate_packets (user_id, run_job_id, gate_reason, consumed_at, created_at) VALUES
      (7, NULL, 'server_submit_paused', NULL, unixepoch()),
      (7, NULL, 'flagged_spam', NULL, unixepoch() - 3600),
      (7, NULL, 'server_submit_paused', unixepoch(), unixepoch()),
      (7, NULL, 'server_submit_paused', NULL, unixepoch() - 80 * 3600),
      (7, 50, 'server_submit_paused', NULL, unixepoch()),
      (7, NULL, 'login_required', NULL, unixepoch()),
      (8, NULL, 'server_submit_paused', NULL, unixepoch());`);
  assert.equal(extensionHome(db, 7, { date: "2026-11-14" }).toSend, 2, "fresh, unsent, not cleared, extension-submit, this person's");
  assert.equal(extensionHome(homeDb(), 7).toSend, 0, "no packets table (an older schema) → 0, the view still draws");
  const quiet = relayFor({ identity: SIGNED_IN, ctx: { identity: null }, home: { newMatches: 0, needsYou: 0, drafted: 0, sent: 0, toSend: 3 } });
  assert.equal(quiet[0].text, "3 waiting to send from this browser");
  assert.deepEqual(quiet[0].actions.map(a => [a.id, !!a.primary]), [["open-runner", true], ["open-ask", false], ["open-draft", false]]);
  const both = relayFor({ identity: SIGNED_IN, ctx: { identity: null }, home: { newMatches: 2, toSend: 1 } });
  assert.equal(both[0].text, "Today: 2 new matches · 1 waiting to send from this browser");
  const none = relayFor({ identity: SIGNED_IN, ctx: { identity: null }, home: { newMatches: 2, toSend: 0 } });
  assert.deepEqual(none[0].actions.map(a => a.id), ["open-ask", "open-draft"], "nothing waiting → no runner button");
  assert.match(read("extension/ask.js"), /\$\('ask-runner'\)\.textContent = n > 0 \? `\$\{n\} waiting to send from this browser — Open the runner` : 'Apply while this is open';/);
  // no timer: the count rides the existing home read (on a page load or a press, at most every few minutes)
  assert.doesNotMatch(read("extension/toolbarPress.js"), /setInterval|chrome\.alarms/);
});
