// ⭐ D196 F2 / R3 / R5 · the drawings are the canvas's, motion stops when asked, the markup is accessible.
//   d196DrawingsPorted       — client/src/plate/drawings/ is exactly what scripts/d196PortDrawings.mjs generates from the
//                              committed export (a hand edit, or a re-export not re-run, fails); every colour in a drawing
//                              is a plate token; the data-driven CompassDial at 4 of 12 renders the board's dial byte for byte;
//   d196ReducedMotionStill   — every animation class in plate/plate.css is stopped under prefers-reduced-motion (draw-on shows
//                              the finished line), and with reduced motion no drawing renders a SMIL <animate>;
//   d196OneLoopPerComponent  — no drawing carries more than one looping animation of its own kind per element group (report);
//   d196A11yMarkup           — every drawing is role="img" with an aria-label; every button has a name; no click handler on
//                              a div; Binder tabs are real tabs; the area nav has no avatar (Profile lives in the dock only).
// ⛔ Verified to fail before it was committed: a hand-edited stroke width in drawings/SurveyRoleLine.jsx, and .at-march taken
// out of the reduced-motion block — each failed.
// What these cannot see (pixels: clipping, contrast, the ≤ 2 % diff) is the browser regression run — scripts/d196Regress.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generate, OUT_DIR } from "../scripts/d196PortDrawings.mjs";
import { PLATE_REGISTRY, PORTED_DRAWINGS } from "../client/src/plate/registry.js";
import { loadPlate } from "../test-support/renderPlate.mjs";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";

test("D196 F2 · d196DrawingsPorted — the drawings are the generator's output from the committed export", () => {
  const files = generate();
  assert.equal(files.filter((f) => f.name !== "index").length, 29, "v3's 8 + v2's 15 + 47m's 6 (ProvingGround 2, DrawingsAtlas 1-4)");
  assert.deepEqual(files.filter((f) => f.name !== "index").map((f) => f.name), PORTED_DRAWINGS);
  for (const f of files) {
    const p = path.join(OUT_DIR, f.name + (f.ext || ".jsx"));
    assert.equal(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"), f.source, `${f.name} differs from the port — re-run node scripts/d196PortDrawings.mjs, never hand-edit`);
  }
});

test("D196 F2 · the data-driven compass dial draws the board's dial exactly at 4 of 12", async () => {
  const P = await loadPlate();
  const label = "Compass dial: you have 4 of their top 12 technologies on your résumé";
  assert.equal(P.render(P.LIB.CompassDial, { lit: 4, total: 12, label }), P.render(P.DRAWINGS.SurveyMatchDial, { label }));
  // and moves with its data
  assert.match(P.render(P.LIB.CompassDial, { lit: 6, total: 12 }), /<g transform="rotate\(180 64 64\)">/);
});

test("D196 R3 · d196ReducedMotionStill — every animation stops; the drawings drop their SMIL under reduced motion", async () => {
  const css = fs.readFileSync("client/src/plate/plate.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const animated = [...css.matchAll(/(\.(?:at|pl)-[\w-]+)\s*\{[^}]*\banimation\s*:/g)].map((m) => m[1]);
  const rm = css.slice(at(css, "@media (prefers-reduced-motion: reduce)"));
  const block = rm.slice(0, at(rm, "\n}") + 2);
  const notStopped = [...new Set(animated)].filter((c) => !block.includes(c));
  assert.deepEqual(notStopped, [], "an animation that keeps running under reduced motion");
  assert.match(block, /\.at-draw\s*\{\s*animation:\s*none;\s*stroke-dashoffset:\s*0;/, "draw-on shows the finished line");
  const Pm = await loadPlate();
  const Prm = await loadPlate({ reducedMotion: true });
  let withMotion = 0;
  for (const n of PORTED_DRAWINGS) {
    withMotion += (Pm.render(Pm.DRAWINGS[n], {}).match(/<animate\b/g) || []).length;
    assert.equal((Prm.render(Prm.DRAWINGS[n], {}).match(/<animate\b/g) || []).length, 0, `${n} animates under reduced motion`);
  }
  assert.ok(withMotion >= 1, "the scan saw no <animate> at all — a broken scan");
});

test("D196 · d196OneLoopPerComponent — each drawing keeps the board's one live detail (no extra loops added in the port)", () => {
  for (const n of PORTED_DRAWINGS) {
    const s = fs.readFileSync(path.join(OUT_DIR, `${n}.jsx`), "utf8");
    const loops = (s.match(/repeatCount="indefinite"/g) || []).length + (s.match(/className="at-(?:march|tick|bob\d)"/g) || []).length;
    assert.ok(loops <= 3, `${n} has ${loops} looping animations`);
  }
});

test("D196 R5 · d196A11yMarkup — drawings labelled, buttons named, real tabs, no avatar in an area nav", async () => {
  const P = await loadPlate();
  const bad = [];
  const htmlOf = [];
  for (const e of PLATE_REGISTRY) for (const [s, props] of Object.entries(e.states)) htmlOf.push([`${e.name}/${s}`, P.render(P.LIB[e.name], props)]);
  for (const n of PORTED_DRAWINGS) htmlOf.push([n, P.render(P.DRAWINGS[n], {})]);
  for (const [where, html] of htmlOf) {
    for (const m of html.matchAll(/<svg\b[^>]*>/g)) {
      const tag = m[0];
      if (/aria-hidden="true"/.test(tag)) continue;
      if (!/role="img"/.test(tag) || !/aria-label="[^"]+"/.test(tag)) bad.push(`${where}: an svg without role=img + aria-label`);
    }
    for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const named = /aria-label="[^"]+"/.test(m[1]) || m[2].replace(/<[^>]+>/g, "").trim().length > 0;
      if (!named) bad.push(`${where}: a button with no name`);
    }
    if (/<div[^>]*onclick/i.test(html)) bad.push(`${where}: a click on a div`);
  }
  assert.deepEqual(bad, []);
  const tabs = P.render(P.LIB.BinderTabs, PLATE_REGISTRY.find((e) => e.name === "BinderTabs").states.ready);
  assert.match(tabs, /role="tablist"/); assert.equal((tabs.match(/role="tab"/g) || []).length, 3); assert.match(tabs, /aria-selected="true"/); assert.match(tabs, /role="tabpanel"/);
  for (const v of ["market", "ledger", "atlas"]) {
    const nav = P.render(P.LIB.AreaNav, PLATE_REGISTRY.find((e) => e.name === "AreaNav" && e.variant === v).states.ready);
    assert.ok(!/pl-avatar/.test(nav), `the ${v} area nav repeats an avatar`);
    assert.match(nav, /Ctrl K/); assert.match(nav, /class="pl-ruler"/);
  }
  // the market has no area pill; the ledger and Atlas do
  assert.ok(!/pl-areanav__pill/.test(P.render(P.LIB.AreaNav, PLATE_REGISTRY.find((e) => e.variant === "market").states.ready)));
  assert.match(P.render(P.LIB.AreaNav, PLATE_REGISTRY.find((e) => e.variant === "ledger").states.ready), /LEDGER<\/span><span class="pl-areanav__pillname">Week 47/);
  // the dock: /d, then the caller's items in order, the rule, Ask draft; one aria-current
  const dock = P.render(P.LIB.Dock, PLATE_REGISTRY.find((e) => e.name === "Dock" && !e.variant).states.ready);
  assert.deepEqual([...dock.matchAll(/data-dock-item="([\w-]+)"/g)].map((m) => m[1]), ["auto-apply", "atlas", "interview", "network", "profile", "ask"]);
  assert.equal((dock.match(/aria-current="page"/g) || []).length, 1);
  assert.match(dock, /9\+/, "a badge over 9 reads 9+");
});
