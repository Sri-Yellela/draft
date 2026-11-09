// services/placement.js — ⭐ FIRST PRIORITY (B)-1 (45o, owner 11-08) · ONE PLACEMENT, ONE SOURCE.
//
// The spec: "the résumé is classified with D179's taxonomy (category → subcategory + level + one also fits), and that
// placement writes the job profile's role — D101's role registry maps onto taxonomy ids (one table, kept in roles-v1.json),
// so the profile's Fits … line and the job profile can never disagree; the classifier's confidence is kept (below the line →
// 'we couldn't place you — pick your role', never a guess)."
//
//   placeText(text, { titles, years })  — PURE over the taxonomy: { placed, category, subcategory, level, also, confidence,
//                                        registryKey } — `placed` false (and no ids) below PLACE_MIN_CONFIDENCE.
//   writePlacement(db, profileId, p, registry) — the job profile's placement columns (migration 255) AND its role:
//                                        domain = the registry key, role_family = that key's family. Below the line only
//                                        the confidence is written (the role is left as it was, and the page asks).
//   storedPlacement(db, userId)        — the ACTIVE job profile's placement, the one the profile page shows.
import { taxonomy, classifyPosting } from "./jobs/taxonomyClassify.js";
import { seniorityOf, yearsOfWork } from "./resumeOnboarding.js";

export const PLACE_MIN_CONFIDENCE = 0.45;   // at least the category named in a title (taxonomyClassify: 0.45 category-name)
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const plain = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** The registry key for a placement: the subcategory's own entry, else its category's. null when the map has neither. Pure. */
export function registryKeyFor(category, subcategory, tax = safe(() => taxonomy(), null)) {
  const map = tax?.registryMap || safe(() => taxonomy().registryMap, null);
  if (!map) return null;
  return (subcategory && map.subcategories?.[subcategory]) || (category && map.categories?.[category]) || null;
}

// ⭐ D184 S-1 (45p): the résumé's OWN job titles — "Software Engineer II, Frontend — Toast" → "Software Engineer II, Frontend".
// Before, only the role registry's suggested titles FOUND in the text were classified ("Software Engineer"), so a frontend
// engineer was placed in "Software engineering · general". Most recent first (the résumé's order).
const ROLE_WORD = /\b(engineer|developer|manager|analyst|designer|scientist|director|lead|specialist|consultant|associate|coordinator|architect|administrator|officer|accountant|technician|nurse|teacher|recruiter|researcher|superintendent|estimator|planner|controller|intern|head|vp|president|product owner|strategist|writer|editor)\b/i;
const SECTION = /^\s*(experience|work experience|professional experience|employment|work history)\s*$/i;
const OTHER_SECTION = /^\s*(education|skills|projects|certifications?|summary|publications|awards|volunteer\w*|interests|languages)\s*$/i;
export function ownTitles(text, max = 4) {
  const out = [];
  let inExp = false;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (SECTION.test(line)) { inExp = true; continue; }
    if (OTHER_SECTION.test(line)) { inExp = false; continue; }
    if (!inExp || /^[•\-*]/.test(line)) continue;
    const m = /^(.+?)\s+[—–]\s+(.+)$/.exec(line) || /^(.+?)\s+at\s+([A-Z].+)$/.exec(line);
    if (!m) continue;
    const title = ROLE_WORD.test(m[1]) ? m[1] : ROLE_WORD.test(m[2]) ? m[2] : null;
    if (title && !out.includes(title.trim())) out.push(title.trim());
    if (out.length >= max) break;
  }
  return out;
}

/** Classify a résumé: its OWN titles first, then the given ones (each once), the text as their context. Pure over the taxonomy. */
export function placeText(text, { titles = [], years = null } = {}, tax = safe(() => taxonomy(), null)) {
  if (!tax) return { placed: false, confidence: 0, reason: "no_taxonomy" };
  const desc = plain(text).slice(0, 6000);
  const own = ownTitles(text);
  if (years == null) years = safe(() => yearsOfWork(text), null);   // D184: Daniel's 7 years were never passed → "mid"
  const seen = [];
  for (const t of [...own, ...titles].map(x => String(x || "").trim()).filter(Boolean)) {
    const r = safe(() => classifyPosting({ title: t, description: desc }, tax), null);
    if (r?.category && !seen.some(x => x.subcategory === r.subcategory)) seen.push(r);
    if (seen.length >= 2) break;
  }
  // D184: the person's LATEST own title leads when it places on its own (a frontend engineer's "Software Engineer II,
  // Frontend" over an older "Associate Software Engineer"); otherwise the most confident reading.
  const latest = own.length ? safe(() => classifyPosting({ title: own[0], description: desc }, tax), null) : null;
  // A latest title that only reaches its category's GENERAL bucket ("Project Manager") gives way to a specific reading in
  // the same category ("Construction Project Manager" from the text).
  const isGeneral = (r) => !!r && tax.byId?.get?.(r.category)?.general === r.subcategory;
  let best = (latest?.category && latest.confidence >= PLACE_MIN_CONFIDENCE ? seen.find(x => x.subcategory === latest.subcategory) : null)
    || seen.sort((a, b) => b.confidence - a.confidence)[0] || null;
  if (isGeneral(best)) best = seen.find(x => x.category === best.category && !isGeneral(x)) || best;
  // D184: the level's words are read from the person's OWN latest title when there is one — "dashboards for the CFO" in a
  // bullet made an FP&A analyst "executive".
  const level = safe(() => seniorityOf(own.length ? own[0] : text, years), null);
  if (!best || best.confidence < PLACE_MIN_CONFIDENCE) {
    return { placed: false, confidence: best ? best.confidence : 0, level, reason: best ? best.reason : "no_title" };
  }
  const also = seen.find(x => x !== best && x.subcategory && x.subcategory !== best.subcategory) || null;
  return {
    placed: true, category: best.category, subcategory: best.subcategory, level, confidence: best.confidence,
    also: also ? { category: also.category, subcategory: also.subcategory } : null,
    registryKey: registryKeyFor(best.category, best.subcategory, tax), reason: best.reason,
  };
}

/** Write a placement onto ONE job profile (B-4: only the profile whose résumé changed). Returns { before, after }. */
export function writePlacement(db, profileId, p, registry = {}) {
  const before = db.prepare(`SELECT domain, role_family, seniority, placement_category, placement_subcategory, placement_level, placement_confidence
      FROM domain_profiles WHERE id = ?`).get(profileId);
  if (!before) return null;
  if (!p?.placed) {
    db.prepare(`UPDATE domain_profiles SET placement_confidence = ?, placed_at = unixepoch() WHERE id = ?`).run(p?.confidence ?? 0, profileId);
    return { before, after: { ...before, placement_confidence: p?.confidence ?? 0 }, placed: false };
  }
  const key = p.registryKey && registry[p.registryKey] ? p.registryKey : before.domain;
  const fam = registry[key]?.roleFamily || before.role_family;
  db.prepare(`UPDATE domain_profiles SET domain = ?, role_family = ?, seniority = COALESCE(?, seniority),
      placement_category = ?, placement_subcategory = ?, placement_level = ?, placement_also = ?, placement_confidence = ?, placed_at = unixepoch()
      WHERE id = ?`).run(key, fam, p.level || null, p.category, p.subcategory, p.level || null, p.also ? JSON.stringify(p.also) : null, p.confidence, profileId);
  const after = db.prepare(`SELECT domain, role_family, seniority, placement_category, placement_subcategory, placement_level, placement_confidence
      FROM domain_profiles WHERE id = ?`).get(profileId);
  return { before, after, placed: true };
}

/** The active job profile's placement (names from the taxonomy), or null. `asks` when it couldn't be placed. */
export function storedPlacement(db, userId, tax = safe(() => taxonomy(), null)) {
  const r = safe(() => db.prepare(`SELECT placement_category, placement_subcategory, placement_level, placement_also, placement_confidence, placed_at
      FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`).get(userId), null);
  if (!r || r.placed_at == null) return null;
  if (!r.placement_category) return { asks: true, confidence: r.placement_confidence ?? 0 };
  const cat = tax?.byId?.get(r.placement_category) || null;
  const sub = cat?.subs?.find(s => s.id === r.placement_subcategory) || null;
  const also = safe(() => JSON.parse(r.placement_also || "null"), null);
  const alsoSub = also ? tax?.byId?.get(also.category)?.subs?.find(s => s.id === also.subcategory) : null;
  return {
    asks: false, category: r.placement_category, categoryName: cat?.name || null, subcategory: r.placement_subcategory, subName: sub?.name || null,
    level: r.placement_level || null, confidence: r.placement_confidence,
    also: alsoSub ? { subcategory: also.subcategory, subName: alsoSub.name } : null,
  };
}

/** ⭐ (B)-1 · the person's own pick when the résumé couldn't be placed (or they disagree): a placement at confidence 1, written
 *  to the ACTIVE job profile through the same map. A subcategory that isn't in the taxonomy (or is held) is refused. */
export function pickPlacement(db, userId, subcategory, registry = {}, tax = safe(() => taxonomy(), null)) {
  const cat = tax?.categories?.find(c => !c.held && c.subs.some(s => s.id === subcategory));
  if (!cat) throw Object.assign(new Error("Pick a role from the list."), { status: 400, code: "bad_role" });
  const prof = db.prepare(`SELECT id, seniority FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`).get(userId);
  if (!prof) throw Object.assign(new Error("Add your résumé first."), { status: 409, code: "no_job_profile" });
  const p = { placed: true, category: cat.id, subcategory, level: prof.seniority || null, confidence: 1, also: null, registryKey: registryKeyFor(cat.id, subcategory, tax) };
  return writePlacement(db, prof.id, p, registry);
}

// ── ⭐ (B)-3 (45o) · Apply for me never jumps family silently ──────────────────────────────────────────────────────────
/** Did the placement move FAMILY (the category)? A level-only or within-category move is not one. A first placement isn't. Pure. */
export const familyMoved = (before, after) => !!(before?.placement_category && after?.placement_category && before.placement_category !== after.placement_category);

/** After a replace: pause Apply for me on THIS profile when the family moved and the person uses Apply for me (semi never sends,
 *  so it just follows). Keeps where it came from. Returns { paused, from, to } or { paused: false }. */
export function pauseOnFamilyMove(db, userId, profileId, before) {
  const after = db.prepare(`SELECT domain, role_family, placement_category, placement_subcategory, placement_level FROM domain_profiles WHERE id = ? AND user_id = ?`).get(profileId, userId);
  if (!familyMoved(before, after)) return { paused: false };
  const mode = safe(() => db.prepare(`SELECT send_mode FROM users WHERE id = ?`).pluck().get(userId), null);
  if (mode !== "auto") return { paused: false, moved: true };
  const from = { domain: before.domain, role_family: before.role_family, placement_category: before.placement_category,
    placement_subcategory: before.placement_subcategory ?? null, placement_level: before.placement_level ?? null,
    placement_also: before.placement_also ?? null, placement_confidence: before.placement_confidence ?? null };
  db.prepare(`UPDATE domain_profiles SET apply_paused_at = unixepoch(), apply_paused_from = ? WHERE id = ?`).run(JSON.stringify(from), profileId);
  return { paused: true, moved: true, from, to: after };
}

/** Is Apply for me paused for the person's ACTIVE profile (the one the scheduler runs on)? */
export function applyPausedForFamily(db, userId) {
  return !!safe(() => db.prepare(`SELECT apply_paused_at FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`).pluck().get(userId), null);
}

/** Keep: Apply for me follows the new family. Change back: the profile's role and placement go back to where they were. */
export function answerFamilyMove(db, userId, keep) {
  const p = db.prepare(`SELECT id, apply_paused_at, apply_paused_from FROM domain_profiles WHERE user_id = ? AND is_active = 1 LIMIT 1`).get(userId);
  if (!p?.apply_paused_at) throw Object.assign(new Error("Nothing is waiting for your answer."), { status: 404, code: "not_paused" });
  if (!keep) {
    const f = safe(() => JSON.parse(p.apply_paused_from || "null"), null);
    if (f) db.prepare(`UPDATE domain_profiles SET domain = ?, role_family = ?, placement_category = ?, placement_subcategory = ?, placement_level = ?,
        placement_also = ?, placement_confidence = ?, placed_at = unixepoch() WHERE id = ?`)
      .run(f.domain, f.role_family, f.placement_category, f.placement_subcategory, f.placement_level, f.placement_also, f.placement_confidence, p.id);
  }
  db.prepare(`UPDATE domain_profiles SET apply_paused_at = NULL, apply_paused_from = NULL WHERE id = ?`).run(p.id);
  return { profileId: p.id, kept: !!keep };
}
