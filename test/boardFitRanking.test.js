// POSITION ENCODES FIT — the default board ranks by the caller's own precomputed fit.
// ================================================================================================
//
// Owner decision 2026-09-29, and the hard dependency of docs/UI_REDESIGN.md §"Band as position,
// not badge": a card's POSITION is the primary fit signal, which is only true if the board sorts by
// fit. Before this, the default order was rank keys then recency, and on the owner's real profile
// the rank keys leave a 427-row tie group — so inside the band a user reads, the order was "newest
// first".
//
// What these tests pin, and why each matters:
//
//   · band THEN score, inside the rank keys, before recency;
//   · ⛔ a DECLINED score and a NOT-YET-SCORED row sort BETWEEN Moderate and Weak — never last,
//     never as a low score. "We have not judged this" is not "this is a poor fit";
//   · the band SQL is generated from shared/atsBands.js and agrees with atsBandFor for every score;
//   · a cursor walk across band boundaries (and across NULL scores) returns every row exactly once;
//   · a cursor issued before the scores changed is REFUSED, not resumed over rows that moved;
//   · the precompute is incremental, invalidates on a basis change, tells "0 scored" apart from
//     "nothing to do", yields between slices, and makes ZERO model calls;
//   · migration 110 is byte-identical in both runners and additive.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  buildOrderKeys, orderByClause, cursorProjection, cursorPredicate, encodeCursor, decodeCursor,
  FIT_KEYS, FIT_BAND_SQL, FIT_BAND_ORDINAL, ordersByFit, RECENCY, SORT_KEYS,
} from "../services/jobs/jobCursor.js";
import { createBoardFitPrecompute, atsBasisHash } from "../services/jobs/boardFitPrecompute.js";
import { atsBandFor, ATS_BAND, ATS_BAND_CUTPOINTS } from "../shared/atsBands.js";
import { scoreAtsLocally, buildRuntimeAtsBasis, LOCAL_ATS_SOURCE } from "../services/localAtsScorer.js";
import { at } from "../test-support/sourceAnchors.js";

const SERVER = fs.readFileSync("server.js", "utf8");
const RUNNER = fs.readFileSync("scripts/migrations.js", "utf8");

// ── fixture ──────────────────────────────────────────────────────────────────────────────────

const USER = 7, PROFILE = 70;
const DECLINED = "declined";   // an ats_only_reports row whose score is NULL — the scorer said "not enough signal"
const MISSING = "missing";     // no row at all — never scored

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, 'u7', 'x')").run(USER);
  db.prepare(`INSERT INTO domain_profiles
      (id, user_id, profile_name, role_family, domain, seniority, target_titles, selected_keywords,
       selected_verbs, selected_tools, is_active, created_at, updated_at, include_summary, generate_at_queue)
    VALUES (?, ?, 'Eng', 'engineering', 'engineering', 'mid', '[]', '[]', '[]', '[]', 1, 1, 1, 0, 0)`)
    .run(PROFILE, USER);
  return db;
}

/** rows: [{ id, score (number | DECLINED | MISSING), at?, title?, active?, description? }] */
function seed(db, rows) {
  const ins = db.prepare(`INSERT INTO scraped_jobs
      (job_id, search_query, company, title, _hash, scraped_at, discovered_at, is_active, description)
    VALUES (?, 'q', 'Co', ?, ?, ?, ?, ?, ?)`);
  const rep = db.prepare(`INSERT INTO ats_only_reports
      (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash)
    VALUES (?, ?, ?, '{}', ?, ?, 1, ?)`);
  for (const r of rows) {
    const t = r.at ?? 1786000000;
    ins.run(r.id, r.title ?? "Engineer", `h-${r.id}`, t, t, r.active === false ? 0 : 1,
      r.description ?? "Build services in Python and Go.");
    if (r.score !== MISSING) {
      rep.run(USER, PROFILE, r.id, r.score === DECLINED ? null : r.score, LOCAL_ATS_SOURCE, r.hash ?? null);
    }
  }
}

const JOIN = `FROM scraped_jobs sj
  LEFT JOIN ats_only_reports aor
    ON aor.job_id = sj.job_id AND aor.user_id = ${USER} AND aor.domain_profile_id IS ${PROFILE}
  WHERE sj.is_active = 1`;

function ordered(db, keys) {
  const o = orderByClause(keys);
  return db.prepare(`SELECT sj.job_id AS id, aor.ats_score AS score ${JOIN} ORDER BY ${o.sql}`)
    .all(...o.params).map(r => r.id);
}

function walk(db, keys, pageSize, epoch = null) {
  const o = orderByClause(keys);
  const proj = cursorProjection(keys);
  const seen = [];
  let cursor = null;
  for (let guard = 0; guard < 1000; guard++) {
    let pred = { sql: "", params: [] };
    if (cursor) {
      const d = decodeCursor(cursor, keys, { epoch });
      assert.ok(d.ok, `cursor rejected mid-walk: ${d.error}`);
      pred = cursorPredicate(keys, d.values);
    }
    const rows = db.prepare(
      `SELECT sj.job_id AS id${proj.sql} ${JOIN} ${pred.sql ? `AND ${pred.sql}` : ""} ORDER BY ${o.sql} LIMIT ?`,
    ).all(...proj.params, ...pred.params, ...o.params, pageSize + 1);
    const page = rows.slice(0, pageSize);
    seen.push(...page.map(r => r.id));
    if (rows.length <= pageSize) return seen;
    cursor = encodeCursor(keys, page[page.length - 1], { epoch });
  }
  throw new Error("walk did not terminate");
}

const FIT_DEFAULT = () => buildOrderKeys("dateDesc", [], { fit: true });

// ── ordering ─────────────────────────────────────────────────────────────────────────────────

test("the default board orders by band, then score, then recency", () => {
  const db = freshDb();
  // Same discovered_at for all, so recency cannot be what orders them.
  seed(db, [
    { id: "w10", score: 10 }, { id: "s50", score: 50 }, { id: "m30", score: 30 },
    { id: "s44", score: 44 }, { id: "m43", score: 43 }, { id: "w25", score: 25 },
    { id: "s70", score: 70 }, { id: "m26", score: 26 },
  ]);
  assert.deepEqual(ordered(db, FIT_DEFAULT()),
    ["s70", "s50", "s44", "m43", "m30", "m26", "w25", "w10"],
    "Strong (>=44) by score, then Moderate (>=26) by score, then Weak — the cutpoints are inclusive");
});

test("⛔ a DECLINED score and a NEVER-SCORED row sort between Moderate and Weak — never last", () => {
  const db = freshDb();
  seed(db, [
    { id: "weak", score: 3 },
    { id: "declined", score: DECLINED },
    { id: "missing", score: MISSING },
    { id: "moderate", score: 30 },
    { id: "strong", score: 60 },
  ]);
  const order = ordered(db, FIT_DEFAULT());
  assert.deepEqual(order.slice(0, 2), ["strong", "moderate"]);
  assert.deepEqual(new Set(order.slice(2, 4)), new Set(["declined", "missing"]),
    "not established is a correctness state, not a low score: it ranks BETWEEN");
  assert.equal(order[4], "weak", "a real low score is the only thing that sorts last");

  // And a board holding ONLY weak and unjudged rows leads with the unjudged ones. A NULL coerced
  // to 0 would do the opposite and bury exactly the rows we know nothing against.
  const db2 = freshDb();
  seed(db2, [{ id: "w1", score: 1 }, { id: "d", score: DECLINED }, { id: "w2", score: 20 }, { id: "x", score: MISSING }]);
  const o2 = ordered(db2, FIT_DEFAULT());
  assert.deepEqual(new Set(o2.slice(0, 2)), new Set(["d", "x"]));
  assert.deepEqual(o2.slice(2), ["w2", "w1"]);
});

test("inside one band a declined row and a missing row are ordered by recency, not by anything invented", () => {
  const db = freshDb();
  seed(db, [
    { id: "old-missing", score: MISSING, at: 1786000000 },
    { id: "new-declined", score: DECLINED, at: 1786000900 },
    { id: "mid-missing", score: MISSING, at: 1786000500 },
  ]);
  assert.deepEqual(ordered(db, FIT_DEFAULT()), ["new-declined", "mid-missing", "old-missing"]);
});

test("the band SQL is generated from shared/atsBands.js and agrees with atsBandFor on EVERY score", () => {
  // One definition: a recalibrated cutpoint must move the order and the badge together. Swept over
  // every integer the scorer can emit and beyond, plus NULL.
  const db = new Database(":memory:");
  const stmt = db.prepare(`SELECT ${FIT_BAND_SQL} AS b FROM (SELECT ? AS ats_score) AS aor`);
  const ordinalOf = (band) => band === ATS_BAND.NOT_ENOUGH_SIGNAL
    ? FIT_BAND_ORDINAL.not_established : FIT_BAND_ORDINAL[band];
  for (let s = -5; s <= 110; s++) {
    assert.equal(stmt.get(s).b, ordinalOf(atsBandFor(s)), `score ${s}`);
  }
  assert.equal(stmt.get(null).b, FIT_BAND_ORDINAL.not_established);
  assert.ok(FIT_BAND_SQL.includes(`>= ${ATS_BAND_CUTPOINTS.strong}`) && FIT_BAND_SQL.includes(`>= ${ATS_BAND_CUTPOINTS.moderate}`),
    "the cutpoints come from ATS_BAND_CUTPOINTS, not a restated literal");
  const src = fs.readFileSync("services/jobs/jobCursor.js", "utf8");
  assert.doesNotMatch(src.slice(at(src, "const FIT_BAND_SQL")), />= 44\b|>= 26\b/,
    "no hard-coded cutpoint may sit beside the generated one");
  // The ordinal the declined state gets is BETWEEN moderate and weak.
  assert.ok(FIT_BAND_ORDINAL.moderate < FIT_BAND_ORDINAL.not_established
    && FIT_BAND_ORDINAL.not_established < FIT_BAND_ORDINAL.weak);
});

test("the rank keys LEAD fit: a Strong row outside a derived window stays below an in-window Weak one", () => {
  const db = freshDb();
  seed(db, [
    { id: "miss-strong", score: 90, title: "Account Executive" },
    { id: "match-weak", score: 5, title: "Software Engineer" },
    { id: "match-strong", score: 60, title: "Software Engineer" },
  ]);
  const rankKeys = [{ sql: "CASE WHEN sj.title LIKE ? THEN 0 ELSE 2 END", params: ["%Engineer%"] }];
  assert.deepEqual(ordered(db, buildOrderKeys("dateDesc", rankKeys, { fit: true })),
    ["match-strong", "match-weak", "miss-strong"],
    "fit orders what the rank keys leave tied; it does not override CC1's scope-shaped ordering");
});

test("fit is DEFAULT-ORDER ONLY and opt-in: an explicit sort, or no opt-in, is byte-identical to before", () => {
  const rk = [{ sql: "0", params: [] }];
  for (const sort of Object.keys(SORT_KEYS).filter(s => s !== "dateDesc")) {
    assert.ok(!ordersByFit(buildOrderKeys(sort, rk, { fit: true })), `${sort} is a user-chosen order`);
  }
  assert.ok(!ordersByFit(buildOrderKeys("dateDesc", rk)), "absent opt-in adds nothing");
  assert.deepEqual(buildOrderKeys("dateDesc", rk), buildOrderKeys("dateDesc", rk, { fit: false }));
  const withFit = buildOrderKeys("dateDesc", rk, { fit: true });
  assert.ok(ordersByFit(withFit));
  // rank prefix -> FIT_KEYS -> RECENCY, and still total.
  assert.deepEqual(withFit.slice(1, 1 + FIT_KEYS.length), [...FIT_KEYS]);
  assert.deepEqual(withFit.slice(1 + FIT_KEYS.length), RECENCY);
});

// ── the cursor ───────────────────────────────────────────────────────────────────────────────

test("a cursor walk across band boundaries and NULL scores returns every row exactly once", () => {
  const db = freshDb();
  const rows = [];
  const scores = [70, 44, 44, 43, 26, 26, 25, 0, DECLINED, MISSING];
  for (let i = 0; i < 67; i++) {
    rows.push({
      id: `j${String(i).padStart(2, "0")}`,
      score: scores[i % scores.length],
      at: 1786000000 + (i % 3),                  // three timestamps: deep ties on recency too
    });
  }
  seed(db, rows);
  const keys = buildOrderKeys("dateDesc", [{ sql: "CASE WHEN sj.job_id < ? THEN 0 ELSE 1 END", params: ["j30"] }], { fit: true });
  const expected = ordered(db, keys);
  assert.equal(expected.length, 67);
  for (const ps of [1, 2, 3, 4, 5, 7, 9, 10, 50]) {
    const got = walk(db, keys, ps, 42);
    assert.equal(new Set(got).size, got.length, `page size ${ps}: a row was returned twice`);
    assert.deepEqual(got, expected, `page size ${ps}: the walk must equal the single-query order`);
  }
});

test("⛔ the cursor predicate uses IS, never = or IN — a NULL score cannot stop the feed", () => {
  const keys = FIT_DEFAULT();
  const pred = cursorPredicate(keys, keys.map(() => null));
  assert.doesNotMatch(pred.sql, /(^|[^!<>])=\s*\?|\bIN\s*\(/i, "no bare = or IN in the resume chain");
  assert.match(pred.sql, /\(CASE WHEN aor\.ats_score IS NULL[^]*?\) IS \?/, "the band key is compared null-safely");
});

test("⛔ a cursor issued before the scores changed is REFUSED, not resumed over rows that moved", () => {
  const keys = FIT_DEFAULT();
  const row = Object.fromEntries(keys.map((_, i) => [`__cursor_k${i}`, i]));
  const token = encodeCursor(keys, row, { epoch: 41 });
  assert.equal(decodeCursor(token, keys, { epoch: 41 }).ok, true);
  assert.deepEqual(decodeCursor(token, keys, { epoch: 42 }), { ok: false, error: "cursor_sort_mismatch" },
    "a precompute committed between the two pages: the feed restarts instead of skipping a row");
  // Orderings without fit carry no epoch, so every cursor issued before this change still decodes.
  const plain = buildOrderKeys("compHigh");
  const old = encodeCursor(plain, Object.fromEntries(plain.map((_, i) => [`__cursor_k${i}`, i])));
  assert.equal(decodeCursor(old, plain).ok, true);
});

test("the mid-walk hazard the epoch exists for is real: a score landing mid-walk skips a row", () => {
  // Demonstrated rather than asserted from reasoning — this is the measured defect (1 row lost in
  // a 681-row walk during a pass) in miniature. Without the epoch the walk is silently short.
  const db = freshDb();
  seed(db, [
    { id: "a", score: 60 }, { id: "b", score: 50 }, { id: "c", score: MISSING }, { id: "d", score: 10 },
  ]);
  const keys = FIT_DEFAULT();
  const o = orderByClause(keys), proj = cursorProjection(keys);
  const page = (pred) => db.prepare(
    `SELECT sj.job_id AS id${proj.sql} ${JOIN} ${pred ? `AND ${pred.sql}` : ""} ORDER BY ${o.sql} LIMIT 2`,
  ).all(...proj.params, ...(pred?.params || []), ...o.params);
  const p1 = page(null);                       // a, b
  // A precompute lands: "c" is scored Strong 80 — it now sorts BEFORE the cursor's anchor.
  db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score)
              VALUES (?, ?, 'c', '{}', 80)`).run(USER, PROFILE);
  const d = decodeCursor(encodeCursor(keys, p1[1]), keys);
  const p2 = page(cursorPredicate(keys, d.values));
  const seen = [...p1, ...p2].map(r => r.id);
  assert.ok(!seen.includes("c"), "without the epoch, c is skipped — which is why the epoch exists");

  // With it, the server refuses the stale cursor: the epoch moved with the insert.
  const epoch = (dbx) => dbx.prepare("SELECT COALESCE(MAX(id),0) e FROM ats_only_reports WHERE user_id=? AND domain_profile_id IS ?").get(USER, PROFILE).e;
  const before = epoch(db) - 1;              // the value page 1 would have been signed with
  const signed = encodeCursor(keys, p1[1], { epoch: before });
  assert.equal(decodeCursor(signed, keys, { epoch: epoch(db) }).error, "cursor_sort_mismatch");
});

// ── the precompute ───────────────────────────────────────────────────────────────────────────

/** A store with the shape of server.js's storeAtsReportForProfile: delete-then-insert, per key. */
const makeStore = (db) => ({ userId, profileId, jobId, report, basisHash }) => {
  db.prepare("DELETE FROM ats_only_reports WHERE user_id=? AND job_id=? AND domain_profile_id IS ?").run(userId, jobId, profileId);
  db.prepare(`INSERT INTO ats_only_reports (user_id, domain_profile_id, job_id, ats_report, ats_score, scorer_version, scored_at, basis_hash)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(userId, profileId, jobId, JSON.stringify(report), report.score ?? null, report.source || LOCAL_ATS_SOURCE, basisHash);
};
const quietLog = () => { const lines = []; return { lines, log: (l) => lines.push(["log", l]), warn: (l) => lines.push(["warn", l]), error: (l) => lines.push(["error", l]) }; };
const profileRow = (db) => db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(PROFILE);

function fakePrecompute(db, { hash = "H1", scoreJob, sliceMs = 1000 } = {}) {
  const calls = [];
  const log = quietLog();
  const pc = createBoardFitPrecompute({
    db, log, sliceMs,
    basisFor: () => ({ runtimeBasis: { resumeText: "r" }, basisHash: typeof hash === "function" ? hash() : hash }),
    scoreJob: scoreJob || ((job) => { calls.push(job.job_id); return { score: 50, source: LOCAL_ATS_SOURCE }; }),
    store: makeStore(db),
  });
  return { pc, calls, log };
}

test("the precompute is INCREMENTAL: a second pass over an unchanged board scores nothing", async () => {
  const db = freshDb();
  seed(db, Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, score: MISSING })));
  const { pc, calls } = fakePrecompute(db);
  const first = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(first.status, "scored");
  assert.equal(first.scored, 12);
  assert.equal(calls.length, 12);

  const second = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(second.status, "nothing_to_do");
  assert.equal(calls.length, 12, "nothing was re-scored");

  // One posting arrives: exactly one is scored.
  seed(db, [{ id: "new", score: MISSING }]);
  const third = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(third.status, "scored");
  assert.equal(third.scored, 1);
  assert.deepEqual(calls.slice(12), ["new"]);
});

test("a basis change INVALIDATES: every row is re-scored and carries the new hash", async () => {
  const db = freshDb();
  seed(db, Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, score: MISSING })));
  let h = "H1";
  const { pc, calls } = fakePrecompute(db, { hash: () => h });
  await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(calls.length, 5);

  h = "H2";   // the résumé / claims / profile changed
  const plan = pc.plan({ userId: USER, profileId: PROFILE, basisHash: h });
  assert.equal(plan.stale, 5);
  assert.equal(plan.fresh, 0);
  const r = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(r.scored, 5);
  assert.equal(calls.length, 10);
  const hashes = db.prepare("SELECT DISTINCT basis_hash h FROM ats_only_reports").all().map(x => x.h);
  assert.deepEqual(hashes, ["H2"]);
});

test("a row written before migration 110 (basis_hash NULL) is stale, never fresh", async () => {
  // `<> ?` would call these fresh forever (NULL <> 'x' is NULL); the plan uses IS NOT.
  const db = freshDb();
  seed(db, [{ id: "legacy", score: 33, hash: null }, { id: "current", score: 33, hash: "H1" }]);
  const { pc } = fakePrecompute(db);
  const plan = pc.plan({ userId: USER, profileId: PROFILE, basisHash: "H1" });
  assert.deepEqual(plan.jobIds, ["legacy"]);
  assert.equal(plan.fresh, 1);
});

test("inactive postings are not scored", async () => {
  const db = freshDb();
  seed(db, [{ id: "live", score: MISSING }, { id: "closed", score: MISSING, active: false }]);
  const { pc, calls } = fakePrecompute(db);
  await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.deepEqual(calls, ["live"]);
});

test("⛔ '0 scored' and 'nothing to do' are different results, logged at different levels", async () => {
  const db = freshDb();
  seed(db, [{ id: "x1", score: MISSING }, { id: "x2", score: MISSING }]);
  const broken = fakePrecompute(db, { scoreJob: () => { throw new Error("boom"); } });
  const r = await broken.pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(r.status, "failed", "work was found and none of it was written");
  assert.equal(r.scored, 0);
  assert.equal(r.failed, 2);
  assert.equal(r.todo, 2);
  assert.ok(broken.log.lines.some(([lvl, l]) => lvl === "error" && /"status":"failed"/.test(l)));

  const ok = fakePrecompute(db);
  await ok.pc.runFor({ userId: USER, profile: profileRow(db) });
  const idle = await ok.pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(idle.status, "nothing_to_do");
  assert.equal(idle.todo, 0);
  assert.ok(ok.log.lines.some(([lvl, l]) => lvl === "log" && /"status":"nothing_to_do"/.test(l)));
  assert.ok(!ok.log.lines.some(([lvl]) => lvl === "error"));
});

test("no base résumé is its own status, not a zero", async () => {
  const db = freshDb();
  seed(db, [{ id: "n1", score: MISSING }]);
  const log = quietLog();
  const pc = createBoardFitPrecompute({ db, log, basisFor: () => null, scoreJob: () => ({}), store: () => {} });
  const r = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(r.status, "no_basis");
  assert.equal(r.why, "no_base_resume");
});

test("a dry run reports the plan and writes nothing", async () => {
  const db = freshDb();
  seed(db, [{ id: "d1", score: MISSING }, { id: "d2", score: 40, hash: "OLD" }, { id: "d3", score: 40, hash: "H1" }]);
  const { pc, calls } = fakePrecompute(db);
  const before = db.prepare("SELECT COUNT(*) n FROM ats_only_reports").get().n;
  const r = await pc.runFor({ userId: USER, profile: profileRow(db), dryRun: true });
  assert.equal(r.status, "dry_run");
  assert.deepEqual({ active: r.active, fresh: r.fresh, missing: r.missing, stale: r.stale, todo: r.todo },
    { active: 3, fresh: 1, missing: 1, stale: 1, todo: 2 });
  assert.equal(calls.length, 0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ats_only_reports").get().n, before);
});

test("writes are chunked with a yield between chunks, and happen only after all scoring", async () => {
  const db = freshDb();
  seed(db, Array.from({ length: 25 }, (_, i) => ({ id: `k${String(i).padStart(2, "0")}`, score: MISSING })));
  const store = makeStore(db);
  // `scoring` flips false on the LAST score; any store call before that is a write interleaved
  // with scoring — the shape that moved rows under a paging user.
  let scoring = true, scoredCount = 0, writesDuringScoring = 0;
  const pc = createBoardFitPrecompute({
    db, log: quietLog(), commitChunk: 10,
    basisFor: () => ({ runtimeBasis: {}, basisHash: "H" }),
    scoreJob: () => { if (++scoredCount === 25) scoring = false; return { score: 30, source: LOCAL_ATS_SOURCE }; },
    store: (a) => { if (scoring) writesDuringScoring++; store(a); },
  });
  const r = await pc.runFor({ userId: USER, profile: profileRow(db) });
  assert.equal(r.scored, 25);
  assert.equal(r.commits, 3, "25 rows in chunks of 10");
  assert.equal(writesDuringScoring, 0, "no row is written while the pass is still scoring");
});

test("the pass YIELDS to the event loop between slices and commits once at the end", async () => {
  const db = freshDb();
  seed(db, Array.from({ length: 30 }, (_, i) => ({ id: `y${String(i).padStart(2, "0")}`, score: MISSING })));
  const busy = (ms) => { const t = performance.now(); while (performance.now() - t < ms) { /* spin */ } };
  const { pc } = fakePrecompute(db, {
    sliceMs: 10,
    scoreJob: () => { busy(3); return { score: 30, source: LOCAL_ATS_SOURCE }; },
  });
  let ticks = 0, rowsSeenMidPass = 0;
  const ticker = setInterval(() => {
    ticks++;
    rowsSeenMidPass = Math.max(rowsSeenMidPass, db.prepare("SELECT COUNT(*) n FROM ats_only_reports").get().n);
  }, 0);
  const r = await pc.runFor({ userId: USER, profile: profileRow(db) });
  clearInterval(ticker);
  assert.equal(r.scored, 30);
  assert.ok(r.yields >= 5, `30 x 3ms in 10ms slices must yield repeatedly (yields=${r.yields})`);
  assert.ok(ticks >= 3, `timers must run DURING the pass, not only after it (ticks=${ticks})`);
  assert.equal(rowsSeenMidPass, 0,
    "nothing is visible until the single commit — the board's order changes at one instant");
});

test("schedule() coalesces: a trigger mid-run asks for ONE follow-up pass, not a second concurrent one", async () => {
  const db = freshDb();
  seed(db, [{ id: "c1", score: MISSING }]);
  const { pc } = fakePrecompute(db);
  const p = profileRow(db);
  const a = pc.schedule({ userId: USER, profile: p, reason: "t1" });
  const b = pc.schedule({ userId: USER, profile: p, reason: "t2" });
  const c = pc.schedule({ userId: USER, profile: p, reason: "t3" });
  assert.equal(a, b);
  assert.equal(b, c);
  const last = await a;
  assert.equal(last.status, "nothing_to_do", "the follow-up pass found the first one's work done");
  assert.equal(pc.isRunning(USER, PROFILE), false);
});

// ── zero model calls ─────────────────────────────────────────────────────────────────────────

test("⛔ ZERO MODEL CALLS: the precompute, run against the REAL scorer, touches no network", async () => {
  const db = freshDb();
  seed(db, [
    { id: "r1", score: MISSING, title: "Backend Engineer", description: "We build distributed systems in Go and Python on Kubernetes. PostgreSQL, Kafka, AWS. 3+ years." },
    { id: "r2", score: MISSING, title: "Account Executive", description: "Own a quota, prospect enterprise accounts, run discovery calls and close deals." },
  ]);
  const realFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = async () => { network++; throw new Error("network is forbidden on the precompute path"); };
  try {
    const resumeText = "Backend engineer. Go, Python, Kubernetes, PostgreSQL, Kafka, AWS. Built distributed systems for 4 years.";
    const pc = createBoardFitPrecompute({
      db, log: quietLog(),
      basisFor: (_u, profile) => {
        const runtimeBasis = buildRuntimeAtsBasis({ resumeText, signalProfile: null, domainProfile: profile });
        return { runtimeBasis, basisHash: atsBasisHash(runtimeBasis, { scorerVersion: LOCAL_ATS_SOURCE }) };
      },
      scoreJob: (job, runtimeBasis) => scoreAtsLocally({ job, runtimeBasis }),
      store: makeStore(db),
    });
    const r = await pc.runFor({ userId: USER, profile: profileRow(db) });
    assert.equal(r.status, "scored");
    assert.equal(r.scored, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(network, 0);
  const s = Object.fromEntries(db.prepare("SELECT job_id, ats_score FROM ats_only_reports").all().map(x => [x.job_id, x.ats_score]));
  assert.ok(s.r1 == null || s.r2 == null || s.r1 > s.r2, `the real scorer ran: backend ${s.r1} vs AE ${s.r2}`);
});

test("⛔ ZERO MODEL CALLS: nothing on the precompute's import graph can reach a model client", () => {
  // Walks the static imports from the precompute module and from the scorer server.js injects,
  // transitively, and refuses any model SDK or model-call wrapper. A runtime stub only proves the
  // calls that happened; this proves the ones that could.
  const FORBIDDEN = /@anthropic-ai\/sdk|openai|services\/modelCall\.js|\/modelCall\.js|toolsService/;
  const seen = new Set();
  const resolve = (from, spec) => {
    if (spec === "@draft/ats-scorer") return path.resolve("packages/ats-scorer/src/index.js");
    if (!spec.startsWith(".")) return null;
    return path.resolve(path.dirname(from), spec);
  };
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)) {
      const spec = m[1] || m[2];
      assert.doesNotMatch(spec, FORBIDDEN, `${path.relative(".", file)} imports ${spec}`);
      const next = resolve(file, spec);
      if (next && fs.existsSync(next)) visit(next);
    }
  };
  visit(path.resolve("services/jobs/boardFitPrecompute.js"));
  visit(path.resolve("services/localAtsScorer.js"));
  assert.ok(seen.size >= 4, `walked ${seen.size} modules`);
});

// ── one definition: the precompute runs the panel's own path ─────────────────────────────────

test("the precompute is wired to the SAME basis builder and scorer call the ATS panel uses", () => {
  // Shape 1. If the board's order and the report a user opens came from two copies of the scoring
  // call, they could disagree — a card sorted as Strong whose report reads Weak.
  assert.match(SERVER, /createBoardFitPrecompute\(\{\s*db, basisFor: atsBasisForProfile, scoreJob: scoreJobForBasis, store: storeAtsReportForProfile,/);
  const panel = SERVER.slice(at(SERVER, 'app.post("/api/jobs/:id/keywords"'), at(SERVER, 'app.get("/api/jobs/by-id/:jobId"'));
  assert.match(panel, /atsBasisForProfile\(userId, keywordsProfile, \{ resumeText \}\)/);
  assert.match(panel, /scoreJobForBasis\(job, runtimeBasis\)/);
  assert.doesNotMatch(panel, /scoreAtsLocally\(/, "the panel must not keep a private copy of the scorer call");
  // …and the panel's cache read asks for THIS basis, so it cannot serve a report for an old résumé.
  assert.match(panel, /AND basis_hash IS \?/);
  // The precompute module itself contains no scorer.
  const mod = fs.readFileSync("services/jobs/boardFitPrecompute.js", "utf8");
  assert.doesNotMatch(mod, /^import[^\n]*(ats-scorer|localAtsScorer|atsTermWeights)/m);
});

test("the board route: fit only on the default, non-Saved, curated board; disclosed; epoch-signed", () => {
  const route = SERVER.slice(at(SERVER, 'app.get("/api/jobs", requireAuth'), at(SERVER, "include_facets (optional, default-off)"));
  assert.match(route, /const fitRequested = !savedTab && req\.query\.curate !== 'off';/);
  assert.match(route, /buildOrderKeys\(sort, richFilters\.rank\.keys, \{ fit: fitRequested \}\)/);
  assert.match(route, /rankedKeys: fitApplied \? \[\.\.\.richFilters\.rankedKeys, 'fit'\] : richFilters\.rankedKeys/);
  assert.match(route, /decodeCursor\(rawCursor, orderKeys, \{ epoch: fitEpoch \}\)/);
  assert.match(route, /encodeCursor\(orderKeys, rows\[rows\.length - 1\], \{ epoch: fitEpoch \}\)/);
  // The card's matchScore and the fit keys read the same cell.
  assert.match(route, /aor\.ats_score AS matchScore/);
});

// ── the basis hash ───────────────────────────────────────────────────────────────────────────

test("the basis hash moves with every candidate-side input and ignores corpus-side ones", () => {
  const b = buildRuntimeAtsBasis({ resumeText: "Go and Python", signalProfile: { skills: ["go"], structuredFacts: { a: 1, b: 2 } }, domainProfile: { seniority: "mid" }, claims: { skills: ["kafka"] } });
  const h = atsBasisHash(b, { scorerVersion: "v4" });
  assert.equal(h, atsBasisHash({ ...b }, { scorerVersion: "v4" }), "deterministic");
  assert.equal(h, atsBasisHash({ ...b, structuredFacts: { b: 2, a: 1 } }, { scorerVersion: "v4" }), "key order is irrelevant");
  assert.equal(h, atsBasisHash({ ...b, termWeights: new Map([["go", 2]]) }, { scorerVersion: "v4" }), "term weights are corpus-side");
  assert.notEqual(h, atsBasisHash({ ...b, resumeText: "Go and Rust" }, { scorerVersion: "v4" }), "résumé");
  assert.notEqual(h, atsBasisHash({ ...b, claimedSkills: ["kafka", "flink"] }, { scorerVersion: "v4" }), "claims");
  assert.notEqual(h, atsBasisHash({ ...b, seniority: "senior" }, { scorerVersion: "v4" }), "profile");
  assert.notEqual(h, atsBasisHash(b, { scorerVersion: "v5" }), "a scorer change invalidates every row");
});

// ── migration 110 ────────────────────────────────────────────────────────────────────────────

test("migration 110 is present, additive, and byte-identical in both migration paths", () => {
  const block = (src) => {
    const i = src.indexOf('id: "110_ats_reports_basis_hash"');
    assert.ok(i > 0, "migration 110 must exist");
    return src.slice(i, at(src, "\n    },", i));
  };
  const a = block(SERVER), b = block(RUNNER);
  assert.equal(a, b, "the migration must be byte-identical in server.js and scripts/migrations.js");
  assert.doesNotMatch(a, /\bDROP\b|\bUPDATE\b|\bDELETE\b|RENAME/i, "additive only");
  assert.match(a, /ALTER TABLE ats_only_reports ADD COLUMN basis_hash TEXT;/);

  const db = freshDb();
  const cols = db.prepare("SELECT name FROM pragma_table_info('ats_only_reports')").all().map(r => r.name);
  assert.ok(cols.includes("basis_hash"));
  // The 108 index still serves the join: the board's LEFT JOIN is an index seek.
  const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT aor.ats_score FROM scraped_jobs sj
    LEFT JOIN ats_only_reports aor ON aor.job_id = sj.job_id AND aor.user_id = 1 AND aor.domain_profile_id IS 2`).all()
    .map(r => r.detail).join(" | ");
  assert.match(plan, /SEARCH aor USING INDEX/);
});
