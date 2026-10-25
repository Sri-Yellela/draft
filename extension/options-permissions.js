// ⭐ T29 (owner, 10-19) · Settings → PERMISSIONS — "any permission-related stuff … moves to the extension's SETTINGS
// PAGE, which opens when we have to change a setting." Owner 10-23: a permission is requested HERE (a web page cannot):
// the dock's popup that needs one opens this page at #permissions, and the one click below asks Chrome.
//
//   · one row per site, ONE switch: is draft allowed there? — the preset sites (Workday, Greenhouse, Lever, Ashby,
//     Workable, SmartRecruiters), the sites chosen with "Always read here", and any other site Chrome has granted
//   · ⛔ chrome.permissions.request is the FIRST chrome call of a switch's change handler — inside the click's gesture,
//     before any await; it is never called on load
//   · off: a preset site's access is given back by the service worker (AUTO_READ_REVOKE — its four switches off too, one
//     writer); a chosen site goes as "Remove" does (AUTO_READ_REMOVE_SITE); any other grant is removed here
//   · the two sections stay true to each other: Chrome's own onAdded / onRemoved redraw this list and the
//     automatic-reading table above it (options-auto.js)
import { SITES, DISPLAY_ORDER, siteById, originPattern, ANY_SITE_PATTERN } from './autoRead.js';
import { autoSection } from './options-auto.js';

/** A preset site's switch turned on: ⛔ the request is the first chrome call, synchronous, inside the gesture. */
export function onAllow(api, siteId) {
  const site = siteById(siteId);
  const asked = site ? api.permissions.request({ origins: [...site.origins] }) : null;
  return (async () => {
    if (!site) return { ok: false, error: 'bad_site' };
    try { return { ok: !!(await asked) }; } catch { return { ok: false }; }
  })();
}

/** Draw the section into `doc` and wire it. → { refresh, ready } */
export function mount(doc, api) {
  const $ = (id) => doc.getElementById(id);
  const body = $('perm-rows');
  if (!body) return null;
  const say = $('perm-status');
  const manifest = api.runtime.getManifest?.() || {};
  const required = new Set(manifest.host_permissions || []);
  const preset = new Set(SITES.flatMap(s => s.origins));

  const row = (name, checked, onChange, { note = '', id = '' } = {}) => {
    const r = doc.createElement('div');
    r.className = 'perm-row';
    const lab = doc.createElement('label');
    lab.className = 'switch';
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    if (id) box.dataset.permSite = id;
    box.setAttribute('aria-label', `Allow draft on ${name}`);
    const words = doc.createElement('span');
    words.className = 'perm-name';
    words.textContent = name;
    lab.append(box, words);
    r.append(lab);
    if (note) { const n = doc.createElement('span'); n.className = 'hint'; n.textContent = note; r.append(n); }
    box.addEventListener('change', () => onChange(box));
    body.append(r);
    return box;
  };
  const done = (text) => { if (say) { say.textContent = text; setTimeout(() => { if (say.textContent === text) say.textContent = ''; }, 5000); } };

  async function refresh() {
    const state = (await api.runtime.sendMessage({ type: 'AUTO_READ_STATE' })) || {};
    let all = [];
    try { all = (await api.permissions.getAll())?.origins || []; } catch { all = []; }
    body.textContent = '';
    for (const id of DISPLAY_ORDER) {
      const site = siteById(id);
      row(site.name, !!state.granted?.[id], (box) => {
        if (box.checked) {
          const asked = onAllow(api, id);                              // ⛔ first: inside the gesture
          void asked.then((r) => { done(r.ok ? `draft is allowed on ${site.name}.` : `Chrome did not allow ${site.name}.`); return refresh(); });
          return;
        }
        void api.runtime.sendMessage({ type: 'AUTO_READ_REVOKE', site: id }).then((r) => {
          done(r?.kept ? `${site.name} stays allowed — a site you chose reads its form.` : `draft is no longer allowed on ${site.name}.`);
          return refresh();
        });
      }, { id });
    }
    const chosen = Object.keys(state.settings?.custom || {});
    for (const origin of chosen) {
      row(origin.replace(/^https:\/\//, ''), !!state.customGranted?.[origin], (box) => {
        if (box.checked) {
          const asked = api.permissions.request({ origins: [originPattern(origin)] });   // ⛔ first: inside the gesture
          void Promise.resolve(asked).catch(() => false).then(() => refresh());
          return;
        }
        void api.runtime.sendMessage({ type: 'AUTO_READ_REMOVE_SITE', origin }).then(() => refresh());
      }, { note: 'Always read here' });
    }
    const chosenPatterns = new Set(chosen.map(originPattern));
    for (const pattern of all.filter(o => !required.has(o) && !preset.has(o) && !chosenPatterns.has(o) && o !== ANY_SITE_PATTERN)) {
      row(pattern.replace(/^https:\/\//, '').replace(/\/\*$/, ''), true, (box) => {
        if (box.checked) return;
        void Promise.resolve(api.permissions.remove({ origins: [pattern] })).catch(() => false).then(() => refresh());
      });
    }
    return state;
  }

  // Chrome's own word on a grant or a removal — from this page, the popup, or the worker — redraws both sections
  const both = () => { void refresh(); void autoSection.current?.refresh?.(); };
  try { api.permissions.onAdded?.addListener(both); api.permissions.onRemoved?.addListener(both); } catch { /* an older Chrome */ }
  const ready = refresh().catch(() => null);
  return { refresh, ready };
}

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') mount(document, chrome);
