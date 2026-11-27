// ⭐ D178-3 (owner's pick 11-07: Course A + C) · d178OneCourseOneRecord — the half ring, the lesson deck and the modules list
// are one course and one progress (the one earned rule); the deck turns with the jobs page's gesture (lib/deckWheel.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { courseOf } from "../services/learn/learnCourse.js";
import { halfRingLayout, HALF, lessonState, lessonStateLine, courseProgress } from "../client/src/pages/atlas/libraryModel.js";
import { deckWheelHandler, WHEEL_STEP } from "../client/src/lib/deckWheel.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const course = courseOf(JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8")), { sources: [] });

test("d178OneCourseOneRecord: one tick per lesson, in module order, inside the drawing; lit = the one earned rule", () => {
  const t = halfRingLayout(course);
  assert.equal(t.length, course.counts.lessons);
  assert.deepEqual(t.map(x => x.id), course.modules.flatMap(m => m.lessons.map(l => l.id)));
  for (const x of t) for (const [px, py] of [[x.x1, x.y1], [x.x2, x.y2]]) assert.ok(px >= 0 && px <= HALF.w && py >= 0 && py <= HALF.h, `${x.id} inside`);
  const l = course.modules[0].lessons[0];
  const all = Object.fromEntries([...l.links.filter(x => !x.optional && x.url).map(x => x.id), ...l.checks, ...(l.build ? [l.build] : [])].map(id => [id, 1]));
  assert.deepEqual(lessonStateLine(lessonState(l, all)), { state: "checked", text: "✓ Checked" });
  assert.equal(lessonStateLine(lessonState(l, {})).text, "Not started");
  assert.equal(courseProgress(course, all).done, 1, "the ring's lit count and the list's count are the same number");
  const deck = "" /* 47m: LessonDeck.jsx deleted */;
  assert.match(deck, /const lit = new Set\(course\.modules\.flatMap\(m => m\.lessons\.filter\(l => lessonState\(l, marks\)\.complete\)/, "the ring lights by the one rule");
});

test("d178OneCourseOneRecord: the deck gesture — one flick turns one card, ends release the page; the course page wires ring + deck + list", () => {
  let steps = 0, prevented = 0, t = 0;
  const h = deckWheelHandler({ canStep: (d) => d > 0, step: () => steps++, now: () => t });
  const ev = (deltaY) => ({ deltaY, deltaX: 0, deltaMode: 0, ctrlKey: false, preventDefault: () => prevented++ });
  h(ev(WHEEL_STEP)); assert.equal(steps, 1);
  h(ev(WHEEL_STEP)); assert.equal(steps, 1, "inside the settle window: one flick, one card");
  t = 1000; h(ev(-WHEEL_STEP)); assert.equal(steps, 1, "at an end the page scrolls (not prevented)");
  const page = "" /* 47m: LibraryPanel.jsx deleted */;
  assert.match(page, /<HalfRing course=\{course\} marks=\{marks\} progress=\{progress\} module=\{sel\} onModule=\{setSel\} \/>/);
  assert.match(page, /<LessonDeck base=\{base\} lessons=/);
  // ⭐ A155 (45o, on purpose): the heading names a chosen guided route; with none it is still "All modules".
  assert.match(page, /<h2 className="atl__h2">\{route \? `\$\{route\.name\} — \$\{route\.list\.length\} lessons` : "All modules"\}<\/h2>/, "the modules list is kept below");
  assert.match("" /* 47m: LessonDeck.jsx deleted */, /deckWheelHandler\(/);
  assert.match(read("client/src/panels/DeckView.jsx"), /deckWheelHandler\(/, "the same gesture as the jobs page's deck");
});
