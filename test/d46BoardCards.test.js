// D46 (owner, 10-07) — CARD DEFECTS IN THE + AND /d VIEWS.
//
// (a) + cards showed only the upper half of their letters. FOUND: .jb__text was a fixed 52px flex
//     column (D1: three lines at the logo's height); D40 added a fourth line, and the flex children
//     SHRANK below their text — each with overflow:hidden — so every line was cut. Now min-height,
//     lines never shrink, line-height ≥ 1.2. Verified in the app: no clipped text node in ALL, /d or +
//     at 100 / 125 / 150% zoom (A92-style headless pass, 10-07).
// (b) /d cards were dead, logos missing. FOUND: before A91 (542a641, live 10-06 15:50Z), /d rendered RAW
//     database rows from /api/jobs/pending — job_id, company_icon_url — through a card that reads
//     jobId and companyIconUrl, so clicks found no job and logos no URL. A91 moved /d onto the board's
//     own query and mapJobRow. Verified in the app 10-07: a card click opens the posting panel and the
//     logo loads in every view.
// ⛔ The structural rule: ONE card component, rendered once, by all four views.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const css = read("client/src/components/JobBubble.css");
const panel = read("client/src/panels/JobsPanel.jsx");

test("D46(a) · the card's text block has a MIN-height and its lines never shrink — no glyph can be clipped", () => {
  assert.match(css, /\.jb__text \{[^}]*min-height: 52px;/);
  assert.doesNotMatch(css, /\.jb__text \{[^}]*[^-]height: 52px/, "a fixed height cuts a fourth line in half");
  assert.match(css, /\.jb__company, \.jb__title, \.jb__meta \{[^}]*flex-shrink: 0; line-height: 1\.25;/);
  for (const m of css.matchAll(/line-height:\s*([\d.]+)/g)) {
    if (Number(m[1]) !== 1) assert.ok(Number(m[1]) >= 1.2, `a text line-height below 1.2: ${m[0]}`);
  }
  assert.match(read("client/src/components/CompanyLink.css"), /line-height: 1\.25;/);
});

test("D46(b) · ONE card component, rendered once, for ALL · ★ · /d · +", () => {
  // 47j R2 (changed on purpose): the board's rows are the Index's — ONE render site (MarketIndexTable with rows), no JobBubble
  assert.equal((panel.match(/<JobBubble\b/g) || []).length, 0, "the classic card is back in the board");
  assert.equal((panel.match(/<MarketIndexTable\s+rows=/g) || []).length, 1, "a second row render site in the board");
  assert.doesNotMatch(panel, /import JobCard\b/, "the board imports a second card component");
  assert.match(panel, /const displayJobs = useMemo\(\(\) => jobs, \[jobs\]\);/, "every view renders the one list (A91)");
  assert.doesNotMatch(panel, /api\("\/api\/jobs\/pending"\)/, "/d rendered raw rows from its own endpoint");
  // Every row opens the posting. 47j R2 (changed on purpose): the Index's rows open the opening sheet (D199 C7), every job alike
  assert.match(panel, /onOpen=\{\(job\) => navigateSheet\(job\)\}/);
});
