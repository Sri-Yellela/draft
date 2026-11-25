// ⭐ A239 (47g, found by the signed-in walk of the plate market) · A NEW PERSON'S COUNTS FOLLOW THEIR SCORING.
// The match queue's board_scored batches cleared the held counts and warmed the order, but left GET /api/jobs/facets' kept
// answer alone. The sign-in warm had counted before the person's postings were scored, so the market's hero read
// 0 · 0 · 0 · 0 (then 41) as a fresh cache "hit" for 5 minutes while the board held 916. Now each batch marks the counts
// stale (answered at once, one recount behind — A195), the queue's last batch drops them (the next ask counts exactly),
// and the client asks for the counts again with the board's own board_scored refresh.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFacetsCache } from "../services/jobs/facetsCache.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("A239: a scored batch ages the kept counts (stale + one recount); the last batch drops them (an exact count)", async () => {
  let t = 1_000_000, counted = 0;
  const cache = createFacetsCache({ ttlMs: 300_000, staleMs: 900_000, now: () => t });
  const compute = async () => ({ status: 200, body: { views: { all: counted } } });
  const key = "7|3|";
  assert.equal((await cache.get(key, compute)).value.body.views.all, 0);   // the sign-in warm: nothing scored yet
  counted = 41;
  assert.equal((await cache.get(key, compute)).cache, "hit", "before A239 this answer stood for 5 minutes");
  cache.markStale(7);                                                       // a batch landed, more waiting
  const stale = await cache.get(key, compute);
  assert.equal(stale.cache, "stale");
  await new Promise((r) => setImmediate(r));                                // the recount behind it
  assert.equal((await cache.get(key, compute)).value.body.views.all, 41, "the next ask has the recount");
  counted = 916;
  cache.clearUser(7);                                                       // the queue's last batch
  const exact = await cache.get(key, compute);
  assert.equal(exact.cache, "miss");
  assert.equal(exact.value.body.views.all, 916);
});

test("A239 (pins): the queue marks / drops the counts per batch, and the board's board_scored refresh asks for them again", () => {
  const server = read("server.js");
  assert.match(server, /if \(r\?\.scored\) \{ heldCounts\.clearUser\(userId\); if \(q\.ids\.size\) facetsCache\.markStale\(userId\); else facetsCache\.clearUser\(userId\); emitToUser\(userId, \{ type: "board_scored"/);
  const panel = read("client/src/panels/JobsPanel.jsx");
  assert.match(panel, /board_scored: \(\) => \{[\s\S]{0,700}fetchJobsRef\.current\?\.\(1\)\.catch\(\(\) => \{\}\); setFacetsNonce\(n => n \+ 1\); \}, 4000\);/);
});
