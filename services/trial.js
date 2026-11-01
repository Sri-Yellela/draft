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
    // The survey's "What field are you in?", prefilled from the résumé (editable) — the sketch's own words.
    fieldGuess: FIELD_FOR_CATEGORY[activeCategory(db, userId)] || null,
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
// ⭐ THE SURVEY IS THE OWNER'S SKETCH (docs/sketches/draft — quick feedback.html, 11-01), question for question: a plain
// form — dropdowns, four 5-star ratings of what they tried (in plain words, never an internal page name), "what would
// make this 5 stars?" only below 5, a few follow-ups only when they apply. Required where the sketch marks it.
// Each answer is stored as the option's own words. The section a rating belongs to is named for the analytics.
const STARS = ["Not useful", "Slightly useful", "Useful", "Very useful", "Exactly what I need"];
export const SURVEY_FIELDS = Object.freeze(["Software and computing", "Data, ML and AI", "Mechanical or manufacturing engineering",
  "Electrical or electronics engineering", "Civil, structural or environmental engineering", "Other engineering",
  "Business, finance or consulting", "Product or project management", "Marketing or sales", "Design or media",
  "Science or research", "Something else"]);
export const SURVEY = Object.freeze([
  { key: "search_stage", section: "Your job search today", required: true, type: "select",
    q: "Where are you with job hunting right now?",
    options: ["Actively applying", "Starting to look in the next few months", "Employed, but open to the right offer",
      "Student, looking for an internship or first job", "Not looking right now"] },
  { key: "field", required: true, type: "select", prefill: "category", q: "What field are you in?",
    hint: "We guessed from the résumé you picked. Change it if it's wrong.", options: [...SURVEY_FIELDS] },
  { key: "time_per_app", required: true, type: "select",
    q: "How long does it take you to find a job and send out a good application?",
    hint: "From finding the posting to pressing submit, for one application you're happy with.",
    options: ["Under 15 minutes", "15 to 30 minutes", "30 minutes to 1 hour", "1 to 2 hours", "More than 2 hours"] },
  { key: "apps_per_week", type: "select", q: "How many applications do you send out when you're job searching?",
    options: ["1 to 5 a week", "6 to 15 a week", "16 to 30 a week", "More than 30 a week", "I haven't started yet"] },
  { key: "find_tool", type: "select", q: "What do you mainly use to find and apply for jobs today?",
    options: ["LinkedIn or Indeed", "Company career pages, one by one", "Recruiters or referrals", "University or school career portal",
      "An AI or auto-apply tool", "Something else"],
    follow: { key: "find_tool_other", when: ["Something else", "An AI or auto-apply tool"], placeholder: "Which one?" } },
  { key: "paid_before", type: "select", q: "Have you ever paid for anything to help your job search?",
    hint: "For example a résumé writer, LinkedIn Premium, a course, or an application tool.",
    options: ["No, never", "Yes, under $20 in total", "Yes, $20 to $100", "Yes, more than $100"] },
  { key: "frustration", required: true, type: "select", q: "What's the most frustrating part of job hunting for you?",
    options: ["Applying and hearing nothing back", "Filling out the same application forms again and again",
      "Rewriting my résumé for every job", "Finding jobs I'm actually eligible for (visa, level, location)",
      "Not knowing which postings are real or still open", "Not knowing which skills to learn next", "Something else"],
    follow: { key: "frustration_other", when: ["Something else"], placeholder: "Tell us in a few words" } },
  { key: "rate_matches", section: "What you just tried", type: "stars", area: "picks", q: "Your job matches",
    hint: "The 10 jobs we picked for your résumé, best match first, with why each one fits.",
    follow: { key: "rate_matches_why", below: 5, placeholder: "What would make this 5 stars?" } },
  { key: "rate_applying", type: "stars", area: "draft_house", q: "Applying for you",
    hint: "draft tailoring the résumé to each job and filling out the application while you watched.",
    follow: { key: "rate_applying_why", below: 5, placeholder: "What would make this 5 stars?" } },
  { key: "rate_map", type: "stars", area: "map", q: "Your skills map",
    hint: "The map of the skills you have, the ones close to you, and what to learn next to move up.",
    follow: { key: "rate_map_why", below: 5, placeholder: "What would make this 5 stars?" } },
  { key: "rate_tracker", type: "stars", area: "table", q: "Your application tracker",
    hint: "The page that lists every job you applied to, with replies and interview invites as they come in.",
    follow: { key: "rate_tracker_why", below: 5, placeholder: "What would make this 5 stars?" } },
  { key: "compared", section: "Your verdict", required: true, type: "select", q: "Compared with how you apply today, draft would be…",
    options: ["Much better", "Somewhat better", "About the same", "Worse"] },
  { key: "trust_auto", type: "select", q: "Would you let draft send applications for you?",
    hint: "draft only ever answers from your own résumé and never ticks agreements for you.",
    options: ["Yes, I'd let it send on its own", "Yes, after I've checked the first few", "Only if I approve every one", "No, I'd rather apply myself"] },
  { key: "most_helpful", type: "select", q: "Which part would help your job search most?",
    options: ["The job matches", "Applying for me", "The skills map", "The application tracker", "None of these"] },
  { key: "interested", required: true, type: "select", q: "Would you be interested in using draft for your job search?",
    options: ["Yes, as soon as I can", "Yes, when I start looking", "Maybe", "No"],
    follow: { key: "interested_why", when: ["Maybe", "No"], placeholder: "What would change your mind?" } },
  { key: "fair_price", type: "select", q: "What would feel fair to pay for draft each month?",
    hint: "Think of the time each application takes you today: finding jobs that fit, checking you're eligible and the posting is still open, researching the company, rewriting your résumé for it, and filling out the form. draft does all of that for you, for as many jobs as you want.",
    options: ["I'd only use it if it were free", "Under $10 a month", "$10 to $20 a month", "$20 to $40 a month", "More than $40 a month"] },
  { key: "must_have", type: "text", max: 1500, q: "What's one thing that would make draft a must-have for you?",
    placeholder: "Anything: a feature, a fix, a worry" },
  { key: "referral_email", type: "email", max: 200, q: "Know someone job hunting who should try this?",
    hint: "Optional. We'll send them one invite, from you, and nothing else.", placeholder: "their email" },
]);
export const STAR_LABELS = Object.freeze(STARS);
/** The ratings, by the tour's section they rate (for the analytics). */
export const RATED = Object.freeze(SURVEY.filter(q => q.type === "stars").map(q => ({ key: q.key, area: q.area, label: q.q })));
/** The prefill: the résumé's D127 category → the sketch's field. */
export const FIELD_FOR_CATEGORY = Object.freeze({ computing: "Software and computing", engineering: "Other engineering",
  business: "Business, finance or consulting", management: "Product or project management", marketing: "Marketing or sales",
  sales: "Marketing or sales", arts_media: "Design or media", science: "Science or research" });

/** Validated answers; unknown keys and out-of-range values are dropped, never stored. Every question is optional. */
export function cleanSurvey(input = {}) {
  const out = {};
  const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  for (const s of SURVEY) {
    const v = input[s.key];
    if (v == null || v === "") continue;
    if (s.type === "select" && s.options.includes(v)) out[s.key] = v;
    if (s.type === "stars") { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 5) out[s.key] = n; }
    if (s.type === "text" && text(v, s.max)) out[s.key] = text(v, s.max);
    if (s.type === "email" && typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) out[s.key] = v.trim().slice(0, s.max);
    // A follow-up is kept only when it applies: the chosen option asks for it, or the rating is below its bar.
    const f = s.follow;
    if (f && out[s.key] != null && text(input[f.key], 300)
        && (f.when ? f.when.includes(out[s.key]) : out[s.key] < f.below)) out[f.key] = text(input[f.key], 300);
  }
  return out;
}

/** The questions the sketch marks required that are missing from cleaned answers (the page asks for them; [] = complete). */
export function missingRequired(answers = {}) {
  return SURVEY.filter(q => q.required && answers[q.key] == null).map(q => q.key);
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
    survey: Object.fromEntries(SURVEY.filter(q => q.type === "select").map(q => [q.key, tally(q.key)])),
    questions: Object.fromEntries(SURVEY.map(q => [q.key, q.q])),
    mustHave: surveys.filter(a => a.must_have).length,
    // The four ratings: the average of the stars given (null when nobody rated it).
    stars: Object.fromEntries(RATED.map(r => [r.key, avg(surveys.map(a => a[r.key]).filter(Number.isFinite))])),
    usage: { pages, testersActive: minutes.length, medianActiveMinutes: minutes.length ? minutes[Math.floor(minutes.length / 2)] : null },
    interests: { roleFamilies, topTitles: Object.fromEntries(Object.entries(titles).sort((a, b) => b[1] - a[1]).slice(0, 10)) },
    locked: one(`SELECT COUNT(*) n FROM users WHERE trial_at IS NOT NULL AND (trial_finished_at IS NOT NULL OR id IN
      (SELECT user_id FROM apply_run_jobs WHERE status = 'submitted' GROUP BY user_id HAVING COUNT(*) >= ${SURVEY_AFTER_SENT}))`),
    practiceSubmissions: one("SELECT COUNT(*) n FROM practice_submissions"),
    feedback: one("SELECT COUNT(*) n FROM trial_feedback"),
    referrals: surveys.filter(a => a.referral_email).length,
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
  for (const key of ["must_have", "interested_why", "frustration_other", "find_tool_other", ...RATED.map(r => `${r.key}_why`)]) {
    texts[key] = answered.filter(s => s.answers[key]).map(s => ({ text: s.answers[key], sample: s.sample, field: s.field }));
  }
  return {
    testers: sessions.length, finished: sessions.filter(s => s.finished).length,
    medianTotalMs: median(sessions.filter(s => s.finished).map(s => s.totalMs)),
    funnel, dropOff, interactions, errors, distribution,
    stars: Object.fromEntries(RATED.map(r => [r.key, avg(answered.map(s => s.answers[r.key]).filter(Number.isFinite))])),
    texts,
    questions: Object.fromEntries(SURVEY.flatMap(q => [[q.key, q.q], ...(q.follow ? [[q.follow.key, `${q.q} — ${q.follow.placeholder}`]] : [])])),
    cuttable: SURVEY.filter(q => q.type === "select" || q.type === "stars").map(q => q.key),
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
    if (q.type === "stars") (out[g] ??= []).push(s.answers[key]);
    else for (const v of [].concat(s.answers[key])) { (out[g] ??= {}); out[g][v] = (out[g][v] || 0) + 1; }
  }
  if (q.type === "stars") for (const g of Object.keys(out)) out[g] = { average: avg(out[g]), n: out[g].length };
  return out;
}

/** CSV, one row per tester: the tour, the drafts, every survey answer. Emails only when asked AND the tester gave one. */
export function analyticsCsv(db, { includeEmails = false, categoryOf } = {}) {
  const qs = SURVEY.filter(q => includeEmails || q.type !== "email").flatMap(q => (q.follow ? [q.key, q.follow.key] : [q.key]));
  const cols = ["sample", "field", "device", "speed", "last_step", "finished", "total_seconds", "drafts_sent",
    ...TOUR_STEP_IDS.map(id => `s_${id}_seconds`), ...qs];
  const cell = (v) => { const t = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = tourSessions(db, { categoryOf }).map(s => [s.sample, s.field, s.device, s.speed, s.lastStep, s.finished ? 1 : 0,
    Math.round(s.totalMs / 1000), s.drafts, ...TOUR_STEP_IDS.map(id => (s.steps[id]?.ms != null ? Math.round(s.steps[id].ms / 1000) : "")),
    ...qs.map(k => s.answers?.[k])].map(cell).join(","));
  return [cols.join(","), ...rows].join("\n") + "\n";
}

/** The survey answers for export, WITHOUT emails (D124: "an export of the survey answers without emails"). */
export function surveyExport(db) {
  try {
    return db.prepare("SELECT s.answers, s.created_at, u.trial_resume FROM trial_surveys s JOIN users u ON u.id = s.user_id WHERE u.trial_at IS NOT NULL ORDER BY s.created_at")
      .all().map(r => { const a = JSON.parse(r.answers); delete a.followup_email; delete a.referral_email; return { resume: r.trial_resume, at: r.created_at, ...a }; });
  } catch { return []; }
}
