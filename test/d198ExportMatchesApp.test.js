// ⭐ D198 E4 · THE EXPORT IS THE APP (d198ExportMatchesApp, the pipeline half — the clock half is in d198ExplainerEngine):
// scripts/d198Export.mjs draws each beat's first frame with the in-app engine at 1080 × 1920, encodes them with ffmpeg
// (H.264, the 9:16 Short and the 16:9 file), decodes the Short's frame at each beat start and compares it with the engine's
// render at that time — within F5's tolerance (≤ 2 %). Browser tier: it drives a real Chrome and ffmpeg.
// First measured 11-25 (47h): every beat 0.001–0.007 %. (The two traps on the way: a piped image sequence gives its last
// frame no duration, and an output-side seek drops a frame starting before the seek time.)
import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser } from "../services/browserLauncher.js";
import { exportExplainer, ffmpegPath, CHECK_PCT, SIZE } from "../scripts/d198Export.mjs";

test("d198ExportMatchesApp (real Chrome + ffmpeg): each beat's frame in the MP4 is the engine's frame at that time", { timeout: 300000 }, async (t) => {
  if (!ffmpegPath()) { t.skip("ffmpeg is not on PATH"); return; }
  const browser = await launchBrowser({ headless: "new", extraArgs: ["--disable-lcd-text"] });   // the browser tier (testTiers: it drives Chrome)
  let r;
  try { r = await exportExplainer("big-o-acted-out", { checkOnly: true, openings: 412, browser }); } finally { await browser.close(); }
  assert.equal(r.check.length, 10, "ten beats checked");
  assert.deepEqual(r.size, [SIZE.w, SIZE.h], "the Short is 1080 × 1920");
  for (const c of r.check) {
    assert.deepEqual(c.size, [1080, 1920], `beat ${c.beat}: decoded at 1080 × 1920`);
    assert.ok(c.pct <= CHECK_PCT, `beat ${c.beat}: ${c.pct} % differ (≤ ${CHECK_PCT} %)`);
  }
  assert.equal(r.voiced, false, "check mode is silent");
});
