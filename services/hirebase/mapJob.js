// services/hirebase/mapJob.js — ⭐ HB-4 (D187 HB-INFRA). A Hirebase job → what draft's pipeline already takes. PURE.
//
//   mapHirebaseJob(job) → { input, extras, raw } | null
//     input   normalizeJob()'s argument — the SAME contract every crawler plugin returns (services/jobs/schema.js), so a
//             Hirebase posting enters the one existing pipeline (HB-6) rather than a second one.
//     extras  what only Hirebase gives (source_id = _id, platform_job_id, first_ingested, md5_hash, team, technologies,
//             benefits, the company record's facts) and its HINTS (experience, categories, visa) — hints, never answers:
//             draft's own classifier, level and sponsorship read decide (D187 H1 (3)).
//     raw     the payload as it may be STORED (hirebase_raw): contact_email / contact_phone (Contact Data, §5 of their
//             terms) and the opaque *_score ratings are DROPPED here, before anything is written.
// Facts: docs/research/hirebase-api.md.
import { normalizeJob } from "../jobs/schema.js";
import { htmlToText, fullDescriptionText, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from "../jobs/htmlToText.js";

export const HIREBASE_SOURCE = "hirebase";
const s = (v) => (v == null ? "" : String(v).trim());
const arr = (v) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);
const num = (v) => { const n = Number(v); return v == null || v === "" || !Number.isFinite(n) ? null : n; };

/** Stored payload: everything except the person-level contact fields and the opaque scores. */
export function sanitizeHirebaseJob(job) {
  if (!job || typeof job !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(job)) {
    if (k === "contact_email" || k === "contact_phone" || /_score$/.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Hirebase's salary period → draft's ('annual' | 'hourly' | 'monthly' | null). Daily is annualised by nothing — null. */
export function salaryPeriodOf(period) {
  const p = s(period).toLowerCase();
  if (p === "yearly" || p === "year" || p === "annual" || p === "annually") return "annual";
  if (p === "hourly" || p === "hour") return "hourly";
  if (p === "monthly" || p === "month") return "monthly";
  return null;
}

/** Every location, as draft's location text ("City, Region" / "Region, Country" / …), the first first. */
export function locationsOf(job) {
  const list = (Array.isArray(job?.locations) ? job.locations : []).map(l => {
    const city = s(l?.city), region = s(l?.region), country = s(l?.country);
    return [city, region].filter(Boolean).join(", ") || [region, country].filter(Boolean).join(", ") || country || s(l?.address);
  }).filter(Boolean);
  return [...new Set(list)];
}

const WORKPLACE = { remote: "remote", hybrid: "hybrid", "in-person": "onsite", onsite: "onsite", "on-site": "onsite", "in person": "onsite" };
const CONTRACT = { "full time": "full_time", "part time": "part_time", "contract / temporary": "contract", contract: "contract", internship: "internship" };

export function mapHirebaseJob(job) {
  if (!job || typeof job !== "object") return null;
  const id = s(job._id), title = s(job.job_title || job.job_title_raw), company = s(job.company_name), url = s(job.application_link);
  if (!id || !title || !company || !url) return null;   // normalizeJob's required fields — an incomplete listing is not landed
  const html = job.description_raw ?? job.description ?? "";
  const description = htmlToText(html, { maxLength: JOB_DESCRIPTION_MAX_LENGTH, tailLength: JOB_DESCRIPTION_TAIL_LENGTH });
  const sal = job.salary_range && typeof job.salary_range === "object" ? job.salary_range : null;
  const workplace = WORKPLACE[s(job.location_type).toLowerCase()] || null;
  const locations = locationsOf(job);
  const location = workplace === "remote" && !locations.length ? "Remote" : (locations[0] || s(job.location_raw) || null);
  const input = {
    id, req_id: s(job.platform_job_id) || null, title, company, url, source: HIREBASE_SOURCE,
    location,
    description,
    description_full: fullDescriptionText(null, html),
    posted_at: s(job.date_posted) || null,
    contract_type: CONTRACT[s(job.job_type).toLowerCase()] || null,
    remote: workplace === "remote",
    thumbnail: s(job.company_logo) || null,
    workplace_type: workplace,
    salary_min: num(sal?.min), salary_max: num(sal?.max), salary_currency: s(sal?.currency) || null,
    salary_period: salaryPeriodOf(sal?.period),
    skills: [...new Set([...arr(job.skills), ...arr(job.technologies)])],
    _raw: sanitizeHirebaseJob(job),
  };
  const cd = job.company_data && typeof job.company_data === "object" ? job.company_data : null;
  const extras = {
    source_id: id,
    platform_job_id: s(job.platform_job_id) || null,
    job_board: s(job.job_board).toLowerCase() || null,
    first_ingested: s(job.first_ingested) || null,
    md5_hash: s(job.md5_hash) || null,
    locations,
    location_raw: s(job.location_raw) || null,
    team: s(job.team) || null,
    technologies: arr(job.technologies),
    benefits: arr(job.benefits),
    yoe: job.yoe_range && typeof job.yoe_range === "object" ? { min: num(job.yoe_range.min), max: num(job.yoe_range.max) } : null,
    hints: {
      experience_level: s(job.experience_level) || null,
      education_level: s(job.education_level) || null,
      job_categories: arr(job.job_categories),
      visa_sponsored: typeof job.visa_sponsored === "boolean" ? job.visa_sponsored : null,
      recruiter_agency: typeof job.recruiter_agency === "boolean" ? job.recruiter_agency : null,
    },
    company: {
      name: company, slug: s(job.company_slug) || null, domain: s(job.company_link).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase() || null,
      logo: s(job.company_logo) || null,
      linkedin: s(cd?.linkedin_link) || null, summary: s(cd?.description_summary) || null,
      sizeRange: cd?.size_range && typeof cd.size_range === "object" ? { min: num(cd.size_range.min), max: num(cd.size_range.max) } : null,
      industries: arr(cd?.industries), subindustries: arr(cd?.subindustries), type: s(cd?.type) || null,
      isAgency: !!(cd?.is_recruiting_agency || cd?.is_3rd_party_agency),
    },
  };
  return { input, extras, raw: sanitizeHirebaseJob(job) };
}

/** mapHirebaseJob, then normalizeJob — the posting row draft's ingestion stores. Throws only on normalizeJob's own refusals. */
export function normalizeHirebaseJob(job) {
  const m = mapHirebaseJob(job);
  return m ? { posting: normalizeJob(m.input), extras: m.extras, raw: m.raw } : null;
}
