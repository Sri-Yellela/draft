// Static registries live in registry/, never in data/.
//
// ⛔ WHY THIS EXISTS. data/ is runtime state, and in production it is a Railway VOLUME mounted at
// /app/data — a mount hides whatever the image put at that path. The four registries lived in
// data/, so production almost certainly read ROLE_ALIAS_MAP as `{}`: roleFamilyForTitle resolved
// no family for any title, and the ATS term weights formed for `__global__` only. Production
// reported exactly that over a 1,179-posting corpus, while the local database — which has the file
// — formed four families. The readers degraded SILENTLY to empty, which is how it went unseen.
// Found 09-29; the boot log now counts what loaded.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { ROLE_ALIAS_MAP_PATH, roleAliasCount, roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { QUALIFICATION_MAP_PATH, qualificationKeyCount } from "../services/qualificationResolver.js";
import { BUILTIN_REGISTRY } from "../routes/domainProfiles.js";

const REGISTRIES = ["ROLE_ALIAS_MAP.json", "QUALIFICATION_ROLE_MAP.json", "DOMAIN_METADATA_REGISTRY.json", "DOMAIN_TOOL_REGISTRY.json"];
const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("every static registry is TRACKED in registry/, and none is left in data/", () => {
  const tracked = new Set(execFileSync("git", ["ls-files", "registry", "data"], { encoding: "utf8" }).split("\n").filter(Boolean));
  for (const f of REGISTRIES) {
    assert.ok(tracked.has(`registry/${f}`), `registry/${f} is not tracked`);
    assert.ok(!tracked.has(`data/${f}`), `data/${f} is tracked again — data/ is the runtime volume in production`);
  }
});

test("the readers point at registry/ and actually load it", () => {
  assert.match(ROLE_ALIAS_MAP_PATH.replace(/\\/g, "/"), /\/registry\/ROLE_ALIAS_MAP\.json$/);
  assert.match(QUALIFICATION_MAP_PATH.replace(/\\/g, "/"), /\/registry\/QUALIFICATION_ROLE_MAP\.json$/);
  assert.ok(roleAliasCount() > 50, `only ${roleAliasCount()} role aliases loaded`);
  assert.ok(qualificationKeyCount() > 5, `only ${qualificationKeyCount()} qualification keys loaded`);
  // The behaviour that was lost in production, asserted directly.
  assert.equal(roleFamilyForTitle("Senior Software Engineer"), "engineering");
  assert.equal(roleFamilyForTitle("Data Scientist"), "data");
});

test("no server-side reader resolves a registry under data/", () => {
  for (const f of ["services/searchQueryBuilder.js", "services/qualificationResolver.js", "routes/domainProfiles.js"]) {
    const code = lf(f).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(code, /["']data["']\s*,\s*["'](ROLE_ALIAS_MAP|QUALIFICATION_ROLE_MAP|DOMAIN_METADATA_REGISTRY|DOMAIN_TOOL_REGISTRY)\.json/,
      `${f} reads a registry from data/`);
  }
  assert.match(lf("client/src/panels/JobsPanel.jsx"), /from "\.\.\/\.\.\/\.\.\/registry\/ROLE_ALIAS_MAP\.json"/);
});

test("the image ships registry/ before the client build, and nothing re-includes data/", () => {
  const docker = lf("Dockerfile");
  assert.ok(docker.indexOf("COPY registry/ ./registry/") > 0, "Dockerfile does not copy registry/");
  assert.ok(docker.indexOf("COPY registry/ ./registry/") < docker.indexOf("cd client && npm run build"),
    "registry/ must be copied before the client build, which bundles ROLE_ALIAS_MAP.json");
  assert.doesNotMatch(lf(".dockerignore"), /^!data\//m, "re-including a file under data/ ships it to a path the volume hides");
  assert.doesNotMatch(lf(".dockerignore"), /^\/?registry\/?$/m, ".dockerignore excludes registry/");
});

test("the domain picker's built-in fallback is IDENTICAL to the registry file", () => {
  // Kept as a last resort only. Identical when checked (17 domains, 0 differing fields); a copy
  // with no equality check is a second source of truth waiting to drift.
  assert.deepEqual(BUILTIN_REGISTRY, JSON.parse(lf("registry/DOMAIN_METADATA_REGISTRY.json")),
    "routes/domainProfiles.js BUILTIN_REGISTRY and registry/DOMAIN_METADATA_REGISTRY.json have drifted");
});
