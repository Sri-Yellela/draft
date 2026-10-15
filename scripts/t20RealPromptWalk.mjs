#!/usr/bin/env node
// ⭐ T20 · P0 — THE REAL PERMISSION FLOW, CHROME'S OWN PROMPT ANSWERED. Windows only; opens a VISIBLE Chrome window.
//
//   node scripts/t20RealPromptWalk.mjs [card|always|deny]      (T20_ANSWER_DELAY_MS=45000 answers the prompt slowly)
//
// Every other real-Chrome walk stands a grant in with the test build's host_permissions, because a headless Chrome
// cannot answer Chrome's permission prompt — and that stand-in HID the defect: with the hosts pre-granted, the request
// resolves with no prompt, the popup lives, and its consent message is sent. With the REAL prompt, the popup closes the
// moment the prompt opens (measured 10-15), so nothing after `await chrome.permissions.request(...)` in the popup ran.
//
// This walk launches a HEADED Chrome with the test build (NO hosts pre-granted — `always` pre-grants only the careers
// origin, standing in for the toolbar click's activeTab, since chrome.action.openPopup() from a script grants none),
// opens an application page, opens the real popup, clicks, and then presses Chrome's own "Allow" (or "Deny") through
// Windows UI Automation — ONLY in a window whose title starts with this walk's marker, never another Chrome window.
// It prints, step by step: did the popup survive the prompt; did the click reach the worker; what Chrome granted; the
// consent; the registrations; whether the tab ALREADY OPEN was read with no reload; the dock's state; a reload's read.
// Synthetic companies only; the HTTPS fixture is local (a throwaway openssl certificate). Not part of `npm test`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync, spawn } from 'node:child_process';
import { launchExtensionBrowser, waitUntil, sleep } from '../test-support/extensionBrowser.mjs';

const MODE = process.argv[2] || 'card';
if (!['card', 'always', 'deny'].includes(MODE)) { console.error('usage: t20RealPromptWalk.mjs [card|always|deny]'); process.exit(2); }
if (process.platform !== 'win32') { console.log('SKIP — the prompt is answered through Windows UI Automation'); process.exit(0); }

const MARK = 'T20WALK';
const CAREERS = 'careers.acme.test', GH_HOST = 'job-boards.greenhouse.io';
const GH_APPLY = `https://${GH_HOST}/acme/jobs/8198280`;
const CAREERS_APPLY = `https://${CAREERS}/jobs/search?gh_jid=8198280`;
const FRAME = `https://${GH_HOST}/embed/job_app?for=acme&token=8198280`;
const FORM = `<form id="application_form"><label for="first_name">First Name *</label><input id="first_name" type="text">
<label for="last_name">Last Name *</label><input id="last_name" type="text"><label for="email">Email *</label><input id="email" type="email">
<label for="phone">Phone</label><input id="phone" type="tel"></form>`;
const page = (t, b) => `<!doctype html><html><head><meta charset="utf-8"><title>${MARK} ${t}</title></head><body>${b}</body></html>`;

// Find a button by its name in a Chrome window whose title starts with MARK, and invoke it.
const UIA = `param([string]$Name, [string]$Window, [int]$TimeoutSec = 20)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$A = [System.Windows.Automation.AutomationElement]
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  $wins = $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, (New-Object System.Windows.Automation.PropertyCondition($A::ClassNameProperty, 'Chrome_WidgetWin_1')))
  foreach ($w in $wins) {
    if (-not $w.Current.Name.StartsWith($Window)) { continue }
    $btns = $w.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)))
    foreach ($b in $btns) { if ($b.Current.Name -eq $Name) { $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); Write-Output "INVOKED $Name"; exit 0 } }
  }
  Start-Sleep -Milliseconds 300
}
Write-Output "NOT FOUND: $Name"; exit 1
`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't20-walk-'));
const uiaFile = path.join(dir, 'uia.ps1');
fs.writeFileSync(uiaFile, UIA);
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k'), '-out', path.join(dir, 'c'), '-days', '1',
  '-subj', '/CN=t20-walk', '-addext', `subjectAltName=DNS:${CAREERS},DNS:${GH_HOST}`], { stdio: 'ignore' });
const server = https.createServer({ key: fs.readFileSync(path.join(dir, 'k')), cert: fs.readFileSync(path.join(dir, 'c')) }, (req, res) => {
  const host = String(req.headers.host || '').split(':')[0];
  const html = (b) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(b); };
  if (host === GH_HOST && req.url.startsWith('/embed/job_app')) return html(page('Apply', FORM));
  if (host === GH_HOST) return html(page('Software Engineer', `<h1>Software Engineer</h1>${FORM}`));
  if (host === CAREERS) return html(page('Careers', `<h1>Software Engineer</h1><iframe src="${FRAME}" width="100%" height="600"></iframe>`));
  res.writeHead(404); res.end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const say = (k, v) => console.log(`${k.padEnd(34)} ${JSON.stringify(v)}`);
const press = (name) => new Promise((resolve) => {
  const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', uiaFile, '-Name', name, '-Window', MARK]);
  let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
  p.on('close', (code) => resolve({ code, out: out.trim() }));
});
const h = await launchExtensionBrowser({ headless: false, insecureCerts: true, hosts: MODE === 'always' ? [`https://${CAREERS}/*`] : [],
  resolverRules: [`MAP ${CAREERS} 127.0.0.1:${port}`, `MAP ${GH_HOST} 127.0.0.1:${port}`] });
const settings = async () => (await h.storage.local()).autoRead || {};
let code = 0;
try {
  const target = MODE === 'always' ? CAREERS_APPLY : GH_APPLY;
  const host = new URL(target).hostname;
  await h.open(target, { settle: 1500 });
  say('granted before', (await h.control.evaluate(() => chrome.permissions.getAll())).origins);
  await h.control.evaluate(() => chrome.action.openPopup());
  const t = await h.browser.waitForTarget(x => x.url().endsWith('/popup.html'), { timeout: 8000 });
  const popup = await t.asPage();
  let closed = false;
  h.browser.on('targetdestroyed', (x) => { if (x === t) closed = true; });
  await popup.waitForSelector(MODE === 'always' ? '#auto-here:not([hidden])' : '#auto-card:not([hidden])', { timeout: 10000 });
  await popup.click(MODE === 'always' ? '#auto-here-box' : '#auto-allow');
  await sleep(1500);
  say('popup closed at the prompt', closed);
  say('the click reached the worker', (await h.send({ type: 'AUTO_READ_STATE' }))?.pending || null);
  // T20_ANSWER_DELAY_MS: answer slowly — past the ~30 s after which Chrome stops an idle service worker
  const delay = Number(process.env.T20_ANSWER_DELAY_MS || 0);
  if (delay) { say('waiting before answering (ms)', delay); await sleep(delay); }
  say(`pressed Chrome's ${MODE === 'deny' ? 'Deny' : 'Allow'}`, (await press(MODE === 'deny' ? 'Deny' : 'Allow')).out);
  await sleep(2500);
  say('granted after', (await h.control.evaluate(() => chrome.permissions.getAll())).origins);
  const s = await settings();
  say('consent (card)', s.consent2 || null);
  say('custom sites', Object.keys(s.custom || {}));
  say('registrations', (await h.control.evaluate(() => chrome.scripting.getRegisteredContentScripts())).map(r => r.id));
  const read = await waitUntil(async () => ((await settings()).reads || []).find(r => r.host === host) || null, 15000);
  say('OPEN tab read, no reload', read ? { total: read.total, recognised: read.recognised } : null);
  say('dock', await h.page.evaluate(() => { const d = document.getElementById('rm-draft-dock'); return d ? { collapsed: d.dataset.collapsed === 'true' } : null; }));
  const count = async () => ((await settings()).reads || []).filter(r => r.host === host).length;
  const before = await count();
  await h.reload({ settle: 300 });
  await waitUntil(async () => (await count()) > before, MODE === 'deny' ? 5000 : 15000);
  say('reads before / after a reload', [before, await count()]);
  const expectRead = MODE !== 'deny';
  if (!!read !== expectRead) { code = 1; console.log(`FAIL — the open tab was ${read ? '' : 'NOT '}read after ${MODE}`); }
  else console.log(`PASS — ${MODE}: the open tab was ${read ? 'read with no press' : 'not read (refused)'}`);
} catch (e) { code = 1; console.log('FAIL', e?.stack || e); }
finally { await h.close(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
process.exit(code);
