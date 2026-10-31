// ⭐ D111 · d111PicksRespectMinimumSample (owner 10-31). D111 is "shown only past a minimum count (default 15), with the
// count, never as a bare percentage" — the Note why picks follow the same rule: below 15 rejections no pick is counted
// in the payload at all (only how many rejections there are); at 15 every pick is "k of 15". Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import { callbackRates, rejectionPicks, MIN_COUNT } from "../services/callbackRates.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 31, 12) / 1000);
const old = (o = {}) => ({ appliedAt: NOW - 60 * DAY, role: "Data Engineer", ...o });
const many = (n, o) => Array.from({ length: n }, () => old(o));
const rej = (reasons) => ({ responseOutcome: "rejected", rejectionReasons: reasons });

test("d111PicksRespectMinimumSample — below 15 rejections the picks are not counted, even when the card is shown", () => {
  assert.equal(MIN_COUNT, 15);
  // 14 rejections + 30 silent: the card is shown (44 counted), the picks are not.
  const r = callbackRates([...many(14, rej(["level"])), ...many(30, {})], { now: NOW });
  assert.equal(r.shown, true);
  assert.deepEqual(r.whyNo, { shown: false, title: "Why they said no", rejections: 14, minCount: 15, picks: [], noPick: null });
  assert.ok(!JSON.stringify(r.whyNo).includes("level"), "no pick's count leaves the server below the minimum");
  // Young applications waiting for an answer do not lift it: a rejection is counted, a wait is not a rejection.
  const w = callbackRates([...many(14, rej(["level"])), ...Array.from({ length: 10 }, () => ({ appliedAt: NOW - 2 * DAY })), ...many(5, {})], { now: NOW });
  assert.equal(w.whyNo.shown, false);
});

test("d111PicksRespectMinimumSample — at 15 rejections every pick is shown as 'k of 15'; the minimum is the card's", () => {
  const at15 = callbackRates(many(15, rej(["level"])), { now: NOW }).whyNo;
  assert.equal(at15.shown, true);
  assert.equal(at15.picks.find(p => p.key === "level").of, "15 of 15");
  assert.equal(at15.picks.find(p => p.key === "location").of, "0 of 15");
  // A lower minimum (the card's parameter) moves the picks' threshold with it — one rule, not a second number.
  assert.equal(callbackRates(many(8, rej(["level"])), { now: NOW, minCount: 8 }).whyNo.shown, true);
  assert.equal(callbackRates(many(7, rej(["level"])), { now: NOW, minCount: 8 }).whyNo.shown, false);
  assert.equal(rejectionPicks(many(14, rej(["level"]))).shown, false, "the default is MIN_COUNT");
});

test("d111PicksRespectMinimumSample — below the card's own minimum there is no card and no picks", () => {
  const r = callbackRates(many(10, rej(["not_a_fit"])), { now: NOW });
  assert.equal(r.shown, false);
  assert.equal(r.whyNo.shown, false);
  assert.deepEqual(r.whyNo.picks, []);
});
