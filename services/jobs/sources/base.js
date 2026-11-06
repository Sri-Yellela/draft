/**
 * JOB SOURCE PLUGIN INTERFACE
 *
 * Every source plugin must export an object matching this shape.
 * Register plugins in services/jobs/aggregator.js — nowhere else.
 *
 * Example minimal plugin:
 *
 *   export default {
 *     name: 'mysource',
 *     isConfigured: () => !!process.env.MYSOURCE_API_KEY,
 *     search: async ({ query, location, page, pageSize, country }) => {
 *       // fetch from API
 *       // normalize each result with normalizeJob()
 *       return { jobs: [...], total: 0, page: 1, pageSize: 10 };
 *     },
 *   };
 */

function validatePlugin(plugin) {
  const required = ['name', 'isConfigured', 'search'];
  for (const field of required) {
    if (typeof plugin[field] === 'undefined') {
      throw new Error(`Job source plugin "${plugin.name || '?'}" missing required field: ${field}`);
    }
  }
  if (typeof plugin.isConfigured !== 'function') {
    throw new Error(`Plugin "${plugin.name}": isConfigured must be a function`);
  }
  if (typeof plugin.search !== 'function') {
    throw new Error(`Plugin "${plugin.name}": search must be a function`);
  }
}

/**
 * Search params passed to every plugin's search() function.
 * Plugins may ignore fields they don't support.
 */
const SEARCH_PARAMS_SCHEMA = {
  query:    'string  — job title or keyword',
  location: 'string  — city, state, or "remote"',
  country:  'string  — ISO 3166-1 alpha-2 e.g. "us" (default: "us")',
  page:     'number  — 1-based page number (default: 1)',
  pageSize: 'number  — results per page (default: 10, max: 50)',
};

/**
 * Shape every plugin's search() must resolve to.
 */
const SEARCH_RESULT_SCHEMA = {
  jobs:     'NormalizedJob[]',
  total:    'number — total results available from this source',
  page:     'number — current page',
  pageSize: 'number — results per page',
  source:   'string — plugin name (set automatically by aggregator)',
};

/**
 * Collect per-company fetch results into one job list, capping EACH COMPANY rather than the
 * concatenation.
 *
 * ⛔ THIS EXISTS BECAUSE THE OBVIOUS VERSION SILENTLY LOST 60% OF THE BOARD. All seven ATS
 * plugins carried a copy of:
 *
 *     const MAX = pageSize * 3;
 *     results.flatMap(r => r.status === 'fulfilled' ? r.value : []).slice(0, MAX)
 *
 * `_companies` arrives from `SELECT * FROM company_ats_list WHERE active = 1` with no ORDER BY, so
 * it is in sqlite rowid order; `flatMap` concatenates each company's postings in that order; and
 * the slice then discards the TAIL. Every company falling past the cut contributed nothing at all,
 * and `cacheJobs` still recorded the run `status: 'ok'` — so the failure was invisible at every
 * layer below it. Measured against the providers' own APIs on 2026-09-09, both folds run over one
 * fetch of production's own company list:
 *
 *   greenhouse  9 slugs, 2,265 postings   old fold 900   RECOVERED 1,365
 *   ashby       4 slugs, 1,086 postings   old fold 900   RECOVERED   186
 *   lever/workable/recruitee              under the cap  RECOVERED     0
 *
 * The board held 1,255 rows from FIVE companies while eighteen of twenty-three active slugs sat at
 * zero — every one of them probed HTTP 200 with a healthy job list. The arithmetic pins the
 * mechanism to the row: greenhouse's rowid order is stripe 616 + airbnb 170 + figma 114 = exactly
 * 900, so Figma lost 43 of its 157 and Anthropic (595), Brex (282), Scale AI (211), Duolingo (89),
 * Vercel (87) and Mercury (58) were severed whole. ashby's is notion 131 + openai 769 = 900, so
 * OpenAI lost 12 and Ramp (145) and Linear (29) were severed whole.
 *
 * WHY A CAP AT ALL. `search()` serves two callers with opposite needs. Live search
 * (POST /api/jobs/search) passes pageSize 10-20 and neither paginates nor slices downstream, so
 * its payload is whatever the plugins return and a bound is genuinely required. `cacheJobs` passes
 * pageSize 300 as a "give me everything" signal. Capping per company satisfies both without a
 * second code path: no company can starve another, and at the crawl's pageSize the per-company
 * ceiling of 900 is above every real board (the largest observed is openai at 781), so the crawl
 * takes every company whole.
 *
 * The cap is deliberately NOT a total. A total is what made adding a company able to silently
 * evict a different one, which is the property that made this undetectable — the set of companies
 * that survived depended on insertion order and shifted whenever the table changed.
 *
 * @param {PromiseSettledResult<object[]>[]} results  one settled entry per company, in _companies order
 * @param {number} perCompany                          max postings kept from EACH company
 * @returns {object[]} the concatenation, each company capped
 */
function collectCompanyJobs(results, perCompany) {
  const limit = Number.isFinite(perCompany) && perCompany > 0 ? perCompany : Infinity;
  const jobs = [];
  for (const r of results) {
    if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
    // slice(0, Infinity) is a copy of the whole array, which is the intended no-op.
    jobs.push(...r.value.slice(0, limit));
  }
  return jobs;
}

/**
 * ⭐ D170 (4) · ONE BAD POSTING IS SKIPPED, NOT THE COMPANY. normalizeJob throws on a posting with no title; mapped
 * with a bare .map() that threw out of fetchCompanyJobs, and the source's catch dropped EVERY posting of the company
 * (production 11-06: "Workday Broadcom failed whole on normalizeJob: title is required"). Each row is normalised on
 * its own; the rows that throw are counted and said once per company.
 */
function normalizeEach(items, fn, { source = 'source', company = '', log = console } = {}) {
  const out = [];
  let skipped = 0, firstError = null;
  for (const item of items || []) {
    try { out.push(fn(item)); } catch (e) { skipped++; firstError ??= e.message; }
  }
  if (skipped) log.warn?.(`[${source}] skipped ${skipped} of ${(items || []).length} posting(s) for "${company}" — ${firstError}`);
  return out;
}

/** True for a failure worth trying again: a timeout, a dropped connection, 429 or a 5xx — never a 404 / 403. */
function isTransientFetchError(err) {
  const code = err?.code || '';
  const status = err?.response?.status;
  if (status === 429 || (status >= 500 && status <= 599)) return true;
  if (status) return false;
  return /ECONNABORTED|ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|ERR_SOCKET|ECONNREFUSED/.test(code)
    || /timeout of \d+ms exceeded|socket hang up/i.test(err?.message || '');
}

/**
 * ⭐ D170 (4) · A TIMEOUT IS TRIED AGAIN, LATER, NOT GIVEN UP. ≈ 35 Lever companies timed out in one 11-06 crawl
 * (Palantir, Shield AI, Getty Images, …) — every company fired at once against an 8 s timeout, not 35 broken
 * companies. `retries` more attempts, each after base · 2^n ms plus jitter, only for transient failures.
 */
async function withRetry(fn, { retries = 2, baseMs = 750, sleep = (ms) => new Promise(r => setTimeout(r, ms)), random = Math.random } = {}) {
  let attempt = 0;
  for (;;) {
    try { return await fn(attempt); } catch (err) {
      if (attempt >= retries || !isTransientFetchError(err)) throw err;
      await sleep(Math.round(baseMs * 2 ** attempt * (0.75 + random() * 0.5)));
      attempt++;
    }
  }
}

/**
 * ⭐ D170 (4) · AT MOST `limit` COMPANIES IN FLIGHT. The sources mapped every company into one Promise.allSettled,
 * so a crawl of a few hundred Lever boards opened a few hundred requests at once and the slow tail timed out. Results
 * come back in input order, as PromiseSettledResult entries — the shape collectCompanyJobs reads.
 */
async function settleWithLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Math.max(1, Math.min(limit || 1, items.length));
  await Promise.all(Array.from({ length: lanes }, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { status: 'fulfilled', value: await fn(items[i], i) }; }
      catch (reason) { results[i] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}

/** Positive integer from the environment, else the default. */
function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export { validatePlugin, SEARCH_PARAMS_SCHEMA, SEARCH_RESULT_SCHEMA, collectCompanyJobs,
         normalizeEach, isTransientFetchError, withRetry, settleWithLimit, envInt };
