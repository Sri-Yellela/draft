// services/jobs/ghostScore.js — ⭐ D137 · THE GHOST SCORE, gathered and stored (the rules are shared/ghostScore.js).
//
//   · `scoreGhosts` — a rollup after D107's recordJobHistory (the 04:00 crawl tick and the cleanup that runs at boot):
//     every active posting's signals from what is already stored — job_history (age, reposts, the same text in many
//     locations, the company's closings), job_applications (people who marked "no reply in 30 days", silent and
//     answered applications) and the D103 inbox's replies — through ghostScoreOf. It writes scraped_jobs.ghost_level
//     (the board's order and the "Hide likely not hiring" filter read the column) and job_ghost (the evidence the
//     card and the posting show). ⛔ It never deactivates, deletes or hides a row.
//   · job_ghost.flagged_at is the FIRST time a posting reached "Likely not hiring" and is never cleared — so the
//     calibration can ask what happened to applications sent AFTER the flag, even once a reply has moved the level.
//   · `calibrateGhostThreshold` — monthly: among postings flagged, the share whose later applications got a reply.
//     At ≥ 1 in 20 (over at least CALIBRATION_MIN postings) the "Likely not hiring" cut RISES by one point (app
//     setting `ghost_not_hiring_min`); it never falls on its own. The measure is kept in `ghost_calibration`.
// ⛔ D17: rules and arithmetic, no model.

import { ghostScoreOf, GHOST_LEVEL, GHOST_LABELS, GHOST_THRESHOLDS } from "../../shared/ghostScore.js";
import { responseBucket, RESPONSE_OUTCOME } from "../../shared/applicationResponse.js";
import { livenessOf, signatureSimilarity } from "./jobHistory.js";
import { getSetting, setSetting } from "../appSettings.js";

const DAY = 86400;
export const NOT_HIRING_KEY = "ghost_not_hiring_min";
export const CALIBRATION_KEY = "ghost_calibration";
export const CALIBRATION_MIN = 20;
export const CALIBRATION_MAX_RATE = 1 / 20;
export const CALIBRATION_EVERY_DAYS = 28;
/** Two descriptions this alike are the same text posted twice (D107's repost bar is 0.6 — a copy is closer). */
const SAME_TEXT = 0.9;
const REPLY_CATEGORIES = ["interview", "assessment", "offer", "rejection"];

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

/** The "Likely not hiring" cut in force: the calibrated setting, never below the file's own. */
export function currentNotHiringMin(db) {
  const v = Number(getSetting(db, NOT_HIRING_KEY));
  return Number.isFinite(v) && v > GHOST_THRESHOLDS.notHiringMin ? v : GHOST_THRESHOLDS.notHiringMin;
}

/** Per company_key: how long draft has watched it, how many of its postings are open, how many it closed in 90 days. */
export function companyVelocity(historyRows, { now = Math.floor(Date.now() / 1000) } = {}) {
  const out = new Map();
  for (const h of historyRows) {
    let c = out.get(h.company_key);
    if (!c) out.set(h.company_key, c = { firstSeen: h.first_seen, openCount: 0, closed90: 0 });
    if (h.first_seen < c.firstSeen) c.firstSeen = h.first_seen;
    if (h.closed_at == null) c.openCount++;
    else if (h.closed_at >= now - 90 * DAY) c.closed90++;
  }
  for (const c of out.values()) c.watchedDays = Math.max(0, Math.floor((now - c.firstSeen) / DAY));
  return out;
}

/** Per job_id: { reports, silent, replied, apps: [{ appliedAt, replied }] } from applications and the inbox. */
export function applicationOutcomes(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const out = new Map();
  const inboxReplied = new Set(safe(() => db.prepare(`SELECT DISTINCT ar.user_id || ':' || ar.job_id AS k FROM inbox_messages im
      JOIN application_records ar ON ar.id = im.application_id AND ar.user_id = im.user_id
      WHERE im.category IN (${REPLY_CATEGORIES.map(() => "?").join(",")})`).all(...REPLY_CATEGORIES), []).map(r => r.k));
  const apps = safe(() => db.prepare(`SELECT user_id, job_id, applied_at, response_outcome, first_response_at, outcome_source
      FROM job_applications WHERE applied_at IS NOT NULL`).all(), []);
  for (const a of apps) {
    const id = String(a.job_id);
    let o = out.get(id);
    if (!o) out.set(id, o = { reports: 0, silent: 0, replied: 0, apps: [] });
    const bucket = inboxReplied.has(`${a.user_id}:${a.job_id}`) ? "responded" : responseBucket(a, { now });
    if (bucket === "responded") o.replied++;
    else if (bucket === "silent") {
      o.silent++;
      if (a.response_outcome === RESPONSE_OUTCOME.NO_RESPONSE && a.outcome_source === "manual") o.reports++;
    }
    if (bucket !== "unresolved") o.apps.push({ appliedAt: a.applied_at, replied: bucket === "responded" });
  }
  return out;
}

/**
 * The rollup. @returns {{ scored, uncertain, notHiring, changed, notHiringMin }}
 */
export function scoreGhosts(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const notHiringMin = currentNotHiringMin(db);
  const history = safe(() => db.prepare(`SELECT job_id, company_key, title_key, loc_key, desc_sig, posted_at, first_seen, last_seen, closed_at
      FROM job_history`).all(), []);
  const byId = new Map(history.map(h => [h.job_id, h]));
  const groups = new Map();
  for (const h of history) {
    const k = `${h.company_key}\u0000${h.title_key}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(h);
  }
  for (const g of groups.values()) g.sort((a, b) => a.first_seen - b.first_seen);
  const companies = companyVelocity(history, { now });
  const outcomes = applicationOutcomes(db, { now });

  const rows = db.prepare(`SELECT job_id, title, ghost_level, COALESCE(description_full, description_text, description) AS text
      FROM scraped_jobs WHERE is_active = 1 AND duplicate_of IS NULL`).all();
  const prior = new Map(safe(() => db.prepare(`SELECT job_id, flagged_at FROM job_ghost`).all(), []).map(r => [r.job_id, r.flagged_at]));
  const setLevel = db.prepare(`UPDATE scraped_jobs SET ghost_level = ? WHERE job_id = ?`);
  const upsert = db.prepare(`INSERT INTO job_ghost (job_id, level, points, evidence_json, scored_at, flagged_at)
      VALUES (@job_id, @level, @points, @evidence_json, @scored_at, @flagged_at)
      ON CONFLICT(job_id) DO UPDATE SET level = excluded.level, points = excluded.points, evidence_json = excluded.evidence_json,
        scored_at = excluded.scored_at, flagged_at = COALESCE(job_ghost.flagged_at, excluded.flagged_at)`);

  let uncertain = 0, notHiring = 0, changed = 0;
  db.transaction(() => {
    for (const r of rows) {
      const id = String(r.job_id);
      const h = byId.get(id);
      const group = h ? groups.get(`${h.company_key}\u0000${h.title_key}`) ?? [h] : [];
      const liveness = h ? safe(() => livenessOf(h, group, { now }), null) : null;
      let locations = 0;
      if (h?.desc_sig) {
        const locs = new Set();
        for (const g of group) {
          if (g.closed_at != null || !g.desc_sig) continue;
          const sim = g.job_id === h.job_id ? 1 : signatureSimilarity(h.desc_sig, g.desc_sig);
          if (sim != null && sim >= SAME_TEXT) locs.add(g.loc_key || `#${g.job_id}`);
        }
        locations = locs.size;
      }
      const c = h ? companies.get(h.company_key) : null;
      const o = outcomes.get(id) ?? { reports: 0, silent: 0, replied: 0 };
      const g = ghostScoreOf({ title: r.title, text: r.text, liveness, locations,
        company: c ? { watchedDays: c.watchedDays, openCount: c.openCount, closed90: c.closed90 } : null,
        reports: o.reports, silent: o.silent, replied: o.replied }, { notHiringMin });
      if (g.level === GHOST_LEVEL.UNCERTAIN) uncertain++;
      if (g.level === GHOST_LEVEL.NOT_HIRING) notHiring++;
      // 0 is stored as NULL: "nothing against it" — the board's filter and order read NULL and 0 alike.
      const stored = g.level > 0 ? g.level : null;
      if ((r.ghost_level ?? null) !== stored) { setLevel.run(stored, r.job_id); changed++; }
      if (g.level > 0 || prior.has(id)) {
        upsert.run({ job_id: id, level: g.level, points: g.points, evidence_json: JSON.stringify(g.evidence), scored_at: now,
          flagged_at: g.level === GHOST_LEVEL.NOT_HIRING ? now : null });
      }
    }
  })();
  return { scored: rows.length, uncertain, notHiring, changed, notHiringMin };
}

/** A board page's rows → Map(job_id → { level, label, evidence: string[] }), only for Uncertain and Likely not hiring. */
export function ghostForRows(db, rows) {
  const out = new Map();
  const ids = rows.map(r => String(r.job_id));
  if (!ids.length) return out;
  for (const g of safe(() => db.prepare(`SELECT job_id, level, evidence_json FROM job_ghost WHERE job_id IN (${ids.map(() => "?").join(",")})`).all(...ids), [])) {
    if (!(g.level > 0)) continue;
    const evidence = safe(() => JSON.parse(g.evidence_json), []).map(e => e?.text).filter(Boolean);
    out.set(String(g.job_id), { level: g.level, label: GHOST_LABELS[g.level], evidence });
  }
  return out;
}

/** One posting's ghost reading (the posting page), or null when nothing is against it. */
export function ghostFor(db, jobId) {
  const g = safe(() => db.prepare(`SELECT level, evidence_json FROM job_ghost WHERE job_id = ?`).get(String(jobId)), null);
  if (!g || !(g.level > 0)) return null;
  return { level: g.level, label: GHOST_LABELS[g.level], evidence: safe(() => JSON.parse(g.evidence_json), []).map(e => e?.text).filter(Boolean) };
}

/**
 * P2 · the measure: postings ever flagged "Likely not hiring", and of those with an application sent AFTER the flag
 * that has resolved (a reply, or 30 days of silence), how many got a reply.
 * @returns {{ flagged, withOutcomes, replied, rate: number|null }}
 */
export function ghostCalibration(db, { now = Math.floor(Date.now() / 1000) } = {}) {
  const flagged = safe(() => db.prepare(`SELECT job_id, flagged_at FROM job_ghost WHERE flagged_at IS NOT NULL`).all(), []);
  const outcomes = applicationOutcomes(db, { now });
  let withOutcomes = 0, replied = 0;
  for (const f of flagged) {
    const after = (outcomes.get(String(f.job_id))?.apps ?? []).filter(a => a.appliedAt >= f.flagged_at);
    if (!after.length) continue;
    withOutcomes++;
    if (after.some(a => a.replied)) replied++;
  }
  return { flagged: flagged.length, withOutcomes, replied, rate: withOutcomes ? replied / withOutcomes : null };
}

/**
 * Monthly. Raises the cut by one point when flagged postings reply too often; otherwise leaves it. Records the measure.
 * @returns {{ ran: boolean, raised?: boolean, from?: number, to?: number, measure?: object }}
 */
export function calibrateGhostThreshold(db, { now = Math.floor(Date.now() / 1000), force = false } = {}) {
  const last = safe(() => JSON.parse(getSetting(db, CALIBRATION_KEY) || "null"), null);
  if (!force && last?.at && now - last.at < CALIBRATION_EVERY_DAYS * DAY) return { ran: false };
  const measure = ghostCalibration(db, { now });
  const from = currentNotHiringMin(db);
  const raised = measure.withOutcomes >= CALIBRATION_MIN && measure.rate >= CALIBRATION_MAX_RATE;
  const to = raised ? from + 1 : from;
  if (raised) setSetting(db, NOT_HIRING_KEY, String(to));
  setSetting(db, CALIBRATION_KEY, JSON.stringify({ at: now, ...measure, cut: to, raised }));
  return { ran: true, raised, from, to, measure };
}
