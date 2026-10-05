#!/usr/bin/env node
/**
 * D33 — one captured job, end to end, shot against a THROWAWAY server (RM_DATA_DIR on a copied
 * database, paid keys blanked). Synthetic account and synthetic postings only.
 *
 *   node scripts/d33CaptureShots.mjs http://127.0.0.1:3081 <path to the throwaway resume_master.db>
 *
 * 1. Signs a synthetic user up and in, with an active job profile.
 * 2. Walks /extension through the install states with REAL /api/extension/status answers:
 *    not_installed (fresh) -> connected (GET /api/auth/extension-token, the extension's own token)
 *    -> not_connected (that token revoked).
 * 3. Captures with that token through the REAL POST /api/import/job (no model client on the
 *    server): a "Remote (United States)" posting (inserted), a bare "Remote" one (held, and why), and
 *    the URL of a posting already on the board (attached, with a link).
 * 4. Shoots the extension popup (the real popup.html/popup.js, chrome.* stubbed) showing each
 *    answer exactly as the server worded it, and the site's /extension page listing them.
 *
 * Writes ../draft-screenshots/d33-capture/*.png and the raw answers to responses.json.
 * Excluded from verify:harness: it needs a browser and a running throwaway server.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';

const BASE = process.argv[2] || 'http://127.0.0.1:3081';
const DB_PATH = process.argv[3];
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const OUT = path.resolve(ROOT, '..', 'draft-screenshots', 'd33-capture');
const POPUP = pathToFileURL(path.join(ROOT, 'extension', 'popup.html')).href;
const USER = { username: `d33shots${Date.now() % 100000}`, password: 'Synthetic-Pass-33!' };

let cookie = '';
async function call(method, p, body, headers = {}) {
  const r = await fetch(`${BASE}${p}`, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined, redirect: 'manual',
  });
  const set = r.headers.get('set-cookie');
  if (set && /connect\.sid=/.test(set)) cookie = set.split(';')[0];
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: r.status, json };
}

const block = (title, loc) => `Title: ${title}\nCompany: Tailspin Toys\nLocation: ${loc}\nWork Type: Remote\n` +
  'Own the deploy pipeline and the developer platform for a small product team. '.repeat(4);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const log = {};
  let r = await call('POST', '/api/auth/register', { ...USER, profile: { email: `${USER.username}@example.invalid`, first_name: 'Ada', last_name: 'Synthetic' } });
  log.register = r.status;
  r = await call('POST', '/api/auth/login', USER);
  log.login = r.status;
  if (r.status !== 200) throw new Error(`login failed ${r.status} ${JSON.stringify(r.json)}`);
  r = await call('POST', '/api/domain-profiles', { profile_name: 'Platform', role_family: 'engineering', domain: 'general', seniority: 'mid', target_titles: ['Platform Engineer'] });
  log.profile = r.status;
  if (r.json?.id || r.json?.profile?.id) await call('POST', `/api/domain-profiles/${r.json.id || r.json.profile.id}/activate`);

  const browser = await puppeteer.launch({ executablePath: (await resolveBrowserExecutable()).path, headless: 'new', pipe: true,
    args: ['--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files'] });
  const sid = cookie.split('=');
  async function shootSite(name) {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1100, deviceScaleFactor: 1 });
    await page.setCookie({ name: sid[0], value: sid.slice(1).join('='), url: BASE });
    await page.goto(`${BASE}/extension`, { waitUntil: 'networkidle0' });
    await new Promise(res => setTimeout(res, 600));
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
    const state = await page.$eval('main', m => m.innerText.slice(0, 400)).catch(() => '');
    await page.close();
    return state;
  }
  async function shootSignedOut() {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1100 });
    await page.goto(`${BASE}/extension`, { waitUntil: 'networkidle0' });
    await new Promise(res => setTimeout(res, 600));
    await page.screenshot({ path: path.join(OUT, 'site-1-signed-out.png'), fullPage: true });
    await page.close();
  }

  try {
    await shootSignedOut();
    log.status_fresh = (await call('GET', '/api/extension/status')).json;
    log.site_not_installed = await shootSite('site-2-not-installed');

    const tok = await call('GET', '/api/auth/extension-token');
    const ext = { 'X-RM-Auth-Context': tok.json.token };
    log.status_connected_empty = (await call('GET', '/api/extension/status')).json.state;

    // A posting already on the board: one crawled row of the copied database, made live and given a
    // US location so it is on the board as a crawl would leave it.
    const d = new Database(DB_PATH);
    const existing = d.prepare("SELECT job_id, url, title, company FROM scraped_jobs WHERE source = 'greenhouse' AND url LIKE 'https://%' LIMIT 1").get();
    d.prepare("UPDATE scraped_jobs SET is_active = 1, updated_at = unixepoch(), location = 'Austin, TX' WHERE job_id = ?").run(existing.job_id);
    d.prepare("DELETE FROM rejected_jobs WHERE job_id = ?").run(existing.job_id);
    d.close();

    const caps = {
      inserted: await call('POST', '/api/import/job', { url: `https://careers.tailspin.example/jobs/platform-us-${USER.username}`, text: block(`Platform Engineer ${USER.username.slice(-3)}`, 'Remote (United States)') }, ext),
      held: await call('POST', '/api/import/job', { url: `https://careers.tailspin.example/jobs/platform-remote-${USER.username}`, text: block(`Site Reliability Engineer ${USER.username.slice(-3)}`, 'Remote') }, ext),
      attached: await call('POST', '/api/import/job', { url: existing.url, text: block(existing.title, 'Austin, TX') }, ext),
      unreadable: await call('POST', '/api/import/job', { url: 'https://careers.tailspin.example/about', text: 'We are a toy company.' }, ext),
    };
    log.captures = Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, { status: v.status, capture: v.json.capture || null, error: v.json.error || null }]));
    log.status_connected = (await call('GET', '/api/extension/status')).json;
    log.site_connected = await shootSite('site-3-connected-with-captures');

    // Popup: the real popup, showing each answer as the extension's captureResult turns it into one.
    const { captureResultFrom } = await import(pathToFileURL(path.join(ROOT, 'extension', 'captureResult.js')).href);
    const results = {
      ...Object.fromEntries(Object.entries(caps).map(([k, v]) => [k, captureResultFrom(v.status, v.json, BASE)])),
      silent: captureResultFrom(200, { job: { title: 'Engineer' } }, BASE),
    };
    log.popup_results = results;
    for (const [k, result] of Object.entries(results)) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 292, height: 600, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument((result, recent) => {
        const answers = { PROBE_AUTH: { authenticated: true, username: 'ada' } };
        window.chrome = {
          runtime: { sendMessage: async (m) => answers[m.type] ?? null, openOptionsPage() {} },
          tabs: { query: async () => [{ id: 1, url: 'https://careers.tailspin.example/jobs/1' }], create() {} },
          storage: { local: { get: async () => ({ lastCapture: { ...result, at: Date.now() } }) } },
          scripting: { executeScript: async () => [{ result: '' }] },
        };
      }, result);
      await page.goto(POPUP, { waitUntil: 'load' });
      await new Promise(res => setTimeout(res, 400));
      await (await page.$('body')).screenshot({ path: path.join(OUT, `popup-${k}.png`) });
      if (errors.length) log[`popup_${k}_errors`] = errors;
      await page.close();
    }

    // not_connected: the extension's token revoked (what "Disconnect" in the popup does).
    await call('POST', '/api/auth/revoke-extension-token', null, ext);
    log.status_not_connected = (await call('GET', '/api/extension/status')).json.state;
    log.site_not_connected = await shootSite('site-4-not-connected');
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'responses.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify({ status: { fresh: log.status_fresh?.state, connected: log.status_connected?.state, not_connected: log.status_not_connected },
    captures: Object.fromEntries(Object.entries(log.captures).map(([k, v]) => [k, [v.status, v.capture?.outcome || v.error]])) }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
