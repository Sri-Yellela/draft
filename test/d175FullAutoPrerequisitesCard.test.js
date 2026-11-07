// ⛔ D175 FA6 · THE ADMIN CARD for the four checks FULL AUTO's own sends wait for (services/fullAutoGate.js). 45g built
// the gate and the route with no card; an admin had to POST by hand. The card sits beside the kill switch (Admin →
// System → Switches), reads GET /api/admin/full-auto/prerequisites, and records / clears the two tests with a reason.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";

const ops = fs.readFileSync(new URL("../client/src/panels/adminOps.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const panel = fs.readFileSync(new URL("../client/src/panels/AdminPanel.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("d175FullAutoPrerequisitesCard: reads the four checks, records the two tests with a reason, clears with a confirm", () => {
  const start = at(ops, "const FA6_RECORDABLE = ");
  const card = ops.slice(start, at(ops, "// ── D123 Tailoring", start));
  assert.match(card, /api\("\/api\/admin\/full-auto\/prerequisites"\)/, "GET on open");
  assert.match(card, /method: "POST", body: JSON\.stringify\(\{ check, \.\.\.body \}\)/, "POST { check, reason | clear }");
  assert.match(card, /\["kill_switch_verified", "never_twice_verified"\]/, "only the two tests are recordable here");
  assert.match(card, /trim\(\)\.length < 10/, "the button waits for a reason the server would accept (≥ 10 characters)");
  assert.match(card, /clear: true/);
  assert.match(card, /await ask\(/, "clearing asks first — it holds FULL AUTO again");
  assert.match(card, /data-admin-fullauto-prereqs/);
});

test("d175FullAutoPrerequisitesCard: mounted beside the kill switch", () => {
  assert.match(panel, /<KillSwitchSection theme=\{theme\}\/><FullAutoPrerequisitesSection theme=\{theme\}\/>/);
});
