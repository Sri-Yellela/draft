// RESUME_MASTER_URL is defined by config.js, loaded before this script; companionMode and the line
// helpers by companion.js (D13).

function setStatus(msg, timeout = 0) {
  document.getElementById('status').textContent = msg;
  if (timeout) setTimeout(() => setStatus(''), timeout);
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ⭐ D63 · THE JOB CARD — the posting in the board card's own language: the paper logo tile (D61; a
// first-party logo or the letter, never a third-party request), the company in the logo face, the title,
// and the D50 number box (no score → the dashed box, no digits). Every string is textContent.
function showJobPreview(card) {
  if (!card) return;
  document.getElementById('preview-company').textContent = card.company || '';
  document.getElementById('preview-title').textContent = card.title || '';
  const tile = document.getElementById('preview-tile');
  tile.textContent = '';
  const src = firstPartyLogo(card.logo, RESUME_MASTER_URL);
  if (src) {
    const img = document.createElement('img');
    img.alt = '';
    img.src = src;
    img.addEventListener?.('error', () => { tile.textContent = (card.company || '?')[0].toUpperCase(); });
    tile.append(img);
  } else {
    tile.textContent = (card.company || '?')[0].toUpperCase();
  }
  const box = document.getElementById('preview-score');
  box.textContent = '';
  if (Number.isFinite(card.score)) {
    const b = document.createElement('b'); b.textContent = String(Math.round(card.score));
    const s = document.createElement('small'); s.textContent = card.tailored ? 'tailored' : 'ATS';
    box.append(b, s);
    box.className = 'nb';
    box.setAttribute?.('aria-label', `${card.tailored ? "Tailored résumé's " : ''}ATS match ${Math.round(card.score)}`);
  } else {
    const s = document.createElement('small'); s.textContent = 'ATS';
    box.append(s);
    box.className = 'nb none';
  }
  document.getElementById('job-preview').style.display = 'grid';
}

// ⭐ T9 · THE WEB APP'S ATS REPORT — <draft-ats-report>, the one component (extension/atsReport.js is
// shared/atsReportElement.js, bundled), handed the scorer's own JSON exactly as the web app's ATS panel gets it.
// Read-only here (no claims: claiming is the web app's), the theme follows the OS (D23). The extension adds only its
// own two buttons: Full report in draft (a board job) and Read again.
function renderAtsReport(context) {
  const box = document.getElementById('ats-report');
  const card = document.getElementById('ats-report-card');
  const r = context?.report;
  if (!box || !card) return;
  if (r?.state !== 'ready' || !r.report || typeof card.render !== 'function') { box.style.display = 'none'; return; }
  card.report = r.report;
  card.render();
  const jobId = r.basis === 'board' ? (context.posting?.jobId ?? context.binding?.jobId ?? null) : null;
  const full = document.getElementById('btn-ats-full');
  full.style.display = jobId != null ? 'flex' : 'none';
  full.onclick = jobId != null
    ? () => chrome.tabs.create({ url: `${RESUME_MASTER_URL}/app/jobs?job=${encodeURIComponent(String(jobId))}` })
    : null;
  box.style.display = 'block';
}
// ⭐ T22: the report's own "Read again" is gone — the main action's Read again (btn-read-page) is the same press.

const MARK_ICONS = { doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4"/></svg>' };

// ⛔ D60 · status as marks: a rectangle with a leading bar in the tone's colour, the words as text.
function renderFacts(marks) {
  const box = document.getElementById('facts');
  box.innerHTML = '';
  for (const m of marks || []) {
    const span = document.createElement('span');
    span.className = `mkr ${m.tone}`;
    if (m.icon && MARK_ICONS[m.icon]) span.innerHTML = MARK_ICONS[m.icon];   // a fixed icon, never page or server text
    span.append(m.text);
    box.append(span);
  }
  box.hidden = !(marks || []).length;
}

// ⭐ D63 (3) · show the packet before you fill — so the click on Fill it is informed.
function renderPacket(rows) {
  const box = document.getElementById('packet-summary');
  box.innerHTML = '';
  for (const r of rows || []) {
    const line = document.createElement('div');
    line.className = 'l';
    const v = document.createElement('b');
    if (r.ask) v.className = 'ask';
    v.textContent = r.value;
    line.append(r.label, v);
    box.append(line);
  }
  box.hidden = !(rows || []).length;
}

let currentJobData = null;

// A hotkey capture (BYO-2) happens on the page in view, not the popup — there's nothing to
// show "live" in a popup that wasn't open at that moment. This shows the last result, if any,
// as a secondary/bonus status line whenever the popup happens to be opened afterward.
async function showLastCapture() {
  try {
    const { lastCapture } = await chrome.storage.local.get('lastCapture');
    showCaptureResult(lastCapture);
  } catch (_) { /* storage unavailable */ }
}

// ⛔ D33: the server's own words, as given — "added", "already on the board", or "held off the
// board, because …". It used to prefix every success with "✓ Captured:", which is how a capture
// held off the board read as one that landed. Green only when the job is ON the board; amber when
// it is saved but not on it; red when nothing was saved. The link opens the job on draft by id.
function showCaptureResult(result) {
  const el = document.getElementById('last-capture');
  if (!el || !result) return;
  el.textContent = result.message || '';
  el.className = 'result-text ' + (!result.success ? 'error' : result.onBoard ? 'success' : 'warn');
  el.style.display = 'block';
  const row = document.getElementById('capture-open-row');
  if (row) row.style.display = result.success && result.link ? 'flex' : 'none';
  captureLink = result.success ? result.link || null : null;
}
let captureLink = null;
document.getElementById('capture-open')?.addEventListener('click', () => {
  if (!captureLink || !captureLink.startsWith(`${RESUME_MASTER_URL}/`)) return;
  chrome.tabs.create({ url: captureLink });
  setTimeout(() => window.close(), 300);
});

// Asked via the service worker, not fetched here. A popup's fetch carries chrome-extension:// as
// its origin, which server.js's corsOrigin refuses in production — so this worked in development
// and would have shown "Sign in" to every production user, hiding the capture button entirely.
//
// Now returns the whole identity, not just a boolean, because the popup has to NAME it.
async function probeAuth() {
  try {
    return await chrome.runtime.sendMessage({ type: 'PROBE_AUTH' });
  } catch (_) {
    return { authenticated: false };
  }
}

// ── WHO THE EXTENSION IS ACTING AS ─────────────────────────────────────────────────────────────
// The extension used to act as whatever session the browser held, and said nothing about it — so
// a user signed in as an admin had an extension with admin reach and no way to notice. It now
// holds its own credential, and this line is how that becomes checkable rather than merely true.
//
// The admin note is shown rather than hidden: an admin should be able to see that their extension
// is deliberately NOT one. The server enforces that regardless of what this says.
function renderIdentity(identity) {
  const who = document.getElementById('identity-who');
  const btn = document.getElementById('btn-disconnect');
  if (!who) return;

  if (!identity?.authenticated) {
    who.textContent = 'Not signed in';
    if (btn) btn.style.display = 'none';
    return;
  }
  who.innerHTML = '';
  who.append('Signed in as ');
  const name = document.createElement('strong');
  name.textContent = identity.username || 'your account';   // textContent: never parse a username
  who.append(name);
  if (identity.accountIsAdmin) {
    const note = document.createElement('span');
    note.className = 'not-admin';
    note.textContent = ' · not acting as admin';
    who.append(note);
  }
  if (btn) btn.style.display = 'inline';
}

async function init() {
  const identity = await probeAuth();
  renderIdentity(identity);

  if (!identity?.authenticated) {
    document.getElementById('btn-sign-in').style.display = 'flex';
    setStatus('Sign in to capture jobs');
    return;
  }

  // §8 row 15: the today ring — the account's quota, not the page. Fire-and-forget: the popup paints
  // without it, and a server that cannot answer simply shows no ring.
  void showTodayRing();
  void showCapturedToday();
  await showLastCapture();

  // ⛔ D23, THE MANUAL CONTEXT TRIGGER (owner, 10-04). Opening the popup reads NOTHING from the page
  // and asks the server NOTHING about it. Until "Read this page" is pressed, the popup shows the launcher —
  // Read this page, the Draft button, Open dock, Copy sheet, Report form, More (⭐ T22). A wrong primary action is
  // worse than a menu, and this removes that failure rather than tuning a confidence threshold; it also keeps the
  // product's defining property exact: every read of every page begins with a click or a keystroke.
  //
  // The one thing decided on open is local and is not a page read: the tab's address scheme, which
  // the browser already handed the popup. On a page that cannot be captured at all (chrome://, the
  // PDF viewer) Capture is shown DISABLED with its reason — never hidden (D13).
  const tab = await getCurrentTab().catch(() => null);
  // ⭐ T14 (field report 10-14) · WHAT THIS TAB IS, AT ONCE. The extension's own record of the tab (tabState.js
  // TAB_STATE) — a tab the board opened ("From your board — <job> · ATS 72", D99 J11), a tab already bound, or a NEW tab
  // on an address this job was already seen at, which binds now. Not a page read and not a request: the job card, the
  // bound line and the progress come back without a capture, a read or a prepare asked again.
  const tabState = await chrome.runtime.sendMessage({ type: 'TAB_STATE' }).catch(() => null);
  // ⭐ T22: the capture tile is gone; on a page draft cannot read (chrome://, a PDF) the main action is shown DISABLED
  // with its reason — never hidden (D13).
  if (!isWebPage(tab)) {
    const read = document.getElementById('btn-read-page');
    read.disabled = true;
    read.title = 'draft cannot read this page';
  }
  document.getElementById('btn-read-page').style.display = 'flex';
  document.getElementById('read-hint').style.display = 'block';
  if (tabState?.state) showTabState(tabState.state);
}

// ⭐ T14 · the job this tab is on, drawn from its state: the card (with the score draft gave it), the bound line, Fill as
// the one action (it reads and prepares itself if it must — T13), and "Read again" instead of asking for a first read.
function showTabState(st) {
  renderBinding({ binding: st, posting: st.captured ? { captured: true } : null });
  const score = st.ats && (st.ats.state === undefined || st.ats.state === 'ready') && Number.isFinite(st.ats.score) ? st.ats.score : null;
  showJobPreview({ company: st.company || '', title: st.title || '', logo: st.logo || null, score, tailored: false });
  document.getElementById('btn-fill-primary').style.display = 'flex';
  document.getElementById('btn-read-page').textContent = 'Read again';
  document.getElementById('read-hint').style.display = 'none';
  refreshProgress();
}

// popup-progress.js (a module) paints the remembered progress; it repaints when the tab's state changes here.
function refreshProgress() {
  try { if (typeof Event === 'function') document.dispatchEvent?.(new Event('draft:tabstate')); } catch (_) { /* paints on open anyway */ }
}

// ⭐ §8 row 15, decision D — today against YOUR CAP (the day's Draft slots), never a goal.
async function showTodayRing() {
  const slots = await chrome.runtime.sendMessage({ type: 'TODAY_RING' }).catch(() => null);
  const ring = ringState(slots);
  const box = document.getElementById('today');
  if (!ring || !box) return;
  document.getElementById('today-arc').style.strokeDasharray = `${ring.percent} 100`;
  document.getElementById('today-text').textContent = ring.capText;   // D63: "3 of 10 · your cap"
  box.title = ring.label;
  box.dataset.full = ring.full ? 'true' : 'false';
  box.style.display = 'inline-flex';
}

// ⭐ "Captured today" (owner 10-12: it read 0 after two captures) — DISTINCT jobs captured in 24 h by any route.
async function showCapturedToday() {
  const t = await chrome.runtime.sendMessage({ type: 'CAPTURED_TODAY' }).catch(() => null);
  const el = document.getElementById('captured-today');
  if (!t || !el) return;
  el.textContent = capturedTodayLine(t);
  el.style.display = el.textContent ? 'block' : 'none';
}

// ⭐ The tab binding: "Captured ✓ — Software Engineer at Zoom", whatever stage of the application this page is.
function renderBinding(context) {
  const line = boundLine(context);
  const box = document.getElementById('bound');
  if (!line || !box) return;
  document.getElementById('bound-line').textContent = line;
  box.style.display = 'block';
  document.getElementById('companion').style.display = 'block';
}
document.getElementById('btn-unbind')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'UNBIND_TAB' }).catch(() => null);
  document.getElementById('bound').style.display = 'none';
  setStatus('Unlinked — this page is not tied to a job any more.', 3000);
});

function isWebPage(tab) {
  try { return !tab?.url || /^https?:$/.test(new URL(tab.url).protocol); } catch { return false; }
}

// The press. The local preview (the extractor, injected under the activeTab grant) and the server's
// view of this page (POST /api/import/context + the drafted-application queue for this origin) are
// asked for HERE, in parallel, once — and neither is stored.
let pageRead = false;
async function readPage() {
  if (pageRead) return;
  pageRead = true;
  const trigger = document.getElementById('btn-read-page');
  trigger.disabled = true;
  setStatus('Reading this page…');

  const [preview, context] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'PREVIEW_ACTIVE_TAB' }).catch(() => null),
    chrome.runtime.sendMessage({ type: 'POPUP_CONTEXT' }).catch(() => null),
  ]);
  trigger.style.display = 'none';
  document.getElementById('read-hint').style.display = 'none';
  const mode = companionMode({ preview, context });
  renderCompanion(mode);
  renderBinding(context);
  refreshProgress();
  // ⭐ D63: the popup LEADS with the job card, then the marks, then (on a form) the packet.
  showJobPreview(jobCard(mode, preview));
  renderFacts(factMarks(mode));
  renderAtsReport(context);
  if (mode.mode === 'form') renderPacket(packetRows(mode.packet));

  if (!preview?.capturable) {
    // D13: on a page that cannot be read (chrome://, a PDF viewer) Capture is shown disabled, with the reason, rather
    // than vanishing (⭐ T22: the main action's Capture it — the tile is gone).
    showCaptureAction();
    const cap = document.getElementById('btn-capture-primary');
    cap.disabled = true;
    cap.title = 'This page cannot be captured';
    setStatus('Open a job posting to capture it');
    return;
  }
  // ⭐ BINDING FIRST: the identify that ran first named no job of yours — its own sentence (and, for a posting draft does
  // not hold, the ONE button that adds it: Capture, shown above). A bound tab keeps its binding (Workday's sign-in).
  const id = context?.identity || null;
  if (id && !id.bind && !context?.binding) {
    if (preview.ok) currentJobData = { title: preview.title, company: preview.company, location: preview.location };
    if (id.action === 'capture') showCaptureAction();
    if (id.action === 'sign_in') document.getElementById('btn-sign-in').style.display = 'flex';
    setStatus(id.message || '');
    return;
  }
  if (preview.ok) {
    currentJobData = { title: preview.title, company: preview.company, location: preview.location };
    // ⭐ T13: Read also prepared — said, so the next step is plainly Fill
    setStatus(context?.prepared ? 'Answers prepared — press Fill on the application form.' : '');
  } else if (preview.unreadable) {
    if (mode.mode !== 'form') showCaptureAction();
    setStatus('Ready to capture');
  } else {
    // ⭐ T22: the ONE action this sentence names — the capture tile it used to point at is gone
    if (mode.mode !== 'form') showCaptureAction();
    setStatus('No job detected here — capture anyway to try');
  }
}
document.getElementById('btn-read-page').addEventListener('click', readPage);
// The keystroke form of the same press: R, with no modifier, while the popup has focus.
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'r' && ev.key !== 'R') return;
  if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
  if (document.getElementById('btn-read-page').style.display === 'none') return;
  ev.preventDefault();
  readPage();
});


// ── D13: THE COMPANION ─────────────────────────────────────────────────────────────────────────
// Shows the ONE action this page calls for, and why. ⭐ T22: the tiles that stood under it are gone; what a wrong guess
// would hide is a shortcut or a right-click away (Ctrl+Shift+K capture, Ctrl+Shift+Y fill).
function renderCompanion(c) {
  const box = document.getElementById('companion');
  const line = document.getElementById('ctx-line');
  const q = document.getElementById('ctx-questions');
  // §8 row 10: the on-demand notice — "You applied here 28 Sep · 2 other roles at …". Never a block.
  if (c.notice) {
    const n = document.getElementById('ctx-notice');
    n.textContent = c.notice;
    n.style.display = 'block';
    box.style.display = 'block';
  }
  if (c.mode === 'form') {
    // D63: the marks and the packet summary say this; the sentence stays for a screen reader.
    line.textContent = draftedLine(c.packet);
    line.className = 'ctx-line sr';
    void q; void questionsLine;
    document.getElementById('btn-fill-primary').style.display = 'flex';
    document.getElementById('btn-submitted').style.display = 'flex';
    box.style.display = 'block';
    return;
  }
  // ⛔ D56: a job of yours with nothing prepared for it — one click prepares it and fills. ⭐ T22: that click is Fill it
  // (T13: Fill prepares first when nothing is prepared) — the separate "Prepare this application" was the same press.
  if (c.mode === 'prepare') {
    line.textContent = prepareLine(c.handoff);
    document.getElementById('btn-fill-primary').style.display = 'flex';
    document.getElementById('btn-submitted').style.display = 'flex';
    box.style.display = 'block';
    return;
  }
  // ⛔ D56: prepared, but not for THIS address — say where it fills, never fill it here.
  if (c.mode === 'elsewhere') {
    line.textContent = c.handoff?.message || "This page isn't one of this application's addresses.";
    box.style.display = 'block';
    return;
  }
  if (c.mode === 'posting') {
    line.textContent = postingLine(c.posting);
    line.className = 'ctx-line sr';   // D63: said by the mark beside the job card
    document.getElementById('posting-actions').style.display = 'flex';
    // ⭐ Captured already (by any route): say so — a second press is idempotent and answers "Already captured".
    if (c.posting?.captured) document.getElementById('btn-capture-primary').textContent = 'Captured ✓';
    else if (c.posting?.saved) document.getElementById('btn-capture-primary').textContent = 'Capture again';
    box.style.display = 'block';
    return;
  }
  // Neither a posting nor a form you drafted: your recent captures, as text (never parsed).
  if (c.recent?.length) {
    const ul = document.getElementById('recent-list');
    for (const r of c.recent) {
      const li = document.createElement('li');
      if (r.company) {                                   // the company in the logo face, as on the cards
        const co = document.createElement('span');
        co.className = 'co logo-face';
        co.textContent = r.company;
        li.append(co, ' · ');
      }
      li.append(`${r.title || 'A captured job'} · ${ageWords(Date.now() - (r.capturedAt || Date.now()))}`);
      // D33: a capture that is saved but NOT on the board says so here too, in the server's words.
      if (r.message && r.onBoard === false) { li.append(' · not on the board'); li.title = r.message; }
      ul.append(li);
    }
    document.getElementById('recent').style.display = 'block';
  }
}

// "Fill it" — the same gated handoff Ctrl+Shift+Y runs, through the service worker. The review
// overlay it opens is where the answers are checked; you submit the form yourself.
async function fillActiveTab() {
  // ⭐ T13: one press — it reads the page if this tab does not know its job, prepares if nothing is prepared, then
  // fills, and the sentence says what it did ("Read this page and prepared your answers. …").
  setStatus('Filling — reading and preparing first if this page needs it…');
  const r = await chrome.runtime.sendMessage({ type: 'FILL_ACTIVE_TAB' }).catch(() => null);
  setStatus(r?.message || (r?.ok ? 'Filled — check every answer, then submit.' : 'Could not fill this page.'), r?.ok ? 4000 : 0);
  refreshProgress();
  // D36: stay open when the fill worked but its review panel did not — that sentence is the only
  // place the candidate learns the answers were not laid out for checking.
  if (r?.ok && r?.overlay?.rendered !== false) setTimeout(() => window.close(), 1200);
  // D56 → ⭐ T22: nothing prepared, but a job of yours — Fill it is that button (it prepares first), so it stays.
  if (!r?.ok && r?.canPrepare) {
    document.getElementById('btn-fill-primary').style.display = 'flex';
    document.getElementById('companion').style.display = 'block';
  }
  // ⭐ BINDING FIRST: the page is a posting draft does not hold — the ONE button the sentence names is Capture, and a
  // capture from it binds the tab and runs this same Fill again (the press the user already made).
  if (!r?.ok && r?.action === 'capture') { showCaptureAction(); fillAfterCapture = true; }
  if (!r?.ok && r?.action === 'sign_in') document.getElementById('btn-sign-in').style.display = 'flex';
  showFramePermission(r);
}

let fillAfterCapture = false;
/** The one Capture button for a page identify found no job of yours on. */
function showCaptureAction() {
  document.getElementById('posting-actions').style.display = 'flex';
  document.getElementById('companion').style.display = 'block';
}

// ⭐ T11 · THE FORM IS IN AN ATS'S FRAME. The fill says which site ("inside a Greenhouse frame") and this button asks
// Chrome for exactly that site's origins. ⛔ permissions.request is the FIRST call of the click handler — inside the
// user's gesture, as Options does (options-auto.js) — and a refusal leaves everything as it was and says so.
let framePermission = null;
function showFramePermission(r) {
  const btn = document.getElementById('btn-allow-frame');
  if (r?.reason !== 'frame_needs_permission' || !r.site?.origins?.length) { btn.style.display = 'none'; framePermission = null; return; }
  framePermission = r.site;
  btn.textContent = `Allow draft on ${r.site.name}`;
  btn.style.display = 'flex';
  document.getElementById('companion').style.display = 'block';
}
document.getElementById('btn-allow-frame').addEventListener('click', async () => {
  const site = framePermission;
  if (!site) return;
  const granted = await chrome.permissions.request({ origins: [...site.origins] }).catch(() => false);
  if (!granted) { setStatus(`Not allowed — nothing changed. draft cannot fill a form inside ${site.name}'s frame without it.`, 6000); return; }
  document.getElementById('btn-allow-frame').style.display = 'none';
  await fillActiveTab();
});
// ⭐ T22: ONE fill control. The fill tile and "Prepare this application" were the same press (T13's chain prepares when
// nothing is prepared); Ctrl+Shift+Y and the right-click menu's "Fill this application" reach the same chain.
document.getElementById('btn-fill-primary').addEventListener('click', fillActiveTab);

// ⭐ D56 · "I submitted it" — the manual route records its own submission; the server says whether it verified.
document.getElementById('btn-submitted').addEventListener('click', async () => {
  const btn = document.getElementById('btn-submitted');
  const msg = document.getElementById('submitted-msg');
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'SUBMITTED_ACTIVE_TAB' }).catch(() => null);
  btn.disabled = !!r?.ok;
  btn.textContent = r?.ok ? 'Recorded' : 'I submitted it';
  msg.textContent = r?.message || 'Could not record it — try again.';
  msg.style.display = 'block';
});

// ⭐ §8 row 17 · THE COPY SHEET — the prepared answers as a list, a copy button each. Shown here, in the
// extension's own popup; nothing is written into the page, so it works on a portal draft cannot fill.
document.getElementById('btn-copy-sheet').addEventListener('click', async () => {
  // ⭐ (owner 10-12) The sheet opens IN THE PAGE — a panel that stays while you paste, with Close and Esc — and
  // this popup closes. Only where the page cannot take the panel (chrome://, a PDF) is it listed here instead.
  const panel = await chrome.runtime.sendMessage({ type: 'COPY_SHEET_PANEL' }).catch(() => null);
  if (panel?.ok) { window.close(); return; }
  const box = document.getElementById('copy-sheet');
  const list = document.getElementById('copy-sheet-list');
  const note = document.getElementById('copy-sheet-note');
  const sheet = await chrome.runtime.sendMessage({ type: 'COPY_SHEET' }).catch(() => null);
  list.innerHTML = '';
  for (const row of sheet?.rows || []) {
    const li = document.createElement('li');
    if (row.eligibility) li.className = 'elig';
    const text = document.createElement('span');
    const k = document.createElement('span');
    k.className = 'cs-k';
    k.textContent = row.eligibility ? `${row.label} · you are attesting to this` : row.label;   // textContent: never parsed
    const v = document.createElement('span');
    v.className = 'cs-v';
    v.textContent = row.value;
    text.append(k, v);
    const copy = document.createElement('button');
    copy.className = 'link';
    copy.textContent = 'copy';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(row.value); copy.textContent = 'copied'; }
      catch { copy.textContent = 'select and copy'; }
    });
    li.append(text, copy);
    list.append(li);
  }
  const n = sheet?.unanswered?.length || 0;
  note.textContent = !sheet?.ok && !sheet?.rows?.length ? (sheet?.message || 'Could not load your answers.')
    : (sheet.source === 'packet' ? 'The answers prepared for this application.' : 'Your profile answers.')
      + (n ? ` ${n} question${n === 1 ? '' : 's'} not answered by your profile — answer ${n === 1 ? 'it' : 'them'} yourself.` : '');
  box.style.display = 'block';
});

// The SAME capture the hotkey runs — same message, same implementation, same destination, same
// wording. Previously this button called a second implementation that wrote to a different table
// with a different dedup identity, so "Save Job" and Ctrl+Shift+K were two features wearing one name.
// ⭐ T22: Capture it is the ONE capture control in the popup (the capture tile is gone; Ctrl+Shift+K and the right-click
// menu's "Save this page to draft" run the same captureActiveTab).
document.getElementById('btn-capture-primary').addEventListener('click', () => captureFrom('btn-capture-primary'));

async function captureFrom(buttonId) {
  const btn = document.getElementById(buttonId);
  const label = btn.textContent;
  btn.textContent = 'Capturing...';
  btn.disabled = true;

  try {
    // One message to the service worker, which runs the same captureActiveTab() the hotkey runs.
    // The popup does not extract, does not fetch, and does not word the outcome.
    const result = await chrome.runtime.sendMessage({ type: 'CAPTURE_ACTIVE_TAB' });
    // The outcome stays on screen (no timeout): it may be the only place that says the job was
    // held off the board, and why.
    setStatus(result?.message ? '' : 'Capture failed — try again');
    showCaptureResult(result || { success: false, message: 'Capture failed — try again' });
    if (result?.success) {
      btn.textContent = 'Captured';
      // ⭐ BINDING FIRST: the capture bound the tab (background.js captureActiveTab) — the Fill that asked for it goes on.
      if (fillAfterCapture) { fillAfterCapture = false; await fillActiveTab(); }
    } else {
      btn.textContent = label;
      btn.disabled = false;
    }
  } catch (e) {
    btn.textContent = label;
    btn.disabled = false;
    setStatus('Could not reach the page — reload and try again', 3000);
  }
}

// Ending the extension's credential on purpose. Revokes server-side and clears it locally, so the
// next invocation bootstraps a fresh one from whatever session is signed in THEN — which is how a
// user switches the identity the extension holds.
document.getElementById('btn-disconnect')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-disconnect');
  btn.disabled = true;
  btn.textContent = 'Disconnecting…';
  await chrome.runtime.sendMessage({ type: 'DISCONNECT' }).catch(() => {});
  renderIdentity({ authenticated: false });
  document.getElementById('btn-sign-in').style.display = 'flex';
  document.getElementById('btn-read-page').style.display = 'none';
  document.getElementById('read-hint').style.display = 'none';
  // The companion spoke for the account that just disconnected; it says nothing for nobody.
  document.getElementById('companion').style.display = 'none';
  document.getElementById('recent').style.display = 'none';
  // ⭐ D96 §3: the remembered progress was cleared with the credential; so is what showed it.
  document.getElementById('progress').hidden = true;
  document.getElementById('in-progress').hidden = true;
  setStatus('Disconnected. Sign in to reconnect.');
});

document.getElementById('btn-sign-in').addEventListener('click', () => {
  chrome.tabs.create({ url: `${RESUME_MASTER_URL}/login` });
  setTimeout(() => window.close(), 300);
});

document.getElementById('btn-resume').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'OPEN_RESUME_BUILDER' });
  setStatus('Opening...', 800);
  setTimeout(() => window.close(), 800);
});

// D63 (5): "Sign in with LinkedIn" moved to the options page (options.js) — it is used once.

// ⭐ T22 · OPEN DOCK — the popup is a LAUNCHER (owner 10-15): a toolbar popup can be neither resized nor kept open when
// the page takes focus, so this opens draft's dock ON THE PAGE (extension/dock.js — Fill · ATS · Résumé · Copy sheet,
// moved, resized and kept where you leave it) and closes. The score tile is gone with it: draft's report for this tab's
// job is the dock's ATS tab (D99 J12 — a signed-in user is never sent to the free checker). Nothing of the page is read
// to open it.
document.getElementById('btn-open-dock').addEventListener('click', async () => {
  const btn = document.getElementById('btn-open-dock');
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'DOCK_OPEN' }).catch(() => null);
  btn.disabled = false;
  if (r?.ok) { window.close(); return; }
  setStatus(r?.message || "draft can't open its panel on this page.", 4000);
});

// ─── More → the options page ───────────────────────────────────────────────
// D63 (5): Keyboard shortcuts and Sign in with LinkedIn live there now; More is the one way in. The
// shortcuts page names both commands (capture AND fill), which is how the fill shortcut stopped being invisible.

document.getElementById('btn-settings')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── D55 decision E: Report this form ──────────────────────────────────────
// First press: the service worker reads the form's labels and says what WOULD be sent. Second
// press (Send report): it reads them again and sends the site's host and those labels — never an
// answer, never the page's address beyond the site. The popup holds nothing it could add.
document.getElementById('btn-report-form')?.addEventListener('click', async () => {
  const box = document.getElementById('report-form');
  const line = document.getElementById('report-form-line');
  const r = await chrome.runtime.sendMessage({ type: 'REPORT_FORM', phase: 'preview' }).catch(() => null);
  if (!r?.ok) { setStatus(r?.message || 'Could not read this form.', 4000); return; }
  line.textContent = `Sends draft this site's name (${r.host}) and the form's ${r.labelCount} question ` +
    'label(s) — never your answers, and nothing of the page address beyond the site.';
  box.style.display = 'block';
});
document.getElementById('btn-report-cancel')?.addEventListener('click', () => {
  document.getElementById('report-form').style.display = 'none';
});
document.getElementById('btn-report-send')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-report-send');
  btn.disabled = true;
  const r = await chrome.runtime.sendMessage({ type: 'REPORT_FORM', phase: 'send' }).catch(() => null);
  document.getElementById('report-form').style.display = 'none';
  btn.disabled = false;
  setStatus(r?.ok ? `Reported — thank you. draft will look at ${r.host}'s form.` : (r?.message || 'Could not send the report.'), 5000);
});

init();
