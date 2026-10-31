// ⭐ D117 C1 / C2 / C5 · THE LINKS BETWEEN PIECES — shared/learnCircle.js, the one definition the server's loop check and
// "From your map" route and the page's circle, routes and "Go back to understand" read. Run on the real data file
// (content/learn/d117-data.json) and the owner's tracker, plus small synthetic graphs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { learnContent, stepsOf } from "../services/learn/learnContent.js";
import { opensOf, findCycle, routeClosure, routeStart, goBackTo } from "../shared/learnCircle.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const ORDER = stepsOf(learnContent()).map(s => s.id);
const NEEDS = new Map(Object.entries(JSON.parse(fs.readFileSync("content/learn/d117-data.json", "utf8")).needs_drafted));

test("D117 C7 · d117OpensIsInverseOfNeeds — 'After this' is computed from 'Before this', never stored; 32 pieces open nothing", () => {
  const opens = opensOf(NEEDS, ORDER);
  for (const [id, list] of NEEDS) for (const n of list) assert.ok(opens.get(n).includes(id), `${n} opens ${id}`);
  for (const [id, list] of opens) for (const o of list) assert.ok(NEEDS.get(o).includes(id), `${o} needs ${id}`);
  for (const list of opens.values()) assert.deepEqual(list, [...list].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)), "in the circle's order");
  assert.equal(ORDER.filter(id => !(opens.get(id) || []).length).length, 32, "32 pieces round off their part (C2)");
  assert.deepEqual(opensOf(new Map([["c", ["a"]], ["b", ["a"]]]), ["a", "b", "c"]).get("a"), ["b", "c"], "in the circle's order, whatever the links' order");
  const mig = read("scripts/migrations.js");
  const m202 = mig.slice(at(mig, 'id: "202_learn_circle"'));
  assert.doesNotMatch(m202.slice(0, at(m202, "`,")), /\bopens\b/i, "no stored opens");
});

test("D117 C7 · d117NeedsNoCycle — the drafted links have no loop; a loop is found and named", () => {
  assert.equal(findCycle(NEEDS), null);
  assert.deepEqual(findCycle(new Map([["a", ["b"]], ["b", ["c"]], ["c", ["a"]]])), ["a", "b", "c", "a"]);
  assert.equal(findCycle(new Map([["a", ["b"]], ["b", []], ["c", ["a", "b"]]])), null);
});

test("D117 C7 · d117RouteClosureOrdered — a route = the targets + everything they build on, nothing before what it builds on, ties in the circle's order; the sketch's counts", () => {
  const counts = [[["o4"], 11], [["x2", "x1", "b2", "w2", "o3", "l2"], 26], [["x2", "x1", "b2", "d3", "g4"], 28], [["x2", "z1", "o4", "x1", "b2"], 38]];
  for (const [targets, n] of counts) {
    const r = routeClosure(NEEDS, ORDER, targets);
    assert.equal(r.length, n, targets.join(","));
    for (const t of targets) assert.ok(r.includes(t));
    assert.equal(new Set(r).size, r.length);
    r.forEach((id, i) => { for (const need of NEEDS.get(id) || []) assert.ok(r.indexOf(need) < i, `${need} before ${id}`); });
  }
  assert.deepEqual(routeClosure(new Map([["c", ["a", "b"]]]), ["b", "a", "c"], ["c"]), ["b", "a", "c"], "ties: the circle's order");
  assert.deepEqual(routeClosure(NEEDS, ORDER, ["s1"]), ["s1"]);
  assert.deepEqual(routeClosure(NEEDS, ORDER, ["nope"]), []);
});

test("D117 C7 · d117RouteStartsAtFirstUnfinished — a route starts at the first piece not finished (else its first)", () => {
  const r = routeClosure(NEEDS, ORDER, ["o4"]);
  assert.equal(routeStart(r, new Set()), r[0]);
  assert.equal(routeStart(r, new Set(r.slice(0, 3))), r[3]);
  assert.equal(routeStart(r, new Set(r)), r[0]);
  assert.equal(routeStart(r, (id) => id !== r[5] && r.indexOf(id) < 8), r[5]);
});

test("D117 C7 · d117GoBackPicksDeepestUnfinished — 'Go back to understand' names the first unfinished piece it builds on at ANY depth, roots first", () => {
  const needs = new Map([["d", ["c"]], ["c", ["b"]], ["b", ["a"]], ["a", []]]);
  const order = ["a", "b", "c", "d"];
  assert.equal(goBackTo(needs, order, "d", new Set()), "a", "the deepest gap, not the nearest");
  assert.equal(goBackTo(needs, order, "d", new Set(["a"])), "b");
  assert.equal(goBackTo(needs, order, "d", new Set(["a", "b", "c"])), null, "everything it builds on is finished");
  assert.equal(goBackTo(needs, order, "a", new Set()), null, "nothing before it");
  assert.equal(goBackTo(NEEDS, ORDER, "x2", new Set()), routeClosure(NEEDS, ORDER, ["x2"])[0]);
});
