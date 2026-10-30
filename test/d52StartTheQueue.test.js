// D52 (owner, 10-07) — "START THE QUEUE: nothing starts a drafted job today."
//
// ⛔ VERIFIED FIRST, and the premise is REFUTED: the Draft click IS the start. Measured on a throwaway
// server (synthetic account, postings pointed at the local fake ATS), one Draft per tier, all four out of
// "queued" within 30 s, each to a state that says what happens next:
//   greenhouse → filled, held_review / awaiting_approval → the approval queue (Approve writes the résumé —
//                D17's one model call — and submits, attended)
//   lever, ashby → held_review / incomplete_form, a handoff packet READY (Fill → the extension fills it)
//   workable → held_review / provider_review_only, a packet READY
// ⚠ The row's "a packet expires (~10 minutes)" is the TOKEN, minted fresh on every Fill. The packet goes
// stale after 72 h — and a stale one offered only "Open" with a message saying "Run it again", and no
// button that did. That, and the cost said before the click, are what this builds.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { packetLife } from "../client/src/lib/draftHouseExceptions.js";
import { draftButtonState } from "../client/src/lib/jobDecisions.js";
import { PACKET_STALE_MS } from "../services/applyGatePacket.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const H = 3600000;

test("D52 · a prepared packet says how long it is good for", () => {
  assert.equal(packetLife({ ageMs: H, staleAfterMs: PACKET_STALE_MS }).line, "Ready to fill — fresh for 2 more days.");
  assert.equal(packetLife({ ageMs: 47 * H, staleAfterMs: PACKET_STALE_MS }).line, "Ready to fill — fresh for 1 more day.");
  assert.equal(packetLife({ ageMs: 70 * H, staleAfterMs: PACKET_STALE_MS }).line, "Ready to fill — fresh for 2 more hours.");
  assert.equal(packetLife({ ageMs: H, staleAfterMs: PACKET_STALE_MS }).action, "fill");
});

test("D52 · a lapsed packet is never silently dead — it is one click from fresh", () => {
  for (const p of [{ stale: true, ageMs: 80 * H, staleAfterMs: PACKET_STALE_MS }, { ageMs: 73 * H, staleAfterMs: PACKET_STALE_MS }]) {
    const life = packetLife(p);
    assert.equal(life.state, "stale");
    assert.equal(life.action, "prepare");
    assert.match(life.line, /prepare again/);
  }
  assert.equal(packetLife({ postingGone: true }).action, "open", "nothing to prepare when the posting is gone");
});

test("D52 · Draft House offers Prepare again on a STALE packet — and only there", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  const held = panel.slice(at(panel, 'case "held": {'), at(panel, 'case "broke": {'));
  assert.match(held, /const prepare = !resumable && !r\.postingGone && !!packet && life\.state === "stale";/,
    "a hold with no packet (a cap, the pause) is not cleared by drafting again");
  assert.match(held, /label: "Prepare again"[\s\S]{0,300}onClick: \(\) => retryJob\(r\.primary\?\.row \|\| r\)/, "one click: a new Draft");
  assert.match(held, /it uses one of your drafts/, "the cost is said before the click");
  assert.match(held, /\$\{life\.line\} Opens the application in your own browser/, "Fill says how fresh it is");
});

test("D52 · the Draft button states its cost before the click", () => {
  assert.match(draftButtonState({ slots: { remaining: 7 } }).title, /Uses 1 of your 7 drafts left/);
  assert.match(draftButtonState({ slots: { remaining: 1 } }).title, /Uses 1 of your 1 draft left/);
  assert.doesNotMatch(draftButtonState({}).title, /Uses/, "no number when none was measured");
});

test("D52 · a Draft starts at once or waits in line — it is never parked as 'queued' with nothing to start it", () => {
  const src = read("routes/apply.js");
  const start = src.slice(at(src, "  function startRun("), at(src, '  app.post("/api/apply/runs"'));
  // Not waiting → processed now; waiting → the line starts it when the slot frees (dispatchLine).
  assert.match(start, /if \(mustWait\) \{[\s\S]{0,300}dispatchLine\(userId\);[\s\S]{0,200}\} else \{\n\s+setImmediate\(\(\) => processRun\(run\)/);
  // ⛔ A Draft never sends unattended: it is a preview that waits for approval. D100: sending without review is the
  // user's FULL AUTO mode, checked at admission (test/d36ApplyPaths.test.js §7), not a constant.
  assert.match(src, /resolvedMode === "auto" && resolvedApproval === "auto" && userApplyMode\(userId\) !== "auto"/);
});
