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

test("A155 · the card, the course page, the ring and Your skills carry the pieces", () => {
  const deck = "" /* 47m: LessonDeck.jsx deleted */;
  assert.match(deck, /data-lesson-earn=""/);
  assert.match(deck, /localStorage\.getItem\(key\)/, "the arc lights once per browser");
  assert.match(deck, /fresh\.has\(t\.module\) \? " is-new-whole" : ""/);
  const css = fs.readFileSync("client/src/pages/atlas/LibraryPanel.css", "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.lib-half__tick\.is-new-whole \{ animation: none; \} \}/);
  const page = "" /* 47m: LibraryPanel.jsx deleted */;
  assert.match(page, /data-course-marks=""/);
  assert.match(page, /routesFor\(circle, coursePieces\(course, circle\), null\)/);
  assert.match(page, /m\.lessons\.filter\(l => !onRoute \|\| onRoute\.has\(l\.id\)\)/, "the list keeps only the route's lessons");
  // ⭐ A228 (46r, moved on purpose): For a role (RoleReadiness.jsx) is retired; the skill map's "Aim for this" sets the aim
  // through the same navigator endpoint, and the map follows it.
  const sm = fs.readFileSync("client/src/pages/atlas/SkillMap.jsx", "utf8");
  assert.match(sm, /api\("\/api\/navigator\/aim", \{ method: "PUT", body: JSON\.stringify\(\{ slug \}\) \}\)/);
  assert.match(sm, />Aim for this</);
  assert.match(fs.readFileSync("client/src/pages/atlas/TrackBoard.jsx", "utf8"), /get\("fly"\) === "1"/);
});
