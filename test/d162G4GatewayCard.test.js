// ⭐ D162 G4 (46f) · the model gateway's Admin card — every task's route and last 7 days, a switch applied now and a roll
// back, each with a reason; the card only ASKS (routes/modelGateway.js and services/modelGateway.js hold the rules).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const CARD = read("client/src/panels/adminGateway.jsx");

test("d162G4GatewayCard: mounted on Admin → System → Usage, beside the usage table, and in the admin module", () => {
  assert.match(read("client/src/panels/AdminPanel.jsx"), /\{at\("system", "usage"\) && <><ModelUsageTab\/><ModelGatewaySection\/><\/>\}/);
  assert.ok(read("client/src/modules.manifest.js").includes('"panels/adminGateway.jsx"'));
});

test("d162G4GatewayCard: it reads the tasks and 7 days of telemetry, and changes only through the gateway's own routes", () => {
  assert.match(CARD, /api\("\/api\/admin\/model-gateway"\)/);
  assert.match(CARD, /api\("\/api\/admin\/model-gateway\/telemetry\?days=7"\)/);
  assert.match(CARD, /\/api\/admin\/model-gateway\/tasks\/\$\{encodeURIComponent\(task\.id\)\}\/change`, \{ method: "POST"/);
  assert.match(CARD, /\/api\/admin\/model-gateway\/tasks\/\$\{encodeURIComponent\(task\.id\)\}\/rollback`, \{ method: "POST"/);
  // every op the card offers is one the server accepts
  const offered = [...CARD.matchAll(/\["(\w+)", "/g)].map(m => m[1]);
  const ops = read("services/modelGateway.js").match(/export const ROUTE_OPS = Object\.freeze\(\[([^\]]+)\]\)/)[1];
  for (const o of offered) assert.ok(ops.includes(`"${o}"`), `${o} is a ROUTE_OPS op`);
});

test("d162G4GatewayCard: a change needs a reason; a task run in the tools service is listed, never routed here", () => {
  assert.match(CARD, /disabled=\{busy \|\| !form\.reason\.trim\(\) \|\| \(op === "shadow" && !form\.model\.trim\(\)\)\}>Apply now/);
  assert.match(CARD, /if \(!reason \|\| !reason\.trim\(\)\) return;/, "roll back asks why");
  assert.match(CARD, /const routed = task\.runsIn === "draft";/);
  assert.match(CARD, /\{routed && <DepthButton onClick=\{\(\) => setOpen\(o => !o\)\}/);
  assert.doesNotMatch(CARD, /callModel|anthropic\.|999px/);
});
