// shared/dealRanking.js — ⛔ A133 (owner 11-06) · THE DECK'S RANKING: a product of the ATS score, the best-bets logic and
// the role / responsibility similarity between the résumé and the posting.
//
// Owner: *"the cards have to be a product of the ats score and the best bets logic and if possible some contextual
// similarity of role and responsibilities btween the resume and the jd, and i see many new jobs with ats touching 90 and
// yet the deck shows jobs that has 65 and i suspect i might be seeing the same deck for so many days now."*
//
// WHAT WAS WRONG (measured on the 18k copy, 45a): the deal took the top of the board's CURATED order, whose rank keys
// (`q`, role_key, target_title_exact, target_title_role, skills_include) lead the ATS fit — a 31 % "Software Engineer, …"
// out-ranked a 42 % one with a different title — and an undecided card is eligible again the next day, so the next day's
// deal read the same top and came out identical (11-05 and 11-07 dealt the same ten).
//
// THE RULE (pure: signals in, a number out — no database, no clock):
//
//   deal score = ( 50 · ATS/100  +  30 · bestBet/100  +  20 · roleSimilarity ) / (the weights of the KNOWN signals)
//                × rotation
//
//   · ATS — the caller's own stored score (ats_only_reports), 0–100.
//   · bestBet — D136's ranked score (shared/bestBets.js bestBetOf), 0–100: must-haves, level, freshness, ghost, velocity.
//   · roleSimilarity — cosine of term frequencies between the résumé and the posting's TITLE (×3) + its RESPONSIBILITIES
//     section (the whole description when no section is found), rescaled across the pool being ranked to 0–1 so it
//     orders rather than dominates.
//   · An absent signal is left out of BOTH sides (as bestBetOf does) — a posting is never marked down for what draft
//     cannot see.
//   · rotation — a card dealt on earlier days and left undecided loses ROTATION_STEP per day it was shown (last 7 days),
//     never below ROTATION_FLOOR: a clearly better card stays, an equal one gives way, so the deck differs day to day.

export const DEAL_WEIGHTS = Object.freeze({ ats: 50, bet: 30, similarity: 20 });
export const ROTATION_STEP = 0.12;
export const ROTATION_FLOOR = 0.5;
export const ROTATION_DAYS = 7;

const STOP = new Set(("a an and are as at be been but by for from has have in into is it its of on or our the their this " +
  "to was we were will with you your yours they them who what when where which while within about across after all also any " +
  "can could do does each etc more most must other over per should such than that these those through under up use using " +
  "via would able work working team teams role job company experience years year including include new well strong").split(" "));

export function terms(text) {
  const out = new Map();
  for (const raw of String(text || "").toLowerCase().match(/[a-z][a-z0-9+#.]{1,}/g) || []) {
    const w = raw.replace(/\.+$/, "").replace(/(?<=[a-z]{3})s$/, "");
    if (w.length < 3 || STOP.has(w)) continue;
    out.set(w, (out.get(w) || 0) + 1);
  }
  return out;
}

const RESP_HEAD = /(responsibilities|what you(?:'|’)?ll do|what you will do|the role|your role|in this role|your impact|what you(?:'|’)?ll be doing|day[- ]to[- ]day|key duties|duties)\s*:?\s*\n?/i;
const NEXT_HEAD = /\n\s*(qualifications|requirements|what you bring|what we(?:'|’)?re looking for|about you|who you are|minimum qualifications|preferred qualifications|benefits|compensation|nice to have|you have|you might be)\b/i;

/** The posting's responsibilities section, else its description (capped — the head carries the role). */
export function responsibilitiesOf(description) {
  const d = String(description || "");
  const m = RESP_HEAD.exec(d);
  if (m) {
    const rest = d.slice(m.index + m[0].length);
    const end = NEXT_HEAD.exec(rest);
    const sec = (end ? rest.slice(0, end.index) : rest).slice(0, 4000);
    if (sec.trim().length > 40) return sec;
  }
  return d.slice(0, 4000);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [k, v] of b) { nb += v * v; const x = a.get(k); if (x) dot += x * v; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Raw role similarity, 0–1 (null when either side has no text). */
export function roleSimilarityRaw(resumeTerms, job) {
  if (!resumeTerms || !resumeTerms.size) return null;
  const title = String(job?.title || "");
  const body = responsibilitiesOf(job?.description);
  if (!title.trim() && !body.trim()) return null;
  const jt = terms(body);
  for (const [k, v] of terms(title)) jt.set(k, (jt.get(k) || 0) + 3 * v);
  return jt.size ? cosine(resumeTerms, jt) : null;
}

export function rotationOf(shownDays) {
  const n = Number.isFinite(shownDays) && shownDays > 0 ? shownDays : 0;
  return Math.max(ROTATION_FLOOR, 1 - ROTATION_STEP * n);
}

/** One card's score from its (already rescaled) signals. null when nothing is known. */
export function dealScoreOf({ ats = null, bet = null, similarity = null, shownDays = 0 } = {}) {
  const W = DEAL_WEIGHTS;
  let got = 0, could = 0;
  if (Number.isFinite(ats)) { got += W.ats * Math.max(0, Math.min(1, ats / 100)); could += W.ats; }
  if (Number.isFinite(bet)) { got += W.bet * Math.max(0, Math.min(1, bet / 100)); could += W.bet; }
  if (Number.isFinite(similarity)) { got += W.similarity * Math.max(0, Math.min(1, similarity)); could += W.similarity; }
  if (!could) return null;
  return (got / could) * rotationOf(shownDays);
}

/**
 * Rank a pool of { job, ... } items. Returns new objects with `dealScore` (and the signals behind it), best first; ties
 * (and unknowns, which sort last) keep the pool's own order. `scoreFor(id)` → ATS, `betFor(job)` → { score } | null,
 * `resumeText` the active résumé, `shownBefore` Map(job_id → days dealt undecided before today).
 */
export function rankDeal(pool, { scoreFor = () => null, betFor = null, resumeText = "", shownBefore = new Map() } = {}) {
  const rt = resumeText ? terms(resumeText) : null;
  const rows = pool.map((item, i) => {
    const id = item.job?.id;
    const atsV = scoreFor(id);
    let bet = null;
    if (betFor) { try { const b = betFor(item.job); bet = Number.isFinite(b?.score) ? b.score : null; } catch { bet = null; } }
    return { item, i, ats: Number.isFinite(atsV) ? atsV : null, bet, simRaw: roleSimilarityRaw(rt, item.job), shownDays: shownBefore.get(id) || 0 };
  });
  const sims = rows.map(r => r.simRaw).filter(Number.isFinite);
  const lo = sims.length ? Math.min(...sims) : 0, hi = sims.length ? Math.max(...sims) : 0;
  for (const r of rows) {
    r.similarity = Number.isFinite(r.simRaw) ? (hi > lo ? (r.simRaw - lo) / (hi - lo) : 1) : null;
    r.dealScore = dealScoreOf(r);
  }
  rows.sort((a, b) => ((b.dealScore ?? -1) - (a.dealScore ?? -1)) || (a.i - b.i));
  return rows.map(r => ({ ...r.item, dealScore: r.dealScore,
    signals: { ats: r.ats, bet: r.bet, similarity: r.similarity == null ? null : Math.round(r.similarity * 100) / 100, shownDays: r.shownDays } }));
}
