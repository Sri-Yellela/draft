// ⭐ A183 (46f, measured at 100k / 20 users, Chrome closed) · THE KEYWORDS PANEL'S READ-ONLY POST DROPPED THE KEPT BOARD.
// D156 (6) clears a person's kept facets counts and kept board order on ANY non-GET request. POST /api/jobs/:id/keywords
// (the résumé check / report panel) is a POST that usually only READS: when a report for the same basis and posting is
// kept it answers it and writes nothing — yet the middleware had already dropped both caches, so the next board load and
// its counts recomputed on the read workers (40 of 101 board loads in the suite were misses). Now the middleware skips that
// one route and the route clears both itself ONLY after storeAtsReportForProfile — D156 (6) still holds for a real write.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const SRC = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");

test("a183: the write-clearing middleware skips only the keywords panel's POST, still after the auth context is bound", () => {
  assert.match(SRC, /const KEYWORDS_PANEL = \/\^\\\/api\\\/jobs\\\/\[\^\/\]\+\\\/keywords\$\/;/);
  assert.match(SRC, /const writes = req\.method !== "GET" && req\.method !== "HEAD" && req\.user\?\.id != null && !\(req\.method === "POST" && KEYWORDS_PANEL\.test\(req\.path\)\);/);
  // A195 leftover (46m): the order's clear now also skips a pass / save (applied in place by PATCH /api/jobs/interact)
  assert.match(SRC, /if \(writes\) facetsCache\.clearUser\(req\.user\.id\);\n  \/\/ ⭐ A175: …and their kept board order\.[^\n]*\n[^\n]*\n  if \(writes && !\(req\.method === "PATCH" && req\.path === "\/api\/jobs\/interact"\)\) boardOrderCache\.clearUser\(req\.user\.id\);/);
  assert.ok(at(SRC, "const writes = req.method") > at(SRC, "app.use(bindAuthContext);"));
  const re = /^\/api\/jobs\/[^/]+\/keywords$/;
  assert.ok(re.test("/api/jobs/greenhouse%3A%3A123/keywords"));
  for (const p of ["/api/jobs/x/star", "/api/jobs/x/keywords/extra", "/api/jobs/keywords", "/api/jobs/x/y/keywords"]) assert.ok(!re.test(p), p);
});

test("a183: the keywords route clears both caches right after it STORES a report — and not on the kept-report answer", () => {
  const route = SRC.slice(at(SRC, 'app.post("/api/jobs/:id/keywords"'), at(SRC, "// ── Pending jobs (resume generated but not yet applied or disliked) ──"));
  // A195 (46j, changed on purpose): the counts are MARKED STALE after a store (served at once, recounted behind); the order is dropped.
  const kept = at(route, "if (cached?.ats_report) {"), store = at(route, "storeAtsReportForProfile({"), clear = at(route, "facetsCache.markStale(userId); boardOrderCache.clearUser(userId); boardDimFacetsCache.clearUser(userId);");
  assert.ok(kept < store && store < clear, "the kept answer returns before any clear; the clear follows the store");
  assert.doesNotMatch(route.slice(kept, store), /clearUser|markStale/, "the read-only answer drops nothing");
});
