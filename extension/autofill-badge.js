/**
 * D55 (c) · (g) · (l) — the autofill badge, and the required-field pre-check it is driven by.
 * ---------------------------------------------------------------------------------------------
 * AUTOFILL_TARGET.md §2 and §7.6 (DECIDED 10-07): ONE line on the page, no panel —
 *
 *   "Autofill in progress…"          fields are being filled, the wizard is being advanced
 *   "Complete required fields"       everything the extension will fill is filled, and a REQUIRED
 *                                    question is still empty — it is the candidate's to answer
 *   "Filled — review and submit"     the page is done; the last click is the candidate's
 *
 * plus §8.3's fourth sentence, which is a refusal rather than a progress state:
 *
 *   "This form isn't recognised — nothing was filled"
 *
 * The review overlay (review-overlay.js) is unchanged and still the detailed review; the badge
 * replaces nothing. It is painted ONLY with the site's tokens (extension/tokens.js via meta.theme,
 * as the overlay is) — no colour literal (test/colorLiteralGuard.test.js) — inside a shadow root, so
 * neither the page's CSS nor a form probe can reach into it.
 *
 * WHY A PRE-CHECK AT ALL (§8.2 #3). Workday writes its own red "is required" text when Save and
 * Continue is pressed; Greenhouse validates ONLY ON SUBMIT, which the extension never presses. So the
 * extension has to find the empty required fields itself: `required`, aria-required="true" (on the
 * control or its radio group), or an asterisked label — which on many forms is the only signal.
 *
 * The × dismisses the badge and STOPS the wizard advance (it leaves data-dismissed on the host, which
 * the advance loop reads). It never touches the form.
 *
 * ⭐ T17: the badge is the DOCK's status line (extension/dock.js), in the TOP frame — never inside a child frame. The
 * required-field pre-check runs in the FORM's frame and reaches it through the service worker.
 *
 * Every function below is serialised into the page by executeScript and closes over nothing.
 */

export const BADGE_ID = 'rm-draft-autofill-badge';

export const BADGE_TEXT = Object.freeze({
  progress: 'Autofill in progress…',
  required: 'Complete required fields',
  done: 'Filled — review and submit',
  unrecognised: "This form isn't recognised — nothing was filled",
  // ⭐ D97 (J5): the automatic READ's small line — "14 of 18 fields recognised — good read", or with answers prepared
  // "… — press Ctrl+Shift+Y". Its words arrive as meta.text (extension/autoRead.js readBadgeText); this is the fallback.
  // Not a fill state: dismissing it never stops a fill (no stop signal is left).
  ready: 'Read by draft',
});

// ── Injected: the required-field pre-check (g). ISOLATED world, read-only. ─────────────────────
// Reports LABELS of empty required controls — never a value. `emptyness` is read, not content.
//
// ⭐ T17: ONE copy. It runs in the FORM's frame — injected by the fill, and by the service worker each time the dock's
// status line re-counts (DOCK_MISSING_REQUIRED). renderBadge, in the top frame, holds no copy of it any more.
export function findMissingRequired() {
  const root = document.querySelector('[data-automation-id="applyFlowPage"]') || document.querySelector('form') || document.body;
  const ours = (el) => !!el.closest('#rm-gate-review-overlay, #rm-draft-autofill-badge, [data-draft-dock]');
  const textOf = (el) => String(el?.textContent || '').replace(/\s+/g, ' ').trim();
  const idsText = (ids) => String(ids || '').split(/\s+/).filter(Boolean).map(id => textOf(document.getElementById(id))).join(' ');
  const labelEl = (el) => (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label')
    || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby').split(/\s+/)[0]))
    || el.closest('[role="radiogroup"], fieldset')?.querySelector('legend')
    || el.closest('[role="group"]')?.querySelector('[id]');
  const starred = (l) => !!l && (!!l.querySelector?.('abbr[title="required" i], .required, [data-required="true"]') || /\*\s*$/.test(textOf(l)));
  const group = (el) => el.closest('[role="radiogroup"], fieldset');
  const isRequired = (el) => el.required === true || el.getAttribute('aria-required') === 'true'
    || group(el)?.getAttribute('aria-required') === 'true' || starred(labelEl(el));
  const box = (el) => el.closest('[data-automation-id^="formField"], [role="group"], fieldset') || el.parentElement;
  const isEmpty = (el) => {
    const type = String(el.type || '').toLowerCase();
    if (type === 'radio') return !root.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`);
    if (type === 'checkbox') return !el.checked;
    if (type === 'file') return !(el.files && el.files.length) && !box(el)?.querySelector('[data-automation-id="file-upload-successful"]');
    if (el.tagName === 'INPUT' && (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list')) {
      return !box(el)?.querySelector('[data-automation-id="selectedItem"], [role="listitem"]') && !String(el.value || '').trim();
    }
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA' &&
        (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox')) {
      const t = textOf(el);
      return !t || /^(select|choose|please|--)/i.test(t);
    }
    if (el.isContentEditable) return !textOf(el);
    return !String(el.value ?? '').trim();
  };
  const seen = new Set();
  const out = [];
  for (const el of root.querySelectorAll('input, select, textarea, [role="combobox"], button[aria-haspopup="listbox"], [contenteditable="true"]')) {
    const type = String(el.type || '').toLowerCase();
    if (ours(el) || ['hidden', 'submit', 'image', 'reset'].includes(type)) continue;
    if (el.tagName === 'BUTTON' && el.getAttribute('aria-haspopup') !== 'listbox') continue;
    if (el.disabled || el.closest('[hidden], [aria-hidden="true"]')) continue;
    if (!isRequired(el) || !isEmpty(el)) continue;
    const key = type === 'radio' ? `radio:${el.name}` : el;
    if (seen.has(key)) continue;
    seen.add(key);
    const raw = type === 'radio' ? textOf(group(el)?.querySelector('legend')) || idsText(group(el)?.getAttribute('aria-labelledby'))
      : textOf(labelEl(el)) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    out.push({ label: raw.replace(/\*\s*$/, '').trim().slice(0, 160) || '(unlabelled field)' });
  }
  return out;
}

// ── Injected: the badge — THE DOCK'S STATUS LINE. ISOLATED world, TOP frame (it never needs the page's JS). ──────────
// ⭐ T17: the badge is no longer a box of its own floating over the form (in a child frame it was cut off by the frame's
// edge). It is the dock's ONE status line (extension/dock.js, slot "status"): under the dock's header, and the words of
// the slim bar when the dock is collapsed. A dock that does not exist yet is opened COLLAPSED for it — a slim bar, as
// small as the badge was. The required-field count is read where the form is: the service worker runs
// findMissingRequired in the form's frame (DOCK_MISSING_REQUIRED) — this function never reads the page's fields.
/**
 * @param {'progress'|'required'|'done'|'unrecognised'|'ready'} state
 * @param {object} meta  { theme: { light, dark }, dock, missing: [{label}], live: boolean, note?: string, text?: string }
 *   live — single-page forms: the line re-counts (the service worker reads the form again every 1.5 s, and at once on the
 *   top page's own input/change) and flips itself from "Complete required fields" to "Filled — review and submit" when
 *   the candidate has answered. On a wizard the advance loop drives it instead.
 */
export function renderBadge(state, meta) {
  const ID = 'rm-draft-autofill-badge';
  const TEXT = {
    progress: 'Autofill in progress…',
    required: 'Complete required fields',
    done: 'Filled — review and submit',
    unrecognised: "This form isn't recognised — nothing was filled",
    ready: 'Read by draft',
  };
  const D = globalThis.__draftDock;
  if (!D?.ensure) return { rendered: false, error: 'no_dock' };
  const fresh = !D.current?.();
  const dock = D.ensure(fresh ? { ...(meta?.dock || {}), place: { ...(meta?.dock?.place || {}), collapsed: true } } : (meta?.dock || {}));
  if (!dock) return { rendered: false, error: 'not_top_frame' };
  const send = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (reply) => { void chrome.runtime.lastError; resolve(reply ?? null); }); } catch { resolve(null); }
  });

  let host = document.getElementById(ID);
  if (host?.dataset.dismissed === '1') return { rendered: false, dismissed: true };
  // D97: the read's line never paints over a fill's own state (progress · required · done · unrecognised).
  if (state === 'ready' && host?.dataset.state && host.dataset.state !== 'ready' && host.shadowRoot?.innerHTML) return { rendered: false, busy: true };
  host = dock.status({ id: ID });
  if (!host.shadowRoot) host.attachShadow({ mode: 'open' });
  clearInterval(Number(host.dataset.timer || 0));
  const root = host.shadowRoot;
  const theme = meta?.theme || {};
  const varsOf = (pal) => Object.entries(pal || {})
    .map(([k, v]) => `--c-${k.toLowerCase().replace(/_/g, '-')}: ${v};`).join(' ');

  const paint = (s, missing) => {
    host.dataset.state = s;
    host.dataset.missing = String(missing.length);
    host.hidden = false;
    const tone = { progress: 'violet', required: 'warning', done: 'success', unrecognised: 'danger', ready: 'info' }[s] || 'info';
    const label = s === 'required' && missing.length ? `${TEXT.required} (${missing.length})`
      : s === 'ready' ? String(meta?.text || TEXT.ready).slice(0, 140) : (TEXT[s] || '');
    // the dock's slim bar says it too, when no fill has drawn its counts yet
    dock.statusText(label);
    // ⭐ D63 (1): the state reads by colour AND by icon, so it never depends on colour alone.
    const ICON = {
      progress: '<path d="M6 12h.01M12 12h.01M18 12h.01"/>',
      required: '<path d="M12 6v8M12 18h.01"/>',
      done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
      unrecognised: '<path d="M6 6l12 12M18 6L6 18"/>',
      ready: '<path d="M7 4h7l4 4v12H7zM10 12h5M10 16h5"/>',
    }[s] || '<path d="M12 6v8M12 18h.01"/>';
    root.innerHTML = `
      <style>
        :host { ${varsOf(theme.light)} all: initial; display: block; }
        @media (prefers-color-scheme: dark) { :host { ${varsOf(theme.dark)} } }
        :host([hidden]) { display: none; }
        /* ⛔ D60 / D63 (1): a DEPTH BOX, never a capsule — extension-latest.html's .barb. */
        .bar { display: flex; align-items: center; gap: 10px; padding: 6px 8px;
          border-radius: 12px; border: 1px solid var(--c-glass-edge); border-left: 4px solid var(--c-${tone});
          box-shadow: var(--c-depth-rest);
          font: 600 12.5px/1.3 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
          background: var(--c-surface-solid); color: var(--c-ink); }
        .st { width: 26px; height: 26px; flex: none; border-radius: 8px; display: grid; place-items: center;
          background: var(--c-${tone}-quiet); color: var(--c-${tone}); }
        .st svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
        .t { flex: 1; min-width: 0; cursor: ${s === 'required' ? 'pointer' : 'default'}; }
        .n { font-family: 'Poppins', 'DM Sans', ui-sans-serif, sans-serif; font-size: 11px; font-style: italic; font-weight: 800;
          border-radius: 6px; padding: 3px 7px; background: var(--c-${tone}-quiet); color: var(--c-${tone}); }
        .x { font: inherit; font-size: 14px; border: 0; cursor: pointer; width: 26px; height: 26px; flex: none; border-radius: 8px;
          background: var(--c-surface-2); color: var(--c-ink-muted); box-shadow: var(--c-depth-rest); }
        .x:hover, .x:focus-visible { box-shadow: var(--c-depth-hover); color: var(--c-ink); }
        .x:focus-visible, .t:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
        @media (prefers-reduced-motion: no-preference) { .bar[data-s="progress"] .st { animation: p 1.2s ease-in-out infinite; } }
        @keyframes p { 50% { opacity: .45; } }
      </style>
      <div class="bar" data-s="${s}" role="status" aria-live="polite">
        <span class="st" data-role="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON}</svg></span>
        <span class="t" data-role="text" tabindex="${s === 'required' ? 0 : -1}"></span>
        ${s === 'required' && missing.length ? '<span class="n" data-role="count" aria-hidden="true"></span>' : ''}
        <button class="x" type="button" data-role="dismiss" aria-label="${s === 'ready' ? 'Dismiss' : 'Dismiss — stop autofill on this page'}">×</button>
      </div>`;
    const t = root.querySelector('[data-role="text"]');
    // The words are unchanged; on "required" the count is its own rectangular mark beside them (D63).
    t.textContent = s === 'required' && missing.length ? TEXT.required : label;
    const cnt = root.querySelector('[data-role="count"]');
    if (cnt) cnt.textContent = String(missing.length);
    t.title = s === 'required' ? missing.map(m => m.label).join('\n') : (meta?.note || '');
    t.setAttribute('aria-label', s === 'required' ? `${label}: ${missing.map(m => m.label).join(', ')}` : label);
    // "Complete required fields" is one line, but it can take you there: the next empty one — in the form's own frame.
    const go = () => { void send({ type: 'DOCK_GO_MISSING' }); };
    t.onclick = s === 'required' ? go : null;
    t.onkeydown = s === 'required' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } : null;
    root.querySelector('[data-role="dismiss"]').onclick = () => {
      dock.statusText('');
      // D97: the read's line is only information — closing it leaves no stop signal, so a later fill still runs.
      if (s === 'ready') { root.innerHTML = ''; host.hidden = true; return; }
      host.dataset.dismissed = '1';
      clearInterval(Number(host.dataset.timer || 0));
      root.innerHTML = '';
      host.hidden = true;
    };
  };

  const missing = state === 'required' ? (Array.isArray(meta?.missing) ? meta.missing : []) : [];
  paint(state, missing);

  // Live on a single page: flip itself once the candidate has answered every required field — and back, if they clear
  // one. Asked of the form's frame through the service worker; polled, because custom widgets often fire no event.
  if (meta?.live && (state === 'required' || state === 'done')) {
    let asking = false;
    const recount = async () => {
      if (host.dataset.dismissed === '1' || asking || !host.isConnected) return;
      asking = true;
      const r = await send({ type: 'DOCK_MISSING_REQUIRED' });
      asking = false;
      if (!Array.isArray(r?.missing) || host.dataset.dismissed === '1' || !host.isConnected) return;
      const s = r.missing.length ? 'required' : 'done';
      if (s !== host.dataset.state || String(r.missing.length) !== host.dataset.missing) paint(s, r.missing);
    };
    const timer = setInterval(() => { void recount(); }, 1500);
    host.dataset.timer = String(timer);
    if (!host.dataset.listening) {
      host.dataset.listening = '1';
      document.addEventListener('change', () => setTimeout(() => { void recount(); }, 50), true);
      document.addEventListener('input', () => setTimeout(() => { void recount(); }, 50), true);
    }
  }
  host.__draftCleanup = () => clearInterval(Number(host.dataset.timer || 0));
  return { rendered: true, state: host.dataset.state, missing: Number(host.dataset.missing || 0) };
}

/** Injected, ISOLATED world, in the FORM's frame (DOCK_GO_MISSING): scroll the next empty required field into view. */
export function goToMissingRequired(missing) {
  const want = (Array.isArray(missing) ? missing : [])[0];
  if (!want) return false;
  const lab = [...document.querySelectorAll('label, legend, [id]')].find(l => String(l.textContent || '').replace(/\s+/g, ' ').trim().replace(/\*\s*$/, '').trim() === want.label);
  (lab || document.body).scrollIntoView({ block: 'center', behavior: 'smooth' });
  return !!lab;
}

/** Read whether the candidate dismissed the badge — the advance loop's stop signal. ISOLATED world. */
export function badgeDismissed() {
  return document.getElementById('rm-draft-autofill-badge')?.dataset.dismissed === '1';
}
