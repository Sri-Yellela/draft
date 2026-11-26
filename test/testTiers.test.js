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
    /* 47j R2: fidelity.test.js retired with the classic market */ "test/d163OtherScreens.test.js", "test/a201ShrinkGracefully.test.js",
    "test/a131NoSidewaysOverflow1280.test.js",   // runs scripts/a131OverflowProbe.mjs, which drives Chrome
    "test/a210QuestionsThreadNewRun.test.js",    // runs scripts/a199Walk.mjs
    "test/realExtensionWalks.test.js"]   /* ⭐ A232 R4: the one panel's walk (was d191PanelWalk) and five more */) assert.equal(tierOf(f), "browser", f);
  // and nothing in the fast tier launches one itself
  for (const f of filesFor("fast")) assert.doesNotMatch(read(f), /puppeteer\.launch\(|launchBrowser\(|fidelityShots\.mjs", "--styles/, f);
});

test("R1: pure files that only MENTION a walk or a Chrome helper stay fast", () => {
  for (const f of ["test/d190TinyFloating.test.js", "test/t20AutoReadOpenTabs.test.js", "test/a230DeadEndpointsGone.test.js"]) assert.equal(tierOf(f), "fast", f);
});

test("A232 R3: the long walks run ONE theme each, and j9's unit rules sit in the fast tier", () => {
  assert.equal(tierOf("test/j9FullPassRules.test.js"), "fast");
  const walks = { "test/j9FullPass.test.js": "dark", "test/j4PanelBrowser.test.js": "light", "test/j6ResumePanelBrowser.test.js": "dark" };
  for (const [f, theme] of Object.entries(walks)) {
    const loops = [...read(f).matchAll(/for \(const theme of (\[[^\]]*\])\)/g)].map(m => m[1]);
    assert.deepEqual(loops, [`["${theme}"]`], `${f} walks one theme`);
  }
  // the two schemes are each still walked once across the tier
  assert.deepEqual(new Set(Object.values(walks)), new Set(["light", "dark"]));
  // j9's walk file holds the walk and nothing else
  assert.equal([...read("test/j9FullPass.test.js").matchAll(/^\s*test\(/gm)].length, 1);
});

test("A232 R4: the six one-walk files are ONE file of six walks; j2ExtensionHarness is gone; a launch that dies is retried once", () => {
  for (const f of ["a207RealExtensionWalk", "a211RealExtensionWalk", "a211BackgroundWalk", "d191PanelWalk", "d112GlobalReadChrome", "d97rT12Chrome", "j2ExtensionHarness"])
    assert.equal(fs.existsSync(`test/${f}.test.js`), false, f);
  const s = read("test/realExtensionWalks.test.js");
  for (const scen of ["extensionSubmit", "a211Runner", "a211Background", "d191Panel", "globalAsk"]) assert.match(s, new RegExp(`runScenario\\("${scen}"`), scen);
  assert.match(s, /const h = await launchExtensionBrowser\(\{\s*insecureCerts: true,/, "d97r's own launch");
  assert.equal([...s.matchAll(/^test\(/gm)].length, 6);
  // only the LAUNCH is retried, never the scenario
  const w = read("test-support/walkExtension.mjs").replace(/\r\n/g, "\n");
  assert.match(w, /for \(let attempt = 1; ; attempt\+\+\) \{\n    try \{\n      h = await launchExtensionBrowser\(/);
  assert.match(w, /if \(attempt >= 2\) throw e;/);
  assert.equal([...w.matchAll(/await mod\.default\(h, /g)].length, 1);
});

test("A232 R5: the pure halves of the five mixed files are fast; their real-Chrome halves are browser files of their own", () => {
  const pairs = { bindingFirst: "bindingFirstWalk", t24IntentModel: "t24IntentModelWalk", t31ToolbarPress: "t31ToolbarPressWalk",
    d99Bridge: "d99BridgeWalk", t9AtsReportComponent: "t9AtsReportChrome" };
  for (const [pure, walk] of Object.entries(pairs)) {
    assert.equal(tierOf(`test/${pure}.test.js`), "fast", pure);
    assert.equal(tierOf(`test/${walk}.test.js`), "browser", walk);
    assert.doesNotMatch(read(`test/${pure}.test.js`), /runScenario\(|launchExtensionBrowser\(|findChrome\(/, `${pure} keeps no Chrome`);
  }
  // the walks' API is importable without the browser harness, and the harness still re-exports it for the walks
  assert.equal(tierOf("test/bindingFirst.test.js"), "fast");
  assert.match(read("test-support/extensionBrowser.mjs"), /import \{ DEFAULT_PAYLOAD, defaultSeed, startApi \} from '\.\/walkApi\.mjs';/);
  assert.doesNotMatch(read("test-support/walkApi.mjs"), /puppeteer|launchBrowser|launchExtensionBrowser\(/);
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
  // 47j R2: 13 → 9 — the classic market's five probe callers (d152Home's and d156Home's real-Chrome halves, d163UseTheSpace,
  // fidelity, fidelityFullHouse) retired with it; the floor still catches a test quietly going back to its own script run
  assert.ok(callers.length >= 9, `${callers.length} callers`);
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
