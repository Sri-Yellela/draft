// services/notices.js — ⭐ D73 §B 5 · ADMIN → SEND A NOTICE: policy, terms and service notices.
//
// Service messages — no opt-in needed, and each says why the user is receiving it. ⛔ The brake the 1,288-row
// deletion lacked: a DRY RUN that counts first and sends nothing · a HARD CEILING that refuses past it unless
// the caller raises it explicitly to at least the count · TEST-TO-ME · provider pacing (Resend's default
// limit is 2 requests a second) · a LOG of who, when, which audience and how many — never the content.
import { sendEmail } from "./emailService.js";
import { renderDispatch } from "./dispatchHtml.js";
import { isSuppressed } from "./emailSuppression.js";
import { toActor } from "./actor.js";

export const NOTICE_DEFAULT_CEILING = 100;
export const NOTICE_MAX_CEILING = 5000;
export const NOTICE_PACE_MS = 550;
export const AUDIENCES = Object.freeze({
  all: "every account with an email address",
  active_30d: "accounts that opened the board in the last 30 days",
});

const norm = (e) => String(e ?? "").trim().toLowerCase();

/** The recipients, one per address; suppressed addresses are counted, never returned. */
export function noticeAudience(db, audience, { now = Math.floor(Date.now() / 1000) } = {}) {
  if (!AUDIENCES[audience]) throw Object.assign(new Error(`audience must be one of ${Object.keys(AUDIENCES).join(", ")}`), { status: 400 });
  const rows = db.prepare(`SELECT u.id, p.email, u.board_seen_at FROM users u JOIN user_profile p ON p.user_id = u.id
    WHERE TRIM(COALESCE(p.email, '')) != '' AND u.id != 0`).all();
  const seen = new Set(), recipients = [];
  let suppressed = 0;
  for (const r of rows) {
    if (audience === "active_30d" && !(r.board_seen_at && r.board_seen_at >= now - 30 * 86400)) continue;
    const e = norm(r.email);
    if (seen.has(e)) continue;
    seen.add(e);
    if (isSuppressed(db, e)) { suppressed++; continue; }
    recipients.push({ userId: r.id, email: e });
  }
  return { recipients, suppressed };
}

export function noticeDryRun(db, { audience }) {
  const { recipients, suppressed } = noticeAudience(db, audience);
  return { audience, description: AUDIENCES[audience], recipients: recipients.length, suppressed, ceiling: NOTICE_DEFAULT_CEILING,
    overCeiling: recipients.length > NOTICE_DEFAULT_CEILING };
}

export const noticeFooter = (why) =>
  `\n\n—\nYou are receiving this service notice because you have a draft account${why ? `: ${why}` : ""}. It is not marketing, and it goes to every account it concerns. Questions: reply to this email.`;

/**
 * @param {{ audience, subject, body, why, testTo?, ceiling?, adminUserId, env?, fetchImpl?, sleep? }} a
 *   testTo — the admin's own address: the message goes there alone, and the log marks it a test.
 */
export async function sendNotice(db, { audience, subject, body, why, testTo = null, ceiling = null, adminUserId = null,
                                       env = process.env, fetchImpl, sleep = (ms) => new Promise(r => setTimeout(r, ms)) }) {
  const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
  if (!String(subject ?? "").trim() || !String(body ?? "").trim()) fail(400, "A notice needs a subject and a body.");
  if (!String(why ?? "").trim()) fail(400, "Say why the user is receiving it — it is printed in the notice.");
  const text = String(body).trim() + noticeFooter(String(why).trim());
  // ⭐ D197 #18 M5 (47m): the HTML part — a NOTICE dispatch: the admin's body as written (escaped, line breaks kept) and the
  // footer sentence verbatim; the text part above is unchanged.
  const html = renderDispatch({ kind: "NOTICE", title: String(subject).trim(), paragraphs: [{ lines: String(body).trim() }],
    smallPrint: [noticeFooter(String(why).trim()).replace(/^\s*—\s*/, "")] });
  const send = (to) => sendEmail({ to, subject: String(subject).trim(), text, html, db, env, ...(fetchImpl ? { fetchImpl } : {}) });
  const log = (counts) => db.prepare("INSERT INTO notice_log (admin_user_id, actor, audience, recipients, sent, skipped, failed, test) VALUES (?,?,?,?,?,?,?,?)")
    .run(toActor(adminUserId).userId, toActor(adminUserId).ref, audience, counts.recipients, counts.sent, counts.skipped, counts.failed, counts.test ? 1 : 0);

  if (testTo) {
    const r = await send(testTo);
    const counts = { recipients: 1, sent: r.ok ? 1 : 0, skipped: r.ok ? 0 : 1, failed: 0, test: true };
    log(counts);
    return { ...counts, reason: r.ok ? null : r.reason };
  }
  const { recipients, suppressed } = noticeAudience(db, audience);
  const limit = ceiling == null ? NOTICE_DEFAULT_CEILING : Number(ceiling);
  if (!Number.isInteger(limit) || limit < 1 || limit > NOTICE_MAX_CEILING) fail(400, `The ceiling must be a whole number from 1 to ${NOTICE_MAX_CEILING}.`);
  if (recipients.length > limit) fail(409, `${recipients.length} recipients is above the ceiling of ${limit}. Nothing was sent. Raise the ceiling to at least ${recipients.length} to send.`);
  const counts = { recipients: recipients.length, sent: 0, skipped: suppressed, failed: 0, test: false };
  for (let i = 0; i < recipients.length; i++) {
    try { const r = await send(recipients[i].email); if (r.ok) counts.sent++; else counts.skipped++; }
    catch { counts.failed++; }
    if (i < recipients.length - 1) await sleep(NOTICE_PACE_MS);
  }
  log(counts);
  return counts;
}
