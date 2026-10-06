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

// The company in the logo face (as on the job cards, D1), the title and place beneath it.
function showJobPreview(jobData) {
  document.getElementById('preview-company').textContent = jobData.company || '';
  document.getElementById('preview-title').textContent =
    (jobData.title || '') + (jobData.location ? ' · ' + jobData.location : '');
  document.getElementById('job-preview').style.display = 'block';
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

  await showLastCapture();

  // ⛔ D23, THE MANUAL CONTEXT TRIGGER (owner, 10-04). Opening the popup reads NOTHING from the page
  // and asks the server NOTHING about it. Until "Read this page" is pressed, the popup shows the four
  // actions — capture, fill, score, open draft — unchanged. A wrong primary action is worse than a
  // menu, and this removes that failure rather than tuning a confidence threshold; it also keeps the
  // product's defining property exact: every read of every page begins with a click or a keystroke.
  //
  // The one thing decided on open is local and is not a page read: the tab's address scheme, which
  // the browser already handed the popup. On a page that cannot be captured at all (chrome://, the
  // PDF viewer) Capture is shown DISABLED with its reason — never hidden (D13).
  const tab = await getCurrentTab().catch(() => null);
  const cap = document.getElementById('btn-capture-job');
  if (!isWebPage(tab)) {
    cap.disabled = true;
    cap.title = 'This page cannot be captured';
  }
  document.getElementById('btn-read-page').style.display = 'flex';
  document.getElementById('read-hint').style.display = 'block';
}

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
  document.getElementById('all-divider').style.display = 'block';
  document.getElementById('all-head').style.display = 'block';
  renderCompanion(companionMode({ preview, context }));

  if (!preview?.capturable) {
    // D13: all four actions stay VISIBLE — on a page that cannot be read (chrome://, a PDF viewer)
    // Capture is shown disabled, with the reason, rather than vanishing.
    const cap = document.getElementById('btn-capture-job');
    cap.style.display = 'inline-flex';
    cap.disabled = true;
    cap.title = 'This page cannot be captured';
    setStatus('Open a job posting to capture it');
    return;
  }
  if (preview.ok) {
    currentJobData = { title: preview.title, company: preview.company, location: preview.location };
    showJobPreview(currentJobData);
    setStatus('');
  } else if (preview.unreadable) {
    setStatus('Ready to capture');
  } else {
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
// Shows the one or two actions this page calls for, and why. Everything else stays under
// "Everything" — the decision only adds a shortcut, it never removes a button.
function renderCompanion(c) {
  const box = document.getElementById('companion');
  const line = document.getElementById('ctx-line');
  const q = document.getElementById('ctx-questions');
  if (c.mode === 'form') {
    line.textContent = draftedLine(c.packet);
    const ql = questionsLine(c.packet);
    if (ql) { q.textContent = ql; q.style.display = 'block'; }
    document.getElementById('btn-fill-primary').style.display = 'flex';
    box.style.display = 'block';
    return;
  }
  if (c.mode === 'posting') {
    line.textContent = postingLine(c.posting);
    line.className = 'ctx-line' + (c.posting?.saved ? ' saved' : '');
    document.getElementById('posting-actions').style.display = 'flex';
    if (c.posting?.saved) document.getElementById('btn-capture-primary').textContent = 'Capture again';
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
  setStatus('Filling…');
  const r = await chrome.runtime.sendMessage({ type: 'FILL_ACTIVE_TAB' }).catch(() => null);
  setStatus(r?.message || (r?.ok ? 'Filled — check every answer, then submit.' : 'Could not fill this page.'), 4000);
  // D36: stay open when the fill worked but its review panel did not — that sentence is the only
  // place the candidate learns the answers were not laid out for checking.
  if (r?.ok && r?.overlay?.rendered !== false) setTimeout(() => window.close(), 1200);
}
document.getElementById('btn-fill-primary').addEventListener('click', fillActiveTab);
document.getElementById('btn-fill').addEventListener('click', fillActiveTab);

// The companion's Capture it / Score it are the same handlers as the buttons under "Everything".
document.getElementById('btn-capture-primary').addEventListener('click', () => captureFrom('btn-capture-primary'));
document.getElementById('btn-score-primary').addEventListener('click', () => openAtsScore());

// The SAME capture the hotkey runs — same message, same implementation, same destination, same
// wording. Previously this button called a second implementation that wrote to a different table
// with a different dedup identity, so "Save Job" and Ctrl+Shift+K were two features wearing one name.
document.getElementById('btn-capture-job').addEventListener('click', () => captureFrom('btn-capture-job'));

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

document.getElementById('btn-linkedin').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'OPEN_LINKEDIN_IMPORT' });
  setStatus('Opening sign in...', 1000);
  setTimeout(() => window.close(), 900);
});

// Collecting the page text was gated on the same hardcoded six-hostname list the capture button
// used, so the ATS tool refused to read a Greenhouse posting on a company's own careers domain and
// opened an empty scorer instead. The gate was never what made the read legal — the activeTab grant
// from opening this popup is — so it is gone. On a page with nothing to read the extraction simply
// comes back empty and the scorer opens blank, which is the old else-branch behaviour anyway.
document.getElementById('btn-ats').addEventListener('click', () => openAtsScore());

async function openAtsScore() {
  const tab = await getCurrentTab();
  let jobText = '';
  if (tab?.id) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body?.innerText?.slice(0, 6000) || '',
      });
      jobText = result || '';
    } catch (_err) { /* no grant, or a page that cannot be injected: open the scorer empty */ }
  }
  await chrome.runtime.sendMessage({ type: 'OPEN_ATS_SCORE', jobText });
  setStatus('Sending to ATS Score...', 1000);
  setTimeout(() => window.close(), 900);
}

// ─── Settings (keyboard shortcuts) ─────────────────────────────────────────
// Named for both commands, not just capture: this button was the only route to the shortcuts page
// and it advertised one of the two hotkeys, which is how the fill shortcut stayed invisible.

document.getElementById('btn-settings')?.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();
