// ⭐ D112 b2 · the ONE global-read ask in a REAL Chrome (test-support/walks/globalAsk.mjs): a real press opens a small
// popup window over the posting; Not now raises no prompt, the window closes by itself, the posting tab has the focus
// again, and the next press asks nothing (asked ONCE). Covers d112bWindowClosesOnAnswer · d112bFocusReturnsToPosting ·
// d112bNotNowNoPrompt · d112PermissionAskedOnce for the Not-now path; Allow's half (Chrome's own prompt, which no headless
// browser can answer) is test/d112GlobalRead.test.js. SKIPS, with its reason, on a machine with no Chrome.
import test from "node:test";
import assert from "node:assert/strict";

const { findChrome } = await import("../test-support/extensionBrowser.mjs");
const chromeFound = await findChrome();
test("⭐ D112 b2 · the ask window on the REAL extension — opened by the press, Not now closes it and gives the posting the focus, asked once", { skip: chromeFound.skip || false, timeout: 300000 }, async () => {
  const { runScenario } = await import("../test-support/walkExtension.mjs");
  const lines = [];
  const r = await runScenario("globalAsk", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL") || l.startsWith("OBSERVED")).join("\n"));
});
