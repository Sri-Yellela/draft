// ⭐ D149 RULE 3 · THE COMPUTED STYLES — the Auto-apply settings drawer (docs/sketches/settings-declutter.html, D148's
// screen). The app opened in a real Chrome (stubbed /api, synthetic data, Dusk Dark, 1280 × 800 and 390 × 844), the
// drawer opened (Draft House → Settings), then When, How many, Which jobs, Before sending and Pausing opened in turn —
// and the computed values asserted against the sketch's. The side-by-sides are scripts/fidelityShots.mjs settings.
// Skips (with its reason) on a machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const probe = (screen) => JSON.parse(execFileSync(process.execPath, ["scripts/fidelityShots.mjs", "--styles", screen],
  { encoding: "utf8", timeout: 180000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());

const CARD = "rgb(38, 38, 38)", ACCENT = "rgb(251, 211, 196)", ON_ACCENT = "rgb(27, 27, 27)", BODY = "rgb(163, 163, 163)";
// Dusk's tokens for the sketch's --raise #2F2F2F and --line #363636 (no exact token; the nearest, one / two steps).
const RAISE = "rgba(46, 46, 46, 0.96)", LINE = "rgb(52, 52, 52)";
// The sketch's --muted #777 is Dusk's --c-ink-faint, moved to #959595 to hold AA (D149 step 1).
const MUTED = "rgb(149, 149, 149)";

test("fidelity · the settings drawer (settings-declutter.html): drawer, title, mode, folds, rows, switch, Done", { timeout: 200000 }, (t) => {
  const out = probe("settings");
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const [size, d] of Object.entries(out)) {
    // .drawer
    assert.equal(d.drawer.bg, "rgba(38, 38, 38, 0.98)", `${size}: the drawer is the sketch's rgba(38,38,38,.98)`);
    assert.equal(d.drawer.radius, "0px", `${size}: no rounded corner`);
    assert.equal(d.drawer.shadow, "none", `${size}: no shadow`);
    assert.equal(d.drawer.borderLeft, `1px ${LINE}`, `${size}: the 1px rule on its left`);
    assert.equal(d.drawer.padding, "26px 24px 30px");
    assert.match(d.drawer.family, /^"Inter Tight"/);
    assert.deepEqual([d.drawer.size, d.drawer.lineHeight], ["16px", "24.8px"], `${size}: 16px / 1.55`);
    assert.equal(d.footer, false, `${size}: no footer — Close closes`);
    assert.equal(d.checkboxes, 0, `${size}: no platform checkboxes or radios — the sketch's own switches`);
    // .dh
    assert.match(d.title.family, /^"Instrument Serif"/);
    assert.deepEqual([d.title.size, d.title.weight], ["34px", "400"]);
    assert.deepEqual([d.close.bg, d.close.radius, d.close.border, d.close.size, d.close.weight, d.close.padding],
      [CARD, "12px", `1px ${LINE}`, "13px", "600", "7px 13px"]);
    // .mode
    assert.deepEqual([d.mode.bg, d.mode.radius, d.mode.padding, d.mode.border], [CARD, "16px", "14px 16px", "0px"], `${size}: the mode buttons`);
    assert.match(d.mode.pressedOutline, new RegExp(`solid ${ACCENT.replace(/[()]/g, "\\$&")}$`), `${size}: the current one outlined in the accent`);
    assert.equal(d.mode.restOutline, "none");
    assert.deepEqual([d.mode.bSize, d.mode.bWeight, d.mode.bPressed, d.mode.bRest], ["15.5px", "600", ACCENT, "rgb(255, 255, 255)"]);
    assert.deepEqual([d.mode.spanSize, d.mode.spanColor], ["13px", MUTED]);
    // .gq / .top
    assert.deepEqual([d.fold.bg, d.fold.radius, d.fold.border, d.fold.marginTop, d.fold.padding], [CARD, "20px", "0px", "10px", "15px 18px"], `${size}: a fold's line`);
    assert.deepEqual([d.fold.bSize, d.fold.bWeight, d.fold.valueColor, d.fold.valueSize], ["15px", "600", BODY, "14px"]);
    // .detail
    assert.equal(d.limits, "Today: 4 sent of 10. Details");
    // .body, .times
    assert.equal(d.when.bodyPadding, "20px 18px");
    assert.deepEqual([d.when.chipBg, d.when.chipRadius, d.when.chipPadding, d.when.chipWeight], [RAISE, "12px", "9px 14px", "600"]);
    assert.deepEqual([d.when.addBorder, d.when.addRadius], ["1px dashed", "12px"], `${size}: "Add a time" is the dashed button`);
    // .stepper
    assert.deepEqual([d.howmany.btn, d.howmany.btnRadius, d.howmany.btnBg], [{ w: 44, h: 44 }, "14px", RAISE]);
    assert.deepEqual([d.howmany.nSize, d.howmany.nWeight, d.howmany.nColor], ["44px", "500", ACCENT]);
    // .eyebrow, h3, .tg
    // D182 (45n, owner 11-08 decision (8), changed on purpose): the accent eyebrow repeated the fold's own title — removed.
    assert.equal(d.jobs.eyebrow, false, `${size}: no eyebrow restating the title`);
    assert.match(d.jobs.hFamily, /^"Inter Tight"/, `${size}: the headline in the interface face, not the serif`);
    assert.deepEqual([d.jobs.hSize, d.jobs.hWeight, d.jobs.hLetter, d.jobs.hLine], ["30px", "500", "-0.9px", "32.4px"], `${size}: 500 30px/1.08, -.03em`);
    assert.deepEqual([d.jobs.rowPadding, d.jobs.rowBorder, d.jobs.smallColor, d.jobs.smallSize], ["12px 0px", `1px ${LINE}`, MUTED, "13px"]);
    // .sw — a real switch; the sketch's 46 × 28 and knob; corners 8 (the sketch's 14 is a capsule — D60)
    const on = d.jobs.switchOn;
    assert.deepEqual([on.tag, on.role, on.box], ["BUTTON", "switch", { w: 46, h: 28 }]);
    assert.equal(on.radius, "8px", "D60: 8 on 28, not the sketch's capsule 14");
    assert.deepEqual([on.bg, on.knobBg, on.knobLeft, on.knobSize], [ACCENT, ON_ACCENT, "22px", "20px"]);
    assert.deepEqual([d.before.switchOff.bg, d.before.switchOff.knobBg, d.before.switchOff.knobLeft], [RAISE, BODY, "4px"]);
    // .done2
    assert.deepEqual([d.jobs.done.bg, d.jobs.done.color, d.jobs.done.radius, d.jobs.done.padding, d.jobs.done.weight],
      ["linear-gradient(rgb(251, 211, 196), rgb(242, 194, 178))", ON_ACCENT, "14px", "11px 18px", "600"]);
    // .pausebtn
    assert.equal(d.pausing.width, d.pausing.parent, `${size}: Pause everything now is full width`);
    assert.deepEqual([d.pausing.border, d.pausing.bg, d.pausing.radius, d.pausing.padding], [`1px ${LINE}`, "rgba(0, 0, 0, 0)", "16px", "14px"]);
  }
  assert.equal(out.desktop.drawer.width, 520, "the sketch's min(520px, 100vw)");
  assert.equal(out.phone.drawer.width, 390, "a phone-wide drawer");
});
