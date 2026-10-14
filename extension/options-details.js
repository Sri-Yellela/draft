// ── ⭐ T6 (field report 10-14) · Options → "Show details" ──────────────────────────────────────────────────────────────
// Off unless ticked, and nothing about it is remembered (no storage key). Asks the service worker for its details
// (extension/diagnostics.js — named fields only, never a token, an answer value, a page's text or résumé text) and shows
// them as TEXT. "Copy details" puts the same text on the clipboard, for the owner to paste into a report.

const show = document.getElementById('details-show');
const body = document.getElementById('details-body');
const text = document.getElementById('details-text');
const status = document.getElementById('details-status');

async function load() {
  status.textContent = '';
  text.textContent = 'Reading…';
  const d = await chrome.runtime.sendMessage({ type: 'DIAGNOSTICS' }).catch(() => null);
  text.textContent = d ? JSON.stringify(d, null, 2) : 'The extension did not answer — reload it on chrome://extensions and try again.';
}

show.addEventListener('change', () => {
  body.hidden = !show.checked;
  if (show.checked) load(); else text.textContent = '';
});
document.getElementById('details-refresh').addEventListener('click', load);
document.getElementById('details-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(text.textContent || ''); status.textContent = 'Copied.'; }
  catch { status.textContent = 'Could not copy — select the text and copy it yourself.'; }
});
