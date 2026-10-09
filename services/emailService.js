import { BRAND, SENDER_FROM, SUPPORT_EMAIL } from "../shared/brand.js";
import { isSuppressed } from "./emailSuppression.js";

// ── Outbound email — one sender, honest about whether it can send ──────────────────────────────
//
// ⛔ 09-30: with no provider configured this returned { ok: true, provider: "console" } and LOGGED
// THE RESET LINK AND ITS ONE-TIME CODE — in production, where no RESEND_API_KEY is set. A user who
// asked for a reset was told an email was on its way, nothing was sent, and a live credential sat
// in the server log. Now: without a provider nothing "succeeds", and no link or code is ever logged
// in production. Development still prints links (there is no inbox to send them to), clearly marked.
export function emailConfigured(env = process.env) {
  return !!env.RESEND_API_KEY;
}

/**
 * Send one message. Returns { ok, provider } — ok:false (reason "email_unconfigured") when nothing
 * can be sent; throws only on a provider that answered with an error.
 */
//
// ⭐ D73 §B (10-09): `html`, `headers` and `replyTo` are carried; SERVICE mail (the default) stays plain text
// and replies go to support@ (noreply@ has no inbox). ⛔ A SUPPRESSED address (a hard bounce or a spam
// complaint, recorded by the Resend webhook) is never sent to — pass `db` and the check is made here, for
// every caller, transactional included.
export async function sendEmail({ to, subject, text, html = null, headers = null, replyTo = SUPPORT_EMAIL, db = null,
                                  fetchImpl = fetch, env = process.env }) {
  if (!to || !subject || !text) return { ok: false, reason: "invalid_message" };
  if (db && isSuppressed(db, to)) return { ok: false, reason: "suppressed" };
  if (env.RESEND_API_KEY) {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || env.PASSWORD_RESET_FROM || SENDER_FROM, to, subject, text,
        ...(html ? { html } : {}), ...(replyTo ? { reply_to: replyTo } : {}), ...(headers ? { headers } : {}) }),
    });
    if (!response.ok) throw new Error(`email send failed: ${response.status}`);
    return { ok: true, provider: "resend" };
  }
  if (env.NODE_ENV === "production") {
    console.warn(`[email] not sent — no email provider configured (set RESEND_API_KEY). Subject: "${subject}"`);
    return { ok: false, reason: "email_unconfigured" };
  }
  console.info(`[email:dev] (not sent — development) to=${to} subject="${subject}"\n${text}`);
  return { ok: true, provider: "console-dev" };
}

export async function sendPasswordResetEmail({ to, resetUrl, otp, expiresAt }, opts = {}) {
  if (!to || !resetUrl || !otp) return { ok: false, reason: "invalid_message" };
  const expires = new Date(expiresAt * 1000).toLocaleString();
  return sendEmail({
    to,
    subject: `Reset your ${BRAND} password`,
    text: [`Use this one-time link to reset your ${BRAND} password:`, resetUrl, "", `Code: ${otp}`, `Expires: ${expires}`,
           "", "If you didn't ask for this, ignore this email — your password stays as it is."].join("\n"),
    ...opts,
  });
}

export async function sendVerificationCodeEmail({ to, code, purpose = "confirm this email address" }, opts = {}) {
  return sendEmail({
    to,
    subject: `Your ${BRAND} code: ${code}`,
    text: [`Use this code to ${purpose}:`, "", code, "", "It expires in 15 minutes. If you didn't ask for it, ignore this email."].join("\n"),
    ...opts,
  });
}

