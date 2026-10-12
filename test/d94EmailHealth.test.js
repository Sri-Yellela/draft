// D94 · EMAIL HEALTH (owner, 10-11) — hear from Resend when sending breaks, not from a user. Each guard red when removed.
// No mail leaves: the test send goes to a stub. Payload shapes are Resend's documented examples (P0, 10-12).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createEmailRouters } from "../routes/email.js";
import { isSuppressed } from "../services/emailSuppression.js";
import { handleEmailEvent, emailHealthAlerts, emailHealthSummary, removeSuppression, undoSuppressionRemoval, sweepEmailEvents,
  domainSendingOk, HANDLED_EVENT_TYPES, TEST_ADDRESSES } from "../services/emailHealth.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'admin', 'h')").run();
  return d;
}
const failed = (reason = "reached_daily_quota", to = ["ada@example.com"]) => ({ type: "email.failed", created_at: "2026-10-12T00:00:00Z",
  data: { email_id: `e-${Math.random()}`, from: "draft <noreply@jobsviadraft.com>", to, subject: "Reset", failed: { reason } } });
const domain = (status, records = []) => ({ type: "domain.updated", data: { id: "dom1", name: "jobsviadraft.com", status, records } });

async function app(t, d, env, sendImpl = async () => ({ ok: true })) {
  const a = express();
  const { hooksRouter, appRouter } = createEmailRouters({ db: d, env, sendImpl, log: { warn() {} },
    requireAuth: (req, _r, n) => { req.user = { id: 1 }; n(); }, requireAdmin: (req, _r, n) => { req.user = { id: 1 }; n(); } });
  a.use(hooksRouter); a.use(express.json()); a.use(appRouter);
  const s = a.listen(0); t.after(() => s.close());
  return `http://127.0.0.1:${s.address().port}`;
}

test("⛔ D94: the hook refuses a bad or missing signature, records a retry (same svix-id) ONCE, and ignores an unknown type", async (t) => {
  const d = db();
  const secret = crypto.randomBytes(24);
  const base = await app(t, d, { RESEND_WEBHOOK_SECRET: `whsec_${secret.toString("base64")}` });
  const ts = String(Math.floor(Date.now() / 1000));
  const sign = (id, b) => `v1,${crypto.createHmac("sha256", secret).update(`${id}.${ts}.${b}`).digest("base64")}`;
  const post = (id, b, sig = sign(id, b)) => fetch(`${base}/api/hooks/resend`, { method: "POST", headers: { "content-type": "application/json",
    ...(id ? { "svix-id": id, "svix-timestamp": ts } : {}), ...(sig ? { "svix-signature": sig } : {}) }, body: b });
  const body = JSON.stringify(failed());
  assert.equal((await post("msg_1", body, "v1,AAAA")).status, 401, "a bad signature");
  assert.equal((await post(null, body, null)).status, 401, "no signature at all");
  assert.equal(d.prepare("SELECT COUNT(*) n FROM email_events").get().n, 0);
  assert.equal((await post("msg_1", body)).status, 200);
  const again = await (await post("msg_1", body)).json();
  assert.equal(again.duplicate, true);
  assert.equal(d.prepare("SELECT COUNT(*) n FROM email_events").get().n, 1, "a retried delivery is recorded once");
  // An unknown (or never-handled) type: 200, and nothing changes — not even the event log.
  for (const type of ["email.opened", "email.clicked", "email.delivered", "contact.created", "made.up"]) {
    const b = JSON.stringify({ type, data: { email_id: "x", to: ["z@example.com"] } });
    const r = await post(`msg_${type}`, b);
    assert.equal(r.status, 200, type);
    assert.equal((await r.json()).ignored, true, type);
  }
  assert.equal(d.prepare("SELECT COUNT(*) n FROM email_events").get().n, 1);
  assert.equal(d.prepare("SELECT COUNT(*) n FROM email_suppressions").get().n, 0);
  // Unconfigured: 503, as D73 left it.
  const base2 = await app(t, db(), {});
  assert.equal((await fetch(`${base2}/api/hooks/resend`, { method: "POST", body: "{}" })).status, 503);
});

test("⛔ D94: email.failed raises an alert and stores NO recipient; three inside an hour raise the LOUDER one", () => {
  const d = db();
  const now = 2_000_000_000;
  handleEmailEvent(d, failed("reached_daily_quota", ["ada@example.com"]), { svixId: "a", now: now - 7200 });
  let alerts = emailHealthAlerts(d, { now });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].severity, "warn");
  assert.match(alerts[0].detail, /1 email send\(s\) failed in the last 24 h; the last: reached_daily_quota/);
  const stored = JSON.stringify(d.prepare("SELECT * FROM email_events").all());
  assert.doesNotMatch(stored, /ada@example\.com/, "the recipient is stored");
  handleEmailEvent(d, failed(), { svixId: "b", now: now - 600 });
  assert.equal(emailHealthAlerts(d, { now })[0].severity, "warn", "two in an hour is not yet the loud alert");
  handleEmailEvent(d, failed(), { svixId: "c", now: now - 300 });
  handleEmailEvent(d, failed(), { svixId: "d", now: now - 60 });
  alerts = emailHealthAlerts(d, { now });
  assert.equal(alerts[0].severity, "critical");
  assert.match(alerts[0].detail, /3 inside one hour/);
  // A day later the failures have aged off Today.
  assert.equal(emailHealthAlerts(d, { now: now + 2 * 86400 }).length, 0);
  // The alert reaches Admin → Today through pipeline health.
  assert.match(read("routes/adminDb.js"), /for \(const a of emailHealthAlerts\(db\)\) push\(a\.severity, a\.kind, a\.subject, a\.detail\);/);
});

test("⛔ D94: domain.updated to not verified raises an alert, and back to verified clears it", () => {
  const d = db();
  handleEmailEvent(d, domain("verified"), { svixId: "d1" });
  assert.equal(emailHealthAlerts(d).length, 0);
  handleEmailEvent(d, domain("failed", [{ record: "DKIM", status: "failed" }, { record: "SPF", status: "verified" }]), { svixId: "d2" });
  const a = emailHealthAlerts(d);
  assert.equal(a.length, 1); assert.equal(a[0].severity, "critical"); assert.match(a[0].detail, /jobsviadraft\.com is failed/);
  handleEmailEvent(d, domain("verified"), { svixId: "d3" });
  assert.equal(emailHealthAlerts(d).length, 0, "verified again clears it");
  // A receiving-only shortfall does not stop mail going out.
  assert.equal(domainSendingOk({ status: "partially_verified", records: [{ record: "SPF", status: "verified" }, { record: "DKIM", status: "verified" }, { record: "Receiving MX", status: "pending" }] }), true);
  assert.equal(domainSendingOk({ status: "pending", records: [] }), false);
});

test("⛔ D94: email.suppressed adds the address (provider_suppressed); a TEMPORARY bounce still does not suppress", () => {
  const d = db();
  handleEmailEvent(d, { type: "email.suppressed", data: { email_id: "s1", to: ["Grace@Example.com"],
    suppressed: { type: "OnAccountSuppressionList", message: "…" } } }, { svixId: "s1" });
  assert.equal(isSuppressed(d, "grace@example.com"), true);
  assert.equal(d.prepare("SELECT reason FROM email_suppressions WHERE email = 'grace@example.com'").get().reason, "provider_suppressed");
  assert.equal(d.prepare("SELECT detail FROM email_events WHERE svix_id = 's1'").get().detail, "OnAccountSuppressionList");
  handleEmailEvent(d, { type: "email.bounced", data: { email_id: "b1", to: ["temp@example.com"], bounce: { type: "Transient" } } }, { svixId: "b1" });
  assert.equal(isSuppressed(d, "temp@example.com"), false);
  handleEmailEvent(d, { type: "email.bounced", data: { email_id: "b2", to: ["hard@example.com"], bounce: { type: "Permanent" } } }, { svixId: "b2" });
  assert.equal(isSuppressed(d, "hard@example.com"), true);
});

test("⛔ D94: Remove needs a reason and writes an audit row; Undo restores the row exactly", async (t) => {
  const d = db();
  d.prepare("INSERT INTO email_suppressions (email, reason, event_id, created_at) VALUES ('x@example.com', 'hard_bounce', 'e9', 1700000000)").run();
  assert.throws(() => removeSuppression(d, { email: "x@example.com", reason: " ", adminUserId: 1 }), /reason is required/);
  assert.equal(isSuppressed(d, "x@example.com"), true, "a reasonless remove changed something");
  const base = await app(t, d, {});
  const bad = await fetch(`${base}/api/admin/email-health/suppressions/remove`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@example.com" }) });
  assert.equal(bad.status, 400);
  const r = await (await fetch(`${base}/api/admin/email-health/suppressions/remove`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "x@example.com", reason: "the user fixed their mailbox" }) })).json();
  assert.equal(isSuppressed(d, "x@example.com"), false);
  const log = d.prepare("SELECT * FROM admin_audit_log WHERE id = ?").get(r.auditId);
  assert.equal(log.action, "email_suppression_remove"); assert.equal(log.target, "x@example.com");
  assert.equal(log.reason, "the user fixed their mailbox"); assert.equal(log.admin_user_id, 1);
  undoSuppressionRemoval(d, { auditId: r.auditId });
  assert.deepEqual(d.prepare("SELECT email, reason, event_id, created_at FROM email_suppressions").get(),
    { email: "x@example.com", reason: "hard_bounce", event_id: "e9", created_at: 1700000000 });
  assert.ok(d.prepare("SELECT undone_at FROM admin_audit_log WHERE id = ?").get(r.auditId).undone_at);
  assert.throws(() => undoSuppressionRemoval(d, { auditId: r.auditId }), /already undone/);
});

test("⛔ D94: the 90-day sweep deletes old events and keeps recent ones; it runs daily", () => {
  const d = db();
  const now = 2_000_000_000;
  handleEmailEvent(d, failed(), { svixId: "old", now: now - 91 * 86400 });
  handleEmailEvent(d, failed(), { svixId: "new", now: now - 89 * 86400 });
  assert.equal(sweepEmailEvents(d, { now }), 1);
  assert.deepEqual(d.prepare("SELECT svix_id FROM email_events").all().map((r) => r.svix_id), ["new"]);
  assert.match(read("server.js"), /cron\.schedule\("30 3 \* \* \*", \(\) => \{\n {2}\/\/ ⭐ D94[^\n]*\n {2}try \{ const n = sweepEmailEvents\(db\);/);
});

test("⛔ D94: the panel's numbers, and the test send proves the loop to Resend's own safe addresses", async (t) => {
  const d = db();
  handleEmailEvent(d, failed(), { svixId: "f1" });
  handleEmailEvent(d, domain("verified"), { svixId: "dv" });
  const s = emailHealthSummary(d, { env: { RESEND_WEBHOOK_SECRET: "whsec_x", RESEND_API_KEY: "re_x" } });
  assert.equal(s.secretSet, true); assert.equal(s.failedLast7Days, 1); assert.equal(s.lastEvent.type, "domain.updated");
  assert.equal(s.domains[0].status, "verified"); assert.equal(s.suppressed.total, 0);
  const sent = [];
  const base = await app(t, d, { RESEND_API_KEY: "re_x" }, async (m) => { sent.push(m); return { ok: true }; });
  const r = await (await fetch(`${base}/api/admin/email-health/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "bounce" }) })).json();
  assert.equal(sent[0].to, TEST_ADDRESSES.bounce); assert.equal(TEST_ADDRESSES.bounce, "bounced@resend.dev");
  assert.match(r.said, /appears on the suppression list/);
  await fetch(`${base}/api/admin/email-health/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "complaint" }) });
  assert.equal(sent[1].to, "complained@resend.dev");
  assert.equal(sent.some((m) => "db" in m), false, "the test send must not be stopped by the suppression list (an earlier test put the address there)");
});

test("⛔ D94: admin-only, no model call, and no opened / clicked / received / contact handler exists", () => {
  const route = read("routes/email.js");
  for (const p of ["/api/admin/email-health", "/api/admin/email-health/suppressions", "/api/admin/email-health/suppressions/remove",
                   "/api/admin/email-health/suppressions/undo", "/api/admin/email-health/test"]) {
    assert.match(route, new RegExp(`appRouter\\.(get|post)\\("${p.replace(/\//g, "\\/")}", requireAdmin,`), p);
  }
  const svc = read("services/emailHealth.js");
  assert.deepEqual([...HANDLED_EVENT_TYPES], ["email.bounced", "email.complained", "email.failed", "email.suppressed", "domain.updated"]);
  for (const t of ["email.opened", "email.clicked", "email.received"]) assert.ok(!svc.includes(`"${t}"`) || /NEVER handled/.test(svc), t);
  assert.doesNotMatch(svc + route, /anthropic|messages\.create|callModel|openai/i, "a model call");
  assert.doesNotMatch(svc.replace(/\/\/.*$/gm, ""), /case "email\.(opened|clicked|received)"|contact\./);
  // The panel: in System, built on the admin kit, a reason before Remove, an Undo.
  assert.match(read("client/src/panels/adminMap.js"), /\["email", "Email health"\]/);
  const ui = read("client/src/panels/adminEmail.jsx");
  assert.match(ui, /<Panel data-email-health="" title="Email health"/);
  assert.match(ui, /disabled=\{removing\.reason\.trim\(\)\.length < 3\}/);
  assert.match(ui, /data-email-undo=""/);
  assert.doesNotMatch(ui, /border-radius: 999|borderRadius: 999|rounded-full/, "D60: no pills");
});
