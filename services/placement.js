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
import { seniorityOf } from "./resumeOnboarding.js";

export const PLACE_MIN_CONFIDENCE = 0.45;   // at least the category named in a title (taxonomyClassify: 0.45 category-name)
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
const plain = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** The registry key for a placement: the subcategory's own entry, else its category's. null when the map has neither. Pure. */
export function registryKeyFor(category, subcategory, tax = safe(() => taxonomy(), null)) {
  const map = tax?.registryMap || safe(() => taxonomy().registryMap, null);
  if (!map) return null;
  return (subcategory && map.subcategories?.[subcategory]) || (category && map.categories?.[category]) || null;
}

/** Classify a résumé: its titles first (each once), the text as their context. Pure over the taxonomy. */
export function placeText(text, { titles = [], years = null } = {}, tax = safe(() => taxonomy(), null)) {
  if (!tax) return { placed: false, confidence: 0, reason: "no_taxonomy" };
  const desc = plain(text).slice(0, 6000);
  const seen = [];
  for (const t of titles.map(x => String(x || "").trim()).filter(Boolean)) {
    const r = safe(() => classifyPosting({ title: t, description: desc }, tax), null);
    if (r?.category && !seen.some(x => x.subcategory === r.subcategory)) seen.push(r);
    if (seen.length >= 2) break;
  }
  const best = seen.sort((a, b) => b.confidence - a.confidence)[0] || null;
  const level = safe(() => seniorityOf(text, years), null);
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
