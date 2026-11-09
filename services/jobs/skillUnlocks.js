// services/jobs/skillUnlocks.js — ⭐ D185-4 (45q, owner 11-09) · THE REWARD LOOP: "5 jobs this unlocks".
//
// D185 P2c: finishing a check or a module shows "Add <skill> to your résumé" (D178-4 / A155 already: Your run's Proven
// line, through the profile's own skills — nothing added that isn't proven) + the jobs where THAT skill moves the person up
// a tier — D184 B-8's tiers: a posting's tier is how many of the résumé's top skills it asks for (job_tech, the same
// per-posting technologies the board orders by). Adding the skill lifts every posting that asks for it by one; the ones
// shown first are those it lifts INTO the top tier (the alerts' own line, newMatchAlerts.topTierMin), then the closest.
//   • Honest: the skill is a proven one (the caller passes Atlas's proven list); the count is real open postings in the
//     person's placement; before → after are counts of skills, never a made-up score.
//   • ⛔ A126: the reads run on the READ WORKERS (`read.all`).
import { tierSkills } from "./skillTiers.js";
import { technologiesIn } from "../../shared/techVocabulary.js";
import { topTierMin } from "./newMatchAlerts.js";

export const UNLOCKS_SHOWN = 5;

/** PURE. The vocabulary's name for a skill as Atlas names it ("Apache Kafka" → "Kafka"), or null when it has none. */
export function vocabularyName(skill) {
  const hit = technologiesIn(String(skill || ""));
  return hit.length ? hit[0].name : null;
}

/** The person's active, placed job profile and its base résumé — or null. Sync, small (two indexed reads). */
export function activeProfileFor(db, userId) {
  try {
    return db.prepare(`SELECT dp.id, dp.placement_subcategory, dp.placement_level, dp.placed_at, br.content, br.updated_at AS resume_at
        FROM domain_profiles dp JOIN profile_base_resumes br ON br.profile_id = dp.id AND br.user_id = dp.user_id
       WHERE dp.user_id = ? AND dp.is_active = 1 AND dp.placement_subcategory IS NOT NULL LIMIT 1`).get(userId) || null;
  } catch { return null; }
}

/**
 * The jobs a (proven) skill unlocks for this person: { skill, total, intoTop, jobs: [{ job_id, title, company, before,
 * after, of, top }] } — or { skill, total: 0, reason } when there is nothing to say.
 */
export async function unlocksFor(read, profile, skill) {
  const name = vocabularyName(skill);
  if (!name) return { skill, total: 0, jobs: [], reason: "not_a_technology" };
  if (!profile?.placement_subcategory || /\.general$/.test(profile.placement_subcategory)) return { skill: name, total: 0, jobs: [], reason: "not_placed" };
  const top = (await tierSkills(read, profile, profile.content, profile.resume_at)).filter(s => s !== name);
  const of = top.length + 1;
  const need = topTierMin(of);
  const marks = top.map(() => "?").join(",");
  const beforeSql = top.length ? `(SELECT COUNT(*) FROM job_tech b WHERE b.job_id = sj.job_id AND b.tech IN (${marks}))` : "0";
  const rows = await read.all(`SELECT sj.job_id, sj.title, sj.company, ${beforeSql} AS before
      FROM job_tech jt
      JOIN job_taxonomy jx ON jx.job_id = jt.job_id AND jx.subcategory = ?
      JOIN scraped_jobs sj ON sj.job_id = jt.job_id
     WHERE jt.tech = ? AND sj.is_active = 1 AND sj.duplicate_of IS NULL AND sj.retired_at IS NULL
       AND (sj.ghost_level IS NULL OR sj.ghost_level < 2)
     ORDER BY before DESC, COALESCE(sj.posted_at, sj.discovered_at) DESC
     LIMIT 400`, [...top, profile.placement_subcategory, name]);
  const all = (rows || []).map(r => {
    const before = Number(r.before) || 0, after = before + 1;
    return { job_id: r.job_id, title: r.title, company: r.company, before, after, of, top: after >= need && before < need };
  });
  const jobs = [...all.filter(j => j.top), ...all.filter(j => !j.top)].slice(0, UNLOCKS_SHOWN);
  return { skill: name, total: all.length, intoTop: all.filter(j => j.top).length, jobs };
}
