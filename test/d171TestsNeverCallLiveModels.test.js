// ⛔ D171 (owner 11-06): the test suite never calls a live model by accident. The ≈ $0.50 on the local-dev key
// that day was the agent's own on-purpose generation runs (a resume-master + draft pair booted with .env's key);
// this pins that no TEST can do the same through dotenv.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("d171TestsNeverCallLiveModels: the preload leaves every model key empty, and dotenv cannot refill it", () => {
  for (const k of ["ANTHROPIC_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_WORKSPACE_ID"]) {
    assert.equal(process.env[k], "", `${k} must be empty under the test preload`);
  }
  // A child that loads dotenv in this checkout (as server.js does) still sees the empty key.
  const r = spawnSync(process.execPath, ["--input-type=module", "-e",
    "await import('dotenv/config'); process.stdout.write(JSON.stringify(process.env.ANTHROPIC_KEY ?? null));"],
  { env: process.env, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '""');
});
