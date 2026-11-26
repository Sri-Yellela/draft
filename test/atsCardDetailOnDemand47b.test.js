// ⭐ 47b (owner 11-22: "this is still what i got, we can have a detailed analysis on demand") — THE ATS CARD OPENS SHORT.
// By default: the number, each part's name / bar / number, the biggest gain. The analysis — the score's facts line ("skill match
// 37 · in context 46 · …"), each part's line ("Reliability — missing Planning, SAFE") and figures ("1 of 3 skills · … · weighs
// 63%") — waits behind ONE quiet toggle, "Show the analysis". The same on the web (client/src/components/AtsCard.jsx, rendered
// here with esbuild + react-dom/server) and in the extension's mirror (extension/resumePanel.js; walked in a real Chrome by
// test-support/walks/atsOnPage.mjs section 4).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { atsCardView } from "../shared/contextualView.js";

const CLIENT = path.resolve("client");
const requireClient = createRequire(path.join(CLIENT, "package.json"));
const REPORT = Object.freeze({ score: 72, scorable: true, tier1_matched: ["Go", "Kafka"], tier1_missing: ["Terraform"],
  action_verbs_matched: ["Built"], action_verbs_missing: ["Scaled"], experience: { requiredYears: 4, candidateYears: 6, fit: true } });


// ⭐ D202 (47h, the owner's yes — moved on purpose): the web card these two tests read (components/AtsCard.jsx, option C) is
// retired; the posting's match panel draws FitCard (test/d202FitCard.test.js). The extension's own card stays, tested below.

test("atsCardDetailOnDemand — the extension's mirror: the same default and toggle, in its own CSS, nothing stored", () => {
  const src = fs.readFileSync("extension/resumePanel.js", "utf8");
  assert.match(src, /data-role="ats-card-view" data-detail="\$\{atsDetail \? '1' : '0'\}"/);
  assert.match(src, /\.ac\[data-detail="0"\] \[data-detail-line\] \{ display: none; \}/);
  assert.equal((src.match(/class="fx" data-(role="ats-card-facts" data-)?detail-line=""/g) || []).length, 2, "the facts line and each part's figures");
  // 47c (moved on purpose): each part's line is on demand too, except a pending part's (its one step shows in the short view)
  assert.match(src, /class="fx"\$\{p\.pending \? ' data-pending=""' : ' data-detail-line=""'\}/);
  assert.match(src, /let atsDetail = false;/);
  assert.match(src, /if \(role === 'ats-card-detail'\) return;\s*\/\/ ⛔ Everything here reaches draft's server/, "the panel's delegated click never disables the local toggle (it did: the second click was dead)");
  assert.match(src, /b\.textContent = atsDetail \? 'Hide the analysis' : 'Show the analysis';/);
  const toggle = src.match(/atsRoot\.querySelector\('\[data-role="ats-card-detail"\]'\)\?\.addEventListener\('click', \(e\) => \{[\s\S]*?\r?\n    \}\);/)?.[0] || "";
  assert.ok(toggle.includes("atsDetail = !atsDetail"), "the toggle's own listener");
  assert.doesNotMatch(toggle, /chrome\.storage|send\(|fetch\(/, "it stores and sends nothing");
});
