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
// ⭐ T24: the intent model — the Draft button drafts (the board's Draft) and queues the résumé; the dock says the path.
import { handlers as INTENT_HANDLERS, configureIntent, showPath, runDraft } from './intent.js';
import { toolbarPress, renderRelay, fillRelay, dockStateInPage, collapseDockInPage, noticeDue } from './toolbarPress.js';
import { extractJobPayload, showCaptureToast } from './extractor.js';
import { lookupBoardJob, companyFacts } from './boardJob.js';
import { isExtensionSubmitPacket, sendWithPress } from './extensionSubmit.js';   // ⭐ A207 (a)
import { runnablePage } from './runnerModel.js';   // ⭐ A211 (1a)
// ⭐ BINDING FIRST (owner 10-15): every press on a page draft has not seen identifies the page and binds the tab first.
import { identifyAndBind, identityView, STOPS as IDENTITY_STOPS } from './identify.js';
// ⭐ One job per tab across every stage of its application, and the Copy sheet as an in-page panel (owner, 10-12).
import { bindTab, bindingForTab, clearBinding, bindingLine, loadBinding, BIND_PREFIX } from './tabBinding.js';
import { renderCopySheetPanel } from './copy-sheet-panel.js';
import { authedFetch, getIdentity, cachedIdentity, disconnect } from './auth.js';
import { captureResultFrom } from './captureResult.js';
import {
  CONTEXT_MENUS, MENU_SAVE_PAGE, MENU_SAVE_LINK, MENU_FILL_PAGE, MENU_ATS_PAGE, MENU_ASK, saveableLink, reportHostOf, buildFormReport, collectFormLabels,
} from './formReport.js';
// D23: the site's colour tokens, generated from client/src/styles/colorTokens.js — the toolbar badge
// and the capture toast take their colours from here, never from a literal.
import { C_LIGHT, C_DARK } from './tokens.js';
// D97 (J5): automatic reading, per site, all off — the four switches, the watcher's registrations, the consent.
import {
  handlers as AUTO_READ_HANDLERS, configureAutoRead, reconcileAutoRead, onPermissionsRemoved, onPermissionsAdded, forgetTab, noteFrameSite,
  AUTO_READ_KEY, normaliseSettings, SITES as AUTO_SITES, customOriginFor, originPattern, popupAutoView, siteFor as autoSiteFor, takeAutoCapture,
  GLOBAL_ORIGINS, loadSettings as loadAutoSettings, updateSettings as updateAutoSettings, hasPostingUrlShape, isApplyStageUrl,
} from './autoRead.js';
// ⭐ D191 sketch 2 (owner 11-18) · THE ONE PANEL — the dock's home tab: the words (pure) and the view (injected)
import { panelModel } from './jobPanelModel.js';
import { renderJobPanel } from './jobPanel.js';
// ⭐ D191 B3: Ask draft inside the panel — the site's engine, run here (the side panel's ask.js retired)
import { createPanelAsk } from './panelAsk.js';
// ⭐ D112 b2: the ONE global-read ask — a small window over the posting that closes itself on either answer.
import { openGlobalAsk, handlers as GLOBAL_ASK_HANDLERS, onWindowRemoved as onAskWindowRemoved } from './globalRead.js';
// ⭐⭐ D112 item 7: "Let draft apply here while you're away" — a portal's sign-in sealed to the apply worker's key.
import {
  configureApplyAway, awayFactsFor, awayRelay, startAway, disconnectAway, portalSignedInInPage,
  handlers as APPLY_AWAY_HANDLERS, onAwayWindowRemoved,
} from './applyAway.js';

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
  // ⭐ T31 (10-25): the last capture is no longer stored — the toolbar popup that showed it is gone, and its result is said
  // on the page as it happens (the capture toast). Nothing kept that nothing reads.
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
    // ⭐ D191 (2b) · `mine` is the page answer's (the import context sends none) — the side panel offers Draft / Save only
    // for a job not yet the person's own (46p: the real-extension walk found it always false)
    if (p?.known && board.posting.known && String(p.jobId) === String(board.posting.jobId)) board.posting = { ...board.posting, mine: p.mine === true };
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
    // ⭐ D191 (2d): the employer's card from the same answer (draft's own records, no model)
    company: (await rememberCompanyHref(tab, page?.company || null)),
    report: page?.ok && page.ats ? { ...page.ats, basis: page.basis }
      : boardReport?.ok && boardReport.ats ? { ...boardReport.ats, basis: 'board' } : null,
    // ⭐ D191 (2a) / (2c) / (2d): what draft knows about this posting, for the side panel (draft's own data, no model)
    facts: page?.facts || null,
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
  // ⭐ D191 sketch 2: the press opens the dock on its home — the panel (drawPanel draws it; no tab is read here)
  if (which === 'draft') {
    try { const o = await drawInDock(tab.id, openDockInPage, [await dockMeta(tab), 'draft']); return o?.ok ? { ok: true, tab: 'draft' } : cant; } catch { return cant; }
  }
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
  // ⭐ T24: the dock the user's press opened says the path on this tab — or asks the one question, once. Nothing is queued.
  void showPath(tab).catch(() => null);
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

/** ⭐ T26 / T29 · the settings page's sections a dock control may open it at (options.html's own ids). */
const SETTINGS_SECTIONS = Object.freeze(['permissions', 'account', 'auto-read', 'intent', 'answers', 'details', 'shortcuts']);

// ⭐ D173 R1 (46z, docs/D173_EXTENSION_HARDENING.md) · THE POPUP-ERA HANDLERS ANSWER ONLY THE EXTENSION'S OWN PAGES. The toolbar
// popup that sent them was retired in T31; they act on the ACTIVE tab and checked nothing, so any of the extension's own
// content scripts (some run on every https page) could send SUBMITTED_ACTIVE_TAB and record a submission for whatever tab
// was in front. The toolbar press, the context menu and the hotkeys call the same functions directly, not through these
// messages, so nothing a person does is lost. A content script's sender.url is the web page's, never this origin.
const POPUP_ERA = Object.freeze(new Set(['CAPTURE_ACTIVE_TAB', 'PREVIEW_ACTIVE_TAB', 'POPUP_CONTEXT', 'FILL_ACTIVE_TAB',
  'PREPARE_ACTIVE_TAB', 'SUBMITTED_ACTIVE_TAB', 'COPY_SHEET_PANEL', 'DOCK_OPEN', 'REPORT_FORM']));
const fromOwnPage = (sender) => typeof sender?.url === 'string' && sender.url.startsWith(chrome.runtime.getURL(''))
  && (sender.id == null || sender.id === chrome.runtime.id);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (POPUP_ERA.has(message?.type) && !fromOwnPage(sender)) { sendResponse({ ok: false, reason: 'not_allowed' }); return false; }   // D173 R1
  // Capture, from the popup button. The hotkey reaches the same function through onCommand below;
  // neither trigger has an implementation of its own.
  if (message.type === 'CAPTURE_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(([tab]) => captureActiveTab(tab))
      .then(sendResponse);
    return true;                                            // async response
  }

  // (D64's "Captured today" list and its undo were the retired popup's — ⭐ T31: an automatic capture's Undo is said on
  // its own page, when it happens: autoRead.js autoCapture → DOCK_ACT undo-capture)

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
      // ⭐ T31: the reason travels — a reason the fill's own popup says (fillRelay) is not said twice by the dock
      .then(r => sendResponse({ ok: !!r?.ok, message: r?.message || null, reason: r?.reason || null }))
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
  // ⭐ T26 / T29 · the dock's gear (and, later, a popup's Settings link): the extension's settings page, at one section.
  // ⛔ The person's own click, from a page's TOP frame — where the dock is; `section` is one of the page's own anchors or
  // nothing (it is never a URL).
  if (message.type === 'OPEN_SETTINGS') {
    if (message.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false }); return true; }
    const section = SETTINGS_SECTIONS.includes(message.section) ? `#${message.section}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`options.html${section}`) })
      .then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
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

  // (⭐ T31: the retired popup's own Copy sheet list — COPY_SHEET — and its today ring — TODAY_RING — went with it: the
  // Copy sheet is the dock's tab, COPY_SHEET_PANEL; the day's cap is said by draft when a Draft would pass it)

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
chrome.commands.onCommand.addListener((command, cmdTab) => {
  if (command === 'fill-gated-application') { void handleGatedHandoff(); return; }
  // ⭐ D191 B3: "Open draft's panel" opens THE panel on this page — your day and Ask draft (the side panel is retired)
  if (command === 'open-ask-draft') { if (cmdTab?.id) { void openPanelHere(cmdTab); return; } chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => { void openPanelHere(tab); }); return; }
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
  // ⭐ T24: a fill press is the manual path's control (or fills a drafted application) — the dock's line says which.
  // ⛔ It never drafts and never generates: the line is redrawn with the tells already held, nothing is queued.
  if (bound) void showPath(tab, { control: 'fill' }).catch(() => null);
  return result;
}

async function reportHandoff(tab, result) {
  // ⭐ T31: what this fill needs said that only a popup can carry (a frame to allow; a form to report) — on the page
  const relay = fillRelay(result);
  if (relay.length && tab?.id) void overlayTheme().then(theme => drawInDock(tab.id, renderRelay, [relay, theme])).catch(() => null);
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
    // ⭐ D173 R2 (46z): the review panel's own click, from the page's TOP frame — as DOCK_SUBMITTED and GATE_SEND require.
    if (msg.trigger !== 'click' || sender?.frameId !== 0) { sendResponse({ ok: false, reason: 'not_allowed' }); return true; }
    advanceBatch(tabId).then(r => sendResponse(r)).catch(e => sendResponse({ ok: false, reason: e.message }));
    return true;
  }

  // D56: "I submitted it" in the review overlay — the overlay's own tab is the page recorded.
  // ⭐ O100 (a) (owner 11-06): "I submitted it" from the DOCK's header on a tab bound to a job — after the person's own Yes
  // (dock.js askSubmitted). It lasts past the form's page: the page now in the tab (the employer's confirmation) is the
  // evidence, the tab's binding names the job. ⛔ The click's own message from the page's TOP frame only.
  if (msg?.type === 'DOCK_SUBMITTED') {
    if (msg.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false, message: 'Record it from the dock on the application page.' }); return true; }
    recordSubmitted({ serverUrl: RESUME_MASTER_URL, tab: sender.tab })
      .then(r => sendResponse(r)).catch(() => sendResponse({ ok: false, message: 'Could not record it.' }));
    return true;
  }
  // ⭐ A207 (a) · Submit application: the person's ONE press sends it from their own browser — on an extension-submit packet
  // only (its ATS flags draft's server), from the dock's TOP frame, as the panel's own trusted press. ⛔ Nothing else sends.
  if (msg?.type === 'GATE_SEND') {
    const tabId = sender?.tab?.id;
    if (msg.trigger !== 'press' || msg.trusted !== true || sender?.frameId !== 0 || !tabId) {
      sendResponse({ ok: false, outcome: 'refused', message: 'Press Submit application in the panel.' }); return true;
    }
    loadPacketForTab(tabId).then(async (held) => {
      if (!isExtensionSubmitPacket(held?.packet)) return { ok: false, outcome: 'refused', message: 'This one is sent with the Submit button on the form itself.' };
      return sendWithPress({
        tabId, frameId: formFrameOf(tabId),
        executeScript: async ({ tabId: t, frameId: f, func, args }) => {
          const [r] = await chrome.scripting.executeScript({ target: f ? { tabId: t, frameIds: [f] } : { tabId: t }, func, args });
          return r?.result ?? null;
        },
        recordSubmitted: async () => recordSubmitted({ serverUrl: RESUME_MASTER_URL, tab: await chrome.tabs.get(tabId) }),
      });
    }).then(r => sendResponse(r)).catch(() => sendResponse({ ok: false, outcome: 'unknown', message: 'Could not send it — press Submit on the page.' }));
    return true;
  }
  if (msg?.type === 'GATE_SUBMITTED') {
    if (!sender.tab?.id) { sendResponse({ ok: false, message: 'No tab.' }); return true; }
    // ⭐ D173 R2 (46z): recorded only on the person's own Yes in the review panel, from the page's TOP frame.
    if (msg.trigger !== 'click' || sender?.frameId !== 0) { sendResponse({ ok: false, message: 'Record it from the review panel.' }); return true; }
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
// ⭐ D191 (46o) · THE STORE'S DISCLOSURE RULE (User Data Policy: prominently disclose what is collected and how it is used,
// in the product, and disclose a change of practice after install): on install, and on an update from a version before
// 1.7.0 (the runner and the signed-out employer card are new practice), the notice page opens once — what draft reads,
// when, and where it goes. onInstalled fires once per install / update, so nothing is stored to remember it.
chrome.runtime.onInstalled?.addListener((details) => { if (noticeDue(details)) void chrome.tabs.create({ url: chrome.runtime.getURL('notice.html') }).catch?.(() => {}); });

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
  if (info.menuItemId === MENU_ASK) void openPanelHere(tab);   // ⭐ D191 B3: the panel, not the side panel
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
  // The same toast a capture leaves — no storage key.
  if (tab?.id) await reportCapture(tab.id, result);
  return result;
}

// "Report this form", from the popup. Two steps, both the user's: PREVIEW reads the labels (the popup
// shows the host and how many labels before anything is sent); SEND reads them again and posts
// host + labels. The page is re-read rather than the preview trusted, so nothing the popup holds
// can widen what is sent — buildFormReport() emits only host, labels, fieldCount and the version.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'REPORT_FORM') return false;
  if (!fromOwnPage(sender)) { sendResponse({ ok: false, message: 'Report the form from the extension.' }); return false; }   // D173 R1
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => reportForm(tab, msg.phase))
    .then(sendResponse, () => sendResponse({ ok: false, message: 'Could not send the report.' }));
  return true;
});
/** ⭐ T31: the report's two steps on a tab — `preview` (what WOULD be sent) and `send` — for any press that asks. */
async function reportForm(tab, phase) {
  {
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
    if (phase !== 'send') return { ok: true, preview: true, host: report.host, labelCount: report.labels.length };
    const res = await authedFetch(RESUME_MASTER_URL, '/api/form-reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report),
    }).catch(() => null);
    if (!res) return { ok: false, message: 'Sign in to draft first.' };
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: body.message || 'Could not send the report.' };
    return { ok: true, sent: true, host: report.host, labelCount: report.labels.length };
  }
}

// ── ⭐ T31 (owner, 10-25) · THE TOOLBAR ICON — the dock's toggle, and what this page needs said (extension/toolbarPress.js)
/** The press on a tab: the browser work toolbarPress needs, handed in. */
function pressToolbar(tab) {
  const inTop = (func, args = []) => chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func, args }).then(([r]) => r?.result ?? null);
  return toolbarPress(tab, {
    state: () => inTop(dockStateInPage),
    collapse: () => inTop(collapseDockInPage),
    openDock: () => openDock(tab, 'draft'),
    identity: () => getIdentity(RESUME_MASTER_URL),
    // ⭐ D191: the press's read is remembered for this tab (memory only) — the Ask window's "this job" / "this company"
    context: async () => { const c = await popupContext(tab); rememberPressContext(tab, c); return c; },
    auto: () => autoFactsFor(tab),
    relay: async (_t, specs) => drawInDock(tab.id, renderRelay, [specs, await overlayTheme()]),
    // ⭐ D191 sketch 2: the panel — drawn from the page first (pending), then from the press's read
    panel: (_t, o) => drawPanel(tab, o),
    openBoard: () => chrome.tabs.create({ url: `${RESUME_MASTER_URL}/app` }),
    // ⭐ D112 b2: the press is the ONE ask's moment while it is due (never answered) — the window over the posting
    ask: (t) => openGlobalAsk(t),
    // ⭐⭐ D112 item 7: the "apply here while you're away" line — on a connectable portal's page only
    away: async () => awayRelay(await awayFactsFor(tab)),
    // ⭐ D191 P1 / P4
    home: async () => { const h = await extensionHomeFacts({ force: true }); return h; },
    publicCard: (t) => publicCompanyCard(t),
  });
}

// ── ⭐ D191 P1 · THE BADGE: today's undecided matches (GET /api/extension/home — cheap per-user reads on the server). Asked
// when a page finishes loading and on a press, AT MOST every few minutes — never a timer, never a board pass.
const HOME_EVERY_MS = 5 * 60 * 1000;
let homeAt = 0, homeLast = null;
async function extensionHomeFacts({ force = false } = {}) {
  if (!force && Date.now() - homeAt < HOME_EVERY_MS) return homeLast;
  homeAt = Date.now();
  const r = await authedFetch(RESUME_MASTER_URL, `/api/extension/home?date=${new Date().toLocaleDateString('en-CA')}`).catch(() => null);
  homeLast = r && r.ok ? await r.json().catch(() => null) : null;
  try {
    await chrome.action.setBadgeText({ text: homeLast?.badge || '' });
    if (homeLast?.badge) await chrome.action.setBadgeBackgroundColor({ color: C_LIGHT.ACCENT });
    await chrome.action.setTitle({ title: homeLast?.badge ? `draft — ${homeLast.badge} new match${homeLast.badge === '1' ? '' : 'es'} today` : 'draft' });
  } catch { /* no action surface (tests) */ }
  return homeLast;
}
chrome.tabs?.onUpdated?.addListener?.((_id, info) => { if (info?.status === 'complete') void extensionHomeFacts().catch(() => null); });

// ── ⭐ D191 P4 · signed out: the posting's employer from draft's PUBLIC data (GET /api/extension/company — no account).
// The press is the trigger (D23): the page's own extractor names the company, under the press's grant.
async function publicCompanyCard(tab) {
  let company = null;
  try { const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPayload }); company = r?.result?.company || null; } catch { company = null; }
  if (!company) return null;
  const q = new URLSearchParams({ name: String(company).slice(0, 120), url: String(tab.url || '').slice(0, 2048) });
  const r = await fetch(`${RESUME_MASTER_URL}/api/extension/company?${q}`, { credentials: 'omit' }).catch(() => null);
  const body = r && r.ok ? await r.json().catch(() => null) : null;
  return body?.company ? rememberCompanyHref(tab, companyFacts(body.company)) : null;
}
// ── ⭐ D191 (2e) / (3) → B3 · what the press read on each tab — the panel's job, its company, and Ask draft's context ──
const pressContextByTab = new Map();
function rememberPressContext(tab, c) {
  if (!tab?.id || !c) return;
  // ⭐ D191 B3: a page draft's identify calls no job (a news page, an unread page) has no job, whatever posting record the
  // import context sends for its address (it sends one, known: false, for EVERY address) — the panel then shows the day
  const notAJob = ['not_a_job', 'unread'].includes(c.identity?.outcome) && !c.posting?.known;
  const p = notAJob ? null : c.posting || null, report = c.report || null;
  // ⭐ D191 (owner 11-19: "an ats score in line with the latest ats engine") · the panel's % is the CONTEXTUAL score (ATS contract
  // 2.0.0, D192 (4): skill match + role fit + responsibilities + their stack) when draft sent it; the skill match otherwise.
  const skill = Number.isFinite(report?.score) ? report.score : Number.isFinite(p?.scores?.shown) ? p.scores.shown : null;
  const contextual = Number.isFinite(report?.contextual?.score) ? report.contextual.score : null;
  const score = contextual ?? skill;
  // ⭐ 46x: the band of the number shown — the contextual one's when that is the number (the colour says it, no word)
  const band = contextual != null && typeof report?.contextualBand === "string" ? report.contextualBand : typeof report?.band === "string" ? report.band : null;
  const f = c.facts || null;
  pressContextByTab.set(tab.id, { job: p ? { jobId: p.known ? p.jobId ?? null : null, title: p.title ?? null, company: p.company ?? null, known: !!p.known, score, skill, band, contextual: contextual != null,
      mine: !!p.mine, onBoard: !!p.onBoard, ...(f?.job ? { facts: f.job } : {}), ...(f?.application ? { application: f.application } : {}) } : null,
    prepared: !!c.prepared,
    company: c.company ? { name: c.company.name, sponsorship: c.company.sponsorship, openJobs: c.company.openJobs, href: c.company.href || null,
      ...(f?.company ? { logo: f.company.logo, about: f.company.about, trend: f.company.trend } : {}) } : null });
}
// ── ⭐ D191 sketch 2 (owner 11-18: "alright go") · THE ONE PANEL ─────────────────────────────────────────────────
// The dock's home tab (`draft`): the status line, the job, ONE button, "How I apply" (extension/jobPanel.js draws it,
// extension/jobPanelModel.js words it). Its first frame comes from the PAGE ITSELF (the extractor, in the page — nothing
// sent), so it shows before draft answers; the press's read redraws it. The page read is kept per tab in memory only.
const pageReadByTab = new Map();
async function pageFirstRead(tab) {
  const key = `${tab?.id}|${tab?.url || ''}`;
  if (pageReadByTab.has(key)) return pageReadByTab.get(key);
  let page = null;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: extractJobPayload });
    const v = r?.result || null;
    page = v && (v.title || v.company) ? { title: String(v.title || '').slice(0, 200), company: String(v.company || '').slice(0, 120),
      location: String(v.location || '').slice(0, 120) } : null;
  } catch { page = null; }
  for (const k of pageReadByTab.keys()) if (k.startsWith(`${tab?.id}|`)) pageReadByTab.delete(k);
  pageReadByTab.set(key, page);
  return page;
}
chrome.tabs?.onRemoved?.addListener?.((tabId) => { for (const k of pageReadByTab.keys()) if (k.startsWith(`${tabId}|`)) pageReadByTab.delete(k); });
/** Draw (or redraw) the panel on `tab`. o: { signedIn, pending, card, expand } — the press's read is pressContextByTab's. */
async function drawPanel(tab, o = {}) {
  if (!tab?.id) return { ok: false };
  const [page, settings, theme, meta] = await Promise.all([pageFirstRead(tab), loadAutoSettings().catch(() => null), overlayTheme(), dockMeta(tab)]);
  const ctx = o.signedIn ? (o.pending ? null : pressContextByTab.get(tab.id) || null) : (o.card ? { company: o.card } : null);
  // ⭐ B3: the day for the other-page view (GET /api/extension/home, asked at most every five minutes — never a timer)
  // a page the press read as no posting at all (draft's answer has no job) is "any other page" too, whatever its heading
  const other = !!o.other || (!!o.signedIn && !o.pending && !!ctx && !ctx.job);
  const home = o.signedIn && !o.pending && (other || !page) ? await extensionHomeFacts().catch(() => null) : null;
  const profile = o.signedIn && !o.pending ? (await panelProfiles().catch(() => null))?.find(p => p.active) || null : null;
  const applyMode = o.signedIn ? await panelApplyMode().catch(() => null) : null;
  const model = { ...panelModel({ signedIn: !!o.signedIn, page, ctx, pending: !!o.pending, settings: settings?.panel || {}, home, other, profile, applyMode }), expand: o.expand !== false };
  const r = await drawInDock(tab.id, renderJobPanel, [model, theme, meta]).catch(() => null);
  return { ok: !!r?.rendered, kind: r?.kind || null };
}
// ⭐ D191 sketch 2 · PANEL_ARRIVE — the panel opens BY ITSELF on a posting on the six board families (panelArrive.js, the
// manifest's content script; the hosts are granted at install — the owner's pick, 11-18). ⛔ Only: the top frame of a
// web page on a preset board · "Open by itself" on and the kill switch off · a posting (its address's shape; on Workday,
// whose addresses say nothing, the page's own JobPosting) · never an application step (…/apply). Once per page load
// (panelArrive.js). The first frame is the page's own words; draft's answer redraws it. Closed on this site before → the
// /d square.
// the board by its host name (the manifest's content script runs on https only; the test build maps an http tenant)
const boardOf = (url) => { try { const h = new URL(url).hostname; return AUTO_SITES.find(s => s.hosts.some(re => re.test(h))) || null; } catch { return null; } };
async function panelArrive(tab) {
  const url = String(tab?.url || '');
  if (!tab?.id || !/^https?:/.test(url) || !boardOf(url) || /\/apply(?:\/|$)/i.test(new URL(url).pathname)) return { ok: false, why: 'not-here' };
  const settings = await loadAutoSettings().catch(() => null);
  if (!settings || settings.kill || settings.panel?.autoOpen === false) return { ok: false, why: 'off' };
  const page = await pageFirstRead(tab);
  const posting = hasPostingUrlShape(url) || (boardOf(url)?.id === 'workday' && !!(page?.title && page?.company));
  if (!posting) return { ok: false, why: 'not-a-posting' };
  const known = await cachedIdentity().catch(() => null);
  const meta = await dockMeta(tab).catch(() => null);
  const expand = !meta?.place?.collapsed;                        // the person closed it on this site → the /d square
  const first = await drawPanel(tab, { signedIn: !!known?.authenticated, pending: !!known?.authenticated, expand });
  if (known?.authenticated) {
    rememberPressContext(tab, await popupContext(tab).catch(() => null));
    await drawPanel(tab, { signedIn: true, expand });
  } else {
    await drawPanel(tab, { signedIn: false, card: await publicCompanyCard(tab).catch(() => null), expand });
  }
  return { ok: !!first?.ok, kind: first?.kind || null };
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'PANEL_ARRIVE') return false;
  if (sender?.frameId !== 0 || !sender?.tab?.id || sender.id !== chrome.runtime.id) { sendResponse({ ok: false }); return true; }
  panelArrive(sender.tab).then(r => sendResponse(r), () => sendResponse({ ok: false }));
  return true;
});
// ⭐ D191 B4 · Résumé ▾ — the account's job profiles (GET /api/domain-profiles: ≤ 4 per person), kept five minutes in this
// worker's memory only; a pick is the site's own switch (POST /api/domain-profiles/:id/activate). Names and ids only.
const PROFILES_EVERY_MS = 5 * 60 * 1000;
let profilesAt = 0, profilesLast = null;
// ⭐ 46x · the account's apply mode (D100) for the panel's Review switch — the run bar's read (GET /api/apply/run-bar), and its
// write (POST /api/apply/mode, refused 409 while the operator's kill switch is on). Kept a minute; a write refreshes it.
let modeLast = null, modeAt = 0;
async function panelApplyMode({ force = false } = {}) {
  if (!force && modeLast && Date.now() - modeAt < 60_000) return modeLast;
  const r = await authedFetch(RESUME_MASTER_URL, '/api/apply/run-bar').catch(() => null);
  const bar = r && r.ok ? await r.json().catch(() => null) : null;
  modeAt = Date.now();
  modeLast = bar?.mode ? { current: bar.mode.current === 'auto' ? 'auto' : 'semi', locked: !!bar.mode.auto?.locked } : null;
  return modeLast;
}
async function setApplyMode(mode) {
  const r = await authedFetch(RESUME_MASTER_URL, '/api/apply/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }).catch(() => null);
  if (!r) return { ok: false, say: 'Sign in to draft first.' };
  const body = await r.json().catch(() => null);
  if (!r.ok) return { ok: false, say: r.status === 409 ? 'Sending without review is paused by draft right now.' : 'Could not change that — try again.' };
  modeLast = body?.mode ? { current: body.mode.current === 'auto' ? 'auto' : 'semi', locked: !!body.mode.auto?.locked } : null;
  modeAt = Date.now();
  return { ok: true, review: modeLast ? modeLast.current !== 'auto' : mode !== 'auto',
    say: mode === 'auto' ? 'Apply for me is on: your Drafts send without waiting for you.' : 'Every Draft waits for your review.' };
}
async function panelProfiles({ force = false } = {}) {
  if (!force && profilesLast && Date.now() - profilesAt < PROFILES_EVERY_MS) return profilesLast;
  const r = await authedFetch(RESUME_MASTER_URL, '/api/domain-profiles').catch(() => null);
  const rows = r && r.ok ? await r.json().catch(() => null) : null;
  profilesAt = Date.now();
  profilesLast = Array.isArray(rows) ? rows.slice(0, 8).map(p => ({ id: Number(p.id), name: String(p.profile_name || '').slice(0, 60), active: !!p.is_active }))
    .filter(p => Number.isFinite(p.id) && p.name) : null;
  return profilesLast;
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'PANEL_PROFILES' && msg?.type !== 'PANEL_PROFILE_PICK') return false;
  if (msg.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false }); return true; }
  (async () => {
    if (msg.type === 'PANEL_PROFILES') {
      const profiles = await panelProfiles({ force: true });
      return profiles ? { ok: true, profiles } : { ok: false, say: 'Sign in to draft to choose a résumé.' };
    }
    const id = Number(msg.id);
    if (!(await panelProfiles())?.some(p => p.id === id)) return { ok: false, say: 'That profile is not yours.' };
    const r = await authedFetch(RESUME_MASTER_URL, `/api/domain-profiles/${id}/activate`, { method: 'POST' }).catch(() => null);
    if (!r?.ok) return { ok: false, say: 'draft could not switch the profile — try again.' };
    await panelProfiles({ force: true });
    await drawPanel(sender.tab, { signedIn: true });
    return { ok: true };
  })().then(sendResponse, () => sendResponse({ ok: false }));
  return true;
});
// ⭐ D191 B3 · the panel's other-page view on demand — the shortcut, "Ask draft…" on the right-click menu, the home line's Open
async function openPanelHere(tab) {
  if (!tab?.id || !/^https?:/.test(String(tab.url || ''))) { await chrome.tabs.create({ url: `${RESUME_MASTER_URL}/app` }); return { ok: true, say: null }; }
  const opened = await openDock(tab, 'draft').catch(() => null);
  if (!opened?.ok) { await chrome.tabs.create({ url: `${RESUME_MASTER_URL}/app` }); return { ok: true, say: null }; }
  const identity = await getIdentity(RESUME_MASTER_URL).catch(() => null);
  const r = await drawPanel(tab, { signedIn: !!identity?.authenticated, other: true });
  return { ok: !!r?.ok, say: null };
}
// ⭐ D191 B3 · PANEL_ASK — what the person typed in the panel's box, through the site's engine (panelAsk.js; no model).
// ⛔ The page's top frame, a trusted Enter or click (jobPanel.js checks isTrusted), acting on THAT tab only.
let PANEL_ASK = null;
async function panelAskEngine() {
  if (PANEL_ASK) return PANEL_ASK;
  const commands = await fetch(chrome.runtime.getURL('commands-v1.json')).then(r => r.json());
  const json = (r) => (r && r.ok ? r.json().catch(() => null) : null);
  PANEL_ASK = createPanelAsk({
    commands,
    act: async (tabId, name) => { const t = await chrome.tabs.get(tabId).catch(() => null); return t && DOCK_ACTS[name] ? DOCK_ACTS[name](t) : { ok: false, say: 'That tab is gone — open the posting again.' }; },
    open: (path) => chrome.tabs.create({ url: `${RESUME_MASTER_URL}${path}` }),
    context: (tabId) => pressContextByTab.get(tabId) || null,
    home: () => extensionHomeFacts({ force: true }),
    fetchJson: (path, init = {}, { auth = true } = {}) => (auth ? authedFetch(RESUME_MASTER_URL, path, init) : fetch(`${RESUME_MASTER_URL}${path}`, { ...init, credentials: 'omit' })).then(json),
  });
  return PANEL_ASK;
}
chrome.tabs?.onRemoved?.addListener?.((tabId) => { PANEL_ASK?.forget(tabId); });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'PANEL_ASK') return false;
  if (msg.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id || typeof msg.text !== 'string') { sendResponse(null); return true; }
  panelAskEngine().then(a => a.handle(sender.tab.id, msg.text))
    .then(m => sendResponse(m ? { text: m.text, label: m.label || null, tier: m.tier || null, intent: m.intent || null, confirm: !!m.confirm } : null),
      () => sendResponse({ text: 'draft could not answer that — try again.' }));
  return true;
});
// PANEL_REFRESH — after the panel's own Draft / Save / Fill: read this tab again and redraw. PANEL_SETTING — a "How I
// apply" switch. ⛔ Both: the person's click, in a web page's TOP frame, on THAT tab.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'PANEL_REFRESH' && msg?.type !== 'PANEL_SETTING') return false;
  if (msg.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false }); return true; }
  const tab = sender.tab;
  if (msg.type === 'PANEL_SETTING') {
    if (!['review', 'autoOpen'].includes(msg.key) || typeof msg.value !== 'boolean') { sendResponse({ ok: false }); return true; }
    // ⭐ 46x (owner 11-19: "unlock apply for me") · Review before I submit IS the account's mode (D100: users.send_mode) —
    // the site's own control, POST /api/apply/mode: OFF = Apply for me (a Draft sends without waiting, through draft's
    // server path; the operator's kill switch and Stop everything still stop it), ON = Ask me first. ⛔ The extension
    // never presses an employer's Submit on its own (D36·5): sending without review is the server's path, not a click here.
    if (msg.key === 'review') {
      setApplyMode(msg.value ? 'semi' : 'auto').then(sendResponse, () => sendResponse({ ok: false, say: 'Could not change that — try again.' }));
      return true;
    }
    updateAutoSettings((cur) => { cur.panel = { ...(cur.panel || {}), [msg.key]: msg.value }; return cur; })
      .then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false, say: 'Could not change that — try again.' }));
    return true;
  }
  (async () => {
    const identity = await getIdentity(RESUME_MASTER_URL).catch(() => null);
    if (!identity?.authenticated) return drawPanel(tab, { signedIn: false, card: await publicCompanyCard(tab).catch(() => null) });
    rememberPressContext(tab, await popupContext(tab).catch(() => null));
    return drawPanel(tab, { signedIn: true });
  })().then(r => sendResponse(r || { ok: false }), () => sendResponse({ ok: false }));
  return true;
});
// ── ⭐ A211 (1a) · THE RUNNER TAB (runner.html): the applications sent from the person's own browser — listed, filled in
// background tabs on their "Fill all", sent on ONE trusted press of "Send all". ⛔ From runner.html only; only A207
// extension-submit packets; only tabs this runner opened; "Send all" goes through the same sendWithPress as the panel's press.
const runnerTabs = new Map();   // tabId → packetId (memory only)
const fromRunner = (sender) => sender?.id === chrome.runtime.id && String(sender?.url || '').startsWith(chrome.runtime.getURL('runner.html'));
async function openRunner() {
  const url = chrome.runtime.getURL('runner.html');
  const [open] = await chrome.tabs.query({ url }).catch(() => []);
  if (open?.id) { await chrome.tabs.update(open.id, { active: true }).catch(() => null); return { ok: true, say: null }; }
  await chrome.tabs.create({ url, pinned: true }); return { ok: true, say: null };
}
function tabLoaded(tabId, ms = 45000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; chrome.tabs.onUpdated.removeListener(on); clearTimeout(t); resolve(ok); };
    const on = (id, info) => { if (id === tabId && info.status === 'complete') finish(true); };
    const t = setTimeout(() => finish(false), ms);
    chrome.tabs.onUpdated.addListener(on);
    chrome.tabs.get(tabId).then(tb => { if (tb?.status === 'complete') finish(true); }).catch(() => finish(false));
  });
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!['RUNNER_LIST', 'RUNNER_FILL', 'RUNNER_SEND', 'RUNNER_FOCUS'].includes(msg?.type)) return false;
  if (!fromRunner(sender)) { sendResponse({ ok: false, message: 'Only the runner tab can do that.' }); return true; }
  (async () => {
    if (msg.type === 'RUNNER_LIST') {
      const r = await authedFetch(RESUME_MASTER_URL, '/api/apply/gate-packets').catch(() => null);
      if (!r || r.status === 401) return { ok: false, message: 'Sign in to draft in this browser, then Refresh.' };
      const body = r.ok ? await r.json().catch(() => null) : null;
      if (!body) return { ok: false, message: 'draft could not list your applications just now — Refresh in a moment.' };
      return { ok: true, packets: (body.packets || []).filter(isExtensionSubmitPacket) };
    }
    if (msg.type === 'RUNNER_FOCUS') {
      const tabId = Number(msg.tabId);
      if (!runnerTabs.has(tabId)) return { ok: false };
      const t = await chrome.tabs.update(tabId, { active: true }).catch(() => null);
      if (t?.windowId != null) await chrome.windows.update(t.windowId, { focused: true }).catch(() => null);
      return { ok: !!t };
    }
    if (msg.type === 'RUNNER_FILL') {
      let url; try { url = new URL(String(msg.applyUrl)); } catch { return { ok: false, message: 'This application has no address to open.' }; }
      if (!runnablePage(url)) return { ok: false, message: 'Only https application pages are filled.' };
      let tabId = runnerTabs.has(Number(msg.tabId)) ? Number(msg.tabId) : null;
      if (tabId == null) { const t = await chrome.tabs.create({ url: url.href, active: false }); tabId = t.id; }
      runnerTabs.set(tabId, msg.packetId);
      if (!await tabLoaded(tabId)) return { ok: false, tabId, message: 'The application page did not finish loading — open it and use Fill.' };
      const tab = await chrome.tabs.get(tabId);
      const result = await runGatedHandoff({ serverUrl: RESUME_MASTER_URL, tab, packetId: msg.packetId }).catch(e => ({ ok: false, message: e?.message || 'Could not fill it.' }));
      return { ok: !!result?.ok, tabId, result };
    }
    if (msg.type === 'RUNNER_SEND') {
      const tabId = Number(msg.tabId);
      // ⛔ the person's press, from the runner page, on a tab this runner filled, holding an extension-submit packet
      if (msg.trusted !== true || !runnerTabs.has(tabId)) return { ok: false, outcome: 'refused', message: 'Press Send all in the runner.' };
      const held = await loadPacketForTab(tabId).catch(() => null);
      if (!isExtensionSubmitPacket(held?.packet)) return { ok: false, outcome: 'refused', message: 'This one is sent with the Submit button on the form itself.' };
      return sendWithPress({
        tabId, frameId: formFrameOf(tabId),
        executeScript: async ({ tabId: t, frameId: f, func, args }) => {
          const [r] = await chrome.scripting.executeScript({ target: f ? { tabId: t, frameIds: [f] } : { tabId: t }, func, args });
          return r?.result ?? null;
        },
        recordSubmitted: async () => recordSubmitted({ serverUrl: RESUME_MASTER_URL, tab: await chrome.tabs.get(tabId) }),
      });
    }
    return { ok: false };
  })().then(r => sendResponse(r), () => sendResponse({ ok: false, message: 'Something went wrong — try again.' }));
  return true;
});
chrome.tabs?.onRemoved?.addListener?.((tabId) => { runnerTabs.delete(tabId); });

/** The card's link, kept for THIS tab in the worker's memory only (no storage key — the privacy listing's count holds):
 *  'open-company' opens only what this tab's own read found; a worker that slept in between asks for one more press. */
const companyHrefByTab = new Map();
async function rememberCompanyHref(tab, card) {
  if (tab?.id) { if (card?.href) companyHrefByTab.set(tab.id, card.href); else companyHrefByTab.delete(tab.id); }
  return card;
}
/**
 * ⭐ T31 · what automatic reading could offer on this tab — the toolbar popup's local facts, gathered here now (the
 * settings, the tab's binding, Chrome's grants: nothing read from the page) and decided by autoRead.js popupAutoView.
 */
async function autoFactsFor(tab) {
  const raw = (await chrome.storage.local.get(AUTO_READ_KEY).catch(() => ({})))?.[AUTO_READ_KEY];
  const has = (origins) => chrome.permissions.contains({ origins }).catch(() => false);
  const sites = {};
  for (const s of AUTO_SITES) sites[s.id] = await has([...s.origins]);
  const origin = customOriginFor(tab?.url);
  const here = origin ? await has([originPattern(origin)]) : false;
  const binding = await bindingForTab(tab).catch(() => null);
  const global = await has([...GLOBAL_ORIGINS]);   // ⭐ D112
  const view = popupAutoView({ settings: normaliseSettings(raw), url: tab?.url || null, granted: { here, sites, global }, jobId: binding?.jobId ?? null, bound: !!binding });
  return { card: !!view.card, cardSite: autoSiteFor(tab?.url)?.name || null, here: view.here || null, frameAsk: view.frameAsk || null,
    globalAsk: !!view.globalAsk, global: !!view.global };
}

// THE LISTENER FIRING IS THE PERMISSION: a toolbar press is a user gesture, and it grants activeTab for the tab — the
// same grant the toolbar popup's open used to give. (It fires only while the manifest declares no default_popup.)
chrome.action.onClicked.addListener((tab) => { void pressToolbar(tab).catch(() => null); });

/**
 * ⭐ T31 · DOCK_ACT — a button on one of the dock's popups (toolbarPress.js renderRelay). ⛔ The person's own click, in a
 * web page's TOP frame (where the dock is) — and the press acts on THAT tab, never on whichever tab is active.
 * → { ok, say } (a sentence for a toast) or { ok, next } (the next question).
 */
const DOCK_ACTS = Object.freeze({
  capture: async (tab) => { const r = await captureActiveTab(tab); return { ok: !!r?.success, say: null }; },   // the capture says its own outcome on the page
  draft: async (tab) => { const r = await runDraft(tab, { control: 'draft' }); return { ok: !!r?.ok, say: r?.asked ? null : r?.message || null }; },
  // ⭐ D191 sketch 2 · the panel's ONE button on a posting draft does not hold yet: add it to the board (the capture binds
  // the tab), then draft it — the same two steps the old "Add this job to draft?" asked for one at a time
  'add-draft': async (tab) => {
    const c = await captureActiveTab(tab).catch(() => null);
    if (!c?.success) return { ok: false, say: c?.message || c?.error || "draft couldn't add this job — try again in a moment." };
    const r = await runDraft(tab, { control: 'draft' });
    return { ok: !!r?.ok, say: r?.asked ? null : r?.message || null };
  },
  fill: async (tab) => { const r = await handleGatedHandoff(tab); return { ok: !!r?.ok, say: r?.ok ? null : r?.message || 'Could not fill this page.' }; },
  unbind: async (tab) => { await clearBinding(tab.id); return { ok: true, say: null }; },
  // ⭐ T31 · Undo an AUTOMATIC capture — only the job draft itself just added on THIS tab (never one the message names)
  'undo-capture': async (tab) => {
    const jobId = takeAutoCapture(tab.id);
    if (jobId == null) return { ok: false, say: 'Nothing to undo here.' };
    const r = await authedFetch(RESUME_MASTER_URL, `/api/import/auto/${encodeURIComponent(jobId)}/undo`, { method: 'POST' }).catch(() => null);
    const body = r ? await r.json().catch(() => ({})) : null;
    if (!body?.success) return { ok: false, say: 'Could not undo that — remove it from your board in draft.' };
    await clearBinding(tab.id);
    return { ok: true, say: 'Taken off your board.' };
  },
  'sign-in': async () => { await chrome.tabs.create({ url: `${RESUME_MASTER_URL}/login` }); return { ok: true, say: null }; },
  // ⭐ D191 · the press's new buttons: the employer's page (from THIS tab's read — never a message's address), the day's
  // matches and what needs you on draft, and signing up (signed out)
  'open-company': async (tab) => {
    const href = companyHrefByTab.get(tab.id);
    if (!href) return { ok: false, say: 'Press the toolbar icon again to read this page first.' };
    await chrome.tabs.create({ url: href }); return { ok: true, say: null };
  },
  'open-draft': async () => { await chrome.tabs.create({ url: `${RESUME_MASTER_URL}/app` }); return { ok: true, say: null }; },
  'open-ask': async (tab) => openPanelHere(tab),   // ⭐ D191 B3: the panel's other-page view (the day, Ask draft)
  'open-runner': async () => openRunner(),   // ⭐ A211 (1a)
  'open-needs': async () => { await chrome.tabs.create({ url: `${RESUME_MASTER_URL}/app/auto-apply` }); return { ok: true, say: null }; },
  'sign-up': async () => { await chrome.tabs.create({ url: `${RESUME_MASTER_URL}/register?from=extension` }); return { ok: true, say: null }; },
  // ⭐ D112 b2 (replaces the owner's 10-23 Settings-tab trip, A105 (10)): Allow opens the ONE global-read ask — a small
  // window over this tab whose own Allow asks Chrome; on either answer it closes and this tab has the focus again
  'allow-site': async (tab) => {
    const r = await openGlobalAsk(tab, { force: true });
    return { ok: !!r?.ok, say: r?.already ? 'draft can already read this site — press the toolbar icon to read it now.' : null };
  },
  // ⭐ T31 · "Always read here" moved to Settings: the site is the TAB'S origin (never a message's), its frames the ones
  // draft knows it embeds; the switch there asks Chrome inside its own click
  'always-here': async (tab) => {
    const origin = customOriginFor(tab?.url);
    if (!origin) return { ok: false, say: 'draft cannot read this site automatically.' };
    const facts = await autoFactsFor(tab).catch(() => null);
    const frames = [...new Set([...(facts?.here?.frames || []).map(f => f.id), ...(facts?.frameAsk?.site ? [facts.frameAsk.site] : [])])];
    const q = new URLSearchParams({ here: origin, ...(frames.length ? { frames: frames.join(',') } : {}) });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`options.html?${q}#auto-read`) });
    return { ok: true, say: null };
  },
  // ⭐⭐ D112 item 7: the family is the TAB's address's (applyAway.js), never the message's. Granted already → it connects
  // now; otherwise the small window whose Allow asks Chrome for `cookies` + that portal's hosts, inside its own click.
  'apply-away': async (tab) => startAway(tab),
  'apply-away-disconnect': async (tab) => disconnectAway(tab),
  'auto-setup': async () => { await chrome.tabs.create({ url: chrome.runtime.getURL('options.html#auto-read') }); return { ok: true, say: null }; },
  // "Later" on the one-time offer: the worker's own write, as the popup card's Later was (an extension page's sender)
  'auto-later': async () => {
    await AUTO_READ_HANDLERS.AUTO_READ_LATER({}, { id: chrome.runtime.id, url: chrome.runtime.getURL('options.html') });
    return { ok: true, say: null };
  },
  report: async (tab) => {
    const r = await reportForm(tab, 'preview');
    if (!r?.ok) return { ok: false, say: r?.message || 'Could not read this form.' };
    return { ok: true, next: { id: 'draft-relay', kind: 'question', icon: 'info',
      text: `Send draft ${r.host}'s name and this form's ${r.labelCount} question label(s)? Never your answers.`,
      actions: [{ id: 'report-send', label: 'Send the report', word: 'Send', primary: true }] } };
  },
  'report-send': async (tab) => {
    const r = await reportForm(tab, 'send');
    return { ok: !!r?.ok, say: r?.ok ? `Reported — thank you. draft will look at ${r.host}'s form.` : r?.message || 'Could not send the report.' };
  },
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'DOCK_ACT') return false;
  const act = DOCK_ACTS[msg.act];
  if (!act || msg.trigger !== 'click' || sender?.frameId !== 0 || !sender?.tab?.id) { sendResponse({ ok: false }); return true; }
  act(sender.tab).then(r => sendResponse(r || { ok: false }), () => sendResponse({ ok: false, say: 'Something went wrong — try again.' }));
  return true;
});
// The walks press the toolbar the only way a test can: by message, ⛔ from the extension's own pages only.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'TOOLBAR_PRESS') return false;
  if (sender?.id !== chrome.runtime.id || !String(sender?.url || '').startsWith(chrome.runtime.getURL(''))) { sendResponse({ ok: false }); return true; }
  chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => pressToolbar(tab)).then(sendResponse, () => sendResponse({ ok: false }));
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
// ⭐ T20: a grant finishes the consent click that asked for it (the popup closes when Chrome's prompt opens), then
// the registrations follow the grants and the tabs already open are read.
chrome.permissions?.onAdded?.addListener((added) => { void onPermissionsAdded(added); });
chrome.permissions?.onRemoved?.addListener((removed) => { void onPermissionsRemoved(removed); });
chrome.tabs.onRemoved.addListener((tabId) => { forgetTab(tabId); });
// ⭐ D112 b2: the ask window's answer (it closes the window and focuses the posting tab), and its own ✕ (focus returns)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = GLOBAL_ASK_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});
chrome.windows?.onRemoved?.addListener((windowId) => { void onAskWindowRemoved(windowId).catch(() => null); });

// ── ⭐⭐ D112 item 7: "Let draft apply here while you're away" (applyAway.js) ─────────────────────────────────────────
// APPLY_AWAY_ANSWER only from the ask window (apply-away.html); the connect reads only the tab's portal family's cookies,
// after the minted key's signature checked out against the PINNED worker identity, and uploads ciphertext only.
configureApplyAway({
  api: chrome,
  subtle: crypto.subtle,
  fetcher: (path, init) => authedFetch(RESUME_MASTER_URL, path, init),
  show: async (tabId, specs) => drawInDock(tabId, renderRelay, [specs, await overlayTheme()]),
  signedIn: (tab) => chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: portalSignedInInPage })
    .then(([r]) => r?.result === true),
});
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = APPLY_AWAY_HANDLERS[msg?.type];
  if (!handle) return false;
  handle(msg, sender).then(sendResponse, () => sendResponse({ ok: false, error: 'failed' }));
  return true;
});
chrome.windows?.onRemoved?.addListener((windowId) => { onAwayWindowRemoved(windowId); });

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

// ── ⭐ T24: the intent model (intent.js) ── INTENT_DRAFT only from the popup (its Draft button's click), INTENT_CHOOSE only
// from the dock's own trusted click in a page's TOP frame, INTENT_SETTINGS only from the extension's own pages.
configureIntent({ serverUrl: RESUME_MASTER_URL });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = INTENT_HANDLERS[msg?.type];
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
