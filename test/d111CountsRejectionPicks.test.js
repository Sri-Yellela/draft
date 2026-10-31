// ⭐ D111 · d111CountsRejectionPicks (owner 10-31: Draft House's "Note why" feeds D111 — "counts by quick pick only").
// Among the user's own rejections, a count per quick pick, each "k of n rejections", and how many carry no pick. A
// withdrawal is never a rejection; another user's rows are never read; nothing is compared or put in the headline.
// Synthetic applications only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { MIGRATIONS } from "../scripts/migrations.js";
import { callbackRates, rejectionPicks, picksOf, gatherCallbackApps } from "../services/callbackRates.js";
import { REJECTION_REASONS } from "../shared/applicationResponse.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 31, 12) / 1000);
const old = (o = {}) => ({ appliedAt: NOW - 60 * DAY, role: "Backend Engineer", ...o });
const many = (n, o) => Array.from({ length: n }, () => old(o));
const rej = (reasons) => ({ responseOutcome: "rejected", rejectionReasons: reasons });

test("d111CountsRejectionPicks — a count per pick among the rejections, 'k of n', in the list's order", () => {
  const apps = [
    ...many(6, rej(["not_a_fit"])), ...many(3, rej(["not_a_fit", "level"])), ...many(2, rej(["visa_eligibility"])),
    ...many(1, rej(["no_reason_given"])), ...many(4, rej([])),
    ...many(10, {}),                                                       // silent: not a rejection, in no pick count
    ...many(5, { responseOutcome: "interview" }),
  ];
  const r = callbackRates(apps, { now: NOW });
  assert.equal(r.shown, true);
  assert.equal(r.counted, 31);
  const w = r.whyNo;
  assert.equal(w.shown, true);
  assert.equal(w.title, "Why they said no");
  assert.equal(w.rejections, 16, "the denominator is the rejections only");
  assert.deepEqual(w.picks.map(p => p.key), Object.keys(REJECTION_REASONS), "every pick, in the one list's order");
  assert.deepEqual(w.picks.map(p => p.label), Object.values(REJECTION_REASONS), "the one list's words");
  assert.deepEqual(Object.fromEntries(w.picks.map(p => [p.key, p.of])), {
    not_a_fit: "9 of 16", level: "3 of 16", location: "0 of 16", visa_eligibility: "2 of 16", no_reason_given: "1 of 16",
  });
  assert.deepEqual(w.picks.map(p => p.count), [9, 3, 0, 2, 1]);
  assert.deepEqual(w.noPick, { label: "No pick noted", count: 4, of: "4 of 16" });
  // Counts only: no pick becomes the headline, and nothing in the block is a rate.
  assert.doesNotMatch(r.headline.text, /fit|level|location|visa|reason/i);
  for (const p of [...w.picks, w.noPick]) {
    assert.ok(Number.isInteger(p.count));
    assert.match(p.of, /^\d+ of \d+$/);
  }
  assert.doesNotMatch(JSON.stringify(w), /%|percent|Infinity|NaN|ratio|rate/i);
});

test("d111CountsRejectionPicks — a withdrawal is never a rejection; an unknown or repeated pick is not counted", () => {
  const apps = [...many(15, rej(["level", "level", "salary"])),
    ...many(5, { responseOutcome: "withdrawn", rejectionReasons: ["level"] })];
  const w = callbackRates([...apps, ...many(5, {})], { now: NOW }).whyNo;
  assert.equal(w.rejections, 15);
  assert.equal(w.picks.find(p => p.key === "level").of, "15 of 15", "each rejection counts a pick once");
  assert.equal(w.picks.reduce((s, p) => s + p.count, 0), 15, "'salary' is not a pick");
  assert.deepEqual(picksOf('["location","bogus","not_a_fit"]'), ["not_a_fit", "location"]);
  assert.deepEqual(picksOf("not json"), []);
  assert.deepEqual(picksOf(null), []);
  // The pure counter alone: only `rejected` rows.
  assert.equal(rejectionPicks([...many(15, rej(["level"])), ...many(9, { responseOutcome: "withdrawn", rejectionReasons: ["level"] })]).rejections, 15);
});

test("d111CountsRejectionPicks — the card on The Table draws the server's 'k of n' per pick in D111's own place, nothing of its own", () => {
  const src = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8").replace(/\r\n/g, "\n");
  const card = src.slice(at(src, "function CallbackRatesCard("), at(src, "\n}\n", at(src, "function CallbackRatesCard(")));
  const block = card.slice(at(card, "{whyNo?.shown ? ("), at(card, "{notSplit.map("));
  assert.ok(at(card, "{splits.map(") < at(card, "{whyNo?.shown ? ("), "inside the card's details, after the splits");
  assert.match(block, /\[\.\.\.whyNo\.picks, whyNo\.noPick\]\.map\(p => \(/);
  assert.match(block, /<span>\{p\.of\} rejections<\/span>/, "the server's own 'k of n'");
  assert.match(block, /fewer than \{minCount\}, not counted yet\./, "below the minimum it says so, with no pick");
  for (const bad of ["%", "toFixed", "* 100", "Math.round", "/ whyNo", "/ p.", "sort(", "rejection_note", ".note"]) {
    assert.ok(!block.includes(bad), `the card must not compute or read: ${bad}`);
  }
  assert.doesNotMatch(block, /999px|rounded-full|borderRadius:\s*"50%"/, "D60: no pills");
});

test("d111CountsRejectionPicks — from the tables: the user's own rejections' picks, through the one reader", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  const ins = db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, applied_at, response_outcome, rejection_note, rejection_reasons)
    VALUES (?, ?, 'Northwind', 'Backend Engineer', ?, ?, ?, ?)`);
  for (let i = 0; i < 15; i++) ins.run(1, `r${i}`, NOW - 60 * DAY, "rejected", i < 3 ? "a private note" : null, i < 5 ? '["location"]' : null);
  ins.run(1, "w", NOW - 60 * DAY, "withdrawn", null, '["location"]');
  for (let i = 0; i < 20; i++) ins.run(2, `o${i}`, NOW - 60 * DAY, "rejected", null, '["location","level"]'); // another user's
  const rows = gatherCallbackApps(db, 1);
  assert.equal(rows.length, 16);
  assert.deepEqual(rows[0].rejectionReasons, ["location"], "the picks arrive as keys");
  const w = callbackRates(rows, { now: NOW }).whyNo;
  assert.equal(w.rejections, 15);
  assert.equal(w.picks.find(p => p.key === "location").of, "5 of 15");
  assert.equal(w.picks.find(p => p.key === "level").of, "0 of 15", "another user's picks are never read");
  assert.equal(w.noPick.of, "10 of 15");
});
