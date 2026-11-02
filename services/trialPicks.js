// ⭐ D124 AMENDED (owner 11-01) · THE TRIAL OFFERS 10 GOOD PICKS — per sample, from that sample's own category.
//
// A pick is a posting the tester could honestly be shown: in the sample's category (D127 — never another one's, never a
// held one), active and not a duplicate, free of an eligibility bar (citizenship / clearance), at a level the sample can
// apply for, and ranked by the local ATS score against the sample's own résumé (no model). A sample is OFFERED only
// when its category has at least PICKS_PER_SAMPLE such postings — otherwise it is hidden that day, never padded with
// another category's jobs. "Use my own résumé" gets the same from the résumé's category, or an honest "not live yet".
//
// Scoring is ≈ 7 ms a posting, so candidates are capped (the most recent SCORE_CAP) and the result is cached per sample
// per day and per board size. The picks are what D129's tour deals; the board itself is unchanged.
import { scoreAtsLocally } from "./localAtsScorer.js";
import { samples, SAMPLE_IDS } from "./trial.js";
import { categoryOf, profileCategory } from "./jobs/professionalScope.js";

export const PICKS_PER_SAMPLE = 10;
export const SCORE_CAP = 120;
/** Score this many postings, then give the event loop back (43y fix: the scoring blocked the whole server for 27 s). */
export const YIELD_EVERY = 8;
const breathe = () => new Promise(r => setImmediate(r));

/** The posting levels a résumé at this seniority may be shown (the posting's level_read, else its title bucket). */
export const LEVEL_FIT = Object.freeze({
  junior: ["entry", "early", "mid"],
  mid: ["entry", "early", "mid"],
  senior: ["mid", "senior", "manager"],
});

export const MIN_SKILL_OVERLAP = 2;
/** An ATS-ranked posting is a GOOD pick only at or above this score (spot-check 11-01: 21-28 were other disciplines' roles). */
export const GOOD_ATS_SCORE = 30;
/**
 * An engineering sample is dealt its own discipline and its near neighbours only: a mechanical engineer is not a good
 * candidate for a substation protection role, though both are category `engineering` (spot-check 11-01).
 */
export const DISCIPLINE_NEAR = Object.freeze({
  mechanical: ["mechanical", "industrial", "quality", "aerospace", "automotive", "controls", "materials", "biomedical"],
  electrical: ["electrical", "hardware", "controls", "quality"],
  hardware: ["hardware", "electrical"],
  civil: ["civil", "environmental", "architecture"],
  chemical: ["chemical", "materials", "environmental", "industrial"],
  industrial: ["industrial", "quality", "mechanical"],
});

/** The résumé's own listed skills: the values of its SKILLS section's rows ("CAD and analysis: SolidWorks, Creo, …"). */
export function resumeSkills(text) {
  const lines = String(text || "").split(/\r?\n/);
  const at = lines.findIndex(l => /^\s*(?:technical\s+)?skills\s*$/i.test(l));
  if (at < 0) return [];
  const out = new Set();
  for (const line of lines.slice(at + 1)) {
    if (/^\s*[A-Z][A-Z &]+\s*$/.test(line)) break;                 // the next section's heading
    const values = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
    for (const v of values.split(/[,;|]/)) {
      const t = v.replace(/\([^)]*\)/g, "").trim().toLowerCase();
      if (t.length >= 2 && t.length <= 40) out.add(t);
    }
  }
  return [...out];
}

/** How many of those skills the posting names, as whole words. */
export function skillOverlap(skills, text) {
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9+#&./ -]/g, " ")} `;
  let n = 0;
  for (const s of skills) {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`[^a-z0-9]${esc}[^a-z0-9]`).test(t)) n++;
  }
  return n;
}

const cache = new Map();
const inflight = new Map();
const today = (now) => new Date(now).toISOString().slice(0, 10);

/** How many of a category's postings are read (titles only) to choose the SCORE_CAP that are scored. */
export const TITLE_POOL = 3000;
const STOP = new Set(["senior", "junior", "lead", "staff", "principal", "associate", "assistant", "i", "ii", "iii", "iv", "sr", "jr", "of", "and", "the", "a", "an", "for", "to", "in", "at"]);
const titleWords = (t) => String(t || "").toLowerCase().split(/[^a-z0-9&+]+/).filter(w => w.length > 1 && !STOP.has(w));

/**
 * ⭐ A111 (11-02): which postings are SCORED. Before, the SCORE_CAP most recent in the category — on a board across
 * industries that was mostly the category's generic catch-alls ("Clinical Field Specialist", "Bank Operations Imaging
 * Specialist" for a financial analyst). Now the category's postings are ranked by how close the title is to the résumé's
 * target title(s) — the same occupation code first (categoryOf's soc: Financial Analyst 13-2051, not the 13-1199
 * catch-all), then the share of the target's words the title has — then by recency, and the top SCORE_CAP are scored.
 * With no target titles it is the old order.
 */
function candidates(db, category, seniority, targets = []) {
  const levels = LEVEL_FIT[seniority] || LEVEL_FIT.mid;
  const marks = levels.map(() => "?").join(",");
  // The pool reads titles only; descriptions are read for the SCORE_CAP chosen (3,000 descriptions held the event loop).
  const rows = db.prepare(`SELECT job_id, title, company, location, ${targets.length ? "NULL AS description" : "description"}, discipline, soc FROM scraped_jobs
    WHERE is_active = 1 AND duplicate_of IS NULL AND board_category = ?
      AND COALESCE(level_read, bucket_seniority, 'mid') IN (${marks})
      AND COALESCE(req_citizenship, '') NOT IN ('citizen_only', 'us_person')
      AND COALESCE(req_clearance, 'none') IN ('none', '')
    ORDER BY COALESCE(posted_at, discovered_at) DESC LIMIT ?`).all(category, ...levels, targets.length ? TITLE_POOL : SCORE_CAP);
  if (!targets.length) return rows;
  const socs = new Set(targets.map(t => categoryOf({ title: t }).soc).filter(s => s && !s.endsWith("1199")));
  const words = targets.map(t => new Set(titleWords(t))).filter(s => s.size);
  const closeness = (r) => {
    const w = new Set(titleWords(r.title));
    const share = Math.max(0, ...words.map(ws => [...ws].filter(x => w.has(x)).length / ws.size));
    return (socs.has(r.soc) ? 1 : 0) + share;
  };
  const chosen = rows.map((r, i) => ({ r, i, c: closeness(r) })).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, SCORE_CAP).map(x => x.r);
  const text = db.prepare("SELECT description FROM scraped_jobs WHERE job_id = ?").pluck();
  for (const r of chosen) r.description = text.get(r.job_id);
  return chosen;
}

/**
 * Up to `limit` picks for a résumé in a category: [{ job_id, title, company, location, score }], best first.
 * A posting whose own title the category rule does not place in `category` is skipped — the stored column is the
 * fast filter, the rule is the guard (D127: no cross-category pick, ever).
 */
/**
 * ASYNC, and it yields every YIELD_EVERY postings: scoring is ≈ 7 ms a posting and must never hold the server (43y fix,
 * 11-01 — the synchronous version blocked every request for 27 s on the first /try). One computation per key is shared by
 * every caller that arrives while it runs.
 */
export async function picksFor(db, opts) {
  const key = opts.cacheKey && `${opts.cacheKey}:${today(opts.now ?? Date.now())}`;
  if (key && inflight.has(key)) return inflight.get(key);
  const run = picksNow(db, opts).finally(() => key && inflight.delete(key));
  if (key) inflight.set(key, run);
  return run;
}

async function picksNow(db, { category, seniority = "mid", resumeText, discipline = null, targets = [], limit = PICKS_PER_SAMPLE, now = Date.now(), cacheKey = null }) {
  if (!category || !resumeText) return [];
  // Per day: picks are recomputed once a day (warmed at boot), not on every crawl's change of the board's size.
  const key = cacheKey && `${cacheKey}:${today(now)}`;
  const near = discipline ? new Set(DISCIPLINE_NEAR[discipline] || [discipline]) : null;
  const hit = key && cache.get(key);
  // A full set holds for the day; a short one (the sample is hidden) is re-checked after an hour, as the board fills.
  if (hit && (hit.out.length >= limit || now - hit.at < 3600_000)) return hit.out;
  const scored = [];
  const skills = resumeSkills(resumeText);
  let n = 0;
  for (const j of candidates(db, category, seniority, targets)) {
    if (++n % YIELD_EVERY === 0) await breathe();
    const v = categoryOf({ title: j.title });
    if (v.category !== category) continue;
    if (near && !near.has(v.discipline)) continue;
    let score = null;
    try { score = scoreAtsLocally({ job: { title: j.title, description: j.description || "" }, resumeText }).score; } catch { /* unscorable */ }
    // ⚠ Measured 11-01: the scorer extracts 0 terms from non-CS postings (its vocabulary is computing's — D126 P3 extends
    // it). Until then a declined posting is ranked by how many of the résumé's OWN listed skills it names, and is a
    // "good" pick only when it names at least MIN_SKILL_OVERLAP of them. `basis` says which ranking produced the pick.
    const overlap = skillOverlap(skills, `${j.title} ${j.description || ""}`);
    if (score == null ? overlap < MIN_SKILL_OVERLAP : score < GOOD_ATS_SCORE) continue;
    scored.push({ job_id: j.job_id, title: j.title, company: j.company, location: j.location, score, overlap,
                  basis: score == null ? "skills_overlap" : "ats" });
  }
  // ATS-scored picks first (best score), then overlap-ranked ones (most skills named).
  const out = scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.overlap - a.overlap).slice(0, limit);
  if (key) cache.set(key, { at: now, out });
  return out;
}

/** One sample's picks (from its own category, level and résumé). */
export async function samplePicks(db, id, opts = {}) {
  const s = samples()[id];
  if (!s) return [];
  const discipline = categoryOf({ title: s.targetTitle || "", roleKey: s.roleFamily }).discipline;
  return picksFor(db, { category: s.category, seniority: s.seniority, resumeText: s.resumeText, discipline, targets: s.targetTitle ? [s.targetTitle] : [], cacheKey: `sample:${id}`, ...opts });
}

/** Every sample with whether it is offered today: offered only with ≥ PICKS_PER_SAMPLE picks. */
export async function offeredSamples(db, opts = {}) {
  const out = [];
  for (const id of SAMPLE_IDS) {
    const s = samples()[id];
    const picks = (await samplePicks(db, id, opts)).length;
    out.push({ id, label: s.label, category: s.category, picks, offered: picks >= PICKS_PER_SAMPLE });
  }
  return out;
}

/** "Use my own résumé": picks from the active profile's category, or the honest reason there are none. */
export async function ownPicks(db, userId, opts = {}) {
  const p = db.prepare(`SELECT d.id, d.role_family, d.target_titles, d.profile_name, d.seniority, b.content FROM domain_profiles d
    LEFT JOIN profile_base_resumes b ON b.profile_id = d.id AND b.user_id = d.user_id
    WHERE d.user_id = ? AND d.is_active = 1`).get(userId);
  if (!p?.content) return { picks: [], reason: "no_resume" };
  const category = profileCategory(p);
  const titles = (() => { try { return JSON.parse(p.target_titles || "[]"); } catch { return []; } })();
  const discipline = category === "engineering" ? (titles.map(t => categoryOf({ title: t }).discipline).find(Boolean) || null) : null;
  if (!category) return { picks: [], reason: "field_not_live", category: null };
  // A111: "executive" (the onboarding's fourth level) reads as senior, as services/trialOwn.js picksSeniority does.
  const seniority = ["senior", "lead", "manager", "staff", "principal", "executive"].includes(p.seniority) ? "senior"
    : ["junior", "entry", "intern"].includes(p.seniority) ? "junior" : "mid";
  const picks = await picksFor(db, { category, seniority, discipline, resumeText: String(p.content).replace(/<[^>]+>/g, " "), targets: titles.filter(t => typeof t === "string").slice(0, 5), cacheKey: `own:${userId}:${p.id}`, ...opts });
  return picks.length >= PICKS_PER_SAMPLE ? { picks, category } : { picks: [], category, reason: "field_not_live" };
}

/** Test seam: forget the day's cache. */
export function clearPicksCache() { cache.clear(); inflight.clear(); }
