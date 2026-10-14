// extension/autoReadWatcher.js — ⭐ D97 · the step watcher. A CLASSIC content script (no imports, no exports).
//
// Registered by extension/autoRead.js (chrome.scripting.registerContentScripts) ONLY for a site the user switched on in
// Options AND Chrome granted — never declared in the manifest, never on LinkedIn, Indeed or Glassdoor (excludeMatches).
//
// Workday changes steps without changing the address, so a page load is not enough: this watches the page and says
// "the step changed" — debounced, so ten rapid re-renders make ONE message (a trailing 800 ms, at most 3 s after the
// first change of a burst). ⛔ It READS NO VALUE: the signature is the page's origin + path, the step's NAME and the
// NUMBER of controls. ⛔ It makes no network request and sends nothing outside the extension. Everything that follows
// (the read, prepare, capture, fill) is decided by the service worker, which re-checks the switch and Chrome's grant
// on every message — a watcher left in a tab after its site was switched off is ignored there.
(function draftAutoReadWatcher() {
  if (window.__draftAutoReadWatcher) return;
  window.__draftAutoReadWatcher = true;

  var TRAILING_MS = 800;
  var MAX_WAIT_MS = 3000;
  var CONTROLS = 'input, select, textarea, [role="combobox"], [contenteditable=""], [contenteditable="true"], button[aria-haspopup="listbox"]';

  function stepName() {
    var el = document.querySelector('[data-automation-id="progressBarActiveStep"], [aria-current="step"]')
      || document.querySelector('[data-automation-id="pageHeader"]');
    return String((el && el.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function signature() {
    // Counts and a name — never what a control holds.
    var n = document.querySelectorAll(CONTROLS).length;
    return location.origin + location.pathname + '|' + stepName() + '|' + n;
  }

  var last = null;
  var timer = null;
  var burstStart = 0;
  var observer = null;
  var stopped = false;

  function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    if (observer) observer.disconnect();
  }
  function send(sig) {
    try {
      var p = chrome.runtime.sendMessage({ type: 'AUTO_READ_PAGE', signature: sig });
      if (p && typeof p.catch === 'function') p.catch(function () { /* the worker is restarting; the next change asks again */ });
    } catch (e) {
      stop();   // the extension was updated or removed: this copy is orphaned
    }
  }
  function flush() {
    timer = null;
    burstStart = 0;
    if (stopped) return;
    var sig = signature();
    if (sig === last) return;      // a re-render that did not change the step: nothing
    last = sig;
    send(sig);
  }
  function schedule() {
    if (stopped) return;
    var now = Date.now();
    if (!burstStart) burstStart = now;
    if (timer) clearTimeout(timer);
    var wait = Math.max(0, Math.min(TRAILING_MS, burstStart + MAX_WAIT_MS - now));
    timer = setTimeout(flush, wait);
  }
  function start() {
    stopped = false;
    observer = new MutationObserver(schedule);
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    schedule();
  }

  window.addEventListener('pagehide', stop);
  // Back from the back/forward cache: the same document again, watched again.
  window.addEventListener('pageshow', function (e) { if (e && e.persisted && stopped) { last = null; start(); } });
  start();
})();
