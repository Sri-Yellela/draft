/**
 * Normalized Job Schema
 * Every job source plugin must return objects matching this shape.
 * The frontend depends ONLY on this shape — never on source-specific fields.
 *
 * Required fields: id, title, company, location, url, source
 * Optional fields: everything else — use null if unavailable
 */

import { EXPERIENCE_LEVELS, WORK_MODELS, valueSet } from '../../shared/jobFilterOptions.js';
import { levelFromTitle } from '../../shared/levelMapping.js';
import { segments as locationSegments, US_STATES } from './usLocation.js';

const JOB_SCHEMA_VERSION = '1.1';

// ── Enum helpers ──────────────────────────────────────────────────────────────

// The enum comes from the shared filter option contract, so what this WRITER is allowed to store
// and what the board's controls OFFER are one definition. There were four copies of this list
// (here, enrichJob.js, profileFilterBridge.js's LEVEL_ORDER, and the UI) and nothing checked them
// against each other — see shared/jobFilterOptions.js.
const VALID_EXPERIENCE_LEVELS = valueSet(EXPERIENCE_LEVELS);

// ⛔ D84 F2: the title ladder is shared/levelMapping.js — the SAME mapping the enrichment prompt states, so Staff and
// Principal are `lead` in both (they were stored as `senior` here). A title that says nothing is still 'mid', and
// that guess is recorded as a crawler placeholder (enrichment_provenance), which an import may replace.
function normalizeExperienceLevel(explicit, title) {
  if (explicit && VALID_EXPERIENCE_LEVELS.has(explicit)) return explicit;
  if (!title) return null;
  return levelFromTitle(title) ?? 'mid';
}

const VALID_WORKPLACE_TYPES = valueSet(WORK_MODELS);

function normalizeWorkplaceType(explicit, remoteBool, title, location) {
  if (explicit) {
    const v = explicit.toLowerCase().replace(/[-\s]+/g, '');
    if (v === 'remote') return 'remote';
    if (v === 'hybrid') return 'hybrid';
    if (v === 'onsite' || v === 'inoffice' || v === 'inperson') return 'onsite';
    if (VALID_WORKPLACE_TYPES.has(v)) return v;
  }
  if (remoteBool === true) return 'remote';
  const text = `${title || ''} ${location || ''}`.toLowerCase();
  if (/\bremote\b/.test(text)) return 'remote';
  if (/\bhybrid\b/.test(text)) return 'hybrid';
  if (/\b(onsite|on.?site|in.?office)\b/.test(text)) return 'onsite';
  return null;
}

// ⛔ THE FALL-THROUGH RETURNS null, NOT THE INPUT. It used to `return p`, which put whatever
// unrecognised token a provider sent straight into a column with a three-value vocabulary.
// Found by task AA's export -> import round trip: lever passes `salaryRange.interval` verbatim
// (sources/lever.js), Lever's own value is `per-year-salary`, stripping separators gives
// `peryearsalary`, nothing matched, and 30 production rows ended up holding that string.
//
// It cost more than an odd-looking cell. The importer validates against the SAME shared
// vocabulary, and it is all-or-nothing by design, so those 30 rows made every 500-row export
// batch containing one of them un-importable — a data defect from ingestion disabling the
// transfer path entirely. An unrecognised period is NO period: null is a value the board already
// handles everywhere, and a bogus enum member is not.
//
// Lever's remaining intervals (`per-week-salary`, `per-day-wage`, `one-time-payment`) have no
// honest target in annual|hourly|monthly and so become null rather than being rounded to the
// nearest one — inventing a period would misstate the pay.
function normalizeSalaryPeriod(period) {
  if (!period) return null;
  const p = String(period).toLowerCase().replace(/[-_\s]+/g, '');
  if (p === 'annual' || p === 'yearly' || p === 'year' || p === 'peryear'
      || p === 'peryearsalary')  return 'annual';
  if (p === 'hourly' || p === 'hour' || p === 'perhour'
      || p === 'perhourwage')    return 'hourly';
  if (p === 'monthly' || p === 'month' || p === 'permonth'
      || p === 'permonthsalary') return 'monthly';
  return null;
}

function inferClearanceRequired(title) {
  if (!title) return null;
  return /\b(security\s+clearance|clearance\s+required|active\s+clearance|top.?secret|ts\/sci)\b/i.test(title) ? 1 : null;
}

/** D84 F2: which branch of normalizeWorkplaceType answered — stated by the source, by the board's location, or a guess. */
function workplaceProvenance(explicit, remoteBool, title, location) {
  if (!normalizeWorkplaceType(explicit, remoteBool, title, location)) return null;
  if (explicit && normalizeWorkplaceType(explicit, null, '', '')) return 'source';
  if (remoteBool === true) return 'source';
  if (normalizeWorkplaceType(null, null, '', location)) return 'board_location';
  return 'crawler_fallback';
}

// ── Cross-source fingerprint ────────────────────────────────────────────────
// Identity key used to collapse the same role posted through multiple sources
// (e.g. a company's own Greenhouse board AND an Adzuna/SerpApi listing of it)
// into one canonical board row. Deliberately built from the RAW title, not
// `normalized_title` — that column is just a lowercased passthrough today, and
// real title canonicalization (stripping level suffixes, punctuation variants,
// etc.) is a later enrichment product. Coupling dedup to it now would silently
// break identity matching whenever that enrichment ships.

function normalizeForFingerprint(str) {
  return String(str || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')   // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

// A location field can list more than one office ("New York, NY / Remote");
// the fingerprint keys on the first (primary) one only. Split exactly as the A37 US gate splits
// (usLocation.segments): `|`, `;`, `•`, " / ", lower-case " or " / " and ", parentheses. The old
// split used `\bor\b` case-INsensitively, which cut "Portland, OR" in half.
function primaryLocationSegment(location) {
  return locationSegments(String(location || ''))[0] || '';
}

// ── A49 fix 2 — the fingerprint keys on the PLACE, not on how a source spelled it ─────────────
// Measured on the local board with simulated aggregator echoes of each US row (scripts/
// a49FingerprintMeasure.mjs): "City, ST" merged 35.3%, "City, State" 5.0%, ", Inc." 0%,
// " - Remote" 0% — because the key was the exact normalized string, so "San Francisco",
// "San Francisco, CA" and "San Francisco, California, United States" were three places.
//
// ⛔ ONE ROLE IN DIFFERENT CITIES IS NEVER MERGED. Everything below only ever REMOVES spelling
// differences of the SAME place; it never drops a city. A state is inferred for a bare city only
// from the short list of cities that are unambiguous on this board (no Portland, no Dublin, no
// bare Washington), and a qualified city keeps its own state — "Dublin" (Ireland) and
// "Dublin, CA" stay two keys, as do "Portland, OR" and "Portland, ME".
const STATE_CODE_BY_NAME = Object.fromEntries(Object.entries(US_STATES).map(([code, name]) => [name, code.toLowerCase()]));
const STATE_CODES = new Set(Object.keys(US_STATES).map(c => c.toLowerCase()));
const US_COUNTRY = new Set(['united states', 'united states of america', 'usa', 'us', 'u s', 'u s a', 'america']);
const CITY_ALIASES = {
  'sf': 'san francisco', 'nyc': 'new york', 'new york city': 'new york', 'new-york': 'new york',
  'sea': 'seattle', 'chi': 'chicago', 'atl': 'atlanta',
};
const UNAMBIGUOUS_CITY_STATE = {
  'san francisco': 'ca', 'south san francisco': 'ca', 'new york': 'ny', 'seattle': 'wa', 'chicago': 'il',
  'austin': 'tx', 'boston': 'ma', 'los angeles': 'ca', 'palo alto': 'ca', 'mountain view': 'ca',
  'menlo park': 'ca', 'sunnyvale': 'ca', 'redwood city': 'ca', 'san diego': 'ca', 'santa monica': 'ca',
  'west hollywood': 'ca', 'denver': 'co', 'atlanta': 'ga', 'pittsburgh': 'pa', 'philadelphia': 'pa',
  'salt lake city': 'ut', 'houston': 'tx', 'dallas': 'tx', 'minneapolis': 'mn', 'nashville': 'tn',
};
const REMOTE_RE = /\b(remote|rem|remote first|remote friendly|work from home|wfh|anywhere)\b/;
// Words that qualify a remote posting without naming a region.
const REMOTE_FILLER = /\b(remote|rem|first|friendly|travel|required|based|in|from|the|within|national|eligible|open|to|only|wfh|work|home|anywhere)\b/g;
const OFFICE_FILLER = /\b(hq|headquarters|main office|office|privy)\b/g;
const WORKPLACE_PREFIX = /^(hybrid|on site|onsite|in office)\s+/;

function fingerprintLocation(location) {
  const raw = String(primaryLocationSegment(location)).replace(/^(us|usa)\s*[-–:]\s*/i, '');
  const seg = normalizeForFingerprint(raw);
  if (!seg) return '';
  // Commas join a city to its state, so the RAW segment is split for structure.
  const parts = raw.split(',').map(p => normalizeForFingerprint(p).replace(WORKPLACE_PREFIX, '')
    .replace(OFFICE_FILLER, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (parts.length && REMOTE_RE.test(parts[0])) {
    // "US - Remote", "Remote (US)", "Remote in the US", "Remote, US": one place — remote, US.
    // "Remote - Canada" keeps its region: a different market is a different job. Only when the
    // FIRST place is remote — "SF, NYC, Remote" is San Francisco.
    const region = parts.join(' ').replace(REMOTE_FILLER, ' ').split(' ')
      .filter(w => w && !US_COUNTRY.has(w)).join(' ');
    return region ? `remote ${region}` : 'remote';
  }
  while (parts.length > 1 && US_COUNTRY.has(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return seg;
  let city = parts[0];
  city = CITY_ALIASES[city] || city;
  if (US_COUNTRY.has(city)) return 'united states';
  // The second comma part is a state only when it IS one; "San Francisco, Seattle" is a list, and
  // its first city is the location. A non-US region ("London, UK") is kept as written.
  const second = parts[1];
  let state = null;
  if (second) {
    if (STATE_CODES.has(second)) state = second;
    else if (STATE_CODE_BY_NAME[second]) state = STATE_CODE_BY_NAME[second];
    else if (!UNAMBIGUOUS_CITY_STATE[CITY_ALIASES[second] || second] && !REMOTE_RE.test(second)) state = second;
  }
  if (!state && UNAMBIGUOUS_CITY_STATE[city]) state = UNAMBIGUOUS_CITY_STATE[city];
  return state ? `${city} ${state}` : city;
}

// Legal-form suffixes only — never a word that is part of the name ("Scale AI" stays "scale ai").
const COMPANY_SUFFIX = /(?:\s+(?:inc|incorporated|llc|l l c|ltd|limited|corp|corporation|co|plc|gmbh|pbc|lp|l p))+$/;
function fingerprintCompany(company) {
  return normalizeForFingerprint(company).replace(COMPANY_SUFFIX, '').trim();
}

// A trailing workplace qualifier an aggregator appends to the title: "Engineer - Remote",
// "Engineer (Remote, US)", "Engineer, Hybrid". Only at the END, only these words.
const TITLE_WORKPLACE_SUFFIX = /\s*(?:[-–—|,]\s*|\(\s*)(?:remote|hybrid|on-?site)(?:\s*[-–,]?\s*(?:us|usa|united states))?\s*\)?\s*$/i;
function fingerprintTitle(title) {
  return normalizeForFingerprint(String(title || '').replace(TITLE_WORKPLACE_SUFFIX, ''));
}

function computeFingerprint({ company, title, location }) {
  const c = fingerprintCompany(company);
  const t = fingerprintTitle(title);
  const l = fingerprintLocation(location);
  return `${c}|${t}|${l}`;
}

// ── Requisition-ID identity (Task 3.1 hardening) ────────────────────────────
// The coarse fingerprint above collapses on company|title|location, which is right for
// matching an ATS req against an aggregator's echo of it, but WRONG for two genuinely
// different open reqs at the same employer that happen to share a title and city (common
// at high-volume employers — exactly the ones users care most about). When a source exposes
// a stable per-requisition identifier (req_id), that identifier disambiguates true siblings
// from the same posting seen twice. Namespaced with source AND company — a bare req id can
// collide across unrelated sources/companies (e.g. two different Workday tenants both
// numbering requisitions "R100" independently).
//
// ⛔ A49 fix 1 — THE NAMESPACE IS THE REQUISITION'S HOME ATS, NOT THE SOURCE THAT CARRIED IT.
// It used to be `source` outright, so the same Ashby posting reached through Jobo got
// `jobo:linear:<jobo's own id>` while the Ashby crawl wrote `ashby:linear:<uuid>`. selectMatch
// reads two different non-null req_uids as two distinct sibling reqs, so the pair could NEVER
// merge — the canonical priority (direct ATS > provider > aggregator > import) never got a vote.
// A non-ATS source whose URL is a known ATS posting URL now gets the identity the ATS crawl itself
// computes, so the pair matches EXACTLY (not by fingerprint), and a sibling req at the same
// company/title/city still keeps its own row. A direct-ATS source keeps the formula it always had,
// so no stored ATS req_uid changes meaning.
const DIRECT_ATS_NAMESPACES = new Set([
  'greenhouse', 'lever', 'ashby', 'workday', 'smartrecruiters', 'workable', 'recruitee', 'bamboohr', 'gem',
]);

// The posting's identity on the ATS that owns it, read from its URL — or null. Pure, and only
// ever answers for a URL whose path actually carries the id (an ATS host with no id in the path
// is null, not a guess). The ids are the ones each ATS plugin stores as req_id: Greenhouse's
// numeric job id (also `gh_jid` on a company-hosted careers page, which is what Greenhouse's own
// absolute_url often is), Lever's and Ashby's posting uuids, SmartRecruiters' numeric id and
// Workable's shortcode. Recruitee and Workday expose no id in their public URLs.
function atsPostingIdentity(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const ghJid = u.searchParams.get('gh_jid');
  if (ghJid && /^\d+$/.test(ghJid)) return { type: 'greenhouse', externalId: ghJid };
  let m;
  if (/(^|\.)greenhouse\.io$/.test(host) && (m = path.match(/\/jobs\/(\d+)/))) {
    return { type: 'greenhouse', externalId: m[1] };
  }
  if (host === 'jobs.lever.co' && (m = path.match(/^\/[^/]+\/([0-9a-f]{8}-[0-9a-f-]{27,})/i))) {
    return { type: 'lever', externalId: m[1].toLowerCase() };
  }
  if (host === 'jobs.ashbyhq.com' && (m = path.match(/^\/[^/]+\/([0-9a-f]{8}-[0-9a-f-]{27,})/i))) {
    return { type: 'ashby', externalId: m[1].toLowerCase() };
  }
  if (host === 'jobs.smartrecruiters.com' && (m = path.match(/^\/[^/]+\/(\d+)(?:-|$)/))) {
    return { type: 'smartrecruiters', externalId: m[1] };
  }
  if (host === 'apply.workable.com' && (m = path.match(/\/j\/([a-z0-9]+)/i))) {
    return { type: 'workable', externalId: m[1] };
  }
  return null;
}

function computeReqUid({ source, company, req_id, url }) {
  const c = normalizeForFingerprint(company);
  if (DIRECT_ATS_NAMESPACES.has(source)) return req_id ? `${source}:${c}:${req_id}` : null;
  const home = atsPostingIdentity(url);
  if (home) return `${home.type}:${c}:${home.externalId}`;
  return req_id ? `${source}:${c}:${req_id}` : null;
}

// The namespace a req_uid was minted in — the part before the first ':'. Two req_uids are only
// COMPARABLE when they share it: within one namespace a different id is a different requisition,
// across namespaces (a Jobo id against an Ashby uuid, a company's Greenhouse id against its new
// Ashby uuid) the ids say nothing about each other and the fingerprint has to decide.
function reqUidNamespace(reqUid) {
  if (!reqUid) return null;
  const i = String(reqUid).indexOf(':');
  return i === -1 ? String(reqUid) : String(reqUid).slice(0, i);
}

/**
 * Creates a normalized job object with defaults for missing fields.
 * Call this in every source plugin's normalizer.
 */
function normalizeJob({
  id,              // string — unique within this source (will be namespaced)
  title,           // string — job title
  company,         // string — company/employer name
  location,        // string — city, state or "Remote"
  url,             // string — canonical apply URL
  source,          // string — source plugin name e.g. 'adzuna'
  description,     // string|null — plain text job description (no HTML)
  description_full, // string|null — the WHOLE plain text, never cut (D84 F1); kept only when `description` was cut
  salary_min,     // number|null — minimum salary (annual, USD)
  salary_max,      // number|null — maximum salary (annual, USD)
  salary_currency, // string|null — ISO 4217 e.g. 'USD'
  posted_at,       // string|null — ISO 8601 date string
  contract_type,   // string|null — 'full_time'|'part_time'|'contract'|'internship'
  remote,          // boolean|null — true if explicitly remote
  thumbnail,       // string|null — company logo/thumbnail URL (SerpApi, etc.)
  via,             // string|null — listing attribution e.g. "via LinkedIn"
  _attribution,    // object|null — { name, url } if source ToS requires attribution
  _raw,            // object — original source response (stripped before client)
  // ── Enriched fields (v1.1) — null when source can't supply ──────────────
  workplace_type,      // 'remote'|'hybrid'|'onsite'|null — explicit from source
  experience_level,    // enum from VALID_EXPERIENCE_LEVELS — explicit from source
  valid_through,       // number|null — unix epoch when listing expires
  salary_min_usd,      // number|null — explicit USD override (otherwise derived)
  salary_max_usd,      // number|null — explicit USD override (otherwise derived)
  salary_period,       // 'annual'|'hourly'|'monthly'|null
  skills,              // string[]|null — job skill tags
  is_h1b_sponsor,      // boolean|null
  requires_work_auth,  // boolean|null
  is_clearance_required, // boolean|null — explicit from source
  // ── Requisition identity (Task 3.1) ──────────────────────────────────────
  req_id,              // string|null — the source's OWN stable per-requisition identifier
                       // (Greenhouse/Ashby/Recruitee job id, Lever/SmartRecruiters posting id,
                       // Workday requisition number, Workable shortcode). Omit/leave null for
                       // sources with no genuine per-req identifier (aggregators) — they fall
                       // back to the company|title|location fingerprint for dedup instead.
} = {}) {
  if (!id)      throw new Error('normalizeJob: id is required');
  if (!title)   throw new Error('normalizeJob: title is required');
  if (!company) throw new Error('normalizeJob: company is required');
  if (!url)     throw new Error('normalizeJob: url is required');
  if (!source)  throw new Error('normalizeJob: source is required');

  const cleanTitle       = String(title).trim();
  const cleanDesc        = description ? String(description).trim() : null;
  const cleanCurrency    = salary_currency || null;
  const resolvedSalMin   = salary_min != null ? Number(salary_min) : null;
  const resolvedSalMax   = salary_max != null ? Number(salary_max) : null;
  const isUsd            = cleanCurrency === 'USD';

  return {
    id:              `${source}::${id}`,
    title:           cleanTitle,
    company:         String(company).trim(),
    location:        location ? String(location).trim() : 'Location not specified',
    url:             String(url),
    source,
    description:     cleanDesc,
    // NULL when the stored description is already the whole text — a second copy only where the cap cut it.
    description_full: description_full && String(description_full).trim() !== cleanDesc ? String(description_full).trim() : null,
    salary_min:      resolvedSalMin,
    salary_max:      resolvedSalMax,
    salary_currency: cleanCurrency,
    posted_at:       posted_at || null,
    contract_type:   contract_type || null,
    remote:          remote != null ? Boolean(remote) : null,
    thumbnail:       thumbnail || null,
    via:             via || null,
    _attribution:    _attribution || null,
    _raw,
    _schema_version: JOB_SCHEMA_VERSION,
    // ── Enriched fields ─────────────────────────────────────────────────────
    normalized_title:      cleanTitle.toLowerCase(),
    summary:               cleanDesc ? cleanDesc.slice(0, 300) || null : null,
    experience_level:      normalizeExperienceLevel(experience_level, cleanTitle),
    workplace_type:        normalizeWorkplaceType(workplace_type, remote != null ? Boolean(remote) : null, cleanTitle, location),
    valid_through:         valid_through != null ? Math.round(Number(valid_through)) : null,
    salary_min_usd:        salary_min_usd != null ? Math.round(Number(salary_min_usd))
                         : (isUsd && resolvedSalMin != null ? Math.round(resolvedSalMin) : null),
    salary_max_usd:        salary_max_usd != null ? Math.round(Number(salary_max_usd))
                         : (isUsd && resolvedSalMax != null ? Math.round(resolvedSalMax) : null),
    salary_period:         normalizeSalaryPeriod(salary_period),
    skills_json:           Array.isArray(skills) && skills.length ? JSON.stringify(skills) : null,
    is_h1b_sponsor:        is_h1b_sponsor != null ? (is_h1b_sponsor ? 1 : 0) : null,
    requires_work_auth:    requires_work_auth != null ? (requires_work_auth ? 1 : 0) : null,
    is_clearance_required: is_clearance_required != null ? (is_clearance_required ? 1 : 0)
                         : inferClearanceRequired(cleanTitle),
    // ⛔ D84 F2 · where each enrichment value came from. `crawler_fallback` (a guess from the title or the first
    // 300 characters) counts as EMPTY for the importer's "fill empty only"; `source` (the ATS stated it) and
    // `board_location` (the board's own location says Remote / Hybrid / On-site) are stated values and are kept.
    enrichment_provenance: JSON.stringify(Object.fromEntries(Object.entries({
      summary:               cleanDesc ? 'crawler_fallback' : null,
      normalized_title:      'crawler_fallback',
      experience_level:      experience_level && VALID_EXPERIENCE_LEVELS.has(experience_level) ? 'source'
                           : cleanTitle ? 'crawler_fallback' : null,
      workplace_type:        workplaceProvenance(workplace_type, remote != null ? Boolean(remote) : null, cleanTitle, location),
      skills_json:           Array.isArray(skills) && skills.length ? 'source' : null,
      salary_min_usd:        salary_min_usd != null || (isUsd && resolvedSalMin != null) ? 'source' : null,
      salary_max_usd:        salary_max_usd != null || (isUsd && resolvedSalMax != null) ? 'source' : null,
      salary_period:         normalizeSalaryPeriod(salary_period) ? 'source' : null,
      is_h1b_sponsor:        is_h1b_sponsor != null ? 'source' : null,
      requires_work_auth:    requires_work_auth != null ? 'source' : null,
      is_clearance_required: is_clearance_required != null ? 'source' : inferClearanceRequired(cleanTitle) != null ? 'crawler_fallback' : null,
    }).filter(([, v]) => v))),
    req_id:                req_id != null ? String(req_id) : null,
  };
}

/**
 * Strips internal/debug fields before sending to client.
 * Always call this on every job before res.json().
 */
function stripInternalFields(job) {
  const { _raw, _schema_version, req_id, ...clientJob } = job;
  return clientJob;
}

// ── Employment type: source vocabulary -> the board's vocabulary ────────────────────────────────
//
// Six of the nine sources already extract an employment/contract type (adzuna, jobo, recruitee,
// smartrecruiters, workable, workday) and each spells it differently: workday sends `timeType`
// ("Full time"), smartrecruiters a `typeOfEmployment.id`, adzuna its own mapped `full_time`,
// the rest raw source strings. None of it was ever persisted — aggregator's upsert had no
// employment_type column — so the value was parsed on every crawl and thrown away, and the board's
// Employment Type filter queried a column nothing could write. It matched zero rows for its whole
// life.
//
// Canonicalises onto the vocabulary the CLIENT already sends and saved searches already store
// (JobsPanel's EMPLOYMENT_TYPES: full-time | part-time | contract | internship), so no existing
// stored querystring has to change meaning.
//
// UNRECOGNISED INPUT RETURNS null, deliberately. The column is filtered with the soft-null pattern
// `(employment_type IS NULL OR employment_type IN (...))`, so null means "not established" and the
// row stays visible; guessing instead would hide a posting under a label the source never gave it.
// Same call this codebase's import path already makes: an honest "cannot parse this one" beats a
// wrong guess.
const EMPLOYMENT_TYPE_SYNONYMS = new Map(Object.entries({
  'full-time': 'full-time', 'full time': 'full-time', 'full_time': 'full-time',
  'fulltime': 'full-time', 'permanent': 'full-time', 'permanent_employee': 'full-time',
  'regular': 'full-time', 'ft': 'full-time',
  'part-time': 'part-time', 'part time': 'part-time', 'part_time': 'part-time',
  'parttime': 'part-time', 'pt': 'part-time',
  'contract': 'contract', 'contractor': 'contract', 'contract_employee': 'contract',
  'fixed-term': 'contract', 'fixed term': 'contract', 'freelance': 'contract',
  'temporary': 'contract', 'temp': 'contract', 'seasonal': 'contract',
  'internship': 'internship', 'intern': 'internship', 'trainee': 'internship',
  'apprentice': 'internship', 'apprenticeship': 'internship', 'co-op': 'internship',
}));

function normalizeEmploymentType(raw) {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  return EMPLOYMENT_TYPE_SYNONYMS.get(key)
      ?? EMPLOYMENT_TYPE_SYNONYMS.get(key.replace(/[\s_]/g, '-'))
      ?? null;
}

export { normalizeJob, stripInternalFields, JOB_SCHEMA_VERSION, computeFingerprint, normalizeForFingerprint, computeReqUid, reqUidNamespace, atsPostingIdentity, normalizeEmploymentType,
  normalizeWorkplaceType, inferClearanceRequired };
