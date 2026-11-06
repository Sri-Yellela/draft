// ── ⭐ T24 · THE INTENT MODEL, the service worker's half — the Draft button, the dock's path line, the one question ──────
//
// The decision is intentModel.js (pure, deterministic). This module gathers the tells a PRESS may gather, acts on the
// decision through draft's own server, and says the path on the dock:
//
//   the popup's Draft (/d) ──INTENT_DRAFT──► here ── identify + bind when the tab knows no job (BINDING FIRST)
//        ── the tells: the binding + the job's record (local) · the page (one probe of the form's frame: a password box?
//           a résumé upload, and does it already hold a file? — never a value) · the server (GET /api/extension/draft/:id:
//           drafted? the résumé for (job, base)? the slots, the apply mode, the hold, the settings)
//        ── decidePath ── refuse / ask → said on the dock, nothing queued
//                       ── otherwise POST /api/extension/draft { boundJobId, trigger: 'click', resume } — the BOARD'S Draft
//                          (routes/apply.js startRun) and, in the same press, the résumé (services/extensionResume.js start)
//        ── the dock's path line: "Drafted — résumé queued, ready in about 40 s", with the one-press switch
//   the dock's line ──INTENT_CHOOSE { choice, resume?, remember }──► here — the user's answer to the question, or the switch
//   Options ──INTENT_SETTINGS──► the account's two settings (intentSettings.js; the server keeps them)
//
// ⛔ USER-TRIGGERED ONLY. Nothing here runs on a timer, a page load or a fill: INTENT_DRAFT is the popup's click (an
//    extension page), INTENT_CHOOSE the dock's own trusted click in the page's TOP frame. A fill never drafts and never
//    generates (it only redraws the line, with the tells it already had).
// ⛔ The extension never decides full auto: it never sends an approvalMode; the server's Draft previews and waits for
//    review, and FULL_AUTO_PROVEN = false keeps auto locked whatever the account says.
// ⛔ No new storage key: the path chosen on a tab rides in the tab's binding (tabBinding.js setTabPath, `bind:{tabId}`,
//    session); "drafted at" in the job's record (progress.js noteDrafted); the settings and the remembered answer with
//    the ACCOUNT (migration 168). Whether the question was already put on a tab is worker memory only.
import { authedFetch } from './auth.js';
import { tabStateFor } from './tabState.js';
import { bindingForTab, setTabPath } from './tabBinding.js';
import { progress, noteDrafted, noteResume } from './progress.js';
import { identifyAndBind } from './identify.js';
import { formFrameOf } from './gated-handoff.js';
import { fileTypesOf } from './fieldSemantics.js';
import { drawInDock, dockMeta, overlayTheme } from './dockHost.js';
import { intentSettings, saveIntentSettings, normaliseIntentSettings } from './intentSettings.js';
import { decidePath, pathWords, localTells } from './intentModel.js';

let SERVER_URL = null;
/** The router's server URL (draft's own) — set once by background.js. */
export function configureIntent({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

/** Whether the path question was already put on a tab, for its job — memory only (the question is asked ONCE). */
const ASKED = new Set();
const askedKey = (tabId, jobId) => `${tabId}:${jobId}`;
/** Tests only. */
export function resetIntentMemory() { ASKED.clear(); }

// ── the page's tells — one probe, at a press ──────────────────────────────────────────────────────────────────────
/**
 * Injected into the FORM's frame (T11: Greenhouse's iframe on a company's page): how many controls the step shows, a
 * visible password box (a sign-in wall — D36: semi only, and draft never signs in), and each file upload's words with
 * whether it already holds a file (its own file list, or a file name shown beside it). ⛔ No value is read: a count,
 * booleans, and the words that label an upload.
 */
export function probeIntentPage() {
  const shown = (el) => { try { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; } catch { return false; } };
  const skip = new Set(['hidden', 'submit', 'button', 'image', 'reset']);
  const all = [...document.querySelectorAll('input, select, textarea')];
  const controls = all.filter(el => !skip.has(String(el.type || '').toLowerCase()) && (String(el.type).toLowerCase() === 'file' || shown(el)));
  const signInWall = all.some(el => String(el.type || '').toLowerCase() === 'password' && shown(el));
  const words = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const files = controls.filter(el => String(el.type).toLowerCase() === 'file').slice(0, 6).map((el) => {
    const holder = el.closest('fieldset, [role="group"], li, div');
    const heading = holder?.querySelector('legend, label, h2, h3, h4')?.textContent || '';
    return {
      label: words(`${(el.labels && el.labels[0]?.textContent) || ''} ${el.getAttribute('aria-label') || ''} ${heading}`),
      name: words(el.name), id: words(el.id),
      required: !!el.required || el.getAttribute('aria-required') === 'true',
      holdsFile: (el.files?.length || 0) > 0 || /\.(pdf|docx?|rtf|odt|txt)\b/i.test(holder?.textContent || ''),
    };
  });
  return { controls: controls.length, signInWall, files };
}

/** The probe's answer → the page's tells. Pure. The résumé upload is named by fieldSemantics.js fileTypeOf — the one classifier. */
export function pageTellsOf(probe) {
  if (!probe || typeof probe !== 'object') return { page: { hasForm: null, signInWall: false }, field: { present: null } };
  const files = Array.isArray(probe.files) ? probe.files : [];
  // ⭐ LIVE (Ashby): read together, so an autofill drop zone beside the real résumé field is not taken for it (fileTypesOf).
  const types = fileTypesOf(files.map(f => ({ type: 'file', label: f.label, name: f.name, id: f.id })));
  const resume = files.find((f, i) => types[i] === 'resume') || null;
  const hasForm = (Number(probe.controls) || 0) >= 3 || files.length > 0;
  return {
    page: { hasForm, signInWall: !!probe.signInWall },
    field: resume ? { present: true, required: !!resume.required, holdsFile: !!resume.holdsFile } : { present: hasForm ? false : null },
  };
}

async function probePage(tab) {
  const frame = formFrameOf(tab.id);
  const run = (target) => chrome.scripting.executeScript({ target, func: probeIntentPage }).then(([r]) => r?.result ?? null);
  try { return await run(frame ? { tabId: tab.id, frameIds: [frame] } : { tabId: tab.id }); }
  catch { try { return await run({ tabId: tab.id }); } catch { return null; } }
}

// ── draft's server ───────────────────────────────────────────────────────────────────────────────────────────────
async function api(path, init) {
  let r;
  try { r = await authedFetch(SERVER_URL, path, init); } catch { r = null; }
  if (!r) return { status: 0, body: null };
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

/** The server's tells for a job → the decision's `server`, `resume`, `slots`, `settings`. Pure. */
export function serverTellsOf(body) {
  if (!body || body.ok !== true) return { server: null, resume: { state: null }, slots: null, settings: null };
  return {
    server: { drafted: !!body.draft?.drafted, status: body.draft?.status || null, applyMode: body.applyMode === 'full' ? 'full' : 'semi',
              autoLocked: body.autoLocked !== false, held: !!body.held },
    resume: { state: typeof body.resume?.state === 'string' ? body.resume.state : null },
    slots: body.slots && Number.isFinite(body.slots.remaining) ? { remaining: body.slots.remaining, limit: body.slots.limit } : null,
    settings: body.settings ? normaliseIntentSettings(body.settings) : null,
  };
}

/** The real dependencies; a test replaces any of them. */
export const realDeps = Object.freeze({
  tabState: (tab) => tabStateFor(tab),
  identify: (tab) => identifyAndBind(tab, { serverUrl: SERVER_URL }),
  binding: (tab) => bindingForTab(tab),
  record: (jobId) => progress.get({ jobId }),
  probe: (tab) => probePage(tab),
  serverTells: (jobId) => api(`/api/extension/draft/${encodeURIComponent(String(jobId))}`),
  draft: (jobId, { resume }) => api('/api/extension/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ boundJobId: jobId, trigger: 'click', resume }) }),
  settings: () => intentSettings(SERVER_URL),
  saveSettings: (patch) => saveIntentSettings(SERVER_URL, patch),
  setPath: (tab, path) => setTabPath(tab, path),
  noteDrafted: (jobId, meta) => noteDrafted(jobId, meta),
  noteResume: (jobId, r) => noteResume(jobId, r),
  draw: (tab, words) => drawPath(tab, words),
});

/** Every tell for one tab and job. `withPage` / `withServer`: only inside a press. */
export async function gatherTells(tab, job, { withPage = true, withServer = true } = {}, deps = realDeps) {
  const [binding, record] = await Promise.all([deps.binding(tab).catch(() => null), deps.record(job.jobId).catch(() => null)]);
  const local = localTells({ binding, record });
  const pageT = withPage ? pageTellsOf(await deps.probe(tab).catch(() => null)) : { page: { hasForm: null, signInWall: false }, field: { present: null } };
  const answer = withServer ? await deps.serverTells(job.jobId).catch(() => ({ status: 0, body: null })) : { status: 0, body: null };
  const srv = serverTellsOf(answer.body);
  const settings = srv.settings || await deps.settings().catch(() => null);
  return {
    ...local, ...pageT, server: srv.server, slots: srv.slots, settings,
    resume: { state: srv.resume.state, attachedOnPage: local.resume.attachedOnPage },
    asked: ASKED.has(askedKey(tab.id, job.jobId)),
  };
}

/** The tab's job — its state, or identify-and-bind first (BINDING FIRST). → { job } or { job: null, message, openDraft } */
async function jobFor(tab, deps) {
  const state = await deps.tabState(tab).catch(() => null);
  if (state?.jobId != null) return { job: { jobId: String(state.jobId), title: state.title, company: state.company } };
  if (!/^https?:/i.test(String(tab?.url || ''))) return { job: null, openDraft: true };
  const id = await deps.identify(tab).catch(() => null);
  if (id?.bind && id.job?.jobId != null) return { job: { jobId: String(id.job.jobId), title: id.job.title, company: id.job.company } };
  // a page that is no posting (or could not be read): the button opens draft, as it did before T24
  if (!id || ['not_a_job', 'unread'].includes(id.outcome)) return { job: null, openDraft: true };
  return { job: null, message: id.message || "draft doesn't know this job yet — nothing was drafted.", action: id.action || null };
}

/**
 * ONE press that may draft: the popup's Draft (`control: 'draft'`) or the dock's choice (`'choose_drafted'`, with the
 * answer to the résumé question in `resumeAnswer`). → { ok, message, decision, words, openDraft? }
 */
export async function runDraft(tab, { control = 'draft', resumeAnswer = null } = {}, deps = realDeps) {
  const found = await jobFor(tab, deps);
  if (!found.job) return { ok: false, message: found.message || null, openDraft: !!found.openDraft, action: found.action || null };
  const job = found.job;
  const tells = await gatherTells(tab, job, {}, deps);
  const d = decidePath({ ...tells, control, resumeAnswer });
  const say = async (decision, extra = {}) => {
    const words = pathWords(decision);
    await deps.draw(tab, words).catch(() => null);
    return { ok: !decision.refuse && !extra.failed, message: extra.message || words.line, decision, words, job, ...extra };
  };
  if (d.refuse || d.ask) return say(d, { asked: !!d.ask });
  if (d.draft === 'already') {
    await deps.noteDrafted(job.jobId, job).catch(() => null);
    await deps.setPath(tab, 'drafted').catch(() => null);
    return say(d, { already: true });
  }
  const wantResume = d.resume === 'queue' || d.resume === 'join';
  const r = await deps.draft(job.jobId, { resume: wantResume }).catch(() => ({ status: 0, body: null }));
  const b = r.body || {};
  if (r.status === 200 && b.already) {
    await deps.noteDrafted(job.jobId, job).catch(() => null);
    await deps.setPath(tab, 'drafted').catch(() => null);
    return say({ ...d, draft: 'already', resume: b.resume?.state === 'ready' ? 'attach' : b.resume?.state === 'in_flight' ? 'join' : 'none' }, { already: true });
  }
  if (r.status === 429 && /^draft_slots_/.test(String(b.error || ''))) {
    return say({ ...d, mode: tells.pathChoice || null, draft: 'none', refuse: { reason: b.error === 'draft_slots_short' ? 'slots_short' : 'slots',
      canDraftOnly: !!b.canDraftOnly, message: String(b.message || 'No Draft slots left — nothing was queued.').slice(0, 300) } });
  }
  if (r.status !== 202 || !b.ok) {
    const message = r.status === 0 ? "draft couldn't be reached — nothing was drafted. Try again in a moment."
      : String(b.message || b.error || 'Could not draft this job — nothing was queued.').slice(0, 300);
    return { ok: false, message, decision: d, job };
  }
  await deps.noteDrafted(job.jobId, job).catch(() => null);
  await deps.setPath(tab, 'drafted').catch(() => null);
  if (b.resume?.id) await deps.noteResume(job.jobId, { id: b.resume.id, status: b.resume.status, title: job.title, company: job.company }).catch(() => null);
  const resume = b.resumeSkipped === 'no_base_resume' ? 'skip_no_base'
    : b.resume?.status === 'ready' ? 'attach' : wantResume && b.resume?.alreadyRequested ? 'join' : d.resume;
  const done = { ...d, mode: 'drafted', resume };
  const extra = b.draft?.waiting && b.draft.message ? { message: `${pathWords(done).line} ${b.draft.message}` } : {};
  return say(done, extra);
}

/** The path line without a Draft: the dock opened (`control` null) or a fill ran (`'fill'`). Nothing is queued. */
export async function showPath(tab, { control = null } = {}, deps = realDeps) {
  const state = await deps.tabState(tab).catch(() => null);
  if (state?.jobId == null) return { ok: false };
  const job = { jobId: String(state.jobId), title: state.title, company: state.company };
  const tells = await gatherTells(tab, job, { withPage: control === null }, deps);
  const d = decidePath({ ...tells, control });
  if (d.ask?.kind === 'path') ASKED.add(askedKey(tab.id, job.jobId));
  const words = pathWords(d);
  await deps.draw(tab, words).catch(() => null);
  return { ok: true, decision: d, words };
}

/** The dock's answer: the question, the switch, or "without the résumé". `remember` keeps the answer with the account. */
export async function choose(tab, { choice, resume = null, remember = false } = {}, deps = realDeps) {
  if (choice !== 'drafted' && choice !== 'manual') return { ok: false };
  const state = await deps.tabState(tab).catch(() => null);
  if (state?.jobId != null) ASKED.add(askedKey(tab.id, state.jobId));
  if (remember) await deps.saveSettings({ remembered: choice }).catch(() => null);
  if (choice === 'drafted') return runDraft(tab, { control: 'choose_drafted', resumeAnswer: resume === 'skip' ? 'skip' : resume === 'queue' ? 'queue' : null }, deps);
  await deps.setPath(tab, 'manual').catch(() => null);
  if (state?.jobId == null) return { ok: true };
  const job = { jobId: String(state.jobId), title: state.title, company: state.company };
  const tells = await gatherTells(tab, job, { withPage: false }, deps);
  const d = decidePath({ ...tells, control: 'choose_manual' });
  const words = pathWords(d);
  const kept = tells.server?.drafted ? `${words.line} Your Draft stays in Home — remove it there if you won't use it.` : words.line;
  // the SAME words the worker draws go back to the click's own callback, which redraws with them
  const said = { ...words, line: kept };
  await deps.draw(tab, said).catch(() => null);
  return { ok: true, message: kept, decision: d, words: said };
}

// ── the dock's path line — ⭐ T27: a POPUP ─────────────────────────────────────────────────────────────────────
/**
 * Injected, TOP frame: the path line as the dock's popup (extension/popup-layer.js) — the ask-once question ("Draft this
 * job and queue its résumé, or just fill this form yourself?") stays until it is answered; the path the tab is on
 * ("Filling by hand — a résumé on cue", with its switch) is said and dismisses itself. Nothing of it sits in the dock's
 * body any more. Its buttons answer with a TRUSTED click only. Closes over nothing: the model, the palettes and the
 * dock's meta come as arguments. The popup keeps the hooks the walks read: #draft-intent-path, data-intent-tone,
 * data-role="intent-line", data-choice, data-role="remember".
 */
export function renderIntentPath(model, theme, dockArgs) {
  const api = globalThis.__draftDock;
  const dock = api?.current?.() || api?.ensure?.(dockArgs || {});
  const pop = globalThis.__draftPopups;
  if (!dock || !model || !pop?.show) return { rendered: false };
  const ID = 'draft-intent-path';
  document.getElementById(ID)?.parentNode === dock.host && document.getElementById(ID).remove();   // the old status-slot line
  // the two answers, as SHORT words (their whole words are the name and the tooltip)
  const WORD = { drafted: 'Draft', manual: 'Myself' };
  const draw = (m) => {
    const question = m.tone === 'ask' || m.tone === 'refuse';
    const buttons = (m.buttons || []).slice(0, 2);
    void pop.show({
      id: ID, kind: question ? 'question' : 'toast', ms: question ? 0 : 8000, text: m.line || '', textRole: 'intent-line',
      icon: question ? 'info' : 'fill', theme, data: { intentTone: m.tone || 'path' },
      toggle: m.remember ? { role: 'remember', label: 'Remember my choice', icon: 'pin' } : null,
      actions: buttons.map((b, i) => ({ id: `c${i}`, label: b.label, word: WORD[b.choice] || b.label, primary: !!b.primary,
        attrs: { 'data-choice': b.choice, ...(b.resume ? { 'data-resume': b.resume } : {}) } })),
      onAction: (answer) => {
        if (!answer.trusted) return 'ignore';                         // ⛔ the user's own click, never a script's
        const b = buttons[Number(answer.action.slice(1))];
        chrome.runtime.sendMessage({ type: 'INTENT_CHOOSE', trigger: 'click', choice: b.choice, resume: b.resume || null, remember: answer.toggle },
          (r) => { void chrome.runtime.lastError; draw(r?.words || m); });
        return 'keep';
      },
    });
    try { dock.statusText(m.line || ''); } catch { /* an older dock */ }
    if (question) { try { dock.expand(); } catch { /* collapsed stays */ } }
  };
  draw(model);
  return { rendered: true };
}

async function drawPath(tab, words) {
  return drawInDock(tab.id, renderIntentPath, [words, await overlayTheme(), await dockMeta(tab)]);
}

// ── the messages ─────────────────────────────────────────────────────────────────────────────────────────────────
const fromExtensionPage = (sender) => typeof sender?.url === 'string'
  && sender.url.startsWith(chrome.runtime.getURL(''))
  && (sender.id == null || sender.id === chrome.runtime.id);
const fromDockClick = (msg, sender) => msg?.trigger === 'click' && sender?.frameId === 0 && sender?.tab?.id != null;

export const handlers = Object.freeze({
  /** The popup's Draft button (/d) — its click. ⛔ An extension page only; a web page never drafts. */
  INTENT_DRAFT: async (msg, sender) => {
    if (!fromExtensionPage(sender) || msg?.trigger !== 'click') return { ok: false, error: 'not_allowed' };
    let tab = null;
    try { tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0] || null; } catch { tab = null; }
    if (!tab?.id) return { ok: false, openDraft: true };
    const r = await runDraft(tab, { control: 'draft' });
    return { ok: !!r.ok, message: r.message || null, openDraft: !!r.openDraft, action: r.action || null,
             asked: !!r.asked, already: !!r.already, mode: r.decision?.mode ?? null };
  },
  /** The dock's answer (the question, the switch). ⛔ The dock's own trusted click, in the page's TOP frame. */
  INTENT_CHOOSE: async (msg, sender) => {
    if (!fromDockClick(msg, sender)) return { ok: false, error: 'not_allowed' };
    const r = await choose(sender.tab, { choice: msg.choice, resume: msg.resume, remember: msg.remember === true });
    return { ok: !!r.ok, message: r.message || null, words: r.words || null };
  },
  /** Options: read, or change, the account's two settings. ⛔ An extension page only. */
  INTENT_SETTINGS: async (msg, sender) => {
    if (!fromExtensionPage(sender)) return { ok: false, error: 'not_allowed' };
    const value = msg?.set ? await saveIntentSettings(SERVER_URL, msg.set) : await intentSettings(SERVER_URL);
    return value ? { ok: true, settings: value } : { ok: false, message: 'Could not save that — try again in a moment.' };
  },
});

