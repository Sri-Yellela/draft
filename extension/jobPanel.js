// ── ⭐ D191 sketch 2 · THE PANEL — the dock's home tab (`draft`, "This job") ─────────────────────────────────────────
//
// The owner, 11-18 ("alright go", on https://claude.ai/artifact/4HugMVyxHnjysbCC23okZj v2): ONE tall, quiet panel in
// Tsenta's shape — the status line, the job, ONE button, at most one line under it, empty space, "How I apply" at the
// bottom, "Open draft". The words are jobPanelModel.js's (pure, tested); this function only draws them.
//
// ⭐ T17: the window it sits in — drag, collapse to the /d square, close, Esc, where it sits on this site — is the dock's
// (extension/dock.js). ⛔ No drag, resize, snap or placement code here (test/t17Dock.test.js).
// Every button is the person's own click → DOCK_ACT (background.js) with trigger 'click', on THIS tab; the switches →
// PANEL_SETTING. ⛔ D36: nothing here submits — "Apply from here" / "Fill this form" fill, the person presses Submit.
//
// renderJobPanel is SERIALISED into the page by chrome.scripting.executeScript (isolated world, the TOP frame, after
// dock.js), so it closes over nothing: the model, the palettes (extension/tokens.js — never a colour literal) and the
// dock's meta arrive as arguments.

/* exported renderJobPanel */
export function renderJobPanel(model, theme, dockMeta) {
  const HOST_ID = 'rm-draft-job-panel';
  const D = globalThis.__draftDock;
  const dock = D?.ensure?.(dockMeta || {}) || null;
  if (!dock) return { rendered: false, error: D ? 'not_top_frame' : 'no_dock' };
  if (!model) { const prior = document.getElementById(HOST_ID); if (prior) dock.drop('draft', prior); return { rendered: false, closed: true }; }

  const dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const c = (dark ? theme?.dark : theme?.light) || {};
  const host = dock.view('draft', { id: HOST_ID, label: 'draft — this job', expand: !!model.expand, select: true, reuse: 'job' });
  host.setAttribute('data-draft-job-panel', model.kind || '');
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  // the status line: the match % (when the line carries one) in its band's colour, then the rest of the words as they were
  const statusHtml = (st) => { const t = String(st?.text || ''), m = st?.match ? String(st.match) : '';
    if (!m || !t.includes(m)) return esc(t);
    const k = t.indexOf(m);
    return `${esc(t.slice(0, k))}<span class="m" data-band="${esc(st.band || '')}">${esc(m)}</span>${esc(t.slice(k + m.length))}`; };

  // ⭐ D197 #19 M5 (47m) · THE PANEL IN THE PLATE (client/src/plate/Panels.jsx FloatingPanel + the mock
  // client/src/pages/dev/platePages/ExtensionPanel.jsx — the MIRRORS row): paper ground, a mono status kicker, the opening on
  // a card-white tile (the letter tile in region IV, the serif title), THE button the one clay point (an ink edge, a hard
  // shadow — never a capsule, D60), How I apply as plate toggles under a 1.5 px ink rule, the foot on card. Every colour is
  // a token: the plate palette (`p`, tokens.js C_PLATE — paper in every scheme), the band colours from the account's palette
  // (`c`). An older service worker without the plate palette falls back to `c`.
  const p = theme?.plate || {};
  const P = (k, fb) => p[k] || c[fb] || '';
  const SERIF = `'rm-draft-serif', 'Instrument Serif', Georgia, 'Times New Roman', serif`;   // 47o: the dock loads rm-draft-serif
  const SANS = `'Inter Tight', 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  const MONO = `'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace`;
  const css = `
    :host { all: initial; display: block; height: 100%; }
    .p { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; font: 13px/1.45 ${SANS};
         color: ${P('INK', 'INK')}; background: ${P('PAPER', 'SURFACE_SOLID')}; }
    .st { display: flex; align-items: center; gap: 8px; padding: 10px 16px 0; font: 700 10.5px/1.4 ${MONO}; letter-spacing: .12em;
          text-transform: uppercase; color: ${P('INK_SOFT', 'INK_MUTED')}; }
    .st::before { content: ""; width: 6px; height: 6px; border-radius: 50%; flex: none; background: ${P('MUTED_2', 'INK_FAINT')}; }
    .st[data-tone="ok"]::before { background: ${P('LIT', 'SUCCESS')}; }
    .st[data-tone="busy"]::before { background: ${P('CLAY', 'ACCENT')}; }
    /* ⭐ 46x: the ATS number's colour is its band — no word (owner 11-19) */
    .st .m { font-weight: 700; }
    .st .m[data-band="strong"] { color: ${c.BAND_STRONG}; } .st .m[data-band="moderate"] { color: ${c.BAND_MODERATE}; } .st .m[data-band="weak"] { color: ${c.BAND_WEAK}; }
    .job { display: grid; grid-template-columns: 38px 1fr; gap: 12px; align-items: center; margin: 12px 16px 12px; padding: 12px;
           background: ${P('CARD', 'SURFACE_SOLID')}; border: 1.5px solid ${P('INK', 'BORDER')}; border-radius: 12px; }
    .job:empty { display: none; }
    .lg { width: 38px; height: 38px; box-sizing: border-box; border-radius: 8px; display: grid; place-items: center; overflow: hidden;
          font: 400 20px/1 ${SERIF}; background: ${P('R4_TINT', 'TILE_SLATE')}; color: ${P('R4', 'ON_TILE')}; border: 1.5px solid ${P('R4', 'BORDER')}; }
    .lg img { width: 100%; height: 100%; object-fit: contain; background: ${P('CARD', 'SURFACE_SOLID')}; }
    .jt { font: 400 19px/1.15 ${SERIF}; color: ${P('INK', 'INK')}; overflow-wrap: anywhere; }
    .js { color: ${P('MUTED', 'INK_MUTED')}; font-size: 12.5px; font-weight: 600; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tx { min-width: 0; }
    /* ⛔ D60: the ONE button is the plate's primary box (radius 12, an ink edge, a hard shadow), never a capsule — the one clay point */
    .go { margin: 0 16px; font: 800 15px ${SANS}; padding: 12px; min-height: 44px; border-radius: 12px; border: 1.5px solid ${P('INK', 'ACCENT')}; cursor: pointer;
          background: ${P('CLAY', 'ACCENT')}; color: ${P('ON_CLAY', 'ON_ACCENT')}; box-shadow: 3px 3px 0 ${P('INK', 'INK')}; }
    .go:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 1px 1px 0 ${P('INK', 'INK')}; }
    .go:disabled { cursor: default; background: ${P('CARD', 'SURFACE_SOLID')}; color: ${P('MUTED', 'INK_MUTED')}; border-style: dashed; box-shadow: none; }
    .go:focus-visible, .opt:focus-visible, .ln:focus-visible { outline: 2px solid ${P('CLAY_TEXT', 'ACCENT_INK')}; outline-offset: 2px; }
    .nt { margin: 8px 16px 0; font-size: 12px; color: ${P('MUTED', 'INK_MUTED')}; text-align: center; }
    .ln { font: inherit; font-weight: 700; color: ${P('INK', 'ACCENT_INK')}; text-decoration: underline; text-underline-offset: 2px; background: none; border: 0; padding: 0; cursor: pointer; }
    .said { margin: 8px 16px 0; font-size: 12px; color: ${P('CLAY_TEXT', 'WARNING')}; text-align: center; }
    .said:empty { display: none; }
    .mid { flex: 1; min-height: 12px; }   /* stretches only when the person made the dock taller than the panel */
    .how { border-top: 1.5px solid ${P('INK', 'BORDER')}; padding: 12px 16px 12px; display: grid; gap: 8px; }
    .hh { display: flex; justify-content: space-between; align-items: center; font: 700 10.5px/1.4 ${MONO}; letter-spacing: .12em;
          text-transform: uppercase; color: ${P('MUTED', 'INK_FAINT')}; }
    .hh .ln { font: 700 12px ${SANS}; text-transform: none; letter-spacing: 0; color: ${P('INK', 'INK_MUTED')}; }
    .opt { justify-self: start; font: 700 12.5px ${SANS}; padding: 8px 12px; min-height: 36px; border-radius: 10px;
           border: 1.5px solid ${P('INK', 'BORDER')}; background: ${P('CARD', 'SURFACE_SOLID')}; color: ${P('INK', 'INK')}; box-shadow: 2px 2px 0 ${P('INK', 'INK')}; cursor: pointer; }
    .opt[aria-checked="false"] { background: ${P('PAPER_WARM', 'SURFACE_SOLID')}; color: ${P('MUTED', 'INK_MUTED')}; box-shadow: none; }
    .opt[data-role="resume"] { background: ${P('PAPER', 'SURFACE_SOLID')}; }
    .ft { border-top: 1.5px solid ${P('INK', 'BORDER')}; padding: 10px 16px; background: ${P('CARD', 'SURFACE_SOLID')}; }
    .ft .ln { color: ${P('INK', 'INK')}; }
    /* ⭐ B3 · any other page: the day (three counts, each opens draft — a stats strip, D200 Rule 2) and ONE box — search jobs, or ask draft */
    .day { display: grid; grid-template-columns: repeat(3, 1fr); margin: 12px 16px 4px; border: 1.5px solid ${P('INK', 'BORDER')}; border-radius: 14px;
           overflow: hidden; background: ${P('CARD', 'SURFACE_SOLID')}; }
    .tile { font: 700 10px/1.3 ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: ${P('MUTED', 'INK_MUTED')}; text-align: left; padding: 10px 10px;
            border: 0; border-left: 1.5px solid ${P('INK', 'BORDER')}; background: transparent; cursor: pointer; }
    .tile:first-child { border-left: 0; }
    .tile b { display: block; font: 400 26px/1 ${SERIF}; color: ${P('INK', 'INK')}; margin-bottom: 6px; letter-spacing: 0; font-variant-numeric: tabular-nums; }
    .ask { display: flex; gap: 6px; padding: 12px 16px 0; }
    .ask input { flex: 1; min-width: 0; font: 13px ${SANS}; padding: 9px 10px; border-radius: 10px;
                 border: 1.5px solid ${P('INK', 'BORDER_CONTROL')}; background: ${P('CARD', 'SURFACE_SOLID')}; color: ${P('INK', 'INK')}; }
    .ask input:focus-visible, .tile:focus-visible { outline: 2px solid ${P('CLAY_TEXT', 'ACCENT_INK')}; outline-offset: 2px; }
    .reply { margin: 10px 16px 0; font-size: 12.5px; color: ${P('INK', 'INK')}; }
    .reply:empty { display: none; }
    .reply .lb { display: block; font: 700 10px/1.4 ${MONO}; letter-spacing: .12em; text-transform: uppercase; color: ${P('MUTED', 'INK_FAINT')}; margin-bottom: 2px; }
    .reply .yn { display: flex; gap: 6px; margin-top: 6px; }
    /* ⭐ B4 · Résumé ▾ — the job profiles, one press switches the active one (as the site's own switcher does) */
    .pick { display: grid; gap: 4px; padding: 2px 0 2px 8px; }
    .pick[hidden] { display: none; }
    .pick button { justify-self: start; font: 600 12.5px ${SANS}; color: ${P('INK', 'INK')}; background: none; border: 0; padding: 3px 0; cursor: pointer; }
    .pick button[aria-current="true"] { color: ${P('CLAY_TEXT', 'ACCENT_INK')}; font-weight: 800; }
    .pick button:focus-visible { outline: 2px solid ${P('CLAY_TEXT', 'ACCENT_INK')}; outline-offset: 2px; }
    /* ⭐ D197 #19 (47n) · More → the skill squares (green only for proven: on your résumé; the rest an ink outline, dashed) */
    .sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .more { margin: 8px 16px 0; text-align: center; font-size: 12px; }
    .sqs { display: grid; gap: 6px; justify-items: center; margin-top: 8px; }
    .sqs[hidden] { display: none; }
    .sqw { font: 700 10.5px/1.4 ${MONO}; letter-spacing: .1em; text-transform: uppercase; color: ${P('MUTED', 'INK_MUTED')}; }
    .sqr { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; list-style: none; margin: 0; padding: 0; }
    .sq { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: ${P('INK', 'INK')}; }
    .sq i { width: 12px; height: 12px; box-sizing: border-box; border-radius: 2px; flex: none; border: 1.5px dashed ${P('MUTED', 'INK_MUTED')}; }
    .sq[data-on] i { background: ${P('LIT', 'SUCCESS')}; border: 1.5px solid ${P('INK', 'INK')}; }
  `;
  const m = model;
  const job = m.job ? `<div class="job"><div class="lg" aria-hidden="true">${m.job.logo ? `<img alt="" src="${esc(m.job.logo)}" referrerpolicy="no-referrer">` : esc(m.job.letter)}</div>
      <div class="tx"><div class="jt" data-role="title">${esc(m.job.title)}</div>${m.job.sub ? `<div class="js" title="${esc(m.job.sub)}">${esc(m.job.sub)}</div>` : ''}</div></div>` : '<div class="job"></div>';
  const note = m.note ? `<div class="nt" data-role="note">${m.note.act ? `<button class="ln" data-act="${esc(m.note.act)}">${esc(m.note.text)}</button>` : esc(m.note.text)}</div>` : '';
  const skills = m.skills && Array.isArray(m.skills.squares) && m.skills.squares.length ? m.skills : null;
  const more = skills ? `<div class="more"><button class="ln" data-role="more" aria-expanded="false" aria-controls="rm-draft-skills">More</button>
      <div class="sqs" id="rm-draft-skills" hidden><span class="sqw">${esc(skills.words)}</span><ul class="sqr" aria-label="${esc(skills.words)}">${skills.squares
        .map(s => `<li class="sq"${s.on ? ' data-on=""' : ''} title="${esc(s.label)} — ${s.on ? 'on your résumé' : 'not on your résumé yet'}"><i aria-hidden="true"></i>${esc(s.label)}<span class="sr"> (${s.on ? 'on your résumé' : 'not on your résumé yet'})</span></li>`).join('')}</ul></div></div>` : '';
  const sw = (key, on, words) => `<button class="opt" role="switch" data-set="${key}" aria-checked="${on ? 'true' : 'false'}">${on ? '✓ ' : ''}${esc(words)}</button>`;
  const how = m.how ? `<div class="how" role="group" aria-label="How I apply"><div class="hh"><span>How I apply</span><button class="ln" data-act="auto-setup">All settings</button></div>
      ${m.how.resume ? `<button class="opt" data-role="resume" aria-haspopup="true" aria-expanded="false">Résumé: ${esc(m.how.resume)} ▾</button><div class="pick" data-role="resume-list" hidden></div>` : ''}
      ${sw('review', m.how.review, 'Review before I submit')}${sw('autoOpen', m.how.autoOpen, 'Open by itself on job boards')}</div>` : '';
  root.innerHTML = `<style>${css}</style><div class="p" role="region" aria-label="draft — this job">
      <div class="st" data-role="status" data-tone="${esc(m.status?.tone || 'quiet')}" role="status">${statusHtml(m.status)}</div>
      ${m.day ? `<div class="day" role="group" aria-label="Your day">${m.day.map(d => `<button class="tile" data-act="${esc(d.act)}"><b>${esc(d.n)}</b>${esc(d.label)}</button>`).join('')}</div>` : job}
      ${m.button ? `<button class="go" data-role="go" ${m.button.act ? `data-act="${esc(m.button.act)}"` : ''}${m.button.disabled ? ' disabled' : ''}>${esc(m.button.label || '')}</button>` : ''}
      ${m.ask ? `<div class="ask"><input id="rm-draft-ask-input" type="text" maxlength="600" placeholder="Search jobs, or ask draft" aria-label="Search jobs, or ask draft" autocomplete="off">
        <button class="opt" data-role="ask-go" type="button">Go</button></div><div class="reply" data-role="reply" role="status" aria-live="polite"></div>` : ''}
      ${note}${more}<div class="said" data-role="said" role="alert"></div>
      <div class="mid"></div>${how}
      <div class="ft"><button class="ln" data-act="open-draft">Open draft ↗</button></div></div>`;
  const img = root.querySelector('.lg img');
  if (img) img.addEventListener('error', () => { img.parentElement.textContent = m.job?.letter || ''; }, { once: true });
  // ⭐ D191 (owner 11-19: "the panel is as long as the content"): its natural height — the content without the middle's
  // stretch — goes to the dock, which sizes the home tab to it (capped at the viewport; a person's own resize wins).
  const fitDock = () => {
    const p = root.querySelector('.p'), mid = root.querySelector('.mid');
    if (!p || typeof dock.fit !== 'function') return;
    const natural = [...p.children].reduce((n, el) => n + (el === mid ? 12 : el.offsetHeight + (parseFloat(getComputedStyle(el).marginTop) || 0) + (parseFloat(getComputedStyle(el).marginBottom) || 0)), 0);
    if (natural > 0) dock.fit('draft', natural);
  };
  fitDock();
  requestAnimationFrame(fitDock);
  // the résumé list, a reply, a said line change the content's height after the draw — the dock follows (the middle is
  // not observed: it is the dock's height, and following it would loop)
  try { root.__draftFit?.disconnect(); } catch { /* a stale observer */ }
  if (typeof ResizeObserver === 'function') {
    root.__draftFit = new ResizeObserver(() => fitDock());
    for (const el of root.querySelector('.p')?.children || []) if (!el.classList.contains('mid')) root.__draftFit.observe(el);
  }
  if (img) img.addEventListener('load', fitDock, { once: true });

  // ⭐ never over the employer's Apply control: its box, found by its words; the dock steps to the other side (dock.avoid)
  let stepped = false;
  try {
    const words = /^\s*(?:apply(?:\s+(?:now|for\s+this\s+(?:job|position|role)|to\s+this\s+job))?|easy\s+apply)\s*$/i;
    const ctl = [...document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]')].slice(0, 600)
      .find(e => !e.closest('#rm-draft-dock') && words.test(e.value || e.textContent || '') && e.getClientRects().length > 0);
    if (ctl && typeof dock.avoid === 'function') stepped = dock.avoid(ctl.getBoundingClientRect());
  } catch { /* a page we cannot measure: the dock stays where it is */ }
  if (root.__draftWired) return { rendered: true, kind: m.kind || null, stepped };
  root.__draftWired = true;                                        // a redraw keeps the one listener (reuse: 'job')
  const send = (msg) => new Promise((resolve) => { try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; resolve(r || null); }); } catch { resolve(null); } });
  // ⭐ B3 · the box: what is typed goes to the worker's Ask draft (PANEL_ASK — the site's engine, no model); the answer shows
  // under it, with Yes / No when the engine asks first. ⛔ D36·5: Enter calls the same function the button does (no form)
  const ask = async (text) => {
    const reply = root.querySelector('[data-role="reply"]');
    const q = String(text || '').trim();
    if (!q || !reply) return;
    reply.textContent = '…';
    const r = await send({ type: 'PANEL_ASK', text: q, trigger: 'click' });
    reply.replaceChildren();
    reply.dataset.tier = r?.tier || '';                            // T1 action · T2 from your data · ask (the walks read it)
    if (r?.label) reply.append(Object.assign(document.createElement('span'), { className: 'lb', textContent: r.label }));
    reply.append(document.createTextNode(r?.text || 'draft could not answer that — try again.'));
    if (r?.confirm) {
      const yn = Object.assign(document.createElement('div'), { className: 'yn' });
      for (const w of ['Yes', 'No']) yn.append(Object.assign(document.createElement('button'), { className: 'opt', type: 'button', textContent: w }));
      for (const b of yn.children) b.dataset.say = b.textContent;
      reply.append(yn);
    }
  };
  root.addEventListener('keydown', (ev) => {
    if (!ev.isTrusted || ev.key !== 'Enter' || ev.target?.id !== 'rm-draft-ask-input') return;
    ev.preventDefault();
    const v = ev.target.value; ev.target.value = ''; void ask(v);
  });
  root.addEventListener('click', async (ev) => {
    if (!ev.isTrusted) return;                                     // ⛔ the person's own click only
    const said = root.querySelector('[data-role="said"]');
    // ⭐ D197 #19 (47n): More opens the skill squares in place — nothing is sent
    const mb = ev.target.closest?.('[data-role="more"]');
    if (mb) { const box = root.getElementById('rm-draft-skills'); if (box) { box.hidden = !box.hidden; mb.setAttribute('aria-expanded', box.hidden ? 'false' : 'true'); mb.textContent = box.hidden ? 'More' : 'Less'; } return; }
    if (ev.target.closest?.('[data-role="ask-go"]')) { const i = root.getElementById('rm-draft-ask-input'); const v = i?.value || ''; if (i) i.value = ''; void ask(v); return; }
    // ⭐ B4 · Résumé ▾: the list on the person's click (PANEL_PROFILES), a pick switches the active job profile
    const rb = ev.target.closest?.('[data-role="resume"]');
    if (rb) {
      const list = root.querySelector('[data-role="resume-list"]');
      if (!list) return;
      if (!list.hidden) { list.hidden = true; rb.setAttribute('aria-expanded', 'false'); return; }
      const r = await send({ type: 'PANEL_PROFILES', trigger: 'click' });
      list.replaceChildren(...(r?.profiles || []).map(p => { const b = document.createElement('button'); b.type = 'button'; b.textContent = p.name;
        b.dataset.profile = String(p.id); if (p.active) b.setAttribute('aria-current', 'true'); return b; }));
      if (!list.children.length) { if (said) said.textContent = r?.say || 'draft could not list your job profiles — try again.'; return; }
      list.hidden = false; rb.setAttribute('aria-expanded', 'true');
      return;
    }
    const pick = ev.target.closest?.('[data-profile]');
    if (pick) {
      const r = await send({ type: 'PANEL_PROFILE_PICK', id: pick.dataset.profile, trigger: 'click' });
      if (!r?.ok && said) said.textContent = r?.say || 'draft could not switch the profile — try again.';
      return;   // the worker redraws the panel with the new name
    }
    const yes = ev.target.closest?.('[data-say]');
    if (yes) { void ask(yes.dataset.say); return; }
    const set = ev.target.closest?.('[data-set]');
    if (set) {
      const on = set.getAttribute('aria-checked') !== 'true';
      set.setAttribute('aria-checked', String(on));
      set.textContent = `${on ? '✓ ' : ''}${set.dataset.set === 'review' ? 'Review before I submit' : 'Open by itself on job boards'}`;
      const r = await send({ type: 'PANEL_SETTING', key: set.dataset.set, value: on, trigger: 'click' });
      if (r && r.ok === false) {
        // refused (the operator paused sending without review, signed out, a failed write): the switch goes back, says why
        set.setAttribute('aria-checked', String(!on));
        set.textContent = `${!on ? '✓ ' : ''}${set.dataset.set === 'review' ? 'Review before I submit' : 'Open by itself on job boards'}`;
        if (said) said.textContent = r.say || 'Could not change that — try again.';
      } else if (r?.say && said) said.textContent = r.say;   // 46x: what the mode now means (Apply for me / Ask me first)
      return;
    }
    const b = ev.target.closest?.('[data-act]');
    if (!b || b.disabled) return;
    if (said) said.textContent = '';
    if (b.dataset.role === 'go') { b.disabled = true; b.setAttribute('aria-busy', 'true'); }
    const r = await send({ type: 'DOCK_ACT', act: b.dataset.act, trigger: 'click' });
    if (b.isConnected && b.dataset.role === 'go') { b.disabled = false; b.removeAttribute('aria-busy'); }
    if (r?.say && said) said.textContent = r.say;
    // the worker reads this tab again and redraws the panel with what changed (Drafting…, Ready, Sent)
    if (['draft', 'add-draft', 'capture', 'fill'].includes(b.dataset.act)) void send({ type: 'PANEL_REFRESH', trigger: 'click' });
  });
  return { rendered: true, kind: m.kind || null, stepped };
}
