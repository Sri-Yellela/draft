// services/atlas/atlasRoleFit.js — ⭐ A111 P3 (11-02) · ONE ROLE AGAINST ONE RÉSUMÉ: the Atlas reading for a role.
//
// The trial's "Use my own résumé" pathway (docs/A111_OWN_RESUME_PATHWAY.md step 4) opens a pick and shows the role
// against the résumé: "you cover 9 of this role's top 15", what the résumé has and misses, the skills that rise toward
// the next level, and the role page's link. The same reading for any reader, any category (D127) — computed, never
// written: ⛔ no model (D17), nothing stored (D134: the résumé's terms are used for this call only).
//
//   readRoleFit(input)          PURE — the reading from plain data (the role, its candidate skills with their counts and
//                               categories, the résumé's slugs, the next-level rises). Tests and any consumer can call it.
//   roleFitReading(db, opts)    the database half: resolves the role (a slug, a title, or a posting's title), gathers its
//                               candidates (its `requires` edges and the skills its own postings ask for, by the ONE
//                               matcher's live counts — atlasMe.js boardCounts), reads the résumé's terms (the Profile /
//                               the parsed résumé — atlasStore.js haveTerms — plus any text or terms the caller passes,
//                               matched by the same matcher the board is counted with), and calls readRoleFit.
//
// ⛔ NEVER ANOTHER CATEGORY'S SKILLS (D127): a candidate counts only when the role's curated list (a registry or a
// person's `requires` edge) names it, or it is in the role's category (atlasCategories.js inRoleCategory) — so a business
// analyst's reading never offers Kubernetes because a BA posting mentioned the platform team.
// ⚠ Unlike YOUR MAP, a skill whose page is still a DRAFT is read too (most non-computing skills have no Wikipedia
// summary yet, the auto-publish bar's (b)) — its name is the registry's own vocabulary, the one the ATS report shows;
// it is simply not linked (`page: null`). The role page link is given only when the role is published.
import { atlasIndex, boardCounts, levelRises, LEVEL_BANDS, YOUR_MAP } from "./atlasMe.js";
import { atlasPostingsChanged } from "./atlasLive.js";
import { postingMatcher } from "./postingMatcher.js";
import { haveTerms, termOf, slugOf } from "./atlasStore.js";
import { categoryIndex, nodeCategories, roleCategory, allowedInCategory, registryCached } from "./atlasCategories.js";
import { categoryOf, CATEGORIES } from "../jobs/professionalScope.js";
import { userLevelFor } from "../picks.js";
import { LEVELS_READ } from "../../shared/postingLevel.js";

/** Every number of the reading, here and only here. */
export const ROLE_FIT = Object.freeze({
  /** "this role's top 15" — the same 15 as a role page's tree (and YOUR MAP's branches) */
  TOP: YOUR_MAP.ROLE_TREE_SKILLS,
  /** the missing line names this many ("missing: Bpmn, Jira, Visio …"; the list has them all) */
  MISSING_NAMES: 4,
  /** next level: at most this many skills per step */
  RISES_PER_STEP: 8,
});
const CURATED_SOURCES = new Set(["registry", "owner"]);
const READ_KINDS = new Set(["skill", "tool", "stack"]);   // a concept / pattern is a learning page, not a role's ask
const pct = (c, n) => (n ? Math.round((c / n) * 100) : 0);
const pageOf = (n) => (n.published ? `/atlas/${encodeURIComponent(n.slug)}` : null);
const listWords = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "");

/**
 * PURE. The reading of one role against one résumé.
 * @param input.role       { slug, name, published, postings }   postings = the role's open postings on the board
 * @param input.category   the role's D127 category (or null — then nothing is filtered)
 * @param input.skills     candidates: [{ slug, name, kind, published, inRole, postings, curated, categories: string[] }]
 *                         inRole = the role's postings asking for it; postings = all open postings asking for it
 * @param input.have       the résumé's node slugs (Set or array)
 * @param input.nextLevel  [{ from, to, postings: { from, to }, reason?, items: [{ slug, name, kind, published, curated,
 *                         categories, share: { from, to }, rise }] }]
 * @param input.job        { jobId, title, company } | null
 * @returns the reading — see the return statement (the shape the trial's panel reads)
 */
export function readRoleFit({ role, category = null, skills = [], have = [], nextLevel = [], job = null } = {}) {
  const mine = have instanceof Set ? have : new Set(have);
  const allowed = (s) => READ_KINDS.has(s.kind) && allowedInCategory(category, s.categories, { curated: !!s.curated });
  const postings = Number(role?.postings) || 0;
  const rankedBy = postings > 0 && skills.some(s => s.inRole > 0) ? "board" : "registry";
  const seen = new Set();
  const top = skills.filter(s => allowed(s) && !seen.has(s.slug) && seen.add(s.slug))
    .sort((a, b) => (b.inRole || 0) - (a.inRole || 0) || (b.curated - a.curated) || (b.postings || 0) - (a.postings || 0) || a.name.localeCompare(b.name))
    .slice(0, ROLE_FIT.TOP)
    .map(s => ({ slug: s.slug, name: s.name, kind: s.kind, postings: s.inRole || 0, share: pct(s.inRole || 0, postings),
      have: mine.has(s.slug), page: pageOf(s) }));
  const haveList = top.filter(s => s.have), missing = top.filter(s => !s.have);
  const named = missing.slice(0, ROLE_FIT.MISSING_NAMES).map(m => m.name);
  const line = top.length
    ? `You cover ${haveList.length} of this role's top ${top.length}${named.length ? ` — missing ${listWords(named)}${missing.length > named.length ? " …" : ""}` : ""}`
    : "This role has no skills on the Atlas yet.";
  const steps = nextLevel.map(step => {
    const items = (step.items || []).filter(i => allowed(i) && !mine.has(i.slug)).slice(0, ROLE_FIT.RISES_PER_STEP)
      .map(i => ({ slug: i.slug, name: i.name, kind: i.kind, share: i.share, rise: i.rise, page: pageOf(i),
        line: `In ${i.share.to} % of ${step.to} ${role.name} postings vs ${i.share.from} % of ${step.from}` }));
    return { from: step.from, to: step.to, postings: step.postings, ...(step.reason ? { reason: step.reason } : {}), items };
  });
  return {
    found: true,
    role: { slug: role.slug, name: role.name, postings, page: role.published ? `/atlas/${encodeURIComponent(role.slug)}` : null },
    category, categoryLabel: category ? (CATEGORIES[category]?.label ?? category) : null,
    rankedBy,
    covered: haveList.length, of: top.length, line,
    top,
    have: haveList.map(({ slug, name, page }) => ({ slug, name, page })),
    missing: missing.map(({ slug, name, share, page }) => ({ slug, name, share, page })),
    nextLevel: steps,
    job: job || null,
  };
}

/** The role a request names: a role node's slug, else a title (the board's own roleOf), else a posting's title. */
export function resolveRole(db, { role = null, jobId = null } = {}, idx = atlasIndex(db)) {
  const roles = idx.nodes.filter(n => n.kind === "role");
  let job = null;
  if (jobId != null && String(jobId).trim()) {
    try { job = db.prepare(`SELECT job_id AS jobId, title, company FROM scraped_jobs WHERE job_id = ?`).get(String(jobId)) || null; } catch { job = null; }
  }
  const byTitle = (title) => {
    if (!title) return null;
    const exact = roles.find(r => r.term === termOf(title));
    if (exact) return exact;
    const id = postingMatcher(db, roles, { listOnly: true }).roleOf(title);
    return id == null ? null : idx.byId.get(id);
  };
  const named = role != null && String(role).trim() ? String(role).trim() : null;
  const node = (named && (roles.find(r => r.slug === named) || roles.find(r => r.slug === slugOf(named)) || byTitle(named)))
    || (job ? byTitle(job.title) : null);
  return { node: node || null, job };
}

/** The résumé's node slugs: the reader's terms (Profile, else the parsed résumé), the caller's terms, and its text. */
function haveSlugs(db, nodes, { userId = null, terms = [], resumeText = null } = {}) {
  const t = new Set();
  if (userId != null) for (const x of haveTerms(db, userId).terms) t.add(x);
  for (const x of Array.isArray(terms) ? terms : []) { const k = termOf(x); if (k) t.add(k); }
  const out = new Set(nodes.filter(n => t.has(n.term)).map(n => n.slug));
  if (resumeText && String(resumeText).trim()) {
    const m = postingMatcher(db, nodes);
    const bySlugId = new Map(nodes.map(n => [n.id, n.slug]));
    for (const id of m.read({ title: "", company: null, text: String(resumeText).slice(0, 60000), skills_json: null }, { boilerplate: new Set() }).asked) {
      if (bySlugId.has(id)) out.add(bySlugId.get(id));
    }
  }
  return out;
}

/**
 * The reading for one role, from the database.
 * @param opts { role: slug | title, jobId, userId, terms: string[], resumeText, registry }
 * @returns readRoleFit's reading, or { found: false, reason: "unknown_role" | "no_role" }
 */
export function roleFitReading(db, { role = null, jobId = null, userId = null, terms = [], resumeText = null, registry = null } = {}) {
  atlasPostingsChanged(db);
  const idx = atlasIndex(db);
  const { node, job } = resolveRole(db, { role, jobId }, idx);
  if (!node) return { found: false, reason: role || jobId ? "unknown_role" : "no_role", job: job || null };
  let reg = registry;
  if (!reg) { try { reg = registryCached(); } catch { reg = {}; } }
  const index = categoryIndex(reg);
  const jobCat = job ? categoryOf({ title: job.title }) : null;
  const category = jobCat?.inScope ? jobCat.category : roleCategory(node, index);

  const rollup = boardCounts(db, idx.nodes);
  const r = rollup.roles.get(node.id);
  const curated = new Set(), required = new Set();
  for (const e of db.prepare(`SELECT to_id, source FROM atlas_edges WHERE from_id = ? AND type = 'requires'`).all(node.id)) {
    required.add(e.to_id);
    if (CURATED_SOURCES.has(e.source)) curated.add(e.to_id);
  }
  const ids = new Set([...required, ...(r?.skill?.keys() ?? [])]);
  const candidate = (n, extra = {}) => ({ slug: n.slug, name: n.name, kind: n.kind, published: n.status === "published",
    postings: n.postings || 0, curated: curated.has(n.id), categories: [...nodeCategories(n, index)], ...extra });
  const skills = [...ids].map(id => idx.byId.get(id)).filter(n => n && n.kind !== "role")
    .map(n => candidate(n, { inRole: r?.skill?.get(n.id) || 0 }));

  // Next level: the reader's own step when their level is known, else every step (the role page's reading, D105 P12).
  const all = { ...idx, published: () => true };   // drafts read too (see the header); the reading links only published pages
  const rank = userId != null ? userLevelFor(db, userId) : null;
  const band = rank == null ? -1 : LEVEL_BANDS.findIndex(b => b.levels.includes(LEVELS_READ[rank]));
  const stepsFrom = band >= 0 ? (band + 1 < LEVEL_BANDS.length ? [band] : []) : LEVEL_BANDS.slice(0, -1).map((_, i) => i);
  const nextLevel = stepsFrom.map(cur => {
    const { said, items } = levelRises(all, rollup, node.id, cur);
    return { from: said.from, to: said.to, postings: said.postings, ...(said.reason ? { reason: said.reason } : {}),
      items: items.map(i => { const n = idx.nodes.find(x => x.slug === i.slug);
        return candidate(n, { share: { from: i.from.share, to: i.to.share }, rise: i.rise }); }) };
  });

  const nodes = [...ids].map(id => idx.byId.get(id)).filter(n => n && n.kind !== "role");
  for (const step of nextLevel) for (const i of step.items) { const n = idx.nodes.find(x => x.slug === i.slug); if (n) nodes.push(n); }
  const have = haveSlugs(db, nodes, { userId, terms, resumeText });
  return readRoleFit({
    role: { slug: node.slug, name: node.name, published: node.status === "published", postings: r?.postings ?? 0 },
    category, skills, have, nextLevel,
    job: job ? { jobId: job.jobId, title: job.title, company: job.company } : null,
  });
}

