// services/atlas/roleReadiness.js — ⭐ D178-3 (owner's pick 11-07, docs/sketches/Atlas D178 ideas.html → Your skills, Idea D + C)
// · READINESS FOR A ROLE: the share of that role's demand you have PROVEN, each skill weighted by how often it appears in
// the role's live postings (the Atlas's own counts, roleFitReading's top skills). Claims don't count until proven — they
// are shown apart, as "+N% waiting in skills you've claimed". Every skill not yet proven says what it would add and its
// next step (Prove it — a quick check — when claimed; Learn it otherwise). A role with too few postings shows no %.
// ⛔ Copy rule (D178): never "expertise", never a guarantee — it is "ready", from this week's postings, with the scope shown.
// Proven = D169's checked or built (services/yourSkills.js yourSkillStates — the same reader Your map uses).
import { roleFitReading } from "./atlasRoleFit.js";
import { resolveTerms } from "./atlasStore.js";
import { yourSkillStates } from "../yourSkills.js";

export const READINESS = Object.freeze({
  /** fewer live postings for the role than this → "not enough postings yet", no % (owner's suggestion: < 30) */
  MIN_POSTINGS: 30,
  /** tiers by share of the role's postings */
  MUST: 60, COMMON: 30,
});
const safe = (fn, d) => { try { return fn(); } catch { return d; } };
export const tierOf = (share) => (share >= READINESS.MUST ? "must" : share >= READINESS.COMMON ? "common" : "nice");

/**
 * Pure: the reading from a role's top skills (each { slug, name, share }) and the person's states by slug.
 * @returns { ready, waiting, tiers: { must|common|nice: { share, have, of, skills } }, moves: [...] }
 */
export function readinessOf(top = [], stateBySlug = new Map()) {
  const total = top.reduce((a, s) => a + (s.share || 0), 0);
  const part = (n) => (total ? Math.floor((n / total) * 100) : 0);
  const skills = top.map(s => ({ slug: s.slug, name: s.name, share: s.share || 0, tier: tierOf(s.share || 0),
    state: stateBySlug.get(s.slug) || "missing", page: s.page || null }));
  const sum = (f) => skills.filter(f).reduce((a, s) => a + s.share, 0);
  const tiers = {};
  for (const t of ["must", "common", "nice"]) {
    const in_ = skills.filter(s => s.tier === t);
    tiers[t] = { share: part(in_.reduce((a, s) => a + s.share, 0)), have: in_.filter(s => s.state === "proven").length, of: in_.length, skills: in_ };
  }
  const moves = skills.filter(s => s.state !== "proven").sort((a, b) => b.share - a.share)
    .map(s => ({ slug: s.slug, name: s.name, adds: part(s.share), state: s.state, action: s.state === "claimed" ? "prove" : "learn", page: s.page }));
  return { ready: part(sum(s => s.state === "proven")), waiting: part(sum(s => s.state === "claimed")), tiers, moves };
}

/** The person's states by Atlas slug: proven (checked / built) or claimed. */
export function statesBySlug(db, userId) {
  const states = safe(() => yourSkillStates(db, userId), []);
  const slugs = safe(() => resolveTerms(db, states.map(s => s.name)), {});
  const out = new Map();
  for (const s of states) {
    const slug = slugs[s.name];
    if (!slug) continue;
    const st = s.state === "checked" || s.state === "built" ? "proven" : "claimed";
    if (out.get(slug) !== "proven") out.set(slug, st);
  }
  return out;
}

/**
 * One role's readiness for one person. @returns { found, role, thin, ready?, waiting?, tiers?, moves?, scope } or { found: false }
 */
export function roleReadiness(db, userId, role) {
  const f = safe(() => roleFitReading(db, { role, userId }), null);
  if (!f?.found) return { found: false, reason: f?.reason || "unknown_role" };
  const scope = { postings: f.role.postings, level: "all levels", line: `from ${f.role.postings} live posting${f.role.postings === 1 ? "" : "s"} for ${f.role.name}, all levels` };
  const base = { found: true, role: f.role, scope };
  if (f.role.postings < READINESS.MIN_POSTINGS) return { ...base, thin: true, line: "Not enough postings yet to say how ready you are." };
  const r = readinessOf(f.top, statesBySlug(db, userId));
  return { ...base, thin: false, ...r,
    line: `${r.ready}% ready for ${f.role.name}${r.waiting ? ` · +${r.waiting}% waiting in skills you've claimed` : ""}` };
}

/**
 * ⭐ D178-3 (Idea E) · COMPARE ROLES: up to four roles' readiness side by side, the grid of which skills each asks for (its
 * share of that role's postings), and the skill that lifts the most roles at once ("Proving Python lifts all four roles").
 * Pure over roleReadiness results. @returns { roles, grid: [{ slug, name, state, shares: { roleSlug: share } }], lifts }
 */
export function compareFrom(readings = []) {
  const ok = readings.filter(r => r?.found && !r.thin);
  const bySkill = new Map();
  for (const r of ok) for (const t of ["must", "common", "nice"]) for (const s of r.tiers[t].skills) {
    const e = bySkill.get(s.slug) || { slug: s.slug, name: s.name, state: s.state, shares: {}, adds: 0 };
    e.shares[r.role.slug] = s.share;
    if (s.state !== "proven") e.adds += (r.moves.find(m => m.slug === s.slug)?.adds || 0);
    bySkill.set(s.slug, e);
  }
  const grid = [...bySkill.values()].sort((a, b) => Object.keys(b.shares).length - Object.keys(a.shares).length
    || Object.values(b.shares).reduce((x, y) => x + y, 0) - Object.values(a.shares).reduce((x, y) => x + y, 0)).slice(0, 14);
  const lifts = [...bySkill.values()].filter(e => e.state !== "proven")
    .sort((a, b) => Object.keys(b.shares).length - Object.keys(a.shares).length || b.adds - a.adds)[0] || null;
  return { roles: readings, grid, lifts: lifts && Object.keys(lifts.shares).length > 1
    ? { slug: lifts.slug, name: lifts.name, roles: Object.keys(lifts.shares).length, of: ok.length, state: lifts.state } : null };
}
export function compareRoles(db, userId, roles = []) {
  return compareFrom([...new Set(roles.map(r => String(r || "").trim()).filter(Boolean))].slice(0, 4).map(r => roleReadiness(db, userId, r)));
}

/**
 * ⭐ D179 P6 (45l) · READINESS FOR A SUBCATEGORY — each subcategory of the approved taxonomy is a role here. Its demand is
 * read from its own open postings: each technology's share = the postings that name it (job_tech) of the subcategory's open
 * postings (job_taxonomy); a technology with an Atlas page carries that page's slug, so the person's proven states (D169)
 * apply to it exactly as to an Atlas role. Same MIN_POSTINGS, same tiers, same "only proven counts".
 */
export function subcategoryReadiness(db, userId, subId, { top = 15 } = {}) {
  let tax = null; try { tax = deps.taxonomy(); } catch { return { found: false, reason: "unknown_role" }; }
  let role = null;
  for (const c of tax.categories) { if (c.held) continue; const s = c.subs.find(x => x.id === subId && !x.general); if (s) { role = { id: s.id, name: s.name, category: c.name }; break; } }
  if (!role) return { found: false, reason: "unknown_role" };
  const OPEN = "sj.is_active = 1 AND sj.duplicate_of IS NULL AND sj.board_category IS NOT NULL AND sj.board_category <> 'held'";
  const postings = safe(() => db.prepare(`SELECT COUNT(*) FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id WHERE ${OPEN} AND jt.subcategory = ?`).pluck().get(subId), 0) || 0;
  const scope = { postings, level: "all levels", line: `from ${postings} live posting${postings === 1 ? "" : "s"} for ${role.name}, all levels` };
  const base = { found: true, role: { slug: `sub:${role.id}`, name: role.name, postings, page: false, category: role.category }, scope };
  if (postings < READINESS.MIN_POSTINGS) return { ...base, thin: true, line: "Not enough postings yet to say how ready you are." };
  const rows = safe(() => db.prepare(`SELECT jk.tech AS tech, COUNT(*) AS n FROM scraped_jobs sj JOIN job_taxonomy jt ON jt.job_id = sj.job_id
      JOIN job_tech jk ON jk.job_id = sj.job_id WHERE ${OPEN} AND jt.subcategory = ? GROUP BY jk.tech ORDER BY n DESC LIMIT ?`).all(subId, top), []);
  const slugs = new Map(safe(() => deps.atlasLinksFor(db, rows.map(r => r.tech), 40), []).map(a => [String(a.name).toLowerCase(), a.slug]));
  const topSkills = rows.map(r => ({ slug: slugs.get(String(r.tech).toLowerCase()) || `tech:${String(r.tech).toLowerCase()}`, name: r.tech,
    share: Math.round((r.n / postings) * 100) }));
  const r = readinessOf(topSkills, statesBySlug(db, userId));
  return { ...base, thin: false, ...r, line: `${r.ready}% ready for ${role.name}${r.waiting ? ` · +${r.waiting}% waiting in skills you've claimed` : ""}` };
}
// Injected so this module keeps no import of the jobs layer at load (set by routes/atlas.js).
const deps = { taxonomy: () => { throw new Error("no taxonomy"); }, atlasLinksFor: () => [] };
export function setSubcategoryDeps(d) { Object.assign(deps, d); }
