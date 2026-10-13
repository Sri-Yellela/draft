// ⭐ D96 §3 · THE POPUP REMEMBERS — where this tab's job stands, and the jobs in progress.
//
// Owner, 10-13: "close the popup or reload and it is zero." Opening the popup now shows what the browser already
// REMEMBERS (extension/progress.js): the job this tab is linked to (extension/tabBinding.js) and how far it got —
// "Captured 10:41 · Page read 10:42 · Answers prepared · Filled 14 of 18 · 2 need you" — and the last five jobs in
// progress, each opening its posting (or the job on draft) on a click.
//
// ⛔ D23 holds: this reads two of the extension's OWN storage areas and the tab's address the browser handed the
// popup. It injects nothing into the page, asks the service worker nothing and the server nothing, and writes nothing.
// ⛔ Every string is textContent. A link opens only an http(s) address the record holds.
import { progress, progressLine, standWords, jobLabel } from './progress.js';
import { bindingForTab } from './tabBinding.js';
import { cachedIdentity } from './auth.js';

const webUrl = (u) => { try { return /^https?:$/.test(new URL(u).protocol) ? u : null; } catch { return null; } };

/** Paint the two blocks. Returns what it showed, for the tests. Never throws. */
export async function renderProgress(doc = globalThis.document, now = Date.now()) {
  const shown = { current: null, list: [] };
  try {
    // Signed out, or the records belong to another account: show nothing (they are cleared on the next check-in).
    const id = await cachedIdentity();
    if (!id?.authenticated) return shown;
    const owner = await progress.owner();
    if (owner && id.username && owner !== id.username) return shown;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const bound = tab ? await bindingForTab(tab) : null;
    const current = bound ? await progress.get({ jobId: bound.jobId }) : null;
    if (current) {
      const box = doc.getElementById('progress');
      doc.getElementById('progress-job').textContent = jobLabel(current);
      doc.getElementById('progress-line').textContent = progressLine(current, now) || 'Linked to this tab';
      box.hidden = false;
      shown.current = current.jobId;
    }

    const items = await progress.list();
    const ul = doc.getElementById('in-progress-list');
    ul.textContent = '';
    for (const r of items) {
      const li = doc.createElement('li');
      if (current && r.jobId === current.jobId) li.className = 'here';
      const name = doc.createElement('span');
      name.className = 'ip-job';
      name.textContent = jobLabel(r);
      const where = doc.createElement('span');
      where.className = 'ip-where';
      where.textContent = standWords(r);
      li.append(name, where);
      const url = webUrl(r.postingUrl) || webUrl(r.link);
      if (url) {
        const open = doc.createElement('button');
        open.className = 'link';
        open.textContent = 'Open';
        open.setAttribute?.('aria-label', `Open ${jobLabel(r)}`);
        open.addEventListener('click', () => { chrome.tabs.create({ url }); setTimeout(() => globalThis.window?.close?.(), 300); });
        li.append(open);
      }
      ul.append(li);
      shown.list.push(r.jobId);
    }
    doc.getElementById('in-progress').hidden = items.length === 0;
  } catch { /* the popup paints without it */ }
  return shown;
}

if (typeof document !== 'undefined' && document.getElementById?.('in-progress')) void renderProgress();
