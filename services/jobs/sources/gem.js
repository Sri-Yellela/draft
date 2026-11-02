import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

// A112 · Gem — the startup ATS whose public board (jobs.gem.com/{slug}) has a Greenhouse-shaped API: one request,
// every posting with its text — `https://api.gem.com/job_board/v0/{slug}/job_posts/`. An unknown slug answers 404.

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

// The posting's own location, else its offices' names ("San Francisco (On-Site) OR Remote").
function locationOf(job) {
  const own = job.location?.name?.trim();
  if (own) return own;
  const offices = (job.offices || []).map(o => o.location?.name?.trim() || o.name?.trim()).filter(Boolean);
  if (offices.length) return offices.join('; ');
  return job.location_type === 'remote' ? 'Remote' : 'Not specified';
}

function normalizeGemJob(job, companyName) {
  const remote = job.location_type === 'remote';
  return normalizeJob({
    id:              String(job.id),
    req_id:          String(job.requisition_id || job.id),
    title:           job.title,
    company:         companyName,
    location:        locationOf(job),
    url:             job.absolute_url,
    source:          'gem',
    description:     htmlToText(job.content || job.content_plain || '', { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, job.content || ''),
    posted_at:       job.first_published_at || job.created_at || null,
    remote,
    workplace_type:  remote ? 'remote' : (job.location_type === 'hybrid' ? 'hybrid' : (job.location_type === 'in_office' ? 'onsite' : null)),
    contract_type:   job.employment_type || null,
    _raw:            job,
  });
}

async function fetchCompanyJobs(slug, companyName, words) {
  const url = `https://api.gem.com/job_board/v0/${encodeURIComponent(slug)}/job_posts/`;
  const response = await axios.get(url, { timeout: 10000 });
  const posts = Array.isArray(response.data) ? response.data : [];
  return posts
    .filter(p => titleMatchesQuery(p.title, words))
    .map(p => normalizeGemJob(p, companyName));
}

const gemPlugin = {
  name: 'gem',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[gem] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
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

export default gemPlugin;
export { fetchCompanyJobs, normalizeGemJob };
