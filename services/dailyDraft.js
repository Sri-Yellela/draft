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
import { experienceState } from "../shared/postingFacts.js";
import { normaliseDeckSize } from "../shared/deckGeometry.js";

export const DECK_SIZE = 10;

/**
 * ⭐ D152 (3) · the person's picks per day (users.deck_size, migration 220; Customise → Daily Deck). NULL, a value
 * shared/deckGeometry.js DECK_SIZES does not hold, or a database without the column (a test fixture) is DECK_SIZE.
 */
export function deckSizeOf(db, userId) {
  try {
    return normaliseDeckSize(db.prepare("SELECT deck_size FROM users WHERE id = ?").pluck().get(userId)) ?? DECK_SIZE;
  } catch { return DECK_SIZE; }
}
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

/**
 * "Why it's here" — the evidence behind a card, from the SAME stored report its band came from:
 * the skills the posting asks for that the résumé shows, and the ones it does not. Frozen with the
 * card. Position says how good; this says why, which position cannot (UI_REDESIGN §3.3).
 */
const strings = (v, n) => (Array.isArray(v) ? v.filter(x => typeof x === "string" && x.trim()).slice(0, n) : []);
const total = (v) => (Array.isArray(v) ? v.length : 0);

export function whyFromReport(report) {
  const r = report && typeof report === "object" ? report : {};
  return { matched: strings(r.tier1_matched, 6), missing: strings(r.tier1_missing, 4),
           matchedTotal: total(r.tier1_matched), missingTotal: total(r.tier1_missing) };
}

/**
 * The FULL ATS report behind a card (A40 — the expanded card's left panel, and the phone's sheet):
 * every section the board's report shows — skills, competencies and verbs matched and missing, the
 * generic language, experience fit, the profile facts missing, why the scorer declined, the seniority
 * guard's reason, the résumé-depth note. Frozen with the card, from the SAME stored report its band
 * came from.
 *
 * ⛔ NO NUMBER (G5). A WHITELIST, not a copy minus the score: the stored report also carries the
 * score, the seniority cap and the pre-cap raw score, and a deny-list would leak whatever numeric
 * field is added next. A declined report (`scorable: false`) is the scorer saying it cannot judge —
 * carried as that, never as a low score.
 */
export function deckReport(report) {
  if (!report || typeof report !== "object") return null;
  const r = report;
  const text = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const exp = r.experience && typeof r.experience === "object" ? r.experience : null;
  const depth = r.resume_depth && typeof r.resume_depth === "object" ? r.resume_depth : null;
  return {
    scorable: r.scorable !== false && !(Array.isArray(r.decline_reasons) && r.decline_reasons.length),
    declineReasons: strings(r.decline_reasons, 6),
    skillsMatched: strings(r.tier1_matched, 40), skillsMissing: strings(r.tier1_missing, 40),
    competenciesMatched: strings(r.competencies_matched, 12), competenciesMissing: strings(r.competencies_missing, 12),
    verbsMatched: strings(r.action_verbs_matched, 24), verbsMissing: strings(r.action_verbs_missing, 24),
    verbsGeneric: strings(r.action_verbs_generic, 10),
    claimedMatches: strings(r.claimed_matches, 40),
    experience: text(exp?.summary), experienceFit: typeof exp?.fit === "boolean" ? exp.fit : null,
    // D32: the Experience row's pass/fail, as a WORD (met / short / unknown / none) — no years leave.
    experienceState: exp ? experienceState(exp) : null,
    hardConstraintMisses: strings(r.hard_constraint_misses, 10),
    seniorityNote: r.seniority_cap?.applied ? text(r.seniority_cap.reason) : null,
    depthHeadline: text(depth?.headline), depthDetail: text(depth?.detail),
  };
}

/** A card frozen before a field existed reads back in today's shape — the contract declares every field. */
function readWhy(why) {
  const w = why && typeof why === "object" ? why : {};
  const matched = strings(w.matched, 6), missing = strings(w.missing, 4);
  return { matched, missing,
           matchedTotal: Number.isFinite(w.matchedTotal) ? w.matchedTotal : matched.length,
           missingTotal: Number.isFinite(w.missingTotal) ? w.missingTotal : missing.length };
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
/** The orders a deck can be read in. 'dealt' is the board's own (position IS the fit signal). */
export const DECK_ORDERS = Object.freeze(["dealt", "ats", "best"]);

// ⭐ D152 (3) (owner 11-04: "merge the daily deck, daily picks, and the best bets"): ONE RANKING FEEDS THE DECK — D136's
// best-bets reading of each dealt card (shared/bestBets.js bestBetOf: hard filters, then the signals; a ranked score,
// never a probability). The deal stays frozen; "best" reorders the READ by it (then the dealt position), and every card
// carries its reading so the card can say its reason line. A card with no fit yet (score null) sorts after the scored.
export function orderByBest(cards) {
  return cards.map((c, i) => ({ c, i, s: Number.isFinite(c.bestBet?.score) ? c.bestBet.score : null }))
    .sort((a, b) => ((b.s ?? -1) - (a.s ?? -1)) || (a.c.position - b.c.position) || (a.i - b.i))
    .map(k => k.c);
}

// A75 (owner, 10-03): "ATS match" as a sort on the daily draft. The deal stays frozen; only the READ
// is reordered — by the caller's own stored score, with the board's fit-band rule (FIT_KEYS in
// services/jobs/jobCursor.js): Strong, Moderate, NOT ESTABLISHED, Weak — a declined score is the
// scorer saying it cannot judge, so it sorts between, never last — then the score, then the dealt
// position. ⛔ THE SCORE NEVER LEAVES THE SERVER: it orders the cards and is not added to them.
const BAND_ORDINAL = { [ATS_BAND.STRONG]: 0, [ATS_BAND.MODERATE]: 1, [ATS_BAND.NOT_ENOUGH_SIGNAL]: 2, [ATS_BAND.WEAK]: 3 };
export function orderByAts(cards, scoreFor) {
  const keyed = cards.map(c => {
    const s = scoreFor(c.job.id);
    const score = Number.isFinite(s) ? s : null;
    return { c, band: BAND_ORDINAL[atsBandFor(score)] ?? 2, score };
  });
  keyed.sort((a, b) => (a.band - b.band) || ((b.score ?? -1) - (a.score ?? -1)) || (a.c.position - b.c.position));
  return keyed.map(k => k.c);
}

export async function todaysDeck(db, { userId, profileId, date, fetchBoardPage, reportFor = () => null, size = DECK_SIZE,
                                       order = "dealt", scoreFor = () => null, betFor = null }) {
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
      insert.run(userId, profileId, date, i, c.job.id, c.band,
                 JSON.stringify(((report) => ({ job: c.job, why: whyFromReport(report), report: deckReport(report) }))(reportFor(c.job.id))))))();
    rows = readDeal(db, userId, profileId, date);
    dealtNow = true;
  }
  const decisions = decisionsFor(db, userId, rows.map(r => r.job_id));
  const dealtCards = rows.map(r => {
    const snap = JSON.parse(r.card_json);
    // `report` is null on a card dealt before A40 froze it — the panel then says the full report is on
    // the board rather than inventing one from the six-chip summary.
    return { position: r.position, band: r.band, decision: decisions[r.job_id], job: snap.job, why: readWhy(snap.why),
             report: snap.report ?? null };
  });
  // D152 (3): each card's best-bets reading (its score and reasons), read at serve time — never frozen into the deal.
  if (betFor) for (const c of dealtCards) { try { c.bestBet = betFor(c.job) ?? null; } catch { c.bestBet = null; } }
  const cards = order === "ats" ? orderByAts(dealtCards, scoreFor) : order === "best" ? orderByBest(dealtCards) : dealtCards;
  return {
    date, profileId, size: cards.length, dealtNow, cards, order: order === "ats" || order === "best" ? order : "dealt",
    thin: cards.length > 0 && cards.length < size,
    ...(cards.length === 0 ? { reason: "empty" } : cards.length < size ? { reason: "thin" } : {}),
  };
}
