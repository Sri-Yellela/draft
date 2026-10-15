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
// ⭐ D97 REVISED + T12 (owner 10-14 / 10-15): READ and PREPARE become the default AFTER ONE CONSENT — the popup's
//   one-time card asks Chrome for every preset site in ONE prompt (consent2); Capture and Fill stay separate, off.
//   "Always read here" (popup) adds ONE company careers origin at a time from a click — `custom`, under the manifest's
//   OPTIONAL https://*/* (never requested itself, never at install) — with the ATS frame site allowed there.
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
import { runGatedHandoff, prepareAndFill, loadBatchForTab, loadPacketForTab, atsFramesOf } from './gated-handoff.js';
import { bindTab, bindingForTab } from './tabBinding.js';
import { extractJobPayload } from './extractor.js';
import { collectFormLabels } from './formReport.js';
import { renderBadge } from './autofill-badge.js';
import { drawInDock, dockMeta, overlayTheme } from './dockHost.js';
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
  // ⭐ D97 REVISED, owner 10-15 (decision 2): SmartRecruiters' public job host joins the preset set.
  // A posting is /<Company>/<numeric id>-<slug>.
  Object.freeze({ id: 'smartrecruiters', name: 'SmartRecruiters', origins: Object.freeze(['https://jobs.smartrecruiters.com/*']),
    hosts: Object.freeze([/^jobs\.smartrecruiters\.com$/i]),
    postingShapes: Object.freeze([{ host: /^jobs\.smartrecruiters\.com$/i, path: /^\/[^/]+\/\d{6,}(?:-[^/]*)?\/?$/ }]) }),
]);
export const DISPLAY_ORDER = Object.freeze(['workday', 'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters']);
export const BEHAVIOURS = Object.freeze(['read', 'prepare', 'capture', 'fill']);

/** Every PRESET optional host permission — the sites the one-time consent asks Chrome for, in one prompt. */
export const OPTIONAL_ORIGINS = Object.freeze(SITES.flatMap(s => s.origins));

// ⭐ T12 · "ALWAYS READ HERE" (owner 10-15, decision 1). Company careers sites live on arbitrary domains (stripe.com…),
// and Chrome can only REQUEST an origin the manifest lists as optional — so the OPTIONAL list ends with the broad https
// pattern. ⛔ Nothing is granted at install, and the pattern itself is never requested: each request names ONE origin
// (plus the ATS frame it embeds), from the user's click in the popup. ⛔ Never in host_permissions.
export const ANY_SITE_PATTERN = 'https://*/*';
/** The manifest's optional_host_permissions, exactly: the preset sites, then the pattern T12's per-origin requests fall under. */
export const MANIFEST_OPTIONAL_HOSTS = Object.freeze([...OPTIONAL_ORIGINS, ANY_SITE_PATTERN]);
/** At most this many "Always read here" sites (each is its own registration). */
export const CUSTOM_LIMIT = 50;

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
//   autoRead → { v: 2, consent: { at, scope: 'all' | 'd64-capture' } | null, kill: boolean,
//                consent2: { at } | null,     ← ⭐ D97 REVISED: the popup's one-time card ("Allow on these sites")
//                later: ms | null,            ← the card's "Not now" (it comes back after LATER_MS)
//                sites: { [siteId]: { read, prepare, capture, fill } },
//                custom: { [origin]: { read, prepare, capture, fill, frames: [siteId], at } },   ← ⭐ T12
//                frameHints: { [origin]: siteId },   ← T12: the ATS frame a site was found to embed (≤ CUSTOM_LIMIT)
//                reads: [{ site, host, step, at, total, recognised, labels }] }   ← labels only, never a value
// ⛔ v1 → v2 adds keys and changes no value: an install that had agreed in Options keeps exactly the switches it had,
// and still sees the popup's card — consent2 is never inferred (no silent widening).
// ⛔ Every write happens in the SERVICE WORKER, serialised (updateSettings) — the Options page asks it by message,
// so a switch turned off can never be overwritten by a read being logged at the same moment.
export const AUTO_READ_KEY = 'autoRead';
// The D64 key this replaces. Read once by migrateLegacy(), then removed; never written again.
export const LEGACY_CAPTURE_KEY = 'autoCaptureEnabled';

const bool = (v) => v === true;
const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);

export function siteById(id) { return SITES.find(s => s.id === id) || null; }

/** The card's "Not now" holds for two weeks; then the popup asks once more. */
export const LATER_MS = 14 * 24 * 60 * 60 * 1000;

/** The defaults: no consent, no site on, nothing read. */
export function defaultSettings() {
  return { v: 2, consent: null, consent2: null, later: null, kill: false,
    sites: Object.fromEntries(SITES.map(s => [s.id, offSite()])), custom: {}, frameHints: {}, reads: [] };
}
const offSite = () => Object.fromEntries(BEHAVIOURS.map(b => [b, false]));

/** ⛔ The whitelist — anything not named here (a value, the page's text, an address) is dropped. */
export function normaliseSettings(raw, now = Date.now()) {
  const out = defaultSettings();
  if (!raw || typeof raw !== 'object') return out;
  if (raw.consent && Number.isFinite(raw.consent.at)) {
    out.consent = { at: raw.consent.at, scope: raw.consent.scope === 'd64-capture' ? 'd64-capture' : 'all' };
  }
  if (raw.consent2 && Number.isFinite(raw.consent2.at)) out.consent2 = { at: raw.consent2.at };
  if (Number.isFinite(raw.later)) out.later = raw.later;
  out.kill = bool(raw.kill);
  for (const s of SITES) {
    const r = raw.sites?.[s.id] || {};
    out.sites[s.id] = Object.fromEntries(BEHAVIOURS.map(b => [b, bool(r[b])]));
  }
  // ⭐ T12: a custom site is kept only when its key IS an origin "Always read here" may be offered for.
  for (const [origin, e] of Object.entries(raw.custom && typeof raw.custom === 'object' ? raw.custom : {}).slice(0, CUSTOM_LIMIT)) {
    if (!e || typeof e !== 'object' || customOriginFor(`${origin}/`) !== origin) continue;
    out.custom[origin] = {
      ...Object.fromEntries(BEHAVIOURS.map(b => [b, bool(e[b])])),
      frames: [...new Set((Array.isArray(e.frames) ? e.frames : []).filter(id => siteById(id)))],
      at: Number.isFinite(e.at) ? e.at : now,
    };
  }
  const hints = Object.entries(raw.frameHints && typeof raw.frameHints === 'object' ? raw.frameHints : {})
    .filter(([o, id]) => customOriginFor(`${o}/`) === o && siteById(id));
  out.frameHints = Object.fromEntries(hints.slice(-CUSTOM_LIMIT));
  out.reads = (Array.isArray(raw.reads) ? raw.reads : [])
    .filter(r => r && (siteById(r.site) || r.site === 'custom') && Number.isFinite(r.at) && now - r.at < READ_RETENTION_MS)
    .map(r => ({
      site: r.site, host: str(r.host, 120), step: str(r.step, 80), at: r.at, total: num(r.total), recognised: num(r.recognised),
      labels: (Array.isArray(r.labels) ? r.labels : []).filter(l => typeof l === 'string').map(l => str(l, 120)).filter(Boolean).slice(0, READ_LABEL_LIMIT),
    }))
    .sort((a, b) => b.at - a.at).slice(0, READ_LOG_LIMIT);
  return out;
}

/** Does the user's consent cover this behaviour on this site? The D64 consent covered capture on D64's five only. */
export function consentCovers(settings, siteId, behaviour) {
  // ⭐ D97 REVISED: the popup's one-time card is consent for the preset set (it turns on Read + Prepare; Capture and
  // Fill stay their own switches, off until the user turns them on in Options).
  if (settings?.consent2) return true;
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

/** ⭐ T12: a custom site with any switch on. Its entry exists only because the user pressed "Always read here". */
export function customActive(settings, origin) {
  if (!settings || settings.kill) return false;
  const e = settings.custom?.[origin];
  return !!e && BEHAVIOURS.some(b => e[b]);
}

/** Is a preset site still wanted by anything — its own switches, or a custom site that embeds its form? */
function siteNeeded(settings, siteId) {
  return siteActive(settings, siteId)
    || Object.keys(settings.custom || {}).some(o => customActive(settings, o) && settings.custom[o].frames.includes(siteId));
}

// ── URL helpers ───────────────────────────────────────────────────────────────────────────────────────
function parse(url) {
  try { const u = new URL(url); return u.protocol === 'https:' ? u : null; } catch { return null; }
}

// draft's own site is never a "job site" of the user's.
const OWN_HOSTS = /(?:^|\.)jobsviadraft\.com$/i;

/**
 * ⭐ T12: the origin "Always read here" may be offered for — https, a named host on the default port, not a preset
 * site (those are the card's), not draft's own, and ⛔ never LinkedIn / Indeed / Glassdoor. Else null.
 */
export function customOriginFor(url) {
  const u = parse(url);
  if (!u || u.port || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) || /^\d+(?:\.\d+){3}$/.test(host)) return null;
  if (NEVER_HOSTS.test(host) || OWN_HOSTS.test(host) || siteFor(url)) return null;
  return `https://${host}`;
}
/** The one-origin pattern a T12 request names. */
export const originPattern = (origin) => `${origin}/*`;

/**
 * Does the ADDRESS look like a job or an application? Local only — the popup offers "Always read here" from this and
 * the tab's own binding, never from a read of the page (D23).
 */
const JOB_WORDS = /(?:^|[/._-])(?:jobs?|careers?|positions?|openings?|vacanc(?:y|ies)|apply|applications?|requisitions?|opportunit(?:y|ies)|join-us|work-with-us|hiring)(?=[/._?=#-]|$)/i;
const JOB_PARAMS = /[?&](?:gh_jid|ashby_jid|lever-origin|jobid|job_id|jid|req(?:uisition)?_?id)=/i;
export function looksLikeJobPage(url) {
  const u = parse(url);
  if (!u) return false;
  return JOB_WORDS.test(u.pathname) || JOB_PARAMS.test(u.search) || /^(?:jobs?|careers?)\./i.test(u.hostname);
}

/**
 * ⭐ T12 (owner 10-15, decision 3): the ATS frame a page embeds, from LOCAL knowledge only — the tab's bound job
 * (`greenhouse::<id>` names its family), the frame site the last press or pass found here (noteFrameSite), and URL
 * hints (`gh_jid=` → Greenhouse, `ashby_jid=` → Ashby). ⛔ No frame is read for this: when nothing is known, the first
 * grant covers the page and a SECOND click asks for the frame once a pass has seen it.
 */
export const URL_FRAME_HINTS = Object.freeze([Object.freeze({ param: 'gh_jid', site: 'greenhouse' }), Object.freeze({ param: 'ashby_jid', site: 'ashby' })]);
export function knownFrameSites({ url = null, jobId = null, noted = null } = {}) {
  const own = siteFor(url)?.id || null;
  const out = [];
  const add = (id) => { if (id && siteById(id) && id !== own && !out.includes(id)) out.push(id); };
  add(typeof noted === 'string' ? noted : null);
  const family = typeof jobId === 'string' ? jobId.split('::')[0] : null;
  add(family);
  const u = parse(url);
  if (u) for (const h of URL_FRAME_HINTS) if (u.searchParams.has(h.param)) add(h.site);
  return out;
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
 *           prepared?: boolean, frameUrl?: string|null, formInFrame?: boolean }} a
 *   `frameUrl` — the pass is for an ATS frame inside the tab (T11/T12); `formInFrame` — a top-frame pass on a page
 *   whose form is in an allowed ATS frame: the frame's own pass reads, prepares and fills it, so this one only captures.
 * @returns {{ skip?: string, site?: string, origin?: string, look?: boolean, actions?: string[] }}
 */
export function autoStep(a) {
  const { settings, url, granted } = a || {};
  if (!settings) return { skip: 'no_settings' };
  if (settings.kill) return { skip: 'kill_switch' };
  const sc = scopeFor(settings, url, a.frameUrl || null);
  if (sc.skip) return { skip: sc.skip };
  if (!granted) return { skip: 'not_granted' };
  const on = (b) => !!sc.sw[b] && (sc.kind !== 'site' || consentCovers(settings, sc.site, b));
  if (!BEHAVIOURS.some(on)) return { skip: 'site_off' };
  const id = sc.kind === 'site' ? { site: sc.site } : { site: sc.site, origin: sc.origin };
  const page = sc.pageUrl;
  const facts = a.facts;
  if (!facts) return { ...id, look: true };
  // ⛔ A sign-in or account page (a visible password box) — nothing is read, captured or filled there.
  if (facts.hasPassword) return { ...id, skip: 'sign_in_page', actions: [] };
  if (facts.origin && facts.origin !== new URL(page).origin) return { ...id, skip: 'page_moved', actions: [] };
  const actions = [];
  const isForm = num(facts.fieldCount) > 0 && !a.formInFrame;
  // CAPTURE — only a POSTING: never an application page, never an /apply stage, never from inside a frame.
  const maybePosting = sc.kind !== 'frame' && !facts.isApplyFlow && !isApplyStageUrl(page) && (hasPostingUrlShape(page) || facts.jsonLdPosting === true);
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
  return { ...id, actions };
}

/**
 * Which switches govern this page — pure. A preset site's (the table), a custom site's (T12: the origin the user
 * pressed "Always read here" on), or — for a pass inside an ATS frame — the custom site that embeds it, and only when
 * that frame's site is one the user allowed there. `origins` is what Chrome must still grant for the pass to run.
 */
export function scopeFor(settings, url, frameUrl = null) {
  const u = parse(url);
  if (!u) return { skip: 'not_https' };
  if (NEVER_HOSTS.test(u.hostname)) return { skip: 'never_host' };
  if (frameUrl) {
    const f = parse(frameUrl);
    if (!f) return { skip: 'not_https' };
    if (NEVER_HOSTS.test(f.hostname)) return { skip: 'never_host' };
    const fsite = siteFor(frameUrl);
    const entry = settings?.custom?.[u.origin];
    if (!fsite || !entry || !entry.frames.includes(fsite.id)) return { skip: 'frame_not_allowed' };
    return { kind: 'frame', site: 'custom', origin: u.origin, frameSite: fsite.id, sw: entry, pageUrl: frameUrl,
      origins: [originPattern(u.origin), ...fsite.origins] };
  }
  const site = siteFor(url);
  if (site) return { kind: 'site', site: site.id, sw: settings?.sites?.[site.id] || {}, pageUrl: url, origins: [...site.origins] };
  const entry = settings?.custom?.[u.origin];
  if (entry && customOriginFor(url)) return { kind: 'custom', site: 'custom', origin: u.origin, sw: entry, pageUrl: url, origins: [originPattern(u.origin)] };
  return { skip: 'not_a_listed_site' };
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

// ── ⭐ D97 REVISED · THE POPUP'S ONE-TIME CARD, AND T12 — the same disclosure in plain words ─────────────────────
// Shown BEFORE the click that asks Chrome; the click is the user's agreement. Written from what the code does: the card
// turns on Read and Prepare on the preset sites (Capture and Fill stay off — Options), "Always read here" the same on
// one more site.
export const CARD = Object.freeze({
  title: 'Let draft read job pages for you',
  lead: 'draft reads job and application pages for you and prepares your answers. Allow it on these sites:',
  points: Object.freeze([
    "It reads an application form's questions — never what you type, and never a password or payment field. " +
      'What it reads stays on this computer for 30 days; nothing of it is sent.',
    'When the tab is linked to one of your jobs, it prepares your answers on draft’s server, which sends the ' +
      "page's address — the same as pressing Prepare. On a page it cannot link to your job, nothing is sent.",
    'It does not add jobs to your account or fill forms for you unless you turn those on in Settings.',
    'Never on LinkedIn, Indeed or Glassdoor. Settings → "Turn off everything" stops it all and gives the access back.',
  ]),
  allow: 'Allow on these sites',
  later: 'Not now',
  asking: 'Chrome will ask you once, for these sites only.',
  refused: 'Chrome did not allow it, so nothing is on. Nothing on any page is read until you press it.',
  done: 'Done — draft reads job pages on these sites for you. Capture and Fill stay off; Settings has them.',
});
export const ALWAYS = Object.freeze({
  label: 'Always read here',
  hint: (host, frames = []) => `Reads ${host}'s job and application pages for you and prepares your answers, as on the ` +
    `sites above. Chrome will ask for ${[host, ...frames].join(' and ')} — this site only.`,
  first: 'The first time: draft reads the form\'s questions, never what you type or a password or payment field, and ' +
    'keeps what it read on this computer. On a page linked to one of your jobs it prepares your answers on draft’s ' +
    'server, which sends the page\'s address. Never on LinkedIn, Indeed or Glassdoor.',
  refused: (host) => `Chrome did not allow ${host}, so nothing changed — nothing on this site is read until you press it.`,
  on: (host) => `draft reads ${host} for you now.`,
  onHint: 'On — untick to stop, and draft gives back its access to this site.',
  off: (host) => `${host} is off — draft gave back its access.`,
  frameAsk: (name) => `Also allow ${name} on this site`,
  frameWhy: (name) => `This site's application form is inside a ${name} frame. draft needs ${name} too to read it.`,
});

/** "Reading automatically on this site · last read 15:51" — the popup's line once this site is read for the user. */
export function autoLine(settings, host, { clock = (ms) => hhmm(ms) } = {}) {
  const last = (settings?.reads || []).find(r => r.host === host);
  return last ? `Reading automatically on this site · last read ${clock(last.at)}` : 'Reading automatically on this site';
}
const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/**
 * What the popup shows for the active tab — pure, from LOCAL facts only (D23: no page read, no request):
 *   card       the one-time consent card (no card consent yet, or the kill switch was pressed; not within "Not now")
 *   line       "Reading automatically on this site · …" when this site is read for the user
 *   here       T12 on this tab: { origin, host, on, origins (what the click asks Chrome for), frames: [{ id, name }] }
 *              — offered on a page that looks like a job or an application (or a tab bound to a job), never on a
 *              preset site, draft's own, or LinkedIn / Indeed / Glassdoor
 *   frameAsk   the SECOND click: an allowed custom site whose ATS frame is known now but not allowed yet
 *   disclose   T12's first use — the disclosure is shown with the switch
 * `granted`: { here: boolean (the custom origin), sites: { [siteId]: boolean } }.
 */
export function popupAutoView({ settings, url, granted = {}, jobId = null, bound = false, now = Date.now() } = {}) {
  const s = settings || defaultSettings();
  const g = { here: !!granted.here, sites: granted.sites || {} };
  const view = { card: false, line: null, here: null, frameAsk: null, disclose: false };
  view.card = (!s.consent2 || s.kill) && !(Number.isFinite(s.later) && now - s.later < LATER_MS);
  const u = parse(url);
  if (!u) return view;
  const host = u.hostname.toLowerCase();
  const site = siteFor(url);
  if (site) {
    if (!s.kill && s.sites[site.id]?.read && consentCovers(s, site.id, 'read') && g.sites[site.id]) view.line = autoLine(s, host);
    return view;
  }
  const origin = customOriginFor(url);
  if (!origin) return view;
  const entry = s.custom[origin] || null;
  const on = !!entry && customActive(s, origin) && g.here;
  const known = knownFrameSites({ url, jobId, noted: s.frameHints[origin] || null });
  if (on) {
    if (entry.read) view.line = autoLine(s, host);
    const missing = known.find(id => !entry.frames.includes(id) || !g.sites[id]);
    if (missing) { const fs = siteById(missing); view.frameAsk = { origin, site: fs.id, name: fs.name, origins: [...fs.origins] }; }
  }
  if (on || looksLikeJobPage(url) || bound) {
    const frames = known.map(id => siteById(id));
    view.here = { origin, host, on, frames: frames.map(f => ({ id: f.id, name: f.name })),
      origins: [originPattern(origin), ...frames.flatMap(f => f.origins)] };
    view.disclose = !on && !s.consent2 && !Object.keys(s.custom).length;
  }
  return view;
}

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
    // T12: the page's iframes — their addresses only — so a custom site's pass knows which ATS frame holds its form.
    frames: [...document.querySelectorAll('iframe[src]')].map(f => f.src).filter(s => /^https:/i.test(s)).slice(0, 20),
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
async function hasOrigins(origins) {
  if (!origins?.length) return false;
  try { return await chrome.permissions.contains({ origins: [...origins] }); } catch { return false; }
}
async function giveBack(origins) {
  if (!origins?.length) return;
  try { await chrome.permissions.remove({ origins: [...origins] }); } catch { /* already gone */ }
}

// ── T12 · which ATS frame a site embeds, as last found there — in the settings (frameHints), an origin → a site id ──
// Written when a press (FILL / PREPARE — T11's "Allow draft on <site>") or an automatic pass on a custom site finds the
// form in an ATS frame draft may not read yet; read by the popup for "Always read here" and the SECOND click. Never a
// path, never the frame's address. Cleared by "Forget what was read" and the kill switch.
export async function noteFrameSite(pageUrl, siteId) {
  const origin = customOriginFor(pageUrl);
  if (!origin || !siteById(siteId)) return;
  const cur = await loadSettings();
  if (cur.frameHints[origin] === siteId) return;
  await updateSettings((s) => { delete s.frameHints[origin]; s.frameHints[origin] = siteId; return s; }).catch(() => null);
}

// ── REGISTRATION — the watcher runs only where a site is on AND granted ───────────────────────────────
/** A custom site's registration id. */
export const customRegistrationId = (origin) => `${WATCHER_ID_PREFIX}c-${new URL(origin).hostname}`;

/** The registrations that should exist: one per active, granted site — preset, and (T12) custom. */
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
  // ⭐ T12: a custom site — its own origin, plus the ATS frame sites the user allowed THERE, in every frame (the form of
  // a careers page is often an embedded ATS frame; the service worker accepts a frame's message only for the custom
  // site that lists that frame's site, and only while both are granted).
  for (const origin of Object.keys(settings?.custom || {})) {
    if (!customActive(settings, origin)) continue;
    if (!(await hasOrigins([originPattern(origin)]))) continue;
    const frames = [];
    for (const id of settings.custom[origin].frames) { const f = siteById(id); if (f && await hasGrant(f)) frames.push(...f.origins); }
    out.push({
      id: customRegistrationId(origin), matches: [originPattern(origin), ...frames], excludeMatches: [...NEVER_MATCHES],
      js: ['autoReadWatcher.js'], runAt: 'document_idle', allFrames: true, persistAcrossSessions: true,
    });
  }
  return out;
}

const sameRegistration = (a, b) => JSON.stringify([a.matches, a.excludeMatches, !!a.allFrames]) === JSON.stringify([b.matches, b.excludeMatches, !!b.allFrames]);

/**
 * Make Chrome's registered watchers match the settings and the grants. Called on install / update / startup, on
 * permissions added or removed, and after every switch change. ⚠ Unregistering does not remove a watcher already
 * injected in an open tab — which is why AUTO_READ_PAGE re-checks the switch and the permission on every message.
 * A registration whose matches changed (a custom site gained its frame site) is replaced.
 */
export async function syncRegistrations(settings = null) {
  const s = settings || await loadSettings();
  const want = await desiredRegistrations(s);
  let have = [];
  try { have = (await chrome.scripting.getRegisteredContentScripts()).filter(r => String(r.id).startsWith(WATCHER_ID_PREFIX)); }
  catch { have = []; }
  const wantById = new Map(want.map(w => [w.id, w]));
  const drop = have.filter(h => !wantById.has(h.id) || !sameRegistration(h, wantById.get(h.id))).map(h => h.id);
  const add = want.filter(w => !have.some(h => h.id === w.id && sameRegistration(h, w)));
  if (drop.length) { try { await chrome.scripting.unregisterContentScripts({ ids: drop }); } catch { /* already gone */ } }
  if (add.length) { try { await chrome.scripting.registerContentScripts(add); } catch { /* reported by the next sync */ } }
  return { registered: want.map(w => w.id), added: add.map(a => a.id), removed: drop.filter(id => !wantById.has(id)) };
}

/** Chrome took a site's access away (chrome://extensions, or Options): its switches follow, so the two never disagree. */
export async function onPermissionsRemoved(removed) {
  const gone = new Set(removed?.origins || []);
  const hit = SITES.filter(s => s.origins.some(o => gone.has(o)));
  const custom = (cur) => Object.keys(cur.custom).filter(o => gone.has(originPattern(o)));
  await updateSettings((cur) => {
    for (const s of hit) cur.sites[s.id] = offSite();
    for (const o of custom(cur)) delete cur.custom[o];
    // a frame site taken away leaves the custom sites that embedded it with their own page only
    for (const e of Object.values(cur.custom)) e.frames = e.frames.filter(id => !hit.some(s => s.id === id));
    return cur;
  });
  return syncRegistrations();
}

// ── THE SERVICE WORKER'S HANDLERS ─────────────────────────────────────────────────────────────────────
let SERVER_URL = null;
/** background.js names the server once (as configureAnswerMemory does). */
export function configureAutoRead({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

// ⛔ D99 J13: the sender's ADDRESS decides, not whether it has a tab. `options_page` opens Options IN A TAB, so
// Chrome sets `sender.tab` there — the old `!sender.tab` test refused every message from it: "I agree" answered
// "Could not record that", consent was never stored, and every switch stayed disabled ("the boxes can't be
// ticked", owner 10-13). A content script's `sender.url` is the web page's, never this extension's own origin,
// and the extension declares no web-accessible resources, so the origin is the whole test.
const fromExtensionPage = (sender) => typeof sender?.url === 'string'
  && sender.url.startsWith(chrome.runtime.getURL(''))
  && (sender.id == null || sender.id === chrome.runtime.id);

const TAB = new Map();          // tabId → { lastFillSig, fillStopped, prepared: Set, preparedOk: Set }
const LOCK = new Map();         // `${tabId}:${frameId}` → { busy, pending: { signature, frameUrl } | null }
const seenCaptures = createSeenSet();
const tabState = (id) => { if (!TAB.has(id)) TAB.set(id, { lastFillSig: null, fillStopped: false, prepared: new Set(), preparedOk: new Set() }); return TAB.get(id); };
const lockOf = (key) => { if (!LOCK.has(key)) LOCK.set(key, { busy: false, pending: null }); return LOCK.get(key); };
/** A closed tab forgets its lock (background.js tabs.onRemoved). */
export function forgetTab(tabId) {
  TAB.delete(tabId);
  for (const k of [...LOCK.keys()]) if (k.startsWith(`${tabId}:`)) LOCK.delete(k);
}

async function inject(target, func, args = []) {
  const [r] = await chrome.scripting.executeScript({ target: typeof target === 'object' ? target : { tabId: target }, func, args });
  return r?.result;
}

async function fillShortcut() {
  try {
    const cmds = await chrome.commands.getAll();
    return cmds.find(c => c.name === 'fill-gated-application')?.shortcut || null;
  } catch { return null; }
}

// ⭐ T17: the read's line is the DOCK's status line — drawn in the tab's TOP frame, even when the pass read an ATS frame
// inside it (the dock never mounts in a child frame). A dock not yet on the page opens collapsed: a slim bar.
async function showReadBadge(target, text) {
  if (!text) return null;
  const tabId = typeof target === 'object' ? target.tabId : target;
  try { return await drawInDock(tabId, renderBadge, ['ready', { text, theme: await overlayTheme(), dock: await dockMeta(tabId) }]); }
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
 * One pass over a tab (or, T12, over one ATS frame inside it), after the watcher said its step changed. Every check is
 * re-made here, every time: the switch, the consent, Chrome's grant, the kill switch — a watcher left in a tab after
 * its site was switched off is ignored.
 */
export async function runAutoPass(tab, { signature = null, serverUrl = SERVER_URL, frameId = 0, frameUrl = null } = {}) {
  const settings = await loadSettings();
  const inFrame = !!frameId && !!frameUrl;
  const sc = scopeFor(settings, tab?.url, inFrame ? frameUrl : null);
  const granted = sc.origins ? await hasOrigins(sc.origins) : false;
  const before = autoStep({ settings, url: tab?.url, granted, frameUrl: inFrame ? frameUrl : null });
  if (before.skip) return { skipped: before.skip, done: [] };

  const st = tabState(tab.id);
  const target = inFrame ? { tabId: tab.id, frameIds: [frameId] } : { tabId: tab.id };
  const pageUrl = inFrame ? frameUrl : tab.url;
  let facts;
  try { facts = await inject(target, pageFacts); } catch { return { skipped: 'no_access', done: [] }; }
  if (!facts) return { skipped: 'no_access', done: [] };

  // ⭐ T12: a custom site's page that embeds an ATS frame. Allowed there and granted → the frame's own pass reads,
  // prepares and fills the form (this one only captures). Not allowed yet → noted, so the popup can offer the second click.
  let formInFrame = false;
  if (sc.kind === 'custom') {
    const entry = settings.custom[sc.origin];
    for (const f of atsFramesOf(facts.frames || [], tab.url)) {
      if (entry.frames.includes(f.site.id) && await hasGrant(f.site)) formInFrame = true;
      else await noteFrameSite(tab.url, f.site.id);
    }
  }

  // The form's labels and count are read only when they could be used, and only locally.
  let labels = null;
  if (!facts.hasPassword && !formInFrame) {
    try { labels = await inject(target, collectFormLabels); } catch { labels = null; }
  }
  facts.fieldCount = labels?.fieldCount ?? 0;
  // Capture may need the page's JSON-LD — read in the page, and only for a page that could be a posting at all.
  if (!inFrame && !facts.hasPassword && !facts.isApplyFlow && !isApplyStageUrl(pageUrl) && sc.sw?.capture && !hasPostingUrlShape(pageUrl)) {
    try { facts.jsonLdPosting = (await inject(target, pageHasJobPosting)) === true; } catch { facts.jsonLdPosting = false; }
  }

  const bound = await bindingForTab(tab).catch(() => null);
  const packet = await loadPacketForTab(tab.id).catch(() => null);
  const batch = await loadBatchForTab(tab.id).catch(() => null);
  const plan = autoStep({
    settings, url: tab.url, granted, facts, bound: !!bound, packet: !!packet, batch: !!batch,
    prepared: !!(bound && st.prepared.has(String(bound.jobId))), fillStopped: st.fillStopped,
    signature, lastFillSig: st.lastFillSig, frameUrl: inFrame ? frameUrl : null, formInFrame,
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
    // The SITE the user is on (the tab's host — a custom site's, even when the form is in its ATS frame), never a path.
    let host = '';
    try { host = new URL(tab.url).hostname.toLowerCase(); } catch { /* checked above */ }
    await updateSettings((cur) => {
      cur.reads.unshift({ site: plan.site, host, step: facts.step, at: Date.now(), total: quality.total, recognised: quality.recognised,
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
    out.badge = await showReadBadge(target, readBadgeText(quality, { prepared, shortcut: await fillShortcut() }));
  }
  return out;
}

/**
 * The watcher's message: one pass per tab (per frame) at a time; a step change during a pass runs ONE more pass after
 * it. A message from a sub-frame counts only from a known ATS site's frame (T12) — scopeFor then decides whether the
 * page that embeds it allowed that site.
 */
async function onPageMessage(msg, sender) {
  const tab = sender?.tab;
  if (!tab?.id) return { ok: false, ignored: 'not_a_top_frame' };
  const frameId = sender.frameId || 0;
  const frameUrl = frameId ? (typeof sender.url === 'string' ? sender.url : null) : null;
  if (frameId && (!frameUrl || !siteFor(frameUrl))) return { ok: false, ignored: 'not_a_top_frame' };
  const lock = lockOf(`${tab.id}:${frameId}`);
  const signature = typeof msg?.signature === 'string' ? msg.signature.slice(0, 400) : null;
  if (lock.busy) { lock.pending = signature; return { ok: true, queued: true }; }
  lock.busy = true;
  try {
    let result = await runAutoPass(tab, { signature, frameId, frameUrl });
    while (lock.pending != null && lock.pending !== signature) {
      const next = lock.pending; lock.pending = null;
      let fresh = tab;
      try { fresh = (await chrome.tabs.get(tab.id)) || tab; } catch { break; }
      result = await runAutoPass(fresh, { signature: next, frameId, frameUrl });
    }
    lock.pending = null;
    return { ok: true, ...result };
  } finally { lock.busy = false; }
}

/** What Options shows: the settings (reads included — labels only), and which sites Chrome currently grants. */
async function stateForOptions() {
  const settings = await loadSettings();
  const granted = {};
  for (const s of SITES) granted[s.id] = await hasGrant(s);
  const customGranted = {};
  for (const o of Object.keys(settings.custom)) customGranted[o] = await hasOrigins([originPattern(o)]);
  return { ok: true, settings, granted, customGranted };
}

/** The origins a custom site holds that nothing else still needs — given back when the site goes. */
function releasable(settingsAfter, origin, frames) {
  const out = [originPattern(origin)];
  for (const id of frames) if (!siteNeeded(settingsAfter, id)) out.push(...siteById(id).origins);
  return out;
}

const validCustom = (origin) => typeof origin === 'string' && customOriginFor(`${origin}/`) === origin;

export const handlers = Object.freeze({
  /** The watcher: "this tab's step changed". From a content script in a top frame, or an ATS site's frame (T12). */
  [PAGE_MESSAGE]: (msg, sender) => onPageMessage(msg, sender),

  // ⛔ Everything below changes or reads the switches — accepted ONLY from the extension's own pages (the popup,
  // Options), never from a content script or a page.
  AUTO_READ_STATE: async (_msg, sender) => (fromExtensionPage(sender) ? stateForOptions() : { ok: false, error: 'not_allowed' }),
  AUTO_READ_CONSENT: async (msg, sender) => {
    if (!fromExtensionPage(sender) || msg?.agree !== true) return { ok: false, error: 'not_allowed' };
    const settings = await updateSettings((cur) => { cur.consent = { at: Date.now(), scope: 'all' }; return cur; });
    return { ok: true, settings };
  },
  /**
   * ⭐ D97 REVISED · the popup's one-time card. The popup asked Chrome for EVERY preset origin in one prompt, as the
   * click's first call; this records the consent and turns Read + Prepare on for each preset site Chrome granted —
   * Capture and Fill are untouched (off unless the user turned them on in Options). Nothing granted → nothing written.
   */
  AUTO_READ_CONSENT_ALL: async (msg, sender) => {
    if (!fromExtensionPage(sender) || msg?.agree !== true) return { ok: false, error: 'not_allowed' };
    const granted = [];
    for (const s of SITES) if (await hasGrant(s)) granted.push(s.id);
    if (!granted.length) return { ok: false, error: 'not_granted' };
    const settings = await updateSettings((cur) => {
      cur.consent2 = { at: Date.now() };
      cur.kill = false;
      cur.later = null;
      for (const id of granted) { cur.sites[id].read = true; cur.sites[id].prepare = true; }
      return cur;
    });
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, sites: granted, registered: reg.registered };
  },
  /** The card's "Not now" — it comes back after LATER_MS. Changes no switch. */
  AUTO_READ_LATER: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const settings = await updateSettings((cur) => { cur.later = Date.now(); return cur; });
    return { ok: true, settings };
  },
  /**
   * ⭐ T12 · "Always read here". The popup asked Chrome for this ONE origin (and the ATS frame site it knew of) as the
   * click's first call; this checks the grant and turns Read + Prepare on for it. ⛔ Never a preset site, draft's own,
   * or LinkedIn / Indeed / Glassdoor; never without Chrome's grant.
   */
  AUTO_READ_ALLOW_SITE: async (msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const origin = msg?.origin;
    if (!validCustom(origin)) return { ok: false, error: 'bad_site' };
    if (!(await hasOrigins([originPattern(origin)]))) return { ok: false, error: 'not_granted' };
    const frames = [];
    for (const id of Array.isArray(msg.frames) ? msg.frames : []) { const f = siteById(id); if (f && !frames.includes(id) && await hasGrant(f)) frames.push(id); }
    const cur0 = await loadSettings();
    if (!cur0.custom[origin] && Object.keys(cur0.custom).length >= CUSTOM_LIMIT) return { ok: false, error: 'too_many_sites' };
    const settings = await updateSettings((cur) => {
      const e = cur.custom[origin] || { ...offSite(), frames: [], at: Date.now() };
      e.read = true; e.prepare = true;
      e.frames = [...new Set([...e.frames, ...frames])];
      cur.custom[origin] = e;
      cur.kill = false;
      return cur;
    });
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /** ⭐ T12 · the SECOND click: the ATS frame site of an allowed custom site, granted from that click. */
  AUTO_READ_ALLOW_FRAME: async (msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const site = siteById(msg?.site);
    if (!validCustom(msg?.origin) || !site) return { ok: false, error: 'bad_site' };
    if (!(await loadSettings()).custom[msg.origin]) return { ok: false, error: 'no_consent' };
    if (!(await hasGrant(site))) return { ok: false, error: 'not_granted' };
    const settings = await updateSettings((cur) => {
      const e = cur.custom[msg.origin];
      if (e && !e.frames.includes(site.id)) e.frames.push(site.id);
      return cur;
    });
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /** ⭐ T12 · Remove a custom site: its switches gone, its access given back, its watcher unregistered. */
  AUTO_READ_REMOVE_SITE: async (msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const origin = msg?.origin;
    if (!validCustom(origin)) return { ok: false, error: 'bad_site' };
    const frames = (await loadSettings()).custom[origin]?.frames || [];
    const settings = await updateSettings((cur) => { delete cur.custom[origin]; return cur; });
    await giveBack(releasable(settings, origin, frames));
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /**
   * One switch — a preset site's (`site`) or a custom site's (`origin`). ON is accepted only with consent and Chrome's
   * grant already in place (the page asked at the click).
   */
  AUTO_READ_SET: async (msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    if (!BEHAVIOURS.includes(msg?.behaviour)) return { ok: false, error: 'bad_switch' };
    const on = msg.on === true;
    if (msg?.origin != null) {
      const origin = msg.origin;
      if (!validCustom(origin)) return { ok: false, error: 'bad_switch' };
      const cur0 = await loadSettings();
      const frames = cur0.custom[origin]?.frames || [];
      if (!cur0.custom[origin]) return { ok: false, error: 'no_consent' };
      if (on && !(await hasOrigins([originPattern(origin)]))) return { ok: false, error: 'not_granted' };
      const settings = await updateSettings((cur) => {
        const e = cur.custom[origin];
        if (!e) return cur;
        e[msg.behaviour] = on;
        if (on) cur.kill = false;
        // ⛔ OFF: the last switch on a custom site removes the site (as Remove does).
        if (!BEHAVIOURS.some(b => e[b])) delete cur.custom[origin];
        return cur;
      });
      if (!settings.custom[origin]) await giveBack(releasable(settings, origin, frames));
      const reg = await syncRegistrations(settings);
      return { ok: true, settings, registered: reg.registered };
    }
    const site = siteById(msg?.site);
    if (!site) return { ok: false, error: 'bad_switch' };
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
    // ⛔ OFF: the last switch on a site gives its access back and removes its watcher — unless a custom site still
    // reads that site's frame (T12), which keeps it until that custom site goes.
    if (!on && !BEHAVIOURS.some(b => settings.sites[site.id][b]) && !siteNeeded(settings, site.id)) {
      try { await chrome.permissions.remove({ origins: [...site.origins] }); } catch { /* already gone */ }
    }
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /** ⛔ THE KILL SWITCH — every behaviour off, every custom site removed, every site's access given back, every watcher unregistered. */
  AUTO_READ_KILL: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const customs = Object.keys((await loadSettings()).custom);
    const settings = await updateSettings((cur) => { for (const s of SITES) cur.sites[s.id] = offSite(); cur.custom = {}; cur.frameHints = {}; cur.kill = true; return cur; });
    try { await chrome.permissions.remove({ origins: [...OPTIONAL_ORIGINS, ...customs.map(originPattern)] }); } catch { /* already gone */ }
    const reg = await syncRegistrations(settings);
    return { ok: true, settings, registered: reg.registered };
  },
  /** "Forget what was read" — the local labels and counts, gone. */
  AUTO_READ_FORGET: async (_msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const settings = await updateSettings((cur) => { cur.reads = []; cur.frameHints = {}; return cur; });
    return { ok: true, settings };
  },
});

/** install / update / startup: carry D64's switch over once, then make the registrations match. */
export async function reconcileAutoRead() {
  await migrateLegacy().catch(() => null);
  return syncRegistrations();
}
