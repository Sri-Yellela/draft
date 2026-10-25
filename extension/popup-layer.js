// ── T27 · POPUPS FOR EVERYTHING THAT LEADS UP — the ONE popup the dock and every view inside it speak through ────────
//
// The owner, 10-19: "all the permissions, all the stuff that leads up to the reading of the page, the filling,
// everything else — they need to be POP-UPS and that's it." So a message is never a sentence sitting in the dock's body:
// it is a popup, drawn by this file and nowhere else —
//   · ONE popup at a time, QUEUED (a second one waits its turn; one with the same id replaces the waiting copy, or
//     redraws the one on screen)
//   · at most one line of text (the whole sentence is its tooltip) and at most two buttons, each an icon or a short
//     word with its words as aria-label + tooltip; a Settings gear when the answer lives on the settings page
//   · a TOAST (information) dismisses itself — 3.5 s, paused while the pointer or the focus is on it — and never takes
//     the focus; a QUESTION stays until it is answered, takes the focus into itself and gives it back after
//   · Esc closes the one on screen (a question's answer is then "dismissed")
//   · ⛔ a button's press reaches the caller with ev.isTrusted — every caller that writes anything acts on the person's
//     own click only; the Settings gear asks the service worker for the settings page on a trusted click only
//   · ⛔ a PERMISSION is never requested here: a web page cannot (chrome.permissions is an extension page's). Owner
//     10-23: the popup's Allow opens the settings page at #permissions, where the one click requests it.
//
// Where it sits: over the dock's foot, inside its width — or, with no dock on screen, at the window's bottom right. It is
// appended to <html> (never <body>: the form probe and the required-field check never see it), in its own shadow root.
//
// A classic script with no import and no export, injected right after dock.js into the TOP frame (dockHost.js
// ensureDockIn); views find it as globalThis.__draftPopups. Injected twice, it keeps the first copy.
(() => {
  'use strict';
  const VERSION = 1;
  if (globalThis.__draftPopups?.version === VERSION) return;

  const TOAST_MS = 3500;
  const isTop = () => { try { return window.top === window; } catch { return false; } };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const varsOf = (pal) => Object.entries(pal || {}).map(([k, v]) => `--c-${k.toLowerCase().replace(/_/g, '-')}: ${v};`).join(' ');
  const icon = (name, size) => (typeof globalThis.__draftDock?.icon === 'function' ? globalThis.__draftDock.icon(name, size) : '');
  const send = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (reply) => { void chrome.runtime.lastError; resolve(reply ?? null); }); } catch { resolve(null); }
  });

  // ⛔ D60: rectangles — the popup radius 10, its controls radius 8 on 30. ONE surface (the menu's), ONE accent (the
  // primary press), the tone only on the leading icon (a shape AND a colour, D91).
  const CSS = (theme) => `
    :host { all: initial; ${varsOf(theme?.light)} }
    @media (prefers-color-scheme: dark) { :host { ${varsOf(theme?.dark)} } }
    * { box-sizing: border-box; }
    /* a question: its words across the popup's width (two lines at most), its answers on the row under them; a toast with
       nothing to answer: one row — the icon, the words, the close */
    .pp { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px 8px; padding: 8px 8px 8px 12px; border-radius: 10px;
      font: 600 12.5px/1.35 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--c-ink);
      background: var(--c-surface-menu); border: 1px solid var(--c-glass-edge); box-shadow: var(--c-shadow-lg); backdrop-filter: blur(12px); }
    .ic { display: block; flex: none; }
    .lead { display: inline-grid; place-items: center; flex: none; color: var(--c-ink-muted); }
    .lead[data-tone="ok"] { color: var(--c-success); } .lead[data-tone="need"] { color: var(--c-warning); }
    .tx { grid-column: 2; min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .ctl { grid-column: 1 / -1; display: flex; gap: 8px; align-items: center; justify-content: flex-end; }
    .pp.one { grid-template-columns: auto 1fr auto; }
    .pp.one .tx { -webkit-line-clamp: 1; }
    .pp.one .ctl { grid-column: 3; grid-row: 1; }
    button, .tg { width: 30px; height: 30px; flex: none; padding: 0; display: inline-grid; place-items: center; border: 0; border-radius: 8px;
      background: var(--c-surface-solid); color: var(--c-ink); box-shadow: var(--c-depth-rest); cursor: pointer; font: inherit; font-weight: 800; }
    button.word { width: auto; padding: 0 10px; }
    button.primary { background: var(--c-accent); color: var(--c-on-accent); box-shadow: var(--c-depth-accent); }
    button.ghost { background: transparent; box-shadow: none; color: var(--c-ink-muted); }
    button:hover:not(:disabled) { box-shadow: var(--c-depth-hover); }
    button.primary:hover:not(:disabled) { box-shadow: var(--c-depth-accent); }
    button.ghost:hover { box-shadow: none; color: var(--c-ink); }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible, .tg:focus-within { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    .tg { position: relative; background: transparent; box-shadow: none; color: var(--c-ink-faint); }
    .tg input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
    .tg:has(input:checked) { color: var(--c-accent-ink); }
    @media (prefers-reduced-motion: no-preference) { .pp { animation: rm-in .16s ease-out; } }
    @keyframes rm-in { from { opacity: 0; transform: translateY(6px); } }
  `;

  const queue = [];
  let current = null;                 // { spec, host, resolve, timer, returnTo }

  /** Where the popup goes: over the dock's foot, inside its width; with no dock on screen, the window's bottom right. */
  function place(host) {
    const dock = document.getElementById('rm-draft-dock');
    const r = dock && dock.style.display !== 'none' ? dock.getBoundingClientRect() : null;
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    if (r && r.width > 120 && r.height > 120) {
      host.style.left = `${Math.round(r.left + 10)}px`;
      host.style.width = `${Math.round(r.width - 20)}px`;
      host.style.top = '';
      host.style.right = '';
      host.style.bottom = `${Math.max(8, Math.round(innerHeight - r.bottom + 12))}px`;
    } else {
      const w = Math.min(380, innerWidth - 32);
      host.style.width = `${w}px`;
      host.style.left = '';
      host.style.top = '';
      host.style.right = '16px';
      host.style.bottom = '16px';
    }
  }

  const deepActive = () => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a; };

  function draw(p) {
    const s = p.spec;
    const host = document.createElement('div');
    host.id = s.id || `rm-draft-popup-${Date.now()}`;
    host.setAttribute('data-draft-popup', s.kind);
    const root = host.attachShadow({ mode: 'open' });
    const question = s.kind === 'question';
    const data = Object.entries(s.data || {}).map(([k, v]) => ` data-${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}="${esc(v)}"`).join('');
    const btn = (a) => {
      const attrs = Object.entries(a.attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
      const face = a.icon ? icon(a.icon) : esc(a.word || a.label);
      return `<button type="button" class="${a.primary ? 'primary' : ''}${a.icon ? '' : ' word'}" data-action="${esc(a.id)}" aria-label="${esc(a.label)}" title="${esc(a.title || a.label)}"${attrs}>${face}</button>`;
    };
    const toggle = s.toggle ? `<label class="tg" title="${esc(s.toggle.label)}"><input type="checkbox" data-role="${esc(s.toggle.role || 'toggle')}" aria-label="${esc(s.toggle.label)}"${s.toggle.checked ? ' checked' : ''}>${icon(s.toggle.icon || 'pin')}</label>` : '';
    root.innerHTML = `<style>${CSS(s.theme)}</style>
      <div class="pp${(s.actions || []).length || s.toggle || s.settings ? '' : ' one'}" role="${question ? 'alertdialog' : 'status'}" aria-live="${question ? 'assertive' : 'polite'}" aria-describedby="t"${data}>
        ${s.icon ? `<span class="lead" aria-hidden="true"${s.tone ? ` data-tone="${esc(s.tone)}"` : ''}>${icon(s.icon, 18)}</span>` : ''}
        <span class="tx" id="t" data-role="${esc(s.textRole || 'popup-text')}" title="${esc(s.text)}">${esc(s.text)}</span>
        <div class="ctl">${toggle}${(s.actions || []).slice(0, 2).map(btn).join('')}
        ${s.settings ? `<button type="button" class="ghost" data-role="popup-settings" aria-label="Open draft settings" title="Settings">${icon('settings')}</button>` : ''}
        <button type="button" class="ghost" data-role="popup-close" aria-label="Close" title="Close (Esc)">${icon('close', 14)}</button></div>
      </div>`;
    place(host);
    document.documentElement.appendChild(host);
    p.host = host;
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest?.('button');
      if (!b) return;
      if (b.dataset.role === 'popup-close') { finish(p, { action: 'dismissed', trusted: ev.isTrusted }); return; }
      if (b.dataset.role === 'popup-settings') {
        if (ev.isTrusted) void send({ type: 'OPEN_SETTINGS', trigger: 'click', section: s.settings });
        finish(p, { action: 'settings', trusted: ev.isTrusted });
        return;
      }
      const a = (s.actions || []).find(x => x.id === b.dataset.action);
      if (!a) return;
      const answer = { action: a.id, trusted: ev.isTrusted, toggle: !!root.querySelector('.tg input')?.checked };
      // the caller acts INSIDE the click (its own isTrusted check decides whether anything is written); 'keep' leaves
      // the popup open — a press that is still being answered
      const kept = typeof s.onAction === 'function' ? s.onAction(answer, ev) : null;
      if (kept === 'ignore') return;                                  // e.g. a page script's click: nothing happens
      if (kept === 'keep') { for (const x of root.querySelectorAll('button[data-action]')) x.disabled = true; return; }
      finish(p, answer);
    });
    // a toast waits while it is being read
    const arm = () => { clearTimeout(p.timer); if (!question && s.ms !== 0) p.timer = setTimeout(() => finish(p, { action: 'timeout', trusted: false }), s.ms || TOAST_MS); };
    host.addEventListener('pointerenter', () => clearTimeout(p.timer));
    host.addEventListener('pointerleave', arm);
    root.addEventListener('focusin', () => clearTimeout(p.timer));
    root.addEventListener('focusout', arm);
    arm();
    if (question) {
      p.returnTo = deepActive();
      (root.querySelector('button.primary') || root.querySelector('button[data-action]') || root.querySelector('button'))?.focus({ preventScroll: true });
    }
  }

  function finish(p, answer) {
    if (p.done) return;
    p.done = true;
    clearTimeout(p.timer);
    // the focus goes back only if it is still the popup's (or nowhere) — never pulled out of a field the person moved to
    const a = deepActive();
    const held = !!(p.host && (p.host.shadowRoot?.activeElement || a === p.host)) || !a || a === document.body;
    p.host?.remove();
    if (current === p) current = null;
    try { p.spec.onClose?.(answer); } catch { /* the caller's own */ }
    p.resolve(answer);
    if (held && p.spec.kind === 'question' && p.returnTo?.isConnected) { try { p.returnTo.focus({ preventScroll: true }); } catch { /* gone */ } }
    pump();
  }

  function pump() {
    while (!current && queue.length) {
      const next = queue.shift();
      // ⭐ audit 10-25: news that waited longer than it would have been shown is stale — it is dropped, not played late
      if (next.spec.kind !== 'question' && Date.now() - next.queuedAt > (next.spec.ms || TOAST_MS)) { next.resolve({ action: 'expired', trusted: false }); continue; }
      current = next;
      draw(current);
    }
  }

  /**
   * Show a popup. spec: { id, kind: 'toast' | 'question', text, icon, tone: '' | 'ok' | 'need', actions: [{ id, label,
   * icon?, word?, primary?, attrs? }] (two at most), toggle: { role, label, icon, checked }, settings: '<section>',
   * ms (a toast's time; 0 = until closed), theme: { light, dark }, data: { … } (on the popup's box), textRole,
   * onAction(answer, ev) → 'keep' (wait — the buttons go disabled) | 'ignore' (nothing happens) | anything (it closes),
   * onClose(answer) }. → Promise<{ action, trusted, toggle }>.
   */
  function show(spec) {
    if (!isTop() || !spec?.text) return Promise.resolve({ action: 'none', trusted: false });
    return new Promise((resolve) => {
      const p = { spec: { kind: 'toast', ...spec }, resolve, queuedAt: Date.now() };
      if (spec.id) {
        // the same popup again: replace the one waiting, or redraw the one on screen in its place
        const i = queue.findIndex(q => q.spec.id === spec.id);
        if (i >= 0) { queue[i].resolve({ action: 'replaced', trusted: false }); queue[i] = p; return; }
        if (current?.spec.id === spec.id) {
          // the same popup again, in its place: a question keeps where the focus came from (taken BEFORE the redraw — the old
          // host is gone by then); a toast takes no focus and gives none back
          const was = current, ret = was.returnTo || null;
          was.done = true; clearTimeout(was.timer); was.host?.remove(); was.resolve({ action: 'replaced', trusted: false });
          current = p; draw(p); if (p.spec.kind === 'question') p.returnTo = ret || p.returnTo; return;
        }
      }
      // ⭐ audit 10-25: a NEW question is not kept waiting behind an unanswered one ("I submitted it?" behind the intent
      // question would never appear) — the newer one is what the person just asked for; the older is closed, "superseded"
      if (p.spec.kind === 'question' && current?.spec.kind === 'question') {
        const was = current, ret = was.returnTo || null;
        queue.unshift(p);                                             // first in line — the close below draws it
        finish(was, { action: 'superseded', trusted: false });
        if (current === p && ret) p.returnTo = ret;
        return;
      }
      queue.push(p);
      pump();
    });
  }

  /** Close a popup by id (on screen or waiting) — its answer is "closed". */
  function dismiss(id) {
    const i = queue.findIndex(q => q.spec.id === id);
    if (i >= 0) { const [q] = queue.splice(i, 1); q.resolve({ action: 'closed', trusted: false }); }
    if (current?.spec.id === id) finish(current, { action: 'closed', trusted: false });
  }

  // Esc closes the popup on screen — from anywhere but a field of the page, where Esc is the page's own. On WINDOW, in the
  // capture phase: it is answered before the dock's own Esc (which closes the dock) hears it.
  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || !current || ev.isComposing) return;
    const inside = ev.composedPath?.().includes(current.host);
    const t = ev.target;
    const inPageField = !inside && t?.matches?.('input, select, textarea, [contenteditable="true"], [role="combobox"]') && !t.closest?.('[data-draft-dock]');
    if (inPageField) return;
    ev.stopPropagation();
    finish(current, { action: 'dismissed', trusted: ev.isTrusted });
  }, true);
  addEventListener('resize', () => { if (current?.host) place(current.host); });

  globalThis.__draftPopups = Object.freeze({
    version: VERSION, TOAST_MS, show, dismiss,
    current: () => (current ? { id: current.spec.id || null, kind: current.spec.kind, text: current.spec.text } : null),
    waiting: () => queue.map(q => q.spec.id || null),
  });
})();
