// ⭐ D200 Rule 3 (47h, D197 Wave 1 #3) · A HEADER THAT EARNS ITS SPACE — the ledger (Home) is a working page: one plain
// serif line (≈ 34–44 px, the thing in plain words) under a mono kicker for the where / when, at most one short sentence,
// and the counts do the rest. Not the board's 100 px "The ledger." + its lead (the destination title stays for the survey
// sheet, a destination).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { renderFixture } from "../test-support/renderPlateFixture.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d200HeaderOneLine: the ledger's header is one plain line + a kicker, no page title, no lead", async () => {
  const html = await renderFixture("LedgerBoard");
  const head = html.slice(html.indexOf('aria-labelledby="lg-title"'), html.indexOf("pl-lg-run"));
  assert.equal((head.match(/<h1/g) || []).length, 1);
  assert.match(head, /<h1 id="lg-title" class="pl-lg-title" data-ledger-title="">Your applications<\/h1>/, "the thing in plain words, no clay full stop");
  assert.doesNotMatch(head, /pl-title|pl-title__stop|pl-lead"/, "no 100 px page title, no lead paragraph");
  assert.match(head, /THE LEDGER<\/span>.*YOUR APPLICATIONS<\/span>.*WEEK 47<\/span>/, "the mono kicker: where and when");
  assert.ok((head.match(/<p /g) || []).length <= 1, "at most one short sentence");
});

test("d200HeaderOneLine: the line is 34–44 px (the type token), and the survey sheet keeps its destination title", () => {
  const tokens = read("client/src/styles/plate.css");
  const px = Number((/--pl-t-working: calc\((\d+)px/.exec(tokens) || [])[1]);
  assert.ok(px >= 34 && px <= 44, `a working page's line is 34–44 px (got ${px})`);
  assert.match(read("client/src/plate/sheets.css"), /\.pl-lg-title \{[^}]*font-size: var\(--pl-t-working\)/);
  assert.match(read("client/src/plate/SurveySheet.jsx"), /className="pl-title pl-sv-title"/, "a survey sheet is a destination: the big title stays");
});

test("d200HeaderOneLine: the counts in the header filter the register (every number answers)", async () => {
  const html = await renderFixture("LedgerBoard");
  for (const k of ["needs", "progress", "sent", "replied", "interview"]) {
    assert.match(html, new RegExp(`data-ledger-count="${k}"><button type="button" class="pl-stats__act"`), `${k} is a button`);
  }
  assert.match(html, /data-tone="clay" data-act="" data-ledger-count="needs"/, "needs you goes clay when something needs you");
});
