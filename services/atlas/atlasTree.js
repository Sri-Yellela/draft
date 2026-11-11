// services/atlas/atlasTree.js — ⭐ D116 M1 · THE TREE'S DATA (owner 10-31: "alright approved"). One response draws the
// whole map; the client only lays it out (M2, client/src/pages/atlas/atlasTreeLayout.js) and draws it.
//
//   yourTree     Your map (GET /api/atlas/me → `tree`): per node — slug, name, kind, family, have, learned, state,
//                postings (live, D118), closeness (the share of its postings that also ask for 2+ of the user's skills),
//                askedWith (the user's skills it co-occurs with, ranked), parent (the user's skill IN ITS FAMILY it is
//                most asked with, ties → more postings; else the trunk), mid / senior shares for the aim role (D106
//                levels), ring, routeStep, courseStep (D115 P4b), the side panel's facts (M5, verbatim patterns);
//                per family — haveCount, learnedCount, total, the list order; the user — role, level, aim.
//   roleTree     a role page (M7): centre = the role, its top skills, distance = the share of its postings asking.
//   familyTree   a family page (M7): centre = the family, distance = the share of postings asking for any of its skills.
//
// ⛔ ONE MATCHER: every count is the live rows' (atlasLive.js — the readings the counts were moved by); before the first
// full pass, one pass of the one matcher (postingMatcher.js). ⛔ Only PUBLISHED nodes, and only nodes with a family
// (a node with no family is not drawn; it stays in search and on its page). ⛔ No model (D17). Thresholds: YOUR_MAP.
// ⭐ M8 · THE COURSE UNLOCKS THE TREE — the seam D117 fills: a node names the course step that teaches it
// (learnStepForNode: today D115's tracker, through its concept index — one step per node), and its state is read from
// the user's marks by THE one rule (shared/learnStepState.js): learned = every required item done and every checkpoint
// explained; learning = some done ("3 of 5 in its step"). ⭐ D117 filled the seam: `stepsTeaching` reads the pieces'
// own taught terms (learn_teaches), and the rule is C8's — progress EARNED (opened from draft, explained in writing,
// the build linked), never ticked (services/learn/learnEarned.js). ⛔ learned never reaches the Profile or the résumé by itself; closeness counts only the
// Profile's skills.

import { YOUR_MAP, AIM_LEVEL, atlasIndex, boardCounts, midSeniorFor, aimSkillCounts, userBandLabel } from "./atlasMe.js";
import { liveReadings, atlasPostingsChanged } from "./atlasLive.js";
import { postingMatcher, ACTIVE_POSTINGS_WHERE, POSTING_TEXT_SQL, levelReadColumn } from "./atlasStats.js";
import { profileTerms } from "./atlasStore.js";
import { learnStepForNode, learnStepPath, learnStepInfo } from "../learn/learnLinks.js";
import { stepsTeachingNodeId, stepsTeachingByNode } from "../learn/learnCircle.js";
import { learnContent, stepsOf } from "../learn/learnContent.js";
import { earnedMarks } from "../learn/learnEarned.js";
import { stepState } from "../../shared/learnStepState.js";
import { FAMILIES, isFamily, familyName } from "../../shared/atlasFamilies.js";
import { roleCategoryFilter } from "./atlasCategories.js";
import { familyCountLine } from "../../shared/atlasFamilyCount.js";

export const NO_AIM = Object.freeze({ line: "Set an aim to see what seniority adds", path: "/app/job-profiles", label: "Set an aim" });

const pct = (c, n) => (n ? Math.round((c / n) * 100) : 0);
const list = (names) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] || "");
const postingsWord = (n) => `open posting${n === 1 ? "" : "s"}`;
const drawable = (n) => n && n.kind !== "role" && n.status === "published" && isFamily(n.family);

// ── the board's readings ────────────────────────────────────────────────────────────────────────

let fallback = { db: null, key: null, rows: null };
/** Every active posting's reading { asked, roleId, level }: the live rows, else one pass of the one matcher. */
export function boardReadings(db, nodes) {
  const live = liveReadings(db);
  if (live) return live;
  const key = `${db.prepare(`SELECT MAX(computed_at) FROM atlas_node_stats`).pluck().get() ?? null}:${nodes.length}`;
  if (fallback.db === db && fallback.key === key) return fallback.rows;
  const match = postingMatcher(db, nodes, { bulk: true });
  const rows = [];
  for (const p of db.prepare(`SELECT ${POSTING_TEXT_SQL}, ${levelReadColumn(db)} FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE}`).iterate()) {
    rows.push({ asked: match.askedBy(p), roleId: match.roleOf(p.title), level: p.level_read || null });
  }
  fallback = { db, key, rows };
  return rows;
}

/**
 * Closeness, from the readings: per node — its postings, how many of them also ask for ≥ CLOSE_MIN_MINE of the user's
 * skills (the node itself not counted), and how often it is asked with each of the user's skills.
 * @returns Map(nodeId → { postings, close, with: Map(mineId → together) })
 *
 * ⭐ A175 (46g, measured on staging — 8 vCPU, 100k postings, 20 users): this walk over every active posting's reading ran
 * on EVERY Your map request and was 18.6 % of the main thread under load (the board waited behind it). It is a pure
 * function of the readings ARRAY (boardReadings' cached rows — a rebuild is a new array) and the skill set, and its
 * callers only read the result, so it is kept per readings array (WeakMap — dropped with it) and skill-set key.
 */
const closenessMemo = new WeakMap();
export function closenessCounts(readings, mineIds) {
  const key = [...mineIds].map(String).sort().join(",");
  let byKey = closenessMemo.get(readings);
  if (!byKey) { byKey = new Map(); closenessMemo.set(readings, byKey); }
  const kept = byKey.get(key);
  if (kept) return kept;
  const out = computeCloseness(readings, mineIds);
  if (byKey.size >= 500) byKey.clear();
  byKey.set(key, out);
  return out;
}
function computeCloseness(readings, mineIds) {
  const out = new Map();
  for (const r of readings) {
    const mine = r.asked.filter(id => mineIds.has(id));
    for (const id of r.asked) {
      let e = out.get(id);
      if (!e) out.set(id, e = { postings: 0, close: 0, with: new Map() });
      e.postings++;
      if (mine.length - (mineIds.has(id) ? 1 : 0) >= YOUR_MAP.CLOSE_MIN_MINE) e.close++;
      for (const h of mine) if (h !== id) e.with.set(h, (e.with.get(h) || 0) + 1);
    }
  }
  return out;
}

// ── M8 · the course ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ M8's seam, filled by ⭐ D117: the pieces that teach a node — the pieces whose stored terms (learn_teaches, C9's
 * teaches_derived) resolve to it through the one resolver, then D115 P4b's step pointer (the tracker's concept index and
 * patterns) where no piece names it. This is the one place the tree reads them.
 */
// ⭐ D151 (45k): `byNode` (stepsTeachingByNode, read once) for a caller that loops over every node — measured on the 100k
// suite, teachIndex's per-call key check (three statements) × every published node was ≈ 10 s of a 61 s main-thread window.
export function stepsTeaching(db, node, learn, byNode = null) {
  const ids = node.id == null ? [] : byNode ? (byNode.get(node.id) || []) : stepsTeachingNodeId(db, node.id);
  const out = ids.map(id => learnStepInfo(learn, id)).filter(Boolean);
  if (!out.length) {
    const s = learnStepForNode(db, { name: node.name, term: node.term }, learn);
    if (s) out.push(s);
  }
  return out;
}

/**
 * Each published node's teaching step and the user's state on it: Map(nodeId → { step, state: { done, total, complete,
 * started } }). Only nodes a step teaches are present. A node taught by several steps is learned when all are complete.
 */
export function nodeLearnStates(db, userId, idx = atlasIndex(db)) {
  const out = new Map();
  let learn;
  try { learn = learnContent(db); } catch { return out; }
  const stepById = new Map(stepsOf(learn).map(s => [s.id, s]));
  // ⭐ D117 C8 / D116 M8: learned uses THE earned rule — opened from draft, explained in writing, the build linked.
  const marks = earnedMarks(db, userId);
  const byNode = stepsTeachingByNode(db);
  for (const n of idx.nodes) {
    if (n.kind === "role" || n.status !== "published") continue;
    const steps = stepsTeaching(db, n, learn, byNode).filter(s => stepById.has(s.stepId));
    if (!steps.length) continue;
    const states = steps.map(s => stepState(stepById.get(s.stepId), marks));
    const done = states.reduce((a, s) => a + s.done, 0), total = states.reduce((a, s) => a + s.total, 0);
    out.set(n.id, { step: steps[0], state: { done, total, complete: states.every(s => s.complete), started: states.some(s => s.started) } });
  }
  return out;
}

const courseStepOut = (l) => (l ? { stepId: l.step.stepId, label: l.step.label, title: l.step.title, path: learnStepPath(l.step.stepId) } : null);

// ── Your map ────────────────────────────────────────────────────────────────────────────────────

function routeWhen(step) {
  return step <= YOUR_MAP.ROUTE_EARLY_STEPS ? "early" : step <= YOUR_MAP.ROUTE_MIDWAY_STEPS ? "mid-way" : "later";
}

/**
 * The tree of Your map. @param ctx { idx, rollup, profileIds (Profile skills), learnedIds, learning (nodeLearnStates),
 * targets (the user's target role ids, first = the aim) }
 */
export function yourTree(db, userId, { idx, rollup, profileIds, provenIds = new Set(), learnedIds, learning, targets }) {
  const asIf = new Set([...profileIds, ...learnedIds]);
  const readings = boardReadings(db, idx.nodes);
  const counts = closenessCounts(readings, profileIds);
  const aim = targets.length ? idx.byId.get(targets[0]) : null;
  const shares = aim ? midSeniorFor(rollup, aim.id) : null;

  const cands = idx.nodes.filter(n => drawable(n) && (asIf.has(n.id) || (counts.get(n.id)?.postings ?? 0) > 0));
  const nodes = new Map();
  for (const n of cands) {
    const c = counts.get(n.id) || { postings: 0, close: 0, with: new Map() };
    const have = profileIds.has(n.id), learned = learnedIds.has(n.id);
    const l = learning.get(n.id);
    const askedWith = [...c.with].map(([id, together]) => ({ n: idx.byId.get(id), together }))
      .filter(w => w.n && w.n.status === "published")
      .sort((a, b) => b.together - a.together || b.n.postings - a.n.postings || a.n.name.localeCompare(b.n.name))
      .map(w => ({ slug: w.n.slug, name: w.n.name, family: w.n.family ?? null, together: w.together }));
    const ms = shares ? shares(n.id) : null;
    nodes.set(n.id, {
      slug: n.slug, name: n.name, kind: n.kind, family: n.family,
      have, learned,
      state: have ? "have" : learned ? "learned" : l?.state.started ? "learning" : "not_yet",
      progress: l && !have && !learned && l.state.started ? { done: l.state.done, total: l.state.total } : null,
      postings: n.postings,
      closeness: c.postings ? pct(c.close, c.postings) : null,
      askedWith,
      // M2: the user's skill IN THIS FAMILY it is most asked with (ties → more postings); none → the trunk (null).
      parent: have ? null : (askedWith.find(w => w.family === n.family)?.slug ?? null),
      midShare: ms ? ms.mid : null, seniorShare: ms ? ms.senior : null, rise: ms ? ms.rise : null,
      rises: !!(ms && ms.rises && !asIf.has(n.id)),
      ring: asIf.has(n.id) ? "have" : ms?.rises ? "rises" : "other",
      routeStep: null, routeTotal: null, nextUp: false, onTree: false,
      courseStep: courseStepOut(l),
    });
  }

  // The route to the aim: the aim role's top skills not yet had (or learned), closest first.
  if (aim) {
    const top = [...aimSkillCounts(rollup, aim.id)].filter(([id]) => nodes.has(id))
      .sort((a, b) => b[1] - a[1] || idx.byId.get(a[0]).name.localeCompare(idx.byId.get(b[0]).name))
      .slice(0, YOUR_MAP.ROUTE_SKILLS).map(([id]) => nodes.get(id)).filter(t => !t.have && !t.learned)
      .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0) || b.postings - a.postings || a.name.localeCompare(b.name));
    top.forEach((t, i) => { t.routeStep = i + 1; t.routeTotal = top.length; });
  }
  // Next up (M5): the highest closeness × log(postings), not had, not learned.
  const nextUp = [...nodes.values()].filter(t => !t.have && !t.learned && t.postings > 1)
    .map(t => ({ t, score: (t.closeness ?? 0) * Math.log(t.postings) }))
    .sort((a, b) => b.score - a.score || b.t.postings - a.t.postings || a.t.name.localeCompare(b.t.name))[0]?.t ?? null;
  if (nextUp) nextUp.nextUp = true;

  // Per family: who is drawn (M1 cap) and the list order (M4: yours first by postings, then closest → furthest).
  const families = [];
  for (const f of FAMILIES) {
    const members = [...nodes.values()].filter(t => t.family === f.key);
    if (!members.length) continue;   // M9: a family with no node is not drawn
    const byPostings = (a, b) => b.postings - a.postings || a.name.localeCompare(b.name);
    const mine = members.filter(t => t.have).sort(byPostings);
    const learnedHere = members.filter(t => t.learned).sort(byPostings);
    const rest = members.filter(t => !t.have && !t.learned)
      .sort((a, b) => (b.closeness ?? 0) - (a.closeness ?? 0) || byPostings(a, b));
    const score = (t) => t.postings * (t.closeness ?? 0);
    const pinned = rest.filter(t => t.nextUp || t.routeStep).sort((a, b) => (b.nextUp - a.nextUp) || (a.routeStep ?? Infinity) - (b.routeStep ?? Infinity));
    const others = rest.filter(t => !pinned.includes(t)).sort((a, b) => score(b) - score(a) || byPostings(a, b));
    const slots = Math.max(0, YOUR_MAP.TREE_PER_FAMILY - mine.length - learnedHere.length);
    for (const t of [...mine, ...learnedHere, ...[...pinned, ...others].slice(0, slots)]) t.onTree = true;
    const order = [...mine, ...learnedHere, ...rest];
    const drawn = order.filter(t => t.onTree).length;
    // ⭐ D178-2: of the skills you have here, how many are PROVEN (checked / built) and how many only claimed.
    const provenCount = mine.filter(t => provenIds.has(t.id)).length, claimedCount = mine.length - provenCount;
    families.push({ key: f.key, name: f.name, haveCount: mine.length, provenCount, claimedCount, learnedCount: learnedHere.length, total: members.length,
      drawn, more: members.length - drawn, order: order.map(t => t.slug),
      tag: `${f.name.toUpperCase()} · ${familyCountLine({ provenCount, claimedCount, learnedCount: learnedHere.length, total: members.length })}` });
  }

  // M5 · the side panel's facts (the owner's chosen sentences, verbatim patterns).
  const all = [...nodes.values()];
  for (const t of all) {
    if (t.have) {
      t.facts = {
        postings: `Asked for in ${t.postings} ${postingsWord(t.postings)}`,
        opensToward: all.filter(o => !o.have && o.askedWith.some(w => w.slug === t.slug))
          .sort((a, b) => b.askedWith.find(w => w.slug === t.slug).together - a.askedWith.find(w => w.slug === t.slug).together || b.postings - a.postings || a.name.localeCompare(b.name))
          .slice(0, YOUR_MAP.OPENS_TOWARD_NAMES).map(o => ({ slug: o.slug, name: o.name })),
      };
      t.sub = `${t.postings} postings`;
      continue;
    }
    const names = t.askedWith.slice(0, YOUR_MAP.ASKED_WITH_NAMES).map(w => w.name);
    t.facts = {
      closeness: t.postings && t.closeness != null
        ? `${t.name} is asked for in ${t.postings} ${postingsWord(t.postings)}, and ${t.closeness} % of those also ask for two or more skills you have${names.length ? ` (${list(names)})` : ""}.`
        : null,
      slope: aim && t.midShare != null
        ? `${t.midShare} % of mid ${aim.name} postings, ${t.seniorShare} % of senior (${t.rise >= 0 ? "+" : ""}${t.rise} points).`
        : null,
      route: t.routeStep
        ? `Step ${t.routeStep} of ${t.routeTotal}. It's ${t.closeness ?? 0} % close to what you know, so it comes ${routeWhen(t.routeStep)}.`
        : null,
      progress: t.progress ? `${t.progress.done} of ${t.progress.total} in its step` : null,
      // ⛔ M8 honesty: learned is the user's to add — never written to the Profile by itself.
      addToProfile: t.learned ? `Add ${t.name} to my Profile` : null,
    };
    t.sub = `${t.closeness ?? 0} % close · ${t.postings}`;
  }

  return {
    page: "you",
    user: {
      role: aim ? { slug: aim.slug, name: aim.name } : null,
      level: userBandLabel(db, userId),
      aim: aim ? { slug: aim.slug, name: aim.name, level: AIM_LEVEL } : null,
    },
    ...(aim ? {} : { noAim: NO_AIM }),
    nextUp: nextUp ? nextUp.slug : null,
    route: all.filter(t => t.routeStep).sort((a, b) => a.routeStep - b.routeStep).map(t => t.slug),
    families,
    nodes: all.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ── M7 · role and family pages ──────────────────────────────────────────────────────────────────

function viewer(db, userId, idx) {
  if (userId == null) return null;
  const terms = profileTerms(db, userId);
  return new Set(idx.nodes.filter(n => n.kind !== "role" && n.status === "published" && terms.has(n.term)).map(n => n.id));
}

function familiesOf(nodes) {
  return FAMILIES.filter(f => nodes.some(n => n.family === f.key)).map(f => {
    const members = nodes.filter(n => n.family === f.key);
    return { key: f.key, name: f.name, haveCount: members.filter(n => n.have).length, total: members.length, drawn: members.length, more: 0,
      order: [...members].sort((a, b) => (b.have - a.have) || b.share - a.share || a.name.localeCompare(b.name)).map(n => n.slug) };
  });
}

/** A PUBLISHED role's tree (M7), or null. Signed out: every node coloured, no rings. */
export function roleTree(db, slug, userId = null) {
  atlasPostingsChanged(db);
  const idx = atlasIndex(db);
  const role = idx.nodes.find(n => n.slug === String(slug));
  if (!role || role.kind !== "role" || role.status !== "published") return null;
  const rollup = boardCounts(db, idx.nodes);
  const r = rollup.roles.get(role.id);
  const postings = r?.postings ?? 0;
  const mine = viewer(db, userId, idx);
  const shares = midSeniorFor(rollup, role.id);
  const keep = roleCategoryFilter(db, role);   // ⭐ A111 P3: the role's own category's skills (D127), as its page
  const top = [...(r?.skill ?? new Map())].map(([id, c]) => [idx.byId.get(id), c]).filter(([n]) => drawable(n) && keep(n))
    .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).slice(0, YOUR_MAP.ROLE_TREE_SKILLS);
  const nodes = top.map(([n, c]) => {
    const have = mine ? mine.has(n.id) : true;
    const share = pct(c, postings);
    return { slug: n.slug, name: n.name, kind: n.kind, family: n.family, postings: n.postings, share, have, learned: false,
      state: have ? "have" : "not_yet", parent: null, onTree: true,
      ring: mine ? (have ? "have" : shares?.(n.id).rises ? "rises" : "other") : null,
      sub: `${share} % of postings` };
  });
  let cover = null;
  if (mine) {
    const missing = nodes.filter(n => !n.have);
    const named = missing.slice(0, YOUR_MAP.ROLE_TREE_MISSING_NAMES).map(m => `${m.name} ${m.share} %`);
    cover = { have: nodes.length - missing.length, of: nodes.length, missing: missing.map(m => ({ slug: m.slug, name: m.name, share: m.share })),
      line: `You cover ${nodes.length - missing.length} of ${nodes.length}${missing.length ? `; missing ${named.join(", ")}${missing.length > named.length ? ", …" : ""}` : ""}` };
  }
  return { page: "role", centre: { slug: role.slug, name: role.name, postings }, signedIn: mine != null, cover,
    families: familiesOf(nodes), nodes };
}

/** A family's tree (M7), or null for an unknown family. Distance = the share of postings asking for any of its skills. */
export function familyTree(db, key, userId = null) {
  if (!isFamily(key)) return null;
  atlasPostingsChanged(db);
  const idx = atlasIndex(db);
  const members = idx.nodes.filter(n => drawable(n) && n.family === key);
  const ids = new Set(members.map(n => n.id));
  const readings = boardReadings(db, idx.nodes);
  let any = 0;
  const asked = new Map();
  for (const r of readings) {
    let hit = false;
    for (const id of r.asked) if (ids.has(id)) { hit = true; asked.set(id, (asked.get(id) || 0) + 1); }
    if (hit) any++;
  }
  const mine = viewer(db, userId, idx);
  const ranked = members.filter(n => asked.get(n.id)).sort((a, b) => asked.get(b.id) - asked.get(a.id) || a.name.localeCompare(b.name));
  const nodes = ranked.slice(0, YOUR_MAP.FAMILY_TREE_MAX).map(n => {
    const have = mine ? mine.has(n.id) : true;
    const share = pct(asked.get(n.id), any);
    return { slug: n.slug, name: n.name, kind: n.kind, family: n.family, postings: n.postings, share, have, learned: false,
      state: have ? "have" : "not_yet", parent: null, onTree: true, ring: mine ? (have ? "have" : "other") : null, sub: `${share} % of postings` };
  });
  const fam = familiesOf(nodes);
  if (fam[0]) { fam[0].total = ranked.length; fam[0].more = ranked.length - nodes.length; }
  return { page: "family", centre: { key, name: familyName(key), postings: any }, signedIn: mine != null,
    families: fam, nodes, more: ranked.slice(YOUR_MAP.FAMILY_TREE_MAX).map(n => ({ slug: n.slug, name: n.name, share: pct(asked.get(n.id), any) })) };
}
