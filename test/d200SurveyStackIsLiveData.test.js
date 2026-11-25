// ⭐ D200 Rule 2 (47h, D197 Wave 1 #4) · THE SURVEY SHEET'S STACK LEGEND IS LIVE DATA — every row comes from the company
// page's one read (stackFor → company_tech: ≥ 2 postings inside 180 days, each technology with its evidence count) and the
// person's marks from Your match; nothing on the legend is typed into the page, and the old company_technographics table
// is never its source (47h's check: that table has had no writer since A80 V4).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stackLegend, surveyView, markFor, githubShares, teamsWord } from "../client/src/plate/surveySheet.js";
import { renderFixture } from "../test-support/renderPlateFixture.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const STACK = { ofPostings: 38, groups: {
  languages: [{ tech: "Go", postings: 21, of: 38, teams: ["Platform", "Backend"], newThisQuarter: false }],
  data: [{ tech: "PostgreSQL", postings: 18, of: 38, teams: ["Backend", "Data"] }],
  cloud: [{ tech: "AWS", postings: 24, of: 38, teams: ["Platform", "Backend", "Data", "Checkout"] }],
  frameworks: [{ tech: "React", postings: 8, of: 38, teams: ["Checkout"], newThisQuarter: true, atlasSlug: "react" }],
} };

test("d200SurveyStackIsLiveData: the legend is stackFor's rows, folded by group, with evidence counts and floor shares", () => {
  const l = stackLegend(STACK, null);
  assert.equal(l.of, 38);
  assert.deepEqual(l.columns.map((c) => c.label), ["LANGUAGES", "FRAMEWORKS", "DATA & CLOUD"], "Data & cloud fold together; empty groups aren't drawn");
  const rows = l.columns.flatMap((c) => c.rows);
  assert.deepEqual(rows.map((r) => [r.tech, r.postings, r.pct]), [["Go", 21, 55], ["React", 8, 21], ["PostgreSQL", 18, 47], ["AWS", 24, 63]]);
  assert.equal(rows.find((r) => r.tech === "React").isNew, true);
  assert.equal(rows.find((r) => r.tech === "React").atlasSlug, "react");
  assert.equal(teamsWord(rows.find((r) => r.tech === "AWS").teams), "most teams");
  assert.deepEqual(stackLegend(null, null), { of: 0, columns: [] }, "no stack → nothing invented");
});

test("d200SurveyStackIsLiveData: your square is Your match's — proven or listed = yours, the rest not yet, signed out = unknown", () => {
  const match = { of: 12, proven: ["go"], listed: ["React"], missing: [] };
  assert.equal(markFor("Go", match), "proven");
  assert.equal(markFor("react", match), "listed");
  assert.equal(markFor("AWS", match), "not");
  assert.equal(markFor("AWS", null), null, "signed out claims nothing");
  assert.deepEqual(githubShares({ org: "k", url: "u", languages: [{ language: "Go", repos: 61 }, { language: "TS", repos: 22 }, { language: "Py", repos: 11 }, { language: "Sh", repos: 6 }] }).top.map((x) => x.pct), [61, 22, 11]);
});

test("d200SurveyStackIsLiveData: the page reads the public read's stack (stackFor), never company_technographics", () => {
  const svc = read("services/companies/publicCompany.js");
  assert.match(svc, /stack = stackFor\(db, co\.id, nowSec\)/, "the read's stack is stackFor's");
  assert.match(read("services/companies/companyTech.js"), /FROM company_tech\b/, "stackFor reads company_tech");
  for (const f of ["client/src/plate/SurveySheet.jsx", "client/src/plate/surveySheet.js", "client/src/pages/companies/CompanyPage.jsx"]) {
    assert.doesNotMatch(read(f), /company_technographics|technographics\?/, `${f} never reads the old table`);
  }
  assert.match(read("client/src/plate/SurveySheet.jsx"), /const v = surveyView\(data, match\);/, "the sheet draws the model of the read");
  assert.match(read("client/src/pages/companies/CompanyPage.jsx"), /api\(`\/api\/public\/companies\/\$\{encodeURIComponent\(slug\)\}/, "one read");
});

test("d200SurveyStackIsLiveData: rendered, the legend shows each technology with its count, square and Atlas link", async () => {
  const html = await renderFixture("SurveyBoard");
  for (const [tech, n] of [["Go", 21], ["TypeScript", 9], ["PostgreSQL", 18], ["Kafka", 12], ["AWS", 24]]) {
    assert.match(html, new RegExp(`data-tech="${tech}"[\\s\\S]*?in <b>${n} of 38</b> postings`), `${tech} with its evidence`);
  }
  assert.match(html, /data-tech="React" data-mine="listed"/, "your mark from Your match");
  assert.match(html, /data-learn-tech="Kafka"/, "a technology with an Atlas page links to it");
  assert.match(html, /data-company-github=""/, "the public GitHub foot");
  const v = surveyView(JSON.parse(JSON.stringify({ company: { slug: "x", name: "X" }, openJobs: 0, byCategory: [], hiringTrend: [], jobs: [], locations: [], stack: STACK })), null);
  assert.equal(v.legend.columns.length, 3);
});
