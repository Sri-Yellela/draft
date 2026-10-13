/**
 * Bring-your-own-job import: a user hands the app a URL, or raw text/HTML, and it lands in the
 * SAME global scraped_jobs pool everything else feeds — same dedup (reconcileFingerprint), same
 * enrichment queue, same board. See routes/importJob.js for the HTTP surface.
 *
 * Three extraction paths, tried in this order for a given input:
 *   1. Known-ATS URL reuse — the URL matches a pattern for one of the 7 already-integrated ATS
 *      sources; refetch that company's full listing via the source's own already-working
 *      fetchCompanyJobs() and find the matching posting. Preferred when available: it's the
 *      SAME clean, structured data a real crawl would get, not an LLM's best guess off rendered
 *      HTML. Deliberately does NOT try to derive every ATS's URL shape from scratch where that
     * would require guessing (see detectKnownAtsMatch's comments on Workday/Workable below) —
 *      guessing a request shape wrong is exactly what went wrong with the provider-eval Jobo
 *      adapter earlier in this project; an honest "can't parse this one, fall through" beats a
 *      wrong guess.
 *   2. Client-provided text/html, or (if neither given and the URL isn't login-walled) a
 *      server-side fetch of the URL — read DETERMINISTICALLY: a schema.org JobPosting (JSON-LD)
 *      when the HTML carries one, else the extension's labelled block. ⛔ D17 / D33: no model call.
 *      Import called Haiku until D33; an unfunded balance answered 503 on the only import route.
 *   3. LinkedIn (or another login-walled host) with no fallback text/html at all → no fetch is
 *      attempted; the caller gets a structured "capture it client-side instead" response.
 *
 * IMPORTANT: a known-ATS-matched import keeps `source` as the REAL ats type (e.g. 'greenhouse'),
 * not 'import' — this is deliberate, not a shortcut. computeReqUid() (schema.js) namespaces its
 * requisition id by `source`; if this import used 'import' as that namespace, a LATER real
 * crawl of the same company (which computes its req_uid with source='greenhouse') would never
 * match this row by req_uid, and Task 3.1's selectMatch() treats two different non-null req_uids
 * as genuinely distinct sibling reqs — i.e. the import and the real crawl would permanently
 * duplicate as two board rows instead of reconciling into one. Only the generic/text path (no
 * real ATS identity, no req_id) is tagged source:'import'.
 */

import axios from 'axios';
import crypto from 'crypto';
import { lookup as dnsLookup } from 'dns/promises';
import { normalizeJob } from './schema.js';
import { stripResumeHtml } from '../resumeFormatter.js';
import { ingestJob, previewIngest, recordRefusedCapture } from './jobGateway.js';
import { recordExistingCapture } from './jobGateway.js';
import { captureMarket, officeLocations } from './usLocation.js';
import { parseSalaryText, salaryFromJsonLd } from './salaryText.js';
import { describeCapture, REFUSAL_MESSAGES } from './captureOutcome.js';
import { mapJobRow } from './mapJobRow.js';
import { normalizePosting } from '../../shared/postingNormalize.js';
import { refreshDescriptionText } from './descriptionText.js';
import { BRAND } from '../../shared/brand.js';

import { fetchCompanyJobs as fetchGreenhouseJobs }      from './sources/greenhouse.js';
import { fetchCompanyJobs as fetchLeverJobs }           from './sources/lever.js';
import { fetchCompanyJobs as fetchAshbyJobs }           from './sources/ashby.js';
import { fetchCompanyJobs as fetchSmartRecruitersJobs } from './sources/smartrecruiters.js';
import { fetchCompanyJobs as fetchWorkableJobs }        from './sources/workable.js';
import { fetchCompanyJobs as fetchRecruiteeJobs }       from './sources/recruitee.js';
import { fetchCompanyJobs as fetchWorkdayJobs }         from './sources/workday.js';
import { AUTO_CAPTURE_ORIGIN, autoCaptureRelevance } from './autoCapture.js';
import { boardStateOf } from './jobGateway.js';
import { pageKeyOf, recordPageKey, jobForPageKey, ownJobByTitleCompany } from '../jobPageKey.js';

class ImportInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportInputError';
  }
}

/**
 * D41(d) — a capture with no US evidence is REFUSED before anything is written: no job row, no
 * user_jobs row; only the attempt is recorded (job_captures action 'refused_not_us'). The route
 * answers 422 with `error` = the message, which every extension build already shows as a failed
 * capture — so no extension release is needed for the popup to say it.
 */
class ImportRefusedError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'ImportRefusedError';
    this.kind = kind;            // 'non_us' | 'unconfirmed'
  }
}

const LOGIN_WALLED_HOSTS = new Set(['linkedin.com', 'www.linkedin.com']);

// "global-if-fresh": re-importing the exact same URL within this window reuses the existing
// row as-is instead of re-fetching/re-extracting — reconcileFingerprint already collapses
// re-imports to one row, but without this it still re-does a fetch (or an LLM call) every time.
const REIMPORT_FRESHNESS_SECONDS = 24 * 60 * 60;

const ATS_FETCHERS = {
  greenhouse:      fetchGreenhouseJobs,
  lever:           fetchLeverJobs,
  ashby:           fetchAshbyJobs,
  smartrecruiters: fetchSmartRecruitersJobs,
  workable:        fetchWorkableJobs,
  recruitee:       fetchRecruiteeJobs,
  workday:         fetchWorkdayJobs,
};

// ── URL detection (pure — no db/network) ───────────────────────────────────────────────────
// Each matcher only fires on ITS OWN host and only returns a match when the slug/id are
// actually present in the URL path — an unparseable URL under a known host returns null
// (falls through to the generic path) rather than guessing.
const ATS_URL_MATCHERS = [
  {
    type: 'greenhouse',
    hostTest: h => /(^|\.)greenhouse\.io$/i.test(h),
    parse: (pathname) => {
      const m = pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
      return m ? { slug: m[1], externalId: m[2] } : null;
    },
  },
  {
    type: 'lever',
    hostTest: h => h.toLowerCase() === 'jobs.lever.co',
    parse: (pathname) => {
      const m = pathname.match(/^\/([^/]+)\/([0-9a-f-]{8,})/i);
      return m ? { slug: m[1], externalId: m[2] } : null;
    },
  },
  {
    type: 'ashby',
    hostTest: h => h.toLowerCase() === 'jobs.ashbyhq.com',
    parse: (pathname) => {
      const m = pathname.match(/^\/([^/]+)\/([0-9a-f-]{8,})/i);
      return m ? { slug: m[1], externalId: m[2] } : null;
    },
  },
  {
    type: 'smartrecruiters',
    hostTest: h => h.toLowerCase() === 'jobs.smartrecruiters.com',
    parse: (pathname) => {
      const m = pathname.match(/^\/([^/]+)\/(\d+)-/);
      return m ? { slug: m[1], externalId: m[2] } : null;
    },
  },
  {
    // Only the apply.workable.com/{slug}/j/{shortcode} form carries the account slug this
    // source needs. The jobs.workable.com/view/{shortcode} form does not include it anywhere
    // in the URL — that form intentionally falls through to the generic path below rather than
    // guessing a slug that isn't there.
    type: 'workable',
    hostTest: h => h.toLowerCase() === 'apply.workable.com',
    parse: (pathname) => {
      const m = pathname.match(/^\/([^/]+)\/j\/([a-z0-9]+)/i);
      return m ? { slug: m[1], externalId: m[2] } : null;
    },
  },
  {
    type: 'recruitee',
    hostTest: h => /\.recruitee\.com$/i.test(h),
    // The slug is the subdomain; Recruitee's public offer URLs don't carry the numeric id
    // normalizeRecruiteeJob() uses, only a title slug — matching happens by URL equality
    // against the fetched list's own `url` field (see findMatchingPosting), not by id.
    parse: (_pathname, hostname) => {
      const slug = hostname.split('.')[0];
      return slug ? { slug, externalId: null } : null;
    },
  },
];

// Workday's tenant + wd# live in the hostname, but the `site` segment workday.js's slug
// convention needs (wdNumber|tenant|site) is not reliably recoverable from an arbitrary pasted
// URL (locale prefixes, varying path depth) — so a Workday match ALWAYS requires an existing
// company_ats_list row to supply the already-verified `site`; no guessing.
const WORKDAY_HOST_RE = /^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/i;

function detectKnownAtsMatch(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return null; }
  const hostname = parsed.hostname.toLowerCase();

  for (const matcher of ATS_URL_MATCHERS) {
    if (matcher.hostTest(hostname)) {
      const result = matcher.parse(parsed.pathname, hostname);
      return result ? { type: matcher.type, ...result } : null;
    }
  }

  const wdMatch = hostname.match(WORKDAY_HOST_RE);
  if (wdMatch) {
    return { type: 'workday', tenant: wdMatch[1].toLowerCase(), wdNumber: wdMatch[2], externalId: null };
  }

  return null;
}

function isLoginWalled(rawUrl) {
  try {
    const { hostname } = new URL(rawUrl);
    return LOGIN_WALLED_HOSTS.has(hostname.toLowerCase());
  } catch {
    return false;
  }
}

// ── D55 decision B · "Save link to draft" — which links the server can refetch ─────────────
// A right-click on a LINK reads no page: the extension sends only the link's address. The server
// can turn that into a posting only where it reads the employer's listing itself — the known-ATS
// path above (path 1), which fetches from the ATS's own API with a pattern-validated slug, never
// from the link's host. Anything else is REFUSED with a reason, rather than fetched generically:
// a generic fetch of an arbitrary link is an outbound request to a host the user never opened, and
// most such pages are client-rendered and read as nothing anyway.
const LINK_REFUSALS = Object.freeze({
  not_a_link: 'That is not a web link draft can save.',
  login_walled: 'draft cannot read LinkedIn from a link. Open the job and use Save this page to draft.',
  not_refetchable:
    'draft can save a link only to a posting on a job board it reads directly (Greenhouse, Lever, ' +
    'Ashby, SmartRecruiters, Workable, Recruitee or a Workday site draft knows). ' +
    'Open the job and use Save this page to draft instead.',
  workday_unknown:
    'draft does not read this Workday site yet, so it cannot save it from a link. ' +
    'Open the job and use Save this page to draft instead.',
});
const LINK_NOT_LISTED_MESSAGE =
  "That posting is not in the employer's current listings — it may have closed. " +
  'Open it and use Save this page to draft if it is still up.';

/**
 * @returns {{ ok: true, ats: string } | { ok: false, reason: keyof LINK_REFUSALS, message: string }}
 */
function linkRefetchability(db, rawUrl) {
  const refuse = (reason) => ({ ok: false, reason, message: LINK_REFUSALS[reason] });
  let parsed;
  try { parsed = new URL(String(rawUrl || '')); } catch { return refuse('not_a_link'); }
  if (!/^https?:$/.test(parsed.protocol)) return refuse('not_a_link');
  if (isLoginWalled(parsed.href)) return refuse('login_walled');
  const match = detectKnownAtsMatch(parsed.href);
  if (!match) return refuse('not_refetchable');
  // Recruitee's matcher accepts any page on a tenant's subdomain; only an offer (/o/…) is a posting.
  if (match.type === 'recruitee' && !/^\/o\/[^/]+/.test(parsed.pathname)) return refuse('not_refetchable');
  // Workday needs the tenant's verified site from company_ats_list (fetchKnownAtsJob) — without a
  // row there is nothing to refetch from, and path 1 would quietly become a generic fetch.
  if (match.type === 'workday' && !resolveWorkdaySlug(db, match.tenant, match.wdNumber)) return refuse('workday_unknown');
  return { ok: true, ats: match.type };
}

// ── SSRF guard (generic-fetch path only — known-ATS paths only ever hit our own hardcoded
// vendor API base URLs with a regex-validated slug, never an attacker-controlled host) ────────
const PRIVATE_IPV4_RANGES = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function isPrivateOrLoopbackIp(ip) {
  if (!ip) return true;
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
  }
  return PRIVATE_IPV4_RANGES.some(r => r.test(ip));
}

// Resolves the hostname BEFORE fetching (not after) so a DNS-rebinding attempt to an internal
// address is caught, not just a literal http://127.0.0.1 in the input.
async function assertFetchable(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new ImportInputError('Invalid URL'); }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new ImportInputError('Only http(s) URLs can be imported');
  }
  let address;
  try {
    ({ address } = await dnsLookup(parsed.hostname));
  } catch {
    throw new ImportInputError(`Could not resolve host: ${parsed.hostname}`);
  }
  if (isPrivateOrLoopbackIp(address)) {
    throw new ImportInputError('This URL resolves to a private/internal address and cannot be imported');
  }
  return parsed;
}

function titleCaseSlug(slug) {
  const words = String(slug || '').split(/[-_]+/).filter(Boolean);
  if (!words.length) return 'Unknown Company';
  return words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function resolveCompanyName(db, atsType, slug) {
  const row = db.prepare(
    'SELECT company FROM company_ats_list WHERE ats_type = ? AND ats_slug = ?'
  ).get(atsType, slug);
  return row?.company || titleCaseSlug(slug);
}

// Workday's ats_slug is the composite "wdNumber|tenant|site" workday.js already knows how to
// use — find the row whose tenant+wd# match what we parsed from the URL and reuse its site.
function resolveWorkdaySlug(db, tenant, wdNumber) {
  const rows = db.prepare("SELECT company, ats_slug FROM company_ats_list WHERE ats_type = 'workday'").all();
  for (const row of rows) {
    const [rowWdNumber, rowTenant] = String(row.ats_slug || '').split('|');
    if (rowTenant?.toLowerCase() === tenant && rowWdNumber === wdNumber) {
      return { atsSlug: row.ats_slug, companyName: row.company };
    }
  }
  return null;
}

function normalizeUrlForMatch(u) {
  try {
    const parsed = new URL(u);
    return (parsed.hostname + parsed.pathname).toLowerCase().replace(/\/+$/, '');
  } catch {
    return String(u || '').toLowerCase().replace(/\/+$/, '');
  }
}

// jobs here are already-normalized (fetchCompanyJobs returns normalizeJob()-shaped objects) —
// match by URL equality first (works for every source, since normalizeJob always sets a real
// url), falling back to the parsed req_id when the URL match misses.
function findMatchingPosting(jobs, { url, externalId }) {
  const targetUrl = url ? normalizeUrlForMatch(url) : null;
  if (targetUrl) {
    const byUrl = jobs.find(j => normalizeUrlForMatch(j.url) === targetUrl);
    if (byUrl) return byUrl;
  }
  if (externalId) {
    const byId = jobs.find(j => j.req_id === String(externalId));
    if (byId) return byId;
  }
  return null;
}

async function fetchKnownAtsJob(db, match, url) {
  let atsSlug, companyName;

  if (match.type === 'workday') {
    const resolved = resolveWorkdaySlug(db, match.tenant, match.wdNumber);
    if (!resolved) return null; // can't derive `site` — caller falls back to generic
    atsSlug = resolved.atsSlug;
    companyName = resolved.companyName;
  } else {
    atsSlug = match.slug;
    companyName = resolveCompanyName(db, match.type, match.slug);
  }

  const fetcher = ATS_FETCHERS[match.type];
  const jobs = await fetcher(atsSlug, companyName, []); // [] = no title filter, list everything
  return findMatchingPosting(jobs, { url, externalId: match.externalId });
}

async function fetchGenericPosting(url) {
  await assertFetchable(url);
  const response = await axios.get(url, {
    timeout: 10000,
    maxContentLength: 3 * 1024 * 1024, // 3MB cap
    maxRedirects: 5,
    responseType: 'text',
    headers: { 'User-Agent': `Mozilla/5.0 (compatible; ${BRAND}ImportBot/1.0)` },
  });
  // The raw HTML, not stripped text: a JobPosting in its JSON-LD is the structured read (D33).
  return String(response.data || '');
}

// ── THE DETERMINISTIC READ — the ONLY read since D33 ───────────────────────────────────────────
//
// WHY. Import required a model call, so an unfunded balance took capture to ZERO: the extractor had
// already read the posting in the page, and the capture was thrown away because a model could not
// re-read it. This began as the fallback for that case (docs/ARCHITECTURE.md §10). ⛔ D17 confines
// model calls to résumé generation, so D33 inverted the order — deterministic first, model never —
// and the model path is gone: no model id, no model call, no 503 from an unfunded balance.
//
// WHAT MAKES IT POSSIBLE. extension/extractor.js does not send raw page text — it sends a LABELLED
// block it built from JSON-LD and per-host selectors:
//
//     Title: Senior Backend Engineer
//     Company: Northwind Systems
//     Location: Boston, MA
//     <blank line>
//     <description>
//
// So the structure is already on the wire, including from the PUBLISHED v1.0.0 build. Nothing had
// to change in the extension for this to work for users today.
//
// ⛔ FLAG, DO NOT FABRICATE. This reads labels the extractor wrote; it does not guess. No title
// line means no job — it returns null and the import says it could not read one, because filing a
// stray page as a posting is worse than failing to file it. Salary, remote and postedAt are left
// NULL rather than inferred: a wrong salary is not a smaller version of a right one.
//
// The row lands with `enriched_at` NULL, so enriched_at is NULL, so enrichment completes this row in
// the export -> import round trip (D17), like every other row. Thin is a STAGE, not a permanent state.
function jobFromLabelledText({ url, text }) {
  const lines = String(text || '').split(/\r?\n/);
  const labels = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;                       // the blank line ends the header block
    const m = /^(Title|Company|Location|Work Type|Salary):\s*(.+)$/.exec(line.trim());
    if (!m) break;                                 // an unlabelled first line is not our block
    labels[m[1].toLowerCase()] = m[2].trim();
  }
  if (!labels.title) return null;

  // The employer's own domain, read structurally rather than guessed — the same rule
  // extractor.js's companyFromEmployerHost applies before it ever writes a Company line. Only
  // reached when the extractor could not name the company either.
  let company = labels.company || null;
  if (!company && url) {
    try {
      const hostname = new URL(url).hostname;
      // ⛔ THE HOST MUST LOOK LIKE A REAL EMPLOYER'S DOMAIN BEFORE IT CAN NAME ONE.
      // A first real run filed a posting under the company "Localhost", which is a fabrication
      // wearing a derivation's clothes. Requiring a registrable name plus a 2+ letter TLD rejects
      // localhost, bare hostnames and IP addresses; the ATS list rejects hosts that are where a
      // posting LIVES rather than who is hiring — greenhouse.io never employs anyone.
      const isRealDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(hostname)
                        && !/^\d+(\.\d+){3}$/.test(hostname);
      const host = hostname.replace(/^(www|jobs|careers|apply|boards)\./i, '');
      const root = host.split('.').slice(0, -1).join('.') || host;
      if (isRealDomain && root
          && !/^(greenhouse|lever|ashbyhq|myworkdayjobs|workable|recruitee|smartrecruiters|linkedin|indeed|glassdoor)$/i.test(root)) {
        company = root.split('.')[0].replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
    } catch { /* an unparseable URL simply yields no company */ }
  }
  // A posting with no identifiable employer is not filable. Failing here is correct: the caller is
  // told nothing could be read, which is honest, instead of a row attributed to nobody.
  if (!company) return null;

  const description = lines.slice(i).join('\n').trim();
  return normalizeJob({
    id:              crypto.randomUUID(),
    req_id:          null,
    title:           labels.title,
    company,
    location:        labels.location || null,
    url:             url || `import:${crypto.randomUUID()}`,
    source:          'import',
    description:     description || text.slice(0, 3000) || null,
    // ⛔ Every INFERRED field stays NULL. Enrichment fills these correctly later; a guess here
    // would be indistinguishable from a measurement and would never be revisited.
    // ⭐ D41(b): but a STATED salary is not a guess. The extractor writes a `Salary:` line when the
    // page states one, and this read used to drop it — the owner's capture lost its pay range here.
    ...(parseSalaryText(labels.salary) || { salary_min: null, salary_max: null, salary_currency: null }),
    remote:          null,
    posted_at:       null,
  });
}

/** The employer's own website from a JobPosting's hiringOrganization (sameAs / url) — for its logo. */
function employerSiteOf(ld) {
  const org = ld?.hiringOrganization;
  const site = typeof org === 'object' ? (org.sameAs || org.url) : null;
  const first = Array.isArray(site) ? site[0] : site;
  return typeof first === 'string' && /^https?:\/\//i.test(first) ? first : null;
}

// ── A schema.org JobPosting, read out of HTML (D33) ──────────────────────────────────────────────
// Most boards publish one, and it is the same structure extension/extractor.js prefers in the page.
// Regex-scanned rather than DOM-parsed: the server has no DOM, and only the script bodies matter.
// Same rules as the labelled block: no title or no employer -> null; nothing inferred.
function jobPostingFromHtml(html) {
  const blocks = String(html || '').matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const isPosting = (o) => o && (o['@type'] === 'JobPosting' || (Array.isArray(o['@type']) && o['@type'].includes('JobPosting')));
  for (const [, body] of blocks) {
    let data;
    try { data = JSON.parse(body.trim()); } catch { continue; }
    const list = [].concat(data?.['@graph'] || data);
    const hit = list.find(isPosting);
    if (hit) return hit;
  }
  return null;
}

function locationOfPosting(ld) {
  const places = [].concat(ld?.jobLocation || []).map(l => {
    const a = l?.address || {};
    const country = typeof a.addressCountry === 'string' ? a.addressCountry : a.addressCountry?.name;
    return [a.addressLocality, a.addressRegion, country].filter(v => typeof v === 'string' && v.trim()).join(', ');
  }).filter(Boolean);
  const remote = /TELECOMMUTE/i.test(String(ld?.jobLocationType || ''));
  const where = [].concat(ld?.applicantLocationRequirements || [])
    .map(r => (typeof r === 'string' ? r : r?.name || r?.address?.addressCountry?.name || r?.address?.addressCountry))
    .filter(v => typeof v === 'string' && v.trim()).join(', ');
  if (remote) places.push(where ? `Remote (${where})` : 'Remote');
  return places.join(' | ') || null;
}

function jobFromHtml({ url, html }) {
  const ld = jobPostingFromHtml(html);
  if (!ld) return null;
  const title = typeof ld.title === 'string' ? ld.title.trim() : '';
  const org = ld.hiringOrganization;
  const company = (typeof org === 'string' ? org : org?.name || '').trim();
  if (!title || !company) return null;
  const description = ld.description ? stripResumeHtml(String(ld.description)) : stripResumeHtml(html).slice(0, 3000);
  return normalizeJob({
    id: crypto.randomUUID(), req_id: null, title, company,
    location: locationOfPosting(ld),
    url: url || `import:${crypto.randomUUID()}`,
    source: 'import',
    description: description || null,
    // ⛔ Inferred fields stay NULL, as in the labelled read. ⭐ D41(b): `baseSalary` is STATED.
    ...(salaryFromJsonLd(ld.baseSalary) || { salary_min: null, salary_max: null, salary_currency: null }),
    remote: null, posted_at: null,
  });
}

/**
 * D41(b) · what the CAPTURED PAGE says about pay, for a known-ATS refetch that came back without it
 * (the ATS API and the page are two readings of one posting; the page is what the user saw).
 */
function statedSalaryOfCapture({ text, html }) {
  const ld = html ? jobPostingFromHtml(html) : null;
  const fromLd = ld ? salaryFromJsonLd(ld.baseSalary) : null;
  if (fromLd) return fromLd;
  const line = /^Salary:\s*(.+)$/m.exec(String(text || ''));
  return line ? parseSalaryText(line[1]) : null;
}

/**
 * ⛔ D17 / D33 — THE ONLY EXTRACTION, AND IT CALLS NO MODEL. A JobPosting in the HTML first, then the
 * extension's labelled block. Nothing readable is an ImportInputError (400) that says so — never a
 * 503, and never a guess.
 */
function extractJobDeterministic({ url, text, html }) {
  const job = (html && jobFromHtml({ url, html }))
    || jobFromLabelledText({ url, text: text || (html ? stripResumeHtml(html) : '') });
  if (!job) {
    throw new ImportInputError(
      "Could not read a job title and employer from this page. draft reads the posting's own " +
      "structured data or the extension's capture, and does not guess.");
  }
  return job;
}

/**
 * Attaches an imported job to the person who imported it.
 *
 * Without this an import vanished from its owner's point of view: the row lands in the GLOBAL
 * scraped_jobs pool, so whether the importer ever saw it again depended on their profile filters
 * happening to match the classification — while every OTHER user with a matching profile got it
 * on their board. ⛔ D41(a): it used to be STARRED for that reason; since 10-06 the user's own captures
 * are admitted to ALL directly and listed in the `+` view, and ★ is left to what the user saves.
 *
 * Uses scraped_jobs.job_id as the user_jobs key, matching what the board actually reads back
 * (server.js's per-row interaction lookup). Note the legacy /api/job-interaction endpoint keys
 * the SAME column by url instead — a pre-existing inconsistency, deliberately not "fixed" here
 * because changing it would silently orphan existing rows.
 *
 * Never throws: failing to star must not fail the import itself.
 *
 * Returns { noActiveProfile } so the answer can say when ★ Saved cannot show the job yet (the tab is
 * scoped to the active profile), or null when nothing was attached.
 */
function attachImportToUser(db, userId, jobId) {
  if (!userId || !jobId) return null;
  try {
    const activeProfile = db.prepare(
      'SELECT id FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1'
    ).get(userId);
    // ⛔ D33 — the ★ Saved tab reads `uj.domain_profile_id = <active profile>`, `starred = 1` and
    // `disliked = 0`. The upsert set only `starred`, so a capture of a job the user had touched
    // before — under another profile, or passed on — was starred and STILL not in ★ Saved: the
    // "inserted but missing from ★" outcome. A capture is the newest, most explicit act on the job,
    // so it moves the row to the active profile (keeping the old one only when there is none) and
    // clears a pass, exactly as the ★ button does (PATCH /api/jobs/:id/starred sets disliked = 0).
    // ⛔ D41(a) (owner, 10-06): A CAPTURE NO LONGER STARS. ★ is what the user chose to save; an import
    // is a different act, and its membership is job_captures (the `+` view). The row is still written
    // — on the active profile, with any pass cleared — because the board's ALL admits the user's own
    // captures through it (server.js ownRowsSql) and a passed job is hidden everywhere.
    db.prepare(`
      INSERT INTO user_jobs (user_id, job_id, domain_profile_id, starred, updated_at)
      VALUES (?, ?, ?, 0, unixepoch())
      ON CONFLICT(user_id, job_id) DO UPDATE SET
        disliked          = 0,
        domain_profile_id = COALESCE(excluded.domain_profile_id, user_jobs.domain_profile_id),
        updated_at        = unixepoch()
    `).run(userId, jobId, activeProfile?.id || null);
    return { noActiveProfile: !activeProfile };
  } catch (err) {
    console.warn(`[importJob] Could not attach import to user ${userId}:`, err.message);
    return null;
  }
}

/**
 * @param {{url?: string, text?: string, html?: string}} input
 * @param {{db: import('better-sqlite3').Database, userId?: number|null, force?: boolean}} ctx
 *   (No model client: since D33 import calls no model — D17.)
 *   force skips the freshness short-circuit and re-fetches even a row imported moments ago. For
 *   BACKFILLS after the extractor changes: when a source starts reading a field it previously
 *   dropped, every existing row is stale in a way `updated_at` cannot express, and without this
 *   the re-import silently returns the old row and the fix appears not to work. Not exposed over
 *   HTTP — routes/importJob.js never passes it, so a client cannot use it to force repeated
 *   outbound fetches.
 *   refetchOnly (D55 decision B, "Save link to draft") — a link saved from a right-click, with no page
 *   read: the posting may come ONLY from the ATS's own listing (path 1). The generic fetch of the
 *   link's page (path 2) is not attempted, so a link never makes us fetch an arbitrary page; the
 *   route checks linkRefetchability() first.
 *   auto (⭐ D64, automated capture) — the extension captured this page with no click. ⛔ Relevance to the
 *   user's board is decided BEFORE anything is written (services/jobs/autoCapture.js): a posting outside
 *   the US or outside the active profile's roles returns { discarded: true, reason } and leaves NO row —
 *   no scraped_jobs, no job_captures, no refusal record, not even its URL. A relevant one goes through
 *   the same gateway as a manual capture, recorded with origin 'auto_capture'.
 */
async function importJob({ url, text, html } = {}, { db, userId = null, force = false, refetchOnly = false, auto = false }) {
  if (!url && !text && !html) {
    throw new ImportInputError('Provide at least one of url, text, or html');
  }
  if (auto && !userId) throw new ImportInputError('Automatic capture needs a signed-in user');

  // ⭐ ONE JOB, ONE KEY (owner 10-12, Zoom's Workday posting opened straight from LinkedIn at
  // /apply/applyManually?source=linkedin). A page that names its requisition is captured as its POSTING — the
  // stage, the locale and the tracking stripped (services/jobPageKey.js) — and a key draft has already seen is
  // that job again, whichever stage it is captured from. The extension never parses an ATS URL; this does.
  const pageKey = url ? pageKeyOf(url) : null;
  if (pageKey) url = pageKey.canonicalUrl;
  const capturedBefore = (jobId) => {
    if (!userId || !jobId) return false;
    try { return !!db.prepare("SELECT 1 FROM job_captures WHERE user_id = ? AND job_id = ? AND (action IS NULL OR action NOT LIKE 'refused%')").get(userId, String(jobId)); }
    catch { return false; }
  };
  if (pageKey && !force && !auto) {
    // the key, or — the first time this requisition is seen — the job THIS user captured elsewhere with the same title
    // at the same company (LinkedIn → Workday, owner 10-13), so the Workday capture joins it instead of making a second
    const keyed = jobForPageKey(db, pageKey.key) || ownJobByTitleCompany(db, userId, pageKey);
    const krow = keyed ? db.prepare('SELECT * FROM scraped_jobs WHERE job_id = ?').get(keyed) : null;
    if (krow) {
      const target = krow.duplicate_of ? (db.prepare('SELECT * FROM scraped_jobs WHERE job_id = ?').get(krow.duplicate_of) || krow) : krow;
      const already = capturedBefore(target.job_id);
      const attachment = attachImportToUser(db, userId, target.job_id);
      recordExistingCapture(db, { jobId: target.job_id, url, userId, detectKnownAtsMatch, origin: text || html ? 'capture' : 'import_url' });
      recordPageKey(db, url, target.job_id);
      return answer(db, target, { action: 'attached', attachment, already });
    }
  }

  if (url && !force) {
    const existing = db.prepare(
      'SELECT * FROM scraped_jobs WHERE url = ? ORDER BY updated_at DESC LIMIT 1'
    ).get(url);
    const ageSeconds = existing ? Math.floor(Date.now() / 1000) - (existing.updated_at || 0) : Infinity;
    if (existing && ageSeconds < REIMPORT_FRESHNESS_SECONDS) {
      // Still attach on the fast path. The freshness short-circuit exists to avoid re-fetching,
      // but a SECOND user importing the same URL within the window is a real import for them —
      // skipping this would silently return someone else's row without adding it to their board.
      // A row retired as a duplicate resolves to its canonical row (A49 fix 4): starring the
      // retired id would save a job the board never shows.
      const target = existing.duplicate_of
        ? (db.prepare('SELECT * FROM scraped_jobs WHERE job_id = ?').get(existing.duplicate_of) || existing)
        : existing;
      // ⛔ D64: an automatic capture of a posting already in the pool joins this user's board only when
      // the board would show it — the row's own buckets decide — and only on US-admitted rows.
      if (auto) {
        const rel = autoCaptureRelevance(db, userId, { existingJobId: target.job_id });
        if (!rel.relevant) return discarded(rel.reason);
        if (boardStateOf(db, target.job_id).state !== 'on_board') return discarded('not_on_board');
      }
      const already = capturedBefore(target.job_id);
      const attachment = attachImportToUser(db, userId, target.job_id);
      // D33: the fast path recorded nothing, so a capture of a posting already on the board left no
      // job_captures row — indistinguishable, in the one table built to answer it, from a capture
      // that never reached the server.
      recordExistingCapture(db, {
        jobId: target.job_id, url, userId, detectKnownAtsMatch,
        origin: auto ? AUTO_CAPTURE_ORIGIN : text || html ? 'capture' : 'import_url',
      });
      recordPageKey(db, url, target.job_id);
      return answer(db, target, { action: 'attached', attachment, already });
    }
  }

  const providedText = text || (html ? stripResumeHtml(html) : null);
  // ⛔ D64: an automatic capture works only from the page the user is viewing — it never makes draft
  // fetch the posting (or any page) with nothing in hand.
  if (auto && !providedText) throw new ImportInputError('Automatic capture sends the page it read');

  // Login-walled with nothing else to work with → ask the client to capture it instead.
  // If text/html WAS also provided (the extension's own capture, or a manual paste alongside
  // the link), that's exactly the fallback this message describes — use it, don't refuse.
  if (url && isLoginWalled(url) && !providedText) {
    return {
      needsClientCapture: true,
      reason: 'login_walled',
      message: `Open this job and capture it with the ${BRAND} extension, or paste the job text.`,
    };
  }

  let normalizedJob = null;
  let atsFetchFailed = false;

  if (url && !isLoginWalled(url)) {
    const match = detectKnownAtsMatch(url);
    if (match) {
      try {
        normalizedJob = await fetchKnownAtsJob(db, match, url);
      } catch (err) {
        console.warn(`[importJob] Known-ATS reuse failed for ${match.type}: ${err.message}`);
        atsFetchFailed = true;
      }
    }
  }

  if (!normalizedJob && refetchOnly) {
    // An ATS that could not be reached is not a posting that closed — the route answers 502, retryable.
    if (atsFetchFailed) throw new Error("ats_unreachable");
    // D55 B: the ATS's own listing did not carry this posting — closed, or a link to something that
    // is not one posting. Said plainly; the generic page fetch below is not a fallback for a link.
    throw new ImportInputError(LINK_NOT_LISTED_MESSAGE);
  }

  if (!normalizedJob && providedText) {
    normalizedJob = extractJobDeterministic({ url: url || null, text, html });
  } else if (!normalizedJob && url && !isLoginWalled(url) && !auto) {
    normalizedJob = extractJobDeterministic({ url, html: await fetchGenericPosting(url) });
  }

  if (!normalizedJob) {
    if (auto) return discarded('not_a_posting');
    throw new ImportInputError('Could not extract a job from the given input');
  }

  // ⭐ D41(b) · A REFETCH WITHOUT PAY KEEPS THE PAGE'S. A known-ATS refetch is preferred for its
  // structure, but when its API carried no salary and the captured page STATED one (JSON-LD
  // baseSalary or the extractor's Salary line), the page's figure is the one the user saw.
  if (normalizedJob.salary_min == null && normalizedJob.salary_max == null && (text || html)) {
    const stated = statedSalaryOfCapture({ text, html });
    if (stated) normalizedJob = withSalary(normalizedJob, stated);
  }

  // ⛔ D41(d) · NO US EVIDENCE → NO CAPTURE. Only a posting that would be NEW is tested: one that
  // folds into a row draft already has keeps that row's own market status. The page's whole text is
  // evidence here (a capture has far more of it than a crawl's location string), and when the page —
  // not the location field — is what admits it, the gateway's location-only gate is told so.
  const preview = previewIngest(db, normalizedJob);
  // ⭐ a repeat capture of a job already in this user's imports says so (idempotent — no new prompt)
  const alreadyId = preview.action === 'attach' ? preview.existingJobId : null;
  const alreadyBefore = alreadyId ? capturedBefore(alreadyId) : false;
  let gate = true;
  if (preview.action !== 'attach') {
    // ⭐ D59: the posting read through the one normaliser — its markup decoded (so "United&nbsp;States"
    // is "United States"), and its label block's `Country:` is the employer's own statement.
    const posting = normalizePosting(normalizedJob.description);
    const market = captureMarket({
      location: normalizedJob.location || posting.fields.location || null, description: posting.text,
      offices: officeLocations(normalizedJob._raw), pageText: providedText || '',
      statedCountryUs: !!posting.fields.countryIsUs,
    });
    // ⛔ D64: outside the US, an automatic capture is DISCARDED — nothing recorded, not even the refusal.
    if (!market.admit && auto) return discarded('outside_us');
    if (!market.admit) {
      recordRefusedCapture(db, {
        url: url || normalizedJob.url, userId, reason: market.reason, detectKnownAtsMatch,
        origin: url && providedText ? 'capture' : url ? 'import_url' : 'paste',
      });
      throw new ImportRefusedError(market.kind, REFUSAL_MESSAGES[market.kind]);
    }
    if (market.reason.startsWith('capture_')) gate = false;
  }
  // ⛔ D64: relevance to the board, before the gateway writes anything. A posting that folds into an
  // existing row is judged by that row's buckets (what the board reads); a new one as it would classify.
  if (auto) {
    const rel = preview.action === 'attach' && preview.existingJobId
      ? autoCaptureRelevance(db, userId, { existingJobId: preview.existingJobId })
      : autoCaptureRelevance(db, userId, { job: normalizedJob });
    if (!rel.relevant) return discarded(rel.reason);
  }

  // ⛔ A62: THROUGH THE ONE GATEWAY (services/jobs/jobGateway.js) — the same deduper, canonical write
  // and US-only gate every crawled source uses, plus a job_captures row with the ATS host + slug
  // (A45). Classification is still informational only: an explicit user import never silently
  // vanishes. What the gateway adds for an import is queue 37's gate — a capture outside the US is
  // kept for the user (attached below) but held off the shared board, and the response says so.
  const origin = auto ? AUTO_CAPTURE_ORIGIN : url && providedText ? 'capture' : url ? 'import_url' : 'paste';
  const ingest = ingestJob(db, {
    job: normalizedJob, origin, userId,
    searchQuery: 'import',
    matchedBy: normalizedJob.source === 'import' ? 'import_extract' : 'import_ats_reuse',
    detectKnownAtsMatch, gate,
  });
  const finalJobId = ingest.jobId;
  const dedup = { action: ingest.action === 'attached' ? 'fold' : 'insert_canonical' };

  // Deliberately after the fold branch: when an import collapses into an existing canonical row
  // the user still imported it, so the row they get back is the one that must be starred.
  const attachment = attachImportToUser(db, userId, finalJobId);

  // No enrichment pass after an import (D17, A80 V4): it was a model call per imported URL. The
  // row is enriched when an export → import round trip covers it, like every other row.

  // Read back BEFORE reporting success, and say so out loud if the row is not there.
  //
  // This endpoint's whole contract is "your job is now in the pool". Every branch above assumes its
  // write landed: insert_canonical trusts upsertCanonicalJob, and the fold branch trusts that
  // dedup.intoJobId still names a live row. Neither is checked, and without this the failure mode is
  // a TypeError deep inside mapJobRow that the route turns into a generic 502 — indistinguishable
  // from a network problem, and no clue in the log that a write silently did nothing. That is the
  // defect class this codebase has been bitten by repeatedly (Jobo logging "sync complete — 0 jobs
  // cached" while unconfigured; enrichment stamping rows complete while writing nothing), so the
  // import must not be the next one. A missing row is an internal failure, not bad user input —
  // hence Error, which the route maps to 502, and not ImportInputError.
  // ⛔ D59: the capture's description is read through the one normaliser NOW, so the answer (and the
  // panel the user opens next) shows text, fields and requirements — not raw HTML until the next pass.
  try { refreshDescriptionText(db, finalJobId); } catch (e) { console.warn(`[importJob] description_text: ${e.message}`); }
  const row = db.prepare('SELECT * FROM scraped_jobs WHERE job_id = ?').get(finalJobId);
  if (!row) {
    console.error(
      `[importJob] WRITE DID NOT PERSIST — no scraped_jobs row for job_id=${finalJobId} ` +
      `(action=${dedup.action}, source=${normalizedJob.source}, url=${normalizedJob.url}). ` +
      `Reporting failure rather than returning success for a write that did not happen.`
    );
    throw new Error(`Import wrote no row for job_id ${finalJobId}`);
  }

  // An import that persists but is unreachable on the importer's own board is the SAME lie in a
  // quieter form — it is exactly what happened to the reported Quora posting, twice. job_role_map is
  // the binding constraint: /api/jobs joins it with an INNER JOIN on the profile's role_key, so a row
  // with no bucket is invisible to every board under every filter, ?curate=off included. Cheap to
  // check, and it turns a silent disappearance into a logged one.
  const hasBucket = db.prepare('SELECT 1 FROM job_role_map WHERE job_id = ? LIMIT 1').get(finalJobId);
  if (!hasBucket) {
    console.error(
      `[importJob] UNREACHABLE IMPORT — job_id=${finalJobId} persisted with no job_role_map row, ` +
      `so it cannot appear on any board. upsertCanonicalJob's ROLE_KEY_FALLBACK should make this ` +
      `impossible; if it is logged, that guard has regressed.`
    );
  }

  // A49 fix 4 + D33 — what happened, worded once (services/jobs/captureOutcome.js): inserted, ATTACHED
  // to a posting already on the board (with a link to it), or held off the board and why. The
  // extension and the site show this text; they no longer word the outcome themselves.
  recordPageKey(db, url, finalJobId);
  const result = answer(db, row, { action: ingest.action, attachment, already: alreadyBefore && String(alreadyId) === String(finalJobId) });
  // D41(c) · the employer's own site, when the captured page names it — the logo is queued from it
  // at capture time (routes/importJob.js), never from the ATS host.
  const site = html ? employerSiteOf(jobPostingFromHtml(html)) : null;
  return site ? { ...result, employerSite: site } : result;
}

/** ⛔ D64 · the answer for an automatic capture that was not kept — and nothing was written for it. */
function discarded(reason) {
  return { success: true, discarded: true, auto: true, reason, onBoard: false };
}

/** D41(b) · a stated salary onto a normalized job, with the USD columns normalizeJob would derive. */
function withSalary(job, s) {
  const usd = s.salary_currency === 'USD';
  return {
    ...job,
    salary_min: s.salary_min, salary_max: s.salary_max, salary_currency: s.salary_currency,
    salary_period: s.salary_period ?? job.salary_period ?? null,
    salary_min_usd: usd ? s.salary_min : job.salary_min_usd ?? null,
    salary_max_usd: usd ? s.salary_max : job.salary_max_usd ?? null,
  };
}

/**
 * The one shape every successful import answers (D33). `capture` is the contract; the A49/A62 flags
 * beside it are kept for the callers that already read them (the mobile contract, an extension
 * build from before v1.4.0), and `message` is capture.message for the same reason.
 */
function answer(db, row, { action, attachment, already = false }) {
  const capture = describeCapture(db, {
    jobId: row.job_id, action, title: row.title, company: row.company,
    noActiveProfile: !!attachment?.noActiveProfile, alreadyCaptured: !!already,
  });
  return {
    job: mapJobRow(row), capture, message: capture.message,
    ...(capture.matchedExisting ? { attachedToExisting: true, existingJobId: row.job_id } : {}),
    ...(capture.outcome === 'held' ? { outOfMarket: true } : {}),
  };
}

export {
  importJob, ImportInputError, ImportRefusedError, detectKnownAtsMatch, isLoginWalled,
  linkRefetchability, LINK_REFUSALS, LINK_NOT_LISTED_MESSAGE,
  isPrivateOrLoopbackIp, findMatchingPosting, jobFromLabelledText, jobFromHtml,
};
