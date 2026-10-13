// ── THE COPY SHEET, IN THE PAGE — a panel that stays while you paste ─────────────────────────────
//
// Owner, 10-12: the Copy sheet lived in the toolbar popup, which Chrome closes the moment the page takes focus —
// so after every paste the popup had to be opened again, and it had no way to close. It is now a PANEL IN THE PAGE,
// in its own shadow root (the page's styles cannot reach in, and its own cannot leak out):
//
//   · it stays open while you click into the page's fields · Close, Esc, and Minimise · docks left or right, and the
//     tab remembers the side (with its binding — tabBinding.js) · every answer has a Copy button that says "Copied"
//   · it shows the PREPARED answers when the tab is bound to a job, says which job and where the answers came from,
//     and how many questions are unanswered · an eligibility answer keeps "you are attesting to this".
//   · ⛔ It never reads or writes the page's fields and holds no keystrokes: Esc is the one key it listens for, and
//     only to close itself. The copy is the user's own click, into their own clipboard.
//
// renderCopySheetPanel is SERIALISED into the page by chrome.scripting.executeScript (isolated world), so it closes
// over nothing: the sheet and the palettes (extension/tokens.js — never a colour literal) arrive as arguments.

/* exported renderCopySheetPanel */
export function renderCopySheetPanel(sheet, theme) {
  const HOST_ID = 'rm-copy-sheet-panel';
  const prior = document.getElementById(HOST_ID);
  if (prior) prior.remove();
  if (sheet === null) return { rendered: false, closed: true };

  const dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const c = (dark ? theme?.dark : theme?.light) || {};
  const host = document.createElement('div');
  host.id = HOST_ID;
  host.setAttribute('data-draft-copy-sheet', '');
  const dock = sheet?.dock === 'left' ? 'left' : 'right';
  host.style.cssText = `position:fixed;top:72px;${dock}:16px;z-index:2147483646;width:min(360px, calc(100vw - 32px));`;
  const root = host.attachShadow({ mode: 'open' });

  const css = `
    :host { all: initial; }
    .p { box-sizing: border-box; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: ${c.INK};
         background: ${c.SURFACE_SOLID}; border: 1px solid ${c.BORDER_STRONG}; border-radius: 10px;
         box-shadow: ${c.SHADOW_MD || 'none'}; max-height: calc(100vh - 96px); display: flex; flex-direction: column; overflow: hidden; }
    .h { display: flex; align-items: center; gap: 6px; padding: 9px 10px 8px 12px; border-bottom: 1px solid ${c.BORDER}; }
    .t { flex: 1; min-width: 0; }
    .t b { display: block; font-size: 13px; }
    .t small { display: block; color: ${c.INK_MUTED}; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button { font: inherit; color: ${c.INK}; background: ${c.SURFACE_TINT || c.SURFACE_SOLID}; border: 1px solid ${c.BORDER_CONTROL};
             border-radius: 6px; padding: 3px 8px; cursor: pointer; }
    button:hover { background: ${c.HOVER}; }
    button:focus-visible { outline: 2px solid ${c.ACCENT_INK}; outline-offset: 2px; }
    .ic { width: 28px; padding: 3px 0; text-align: center; }
    .b { overflow: auto; padding: 6px 10px 10px; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; gap: 8px; align-items: flex-start; padding: 7px 0; border-bottom: 1px solid ${c.BORDER}; }
    li:last-child { border-bottom: 0; }
    .kv { flex: 1; min-width: 0; }
    .k { display: block; color: ${c.INK_MUTED}; font-size: 11.5px; }
    .v { display: block; overflow-wrap: anywhere; white-space: pre-wrap; }
    li.elig .k { color: ${c.WARNING}; }
    .copied { border-color: ${c.SUCCESS}; color: ${c.SUCCESS}; }
    .note { margin: 8px 0 0; padding: 6px 8px; border-left: 3px solid ${c.WARNING}; background: ${c.WARNING_QUIET}; border-radius: 6px; font-size: 12px; }
    .mini .b { display: none; }
    .empty { color: ${c.INK_MUTED}; padding: 8px 0; }`;
  const style = document.createElement('style');
  style.textContent = css;

  const panel = document.createElement('div');
  panel.className = 'p';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'draft Copy sheet');

  const head = document.createElement('div');
  head.className = 'h';
  const title = document.createElement('div');
  title.className = 't';
  const tb = document.createElement('b');
  tb.textContent = 'Copy sheet';
  const ts = document.createElement('small');
  const job = sheet?.job ? [sheet.job.title, sheet.job.company].filter(Boolean).join(' at ') : '';
  const src = sheet?.source === 'packet' ? 'prepared answers' : 'your profile';
  ts.textContent = job ? `${job} · ${src}` : `From ${src}`;
  title.append(tb, ts);
  const btn = (label, aria, cls = 'ic') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.setAttribute('aria-label', aria); b.title = aria; return b; };
  const dockBtn = btn(dock === 'right' ? '⇤' : '⇥', dock === 'right' ? 'Dock on the left' : 'Dock on the right');
  const miniBtn = btn('–', 'Minimise');
  const closeBtn = btn('×', 'Close the Copy sheet');
  head.append(title, dockBtn, miniBtn, closeBtn);

  const body = document.createElement('div');
  body.className = 'b';
  const list = document.createElement('ul');
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
  for (const row of rows) {
    const li = document.createElement('li');
    if (row.eligibility) li.className = 'elig';
    const kv = document.createElement('span');
    kv.className = 'kv';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = row.eligibility ? `${row.label} · you are attesting to this` : String(row.label || '');   // textContent: never parsed
    const v = document.createElement('span');
    v.className = 'v';
    v.textContent = String(row.value ?? '');
    kv.append(k, v);
    const copy = btn('Copy', `Copy ${row.label}`, '');
    copy.setAttribute('data-copy', '');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(String(row.value ?? '')); copy.textContent = 'Copied'; copy.classList.add('copied'); }
      catch {
        // No clipboard here: select the value so Ctrl+C copies it.
        const r = document.createRange(); r.selectNodeContents(v);
        const sel = root.getSelection ? root.getSelection() : window.getSelection();
        try { sel.removeAllRanges(); sel.addRange(r); } catch { /* nothing more to do */ }
        copy.textContent = 'Select and copy';
      }
      setTimeout(() => { copy.textContent = 'Copy'; copy.classList.remove('copied'); }, 1600);
    });
    li.append(kv, copy);
    list.append(li);
  }
  body.append(list);
  if (!rows.length) {
    const e = document.createElement('p');
    e.className = 'empty';
    e.textContent = sheet?.message || 'Nothing to copy yet — add your details in draft Settings.';
    body.append(e);
  }
  const n = Array.isArray(sheet?.unanswered) ? sheet.unanswered.length : 0;
  if (n) {
    const note = document.createElement('p');
    note.className = 'note';
    note.setAttribute('data-unanswered', String(n));
    note.textContent = `${n} question${n === 1 ? '' : 's'} not answered by draft — answer ${n === 1 ? 'it' : 'them'} yourself on the form.`;
    body.append(note);
  }
  panel.append(head, body);
  root.append(style, panel);
  document.documentElement.append(host);

  const onKey = (ev) => { if (ev.key === 'Escape' && !ev.isComposing && document.getElementById(HOST_ID) === host) close(); };
  function close() { document.removeEventListener('keydown', onKey, true); host.remove(); }
  document.addEventListener('keydown', onKey, true);
  closeBtn.addEventListener('click', close);
  miniBtn.addEventListener('click', () => {
    const mini = panel.classList.toggle('mini');
    miniBtn.textContent = mini ? '+' : '–';
    miniBtn.setAttribute('aria-label', mini ? 'Expand' : 'Minimise');
  });
  dockBtn.addEventListener('click', () => {
    const next = host.style.left ? 'right' : 'left';
    host.style.left = next === 'left' ? '16px' : '';
    host.style.right = next === 'right' ? '16px' : '';
    dockBtn.textContent = next === 'right' ? '⇤' : '⇥';
    dockBtn.setAttribute('aria-label', next === 'right' ? 'Dock on the left' : 'Dock on the right');
    try { chrome.runtime?.sendMessage?.({ type: 'COPY_SHEET_DOCK', side: next }); } catch { /* remembered next time, or not */ }
  });
  return { rendered: true, rows: rows.length, unanswered: n, dock };
}
