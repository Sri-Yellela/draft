import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { resolveEntitlement } from "../services/entitlementResolver.js";
import { at as anchor } from "../test-support/sourceAnchors.js";

// ⭐ D100 (owner 10-30) · GATES LIFTED — FULL AUTO IS A PER-USER MODE. No server constant; default SEMI;
// whose submit it was is recorded on the run-job (`submitted_by`, D36 amended). The admission / processing
// / bar behaviour is driven end to end in test/d36ApplyPaths.test.js §7; this file pins the rest.
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("D100 · no FULL_AUTO_PROVEN anywhere in the server, the resolver or the entitlements", () => {
  for (const f of ["routes/apply.js", "services/entitlementResolver.js", "shared/entitlements.js"]) {
    assert.doesNotMatch(read(f), /const FULL_AUTO_PROVEN|!FULL_AUTO_PROVEN|fullAutoProven:|ctx\.fullAutoProven/, f);
  }
});

test("D100 · migration 169 adds users.send_mode (NULL = SEMI) and apply_run_jobs.submitted_by, additively", () => {
  const m = MIGRATIONS.find(x => x.id === "169_send_mode_submitted_by");
  assert.ok(m, "migration 169 is present");
  assert.doesNotMatch(m.sql, /DROP|DELETE|UPDATE/i);
  const db = new Database(":memory:");
  for (const x of MIGRATIONS) db.exec(x.sql);
  assert.ok(db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "send_mode" && c.dflt_value === null));
  assert.ok(db.prepare("PRAGMA table_info(apply_run_jobs)").all().some(c => c.name === "submitted_by"));
});

test("D100 · the resolver locks automatic sending ONLY for the operator's kill switch", () => {
  const db = new Database(":memory:");
  for (const x of MIGRATIONS) db.exec(x.sql);
  assert.equal(resolveEntitlement(db, null, "auto_apply_mode", { env: {} }).value, "unlocked");
  assert.equal(resolveEntitlement(db, null, "auto_apply_mode", { env: { APPLY_FULL_AUTO_DISABLED: "1" } }).value, "locked");
});

test("D100 · a submit records submitted_by — 'user' for an approved run, 'auto' for the user's FULL AUTO", () => {
  const src = read("routes/apply.js");
  const at = anchor(src, "if (submitted) {\n        logEvent(runId, runJobId, userId, jobId, \"submitted\"");
  const block = src.slice(at, anchor(src, "} else if (cancelled) {", at));
  // ⭐ D113 (changed on purpose): a SEMI user's tap on Apply in a picks message is THEIR submit too — 'user', not 'auto'.
  assert.match(block, /UPDATE apply_run_jobs SET submitted_by=\? WHERE id=\?`\)\n\s*\.run\(approvalMode === "approved" \|\| \(userApplyMode\(userId\) !== "auto" && pickAuthorisesSend\(db, userId, jobId\)\) \? "user" : "auto", runJobId\)/);
  // An 'auto' submit can only be reached by a user whose mode is FULL AUTO: processRunJob holds it before this.
  const hold = anchor(src, 'mode === "auto" && approvalMode === "auto" && userApplyMode(userId) !== "auto"');
  assert.ok(hold < at, "the SEMI hold sits before the submit");
});
