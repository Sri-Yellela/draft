// extension/autoRead.js — ⭐ D97 · READ, PREPARE, CAPTURE AND FILL — AUTOMATICALLY, OPT-IN, SITE BY SITE.
//
// Owner, 10-13 (docs/EXTENSION_ONPAGE_SPEC.md D97, revised after docs/AUTO_READ_RISK_ANALYSIS.md): D23 stays the
// default — every read begins with a click or a keystroke — and the user chooses, SITE BY SITE, to let draft do four
// things for them, each its own switch, ALL DEFAULT OFF:
//
//   read     — the application form's question LABELS and counts, read in the page, kept on this computer (30 days)
//              for the read-quality line. ⛔ Nothing is sent: no URL, no label, no hash.
//   prepare  — build the answer packet for the tab's BOUND job (tabBinding.js) once the page is read. ⛔ Only on a
//              bound tab: the page's address goes to draft only when draft already knows which of YOUR jobs it is.
//   capture  — D64, extended: a page that IS a posting is sent to the user's own account, where the server keeps it if
//              it fits their board and DISCARDS it otherwise, storing nothing. ⛔ A page that is not a posting sends
//              nothing; ⛔ an application page (Workday's applyFlowPage) is never a posting and the extractor never runs
//              there (its generic fallback would read the chosen answers).
//   fill     — the same handoff Ctrl+Shift+Y runs, with `auto: true`: it fills and presses the portal's own Save and
//              Continue (owner 10-13), ⛔ never Submit, never past Review, ⛔ never a terms / consent / attestation /
//              signature control, ⛔ never the form-schema capture (captureFormSchema) — that is for other candidates.
//
// ⛔ Never on linkedin.com, indeed.com or glassdoor.com — not in the table, excluded from every registration, and
//   refused by autoStep whatever Chrome has granted.
// ⛔ A KILL SWITCH (Options → "Turn off everything") stops all four at once and gives every site's access back.
// ⛔ A FIRST-USE DISCLOSURE and an affirmative "I agree" come BEFORE any site can be switched on (Chrome Web Store
//   User Data policy: the prominent disclosure and consent live in the product's own UI).
//
// THE ONE SITE TABLE is SITES below: AUTO_CAPTURE_ORIGINS (autoCapture.js) and the manifest's
// optional_host_permissions are both derived from it (test/j5AutoRead.test.js pins the manifest to it).
//
// HOW IT RUNS: a site switched on (and granted by Chrome) gets ONE registered content script, autoReadWatcher.js
// (chrome.scripting.registerContentScripts, persisted across sessions) — a debounced watcher that reads no value and
// sends only "the step changed" with a signature. The service worker (handlers.AUTO_READ_PAGE) re-checks the switch
// and the permission on EVERY message, holds a per-tab lock, and runs the reads below with executeScript.
//
// This file has no top-level `chrome` use, so node tests import it directly. The injected functions are
// self-contained (executeScript serialises them alone).
import { runGatedHandoff, prepareAndFill, loadBatchForTab, loadPacketForTab } from './gated-handoff.js';
import { bindTab, bindingForTab } from './tabBinding.js';
import { extractJobPayload } from './extractor.js';
import { collectFormLabels } from './formReport.js';
import { renderBadge } from './autofill-badge.js';
import { C_LIGHT, C_DARK } from './tokens.js';
import { authedFetch } from './auth.js';
import { noteCapture } from './progress.js';

// ── THE SITE TABLE ────────────────────────────────────────────────────────────────────────────────────
// Order = the manifest's optional_host_permissions order (D64's five, then Workday's two — owner 10-13). The Options
// page lists Workday first (DISPLAY_ORDER).
export const SITES = Object.freeze([
  Object.freeze({ id: 'greenhouse', name: 'Greenhouse', origins: Object.freeze(['https://boards.greenhouse.io/*', 'https://job-boards.greenhouse.io/*']),
    hosts: Object.freeze([/^boards\.greenhouse\.io$/i, /^job-boards\.greenhouse\.io$/i]),
    postingShapes: Object.freeze([{ host: /^(?:boards|job-boards)\.greenhouse\.io$/i, path: /^\/[^/]+\/jobs\/\d+\/?$/ }]) }),
  Object.freeze({ id: 'lever', name: 'Lever', origins: Object.freeze(['https://jobs.lever.co/*']),
    hosts: Object.freeze([/^jobs\.lever\.co$/i]),
    postingShapes: Object.freeze([{ host: /^jobs\.lever\.co$/i, path: /^\/[^/]+\/[0-9a-f-]{36}\/?$/i }]) }),
  Object.freeze({ id: 'ashby', name: 'Ashby', origins: Object.freeze(['https://jobs.ashbyhq.com/*']),
    hosts: Object.freeze([/^jobs\.ashbyhq\.com$/i]),
    postingShapes: Object.freeze([{ host: /^jobs\.ashbyhq\.com$/i, path: /^\/[^/]+\/[0-9a-f-]{36}\/?$/i }]) }),
  Object.freeze({ id: 'workable', name: 'Workable', origins: Object.freeze(['https://apply.workable.com/*']),
    hosts: Object.freeze([/^apply\.workable\.com$/i]),
    postingShapes: Object.freeze([{ host: /^apply\.workable\.com$/i, path: /^\/[^/]+\/j\/[0-9A-F]+\/?$/i }]) }),
  // ⭐ D97, owner 10-13: Workday — both of its public hosts, every tenant. A Workday posting is recognised in the page
  // (JobPosting JSON-LD, no apply flow, no /apply in the path), never by a URL parser of the extension's own (one
  // parser, the server's — services/jobPageKey.js).
  Object.freeze({ id: 'workday', name: 'Workday', origins: Object.freeze(['https://*.myworkdayjobs.com/*', 'https://*.myworkdaysite.com/*']),
    hosts: Object.freeze([/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.myworkdayjobs\.com$/i, /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.myworkdaysite\.com$/i]),
    postingShapes: Object.freeze([]) }),
]);
export const DISPLAY_ORDER = Object.freeze(['workday', 'greenhouse', 'lever', 'ashby', 'workable']);
export const BEHAVIOURS = Object.freeze(['read', 'prepare', 'capture', 'fill']);

/** Every optional host permission the extension may ever ask for — the manifest's list, derived. */
export const OPTIONAL_ORIGINS = Object.freeze(SITES.flatMap(s => s.origins));

// ⛔ The sites draft never reads for jobs. Not in SITES; excluded from every registration; refused in autoStep.
export const NEVER_HOSTS = /(?:^|\.)(?:linkedin|indeed|glassdoor)\.[a-z.]+$/i;
export const NEVER_MATCHES = Object.freeze([
  'https://*.linkedin.com/*', 'https://*.indeed.com/*', 'https://*.glassdoor.com/*',
]);

// ⚠ PROVISIONAL — the owner decides (D97, not decided 10-13): a read is "good" when at least this share of the
// form's fields had a readable label; otherwise "partial read — check these".
export const GOOD_READ_RATIO = 0.8;
// Local read data: labels (never values) and counts, kept 30 days for the read-quality line (owner 10-13).
export const READ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const READ_LOG_LIMIT = 40;
export const READ_LABEL_LIMIT = 80;

export const WATCHER_FILE = 'autoReadWatcher.js';
export const WATCHER_ID_PREFIX = 'draft-auto-read-';
export const PAGE_MESSAGE = 'AUTO_READ_PAGE';

// ── THE STORED SETTINGS — one key, one write site ─────────────────────────────────────────────────────
//   autoRead → { v: 1, consent: { at, scope: 'all' | 'd64-capture' } | null, kill: boolean,
//                sites: { [siteId]: { read, prepare, capture, fill } },
//                reads: [{ site, host, step, at, total, recognised, labels }] }   ← labels only, never a value
// ⛔ Every write happens in the SERVICE WORKER, serialised (updateSettings) — the Options page asks it by message,
// so a switch turned off can never be overwritten by a read being logged at the same moment.
export const AUTO_READ_KEY = 'autoRead';
// The D64 key this replaces. Read once by migrateLegacy(), then removed; never written again.
export const LEGACY_CAPTURE_KEY = 'autoCaptureEnabled';

const bool = (v) => v === true;
const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

export function siteById(id) { return SITES.find(s => s.id === id) || null; }

/** The defaults: no consent, no site on, nothing read. */
export function defaultSettings() {
  return { v: 1, consent: null, kill: false, sites: Object.fromEntries(SITES.map(s => [s.id, offSite()])), reads: [] };
}
const offSite = () => Object.fromEntries(BEHAVIOURS.map(b => [b, false]));

/** ⛔ The whitelist — anything not named here (a value, the page's text, an address) is dropped. */
export function normaliseSettings(raw, now = Date.now()) {
  const out = defaultSettings();
  if (!raw || typeof raw !== 'object') return out;
  if (raw.consent && Number.isFinite(raw.consent.at)) {
    out.consent = { at: raw.consent.at, scope: raw.consent.scope === 'd64-capture' ? 'd64-capture' : 'all' };
  }
  out.kill = bool(raw.kill);
  for (const s of SITES) {
    const r = raw.sites?.[s.id] || {};
    out.sites[s.id] = Object.fromEntries(BEHAVIOURS.map(b => [b, bool(r[b])]));
  }
  out.reads = (Array.isArray(raw.reads) ? raw.reads : [])
    .filter(r => r && siteById(r.site) && Number.isFinite(r.at) && now - r.at < READ_RETENTION_MS)
    .map(r => ({
      site: r.site, host: str(r.host, 120), step: str(r.step, 80), at: r.at, total: num(r.total), recognised: num(r.recognised),
      labels: (Array.isArray(r.labels) ? r.labels : []).filter(l => typeof l === 'string').map(l => str(l, 120)).filter(Boolean).slice(0, READ_LABEL_LIMIT),
    }))
    .sort((a, b) => b.at - a.at).slice(0, READ_LOG_LIMIT);
  return out;
}

/** Does the user's consent cover this behaviour on this site? The D64 consent covered capture on D64's five only. */
export function consentCovers(settings, siteId, behaviour) {
  const c = settings?.consent;
  if (!c) return false;
  if (c.scope === 'all') return true;
  return c.scope === 'd64-capture' && behaviour === 'capture' && siteId !== 'workday';
}

/** Any behaviour on for this site (and allowed to be)? — whether its watcher is registered. */
export function siteActive(settings, siteId) {
  if (!settings || settings.kill) return false;
  const s = settings.sites?.[siteId];
  return !!s && BEHAVIOURS.some(b => s[b] && consentCovers(settings, siteId, b));
}

// ── URL helpers ───────────────────────────────────────────────────────────────────────────────────────
function parse(url) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u : null; } catch { return null; }
}

/** The table's site for this URL, or null (http, an unknown host, or a never-host). */
export function siteFor(url) {
  const u = parse(url);
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  if (NEVER_HOSTS.test(host)) return null;
  return SITES.find(s => s.hosts.some(h => h.test(host))) || null;
}

/** Does the URL itself say "this is one posting"? (D64's shapes — no page read needed.) */
export function hasPostingUrlShape(url) {
  const u = parse(url);
  if (!u) return false;
  return SITES.some(s => s.postingShapes.some(p => p.host.test(u.hostname) && p.path.test(u.pathname)));
}

/** A URL on an application STAGE (…/apply, …/apply/applyManually) — never a posting, whatever the page carries. */
export function isApplyStageUrl(url) {
  const u = parse(url);
  return !!u && /\/apply(?:\/|$)/i.test(u.pathname);
}

// ── THE DECISION — pure ───────────────────────────────────────────────────────────────────────────────
/**
 * What may run on this tab, now. Called twice per message: BEFORE anything is injected (facts null — may the page be
 * looked at at all?) and AFTER the local read of the page's facts (which of the four, exactly).
 *
 * @param {{ settings, url, granted: boolean, facts?: object|null, bound?: boolean, packet?: boolean,
 *           batch?: boolean, fillStopped?: boolean, lastFillSig?: string|null, signature?: string|null,
 *           prepared?: boolean }} a
 * @returns {{ skip?: string, site?: string, look?: boolean, actions?: string[] }}
 */
export function autoStep(a) {
  const { settings, url, granted } = a || {};
  if (!settings) return { skip: 'no_settings' };
  if (settings.kill) return { skip: 'kill_switch' };
  const u = parse(url);
  if (!u) return { skip: 'not_https' };
  if (NEVER_HOSTS.test(u.hostname)) return { skip: 'never_host' };
  const site = siteFor(url);
  if (!site) return { skip: 'not_a_listed_site' };
  if (!granted) return { skip: 'not_granted' };
  const sw = settings.sites?.[site.id] || {};
  const on = (b) => !!sw[b] && consentCovers(settings, site.id, b);
  if (!BEHAVIOURS.some(on)) return { skip: 'site_off' };
  const facts = a.facts;
  if (!facts) return { site: site.id, look: true };
  // ⛔ A sign-in or account page (a visible password box) — nothing is read, captured or filled there.
  if (facts.hasPassword) return { site: site.id, skip: 'sign_in_page', actions: [] };
  if (facts.origin && facts.origin !== u.origin) return { site: site.id, skip: 'page_moved', actions: [] };
  const actions = [];
  const isForm = num(facts.fieldCount) > 0;
  // CAPTURE — only a POSTING: never an application page, never an /apply stage.
  const maybePosting = !facts.isApplyFlow && !isApplyStageUrl(url) && (hasPostingUrlShape(url) || facts.jsonLdPosting === true);
  if (on('capture') && maybePosting) actions.push('capture');
  // READ — a form is on the page.
  if (on('read') && isForm) actions.push('read');
  // PREPARE — read on, a form, and the tab is BOUND to one of the user's own jobs. ⛔ Unbound: nothing is sent.
  if (on('read') && on('prepare') && isForm && a.bound && !a.prepared && !facts.isReview) actions.push('prepare');
  // FILL — read and prepare on (the fill uses what Prepare built), a form that is not Review, the tab bound (or holding
  // a released packet), no batch owning the tab (G5 refills a batched tab by itself on every load — two fills would
  // race), not stopped by the user, and a step not already filled.
  if (on('read') && on('prepare') && on('fill') && isForm && !facts.isReview && (a.bound || a.packet) && !a.batch && !a.fillStopped
      && (!a.signature || a.signature !== a.lastFillSig)) actions.push('fill');
  return { site: site.id, actions };
}

// ── READ QUALITY — local only ─────────────────────────────────────────────────────────────────────────
/** "14 of 18 fields recognised — good read" / "partial read — check these". Recognised = a readable label. */
export function readQuality({ total = 0, recognised = 0 } = {}) {
  const t = num(total), r = Math.min(num(recognised), t);
  if (!t) return { total: 0, recognised: 0, good: false, line: 'No form fields on this page' };
  const good = r / t >= GOOD_READ_RATIO;
  return { total: t, recognised: r, good, line: `${r} of ${t} fields recognised — ${good ? 'good read' : 'partial read — check these'}` };
}

/** The on-page badge's words: the read's line, and once answers are prepared the shortcut that fills them. */
export function readBadgeText(quality, { prepared = false, shortcut = 'Ctrl+Shift+Y' } = {}) {
  if (!quality?.total) return null;
  return prepared ? `${quality.recognised} of ${quality.total} ready — press ${shortcut || 'the draft fill shortcut'}` : quality.line;
}

// ── THE DISCLOSURE — written from what the code does (Options shows it before any switch can be turned on) ──
export const DISCLOSURE = Object.freeze({
  title: 'Before you switch anything on',
  intro: 'Everything here is off until you turn it on, one site at a time. Turning a site on asks Chrome for access to ' +
    'that site; turning it off — or pressing "Turn off everything" — gives the access back.',
  read: 'Read automatically — on the sites you choose, when an application page opens or changes step, draft reads the ' +
    "form's question labels and counts how many it recognises. It never reads what you have typed or chosen, and never " +
    'a password or payment field. Nothing is sent anywhere: the labels and counts stay on this computer for 30 days, ' +
    'so draft can tell you how well it read the page.',
  prepare: 'Prepare automatically — when the tab is already linked to one of your jobs (you captured it, or draft ' +
    "recognised it), draft prepares your answers for it on draft's server. That sends the page's address and the job " +
    'it is linked to — the same as pressing "Prepare this application". On a page draft cannot link to your own job, ' +
    'nothing is sent.',
  capture: 'Capture jobs automatically — a job posting you open on those sites is sent to your draft account (its ' +
    'address and the text of the posting). draft keeps it if it fits your board and discards it if it does not, ' +
    'without storing it. A page that is not a job posting — an application form included — sends nothing. ' +
    'It is never shared with other people.',
  fill: 'Fill automatically — when your answers are prepared, draft fills the form and may press the page\'s own ' +
    '"Save and Continue" between steps. It never submits, never goes past Review, and never ticks a box that agrees to ' +
    'terms, gives consent, or states or signs something on your behalf. You review every answer and submit yourself.',
  never: 'draft never does any of this on LinkedIn, Indeed or Glassdoor.',
  agree: 'I agree — let me choose sites',
});

// ── INJECTED: the page's facts. ISOLATED world, read-only, self-contained. ────────────────────────────
// Which step is showing, whether this is Workday's application, a sign-in page, the Review step — never a value.
export function pageFacts() {
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const step = String(
    document.querySelector('[data-automation-id="progressBarActiveStep"], [aria-current="step"]')?.textContent
    || document.querySelector('[data-automation-id="pageHeader"]')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const next = document.querySelector('[data-automation-id="bottom-navigation-next-button"], [data-automation-id="pageFooterNextButton"]');
  const nextText = String(next?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    origin: location.origin,
    step,
    isApplyFlow: !!document.querySelector('[data-automation-id="applyFlowPage"]'),
    hasPassword: [...document.querySelectorAll('input[type="password"]')].some(visible),
    isReview: /submit/i.test(nextText) || /^review$/i.test(step) || !!document.querySelector('[data-automation-id="reviewJobApplicationPage"]'),
  };
}

/**
 * INJECTED (self-contained): true when the page carries a schema.org JobPosting in JSON-LD. Reads only the page's own
 * script tags; sends nothing. (D64's check, moved here with the site table; autoCapture.js re-exports it.)
 */
export function pageHasJobPosting() {
  const isPosting = (n) => {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n)) return n.some(isPosting);
    const t = n['@type'];
    if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) return true;
    return isPosting(n['@graph']);
  };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { if (isPosting(JSON.parse(s.textContent || 'null'))) return true; } catch { /* not JSON */ }
  }
  return false;
}

/** One attempt per URL per service-worker life — the server brakes per day; this saves the round trip. */
export function createSeenSet(limit = 500) {
  const seen = new Set();
  return {
    has: (url) => seen.has(url),
    add: (url) => { seen.add(url); if (seen.size > limit) seen.delete(seen.values().next().value); },
  };
}

// ── STORAGE — the ONE write site, serialised ──────────────────────────────────────────────────────────
const writeStore = (settings) => chrome.storage.local.set({ [AUTO_READ_KEY]: settings });
let chain = Promise.resolve();

export async function loadSettings() {
  try { return normaliseSettings((await chrome.storage.local.get(AUTO_READ_KEY))?.[AUTO_READ_KEY]); }
  catch { return defaultSettings(); }
}

/** Read → change → write, one at a time. `fn` returns the new settings (or nothing to leave them). */
export function updateSettings(fn) {
  const run = chain.then(async () => {
    const cur = await loadSettings();
    const next = normaliseSettings((await fn(structuredClone(cur))) || cur);
    await writeStore(next);
    return next;
  });
  chain = run.catch(() => null);
  return run;
}

/**
 * D64 → D97: an automatic-capture switch that was ON becomes "Capture" on each D64 site Chrome still grants, under the
 * consent D64's own disclosure collected (scope 'd64-capture': capture only — anything more asks again). The old key
 * is then removed. Runs on install, update and startup; a second run finds nothing to do.
 */
export async function migrateLegacy() {
  let legacy;
  try { legacy = (await chrome.storage.local.get(LEGACY_CAPTURE_KEY))?.[LEGACY_CAPTURE_KEY]; } catch { return null; }
  if (legacy === undefined) return null;
  if (legacy === true) {
    const granted = {};
    for (const s of SITES.filter(x => x.id !== 'workday')) granted[s.id] = await hasGrant(s);
    await updateSettings((cur) => {
      if (!cur.consent) cur.consent = { at: Date.now(), scope: 'd64-capture' };
      for (const s of SITES) if (granted[s.id]) cur.sites[s.id].capture = true;
      return cur;
    });
  }
  try { await chrome.storage.local.remove(LEGACY_CAPTURE_KEY); } catch { /* storage gone */ }
  return { migrated: legacy === true };
}

async function hasGrant(site) {
  try { return await chrome.permissions.contains({ origins: [...site.origins] }); } catch { return false; }
}

// ── REGISTRATION — the watcher runs only where a site is on AND granted ───────────────────────────────
/** The registrations that should exist: one per active, granted site. */
export async function desiredRegistrations(settings) {
  const out = [];
  for (const s of SITES) {
    if (!siteActive(settings, s.id)) continue;
    if (!(await hasGrant(s))) continue;
    out.push({
      id: `${WATCHER_ID_PREFIX}${s.id}`, matches: [...s.origins], excludeMatches: [...NEVER_MATCHES],
      // a literal, so scripts/buildExtension.mjs bundles the file (it follows `js: ['…']` as it follows imports)
      js: ['autoReadWatcher.js'], runAt: 'document_idle', allFrames: false, persistAcrossSessions: true,
    });
  }
  return out;
}

/**
 * Make Chrome's registered watchers match the settings and the grants. Called on install / update / startup, on
 * permissions added or removed, and after every switch change. ⚠ Unregistering does not remove a watcher already
 * injected in an open tab — which is why AUTO_READ_PAGE re-checks the switch and the permission on every message.
 */
export async function syncRegistrations(settings = null) {
  const s = settings || await loadSettings();
  const want = await desiredRegistrations(s);
  let have = [];
  try { have = (await chrome.scripting.getRegisteredContentScripts()).filter(r => String(r.id).startsWith(WATCHER_ID_PREFIX)); }
  catch { have = []; }
  const wantIds = new Set(want.map(w => w.id));
  const drop = have.filter(h => !wantIds.has(h.id)).map(h => h.id);
  const add = want.filter(w => !have.some(h => h.id === w.id));
  if (drop.length) { try { await chrome.scripting.unregisterContentScripts({ ids: drop }); } catch { /* already gone */ } }
  if (add.length) { try { await chrome.scripting.registerContentScripts(add); } catch { /* reported by the next sync */ } }
  return { registered: want.map(w => w.id), added: add.map(a => a.id), removed: drop };
}

/** Chrome took a site's access away (chrome://extensions, or Options): its switches follow, so the two never disagree. */
export async function onPermissionsRemoved(removed) {
  const gone = new Set(removed?.origins || []);
  const hit = SITES.filter(s => s.origins.some(o => gone.has(o)));
  if (hit.length) await updateSettings((cur) => { for (const s of hit) cur.sites[s.id] = offSite(); return cur; });
  return syncRegistrations();
}

// ── THE SERVICE WORKER'S HANDLERS ─────────────────────────────────────────────────────────────────────
let SERVER_URL = null;
/** background.js names the server once (as configureAnswerMemory does). */
export function configureAutoRead({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

const fromExtensionPage = (sender) => !sender?.tab && typeof sender?.url === 'string'
  && sender.url.startsWith(chrome.runtime.getURL(''));

const TAB = new Map();          // tabId → { busy, pending, lastSig, lastFillSig, fillStopped, prepared: Set, preparedOk: Set }
const seenCaptures = createSeenSet();
const tabState = (id) => { if (!TAB.has(id)) TAB.set(id, { busy: false, pending: null, lastSig: null, lastFillSig: null, fillStopped: false, prepared: new Set(), preparedOk: new Set() }); return TAB.get(id); };
/** A closed tab forgets its lock (background.js tabs.onRemoved may call this; harmless if it does not). */
export function forgetTab(tabId) { TAB.delete(tabId); }

async function inject(tabId, func, args = []) {
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return r?.result;
}

async function fillShortcut() {
  try {
    const cmds = await chrome.commands.getAll();
    return cmds.find(c => c.name === 'fill-gated-application')?.shortcut || null;
  } catch { return null; }
}

async function showReadBadge(tabId, text) {
  if (!text) return null;
  try { return await inject(tabId, renderBadge, ['ready', { text, theme: { light: C_LIGHT, dark: C_DARK } }]); }
  catch { return null; }
}

/** The automatic capture of a posting — D64's path, now the only one. Returns what happened, for the tests and the log. */
async function autoCapture(tab, serverUrl) {
  const url = tab.url;
  if (seenCaptures.has(url)) return { sent: false, reason: 'seen' };
  const extracted = await inject(tab.id, extractJobPayload);
  if (!extracted?.ok) return { sent: false, reason: 'not_a_posting' };
  seenCaptures.add(url);
  const res = await authedFetch(serverUrl, '/api/import/auto', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    // The page's own address: the server canonicalises it (services/jobPageKey.js) before its per-job brake.
    body: JSON.stringify({ url: extracted.url || url, text: extracted.text }),
  });
  if (!res) return { sent: false, reason: 'not_signed_in' };
  const json = await res.json().catch(() => ({}));
  const jobId = json?.job?.id ?? json?.jobId ?? null;
  if (res.ok && !json.discarded && jobId != null) {
    await bindTab(tab, { jobId, title: extracted.title || null, company: extracted.company || null, via: 'capture' }).catch(() => null);
    await noteCapture({ success: true, jobId, link: null }, extracted);
  }
  return { sent: true, status: res.status, discarded: !!json.discarded, already: !!json.already, jobId };
}

/**
 * One pass over a tab, after the watcher said its step changed. Every check is re-made here, every time: the switch,
 * the consent, Chrome's grant, the kill switch — a watcher left in a tab after its site was switched off is ignored.
 */
export async function runAutoPass(tab, { signature = null, serverUrl = SERVER_URL } = {}) {
  const settings = await loadSettings();
  const site = siteFor(tab?.url);
  const granted = site ? await hasGrant(site) : false;
  const before = autoStep({ settings, url: tab?.url, granted });
  if (before.skip) return { skipped: before.skip, done: [] };

  const st = tabState(tab.id);
  let facts;
  try { facts = await inject(tab.id, pageFacts); } catch { return { skipped: 'no_access', done: [] }; }
  if (!facts) return { skipped: 'no_access', done: [] };

  // The form's labels and count are read only when they could be used, and only locally.
  let labels = null;
  if (!facts.hasPassword) {
    try { labels = await inject(tab.id, collectFormLabels); } catch { labels = null; }
  }
  facts.fieldCount = labels?.fieldCount ?? 0;
  // Capture may need the page's JSON-LD — read in the page, and only for a page that could be a posting at all.
  if (!facts.hasPassword && !facts.isApplyFlow && !isApplyStageUrl(tab.url) && settings.sites[site.id]?.capture && !hasPostingUrlShape(tab.url)) {
    try { facts.jsonLdPosting = (await inject(tab.id, pageHasJobPosting)) === true; } catch { facts.jsonLdPosting = false; }
  }

  const bound = await bindingForTab(tab).catch(() => null);
  const packet = await loadPacketForTab(tab.id).catch(() => null);
  const batch = await loadBatchForTab(tab.id).catch(() => null);
  const plan = autoStep({
    settings, url: tab.url, granted, facts, bound: !!bound, packet: !!packet, batch: !!batch,
    prepared: !!(bound && st.prepared.has(String(bound.jobId))), fillStopped: st.fillStopped,
    signature, lastFillSig: st.lastFillSig,
  });
  if (plan.skip) return { skipped: plan.skip, done: [] };
  const done = [];
  const out = { done, facts: { step: facts.step, isApplyFlow: facts.isApplyFlow, fieldCount: facts.fieldCount } };

  if (plan.actions.includes('capture') && serverUrl) {
    out.capture = await autoCapture(tab, serverUrl).catch(() => ({ sent: false, reason: 'error' }));
    done.push('capture');
  }
  let quality = null;
  if (plan.actions.includes('read')) {
    quality = readQuality({ total: labels?.fieldCount ?? 0, recognised: (labels?.labels || []).length });
    let host = '';
    try { host = new URL(tab.url).hostname.toLowerCase(); } catch { /* checked above */ }
    await updateSettings((cur) => {
      cur.reads.unshift({ site: site.id, host, step: facts.step, at: Date.now(), total: quality.total, recognised: quality.recognised,
        labels: (labels?.labels || []).slice(0, READ_LABEL_LIMIT) });
      return cur;
    });
    out.quality = quality;
    done.push('read');
  }
  let prepared = !!(bound && st.preparedOk.has(String(bound.jobId)));
  if (plan.actions.includes('prepare') && serverUrl) {
    const r = await prepareAndFill({ serverUrl, tab, fill: false }).catch(() => null);
    // Asked once per job per tab, whatever the answer — a page Prepare cannot serve is not asked again at every step.
    st.prepared.add(String(bound.jobId));
    if (r?.ok) { prepared = true; st.preparedOk.add(String(bound.jobId)); }
    out.prepare = r ? { ok: !!r.ok, reason: r.reason || null } : { ok: false };
    done.push('prepare');
  }
  if (plan.actions.includes('fill') && serverUrl && (prepared || packet)) {
    st.lastFillSig = signature;
    const r = await runGatedHandoff({ serverUrl, tab, auto: true }).catch(() => null);
    if (r?.reason === 'dismissed' || r?.wizard?.stoppedAt === 'dismissed') st.fillStopped = true;
    out.fill = r ? { ok: !!r.ok, reason: r.reason || null, stoppedAt: r.wizard?.stoppedAt || null } : { ok: false };
    done.push('fill');
  } else if (quality) {
    out.badge = await showReadBadge(tab.id, readBadgeText(quality, { prepared, shortcut: await fillShortcut() }));
  }
  return out;
}

/** The watcher's message: one pass per tab at a time; a step change during a pass runs ONE more pass after it. */
async function onPageMessage(msg, sender) {
  const tab = sender?.tab;
  if (!tab?.id || sender.frameId) return { ok: false, ignored: 'not_a_top_frame' };
  const st = tabState(tab.id);
  const signature = typeof msg?.signature === 'string' ? msg.signature.slice(0, 400) : null;
  if (st.busy) { st.pending = signature; return { ok: true, queued: true }; }
  st.busy = true;
  try {
    let result = await runAutoPass(tab, { signature });
    while (st.pending != null && st.pending !== signature) {
      const next = st.pending; st.pending = null;
      let fresh = tab;
      try { fresh = (await chrome.tabs.get(tab.id)) || tab; } catch { break; }
      result = await runAutoPass(fresh, { signature: next });
    }
    st.pending = null;
    return { ok: true, ...result };
  } finally { st.busy = false; }
}

/** What Options shows: the settings (reads included — labels only), and which sites Chrome currently grants. */
async function stateForOptions() {
  const settings = await loadSettings();
  const granted = {};
  for (const s of SITES) granted[s.id] = await hasGrant(s);
  return { ok: true, settings, granted };
}

export const handlers = Object.freeze({
  /** The watcher: "this tab's step changed". From a content script in a top frame only. */
  [PAGE_MESSAGE]: (msg, sender) => onPageMessage(msg, sender),

  // ⛔ Everything below changes or reads the switches — accepted ONLY from the extension's own pages (Options),
  // never from a content script or a page.
  AUTO_READ_STATE: async (_msg, sender) => (fromExtensionPage(sender) ? stateForOptions() : { ok: false, error: 'not_allowed' }),
  AUTO_READ_CONSENT: async (msg, sender) => {
    if (!fromExtensionPage(sender) || msg?.agree !== true) return { ok: false, error: 'not_allowed' };
    const settings = await updateSettings((cur) => { cur.consent = { at: Date.now(), scope: 'all' }; return cur; });
    return { ok: true, settings };
  },
  /** One switch. ON is accepted only with consent and Chrome's grant already in place (Options asked at the click). */
  AUTO_READ_SET: async (msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const site = siteById(msg?.site);
    if (!site || !BEHAVIOURS.includes(msg?.behaviour)) return { ok: false, error: 'bad_switch' };
    const on = msg.on === true;
    if (on) {
      const cur = await loadSettings();
      if (!consentCovers(cur, site.id, msg.behaviour)) return { ok: false, error: 'no_consent' };
      if (!(await hasGrant(site))) return { ok: false, error: 'not_granted' };
    }
    const settings = await updateSettings((cur) => {
      cur.sites[site.id][msg.behaviour] = on;
      if (on) cur.kill = false;
      return cur;
    });
    // ⛔ OFF: the last switch on a site gives its access back and removes its watcher.
    if (!on && !BEHAVIOURS.some(b => settings.sites[site.id][b])) {
      try { await chrome.permissions.remove({ origins: [...site.origins] }); } catch { /* already gone */ }
    }
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /** ⛔ THE KILL SWITCH — every behaviour off, every site's access given back, every watcher unregistered. */
  AUTO_READ_KILL: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const settings = await updateSettings((cur) => { for (const s of SITES) cur.sites[s.id] = offSite(); cur.kill = true; return cur; });
    try { await chrome.permissions.remove({ origins: [...OPTIONAL_ORIGINS] }); } catch { /* already gone */ }
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /** "Forget what was read" — the local labels and counts, gone. */
  AUTO_READ_FORGET: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const settings = await updateSettings((cur) => { cur.reads = []; return cur; });
    return { ok: true, settings };
  },
});

/** install / update / startup: carry D64's switch over once, then make the registrations match. */
export async function reconcileAutoRead() {
  await migrateLegacy().catch(() => null);
  return syncRegistrations();
}
