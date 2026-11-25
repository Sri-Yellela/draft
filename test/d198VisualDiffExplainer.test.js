// ⭐ D198 E1 · THE EXPLAINER'S F5 GATE, in the browser tier: each of the pilot's ten beats, drawn by the engine
// (client/src/plate/explainer/Explainer.jsx with content/explainers/big-o-acted-out/script.json), against the same beat
// pressed on canvas v4's *Explainer · Big O, acted out* (docs/sketches/Atlas plate system v4.html) — ≤ 2 % at 405 × 720.
// The board scales its inner frame by 1.12 into its column; the run takes the scale off, so both sides are the frame at its
// own size (scripts/d196Regress.mjs, the xp-beat-N pairs). One mask: where it runs, the board's template "[N]" against the
// market's count the build draws (it never draws "[N]").
// First measured 11-25 (47h): beat 1 read 6.37 % (the frame a sub-pixel off the board's — a 1.5 px border draws 1 px — then
// the library's dashed "ahead" squares), beat 9 read 6.90 % (the answers border-box, the board's content-box); after the
// fixes every beat 0.09–0.40 %.
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../services/browserLauncher.js";
import { PAIRS, runPair, THRESHOLD_PCT, LAUNCH_ARGS } from "../scripts/d196Regress.mjs";

test("⛔ d198VisualDiffExplainer · every beat of the pilot is within 2 % of canvas v4's frame", { timeout: 600000 }, async () => {
  const beats = Object.keys(PAIRS).filter((n) => n.startsWith("xp-beat-"));
  assert.equal(beats.length, 10, "ten beats, ten pairs");
  const browser = await launchBrowser({ headless: "new", extraArgs: LAUNCH_ARGS });
  const results = [];
  try { for (const name of beats) results.push(await runPair(name, { browser })); } finally { await browser.close(); }
  const failing = results.filter((r) => !r.pass).map((r) => `${r.pair}: ${r.pct} % (board ${r.sizeBoard.join("×")}, build ${r.sizeBuild.join("×")}) — see tmp/d196-regress/${r.pair}/pair.png`);
  assert.deepEqual(failing, [], `over ${THRESHOLD_PCT} % or a different size — fix the engine, never the threshold`);
});
