// ⭐ D195 (owner 11-14) · HOW ATLAS TEACHES — the content design rule (concept → the math → the real world) as checks on the
// deck JSON (services/learn/deckLayers.js) and the source register's teachingUse (services/atlas/sourceRegistry.js).
// Decks written before the rule (batches before decks-v25) predate it and are not linted; every batch from v25 is — the
// served content/decks/ AND the review folder docs/review/ (a draft is checked BEFORE the owner reviews it).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { threeLayerProblems, pacing, pacingProblems, tryProblems, toyProblems, underRule, PACING_S, D195_FROM_VERSION }
  from "../services/learn/deckLayers.js";
import { loadRegistry, validateRegistry, teachingUseOf, TEACHING_USES } from "../services/atlas/sourceRegistry.js";

const reg = loadRegistry();
const batches = ["content/decks", "docs/review"].flatMap(dir => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter(f => /^decks-v\d+\.json$/.test(f)).map(f => ({ file: path.join(dir, f), version: Number(f.match(/\d+/)[0]) }))
  : []);
const ruleDecks = batches.filter(b => underRule(b.version))
  .flatMap(b => JSON.parse(fs.readFileSync(b.file, "utf8")).decks.map(d => ({ ...d, _file: b.file })));

// A deck that keeps the rule, and one way to break each check.
const good = {
  id: "t-01", rule: "D195",
  slides: [
    { layer: "concept", title: "The idea", points: ["One idea, said plainly."] },
    { layer: "proof", title: "Why", points: ["10 ms against 100 ms: round robin sends half the load to the slow server."] },
    { layer: "realWorld", title: "Where it runs", points: ["Kubernetes rolls a deployment out pod by pod."] },
    { title: "One question", points: ["Answer it."] },
  ],
  realWorld: { name: "Kubernetes deployments", url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/" },
  try: { source: "kubernetes-docs", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/" },
};
const clone = () => JSON.parse(JSON.stringify(good));

test("d195EveryDeckHasThreeLayers: concept, proof and realWorld, in order, the proof with its numbers — and every batch from v25 keeps it", () => {
  assert.deepEqual(threeLayerProblems(good), []);
  const noProof = clone(); noProof.slides.splice(1, 1);
  assert.ok(threeLayerProblems(noProof).includes("no proof slide"));
  const swapped = clone(); [swapped.slides[0], swapped.slides[1]] = [swapped.slides[1], swapped.slides[0]];
  assert.ok(threeLayerProblems(swapped).some(p => /out of order/.test(p)));
  const vague = clone(); vague.slides[1].points = ["It just shares the load fairly."];
  assert.ok(threeLayerProblems(vague).some(p => /no number/.test(p)), "a proof with no number, formula or worked example is sent back");
  assert.equal(D195_FROM_VERSION, 25);
  assert.ok(ruleDecks.length >= 2, "decks-v25 (docs/review) is written under the rule");
  for (const d of ruleDecks) assert.deepEqual(threeLayerProblems(d), [], `${d._file} ${d.id}`);
});

test("d195AnimatedPacingUnder90s: measured with D194's own beats and holds — concept ≤ 20 s, proof ≤ 30 s, real world ≤ 20 s, all ≤ 90 s", () => {
  assert.deepEqual(PACING_S, { concept: 20, proof: 30, realWorld: 20, total: 90 });
  const p = pacing(good);
  assert.ok(p.total > 0 && p.total === Math.round((p.concept + p.proof + p.realWorld) * 10) / 10);
  const long = clone(); long.slides[1].points = Array.from({ length: 8 }, (_, i) => `Step ${i}: ${"word ".repeat(30)}`);
  assert.ok(pacingProblems(long).some(x => /^proof runs/.test(x)), "a proof that drags is flagged");
  assert.ok(pacing(long, 1.5).proof < pacing(long, 1).proof, "the learner's speed shortens it");
  for (const d of ruleDecks) assert.deepEqual(pacingProblems(d), [], `${d.id}: ${JSON.stringify(pacing(d))}`);
});

test("d195TryLinkToOpenSource: the Try step is an open, account-free register source that teaches by doing, on its own site", () => {
  assert.deepEqual(tryProblems(good, reg), []);
  const t = (patch) => { const d = clone(); Object.assign(d.try, patch); return tryProblems(d, reg); };
  assert.ok(t({ source: "nope-not-registered" })[0].includes("not in the register"));
  assert.ok(t({ url: "https://example.org/tutorial" }).some(p => /is not on kubernetes\.io/.test(p)));
  const linkOnly = reg.sources.find(s => s.licenceClass === "link-only");
  assert.ok(t({ source: linkOnly.id, url: linkOnly.url }).some(p => /not open/.test(p)));
  const noTry = reg.sources.find(s => s.licenceClass === "open-reuse" && !s.teachingUse.includes("try") && !s.accountNeeded);
  assert.ok(t({ source: noTry.id, url: noTry.url }).some(p => /no "try" teachingUse/.test(p)));
  for (const d of ruleDecks) assert.deepEqual(tryProblems(d, reg), [], d.id);
});

test("d195NoToyExampleWhenRealExists: the real-world layer names its real case and uses no placeholder", () => {
  assert.deepEqual(toyProblems(good), []);
  const toy = clone(); toy.slides[2].points = ["Imagine a widget shop called Acme."];
  assert.deepEqual(toyProblems(toy).filter(p => /uses/.test(p)).length, 3);
  const unnamed = clone(); unnamed.realWorld.name = "Stripe's idempotency keys";
  assert.ok(toyProblems(unnamed).some(p => /never name/.test(p)), "the named case must appear on the slides");
  for (const d of ruleDecks) assert.deepEqual(toyProblems(d), [], d.id);
});

test("d195TeachingUsePerSource: every register row says which layer it serves, derived from its recorded types", () => {
  assert.deepEqual(TEACHING_USES, ["concept", "proof", "realWorld", "try"]);
  assert.deepEqual(teachingUseOf({ types: ["article"] }), ["realWorld"]);
  assert.deepEqual(teachingUseOf({ types: ["textbook"] }), ["proof"]);
  assert.deepEqual(teachingUseOf({ types: ["tutorial"] }), ["try"]);
  assert.deepEqual(teachingUseOf({ types: ["video"] }), ["concept"]);
  assert.deepEqual(teachingUseOf({}), ["realWorld"]);
  for (const s of reg.sources) assert.deepEqual(s.teachingUse, teachingUseOf(s), `${s.id}: re-run node scripts/d195TeachingUse.mjs --write`);
  const bad = { ...reg, sources: [{ ...reg.sources[0], teachingUse: ["vibes"] }] };
  assert.ok(validateRegistry(bad).problems.some(p => /teachingUse/.test(p)));
});

test("d195 the batch writer refuses a deck that breaks the rule (it is sent back, never saved)", () => {
  const src = fs.readFileSync("scripts/decks/deckKit.mjs", "utf8");
  assert.match(src, /ruleProblems\(d, reg\)/);
  assert.match(src, /throw new Error\(`D195:/);
});

test("d195 the deck API serves layer 3 — the layers, the named case, the Try step, and the skills' live board counts (no board scan)", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { deckOf, marketOf, _resetDecks } = await import("../services/learn/learnDecks.js");
  const { termOf } = await import("../services/atlas/atlasStore.js");
  const dir = fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), "d195-decks-"));
  try {
    fs.writeFileSync(path.join(dir, "decks-v25.json"), JSON.stringify({ decks: [{ ...clone(), status: "approved", title: "T", stage: "foundations",
      skills: ["kafka", "go", "not-a-node"], questions: [] }] }));
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE atlas_nodes (id INTEGER PRIMARY KEY, slug TEXT, name TEXT, term TEXT, status TEXT);
      CREATE TABLE atlas_node_stats (node_id INTEGER PRIMARY KEY, postings INTEGER NOT NULL);
      CREATE TABLE learn_questions (id TEXT PRIMARY KEY, choices_json TEXT, status TEXT)`);
    db.prepare(`INSERT INTO atlas_nodes VALUES (1, 'kafka', 'Kafka', ?, 'published'), (2, 'go', 'Go', ?, 'draft')`).run(termOf("kafka"), termOf("go"));
    db.prepare(`INSERT INTO atlas_node_stats VALUES (1, 1240), (2, 900)`).run();
    _resetDecks();
    const d = deckOf(db, "t-01", { dir });
    assert.deepEqual(d.slides.slice(0, 3).map(s => s.layer), ["concept", "proof", "realWorld"]);
    assert.equal(d.realWorld.name, "Kubernetes deployments");
    assert.equal(d.try.url, good.try.url);
    assert.deepEqual(d.market, [{ skill: "kafka", name: "Kafka", slug: "kafka", postings: 1240 }], "a draft node (go) and an unknown skill are left out");
    assert.deepEqual(marketOf(new Database(":memory:"), ["kafka"]), [], "no Atlas tables: the deck still opens");
    const ui = fs.readFileSync("client/src/pages/atlas/LibraryGuides.jsx", "utf8");
    assert.match(ui, /<DeckWorld deck=\{deck\} \/>/);
    assert.match(ui, /data-deck-market=""/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); _resetDecks(); }
});
