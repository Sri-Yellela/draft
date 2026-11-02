import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { usEligibility } from '../usLocation.js';
import { collectCompanyJobs } from './base.js';

// A112 · BambooHR — the most common US small-business ATS (≈ 3,350 boards in one Common Crawl crawl). Public, no
// account: `https://{slug}.bamboohr.com/careers/list` lists the openings (title, department, city / state — no text,
// no date), `/careers/{id}/detail` carries the description, `datePosted` and the country. So a posting costs one
// detail request — and only a posting the list's own location does not already rule out of the US is asked for.

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

const DETAIL_CONCURRENCY = 4;
const PER_COMPANY_DETAILS = 150;

function locationText(loc = {}, remote = false) {
  if (remote) return 'Remote';
  return [loc.city, loc.state, loc.addressCountry].filter(Boolean).join(', ') || 'Not specified';
}

function normalizeBambooJob(slug, listing, detail, companyName) {
  const d = detail || {};
  const remote = listing.isRemote === true || String(d.locationType ?? listing.locationType) === '1';
  const html = d.description || '';
  return normalizeJob({
    // BambooHR ids are per company ("52"): the slug keeps two companies' openings apart.
    id:              `${slug}-${listing.id}`,
    req_id:          `${slug}-${listing.id}`,
    title:           d.jobOpeningName || listing.jobOpeningName,
    company:         companyName,
    location:        locationText(d.location || listing.location, remote),
    url:             d.jobOpeningShareUrl || `https://${slug}.bamboohr.com/careers/${listing.id}`,
    source:          'bamboohr',
    description:     htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, html),
    posted_at:       d.datePosted || null,
    remote,
    workplace_type:  remote ? 'remote' : null,
    experience_level: d.minimumExperience || null,
    contract_type:   d.employmentStatusLabel || listing.employmentStatusLabel || null,
    _raw:            { ...listing, ...d },
  });
}

async function fetchCompanyJobs(slug, companyName, words) {
  const base = `https://${encodeURIComponent(slug)}.bamboohr.com/careers`;
  // An unknown subdomain answers 302 → www.bamboohr.com: that is a dead slug (validateBoard's `dead`), not an
  // empty board.
  const response = await axios.get(`${base}/list`, { timeout: 8000, maxRedirects: 0 }).catch((e) => {
    if (e?.response?.status >= 300 && e.response.status < 400) { const err = new Error('no such BambooHR board'); err.status = 404; throw err; }
    throw e;
  });
  const listings = (response.data?.result || [])
    .filter(o => titleMatchesQuery(o.jobOpeningName, words))
    // The list's city / state is enough to rule a posting OUT (London) — never to admit one; the crawl's own US
    // gate reads the detail's location. A remote or unplaced listing is asked for.
    .filter(o => o.isRemote || !(o.location?.city || o.location?.state) ||
      usEligibility({ location: locationText(o.location), description: '' }).admit)
    .slice(0, PER_COMPANY_DETAILS);
  const out = [];
  for (let i = 0; i < listings.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(listings.slice(i, i + DETAIL_CONCURRENCY).map(async (o) => {
      try {
        const r = await axios.get(`${base}/${encodeURIComponent(o.id)}/detail`, { timeout: 8000 });
        return normalizeBambooJob(slug, o, r.data?.result?.jobOpening, companyName);
      } catch { return null; }   // one unreadable opening never drops the company
    }));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

const bamboohrPlugin = {
  name: 'bamboohr',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[bamboohr] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
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

export default bamboohrPlugin;
export { fetchCompanyJobs, normalizeBambooJob };
