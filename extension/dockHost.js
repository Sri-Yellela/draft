// ── T17 · THE DOCK, the service worker's half ─────────────────────────────────────────────────────────────────────────
//
// extension/dock.js is the ONE floating window on a page (drag · resize · snap · collapse · tabs · pop-out). This module
// is what the service worker does for it, once, for every view:
//
//   · drawInDock(tabId, func, args) — every view is drawn the same way: dock.js into the TOP frame (frameIds [0]), then
//     the view's own serialised function, also at frame 0. ⛔ Never into a child frame: a form inside an ATS's iframe
//     (Greenhouse on stripe.com) keeps only the extractor and the filler, and its fields are read for the dock through
//     here by tabId + frameId (gated-handoff.js formFrameHandlers).
//   · dockMeta(tab) — what the dock needs when it is first drawn on a page: where it sat on this SITE last time, and the
//     account's appearance resolved to palettes (all four of the registry's themes, and the shape cues).
//   · the rectangle, remembered PER SITE: `dockPlace` in chrome.storage.local — { [origin]: { rect, edge, collapsed, tab,
//     pops, popped, at } }. Position and size only: no page content, no job, no answer. The 50 most recent sites, each
//     kept 30 days from its last change. ONE write site (writeDockPlaces). Never sent anywhere.
//   · overlayTheme() — the palettes every injected view paints with (moved here from gated-handoff.js, which re-exports it).
//
// ⛔ No new permission: executeScript and storage are already declared, and the appearance is read with the extension's
// own token from draft's own server (GET /api/settings/appearance — the same answer the web app reads).
import { authedFetch } from './auth.js';
import { C_LIGHT, C_DARK, EXT_THEMES } from './tokens.js';

let SERVER_URL = null;
/** The router's server URL (draft's own) — set once by background.js. */
export function configureDock({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

export const DOCK_FILE = 'dock.js';
export const DOCK_PLACE_KEY = 'dockPlace';
export const DOCK_PLACE_MAX_SITES = 50;
export const DOCK_PLACE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const DOCK_TABS = Object.freeze(['fill', 'ats', 'resume', 'copy']);
const EDGES = ['left', 'right', 'top', 'bottom'];

// ── the account's appearance → the palettes (D91: four themes and the shape cues) ──────────────────────────────────
/**
 * The two palettes a view declares — light by default, dark under the page's prefers-color-scheme — for the account's
 * theme preference: "system" (or the older "light" / "dark", or nothing) → Paper Light / Charcoal Dark; "contrast" →
 * Contrast Light / Contrast Dark; a theme id → that ONE theme whatever the OS says. Pure.
 */
export function themePair(pref) {
  const t = String(pref || 'system');
  if (EXT_THEMES[t]) return { light: EXT_THEMES[t].tokens, dark: EXT_THEMES[t].tokens, id: t };
  if (t === 'contrast') return { light: EXT_THEMES['contrast-light'].tokens, dark: EXT_THEMES['contrast-dark'].tokens, id: 'contrast' };
  return { light: C_LIGHT, dark: C_DARK, id: 'system' };
}

const APPEARANCE_TTL_MS = 5 * 60 * 1000;
let APPEARANCE = { at: 0, value: null };
/** { theme, cues } — the account's, asked of draft at most every five minutes; the OS-following pair when it cannot be. */
export async function accountAppearance() {
  if (APPEARANCE.value && Date.now() - APPEARANCE.at < APPEARANCE_TTL_MS) return APPEARANCE.value;
  let value = { theme: 'system', cues: false };
  if (SERVER_URL) {
    try {
      const res = await authedFetch(SERVER_URL, '/api/settings/appearance');
      if (res?.ok) {
        const body = await res.json().catch(() => null);
        if (body && typeof body.theme === 'string') value = { theme: body.theme, cues: body.cues === true };
      }
    } catch { /* the OS-following pair */ }
  }
  APPEARANCE = { at: Date.now(), value };
  return value;
}
/** A disconnect or another account: the next draw asks again. */
export function forgetAppearance() { APPEARANCE = { at: 0, value: null }; }

// D23 — what an injected view is painted with: the site's tokens (extension/tokens.js, generated from the theme
// registry) and the logo face's bytes, read from the extension's own package (fonts/, the same file tokens.css
// declares). The views are serialised into the page and close over nothing, so all of it travels as an argument. The
// font is a courtesy: if it cannot be read the view renders the same words in the fallback face.
// ⭐ T17: the pair is the ACCOUNT's appearance (themePair) — so the dock and every view on it follow all four themes.
let LOGO = null;
export async function overlayTheme() {
  if (LOGO === null) {
    LOGO = '';
    try {
      const res = await fetch(chrome.runtime.getURL('fonts/poppins-latin-800-italic.woff2'));
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        LOGO = btoa(bin);
      }
    } catch { /* fallback face */ }
  }
  const pair = themePair((await accountAppearance())?.theme);
  return { light: pair.light, dark: pair.dark, logoFont: LOGO || null };
}

// ── where the dock sits, per site ────────────────────────────────────────────────────────────────────────────────
/** The site a page is on — its origin — for an http(s) page; null for anything else. */
export function siteOf(url) {
  try { const u = new URL(String(url || '')); return /^https?:$/.test(u.protocol) ? u.origin : null; } catch { return null; }
}

const rectOf = (r) => (r && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k]) && Math.abs(r[k]) < 100000)
  ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } : null);
/** A place, kept to its named fields: the rectangle, the snapped edge, collapsed, the tab, the pop-out windows. Pure. */
export function dockPlaceRecord(place, now = Date.now()) {
  const pops = {};
  for (const t of DOCK_TABS) { const r = rectOf(place?.pops?.[t]); if (r) pops[t] = r; }
  return {
    rect: rectOf(place?.rect), edge: EDGES.includes(place?.edge) ? place.edge : null, collapsed: place?.collapsed === true,
    tab: DOCK_TABS.includes(place?.tab) ? place.tab : 'fill', pops,
    popped: (Array.isArray(place?.popped) ? place.popped : []).filter(t => DOCK_TABS.includes(t)).slice(0, DOCK_TABS.length),
    at: now,
  };
}

async function readDockPlaces() {
  try { const got = await chrome.storage.local.get(DOCK_PLACE_KEY); return got?.[DOCK_PLACE_KEY] && typeof got[DOCK_PLACE_KEY] === 'object' ? got[DOCK_PLACE_KEY] : {}; }
  catch { return {}; }
}
/** ⛔ THE ONE WRITE of `dockPlace` — the newest 50 sites, none older than 30 days. */
async function writeDockPlaces(all, now = Date.now()) {
  const kept = Object.entries(all || {}).filter(([, p]) => p && Number.isFinite(p.at) && now - p.at < DOCK_PLACE_TTL_MS)
    .sort((a, b) => b[1].at - a[1].at).slice(0, DOCK_PLACE_MAX_SITES);
  try { await chrome.storage.local.set({ [DOCK_PLACE_KEY]: Object.fromEntries(kept) }); } catch { /* remembered next time, or not */ }
}

/** Where the dock sat on this page's site, or null (first time here, or forgotten). */
export async function loadDockPlace(url) {
  const site = siteOf(url);
  if (!site) return null;
  const p = (await readDockPlaces())[site];
  return p && Date.now() - (p.at || 0) < DOCK_PLACE_TTL_MS ? p : null;
}
/** Remember where the dock sits on this page's site. */
export async function saveDockPlace(url, place, now = Date.now()) {
  const site = siteOf(url);
  if (!site) return false;
  const all = await readDockPlaces();
  all[site] = dockPlaceRecord(place, now);
  await writeDockPlaces(all, now);
  return true;
}
/** Forget every site's place (the kill switch, "Forget what was read"). */
export async function forgetDockPlaces() { await writeDockPlaces({}); }

/** What the dock needs on its first draw on a page: where it sat on this site, and the account's look. */
export async function dockMeta(tabOrId) {
  const tab = typeof tabOrId === 'number' ? await chrome.tabs.get(tabOrId).catch(() => null) : tabOrId;
  const [place, theme, appearance] = await Promise.all([loadDockPlace(tab?.url), overlayTheme(), accountAppearance()]);
  return { place, theme, cues: appearance?.cues === true };
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** The dock's module into the tab's TOP frame (a no-op when it is already there). ⛔ frame 0 only. */
export async function ensureDockIn(tabId) {
  // the literal file names (not DOCK_FILE) are what scripts/buildExtension.mjs follows into the package. ⭐ T27: the
  // popup layer comes with the dock, in order — every view and every message speaks through it.
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['dock.js', 'popup-layer.js'] });
}
/**
 * Draw a view on the dock: dock.js, then `func(...args)`, both in the tab's TOP frame. Returns executeScript's first
 * result's value. Throws as executeScript does (no access to the page) — each caller says what that means for it.
 */
export async function drawInDock(tabId, func, args = []) {
  await ensureDockIn(tabId);
  const [r] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func, args });
  return r?.result ?? null;
}

/** Injected, TOP frame: open the dock (drawing it if it is not there) on a tab. → { ok, has: [tabs with a view] }. */
export function openDockInPage(dockArgs, tab) {
  const dock = globalThis.__draftDock?.ensure?.(dockArgs || {});
  if (!dock) return { ok: false };
  dock.expand();
  if (tab) dock.select(tab);
  return { ok: true, active: dock.active(), has: ['fill', 'ats', 'resume', 'copy'].filter(t => dock.has(t)) };
}

// ── the dock's messages ─────────────────────────────────────────────────────────────────────────────────────────
/**
 * DOCK_PLACE — the dock moved, was resized, snapped, collapsed or changed tab: remember it for the page's site.
 * ⛔ Only from a web page's TOP frame (the dock never exists anywhere else), and only the named fields are kept.
 */
export const handlers = {
  DOCK_PLACE: async (msg, sender) => {
    if (sender?.frameId !== 0 || !sender?.tab?.id) return { ok: false };
    const url = sender.url || sender.tab.url;
    return { ok: await saveDockPlace(url, msg?.place) };
  },
};
