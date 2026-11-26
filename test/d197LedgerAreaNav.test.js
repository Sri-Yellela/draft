// ⭐ D197 #3 (47i) · HOME'S AREA NAV = THE FINAL LEDGER BOARD'S VIEWS. The approved board (docs/sketches/final/project/
// Ledger.dc.html) draws Home's area nav as Needs you · In progress · Sent · Replies. Each view presses the ledger header's
// own count cell (data-ledger-count), so the register has ONE filter — the nav never keeps a second one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d197LedgerAreaNav: the views are the board's, in its order", () => {
  const board = read("docs/sketches/final/project/Ledger.dc.html");
  const from = at(board, 'aria-label="Ledger"');
  const nav = board.slice(from, at(board, "</nav>", from));
  const boardViews = [...nav.matchAll(/<\/svg>([^<]+)<\/a>/g)].map((m) => m[1].trim());
  assert.deepEqual(boardViews, ["Needs you", "In progress", "Sent", "Replies"], "the board's own views (re-read if the board changes)");
  const app = read("client/src/App.jsx");
  const list = app.slice(at(app, "const LEDGER_AREA_VIEWS = ["), at(app, "const ledgerCell = "));
  assert.deepEqual([...list.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), boardViews);
});

test("d197LedgerAreaNav: a view presses the header's count cell (one filter), and the nav shows on Home with the plate switch", () => {
  const app = read("client/src/App.jsx");
  const nav = app.slice(at(app, "function LedgerAreaNav("), at(app, "function AppAreaNavSlot("));
  assert.match(app.slice(at(app, "const ledgerCell = "), at(app, "function LedgerAreaNav(")), /\[data-ledger-count="\$\{cell\}"\] button/);
  assert.match(nav, /b\.click\(\)/, "it presses the cell, never sets a filter of its own");
  assert.doesNotMatch(nav, /setFilter|filter:/, "no second filter state");
  assert.match(app, /if \(!market && activeTab === "auto-apply" && marketPlate\) return <LedgerAreaNav onHome=\{onHome\} \/>;/);
  const model = read("client/src/plate/ledgerModel.js");
  for (const cell of ["needs", "progress", "sent", "replied"]) assert.match(model, new RegExp(`cell\\("${cell}"`), `the header has a ${cell} cell`);
  assert.match(model, /attrs: \{ "data-ledger-count": key \}/);
});
