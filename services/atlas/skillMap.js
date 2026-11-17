// services/atlas/skillMap.js — ⭐ A228 (46r, owner 11-16 "Build it" on docs/sketches/A228-ab-combined.html) · THE SKILL MAP
// as one reading: for one person and one role, how many of the role's open jobs they can apply for today, how close they
// are to every other job (a 10-bin histogram), what the role's jobs ask for (by family), the shortest order to learn or
// prove the next skills (jobs gained per hour), and the neighbouring roles they could move to.
//
// ⛔ D190: nothing here calls a model — every number is COUNTED from atlas_posting_match (the ONE matcher's reading of
// each open posting, services/atlas/atlasLive.js) and the person's own skill states (services/yourSkills.js).
//
// ONE DEFINITION of "a job you can apply for" (it replaces the three "have for a role" readings A228 found):
//   a posting's share = Σ credit(ask) / its asks, credit: proven 1 · on the résumé 1 · not yet 0 (⭐ owner 11-17,
//   46s: "counts in full" — at 0.5 nobody without a proof could ever reach the line; proof is drawn, not counted);
//   applicable ⇔ share ≥ SKILL_MAP.APPLY_SHARE.
// The sketch's "last used before 2024 = 0.25" rule is DROPPED: a claimed skill carries no date (profile_skills has no
// recency column — docs/A228_SKILL_MAP.md §3), so every claim counts the same (in full since owner 11-17).
//
// ⛔ PERFORMANCE (memory: sync SQL on the one thread froze production — A126, A158, A162, A186). The per-role COMPACT INDEX
// (posting → its ask node ids, its level, its company; and node → the postings asking for it) is built ONCE per process
// from one read of atlas_posting_match, kept per database and rebuilt only when atlas_live_state 'version' moves (every
// drain writes a new one). A request then does in-memory arithmetic only over typed arrays, and its answer is cached per
// (user, role, the user's skill-state hash, version).
// THE ACTIVE RULE: atlas_posting_match holds exactly the postings that pass the board's own ACTIVE_POSTINGS_WHERE — the
// live drain reads every queued posting under that rule and DROPS its row when it fails (atlasLive.js syncNow; triggers
// queue every close, expiry and dedup), and the reader drains first. So the index reads the match rows alone: joining
// scraped_jobs for the rule measured 3–5 s on a cold page cache at 100k (its rows carry the description text) against
// ~70 ms for the match rows. A company's display name is read only for the few companies an answer names (by primary key).
import { ACTIVE_POSTINGS_WHERE, postingMatcher } from "./postingMatcher.js";
import { atlasPostingsChanged, liveVersion } from "./atlasLive.js";
import { atlasIndex, targetRoleIds } from "./atlasMe.js";
import { aliasesOf, termOf, headingStrippedNames } from "./atlasStore.js";
import { categoryIndex, roleCategory, registryCached } from "./atlasCategories.js";
import { familyName } from "../../shared/atlasFamilies.js";
import { LEVELS_READ } from "../../shared/postingLevel.js";
import { yourSkillStates } from "../yourSkills.js";
import { aimRoleFor, NAVIGATOR } from "../navigator.js";
import { learnStepForNode } from "../learn/learnLinks.js";

/** ⭐ Every number of the skill map — tuned here and nowhere else. */
export const SKILL_MAP = Object.freeze({
  /** a job you can apply for: you have at least this share of what it asks (credit-weighted) */
  APPLY_SHARE: 0.6,
  /** credit per state — proven (a check passed, a build, a proof link) · on the résumé (claimed) · not yet */
  CREDIT: Object.freeze({ proven: 1, claimed: 1, missing: 0 }),
  /** the histogram's bins (0–10 %, 10–20 %, … 90–100 %) */
  BINS: 10,
  /** the role's most-asked skills drawn in the map / list */
  TOP_ASKS: 20,
  /** the by-level split is shown only when at least this share of the role's judged jobs carries a level read (D106) */
  LEVEL_FILL_MIN: 0.2,
  /** Learn next: at most this many steps */
  ROUTE_STEPS: 5,
  /** …chosen among the role's this-many most-asked skills not yet proven (keeps a step's arithmetic bounded) */
  ROUTE_CANDIDATES: 40,
  /** ⚠ an ESTIMATE, not a measurement: the hours to prove a skill that has no atlas_resources.hours of its own */
  HOURS_FALLBACK: 20,
  /** the companies named under a step (the most frequent among the jobs that step opens) */
  STEP_COMPANIES: 4,
  /** Jobs you could move to: up to this many neighbouring roles beside the aim and the current role */
  MOVE_ROLES: 5,
  /** …the navigator's own candidate rule (services/navigator.js): same category, at least this many open jobs, top N */
  MOVE_MIN_POSTINGS: NAVIGATOR.MIN_POSTINGS,
  MOVE_CANDIDATES: NAVIGATOR.CANDIDATE_ROLES,
  /** "hours to 30 % applicable" — the share of a role's jobs, and how many route steps are tried to reach it */
  MOVE_REACH_SHARE: 0.3,
  MOVE_REACH_STEPS: 8,
  /** a card names this many skills that carry over / this many to learn */
  CARRY_NAMES: 5,
  MISSING_NAMES: 3,
  /** the answers kept per process (cleared, not evicted one by one, past this) */
  CACHE_MAX: 500,
});

// The kinds a job "asks for" — a concept or a pattern is a learning page, not a requirement (atlasRoleFit.js READ_KINDS).
const ASK_KINDS = new Set(["skill", "tool", "stack"]);
const EPS = 1e-9;
const safe = (fn, d) => { try { return fn(); } catch { return d; } };

// ── the compact index (one per database, per version of the live store) ─────────────────────────────

const indexMemo = new WeakMap();   // db → { version, index }

/**
 * PURE over its rows. The compact per-role index.
 * @param rows [{ postingId, roleId, level, asked: number[], company }] — active postings; company = its key (or name)
 * @param isAsk (nodeId) → boolean — counts this node as an ask
 * @returns Map(roleId → { open, n, offs: Int32Array, asks: Int32Array, level: Uint8Array, company: Int32Array,
 *          byNode: Map(nodeId → Int32Array of posting indexes), askCount: Map(nodeId → count), levelRead })
 *          + companies: [{ key, postingId }] — one posting per company, to read its display name from
 */
export function buildRoleIndex(rows, isAsk = () => true) {
  const companies = [], companyAt = new Map();
  const groups = new Map();
  for (const r of rows) {
    if (r.roleId == null) continue;
    let g = groups.get(r.roleId);
    if (!g) groups.set(r.roleId, g = { open: 0, list: [] });
    g.open++;
    const asks = [...new Set(r.asked)].filter(isAsk);
    if (!asks.length) continue;   // a job that asks for nothing we can read is open, but not judged
    const ck = String(r.company || "").trim().toLowerCase();
    let ci = -1;
    if (ck) { ci = companyAt.get(ck); if (ci == null) { ci = companies.length; companies.push({ key: String(r.company).trim(), postingId: r.postingId ?? null }); companyAt.set(ck, ci); } }
    g.list.push({ asks, level: Math.max(0, LEVELS_READ.indexOf(r.level) + 1), ci });
  }
  const roles = new Map();
  for (const [roleId, g] of groups) {
    const n = g.list.length;
    const offs = new Int32Array(n + 1);
    let total = 0;
    for (let i = 0; i < n; i++) { offs[i] = total; total += g.list[i].asks.length; }
    offs[n] = total;
    const asks = new Int32Array(total), level = new Uint8Array(n), company = new Int32Array(n);
    const postingsOf = new Map();
    let levelRead = 0;
    g.list.forEach((p, i) => {
      asks.set(p.asks, offs[i]);
      level[i] = p.level; company[i] = p.ci;
      if (p.level) levelRead++;
      for (const id of p.asks) { let l = postingsOf.get(id); if (!l) postingsOf.set(id, l = []); l.push(i); }
    });
    const byNode = new Map(), askCount = new Map();
    for (const [id, l] of postingsOf) { byNode.set(id, Int32Array.from(l)); askCount.set(id, l.length); }
    roles.set(roleId, { open: g.open, n, offs, asks, level, company, byNode, askCount, levelRead });
  }
  return { roles, companies };
}

/** The index for this database, rebuilt only when the live store's version moves. @returns { version, roles, companies, … } */
export function skillMapIndex(db, { clock = () => performance.now() } = {}) {
  const version = liveVersion(db);
  const m = indexMemo.get(db);
  if (m && m.version === version) return m.index;
  const t0 = clock();
  const idx = atlasIndex(db);
  const isAsk = (id) => ASK_KINDS.has(idx.byId.get(id)?.kind);
  const rows = [];
  // ⛔ ONE read of the live rows (the active set — see THE ACTIVE RULE above), never a scan per request.
  for (const [postingId, roleId, level, asked, company] of db.prepare(`SELECT posting_id, role_id, level, asked, company_key
      FROM atlas_posting_match WHERE role_id IS NOT NULL`).raw().all()) {
    rows.push({ postingId, roleId, level, asked: asked ? asked.split(",").map(Number) : [], company });
  }
  const built = buildRoleIndex(rows, isAsk);
  // Hours to a proof: the node's quickest resource (atlas_resources.hours), and each node's Wikipedia thumbnail.
  const hours = new Map(safe(() => db.prepare(`SELECT node_id, MIN(hours) FROM atlas_resources WHERE hours > 0 GROUP BY node_id`).raw().all(), []));
  const thumbs = new Map(safe(() => db.prepare(`SELECT node_id, thumbnail_url FROM atlas_wiki_cache WHERE TRIM(COALESCE(thumbnail_url, '')) != ''`).raw().all(), []));
  const roleNodes = idx.nodes.filter(n => n.kind === "role");
  const termToIds = new Map();
  for (const n of idx.nodes) {
    if (!ASK_KINDS.has(n.kind) || !n.term) continue;
    let s = termToIds.get(n.term); if (!s) termToIds.set(n.term, s = []); s.push(n.id);
  }
  const index = { version, ...built, hours, thumbs, idx, roleNodes, termToIds, roleMatcher: null, rows: rows.length, buildMs: 0, names: new Map() };
  index.buildMs = Math.round(clock() - t0);
  indexMemo.set(db, { version, index });
  answers.clear();
  return index;
}

// ── the person ──────────────────────────────────────────────────────────────────────────────────

/**
 * The person's credit per Atlas node: proven (checked / built) 1, claimed 1 (owner 11-17) — the same names and states Your skills
 * reads (yourSkillStates), matched to nodes by term and confirmed alias (as Your map does, atlasMe.js).
 * @returns {{ credit: Map(nodeId → 1), proven: Set(nodeId), counts: { proven, claimed }, hash }} — `proven` keeps the state the
 *   map draws (solid vs hatched) now that both count the same
 */
export function personCredit(db, userId, index) {
  const credit = new Map(), proven = new Set();
  for (const s of safe(() => yourSkillStates(db, userId), [])) {
    const t = termOf(s.name);
    if (!t) continue;
    const isProven = s.state === "checked" || s.state === "built";
    const c = isProven ? SKILL_MAP.CREDIT.proven : SKILL_MAP.CREDIT.claimed;
    const idsOf = (tt) => [tt, ...safe(() => aliasesOf(db, tt), [])].flatMap(term => index.termToIds.get(term) || []);
    let ids = idsOf(t);
    // 46s: "Languages Java" (a heading glued to the first skill of a résumé line) → "Java"
    if (!ids.length) for (const rest of headingStrippedNames(s.name)) { const tt = termOf(rest); ids = tt ? idsOf(tt) : []; if (ids.length) break; }
    for (const id of ids) { if ((credit.get(id) || 0) < c) credit.set(id, c); if (isProven) proven.add(id); }
  }
  const hash = [...credit.entries()].sort((a, b) => a[0] - b[0]).map(([id, c]) => `${id}:${c}${proven.has(id) ? "p" : ""}`).join(",");
  return { credit, proven, counts: { proven: proven.size, claimed: credit.size - proven.size }, hash };
}

// ── the arithmetic (PURE over the index and a credit map) ──────────────────────────────────────────

/** Each judged posting's credit sum (×2, an integer) and its ask count. */
function sums(r, credit) {
  const s2 = new Int32Array(r.n), len = new Int32Array(r.n);
  for (let i = 0; i < r.n; i++) {
    let s = 0;
    for (let j = r.offs[i]; j < r.offs[i + 1]; j++) s += Math.round(2 * (credit.get(r.asks[j]) || 0));
    s2[i] = s; len[i] = r.offs[i + 1] - r.offs[i];
  }
  return { s2, len };
}
const meets = (s2, len) => s2 >= 2 * SKILL_MAP.APPLY_SHARE * len - EPS;

/** How many of the role's judged jobs you can apply for, the 10-bin histogram, and the by-level split. */
export function readRole(r, credit) {
  const { s2, len } = sums(r, credit);
  const bins = Array.from({ length: SKILL_MAP.BINS }, (_, i) => ({ from: i / SKILL_MAP.BINS, to: (i + 1) / SKILL_MAP.BINS, jobs: 0 }));
  const lv = LEVELS_READ.map(level => ({ level, open: 0, applicable: 0 }));
  let applicable = 0;
  for (let i = 0; i < r.n; i++) {
    const share = s2[i] / (2 * len[i]);
    bins[Math.min(SKILL_MAP.BINS - 1, Math.floor(share * SKILL_MAP.BINS + EPS))].jobs++;
    const ok = meets(s2[i], len[i]);
    if (ok) applicable++;
    if (r.level[i]) { const l = lv[r.level[i] - 1]; l.open++; if (ok) l.applicable++; }
  }
  // ⛔ the levels are shown only where enough jobs carry one (the fixtures carry none: `levels` is null there)
  const levels = r.n && r.levelRead / r.n >= SKILL_MAP.LEVEL_FILL_MIN ? lv.filter(l => l.open > 0) : null;
  return { applicable, histogram: bins, levels, s2, len };
}

/** Credit-weighted share of a role's asks you have (Σ asks·credit / Σ asks) — "you have N % of it". */
export function coverageOf(r, credit) {
  let a = 0, b = 0;
  for (const [id, c] of r.askCount) { a += c * (credit.get(id) || 0); b += c; }
  return b ? a / b : 0;
}

/**
 * ⭐ Learn next — GREEDY: each step the not-yet-proven skill (missing → "Learn", on the résumé only → "Prove") that adds
 * the most applicable jobs per hour; proving it sets its credit to 1. Pure over the role's index.
 * @param hoursOf (nodeId) → { hours, estimated }
 * @returns [{ id, kind, gain, total, hours, estimated, opened: Int32Array }]
 */
export function greedyRoute(r, credit, hoursOf, { steps = SKILL_MAP.ROUTE_STEPS, candidates = SKILL_MAP.ROUTE_CANDIDATES, start = null } = {}) {
  const { s2, len } = start || sums(r, credit);
  const cur = new Int32Array(s2);
  const have = new Map(credit);
  let total = 0;
  for (let i = 0; i < r.n; i++) if (meets(cur[i], len[i])) total++;
  const pool = [...r.askCount.entries()].filter(([id]) => (have.get(id) || 0) < SKILL_MAP.CREDIT.proven)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, candidates).map(([id]) => id);
  const out = [];
  for (let k = 0; k < steps && pool.length; k++) {
    let best = null;
    for (const id of pool) {
      const add = Math.round(2 * (SKILL_MAP.CREDIT.proven - (have.get(id) || 0)));
      let gain = 0;
      for (const i of r.byNode.get(id) || []) if (!meets(cur[i], len[i]) && meets(cur[i] + add, len[i])) gain++;
      const h = hoursOf(id);
      const score = gain / Math.max(0.5, h.hours);
      if (gain > 0 && (!best || score > best.score + EPS || (Math.abs(score - best.score) <= EPS && gain > best.gain))) best = { id, gain, score, add, h };
    }
    if (!best) break;
    const opened = [];
    for (const i of r.byNode.get(best.id) || []) { if (!meets(cur[i], len[i]) && meets(cur[i] + best.add, len[i])) opened.push(i); cur[i] += best.add; }
    total += best.gain;
    out.push({ id: best.id, kind: (have.get(best.id) || 0) > 0 ? "prove" : "learn", gain: best.gain, total, hours: best.h.hours, estimated: best.h.estimated, opened: Int32Array.from(opened) });
    have.set(best.id, SKILL_MAP.CREDIT.proven);
    pool.splice(pool.indexOf(best.id), 1);
  }
  return out;
}

/** The most frequent companies among some of a role's postings. @param nameOf (companyIndex) → { name, iconUrl } */
export function topCompanies(r, postings, n = SKILL_MAP.STEP_COMPANIES, nameOf = () => ({ name: "", iconUrl: null })) {
  const count = new Map();
  for (const i of postings) { const c = r.company[i]; if (c >= 0) count.set(c, (count.get(c) || 0) + 1); }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([c, jobs]) => ({ ...nameOf(c), jobs }));
}

/** A company's display name and logo, read once per index by one posting's primary key (the board's active rule). */
function companyName(db, index, ci) {
  if (index.names.has(ci)) return index.names.get(ci);
  const c = index.companies[ci];
  const row = c?.postingId != null ? safe(() => db.prepare(`SELECT company, company_icon_url FROM scraped_jobs WHERE id = ? AND ${ACTIVE_POSTINGS_WHERE}`).get(c.postingId), null) : null;
  const out = { name: String(row?.company || c?.key || "").trim(), iconUrl: row?.company_icon_url || null };
  index.names.set(ci, out);
  return out;
}

// ── the reading ──────────────────────────────────────────────────────────────────────────────────

const answers = new Map();   // `${user}|${role}|${hash}|${version}` → the answer

/** The role a request names (a role node's id or slug), else the aim, else the current role, else the biggest. */
function chooseRole(db, userId, index, asked) {
  const byId = index.idx.byId;
  const aim = safe(() => aimRoleFor(db, userId), null);
  if (!index.roleMatcher) index.roleMatcher = safe(() => postingMatcher(db, index.roleNodes, { listOnly: true }), null);
  const currentId = index.roleMatcher ? safe(() => targetRoleIds(db, userId, index.roleMatcher)[0], null) ?? null : null;
  let roleId = null;
  if (asked != null && String(asked).trim()) {
    const a = String(asked).trim();
    const n = /^\d+$/.test(a) ? byId.get(Number(a)) : index.roleNodes.find(r => r.slug === a);
    if (n?.kind === "role") roleId = n.id;
    else return { error: "unknown_role" };
  }
  const biggest = () => [...index.roles.entries()].sort((a, b) => b[1].n - a[1].n || a[0] - b[0])[0]?.[0] ?? null;
  roleId ??= (aim?.roleId != null && index.roles.has(aim.roleId) ? aim.roleId : null) ?? (currentId != null && index.roles.has(currentId) ? currentId : null) ?? biggest();
  return { roleId, aimId: aim?.roleId ?? null, currentId };
}

const nodeOut = (index, id) => { const n = index.idx.byId.get(id); return n ? { id, slug: n.slug, name: n.name, thumb: index.thumbs.get(id) || null } : null; };
const stateOf = (person, id) => (person.proven?.has(id) ? "proven" : (person.credit.get(id) || 0) > 0 ? "claimed" : "missing");

/**
 * ⭐ THE SKILL MAP for one person and one role (GET /api/atlas/skill-map).
 * @param opts.role a role node's id or slug (optional — default: the aim, else the current role, else the biggest)
 */
export function skillMapFor(db, userId, { role = null } = {}) {
  atlasPostingsChanged(db);   // a posting written a moment ago is counted (a budgeted drain, D118 P1 / 44p)
  const index = skillMapIndex(db);
  const pick = chooseRole(db, userId, index, role);
  if (pick.error) return { found: false, reason: pick.error };
  if (pick.roleId == null) return { found: false, reason: "no_roles" };
  const person = personCredit(db, userId, index);
  const key = `${userId}|${pick.roleId}|${pick.aimId}|${pick.currentId}|${person.hash}|${index.version}`;
  const hit = answers.get(key);
  if (hit) return hit;
  const value = compute(db, index, pick, person);
  if (answers.size >= SKILL_MAP.CACHE_MAX) answers.clear();
  answers.set(key, value);
  return value;
}

function compute(db, index, pick, person) {
  const { credit } = person;
  const empty = { open: 0, n: 0, offs: new Int32Array(1), asks: new Int32Array(0), level: new Uint8Array(0), company: new Int32Array(0), byNode: new Map(), askCount: new Map(), levelRead: 0 };
  const r = index.roles.get(pick.roleId) || empty;
  const roleNode = index.idx.byId.get(pick.roleId);
  const hoursOf = (id) => { const h = index.hours.get(id); return h > 0 ? { hours: Math.round(h * 10) / 10, estimated: false } : { hours: SKILL_MAP.HOURS_FALLBACK, estimated: true }; };
  const read = readRole(r, credit);

  // What the role's jobs want: its most-asked skills, each with its family, its share and the person's state.
  const asks = [...r.askCount.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, SKILL_MAP.TOP_ASKS).map(([id, jobs]) => {
    const n = index.idx.byId.get(id);
    return { ...nodeOut(index, id), family: n?.family || null, familyName: (n?.family && familyName(n.family)) || "Other",
      jobs, share: r.n ? jobs / r.n : 0, state: stateOf(person, id) };
  });

  // Learn next.
  const steps = greedyRoute(r, credit, hoursOf, { start: { s2: read.s2, len: read.len } }).map(s => {
    const n = index.idx.byId.get(s.id);
    const step = n ? safe(() => learnStepForNode(db, { name: n.name, term: n.term }), null) : null;
    return { ...nodeOut(index, s.id), kind: s.kind, gain: s.gain, total: s.total, hours: s.hours, estimated: s.estimated,
      published: n?.status === "published", stepId: step?.stepId || null,
      companies: topCompanies(r, s.opened, SKILL_MAP.STEP_COMPANIES, (ci) => companyName(db, index, ci)).filter(c => c.name) };
  });

  // Jobs you could move to — the aim, the current role and the navigator's own neighbours (same category, enough jobs).
  const reg = safe(() => registryCached(), {});
  const cIndex = safe(() => categoryIndex(reg), new Map());
  const anchor = index.idx.byId.get(pick.currentId ?? pick.aimId ?? pick.roleId);
  const category = anchor ? safe(() => roleCategory(anchor, cIndex), null) : null;
  const candidates = index.roleNodes.filter(n => (index.roles.get(n.id)?.open || 0) >= SKILL_MAP.MOVE_MIN_POSTINGS
      && (!category || safe(() => roleCategory(n, cIndex), null) === category))
    .sort((a, b) => (index.roles.get(b.id).open - index.roles.get(a.id).open) || a.id - b.id).slice(0, SKILL_MAP.MOVE_CANDIDATES);
  const card = (id) => {
    const rr = index.roles.get(id);
    const n = index.idx.byId.get(id);
    if (!rr || !n) return null;
    const rd = id === pick.roleId ? read : readRole(rr, credit);
    const ranked = [...rr.askCount.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, SKILL_MAP.TOP_ASKS);
    const want = Math.ceil(SKILL_MAP.MOVE_REACH_SHARE * rr.n - EPS);
    let hoursTo = rd.applicable >= want ? 0 : null;
    if (hoursTo == null && rr.n) {
      let h = 0;
      for (const s of greedyRoute(rr, credit, hoursOf, { steps: SKILL_MAP.MOVE_REACH_STEPS, start: { s2: rd.s2, len: rd.len } })) { h += s.hours; if (s.total >= want) { hoursTo = Math.round(h); break; } }
    }
    return { id, slug: n.slug, name: n.name, open: rr.open, judged: rr.n, coverage: coverageOf(rr, credit), applicable: rd.applicable,
      carries: ranked.filter(([k]) => (credit.get(k) || 0) > 0).slice(0, SKILL_MAP.CARRY_NAMES).map(([k]) => ({ ...nodeOut(index, k), state: stateOf(person, k) })),
      missing: ranked.filter(([k]) => !credit.get(k)).slice(0, SKILL_MAP.MISSING_NAMES).map(([k]) => nodeOut(index, k)),
      hoursTo30: hoursTo, isAim: id === pick.aimId, isCurrent: id === pick.currentId, isShown: id === pick.roleId };
  };
  const fixed = [...new Set([pick.roleId, pick.aimId, pick.currentId].filter(x => x != null))];
  const neighbours = candidates.filter(n => !fixed.includes(n.id)).map(n => ({ id: n.id, cov: coverageOf(index.roles.get(n.id), credit) }))
    .sort((a, b) => b.cov - a.cov || a.id - b.id).slice(0, SKILL_MAP.MOVE_ROLES).map(x => x.id);
  const move = [...fixed, ...neighbours].map(card).filter(Boolean);

  return {
    found: true,
    role: { id: pick.roleId, slug: roleNode?.slug || null, name: roleNode?.name || "", open: r.open, judged: r.n,
      published: roleNode?.status === "published" },
    aim: pick.aimId != null ? nodeOut(index, pick.aimId) : null,
    current: pick.currentId != null ? nodeOut(index, pick.currentId) : null,
    threshold: SKILL_MAP.APPLY_SHARE,
    skills: person.counts,
    applicable: read.applicable,
    histogram: read.histogram,
    levels: read.levels,
    asks,
    route: { steps, hours: Math.round(steps.reduce((a, s) => a + s.hours, 0)), estimated: steps.some(s => s.estimated) },
    move,
    roles: move.map(m => ({ id: m.id, slug: m.slug, name: m.name, isAim: m.isAim, isCurrent: m.isCurrent })),
    version: index.version,
  };
}

/** Tests and the measurement: forget every index and answer. */
export function resetSkillMapCache(db) { if (db) indexMemo.delete(db); answers.clear(); }
