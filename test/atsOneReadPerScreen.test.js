// ONE SCORING READ PER SCREEN (A52) — the client half of test/atsStoredScoreCurrent.test.js.
//
// A card's JD header read "No signal" (a null stored score printed as a verdict) beside an ATS panel
// reading "Strong match" (the posting scored fresh). The header no longer prints an absent score as a
// decline, and when the panel scores a posting itself, its verdict is adopted by the card, the JD
// header and the panel's own header until the next board load reads the re-scored stored value.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SERVER = fs.readFileSync("server.js", "utf8");

test("the client: one scoring read per screen", () => {
  const read = (f) => fs.readFileSync(f, "utf8");
  // The JD header no longer prints "No signal" for an absent score.
  const jd = read("client/src/components/JobDetailPanel.jsx");
  assert.match(jd, /const atsShown = atsScore != null;/);
  assert.match(jd, /\{atsShown \? <span/);
  // The panel's own verdict is adopted by the board, the JD header and the panel header.
  const jobs = read("client/src/panels/JobsPanel.jsx");
  assert.match(jobs, /const adoptPanelVerdict = useCallback\(/);
  assert.match(jobs, /onReport=\{adoptPanelVerdict\}/);
  assert.match(jobs, /report\.report_basis === "generated_resume"\) return;/, "a generated résumé's report is not the base verdict");
  assert.match(read("client/src/panels/AtsReportPanel.jsx"), /onReport=\{onReport\}/);
  assert.match(read("client/src/panels/ATSPanel.jsx"), /if \(data && onReport\) onReport\(jobId, data\);/);
  // The panel header reads the report the body draws, not the stored score alone.
  assert.match(read("client/src/panels/AtsReportPanel.jsx"), /reportBand\(r && Object\.prototype\.hasOwnProperty\.call\(r, "score"\)/);
  // ATSPanel: a declined report's null is the band, never replaced by a stored number.
  assert.match(read("client/src/panels/ATSPanel.jsx"), /hasOwnProperty\.call\(activeReport, "score"\) \? activeReport\.score : \(score \?\? null\)/);
  assert.match(SERVER, /report_basis: "generated_resume"/);
});
