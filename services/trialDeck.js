// services/trialDeck.js — ⭐ THE TRIAL'S POSTINGS ARE LOCKED PER SAMPLE (owner 11-02).
//
// ⛔ 11-02, the site froze: every new tester's sample profile started the board-fit precompute over its whole category
// (17,278 postings, 10–45 min each on the one Node thread), ~20 queued, and every page — Google sign-in, the survey, the
// tour — waited behind them. Owner: "since this is a trial only with samples, lock down what picks we are showing and
// what jobs and everything … postings locked down to specific ones for each sample type a and b. this way theres no
// precompute at all."
//
// So a sample's 10 cards are chosen ONCE (services/trialPicks.js samplePicks — its own category, level and résumé), each
// scored ONCE against the sample résumé with the same local scorer the board uses, and frozen in app_settings as
// `trial_deck_<id>`. Every tester on that sample is dealt exactly those cards; their deck and their board read them and
// nothing else. A frozen card keeps showing after its posting leaves the board — the trial is a demonstration.
// Admin can re-freeze (refreezeSampleDeck) when a sample's postings should change.
import { scoreAtsLocally } from "./localAtsScorer.js";
import { samples, activeSampleId, isTrial } from "./trial.js";
import { samplePicks, PICKS_PER_SAMPLE } from "./trialPicks.js";
import { mapJobRow } from "./jobs/mapJobRow.js";
import { deckSnapshot, whyFromReport, deckReport, decisionsFor, orderByAts } from "./dailyDraft.js";
import { atsBandFor } from "../shared/atsBands.js";
import { getSetting, setSetting } from "./appSettings.js";

const keyOf = (id) => `trial_deck_${id}`;

/** The frozen cards for a sample, or null when none are frozen yet. [{ jobId, band, score, job, why, report }] */
export function readSampleDeck(db, sampleId) {
  try { const v = JSON.parse(getSetting(db, keyOf(sampleId)) || "null"); return Array.isArray(v) && v.length ? v : null; }
  catch { return null; }
}

/** Build and freeze a sample's cards. Frozen only when the sample has its full PICKS_PER_SAMPLE; returns the cards. */
export async function freezeSampleDeck(db, sampleId, opts = {}) {
  const s = samples()[sampleId];
  if (!s) return [];
  const picks = await samplePicks(db, sampleId, opts);
  const row = db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?");
  const cards = [];
  for (const p of picks) {
    const j = row.get(p.job_id);
    if (!j) continue;
    let report = null;
    try { report = scoreAtsLocally({ job: { title: j.title, description: j.description || "" }, resumeText: s.resumeText }); } catch { report = null; }
    const score = Number.isFinite(report?.score) ? report.score : p.score ?? null;
    const job = deckSnapshot(mapJobRow({ ...j, matchScore: score }));
    cards.push({ jobId: j.job_id, band: atsBandFor(score), score, job, why: whyFromReport(report), report: deckReport(report) });
  }
  if (cards.length >= PICKS_PER_SAMPLE) setSetting(db, keyOf(sampleId), JSON.stringify(cards));
  return cards;
}

/** The frozen cards, freezing them on first use. */
export async function sampleDeck(db, sampleId, opts = {}) {
  return readSampleDeck(db, sampleId) || freezeSampleDeck(db, sampleId, opts);
}

/** Admin: choose a sample's cards again (testers already dealt keep seeing the new set on their next load). */
export async function refreezeSampleDeck(db, sampleId, opts = {}) {
  setSetting(db, keyOf(sampleId), "null");
  return freezeSampleDeck(db, sampleId, opts);
}

/** The sample this account's trial runs on, or null (not a trial, or not on a sample). */
export function trialSampleOf(db, userId) {
  if (!isTrial(db, userId)) return null;
  return activeSampleId(db, userId);
}

/** GET /api/draft/today for a sample trial account: the frozen cards, in the deck's response shape. */
export async function trialDeckResponse(db, { userId, profileId, sampleId, date, order = "dealt" }) {
  const frozen = await sampleDeck(db, sampleId);
  const decisions = decisionsFor(db, userId, frozen.map(c => c.jobId));
  const scoreOf = new Map(frozen.map(c => [c.jobId, c.score]));
  const dealt = frozen.map((c, i) => ({ position: i, band: c.band, decision: decisions[c.jobId], job: c.job, why: c.why,
    report: c.report ?? null, score: c.score ?? null }));
  const cards = order === "ats" ? orderByAts(dealt, (id) => scoreOf.get(id) ?? null) : dealt;
  return { date, profileId, size: cards.length, dealtNow: false, cards, order: order === "ats" ? "ats" : "dealt",
    thin: cards.length > 0 && cards.length < PICKS_PER_SAMPLE, sample: sampleId,
    ...(cards.length === 0 ? { reason: "empty" } : cards.length < PICKS_PER_SAMPLE ? { reason: "thin" } : {}) };
}

/** GET /api/jobs for a sample trial account: the same frozen postings, as one board page. */
export async function trialBoardResponse(db, { sampleId }) {
  const frozen = await sampleDeck(db, sampleId);
  const jobs = frozen.map(c => ({ ...c.job, matchScore: c.score ?? null }));
  return { success: true, jobs, total: jobs.length, page: 1, pageSize: jobs.length, totalPages: 1, sources: ["trial_sample"],
    fromCache: true, nextCursor: null, trialSample: sampleId };
}
