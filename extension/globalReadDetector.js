// extension/globalReadDetector.js — ⭐⭐ D112 item 4 (T35 = A) · GLOBAL READ's content script. A CLASSIC script.
//
// Registered for https://*/* — in every frame, after jobSignals.js — by autoRead.js desiredRegistrations, and ONLY
// while the user has said Allow on the ONE global ask (D112 b2) and Chrome grants the optional https://*/* pattern.
// Never on LinkedIn, Indeed or Glassdoor, never on draft's own site (excludeMatches; and jobSignals.js refuses them).
//
// ONE idle check, then a re-check only when the page itself navigates (popstate · hashchange · the Navigation API's
// navigatesuccess, at most once a second) and once, 2.5 s after load, for a page that renders late. No
// MutationObserver, no timer beyond that one, nothing read beyond jobSignals.js's checks.
// ⛔ A page that is not a job page: it sends NOTHING (no message, no request, no storage) — not its address, not a hash.
// ⭐ A job page: ONE message to the service worker (AUTO_READ_DETECTED, carrying only the reason word), which re-checks
//   the switch and Chrome's grant and starts the step watcher (autoReadWatcher.js) in this frame. Then this stops.
(function draftGlobalReadDetector() {
  if (window.__draftGlobalReadDetector) return;
  window.__draftGlobalReadDetector = true;
  var top = window.top === window;
  var done = false;
  var lastCheck = 0;

  function check() {
    if (done) return;
    var now = Date.now();
    if (now - lastCheck < 1000) return;
    lastCheck = now;
    var signals = typeof globalThis.__draftJobSignals === 'function' ? globalThis.__draftJobSignals(document, location, top) : null;
    if (!signals || !signals.job) return;   // ⛔ not a job page: nothing at all
    done = true;
    try {
      var p = chrome.runtime.sendMessage({ type: 'AUTO_READ_DETECTED', why: String(signals.why || '') });
      if (p && typeof p.catch === 'function') p.catch(function () { done = false; });
    } catch (e) { /* the extension was updated or removed: this copy is orphaned */ }
  }

  check();
  if (done) return;
  // a sub-frame of a site no ATS list names never becomes one: one check is all it gets
  if (!top) return;
  setTimeout(check, 2500);
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  try { if (window.navigation && window.navigation.addEventListener) window.navigation.addEventListener('navigatesuccess', check); } catch (e) { /* older Chrome */ }
})();
