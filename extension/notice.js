// extension/notice.js — ⭐ D191 (46o) · the disclosure page's two buttons (notice.html). Nothing is stored: the page opens
// once per install / update (background.js onInstalled → toolbarPress.js noticeDue).
const $ = (id) => document.getElementById(id);
$('notice-ok').addEventListener('click', () => window.close());
$('notice-settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
