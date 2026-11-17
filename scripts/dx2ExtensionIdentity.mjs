#!/usr/bin/env node
/**
 * DX2 — THE EXTENSION'S IDENTITY, REAL-RUN VERIFICATION.
 * ============================================================================================
 * WHY THIS IS A HARNESS AND NOT A UNIT TEST
 * The node suite was 2606 pass / 0 fail for the entire life of the defect this verifies. A source
 * string cannot tell you WHO a request is answered as, or what that identity can reach. Only a
 * real request from a real extension in a real browser can. Same argument as ah1SessionIdentity.
 *
 * THE DEFECT (docs/EXTENSION_DIAGNOSIS.md §6)
 * Every extension call used `credentials: 'include'`, so it acted as whatever session the browser
 * happened to hold. Signed in as an admin, a fetch from the extension origin reached 7 of 7 real
 * admin routes with real admin JSON. The extension is published, so that held for every user.
 *
 * ⛔ THE HALF-FIX THIS GUARDS AGAINST
 * Moving to a sessionLess token is NOT sufficient on its own. bindAuthContext hydrates the FULL
 * user from the token's user_id, so an admin's extension token still satisfies `isAdmin`. Section
 * 3 fails if only the credential changed and the privilege did not.
 *
 * ⛔ JUDGED BY RESPONSE BODY, NEVER BY STATUS
 * express.static + the SPA catch-all answer 200 with an HTML shell for any unknown path. A
 * status-only probe reported /api/admin/stats as a leak during diagnosis for a route that does
 * not exist. Every route below is one that REALLY exists, and every verdict reads content-type.
 *
 * ⭐ D95 (10-13): an admin is no longer a users row. It is an admin_accounts row with its OWN cookie (draft_admin,
 * path /api/admin), and the extension connects as a USER. So the browser here holds BOTH: a user session (dx2_user,
 * whom the extension acts as) and an admin session in the same cookie jar — the strongest position from which the
 * extension could inherit admin reach. Sections 2 and 4 must still read zero. (test-support/d95HarnessAdmin.mjs makes
 * the admin; the legacy ADMIN_USER / ADMIN_PASSWORD bootstrap this file used was removed in D95 Phase 2.)
 *
 * Usage:  node scripts/dx2ExtensionIdentity.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';
import { CANONICAL_ORIGIN } from '../shared/brand.js';
import { d95AdminEnv, setD95AdminPassword } from '../test-support/d95HarnessAdmin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(os.tmpdir(), 'dx2-extension-identity');
const PORT = 4614;
const API = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = 'dx2-admin@example.org';
const ADMIN_PASSWORD = 'Dx2-Admin-pass!9';
const USER = 'dx2_user';
const USER_PASSWORD = 'Dx2-User-pass!9';
const APP_URL_DECL = `const RESUME_MASTER_URL = '${CANONICAL_ORIGIN}';`;

// Routes that REALLY exist, grepped from server.js / routes/*.js. A 404 must never be mistaken
// for a guard doing its job.
const ADMIN_ROUTES = [
  '/api/admin/backups', '/api/admin/users', '/api/admin/upgrade-requests',
  '/api/admin/domain-profile-requests', '/api/admin/full-auto', '/api/admin/contact-messages',
  '/api/admin/db/tables',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) failures++;
};

function buildTestExtension(apiOrigin) {
  const src = path.join(ROOT, 'extension');
  const dst = path.join(OUT, 'extension');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'submission') continue;
      fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true });
    } else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
  for (const f of ['background.js', 'config.js']) {
    const p = path.join(dst, f);
    const t = fs.readFileSync(p, 'utf8');
    if (!t.includes(APP_URL_DECL)) {
      throw new Error(`${f}: URL constant not found — the rewrite would be a silent no-op and the run void`);
    }
    fs.writeFileSync(p, t.replace(APP_URL_DECL, `const RESUME_MASTER_URL = '${apiOrigin}';`));
  }
  const mf = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8'));
  mf.host_permissions = [...mf.host_permissions, `${apiOrigin}/*`];
  fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(mf, null, 2));
  return dst;
}

/** Probe every admin route from a page context, reporting content-type so a shell cannot pass. */
const probeAdmin = (ctx, origin, routes) => ctx.evaluate(async (o, rs) => {
  const out = {};
  for (const p of rs) {
    try {
      const r = await fetch(o + p, { credentials: 'include' });
      const ct = r.headers.get('content-type') || '';
      out[p] = { status: r.status, json: ct.includes('json'), body: (await r.text()).slice(0, 80) };
    } catch (e) { out[p] = { status: 'threw', json: false, body: e.message }; }
  }
  return out;
}, origin, routes);

/** A route "leaked" only if it answered 200 with real JSON. An HTML shell is a 404 in disguise. */
const leaked = (r) => r.status === 200 && r.json;

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const DATA_DIR = path.join(OUT, 'data');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log('=== DX2 — the extension acts as one identity, and it is never an admin ===\n');

  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }

  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, RM_DATA_DIR: DATA_DIR, PORT: String(PORT), NODE_ENV: 'development',
           SESSION_SECRET: 'dx2-secret', ...d95AdminEnv(ADMIN_EMAIL) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  server.stdout.on('data', d => log.push(String(d)));
  server.stderr.on('data', d => log.push(String(d)));
  for (let i = 0; i < 90; i++) {
    if (await fetch(`${API}/api/health`).then(r => r.ok).catch(() => false)) break;
    await sleep(1000);
  }

  const extDir = buildTestExtension(API);
  const browser = await puppeteer.launch({
    executablePath: resolution.path, headless: false, pipe: true, enableExtensions: true,
    userDataDir: path.join(OUT, 'profile'),
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1200,900'],
    defaultViewport: null,
  });

  try {
    const extensionId = await browser.installExtension(extDir);
    await browser.waitForTarget(t => t.type() === 'service_worker', { timeout: 20000 }).catch(() => null);
    const control = await browser.newPage();
    await control.goto(`chrome-extension://${extensionId}/options.html`);

    const site = await browser.newPage();
    await site.goto(`${API}/api/health`);

    // ── The browser holds a USER session AND an ADMIN session (D95), exactly as the owner's would ──
    const setPw = await setD95AdminPassword({ base: API, dbPath: path.join(DATA_DIR, 'resume_master.db'), email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    const who = await site.evaluate(async (u, up, ae, ap) => {
      const j = { 'content-type': 'application/json' };
      const reg = await fetch('/api/auth/register', { method: 'POST', credentials: 'include', headers: j,
        body: JSON.stringify({ username: u, password: up, profile: { email: u + '@example.com', first_name: u, last_name: 'Harness' } }) });
      const adm = await fetch('/api/admin/auth/login', { method: 'POST', credentials: 'include', headers: j,
        body: JSON.stringify({ email: ae, password: ap }) });
      const me = await fetch('/api/auth/me', { credentials: 'include' }).then(x => x.json());
      const adminMe = await fetch('/api/admin/auth/me', { credentials: 'include' }).then(x => x.json());
      return { reg: reg.status, adm: adm.status, me, adminMe };
    }, USER, USER_PASSWORD, ADMIN_EMAIL, ADMIN_PASSWORD);

    console.log('── 0 · the browser holds a user session AND an ADMIN session ──');
    check('the D95 admin account exists and its sign-in link set the password', setPw.ok, `status=${setPw.status}`);
    check('signed in as the user', who.me?.user?.username === USER && who.me?.user?.isAdmin !== true,
      `reg=${who.reg} ${who.me?.user?.username} isAdmin=${who.me?.user?.isAdmin}`);
    check('and as the admin, in the same browser (draft_admin)', who.adm === 200 && who.adminMe?.authenticated === true,
      `login=${who.adm} ${who.adminMe?.admin?.email}`);

    // The page context proves the SESSION still has full admin reach — the thing the extension
    // must no longer inherit. If this ever fails, the test below proves nothing.
    const bySession = await probeAdmin(site, API, ADMIN_ROUTES);
    const sessionReach = Object.values(bySession).filter(leaked).length;
    check('the admin SESSION itself still reaches admin routes (control)',
      sessionReach === ADMIN_ROUTES.length, `${sessionReach}/${ADMIN_ROUTES.length}`);

    // ── 1 · the extension holds its OWN credential ─────────────────────────────────────────
    console.log('\n── 1 · the extension holds a credential of its own ──');
    const identity = await control.evaluate(() => chrome.runtime.sendMessage({ type: 'PROBE_AUTH' }));
    check('the extension is authenticated', identity?.authenticated === true, JSON.stringify(identity));
    check('and it NAMES the identity it acts as', !!identity?.username, identity?.username || '(none)');

    const stored = await control.evaluate(() => chrome.storage.local.get('authToken'));
    check('a sessionLess token was obtained and stored',
      typeof stored?.authToken === 'string' && stored.authToken.length > 20,
      stored?.authToken ? `${stored.authToken.slice(0, 8)}… (${stored.authToken.length} chars)` : 'ABSENT');

    const row = await control.evaluate(async (o, t) =>
      fetch(o + '/api/auth/me', { credentials: 'omit', headers: { 'X-RM-Auth-Context': t } })
        .then(r => r.json()), API, stored?.authToken);
    check('the token alone — no cookie — authenticates as that user',
      row?.authenticated === true && row.user?.username === USER,
      `${row?.user?.username}`);

    // ── 2 · THE FIX. The extension must not reach an admin route ───────────────────────────
    console.log('\n── 2 · admin routes, from the EXTENSION, judged by BODY ──');
    const byExt = await probeAdmin(control, API, ADMIN_ROUTES);
    let reached = 0;
    for (const [p, r] of Object.entries(byExt)) {
      if (leaked(r)) reached++;
      console.log(`      ${p.padEnd(36)} ${r.status} ${r.json ? 'JSON' : 'html/other'}${leaked(r) ? '  << REACHED' : ''}`);
    }
    check('the extension reaches ZERO admin routes', reached === 0, `${reached}/${ADMIN_ROUTES.length} reached`);
    check('and it is refused with 403, not merely 404-shaped',
      Object.values(byExt).every(r => r.status === 403),
      [...new Set(Object.values(byExt).map(r => r.status))].join(','));

    // ── 3 · the admin is STILL an admin in a tab — the extension's refusal is about the credential ─────
    console.log('\n── 3 · the admin session still reaches admin routes; the extension does not ──');
    check('the admin session still reaches admin routes in a browser tab',
      Object.values(await probeAdmin(site, API, ADMIN_ROUTES)).filter(leaked).length === ADMIN_ROUTES.length,
      'session unchanged');
    check('the account the extension acts as is not an admin (D95: no users row is one)',
      identity?.accountIsAdmin !== true, `accountIsAdmin=${identity?.accountIsAdmin}`);

    // ── 4 · it is NOT the cookie. Sign the browser out; the extension must survive ──────────
    // This is the assertion that cannot be faked by a token that merely rides alongside a session.
    console.log('\n── 4 · the credential is not the cookie ──');
    await site.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
    const afterLogout = await site.evaluate(() =>
      fetch('/api/auth/me', { credentials: 'include' }).then(r => r.json()));
    check('the browser USER session is genuinely gone (the admin cookie stays — the harder case)', afterLogout?.authenticated === false,
      JSON.stringify(afterLogout));

    const extAfter = await control.evaluate(() => chrome.runtime.sendMessage({ type: 'PROBE_AUTH' }));
    check('the extension still works after a browser sign-out (sessionLess)',
      extAfter?.authenticated === true, JSON.stringify(extAfter));

    const byExtAfter = await probeAdmin(control, API, ADMIN_ROUTES);
    check('and it STILL reaches zero admin routes',
      Object.values(byExtAfter).filter(leaked).length === 0);

    // ── 5 · disconnect really revokes ──────────────────────────────────────────────────────
    console.log('\n── 5 · disconnect ends the credential server-side ──');
    const tokenBefore = (await control.evaluate(() => chrome.storage.local.get('authToken')))?.authToken;
    await control.evaluate(() => chrome.runtime.sendMessage({ type: 'DISCONNECT' }));
    const cleared = await control.evaluate(() => chrome.storage.local.get('authToken'));
    check('the token is cleared locally', !cleared?.authToken);
    const replay = await control.evaluate(async (o, t) =>
      fetch(o + '/api/auth/me', { credentials: 'omit', headers: { 'X-RM-Auth-Context': t } })
        .then(r => r.json()), API, tokenBefore);
    check('and replaying the old token no longer authenticates',
      replay?.authenticated === false, JSON.stringify(replay));

    // ── 6 · the options page NAMES the identity — asserted on the rendered DOM ──────────────
    // T31 (10-25, ed98eb6) retired the toolbar popup; its identity line (Signed in as …) lives in options.html's
    // #account-who now (extension/options.js showAccount).
    console.log('\n── 6 · the options page names the identity, in the rendered page ──');
    await site.bringToFront();
    await site.evaluate(async (u, p) => {
      await fetch('/api/auth/login', { method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }) });
    }, USER, USER_PASSWORD);

    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${extensionId}/options.html`);
    await sleep(2500);
    const shown = await popup.evaluate(() => document.getElementById('account-who')?.innerText || '');
    check('the options page renders "Signed in as <name>"',
      /signed in as/i.test(shown) && shown.includes(USER), JSON.stringify(shown));
    check('and it claims no admin role (the account is not an admin)',
      !/acting as admin/i.test(shown), JSON.stringify(shown));

    // ── 7 · regression — the extension's OWN routes still work ─────────────────────────────
    console.log('\n── 7 · regression: the extension can still do its job ──');
    const ownRoutes = await control.evaluate(async (o) => {
      const out = {};
      for (const p of ['/api/auth/me', '/api/apply/gate-packets']) {
        const r = await fetch(o + p, { credentials: 'include' });
        out[p] = { status: r.status, json: (r.headers.get('content-type') || '').includes('json') };
      }
      return out;
    }, API);
    for (const [p, r] of Object.entries(ownRoutes)) {
      check(`${p} still answers the extension`, r.status === 200 && r.json, `${r.status}`);
    }

    // Matches server.js's requireAdmin warning verbatim. routes/admin.js and routes/adminDb.js
    // refuse silently, so this counts the server.js-guarded routes only — it is a corroborating
    // signal, never the verdict. The verdict is the 403s above, read from response bodies.
    // ── 8 · THE PUBLISHED BUILD. Are EXISTING users protected without a store update? ──────
    // This is the question that matters for an extension that is already installed. v1.0.0 sends
    // the ambient cookie on every call and knows nothing about tokens. If the server-side half of
    // the fix is doing its job, that build must be unable to reach an admin route TODAY — before
    // any store review, and whatever the user has installed.
    console.log('\n── 8 · the PUBLISHED v1.0.0 build, against the fixed server ──');
    const zipPath = path.join(ROOT, 'extension', 'submission', 'resume-master-extension-v1.0.0.zip');
    if (!fs.existsSync(zipPath)) {
      check('the published zip is present to test against', false, zipPath);
    } else {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
      const oldDir = path.join(OUT, 'published-v1.0.0');
      fs.rmSync(oldDir, { recursive: true, force: true });
      for (const entry of Object.values(zip.files).filter(f => !f.dir)) {
        const dest = path.join(oldDir, entry.name);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, Buffer.from(await entry.async('uint8array')));
      }
      for (const f of ['background.js', 'config.js']) {
        const p = path.join(oldDir, f);
        if (!fs.existsSync(p)) continue;
        fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
          .replace(APP_URL_DECL, `const RESUME_MASTER_URL = '${API}';`));
      }
      const oldMf = JSON.parse(fs.readFileSync(path.join(oldDir, 'manifest.json'), 'utf8'));
      oldMf.host_permissions = [...oldMf.host_permissions, `${API}/*`];
      fs.writeFileSync(path.join(oldDir, 'manifest.json'), JSON.stringify(oldMf, null, 2));

      check('the published build predates the fix (no auth.js, still cookie-only)',
        !fs.existsSync(path.join(oldDir, 'auth.js')), `v${oldMf.version}`);

      // Installed into the DEFAULT context: extension pages are blocked in a secondary browser
      // context (ERR_BLOCKED_BY_CLIENT), and the default context is also where the live admin
      // cookie already is — which is the strongest possible position to test the old build from.
      const oldId = await browser.installExtension(oldDir);
      const oldPage = await browser.newPage();
      await oldPage.goto(`chrome-extension://${oldId}/options.html`);

      const byOld = await probeAdmin(oldPage, API, ADMIN_ROUTES);
      const oldReach = Object.values(byOld).filter(leaked).length;
      check('the ALREADY-PUBLISHED build reaches zero admin routes too',
        oldReach === 0, `${oldReach}/${ADMIN_ROUTES.length} reached`);

    }

    const refusals = log.join('').match(/admin route refused to the extension/g) || [];
    console.log(`\n  server logged ${refusals.length} explicit extension-admin refusals`);
  } finally {
    await browser.close().catch(() => {});
    server.kill();
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
