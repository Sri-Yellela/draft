// ⭐ D111 · d111NeverReadsRejectionNote (owner 10-31, D17). "Note why" feeds D111 BY QUICK PICK ONLY: the free text
// (job_applications.rejection_note) is never read, counted, sent or passed to a model.
//   1. callbackRates.js never names the note and never selects ja.* / SELECT * from job_applications.
//   2. From the tables: a note's words appear nowhere in the reader's rows or the card's payload.
//   3. No model call site can reach it: the note is named only by the files that store / serve it (and the migration),
//      none of them reaches a model through its imports, and no callModel call's handler reads job_applications.
// Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { callbackRates, gatherCallbackApps } from "../services/callbackRates.js";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
/**
 * Source without its comment LINES (// …, and the lines of a block comment), so a comment that NAMES the rule does not
 * count as reading the note. Line-based on purpose: a regex that strips block comments mid-line is fooled by a slash-star
 * inside a string or a regex literal in server.js, and then hides real code. A trailing // comment stays — it can only
 * make the check stricter.
 */
const code = (s) => s.split("\n").filter(l => !/^\s*(\/\/|\/\*|\*)/.test(l)).join("\n");

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 31, 12) / 1000);
const SENTINEL = "ZQX-private-words-7731";

test("d111NeverReadsRejectionNote — callbackRates.js never names the note or selects a whole application row", () => {
  const src = code(read("services/callbackRates.js"));
  assert.doesNotMatch(src, /rejection_note|rejectionNote|REJECTION_NOTE/, "the note is never named in code");
  assert.doesNotMatch(src, /\bja\.\*|SELECT\s+\*\s+FROM\s+job_applications/i, "a whole row would carry the note");
  assert.match(src, /ja\.rejection_reasons/, "the picks are selected by name");
  assert.doesNotMatch(src, /callModel|modelCall|anthropic|toolsService|messages\.create|fetch\(/i, "D17: no model, nothing sent");
});

test("d111NeverReadsRejectionNote — a note's words reach neither the rows nor the payload", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x')").run();
  const ins = db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, response_outcome, rejection_note, rejection_reasons)
    VALUES (1, ?, 'Northwind', 'Backend Engineer', ?, 'rejected', ?, ?)`);
  // The note even names a pick ("level") — it must not be counted as one.
  for (let i = 0; i < 20; i++) ins.run(`r${i}`, NOW - 60 * DAY, `${SENTINEL} level location not_a_fit`, i < 2 ? '["not_a_fit"]' : null);
  const rows = gatherCallbackApps(db, 1);
  assert.equal(rows.length, 20);
  for (const r of rows) assert.ok(!Object.keys(r).some(k => /note/i.test(k)), "no note field on a row");
  assert.ok(!JSON.stringify(rows).includes(SENTINEL));
  const payload = callbackRates(rows, { now: NOW });
  assert.ok(!JSON.stringify(payload).includes(SENTINEL));
  const picks = Object.fromEntries(payload.whyNo.picks.map(p => [p.key, p.count]));
  assert.deepEqual(picks, { not_a_fit: 2, level: 0, location: 0, visa_eligibility: 0, no_reason_given: 0 }, "the free text is never counted");
});

function productionFiles() {
  const out = ["server.js"];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?js)$/.test(e.name)) out.push(p.replace(/\\/g, "/"));
    }
  };
  for (const dir of ["routes", "services", "shared"]) walk(dir);
  return out;
}

/** Every relative import reachable from a file (static and dynamic), as repo paths. */
function reachable(start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const src = code(read(f));
    for (const m of src.matchAll(/(?:from\s*|import\s*\(\s*|import\s+)["'](\.{1,2}\/[^"']+)["']/g)) {
      stack.push(path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1])));
    }
  }
  return seen;
}

test("d111NeverReadsRejectionNote — no model call site can reach the note", () => {
  // (a) Who names the note in code: only the store / serve path and the migration that added it.
  // A107 (43w): services/adminSafety.js names it to WITHHOLD it from every admin read (a redacted column) — never to read it.
  const NAMERS = new Set(["server.js", "services/pipelineWorkspace.js", "services/adminSafety.js"]);
  const namers = productionFiles().filter(f => /rejection_note/.test(code(read(f))));
  assert.deepEqual(namers.filter(f => !NAMERS.has(f)), [], "a new reader of the note — D17 and D111 say none");
  // server.js names it only inside migration 200 (the ALTER TABLE), nowhere a request is served.
  const srv = read("server.js");
  const mig = srv.slice(at(srv, "200_draft_house_leftovers"), at(srv, "ADD COLUMN rejection_reasons", at(srv, "200_draft_house_leftovers")));
  assert.equal(code(srv).split("rejection_note").length - 1, 1, "server.js names the note once");
  assert.match(code(mig), /ALTER TABLE job_applications ADD COLUMN rejection_note TEXT;/);

  // (b) The files that hold the note or the picks reach no model through anything they import.
  for (const f of ["services/pipelineWorkspace.js", "services/callbackRates.js", "routes/pipeline.js", "shared/applicationResponse.js"]) {
    const graph = reachable(f);
    assert.ok(!graph.has("services/modelCall.js"), `${f} reaches services/modelCall.js`);
    assert.ok(!graph.has("services/modelGateway.js"), `${f} reaches services/modelGateway.js (D162)`);
    for (const g of graph) assert.doesNotMatch(code(read(g)), /@anthropic-ai\/sdk|callModel\(|callTask\(|messages\.create\(/, `${f} → ${g} talks to a model`);
  }

  // (c) Every model call in production: its handler (from the enclosing top-level function / route to the call) reads
  //     no application row and no note.
  let sites = 0;
  for (const f of productionFiles()) {
    // D162: features call callTask (services/modelGateway.js → callModel); both definitions are skipped, not counted.
    if (f === "services/modelCall.js" || f === "services/modelGateway.js") continue;
    const src = read(f);
    for (const m of src.matchAll(/call(?:Model|Task)\(\{/g)) {
      sites++;
      const head = src.slice(0, m.index);
      const starts = [/\n(?:export )?(?:async )?function /g, /\napp\.(?:get|post|put|patch|delete)\(/g, /\n\s*router\.(?:get|post|put|patch|delete)\(/g]
        .map(re => [...head.matchAll(re)].map(x => x.index).pop() ?? -1);
      const from = Math.max(...starts);
      assert.ok(from >= 0, `${f}: no enclosing handler found for a model call`);
      const handler = src.slice(from, m.index + 1500);
      assert.doesNotMatch(handler, /job_applications|rejection_note|rejectionNote|\.rejection\b|callback-rates|callbackRates/,
        `${f}: a model call's handler reads an application row`);
    }
  }
  assert.ok(sites >= 3, `only ${sites} model call sites found — the scan has stopped looking`);
});
