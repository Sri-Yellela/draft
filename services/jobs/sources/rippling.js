import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

// A112 · Rippling ATS — public boards at ats.rippling.com/{slug}/jobs. The list
// (`/api/v2/board/{slug}/jobs?page=N`, 20 a page) names each posting's places with a country code but carries no
// text or date; the detail (`/api/v2/board/{slug}/jobs/{id}`) carries the description (company + role halves),
// `createdOn`, the pay range and the company's own name. So, as with BambooHR, one detail request per posting — asked
// only for a posting the list places in the US or remote. An unknown slug answers 404.

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

const API = 'https://ats.rippling.com/api/v2/board';
const MAX_PAGES = 10;
const DETAIL_CONCURRENCY = 4;
const PER_COMPANY_DETAILS = 150;

const isRemote = (l) => /REMOTE/i.test(l.workplaceType || '') || /remote/i.test(l.name || '');
const usOrRemote = (item) => (item.locations || []).some(l => l.countryCode === 'US' || isRemote(l)) || !(item.locations || []).length;

function normalizeRipplingJob(slug, item, detail, companyName) {
  const d = detail || {};
  const locs = item.locations || [];
  const remote = locs.length > 0 && locs.every(isRemote);
  const html = [d.description?.company, d.description?.role].filter(Boolean).join('\n');
  const pay = (d.payRangeDetails || [])[0] || null;
  const period = pay?.frequency === 'HOUR' ? 'hourly' : pay?.frequency === 'YEAR' ? 'annual' : pay?.frequency === 'MONTH' ? 'monthly' : null;
  return normalizeJob({
    id:              String(item.id),
    req_id:          String(item.id),
    title:           d.name || item.name,
    company:         companyName,
    location:        remote ? 'Remote' : (locs.map(l => l.name).filter(Boolean).join('; ') || (d.workLocations || []).join('; ') || 'Not specified'),
    url:             item.url || `https://ats.rippling.com/${slug}/jobs/${item.id}`,
    source:          'rippling',
    // The role half is the posting; the company half is the "About us" it is prefixed with.
    description:     htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, html),
    posted_at:       d.createdOn || null,
    remote,
    workplace_type:  remote ? 'remote' : (locs.some(l => /HYBRID/i.test(l.workplaceType || '')) ? 'hybrid' : (locs.length ? 'onsite' : null)),
    contract_type:   d.employmentType?.id || null,
    salary_min:      pay?.rangeStart ?? null,
    salary_max:      pay?.rangeEnd ?? null,
    salary_currency: pay?.currency || null,
    salary_period:   period,
    _raw:            { ...item, offices: locs },
  });
}

async function fetchCompanyJobs(slug, companyName, words) {
  const s = encodeURIComponent(slug);
  const items = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const r = await axios.get(`${API}/${s}/jobs?page=${page}`, { timeout: 8000 });
    items.push(...(r.data?.items || []));
    if (page + 1 >= (r.data?.totalPages || 0)) break;
  }
  const wanted = items.filter(i => titleMatchesQuery(i.name, words) && usOrRemote(i)).slice(0, PER_COMPANY_DETAILS);
  const out = [];
  for (let i = 0; i < wanted.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(wanted.slice(i, i + DETAIL_CONCURRENCY).map(async (item) => {
      try {
        const r = await axios.get(`${API}/${s}/jobs/${encodeURIComponent(item.id)}`, { timeout: 8000 });
        return normalizeRipplingJob(slug, item, r.data, companyName);
      } catch { return null; }   // one unreadable posting never drops the company
    }));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

const ripplingPlugin = {
  name: 'rippling',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[rippling] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
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

export default ripplingPlugin;
export { fetchCompanyJobs, normalizeRipplingJob };
