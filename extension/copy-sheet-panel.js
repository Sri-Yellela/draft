// ── THE COPY SHEET, IN THE PAGE — a panel that stays while you paste ─────────────────────────────
//
// Owner, 10-12: the Copy sheet lived in the toolbar popup, which Chrome closes the moment the page takes focus —
// so after every paste the popup had to be opened again, and it had no way to close. It is now a PANEL IN THE PAGE,
// in its own shadow root (the page's styles cannot reach in, and its own cannot leak out):
//
//   · it stays open while you click into the page's fields · every answer has a Copy button that says "Copied"
//   · it shows the PREPARED answers when the tab is bound to a job, says which job and where the answers came from,
//     and how many questions are unanswered · an eligibility answer keeps "you are attesting to this".
//   · ⛔ It never reads or writes the page's fields and holds no keystrokes. The copy is the user's own click, into
//     their own clipboard.
//
// ⭐ T17: the Copy sheet is the dock's COPY SHEET TAB (extension/dock.js). The window it sits in — Close, Esc, Collapse,
// left / right, drag, resize, where it sits on this site — is the dock's, once; this function draws the list only.
//
// renderCopySheetPanel is SERIALISED into the page by chrome.scripting.executeScript (isolated world, the TOP frame,
// after dock.js), so it closes over nothing: the sheet, the palettes (extension/tokens.js — never a colour literal) and
// the dock's own meta (dockHost.js dockMeta) arrive as arguments.

/* exported renderCopySheetPanel */
export function renderCopySheetPanel(sheet, theme, dockMeta) {
  const HOST_ID = 'rm-copy-sheet-panel';
  const D = globalThis.__draftDock;
  const dock = D?.ensure?.(dockMeta || {}) || null;
  if (!dock) return { rendered: false, error: D ? 'not_top_frame' : 'no_dock' };
  if (sheet === null) { const prior = document.getElementById(HOST_ID); if (prior) dock.drop('copy', prior); return { rendered: false, closed: true }; }

  const dark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const c = (dark ? theme?.dark : theme?.light) || {};
  const host = dock.view('copy', { id: HOST_ID, label: 'draft Copy sheet', expand: true, select: true });
  host.setAttribute('data-draft-copy-sheet', '');
  const root = host.attachShadow({ mode: 'open' });

  // ⭐ T26 (owner, 10-19): labels and values on screen, nothing else — the title, the job, where an answer came from and
  // the unanswered note are a screen reader's words (.sr) and tooltips; Copy is an icon. No rule under the header or
  // between rows (spacing separates them), no tinted note, and no surface of its own: the dock's frame is the surface.
  const css = `
    :host { all: initial; display: block; height: 100%; }
    .p { box-sizing: border-box; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: ${c.INK};
         background: transparent; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
    .sr { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important;
          border: 0 !important; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .ic { display: block; flex: none; }
    .h { display: flex; align-items: center; gap: 8px; padding: 10px 12px 2px; color: ${c.INK_MUTED}; font-size: 12px; font-weight: 800;
         font-variant-numeric: tabular-nums; }
    .h:empty { display: none; }
    .t { flex: 1; min-width: 0; }
    /* ⛔ D60: a 30px icon control at radius 8. */
    button { width: 30px; height: 30px; padding: 0; display: inline-grid; place-items: center; flex: none; font: inherit; color: ${c.INK};
             background: ${c.SURFACE_SOLID}; border: 0; border-radius: 8px; cursor: pointer; box-shadow: ${c.DEPTH_REST || 'none'}; }
    button:hover { box-shadow: ${c.DEPTH_HOVER || 'none'}; }
    button:focus-visible { outline: 2px solid ${c.ACCENT_INK}; outline-offset: 2px; }
    .b { overflow: auto; padding: 6px 12px 12px; flex: 1; min-height: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li { display: flex; gap: 10px; align-items: center; padding: 6px 0; }
    .kv { flex: 1; min-width: 0; }
    .k { display: block; color: ${c.INK_MUTED}; font-size: 11.5px; }
    .v { display: block; overflow-wrap: anywhere; white-space: pre-wrap; font-weight: 700; }
    li.elig .k { color: ${c.WARNING}; }
    .copied { color: ${c.SUCCESS}; }
    .note { display: inline-flex; align-items: center; gap: 3px; color: ${c.WARNING}; }
    .empty { display: grid; justify-items: center; padding: 24px 0; color: ${c.INK_FAINT}; }
    /* ⛔ D60: where an answer came from is a MARK — a rectangle with a 3px leading bar, never a capsule (read aloud only). */
    .src { display: inline-block; margin: 2px 0; padding: 0 6px 0 5px; border-left: 3px solid ${c.BORDER_STRONG}; border-radius: 6px;
           background: ${c.SURFACE_TINT || c.SURFACE_SOLID}; color: ${c.INK_MUTED}; font-size: 10.5px; font-weight: 700; }
    .src.you { border-left-color: ${c.ACCENT_INK}; color: ${c.ACCENT_INK}; }
`;
  const I = (name, size) => (typeof D.icon === 'function' ? D.icon(name, size) : '');
  const style = document.createElement('style');
  style.textContent = css;

  const panel = document.createElement('div');
  panel.className = 'p';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'draft Copy sheet');

  const head = document.createElement('div');
  head.className = 'h';
  const title = document.createElement('div');
  title.className = 't sr';
  const tb = document.createElement('b');
  tb.textContent = 'Copy sheet';
  const ts = document.createElement('small');
  const job = sheet?.job ? [sheet.job.title, sheet.job.company].filter(Boolean).join(' at ') : '';
  const src = sheet?.source === 'packet' ? 'prepared answers' : 'your profile';
  ts.textContent = job ? `${job} · ${src}` : `From ${src}`;
  title.append(tb, ts);
  // ⭐ T26: an icon control — its words are its aria-label and tooltip
  const btn = (ic, aria, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = I(ic); b.setAttribute('aria-label', aria); b.title = aria; return b; };
  head.append(title);

  const body = document.createElement('div');
  body.className = 'b';
  const list = document.createElement('ul');
  const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
  const day = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; } };
  const sourceWords = (row) => {
    if (row.provenance === 'saved_answer') {
      const when = row.acknowledgedAt ? ` · ${day(row.acknowledgedAt)}` : '';
      return row.source === 'you_typed' ? `you typed${when}` : row.source === 'you_acknowledged' ? `you acknowledged${when}` : `saved${when}`;
    }
    if (row.provenance === 'work_history') return 'your work history';
    if (row.provenance === 'education') return 'your education';
    // ⭐ J9 (10-14): a guess was never the profile's answer — the review panel's own word for it.
    if (['label_fuzzy', 'default', 'sponsorship_assumed_future'].includes(row.provenance)) return 'matched loosely';
    if (row.provenance) return 'profile';
    return '';
  };
  for (const row of rows) {
    const li = document.createElement('li');
    if (row.eligibility) li.className = 'elig';
    const kv = document.createElement('span');
    kv.className = 'kv';
    const k = document.createElement('span');
    k.className = 'k';
    // An eligibility answer keeps "you are attesting to this" on its label (D96 §4 safeguard 3).
    k.textContent = String(row.label || '');   // textContent: never parsed
    if (row.eligibility || row.attesting) { const a = document.createElement('span'); a.className = 'sr'; a.textContent = ' · you are attesting to this'; k.append(a); }
    // ⭐ D96 §6: where the answer came from — your profile, your work history, or an answer you saved (and when you
    // acknowledged it). A mark of its own, beside the label, so the label still reads as the question.
    const words = sourceWords(row);
    const mark = document.createElement('span');
    if (words) {
      mark.className = `src sr${/^you /.test(words) ? ' you' : ''}`;
      li.title = words;
      mark.setAttribute('data-source', '');
      mark.textContent = words;
    }
    const v = document.createElement('span');
    v.className = 'v';
    v.textContent = String(row.value ?? '');
    kv.append(k, ...(words ? [mark] : []), v);
    const copy = btn('copy', `Copy ${row.label}`);
    copy.setAttribute('data-copy', '');
    copy.addEventListener('click', async () => {
      const say = (words, ic) => { copy.setAttribute('aria-label', words); copy.title = words; copy.innerHTML = I(ic); };
      try { await navigator.clipboard.writeText(String(row.value ?? '')); say('Copied', 'check'); copy.classList.add('copied'); }
      catch {
        // No clipboard here: select the value so Ctrl+C copies it.
        const r = document.createRange(); r.selectNodeContents(v);
        const sel = root.getSelection ? root.getSelection() : window.getSelection();
        try { sel.removeAllRanges(); sel.addRange(r); } catch { /* nothing more to do */ }
        say('Select and copy', 'copy');
      }
      setTimeout(() => { say(`Copy ${row.label}`, 'copy'); copy.classList.remove('copied'); }, 1600);
    });
    li.append(kv, copy);
    list.append(li);
  }
  body.append(list);
  if (!rows.length) {
    const e = document.createElement('p');
    e.className = 'empty';
    const words = sheet?.message || 'Nothing to copy yet — add your details in draft Settings.';
    e.title = words;
    e.innerHTML = `${I('copy', 28)}<span class="sr"></span>`;
    e.lastChild.textContent = words;
    body.append(e);
  }
  const n = Array.isArray(sheet?.unanswered) ? sheet.unanswered.length : 0;
  if (n) {
    // ⭐ T26: the unanswered count is a "!" and a number, in the header — the sentence is its tooltip and hidden words
    const note = document.createElement('span');
    note.className = 'note';
    note.setAttribute('data-unanswered', String(n));
    const words = `${n} question${n === 1 ? '' : 's'} not answered by draft — answer ${n === 1 ? 'it' : 'them'} yourself on the form.`;
    note.title = words;
    note.innerHTML = `${I('need', 14)}<span aria-hidden="true">${n}</span><span class="sr"></span>`;
    note.lastChild.textContent = words;
    head.append(note);
  }
  panel.append(head, body);
  root.append(style, panel);
  dock.restorePops?.('copy');
  return { rendered: true, rows: rows.length, unanswered: n, dock: dock.host.dataset.side || 'right' };
}
