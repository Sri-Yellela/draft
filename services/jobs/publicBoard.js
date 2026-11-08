// services/jobs/publicBoard.js — ⭐ D179 P3 (45l) · THE OPEN BOARD: every shown job, browsable signed out.
//
// Owner 11-07: "i want all the jobs open for everyone to see". D179 (3) + the 11-07 overrides: the SAME jobs page signed
// out, without the personal parts; acting (save, draft, apply) asks to sign up. This is its data:
//   · publicBoardPage — the postings (public fields only — nothing about any user), filtered with the board's OWN filter
//     vocabulary (jobQuery.buildJobFilters: q, places, work models, levels, posted, sponsorship …) plus the taxonomy's
//     category / subcategory (job_taxonomy, D179 P2), newest first, paged;
//   · publicBoardFacets — Category → Subcategory with TRUE counts (D153 (2)'s rule: an option counts only postings KNOWN
//     to be in it; the unclassified are their own number, so options + unclassified = the total), over the same filters
//     minus the taxonomy's own;
//   · held and closed postings never appear (D127 / D128: publicJobPage's PUBLIC_OPEN_SQL), no user data anywhere.
// LOAD (D179 (3)): every read goes through the caller's reader (the A126 read pool on production) and is kept in a short
// cache keyed by the exact query; the route rate-limits per IP (publicRateLimit). A whole-board facet aggregate is the
// one expensive read — cached for FACETS_TTL_MS.
import { buildJobFilters } from "./jobQuery.js";
import { PUBLIC_OPEN_SQL, jobPath } from "./publicJobPage.js";
import { taxonomy } from "./taxonomyClassify.js";

export const PAGE_SIZE = 30, MAX_PAGE = 200, PAGE_TTL_MS = 60_000, FACETS_TTL_MS = 5 * 60_000;
const OPEN = PUBLIC_OPEN_SQL.replace(/\b(is_active|duplicate_of|board_category)\b/g, "sj.$1");
// The board's own filter keys a signed-out visitor may set (nothing profile-derived, nothing personal).
export const PUBLIC_PARAMS = Object.freeze(["q", "places", "work_models", "experience_levels", "employment_types", "posted_after",
  "sponsorship_friendly", "company_sponsorship", "salary_min_usd", "hide_ghost", "truly_entry"]);
const ID_RE = /^[a-z0-9][a-z0-9.-]{0,60}$/;

const cache = new Map();   // key → { at, value }
function cached(key, ttl, compute) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const p = Promise.resolve().then(compute).then((value) => { cache.set(key, { at: Date.now(), value }); return value; },
    (e) => { cache.delete(key); throw e; });
  cache.set(key, { at: Date.now(), value: p });
  if (cache.size > 2000) for (const k of [...cache.keys()].slice(0, 500)) cache.delete(k);
  return p;
}

/** Only the public keys, as strings; category / subcategory checked against the taxonomy. */
export function publicParams(query = {}) {
  const out = {};
  for (const k of PUBLIC_PARAMS) if (query[k] != null && String(query[k]).trim() !== "") out[k] = String(query[k]).slice(0, 300);
  let tax = null; try { tax = taxonomy(); } catch { tax = null; }
  const cat = String(query.category || "").toLowerCase(), sub = String(query.subcategory || "").toLowerCase();
  if (tax && ID_RE.test(cat) && tax.byId.has(cat) && !tax.byId.get(cat).held) out.category = cat;
  if (tax && ID_RE.test(sub)) for (const c of tax.categories) if (!c.held && c.subs.some(s => s.id === sub)) { out.subcategory = sub; out.category = c.id; }
  const page = Math.min(MAX_PAGE, Math.max(1, Number(query.page) || 1));
  return { params: out, page };
}

function whereOf(params, { withTaxonomy = true } = {}) {
  const f = buildJobFilters(params);
  let sql = `WHERE ${OPEN} ${f.sql}`;
  const args = [...f.params];
  if (withTaxonomy && params.subcategory) { sql += " AND jt.subcategory = ?"; args.push(params.subcategory); }
  else if (withTaxonomy && params.category) { sql += " AND jt.category = ?"; args.push(params.category); }
  return { sql, args };
}

const FROM = `FROM scraped_jobs sj
  LEFT JOIN job_taxonomy jt ON jt.job_id = sj.job_id
  LEFT JOIN job_company jc ON jc.job_id = sj.job_id
  LEFT JOIN companies co ON co.id = jc.company_id`;

/** One page of the open board. `read` = { all(sql, args), get(sql, args) } (the read pool, or a db wrapper). */
export function publicBoardPage(read, query = {}) {
  const { params, page } = publicParams(query);
  const key = `page:${JSON.stringify(params)}:${page}`;
  return cached(key, PAGE_TTL_MS, async () => {
    const w = whereOf(params);
    const rows = await read.all(`SELECT sj.id, sj.job_id, sj.title, sj.company, sj.location, sj.tag_workplace AS workplace,
        sj.salary_min_usd, sj.salary_max_usd, sj.posted_at, sj.discovered_at, jt.category, jt.subcategory, co.slug AS company_slug
      ${FROM} ${w.sql}
      ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT ? OFFSET ?`, [...w.args, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE]);
    const total = (await read.get(`SELECT COUNT(*) AS n ${FROM} ${w.sql}`, w.args))?.n ?? null;
    return {
      page, pageSize: PAGE_SIZE, total, more: rows.length > PAGE_SIZE,
      jobs: rows.slice(0, PAGE_SIZE).map(r => ({
        id: r.id, title: r.title, company: r.company, companySlug: r.company_slug || null, location: r.location || null,
        workplace: r.workplace || null, salaryMinUsd: r.salary_min_usd ?? null, salaryMaxUsd: r.salary_max_usd ?? null,
        postedAt: r.posted_at || null, category: r.category || null, subcategory: r.subcategory || null, path: jobPath(r),
      })),
      params,
    };
  });
}

/**
 * Category → Subcategory with true counts, over the filters minus the taxonomy's own. `unclassified` = postings with no
 * category on file; categories' postings + unclassified = total. Names come from the taxonomy; held categories never shown.
 */
export function publicBoardFacets(read, query = {}) {
  const { params } = publicParams(query);
  const { category, subcategory, ...rest } = params;
  const key = `facets:${JSON.stringify(rest)}`;
  return cached(key, FACETS_TTL_MS, async () => {
    const w = whereOf(rest, { withTaxonomy: false });
    const rows = await read.all(`SELECT jt.category, jt.subcategory, COUNT(*) AS n ${FROM} ${w.sql} GROUP BY jt.category, jt.subcategory`, w.args);
    let tax = null; try { tax = taxonomy(); } catch { tax = null; }
    const name = (cid) => tax?.byId.get(cid)?.name || cid;
    const subName = (cid, sid) => tax?.byId.get(cid)?.subs.find(s => s.id === sid)?.name || sid;
    const cats = new Map();
    let total = 0, unclassified = 0;
    for (const r of rows) {
      total += r.n;
      if (!r.category || tax?.byId.get(r.category)?.held) { unclassified += r.n; continue; }
      const c = cats.get(r.category) || { id: r.category, name: name(r.category), count: 0, subcategories: [] };
      c.count += r.n;
      if (r.subcategory) c.subcategories.push({ id: r.subcategory, name: subName(r.category, r.subcategory), count: r.n });
      cats.set(r.category, c);
    }
    const categories = [...cats.values()].map(c => ({ ...c, subcategories: c.subcategories.sort((a, b) => b.count - a.count) }))
      .sort((a, b) => b.count - a.count);
    return { total, unclassified, categories, version: tax?.version ?? null };
  });
}

/** A per-IP fixed-window limiter for the public routes: `limit` requests per `windowMs`. */
export function publicRateLimit({ limit = 120, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = String(req.ip || req.socket?.remoteAddress || "?");
    const t = now();
    const h = hits.get(ip);
    if (!h || t - h.start >= windowMs) hits.set(ip, { start: t, n: 1 });
    else if (++h.n > limit) { res.set("Retry-After", String(Math.ceil((h.start + windowMs - t) / 1000))); return res.status(429).json({ error: "rate_limited" }); }
    if (hits.size > 50_000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
    next();
  };
}
