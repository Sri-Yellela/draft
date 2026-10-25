// ⭐ D97 · Options → "Read application pages automatically" — the ONE switch implementation (D64's automatic-capture
// switch is now the Capture column of this table; A93: the same thing is built once).
//
//   · ⛔ Nothing can be switched on until the user has read the disclosure and pressed "I agree" (the Chrome Web Store
//     User Data policy wants the prominent disclosure and the consent inside the product's own UI).
//   · ⛔ chrome.permissions.request is the FIRST call of a switch's change handler — inside the user's gesture, before
//     any await — and it is never called on load, on install, or anywhere else in the extension.
//   · Every switch, the consent, "Forget what was read" and the kill switch are WRITTEN by the service worker
//     (autoRead.js handlers, by message): one write site, serialised, so a switch turned off cannot be lost to a read
//     being logged at the same moment. Turning a site's last switch off gives Chrome's access back there.
//   · ⭐ T12: the sites the user chose with the popup's "Always read here" are listed below the preset table, with the
//     same four switches and Remove (gives Chrome's access back and unregisters the watcher).
import { SITES, DISPLAY_ORDER, BEHAVIOURS, DISCLOSURE, ALWAYS, CARD, OPTIONAL_ORIGINS, siteById, consentCovers, readQuality, originPattern, customOriginFor } from './autoRead.js';

/**
 * ⭐ T31 · the toolbar popup's one-time card, moved here: ONE Chrome prompt for every preset site, then Read + Prepare on
 * those Chrome granted (AUTO_READ_CONSENT_ALL). ⛔ The request is the handler's FIRST call, synchronous, in the click;
 * the pending note goes to the worker in the same turn (Chrome's answer can outlive the handler).
 */
export function onConsentAll(api) {
  const asked = api.permissions.request({ origins: [...OPTIONAL_ORIGINS] });
  try { const p = api.runtime.sendMessage({ type: 'AUTO_READ_PENDING', kind: 'all' }); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch { /* the worker finishes a grant it sees */ }
  return (async () => {
    let granted = false;
    try { granted = await asked; } catch { granted = false; }
    if (!granted) { await Promise.resolve(api.runtime.sendMessage({ type: 'AUTO_READ_PENDING_CLEAR' })).catch(() => null); return { ok: false, message: CARD.refused }; }
    const r = (await api.runtime.sendMessage({ type: 'AUTO_READ_CONSENT_ALL', agree: true })) || { ok: false };
    return r.ok ? { ...r, message: CARD.done } : { ...r, message: CARD.refused };
  })();
}

/**
 * ⭐ T31 (owner 10-25) · "Always read here", moved from the toolbar popup: the dock's offer opens this page with
 * ?here=<origin>&frames=<ids> (background.js DOCK_ACT always-here — the TAB's origin). The one switch asks Chrome for
 * that origin and the ATS frames it embeds — ⛔ the FIRST call of its handler, synchronously, inside the click — says
 * so to the worker in the same turn (AUTO_READ_PENDING: Chrome's answer can outlive this page's handler), then turns
 * Read + Prepare on there (AUTO_READ_ALLOW_SITE). → the request's answer, then the worker's.
 */
export function onAlwaysHere(api, here) {
  const asked = here ? api.permissions.request({ origins: [...here.origins] }) : null;
  // a site already chosen only gains its form's frame (the popup's old "second click") — its own switches stay as they are
  const note = here?.existing ? { kind: 'frame', origin: here.origin, site: here.frames[0] } : { kind: 'site', origin: here?.origin, frames: here?.frames };
  if (asked) { try { const p = api.runtime.sendMessage({ type: 'AUTO_READ_PENDING', ...note });
    if (p && typeof p.catch === 'function') p.catch(() => {}); } catch { /* the worker finishes a grant it sees */ } }
  return (async () => {
    if (!here) return { ok: false, error: 'bad_site' };
    let granted = false;
    try { granted = await asked; } catch { granted = false; }
    if (!granted) {
      await Promise.resolve(api.runtime.sendMessage({ type: 'AUTO_READ_PENDING_CLEAR' })).catch(() => null);
      return { ok: false, error: 'not_granted', message: ALWAYS.refused(here.host) };
    }
    if (here.existing) {
      let r = { ok: true };
      for (const site of here.frames) r = (await api.runtime.sendMessage({ type: 'AUTO_READ_ALLOW_FRAME', origin: here.origin, site })) || { ok: false };
      const names = here.frames.map(id => siteById(id).name).join(' and ');
      return { ...r, message: r.ok ? `draft reads ${names}'s form on ${here.host} now.` : 'That could not be changed.' };
    }
    const r = (await api.runtime.sendMessage({ type: 'AUTO_READ_ALLOW_SITE', origin: here.origin, frames: here.frames })) || { ok: false };
    return { ...r, message: r.ok ? ALWAYS.on(here.host) : ALWAYS.refused(here.host) };
  })();
}
/** The site a deep link asks about — validated: a custom origin draft may read (never a preset site, LinkedIn, …). */
export function hereFromSearch(search) {
  let q;
  try { q = new URLSearchParams(search || ''); } catch { return null; }
  const origin = q.get('here');
  if (!origin || customOriginFor(`${origin}/`) !== origin) return null;
  const frames = (q.get('frames') || '').split(',').filter(id => siteById(id)).slice(0, SITES.length);
  return { origin, host: new URL(origin).hostname, frames, origins: [originPattern(origin), ...frames.flatMap(id => siteById(id).origins)] };
}

export const COLUMN = Object.freeze({ read: 'Read', prepare: 'Prepare', capture: 'Capture', fill: 'Fill' });

/**
 * One switch changed. ⛔ The permission request is made SYNCHRONOUSLY, as this function's first chrome call, so it
 * stays inside the click's user gesture. Returns the service worker's answer.
 */
export function onSwitch(api, { siteId = null, origin = null, behaviour, checked }) {
  const site = origin ? null : siteById(siteId);
  const origins = origin ? [originPattern(origin)] : site ? [...site.origins] : null;
  const asked = checked && origins ? api.permissions.request({ origins }) : null;
  return (async () => {
    if (!origins || !BEHAVIOURS.includes(behaviour)) return { ok: false, error: 'bad_switch' };
    if (checked) {
      let granted = false;
      try { granted = await asked; } catch { granted = false; }
      if (!granted) return { ok: false, error: 'not_granted' };
    }
    const target = origin ? { origin } : { site: siteId };
    return (await api.runtime.sendMessage({ type: 'AUTO_READ_SET', ...target, behaviour, on: !!checked })) || { ok: false };
  })();
}

const hhmm = (ms) => { try { return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

/** Draw the section into `doc` and wire it. Returns the switches by "site:behaviour" (the tests drive them). */
export function mount(doc, api) {
  const $ = (id) => doc.getElementById(id);
  const root = $('auto-read');
  if (!root) return null;
  const say = $('auto-status');
  const boxes = new Map();
  const quality = new Map();
  let state = null;

  // The disclosure — written from what the code does (autoRead.js DISCLOSURE).
  $('auto-disclosure-title').textContent = DISCLOSURE.title;
  const list = $('auto-disclosure-list');
  for (const k of ['intro', 'read', 'prepare', 'capture', 'fill', 'never']) {
    const p = doc.createElement('p');
    p.className = 'note';
    p.textContent = DISCLOSURE[k];
    list.append(p);
  }
  const agree = $('auto-agree');
  agree.textContent = DISCLOSURE.agree;

  const body = $('auto-sites-body');
  for (const id of DISPLAY_ORDER) {
    const site = siteById(id);
    const tr = doc.createElement('tr');
    const th = doc.createElement('th');
    th.setAttribute('scope', 'row');
    const name = doc.createElement('span');
    name.className = 'site-name';
    name.textContent = site.name;
    const hosts = doc.createElement('span');
    hosts.className = 'auto-hosts';
    hosts.textContent = site.origins.map(o => o.replace('https://', '').replace('/*', '')).join(' · ');
    const q = doc.createElement('span');
    q.className = 'auto-hosts';
    quality.set(id, q);
    th.append(name, hosts, q);
    tr.append(th);
    for (const b of BEHAVIOURS) {
      const td = doc.createElement('td');
      const box = doc.createElement('input');
      box.type = 'checkbox';
      box.disabled = true;
      box.setAttribute('aria-label', `${COLUMN[b]} automatically on ${site.name}`);
      box.addEventListener('change', () => {
        say.textContent = '';
        // ⛔ onSwitch asks Chrome FIRST — nothing may come between the click and the request.
        onSwitch(api, { siteId: id, behaviour: b, checked: box.checked }).then((r) => {
          if (!r?.ok) {
            say.textContent = r?.error === 'not_granted'
              ? `Chrome did not grant access to ${site.name}, so it stays off.`
              : 'That switch could not be changed.';
          } else {
            say.textContent = box.checked ? `${COLUMN[b]} is on for ${site.name}.` : `${COLUMN[b]} is off for ${site.name}.`;
          }
          return refresh();
        });
      });
      boxes.set(`${id}:${b}`, box);
      td.append(box);
      tr.append(td);
    }
    body.append(tr);
  }

  agree.addEventListener('click', async () => {
    const r = await api.runtime.sendMessage({ type: 'AUTO_READ_CONSENT', agree: true });
    say.textContent = r?.ok ? 'Thank you. Choose the sites below — each asks Chrome for its own access.' : 'Could not record that.';
    await refresh();
  });
  // ⭐ T31: every preset site in ONE prompt — the card's press, now here (shown until every one is granted)
  const all = $('auto-allow-all');
  if (all) {
    all.textContent = CARD.allow;
    all.addEventListener('click', () => {
      const asked = onConsentAll(api);                                  // ⛔ first: inside the gesture
      void asked.then((r) => { say.textContent = r.message || ''; return refresh(); }).catch(() => null);
    });
  }
  $('auto-kill').addEventListener('click', async () => {
    const r = await api.runtime.sendMessage({ type: 'AUTO_READ_KILL' });
    say.textContent = r?.ok ? 'Everything is off, and draft has given back its access to every site.' : 'Could not turn everything off.';
    await refresh();
  });
  $('auto-forget').addEventListener('click', async () => {
    const r = await api.runtime.sendMessage({ type: 'AUTO_READ_FORGET' });
    say.textContent = r?.ok ? 'What draft read is forgotten.' : 'Could not forget it.';
    await refresh();
  });

  // ⭐ T12 · the custom sites — redrawn from the state on every render (the list changes from the popup).
  const customBody = $('auto-custom-body');
  const removes = new Map();
  function renderCustom(s) {
    for (const k of [...boxes.keys()]) if (k.startsWith('https://')) boxes.delete(k);
    removes.clear();
    if (!customBody) return;
    customBody.textContent = '';
    const origins = Object.keys(s?.custom || {});
    const empty = $('auto-custom-empty');
    if (empty) empty.hidden = origins.length > 0;
    const table = $('auto-custom');
    if (table) table.hidden = !origins.length;
    for (const origin of origins) {
      const host = origin.replace('https://', '');
      const e = s.custom[origin];
      const tr = doc.createElement('tr');
      const th = doc.createElement('th');
      th.setAttribute('scope', 'row');
      const name = doc.createElement('span');
      name.className = 'site-name';
      name.textContent = host;
      const sub = doc.createElement('span');
      sub.className = 'auto-hosts';
      sub.textContent = e.frames.length ? `with ${e.frames.map(id => siteById(id)?.name).filter(Boolean).join(' · ')}'s form` : '';
      const last = (s.reads || []).find(r => r.host === host);
      const q = doc.createElement('span');
      q.className = 'auto-hosts';
      q.textContent = last ? `Last read ${hhmm(last.at)}: ${readQuality(last).line}` : '';
      th.append(name, sub, q);
      tr.append(th);
      for (const b of BEHAVIOURS) {
        const td = doc.createElement('td');
        const box = doc.createElement('input');
        box.type = 'checkbox';
        box.checked = !!e[b] && !!state?.customGranted?.[origin];
        box.setAttribute('aria-label', `${COLUMN[b]} automatically on ${host}`);
        box.addEventListener('change', () => {
          say.textContent = '';
          // ⛔ onSwitch asks Chrome FIRST (turning on) — the same rule as the preset sites.
          onSwitch(api, { origin, behaviour: b, checked: box.checked }).then((r) => {
            if (!r?.ok) say.textContent = r?.error === 'not_granted' ? `Chrome did not grant access to ${host}, so it stays off.` : 'That switch could not be changed.';
            else say.textContent = box.checked ? `${COLUMN[b]} is on for ${host}.` : `${COLUMN[b]} is off for ${host}.`;
            return refresh();
          });
        });
        boxes.set(`${origin}:${b}`, box);
        td.append(box);
        tr.append(td);
      }
      const td = doc.createElement('td');
      const rm = doc.createElement('button');
      rm.type = 'button';
      rm.className = 'link';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', `Remove ${host}`);
      rm.addEventListener('click', async () => {
        const r = await api.runtime.sendMessage({ type: 'AUTO_READ_REMOVE_SITE', origin });
        say.textContent = r?.ok ? `${host} is removed, and draft gave back its access there.` : `Could not remove ${host}.`;
        await refresh();
      });
      removes.set(origin, rm);
      td.append(rm);
      tr.append(td);
      customBody.append(tr);
    }
  }

  function render() {
    const s = state?.settings;
    // ⭐ D97 REVISED: the popup's one-time card is the same agreement as "I agree" here.
    const full = s?.consent?.scope === 'all' || !!s?.consent2;
    agree.hidden = full;
    const at = s?.consent2?.at ?? s?.consent?.at;
    $('auto-agreed').textContent = full ? `You agreed on ${hhmm(at)}.` : '';
    if ($('auto-allow-all')) $('auto-allow-all').hidden = SITES.every(site => !!state?.granted?.[site.id]);
    renderCustom(s);
    for (const site of SITES) {
      for (const b of BEHAVIOURS) {
        const box = boxes.get(`${site.id}:${b}`);
        const on = !!s?.sites?.[site.id]?.[b] && !!state.granted?.[site.id];
        box.checked = on;
        // ⛔ Before consent, nothing can be switched on (a switch already on can always be switched off).
        box.disabled = !on && !consentCovers(s, site.id, b);
      }
      const last = (s?.reads || []).find(r => r.site === site.id);
      quality.get(site.id).textContent = last ? `Last read ${hhmm(last.at)}${last.step ? ` · ${last.step}` : ''}: ${readQuality(last).line}` : '';
    }
    const reads = $('auto-reads-list');
    reads.textContent = '';
    for (const r of (s?.reads || []).slice(0, 10)) {
      const li = doc.createElement('li');
      li.textContent = `${r.host}${r.step ? ` · ${r.step}` : ''} · ${hhmm(r.at)} · ${readQuality(r).line}${r.labels.length ? ` — ${r.labels.join(' · ')}` : ''}`;
      reads.append(li);
    }
    $('auto-reads').hidden = !(s?.reads || []).length;
  }
  async function refresh() {
    state = (await api.runtime.sendMessage({ type: 'AUTO_READ_STATE' })) || null;
    render();
    return state;
  }
  // ⭐ T31: the site the dock's offer named — one switch, above the table, until it is chosen (or, for a site already
  // chosen, until the frame its form sits in is allowed too)
  const ask = hereFromSearch(doc.defaultView?.location?.search ?? globalThis.location?.search ?? '');
  const hereRow = $('auto-here-row');
  const ready = refresh().catch(() => null).then((st) => {
    if (!ask || !hereRow) return st;
    const entry = st?.settings?.custom?.[ask.origin] || null;
    const frames = entry ? ask.frames.filter(id => !entry.frames.includes(id)) : ask.frames;
    if (entry && !frames.length) return st;                               // nothing left to ask for
    const here = entry ? { ...ask, existing: true, frames, origins: frames.flatMap(id => siteById(id).origins) } : ask;
    const box = $('auto-here-box');
    const names = here.frames.map(id => siteById(id).name);
    $('auto-here-label').textContent = entry ? `Also read ${names.join(' and ')}'s form on ${here.host}` : `Always read ${here.host}`;
    $('auto-here-hint').textContent = entry ? `Chrome will ask for ${names.join(' and ')} — for this site's form only.` : ALWAYS.hint(here.host, names);
    hereRow.hidden = false;
    box.addEventListener('change', () => {
      if (!box.checked) return;
      const asked = onAlwaysHere(api, here);                                // ⛔ first: inside the gesture
      void asked.then((r) => { say.textContent = r.message || ''; if (r.ok) hereRow.hidden = true; else box.checked = false; return refresh(); }).catch(() => null);
    });
    return st;
  });
  return { boxes, removes, agree, ready, refresh };
}

/** ⭐ T29: the section as mounted on this page — Settings → Permissions redraws it when Chrome grants or removes a site. */
export const autoSection = { current: null };
if (typeof document !== 'undefined' && typeof chrome !== 'undefined') autoSection.current = mount(document, chrome);
