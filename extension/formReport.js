// ── D55: the right-click menu (decision B) and "Report this form" (decision E) ─────────────────
//
// docs/AUTOFILL_TARGET.md §8.4 B and E, decided 10-07. Kept in its own module so background.js,
// popup.js and gated-handoff.js — which other work edits in parallel — change by a few lines only.
//
// Everything here except collectFormLabels() is PURE: no chrome.*, no DOM, no network. The tests
// import it directly.

// ── Decision B · the menu ───────────────────────────────────────────────────────────────────
// Two items, created once by chrome.runtime.onInstalled. A context-menu click is a user gesture,
// and Chrome grants activeTab for the tab it was made on — so "Save this page" is the SAME capture
// the toolbar button and Ctrl+Shift+K run (captureActiveTab), not a fourth implementation.
// "Save link" reads no page at all: it sends the link's address, and the server refetches the
// posting from the ATS's own listing, or refuses (routes/importJob.js POST /link).
export const MENU_SAVE_PAGE = 'draft-save-page';
export const MENU_SAVE_LINK = 'draft-save-link';
export const CONTEXT_MENUS = Object.freeze([
  Object.freeze({ id: MENU_SAVE_PAGE, title: 'Save this page to draft', contexts: Object.freeze(['page']) }),
  Object.freeze({
    id: MENU_SAVE_LINK, title: 'Save link to draft', contexts: Object.freeze(['link']),
    // Only web links are offered at all; which of them draft can refetch is the SERVER's call.
    targetUrlPatterns: Object.freeze(['http://*/*', 'https://*/*']),
  }),
]);

/** The link a "Save link" click may send: an http(s) URL, or null. Nothing else leaves. */
export function saveableLink(raw) {
  try {
    const u = new URL(String(raw || ''));
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch { return null; }
}

// ── Decision E · "Report this form" ─────────────────────────────────────────────────────────
// ⛔ HOST + FIELD LABELS. NEVER A VALUE, NEVER THE PATH OR QUERY.
//
// The host comes from the tab's URL in the service worker (reportHostOf), never from the page —
// and only the hostname: an application URL's path and query carry requisition ids, tokens and,
// on some portals, the candidate's email. The labels come from collectFormLabels(), injected under
// the activeTab grant the popup's click created. The server (services/formReports.js) refuses any
// key but host, labels, fieldCount and extensionVersion, and scrubs value-shaped label text again.

/** The bare hostname of an http(s) page, or null. */
export function reportHostOf(tabUrl) {
  try {
    const u = new URL(String(tabUrl || ''));
    return /^https?:$/.test(u.protocol) && u.hostname ? u.hostname.toLowerCase() : null;
  } catch { return null; }
}

/**
 * The body sent to POST /api/form-reports — built here, and only from these four things.
 * @param {{ host: string, collected: { labels?: unknown[], fieldCount?: number }, version?: string|null }} args
 */
export function buildFormReport({ host, collected, version = null }) {
  const labels = (Array.isArray(collected?.labels) ? collected.labels : [])
    .filter((l) => typeof l === 'string')
    .map((l) => l.replace(/\s+/g, ' ').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 200);
  return {
    host,
    labels,
    fieldCount: Number.isInteger(collected?.fieldCount) ? collected.fieldCount : labels.length,
    extensionVersion: typeof version === 'string' ? version : null,
  };
}

/**
 * INJECTED into the page by chrome.scripting.executeScript — so it must be self-contained: no
 * imports, no module-scope helpers (an injected function is serialised alone).
 *
 * Reads the form's LABELS only. ⛔ It never reads a control's value, checked state or selection:
 * a label's text is taken from a CLONE of the label with every control inside it removed first,
 * because a <label> that wraps its input, a <select> or a contenteditable answer box would
 * otherwise carry the candidate's own words in its textContent. Password fields are not counted.
 */
export function collectFormLabels() {
  const form = document.querySelector('form');
  const scope = form || document;
  const CONTROLS = 'input, select, textarea, [role="combobox"], [contenteditable=""], [contenteditable="true"]';
  const INSIDE = 'input, select, textarea, option, [role="combobox"], [role="listbox"], [role="option"], [contenteditable=""], [contenteditable="true"]';
  const controls = [...scope.querySelectorAll(CONTROLS)].filter(
    (el) => !['hidden', 'submit', 'button', 'image', 'reset', 'password'].includes((el.type || '').toLowerCase())
  );
  const textWithoutControls = (node) => {
    const copy = node.cloneNode(true);
    copy.querySelectorAll(INSIDE).forEach((n) => n.remove());
    return (copy.textContent || '').replace(/\s+/g, ' ').trim();
  };
  const labelOf = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return textWithoutControls(l);
    }
    const wrap = el.closest('label');
    if (wrap) return textWithoutControls(wrap);
    return (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
  };
  const labels = controls.map(labelOf).map((t) => t.slice(0, 120)).filter(Boolean);
  return { labels, fieldCount: controls.length };
}
