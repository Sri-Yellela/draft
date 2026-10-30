// ── D104 P1 (owner 10-30) · IS THIS POSTING OPEN TO THIS CANDIDATE? — product logic, not a gate ────
//
// A posting's STATED requirements (shared/postingRequirements.js) against the candidate's OWN Application defaults
// (D101 — only what they set). The answer is one of:
//   eligible     nothing the posting states rules them out
//   ineligible   a stated requirement contradicts what the candidate SET (with the reasons, said plainly)
//   unknown      the posting states a requirement and the candidate has not set the answer it needs
// ⛔ An unset default is NEVER read as an answer: unknown, not eligible and not ineligible — the fill stops at Needs you.
// ⛔ The ATS score is not touched (d104AtsUnchanged): this is a separate line.
// Where it is used: FULL AUTO's scheduler and Approve all never take an ineligible job; the user can still open it and
// apply by hand.

const US = /\b(us|u\.s\.?a?\.?|usa|united states|american)\b/i;
const US_PERSON = /\b(permanent resident|green card|lawful permanent|refugee|asylee|u\.?s\.? national)\b/i;
const LEVEL = { none: 0, confidential: 1, public_trust: 1, secret: 2, top_secret: 3, ts_sci: 4 };
const DEGREE = { bachelors: 1, masters: 2, phd: 3 };

/** The highest degree a list of free-text degrees states, or null. */
export function highestDegree(degrees = []) {
  let best = null;
  for (const d of degrees) {
    const t = String(d || "");
    const k = /\b(ph\.?\s?d|doctor)/i.test(t) ? "phd" : /\b(master|m\.?s\.?c?|mba|m\.?eng|m\.?a\.?)\b/i.test(t) ? "masters"
      : /\b(bachelor|b\.?s\.?c?|b\.?a\.?|b\.?eng|b\.?tech)\b/i.test(t) ? "bachelors" : null;
    if (k && (!best || DEGREE[k] > DEGREE[best])) best = k;
  }
  return best;
}

/**
 * @param req       postingRequirements() output
 * @param defaults  { key: value } — ONLY the defaults the user set (absent = not set)
 * @param degrees   the candidate's degrees as stated in their profile (free text)
 * @returns {{ status: 'eligible'|'ineligible'|'unknown', reasons: string[], missing: string[] }}
 */
export function eligibilityOf(req, defaults = {}, degrees = []) {
  const reasons = [], missing = [];
  if (!req) return { status: "eligible", reasons, missing };
  const cit = defaults.citizenship ?? null;
  if (req.citizenship === "citizen_only") {
    if (cit == null) missing.push("citizenship");
    else if (!US.test(cit) || US_PERSON.test(cit)) reasons.push("U.S. citizens only");
  } else if (req.citizenship === "us_person") {
    if (cit == null) missing.push("citizenship");
    else if (!US.test(cit) && !US_PERSON.test(cit)) reasons.push("U.S. persons only");
  }
  if (req.clearance && req.clearance !== "none") {
    const have = defaults.clearance ?? null;
    if (have == null) missing.push("clearance");
    else if (have === "can_obtain") {
      if (req.clearanceStatus === "active_required") reasons.push("an active clearance is required");
    } else if (req.clearance !== "unspecified" && (LEVEL[have] ?? 0) < (LEVEL[req.clearance] ?? 0)) {
      reasons.push(`${req.clearance.replace("_", " ")} clearance required`);
    } else if (req.clearance === "unspecified" && have === "none") {
      reasons.push("a clearance is required");
    }
  }
  if (req.sponsorship === "no_sponsorship") {
    const now = defaults.sponsorship_now ?? null, later = defaults.sponsorship_later ?? null;
    if (now === "yes" || later === "yes") reasons.push("no visa sponsorship");
    else if (now == null) missing.push("sponsorship");
  }
  if (req.degree) {
    const best = highestDegree(degrees);
    if (!best) missing.push("degree");
    else if (DEGREE[best] < DEGREE[req.degree]) reasons.push({ bachelors: "a bachelor's degree is required", masters: "a master's degree or higher is required", phd: "a PhD is required" }[req.degree]);
  }
  return { status: reasons.length ? "ineligible" : missing.length ? "unknown" : "eligible", reasons, missing };
}
