import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

// 46a (after A161 and Oracle; the J1 pass's next vendor) · Taleo (Oracle Taleo Enterprise "career sections") — HDR,
// Kaiser Permanente and many large US employers. Public, no account; measured on a live tenant 11-10 (hdr · section ex,
// 2,331 postings; no robots.txt — 404):
//   · the section's search page (`/careersection/<section>/jobsearch.ftl`) names its portal number (`portal=<digits>`);
//   · its own app POSTs `/careersection/rest/jobboard/searchjobs?lang=en&portal=<n>` → requisitionList[] (jobId,
//     contestNo, column[] — the tenant chooses the columns; `linkedColumn` is the title, `locationsColumns` the places)
//     and pagingData { pageSize 25, totalCount };
//   · a posting's page (`jobdetail.ftl?job=<contestNo>`) carries the description inside the hidden `initialHistory`
//     field (URL-encoded, fields split by "!|!", rich-text fields prefixed "!*!").
// One list page per 25 postings (newest first), one detail per posting, capped per company, asked only for a US posting
// the query's words match. The slug is "<tenant>|<section>" → https://<tenant>.taleo.net/careersection/<section>/….

const MAX_PAGES = 40;
const PAGE_GAP_MS = 300;
const DETAIL_CONCURRENCY = 3;
export const PER_COMPANY_DETAILS = 150;
const TENANT_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const SECTION_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function parseSlug(slug) {
  const [tenant, section] = String(slug || '').split('|');
  return TENANT_RE.test(tenant || '') && SECTION_RE.test(section || '') && !/^(www|static|cdn)$/i.test(tenant) ? { tenant: tenant.toLowerCase(), section } : null;
}
export const isTaleoSlug = (s) => !!parseSlug(s);
const base = ({ tenant, section }) => `https://${tenant}.taleo.net/careersection`;
export const jobUrl = (p, contestNo) => `${base(p)}/${p.section}/jobdetail.ftl?job=${encodeURIComponent(contestNo)}&lang=en`;

function queryWords(query) {
  return (query || '')
    .split(/\s+/)
    .map(w => w.toLowerCase())
    .filter(w => w.length >= 3);
}

function titleMatchesQuery(title, words) {
  if (!words.length) return true;
  const lower = (title || '').toLowerCase();
  return words.some(w => lower.includes(w));
}

/** The portal number the section's own search page names. */
export function portalOf(html) {
  const m = String(html || '').match(/portal=(\d{5,})/);
  return m ? m[1] : null;
}

/** A list row → { id, contestNo, title, places[], dateText } by the columns' declared roles. */
export function rowOf(r) {
  const cols = Array.isArray(r.column) ? r.column : [];
  const title = cols[Number.isInteger(r.linkedColumn) ? r.linkedColumn : 0] || '';
  const places = [];
  for (const i of (r.locationsColumns || [])) {
    const c = cols[i];
    try { const a = JSON.parse(c); if (Array.isArray(a)) places.push(...a.map(String)); else if (c) places.push(String(c)); }
    catch { if (c) places.push(String(c)); }
  }
  const dateText = cols.find((c, i) => i !== r.linkedColumn && !(r.locationsColumns || []).includes(i) && Number.isFinite(Date.parse(c))) || null;
  return { id: String(r.jobId ?? r.contestNo ?? ''), contestNo: String(r.contestNo ?? r.jobId ?? ''), title, places, dateText };
}

// "United States-New York-New York" → "New York, New York" (US) · other countries keep their name.
const placeText = (p) => {
  const [country, ...rest] = String(p).split('-').map(s => s.trim()).filter(Boolean);
  if (/^(United States|US|USA)$/i.test(country || '')) return rest.reverse().join(', ') || 'United States';
  return [...rest.reverse(), country].filter(Boolean).join(', ');
};
const isUsPlace = (p) => /^(United States|US|USA)\b/i.test(String(p).trim()) || /\bremote\b/i.test(String(p));
const usOrUnplaced = (row) => !row.places.length || row.places.some(isUsPlace);

/** The posting's text out of a jobdetail page's initialHistory field (the rich-text fields, the referral prompt left out). */
export function descriptionOf(html) {
  const m = String(html || '').match(/name="initialHistory"[^>]*value="([^"]*)"/);
  if (!m) return '';
  let v; try { v = decodeURIComponent(m[1]); } catch { v = m[1]; }
  const seen = new Set();
  return v.split('!|!')
    .map(s => s.replace(/^!\*!/, '').trim())
    .filter(s => s.length >= 200 && !/Tell us about a person who might be interested/i.test(s) && !seen.has(s) && seen.add(s))
    .join('\n');
}

export function normalizeTaleoJob(slug, row, html, companyName) {
  const p = parseSlug(slug);
  const remote = row.places.some(x => /\bremote\b/i.test(x));
  const posted = row.dateText && Number.isFinite(Date.parse(row.dateText)) ? new Date(Date.parse(row.dateText)).toISOString() : null;
  return normalizeJob({
    // Requisition numbers are per tenant: the slug keeps two employers apart.
    id:              `${p.tenant}|${p.section}-${row.contestNo}`,
    req_id:          `${p.tenant}|${p.section}-${row.contestNo}`,
    title:           row.title,
    company:         companyName,
    location:        row.places.filter(isUsPlace).map(placeText).join('; ') || row.places.map(placeText).join('; ') || 'Not specified',
    url:             jobUrl(p, row.contestNo),
    source:          'taleo',
    description:     htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, html),
    posted_at:       posted,
    remote,
    workplace_type:  remote ? 'remote' : null,
    _raw:            { jobId: row.id, contestNo: row.contestNo, places: row.places },
  });
}

const LIST_BODY = (pageNo) => ({
  multilineEnabled: false, sortingSelection: { sortBySelectionParam: '3', ascendingSortingOrder: 'false' },
  fieldData: { fields: { KEYWORD: '', LOCATION: '' }, valid: true },
  filterSelectionParam: { searchFilterSelections: [] }, advancedSearchFiltersSelectionParam: { searchFilterSelections: [] }, pageNo,
});

async function fetchCompanyJobs(slug, companyName, words, { get = axios.get, post = axios.post, sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  const p = parseSlug(slug);
  if (!p) { const err = new Error('not a Taleo career section'); err.status = 404; throw err; }
  const page = await get(`${base(p)}/${p.section}/jobsearch.ftl?lang=en`, { timeout: 15000, responseType: 'text', maxRedirects: 3 });
  const portal = portalOf(page.data);
  if (!portal) { const err = new Error('no Taleo portal on that career section'); err.status = 404; throw err; }
  const rows = [];
  for (let n = 1; n <= MAX_PAGES; n++) {
    if (n > 1) await sleep(PAGE_GAP_MS);
    const r = await post(`${base(p)}/rest/jobboard/searchjobs?lang=en&portal=${portal}`, LIST_BODY(n),
      { timeout: 15000, headers: { 'Content-Type': 'application/json', tz: 'GMT-05:00' } });
    const list = r.data?.requisitionList || [];
    rows.push(...list.map(rowOf));
    const total = r.data?.pagingData?.totalCount || 0, size = r.data?.pagingData?.pageSize || 25;
    if (!list.length || n * size >= total) break;
  }
  const wanted = rows.filter(r => r.contestNo && titleMatchesQuery(r.title, words) && usOrUnplaced(r)).slice(0, PER_COMPANY_DETAILS);
  const out = [];
  for (let i = 0; i < wanted.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(wanted.slice(i, i + DETAIL_CONCURRENCY).map(async (row) => {
      let html = '';
      try { html = descriptionOf((await get(jobUrl(p, row.contestNo), { timeout: 15000, responseType: 'text' })).data); } catch { html = ''; }
      return normalizeTaleoJob(slug, row, html, companyName);   // the list row still names the posting
    }));
    out.push(...batch);
  }
  return out;
}

const taleoPlugin = {
  name: 'taleo',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[taleo] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
          return [];
        })
      )
    );

    const jobs = collectCompanyJobs(results, PER_COMPANY_MAX);

    return {
      jobs,
      total:    jobs.length,
      page:     1,
      pageSize: jobs.length,
    };
  },
};

export default taleoPlugin;
export { fetchCompanyJobs };
