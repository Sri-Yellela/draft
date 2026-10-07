// D55 (b) — repeating sections: the packet's entries (server) and the fill's Add Another (extension).
// The page-side half is exercised in headless Chrome by scripts/d55AutofillWorkday.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import fs from "node:fs";

import { buildPacketEntries, parseDateRange, parseMonthYear, buildGatePacket } from "../services/applyGatePacket.js";
import { entryReviewItems } from "../extension/gated-handoff.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";

const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");

// A SYNTHETIC candidate (CLAUDE.md: fixtures never use a real person).
const SYNTH_PROFILE = {
  full_name: "Ada Lovelace", university: "Example State University", highest_degree: "Bachelor of Science",
  field_of_study: "Computer Science", graduation_year: 2019,
  current_company: "Analytical Engines", current_job_title: "Senior Engineer",
  linkedin_url: "linkedin.com/in/ada-example", github_url: "https://github.com/ada-example", website_url: "",
  confirmed_skills: JSON.stringify(["JavaScript", "Python", "SQL", "JavaScript"]),
};

test("(b) dates: month/year and ranges, 'Present' is current", () => {
  assert.deepEqual(parseMonthYear("Jan 2022"), { month: 1, year: 2022 });
  assert.deepEqual(parseMonthYear("03/2020"), { month: 3, year: 2020 });
  assert.deepEqual(parseMonthYear("2018"), { month: null, year: 2018 });
  assert.equal(parseMonthYear("soon"), null);
  assert.deepEqual(parseDateRange("Jan 2022 – Present"), { from: { month: 1, year: 2022 }, to: null, current: true });
  assert.deepEqual(parseDateRange("Jun 2019 - Dec 2021"), { from: { month: 6, year: 2019 }, to: { month: 12, year: 2021 }, current: false });
  assert.deepEqual(parseDateRange("2016-2018"), { from: { month: null, year: 2016 }, to: { month: null, year: 2018 }, current: false });
});

test("(b) entries come from what the candidate STATED — the profile and the base résumé", () => {
  const resume = buildStructuredResume([
    "Ada Lovelace", "Senior Engineer", "ada@example.com",
    "EXPERIENCE",
    "Analytical Engines | Jan 2022 – Present", "Senior Engineer",
    "- Built the difference engine's scheduler", "- Led a team of four",
    "Northwind Systems | Jun 2019 - Dec 2021", "Software Engineer", "- Wrote the billing service",
    "EDUCATION", "Example State University",
  ].join("\n"));
  const e = buildPacketEntries({ profile: SYNTH_PROFILE, structuredResume: resume });
  assert.equal(e.education.length, 1, "the profile stores ONE education entry");
  assert.deepEqual(e.education[0], { school: "Example State University", degree: "Bachelor of Science",
    field: "Computer Science", gpa: null, from: null, to: { month: null, year: 2019 }, source: "profile" });
  assert.ok(e.work.length >= 1, JSON.stringify(e.work));
  assert.ok(e.work.every(w => w.source === "resume"), "work entries came from the résumé, not the profile fallback");
  assert.ok(e.work.some(w => /Analytical Engines/.test(w.company || "")), JSON.stringify(e.work));
  assert.deepEqual(e.websites.map(w => w.url), ["https://linkedin.com/in/ada-example", "https://github.com/ada-example"]);
  assert.deepEqual(e.skills, ["JavaScript", "Python", "SQL"], "confirmed skills, de-duplicated");
  assert.deepEqual(e.languages, [], "the profile stores no languages — an empty list, never a guess");
});

test("(b) no résumé: the profile's current role is the one work entry", () => {
  const e = buildPacketEntries({ profile: SYNTH_PROFILE });
  assert.deepEqual(e.work, [{ title: "Senior Engineer", company: "Analytical Engines", location: null,
    from: null, to: null, current: true, description: null, source: "profile" }]);
});

test("(b) no entry carries an attestation — nothing for eligibility, EEO or screening", () => {
  const e = buildPacketEntries({ profile: { ...SYNTH_PROFILE, work_auth: "Yes", gender: "Female", requires_sponsorship: 1 } });
  assert.doesNotMatch(JSON.stringify(e), /work_auth|sponsor|gender|Female/);
});

test("(b) the packet carries entries only when there are some", () => {
  const base = { autofillPayload: { field_map: { email: "ada@example.com" }, handler_map: {}, custom_answers: {} },
    applyUrl: "https://example.test/apply", jobId: "j1" };
  assert.ok(!("entries" in buildGatePacket(base)), "an older caller's packet is unchanged");
  assert.ok(!("entries" in buildGatePacket({ ...base, entries: buildPacketEntries({ profile: {} }) })));
  const p = buildGatePacket({ ...base, entries: buildPacketEntries({ profile: SYNTH_PROFILE }) });
  assert.equal(p.entries.education.length, 1);
});

test("(b) both packet builders that serve a fill attach entries", () => {
  const routes = fs.readFileSync("routes/apply.js", "utf8");
  assert.equal([...routes.matchAll(/entries: packetEntriesFor\(userId\),/g)].length, 2,
    "createGatePacket (run holds) and prepareManualPacket (D56's manual route) both need entries");
  assert.match(routes, /buildStructuredResume\(base\.content\)/);
});

test("(b) the fill presses Add once per entry and fills ONLY the panel that appeared", () => {
  const plan = src.slice(at(src, "async function applyPlan("), at(src, "// ── Matching"));
  assert.match(plan, /const before = new Set\(panelControls\(box\)\);\n\s+btn\.click\(\);/);
  assert.match(plan, /await waitFor\(\(\) => panelControls\(box\)\.some\(el => !before\.has\(el\)\), 3000\)/);
  assert.match(plan, /const fresh = panelControls\(box\)\.filter\(el => !before\.has\(el\)\);/);
  assert.match(plan, /if \(!kind \|\| sections\[kind\]\) continue;/, "each section is filled once");
  assert.match(src, /let entriesLeft = released\.packet\?\.entries \|\| null;/);
  assert.match(src, /\{ entries: entriesLeft, keepExisting: !!step\.wizard \}/);
});

test("(b) the review gets ONE row per placed entry, acknowledged once, never per field", () => {
  const entries = buildPacketEntries({ profile: SYNTH_PROFILE });
  const rows = entryReviewItems(entries, [
    { entry: "work:0" }, { entry: "work:0" }, { entry: "education:0" }, { entry: "skills" },
  ]);
  assert.deepEqual(rows.map(r => r.field), ["Work experience 1", "Education 1", "Skills"]);
  assert.equal(rows[0].entryFields, 2);
  assert.match(rows[1].value, /Bachelor of Science · Computer Science · Example State University · 2019/);
  assert.ok(rows.every(r => r.matchedBy === "label" && r.eligibility === false));
  assert.deepEqual(entryReviewItems(entries, []), [], "an entry the page never took is not reviewed as filled");
});
