// ⭐ D64 · "Captured today: N" — the automatic captures, with an undo per item.
//
// Shown only while automatic capture is switched on (a local storage read — nothing goes to the server
// when the popup opens, D23). The list is asked for when the user OPENS it, through the background
// worker (AUTO_CAPTURES), and each Undo takes the posting off their board (AUTO_CAPTURE_UNDO).
import { AUTO_CAPTURE_SETTING } from './autoCapture.js';

const box = document.getElementById('auto-today');
const head = document.getElementById('auto-today-head');
const list = document.getElementById('auto-today-list');
const ask = (msg) => new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));

function row(c) {
  const li = document.createElement('li');
  const text = document.createElement('span');
  text.textContent = [c.title, c.company].filter(Boolean).join(' · ') || c.url || c.jobId;
  const undo = document.createElement('button');
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
  if (!r) { list.append(Object.assign(document.createElement('li'), { textContent: 'Sign in to see them.' })); return; }
  for (const c of caps) list.append(row(c));
}

chrome.storage.local.get(AUTO_CAPTURE_SETTING).then(({ [AUTO_CAPTURE_SETTING]: on }) => {
  if (!on) return;
  box.hidden = false;
  box.addEventListener('toggle', () => { if (box.open) void load(); });
}).catch(() => {});
