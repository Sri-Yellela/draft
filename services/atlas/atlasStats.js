// services/atlas/atlasStats.js — ⭐ D105 P3 · "On the board": every Atlas number COMPUTED from active postings, nightly.
//
// ⛔ Never typed by hand (d105BoardStatsComputed): atlas_node_stats is rewritten whole by this rollup, and between two
// rollups its counts move only by the posting that changed (⭐ D118 P1, atlasLive.js — the same matcher, per ingest;
// this pass is then the reconciliation and returns the drift it corrected). Per node:
//   skill / tool  postings that ask for it (its term, or a confirmed alias, as words in the posting's text) · the
//                 skills and tools that appear with it most · the roles that ask for it · the pay range where
//                 postings state one
//   role          postings whose title names the role · the skills those postings ask for most · the pay range
// Matching is THE ONE MATCHER (postingMatcher.js — the scorer's own normalisation over 1–4-word runs of the text, read
// without the company's boilerplate, and from the requirements when the posting has them; BUG 10-31). Pay is the
// posting's annual USD midpoint (the provider's figure, else the one read from its text — D71), only for postings that
// state one.
// ⭐ P9 (amended 10-31): the same pass rebuilds the 'board' edges (boardEdgesFrom, below) — nothing else writes them.

import { postingMatcher, AMBIGUOUS_TERMS, ACTIVE_POSTINGS_WHERE, POSTING_TEXT_SQL, companyKey, companyCacheMoved } from "./postingMatcher.js";
import { syncAtlasPostings, liveSnapshot, liveMatcher, driftBetween, snapshotOf, writeLiveBaseline, levelReadColumn } from "./atlasLive.js";

// The one matcher and the board's postings live in postingMatcher.js; re-exported here for the modules that read them
// from the stats (atlasMe.js, atlasLinks.js, atlasLearnImport.js, atlasWikidata.js).
export { postingMatcher, AMBIGUOUS_TERMS, ACTIVE_POSTINGS_WHERE, POSTING_TEXT_SQL, levelReadColumn };

// A posting's pay below this is not an annual salary (an hourly figure, or a placeholder "1") — not counted.
const PAY_FLOOR_USD = 15000;
const TOP = 8;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const topOf = (counts, names, n = TOP) => [...counts.entries()].sort((a, b) => b[1] - a[1] || String(names.get(a[0])).localeCompare(String(names.get(b[0]))))
  .slice(0, n).map(([id, c]) => ({ slug: names.get(id).slug, name: names.get(id).name, postings: c }));

// ⭐ D105 P9 (amended 10-31) · EDGES FROM THE BOARD, rebuilt with the stats every night (source 'board'):
//   used_with  two skills / tools asked together in ≥ 10 % of EITHER one's postings
//   requires   a role → its top 15 skills / tools by share of that role's postings
// Both also need at least BOARD_MIN_TOGETHER postings in common: on a small board one posting naming a rare skill
// would otherwise make it "used with" everything else in that posting (10 % of 1 posting is that posting).
// ⛔ Only the previous BOARD edges are replaced: registry / owner / wikidata edges are never deleted, and a pair that
// already exists under another source keeps that source (INSERT OR IGNORE on the same key; used_with in either order).
export const BOARD_USED_WITH_SHARE = 0.10;
export const BOARD_REQUIRES_TOP = 15;
export const BOARD_MIN_TOGETHER = 3;

/**
 * The board edges from one rollup's counts — pure, so the threshold is testable without a board.
 * @param agg    Map id → { postings, withSkill: Map(otherId → postings together) }
 * @param kindOf (id) → 'role' | 'skill' | 'tool' | 'stack'
 * @returns [{ from, to, type }]
 */
export function boardEdgesFrom(agg, kindOf, { share = BOARD_USED_WITH_SHARE, top = BOARD_REQUIRES_TOP, minTogether = BOARD_MIN_TOGETHER } = {}) {
  const out = [];
  const seen = new Set();
  for (const [id, a] of agg) {
    if (!a.postings) continue;
    if (kindOf(id) === "role") {
      // share of the role's postings = together / a.postings — the same order as the count, for one role.
      [...a.withSkill.entries()].filter(([other, c]) => c >= minTogether && kindOf(other) !== "role")
        .sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, top)
        .forEach(([other]) => out.push({ from: id, to: other, type: "requires" }));
      continue;
    }
    for (const [other, together] of a.withSkill) {
      if (kindOf(other) === "role" || together < minTogether) continue;
      const b = agg.get(other);
      if (!(together >= share * a.postings || (b?.postings && together >= share * b.postings))) continue;
      const lo = Math.min(id, other), hi = Math.max(id, other);
      if (seen.has(`${lo}:${hi}`)) continue;
      seen.add(`${lo}:${hi}`);
      out.push({ from: lo, to: hi, type: "used_with" });
    }
  }
  return out;
}

/** Replace the previous board edges with these — one transaction. @returns the number written */
export function writeBoardEdges(db, edges) {
  const has = db.prepare(`SELECT 1 FROM atlas_edges WHERE type = ? AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`);
  const put = db.prepare(`INSERT OR IGNORE INTO atlas_edges (from_id, to_id, type, source) VALUES (?,?,?,'board')`);
  let written = 0;
  db.transaction(() => {
    db.prepare(`DELETE FROM atlas_edges WHERE source = 'board'`).run();
    for (const e of edges) {
      if (e.type === "used_with" && has.get(e.type, e.from, e.to, e.to, e.from)) continue;
      written += put.run(e.from, e.to, e.type).changes;
    }
  })();
  return written;
}

/**
 * ⭐ D116 · per ROLE: its postings and the postings asking for each node — in all, and per level read (entry | early |
 * mid | senior; a posting with no read counts in all only). YOUR MAP's "to reach the next level" is read from these.
 * @returns {{ add(roleId, asked, level), result() → { roles: Map(roleId → { postings, skill: Map, levels: Map(level →
 *   { postings, skill: Map }) }), postings, levelRead } }}
 */
export function roleLevelCounts() {
  const roles = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  let postings = 0, levelRead = 0;
  return {
    add(roleId, asked, level) {
      postings++;
      if (level) levelRead++;
      if (roleId == null) return;
      let r = roles.get(roleId);
      if (!r) roles.set(roleId, r = { postings: 0, skill: new Map(), levels: new Map() });
      r.postings++;
      for (const id of asked) bump(r.skill, id);
      if (!level) return;
      let l = r.levels.get(level);
      if (!l) r.levels.set(level, l = { postings: 0, skill: new Map() });
      l.postings++;
      for (const id of asked) bump(l.skill, id);
    },
    result: () => ({ roles, postings, levelRead }),
  };
}

/** The same counts in their own pass over the active postings, through the one matcher (YOUR MAP after a restart). */
export function roleLevelsOfBoard(db, nodes) {
  const match = postingMatcher(db, nodes, { bulk: true });
  const rl = roleLevelCounts();
  for (const p of db.prepare(`SELECT ${POSTING_TEXT_SQL}, ${levelReadColumn(db)} FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE}`).iterate()) {
    const roleId = match.roleOf(p.title);
    rl.add(roleId, roleId == null ? [] : match.askedBy(p), p.level_read);
  }
  return rl.result();
}

/**
 * The full pass: every active posting read by the one matcher, every count rewritten — the nightly reconciliation of
 * D118 P1's live rows (atlasLive.js). The queue is drained first, so a change made before the pass is not drift; then the
 * live rows are compared with the recount and the difference is returned (and logged by the caller) as `drift`.
 * @returns {{ postings: number, nodes: number, boardEdges: number, drift: { drift, rowsOff, vocabChanged } | null }}
 */
export function computeAtlasStats(db, { now = Math.floor(Date.now() / 1000), boardEdges = true } = {}) {
  const nodes = db.prepare(`SELECT id, slug, kind, name, term FROM atlas_nodes ORDER BY id`).all();
  if (!nodes.length) return { postings: 0, nodes: 0, boardEdges: 0, drift: null };
  const byId = new Map(nodes.map(n => [n.id, n]));
  try { syncAtlasPostings(db, { now }); } catch (e) { console.warn(`[atlas stats] the live queue could not be drained first: ${e.message}`); }
  let drained = [];
  try { drained = db.prepare(`SELECT posting_id FROM atlas_posting_dirty`).pluck().all(); } catch { drained = []; }
  const before = liveSnapshot(db);
  const vocab = liveMatcher(db).key;
  const match = postingMatcher(db, nodes, { bulk: true, live: true });
  const agg = new Map(nodes.map(n => [n.id, { postings: 0, withSkill: new Map(), withRole: new Map(), pay: [] }]));
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  let postings = 0;
  const rl = roleLevelCounts();
  const rows = [];
  for (const p of db.prepare(`SELECT id, ${POSTING_TEXT_SQL}, ${levelReadColumn(db)},
      COALESCE(salary_min_usd, pay_text_min_usd) AS pmin, COALESCE(salary_max_usd, pay_text_max_usd) AS pmax
      FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE}`).iterate()) {
    postings++;
    const { asked, linked, roleId } = match.read(p);
    const role = roleId != null ? { id: roleId } : null;
    rl.add(roleId, asked, p.level_read);
    rows.push({ id: p.id, ck: companyKey(p.company), roleId, level: p.level_read || null, asked, linked, hashes: match.bulkHashes.get(p.id) || [] });
    const ok = (v) => Number.isFinite(v) && v >= PAY_FLOOR_USD;
    const pay = ok(p.pmin) && ok(p.pmax) ? Math.round((p.pmin + p.pmax) / 2) : ok(p.pmin) ? p.pmin : ok(p.pmax) ? p.pmax : null;
    for (const id of asked) {
      const a = agg.get(id);
      a.postings++;
      for (const other of asked) if (other !== id) bump(a.withSkill, other);
      if (role) bump(a.withRole, role.id);
      if (pay != null) a.pay.push(pay);
    }
    if (role) {
      const a = agg.get(role.id);
      a.postings++;
      for (const id of asked) bump(a.withSkill, id);
      if (pay != null) a.pay.push(pay);
    }
  }

  const write = db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, top_skills_json, top_roles_json, pay_min_usd, pay_median_usd, pay_max_usd, pay_n, computed_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    db.prepare(`DELETE FROM atlas_node_stats`).run();
    for (const [id, a] of agg) {
      write.run(id, a.postings, JSON.stringify(topOf(a.withSkill, byId)), JSON.stringify(topOf(a.withRole, byId, 5)),
        a.pay.length ? Math.min(...a.pay) : null, a.pay.length ? median(a.pay) : null, a.pay.length ? Math.max(...a.pay) : null,
        a.pay.length, now);
    }
  })();
  const roleLevels = rl.result();
  const drift = driftBetween(before, snapshotOf(new Map([...agg].map(([id, a]) => [id, a.postings])), roleLevels, vocab));
  let version = null;
  try { version = writeLiveBaseline(db, { rows, roleLevels, vocab, now, drained, drift }); }
  catch (e) { console.warn(`[atlas stats] the live store was not written (migration 199?): ${e.message}`); }
  if (version != null) companyCacheMoved(db, version);
  const written = boardEdges ? writeBoardEdges(db, boardEdgesFrom(agg, (id) => byId.get(id)?.kind)) : 0;
  return { postings, nodes: nodes.length, boardEdges: written, drift };
}
