// ⭐ A232 R5 (46y, owner 11-19 "all four approved") · THE WALKS' API, on its own — moved out of extensionBrowser.mjs
// (which re-exports it, so every walk is unchanged). A test that needs only the API (no Chrome) imports it from here and
// so stays in the fast tier: the tier rule (test-support/testTiers.mjs) calls a file "browser" when it imports
// extensionBrowser.mjs, and this module launches nothing.

// ── the API: the REAL routes on the FULL schema, one SYNTHETIC user ─────────────────────────────────────────────────
export const DEFAULT_PAYLOAD = {
  field_map: { first_name: 'Ada', last_name: 'Example', email: 'ada@example.test' }, handler_map: {},
  custom_answers: { 'Why do you want to work at Zoom?': 'Video for everyone.' },
};
/** The walk's seed (f72be86): Ada, a profile, and the board's Zoom copy from ANOTHER ATS — the owner's case. */
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
