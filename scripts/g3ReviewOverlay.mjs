#!/usr/bin/env node
/**
 * TASK G3 — the provenance overlay, REAL-RUN verification.
 * ============================================================================================
 * The overlay's whole claim is that reviewing an application becomes ten seconds on three uncertain
 * fields instead of two minutes on thirty certain ones. That claim is about ORDER and about what
 * blocks "ready", so it can only be checked by rendering it over a real form and reading what a
 * candidate would actually see.
 *
 * Run against fakeAts's /gated/form — the page behind the sign-in wall, carrying the traps:
 *   - job_application[requires_sponsorship]   eligibility under an ATS's real namespacing
 *   - work_authorization                      eligibility, bare canonical name
 *   - org / "Current Company"                 fillable only by a LABEL match, i.e. a guess
 *   - authorized_no_sponsorship               the inversion trap: nothing may fill it
 *
 * Assertions:
 *   1. eligibility answers pin to the TOP, above lower-confidence non-eligibility ones
 *   2. a guess blocks "ready" until it is explicitly acknowledged
 *   3. acknowledging it unblocks, one field at a time
 *   4. an edit persists in the REAL input after the page re-reads it
 *   5. the inversion trap is never filled
 *   6. the overlay never submits, and nothing reaches the ATS
 *
 * Usage:  A1_RESUME=/path/to/any.pdf node scripts/g3ReviewOverlay.mjs
 *
 * AI2 — CHROME WEB STORE LISTING SCREENSHOTS
 * `npm run store:screenshots` runs this same harness with --screenshots and writes three
 * 1280x800, 24-bit, alpha-free PNGs to docs/store-screenshots/. Under that flag the whole run
 * happens on /gated/form?presentation=1 — the identical form with its didactic trap captions
 * removed — so the assertions below are made against the page that is photographed. The candidate
 * is the synthetic Ada Lovelace fixture, and every capture is checked against the developer's real
 * profile values before it is written.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import express from 'express';
import Database from 'better-sqlite3';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { resolveBrowserExecutable } from '../services/browserLauncher.js';
import applyRoutes from '../routes/apply.js';
import { createExtensionJobRouter } from '../routes/extensionJob.js';
import { MIGRATIONS } from './migrations.js';
import { buildGatePacket } from '../services/applyGatePacket.js';
import { toStorePng, readPngHeader } from '../services/pngTruecolor.js';
import { CANONICAL_ORIGIN } from '../shared/brand.js';

// extension/ is frozen for P4 (Web Store review), so its URL constant still names the LEGACY
// origin. This rewrite has to match what is actually in that file today, not where the app has
// moved to — deriving it from CANONICAL_ORIGIN is what makes P4 a one-line change instead of a
// hunt through eight harnesses.
const APP_URL_DECL = `const RESUME_MASTER_URL = '${CANONICAL_ORIGIN}';`;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(os.tmpdir(), 'g3-review-overlay');

// --screenshots also writes Chrome Web Store listing images (AF4 item 4).
//
// Captured HERE rather than in a script of their own, deliberately: the listing screenshot of the
// review overlay is a CLAIM about what the extension does, and this harness is the thing that proves
// the claim in the same breath. A screenshot taken by a separate script could be of an overlay that
// renders and does not work; one taken at this point in this run cannot be, because the assertions
// above and below it have to pass for the run to be green.
const SHOTS = process.argv.includes('--screenshots');
// STORE_SHOT_DIR (D23) sends a rehearsal run somewhere other than the committed set — e.g. a run on
// a machine without the owner's database, whose real-value check therefore has nothing to look for.
const SHOT_DIR = process.env.STORE_SHOT_DIR ? path.resolve(process.env.STORE_SHOT_DIR) : path.join(ROOT, 'docs', 'store-screenshots');
// The Chrome Web Store accepts 1280x800 or 640x400. 1280x800 for all three.
const SHOT_SIZE = { width: 1280, height: 800 };

// AI2. What a store screenshot must never contain, checked against the TEXT OF THE SURFACE at the
// moment it is captured rather than against the fixture's intent.
//
// - The owner's real details. The review overlay shows a home address, phone, email and
//   eligibility answers, and the fixture profile is synthetic (Ada Lovelace, example.com, a 555
//   number) — but "the fixture is synthetic" is a claim about the seed, not about the pixels. The
//   real values are read out of the developer's own database and looked for in what was rendered.
// - The trap captions. fakeAts names its traps in the markup on purpose; a reviewer seeing
//   "TRAP: sponsorship_inversion" reads a test rig. ?presentation=1 removes the captions and
//   nothing else, and this is the check that it worked.
const FORBIDDEN_IN_SHOTS = [/TRAP:/i, /sponsorship_inversion/i, /label-only match/i,
                            /required_unmapped/i, /name_ambiguity/i, /lowercase_yes/i, /G3-TRAPS/i,
                            // The fixture's other tell: /ashby-spa narrates its own mechanism
                            // ("Rendered by JavaScript 0ms after load ... transcribed from a live
                            // Ashby posting"), the right caption for a harness and a test rig to a
                            // reviewer.
                            /rendered by JavaScript/i, /as every real ATS does/i, /transcribed from/i,
                            // And a REAL EMPLOYER'S BRAND. /ashby-spa's shape was transcribed from
                            // a live posting, so the fixture inherited that company's name and role
                            // title. Putting another company in our own store listing is a
                            // different kind of wrong from an ugly caption, and worth its own line.
                            /\bOpenAI\b/, /Agent Productivity/i];
let REAL_VALUES = [];
function loadRealProfileValues() {
  // The developer's own database. Absent on a clean checkout, which is fine — but it must SAY so
  // rather than report a vacuous pass on an assertion whose whole job is to catch a real leak.
  const real = path.join(ROOT, 'data', 'resume_master.db');
  if (!fs.existsSync(real)) {
    console.log('  note  no data/resume_master.db — the "no real personal data" check has no values to look for');
    return [];
  }
  const rdb = new Database(real, { readonly: true, fileMustExist: true });
  try {
    const rows = rdb.prepare('SELECT full_name, first_name, last_name, email, phone, location FROM user_profile').all();
    const vals = new Set();
    for (const r of rows) for (const v of Object.values(r)) {
      const s = String(v ?? '').trim();
      // Short values ("MA", a blank) match everywhere and would fail every run on noise.
      if (s.length >= 5) vals.add(s);
    }
    return [...vals];
  } finally { rdb.close(); }
}

let shotCount = 0;
const shotReport = [];
/**
 * Capture, VALIDATE, then write — in that order.
 *
 * Nothing reaches disk until the image has been proved 1280x800 and alpha-free, because a silently
 * wrong file discovered by hand at the dashboard is the failure this exists to prevent. On any
 * failure it throws: the run dies, and the file that would have been wrong is simply not there.
 */
async function shoot(page, name, note) {
  if (!SHOTS) return;
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.setViewport({ ...SHOT_SIZE, deviceScaleFactor: 1 });
  await sleep(500);

  const text = await page.evaluate(() => document.body?.innerText || '');
  for (const re of FORBIDDEN_IN_SHOTS) {
    if (re.test(text)) throw new Error(`${name}: a trap caption is visible in the capture — ${re}`);
  }
  for (const v of REAL_VALUES) {
    if (text.includes(v)) throw new Error(`${name}: REAL personal data is visible in the capture — ${JSON.stringify(v)}`);
  }

  const raw = await page.screenshot({ clip: { x: 0, y: 0, ...SHOT_SIZE } });
  return writeShot(name, note, Buffer.from(raw));
}

/**
 * Validate an already-captured PNG buffer and write it. Split out of shoot() so any shot captured
 * another way goes through the SAME gate — a second write path is how one of the three ends up
 * unchecked. (Since T31 all three come through shoot(); the composited popup shot is retired.)
 */
function writeShot(name, note, buffer) {
  const file = path.join(SHOT_DIR, `${name}.png`);
  const { png, width, height, nonOpaque } = toStorePng(buffer);

  // Asserted on the ENCODED BYTES, not on what the capture was asked for. A viewport that did not
  // take, a device scale factor, a clip clamped by a shorter page — each produces a wrongly sized
  // image from a correct-looking request, and the header is the only thing that settles it.
  const h = readPngHeader(png);
  if (h.width !== SHOT_SIZE.width || h.height !== SHOT_SIZE.height) {
    throw new Error(`${name}: captured ${h.width}x${h.height}, the store needs ${SHOT_SIZE.width}x${SHOT_SIZE.height}`);
  }
  if (h.hasAlpha || h.colorType !== 2) throw new Error(`${name}: PNG colour type ${h.colorType} carries alpha`);
  if (h.bitDepth !== 8 || h.bitsPerPixel !== 24) throw new Error(`${name}: ${h.bitsPerPixel}-bit, the store needs 24-bit`);

  fs.mkdirSync(SHOT_DIR, { recursive: true });
  fs.writeFileSync(file, png);

  // Re-read from disk. Everything above validated a buffer; this validates the FILE, which is the
  // artefact that gets uploaded.
  const onDisk = readPngHeader(fs.readFileSync(file));
  if (onDisk.width !== width || onDisk.height !== height || onDisk.hasAlpha) {
    throw new Error(`${name}: the file on disk does not match what was validated`);
  }

  shotCount++;
  shotReport.push({ name, file: path.relative(ROOT, file).replace(/\\/g, '/'),
    width: onDisk.width, height: onDisk.height, colorType: onDisk.colorType,
    bits: onDisk.bitsPerPixel, bytes: png.length, nonOpaque, note });
  console.log(`  shot  ${path.relative(ROOT, file)} — ${width}x${height}, 24-bit, no alpha — ${note}`);
}
const ATS_PORT = Number(process.env.G3_ATS_PORT) || 4599;   // G3_ATS_PORT: a parallel session's port plan
const PORTAL = `http://localhost:${ATS_PORT}`;
const POSTING_ORIGIN = `http://127.0.0.1:${ATS_PORT}`;   // the same fakeAts, a different origin (see buildTestExtension)
// AI2. Under --screenshots the WHOLE run happens on the presentation variant of the form, not just
// the capture. Same fields, same names, same traps — only the didactic captions differ (see
// gatedForm() in fakeAts.js). Running the assertions on the page that gets photographed is what
// makes the screenshot evidence rather than decoration: the image cannot be of an overlay that
// renders and does not work, because the run is only green if it worked on this exact page.
const FORM_URL = `${PORTAL}/gated/form${SHOTS ? '?presentation=1' : ''}`;
const RESUME_PDF = process.env.A1_RESUME;
if (!RESUME_PDF || !fs.existsSync(RESUME_PDF)) {
  console.error('Set A1_RESUME to an existing PDF path.'); process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
const check = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`);
  if (!cond) failures++;
};

function startApi() {
  // The FULL schema (scripts/migrations.js), as the walks build it (test-support/extensionBrowser.mjs).
  // ⛔ It was a hand-built partial schema until 10-25, and it rotted silently: the routes moved on
  // (scraped_jobs.duplicate_of, the binding-first page lookup) and the harness stopped reaching the
  // overlay at all. The full schema cannot fall behind the routes it serves.
  const db = new Database(':memory:');
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec(`
    INSERT INTO users (id, username, password_hash, plan_tier) VALUES (1, 'ada', 'x', 'PRO');
    INSERT INTO user_profile (user_id) VALUES (1);
    INSERT INTO scraped_jobs (job_id, title, company, url, apply_url, source, search_query, _hash, discovered_at)
      VALUES ('g3job', 'Senior Engineer', 'GatedCo', '${PORTAL}/gated', '${PORTAL}/gated/form', 'ashby', 't', 'g3', unixepoch());
    INSERT INTO resumes (user_id, job_id, company, role, apply_mode, ats_score, html, updated_at)
      VALUES (1, 'g3job', 'GatedCo', 'Senior Engineer', 'TAILORED', 80, '<html><body>resume</body></html>', unixepoch());
    INSERT INTO apply_runs (id, user_id, mode, status, total_jobs) VALUES (1, 1, 'auto', 'completed', 1);
    INSERT INTO apply_run_jobs (id, run_id, user_id, job_id, status, reason_code, resume_artifact_id)
      VALUES (1, 1, 1, 'g3job', 'held_gate', 'login_required', 1);
  `);

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const o = req.headers.origin;
    if (o) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use((req, _res, next) => { req.user = { id: 1, planTier: 'PRO' }; next(); });
  // The popup's auth probe (via the service worker's PROBE_AUTH). Without it the probe fails closed
  // and the popup renders its SIGN-IN wall — which is the wrong fixture state for a harness whose
  // whole scenario is a candidate who has already signed in to reach a gated form, and which was
  // also giving the store screenshots a signed-out popup.
  // ⛔ `user: { username }`, NOT a bare `username`. The real route answers
  // `{ authenticated, user: publicUser(req.user) }`, and extension/auth.js reads
  // `body.user?.username`. A flat shape here type-checks, returns 200, and leaves the popup
  // rendering its "your account" fallback — which is a true rendering of a stub that lies, and was
  // being photographed into the store listing as if it were the product.
  app.get('/api/auth/me', (_req, res) =>
    res.json({ authenticated: true, user: { username: 'ada', isAdmin: false } }));
  // The extension's OWN credential. extension/auth.js routes EVERY call through authedFetch(),
  // which bootstraps from this endpoint and returns null when it cannot — so without this stub the
  // handoff dies at "Sign in to Draft first." before the overlay is ever rendered, and the store
  // screenshots photograph a signed-out popup over an unfilled form.
  //
  // ⛔ This is a stub of the EXCHANGE, not of the authorisation. The real route is behind
  // requireAuth and mints a sessionLess context; here every request is already `req.user` id 1, so
  // the token is a constant. What it preserves is the SHAPE the extension depends on — a JSON
  // `token`, then `X-RM-Auth-Context` on every subsequent call with `credentials: 'omit'` — which
  // is the property the harness is exercising. It was added when the handoff stopped working here
  // for a reason that had nothing to do with the handoff: auth.js landed after this harness last
  // ran, and a stub server that answers 404 is indistinguishable to the extension from a user who
  // has not signed in.
  app.get('/api/auth/extension-token', (_req, res) => res.json({ token: 'g3-harness-token' }));
  // ⭐ BINDING FIRST (10-15): every press identifies the page before anything is filled
  // (extension/identify.js → POST /api/extension/page); without an answer the handoff stops at
  // "draft couldn't be reached". The REAL route, mounted as the walks mount it: the gated form
  // resolves to g3job on the board, and the store shot's /posting to one draft does not hold.
  const identifyRoute = createExtensionJobRouter({ db, requireAuth: (q, r, n) => n(), isExtension: () => true,
    scoreFor: () => null, scoreText: () => null, hasBaseResume: () => false });
  app.use((req, res, next) => (req.method === 'POST' && req.path === '/api/extension/page' ? identifyRoute(req, res, next) : next()));
  applyRoutes(app, db, (q, r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }),
    async () => ({ error: 'not_needed' }), async () => fs.readFileSync(RESUME_PDF), async () => ({}));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ db, server }));
  });
}

function buildTestExtension(apiOrigin) {
  const src = path.join(ROOT, 'extension');
  const dst = path.join(OUT_DIR, 'extension');
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name === 'submission' || e.name === 'dist') continue;
      fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true });
    } else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
  for (const f of ['background.js', 'config.js']) {
    const p = path.join(dst, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
      .replace(APP_URL_DECL, `const RESUME_MASTER_URL = '${apiOrigin}';`));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dst, 'manifest.json'), 'utf8'));
  manifest.host_permissions = [...manifest.host_permissions, `${apiOrigin}/*`];
  // D23: the popup reads the page only when "Read this page" is pressed, and the read runs under the
  // activeTab grant a TOOLBAR click gives — which puppeteer cannot produce for a popup it navigates to.
  // So the TEST build may read the posting's origin, and that origin is deliberately not the form's:
  // the posting is served as 127.0.0.1, the gated form as localhost, so the fill run above still has
  // no standing access to the form it fills. The shipped manifest is untouched (d23ExtensionLook pins it).
  if (SHOTS) manifest.host_permissions.push(`${POSTING_ORIGIN}/*`);
  fs.writeFileSync(path.join(dst, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { dir: dst, manifest };
}

const PS_SEND_HOTKEY = String.raw`
param([int]$BrowserPid)
$ErrorActionPreference = 'Stop'
Add-Type -Namespace G3 -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool ShowWindow(System.IntPtr h, int n);
[DllImport("user32.dll")] public static extern void SwitchToThisWindow(System.IntPtr h, bool alt);
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, System.UIntPtr extra);
'@
function Resolve-Handle([int]$rootPid) {
  $p = Get-Process -Id $rootPid -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle -ne 0) { return $p.MainWindowHandle }
  $procs = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId
  $desc = New-Object System.Collections.Generic.HashSet[int]
  $frontier = New-Object System.Collections.Generic.List[int]
  [void]$frontier.Add($rootPid)
  while ($frontier.Count -gt 0) {
    $cur = $frontier[0]; $frontier.RemoveAt(0)
    foreach ($c in $procs) { if ($c.ParentProcessId -eq $cur -and $desc.Add([int]$c.ProcessId)) { [void]$frontier.Add([int]$c.ProcessId) } }
  }
  foreach ($d in $desc) {
    $cp = Get-Process -Id $d -ErrorAction SilentlyContinue
    if ($cp -and $cp.MainWindowHandle -ne 0) { return $cp.MainWindowHandle }
  }
  return [System.IntPtr]::Zero
}
$h = Resolve-Handle $BrowserPid
if ($h -eq [System.IntPtr]::Zero) { Write-Output 'NO_WINDOW'; exit 3 }
$KEYUP = 2
for ($a = 1; $a -le 3; $a++) {
  if ($a -eq 1) {
    [G3.Win]::keybd_event(0x12, 0, 0, [System.UIntPtr]::Zero)
    [G3.Win]::keybd_event(0x12, 0, $KEYUP, [System.UIntPtr]::Zero)
    [void][G3.Win]::SetForegroundWindow($h)
  } elseif ($a -eq 2) { [G3.Win]::SwitchToThisWindow($h, $true) }
  else {
    [void][G3.Win]::ShowWindow($h, 6); Start-Sleep -Milliseconds 250
    [void][G3.Win]::ShowWindow($h, 9); [void][G3.Win]::SetForegroundWindow($h)
  }
  Start-Sleep -Milliseconds 500
  if ([G3.Win]::GetForegroundWindow() -eq $h) { break }
}
if ([G3.Win]::GetForegroundWindow() -ne $h) { Write-Output 'NOT_FOREGROUND'; exit 4 }
[G3.Win]::keybd_event(0x11, 0, 0, [System.UIntPtr]::Zero)
[G3.Win]::keybd_event(0x10, 0, 0, [System.UIntPtr]::Zero)
Start-Sleep -Milliseconds 40
[G3.Win]::keybd_event(0x59, 0, 0, [System.UIntPtr]::Zero)
Start-Sleep -Milliseconds 40
[G3.Win]::keybd_event(0x59, 0, $KEYUP, [System.UIntPtr]::Zero)
[G3.Win]::keybd_event(0x10, 0, $KEYUP, [System.UIntPtr]::Zero)
[G3.Win]::keybd_event(0x11, 0, $KEYUP, [System.UIntPtr]::Zero)
Write-Output 'SENT'
`;

function sendHotkey(pid) {
  const script = path.join(OUT_DIR, 'sendHotkey.ps1');
  fs.writeFileSync(script, PS_SEND_HOTKEY);
  const r = spawnSync('powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-BrowserPid', String(pid)],
    { encoding: 'utf8', timeout: 30000 });
  return { ok: `${r.stdout || ''}`.includes('SENT'), out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== G3 — provenance overlay ===\n');

  const resolution = await resolveBrowserExecutable();
  if (!resolution) { console.error('No Chrome binary.'); process.exit(1); }

  if (SHOTS) {
    // Deterministic and re-runnable: the directory is emptied first, so a shot that fails to be
    // produced this run cannot be silently satisfied by last run's file. Combined with shoot()
    // writing nothing until it has validated, a failed run leaves an obviously incomplete
    // directory rather than a plausible and stale one.
    fs.rmSync(SHOT_DIR, { recursive: true, force: true });
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    REAL_VALUES = loadRealProfileValues();
    console.log(`  store screenshots -> ${path.relative(ROOT, SHOT_DIR)} ` +
      `(guarding ${REAL_VALUES.length} real profile value(s), ${FORBIDDEN_IN_SHOTS.length} trap captions)`);
  }

  const { db, server: apiServer } = await startApi();
  const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;

  let ats = null;
  const alive = await new Promise(res => {
    const rq = http.get(`${PORTAL}/gated/form`, r => { r.resume(); res(r.statusCode === 200); });
    rq.on('error', () => res(false)); rq.setTimeout(1500, () => { rq.destroy(); res(false); });
  });
  if (!alive) {
    ats = spawn(process.execPath, [path.join(ROOT, 'scripts', 'fakeAts.js')],
      { env: { ...process.env, PORT: String(ATS_PORT) }, stdio: 'ignore' });
    // Polled rather than slept. A fixed 1500ms was enough on a warm machine and not on a cold one,
    // and the failure it produced was an ECONNREFUSED from the next line up — a confusing way to
    // learn that the fixture had simply not finished booting.
    const deadline = Date.now() + 15000;
    let up = false;
    while (Date.now() < deadline && !up) {
      up = await fetch(`${PORTAL}/gated/form`).then(r => r.ok).catch(() => false);
      if (!up) await sleep(200);
    }
    if (!up) throw new Error(`fakeAts did not come up on ${PORTAL} within 15s`);
  }
  await fetch(`${PORTAL}/_reset`, { method: 'POST' }).catch(() => {});

  // The harness REUSES a fakeAts already listening on this port rather than starting its own. A
  // server started before ?presentation=1 existed answers that URL with the trap captions still in
  // it, and the run would go on to photograph them. So the fixture is asked what it actually
  // serves, and the run dies here if it is the wrong one — before a browser is launched.
  if (SHOTS) {
    const served = await fetch(FORM_URL).then(r => r.text());
    if (/TRAP:/.test(served)) {
      throw new Error(`the fakeAts on ${PORTAL} still serves trap captions at ?presentation=1 — it predates the ` +
        `presentation flag. Stop it and re-run so this harness starts a current one.`);
    }
    if (!/authorized_no_sponsorship/.test(served) || !/job_application\[requires_sponsorship\]/.test(served)) {
      throw new Error('the presentation form is missing the traps — the screenshot would not depict real behaviour');
    }
  }

  // A profile that answers the eligibility questions and the label-only one, so the overlay has
  // something in every band.
  const packet = buildGatePacket({
    autofillPayload: {
      field_map: {
        first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100',
        requires_sponsorship: 'No', work_authorization: 'Yes', current_company: 'Analytical Engines',
      },
      handler_map: {}, custom_answers: {},
    },
    applyUrl: FORM_URL, jobId: 'g3job', runId: 1, runJobId: 1, resumeArtifactId: 1,
    gateReason: 'login_required',
  });
  db.prepare(`INSERT INTO apply_gate_packets
    (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json,
     resume_artifact_id, token_hash, expires_at)
    VALUES (1,1,1,'g3job',?,?,'login_required',?,1,'unminted:seed',0)`)
    .run(FORM_URL, PORTAL, JSON.stringify(packet));

  const ext = buildTestExtension(apiOrigin);
  const profile = path.join(OUT_DIR, 'profile');
  fs.rmSync(profile, { recursive: true, force: true });

  const browser = await puppeteer.launch({
    executablePath: resolution.path, headless: false, pipe: true, enableExtensions: true,
    userDataDir: profile,
    args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,1000'],
    defaultViewport: null,
  });

  try {
    const extensionId = await browser.installExtension(ext.dir);
    const control = await browser.newPage();
    await control.goto(`chrome-extension://${extensionId}/options.html`);

    const page = (await browser.pages())[0];
    // D23: the extension follows the OS colour scheme, as the site's "system" preference does. The
    // listing images are the LIGHT palette whatever the machine running this prefers.
    const LIGHT = [{ name: 'prefers-color-scheme', value: 'light' }];
    if (SHOTS) for (const p of [page, control]) await p.emulateMediaFeatures(LIGHT);
    await page.goto(FORM_URL, { waitUntil: 'domcontentloaded' });
    await page.bringToFront();
    await sleep(400);

    const key = sendHotkey(browser.process().pid);
    if (!key.ok) console.log(`  hotkey failed (${key.out}) — press Ctrl+Shift+Y manually, 45s`);
    let result = null;
    const deadline = Date.now() + (key.ok ? 20000 : 45000);
    while (Date.now() < deadline && !result) {
      result = (await control.evaluate(() => chrome.storage.session.get('lastGatedHandoff')))?.lastGatedHandoff;
      if (!result) await sleep(400);
    }
    check('the handoff ran', result?.ok === true, result?.message || result?.reason || 'no result');
    check('the overlay rendered', result?.overlay?.rendered === true, JSON.stringify(result?.overlay));

    // The listing's most important image, captured BEFORE anything is acknowledged: the overlay is
    // showing the uncertain fields and the state is not-ready. That is the whole pitch to a store
    // reviewer — this extension fills a form and hands it back for review, it does not submit.
    if (SHOTS) {
      await page.bringToFront();
      await shoot(page, '1-review-overlay',
        'the review overlay over a real form, before anything is acknowledged');
    }

    // ── 1. order ───────────────────────────────────────────────────────────
    // ⭐ Since T21–T26 the review is the dock's Fill view: the panel lives in a shadow root (the
    // dock's), grouped Needs you · Check · Filled, and an eligibility answer draft could only GUESS is
    // never placed — it goes under Needs you. The harness reached into the old in-page overlay until
    // 10-25 and had been failing at this step since the dock replaced it.
    console.log('\n── order is the feature ──');
    const panel = () => page.evaluateHandle(() => {
      const find = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.id === 'rm-gate-review-overlay' && el.querySelector('.rm-hd')) return el;
          if (el.shadowRoot) { const f = find(el.shadowRoot); if (f) return f; }
        }
        return null;
      };
      return find(document);
    });
    const inPanel = async (fn, arg) => (await panel()).evaluate(fn, arg);
    // A TRUSTED click (CDP input), as the person's own — the panel ignores a page script's click.
    const press = async (selector) => {
      const h = await (await panel()).evaluateHandle((p, s) => p?.querySelector(s) || null, selector);
      const el = h.asElement();
      if (!el) return false;
      await el.click();
      await sleep(400);
      return true;
    };
    const sections = await inPanel(p => p ? [...p.querySelectorAll('.rm-sec')].map(sec => ({
      group: sec.dataset.group,
      open: sec.querySelector('[data-role="group"]')?.getAttribute('aria-expanded') === 'true',
      fields: [...sec.querySelectorAll('.rm-row [data-role="label"]')].map(f => f.textContent.trim()),
    })) : null);
    check('the review is on the page (the dock\'s Fill view)', !!sections, sections ? `${sections.length} groups` : 'absent');
    console.log(JSON.stringify(sections, null, 1));
    check('NEEDS YOU IS THE FIRST GROUP, above everything else', sections?.[0]?.group === 'need',
      sections?.map(s => s.group).join(' / '));
    check('the inverted eligibility question is under Needs you — draft does not guess it',
      (sections?.[0]?.fields || []).some(f => /authorized to work without sponsorship/i.test(f)),
      sections?.[0]?.fields.join(' | '));
    check('the certain fields are collapsed behind their group',
      sections?.some(s => s.group === 'ok' && s.open === false && s.fields.length >= 1),
      sections?.map(s => `${s.group}:${s.open ? 'open' : 'closed'}`).join(' / '));

    // ── 2 & 3. a question that needs you blocks ready until you answer it ──
    console.log('\n── readiness ──');
    const stateOf = () => inPanel(p => p?.querySelector('[data-role="state"]')?.textContent?.trim() || null);
    const before = await stateOf();
    check('a question that needs you blocks "ready"', /not ready/i.test(before || ''), before);
    check('the blocking count is reported', /\d+\s+needs?\s+you/i.test(before || ''), before);
    const needControls = await inPanel(p => p ? [...p.querySelectorAll('.rm-row[data-group="need"]')]
      .map(r => [...r.querySelectorAll('button[data-role]')].map(b => b.dataset.role)) : []);
    check('every row that needs you has its own controls', needControls.length >= 1 && needControls.every(c => c.length >= 1),
      JSON.stringify(needControls));
    // One row at a time, by the person — approving in bulk is exactly what the review replaces. The
    // trap is optional, so the person leaves it blank (and the checkbox stays untouched — 5. below).
    for (let i = 0; i < needControls.length; i++) {
      if (!(await press('.rm-row[data-group="need"] [data-role="leave"]'))) break;
    }
    const after = await stateOf();
    check('answering every question that needs you makes it ready', /^ready/i.test(after || ''), after);

    // ── 4. an edit reaches the real input ──────────────────────────────────
    console.log('\n── editing ──');
    await press('[data-role="group"][data-g="ok"][aria-expanded="false"]');
    const firstNameRow = await inPanel(p => {
      const rows = p ? [...p.querySelectorAll('.rm-row')] : [];
      return rows.find(r => /^first name/i.test(r.querySelector('[data-role="label"]')?.textContent || ''))?.dataset.idx ?? null;
    });
    const rowSel = `.rm-row[data-idx="${firstNameRow}"]`;
    await press(`${rowSel} [data-role="edit"]`);
    {
      const h = await (await panel()).evaluateHandle((p, s) => p?.querySelector(s) || null, `${rowSel} [data-role="editor"] [data-role="input"]`);
      const el = h.asElement();
      if (el) { await el.click({ count: 3 }); await el.type('Augusta'); }
    }
    await press(`${rowSel} [data-role="save"]`);
    await sleep(1200);
    const edited = await page.evaluate(() => {
      const el = document.querySelector('[name="first_name"]');
      // Read it the way the page's own code would, after prodding it to re-read.
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return el.value;
    });
    check('the edit reached the REAL input and survived a re-read', edited === 'Augusta', `value=${edited}`);

    // ── 5. the inversion trap ──────────────────────────────────────────────
    console.log('\n── the inversion trap ──');
    const trap = await page.evaluate(() => {
      const el = document.querySelector('[name="authorized_no_sponsorship"]');
      return { checked: el?.checked, exists: !!el };
    });
    check('the inverted checkbox was never touched', trap.exists && trap.checked === false,
      JSON.stringify(trap));
    const sponsorship = await page.evaluate(() =>
      document.querySelector('[name="job_application[requires_sponsorship]"]')?.value);
    check('the sponsorship question itself WAS answered, under its ATS namespacing',
      sponsorship === 'No', `value=${sponsorship}`);

    // ── 6. nothing was submitted ───────────────────────────────────────────
    console.log('\n── the overlay never submits ──');
    const subs = await fetch(`${PORTAL}/_submissions`).then(r => r.json());
    check('NOTHING reached the ATS', subs.count === 0, `count=${subs.count}`);

    // ── req 6. the review is on the audit row ──────────────────────────────
    console.log('\n── the audit record ──');
    await sleep(800);
    const row = db.prepare('SELECT gate_review_json FROM apply_run_jobs WHERE id=1').get();
    const review = row?.gate_review_json ? JSON.parse(row.gate_review_json) : null;
    check('the candidate\'s review is recorded against the application', !!review,
      review ? `ready=${review.ready} ack=${review.acknowledgedCount} edited=${review.editedCount}` : 'absent');
    check('it records that the review reached ready', review?.ready === true);
    check('it records that a field was corrected', (review?.editedCount || 0) >= 1);
    check('it does NOT store the corrected VALUE, only that it changed',
      !JSON.stringify(review || {}).includes('Augusta'),
      'the value goes to the employer either way; the audit question is what changed');

    // ── listing screenshots (AF4 item 4) ───────────────────────────────────
    // Taken last so nothing above is disturbed by a viewport change, and only after every
    // assertion has already run against this same extension build.
    if (SHOTS) {
      console.log('\n── store listing screenshots ──');
      // The dock, ON a posting. /posting is a job description page (a synthetic employer, published
      // as a JSON-LD JobPosting, as most boards publish one) — the press asks about a page the
      // capture's matcher reads as a posting, and /ashby-spa, an application form with no
      // description, is rightly asked nothing (fakeAts.js postingPage).
      //
      // T31 (10-25): the toolbar popup is retired — the toolbar icon toggles the dock on the page,
      // and the press asks "Add this job to draft?" on a posting draft does not hold. So the shot is
      // ONE real capture of the page, the dock and its question drawn by the extension itself;
      // nothing is composited. The press is sent as TOOLBAR_PRESS from the extension's own page —
      // the worker runs the same pressToolbar() the toolbar's onClicked does (walks/toolbarPress).
      const posting = await browser.newPage();
      await posting.emulateMediaFeatures(LIGHT);
      await posting.setViewport({ ...SHOT_SIZE, deviceScaleFactor: 1 });
      await posting.goto(`${POSTING_ORIGIN}/posting`, { waitUntil: 'domcontentloaded' });
      await sleep(800);
      await posting.bringToFront();
      await sleep(300);
      const press = await control.evaluate((m) => chrome.runtime.sendMessage(m), { type: 'TOOLBAR_PRESS' });
      if (press?.did !== 'opened') throw new Error(`2-dock: the toolbar press did not open the dock — ${JSON.stringify(press)}`);
      const shadowText = (id) => posting.evaluate((id) => {
        const host = document.getElementById(id);
        return host ? (host.shadowRoot || host).textContent || '' : null;
      }, id);
      let asked = null;
      for (let i = 0; i < 40 && !asked; i++) {
        await sleep(250);
        const t = await shadowText('draft-relay');
        if (t && /Add this job to draft\?/.test(t)) asked = t;
      }
      // The press only asks on a posting it resolved and draft does not hold. Anything else would be
      // a picture of a state the run did not reach.
      if (!asked) {
        const onPage = await posting.evaluate(() => [...document.querySelectorAll('[id^="draft"],[id^="rm-"]')]
          .map(e => `${e.id}: ${((e.shadowRoot || e).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120)}`));
        throw new Error(`2-dock: the press did not ask "Add this job to draft?" — the press answered ${JSON.stringify(press)}; on the page: ${JSON.stringify(onPage)}`);
      }
      const dockText = await shadowText('rm-draft-dock');
      if (dockText == null) throw new Error('2-dock: the dock is not on the page');
      // shoot() reads body.innerText, which does not reach into a shadow root — so the dock's and
      // the question's own text are checked here.
      for (const v of REAL_VALUES) {
        if (`${dockText}\n${asked}`.includes(v)) throw new Error(`2-dock: REAL personal data in the dock — ${JSON.stringify(v)}`);
      }
      await sleep(600);
      await shoot(posting, '2-dock', 'the dock the toolbar press opened, asking about the posting it resolved');

      // BOTH shortcuts, with real keys in them (AI2 shot 3). options.js builds these rows from
      // chrome.commands.getAll(), and a command Chrome declined to bind renders as "Not set" —
      // which is a true rendering of a real state and a bad listing image, so it fails the run
      // rather than shipping. Read out of the DOM, so the assertion is about what the picture
      // shows and not about what the manifest declares.
      await control.bringToFront();
      await sleep(400);
      const shortcuts = await control.evaluate(() =>
        [...document.querySelectorAll('.shortcut-row')].map(r => ({
          label: r.querySelector('label')?.textContent?.trim() || '',
          key: r.querySelector('input')?.value?.trim() || '',
        })));
      check('the options page lists both shortcuts', shortcuts.length === 2,
        shortcuts.map(s => `${s.label}=${s.key}`).join(' | '));
      check('both shortcuts show a real key, not "Not set"',
        shortcuts.length === 2 && shortcuts.every(s => s.key && !/not set/i.test(s.key)),
        shortcuts.map(s => s.key).join(' | '));
      check('and they came from chrome.commands.getAll(), not a hand-kept list',
        /chrome\.commands\.getAll\(\)/.test(fs.readFileSync(path.join(ROOT, 'extension', 'options.js'), 'utf8')));

      await shoot(control, '3-options', 'the options page — both shortcuts, and who submits');

      // The store wants exactly three, and a run that produced two is a run that failed. Asserted
      // rather than left to whoever opens the directory.
      check('all three store screenshots were produced', shotCount === 3, `${shotCount} of 3`);
      const onDisk = fs.readdirSync(SHOT_DIR).filter(f => f.endsWith('.png')).sort();
      check('the directory holds exactly the three, and nothing stale',
        onDisk.length === 3 && onDisk.join(',') === '1-review-overlay.png,2-dock.png,3-options.png',
        onDisk.join(', '));
      console.log('');
      for (const s of shotReport) {
        console.log(`  ${s.file}  ${s.width}x${s.height}  colour type ${s.colorType} (24-bit truecolour, no alpha)  ` +
          `${s.bytes} bytes  ${s.nonOpaque} non-opaque source pixels flattened`);
      }
    }

  } finally {
    await browser.close().catch(() => {});
    apiServer.close();
    db.close();
    if (ats) ats.kill();
  }

  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('\nHARNESS FAILED:', e); process.exit(1); });
