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
// R19749-1 is the same job as R19749 — the agent's recommendation, taken under "complete all tasks", is yes
// (Workday's own reposting of a requisition), reported in the WORKLOG for the owner to overrule.
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
    canonicalUrl: `https://${u.hostname.toLowerCase()}${canonicalPath}`,
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
