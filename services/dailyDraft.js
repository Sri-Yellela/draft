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
import { rankDeal, ROTATION_DAYS } from "../shared/dealRanking.js";

/**
 * ⛔ A133 · the days (in the last ROTATION_DAYS, before `date`) each job was dealt to this person and left undecided —
 * shared/dealRanking.js's rotation. A decided card never re-deals, so counting every earlier row is "shown undecided".
 */
export function shownBeforeFor(db, userId, profileId, date) {
  const out = new Map();
  try {
    const since = new Date(Date.parse(date + "T00:00:00Z") - ROTATION_DAYS * 86400000).toISOString().slice(0, 10);
    for (const r of db.prepare(
      `SELECT job_id, COUNT(DISTINCT draft_date) n FROM daily_drafts
       WHERE user_id = ? AND profile_id = ? AND draft_date < ? AND draft_date >= ? GROUP BY job_id`).all(userId, profileId, date, since)) {
      out.set(r.job_id, r.n);
    }
  } catch { /* no history → no rotation */ }
  return out;
}
// ⛔ A133 · how many eligible candidates the deal ranks before it picks (≥ the deck): the top of the board by ATS. 50 =
// one board page, so the deal reads no more of the board than it did before (measured: a page is the deal's cost).
const POOL_MIN = 50;

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

/**
 * ⛔ A126 (9) (owner 11-05: "theres a job with higher match sitting in the postings while the deck stagnates with a
 * different job with a lower score") · TODAY'S DEAL IS RE-DEALT WHEN THE BOARD NOW HOLDS A BETTER MATCH. The deal was
 * frozen at the day's first open; the match queue (A126 (7)) keeps scoring postings after that, so a 90 % match could
 * land on the board while the deck held a 66 % one all day. The cards the person DECIDED (drafted / passed / saved) stay
 * — they are the day's record; the undecided slots are re-picked from the board's first page (its own fit order,
 * selectDeal's rules) and written only when the best new pick out-scores the weakest undecided card. The caller
 * throttles (server.js); `reshuffled: true` tells the client to play the re-deal.
 */
// ⛔ A133 · the re-deal ranks the open cards and the board's top TOGETHER with the deal's own blend (shared/dealRanking.js)
// — before, it took the board's first `slots` cards in the curated order, which were the open cards themselves, so a
// 90 % posting lower on the first page was never a "newcomer" and the re-deal never fired.
async function redealIfBetter(db, { userId, profileId, date, rows, fetchBoardPage, reportFor, size, scoreFor, betFor = null, warmBets = null, resumeText = "" }) {
  const decisions = decisionsFor(db, userId, rows.map(r => r.job_id));
  const kept = rows.filter(r => decisions[r.job_id]);
  const open = rows.filter(r => !decisions[r.job_id]);
  const slots = Math.max(0, size - kept.length);
  if (!slots) return null;
  const r = await fetchBoardPage(null);
  if (!r?.ok) return null;
  const openIds = new Set(open.map(o => o.job_id));
  const exclude = new Set([...decidedJobIds(db, userId), ...kept.map(k => k.job_id), ...openIds]);
  const candidates = selectDeal(r.jobs || [], { decided: exclude, size: POOL_MIN });
  if (!candidates.length) return null;
  const openCards = open.map(o => { const snap = JSON.parse(o.card_json); return { band: o.band, job: snap.job, row: o }; });
  const shownBefore = shownBeforeFor(db, userId, profileId, date);
  if (betFor && warmBets) { try { await warmBets([...openCards, ...candidates].map(c => c.job)); } catch { /* betFor reads it itself */ } }
  const ranked = rankDeal([...openCards, ...candidates], { scoreFor, betFor, resumeText, shownBefore });
  const top = ranked.slice(0, slots);
  const newcomers = top.filter(c => !c.row);
  if (!newcomers.length) return null;
  const val = (c) => c.dealScore ?? -1;
  const openRanked = ranked.filter(c => c.row);
  const weakestOpen = openRanked.length ? Math.min(...openRanked.map(val)) : -1;
  const bestNew = Math.max(...newcomers.map(val));
  if (open.length >= slots && bestNew <= weakestOpen) return null;
  const fresh = top;
  const insert = db.prepare(
    `INSERT INTO daily_drafts (user_id, profile_id, draft_date, position, job_id, band, card_json) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    db.prepare("DELETE FROM daily_drafts WHERE user_id = ? AND profile_id = ? AND draft_date = ?").run(userId, profileId, date);
    let pos = 0;
    for (const k of kept) insert.run(userId, profileId, date, pos++, k.job_id, k.band, k.card_json);
    for (const c of fresh) {
      if (c.row) { insert.run(userId, profileId, date, pos++, c.row.job_id, c.row.band, c.row.card_json); continue; }
      const report = reportFor(c.job.id);
      insert.run(userId, profileId, date, pos++, c.job.id, c.band, JSON.stringify({ job: c.job, why: whyFromReport(report), report: deckReport(report) }));
    }
  })();
  return { replaced: newcomers.length, bestNew, weakestOpen };
}

export async function todaysDeck(db, { userId, profileId, date, fetchBoardPage, reportFor = () => null, size = DECK_SIZE,
                                       order = "dealt", scoreFor = () => null, betFor = null, warmBets = null, refresh = false,
                                       resumeText = "" }) {
  let rows = readDeal(db, userId, profileId, date);
  let dealtNow = false;
  let reshuffled = false;
  if (rows.length && refresh) {
    try {
      const r = await redealIfBetter(db, { userId, profileId, date, rows, fetchBoardPage, reportFor, size, scoreFor, betFor, warmBets, resumeText });
      if (r) {
        console.log(`[deck] re-dealt user ${userId} profile ${profileId} ${date}: ${r.replaced} new, best ${r.bestNew.toFixed(3)} > weakest ${r.weakestOpen.toFixed(3)}`);
        rows = readDeal(db, userId, profileId, date);
        reshuffled = true;
      }
    } catch { /* a failed re-deal leaves the day's deal as it was */ }
  }
  if (!rows.length) {
    // ⛔ A133 · POOL, THEN RANK: the eligible top of the board (≥ POOL_MIN, the caller pages it by ATS), ranked by the
    // deal's blend — ATS + best bets + role similarity, with yesterday's undecided cards rotated down — then the top `size`.
    const t0 = Date.now();
    const decided = decidedJobIds(db, userId);
    const pool = [];
    const want = Math.max(size, POOL_MIN);
    let cursor = null;
    for (let page = 0; page < MAX_PAGES && pool.length < want; page++) {
      const r = await fetchBoardPage(cursor);
      if (!r?.ok) throw new Error(r?.error || "the board could not be read");
      const already = new Set(pool.map(c => c.job.id));
      for (const card of selectDeal(r.jobs || [], { decided: new Set([...decided, ...already]), size: want - pool.length })) {
        pool.push(card);
      }
      if (!r.nextCursor) break;
      cursor = r.nextCursor;
    }
    const tPool = Date.now();
    const shownBefore = shownBeforeFor(db, userId, profileId, date);
    if (betFor && warmBets && pool.length) { try { await warmBets(pool.map(c => c.job)); } catch { /* betFor reads it itself */ } }
    const tWarm = Date.now();
    const rankedPool = rankDeal(pool, { scoreFor, betFor, resumeText, shownBefore });
    // A133 · DRAFT_DECK_DEBUG=1 prints the ranked pool's signals (no numbers leave the server; this is the server log).
    if (process.env.DRAFT_DECK_DEBUG === "1") {
      console.log(`[deck] deal timing: pool ${tPool - t0} ms (${pool.length}) · warm ${tWarm - tPool} ms · rank ${Date.now() - tWarm} ms`);
      for (const c of rankedPool.slice(0, 20)) console.log(`[deck] rank ${c.dealScore?.toFixed(3)} ${JSON.stringify(c.signals)} ${c.job.title} @ ${c.job.company}`);
    }
    const picked = rankedPool.slice(0, size);
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
  // ⛔ D151 · `warmBets(jobs)` (server.js: the cards' company velocity through the read-worker pool) runs first, so the
  // synchronous betFor below reads a warm cache instead of walking job_history on the loop. A failed warm is ignored —
  // betFor then reads as before (never fails closed).
  if (betFor && warmBets) { try { await warmBets(dealtCards.map(c => c.job)); } catch { /* betFor reads it itself */ } }
  if (betFor) for (const c of dealtCards) { try { c.bestBet = betFor(c.job) ?? null; } catch { c.bestBet = null; } }
  const cards = order === "ats" ? orderByAts(dealtCards, scoreFor) : order === "best" ? orderByBest(dealtCards) : dealtCards;
  return {
    date, profileId, size: cards.length, dealtNow, reshuffled, cards, order: order === "ats" || order === "best" ? order : "dealt",
    thin: cards.length > 0 && cards.length < size,
    ...(cards.length === 0 ? { reason: "empty" } : cards.length < size ? { reason: "thin" } : {}),
  };
}
