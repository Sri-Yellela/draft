// ⭐ D172 (2) (owner APPROVED 11-06, docs/sketches/atlas-redesign-sketch.html → Library → a course) · the Library and the
// course page. d172CourseModulesLessons · d172EveryCuratedItemMapped · d172ShelfCoversFromTokens. The owner's path,
// "From silicon to software", is the first course: 8 parts = modules, 108 steps = lessons, every curated item mapped.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { courseOf, linkType, COURSE_ID } from "../services/learn/learnCourse.js";
import { createLearnRouter } from "../routes/learn.js";
import { courseProgress, firstOpenModule, lessonState, linkLine } from "../client/src/pages/atlas/libraryModel.js";
import { panelFor, isPanelSlug, courseIdOf } from "../client/src/pages/atlas/atlasPanels.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const seed = JSON.parse(fs.readFileSync("content/learn/silicon-to-software.json", "utf8"));
const reg = JSON.parse(fs.readFileSync("content/sources/registry.json", "utf8"));
const course = courseOf(seed, reg);

test("d172CourseModulesLessons: the path as a course — modules are its parts, lessons its steps, in order", () => {
  assert.equal(course.id, COURSE_ID);
  assert.deepEqual(course.counts, { modules: 8, lessons: 108, links: 373 });
  assert.equal(course.modules[0].title, "Foundations", "\"Part 1: \" is drawn as the module's number, not repeated in its title");
  assert.deepEqual(course.modules.map(m => m.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  const s1 = course.modules[0].lessons[0];
  assert.equal(s1.id, "s1");
  assert.deepEqual(s1.checks, ["s1#c0", "s1#c1", "s1#c2"], "the check is the step's own checkpoints");
  assert.equal(linkType("Video"), "Watch"); assert.equal(linkType("Book"), "Read"); assert.equal(linkType("Build"), "Try");
  assert.equal(s1.links[0].source.id, "charles-petzold", "each link carries its register source (D176-3)");
});

test("d172EveryCuratedItemMapped: every item of every step is a lesson link — none dropped, none invented", () => {
  const want = [];
  for (const p of seed.PARTS) for (const ph of p.phases) for (const st of ph.steps) for (const it of st.items || []) want.push(`${st.id}/${it.id}`);
  const got = course.modules.flatMap(m => m.lessons.flatMap(l => l.links.map(x => `${l.id}/${x.id}`)));
  assert.deepEqual(got, want);
  for (const l of course.modules.flatMap(m => m.lessons)) for (const x of l.links) {
    assert.ok(x.source || x.needsNamedSource, `${l.id}/${x.id} has a source or is flagged`);
    assert.ok(!("slides" in x) && !("minutes" in x), "no deck size or length until a lesson has one");
  }
});

test("d172CourseModulesLessons: progress is EARNED, by the one rule — nothing ticked", () => {
  const l = course.modules[0].lessons[0];
  assert.equal(lessonState(l, {}).complete, false);
  const all = Object.fromEntries([...l.links.filter(x => !x.optional && x.url).map(x => x.id), ...l.checks, ...(l.build ? [l.build] : [])].map(id => [id, 1]));
  assert.equal(lessonState(l, all).complete, true, "opened + explained + built = checked");
  const p = courseProgress(course, all);
  assert.equal(p.done, 1); assert.equal(p.total, 108); assert.equal(p.pct, 0);
  assert.equal(firstOpenModule(course, all), 1, "module 1 still has unfinished lessons");
  assert.equal(linkLine({ type: "Watch", title: "Turing machines", source: { name: "Computerphile" } }), "Watch · Turing machines · Computerphile");
});

test("d172CourseModulesLessons: GET /api/learn/course/:id — the course; an unknown id is a 404", async () => {
  const app = express();
  app.use("/api/learn", createLearnRouter(null, { requireAuth: (_q, r) => r.status(401).end() }));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const r = await fetch(`${url}/api/learn/course/${COURSE_ID}`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.deepEqual(j.counts, { modules: 8, lessons: 108, links: 373 });
    assert.equal((await fetch(`${url}/api/learn/course/nope`)).status, 404);
  } finally { server.close(); }
});

test("d172CourseModulesLessons: the addresses — /atlas/library is a panel, /atlas/library/<id> a course", () => {
  assert.equal(panelFor("library"), "library");
  assert.equal(panelFor("library/silicon-to-software"), "library");
  assert.equal(isPanelSlug("library"), true);
  assert.equal(courseIdOf("library/silicon-to-software"), "silicon-to-software");
  assert.equal(courseIdOf("library"), null);
  assert.equal(courseIdOf("kafka"), null);
});

// ── rendered ──
const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
async function loadUi() {
  const esbuild = requireClient("esbuild");
  const abs = (p) => JSON.stringify(path.join(CLIENT, "src", p).split(path.sep).join("/"));
  const result = await esbuild.build({
    stdin: { contents: `
      import { createElement as h } from "react";
      import { renderToStaticMarkup } from "react-dom/server.browser";
      import { MemoryRouter } from "react-router-dom";
      import { LibraryShelf } from ${abs("pages/atlas/LibraryPanel.jsx")};
      export const shelf = () => renderToStaticMarkup(h(MemoryRouter, null, h(LibraryShelf, { base: "/app/atlas", signedIn: false })));`,
      resolveDir: CLIENT, loader: "jsx" },
    bundle: true, write: false, format: "esm", platform: "node", jsx: "automatic",
    loader: { ".css": "empty", ".js": "jsx" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d172-lib-"));
  const file = path.join(dir, "ui.mjs");
  fs.writeFileSync(file, result.outputFiles[0].text);
  try { return await import(pathToFileURL(file).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test("d172ShelfCoversFromTokens: one cover per course that exists, drawn, its colours from theme tokens", async () => {
  const { shelf } = await loadUi();
  const html = shelf();
  assert.equal(html.match(/data-course="/g).length, 1, "one course exists — no 'Soon' covers for courses nobody has planned");
  assert.match(html, /href="\/app\/atlas\/library\/silicon-to-software"/);
  assert.match(html, /<svg class="lib-cover__art"/);
  const css = read("client/src/pages/atlas/LibraryPanel.css");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, "no colour literal — tokens only");
  assert.doesNotMatch(css, /border-radius:\s*(999px|50%)/, "no capsules (D60)");
});
