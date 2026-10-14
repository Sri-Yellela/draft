// D99 J13 · THE CONSENT SWITCH — "the boxes to agree to auto-read can't be ticked" (owner, 10-13).
//
// The cause, found in the code and reproduced in a real Chrome: autoRead.js's fromExtensionPage() required
// `!sender.tab`, but `options_page` opens Options IN A TAB, so Chrome sets `sender.tab` and every switch message —
// the table's state, "I agree", each switch, the kill switch, "Forget" — was refused as not_allowed. "I agree" said
// "Could not record that." and all 20 switches stayed disabled. j5AutoRead's Options sender had no `tab`, and so
// pinned the defect. The handler-level rules are in j5AutoRead.test.js; this runs the REAL Options page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("⛔ J13 · an extension page is known by its address — never by having no tab", () => {
  const src = read("extension/autoRead.js");
  const def = src.slice(src.indexOf("const fromExtensionPage"), src.indexOf(";", src.indexOf("const fromExtensionPage")));
  assert.ok(def.length > 0);
  assert.doesNotMatch(def, /!sender\??\.tab/, "Options opens in a tab");
  assert.match(def, /chrome\.runtime\.getURL\(''\)/);
  // ⛔ the permission request stays the switch handler's FIRST chrome call — inside the click's gesture
  const opt = read("extension/options-auto.js");
  const body = opt.slice(opt.indexOf("export function onSwitch"), opt.indexOf("return (async"));
  assert.match(body, /api\.permissions\.request\(/);
  assert.doesNotMatch(body, /await/);
});

const chrome = await findChrome();
test("⛔ J13 · the real Options page, in a tab: \"I agree\" is recorded and every switch can be ticked", { skip: chrome.skip || false, timeout: 300000 }, async () => {
  const lines = [];
  const r = await runScenario("optionsConsent", { log: (l) => lines.push(l) });
  if (r.skipped) return;
  assert.equal(r.failures, 0, lines.filter(l => l.startsWith("FAIL")).join("\n"));
});
