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
  const tabs = app.slice(at(app, "const BOARD_TABS = ["), at(app, "];", at(app, "const BOARD_TABS = [")));
  // ⭐ D147 (owner 11-03) changed this on purpose: the views are WORDS now (inside the Sort / view panel) — "Pending".
  assert.match(tabs, /\["pending",\s+"Pending",\s+"Pending apply"\]/);
  assert.doesNotMatch(tabs, /⏳/);
});

test("⛔ D11: no IMPORT control on the board — and the extension's import route stays", () => {
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
  assert.match(read("client/src/components/JobBubble.jsx"), /<div className="jb-rows" data-columns=\{1\}>\{jobs\.map\(children\)\}<\/div>/);
  assert.match(read("client/src/panels/JobsPanel.jsx"), /const PAGE_SIZE = 50;/);
});
