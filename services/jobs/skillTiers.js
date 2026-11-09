// services/jobs/skillTiers.js — ⭐ D184 B-8 (45p, owner 11-08) · THE BOARD ORDERS BY HOW MUCH OF THE RÉSUMÉ A JOB MATCHES,
// ONE SKILL LESS AT A TIME.
//
// *"the board in general should show jobs that are highly relevant to this resume and then match downwards subtracting
// one skill at a time as user streams down the board. and this is for every resume change."*
//
//   tierSkills(read, profile, text) — the résumé's skills that matter for its placement: the technologies the résumé names
//       (shared/techVocabulary.js — the ONE vocabulary, B-6), weighted by their SHARE of the active postings in the person's
//       subcategory and level (D178's measure: of those postings, how many ask for it); the top TIER_SKILLS. With no
//       placement, or no postings to weigh by, the résumé's own order stands. Cached per (profile, résumé, placement) —
//       a new résumé or a new placement is a new key, so the board re-ranks on every résumé change (B-8: "for every
//       résumé change"); computed on the READ WORKERS (A126: board reads never on the one thread).
//   skillTierKey(skills) — the ORDER BY term: jobs asking for ALL N first, then N−1, N−2 … (job_tech, the same per-posting
//       technologies the "using [tech]" clause filters by). jobCursor.buildOrderKeys puts it after the rank keys and before
//       fit, so inside a tier the order is ATS match, then recency. No tier labels (D182) — the order speaks for itself.
import { technologiesIn } from "../../shared/techVocabulary.js";

export const TIER_SKILLS = 8;
const CACHE_MAX = 500;
const cache = new Map();   // key → string[]

const LEVEL_TO_BOARD = { intern: "intern", junior: "entry", entry: "entry", mid: "mid", senior: "senior", lead: "lead", executive: "executive" };

/** The résumé's technologies, each once, in the order the résumé names them most. Pure. */
export function resumeTechnologies(text) {
  const t = String(text || "");
  return technologiesIn(t).map(x => x.name)
    .map(name => ({ name, n: (t.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map(x => x.name);
}

/** Order `names` by their share of postings in (subcategory, level); the résumé's own order breaks ties. Pure. */
export function weighByShare(names, counts) {
  const pos = new Map(names.map((n, i) => [n, i]));
  return [...names].sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0) || pos.get(a) - pos.get(b));
}

/**
 * The top skills for a profile's résumé. `read` = { all(sql, params) → Promise<rows> } (the read pool, or a test's db).
 * `profile` = { id, placement_subcategory, placement_level, placed_at }, `text` = its base résumé, `stamp` = its updated_at.
 */
export async function tierSkills(read, profile, text, stamp = null) {
  if (!profile?.id || !String(text || "").trim()) return [];
  const key = `${profile.id}|${stamp ?? ""}|${profile.placed_at ?? ""}|${profile.placement_subcategory ?? ""}|${profile.placement_level ?? ""}|${String(text).length}`;
  if (cache.has(key)) return cache.get(key);
  const names = resumeTechnologies(text);
  let ordered = names;
  if (names.length > 1 && profile.placement_subcategory && !/\.general$/.test(profile.placement_subcategory)) {
    try {
      const level = LEVEL_TO_BOARD[String(profile.placement_level || "").toLowerCase()] || null;
      const marks = names.map(() => "?").join(",");
      const rows = await read.all(`SELECT jt.tech AS tech, COUNT(*) AS n FROM job_taxonomy jx
          JOIN scraped_jobs sj ON sj.job_id = jx.job_id AND sj.is_active = 1 ${level ? "AND sj.experience_level = ?" : ""}
          JOIN job_tech jt ON jt.job_id = jx.job_id AND jt.tech IN (${marks})
         WHERE jx.subcategory = ? GROUP BY jt.tech`, [...(level ? [level] : []), ...names, profile.placement_subcategory]);
      ordered = weighByShare(names, new Map((rows || []).map(r => [r.tech, Number(r.n) || 0])));
    } catch { ordered = names; }
  }
  const top = ordered.slice(0, TIER_SKILLS);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, top);
  return top;
}

/** The ORDER BY term: more of the résumé's top skills first. null when there are none. */
export function skillTierKey(skills) {
  const list = (skills || []).filter(Boolean);
  if (!list.length) return null;
  return {
    sql: `(0 - (SELECT COUNT(*) FROM job_tech jt WHERE jt.job_id = sj.job_id AND jt.tech IN (${list.map(() => "?").join(",")})))`,
    params: list,
  };
}

export function resetSkillTiers() { cache.clear(); }
