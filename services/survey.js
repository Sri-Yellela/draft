// services/survey.js — ⭐ THE SURVEYS' QUESTIONS AND THE STANDALONE SURVEY'S STORAGE (D129 FINAL v2 + D130).
//
// 11-07 (owner): the D124 trial was removed — every account gets the whole site — and its in-app survey with it. What
// stays is the research: the standalone survey at /survey (no account), and Admin → Testers, which reads both the
// standalone answers and the answers trial testers already gave (trial_surveys, kept in the schema). So the trial
// survey's QUESTIONS stay here: they are the key to reading those stored answers (services/testersReport.js,
// services/testerContacts.js), and the standalone survey is built from them. Nothing here writes a trial row any more.
import crypto from "node:crypto";

/** The trial's survey popped up after this many sent Drafts. Historical — Admin → Testers reads old accounts by it. */
export const SURVEY_AFTER_SENT = 2;

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

// ⭐ D130 (owner 11-01) · THE STANDALONE SURVEY — jobsviadraft.com/survey, for people who can't try the app: no
// sign-in, no account, no résumé, the SAME form; name and email first (their only identity), D129's (1)–(7) unchanged
// (the field not prefilled), then questions about the IDEA, never our screens. Shared keys (1–7, interested, fair_price,
// trust_auto) line up with the trial's so Admin → Testers can put the two sources side by side and combine them.
const byKey = (k) => SURVEY.find(q => q.key === k);
const PAY_HINT = "Think of the time each application takes you today: finding jobs that fit, checking you're eligible and the posting is still open, researching the company, rewriting your résumé for it, and filling out the form. A tool like this would do all of that for you, for as many jobs as you want.";
export const STANDALONE_SURVEY = Object.freeze([
  { key: "name", section: "You", required: true, type: "text", max: 120, single: true, q: "Your name", placeholder: "First and last name" },
  { key: "email", required: true, type: "email", max: 200, q: "Your email", placeholder: "you@example.com",
    hint: "We use your email only to follow up on this survey and to tell you when draft is ready for you. We never share it." },
  ...["search_stage", "field", "time_per_app", "apps_per_week", "find_tool", "paid_before", "frustration"].map(k => {
    const q = { ...byKey(k) };
    if (k === "field") { delete q.prefill; delete q.hint; }
    if (k === "frustration") delete q.required;   // D130: required are name, email, 1, 2, 3 and 11
    return q;
  }),
  { key: "idea_useful", section: "What would help", type: "stars", area: "idea",
    q: "If a tool found jobs that fit you and that you're eligible for, rewrote your résumé for each one, and filled out the applications for you, how useful would that be?",
    follow: { key: "idea_useful_why", below: 5, placeholder: "What would make it 5 stars?" } },
  { key: "idea_most_helpful", type: "select", q: "Which of these would help your job search most?",
    options: ["Jobs matched to your résumé, visa and level", "Your résumé tailored to every job", "Applications filled out and sent for you",
      "A map of your skills and what to learn next", "One tracker for every application and reply", "None of these"] },
  { ...byKey("trust_auto"), q: "Would you let a tool send applications for you?",
    hint: "If it only answered from your own résumé and never ticked agreements for you." },
  { ...byKey("interested"), q: "Would you be interested in trying draft?" },
  { ...byKey("fair_price"), q: "What would feel fair to pay each month for a tool that does this?", hint: PAY_HINT },
  { key: "must_have", type: "text", max: 1500, q: "What's one thing that would make a tool like this a must-have for you?",
    placeholder: "Anything: a feature, a fix, a worry" },
  { ...byKey("referral_email"), q: "Know someone job hunting who should hear about this?",
    hint: "Optional. We'll send them one note about draft, and nothing else." },
].map(q => Object.freeze(q)));

/** Validated answers; unknown keys and out-of-range values are dropped, never stored. */
export function cleanSurvey(input = {}, questions = SURVEY) {
  const out = {};
  const text = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  for (const s of questions) {
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
export function missingRequired(answers = {}, questions = SURVEY) {
  return questions.filter(q => q.required && answers[q.key] == null).map(q => q.key);
}

// ── D130: the standalone survey's storage (standalone_surveys, migration 209) ─────────────────────────────
const rateWindow = new Map();   // ip hash -> [ms of submissions in the last hour]
export const STANDALONE_PER_HOUR = 5;
const ipKey = (ip) => crypto.createHash("sha256").update(`survey:${ip || "?"}`).digest("base64url").slice(0, 16);
/** Test seam. */
export function clearSurveyRateLimit() { rateWindow.clear(); }

/**
 * One response per email — a second submission updates the first. A filled honeypot is accepted silently and stored
 * nowhere (a bot learns nothing); more than STANDALONE_PER_HOUR submissions an hour from one address are refused.
 */
export function saveStandaloneSurvey(db, input = {}, { ip = null, now = Date.now() } = {}) {
  if (String(input.website ?? "").trim()) return { ok: true, stored: false };
  const k = ipKey(ip);
  const recent = (rateWindow.get(k) || []).filter(t => now - t < 3600_000);
  if (recent.length >= STANDALONE_PER_HOUR) throw Object.assign(new Error("Too many answers from here in the last hour. Try again later."), { status: 429, code: "rate_limited" });
  const answers = cleanSurvey(input, STANDALONE_SURVEY);
  const missing = missingRequired(answers, STANDALONE_SURVEY);
  if (missing.length) throw Object.assign(new Error("A few questions still need an answer."), { status: 400, code: "missing", missing });
  recent.push(now); rateWindow.set(k, recent);
  const { name, email, ...rest } = answers;
  db.prepare(`INSERT INTO standalone_surveys (name, email, email_key, answers) VALUES (?, ?, ?, ?)
              ON CONFLICT(email_key) DO UPDATE SET name = excluded.name, email = excluded.email, answers = excluded.answers,
              updated_at = unixepoch()`).run(name, email, email.toLowerCase(), JSON.stringify(rest));
  return { ok: true, stored: true };
}

/** The standalone responses as CSV, one row each; name and email only with includeContact (D130's explicit toggle). */
export function standaloneCsv(db, { includeContact = false } = {}) {
  const qs = STANDALONE_SURVEY.filter(q => q.key !== "name" && q.key !== "email" && (includeContact || q.type !== "email"))
    .flatMap(q => (q.follow ? [q.key, q.follow.key] : [q.key]));
  const cols = [...(includeContact ? ["name", "email"] : []), "answered_at", ...qs];
  const cell = (v) => { const t = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = standaloneResponses(db).map(r => [...(includeContact ? [r.name, r.email] : []), new Date(r.at * 1000).toISOString(),
    ...qs.map(k => r.answers[k])].map(cell).join(","));
  return [cols.join(","), ...rows].join("\n") + "\n";
}

// ── D130 · BOTH SOURCES, SIDE BY SIDE AND COMBINED; THE YC NUMBERS ────────────────────────────────────
/** The questions both surveys ask, by key (D129's 1–7, interest, pay, trust). */
export const SHARED_KEYS = Object.freeze(["search_stage", "field", "time_per_app", "apps_per_week", "find_tool", "paid_before",
  "frustration", "trust_auto", "interested", "fair_price"]);
export const MID_MINUTES = { "Under 15 minutes": 10, "15 to 30 minutes": 22.5, "30 minutes to 1 hour": 45, "1 to 2 hours": 90, "More than 2 hours": 150 };
export const MID_PER_WEEK = { "1 to 5 a week": 3, "6 to 15 a week": 10.5, "16 to 30 a week": 23, "More than 30 a week": 40 };
const share = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);

/** Both surveys' answers: [{ source: "trial" | "standalone", answers, sample, field }]. */
export function allResponses(db) {
  let trial = [];
  try {
    trial = db.prepare(`SELECT s.answers, u.trial_resume FROM trial_surveys s JOIN users u ON u.id = s.user_id WHERE u.trial_at IS NOT NULL`).all()
      .map(r => ({ source: "trial", sample: r.trial_resume, answers: JSON.parse(r.answers || "{}") }));
  } catch { trial = []; }
  const standalone = standaloneResponses(db).map(r => ({ source: "standalone", sample: null, answers: r.answers }));
  return [...trial, ...standalone];
}

/**
 * D130: every shared question tallied trial · standalone · combined; each source's own questions on their own; and
 * THE YC NUMBERS (D129 FINAL v2) over everyone who answered: hours a week spent applying (time per good application ×
 * applications a week, by band midpoints), % who paid for help, what they use today, % much / somewhat better (the
 * trial's), trust in auto-apply, % interested, the pay distribution, the frustration ranking, stars, friends suggested.
 */
export function surveySources(db) {
  const all = allResponses(db);
  const tallyOf = (rows, key) => { const t = {}; for (const r of rows) for (const v of [].concat(r.answers[key] ?? [])) t[v] = (t[v] || 0) + 1; return t; };
  const by = { trial: all.filter(r => r.source === "trial"), standalone: all.filter(r => r.source === "standalone") };
  const shared = Object.fromEntries(SHARED_KEYS.map(k => [k, { question: byKey(k).q, trial: tallyOf(by.trial, k),
    standalone: tallyOf(by.standalone, k), combined: tallyOf(all, k) }]));
  const own = (questions, rows) => Object.fromEntries(questions.filter(q => !SHARED_KEYS.includes(q.key) && (q.type === "select" || q.type === "stars"))
    .map(q => [q.key, { question: q.q, ...(q.type === "stars"
      ? { average: avg(rows.map(r => r.answers[q.key]).filter(Number.isFinite)), counts: tallyOf(rows, q.key) }
      : { counts: tallyOf(rows, q.key) }) }]));
  const hours = all.map(r => (MID_MINUTES[r.answers.time_per_app] != null && MID_PER_WEEK[r.answers.apps_per_week] != null
    ? MID_MINUTES[r.answers.time_per_app] * MID_PER_WEEK[r.answers.apps_per_week] / 60 : null)).filter(x => x != null);
  const answeredPaid = all.filter(r => r.answers.paid_before);
  const answeredInterest = all.filter(r => r.answers.interested);
  const answeredCompared = by.trial.filter(r => r.answers.compared);
  const frustrationRank = Object.entries(tallyOf(all, "frustration")).sort((a, b) => b[1] - a[1]);
  return {
    responses: { trial: by.trial.length, standalone: by.standalone.length, combined: all.length },
    shared, trialOnly: own(SURVEY, by.trial), standaloneOnly: own(STANDALONE_SURVEY, by.standalone),
    yc: {
      hoursPerWeek: { median: hours.length ? Math.round(median(hours) * 10) / 10 : null, average: avg(hours), n: hours.length },
      paidForHelp: { percent: share(answeredPaid.filter(r => r.answers.paid_before !== "No, never").length, answeredPaid.length),
        n: answeredPaid.length, how: tallyOf(all, "paid_before") },
      useToday: tallyOf(all, "find_tool"),
      betterThanToday: { percent: share(answeredCompared.filter(r => ["Much better", "Somewhat better"].includes(r.answers.compared)).length, answeredCompared.length),
        n: answeredCompared.length },
      trustAutoApply: tallyOf(all, "trust_auto"),
      interested: { percent: share(answeredInterest.filter(r => /^Yes/.test(r.answers.interested)).length, answeredInterest.length), n: answeredInterest.length },
      pay: tallyOf(all, "fair_price"),
      frustrationRanking: frustrationRank,
      stars: { ...Object.fromEntries(RATED.map(r => [r.key, avg(by.trial.map(x => x.answers[r.key]).filter(Number.isFinite))])),
        idea_useful: avg(by.standalone.map(x => x.answers.idea_useful).filter(Number.isFinite)) },
      friendsSuggested: all.filter(r => r.answers.referral_email).length,
    },
  };
}

/** Every standalone response: { name, email, answers }. Contact details are for the export's explicit toggle only. */
export function standaloneResponses(db) {
  try {
    return db.prepare("SELECT name, email, answers, created_at, updated_at FROM standalone_surveys ORDER BY id").all()
      .map(r => ({ name: r.name, email: r.email, at: r.updated_at || r.created_at, answers: JSON.parse(r.answers || "{}") }));
  } catch { return []; }
}

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100 : null);
const median = (xs) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
