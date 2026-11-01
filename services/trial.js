// ⭐ D124 · THE TRIAL (owner 11-01, amended): one link (/try) → a quick sign-up → a sample résumé or their own → the
// WHOLE site, as for every user (the board read from that résumé, the day's 10 Drafts, every feature) → a short
// survey after the 2nd sent Draft, and "Feedback / Something broke?" on every page. This module is the trial's data:
// the flag, the samples, the practice form a sample sends to, the survey, the feedback, and Admin → Trial's counts.
//
// ⛔ THE SAFETY RULE: a sample résumé is a FICTIONAL person and is never submitted to a real employer. It is keyed on
// the résumé, not on the trial flag — any account whose active base résumé IS a sample sends to draft's practice
// form (practiceUrlFor), whatever else is true of the account. A tester's OWN résumé sends for real, through the
// normal flow (one Approve per job in SEMI, as for every user).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { profileCategory } from "./jobs/professionalScope.js";
import { TOUR_STEPS, TOUR_STEP_IDS, TOUR_INTERACTIONS, TOUR_SECTIONS, TOUR_PHASES, TOUR_DEVICES, TOUR_SPEEDS } from "../shared/trialTour.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// D124 amended (owner 11-01): six samples by category — A software, B ML / data, C mechanical, D electrical,
// E business / financial analyst, F project / operations manager. Each is OFFERED only on a day its category has 10
// good picks (services/trialPicks.js offeredSamples).
export const SAMPLE_IDS = Object.freeze(["A", "B", "C", "D", "E", "F"]);
export const RESUME_CHOICES = Object.freeze([...SAMPLE_IDS, "own"]);
/** The survey pops up once, after this many sent Drafts. */
export const SURVEY_AFTER_SENT = 2;

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
export function trialSendUrl(db, { userId, jobId, baseUrl, secret }) {
  return activeSampleId(db, userId) ? practiceUrlFor({ baseUrl, secret, userId, jobId }) : null;
}

// ── the account: THE TRIAL IS THE MAIN FRAME (owner 11-01, second amendment) ─────────────────────
// Every account made after migration 205 ran is a trial account unless an admin grants it full access
// (users.full_access = 1); an admin can also put an older account INTO the trial (0). Admins are never trial accounts.
// The trial: 2 Drafts (and up to 4 résumé generations), then the whole site locks and ends in the survey and a
// coming-soon page.
const now = () => Math.floor(Date.now() / 1000);
const hasCol = (db, col) => { try { return db.prepare("PRAGMA table_info(users)").all().some(c => c.name === col); } catch { return false; } };
export const TRIAL_DRAFTS = 2;
export const TRIAL_GENERATIONS = 4;

function trialSince(db) {
  try { return db.prepare("SELECT value FROM trial_config WHERE key = 'trial_since'").get()?.value ?? null; } catch { return null; }
}

/** DRAFT_TRIAL=off turns the main frame off everywhere (the operator's switch; the test preload sets it for the suite). */
export function trialEnabled(env = process.env) {
  return String(env.DRAFT_TRIAL || "on").trim().toLowerCase() !== "off";
}

export function isTrial(db, userId) {
  if (!trialEnabled() || !hasCol(db, "full_access")) return false;
  const u = db.prepare("SELECT is_admin, created_at, full_access FROM users WHERE id = ?").get(userId);
  if (!u || u.is_admin) return false;
  if (u.full_access === 1) return false;
  if (u.full_access === 0) return true;
  const since = trialSince(db);
  return since != null && Number(u.created_at ?? 0) >= Number(since);
}

/** The app's first load (or /try's Start): the trial's clock starts once; a second call changes nothing. */
export function startTrial(db, userId) {
  if (isTrial(db, userId)) db.prepare("UPDATE users SET trial_at = COALESCE(trial_at, ?) WHERE id = ?").run(now(), userId);
  return trialState(db, userId);
}

/** The résumé the tester picked. For a sample, returns its text, which the client sends to /api/domain-profiles/from-resume. */
export function pickResume(db, userId, choice) {
  if (!RESUME_CHOICES.includes(choice)) throw Object.assign(new Error("Pick one of the sample résumés or your own."), { status: 400, code: "bad_choice" });
  startTrial(db, userId);
  db.prepare("UPDATE users SET trial_resume = ? WHERE id = ?").run(choice, userId);
  if (choice === "own") return { choice };
  const s = samples()[choice];
  return { choice, sample: { id: s.id, label: s.label, fictional: s.fictional, name: `sample-${s.id.toLowerCase()}.txt`, content: s.resumeText } };
}

function sentCount(db, userId) {
  try { return db.prepare("SELECT COUNT(*) n FROM apply_run_jobs WHERE user_id = ? AND status = 'submitted'").get(userId).n; }
  catch { return 0; }
}
function hasProfile(db, userId) {
  try { return !!db.prepare("SELECT 1 FROM domain_profiles WHERE user_id = ?").get(userId); } catch { return false; }
}

/**
 * What the client needs to frame the app: whether this is a trial account, its Drafts, and whether the site is now
 * LOCKED — after the 2nd sent Draft, or when the tester pressed "Finish the trial". Locked, the app is the survey (until
 * answered or skipped) and then the coming-soon page.
 */
export function trialState(db, userId, { draftsUsed = null } = {}) {
  if (!isTrial(db, userId)) return { trial: false };
  const u = db.prepare("SELECT trial_at, trial_resume, trial_survey_dismissed_at, trial_finished_at FROM users WHERE id = ?").get(userId) || {};
  const surveyDone = !!db.prepare("SELECT 1 FROM trial_surveys WHERE user_id = ?").get(userId);
  const sent = sentCount(db, userId);
  const locked = sent >= SURVEY_AFTER_SENT || !!u.trial_finished_at;
  return {
    trial: true, resume: u.trial_resume || null, sample: activeSampleId(db, userId), hasProfile: hasProfile(db, userId),
    drafts: TRIAL_DRAFTS, draftsUsed, sent, locked, surveyDone, surveySkipped: !!u.trial_survey_dismissed_at,
    // Locked and not yet answered or skipped: the survey is the whole page.
    surveyDue: locked && !surveyDone && !u.trial_survey_dismissed_at,
    // D129: the survey's "Your field", prefilled from the résumé (editable).
    fieldGuess: activeCategory(db, userId),
  };
}

/** The active job profile's category (D127), or null. */
export function activeCategory(db, userId) {
  try {
    const p = db.prepare("SELECT role_family, target_titles, profile_name FROM domain_profiles WHERE user_id = ? AND is_active = 1").get(userId);
    return p ? profileCategory(p) : null;
  } catch { return null; }
}

export function dismissSurvey(db, userId) {
  db.prepare("UPDATE users SET trial_survey_dismissed_at = COALESCE(trial_survey_dismissed_at, ?) WHERE id = ?").run(now(), userId);
}
/** "Finish the trial" — for a tester whose Drafts are held, or who has seen enough: the site locks into the survey now. */
export function finishTrial(db, userId) {
  db.prepare("UPDATE users SET trial_finished_at = COALESCE(trial_finished_at, ?) WHERE id = ?").run(now(), userId);
}

// ── exclusive access, from the admin panel ─────────────────────────────────────────────────────
/** Find an account by id, username or email (the admin's input). */
function findUser(db, who) {
  const w = String(who ?? "").trim();
  if (!w) return null;
  return db.prepare(`SELECT u.id, u.username, u.is_admin FROM users u LEFT JOIN user_profile p ON p.user_id = u.id
                     WHERE u.id = ? OR lower(u.username) = lower(?) OR lower(COALESCE(p.email, '')) = lower(?) LIMIT 1`)
    .get(/^\d+$/.test(w) ? Number(w) : -1, w, w) || null;
}
/** access: "full" (granted) · "trial" (put into the trial) · "default" (by age again). */
export function setAccess(db, { who, access, by }) {
  const u = findUser(db, who);
  if (!u) throw Object.assign(new Error("No account with that id, username or email."), { status: 404, code: "not_found" });
  if (u.is_admin) throw Object.assign(new Error("Admin accounts are never in the trial."), { status: 409, code: "admin_account" });
  const v = { full: 1, trial: 0, default: null }[access];
  if (v === undefined) throw Object.assign(new Error("access must be full, trial or default."), { status: 400, code: "bad_access" });
  db.prepare("UPDATE users SET full_access = ?, full_access_at = ?, full_access_by = ? WHERE id = ?").run(v, now(), String(by ?? "admin").slice(0, 120), u.id);
  return { id: u.id, username: u.username, access, trial: isTrial(db, u.id) };
}
/** The accounts an admin has set either way, newest first. */
export function listAccess(db) {
  try {
    return db.prepare(`SELECT id, username, full_access, full_access_at, full_access_by FROM users
                       WHERE full_access IS NOT NULL ORDER BY full_access_at DESC LIMIT 200`).all()
      .map(r => ({ id: r.id, username: r.username, access: r.full_access === 1 ? "full" : "trial", at: r.full_access_at, by: r.full_access_by }));
  } catch { return []; }
}

// ── the trial's analytics: names and counts, never content ────────────────────────────────────
// D129: the guided tour's events — "tour" (a step reached / completed / abandoned, with the ms spent, the device and the
// speed), "interaction" (a feature tried, by name) and "error" (a code seen on a step). Each detail is validated against
// shared/trialTour.js and stored as compact JSON; nothing typed by the user is ever stored here.
export const TRIAL_EVENTS = Object.freeze(["page", "active_minute", "tour", "interaction", "error"]);
const EVENTS_PER_DAY = 600;
const pick = (v, list, dflt = null) => (list.includes(v) ? v : dflt);

/** The stored detail for an event, or undefined when the event is malformed (refused). */
export function eventDetail(event, detail) {
  if (event === "page") return String(detail ?? "").split("?")[0].replace(/\/for\/[^/]+/, "/for/:id").replace(/\/\d+(?=\/|$)/g, "/:id").slice(0, 80) || "/";
  if (event === "active_minute") return null;
  const d = detail && typeof detail === "object" ? detail : {};
  if (event === "tour") {
    const step = pick(d.step, TOUR_STEP_IDS), phase = pick(d.phase, TOUR_PHASES);
    if (!step || !phase) return undefined;
    const ms = Number.isFinite(Number(d.ms)) ? Math.max(0, Math.min(Math.round(Number(d.ms)), 3_600_000)) : null;
    return JSON.stringify({ step, phase, ms, device: pick(d.device, TOUR_DEVICES), speed: pick(d.speed, TOUR_SPEEDS, "normal") });
  }
  if (event === "interaction") {
    const name = pick(d.name ?? detail, TOUR_INTERACTIONS);
    return name ? JSON.stringify({ name, step: pick(d.step, TOUR_STEP_IDS) }) : undefined;
  }
  if (event === "error") {
    const code = String(d.code ?? "").replace(/[^a-z0-9_:.-]/gi, "").slice(0, 60);
    return code ? JSON.stringify({ code, step: pick(d.step, TOUR_STEP_IDS) }) : undefined;
  }
  return undefined;
}

/** One event from the client. A page is a path with ids stripped (/app/job/123 → /app/job/:id); anything else is refused. */
export function recordEvent(db, userId, { event, detail } = {}) {
  if (!TRIAL_EVENTS.includes(event) || !isTrial(db, userId)) return false;
  const today = db.prepare("SELECT COUNT(*) n FROM trial_events WHERE user_id = ? AND created_at >= ?").get(userId, now() - 86400).n;
  if (today >= EVENTS_PER_DAY) return false;
  const d = eventDetail(event, detail);
  if (d === undefined) return false;
  db.prepare("INSERT INTO trial_events (user_id, event, detail) VALUES (?, ?, ?)").run(userId, event, d);
  return true;
}

// ── the survey: who they are, what they want, what they thought — ending in their own words ───
export const IMPROVEMENTS = Object.freeze(["more_jobs", "better_matching", "faster_tailoring", "more_sites", "interview_prep",
  "salary_insights", "referrals", "mobile_app", "browser_extension", "other"]);
// D129 (owner 11-01): "the survey is the most important part". ≤ 2 minutes; one tap each except the texts; every
// question skippable. Per-section usefulness, the ONE section used first, and the confusing step(s) are the new core.
const SECTION_LABEL = { picks: "The picks", filters: "The filters", draft_house: "Draft House / auto-apply", map: "Your map",
  learn: "Learn", table: "The Table" };
export const SURVEY = Object.freeze([
  { key: "searching", q: "Are you job-searching now?", type: "one", options: ["now", "within_6_months", "no"] },
  { key: "field", q: "Your field", type: "one", prefill: "category",
    options: ["computing", "engineering", "management", "business", "science", "legal", "arts_media", "sales", "marketing", "other"] },
  { key: "sent_last_month", q: "Applications you sent last month", type: "one", options: ["0", "1-10", "11-50", "50+"] },
  { key: "frustrations", q: "Your biggest frustration with job hunting (up to 2)", type: "many", max: 2,
    options: ["no_replies", "too_many_forms", "not_eligible", "fake_or_stale", "tailoring", "what_to_learn", "other"] },
  ...TOUR_SECTIONS.map(sec => ({ key: `rate_${sec}`, q: `How useful: ${SECTION_LABEL[sec]}`, type: "scale", min: 1, max: 5, section: sec })),
  { key: "use_first", q: "Which ONE would you use first?", type: "one", options: [...TOUR_SECTIONS] },
  { key: "confusing_steps", q: "Was anything confusing? (choose the step)", type: "many", max: 3, options: [...TOUR_STEP_IDS] },
  { key: "confusing_text", q: "What was confusing about it?", type: "text", max: 500 },
  { key: "would_use", q: "Would you use draft for your real search?", type: "one", options: ["yes", "maybe", "no"] },
  { key: "what_would_stop", q: "What would stop you from using it?", type: "text", max: 500 },
  { key: "would_pay", q: "What would you pay a month for it?", type: "one", options: ["nothing", "under_10", "10_20", "over_20"] },
  { key: "improvement", q: "The improvement you would want first", type: "select", options: IMPROVEMENTS },
  { key: "thoughts", q: "Any other thoughts or feedback?", type: "text", max: 1500 },
  { key: "followup_email", q: "Email, if you are happy to do a 10-minute follow-up call (optional)", type: "email", max: 200 },
]);

/** Validated answers; unknown keys and out-of-range values are dropped, never stored. Every question is optional. */
export function cleanSurvey(input = {}) {
  const out = {};
  for (const s of SURVEY) {
    const v = input[s.key];
    if (v == null || v === "") continue;
    if ((s.type === "one" || s.type === "select") && s.options.includes(v)) out[s.key] = v;
    if (s.type === "many" && Array.isArray(v)) {
      const picked = [...new Set(v.filter(x => s.options.includes(x)))].slice(0, s.max);
      if (picked.length) out[s.key] = picked;
    }
    if (s.type === "scale") { const n = Number(v); if (Number.isInteger(n) && n >= s.min && n <= s.max) out[s.key] = n; }
    if (s.type === "text" && typeof v === "string" && v.trim()) out[s.key] = v.trim().slice(0, s.max);
    if (s.type === "email" && typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) out[s.key] = v.trim().slice(0, s.max);
  }
  return out;
}

export function saveSurvey(db, userId, input) {
  const answers = cleanSurvey(input);
  if (!Object.keys(answers).length) throw Object.assign(new Error("Answer at least one question."), { status: 400, code: "empty_survey" });
  db.prepare(`INSERT INTO trial_surveys (user_id, answers) VALUES (?, ?)
              ON CONFLICT(user_id) DO UPDATE SET answers = excluded.answers, created_at = unixepoch()`).run(userId, JSON.stringify(answers));
  return answers;
}

export function saveFeedback(db, userId, { body, screen } = {}) {
  const text = String(body ?? "").trim().slice(0, 2000);
  if (!text) throw Object.assign(new Error("Write a line about what happened."), { status: 400, code: "empty_feedback" });
  const where = String(screen ?? "").trim().slice(0, 200) || null;
  db.prepare("INSERT INTO trial_feedback (user_id, screen, body) VALUES (?, ?, ?)").run(userId, where, text);
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

// ── Admin → Trial: counts only ─────────────────────────────────────────────────────────────────
export function adminTrialCounts(db) {
  const one = (sql, ...a) => { try { return db.prepare(sql).get(...a)?.n ?? 0; } catch { return 0; } };
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };
  const T = "SELECT id FROM users WHERE trial_at IS NOT NULL";
  const started = one(`SELECT COUNT(*) n FROM (${T})`);
  const picked = {};
  for (const c of RESUME_CHOICES) picked[c] = one("SELECT COUNT(*) n FROM users WHERE trial_at IS NOT NULL AND trial_resume = ?", c);
  const sentAtLeast = (k) => one(`SELECT COUNT(*) n FROM (SELECT user_id FROM apply_run_jobs WHERE status = 'submitted'
    AND user_id IN (${T}) GROUP BY user_id HAVING COUNT(*) >= ?)`, k);
  const surveys = all(`SELECT answers FROM trial_surveys WHERE user_id IN (${T})`).map(r => JSON.parse(r.answers));
  const tally = (key) => { const t = {}; for (const a of surveys) for (const v of [].concat(a[key] ?? [])) t[v] = (t[v] || 0) + 1; return t; };
  const funnel = { started, pickedResume: Object.values(picked).reduce((a, b) => a + b, 0),
    draft1Sent: sentAtLeast(1), draft2Sent: sentAtLeast(2), surveySubmitted: surveys.length };
  // Usage: how many testers opened each page; active minutes per tester (median); the roles they came for.
  const pages = Object.fromEntries(all(`SELECT detail, COUNT(DISTINCT user_id) n FROM trial_events WHERE event = 'page' AND user_id IN (${T})
    GROUP BY detail ORDER BY n DESC LIMIT 20`).map(r => [r.detail, r.n]));
  const minutes = all(`SELECT COUNT(*) n FROM trial_events WHERE event = 'active_minute' AND user_id IN (${T}) GROUP BY user_id`)
    .map(r => r.n).sort((a, b) => a - b);
  const roleFamilies = Object.fromEntries(all(`SELECT role_family k, COUNT(DISTINCT user_id) n FROM domain_profiles WHERE is_active = 1
    AND user_id IN (${T}) GROUP BY role_family ORDER BY n DESC`).map(r => [r.k || "unknown", r.n]));
  const titles = {};
  for (const r of all(`SELECT target_titles FROM domain_profiles WHERE is_active = 1 AND user_id IN (${T})`)) {
    try { for (const t of JSON.parse(r.target_titles || "[]").slice(0, 3)) titles[t] = (titles[t] || 0) + 1; } catch { /* unreadable */ }
  }
  return {
    funnel, picked,
    survey: { searching: tally("searching"), field: tally("field"), sentLastMonth: tally("sent_last_month"),
      frustrations: tally("frustrations"), useFirst: tally("use_first"), confusingSteps: tally("confusing_steps"),
      wouldUse: tally("would_use"), wouldPay: tally("would_pay"), improvement: tally("improvement"),
      thoughts: surveys.filter(a => a.thoughts).length },
    // D129: per-section usefulness, each an average of the 1–5 answers given (null when nobody rated it).
    sectionUseful: Object.fromEntries(TOUR_SECTIONS.map(sec => [sec, avg(surveys.map(a => a[`rate_${sec}`]).filter(Number.isFinite))])),
    usage: { pages, testersActive: minutes.length, medianActiveMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null },
    interests: { roleFamilies, topTitles: Object.fromEntries(Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 10)) },
    locked: one(`SELECT COUNT(*) n FROM users WHERE trial_at IS NOT NULL AND (trial_finished_at IS NOT NULL OR id IN
      (SELECT user_id FROM apply_run_jobs WHERE status = 'submitted' GROUP BY user_id HAVING COUNT(*) >= ${SURVEY_AFTER_SENT}))`),
    practiceSubmissions: one("SELECT COUNT(*) n FROM practice_submissions"),
    feedback: one("SELECT COUNT(*) n FROM trial_feedback"),
    followupEmails: surveys.filter(a => a.followup_email).length,
    access: listAccess(db),
  };
}

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100 : null);
const median = (xs) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };

/**
 * Each trial account's tour, read from its events: per step the first reached / completed time and the ms spent, the
 * device and speed it ran at, the sample, the field (the active profile's category), the drafts sent, the survey.
 */
export function tourSessions(db, { categoryOf = (u) => (u.role_family ? profileCategory(u) : null) } = {}) {
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };
  const users = all(`SELECT u.id, u.trial_resume, s.answers, d.role_family, d.target_titles, d.profile_name
    FROM users u LEFT JOIN trial_surveys s ON s.user_id = u.id
    LEFT JOIN domain_profiles d ON d.user_id = u.id AND d.is_active = 1 WHERE u.trial_at IS NOT NULL`);
  const sent = Object.fromEntries(all(`SELECT user_id, COUNT(*) n FROM apply_run_jobs WHERE status = 'submitted' GROUP BY user_id`)
    .map(r => [r.user_id, r.n]));
  const ev = new Map();
  for (const r of all(`SELECT user_id, event, detail, created_at FROM trial_events WHERE event IN ('tour','interaction','error') ORDER BY id`)) {
    if (!ev.has(r.user_id)) ev.set(r.user_id, []);
    try { ev.get(r.user_id).push({ event: r.event, at: r.created_at, ...JSON.parse(r.detail || "{}") }); } catch { /* unreadable */ }
  }
  return users.map(u => {
    const steps = {}, interactions = {}, errors = [];
    let device = null, speed = "normal";
    for (const e of ev.get(u.id) || []) {
      if (e.event === "tour") {
        const st = (steps[e.step] ??= {});
        if (e.phase === "reached" && st.reached == null) st.reached = e.at;
        if (e.phase === "completed") { st.completed = e.at; if (e.ms != null) st.ms = (st.ms || 0) + e.ms; }
        if (e.phase === "abandoned") st.abandoned = e.at;
        device = e.device || device; speed = e.speed || speed;
      }
      if (e.event === "interaction") interactions[e.name] = (interactions[e.name] || 0) + 1;
      if (e.event === "error") errors.push({ code: e.code, step: e.step });
    }
    const reached = TOUR_STEP_IDS.filter(id => steps[id]?.reached != null);
    let answers = null;
    try { answers = u.answers ? JSON.parse(u.answers) : null; } catch { /* unreadable */ }
    const field = answers?.field || categoryOf(u) || null;
    const drafts = sent[u.id] || 0;
    return { userId: u.id, sample: u.trial_resume || null, field, device, speed, steps, reached,
      lastStep: reached[reached.length - 1] || null, finished: steps.survey?.completed != null,
      totalMs: TOUR_STEP_IDS.reduce((t, id) => t + (steps[id]?.ms || 0), 0), interactions, errors, drafts,
      draftsOk: drafts >= 2 ? "both" : drafts === 1 ? "one" : "none", answers };
  });
}

/** D129's dimensions for a cross-cut. */
export const CROSS_CUTS = Object.freeze(["sample", "field", "device", "speed", "draftsOk"]);

/**
 * D129 · USABLE ANALYTICS (Admin → Trial; counts, never content beyond the free-text answers themselves):
 * the funnel per step (reached · completed · abandoned · median ms), drop-off points, interactions, errors by step,
 * the survey's distributions, per-section usefulness, and any survey answer cut by sample / field / device / speed /
 * drafts sent. `filter` narrows every number to one value of one dimension ({ by: "device", value: "phone" }).
 */
export function trialAnalytics(db, { filter = null, categoryOf } = {}) {
  let sessions = tourSessions(db, { categoryOf });
  if (filter && CROSS_CUTS.includes(filter.by)) sessions = sessions.filter(s => String(s[filter.by]) === String(filter.value));
  const funnel = TOUR_STEPS.map(({ id, title }) => {
    const here = sessions.filter(s => s.steps[id]?.reached != null);
    const done = here.filter(s => s.steps[id]?.completed != null);
    return { step: id, title, reached: here.length, completed: done.length,
      abandoned: here.filter(s => s.lastStep === id && !s.finished).length,
      medianMs: median(done.map(s => s.steps[id].ms).filter(Number.isFinite)) };
  });
  const dropOff = {};
  for (const s of sessions) if (!s.finished && s.lastStep) dropOff[s.lastStep] = (dropOff[s.lastStep] || 0) + 1;
  const interactions = Object.fromEntries(TOUR_INTERACTIONS.map(n => [n, sessions.filter(s => s.interactions[n]).length]));
  const errors = {};
  for (const s of sessions) for (const e of s.errors) { const k = `${e.step || "-"} · ${e.code}`; errors[k] = (errors[k] || 0) + 1; }
  const answered = sessions.filter(s => s.answers);
  const distribution = {};
  for (const q of SURVEY) {
    if (q.type === "text" || q.type === "email") continue;
    const t = {};
    for (const s of answered) for (const v of [].concat(s.answers[q.key] ?? [])) t[v] = (t[v] || 0) + 1;
    distribution[q.key] = t;
  }
  const texts = {};
  for (const key of ["what_would_stop", "confusing_text", "thoughts"]) {
    texts[key] = answered.filter(s => s.answers[key]).map(s => ({ text: s.answers[key], steps: s.answers.confusing_steps || [],
      sample: s.sample, field: s.field }));
  }
  return {
    testers: sessions.length, finished: sessions.filter(s => s.finished).length,
    medianTotalMs: median(sessions.filter(s => s.finished).map(s => s.totalMs)),
    funnel, dropOff, interactions, errors, distribution,
    sectionUseful: Object.fromEntries(TOUR_SECTIONS.map(sec => [sec, avg(answered.map(s => s.answers[`rate_${sec}`]).filter(Number.isFinite))])),
    texts,
    dimensions: Object.fromEntries(CROSS_CUTS.map(d => [d, [...new Set(sessions.map(s => s[d]).filter(v => v != null))]])),
  };
}

/** One survey answer (or a section rating) cut by a dimension: { [dimValue]: { [answer]: count } } or averages for a scale. */
export function crossCut(db, { key, by, categoryOf } = {}) {
  const q = SURVEY.find(x => x.key === key);
  if (!q || !CROSS_CUTS.includes(by)) return null;
  const out = {};
  for (const s of tourSessions(db, { categoryOf })) {
    if (!s.answers || s.answers[key] == null) continue;
    const g = String(s[by] ?? "unknown");
    if (q.type === "scale") (out[g] ??= []).push(s.answers[key]);
    else for (const v of [].concat(s.answers[key])) { (out[g] ??= {}); out[g][v] = (out[g][v] || 0) + 1; }
  }
  if (q.type === "scale") for (const g of Object.keys(out)) out[g] = { average: avg(out[g]), n: out[g].length };
  return out;
}

/** CSV, one row per tester: the tour, the drafts, every survey answer. Emails only when asked AND the tester gave one. */
export function analyticsCsv(db, { includeEmails = false, categoryOf } = {}) {
  const cols = ["sample", "field", "device", "speed", "last_step", "finished", "total_seconds", "drafts_sent",
    ...TOUR_STEP_IDS.map(id => `s_${id}_seconds`), ...SURVEY.filter(q => includeEmails || q.type !== "email").map(q => q.key)];
  const cell = (v) => { const t = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = tourSessions(db, { categoryOf }).map(s => [s.sample, s.field, s.device, s.speed, s.lastStep, s.finished ? 1 : 0,
    Math.round(s.totalMs / 1000), s.drafts, ...TOUR_STEP_IDS.map(id => (s.steps[id]?.ms != null ? Math.round(s.steps[id].ms / 1000) : "")),
    ...SURVEY.filter(q => includeEmails || q.type !== "email").map(q => s.answers?.[q.key])].map(cell).join(","));
  return [cols.join(","), ...rows].join("\n") + "\n";
}

/** The survey answers for export, WITHOUT emails (D124: "an export of the survey answers without emails"). */
export function surveyExport(db) {
  try {
    return db.prepare("SELECT s.answers, s.created_at, u.trial_resume FROM trial_surveys s JOIN users u ON u.id = s.user_id WHERE u.trial_at IS NOT NULL ORDER BY s.created_at")
      .all().map(r => { const a = JSON.parse(r.answers); delete a.followup_email; return { resume: r.trial_resume, at: r.created_at, ...a }; });
  } catch { return []; }
}
