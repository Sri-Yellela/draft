import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { parseSalaryText } from '../salaryText.js';
import {
  htmlToText, truncateWithTail, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH,
} from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

const BASE_URL = 'https://api.ashbyhq.com/posting-api/job-board';

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

// Ashby reports intervals as "1 YEAR" / "1 HOUR" / "1 MONTH", which schema.js's
// normalizeSalaryPeriod doesn't recognise (it would pass "1year" straight through as a bogus
// period). Reduce to the bare unit here and let normalizeSalaryPeriod canonicalise it.
function ashbyIntervalToPeriod(interval) {
  if (typeof interval !== 'string') return null;
  const match = interval.match(/\b(year|hour|month|week|day)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function extractAshbyCompensation(job) {
  const comp = job.compensation;
  if (!comp) return {};

  // summaryComponents is a MIXED list — Salary, Bonus and EquityPercentage entries all live in
  // it, in no guaranteed order. Taking [0] blindly (as this did) reads a bonus or equity range
  // as though it were base pay, so select by compensationType instead.
  const salaryComponent = comp.summaryComponents?.find(c => c.compensationType === 'Salary');
  if (salaryComponent) {
    return {
      salary_min:      salaryComponent.minValue != null ? Number(salaryComponent.minValue) : null,
      salary_max:      salaryComponent.maxValue != null ? Number(salaryComponent.maxValue) : null,
      salary_currency: salaryComponent.currencyCode || null,
      salary_period:   ashbyIntervalToPeriod(salaryComponent.interval),
    };
  }

  // ⭐ D41(b) · Ashby's own SUMMARY strings ("$123K – $185K • Offers Equity"), for a board that fills
  // those and no Salary component — the flat fallback below then read nothing and the row stored NULL
  // pay while the posting showed a range. Stated text, read deterministically (salaryText.js).
  const summary = parseSalaryText(comp.scrapeableCompensationSalarySummary || comp.compensationTierSummary || '');
  if (summary && comp.min == null && comp.minValue == null) return summary;

  // Flat fallback, for boards that expose a bare range rather than components.
  return {
    salary_min:      comp.min      != null ? Number(comp.min)      : (comp.minValue != null ? Number(comp.minValue) : null),
    salary_max:      comp.max      != null ? Number(comp.max)      : (comp.maxValue != null ? Number(comp.maxValue) : null),
    salary_currency: comp.currency || comp.currencyCode || null,
    salary_period:   ashbyIntervalToPeriod(comp.interval) || comp.period || null,
  };
}

// Ashby sends 'Remote' | 'Hybrid' | 'On-site'; schema.js expects remote|hybrid|onsite.
function normalizeAshbyWorkplaceType(workplaceType, isRemote) {
  const raw = typeof workplaceType === 'string' ? workplaceType.toLowerCase().replace(/[-_\s]+/g, '') : '';
  if (raw === 'remote' || raw === 'hybrid') return raw;
  if (raw === 'onsite' || raw === 'inoffice') return 'onsite';
  return isRemote ? 'remote' : null;
}

function normalizeAshbyJob(job, companyName) {
  // The posting-api board endpoint returns `descriptionPlain` (already plain text) and
  // `descriptionHtml`. There is no `descriptionSections` field — reading it, as this used to,
  // silently yielded null for every row, which is why enrichment had no text to work from.
  // Truncation keeps a tail slice: compensation, benefits and EEO text sit at the BOTTOM of a
  // posting, so a prefix-only cut drops exactly the part enrichment is looking for.
  const descriptionText = job.descriptionPlain
    ? truncateWithTail(job.descriptionPlain, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH)
    : htmlToText(job.descriptionHtml, {
        maxLength: JOB_DESCRIPTION_MAX_LENGTH,
        tailLength: JOB_DESCRIPTION_TAIL_LENGTH,
      });

  const comp = extractAshbyCompensation(job);

  return normalizeJob({
    id:             job.id,
    req_id:         job.id,
    title:          job.title,
    company:        companyName,
    location:       job.location || (job.isRemote ? 'Remote' : 'Not specified'),
    url:            job.applyUrl,
    source:         'ashby',
    description:    descriptionText,
    description_full: fullDescriptionText(job.descriptionPlain, job.descriptionHtml),   // D84 F1 — never cut
    // The posting API's field is `publishedAt`, on every posting (1,155 of 1,155 across openai, ramp,
    // notion and linear, probed 10-02). `publishedDate` does not exist, so reading it — as this did
    // from the first version — left every Ashby row undated: no "posted N days ago", and recency
    // ordering fell back to when WE first saw it. Fixing it re-upserts each Ashby row once (posted_at
    // is in the content hash); discovered_at and enrichment survive the re-upsert.
    posted_at:      job.publishedAt || null,
    remote:         !!job.isRemote,
    _raw:           job,
    workplace_type: normalizeAshbyWorkplaceType(job.workplaceType, job.isRemote),
    salary_min:     comp.salary_min,
    salary_max:     comp.salary_max,
    salary_currency: comp.salary_currency,
    salary_period:  comp.salary_period,
  });
}

// includeCompensation=true is required: without it the response has no `compensation` key at
// all, so extractAshbyCompensation always returned {} and every Ashby row stored a NULL salary.
async function fetchCompanyJobs(slug, companyName, words) {
  const url = `${BASE_URL}/${encodeURIComponent(slug)}?includeCompensation=true`;
  const response = await axios.get(url, { timeout: 15000 });
  const jobs = response.data?.jobs || [];
  return jobs
    .filter(j => titleMatchesQuery(j.title, words))
    .map(j => normalizeAshbyJob(j, companyName));
}

const ashbyPlugin = {
  name: 'ashby',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    // PER COMPANY, not across the concatenation. This was `MAX` applied to the flattened array,
    // which silently dropped every company past the 900th posting — see collectCompanyJobs.
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[ashby] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
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

export default ashbyPlugin;
// Named exports for services/jobs/importJob.js's single-URL reuse of this source's already-
// working fetch+normalize (see importJob.js's fetchKnownAtsJob) — no change to the above.
export { fetchCompanyJobs, normalizeAshbyJob };
