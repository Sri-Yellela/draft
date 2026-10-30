// ⭐ D111 (owner 10-30) · WHAT IS WORKING — d111NoBarePercent. Every figure leaves the server as "k of n"; no percentage,
// and no rate a client could print as one, is in the payload; the card draws only the server's words. Synthetic data.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { callbackRates } from "../services/callbackRates.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 30, 12) / 1000);
const old = (o = {}) => ({ appliedAt: NOW - 60 * DAY, role: "Data Engineer", ...o });
const many = (n, o) => Array.from({ length: n }, () => old(o));

const payloads = [
  callbackRates([...many(6, { daysToApply: 1, responseOutcome: "interview" }), ...many(14, { daysToApply: 1 }),
    ...many(2, { daysToApply: 20, responseOutcome: "rejected" }), ...many(18, { daysToApply: 20 })], { now: NOW }),
  // the lower group has no replies at all: "more", never a division by zero or "Infinity"
  callbackRates([...many(5, { livenessKind: "new", inboxCategories: ["assessment"] }), ...many(12, { livenessKind: "new" }),
    ...many(16, { livenessKind: "reposted" })], { now: NOW }),
  callbackRates(many(20, { version: { tailored: true, uploadId: 3, uploadedAt: NOW - 90 * DAY } }), { now: NOW }),
];

function walk(v, visit, path = "$") {
  visit(v, path);
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, visit, `${path}.${k}`);
}

test("D111 · d111NoBarePercent — no percent sign and no fractional rate anywhere in the payload", () => {
  for (const p of payloads) {
    assert.equal(p.shown, true);
    walk(p, (v, path) => {
      if (typeof v === "string") {
        assert.doesNotMatch(v, /%|percent|Infinity|NaN/i, `${path}: ${v}`);
      }
      if (typeof v === "number") assert.ok(Number.isInteger(v), `${path} is a count, not a rate: ${v}`);
    });
  }
});

test("D111 · every headline carries both counts; every group's figures are 'k of n'", () => {
  assert.equal(payloads[0].headline.text, "Applications sent within 3 days of posting got 3× the replies.");
  assert.equal(payloads[0].headline.detail, "6 of 20 vs 2 of 20");
  assert.equal(payloads[1].headline.text, "Applications to first-time postings under 30 days old got more replies.");
  assert.equal(payloads[1].headline.detail, "5 of 17 vs 0 of 16");
  assert.match(payloads[2].headline.text, /^\d+ of \d+ applications got a reply, and \d+ of \d+ an interview\.$/);
  for (const p of payloads) {
    assert.match(p.headline.detail, /\d+ of \d+|each side needs 15/);
    for (const s of p.splits) for (const g of s.groups) {
      assert.match(g.replies, /^\d+ of \d+$/);
      assert.match(g.interviews, /^\d+ of \d+$/);
    }
  }
});

test("D111 · the card on The Table sits above History and computes no rate of its own", () => {
  const src = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8").replace(/\r\n/g, "\n");
  const card = src.slice(at(src, "function CallbackRatesCard("), at(src, "\n}\n", at(src, "function CallbackRatesCard(")));
  assert.match(card, /api\("\/api\/pipeline\/callback-rates"\)/);
  assert.match(card, /if \(!data\?\.shown \|\| !data\.headline\) return null;/, "nothing below the minimum");
  for (const bad of ["%", "toFixed", "* 100", "Math.round", "/ g.n", "percent"]) assert.ok(!card.includes(bad), `the card must not compute: ${bad}`);
  assert.match(card, /\{headline\.detail\}/, "the counts are drawn with the headline");
  assert.ok(at(src, '{activeSheet === "history" && <CallbackRatesCard theme={theme}/>}') < at(src, "<ApplicationHistory onOpenPending"),
    "above History");
  assert.doesNotMatch(card, /999px|rounded-full|borderRadius:\s*"50%"/, "D60: no pills");
});
