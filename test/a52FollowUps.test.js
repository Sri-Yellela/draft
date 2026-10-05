import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// A52's open items, 10-02 (17).
test("enrichment finishing schedules a rescore: the hook fires after a pass that wrote rows, and server.js listens", () => {
  const enrich = fs.readFileSync("services/jobs/enrichJob.js", "utf8");
  assert.match(enrich, /if \(enriched > 0\) notifyEnrichmentApplied\(\{ enriched, batchId, batchSource \}\);/);
  assert.match(enrich, /try \{ fn\(info\); \} catch/, "a listener can never fail a pass");
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /onEnrichmentApplied\(\(\) => \{/);
  assert.match(server, /scheduleBoardFitForAll\("enrichment"\)/);
});

test("the experience summary renders once: the verdict is skipped when it is only the experience summary again", () => {
  const src = fs.readFileSync("client/src/components/AtsReport.jsx", "utf8");
  // D32 re-pin: Experience moved to its OWN row (always printed when there is a summary), so the guard
  // against printing it twice moved to the other side — the "More" fold's verdict line drops out when
  // it would only repeat that summary (the A52 "renders twice" defect, same condition, other end).
  assert.match(src, /const verdict = report\.verdict && report\.verdict !== report\.experience\?\.summary \? report\.verdict : null;/);
  assert.match(src, /\{report\.experience\?\.summary && <ExperienceRow experience=\{report\.experience\} \/>\}/);
  assert.equal((src.match(/<ExperienceRow /g) || []).length, 1, "the experience row is printed once");
});

test("/tools/ats: the result clears the fixed ScrollDock and is brought into view", () => {
  const src = fs.readFileSync("client/src/pages/tools/ATSToolPage.jsx", "utf8");
  assert.match(src, /ref=\{resultRef\} data-ats-result style=\{\{[^}]*scrollMarginTop: 80/);
  assert.match(src, /if \(result\) resultRef\.current\?\.scrollIntoView/);
});
