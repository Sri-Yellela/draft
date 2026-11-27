// ⭐ D178 · d178ConceptIndexInGlossary — the concept index tab merges into Explore → Glossary: each concept keeps its
// link to the lesson that teaches it; a concept named like an Atlas term gives that term its lesson; nothing dropped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { glossaryConcepts } from "../services/learn/learnLinks.js";
import { learnContent, LEARN_FILE } from "../services/learn/learnContent.js";
import { learnStepHref } from "../client/src/pages/atlas/atlasPanels.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const learn = learnContent(LEARN_FILE);
const steps = new Set(learn.PARTS.flatMap(p => p.phases.flatMap(ph => ph.steps.map(s => s.id))));

test("d178ConceptIndexInGlossary: every concept is either a term's lesson or a row of its own — never both, never lost", () => {
  const dns = learn.INDEX.find(c => c.term === "DNS");
  assert.ok(dns, "the fixture's concept exists");
  const terms = [{ slug: "dns", name: "DNS", meaning: "Atlas's own words" }, { slug: "kafka", name: "Kafka", meaning: "A log." }];
  const g = glossaryConcepts(terms, learn);
  assert.deepEqual(g.terms[0].learn, { stepId: dns.st, label: g.terms[0].learn.label });
  assert.equal(g.terms[0].meaning, "Atlas's own words", "the Atlas term keeps its own words (the popup's)");
  assert.equal(g.terms[1].learn, undefined, "a term the path does not teach gets no lesson");
  assert.equal(g.concepts.length + 1, learn.INDEX.length, "DNS went to the term; every other concept is a row");
  assert.ok(!g.concepts.some(c => c.name === "DNS"));
  for (const c of g.concepts) {
    const src = learn.INDEX.find(x => x.term === c.name);
    assert.equal(c.meaning, src.def || "");
    if (steps.has(src.st)) assert.equal(c.learn.stepId, src.st); else assert.equal(c.learn, null);
  }
  assert.equal(glossaryConcepts([], learn).concepts.length, learn.INDEX.length);
  const lost = glossaryConcepts([], { ...learn, INDEX: [{ term: "Orphan", def: "x", st: "no-such-step" }] });
  assert.deepEqual(lost.concepts, [{ name: "Orphan", meaning: "x", learn: null }], "a concept whose step is gone keeps its words");
});

// ⛔ 47m (changed on purpose): "d178ConceptIndexInGlossary: the route serves terms + concepts; the panel lists t" retired — the surface it pinned was rebuilt in the plate system (47m M5).
