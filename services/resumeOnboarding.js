// ── A104 · THE RÉSUMÉ STARTS THE PROFILE (owner 10-30: "have the resume do the initiation work") ────────────
//
// Before: sign-up → a blocking five-step job-profile wizard (domain → level → titles → keywords → save) → THEN the base
// résumé, which already held every one of those answers. Now one upload does the initiation:
//   1. the first JOB PROFILE — domain, level, target titles, keywords / verbs / tools — read from the résumé's text
//      against the same registry the wizard offers (registry/DOMAIN_METADATA_REGISTRY.json); no model call;
//   2. the résumé attached as that profile's base, its signals extracted (the base-resume route's own path);
//   3. the PERSON profile's sections and the Application defaults the profile STATES (structuredProfile.readProfile's
//      first-open fill — D101's rules, so an eligibility answer is never inferred);
//   4. contact / education fields the user left EMPTY, from A33's prefill (shared/resumePrefill.js — NEVER_PREFILL
//      holds every attestation out); a field the user typed is never overwritten.
// The wizard stays, as "Refine your job profile", pre-filled with what was read here.

import { placeText, writePlacement } from "./placement.js";
import { recordFilled, fillExtras, nameAndTitlesFromPlacement, isTestAccount } from "./resumeSetup.js";   // D186   // (B)-1: one placement, one source
import { prefillFromResumeText, PREFILL_FIELDS } from "../shared/resumePrefill.js";

const SKIP_DOMAINS = new Set(["other_profile_request", "general"]);
const lower = (s) => String(s || "").toLowerCase();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A term counts when it appears as itself, not inside another word ("Go" is not "good", "R" is not "React").
const has = (text, term) => new RegExp(`(^|[^a-z0-9+#])${escapeRe(lower(term))}($|[^a-z0-9+#])`).test(text);

const EDUCATION_LINE = /(^|\W)(universit\w*|college|school|institute|bachelor\w*|master\w*|b\.?s\.?|m\.?s\.?|ph\.?d\.?|degree|gpa)(?=\W|$)/i;
const RANGE = /\b(19[89]\d|20[0-4]\d)\s*(?:[-–—]|to)\s*(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*)?(19[89]\d|20[0-4]\d|present|current|now)\b/i;

/** Years of WORK: from the earliest start of a date range on a line that is not an education line. Null if none. */
export function yearsOfWork(text, nowYear = new Date().getFullYear()) {
  let earliest = null, inEducation = false, prev = "";
  for (const line of String(text || "").split(/\r?\n/)) {
    // A degree's dates sit in the Education section, often on the line after the school — neither is work.
    if (/^\s*(education|academic)/i.test(line)) inEducation = true;
    else if (/^\s*(experience|work|employment|professional|skills|projects|summary|certifications?)\b/i.test(line)) inEducation = false;
    const skip = inEducation || EDUCATION_LINE.test(line) || EDUCATION_LINE.test(prev);
    prev = line;
    if (skip) continue;
    const m = RANGE.exec(line.replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?=(?:19|20)\d\d)/gi, ""));
    if (m) { const y = Number(m[1]); if (y <= nowYear && (earliest == null || y < earliest)) earliest = y; }
  }
  return earliest == null ? null : Math.max(0, nowYear - earliest);
}

/** The level the wizard's four values name (shared/jobFilterOptions.js PROFILE_SENIORITY). */
export function seniorityOf(text, years) {
  const head = lower(String(text || "").slice(0, 2500));
  if (/\b(director|vice president|vp|head of|chief [a-z]+ officer|cto|ceo|cfo)\b/.test(head)) return "executive";
  if (years != null && years > 5) return "senior";
  if (/\b(senior|sr\.?|staff|principal|lead)\b/.test(head) && (years == null || years >= 4)) return "senior";
  if (years != null && years > 2) return "mid";
  if (years == null && !/\b(intern|internship|student|new grad|graduate)\b/.test(head)) return "mid";
  return "junior";
}

/**
 * What the wizard would have asked, read from the résumé. Pure: (text, registry) → the profile's fields.
 * @returns {{ domain, roleFamily, profileName, seniority, years, titles, keywords, verbs, tools, score }}
 */
export function inferProfileFromResume(text, registry, nowYear = new Date().getFullYear()) {
  const t = lower(text);
  let best = null;
  for (const [key, e] of Object.entries(registry || {})) {
    if (SKIP_DOMAINS.has(key) || !e) continue;
    const titles = (e.suggestedTitles || []).filter(x => has(t, x));
    const keywords = (e.keywords || []).filter(x => has(t, x));
    const tools = (e.tools || []).filter(x => has(t, x));
    const score = titles.length * 3 + keywords.length + tools.length;
    if (!best || score > best.score) best = { key, e, titles, keywords, tools, score };
  }
  // Nothing matched well enough to name a field: the general profile, which the wizard's "Other" also lands on.
  if (!best || best.score < 3) {
    const g = registry?.general || {};
    best = { key: "general", e: { label: "General", roleFamily: "general", ...g }, titles: [], keywords: [], tools: [], score: best?.score || 0 };
  }
  const { key, e } = best;
  const years = yearsOfWork(text, nowYear);
  // The wizard pre-selects every chip; here the ones the résumé shows lead, and a thin match keeps the registry's set.
  const pick = (found, all, min) => (found.length >= min ? found : [...new Set([...found, ...(all || [])])]);
  return {
    domain: key,
    roleFamily: e.roleFamily || "general",
    profileName: e.label || "My job profile",
    seniority: seniorityOf(text, years),
    years,
    titles: pick(best.titles, (e.suggestedTitles || []).slice(0, 3), 1).slice(0, 8),
    keywords: pick(best.keywords, e.keywords, 5).slice(0, 20),
    verbs: (e.actionVerbs || []).filter(v => has(t, v)).concat((e.actionVerbs || []).filter(v => !has(t, v))).slice(0, 10),
    tools: pick(best.tools, e.tools, 3).slice(0, 15),
    score: best.score,
  };
}

/** Fill only the EMPTY contact / education columns from A33's prefill. Returns the fields written. */
export function fillEmptyProfileFields(db, userId, text) {
  const proposals = prefillFromResumeText(text);
  db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
  const cols = new Set(db.prepare("PRAGMA table_info(user_profile)").all().map(c => c.name));
  const written = [];
  for (const field of PREFILL_FIELDS) {
    const v = proposals[field]?.value;
    if (!v || !cols.has(field)) continue;
    const r = db.prepare(`UPDATE user_profile SET ${field} = ? WHERE user_id = ? AND (${field} IS NULL OR TRIM(CAST(${field} AS TEXT)) = '')`)
      .run(String(v), userId);
    if (r.changes) written.push(field);
  }
  recordFilled(db, userId, written);   // D186: shown "from your résumé"
  return written;
}

/**
 * The one server step: résumé text → the first job profile (active), its base résumé, the person profile's sections,
 * stated defaults and empty contact fields. Refused (409) when the user already has a job profile — a second one is
 * the wizard's, and an existing base résumé is replaced only by the profile's own upload.
 * @param deps { registry, saveBaseResume(profileId, content, name), readProfile(db, userId), onProfileWrite?(id),
 *               sampleRoleFamily?(text) — D123 P6e (R10): a trial sample's own family wins over the inference }
 */
export function startFromResume(db, userId, { content, name }, deps) {
  const text = String(content || "");
  if (text.trim().length < 200) throw Object.assign(new Error("That résumé has too little text to read — try the PDF or Word file."), { status: 400, code: "resume_too_short" });
  const existing = db.prepare("SELECT id FROM domain_profiles WHERE user_id = ? ORDER BY is_active DESC, id LIMIT 1").get(userId);
  // Owner 11-02 ("none of the samples work"): a trial account whose profile was made from one sample, picking another,
  // has that profile switched to the new sample — not the 409 that stranded every later pick. Any other résumé is refused.
  const swapSample = !!existing && !!deps.isSampleSwap?.(text);
  // ⭐ D186-3: a second résumé in ANOTHER family may become its own job profile (the person chose "Make this its own job
  // profile"); it is made active and the others step back — replacing stays the profile page's own upload.
  if (existing && !swapSample && !deps.asNew) {
    throw Object.assign(new Error("You already have a job profile — upload a résumé to it from Job profiles."), { status: 409, code: "has_profile" });
  }
  const inferred = inferProfileFromResume(text, deps.registry);
  const sampleFamily = deps.sampleRoleFamily?.(text);
  if (sampleFamily) inferred.roleFamily = sampleFamily;
  if (swapSample) {
    db.prepare(`UPDATE domain_profiles SET profile_name = ?, role_family = ?, domain = ?, seniority = ?, target_titles = ?,
        selected_keywords = ?, selected_verbs = ?, selected_tools = ?, is_active = 1 WHERE id = ?`)
      .run(inferred.profileName, inferred.roleFamily, inferred.domain, inferred.seniority, JSON.stringify(inferred.titles),
        JSON.stringify(inferred.keywords), JSON.stringify(inferred.verbs), JSON.stringify(inferred.tools), existing.id);
    db.prepare("UPDATE domain_profiles SET is_active = 0 WHERE user_id = ? AND id <> ?").run(userId, existing.id);
    deps.saveBaseResume(existing.id, text, name || "resume.txt");
    if (!sampleFamily) placeFirstResume(db, existing.id, text, inferred, deps.registry);
    const profile = deps.readProfile(db, userId);
    try { deps.onProfileWrite?.(existing.id); } catch { /* the board re-scores on its next read */ }
    return { profileId: existing.id, inferred, filled: [], completeness: profile?.completeness || null, swapped: true };
  }
  const id = db.transaction(() => {
    // D186-3: one ACTIVE job profile per person (a partial unique index) — the others step back BEFORE the new one goes in.
    if (deps.asNew) db.prepare("UPDATE domain_profiles SET is_active = 0 WHERE user_id = ?").run(userId);
    const r = db.prepare(`INSERT INTO domain_profiles (user_id, profile_name, role_family, domain, seniority,
        target_titles, selected_keywords, selected_verbs, selected_tools, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)`)
      .run(userId, inferred.profileName, inferred.roleFamily, inferred.domain, inferred.seniority,
        JSON.stringify(inferred.titles), JSON.stringify(inferred.keywords), JSON.stringify(inferred.verbs), JSON.stringify(inferred.tools));
    db.prepare("UPDATE users SET domain_profile_complete = 1 WHERE id = ?").run(userId);
    // D112 e2: made from a résumé — the profile shows "Refine your job profile" until the wizard is saved for it (179).
    if (db.prepare("PRAGMA table_info(domain_profiles)").all().some(c => c.name === "made_from_resume")) {
      db.prepare("UPDATE domain_profiles SET made_from_resume = 1 WHERE id = ?").run(r.lastInsertRowid);
    }
    return Number(r.lastInsertRowid);
  })();
  deps.saveBaseResume(id, text, name || "resume.txt");
  if (!sampleFamily) {
    placeFirstResume(db, id, text, inferred, deps.registry);   // a TRIAL sample keeps its own family (D123 P6e)
    // ⭐ D186-3: the pipeline names the job profile from its placement ("Frontend software engineering · mid") and adds the
    // subcategory's title aliases to the résumé's own titles.
    try { nameAndTitlesFromPlacement(db, id, { userId, autoNames: [inferred.profileName] }); } catch (e) { console.warn("[d186] name:", e.message); }
  }
  // ⛔ A140 (owner 11-08): a fictional sample never fills the person's contact fields — ⭐ D186-6: except on a TEST account
  // (users.test_account = 1, the owner's canary), where the sample IS the test.
  const mayFill = !sampleFamily || isTestAccount(db, userId);
  const filled = mayFill ? fillEmptyProfileFields(db, userId, text) : [];
  const profile = deps.readProfile(db, userId);
  // ⭐ D186-1: what the sections (just written by the first read) and the text tell us beyond A33's prefill.
  if (mayFill) { try { filled.push(...fillExtras(db, userId, text)); } catch (e) { console.warn("[d186] extras:", e.message); } }
  try { deps.onProfileWrite?.(id); } catch { /* the board re-scores on its next read */ }
  return { profileId: id, inferred, filled, completeness: profile?.completeness || null };
}

// ── ⛔ A140 (owner 11-08) · A NEW RÉSUMÉ, OR NEW SEARCH TERMS, MOVE WHAT THE PROFILE SEARCHES FOR ──────────────────
// The owner swapped a software résumé for a construction project manager's and changed the search terms by hand, and
// the board still showed software postings. The board RANKS by the job profile's declared role (domain_profiles
// role_family → the role_key rank, "the declared role leads") and its target titles (CC1) — and both were written ONCE,
// by the first onboarding (startFromResume). A later base résumé only re-extracted the signal lists; a hand edit of the
// search terms changed the q terms but never the declared role. Name / phone / email moved only because the A33 prefill
// offered them on the page.

/** Re-read the job profile from a résumé (or from search terms): role, domain, level, titles, keywords, verbs, tools. */
export function followProfileText(db, profileId, text, { registry, sampleRoleFamily = null, keepName = false } = {}) {
  const inferred = inferProfileFromResume(text, registry);
  const fam = sampleRoleFamily?.(text);
  if (fam) inferred.roleFamily = fam;
  if (inferred.domain === "general" && inferred.score < 3) return { changed: false, inferred };   // nothing readable: keep it
  const before = db.prepare("SELECT profile_name, role_family, domain, target_titles FROM domain_profiles WHERE id = ?").get(profileId);
  if (!before) return { changed: false, inferred };
  // The profile's NAME follows only when it is still a registry label (the onboarding's own name), never one the person typed.
  const labels = new Set(Object.values(registry || {}).map(e => e?.label).filter(Boolean).concat(["My job profile", "General"]));
  const name = !keepName && labels.has(before.profile_name) ? inferred.profileName : before.profile_name;
  db.prepare(`UPDATE domain_profiles SET profile_name = ?, role_family = ?, domain = ?, seniority = ?, target_titles = ?,
      selected_keywords = ?, selected_verbs = ?, selected_tools = ? WHERE id = ?`)
    .run(name, inferred.roleFamily, inferred.domain, inferred.seniority, JSON.stringify(inferred.titles),
      JSON.stringify(inferred.keywords), JSON.stringify(inferred.verbs), JSON.stringify(inferred.tools), profileId);
  // ⭐ (B)-1 (45o): ONE PLACEMENT, ONE SOURCE — the taxonomy's placement of this résumé writes the role (domain / role_family
  // through roles-v1.json's registryMap) over the registry's own keyword guess; below the confidence line the role is left
  // as the inference said and the placement records that it couldn't place (the page asks the person).
  let placement = null;
  try {
    placement = placeText(text, { titles: inferred.titles });
    writePlacement(db, profileId, placement, registry || {});
  } catch { placement = null; }
  const now = db.prepare("SELECT role_family, domain FROM domain_profiles WHERE id = ?").get(profileId) || {};
  return { changed: before.role_family !== now.role_family || before.domain !== now.domain
    || before.target_titles !== JSON.stringify(inferred.titles), inferred, placement,
    from: { roleFamily: before.role_family, domain: before.domain }, to: { roleFamily: now.role_family, domain: now.domain } };
}

/**
 * ⛔ 45s (the M-7 walk): the FIRST résumé is placed too. (B)-1's "one placement, one source" was wired into
 * followProfileText (a later résumé) only, so a person's first upload — the board's Upload your résumé — left the job
 * profile unplaced: the board's sentence never took their role, level or city, Profile had no "Fits …", and their next
 * résumé was read as a FIRST placement, so a family move never paused Apply for me. Same placeText → writePlacement.
 */
function placeFirstResume(db, profileId, text, inferred, registry) {
  try { writePlacement(db, profileId, placeText(text, { titles: inferred.titles }), registry || {}); }
  catch (e) { console.warn("[placement] first résumé:", e.message); }
}

/**
 * A NEW résumé moves the contact / education fields that still hold what the OLD résumé said (or are empty); a field the
 * person typed themselves (its value is not in the old résumé) is kept. Returns the fields written.
 */
export function followResumeFields(db, userId, oldText, newText) {
  const proposals = prefillFromResumeText(newText);
  db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
  const row = db.prepare("SELECT * FROM user_profile WHERE user_id = ?").get(userId) || {};
  const old = lower(oldText).replace(/\s+/g, " ");
  const written = [];
  for (const field of PREFILL_FIELDS) {
    if (!(field in row)) continue;
    const v = proposals[field]?.value;
    if (!v) continue;
    const cur = row[field] == null ? "" : String(row[field]).trim();
    const fromOld = cur && old && old.includes(lower(cur).replace(/\s+/g, " "));
    if (cur && !fromOld) continue;                 // typed by the person — kept
    if (cur === String(v)) continue;
    db.prepare(`UPDATE user_profile SET ${field} = ? WHERE user_id = ?`).run(String(v), userId);
    written.push(field);
  }
  recordFilled(db, userId, written);   // D186
  // The one-line location the fill also reads, kept in step with a city / state the résumé moved.
  if (written.includes("city") || written.includes("state")) {
    const r = db.prepare("SELECT city, state FROM user_profile WHERE user_id = ?").get(userId) || {};
    const loc = [r.city, r.state].filter(Boolean).join(", ");
    if (loc && "location" in row) db.prepare("UPDATE user_profile SET location = ? WHERE user_id = ?").run(loc, userId);
  }
  return written;
}
