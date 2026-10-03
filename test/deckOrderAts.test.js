// A75 (owner, 10-03) — "ATS match" as a SORT on the jobs page AND the daily draft. The sort ships now;
// showing the number waits on A76. ⛔ The deck's score orders the cards and never leaves the server.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { orderByAts, DECK_ORDERS } from "../services/dailyDraft.js";
import { SORTS } from "../shared/jobFilterOptions.js";

const card = (id, position) => ({ position, band: "moderate", job: { id }, why: {}, report: null });

test("⭐ ATS match orders Strong, Moderate, NOT ESTABLISHED, Weak — then the score, then the dealt position", () => {
  const cards = [card("weak", 0), card("none", 1), card("mod", 2), card("strong-lo", 3), card("strong-hi", 4), card("strong-tie", 5)];
  const scores = { weak: 10, none: null, mod: 30, "strong-lo": 50, "strong-hi": 80, "strong-tie": 50 };
  const got = orderByAts(cards, (id) => scores[id]).map(c => c.job.id);
  assert.deepEqual(got, ["strong-hi", "strong-lo", "strong-tie", "mod", "none", "weak"],
    "a declined score sorts between Moderate and Weak — never last, never as a zero");
  // The cards come back untouched: no score is added to any of them.
  for (const c of orderByAts(cards, (id) => scores[id])) assert.ok(!("score" in c) && !("matchScore" in c.job));
});

test("the route accepts only 'dealt' and 'ats', defaults to dealt, and looks the score up server-side", () => {
  assert.deepEqual([...DECK_ORDERS], ["dealt", "ats"]);
  const src = fs.readFileSync("server.js", "utf8");
  assert.match(src, /const order = String\(req\.query\.order \|\| "dealt"\);\s*if \(!DECK_ORDERS\.includes\(order\)\) \{\s*return res\.status\(400\)/);
  assert.match(src, /todaysDeck\(db, \{ userId: req\.user\.id, profileId: profile\.id, date, fetchBoardPage, reportFor, order, scoreFor \}\)/);
});

test("the deck offers Dealt | ATS match and asks the server for that order", () => {
  const deck = fs.readFileSync("client/src/panels/DeckView.jsx", "utf8");
  assert.match(deck, /\/api\/draft\/today\?date=\$\{encodeURIComponent\(localDate\(\)\)\}&order=\$\{deckOrder\}/);
  assert.match(deck, /\{opt\("dealt", "Dealt"\)\}\{opt\("ats", "ATS match"\)\}/);
  assert.match(deck, /aria-pressed=\{order === value\}/);
});

test("the jobs page's sort is named the same: ATS match", () => {
  assert.ok(SORTS.options.some(o => o.value === "atsScore" && o.label === "ATS match"));
});
