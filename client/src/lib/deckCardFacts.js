// ⭐ D145 STEP 3 · WHAT THE DECK CARD SAYS, AND WHERE — one pure function, so "nothing said twice" is a property a test
// can hold (owner 11-03, declutter-v7; the D145 row's "⛔ Nothing said twice").
//
//   collapsed   match (top right) · company + LOCATION ONLY · title · ONE info row: salary · job type · work mode
//   hover       at most TWO soft facts (You're eligible · Still open) — never one the stats say
//   why         "Your résumé against this job": N of M skills + the skill chips + one lead line;
//               "From the posting": stat cards — experience asked · level · time since posted · sponsorship
//
// ⛔ Never "ATS" on the card. ⛔ "posted" only in the stats (never beside the location). ⛔ salary / type / work mode only
// on the collapsed card. A fact with no value is LEFT OUT, never "not stated" — the full posting is one press away.
// ⭐ A117 (owner 11-03, "number for everyone"): /api/draft/today sends every card its caller's own stored score, so the
// match is a number; a card with no score yet (not scored) shows its band's word in the same place.
import { atsBandLabel } from "../../../shared/atsBands.js";
import { salaryLabel, workstyleOf, yearsAsked, kickerFor } from "../../../shared/postingFacts.js";
import { EXPERIENCE_LEVELS } from "../../../shared/jobFilterOptions.js";

const JOB_TYPES = [[/intern/i, "Internship"], [/part/i, "Part-time"], [/contract|freelance|temporary|temp\b/i, "Contract"], [/full/i, "Full-time"]];
export function jobTypeOf(job) {
  const raw = String(job?.contractType || job?.postingFields?.employment || "").trim();
  if (!raw) return null;
  for (const [re, word] of JOB_TYPES) if (re.test(raw)) return word;
  return null;
}

/** "9 hours" · "3 days" · "5 weeks" — the time since the posting's own date (or when draft first saw it). */
export function sincePosted(job, now = Date.now()) {
  const t = job?.postedAt ? Date.parse(job.postedAt)
    : Number(job?.discoveredAt) > 0 ? Number(job.discoveredAt) * 1000 : NaN;
  if (!Number.isFinite(t) || t <= 0 || t > now + 3600e3) return null;
  const h = Math.max(1, Math.round((now - t) / 3600e3));
  if (h < 48) return `${h} ${h === 1 ? "hour" : "hours"}`;
  const d = Math.round(h / 24);
  if (d < 21) return `${d} days`;
  const w = Math.round(d / 7);
  return w < 9 ? `${w} weeks` : `${Math.round(d / 30)} months`;
}

const levelWord = (job) => EXPERIENCE_LEVELS.options.find((o) => o.value === job?.tagLevel)?.label || null;

/**
 * @param card { job, band, why, report, score? } — a dealt card as /api/draft/today sends it
 * @returns {{ match, info, chips, why, stats }}
 */
export function cardFacts(card, now = Date.now()) {
  const job = card?.job || {};
  const why = card?.why || {};
  const report = card?.report || null;
  const hasScore = Number.isFinite(card?.score);
  const bandWord = atsBandLabel(card?.band)?.label?.replace(/ match$/i, "") || null;
  const match = hasScore
    ? { value: `${Math.max(0, Math.min(100, Math.round(card.score)))}%`, word: "résumé match", numeric: true }
    : bandWord ? { value: bandWord, word: "résumé match", numeric: false } : null;

  // The ONE info row — salary · job type · work mode, only those on file.
  const info = [
    { key: "salary", value: salaryLabel(job), label: "salary" },
    { key: "type", value: jobTypeOf(job), label: "job type" },
    { key: "mode", value: workstyleOf(job) || (job.remote ? "Remote" : null), label: "work mode" },
  ].filter((f) => f.value);

  // Hover: at most two soft facts, both things the stats never say.
  const chips = [
    job?.eligibility?.status === "eligible" ? "You're eligible" : null,
    job?.isActive !== false && !(job?.ghost?.level >= 2) ? "Still open" : null,
  ].filter(Boolean).slice(0, 2);

  // Why: the résumé against the job — "N of M skills", the card's frozen counts (services/dailyDraft.js whyFromReport).
  // ⚠ The sketch's "13 of 15 must-haves" needs D123's must-have / nice-to-have split, which a dealt card does not carry
  // yet; until it does the headline says skills, which is what the numbers count.
  // ⛔ The report's SECTIONS are read only by the shared report component (test/atsReportOneImplementation.test.js) —
  // this reads the card's own `why` counts, never the report's lists.
  const matched = Array.isArray(why.matched) ? why.matched : [];
  const missing = Array.isArray(why.missing) ? why.missing : [];
  const mTotal = Number(why.matchedTotal) || matched.length;
  const total = mTotal + (Number.isFinite(why.missingTotal) ? why.missingTotal : missing.length);
  const headline = total > 0 ? `${mTotal} of ${total} skills` : null;
  // The lead line: the report's own one-sentence reading of the résumé, when it has one. Never a repeat of the chips.
  const lead = report?.depthHeadline || null;

  // From the posting: the stat cards, two per row, each a value and a plain line.
  const years = yearsAsked(job.description);
  const level = levelWord(job) || kickerFor(job).find((k) => EXPERIENCE_LEVELS.options.some((o) => o.label === k)) || null;
  const levelLine = job?.levelRead?.disagreement?.direction === "asks_more" ? "the level; the text asks for more" : "the level they hire at";
  const since = sincePosted(job, now);
  const sp = job?.sponsorship;
  const SPONSOR = { often: "Sponsors", sometimes: "Sometimes", no_record: "No record", says_no: "No sponsorship" };
  const stats = [
    years ? { key: "experience", value: years.label.replace(/ yrs$/, " years"), line: "experience they ask for" } : null,
    level ? { key: "level", value: level, line: levelLine } : null,
    since ? { key: "posted", value: since, line: "since it was posted" } : null,
    sp && SPONSOR[sp.level] ? { key: "sponsorship", value: SPONSOR[sp.level], line: sp.line || sp.label || "the employer's visa record" } : null,
  ].filter(Boolean);

  // ⭐ D152 (3) · THE REASON LINE — the best-bets reading's reasons (server: bestBetOf, the one ranking), in D145's quiet
  // style: "you're eligible · 7 of 7 must-haves · posted 10 hours ago". Each fact ONCE (D152 (7)): the "N ATS match" reason
  // is dropped (the match is the card's top-right number) and a repeated reason is said once. null when there is none.
  const reasons = [...new Set((card?.bestBet?.reasons || []).map(String))].filter((r) => !/\bATS match$/i.test(r));
  const reason = reasons.length
    ? { eligible: reasons[0] === "you're eligible", rest: reasons[0] === "you're eligible" ? reasons.slice(1) : reasons }
    : null;

  return { match, info, chips, reason, why: { headline, matched: matched.slice(0, 6), missing: missing.slice(0, 4), lead }, stats };
}
