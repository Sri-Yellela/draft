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
import { SITES, DISPLAY_ORDER, BEHAVIOURS, DISCLOSURE, siteById, consentCovers, readQuality } from './autoRead.js';

export const COLUMN = Object.freeze({ read: 'Read', prepare: 'Prepare', capture: 'Capture', fill: 'Fill' });

/**
 * One switch changed. ⛔ The permission request is made SYNCHRONOUSLY, as this function's first chrome call, so it
 * stays inside the click's user gesture. Returns the service worker's answer.
 */
export function onSwitch(api, { siteId, behaviour, checked }) {
  const site = siteById(siteId);
  const asked = checked && site ? api.permissions.request({ origins: [...site.origins] }) : null;
  return (async () => {
    if (!site || !BEHAVIOURS.includes(behaviour)) return { ok: false, error: 'bad_switch' };
    if (checked) {
      let granted = false;
      try { granted = await asked; } catch { granted = false; }
      if (!granted) return { ok: false, error: 'not_granted' };
    }
    return (await api.runtime.sendMessage({ type: 'AUTO_READ_SET', site: siteId, behaviour, on: !!checked })) || { ok: false };
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

  function render() {
    const s = state?.settings;
    const full = s?.consent?.scope === 'all';
    agree.hidden = full;
    $('auto-agreed').textContent = full ? `You agreed on ${hhmm(s.consent.at)}.` : '';
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
  const ready = refresh().catch(() => null);
  return { boxes, agree, ready, refresh };
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') mount(document, chrome);
