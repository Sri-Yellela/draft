import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

// P1 (RECRUITER_LAYER_EXECUTION §P1), the part that was still missing after CC4: claimed terms were
// already safe (their own table), but re-extracting — the Refresh button, or a new résumé — replaced
// hand edits to the extracted lists with no warning and a cheerful status line.
test("Refresh asks first and reports what it replaced; a résumé upload says the same", () => {
  const ui = fs.readFileSync("client/src/panels/ProfilePanel.jsx", "utf8");
  assert.match(ui, /if \(!window\.confirm\(REEXTRACT_WARNING\)\) return;/);
  assert.match(ui, /setSignalStatus\(next\?\.notice \|\|/);
  assert.match(ui, /setResumeStatus\(nextSignals\?\.notice \|\|/);
  assert.doesNotMatch(ui, /label="Extracted (Titles|Keywords|Skills)/, "the lists are editable, so they are not labelled 'Extracted'");
  const route = fs.readFileSync("routes/domainProfiles.js", "utf8");
  const upload = route.slice(at(route, 'router.post("/:id/base-resume"'), at(route, 'router.get("/:id/signals"'));
  assert.ok(upload.length > 50);
  assert.match(upload, /replaced: "extracted", preserved: "claims"/);
});
