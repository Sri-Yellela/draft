// services/learn/stackExposure.js — ⭐ D154 P9 (45n) · "HOW EXPOSED IS MY STACK" — honestly, from OUR postings only.
//
// For each technology the person has (yourSkillStates — the same list Your map shows) that the posting scanner knows
// (job_tech, services/companies/companyTech.js): how many of the board's OPEN postings ask for it, its share of the open
// board, and the trend — postings first seen in the last 30 days against the 30 before. The scope is always said:
// "of N open postings on draft", never "the market". A technology with fewer than MIN_RECENT postings in both windows
// says "too few postings to tell" instead of a trend. ⛔ No model, no forecast, no "AI will replace" claim.
// ⛔ D151: never a whole-board pass on a request — one indexed read per technology (idx_job_tech_tech), capped at
// MAX_TECH, and the answer cached per person for CACHE_MS.
import { yourSkillStates } from "../yourSkills.js";
import { TECHNOLOGIES } from "../../shared/techVocabulary.js";

export const EXPOSURE = Object.freeze({ MAX_TECH: 30, MIN_RECENT: 10, WINDOW_DAYS: 30, CACHE_MS: 60 * 60 * 1000, RISING: 1.2, FALLING: 0.8 });
const DAY = 86400;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const norm = (s) => String(s || "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const cache = new Map();   // userId → { at, value }
let openCache = null;      // { at, n } — the open board's size, shared by everyone, read at most once an hour
// The scanner's own names and aliases → its canonical name (exact, so a skill called "Go" or "golang" is Go).
const CANON = new Map(TECHNOLOGIES.flatMap(([name, _g, ...aliases]) => [name, ...aliases].map(a => [norm(a), name])));
const SEC = (col) => `(CASE WHEN ${col} > 100000000000 THEN ${col} / 1000 ELSE ${col} END)`;   // ms or s, as companyTech reads it

/** Pure: the trend word for two window counts. */
export function trendOf(recent, before) {
  if (recent < EXPOSURE.MIN_RECENT && before < EXPOSURE.MIN_RECENT) return "too_few";
  if (!before) return "rising";
  const r = recent / before;
  return r >= EXPOSURE.RISING ? "rising" : r <= EXPOSURE.FALLING ? "falling" : "steady";
}
const TREND_WORDS = { rising: "asked for more often lately", falling: "asked for less often lately", steady: "about as often as before", too_few: "too few postings to tell" };

export function stackExposure(db, userId, { now = Math.floor(Date.now() / 1000), fresh = false } = {}) {
  const hit = cache.get(userId);
  if (!fresh && hit && Date.now() - hit.at < EXPOSURE.CACHE_MS) return hit.value;
  const mine = [...new Set(safe(() => yourSkillStates(db, userId), []).map(s => CANON.get(norm(s.name))).filter(Boolean))].slice(0, EXPOSURE.MAX_TECH);
  if (!openCache || Date.now() - openCache.at > EXPOSURE.CACHE_MS) {
    openCache = { at: Date.now(), n: safe(() => db.prepare(`SELECT COUNT(*) FROM scraped_jobs WHERE is_active = 1 AND duplicate_of IS NULL`).pluck().get(), 0) || 0 };
  }
  const open = openCache.n;
  const read = db.prepare(`SELECT
      SUM(CASE WHEN sj.is_active = 1 THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN ${SEC("COALESCE(sj.discovered_at, sj.scraped_at)")} >= ? THEN 1 ELSE 0 END) AS recent,
      SUM(CASE WHEN ${SEC("COALESCE(sj.discovered_at, sj.scraped_at)")} >= ? AND ${SEC("COALESCE(sj.discovered_at, sj.scraped_at)")} < ? THEN 1 ELSE 0 END) AS before
    FROM job_tech jt JOIN scraped_jobs sj ON sj.job_id = jt.job_id WHERE jt.tech = ? AND sj.duplicate_of IS NULL`);
  const w = EXPOSURE.WINDOW_DAYS * DAY;
  const rows = mine.map(tech => {
    const c = safe(() => read.get(now - w, now - 2 * w, now - w, tech), null) || {};
    const trend = trendOf(c.recent || 0, c.before || 0);
    return { tech, open: c.open || 0, share: open ? Math.round(((c.open || 0) / open) * 1000) / 10 : 0,
      recent: c.recent || 0, before: c.before || 0, trend, words: TREND_WORDS[trend] };
  }).sort((a, b) => b.open - a.open);
  const value = { scope: `of ${open.toLocaleString("en-US")} open postings on draft`, open, windowDays: EXPOSURE.WINDOW_DAYS, stack: rows,
    unmatched: !rows.length ? "None of your skills is a technology our posting scanner reads yet." : null };
  cache.set(userId, { at: Date.now(), value });
  return value;
}
