// ── A33: résumé → profile PREFILL, which the user confirms field by field ─────────────────────
//
// WORKLOG A33: "On upload, extract name, email, phone, location, titles, skills, education, dates
// and drop them in as a PREFILL the user confirms."
//   ⛔ PREFILLED, NEVER AUTO-ACCEPTED — an extracted value the user never saw is a claim they did
//      not make. This module only PROPOSES; the Profile panel shows each proposal with the line it
//      came from and fills only what the user ticks, and nothing is saved until they press Save.
//   ⛔ ELIGIBILITY AND EEO FIELDS ARE NEVER PREFILLED — work authorisation, sponsorship, visa,
//      clearance, gender, ethnicity, veteran and disability status are attestations. They are not
//      in PREFILL_FIELDS and a test proves no code path can propose them.
// Titles, keywords and skills already come from the résumé into the job profile's signals
// (services/simpleApplyProfile.js); this covers the personal details the intake form asks for.
//
// Deterministic and local — no model call, nothing sent anywhere. In shared/ so the client runs it
// on the text it already holds.

export const PREFILL_FIELDS = Object.freeze([
  "full_name", "email", "phone", "linkedin_url", "github_url", "website_url",
  "city", "state", "highest_degree", "field_of_study", "university", "graduation_year",
]);

export const NEVER_PREFILL = Object.freeze([
  "work_auth", "visa_type", "requires_sponsorship", "sponsorship_need", "has_clearance", "clearance_level",
  "gender", "ethnicity", "veteran_status", "disability_status",
]);

const US_STATES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
// Short forms need their dots or a following "in": "MA" and "MS" are also state codes.
const DEGREES = [
  { re: /\b(Ph\.?\s?D\.?|Doctor(?:ate)? of)\b/i, label: "PhD", rank: 4 },
  { re: /\b(Master(?:'s)?\b|M\.S\.|M\.Sc\b|MSc\b|M\.?\s?Tech\b|M\.?\s?Eng\b|MBA\b|M\.A\.|MS(?=\s+in\b))/, label: "Master's", rank: 3 },
  { re: /\b(Bachelor(?:'s)?\b|B\.S\.|B\.Sc\b|BSc\b|B\.?\s?Tech\b|B\.E\.|B\.A\.|BS(?=\s+in\b))/, label: "Bachelor's", rank: 2 },
  { re: /\bAssociate(?:'s)? (?:of|degree)\b/i, label: "Associate's", rank: 1 },
];

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

/**
 * Proposals from a résumé's text: { [field]: { value, from } } — `from` is the line the value was
 * read from, shown beside it so the user can judge it. Fields with nothing found are absent.
 */
export function prefillFromResumeText(text) {
  const out = {};
  const lines = String(text || "").split(/\r?\n/).map(clean).filter(Boolean);
  if (!lines.length) return out;
  const put = (field, value, from) => { if (value && !out[field] && PREFILL_FIELDS.includes(field)) out[field] = { value, from }; };
  const header = lines.slice(0, 6);
  const all = lines.join("\n");

  // Name: the first line, if it reads as a name (2–4 words, letters only).
  const first = lines[0];
  if (/^[A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){1,3}$/.test(first) && !/resume|curriculum|vitae/i.test(first)) {
    put("full_name", first.split(" ").map(w => (w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w)).join(" "), first);
  }
  const email = all.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/);
  if (email) put("email", email[0], lines.find(l => l.includes(email[0])));
  const phone = all.match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  if (phone) put("phone", phone[0], lines.find(l => l.includes(phone[0])));
  const li = all.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i);
  if (li) put("linkedin_url", li[0].startsWith("http") ? li[0] : `https://${li[0]}`, lines.find(l => l.includes(li[0])));
  const gh = all.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[A-Za-z0-9_-]+\/?/i);
  if (gh) put("github_url", gh[0].startsWith("http") ? gh[0] : `https://${gh[0]}`, lines.find(l => l.includes(gh[0])));
  const site = header.join(" ").match(/\bhttps?:\/\/(?!(?:www\.)?(?:linkedin|github)\.com)[^\s|,]+/i);
  if (site) put("website_url", site[0], header.find(l => l.includes(site[0])));

  // City, ST — only in the header, and only a real US state code.
  for (const l of header) {
    const m = l.match(/\b([A-Z][A-Za-z.' -]{1,40}),\s*([A-Z]{2})\b/);
    if (m && US_STATES.has(m[2])) { put("city", m[1].trim().replace(/^.*[|•·]\s*/, ""), l); put("state", m[2], l); break; }
  }

  // Education: the highest degree named, and the line it is on (and its neighbour) for school/year.
  // Only the EDUCATION section when the résumé has one (to the next heading); otherwise everything
  // but the header, where a state code would otherwise read as a degree.
  const eduAt = lines.findIndex(l => /^education\b/i.test(l));
  let from = eduAt >= 0 ? eduAt + 1 : Math.min(header.length, lines.length);
  let to = lines.length;
  if (eduAt >= 0) {
    const next = lines.findIndex((l, i) => i > eduAt && /^[A-Z][A-Z &/]{3,}$/.test(l));
    if (next > 0) to = next;
  }
  let best = null;
  for (let i = from; i < to; i++) {
    for (const d of DEGREES) if (d.re.test(lines[i]) && (!best || d.rank > best.rank)) best = { ...d, i, line: lines[i] };
  }
  if (best) {
    put("highest_degree", best.label, best.line);
    const near = [lines[best.i - 1], best.line, lines[best.i + 1]].filter(Boolean);
    // A line's parts, split at " — ", " | ", " - " and commas. ⛔ Read each field from ITS part:
    // "B.S. Computer Science, University of Texas at Austin, 2021" once gave university "B.S.
    // Computer Science" (the first part) and field "Texas at Austin" (the "of" inside the school's
    // name) — seen in a browser, 10-02 (18).
    const SCHOOL = /\b(University|Institute|College|School)\b/;
    const parts = (l) => l.split(/\s[–—|-]\s|,/).map(clean).filter(Boolean);
    const uni = near.find(l => SCHOOL.test(l));
    // The school's name only: the part that names a school, without a trailing date.
    const uniPart = uni && parts(uni).find(s => SCHOOL.test(s));
    if (uniPart) put("university", clean(uniPart.replace(/\s+\d{4}\b.*$/, "")).slice(0, 120), uni);
    // The field: what follows the degree in the degree's own part — never the school's part.
    const degPart = parts(best.line).find(s => best.re.test(s) && !SCHOOL.test(s));
    const after = degPart ? degPart.slice(degPart.search(best.re)).replace(best.re, "") : "";
    const field = after.match(/^[\s.]*(?:degree\s+)?(?:(?:of|in)\s+(?:(?:Science|Arts|Engineering)\s+in\s+)?)?([A-Z][A-Za-z &]+?)(?:\s*\(|\s+\d|$)/);
    if (field) put("field_of_study", clean(field[1]), best.line);
    // The year on the degree's own line first; a neighbour's only if that line has none (the next
    // line is often an older degree).
    const yearOf = (l) => (String(l || "").match(/\b(19[6-9]\d|20[0-4]\d)\b/g) || []).pop();
    const yLine = [best.line, lines[best.i - 1], lines[best.i + 1]].find(l => yearOf(l));
    if (yLine) put("graduation_year", yearOf(yLine), yLine);
  }
  return out;
}

/** Only the proposals that would CHANGE something the user has — never a no-op, never an overwrite surprise. */
export function prefillDiff(proposals, form) {
  return Object.entries(proposals)
    .filter(([k, p]) => !NEVER_PREFILL.includes(k) && String(form?.[k] ?? "").trim() !== String(p.value).trim())
    .map(([field, p]) => ({ field, value: p.value, from: p.from, current: form?.[field] ?? "" }));
}
