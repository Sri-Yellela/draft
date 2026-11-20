// services/trackers.js — ⭐ D159 T2–T4 (46y) · TRACKERS: follow a search, a company, a careers page or a board, and see what
// is new since you last looked.
//
//   T1  FOLLOW A COMPANY   company_follows (migration 237, the company page's Follow) — now with last_seen_at (279).
//   T2  TRACK A SEARCH     the saved filter set that already exists — domain_profiles.tracked_search_json (FE-3, "Save
//                          Search" in the board's More filters) — becomes a tracker: its sentence (shared/filterSentence.js
//                          sentenceText), and a count of postings first seen since lastSeenAt. ⛔ A93: no second saved search.
//                          The count is the BOARD's own statement (boardPageResponse's `measure`, read workers) — injected by
//                          the router as `countSearch`, so a tracker can never count something the board would not show.
//   T3  TRACK A PAGE       a pasted careers URL. Its ATS board is read with the ONE link parser (hnDiscovery.linksOf →
//                          slugHarvest.harvestPairOf); a board we crawl → a company follow at once; one we don't → the
//                          company-candidate pool (D82: poolCandidates — the nightly probe, then the owner's Approve in Admin →
//                          Companies → Candidates; ⛔ A93: never a second add path) and a pending tracked_pages row that resolves
//                          into a follow once the board is added. A page whose board is not readable from its address is kept as
//                          'unsupported' and said so — ⛔ nothing is fetched on the request (no crawl load on a request path).
//   T4  FOLLOW A BOARD     the same paste, with a Greenhouse / Lever / Ashby (or any crawled vendor's) board URL: the feed is
//                          the company's new postings since last seen.
//
// ⛔ A126 / A158: the feed counts run on the READ WORKERS (`read.all`), one statement per person; the writes are single rows.
// ⛔ D137 / D104: a feed counts only live, non-duplicate postings not scored Likely not hiring (ghost_level < 2) — the
// new-match alerts' rule (services/jobs/newMatchAlerts.js). Eligibility is the board's own when a search is counted.
// ⛔ D190: no model call anywhere here.
import { linksOf, companyFromSlug } from "./jobs/hnDiscovery.js";
import { poolCandidates } from "./companyCandidates.js";
import { atsTenantOf, registrable } from "./companies/companyRecords.js";
import { companyKey as nameKey } from "./jobs/companyLogoStore.js";
import { sentenceText } from "../shared/filterSentence.js";

export const MAX_PAGES = 25;                 // tracked pages a person may hold
export const MAX_URL = 500;
const nowS = () => Math.floor(Date.now() / 1000);
const bad = (status, code, message) => Object.assign(new Error(message), { status, code });
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

/** The live-posting rule the feed counts with (newMatchAlerts' LIVE + NOT A GHOST). */
export const LIVE_SQL = `sj.is_active = 1 AND sj.duplicate_of IS NULL AND sj.retired_at IS NULL AND (sj.ghost_level IS NULL OR sj.ghost_level < 2)`;
export const FIRST_SEEN_EXPR = "COALESCE(sj.discovered_at, sj.scraped_at)";

// ── resolving a page to a company ────────────────────────────────────────────────────────────────────

/** PURE. What a pasted URL is: { kind: 'board', atsType, slug } | { kind: 'site', domain } | { kind: 'none' }. */
export function readPage(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl || "").trim()); } catch { return { kind: "none", reason: "not_a_url" }; }
  if (!/^https?:$/.test(u.protocol)) return { kind: "none", reason: "not_a_url" };
  const { ats, other, site } = linksOf([u.href]);
  if (ats) return { kind: "board", atsType: ats.atsType, slug: ats.slug, url: ats.url, tenant: atsTenantOf(u.href) };
  if (other) return { kind: "none", reason: "unsupported_ats", vendor: other };
  const domain = site ? registrable(u.hostname) : null;
  return domain ? { kind: "site", domain } : { kind: "none", reason: "not_a_careers_page" };
}

/** The company record a page resolves to now, or null. Evidence first (the board's own alias), then the crawled pair's name. */
export function companyForPage(db, page) {
  const alias = db.prepare("SELECT company_id FROM company_aliases WHERE alias_key = ?").pluck();
  if (page.kind === "board") {
    if (page.tenant) { const id = safe(() => alias.get(`ats:${page.tenant.provider}:${page.tenant.tenant}`), null); if (id) return id; }
    const row = safe(() => db.prepare("SELECT company FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)").get(page.atsType, page.slug), null);
    const key = row ? nameKey(row.company) : null;
    return key ? safe(() => alias.get(`name:${key}`), null) : null;
  }
  if (page.kind === "site") return safe(() => alias.get(`domain:${page.domain}`), null);
  return null;
}

const companyRow = (db, id) => safe(() => db.prepare("SELECT id, slug, name FROM companies WHERE id = ?").get(id), null);

function follow(db, userId, companyId, now) {
  db.prepare("INSERT OR IGNORE INTO company_follows (user_id, company_id, last_seen_at) VALUES (?, ?, ?)").run(userId, companyId, now);
}

/**
 * T3 / T4 · follow a pasted page. @returns { status: 'following' | 'pending' | 'unsupported', company?, reason?, page }
 * `pool` is injectable for tests; it is services/companyCandidates.js poolCandidates (the D82 pool) in production.
 */
export function trackPage(db, userId, rawUrl, { pool = poolCandidates, now = nowS() } = {}) {
  const url = String(rawUrl || "").trim();
  if (!url || url.length > MAX_URL) throw bad(400, "bad_url", "Paste a careers page or job board address.");
  const page = readPage(url);
  if (page.reason === "not_a_url") throw bad(400, "bad_url", "That is not a web address. Paste the careers page or job board link.");
  const count = db.prepare("SELECT COUNT(*) FROM tracked_pages WHERE user_id = ?").pluck().get(userId);
  const existing = db.prepare("SELECT * FROM tracked_pages WHERE user_id = ? AND url = ?").get(userId, url);
  if (!existing && count >= MAX_PAGES) throw bad(409, "too_many", `You can track up to ${MAX_PAGES} pages.`);
  const companyId = companyForPage(db, page);
  let status, reason = null, company = null;
  if (companyId) {
    follow(db, userId, companyId, now);
    status = "following"; company = companyRow(db, companyId);
  } else if (page.kind === "board") {
    status = "pending";
    const configured = safe(() => db.prepare("SELECT 1 FROM company_ats_list WHERE ats_type = ? AND lower(ats_slug) = lower(?)").get(page.atsType, page.slug), null);
    if (!configured) {
      // ⛔ D82: the pool only — the nightly probe reads it, the owner approves it. A refused pair (a staffing agency, a
      // denied host) is said so.
      const out = pool(db, [{ company: companyFromSlug({ atsType: page.atsType, slug: page.slug }) || page.slug,
        ats: { atsType: page.atsType, slug: page.slug, url: page.url }, sources: ["user"] }], { source: "user", now });
      const why = Object.keys(out?.skipped || {}).find((k) => k !== "configured" && k !== "configured_name");
      if (why) { status = "unsupported"; reason = why; }
    }
  } else {
    status = "unsupported"; reason = page.reason || "no_board";
  }
  const label = company?.name || (page.kind === "board" ? (companyFromSlug({ atsType: page.atsType, slug: page.slug }) || page.slug) : page.domain || null);
  db.prepare(`INSERT INTO tracked_pages (user_id, url, ats_type, ats_slug, company, status, company_id, created_at, resolved_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(user_id, url) DO UPDATE SET status = excluded.status, company_id = excluded.company_id,
                company = excluded.company, resolved_at = excluded.resolved_at`)
    .run(userId, url, page.atsType || null, page.slug || null, label, status, companyId || null, now, companyId ? now : null);
  return { status, reason, company, label, page: { kind: page.kind, atsType: page.atsType || null, vendor: page.vendor || null } };
}

/** A person's pending pages whose board has since been added → followed. Cheap: their own few rows. */
export function resolvePending(db, userId, { now = nowS() } = {}) {
  const rows = db.prepare("SELECT * FROM tracked_pages WHERE user_id = ? AND status = 'pending'").all(userId);
  let resolved = 0;
  for (const r of rows) {
    const page = readPage(r.url);
    const id = companyForPage(db, page);
    if (!id) continue;
    follow(db, userId, id, now);
    db.prepare("UPDATE tracked_pages SET status = 'following', company_id = ?, company = COALESCE(?, company), resolved_at = ? WHERE id = ?")
      .run(id, companyRow(db, id)?.name || null, now, r.id);
    resolved++;
  }
  return resolved;
}

export function untrackPage(db, userId, id) {
  const r = db.prepare("DELETE FROM tracked_pages WHERE id = ? AND user_id = ?").run(Number(id), userId);
  if (!r.changes) throw bad(404, "not_found", "That page is not on your list.");
  return { removed: true };
}

// ── the list ─────────────────────────────────────────────────────────────────────────────────────────

/** PURE. A saved search's querystring → the sentence it reads as (without the verb). */
export function searchLabel(params) {
  const p = Object.fromEntries(new URLSearchParams(String(params || "")));
  return safe(() => sentenceText(p).replace(/^\S+\s+/, "").replace(/\.$/, ""), "Saved search");
}

/** The synchronous half: every tracker the person has (no counts). */
export function listTrackers(db, userId) {
  const searches = db.prepare(`SELECT id, profile_name, is_active, tracked_search_json FROM domain_profiles
                               WHERE user_id = ? AND tracked_search_json IS NOT NULL ORDER BY id`).all(userId)
    .map((r) => {
      const t = safe(() => JSON.parse(r.tracked_search_json), null);
      if (!t?.params) return null;
      return { profileId: r.id, profileName: r.profile_name, active: !!r.is_active, label: t.name || searchLabel(t.params),
        params: t.params, savedAt: t.savedAt ?? null, lastSeenAt: t.lastSeenAt ?? t.savedAt ?? null };
    }).filter(Boolean);
  const companies = db.prepare(`SELECT f.company_id, f.created_at, f.last_seen_at, c.slug, c.name FROM company_follows f
                                JOIN companies c ON c.id = f.company_id WHERE f.user_id = ? ORDER BY c.name`).all(userId)
    .map((r) => ({ companyId: r.company_id, slug: r.slug, name: r.name, followedAt: r.created_at, lastSeenAt: r.last_seen_at ?? r.created_at }));
  const pages = db.prepare(`SELECT id, url, ats_type, company, status, company_id, created_at FROM tracked_pages
                            WHERE user_id = ? AND status != 'following' ORDER BY created_at DESC`).all(userId)
    .map((r) => ({ id: r.id, url: r.url, atsType: r.ats_type, label: r.company, status: r.status, createdAt: r.created_at }));
  return { searches, companies, pages };
}

/** The feed counts for followed companies — ONE statement on the read workers. @returns Map companyId → n */
export async function companyNewCounts(read, userId) {
  const rows = await read.all(`SELECT f.company_id AS id, COUNT(*) AS n FROM company_follows f
      JOIN job_company jc ON jc.company_id = f.company_id
      JOIN scraped_jobs sj ON sj.job_id = jc.job_id
     WHERE f.user_id = ? AND ${LIVE_SQL} AND ${FIRST_SEEN_EXPR} >= COALESCE(f.last_seen_at, f.created_at)
     GROUP BY f.company_id`, [userId]);
  return new Map((rows || []).map((r) => [r.id, r.n]));
}

/** Marks a followed company's feed seen (now). */
export function markCompanySeen(db, userId, companyId, { now = nowS() } = {}) {
  const r = db.prepare("UPDATE company_follows SET last_seen_at = ? WHERE user_id = ? AND company_id = ?").run(now, userId, Number(companyId));
  if (!r.changes) throw bad(404, "not_found", "You don't follow that company.");
  return { lastSeenAt: now };
}

/** Marks a saved search seen (now): its lastSeenAt rides in the tracked search's own JSON. */
export function markSearchSeen(db, userId, profileId, { now = nowS() } = {}) {
  const row = db.prepare("SELECT tracked_search_json FROM domain_profiles WHERE id = ? AND user_id = ?").get(Number(profileId), userId);
  const t = row ? safe(() => JSON.parse(row.tracked_search_json), null) : null;
  if (!t?.params) throw bad(404, "not_found", "That job profile has no saved search.");
  db.prepare("UPDATE domain_profiles SET tracked_search_json = ? WHERE id = ? AND user_id = ?")
    .run(JSON.stringify({ ...t, lastSeenAt: now }), Number(profileId), userId);
  return { lastSeenAt: now };
}
