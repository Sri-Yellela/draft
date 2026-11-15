// extension/runner.js — ⭐ A211 (1a) · the runner tab (runner.html). The rules are runnerModel.js's; the work is the worker's
// (background.js RUNNER_* messages — accepted from this page only). ⛔ "Send all" sends only on the person's own trusted
// press, and only the rows that read Ready; Fill never sends.
import { rowsFromPackets, originPatterns, stateAfterFill, stateAfterSend, sendable, summaryLine } from './runnerModel.js';
import { isExtensionSubmitPacket } from './extensionSubmit.js';
import { tinySvg } from './tinyMascot.js';

const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((resolve) => { try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r ?? null); }); } catch { resolve(null); } });
const say = (t) => { $('runner-status').textContent = t || ''; };
$('runner-face').innerHTML = tinySvg({ size: 30 });

let rows = [];
function draw() {
  const list = $('runner-rows');
  list.replaceChildren(...rows.map(r => {
    const li = document.createElement('li');
    li.className = 'row'; li.dataset.state = r.state; li.dataset.packet = r.packetId;
    const who = document.createElement('div');
    who.append(Object.assign(document.createElement('b'), { textContent: r.company }), document.createElement('br'), Object.assign(document.createElement('span'), { className: 'sub', textContent: r.title }));
    const st = Object.assign(document.createElement('span'), { className: 'state', textContent: r.state.replace('_', ' ') });
    li.append(who, st);
    if (r.note) li.append(Object.assign(document.createElement('p'), { className: 'note', textContent: r.note }));
    if (r.tabId != null && (r.state === 'needs_you' || r.state === 'failed' || r.state === 'ready')) {
      const open = Object.assign(document.createElement('button'), { className: 'btn open', type: 'button', textContent: r.state === 'ready' ? 'Check it' : 'Open it' });
      open.dataset.open = r.packetId;
      open.addEventListener('click', () => send({ type: 'RUNNER_FOCUS', tabId: r.tabId }));
      li.append(open);
    }
    return li;
  }));
  $('runner-sum').textContent = summaryLine(rows);
  $('runner-send').disabled = sendable(rows).length === 0;
  $('runner-send').textContent = sendable(rows).length ? `Send all ${sendable(rows).length} ready` : 'Send all ready';
  $('runner-fill').disabled = !rows.some(r => r.state === 'waiting' || r.state === 'failed');
}
const set = (r, patch) => { Object.assign(r, patch); draw(); };

async function load() {
  say('Reading what is waiting…');
  const got = await send({ type: 'RUNNER_LIST' });
  if (!got?.ok) { rows = []; draw(); say(got?.message || 'Sign in to draft in this browser, then Refresh.'); return; }
  const keep = new Map(rows.map(r => [String(r.packetId), r]));
  rows = rowsFromPackets(got.packets, isExtensionSubmitPacket).map(r => keep.get(String(r.packetId)) || r);
  draw(); say('');
}

// Fill all — the person's click asks Chrome for these applications' own sites (once), then fills each in a background tab
$('runner-fill').addEventListener('click', async (e) => {
  if (!e.isTrusted) return;
  const todo = rows.filter(r => r.state === 'waiting' || r.state === 'failed');
  if (!todo.length) return;
  const origins = originPatterns(todo);
  const granted = origins.length ? await chrome.permissions.request({ origins }).catch(() => false) : true;
  if (!granted) { say('draft needs your permission to open these application sites in background tabs — nothing was filled.'); return; }
  for (const r of todo) {
    set(r, { state: 'opening', note: 'Opening the application…' });
    const res = await send({ type: 'RUNNER_FILL', packetId: r.packetId, applyUrl: r.applyUrl, tabId: r.tabId });
    if (res?.tabId != null) r.tabId = res.tabId;
    set(r, stateAfterFill(res?.result || res));
  }
  say(sendable(rows).length ? 'Check any you like with “Check it”, then Send all.' : '');
});

// Send all — ONE trusted press sends exactly the rows that read Ready, one after another, each confirmation read back
$('runner-send').addEventListener('click', async (e) => {
  if (!e.isTrusted) return;   // ⛔ a script's click sends nothing
  const batch = sendable(rows);
  for (const r of batch) {
    set(r, { state: 'sending', note: 'Sending from your browser…' });
    const res = await send({ type: 'RUNNER_SEND', tabId: r.tabId, packetId: r.packetId, trusted: true });
    set(r, stateAfterSend(res));
  }
  say(`${batch.filter(r => r.state === 'sent').length} of ${batch.length} sent.`);
});
$('runner-refresh').addEventListener('click', () => load());
await load();
globalThis.__runnerReady = true;
