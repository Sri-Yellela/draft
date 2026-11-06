import axios from 'axios';
import { normalizeJob } from '../schema.js';
import {
  htmlToText, truncateWithTail, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH,
} from '../htmlToText.js';
import { collectCompanyJobs, normalizeEach, withRetry, settleWithLimit, envInt } from './base.js';

const BASE_URL = 'https://api.lever.co/v0/postings';

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

function normalizeLeverPosting(posting, companyName) {
  const sr = posting.salaryRange || {};
  return normalizeJob({
    id:             posting.id,
    req_id:         posting.id,
    title:          posting.text,
    company:        companyName,
    location:       posting.categories?.location || posting.workplaceType || 'Remote',
    url:            posting.hostedUrl || posting.applyUrl,
    source:         'lever',
    // A bare slice(0, 3000) is a prefix-only cut at a limit no other source uses. Both halves
    // matter: compensation, benefits and EEO text sit at the BOTTOM of a posting, so dropping the
    // tail drops exactly what enrichment is looking for — the reason ashby keeps a tail slice too.
    // Falls back to the HTML body because Lever omits descriptionPlain on some postings (9 of 60
    // on the Spotify board), which the old expression turned into a null description outright.
    description:    posting.descriptionPlain
      ? truncateWithTail(posting.descriptionPlain, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH)
      : htmlToText(posting.description ?? posting.descriptionBodyHtml, {
          maxLength: JOB_DESCRIPTION_MAX_LENGTH,
          tailLength: JOB_DESCRIPTION_TAIL_LENGTH,
        }),
    description_full: fullDescriptionText(posting.descriptionPlain, posting.description ?? posting.descriptionBodyHtml),   // D84 F1
    posted_at:      posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
    remote:         posting.workplaceType === 'remote',
    _raw:           posting,
    workplace_type: posting.workplaceType || null,
    salary_min:     sr.min  != null ? Number(sr.min)  : null,
    salary_max:     sr.max  != null ? Number(sr.max)  : null,
    salary_currency: sr.currency || null,
    salary_period:  sr.interval || null,
  });
}

// ⭐ D170 (4): a longer timeout, two retries with backoff on a transient failure, and at most LEVER_CONCURRENCY companies
// in flight (search below) — ≈ 35 companies timed out in one 11-06 crawl when every board was fetched at once at 8 s.
const LEVER_TIMEOUT_MS = () => envInt('LEVER_TIMEOUT_MS', 15000);
const LEVER_CONCURRENCY = () => envInt('LEVER_CONCURRENCY', 6);

async function fetchCompanyJobs(slug, companyName, words, { http = axios, retry = {} } = {}) {
  const url = `${BASE_URL}/${encodeURIComponent(slug)}?mode=json`;
  const response = await withRetry(() => http.get(url, { timeout: LEVER_TIMEOUT_MS() }), retry);
  const postings = Array.isArray(response.data) ? response.data : [];
  return normalizeEach(postings.filter(p => titleMatchesQuery(p.text, words)),
    p => normalizeLeverPosting(p, companyName), { source: 'lever', company: companyName });
}

const leverPlugin = {
  name: 'lever',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    // PER COMPANY, not across the concatenation. This was `MAX` applied to the flattened array,
    // which silently dropped every company past the 900th posting — see collectCompanyJobs.
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await settleWithLimit(_companies, LEVER_CONCURRENCY(), ({ ats_slug, company }) =>
      fetchCompanyJobs(ats_slug, company, words).catch(err => {
        console.warn(`[lever] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
        return [];
      }));

    const jobs = collectCompanyJobs(results, PER_COMPANY_MAX);

    return {
      jobs,
      total:    jobs.length,
      page:     1,
      pageSize: jobs.length,
    };
  },
};

export default leverPlugin;
// Named exports for services/jobs/importJob.js's single-URL reuse of this source's already-
// working fetch+normalize (see importJob.js's fetchKnownAtsJob) — no change to the above.
export { fetchCompanyJobs, normalizeLeverPosting };
