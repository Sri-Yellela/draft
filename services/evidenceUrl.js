// services/evidenceUrl.js — ⭐ D69 (c) · "I SUBMITTED" KEEPS ONLY THE ID-TYPE QUERY PARAMETERS.
//
// Owner, 10-07 (after the advantages and implications were laid out): keep the parameters that identify
// the application, drop the rest. A portal sometimes identifies the application ONLY in the query
// (?gh_jid=, ?jobId=, ?applicationId=), and that is the evidence worth keeping. The same query also
// carries session and one-time tokens, tracking ids (utm_*, gclid) and sometimes the applicant's email —
// stored indefinitely as "evidence" they would widen what a breach exposes, so they never reach the row.
//
// An allow-list, never a deny-list: a parameter is kept only when its NAME is one of these AND its VALUE
// looks like an id (letters, digits, - and _, at most 64) — never an address, an email or a token-length
// secret. The fragment is always dropped.
export const EVIDENCE_ID_PARAMS = Object.freeze([
  "jobid", "job_id", "gh_jid", "applicationid", "application_id", "appid", "req", "reqid", "req_id",
  "requisitionid", "requisition_id", "jobreqid", "postingid", "posting_id", "jid", "token",
]);
const ID_VALUE = /^[A-Za-z0-9_-]{1,64}$/;

/** The URL to keep as evidence: origin + path + only the id-type parameters. null when unparseable. */
export function evidenceUrlOf(raw) {
  let u; try { u = new URL(String(raw)); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const kept = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    if (!EVIDENCE_ID_PARAMS.includes(k.toLowerCase())) continue;
    if (!ID_VALUE.test(v)) continue;
    // Greenhouse's embed form carries the job id as ?token=<digits>; a token that is not all digits is a secret.
    if (k.toLowerCase() === "token" && !/^\d{4,}$/.test(v)) continue;
    kept.append(k, v);
  }
  const q = kept.toString();
  return `${u.origin}${u.pathname}${q ? `?${q}` : ""}`;
}
