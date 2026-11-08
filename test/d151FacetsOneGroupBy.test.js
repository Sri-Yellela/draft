// D151 (45k) · the board's include_facets: ONE GROUP BY over every asked dimension, summed per dimension
// (jobQuery.js facetsFromCrossTab) — the same answer as one GROUP BY per dimension, the way it was before.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { facetsFromCrossTab } from "../services/jobs/jobQuery.js";

test("d151FacetsOneGroupBy: the cross-tab summed per dimension equals each dimension's own GROUP BY (NULLs dropped, order kept)", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE t (a TEXT, b TEXT, c INTEGER)");
  const ins = db.prepare("INSERT INTO t VALUES (?, ?, ?)");
  const A = ["remote", "hybrid", "onsite", null, "Zeta", "alpha"], B = ["senior", "mid", null, "entry"], C = [null, 1, 2, 10, 3];
  let seed = 7; const pick = (xs) => xs[(seed = (seed * 1103515245 + 12345) % 2147483648) % xs.length];
  for (let i = 0; i < 500; i++) ins.run(pick(A), pick(B), pick(C));
  const cols = { a: "a", b: "b", c: "c" };
  for (const dims of [["a"], ["a", "b"], ["c", "a", "b"], ["b", "c"]]) {
    const rows = db.prepare(`SELECT ${dims.map((d, i) => `${cols[d]} AS f${i}`).join(", ")}, COUNT(*) AS count FROM t
      GROUP BY ${dims.map((_d, i) => `f${i}`).join(", ")}`).all();
    const got = facetsFromCrossTab(dims, rows);
    for (const d of dims) {
      const want = db.prepare(`SELECT ${cols[d]} AS value, COUNT(*) AS count FROM t GROUP BY ${cols[d]}`).all()
        .filter(r => r.value != null).map(r => ({ value: r.value, count: r.count }));
      assert.deepEqual(got[d], want, `${dims} → ${d}`);
    }
  }
});

test("d151FacetsOneGroupBy: server.js asks the board's facets in ONE statement through the helper", () => {
  const s = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(s, /GROUP BY \$\{plainDims\.map\(\(_d, i\) => `f\$\{i\}`\)\.join\(', '\)\}/);
  assert.match(s, /Object\.assign\(facets, facetsFromCrossTab\(plainDims, facetRows\)\);/);
});
