// ⭐ D151 RULE 5 · the scale suite's contract, cheaply: the budgets are D151's numbers, the fixture is synthetic and never
// built from or into data/, `npm run test:scale` exists, and the event-loop probe is a preload — server.js carries no
// measuring hook. The suite itself (scripts/scaleSuite.mjs) is heavy and runs on its own: `npm run test:scale`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("d151ScaleSuite: the budgets are D151 Rule 5's", () => {
  const suite = read("scripts/scaleSuite.mjs");
  assert.match(suite, /BUDGETS = \{ listenMs: 3000, readyMs: 30000, p95Ms: 300, loopP99Ms: 100, sliceMs: 100 \}/);
  for (const screen of ["deck", "board (Full House)", "posting", "tracker", "Your map", "résumé check", "Admin → Testers"])
    assert.ok(suite.includes(`"${screen}"`), `the suite loads ${screen}`);
  assert.match(suite, /--import", "\.\/test-support\/scaleLoopProbe\.mjs"/);
  assert.match(suite, /USERS = Number\(arg\("--users", 20\)\)/, "20 concurrent users by default");
});

test("d151ScaleSuite: the fixture is synthetic and stays out of data/", () => {
  const fx = read("scripts/scaleFixture.mjs");
  assert.match(fx, /REFUSING: --out must not be under data\//);
  assert.doesNotMatch(fx, /data\/resume_master\.db|readFileSync\([^)]*data\//, "never reads the real database");
  assert.match(fx, /@example\.com/, "synthetic addresses only");
  assert.match(fx, /createAdminAccount/, "the admin is an admin account (D95), never a users row");
  assert.match(read(".gitignore"), /^tmp\/scale-\*\/$/m, "a fixture can't be committed");
});

test("d151ScaleSuite: npm run test:scale, and no probe in server.js", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts["test:scale"], /scaleSuite\.mjs --fixture tmp\/scale-100k --build-if-missing 100000/);
  assert.match(pkg.scripts["test:scale:500k"], /tmp\/scale-500k --build-if-missing 500000/);
  assert.doesNotMatch(read("server.js"), /SCALE_LOOP_FILE|scaleLoopProbe/);
});
