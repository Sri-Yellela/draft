// ⛔ A208 (46l, from production's log: Dropzone 11-13 21:01Z / 21:07Z — after A202 was live — two required pickers
// "[apply-held] … type=typeahead reason=fill_failed": the AI-use policy (I Agree / I Do Not Agree) and the falsification
// acknowledgement (I Acknowledge / I Do Not Acknowledge), options read from the posting's public Greenhouse API).
// Draft's answer was "Yes"; typing it into react-select filtered BOTH options away, so nothing was picked.
// A yes / no answer against a two-option pair with exactly one negation now picks by polarity. Synthetic form only.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { findChrome } from "../test-support/extensionBrowser.mjs";
import { answerPolarity, polarityOption, applyTypeaheadAnswer, discoverFields } from "../services/applyAutomation.js";
import { greenhouseStandardForm } from "../scripts/fakeAtsGreenhouseStandard.js";

test("A208: polarity picks the affirmative / negated option of a consent pair, and refuses anything else", () => {
  assert.equal(polarityOption("Yes", ["I Agree", "I Do Not Agree"]), 0);
  assert.equal(polarityOption("No", ["I Agree", "I Do Not Agree"]), 1);
  assert.equal(polarityOption("yes", ["I Do Not Acknowledge", "I Acknowledge"]), 1, "order does not matter");
  assert.equal(polarityOption("Yes", ["Select...", "I Acknowledge", "I Do Not Acknowledge"]), 1, "the placeholder is ignored");
  assert.equal(polarityOption("Yes", ["Male", "Female", "Decline To Self Identify"]), -1, "three options: never guessed");
  assert.equal(polarityOption("Yes", ["Option A", "Option B"]), -1, "no negation: never guessed");
  assert.equal(polarityOption("Yes", ["Not now", "No thanks"]), -1, "both negated: never guessed");
  assert.equal(polarityOption("Boston, MA", ["I Agree", "I Do Not Agree"]), -1, "not a yes / no answer");
  assert.equal(answerPolarity("Agree"), true);
  assert.equal(answerPolarity("No"), false);
  assert.equal(answerPolarity("Maybe"), null);
});

const chrome = await findChrome();
const SKIP = chrome.skip || false;
let shared = null;
after(async () => { const b = shared; shared = null; if (b) await (await b).close().catch(() => {}); });

test("⛔ A208 (Chrome): the fill's 'Yes' picks 'I Agree' and 'I Acknowledge' on react-select pickers, and they read back filled", { skip: SKIP, timeout: 60000 }, async (t) => {
  const puppeteer = (await import("puppeteer-core")).default;
  shared = puppeteer.launch({ executablePath: chrome.path, headless: true, pipe: true, args: ["--no-first-run"] });
  const p = await (await shared).newPage();
  t.after(() => p.close().catch(() => {}));
  await p.setContent(greenhouseStandardForm({ consent: true }));
  await applyTypeaheadAnswer(p, { field_id: "question_30007", type: "typeahead", value: "Yes", typeahead_selection: "Yes" });
  await applyTypeaheadAnswer(p, { field_id: "question_30008", type: "typeahead", value: "Yes", typeahead_selection: "Yes" });
  await applyTypeaheadAnswer(p, { field_id: "question_30005", type: "typeahead", value: "Yes", typeahead_selection: "Yes" });
  const fields = await discoverFields(p, "greenhouse");
  const val = (id) => fields.find(f => f.field_id === id)?.current_value;
  assert.equal(val("question_30007"), "I Agree");
  assert.equal(val("question_30008"), "I Acknowledge");
  assert.equal(val("question_30005"), "Yes", "a plain Yes / No picker is still picked exactly");
});
