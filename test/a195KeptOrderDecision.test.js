// ⭐ A195 leftover (46m) · a pass or a save updates the person's kept board order IN PLACE (services/jobs/keptOrderDecision.js)
// instead of dropping it — the board load right after a decision stays warm. Correctness first: a passed job never comes
// back from a kept order, and every kept order that survives a decision equals the order the board would compute now.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { keptOrderAfterDecision } from "../services/jobs/keptOrderDecision.js";
import { createFacetsCache, facetsKey } from "../services/jobs/facetsCache.js";
import { at } from "../test-support/sourceAnchors.js";

const ALL = facetsKey(7, 1, { "~epoch": "e" });
const SAVED = facetsKey(7, 1, { starred: "1", "~epoch": "e" });
const v = (ids, total = ids.length) => ({ status: 200, ids, total });

test("the rules: pass out of every view; un-pass / a save into a view drops; unsave leaves the Saved view", () => {
  assert.deepEqual(keptOrderAfterDecision(ALL, v(["a", "b", "c"]), "b", { disliked: true }), v(["a", "c"], 2));
  assert.equal(keptOrderAfterDecision(ALL, v(["a", "c"], 900), "z", { disliked: true }), undefined, "not in the kept ids → the kept pages can't show it");
  assert.equal(keptOrderAfterDecision(ALL, v(["a"]), "b", { wasDisliked: true }), null, "un-pass → recount");
  assert.equal(keptOrderAfterDecision(SAVED, v(["a"]), "b", { starred: true }), null, "Saved gains it → recount");
  assert.equal(keptOrderAfterDecision(ALL, v(["a", "b"]), "b", { starred: true }), undefined, "already on ALL → unchanged");
  assert.equal(keptOrderAfterDecision(ALL, v(["a"]), "b", { starred: true }), null, "a star can bring a row into ALL (D41(a)) → recount");
  assert.deepEqual(keptOrderAfterDecision(SAVED, v(["a", "b"]), "b", { wasStarred: true }), v(["a"], 1));
  assert.equal(keptOrderAfterDecision(ALL, v(["a", "b"]), "b", { wasStarred: true }), null, "it may have been on ALL only for its star");
  assert.equal(keptOrderAfterDecision(ALL, v(["a"]), "b", { wasStarred: true }), undefined);
  assert.deepEqual(keptOrderAfterDecision(SAVED, v(["a", "b"]), "b", { wasStarred: true, disliked: true }), v(["a"], 1), "pass on a saved job: out of Saved too");
  assert.equal(keptOrderAfterDecision(ALL, null, "b", { disliked: true }), null);
});

// A model board: membership = in the role scope OR starred, minus passed (server.js boardPageResponse's roleSql / ownRowsSql /
// disliked clause); the order never reads the flags (orderByClause — scores, recency, ids).
function boardOf(world, { saved = false }) {
  const rows = world.jobs.filter(j => !world.disliked.has(j.id) && (saved ? world.starred.has(j.id) : (j.inScope || world.starred.has(j.id))));
  rows.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1));
  return v(rows.map(r => r.id), rows.length);
}

test("random decisions: every kept order that survives equals the freshly computed board; a passed job never comes back", async () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let survived = 0, dropped = 0;
  for (let round = 0; round < 40; round++) {
    const jobs = Array.from({ length: 40 }, (_, i) => ({ id: `j${i}`, score: Math.floor(rnd() * 100), inScope: rnd() < 0.7 }));
    const world = { jobs, starred: new Set(), disliked: new Set() };
    for (const j of jobs) { if (rnd() < 0.15) world.starred.add(j.id); if (rnd() < 0.1) world.disliked.add(j.id); }
    const cache = createFacetsCache({ ttlMs: 60_000 });
    const keep = async () => { await cache.get(ALL, async () => boardOf(world, {})); await cache.get(SAVED, async () => boardOf(world, { saved: true })); };
    await keep();
    for (let step = 0; step < 25; step++) {
      const j = jobs[Math.floor(rnd() * jobs.length)].id;
      const was = { wasStarred: world.starred.has(j), wasDisliked: world.disliked.has(j) };
      const kind = rnd();
      // the interact route's SETs: pass (disliked, unstarred) · save (starred, not disliked) · unsave · undo a pass
      if (kind < 0.35) { world.disliked.add(j); world.starred.delete(j); }
      else if (kind < 0.7) { world.starred.add(j); world.disliked.delete(j); }
      else if (kind < 0.85) world.starred.delete(j);
      else world.disliked.delete(j);
      const now = { starred: world.starred.has(j), disliked: world.disliked.has(j) };
      cache.updateUser(7, (key, value) => keptOrderAfterDecision(key, value, j, { ...was, ...now }));
      for (const [key, saved] of [[ALL, false], [SAVED, true]]) {
        const got = await cache.get(key, async () => "RECOMPUTED");
        if (got.cache !== "hit") { dropped++; await keep(); continue; }   // dropped → recomputed on the next load (correct by construction)
        survived++;
        const fresh = boardOf(world, { saved });
        assert.deepEqual(got.value, fresh, `round ${round} step ${step}: ${saved ? "Saved" : "ALL"} after ${JSON.stringify({ j, ...was, ...now })}`);
        for (const d of world.disliked) assert.ok(!got.value.ids.includes(d), "a passed job never comes back");
      }
    }
  }
  // the point of it: most decisions keep the order warm (every pass does)
  assert.ok(survived > dropped && survived > 1000, `${survived} kept warm, ${dropped} dropped`);
});

test("the cache's updateUser: new values kept (same age), null dropped, other people untouched, in-flight answers not kept", async () => {
  let t = 1000;
  const c = createFacetsCache({ ttlMs: 100, now: () => t });
  await c.get("7|1|a", async () => v(["x", "y"]));
  await c.get("7|1|b", async () => v(["x"]));
  await c.get("8|1|a", async () => v(["x"]));
  c.updateUser(7, (k, val) => (k.endsWith("|a") ? { ...val, ids: ["y"], total: 1 } : null));
  assert.deepEqual((await c.get("7|1|a", async () => "no")).value.ids, ["y"]);
  assert.equal((await c.get("7|1|b", async () => "fresh")).value, "fresh");
  assert.deepEqual((await c.get("8|1|a", async () => "no")).value.ids, ["x"]);
  t += 150;   // the updated entry kept its age: past ttl, it is recounted
  assert.equal((await c.get("7|1|a", async () => "recounted")).value, "recounted");
});

test("server.js: the write middleware leaves the kept order to the interact route, which applies the decision", () => {
  const src = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(src, /if \(writes && !\(req\.method === "PATCH" && req\.path === "\/api\/jobs\/interact"\)\) boardOrderCache\.clearUser\(req\.user\.id\);/);
  const route = src.slice(at(src, 'app.patch("/api/jobs/interact"'), at(src, "// GET /api/jobs/poll"));
  assert.match(route, /boardOrderCache\.updateUser\(req\.user\.id, \(key, value\) => keptOrderAfterDecision\(key, value, resolvedJobId, \{\s*wasStarred: !!existing\?\.starred, wasDisliked: !!existing\?\.disliked, starred: !!newStarred, disliked: !!newDisliked \}\)\);/);
  // the counts still recount on a decision (the middleware's clearUser for facetsCache / boardDimFacetsCache stands)
  assert.match(src, /if \(writes\) facetsCache\.clearUser\(req\.user\.id\);/);
  assert.match(src, /if \(writes\) boardDimFacetsCache\.clearUser\(req\.user\.id\);/);
});
