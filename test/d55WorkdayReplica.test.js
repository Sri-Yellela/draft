// D55 step 0 — the Workday-shaped replica in scripts/fakeAts.js.
//
// The fill items (a)–(l) are each measured against this page, so the page itself must keep the
// shapes that make those measurements mean something. These are source checks on the fixture: if a
// later edit "simplified" the replica — rendered the listbox synchronously, dropped the cover-letter
// decoy, gave Submit its own id — every harness run would keep passing while proving less.
// The behaviour is exercised for real in scripts/d55AutofillWorkday.mjs (headless Chrome).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("scripts/fakeAts.js", "utf8").replace(/\r\n/g, "\n");
const start = src.indexOf("// ── D55 · THE WORKDAY-SHAPED REPLICA");
const end = src.indexOf("// ══ end of the D55 Workday replica");
const replica = src.slice(start, end);

test("the replica is its own delimited section of fakeAts.js", () => {
  assert.ok(start > 0 && end > start, "the D55 section markers are missing");
  assert.match(src, /if \(req\.method === 'GET' && workdayReplicaRoute\(req, res, path, null, send\)\) return;/);
  assert.match(src, /if \(workdayReplicaRoute\(req, res, path, raw, send\)\) return;/);
  assert.match(src, /submissions\.length = 0;\n\s+resetWorkdayReplica\(\);/, "/_reset must clear the replica's record too");
});

test("six steps, in Workday's order, ending at Review", () => {
  assert.match(replica, /steps: \['My Information', 'My Experience', 'Application Questions', 'Voluntary Disclosures', 'Self Identify', 'Review'\]/);
});

test("Save and Continue and Submit are ONE control relabelled — the trap an id-only advance falls into", () => {
  assert.match(replica, /'data-automation-id': 'bottom-navigation-next-button'/);
  assert.match(replica, /text: isReview \? 'Submit' : 'Save and Continue'/);
  // Save and Continue validates the step; it never advances over an empty required field.
  assert.match(replica, /const missing = reg\.filter\(f => f\.required && !f\.get\(\)\);/);
});

test("pressing Submit is RECORDED, so a run can prove the extension never pressed it", () => {
  assert.match(replica, /workdayReplica\.submitPressed \+= 1;/);
  assert.match(replica, /path === '\/_workday-replica\/state'/);
});

test("dropdown listboxes and typeahead results arrive LATE, in a portal at the end of <body>", () => {
  assert.match(replica, /listboxDelayMs: \d{2,}/);
  assert.match(replica, /searchDelayMs: \d{2,}/);
  assert.match(replica, /document\.body\.append\(lb\)/);
  assert.match(replica, /'aria-haspopup': 'listbox'/);
  assert.match(replica, /role: 'combobox', 'aria-autocomplete': 'list'/);
  assert.match(replica, /text: 'Searching…'/);
});

test("the typeahead search is a SUBSTRING match over the ATS's own vocabulary", () => {
  assert.match(replica, /vocab\.filter\(v => v\.toLowerCase\(\)\.includes\(q\)\)/);
  // A profile's "Computer Science" is not in it; only a shorter query finds the ATS's wording.
  assert.match(replica, /'Computer and Information Sciences'/);
  assert.doesNotMatch(replica, /'Computer Science'/);
});

test("Add / Add Another sections for work, education, languages and websites", () => {
  for (const kind of ["workExperience", "education", "language", "websites"]) {
    assert.match(replica, new RegExp(`section\\('${kind}', `), kind);
  }
  assert.match(replica, /btn\.textContent = n \? 'Add Another' : 'Add';/);
});

test("the cover letter's drop zone comes BEFORE the résumé's — 'the first file input' is wrong", () => {
  const cover = replica.indexOf("dropZone('coverLetter'");
  const resume = replica.indexOf("dropZone('resume'");
  assert.ok(cover > 0 && resume > cover);
  assert.match(replica, /'data-automation-id': 'file-upload-drop-zone'/);
});

test("the stops are all on the page: work authorisation, sponsorship, a ruling-out screen, an opt-in, EEO", () => {
  assert.match(replica, /legally authorized to work/);
  assert.match(replica, /require sponsorship/);
  assert.match(replica, /7\+ years/);
  assert.match(replica, /marketing communications/);
  for (const eeo of ["'gender'", "'ethnicity'", "'veteranStatus'", "'disabilityStatus'"]) assert.ok(replica.includes(eeo), eeo);
});

test("required is signalled three ways, including by the label's asterisk ALONE", () => {
  assert.match(replica, /h\('abbr', \{ title: 'required'/);
  assert.match(replica, /text\('legalNameSection_lastName', 'Last Name', \{ required: true \}\)/,
    "Last Name carries only the asterisk — no aria-required — so the pre-check has to read the label");
});
