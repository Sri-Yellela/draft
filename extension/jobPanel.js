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

  const css = `
    :host { all: initial; display: block; height: 100%; }
    .p { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
         color: ${c.INK}; }
    .st { display: flex; align-items: center; gap: 7px; padding: 8px 16px 0; font-size: 12px; color: ${c.INK_MUTED}; }
    .st::before { content: ""; width: 7px; height: 7px; border-radius: 50%; flex: none; background: ${c.INK_FAINT}; }
    .st[data-tone="ok"]::before { background: ${c.SUCCESS}; }
    .st[data-tone="busy"]::before { background: ${c.ACCENT}; }
    .job { display: grid; grid-template-columns: 36px 1fr; gap: 12px; align-items: center; padding: 14px 16px 14px; }
    .lg { width: 36px; height: 36px; border-radius: 8px; display: grid; place-items: center; overflow: hidden; font-weight: 700; font-size: 16px;
          background: ${c.TILE_SLATE}; color: ${c.ON_TILE}; }
    .lg img { width: 100%; height: 100%; object-fit: contain; background: ${c.SURFACE_SOLID}; }
    .jt { font-size: 16px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
    .js { color: ${c.INK_MUTED}; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tx { min-width: 0; }
    /* ⛔ D60: the ONE button is a depth box (radius 10), never a capsule */
    .go { margin: 0 16px; font: 600 15px system-ui, -apple-system, "Segoe UI", sans-serif; padding: 12px; border-radius: 10px; border: 0; cursor: pointer;
          background: ${c.ACCENT}; color: ${c.ON_ACCENT}; box-shadow: ${c.DEPTH_ACCENT || 'none'}; }
    .go:disabled { cursor: default; background: ${c.SURFACE_SOLID}; color: ${c.INK_MUTED}; box-shadow: ${c.DEPTH_REST || 'none'}; }
    .go:focus-visible, .opt:focus-visible, .ln:focus-visible { outline: 2px solid ${c.ACCENT_INK}; outline-offset: 2px; }
    .nt { margin: 8px 16px 0; font-size: 12px; color: ${c.INK_MUTED}; text-align: center; }
    .ln { font: inherit; font-weight: 600; color: ${c.ACCENT_INK}; background: none; border: 0; padding: 0; cursor: pointer; }
    .said { margin: 8px 16px 0; font-size: 12px; color: ${c.WARNING}; text-align: center; }
    .said:empty { display: none; }
    .mid { flex: 1; min-height: 12px; }
    .how { border-top: 1px solid ${c.BORDER}; padding: 12px 16px 12px; display: grid; gap: 8px; }
    .hh { display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; font-weight: 600; letter-spacing: .08em;
          text-transform: uppercase; color: ${c.INK_FAINT}; }
    .hh .ln { text-transform: none; letter-spacing: 0; font-size: 12px; font-weight: 500; color: ${c.INK_MUTED}; }
    .opt { justify-self: start; font: 500 12.5px system-ui, -apple-system, "Segoe UI", sans-serif; padding: 6px 10px; border-radius: 8px;
           border: 1px solid ${c.BORDER}; background: ${c.SURFACE_SOLID}; color: ${c.INK}; box-shadow: ${c.DEPTH_REST || 'none'}; cursor: pointer; }
    .opt[aria-checked="true"] { background: ${c.SUCCESS_QUIET}; color: ${c.SUCCESS}; border-color: transparent; }
    .ft { border-top: 1px solid ${c.BORDER}; padding: 10px 16px; }
    .ft .ln { color: ${c.INK}; }
    /* ⭐ B3 · any other page: the day (three counts, each opens draft) and ONE box — search jobs, or ask draft */
    .day { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 14px 16px 4px; }
    .tile { font: 500 11px system-ui, -apple-system, "Segoe UI", sans-serif; color: ${c.INK_MUTED}; text-align: center; padding: 8px 4px;
            border: 1px solid ${c.BORDER}; border-radius: 8px; background: ${c.SURFACE_SOLID}; box-shadow: ${c.DEPTH_REST || 'none'}; cursor: pointer; }
    .tile b { display: block; font-size: 18px; font-weight: 700; color: ${c.INK}; font-variant-numeric: tabular-nums; }
    .ask { display: flex; gap: 6px; padding: 12px 16px 0; }
    .ask input { flex: 1; min-width: 0; font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; padding: 9px 10px; border-radius: 8px;
                 border: 1px solid ${c.BORDER_CONTROL || c.BORDER}; background: ${c.SURFACE_INPUT || c.SURFACE_SOLID}; color: ${c.INK}; }
    .ask input:focus-visible, .tile:focus-visible { outline: 2px solid ${c.ACCENT_INK}; outline-offset: 2px; }
    .reply { margin: 10px 16px 0; font-size: 12.5px; color: ${c.INK}; }
    .reply:empty { display: none; }
    .reply .lb { display: block; font-size: 10.5px; color: ${c.INK_FAINT}; margin-bottom: 2px; }
    .reply .yn { display: flex; gap: 6px; margin-top: 6px; }
  `;
  const m = model;
  const job = m.job ? `<div class="job"><div class="lg" aria-hidden="true">${m.job.logo ? `<img alt="" src="${esc(m.job.logo)}" referrerpolicy="no-referrer">` : esc(m.job.letter)}</div>
      <div class="tx"><div class="jt" data-role="title">${esc(m.job.title)}</div>${m.job.sub ? `<div class="js" title="${esc(m.job.sub)}">${esc(m.job.sub)}</div>` : ''}</div></div>` : '<div class="job"></div>';
  const note = m.note ? `<div class="nt" data-role="note">${m.note.act ? `<button class="ln" data-act="${esc(m.note.act)}">${esc(m.note.text)}</button>` : esc(m.note.text)}</div>` : '';
  const sw = (key, on, words) => `<button class="opt" role="switch" data-set="${key}" aria-checked="${on ? 'true' : 'false'}">${on ? '✓ ' : ''}${esc(words)}</button>`;
  const how = m.how ? `<div class="how" role="group" aria-label="How I apply"><div class="hh"><span>How I apply</span><button class="ln" data-act="auto-setup">All settings</button></div>
      ${sw('review', m.how.review, 'Review before I submit')}${sw('autoOpen', m.how.autoOpen, 'Open by itself on job boards')}</div>` : '';
  root.innerHTML = `<style>${css}</style><div class="p" role="region" aria-label="draft — this job">
      <div class="st" data-role="status" data-tone="${esc(m.status?.tone || 'quiet')}" role="status">${esc(m.status?.text || '')}</div>
      ${m.day ? `<div class="day" role="group" aria-label="Your day">${m.day.map(d => `<button class="tile" data-act="${esc(d.act)}"><b>${esc(d.n)}</b>${esc(d.label)}</button>`).join('')}</div>` : job}
      ${m.button ? `<button class="go" data-role="go" ${m.button.act ? `data-act="${esc(m.button.act)}"` : ''}${m.button.disabled ? ' disabled' : ''}>${esc(m.button.label || '')}</button>` : ''}
      ${m.ask ? `<div class="ask"><input id="rm-draft-ask-input" type="text" maxlength="600" placeholder="Search jobs, or ask draft" aria-label="Search jobs, or ask draft" autocomplete="off">
        <button class="opt" data-role="ask-go" type="button">Go</button></div><div class="reply" data-role="reply" role="status" aria-live="polite"></div>` : ''}
      ${note}<div class="said" data-role="said" role="alert"></div>
      <div class="mid"></div>${how}
      <div class="ft"><button class="ln" data-act="open-draft">Open draft ↗</button></div></div>`;
  const img = root.querySelector('.lg img');
  if (img) img.addEventListener('error', () => { img.parentElement.textContent = m.job?.letter || ''; }, { once: true });

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
    if (ev.target.closest?.('[data-role="ask-go"]')) { const i = root.getElementById('rm-draft-ask-input'); const v = i?.value || ''; if (i) i.value = ''; void ask(v); return; }
    const yes = ev.target.closest?.('[data-say]');
    if (yes) { void ask(yes.dataset.say); return; }
    const set = ev.target.closest?.('[data-set]');
    if (set) {
      const on = set.getAttribute('aria-checked') !== 'true';
      set.setAttribute('aria-checked', String(on));
      set.textContent = `${on ? '✓ ' : ''}${set.dataset.set === 'review' ? 'Review before I submit' : 'Open by itself on job boards'}`;
      const r = await send({ type: 'PANEL_SETTING', key: set.dataset.set, value: on, trigger: 'click' });
      if (r && r.ok === false && said) said.textContent = r.say || 'Could not change that — try again.';
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
