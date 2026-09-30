// ── The daily draft — today's deck, dealt once and frozen ─────────────────────────────────────
//
// docs/UI_REDESIGN.md §3.1. Decisions the owner confirmed 09-30: up to DECK_SIZE a day; deal ONLY
// Strong and Moderate (a thin day deals fewer, an empty day deals none — never padded); an
// undecided card is eligible again tomorrow, a decided one never re-deals; the full board stays.
//
// ⛔ ONE ORDERING. The deal reads the board through the caller's `fetchBoardPage` — the board's own
// function (server.js boardPageResponse) — so the deck is the top of the default, fit-ranked order
// and never a second query that could drift from it.
//
// ⛔ DECISIONS ARE NOT STORED HERE. They already live somewhere: drafted = an apply_run_jobs row
// that was not cancelled; passed = user_jobs.disliked; saved = user_jobs.starred. This table
// stores the DEAL (which cards, in what order, what they looked like), and reads decisions live.
//
// ⛔ NO NUMBER. A card carries its band; the per-caller score is stripped from the snapshot (G5).
import { atsBandFor, ATS_BAND } from "../shared/atsBands.js";

export const DECK_SIZE = 10;
export const DEAL_BANDS = Object.freeze([ATS_BAND.STRONG, ATS_BAND.MODERATE]);
// How far down the board the deal may read to fill the deck: the board pages 50 at a time.
const MAX_PAGES = 4;

/**
 * The client's LOCAL date, validated. It must be a real YYYY-MM-DD within one day of the server's
 * UTC date — a clock-skew guard, not a timezone model: UTC−12 … UTC+14 all land inside it.
 */
export function validDraftDate(date, now = new Date()) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const t = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== date) return false;
  const today = Date.parse(now.toISOString().slice(0, 10) + "T00:00:00Z");
  return Math.abs(t - today) <= 86400000;
}

/**
 * The job as the deck stores it: the board's $Job shape UNCHANGED except that the score is nulled —
 * the contract marks matchScore INTERNAL, and a deck card is a display surface (G5). The shape stays
 * whole so the published $Job schema describes it.
 */
export function deckSnapshot(job) {
  const { atsScore, baseAtsScore, ...rest } = job;
  return { ...rest, matchScore: null };
}

/**
 * Pure: pick today's cards from board rows already in the board's order. Keeps Strong and Moderate
 * only, skips anything decided, stops at `size`. Order is preserved — position IS the fit signal.
 */
export function selectDeal(boardJobs, { decided = new Set(), size = DECK_SIZE } = {}) {
  const out = [];
  const seen = new Set();
  for (const job of boardJobs) {
    if (out.length >= size) break;
    const id = job?.id;
    if (!id || seen.has(id) || decided.has(id) || job.disliked || job.starred) continue;
    seen.add(id);
    const band = atsBandFor(job.matchScore ?? null);
    if (!DEAL_BANDS.includes(band)) continue;
    out.push({ band, job: deckSnapshot(job) });
  }
  return out;
}

/** Every job this user has decided, in the three places decisions live. */
export function decidedJobIds(db, userId) {
  const ids = new Set();
  for (const r of db.prepare(
    "SELECT DISTINCT job_id FROM apply_run_jobs WHERE user_id = ? AND status <> 'cancelled'").all(userId)) ids.add(r.job_id);
  for (const r of db.prepare(
    "SELECT job_id FROM user_jobs WHERE user_id = ? AND (disliked = 1 OR starred = 1)").all(userId)) ids.add(r.job_id);
  return ids;
}

/** Live decision per job id: "drafted" | "passed" | "saved" | null. Draft wins; then pass; then save. */
export function decisionsFor(db, userId, jobIds) {
  const out = Object.fromEntries(jobIds.map(id => [id, null]));
  if (!jobIds.length) return out;
  const q = jobIds.map(() => "?").join(",");
  for (const r of db.prepare(
    `SELECT job_id, starred, disliked FROM user_jobs WHERE user_id = ? AND job_id IN (${q})`).all(userId, ...jobIds)) {
    if (r.disliked) out[r.job_id] = "passed";
    else if (r.starred) out[r.job_id] = "saved";
  }
  for (const r of db.prepare(
    `SELECT DISTINCT job_id FROM apply_run_jobs WHERE user_id = ? AND status <> 'cancelled' AND job_id IN (${q})`).all(userId, ...jobIds)) {
    out[r.job_id] = "drafted";
  }
  return out;
}

function readDeal(db, userId, profileId, date) {
  return db.prepare(
    `SELECT position, job_id, band, card_json FROM daily_drafts
     WHERE user_id = ? AND profile_id = ? AND draft_date = ? ORDER BY position`).all(userId, profileId, date);
}

/**
 * Today's deck for (user, profile, date): dealt on the first call, read back on every later one.
 *
 * `fetchBoardPage(cursor)` returns one page of the board in its default order:
 * `{ ok, jobs, nextCursor }`. The deal pages until the deck is full or the board ends.
 */
export async function todaysDeck(db, { userId, profileId, date, fetchBoardPage, size = DECK_SIZE }) {
  let rows = readDeal(db, userId, profileId, date);
  let dealtNow = false;
  if (!rows.length) {
    const decided = decidedJobIds(db, userId);
    const picked = [];
    let cursor = null;
    for (let page = 0; page < MAX_PAGES && picked.length < size; page++) {
      const r = await fetchBoardPage(cursor);
      if (!r?.ok) throw new Error(r?.error || "the board could not be read");
      const already = new Set(picked.map(c => c.job.id));
      for (const card of selectDeal(r.jobs || [], { decided: new Set([...decided, ...already]), size: size - picked.length })) {
        picked.push(card);
      }
      if (!r.nextCursor) break;
      cursor = r.nextCursor;
    }
    // One transaction; a concurrent first call loses on the primary key and reads the winner's deal.
    const insert = db.prepare(
      `INSERT OR IGNORE INTO daily_drafts (user_id, profile_id, draft_date, position, job_id, band, card_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`);
    db.transaction(() => picked.forEach((c, i) =>
      insert.run(userId, profileId, date, i, c.job.id, c.band, JSON.stringify(c.job))))();
    rows = readDeal(db, userId, profileId, date);
    dealtNow = true;
  }
  const decisions = decisionsFor(db, userId, rows.map(r => r.job_id));
  const cards = rows.map(r => ({ position: r.position, band: r.band, decision: decisions[r.job_id], job: JSON.parse(r.card_json) }));
  return {
    date, profileId, size: cards.length, dealtNow, cards,
    thin: cards.length > 0 && cards.length < size,
    ...(cards.length === 0 ? { reason: "empty" } : cards.length < size ? { reason: "thin" } : {}),
  };
}
