// services/extensionHome.js — ⭐ D191 · THE EXTENSION AS draft's FRONT DOOR: what its home view, its toolbar badge and its
// posting card show — ALL FROM draft's OWN DATA, NO MODEL (the owner's rule, 11-14; D191 (2a): "no model call").
//
//   extensionHome(db, userId, { date })   the person's day: drafted / sent today, how many need them, and today's NEW
//                                          MATCHES = the cards dealt today that they haven't decided (the deck is dealt
//                                          once a day and stored — daily_drafts — so this is a read of ≤ 25 rows, never a
//                                          board pass: a badge read on page loads must not be the A126 / A158 freeze)
//   companyCard(db, { company, url })     a posting's employer: its record (D179), open jobs on draft, the H-1B record
//                                          (sponsorshipFactFor) and its page — read-only, one company per press
// ⛔ Nothing here writes, and nothing calls callTask.
import { findCompany } from "./companies/companyRecords.js";
import { sponsorshipFactFor } from "./kb/sponsorshipFacts.js";
import { decidedJobIds } from "./dailyDraft.js";
import { companySlug } from "../shared/companyPaths.js";

const ORIGIN = "https://jobsviadraft.com";
const NEEDS_YOU = Object.freeze(["held_review", "held_gate"]);

export function extensionHome(db, userId, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const day = db.prepare(`SELECT COUNT(*) AS drafted, SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS sent
    FROM apply_run_jobs WHERE user_id = ? AND created_at >= unixepoch('now', 'start of day')`).get(userId) || {};
  const needsYou = db.prepare(`SELECT COUNT(DISTINCT job_id) FROM apply_run_jobs WHERE user_id = ? AND status IN (${NEEDS_YOU.map(() => "?").join(", ")})`)
    .pluck().get(userId, ...NEEDS_YOU) || 0;
  let newMatches = null;
  try {
    const dealt = db.prepare(`SELECT job_id FROM daily_drafts WHERE user_id = ? AND draft_date = ?`).pluck().all(userId, date);
    if (dealt.length) { const decided = decidedJobIds(db, userId); newMatches = dealt.filter(id => !decided.has(id)).length; }
  } catch { newMatches = null; }
  return { date, drafted: Number(day.drafted) || 0, sent: Number(day.sent) || 0, needsYou: Number(needsYou) || 0, newMatches,
    links: { board: `${ORIGIN}/app`, home: `${ORIGIN}/app/auto-apply`, search: `${ORIGIN}/app/jobs` } };
}

/** The badge's text: today's undecided matches ("" when none or not dealt yet). Pure. */
export function badgeText(home) {
  const n = Number(home?.newMatches) || 0;
  return n > 0 ? (n > 99 ? "99+" : String(n)) : "";
}

export function companyCard(db, { company, url = null } = {}) {
  const name = String(company || "").trim().slice(0, 120);
  if (!name) return null;
  const rec = findCompany(db, { company: name, url });
  let openJobs = null;
  if (rec) {
    try {
      openJobs = db.prepare(`SELECT COUNT(*) FROM job_company jc JOIN scraped_jobs sj ON sj.job_id = jc.job_id
        WHERE jc.company_id = ? AND sj.is_active = 1`).pluck().get(rec.id) || 0;
    } catch { openJobs = null; }
  }
  let sponsorship = null;
  // the H-1B record is keyed by the company string the BOARD stores (company_lca_sponsorship.company) — the posting's own
  // name first, as the board's sponsorship signal reads it; then the D179 record's name when it differs
  for (const key of [...new Set([name, rec?.name].filter(Boolean))]) {
    try { const f = sponsorshipFactFor(db, key); if (f) { sponsorship = { text: f.text, filings: f.filings, fiscalYear: f.fiscalYear, through: f.source?.through || null }; break; } }
    catch { /* no record under this name */ }
  }
  const slug = rec?.slug || companySlug(name) || null;
  return { name: rec?.name || name, known: !!rec, openJobs, sponsorship, href: slug ? `${ORIGIN}/companies/${slug}` : null };
}
