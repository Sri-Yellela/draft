// ⭐ A111 P4 step 4 · "WHAT'S ON OFFER, MAPPED TO YOU" — opening a pick on the own-résumé pathway shows the role against the
// résumé: the ATS report (matched, missing, the level line — the board's one scorer, D122) AND the Atlas reading for the
// role (its top required skills, have / missing, "you cover N of this role's top 15", the next-level skills, the role page).
//
// The Atlas half is A111 P3's reading, `roleFitReading` (services/atlas/atlasRoleFit.js): the role's top required skills
// from the board (never another category's), have / missing, "you cover N of this role's top 15", the next-level skills and the
// role page; `{ found: false, reason, job }` when the posting names no known role. The panel (client/src/components/
// TrialRoleFit.jsx) draws that shape and, on found:false, the posting's own ATS terms. `setAtlasReader` is a test seam.
import { scoreAtsLocally } from "./localAtsScorer.js";
import { isOwnTrial } from "./trial.js";
import { roleFitReading as atlasRoleFitReading } from "./atlas/atlasRoleFit.js";

const strip = (t) => String(t ?? "").replace(/<[^>]+>/g, " ");

let roleFitReading = atlasRoleFitReading;
/** Test seam: install a reading of P3's signature (null restores the Atlas' own). */
export function setAtlasReader(fn) { roleFitReading = typeof fn === "function" ? fn : atlasRoleFitReading; }

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
  // The reading links the public mount (/atlas/…); the tester is inside the app, so its links stay there (/app/atlas/…).
  atlas = JSON.parse(JSON.stringify(atlas), (k, v) => (k === "page" && typeof v === "string" ? v.replace(/^\/atlas\//, "/app/atlas/") : v));
  return {
    available: true, role: job.title,
    ats: { score: Number.isFinite(report?.score) ? report.score : null, matched: terms, missing: (report?.tier1_missing || []).filter(t => typeof t === "string"),
      level: report?.experience?.summary || null, scorable: report?.scorable !== false },
    atlas,
  };
}
