// ⭐ A199 (2) walked + ⛔ A210 (46l). scripts/a199Walk.mjs drives the held questions thread in a real Chrome on the real client
// (synthetic API answers; no server, no model): a held row opens its thread; Yes / No and choices are buttons; a short answer
// is typed; a written answer shows draft's suggestion, "Write it from this" redrafts, "Use this" takes it; Finish posts every
// answer for THIS job and re-runs it; answer here instead keeps the stepper. A210, found by the walk: a Run again that came
// back with questions (the same job's NEXT held run) never opened its thread — AskDraftPanel compared the job only and kept
// the last run's thread on "Saved". The thread is now keyed by the job AND the held run.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("⭐ A199 (2) / A210 (Chrome): the questions thread, walked end to end — and a Run again with questions opens a new thread", { timeout: 300000 }, (t) => {
  const out = JSON.parse(execFileSync(process.execPath, ["scripts/a199Walk.mjs"], { encoding: "utf8", timeout: 280000, stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop());
  if (out.skipped) { t.skip(out.skipped); return; }
  for (const s of out.steps) assert.ok(s.ok, `${s.step}${s.detail ? ` — ${s.detail}` : ""}`);
  // ⛔ 47j R3 (changed on purpose): the walk drives the LEDGER (the classic tracker is deleted) — its Needs you shows the
  // question and opens the thread with "Ask draft"; "answer here instead" is the ledger's own stepper (14 steps, was 13)
  assert.equal(out.steps.length, 14);
});

test("A210: the thread is keyed by the job AND the held run", () => {
  const nav = read("client/src/components/AppNav.jsx");
  assert.match(nav, /const same = \(t\) => t && String\(t\.jobId\) === String\(d\.jobId\) && String\(t\.runKey \?\? ""\) === String\(d\.runKey \?\? ""\);/);
  assert.match(nav, /<AskDraftThread key=\{`\$\{thread\.jobId\}:\$\{thread\.runKey \?\? ""\}`\} thread=\{thread\}/);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /\{ detail: \{ jobId: node\.jobId, runKey: node\.ref\?\.primary\?\.row\?\.id \?\? node\.ref\?\.id \?\? null,/);
});
