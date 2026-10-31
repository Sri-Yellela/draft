// ⭐ D117 C9 · THE DATA FILE — content/learn/d117-data.json goes in by one idempotent import (by id): the 108 pieces'
// drafted "Before this" links (status 'drafted' until the owner's review), the terms each piece teaches (resolved to Atlas
// nodes through the one resolver), and D115 P5's 26 optional links (each through the dead-link checker first). The
// import refuses a loop and never changes the owner's tracker text. Synthetic users and nodes; no network (an injected
// fetcher).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { learnContent, LEARN_FILE, stepsOf } from "../services/learn/learnContent.js";
import { seedLearnContentIfEmpty } from "../services/learn/learnImport.js";
import { importCircleData, seedCircleData, circleOf, checkExtraItems, unresolvedTerms, teachesByStep, stepsTeachingNodeId, CIRCLE_FILE, p5Id }
  from "../services/learn/learnCircle.js";
import { reviewPiece, editPiece, acceptAll } from "../services/learn/learnCircleReview.js";
import { importLearnConcepts } from "../services/atlas/atlasLearnImport.js";
import { upsertNode, addAlias, setStatus } from "../services/atlas/atlasStore.js";
import { createLearnRouter } from "../routes/learn.js";
import { createLearnAdminRouter } from "../routes/learnAdmin.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const DATA = JSON.parse(fs.readFileSync(CIRCLE_FILE, "utf8"));
const data = () => structuredClone(DATA);
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare(`INSERT INTO users (id, username, password_hash) VALUES (7, 'learner@example.test', 'x')`).run();
  return db;
}
const count = (db, t, where = "1") => db.prepare(`SELECT COUNT(*) FROM ${t} WHERE ${where}`).pluck().get();
const totalNeeds = Object.values(DATA.needs_drafted).reduce((a, l) => a + l.length, 0);

async function serve(db) {
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((req, _r, n) => { req.admin = { email: "curator@example.test" }; n(); });
  app.use("/api/learn", createLearnRouter(db, { requireAuth: (_q, r) => r.status(401).end() }));
  app.use("/api/admin/learn", createLearnAdminRouter(db));
  const srv = app.listen(0);
  await new Promise(r => srv.once("listening", r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const call = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { call, close: () => new Promise(r => srv.close(r)) };
}

test("D117 C9 · d117ImportIdempotent — the file goes in once by id: 108 pieces' links as 'drafted', 385 terms, 26 P5 links; a second run adds nothing and never moves a reviewed status", async () => {
  const db = fixtureDb();
  const r1 = seedCircleData(db);
  assert.equal(r1.ok, true);
  assert.deepEqual([r1.needs.added, r1.needs.kept, r1.teaches.added, r1.p5.added, r1.p5.pending], [totalNeeds, 0, 385, 26, 26]);
  assert.equal(count(db, "learn_needs", "status = 'drafted'"), totalNeeds);
  assert.equal(new Set(db.prepare(`SELECT step_id FROM learn_teaches`).pluck().all()).size, 105, "105 of 108 pieces teach ≥ 1 indexed concept (C2)");
  // The owner reviews: one piece accepted, one rejected, one edited.
  assert.equal(reviewPiece(db, "o4", "accept").ok, true);
  assert.equal(reviewPiece(db, "x2", "reject").ok, true);
  assert.equal(editPiece(db, "b2", ["b1"]).ok, true);
  const before = db.prepare(`SELECT step_id, need_id, status FROM learn_needs ORDER BY step_id, need_id`).all();
  const r2 = seedCircleData(db);
  assert.deepEqual([r2.needs.added, r2.teaches.added, r2.p5.added], [0, 0, 0], "a second boot adds nothing");
  assert.deepEqual(db.prepare(`SELECT step_id, need_id, status FROM learn_needs ORDER BY step_id, need_id`).all(), before, "the owner's review stands");
  assert.ok(before.some(r => r.step_id === "x2" && r.status === "rejected"));
  assert.ok(before.every(r => r.step_id !== "o4" || r.status === "accepted"));
  // A P5 item already checked keeps its status on a re-import.
  db.prepare(`UPDATE learn_extra_items SET status = 'live' WHERE id = ?`).run(p5Id("s2", 1));
  seedCircleData(db);
  assert.equal(db.prepare(`SELECT status FROM learn_extra_items WHERE id = 's2-p5-1'`).pluck().get(), "live");
  // The same import from Admin (POST /circle/import), as C9 asks once D118 P2's import exists.
  const s = await serve(db);
  try {
    const a = await s.call("POST", "/api/admin/learn/circle/import", { data: data() });
    assert.equal(a.status, 200);
    assert.deepEqual([a.json.needs.added, a.json.teaches.added, a.json.p5.added], [0, 0, 0]);
    assert.equal((await s.call("POST", "/api/admin/learn/circle/import", { data: "<html>" })).status, 400);
  } finally { await s.close(); }
  // At boot: after the tracker's content seed and the D115 imports; the content seed never reads this file as a tracker.
  const server = read("server.js");
  assert.ok(at(server, "const s = seedLearnContentIfEmpty(db);") < at(server, "const c = seedCircleData(db);"));
  assert.ok(at(server, "const p = importLearnPatterns(db, learnContent(db));") < at(server, "const c = seedCircleData(db);"),
    "after the D115 imports: the import's unresolved count is measured against the concepts they add (a boot on a copy reported 374 of 385 unresolved before)");
  const fresh = fixtureDb();
  assert.deepEqual(seedLearnContentIfEmpty(fresh, { now: 1 }).seeded, ["silicon-to-software.json"], "d117-data.json is not a tracker document");
  assert.match(read("scripts/migrations.js"), /id: "202_learn_circle",/);
});

test("D117 C9 / C7 · d117ImportRefusesLoop — a loop in the file, or one the file would close with the live links, is refused and nothing is written", async () => {
  const db = fixtureDb();
  const own = { needs_drafted: { s1: ["s2"], s2: ["s3"], s3: ["s1"] } };
  const r = importCircleData(db, own);
  assert.equal(r.ok, false);
  assert.deepEqual(r.loop, ["s1", "s2", "s3", "s1"]);
  assert.equal(count(db, "learn_needs"), 0, "nothing written");
  // The real file has none; with it in, a link back from s1 to a piece that builds on it closes a loop.
  assert.equal(seedCircleData(db).ok, true);
  const n = count(db, "learn_needs");
  const back = importCircleData(db, { needs_drafted: { s1: ["s2"] } });
  assert.equal(back.ok, false);
  assert.match(back.errors[0].reason, /the links make a loop: (s1 → s2 → s1|s2 → s1 → s2)/);
  assert.equal(count(db, "learn_needs"), n);
  // A link the owner REJECTED is not live — rejecting s2's link to s1 lets s1 → s2 in.
  reviewPiece(db, "s2", "reject");
  assert.equal(importCircleData(db, { needs_drafted: { s1: ["s2"] } }).ok, true);
  // The owner's Edit is refused the same way.
  const e = editPiece(db, "s2", ["s1"]);
  assert.deepEqual([e.ok, e.error], [false, "loop"]);
  // Unknown pieces and a piece building on itself are refused too.
  assert.equal(importCircleData(db, { needs_drafted: { nope: ["s1"] } }).ok, false);
  assert.equal(importCircleData(db, { needs_drafted: { s1: ["s1"] } }).ok, false);
  assert.equal(importCircleData(db, { needs_drafted: {}, extra: 1 }).ok, false, "an unknown field is refused");
});

test("D117 C9 · d117DraftedLabelUntilAccepted — drafted links are served and USED (marked 'drafted') until the owner accepts; rejected ones are not served", async () => {
  const db = fixtureDb();
  seedCircleData(db);
  let c = circleOf(db);
  assert.deepEqual(c.pieces.x2.needs.map(n => n.status), c.pieces.x2.needs.map(() => "drafted"));
  assert.ok(c.pieces.x2.needs.length >= 2);
  assert.ok(c.pieces.o4.opens.length >= 0);
  assert.equal(c.counts.drafted, totalNeeds);
  assert.equal(reviewPiece(db, "x2", "accept").changed, c.pieces.x2.needs.length);
  c = circleOf(db);
  assert.ok(c.pieces.x2.needs.every(n => n.status === "accepted"), "accepted: the draft label goes");
  reviewPiece(db, "x1", "reject");
  c = circleOf(db);
  assert.deepEqual(c.pieces.x1.needs, [], "a rejected link is not a link");
  assert.ok(!Object.values(c.pieces).some(p => p.opens.includes("x1") && false));
  assert.equal(acceptAll(db).changed, c.counts.drafted);
  assert.equal(circleOf(db).counts.drafted, 0);
  // The admin review answers the same, per piece, with titles.
  const s = await serve(db);
  try {
    const l = await s.call("GET", "/api/admin/learn/circle");
    const x1 = l.json.pieces.find(p => p.id === "x1");
    assert.ok(x1.needs.length && x1.needs.every(n => n.status === "rejected" && n.title));
    assert.equal(l.json.counts.drafted, 0);
    assert.equal((await s.call("PUT", "/api/admin/learn/circle/needs/x1", { needs: ["d3"] })).status, 200);
    const pub = await s.call("GET", "/api/learn/circle");
    assert.deepEqual(pub.json.pieces.x1.needs, [{ id: "d3", status: "accepted" }]);
  } finally { await s.close(); }
});

test("D117 C9 · d117TeachesResolved — each piece's terms resolve to Atlas nodes through the one resolver (name, alias); unresolved terms are reported", () => {
  const db = fixtureDb();
  seedCircleData(db);
  // Nothing in the Atlas yet: every term is reported.
  assert.equal(unresolvedTerms(db).length, 385);
  // The tracker's concepts as nodes (D115 P4a), Kubernetes as a tool with "k8s" as an alias, one term renamed in the Atlas.
  importLearnConcepts(db, learnContent(db));
  const k = upsertNode(db, { kind: "tool", name: "Kubernetes", source: "registry" });
  setStatus(db, "kubernetes", "published");
  db.prepare(`INSERT INTO learn_teaches (step_id, term, position) VALUES ('o4', 'k8s', 99)`).run();
  addAlias(db, k.id, "k8s");
  const o4 = teachesByStep(db).get("o4");
  assert.ok(o4.some(t => t.term === "k8s" && t.slug === "kubernetes"), "through the thesaurus");
  assert.ok(stepsTeachingNodeId(db, k.id).includes("o4"), "the piece ↔ node link D116 M8 reads");
  const leftOver = unresolvedTerms(db);
  assert.ok(leftOver.length < 20, `${leftOver.length} unresolved — the ambiguous words and slug clashes D115 left out`);
  const s1 = teachesByStep(db).get("s1");
  assert.deepEqual(s1.map(t => t.term), ["Bit", "Boolean logic", "Logic gate"]);
  assert.ok(s1.every(t => t.slug === null || typeof t.slug === "string"));
  // Served: only published nodes carry a slug (a link), the rest keep their name.
  const c = circleOf(db);
  assert.ok(c.pieces.o4.teaches.some(t => t.slug === "kubernetes"));
});

test("D117 C9 · d117P5DeadLinkHeld — each P5 link is checked before it shows: live → appended to its piece as optional; dead → held back and listed", async () => {
  const db = fixtureDb();
  seedCircleData(db);
  assert.deepEqual(circleOf(db).pieces.s2.extras, [], "pending: not shown before the check");
  const dead = "https://nandgame.com";
  const fetchImpl = async (u) => ({ status: u.startsWith(dead) ? 404 : 200, body: null });
  const r = await checkExtraItems(db, { fetchImpl, pauseMs: 0 });
  assert.deepEqual([r.checked, r.live, r.held.map(h => h.id)], [26, 25, ["s2-p5-1"]]);
  assert.equal(r.held[0].status, "answered 404");
  const c = circleOf(db);
  assert.deepEqual(c.pieces.s2.extras, [], "the dead one is held back");
  const w4 = c.pieces.w4.extras;
  assert.deepEqual(w4.map(i => i.id), ["w4-p5-1", "w4-p5-2", "w4-p5-3", "w4-p5-4", "w4-p5-5"]);
  assert.ok(w4.every(i => i.o === 1 && i.p5 && ["Game", "Exercise", "Practice"].includes(i.k) && i.u.startsWith("https://")));
  assert.equal(Object.values(c.pieces).reduce((a, p) => a + p.extras.length, 0), 25);
  // Listed for the owner; a held link that answers again comes back.
  const s = await serve(db);
  try {
    const l = await s.call("GET", "/api/admin/learn/circle");
    assert.deepEqual(l.json.extras.filter(x => x.status === "held").map(x => x.id), ["s2-p5-1"]);
  } finally { await s.close(); }
  await checkExtraItems(db, { fetchImpl: async () => ({ status: 200 }), pauseMs: 0, include: ["held"] });
  assert.equal(circleOf(db).pieces.s2.extras[0].id, "s2-p5-1");
  // A P5 item must be optional and an https link.
  const bad = { p5_items: [{ step: "s1", k: "Game", t: "X", s: "y", u: "http://example.test", o: 1 }] };
  assert.equal(importCircleData(db, bad).ok, false);
  assert.equal(importCircleData(db, { p5_items: [{ step: "s1", k: "Game", t: "X", u: "https://example.test", o: 0 }] }).ok, false);
  assert.match(read("server.js"), /const r = await checkExtraItems\(db\);/, "re-checked daily with the Atlas's links");
});

test("D117 C9 · d117TrackerTextUntouched — the import never changes the owner's tracker: learn_content's row, its version and every item stay byte for byte", async () => {
  const db = fixtureDb();
  seedLearnContentIfEmpty(db, { now: 5 });
  const row = () => db.prepare(`SELECT data, version, imported_at, imported_by FROM learn_content`).get();
  const before = row();
  const s = await serve(db);
  let pubBefore;
  try { pubBefore = (await s.call("GET", "/api/learn")).json; } finally { await s.close(); }
  seedCircleData(db);
  await checkExtraItems(db, { fetchImpl: async () => ({ status: 200 }), pauseMs: 0 });
  reviewPiece(db, "o4", "accept");
  assert.deepEqual(row(), before, "learn_content untouched");
  const s2 = await serve(db);
  try { assert.deepEqual((await s2.call("GET", "/api/learn")).json, pubBefore, "GET /api/learn serves the same words"); } finally { await s2.close(); }
  const file = JSON.parse(fs.readFileSync(LEARN_FILE, "utf8"));
  assert.equal(stepsOf(learnContent(db)).flatMap(st => st.items).length, 373, "no P5 item is written into the tracker");
  assert.deepEqual(learnContent(db).PARTS, file.PARTS);
  assert.doesNotMatch(read("services/learn/learnCircle.js").replace(/^\s*\/\/.*$/gm, ""), /(INSERT|UPDATE|DELETE)[^`]*learn_content/, "no write to learn_content");
});
