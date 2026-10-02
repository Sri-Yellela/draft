// ── Company list management (A50 step 4) — the growth lever, as a surface ─────────────────────
//
// docs/ADMIN_PANEL_REVAMP.md §3: "Company list management is the one I would build first. It is the
// product's growth lever and it is currently invisible" — companies arrived only as migrations.
// docs/COMPANY_LIST_STRATEGY.md §4: ⛔ validate every slug before enabling — a URL proves a page
// existed, not that a board is worth crawling, and a 404 (dead slug) must be distinguishable from an
// empty-but-alive board.
//
// Every write is logged in admin_audit_log (migration 119) with the value it replaced, and nothing
// here deletes: a company is retired by `active = 0`, which the crawl already honours.
import { fetchCompanyJobs as greenhouse } from "./jobs/sources/greenhouse.js";
import { fetchCompanyJobs as lever } from "./jobs/sources/lever.js";
import { fetchCompanyJobs as ashby } from "./jobs/sources/ashby.js";
import { fetchCompanyJobs as smartrecruiters } from "./jobs/sources/smartrecruiters.js";
import { fetchCompanyJobs as workable } from "./jobs/sources/workable.js";
import { fetchCompanyJobs as recruitee } from "./jobs/sources/recruitee.js";
import { fetchCompanyJobs as workday } from "./jobs/sources/workday.js";
import { usEligibility } from "./jobs/usLocation.js";

export const ATS_FETCHERS = Object.freeze({ greenhouse, lever, ashby, smartrecruiters, workable, recruitee, workday });
const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._|-]{0,119}$/;
const AUDIT = { ADD: "company_add", ACTIVE: "company_active" };

/** Every configured company with what the board actually holds from it. */
export function listCompanies(db) {
  return db.prepare(`
    SELECT c.id, c.company, c.ats_type, c.ats_slug, c.active, c.bucket_role, c.created_at,
           (SELECT COUNT(*) FROM scraped_jobs sj WHERE sj.source = c.ats_type AND sj.is_active = 1
              AND lower(sj.company) = lower(c.company)) AS active_rows,
           (SELECT MAX(sj.discovered_at) FROM scraped_jobs sj WHERE sj.source = c.ats_type
              AND lower(sj.company) = lower(c.company)) AS last_new_at
    FROM company_ats_list c ORDER BY c.active DESC, c.company COLLATE NOCASE
  `).all();
}

/**
 * Slugs users' captures and admin imports have named that are NOT configured — A45's harvest, read
 * from job_captures (A62). Ranked by how many distinct people brought one in.
 */
export function harvestedSuggestions(db, limit = 50) {
  try {
    return db.prepare(`
      SELECT jc.ats_type, jc.ats_slug, COUNT(*) AS captures, COUNT(DISTINCT jc.user_id) AS people,
             MAX(jc.created_at) AS last_at
      FROM job_captures jc
      WHERE jc.ats_type IS NOT NULL AND jc.ats_slug IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM company_ats_list c WHERE c.ats_type = jc.ats_type AND lower(c.ats_slug) = lower(jc.ats_slug))
      GROUP BY jc.ats_type, lower(jc.ats_slug)
      ORDER BY people DESC, captures DESC LIMIT ?
    `).all(limit);
  } catch { return []; }   // a database without migration 122
}

/**
 * Probe a board. Distinguishes the three states the strategy doc names:
 *   dead     the ATS answered 404 / not found — the slug is wrong or the board is gone
 *   empty    the board answered with zero postings — alive, nothing to crawl today
 *   live     postings, with how many carry positive US evidence (queue 37 would admit only those)
 */
export async function validateBoard({ atsType, slug, company = "", fetchers = ATS_FETCHERS }) {
  const fetch = fetchers[atsType];
  if (!fetch) return { ok: false, state: "unsupported", message: `No crawler for "${atsType}".` };
  if (!SLUG_RE.test(String(slug || ""))) return { ok: false, state: "invalid", message: "That slug has characters no board slug has." };
  let jobs;
  try {
    jobs = await fetch(slug, company || slug, []);
  } catch (e) {
    const status = e?.response?.status ?? e?.status ?? null;
    if (status === 404 || status === 410) return { ok: false, state: "dead", status, message: `The board answered ${status} — the slug is wrong or the board is gone.` };
    return { ok: false, state: "error", status, message: `The board could not be read (${status ?? e?.code ?? "network error"}). Try again; do not enable on this.` };
  }
  const list = Array.isArray(jobs) ? jobs : [];
  if (!list.length) return { ok: true, state: "empty", jobs: 0, us: 0, sample: [],
    message: "The board is alive but has no postings right now. Enabling it is safe; it will add nothing until it posts." };
  const us = list.filter(j => usEligibility({ location: j.location, description: j.description, offices: [] }).admit).length;
  return { ok: true, state: "live", jobs: list.length, us, sample: list.slice(0, 5).map(j => ({ title: j.title, location: j.location })),
    companyGuess: list[0]?.company || null,
    message: `${list.length} posting(s); ${us} with positive US evidence — only those reach the board.` };
}

function audit(db, adminUserId, action, target, before, after) {
  try {
    db.prepare("INSERT INTO admin_audit_log (admin_user_id, action, target, before_json, after_json) VALUES (?, ?, ?, ?, ?)")
      .run(adminUserId ?? null, action, String(target), before == null ? null : JSON.stringify(before), JSON.stringify(after));
  } catch { /* a database without migration 119 still works; the log is what is lost */ }
}

export function addCompany(db, { company, atsType, slug, bucketRole = null, adminUserId = null }) {
  const existing = db.prepare("SELECT * FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)").get(atsType, slug);
  if (existing) return { ok: false, code: "exists", company: existing };
  const id = db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active, bucket_role) VALUES (?, ?, ?, 1, ?)")
    .run(String(company).trim(), atsType, slug, bucketRole).lastInsertRowid;
  const row = db.prepare("SELECT * FROM company_ats_list WHERE id = ?").get(id);
  audit(db, adminUserId, AUDIT.ADD, `${atsType}:${slug}`, null, row);
  return { ok: true, company: row };
}

export function setCompanyActive(db, { id, active, adminUserId = null }) {
  const before = db.prepare("SELECT * FROM company_ats_list WHERE id = ?").get(Number(id));
  if (!before) return { ok: false, code: "not_found" };
  db.prepare("UPDATE company_ats_list SET active = ? WHERE id = ?").run(active ? 1 : 0, before.id);
  const after = db.prepare("SELECT * FROM company_ats_list WHERE id = ?").get(before.id);
  audit(db, adminUserId, AUDIT.ACTIVE, `${before.ats_type}:${before.ats_slug}`, before, after);
  return { ok: true, company: after };
}
