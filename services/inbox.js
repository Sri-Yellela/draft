// ── D103 (owner 10-30) · THE INBOX — replies to the user's applications, sorted, on their own email ────
//
// HOW MAIL ARRIVES: a FORWARDED COPY, not mailbox access. The user gets one private address `<token>@in.jobsviadraft.com`
// and adds one filter in their own mail (draft gives the steps and an importable Gmail filter, gmailFilterXml below). The
// employer only ever sees the user's real address. Revoking the address stops intake at once.
//
// ⛔ D17: categories, codes and matching are RULES — no model. ⛔ Stored: the sender, the subject, the text (HTML
// stripped, capped), never an attachment. A misfiled message is re-filed by the user in one press, and the correction is
// counted against the rule that filed it (inbox_corrections — the input to improving the rules).
import crypto from "node:crypto";
import { postingPlainText } from "../shared/postingNormalize.js";
import { RESPONSE_OUTCOME, STAGE_RANK } from "../shared/applicationResponse.js";
import { companyNameKey } from "../shared/companyIdentity.js";
import { notifyEvent } from "./notify.js";

export const INBOX_DOMAIN = "in.jobsviadraft.com";
export const BODY_CAP = 20_000;
export const CATEGORIES = Object.freeze(["applied", "verification", "interview", "assessment", "recruiter", "reminder", "offer", "rejection", "other"]);
const now = () => Math.floor(Date.now() / 1000);

// ── the address ──────────────────────────────────────────────────────────────────────────────

/** The user's live address — made on first ask. */
export function addressFor(db, userId) {
  let row = db.prepare(`SELECT * FROM inbox_addresses WHERE user_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1`).get(userId);
  if (!row) {
    const token = `d${crypto.randomBytes(9).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "")}`.slice(0, 14);
    db.prepare(`INSERT INTO inbox_addresses (user_id, token) VALUES (?, ?)`).run(userId, token);
    row = db.prepare(`SELECT * FROM inbox_addresses WHERE token = ?`).get(token);
  }
  return { id: row.id, address: `${row.token}@${INBOX_DOMAIN}`, createdAt: row.created_at };
}

/** Revoke: intake stops at once. A new address can be made afterwards; the old one never works again. */
export function revokeAddress(db, userId) {
  return db.prepare(`UPDATE inbox_addresses SET revoked_at = unixepoch() WHERE user_id = ? AND revoked_at IS NULL`).run(userId).changes > 0;
}

// ── the rules (D17) ──────────────────────────────────────────────────────────────────────────

// The applicant-tracking systems' own sending domains (the 10-30 confirmation came from send.applicantemails.com).
const ATS_SENDERS = /(?:^|\.)(greenhouse(?:-mail)?\.io|greenhouse\.io|lever\.co|hire\.lever\.co|ashbyhq\.com|myworkday(?:jobs)?\.com|workday\.com|smartrecruiters\.com|icims\.com|jobvite\.com|workable(?:mail)?\.com|applicantemails\.com|bamboohr\.com|successfactors\.(?:com|eu)|taleo\.net|recruitee\.com|breezy\.hr|teamtailor(?:-mail)?\.com|rippling(?:-ats)?\.com|amazon\.jobs)$/i;
const ASSESS_SENDERS = /(?:^|\.)(hackerrank\.com|codesignal\.com|codility\.com|hirevue\.com|karat\.(?:com|io)|testgorilla\.com|coderbyte\.com|byteboard\.dev|qualified\.io|criteriacorp\.com)$/i;

// Ordered: the first rule that matches files the message, and its name is kept (for the correction count).
export const RULES = Object.freeze([
  { id: "code.otp", category: "verification", test: (m) => /\b(verification|security|one[- ]time|confirmation) code\b|\bverify (?:your|the) email\b|\bconfirm (?:your|the) email\b|\bactivate your account\b|\bgmail forwarding confirmation\b/i.test(`${m.subject} ${m.body.slice(0, 1500)}`) },
  { id: "offer.subject", category: "offer", test: (m) => /\b(offer letter|job offer|offer of employment|pleased to (?:extend|offer)|we(?:'d| would) like to (?:extend|offer) you)\b/i.test(`${m.subject} ${m.body.slice(0, 3000)}`) },
  { id: "rejection.phrase", category: "rejection", test: (m) => /\b(not (?:to )?(?:move|moving) forward|decided to (?:pursue|move forward with) other|will not be (?:moving|proceeding)|unfortunately,? we|regret to inform|position has been filled|not (?:been )?selected|other candidates whose)\b/i.test(`${m.subject} ${m.body.slice(0, 4000)}`) },
  { id: "assessment.sender", category: "assessment", test: (m) => ASSESS_SENDERS.test(m.fromDomain) },
  { id: "assessment.phrase", category: "assessment", test: (m) => /\b(coding (?:challenge|assessment|test)|online assessment|take[- ]home|technical assessment|skills assessment|hackerrank|codesignal|codility)\b/i.test(`${m.subject} ${m.body.slice(0, 3000)}`) },
  { id: "interview.phrase", category: "interview", test: (m) => /\b(interview|phone screen|schedule (?:a|some) time|availability for (?:a|an) (?:call|chat)|speak with you|next steps? (?:in|of) (?:the|our) process|calendly\.com|goodtime\.io)\b/i.test(`${m.subject} ${m.body.slice(0, 3000)}`) },
  { id: "applied.subject", category: "applied", test: (m) => /\b(thank(?:s| you) for (?:applying|your application|your interest)|application (?:received|submitted|confirmation)|we(?:'ve| have) received your application)\b/i.test(`${m.subject} ${m.body.slice(0, 2000)}`) },
  { id: "reminder.phrase", category: "reminder", test: (m) => /\b(reminder|complete your application|finish your application|still interested|haven'?t (?:finished|completed))\b/i.test(m.subject) },
  { id: "recruiter.phrase", category: "recruiter", test: (m) => /\b(recruiter|talent acquisition|sourcer|reaching out about|came across your profile|your background)\b/i.test(`${m.subject} ${m.body.slice(0, 2000)}`) },
  { id: "applied.ats_sender", category: "applied", test: (m) => ATS_SENDERS.test(m.fromDomain) },
]);

/** { category, rule } for one message — by rule, never by a model. */
export function categorise({ subject = "", body = "", fromDomain = "" }) {
  const m = { subject: String(subject), body: String(body), fromDomain: String(fromDomain).toLowerCase() };
  const hit = RULES.find(r => r.test(m));
  return hit ? { category: hit.category, rule: hit.id } : { category: "other", rule: null };
}

/** A verification code in a Verification message: 4–8 digits (or a 6–8 character code) near the word "code". */
export function codeOf({ subject = "", body = "" }) {
  const t = `${subject}\n${body}`;
  // Digits after the word (up to 40 characters of words between: "code is 482913"); a mixed code only right after it.
  const m = /\b(?:code|passcode|pin)\b\D{0,40}?\b(\d{4,8})\b/i.exec(t)
    || /\b(?:code|passcode)\b[\s:]{1,3}([A-Z0-9]{6,8})\b/.exec(t)
    || /\b(\d{6})\b(?=\D{0,40}\b(?:is your|verification)\b)/i.exec(t);
  return m ? m[1] : null;
}

/** HTML → text, capped. Attachments are never passed in. */
export function bodyText({ text = null, html = null }) {
  const raw = text && String(text).trim() ? String(text) : postingPlainText(String(html || ""));
  return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, BODY_CAP);
}

const domainOf = (addr) => { const m = /@([^>\s]+)>?\s*$/.exec(String(addr || "")); return m ? m[1].toLowerCase() : ""; };
const baseDomain = (d) => String(d || "").split(".").slice(-2).join(".");

// ── matching to an application (P3) ──────────────────────────────────────────────────────────

/**
 * The user's application this message is about, or null. By company — the sender's own domain (the company's, not an
 * ATS's), or the company's name in the subject / body / the ATS sender's display name — then the title, then the most
 * recent submit within 180 days. Two applications to one company and no title in the mail → the most recent.
 */
export function matchApplication(db, userId, { fromAddr = "", fromDomain = "", subject = "", body = "" }, nowSec = now()) {
  const rows = applicationCompanies(db, userId, nowSec);
  const text = `${fromAddr} ${subject} ${body.slice(0, 4000)}`.toLowerCase();
  const fromCompanyDomain = ATS_SENDERS.test(fromDomain) || ASSESS_SENDERS.test(fromDomain) ? null : baseDomain(fromDomain);
  const scored = rows.map(r => {
    const name = String(r.company || "").trim();
    const key = companyNameKey(name);
    let score = 0;
    if (fromCompanyDomain && r.domain && baseDomain(r.domain) === fromCompanyDomain) score += 3;
    if (fromCompanyDomain && key && fromCompanyDomain.split(".")[0].replace(/[^a-z0-9]/g, "") === key.replace(/[^a-z0-9]/g, "")) score += 3;
    if (name.length >= 3 && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()}\\b`).test(text)) score += 2;
    if (score && r.title && text.includes(String(r.title).toLowerCase())) score += 1;
    return { ...r, score };
  }).filter(r => r.score >= 2).sort((a, b) => b.score - a.score || b.at - a.at);
  return scored[0]?.id ?? null;
}

/**
 * The user's applications within 180 days — id, company, title, the company's domain where known. ONE reader: the
 * matching above and the Gmail connection's search query (D112 — the companies it may read mail about) use it alike.
 */
export function applicationCompanies(db, userId, nowSec = now()) {
  return db.prepare(`SELECT ar.id, ar.job_id, COALESCE(ar.submitted_at, ar.updated_at) AS at,
      COALESCE(ja.company, rj.posting_company, sj.company) AS company, COALESCE(ja.role, rj.posting_title, sj.title) AS title,
      ja.company_domain AS domain
    FROM application_records ar
    LEFT JOIN job_applications ja ON ja.user_id = ar.user_id AND ja.job_id = ar.job_id
    LEFT JOIN apply_run_jobs rj ON rj.id = (SELECT id FROM apply_run_jobs WHERE user_id = ar.user_id AND job_id = ar.job_id ORDER BY id DESC LIMIT 1)
    LEFT JOIN scraped_jobs sj ON sj.job_id = ar.job_id
    WHERE ar.user_id = ? AND ar.state != 'withdrawn' AND COALESCE(ar.submitted_at, ar.updated_at) >= ?`).all(userId, nowSec - 180 * 86400);
}

/** P3: a matched Interview or Offer moves the row on The Table (the D102 ladder reads job_applications.response_outcome). */
function advanceOutcome(db, userId, applicationId, category, at) {
  const outcome = category === "offer" ? RESPONSE_OUTCOME.OFFER : category === "interview" ? RESPONSE_OUTCOME.INTERVIEW : null;
  if (!outcome) return false;
  const rec = db.prepare(`SELECT job_id FROM application_records WHERE id = ? AND user_id = ?`).get(applicationId, userId);
  if (!rec) return false;
  const ja = db.prepare(`SELECT id, response_outcome FROM job_applications WHERE user_id = ? AND job_id = ? ORDER BY id DESC LIMIT 1`).get(userId, rec.job_id);
  if (!ja) return false;
  // Never backwards: an offer is not undone by a later interview mail, and a rejection the user recorded stays.
  if (ja.response_outcome && ((STAGE_RANK[ja.response_outcome] ?? 9) >= STAGE_RANK[outcome])) return false;
  db.prepare(`UPDATE job_applications SET response_outcome = ?, outcome_at = ?, outcome_source = 'inbox',
    first_response_at = COALESCE(first_response_at, ?) WHERE id = ?`).run(outcome, at, at, ja.id);
  return true;
}

// ── ingest (P1) ──────────────────────────────────────────────────────────────────────────────

/**
 * One inbound message. `to` may be a list; the first address on the inbox domain names the user.
 * @returns { stored: false, reason } | { stored: true, id, category, applicationId, advanced }
 */
export function ingestMessage(db, { providerId = null, to = [], from = "", subject = "", text = null, html = null, receivedAt = null }) {
  const toList = (Array.isArray(to) ? to : [to]).map(String);
  const token = toList.map(a => new RegExp(`([a-z0-9]{6,20})@${INBOX_DOMAIN.replace(/\./g, "\\.")}`, "i").exec(a)?.[1]?.toLowerCase()).find(Boolean);
  if (!token) return { stored: false, reason: "not_our_address" };
  const addr = db.prepare(`SELECT * FROM inbox_addresses WHERE token = ?`).get(token);
  if (!addr) return { stored: false, reason: "unknown_address" };
  if (addr.revoked_at) return { stored: false, reason: "address_revoked" };
  return ingestForUser(db, { userId: addr.user_id, addressId: addr.id, source: "forward", providerId, from, subject, text, html, receivedAt });
}

/**
 * ⭐ THE ONE PATH every message takes once its owner is known — a forwarded copy (ingestMessage, above) and a message
 * read through a Gmail connection (D112, services/gmail.js) alike: text only (HTML stripped), capped at BODY_CAP, never
 * an attachment (none is ever passed in), filed by the same RULES, matched to the same applications, a Verification's
 * code read the same way (so D103 P5's opted-portal read works on either). `source` records which door it came by.
 */
export function ingestForUser(db, { userId, addressId = null, source = "forward", providerId = null, from = "", subject = "", text = null, html = null, receivedAt = null }) {
  const body = bodyText({ text, html });
  const fromDomain = domainOf(from);
  const { category, rule } = categorise({ subject, body, fromDomain });
  const at = Number.isInteger(receivedAt) ? receivedAt : now();
  const applicationId = matchApplication(db, userId, { fromAddr: from, fromDomain, subject, body }, at);
  const ins = db.prepare(`INSERT OR IGNORE INTO inbox_messages (user_id, address_id, provider_id, from_addr, from_domain, subject, body_text,
      received_at, category, category_source, rule, code, application_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'rule', ?, ?, ?, ?)`)
    .run(userId, addressId, providerId, String(from).slice(0, 300), fromDomain, String(subject).slice(0, 500), body, at, category, rule,
      category === "verification" ? codeOf({ subject, body }) : null, applicationId, source === "gmail" ? "gmail" : "forward");
  if (!ins.changes) return { stored: false, reason: "duplicate" };
  const advanced = applicationId ? advanceOutcome(db, userId, applicationId, category, at) : false;
  // ⭐ D112 item 8: an Interview / Offer that moved the row is the person's to hear about — in-app, and push / email by their
  // choice (services/notify.js; a no-op until server.js configures it). The text names the category, never the company.
  if (advanced) void notifyEvent(userId, "inbox_reply", { category });
  return { stored: true, id: Number(ins.lastInsertRowid), category, applicationId, advanced };
}

// ── the user's reads and writes (P4) ─────────────────────────────────────────────────────────

export function listMessages(db, userId, { category = null, applicationId = null, limit = 100 } = {}) {
  const where = ["user_id = ?"], args = [userId];
  if (category) { where.push("category = ?"); args.push(category); }
  if (applicationId) { where.push("application_id = ?"); args.push(Number(applicationId)); }
  return db.prepare(`SELECT id, from_addr AS "from", subject, received_at AS receivedAt, category, category_source AS categorySource,
      code, application_id AS applicationId, substr(body_text, 1, 280) AS preview, source
    FROM inbox_messages WHERE ${where.join(" AND ")} ORDER BY received_at DESC, id DESC LIMIT ?`).all(...args, Math.min(500, limit));
}

/** Re-file in one press; the correction is counted against the rule that filed it. */
export function refile(db, userId, messageId, category) {
  if (!CATEGORIES.includes(category)) throw Object.assign(new Error(`A category is one of: ${CATEGORIES.join(", ")}.`), { status: 400, code: "bad_category" });
  const m = db.prepare(`SELECT id, category, rule, application_id FROM inbox_messages WHERE id = ? AND user_id = ?`).get(Number(messageId), userId);
  if (!m) return null;
  if (m.category === category) return { id: m.id, category };
  db.prepare(`UPDATE inbox_messages SET category = ?, category_source = 'user' WHERE id = ?`).run(category, m.id);
  db.prepare(`INSERT INTO inbox_corrections (message_id, rule, from_category, to_category) VALUES (?, ?, ?, ?)`).run(m.id, m.rule, m.category, category);
  if (m.application_id) advanceOutcome(db, userId, m.application_id, category, now());
  return { id: m.id, category };
}

/** "Attach to an application" for a message no rule could match. */
export function attach(db, userId, messageId, applicationId) {
  const app = db.prepare(`SELECT id FROM application_records WHERE id = ? AND user_id = ?`).get(Number(applicationId), userId);
  const m = db.prepare(`SELECT id, category FROM inbox_messages WHERE id = ? AND user_id = ?`).get(Number(messageId), userId);
  if (!app || !m) return null;
  db.prepare(`UPDATE inbox_messages SET application_id = ? WHERE id = ?`).run(app.id, m.id);
  advanceOutcome(db, userId, app.id, m.category, now());
  return { id: m.id, applicationId: app.id };
}

/** Each rule's correction count — what to improve first. */
export function ruleCorrections(db) {
  return db.prepare(`SELECT rule, from_category AS fromCategory, to_category AS toCategory, COUNT(*) AS n FROM inbox_corrections
    GROUP BY rule, from_category, to_category ORDER BY n DESC`).all();
}

// ── P5: the worker reads a code — only for a portal the user opted in, within 10 minutes, logged ──

export function setCodeOptIn(db, userId, portalFamily, on) {
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(String(portalFamily || ""))) throw Object.assign(new Error("bad portal"), { status: 400, code: "bad_portal" });
  if (on) db.prepare(`INSERT OR IGNORE INTO inbox_code_optins (user_id, portal_family) VALUES (?, ?)`).run(userId, portalFamily);
  else db.prepare(`DELETE FROM inbox_code_optins WHERE user_id = ? AND portal_family = ?`).run(userId, portalFamily);
  return db.prepare(`SELECT portal_family FROM inbox_code_optins WHERE user_id = ?`).pluck().all(userId);
}

/**
 * The newest code for this user from this portal's host, received after `sinceSec` and within 10 minutes of now — or
 * null. Refused (null) unless the user opted in for the portal. Every read is logged.
 */
export function codeForWorker(db, { userId, portalFamily, originHost, sinceSec, remoteRunId = null, nowSec = now() }) {
  const opted = db.prepare(`SELECT 1 FROM inbox_code_optins WHERE user_id = ? AND portal_family = ?`).get(userId, portalFamily);
  if (!opted) return { refused: "not_opted_in" };
  const host = baseDomain(originHost);
  const m = db.prepare(`SELECT id, code, from_domain FROM inbox_messages WHERE user_id = ? AND category = 'verification' AND code IS NOT NULL
      AND received_at >= ? AND received_at >= ? ORDER BY received_at DESC, id DESC`).all(userId, sinceSec, nowSec - 600)
    .find(r => baseDomain(r.from_domain) === host);
  if (!m) return { code: null };
  db.prepare(`INSERT INTO inbox_code_uses (user_id, message_id, portal_family, remote_run_id) VALUES (?, ?, ?, ?)`).run(userId, m.id, portalFamily, remoteRunId);
  return { code: m.code };
}

// ── the Gmail filter the user imports ─────────────────────────────────────────────────────────

/** An importable Gmail filter (Settings → Filters → Import): mail from the ATS senders is forwarded to the address. */
// ⭐ The applicant-tracking (and assessment) senders, by domain — ONE list: the forwarding filter below and the Gmail
// connection's search query (D112, services/gmail.js gmailQueryFor) are both built from it.
export const ATS_SENDER_DOMAINS = Object.freeze(["greenhouse.io", "greenhouse-mail.io", "lever.co", "ashbyhq.com", "myworkday.com",
  "myworkdayjobs.com", "smartrecruiters.com", "icims.com", "jobvite.com", "workablemail.com", "applicantemails.com", "bamboohr.com",
  "hackerrank.com", "codesignal.com", "amazon.jobs"]);

/** True when a sender's domain is an applicant-tracking or assessment system's (the rules' own patterns). */
export const isAtsSenderDomain = (domain) => ATS_SENDERS.test(String(domain || "")) || ASSESS_SENDERS.test(String(domain || ""));

export function gmailFilterXml(address) {
  const from = ATS_SENDER_DOMAINS;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:apps="http://schemas.google.com/apps/2006">
  <title>draft — forward application replies</title>
  <entry>
    <category term="filter"></category>
    <title>draft</title>
    <apps:property name="from" value="${esc(from.join(" OR "))}"/>
    <apps:property name="forwardTo" value="${esc(address)}"/>
  </entry>
</feed>
`;
}

// ── D103 P1 · deletion and retention ─────────────────────────────────────────────────────────

/** Delete one message (an id) or every message (null) of this user's. Returns how many. */
export function deleteMessages(db, userId, messageId = null) {
  if (messageId == null) return db.prepare(`DELETE FROM inbox_messages WHERE user_id = ?`).run(userId).changes;
  return db.prepare(`DELETE FROM inbox_messages WHERE id = ? AND user_id = ?`).run(Number(messageId), userId).changes;
}

/**
 * ⭐ D112 item 3 (owner 10-30: "we can delete the inbox mail in 6 months"): the privacy policy promises 180 days, so
 * 180 is the DEFAULT — the sweep no longer waits for the env variable to be set.
 */
export const INBOX_RETENTION_DEFAULT_DAYS = 180;

/**
 * The period the sweep uses, from `INBOX_RETENTION_DAYS` (a string, as the env carries it):
 *   unset / empty            → 180 (the policy's period)
 *   a positive whole number  → that many days (an override; ⚠ the policy says 6 months — move the text with it)
 *   "0"                      → null: the EXPLICIT "no sweep" the code has always documented (a dev box, a test)
 *   anything else (negative, fractional, "abc") → 180 — a typo fails toward the promise, never toward keeping mail forever
 */
export function inboxRetentionDays(raw) {
  if (raw == null || String(raw).trim() === "") return INBOX_RETENTION_DEFAULT_DAYS;
  const s = String(raw).trim();
  if (s === "0") return null;
  const d = Number(s);
  return Number.isInteger(d) && d > 0 ? d : INBOX_RETENTION_DEFAULT_DAYS;
}

/**
 * The retention sweep: messages received more than the period ago are deleted. `days` is the raw env value
 * (resolved by inboxRetentionDays — unset = 180, "0" = no sweep). Run at boot and daily from server.js.
 */
export function sweepInbox(db, days, nowSec = now()) {
  const d = inboxRetentionDays(days);
  if (d == null) return 0;
  return db.prepare(`DELETE FROM inbox_messages WHERE received_at < ?`).run(nowSec - d * 86400).changes;
}
