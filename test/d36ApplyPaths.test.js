import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tmpPdfPath } from "../routes/apply.js";
import { describeApplication } from "../client/src/lib/applyObstacles.js";

// D36 — EVERY APPLY PATH, END TO END. Each test here pins a defect the walk found against the local
// fake ATS on a throwaway server (synthetic user, keys blanked); the walk itself is in the D36 report
// and docs/D36_ATTENDED_RUNBOOK.md. Read the source as text with line endings normalised, because
// the tree is CRLF on Windows and LF elsewhere and neither is what these assertions are about.
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// ── 1 · A résumé that was written must not be reported as never written ──────────────────────────
// Walked 10-05: Draft → preview → Approve. The approved run generated the résumé (artifact 8, score
// 90), then held `resume_unavailable` — "No resume was generated, so there was nothing to attach".
// The temp PDF name embedded the job id (`greenhouse::6110219004` shape) and `:` is illegal in a
// Windows path; `catch { return null; }` hid the ENOENT. Two defects: the name, and the silence.

test("D36 · the temp PDF name is portable: a real job id with '::' yields no colon in the file name", () => {
  const p = tmpPdfPath("resume", 83, "greenhouse::6110219004", 1791240074381);
  assert.equal(path.dirname(p), os.tmpdir());
  const base = path.basename(p);
  assert.doesNotMatch(base, /[:<>"|?*\\/]/, `not a portable file name: ${base}`);
  assert.equal(base, "resume_83_greenhouse_6110219004_1791240074381.pdf");
  // Something a person can still trace back to the job and the user.
  assert.match(tmpPdfPath("cl", 7, "lever::abc-123"), /cl_7_lever_abc-123_\d+\.pdf$/);
});

test("D36 · every run-time PDF goes through tmpPdfPath — no raw job id in a temp file name", () => {
  const src = read("routes/apply.js");
  assert.doesNotMatch(src, /path\.join\(os\.tmpdir\(\),\s*`(?:resume|cl)_\$\{userId\}_\$\{jobId\}/,
    "a temp PDF path still interpolates the raw job id");
  assert.ok((src.match(/tmpPdfPath\("resume", userId, jobId\)/g) || []).length >= 3, "the three résumé sites");
  assert.ok((src.match(/tmpPdfPath\("cl", userId, jobId\)/g) || []).length >= 3, "the three cover-letter sites");
});

test("D36 · a failed résumé PDF is RECORDED as resume_pdf_failed, never swallowed into resume_unavailable", () => {
  const src = read("routes/apply.js");
  // Each place a GENERATED résumé is converted for upload (semi's CASE B, approved/auto CASE C).
  const sites = [...src.matchAll(/await htmlToPdf\(gen\.html\);[\s\S]{0,400}?\}\s*catch\s*(\([^)]*\))?\s*\{([\s\S]{0,300}?)\n\s{10}\}/g)];
  assert.equal(sites.length, 2, "expected the two generated-résumé conversion sites");
  for (const m of sites) {
    assert.ok(m[1], "the catch binds the error — a bare `catch {` cannot say what failed");
    assert.match(m[2], /docFailure = resumePdfFailure\(e\)/, "the failure is kept for attribution");
    assert.match(m[2], /logEvent\([^)]*"resume_pdf_failed"/, "and written to the run's own history");
  }
  // And it outranks the browser's downstream symptom when the row's reason is chosen.
  assert.match(src, /: genFailure \? genFailure\.reasonCode\n\s*: docFailure \? docFailure\.reasonCode\n\s*: atsHeld/);
  assert.match(src, /const reasonDetail = genFailure \? genFailure\.detail : docFailure \? docFailure\.detail/);
});

test("D36 · the user is told the résumé EXISTS, and is not offered to generate another", () => {
  const o = describeApplication({ status: "held_review", reasonCode: "resume_pdf_failed" });
  assert.notEqual(o.obstacle, "resume pdf failed", "resume_pdf_failed has no copy in client/src/lib/applyObstacles.js");
  assert.match(o.obstacle, /written/i);
  assert.doesNotMatch(o.obstacle, /no r[ée]sum[ée] was generated/i);
  assert.equal(o.resumeBlocked, false, "a Generate button would point at a résumé the user already has");
  assert.equal(o.retryable, true);
});
