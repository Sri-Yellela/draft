import {
  runGatedHandoff, clearPacketForTab, sweepExpiredPackets, applyOverlayEdit,
  loadBatchForTab, clearBatchForTab, portalQueueFor, armBatchAdvance, takeBatchAdvance,
  prepareAndFill, recordSubmitted, copySheetFor, pageMatchFor, packetFillsOrigin, overlayTheme, loadPacketForTab,
  formFrameOf, formFrameHandlers as FORM_FRAME_HANDLERS,
} from './gated-handoff.js';
// ⭐ T17: the ONE floating dock (dock.js) — drawn in the TOP frame only; where it sits, remembered per site; the look.
import { handlers as DOCK_HANDLERS, configureDock, drawInDock, dockMeta, openDockInPage, forgetAppearance } from './dockHost.js';
// D96 §3 (J1): where each application stands — local, per job, no answer values.
import { noteCapture, noteContext, noteReviewed, noteAddress, notePacketState, progress, resumeFor } from './progress.js';
// ⭐ T13 + T14 (field report 10-14): the ONE accessor for what a tab is (and a known address binds a new tab at once),
// and the one press of Fill that reads, prepares and fills.
import { handlers as TAB_STATE_HANDLERS, tabStateFor, runFillChain, chainMessage } from './tabState.js';
// T6: Options → "Show details" — what draft answered, per tab and per server path (memory only)
import { notePageRead, detailsOf, readTabIds } from './diagnostics.js';
// D96 §4–§5 (J4): the review panel's acknowledge / change / dock — answers go to the user's own Saved answers.
import { handlers as ANSWER_MEMORY_HANDLERS, configureAnswerMemory } from './answerMemory.js';
// D98 §4–§5 (J6): the résumé on the page — generate (the panel's own trusted click only), preview, attach, fallback.
import { handlers as RESUME_PANEL_HANDLERS, configureResumePanel } from './resumePanel.js';
// D99 J11: the board hands a job to the extension (boardBridge.js, the one content script, on draft's origin only).
import { handlers as BOARD_OPEN_HANDLERS, configureBoardOpen } from './boardOpen.js';
import { extractJobPayload, showCaptureToast } from './extractor.js';
import { lookupBoardJob } from './boardJob.js';
// ⭐ BINDING FIRST (owner 10-15): every press on a page draft has not seen identifies the page and binds the tab first.
import { identifyAndBind, identityView, STOPS as IDENTITY_STOPS } from './identify.js';
// ⭐ One job per tab across every stage of its application, and the Copy sheet as an in-page panel (owner, 10-12).
import { bindTab, bindingForTab, clearBinding, bindingLine, loadBinding, BIND_PREFIX } from './tabBinding.js';
import { renderCopySheetPanel } from './copy-sheet-panel.js';
import { authedFetch, getIdentity, cachedIdentity, disconnect } from './auth.js';
import { captureResultFrom } from './captureResult.js';
import {
  CONTEXT_MENUS, MENU_SAVE_PAGE, MENU_SAVE_LINK, MENU_FILL_PAGE, MENU_ATS_PAGE, saveableLink, reportHostOf, buildFormReport, collectFormLabels,
} from './formReport.js';
// D23: the site's colour tokens, generated from client/src/styles/colorTokens.js — the toolbar badge
// and the capture toast take their colours from here, never from a literal.
import { C_LIGHT, C_DARK } from './tokens.js';
// D97 (J5): automatic reading, per site, all off — the four switches, the watcher's registrations, the consent.
import {
  handlers as AUTO_READ_HANDLERS, configureAutoRead, reconcileAutoRead, onPermissionsRemoved, syncRegistrations, forgetTab, noteFrameSite,
} from './autoRead.js';

// ⭐ T12 · a press found the form inside an ATS frame draft may not read yet: the settings remember WHICH site that page's
// origin embeds (autoRead.js frameHints), so the popup's "Always read here" can ask for that frame too — local knowledge.
async function noteActiveFrame(r) {
  if (r?.reason !== 'frame_needs_permission' || !r.site?.id) return r;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (tab?.url) await noteFrameSite(tab.url, r.site.id);
  return r;
}

// Keep in sync with config.js (service workers cannot share plain-script globals).
// DEV SWITCH: comment line A, uncomment line B.
const RESUME_MASTER_URL = 'https://jobsviadraft.com'; // A: production
// const RESUME_MASTER_URL = 'http://localhost:3001'; // B: local dev (npm start serves :3001)

// ── Capture (E2) ─────────────────────────────────────────────────────────────
// THE ONE NETWORK PATH FOR CAPTURE, and it lives in the service worker rather than the content
// script for a reason that only shows up in production.
//
// A content script's fetch carries the PAGE's origin — https://www.linkedin.com — not the
// extension's. server.js's corsOrigin admits only APP_BASE_ORIGIN/FRONTEND_ORIGIN in production, and
// corsOriginExtension additionally admits chrome-extension:// but not a job board either. So every
// capture posted from the content script would be refused by CORS the moment NODE_ENV=production —
// invisible in development, where corsOrigin returns true for everything.
//
// A service worker fetch is not subject to CORS for a host in host_permissions, and
// https://jobsviadraft.com/* is declared. Moving the call here fixes it without widening the
// server's CORS to six job boards, which is the alternative and a far worse trade.
async function importCapturedJob({ url, text }) {
  try {
    // authedFetch, not a bare credentialed fetch: the extension acts as its OWN token, never as
    // whatever session the browser holds. See extension/auth.js.
    const res = await authedFetch(RESUME_MASTER_URL, '/api/import/job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, text }),
    });

    // null means there is no credential to be had — no session to bootstrap from, so the remedy
    // is signing in on the website, not retrying here.
    if (!res) return captureResultFrom(401, {}, RESUME_MASTER_URL);
    const json = await res.json().catch(() => ({}));
    // ⛔ D33: the server's capture object says what happened — added · already on the board (with a
    // link to that posting) · held off the board and WHY · closed — and the toast and popup show
    // exactly that. A 2xx that says nothing is not reported as a capture. needsClientCapture (should
    // not happen: the extracted text is always sent) is reported, not swallowed — captureResult.js.
    return captureResultFrom(res.status, json, RESUME_MASTER_URL);
  } catch (e) {
    return { success: false, outcome: null, onBoard: false, message: 'Could not reach draft', link: null, jobId: null };
  }
}

// ── THE capture implementation. One function, every trigger. ─────────────────
//
// Extraction is INJECTED rather than delivered by a content script, and that is the whole design.
// A content script needs a host permission for every origin it runs on, so capture only ever worked
// on the six boards the manifest happened to name — never on a Greenhouse board embedded at
// stripe.com/jobs, never on Ashby, never on a company careers page. You cannot enumerate every
// employer's domain, so that approach had a ceiling built into it.
//
// activeTab has no such ceiling. The user's invocation — the toolbar click or the hotkey — grants
// access to that one tab, and executeScript reaches it whatever the origin. G0 measured the grant
// on a real Workday tenant with no host permission for it; E6 measured that a toolbar click grants
// it to the popup too. So the extension now asks for NO job-board host permission at all and
// captures more sites than it did with seven.
//
// It also means the extension has no standing access to anything. Before, it could read six sites
// whenever they were open. Now it can read one tab, at the moment you point it at one.
async function captureActiveTab(tab) {
  if (!tab?.id) return { success: false, message: 'No active tab.' };

  // tab.url is only readable once the grant exists, so treat "unreadable" as "not yet granted"
  // rather than as a bad page — the injection below will produce the real error if there is one.
  if (tab.url && !/^https?:$/.test(new URL(tab.url).protocol)) {
    return { success: false, message: 'Only http(s) pages can be captured.' };
  }

  let extracted;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPayload });
    extracted = r?.result;
  } catch (e) {
    // The grant is missing or lapsed — Chrome revokes it when the tab leaves the origin it was
    // taken on. This is an expected state with a clear remedy, not a failure worth a stack trace.
    return { success: false, message: 'Press the shortcut again on the job page you want to capture.' };
  }

  if (!extracted?.ok) {
    const miss = { success: false, message: 'No job found on this page' };
    await reportCapture(tab.id, miss);
    return miss;
  }

  const result = await importCapturedJob({ url: extracted.url, text: extracted.text });
  // ⭐ THE TAB BINDING: this tab is now on this job — whatever stage of the application it moves to next, and even
  // where Workday changes steps without changing the address. Session-only; cleared when the tab closes.
  if (result?.success && result.jobId) {
    await bindTab(tab, { jobId: result.jobId, title: extracted.title || null, company: extracted.company || null, via: 'capture' }).catch(() => null);
  }
  await noteCapture(result, extracted, tab.url || null);
  await reportCapture(tab.id, result);
  return result;
}

// The toast's colours, both palettes: it is injected into the page and picks one by the page's
// prefers-color-scheme. Text on a solid state fill is SURFACE_SOLID — the sanctioned pairing in
// colorTokens.js's CONTRAST_PAIRS (["SURFACE_SOLID", "SUCCESS"], ["SURFACE_SOLID", "DANGER"]).
function toastTheme() {
  const pick = (c) => ({ ok: c.SUCCESS, fail: c.DANGER, text: c.SURFACE_SOLID, shadow: c.SHADOW_MD });
  return { light: pick(C_LIGHT), dark: pick(C_DARK) };
}

/** Same feedback for every trigger: the toast in the page, and the record the popup reads later. */
async function reportCapture(tabId, result) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId }, func: showCaptureToast, args: [result.message, !!result.success, toastTheme()],
    });
  } catch (_) { /* the toast is a courtesy; never let it change the outcome */ }
  // Recorded so the popup can show the outcome of a hotkey capture it was not open for.
  chrome.storage.local.set({ lastCapture: { ...result, at: Date.now() } }).catch(() => {});
}

/**
 * D13 — the page's context for the companion popup, from two reads the server already answers:
 *   · POST /api/import/context      — is this posting on your board, what ATS the URL names, your
 *                                     recent captures
 *   · portalQueueFor(origin)         — the applications you DRAFTED whose form lives at this origin
 *                                     (gate-packets?origin=), with their counts — never their answers
 * Either can fail on its own; the popup then falls back to showing every action.
 *
 * ⭐ BINDING FIRST (owner 10-15): before either is asked, the page is IDENTIFIED and the tab BOUND (identify.js
 * identifyAndBind — the address, the embedded ATS form's address, then the page's text through the capture's matcher).
 * Both questions then go out WITH the binding (before this they fired in parallel, unbound, and the binding came after).
 * A failed identify binds nothing and prepares nothing; "draft could not ask" (signed out, unreachable) asks nothing more.
 */
async function popupContext(tab) {
  let url = '';
  let origin = '';
  try { const u = new URL(tab?.url || ''); if (/^https?:$/.test(u.protocol)) { url = u.href; origin = u.origin; } }
  catch { /* chrome://, file:// or a blank tab: no page context, recent captures only */ }
  const identity = url ? await identifyAndBind(tab, { serverUrl: RESUME_MASTER_URL }).catch(() => null) : null;
  // T2 + T3: draft's answer about this page — which job, and the ATS report (the board job's, or the page's own text's)
  const page = identity?.lookup ? { ok: true, ...identity.lookup } : null;
  if (identity && IDENTITY_STOPS.includes(identity.outcome)) {
    notePageRead(tab?.id, { url, known: false, jobId: null, how: null, pageKey: null, basis: null, atsState: null });
    return { url, origin, prepared: false, identity: identityView(identity), binding: null, posting: null, ats: null, report: null,
             recent: [], packets: [], handoff: null, notice: null };
  }
  let [board, queue] = await Promise.all([
    authedFetch(RESUME_MASTER_URL, '/api/import/context', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
    })
      .then(r => (r && r.ok ? r.json() : null)).catch(() => null),
    // D56: which packets may fill THIS page (origin list + job id), or which case it is — and the
    // on-demand company notice (§8 row 10). Asked only on the press, like the rest of this — and now with the binding.
    origin ? pageMatchFor(RESUME_MASTER_URL, tab) : Promise.resolve(null),
  ]);
  if (page?.ok && board?.posting) {
    const p = page.posting;
    const score = page.ats?.state === 'ready' && Number.isFinite(page.ats.score) ? page.ats.score : null;
    const scores = score != null ? { base: score, tailored: null, shown: score, tailoredShown: false } : board.posting.scores || null;
    if (p?.known && !board.posting.known) {
      board.posting = { ...board.posting, known: true, jobId: p.jobId, title: p.title, company: p.company, how: p.how, active: true, scores };
    } else if (score != null && !Number.isFinite(board.posting.scores?.shown)) board.posting = { ...board.posting, scores };
  }
  // ⭐ T9: when the identify's answer carried no report (an older server, or no page answer at all), ask draft for the
  // bound board job's report (GET /api/extension/job/:id: no page text leaves the browser), for the web app's ATS report
  // in the popup — one extra GET, on the press only.
  const boardReport = !page?.ats && board?.posting?.known && board.posting.jobId
    ? await lookupBoardJob(RESUME_MASTER_URL, board.posting.jobId).catch(() => null) : null;
  // T14: the score draft gave this job here — kept with the tab's state and the job's record, so the card comes back
  // on the next open without a read.
  const shownScore = Number.isFinite(board?.posting?.scores?.shown) ? board.posting.scores.shown : null;
  const ats = shownScore != null ? { score: shownScore, band: page?.ats?.band ?? null } : null;
  let binding = await bindingForTab(tab);
  // The identify bound the tab; the card's score rides on that binding (the same job only — never a rebind here).
  if (binding && ats && board?.posting?.known && String(board.posting.jobId) === String(binding.jobId)) {
    binding = (await bindTab(tab, { jobId: binding.jobId, title: binding.title, company: binding.company, via: binding.via, ats }).catch(() => null)) || binding;
  }
  await noteContext(board, binding, { url, ats });
  // ⭐ T13 · "Read this page" also PREPARES — only for a page the identify bound (or a tab bound before that kept its
  // binding): when the server says the job is the user's own with nothing prepared (or what was prepared has gone off),
  // the packet is built — no model call, no Draft slot (routes/apply.js prepareManualPacket) — and the queue re-read,
  // so the popup offers Fill, not Prepare. ⛔ An identify that named no job prepares nothing on an unbound tab.
  let prepared = false;
  if (origin && binding && queue?.canPrepare && (queue.state === 'prepare' || queue.state === 'stale')) {
    const prep = await prepareAndFill({ serverUrl: RESUME_MASTER_URL, tab, fill: false }).catch(() => null);
    prepared = !!prep?.prepared;
    if (prepared) queue = await pageMatchFor(RESUME_MASTER_URL, tab).catch(() => queue);
  }
  // ⭐ T15 · the server's packet — made, expires, how many fields — is what the job's record remembers as "prepared".
  if (binding) await notePacketState(binding.jobId, queue?.packets || []);
  notePageRead(tab?.id, { url, known: !!board?.posting?.known, jobId: board?.posting?.jobId ?? null, how: board?.posting?.how || null,
    pageKey: board?.pageKey?.key || null, basis: page?.basis || null, atsState: page?.ats?.state || null });
  return {
    url, origin, prepared,
    identity: identityView(identity),
    binding: binding ? { jobId: binding.jobId, title: binding.title, company: binding.company, via: binding.via, boundAt: binding.boundAt,
               ...(binding.via === 'board' && binding.board?.ats ? { ats: binding.board.ats } : {}) } : null,
    posting: board?.posting || null,
    ats: board?.ats || null,
    // T3: draft's report for this page — `basis` "board" (the board job's) or "page" (the page's own text)
    report: page?.ok && page.ats ? { ...page.ats, basis: page.basis }
      : boardReport?.ok && boardReport.ats ? { ...boardReport.ats, basis: 'board' } : null,
    recent: board?.recent || [],
    packets: (queue?.packets || []).map(p => ({
      packetId: p.packetId, title: p.title, company: p.company, createdAt: p.createdAt, stale: !!p.stale,
      // T15: when it goes off, by the server's own rule (staleAfterMs), never a local guess
      expiresAt: Number.isFinite(p.createdAt) && Number.isFinite(p.staleAfterMs) ? p.createdAt + p.staleAfterMs : null,
      answerCount: p.answerCount ?? 0, unresolvedCount: p.unresolvedCount ?? 0, resumeAvailable: !!p.resumeAvailable,
      gateReason: p.gateReason || null,
      // D63: the job card and the packet summary — two scores and a logo address, nothing more.
      scores: p.scores || null, logo: p.logo || null,
    })),
    handoff: queue ? { state: queue.state || null, message: queue.message || null, canPrepare: !!queue.canPrepare,
                       job: queue.job || null, resume: queue.resume || null } : null,
    notice: queue?.notice || null,
  };
}

// ── ⭐ T17 · THE DOCK ────────────────────────────────────────────────────────────────────────────────────────────────
/** The Copy sheet tab of the dock, for this tab's job (its prepared answers) or the profile. */
async function copySheetPanel(tab) {
  const sheet = await copySheetFor({ serverUrl: RESUME_MASTER_URL, tab });
  const r = await drawInDock(tab.id, renderCopySheetPanel, [sheet, await overlayTheme(), await dockMeta(tab)]);
  return { ok: !!r?.rendered, rows: r?.rows ?? 0, message: sheet?.message || null };
}

/** A tab of the dock that has no view yet: ATS and Résumé from draft's server, the Copy sheet likewise. Fill is drawn by
 *  a fill only — the dock's Fill tab says how to start one. */
async function drawDockTab(tab, which) {
  if (which === 'ats' || which === 'resume') return RESUME_PANEL_HANDLERS.RESUME_PANEL_OPEN({ tab: which }, { tab });
  if (which === 'copy') return copySheetPanel(tab);
  return { ok: true };
}

/** Open the dock on a tab (drawing it if it is not there), on `which` tab — or the one it was on, or ATS when empty. */
async function openDock(tab, which = null) {
  const cant = { ok: false, message: "draft can't open its panel on this page." };
  if (!tab?.id || !/^https?:/.test(String(tab.url || ''))) return cant;
  const want = ['fill', 'ats', 'resume', 'copy'].includes(which) ? which : null;
  let r;
  try { r = await drawInDock(tab.id, openDockInPage, [await dockMeta(tab), want]); } catch { return cant; }
  if (!r?.ok) return cant;
  const has = Array.isArray(r.has) ? r.has : [];
  const target = want || (has.includes(r.active) ? r.active : has.includes('fill') ? 'fill' : 'ats');
  if (!has.includes(target)) {
    const drawn = await drawDockTab(tab, target).catch(() => null);
    if (target !== 'fill' && !drawn?.ok) return { ok: true, tab: target, message: drawn?.message || null };
  } else if (!want) {
    try { await drawInDock(tab.id, openDockInPage, [await dockMeta(tab), target]); } catch { /* it is open */ }
  }
  return { ok: true, tab: target };
}

/** What the popup shows once you press "Read this page" (D23). Same extractor, no network, no writes. */
async function previewActiveTab(tab) {
  const capturable = !!tab?.id && (!tab.url || /^https?:$/.test(new URL(tab.url).protocol));
  if (!capturable) return { capturable: false };
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPayload });
    const p = r?.result;
    return { capturable: true, ok: !!p?.ok, title: p?.title || '', company: p?.company || '', location: p?.location || '' };
  } catch (_) {
    // No grant yet. The button still shows: clicking it is itself an invocation, and the capture
    // that follows will succeed where this speculative read could not.
    return { capturable: true, ok: false, unreadable: true };
  }
}

const WORKER_STARTED = Date.now();
/** tabId → the last GATE_REVIEW_STATE write in flight; the next one waits for it (see GATE_REVIEW_STATE). */
const reviewWrites = new Map();

/**
 * ⭐ T6 · Options → "Show details": every tab draft knows about (bound, or read since the worker started) with its binding,
 * what draft last answered about its page, its remembered progress and its last generation (the server's status and
 * cause code, asked now), and each server path's last answer. ⛔ Named fields only — extension/diagnostics.js.
 */
async function diagnostics() {
  let bound = [];
  try { bound = Object.keys(await chrome.storage.session.get(null)).filter(k => k.startsWith(BIND_PREFIX)).map(k => Number(k.slice(BIND_PREFIX.length))); }
  catch { bound = []; }
  const ids = [...new Set([...readTabIds(), ...bound])].filter(Number.isFinite).slice(0, 8);
  const tabs = [];
  for (const id of ids) {
    const binding = await loadBinding(id);
    const jobId = binding?.jobId ?? null;
    const prog = jobId != null ? await progress.get({ jobId }).catch(() => null) : null;
    const resume = jobId != null ? await resumeFor(jobId).catch(() => null) : null;
    let view = null;
    if (resume?.id) {
      const r = await authedFetch(RESUME_MASTER_URL, `/api/extension/resume/${encodeURIComponent(resume.id)}`).catch(() => null);
      view = r && r.ok ? await r.json().catch(() => null) : null;
    }
    tabs.push({ id, binding, progress: prog, resume, view });
  }
  let hasToken = false;
  try { hasToken = !!(await chrome.storage.local.get('authToken'))?.authToken; } catch { hasToken = false; }
  return detailsOf({ version: chrome.runtime.getManifest().version, hasToken, identity: await cachedIdentity().catch(() => null),
    tabs, workerStartedAt: WORKER_STARTED });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Capture, from the popup button. The hotkey reaches the same function through onCommand below;
  // neither trigger has an implementation of its own.
  if (message.type === 'CAPTURE_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => captureActiveTab(tab))
      .then(sendResponse);
    return true;                                            // async response
  }

  // D64 · the popup's "Captured today", and its undo — asked when the popup opens its list.
  if (message.type === 'AUTO_CAPTURES') {
    authedFetch(RESUME_MASTER_URL, '/api/import/auto')
      .then(r => (r ? r.json() : null)).then(sendResponse).catch(() => sendResponse(null));
    return true;
  }
  if (message.type === 'AUTO_CAPTURE_UNDO' && message.jobId) {
    authedFetch(RESUME_MASTER_URL, `/api/import/auto/${encodeURIComponent(message.jobId)}/undo`, { method: 'POST' })
      .then(r => (r ? r.json() : null)).then(sendResponse).catch(() => sendResponse(null));
    return true;
  }

  // T6 — only the extension's own Options page may ask (a web page's message never reaches this listener anyway)
  if (message.type === 'DIAGNOSTICS') {
    if (sender?.id !== chrome.runtime.id || !String(sender?.url || '').startsWith(chrome.runtime.getURL('options.html'))) {
      sendResponse(null); return false;
    }
    diagnostics().then(sendResponse, () => sendResponse(null));
    return true;
  }

  if (message.type === 'PREVIEW_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => previewActiveTab(tab))
      .then(sendResponse);
    return true;
  }

  // D13, THE COMPANION — what the popup needs to pick the right action for this page. ⛔ D23: asked
  // only when the user PRESSES "Read this page" in the popup (or its R key) — never on popup open —
  // and never stored: no storage key is added, so the listing's six are unchanged. See popupContext().
  if (message.type === 'POPUP_CONTEXT') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => popupContext(tab))
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true;
  }

  // D13: "Fill it" from the popup — the SAME handoff Ctrl+Shift+Y runs (one implementation, two
  // triggers, as capture already is). Opening the popup is the gesture that grants activeTab.
  if (message.type === 'FILL_ACTIVE_TAB') {
    handleGatedHandoff()
      .then(noteActiveFrame)
      // D36: whether the review panel opened travels with the answer, so the popup can stay open when it did not.
      .then(r => sendResponse({ ok: !!r?.ok, message: r?.message || null, overlay: r?.overlay ? { rendered: r.overlay.rendered === true } : null,
        reason: r?.reason || null, canPrepare: !!r?.canPrepare, did: Array.isArray(r?.did) ? r.did : [],
        // ⭐ BINDING FIRST: an identify that bound nothing says which outcome, and the ONE action it leaves (Capture, Sign in)
        action: typeof r?.action === 'string' ? r.action : null, outcome: r?.identity?.outcome || null,
        // T11: the frame's site, for the popup's one "Allow draft on <site>" button (names and origins only)
        site: r?.reason === 'frame_needs_permission' && r.site ? { id: r.site.id, name: r.site.name, origins: r.site.origins } : null }))
      .catch(() => sendResponse({ ok: false, message: 'Could not fill this page.' }));
    return true;
  }

  // ⭐ D56 · "Prepare this application" — one click builds the packet on demand, then the same handoff
  // fills it. The popup's click is the gesture that grants activeTab.
  if (message.type === 'PREPARE_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(async ([tab]) => { const r = await prepareAndFill({ serverUrl: RESUME_MASTER_URL, tab }); await reportHandoff(tab, r); return noteActiveFrame(r); })
      .then(r => sendResponse({ ok: !!r?.ok, message: r?.message || null, reason: r?.reason || null,
        overlay: r?.overlay ? { rendered: r.overlay.rendered === true } : null,
        site: r?.reason === 'frame_needs_permission' ? r.site || null : null }))
      .catch(() => sendResponse({ ok: false, message: 'Could not prepare this application.' }));
    return true;
  }

  // ⭐ D56 · "I submitted" from the popup — recorded against the page in view, which is the evidence.
  if (message.type === 'SUBMITTED_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => recordSubmitted({ serverUrl: RESUME_MASTER_URL, tab }))
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, message: 'Could not record it.' }));
    return true;
  }

  // ⭐ The Copy sheet as a PANEL IN THE PAGE (owner 10-12: the popup closed on every paste, and had no close) — ⭐ T17:
  // the dock's Copy sheet tab. The popup's press is the gesture that grants activeTab; the tab is drawn under it and the
  // popup closes itself.
  if (message.type === 'COPY_SHEET_PANEL') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => copySheetPanel(tab))
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, message: "draft can't show the Copy sheet on this page." }));
    return true;
  }
  // ⭐ T17 · "Open dock" — the popup is a launcher: it opens the dock on the page and closes itself (a toolbar popup can
  // neither be resized nor stay open). `message.tab` names the tab to show; a tab with no view yet is drawn — a view
  // from draft's server, never a read of the page.
  if (message.type === 'DOCK_OPEN') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => openDock(tab, message.tab))
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, message: "draft can't open its panel on this page." }));
    return true;
  }
  // ⭐ T17 · the dock's empty Fill tab: "Fill this page" — the SAME chain the popup's Fill it and Ctrl+Shift+Y run, for
  // the tab the dock is on. ⛔ Only the person's own click in the page's TOP frame (the dock never exists elsewhere).
  if (message.type === 'DOCK_FILL') {
    if (message.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false }); return true; }
    handleGatedHandoff(sender.tab)
      .then(r => sendResponse({ ok: !!r?.ok, message: r?.message || null }))
      .catch(() => sendResponse({ ok: false, message: 'Could not fill this page.' }));
    return true;
  }
  // ⭐ T17 · the dock's own tab press, on a tab with no view yet (the dock's page, its TOP frame, a trusted click).
  if (message.type === 'DOCK_TAB') {
    if (message.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false }); return true; }
    drawDockTab(sender.tab, message.tab)
      .then(r => sendResponse({ ok: !!r?.ok, message: r?.message || null }))
      .catch(() => sendResponse({ ok: false, message: 'draft could not show this here.' }));
    return true;
  }
  // "Unlink this page" — forget which job this tab is on.
  if (message.type === 'UNBIND_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => clearBinding(tab?.id)).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  // ⭐ "N today · M already on your board" — distinct jobs captured in 24 h by ANY route. Account-level, like the ring.
  if (message.type === 'CAPTURED_TODAY') {
    authedFetch(RESUME_MASTER_URL, '/api/import/today')
      .then(r => (r && r.ok ? r.json() : null)).then(sendResponse).catch(() => sendResponse(null));
    return true;
  }

  // ⭐ §8 row 17 · the Copy sheet — the prepared answers, for the popup to list. Nothing enters the page.
  if (message.type === 'COPY_SHEET') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => copySheetFor({ serverUrl: RESUME_MASTER_URL, tab }))
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, rows: [] }));
    return true;
  }

  // ⭐ §8 row 15, decision D · THE TODAY RING — today's Drafts and new résumés against the user's CAP
  // (the day's Draft slots, services/draftSlots.js), never a goal. It asks about the ACCOUNT, not the
  // page: no tab, no URL, nothing read — so it is allowed on popup open (D23's rule is about the page).
  if (message.type === 'TODAY_RING') {
    authedFetch(RESUME_MASTER_URL, '/api/draft/slots')
      .then(r => (r && r.ok ? r.json() : null))
      .then(s => sendResponse(s ? { limit: s.limit, used: s.used, remaining: s.remaining, windowHours: s.windowHours ?? 24 } : null))
      .catch(() => sendResponse(null));
    return true;
  }

  // The popup's auth probe, moved here for the same CORS reason: from the popup this request
  // carries chrome-extension://, which corsOrigin refuses in production.
  if (message.type === 'PROBE_AUTH') {
    getIdentity(RESUME_MASTER_URL)
      .then(id => sendResponse(id))
      .catch(() => sendResponse({ authenticated: false }));
    return true;
  }

  // WHO THE EXTENSION IS ACTING AS. The popup must be able to name it — an extension that acts
  // with an identity the user cannot see is the defect this whole change exists to remove.
  // Answers from cache first so the popup can paint immediately, then the popup re-asks.
  if (message.type === 'GET_IDENTITY') {
    (message.fresh
      ? getIdentity(RESUME_MASTER_URL)
      : cachedIdentity().then(c => c || getIdentity(RESUME_MASTER_URL))
    ).then(id => sendResponse(id || { authenticated: false }))
     .catch(() => sendResponse({ authenticated: false }));
    return true;
  }

  // Ending the extension's own credential, deliberately. Revokes server-side, then clears locally.
  if (message.type === 'DISCONNECT') {
    forgetAppearance();
    disconnect(RESUME_MASTER_URL)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // ⛔ THIS PATH WAS NEVER A ROUTE. `/resume` fell through to the client's catch-all, which redirects an authenticated
  // ADMIN to /admin — the whole "the resume builder opened an admin session" report (docs/EXTENSION_DIAGNOSIS.md §4).
  // The real page is /tools/generate (a server-side alias keeps the old path working for v1.0.0 installs).
  // ⭐ T22: OPEN_ATS_SCORE (the popup's Score tile → /tools/ats with the page's text in the URL) is gone with the tile:
  // draft's report for this tab's job is the dock's ATS tab (Open dock, or right-click "Show draft's ATS report").

  if (message.type === 'OPEN_LINKEDIN_IMPORT') {
    chrome.tabs.create({ url: `${RESUME_MASTER_URL}/auth/linkedin` });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'OPEN_RESUME_BUILDER') {
    // /tools/generate is the standalone resume generator. There is no separate "resume builder"
    // surface in the client and there never was, which is why /resume could not have worked.
    chrome.tabs.create({ url: `${RESUME_MASTER_URL}/tools/generate` });
    sendResponse({ success: true });
    return true;
  }

  return true;
});

// The hotkey. chrome://extensions/shortcuts owns the binding, and that is now the only way to
// rebind it: the old page-scoped keydown override lived in the content script, which no longer
// exists. Chrome's own rebinding UI works on every page rather than only the six the content
// script reached, so this is a smaller extension doing more.
//
// THE LISTENER FIRING IS THE PERMISSION. A chrome.commands invocation is a user gesture, which is
// what grants activeTab for the tab they are on — the same grant the gated handoff runs on.
chrome.commands.onCommand.addListener((command) => {
  if (command === 'fill-gated-application') { void handleGatedHandoff(); return; }
  if (command !== 'capture-job') return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => { void captureActiveTab(tab); });
});

// ── Gated portal handoff (TASK G2) ───────────────────────────────────────────
// THIS LISTENER FIRING IS THE PERMISSION. A chrome.commands invocation is a user gesture, which is
// what grants activeTab for the tab they are on — there is no host permission for portal origins and
// there must never be. Everything else follows from that one grant.
//
// The result is reported with chrome.action's badge rather than a notification: the extension has no
// `notifications` permission, and adding one for a status message would be a new user-facing consent
// prompt for something a badge already says.
//
// ⭐ T13 (field report 10-14) · ONE PRESS DOES THE WHOLE CHAIN. The press (this command, or the popup's Fill) is the
// user's explicit trigger for THIS page, so it does what the page needs: binds a tab whose address the job was already
// seen at (T14), IDENTIFIES and binds the page first when the tab does not know it here (⭐ BINDING FIRST — a failed
// identify binds and prepares nothing), fills, and prepares-then-fills when nothing is prepared — and says what it did
// (tabState.js runFillChain). ⛔ Only this press runs the chain: the automatic switches
// (autoRead.js) call the handoff itself.
async function handleGatedHandoff(onTab = null) {
  void sweepExpiredPackets();
  // ⭐ T17: the dock's own "Fill this page" names its tab (the page it is on); every other press is the active tab's.
  const [tab] = onTab ? [onTab] : await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await runFillChain({
    state: () => tabStateFor(tab),
    identify: () => identifyAndBind(tab, { serverUrl: RESUME_MASTER_URL }),
    fill: () => runGatedHandoff({ serverUrl: RESUME_MASTER_URL, tab }),
    prepare: () => prepareAndFill({ serverUrl: RESUME_MASTER_URL, tab }),
  });
  // ⭐ When the tab's binding is what told draft which job this is, the fill says so — after what the press did first.
  const bound = await bindingForTab(tab).catch(() => null);
  if (bound && result?.ok) result.message = chainMessage(result.did, { ...result, message: `${bindingLine(bound)}. ${result.fillMessage || ''}`.trim() });
  // T14: the page this fill ran on is an address the job is known at — a new tab on it binds at once.
  if (bound) await noteAddress(bound.jobId, tab?.url, { title: bound.title, company: bound.company });
  await reportHandoff(tab, result);
  return result;
}

async function reportHandoff(tab, result) {
  const badge = result.ok ? { text: String(result.filled?.length ?? 0), color: C_LIGHT.SUCCESS }
                          : { text: '!', color: C_LIGHT.DANGER };
  try {
    await chrome.action.setBadgeText({ tabId: tab?.id, text: badge.text });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab?.id, color: badge.color });
    await chrome.action.setTitle({ tabId: tab?.id, title: result.message || 'draft' });
  } catch { /* a tab that closed mid-handoff is not an error worth surfacing */ }

  // Stored so the popup, and the verification harnesses, can see the detail a badge cannot.
  try {
    await chrome.storage.session.set({ lastGatedHandoff: { ...result, at: Date.now(), tabId: tab?.id } });
  } catch { /* session storage is best-effort here */ }
}

// ── Review overlay traffic (TASK G3) ─────────────────────────────────────────
// The overlay runs in the page's isolated world and talks back through here. Two messages: a
// corrected value, and the running readiness state.
//
// Kept OUT of the onMessage listener above, which answers synchronously; these need to await.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'GATE_REVIEW_EDIT') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, reason: 'no_tab' }); return true; }
    // ⭐ T17: the panel is on the dock, in the TOP frame; its edit goes to the frame the FORM is in (T11's tabId + frameId).
    applyOverlayEdit({ tabId, frameId: formFrameOf(tabId), field: msg.field, value: msg.value })
      .then(result => sendResponse({ ok: true, result }))
      .catch(e => sendResponse({ ok: false, reason: e.message }));
    return true;                                            // async response
  }

  // ── One gate crossing, several applications (TASK G5) ─────────────────────
  // Moves the SAME TAB to the next application on this portal. G0 measured that the activeTab grant
  // survives every same-origin navigation, browser-initiated ones included, so this costs no second
  // gesture — which is the entire point of amortising per portal rather than per application.
  if (msg?.type === 'GATE_BATCH_NEXT') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, reason: 'no_tab' }); return true; }
    advanceBatch(tabId).then(r => sendResponse(r)).catch(e => sendResponse({ ok: false, reason: e.message }));
    return true;
  }

  // D56: "I submitted it" in the review overlay — the overlay's own tab is the page recorded.
  if (msg?.type === 'GATE_SUBMITTED') {
    if (!sender.tab?.id) { sendResponse({ ok: false, message: 'No tab.' }); return true; }
    recordSubmitted({ serverUrl: RESUME_MASTER_URL, tab: sender.tab })
      .then(r => sendResponse(r)).catch(() => sendResponse({ ok: false, message: 'Could not record it.' }));
    return true;
  }

  if (msg?.type === 'GATE_REVIEW_STATE') {
    // Recorded against the application's audit row: for a gated application this is the ONLY record
    // of what a human saw before it went out, because the submission happens in a browser we never
    // observe. Best-effort — a failure here must never block the candidate from submitting.
    void recordGateReview(sender.tab?.id, msg);
    // ⛔ 43k: IN ARRIVAL ORDER, per tab. Each report waits on loadPacketForTab before it patches the progress record, and
    // that wait varies (the first is a fetch, the rest hit the cache) — so the panel's FIRST report (its "waiting" draw:
    // 0 filled · 3 need you) could land after the last ("3 of 3") and the popup said "Filled 0 of 3" after the person
    // had filled everything (J9, under load). Chained, the last report is always the one that stays.
    const tabKey = sender.tab?.id ?? 'none';
    const prior = reviewWrites.get(tabKey) || Promise.resolve();
    const next = prior.then(() => loadPacketForTab(sender.tab?.id)).then(h => noteReviewed(msg, { jobId: h?.packet?.jobId ?? null })).catch(() => {});
    reviewWrites.set(tabKey, next);
    void next.finally(() => { if (reviewWrites.get(tabKey) === next) reviewWrites.delete(tabKey); });
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

async function recordGateReview(tabId, msg) {
  if (!tabId) return;
  const stored = await chrome.storage.session.get(`gate:${tabId}`);
  const entry = stored?.[`gate:${tabId}`];
  const runJobId = entry?.packet?.runJobId;
  if (!runJobId) return;
  try {
    await authedFetch(RESUME_MASTER_URL, '/api/apply/gate-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runJobId,
        packetId: entry.packetId ?? null,
        ready: !!msg.ready,
        acknowledged: msg.acknowledged || [],
        edits: msg.edits || [],
      }),
    });
  } catch { /* the candidate's submission does not depend on our bookkeeping */ }
}

async function advanceBatch(tabId) {
  const batch = await loadBatchForTab(tabId);
  if (!batch?.origin) return { ok: false, reason: 'no_batch' };

  // Re-read the queue rather than trusting the count the overlay was rendered with: the candidate may
  // have finished one of these in another tab since.
  // Scoped to the batch's origin. Unscoped, this list is the newest 100 unconsumed packets across
  // EVERY portal — so a candidate with a long queue could have this batch's packets fall outside
  // the cap entirely, and the filter below would find nothing. That reads as `batch_empty` and
  // stops a run that has work left, which is the worst way for a cap to fail: silently, and as a
  // completion.
  const res = await authedFetch(
    RESUME_MASTER_URL,
    `/api/apply/gate-packets?origin=${encodeURIComponent(batch.origin)}`)
    .catch(() => null);
  if (!res?.ok) return { ok: false, reason: 'unreachable' };
  const body = await res.json();
  const next = (body.packets || [])
    // D56: the packet's origin LIST — a two-origin ATS batches across both of its addresses.
    .filter(p => packetFillsOrigin(p, batch.origin))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!next) { await clearBatchForTab(tabId); return { ok: false, reason: 'batch_empty' }; }

  // The packet released into THIS tab is finished with; the next application must be matched and
  // approved on its own terms rather than inheriting the last one's.
  await clearPacketForTab(tabId);

  // Two applications can share an apply URL — a portal that serves them all from one route, or a
  // reopened handoff for the job already open. tabs.update to the URL already showing does nothing
  // and fires no onUpdated, so waiting for one would hang the batch here forever. Run it directly.
  const current = await chrome.tabs.get(tabId).catch(() => null);
  if (current?.url === next.applyUrl) {
    const result = await runGatedHandoff({ serverUrl: RESUME_MASTER_URL, tab: current });
    await reportHandoff(current, result);
    return { ok: true, packetId: next.packetId, applyUrl: next.applyUrl, navigated: false };
  }

  // J11: arm the one load this advance causes — onUpdated below fills that load and no other (not a reload).
  await armBatchAdvance(tabId, next.applyUrl);
  await chrome.tabs.update(tabId, { url: next.applyUrl });
  return { ok: true, packetId: next.packetId, applyUrl: next.applyUrl, navigated: true };
}

// The candidate is already authenticated and the grant is still live, so the next application in a
// batch fills without another keypress. Strictly scoped: only a tab with an ACTIVE BATCH, only when
// it lands on the same origin that batch belongs to. Any other navigation is none of our business.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return;
  const batch = await loadBatchForTab(tabId);
  if (!batch?.origin) return;

  // An unreadable URL is not a missing detail, it is the answer: without the tabs permission, a tab's
  // url is visible only while we hold access to it. Losing sight of it means the activeTab grant is
  // gone, which means the tab left the origin — so the batch is over. Treating this as "skip and try
  // again later" is what left a batch pinned to a tab the candidate had navigated away from.
  if (!tab?.url) { await clearBatchForTab(tabId); return; }

  let origin;
  try { origin = new URL(tab.url).origin; } catch { await clearBatchForTab(tabId); return; }
  if (origin !== batch.origin) {
    // Left the portal. The grant is gone (G0 §9) and so is the batch; the remaining jobs stay held
    // rather than being treated as failed — they were never touched.
    await clearBatchForTab(tabId);
    return;
  }
  // ⭐ J11: only the load the candidate's own "Next application" caused. A reload of a batched tab, or a same-URL
  // re-navigation, is not an advance — it used to re-run a fill nobody asked for. (A same-URL advance never reaches
  // here: advanceBatch runs that fill directly, since tabs.update to the URL already showing fires no load.)
  if (!(await takeBatchAdvance(tabId))) return;
  const result = await runGatedHandoff({ serverUrl: RESUME_MASTER_URL, tab });
  await reportHandoff(tab, result);
});

// The packet outlives its activeTab grant (G0 §9 measured this), so nothing expires it on its own.
// A closed tab is the one unambiguous signal that its handoff is over.
chrome.tabs.onRemoved.addListener((tabId) => {
  void clearPacketForTab(tabId);
  void clearBatchForTab(tabId);
  void clearBinding(tabId);
});

// And a sweep for the rest: a handoff the candidate walked away from leaves a packet holding a home
// address in session storage until the browser restarts. onStartup/onInstalled plus every invocation
// is enough to keep that bounded without a polling alarm.
chrome.runtime.onStartup?.addListener(() => { void sweepExpiredPackets(); });
chrome.runtime.onInstalled?.addListener(() => { void sweepExpiredPackets(); });

// ── D55 · the right-click menu (decision B) and "Report this form" (decision E) ──────────────
// Everything that is not a chrome.* call lives in formReport.js. Both menu items act only on the
// click itself — a user gesture, which is also what grants activeTab for the clicked tab.
chrome.runtime.onInstalled?.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const item of CONTEXT_MENUS) chrome.contextMenus.create({ ...item });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // "Save this page" IS the capture — the same captureActiveTab() the button and Ctrl+Shift+K run.
  if (info.menuItemId === MENU_SAVE_PAGE) { void captureActiveTab(tab); return; }
  if (info.menuItemId === MENU_SAVE_LINK) { void saveLinkToDraft(info.linkUrl, tab); return; }
  // ⭐ T22: the popup's fill and score tiles are gone; what they did stays one right-click away. "Fill this application"
  // IS the fill — the same chain the popup's Fill it and Ctrl+Shift+Y run, on the tab the menu was opened on. "Show
  // draft's ATS report" opens the dock on its ATS tab (a view from draft's server; nothing of the page is read for it).
  if (info.menuItemId === MENU_FILL_PAGE) { void handleGatedHandoff(tab); return; }
  if (info.menuItemId === MENU_ATS_PAGE) void openDock(tab, 'ats');
});

/** "Save link to draft": the link's address only — no page is opened or read. The server decides. */
async function saveLinkToDraft(linkUrl, tab) {
  const url = saveableLink(linkUrl);
  let result;
  if (!url) {
    result = { success: false, outcome: null, onBoard: false, message: 'That is not a web link draft can save.', link: null, jobId: null };
  } else {
    try {
      const res = await authedFetch(RESUME_MASTER_URL, '/api/import/link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      });
      result = res
        ? captureResultFrom(res.status, await res.json().catch(() => ({})), RESUME_MASTER_URL)
        : captureResultFrom(401, {}, RESUME_MASTER_URL);
    } catch {
      result = { success: false, outcome: null, onBoard: false, message: 'Could not reach draft', link: null, jobId: null };
    }
  }
  // The same toast and the same lastCapture record a capture leaves — no new storage key.
  if (tab?.id) await reportCapture(tab.id, result);
  return result;
}

// "Report this form", from the popup. Two steps, both the user's: PREVIEW reads the labels (the popup
// shows the host and how many labels before anything is sent); SEND reads them again and posts
// host + labels. The page is re-read rather than the preview trusted, so nothing the popup holds
// can widen what is sent — buildFormReport() emits only host, labels, fieldCount and the version.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'REPORT_FORM') return false;
  (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const host = reportHostOf(tab?.url);
    if (!tab?.id || !host) return { ok: false, message: 'Open the application form you want to report.' };
    let collected;
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectFormLabels });
      collected = r?.result;
    } catch {
      return { ok: false, message: "draft can't read this form's questions — nothing was sent." };
    }
    const report = buildFormReport({ host, collected, version: chrome.runtime.getManifest?.().version });
    if (!report.labels.length) return { ok: false, message: 'No form fields were found on this page.' };
    if (msg.phase !== 'send') return { ok: true, preview: true, host: report.host, labelCount: report.labels.length };
    const res = await authedFetch(RESUME_MASTER_URL, '/api/form-reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report),
    }).catch(() => null);
    if (!res) return { ok: false, message: 'Sign in to draft first.' };
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body.message || 'Could not send the report.' };
    return { ok: true, sent: true, host: report.host, labelCount: report.labels.length };
  })().then(sendResponse, () => sendResponse({ ok: false, message: 'Could not send the report.' }));
  return true;
});

// ── D96 §4–§5 (J4): the review panel's answer memory ──────────────────────────
// Acknowledge, change and dock, from extension/answerMemory.js. Each handler resolves the job from the tab's
// released packet or its binding, never from the message.
configureAnswerMemory({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = ANSWER_MEMORY_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});

// ── D97 (J5): automatic reading — opt-in per site, all off ────────────────────────────────────────
// Replaces D64's tabs.onUpdated capture: autoRead.js owns the site table, the four switches (Read · Prepare ·
// Capture · Fill), the kill switch and the registered watcher. The watcher only signals a step change; every
// decision is re-made here against the switch and Chrome's grant. ⛔ A page that is not a posting sends nothing.
configureAutoRead({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = AUTO_READ_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});
chrome.runtime.onInstalled?.addListener(() => { void reconcileAutoRead(); });   // every reason, update included
chrome.runtime.onStartup?.addListener(() => { void reconcileAutoRead(); });
chrome.permissions?.onAdded?.addListener(() => { void syncRegistrations(); });
chrome.permissions?.onRemoved?.addListener((removed) => { void onPermissionsRemoved(removed); });
chrome.tabs.onRemoved.addListener((tabId) => { forgetTab(tabId); });

// ── D98 §4–§5 (J6): the résumé on the page ─────────────────────────────────────────────────────────
// The handlers are resumePanel.js's: the popup and the review panel may only OPEN the panel; a generation starts
// only from the panel's own trusted click on a web-page tab. Every request goes to RESUME_MASTER_URL, draft's own
// server — the extension never calls a model or the résumé service itself. The generation's id is kept in the
// job's progress record (no new key).
configureResumePanel({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = RESUME_PANEL_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});

// ── ⭐ T14: TAB_STATE — the popup asks, on open, what the active tab is (tabState.js; the extension's own records) ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = TAB_STATE_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});

// ── D99 J11: the board hands a job to the extension ───────────────────────────────────────────────────────────────
// boardOpen.js's handlers: OPEN_JOB only from boardBridge.js on draft's own origin (the server confirms the job and
// names the address the new tab opens); BOARD_TAB only from the popup, which reads the extension's own binding.
configureBoardOpen({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = BOARD_OPEN_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});

// ── ⭐ T17: the dock ──────────────────────────────────────────────────────────────────────────────────────────────────
// dockHost.js: DOCK_PLACE — where the dock sits, remembered per site (only from a page's TOP frame). gated-handoff.js:
// what the dock's views ask about the FORM — read in the frame the form is in, by tabId + frameId (T11).
configureDock({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = DOCK_HANDLERS[msg?.type] || FORM_FRAME_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});
