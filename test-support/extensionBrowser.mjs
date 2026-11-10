/**
 * J2 · THE EXTENSION BROWSER HARNESS — the REAL extension, in a real Chrome, on the Workday-shaped fixture.
 * =========================================================================================================
 * Extracted from scripts/workdayStagesWalk.mjs (8d1fa87) so every lane of the extension run (D96 · D97 · D98) drives
 * the same browser the same way. One call gives a lane:
 *
 *   · Chrome with the UNPACKED extension (a TEST build — see buildTestExtension), a resolver rule that maps Zoom's
 *     real tenant host (zoom.wd5.myworkdayjobs.com) onto scripts/fakeAts.js, so every URL the extension and the
 *     server see is the owner's own shape; nothing reaches Zoom or Workday;
 *   · the REAL routes (routes/apply.js, routes/importJob.js) on the FULL schema (scripts/migrations.js) and a
 *     SYNTHETIC user (Ada Example) — never a real person;
 *   · helpers to open a stage, change the Workday step without changing the URL, send the extension's messages,
 *     trigger capture / fill / prepare / the Copy sheet, read the review panel and the Copy sheet, read
 *     chrome.storage.local / .session, reload, and switch light / dark.
 *
 * ⛔ The harness never ticks, checks or signs anything. There is deliberately NO helper that sets a checkbox, a radio
 *   or a signature: terms / consent / attestation / signature controls are the user's own click (D96 §4 safeguard 1),
 *   and a scenario that reaches into `h.page` to tick one is breaking that rule, not using the harness.
 * ⛔ No new permission. The test build adds the API origin and the tenant to host_permissions — standing in for the
 *   user's activeTab gesture exactly as scripts/d55AutofillWorkday.mjs explains — and nothing else; the SHIPPED
 *   manifest is untouched (extension/manifest.json is the coordinator's).
 * ⛔ No Chrome → no run. findChrome() returns { skip: reason }; launchExtensionBrowser throws a HarnessSkip carrying it,
 *   which a node:test turns into `{ skip }` and the walk runner prints as SKIP.
 *
 * The scenario runner and the one command: test-support/walkExtension.mjs, `npm run walk:extension -- <scenario>`.
 */
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── the owner's Zoom URL (D96 §0), the fixture's addresses ──────────────────────────────────────────────────────────
export const TENANT = 'zoom.wd5.myworkdayjobs.com';
export const T = `http://${TENANT}`;   // http: the fake ATS does not speak TLS; the KEY ignores the scheme (jobPageKey.js)
export const POSTING_PATH = '/Zoom/job/Remote--(US)/Software-Engineer_R19749-1';
export const POSTING = `${T}${POSTING_PATH}`;
export const OWNER_STAGE = `${T}/en-US${POSTING_PATH}/apply/applyManually?source=linkedin`;
export const OTHER_STAGE = `${T}${POSTING_PATH}/apply/useMyLastApplication?source=linkedin`;
/** The stages the fixture answers: posting · apply · applyManually · useMyLastApplication (D96 §0). */
export function stageUrl(stage = 'applyManually', { locale = true, source = 'linkedin' } = {}) {
  const tail = stage === 'posting' ? '' : stage === 'apply' ? '/apply' : `/apply/${stage}`;
  return `${T}${locale ? '/en-US' : ''}${POSTING_PATH}${tail}${source ? `?source=${encodeURIComponent(source)}` : ''}`;
}
/** The Workday steps inside one URL (scripts/fakeAts.js WS_STEPS). On the path: Save and Continue walks them. */
export const STEPS = ['myInformation', 'myExperience', 'applicationQuestions', 'voluntaryDisclosures', 'selfIdentify', 'review'];
/** Off the path — reached only with goStep(): sign-in (a password input) and the step nothing on which is recognisable. */
export const OFF_PATH_STEPS = ['signIn', 'unrecognised'];

export const DEFAULT_OUT_DIR = path.join(os.tmpdir(), 'draft-extension-walk');
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/**
 * ⭐ J11 · the bound on a wait for something the walk EXPECTS to happen. A condition wait returns the moment its
 * condition holds, so a generous bound costs nothing when the machine is quick — it only decides how long a slow one
 * may take before the check fails. `npm test` runs test files in parallel, several of them real Chromes, and timed on
 * this machine under load the J4 panel took 24–29 s to appear after Prepare (≈0.25 s idle): the old 6 s + 8 s budget
 * failed that check once in a full run. Not for waits that expect NOTHING to happen — those are sleeps, said so.
 */
export const BUSY_MS = 60000;
export const waitUntil = async (fn, ms = 5000, every = 150) => {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(every); }
};
export const freePort = () => new Promise((resolve, reject) => {
  const s = net.createServer();
  s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** A run that cannot happen here (no Chrome). Its message is the reason, said plainly. */
export class HarnessSkip extends Error { constructor(reason) { super(reason); this.name = 'HarnessSkip'; this.reason = reason; } }

/** { path } when a Chrome binary exists, else { skip: '<why>' } — the form node:test's `skip` option takes. */
export async function findChrome() {
  try {
    const { resolveBrowserExecutable } = await import('../services/browserLauncher.js');
    const r = await resolveBrowserExecutable();
    if (r?.path && fs.existsSync(r.path)) return { path: r.path, source: r.source || null };
  } catch { /* fall through */ }
  return { skip: 'no Chrome on this machine (services/browserLauncher.js found none)' };
}

// ── the fake ATS (scripts/fakeAts.js), as its own process ───────────────────────────────────────────────────────────
export async function startFakeAts({ port } = {}) {
  const p = port || await freePort();
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'fakeAts.js')], { env: { ...process.env, PORT: String(p) }, stdio: 'ignore' });
  const origin = `http://localhost:${p}`;
  const up = await waitUntil(() => fetch(`${origin}${POSTING_PATH}`).then(r => r.ok).catch(() => false), 15000, 100);
  if (!up) { child.kill(); throw new Error('scripts/fakeAts.js did not come up'); }
  return {
    port: p, origin,
    /** What the fake ATS recorded as SUBMITTED — the extension must never add a row (it never submits). */
    submissions: async (provider) => {
      const all = (await (await fetch(`${origin}/_submissions`)).json()).submissions || [];
      return provider ? all.filter(s => s.provider === provider) : all;
    },
    reset: () => fetch(`${origin}/_reset`, { method: 'POST' }),
    stop: () => child.kill(),
  };
}

// ── the API: the REAL routes on the FULL schema, one SYNTHETIC user ─────────────────────────────────────────────────
export const DEFAULT_PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', email: 'ada@example.test' }, handler_map: {},
  custom_answers: { 'Why do you want to work at Zoom?': 'Video for everyone.' },
};
/** The walk's seed (8d1fa87): Ada, a profile, and the board's Zoom copy from ANOTHER ATS — the owner's case. */
export function defaultSeed(db) {
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Example','ada@example.test')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,location,url,apply_url,search_query,_hash,discovered_at)
    VALUES ('gh-zoom-1','Software Engineer','Zoom','Remote (US)','https://boards.greenhouse.io/zoom/jobs/9001','https://boards.greenhouse.io/zoom/jobs/9001','t','h1',unixepoch()-86400)`).run();
}

/**
 * Start the API. `seed(db)` replaces the default seed (call defaultSeed(db) inside it to extend); `payload` is what
 * the profile resolver returns; `mount(app, db)` adds a lane's own routes (a lane's handler module under test).
 * Every request is LOGGED (method, path, body) so a run can prove what the extension did — and did not — send.
 */
export async function startApi({ seed = defaultSeed, payload = DEFAULT_PAYLOAD, mount = null } = {}) {
  const [{ default: express }, { default: Database }, { default: applyRoutes }, { createImportJobRouter }, { MIGRATIONS }, { createExtensionJobRouter }] = await Promise.all([
    import('express'), import('better-sqlite3'), import('../routes/apply.js'), import('../routes/importJob.js'), import('../scripts/migrations.js'),
    import('../routes/extensionJob.js'),
  ]);
  const db = new Database(':memory:');
  for (const m of MIGRATIONS) db.exec(m.sql);
  seed(db);
  const requests = [];
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use((req, _res, next) => {
    requests.push({ at: Date.now(), method: req.method, path: req.path, query: req.query, headers: { ...req.headers }, body: req.body ?? null });
    next();
  });
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RM-Auth-Context, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use((req, _res, next) => { req.user = { id: 1, planTier: 'PRO', username: 'ada' }; next(); });
  app.get('/api/auth/me', (_req, res) => res.json({ authenticated: true, user: { username: 'ada', isAdmin: false } }));
  app.get('/api/auth/extension-token', (_req, res) => res.json({ token: 'walk-harness-token' }));
  app.get('/api/draft/slots', (_req, res) => res.json({ limit: 10, used: 0, remaining: 10, windowHours: 24 }));
  if (mount) await mount(app, db);
  // ⭐ BINDING FIRST (owner 10-15): every press identifies the page first (POST /api/extension/page) — the REAL route,
  // mounted AFTER a lane's own `mount` so a walk that mounts it with its own scorer (atsOnPage, boardBridge) wins.
  // Only that one path: GET /api/extension/job/:id stays a lane's to mount (the résumé panel's report reads it).
  // No base résumé here: the identify's report is "no_base_resume", never a made-up score.
  const identifyRoute = createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: () => true,
    scoreFor: () => null, scoreText: () => null, hasBaseResume: () => false });
  app.use((req, res, next) => (req.method === 'POST' && req.path === '/api/extension/page' ? identifyRoute(req, res, next) : next()));
  applyRoutes(app, db, (q, r, n) => n(), () => payload, async () => ({ error: 'not_needed' }), async () => Buffer.from('%PDF-1.4'), async () => ({}), () => null, {});
  app.use('/api/import', createImportJobRouter(db));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const stop = () => new Promise(r => { server.close(() => r()); server.closeAllConnections?.(); setTimeout(r, 2000).unref?.(); });
  return { db, server, requests, origin: `http://127.0.0.1:${server.address().port}`, stop };
}

// ── the TEST build of the extension ─────────────────────────────────────────────────────────────────────────────────
const APP_URL_DECL = (origin) => `const RESUME_MASTER_URL = '${origin}';`;
/**
 * Copy extension/ (without submission/ and dist/) to `outDir`, point it at `apiOrigin`, and add the API origin and
 * the tenant(s) to host_permissions. TEST BUILD ONLY — it stands in for the user's activeTab gesture; the shipped
 * manifest is not touched. Throws if background.js stops declaring RESUME_MASTER_URL the way it does today.
 */
export async function buildTestExtension({ apiOrigin, outDir, hosts = [`${T}/*`], backgroundAppend = '' }) {
  const { CANONICAL_ORIGIN: canonical } = await import('../shared/brand.js');
  const src = path.join(ROOT, 'extension');
  const dst = path.join(outDir, 'extension');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name === 'submission' || e.name === 'dist') continue; fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true }); }
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
  for (const f of ['background.js', 'config.js']) {
    const p = path.join(dst, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (f === 'background.js' && !text.includes(APP_URL_DECL(canonical))) throw new Error(`${f} no longer declares ${APP_URL_DECL(canonical)} — the harness cannot point it at the test API`);
    // backgroundAppend: a lane's PROPOSED router wiring, appended to the TEST build's background.js only (the shipped
    // background.js is the coordinator's) — so a browser pass proves the exact lines the lane hands over.
    fs.writeFileSync(p, text.replace(APP_URL_DECL(canonical), APP_URL_DECL(apiOrigin)) + (f === 'background.js' && backgroundAppend ? `
${backgroundAppend}
` : ''));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8'));
  manifest.host_permissions = [...(manifest.host_permissions || []), `${apiOrigin}/*`, ...hosts];   // TEST BUILD ONLY
  // D99 J11's bridge runs on draft's own origin — in the test build, the test API's (as RESUME_MASTER_URL is above)
  for (const cs of manifest.content_scripts || []) cs.matches = cs.matches.map(m => (m === `${canonical}/*` ? `${apiOrigin}/*` : m));
  fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dst;
}

// ── page-side readers (serialised into the page with page.evaluate — they close over nothing) ──────────────────────
/**
 * The review panel. Reads #rm-gate-review-overlay (extension/review-overlay.js) — through its shadow root when it has
 * one (J4 may move it into one), else the element itself. Returns null when the panel is not on the page.
 *   { shadow, title, subtitle, state, stateClass, groups: [{ title, rows: [{ label, value, tier, band }] }], rows, text }
 * A lane that changes the panel's markup keeps these hooks or updates READ_PANEL_SELECTORS in the same commit.
 */
export const READ_PANEL_SELECTORS = {
  // J4 (D96 §5): the panel is in a shadow root; `subtitle` is its progress line ("14 of 18 filled · 2 need you · 3 to
  // check"), a row's `band` its group (need · check · ok), `label` the page's label without the asterisk.
  hostId: 'rm-gate-review-overlay', title: '.rm-t', subtitle: '[data-role="progress"]', state: '[data-role="state"]',
  group: '.rm-sec', groupTitle: '.rm-lbl', row: '.rm-row', label: '[data-role="label"]', value: '[data-role="value"]', tier: '.rm-pill',
};
function readPanelInPage(sel) {
  const host = document.getElementById(sel.hostId);
  if (!host) return null;
  const root = host.shadowRoot || host;
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const plain = (n) => [...n.childNodes].map(c => (c.nodeName === 'STYLE' || c.nodeName === 'SCRIPT' ? '' : c.nodeType === 3 ? c.textContent : plain(c))).join(' ').replace(/\s+/g, ' ').trim();
  const rowOf = (r) => ({ label: t(r.querySelector(sel.label)), value: t(r.querySelector(sel.value)), tier: t(r.querySelector(sel.tier)), band: r.dataset.band || null });
  const groups = [...root.querySelectorAll(sel.group)].map(g => ({ title: t(g.querySelector(sel.groupTitle)), rows: [...g.querySelectorAll(sel.row)].map(rowOf) }));
  const stateEl = root.querySelector(sel.state);
  return {
    shadow: !!host.shadowRoot, title: t(root.querySelector(sel.title)), subtitle: t(root.querySelector(sel.subtitle)),
    state: t(stateEl), stateClass: stateEl ? stateEl.className : null, groups,
    rows: [...root.querySelectorAll(sel.row)].map(rowOf), text: plain(root),
  };
}
/** The in-page Copy sheet (extension/copy-sheet-panel.js, #rm-copy-sheet-panel, shadow DOM). null when closed. */
function readCopySheetInPage() {
  const host = document.getElementById('rm-copy-sheet-panel');
  if (!host) return null;
  const root = host.shadowRoot || host;
  const t = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null);
  const note = root.querySelector('[data-unanswered]');
  return {
    title: t(root.querySelector('.t b')), sub: t(root.querySelector('.t small')),
    rows: [...root.querySelectorAll('li')].map(li => ({ label: t(li.querySelector('.k')), value: t(li.querySelector('.v')), eligibility: li.classList.contains('elig') })),
    unanswered: note ? Number(note.dataset.unanswered) : 0, empty: t(root.querySelector('.empty')),
    minimised: !!root.querySelector('.p.mini'), dock: host.style.left ? 'left' : 'right', text: t(root.querySelector('.p')),
  };
}
/** The controls draft must NEVER set: the consent box and the signature, wherever the page keeps them. */
function guardedInPage() {
  const saved = window.__wd ? window.__wd.values().values : {};
  const live = (id) => document.getElementById(id);
  const val = (id) => (live(id) ? (live(id).type === 'checkbox' ? live(id).checked : live(id).value) : saved[id]);
  const date = ['month', 'day', 'year'].map(p => val(`ws-sig-date-${p}`) || '').join('/');
  return {
    step: window.__wd ? window.__wd.step() : null,
    consentTicked: val('ws-consent') === true,
    signatureName: val('ws-sig-name') || '',
    signatureDate: date === '//' ? '' : date,
    passwordIntact: live('ws-signIn-password') ? live('ws-signIn-password').value === window.__wd.passwordSentinel : null,
  };
}

// ── the harness ─────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Launch everything. Options:
 *   headless (true) · viewport ({ width: 1280, height: 900 }) · theme ('light' | 'dark', emulated on the page)
 *   api: { seed, payload, mount } (startApi) · atsPort · outDir · hosts (extra test-build host_permissions)
 * Returns the harness `h` (see the README block in test-support/walkExtension.mjs for the full list).
 */
export async function launchExtensionBrowser(opts = {}) {
  const chrome = await findChrome();
  if (chrome.skip) throw new HarnessSkip(chrome.skip);
  const outDir = opts.outDir || path.join(DEFAULT_OUT_DIR, `run-${process.pid}-${Date.now()}`);
  fs.mkdirSync(outDir, { recursive: true });
  const cleanups = [];
  const cleanup = async () => { for (const f of cleanups.splice(0).reverse()) { try { await f(); } catch { /* best effort */ } } };
  try {
    const ats = await startFakeAts({ port: opts.atsPort });
    cleanups.push(() => ats.stop());
    const api = await startApi(opts.api || {});
    cleanups.push(() => api.stop());
    const ext = await buildTestExtension({ apiOrigin: api.origin, outDir, hosts: opts.hosts || [`${T}/*`], backgroundAppend: opts.backgroundAppend || '' });
    const profileDir = path.join(outDir, 'profile');
    fs.rmSync(profileDir, { recursive: true, force: true });
    const { default: puppeteer } = await import('puppeteer-core');
    const browser = await puppeteer.launch({
      executablePath: chrome.path, headless: opts.headless !== false, pipe: true, enableExtensions: true, userDataDir: profileDir,
      // T11: `resolverRules` add hosts (["MAP careers.acme.test 127.0.0.1:443"]); `chromeArgs` add flags; `insecureCerts`
      // accepts a lane's throwaway self-signed certificate (an HTTPS fixture — the ATS families' origins are https).
      acceptInsecureCerts: !!opts.insecureCerts,
      args: ['--no-first-run', '--no-default-browser-check',
        `--host-resolver-rules=${[`MAP ${TENANT} 127.0.0.1:${ats.port}`, ...(opts.resolverRules || [])].join(', ')}`,
        // 46c: Chrome 157 (auto-updated 11-09) turns on HTTPS-First balanced mode by default, which refuses a plain-http
        // navigation to a public hostname (the mapped tenant) with net::ERR_BLOCKED_BY_CLIENT — every walk failed at open().
        '--disable-features=HttpsFirstBalancedModeAutoEnable',
        ...(opts.insecureCerts ? ['--ignore-certificate-errors'] : []), ...(opts.chromeArgs || [])],
      defaultViewport: opts.viewport || { width: 1280, height: 900 },
    });
    // A browser that will not close in 5 s is killed: a hung close must never hold a lane's command open.
    cleanups.push(() => Promise.race([browser.close(), sleep(5000).then(() => { try { browser.process()?.kill('SIGKILL'); } catch { /* gone */ } })]));
    const extensionId = await browser.installExtension(ext);
    const control = await browser.newPage();
    await control.goto(`chrome-extension://${extensionId}/options.html`);
    // ⭐ D112 b2: the first toolbar press opens the ONE global-read ask (a focused popup window) while it is due. The walks
    // written before it press the toolbar as a person who has already answered it (Not now) — so the window never steals
    // their tab's focus; `globalAsk: 'due'` leaves it unanswered (test/d112GlobalReadChrome.test.js answers it).
    if (opts.globalAsk !== 'due') {
      await control.evaluate(async () => {
        const cur = (await chrome.storage.local.get('autoRead'))?.autoRead || {};
        await chrome.storage.local.set({ autoRead: { ...cur, globalAsk: { at: Date.now(), answer: 'later' } } });
      });
    }
    const page = (await browser.pages())[0];
    let theme = opts.theme || 'light';
    const applyTheme = async (p) => p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await applyTheme(page);

    const h = {
      browser, extensionId, page, control, api, ats, db: api.db, outDir,
      // ── messages and storage (through an extension page, as the popup would) ──
      send: (msg) => control.evaluate((m) => chrome.runtime.sendMessage(m), msg),
      /**
       * ⭐ T17 / T22 · a message FROM THE PAGE'S TAB — sent in the extension's own isolated world in the page's TOP frame,
       * exactly as a control on the dock sends it (the sender is the tab, frame 0). It exists for the presses that have no
       * control yet: a résumé is started only by the Draft button (T24) and the résumé row's "Generate and attach" (T18),
       * neither built at T22 — so the walks start one the way those controls will. The extension's world must already be
       * in the page (anything drawn on the dock puts it there).
       */
      async pageSend(msg) {
        const cdp = await page.createCDPSession();
        try {
          const contexts = [];
          cdp.on('Runtime.executionContextCreated', (e) => contexts.push(e.context));
          await cdp.send('Runtime.enable');
          const top = (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
          const ctx = contexts.filter(c => c.auxData?.frameId === top && !c.auxData?.isDefault && String(c.origin || '').includes(extensionId)).at(-1);
          if (!ctx) throw new Error('pageSend: the extension has no world in this page yet — draw something on the dock first');
          const r = await cdp.send('Runtime.evaluate', { contextId: ctx.id, awaitPromise: true, returnByValue: true,
            expression: `chrome.runtime.sendMessage(${JSON.stringify(msg)})` });
          if (r.exceptionDetails) throw new Error(`pageSend: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
          return r.result?.value ?? null;
        } finally { await cdp.detach().catch(() => {}); }
      },
      storage: {
        local: () => control.evaluate(() => chrome.storage.local.get(null)),
        session: () => control.evaluate(() => chrome.storage.session.get(null)),
        set: (area, items) => control.evaluate((a, i) => chrome.storage[a].set(i), area, items),
        clear: (area) => control.evaluate((a) => chrome.storage[a].clear(), area),
      },
      bindings: async () => Object.entries(await h.storage.session()).filter(([k]) => k.startsWith('bind:')),
      // ── the extension's own actions (the popup's buttons send the same messages) ──
      capture: () => h.send({ type: 'CAPTURE_ACTIVE_TAB' }),
      /**
       * Fill / Prepare. ⚠ On a Workday-shaped step the extension runs its D55 WIZARD: it fills the step, then — while a
       * required field is still empty — shows the badge and WAITS FOR THE CANDIDATE (up to 9 minutes,
       * gated-handoff.js CANDIDATE_WAIT_MS) before it replies. So these resolve to the reply, or — when none came
       * within `timeoutMs` — to { pending: true, reply } (reply: the promise of the late answer). The review panel is
       * drawn only when the run ENDS: dismissBadge() (the candidate's ×) or Review ends it.
       */
      fill: (o) => h.action({ type: 'FILL_ACTIVE_TAB' }, o),
      prepare: (o) => h.action({ type: 'PREPARE_ACTIVE_TAB' }, o),
      async action(msg, { timeoutMs = 20000 } = {}) {
        const reply = h.send(msg);
        const late = Symbol('pending');
        const r = await Promise.race([reply, sleep(timeoutMs).then(() => late)]);
        return r === late ? { pending: true, reply } : r;
      },
      /**
       * ⭐ (open item 2, walks under load) Send an action and wait for what it DID — its own reply, or the wizard's own
       * signal that it is waiting for the candidate (the status line in state "required") — whichever comes first,
       * bounded by BUSY_MS. action()'s `timeoutMs` decided "is it waiting?" by a fixed time, which under a full run's load
       * is also what a slow fill looks like: t11 (a) read "a single-page form does not wait" as failed when its fill took
       * > 30 s, and a walk that then waited for a "required" that never came spent a minute per press. Resolves to
       *   { answered: true, reply }                       the action answered by itself
       *   { answered: false, waitingForYou: true, reply }  the status line asked the candidate first (reply: the promise)
       *   { answered: false, waitingForYou: false, reply } neither within the bound (reply: the promise)
       * `on` reads the status line on another tab (a walk that opens one per section).
       */
      async untilAnswerOrWaiting(msg, { on = page, ms = BUSY_MS } = {}) {
        const reply = h.send(msg);
        let answered = null;
        reply.then((v) => { answered = { v }; }, (e) => { answered = { v: { ok: false, reason: 'send_failed', message: String(e) } }; });
        const badgeState = () => on.evaluate(() => document.getElementById('rm-draft-autofill-badge')?.dataset.state || null).catch(() => null);
        const seen = await waitUntil(async () => (answered ? 'answered' : (await badgeState()) === 'required' ? 'required' : null), ms);
        if (answered) return { answered: true, waitingForYou: false, reply: answered.v };
        return { answered: false, waitingForYou: seen === 'required', reply };
      },
      /** The on-page autofill badge (extension/autofill-badge.js, shadow DOM): { state, missing, text, dismissed } or null. */
      readBadge: () => page.evaluate(() => {
        const host = document.getElementById('rm-draft-autofill-badge');
        if (!host) return null;
        const r = host.shadowRoot;
        return { state: host.dataset.state || null, missing: Number(host.dataset.missing || 0), dismissed: host.dataset.dismissed === '1',
          text: r?.querySelector('[data-role="text"]')?.textContent?.trim() || null, title: r?.querySelector('[data-role="text"]')?.title || null };
      }),
      /** The candidate's × on the badge — it STOPS the wizard (the extension's own stop signal). Not a form control. */
      dismissBadge: () => page.evaluate(() => {
        const b = document.getElementById('rm-draft-autofill-badge')?.shadowRoot?.querySelector('[data-role="dismiss"]');
        if (!b) return false;
        b.click();
        return true;
      }),
      popupContext: () => h.send({ type: 'POPUP_CONTEXT' }),
      capturedToday: () => h.send({ type: 'CAPTURED_TODAY' }),
      openCopySheet: () => h.send({ type: 'COPY_SHEET_PANEL' }),
      // ── the page ──
      async open(url, { settle = 250 } = {}) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.bringToFront();   // the extension acts on the ACTIVE tab
        await sleep(settle);
        return page.url();
      },
      /** Open an apply stage (stageUrl's names), optionally on a Workday step other than My Information. */
      async openStage(stage = 'applyManually', { step = null, locale = true, source = 'linkedin' } = {}) {
        const url = await h.open(stageUrl(stage, { locale, source }));
        if (step) await h.goStep(step);
        return url;
      },
      /** Change the Workday STEP without changing the URL (the fixture's window.__wd.go). */
      async goStep(id) {
        const before = page.url();
        await page.evaluate((s) => window.__wd.go(s), id);
        if (page.url() !== before) throw new Error(`goStep(${id}) changed the URL — the fixture must not`);
        await sleep(50);
        return id;
      },
      step: () => page.evaluate(() => (window.__wd ? window.__wd.step() : null)),
      steps: () => page.evaluate(() => (window.__wd ? window.__wd.steps : [])),
      /** Save and Continue — ⛔ refuses on Review, where the same button is Submit. */
      async next() {
        if ((await h.step()) === 'review') throw new Error('next() on Review would press Submit — the harness never submits');
        await page.click('#next-step');
        await sleep(50);
        return h.step();
      },
      pageValues: () => page.evaluate(() => (window.__wd ? window.__wd.values() : null)),
      async reload({ settle = 250 } = {}) { await page.reload({ waitUntil: 'domcontentloaded' }); await page.bringToFront(); await sleep(settle); },
      async setTheme(next) {
        if (next !== 'light' && next !== 'dark') throw new Error(`theme must be light or dark, not ${next}`);
        theme = next;
        await applyTheme(page);
        return theme;
      },
      theme: () => theme,
      // ── readers ──
      readPanel: (selectors = {}) => page.evaluate(readPanelInPage, { ...READ_PANEL_SELECTORS, ...selectors }),
      /** T11: the review panel inside a FRAME (an embedded ATS form) — `match(url)` picks the frame. null when absent. */
      readPanelInFrame: async (match, selectors = {}) => {
        const f = page.frames().find(fr => match(fr.url()));
        return f ? f.evaluate(readPanelInPage, { ...READ_PANEL_SELECTORS, ...selectors }) : null;
      },
      frame: (match) => page.frames().find(fr => match(fr.url())) || null,
      waitForPanel: (ms = BUSY_MS) => waitUntil(() => h.readPanel(), ms),
      readCopySheet: () => page.evaluate(readCopySheetInPage),
      waitForCopySheet: (ms = BUSY_MS) => waitUntil(() => h.readCopySheet(), ms),
      /** Read any shadow host's root with your own page function: readShadow('rm-…', (root) => …). */
      readShadow: (hostId, fn) => page.evaluate((id, src) => {
        const host = document.getElementById(id);
        if (!host) return null;
        // eslint-disable-next-line no-new-func
        return new Function('root', 'host', `return (${src})(root, host);`)(host.shadowRoot || host, host);
      }, hostId, fn.toString()),
      /** The consent box and the signature — what draft must never set — and whether the password is untouched. */
      guarded: () => page.evaluate(guardedInPage),
      /** Did `needle` (default: the fixture's password sentinel) reach the API, or chrome.storage? */
      async leaked(needle = null) {
        const n = needle || await page.evaluate(() => window.__wd?.passwordSentinel || null);
        if (!n) throw new Error('leaked(): no needle and the page has no password sentinel');
        const inRequests = api.requests.filter(r => JSON.stringify([r.path, r.query, r.body]).includes(n)).map(r => `${r.method} ${r.path}`);
        const storage = JSON.stringify([await h.storage.local(), await h.storage.session()]);
        return { inRequests, inStorage: storage.includes(n), leaked: inRequests.length > 0 || storage.includes(n) };
      },
      /** What the fake ATS recorded as submitted from this flow — must stay 0 (draft never submits). */
      submissions: () => ats.submissions('workday-shaped'),
      submitPressed: () => page.evaluate(() => (window.__wd ? window.__wd.submitPressed() : 0)),
      async screenshot(name) { const f = path.join(outDir, `${name.replace(/[^a-z0-9_-]+/gi, '_')}.png`); await page.screenshot({ path: f }); return f; },
      close: cleanup,
    };
    return h;
  } catch (e) {
    await cleanup();
    throw e;
  }
}
