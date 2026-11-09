// D38 (owner, 10-06) — COMPANY NAMES: the same everywhere, and the link is the TEXT ONLY.
//
// (a) The posting panel still showed the underline and the ↗ the card lost in A78.
// (b) On the board, a click on the company name's LINE — where there is no text — followed the link:
//     the card's anchor was a flex child of a column (stretched to the full width), the panel's was
//     display:block. No overlay and no row handler were involved.
// (c) The sweep — every call site that rendered a company link, each now the ONE CompanyLink:
//       board card (JobBubble) · the older JobCard · the posting panel (JobDetailPanel) · Pending Apply
//       (PendingApplications). The + view uses the board card. Plain-text names, not links, on: the
//       deck (DeckView), the ATS panel header (AtsReportPanel), The Table's History rows, admin — and the
//       extension page shows none.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const css = read("client/src/components/CompanyLink.css");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.jsx?$/.test(e.name) ? [path.join(dir, e.name)] : []);
}

test("D38(b) · the anchor is exactly as wide as its text — never stretched, no overlay", () => {
  const rule = css.slice(at(css, ".company-link {"), at(css, "}", at(css, ".company-link {")));
  for (const decl of ["display: inline-block;", "width: fit-content;", "max-width: 100%;", "align-self: flex-start;"]) {
    assert.ok(rule.includes(decl), `.company-link lost ${decl}`);
  }
  assert.doesNotMatch(css, /::before|::after|position:\s*absolute/, "an overlay would widen the hit area again");
  const jsx = read("client/src/components/CompanyLink.jsx");
  assert.match(jsx, /e\.stopPropagation\(\);/, "the name's click is its own; the card's click works everywhere else");
});

test("D38(a) · no underline and no arrow at rest — and a NON-COLOUR cue on hover and focus (A78)", () => {
  assert.match(css, /text-decoration: none;/);
  assert.match(css, /a\.company-link:hover, a\.company-link:focus-visible \{ text-decoration: underline; \}/);
  assert.match(css, /font-style: italic; font-weight: 800;/, "the logo face");
  assert.doesNotMatch(read("client/src/components/CompanyLink.jsx"), /↗/);
  const panel = read("client/src/components/JobDetailPanel.jsx");
  assert.match(panel, /<CompanyLink company=\{selectedJob\.company\} jobId=\{jobId\} size="panel" \/>/);
  assert.doesNotMatch(panel, /\{selectedJob\.company\} ↗/, "the posting panel's name is underlined with an arrow again");
});

test("D38(c) · ONE company link: no surface builds its own", () => {
  const offenders = [];
  for (const f of walk("client/src")) {
    if (/CompanyLink\.jsx$/.test(f)) continue;
    const src = read(f);
    if (/data-apply-link/.test(src)) offenders.push(`${f}: an apply link outside CompanyLink`);
    if (/company[\w.?|\s"]*\}\s*↗/.test(src)) offenders.push(`${f}: a company name with an arrow`);
  }
  assert.deepEqual(offenders, []);
  for (const f of ["client/src/components/JobBubble.jsx", "client/src/components/JobCard.jsx",
                   "client/src/components/JobDetailPanel.jsx"]) {
    assert.match(read(f), /<CompanyLink /, `${f} no longer uses the one company link`);
  }
  // ⭐ A157 (45q): the Pending list re-opens the employer's form — the ONE apply link, from the same file.
  assert.match(read("client/src/components/PendingApplications.jsx"), /<ApplyLink /);
});
