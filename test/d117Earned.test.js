// ⭐ D117 C8 · PROGRESS IS EARNED, NOT TICKED — the server half: an item counts when it is opened FROM draft, a checkpoint
// when the user explains it in 25+ words of their own (a paste refused), a required build when its link is given; the bar's
// weights; FINISHED; optional items never block; explanations are private and no model reads them; D115's old ticks are
// kept and count for nothing. (d116UnlockUsesC8 is in test/d116Tree.test.js, beside the tree's fixtures; the page's half
// — no control says "complete", the click records the opening — is test/d117CircleUi.test.js.)
// Synthetic users; no network, no model.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { learnContent, stepsOf } from "../services/learn/learnContent.js";
import { setMark } from "../services/learn/learnProgress.js";
import { seedCircleData, checkExtraItems } from "../services/learn/learnCircle.js";
import { recordOpened, saveExplanation, saveBuild, earnedMarks, piecesOf, wordCount, OWN_WORDS } from "../services/learn/learnEarned.js";
import { stepState, BAR_WEIGHTS, buildId } from "../shared/learnStepState.js";
import { createLearnRouter } from "../routes/learn.js";
import { upsertNode } from "../services/atlas/atlasStore.js";
import { learnStepForNode } from "../services/learn/learnLinks.js";
import { stepsTeaching } from "../services/atlas/atlasTree.js";
import { createLearnAdminRouter } from "../routes/learnAdmin.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const id of [7, 8]) db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (?, ?, 'x')`).run(id, `learner${id}@example.test`);
  return db;
}
const piece = (db, id) => piecesOf(db).find(s => s.id === id);
const stateOf = (db, uid, id) => stepState(piece(db, id), earnedMarks(db, uid));
/** 30 words of a learner's own explanation. */
const OWN = "A switch that is on lets current through and stands for a one, while a switch that is off blocks it and stands for a zero, so circuits can count and decide things.";
const SHORT = "A switch on is a one and off is a zero.";

async function serve(db, userId) {
  const app = express();
  app.use(express.json());
  const requireAuth = (req, res, next) => (userId ? (req.user = { id: userId }, next()) : res.status(401).json({ error: "unauthorized" }));
  app.use("/api/learn", createLearnRouter(db, { requireAuth }));
  app.use("/api/admin/learn", createLearnAdminRouter(db));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { call, close: () => new Promise(r => srv.close(r)) };
}

test("D117 C7 · d117FinishedRule — FINISHED = every required item (with a link) opened + every checkpoint explained (+ the build where one is required); one missing and it is not", () => {
  const db = fixtureDb();
  const s1 = piece(db, "s1");   // three required links, one optional book, three checkpoints, no build
  for (const it of s1.items.filter(i => !i.o)) recordOpened(db, 7, it.id);
  saveExplanation(db, 7, "s1#c0", OWN); saveExplanation(db, 7, "s1#c1", OWN);
  let st = stateOf(db, 7, "s1");
  assert.deepEqual([st.complete, st.done, st.total], [false, 5, 6], "one checkpoint short");
  saveExplanation(db, 7, "s1#c2", OWN);
  st = stateOf(db, 7, "s1");
  assert.deepEqual([st.complete, st.bar, st.started], [true, 100, true]);
  // A linkless Build is met by the build link, not by "opening" it (it has nothing to open).
  const linkless = stepsOf(learnContent()).find(s => (s.items || []).some(i => !i.o && !i.u && i.k === "Build"));
  const st2 = stepState(linkless, {});
  assert.equal(st2.toOpen, linkless.items.filter(i => !i.o && i.u).length);
  assert.equal(st2.build, true);
});

test("D117 C8 · d117OpenedOnlyFromDraftClick — an item counts when its link is opened from draft (POST /opened, the click); the first opening's time is kept; nothing else writes it", async () => {
  const db = fixtureDb();
  const s = await serve(db, 7);
  try {
    const r = await s.call("POST", "/api/learn/opened", { id: "s1-code" });
    assert.equal(r.status, 200);
    assert.deepEqual([r.json.piece, r.json.state.opened, r.json.finished], ["s1", 1, false]);
    assert.ok(db.prepare(`SELECT at FROM learn_opened WHERE user_id = 7 AND item_id = 's1-code'`).pluck().get() > 0);
    db.prepare(`UPDATE learn_opened SET at = 5`).run();
    const at = 5;
    await s.call("POST", "/api/learn/opened", { id: "s1-code" });
    assert.equal(db.prepare(`SELECT at FROM learn_opened WHERE user_id = 7 AND item_id = 's1-code'`).pluck().get(), at, "the first opening stands");
    assert.equal((await s.call("POST", "/api/learn/opened", { id: "s1#c0" })).status, 404, "a checkpoint is not opened — it is explained");
    const linkless = stepsOf(learnContent()).flatMap(st => st.items).find(i => !i.u);
    assert.equal((await s.call("POST", "/api/learn/opened", { id: linkless.id })).status, 404, "an item with no link cannot be opened from draft");
    assert.equal((await s.call("POST", "/api/learn/opened", {})).status, 400);
  } finally { await s.close(); }
  const anon = await serve(db, null);
  try { assert.equal((await anon.call("POST", "/api/learn/opened", { id: "s1-code" })).status, 401); } finally { await anon.close(); }
  // learn_opened is written in one place: recordOpened (services/learn/learnEarned.js).
  const writers = ["services", "routes"].flatMap(d => fs.readdirSync(d, { recursive: true }).map(f => path.join(d, String(f))))
    .filter(f => f.endsWith(".js") && /INSERT[^`]*learn_opened/.test(read(f)));
  assert.deepEqual(writers.map(f => f.replace(/\\/g, "/")), ["services/learn/learnEarned.js"]);
});

test("D117 C8 · d117ExplainedNeedsOwnWords — under 25 words refused; a paste of 25+ words refused with 'Put it in your own words.'; 25+ typed saved with the date, and editable", async () => {
  const db = fixtureDb();
  assert.equal(wordCount(OWN) >= 25, true);
  assert.equal(wordCount("it's a two-step, well-known idea"), 5);
  const s = await serve(db, 7);
  try {
    const few = await s.call("PUT", "/api/learn/explained", { id: "s1#c0", text: SHORT });
    assert.deepEqual([few.status, few.json.error], [400, "too_few_words"]);
    assert.match(few.json.message, /at least 25 words — you have 11/);
    const pasted = await s.call("PUT", "/api/learn/explained", { id: "s1#c0", text: OWN, pasted: 30 });
    assert.deepEqual([pasted.status, pasted.json.error, pasted.json.message], [400, "not_own_words", OWN_WORDS]);
    assert.equal(OWN_WORDS, "Put it in your own words.");
    assert.equal((await s.call("PUT", "/api/learn/explained", { id: "s1#c0", text: OWN, pasted: 24 })).status, 200, "a short paste (a word, a name) is fine");
    const row = db.prepare(`SELECT body, words, created_at, updated_at FROM learn_explanations WHERE user_id = 7`).get();
    assert.deepEqual([row.body, row.words], [OWN, wordCount(OWN)]);
    assert.ok(row.created_at > 0);
    db.prepare(`UPDATE learn_explanations SET created_at = 11 WHERE user_id = 7`).run();
    const edited = `${OWN} And a relay is a switch moved by another circuit.`;
    assert.equal((await s.call("PUT", "/api/learn/explained", { id: "s1#c0", text: edited })).status, 200);
    const row2 = db.prepare(`SELECT body, created_at FROM learn_explanations WHERE user_id = 7`).get();
    assert.deepEqual([row2.body, row2.created_at], [edited, 11], "edited; the first date kept");
    assert.equal((await s.call("PUT", "/api/learn/explained", { id: "s1#c9", text: OWN })).status, 404);
    assert.equal(db.prepare(`SELECT COUNT(*) FROM learn_explanations`).pluck().get(), 1);
  } finally { await s.close(); }
});

test("D117 C8 · d117BuildLinkRequiredWhereBuild — a piece with a required Build / Project takes a link (D109's rule: https, a real host) and is not finished without it; a piece without one refuses it", async () => {
  const db = fixtureDb();
  const s = await serve(db, 7);
  try {
    assert.deepEqual([(await s.call("PUT", "/api/learn/built", { step: "s1", url: "https://github.com/x/y" })).json.error], ["no_build_here"]);
    for (const it of piece(db, "o4").items.filter(i => !i.o)) await s.call("POST", "/api/learn/opened", { id: it.id });
    for (const c of [0, 1, 2]) await s.call("PUT", "/api/learn/explained", { id: `o4#c${c}`, text: OWN });
    assert.deepEqual([stateOf(db, 7, "o4").complete, stateOf(db, 7, "o4").bar], [false, 80], "everything but the build");
    const http = await s.call("PUT", "/api/learn/built", { step: "o4", url: "http://github.com/x/y" });
    assert.deepEqual([http.status, http.json.error], [400, "bad_link"]);
    assert.equal((await s.call("PUT", "/api/learn/built", { step: "o4", url: "https://github.com/x/y", kind: "paper" })).json.error, "bad_kind");
    const ok = await s.call("PUT", "/api/learn/built", { step: "o4", url: "https://github.com/example-learner/k8s-lab", kind: "repository" });
    assert.deepEqual([ok.status, ok.json.finished, ok.json.state.bar], [200, true, 100]);
    assert.equal(earnedMarks(db, 7)[buildId("o4")] > 0, true);
  } finally { await s.close(); }
  assert.match(read("services/learn/learnEarned.js"), /import \{ checkEvidence \} from "\.\.\/proofLinks\.js";/, "D109's one evidence rule");
});

test("D117 C8 · d117BarWeights — opened × 30 + explained × 50 + build × 20; no required build: 40 / 60; floored, 100 only when finished", () => {
  assert.deepEqual(BAR_WEIGHTS, { build: { opened: 30, explained: 50, built: 20 }, noBuild: { opened: 40, explained: 60, built: 0 } });
  const db = fixtureDb();
  // s1: no build — 3 links, 3 checkpoints.
  recordOpened(db, 7, "s1-code");
  assert.equal(stateOf(db, 7, "s1").bar, 13, "1/3 × 40 = 13.3 → 13");
  recordOpened(db, 7, "s1-cc"); recordOpened(db, 7, "s1-iol");
  assert.equal(stateOf(db, 7, "s1").bar, 40);
  saveExplanation(db, 7, "s1#c0", OWN);
  assert.equal(stateOf(db, 7, "s1").bar, 60, "40 + 1/3 × 60");
  // o4: a required build — 3 links, 3 checkpoints, the build.
  recordOpened(db, 8, "o4-vm");
  assert.equal(stateOf(db, 8, "o4").bar, 10);
  saveBuild(db, 8, "o4", { url: "https://github.com/example-learner/k8s-lab" });
  assert.equal(stateOf(db, 8, "o4").bar, 30, "10 + 20");
  for (const c of [0, 1, 2]) saveExplanation(db, 8, `o4#c${c}`, OWN);
  assert.equal(stateOf(db, 8, "o4").bar, 80);
  recordOpened(db, 8, "o4-docker"); recordOpened(db, 8, "o4-k8s");
  assert.deepEqual([stateOf(db, 8, "o4").bar, stateOf(db, 8, "o4").complete], [100, true]);
  // A share with nothing in it gives its weight to the others.
  assert.equal(stepState({ id: "z", items: [{ id: "z1", k: "Video", u: "https://x.test" }], c: [] }, { z1: 1 }).bar, 100);
});

test("D117 C8 · d117FinishedRuleC8 — D115's ticks finish nothing (kept, readable, never counted); the tick endpoints answer 410; only what the user did counts", async () => {
  const db = fixtureDb();
  for (const id of ["s1-code", "s1-cc", "s1-iol", "s1#c0", "s1#c1", "s1#c2"]) setMark(db, 7, id, true);
  assert.deepEqual(earnedMarks(db, 7), {}, "a tick is not an opening or an explanation");
  assert.equal(stateOf(db, 7, "s1").complete, false);
  const s = await serve(db, 7);
  try {
    assert.equal((await s.call("PUT", "/api/learn/progress", { id: "s1-code", on: true })).status, 410);
    assert.equal((await s.call("POST", "/api/learn/progress/import", { marks: [{ id: "s2-x", at: 1 }] })).status, 410);
    assert.equal((await s.call("GET", "/api/learn/progress")).json.marks.length, 6, "the old ticks are kept");
    const e = (await s.call("GET", "/api/learn/earned")).json;
    assert.deepEqual([e.ticked, e.marks], [6, {}]);
  } finally { await s.close(); }
});

test("D117 C8 · d117OptionalNeverBlocks — optional items (the tracker's and D115 P5's) count as extras, never in the bar and never needed to finish", async () => {
  const db = fixtureDb();
  seedCircleData(db);
  await checkExtraItems(db, { fetchImpl: async () => ({ status: 200 }), pauseMs: 0 });
  const s2 = piece(db, "s2");
  assert.ok(s2.items.some(i => i.id === "s2-p5-1" && i.o === 1 && i.k === "Game"), "NandGame, appended as optional");
  recordOpened(db, 7, "s2-p5-1");
  let st = stateOf(db, 7, "s2");
  assert.deepEqual([st.bar, st.extras, st.started], [0, 1, false], "an extra moves the extras count, not the bar");
  for (const it of s2.items.filter(i => !i.o && i.u)) recordOpened(db, 7, it.id);
  (s2.c || []).forEach((_, i) => saveExplanation(db, 7, `s2#c${i}`, OWN));
  if (st.build) saveBuild(db, 7, "s2", { url: "https://github.com/example-learner/alu" });
  st = stateOf(db, 7, "s2");
  assert.equal(st.complete, true);
  assert.deepEqual([st.extras, st.bar], [1, 100], "the extra still counted as an extra, the bar full from the required work");
  const s1 = piece(db, "s1");
  for (const it of s1.items.filter(i => !i.o)) recordOpened(db, 7, it.id);
  [0, 1, 2].forEach(i => saveExplanation(db, 7, `s1#c${i}`, OWN));
  assert.equal(stateOf(db, 7, "s1").complete, true, "s1-inno (optional) never opened");
});

test("D117 C8 · d117ExplanationsPrivate — a user reads back only their own explanations; nothing public or admin carries them", async () => {
  const db = fixtureDb();
  saveExplanation(db, 7, "s1#c0", OWN);
  const mine = await serve(db, 7), theirs = await serve(db, 8);
  try {
    assert.equal((await mine.call("GET", "/api/learn/earned")).json.explanations["s1#c0"].text, OWN);
    const other = (await theirs.call("GET", "/api/learn/earned")).json;
    assert.deepEqual([other.explanations, other.marks], [{}, {}]);
    const pub = JSON.stringify((await theirs.call("GET", "/api/learn/circle")).json) + JSON.stringify((await theirs.call("GET", "/api/admin/learn/circle")).json);
    assert.ok(!pub.includes("A switch that is on"), "not in the public circle nor in the admin review");
    assert.equal((await theirs.call("GET", "/api/learn/earned")).json.explanations["s1#c0"], undefined);
  } finally { await mine.close(); await theirs.close(); }
  // learn_explanations' body is read in ONE place — readEarned, for its author.
  const readers = ["services", "routes"].flatMap(d => fs.readdirSync(d, { recursive: true }).map(f => path.join(d, String(f))))
    .filter(f => f.endsWith(".js") && /learn_explanations/.test(read(f))).map(f => f.replace(/\\/g, "/")).sort();
  assert.deepEqual(readers, ["services/accountService.js", "services/learn/learnEarned.js"]);
  assert.match(read("services/learn/learnEarned.js"), /SELECT checkpoint_id, body, words, created_at, updated_at FROM learn_explanations WHERE user_id = \?/);
});

test("D117 C8 · d117NoModelReadsExplanations — no model, no network on the path an explanation takes; it is stored, counted in words, and only read back to its author", () => {
  const src = read("services/learn/learnEarned.js");
  const code = src.replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /anthropic|openai|callModel|completion|generate|fetch\(|http\.request|toolsService/i);
  for (const imp of [...code.matchAll(/from "([^"]+)"/g)].map(m => m[1])) {
    assert.ok(["./learnContent.js", "./learnCircle.js", "../../shared/learnStepState.js", "../proofLinks.js"].includes(imp), `unexpected import ${imp}`);
  }
  assert.match(src, /No model reads or grades it \(D17\)/);
  // And no file that calls a model mentions the table.
  const modelFiles = ["services", "routes"].flatMap(d => fs.readdirSync(d, { recursive: true }).map(f => path.join(d, String(f))))
    .filter(f => f.endsWith(".js") && /anthropic|callModel|messages\.create/i.test(read(f)));
  assert.ok(modelFiles.length > 0, "the scan found the model callers");
  for (const f of modelFiles) assert.doesNotMatch(read(f), /learn_explanations|saveExplanation|readEarned/, f);
});

test("D117 C7 · d117TeachesFromIndex — teaches[] is DERIVED from the concept index (each term where the index points it; 105 of 108 pieces teach one), and the tree's M8 seam reads the pieces' own terms", () => {
  const learn = learnContent();
  const data = JSON.parse(fs.readFileSync("content/learn/d117-data.json", "utf8"));
  const fromIndex = new Map();
  for (const t of learn.INDEX) if (t.st) { if (!fromIndex.has(t.st)) fromIndex.set(t.st, []); fromIndex.get(t.st).push(t.term); }
  for (const [step, terms] of Object.entries(data.teaches_derived)) assert.deepEqual([...terms].sort(), [...(fromIndex.get(step) || [])].sort(), step);
  assert.equal(Object.values(data.teaches_derived).filter(l => l.length).length, 105);
  // A node only a piece's own term names (the index knows no such term): the tree's seam finds the piece.
  const db = fixtureDb();
  seedCircleData(db);
  const { id } = upsertNode(db, { kind: "tool", name: "Synthetic Gizmo", source: "registry" });
  db.prepare(`INSERT INTO learn_teaches (step_id, term, position) VALUES ('s3', 'Synthetic Gizmo', 0)`).run();
  assert.equal(learnStepForNode(db, { name: "Synthetic Gizmo", term: "synthetic gizmo" }), null, "D115's pointer does not know it");
  assert.deepEqual(stepsTeaching(db, { id, name: "Synthetic Gizmo", term: "synthetic gizmo" }, learnContent(db)).map(s => s.stepId), ["s3"]);
});
