// shared/sourceAttribution.js — ⭐ D185-7 (45q, owner 11-09) · CREDIT WHERE THE ATS DOCUMENTS IT, AND ONLY THE TRUTH.
//
// D185 P3b (adopted, changed): use each ATS's OWN, DOCUMENTED source mechanism on the apply link — the way job boards are
// credited — and answer "How did you hear about us?" with "draft" ONLY when it is true and the person agreed. Never hidden
// text in a field, never anything that misrepresents the candidate.
//
// WHAT EACH ATS DOCUMENTS (read by the agent 11-09, 45q):
//   lever       `?lever-origin=applied&lever-source[]=<Job Board>` — the parameters Lever tells job boards to append to the
//               links they send candidates on (help.lever.co, "Using Lever's XML job posting feed"; "Tracking conversions
//               from custom job sites": the origin / source URL parameters keep working). → appended by default.
//   greenhouse  `gh_src=<token>` — a source token the EMPLOYER creates in Greenhouse (Configure → Job Boards → Tracking
//               Link; support.greenhouse.io "Job board tracking links overview"). An invented value credits nothing, so it
//               is sent only with a token the employer issued to draft (app_settings ats_source_tokens).
//   ashby       `utm_source=<code>` — credited through a Custom Tracking Link the EMPLOYER creates in Ashby (docs.ashbyhq.com
//               "Tracking the source of an application"). Sent only with the employer's code (ats_source_tokens).
//   everything else — no documented mechanism → the link is left exactly as it is.
// An existing parameter is never overwritten (an employer's own tracking link wins).

export const SOURCE_NAME = "draft";

export const DOCUMENTED_SOURCE_PARAMS = Object.freeze({
  lever: { needsEmployerToken: false, doc: "help.lever.co — Using Lever's XML job posting feed (lever-origin / lever-source[])" },
  greenhouse: { needsEmployerToken: true, param: "gh_src", doc: "support.greenhouse.io — Job board tracking links overview (gh_src)" },
  ashby: { needsEmployerToken: true, param: "utm_source", doc: "docs.ashbyhq.com — Tracking the source of an application (custom tracking links)" },
});

/** PURE. Which documented family a URL is, or null. */
export function attributionFamily(url) {
  let u; try { u = new URL(String(url || "")); } catch { return null; }
  const h = u.hostname.toLowerCase();
  if (h === "jobs.lever.co" || h === "jobs.eu.lever.co") return "lever";
  if (/(^|\.)greenhouse\.io$/.test(h) || u.searchParams.has("gh_jid")) return "greenhouse";
  if (h === "jobs.ashbyhq.com") return "ashby";
  return null;
}

/**
 * PURE. The apply link with draft's credit added the way its ATS documents — or the link unchanged.
 * `token` = the employer-issued code for Greenhouse / Ashby (none → nothing is added for them).
 */
export function attributeApplyUrl(url, { token = null } = {}) {
  const fam = attributionFamily(url);
  if (!fam) return url;
  const u = new URL(String(url));
  if (fam === "lever") {
    if (u.searchParams.has("lever-source[]") || u.searchParams.has("lever-source") || u.searchParams.has("lever-origin")) return url;
    u.searchParams.set("lever-origin", "applied");
    u.searchParams.append("lever-source[]", SOURCE_NAME);
    return u.toString();
  }
  const def = DOCUMENTED_SOURCE_PARAMS[fam];
  if (!token || !/^[A-Za-z0-9_.-]{1,80}$/.test(String(token))) return url;
  if (u.searchParams.has(def.param)) return url;
  u.searchParams.set(def.param, String(token));
  return u.toString();
}

/** The employer-issued tokens: app_settings `ats_source_tokens` = { "<company, lower case>": { greenhouse, ashby } }. */
export function tokenFor(tokens, company, family) {
  if (!tokens || !company || !family) return null;
  return tokens[String(company).toLowerCase()]?.[family] ?? null;
}

// ── "How did you hear about us?" ─────────────────────────────────────────────────────────────

/** The phrasings a form uses — matched by the saved-answer rule (normaliseQuestion equality), never by containment. */
export const HOW_HEARD_QUESTIONS = Object.freeze([
  "How did you hear about us?",
  "How did you hear about this job?",
  "How did you hear about this position?",
  "How did you hear about this role?",
  "How did you hear about this opportunity?",
  "How did you find out about this job?",
]);

/** PURE. The answers to add, or none: only when the person agreed AND they found this job on draft. */
export function howHeardAnswers({ agreed = false, foundOnDraft = false } = {}) {
  if (agreed !== true || foundOnDraft !== true) return [];
  return HOW_HEARD_QUESTIONS.map(question => ({ question, answer: SOURCE_NAME, eligibility: false, optIn: false, source: "credit_draft" }));
}
