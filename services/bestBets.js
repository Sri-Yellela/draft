// services/bestBets.js — ⭐ D136 · BEST BETS, gathered (the rules are shared/bestBets.js).
//
//   · `bestBetsFor` — "This week's best bets": the user's own curated board (the same pages the deck and the picks read,
//     through the injected `fetchBoardPage`), the HARD FILTERS (not eligible by what the user set; "won't sponsor" for a
//     user who needs it; already drafted or applied), then every survivor scored and the top N returned with their
//     reasons. The rest of the board stays one press away — the response says how many matches there are.
//   · `bestBetSignalsFor` — one posting's signals for one user, from what is stored: the ATS report (must-haves split by
//     D123's rule, services/leanTailoring.js splitMustNice), the level read (D106) against the user's, the crawl's first
//     sighting (D107's job_history), the ghost level (D137) and the company's closings in 60 days (job_history).
//   · ⭐ P3 · `recordApplicationSignals` — when an application is SENT (services/applicationRecords.js writeApplication,
//     the one path to job_applications from a verified record), the signals it had are stored once
//     (application_signals; the first send wins). `refitBestBets` — monthly, a logistic regression of reply-or-not on
//     those signals, the newest month HELD OUT as its test; ⛔ nothing is fitted, and no chance is ever shown, before
//     CALIBRATED_MIN (500) outcomes exist. Until then the card says signals only.
// ⛔ D17: rules and arithmetic, no model.

import { bestBetOf, shortlistSize, CALIBRATED_MIN, BEST_BET_WEIGHTS } from "../shared/bestBets.js";
import { levelRank } from "../shared/postingLevel.js";
import { responseBucket } from "../shared/applicationResponse.js";
import { companyNameKey } from "../shared/companyIdentity.js";
import { splitMustNice } from "./leanTailoring.js";
import { userLevelFor } from "./picks.js";
import { userEligibilityInputs, eligibilityForJob, hasEligibilityInputs } from "./jobEligibility.js";
import { getSetting, setSetting } from "./appSettings.js";
import { aimRoleFor } from "./navigator.js";
import { warmCounts } from "./warmPaths.js";

import { fullReport } from "./atsReportRead.js";   // A187 Stage 0 (46i)
const DAY = 86400;
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
export const MAX_BOARD_PAGES = 4;
export const FIT_KEY = "best_bet_fit";
export const SIGNAL_KEYS = Object.freeze(["mustHaves", "level", "freshness", "ghost", "velocity"]);

/** One company's closings in the last 60 days and how long draft has watched it (job_history). */
// ⛔ A126 (hotfix 11-05, measured by a CPU profile): this read walks every job_history row of the company, once PER CARD —
// up to 200 cards a call, most from a few large employers — ≈ 3 s of the event loop per /api/best-bets on an 18k board.
// A company's 60-day closings move with a crawl, not with a request: kept per company for VELOCITY_TTL_SEC.
export const VELOCITY_TTL_SEC = 600;
const velocityCache = new Map();
function velocityOf(db, company, now) {
  const key = companyNameKey(company || "");
  if (!key) return null;
  const hit = velocityCache.get(key);
  if (hit && hit.db === db && Math.abs(now - hit.at) < VELOCITY_TTL_SEC) return hit.value;
  const r = safe(() => db.prepare(`SELECT MIN(first_seen) AS first, SUM(CASE WHEN closed_at >= ? THEN 1 ELSE 0 END) AS closed60
      FROM job_history WHERE company_key = ?`).get(now - 60 * DAY, key), null);
  const value = velocityValue(r, now);
  if (velocityCache.size > 20000) velocityCache.clear();
  velocityCache.set(key, { db, at: now, value });
  return value;
}

const velocityValue = (r, now) => (r?.first ? { watchedDays: Math.floor((now - r.first) / DAY), closed60: r.closed60 ?? 0 } : null);
const VELOCITY_WARM_CHUNK = 400;   // bound parameters per IN list (SQLite's default limit is far above this)

/**
 * ⛔ D151 (A126's pattern) · the velocity cache, filled for a page of postings' companies in ONE grouped read per chunk,
 * through `read` — server.js hands the read-worker pool (services/db/readWorker.js), so the cold-cache walk of every
 * job_history row of every company on a best-bets call (measured: the "best-bets' first call" left on the loop after
 * A126 (2)) runs off the event loop. Without `read` (tests, scripts) it reads `db` directly, as readerOf does.
 * ⭐ NEVER FAILS CLOSED: a read that rejects warms nothing, and velocityOf then reads each company itself, as before.
 * The values are velocityOf's exactly (the same columns, the same 60-day window, a company with no history → null).
 * @returns {Promise<number>} companies warmed
 */
export async function warmVelocity(db, companies, { read = null, now = Math.floor(Date.now() / 1000) } = {}) {
  const keys = [...new Set((companies || []).map(c => companyNameKey(c || "")).filter(Boolean))].filter(k => {
    const hit = velocityCache.get(k);
    return !(hit && hit.db === db && Math.abs(now - hit.at) < VELOCITY_TTL_SEC);
  });
  if (!keys.length) return 0;
  const reader = read ?? { all: async (sql, params = []) => db.prepare(sql).all(...params) };
  let warmed = 0;
  for (let i = 0; i < keys.length; i += VELOCITY_WARM_CHUNK) {
    const chunk = keys.slice(i, i + VELOCITY_WARM_CHUNK);
    let rows;
    try {
      rows = await reader.all(`SELECT company_key AS k, MIN(first_seen) AS first, SUM(CASE WHEN closed_at >= ? THEN 1 ELSE 0 END) AS closed60
          FROM job_history WHERE company_key IN (${chunk.map(() => "?").join(",")}) GROUP BY company_key`, [now - 60 * DAY, ...chunk]);
    } catch { return warmed; }
    const got = new Map((rows || []).map(r => [r.k, r]));
    if (velocityCache.size + chunk.length > 20000) velocityCache.clear();
    for (const k of chunk) velocityCache.set(k, { db, at: now, value: velocityValue(got.get(k), now) });
    warmed += chunk.length;
  }
  return warmed;
}

// One loop turn handed back between cards: up to 200 cards × a handful of indexed reads each is short, but it is not
// one stretch — a health check or another person's request is served between them.
const BREATHE_EVERY = 25;
const breathe = () => new Promise(resolve => setImmediate(resolve));

/**
 * One posting's signals for one user.
 * @param job a scraped_jobs row (description, company, level_read, ghost_level, discovered_at …) — or a board job
 *            carrying `id`; the row is read when the text is not on it.
 */
export function bestBetSignalsFor(db, { userId, profileId = null, job, userLevel = undefined, inputs = null, aim = undefined, warm = undefined, now = Math.floor(Date.now() / 1000) }) {
  const jobId = String(job?.job_id ?? job?.id ?? job?.jobId);
  const row = job?.description != null && job?.job_id != null ? job
    : safe(() => db.prepare(`SELECT * FROM scraped_jobs WHERE job_id = ?`).get(jobId), null) ?? {};
  const eligInputs = inputs ?? safe(() => userEligibilityInputs(db, userId), { defaults: {}, degrees: [] });
  const elig = safe(() => eligibilityForJob(db, userId, jobId, eligInputs), null);
  const report = safe(() => fullReport(db.prepare(`SELECT ats_report FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND job_id = ?
      ORDER BY id DESC LIMIT 1`).get(userId, profileId, jobId)?.ats_report || "null", { userId, profileId, jobId }), null);   // A187: a slim row expanded
  const score = safe(() => db.prepare(`SELECT ats_score FROM ats_only_reports WHERE user_id = ? AND domain_profile_id IS ? AND job_id = ?
      ORDER BY id DESC LIMIT 1`).get(userId, profileId, jobId)?.ats_score, null);
  let mustHaves = null;
  if (report && (report.tier1_matched?.length || report.tier1_missing?.length)) {
    const matched = report.tier1_matched || [], missing = report.tier1_missing || [];
    const { must } = splitMustNice(row, [...matched, ...missing]);
    const have = new Set(matched.map(t => String(t).toLowerCase()));
    if (must.length) mustHaves = { have: must.filter(t => have.has(String(t).toLowerCase())).length, total: must.length };
  }
  const uLevel = userLevel === undefined ? safe(() => userLevelFor(db, userId), null) : userLevel;
  const asked = levelRank(row.level_read ?? null);
  const first = safe(() => db.prepare(`SELECT first_seen FROM job_history WHERE job_id = ?`).pluck().get(jobId), null)
    ?? (Number.isFinite(row.discovered_at) ? row.discovered_at : null);
  return {
    // "you're eligible" only when the user SET something a requirement could contradict, and nothing does.
    eligible: elig?.status === "eligible" && safe(() => hasEligibilityInputs(eligInputs), false),
    ineligible: elig?.status === "ineligible",
    mustHaves,
    atsScore: Number.isFinite(score) ? score : null,
    levelGap: uLevel != null && asked != null ? asked - uLevel : null,
    hoursSinceFirstSeen: Number.isFinite(first) ? Math.max(0, (now - first) / 3600) : null,
    ghostLevel: row.ghost_level ?? 0,
    velocity: velocityOf(db, row.company, now),
    // ⭐ D138: people the user knows at the company (their own LinkedIn export / alumni list).
    warmPath: (() => {
      const counts = warm === undefined ? safe(() => warmCounts(db, userId), new Map()) : warm;
      const n = counts?.get?.(companyNameKey(row.company || "")) || 0;
      return n ? { text: `${n} ${n === 1 ? "person" : "people"} you know work${n === 1 ? "s" : ""} there` } : null;
    })(),
    // ⭐ D143: the posting's role (the one matcher's, atlas_posting_match) is the user's navigator destination.
    aim: (() => {
      const a = aim === undefined ? safe(() => aimRoleFor(db, userId), null) : aim;
      if (!a) return null;
      const roleId = safe(() => db.prepare(`SELECT pm.role_id FROM atlas_posting_match pm JOIN scraped_jobs sj ON sj.id = pm.posting_id WHERE sj.job_id = ?`).pluck().get(jobId), null);
      return roleId != null && roleId === a.roleId ? { text: `on your route to ${a.name}` } : null;
    })(),
  };
}

/**
 * "This week's best bets".
 * @param deps { userId, profileId, size, fetchBoardPage(cursor) → { ok, jobs, nextCursor, total? }, now }
 * @returns {{ size, considered, matches, bets: [{ job, bestBet }], calibrated: false }}
 */
export async function bestBetsFor(db, { userId, profileId = null, size = undefined, fetchBoardPage, read = null, now = Math.floor(Date.now() / 1000) }) {
  const want = shortlistSize(size);
  const inputs = safe(() => userEligibilityInputs(db, userId), { defaults: {}, degrees: [] });
  const needsSponsorship = inputs.defaults?.sponsorship_now === "yes" || inputs.defaults?.sponsorship_later === "yes";
  const done = new Set(safe(() => db.prepare(`SELECT job_id FROM application_records WHERE user_id = ? AND state != 'withdrawn'
      UNION SELECT job_id FROM job_applications WHERE user_id = ?`).pluck().all(userId, userId), []).map(String));
  const userLevel = safe(() => userLevelFor(db, userId), null);
  const aim = safe(() => aimRoleFor(db, userId), null);
  const warm = safe(() => warmCounts(db, userId), new Map());
  const jobs = [];
  let cursor = null, matches = null;
  for (let p = 0; p < MAX_BOARD_PAGES; p++) {
    const page = await fetchBoardPage(cursor);
    if (!page?.ok) break;
    if (matches == null && Number.isFinite(page.total)) matches = page.total;
    jobs.push(...(page.jobs || []));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  // D151 · the companies' velocity in one grouped read through the pool (off the loop) before the per-card pass.
  await warmVelocity(db, jobs.map(j => j.company), { read, now });
  const scored = [];
  let unscored = 0;
  for (const [i, j] of jobs.entries()) {
    if (i && i % BREATHE_EVERY === 0) await breathe();
    const id = String(j.id ?? j.job_id);
    if (done.has(id)) continue;                                                     // already drafted or applied
    if (j.isActive === false) continue;                                             // closed
    if (j.eligibility?.status === "ineligible") continue;                           // D104: what the user SET
    if (needsSponsorship && j.sponsorship?.level === "says_no") continue;           // D121: won't sponsor
    const s = bestBetSignalsFor(db, { userId, profileId, job: { id }, userLevel, inputs, aim, warm, now });
    if (s.ineligible) continue;
    const bet = bestBetOf(s);
    if (bet.score == null) { unscored++; continue; }               // its fit is not known yet — never ranked on freshness alone
    scored.push({ job: j, bestBet: bet, i });
  }
  scored.sort((a, b) => b.bestBet.score - a.bestBet.score || a.i - b.i);
  return { size: want, considered: jobs.length, matches: matches ?? jobs.length, calibrated: false, unscored,
    ...(!scored.length && unscored ? { reason: "scoring" } : {}),
    bets: scored.slice(0, want).map(({ job, bestBet }) => ({ job, bestBet })) };
}

/** Each signal's share of its weight (0–1), or null when it was unknown — the regression's features. */
export function signalShares(bet) {
  const out = {};
  for (const k of SIGNAL_KEYS) out[k] = bet.points?.[k] == null ? null : bet.points[k] / BEST_BET_WEIGHTS[k];
  return out;
}

/** ⭐ P3 · the signals an application had when it was sent — stored once, the first send wins. */
export function recordApplicationSignals(db, { userId, jobId, now = Math.floor(Date.now() / 1000) }) {
  const profileId = safe(() => db.prepare("SELECT id FROM domain_profiles WHERE user_id=? AND is_active=1 ORDER BY id DESC LIMIT 1").pluck().get(userId), null);
  const s = bestBetSignalsFor(db, { userId, profileId, job: { id: jobId }, now });
  const bet = bestBetOf(s);
  return db.prepare(`INSERT INTO application_signals (user_id, job_id, signals_json, score, recorded_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, job_id) DO NOTHING`).run(userId, String(jobId), JSON.stringify({ shares: signalShares(bet), signals: s }), bet.score, now).changes > 0;
}

/** Recorded signals joined to how each application ended: [{ x: number[], y: 0|1, sentAt }] (unresolved left out). */
export function outcomeRows(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const rows = safe(() => db.prepare(`SELECT s.signals_json, s.recorded_at, a.applied_at, a.response_outcome, a.first_response_at
      FROM application_signals s JOIN job_applications a ON a.user_id = s.user_id AND a.job_id = s.job_id`).all(), []);
  const out = [];
  for (const r of rows) {
    const b = responseBucket(r, { now });
    if (b === "unresolved") continue;
    const shares = safe(() => JSON.parse(r.signals_json).shares, null);
    if (!shares) continue;
    // An unknown signal sits at the middle (0.5) — it neither helps nor hurts the fit.
    out.push({ x: SIGNAL_KEYS.map(k => (shares[k] == null ? 0.5 : shares[k])), y: b === "responded" ? 1 : 0, sentAt: r.applied_at ?? r.recorded_at });
  }
  return out;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
function fitLogistic(rows, { iters = 2000, rate = 0.5, l2 = 0.01 } = {}) {
  const k = SIGNAL_KEYS.length;
  let w = new Array(k).fill(0), b = 0;
  for (let it = 0; it < iters; it++) {
    const gw = new Array(k).fill(0); let gb = 0;
    for (const r of rows) {
      const e = sigmoid(b + r.x.reduce((a, x, i) => a + x * w[i], 0)) - r.y;
      for (let i = 0; i < k; i++) gw[i] += e * r.x[i];
      gb += e;
    }
    for (let i = 0; i < k; i++) w[i] -= rate * (gw[i] / rows.length + l2 * w[i]);
    b -= rate * gb / rows.length;
  }
  return { w, b };
}
const predict = (m, x) => sigmoid(m.b + x.reduce((a, v, i) => a + v * m.w[i], 0));
function logLoss(m, rows) {
  if (!rows.length) return null;
  return rows.reduce((a, r) => { const p = Math.min(1 - 1e-9, Math.max(1e-9, predict(m, r.x))); return a - (r.y ? Math.log(p) : Math.log(1 - p)); }, 0) / rows.length;
}

/**
 * ⭐ P3 · monthly: fit reply-or-not on the recorded signals, the newest 30 days of sends held out as the test.
 * ⛔ Below CALIBRATED_MIN outcomes nothing is fitted or stored. @returns {{ ready, outcomes, ... }}
 */
export function refitBestBets(db, { now = Math.floor(Date.now() / 1000), rows = null } = {}) {
  const all = rows ?? outcomeRows(db, { now });
  if (all.length < CALIBRATED_MIN) return { ready: false, outcomes: all.length, needed: CALIBRATED_MIN };
  const cut = Math.max(...all.map(r => r.sentAt)) - 30 * DAY;
  const train = all.filter(r => r.sentAt < cut), test = all.filter(r => r.sentAt >= cut);
  if (!train.length || !test.length) return { ready: false, outcomes: all.length, needed: CALIBRATED_MIN, reason: "no_holdout_month" };
  const m = fitLogistic(train);
  const base = train.reduce((a, r) => a + r.y, 0) / train.length;
  const baseline = { w: new Array(SIGNAL_KEYS.length).fill(0), b: Math.log(Math.max(1e-9, base) / Math.max(1e-9, 1 - base)) };
  const fit = { at: now, outcomes: all.length, train: train.length, test: test.length, keys: SIGNAL_KEYS, w: m.w, b: m.b,
    testLogLoss: logLoss(m, test), baselineLogLoss: logLoss(baseline, test) };
  // Kept only when it beats "everyone gets the average reply rate" on the held-out month.
  fit.used = fit.testLogLoss < fit.baselineLogLoss;
  setSetting(db, FIT_KEY, JSON.stringify(fit));
  return { ready: true, ...fit };
}

/** The calibrated chance of a reply for one bet — null until a fit exists, used, over ≥ CALIBRATED_MIN outcomes. */
export function calibratedChance(db, bet) {
  const fit = safe(() => JSON.parse(getSetting(db, FIT_KEY) || "null"), null);
  if (!fit?.used || !(fit.outcomes >= CALIBRATED_MIN)) return null;
  const shares = signalShares(bet);
  return predict(fit, SIGNAL_KEYS.map(k => (shares[k] == null ? 0.5 : shares[k])));
}
