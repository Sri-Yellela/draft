// ⛔ 43k · the panel's reports patch the progress record IN ARRIVAL ORDER, per tab.
// J9 (light) failed under the full suite with "Filled 0 of 3 · 3 need you" after a reload, though the person had filled
// all three: each GATE_REVIEW_STATE waited on loadPacketForTab (a fetch the first time, the cache after) before it wrote,
// so the panel's FIRST report — its "waiting" draw, 0 of 3 — could land after the last. The writes are now chained.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const src = fs.readFileSync("extension/background.js", "utf8").replace(/\r\n/g, "\n");

test("GATE_REVIEW_STATE writes the progress record through a per-tab chain, never in parallel", () => {
  const i = at(src, "if (msg?.type === 'GATE_REVIEW_STATE')");
  const block = src.slice(i, at(src, "return true;", i));
  assert.match(block, /reviewWrites\.get\(tabKey\)/, "it waits for the tab's previous write");
  assert.match(block, /prior\.then\(\(\) => loadPacketForTab\(/, "the packet lookup starts only after the previous write");
  assert.match(block, /noteReviewed\(msg/, "and the write is noteReviewed");
  assert.doesNotMatch(block, /void loadPacketForTab\(sender\.tab\?\.id\)\.then/, "no unchained write is left beside it");
  assert.match(src, /const reviewWrites = new Map\(\);/);
});
