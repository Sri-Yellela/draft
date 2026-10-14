#!/usr/bin/env node
/**
 * D23 — the popup before and after "Read this page", in light and dark, and the review overlay, shot
 * from the REAL extension files (popup.html + tokens.css + ui.css + companion.js + popup.js;
 * review-overlay.js renderOverlay with the generated tokens) with chrome.* stubbed. SYNTHETIC data
 * only — no real person, no real employer.
 *
 *   node scripts/d23CompanionShots.mjs
 *
 * Writes ../draft-screenshots/d23/<name>.png and prints any page error. Needs a Chrome binary.
 * Excluded from verify:harness: screenshots, and it needs a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';
import { C_LIGHT, C_DARK } from '../extension/tokens.js';
import { renderOverlay, panelRowsFromItems } from '../extension/review-overlay.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'd23');
const POPUP = pathToFileURL(path.join(ROOT, 'extension', 'popup.html')).href;
const DAY = 86400000;

const identity = { authenticated: true, username: 'ada' };
const STATES = {
  'before-press': { press: false, tabUrl: 'https://jobs.example.test/fabrikam/data-engineer',
    preview: null, context: null },
  posting: { press: true, tabUrl: 'https://jobs.example.test/fabrikam/data-engineer',
    preview: { capturable: true, ok: true, title: 'Data Engineer', company: 'Fabrikam', location: 'Boston, MA' },
    context: { packets: [], posting: { known: false, saved: false }, recent: [] } },
  form: { press: true, tabUrl: 'https://apply.example.test/northwind/101',
    preview: { capturable: true, ok: false },
    context: { packets: [{ packetId: 7, title: 'Backend Engineer', company: 'Northwind', createdAt: Date.now() - 2 * DAY,
      stale: false, answerCount: 14, unresolvedCount: 2, resumeAvailable: true }], posting: null, recent: [] } },
  neither: { press: true, tabUrl: 'chrome://newtab/',
    preview: { capturable: false },
    context: { packets: [], posting: null, recent: [
      { jobId: 'a', title: 'Platform Engineer', company: 'Tailspin', capturedAt: Date.now() - 3 * 3600e3 },
      { jobId: 'b', title: 'Data Engineer', company: 'Fabrikam', capturedAt: Date.now() - DAY },
      { jobId: 'c', title: 'Software Engineer II', company: 'Adatum', capturedAt: Date.now() - 4 * DAY },
    ] } },
};

// A synthetic filled form for the overlay: Ada Lovelace, example.com — never a real person.
const STEPS = [
  { field: 'Are you legally authorized to work in the United States?', value: 'Yes', provenance: 'handler_exact', matchedBy: 'exact', eligibility: true, name: 'auth' },
  { field: 'Current company', value: 'Analytical Engines Ltd', provenance: 'label_fuzzy', matchedBy: 'label', name: 'company' },
  { field: 'How did you hear about us?', value: 'Job board', provenance: 'default', matchedBy: 'label', name: 'source' },
  { field: 'First name', value: 'Ada', provenance: 'handler_exact', matchedBy: 'exact', name: 'first' },
  { field: 'Email', value: 'ada@example.com', provenance: 'handler_exact', matchedBy: 'exact', name: 'email' },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files'] });
  let failed = 0;
  const shot = async (name, page, el) => {
    const file = path.join(OUT_DIR, `${name}.png`);
    await (el || page).screenshot({ path: file, ...(el ? {} : { fullPage: false }) });
    return file;
  };
  try {
    for (const scheme of ['light', 'dark']) {
      for (const [state, fx] of Object.entries(STATES)) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
        await page.setViewport({ width: 316, height: 600, deviceScaleFactor: 2 });
        await page.evaluateOnNewDocument((fx, identity) => {
          const answers = { PROBE_AUTH: identity, PREVIEW_ACTIVE_TAB: fx.preview, POPUP_CONTEXT: fx.context };
          window.chrome = {
            runtime: { sendMessage: async (m) => answers[m.type] ?? null, openOptionsPage() {} },
            tabs: { query: async () => [{ id: 1, url: fx.tabUrl }], create() {} },
            storage: { local: { get: async () => ({}) } },
            scripting: { executeScript: async () => [{ result: '' }] },
          };
        }, fx, identity);
        await page.goto(POPUP, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 300));
        if (fx.press) { await page.click('#btn-read-page'); await new Promise(r => setTimeout(r, 300)); }
        await page.evaluate(() => document.fonts.ready);
        // Which faces actually rendered — the logo face must be the self-hosted Poppins.
        const faces = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.style} ${f.weight}`));
        const body = await page.$('body');
        const file = await shot(`popup-${state}-${scheme}`, page, body);
        if (errors.length) failed++;
        console.log(`${errors.length ? 'ERROR' : 'ok   '} ${path.basename(file)}  [${faces.join(', ')}]${errors.length ? '  ' + errors.join(' | ') : ''}`);
        await page.close();
      }

      // The review overlay, over a plain synthetic form, with the generated tokens and the logo face.
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><html><body style="margin:0;font:15px system-ui;padding:40px;color-scheme:${scheme}">
        <h1 style="font-weight:600">Backend Engineer — Northwind (synthetic)</h1>
        ${STEPS.map(s => `<p><label>${s.field}<br><input value="${s.value}" style="width:420px;padding:6px"></label></p>`).join('')}
        <button>Submit application</button></body></html>`);
      const font = fs.readFileSync(path.join(ROOT, 'extension/fonts/poppins-latin-800-italic.woff2')).toString('base64');
      // J4 (D96 §5): the panel takes rows — the legacy review items through the same rule.
      const model = { rows: panelRowsFromItems(STEPS) };
      await page.evaluate(`window.chrome = { runtime: { sendMessage() {} } }; (${renderOverlay.toString()})(${JSON.stringify(model)}, ${JSON.stringify({ runId: `shots-${scheme}`,
        filledCount: STEPS.length, resumeAttached: true, resolverBug: null,
        portal: { remaining: 2, host: 'apply.example.test', next: { title: 'Data Engineer' }, gateCrossing: true },
        theme: { light: C_LIGHT, dark: C_DARK, logoFont: font } })})`);
      await page.evaluate(() => document.fonts.ready);
      await new Promise(r => setTimeout(r, 300));
      const file = await shot(`overlay-${scheme}`, page);
      if (errors.length) failed++;
      console.log(`${errors.length ? 'ERROR' : 'ok   '} ${path.basename(file)}${errors.length ? '  ' + errors.join(' | ') : ''}`);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(`Out: ${OUT_DIR}`);
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
