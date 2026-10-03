#!/usr/bin/env node
/**
 * D13 — the companion popup in its three modes (a form you drafted, a posting, neither), shot from
 * the REAL extension/popup.html + companion.js + popup.js with chrome.* stubbed. Synthetic data only.
 *
 *   node scripts/d13CompanionShots.mjs
 *
 * Writes ../draft-screenshots/d13-companion/<mode>.png and prints any page error.
 * Excluded from verify:harness: screenshots, and it needs a browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const OUT_DIR = path.resolve(ROOT, '..', 'draft-screenshots', 'd13-companion');
const POPUP = pathToFileURL(path.join(ROOT, 'extension', 'popup.html')).href;
const DAY = 86400000;

const identity = { authenticated: true, username: 'ada' };
const MODES = {
  form: {
    preview: { capturable: true, ok: false },
    context: { packets: [{ packetId: 7, title: 'Backend Engineer', company: 'Northwind', createdAt: Date.now() - 2 * DAY,
      stale: false, answerCount: 14, unresolvedCount: 2, resumeAvailable: true }], posting: null, recent: [] },
  },
  posting: {
    preview: { capturable: true, ok: true, title: 'Data Engineer', company: 'Fabrikam', location: 'Boston, MA' },
    context: { packets: [], posting: { known: false, saved: false }, ats: { type: 'lever', slug: 'fabrikam' }, recent: [] },
  },
  'posting-saved': {
    preview: { capturable: true, ok: true, title: 'Backend Engineer', company: 'Northwind', location: 'Remote (US)' },
    context: { packets: [], posting: { known: true, saved: true }, recent: [] },
  },
  neither: {
    preview: { capturable: false },
    context: { packets: [], posting: null, recent: [
      { jobId: 'a', title: 'Platform Engineer', company: 'Tailspin', capturedAt: Date.now() - 3 * 3600e3 },
      { jobId: 'b', title: 'Data Engineer', company: 'Fabrikam', capturedAt: Date.now() - DAY },
      { jobId: 'c', title: 'Software Engineer II', company: 'Adatum', capturedAt: Date.now() - 4 * DAY },
    ] },
  },
};

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
  const browser = await puppeteer.launch({ executablePath: resolution.path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files'] });
  try {
    for (const [mode, fx] of Object.entries(MODES)) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 292, height: 560, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument((fx, identity) => {
        const answers = { PROBE_AUTH: identity, PREVIEW_ACTIVE_TAB: fx.preview, POPUP_CONTEXT: fx.context };
        window.chrome = {
          runtime: { sendMessage: async (m) => answers[m.type] ?? null, openOptionsPage() {} },
          tabs: { query: async () => [{ id: 1, url: 'https://example.invalid/' }], create() {} },
          storage: { local: { get: async () => ({}) } },
          scripting: { executeScript: async () => [{ result: '' }] },
        };
      }, fx, identity);
      await page.goto(POPUP, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 400));
      const file = path.join(OUT_DIR, `${mode}.png`);
      const body = await page.$('body');
      await body.screenshot({ path: file });
      console.log(`${errors.length ? 'ERROR' : 'ok   '} ${path.basename(file)}${errors.length ? '  ' + errors.join(' | ') : ''}`);
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(`Out: ${OUT_DIR}`);
}

main().catch(e => { console.error(e); process.exit(1); });
