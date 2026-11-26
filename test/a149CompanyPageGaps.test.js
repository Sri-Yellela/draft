// ⭐ A149 (45o) · the probe's company-page gaps against the D179 sketch's FIRST version: the company's own logo, industry ·
// HQ in the header, your marks on their stack (signed in), "What they ask for most" with Atlas links — and every company
// reached from a board row reaches its page (the row's logo keeps opening the hiring-data view, D147; one press on).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("client/src/pages/companies/CompanyPage.jsx", "utf8");

test("A149 · the header carries the logo and industry · HQ; the stack says what you have; what they ask for most", () => {
  // ⛔ 47j w1-retire (changed on purpose): R3 deleted the classic company page — the page is the survey sheet (plate/
  // SurveySheet.jsx); each A149 piece is held where docs/revamp/survey.md says it lives now
  const sheet = fs.readFileSync("client/src/plate/SurveySheet.jsx", "utf8");
  const model = fs.readFileSync("client/src/plate/surveySheet.js", "utf8");
  assert.doesNotMatch(page, /CompanyLogo|className="co\b|co__|useMarketPlate/, "no classic page left");
  assert.match(sheet, /<LetterTile name=\{c\.name\} logo=\{getKnownLogoUrl\(c\.name\)\} region=\{region\}\/>/, "the company's logo (else its letter)");
  assert.match(sheet, /\["SURVEY SHEET", v\.facts\.industry, v\.facts\.hq,/, "industry · HQ in the kicker row");
  assert.match(model, /return has\(match\.proven\) \? "proven" : has\(match\.listed\) \? "listed" : "not";/, "your mark on each technology");
  assert.match(sheet, /Correct or remove this sheet/, "the sketch's correction / removal stays");
});

test("A149 · a board row's company reaches its page through the hiring-data view (D147's logo, unchanged)", () => {
  const modal = fs.readFileSync("client/src/components/CompanyViewModal.jsx", "utf8");
  assert.match(modal, /data-open-company-page=""\s+onClick=\{\(\) => \{ onClose\(\); navigate\(companyPath\(company\)\); \}\}/);
  // 47j A248 (changed on purpose): the board's row is the Index's now (JobBubble's card is deleted) — its company opens the
  // company answer (D200 Rule 2, CompanyStackPopover), which links the company's own page
  const idx = fs.readFileSync("client/src/plate/MarketIndex.jsx", "utf8");
  assert.match(idx, /<CompanyStackPopover company=\{r\.company\}/, "the row's company still answers");
  assert.match(fs.readFileSync("client/src/plate/MarkPopover.jsx", "utf8"), /const href = company \? companyPath\(company\) : null;/, "and reaches its page");
});
