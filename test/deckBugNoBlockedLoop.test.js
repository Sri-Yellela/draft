// ⚠⚠⚠ THE DECK BUG (owner 11-03: "it says upload résumé, showing no jobs and Daily Deck keeps loading") — 44p's guards.
// Measured cause (WORKLOG NOW, 44p): after A112's crawler boost (3,734 → 81,510 postings) the Atlas live-count queue was
// drained WHOLE and synchronously by every write and every Atlas read (≈ 4.3 ms a posting: 12,030 queued = 51 s), so the
// event loop was blocked and every request on the server hung (production 11-02 ≈ 19:05Z, a static favicon included).
// Full House drew the failed profile read as "no profile" ("Upload your résumé"); the deck had no timeout.
// Synthetic companies and postings; an in-memory database built from the migrations.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { syncAtlasPostings, atlasPostingsChanged, drainAtlasQueue, startAtlasDrainer, atlasQueueLength,
  ATLAS_DRAIN_SLICE } from "../services/atlas/atlasLive.js";
import { readStaleLevels } from "../services/jobs/levelRead.js";
import { tagStaleJobs } from "../services/jobs/jobTags.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
let seq = 0;
const post = (db, { title = "Backend Engineer", company = "Co", text = "Write Python services and SQL reports." } = {}) => {
  const id = `b${++seq}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active)
    VALUES (?,?,?,?,?,?,?,1)`).run(id, "q", `h${id}`, title, company, `https://x.test/${id}`, text);
  return id;
};
function board(n = 3) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, name] of [["skill", "Python"], ["skill", "SQL"], ["role", "Backend Engineer"]]) {
    upsertNode(db, { kind, name, source: "registry" });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE name = ?`).pluck().get(name), "published");
  }
  for (let i = 0; i < n; i++) post(db, { company: `Co${i % 7}` });
  computeAtlasStats(db, { now: 1000 });   // the baseline
  return db;
}
const pythonCount = (db) => db.prepare(`SELECT s.postings FROM atlas_node_stats s JOIN atlas_nodes n ON n.id = s.node_id WHERE n.name = 'Python'`).pluck().get() ?? 0;

test("44p · noUnboundedDrainOnRead — a read or a write drains a small slice of a large queue, never the whole of it", () => {
  const db = board();
  for (let i = 0; i < 400; i++) post(db, { company: `Big${i % 11}` });
  assert.equal(atlasQueueLength(db), 400);
  // A fake clock that has always spent the budget: exactly ONE slice, whatever the queue.
  const r = atlasPostingsChanged(db, { clock: (() => { let t = 0; return () => (t += 1000); })() });
  assert.equal(r.postings, ATLAS_DRAIN_SLICE, "one slice of the queue, not the 400");
  assert.equal(r.pending, 400 - ATLAS_DRAIN_SLICE);
  assert.equal(atlasQueueLength(db), 400 - ATLAS_DRAIN_SLICE, "the rest stays queued for the background drainer");
  // syncAtlasPostings with a limit reads at most that many.
  assert.equal(syncAtlasPostings(db, { limit: 5 }).postings, 5);
});

test("44p · a small queue still settles in the same call (a single write or a test's handful)", () => {
  const db = board();
  const before = pythonCount(db);
  post(db); post(db);
  const r = atlasPostingsChanged(db);
  assert.equal(r.pending, 0);
  assert.equal(pythonCount(db), before + 2, "Python's count moved by the two new postings in the same call");
});

test("44p · slices give the same counts as one whole drain (each slice is one more incremental step)", () => {
  const a = board(), b = board();
  for (const db of [a, b]) for (let i = 0; i < 90; i++) post(db, { company: `S${i % 5}`, text: i % 3 ? "Python and SQL every day." : "SQL only, nothing else." });
  syncAtlasPostings(a);                                        // whole
  while (atlasQueueLength(b)) drainAtlasQueue(b, { budgetMs: 0 });   // one slice at a time
  const stats = (db) => db.prepare(`SELECT node_id, postings FROM atlas_node_stats ORDER BY node_id`).all();
  assert.deepEqual(stats(b), stats(a));
});

test("44p · the background drainer empties a backlog in slices, yielding to the event loop between them", async () => {
  const db = board();
  for (let i = 0; i < 120; i++) post(db, { company: `D${i % 9}` });
  let ticks = 0;
  const beat = setInterval(() => { ticks++; }, 5);
  const stop = startAtlasDrainer(db, { budgetMs: 1, restMs: 5, idleMs: 1000, log: { log() {}, warn() {} } });
  const deadline = Date.now() + 20000;
  while (atlasQueueLength(db) && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
  stop(); clearInterval(beat);
  assert.equal(atlasQueueLength(db), 0, "the backlog was counted");
  assert.ok(ticks > 2, `other timers ran while it drained (${ticks})`);
});

test("44p · the level and tag passes stop at their limit — no whole-board pass in one go", () => {
  const db = board();
  for (let i = 0; i < 30; i++) post(db);
  const l = readStaleLevels(db, { limit: 7 });
  assert.equal(l.read, 7);
  const t = tagStaleJobs(db, { limit: 9 });
  assert.equal(t.tagged, 9);
  assert.equal(tagStaleJobs(db, { limit: 1000 }).tagged, 33 - 9, "the rest on the next slice");
  assert.equal(tagStaleJobs(db).tagged, 0, "idempotent once settled");
});

test("44p · server.js: the drainer starts after listen; the 10-minute pass runs in slices with limits", () => {
  const s = read("server.js");
  const listen = at(s, "app.listen(PORT, () => {");
  assert.ok(at(s, "startAtlasDrainer(db);", listen) > listen, "startAtlasDrainer inside the listen callback");
  assert.match(s, /tagStaleJobs\(db, \{ limit: 200 \}\)/);
  assert.match(s, /readStaleLevels\(db, \{ limit: 100 \}\)/);
  // D151 Rule 1 (11-04): the boot's first slice is a warm-up step, after the listener binds.
  assert.match(s, /BOOT\.add\("job tags \(first slice\)", \(\) => runJobTagPassSliced\("boot"\)\)/);
  assert.match(s, /setInterval\(\(\) => runJobTagPassSliced\("interval"\)/);
});

test("44p · deckNeverSpinsForever — the deck's request has a timeout and a failure shows Try again", () => {
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /const DECK_TIMEOUT_MS = 8000;/);
  assert.match(deck, /api\(`\/api\/draft\/today\?[^`]*`, \{ timeoutMs: DECK_TIMEOUT_MS \}\)/);
  assert.match(deck, /load\.status === "error"[\s\S]{0,600}Try again/);
  const api = read("client/src/lib/api.js");
  assert.match(api, /AbortSignal\.timeout\(timeoutMs\)/);
  assert.match(api, /TimeoutError[\s\S]{0,120}didn't answer in time/);
});

test("44p · precomputeFailureShowsLastGood — a failed refresh keeps today's last good deal on screen, saying so", () => {
  const deck = read("client/src/panels/DeckView.jsx");
  assert.match(deck, /lastGoodDeck\.set\(cacheKey, deck\)/);
  assert.match(deck, /const last = lastGoodDeck\.get\(cacheKey\);[\s\S]{0,300}stale:/);
  assert.match(deck, /data-deck-stale[\s\S]{0,400}Try again/);
});

test("44p · resumePromptOnlyOnEmptySuccess — 'Start with your résumé' only when the profile read succeeded and found none", () => {
  const jp = read("client/src/panels/JobsPanel.jsx");
  assert.doesNotMatch(jp, /api\("\/api\/domain-profiles"[^)]*\)[\s\S]{0,900}\.catch\(\(\) => \{\}\)/, "the profile read no longer swallows its error");
  assert.match(jp, /setProfilesState\(s => \(s === "ready" \? s : "error"\)\)/);
  const from = at(jp, "const setupBlock = ");
  const block = jp.slice(from, at(jp, "const canRankByFit", from));
  assert.ok(block.indexOf(`profilesState === "error"`) < block.indexOf("Start with your résumé"), "the failure is answered before the prompt");
  assert.match(block, /We couldn't load your job profiles/);
  assert.match(block, /profilesState !== "ready" \? null/, "nothing replaces the board while the read is in flight");
});
