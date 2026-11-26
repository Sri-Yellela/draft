// ⭐ D200 Rule 2 (47h, D197 Wave 1 #4) · EVERY MARK ON THE SURVEY SHEET ANSWERS — a stats cell, a stop on the company's
// line, the SPONSORED stamp, NEW THIS QUARTER, the dial and each ticket do something when pressed (a link or a button),
// and a section with nothing to show says so instead of drawing nothing. Rendered from the F5 fixture (the board's data,
// shaped as the API answers) — the same markup the page draws.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderFixture } from "../test-support/renderPlateFixture.mjs";
import { at } from "../test-support/sourceAnchors.js";
import { surveyView, hiringProfile, roleLine, sponsorshipCells } from "../client/src/plate/surveySheet.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d200SurveyEveryMarkAnswers: the stats cells, the stops, the stamp, NEW THIS QUARTER, the dial and the tickets answer", async () => {
  const html = await renderFixture("SurveyBoard");
  // the at-a-glance strip: each cell is a link (open roles → the market; H-1B → section 03; people / founded → their source)
  const strip = html.slice(at(html, 'aria-label="Kestrel Payments at a glance"'), at(html, "pl-actions", at(html, 'aria-label="Kestrel Payments at a glance"')));
  assert.equal((strip.match(/class="pl-stats__cell"/g) || []).length, 4);
  assert.equal((strip.match(/<a class="pl-stats__act"/g) || []).length, 4, "every number is a link");
  assert.match(strip, /href="\/app\/jobs\?q=Kestrel%20Payments"/);
  assert.match(strip, /href="#sponsor"/);
  // the line of roles: one link per stop, to the market filtered to it
  assert.equal((html.match(/data-role-stop="/g) || []).length, 7);
  // the stamp opens its source; NEW THIS QUARTER is a button that says when
  assert.match(html, /<a class="pl-sv-stamp at-stamp" href="https:\/\/www\.dol\.gov[^"]*"[^>]*aria-label="Sponsored in FY2025 — open the source"/);
  assert.equal((html.match(/<button type="button" class="pl-legend__new" aria-expanded="false">NEW THIS QUARTER<\/button>/g) || []).length, 2);
  // the dial is the way to check and prove your skills; every ticket is a link
  assert.match(html, /<a class="pl-sv-dial"[^>]*href="\/app\/atlas\/your-skills"/);
  const tickets = html.match(/<a class="pl-ticket pl-lift"[^>]*>/g) || [];
  assert.ok(tickets.length >= 5, `2 interchanges + 3 tickets out (got ${tickets.length})`);
  assert.ok(tickets.every((t) => /href="[^"]+"/.test(t)));
  // the follow button and the back button
  assert.match(html, /data-company-follow=""/);
  assert.match(html, /data-company-back=""/);
});

test("d200SurveyEveryMarkAnswers: a section with nothing says so", () => {
  assert.equal(hiringProfile([{ month: "2026-11", postings: 4 }]), null, "one month is not a profile");
  assert.deepEqual(roleLine([]), []);
  assert.equal(sponsorshipCells(null), null);
  const sheet = read("client/src/plate/SurveySheet.jsx");
  assert.match(sheet, /FEWER THAN TWO MONTHS OF POSTINGS SEEN/);
  assert.match(sheet, /NO OPEN ROLES RIGHT NOW/);
  assert.match(sheet, /"No filings found"/);
  assert.match(sheet, /That isn’t a no — only that nothing is on record\./);
  assert.match(read("client/src/plate/Marks.jsx"), /NO TECHNOLOGY IN TWO OR MORE OF THEIR POSTINGS YET/);
  assert.match(sheet, /NO TEAMS NAMED IN THEIR POSTINGS/, "the team plate's caption says when the postings name no teams");
  const v = surveyView({ company: { slug: "x", name: "X" }, openJobs: 0, byCategory: [], hiringTrend: [], jobs: [], locations: [] }, null);
  assert.equal(v.match, null, "signed out: no match drawn as if it were one");
  assert.deepEqual(v.stats.map((s) => s.key), ["open"], "only the figures the read holds");
});

test("d200SurveyEveryMarkAnswers: nothing of today's company page is lost (D200 Rule 1 — docs/revamp/survey.md)", async () => {
  const html = await renderFixture("SurveyBoard");
  for (const a of ["data-company-page", "data-company-about", "data-company-stack", "data-company-github", "data-company-match", "data-company-roles",
    "data-company-trend", "data-company-sponsorship", "data-company-jobs", "data-company-locations", "data-company-follow"]) assert.match(html, new RegExp(`${a}=`), a);
  assert.match(html, /Careers site ↗/);
  assert.match(html, /Correct or remove this sheet/);
  assert.match(html, /href="\/contact\?topic=company&amp;company=kestrel-payments"/, "the correction / removal request");
  const sheet = read("client/src/plate/SurveySheet.jsx");
  assert.match(sheet, /<ApplyLink href=\{j\.applyUrl\} jobId=\{j\.jobId\}/, "Apply beside each open job (A157)");
  assert.match(sheet, /data-company-focus=\{focus \? focus\.jobId : undefined\}/, "the job you opened, with its Apply link");
  assert.match(sheet, /\{networkOn \? <button type="button" className="pl-btn" data-company-send=""/, "Send, while the network is on (45q)");
  assert.match(read("client/src/pages/companies/CompanyPage.jsx"), /worksHere=\{networkOn \? <WorksHere company=\{c\.name\} job=\{focus \|\| null\} enabled \/> : null\}/, "WorksHere, kept whole");
});
