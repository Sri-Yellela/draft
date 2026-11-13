// ⭐ A207 (46l, owner 11-13): "Make the extension path the primary submit for ATS boards that flag server submissions. Draft
// fills everything, you press one button in the extension, it submits from your browser. … if A185's server submit gets a
// spam flag on Ashby, that ATS is marked 'extension submit' and future runs for it go straight to the extension path … The
// retry should not re-submit into the same rejection; it should switch to the extension path and tell you. Count which ATS
// boards reject server submissions, so the data shows whether this is 5% of applications or 50%."
//   (a) ONE press in the extension sends it — a trusted press, top frame, Ready; Sent only from the result page (FA5)
//   (b) the FIRST flag marks the family "extension submit", durably, cleared only by the owner
//   (c) a flagged submit is terminal for the server path and the person is told (switched_to_extension)
//   (d) Admin: rejected of tried, extension of all — counts, never a bare percent
// Synthetic person (Ada), local pages only; nothing leaves this machine.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import Database from "better-sqlite3";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { at } from "../test-support/sourceAnchors.js";
import {
  recordSubmitOutcome, serverSubmitBlock, familyPause, familyMark, clearFamilyMark, submitShare, submitOutcomeCounts,
  FLAG_THRESHOLD, SPAM_FLAG_RE,
} from "../services/submitFamilies.js";
import { autoApply } from "../services/applyAutomation.js";
import { submitRetryVerdict } from "../services/submitRetry.js";
import { configureNotify, notifyRunJobOutcome, eventText, eventEmail, NOTIFY_EVENTS } from "../services/notify.js";
import {
  classifyAfterPress, sendWithPress, pressSubmitInPage, readResultInPage, SUBMIT_LABEL_RULE, isExtensionSubmitPacket,
  SPAM_FLAG_SOURCE, EXTENSION_SUBMIT_REASONS,
} from "../extension/extensionSubmit.js";
import { renderOverlay, panelRowsForStep } from "../extension/review-overlay.js";
import { C_LIGHT, C_DARK } from "../extension/tokens.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const chrome = await findChrome();
const SKIP = chrome.skip || false;

function familyDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER, user_id INTEGER NOT NULL,
      job_id TEXT, level TEXT NOT NULL DEFAULT 'info', event TEXT NOT NULL, message TEXT, details_json TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);`);
  const log = (userId, jobId, at = null) => (e, m, d) => db.prepare(`INSERT INTO apply_job_logs (user_id, job_id, event, message, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, unixepoch()))`).run(userId, String(jobId), e, m, JSON.stringify(d), at);
  return { db, log };
}
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };

test("a207FamilyMark (b): the FIRST spam flag marks the family 'extension submit' — durable past 24 h, until the owner clears it", () => {
  const { db, log } = familyDb();
  assert.equal(FLAG_THRESHOLD, 1);
  assert.equal(serverSubmitBlock(db, { ats: "lever", userId: 1, jobId: "l::1" }), null, "no flag yet: the server may submit");
  quiet(() => recordSubmitOutcome(db, { ats: "lever", result: { status: "held_review", reasonCode: "flagged_spam" }, log: log(1, "l::1"), runJobId: 41, jobId: "l::1" }));
  const mark = familyMark(db, "lever");
  assert.equal(mark.mode, "extension");
  assert.equal(mark.runJobId, 41, "Admin shows which run set it");
  assert.ok(mark.at > 0, "…and when");
  assert.equal(familyPause(db, "lever"), "marked");
  assert.equal(serverSubmitBlock(db, { ats: "lever", userId: 2, jobId: "l::7" }), "server_submit_paused", "every later run, every person");
  // durable: the flag's log row ages out of any window and the mark stays
  db.prepare("UPDATE apply_job_logs SET created_at = created_at - 40 * 86400").run();
  assert.equal(familyPause(db, "lever"), "marked", "no 24-h lapse");
  // a second flag never moves the first mark
  quiet(() => recordSubmitOutcome(db, { ats: "lever", result: { status: "held_review", reasonCode: "flagged_spam" }, log: log(3, "l::9"), runJobId: 99, jobId: "l::9" }));
  assert.equal(familyMark(db, "lever").runJobId, 41);
  // only the owner clears it (Admin, audited)
  assert.equal(clearFamilyMark(db, "lever").runJobId, 41);
  assert.equal(familyPause(db, "lever"), null);
  assert.equal(familyPause(db, "ashby"), "always", "Ashby stays always");
  const srv = read("server.js");
  assert.match(srv, /app\.post\("\/api\/admin\/submit-families\/:ats\/clear", requireAdmin,[\s\S]{0,400}writeAudit\(db, \{ actor: actorOf\(req\), action: "submit_family_clear"/);
  assert.match(read("client/src/panels/adminOps.jsx"), /\/api\/admin\/submit-families\/\$\{encodeURIComponent\(ats\)\}\/clear/);
});

test("a207RetrySwitches (c): a flagged submit is never retried from the server — it moves to the extension and the person is told", async () => {
  assert.equal(submitRetryVerdict({ status: "held_review", reasonCode: "flagged_spam" }, { attempt: 1 }).retry, false, "terminal for the server path");
  assert.deepEqual(NOTIFY_EVENTS.switched_to_extension.defaults, { push: true, email: true });
  // the push / in-app line names no company (D100 P4); the email to the person's own inbox does
  const t = eventText("switched_to_extension", { company: "Example Robotics" });
  assert.equal(t.body, "The site flagged draft's submit — it's ready in your extension, one press sends it.");
  assert.doesNotMatch(t.body, /Example Robotics/);
  assert.match(eventEmail("switched_to_extension", { company: "Example Robotics" }, "https://x").text, /^Example Robotics: the site flagged draft's submit — it's ready in your extension, one press sends it\./);
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT, reason_code TEXT);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, company TEXT);
    CREATE TABLE apply_remote_runs (run_job_id INTEGER, state TEXT);
    CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, type TEXT, message TEXT, payload TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE notification_prefs (user_id INTEGER, event TEXT, push INTEGER, email INTEGER);
    INSERT INTO scraped_jobs VALUES ('ab::1', 'Example Robotics');
    INSERT INTO apply_run_jobs VALUES (7, 1, 'ab::1', 'held_review', 'flagged_spam'), (8, 1, 'ab::2', 'held_review', 'server_submit_paused');`);
  const config = configureNotify({ db, fetchImpl: async () => ({ ok: true, status: 201 }), env: {}, log: { warn() {} } });
  try {
    await notifyRunJobOutcome(db, 7, { config });
    await notifyRunJobOutcome(db, 8, { config });
    const rows = db.prepare("SELECT type, message FROM notifications ORDER BY id").all();
    assert.equal(rows[0].type, "switched_to_extension");
    assert.equal(rows[1].type, "needs_you", "an already-marked family's hold is the usual nudge, not a second 'switched'");
  } finally { configureNotify({}); }
  // the re-run (Solve it here) tells the person too
  assert.match(read("routes/apply.js"), /if \(result\?\.reasonCode === "flagged_spam"\) \{\n\s*try \{ notifySwitchedToExtension\(db, \{ userId, runJobId, jobId \}\); \} catch \{\}/);
});

test("a207Share (d): rejected of tried and extension of all, per ATS and overall, over 7 and 30 days — counts", () => {
  const { db, log } = familyDb();
  const now = Math.floor(Date.now() / 1000);
  const put = (ats, outcome, daysAgo = 0) => log(1, `${ats}::${Math.random()}`, now - daysAgo * 86400)("submit_outcome", "", { ats, outcome });
  for (let i = 0; i < 10; i++) put("greenhouse", "sent");
  put("greenhouse", "failed");
  put("lever", "flagged_spam");
  put("lever", "paused"); put("lever", "paused", 12);
  put("ashby", "paused", 3);
  const s = submitShare(db, { now });
  const gh = s.d30.families.find(f => f.ats === "greenhouse"), lv30 = s.d30.families.find(f => f.ats === "lever"), lv7 = s.d7.families.find(f => f.ats === "lever");
  assert.deepEqual([gh.rejected, gh.tried, gh.extension, gh.all], [0, 11, 0, 11]);
  assert.deepEqual([lv30.rejected, lv30.tried, lv30.extension, lv30.all], [1, 1, 3, 3]);
  assert.deepEqual([lv7.extension, lv7.all], [2, 2], "the 7-day window leaves the 12-day-old row out");
  assert.deepEqual([s.d30.overall.rejected, s.d30.overall.tried], [1, 12], "1 of 12 server submits rejected");
  assert.deepEqual([s.d30.overall.extension, s.d30.overall.all], [4, 15], "4 of 15 applications on extension-submit sites");
  assert.match(read("server.js"), /app\.get\("\/api\/admin\/submit-share", requireAdmin/);
  const ui = read("client/src/panels/adminOps.jsx");
  assert.match(ui, /`\$\{w\.overall\.rejected\} of \$\{w\.overall\.tried\}`/, "counts, never a bare percent (D111)");
  assert.doesNotMatch(ui.slice(at(ui, "export function SubmitOutcomesSection"), at(ui, "function OutcomeBars(")), /%\}|toFixed|\* 100/);
  assert.equal(submitOutcomeCounts(db).families.length >= 3, true);
});

test("a207SentFromResultPage (a): Sent only on a confirmation the press led to — never a form page that says 'thank you'", () => {
  assert.equal(SPAM_FLAG_SOURCE, SPAM_FLAG_RE.source, "the extension reads the refusal with the server's words");
  const before = { url: "https://jobs.example.com/apply" };
  assert.equal(classifyAfterPress({ before, after: { url: "https://jobs.example.com/apply/thanks", text: "Thank you for applying!", hasSubmit: false } }), "sent");
  assert.equal(classifyAfterPress({ before, after: { url: before.url, text: "Application submitted.", hasSubmit: false } }), "sent", "an in-place confirmation (the form gone)");
  assert.equal(classifyAfterPress({ before, after: { url: before.url, text: "Thank you for your interest in Example. Name* Email*", hasSubmit: true } }), "on_form", "the form page itself");
  assert.equal(classifyAfterPress({ before, after: { url: before.url + "/x", text: "Your application submission was flagged as possible spam. Thank you for your interest.", hasSubmit: false } }), "flagged", "refusal read first");
  assert.equal(classifyAfterPress({ before, after: null }), "unknown");
  assert.ok(isExtensionSubmitPacket({ gateReason: "server_submit_paused" }) && isExtensionSubmitPacket({ gateReason: "flagged_spam" }));
  assert.ok(!isExtensionSubmitPacket({ gateReason: "manual_review" }) && !isExtensionSubmitPacket({ gateReason: "login_required" }) && !isExtensionSubmitPacket(null));
  assert.deepEqual([...EXTENSION_SUBMIT_REASONS], ["server_submit_paused", "flagged_spam"]);
});

test("a207NoSubmitWithoutPress (a): the only send is the panel's trusted press → GATE_SEND → sendWithPress; nothing else clicks Submit", async () => {
  const bg = read("extension/background.js");
  const send = bg.slice(at(bg, "if (msg?.type === 'GATE_SEND') {"), at(bg, "if (msg?.type === 'GATE_SUBMITTED') {"));
  assert.match(send, /if \(msg\.trigger !== 'press' \|\| msg\.trusted !== true \|\| sender\?\.frameId !== 0 \|\| !tabId\) \{/, "top frame, the panel's press");
  assert.match(send, /if \(!isExtensionSubmitPacket\(held\?\.packet\)\) return \{ ok: false, outcome: 'refused'/, "an extension-submit packet only");
  // sendWithPress / pressSubmitInPage are reached from GATE_SEND alone
  for (const f of fs.readdirSync("extension").filter(f => f.endsWith(".js") && f !== "extensionSubmit.js")) {
    const s = read(`extension/${f}`);
    const uses = (s.match(/sendWithPress\(|pressSubmitInPage/g) || []).length;
    if (f === "background.js") assert.equal(uses, 1, "background: once, inside GATE_SEND");
    else assert.equal(uses, 0, `${f} never presses Submit`);
  }
  assert.doesNotMatch(read("extension/extensionSubmit.js").replace(/^\s*(\/\/|\*).*$/gm, ""), /\.requestSubmit\s*\(|\.submit\s*\(\s*\)|setTimeout\([^)]*click/);
  // no button found → nothing recorded
  let recorded = 0;
  const r = await sendWithPress({ tabId: 1, executeScript: async () => ({ clicked: false }), recordSubmitted: async () => { recorded++; return { ok: true }; }, sleep: async () => {} });
  assert.equal(r.outcome, "no_button");
  assert.equal(recorded, 0);
  // a refusal in the person's own browser records nothing
  let n = 0;
  const r2 = await sendWithPress({ tabId: 1, sleep: async () => {}, waitMs: 3, stepMs: 1, recordSubmitted: async () => { recorded++; return { ok: true }; },
    executeScript: async ({ func }) => (func === pressSubmitInPage ? { clicked: true, url: "https://a/x" } : (n++, { url: "https://a/y", text: "flagged as possible spam", hasSubmit: false })) });
  assert.equal(r2.outcome, "flagged");
  assert.equal(recorded, 0);
  // the D36 line moved: "never submits WITHOUT the person's press" (the store listing says so too)
  assert.match(read("extension/submission/STORE_LISTING.md"), /never submits an application on its own/);
});

// ── real Chrome ─────────────────────────────────────────────────────────────────────────────────────────────────────
const FORM = (title) => `<!doctype html><html><body><h1>${title}</h1><p>Thank you for your interest in Example Robotics.</p>
<form id="f" method="post" action="submit"><label for="n">Full name</label><input id="n" name="name" required>
<label for="e">Email</label><input id="e" name="email" type="email" required>
<button type="button">Save for later</button><button type="submit">Submit Application</button></form></body></html>`;
const REFUSAL = `<!doctype html><html><body><h2>We couldn't submit your application</h2><p>Your application submission was flagged as possible spam.</p></body></html>`;
const THANKS = `<!doctype html><html><body><h2>Application submitted</h2><p>Thank you for applying — we'll be in touch.</p></body></html>`;
const PROFILE_PAYLOAD = { field_map: { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", email: "ada@example.com" }, handler_map: {}, custom_answers: {} };
const MIN_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("⛔ A207 ACCEPTANCE (real Chrome): flagged on the server → family marked, person told → next run never clicks → ONE press in the person's browser sends it → Sent from the confirmation → Admin 1 of N", { skip: SKIP, timeout: 240000 }, async (t) => {
  // the practice employer: the SERVER's submit (draft's browser, path /server) is refused; the person's (/own) is accepted
  const posts = { server: 0, own: 0 };
  const s = http.createServer((req, res) => {
    const own = req.url.startsWith("/own");
    if (req.method === "POST") { posts[own ? "own" : "server"]++; req.resume(); res.writeHead(200, { "content-type": "text/html" }); return res.end(own ? THANKS : REFUSAL); }
    res.writeHead(200, { "content-type": "text/html" }); res.end(FORM(own ? "Apply (your browser)" : "Apply"));
  });
  await new Promise(r => s.listen(0, "127.0.0.1", r));
  t.after(() => s.close());
  const base = `http://127.0.0.1:${s.address().port}`;
  const tmpPdf = `${process.env.TEMP || "/tmp"}/a207.pdf`;
  fs.writeFileSync(tmpPdf, MIN_PDF);
  const { db, log } = familyDb();
  const block = (userId, jobId) => () => serverSubmitBlock(db, { ats: "practiceats", userId, jobId });   // a local page is "generic"; the family under test

  // 1 · the server's run: refused as spam → held flagged_spam, pressed once; the family is marked
  const first = await autoApply(`${base}/server/apply`, PROFILE_PAYLOAD, { mode: "full", jobId: "p::1", resumePath: tmpPdf, submitBlocker: block(1, "p::1"), onChallenge: async () => null });
  assert.equal(first.reasonCode, "flagged_spam", JSON.stringify({ s: first.status, r: first.reasonCode }));
  quiet(() => recordSubmitOutcome(db, { ats: "practiceats", result: first, log: log(1, "p::1"), runJobId: 1, jobId: "p::1" }));
  assert.equal(familyPause(db, "practiceats"), "marked");
  assert.equal(posts.server, 1);
  // 2 · the next run for that family (another job) is filled and never clicked on the server
  const second = await autoApply(`${base}/server/apply`, PROFILE_PAYLOAD, { mode: "full", jobId: "p::2", resumePath: tmpPdf, submitBlocker: block(1, "p::2") });
  assert.equal(second.reasonCode, "server_submit_paused");
  quiet(() => recordSubmitOutcome(db, { ats: "practiceats", result: second, log: log(1, "p::2"), runJobId: 2, jobId: "p::2" }));
  assert.equal(posts.server, 1, "the server never pressed Submit again");

  // 3 · the person's browser: the panel (the dock, as the service worker draws it) on the filled form; Ready; ONE press
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(`${base}/own/apply`);
  await page.type("#n", "Ada Lovelace"); await page.type("#e", "ada@example.com");   // the extension's fill, as it left the form
  const rows = panelRowsForStep({ stepName: "", fields: [{ index: 0, type: "text", label: "Full name", id: "n", required: true, visible: true, hasValue: true },
    { index: 1, type: "email", label: "Email", id: "e", required: true, visible: true, hasValue: true }],
    plan: [{ index: 0, id: "n", label: "Full name", value: "Ada Lovelace", provenance: "field_map_exact", matchedBy: "label_exact" },
      { index: 1, id: "e", label: "Email", value: "ada@example.com", provenance: "field_map_exact", matchedBy: "label_exact" }],
    filled: [{ field: "Full name", index: 0 }, { field: "Email", index: 1 }] });
  await page.addScriptTag({ content: fs.readFileSync("extension/dock.js", "utf8") });
  // the service worker's side, in the page for the test: GATE_SEND runs sendWithPress against this tab (one frame)
  // the reply lives in Node, as the service worker outlives the page: the press navigates the tab to the employer's answer
  let resolveReply; const replied = new Promise(r => { resolveReply = r; });
  await page.exposeFunction("__gateSend", async () => {
    let recorded = 0;
    const r = await sendWithPress({ tabId: 1, stepMs: 300, waitMs: 9000,
      executeScript: async ({ func, args }) => page.evaluate(`(${func.toString()})(${JSON.stringify(args[0])})`).catch(() => null),
      recordSubmitted: async () => { recorded++; return { ok: true, message: "Recorded — it's in your Submitted applications." }; } });
    resolveReply({ ...r, recordedCalls: recorded });
    return { ...r, recordedCalls: recorded };
  });
  const install = `window.__sent = []; window.chrome = { runtime: { lastError: null, sendMessage(m, cb) { window.__sent.push(m);
      if (m.type === 'GATE_SEND') window.__gateSend().then(r => { window.__sendReply = r; cb && cb(r); }); else cb && cb(null); } } };
    (${renderOverlay.toString()})(${JSON.stringify({ rows })}, ${JSON.stringify({ runId: "a207", extensionSubmit: true, theme: { light: C_LIGHT, dark: C_DARK } })})`;
  await page.evaluate(install);
  const sendBtn = "#rm-gate-review-overlay >>> [data-role='send']";
  assert.ok(await page.$(sendBtn), "Submit application is offered on an extension-submit hand-off");
  assert.equal(await page.$eval(sendBtn, b => b.disabled), false, "enabled: the panel reads Ready");
  // ⛔ a page script's click is untrusted — nothing is sent
  await page.evaluate(() => document.getElementById("rm-gate-review-overlay").shadowRoot.querySelector('[data-role="send"]').click());
  await new Promise(r => setTimeout(r, 300));
  assert.equal(await page.evaluate(() => window.__sent.filter(m => m.type === "GATE_SEND").length), 0, "an untrusted click sends nothing");
  assert.equal(posts.own, 0);
  // the person's press (a real input event)
  await page.click(sendBtn);
  const reply = await Promise.race([replied, new Promise((_, no) => setTimeout(() => no(new Error("no reply in 25 s")), 25000))]);
  assert.equal(reply.outcome, "sent", JSON.stringify(reply));
  assert.equal(reply.recordedCalls, 1, "Sent recorded once, from the confirmation page");
  assert.equal(posts.own, 1, "ONE press, one submit, from the person's own browser");
  assert.equal(posts.server, 1);

  // 4 · Admin: 1 of 1 server submits rejected; 2 of 2 applications on extension-submit sites; the mark and its run
  const share = submitShare(db).d30;
  const fam = share.families.find(f => f.ats === "practiceats");
  assert.deepEqual([fam.rejected, fam.tried, fam.extension, fam.all], [1, 1, 2, 2]);
  assert.equal(fam.mark.runJobId, 1);
  assert.equal(fam.pausedBy, "marked");

  // the plain hand-off (an ATS that does not flag) offers no Submit application — the person presses the form's own
  const p2 = await browser.newPage();
  await p2.goto(`${base}/own/apply`);
  await p2.addScriptTag({ content: fs.readFileSync("extension/dock.js", "utf8") });
  await p2.evaluate(install.replace('"extensionSubmit":true', '"extensionSubmit":false'));
  assert.equal(await p2.$("#rm-gate-review-overlay >>> [data-role='send']"), null);
});

test("A207 (real Chrome): the press picks the form's Submit over 'Save for later', and reads a refusal in the person's browser as flagged", { skip: SKIP, timeout: 60000 }, async (t) => {
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(`<form onsubmit="event.preventDefault(); window.__which='submit'; document.body.innerHTML='<p>Your application submission was flagged as possible spam.</p>'">
    <button type="button" onclick="window.__which='later'">Save for later</button><button type="submit">Submit Application</button></form>`);
  const run = (func) => page.evaluate(`(${func.toString()})(${JSON.stringify(SUBMIT_LABEL_RULE)})`);
  const pressed = await run(pressSubmitInPage);
  assert.equal(pressed.clicked, true);
  assert.equal(pressed.label, "Submit Application");
  assert.equal(await page.evaluate(() => window.__which), "submit");
  const after = await run(readResultInPage);
  assert.equal(classifyAfterPress({ before: { url: pressed.url }, after }), "flagged");
});
