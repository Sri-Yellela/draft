import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const raw = fs.readFileSync("client/src/panels/DeckView.jsx", "utf8").replace(/\r\n/g, "\n");
// Code only: the header comments NAME approvalMode to explain why the deck never sends it.
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const app = fs.readFileSync("client/src/App.jsx", "utf8").replace(/\r\n/g, "\n");

test("⛔ the deck's Draft call carries surface:'deck' and NEVER an approvalMode", () => {
  const start = at(src, 'api("/api/apply/runs"', 0, "the deck's Draft call");
  const call = src.slice(start, start + 260);
  assert.match(call, /surface: "deck"/);
  assert.doesNotMatch(call, /approvalMode/, "the deck asks for no review — the route would refuse it, and the client must not try");
  assert.doesNotMatch(src, /approvalMode/, "no approvalMode anywhere in the deck");
});

test("every deck motion is under ONE reduced-motion config", () => {
  assert.match(src, /<MotionConfig reducedMotion="user">/);
  const opens = (src.match(/<MotionConfig/g) || []).length;
  assert.equal(opens, 1);
  assert.ok(at(src, "<MotionConfig", 0, "config") < at(src, "<AnimatePresence", 0, "presence"), "an animation sits outside the config");
});

test("the deck shows a band and never a score", () => {
  assert.doesNotMatch(src, /matchScore|atsScore/, "the deck reads a score");
  assert.match(src, /bandChipStyle\(band\)/);
});

test("/app lands on Today, and the board keeps /app/jobs", () => {
  assert.match(app, /\{ id: "today",\s+label: "Today" \}/);
  assert.match(app, /if \(!routeKey\) \{\s*navigate\("\/app\/today", \{ replace:true \}\);/);
  assert.match(app, /activeTab === "today"\s+&& <DeckView/);
});
