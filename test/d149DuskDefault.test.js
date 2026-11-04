// ⭐ D149 (owner 11-03) · RULE 1 — DUSK IS THE DEFAULT, for every user and every surface; the old themes stay selectable;
// both faces self-hosted. And RULE 2's token half: Dusk's values are theme-dusk-v2.html's, verbatim, except where the
// repository's AA contract moves one the smallest step (each such move is written beside its token).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const REG = await import("../client/src/themes/index.js");
const { resolve, prePaintScript, THEME_LIST, DEFAULT_PREFERENCE, DEFAULT_THEME_ID, themePreference, surfacePreference } = REG;
const mm = (dark) => () => ({ matches: dark });
const mem = (v) => ({ getItem: () => v, setItem: () => {} });

test("d149DuskDefaultAllSurfaces · nothing stored → Dusk, following the device, on the app, the admin and the public pages", () => {
  assert.equal(DEFAULT_PREFERENCE, "dusk");
  assert.equal(DEFAULT_THEME_ID, "dusk-dark");
  assert.equal(themePreference(mem(null)), "dusk");
  for (const surface of ["app", "admin"]) assert.equal(surfacePreference(surface, mem(null)), "dusk", surface);
  assert.equal(resolve("dusk", mm(true)).id, "dusk-dark");
  assert.equal(resolve("dusk", mm(false)).id, "dusk-light");
  // The pre-paint script (inlined into index.html at build, before first paint) defaults the same way — no flash of Paper.
  const run = (stored, dark, pathname = "/") => {
    const attrs = {}, style = {};
    const g = { localStorage: { getItem: () => stored }, location: { pathname },
      window: { matchMedia: () => ({ matches: dark }) },
      document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: { setProperty: (k, v) => { style[k] = v; } } } } };
    new Function("localStorage", "location", "window", "document", prePaintScript())(g.localStorage, g.location, g.window, g.document);
    return attrs["data-theme"];
  };
  assert.equal(run(null, true), "dusk-dark");
  assert.equal(run(null, false), "dusk-light");
  assert.equal(run(null, true, "/admin"), "dusk-dark", "the admin surface too");
  assert.equal(run(null, true, "/atlas"), "dusk-dark", "a public page too");
});

test("d149OldThemesSelectable · an explicit choice is kept, and every old theme is still offered", () => {
  assert.equal(resolve("paper-light", mm(true)).id, "paper-light");
  assert.equal(resolve("system", mm(true)).id, "charcoal-dark", "\"follow my device with Paper / Charcoal\" stays a choice");
  assert.equal(resolve("contrast", mm(false)).id, "contrast-light");
  for (const id of ["paper-light", "charcoal-dark", "contrast-light", "contrast-dark", "dusk-light", "dusk-dark"]) {
    assert.ok(THEME_LIST.some(t => t.id === id), `${id} is in the registry`);
  }
  const s = read("client/src/components/AppearanceSettings.jsx");
  assert.match(s, /const duskOn = true;/, "Dusk is always offered (its admin switch no longer gates it)");
  assert.match(s, /items=\{THEME_LIST\.map\(/, "the cards come from the whole registry");
});

test("d149FontsSelfHosted · Inter Tight (400–700) and Instrument Serif, self-hosted; nothing from Google Fonts", () => {
  const main = read("client/src/main.jsx");
  for (const w of [400, 500, 600, 700]) assert.match(main, new RegExp(`import "@fontsource/inter-tight/${w}\\.css";`));
  assert.match(main, /import "@fontsource\/instrument-serif\/400\.css";/);
  // A tag or an @import reaching Google Fonts — not the comment that records why they were removed.
  const code = (f) => read(f).replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const f of ["client/index.html", "client/src/index.css"]) assert.doesNotMatch(code(f), /fonts\.googleapis\.com|fonts\.gstatic\.com/, f);
  const shapes = read("client/src/themes/shapes.js");
  assert.match(shapes, /"dusk-dark": Object\.freeze\(\{[^}]*FONT_UI: "'Inter Tight'/);
  assert.match(read("client/src/index.css"), /--font-display: 'Instrument Serif', serif;/);
});

test("d149DuskTokensAreTheSketch · theme-dusk-v2.html's values, verbatim, unless AA moved one (and then it says so)", async () => {
  const dark = (await import("../client/src/themes/dusk-dark.js")).default.tokens;
  const light = (await import("../client/src/themes/dusk-light.js")).default.tokens;
  const sketch = read("docs/sketches/theme-dusk-v2.html");
  for (const v of ["#1B1B1B", "#262626", "#2E2E2E", "#343434", "#FFFFFF", "#A3A3A3", "#FBD3C4", "#F2C2B2"]) assert.ok(sketch.includes(v), `${v} is the sketch's`);
  assert.deepEqual([dark.CANVAS, dark.SURFACE_SOLID, dark.BORDER, dark.INK, dark.INK_MUTED, dark.ACCENT, dark.ACCENT_HOVER, dark.ON_ACCENT],
    ["#1B1B1B", "#262626", "#343434", "#FFFFFF", "#A3A3A3", "#FBD3C4", "#F2C2B2", "#1B1B1B"]);
  assert.deepEqual([dark.FH_SURFACE, dark.FH_WELL, dark.FH_LINE, dark.PAIR_SURFACE, dark.PP_ATS_NUMBER], ["#262626", "#2E2E2E", "#343434", "#262626", "#FBD3C4"],
    "Full House and the posting are drawn as the card, as the sketches draw them");
  assert.deepEqual([light.CANVAS, light.SURFACE_SOLID, light.BORDER, light.INK, light.INK_MUTED], ["#F7F3F0", "#FFFFFF", "#E6DED8", "#1B1B1B", "#55504C"]);
  // Every value AA moved names the sketch's beside it.
  const file = read("client/src/themes/dusk-dark.js") + read("client/src/themes/dusk-light.js");
  const moved = [...file.matchAll(/^\s+(\w+):\s+"([^"]+)",\s+\/\/.*the sketch's (#[0-9A-F]{6}), moved the smallest step that holds AA/gm)];
  assert.ok(moved.length >= 1);
  for (const [, k, now, was] of moved) assert.notEqual(now, was, k);
  assert.match(file, /INK_FAINT:\s+"#959595",\s+\/\/ theme-dusk-v2\.html \(D149\); the sketch's #7A7A7A/, "dark's muted grey, the one dark move");
});
