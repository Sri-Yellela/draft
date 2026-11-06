// Normalises a scraped_jobs/aggregator row (snake_case DB columns or camelCase live-search
// results) into the single camelCase shape every job-board client consumes. Extracted out of
// server.js so routes/importJob.js can return the exact same shape the board already uses,
// without duplicating the mapping.
import { isFresh } from './descriptionText.js';
import { isPlaceholderLocation } from '../../shared/postingNormalize.js';

function parseSkillsList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    // skills_json holds two coexisting shapes (see jobQuery.js's computeSkillsFacet): plain
    // strings, or { skill, type } objects from enrichJob.js's typed hard/soft extraction.
    return arr
      .map(entry => (typeof entry === 'string' ? entry : entry?.skill))
      .filter(s => typeof s === 'string' && s.trim());
  } catch { return null; }
}

function parseFields(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch { return null; }
}

/**
 * ⛔ D59 · the posting's stated requirements (migration 137's req_* columns) — what the POSTING asks,
 * never an answer about the candidate. null when the description has not been read yet (unknown).
 */
function requirementsOf(j, fresh) {
  if (!fresh || (j.req_citizenship == null && j.req_clearance == null)) return j.requirements ?? null;
  return {
    citizenship:     j.req_citizenship ?? null,
    clearance:       j.req_clearance ?? null,
    clearanceStatus: j.req_clearance_status ?? null,
    polygraph:       j.req_polygraph == null ? false : !!j.req_polygraph,
  };
}

/** D59 · the label block's fields the panel shows (travel, relocation, requisition, site) — or null. */
function postingFieldsOf(f) {
  if (!f) return null;
  const out = {
    travel:        f.travel ?? null,
    relocation:    f.relocation ?? null,
    requisitionId: f.requisitionId ?? null,
    employment:    f.employmentType ?? null,
    payRange:      f.payRange ?? null,
    country:       f.country ?? null,
    site:          f.codedLocation?.site ?? null,
    street:        f.codedLocation?.street ?? null,
  };
  return Object.values(out).some(v => v != null) ? out : null;
}

function mapJobRow(j) {
  // ⛔ D59: the derived columns are served only while they were read from the description held NOW.
  const fresh = j.description_basis != null && isFresh(j);
  const fields = fresh ? parseFields(j.description_fields) : null;
  const pay = fields?.pay || null;
  // ⛔ D71: precedence, never an overwrite — the provider's structured salary, then the text's.
  const structured = (j.salary_min ?? j.salaryMin) != null || (j.salary_max ?? j.salaryMax) != null;
  // normalizeJob's placeholder is not a location; the posting's own words are. ⭐ Nor is a provider's "N/A" / "na" /
  // "none" / "-" / "TBD" / "unknown" (shared/postingNormalize.js isPlaceholderLocation, exact match only): D156 (7)
  // omits an unknown value, so the card reads "Stripe", never "Stripe · na".
  const known = (v) => (isPlaceholderLocation(v) ? null : v);
  const location = known(j.location);
  return {
    id:              j.job_id || j.id,
    title:           j.title,
    company:         j.company,
    // D59: a posting whose location field is empty takes its label block's ("Marlborough, MA");
    // D71: failing that, the place on its pay line ("Boston, MA").
    location:        location || known(fields?.locationLabel) || known(fields?.payLocationLabel) || null,
    // ⛔ D59: the NORMALISED text when there is one — markup-free, the label block's lines removed.
    // `description` itself is never rewritten (content_hash is a hash of it).
    description:     (fresh ? j.description_text : null) ?? j.description,
    url:             j.url,
    applyUrl:        j.apply_url || j.applyUrl || j.url,
    salaryMin:       j.salary_min  ?? j.salaryMin  ?? pay?.salary_min ?? null,
    salaryMax:       j.salary_max  ?? j.salaryMax  ?? pay?.salary_max ?? null,
    salaryCurrency:  j.salary_currency  || j.salaryCurrency  || pay?.salary_currency || null,
    // D71: the unit as stated (hourly stays hourly), and where the figure came from — "description"
    // lets the panel say "from the posting text"; per-location lines when the posting lists several.
    salaryPeriod:    structured ? (j.salary_period ?? j.salaryPeriod ?? null) : (pay?.salary_period ?? null),
    salarySource:    structured ? 'provider' : (pay?.source ?? null),
    payLocations:    !structured && pay?.locations?.length > 1 ? pay.locations : null,
    // D71: "not stated" may only be said about a text that exists; with none it is "couldn't read".
    descriptionMissing: !String(j.description ?? '').trim(),
    // ⭐ D59: "Date Posted" from the label block is the POSTING's own date, not the crawl's.
    postedAt:        fields?.postedAt || j.posted_at  || j.postedAt  || null,
    contractType:    j.contract_type || j.contractType || null,
    remote:          Boolean(j.remote),
    source:          j.source,
    sourceLabel:     j.source_label || j.sourceLabel || null,
    sourcePlatform:  j.source || j.source_label || j.sourcePlatform || 'direct',
    via:             j.via || null,
    bucketRole:      j.bucket_role      || j.bucketRole      || null,
    bucketSeniority: j.bucket_seniority || j.bucketSeniority || null,
    bucketDomain:    j.bucket_domain    || j.bucketDomain    || null,
    directApply:     Boolean(j.direct_apply ?? j.directApply),
    companyIconUrl:  j.company_icon_url || j.companyIconUrl  || j.thumbnail || null,
    // THE STORED COLUMN IS ats_score. This read `j._matchScore || j.match_score`, and neither
    // exists: `_matchScore` is assigned nowhere in this repository and `match_score` is not a
    // column on scraped_jobs. So this field was NULL on every row of every response, always.
    //
    // Nothing failed, because the desktop client never reads it — JobCard/JobDetailPanel/JobsPanel
    // all read `g?.atsScore ?? job?.baseAtsScore`, and baseAtsScore comes from a different mapper
    // (the /api/jobs/poll shape) reading the same ats_score column. Two sides, each self-consistent,
    // joined to nothing. It surfaced only when a native client implemented the mobile contract
    // exactly as written and banded every job as "Not enough signal".
    //
    // ?? NOT ||, DELIBERATELY. A score of 0 is a real score and bands as Weak; `||` would collapse
    // it to null, and null means the scorer DECLINED. Those are different answers, and keeping them
    // apart is the entire point of the fourth band.
    //
    // Still null on two paths, correctly: /api/jobs/generic selects an explicit column list without
    // ats_score because a public unpersonalized feed has no per-user score, and live aggregator
    // results have never been scored. Both are "no opinion", which is what null means here.
    //
    // ⛔ CC5 · IT NO LONGER READS sj.ats_score, AND THE REASON IS THE OPPOSITE OF THE NOTE ABOVE.
    // That note fixed this field to read the STORED column, on the reasoning that a mobile client
    // implementing the contract literally was banding every job "Not enough signal". The fix was
    // right about the symptom and wrong about the cure: `scraped_jobs.ats_score` is ONE CELL PER
    // JOB, written at ingest from whichever user's résumé basis happened to trigger the crawl and
    // overwritten wholesale by adopt-enhanced for a single profile. Wiring it up here did not give
    // the mobile client its user's score — it gave every user the same stranger's score, on every
    // surface this mapper feeds (the board, by-id, import).
    //
    // A score is a statement about (résumé, posting). A per-job column cannot hold one, so this
    // reads only an explicitly per-caller value passed in by the route (`j.matchScore`), and
    // nothing derived from the shared cell.
    //
    // WHERE A REAL VALUE NOW COMES FROM: GET /api/jobs selects `aor.ats_score AS matchScore` off a
    // LEFT JOIN of `ats_only_reports` keyed (user_id, domain_profile_id, job_id). So the mobile
    // client's requirement is met from a source that CAN be correct — it is populated for the rows
    // that caller has had scored on that profile, and null for the rest, which is the honest answer
    // rather than a stranger's. Every other path this mapper feeds still passes nothing and still
    // gets null: /api/jobs/generic is a public unpersonalized feed with no user to score against,
    // by-id and import have no per-caller score to hand it, and live aggregator results have never
    // been scored. Both of those are "no opinion", which is what null means here.
    matchScore:      j.matchScore ?? null,
    starred:         Boolean(j.starred),
    visited:         Boolean(j.visited),
    disliked:        Boolean(j.disliked),
    // FE-1: Task 1/5 enrichment fields — additive, nullable-safe. null means "no signal yet"
    // (not-yet-enriched or the posting never stated it) and must render as absent on the
    // client, never as a false negative (e.g. isH1bSponsor: null is NOT "does not sponsor").
    isH1bSponsor:        j.is_h1b_sponsor        ?? null,
    requiresWorkAuth:    j.requires_work_auth    ?? null,
    isClearanceRequired: j.is_clearance_required ?? null,
    experienceLevel:     j.experience_level      ?? null,
    workplaceType:       j.workplace_type        ?? fields?.workplace ?? null,
    // D29's tags, for D32's masthead kicker (domain · level · workplace). NULL means UNKNOWN, never NO —
    // the masthead prints only the tags on file. Closed vocabularies (shared/jobTagVocabulary.js).
    tagFunction:         j.tag_function          ?? null,
    tagLevel:            j.tag_level             ?? null,
    tagWorkplace:        j.tag_workplace         ?? null,
    skills:              parseSkillsList(j.skills_json ?? j.skills) ?? [],
    // Automation tier (services/jobs/automationTier.js): what the candidate will face at the
    // apply destination, known at browse time instead of mid-run. null here means the row predates
    // migration 078 and has not been recomputed yet — the client must read that exactly the way it
    // reads 'unknown' (no promise in either direction), never as 'direct'.
    automationTier:      j.automation_tier       ?? j.automationTier ?? null,
    // Whether the LISTING is still live, not whether the row exists. Only the Saved tab can return
    // is_active = 0 rows (see server.js): runExpiredJobsCleanup retires an expired starred job
    // rather than deleting it, so its owner keeps it — and needs to be told it has closed instead of
    // being sent to apply for something that is gone. Absent column (a live-search result, which has
    // no is_active at all) reads as live, which is what a just-fetched posting is.
    isActive:            j.is_active == null ? true : !!j.is_active,
    // A62 follow-up: an inactive Saved row that the US-only gate held off the board — still listed
    // by the employer, just not on draft's board. Lets the card say "outside the US" instead of
    // "no longer listed". Only an inactive row can be held, so only the Saved tab returns true
    // (see `held_outside_us` in server.js's board SELECT).
    heldOutsideUs:       !!j.held_outside_us,
    discoveredAt:        j.discovered_at         ?? null,
    summary:             j.summary               ?? null,
    validThrough:        j.valid_through         ?? null,
    // ⛔ D59 · the Requirements row (citizenship · clearance · status) and the label block's other fields.
    requirements:        requirementsOf(j, fresh),
    postingFields:       postingFieldsOf(fields),
  };
}

export { mapJobRow };
