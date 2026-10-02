import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createEnrichmentRouter } from "../routes/enrichment.js";
import { at } from "../test-support/sourceAnchors.js";

// A61 (owner, O45b, 10-02): the enrichment run gets a button in the admin Operations tab. It spends
// real money per row, so it follows A50's pattern: dry run by default; "Enrich N" unlocks only after
// a dry run of the SAME parameters; the confirm states the spend, the per-request cap and the nightly
// drain's budget; the result is coverage before and after, never a call count.

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

test("the run's dry plan carries what the confirm must state: cost ceiling, per-request cap, nightly budget, coverage", async () => {
  const { base, stop } = mount();
  try {
    const r = await fetch(`${base}/api/admin/enrichment/run`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 10 }) });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.dryRun, true, "dry by default — no apply:true, nothing sent");
    assert.equal(b.plan.manualCap, 100);
    assert.ok(b.plan.nightlyBudget.maxRows > 0 && b.plan.nightlyBudget.maxUsd > 0);
    assert.ok(b.plan.coverageNow && typeof b.plan.coverageNow.total === "number");
    assert.ok("usd" in b.plan.estimate);
  } finally { stop(); }
});

test("the Operations tab mounts the section; Enrich is gated on a same-parameter dry run and confirms the spend", () => {
  const src = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(src, /<EnrichmentSection theme=\{theme\}\/>/, "mounted in OpsTab");
  const sec = src.slice(at(src, "export function EnrichmentSection"), at(src, "export function JobDataSection"));
  assert.ok(sec.length > 100, "the section exists");
  // The dry run posts WITHOUT apply; the real run is the only call with apply: true.
  assert.match(sec, /api\("\/api\/admin\/enrichment\/run", \{ method: "POST", body: JSON\.stringify\(params\(\)\) \}\)/);
  assert.equal((sec.match(/apply: true/g) || []).length, 1);
  // Unlocks only for exactly the planned parameters.
  assert.match(sec, /const plan = dry && dry\.key === key \? dry\.body\.plan : null;/);
  assert.match(sec, /disabled=\{!plan \|\| n === 0 \|\| !!busy\}/);
  // The confirm states the spend, the cap and the nightly budget, and that this run is outside it.
  assert.match(sec, /if \(!confirm\(/);
  for (const s of ["usd(plan.estimate?.usd)", "plan.manualCap", "b.maxRows", "b.maxUsd", "NOT counted"]) {
    assert.ok(sec.includes(s), `the confirm states ${s}`);
  }
  // Coverage, before and after — from /coverage once the run lands.
  assert.match(sec, /api\("\/api\/admin\/enrichment\/coverage"\)/);
  assert.match(sec, /label: "before"/);
  assert.match(sec, /label: "after"/);
  // The columns it reads are real enrichment columns.
  const sel = fs.readFileSync("services/jobs/enrichmentSelection.js", "utf8");
  const cols = JSON.parse(src.match(/const enrichCols = (\[[^\]]+\]);/)[1]);
  for (const c of cols.filter(c => c !== "enriched_at")) assert.ok(sel.includes(`'${c}'`), `${c} is an ENRICHMENT_COLUMN`);
});
