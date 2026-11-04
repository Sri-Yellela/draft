// ⛔⛔ D153 (2) · FILTER COUNTS THAT ADD UP (owner 11-04: "the filters are way off. The workplace says 52,000, and then
// remote 38,000, and then hybrid 36,000"). The panel drew each option's `count` — known matches PLUS every posting whose
// value is unknown (the soft-null rows the board keeps) — so 9,672 engineering + 43,009 unknown showed as 52,681, and a
// clause's options summed to several times the board. Each option now shows its KNOWN matches only, strict or not, and
// the unknowns are said once, in the panel's note.
import test from "node:test";
import assert from "node:assert/strict";
import { SENTENCE_CLAUSES, panelRows, panelNote, clauseOptions } from "../client/src/lib/filterSentenceModel.js";

const where = SENTENCE_CLAUSES.find(c => c.key === "where");
const UNKNOWN = 30_000;
// A board of 52,000: 22,000 have a workplace on file (remote 12,000 · hybrid 6,000 · on-site 4,000), 30,000 do not.
const KNOWN = [12_000, 6_000, 4_000];
const facets = {
  total: 52_000, known: 52_000 - UNKNOWN, unscored: 0,
  coverage: { where: 52_000 - UNKNOWN },
  clauses: { where: clauseOptions(where).map((o, i) => ({ value: o.value, label: o.label, count: (KNOWN[i] ?? 0) + UNKNOWN, known: KNOWN[i] ?? 0 })) },
};

test("d153KnownOnlyCounts: each option's number is its known matches, and options + unknown = the board", () => {
  const opts = panelRows(where, {}, facets).filter(r => r.kind === "option");
  assert.ok(opts.length >= 3);
  const shown = opts.reduce((s, r) => s + r.count, 0);
  assert.equal(shown, KNOWN.reduce((a, b) => a + b, 0), "an option counted the unknowns as its own");
  assert.equal(shown + UNKNOWN, facets.total, "options + unknown must equal the board's total");
  for (const r of opts) assert.ok(r.count <= facets.known, `${r.value}: ${r.count} is more than every known posting`);
});

test("d153KnownOnlyCounts: the same numbers with the strict toggle on (they no longer differ)", () => {
  const chosen = { [where.dim.param]: where.dim.multi ? [clauseOptions(where)[0].value] : clauseOptions(where)[0].value };
  const loose = panelRows(where, chosen, facets).filter(r => r.kind === "option").map(r => r.count);
  const strict = panelRows(where, { ...chosen, strict_tags: "1" }, facets).filter(r => r.kind === "option").map(r => r.count);
  assert.deepEqual(loose, strict);
});

test("d153KnownOnlyCounts: the unknowns are said once, in the panel's note", () => {
  const note = panelNote("where", {}, facets);
  assert.ok(note, "the note must say what is not on file");
});
