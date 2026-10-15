// T11 P0 — where is an application form, really? READ-ONLY.
//
//   node scripts/t11FrameProbe.mjs <url> [--headful]
//
// Opens a public job page in a real Chrome, waits for it to settle, and prints every frame: its origin,
// its parent, and how many form controls it holds (counted, never read — no value, no label text). It
// clicks nothing, types nothing and submits nothing. Field report 10-14: on Stripe's application page
// the extension said "No application form found on this page"; this answers which of H-F1 (a
// cross-origin iframe), H-F2 (shadow DOM), H-F3 (a late render) or H-F4 (the per-site permission) it is.
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';

const url = process.argv[2];
if (!url) { console.error('usage: node scripts/t11FrameProbe.mjs <url> [--headful]'); process.exit(2); }

// Runs inside each frame. Counts only.
function census() {
  const SEL = 'input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea';
  const light = document.querySelectorAll(SEL).length;
  let shadow = 0, shadowHosts = 0;
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) { shadowHosts++; shadow += el.shadowRoot.querySelectorAll(SEL).length; walk(el.shadowRoot); }
    }
  };
  walk(document);
  return { light, shadow, shadowHosts, forms: document.forms.length,
           iframes: [...document.querySelectorAll('iframe')].map(f => { try { return new URL(f.src, location.href).origin; } catch { return '(no src)'; } }) };
}

const resolution = await resolveBrowserExecutable();
if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }
const browser = await puppeteer.launch({ executablePath: resolution.path, headless: process.argv.includes('--headful') ? false : 'new',
  pipe: true, args: ['--no-first-run', '--no-default-browser-check'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  const report = async (when) => {
    console.log(`\n── ${when} — top: ${new URL(page.url()).origin}${new URL(page.url()).pathname}`);
    for (const f of page.frames()) {
      let origin = '(unknown)';
      try { origin = new URL(f.url()).origin; } catch { /* about:blank */ }
      const parent = f.parentFrame() ? (() => { try { return new URL(f.parentFrame().url()).origin; } catch { return '?'; } })() : '(top)';
      let c = null;
      try { c = await f.evaluate(census); } catch (e) { c = { error: e.message.slice(0, 80) }; }
      console.log(JSON.stringify({ origin, path: (() => { try { return new URL(f.url()).pathname; } catch { return f.url().slice(0, 40); } })(), parent, ...c }));
    }
  };
  await report('after load');
  await new Promise(r => setTimeout(r, 6000));
  await report('after +6s');
} finally { await browser.close(); }
