// D91 P4 · SHAPE CUES — a glyph and an edge style on every status mark, a fill style on every fit band, a
// pattern on every chart segment; a USER setting for any theme, implemented ONCE in the shared components.
//
// docs/THEME_MODULE.md §5 and §9: "shape cues change no layout (no reflow) and add a glyph and edge style to
// every mark". Orange and amber are close (§10) — this is the mitigation, so it must cover the hue-only
// places docs/THEME_AUDIT.md §5 found, not only the components that were already shared.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { C } = await import("../client/src/styles/colorTokens.js");
const { markStyle, bandMarkStyle, statusCue } = await import("../client/src/styles/mark.js");
const { bandChipStyle } = await import("../client/src/styles/bandStyle.js");
const { ATS_BAND } = await import("../shared/atsBands.js");
const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const CSS = read("client/src/styles/cues.css");

test("every status mark carries its glyph and edge: ✓ solid · ! dashed · ✕ double · i dotted", () => {
  const cue = (s) => [s["--mark-glyph"], s["--mark-edge"]];
  assert.deepEqual(cue(markStyle(C.SUCCESS)), ['"✓"', "solid"]);
  assert.deepEqual(cue(markStyle(C.WARNING)), ['"!"', "dashed"]);
  assert.deepEqual(cue(markStyle(C.DANGER)), ['"✕"', "double"]);
  assert.deepEqual(cue(markStyle(C.INFO)), ['"i"', "dotted"]);
  assert.deepEqual(cue(bandMarkStyle(ATS_BAND.STRONG)), ['"✓"', "solid"]);
  assert.deepEqual(cue(bandMarkStyle(ATS_BAND.MODERATE)), ['"!"', "dashed"]);
  assert.deepEqual(cue(bandMarkStyle(ATS_BAND.WEAK)), ['"✕"', "double"]);
  assert.deepEqual(cue(bandMarkStyle(ATS_BAND.NOT_ENOUGH_SIGNAL)), ['"i"', "dotted"]);
  // A tag that is not a status (the accent, a muted tag) has no glyph — a cue must mean something.
  assert.equal(markStyle(C.ACCENT_INK)["--mark-glyph"], undefined);
  // An explicit kind wins over the colour.
  assert.deepEqual(cue(markStyle(C.INK_FAINT, { kind: "bad" })), ['"✕"', "double"]);
  assert.equal(statusCue("nope"), null);
  // The glyph is positioned inside the mark's own padding, so the mark is positioned.
  assert.equal(markStyle(C.SUCCESS).position, "relative");
});

test("every fit band chip carries its fill style: filled · hatched · outlined · dashed", () => {
  const s = (b) => bandChipStyle(b);
  assert.equal(s(ATS_BAND.STRONG)["--band-fill"], "none");
  assert.equal(s(ATS_BAND.STRONG)["--band-edge"], "solid");
  assert.match(s(ATS_BAND.MODERATE)["--band-fill"], /^repeating-linear-gradient\(/);
  assert.equal(s(ATS_BAND.WEAK)["--band-bg"], "transparent");
  assert.equal(s(ATS_BAND.WEAK)["--band-edge"], "solid");
  assert.equal(s(ATS_BAND.NOT_ENOUGH_SIGNAL)["--band-edge"], "dashed");
});

test("⛔ cues change NO layout: no rule under data-cues touches a box's size; every glyph is absolutely placed", () => {
  const rules = [...CSS.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, sel, body]) => ({ sel: sel.trim(), body })).filter(r => r.sel.includes('data-cues="shape"'));
  assert.ok(rules.length >= 15, `only ${rules.length} cue rules`);
  const SIZE = /(^|;)\s*(width|height|min-width|min-height|padding[a-z-]*|margin[a-z-]*|border(-left|-right|-top|-bottom)?-width|font-size|line-height|display|letter-spacing)\s*:/;
  for (const r of rules) {
    if (/::before\s*$/.test(r.sel) || /::before\s*$/.test(r.sel.split(",").pop())) {
      if (/content:/.test(r.body) && !/position:/.test(r.body)) {
        // a content-only rule: its box is set by the positioned ::before rule for the same marks
        continue;
      }
      if (/position:/.test(r.body)) assert.match(r.body, /position:\s*absolute/, `${r.sel}: a glyph in the flow reflows the mark`);
      continue;
    }
    assert.doesNotMatch(r.body, SIZE, `${r.sel} changes a box's size`);
  }
});

test("the setting reaches the page: <html data-cues=\"shape\">, from the one stored preference; cues.css is loaded", () => {
  const reg = read("client/src/themes/index.js");
  assert.match(reg, /if \(CUES\) d\.cues = "shape"; else delete d\.cues;/);
  assert.match(reg, /export const CUES = appearance\(\)\.cues;/);
  assert.match(read("client/src/main.jsx"), /import "\.\/styles\/cues\.css";/);
});

test("⛔ the hue-only places the audit found (§5) all have a cue", () => {
  for (const sel of [".dh-item[data-tone=\"danger\"]", ".dh-item[data-tone=\"warning\"]", ".dh-item[data-tone=\"info\"]",
    ".dh-bar[data-held=\"true\"]", ".rc__cell--del", ".rc__cell--rew", ".ats-bar__seg--missing", ".ats-bar__seg--generic",
    ".ah__fseg[data-seg=\"rejected\"]", "[style*=\"--dot-glyph\"]"]) {
    assert.ok(CSS.includes(sel), `no cue for ${sel}`);
  }
  // Draft House's protective / blocking dots: a glyph each, not only amber against red.
  const sections = read("client/src/panels/AutoApplyPanelSections.jsx");
  assert.equal((sections.match(/dotCue\(item\.protective|dotCue\(r\.protective/g) || []).length, 2);
  // The Table's reply outcome: a tone mapped to tokens, never the old raw hex.
  const table = read("client/src/panels/DatabasePanel.jsx");
  assert.match(table, /RESPONSE_TONE_COLOUR\[/);
  assert.doesNotMatch(read("shared/applicationResponse.js"), /#[0-9a-f]{6}/i);
});
