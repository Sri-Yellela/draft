// extension/panelArrive.js — ⭐ D191 sketch 2 (owner 11-18: "alright go") · THE PANEL OPENS BY ITSELF ON JOB BOARDS.
//
// A content script on the six board families (the manifest's content_scripts, the same origins as autoRead.js SITES —
// granted at install, the owner's pick of 11-18). It reads NOTHING from the page and sends no address or text: it tells
// the service worker "a page finished loading on this tab", once per address (the boards' single-page navigation
// included). The worker decides — the person's "Open by itself" switch, the kill switch, a posting's shape — and draws
// the panel from the page first, then from draft's answer (background.js PANEL_ARRIVE).
(() => {
  'use strict';
  if (window.top !== window || globalThis.__draftPanelArrive) return;   // ⛔ the top frame only, once
  globalThis.__draftPanelArrive = true;
  let last = '';
  const arrive = () => {
    const here = location.href;
    if (here === last) return;
    last = here;
    try { chrome.runtime.sendMessage({ type: 'PANEL_ARRIVE' }, () => { void chrome.runtime.lastError; }); } catch { /* the extension was reloaded */ }
  };
  arrive();
  // Workday, Ashby and SmartRecruiters move between postings without a page load
  try { globalThis.navigation?.addEventListener?.('navigatesuccess', () => setTimeout(arrive, 400)); } catch { /* no Navigation API */ }
  addEventListener('popstate', () => setTimeout(arrive, 400));
})();
