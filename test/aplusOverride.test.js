// ⛔ Owner 11-07: "keep the A+ we are not dropping the route entirely, just dropping it from the default path, make it one
// of the offered options … A+ sonnet would be an override option i can use for testing and this override would be from
// the admin panel by me" · "lean, payload would be strategies paired with model choice which could be haiku or something
// else". An A+ request is served as a Generate with the admin's strategy × model; the full A+ route runs only while the
// owner's override is on (Admin → Ops → Tailoring, audited).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { setSetting, clearSetting } from "../services/appSettings.js";
import { aPlusOverride, servedPromptMode, APLUS_OVERRIDE_KEY, tailoringFor, tailoringState, modelFor, MODEL_DEFAULT_KEY } from "../services/leanTailoring.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function db0() { const db = new Database(":memory:"); for (const m of MIGRATIONS) db.exec(m.sql); return db; }

test("aPlusOffTheDefaultPath: an A+ request is served as a Generate unless the owner's override is on", () => {
  const db = db0();
  assert.equal(aPlusOverride(db), false, "off when nothing is set");
  assert.equal(servedPromptMode(db, "a_plus_resume"), "GENERATE");
  assert.equal(servedPromptMode(db, "generate"), "GENERATE");
  setSetting(db, APLUS_OVERRIDE_KEY, "on");
  assert.equal(servedPromptMode(db, "a_plus_resume"), "A_PLUS", "the override serves the full A+ route");
  assert.equal(servedPromptMode(db, "generate"), "GENERATE", "a Generate is never turned into A+");
  assert.equal(tailoringState(db, {}).aPlusOverride, true);
  clearSetting(db, APLUS_OVERRIDE_KEY);
  assert.equal(servedPromptMode(db, "a_plus_resume"), "GENERATE");
});

test("aPlusStrategyTimesModel: a served Generate takes the admin's strategy and model (lean by default)", () => {
  const db = db0();
  assert.equal(tailoringFor({ db, env: {} }), "lean");
  setSetting(db, MODEL_DEFAULT_KEY, "open");
  assert.equal(modelFor(db, { tailoring: "lean" }), "open", "an open provider (e.g. Nemotron) is a model choice");
  assert.equal(modelFor(db, { tailoring: "payload" }), "open");
  // The generation kernel decides the served mode, and only a GENERATE gets a strategy (A+ stays the full call).
  const s = read("server.js");
  const kernel = s.slice(at(s, "async function coreGenerateResume("), at(s, "const generateBody = toolsGenerateRequest("));
  assert.match(kernel, /const promptMode   = servedPromptMode\(db, tool\);/);
  assert.match(kernel, /const eventSubtype = promptMode;/, "the ledger says what was served");
  assert.match(kernel, /const tailoring = promptMode === "GENERATE" \? tailoringFor\(/);
});

test("aPlusOverrideIsTheOwners: set from Admin → Ops → Tailoring, behind requireAdmin, with an audit row", () => {
  const s = read("server.js");
  const put = s.slice(at(s, 'app.put("/api/admin/tailoring", requireAdmin,'), at(s, 'app.delete("/api/admin/tailoring", requireAdmin,'));
  assert.match(put, /if \(aPlus !== undefined && typeof aPlus !== "boolean"\)/);
  assert.match(put, /writeAudit\(db, \{ actor: actorOf\(req\), action: "tailoring_aplus_override"/);
  const ui = read("client/src/panels/adminOps.jsx");
  assert.match(ui, /onClick=\{\(\) => send\("PUT", \{ aPlus: !s\.aPlusOverride \}\)\}/);
});
