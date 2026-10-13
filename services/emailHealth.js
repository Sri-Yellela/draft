// services/emailHealth.js — ⭐ D94 · EMAIL HEALTH: hear from Resend when sending breaks, not from a user.
//
// D73 §B's webhook acted on two events (a Permanent bounce, a complaint → email_suppressions). D94 adds three, so a
// broken sending path is VISIBLE (payload shapes read from Resend's docs 10-12, P0 — docs/webhooks/emails/failed,
// …/emails/suppressed, …/domains/updated):
//   email.failed      data.failed.reason (e.g. "reached_daily_quota") — a send errored. An ADMIN alert while any
//                     failed in the last 24 h; LOUDER (critical) when 3 fell inside one hour — a silent failure here
//                     means password resets stop arriving.
//   email.suppressed  data.suppressed.{type, message}, data.to — Resend itself blocked a send; the address is mirrored
//                     into email_suppressions (reason provider_suppressed) so draft stops trying too.
//   domain.updated    data.{id, name, status, records[]} — status is verified | partially_verified | partially_failed |
//                     failed | pending | not_started. Sending is OK when the domain is verified, or when every SPF and
//                     DKIM record is (a receiving-only shortfall does not stop mail going out). Not OK → an alert;
//                     OK again → it clears.
// ⛔ NEVER handled: email.opened / email.clicked (tracking — the policy says there is none), email.received
// (Cloudflare handles inbound), contact.* (consent lives in draft's own database). A type not listed is answered
// 200 by the route and CHANGES NOTHING — not even the event log.
// ⛔ MINIMAL PERSONAL DATA: email_events keeps the type, the time, Resend's email_id and the provider's reason —
// never the recipient. The suppression list already holds the addresses it must.
// ⭐ IDEMPOTENT: the event is keyed by its Svix id, so a retried delivery is recorded — and acted on — once.
import { recordEmailEvent } from "./emailSuppression.js";
import { auditActorColumns } from "./actor.js";

export const HANDLED_EVENT_TYPES = Object.freeze(["email.bounced", "email.complained", "email.failed", "email.suppressed", "domain.updated"]);
export const RETENTION_DAYS = 90;
export const FAILED_WINDOW_SECONDS = 24 * 3600;     // a failure is shown on Today for a day
export const FAILED_BURST = { count: 3, seconds: 3600 }; // three inside an hour is the loud alert
export const TEST_ADDRESSES = Object.freeze({ bounce: "bounced@resend.dev", complaint: "complained@resend.dev" });

const norm = (email) => String(email ?? "").trim().toLowerCase();
const nowS = () => Math.floor(Date.now() / 1000);

/** The one detail kept per event — never an address. */
function detailFor(event) {
  const d = event?.data || {};
  switch (event?.type) {
    case "email.failed": return String(d.failed?.reason ?? "unknown").slice(0, 200);
    case "email.suppressed": return String(d.suppressed?.type ?? "unknown").slice(0, 200);
    case "email.bounced": return String(d.bounce?.type ?? "Permanent").slice(0, 200);
    case "domain.updated": return String(d.status ?? "unknown").slice(0, 60);
    default: return null;
  }
}

/** Sending works when the domain is verified, or when every SPF and DKIM record is. */
export function domainSendingOk(data = {}) {
  if (data.status === "verified") return true;
  const send = (Array.isArray(data.records) ? data.records : []).filter((r) => /^(SPF|DKIM)$/i.test(String(r?.record || "")));
  return send.length > 0 && send.every((r) => r?.status === "verified");
}

/**
 * Record one VERIFIED event. Returns { recorded, duplicate, suppressed: [addresses], ignored }.
 * @param {string} svixId  the svix-id header — the idempotency key
 */
export function handleEmailEvent(db, event, { svixId, now = nowS() } = {}) {
  const type = event?.type;
  if (!HANDLED_EVENT_TYPES.includes(type)) return { recorded: false, duplicate: false, suppressed: [], ignored: true };
  const id = String(svixId || "").slice(0, 120) || `${type}:${event?.data?.email_id || event?.data?.id || ""}:${event?.created_at || now}`;
  const run = db.transaction(() => {
    const ins = db.prepare("INSERT OR IGNORE INTO email_events (svix_id, type, received_at, email_id, detail) VALUES (?, ?, ?, ?, ?)")
      .run(id, type, now, event?.data?.email_id ? String(event.data.email_id).slice(0, 120) : null, detailFor(event));
    if (!ins.changes) return { recorded: false, duplicate: true, suppressed: [], ignored: false };
    let suppressed = [];
    if (type === "email.bounced" || type === "email.complained") suppressed = recordEmailEvent(db, event);
    else if (type === "email.suppressed") {
      const to = Array.isArray(event?.data?.to) ? event.data.to : event?.data?.to ? [event.data.to] : [];
      const add = db.prepare("INSERT OR IGNORE INTO email_suppressions (email, reason, event_id) VALUES (?, 'provider_suppressed', ?)");
      for (const a of to) { const e = norm(a); if (e && add.run(e, event?.data?.email_id ?? null).changes) suppressed.push(e); }
    } else if (type === "domain.updated") {
      const d = event?.data || {};
      db.prepare(`INSERT INTO email_domain_status (domain_id, name, status, sending_ok, updated_at) VALUES (?, ?, ?, ?, ?)
                  ON CONFLICT(domain_id) DO UPDATE SET name = excluded.name, status = excluded.status,
                    sending_ok = excluded.sending_ok, updated_at = excluded.updated_at`)
        .run(String(d.id || d.name || "domain"), d.name ? String(d.name) : null, String(d.status || "unknown"), domainSendingOk(d) ? 1 : 0, now);
    }
    return { recorded: true, duplicate: false, suppressed, ignored: false };
  });
  return run();
}

/** The largest number of failures inside any one window of `seconds`, from ascending timestamps. */
function maxInWindow(times, seconds) {
  let best = 0;
  for (let i = 0, j = 0; j < times.length; j++) { while (times[j] - times[i] >= seconds) i++; best = Math.max(best, j - i + 1); }
  return best;
}

/** The alerts Admin → Today shows (pushed into pipeline health): { severity, kind, subject, detail }[]. */
export function emailHealthAlerts(db, { now = nowS() } = {}) {
  const out = [];
  try {
    const rows = db.prepare("SELECT received_at, detail FROM email_events WHERE type = 'email.failed' AND received_at >= ? ORDER BY received_at")
      .all(now - FAILED_WINDOW_SECONDS);
    if (rows.length) {
      const burst = maxInWindow(rows.map((r) => r.received_at), FAILED_BURST.seconds);
      const last = rows.at(-1);
      const loud = burst >= FAILED_BURST.count;
      out.push({ severity: loud ? "critical" : "warn", kind: "email", subject: "sending",
        detail: `${rows.length} email send(s) failed in the last 24 h${loud ? ` — ${burst} inside one hour` : ""}; the last: ${last.detail}. Password resets may not be arriving.` });
    }
  } catch { /* the table is missing on a database before 158 — no alert, the panel says unavailable */ }
  try {
    for (const d of db.prepare("SELECT name, status FROM email_domain_status WHERE sending_ok = 0").all()) {
      out.push({ severity: "critical", kind: "email", subject: "domain", detail: `${d.name || "the sending domain"} is ${d.status} at Resend — mail from it may stop.` });
    }
  } catch { /* as above */ }
  return out;
}

/** The panel's numbers, all measured now. */
export function emailHealthSummary(db, { env = process.env, now = nowS() } = {}) {
  const one = (sql, ...a) => { try { return db.prepare(sql).get(...a); } catch { return null; } };
  const week = now - 7 * 86400;
  const last = one("SELECT type, received_at FROM email_events ORDER BY received_at DESC LIMIT 1");
  return {
    measuredAt: now,
    secretSet: !!env.RESEND_WEBHOOK_SECRET,
    sendingConfigured: !!env.RESEND_API_KEY,
    lastEvent: last ? { type: last.type, at: last.received_at } : null,
    failedLast7Days: one("SELECT COUNT(*) AS n FROM email_events WHERE type = 'email.failed' AND received_at >= ?", week)?.n ?? 0,
    suppressed: { total: one("SELECT COUNT(*) AS n FROM email_suppressions")?.n ?? 0,
                  newThisWeek: one("SELECT COUNT(*) AS n FROM email_suppressions WHERE created_at >= ?", week)?.n ?? 0 },
    domains: (() => { try { return db.prepare("SELECT name, status, sending_ok AS sendingOk, updated_at AS updatedAt FROM email_domain_status ORDER BY name").all(); } catch { return []; } })(),
    alerts: emailHealthAlerts(db, { now }),
  };
}

/** The suppression list, newest first, optionally filtered by a substring of the address. */
export function listSuppressions(db, { q = "", limit = 200 } = {}) {
  const like = `%${String(q).trim().toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return db.prepare("SELECT email, reason, created_at AS createdAt FROM email_suppressions WHERE email LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?")
    .all(like, Math.min(500, Math.max(1, limit)));
}

export class EmailHealthError extends Error { constructor(status, message) { super(message); this.status = status; } }

/** Remove an address from the list — a typed reason, an audit row, an undo. Never silent. */
export function removeSuppression(db, { email, reason, adminUserId }) {
  const e = norm(email), why = String(reason ?? "").trim();
  if (why.length < 3) throw new EmailHealthError(400, "Say why the address may be sent to again (a reason is required).");
  return db.transaction(() => {
    const row = db.prepare("SELECT email, reason, event_id, created_at FROM email_suppressions WHERE email = ?").get(e);
    if (!row) throw new EmailHealthError(404, "That address is not on the suppression list.");
    db.prepare("DELETE FROM email_suppressions WHERE email = ?").run(e);
    const a = auditActorColumns(adminUserId);
    const log = db.prepare(`INSERT INTO admin_audit_log (admin_user_id, actor_kind, actor, action, target, before_json, after_json, reason)
                            VALUES (?, ?, ?, 'email_suppression_remove', ?, ?, NULL, ?)`).run(a.admin_user_id, a.actor_kind, a.actor, e, JSON.stringify(row), why);
    return { removed: e, auditId: Number(log.lastInsertRowid) };
  })();
}

/** Undo a removal: the row comes back exactly as it was, and the audit row is marked undone. */
export function undoSuppressionRemoval(db, { auditId }) {
  return db.transaction(() => {
    const log = db.prepare("SELECT * FROM admin_audit_log WHERE id = ? AND action = 'email_suppression_remove'").get(auditId);
    if (!log) throw new EmailHealthError(404, "No such removal.");
    if (log.undone_at) throw new EmailHealthError(409, "That removal was already undone.");
    const row = JSON.parse(log.before_json);
    db.prepare("INSERT OR IGNORE INTO email_suppressions (email, reason, event_id, created_at) VALUES (?, ?, ?, ?)").run(row.email, row.reason, row.event_id, row.created_at);
    db.prepare("UPDATE admin_audit_log SET undone_at = unixepoch() WHERE id = ?").run(auditId);
    return { restored: row.email };
  })();
}

/** The retention sweep: email_events older than 90 days are deleted. */
export function sweepEmailEvents(db, { now = nowS(), days = RETENTION_DAYS } = {}) {
  try { return db.prepare("DELETE FROM email_events WHERE received_at < ?").run(now - days * 86400).changes; }
  catch { return 0; }
}
