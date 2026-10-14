// services/jobPageKey.js — ONE JOB, ONE KEY, WHICHEVER STAGE OF ITS APPLICATION THE PAGE IS ON.
//
// Owner, 10-12 (the extension on Zoom's Workday posting): the posting, /apply, /apply/applyManually,
// /apply/useMyLastApplication and the sign-in pages are one job, and draft treated them as five unknown pages.
// The extension never parses an ATS URL (shared/applyOrigins.js: one parser, the server's); this is that parser
// for Workday, the ATS the adapter table deliberately has no origin row for (docs/D67C_WORKDAY_FAMILY.md).
//
//   https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote--(US)/Software-Engineer_R19749-1/apply/applyManually?source=linkedin
//     tenant zoom · dc wd5 · locale en-US · site Zoom · location "Remote (US)" · title "Software Engineer"
//     requisition R19749 (rev 1) · stage applyManually · tracking dropped
//     key       workday|zoom|zoom|R19749
//     canonical https://zoom.wd5.myworkdayjobs.com/Zoom/job/Remote--(US)/Software-Engineer_R19749-1
//
// ⭐ A repost suffix (-1, -2) is kept as `rev` and is NOT part of the key: the owner's question was whether
// R19749-1 is the same job as R19749 — DECIDED by the owner, 10-13: "R19749-1 is the same job, keep it" (Workday's
// own reposting of a requisition). A -2 is the same job too.
// A page with no requisition (login, create account) has no key — the extension's tab binding names its job.
// The parsers are pure (no database, no network); recordPageKey / jobForPageKey below are the key table's two doors.

const WORKDAY_HOST = /^([a-z0-9][a-z0-9-]*)\.(wd\d{1,3})\.(myworkdayjobs|myworkdaysite)\.com$/i;
const LOCALE = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/;
const STAGES = Object.freeze(["apply", "applyManually", "useMyLastApplication", "autofillWithResume", "applyWithLinkedIn"]);
// The requisition is the title slug's last "_" part: R19749-1, JR0000001, REQ_2024-118 → its last _ part.
const REQ = /^([A-Za-z]{0,6}-?\d{2,})(?:-(\d{1,2}))?$/;

const tidySlug = (s) => {
  let t = String(s || "");
  try { t = decodeURIComponent(t); } catch { /* keep it */ }
  return t.replace(/--/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
};

/**
 * @param {string} url
 * @returns {null | { ats: 'workday', key: string, rev: number|null, canonicalUrl: string, tenant: string, dc: string,
 *   site: string, requisition: string, stage: string|null, locale: string|null, title: string|null, location: string|null }}
 */
export function workdayKeyOf(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().match(WORKDAY_HOST);
  if (!host) return null;
  const [, tenant, dc] = host;
  let parts = u.pathname.split("/").filter(Boolean);
  let locale = null;
  if (parts[0] && LOCALE.test(parts[0]) && parts[1] && parts[1] !== "job") { locale = parts[0]; parts = parts.slice(1); }
  const site = parts[0];
  const at = parts.indexOf("job");
  if (!site || at !== 1 || parts.length < at + 2) return null;
  // /<site>/job/<location>/<title_REQ>[/apply[/<stage>]]  or  /<site>/job/<title_REQ>[/…] (no location segment)
  let rest = parts.slice(at + 1);
  let stage = null;
  const ai = rest.indexOf("apply");
  if (ai !== -1) { stage = rest[ai + 1] && STAGES.includes(rest[ai + 1]) ? rest[ai + 1] : "apply"; rest = rest.slice(0, ai); }
  const titleSeg = rest[rest.length - 1];
  const locationSeg = rest.length >= 2 ? rest[rest.length - 2] : null;
  if (!titleSeg || !titleSeg.includes("_")) return null;
  const reqRaw = titleSeg.slice(titleSeg.lastIndexOf("_") + 1);
  const m = reqRaw.match(REQ);
  if (!m) return null;
  const requisition = m[1].toUpperCase();
  const rev = m[2] != null ? Number(m[2]) : null;
  // one spelling: "Remote--%28US%29" and "Remote--(US)" are the same segment
  const seg = (s) => { try { return encodeURI(decodeURIComponent(s)); } catch { return s; } };
  const canonicalPath = ["", site, "job", ...(locationSeg ? [seg(locationSeg)] : []), seg(titleSeg)].join("/");
  return {
    ats: "workday", key: `workday|${tenant.toLowerCase()}|${site.toLowerCase()}|${requisition}`, rev,
    // the page's own scheme (Workday serves https; a scheme of our own would be an address the page is not on)
    canonicalUrl: `${u.protocol}//${u.hostname.toLowerCase()}${canonicalPath}`,
    tenant: tenant.toLowerCase(), dc: dc.toLowerCase(), site, requisition, stage, locale,
    title: tidySlug(titleSeg.slice(0, titleSeg.lastIndexOf("_"))) || null,
    location: locationSeg ? tidySlug(locationSeg) : null,
  };
}

/** Is this a page on a Workday tenant at all (any stage, keyed or not)? */
export function workdayTenantOf(url) {
  try { const h = new URL(url).hostname.toLowerCase().match(WORKDAY_HOST); return h ? `${h[1]}.${h[2]}` : null; } catch { return null; }
}

/** The page's key, when its ATS gives one. Workday today; the families in applyOrigins keep their own rule. */
export function pageKeyOf(url) {
  return workdayKeyOf(url);
}

/**
 * ⭐ A capture records which job its page's key folded into, so the posting and every later stage of its
 * application resolve to the same job (job_page_keys, migration 161). The one write in this file; upsert — the
 * newest capture's fold is the answer (a key is one requisition, so it rarely moves).
 */
export function recordPageKey(db, url, jobId) {
  const pk = pageKeyOf(url);
  if (!pk || !jobId) return null;
  try {
    db.prepare(`INSERT INTO job_page_keys (page_key, job_id, rev, canonical_url) VALUES (?, ?, ?, ?)
      ON CONFLICT(page_key) DO UPDATE SET job_id = excluded.job_id, rev = excluded.rev, canonical_url = excluded.canonical_url,
      updated_at = unixepoch()`).run(pk.key, String(jobId), pk.rev, pk.canonicalUrl);
  } catch { return null; }   // a database without migration 161
  return pk;
}

/** The job a key was captured into, or null. */
export function jobForPageKey(db, key) {
  if (!key) return null;
  try { return db.prepare("SELECT job_id FROM job_page_keys WHERE page_key = ?").pluck().get(key) ?? null; } catch { return null; }
}

const alnum = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * ⭐ (company, title) — owner, 10-13: the job was found on LinkedIn (…/jobs/search-results/?currentJobId=4478302778) and
 * applied to on Workday. A capture on LinkedIn stores the job under LinkedIn's address, which shares neither address
 * nor key with the Workday page — so the Workday page asks "which job is this?" and the answer is the job THIS USER
 * captured whose title is the page's title slug and whose company is the tenant. ⛔ Only the user's OWN captures
 * (last 60 days), and only when exactly ONE matches — two candidates is a question, not an answer. Never another
 * user's jobs, never the shared pool. Returns the job id or null.
 */
export function ownJobByTitleCompany(db, userId, pk) {
  if (userId == null || !pk?.title || !pk?.tenant) return null;
  let rows = [];
  try {
    rows = db.prepare(`SELECT DISTINCT COALESCE(sj.duplicate_of, sj.job_id) AS job_id, sj.title, sj.company
      FROM job_captures c JOIN scraped_jobs sj ON sj.job_id = c.job_id
      WHERE c.user_id = ? AND c.created_at > unixepoch() - 60 * 86400 AND (c.action IS NULL OR c.action NOT LIKE 'refused%')`).all(userId);
  } catch { return null; }
  const title = alnum(pk.title);
  const tenant = alnum(pk.tenant).replace(/ /g, "");
  const same = rows.filter(r => {
    if (alnum(r.title) !== title) return false;
    const co = alnum(r.company);
    return co.replace(/ /g, "") === tenant || co.split(" ")[0] === tenant;
  });
  const ids = [...new Set(same.map(r => String(r.job_id)))];
  return ids.length === 1 ? ids[0] : null;
}

// ── ⭐ T2 (field report 10-14) · THE ATS'S OWN JOB ID — ONE KEY FOR EVERY FAMILY THE BOARD HOLDS ─────────────────────────
//
// The owner opened Stripe's Backend posting from the board. The page was
// stripe.com/careers/listing/software-engineer-backend/8198280?gh_jid=8198280; Greenhouse's absolute_url for job 8198280
// (what the feed stores) is stripe.com/jobs/search?gh_jid=8198280. Same job, two paths — so the popup's URL lookup said
// "Not on your board yet" while the capture, reading the page's text, found it. The board's own id for a feed job is
// `${source}::${the ATS's id}` (services/jobs/schema.js normalizeJob), and the ATS's id is in the address:
//
//   greenhouse       boards.greenhouse.io/<co>/jobs/<id> · job-boards.greenhouse.io/<co>/jobs/<id> · …/embed/job_app?token=<id>
//                    · ⭐ ANY host with ?gh_jid=<id> — an employer's careers page embedding the Greenhouse board (Stripe)
//   lever            jobs.lever.co/<co>/<uuid>[/apply]
//   ashby            jobs.ashbyhq.com/<co>/<uuid>[/application] · ANY host with ?ashby_jid=<uuid> (the embed)
//   workable         apply.workable.com/[<co>/]j/<SHORTCODE>[/apply]
//   smartrecruiters  jobs.smartrecruiters.com/<Co>/<id>-<slug>
//
// `embedded` is true when the id came from a query parameter on a host that is NOT the ATS's — the caller must then
// confirm the job belongs to that site (services/manualHandoff.js resolvePageJob), because any page can carry the
// parameter. Pure: no database, no network. ⛔ This is IDENTITY only — it never widens where answers may be filled
// (that list is services/applyOrigins.js, and it is not read from here).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GH_HOSTS = new Set(["boards.greenhouse.io", "job-boards.greenhouse.io"]);

/** @returns {null | { ats: string, externalId: string, jobId: string, embedded: boolean }} */
export function atsJobKeyOf(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const key = (ats, externalId, embedded = false) => ({ ats, externalId, jobId: `${ats}::${externalId}`, embedded });
  const digits = (v) => (typeof v === "string" && /^\d{4,20}$/.test(v) ? v : null);

  if (GH_HOSTS.has(host)) {
    const at = parts.indexOf("jobs");
    const id = (at >= 1 && digits(parts[at + 1])) || digits(u.searchParams.get("token")) || digits(u.searchParams.get("gh_jid"));
    return id ? key("greenhouse", id) : null;
  }
  if (host === "jobs.lever.co") return parts[1] && UUID.test(parts[1]) ? key("lever", parts[1].toLowerCase()) : null;
  if (host === "jobs.ashbyhq.com") return parts[1] && UUID.test(parts[1]) ? key("ashby", parts[1].toLowerCase()) : null;
  if (host === "apply.workable.com") {
    const at = parts.indexOf("j");
    const code = at !== -1 ? parts[at + 1] : null;
    return code && /^[A-Z0-9]{6,12}$/.test(code) ? key("workable", code) : null;
  }
  if (host === "jobs.smartrecruiters.com") {
    const m = parts[1] ? parts[1].match(/^(\d{6,20})(?:-|$)/) : null;
    return m ? key("smartrecruiters", m[1]) : null;
  }
  const gh = digits(u.searchParams.get("gh_jid"));
  if (gh) return key("greenhouse", gh, true);
  const ash = u.searchParams.get("ashby_jid");
  if (ash && UUID.test(ash)) return key("ashby", ash.toLowerCase(), true);
  return null;
}

/** The site a host belongs to, for the embedded check — its last two labels (careers.stripe.com → stripe.com). */
export function siteOf(urlOrHost) {
  let h = String(urlOrHost || "");
  try { if (/^https?:\/\//i.test(h)) h = new URL(h).hostname; } catch { return null; }
  const labels = h.toLowerCase().split(".").filter(Boolean);
  return labels.length >= 2 ? labels.slice(-2).join(".") : null;
}

/**
 * The board job this address names by its ATS's id — the job id, or null. One rule for the popup's lookup
 * (resolvePageJob) and the capture (importJob), so the two can never disagree about the same page again.
 * ⛔ An `embedded` id (a query parameter on the employer's own host) is accepted only for a job of THAT site: its
 * stored url / apply_url is on the same site, or its company is the site's name.
 */
export function jobIdForAtsKey(db, url) {
  const ak = atsJobKeyOf(url);
  if (!ak) return null;
  let row;
  try { row = db.prepare("SELECT job_id, company, url, apply_url FROM scraped_jobs WHERE job_id = ?").get(ak.jobId); } catch { return null; }
  if (!row) return null;
  if (!ak.embedded) return String(row.job_id);
  const site = siteOf(url);
  if (!site) return null;
  const sameSite = [row.url, row.apply_url].some(u => u && siteOf(u) === site);
  const named = alnum(row.company).replace(/ /g, "") === site.split(".")[0];
  return sameSite || named ? String(row.job_id) : null;
}
