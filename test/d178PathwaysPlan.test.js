// ⭐ D155 Part C · d155PathwaysPlanShown — the whole approved plan (every pathway, stage and topic) is in the Library;
// the plan file is PLAYBOOK.md Part C exactly (generated, never hand-copied); a topic links to a deck only when that deck
// is approved; everything else reads "planned".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathwaysFrom, withDecks, buildPlan } from "../scripts/pathwaysFromPlaybook.mjs";
import { pathwaysPlan } from "../services/learn/learnDecks.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d155PathwaysPlanShown: the plan file is Part C, current (scripts/pathwaysFromPlaybook.mjs --check)", () => {
  const r = spawnSync(process.execPath, ["scripts/pathwaysFromPlaybook.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const md = read("docs/research/PLAYBOOK.md");
  const p = pathwaysFrom(md);
  assert.deepEqual(p.map(x => x.id), ["software", "data", "ml-ai", "cloud", "security", "embedded", "qa", "management", "beyond"]);
  assert.equal(p.at(-1).later, true, "the fields beyond computing wait for the board");
  // Every "- **Stage:** a · b" line of Part C is a stage, and every topic is kept in order.
  const partC = md.slice(md.indexOf("## Part C"), md.indexOf("\n## Part", md.indexOf("## Part C") + 5));
  const lines = partC.split("\n").filter(l => /^- \*\*.+?:\*\* /.test(l));
  assert.equal(p.reduce((a, x) => a + x.stages.length, 0), lines.length);
  assert.deepEqual(p.flatMap(x => x.stages.flatMap(s => s.topics)), lines.flatMap(l => l.replace(/^- \*\*.+?:\*\* /, "").split(" · ").map(t => t.trim())));
  assert.deepEqual(p[0].stages[0].topics.slice(0, 2), ["how a program runs (memory, processes, threads)", "data structures"]);
});

test("d155PathwaysPlanShown: a topic links to a deck only by pathway + stage + position, and only when approved", () => {
  const plan = [{ id: "software", title: "S", stages: [{ id: "foundations", title: "F", topics: ["a", "b", "c"] }] }];
  const marked = withDecks(plan, [{ id: "sw-f-01", pathway: "software", stage: "foundations", status: "approved" }, { id: "sw-f-03", pathway: "software", stage: "foundations", status: "draft" }]);
  assert.deepEqual(marked[0].stages[0].topics, [{ title: "a", deck: "sw-f-01", status: "approved" }, { title: "b", deck: null, status: "planned" }, { title: "c", deck: "sw-f-03", status: "draft" }]);
  // the served plan: a draft deck is NOT linked
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d155-"));
  try {
    fs.writeFileSync(path.join(dir, "pathways-v1.json"), JSON.stringify({ pathways: marked }));
    fs.writeFileSync(path.join(dir, "decks-v1.json"), JSON.stringify({ decks: [{ id: "sw-f-01", pathway: "software", stage: "foundations", title: "A", status: "approved", slides: [], questions: [] },
      { id: "sw-f-03", pathway: "software", stage: "foundations", title: "C", status: "draft", slides: [], questions: [] }] }));
    const r = pathwaysPlan({ dir });
    assert.deepEqual(r.pathways[0].stages[0].topics.map(t => t.deck), ["sw-f-01", null, null]);
    assert.deepEqual([r.written, r.planned], [1, 2]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const live = pathwaysPlan();
  assert.ok(live.written >= 8 && live.written + live.planned === buildPlan().pathways.flatMap(p => p.stages.flatMap(s => s.topics)).length);
});

test("d155PathwaysPlanShown: served at GET /api/learn/pathways and drawn on the Library page", () => {
  assert.match(read("routes/learn.js"), /router\.get\("\/pathways", \(_req, res\) => \{ res\.set\("Cache-Control", LEARN_CACHE\); res\.json\(pathwaysPlan\(\)\); \}\);/);
  const ui = read("client/src/pages/atlas/LibraryGuides.jsx");
  assert.match(ui, /\{t\.deck \? <Link className="atl__link" to=\{`\$\{base\}\/library\/\$\{t\.deck\}`\}>\{t\.title\}<\/Link> : <span>\{t\.title\}<\/span>\}/);
  assert.match(ui, /\{!t\.deck && <span className="atl__quiet"> · planned<\/span>\}/);
  assert.match(read("client/src/pages/atlas/LibraryPanel.jsx"), /<PathwaysPlan base=\{base\} \/>/);
});
