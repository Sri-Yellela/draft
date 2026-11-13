// ⭐ A187 S1–S3 + A187-1 (46k, owner 11-12: "we are already getting flagged this is after i solved the captcha from the
// streamed site"). Ashby flagged a submit from draft's server browser as possible spam. The submit moves to the person's
// own browser (the extension hand-off fills it; the person presses Submit); server-side submits stop where an ATS flags
// them. ⛔ No proxies, no stealth browsers, no fingerprint spoofing — a87NoProxyOrEvasionDeps guards it.
// Synthetic person (Ada), local pages only; nothing leaves this machine.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import Database from "better-sqlite3";
import {
  isSpamFlagText, serverSubmitBlock, familyPause, recordSubmitOutcome, submitOutcomeOf, submitOutcomeCounts,
  FLAG_THRESHOLD, ALWAYS_PAUSED,
} from "../services/submitFamilies.js";
import { autoApply, submitBlockedReason, BLOCKED_DETAIL } from "../services/applyAutomation.js";
import { shouldBuildPacket, RESUMABLE_HELD_REASONS } from "../services/applyGatePacket.js";
import { submitRetryVerdict, RETRYABLE_SUBMIT_FAILURES } from "../services/submitRetry.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ASHBY_REFUSAL = "We couldn't submit your application. Your application submission was flagged as possible spam. Turn off your VPN or proxy · Pause browser extensions · Try another browser or device · Switch networks";

function logsDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER, user_id INTEGER NOT NULL,
    job_id TEXT, level TEXT NOT NULL DEFAULT 'info', event TEXT NOT NULL, message TEXT, details_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);`);
  const log = (userId, jobId, at = null) => (e, m, d) => db.prepare(`INSERT INTO apply_job_logs (user_id, job_id, event, message, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, unixepoch()))`).run(userId, String(jobId), e, m, JSON.stringify(d), at);
  return { db, log };
}

test("a187AshbyServerSubmitPaused: Ashby's server-side submit is paused; the blocker is told the ATS; the run is held for the person's browser", async () => {
  const { db } = logsDb();
  assert.ok(ALWAYS_PAUSED.has("ashby"));
  assert.equal(serverSubmitBlock(db, { ats: "ashby" }), "server_submit_paused");
  assert.equal(serverSubmitBlock(db, { ats: "Ashby" }), "server_submit_paused", "case does not matter");
  assert.equal(serverSubmitBlock(db, { ats: "greenhouse" }), null, "a family with no flags still submits");
  let seen = "unset";
  assert.equal(await submitBlockedReason((p) => { seen = p; return null; }, "ashby"), null);
  assert.equal(seen, "ashby", "autoApply hands the blocker the platform it detected");
  const aa = read("services/applyAutomation.js");
  assert.match(aa, /const blockedBy = await submitBlockedReason\(submitBlocker, detected\);/);
  assert.match(aa, /reasonDetail: BLOCKED_DETAIL\[blockedBy\]/);
  assert.match(BLOCKED_DETAIL.server_submit_paused, /your own browser/);
  const routes = read("routes/apply.js");
  assert.match(routes, /serverSubmitBlock\(db, \{ ats: platform \|\| detectPlatformFromUrl\(jobUrl\), userId, jobId \}\)/, "the run's blocker");
  assert.match(routes, /serverSubmitBlock\(db, \{ ats: platform \|\| \(ctx\.url \? detectPlatformFromUrl\(ctx\.url\) : null\)/, "Solve it here's blocker");
  assert.match(read("services/challengeRerun.js"), /submitBlocker: \(platform\) => submitBlocker\(platform, \{ userId, jobId, url \}\)/);
});

test("a187FlaggedNeverRetried: a spam refusal is its own state, recorded, and the job is never submitted from the server again", async () => {
  assert.ok(isSpamFlagText(ASHBY_REFUSAL));
  assert.ok(!isSpamFlagText("Thank you for applying! We'll be in touch."));
  assert.ok(!isSpamFlagText("Check your spam folder for our email"), "a mention of a spam folder is not a refusal");
  const { db, log } = logsDb();
  recordSubmitOutcome(db, { ats: "lever", result: { status: "held_review", reasonCode: "flagged_spam" }, log: log(7, "lv::1") });
  assert.equal(serverSubmitBlock(db, { ats: "lever", userId: 7, jobId: "lv::1" }), "flagged_spam", "S2: that job, never again from the server");
  assert.equal(serverSubmitBlock(db, { ats: "lever", userId: 7, jobId: "lv::2" }), "server_submit_paused", "⛔ A207 (b) changed this on purpose: the first flag marks the whole family extension submit");
  assert.equal(serverSubmitBlock(db, { ats: null, userId: 8, jobId: "lv::1" }), null, "S2 is per person: another person's run of the job is not refused by THIS flag (A207's family mark is pinned in a207ExtensionPrimarySubmit)");
  // not a browser failure, so the submit retry never takes it
  assert.ok(!RETRYABLE_SUBMIT_FAILURES.includes("flagged_spam"));
  assert.equal(submitRetryVerdict({ status: "held_review", reasonCode: "flagged_spam" }, { attempt: 1 }).retry, false);
  // the live check stops on it (never presses Submit again), and the classifier reads it first
  assert.match(read("services/liveChallenge.js"), /if \(state === "flagged_spam"\) return "flagged_spam";/);
  const aa = read("services/applyAutomation.js");
  assert.ok(aa.indexOf("if (isSpamFlagText(bodyText)) return 'flagged_spam';") < aa.indexOf("// 2. Submitted"), "read before the thank-you test");
  assert.match(aa, /\} else if \(clicked && postFlow === "flagged_spam"\) \{\n[\s\S]{0,400}submitReasonCode = "flagged_spam";/);
});

// ⛔ A207 (b) (46l) changed this on purpose: the FIRST flag marks the family "extension submit", durably (A187 paused after
// 2 flags in 24 h, and the window lapsed by itself). a207FamilyMark.test.js pins the mark; this keeps the family-wide stop.
test("a187FlagThresholdPausesFamily → A207: the first flag marks a family's server-side submit off, for every person", () => {
  const { db, log } = logsDb();
  assert.equal(familyPause(db, "workable"), null, "no flag yet");
  assert.equal(FLAG_THRESHOLD, 1);
  const warn = console.warn; const said = []; console.warn = (m) => said.push(String(m));
  try { recordSubmitOutcome(db, { ats: "workable", result: { status: "held_review", reasonCode: "flagged_spam" }, log: log(2, "w::2"), runJobId: 7, jobId: "w::2" }); }
  finally { console.warn = warn; }
  assert.equal(familyPause(db, "workable"), "marked");
  assert.equal(serverSubmitBlock(db, { ats: "workable", userId: 3, jobId: "w::9" }), "server_submit_paused", "every person's run on it");
  assert.ok(said.some(m => /\[submit-family\] MARKED workable extension submit/.test(m)), "the owner is told (the log line + Admin)");
  const c = submitOutcomeCounts(db);
  assert.deepEqual(c.paused.sort(), ["ashby", "workable"]);
  assert.equal(c.families.find(f => f.ats === "workable").flagged_spam, 1);
  assert.match(read("server.js"), /app\.get\("\/api\/admin\/submit-outcomes", requireAdmin/);
  assert.match(read("client/src/panels/AdminPanel.jsx"), /<SubmitOutcomesSection theme=\{theme\}\/>/);
  assert.match(read("scripts/migrations.js"), /id: "275_apply_job_logs_submit_outcome"/);
});

test("a187ExtensionFillsFromPayload: both holds are resumable — the packet is built and the extension fills it in the person's browser", () => {
  for (const reasonCode of ["server_submit_paused", "flagged_spam"]) {
    assert.ok(RESUMABLE_HELD_REASONS.has(reasonCode), reasonCode);
    assert.equal(shouldBuildPacket({ status: "held_review", reasonCode }), true, reasonCode);
  }
  assert.match(read("services/heldQuestions.js"), /server_submit_paused: "Filled and ready\./);
  const ob = read("client/src/lib/applyObstacles.js");
  assert.match(ob, /server_submit_paused: \{\n[^}]*Open & fill: draft fills it in your browser, one press of Submit application in the extension sends it[^}]*retryable: false/);
  assert.match(ob, /flagged_spam: \{\n[^}]*retryable: false/);
});

test("a187PersonPressesSubmit: the extension has no auto-submit path", () => {
  for (const f of ["extension/gated-handoff.js", "extension/review-overlay.js", "extension/dock.js", "extension/background.js"]) {
    const s = read(f);
    assert.doesNotMatch(s, /\.requestSubmit\(|\bform\.submit\(\)/, `${f} never submits a form`);
  }
  assert.match(read("extension/gated-handoff.js"), /Never auto-submitted\. The last action is the candidate's/);
});

test("a187SentFromConfirmationOnly: only a confirmed submit counts as sent; the person's own Yes records a hand-off", () => {
  assert.equal(submitOutcomeOf({ status: "submitted", submitVerified: true }), "sent");
  assert.equal(submitOutcomeOf({ status: "filled_not_submitted", reasonCode: "submit_unverified" }), "failed");
  assert.equal(submitOutcomeOf({ status: "held_review", reasonCode: "flagged_spam" }), "flagged_spam");
  assert.equal(submitOutcomeOf({ status: "held_review", reasonCode: "server_submit_paused" }), "paused");
  assert.equal(submitOutcomeOf({ status: "held_gate", reasonCode: "captcha_required", submitEvidence: "captcha_timeout" }), "challenge");
  assert.equal(submitOutcomeOf({ status: "held_review", reasonCode: "manual_review" }), null, "nothing at the submit step");
  assert.match(read("extension/review-overlay.js"), /if \(answer\.action !== 'yes' \|\| !answer\.trusted\) return;/);
});

test("a187QueueStepsTabByTab: the hand-off moves the same tab to the next application", () => {
  const bg = read("extension/background.js");
  assert.match(bg, /if \(msg\?\.type === 'GATE_BATCH_NEXT'\) \{/);
  assert.match(bg, /advanceBatch\(tabId\)/);
});

test("a187NoProxyOrEvasionDeps: no proxy services, stealth plugins or fingerprint spoofing", () => {
  const pkg = JSON.parse(read("package.json"));
  const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
  for (const d of deps) assert.doesNotMatch(d, /stealth|proxy-chain|puppeteer-extra|fingerprint|undetected|rotating-proxy|residential/i, d);
  for (const f of ["services/applyAutomation.js", "services/browserLauncher.js", "services/submitFamilies.js", "services/liveChallenge.js"]) {
    const s = read(f).split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");   // code, not the comments that name what is declined
    assert.doesNotMatch(s, /--proxy-server|puppeteer-extra|stealth/i, f);
  }
});

// ── real Chrome: a local form whose Submit answers with Ashby's refusal ─────────────────────────────────────────────
const FORM = `<!doctype html><html><body>
<form id="f" method="post" action="/submit"><label for="n">Full name</label><input id="n" name="name" required>
<label for="e">Email</label><input id="e" name="email" type="email" required>
<button type="submit">Submit Application</button></form></body></html>`;
const REFUSAL = `<!doctype html><html><body><h2>We couldn't submit your application</h2><p>Your application submission was flagged as possible spam.</p><p>Thank you for your interest.</p></body></html>`;
const PROFILE_PAYLOAD = { field_map: { first_name: "Ada", last_name: "Lovelace", full_name: "Ada Lovelace", email: "ada@example.com" }, handler_map: {}, custom_answers: {} };
const MIN_PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

test("a187 real Chrome: a refusal after Submit is held as flagged_spam (not sent, not pressed again); a paused family is never clicked", { timeout: 180000 }, async () => {
  let posts = 0;
  const s = http.createServer((req, res) => {
    if (req.method === "POST") { posts++; req.resume(); res.writeHead(200, { "content-type": "text/html" }); return res.end(REFUSAL); }
    res.writeHead(200, { "content-type": "text/html" }); res.end(FORM);
  });
  await new Promise(r => s.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${s.address().port}/apply`;
  const tmpPdf = `${process.env.TEMP || "/tmp"}/a187.pdf`;
  fs.writeFileSync(tmpPdf, MIN_PDF);
  try {
    const flagged = await autoApply(url, PROFILE_PAYLOAD, { mode: "full", jobId: "ab::1", resumePath: tmpPdf, submitBlocker: () => null, onChallenge: async () => null });
    assert.equal(flagged.status, "held_review", JSON.stringify({ s: flagged.status, r: flagged.reasonCode, e: flagged.submitEvidence }));
    assert.equal(flagged.reasonCode, "flagged_spam");
    assert.equal(flagged.submitVerified, false);
    assert.match(flagged.reasonDetail, /possible spam/);
    assert.equal(posts, 1, "pressed once — never again");
    const paused = await autoApply(url, PROFILE_PAYLOAD, { mode: "full", jobId: "ab::2", resumePath: tmpPdf,
      submitBlocker: (p) => (p ? "server_submit_paused" : "server_submit_paused") });
    assert.equal(paused.status, "held_review");
    assert.equal(paused.reasonCode, "server_submit_paused");
    assert.ok(paused.fieldsFilled >= 2, "filled — the payload is ready for the person's browser");
    assert.equal(posts, 1, "a paused family is never clicked");
  } finally { s.close(); }
});
