// ⭐ D64 · the switch for AUTOMATED CAPTURE — off by default.
//
// Turning it ON asks Chrome, at this click, for host access to the public job-posting hosts in
// AUTO_CAPTURE_ORIGINS (chrome.permissions.request must run inside a user gesture on an extension page —
// which is why the switch lives here and not in the popup's first paint). Chrome shows its own prompt
// naming those sites; refusing it leaves the setting off. Turning it OFF removes that access again
// (chrome.permissions.remove) — the extension is back to reading a page only when you point it at one.
import { AUTO_CAPTURE_SETTING, AUTO_CAPTURE_ORIGINS, setAutoCaptureSetting } from './autoCapture.js';

const box = document.getElementById('auto-capture');
const say = document.getElementById('auto-status');
const hosts = document.getElementById('auto-hosts');

hosts.textContent = AUTO_CAPTURE_ORIGINS.map(o => o.replace('https://', '').replace('/*', '')).join(' · ');

async function current() {
  const { [AUTO_CAPTURE_SETTING]: on } = await chrome.storage.local.get(AUTO_CAPTURE_SETTING);
  const granted = await chrome.permissions.contains({ origins: [...AUTO_CAPTURE_ORIGINS] });
  return !!on && granted;
}

box.addEventListener('change', async () => {
  say.textContent = '';
  if (box.checked) {
    let granted = false;
    try { granted = await chrome.permissions.request({ origins: [...AUTO_CAPTURE_ORIGINS] }); } catch { granted = false; }
    if (!granted) {
      box.checked = false;
      say.textContent = 'Chrome did not grant access to those sites, so automatic capture stays off.';
      return;
    }
    await setAutoCaptureSetting(true);
    say.textContent = 'On. Job pages you open on these sites are checked against your board and added when they fit.';
  } else {
    await setAutoCaptureSetting(false);
    try { await chrome.permissions.remove({ origins: [...AUTO_CAPTURE_ORIGINS] }); } catch { /* already gone */ }
    say.textContent = 'Off. The extension reads a page only when you press capture.';
  }
});

current().then(on => { box.checked = on; }).catch(() => { box.checked = false; });
