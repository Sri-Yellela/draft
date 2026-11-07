// services/sampleResumes.js — ⛔ THE SAMPLE RÉSUMÉS' SAFETY RULE (D124, kept when the trial was removed 11-07).
//
// The D124 trial offered fictional sample résumés (content/trial/sample-*.json). The trial is gone — no picker, no
// limits, every account gets the whole site — but accounts that picked a sample still have it as their active résumé.
// ⛔ A sample is a FICTIONAL person and is never submitted to a real employer: any account whose active base résumé IS
// a sample sends to draft's practice form (practiceUrlFor) instead, whatever else is true of the account. Keyed on the
// résumé, never on an account flag. An account's own résumé sends for real, through the normal flow.
// Admin → ATS calibration also pairs the samples with its gold set (services/atsCalibration.js).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Six samples by category — A software, B ML / data, C mechanical, D electrical, E business / financial analyst,
// F project / operations manager. All stay loaded so a profile made from any of them is still known as a sample.
export const SAMPLE_IDS = Object.freeze(["A", "B", "C", "D", "E", "F"]);

let _samples = null;
/** The fictional résumés (content/trial/sample-*.json). */
export function samples() {
  if (!_samples) {
    _samples = Object.fromEntries(SAMPLE_IDS.map(id => {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, "content/trial", `sample-${id.toLowerCase()}.json`), "utf8"));
      return [id, { id, label: j.label, fictional: j.fictional, candidate: j.candidate, resumeText: j.resumeText, roleFamily: j.roleFamily || null,
        category: j.category || null, seniority: j.seniority || "mid", targetTitle: j.targetTitle || null }];
    }));
  }
  return _samples;
}

const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** 'A' | 'B' when `text` is one of the samples (whitespace and case aside), else null. */
export function sampleIdForText(text) {
  const t = squash(text);
  if (!t) return null;
  for (const s of Object.values(samples())) {
    const head = squash(s.resumeText).slice(0, 400);
    if (t.startsWith(head) || t.includes(squash(s.candidate.email))) return s.id;
  }
  return null;
}

/** D123 P6e (R10): a sample's own role family, so its job profile names it and the tools service never classifies. */
export function sampleRoleFamily(text) {
  const id = sampleIdForText(text);
  return id ? samples()[id].roleFamily : null;
}

/** The sample the user's ACTIVE base résumé is, or null — the safety rule's one question. */
export function activeSampleId(db, userId) {
  try {
    const row = db.prepare(`
      SELECT b.content FROM domain_profiles d JOIN profile_base_resumes b ON b.profile_id = d.id AND b.user_id = d.user_id
      WHERE d.user_id = ? AND d.is_active = 1`).get(userId)
      || db.prepare("SELECT content FROM base_resume WHERE user_id = ?").get(userId);
    return sampleIdForText(row?.content);
  } catch { return null; }
}

// ── the practice form's address ────────────────────────────────────────────────────────────────
// The form is posted by draft's own server-side browser, which carries no user session, so the URL names the account
// and the posting under an HMAC. A token names one (user, job) and cannot be moved to another.
function sign(secret, userId, jobId) {
  return crypto.createHmac("sha256", String(secret)).update(`practice:${userId}:${jobId}`).digest("base64url").slice(0, 32);
}
/** The secret and origin the practice form is signed and served with — server.js's own (SESSION_SECRET, APP_BASE_URL). */
export function practiceSecret(env = process.env) {
  return env.SESSION_SECRET || (env.NODE_ENV === "production" ? "" : "dev-session-secret-change-me");
}
export function practiceBaseUrl(env = process.env) {
  return String(env.APP_BASE_URL || env.FRONTEND_URL || `http://localhost:${env.PORT || 3001}`).replace(/\/$/, "");
}
export function practiceUrlFor({ baseUrl, secret, userId, jobId }) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  return `${base}/try/practice/${encodeURIComponent(String(jobId))}?u=${Number(userId)}&t=${sign(secret, userId, jobId)}`;
}
/** The user the token names, or null when it does not verify. */
export function verifyPracticeToken({ secret, jobId, u, t }) {
  const userId = Number(u);
  if (!Number.isInteger(userId) || userId <= 0 || typeof t !== "string") return null;
  const want = Buffer.from(sign(secret, userId, jobId)), got = Buffer.from(t);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? userId : null;
}

/**
 * The URL a run fills for this user and posting: the practice form when the active résumé is a sample, else null
 * (the caller keeps the posting's own apply URL).
 */
export function practiceSendUrl(db, { userId, jobId, baseUrl, secret }) {
  return activeSampleId(db, userId) ? practiceUrlFor({ baseUrl, secret, userId, jobId }) : null;
}

// ── the practice form ──────────────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * A Greenhouse-style application for one posting — the same field names a Greenhouse form uses
 * (job_application[...]), so draft's engine fills it as it fills a real one. Eligibility questions are OPTIONAL here:
 * the engine never guesses one, and a fictional person has none saved. The page says plainly that it is draft's
 * practice copy and that nothing reaches the employer.
 */
export function renderPracticeForm({ job, action }) {
  const title = esc(job?.title || "Software Engineer"), company = esc(job?.company || "the employer");
  const real = job?.apply_url || job?.url;
  const field = (lab, input, req = false) => `<div class="field"><label${req ? ' class="req"' : ""}>${lab}${req ? " *" : ""}${input}</label></div>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Job Application for ${title} at ${company} — draft practice form</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:16px;background:#fff;color:#1a1a1a}
.note{border-left:3px solid #4b6cb7;background:#f3f5fa;padding:10px 12px;border-radius:6px;font-size:14px}
.field{margin:14px 0}.field label{display:block;font-weight:600}.field input,.field select,.field textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:8px;border:1px solid #bbb;border-radius:6px;font:inherit;font-weight:400}
button{padding:10px 18px;border:0;border-radius:6px;background:#1a1a1a;color:#fff;font:inherit;cursor:pointer}</style></head>
<body><div id="app_body" class="greenhouse-practice">
<p class="note"><strong>draft practice form.</strong> This is draft's copy of a Greenhouse application for <strong>${title}</strong> at <strong>${company}</strong>,
used with a sample résumé. Nothing sent here reaches ${company}.${real ? ` <a href="${esc(real)}" target="_blank" rel="noopener">See the real job</a>.` : ""}</p>
<h1 class="app-title">${title}</h1><div class="company-name">at ${company}</div>
<form id="application_form" method="POST" action="${esc(action)}" enctype="multipart/form-data">
${field("First Name", `<input id="first_name" name="job_application[first_name]" autocomplete="given-name" required>`, true)}
${field("Last Name", `<input id="last_name" name="job_application[last_name]" autocomplete="family-name" required>`, true)}
${field("Email", `<input id="email" type="email" name="job_application[email]" autocomplete="email" required>`, true)}
${field("Phone", `<input id="phone" type="tel" name="job_application[phone]" autocomplete="tel">`)}
${field("Resume/CV", `<input id="resume" type="file" name="job_application[resume]" accept=".pdf,.doc,.docx,.txt" required>`, true)}
${field("LinkedIn Profile", `<input id="linkedin" type="url" name="job_application[linkedin]">`)}
${field("Website", `<input id="website" type="url" name="job_application[website]">`)}
${field("Are you legally authorized to work in the United States?", `<select id="authorized" name="job_application[legally_authorized]"><option value="">Select...</option><option>Yes</option><option>No</option></select>`)}
${field("Will you now or in the future require sponsorship for employment visa status?", `<select id="sponsorship" name="job_application[requires_sponsorship]"><option value="">Select...</option><option>Yes</option><option>No</option></select>`)}
${field("Why are you interested in this role?", `<textarea id="why" name="job_application[why_interested]" rows="3"></textarea>`)}
<button type="submit" id="submit_app">Submit Application</button>
</form></div></body></html>`;
}

export function renderPracticeThanks({ job }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Application submitted — draft practice form</title></head><body style="font:16px/1.5 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:16px">
<h1>Thank you for applying.</h1><p>Your application for ${esc(job?.title || "this role")} at ${esc(job?.company || "the employer")} was received by draft's practice form.
Nothing was sent to the employer.</p></body></html>`;
}

/** A submission reached the practice form: count it (never its values) and put the confirmation in the tester's Inbox. */
export function recordPracticeSubmission(db, { userId, job, fieldsFilled = 0, resumeAttached = false, deliver = null }) {
  db.prepare("INSERT INTO practice_submissions (user_id, job_id, fields_filled, resume_attached) VALUES (?, ?, ?, ?)")
    .run(userId ?? null, String(job?.job_id ?? job?.jobId ?? ""), Math.max(0, Number(fieldsFilled) || 0), resumeAttached ? 1 : 0);
  if (userId && deliver) {
    const company = job?.company || "the employer", title = job?.title || "the role";
    try {
      deliver({ userId, source: "practice", from: "no-reply@practice.jobsviadraft.com",
        subject: `Thank you for applying to ${company}`,
        text: `We received your application for ${title} at ${company} (draft practice form).\n\n` +
              `This came from draft's practice form, used because the résumé is a sample, a fictional person. Nothing was sent to ${company}.` });
    } catch { /* the submission stands; a missing confirmation is not a failed send */ }
  }
}
