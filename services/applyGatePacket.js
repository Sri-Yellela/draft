/**
 * Gated-portal handoff — the prepared packet and its single-use token (TASK G1).
 * ---------------------------------------------------------------------------------------------
 * When a run reaches a portal that demands an account or a CAPTCHA, the server cannot finish the
 * application and must not pretend otherwise. Everything already decided is parked in a packet, and
 * the extension exchanges a short-lived token for it once the human has crossed the gate themselves.
 * See docs/GATED_HANDOFF_ARCHITECTURE.md §3 and §9.
 *
 * WHY A CANONICAL FIELD SET EXISTS HERE
 * buildAnswers() in applyAutomation.js is FIELD-DRIVEN: provenance describes how a value was matched
 * to a control that discovery actually found. That is the right design for a reachable form and it is
 * useless behind a login wall, where discovery finds nothing — so a gated run would produce a packet
 * of zero answers with zero provenance, which is the same mistake §7 warns about for empty schemas:
 * an asset that caches the absence of information.
 *
 * So a gated packet resolves the SAME buildAnswers() against a canonical set of questions portals ask
 * — the ones the profile can answer without having seen the form. Provenance stays real and per-field:
 * it reports whether each value came from a handler map, the field map, the user's own custom answer,
 * or nothing at all. There is no second resolver, and no invented confidence.
 *
 * When the gate appears on a page where fields WERE discovered (a form and a sign-in prompt on the
 * same page, which Workday does), the real resolved answers are strictly better evidence and are used
 * instead. G4's captured schemas replace the canonical set with the host's actual form, and this same
 * path then produces a pre-mapped packet with no change here.
 *
 * UNMAPPED IS A RESULT, NOT A GAP. A canonical question the profile cannot answer is recorded with
 * provenance null and listed in `unresolved`. That is advance notice that the human will have to
 * answer it, which is worth more before they open the portal than after.
 */

import crypto from "node:crypto";
import {
  buildAnswers, CONFIDENCE_BY_PROVENANCE, ELIGIBILITY_HANDLERS, PROFILE_KEY_TO_HANDLER, eligibilityClassOf,
} from "./applyAutomation.js";
import { isOptInQuestion, workedHereAnswer, COMPANY_TOKEN, isEeoDecline } from "../shared/savedAnswers.js";
import { skillsOfStructured, PARSE_FAILED_MESSAGE } from "./payloadResume.js";
import { packetLifecycleAnswers } from "./answerLifecycle.js";

/** handler_map's EEO keys (buildAutofillPayload) — what an eeoDeclines entry may name. */
export const EEO_DECLINE_HANDLERS = Object.freeze(["gender", "ethnicity", "veteran", "disability"]);

// ── Canonical questions ──────────────────────────────────────────────────────────────────────
// Shaped exactly like discoverFields() output, because buildAnswers() consumes that shape and this
// must not become a second dialect of it. handler_type is what carries the resolution signal, so
// these are the handler types the profile is able to answer; `label` is present because
// buildAnswers' custom_answers path matches on label text.
//
// Deliberately NOT exhaustive of what portals ask. It is the set the server can answer from the
// profile alone; anything else is the human's to answer, and saying so in advance is the point.
// handler_type values are taken from PROFILE_KEY_TO_HANDLER, not invented. They have to be the exact
// strings buildAnswers looks up ('address1' not 'address-line-1', 'zip' not 'postal-code',
// 'work-auth' not 'work-authorization', 'sponsorship' not 'requires-sponsorship'); a near-miss
// resolves nothing and the packet would silently come back empty with every field "unresolved".
export const CANONICAL_GATE_FIELDS = Object.freeze([
  { field_id: "g_first_name",    name: "first_name",     label: "First Name",        type: "text",  handler_type: "first-name",      is_required: true  },
  { field_id: "g_last_name",     name: "last_name",      label: "Last Name",         type: "text",  handler_type: "last-name",       is_required: true  },
  { field_id: "g_full_name",     name: "full_name",      label: "Full name",         type: "text",  handler_type: "full-name",       is_required: false },
  { field_id: "g_email",         name: "email",          label: "Email",             type: "email", handler_type: "email",           is_required: true  },
  { field_id: "g_phone",         name: "phone",          label: "Phone",             type: "tel",   handler_type: "phone",           is_required: false },
  { field_id: "g_address1",      name: "address1",       label: "Address",           type: "text",  handler_type: "address1",        is_required: false },
  { field_id: "g_city",          name: "city",           label: "City",              type: "text",  handler_type: "city",            is_required: false },
  { field_id: "g_state",         name: "state",          label: "State",             type: "text",  handler_type: "state",           is_required: false },
  { field_id: "g_zip",           name: "zip",            label: "Postal Code",       type: "text",  handler_type: "zip",             is_required: false },
  { field_id: "g_country",       name: "country",        label: "Country",           type: "text",  handler_type: "country",         is_required: false },
  { field_id: "g_linkedin",      name: "linkedin",       label: "LinkedIn Profile",  type: "url",   handler_type: "linkedin",        is_required: false },
  { field_id: "g_website",       name: "website",        label: "Website",           type: "url",   handler_type: "website",         is_required: false },
  { field_id: "g_current_co",    name: "current_company",label: "Current company",   type: "text",  handler_type: "current-company", is_required: false },
  { field_id: "g_current_title", name: "current_title",  label: "Current title",     type: "text",  handler_type: "current-title",   is_required: false },
  // ⭐ T18 / T23 (owner 10-15: "12 fields prepared" against a 43-field Greenhouse form). The rest of what a standard
  // form asks that the PROFILE states — each handler type is one PROFILE_KEY_TO_HANDLER already produces. The extension
  // places them by the field vocabulary (extension/fieldSemantics.js: "Location (City)" is `city`, "School" is `school`).
  { field_id: "g_location",      name: "location",       label: "Location",          type: "text",  handler_type: "location",        is_required: false },
  { field_id: "g_github",        name: "github",         label: "GitHub",            type: "url",   handler_type: "github",          is_required: false },
  { field_id: "g_portfolio",     name: "portfolio",      label: "Portfolio",         type: "url",   handler_type: "portfolio",       is_required: false },
  { field_id: "g_school",        name: "school",         label: "School",            type: "text",  handler_type: "school",          is_required: false },
  { field_id: "g_degree",        name: "degree",         label: "Degree",            type: "text",  handler_type: "degree",          is_required: false },
  { field_id: "g_discipline",    name: "discipline",     label: "Discipline",        type: "text",  handler_type: "field-of-study",  is_required: false },
  { field_id: "g_grad_year",     name: "graduation_year",label: "Graduation year",   type: "text",  handler_type: "grad-year",       is_required: false },
  // Eligibility. Attestations to an employer, which is why G3 pins them to the top of the review
  // overlay regardless of confidence — see §6. The labels are the real question wording rather than
  // a short name, because buildAnswers' eligibility guards read the LABEL to decide the question's
  // sense; a bare "Sponsorship" would be exactly the unreadable direction they refuse.
  { field_id: "g_work_auth",   name: "work_authorization",   type: "select", handler_type: "work-auth",    is_required: true,
    label: "Are you legally authorized to work in the country of employment?" },
  { field_id: "g_sponsorship", name: "requires_sponsorship", type: "select", handler_type: "sponsorship",  is_required: true,
    label: "Do you now or in the future require sponsorship for work authorization?" },
]);

/**
 * Eligibility markers, derived from the codebase's own vocabulary rather than restated. G3 sorts on
 * this and §6 requires these surface first, so a hand-written list that drifted out of sync would
 * silently demote an attestation to an ordinary field.
 *
 * BOTH handler types and profile keys are included, because `matched_on` is whichever one actually
 * resolved the answer: buildAnswers step 1 records the handler type, step 2 records the profile key.
 * Checking only handler types would miss every eligibility answer that resolved through the field
 * map — which, per HANDLER_TO_PROFILE_KEYS' own comment, is the path canonical keys take.
 */
export const ELIGIBILITY_MARKERS = Object.freeze(new Set([
  ...Object.values(ELIGIBILITY_HANDLERS).flat(),
  ...Object.entries(PROFILE_KEY_TO_HANDLER)
    .filter(([, handler]) => Object.values(ELIGIBILITY_HANDLERS).flat().includes(handler))
    .map(([key]) => key),
]));

/** True when an answer is an attestation to an employer rather than form-filling convenience. */
export function isEligibilityAnswer(a) {
  return ELIGIBILITY_MARKERS.has(String(a?.handler_type ?? ""))
      || ELIGIBILITY_MARKERS.has(String(a?.matched_on ?? ""))
      || ELIGIBILITY_MARKERS.has(String(a?.name ?? ""));
}

// ── Packet ───────────────────────────────────────────────────────────────────────────────────

/**
 * Normalise one resolved answer into the packet's per-field shape.
 * Confidence is derived from provenance through the SAME table the apply path uses, so a packet and
 * a submitted application cannot disagree about what a given provenance tier is worth.
 */
function toPacketAnswer(a) {
  const provenance = a.provenance ?? null;
  return {
    field:      a.label || a.name || a.field_id || null,
    name:       a.name ?? null,
    field_id:   a.field_id ?? null,
    type:       a.type ?? null,
    value:      a.value ?? null,
    provenance,
    // Never invented: an answer with no provenance has no confidence, rather than a default that
    // would read as a weak-but-real signal.
    confidence: provenance ? (CONFIDENCE_BY_PROVENANCE[provenance] ?? null) : null,
    matched_on: a.matched_on ?? null,
    // buildAnswers emits `required`; the canonical field set declares `is_required`. Read both,
    // or every real answer arrives as optional.
    is_required: (a.required ?? a.is_required) === true,
    handler_type: a.handler_type ?? null,
    eligibility: isEligibilityAnswer(a),
  };
}

/**
 * Build the packet body for a gated run.
 *
 * @param {object}   opts
 * @param {Array}    opts.resolvedAnswers  what autoApply's resolver produced, if the form was reachable
 * @param {object}   opts.autofillPayload  the profile payload (field_map / handler_map / custom_answers)
 * @param {string}   opts.applyUrl         where the human has to go — the URL the gate was observed at
 * @param {string}   opts.jobId
 * @param {number?}  opts.runId
 * @param {number?}  opts.runJobId
 * @param {number?}  opts.resumeArtifactId
 * @param {string}   opts.gateReason       'login_required' | 'captcha_required'
 * @returns {{ expectedOrigin, applyUrl, answers, unresolved, source, ... }}
 */
export function buildGatePacket({
  resolvedAnswers = [],
  autofillPayload = {},
  applyUrl,
  jobId,
  runId = null,
  runJobId = null,
  resumeArtifactId = null,
  gateReason = "login_required",
  entries = null,                 // D55 (b): buildPacketEntries(); absent on an older caller
  baseResume = null,              // ⭐ T18: buildStructuredResume() of the BASE résumé — its facts fill what the profile left empty
} = {}) {
  const expectedOrigin = originOf(applyUrl);
  if (!expectedOrigin) {
    // Refuse rather than store a packet nothing can target-match. A packet with no expected origin
    // could only be released by trusting the page it landed on, which is the leak §5 describes.
    const err = new Error(`gate packet needs a parseable apply URL, got: ${applyUrl}`);
    err.reasonCode = "gate_packet_unparseable_url";
    throw err;
  }

  // Prefer what the resolver actually matched against a real form; fall back to the canonical set.
  // `skipped` answers carry no value and are not answers — they are the resolver's refusals, and
  // counting them as resolved would overstate what is prepared.
  const real = (Array.isArray(resolvedAnswers) ? resolvedAnswers : [])
    .filter(a => a && !a.skipped && a.value !== null && a.value !== undefined && a.value !== "");
  const usedCanonical = real.length === 0;
  const answers = usedCanonical
    ? buildAnswers(CANONICAL_GATE_FIELDS, autofillPayload)
    : real;

  const required = new Map(CANONICAL_GATE_FIELDS.map(f => [f.name, f.is_required]));
  // ⭐ T18: a canonical answer keeps its question's handler type — the key the extension's field vocabulary meets it by
  // (buildAnswers returns the value, not the question it answered).
  const canonicalKey = new Map(CANONICAL_GATE_FIELDS.map(f => [f.name, f.handler_type]));
  const packetAnswers = answers
    .filter(a => a && !a.skipped && a.value !== null && a.value !== undefined && a.value !== "")
    .map(a => toPacketAnswer({ ...a, is_required: a.required ?? a.is_required ?? required.get(a.name) ?? false,
      handler_type: a.handler_type ?? (usedCanonical ? canonicalKey.get(a.name) : null) ?? null }));
  // ⭐ T18 / T23: what the PARSED BASE RÉSUMÉ states (school, degree, discipline, dates, current employer and title, the
  // links in its header) for every key the profile left empty, and the phone's country code. Profile first, always.
  packetAnswers.push(...resumeAnswers(baseResume, packetAnswers), ...derivedAnswers(autofillPayload, packetAnswers));

  // ── NEVER MINT A PACKET WITH NOTHING TO FILL (AE2 requirement 3) ────────────────────────────
  // A packet IS the "Open & fill" promise: the panel offers that route for a row that has one, and
  // the extension's only job on the far side is to type the packet's answers into the employer's
  // form. Zero answers makes that promise unkeepable — the overlay opens, matches nothing, and
  // fills nothing, which is indistinguishable to the candidate from the extension being broken.
  // Refuse, and let the caller park the hold WITHOUT a packet: the row then offers plain "Open",
  // which is honest about what it can do. routes/apply.js already treats a throw here as a
  // degraded handoff rather than a failed run, so nothing is lost by saying so.
  if (packetAnswers.length === 0) {
    const err = new Error(
      `gate packet would carry zero answers (resolved=${real.length}, source=${usedCanonical ? "canonical_profile" : "discovered_form"})`);
    err.reasonCode = "gate_packet_no_answers";
    throw err;
  }

  // What we could NOT answer. Surfacing it here is what lets the queue say "this one will ask you
  // two questions" before the human opens the portal (the same idea as G4 requirement 4).
  const answeredNames = new Set(packetAnswers.map(a => a.name));
  const answeredKeys = new Set(packetAnswers.map(a => a.handler_type).filter(Boolean));
  const unresolved = CANONICAL_GATE_FIELDS
    .filter(f => !answeredNames.has(f.name) && !answeredKeys.has(f.handler_type))
    .map(f => ({
      field: f.label, name: f.name, type: f.type,
      is_required: f.is_required,
      handler_type: f.handler_type,
      eligibility: isEligibilityAnswer(f),
    }));

  return {
    version: 1,
    // ⭐ T18: which answer set this packet was built with — a prepared packet from before the vocabulary and the
    // résumé's facts is not reused (routes/apply.js prepareManualPacket), so "12 fields prepared" does not linger.
    answersVersion: PACKET_ANSWERS_VERSION,
    jobId: String(jobId),
    runId, runJobId,
    gateReason,
    applyUrl,
    expectedOrigin,
    resumeArtifactId,
    // Named so a consumer can tell a form-matched packet from a profile-only one without guessing
    // from the provenance mix. G3's overlay reads differently in each case.
    source: usedCanonical ? "canonical_profile" : "discovered_form",
    answers: packetAnswers,
    unresolved,
    // D55 (b). Only when there is something in it, so a packet from a profile with no history looks
    // exactly as it did before rather than carrying five empty lists.
    ...(hasEntries(entries) ? { entries } : {}),
    // D55 (f). The candidate's saved answers for THIS employer ({company} already expanded, motivation
    // templates withheld) and the work-history fact — so the fill can answer a question on the page
    // that the server never saw, by the same exact-words rule buildAnswers uses. Only when present.
    ...packetSavedAnswers(autofillPayload),
  };
}

/**
 * D55 (f): what the packet carries for questions the server never saw.
 *   savedAnswers  [{ question, answer, eligibility, optIn }] — matched on the page ONLY by
 *                 normaliseQuestion equality (shared/savedAnswers.js). ⛔ Never by containment for
 *                 an eligibility, EEO or opt-in question, and an opt-in only ever with a No.
 *   workedHere    { company, answer: 'Yes'|'No'|null, reason } — "have you worked here before?" as
 *                 the stated work history answers it (workedHereAnswer); null answer = leave it.
 */
export function packetSavedAnswers(autofillPayload = {}) {
  const out = {};
  // ⭐ D96 §4: only ACKNOWLEDGED answers, each with its source and the date it was acknowledged — the label-only
  // store (`custom_answers`, legacy) and the keyed lifecycle rows (`saved_answer_records`, migration 164). ⛔ Never a
  // terms / consent / privacy / attestation / signature question, whatever is stored (services/answerLifecycle.js).
  const saved = packetLifecycleAnswers({
    legacy: autofillPayload?.custom_answers || {},
    records: autofillPayload?.saved_answer_records || [],
    legacyAcknowledgedAt: autofillPayload?.saved_answers_legacy_at ?? null,
  });
  if (saved.length) out.savedAnswers = saved;
  const wh = autofillPayload?.worked_here;
  if (wh?.company) {
    const d = workedHereAnswer(`Have you worked for ${COMPANY_TOKEN} before?`, wh.company, wh.history || []);
    out.workedHere = { company: wh.company, answer: d.answer, reason: d.reason };
  }
  // D55 (f) · the EEO fields the candidate set to "Choose not to disclose" — the KEYS only, never any
  // other EEO value. The extension then picks the form's own decline option for those fields and
  // leaves every other EEO field blank (stated-or-blank: a decline is never a default).
  const hm = autofillPayload?.handler_map || {};
  const eeoDeclines = EEO_DECLINE_HANDLERS.filter(k => isEeoDecline(hm[k]));
  if (eeoDeclines.length) out.eeoDeclines = eeoDeclines;
  return out;
}

// ── D55 (b): REPEATING SECTIONS — entries, not answers ───────────────────────────────────────
//
// A packet's `answers` are one value per question. Workday's My Experience step is not shaped like
// that: Work Experience, Education, Languages and Websites are SECTIONS, each "Add / Add Another"
// creating a panel of its own fields, and Skills is a set of chips. A flat answer list cannot say
// "two jobs, one degree" — so the packet carries `entries` beside its answers, and the extension
// clicks Add Another once per entry.
//
// STATED, NEVER INVENTED. Every entry comes from something the candidate wrote down:
//   education   the profile's university / highest_degree / field_of_study / graduation_year — ONE
//               entry, because that is all the profile stores
//   work        the base résumé's EXPERIENCE section (company, role, dates, bullets), parsed by the
//               same buildStructuredResume the résumé renderer uses; failing that, the profile's
//               current_company / current_job_title as one current role
//   websites    linkedin_url, github_url, website_url, portfolio_url — each its own URL, never one
//               standing in for another (the `website` field_map rule)
//   languages   [] — ⚠ the profile stores no languages. An empty list is the honest answer, and the
//               section is left for the candidate.
//   skills      confirmed_skills — the ones the candidate confirmed, not the target ones
// Nothing here is an attestation: no eligibility, EEO or screening answer travels as an entry.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Jan 2022" / "01/2022" / "2022" -> { month, year }; null when no year can be read. */
export function parseMonthYear(s) {
  const t = String(s || "").trim().toLowerCase();
  if (!t) return null;
  const year = t.match(/\b(19|20)\d{2}\b/)?.[0];
  if (!year) return null;
  let month = null;
  const named = MONTHS.findIndex(m => new RegExp(`\\b${m}`).test(t));
  if (named >= 0) month = named + 1;
  else {
    const num = t.match(/\b(0?[1-9]|1[0-2])\s*[/.-]\s*(19|20)\d{2}\b/)?.[1];
    if (num) month = Number(num);
  }
  return { month, year: Number(year) };
}

/** "Jan 2022 – Present" -> { from, to, current }. */
export function parseDateRange(s) {
  const t = String(s || "").trim();
  if (!t) return { from: null, to: null, current: false };
  const parts = t.split(/\s*(?:–|—|\s-\s|\bto\b|→|(?<=\d{4})-(?=\s*(?:\d|present|current)))\s*/i).filter(Boolean);
  const current = /\b(present|current|now|today)\b/i.test(t);
  const from = parseMonthYear(parts[0]);
  const to = current || parts.length < 2 ? null : parseMonthYear(parts[parts.length - 1]);
  return { from, to, current };
}

const clean = (v) => String(v ?? "").trim();
const asUrl = (raw) => {
  const t = clean(raw);
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

/**
 * Build the packet's entries from what the candidate has stated.
 * @param {object} opts
 * @param {object} opts.profile          the user_profile row (may be null)
 * @param {object} opts.structuredResume buildStructuredResume() of the base résumé (may be null)
 * @param {object} [opts.payload]        ⭐ D65 — services/payloadResume.js payloadResumeParse(): the parse of
 *   the résumé the packet CARRIES. When given, it is the ONE source of work history and of the résumé's
 *   skills: no profile fallback (a tailored résumé that dropped a role must not have it filled), and a
 *   parse that read nothing fills nothing for those sections and says so (entries.parse). User-claimed
 *   skills (confirmed_skills) are added either way, deduplicated, and listed in skillsClaimed.
 */
export function buildPacketEntries({ profile = null, structuredResume = null, payload = undefined } = {}) {
  const p = profile || {};
  const fromPayload = payload !== undefined && payload !== null && payload.source != null;
  if (fromPayload) structuredResume = payload.ok ? payload.structured : null;

  const education = [];
  if (clean(p.university) || clean(p.highest_degree) || clean(p.field_of_study)) {
    const year = Number(p.graduation_year);
    education.push({
      school: clean(p.university) || null,
      degree: clean(p.highest_degree) || null,
      field: clean(p.field_of_study) || null,
      gpa: null,
      from: null,
      to: Number.isInteger(year) && year > 1900 ? { month: null, year } : null,
      source: "profile",
    });
  }

  const work = [];
  const exp = (structuredResume?.sections || []).find(s => s?.type === "entries" && s.title === "EXPERIENCE");
  for (const e of exp?.entries || []) {
    const company = clean(e.company);
    const title = clean(e.role);
    if (!company && !title) continue;
    // The date is in `date` when the résumé put it there, or folded into `meta` beside a location.
    const dated = clean(e.date) || (/\b(19|20)\d{2}\b/.test(e.meta || "") ? clean(e.meta) : "");
    const range = parseDateRange(dated);
    const location = clean(e.meta) && clean(e.meta) !== dated ? clean(e.meta) : null;
    const bullets = (e.bullets || []).map(clean).filter(Boolean);
    work.push({
      title: title || null, company: company || null, location,
      from: range.from, to: range.to, current: range.current,
      description: bullets.length ? bullets.map(b => `• ${b}`).join("\n").slice(0, 2000) : (clean(e.text) || null),
      source: "resume",
    });
  }
  if (!fromPayload && !work.length && (clean(p.current_company) || clean(p.current_job_title))) {
    work.push({
      title: clean(p.current_job_title) || null, company: clean(p.current_company) || null, location: null,
      from: null, to: null, current: true, description: null, source: "profile",
    });
  }

  const websites = [];
  for (const [kind, col] of [["linkedin", "linkedin_url"], ["github", "github_url"], ["website", "website_url"], ["portfolio", "portfolio_url"]]) {
    const url = asUrl(p[col]);
    if (url && !websites.some(w => w.url === url)) websites.push({ kind, url, source: "profile" });
  }

  let skills = [];
  try {
    const raw = Array.isArray(p.confirmed_skills) ? p.confirmed_skills : JSON.parse(p.confirmed_skills || "[]");
    skills = [...new Set((Array.isArray(raw) ? raw : [])
      .map(s => clean(typeof s === "string" ? s : s?.name ?? s?.skill)).filter(Boolean))].slice(0, 40);
  } catch { skills = []; }

  if (!fromPayload) return { education, work, languages: [], websites, skills };

  // ⭐ D65: the résumé's own skills first, then the user's claims that the résumé does not show.
  const resumeSkills = payload.ok ? skillsOfStructured(payload.structured) : [];
  const claimed = skills.filter(c => !resumeSkills.some(r => r.toLowerCase() === c.toLowerCase()));
  return {
    education, work, languages: [], websites,
    skills: [...resumeSkills, ...claimed].slice(0, 60),
    skillsClaimed: claimed,
    resumeSource: payload.source,
    parse: payload.ok ? { ok: true } : { ok: false, message: PARSE_FAILED_MESSAGE },
  };
}

// ── ⭐ T18 / T23 · ANSWER SOURCES BEYOND THE PROFILE: the parsed base résumé, and what the profile implies ──────────
//
// A standard Greenhouse form asks for the school, the degree, the discipline and the dates, the current employer and
// title, LinkedIn, GitHub and a website. The profile often holds none of that while the base résumé holds all of it.
// resumeFacts() reads it OFF THE PARSE (buildStructuredResume — the renderer's own reading of the résumé): STATED,
// NEVER INVENTED — a value the parse does not show is absent, and the field stays the candidate's.
//   school / degree / field-of-study / grad-year / grad-month / start-year / start-month   the EDUCATION section's first entry
//   current-company / current-title   the EXPERIENCE section's first entry, ONLY when its dates say it is current
//   linkedin / github / website       the URLs in the header's contact line
// Each becomes a packet answer with provenance field_map_exact (a fact the candidate wrote, read by a fixed rule — the
// same tier the work history uses) and `source: "resume"`, so the panel says "your résumé". ⛔ Nothing here is an
// attestation: no eligibility, EEO or screening answer comes from a résumé.

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE_RUN = /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\b(?:\s*(?:–|—|-|to)\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|present|current|now))?|\b(?:expected|anticipated)\b/gi;
const INSTITUTION = /universit|college|institute|school|academy|polytechnic|conservatory|\bmit\b/i;
/** The degree's LEVEL in the words ATS pickers use ("B.S." → "Bachelor's Degree") — the choice a picker is matched by. */
export function degreeLevelOf(text) {
  const t = String(text || "").toLowerCase().replace(/\./g, "");
  if (/\b(mba|master of business administration)\b/.test(t)) return "Master of Business Administration (M.B.A.)";
  if (/\b(phd|doctor of philosophy|doctorate)\b/.test(t)) return "Doctor of Philosophy (Ph.D.)";
  if (/\b(jd|juris doctor)\b/.test(t)) return "Juris Doctor (J.D.)";
  if (/\b(md|doctor of medicine)\b/.test(t)) return "Doctor of Medicine (M.D.)";
  if (/\b(ms|msc|ma|meng|mfa|mph|mtech|master|masters)\b/.test(t)) return "Master's Degree";
  if (/\b(bs|bsc|ba|be|beng|bfa|btech|bachelor|bachelors|ab|sb)\b/.test(t)) return "Bachelor's Degree";
  if (/\b(as|aa|aas|associate|associates)\b/.test(t)) return "Associate's Degree";
  if (/\bhigh school|ged\b/.test(t)) return "High School";
  return null;
}
const DEGREE_WORDS = Object.freeze({ bs: "Bachelor of Science", bsc: "Bachelor of Science", sb: "Bachelor of Science", ba: "Bachelor of Arts",
  ab: "Bachelor of Arts", beng: "Bachelor of Engineering", be: "Bachelor of Engineering", btech: "Bachelor of Technology",
  bfa: "Bachelor of Fine Arts", ms: "Master of Science", msc: "Master of Science", ma: "Master of Arts", meng: "Master of Engineering",
  mtech: "Master of Technology", mfa: "Master of Fine Arts", mph: "Master of Public Health", mba: "Master of Business Administration",
  phd: "Doctor of Philosophy", as: "Associate of Science", aa: "Associate of Arts" });

/** "B.S. in Computer Science" → { degree: "Bachelor of Science", field: "Computer Science" }. */
export function splitDegree(line) {
  const s = clean(String(line || "").replace(DATE_RUN, " ").replace(/\s*[|,;·•]\s*$/, "").replace(/\s{2,}/g, " "));
  if (!s) return { degree: null, field: null };
  let m = /^(.+?)\s*(?:,|\bin\b|\s[–—-]\s|:)\s*(.+)$/i.exec(s);
  if (m && !degreeLevelOf(m[1])) m = null;
  let degree = m ? clean(m[1]) : s, field = m ? clean(m[2]) : null;
  if (!m) {
    // "MS Computer Science": an abbreviation, then the field.
    const a = /^([A-Za-z]{1,2}\.?[A-Za-z]{1,3}\.?)\s+(.{3,})$/.exec(s);
    if (a && DEGREE_WORDS[a[1].toLowerCase().replace(/\./g, "")]) { degree = a[1]; field = clean(a[2]); }
  }
  const abbr = DEGREE_WORDS[degree.toLowerCase().replace(/[.\s]/g, "")];
  return { degree: abbr || degree, field: field ? field.replace(/\s*[|,;].*$/, "").trim() || null : null };
}

const urlsOf = (text) => String(text || "").split(/[|•·,;\s]+/).map(clean)
  .filter(t => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(t) && !/@/.test(t));

/** The facts a résumé states, by vocabulary key. `structured`: buildStructuredResume(). Absent keys are not stated. */
export function resumeFacts(structured) {
  const out = {};
  if (!structured || typeof structured !== "object") return out;
  for (const u of urlsOf(structured.header?.contact)) {
    const url = asUrl(u);
    if (/linkedin\.com\//i.test(url)) out.linkedin ??= url;
    else if (/github\.com\//i.test(url)) out.github ??= url;
    else out.website ??= url;
  }
  const section = (title) => (structured.sections || []).find(s => s?.type === "entries" && s.title === title);
  const edu = section("EDUCATION")?.entries?.[0];
  if (edu) {
    const a = clean(edu.company), b = clean(edu.role);
    const [school, degreeLine] = INSTITUTION.test(a) || !INSTITUTION.test(b) ? [a, b] : [b, a];
    if (school) out.school = school.replace(DATE_RUN, " ").replace(/\s{2,}/g, " ").trim();
    const { degree, field } = splitDegree(degreeLine);
    if (degree && degreeLevelOf(degree)) { out.degree = degree; out.degreeLevel = degreeLevelOf(degree); }
    if (field) out["field-of-study"] = field;
    const dated = [edu.date, edu.role, edu.meta, edu.company].map(clean).join(" ");
    const runs = [...dated.matchAll(/((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d{2})/gi)];
    if (runs.length) {
      const last = parseMonthYear(runs[runs.length - 1][0]);
      if (last) { out["grad-year"] = String(last.year); if (last.month) out["grad-month"] = MONTH_NAMES[last.month - 1]; }
      if (runs.length > 1) {
        const first = parseMonthYear(runs[0][0]);
        if (first) { out["start-year"] = String(first.year); if (first.month) out["start-month"] = MONTH_NAMES[first.month - 1]; }
      }
    }
  }
  const job = section("EXPERIENCE")?.entries?.[0];
  if (job) {
    const dated = [job.date, job.role, job.meta].map(clean).join(" ");
    if (/\b(present|current|now)\b/i.test(dated)) {
      if (clean(job.company)) out["current-company"] = clean(job.company);
      const title = clean(String(job.role || "").replace(DATE_RUN, " ").replace(/\s{2,}/g, " "));
      if (title) out["current-title"] = title;
    }
  }
  return out;
}

const RESUME_KEYS = Object.freeze([
  // [vocabulary key, packet name, label]
  ["school", "school", "School"], ["degree", "degree", "Degree"], ["field-of-study", "discipline", "Discipline"],
  ["grad-year", "graduation_year", "Graduation year"], ["grad-month", "graduation_month", "Graduation month"],
  ["start-year", "education_start_year", "Education start year"], ["start-month", "education_start_month", "Education start month"],
  ["current-company", "current_company", "Current company"], ["current-title", "current_title", "Current title"],
  ["linkedin", "linkedin", "LinkedIn Profile"], ["github", "github", "GitHub"], ["website", "website", "Website"],
]);

/** The résumé's facts as packet answers, for every key no answer already holds (the profile wins). */
export function resumeAnswers(structured, have = []) {
  const facts = resumeFacts(structured);
  const held = new Set((have || []).map(a => a?.handler_type).filter(Boolean));
  const names = new Set((have || []).map(a => a?.name).filter(Boolean));
  const out = [];
  for (const [key, name, label] of RESUME_KEYS) {
    const value = facts[key];
    if (!value || held.has(key) || names.has(name)) continue;
    out.push({
      ...toPacketAnswer({ label, name, field_id: `r_${name}`, type: "text", value, provenance: "field_map_exact",
        matched_on: `resume:${key}`, handler_type: key, is_required: false }),
      source: "resume",
      // a picker is matched by the degree's LEVEL ("Bachelor's Degree"); a text box gets the degree as written
      ...(key === "degree" && facts.degreeLevel ? { choice: facts.degreeLevel } : {}),
    });
  }
  return out;
}

const DIAL = Object.freeze({ "united states": ["+1", "United States"], usa: ["+1", "United States"], us: ["+1", "United States"],
  "united states of america": ["+1", "United States"], canada: ["+1", "Canada"], "united kingdom": ["+44", "United Kingdom"],
  uk: ["+44", "United Kingdom"], india: ["+91", "India"], germany: ["+49", "Germany"], france: ["+33", "France"],
  australia: ["+61", "Australia"], ireland: ["+353", "Ireland"], netherlands: ["+31", "Netherlands"], singapore: ["+65", "Singapore"] });

/** What the profile implies but no handler states: the phone's country code, from the profile's country. */
export function derivedAnswers(autofillPayload = {}, have = []) {
  const held = new Set((have || []).map(a => a?.handler_type).filter(Boolean));
  const country = clean(autofillPayload?.handler_map?.country || autofillPayload?.field_map?.country).toLowerCase();
  const phone = clean(autofillPayload?.handler_map?.phone || autofillPayload?.phone);
  const dial = DIAL[country];
  if (!dial || !phone || held.has("phone-country")) return [];
  return [{
    ...toPacketAnswer({ label: "Phone country code", name: "phone_country_code", field_id: "d_phone_country", type: "text", value: dial[0],
      provenance: "field_map_exact", matched_on: "profile:country", handler_type: "phone-country", is_required: false }),
    choice: `${dial[1]} ${dial[0]}`,
  }];
}

/** ⭐ T18: the answer set's version — 2 = the fuller canonical set + the base résumé's facts + the phone's country code. */
export const PACKET_ANSWERS_VERSION = 2;

/** True when an entries object has anything in it. */
export function hasEntries(entries) {
  return !!entries && ["education", "work", "languages", "websites", "skills"]
    .some(k => Array.isArray(entries[k]) && entries[k].length > 0);
}

/** Origin of a URL, or null when it cannot be parsed. Never throws. */
export function originOf(url) {
  try { return new URL(String(url)).origin; } catch { return null; }
}

// ── What a packet is FOR ─────────────────────────────────────────────────────────────────────
//
// A packet was built for one situation — a login wall or a CAPTCHA — and the whole handoff was
// shaped around it: a prepared answer set, a short-lived token, an activeTab grant, a provenance
// overlay, and a target match before anything is released. A HELD REVIEW is the same situation. A
// form needs a human, in the human's own browser. It was simply never routed here, so a held
// application had no route to submission at all: the filled DOM lives in a Puppeteer context that
// has already closed, and only the screenshot survived it.
//
// The two kinds differ in ONE way, and it is a presentation fact rather than a security one:
//
//   GATE CROSSING   one action (a sign-in) unblocks EVERY application queued behind that origin,
//                   so these amortise and are grouped by PORTAL.
//   HELD REVIEW     the obstacle belongs to one application — a question only the candidate can
//                   answer, a form we would not complete on a guess — so it groups by APPLICATION.
//
// Grouping the second kind by portal would report "sign in to boards.greenhouse.io once → 4
// applications ready" over four applications that need four different answers, which is a promise
// the sign-in cannot keep.

/** Reasons where crossing the obstacle ONCE releases every application on that origin. */
export const GATE_CROSSING_REASONS = Object.freeze(new Set(["login_required", "captcha_required"]));

/**
 * Held terminal reasons that are RESUMABLE: the form was reached, answers were resolved, and a
 * human standing on the page can finish it. Each gets a packet exactly as a gate hold does.
 *
 * `awaiting_approval` is deliberately ABSENT. That application is complete and the decision is a
 * click in this product, not a form in someone else's browser — the approval flow submits it
 * server-side, and handing it off would offer a second, divergent copy of an application already
 * queued to send.
 */
export const RESUMABLE_HELD_REASONS = Object.freeze(new Set([
  "manual_review",                  // the form asked something only the candidate can answer
  "low_confidence_answers",         // we had a guess and would not send a guess
  "incomplete_form",                // required fields we would not fill
  "answers_changed_since_approval", // the form moved after approval; the candidate re-reads it
  "no_submit_button",               // filled, and nothing we could find would send it
  "submit_unverified",              // submit was clicked and the page never confirmed
  "ats_below_threshold",            // held on the score; the candidate may send it anyway
  "resume_unavailable",             // nothing to attach — resumable once that is fixed
  "full_auto_disabled",             // policy held it; the human is the intended route
  "provider_review_only",           // this provider is never submitted unattended
  "daily_cap_reached",              // the cap is ours, not the employer's
]));

/**
 * Statuses whose terminal rows are handed off. `held_gate` is the original G1 case; `held_review` is
 * AB1's. Both mean "a form needs a human", which is the only precondition the handoff has.
 */
export const HANDOFF_STATUSES = Object.freeze(new Set(["held_gate", "held_review"]));

/** Which kind of handoff a stored packet is, from its reason alone. */
export function handoffKind(gateReason) {
  return GATE_CROSSING_REASONS.has(String(gateReason)) ? "gate" : "review";
}

/**
 * Should a terminal run-job get a packet?
 *
 * Gates always do. A held review does when its reason is one a human can actually finish — holding
 * out `awaiting_approval` (which has its own surface) and anything we have not described, because a
 * packet nobody can act on is a row in a queue that never empties.
 */
export function shouldBuildPacket({ status, reasonCode }) {
  if (!HANDOFF_STATUSES.has(String(status))) return false;
  if (String(status) === "held_gate") return true;
  return RESUMABLE_HELD_REASONS.has(String(reasonCode));
}

// ── Staleness ────────────────────────────────────────────────────────────────────────────────
//
// AB1 requirement 5. A packet is a snapshot of a decision, and the world moves: a posting closes, a
// form is re-versioned, salary expectations change. Filling a three-day-old answer set into a form
// silently is worse than refusing, because the candidate cannot tell it happened.
//
// This is NOT the token TTL, and the two must not be confused. The token's ten minutes protect a
// home address in flight between mint and release. This protects the ANSWERS' relevance, and is
// measured in days because that is the timescale on which a prepared application goes off.
export const PACKET_STALE_MS = 72 * 60 * 60 * 1000;

/**
 * How old a packet is and whether it may still be filled.
 * @param {number} createdAtMs  epoch ms
 * @returns {{ ageMs: number, stale: boolean }}
 */
export function packetFreshness(createdAtMs, now = Date.now()) {
  const ageMs = Math.max(0, now - Number(createdAtMs || 0));
  return { ageMs, stale: ageMs > PACKET_STALE_MS };
}

// ── Token ────────────────────────────────────────────────────────────────────────────────────
// HMAC over a compact payload, not a random opaque id, so the binding to (user, job, packet) travels
// WITH the token and is checked before the database is touched. A random id would have to be looked
// up first, which makes an enumeration attempt indistinguishable from a legitimate miss.
//
// Only the HASH of the token is stored, so a database read cannot yield a usable credential.

const TOKEN_VERSION = 1;
/** Minutes, not hours (G1 requirement 3): this unlocks a home address and eligibility answers. */
export const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000;

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function sign(payloadB64, secret) {
  return crypto.createHmac("sha256", String(secret)).update(payloadB64).digest("base64url");
}

/** sha256 of the whole token. What the row stores. */
export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Mint a token bound to one user, one job and one packet row.
 * @returns {{ token, tokenHash, expiresAt }}  expiresAt in epoch SECONDS, matching the schema
 */
export function mintPacketToken({ secret, userId, jobId, packetId, ttlMs = DEFAULT_TOKEN_TTL_MS, now = Date.now() }) {
  if (!secret) {
    const err = new Error("cannot mint a gate packet token without a server secret");
    err.reasonCode = "gate_token_no_secret";
    throw err;
  }
  const expMs = now + ttlMs;
  const payload = { v: TOKEN_VERSION, pid: Number(packetId), uid: Number(userId), jid: String(jobId), exp: expMs };
  const payloadB64 = b64url(JSON.stringify(payload));
  const token = `${payloadB64}.${sign(payloadB64, secret)}`;
  return { token, tokenHash: hashToken(token), expiresAt: Math.floor(expMs / 1000) };
}

/**
 * Verify signature, shape and expiry. Does NOT touch the database — single-use is enforced there.
 *
 * Failure reasons are kept DISTINCT (G1 requirement 4): a malformed token, a forged one, an expired
 * one and one belonging to another account are four different events, and collapsing them into a
 * generic 400 would hide the only one that indicates an attack.
 *
 * @returns {{ ok: true, payload } | { ok: false, reason: string }}
 */
export function verifyPacketToken(token, { secret, now = Date.now() } = {}) {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (typeof token !== "string" || !token) return { ok: false, reason: "token_malformed" };

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return { ok: false, reason: "token_malformed" };
  const payloadB64 = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);

  const expectedSig = sign(payloadB64, secret);
  // Constant-time: a length mismatch is compared as a mismatch rather than short-circuiting, so the
  // comparison does not leak how much of a forged signature was correct.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "token_invalid" };

  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")); }
  catch { return { ok: false, reason: "token_malformed" }; }

  if (payload?.v !== TOKEN_VERSION) return { ok: false, reason: "token_version" };
  if (!Number.isInteger(payload.pid) || !Number.isInteger(payload.uid) || !payload.jid) {
    return { ok: false, reason: "token_malformed" };
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now) return { ok: false, reason: "token_expired" };

  return { ok: true, payload };
}
