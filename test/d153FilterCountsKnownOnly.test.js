// ⛔⛔ D153 (2) · FILTER COUNTS THAT ADD UP (owner 11-04: "the filters are way off. The workplace says 52,000, and then
// remote 38,000, and then hybrid 36,000"). The panel drew each option's `count` — known matches PLUS every posting whose
// value is unknown (the soft-null rows the board keeps) — so 9,672 engineering + 43,009 unknown showed as 52,681, and a
// clause's options summed to several times the board. Each option now shows its KNOWN matches only, strict or not, and
// the unknowns are said once, in the panel's note.
import test from "node:test";
import assert from "node:assert/strict";
import { SENTENCE_CLAUSES, panelRows, panelNote, panelPress, clauseOptions } from "../client/src/lib/filterSentenceModel.js";

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

const location = SENTENCE_CLAUSES.find(c => c.key === "location");

test("d153RemoteNotCountedPerCity: the location panel counts remote once, under Remote (US), from the known remote postings", () => {
  const rows = panelRows(location, {}, facets);
  const remote = rows.filter(r => r.kind === "remote-us");
  assert.equal(remote.length, 1, "one Remote (US) row");
  assert.equal(remote[0].label, "Remote (US)");
  assert.equal(remote[0].count, KNOWN[0], "the known remote postings, not remote + unknown");
  assert.equal(rows[0].kind, "any", "the US floor stays first");
  // a place is chosen: the remote row has no number (it would not be this view's count)
  const chosen = { [location.dim.param]: location.dim.multi ? [clauseOptions(location)[0].value] : clauseOptions(location)[0].value };
  assert.equal(panelRows(location, chosen, facets).find(r => r.kind === "remote-us").count, null);
});

test("d153RemoteNotCountedPerCity: pressing Remote (US) clears the place and sets the workplace to remote, and again undoes it", () => {
  const press = (params) => panelPress(location, params, panelRows(location, params, facets).find(r => r.kind === "remote-us"));
  const chosen = { [location.dim.param]: location.dim.multi ? [clauseOptions(location)[0].value] : clauseOptions(location)[0].value };
  const on = press(chosen);
  assert.deepEqual(on[location.dim.param], location.dim.multi ? [] : "");
  assert.deepEqual(on[where.dim.param], where.dim.multi ? ["remote"] : "remote");
  const params = { ...chosen, ...on };
  assert.equal(panelRows(location, params, facets).find(r => r.kind === "remote-us").selected, true);
  assert.deepEqual(press(params)[where.dim.param], where.dim.multi ? [] : "");
});

test("d153LocationListsThisPlace: the location note says each number is the postings that list that place", () => {
  assert.match(panelNote("location", {}, facets), /list that place/);
  assert.match(panelNote("location", {}, facets), /Remote \(US\)/);
});
