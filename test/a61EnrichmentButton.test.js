import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createEnrichmentRouter } from "../routes/enrichment.js";
import { at } from "../test-support/sourceAnchors.js";

// A61 (owner, O45b, 10-02) gave the enrichment run a button in the admin Operations tab: a dry run,
// then "Enrich N" — real model calls. D17 (owner, 10-03): a model is for résumé generation only. The
// section now COUNTS the backlog and shows the board's coverage, and points at the round trip that
// replaced the button (the DB inspector's export → import). It can no longer ask for a model run.

function mount() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, username: "admin" }; next(); });
  app.use("/api/admin/enrichment", createEnrichmentRouter(db, (_req, _res, next) => next(), { anthropic: null }));
  const server = app.listen(0);
  return { db, base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}

test("the backlog count carries the candidates, the per-request cap and the coverage — and no model budget", async () => {
  const { base, stop } = mount();
  try {
    const r = await fetch(`${base}/api/admin/enrichment/run`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 10 }) });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.dryRun, true, "nothing sent");
    assert.equal(b.plan.manualCap, 100);
    assert.ok(b.plan.coverageNow && typeof b.plan.coverageNow.total === "number");
    assert.equal(b.plan.nightlyBudget, undefined, "there is no nightly model drain any more (D17)");
    assert.equal(b.plan.estimate, undefined, "there is no model spend to estimate (D17)");
  } finally { stop(); }
});

// D83 (10-08) retired the Operations tab's "Count the backlog" section — the panel D83 names as the anti-example
// (a number only after a click, a free-text source box, the real work on another page). Admin → Enrichment
// (panels/adminEnrichment.jsx, test/d83AdminEnrichment.test.js) is the whole round trip now. What A61 guarded still
// holds there: no admin surface can ask for a model run.
test("the Operations tab no longer carries the backlog section; Admin → Enrichment replaces it — and no Enrich button anywhere", () => {
  const ops = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.doesNotMatch(ops, /<EnrichmentSection|export function EnrichmentSection/, "the retired section came back");
  const admin = fs.readFileSync("client/src/panels/AdminPanel.jsx", "utf8");
  // D83's map (39d): The board → Enrichment.
  assert.match(fs.readFileSync("client/src/panels/adminMap.js", "utf8"), /\["enrichment", "Enrichment"\]/);
  assert.match(admin, /\{at\("board", "enrichment"\) && <EnrichmentTab\/>\}/);
  const page = fs.readFileSync("client/src/panels/adminEnrichment.jsx", "utf8");
  assert.doesNotMatch(page, /enrichment\/run/, "the page never posts to the retired model trigger");
  assert.doesNotMatch(page, /Enrich \$\{|>Enrich…</, "an Enrich button came back");
});
