#!/usr/bin/env node
/**
 * J2 · ONE COMMAND FOR EVERY LANE — a browser pass of the REAL extension on the Workday-shaped fixture.
 * ====================================================================================================
 *   npm run walk:extension -- <scenario> [<scenario> …] [--headful] [--theme dark] [--require-chrome]
 *   npm run walk:extension -- --list
 *
 * A SCENARIO is a file test-support/walks/<name>.mjs:
 *
 *   export const description = 'one line: what this pass proves';
 *   export const options = { theme: 'light', api: { seed, payload, mount } };   // optional (launchExtensionBrowser)
 *   export default async function run(h, { check, observe, section }) {
 *     section('1 · capture on the stage the owner opened from LinkedIn');
 *     await h.openStage('applyManually');
 *     const r = await h.capture();
 *     check('the capture succeeded', r?.success === true, r?.message);
 *   }
 *
 *   check(label, cond, extra)   a PASS / FAIL line; any FAIL makes the command exit 1
 *   observe(label, value)       an OBSERVED line — a measurement, never a pass or a fail (what the extension does
 *                               TODAY on a shape another lane will fix: report it, do not gate on it)
 *   section(title)              a heading
 *
 * `h` is test-support/extensionBrowser.mjs's harness:
 *   h.openStage(stage, { step })  h.open(url)  h.goStep(id)  h.step()  h.steps()  h.next()  h.reload()  h.pageValues()
 *   h.capture()  h.fill()  h.prepare()  h.untilAnswerOrWaiting(msg)  h.popupContext()  h.capturedToday()  h.openCopySheet()  h.send(msg)
 *   h.readPanel()  h.waitForPanel()  h.readCopySheet()  h.waitForCopySheet()  h.readShadow(hostId, fn)
 *   h.storage.local()  h.storage.session()  h.storage.set(area, items)  h.storage.clear(area)  h.bindings()
 *   h.setTheme('light'|'dark')  h.theme()  h.guarded()  h.leaked(needle?)  h.submissions()  h.submitPressed()
 *   h.screenshot(name)  h.page (puppeteer)  h.control (the extension's options page)  h.db (the API's sqlite)
 *   h.api.requests (every request the API received)
 *
 * ⛔ The harness has no tick / check / sign helper, and next() refuses on Review (where Save and Continue is Submit).
 * No Chrome → each scenario prints SKIP with the reason and the command exits 0 (1 with --require-chrome).
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { launchExtensionBrowser, HarnessSkip, findChrome } from './extensionBrowser.mjs';

const WALKS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'walks');

export function listScenarios() {
  return fs.readdirSync(WALKS_DIR).filter(f => f.endsWith('.mjs')).map(f => f.replace(/\.mjs$/, '')).sort();
}

/** Run one scenario; returns { name, failures, skipped, reason }. Prints as it goes. */
export async function runScenario(name, { headful = false, theme = null, log = console.log } = {}) {
  const file = path.join(WALKS_DIR, `${name}.mjs`);
  if (!fs.existsSync(file)) throw new Error(`no scenario "${name}" — have: ${listScenarios().join(', ')}`);
  const mod = await import(pathToFileURL(file).href);
  let failures = 0;
  const check = (label, cond, extra = '') => { log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`); if (!cond) failures++; return !!cond; };
  const observe = (label, value) => log(`OBSERVED  ${label}  — ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  const section = (title) => log(`── ${title} ──`);
  log(`=== ${name}${mod.description ? ` — ${mod.description}` : ''} ===`);
  let h;
  // ⭐ A232 R4 (46y): a Chrome that dies DURING its launch (46s: d191SidePanelWalk, "Target.setDiscoverTargets: Target
  // closed" at 2.7 s, before the scenario did anything) is launched once more. Only the launch is retried — the launcher
  // has already stopped the fake ATS, the API and the browser it started — never the scenario, whose checks run once.
  for (let attempt = 1; ; attempt++) {
    try {
      h = await launchExtensionBrowser({ ...(mod.options || {}), ...(theme ? { theme } : {}), headless: !headful });
      break;
    } catch (e) {
      if (e instanceof HarnessSkip) { log(`SKIP  ${name} — ${e.reason}`); return { name, failures: 0, skipped: true, reason: e.reason }; }
      if (attempt >= 2) throw e;
      log(`OBSERVED  the launch failed before the scenario began, launching once more  — ${e?.message || e}`);
    }
  }
  try {
    await mod.default(h, { check, observe, section });
  } catch (e) {
    failures++;
    log(`FAIL  the scenario threw — ${e?.stack || e}`);
  } finally {
    await h.close();
  }
  log(failures ? `FAILED — ${failures} check(s)\n` : 'ALL PASS\n');
  return { name, failures, skipped: false };
}

async function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--list')) { for (const n of listScenarios()) console.log(n); return 0; }
  const headful = args.includes('--headful');
  const requireChrome = args.includes('--require-chrome') || process.env.WALK_REQUIRE_CHROME === '1';
  const ti = args.indexOf('--theme');
  const theme = ti >= 0 ? args[ti + 1] : null;
  const names = args.filter((a, i) => !a.startsWith('--') && !(ti >= 0 && i === ti + 1));
  if (!names.length) { console.error(`usage: npm run walk:extension -- <scenario> …   (have: ${listScenarios().join(', ')})`); return 2; }
  const chrome = await findChrome();
  if (chrome.skip) {
    for (const n of names) console.log(`SKIP  ${n} — ${chrome.skip}`);
    return requireChrome ? 1 : 0;
  }
  let failed = 0;
  for (const n of names) failed += (await runScenario(n, { headful, theme })).failures ? 1 : 0;
  return failed ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv).then(code => process.exit(code), (e) => { console.error(e); process.exit(1); });
}
