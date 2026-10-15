// T10 · the upload gate's scenario matrix (docs/EXTENSION_SCENARIOS.md).
//
// The WORKLOG defines rows (1)–(42): T10 · THE UPLOAD GATE (1–30), "T10 additions — scenario rows" (31–37) and
// "T10 additions — more scenario rows" (38–42). The matrix must carry every one of them EXACTLY once — a row that goes
// missing is a scenario nobody is checking, and a duplicated number is two rows that will drift apart.
//
// Line endings are normalised on read: this parses markdown, so `\r\n` vs `\n` is incidental (CLAUDE.md's table).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ROWS = 42;
const doc = fs.readFileSync("docs/EXTENSION_SCENARIOS.md", "utf8").replace(/\r\n/g, "\n");

/** The matrix rows: a table line whose first cell is a bare number. */
function matrixRows(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = /^\|\s*(\d+)\s*\|/.exec(line);
    if (m) out.push({ n: Number(m[1]), cells: line.split("|").slice(1, -1).map((c) => c.trim()) });
  }
  return out;
}

test("T10: every scenario row 1–42 appears in the matrix exactly once, and no other number does", () => {
  const rows = matrixRows(doc);
  const seen = new Map();
  for (const r of rows) seen.set(r.n, (seen.get(r.n) || 0) + 1);
  const missing = [], doubled = [];
  for (let n = 1; n <= ROWS; n++) {
    if (!seen.has(n)) missing.push(n);
    else if (seen.get(n) > 1) doubled.push(n);
  }
  const extra = [...seen.keys()].filter((n) => n < 1 || n > ROWS);
  assert.deepEqual(missing, [], `rows missing from the matrix: ${missing.join(", ")}`);
  assert.deepEqual(doubled, [], `rows listed more than once: ${doubled.join(", ")}`);
  assert.deepEqual(extra, [], `numbers the WORKLOG does not define: ${extra.join(", ")} — add the row to the WORKLOG first`);
});

test("T10: every row has a status and an owner's-walk entry (T8: the walk is the owner's to mark)", () => {
  for (const r of matrixRows(doc)) {
    assert.equal(r.cells.length, 6, `row ${r.n} has ${r.cells.length} cells, not 6`);
    assert.match(r.cells[4], /\*\*(COVERED|PARTIAL|NOT COVERED)\*\*/, `row ${r.n} has no status`);
    assert.ok(r.cells[5].length > 0, `row ${r.n} has no owner's-walk entry`);
  }
});

test("T10: the counts table agrees with the rows' statuses", () => {
  const byStatus = { COVERED: [], PARTIAL: [], "NOT COVERED": [] };
  for (const r of matrixRows(doc)) byStatus[/\*\*(COVERED|PARTIAL|NOT COVERED)\*\*/.exec(r.cells[4])[1]].push(r.n);
  for (const [status, ns] of Object.entries(byStatus)) {
    const line = doc.split("\n").find((l) => l.startsWith(`| ${status} |`));
    assert.ok(line, `the counts table has no ${status} line`);
    const listed = line.split("|")[2].split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
    assert.deepEqual(listed, ns, `${status}: the counts table lists ${listed.join(", ")}, the rows say ${ns.join(", ")}`);
    assert.match(line, new RegExp(`\\*\\*${ns.length}\\*\\*`), `${status}: the count is not ${ns.length}`);
  }
});
