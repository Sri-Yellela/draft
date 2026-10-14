// J10 (2026-10-14) · D96–D98's disclosures — the policy, the listing and the reconciliation each say what the
// extension run added: the four automatic switches, Workday's two optional hosts, answer memory with its
// never-remembered list, and the attached PDF's retention. And the D64 promise that an irrelevant posting is
// discarded unstored is still there in all three.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// The policy's prose, with JSX tags and line breaks flattened, so a phrase split across <Strong> still reads.
const policy = read("client/src/pages/marketing/PrivacyPage.jsx")
  .replace(/\{' '\}/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const listing = read("extension/submission/STORE_LISTING.md").replace(/\s*>\s*/g, " ").replace(/\s+/g, " ");
const recon = read("extension/submission/PRIVACY_RECONCILIATION.md").replace(/\s+/g, " ");
const docs = { policy, listing, recon };

test("⛔ J10 · each document names the four automatic switches, all off by default", () => {
  for (const [name, text] of Object.entries(docs)) {
    assert.match(text, /Read\W+Prepare\W+Capture(?:\W+|\W+and\W+)Fill/, `${name}: the four switches`);
    assert.match(text, /off by default|all off|each off|is on until you turn it on/i, `${name}: off by default`);
  }
});

test("⛔ J10 · each document names Workday's two optional hosts and still refuses LinkedIn, Indeed and Glassdoor", () => {
  for (const [name, text] of Object.entries(docs)) {
    assert.match(text, /myworkdaysite\.com/, `${name}: myworkdaysite.com`);
    assert.match(text, /LinkedIn[^.]{0,30}Indeed[^.]{0,30}Glassdoor/, `${name}: never LinkedIn / Indeed / Glassdoor`);
  }
  assert.match(policy, /Workday/);
  for (const name of ["listing", "recon"]) assert.match(docs[name], /myworkdayjobs\.com/, `${name}: myworkdayjobs.com`);
});

test("⛔ J10 · answer memory is disclosed with its never-remembered list; the attached PDF with its retention", () => {
  assert.match(policy, /draft remembers it/);
  assert.match(policy, /records the change \(the previous and the new value, when, and which job\)/);
  assert.match(policy, /signature boxes, passwords, payment details and social security numbers are never remembered/);
  assert.match(policy, /we keep the PDF file you attached, linked to that job/);
  assert.match(policy, /deleted with the job's résumé, with the application record, or with your account/);
  assert.match(recon, /answer memory/i);
  assert.match(recon, /the on-page résumé/i);
  assert.match(listing, /Saved answers only when they acknowledge it/);
  assert.match(listing, /only when the user presses Generate/);
});

test("⛔ J10 · the irrelevant-posting promise survives in all three", () => {
  assert.match(listing, /discards an irrelevant posting without storing it/);
  assert.match(listing, /A page that is not a posting sends \*\*nothing\*\*/);
  assert.match(recon, /only a posting that fits the user's board; nothing otherwise/);
  assert.match(policy, /If it does not fit, we keep nothing/);
  assert.match(policy, /If it is not, nothing is sent/);
});
