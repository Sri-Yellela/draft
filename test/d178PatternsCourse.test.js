// ⭐ D178 · d178PatternsOwnCourse — the LeetCode pattern atlas leaves Learn's tabs for its own course on the shelf
// (Coding interview patterns), linked from Interview → Practise → drills. Every pattern kept, nothing added; the modules
// are the path's own teaching steps; no progress is counted (a pattern has no check).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { patternCourseOf, PATTERN_COURSE_ID } from "../services/learn/learnCourse.js";
import { learnContent, LEARN_FILE } from "../services/learn/learnContent.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const doc = learnContent(LEARN_FILE);

test("d178PatternsOwnCourse: every pattern is a lesson, once, with every practice problem — nothing dropped, nothing added", () => {
  const c = patternCourseOf(doc);
  assert.equal(c.id, PATTERN_COURSE_ID);
  assert.equal(c.kind, "patterns");
  assert.equal(c.earned, false, "no progress is counted");
  const lessons = c.modules.flatMap(m => m.lessons);
  assert.deepEqual(lessons.map(l => l.id.replace(/^pattern-/, "")).sort(), doc.ATLAS.map(p => p.id).sort());
  assert.equal(c.counts.lessons, doc.ATLAS.length);
  assert.equal(c.counts.links, doc.ATLAS.reduce((a, p) => a + (p.pr || []).length, 0));
  for (const p of doc.ATLAS) {
    const l = lessons.find(x => x.id === `pattern-${p.id}`);
    assert.equal(l.title, p.n);
    assert.equal(l.idea, p.idea || "");
    assert.deepEqual(l.links.map(x => x.url), (p.pr || []).map(([, slug]) => `https://leetcode.com/problems/${slug}/`));
    assert.ok(l.links.every(x => x.type === "Try" && x.by === "LeetCode"));
    assert.deepEqual(l.checks, [], "no invented check");
  }
  assert.equal(c.intro, doc.copy.intros.patterns);
});

test("d178PatternsOwnCourse: the modules are the path's teaching steps, in the path's order; a lost step goes to More patterns", () => {
  const c = patternCourseOf(doc);
  const order = [];
  doc.PARTS.forEach(p => p.phases.forEach(ph => ph.steps.forEach(st => order.push(st.id))));
  const idx = c.modules.map(m => order.indexOf(m.taughtIn.stepId));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b), "in the path's order");
  for (const m of c.modules) {
    const st = doc.PARTS.flatMap(p => p.phases.flatMap(ph => ph.steps)).find(s => s.id === m.taughtIn.stepId);
    assert.equal(m.title, st.t);
    assert.equal(m.taughtIn.n, order.indexOf(st.id) + 1);
    for (const l of m.lessons) assert.equal(doc.ATLAS.find(p => `pattern-${p.id}` === l.id).st, st.id);
  }
  const lost = patternCourseOf({ ...doc, ATLAS: [...doc.ATLAS, { id: "zz", n: "A stray pattern", st: "no-such-step", pr: [] }] });
  assert.equal(lost.modules.at(-1).title, "More patterns");
  assert.equal(lost.modules.at(-1).taughtIn, null);
});

test("d178PatternsOwnCourse: GET /api/learn/course/coding-interview-patterns serves it, public; an unknown id is still a 404", async () => {
  const { createLearnRouter } = await import("../routes/learn.js");
  const db = new Database(":memory:");
  const app = express();
  app.use(express.json());
  app.use("/api/learn", createLearnRouter(db, { requireAuth: (req, res) => res.status(401).end() }));
  const srv = app.listen(0);
  try {
    const port = srv.address().port;
    const ok = await fetch(`http://127.0.0.1:${port}/api/learn/course/${PATTERN_COURSE_ID}`);
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.equal(body.counts.lessons, doc.ATLAS.length);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/learn/course/no-such-course`)).status, 404);
  } finally { srv.close(); db.close(); }
});

test("d178PatternsOwnCourse: on the shelf, its own page (no progress shown), and linked from Interview → drills", () => {
  const lib = read("client/src/pages/atlas/LibraryPanel.jsx");
  assert.match(lib, /\{ id: "coding-interview-patterns", title: "Coding interview patterns", art: "patterns", kind: "patterns" \}/);
  const page = lib.slice(at(lib, "export function PatternCoursePage"), at(lib, "export function CoursePage"));
  assert.doesNotMatch(page, /lessonState|courseProgress|\blit\b|% done|✓/, "no progress on the pattern course");
  assert.match(page, /data-course-no-progress=""/);
  assert.match(page, /to=\{stepHref\(m\.taughtIn\.stepId\)\}/);
  assert.match(read("client/src/pages/atlas/AtlasPage.jsx"), /courseKind\(courseId\) === "patterns" \? <PatternCoursePage base=\{base\} id=\{courseId\} \/> : <CoursePage/);
  assert.match(read("client/src/pages/interview/InterviewPage.jsx"), /<Link className="iv__btn" to="\/app\/atlas\/library\/coding-interview-patterns" data-open-patterns="">Coding interview patterns<\/Link>/);
  const css = read("client/src/pages/atlas/LibraryPanel.css");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "tokens only");
});
