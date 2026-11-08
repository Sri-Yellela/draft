// services/atlas/atlasMe.js — ⭐ D116 · YOUR MAP: the Atlas home built from the user's own résumé (GET /api/atlas/me).
//
// Five sections, every one COMPUTED from data draft already has — ⛔ no model (D17):
//   1 haveSkills  the profile's skills (D101 profile_skills + confirmed aliases) that are PUBLISHED Atlas nodes, grouped
//                 by kind, each "asked for in N open postings" (atlas_node_stats, the nightly rollup)
//   2 nextLevel   for the user's target role(s): skills whose share of that role's postings RISES from the user's level
//                 to the next (the posting's real level, D106 scraped_jobs.level_read), not on the profile, by the rise
//   3 adjacent    used_with neighbours of the user's skills not on the profile, by demand, with which skills they go with
//   4 branches    other roles where the user covers enough of the role's top required skills (its `requires` edges)
//   5 learnNext   the D115 learning-path steps that teach the top gaps from 2–4, with the user's progress on each
// Signed out, or no profile skills: search + Learn + "Explore by role" (the board's biggest roles with their top skills)
// and the line "Upload a résumé and this page becomes your map." — never an empty page.
//
// ⛔ ONE MATCHER: a posting asks for a node by postingMatcher.js (re-exported by atlasStats.js) — the rule "asked for
// in N" is counted by, without the company's boilerplate and from the requirements when the posting has them.
// ⛔ Only PUBLISHED nodes appear in an answer. ⛔ Every threshold is in YOUR_MAP below, and only there.
// The board half (per role × level × skill counts) is the LIVE rows (⭐ D118 P1, atlasLive.js atlas_role_level_stats):
// written by the nightly pass and moved by every posting ingested, changed or closed in between. Before the first full
// pass one pass of its own counts it. The user half is computed on every read, so a profile change shows at once.

import { postingMatcher, roleLevelsOfBoard } from "./atlasStats.js";
import { liveRoleLevels, atlasPostingsChanged, liveStamp, LIVE_CACHE_MS } from "./atlasLive.js";
import { haveTerms, KINDS, termOf, aliasesOf } from "./atlasStore.js";
import { yourSkillStates } from "../yourSkills.js";
const safeRead = (fn, d) => { try { return fn(); } catch { return d; } };
import { userLevelFor } from "../picks.js";
import { LEVELS_READ } from "../../shared/postingLevel.js";
import { learnStepForNode, learnStepPath } from "../learn/learnLinks.js";
import { learnContent, stepsOf } from "../learn/learnContent.js";
import { earnedMarks } from "../learn/learnEarned.js";
import { stepState } from "../../shared/learnStepState.js";
import { yourTree, nodeLearnStates } from "./atlasTree.js";

/** ⭐ D116 · EVERY threshold of YOUR MAP — tuned here, from real use, and nowhere else (d116ThresholdsOneFile). */
export const YOUR_MAP = Object.freeze({
  /** nextLevel: a skill's share must rise by at least this many percentage points from the user's level to the next */
  NEXT_LEVEL_RISE_POINTS: 10,
  /** nextLevel: …measured only where the role has at least this many postings read at EACH of the two levels */
  NEXT_LEVEL_MIN_POSTINGS: 20,
  /** branches: the share of a role's top required skills the user must already cover, in percent */
  BRANCH_MIN_COVERAGE_PERCENT: 40,
  /** branches: how many of a role's required skills count ("the role's top 15") */
  BRANCH_TOP_REQUIRED: 15,
  /** branches: a role with fewer required skills than this on the Atlas is not judged (1 of 1 is not a branch) */
  BRANCH_MIN_REQUIRED: 5,
  /** branches: how many missing skills the line names ("missing: Spark, Airflow, dbt …"; the list has them all) */
  BRANCH_MISSING_NAMES: 3,
  /** adjacent: how many of the user's own skills an item names ("Often asked with Kubernetes and Go") */
  ADJACENT_WITH_NAMES: 3,
  /** every section's visible items; the section's `total` says how many there are ("see all") */
  PER_SECTION: 12,
  /** "see all" (?all=<section>) still stops here */
  SEE_ALL_MAX: 500,
  /** the signed-out "Explore by role": how many top skills each role shows */
  EXPLORE_ROLE_SKILLS: 6,
  // ── ⭐ D116 M1 · THE TREE (atlasTree.js reads these; the drawing's own geometry is the client's, M2) ──
  /** closeness: a posting is "close" to the user when it also asks for at least this many of their skills */
  CLOSE_MIN_MINE: 2,
  /** at most this many nodes per family on the tree (highest postings × closeness); the rest in the family's list */
  TREE_PER_FAMILY: 12,
  /** the route to the aim: measured over the aim role's top this-many skills (its senior postings when measured) */
  ROUTE_SKILLS: 15,
  /** the route's words: steps up to this one come "early" … */
  ROUTE_EARLY_STEPS: 3,
  /** …up to this one "mid-way", after it "later" */
  ROUTE_MIDWAY_STEPS: 6,
  /** the facts name this many of the user's skills a node is asked with ("(Kubernetes, Docker and AWS)") */
  ASKED_WITH_NAMES: 3,
  /** "It opens toward: …" names this many */
  OPENS_TOWARD_NAMES: 6,
  /** a role page's tree: the role's top this-many skills (M7) */
  ROLE_TREE_SKILLS: 15,
  /** "You cover 6 of 15; missing Spark 64 %, …" names this many missing skills */
  ROLE_TREE_MISSING_NAMES: 4,
  /** a family page's tree: at most this many of the family's skills drawn (by postings); the rest in its list */
  FAMILY_TREE_MAX: 24,
  /** ⭐ D120 P2 · the home's side column: how many recently published pages it lists */
  RECENT_PUBLISHED: 8,
});

// The user's level → the band their next level is measured against. D116: "entry/early → mid, mid → senior" — entry
// and early are one band (D106's scale: entry 0 · early 1 · mid 2 · senior 3). A senior user has no next band.
export const LEVEL_BANDS = Object.freeze([
  Object.freeze({ label: "early-career", levels: Object.freeze(["entry", "early"]) }),
  Object.freeze({ label: "mid", levels: Object.freeze(["mid"]) }),
  Object.freeze({ label: "senior", levels: Object.freeze(["senior"]) }),
]);
const bandOfLevel = (level) => LEVEL_BANDS.findIndex(b => b.levels.includes(level));
const bandOfRank = (rank) => (rank == null ? -1 : bandOfLevel(LEVELS_READ[rank]));

export const SECTIONS = Object.freeze(["haveSkills", "nextLevel", "adjacent", "branches", "learnNext"]);
export const UPLOAD_PROMPT = "Upload a résumé and this page becomes your map.";
/** D120 P1 · a résumé is on file but no skill could be read from it (nor is one on the Profile): never "upload one". */
export const NO_SKILLS_READ = "Your résumé is on file, but no skills could be read from it. Add your skills on your Profile and this page becomes your map.";
/** D120 P1 · the map is drawn from the résumé's parse because the Profile has no skills yet. */
export const CONFIRM_ON_PROFILE = "Confirm these on your Profile";
const SEARCH_HINT = Object.freeze({ hint: "Search a skill, tool or role — try “k8s” or “Backend Engineer”.", api: "/api/atlas/search?q=" });
const LEARN_POINTER = Object.freeze({ path: "/learn", label: "Learn", line: "The owner's learning path — from silicon to software, step by step." });

const pct = (x) => Math.round(x * 100);
const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "");
const nodeOut = (n) => ({ slug: n.slug, kind: n.kind, name: n.name });

// ── the board half ─────────────────────────────────────────────────────────────────────────────

let lazy = { db: null, key: null, counts: null };

/**
 * The board half: per role, its postings and the postings asking for each node, in all and per level read
 * (atlasStats.js roleLevelCounts, through the ONE matcher). ⭐ D118 P1: the live rows (the queue drained first, so a
 * posting written a moment ago is in them); before the first full pass, one pass of its own, kept until the next one.
 * @param opts { reuse: false — always count again (a test compares the two) }
 */
export function boardCounts(db, nodes, { reuse = true } = {}) {
  if (reuse) {
    atlasPostingsChanged(db);
    const live = liveRoleLevels(db);
    if (live) return live;
  }
  const computedAt = db.prepare(`SELECT MAX(computed_at) FROM atlas_node_stats`).pluck().get() ?? null;
  const key = `${computedAt}:${nodes.length}`;
  if (reuse && lazy.db === db && lazy.key === key) return lazy.counts;
  const counts = roleLevelsOfBoard(db, nodes);
  lazy = { db, key, counts };
  return counts;
}

/** One role's counts in one level band (its levels summed). */
function inBand(r, band) {
  const out = { postings: 0, skill: new Map() };
  for (const level of LEVEL_BANDS[band].levels) {
    const l = r?.levels.get(level);
    if (!l) continue;
    out.postings += l.postings;
    for (const [id, c] of l.skill) out.skill.set(id, (out.skill.get(id) || 0) + c);
  }
  return out;
}

// ⭐ D116 M1 · the tree's mid → senior facts: "22 % of mid ML postings, 61 % of senior (+39 points)", and the orange
// ring (rises toward senior: the senior share minus the mid share ≥ NEXT_LEVEL_RISE_POINTS — the same rule as nextLevel).
const MID_BAND = LEVEL_BANDS.findIndex(b => b.label === "mid");
const SENIOR_BAND = LEVEL_BANDS.findIndex(b => b.label === "senior");
export const AIM_LEVEL = LEVEL_BANDS[SENIOR_BAND].label;

/**
 * One role's mid → senior reading, or null when either level has fewer than NEXT_LEVEL_MIN_POSTINGS postings read (M9:
 * the line is not shown). @returns {null | (nodeId) => { mid, senior, rise, rises }}
 */
export function midSeniorFor(rollup, roleId) {
  const r = rollup.roles.get(roleId);
  const m = inBand(r, MID_BAND), s = inBand(r, SENIOR_BAND);
  if (m.postings < YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS || s.postings < YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS) return null;
  return (id) => {
    const cm = m.skill.get(id) || 0, cs = s.skill.get(id) || 0;
    const mid = pct(cm / m.postings), senior = pct(cs / s.postings);
    // In whole numbers, as levelRises: no float rounding decides the ring.
    const rises = 100 * (cs * m.postings - cm * s.postings) >= YOUR_MAP.NEXT_LEVEL_RISE_POINTS * m.postings * s.postings;
    return { mid, senior, rise: senior - mid, rises };
  };
}

/** The aim role's skill counts: its senior postings when that level is measured, else all its postings. */
export function aimSkillCounts(rollup, roleId) {
  const r = rollup.roles.get(roleId);
  const s = inBand(r, SENIOR_BAND);
  return s.postings >= YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS ? s.skill : (r?.skill ?? new Map());
}

/** The user's level band's label ("early-career" · "mid" · "senior"), or null with no level read. */
export function userBandLabel(db, userId) {
  const b = bandOfRank(userLevelFor(db, userId));
  return b < 0 ? null : LEVEL_BANDS[b].label;
}

// ⭐ D151 (45l): the user-independent Atlas pieces — the node index and the role → required-skills map — were rebuilt
// on EVERY Your map call (45k's profile: atlasIndex 0.6–1.0 s, branchesSection 3.0 s of main-thread time over 588
// calls). They are kept now, per database, under a stamp that moves with: the live counts' version (liveStamp), every
// write to atlas_nodes / skill_synonyms / atlas_edges (atlas_changes — the edges' triggers are migration 230), and the
// stats table's own cheap key (a nightly stats rebuild writes atlas_node_stats without moving either). Never past
// LIVE_CACHE_MS. ⛔ The kept objects are SHARED between requests — callers read them, never mutate them.
const sharedAtlas = new WeakMap();   // db → Map(key → { stamp, at, value })
function statsKey(db) {
  try { return db.prepare(`SELECT COUNT(*) || ':' || COALESCE(MAX(computed_at), 0) || ':' || COALESCE(SUM(postings), 0) FROM atlas_node_stats`).pluck().get(); }
  catch { return "-"; }
}
function keptAtlas(db, key, compute, now = Date.now()) {
  let c = sharedAtlas.get(db);
  if (!c) sharedAtlas.set(db, c = new Map());
  const stamp = `${liveStamp(db)}|${statsKey(db)}`;
  const hit = c.get(key);
  if (hit && hit.stamp === stamp && now - hit.at < LIVE_CACHE_MS) return hit.value;
  const value = compute();
  c.set(key, { stamp, at: now, value });
  return value;
}

export function atlasIndex(db) { return keptAtlas(db, "index", () => buildAtlasIndex(db)); }

function buildAtlasIndex(db) {
  const nodes = db.prepare(`SELECT n.id, n.slug, n.kind, n.name, n.term, n.status, n.family, COALESCE(s.postings, 0) AS postings, s.top_skills_json
    FROM atlas_nodes n LEFT JOIN atlas_node_stats s ON s.node_id = n.id`).all();
  const byId = new Map(nodes.map(n => [n.id, n]));
  const published = (id) => byId.get(id)?.status === "published";
  return { nodes, byId, published };
}

const capped = (items, all) => ({ total: items.length, items: items.slice(0, all ? YOUR_MAP.SEE_ALL_MAX : YOUR_MAP.PER_SECTION) });

// ── signed out / no résumé ─────────────────────────────────────────────────────────────────────

/** The board's biggest published roles, each with its top published skills — the home for a reader with no map. */
export function exploreByRole(db, idx = atlasIndex(db)) {
  const pubSlugs = new Set(idx.nodes.filter(n => n.status === "published").map(n => n.slug));
  const roles = idx.nodes.filter(n => n.kind === "role" && n.status === "published" && n.postings > 0)
    .sort((a, b) => b.postings - a.postings || a.name.localeCompare(b.name));
  const items = roles.map(r => {
    let top = [];
    try { top = JSON.parse(r.top_skills_json || "[]"); } catch { top = []; }
    return { ...nodeOut(r), postings: r.postings,
      topSkills: top.filter(s => pubSlugs.has(s.slug)).slice(0, YOUR_MAP.EXPLORE_ROLE_SKILLS).map(s => ({ slug: s.slug, name: s.name, postings: s.postings })) };
  });
  return capped(items, false);
}

function explore(db, idx) {
  return { prompt: UPLOAD_PROMPT, search: SEARCH_HINT, learn: LEARN_POINTER, exploreByRole: exploreByRole(db, idx), recent: recentlyPublished(db) };
}

/** ⭐ D120 P2 · the home's side column: the pages published most recently (published_at, the curator's or auto-publish). */
export function recentlyPublished(db, limit = YOUR_MAP.RECENT_PUBLISHED) {
  try {
    return db.prepare(`SELECT slug, name, kind FROM atlas_nodes WHERE status = 'published' AND published_at IS NOT NULL
      ORDER BY published_at DESC, name LIMIT ?`).all(limit);
  } catch { return []; }
}

// ── the user half ──────────────────────────────────────────────────────────────────────────────

/** The user's target role ids: the active job profile's target titles (else its name), else their current title. */
export function targetRoleIds(db, userId, match) {
  const titles = [];
  try {
    const p = db.prepare(`SELECT profile_name, target_titles FROM domain_profiles WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC, id DESC LIMIT 1`).get(userId);
    if (p) {
      try { const t = JSON.parse(p.target_titles || "[]"); if (Array.isArray(t)) titles.push(...t.map(String)); } catch { /* no titles */ }
      if (!titles.length && p.profile_name) titles.push(p.profile_name);
    }
  } catch { /* no job profile table */ }
  if (!titles.length) {
    try { const t = db.prepare(`SELECT current_job_title FROM user_profile WHERE user_id = ?`).pluck().get(userId); if (t) titles.push(t); } catch { /* none */ }
  }
  const ids = [];
  for (const t of titles) { const id = match.roleOf(t); if (id != null && !ids.includes(id)) ids.push(id); }
  return ids;
}

function haveSection(have, all) {
  const items = [...have].sort((a, b) => b.postings - a.postings || a.name.localeCompare(b.name))
    .map(n => ({ ...nodeOut(n), postings: n.postings, line: `Asked for in ${n.postings} open posting${n.postings === 1 ? "" : "s"}` }));
  // Grouped by kind (the Atlas's own order); each group capped, with its total.
  const groups = KINDS.filter(k => k !== "role").map(kind => ({ kind, ...capped(items.filter(i => i.kind === kind), all) })).filter(g => g.total);
  return { total: items.length, groups };
}

/**
 * ⭐ D116 "to reach the next level", for ONE role and one step (band `cur` → `cur + 1`): the published skills whose share
 * of the role's postings rises by ≥ NEXT_LEVEL_RISE_POINTS, where each band has ≥ NEXT_LEVEL_MIN_POSTINGS read. Read by
 * YOUR MAP (skipping the user's own skills) and by the role page (D105 P12, every step, skipping nothing) — one rule.
 * @returns {{ said: { slug, kind, name, from, to, postings: { from, to }, reason? }, items: Array<{ …, _rise }> }}
 *   items ranked by the rise; `_rise` is the unrounded rise, for the caller's own merge / sort (strip before sending)
 */
export function levelRises(idx, rollup, roleId, cur, { skip = new Set() } = {}) {
  const next = cur + 1;
  const role = idx.byId.get(roleId);
  const r = rollup.roles.get(roleId);
  const bCur = inBand(r, cur), bNext = inBand(r, next);
  const nCur = bCur.postings, nNext = bNext.postings;
  const said = { ...nodeOut(role), from: LEVEL_BANDS[cur].label, to: LEVEL_BANDS[next].label, postings: { from: nCur, to: nNext } };
  if (nCur < YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS || nNext < YOUR_MAP.NEXT_LEVEL_MIN_POSTINGS) return { said: { ...said, reason: "too_few_postings" }, items: [] };
  const items = [];
  for (const id of new Set([...bCur.skill.keys(), ...bNext.skill.keys()])) {
    const n = idx.byId.get(id);
    if (!n || n.kind === "role" || !idx.published(id) || skip.has(id)) continue;
    const cFrom = bCur.skill.get(id) || 0, cTo = bNext.skill.get(id) || 0;
    // The rise in whole numbers: (cTo/nNext − cFrom/nCur) × 100 ≥ points ⇔ 100·(cTo·nCur − cFrom·nNext) ≥ points·nCur·nNext.
    if (100 * (cTo * nCur - cFrom * nNext) < YOUR_MAP.NEXT_LEVEL_RISE_POINTS * nCur * nNext) continue;
    const sFrom = cFrom / nCur, sTo = cTo / nNext, rise = (sTo - sFrom) * 100;
    items.push({ ...nodeOut(n), postings: n.postings, role: nodeOut(role), rise: Math.round(rise),
      from: { level: LEVEL_BANDS[cur].label, share: pct(sFrom) }, to: { level: LEVEL_BANDS[next].label, share: pct(sTo) },
      line: `In ${pct(sTo)} % of ${LEVEL_BANDS[next].label} ${role.name} postings vs ${pct(sFrom)} % of ${LEVEL_BANDS[cur].label}`, _rise: rise });
  }
  items.sort((a, b) => b._rise - a._rise || b.postings - a.postings || a.name.localeCompare(b.name));
  return { said, items };
}

function nextLevelSection(db, userId, { idx, rollup, haveIds, targets }, all) {
  const out = { total: 0, items: [], roles: [] };
  if (!targets.length) return { ...out, reason: "no_target_role" };
  const rank = userLevelFor(db, userId);
  const cur = bandOfRank(rank);
  if (cur < 0) return { ...out, reason: "no_level" };
  const next = cur + 1;
  if (next >= LEVEL_BANDS.length) return { ...out, reason: "top_level", level: LEVEL_BANDS[cur].label };
  const best = new Map();
  for (const roleId of targets) {
    const { said, items } = levelRises(idx, rollup, roleId, cur, { skip: haveIds });
    out.roles.push(said);
    for (const item of items) {
      const had = best.get(item.slug);
      if (!had || had._rise < item._rise) best.set(item.slug, item);
    }
  }
  const items = [...best.values()].sort((a, b) => b._rise - a._rise || b.postings - a.postings || a.name.localeCompare(b.name)).map(({ _rise, ...i }) => i);
  return { ...capped(items, all), roles: out.roles, ...(out.roles.every(r => r.reason) ? { reason: "too_few_postings" } : {}) };
}

function adjacentSection(db, { idx, have, haveIds }, all) {
  if (!have.length) return { total: 0, items: [], reason: "no_skills" };
  const ids = [...haveIds];
  const marks = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT from_id AS a, to_id AS b FROM atlas_edges WHERE type = 'used_with' AND (from_id IN (${marks}) OR to_id IN (${marks}))`).all(...ids, ...ids);
  const withOf = new Map();
  for (const { a, b } of rows) {
    for (const [mine, other] of [[a, b], [b, a]]) {
      if (!haveIds.has(mine) || haveIds.has(other)) continue;
      const n = idx.byId.get(other);
      if (!n || n.kind === "role" || !idx.published(other)) continue;
      if (!withOf.has(other)) withOf.set(other, new Set());
      withOf.get(other).add(mine);
    }
  }
  const items = [...withOf.entries()].map(([id, mine]) => {
    const n = idx.byId.get(id);
    const withNodes = [...mine].map(m => idx.byId.get(m)).sort((x, y) => y.postings - x.postings || x.name.localeCompare(y.name));
    return { ...nodeOut(n), postings: n.postings, with: withNodes.map(nodeOut),
      line: `Often asked with ${list(withNodes.slice(0, YOUR_MAP.ADJACENT_WITH_NAMES).map(w => w.name))}` };
  }).sort((a, b) => b.postings - a.postings || a.name.localeCompare(b.name));
  return capped(items, all);
}

/** Published role → its published required skills (the `requires` edges), kept under the shared stamp (D151, 45l). */
function requiresByRole(db, idx) {
  return keptAtlas(db, "requires", () => {
    const req = new Map();
    for (const e of db.prepare(`SELECT from_id, to_id FROM atlas_edges WHERE type = 'requires'`).all()) {
      const role = idx.byId.get(e.from_id), n = idx.byId.get(e.to_id);
      if (role?.kind !== "role" || !idx.published(role.id) || !n || n.kind === "role" || !idx.published(n.id)) continue;
      if (!req.has(role.id)) req.set(role.id, new Set());
      req.get(role.id).add(n.id);
    }
    return req;
  });
}

function branchesSection(db, { idx, rollup, haveIds, targets }, all) {
  const req = requiresByRole(db, idx);
  const items = [];
  for (const [roleId, needIds] of req) {
    if (targets.includes(roleId)) continue;
    const inRole = rollup.roles.get(roleId)?.skill ?? new Map();
    const top = [...needIds].map(id => idx.byId.get(id))
      .sort((a, b) => (inRole.get(b.id) || 0) - (inRole.get(a.id) || 0) || b.postings - a.postings || a.name.localeCompare(b.name))
      .slice(0, YOUR_MAP.BRANCH_TOP_REQUIRED);
    if (top.length < YOUR_MAP.BRANCH_MIN_REQUIRED) continue;
    const covered = top.filter(n => haveIds.has(n.id));
    const coverage = covered.length / top.length;
    // In whole numbers (6 of 15 is 40 % exactly — no float rounding decides a branch).
    if (covered.length * 100 < YOUR_MAP.BRANCH_MIN_COVERAGE_PERCENT * top.length) continue;
    const role = idx.byId.get(roleId);
    const missing = top.filter(n => !haveIds.has(n.id)).map(nodeOut);
    items.push({ ...nodeOut(role), postings: role.postings, covered: covered.length, of: top.length, coverage: Math.round(coverage * 100) / 100,
      have: covered.map(nodeOut), missing,
      line: `You cover ${covered.length} of ${top.length} for ${role.name}${missing.length ? ` — missing: ${missing.slice(0, YOUR_MAP.BRANCH_MISSING_NAMES).map(m => m.name).join(", ")}${missing.length > YOUR_MAP.BRANCH_MISSING_NAMES ? " …" : ""}` : ""}` });
  }
  items.sort((a, b) => b.coverage - a.coverage || b.postings - a.postings || a.name.localeCompare(b.name));
  return capped(items, all);
}

function learnNextSection(db, userId, { idx, gaps }, all) {
  const learn = learnContent(db);
  const stepById = new Map(stepsOf(learn).map(s => [s.id, s]));
  const marks = earnedMarks(db, userId);   // ⭐ D117 C8: earned, never ticked
  const bySteps = new Map();
  for (const g of gaps) {
    const n = idx.nodes.find(x => x.slug === g.slug);
    const step = n ? learnStepForNode(db, { name: n.name, term: n.term }, learn) : null;
    if (!step) continue;
    if (!bySteps.has(step.stepId)) {
      const s = stepById.get(step.stepId);
      bySteps.set(step.stepId, { ...step, path: learnStepPath(step.stepId), progress: s ? stepState(s, marks) : null, teaches: [] });
    }
    const it = bySteps.get(step.stepId);
    if (!it.teaches.some(t => t.slug === g.slug)) it.teaches.push({ slug: g.slug, name: g.name, from: g.from });
  }
  return capped([...bySteps.values()], all);
}

/**
 * YOUR MAP for one reader. @param userId the signed-in user, or null
 * @param opts { all: one of SECTIONS — that section is returned uncapped ("see all", up to SEE_ALL_MAX) }
 */
export function computeYourMap(db, userId, { all = null } = {}) {
  atlasPostingsChanged(db);   // ⭐ D118 P1: a posting written a moment ago is counted before anything is read
  const idx = atlasIndex(db);
  if (userId == null) return { signedIn: false, map: false, ...explore(db, idx) };
  // ⚠ D120 P1: the Profile's skills, else the base résumé's parsed skills; the upload line only with no résumé at all.
  const { terms, source: skillsFrom, hasResume } = haveTerms(db, userId);
  // ⭐ D178-2 · "you have 0 of N" with claims: Your map counted the Profile's list only, while Your skills (D169) also
  // counts the skills claimed on postings. Both now read the same names, and a family says how many are PROVEN (a passed
  // check or a build) and how many only CLAIMED.
  const proven = new Set();
  for (const s of safeRead(() => yourSkillStates(db, userId), [])) {
    const t = termOf(s.name);
    if (!t) continue;
    const all = [t, ...safeRead(() => aliasesOf(db, t), [])];
    for (const x of all) { terms.add(x); if (s.state === "checked" || s.state === "built") proven.add(x); }
  }
  if (!terms.size) {
    return hasResume ? { signedIn: true, map: false, reason: "no_skills_read", ...explore(db, idx), prompt: NO_SKILLS_READ }
      : { signedIn: true, map: false, reason: "no_profile_skills", ...explore(db, idx) };
  }
  const have = idx.nodes.filter(n => n.kind !== "role" && n.status === "published" && terms.has(n.term));
  const profileIds = new Set(have.map(n => n.id));
  const provenIds = new Set(have.filter(n => proven.has(n.term)).map(n => n.id));
  const rollup = boardCounts(db, idx.nodes);
  const targets = targetRoleIds(db, userId, postingMatcher(db, idx.nodes.filter(n => n.kind === "role" && n.status === "published")));
  // ⭐ D116 M8 · the course unlocks the tree: a node whose teaching step is complete is LEARNED, and the sections, the
  // route and Next up recompute as if the user had it. ⛔ It is not on the Profile (nor the résumé) — `have` stays the
  // Profile's, and closeness counts only the Profile's skills (the board does not know what someone learned).
  const learning = nodeLearnStates(db, userId, idx);
  const learnedIds = new Set([...learning].filter(([id, l]) => l.state.complete && !profileIds.has(id)).map(([id]) => id));
  const haveIds = new Set([...profileIds, ...learnedIds]);
  const ctx = { idx, rollup, have, haveIds, targets };
  const haveSkills = haveSection(have, all === "haveSkills");
  const nextLevel = nextLevelSection(db, userId, ctx, all === "nextLevel");
  const adjacent = adjacentSection(db, ctx, all === "adjacent");
  const branches = branchesSection(db, ctx, all === "branches");
  // The top gaps, in the sections' order: what grows you to the next level, then the adjacent, then the branches' missing.
  const gaps = [
    ...nextLevel.items.map(i => ({ slug: i.slug, name: i.name, from: "nextLevel" })),
    ...adjacent.items.map(i => ({ slug: i.slug, name: i.name, from: "adjacent" })),
    ...branches.items.flatMap(b => b.missing.map(m => ({ slug: m.slug, name: m.name, from: "branches" }))),
  ];
  const learnNext = learnNextSection(db, userId, { idx, gaps }, all === "learnNext");
  // ⭐ D116 M1 · the tree: one response draws the whole map (the client only lays it out, M2).
  const tree = yourTree(db, userId, { idx, rollup, profileIds, provenIds, learnedIds, learning, targets });
  return {
    signedIn: true, map: true, skillsFrom,
    ...(skillsFrom === "resume" ? { nudge: CONFIRM_ON_PROFILE } : {}),
    targetRoles: targets.map(id => nodeOut(idx.byId.get(id))),
    board: { postings: rollup.postings, levelRead: rollup.levelRead },
    tree,
    haveSkills, nextLevel, adjacent, branches, learnNext,
    // ⭐ D120 P2 · the home's side column (signed in): Explore by role and the recently published pages, beside the map
    exploreByRole: exploreByRole(db, idx), recent: recentlyPublished(db),
    ...(have.length ? {} : { reason: "no_skills_on_the_atlas", ...explore(db, idx) }),
  };
}
