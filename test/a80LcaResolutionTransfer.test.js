// A80 V11 — LCA company resolutions by export → owner → import (D17). The model pass in
// scripts/al4LcaResolution.mjs is gone; services/kb/lcaResolutionTransfer.js holds the guards.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { buildLcaExport, planLcaImport, applyLcaImport, LCA_RESOLUTION_KIND } from "../services/kb/lcaResolutionTransfer.js";
import { parseJsonl } from "../services/kb/synonymTransfer.js";
import { confirmResolution, loadConfirmedResolutions } from "../services/kb/lcaResolution.js";

function board() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec("DELETE FROM lca_company_resolutions");
  return db;
}
const RAMP = [{ name: "Ramp Business Corporation", certified: 87, periods: 17 }, { name: "Ramp Systems, Inc.", certified: 5, periods: 3 }];
const LINEAR = [{ name: "Linear Labs LLC", certified: 17, periods: 8 }];
const ASKABLE = [{ company: "Ramp", candidates: RAMP }, { company: "Linear", candidates: LINEAR }];
const nowLookup = (over = {}) => (c) => (c in over ? over[c] : (ASKABLE.find(a => a.company === c)?.candidates || null));
const file = (answers = {}, mutate = (l) => l) => {
  const lines = buildLcaExport(ASKABLE, "rules", { exportedAt: "t" });
  for (const l of lines) if (answers[l.company]) l.answer = answers[l.company];
  return parseJsonl(mutate(lines).map(l => JSON.stringify(l)).join("\n"));
};
const rows = (db) => db.prepare("SELECT company, status, resolved_employer_name, model_reason FROM lca_company_resolutions ORDER BY company").all().map(r => ({ ...r }));
const RAMP_ANSWER = { employer_name: "Ramp Business Corporation", confidence: 0.8, reason: "Ramp's own filings name this entity." };
const LINEAR_NONE = { employer_name: null, confidence: 0.9, reason: "Linear Labs makes electric motors." };

test("the export is one line per ambiguous company, with its candidates and an empty answer", () => {
  const lines = buildLcaExport(ASKABLE, "rules", { exportedAt: "t" });
  assert.equal(lines[0].kind, "al4_lca_instructions");
  assert.deepEqual(lines.slice(1).map(l => [l.kind, l.company, l.answer.employer_name]),
    [[LCA_RESOLUTION_KIND, "Ramp", null], [LCA_RESOLUTION_KIND, "Linear", null]]);
});

test("dry run, then 'proposed' with the grader on record — never confirmed — and re-import changes nothing", () => {
  const db = board();
  const parsed = file({ Ramp: RAMP_ANSWER, Linear: LINEAR_NONE });
  const plan = planLcaImport(db, parsed, nowLookup(), { grader: "owner" });
  assert.equal(plan.ok, true);
  assert.equal(plan.proposals.length, 2);
  assert.deepEqual(rows(db), [], "a plan writes nothing");

  assert.equal(applyLcaImport(db, parsed, nowLookup(), { grader: "owner" }).written, 2);
  const after = rows(db);
  assert.deepEqual(after.map(r => [r.company, r.status, r.resolved_employer_name]),
    [["Linear", "proposed", null], ["Ramp", "proposed", "Ramp Business Corporation"]]);
  assert.match(after[1].model_reason, /^\[owner\] /, "the grader is the provenance of the answer");
  assert.equal(loadConfirmedResolutions(db).size, 0, "an import never reaches the matcher");

  const again = applyLcaImport(db, parsed, nowLookup(), { grader: "owner" });
  assert.equal(again.unchanged, 2);
  assert.equal(again.written, 0);
  assert.deepEqual(rows(db), after);
});

test("an unanswered line is skipped; a person's decision is left alone", () => {
  const db = board();
  applyLcaImport(db, file({ Ramp: RAMP_ANSWER }), nowLookup(), { grader: "owner" });
  assert.ok(confirmResolution(db, "Ramp"));
  const res = applyLcaImport(db, file({ Ramp: { ...RAMP_ANSWER, employer_name: null } }), nowLookup(), { grader: "owner" });
  assert.equal(res.alreadyReviewed, 1);
  assert.equal(res.unanswered, 1, "Linear's empty answer is 'not yet', not 'none'");
  assert.equal(rows(db).find(r => r.company === "Ramp").resolved_employer_name, "Ramp Business Corporation");
});

test("every guard refuses the WHOLE file and writes nothing", () => {
  const cases = {
    invented_employer: [file({ Ramp: { ...RAMP_ANSWER, employer_name: "Ramp Fintech Inc." }, Linear: LINEAR_NONE }), nowLookup(), "owner"],
    unknown_company: [file({ Ramp: RAMP_ANSWER }, (l) => [...l, { ...l[1], company: "Epia Neuro" }]), nowLookup(), "owner"],
    tampered: [file({ Ramp: RAMP_ANSWER }, (l) => { l[1].candidates = l[1].candidates.slice(1); return l; }), nowLookup(), "owner"],
    stale: [file({ Ramp: RAMP_ANSWER }), nowLookup({ Ramp: [...RAMP, { name: "Ramp Holdings LLC" }] }), "owner"],
    duplicate_company: [file({ Ramp: RAMP_ANSWER }, (l) => [...l, { ...l[1] }]), nowLookup(), "owner"],
    invalid_value: [file({ Ramp: { ...RAMP_ANSWER, confidence: 7 } }), nowLookup(), "owner"],
    no_reason: [file({ Ramp: { ...RAMP_ANSWER, reason: "" } }), nowLookup(), "owner"],
    no_grader: [file({ Ramp: RAMP_ANSWER }), nowLookup(), ""],
  };
  for (const [name, [parsed, lookup, grader]] of Object.entries(cases)) {
    const db = board();
    const res = applyLcaImport(db, parsed, lookup, { grader });
    assert.equal(res.ok, false, `${name} was accepted`);
    assert.equal(res.written, 0, `${name} wrote something`);
    assert.deepEqual(rows(db), [], `${name} left rows behind`);
    const code = ["no_reason", "no_grader"].includes(name) ? "invalid_value" : name;
    assert.ok(res.problems.some(p => p.code === code), `${name}: ${JSON.stringify(res.problems)}`);
  }
});

test("the script exports and imports, still asks only about AMBIGUOUS companies, and its model pass is retired", () => {
  const src = fs.readFileSync("scripts/al4LcaResolution.mjs", "utf8");
  assert.match(src, /has\("--export"\)/);
  assert.match(src, /has\("--import"\)/);
  assert.match(src, /--propose is retired \(D17, A80 V11\)/);
  assert.match(src, /const DB_PATH = val\("--db"\)/);
  assert.doesNotMatch(src, /callModel|@anthropic-ai\/sdk|modelCall\.js|modelProviders\.js/);
});
