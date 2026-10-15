// ── T17 · THE DOCK — ONE floating window for everything draft shows on a page (field report 10-15, (a) + (g)) ────────────
//
// The owner, 10-15: the review panel was BAKED INTO the application form's iframe (Stripe embeds Greenhouse's form) —
// moved aside it was cut off by the frame's edge, left alone it covered the form — and the popup could neither be
// resized nor stay open. And: "the floating logic and every other reusable piece must be MODULAR".
//
// So this file is the ONE place anything of draft's floats on a page. It owns, once:
//   · the frame — drag by the header · resize from every edge and corner (a minimum and a maximum; keyboard-resizable)
//     · snap to left / right / top / bottom (drag the pointer to the screen's edge, Ctrl+Arrow on Move, or ⇤ / ⇥)
//     · collapse to a slim bar that still says what needs you · close · Esc · z-order · prefers-reduced-motion
//   · the TABS: Fill · ATS · Résumé · Copy sheet — each a VIEW inside the dock — and any tab popped out into its own
//     floating window, which is this same frame again (and goes back into the dock with one press)
//   · the rectangle, remembered PER SITE (the service worker keeps it — dockHost.js, `dockPlace`)
//   · never over the field being typed in: a page control that takes focus under the dock sends it to the other side
//     (and, where there is no room for that, collapses it)
//   · all four of the registry's themes and the shape cues — the palettes arrive resolved (dockHost.js / tokens.js)
//
// ⛔ THE TOP FRAME ONLY (T17, a rule, not a fix). ensure() returns null in a child frame and nothing is drawn there; the
//   service worker injects this file only into frame 0. A child frame — Greenhouse's form inside stripe.com — holds the
//   extractor and the filler only, and reaches the dock through the service worker by tabId + frameId (T11's design).
// ⛔ The views (review-overlay.js renderOverlay · resumePanel.js renderResumePanel · copy-sheet-panel.js
//   renderCopySheetPanel · autofill-badge.js renderBadge) carry NO drag, resize, snap, collapse or placement code of
//   their own — test/t17Dock.test.js fails if one does. Each asks this module for its host element and draws inside it.
//
// HOW IT IS SHAPED. A view is a LIGHT-DOM child of a frame's host, with slot="view-<tab>" and its own shadow root (its
// own CSS, the page's CSS shut out). Popping a tab out MOVES that element into a pop-out frame's host — a shadow root
// survives the move, so the view keeps its state. The frames are appended to <html>, never to <body>: the form probes
// and the required-field pre-check never see them.
//
// A classic script with no import and no export (executeScript `files` injects it into the page's ISOLATED world, where
// the views' functions then find it as globalThis.__draftDock) — and a valid module, so the tests import it for the pure
// geometry. Injected twice, it keeps the first copy.
(() => {
  'use strict';
  const VERSION = 1;
  if (globalThis.__draftDock?.version === VERSION) return;

  const TABS = Object.freeze([
    Object.freeze({ id: 'fill', label: 'Fill' }),
    Object.freeze({ id: 'ats', label: 'ATS' }),
    Object.freeze({ id: 'resume', label: 'Résumé' }),
    Object.freeze({ id: 'copy', label: 'Copy sheet' }),
  ]);
  const TAB_IDS = TABS.map(t => t.id);
  const EDGES = Object.freeze(['left', 'right', 'top', 'bottom']);
  /** The frame's bounds: never smaller than MIN (unless the viewport is), never wider than MAX_W, never past the viewport. */
  const LIMITS = Object.freeze({ minW: 300, minH: 220, maxW: 760, margin: 8, slimH: 44, slimMaxW: 460, step: 16, bigStep: 64, edgeBand: 6 });
  const DOCK_ID = 'rm-draft-dock';
  const POP_PREFIX = 'rm-draft-pop-';

  // ── the geometry — PURE (no DOM): what every placement goes through ───────────────────────────────────────────────
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const num = (v, d) => (Number.isFinite(v) ? v : d);

  /** The size bounds for this viewport { w, h }. On a viewport smaller than the minimum, the minimum gives way. */
  function limitsFor(vp) {
    const m = LIMITS.margin;
    const maxW = Math.max(0, Math.min(LIMITS.maxW, vp.w - 2 * m));
    const maxH = Math.max(0, vp.h - 2 * m);
    return { minW: Math.min(LIMITS.minW, maxW), minH: Math.min(LIMITS.minH, maxH), maxW, maxH, margin: m };
  }

  /** A free rectangle kept inside the viewport and inside the size bounds. */
  function clampRect(r, vp) {
    const L = limitsFor(vp);
    const w = Math.round(clamp(num(r?.w, 380), L.minW, L.maxW));
    const h = Math.round(clamp(num(r?.h, L.maxH), L.minH, L.maxH));
    const x = Math.round(clamp(num(r?.x, vp.w - L.margin - w), L.margin, vp.w - L.margin - w));
    const y = Math.round(clamp(num(r?.y, L.margin), L.margin, vp.h - L.margin - h));
    return { x, y, w, h };
  }

  /** Where the dock opens the first time on a site: at the right, as the review panel always did. */
  function defaultRect(vp) {
    const L = limitsFor(vp);
    const w = Math.min(380, L.maxW);
    return clampRect({ x: vp.w - 16 - w, y: 16, w, h: Math.min(vp.h - 32, 680) }, vp);
  }

  /**
   * The rectangle actually drawn: a snapped edge is a full-height column (left / right) or a full-width band (top /
   * bottom) at that edge, sized from the free rectangle; collapsed, the slim bar keeps the rectangle's corner.
   */
  function layoutRect(place, vp) {
    const L = limitsFor(vp);
    const raw = place?.rect || defaultRect(vp);
    const free = clampRect(raw, vp);
    const edge = EDGES.includes(place?.edge) ? place.edge : null;
    let r = free;
    if (edge === 'left') r = { x: L.margin, y: L.margin, w: free.w, h: L.maxH };
    else if (edge === 'right') r = { x: vp.w - L.margin - free.w, y: L.margin, w: free.w, h: L.maxH };
    else if (edge === 'top' || edge === 'bottom') {
      const w = Math.max(0, vp.w - 2 * L.margin);
      const h = Math.round(clamp(Math.min(free.h, Math.round(vp.h * 0.6)), L.minH, L.maxH));
      r = { x: L.margin, y: edge === 'top' ? L.margin : vp.h - L.margin - h, w, h };
    }
    if (place?.collapsed) {
      // the slim bar sits where the rectangle's corner is — anywhere on screen, its own small size the only bound
      const h = Math.min(LIMITS.slimH, L.maxH);
      const w = Math.min(r.w, LIMITS.slimMaxW, Math.max(0, vp.w - 2 * L.margin));
      const x = edge === 'right' ? vp.w - L.margin - w : edge ? r.x : num(raw.x, r.x);
      const y = edge === 'bottom' ? vp.h - L.margin - h : edge ? r.y : num(raw.y, r.y);
      r = { x: Math.round(clamp(x, L.margin, vp.w - L.margin - w)), y: Math.round(clamp(y, L.margin, vp.h - L.margin - h)), w, h };
    }
    return r;
  }

  /** Move by (dx, dy): the dock leaves any edge it was snapped to and stays on screen. */
  function moveRect(r, dx, dy, vp) { return clampRect({ ...r, x: r.x + dx, y: r.y + dy }, vp); }

  /** Resize from a handle — n, s, e, w, ne, nw, se, sw — by (dx, dy); the opposite edge stays where it was. */
  function resizeRect(r, handle, dx, dy, vp) {
    const L = limitsFor(vp);
    const hd = String(handle || '');
    let { x, y, w, h } = r;
    if (hd.includes('e')) w = r.w + dx;
    if (hd.includes('s')) h = r.h + dy;
    if (hd.includes('w')) w = r.w - dx;
    if (hd.includes('n')) h = r.h - dy;
    w = clamp(w, L.minW, L.maxW);
    h = clamp(h, L.minH, L.maxH);
    if (hd.includes('w')) x = r.x + r.w - w;
    if (hd.includes('n')) y = r.y + r.h - h;
    return clampRect({ x, y, w, h }, vp);
  }

  /** The edge a drag that ended with the pointer at (px, py) snaps to — the pointer AT the screen's edge — or null. */
  function edgeAtPointer(px, py, vp) {
    const b = LIMITS.edgeBand;
    if (px <= b) return 'left';
    if (px >= vp.w - b) return 'right';
    if (py <= b) return 'top';
    if (py >= vp.h - b) return 'bottom';
    return null;
  }

  /** A saved place, made safe: only the named fields, every number finite, the tab one of the four. */
  function cleanPlace(p) {
    const rect = (r) => (r && ['x', 'y', 'w', 'h'].every(k => Number.isFinite(r[k])) ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) } : null);
    const pops = {};
    for (const t of TAB_IDS) { const r = rect(p?.pops?.[t]); if (r) pops[t] = r; }
    return { rect: rect(p?.rect), edge: EDGES.includes(p?.edge) ? p.edge : null, collapsed: p?.collapsed === true,
      tab: TAB_IDS.includes(p?.tab) ? p.tab : 'fill', pops };
  }

  const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

  // ── the page side ────────────────────────────────────────────────────────────────────────────────────────────────
  const isTop = () => { try { return window.top === window; } catch { return false; } };
  const viewport = () => {
    const de = document.documentElement;
    const w = Math.min(innerWidth, de?.clientWidth || innerWidth);
    const h = Math.min(innerHeight, de?.clientHeight || innerHeight);
    return { w, h };
  };
  const varsOf = (pal) => Object.entries(pal || {}).map(([k, v]) => `--c-${k.toLowerCase().replace(/_/g, '-')}: ${v};`).join(' ');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const send = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (reply) => { void chrome.runtime.lastError; resolve(reply ?? null); }); } catch { resolve(null); }
  });

  const FRAME_CSS = (theme, logo) => `
    :host { all: initial; ${varsOf(theme?.light)} }
    @media (prefers-color-scheme: dark) { :host { ${varsOf(theme?.dark)} } }
    * { box-sizing: border-box; }
    .fr { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden;
      font: 13px/1.45 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--c-ink); text-align: left;
      background: var(--c-surface-menu); backdrop-filter: blur(12px); border: 1px solid var(--c-glass-edge); border-radius: 10px;
      box-shadow: var(--c-shadow-lg); }
    .hd { display: flex; align-items: center; gap: 6px; padding: 8px 8px 8px 12px; border-bottom: 1px solid var(--c-border);
      cursor: grab; user-select: none; touch-action: none; flex: none; }
    .hd.dragging { cursor: grabbing; }
    .mk { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 18px; letter-spacing: -.02em; line-height: 1;
      color: var(--c-logo-word); forced-color-adjust: none; }
    .mk .sl { color: var(--c-logo-slash); }
    .ttl { font-size: 12px; font-weight: 700; color: var(--c-ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .sp { flex: 1; min-width: 4px; }
    /* ⛔ D60: rectangles — a 26px control at radius 8; the tab is a box with a 3px bar, never a capsule. */
    .ib { width: 26px; height: 26px; flex: none; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface-solid);
      color: var(--c-ink-muted); font: 800 13px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; padding: 0; }
    .ib:hover, .ib:focus-visible { color: var(--c-ink); }
    .ib[data-role="move"] { cursor: move; }
    .ib:focus-visible, .tab:focus-visible, .btn:focus-visible, .grip:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    .st { flex: none; padding: 6px 8px 0; }
    .st:not(.has) { display: none; }
    .tabs { display: flex; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--c-border); flex: none; overflow-x: auto; }
    .tab { font: inherit; font-size: 12px; font-weight: 700; padding: 6px 10px; border: 0; border-bottom: 3px solid transparent;
      border-radius: 6px 6px 0 0; background: transparent; color: var(--c-ink-muted); cursor: pointer; white-space: nowrap; }
    .tab:hover { color: var(--c-ink); }
    .tab[aria-selected="true"] { color: var(--c-ink); background: var(--c-surface-solid); border-bottom-color: var(--c-accent); }
    /* D91 shape cues: the selected tab also says so by a shape, never by colour alone */
    :host([data-cues="shape"]) .tab[aria-selected="true"] { text-decoration: underline; text-underline-offset: 3px; }
    :host([data-cues="shape"]) .tab[aria-selected="true"]::before { content: "▸ "; }
    .body { flex: 1; min-height: 0; position: relative; }
    .pane { position: absolute; inset: 0; overflow: auto; }
    .pane[hidden] { display: none; }
    ::slotted([slot^="view-"]) { display: block; height: 100%; }
    .empty { padding: 16px; color: var(--c-ink-muted); font-size: 12.5px; display: grid; gap: 10px; justify-items: start; }
    .popped { padding: 16px; color: var(--c-ink-muted); font-size: 12.5px; display: grid; gap: 10px; justify-items: start; }
    .pane.is-popped slot { display: none; }
    .btn { font: inherit; font-size: 11.5px; font-weight: 700; padding: 6px 12px; min-height: 30px; border-radius: 8px; border: 0;
      background: var(--c-surface-solid); color: var(--c-ink); box-shadow: var(--c-depth-rest); cursor: pointer; }
    .btn:hover { box-shadow: var(--c-depth-hover); }
    .slim { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 12px; height: 100%; cursor: grab; user-select: none; touch-action: none; }
    .slimtxt { flex: 1; min-width: 0; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .slimtxt b { color: var(--c-warning); }
    .rz { position: absolute; z-index: 2; touch-action: none; }
    .rz[data-handle="n"], .rz[data-handle="s"] { left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
    .rz[data-handle="n"] { top: -3px; } .rz[data-handle="s"] { bottom: -3px; }
    .rz[data-handle="e"], .rz[data-handle="w"] { top: 10px; bottom: 10px; width: 8px; cursor: ew-resize; }
    .rz[data-handle="e"] { right: -3px; } .rz[data-handle="w"] { left: -3px; }
    .rz[data-handle="ne"], .rz[data-handle="nw"], .rz[data-handle="se"], .rz[data-handle="sw"] { width: 14px; height: 14px; }
    .rz[data-handle="ne"] { top: -3px; right: -3px; cursor: nesw-resize; } .rz[data-handle="sw"] { bottom: -3px; left: -3px; cursor: nesw-resize; }
    .rz[data-handle="nw"] { top: -3px; left: -3px; cursor: nwse-resize; } .rz[data-handle="se"] { bottom: -3px; right: -3px; cursor: nwse-resize; }
    .grip { position: absolute; right: 2px; bottom: 2px; z-index: 3; width: 16px; height: 16px; padding: 0; border: 0; border-radius: 4px;
      background: transparent; color: var(--c-ink-faint); cursor: nwse-resize; font: 700 11px/1 ui-sans-serif, system-ui, sans-serif; }
    :host([data-collapsed="true"]) .rz, :host([data-collapsed="true"]) .grip { display: none; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .shield { position: fixed; inset: 0; z-index: 5; background: transparent; touch-action: none; }
    @media (prefers-reduced-motion: no-preference) { :host([data-settle]) { transition: left .16s ease, top .16s ease, width .16s ease, height .16s ease; } }
  `;

  const LOGO_FACE = 'rm-draft-logo';
  function loadLogo(theme) {
    if (!theme?.logoFont || typeof FontFace !== 'function' || globalThis.__draftDockLogo) return;
    try {
      const bin = atob(theme.logoFont);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const face = new FontFace(LOGO_FACE, bytes.buffer, { style: 'italic', weight: '800' });
      document.fonts.add(face);
      face.load().catch(() => {});
      globalThis.__draftDockLogo = true;
    } catch { /* the fallback face carries the same words */ }
  }
  const LOGO = `'${LOGO_FACE}', 'Poppins', ui-sans-serif, system-ui, sans-serif`;

  const EMPTY = {
    fill: 'Nothing has been filled on this page yet.',
    ats: 'The ATS report for this page shows here.',
    resume: 'The résumé made for this job shows here — its state, a preview, and Attach.',
    copy: 'Your answers to copy by hand show here.',
  };

  // ── ONE frame: the dock, or a tab popped out of it ───────────────────────────────────────────────────────────────
  // z-order: the frame last pressed is on top of draft's others — all of them above the page.
  const FRAMES = new Set();
  function raise(f) { for (const o of FRAMES) o.host.style.zIndex = String(o === f ? 2147483646 : 2147483645); }

  function makeFrame({ id, kind, tab = null, title, theme, cues, rect, edge = null, collapsed = false, onChange, onClose, onDockBack, onSelect, onLoad }) {
    const host = document.createElement('div');
    host.id = id;
    host.setAttribute('data-draft-dock', kind);
    if (cues) host.setAttribute('data-cues', 'shape');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = FRAME_CSS(theme, LOGO);
    const fr = document.createElement('div');
    fr.className = 'fr';
    fr.setAttribute('role', kind === 'dock' ? 'complementary' : 'dialog');
    fr.setAttribute('aria-label', kind === 'dock' ? 'draft' : `draft — ${title}`);
    root.append(style, fr);
    const f = { id, kind, tab, host, root, fr, place: { rect, edge, collapsed }, active: 'fill', summary: {}, statusText: '' };

    const vp = () => viewport();
    const apply = (settle = false) => {
      const r = layoutRect(f.place, vp());
      if (settle) host.setAttribute('data-settle', ''); else host.removeAttribute('data-settle');
      host.style.position = 'fixed';
      host.style.left = `${r.x}px`;
      host.style.top = `${r.y}px`;
      host.style.width = `${r.w}px`;
      host.style.height = `${r.h}px`;
      host.style.right = '';
      host.style.bottom = '';
      host.style.zIndex = host.style.zIndex || '2147483646';
      host.style.display = 'block';
      host.dataset.edge = f.place.edge || '';
      host.dataset.side = (f.place.edge === 'left' || (!f.place.edge && r.x + r.w / 2 < vp().w / 2)) ? 'left' : 'right';
      host.dataset.collapsed = String(!!f.place.collapsed);
      return r;
    };
    f.apply = apply;
    f.rectNow = () => layoutRect(f.place, vp());
    /** Move the frame by (dx, dy) from where it is drawn: off any edge, its own free size kept. */
    const shiftTo = (from, dx, dy, free) => {
      const r = { x: from.x + dx, y: from.y + dy, w: free.w, h: free.h };
      return f.place.collapsed ? r : clampRect(r, vp());
    };

    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(hd => `<div class="rz" data-handle="${hd}" aria-hidden="true"></div>`).join('');
    const sideBtn = () => (host.dataset.side === 'right'
      ? '<button class="ib" data-role="dock" aria-label="Snap to the left" title="Snap to the left">⇤</button>'
      : '<button class="ib" data-role="dock" aria-label="Snap to the right" title="Snap to the right">⇥</button>');
    const moveBtn = '<button class="ib" data-role="move" aria-label="Move the panel — arrow keys move it, Ctrl+arrow snaps it to that edge" title="Move (arrow keys · Ctrl+arrow snaps)">✥</button>';

    f.draw = () => {
      apply();
      // a re-draw keeps the keyboard where it was: the control with the same role (and tab) takes the focus back
      const ae = root.activeElement;
      const had = ae?.dataset?.role ? { role: ae.dataset.role, tab: ae.dataset.tab || '' } : null;
      paint();
      if (had) [...root.querySelectorAll(`[data-role="${had.role}"]`)].find(e => (e.dataset.tab || '') === had.tab)?.focus({ preventScroll: true });
    };
    const paint = () => {
      const collapsedNow = !!f.place.collapsed;
      if (collapsedNow) {
        // what needs you first (the Fill tab's counts), else what the shown tab says, else the status line
        const need = f.summary.fill?.need;
        const words = f.summary.fill?.text || f.summary[f.kind === 'pop' ? tab : f.active]?.text || f.statusText || (f.kind === 'pop' ? title : 'draft');
        fr.innerHTML = `<div class="slim" data-role="drag">
            <div class="mk" aria-hidden="true"><span class="sl">/</span>draft</div>
            <span class="slimtxt" data-role="slim">${need ? `<b>${esc(words)}</b>` : esc(words)}</span>
            ${moveBtn}
            <button class="ib" data-role="expand" aria-label="Expand the panel" title="Expand">▢</button>
            <button class="ib" data-role="close" aria-label="${kind === 'dock' ? 'Close the panel' : 'Back into the dock'}" title="${kind === 'dock' ? 'Close (Esc)' : 'Back into the dock'}">×</button>
          </div>`;
        return;
      }
      const tabs = kind === 'dock' ? `<div class="tabs" role="tablist" aria-label="draft">${TABS.map(t => `
          <button class="tab" role="tab" id="${id}-tab-${t.id}" data-role="tab" data-tab="${t.id}" aria-controls="${id}-pane-${t.id}"
            aria-selected="${t.id === f.active}" tabindex="${t.id === f.active ? 0 : -1}">${esc(t.label)}</button>`).join('')}</div>` : '';
      const panes = kind === 'dock' ? TABS.map(t => `
          <div class="pane${f.popped?.has(t.id) ? ' is-popped' : ''}" role="tabpanel" id="${id}-pane-${t.id}" data-tab="${t.id}" aria-labelledby="${id}-tab-${t.id}"${t.id === f.active ? '' : ' hidden'}>
            ${f.popped?.has(t.id) ? `<div class="popped" data-role="popped">${esc(t.label)} is open in its own window.
              <button class="btn" data-role="dock-back" data-tab="${t.id}">Bring it back into the dock</button></div>` : ''}
            <slot name="view-${t.id}"><div class="empty" data-role="empty">${esc(EMPTY[t.id])}${f.loading === t.id ? ' Loading…' : ''}${
              f.loadError?.[t.id] ? `<span data-role="load-error">${esc(f.loadError[t.id])}</span>` : ''}${
              t.id === 'fill' ? `<button class="btn" data-role="fill" title="Ctrl+Shift+Y">${f.filling ? 'Filling…' : 'Fill this page'}</button>${
                f.fillSaid ? `<span data-role="fill-said">${esc(f.fillSaid)}</span>` : ''}` : ''}</div></slot>
          </div>`).join('')
        : `<div class="pane" data-tab="${tab}"><slot name="view-${tab}"><div class="empty">${esc(EMPTY[tab] || '')}</div></slot></div>`;
      fr.innerHTML = `
        <div class="hd" data-role="drag">
          <div class="mk" aria-hidden="true"><span class="sl">/</span>draft</div>
          ${kind === 'pop' ? `<span class="ttl" data-role="title">${esc(title)}</span>` : '<span class="sr">draft</span>'}
          <span class="sp"></span>
          ${moveBtn}
          ${sideBtn()}
          ${kind === 'dock' ? '<button class="ib" data-role="pop" aria-label="Open this tab in its own window" title="Open this tab in its own window">⧉</button>'
            : '<button class="ib" data-role="dock-back" aria-label="Back into the dock" title="Back into the dock">⇲</button>'}
          <button class="ib" data-role="collapse" aria-label="Collapse the panel" title="Collapse">–</button>
          <button class="ib" data-role="close" aria-label="${kind === 'dock' ? 'Close the panel' : 'Back into the dock'}" title="${kind === 'dock' ? 'Close (Esc)' : 'Back into the dock'}">×</button>
        </div>
        ${kind === 'dock' ? '<div class="st" data-role="status"><slot name="status"></slot></div>' : ''}
        ${tabs}
        <div class="body">${panes}</div>
        ${handles}
        <button class="grip" data-role="resize" aria-label="Resize the panel — arrow keys change its width and height" title="Resize (arrow keys)">◢</button>`;
      const st = root.querySelector('[data-role="status"]');
      if (st) {
        const slot = st.querySelector('slot');
        const mark = () => st.classList.toggle('has', slot.assignedElements().length > 0);
        slot.addEventListener('slotchange', mark);
        mark();
      }
    };

    // ── pointer: drag by the header, resize from a handle ──
    let op = null;
    const onDown = (ev) => {
      raise(f);
      if (ev.button !== 0) return;
      const handle = ev.target.closest?.('.rz')?.dataset.handle || null;
      const onHead = !!ev.target.closest?.('[data-role="drag"]') && !ev.target.closest('button, a, input, select, textarea');
      if (!handle && !onHead) return;
      const start = f.rectNow();
      const free = f.place.edge || f.place.collapsed ? clampRect(f.place.rect || start, vp()) : start;
      op = { kind: handle ? 'resize' : 'move', handle, x0: ev.clientX, y0: ev.clientY, start, free, moved: false };
      // A SHIELD over the whole viewport for the length of the drag: the pointer crossing the page's iframe (the
      // embedded application form — another process, another origin) would otherwise take the events, and the dock
      // would stop where the pointer entered the frame. The shield holds the pointer capture; it is gone on release.
      const shield = document.createElement('div');
      shield.className = 'shield';
      shield.style.cursor = handle ? getComputedStyle(ev.target).cursor : 'grabbing';
      root.append(shield);
      op.shield = shield;
      try { shield.setPointerCapture?.(ev.pointerId); } catch { /* the shield still covers the frames */ }
      ev.preventDefault();
    };
    const onMove = (ev) => {
      if (!op) return;
      const dx = ev.clientX - op.x0, dy = ev.clientY - op.y0;
      if (!op.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      op.moved = true;
      root.querySelector('.hd, .slim')?.classList.add('dragging');
      f.place = op.kind === 'move'
        ? { ...f.place, edge: null, rect: shiftTo(op.start, dx, dy, op.free) }
        : { ...f.place, edge: null, rect: resizeRect(op.start, op.handle, dx, dy, vp()) };
      apply();
    };
    const onUp = (ev) => {
      if (!op) return;
      onMove(ev);                                                   // the last position is the release's own
      const was = op;
      op = null;
      was.shield?.remove();
      root.querySelector('.hd, .slim')?.classList.remove('dragging');
      if (!was.moved) return;
      // the pointer let go AT the screen's edge: the frame snaps to it
      if (was.kind === 'move') { const edge = edgeAtPointer(ev.clientX, ev.clientY, vp()); if (edge) f.place = { ...f.place, edge }; }
      f.draw();
      onChange?.();
    };

    // ── keys on the frame: Move / Resize with arrows; tabs with arrows ──
    const onKeyDown = (ev) => {
      const role = ev.target?.dataset?.role;
      const arrows = { ArrowLeft: [-1, 0, 'left'], ArrowRight: [1, 0, 'right'], ArrowUp: [0, -1, 'top'], ArrowDown: [0, 1, 'bottom'] };
      const a = arrows[ev.key];
      if (!a) return;
      if (role === 'move') {
        ev.preventDefault();
        if (ev.ctrlKey || ev.metaKey) f.place = { ...f.place, edge: a[2] };
        else {
          const d = ev.shiftKey ? LIMITS.bigStep : LIMITS.step;
          const from = f.rectNow();
          const free = f.place.edge || f.place.collapsed ? clampRect(f.place.rect || from, vp()) : from;
          f.place = { ...f.place, edge: null, rect: shiftTo(from, a[0] * d, a[1] * d, free) };
        }
        f.draw(); onChange?.();
        root.querySelector('[data-role="move"]')?.focus();
        return;
      }
      if (role === 'resize') {
        ev.preventDefault();
        const d = ev.shiftKey ? LIMITS.bigStep : LIMITS.step;
        f.place = { ...f.place, edge: null, rect: resizeRect(f.rectNow(), 'se', a[0] * d, a[1] * d, vp()) };
        f.draw(); onChange?.();
        root.querySelector('[data-role="resize"]')?.focus();
        return;
      }
      if (role === 'tab' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
        ev.preventDefault();
        const i = TAB_IDS.indexOf(ev.target.dataset.tab);
        const next = TAB_IDS[(i + (ev.key === 'ArrowRight' ? 1 : TAB_IDS.length - 1)) % TAB_IDS.length];
        onSelect?.(next, { trusted: ev.isTrusted, focus: true });
      }
    };

    const onClick = (ev) => {
      const btn = ev.target.closest?.('button');
      if (!btn) return;
      const role = btn.dataset.role;
      if (role === 'close') { if (kind === 'dock') onClose?.(); else onDockBack?.(); return; }
      if (role === 'collapse') { f.place = { ...f.place, collapsed: true }; f.draw(); onChange?.(); return; }
      if (role === 'expand') { f.place = { ...f.place, collapsed: false }; f.draw(); onChange?.(); return; }
      if (role === 'dock') {
        f.place = { ...f.place, edge: host.dataset.side === 'right' ? 'left' : 'right' };
        f.draw(); onChange?.(); return;
      }
      if (role === 'tab') { onSelect?.(btn.dataset.tab, { trusted: ev.isTrusted }); return; }
      if (role === 'pop') { f.onPop?.(); return; }
      if (role === 'dock-back') { if (kind === 'dock') f.onDockBackTab?.(btn.dataset.tab); else onDockBack?.(); return; }
      if (role === 'load') onLoad?.(btn.dataset.tab, ev.isTrusted);
      // The empty Fill tab's one action: the SAME press as the popup's Fill it and Ctrl+Shift+Y (it reads, prepares and
      // fills as the page needs — T13). ⛔ The person's own click only; a page script's click asks for nothing.
      if (role === 'fill' && ev.isTrusted && !f.filling) f.onFill?.();
    };

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('click', onClick);
    FRAMES.add(f);
    f.remove = () => { FRAMES.delete(f); host.remove(); };
    document.documentElement.appendChild(host);
    f.draw();
    raise(f);
    return f;
  }

  // ── THE dock ─────────────────────────────────────────────────────────────────────────────────────────────────────
  let DOCK = null;

  function ensure(meta = {}) {
    if (!isTop()) return null;                                      // ⛔ never in a child frame
    if (DOCK && DOCK.frame.host.isConnected) { DOCK.retheme(meta); return DOCK; }
    loadLogo(meta.theme);
    const saved = cleanPlace(meta.place || {});
    const vp0 = viewport();
    const views = new Map();                                        // tab -> { el, onClose }
    const pops = new Map();                                         // tab -> frame
    let status = null;
    let saveTimer = 0;

    const placeNow = () => ({
      rect: frame.place.rect || frame.rectNow(), edge: frame.place.edge || null, collapsed: !!frame.place.collapsed, tab: frame.active,
      pops: Object.fromEntries([...pops.entries()].map(([t, p]) => [t, p.place.rect || p.rectNow()])),
      popped: [...pops.keys()],
    });
    // What the PERSON chose, taken at the moment they chose it (sent a beat later, once): the dock stepping aside from a
    // field being typed in is not a choice, and is never what gets remembered.
    const save = () => {
      clearTimeout(saveTimer);
      const place = placeNow();
      saveTimer = setTimeout(() => { void send({ type: 'DOCK_PLACE', place }); }, 200);
    };

    const select = (tab, { trusted = false, focus = false, load = true } = {}) => {
      if (!TAB_IDS.includes(tab)) return;
      frame.active = tab;
      if (frame.place.collapsed && trusted) frame.place = { ...frame.place, collapsed: false };
      frame.draw();
      if (focus) frame.root.getElementById?.(`${DOCK_ID}-tab-${tab}`)?.focus();
      // A tab with no view yet is drawn on the user's own press (a view, never a page read: dockHost.js DOCK_TAB).
      if (trusted && load && !views.has(tab) && tab !== 'fill') loadTab(tab);
      if (trusted) save();                                          // the person's choice is remembered; a view's draw is not one
    };
    const loadTab = async (tab) => {
      frame.loading = tab;
      frame.loadError = { ...(frame.loadError || {}), [tab]: null };
      frame.draw();
      const r = await send({ type: 'DOCK_TAB', tab, trigger: 'click' });
      frame.loading = null;
      if (!r?.ok && !views.has(tab)) frame.loadError = { ...(frame.loadError || {}), [tab]: r?.message || 'draft could not show this here.' };
      if (frame.host.isConnected) frame.draw();
    };

    const closeAll = () => {
      for (const [, v] of views) { try { v.onClose?.(); } catch { /* a view's own cleanup */ } }
      views.clear();
      if (status) { try { status.__draftCleanup?.(); } catch { /* gone */ } }
      for (const p of pops.values()) p.remove();
      pops.clear();
      frame.remove();
      document.removeEventListener('keydown', onEsc, true);
      document.removeEventListener('focusin', onFocus, true);
      removeEventListener('resize', onResize);
      DOCK = null;
    };

    const popOut = (tab) => {
      const v = views.get(tab);
      if (!v || pops.has(tab)) return null;
      const base = frame.rectNow();
      const vp = viewport();
      const r0 = saved.pops[tab] || clampRect({ x: base.x - 40, y: base.y + 40, w: base.w, h: Math.min(base.h, 560) }, vp);
      const label = TABS.find(t => t.id === tab)?.label || tab;
      const p = makeFrame({ id: `${POP_PREFIX}${tab}`, kind: 'pop', tab, title: label, theme: meta.theme, cues: meta.cues, rect: clampRect(r0, vp),
        onChange: save, onDockBack: () => dockBack(tab) });
      pops.set(tab, p);
      p.summary[tab] = frame.summary[tab] || null;
      frame.popped = new Set(pops.keys());
      p.host.appendChild(v.el);                                     // the view moves; its shadow root and state go with it
      frame.draw();
      save();
      return p;
    };
    const dockBack = (tab) => {
      const p = pops.get(tab);
      if (!p) return;
      const v = views.get(tab);
      if (v) frame.host.appendChild(v.el);
      p.remove();
      pops.delete(tab);
      frame.popped = new Set(pops.keys());
      select(tab);
    };

    const frame = makeFrame({ id: DOCK_ID, kind: 'dock', title: 'draft', theme: meta.theme, cues: meta.cues,
      rect: saved.rect ? clampRect(saved.rect, vp0) : defaultRect(vp0), edge: saved.edge, collapsed: saved.collapsed,
      onChange: save, onClose: closeAll, onSelect: (t, o) => select(t, o), onLoad: (t, trusted) => { if (trusted) loadTab(t); } });
    frame.active = saved.tab;
    frame.popped = new Set();
    frame.onPop = () => popOut(frame.active);
    frame.onFill = async () => {
      frame.filling = true; frame.fillSaid = '';
      frame.draw();
      const r = await send({ type: 'DOCK_FILL', trigger: 'click' });
      frame.filling = false;
      // a fill that drew its panel replaced this empty state; one that did not says why, here
      frame.fillSaid = r?.ok ? '' : (r?.message || 'draft could not fill this page.');
      if (frame.host.isConnected) frame.draw();
    };
    frame.onDockBackTab = (t) => dockBack(t);
    frame.draw();

    // Esc closes — from inside the dock, or with the focus nowhere in particular. Never while you are in a field of the
    // page, where Esc belongs to the page's own dropdown. Inside a pop-out window, Esc puts that tab back in the dock.
    function onEsc(ev) {
      if (ev.key !== 'Escape' || ev.isComposing) return;
      const path = ev.composedPath?.() || [];
      for (const [tab, p] of pops) if (path.includes(p.host)) { dockBack(tab); return; }
      const inDock = path.includes(frame.host);
      const t = ev.target;
      const inPageField = !inDock && t && t !== document.body && t !== document.documentElement &&
        t.matches?.('input, select, textarea, [role="combobox"], [contenteditable="true"], [aria-haspopup="listbox"]');
      if (inDock || !inPageField) closeAll();
    }
    // Never over the field being filled: a control of THIS page that takes focus under the dock sends the dock to the
    // other side — and, where that side covers it too, collapses it. (A field inside a child frame is that frame's own.)
    function onFocus(ev) {
      const t = ev.target;
      if (!t || ev.composedPath?.().some(n => n?.dataset?.draftDock || n?.getAttribute?.('data-draft-dock')) || !t.getBoundingClientRect) return;
      if (t.tagName === 'IFRAME' || t.tagName === 'FRAME') return;
      const fb = t.getBoundingClientRect();
      if (!overlaps(frame.host.getBoundingClientRect(), fb)) return;
      frame.place = { ...frame.place, edge: frame.host.dataset.side === 'right' ? 'left' : 'right' };
      frame.draw();
      if (overlaps(frame.host.getBoundingClientRect(), fb)) { frame.place = { ...frame.place, collapsed: true }; frame.draw(); }
    }
    let rz = 0;
    function onResize() { if (rz) return; rz = requestAnimationFrame(() => { rz = 0; frame.draw(); for (const p of pops.values()) p.draw(); }); }
    document.addEventListener('keydown', onEsc, true);
    document.addEventListener('focusin', onFocus, true);
    addEventListener('resize', onResize);

    DOCK = {
      frame,
      get host() { return frame.host; },
      retheme(m) {
        // a later draw with another resolved theme (the account's appearance changed) repaints the frame's tokens
        if (m?.theme) {
          for (const f of [frame, ...pops.values()]) { const s = f.root.querySelector('style'); if (s) s.textContent = FRAME_CSS(m.theme, LOGO); }
          loadLogo(m.theme);
        }
        if (m && 'cues' in m) for (const f of [frame, ...pops.values()]) { if (m.cues) f.host.setAttribute('data-cues', 'shape'); else f.host.removeAttribute('data-cues'); }
      },
      /**
       * The host element for a tab's view — a fresh one (the tab's previous view is cleaned up and removed). The caller
       * attaches its own shadow root and draws inside it. `expand`: open the dock if collapsed; `select`: show this tab.
       */
      view(tab, { id, label = null, select: sel = true, expand = false, onClose = null } = {}) {
        if (!TAB_IDS.includes(tab)) throw new Error(`unknown dock tab ${tab}`);
        const prior = views.get(tab);
        if (prior) { try { prior.el.__draftCleanup?.(); } catch { /* gone */ } prior.el.remove(); }
        const old = id ? document.getElementById(id) : null;
        if (old && old !== frame.host) { try { old.__draftCleanup?.(); } catch { /* gone */ } old.remove(); }
        const el = document.createElement('div');
        if (id) el.id = id;
        el.slot = `view-${tab}`;
        el.setAttribute('data-draft-view', tab);
        if (label) el.setAttribute('aria-label', label);
        (pops.get(tab)?.host || frame.host).appendChild(el);
        views.set(tab, { el, onClose });
        if (frame.loadError) frame.loadError[tab] = null;
        if (expand && frame.place.collapsed) frame.place = { ...frame.place, collapsed: false };
        if (sel) select(tab, { load: false }); else frame.draw();
        return el;
      },
      /** Forget a tab's view (it removed itself — a refused fill, a closed sheet). */
      drop(tab, el = null) {
        const v = views.get(tab);
        if (!v || (el && v.el !== el)) return;
        views.delete(tab);
        v.el.remove();
        if (pops.has(tab)) dockBack(tab);
        frame.draw();
      },
      has: (tab) => views.has(tab),
      viewOf: (tab) => views.get(tab)?.el || null,
      /** The one status line (autofill-badge.js renderBadge) — shown under the header and in the slim bar. */
      status({ id } = {}) {
        if (status?.isConnected) return status;
        status = document.createElement('div');
        if (id) status.id = id;
        status.slot = 'status';
        status.setAttribute('data-draft-status', '');
        frame.host.appendChild(status);
        return status;
      },
      /** What the slim bar says: the Fill view's "2 need you · 14 of 18 filled" first, else the status line. */
      summary(tab, text, { need = 0 } = {}) {
        frame.summary[tab] = text ? { text: String(text), need } : null;
        if (frame.place.collapsed) frame.draw();
        const p = pops.get(tab);
        if (p) { p.summary[tab] = frame.summary[tab]; if (p.place.collapsed) p.draw(); }
      },
      statusText(text) { frame.statusText = String(text || ''); if (frame.place.collapsed) frame.draw(); },
      select: (tab) => select(tab, { load: false }),
      active: () => frame.active,
      collapse() { frame.place = { ...frame.place, collapsed: true }; frame.draw(); save(); },
      expand() { frame.place = { ...frame.place, collapsed: false }; frame.draw(); save(); },
      collapsed: () => !!frame.place.collapsed,
      close: closeAll,
      popOut, dockBack,
      popped: () => [...pops.keys()],
      rect: () => frame.rectNow(),
      place: () => placeNow(),
    };
    // a tab that was popped out when this site last showed the dock opens popped out again, once its view arrives
    DOCK.restorePops = (tab) => { if (saved.pops[tab] && (meta.place?.popped || []).includes(tab) && views.has(tab) && !pops.has(tab)) popOut(tab); };
    return DOCK;
  }

  globalThis.__draftDock = Object.freeze({
    version: VERSION, TABS, TAB_IDS, EDGES, LIMITS, DOCK_ID, POP_PREFIX,
    // the geometry (pure — test/t17Dock.test.js)
    limitsFor, clampRect, defaultRect, layoutRect, moveRect, resizeRect, edgeAtPointer, cleanPlace,
    // the page
    isTop, ensure,
    current: () => (DOCK && DOCK.frame.host.isConnected ? DOCK : null),
  });
})();
