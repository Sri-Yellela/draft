import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("registration defaults new users to Basic Simple Apply", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const topBar = fs.readFileSync("client/src/components/TopBar.jsx", "utf8");
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");
  const databasePanel = fs.readFileSync("client/src/panels/DatabasePanel.jsx", "utf8");

  assert.match(server, /apply_mode,plan_tier\) VALUES \(\?,\?,0,'SIMPLE','BASIC'\)/);
  assert.match(server, /applyMode:"SIMPLE", planTier:"BASIC"/);
  // 46v: the October plan words retired — changed on purpose. ⛔ 47j w1-shell (changed on purpose): the plan words moved
  // with View plans from the retired account panel to Profile → Account (ProfilePage's PLAN_LABELS).
  assert.match(fs.readFileSync("client/src/pages/profile/ProfilePage.jsx", "utf8"), /BASIC: \["Basic", "Your jobs and today's picks"\]/);
  assert.doesNotMatch(topBar, /Apply Mode|APPLY_MODES|\/api\/settings\/apply-mode/);
  assert.match(jobsPanel, /applyMode = user\?\.applyMode \|\| "SIMPLE"/);
  // The tier test itself is unchanged and still pinned — the monetisation lever decides whether it
  // is CONSULTED, not what it says. Anchored on the tail rather than the whole expression so this
  // asserts the registration default it is named for, and does not fail again the next time the
  // condition in front of it is edited.
  assert.match(jobsPanel, /canUseGenerate = !monetisationEnabled \|\| planTier === "PLUS" \|\| planTier === "PRO"/);
  assert.doesNotMatch(databasePanel, /applyMode=\{user\?\.applyMode \|\| "TAILORED"\}/);
});
