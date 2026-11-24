// ⭐ D155 Part C · d155PathwaysPlanShown — the whole approved plan (every pathway, stage and topic) is in the Library;
// the plan file is PLAYBOOK.md Part C exactly (generated, never hand-copied); a topic links to a deck only when that deck
// is approved; everything else reads "planned".
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { at } from "../test-support/sourceAnchors.js";
import { pathwaysFrom, withDecks, buildPlan } from "../scripts/pathwaysFromPlaybook.mjs";
import { pathwaysPlan } from "../services/learn/learnDecks.js";
import { underRule, threeLayerProblems } from "../services/learn/deckLayers.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d155PathwaysPlanShown: the plan file is Part C, current (scripts/pathwaysFromPlaybook.mjs --check)", () => {
  const r = spawnSync(process.execPath, ["scripts/pathwaysFromPlaybook.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const md = read("docs/research/PLAYBOOK.md");
  const p = pathwaysFrom(md);
  assert.deepEqual(p.map(x => x.id), ["software", "data", "ml-ai", "cloud", "security", "embedded", "qa", "management", "beyond"]);
  assert.equal(p.at(-1).later, true, "the fields beyond computing wait for the board");
  // Every "- **Stage:** a · b" line of Part C is a stage, and every topic is kept in order.
  const partC = md.slice(at(md, "## Part C"), at(md, "\n## Part", at(md, "## Part C") + 5));
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
    assert.equal(r.pathways[0].stages[0].topics[2].drafted, true, "a drafted deck says so, unlinked");
    assert.deepEqual([r.written, r.drafted, r.planned], [1, 1, 1]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  const live = pathwaysPlan();
  assert.ok(live.written >= 8 && live.written + live.drafted + live.planned === buildPlan().pathways.flatMap(p => p.stages.flatMap(s => s.topics)).length);
});

test("d155PathwaysPlanShown: served at GET /api/learn/pathways and drawn on the Library page", () => {
  assert.match(read("routes/learn.js"), /router\.get\("\/pathways", \(_req, res\) => \{ res\.set\("Cache-Control", LEARN_CACHE\); res\.json\(pathwaysPlan\(\)\); \}\);/);
  const ui = read("client/src/pages/atlas/LibraryGuides.jsx");
  assert.match(ui, /\{t\.deck \? <Link className="atl__link" to=\{`\$\{base\}\/library\/\$\{t\.deck\}`\}>\{t\.title\}<\/Link> : <span>\{t\.title\}<\/span>\}/);
  assert.match(ui, /\{!t\.deck && <span className="atl__quiet"> · \{t\.drafted \? "being written" : "planned"\}<\/span>\}/);
  // ⭐ A154 (45o, on purpose): the pathways' covers above it ask the plan to open one.
  assert.match(read("client/src/pages/atlas/LibraryPanel.jsx"), /<PathwaysPlan base=\{base\} want=\{wantPathway\} \/>/);
});

test("d155PathwaysPlanShown: decks-v2 … v24 APPROVED by the owner 11-08 (changed on purpose) — served, linked, the ladder software's", () => {
  const ap = JSON.parse(read("content/decks/approvals.json")).approved;
  for (let v = 1; v <= 24; v++) assert.ok(ap[String(v)], `decks-v${v} approved`);
  const v2 = JSON.parse(read("content/decks/decks-v2.json"));
  assert.deepEqual(v2.decks.map(d => d.id), ["sw-b-01", "sw-b-02", "sw-b-03", "sw-b-04", "sw-b-05", "sw-b-06", "sw-b-07", "sw-b-08"]);
  assert.ok(v2.decks.every(d => d.status === "approved" && d.pathway === "software" && d.stage === "building-blocks" && d.slides.length === 5));
  assert.ok(v2.newQuestions.every(q => q.status === "live" && q.choices[q.correct] && q.why.length === q.choices.length));
  const plan = pathwaysPlan();
  assert.deepEqual([plan.written, plan.drafted, plan.planned], [224, 0, 0]);   // 47c: + decks-v25's ml-f-05 and cl-b-06 (approved 11-23) + decks-v26's 14 + decks-v27's da-b-07 (approved 11-24)
  const bb = plan.pathways[0].stages.find(s => s.id === "building-blocks");
  assert.ok(bb.topics.every(t => typeof t.deck === "string"), "linked once approved");
  // the review copy says it is approved
  assert.match(read("content/decks/decks-v2.md"), /\*\*APPROVED by the owner 2026-11-08\*\*/);
});

test("d155PathwaysPlanShown: every deck batch holds the format — five slides, an answerable question, a place in the plan", () => {
  const files = fs.readdirSync("content/decks").filter(f => /^decks-v\d+\.json$/.test(f));
  const plan = buildPlan().pathways;
  const ids = new Set();
  for (const f of files) {
    const b = JSON.parse(read(`content/decks/${f}`));
    const qs = new Map((b.newQuestions || []).map(q => [q.id, q]));
    for (const d of b.decks) {
      assert.ok(!ids.has(d.id), `${d.id} once`); ids.add(d.id);
      assert.ok(["draft", "approved"].includes(d.status), `${f} ${d.id} status`);
      // 47c: a batch under D195 (decks-v25 on) is written in the three layers — D195's own lint is its shape;
      // the older batches keep the five-slide tags.
      if (underRule(b.version)) {
        assert.deepEqual(threeLayerProblems(d), [], `${d.id} three layers`);
        assert.equal(d.slides.at(-1).tag, "Check yourself", `${d.id} ends in its check`);
      } else assert.equal(d.slides.map(s => s.tag).join("|"), "What it is|Core ideas|The trade-offs|In practice|Check yourself", `${d.id} slides`);
      const stage = plan.find(p => p.id === d.pathway)?.stages.find(s => s.id === d.stage);
      assert.ok(stage, `${d.id}: ${d.pathway} / ${d.stage} is in Part C`);
      const pos = Number(d.id.match(/-(\d+)$/)[1]);
      assert.equal(stage.topics[pos - 1]?.deck, d.id, `${d.id} covers topic ${pos} of ${d.stage}`);
      for (const qid of d.questions || []) { const q = qs.get(qid); if (q) assert.ok(q.choices[q.correct] && q.why.length === q.choices.length, qid); }
    }
  }
});

test("d155PathwaysPlanShown: a shared topic is written once and reused (Part C), except a title meaning different things", () => {
  const plan = [
    { id: "software", title: "S", stages: [{ id: "foundations", title: "F", topics: ["Git", "metrics"] }] },
    { id: "cloud", title: "C", stages: [{ id: "foundations", title: "F", topics: ["Linux", "git", "metrics"] }] },
  ];
  const m = withDecks(plan, [{ id: "sw-f-01", pathway: "software", stage: "foundations", status: "draft" }, { id: "sw-f-02", pathway: "software", stage: "foundations", status: "draft" }]);
  assert.deepEqual(m[1].stages[0].topics, [{ title: "Linux", deck: null, status: "planned" }, { title: "git", deck: "sw-f-01", status: "draft", reused: true },
    { title: "metrics", deck: null, status: "planned" }]);
  const live = JSON.parse(read("content/decks/pathways-v1.json")).pathways;
  const ml = live.find(p => p.id === "ml-ai").stages.find(s => s.id === "interview").topics;
  assert.deepEqual(ml.at(-1), { title: "AI-enabled coding", deck: "sw-iv-04", status: "approved", reused: true });   // ⭐ approved 11-08
});
