// ⭐ D111 (owner 10-30) · WHAT IS WORKING — d111MinimumCountShown. The card is shown only past a minimum count (15),
// counts only applications old enough to tell (a reply, or 30 days), and a group below the minimum never makes the
// headline. Synthetic applications only.
import test from "node:test";
import assert from "node:assert/strict";
import { callbackRates, MIN_COUNT, answerOf } from "../services/callbackRates.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 30, 12) / 1000);
const old = (o = {}) => ({ appliedAt: NOW - 60 * DAY, role: "Backend Engineer", ...o });
const many = (n, o) => Array.from({ length: n }, () => old(o));

test("D111 · the minimum is 15 by default; below it the card is not shown, at it it is", () => {
  assert.equal(MIN_COUNT, 15);
  const below = callbackRates(many(14, { responseOutcome: "rejected" }), { now: NOW });
  assert.equal(below.shown, false);
  assert.equal(below.headline, null);
  assert.deepEqual(below.splits, []);
  assert.equal(below.counted, 14);
  const at15 = callbackRates(many(15, {}), { now: NOW });
  assert.equal(at15.shown, true);
  assert.equal(at15.headline.text, "0 of 15 applications got a reply, and 0 of 15 an interview.");
  assert.equal(callbackRates(many(9, {}), { now: NOW, minCount: 8 }).shown, true, "the minimum is a parameter");
});

test("D111 · a young application with no answer is in no count; a reply counts at once", () => {
  const young = { appliedAt: NOW - 5 * DAY };
  assert.equal(answerOf(young, { now: NOW }).counted, false);
  assert.deepEqual(answerOf({ ...young, inboxCategories: ["interview"] }, { now: NOW }), { counted: true, replied: true, interviewed: true });
  assert.equal(answerOf({ ...young, inboxCategories: ["applied", "verification", "reminder"] }, { now: NOW }).counted, false,
    "a receipt, a code and a reminder are the system talking, not a reply");
  assert.deepEqual(answerOf(old({ responseOutcome: "rejected" }), { now: NOW }), { counted: true, replied: true, interviewed: false });
  assert.equal(answerOf({ appliedAt: NOW - 60 * DAY, responseOutcome: "withdrawn" }, { now: NOW }).counted, false);
  const r = callbackRates([...many(14, {}), ...Array.from({ length: 10 }, () => young)], { now: NOW });
  assert.equal(r.shown, false, "10 waiting applications do not lift 14 past the minimum");
  assert.equal(r.waiting, 10);
});

test("D111 · a group below the minimum is listed as too few and never enters the headline", () => {
  // 15 fresh with 6 replies, 15 late with 1 — and 5 mid with 5 replies (the highest rate, but only 5).
  const apps = [
    ...many(6, { daysToApply: 1, responseOutcome: "screen" }), ...many(9, { daysToApply: 2 }),
    ...many(1, { daysToApply: 30, responseOutcome: "rejected" }), ...many(14, { daysToApply: 40 }),
    ...many(5, { daysToApply: 8, responseOutcome: "interview" }),
  ];
  const r = callbackRates(apps, { now: NOW });
  assert.equal(r.headline.split, "daysToApply");
  assert.equal(r.headline.text, "Applications sent within 3 days of posting got 6× the replies.");
  assert.equal(r.headline.detail, "6 of 15 vs 1 of 15");
  const mid = r.splits.find(s => s.key === "daysToApply").groups.find(g => g.key === "d4_14");
  assert.equal(mid.enough, false);
  assert.equal(mid.replies, "5 of 5");
});

test("D111 · a small gap is not a headline; the totals are, with their counts", () => {
  const apps = [...many(4, { daysToApply: 1, responseOutcome: "rejected" }), ...many(11, { daysToApply: 1 }),
    ...many(3, { daysToApply: 30, responseOutcome: "rejected" }), ...many(12, { daysToApply: 30 })];
  const r = callbackRates(apps, { now: NOW });
  assert.equal(r.headline.split, null);
  assert.equal(r.headline.text, "7 of 30 applications got a reply, and 0 of 30 an interview.");
});
