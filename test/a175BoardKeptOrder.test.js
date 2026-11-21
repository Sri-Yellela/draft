// ⭐ A175 (46d) · the board read at 100k: one covering index (migration 268), the page chosen by id before its columns are
// read (a deferred join), and the board's ORDER kept per person (boardOrderCache) — its ids and total in ONE statement.
// Measured on the 100k fixture (one user, 49k candidates): the page 2.5 s warm / 13 s cold → ids 0.46 s; the count 0.85 → 0.23 s;
// the board-fit pass's category count 0.86 s (16 s cold) → 8 ms.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import { buildOrderKeys, orderByClause } from "../services/jobs/jobCursor.js";
import { createFacetsCache } from "../services/jobs/facetsCache.js";

const block = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "268_scraped_jobs_board_cover"'); return s.slice(lastAt(s, "    {", i), at(s, "    },", i) + 6); };
const SRC = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
const BOARD = SRC.slice(at(SRC, "async function boardPageResponse("));

test("a175: migration 268 is byte-identical in both runners, adds three indexes and drops only the one it supersedes", () => {
  assert.equal(block("server.js"), block("scripts/migrations.js"));
  const sql = block("server.js").replace(/^\s*\/\/.*$/gm, "");
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_scraped_jobs_board_cover ON scraped_jobs\(job_id, is_active, board_category,/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_category ON scraped_jobs\(board_category\) WHERE is_active = 1;/);
  // 229's recency index is superseded by the same expression carrying job_id and board_category (the held read, index-only)
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_scraped_jobs_active_recency_cover ON scraped_jobs\(COALESCE\(posted_at, discovered_at\) DESC, job_id, board_category\) WHERE is_active = 1;\s*DROP INDEX IF EXISTS idx_scraped_jobs_active_recency;/);
  assert.doesNotMatch(sql.replace("DROP INDEX IF EXISTS idx_scraped_jobs_active_recency;", ""), /\b(DROP|DELETE|UPDATE|ALTER)\b/);
});

test("a175: the being-matched read walks the covering recency index, newest first, with no sort", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT sj.job_id FROM scraped_jobs sj
    LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = 1 AND aor.domain_profile_id IS 1
    WHERE sj.is_active = 1 AND (sj.board_category IS NULL OR sj.board_category <> 'held') AND aor.id IS NULL
    ORDER BY COALESCE(sj.posted_at, sj.discovered_at) DESC LIMIT 2001`).all().map(r => r.detail).join(" | ");
  assert.match(plan, /SCAN sj USING (COVERING )?INDEX idx_scraped_jobs_active_recency_cover\b/, plan);
  assert.doesNotMatch(plan, /USE TEMP B-TREE FOR ORDER BY/, plan);
});

test("a175: the board's per-candidate lookup and the board-fit category count read the indexes, not the rows", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  // The board's shape: candidates driven by the person's scored set, each posting looked up by job_id.
  const board = db.prepare(`EXPLAIN QUERY PLAN SELECT COUNT(*) FROM scraped_jobs sj
    LEFT JOIN job_role_map jrm ON jrm.job_id = sj.job_id AND jrm.role_key = 'engineering'
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = 1 AND uj.domain_profile_id = 1
    LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = 1 AND aor.domain_profile_id IS 1
    WHERE sj.is_active = 1
      -- the board's categorySql, as server.js builds it: soft-null, and never hiding the person's own rows
      AND (sj.board_category IS NULL OR (sj.board_category <> 'held' AND sj.board_category = 'computing') OR uj.starred = 1 OR uj.resume_generated = 1
           OR EXISTS (SELECT 1 FROM job_captures jc WHERE jc.job_id = sj.job_id AND jc.user_id = 1)
           OR EXISTS (SELECT 1 FROM application_records ar WHERE ar.job_id = sj.job_id AND ar.user_id = 1))
      AND aor.id IS NOT NULL AND aor.basis_hash = 'abc123'
      AND sj.job_id IN (SELECT r.job_id FROM ats_only_reports r WHERE r.user_id = 1 AND r.domain_profile_id IS 1 AND r.basis_hash = 'abc123')
      AND (uj.disliked IS NULL OR uj.disliked = 0)
    ORDER BY sj.title, sj.summary, sj.skills_json, COALESCE(sj.discovered_at, sj.scraped_at)`).all().map(r => r.detail).join(" | ");
  assert.match(board, /SEARCH sj USING COVERING INDEX idx_scraped_jobs_board_cover \(job_id=\? AND is_active=\?\)/, board);
  assert.doesNotMatch(board, /SCAN sj/, board);
  const cat = db.prepare(`EXPLAIN QUERY PLAN SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE sj.is_active = 1
    AND (sj.board_category IS NULL OR (sj.board_category <> 'held' AND (? IS NULL OR sj.board_category = ?)))`).all("computing", "computing").map(r => r.detail).join(" | ");
  // (reported as USING INDEX: is_active is the index's own WHERE; measured 8 ms on the 100k copy, 16 s cold before)
  assert.match(cat, /USING (COVERING )?INDEX idx_scraped_jobs_active_category/, cat);
});

test("a175: the kept order (ids + COUNT(*) OVER ()) is the count and every offset page of the same statement", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, discovered_at, posted_at)
    VALUES (?, 'q', ?, ?, ?, ?, ?, ?)`);
  for (let i = 0; i < 37; i++) ins.run(`j${i}`, `Co ${i % 5}`, `Engineer ${i % 7}`, `h${i}`, i % 9 === 0 ? 0 : 1, 1_700_000_000 + (i * 7919) % 1000, null);
  const join = "FROM scraped_jobs sj";
  const where = "WHERE sj.is_active = 1";
  for (const sort of ["", "newest", "companyAsc"]) {
    const order = orderByClause(buildOrderKeys(sort, [], {}));
    const kept = db.prepare(`SELECT sj.job_id AS id, COUNT(*) OVER () AS n ${join} ${where} ORDER BY ${order.sql} LIMIT 1000`).all(...order.params);
    const total = db.prepare(`SELECT COUNT(*) AS n ${join} ${where}`).get().n;
    assert.equal(kept[0].n, total, sort);
    assert.equal(kept.length, total, sort);
    for (let off = 0; off < total; off += 10) {
      const page = db.prepare(`SELECT sj.job_id AS id ${join} ${where} ORDER BY ${order.sql} LIMIT ? OFFSET ?`).all(...order.params, 11, off).map(r => r.id);
      assert.deepEqual(kept.slice(off, off + 11).map(r => r.id), page, `${sort} offset ${off}`);
    }
  }
});

test("a175: server.js chooses the page by id, reads its columns by id in the page's order, and keeps the order safely", () => {
  // the deferred join: the columns are read for the chosen ids only, and put back in the page's order
  assert.match(BOARD, /\$\{joinClause\} WHERE sj\.job_id IN \(\$\{pageIds\.map\(\(\) => "\?"\)\.join\(","\)\}\)`,\n\s*\[\.\.\.cursorCols\.params, \.\.\.joinArgs, \.\.\.pageIds\],/);
  assert.match(BOARD, /const fetched = pageIds\.map\(id => pageById\.get\(id\)\)\.filter\(Boolean\)/);
  assert.match(BOARD, /const joinArgs = baseArgs\.slice\(0, savedTab \? 4 : 5\);/);
  // an offset page inside the kept ids, or a cursor page resuming after its row's place in them (the order ends in job_id)
  assert.match(BOARD, /const keepOrder = rawCursor \? typeof cursorAfterId === "string" : offset \+ ps \+ 1 <= BOARD_ORDER_KEEP;/);
  assert.match(BOARD, /cursorAfterId = decoded\.values\[decoded\.values\.length - 1\];/);
  // a cursor row no longer kept, or a page running past the kept ids of a longer board → the statement answers it
  assert.match(BOARD, /if \(keptOrder && !\(keptFrom >= 0 && \(keptFrom \+ ps \+ 1 <= keptOrder\.ids\.length \|\| keptOrder\.ids\.length === keptOrder\.total\)\)\) keptOrder = null;/);
  // the key: the person + profile + the query without its paging, the score epoch and the gate's basis
  assert.match(BOARD, /\.\.\.req\.query, page: "", pageSize: "", page_size: "", cursor: "", include_fields: "", include_facets: "",\n\s*"~epoch": fitEpoch \?\? "", "~gate": gateBasis \?\? "",/);
  // the total comes with the kept ids — the same statement
  assert.match(BOARD, /const total = keptOrder \? keptOrder\.total : /);
  // dropped on the person's writes, after their auth context is bound (with the facets)
  const bind = at(SRC, "app.use(bindAuthContext);");
  const clear = at(SRC, "boardOrderCache.clearUser(req.user.id);");
  assert.ok(clear > bind);
  assert.match(SRC, /const boardOrderCache = createFacetsCache\(\{ ttlMs: 5 \* 60 \* 1000, max: 300, staleMs: 15 \* 60 \* 1000, store: createKeptStore\(db, "order"\), storeStaleMs: 6 \* 3600 \* 1000, refreshGate: boardRefreshGate \}\);/);
  // the columns' read is keyed by an alias the page drops before mapping
  assert.match(BOARD, /\.map\(\(\{ __page_job_id, \.\.\.r \}\) => r\)/);
});

test("a177: the order is WARMED after a person's scoring lands and on sign-in; a warm stops before anything a page load does", () => {
  // the key ignores what only changes a row's projection, so Home's read, the board and the deck's default share one entry
  assert.match(BOARD, /include_fields: "", include_facets: "",/);
  // warmOrder returns as soon as the order is kept — before the being-matched read and its queueing (no warm → score → warm loop)
  const warm = at(BOARD, "if (warmOrder) return boardReply(200, { warmed: !!keptOrder");
  assert.ok(warm < at(BOARD, "const heldStatement = `SELECT sj.job_id AS id ${joinClause} ${heldSql}"));
  assert.ok(warm < at(BOARD, "const pageIds = keptOrder ? keptOrder.ids.slice(keptFrom"));
  // one warm in flight per person, one per 30 s; the default board and the deck's ATS order
  assert.match(SRC, /if \(warmingOrder\.has\(k\) \|\| Date\.now\(\) - \(warmedOrderAt\.get\(k\) \|\| 0\) < 30_000\) return;/);
  assert.match(SRC, /for \(const query of \[\{\}, \{ sort: "atsScore" \}\]\) await boardPageResponse\(\{ user: \{ id: userId \}, query \}, \{ warmOrder: true \}\);/);
  // the two moments: the match queue's board_scored, and a sign-in
  assert.match(SRC, /emitToUser\(userId, \{ type: "board_scored", profileId: profile\.id, scored: r\.scored, waiting: q\.ids\.size \}\); warmBoardOrder\(userId\); \}/);
  assert.match(SRC, /setTimeout\(\(\) => warmBoardOrder\(user\.id, \{ facets: true \}\), 0\)/);
});

test("a175 facets: a recount older than the TTL is answered at once (stale) while ONE refresh runs; a write still drops it", async () => {
  let t = 0, n = 0, release = null;
  const cache = createFacetsCache({ now: () => t, ttlMs: 100, staleMs: 1000 });
  const first = await cache.get("7|1|", () => ({ status: 200, body: { total: ++n } }));
  assert.equal(first.cache, "miss");
  t = 500;   // past the TTL, inside the stale window
  const slow = () => new Promise(r => { n++; release = () => r({ status: 200, body: { total: n } }); });
  const a = await cache.get("7|1|", slow), b = await cache.get("7|1|", slow);
  assert.deepEqual([a.cache, a.value.body.total, b.cache, n], ["stale", 1, "stale", 2], "answered at once; ONE refresh started");
  release(); await new Promise(r => setTimeout(r, 0));
  assert.equal((await cache.get("7|1|", slow)).value.body.total, 2, "the refresh replaced it");
  cache.clearUser(7);
  t = 2000;
  assert.equal((await cache.get("7|1|", () => ({ status: 200, body: { total: 99 } }))).cache, "miss", "their write dropped it");
  // off by default: no stale answers unless asked for
  let u = 0; const plain = createFacetsCache({ now: () => u, ttlMs: 100 });
  await plain.get("1|1|", () => ({ status: 200, body: {} })); u = 500;
  assert.equal((await plain.get("1|1|", () => ({ status: 200, body: {} }))).cache, "miss");
  assert.match(SRC, /const facetsCache = createFacetsCache\(\{ ttlMs: 5 \* 60 \* 1000, staleMs: 15 \* 60 \* 1000, store: createKeptStore\(db, "facets"\), storeStaleMs: 6 \* 3600 \* 1000, refreshGate: boardRefreshGate \}\);/);
});
