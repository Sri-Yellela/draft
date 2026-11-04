// A CONTEXT THAT LOOKS LIVE AND CAN NEVER FIRE.
//
// AppScrollContext published `progress` (0-1), and six things were keyed to it. Its only writer was
// JobsPanel's PullToRefresh `onScroll`, on that component's own inner container — and nothing ever
// scrolls that container. Measured on the running app: the WINDOW is what scrolls, no element has
// `overflowY: auto|scroll` with content taller than its client box, and forcing every candidate
// container's scrollTop to 900 changed nothing. `update()` therefore never fired and `progress` was
// permanently 0, for the whole life of the code.
//
// So none of these six had ever run, in any session:
//
//     the bar's width/radius/top-offset collapse      pillWidth = vw - p * (vw - 400)
//     its glass gradient                              pillBg, over p
//     its accent border                               borderColor, over p
//     its drop shadow                                 shadow, over p
//     both of its dividers                            {scrolled && <Divider/>}, twice
//     the logo's "esume Master" collapse              textMaxW / textOpacity
//     JobsPanel's toolbar guard                       {scrollProgress < 0.5 && ...}  (always true)
//
// Y4 found this and deliberately did NOT fix it: the live consumer was the logo's `progress`, and Y1
// forbade altering the logo, so removing it meant changing the logo's signature. It reported the
// finding and recommended its own pass. This is that pass, and the removal was confirmed with the
// owner first.
//
// WHY REMOVAL RATHER THAN A REAL WRITER: the collapse targets a 400px bar, and Y4 moved the app's
// primary navigation INTO the bar. Measured, the tab row alone is 498px, plus the mark at ~183px and
// the avatar — about 717px of content with nowhere to go. There is no collapsed layout to collapse
// into, so wiring progress to the window scroll would have broken the bar Y4 just built.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { LEGACY_BRAND } from "../shared/brand.js";

const read = (p) => fs.readFileSync(p, "utf8");
const code = (src) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

const ctx = read("client/src/contexts/AppScrollContext.jsx");
const topBar = read("client/src/components/TopBar.jsx");
const jobs = read("client/src/panels/JobsPanel.jsx");
const ctxCode = code(ctx), topBarCode = code(topBar), jobsCode = code(jobs);

test("the context publishes scrollToTopRef and nothing else", () => {
  // Read off the provider's actual value object, so adding a member back fails here.
  const value = ctxCode.slice(at(ctxCode, "value={{"), at(ctxCode, "}}>"));
  assert.match(value, /scrollToTopRef/);
  for (const gone of ["progress", "update", "pinned", "pin", "unpin"]) {
    assert.ok(!new RegExp(`\\b${gone}\\b`).test(value),
      `AppScrollContext publishes \`${gone}\` again — it needs a writer that can fire first`);
  }
  // And the state that backed them.
  assert.ok(!/useState/.test(ctxCode), "the context holds state again; it should hold only a ref");
  assert.ok(!/setProgress|setPinned/.test(ctxCode));
});

test("the top bar no longer reads the context at all", () => {
  assert.ok(!/useAppScroll/.test(topBarCode),
    "TopBar reads AppScrollContext again — there is nothing in it for the bar");
  for (const gone of ["rawProgress", "const scrolled", "pillWidth", "pillBg",
                      "effectiveBlur", "const borderColor", "const topOffset", "const radius"]) {
    assert.ok(!topBarCode.includes(gone), `TopBar still has \`${gone}\``);
  }
});

test("the bar's geometry is the constants it always rendered, not an interpolation", () => {
  // Every one of these is the p=0 end of the interpolation that used to produce it, i.e. what users
  // have always actually seen. If any becomes a variable again it needs a live progress first.
  // The end anchor used to be guarded by `topBarCode.indexOf("Left group") >= 0`, and that guard
  // could never be true: "Left group" exists only inside a JSX comment, and `code()` above strips
  // JSX comments before any of this runs. So the ternary always took its fallback and sliced to the
  // END OF THE FILE — 2571 characters where 608 were meant, 4.2x too wide. Nothing failed, because
  // the assertions below are all `match` and the strings they look for were still inside the larger
  // region. A wider slice only fails if it happens to contain a counter-example; the rest of the
  // time it silently stops testing what it names.
  const style = topBarCode.slice(
    at(topBarCode, 'data-app-chrome=""'),
    at(topBarCode, '<div className="tbar-group">'),   // D92: the left group's look moved to TopBar.css
  );
  assert.match(style, /top: 0,/);
  assert.match(style, /width: vw,/);
  assert.match(style, /borderRadius: 0,/);
  // 10-01, on the owner's call: the bar is no longer transparent (a long expanded deck card scrolled
  // through its labels). It is still CONSTANTS — a token background and a literal blur — which is
  // what this test exists for; it was the p=0 transparent end of the dead interpolation until then.
  // ⭐ D149 (owner 11-03) changed this on purpose: the sketches have NO top bar — the band, its border and its blur are
  // gone; the strip is a transparent, click-through layer (the mark and the Menu button take the pointer, TopBar.css).
  // Still CONSTANTS, which is what this test exists for.
  assert.match(style, /background: "transparent",/);
  assert.match(style, /border: "none",/);
  assert.match(style, /pointerEvents: "none",/);
  assert.match(style, /boxShadow: "none",/);
  assert.ok(!/backdropFilter|borderBottom/.test(style), "the bar's band is back");
  assert.ok(!/blur\(\$\{/.test(style), "the blur is interpolated again");
});

test("both dividers and the Divider component are gone", () => {
  assert.ok(!/<Divider\b/.test(topBarCode), "a divider is rendered again");
  assert.ok(!/function Divider\b/.test(topBarCode), "the Divider component is back with no caller");
});

test("the app bar's mark takes no progress and does not interpolate", () => {
  // The collapse was driven by AppScrollContext's `progress`, which was permanently 0, so the
  // animation never ran in any session. The prop and the interpolated values are gone from the
  // APP bar; the machinery still exists in the shared component for the marketing surfaces, which
  // do drive it.
  assert.match(topBarCode, /function AnimatedLucyLogo\(\)/, "AnimatedLucyLogo took a prop again");
  assert.ok(!/AnimatedLucyLogo\s+progress=/.test(topBarCode));

  const logo = topBarCode.slice(at(topBarCode, "function AnimatedLucyLogo"),
                                at(topBarCode, "function useNotifications"));
  assert.ok(!/textMaxW|textOpacity/.test(logo));
  assert.ok(!/progress=/.test(logo),
    "the app bar is driving the collapse again — it needs a live scroll progress first");

  // ⛔ THIS TEST USED TO PIN THE LEGACY NAME, WHICH IS HOW THE OLD MARK SURVIVED P4.
  //
  // It read `assert.match(logo, /<the old tail>/, "the wordmark must still render in full")` — a
  // literal, because the mark was drawn here across two spans so the tail could collapse. The
  // rebrand guard could not see a name split that way either, so between them the app nav showed
  // the OLD brand on production for days after the sweep was declared complete, with this suite
  // green. Found on 2026-09-26 by screenshotting the real board.
  //
  // The mark is now ONE component and this file no longer draws it, so the honest assertion is
  // that the app bar renders the shared one — not that it contains any particular string.
  assert.match(logo, /<StampLogo\b/,
    "the app bar must render the shared mark rather than drawing its own");
  assert.ok(!new RegExp(LEGACY_BRAND.slice(1)).test(topBarCode),
    "the legacy name must not be spelled as a literal anywhere in the top bar again");
});

test("JobsPanel keeps only the scroll-to-top ref, and its toolbar guard is gone", () => {
  assert.ok(!/updateScroll/.test(jobsCode), "the onScroll writer is back");
  assert.ok(!/scrollProgress/.test(jobsCode), "the toolbar guard is back; it was always true");
  assert.ok(!/pinDock/.test(jobsCode), "pin() is called again; nothing reads `pinned`");
  // The one surviving member, and both of its uses.
  assert.match(jobsCode, /const \{ scrollToTopRef \} = useAppScroll\(\)/);
  assert.match(jobsCode, /scrollToTopRef\.current\?\.\(\)/);
});

test("nothing else in the client reads a scroll progress from this context", () => {
  // The generality guard: a seventh consumer added later would be reading a member that no longer
  // exists, which is a silent `undefined` rather than an error.
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = `${d}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (/\.jsx?$/.test(e.name)) files.push(f);
    }
  })("client/src");

  for (const f of files) {
    const src = code(read(f));
    if (!/useAppScroll/.test(src)) continue;
    const destructures = src.match(/const \{[^}]*\} = useAppScroll\(\)/g) || [];
    for (const d of destructures) {
      for (const gone of ["progress", "update", "pinned", "pin", "unpin"]) {
        assert.ok(!new RegExp(`\\b${gone}\\b`).test(d),
          `${f} destructures \`${gone}\` from useAppScroll, which no longer provides it: ${d}`);
      }
    }
  }
});
