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
  // D48: the header's ATS number box — no score draws the dashed box with NO digits, never "No signal".
  // D58: through the ONE pair read (shared/resumeScores.js) — the tailored score when a résumé exists, else the base.
  assert.match(jd, /const scores = selectedJobMeta\?\.scores \?\? atsScorePair\(\{ base: job\?\.baseAtsScore, tailored: g\?\.html \? g\?\.atsScore : null \}\);/);
  assert.match(read("client/src/components/AtsNumberBox.jsx"), /const has = ATS_NUMBER_SHOWN && Number\.isFinite\(score\);/);   // A93: the one box
  assert.match(read("client/src/components/AtsNumberBox.jsx"), /\? \(<><b>\{Math\.round\(score\)\}<\/b>/);
  assert.doesNotMatch(jd, /No signal/);
  // The panel's own verdict is adopted by the board, the JD header and the panel header.
  const jobs = read("client/src/panels/JobsPanel.jsx");
  assert.match(jobs, /const adoptPanelVerdict = useCallback\(/);
  // ⭐ D152 (8): the verdict sink reaches the match inside the posting (the ATS overlay is retired).
  assert.match(jobs, /atsPayload: buildAtsPayload\(selectedJob, g2\), activeProfileId, onAtsReport: adoptPanelVerdict,/);
  assert.match(jobs, /report\.report_basis === "generated_resume"\) return;/, "a generated résumé's report is not the base verdict");
  assert.match(jd, /onReport=\{selectedJobMeta\?\.onAtsReport \|\| null\}/);
  assert.match(read("client/src/components/ATSPanel.jsx"), /if \(data && onReport\) onReport\(jobId, data\);/);
  // ATSPanel: a declined report's null is the band, never replaced by a stored number.
  assert.match(read("client/src/components/ATSPanel.jsx"), /hasOwnProperty\.call\(activeReport, "score"\) \? activeReport\.score : \(score \?\? null\)/);
  assert.match(SERVER, /report_basis: "generated_resume"/);
});
