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

test("the Operations tab's section counts the backlog and sends the operator to export → import — no Enrich button", () => {
  const src = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(src, /<EnrichmentSection theme=\{theme\}\/>/, "mounted in OpsTab");
  const sec = src.slice(at(src, "export function EnrichmentSection"), at(src, "export function JobDataSection"));
  assert.ok(sec.length > 100, "the section exists");
  // It only ever posts the count — never apply.
  assert.match(sec, /api\("\/api\/admin\/enrichment\/run", \{ method: "POST", body: JSON\.stringify\(params\(\)\) \}\)/);
  assert.doesNotMatch(sec, /apply: true/, "the section can ask for a model run again");
  assert.doesNotMatch(sec, /Enrich \$\{|>Enrich…</, "an Enrich button came back");
  // It names the replacement and links to it.
  assert.match(sec, /href="\/admin\/db"/);
  assert.match(sec, /Enrichment Round Trip/);
  // The columns it reads are real enrichment columns.
  const sel = fs.readFileSync("services/jobs/enrichmentSelection.js", "utf8");
  const cols = JSON.parse(src.match(/const enrichCols = (\[[^\]]+\]);/)[1]);
  for (const c of cols.filter(c => c !== "enriched_at")) assert.ok(sel.includes(`'${c}'`), `${c} is an ENRICHMENT_COLUMN`);
});
