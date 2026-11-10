import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

// A161 (owner 11-09, "… and icims support too") · iCIMS — the ATS of most large US construction, healthcare and
// finance employers (46a's J1 pass: Suffolk, Shawmut, Gilbane …). Public, no account, measured on a live tenant 11-10:
//   · `https://<slug>.icims.com/sitemap.xml` lists EVERY open posting (`/jobs/<id>/<title-slug>/job`) in one request —
//     robots.txt names it and allows /jobs/<id>/…/job; an unknown tenant answers 404 (a dead slug, not an empty board).
//   · each posting's page (`…/job?in_iframe=1`) carries a schema.org JobPosting in JSON-LD: title, the description's
//     HTML, jobLocation addresses with a country, employmentType, datePosted.
// So, as with BambooHR / Rippling, one detail request per posting, capped per company; the title in the URL lets a
// query skip postings before they are asked for.
// ⚠ datePosted is not always a posting date: the measured tenant stamped EVERY posting 2024-11-10T00:30 (a bulk
// re-import), and the sitemap's lastmod was one board-wide timestamp. A stamp most of a board shares is dropped
// (posted_at null → the board ages the posting from first_seen, as with an undated Workday posting) — reading it
// would have aged a live board out at once.
// The slug is the tenant's host label, e.g. "careers-suffolkconstruction" (→ careers-suffolkconstruction.icims.com).

const DETAIL_CONCURRENCY = 3;
export const PER_COMPANY_DETAILS = 150;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/i;
// Labels on icims.com that are iCIMS's own, never a tenant.
const NOT_A_TENANT = /^(www|jobs|careers|login|api|cdn|static|community|developer|help|care)$/i;
export const isTenantSlug = (s) => SLUG_RE.test(String(s || '')) && !NOT_A_TENANT.test(String(s));

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

const baseOf = (slug) => `https://${String(slug).toLowerCase()}.icims.com`;

/** The sitemap's postings: [{ id, url, titleHint }] — only this tenant's own /jobs/<id>/…/job pages. */
export function parseSitemap(xml, slug) {
  const host = `${String(slug).toLowerCase()}.icims.com`;
  const out = [], seen = new Set();
  for (const m of String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    const loc = m[1].replace(/&amp;/g, '&');
    let u; try { u = new URL(loc); } catch { continue; }
    if (u.hostname.toLowerCase() !== host) continue;
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg[0] !== 'jobs' || !/^\d+$/.test(seg[1] || '') || seg[seg.length - 1] !== 'job' || seen.has(seg[1])) continue;
    seen.add(seg[1]);
    let hint = seg.length > 3 ? seg[2] : '';
    try { hint = decodeURIComponent(hint); } catch { /* keep it raw */ }
    out.push({ id: seg[1], url: `${u.origin}${u.pathname}`, titleHint: hint.replace(/[-_]+/g, ' ').trim() });
  }
  return out;
}

/** The page's schema.org JobPosting, or null. */
export function jobPostingOf(html) {
  for (const m of String(html || '').matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let d; try { d = JSON.parse(m[1].trim()); } catch { continue; }
    for (const x of [d, ...(Array.isArray(d) ? d : []), ...(Array.isArray(d?.['@graph']) ? d['@graph'] : [])]) {
      if (x && typeof x === 'object' && String(x['@type']) === 'JobPosting') return x;
    }
  }
  return null;
}

/**
 * ⛔ 46a: the page's own "Location" header field (iCIMS_JobHeaderData) — "US-ND-Bismarck", "ND-Bismarck" or "Bismarck, ND" —
 * as { addressLocality, addressRegion, addressCountry: "US" } when it names a US state, else null. Used only when the
 * JSON-LD address is all placeholders (CommonSpirit: country, region and city all "UNAVAILABLE").
 */
export function headerLocationOf(html) {
  const text = String(html || '').replace(/\s+/g, ' ').replace(/<[^>]+>/g, '|').replace(/(\| ?)+/g, '|');
  const m = text.match(/\|Location\|([^|]{2,80})\|/);
  if (!m) return null;
  const v = m[1].trim();
  let st = null, city = null;
  const dash = v.split('-').map(s => s.trim()).filter(Boolean);
  if (dash.length >= 2) {
    const parts = /^(US|USA)$/i.test(dash[0]) ? dash.slice(1) : dash;
    if (parts.length >= 2 && /^[A-Z]{2}$/.test(parts[0])) { st = parts[0]; city = parts.slice(1).join('-'); }
  }
  if (!st) { const c = v.match(/^([^,]{2,60}),\s*([A-Z]{2})$/); if (c) { city = c[1].trim(); st = c[2]; } }
  return st && US_STATES.has(st) ? { addressLocality: city || null, addressRegion: st, addressCountry: 'US', fromHeader: true } : null;
}

// ⛔ 46a: tenants fill unknown address parts with a placeholder — CommonSpirit's 5,858 postings all read addressCountry
// "UNAVAILABLE", and the US filter took that for a foreign country and dropped the whole board. A placeholder is unknown.
const PLACEHOLDER = /^(unavailable|n\/?a|none|null|undefined|-+)$/i;
const real = (v) => (v == null || PLACEHOLDER.test(String(v).trim()) || !String(v).trim() ? null : String(v).trim());
// With the country a placeholder, a US state code AND a US ZIP (or a real city) is the address's own US evidence — the
// country is filled in as inferred (`_raw.countryInferred`), never from the state code alone.
const US_STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" "));
const places = (d) => (Array.isArray(d?.jobLocation) ? d.jobLocation : d?.jobLocation ? [d.jobLocation] : []).map(l => l?.address || {})
  .map(a => {
    const p = { ...a, addressLocality: real(a.addressLocality), addressRegion: real(a.addressRegion), addressCountry: real(a.addressCountry) };
    if (!p.addressCountry && US_STATES.has(String(p.addressRegion || "").toUpperCase())
        && (/^\d{5}(-\d{4})?$/.test(String(a.postalCode || "").trim()) || p.addressLocality)) { p.addressCountry = "US"; p.countryInferred = true; }
    return p;
  });
const isRemote = (d) => /TELECOMMUTE/i.test(String(d?.jobLocationType || '')) || /\bremote\b/i.test(String(d?.title || ''));
function locationText(d) {
  if (isRemote(d) && !places(d).some(a => a.addressLocality)) return 'Remote';
  // a US place with no city reads 'ND, United States' (a bare state code is not evidence the board's US gate accepts)
  const one = (a) => [a.addressLocality, a.addressRegion, a.addressCountry && (a.addressCountry !== 'US' || !a.addressLocality) ? (a.addressCountry === 'US' ? 'United States' : a.addressCountry) : null].filter(Boolean).join(', ');
  const all = [...new Set(places(d).map(one).filter(Boolean))];
  return all.join('; ') || (isRemote(d) ? 'Remote' : 'Not specified');
}

/** The datePosted values most of a board shares (to the hour) — an import stamp, not a posting date. */
export function importStamps(postings, { minShare = 0.5, minCount = 5 } = {}) {
  const byHour = new Map();
  for (const p of postings) {
    const t = Date.parse(p?.datePosted || '');
    if (!Number.isFinite(t)) continue;
    const h = Math.floor(t / 3600000);
    byHour.set(h, (byHour.get(h) || 0) + 1);
  }
  const stamps = new Set();
  for (const [h, n] of byHour) if (n >= minCount && n / postings.length >= minShare) stamps.add(h);
  return stamps;
}

export function normalizeIcimsJob(slug, entry, d, companyName, { stamps = new Set() } = {}) {
  const html = String(d.description || '');
  const t = Date.parse(d.datePosted || '');
  const posted = Number.isFinite(t) && !stamps.has(Math.floor(t / 3600000)) ? new Date(t).toISOString() : null;
  const remote = isRemote(d);
  const emp = Array.isArray(d.employmentType) ? d.employmentType[0] : d.employmentType;
  return normalizeJob({
    // iCIMS ids are per tenant ("10577"): the slug keeps two employers' postings apart.
    id:              `${slug}-${entry.id}`,
    req_id:          `${slug}-${entry.id}`,
    title:           d.title || entry.titleHint,
    company:         companyName,
    location:        locationText(d),
    url:             entry.url,
    source:          'icims',
    description:     htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, html),
    posted_at:       posted,
    remote,
    workplace_type:  remote ? 'remote' : null,
    contract_type:   emp ? String(emp) : null,
    _raw:            { id: entry.id, url: entry.url, datePosted: d.datePosted || null, datePostedUsed: !!posted, occupationalCategory: d.occupationalCategory || null,
                       countries: [...new Set(places(d).map(a => a.addressCountry).filter(Boolean))], countryInferred: places(d).some(a => a.countryInferred) },
  });
}

/** Out of the US by its own address (every place names a country, none of them US) — the crawl's US gate decides the rest. */
const outsideUs = (d) => { const c = places(d).map(a => String(a.addressCountry || '').toUpperCase()); return c.length > 0 && c.every(x => x && x !== 'US' && x !== 'USA' && x !== 'UNITED STATES'); };

async function fetchCompanyJobs(slug, companyName, words, { get = axios.get } = {}) {
  if (!isTenantSlug(slug)) { const err = new Error('not an iCIMS tenant'); err.status = 404; throw err; }
  const base = baseOf(slug);
  const r = await get(`${base}/sitemap.xml`, { timeout: 10000, maxRedirects: 2, responseType: 'text' });
  const entries = parseSitemap(r.data, slug).filter(e => titleMatchesQuery(e.titleHint, words)).slice(0, PER_COMPANY_DETAILS);
  const got = [];
  for (let i = 0; i < entries.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(entries.slice(i, i + DETAIL_CONCURRENCY).map(async (e) => {
      try {
        const page = await get(`${e.url}?in_iframe=1`, { timeout: 10000, maxRedirects: 2, responseType: 'text' });
        let d = jobPostingOf(page.data);
        // an address that is all placeholders → the page's own Location header (US state + city), when it names one
        if (d && !places(d).some(a => a.addressLocality || a.addressRegion || a.addressCountry)) {
          const h = headerLocationOf(page.data);
          if (h) d = { ...d, jobLocation: [{ '@type': 'Place', address: h }] };
        }
        return d ? { e, d } : null;
      } catch { return null; }   // one unreadable posting never drops the company
    }));
    got.push(...batch.filter(Boolean));
  }
  const stamps = importStamps(got.map(x => x.d));
  return got.filter(x => !outsideUs(x.d)).map(x => normalizeIcimsJob(slug, x.e, x.d, companyName, { stamps }));
}

const icimsPlugin = {
  name: 'icims',

  isConfigured() {
    return true;
  },

  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const PER_COMPANY_MAX = pageSize * 3;

    const results = await Promise.allSettled(
      _companies.map(({ ats_slug, company }) =>
        fetchCompanyJobs(ats_slug, company, words).catch(err => {
          console.warn(`[icims] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
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

export default icimsPlugin;
export { fetchCompanyJobs };
