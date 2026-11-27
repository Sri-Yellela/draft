// ⭐ A155 (45o) part 2 · the rest of Atlas's dropped D178 pieces: the lesson card's "how you earn ✓" (the ONE rule's own
// counts), marks on the course page (whole modules), a whole module's arc lighting once, guided routes in the Modules view,
// and "Fly my route to this role" from Your skills. Synthetic lessons only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { earnChecklist, wholeModules, coursePieces, lessonState } from "../client/src/pages/atlas/libraryModel.js";
import { checkpointId } from "../shared/learnStepState.js";

const lesson = (id, links = 1, checks = 1) => ({ id, links: Array.from({ length: links }, (_, i) => ({ id: `${id}-l${i}`, url: "https://x.example" })),
  checks: Array.from({ length: checks }, (_, i) => `idea ${i}`) });

test("A155 · how you earn ✓ reads the one rule — the list and the check can never disagree", () => {
  const l = lesson("s1", 2, 2);
  const none = earnChecklist(lessonState(l, {}));
  assert.deepEqual(none.map((r) => [r.key, r.done]), [["opened", false], ["explained", false]]);
  assert.match(none[0].text, /0 of 2/);
  const marks = { "s1-l0": 1, "s1-l1": 1, [checkpointId("s1", 0)]: 1, [checkpointId("s1", 1)]: 1 };
  const all = earnChecklist(lessonState(l, marks));
  assert.ok(all.every((r) => r.done));
  assert.equal(lessonState(l, marks).complete, true, "every row done ⇔ ✓");
});

test("A155 · a mark per WHOLE module; the course's lessons as route pieces with the circle's own needs", () => {
  const course = { id: "c", modules: [{ n: 1, title: "Bits", lessons: [lesson("a")] }, { n: 2, title: "Gates", lessons: [lesson("b"), lesson("c")] }] };
  const marks = { "a-l0": 1, [checkpointId("a", 0)]: 1, "b-l0": 1, [checkpointId("b", 0)]: 1 };
  assert.deepEqual(wholeModules(course, marks), [{ n: 1, title: "Bits" }], "module 2 has an unfinished lesson");
  const circle = { pieces: { b: { needs: [{ id: "a" }] } } };
  assert.deepEqual(coursePieces(course, circle), [{ id: "a", needs: [] }, { id: "b", needs: [{ id: "a" }] }, { id: "c", needs: [] }]);
});

// ⛔ 47m (changed on purpose): "A155 · the card, the course page, the ring and Your skills carry the pieces" retired — the classic Library / course pages are deleted (D201): courses are Gazetteer routes (pages/atlas/AtlasGazetteer.jsx).
