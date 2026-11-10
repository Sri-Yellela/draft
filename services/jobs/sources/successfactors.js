import axios from 'axios';
import { normalizeJob } from '../schema.js';
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from '../htmlToText.js';
import { collectCompanyJobs } from './base.js';

// 46b (the WORKLOG's "SuccessFactors (Hensel Phelps, Black & Veatch — no public list API found yet)") · SAP SuccessFactors
// CAREER SITE BUILDER — the career site an employer runs on its OWN domain (careers.henselphelps.com, careers.bv.com).
// Public, no account, measured on both 11-10:
//   · `https://<host>/sitemap.xml` lists every open posting as `/job/<title-slug>/<id>/` (Hensel Phelps 241, B&V 846);
//     robots.txt disallows only /applybutton/, /talentcommunity/, /services/, /preapply/ … — /job/ pages are allowed,
//     and robots.txt is READ every crawl: a site that disallows /job/ (or /) is not fetched.
//   · each posting's page carries the title and the description as `itemprop` spans; the place either as schema.org
//     microdata (B&V: jobLocation → addressLocality / addressRegion / addressCountry / postalCode, datePosted) or as the
//     template's labelled tokens (Hensel Phelps: "Job Location: Oak Ridge, TN", "Date:").
// So, as with iCIMS (A161): one detail request per posting, capped per company, 3 at a time; the title in the URL lets a
// query skip postings before they are asked for. The SLUG is the career site's host ("careers.bv.com") — only a public
// hostname (no IP literal, no port, no localhost / internal suffix), and only https.

const DETAIL_CONCURRENCY = 3;
export const PER_COMPANY_DETAILS = 150;
const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;
const NOT_PUBLIC = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|example|invalid)$/i;
/** A career site's host — a public DNS name only (the crawl fetches it). */
export const isCsbHost = (h) => HOST_RE.test(String(h || '')) && !NOT_PUBLIC.test(String(h)) && !/^\d+(\.\d+){3}$/.test(String(h));

function queryWords(query) {
  return (query || '').split(/\s+/).map(w => w.toLowerCase()).filter(w => w.length >= 3);
}
const titleMatchesQuery = (title, words) => !words.length || words.some(w => String(title || '').toLowerCase().includes(w));

/** robots.txt: may `/job/` pages be fetched? (the `User-agent: *` group; a Disallow of /job or / refuses) */
export function robotsAllowsJobs(txt) {
  let applies = false, refused = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') applies = v === '*';
    else if (applies && k === 'disallow' && v && ('/job/'.startsWith(v) || v === '/job' || v === '/')) refused = true;
  }
  return !refused;
}

/** The sitemap's postings: [{ id, url, titleHint }] — only this host's own /job/<title>/<id>/ pages. */
export function parseSitemap(xml, host) {
  const out = [], seen = new Set();
  for (const m of String(xml || '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&')); } catch { continue; }
    if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== String(host).toLowerCase()) continue;
    const seg = u.pathname.split('/').filter(Boolean);
    if (seg[0] !== 'job' || seg.length !== 3 || !/^\d{4,}$/.test(seg[2]) || seen.has(seg[2])) continue;
    seen.add(seg[2]);
    let hint = seg[1];
    try { hint = decodeURIComponent(hint); } catch { /* keep it raw */ }
    out.push({ id: seg[2], url: `${u.origin}${u.pathname}`, titleHint: hint.replace(/[-_]+/g, ' ').trim() });
  }
  return out;
}

const decode = (s) => String(s || '').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ').trim();

/** The text (or `content`) of the first element carrying itemprop="<name>". */
function itemprop(html, name) {
  const re = new RegExp(`<([a-z0-9]+)[^>]*\\bitemprop="${name}"[^>]*>`, 'i');
  const m = re.exec(html);
  if (!m) return null;
  const content = /\bcontent="([^"]*)"/i.exec(m[0]);
  if (content) return decode(content[1]);
  if (name === 'description') return null;   // read whole by descriptionHtml
  const rest = html.slice(m.index + m[0].length);
  const close = rest.search(new RegExp(`</${m[1]}>`, 'i'));
  return decode((close >= 0 ? rest.slice(0, close) : rest.slice(0, 300)).replace(/<[^>]+>/g, ' ')) || null;
}

/** The description's HTML: the itemprop="description" element, balanced on its own tag. */
export function descriptionHtml(html) {
  const m = /<([a-z0-9]+)[^>]*\bitemprop="description"[^>]*>/i.exec(html);
  if (!m) return '';
  const tag = m[1].toLowerCase();
  let depth = 1;
  const body = html.slice(m.index + m[0].length);
  const tokens = [...body.matchAll(new RegExp(`<${tag}\\b|</${tag}>`, 'gi'))];
  for (const t of tokens) {
    depth += t[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return body.slice(0, t.index);
  }
  return body.slice(0, 20000);
}

/** A labelled token ("Job Location:", "Date:") — the template's own label and the value after it. */
function labelled(html, labels) {
  for (const label of labels) {
    const re = new RegExp(`joblayouttoken-label"[^>]*>\\s*${label}\\s*:?(?:[\\s\\u00a0]|&nbsp;)*</span>\\s*<span[^>]*>([\\s\\S]*?)</span>`, 'i');
    const m = re.exec(html);
    if (m) return decode(m[1].replace(/<[^>]+>/g, ' ')) || null;
  }
  return null;
}

const US_STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR".split(" "));
const US_WORDS = /^(us|usa|united states( of america)?)$/i;

/** The posting's facts from its page: { title, html, place: { city, region, country }, datePosted, employmentType, reqId }. */
export function postingOf(page, entry = {}) {
  const html = String(page || '');
  const title = itemprop(html, 'title') || entry.titleHint || null;
  const desc = descriptionHtml(html);
  if (!title || !desc) return null;
  let city = itemprop(html, 'addressLocality'), region = itemprop(html, 'addressRegion'), country = itemprop(html, 'addressCountry');
  if (!city && !region) {
    const loc = labelled(html, ['Job Location', 'Location']);
    const m = /^([^,]{2,60}),\s*([A-Z]{2})(?:,?\s*(US|USA|United States))?(?:,?\s*\d{5})?$/.exec(loc || '');
    if (m) { city = m[1].trim(); region = m[2]; if (US_STATES.has(region)) country = 'US'; }
    else if (loc) city = loc;
  }
  if (!country && US_STATES.has(String(region || '').toUpperCase()) && city) country = 'US';
  const dateRaw = itemprop(html, 'datePosted') || labelled(html, ['Date', 'Posted Date', 'Posting Date']);
  const t = Date.parse(dateRaw || '');
  return { title, html: desc, place: { city: city || null, region: region || null, country: country || null }, datePosted: Number.isFinite(t) ? new Date(t).toISOString() : null,
    employmentType: labelled(html, ['Employment Type', 'Job Type']) || itemprop(html, 'employmentType'), reqId: labelled(html, ['Req Id', 'Requisition ID']) };
}

const isUs = (p) => US_WORDS.test(String(p.place.country || '')) || p.place.country === 'US';
function locationText(p) {
  const { city, region, country } = p.place;
  if (/\bremote\b/i.test(p.title) && !city) return 'Remote';
  if (city && region) return `${city}, ${region}`;
  return [city, region, country && (isUs(p) ? 'United States' : country)].filter(Boolean).join(', ') || 'Not specified';
}

export function normalizeCsbJob(host, entry, p, companyName) {
  const remote = /\bremote\b/i.test(p.title);
  const id = `${host.split('.').slice(-2, -1)[0] || host}-${entry.id}`;
  return normalizeJob({
    // Career Site Builder ids are per site: the host's name keeps two employers' postings apart.
    id, req_id: id,
    title:           p.title,
    company:         companyName,
    location:        locationText(p),
    url:             entry.url,
    source:          'successfactors',
    description:     htmlToText(p.html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH }),
    description_full: fullDescriptionText(null, p.html),
    posted_at:       p.datePosted,
    remote,
    workplace_type:  remote ? 'remote' : null,
    contract_type:   p.employmentType || null,
    _raw:            { id: entry.id, url: entry.url, host, reqId: p.reqId || null, country: p.place.country || null },
  });
}

async function fetchCompanyJobs(slug, companyName, words, { get = axios.get } = {}) {
  const host = String(slug || '').toLowerCase();
  if (!isCsbHost(host)) { const err = new Error('not a career-site host'); err.status = 404; throw err; }
  const base = `https://${host}`;
  let robots = '';
  try { robots = (await get(`${base}/robots.txt`, { timeout: 10000, maxRedirects: 2, responseType: 'text' })).data; } catch { robots = ''; }
  if (!robotsAllowsJobs(robots)) { const err = new Error('robots.txt disallows /job/'); err.status = 403; throw err; }
  const r = await get(`${base}/sitemap.xml`, { timeout: 15000, maxRedirects: 2, responseType: 'text' });
  const entries = parseSitemap(r.data, host).filter(e => titleMatchesQuery(e.titleHint, words)).slice(0, PER_COMPANY_DETAILS);
  const got = [];
  for (let i = 0; i < entries.length; i += DETAIL_CONCURRENCY) {
    const batch = await Promise.all(entries.slice(i, i + DETAIL_CONCURRENCY).map(async (e) => {
      try {
        const page = await get(e.url, { timeout: 10000, maxRedirects: 3, responseType: 'text' });
        const p = postingOf(page.data, e);
        return p ? { e, p } : null;
      } catch { return null; }   // one unreadable posting never drops the company
    }));
    got.push(...batch.filter(Boolean));
  }
  // US only by the posting's own place; a posting with no country and no US state is left to the crawl's US gate.
  return got.filter(x => !x.p.place.country || isUs(x.p)).map(x => normalizeCsbJob(host, x.e, x.p, companyName));
}

const successFactorsPlugin = {
  name: 'successfactors',
  isConfigured() { return true; },
  async search({ query, _companies = [], pageSize = 50 }) {
    const words = queryWords(query);
    const results = await Promise.allSettled(_companies.map(({ ats_slug, company }) =>
      fetchCompanyJobs(ats_slug, company, words).catch(err => {
        console.warn(`[successfactors] Failed to fetch jobs for "${company}" (${ats_slug}):`, err.message);
        return [];
      })));
    const jobs = collectCompanyJobs(results, pageSize * 3);
    return { jobs, total: jobs.length, page: 1, pageSize: jobs.length };
  },
};

export default successFactorsPlugin;
export { fetchCompanyJobs };
