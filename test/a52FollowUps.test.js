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

test("the experience summary renders once: the Experience Fit section is skipped when the band card already printed it", () => {
  const src = fs.readFileSync("client/src/components/AtsReport.jsx", "utf8");
  assert.match(src, /report\.experience && report\.experience\.summary !== \(report\.verdict \|\| report\.experience\.summary\) && \(/);
});

test("/tools/ats: the result clears the fixed ScrollDock and is brought into view", () => {
  const src = fs.readFileSync("client/src/pages/tools/ATSToolPage.jsx", "utf8");
  assert.match(src, /ref=\{resultRef\} data-ats-result style=\{\{[^}]*scrollMarginTop: 80/);
  assert.match(src, /if \(result\) resultRef\.current\?\.scrollIntoView/);
});
