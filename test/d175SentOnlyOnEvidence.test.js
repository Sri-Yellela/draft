// ⛔ D175 FA5 · SENT ONLY ON EVIDENCE. Both submit paths now need post-submit evidence before an application is filed
// `submitted` (and the tracker says Sent): the in-process fill since A1 N1 (applyAutomation: clicked_no_evidence →
// filled_not_submitted / submit_unverified), and — new — the apply worker's report (services/applyWorker.js
// acceptReport): the success text or the confirmation page's URL; without either it stops, records no application.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const worker = fs.readFileSync(new URL("../services/applyWorker.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fill = fs.readFileSync(new URL("../services/applyAutomation.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("d175SentOnlyOnEvidence: the worker's submit with no confirmation stops — never `submitted`, no application recorded", () => {
  const start = at(worker, 'if (report.outcome === "submitted") {');
  const block = worker.slice(start, at(worker, "return { ok: true, state: \"submitted\" };", start));
  const guard = at(block, "if (!confirmation && !confirmUrl) {");
  const filed = at(block, "SET status = 'submitted'");
  assert.ok(guard < filed, "the evidence check comes before anything is filed as submitted");
  const stop = block.slice(guard, at(block, "}", at(block, "return { ok: true, state: \"stopped\"", guard)));
  assert.match(stop, /setRunJob\("filled_not_submitted", "submit_unverified"/, "the same state the in-process path uses");
  assert.match(stop, /submit_verified = 0, submit_evidence = 'clicked_no_evidence'/);
  assert.doesNotMatch(stop, /onSubmitted/, "no application is recorded");
  assert.match(block.slice(filed), /\.run\(submittedBy, 1, /, "a filed submit is always a verified one");
});

test("d175SentOnlyOnEvidence: the in-process fill still needs post-click evidence (A1 N1)", () => {
  assert.match(fill, /submitEvidence = "clicked_no_evidence";\n\s+submitReasonCode = "submit_unverified";/);
  assert.match(fill, /\} else if \(clicked && evidence\.length > 0\) \{\n\s+status = "submitted";/);
});
