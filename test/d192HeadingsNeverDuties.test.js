// ⭐ D196 FIX-6 (owner 11-24, 47f) · A POSTING'S HEADING IS NEVER A DUTY — the field card said *Not on your résumé yet:
// "How You'll Make a Difference"*, a section title of the posting read as a responsibility (D192 (4a)(ii)).
// The fixture is a SYNTHETIC posting written in the shape of the one the owner saw (a Title Case heading over the duties,
// curly apostrophes, the company's blurb, a benefits list and the equal-opportunity paragraph) — not a copy of it.
// ⛔ Verified to fail before the fix: on @draft/ats-scorer 1.7.0 "How You’ll Make a Difference" was the first phrase.
import test from "node:test";
import assert from "node:assert/strict";
import { responsibilityPhrases, responsibilityOverlap, looksLikeHeading } from "../packages/ats-scorer/src/contextual.js";

const POSTING = [
  "Sr. Lead Software Engineer",
  "Northwind is the platform growing brands use to own their customer relationships.",
  "How You’ll Make a Difference",
  "Lead the design of event pipelines that process billions of messages a day",
  "Mentor engineers across three teams and raise the bar on code review",
  "Own reliability for the delivery platform, from on-call to postmortems",
  "Who You Are",
  "8+ years building distributed systems in Python or Go",
  "What We Offer",
  "Health, dental and vision insurance, 401(k) matching and paid time off",
  "Northwind is an equal opportunity employer and considers applicants without regard to race, gender or age.",
].join("\n");

test("FIX-6 · d192HeadingsNeverDuties — the section titles and the boilerplate never become phrases", () => {
  const texts = responsibilityPhrases(POSTING).map((p) => p.text);
  for (const t of texts) {
    assert.doesNotMatch(t, /make a difference|who you are|what we offer/i, `a heading read as a duty: ${t}`);
    assert.doesNotMatch(t, /equal opportunity|401|paid time off|platform growing brands/i, `boilerplate read as a duty: ${t}`);
  }
  assert.deepEqual(texts, [
    "Lead the design of event pipelines that process billions of messages a day",
    "Mentor engineers across three teams and raise the bar on code review",
    "Own reliability for the delivery platform, from on-call to postmortems",
  ], "only the three real duties, from under the heading");
});

test("FIX-6 · the heading opens the duties section (a curly apostrophe too), and the overlap never lists it as missing", () => {
  const r = responsibilityOverlap(POSTING, "Led the design of event pipelines at a payments company\nMentored engineers and ran code review");
  assert.equal(r.status, "ok");
  for (const m of r.missing) assert.doesNotMatch(m, /make a difference/i);
  for (const m of r.matched) assert.doesNotMatch(m, /make a difference/i);
});

test("FIX-6 · looksLikeHeading: short Title Case or a colon / question = a heading; a duty sentence is not", () => {
  for (const h of ["How You’ll Make a Difference", "The Work You'll Own", "What you'll do:", "Why join us?", "Life at Northwind", "Who You Are", "Our Values"]) assert.ok(looksLikeHeading(h), h);
  for (const d of ["Build payment APIs in Go", "Partner with design to ship the checkout flow.", "Own the on-call rotation for the delivery platform", "Build APIs in Go"]) assert.ok(!looksLikeHeading(d), d);
  assert.ok(!looksLikeHeading("Design Systems", { bullet: true }), "a Title Case BULLET stays a duty (only a colon / question makes it a heading)");
  assert.ok(looksLikeHeading("Responsibilities:", { bullet: true }));
});
