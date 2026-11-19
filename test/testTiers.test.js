// ⭐ A232 R1 + R2 (46t, owner 11-17: "go with R1 and R2") · the two tiers and the one fidelity probe, guarded.
// R1: test-support/testTiers.mjs is the only place a file's tier is decided; a browser test must never land in the fast
// tier (where it would run at concurrency 3 beside others and only before a push would anyone see a real-Chrome red).
// R2: every fidelity probe goes through test-support/fidelityProbe.mjs (one vite + one Chrome per suite, shots in tmp/).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { tierOf, filesFor, testFiles } from "../test-support/testTiers.mjs";
import { PROBES, keyOf, SHOTS } from "../test-support/fidelityProbe.mjs";

const read = (f) => fs.readFileSync(f, "utf8");

test("R1: every test file has exactly one tier, and the two tiers are the whole suite", () => {
  const all = testFiles(), fast = filesFor("fast"), browser = filesFor("browser");
  assert.equal(fast.length + browser.length, all.length);
  assert.equal(new Set([...fast, ...browser]).size, all.length);
  assert.ok(fast.length > 600 && browser.length > 50, `fast ${fast.length}, browser ${browser.length}`);
});

test("R1: the files that drive a browser — directly, through the extension harness, or through a script — are in the browser tier", () => {
  for (const f of ["test/j9FullPass.test.js", "test/j4PanelBrowser.test.js", "test/d100PortalAccounts.test.js", "test/t18GreenhouseChrome.test.js",
    "test/fidelity.test.js", "test/d163OtherScreens.test.js", "test/a201ShrinkGracefully.test.js",
    "test/a131NoSidewaysOverflow1280.test.js",   // runs scripts/a131OverflowProbe.mjs, which drives Chrome
    "test/a210QuestionsThreadNewRun.test.js",    // runs scripts/a199Walk.mjs
    "test/d191PanelWalk.test.js"]   /* ⭐ D191 B3: the side panel's walk retired with it; the one panel's walk */) assert.equal(tierOf(f), "browser", f);
  // and nothing in the fast tier launches one itself
  for (const f of filesFor("fast")) assert.doesNotMatch(read(f), /puppeteer\.launch\(|launchBrowser\(|fidelityShots\.mjs", "--styles/, f);
});

test("R1: pure files that only MENTION a walk or a Chrome helper stay fast", () => {
  for (const f of ["test/d190TinyFloating.test.js", "test/t20AutoReadOpenTabs.test.js", "test/a230DeadEndpointsGone.test.js"]) assert.equal(tierOf(f), "fast", f);
});

test("R1: the runner and the npm scripts read the one rule", () => {
  const runner = read("scripts/testTier.mjs"), pkg = JSON.parse(read("package.json"));
  assert.match(runner, /import \{ filesFor \} from "\.\.\/test-support\/testTiers\.mjs";/);
  assert.match(runner, /--test-concurrency=\$\{concurrency\}/);
  assert.equal(pkg.scripts["test:fast"], "node scripts/testTier.mjs fast");
  assert.equal(pkg.scripts["test:browser"], "node scripts/testTier.mjs browser");
  assert.equal(pkg.scripts["test:all"], "node scripts/testTier.mjs all");
  assert.equal(pkg.scripts.test, "node --test --import ./test-support/isolateTrackingSink.mjs", "npm test still runs everything");
});

test("R2: no test runs fidelityShots --styles itself; every probe it asks for is listed; shots go to tmp/", () => {
  const callers = testFiles().filter(f => read(f).includes("fidelityProbe("));
  assert.ok(callers.length >= 13, `${callers.length} callers`);
  const keys = new Set(PROBES.map(keyOf));
  for (const f of testFiles()) {
    const s = read(f);
    assert.doesNotMatch(s, /fidelityShots\.mjs", "--styles"/, `${f} runs the script itself`);
    for (const m of s.matchAll(/fidelityProbe\("([\w-]+)"(?:, \{ routes: "([^"]+)"(?:, sizes: "([^"]+)")? \})?\)/g))
      assert.ok(keys.has(keyOf({ id: m[1], routes: m[2], sizes: m[3] })), `${f}: ${m[0]} is not in PROBES`);
  }
  for (const id of ["dock167", "dock167place"]) assert.ok(keys.has(keyOf({ id })), id);   // d167Dock asks by variable
  assert.equal(SHOTS, "tmp/fidelity-shots");
  const script = read("scripts/fidelityShots.mjs");
  assert.match(script, /const OUT = process\.env\.FIDELITY_OUT \? path\.resolve\(ROOT, process\.env\.FIDELITY_OUT\) : path\.join\(ROOT, "docs", "fidelity-shots"\);/);
  assert.match(script, /if \(process\.argv\[2\] === "--styles-batch"\) \{/);
  assert.match(read("test-support/fidelityProbe.mjs"), /env: \{ \.\.\.process\.env, FIDELITY_OUT: SHOTS \}/);
});
