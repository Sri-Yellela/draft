import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

// 46a (after A161; owner 11-09 "add workday and icims support too … Oracle after iCIMS") · Oracle Recruiting Cloud — the
// Fusion HCM "Candidate Experience" career sites of large US employers (46a's J1 pass: Mortenson, Structure Tone, WSP).
// Public, no account, measured on a live tenant 11-10 (fa-esgu-saasfaprod1 · site CX_1, 780 postings; no robots.txt — 404):
//   · the site's own page calls `/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true
//     &finder=findReqs;siteNumber=<site>,limit=25,offset=N` → items[0].requisitionList (Id, Title, PostedDate, PrimaryLocation,
//     PrimaryLocationCountry, WorkplaceTypeCode) and items[0].TotalJobsCount;
//   · `recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id="<id>",siteNumber=<site>` → the
//     description (ExternalDescriptionStr + responsibilities + qualifications) and ExternalPostedStartDate.
// So one list page per 25 postings and one detail per posting, capped per company, asked only for a US posting the
// query's words match. The slug is "<host>|<siteNumber>"; the host must be an oraclecloud.com host (never another).

const PAGE = 25;
const MAX_PAGES = 40;
const PAGE_GAP_MS = 300;
const DETAIL_CONCURRENCY = 3;
export const PER_COMPANY_DETAILS = 150;
const HOST_RE = /^[a-z0-9][a-z0-9.-]{3,120}\.oraclecloud\.com$/i;
const SITE_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** "<host>|<site>" → { host, site } or null (never a host outside oraclecloud.com). */
export function parseSlug(slug) {
  const [host, site] = String(slug || '').split('|');
  return HOST_RE.test(host || '') && SITE_RE.test(site || '') ? { host: host.toLowerCase(), site } : null;
}
export const isOracleSlug = (s) => !!parseSlug(s);

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

const api = (host) => `https://${host}/hcmRestApi/resources/latest`;
export const jobUrl = (host, site, id) => `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${encodeURIComponent(id)}`;
const isUs = (c) => /^(US|USA|UNITED STATES)$/i.test(String(c || '').trim());
const usOrUnplaced = (r) => !r.PrimaryLocationCountry || isUs(r.PrimaryLocationCountry)
  || (r.secondaryLocations || []).some(l => isUs(l.CountryCode || l.Country));

export function normalizeOracleJob(slug, item, detail, companyName) {
  const { host, site } = parseSlug(slug);
  const d = detail || {};
  const html = [d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr, item.ExternalResponsibilitiesStr, item.ExternalQualificationsStr]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('\n');
  const wt = String(d.WorkplaceTypeCode || item.WorkplaceTypeCode || '');
  const remote = /REMOTE/i.test(wt);
  return normalizeJob({
    // Requisition ids are per tenant ("23609"): the host + site keep two employers apart.
    id:              `${host}|${site}-${item.Id}`,
    req_id:          `${host}|${site}-${item.Id}`,
    title:           d.Title || item.Title,
    company:         companyName,
    location:        remote && !(d.PrimaryLocation || item.PrimaryLocation) ? 'Remote' : (d.PrimaryLocation || item.PrimaryLocation || 'Not specified'),
    url:             jobUrl(host, site, item.Id),
    source:          'oracle',
    description:     htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, html),
    posted_at:       d.ExternalPostedStartDate || item.PostedDate || null,
    remote,
    workplace_type:  remote ? 'remote' : /HYBRID/i.test(wt) ? 'hybrid' : /ONSITE|ON_SITE/i.test(wt) ? 'onsite' : null,
    contract_type:   d.JobType || item.JobType || null,
    _raw:            { id: item.Id, site, country: item.PrimaryLocationCountry || null, workplace: wt || null },
  });
}

async function fetchCompanyJobs(slug, companyName, words, { get = axios.get, sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  const p = parseSlug(slug);
  if (!p) { const err = new Error('not an Oracle Recruiting Cloud site'); err.status = 404; throw err; }
  const items = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    if (page) await sleep(PAGE_GAP_MS);
    const finder = `findReqs;siteNumber=${p.site},limit=${PAGE},offset=${page * PAGE}`;
    const r = await get(`${api(p.host)}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=${encodeURIComponent(finder)}`,
      { timeout: 15000 });
    const head = r.data?.items?.[0];
    if (!head) { if (page === 0) { const err = new Error('no such Oracle site'); err.status = 404; throw err; } break; }
    const list = head.requisitionList || [];
    items.push(...list);
    if (!list.length || items.length >= (head.TotalJobsCount || 0)) break;
  }
  const wanted = items.filter(i => titleMatchesQuery(i.Title, words) && usOrUnplaced(i)).slice(0, PER_COMPANY_DETAILS);
  const out = [];
  for (let i = 0; i < wanted.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(wanted.slice(i, i + DETAIL_CONCURRENCY).map(async (item) => {
      try {
        const finder = `ById;Id="${item.Id}",siteNumber=${p.site}`;
        const r = await get(`${api(p.host)}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=${encodeURIComponent(finder)}`, { timeout: 15000 });
        return normalizeOracleJob(slug, item, r.data?.items?.[0], companyName);
      } catch { return normalizeOracleJob(slug, item, null, companyName); }   // the list row still names the posting
    }));
    out.push(...batch);
  }
  return out;
}

const oraclePlugin = {
  name: 'oracle',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[oracle] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
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

export default oraclePlugin;
export { fetchCompanyJobs };
