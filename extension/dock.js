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
    Object.freeze({ id: 'fill', label: 'Fill', icon: 'fill' }),
    Object.freeze({ id: 'ats', label: 'ATS', icon: 'ats' }),
    Object.freeze({ id: 'resume', label: 'Résumé', icon: 'resume' }),
    Object.freeze({ id: 'copy', label: 'Copy sheet', icon: 'copy' }),
  ]);
  const TAB_IDS = TABS.map(t => t.id);
  const EDGES = Object.freeze(['left', 'right', 'top', 'bottom']);
  /** The frame's bounds: never smaller than MIN (unless the viewport is), never wider than MAX_W, never past the viewport. */
  const LIMITS = Object.freeze({ minW: 300, minH: 220, maxW: 760, margin: 8, slimH: 44, slimMaxW: 460, step: 16, bigStep: 64, edgeBand: 6, launch: 52 });
  const DOCK_ID = 'rm-draft-dock';
  const POP_PREFIX = 'rm-draft-pop-';

  // ── ⭐ T26 (owner, 10-19) · ICONS, NOT WORDS — the ONE icon set the dock and every view inside it draw with ─────────
  // "As minimal as possible, only the necessary stuff, in minimal ICONS, not text." Every icon is a stroke in
  // currentColor (so it takes the theme and the one accent), drawn on a 24-unit grid, hidden from assistive tech — the
  // control that carries it has the words, as its aria-label AND its tooltip (title). A status is a SHAPE (✓ ! ↺), so
  // it reads in every theme with or without colour (D91).
  const ICONS = Object.freeze({
    move: 'M12 3v18M3 12h18M12 3 9.5 5.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5',
    dockLeft: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4v16',
    dockRight: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM15 4v16',
    pop: 'M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
    dockBack: 'M4 20l7-7M4 14v6h6M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4',
    minimise: 'M6 12h12',
    expand: 'M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    settings: 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zM12 3v2.6M12 18.4V21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M3 12h2.6M18.4 12H21M5.6 18.4l1.9-1.9M16.5 7.5l1.9-1.9',
    close: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    resize: 'M20 13l-7 7M20 7L7 20',
    fill: 'M4 6h9M4 11h6M4 16h4M13.5 19l.8-3.3 6-6a1.5 1.5 0 0 0-2.1-2.1l-6 6-.8 3.3z',
    ats: 'M5 20v-7M12 20V5M19 20v-4',
    resume: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9.5 13h6M9.5 17h6',
    copy: 'M10 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5 15H4.5a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 .5.5V5',
    check: 'M5 12.5l4.5 4.5L19 7',
    need: 'M12 5v9M12 18.6v.4',
    recheck: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.7h3.7',
    skip: 'M4 12h12M12 7l5 5-5 5M20 6v12',
    pin: 'M9 4h6M10 4v6l-3 4h10l-3-4V4M12 14v6',
    edit: 'M4 20l1.2-4.8L15.8 4.6a2 2 0 0 1 2.8 2.8L8 18z',
    attach: 'M19.5 11.5l-7.8 7.8a4.6 4.6 0 0 1-6.5-6.5l7.8-7.8a3.1 3.1 0 0 1 4.4 4.4l-7.8 7.8a1.5 1.5 0 0 1-2.2-2.2l7.1-7.1',
    generate: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 16v4M16.5 18h4',
    submitted: 'M20.5 3.5L10 14M20.5 3.5L14 20.5l-4-6.5-6.5-4z',
    blank: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM6 18L18 6',
    wait: 'M9 5.5v13M15 5.5v13',
    info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.5M12 7.6v.4',
    open: 'M7 17L17 7M9 7h8v8',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
    read: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z',
  });
  /** One icon's markup — decorative; the control that holds it carries the words (aria-label + title). */
  const icon = (name, size = 16) => (ICONS[name]
    ? `<svg class="ic" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name]}"/></svg>`
    : '');

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

  // ── ⭐ T28 (owner, 10-19) · THE LAUNCHER — "the floating panel that opens and closes should be a SQUARE BOX WITH THE
  // DRAFT LOGO and that's it — just like the /d button on the job posting; click it to open and close." The dock,
  // collapsed, is that square: it sits ON a screen edge (the nearest one to where it was let go), drags along it, and is
  // remembered per site apart from the open dock's rectangle (`place.launch`). A pop-out window still collapses to its
  // slim bar (layoutRect, below).
  /** The launcher's square: where it was put (`place.launch`); else on the open dock's side, level with its top. */
  function launchRect(place, vp) {
    const s = Math.min(LIMITS.launch, Math.max(0, Math.min(vp.w, vp.h) - 2 * LIMITS.margin));
    const p = place?.launch, r = place?.rect;
    const left = place?.edge === 'left' || (place?.edge !== 'right' && r && r.x + r.w / 2 < vp.w / 2);
    return snapLaunch({ x: Number.isFinite(p?.x) ? p.x : left ? LIMITS.margin : vp.w - LIMITS.margin - s,
      y: Number.isFinite(p?.y) ? p.y : Number.isFinite(r?.y) ? r.y : Math.round(vp.h / 2 - s / 2), w: s, h: s }, vp);
  }
  /** On screen, then onto the NEAREST edge. → { x, y, w, h, edge } */
  function snapLaunch(r, vp) {
    const m = LIMITS.margin, s = r.w;
    const x = clamp(r.x, m, vp.w - m - s), y = clamp(r.y, m, vp.h - m - s);
    const d = { left: x - m, right: vp.w - m - s - x, top: y - m, bottom: vp.h - m - s - y };
    const edge = Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
    return { x: Math.round(edge === 'left' ? m : edge === 'right' ? vp.w - m - s : x), y: Math.round(edge === 'top' ? m : edge === 'bottom' ? vp.h - m - s : y), w: s, h: s, edge };
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
    const launch = Number.isFinite(p?.launch?.x) && Number.isFinite(p?.launch?.y) ? { x: Math.round(p.launch.x), y: Math.round(p.launch.y) } : null;
    return { rect: rect(p?.rect), edge: EDGES.includes(p?.edge) ? p.edge : null, collapsed: p?.collapsed === true,
      tab: TAB_IDS.includes(p?.tab) ? p.tab : 'fill', pops, ...(launch ? { launch } : {}) };
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
    /* ⭐ T26 · LINE BUDGET: the header's rule is the dock's ONE divider — the tabs, the panes and the views below it are
       separated by spacing, never by another border. */
    .hd { display: flex; align-items: center; gap: 2px; padding: 8px 6px 8px 12px; border-bottom: 1px solid var(--c-border);
      cursor: grab; user-select: none; touch-action: none; flex: none; }
    .hd.dragging { cursor: grabbing; }
    .mk { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 18px; letter-spacing: -.02em; line-height: 1;
      color: var(--c-logo-word); forced-color-adjust: none; }
    .mk .sl { color: var(--c-logo-slash); }
    .ttl { font-size: 12px; font-weight: 700; color: var(--c-ink-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .sp { flex: 1; min-width: 4px; }
    /* ⛔ D60: rectangles — a 28px control at radius 8; the tab is a box with a 3px bar, never a capsule.
       ⭐ T26: a header control is a GHOST icon — no border and no fill until the pointer or the keyboard is on it. */
    .ib { width: 28px; height: 28px; flex: none; border-radius: 8px; border: 0; background: transparent;
      color: var(--c-ink-muted); cursor: pointer; padding: 0; display: inline-grid; place-items: center; }
    .ib:hover, .ib:focus-visible { color: var(--c-ink); background: var(--c-surface-solid); }
    .ic { display: block; flex: none; }
    .ib[data-role="move"] { cursor: move; }
    .ib:focus-visible, .tab:focus-visible, .btn:focus-visible, .grip:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    .st { flex: none; padding: 6px 8px 0; }
    .st:not(.has) { display: none; }
    /* ⭐ T26: the four tabs are ICONS (the name is the tooltip and the accessible name); the shown one carries the ONE
       accent as a 3px bar. No rule under the row. */
    .tabs { display: flex; gap: 4px; padding: 6px 8px 2px; flex: none; overflow-x: auto; }
    .tab { padding: 5px 9px 4px; border: 0; border-bottom: 3px solid transparent; border-radius: 6px 6px 0 0; background: transparent;
      color: var(--c-ink-muted); cursor: pointer; display: inline-flex; align-items: center; }
    .tab:hover { color: var(--c-ink); }
    .tab[aria-selected="true"] { color: var(--c-ink); border-bottom-color: var(--c-accent); }
    /* D91 shape cues: the selected tab also says so by a shape, never by colour alone */
    :host([data-cues="shape"]) .tab[aria-selected="true"] { text-decoration: underline; text-underline-offset: 3px; }
    :host([data-cues="shape"]) .tab[aria-selected="true"]::before { content: "▸ "; }
    .body { flex: 1; min-height: 0; position: relative; }
    .pane { position: absolute; inset: 0; overflow: auto; }
    .pane[hidden] { display: none; }
    ::slotted([slot^="view-"]) { display: block; height: 100%; }
    /* ⭐ T26 · TEXT BUDGET: an empty tab is its icon, faint, and nothing else — the words are its accessible name. */
    .empty, .popped { padding: 28px 16px; color: var(--c-ink-faint); display: grid; gap: 14px; justify-items: center; }
    .mark-need { color: var(--c-warning); }
    .pane.is-popped slot { display: none; }
    .btn { font: inherit; font-size: 11.5px; font-weight: 700; padding: 6px 12px; min-height: 30px; border-radius: 8px; border: 0;
      background: var(--c-surface-solid); color: var(--c-ink); box-shadow: var(--c-depth-rest); cursor: pointer; }
    .btn:hover { box-shadow: var(--c-depth-hover); }
    /* ⭐ T21: the Fill button keeps ONE size through idle → filling → "12/43" — nothing beside it moves while a fill runs;
       the count's digits are all one width. ⭐ T26: it is the brand's square — the icon on the one accent. */
    .btn[data-role="fill"] { width: 64px; height: 52px; padding: 0; display: inline-grid; place-items: center; border-radius: 10px;
      background: var(--c-accent); color: var(--c-on-accent); box-shadow: var(--c-depth-accent);
      font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 12px; }
    .btn[data-role="fill"]:hover { box-shadow: var(--c-depth-accent); }
    .btn[data-role="fill"][aria-busy="true"] { cursor: progress; }
    @media (prefers-reduced-motion: no-preference) { .btn[data-role="fill"][aria-busy="true"] .ic { animation: rm-pulse 1.1s ease-in-out infinite; } }
    @keyframes rm-pulse { 50% { opacity: .45; } }
    .btn.ibtn { width: 34px; height: 34px; padding: 0; display: inline-grid; place-items: center; }
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
    /* ⭐ T28 · the launcher: the board's /d square — the orange, its depth, the mark; a dot when something needs you
       (a perfect circle — D60 keeps those round). No frame around it. */
    :host([data-draft-dock="dock"][data-collapsed="true"]) .fr { background: transparent; border: 0; box-shadow: none; backdrop-filter: none; overflow: visible; }
    .launch { position: relative; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 13px; display: grid; place-items: center;
      background: var(--c-accent); color: var(--c-on-accent); box-shadow: var(--c-depth-accent); cursor: pointer; touch-action: none; user-select: none; }
    .launch .mk, .launch .mk .sl { color: var(--c-on-accent); font-size: 19px; }
    .launch:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 3px; }
    .launch.dragging { cursor: grabbing; }
    .dot { position: absolute; top: 6px; right: 6px; width: 9px; height: 9px; border-radius: 50%; background: var(--c-on-accent); box-shadow: 0 0 0 2px var(--c-accent); }
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

  /** ⭐ T21 · the Fill button's words, from the frame's ONE fill state: idle · filling · filling with a count. */
  const fillWords = (f) => !f.filling ? 'Fill this page'
    : Number.isFinite(f.fillCount?.filled) && f.fillCount?.total > 0 ? `Filling… ${f.fillCount.filled} of ${f.fillCount.total}` : 'Filling…';
  /**
   * ⭐ T26 · what the Fill button SHOWS: its icon — the SAME icon while a fill runs (it pulses; nothing in the button is
   * re-made, T21's budget) — or, once the run reports a count, the count as numbers ("12/43"). Never a sentence: the
   * words are its aria-label (fillWords), and the tooltip.
   */
  const fillFace = (f) => (f.filling && Number.isFinite(f.fillCount?.filled) && f.fillCount?.total > 0
    ? `${f.fillCount.filled}/${f.fillCount.total}` : icon('fill', 22));

  // ── ⭐ T21 · NO FLICKER: draw by PATCHING what is there─────────────────────────────────────────────────────────────
  // Measured (owner report (e), 10-15; test-support/walks/fillFlicker.mjs): one fill pressed from the dock threw the
  // whole frame away and re-made it 4 times, re-made its Fill button 4 times, and re-mounted the Fill view (a new panel,
  // its scroll at the top) once per step. Every view now draws its markup as before and hands it to morph(), which
  // brings the live nodes to it: an unchanged node is left alone, a changed attribute or text is set, and only a node
  // of another kind is replaced. A form control that differs in any way is replaced whole (its live value is not
  // an attribute). One function, used by the dock and by the views drawn inside it (__draftDock.morph).
  function morphNode(from, to) {
    if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) { from.replaceWith(to); return; }
    if (from.nodeType !== 1) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return; }
    if (from.isEqualNode(to)) return;
    if (/^(?:INPUT|SELECT|TEXTAREA|OPTION)$/.test(from.nodeName)) { from.replaceWith(to); return; }
    for (const a of [...from.attributes]) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
    for (const a of [...to.attributes]) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
    morphChildren(from, to);
  }
  function morphChildren(from, to) {
    const fc = [...from.childNodes], tc = [...to.childNodes];
    for (let i = 0; i < tc.length; i++) { if (i < fc.length) morphNode(fc[i], tc[i]); else from.appendChild(tc[i]); }
    for (let i = tc.length; i < fc.length; i++) fc[i].remove();
  }
  /** Bring `el`'s children to `html` in place. → el */
  function morph(el, html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    morphChildren(el, tpl.content);
    return el;
  }

  // ── ONE frame: the dock, or a tab popped out of it ───────────────────────────────────────────────────────────────
  // z-order: the frame last pressed is on top of draft's others — all of them above the page.
  const FRAMES = new Set();
  function raise(f) { for (const o of FRAMES) o.host.style.zIndex = String(o === f ? 2147483646 : 2147483645); }

  function makeFrame({ id, kind, tab = null, title, theme, cues, rect, edge = null, collapsed = false, launch = null, onChange, onClose, onDockBack, onSelect, onLoad }) {
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
    const f = { id, kind, tab, host, root, fr, place: { rect, edge, collapsed, launch }, active: 'fill', summary: {}, statusText: '' };
    // ⭐ T28: the dock collapsed is the launcher (a pop-out collapsed is its slim bar); while it is dragged it goes where
    // the pointer takes it, and onto an edge when it is let go
    const launcherNow = () => kind === 'dock' && !!f.place.collapsed;
    const freeLaunch = () => { const v = vp(), m = LIMITS.margin, s = LIMITS.launch;
      return { x: Math.round(clamp(f.place.launch.x, m, v.w - m - s)), y: Math.round(clamp(f.place.launch.y, m, v.h - m - s)), w: s, h: s }; };
    const rectOf = () => (launcherNow() ? (f.launchFree && f.place.launch ? freeLaunch() : launchRect(f.place, vp())) : layoutRect(f.place, vp()));

    const vp = () => viewport();
    const apply = (settle = false) => {
      const r = rectOf();
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
    f.rectNow = () => rectOf();
    /** Move the frame by (dx, dy) from where it is drawn: off any edge, its own free size kept. */
    const shiftTo = (from, dx, dy, free) => {
      const r = { x: from.x + dx, y: from.y + dy, w: free.w, h: free.h };
      return f.place.collapsed ? r : clampRect(r, vp());
    };

    const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(hd => `<div class="rz" data-handle="${hd}" aria-hidden="true"></div>`).join('');
    const sideBtn = () => (host.dataset.side === 'right'
      ? `<button class="ib" data-role="dock" aria-label="Snap to the left" title="Snap to the left">${icon('dockLeft')}</button>`
      : `<button class="ib" data-role="dock" aria-label="Snap to the right" title="Snap to the right">${icon('dockRight')}</button>`);
    const moveBtn = `<button class="ib" data-role="move" aria-label="Move the panel — arrow keys move it, Ctrl+arrow snaps it to that edge" title="Move (arrow keys · Ctrl+arrow snaps)">${icon('move')}</button>`;
    // ⭐ T26 / T29: every setting lives on the extension's settings page; the gear opens it (the service worker opens the
    // tab — a page cannot). It is the dock's, not a pop-out's.
    const gearBtn = `<button class="ib" data-role="settings" aria-label="draft settings" title="Settings">${icon('settings')}</button>`;

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
        if (kind === 'dock') {
          // ⭐ T28 · the square and nothing else: its words are its name and tooltip (and, hidden, the slim bar's words)
          const name = `Open draft${words && words !== 'draft' ? ` — ${words}` : ''}`;
          morph(fr, `<button class="launch" data-role="expand" aria-expanded="false" aria-label="${esc(name)}" title="${esc(name)}">
              <span class="mk" aria-hidden="true"><span class="sl">/</span>d</span>${need ? '<span class="dot" data-role="need-dot" aria-hidden="true"></span>' : ''}
              <span class="sr" data-role="slim">${esc(words)}</span></button>`);
          return;
        }
        morph(fr, `<div class="slim" data-role="drag">
            <div class="mk" aria-hidden="true"><span class="sl">/</span>draft</div>
            <span class="slimtxt" data-role="slim">${need ? `<b>${esc(words)}</b>` : esc(words)}</span>
            ${moveBtn}
            <button class="ib" data-role="expand" aria-label="Expand the panel" title="Expand">${icon('expand')}</button>
            <button class="ib" data-role="close" aria-label="${kind === 'dock' ? 'Close the panel' : 'Back into the dock'}" title="${kind === 'dock' ? 'Close (Esc)' : 'Back into the dock'}">${icon('close')}</button>
          </div>`);
        return;
      }
      const tabs = kind === 'dock' ? `<div class="tabs" role="tablist" aria-label="draft">${TABS.map(t => `
          <button class="tab" role="tab" id="${id}-tab-${t.id}" data-role="tab" data-tab="${t.id}" aria-controls="${id}-pane-${t.id}"
            aria-selected="${t.id === f.active}" tabindex="${t.id === f.active ? 0 : -1}" aria-label="${esc(t.label)}" title="${esc(t.label)}">${icon(t.icon, 18)}</button>`).join('')}</div>` : '';
      const panes = kind === 'dock' ? TABS.map(t => `
          <div class="pane${f.popped?.has(t.id) ? ' is-popped' : ''}" role="tabpanel" id="${id}-pane-${t.id}" data-tab="${t.id}" aria-labelledby="${id}-tab-${t.id}"${t.id === f.active ? '' : ' hidden'}>
            ${f.popped?.has(t.id) ? `<div class="popped" data-role="popped" role="note" aria-label="${esc(t.label)} is open in its own window">${icon('pop', 28)}
              <button class="btn ibtn" data-role="dock-back" data-tab="${t.id}" aria-label="Bring ${esc(t.label)} back into the dock" title="Bring it back into the dock">${icon('dockBack')}</button></div>` : ''}
            <slot name="view-${t.id}"><div class="empty" data-role="empty" role="note" aria-label="${esc(EMPTY[t.id])}${f.loading === t.id ? ' Loading…' : ''}"${f.loading === t.id ? ' aria-busy="true"' : ''}>${
              t.id === 'fill' ? '' : icon(t.icon, 28)}${
              f.loadError?.[t.id] ? `<span class="mark-need" data-role="load-error" role="img" aria-label="${esc(f.loadError[t.id])}" title="${esc(f.loadError[t.id])}">${icon('need')}</span>` : ''}${
              t.id === 'fill' ? `<button class="btn" data-role="fill" aria-label="${esc(fillWords(f))}" title="Fill this page (Ctrl+Shift+Y)"${f.filling ? ' aria-busy="true" aria-disabled="true" data-busy="true"' : ''}>${fillFace(f)}</button>${
                f.fillSaid ? `<span class="mark-need" data-role="fill-said" role="img" aria-label="${esc(f.fillSaid)}" title="${esc(f.fillSaid)}">${icon('need')}</span>` : ''}` : ''}</div></slot>
          </div>`).join('')
        : `<div class="pane" data-tab="${tab}"><slot name="view-${tab}"><div class="empty">${esc(EMPTY[tab] || '')}</div></slot></div>`;
      // The status line's "has" mark is part of the markup (a patch would otherwise take it off); slotchange keeps it.
      const hasStatus = !!host.querySelector(':scope > [slot="status"]');
      morph(fr, `
        <div class="hd" data-role="drag">
          <div class="mk" aria-hidden="true"><span class="sl">/</span>draft</div>
          ${kind === 'pop' ? `<span class="ttl" data-role="title">${esc(title)}</span>` : '<span class="sr">draft</span>'}
          <span class="sp"></span>
          ${moveBtn}
          ${sideBtn()}
          ${kind === 'dock' ? `<button class="ib" data-role="pop" aria-label="Open this tab in its own window" title="Open this tab in its own window">${icon('pop')}</button>`
            : `<button class="ib" data-role="dock-back" aria-label="Back into the dock" title="Back into the dock">${icon('dockBack')}</button>`}
          <button class="ib" data-role="collapse" aria-label="Collapse the panel" title="Collapse">${icon('minimise')}</button>
          ${kind === 'dock' ? gearBtn : ''}
          <button class="ib" data-role="close" aria-label="${kind === 'dock' ? 'Close the panel' : 'Back into the dock'}" title="${kind === 'dock' ? 'Close (Esc)' : 'Back into the dock'}">${icon('close')}</button>
        </div>
        ${kind === 'dock' ? `<div class="st${hasStatus ? ' has' : ''}" data-role="status"><slot name="status"></slot></div>` : ''}
        ${tabs}
        <div class="body">${panes}</div>
        ${handles}
        <button class="grip" data-role="resize" aria-label="Resize the panel — arrow keys change its width and height" title="Resize (arrow keys)">${icon('resize', 12)}</button>`);
      const st = root.querySelector('[data-role="status"]');
      if (st && !st.__draftMarked) {
        st.__draftMarked = true;
        const slot = st.querySelector('slot');
        const mark = () => { const has = slot.assignedElements().length > 0; if (st.classList.contains('has') !== has) st.classList.toggle('has', has); };
        slot.addEventListener('slotchange', mark);
        mark();
      }
    };

    // ── pointer: drag by the header, resize from a handle ──
    let op = null;
    const onDown = (ev) => {
      raise(f);
      if (ev.button !== 0) return;
      if (launcherNow() && ev.target.closest?.('.launch')) {
        // the square holds the pointer from the press on: a drag that leaves its 52px still moves it (and, never having
        // moved, the press stays a click)
        const sq = ev.target.closest('.launch');
        try { sq.setPointerCapture?.(ev.pointerId); } catch { /* the page keeps the pointer */ }
        op = { kind: 'launch', x0: ev.clientX, y0: ev.clientY, start: f.rectNow(), moved: false, sq };
        return;
      }
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
      if (op.kind === 'launch') {
        op.moved = true;
        op.sq?.classList.add('dragging');
        f.launchFree = true;
        f.place = { ...f.place, launch: { x: op.start.x + dx, y: op.start.y + dy } };
        apply();
        return;
      }
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
      if (was.kind === 'launch') {
        // let go: onto the nearest edge, remembered; the click that follows a drag opens nothing
        was.sq?.classList.remove('dragging');
        f.launchFree = false;
        const r = launchRect(f.place, vp());
        f.place = { ...f.place, launch: { x: r.x, y: r.y } };
        f.suppressClick = true;
        setTimeout(() => { f.suppressClick = false; }, 0);
        f.draw();
        onChange?.();
        return;
      }
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
      if (role === 'expand' && launcherNow()) {
        ev.preventDefault();
        const d = ev.shiftKey ? LIMITS.bigStep : LIMITS.step;
        const r = f.rectNow();
        f.place = { ...f.place, launch: { x: r.x + a[0] * d, y: r.y + a[1] * d } };
        f.draw(); onChange?.();
        root.querySelector('[data-role="expand"]')?.focus();
        return;
      }
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
      if (role === 'expand' && f.suppressClick) { f.suppressClick = false; return; }   // ⭐ T28: that was a drag
      if (role === 'close') { if (kind === 'dock') onClose?.(); else onDockBack?.(); return; }
      if (role === 'collapse') { f.place = { ...f.place, collapsed: true }; f.draw(); onChange?.(); return; }
      if (role === 'expand') { f.place = { ...f.place, collapsed: false }; f.draw(); onChange?.(); return; }
      if (role === 'dock') {
        f.place = { ...f.place, edge: host.dataset.side === 'right' ? 'left' : 'right' };
        f.draw(); onChange?.(); return;
      }
      if (role === 'tab') { onSelect?.(btn.dataset.tab, { trusted: ev.isTrusted }); return; }
      if (role === 'pop') { f.onPop?.(); return; }
      // ⛔ the person's own click only — a page script's click opens nothing
      if (role === 'settings') { if (ev.isTrusted) void send({ type: 'OPEN_SETTINGS', trigger: 'click' }); return; }
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
      rect: frame.place.rect || (frame.place.collapsed ? null : frame.rectNow()) || defaultRect(viewport()), edge: frame.place.edge || null, collapsed: !!frame.place.collapsed, tab: frame.active,
      ...(frame.place.launch ? { launch: frame.place.launch } : {}),
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
      if (!r?.ok && !views.has(tab)) {
        frame.loadError = { ...(frame.loadError || {}), [tab]: r?.message || 'draft could not show this here.' };
        // ⭐ T27: an error is SAID as the dock's popup; the tab keeps a "!" whose tooltip says it again
        void globalThis.__draftPopups?.show?.({ id: 'rm-draft-dock-said', kind: 'toast', text: frame.loadError[tab], icon: 'need', tone: 'need', theme: meta.theme });
      }
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
      rect: saved.rect ? clampRect(saved.rect, vp0) : defaultRect(vp0), edge: saved.edge, collapsed: saved.collapsed, launch: saved.launch || null,
      onChange: save, onClose: closeAll, onSelect: (t, o) => select(t, o), onLoad: (t, trusted) => { if (trusted) loadTab(t); } });
    frame.active = saved.tab;
    frame.popped = new Set();
    frame.onPop = () => popOut(frame.active);
    frame.onFill = async () => {
      frame.filling = true; frame.fillSaid = ''; frame.fillCount = null;
      frame.draw();
      const r = await send({ type: 'DOCK_FILL', trigger: 'click' });
      frame.filling = false; frame.fillCount = null;
      // a fill that drew its panel replaced this empty state; one that did not says why, here
      frame.fillSaid = r?.ok ? '' : (r?.message || 'draft could not fill this page.');
      if (frame.fillSaid) void globalThis.__draftPopups?.show?.({ id: 'rm-draft-dock-said', kind: 'toast', text: frame.fillSaid, icon: 'need', tone: 'need', theme: meta.theme });
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
      if (frame.place.collapsed) {
        // ⭐ T28: the launcher steps across to the other side of the screen (a step aside is not the person's choice:
        // not remembered)
        const vp = viewport(), r = frame.rectNow();
        frame.place = { ...frame.place, launch: { x: vp.w - r.x - r.w, y: r.y } };
        frame.draw();
        return;
      }
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
          for (const f of [frame, ...pops.values()]) { const s = f.root.querySelector('style'); const css = FRAME_CSS(m.theme, LOGO); if (s && s.textContent !== css) s.textContent = css; }
          loadLogo(m.theme);
        }
        if (m && 'cues' in m) for (const f of [frame, ...pops.values()]) { if (m.cues) f.host.setAttribute('data-cues', 'shape'); else f.host.removeAttribute('data-cues'); }
      },
      /**
       * The host element for a tab's view — a fresh one (the tab's previous view is cleaned up and removed). The caller
       * attaches its own shadow root and draws inside it. `expand`: open the dock if collapsed; `select`: show this tab.
       */
      view(tab, { id, label = null, select: sel = true, expand = false, onClose = null, reuse = null } = {}) {
        if (!TAB_IDS.includes(tab)) throw new Error(`unknown dock tab ${tab}`);
        const prior = views.get(tab);
        // ⭐ T21: the SAME view drawn again (a wizard step's re-draw of one fill: `reuse` names the run) keeps its element —
        // its shadow root, its scroll and its focus — and the dock is drawn only if this changes what it shows.
        if (reuse != null && prior?.el.isConnected && prior.el.dataset.reuse === String(reuse)) {
          if (onClose) prior.onClose = onClose;
          const was = { active: frame.active, collapsed: !!frame.place.collapsed };
          if (expand && frame.place.collapsed) frame.place = { ...frame.place, collapsed: false };
          if (sel) frame.active = tab;
          if (was.active !== frame.active || was.collapsed !== !!frame.place.collapsed) frame.draw();
          return prior.el;
        }
        if (prior) { try { prior.el.__draftCleanup?.(); } catch { /* gone */ } prior.el.remove(); }
        const old = id ? document.getElementById(id) : null;
        if (old && old !== frame.host) { try { old.__draftCleanup?.(); } catch { /* gone */ } old.remove(); }
        const el = document.createElement('div');
        if (id) el.id = id;
        el.slot = `view-${tab}`;
        el.setAttribute('data-draft-view', tab);
        if (label) el.setAttribute('aria-label', label);
        if (reuse != null) el.dataset.reuse = String(reuse);
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
      summary(tab, text, { need = 0, filled = null, total = null } = {}) {
        const was = frame.summary[tab];
        frame.summary[tab] = text ? { text: String(text), need } : null;
        // ⭐ T21: while a fill runs, its count is the Fill button's ("Filling… 12 of 43") — one state, patched in place.
        if (tab === 'fill' && frame.filling && Number.isFinite(filled) && Number.isFinite(total)) frame.fillCount = { filled, total };
        if (frame.place.collapsed ? was?.text !== frame.summary[tab]?.text || was?.need !== frame.summary[tab]?.need : tab === 'fill' && frame.filling) frame.draw();
        const p = pops.get(tab);
        if (p) { p.summary[tab] = frame.summary[tab]; if (p.place.collapsed) p.draw(); }
      },
      statusText(text) {
        const next = String(text || '');
        if (next === frame.statusText) return;                     // ⭐ T21: the same words draw nothing
        frame.statusText = next;
        if (frame.place.collapsed) frame.draw();
      },
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
    limitsFor, clampRect, defaultRect, layoutRect, moveRect, resizeRect, edgeAtPointer, cleanPlace, launchRect, snapLaunch,
    // the page
    isTop, ensure,
    // ⭐ T21: the one in-place patch every view draws with
    morph,
    // ⭐ T26: the one icon set every view draws with
    ICONS, icon,
    current: () => (DOCK && DOCK.frame.host.isConnected ? DOCK : null),
  });
})();
