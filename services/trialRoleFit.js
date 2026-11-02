// ⭐ A111 P4 step 4 · "WHAT'S ON OFFER, MAPPED TO YOU" — opening a pick on the own-résumé pathway shows the role against the
// résumé: the ATS report (matched, missing, the level line — the board's one scorer, D122) AND the Atlas reading for the
// role (its top required skills, have / missing, "you cover N of this role's top 15", the next-level skills, the role page).
//
// ⛔⛔ THE SEAM (for the integrator). A111 P3's per-role reading is `roleFitReading(db, { role, jobId, userId, terms,
// resumeText, registry })` in services/atlas/atlasRoleFit.js (merged on main as ccde483; not in this lane's tree). This file
// calls ONE function of exactly that signature and shape, `roleFitReading` below — today a LOCAL stand-in over what this
// tree has (the live matcher's roleOf(title) and the published role page's board data, services/atlas/atlasRolePage.js
// roleBoard, read only). To swap in P3, replace the stand-in with one import:
//     import { roleFitReading } from "./atlas/atlasRoleFit.js";
// and delete `localRoleFitReading` (setAtlasReader stays as a test seam). The shape both answer:
//   { found: true, role: { slug, name, postings, page }, category, categoryLabel, rankedBy, covered, of, line,
//     top: [{ slug, name, kind, postings, share, have, page }], have: [{ slug, name, page }], missing: [{ slug, name, share, page }],
//     nextLevel: [{ from, to, postings, reason?, items: [{ slug, name, share, rise, page, line }] }], job }
//   or { found: false, reason: "unknown_role" | "no_role", job }   (page may be null anywhere)
// The panel (client/src/components/TrialRoleFit.jsx) draws that shape and, on found:false, the posting's own ATS terms.
import { names } from "./trialDemo.js";
import { scoreAtsLocally } from "./localAtsScorer.js";
import { isOwnTrial } from "./trial.js";
import { liveMatcher } from "./atlas/atlasLive.js";
import { roleBoard } from "./atlas/atlasRolePage.js";
import { profileCategory, CATEGORIES } from "./jobs/professionalScope.js";

/** How many of the role's skills the reading ranks (P3: the top 15; the role page publishes 12 today). */
export const ROLE_FIT_TOP = 15;
const NEXT_MAX = 6;
const strip = (t) => String(t ?? "").replace(/<[^>]+>/g, " ");
const atlasPage = (slug) => (slug ? `/app/atlas/${encodeURIComponent(slug)}` : null);
const levelBand = { junior: 0, mid: 1, senior: 2, executive: 2 };

/**
 * The stand-in, in P3's signature and shape. `role` is a role title (the posting's, here); the job is read for the
 * answer's `job`. Have = the résumé names the skill (or `terms` lists it). Published roles only.
 */
export function localRoleFitReading(db, { role, jobId = null, terms = [], resumeText = "", seniority = "mid" } = {}) {
  const job = jobId ? db.prepare("SELECT job_id, title, company FROM scraped_jobs WHERE job_id = ?").get(String(jobId)) || null : null;
  const title = role || job?.title || "";
  if (!title) return { found: false, reason: "no_role", job };
  let roleId = null;
  try { roleId = liveMatcher(db).matcher.roleOf(title); } catch { roleId = null; }
  const node = roleId == null ? null : db.prepare("SELECT slug, name, status FROM atlas_nodes WHERE id = ?").get(roleId);
  let board = null;
  try { board = node ? roleBoard(db, node.slug) : null; } catch { board = null; }
  if (!node || !board?.topSkills?.length) return { found: false, reason: "unknown_role", job };
  const termSet = new Set(terms.map(t => String(t).toLowerCase()));
  const has = (n) => termSet.has(String(n).toLowerCase()) || names(resumeText, n);
  const top = board.topSkills.slice(0, ROLE_FIT_TOP).map(s => ({ slug: s.slug, name: s.name, kind: s.kind, postings: s.postings, share: s.share,
    have: has(s.name), page: atlasPage(s.slug) }));
  const covered = top.filter(t => t.have).length;
  const missing = top.filter(t => !t.have).map(({ slug, name, share, page }) => ({ slug, name, share, page }));
  const nextLevel = (board.nextLevel || []).slice(Math.min(levelBand[seniority] ?? 1, Math.max(0, (board.nextLevel || []).length - 1)))
    .slice(0, 1).map(step => ({ from: step.from, to: step.to, postings: step.postings, ...(step.reason ? { reason: step.reason } : {}),
      items: (step.items || []).filter(i => !has(i.name)).slice(0, NEXT_MAX).map(i => ({ slug: i.slug, name: i.name, share: i.share ?? null,
        rise: i.rise ?? null, page: atlasPage(i.slug), line: i.line || null })) }));
  const category = profileCategory({ target_titles: [title] });
  return {
    found: true, role: { slug: node.slug, name: node.name, postings: board.postings, page: atlasPage(node.slug) },
    category, categoryLabel: category ? CATEGORIES[category]?.label || category : null, rankedBy: "share",
    covered, of: top.length,
    line: `You cover ${covered} of this role's top ${top.length}${missing.length ? ` — missing ${missing.slice(0, 3).map(m => m.name).join(", ")}` : ""}`,
    top, have: top.filter(t => t.have).map(({ slug, name, page }) => ({ slug, name, page })), missing, nextLevel, job,
  };
}

let roleFitReading = localRoleFitReading;
/** Test seam: install a reading of P3's signature (null restores the stand-in). */
export function setAtlasReader(fn) { roleFitReading = typeof fn === "function" ? fn : localRoleFitReading; }

/**
 * The role against the résumé, for one pick: { available, ats: { score, matched, missing, level, scorable }, atlas }
 * where `atlas` is the reading above (found or not). Available only on the own-résumé pathway (a sample's cards already
 * carry their report). The ATS half is THIS user's stored report for the posting (the board's one scorer), else the
 * same scorer run now.
 */
export async function roleFitFor(db, { userId, jobId, registry = null }) {
  if (!isOwnTrial(db, userId)) return { available: false, reason: "not_own_resume" };
  const job = db.prepare("SELECT job_id, title, company, COALESCE(description_text, description) AS description FROM scraped_jobs WHERE job_id = ?").get(String(jobId));
  if (!job) return { available: false, reason: "no_job" };
  const p = db.prepare(`SELECT d.id, d.seniority, b.content FROM domain_profiles d JOIN profile_base_resumes b ON b.profile_id = d.id AND b.user_id = d.user_id
    WHERE d.user_id = ? AND d.is_active = 1`).get(userId);
  if (!p?.content) return { available: false, reason: "no_resume" };
  const resumeText = strip(p.content);
  let report = null;
  try {
    const stored = db.prepare("SELECT ats_report FROM ats_only_reports WHERE user_id = ? AND job_id = ? AND (domain_profile_id IS ? OR domain_profile_id IS NULL) ORDER BY id DESC LIMIT 1")
      .pluck().get(userId, job.job_id, p.id);
    report = stored ? JSON.parse(stored) : null;
  } catch { report = null; }
  if (!report) {
    try { report = scoreAtsLocally({ job: { title: job.title, description: job.description || "" }, resumeText }); } catch { report = null; }
  }
  const terms = (report?.tier1_matched || []).filter(t => typeof t === "string");
  let atlas = null;
  try {
    atlas = await roleFitReading(db, { role: job.title, jobId: job.job_id, userId, terms, resumeText, registry, seniority: p.seniority || "mid" });
  } catch { atlas = null; }
  if (!atlas || typeof atlas.found !== "boolean") atlas = { found: false, reason: "unknown_role", job: { job_id: job.job_id, title: job.title, company: job.company } };
  return {
    available: true, role: job.title,
    ats: { score: Number.isFinite(report?.score) ? report.score : null, matched: terms, missing: (report?.tier1_missing || []).filter(t => typeof t === "string"),
      level: report?.experience?.summary || null, scorable: report?.scorable !== false },
    atlas,
  };
}
