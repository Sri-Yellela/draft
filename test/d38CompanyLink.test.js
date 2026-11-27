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

// ⛔ 47m (changed on purpose): "D38(a) · no underline and no arrow at rest — and a NON-COLOUR cue on hover and f" retired — the posting panel is deleted (D199 C7): a job opens as its opening sheet (plate/OpeningSheet.jsx, SheetResume.jsx), pinned by d199Market47h and a204.

test("D38(c) · ONE company link: no surface builds its own", () => {
  const offenders = [];
  for (const f of walk("client/src")) {
    if (/CompanyLink\.jsx$/.test(f)) continue;
    const src = read(f);
    if (/data-apply-link/.test(src)) offenders.push(`${f}: an apply link outside CompanyLink`);
    if (/company[\w.?|\s"]*\}\s*↗/.test(src)) offenders.push(`${f}: a company name with an arrow`);
  }
  assert.deepEqual(offenders, []);
  // 47j A248 (changed on purpose): JobBubble's card is deleted — the Index row's company answers through CompanyStackPopover (a149)
  for (const f of ["client/src/components/JobCard.jsx"]) {
    assert.match(read(f), /<CompanyLink /, `${f} no longer uses the one company link`);
  }
  // ⭐ A157 (45q): the Pending list re-opens the employer's form — the ONE apply link, from the same file.
  assert.match(read("client/src/components/PendingApplications.jsx"), /<ApplyLink /);
});
