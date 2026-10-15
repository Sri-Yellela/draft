// ⭐ The popup's automatic-reading surfaces — the D64 "Captured today" list, the D97 REVISED one-time card, and T12's
// "Always read here". A module, loaded after popup.js.
//
// ⛔ D23 holds: opening the popup reads NOTHING from the page and asks the server NOTHING. Everything drawn here comes
// from local facts — the extension's own storage (the settings and the frame site a press noted there, the tab's binding), the
// tab's address (which the browser already handed the popup) and chrome.permissions.contains. No frame is read on open.
//
// ⛔ chrome.permissions.request is called in exactly three click handlers here — the card's "Allow on these sites", the
// "Always read here" switch turned ON, and the second click "Also allow <ATS> on this site" — each as the FIRST call of
// its handler, synchronously, inside the user's gesture. Never on open, never on install (owner 10-15, decision 4: the
// consent card lives in the popup only — there is no first-run tab).
import {
  AUTO_READ_KEY, normaliseSettings, SITES, consentCovers, OPTIONAL_ORIGINS, CARD, ALWAYS, DISPLAY_ORDER,
  popupAutoView, customOriginFor, originPattern, siteById,
} from './autoRead.js';
import { BIND_PREFIX } from './tabBinding.js';

// ── ⭐ D64 · "Captured today: N" — the automatic captures, with an undo per item ─────────────────────────────────────
// Shown only while automatic capture is switched on for at least one site (the Capture column of Options' table — a
// local storage read). The list is asked for when the user OPENS it, through the background worker (AUTO_CAPTURES),
// and each Undo takes the posting off their board (AUTO_CAPTURE_UNDO).
export function mountToday(doc, api) {
  const box = doc.getElementById('auto-today');
  const head = doc.getElementById('auto-today-head');
  const list = doc.getElementById('auto-today-list');
  if (!box || !head || !list) return;
  const ask = (msg) => Promise.resolve(api.runtime.sendMessage(msg)).catch(() => null);

  function row(c) {
    const li = doc.createElement('li');
    const text = doc.createElement('span');
    text.textContent = [c.title, c.company].filter(Boolean).join(' · ') || c.url || c.jobId;
    const undo = doc.createElement('button');
    undo.className = 'link';
    undo.textContent = 'Undo';
    undo.setAttribute('aria-label', `Undo the automatic capture of ${text.textContent}`);
    undo.addEventListener('click', async () => {
      undo.disabled = true;
      const r = await ask({ type: 'AUTO_CAPTURE_UNDO', jobId: c.jobId });
      if (r?.success) { li.remove(); void load(); } else { undo.disabled = false; undo.textContent = 'Could not undo'; }
    });
    li.append(text, ' ', undo);
    return li;
  }

  async function load() {
    const r = await ask({ type: 'AUTO_CAPTURES' });
    const caps = r?.captures || [];
    head.textContent = r?.disabled ? 'Automatic capture is paused by draft' : `Captured automatically today: ${caps.length}`;
    list.textContent = '';
    if (!r) { list.append(Object.assign(doc.createElement('li'), { textContent: 'Sign in to see them.' })); return; }
    for (const c of caps) list.append(row(c));
  }

  Promise.resolve(api.storage.local.get(AUTO_READ_KEY)).then(({ [AUTO_READ_KEY]: raw } = {}) => {
    const s = normaliseSettings(raw);
    const on = !s.kill && (SITES.some(site => s.sites[site.id].capture && consentCovers(s, site.id, 'capture'))
      || Object.values(s.custom).some(e => e.capture));
    if (!on) return;
    box.hidden = false;
    box.addEventListener('toggle', () => { if (box.open) void load(); });
  }).catch(() => {});
}

// ── the local facts ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Everything the card and "Always read here" are drawn from — storage, the tab's address, Chrome's grants. Local. */
export async function localFacts(api) {
  const [tab] = await Promise.resolve(api.tabs.query({ active: true, currentWindow: true })).catch(() => []);
  const raw = (await Promise.resolve(api.storage.local.get(AUTO_READ_KEY)).catch(() => ({})))?.[AUTO_READ_KEY];
  const settings = normaliseSettings(raw);
  const tabId = tab?.id;
  const key = tabId != null ? `${BIND_PREFIX}${tabId}` : null;
  const binding = key ? ((await Promise.resolve(api.storage.session.get(key)).catch(() => ({})) || {})[key] || null) : null;
  const has = (origins) => Promise.resolve(api.permissions.contains({ origins })).catch(() => false);
  const sites = {};
  for (const s of SITES) sites[s.id] = await has([...s.origins]);
  const origin = customOriginFor(tab?.url);
  const here = origin ? await has([originPattern(origin)]) : false;
  return { settings, url: tab?.url || null, granted: { here, sites }, jobId: binding?.jobId ?? null, bound: !!binding };
}

// ── the three clicks — each asks Chrome FIRST ───────────────────────────────────────────────────────────────────────
/**
 * ⭐ T20 · said to the service worker in the SAME synchronous turn as the request, right after it: what this click asked
 * Chrome for. MEASURED (headed Chrome, Chrome's real prompt): the popup closes the moment the prompt opens, so the code
 * after `await asked` never runs when the user actually answers — the worker finishes the consent from Chrome's grant
 * instead (autoRead.js onPermissionsAdded). Not awaited: nothing may stand between the click and the request, and the
 * popup may be gone before an answer comes.
 */
function pending(api, msg) {
  try { const p = api.runtime.sendMessage({ type: 'AUTO_READ_PENDING', ...msg }); if (p && typeof p.catch === 'function') p.catch(() => {}); }
  catch { /* the worker is restarting — the popup's own message still finishes a grant it lives to see */ }
}
/** A refusal the popup lived to see drops the pending click at once (otherwise it expires). */
const unpend = (api) => Promise.resolve(api.runtime.sendMessage({ type: 'AUTO_READ_PENDING_CLEAR' })).catch(() => null);

/** The card's "Allow on these sites": ONE prompt for every preset origin, then the consent. A refusal writes nothing. */
export function onConsent(api) {
  const asked = api.permissions.request({ origins: [...OPTIONAL_ORIGINS] });
  pending(api, { kind: 'all' });
  return (async () => {
    let granted = false;
    try { granted = await asked; } catch { granted = false; }
    if (!granted) { await unpend(api); return { ok: false, error: 'not_granted', message: CARD.refused }; }
    const r = (await api.runtime.sendMessage({ type: 'AUTO_READ_CONSENT_ALL', agree: true })) || { ok: false };
    return r.ok ? { ...r, message: CARD.done } : { ...r, message: CARD.refused };
  })();
}

/** "Always read here" changed. ON asks Chrome for this origin (and the ATS frame known for it) first; OFF gives it back. */
export function onAlwaysHere(api, here, checked) {
  const asked = checked && here ? api.permissions.request({ origins: [...here.origins] }) : null;
  if (asked) pending(api, { kind: 'site', origin: here.origin, frames: here.frames.map(f => f.id) });
  return (async () => {
    if (!here) return { ok: false, error: 'bad_site' };
    if (!checked) {
      const r = (await api.runtime.sendMessage({ type: 'AUTO_READ_REMOVE_SITE', origin: here.origin })) || { ok: false };
      return { ...r, message: r.ok ? ALWAYS.off(here.host) : 'That could not be changed.' };
    }
    let granted = false;
    try { granted = await asked; } catch { granted = false; }
    if (!granted) { await unpend(api); return { ok: false, error: 'not_granted', message: ALWAYS.refused(here.host) }; }
    const r = (await api.runtime.sendMessage({ type: 'AUTO_READ_ALLOW_SITE', origin: here.origin, frames: here.frames.map(f => f.id) })) || { ok: false };
    return { ...r, message: r.ok ? ALWAYS.on(here.host) : ALWAYS.refused(here.host) };
  })();
}

/** The SECOND click: the ATS frame site of a site already allowed (owner 10-15, decision 3). */
export function onAllowFrame(api, ask) {
  const asked = ask ? api.permissions.request({ origins: [...ask.origins] }) : null;
  if (asked) pending(api, { kind: 'frame', origin: ask.origin, site: ask.site });
  return (async () => {
    if (!ask) return { ok: false, error: 'bad_site' };
    let granted = false;
    try { granted = await asked; } catch { granted = false; }
    if (!granted) { await unpend(api); return { ok: false, error: 'not_granted', message: `Chrome did not allow ${ask.name}, so nothing changed.` }; }
    const r = (await api.runtime.sendMessage({ type: 'AUTO_READ_ALLOW_FRAME', origin: ask.origin, site: ask.site })) || { ok: false };
    return { ...r, message: r.ok ? `draft reads ${ask.name}'s form on this site now.` : 'That could not be changed.' };
  })();
}

// ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Draw the card and "Always read here" from `facts` and wire them. Returns { view, refresh } (the tests drive it).
 * `gather` re-reads the local facts after a change (default: localFacts).
 */
export function mountAuto(doc, api, facts, { gather = () => localFacts(api) } = {}) {
  const $ = (id) => doc.getElementById(id);
  const card = $('auto-card');
  const here = $('auto-here');
  if (!card || !here) return null;
  const say = (el, text) => { if (el) el.textContent = text || ''; };
  const ui = { view: null, facts, refresh: null };

  // the card's words — written once, from autoRead.js CARD
  say($('auto-card-title'), CARD.title);
  say($('auto-card-lead'), CARD.lead);
  const sites = $('auto-card-sites');
  sites.textContent = '';
  for (const id of DISPLAY_ORDER) {
    const li = doc.createElement('li');
    li.textContent = siteById(id).name;
    sites.append(li);
  }
  const points = $('auto-card-points');
  points.textContent = '';
  for (const p of CARD.points) { const li = doc.createElement('li'); li.textContent = p; points.append(li); }
  say($('auto-card-asking'), CARD.asking);
  const allow = $('auto-allow');
  const later = $('auto-later');
  say(allow, CARD.allow);
  say(later, CARD.later);
  const box = $('auto-here-box');
  say($('auto-here-label'), ALWAYS.label);
  say($('auto-here-first'), ALWAYS.first);
  const frameBtn = $('auto-frame');

  function render() {
    const v = popupAutoView(ui.facts);
    ui.view = v;
    card.hidden = !v.card;
    // "Reading automatically on this site · last read 15:51" — instead of "Nothing on this page is read until you press it."
    if (v.line) say($('read-hint'), v.line);
    here.hidden = !v.here;
    if (v.here) {
      box.checked = v.here.on;
      say($('auto-here-hint'), v.here.on ? ALWAYS.onHint : ALWAYS.hint(v.here.host, v.here.frames.map(f => f.name)));
      $('auto-here-first').hidden = !v.disclose;
    }
    frameBtn.hidden = !v.frameAsk;
    $('auto-frame-why').hidden = !v.frameAsk;
    if (v.frameAsk) { say(frameBtn, ALWAYS.frameAsk(v.frameAsk.name)); say($('auto-frame-why'), ALWAYS.frameWhy(v.frameAsk.name)); }
  }
  async function refresh() {
    ui.facts = await gather();
    render();
    return ui.view;
  }
  ui.refresh = refresh;

  allow.addEventListener('click', () => {
    // ⛔ onConsent asks Chrome FIRST — nothing may come between the click and the request.
    onConsent(api).then(async (r) => { say($('auto-card-status'), r.message); if (r.ok) await refresh(); });
  });
  later.addEventListener('click', async () => {
    await Promise.resolve(api.runtime.sendMessage({ type: 'AUTO_READ_LATER' })).catch(() => null);
    card.hidden = true;
  });
  box.addEventListener('change', () => {
    const v = ui.view;
    // ⛔ onAlwaysHere asks Chrome FIRST (when turned on).
    onAlwaysHere(api, v?.here || null, box.checked).then(async (r) => {
      say($('auto-here-status'), r.message);
      await refresh();
    });
  });
  frameBtn.addEventListener('click', () => {
    const v = ui.view;
    onAllowFrame(api, v?.frameAsk || null).then(async (r) => { say($('auto-here-status'), r.message); await refresh(); });
  });

  render();
  return ui;
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') {
  mountToday(document, chrome);
  localFacts(chrome).then((f) => mountAuto(document, chrome, f)).catch(() => {});
}
