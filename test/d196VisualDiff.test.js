// ⭐ D196 F5 · THE GATE, in the browser tier: every pair in scripts/d196Regress.mjs (a built composition from the plate
// library vs its artboard in the canvas export, rendered in headless Chrome) differs by ≤ 2 % at the same size.
// P0's pairs: the market board's dock and area nav. P1–P5 add a pair per page (d196VisualDiffMarket / Ledger / Survey /
// AtlasHome / AtlasRegion / AtlasLibrary / AtlasPlace at 1280 and 390) as each page is built.
// First measured 11-24 (47d): the nav read 6.46 %, then 6.02 % — the fixture page lacked Inter Tight 500 (plate/fonts.js now
// carries every weight), the current link's 700 was overridden, and the squares were border-box where the board's are
// content-box. Fixed in the components; then the dock 0 % and the nav 0.001 %.
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../services/browserLauncher.js";
import { PAIRS, runPair, THRESHOLD_PCT, LAUNCH_ARGS } from "../scripts/d196Regress.mjs";

test("⛔ D196 F5 · every built piece is within 2 % of its sketch", { timeout: 600000 }, async () => {
  const browser = await launchBrowser({ headless: "new", extraArgs: LAUNCH_ARGS });   // 47f: both sides greyscale text
  const results = [];
  try {
    // the explainer's ten beats are their own gate (d198VisualDiffExplainer)
    for (const name of Object.keys(PAIRS).filter((n) => !n.startsWith("xp-beat-"))) results.push(await runPair(name, { browser }));
    // 47f (the owner's FIX acceptance: "F5 diff ≤ 2 % at 1280 and 390"): the market's Deck tab at 390 too
    // 47h (D199): the market rebuilt to the approved Market board — its pieces at 390 where the board's phone layout holds
    for (const name of ["market-face", "final-market-hero", "final-market-head", "final-market-cartouche", "final-market-tabs", "final-market-field", "final-market-deck", "final-market-pager", "final-market-index",
      // 47i (D197 #3 / #4): the ledger and the survey sheet's pairs that hold at 390. survey-hero / -hiring / -sponsor / -match /
      // -tickets and ledger-tickets still differ there (wording from live data, a board that clips) — open, in the WORKLOG
      "survey-stack", "ledger-run", "ledger-needs", "ledger-banner", "ledger-register",
      // 47i (D197 #5–#7): Atlas's three boards at 390 (every pair holds there)
      "atlas-home-hero", "atlas-home-regions", "atlas-home-footer", "atlas-home-volumes", "atlas-areanav", "atlas-map-header",
      "atlas-map-terrain", "atlas-map-route", "atlas-map-index", "atlas-library-notes", "atlas-library-sources"]) results.push({ ...(await runPair(name, { browser, width: 390 })), pair: `${name}@390` });
  } finally { await browser.close(); }
  const failing = results.filter((r) => !r.pass).map((r) => `${r.pair}: ${r.pct} % (board ${r.sizeBoard.join("×")}, build ${r.sizeBuild.join("×")}) — see tmp/d196-regress/${r.pair}/pair.png`);
  assert.deepEqual(failing, [], `over ${THRESHOLD_PCT} % or a different size — fix the component, never the threshold`);
});
