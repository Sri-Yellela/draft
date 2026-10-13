// ── D56 · A PACKET BELONGS TO A JOB, AND A JOB HAS MORE THAN ONE ADDRESS ──────────────────────────────
//
// ⛔ THE DEFECT (owner, 10-07, an Amazon application page in Boston): "Nothing is prepared for
// https://account.amazon.jobs. Open the application from your Draft queue." Amazon's POSTING lives on
// www.amazon.jobs and its APPLICATION on account.amazon.jobs — two origins. A packet was keyed to ONE
// origin (apply_gate_packets.expected_origin, from whichever URL the run had), and the extension
// matched on that origin alone, so a packet keyed to the posting could never match the application
// page — even for a job that was in the queue.
//
// THE RULE. A packet's ORIGINS are its expected origin PLUS the known apply origins of the ATS adapter
// that origin belongs to — the table below, in code. ⛔ NEVER FROM THE USER: a packet holds a home
// address and work-authorisation answers, and the list is the only thing that says where they may be
// released. Nothing in a request, a capture or a stored posting URL can add an origin to it: a posting
// URL contributes ONLY when its origin is itself in a family, and then it contributes that family —
// which is to say, the table.
//
// AND THE JOB ID, where the URL carries one. Two Amazon applications share all three origins; the id
// in the path (/jobs/2912345/) is what tells them apart. A page whose URL names a DIFFERENT job than
// the packet's is not that packet's page, whatever its origin. A page that names no job (a wizard step
// with no id in the path) is matched on the origin list alone, as before.
//
// ⛔ ONE PARSER. The extension does not parse ATS URLs (test/d23ExtensionLook.test.js holds it to that);
// it sends the tab's URL to the server, which answers with the packets this page may fill — and the
// extension then re-checks only the ORIGIN against each packet's list, as defence in depth.

/**
 * Families of origins that serve ONE ATS's postings and applications. Adding a row widens where a
 * packet may be filled, so each row states the redirect it was taken from.
 *   origins       every origin the ATS serves a posting or an application form on
 *   jobIdPattern  the job id in the PATH, first capture group
 *   jobIdParam    or in the query (Greenhouse's embed form: ?token=<id>)
 */
import { pageKeyOf } from "./jobPageKey.js";

export const APPLY_ORIGIN_FAMILIES = Object.freeze([
  Object.freeze({
    // www.amazon.jobs/en/jobs/<id>/<slug> → "Apply now" → www.amazon.jobs/applicant/jobs/<id>/apply,
    // which redirects to account.amazon.jobs/<locale>/applicant/jobs/<id>/apply after sign-in.
    ats: "amazon",
    origins: Object.freeze(["https://www.amazon.jobs", "https://amazon.jobs", "https://account.amazon.jobs"]),
    jobIdPattern: /\/jobs\/(\d{5,})(?=\/|$)/,
  }),
  Object.freeze({
    // Greenhouse moved hosted boards from boards.greenhouse.io to job-boards.greenhouse.io and
    // redirects the old addresses, so a posting captured on one is applied to on the other.
    ats: "greenhouse",
    origins: Object.freeze(["https://boards.greenhouse.io", "https://job-boards.greenhouse.io"]),
    jobIdPattern: /\/jobs\/(\d{4,})(?=\/|$)/,
    jobIdParam: "token",
    // ✅ D67 (1) re-observed 10-07: boards.greenhouse.io/anthropic/jobs/5382518008 → 301 → job-boards.greenhouse.io/…,
    // and the form posts back to that page (action="/anthropic/jobs/5382518008").
  }),
  // ── D67 (1) · THE MANUAL SWEEP, 10-07 — every ATS the board links to (greenhouse · ashby · lever · workable ·
  // recruitee: 2,616 local postings, no other source). Observed by fetching real postings unauthenticated and
  // following each Apply control. ⭐ No new CROSS-origin pair exists among them: Lever, Ashby and Workable
  // apply on the posting's own origin. But each serves EVERY employer on ONE shared origin — the shape the
  // owner flagged for Workday — so their rows exist for the JOB ID: on jobs.lever.co a page naming another
  // job's id is refused even though the origin matches. They TIGHTEN matching; they widen nothing.
  // Recruitee runs on each employer's own domain (jobs.channable.com/o/<slug>/c/new) — no shared host, no row.
  Object.freeze({
    // jobs.lever.co/matchgroup/d28a3de6-cd04-483a-9aed-5ba1d2f8c57c → "Apply" → …/d28a3de6-…/apply (same origin).
    ats: "lever",
    origins: Object.freeze(["https://jobs.lever.co"]),
    jobIdPattern: /^\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/i,
  }),
  Object.freeze({
    // jobs.ashbyhq.com/ramp/d2beca4a-7409-404b-8382-761e5db6e917 → …/application (same origin).
    ats: "ashby",
    origins: Object.freeze(["https://jobs.ashbyhq.com"]),
    jobIdPattern: /^\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?=\/|$)/i,
  }),
  Object.freeze({
    // apply.workable.com/j/B0D0ACB369 → 301 → apply.workable.com/blueground/j/B0D0ACB369 → …/apply (same origin).
    ats: "workable",
    origins: Object.freeze(["https://apply.workable.com"]),
    jobIdPattern: /\/j\/([A-Z0-9]{8,12})(?=\/|$)/,
  }),
]);

/** Origin of a URL (http/https only), or null. Never throws. */
export function originOf(url) {
  try {
    const u = new URL(String(url));
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch { return null; }
}

/** The family an origin belongs to, or null. */
export function familyOf(origin, families = APPLY_ORIGIN_FAMILIES) {
  if (!origin) return null;
  return families.find(f => f.origins.includes(origin)) || null;
}

/**
 * Every origin a packet may be filled on: its expected origin, plus the family of every URL the job
 * is known by — but only through the table. Expected origin first; never empty when it is given.
 * @param {{ expectedOrigin: string, urls?: string[] }} p   urls: the packet's apply URL and the
 *        posting's url / apply_url, as stored
 */
export function packetOrigins({ expectedOrigin, urls = [] } = {}, families = APPLY_ORIGIN_FAMILIES) {
  const out = [];
  const add = (o) => { if (o && !out.includes(o)) out.push(o); };
  add(expectedOrigin);
  for (const o of [expectedOrigin, ...urls.map(originOf)]) {
    const fam = familyOf(o, families);
    if (fam) fam.origins.forEach(add);
  }
  return out;
}

/** The job id a URL carries, read by its family's rule — or null (no family, or no id in it). */
export function jobIdOf(url, families = APPLY_ORIGIN_FAMILIES) {
  let u; try { u = new URL(String(url)); } catch { return null; }
  const fam = familyOf(u.origin, families);
  if (!fam) return null;
  const m = fam.jobIdPattern ? u.pathname.match(fam.jobIdPattern) : null;
  if (m?.[1]) return m[1];
  const q = fam.jobIdParam ? u.searchParams.get(fam.jobIdParam) : null;
  return q && /^\d+$/.test(q) ? q : null;
}

/** The job ids a packet's job is known by, across every URL it has. */
export function packetJobIds(urls = [], families = APPLY_ORIGIN_FAMILIES) {
  return [...new Set(urls.map(u => jobIdOf(u, families)).filter(Boolean))];
}

/**
 * May this page receive this packet? Origin in the list, AND — when both the page's URL and the
 * packet's job carry an id — the same id.
 * @returns {{ ok: boolean, reason: "match"|"origin_not_listed"|"other_job"|"unreadable_url" }}
 */
export function pageMatchesPacket({ url, origins = [], jobIds = [], pageKeys = [] }, families = APPLY_ORIGIN_FAMILIES) {
  const origin = originOf(url);
  if (!origin) return { ok: false, reason: "unreadable_url" };
  if (!origins.includes(origin)) return { ok: false, reason: "origin_not_listed" };
  const pageId = jobIdOf(url, families);
  if (pageId && jobIds.length && !jobIds.includes(pageId)) return { ok: false, reason: "other_job" };
  // ⭐ A page that names its requisition (a Workday tenant: services/jobPageKey.js) must name THIS one — another
  // job on the same employer's tenant never receives this packet. A stage with no requisition (sign-in) falls back
  // to the origin, which is the employer's own tenant and reached only through the user's own capture.
  const pageKey = pageKeyOf(url)?.key;
  if (pageKey && pageKeys.length && !pageKeys.includes(pageKey)) return { ok: false, reason: "other_job" };
  return { ok: true, reason: "match" };
}

/** "www.amazon.jobs and account.amazon.jobs" — the hosts, for a sentence. */
export function hostsSentence(origins = []) {
  const hosts = [...new Set(origins.map(o => { try { return new URL(o).host; } catch { return o; } }))];
  if (hosts.length <= 1) return hosts[0] || "";
  return `${hosts.slice(0, -1).join(", ")} and ${hosts[hosts.length - 1]}`;
}
