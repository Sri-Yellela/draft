/**
 * ⭐ D55 decision E — "Report this form": a user-invoked report that an application form is not
 * recognised, sent from the extension. docs/AUTOFILL_TARGET.md §8.3, §8.4 E, §8.6.
 *
 * ⛔ WHAT A REPORT IS — AND THIS IS THE ALLOWLIST, ENFORCED HERE, NOT PROMISED BY THE EXTENSION:
 *
 *   host              the form page's HOSTNAME only — "acme.wd5.myworkdayjobs.com". Never a path, a
 *                     query string or a fragment: those carry requisition ids, session tokens and, on
 *                     some portals, the candidate's own email. A value with a scheme, slash, colon,
 *                     "?", "#", "@" or space is REFUSED, not trimmed.
 *   labels[]          the form's field LABELS — the questions it asks ("First name", "Are you
 *                     authorised to work in the US?"). Strings only, ≤ 200 of them, each capped. ⛔
 *                     NEVER A VALUE: the extension's collector reads label text with every control
 *                     removed from it first (extension/formReport.js collectFormLabels), and this side
 *                     re-checks anyway — a label is scrubbed of anything shaped like an email, a phone
 *                     number or a long digit run, because a portal can echo what was typed into a
 *                     label ("Email: jane@…").
 *   fieldCount        how many controls the form has — an integer
 *   extensionVersion  the extension's own version, "1.4.1" — or null
 *
 * Any other key is REFUSED (400 report_field_refused, nothing stored, the KEY logged and never its
 * value) — the docs/BUG_REPORTING.md §3.1 rule: a field nobody has considered is refused rather than
 * stored. So a `values`, `answers`, `url` or `path` key cannot be sent by mistake and kept.
 *
 * Stamped by the server, never accepted: user_id, received_at, expires_at.
 *
 * WHY THIS IS ITS OWN TABLE AND NOT D3'S bug_reports: D3 (docs/BUG_REPORTING.md) is designed and
 * not built — its four decisions are O50. This is the narrow slice decision E needs, built to D3's
 * rules (an allowlist that refuses, server-stamped identity, a retention that really deletes, a rate
 * limit), so it can fold into bug_reports as `source: 'form'` when D3 lands.
 *
 * RETENTION: 30 days, then deleted — purgeExpiredFormReports() on every write and on the server's
 * sweep. Linked to the account (FK ON DELETE CASCADE), so deleting the account deletes them.
 */

export const FORM_REPORT_FIELDS = Object.freeze(["host", "labels", "fieldCount", "extensionVersion"]);
export const FORM_REPORT_TTL_SECONDS = 30 * 24 * 3600;
export const MAX_LABELS = 200;
export const MAX_LABEL_CHARS = 120;
export const RATE = Object.freeze({ perHour: 10, perDay: 30 });

export class FormReportError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const HOST_RE = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** A label, made safe to keep: whitespace collapsed, anything value-shaped replaced, capped. */
export function scrubLabel(raw) {
  return String(raw)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]")
    .replace(/\d{6,}/g, "[number]")
    .slice(0, MAX_LABEL_CHARS);
}

/**
 * Validate a report body. Refuses (throws FormReportError) rather than dropping: an unknown key, a
 * host that is not a bare hostname, a label that is not a string.
 * @returns {{ host: string, labels: string[], fieldCount: number, extensionVersion: string|null }}
 */
export function validateFormReport(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new FormReportError(400, "report_invalid", "A form report is an object.");
  }
  const unknown = Object.keys(body).filter((k) => !FORM_REPORT_FIELDS.includes(k));
  if (unknown.length) {
    console.warn(`[form-report] refused keys: ${unknown.join(", ")}`);      // the KEY, never its value
    throw new FormReportError(400, "report_field_refused", `A form report carries only ${FORM_REPORT_FIELDS.join(", ")}.`);
  }
  const host = typeof body.host === "string" ? body.host.trim().toLowerCase() : "";
  if (!HOST_RE.test(host)) {
    throw new FormReportError(400, "report_host_refused", "A form report carries the site's host name only — no address path or query.");
  }
  if (!Array.isArray(body.labels)) throw new FormReportError(400, "report_invalid", "labels must be a list.");
  if (body.labels.length > MAX_LABELS) throw new FormReportError(400, "report_invalid", `At most ${MAX_LABELS} labels.`);
  if (body.labels.some((l) => typeof l !== "string")) {
    throw new FormReportError(400, "report_field_refused", "Each label is a string — a form report carries no values.");
  }
  const labels = body.labels.map(scrubLabel).filter(Boolean);
  const fieldCount = Number.isInteger(body.fieldCount) && body.fieldCount >= 0 && body.fieldCount <= 5000
    ? body.fieldCount : labels.length;
  const extensionVersion = typeof body.extensionVersion === "string" && /^\d{1,4}(\.\d{1,4}){1,3}$/.test(body.extensionVersion)
    ? body.extensionVersion : null;
  return { host, labels, fieldCount, extensionVersion };
}

export function purgeExpiredFormReports(db, now = Math.floor(Date.now() / 1000)) {
  return db.prepare("DELETE FROM form_reports WHERE expires_at <= ?").run(now).changes;
}

/** Store one report for userId. Throws FormReportError for a refused body or the rate limit. */
export function recordFormReport(db, userId, body, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!userId) throw new FormReportError(401, "unauthorized", "Sign in to report a form.");
  const report = validateFormReport(body);
  const count = (since) => db.prepare("SELECT COUNT(*) n FROM form_reports WHERE user_id = ? AND received_at > ?")
    .get(userId, since).n;
  if (count(now - 3600) >= RATE.perHour || count(now - 86400) >= RATE.perDay) {
    throw new FormReportError(429, "report_rate", "You have sent a lot of form reports — try again later.");
  }
  purgeExpiredFormReports(db, now);
  const r = db.prepare(`
    INSERT INTO form_reports (user_id, host, labels_json, field_count, extension_version, received_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, report.host, JSON.stringify(report.labels), report.fieldCount, report.extensionVersion,
    now, now + FORM_REPORT_TTL_SECONDS);
  return { id: Number(r.lastInsertRowid), host: report.host, labelCount: report.labels.length };
}

/** POST /api/form-reports — mounted with requireAuth in server.js. */
export function formReportHandler(db) {
  return (req, res) => {
    try {
      const out = recordFormReport(db, req.user?.id, req.body);
      res.status(202).json({ ok: true, ref: `form-${out.id}`, host: out.host, labelCount: out.labelCount });
    } catch (e) {
      if (e instanceof FormReportError) return res.status(e.status).json({ error: e.code, message: e.message });
      console.error("[POST /api/form-reports]", e.message);
      res.status(500).json({ error: "report_failed", message: "Could not record the report." });
    }
  };
}
