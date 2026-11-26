// ⭐ D196 F4 / R1 / R2 · the gallery shows every component in every state, with extreme data.
//   d196EveryComponentInGallery  — every component a plate/*.jsx file exports is in plate/registry.js, and every entry names
//                                  a real export of the file it says;
//   d196EveryComponentHasStates  — every entry has ready / loading / empty / error, and its component runs plateState()
//                                  (or the entry says why states don't apply);
//   d196ExtremeData              — every entry with data has an `extremes` fixture or is stateless; the long strings are
//                                  ≥ 120 characters, the counts reach 0 / 1 / 412 / 10,000, the register holds 500 rows;
//   d196RendersEveryState        — each entry × state renders (react-dom/server, no browser) and the state's structure is
//                                  there: loading aria-busy, empty the NOT YET drawer, error role=alert + Try again;
//                                  the extremes keep the whole long text (wrapped by CSS, never cut in the markup).
// ⛔ Verified to fail before it was committed: a new `export function Probe()` in plate/Marks.jsx (not in the gallery) and
// plateState() removed from Legend — each failed, naming it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PLATE_REGISTRY, REQUIRED_STATES, LONG_TEXT, LONG_COMPANY, LONG_DRAFT } from "../client/src/plate/registry.js";
import { loadPlate } from "../test-support/renderPlate.mjs";
import { at } from "../test-support/sourceAnchors.js";

// ⛔ 47j w2-public (changed on purpose): + PublicPages.jsx / Correspondence.jsx — D197 Wave 2's new library pieces (registry entries)
const LIB_FILES = ["Shell.jsx", "Marks.jsx", "Plates.jsx", "Tickets.jsx", "Cards.jsx", "Lists.jsx", "Drawings.jsx", "explainer/Explainer.jsx", "PublicPages.jsx", "Correspondence.jsx"];
const src = (f) => fs.readFileSync(`client/src/plate/${f}`, "utf8").replace(/\r\n/g, "\n");
const exportsOf = (f) => [...src(f).matchAll(/^export function ([A-Z]\w*)/gm)].map((m) => m[1]);

/** A component's own body: from its `export function` to the next top-level function. */
function bodyOf(f, name) {
  const s = src(f);
  if (!s.includes(`export function ${name}(`)) return "";
  const i = at(s, `export function ${name}(`);
  const rest = s.slice(i + 1);
  const j = rest.search(/\n(?:export )?function /);
  return j < 0 ? rest : rest.slice(0, j);
}

test("D196 · d196EveryComponentInGallery — every exported plate component is in the gallery's register", () => {
  const inRegistry = new Set(PLATE_REGISTRY.map((e) => e.name));
  const missing = LIB_FILES.flatMap((f) => exportsOf(f).filter((n) => !inRegistry.has(n)).map((n) => `${f}: ${n}`));
  assert.deepEqual(missing, [], "add it to client/src/plate/registry.js");
  const wrongFile = PLATE_REGISTRY.filter((e) => !exportsOf(e.file).includes(e.name)).map((e) => `${e.name} → ${e.file}`);
  assert.deepEqual(wrongFile, []);
  assert.ok(PLATE_REGISTRY.length >= 40, `only ${PLATE_REGISTRY.length} entries`);
});

test("D196 R1 · d196EveryComponentHasStates — ready, loading, empty, error, and plateState() runs first", () => {
  const gaps = [];
  for (const e of PLATE_REGISTRY) {
    if (e.stateless) { assert.ok(e.stateless.length > 10, `${e.name}: say why states don't apply`); continue; }
    for (const s of REQUIRED_STATES) if (!e.states[s]) gaps.push(`${e.name}${e.variant ? `:${e.variant}` : ""} has no ${s}`);
    if (!/plateState\(/.test(bodyOf(e.file, e.name))) gaps.push(`${e.name} never calls plateState()`);
  }
  assert.deepEqual(gaps, []);
  // the state components themselves: one implementation (PlateState.jsx), no spinner
  const ps = fs.readFileSync("client/src/plate/PlateState.jsx", "utf8");
  for (const w of ["aria-busy", "NOT YET", "Try again", "NO DATA YET"]) assert.ok(ps.includes(w), w);
  assert.ok(!/spinner|spin\b/i.test(fs.readFileSync("client/src/plate/plate.css", "utf8")), "a loading state is a paper skeleton, never a spinner");
});

test("D196 R2 · d196ExtremeData — every component with data has extremes; the data reaches the report's limits", () => {
  assert.ok(LONG_TEXT.length >= 120 && LONG_COMPANY.length >= 120, `long strings ${LONG_TEXT.length} / ${LONG_COMPANY.length}`);
  assert.equal(LONG_DRAFT.length, 2000);
  const data = PLATE_REGISTRY.filter((e) => !e.stateless && !e.awaiting && !e.variant);
  const without = data.filter((e) => !e.extremes).map((e) => e.name);
  // the ones that hold no free text or count say so here, by name — a new data component must bring extremes
  const NO_FREE_TEXT = ["LitSquares", "Stamp", "StatusTag", "LabelTape", "PlateHero", "FieldNoteCard", "FactSheet", "RouteLine", "CodePlate", "Cartouche"];
  assert.deepEqual(without.filter((n) => !NO_FREE_TEXT.includes(n)), []);
  const json = JSON.stringify(PLATE_REGISTRY.map((e) => e.extremes || {}));
  for (const n of [0, 1, 412, 10000]) assert.ok(json.includes(`"value":${n}`), `the stats extremes reach ${n}`);
  assert.equal(PLATE_REGISTRY.find((e) => e.name === "Register").extremes.rows.length, 500);
  const opening = PLATE_REGISTRY.find((e) => e.name === "Opening").extremes.opening;
  assert.equal(opening.pay, null); assert.equal(opening.logo, null); assert.equal(opening.sponsors, false);
});

test("D196 R1 / R2 · d196RendersEveryState — every entry × state renders, with its state's structure", async () => {
  const P = await loadPlate();
  const bad = [];
  for (const e of PLATE_REGISTRY) {
    const C = P.LIB[e.name];
    const all = { ...e.states, ...(e.extremes ? { extremes: e.extremes } : {}) };
    for (const [s, props] of Object.entries(all)) {
      let html = "";
      try { html = P.render(C, props); } catch (err) { bad.push(`${e.name}/${s} threw ${err.message}`); continue; }
      if (s === "loading" && !/aria-busy="true"/.test(html)) bad.push(`${e.name}/loading: no aria-busy skeleton`);
      if (s === "empty" && !/NOT YET/.test(html)) bad.push(`${e.name}/empty: no "not yet" drawer`);
      if (s === "error" && !(/role="alert"/.test(html))) bad.push(`${e.name}/error: no alert`);
      if (s === "extremes" && e.name !== "LetterTile") {   // the letter tile shows an initial by design (R2: missing logos)
        const text = html.replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
        const needs = JSON.stringify(props).includes(LONG_TEXT) ? LONG_TEXT : JSON.stringify(props).includes(LONG_COMPANY) ? LONG_COMPANY : null;
        if (needs && !text.includes(needs) && !text.includes(needs.toUpperCase())) bad.push(`${e.name}/extremes: the long text was cut`);
      }
    }
  }
  assert.deepEqual(bad, []);
  // R2 specifics
  const op = P.render(P.LIB.Opening, PLATE_REGISTRY.find((e) => e.name === "Opening").extremes);
  assert.match(op, /Pay not posted/);
  assert.ok(!/FILED H-1B/.test(op), "no sponsorship data → no stamp, and nothing says no");
  assert.match(op, /class="pl-letter"[^>]*>T</, "no logo → the letter tile");
  const reg = P.render(P.LIB.Register, PLATE_REGISTRY.find((e) => e.name === "Register").extremes);
  assert.ok((reg.match(/class="pl-register__row"/g) || []).length <= 60, "500 rows render as a window, not 500 nodes");
  assert.equal((P.render(P.LIB.StatsStrip, { cells: [{ value: 10000, label: "X" }] }).match(/10,000/g) || []).length, 1);
});
