// J9 · the integration browser pass, in a real Chrome. Its unit rules are test/j9FullPassRules.test.js (fast tier).
// ⭐ A232 R3 (46y, owner 11-19 "all four approved"): the pass runs ONE theme (dark). It used to run once per theme — 5.7 min
// for a token swap that d91ThemeModule / d91Coverage / colorLiteralGuard pin for every theme, and whose one walk-side
// check (the dock's frame on SURFACE_MENU) j9FullPassRules pins for both schemes. j4PanelBrowser walks light, so the
// browser tier still walks each scheme once.
//
// The full pass (test-support/walks/fullPass.mjs): capture on the owner's apply URL → bound → read → prepare → fill →
// the review panel → acknowledge a guess and type a needed answer → the popup remembers → reload → a résumé generated
// and attached → the Copy sheet → a new fill reuses every remembered answer; then the plain fake-ATS form. It found:
//
//   1. An ACKNOWLEDGED guess was asked again on the next fill. The packet still carries the profile's guess for that
//      question (Postal Code, by a whole-token label match on `postal`), the guess took the control first, and the
//      candidate's own acknowledged answer — waiting behind it — never got the field. D96 §4: "tick once and it is
//      remembered; it is not asked again." Fixed: a guess yields its control to the candidate's own stated answer for
//      the same question (extension/savedAnswerMatch.js yieldGuessesToStated, used by the fill's every step).
//   2. The Copy sheet listed the same question twice — the guess, labelled "profile", and the acknowledged answer. A
//      guess was never the profile's answer. Fixed: the server drops a packet answer whose question has an answer of
//      the candidate's own (services/manualHandoff.js copySheetRows), and a guess left on the sheet says "matched
//      loosely" (extension/copy-sheet-panel.js), the review panel's own word for it.
// Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { runScenario } from "../test-support/walkExtension.mjs";

// ── the pass itself ─────────────────────────────────────────────────────────────────────────────────────────────────
const chrome = await findChrome();
for (const theme of ["dark"]) {   // A232 R3: one theme (see the header)
  test(`⛔ J9 full pass (${theme}): capture → bound → read → fill → panel → acknowledge / type → the popup remembers → reload → résumé → attach → Copy sheet → the next fill reuses it; the plain form`, { skip: chrome.skip || false, timeout: 600000 }, async () => {
    const lines = [];
    const r = await runScenario("fullPass", { theme, log: (l) => lines.push(l) });
    if (r.skipped) return;
    assert.equal(r.failures, 0, lines.filter(l => /^FAIL/.test(l)).join("\n") || lines.slice(-20).join("\n"));
  });
}
