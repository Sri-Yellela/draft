// ⭐ A149 (45o) · the probe's company-page gaps against the D179 sketch's FIRST version: the company's own logo, industry ·
// HQ in the header, your marks on their stack (signed in), "What they ask for most" with Atlas links — and every company
// reached from a board row reaches its page (the row's logo keeps opening the hiring-data view, D147; one press on).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("client/src/pages/companies/CompanyPage.jsx", "utf8");

test("A149 · the header carries the logo and industry · HQ; the stack says what you have; what they ask for most", () => {
  assert.match(page, /<CompanyLogo company=\{c\.name\} size=\{56\} radius=\{12\} \/>/);
  assert.doesNotMatch(page, /co__tile/, "the letter tile is gone");
  assert.match(page, /\[about\?\.facts\?\.industry, about\?\.facts\?\.hq, c\.domain,/);
  assert.match(page, /match\.proven\?\.includes\(tech\) \? \{ kind: "proven", word: "you've proven it" \}/);
  assert.match(page, /match\.listed\?\.includes\(tech\) \? \{ kind: "listed", word: "on your résumé" \}/);
  assert.match(page, /<h2>What they ask for most<\/h2>/);
  assert.match(page, /Math\.round\(\(100 \* t\.postings\) \/ Math\.max\(1, t\.of\)\)\}% of their postings/);
  assert.match(page, /Request a correction or removal/, "the sketch's correction / removal stays");
});

test("A149 · a board row's company reaches its page through the hiring-data view (D147's logo, unchanged)", () => {
  const modal = fs.readFileSync("client/src/components/CompanyViewModal.jsx", "utf8");
  assert.match(modal, /data-open-company-page=""\s+onClick=\{\(\) => \{ onClose\(\); navigate\(companyPath\(company\)\); \}\}/);
  assert.match(fs.readFileSync("client/src/components/JobBubble.jsx", "utf8"), /<CompanyViewModal company=\{job\.company\}/,
    "the row's logo still opens the hiring data");
});
