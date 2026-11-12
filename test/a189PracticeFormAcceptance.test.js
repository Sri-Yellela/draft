import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// ⭐ A189 (written as A185) · NEXT (agent) 3: the practice-form acceptance in real Chrome — Draft → held → answer the held
// questions → the job unblocks → Approve → Sent (scripts/walkA189practice.mjs: the real server on a throwaway copy of the
// database, keys blanked, a synthetic TEST account with a SAMPLE résumé, so every Draft goes to draft's own practice form —
// never to an employer). The walk boots the whole server on a production-sized copy (minutes, ~1 GB), so it runs only when
// asked: A189_PRACTICE_WALK=1. The pins below always run — they keep the walk pointed at the practice form only.

const WALK = "scripts/walkA189practice.mjs";

test("a189PracticeFormAcceptance: the walk is practice-form-only, keys blanked, and reads Sent from the run-job itself", () => {
  const src = fs.readFileSync(WALK, "utf8");
  assert.match(src, /test_account = 1/, "a TEST account — a sample résumé fills only a test account (D186-6)");
  assert.match(src, /from-resume/, "the base résumé is the sample");
  assert.match(src, /includes\("practice_form"\)/, "the run log must name the practice form");
  assert.match(src, /ANTHROPIC_KEY: ""/);
  assert.match(src, /DOTENV_CONFIG_PATH: "\.\/\.no-dotenv-for-local-harness"/);
  assert.match(src, /\/api\/apply\/answers/);
  assert.match(src, /\/api\/apply\/approve/);
  assert.match(src, /status === "submitted" && sent\?\.submit_verified === 1/);
  assert.match(src, /practice_submissions/);
  assert.doesNotMatch(src, /captcha/i, "nothing in the walk touches a check");
});

test("a189PracticeFormAcceptance: real Chrome — answer → unblock → Approve → Sent (A189_PRACTICE_WALK=1)", { timeout: 15 * 60_000 }, (t) => {
  if (process.env.A189_PRACTICE_WALK !== "1") { t.skip("set A189_PRACTICE_WALK=1 — boots the full server on a copy of the database"); return; }
  const r = spawnSync(process.execPath, [WALK], { cwd: process.cwd(), encoding: "utf8", timeout: 14 * 60_000,
    env: { ...process.env, ANTHROPIC_KEY: "", ANTHROPIC_API_KEY: "", DOTENV_CONFIG_PATH: "./.no-dotenv-for-local-harness" } });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const results = (() => { try { return JSON.parse(fs.readFileSync(path.join("tmp", "walkA189", "results.json"), "utf8")); } catch { return []; } })();
  assert.ok(results.length > 0, `the walk wrote no results:\n${out.slice(-2000)}`);
  const failed = results.filter(x => !x.ok);
  assert.deepEqual(failed, [], out.slice(-3000));
  for (const step of ["Draft", "practice form, never the employer", "held", "unblocked", "Approve", "Sent", "the practice form received exactly one submission"])
    assert.ok(results.some(x => x.walk === step && x.ok), `step ${step}`);
});
