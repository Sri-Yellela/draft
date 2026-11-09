// ── D101 · THE PROFILE IN SECTIONS, AND APPLICATION DEFAULTS (owner 10-30) ────────────────────
//
// One PERSON profile — summary, experience, education, skills, links, Application defaults — shared by all of the
// user's job profiles (each keeps its targeting and its base résumé DOCUMENT).
//
// ⛔ THE RULES THIS FILE HOLDS:
//   1. Editing the profile NEVER rewrites the uploaded base résumé (d101EditNeverRewritesBaseFile) — the profile is
//      the structured source; the document stays the document. Nothing here writes profile_base_resumes / base_resume.
//   2. Filled from D65's parse (services/payloadResume.js → services/applyGatePacket.js buildPacketEntries, the same
//      reading the packets use) on FIRST open; after a NEW base upload the difference is OFFERED ("Your résumé says X —
//      use it?"), never applied silently. `profile_sections.imported_basis` is the parse it was filled from.
//   3. Application defaults hold ONLY what the user SET: an absent row is "not set" — never a default pretending to be
//      an answer (d101UnsetDefaultIsNotAnAnswer; D72 found every user reading requires_sponsorship = 0). An answer given
//      in Needs you is saved back here (d101AnswerSavedBack, D96's lifecycle).
//   4. Saves are checked by the claim guard's date rules: dates in order, no end date in the future.
import { payloadResumeParse, parseBasis } from "./payloadResume.js";
import { buildPacketEntries, parseDateRange } from "./applyGatePacket.js";
import { companyKey, logoPath, RETRY_NONE_DAYS } from "./jobs/companyLogoStore.js";
import { readAutoSettings } from "../shared/autoSettings.js";
import { degreeKey } from "../shared/eligibility.js";
import { evidenceMap, evidenceKey, rekeyEvidence } from "./proofLinks.js";
import { markBacking } from "./resumeClaimGuard.js";
// ⛔ A140 (owner 11-08): a fictional sample résumé (the removed trial's) never fills or is offered as the person's profile.
import { activeTrialSampleId } from "./sampleResumes.js";

// ── Application defaults: the groups, the keys, what each accepts ─────────────────────────────
const YES_NO = ["yes", "no"];
export const DEFAULT_GROUPS = Object.freeze([
  { group: "work_authorisation", label: "Work authorisation", keys: [
    { key: "authorised_to_work", label: "Authorised to work in the US", values: YES_NO },
    { key: "sponsorship_now", label: "Needs sponsorship now", values: YES_NO },
    { key: "sponsorship_later", label: "Will need sponsorship later", values: YES_NO },
    { key: "citizenship", label: "Citizenship", text: true },
    { key: "clearance", label: "Security clearance", values: ["none", "confidential", "secret", "top_secret", "ts_sci", "can_obtain"] },
  ] },
  { group: "work_preferences", label: "Work preferences", keys: [
    { key: "in_person", label: "Can work in person", values: ["yes", "no", "hybrid_only"] },
    { key: "relocate", label: "Willing to relocate", values: YES_NO },
    { key: "start_date", label: "Earliest start date", text: true },
    { key: "transport", label: "Reliable transport", values: YES_NO },
  ] },
  { group: "background", label: "Background", keys: [
    { key: "government_ties", label: "Government employment or ties", values: YES_NO },
    { key: "criminal_history", label: "Criminal history disclosure", text: true },
  ] },
  { group: "eeo", label: "Voluntary self-ID", keys: [
    { key: "gender", label: "Gender", text: true },
    { key: "ethnicity", label: "Race / ethnicity", text: true },
    { key: "veteran", label: "Veteran status", text: true },
    { key: "disability", label: "Disability status", text: true },
  ] },
]);
const KEY_DEF = new Map(DEFAULT_GROUPS.flatMap(g => g.keys.map(k => [k.key, { ...k, group: g.group }])));
export const DEFAULT_SOURCES = Object.freeze(["user", "needs_you", "imported"]);

/** Validate one default. Returns the stored value or throws a 400. */
export function checkDefault(key, value) {
  const def = KEY_DEF.get(key);
  const fail = (m) => Object.assign(new Error(m), { status: 400, code: "bad_default" });
  if (!def) throw fail(`No application default called ${String(key).slice(0, 40)}.`);
  const v = String(value ?? "").trim();
  if (!v) throw fail(`${def.label}: clear it to leave it not set, rather than saving an empty answer.`);
  if (def.values && !def.values.includes(v)) throw fail(`${def.label} is one of: ${def.values.join(", ")}.`);
  if (v.length > 200) throw fail(`${def.label} is too long.`);
  return v;
}

/** Every key, grouped, each `set` or `not set` — an absent row is never shown as an answer. */
export function readDefaults(db, userId) {
  const rows = new Map(db.prepare(`SELECT key, value, source, set_at FROM application_defaults WHERE user_id = ?`).all(userId).map(r => [r.key, r]));
  return DEFAULT_GROUPS.map(g => ({
    group: g.group, label: g.label,
    items: g.keys.map(k => {
      const r = rows.get(k.key);
      return { key: k.key, label: k.label, ...(k.values ? { values: k.values } : { text: true }),
        set: !!r, value: r ? r.value : null, source: r?.source ?? null, setAt: r?.set_at ?? null };
    }),
  }));
}

/** The value the FILL may use for a key — null when not set (→ Needs you). */
export function defaultFor(db, userId, key) {
  return db.prepare(`SELECT value FROM application_defaults WHERE user_id = ? AND key = ?`).pluck().get(userId, key) ?? null;
}

/** Set or clear (value null) one default. `source` says where it came from. */
export function setDefault(db, userId, key, value, source = "user") {
  if (!DEFAULT_SOURCES.includes(source)) throw Object.assign(new Error("bad source"), { status: 400, code: "bad_source" });
  if (value === null) {
    if (!KEY_DEF.has(key)) throw Object.assign(new Error(`No application default called ${key}.`), { status: 400, code: "bad_default" });
    db.prepare(`DELETE FROM application_defaults WHERE user_id = ? AND key = ?`).run(userId, key);
    return null;
  }
  const v = checkDefault(key, value);
  db.prepare(`INSERT INTO application_defaults (user_id, key, value, source, set_at) VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, source = excluded.source, set_at = excluded.set_at`)
    .run(userId, key, v, source);
  return v;
}

/**
 * D96 → D101 P2 · an answer the user gave in Needs you is SAVED BACK here, so the next form does not ask again.
 * Only for a key the block has; anything else stays a saved answer (services/answerLifecycle.js).
 */
export function saveBackFromNeedsYou(db, userId, key, value) {
  if (!KEY_DEF.has(key)) return false;
  try { setDefault(db, userId, key, value, "needs_you"); return true; } catch { return false; }
}

// ── the sections ──────────────────────────────────────────────────────────────────────────────

const ym = (d) => (d?.year ? `${d.year}-${String(d.month || 1).padStart(2, "0")}` : null);
const YM = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

/** "Northwind — Software Engineer" with no separate title → company + title. The parse joins them on some résumés. */
export function splitCompanyTitle(company, title) {
  const c = String(company || "").trim();
  const t = String(title || "").trim();
  const looksLikeDate = /\b(19|20)\d{2}\b|present/i.test(t);
  const m = /^(.+?)\s+[—–|]\s+(.+)$/.exec(c) || /^(.+?)\s+-\s+(.+)$/.exec(c);
  if (m && (!t || looksLikeDate)) return { company: m[1].trim(), title: m[2].trim(), dateInTitle: looksLikeDate ? t : null };
  return { company: c, title: t || null, dateInTitle: null };
}

const ROLE_WORD = /\b(analyst|engineer|developer|programmer|manager|scientist|designer|consultant|specialist|associate|intern|director|lead|coordinator|administrator|architect|representative|executive|officer|assistant|technician|researcher|recruiter|accountant|strategist|writer|editor)\b/i;

/**
 * ⭐ A113 (agent, 11-03; found by 44i's warm-paths walk): "Data Analyst, Brightmart Retail — Bentonville, AR (2022 – 2025)"
 * is parsed at its first comma — company "Data Analyst", no title, location "Brightmart Retail — Bentonville, AR ()". When
 * there is no title, the "company" is a job title, and the location holds "Employer — Place", they are put back.
 * @returns {{ company, title, location } | null} null when the entry does not have that shape
 */
export function titleFirstHeader(company, title, location) {
  const c = String(company || "").trim(), loc = String(location || "").replace(/\(\s*\)/g, "").trim();
  if (String(title || "").trim() || !ROLE_WORD.test(c)) return null;
  const m = /^(.+?)\s+[—–|]\s+(.+)$/.exec(loc);
  if (!m || ROLE_WORD.test(m[1])) return null;
  return { company: m[1].trim(), title: c, location: m[2].trim() || null };
}

/** The profile as the résumé's parse reads it (nothing written). Null when there is no base résumé to read. */
export function profileFromResume(db, userId) {
  const payload = payloadResumeParse(db, { userId, resumeId: null });
  if (!payload?.source) return null;
  const profile = db.prepare(`SELECT * FROM user_profile WHERE user_id = ?`).get(userId) || {};
  const e = buildPacketEntries({ profile, payload });
  const summary = (payload.structured?.sections || []).find(s => s?.type === "summary")?.text?.trim() || null;
  const experience = (e.work || []).map(w => {
    const flipped = titleFirstHeader(w.company, w.title, w.location);
    const s = flipped ? { company: flipped.company, title: flipped.title, dateInTitle: null } : splitCompanyTitle(w.company, w.title);
    // The parse sometimes puts "Jan 2022 – Present | Boston, MA" where the title goes — its dates and place are read here.
    const r = !w.from && s.dateInTitle ? parseDateRange(s.dateInTitle.split("|")[0]) : null;
    const place = s.dateInTitle && s.dateInTitle.includes("|") ? s.dateInTitle.split("|").slice(1).join("|").trim() : null;
    const from = r ? r.from : w.from, to = r ? r.to : w.to, current = r ? r.current : !!w.current;
    return { company: s.company, title: s.title, location: (flipped ? flipped.location : w.location) || place || null,
      start: ym(from), end: current ? null : ym(to), current,
      bullets: String(w.description || "").split("\n").map(b => b.replace(/^•\s*/, "").trim()).filter(Boolean) };
  }).filter(x => x.company);
  return {
    basis: payload.ok ? payloadBasis(db, userId) : null,
    ok: payload.ok,
    summary,
    experience,
    education: (e.education || []).map(d => ({ school: d.school, degree: d.degree, field: d.field, start: ym(d.from), end: ym(d.to) })).filter(d => d.school),
    skills: (e.skills || []).map(n => ({ name: n, category: null })),
    links: (e.websites || []).map(w => ({ kind: w.kind, url: w.url })),
  };
}
function payloadBasis(db, userId) {
  const row = db.prepare(`SELECT pbr.content FROM profile_base_resumes pbr JOIN domain_profiles dp ON dp.id = pbr.profile_id
    WHERE pbr.user_id = ? AND dp.is_active = 1 AND TRIM(COALESCE(pbr.content, '')) != '' LIMIT 1`).get(userId)
    || db.prepare(`SELECT content FROM base_resume WHERE user_id = ?`).get(userId);
  return row ? parseBasis(row.content) : null;
}

function writeSections(db, userId, p, source) {
  db.transaction(() => {
    db.prepare(`INSERT INTO profile_sections (user_id, summary, imported_basis, updated_at) VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(user_id) DO UPDATE SET summary = excluded.summary, imported_basis = excluded.imported_basis, updated_at = unixepoch()`)
      .run(userId, p.summary, p.basis);
    for (const t of ["profile_experience", "profile_education", "profile_skills", "profile_links"]) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId);
    p.experience.forEach((x, i) => db.prepare(`INSERT INTO profile_experience (user_id, company, title, location, start_ym, end_ym, is_current, bullets_json, position, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.company, x.title, x.location, x.start, x.end, x.current ? 1 : 0, JSON.stringify(x.bullets || []), i, source));
    p.education.forEach((x, i) => db.prepare(`INSERT INTO profile_education (user_id, school, degree, field, start_ym, end_ym, position, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.school, x.degree, x.field, x.start, x.end, i, source));
    p.skills.forEach((x, i) => db.prepare(`INSERT INTO profile_skills (user_id, name, category, position, source) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, x.name, x.category, i, source));
    p.links.forEach((x, i) => db.prepare(`INSERT INTO profile_links (user_id, kind, url, position) VALUES (?, ?, ?, ?)`).run(userId, x.kind, x.url, i));
  })();
}

/** Import the defaults the profile already states EXPLICITLY (text the user typed) — never a 0/1 column's default. */
function importStatedDefaults(db, userId) {
  const p = db.prepare(`SELECT * FROM user_profile WHERE user_id = ?`).get(userId);
  if (!p) return;
  const has = (k) => db.prepare(`SELECT 1 FROM application_defaults WHERE user_id = ? AND key = ?`).get(userId, k);
  const put = (k, v) => { if (v != null && String(v).trim() && !has(k)) { try { setDefault(db, userId, k, String(v).trim(), "imported"); } catch {} } };
  for (const [k, col] of [["gender", "gender"], ["ethnicity", "ethnicity"], ["veteran", "veteran_status"], ["disability", "disability_status"],
    ["start_date", "available_start_date"]]) put(k, p[col]);
  // sponsorship_need (migration 086) is the explicit answer; requires_sponsorship is a 0 default and is NOT read.
  const need = String(p.sponsorship_need || "").toLowerCase();
  if (need === "none" || need === "no") { put("sponsorship_now", "no"); put("sponsorship_later", "no"); }
  if (need === "now" || need === "yes") put("sponsorship_now", "yes");
  if (need === "future" || need === "later") { put("sponsorship_now", "no"); put("sponsorship_later", "yes"); }
}

function readSections(db, userId) {
  const sec = db.prepare(`SELECT summary, imported_basis FROM profile_sections WHERE user_id = ?`).get(userId);
  const logoOf = (company) => {
    const key = companyKey(company);
    const ok = key && db.prepare(`SELECT 1 FROM company_logos WHERE company_key = ? AND status = 'ok' AND bytes IS NOT NULL`).get(key);
    // No logo → null, and the client draws a SQUARE initial tile (D60: no pills, no capsule circles).
    return ok ? logoPath(key) : null;
  };
  // D109 P1 / P2: each bullet's and project's evidence, and the claim guard's backed / unbacked mark on each bullet.
  const ev = evidenceMap(db, userId);
  const linksOf = (target, text) => ev.get(`${target}:${evidenceKey(text)}`) || [];
  let projects = [];
  try {
    projects = db.prepare(`SELECT id, name, description, source FROM profile_projects WHERE user_id = ? ORDER BY position, id`).all(userId)
      .map(r => { const evidence = linksOf("project", r.name); return { ...r, evidence, backed: evidence.length > 0 }; });
  } catch { projects = []; }
  return {
    summary: sec?.summary ?? null,
    importedBasis: sec?.imported_basis ?? null,
    experience: db.prepare(`SELECT * FROM profile_experience WHERE user_id = ? ORDER BY position, id`).all(userId).map(r => ({
      id: r.id, company: r.company, title: r.title, location: r.location, start: r.start_ym, end: r.end_ym, current: !!r.is_current,
      bullets: JSON.parse(r.bullets_json || "[]"), logo: logoOf(r.company), initial: r.company.trim().charAt(0).toUpperCase(), source: r.source }))
      .map(x => ({ ...x, evidence: x.bullets.map(b => linksOf("bullet", b)), marks: markBacking(x.bullets, b => linksOf("bullet", b).length) })),
    education: db.prepare(`SELECT * FROM profile_education WHERE user_id = ? ORDER BY position, id`).all(userId).map(r => ({
      id: r.id, school: r.school, degree: r.degree, field: r.field, start: r.start_ym, end: r.end_ym, source: r.source,
      // ⭐ A153 (45o, the D183 sketch): the school's logo from the same first-party store as an employer's (looked up by name).
      logo: logoOf(r.school), initial: String(r.school || "?").trim().charAt(0).toUpperCase() })),
    skills: db.prepare(`SELECT id, name, category, source FROM profile_skills WHERE user_id = ? ORDER BY position, id`).all(userId),
    links: db.prepare(`SELECT id, kind, url FROM profile_links WHERE user_id = ? ORDER BY position, id`).all(userId),
    projects,
  };
}

/**
 * D101 P1 · logos for the experience section. The store holds logos for companies that were ON THE BOARD; a past
 * employer from the résumé usually is not, so it would only ever show its initial. These are the profile's companies
 * with no logo yet (never looked up, or looked up and not found more than RETRY_NONE_DAYS ago) — the route looks them
 * up in the background with the same first-party store (services/jobs/companyLogoStore.js), never blocking the read.
 */
export function profileLogosToResolve(db, userId, nowSec = Math.floor(Date.now() / 1000), limit = 10) {
  const out = [];
  // A153 (45o): + the schools — the Education section draws their logos the same way.
  for (const company of db.prepare(`SELECT company FROM profile_experience WHERE user_id = ? UNION SELECT school FROM profile_education WHERE user_id = ? AND TRIM(COALESCE(school, '')) <> ''`).pluck().all(userId, userId)) {
    const key = companyKey(company);
    if (!key) continue;
    const row = db.prepare(`SELECT status, checked_at FROM company_logos WHERE company_key = ?`).get(key);
    if (!row || (row.status !== "ok" && nowSec - (row.checked_at || 0) > RETRY_NONE_DAYS * 86400)) out.push(company);
    if (out.length >= limit) break;
  }
  return out;
}

// ── D112 d2 (owner 10-30 night) · THE EDUCATION SECTION IS THE SOURCE OF THE DEGREE ────────────────
//
// Highest degree, field, school and year are DERIVED from the section's entries — the highest level wins (a PhD over a
// master's over a bachelor's over an associate's over high school; a tie goes to the later end date). The one per-profile
// exception is the Change override (user_profile.education_override, JSON), for a form that needs something else: each
// field it sets wins over the derived one. The forms (withEducation, below) and eligibility (services/jobEligibility.js)
// read ONLY this — the old Education block's columns (highest_degree / field_of_study / university / graduation_year)
// were moved into the section by migration 179 and are never read as an answer again.
const DEGREE_RANK = { phd: 5, masters: 4, bachelors: 3 };
export function degreeRank(text) {
  const k = degreeKey(text);
  if (k) return DEGREE_RANK[k];
  const t = String(text || "");
  if (/\b(associate|a\.?a\.?s?|a\.?s\.?)\b/i.test(t)) return 2;
  if (/\b(high school|secondary|ged|diploma)\b/i.test(t)) return 1;
  return t.trim() ? 0.5 : 0;
}

function readOverride(raw) {
  try {
    const o = typeof raw === "string" ? JSON.parse(raw) : null;
    if (!o || typeof o !== "object") return null;
    const out = {};
    for (const k of ["degree", "field", "school"]) if (o[k] != null && String(o[k]).trim()) out[k] = String(o[k]).trim();
    if (o.year != null && /^(19|20|21)\d{2}$/.test(String(o.year))) out.year = String(o.year);
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}

/**
 * The degree the forms and eligibility read: { degree, field, school, year, source: 'override'|'section'|null,
 * derived, override, available }. `available` is false on a database without the section (before 173) — the callers
 * then leave what they had unchanged rather than blanking it.
 */
export function educationOf(db, userId) {
  let rows;
  try { rows = db.prepare(`SELECT id, school, degree, field, end_ym FROM profile_education WHERE user_id = ? ORDER BY position, id`).all(userId); }
  catch { return { degree: null, field: null, school: null, year: null, source: null, derived: null, override: null, available: false }; }
  let best = null, bestRank = -1;
  for (const r of rows) {
    const k = degreeRank(r.degree);
    if (k > bestRank || (k === bestRank && String(r.end_ym || "") > String(best.end_ym || ""))) { best = r; bestRank = k; }
  }
  const derived = best ? { degree: best.degree || null, field: best.field || null, school: best.school || null,
    year: best.end_ym ? String(best.end_ym).slice(0, 4) : null, entryId: best.id } : null;
  let override = null;
  try { override = readOverride(db.prepare(`SELECT education_override FROM user_profile WHERE user_id = ?`).pluck().get(userId)); } catch { override = null; }
  const pick = (k) => override?.[k] ?? derived?.[k] ?? null;
  return { degree: pick("degree"), field: pick("field"), school: pick("school"), year: pick("year"),
    source: override ? "override" : derived ? "section" : null, derived, override, available: true };
}

/** The Change override: { degree, field, school, year } — empty (or null) clears it, and the section speaks again. */
export function setEducationOverride(db, userId, body) {
  const fail = (m) => Object.assign(new Error(m), { status: 400, code: "bad_override" });
  const o = {};
  for (const k of ["degree", "field", "school"]) {
    const v = str(body?.[k], 160);
    if (v) o[k] = v;
  }
  const y = str(body?.year, 4);
  if (y) { if (!/^(19|20|21)\d{2}$/.test(y)) throw fail("The year is written YYYY."); o.year = y; }
  db.prepare("INSERT OR IGNORE INTO user_profile (user_id) VALUES (?)").run(userId);
  db.prepare(`UPDATE user_profile SET education_override = ? WHERE user_id = ?`).run(Object.keys(o).length ? JSON.stringify(o) : null, userId);
  return Object.keys(o).length ? o : null;
}

/** The section's entries in the packet's shape (applyGatePacket.js buildPacketEntries). null before 173. */
export function educationEntries(db, userId) {
  let rows;
  try { rows = db.prepare(`SELECT school, degree, field, start_ym, end_ym FROM profile_education WHERE user_id = ? ORDER BY position, id`).all(userId); }
  catch { return null; }
  const my = (v) => (v && /^\d{4}-\d{2}$/.test(v) ? { month: Number(v.slice(5, 7)), year: Number(v.slice(0, 4)) } : null);
  return rows.map(r => ({ school: r.school || null, degree: r.degree || null, field: r.field || null, gpa: null,
    from: my(r.start_ym), to: my(r.end_ym), source: "profile" }));
}

/** The autofill payload's degree fields — ONLY the derived value or the override (blank when neither). */
export function withEducation(db, userId, payload) {
  if (!payload || userId == null) return payload;
  const e = educationOf(db, userId);
  if (!e.available) return payload;
  const fm = { ...(payload.field_map || {}) }, hm = { ...(payload.handler_map || {}) };
  fm.highest_degree = e.degree || ""; fm.field_of_study = e.field || ""; fm.university = e.school || ""; fm.graduation_year = e.year || "";
  hm.degree = e.degree || ""; hm["field-of-study"] = e.field || ""; hm.school = e.school || ""; hm["grad-year"] = e.year || "";
  return { ...payload, field_map: fm, handler_map: hm };
}

/** The ten sections the header counts ("7 of 10 sections"), each done or not. */
function completeness(db, userId, s, defaults) {
  const contact = db.prepare(`SELECT email, phone, COALESCE(full_name, first_name) AS name FROM user_profile WHERE user_id = ?`).get(userId) || {};
  const groupDone = (g) => defaults.find(x => x.group === g)?.items.some(i => i.set) || false;
  const done = {
    contact: !!(contact.email && contact.name), summary: !!s.summary, experience: s.experience.length > 0,
    education: s.education.length > 0, skills: s.skills.length > 0, links: s.links.length > 0,
    work_authorisation: groupDone("work_authorisation"), work_preferences: groupDone("work_preferences"),
    background: groupDone("background"), eeo: groupDone("eeo"),
  };
  return { done: Object.values(done).filter(Boolean).length, of: 10, sections: done };
}

/**
 * The profile page's read. On FIRST open (nothing stored yet) it is filled from the résumé's parse (rule 2). After a
 * new base upload, `suggestion` carries the parse to OFFER — the stored sections are not changed.
 */
export function readProfile(db, userId) {
  let s = readSections(db, userId);
  const firstOpen = !db.prepare(`SELECT 1 FROM profile_sections WHERE user_id = ?`).get(userId);
  let suggestion = null;
  const sample = !!activeTrialSampleId(db, userId);   // ⛔ A140: a TRIAL sample is not the person (D184's test set is)
  if (firstOpen) {
    const parsed = sample ? null : profileFromResume(db, userId);
    if (parsed?.ok) writeSections(db, userId, parsed, "resume");
    else db.prepare(`INSERT OR IGNORE INTO profile_sections (user_id) VALUES (?)`).run(userId);
    importStatedDefaults(db, userId);
    s = readSections(db, userId);
  } else {
    const basis = payloadBasis(db, userId);
    if (!sample && basis && basis !== s.importedBasis) {
      const parsed = profileFromResume(db, userId);
      if (parsed?.ok) suggestion = { basis, summary: parsed.summary, experience: parsed.experience, education: parsed.education,
        skills: parsed.skills, links: parsed.links };
    }
  }
  const defaults = readDefaults(db, userId);
  const e = educationOf(db, userId);
  return { sections: s, defaults, completeness: completeness(db, userId, s, defaults), suggestion,
    education: { degree: e.degree, field: e.field, school: e.school, year: e.year, source: e.source, derived: e.derived, override: e.override } };
}

/** "Your résumé says X — use it?" — one press replaces the sections with the new parse. */
export function useResumeSuggestion(db, userId) {
  if (activeTrialSampleId(db, userId)) return false;   // ⛔ A140 (trial samples only)
  const parsed = profileFromResume(db, userId);
  if (!parsed?.ok) return false;
  writeSections(db, userId, parsed, "resume");
  return true;
}

// ── saving a section (the drawer's Save) ───────────────────────────────────────────────────────

function nowYm(nowSec) { const d = new Date(nowSec * 1000); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; }
function checkDates(x, label, nowSec) {
  const fail = (m) => Object.assign(new Error(m), { status: 400, code: "bad_dates" });
  for (const k of ["start", "end"]) if (x[k] != null && !YM.test(String(x[k]))) throw fail(`${label}: dates are written YYYY-MM.`);
  if (x.start && x.end && x.end < x.start) throw fail(`${label}: the end is before the start.`);
  if (x.end && x.end > nowYm(nowSec)) throw fail(`${label}: an end date cannot be in the future — mark it current instead.`);
  if (x.start && x.start > nowYm(nowSec)) throw fail(`${label}: the start date is in the future.`);
}
const str = (v, n = 300) => (v == null || String(v).trim() === "" ? null : String(v).trim().slice(0, n));

/** Replace one section with what the drawer sent. Validated whole; nothing half-stored. */
// ⭐ D183 P2 · HAND EDITS ARE MARKED, PER ITEM. The editors save a whole list, so a save used to mark EVERY item 'user'.
// Now an item saved exactly as it was keeps its source (a résumé item stays 'resume'); only an added or changed item
// becomes 'user' — the mark a résumé replace reads to keep the person's own work (services/profileReplace.js).
const sig = (o) => JSON.stringify(o);
function keptSource(beforeRows, toSig) {
  const pool = new Map();
  for (const r of beforeRows) { const k = toSig(r); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(r.source || "resume"); }
  return (item) => { const k = toSig(item); const q = pool.get(k); return q && q.length ? q.shift() : "user"; };
}

export function saveSection(db, userId, section, body, nowSec = Math.floor(Date.now() / 1000)) {
  const fail = (m) => Object.assign(new Error(m), { status: 400, code: "bad_section" });
  const list = (v) => { if (!Array.isArray(v) || v.length > 60) throw fail("A section is a list of up to 60 items."); return v; };
  db.prepare(`INSERT OR IGNORE INTO profile_sections (user_id) VALUES (?)`).run(userId);
  if (section === "summary") {
    const t = str(body?.summary, 3000);
    const was = db.prepare(`SELECT summary FROM profile_sections WHERE user_id = ?`).pluck().get(userId);
    db.prepare(`UPDATE profile_sections SET summary = ?, updated_at = unixepoch() WHERE user_id = ?`).run(t, userId);
    // D183 P2: a summary the person changed is theirs — a résumé replace keeps it (migration 244; absent before it).
    if ((was ?? null) !== (t ?? null)) { try { db.prepare(`UPDATE profile_sections SET summary_source = 'user' WHERE user_id = ?`).run(userId); } catch { /* before 244 */ } }
    return;
  }
  if (section === "experience") {
    const items = list(body?.items).map((x, i) => {
      const it = { company: str(x?.company), title: str(x?.title), location: str(x?.location), start: str(x?.start, 7), end: x?.current ? null : str(x?.end, 7),
        current: !!x?.current, bullets: (Array.isArray(x?.bullets) ? x.bullets : []).map(b => str(b, 600)).filter(Boolean).slice(0, 20) };
      if (!it.company) throw fail(`Experience ${i + 1}: the company is required.`);
      checkDates(it, `Experience ${i + 1}`, nowSec);
      return it;
    });
    // D109: the bullets before and after, flattened in order — an edited bullet keeps its evidence, a removed one loses it.
    const slots = (company, bullets) => bullets.map((text, j) => ({ slot: `${String(company || "").trim().toLowerCase()}#${j}`, text }));
    const before = db.prepare(`SELECT company, bullets_json FROM profile_experience WHERE user_id = ? ORDER BY position, id`).all(userId)
      .flatMap(r => { let b = []; try { b = JSON.parse(r.bullets_json || "[]"); } catch { b = []; } return slots(r.company, b); });
    const srcOf = keptSource(db.prepare(`SELECT * FROM profile_experience WHERE user_id = ? ORDER BY position, id`).all(userId)
      .map(r => ({ company: r.company, title: r.title, location: r.location, start: r.start_ym, end: r.end_ym, current: !!r.is_current, bullets: JSON.parse(r.bullets_json || "[]"), source: r.source })),
      (x) => sig([x.company, x.title, x.location, x.start, x.current ? null : x.end, !!x.current, x.bullets]));
    db.transaction(() => {
      rekeyEvidence(db, userId, "bullet", before, items.flatMap(x => slots(x.company, x.bullets)));
      db.prepare(`DELETE FROM profile_experience WHERE user_id = ?`).run(userId);
      items.forEach((x, i) => db.prepare(`INSERT INTO profile_experience (user_id, company, title, location, start_ym, end_ym, is_current, bullets_json, position, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, x.company, x.title, x.location, x.start, x.end, x.current ? 1 : 0, JSON.stringify(x.bullets), i, srcOf(x)));
    })();
    return;
  }
  if (section === "education") {
    const items = list(body?.items).map((x, i) => {
      const it = { school: str(x?.school), degree: str(x?.degree), field: str(x?.field), start: str(x?.start, 7), end: str(x?.end, 7) };
      if (!it.school) throw fail(`Education ${i + 1}: the school is required.`);
      checkDates(it, `Education ${i + 1}`, nowSec);
      return it;
    });
    const srcOf = keptSource(db.prepare(`SELECT school, degree, field, start_ym AS start, end_ym AS end, source FROM profile_education WHERE user_id = ? ORDER BY position, id`).all(userId),
      (x) => sig([x.school, x.degree, x.field, x.start, x.end]));
    db.transaction(() => {
      db.prepare(`DELETE FROM profile_education WHERE user_id = ?`).run(userId);
      items.forEach((x, i) => db.prepare(`INSERT INTO profile_education (user_id, school, degree, field, start_ym, end_ym, position, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, x.school, x.degree, x.field, x.start, x.end, i, srcOf(x)));
    })();
    return;
  }
  if (section === "skills") {
    const items = list(body?.items).map(x => ({ name: str(typeof x === "string" ? x : x?.name, 60), category: str(x?.category, 60) })).filter(x => x.name);
    const srcOf = keptSource(db.prepare(`SELECT name, category, source FROM profile_skills WHERE user_id = ? ORDER BY position, id`).all(userId),
      (x) => sig([String(x.name || "").toLowerCase(), x.category || null]));
    db.transaction(() => {
      db.prepare(`DELETE FROM profile_skills WHERE user_id = ?`).run(userId);
      items.forEach((x, i) => db.prepare(`INSERT INTO profile_skills (user_id, name, category, position, source) VALUES (?, ?, ?, ?, ?)`).run(userId, x.name, x.category, i, srcOf(x)));
    })();
    return;
  }
  if (section === "links") {
    const items = list(body?.items).map((x, i) => {
      const url = str(x?.url, 500);
      if (!url || !/^https?:\/\/[^\s]+$/i.test(url)) throw fail(`Link ${i + 1}: a full https:// address.`);
      return { kind: str(x?.kind, 30) || "website", url };
    });
    // D183 P2: a link keeps its source when saved unchanged (migration 244's column; a database before it has none).
    const hasSrc = !!db.prepare(`SELECT 1 FROM pragma_table_info('profile_links') WHERE name = 'source'`).get();
    const srcOf = hasSrc ? keptSource(db.prepare(`SELECT kind, url, source FROM profile_links WHERE user_id = ? ORDER BY position, id`).all(userId),
      (x) => sig([x.kind, x.url])) : null;
    db.transaction(() => {
      db.prepare(`DELETE FROM profile_links WHERE user_id = ?`).run(userId);
      items.forEach((x, i) => (hasSrc
        ? db.prepare(`INSERT INTO profile_links (user_id, kind, url, position, source) VALUES (?, ?, ?, ?, ?)`).run(userId, x.kind, x.url, i, srcOf(x))
        : db.prepare(`INSERT INTO profile_links (user_id, kind, url, position) VALUES (?, ?, ?, ?)`).run(userId, x.kind, x.url, i)));
    })();
    return;
  }
  if (section === "projects") {
    // D109 P1: a project is a name and a short description; its evidence is linked separately (PUT /api/profile/evidence).
    const items = list(body?.items).map((x, i) => {
      const it = { name: str(x?.name, 120), description: str(x?.description, 1000) };
      if (!it.name) throw fail(`Project ${i + 1}: the name is required.`);
      return it;
    });
    const keys = items.map(x => evidenceKey(x.name));
    if (new Set(keys).size !== keys.length) throw fail("Two projects have the same name — each needs its own.");
    const before = db.prepare(`SELECT name FROM profile_projects WHERE user_id = ? ORDER BY position, id`).pluck().all(userId)
      .map((text, i) => ({ slot: String(i), text }));
    const srcOf = keptSource(db.prepare(`SELECT name, description, source FROM profile_projects WHERE user_id = ? ORDER BY position, id`).all(userId),
      (x) => sig([x.name, x.description || null]));
    db.transaction(() => {
      rekeyEvidence(db, userId, "project", before, items.map((x, i) => ({ slot: String(i), text: x.name })));
      db.prepare(`DELETE FROM profile_projects WHERE user_id = ?`).run(userId);
      items.forEach((x, i) => db.prepare(`INSERT INTO profile_projects (user_id, name, description, position, source) VALUES (?, ?, ?, ?, ?)`)
        .run(userId, x.name, x.description, i, srcOf(x)));
    })();
    return;
  }
  throw fail(`No section called ${String(section).slice(0, 30)}.`);
}

// ── D101 P2 / D104 · THE FILL READS ONLY APPLICATION DEFAULTS FOR THESE QUESTIONS ─────────────────
//
// server.js buildAutofillPayload reads user_profile, whose eligibility columns default to 0 — `requires_sponsorship`
// filled "No", `willing_to_relocate` "No", for users who never answered (D72). This overlay REPLACES every eligibility,
// preference and self-ID value in the payload with what the user SET in Application defaults, and an empty value where
// they did not — so the question goes to Needs you, and the answer given there is saved back (D96 / saveBackFromNeedsYou).
// Explicit text the profile already states is imported first (importStatedDefaults: EEO text, start date, the
// sponsorship tri-state) — never a 0/1 column's default. A database before migration 173 gets the payload unchanged.
const CLEARANCE_WORDS = { confidential: "Confidential", secret: "Secret", top_secret: "Top Secret", ts_sci: "TS/SCI" };

export function withApplicationDefaults(db, userId, payload) {
  if (!payload || userId == null) return payload;
  // D112 d2: the degree fields are the Education section's derived value (or the Change override), never the old block.
  payload = withEducation(db, userId, payload);
  let d;
  try {
    importStatedDefaults(db, userId);
    d = Object.fromEntries(db.prepare(`SELECT key, value FROM application_defaults WHERE user_id = ?`).all(userId).map(r => [r.key, r.value]));
  } catch { return payload; }
  const yn = (v) => (v === "yes" ? "Yes" : v === "no" ? "No" : "");
  const fm = { ...(payload.field_map || {}) }, hm = { ...(payload.handler_map || {}) }, dm = { ...(payload.dropdown_map || {}) };
  // Work authorisation
  const auth = yn(d.authorised_to_work);
  fm.work_authorization = auth; fm.workAuthorization = auth; hm["work-auth"] = auth; dm.work_auth = auth ? [auth] : [];
  // Sponsorship — the tri-state the resolver answers from; unknown is null (it refuses and asks).
  const need = d.sponsorship_now === "yes" ? "now"
    : d.sponsorship_now === "no" && d.sponsorship_later === "yes" ? "future"
    : d.sponsorship_now === "no" && d.sponsorship_later === "no" ? "none" : null;
  const sp = need === "none" ? "No" : need ? "Yes" : "";
  fm.requires_sponsorship = sp; fm.sponsorship = sp; hm.sponsorship = sp;
  // Clearance — "can obtain" is not "holds one", and "none" is an answer only because the user SET it.
  const c = d.clearance ?? null;
  const has = c == null || c === "can_obtain" ? "" : c === "none" ? "No" : "Yes";
  const level = CLEARANCE_WORDS[c] || "";
  fm.has_clearance = has; fm.clearance_level = level; fm.clearanceLevel = level; dm.clearance = level ? [level] : [];
  // Preferences
  const relocate = yn(d.relocate);
  fm.willing_to_relocate = relocate; hm.relocate = relocate;
  fm.available_start_date = d.start_date || ""; hm["start-date"] = d.start_date || "";
  // Voluntary self-ID — stated or blank (D55 §7.5)
  for (const [key, fields, handler] of [["gender", ["gender"], "gender"], ["ethnicity", ["ethnicity", "race"], "ethnicity"],
    ["veteran", ["veteran_status", "veteranStatus"], "veteran"], ["disability", ["disability_status", "disabilityStatus"], "disability"]]) {
    const v = d[key] || "";
    for (const f of fields) fm[f] = v;
    hm[handler] = v;
  }
  dm.gender = d.gender ? [d.gender] : [];
  // ⭐ 10-30: the user's own standing instruction to tick a portal's terms box (Auto settings) — buildAnswers reads it.
  let agree = false;
  try { agree = readAutoSettings(db.prepare("SELECT auto_settings FROM users WHERE id = ?").pluck().get(userId)).agreeToTerms === true; } catch { agree = false; }
  return {
    ...payload,
    agree_to_terms: agree,
    sponsorship_need: need,
    requires_sponsorship: need === "now" || need === "future",
    has_clearance: has === "Yes",
    clearance_level: level,
    work_auth: auth,
    field_map: fm, handler_map: hm, dropdown_map: dm,
  };
}

// ── D101 P2 · which Application default a QUESTION is — for saving a Needs-you answer back ──────────
// Conservative: only questions that name ONE key unambiguously. "Now or in the future" sponsorship names two tenses in
// one answer and is NOT mapped (the tri-state needs both); citizenship is free text and is not mapped from a Yes / No.
const QUESTION_KEYS = [
  [/\bauthori[sz]ed to work\b/i, "authorised_to_work", "yesno"],
  [/\b(?:currently|now)\b[^?]*\brequire\b[^?]*\bsponsor/i, "sponsorship_now", "yesno", /\bfuture\b/i],
  [/\brelocat/i, "relocate", "yesno"],
  [/\b(?:earliest )?start date\b|\bavailable to start\b/i, "start_date", "text"],
  [/\bgender\b/i, "gender", "text"],
  [/\brace\b|\bethnicit/i, "ethnicity", "text"],
  [/\bveteran\b/i, "veteran", "text"],
  [/\bdisabilit/i, "disability", "text"],
];
export function defaultKeyForQuestion(question, answer) {
  const q = String(question || "");
  for (const [re, key, kind, unless] of QUESTION_KEYS) {
    if (!re.test(q) || (unless && unless.test(q))) continue;
    if (kind === "text") return { key, value: String(answer ?? "").trim() || null };
    const a = String(answer ?? "").trim().toLowerCase();
    const v = /^(yes|y|true)\b/.test(a) ? "yes" : /^(no|n|false)\b/.test(a) ? "no" : null;
    return v ? { key, value: v } : null;
  }
  return null;
}
