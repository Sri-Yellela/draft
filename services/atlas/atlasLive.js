// services/atlas/atlasLive.js — ⭐ D118 P1 · COUNTS MOVE WITH THE BOARD.
//
// Owner 10-31: "a new job is ingested featuring python, that should reflect across the postings we show." When a posting
// is ingested, changed, closed or expires, its reading by THE ONE MATCHER (postingMatcher.js — never a second copy) is
// taken once and the Atlas's live rows move by exactly that posting:
//   atlas_node_stats.postings   every node it is counted for, and its role (the total "asked for in N")
//   atlas_role_level_stats      per role: its postings and each node's, in all and per level read (YOUR MAP, role pages)
//   atlas_posting_match         its reading — what it ADDED is what its close SUBTRACTS (never re-guessed), and its D114
//                               links (atlasLinks.js reads them; the published ones are shown)
// Every surface reads those rows: Atlas pages, the hover popup, YOUR MAP, the role page. The pay range, the "asked with"
// lists and the board edges stay the nightly pass's.
//
// HOW NO WRITE PATH IS MISSED: triggers on scraped_jobs (migration 199) queue the posting in atlas_posting_dirty on
// every insert, relevant update and delete — the crawl, an update, a close, the expiry cleanup, a dedup retire, an
// import revert, a script. The writers that matter call atlasPostingsChanged(db) INSIDE their own transaction, so the
// counts move in the transaction that writes the posting; every read drains the queue first, so a writer that did not
// (a script, another process) is caught on the next read.
//
// THE COMPANY'S BOILERPLATE (postingMatcher.js (1)): a posting's arrival changes its company's sentence counts. Only
// that company's counts are adjusted (in place, the cache re-keyed — no other company is rebuilt); when a sentence
// crosses the boilerplate line because of it, the company's postings holding that sentence are re-read too, so the
// live counts stay exactly what a full recount would give.
//
// THE NIGHTLY PASS STAYS (atlasStats.js computeAtlasStats): a full recount that rewrites every row, and logs as a number
// how far the live rows had drifted from it (drift — 0 when nothing was missed; a vocabulary change in between, a node
// added or an alias confirmed, is named, since the live rows read each posting with the vocabulary of its day).
//
// ⛔ Before the first full pass there is no baseline: the queue waits and the readers read the last nightly figures.

import { postingMatcher, ACTIVE_POSTINGS_WHERE, POSTING_TEXT_SQL, companyKey, companyCounts, companyCacheMoved, companyCacheDrop,
  boilerplateJudge, isBoilerplateCount, sentenceHashesOf, sentenceHash, liveVersion } from "./postingMatcher.js";
import { atlasChangeCount } from "./atlasStore.js";

export { liveVersion };

/** ⭐ The page data and the popup are cached at most this long — and never past a change of the counts or the Atlas. */
export const LIVE_CACHE_MS = 60_000;

/** The posting's real level (D106 scraped_jobs.level_read) as a column — NULL on a database from before migration 176. */
export const levelReadColumn = (db) =>
  (db.prepare(`PRAGMA table_info(scraped_jobs)`).all().some(c => c.name === "level_read") ? "level_read" : "NULL AS level_read");

const ids = (s) => (s ? s.split(",").map(Number) : []);
const newVersion = () => `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
const getState = (db, k) => db.prepare(`SELECT v FROM atlas_live_state WHERE k = ?`).pluck().get(k) ?? null;
const putState = (db, k, v) => db.prepare(`INSERT INTO atlas_live_state (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).run(k, v == null ? null : String(v));

// ── the vocabulary: the nodes and confirmed aliases the matcher reads ──────────────────────────────

const vocabMemo = new WeakMap();   // db → { change, key, nodes, known: Set(id), matcher }
/**
 * The live matcher over EVERY node (drafts too — the counts are every node's; a read shows the published), rebuilt only
 * when a node or an alias changed (D118 P2's atlas_changes counter), and its vocabulary key (a hash of the nodes' ids,
 * kinds, names and terms and the confirmed aliases).
 */
export function liveMatcher(db) {
  const change = atlasChangeCount(db);
  let m = vocabMemo.get(db);
  if (m && change !== -1 && m.change === change) return m;
  const nodes = db.prepare(`SELECT id, slug, kind, name, term FROM atlas_nodes ORDER BY id`).all();
  let aliases = [];
  try { aliases = db.prepare(`SELECT term, equivalent FROM skill_synonyms WHERE status = 'confirmed' AND relation = 'alias' ORDER BY term, equivalent`).all(); } catch { aliases = []; }
  const key = sentenceHash(JSON.stringify([nodes.map(n => [n.id, n.kind, n.name, n.term]), aliases.map(a => [a.term, a.equivalent])])).toString(36);
  if (m && m.key === key) { m.change = change; return m; }
  m = { change, key, nodes, known: new Set(nodes.map(n => n.id)), matcher: postingMatcher(db, nodes, { live: true }) };
  vocabMemo.set(db, m);
  return m;
}

// ── one posting's contribution ──────────────────────────────────────────────────────────────────

function emptyDelta() { return { nodes: new Map(), rl: new Map(), postings: 0, levelRead: 0 }; }
const bump = (m, k, by) => m.set(k, (m.get(k) || 0) + by);
/** Add (sign +1) or remove (−1) one posting's reading { asked, roleId, level } — the shape the nightly pass counts. */
function contribute(d, r, sign, known) {
  d.postings += sign;
  if (r.level) d.levelRead += sign;
  for (const id of r.asked) if (known.has(id)) bump(d.nodes, id, sign);
  if (r.roleId == null) return;
  if (known.has(r.roleId)) bump(d.nodes, r.roleId, sign);
  const levels = r.level ? ["", r.level] : [""];
  for (const level of levels) {
    bump(d.rl, `${r.roleId}|${level}|0`, sign);
    for (const id of r.asked) bump(d.rl, `${r.roleId}|${level}|${id}`, sign);
  }
}

function rowOf(row) {
  if (!row) return null;
  return { id: row.posting_id, ck: row.company_key, roleId: row.role_id, level: row.level, asked: ids(row.asked), linked: ids(row.linked),
    sentences: row.sentences, vocab: row.vocab };
}

function writeDelta(db, d, now) {
  const node = db.prepare(`INSERT INTO atlas_node_stats (node_id, postings, computed_at) VALUES (?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET postings = postings + excluded.postings`);
  let changed = 0;
  for (const [id, by] of d.nodes) if (by) { node.run(id, by, now); changed++; }
  const rl = db.prepare(`INSERT INTO atlas_role_level_stats (role_id, level, node_id, postings) VALUES (?, ?, ?, ?)
    ON CONFLICT(role_id, level, node_id) DO UPDATE SET postings = postings + excluded.postings`);
  const rlGone = db.prepare(`DELETE FROM atlas_role_level_stats WHERE role_id = ? AND level = ? AND node_id = ? AND postings <= 0`);
  for (const [k, by] of d.rl) {
    if (!by) continue;
    const [role, level, id] = k.split("|");
    rl.run(Number(role), level, Number(id), by);
    if (by < 0) rlGone.run(Number(role), level, Number(id));
  }
  if (d.postings) putState(db, "board_postings", Number(getState(db, "board_postings") || 0) + d.postings);
  if (d.levelRead) putState(db, "board_level_read", Number(getState(db, "board_level_read") || 0) + d.levelRead);
  return changed;
}

// ── the per-ingest pass ─────────────────────────────────────────────────────────────────────────

/**
 * Drain the queue: every posting written since the last pass is read once by the one matcher and the live rows move by
 * it. Runs inside the caller's transaction when there is one (a savepoint), else its own.
 * @returns {{ postings, rematched, changed, pending? } | null} null — no live store on this database
 */
//
// ⛔ 44p (11-04) · NO CALLER DRAINS AN UNBOUNDED QUEUE ON THE REQUEST PATH. Reading a posting costs ≈ 4.3 ms (measured
// at 81k postings: 12,030 queued = 51 s in one transaction), and after A112's crawler boost one drain of the whole queue
// held the event loop for minutes — every request on the server, a static favicon included, hung 20–67 s (production
// 11-02 ≈ 19:05Z; the owner saw "upload résumé, no jobs, the deck keeps loading"). So:
//   · syncAtlasPostings(db, { limit }) reads at most `limit` queued postings, oldest first (no limit = the whole queue:
//     the nightly full pass and scripts only);
//   · atlasPostingsChanged(db) — every write path and every read — drains for a small time budget (ATLAS_DRAIN_BUDGET_MS)
//     in slices of ATLAS_DRAIN_SLICE, always at least one slice: a single write or a test's handful still settles in
//     the same call, a crawl batch of a thousand does not hold the loop for four seconds;
//   · startAtlasDrainer(db) (server.js, after listen) drains what is left in the background, yielding between slices.
// The counts are the same ones a whole drain gives — each slice is one more incremental step, like another writer's.

/** Postings read per slice (≈ 70 ms at 4.3 ms each). */
export const ATLAS_DRAIN_SLICE = 16;
/** The longest a write or a read spends draining before it leaves the rest to the background drainer. */
export const ATLAS_DRAIN_BUDGET_MS = 50;

export function syncAtlasPostings(db, { now = Math.floor(Date.now() / 1000), limit = Infinity } = {}) {
  let queued;
  try { queued = db.prepare(`SELECT COUNT(*) FROM atlas_posting_dirty`).pluck().get(); } catch { return null; }
  if (!queued) return { postings: 0, rematched: 0, changed: 0, pending: 0 };
  if (liveVersion(db) == null) return { postings: 0, rematched: 0, changed: 0, pending: queued };
  try {
    return db.transaction(() => syncNow(db, now, limit))();
  } catch (e) {
    companyCacheDrop(db);   // its in-place changes were rolled back with the savepoint
    throw e;
  }
}

/** The queue's length — Admin → System and the drainer read it. null on a database with no live store. */
export function atlasQueueLength(db) {
  try { return db.prepare(`SELECT COUNT(*) FROM atlas_posting_dirty`).pluck().get(); } catch { return null; }
}

/**
 * One budgeted drain: slices of `slice` postings until the queue is empty or `budgetMs` is spent — always one slice.
 * @returns {{ postings, rematched, changed, pending } | null}
 */
export function drainAtlasQueue(db, { budgetMs = ATLAS_DRAIN_BUDGET_MS, slice = ATLAS_DRAIN_SLICE, clock = () => performance.now() } = {}) {
  const start = clock();
  const total = { postings: 0, rematched: 0, changed: 0, pending: 0 };
  for (;;) {
    const r = syncAtlasPostings(db, { limit: slice });
    if (!r) return null;
    total.postings += r.postings; total.rematched += r.rematched; total.changed += r.changed; total.pending = r.pending ?? 0;
    if (!r.postings || !total.pending || clock() - start >= budgetMs) return total;
  }
}

/** The write paths' and the reads' call: a budgeted drain, and a failure never fails the posting's own write. */
export function atlasPostingsChanged(db, opts) {
  try { return drainAtlasQueue(db, opts); }
  catch (e) { console.warn(`[atlas live] the counts wait for the next read: ${e.message}`); return null; }
}

/**
 * ⭐ 44p · The background drainer: a budgeted drain every `restMs` while postings are queued (the loop is free between
 * slices, so requests interleave), every `idleMs` when the queue is empty. Returns stop().
 */
export function startAtlasDrainer(db, { budgetMs = 100, restMs = 100, idleMs = 5000, log = console } = {}) {
  let timer = null, stopped = false, drained = 0, since = Date.now();
  const tick = () => {
    if (stopped) return;
    let r = null;
    try { r = drainAtlasQueue(db, { budgetMs }); }
    catch (e) { log.warn?.(`[atlas live] background drain failed: ${e.message}`); }
    drained += r?.postings || 0;
    if (drained && !r?.pending) {
      log.log?.(`[atlas live] background drain: ${drained} posting(s) counted in ${Math.round((Date.now() - since) / 1000)} s`);
      drained = 0;
    }
    if (!r?.pending) since = Date.now();
    timer = setTimeout(tick, r?.pending ? restMs : idleMs);
    timer.unref?.();
  };
  timer = setTimeout(tick, restMs);
  timer.unref?.();
  return () => { stopped = true; clearTimeout(timer); };
}

function syncNow(db, now, limit = Infinity) {
  const all = !Number.isFinite(limit);
  const dirty = all
    ? db.prepare(`SELECT posting_id FROM atlas_posting_dirty`).pluck().all()
    : db.prepare(`SELECT posting_id FROM atlas_posting_dirty ORDER BY rowid LIMIT ?`).pluck().all(Math.max(1, Math.floor(limit)));
  const pendingAfter = all ? 0 : Math.max(0, db.prepare(`SELECT COUNT(*) FROM atlas_posting_dirty`).pluck().get() - dirty.length);
  const L = liveMatcher(db);
  const version = liveVersion(db);
  const key = `live:${version}`;
  const getPosting = db.prepare(`SELECT id, ${POSTING_TEXT_SQL}, ${levelReadColumn(db)} FROM scraped_jobs WHERE id = ? AND ${ACTIVE_POSTINGS_WHERE}`);
  const getRow = db.prepare(`SELECT * FROM atlas_posting_match WHERE posting_id = ?`);
  // A posting replaced under a new id (INSERT OR REPLACE fires no delete trigger) leaves its old row: swept here — by the
  // slice that empties the queue (the sweep scans every match row, so not on every slice of a backlog).
  const orphans = pendingAfter ? [] : db.prepare(`SELECT posting_id FROM atlas_posting_match WHERE posting_id NOT IN (SELECT id FROM scraped_jobs)`).pluck().all();
  const work = new Set([...dirty, ...orphans]);

  // 1. The companies touched, adjusted in place: the posting's old sentences out, its new ones in.
  const touched = new Map();   // companyKey → { cc, nBefore, before: Map(hash → count before) }
  const touch = (ck) => {
    if (!ck) return null;
    let t = touched.get(ck);
    if (!t) { const cc = companyCounts(db, ck, key); t = { cc, nBefore: cc.n, before: new Map() }; touched.set(ck, t); }
    return t;
  };
  const items = [...work].map(id => {
    const old = rowOf(getRow.get(id));
    const cur = getPosting.get(id) || null;
    return { id, old, cur, ck: cur ? companyKey(cur.company) : null, hashes: cur ? sentenceHashesOf(cur.text) : null };
  });
  for (const it of items) {
    const t = it.old ? touch(it.old.ck) : null;
    const hs = t?.cc.byPosting.get(it.id);
    if (hs) {
      for (const h of hs) { if (!t.before.has(h)) t.before.set(h, t.cc.counts.get(h) || 0); const c = (t.cc.counts.get(h) || 0) - 1; c > 0 ? t.cc.counts.set(h, c) : t.cc.counts.delete(h); }
      t.cc.byPosting.delete(it.id);
      t.cc.n--;
    }
  }
  for (const it of items) {
    const t = it.cur ? touch(it.ck) : null;
    if (!t) continue;
    for (const h of it.hashes) { if (!t.before.has(h)) t.before.set(h, t.cc.counts.get(h) || 0); t.cc.counts.set(h, (t.cc.counts.get(h) || 0) + 1); }
    t.cc.byPosting.set(it.id, it.hashes);
    t.cc.n++;
  }

  // 2. A sentence that crossed the boilerplate line (its own count moved, or the company's size did): the company's
  //    other postings holding it read differently now — re-read them too.
  const rematch = new Set();
  for (const t of touched.values()) {
    const nAfter = t.cc.n;
    const flipped = new Set();
    for (const [h, c0] of t.before) if (isBoilerplateCount(c0, t.nBefore) !== isBoilerplateCount(t.cc.counts.get(h) || 0, nAfter)) flipped.add(h);
    if (nAfter !== t.nBefore) for (const [h, c] of t.cc.counts) if (!t.before.has(h) && isBoilerplateCount(c, t.nBefore) !== isBoilerplateCount(c, nAfter)) flipped.add(h);
    if (!flipped.size) continue;
    for (const [pid, hs] of t.cc.byPosting) if (!work.has(pid) && hs.some(h => flipped.has(h))) rematch.add(pid);
  }
  for (const pid of rematch) {
    const old = rowOf(getRow.get(pid));
    const cur = getPosting.get(pid) || null;
    items.push({ id: pid, old, cur, ck: cur ? companyKey(cur.company) : null, hashes: cur ? (touched.get(companyKey(cur.company))?.cc.byPosting.get(pid) ?? sentenceHashesOf(cur.text)) : null });
  }

  // 3. Each posting read once, its old reading out of the counts and its new one in.
  const d = emptyDelta();
  const put = db.prepare(`INSERT INTO atlas_posting_match (posting_id, company_key, role_id, level, asked, linked, sentences, vocab, matched_at)
    VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(posting_id) DO UPDATE SET company_key = excluded.company_key, role_id = excluded.role_id,
    level = excluded.level, asked = excluded.asked, linked = excluded.linked, sentences = excluded.sentences, vocab = excluded.vocab,
    matched_at = excluded.matched_at`);
  const drop = db.prepare(`DELETE FROM atlas_posting_match WHERE posting_id = ?`);
  for (const it of items) {
    if (it.old) contribute(d, it.old, -1, L.known);
    if (!it.cur) { if (it.old) drop.run(it.id); continue; }
    const r = L.matcher.read(it.cur, { boilerplate: boilerplateJudge(it.ck ? touched.get(it.ck)?.cc : null) });
    const reading = { asked: r.asked, roleId: r.roleId, level: it.cur.level_read || null };
    contribute(d, reading, +1, L.known);
    put.run(it.id, it.ck || "", r.roleId, reading.level, r.asked.join(","), r.linked.join(","), it.hashes.map(h => h.toString(36)).join(" "), L.key, now);
  }
  const changed = writeDelta(db, d, now);
  const done = db.prepare(`DELETE FROM atlas_posting_dirty WHERE posting_id = ?`);
  for (const id of dirty) done.run(id);
  const v = newVersion();
  putState(db, "version", v);
  companyCacheMoved(db, v);
  return { postings: work.size, rematched: rematch.size, changed, pending: pendingAfter };
}

// ── the full pass's side: the baseline and the drift ────────────────────────────────────────────

/** The live rows as they stand (before a recount compares them), or null with no baseline. */
export function liveSnapshot(db) {
  if (liveVersion(db) == null) return null;
  return {
    nodes: new Map(db.prepare(`SELECT node_id, postings FROM atlas_node_stats`).raw().all()),
    rl: new Map(db.prepare(`SELECT role_id || '|' || level || '|' || node_id, postings FROM atlas_role_level_stats`).raw().all()),
    postings: Number(getState(db, "board_postings") || 0),
    levelRead: Number(getState(db, "board_level_read") || 0),
    vocab: getState(db, "vocab"),
  };
}

/** How far the live rows were from the recount: Σ |difference| over every node, role × level × node, and the totals. */
export function driftBetween(before, after) {
  if (!before) return null;
  let drift = 0, nodes = 0;
  const diff = (a, b) => {
    for (const k of new Set([...a.keys(), ...b.keys()])) { const x = Math.abs((a.get(k) || 0) - (b.get(k) || 0)); drift += x; if (x) nodes++; }
  };
  diff(before.nodes, after.nodes);
  diff(before.rl, after.rl);
  drift += Math.abs(before.postings - after.postings) + Math.abs(before.levelRead - after.levelRead);
  return { drift, rowsOff: nodes, vocabChanged: before.vocab != null && before.vocab !== after.vocab };
}

/**
 * The full pass's rows become the live store's baseline (one transaction; called by computeAtlasStats).
 * @param rows [{ id, ck, roleId, level, asked, linked, hashes }]  every active posting's reading
 * @param roleLevels roleLevelCounts().result()
 * @param drained the queue's ids when the pass began — a posting written during the pass stays queued
 */
export function writeLiveBaseline(db, { rows, roleLevels, vocab, now, drained, drift }) {
  const put = db.prepare(`INSERT INTO atlas_posting_match (posting_id, company_key, role_id, level, asked, linked, sentences, vocab, matched_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  const rl = db.prepare(`INSERT INTO atlas_role_level_stats (role_id, level, node_id, postings) VALUES (?,?,?,?)`);
  const done = db.prepare(`DELETE FROM atlas_posting_dirty WHERE posting_id = ?`);
  const v = newVersion();
  db.transaction(() => {
    db.prepare(`DELETE FROM atlas_posting_match`).run();
    for (const r of rows) put.run(r.id, r.ck || "", r.roleId, r.level, r.asked.join(","), r.linked.join(","), r.hashes.map(h => h.toString(36)).join(" "), vocab, now);
    db.prepare(`DELETE FROM atlas_role_level_stats`).run();
    for (const [roleId, r] of roleLevels.roles) {
      rl.run(roleId, "", 0, r.postings);
      for (const [id, c] of r.skill) rl.run(roleId, "", id, c);
      for (const [level, l] of r.levels) {
        rl.run(roleId, level, 0, l.postings);
        for (const [id, c] of l.skill) rl.run(roleId, level, id, c);
      }
    }
    for (const id of drained) done.run(id);
    putState(db, "board_postings", roleLevels.postings);
    putState(db, "board_level_read", roleLevels.levelRead);
    putState(db, "vocab", vocab);
    putState(db, "baseline_at", now);
    putState(db, "last_drift", drift == null ? null : JSON.stringify(drift));
    putState(db, "version", v);
  })();
  return v;
}

/** The rows a recount compares (the shape liveSnapshot reads), from the recount's own figures. */
export function snapshotOf(nodePostings, roleLevels, vocab) {
  const rl = new Map();
  for (const [roleId, r] of roleLevels.roles) {
    rl.set(`${roleId}||0`, r.postings);
    for (const [id, c] of r.skill) rl.set(`${roleId}||${id}`, c);
    for (const [level, l] of r.levels) {
      rl.set(`${roleId}|${level}|0`, l.postings);
      for (const [id, c] of l.skill) rl.set(`${roleId}|${level}|${id}`, c);
    }
  }
  return { nodes: nodePostings, rl, postings: roleLevels.postings, levelRead: roleLevels.levelRead, vocab };
}

// ── the readers ─────────────────────────────────────────────────────────────────────────────────

const rollupMemo = new WeakMap();   // db → { version, counts }
/**
 * The per-role counts from the live rows (the shape atlasStats.js roleLevelCounts().result() gives), or null with no
 * baseline. Read once per version of the store.
 */
export function liveRoleLevels(db) {
  const version = liveVersion(db);
  if (version == null) return null;
  const m = rollupMemo.get(db);
  if (m && m.version === version) return m.counts;
  const roles = new Map();
  for (const [roleId, level, id, c] of db.prepare(`SELECT role_id, level, node_id, postings FROM atlas_role_level_stats WHERE postings > 0`).raw().iterate()) {
    let r = roles.get(roleId);
    if (!r) roles.set(roleId, r = { postings: 0, skill: new Map(), levels: new Map() });
    let into = r;
    if (level) {
      into = r.levels.get(level);
      if (!into) r.levels.set(level, into = { postings: 0, skill: new Map() });
    }
    if (id === 0) into.postings = c; else into.skill.set(id, c);
  }
  const counts = { roles, postings: Number(getState(db, "board_postings") || 0), levelRead: Number(getState(db, "board_level_read") || 0) };
  rollupMemo.set(db, { version, counts });
  return counts;
}

const readingsMemo = new WeakMap();   // db → { version, rows }
/**
 * ⭐ D116 M1 · every active posting's reading as it stands in the live rows — { asked: [node id], roleId, level } — for
 * the tree's closeness ("57 % of those also ask for two or more skills you have") and the family page's shares. The
 * readings the counts were moved by, so the two always agree. Read once per version of the store; null with no baseline.
 */
export function liveReadings(db) {
  const version = liveVersion(db);
  if (version == null) return null;
  const m = readingsMemo.get(db);
  if (m && m.version === version) return m.rows;
  const rows = db.prepare(`SELECT role_id, level, asked FROM atlas_posting_match`).raw().all()
    .map(([roleId, level, asked]) => ({ roleId, level, asked: ids(asked) }));
  readingsMemo.set(db, { version, rows });
  return rows;
}

/** A posting's stored D114 links (every node id, published or not), or null when it has none current. */
export function liveLinksOf(db, postingId) {
  let row;
  try { row = db.prepare(`SELECT linked, vocab FROM atlas_posting_match WHERE posting_id = ?`).get(postingId); } catch { return null; }
  if (!row || row.vocab !== liveMatcher(db).key) return null;
  return ids(row.linked);
}

// The page data and the popup: kept while neither the counts (the store's version) nor the Atlas (atlas_changes) moved,
// and never past LIVE_CACHE_MS.
const pageCache = new WeakMap();   // db → Map(key → { stamp, at, value })
export function liveStamp(db) { return `${liveVersion(db) ?? "-"}:${atlasChangeCount(db)}`; }
export function liveCached(db, key, compute, { now = Date.now() } = {}) {
  let c = pageCache.get(db);
  if (!c) pageCache.set(db, c = new Map());
  const stamp = liveStamp(db);
  const hit = c.get(key);
  if (hit && hit.stamp === stamp && now - hit.at < LIVE_CACHE_MS) return hit.value;
  const value = compute();
  if (c.size > 2000) c.clear();
  c.set(key, { stamp, at: now, value });
  return value;
}
