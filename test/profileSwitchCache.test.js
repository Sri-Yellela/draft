import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("job board context exposes profile-scoped cache primitives", () => {
  const context = fs.readFileSync("client/src/contexts/JobBoardContext.jsx", "utf8");

  assert.match(context, /activeProfileId/);
  assert.match(context, /setActiveProfileId/);
  assert.match(context, /profileCacheRef = useRef\(new Map\(\)\)/);
  assert.match(context, /getProfileCache/);
  assert.match(context, /setProfileCache/);
  assert.match(context, /deleteProfileCache/);
  assert.match(context, /rm_jobs_profile_ui_v1/);
});

// ⛔ 47j w1-shell (changed on purpose): the profile menu's optimistic switcher and its delete (with deleteProfileCache) left
// with TopBar's ProfileMenuPanel — nothing opened it since D197 #1. What stays in TopBar is the board's active-profile read
// and its follow of profile_switched (the manager's activation emits it, routes/domainProfiles.js).
test("the top bar keeps the board's active profile in step", () => {
  const topBar = fs.readFileSync("client/src/components/TopBar.jsx", "utf8");

  assert.match(topBar, /setActiveProfileId\?\.\(active\.id\)/);
  assert.match(topBar, /if \(profileId\) setActiveProfileId\?\.\(Number\(profileId\)\);/);
  assert.doesNotMatch(topBar, /setProfiles\(|deleteProfileCache/);
});

test("jobs panel restores profile cache and guards stale profile responses", () => {
  const jobsPanel = fs.readFileSync("client/src/panels/JobsPanel.jsx", "utf8");

  assert.match(jobsPanel, /const activeProfileKey = activeDomainProfile\?\.id \|\| null/);
  assert.match(jobsPanel, /const cached = getProfileCache\?\.\(nextKey\)/);
  // A126 (8) (aa00ed8): the snapshot carries the profile key, so a return to Home keeps THIS profile's last cards
  assert.match(jobsPanel, /applyProfileSnapshot\(cached, nextKey\)/);
  assert.match(jobsPanel, /readProfileUiCache\(nextKey\)/);
  assert.match(jobsPanel, /writeProfileUiCache\(activeProfileKey, latestSnapshotRef\.current\)/);
  assert.match(jobsPanel, /requestProfileKey !== activeProfileKeyRef\.current/);
  assert.match(jobsPanel, /requestSeq !== jobsFetchSeqRef\.current/);
  assert.match(jobsPanel, /__profileKey/);
});
