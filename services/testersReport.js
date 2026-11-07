// services/testersReport.js — ⭐ D131 · Admin → Testers: the trial and both surveys as ONE readable page, built for the
// application (owner 11-01, sketch `docs/sketches/draft admin — testers.html`: "this is what im talking about").
//
// Read-only over what D124 / D129 / D130 already store — no new collection. Every figure carries its count; a
// percentage is shown only once that question has ≥ 20 answers (P2, the small-number rule). The owner's own walks and
// test accounts are left out by default (P1): an admin row, an account tagged `internal` or `test` in People, and a
// standalone answer whose email is one of those accounts' or an admin's. No names on the page; the export carries names
// and emails only when asked (?contact=1, owner 11-02).

import { SURVEY, STANDALONE_SURVEY, RATED, MID_MINUTES, MID_PER_WEEK } from "./survey.js";
import { HIDDEN_TAGS } from "./userAdmin.js";
import { TOUR_STEPS } from "../shared/trialTour.js";
import { retentionNote } from "./testingRecords.js";

/** Owner 11-02: a tester whose last trial event is this recent is "still going", not one who left. */
export const STILL_GOING_SECONDS = 30 * 60;
const STEP_TITLE = Object.fromEntries(TOUR_STEPS.map(s => [s.id, s.title]));
const STEP_ORDER = Object.fromEntries(TOUR_STEPS.map((s, i) => [s.id, i]));

export const SMALL_N = 20;
// "Since the invites (Nov 1)": midnight 2026-11-01, US Eastern (the owner's invites went out that day).
export const INVITES_AT = Math.floor(Date.UTC(2026, 10, 1, 4) / 1000);
export const PERIODS = Object.freeze({ invites: "Since the invites (Nov 1)", day: "Last 24 hours", all: "All time" });
export const SOURCES = Object.freeze({ all: "Both surveys", trial: "Tried the app", standalone: "Survey only" });

const Q = (key, list = SURVEY) => list.find(q => q.key === key);
const median = (xs) => { if (!xs.length) return null; const v = [...xs].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const avg1 = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 10) / 10 : null);

/** "21 of 34" until a question has 20 answers, then "62%". n = 0 → "—". */
export function shareText(k, n) {
  if (!n) return "—";
  return n >= SMALL_N ? `${Math.round(100 * k / n)}%` : `${k} of ${n}`;
}

function sinceOf(period, now) {
  if (period === "day") return now - 86400;
  if (period === "all") return 0;
  return INVITES_AT;
}

/** The accounts and emails left out: admins, accounts tagged internal / test, and admin-account emails. */
export function excludedSets(db) {
  const ids = new Set(), emails = new Set();
  const tags = HIDDEN_TAGS.map(() => "?").join(", ");
  try {
    for (const r of db.prepare(`SELECT u.id, lower(p.email) email FROM users u LEFT JOIN user_profile p ON p.user_id = u.id
      WHERE COALESCE(u.is_admin, 0) = 1 OR EXISTS (SELECT 1 FROM user_tags t WHERE t.user_id = u.id AND t.tag IN (${tags}))`).all(...HIDDEN_TAGS)) {
      ids.add(r.id); if (r.email) emails.add(r.email);
    }
  } catch { /* before the tags migration */ }
  try { for (const r of db.prepare("SELECT lower(email) email FROM admin_accounts").all()) emails.add(r.email); } catch { /* before D95 */ }
  return { ids, emails };
}

function tally(rows, q) {
  const counts = new Map(q.options.map(o => [o, 0]));
  let n = 0;
  for (const r of rows) {
    const v = r.answers[q.key];
    if (v == null || !counts.has(v)) continue;
    counts.set(v, counts.get(v) + 1); n++;
  }
  return { key: q.key, question: q.q, n, bars: [...counts].map(([label, k]) => ({ label, n: k })) };
}
const ranked = (t) => ({ ...t, bars: [...t.bars].sort((a, b) => b.n - a.n) });
const countOf = (rows, key, pred) => {
  const answered = rows.filter(r => r.answers[key] != null);
  return { k: answered.filter(r => pred(r.answers[key])).length, n: answered.length };
};

/**
 * The page's data.
 * @param opts { period: invites | day | all, source: all | trial | standalone, exclude: boolean, now }
 */
export function testersReport(db, { period = "invites", source = "all", exclude = true, now = Math.floor(Date.now() / 1000) } = {}) {
  if (!PERIODS[period]) period = "invites";
  if (!SOURCES[source]) source = "all";
  const since = sinceOf(period, now);
  const ex = exclude ? excludedSets(db) : { ids: new Set(), emails: new Set() };
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };

  // ── the trial cohort: accounts that entered the trial in the period ──
  const cohortAll = all(`SELECT id, created_at, trial_at, trial_resume FROM users WHERE trial_at IS NOT NULL AND trial_at >= ?`, since);
  const cohort = cohortAll.filter(u => !ex.ids.has(u.id));
  const ids = new Set(cohort.map(u => u.id));
  // The trial's own Draft count (services/draftSlots.js draftsUsed): a cancelled row, or one superseded by an answers
  // retry, is not a Draft — counting them made "Drafted" read higher than the testers saw.
  const drafted = new Map(all(`SELECT rj.user_id, COUNT(DISTINCT rj.job_id) n FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id
    WHERE COALESCE(r.approval_mode, '') != 'approved' AND rj.status <> 'cancelled' AND NOT (rj.status = 'superseded' AND rj.approved_at IS NULL)
    GROUP BY rj.user_id`).map(r => [r.user_id, r.n]));
  const surveysByUser = new Map(all(`SELECT user_id, answers, created_at FROM trial_surveys`).filter(r => ids.has(r.user_id)).map(r => [r.user_id, r]));

  const parse = (s) => { try { return JSON.parse(s || "{}") || {}; } catch { return {}; } };
  const trialRows = [...surveysByUser.values()].map(r => ({ source: "trial", userId: r.user_id, at: r.created_at, answers: parse(r.answers) }));
  const saAll = all(`SELECT email, answers, created_at FROM standalone_surveys WHERE created_at >= ?`, since);
  const saRows = saAll.filter(r => !ex.emails.has(String(r.email || "").toLowerCase()))
    .map(r => ({ source: "standalone", at: r.created_at, answers: parse(r.answers) }));
  const excluded = { accounts: cohortAll.length - cohort.length, surveys: saAll.length - saRows.length };

  const rows = source === "trial" ? trialRows : source === "standalone" ? saRows : [...trialRows, ...saRows];
  const tried = source === "standalone" ? 0 : cohort.length;
  const people = tried + (source === "trial" ? 0 : saRows.length);

  // ── P3 · the headline ──
  const hours = rows.map(r => (MID_MINUTES[r.answers.time_per_app] != null && MID_PER_WEEK[r.answers.apps_per_week] != null
    ? MID_MINUTES[r.answers.time_per_app] * MID_PER_WEEK[r.answers.apps_per_week] / 60 : null)).filter(x => x != null);
  const hoursMedian = hours.length ? Math.round(median(hours) * 10) / 10 : null;
  const paid = countOf(rows, "paid_before", v => v !== "No, never");
  const better = countOf(rows.filter(r => r.source === "trial"), "compared", v => v === "Much better" || v === "Somewhat better");
  const interest = countOf(rows, "interested", v => /^Yes/.test(v));
  const trust = countOf(rows, "trust_auto", v => v === "Yes, I'd let it send on its own" || v === "Yes, after I've checked the first few");
  const pay = countOf(rows, "fair_price", v => ["$10 to $20 a month", "$20 to $40 a month", "More than $40 a month"].includes(v));
  const frus = ranked(tally(rows, Q("frustration")));
  const top = frus.bars[0]?.n ? frus.bars[0] : null;
  const card = (key, label, big, what, frac, sentence, n) => ({ key, label, big, what, frac: frac == null ? null : Math.max(0, Math.min(1, frac)), sentence: n ? sentence : null, n });
  const pc = (c) => (c.n ? c.k / c.n : null);
  const headline = [
    card("people", "People", String(people), `${tried} tried the app · ${source === "trial" ? 0 : saRows.length} answered the survey only`, 1,
      `${people} ${people === 1 ? "person" : "people"} tried draft or answered our survey${period === "invites" ? " in the first days" : ""}.`, people),
    card("hours", "Hours a week applying", hoursMedian == null ? "—" : String(hoursMedian), `median · time per good application × applications a week (band midpoints), ${hours.length} answers`, null,
      `Job seekers we asked spend about ${hoursMedian} hours a week on applications (median of ${hours.length}).`, hours.length),
    card("paid", "Already pay for job-search help", shareText(paid.k, paid.n), "résumé writers, LinkedIn Premium, courses, tools", pc(paid),
      `${shareText(paid.k, paid.n)} have already paid for job-search help.`, paid.n),
    card("better", "Say draft beats how they apply now", shareText(better.k, better.n), "much or somewhat better · tried the app only", pc(better),
      `${shareText(better.k, better.n)} of those who tried it said it beats how they apply today.`, better.n),
    card("interested", "Interested in using it", shareText(interest.k, interest.n), "as soon as they can, or when they start looking", pc(interest),
      `${shareText(interest.k, interest.n)} want to use it for their job search.`, interest.n),
    card("trust", "Would let draft send for them", shareText(trust.k, trust.n), "on its own, or after checking the first few", pc(trust),
      `${shareText(trust.k, trust.n)} would let draft send applications for them.`, trust.n),
    card("pay", "Would pay $10 or more a month", shareText(pay.k, pay.n), "after reading what draft does", pc(pay),
      `${shareText(pay.k, pay.n)} said $10 a month or more feels fair.`, pay.n),
    card("frustration", "Biggest frustration", top ? top.label : "—", top ? `${top.n} of ${frus.n} chose it` : "no answers yet", top ? top.n / frus.n : null,
      top ? `The top frustration: “${top.label.toLowerCase()}” (${top.n} of ${frus.n}).` : null, frus.n),
  ];

  // ── P4 · how far people got (the trial) ──
  const surveyed = cohort.filter(u => surveysByUser.has(u.id));
  // ⭐ Owner 11-02 ("−18 left here … we need to understand how they left, or if they're stuck"): each drop-off is the
  // PEOPLE who reached the step before and not this one, broken down — still going (an event in the last 30 min), the
  // furthest tour step each reached, and how many met an error. A bare count said nothing about why.
  const activity = all(`SELECT user_id, event, detail, created_at FROM trial_events`).filter(e => ids.has(e.user_id));
  const lastAt = new Map(), furthest = new Map(), errored = new Set();
  for (const e of activity) {
    lastAt.set(e.user_id, Math.max(lastAt.get(e.user_id) || 0, e.created_at || 0));
    if (e.event === "error") errored.add(e.user_id);
    if (e.event !== "tour") continue;
    let step = null; try { step = JSON.parse(e.detail || "{}").step; } catch { step = null; }
    if (step in STEP_ORDER && STEP_ORDER[step] >= (STEP_ORDER[furthest.get(e.user_id)] ?? -1)) furthest.set(e.user_id, step);
  }
  const whyLeft = (users) => {
    const going = new Set(users.filter(u => now - (lastAt.get(u.id) || u.trial_at || 0) < STILL_GOING_SECONDS).map(u => u.id));
    const at = new Map();
    for (const u of users) {
      if (going.has(u.id)) continue;
      const id = furthest.get(u.id);
      const label = id ? `stopped at “${STEP_TITLE[id]}”` : lastAt.has(u.id) ? "stopped before the tour began" : "nothing recorded after signing up";
      at.set(label, (at.get(label) || 0) + 1);
    }
    return { stillGoing: going.size, errored: users.filter(u => errored.has(u.id)).length,
      stoppedAt: [...at].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)) };
  };
  const reached = [
    ["Signed up", () => true],
    ["Picked a résumé", u => !!u.trial_resume],
    ["Drafted the 1st job", u => (drafted.get(u.id) || 0) >= 1],
    ["Drafted the 2nd job", u => (drafted.get(u.id) || 0) >= 2],
    ["Answered the survey", u => surveysByUser.has(u.id)],
  ];
  const steps = reached.map(([label, has], i) => {
    const n = cohort.filter(has).length;
    if (!i) return { label, n, left: 0, why: null };
    const leavers = cohort.filter(u => reached[i - 1][1](u) && !has(u));
    return { label, n, left: leavers.length, why: leavers.length ? whyLeft(leavers) : null };
  });
  const minutes = surveyed.map(u => (surveysByUser.get(u.id).created_at - (u.created_at || u.trial_at)) / 60).filter(m => m >= 0);
  const evs = all(`SELECT user_id, event, detail FROM trial_events WHERE event IN ('page', 'locked') AND created_at >= ?`, since).filter(e => ids.has(e.user_id));
  const pageUsers = new Map(), locked = new Map();
  for (const e of evs) {
    if (e.event === "page") { const p = String(e.detail || "").slice(0, 80); if (p) { if (!pageUsers.has(p)) pageUsers.set(p, new Set()); pageUsers.get(p).add(e.user_id); } }
    else { let f = null; try { f = JSON.parse(e.detail || "{}").feature; } catch { f = null; } f = String(f || "something").slice(0, 80); locked.set(f, (locked.get(f) || 0) + 1); }
  }
  const funnel = {
    steps, medianMinutes: minutes.length ? Math.round(median(minutes) * 10) / 10 : null,
    pages: [...pageUsers].map(([label, s]) => ({ label, n: s.size })).sort((a, b) => b.n - a.n).slice(0, 12),
    locked: [...locked].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n).slice(0, 12),
  };

  // ── P5–P7 ──
  const trialOnly = rows.filter(r => r.source === "trial"), saOnly = rows.filter(r => r.source === "standalone");
  const who = [tally(rows, Q("search_stage")), tally(rows, Q("field"))];
  const problem = [tally(rows, Q("time_per_app")), tally(rows, Q("apps_per_week")), frus, ranked(tally(rows, Q("find_tool"))), tally(rows, Q("paid_before"))];
  const stars = [
    ...RATED.map(r => { const xs = trialOnly.map(x => x.answers[r.key]).filter(Number.isFinite); return { label: r.label, average: avg1(xs), n: xs.length, only: "trial" }; }),
    (() => { const xs = saOnly.map(x => x.answers.idea_useful).filter(Number.isFinite); return { label: "The idea (survey only)", average: avg1(xs), n: xs.length, only: "standalone" }; })(),
  ].filter(s => (source === "trial" ? s.only === "trial" : source === "standalone" ? s.only === "standalone" : true));
  const thought = [
    ...(source === "standalone" ? [] : [{ ...tally(trialOnly, Q("compared")), only: "trial" }]),
    tally(rows, Q("trust_auto")), tally(rows, Q("interested")), tally(rows, Q("fair_price")),
    ...(source === "standalone" ? [] : [{ ...ranked(tally(trialOnly, Q("most_helpful"))), only: "trial" }]),
    ...(source === "trial" ? [] : [{ ...ranked(tally(saOnly, Q("idea_most_helpful", STANDALONE_SURVEY))), only: "standalone" }]),
  ];

  // ── P8 · their own words — no names, tagged source · field · the star they gave ──
  const TEXT_KEYS = [["must_have", null, "must-have"], ["interested_why", null, "what would change their mind"],
    ["frustration_other", null, "frustration"], ...RATED.map(r => [`${r.key}_why`, r.key, `5 stars for ${r.label.toLowerCase()}`]),
    ["idea_useful_why", "idea_useful", "5 stars for the idea"]];
  const quotes = [];
  for (const r of rows) {
    for (const [k, starKey, about] of TEXT_KEYS) {
      const t = r.answers[k];
      if (typeof t !== "string" || !t.trim()) continue;
      quotes.push({ text: t.trim(), source: r.source === "trial" ? "Tried the app" : "Survey only", field: r.answers.field || null,
        stars: starKey && Number.isFinite(r.answers[starKey]) ? r.answers[starKey] : null, about, at: r.at });
    }
  }
  if (source !== "standalone") {
    for (const f of all(`SELECT user_id, screen, body, created_at FROM trial_feedback WHERE created_at >= ?`, since)) {
      if (!ids.has(f.user_id) || !String(f.body || "").trim()) continue;
      quotes.push({ text: String(f.body).trim(), source: "Tried the app", field: surveysByUser.has(f.user_id) ? parse(surveysByUser.get(f.user_id).answers).field || null : null,
        stars: null, about: `feedback note${f.screen ? ` on ${f.screen}` : ""}`, at: f.created_at });
    }
  }
  quotes.sort((a, b) => (b.at || 0) - (a.at || 0));

  const answers = rows.length;
  return {
    period, periodLabel: PERIODS[period], source, sourceLabel: SOURCES[source], exclude, excluded, since,
    answers, people, tried, surveyOnly: source === "trial" ? 0 : saRows.length,
    small: answers < SMALL_N,
    headline, funnel, who, problem, stars, thought, quotes: quotes.map(({ at, ...q }) => q),
    retention: retentionNote(db),   // owner 11-07: older activity / feedback is no longer available, and says so
    copyText: headline.filter(h => h.sentence).map(h => h.sentence).join("\n"),
  };
}

/**
 * The responses as CSV — by default NO names, NO emails (the referral email and the standalone contact are left out).
 * Owner 11-02: `contact: true` adds each person's name and email as the first two columns (admin-only download).
 */
export function testersCsv(db, opts = {}) {
  const r = testersReportRows(db, opts);
  const keys = [...new Set([...SURVEY, ...STANDALONE_SURVEY].filter(q => q.type !== "email" && q.key !== "name")
    .flatMap(q => (q.follow ? [q.key, q.follow.key] : [q.key])))];
  const cell = (v) => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const who = (x) => (opts.contact ? [x.name, x.email] : []);
  return [[...(opts.contact ? ["name", "email"] : []), "source", "answered_at", ...keys].join(","),
    ...r.map(x => [...who(x), x.source, new Date(x.at * 1000).toISOString(), ...keys.map(k => x.answers[k])].map(cell).join(","))].join("\n") + "\n";
}

function testersReportRows(db, { period = "invites", source = "all", exclude = true, now = Math.floor(Date.now() / 1000) } = {}) {
  const since = sinceOf(PERIODS[period] ? period : "invites", now);
  const ex = exclude ? excludedSets(db) : { ids: new Set(), emails: new Set() };
  const parse = (s) => { try { return JSON.parse(s || "{}") || {}; } catch { return {}; } };
  const all = (sql, ...a) => { try { return db.prepare(sql).all(...a); } catch { return []; } };
  const trial = source === "standalone" ? [] : all(`SELECT s.user_id, s.answers, s.created_at,
      TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name, p.email
    FROM trial_surveys s JOIN users u ON u.id = s.user_id LEFT JOIN user_profile p ON p.user_id = u.id
    WHERE u.trial_at IS NOT NULL AND u.trial_at >= ?`, since).filter(r => !ex.ids.has(r.user_id))
    .map(r => ({ source: "trial", at: r.created_at, answers: parse(r.answers), name: r.name || "", email: r.email || "" }));
  const sa = source === "trial" ? [] : all(`SELECT name, email, answers, created_at FROM standalone_surveys WHERE created_at >= ?`, since)
    .filter(r => !ex.emails.has(String(r.email || "").toLowerCase()))
    .map(r => ({ source: "standalone", at: r.created_at, answers: parse(r.answers), name: r.name || "", email: r.email || "" }));
  return [...trial, ...sa].sort((a, b) => a.at - b.at);
}
