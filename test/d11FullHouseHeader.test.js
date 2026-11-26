// D11 (10-03): Full House — "Let's get to work.", the Pending chip is the draft mark, NO IMPORT
// control, at most 3 tiles per row, ~50 per page. D1's bubble geometry is untouched
// (test/jobBubbleD1.test.js still pins grow 1.55 / neighbours give up width / rows never wrap).
//
// ⛔ IMPORT is gone from the board, not from the product: the extension posts to the same
// /api/import/job route (extension/background.js), which this guard keeps alive.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const strip = (t) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const app = read("client/src/App.jsx");
const appCode = strip(app);

// D26/D30 (10-04) replaced D11's caption with the filter sentence itself: the headline is what you
// are looking at. D11's negatives (no greeting, no second line) still hold.
test("D11 → D26: the header is ONE line — the filter sentence, where the caption was", () => {
  assert.doesNotMatch(appCode, /Let's get to work\./);
  assert.match(appCode, /<BoardHeadlineSlot \/>/);
  assert.doesNotMatch(appCode, /Your jobs\./);
  assert.doesNotMatch(appCode, /Pick up where you left off/);
  assert.doesNotMatch(appCode, /Welcome back, \$\{/);
});

test("D11: the Pending chip carries the draft mark, not an hourglass", () => {
  // 47j R2 (changed on purpose): the views are the area nav's (MARKET_AREA_VIEWS)
  const tabs = app.slice(at(app, "const MARKET_AREA_VIEWS = ["), at(app, "];", at(app, "const MARKET_AREA_VIEWS = [")));
  // ⭐ D147 (owner 11-03) changed this on purpose: the views are WORDS now. ⭐ D156 (4) changed it again on purpose (owner
  // 11-05: "we dont need the drafted panel now"): Home offers All jobs · Starred · Imported — no Pending / Drafted view, so
  // neither a glyph nor the mark can be on one.
  assert.doesNotMatch(tabs, /"pending"/);
  assert.doesNotMatch(tabs, /⏳/);
});

// ⭐ D156 (4) changed this on purpose (owner 11-05: "missing are … the import job function … the starred and imported has to
// be there and the import function"): "Import a job" is back — INLINE under the search (BoardBar.jsx ImportJobBox), on the
// same route the extension uses; still no modal (test/d156Home.test.js d156ImportAJobInline).
test("⛔ D11: no import MODAL on the board — the inline Import a job uses the extension's import route, which stays", () => {
  assert.doesNotMatch(appCode, /ImportJobModal|setImportOpen|importOpen/);
  assert.doesNotMatch(appCode, /> Import\s*</);
  assert.ok(!fs.existsSync("client/src/components/ImportJobModal.jsx"), "the import modal is back");
  assert.match(read("extension/background.js"), /'\/api\/import\/job'/);
  assert.match(read("routes/importJob.js"), /router\.post\("\/job"/);
  assert.match(read("server.js"), /app\.use\("\/api\/import", requireAuth, createImportJobRouter\(/);
});

test("D11: never more than 3 tiles per row; ~50 per page", () => {
  // D149 (11-03) changed this on purpose: fullhouse-declutter.html draws the postings as ONE column of rows (`.list`), so
  // lib/bubbleColumns.js (2 or 3 per row) is deleted — one per row is within D11's "never more than 3".
  assert.ok(!fs.existsSync("client/src/lib/bubbleColumns.js"), "the per-row column rule is back");
  // 47j A248 (changed on purpose): the bubble rows are deleted — the board's rows are the Index's, one opening per line
  assert.match(read("client/src/panels/JobsPanel.jsx"), /<MarketIndexTable\s+rows=\{jobs\.map\(/);
  assert.match(read("client/src/panels/JobsPanel.jsx"), /const PAGE_SIZE = 50;/);
});
