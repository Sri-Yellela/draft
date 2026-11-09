// services/outcomeMetrics.js — ⭐ D185-5 (45q, owner 11-09) · OUTCOMES AS THE NORTH STAR: interviews and offers per
// application and per active user, across draft — the number the employer pilot and the ATS partner applications lead
// with (D185 P3c (i), decisions (c) / (d)). Admin → Today → Outcomes.
//
//   · THE ANSWERS are D111's (services/callbackRates.js answerOf): job_applications.response_outcome / furthest_stage /
//     first_response_at — the person's own marks on The Table (D102's ladder) — and the D103 inbox's categories on
//     messages matched to the application, when the Inbox is set up. One vocabulary, never a third.
//   · THE DENOMINATOR is the RESOLVED application (a reply, or MATURITY_DAYS old — responseBucket): a week-old
//     application with no answer yet is in no rate, so early weeks don't read low. Withdrawn is in no count.
//   · PER ACTIVE USER: an active user in a week = a person who sent at least one application that week.
//   · ⛔ NEVER A BARE PERCENTAGE (D111's rule): every figure leaves as counts — "6 of 40" — and the Admin draws counts.
//   · WHO SENT IT: draft (semi / full auto, a pick, the extension's fill) vs recorded by hand / imported — the pitch is about
//     the applications draft sent, so they are split; and HOW WE KNOW: the inbox vs the person's own mark.
// ⛔ D17: counts only — no model, and never rejection_note.
import { answerOf } from "./callbackRates.js";

const DAY = 86400;
const WEEK = 7 * DAY;
const OFFER = "offer";

/** PURE. Monday 00:00 UTC of the week holding `sec`, as YYYY-MM-DD. */
export function weekOf(sec) {
  const d = new Date(sec * 1000);
  const dow = (d.getUTCDay() + 6) % 7;
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
  return new Date(monday).toISOString().slice(0, 10);
}

/**
 * PURE. Who sent it: 'draft' when draft's automation submitted it (applicationRecords.writeApplication writes
 * apply_mode 'AUTO' for the 'draft' method), 'self' for everything the person sent or recorded (MANUAL, a CSV import).
 */
export function sentBy(app) {
  return String(app.apply_mode || "").toUpperCase() === "AUTO" && app.source !== "csv_import" ? "draft" : "self";
}

/** PURE. How the outcome is known: the inbox (a matched employer message) or the person's own mark. */
export function knownBy(app) {
  if ((app.inboxCategories || []).length) return "inbox";
  if (app.response_outcome || app.furthest_stage || app.first_response_at) return "mark";
  return null;
}

/** PURE. One application → its counts. */
export function countsOf(app, { now }) {
  const a = answerOf({ responseOutcome: app.response_outcome ?? null, furthestStage: app.furthest_stage ?? null,
    firstResponseAt: app.first_response_at ?? null, appliedAt: app.applied_at ?? null, inboxCategories: app.inboxCategories || [] }, { now });
  const offered = a.counted && (app.response_outcome === OFFER || app.furthest_stage === OFFER || (app.inboxCategories || []).includes(OFFER));
  return { counted: a.counted, replied: a.replied, interviewed: a.interviewed, offered };
}

const blank = () => ({ sent: 0, resolved: 0, replied: 0, interviews: 0, offers: 0, activeUsers: 0, interviewedUsers: 0 });

/**
 * PURE. Rows (job_applications + inboxCategories) → the weekly series and the totals, split by who sent it.
 * @returns {{ weeks: Array<{ week, all, draft, self }>, totals: { all, draft, self }, knownBy: { inbox, mark }, ... }}
 */
export function outcomeMetrics(apps, { now = Math.floor(Date.now() / 1000), weeks = 12 } = {}) {
  const since = now - weeks * WEEK;
  const byWeek = new Map();
  const totals = { all: blank(), draft: blank(), self: blank() };
  const users = { all: new Map(), draft: new Map(), self: new Map() };   // user → interviewed?
  const known = { inbox: 0, mark: 0 };
  const weekUsers = new Map();
  for (const app of apps) {
    if (app.applied_at == null || app.applied_at < since) continue;
    const wk = weekOf(app.applied_at);
    if (!byWeek.has(wk)) byWeek.set(wk, { week: wk, all: blank(), draft: blank(), self: blank() });
    const w = byWeek.get(wk);
    const who = sentBy(app);
    const c = countsOf(app, { now });
    for (const bucket of [w.all, w[who], totals.all, totals[who]]) {
      bucket.sent += 1;
      if (c.counted) bucket.resolved += 1;
      if (c.replied) bucket.replied += 1;
      if (c.interviewed) bucket.interviews += 1;
      if (c.offered) bucket.offers += 1;
    }
    for (const k of ["all", who]) {
      const key = `${wk}|${k}`;
      if (!weekUsers.has(key)) weekUsers.set(key, new Map());
      const wu = weekUsers.get(key);
      wu.set(app.user_id, (wu.get(app.user_id) || false) || c.interviewed);
      users[k].set(app.user_id, (users[k].get(app.user_id) || false) || c.interviewed);
    }
    const kb = knownBy(app);
    if (kb && c.counted) known[kb] += 1;
  }
  for (const [key, wu] of weekUsers) {
    const [wk, k] = key.split("|");
    const b = byWeek.get(wk)[k];
    b.activeUsers = wu.size;
    b.interviewedUsers = [...wu.values()].filter(Boolean).length;
  }
  for (const k of ["all", "draft", "self"]) {
    totals[k].activeUsers = users[k].size;
    totals[k].interviewedUsers = [...users[k].values()].filter(Boolean).length;
  }
  // Every week in the window, oldest first — an empty week is a zero, not a gap.
  const series = [];
  for (let t = since + WEEK; t <= now + WEEK - 1; t += WEEK) {
    const wk = weekOf(Math.min(t, now));
    if (series.some(s => s.week === wk)) continue;
    series.push(byWeek.get(wk) || { week: wk, all: blank(), draft: blank(), self: blank() });
  }
  return { weeks: series, totals, knownBy: known, window: { weeks, since },
    rules: { resolvedMeans: "a reply, or 30 days old with none", activeUserMeans: "sent at least one application", noPercent: true } };
}

/** The reader: every application in the window + the inbox categories matched to it. `read` = { all(sql, params) }. */
export async function gatherOutcomeApps(read, { now = Math.floor(Date.now() / 1000), weeks = 12 } = {}) {
  const since = now - weeks * WEEK;
  // ⛔ D17: by name — never rejection_note, never ja.*.
  const apps = await read.all(`SELECT ja.id, ja.user_id, ja.job_id, ja.applied_at, ja.apply_mode, ja.source, ja.response_outcome,
      ja.furthest_stage, ja.first_response_at FROM job_applications ja WHERE ja.applied_at IS NOT NULL AND ja.applied_at >= ?`, [since]);
  let cats = [];
  try {
    cats = await read.all(`SELECT ar.user_id, ar.job_id, im.category FROM inbox_messages im
        JOIN application_records ar ON ar.id = im.application_id AND ar.user_id = im.user_id
       WHERE im.received_at >= ?`, [since]);
  } catch { cats = []; }   // the Inbox not set up on this database
  const byKey = new Map();
  for (const m of cats || []) {
    const k = `${m.user_id}|${m.job_id}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(m.category);
  }
  return (apps || []).map(a => ({ ...a, inboxCategories: byKey.get(`${a.user_id}|${a.job_id}`) || [] }));
}
