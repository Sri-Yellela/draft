// ── D98 §4–§5 · A RÉSUMÉ GENERATED ON THE PAGE — the extension's half (lane J6) ──────────────────────────────────────
//
// Owner, 10-13: "prepare and trigger a résumé generation for this job right on the page using the extension, view it,
// and include it in the autofill payload" — decided: option D of the sketch (docs/sketches/extension-onpage.html, tab 3):
// the in-page panel is the main path, the full editor opens only on demand.
//
// A Résumé panel in the on-page panel family (its own shadow root, the site's tokens, marks, both themes, no capsule):
//
//   Not generated ── Generate ──► Generating ──► Ready ──► Attach ──► Attached: FirstName_LastName_Company_Role.pdf
//        ▲                         │ Cancel       │ Regenerate (another slot, said first) · Edit in a full page
//        └── Try again ◄── Cancelled · Failed · Refused (the claim guard's reasons — NOTHING is attached)
//
// ⛔ THE EXTENSION NEVER CALLS A MODEL AND NEVER CALLS THE RÉSUMÉ SERVICE ITSELF. Every request below goes to draft's own server
//   through auth.js authedFetch (the extension's own token) — POST /api/extension/resume and its status / cancel / pdf
//   routes (routes/extensionResume.js). The server runs the web app's own generation: a Draft slot, the claim guard,
//   the ATS scorer, a normal tailored résumé linked to the job. test/j6ResumePanel.test.js greps every network target.
// ⛔ USER-TRIGGERED ONLY. A generation starts from ONE handler, RESUME_GENERATE — sent from the page's tab with
//   `trigger: "click"`; from anywhere but a web page's tab it is refused. ⭐ T22 REVISED (owner 10-15): the Résumé tab of
//   the dock is a VIEW (state, preview, Attach) and no longer starts one — its Generate / Try again / Regenerate are gone,
//   and so are the popup's "Résumé for this job" and every other trigger. The two places a résumé is started from are
//   the Draft button (T24) and the résumé field's row in a manual fill (T18's "Generate and attach") — both the user's
//   own press, both still to be wired; until then nothing in the extension sends RESUME_GENERATE. Nothing runs on a
//   timer, a page load, a step change or a fill. The popup's D23 rule holds: opening it reads nothing from the page.
// ⛔ NO MONEY, TOKENS, OR MODEL NAMES. The user sees the allowance ("uses 1 of your 10 Draft slots today") and nothing
//   else; the server already strips cost fields (services/extensionResume.js userSafe), and the model built here takes
//   only named fields from the server's answer, never echoes one wholesale.
// ⛔ THE PREVIEW CANNOT RUN OR LOAD ANYTHING. The server sends an allow-listed fragment (services/resumePreviewSanitiser.js);
//   here, as defence in depth, it is cleaned TWICE more — scrubPreviewHtml (text) before it leaves the service worker,
//   and in the page it is parsed by DOMParser (an inert document: no script runs, no image loads), every script,
//   embed, image, link and handler removed, every url() / @import removed, and only then moved into a shadow root of
//   its own, with the résumé's body{} rules mapped to :host.
// ⛔ A REFUSAL ATTACHES NOTHING. Attach is offered, and accepted by RESUME_ATTACH, only for a generation the server says
//   is `ready` — re-asked at the moment of the press, never taken from the panel's message.
// ⛔ NEVER A SILENT MISS. Attach sets the PDF on the page's upload control (DataTransfer, then input + change) and
//   VERIFIES the page shows the file's name; when it cannot be set or not verified — Workday's custom drop zone is the
//   likely case — the panel says so and offers Download PDF, copies the file name, and says "drag it onto the upload box".
//
// WHAT IS STORED, AND WHERE (for the privacy page, STORE_LISTING and PRIVACY_RECONCILIATION):
//   · NO NEW STORAGE KEY. The job's existing progress record (progress.js, chrome.storage.local `jobProgress`, 30 days,
//     cleared on Disconnect / sign-out / another account) gains a `resume` step: { at, id, status, attached } — the
//     generation's opaque id (erg_…), its last status word, when it started, and when Attach was pressed. No HTML, no
//     PDF, no file name, no score, no answer. The preview, the PDF and its name are asked of the server each time.
//   · The panel's own on-screen state (collapsed, which side) lives in the page's isolated world for the tab's life and
//     is not stored.
//
// Message handlers for the router (background.js — the coordinator wires them):
//   export const handlers = { RESUME_PANEL_OPEN, RESUME_GENERATE, RESUME_STATUS, RESUME_CANCEL, RESUME_ATTACH,
//                             RESUME_DOWNLOAD, RESUME_OPEN_EDITOR } — each async (msg, sender) => reply.
// configureResumePanel({ serverUrl }) sets the router's server URL (RESUME_MASTER_URL — draft's own server) once.

import { authedFetch } from './auth.js';
import { tabJob } from './answerMemory.js';
import { bindingForTab, bindingLabel } from './tabBinding.js';
import { lookupBoardJob } from './boardJob.js';
import { identifyAndBind } from './identify.js';
import { notePageRead } from './diagnostics.js';
import { overlayTheme, fetchPdf, formFrameOf } from './gated-handoff.js';
// ⭐ T17: the ATS and Résumé views are drawn on the dock, in the TOP frame.
import { drawInDock, dockMeta } from './dockHost.js';
import { noteResume, resumeFor } from './progress.js';
import { C_LIGHT } from './tokens.js';

let SERVER_URL = null;
/** The router's server URL (draft's own) — set once, at import, by background.js. */
export function configureResumePanel({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

/** The panel's poll while a generation runs (the server's own estimate is 10–20 s). */
export const POLL_MS = 2000;
/** ⚠ True at this lane's merge (D98 P3 not built — docs/D98_P0_REPORT.md §5): the web editor's save re-runs neither. */
export const EDIT_NOT_RECHECKED = 'Opens this job in draft in a new tab. Edits made there are not re-checked by the claim guard or re-scored yet.';
export const DRAG_HINT = 'drag it onto the upload box';

// ── the preview, cleaned as text (service worker side — it has no DOM) ───────────────────────────────────────────
/**
 * ⛔ Defence in depth on top of the server's allow-list: whatever arrives, nothing that can run or load leaves here.
 * Removed with their content: script, style-less embeds (iframe, object, embed, svg, math, template, noscript, video,
 * audio, canvas, form controls); removed as tags: img, picture, source, link, meta, base, input; every on…= handler,
 * src / srcset / href / action / background / poster attribute; every url(…), @import and expression(…) in CSS.
 */
export function scrubPreviewHtml(html) {
  let s = String(html ?? '').slice(0, 400_000);
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|iframe|object|embed|svg|math|template|noscript|video|audio|canvas|form|button|select|textarea|frameset|frame|portal|applet)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<\/?(script|iframe|object|embed|svg|math|template|noscript|video|audio|canvas|form|button|select|textarea|frameset|frame|portal|applet|img|picture|source|link|meta|base|input|track|area)\b[^>]*>/gi, '');
  s = s.replace(/\s(on[a-z]+|src|srcset|href|xlink:href|action|formaction|background|poster|ping|data)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/@import[^;]*;?/gi, '').replace(/url\s*\([^)]*\)/gi, 'none').replace(/expression\s*\(/gi, '(')
    .replace(/(-moz-binding|behavior)\s*:[^;}"']*/gi, '').replace(/javascript:/gi, '');
  return s;
}

// ── the words — one model per state, built from named fields only ───────────────────────────────────────────────
const jobWords = (job) => bindingLabel(job || {});
const slotWords = (a) => {
  if (!a || !Number.isFinite(a.limit)) return 'Uses 1 of your Draft slots.';
  if (a.remaining <= 0) return `You have used all ${a.limit} of your Draft slots for now — they come back over 24 hours.`;
  return `Uses 1 of your ${a.limit} Draft slots today — ${a.remaining} left.`;
};
const n = (v) => (Number.isFinite(v) ? Math.round(v) : null);

/** "What we changed — 9 rewritten · 2 added · +16 job terms" (the D90 change set's summary). */
export function changesWords(changes) {
  const s = changes?.summary;
  if (!s) return null;
  if (s.identical) return 'What we changed — nothing: it reads as your résumé does.';
  const parts = [];
  if (s.rewritten > 0) parts.push(`${s.rewritten} rewritten`);
  if (s.added > 0) parts.push(`${s.added} added`);
  if (s.removed > 0) parts.push(`${s.removed} removed`);
  const terms = Array.isArray(s.termsGained) ? s.termsGained.length : 0;
  if (terms) parts.push(`+${terms} job term${terms === 1 ? '' : 's'}`);
  if (s.roleChanges > 0) parts.push(`${s.roleChanges} role title${s.roleChanges === 1 ? '' : 's'} changed`);
  return `What we changed — ${parts.join(' · ') || 'a few words'}`;
}

const plain = (v, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
/** ⛔ Money, tokens or a model's name. A server sentence that names one is never shown — a fixed one is, instead. */
export const COST_WORDS = /\$\s?\d|\b(usd|cents?|tokens?|claude[\w-]*|gpt-?\d[\w.-]*|sonnet|opus|haiku|anthropic|openai|gemini|llm|credit balance|api key|billing|pric(e|ing))\b/i;
const UNAVAILABLE = 'Résumé generation is unavailable right now.';
const safe = (v, fallback = null, max = 400) => { const t = plain(v, max); return !t || COST_WORDS.test(t) ? fallback : t; };
// ⭐ T22 REVISED (owner 10-15): the Résumé tab is a VIEW — its state, a preview, Attach — and no longer a place to START a
// résumé. Generate, Try again and Regenerate are gone from it; a résumé is started from exactly two places, the Draft
// button and the résumé field's own row in a manual fill (T24 / T18 — RESUME_GENERATE below is the one start they use).
const ACTION = {
  cancel: { role: 'cancel', label: 'Cancel' },
  attach: { role: 'attach', label: 'Attach', primary: true },
  attachAgain: { role: 'attach', label: 'Attach again' },
  edit: { role: 'edit', label: 'Edit in a full page' },
  download: { role: 'download', label: 'Download PDF' },
  downloadPrimary: { role: 'download', label: 'Download PDF', primary: true },
  // D99: an unlinked tab's message is a button, not an instruction to go somewhere else
  readPage: { role: 'read', label: 'Read this page now', primary: true },
};

// ⭐ D99 J12 · ATS ON THE PAGE — draft's own report on the user's base résumé, for the tab's job, shown at once. A
// signed-in user is never sent to the free checker. The words are the web app's (shared/atsBands.js labels).
const BAND_WORDS = Object.freeze({ strong: ['Strong match', 'ok'], moderate: ['Moderate match', 'info'], weak: ['Weak match', 'warn'],
  not_enough_signal: ['Not enough signal', ''] });
/** The report block, from boardJob.js atsFacts() — or null (nothing is shown rather than a guess). */
export function reportModel(ats) {
  if (!ats || typeof ats !== 'object') return null;
  if (ats.state === 'no_base_resume') {
    return { state: 'no_base_resume', line: 'Add your résumé in draft to see how it scores for this job.',
      action: { role: 'add-resume', label: 'Add your résumé in draft' } };
  }
  if (ats.state === 'unavailable') return { state: 'unavailable', line: 'The ATS score is not available right now.' };
  if (ats.state !== 'ready') return null;
  const band = BAND_WORDS[Number.isFinite(ats.score) ? ats.band : 'not_enough_signal'] || BAND_WORDS.not_enough_signal;
  const list = (xs) => (Array.isArray(xs) ? xs.map(x => plain(x, 60)).filter(Boolean).slice(0, 12) : []);
  // T3: a page draft does not hold is scored against ITS OWN TEXT — said so, and there is no board report to open
  const fromPage = ats.basis === 'page';
  return { state: 'ready', head: Number.isFinite(ats.score) ? `ATS ${Math.round(ats.score)} · ${band[0]}` : `ATS · ${band[0]}`, tone: band[1],
    note: fromPage ? 'Your base résumé, scored against this page.' : 'Your base résumé, scored for this job.',
    matched: list(ats.matched), missing: list(ats.missing),
    // ⭐ T9: the scorer's own report (boardJob.js atsFacts, already kept to the component's named fields). When it is
    // here the panel draws THE web app's ATS report from it (the shared component), not the two lines above.
    report: ats.report && typeof ats.report === 'object' ? ats.report : null,
    action: fromPage ? null : { role: 'report', label: 'Full report in draft' } };
}

/**
 * The panel's model for one moment. Inputs:
 *   job        { jobId, title, company } — the tab's job (binding / released packet), or null
 *   view       GET /api/extension/resume/:id's answer, or null
 *   allowance  { used, limit, remaining } (the view's, else GET /api/draft/slots), or null
 *   error      { error, code } — a refused request's fixed sentence, or null
 *   attach     { outcome: 'attached' | 'fallback' | 'noinput', fileName, reason, base64? } — Attach's result, or null
 *   warning    the server's regenerate warning, or null
 * ⛔ Only these named fields are read; nothing of the server's answer is copied wholesale into what is shown.
 */
export function resumePanelModel(args = {}) {
  const m = modelCore(args);
  // T3: an unlinked tab still shows a score read from the page itself — never a board report for a job it is not on
  return { ...m, report: m.state === 'nojob' && args.report?.basis !== 'page' ? null : reportModel(args.report) };
}
function modelCore({ job = null, view = null, allowance = null, error = null, attach = null, warning = null } = {}) {
  const j = view?.job?.jobId ? { jobId: view.job.jobId, title: view.job.title ?? job?.title ?? null, company: view.job.company ?? job?.company ?? null } : job;
  const a = view?.allowance || allowance || null;
  const base = {
    id: view?.id && /^erg_[a-f0-9]{8,64}$/.test(view.id) ? view.id : null,
    job: j ? jobWords(j) : null,
    title: 'Résumé for this job', state: 'none', lines: [], reasons: [], findings: [], actions: [],
    progress: null, poll: false, preview: null, score: null, changes: null, guard: null, fileName: null, download: null,
    allowance: a ? { limit: n(a.limit), remaining: n(a.remaining) } : null,
  };
  const line = (text, tone = '') => base.lines.push({ text: plain(text, 400), tone });
  const refunded = view?.slot?.refunded === true;

  if (!j?.jobId) {
    return { ...base, state: 'nojob', title: 'Résumé for this job', job: null,
      lines: [{ text: 'This tab is not linked to a job yet — Read this page now finds it on your board.', tone: 'warn' }],
      actions: [ACTION.readPage] };
  }
  if (error && !view) {
    line(safe(error.error, UNAVAILABLE), 'warn');
    if (error.code === 'slots_exhausted') line(slotWords(a));
    return { ...base, state: 'error', actions: [] };
  }
  const status = view?.status || null;
  if (!status) {
    line('No résumé has been made for this job yet.');
    return { ...base, state: 'none', title: 'Résumé for this job', actions: [] };
  }
  if (status === 'queued' || status === 'generating') {
    line(`Generating your résumé for ${jobWords(j)} — usually 10–20 seconds.`);
    line('You can close the draft popup or go to the next step; it keeps going.');
    if (safe(warning)) line(safe(warning), 'warn');
    return { ...base, state: 'generating', title: 'Generating…', poll: true, actions: [ACTION.cancel],
      progress: { startedAt: Number.isFinite(view.createdAt) ? view.createdAt * 1000 : Date.now(), label: status === 'queued' ? 'Waiting to start' : 'Generating' } };
  }
  if (status === 'refused') {
    const reasons = (view.guard?.reasons || []).map(r => safe(r)).filter(Boolean).slice(0, 12);
    line('draft withheld this résumé: it claimed something your profile does not support.', 'warn');
    line('Nothing was attached.');
    if (refunded) line('Your Draft slot was given back.');
    return { ...base, state: 'refused', title: 'Withheld by the claim guard', reasons, actions: [] };
  }
  if (status === 'failed') {
    line(safe(view.error?.message, UNAVAILABLE), 'warn');
    line(refunded ? 'Nothing was attached, and your Draft slot was given back.' : 'Nothing was attached.');
    return { ...base, state: 'failed', title: 'It did not finish', actions: [] };
  }
  if (status === 'cancelled') {
    line('Cancelled — nothing was attached.');
    line(refunded ? 'Your Draft slot was given back.' : 'The work had already started, so the slot was used.');
    return { ...base, state: 'cancelled', title: 'Cancelled', actions: [] };
  }
  // ready
  const ready = {
    ...base,
    preview: view.preview?.html ? { html: scrubPreviewHtml(view.preview.html) } : null,
    score: view.score && (Number.isFinite(view.score.before) || Number.isFinite(view.score.after)) ? { before: n(view.score.before), after: n(view.score.after) } : null,
    changes: changesWords(view.changes),
    guard: view.guard?.passed === true
      ? { text: 'Checked against your profile — nothing it claims goes beyond what your profile says.', tone: 'ok' }
      : null,
    findings: (view.guard?.findings || []).map(f => safe(f)).filter(Boolean).slice(0, 6),
    fileName: plain(attach?.fileName || view.pdf?.fileName || '', 120) || null,
  };
  const more = [];
  if (view.fromExisting) more.push({ text: 'No slot used — draft had already made this résumé for this job from your current résumé.', tone: '' });
  if (safe(warning)) more.push({ text: safe(warning), tone: 'warn' });
  const outcome = attach?.outcome || (view.pdf?.attached ? 'attached' : null);
  if (outcome === 'attached') {
    return { ...ready, state: 'attached', title: `Attached: ${ready.fileName || 'your résumé'}`,
      lines: [...more, attach ? { text: 'The page shows the file in its upload box.', tone: 'ok' }
        : { text: 'You chose this file for this application. If the upload box does not show it, press Attach again or Download PDF.', tone: '' },
        { text: 'A later fill on this application attaches this same file — nothing is generated again.', tone: '' }],
      actions: [ACTION.attachAgain, ACTION.download, ACTION.edit] };
  }
  if (outcome === 'fallback' || outcome === 'noinput') {
    const why = outcome === 'noinput'
      ? 'There is no upload box for a résumé on this step.'
      : `draft could not put the file in this page's upload box${attach?.reason === 'not_shown' ? ' — the page did not show its name' : ''}.`;
    return { ...ready, state: 'fallback', title: 'Attach it yourself', download: attach?.base64 ? { base64: attach.base64 } : null,
      lines: [...more, { text: why, tone: 'warn' },
        { text: `Download PDF — its name is copied for you — then ${DRAG_HINT}.`, tone: '' },
        ...(outcome === 'noinput' ? [{ text: 'Or press Attach again on the step that asks for your résumé.', tone: '' }] : [])],
      actions: [ACTION.downloadPrimary, ACTION.attachAgain, ACTION.edit] };
  }
  return { ...ready, state: 'ready', title: 'Your résumé is ready',
    lines: [...more, { text: 'Read it, then Attach puts it in this application’s upload box.', tone: '' }],
    actions: [ACTION.attach, ACTION.download, ACTION.edit] };
}

/** Every word a model shows the user — its title, lines, reasons, findings, buttons and marks (not the résumé itself). */
export function modelWords(m) {
  if (!m) return '';
  return [m.title, m.job, m.changes, m.guard?.text, m.fileName, m.progress?.label,
    ...(m.lines || []).map(l => l.text), ...(m.reasons || []), ...(m.findings || []), ...(m.actions || []).map(x => x.label),
    m.score ? `ATS ${m.score.before ?? '–'} → ${m.score.after ?? '–'}` : null,
    m.report?.head, m.report?.line, m.report?.note, m.report?.action?.label].filter(Boolean).join('\n');
}

// ── the injected views: the dock's ATS tab and Résumé tab ────────────────────────────────────────────────────────
// Runs in the page's ISOLATED world, TOP frame (it needs chrome.runtime to talk back). executeScript serialises it, so it
// closes over NOTHING: the model and the palettes arrive as arguments (extension/tokens.js — never a colour literal).
// ⭐ T17: TWO views of the dock (extension/dock.js) drawn from ONE model — the ATS tab (draft's report for the tab's job:
// T9's shared component when the scorer's report came with it) and the Résumé tab (the generation's state, its
// preview, Attach). The window they sit in — drag, resize, snap, collapse, Close, Esc, where it sits on this site — is
// the dock's, once; nothing here moves anything. Each view has its own shadow root: the page's CSS is kept out and its
// own in; the form probe never sees them (the dock is not in <body>). `meta.tab` says which tab to show ('ats' or
// 'resume', default 'resume').
// ⛔ D60: rectangles — controls radius 8 on 28+, marks radius 6 with a 3px leading bar, the bar square-ended (radius 1).
export function renderResumePanel(model, meta) {
  const ID = 'rm-resume-panel';
  const ATS_ID = 'rm-ats-panel';
  const D = globalThis.__draftDock;
  const dock = D?.ensure?.(meta?.dock || {}) || null;
  if (!dock) return { ok: false, rendered: false, error: D ? 'not_top_frame' : 'no_dock' };
  if (!model) {
    for (const [tab, id] of [['resume', ID], ['ats', ATS_ID]]) { const el = document.getElementById(id); if (el) dock.drop(tab, el); }
    return { ok: true, rendered: false, closed: true };
  }

  const theme = meta?.theme || {};
  const varsOf = (pal) => Object.entries(pal || {}).map(([k, v]) => `--c-${k.toLowerCase().replace(/_/g, '-')}: ${v};`).join(' ');
  const LOGO_FACE = 'rm-draft-logo';
  if (theme.logoFont && typeof FontFace === 'function') {
    try {
      const bin = atob(theme.logoFont);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const face = new FontFace(LOGO_FACE, bytes.buffer, { style: 'italic', weight: '800' });
      document.fonts.add(face);
      face.load().catch(() => {});
    } catch { /* the fallback face carries the same words */ }
  }
  const logo = `'${LOGO_FACE}', 'Poppins', ui-sans-serif, system-ui, sans-serif`;
  const paper = meta?.paper || {};
  const css = `
    :host { all: initial; display: block; height: 100%; }
    .rp { ${varsOf(theme.light)} --c-paper: ${paper.bg || 'Canvas'}; --c-paper-ink: ${paper.ink || 'CanvasText'}; }
    @media (prefers-color-scheme: dark) { .rp { ${varsOf(theme.dark)} } }
    .rp { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; overflow: hidden;
      font: 13px/1.45 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--c-ink);
      background: var(--c-surface-menu); text-align: left; }
    .rp * { box-sizing: border-box; }
    .hd { padding: 10px 14px 8px; border-bottom: 1px solid var(--c-border); }
    .t { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 15px; letter-spacing: -.01em; overflow-wrap: anywhere; }
    .s { font-size: 11.5px; color: var(--c-ink-muted); margin-top: 2px; }
    .btn:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    .sc { overflow: auto; padding: 10px 14px; flex: 1; min-height: 0; display: grid; gap: 8px; align-content: start; }
    .ln { margin: 0; font-size: 12.5px; }
    .rpt { display: grid; gap: 6px; }
    .ln.warn { color: var(--c-warning); font-weight: 700; }
    .ln.ok { color: var(--c-success); font-weight: 700; }
    .prog { font-size: 11.5px; color: var(--c-ink-muted); }
    .pb { height: 6px; border-radius: 1px; background: var(--c-border); margin-top: 6px; overflow: hidden; position: relative; }
    .pb i { position: absolute; top: 0; bottom: 0; width: 34%; background: var(--c-success); animation: rm-slide 1.4s ease-in-out infinite; }
    @keyframes rm-slide { from { left: -34%; } to { left: 100%; } }
    /* ⛔ D60 / D63: a status is a MARK — a rectangle with a 3px leading bar, never a capsule. */
    .marks { display: flex; gap: 6px; flex-wrap: wrap; }
    .mark { --mk: var(--c-ink-faint); display: inline-block; font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 11px;
      line-height: 1.2; padding: 4px 8px 4px 7px; border-radius: 6px; color: var(--mk); border-left: 3px solid var(--mk);
      background: color-mix(in srgb, var(--mk) 12%, transparent); }
    .mark.ok { --mk: var(--c-success); } .mark.warn { --mk: var(--c-warning); } .mark.no { --mk: var(--c-danger); } .mark.info { --mk: var(--c-info); }
    .guard { font-size: 12px; padding: 7px 9px; border-left: 3px solid var(--c-success); border-radius: 0 6px 6px 0; background: var(--c-success-quiet); color: var(--c-success); }
    .list { margin: 0; padding: 0 0 0 16px; font-size: 12px; }
    .list li { margin: 0 0 3px; }
    .pvw { height: 260px; overflow: auto; border: 1px solid var(--c-border-strong); border-radius: 6px; background: var(--c-paper); }
    .pv { display: block; width: 816px; zoom: .42; background: var(--c-paper); color: var(--c-paper-ink); }
    .ft { padding: 10px 14px; background: var(--c-surface-modal); border-top: 1px solid var(--c-border); display: grid; gap: 6px; }
    .acts { display: flex; gap: 6px; flex-wrap: wrap; }
    .btn { font: inherit; font-size: 11.5px; font-weight: 700; padding: 6px 12px; min-height: 30px; border-radius: 8px; border: 0;
      background: var(--c-surface-solid); color: var(--c-ink); box-shadow: var(--c-depth-rest); cursor: pointer;
      transition: box-shadow .2s ease, transform .2s ease; }
    .btn:hover:not(:disabled), .btn:focus-visible { box-shadow: var(--c-depth-hover); transform: translateY(-2px); }
    .btn:active:not(:disabled) { transform: translateY(0); box-shadow: var(--c-depth-press); }
    .btn:disabled { cursor: default; opacity: .55; box-shadow: none; }
    .btn.primary { background: var(--c-accent); color: var(--c-on-accent); box-shadow: var(--c-depth-accent); }
    .say { font-size: 11.5px; color: var(--c-ink-muted); min-height: 0; }
    .say.warn { color: var(--c-warning); }
    .note { font-size: 11px; color: var(--c-ink-faint); }
    @media (prefers-reduced-motion: reduce) { .btn { transition: none; } .pb i { animation: none; left: 0; width: 100%; } }
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const send = (msg) => new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, (reply) => { void chrome.runtime.lastError; resolve(reply ?? null); }); } catch { resolve(null); }
  });

  // ⛔ The preview, cleaned AGAIN in the page: an inert DOMParser document (nothing in it runs or loads), everything that
  // could run or load removed, then moved into a shadow root of its own. The résumé's html/body rules become :host.
  const cleanCss = (t) => String(t || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;?/gi, '').replace(/url\s*\([^)]*\)/gi, 'none')
    .replace(/expression\s*\(/gi, '(').replace(/(-moz-binding|behavior)\s*:[^;}]*/gi, '')
    .replace(/(^|[}\s,])(html|body)(?=[\s,{.:#[>~+])/gi, '$1:host');
  const DROP = 'script,style,iframe,object,embed,img,picture,source,video,audio,canvas,link,meta,base,svg,math,form,input,button,select,textarea,frame,frameset,template,noscript,portal,applet,track,area';
  const fillPreview = (el, html) => {
    const r = el.attachShadow({ mode: 'open' });
    const doc = new DOMParser().parseFromString(`<!doctype html><html><head></head><body>${html}</body></html>`, 'text/html');
    const styles = [...doc.querySelectorAll('style')].map(s => cleanCss(s.textContent)).join('\n');
    doc.querySelectorAll(DROP).forEach(n => n.remove());
    for (const n of doc.body.querySelectorAll('*')) {
      for (const at of [...n.attributes]) {
        const k = at.name.toLowerCase();
        if (k.startsWith('on') || ['src', 'srcset', 'href', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'ping', 'data', 'target'].includes(k)) n.removeAttribute(at.name);
        else if (k === 'style') n.setAttribute('style', cleanCss(at.value));
      }
    }
    const st = document.createElement('style');
    st.textContent = `:host { display: block; padding: 24px 32px; } ${styles}`;
    const page = document.createElement('div');
    page.setAttribute('data-role', 'page');
    page.append(...[...doc.body.childNodes].map(c => document.importNode(c, true)));
    r.append(st, page);
  };

  // The two hosts, from the dock — fresh elements; the last draw's views are cleaned up and removed.
  const want = meta?.tab === 'ats' ? 'ats' : 'resume';
  let pollTimer = null;
  let tick = null;
  function cleanup() { clearTimeout(pollTimer); clearInterval(tick); }
  const atsHost = dock.view('ats', { id: ATS_ID, label: 'draft — ATS report for this job', expand: want === 'ats', select: want === 'ats', onClose: cleanup });
  atsHost.setAttribute('data-draft-ats-panel', '');
  const host = dock.view('resume', { id: ID, label: 'draft — résumé for this job', expand: want === 'resume', select: want === 'resume', onClose: cleanup });
  host.setAttribute('data-draft-resume-panel', '');
  const mount = (h, label) => {
    const r = h.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = css;
    const p = document.createElement('div');
    p.className = 'rp';
    p.setAttribute('role', 'region');
    p.setAttribute('aria-label', label);
    r.append(style, p);
    return { root: r, panel: p };
  };
  const { root, panel } = mount(host, 'draft — résumé for this job');
  const { root: atsRoot, panel: atsPanel } = mount(atsHost, 'draft — ATS report for this job');

  let m = model;
  const elapsed = (from) => { const s = Math.max(0, Math.round((Date.now() - from) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  // ── the ATS tab: draft's report for this tab's job ──
  const drawAts = () => {
    atsHost.dataset.state = m.report?.state || (m.state === 'nojob' ? 'nojob' : 'none');
    dock.summary('ats', m.report?.head || 'ATS');   // what the slim bar says while this tab is shown
    // ⭐ T9: the shared ATS component (extension/atsReport.js, injected before this function by RESUME_PANEL_OPEN). A
    // content script's isolated world has no custom-element registry, so the view calls its renderer directly —
    // the same code, the same stylesheet, in a shadow root of its own inside this one.
    const ATS = globalThis.__draftAtsReport;
    const card = !!(m.report?.report && typeof ATS?.mountAtsReport === 'function');
    const nojob = !m.report && m.state === 'nojob';
    atsPanel.innerHTML = `
      <div class="hd">
        <div class="t" data-role="title">ATS for this job</div>
        ${m.job ? `<div class="s" data-role="job">${esc(m.job)}</div>` : ''}
      </div>
      <div class="sc">
        ${m.report ? `<div class="rpt" data-role="ats-report" data-state="${esc(m.report.state)}">${
          // ⭐ T9: THE web app's ATS report — the shared component, mounted below into its own shadow root — when the
          // scorer's report came with the answer and the component was injected; else the summary lines, as before.
          card ? '<div data-role="ats-card"></div>' : `${
          m.report.head ? `<div class="marks"><span class="mark ${esc(m.report.tone || '')}" data-role="ats-score">${esc(m.report.head)}</span></div>` : ''}${
          m.report.matched?.length ? `<p class="ln" data-role="ats-matched"><b>Matched:</b> ${esc(m.report.matched.join(', '))}</p>` : ''}${
          m.report.missing?.length ? `<p class="ln" data-role="ats-missing"><b>Missing:</b> ${esc(m.report.missing.join(', '))}</p>` : ''}`}${
          m.report.note ? `<p class="note">${esc(m.report.note)}</p>` : ''}${
          m.report.line ? `<p class="ln">${esc(m.report.line)}</p>` : ''}${
          m.report.action ? `<div class="acts"><button class="btn" data-role="${esc(m.report.action.role)}">${esc(m.report.action.label)}</button></div>` : ''}
        </div>` : nojob ? (m.lines || []).map(l => `<p class="ln ${esc(l.tone)}">${esc(l.text)}</p>`).join('')
          + '<div class="acts"><button class="btn primary" data-role="read">Read this page now</button></div>'
          : '<p class="ln" data-role="ats-none">No ATS report for this job yet.</p>'}
        <div class="say" data-role="say" aria-live="polite"></div>
      </div>`;
    if (card) { const cardHost = atsRoot.querySelector('[data-role="ats-card"]'); try { ATS.mountAtsReport(cardHost, m.report.report, {}); } catch { cardHost?.remove(); } }
  };

  // ── the Résumé tab: the generation's state, a preview, Attach ──
  const draw = () => {
    host.dataset.state = m.state;
    host.dataset.id = m.id || '';
    dock.summary('resume', `Résumé · ${m.state === 'generating' ? 'generating…' : m.state === 'attached' ? 'attached' : m.state === 'ready' ? 'ready' : m.title}`);
    const lines = (m.lines || []).map(l => `<p class="ln ${esc(l.tone)}">${esc(l.text)}</p>`).join('');
    const prog = m.progress ? `<div class="prog" data-role="progress"><span>${esc(m.progress.label)}</span> · <span data-role="elapsed">${elapsed(m.progress.startedAt)}</span>
      <div class="pb" aria-hidden="true"><i></i></div></div>` : '';
    const marks = [];
    if (m.score) marks.push(`<span class="mark info" data-role="score">ATS ${esc(m.score.before ?? '–')} → ${esc(m.score.after ?? '–')}</span>`);
    if (m.state === 'attached') marks.push('<span class="mark ok" data-role="attached-mark">attached ✓</span>');
    if (m.state === 'refused') marks.push('<span class="mark no">withheld — nothing attached</span>');
    const reasons = m.reasons?.length ? `<ul class="list" data-role="reasons">${m.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    const findings = m.findings?.length ? `<div class="note">Worth a look:</div><ul class="list" data-role="findings">${m.findings.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '';
    const actions = (m.actions || []).map(a => `<button class="btn${a.primary ? ' primary' : ''}" data-role="${esc(a.role)}">${esc(a.label)}</button>`).join('');
    const showsEdit = (m.actions || []).some(a => a.role === 'edit');
    panel.innerHTML = `
      <div class="hd">
        <div class="t" data-role="title">${esc(m.title)}</div>
        ${m.job ? `<div class="s" data-role="job">${esc(m.job)}</div>` : ''}
      </div>
      <div class="sc">
        ${lines}${prog}
        ${marks.length ? `<div class="marks">${marks.join('')}</div>` : ''}
        ${m.changes ? `<p class="ln" data-role="changes">${esc(m.changes)}</p>` : ''}
        ${m.guard ? `<div class="guard" data-role="guard">${esc(m.guard.text)}</div>` : ''}
        ${findings}${reasons}
        ${m.preview ? '<div class="pvw" data-role="preview-wrap"><div class="pv" data-role="preview"></div></div>' : ''}
      </div>
      <div class="ft">
        <div class="acts">${actions}</div>
        ${showsEdit ? `<div class="note" data-role="edit-note">${esc(meta?.editNote || '')}</div>` : ''}
        <div class="say" data-role="say" aria-live="polite"></div>
      </div>`;
    if (m.preview?.html) { const pv = root.querySelector('[data-role="preview"]'); try { fillPreview(pv, m.preview.html); } catch { pv.textContent = 'The preview could not be shown.'; } }
    drawAts();
  };

  const sayIn = (r, text, warn = false) => { const el = r.querySelector('[data-role="say"]'); if (el) { el.className = `say${warn ? ' warn' : ''}`; el.textContent = text; } };
  const schedule = () => {
    clearTimeout(pollTimer); clearInterval(tick);
    if (m.progress) tick = setInterval(() => { const e = root.querySelector('[data-role="elapsed"]'); if (e) e.textContent = elapsed(m.progress.startedAt); }, 1000);
    if (!m.poll || !m.id) return;
    pollTimer = setTimeout(async () => {
      if (!host.isConnected) return;
      const reply = await send({ type: 'RESUME_STATUS', id: m.id });
      if (!host.isConnected) return;
      if (reply?.model) { m = { ...reply.model, report: reply.model.report ?? m.report }; draw(); }
      schedule();
    }, meta?.pollMs || 2000);
  };
  const take = (r, reply, fallback) => {
    // the report is asked for when the panel opens; a later model (a status, a cancel) keeps it
    if (reply?.model) m = { ...reply.model, report: reply.model.report ?? (reply.model.state === 'nojob' ? null : m.report) };
    draw(); schedule();
    if (!reply?.ok) sayIn(r, reply?.message || fallback, true);
  };

  const download = async (r) => {
    const name = m.fileName || 'resume.pdf';
    let copied = false;
    try { await navigator.clipboard.writeText(name); copied = true; } catch { /* said below */ }
    let b64 = m.download?.base64 || null;
    if (!b64) {
      const got = await send({ type: 'RESUME_DOWNLOAD', id: m.id });
      b64 = got?.base64 || null;
      if (!b64) { sayIn(r, got?.message || 'The PDF could not be downloaded right now — try again.', true); return; }
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    r.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    host.dataset.downloaded = name;
    sayIn(r, `Downloaded ${name}${copied ? ' — its name is copied' : ''}. Now ${meta?.dragHint || 'drag it onto the upload box'}.`);
  };

  const onClick = (r) => async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const role = btn.dataset.role;
    // ⛔ Everything here reaches draft's server or the page: a page script's synthetic click is never enough.
    if (!ev.isTrusted) return;
    if (role === 'download') return download(r);
    btn.disabled = true;
    const say = (t, w) => sayIn(r, t, w);
    // ⭐ T22 REVISED: no Generate / Regenerate here — this tab is a view; nothing in it starts a résumé.
    if (role === 'cancel') { say('Cancelling…'); return take(r, await send({ type: 'RESUME_CANCEL', id: m.id }), 'Could not cancel — try again.'); }
    if (role === 'attach') { say('Attaching…'); return take(r, await send({ type: 'RESUME_ATTACH', id: m.id }), 'Could not attach — try Download PDF.'); }
    if (role === 'edit') { const got = await send({ type: 'RESUME_OPEN_EDITOR', id: m.id }); btn.disabled = false; if (!got?.ok) say(got?.message || 'Could not open draft.', true); else say('Opened in a new tab.'); }
    if (role === 'read') { say('Reading this page…'); return take(r, await send({ type: 'RESUME_READ_PAGE', trigger: 'click' }), 'Could not reach draft — try again.'); }
    if (role === 'report' || role === 'add-resume') {
      const got = await send({ type: 'RESUME_OPEN_REPORT', to: role === 'report' ? 'report' : 'resume' }); btn.disabled = false;
      if (!got?.ok) say(got?.message || 'Could not open draft.', true); else say('Opened in a new tab.');
    }
  };

  host.__draftCleanup = cleanup;
  atsHost.__draftCleanup = () => {};
  root.addEventListener('click', (ev) => { void onClick(root)(ev); });
  atsRoot.addEventListener('click', (ev) => { void onClick(atsRoot)(ev); });
  draw();
  schedule();
  dock.restorePops?.('resume');
  dock.restorePops?.('ats');
  return { ok: true, rendered: true, state: m.state, tab: want };
}

// ── the injected attach ────────────────────────────────────────────────────────────────────────────────────────
/**
 * Injected, ISOLATED world. `file`: { probe: true } only looks; { base64, fileName, mimeType } sets the PDF on the page's
 * résumé upload — an input[type=file] that accepts a PDF, the résumé's by its own words (resumeInputScore, as the fill
 * picks it), else the lone unnamed one — then `input` and `change`, and VERIFIES: the page shows the file's name (a
 * Workday drop zone's "… Successfully Uploaded!"), or the input is the browser's own visible control (which draws the
 * name itself). Anything else is not verified, and the panel falls back to Download PDF. Never a cover letter's box.
 * → { target, set, verified, how: 'page' | 'native' | null, reason, field }
 */
export async function attachResumeFile(file) {
  // ⛔ BYTE-IDENTICAL (modulo indentation) TO gated-handoff.js's exported resumeInputScore — asserted by test.
  function resumeInputScore(context) {
    const t = String(context || '').toLowerCase();
    if (/cover[\s_-]*letter|motivation|transcript|portfolio|writing sample|photo|headshot|certificat|reference|supporting|additional/.test(t)) return -1;
    if (/r[ée]sum[ée]|\bcv\b|curriculum vitae/.test(t)) return 2;
    return 0;
  }
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const acceptsPdf = (el) => {
    const acc = String(el.getAttribute('accept') || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
    return !acc.length || acc.some(a => a === '.pdf' || a === 'application/pdf' || a === '*/*' || a === 'application/*');
  };
  // ⭐ LIVE (Greenhouse, measured 10-15): the input sits FIVE boxes below its upload group (div › .secondary-button ›
  // .button-container › .file-upload__wrapper › .file-upload[role=group]) — four steps up from its parent never reached
  // the group, where the page writes the chosen file's name. The upload's own group is the wrap.
  const wrapOf = (el) => el.closest('[data-automation-id^="formField"], [data-automation-id="file-upload-drop-zone"], .field, .application-question, fieldset, .file-upload, [role="group"]') || el.parentElement;
  const contextOf = (el) => {
    const own = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
    const labelled = (el.closest('[aria-labelledby]')?.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
    const wrap = el.closest('[data-automation-id^="formField"], .field, .application-question, fieldset');
    const wrapLabel = wrap?.querySelector('label, legend, h3, h4, .ws-glabel')?.textContent || '';
    return [own, el.closest('label')?.textContent, el.getAttribute('aria-label'), el.name, el.id, el.getAttribute('data-automation-id'), labelled, wrapLabel]
      .filter(Boolean).join(' ');
  };
  const inputs = [...document.querySelectorAll('input[type="file"]')].filter(el => !el.disabled && acceptsPdf(el))
    .map(el => ({ el, score: resumeInputScore(contextOf(el)) }));
  const named = inputs.filter(i => i.score === 2);
  const neutral = inputs.filter(i => i.score === 0);
  // ⭐ T18: the review row names ITS upload (`file.target`: the probe's id / name, and the row's type). That upload is
  // taken only when it is still a PDF upload on the page and — for a résumé — not a box whose words say it is something
  // else (a cover letter's). A cover letter goes only into a box the row typed `cover_letter`.
  const t = file?.target || null;
  const targeted = t && (t.id || t.name) ? inputs.find(i => (t.id && i.el.id === t.id) || (!t.id && t.name && i.el.name === t.name)) : null;
  const byTarget = targeted && (t.kind === 'cover_letter' || targeted.score >= 0) ? targeted : null;
  const pick = byTarget || (t?.kind === 'cover_letter' ? null : named[0] || (neutral.length === 1 ? neutral[0] : null));
  const reason = pick ? null : !inputs.length ? 'no_file_input' : neutral.length > 1 ? 'ambiguous_file_inputs' : 'no_resume_input';
  const field = pick ? contextOf(pick.el).replace(/\s+/g, ' ').trim().slice(0, 80) : null;
  if (file?.probe || !pick) return { target: !!pick, set: false, verified: false, how: null, reason, field };

  const el = pick.el;
  try {
    const bin = atob(file.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], file.fileName, { type: file.mimeType || 'application/pdf' }));
    el.files = dt.files;
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  } catch (e) {
    return { target: true, set: false, verified: false, how: null, reason: 'not_set', field };
  }
  const isSet = () => !!(el.files && el.files.length === 1 && el.files[0].name === file.fileName);
  const shownByPage = () => {
    for (let n = wrapOf(el), up = 0; n && up < 4; n = n.parentElement, up++) {
      if (String(n.innerText || n.textContent || '').includes(file.fileName)) return true;
    }
    return false;
  };
  const nativeVisible = () => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return r.width >= 40 && r.height >= 10 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.5;
  };
  const t0 = Date.now();
  let how = null;
  // ⭐ (open item 2) Look AFTER the last wait, not only before it: the loop used to stop on the clock without looking again,
  // so on a busy machine — one 100 ms sleep returning seconds late, while the page drew the name — an attach the page
  // showed was called "not shown" and the panel fell back to Download PDF. Now the deadline is checked only after a look.
  for (;;) {
    if (shownByPage()) { how = 'page'; break; }
    if (isSet() && nativeVisible()) { how = 'native'; break; }
    if (Date.now() - t0 >= 2500) break;
    await sleep(100);
  }
  const set = isSet() || how === 'page';
  return { target: true, set, verified: !!how, how, reason: how ? null : set ? 'not_shown' : 'not_set', field };
}

// ── the service worker's side ──────────────────────────────────────────────────────────────────────────────────
const json = (serverUrl, path, init) => authedFetch(serverUrl, path, init)
  .then(async (res) => (res ? { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) } : { ok: false, status: 401, body: { error: 'Sign in to draft first.', code: 'not_signed_in' } }))
  .catch(() => ({ ok: false, status: 0, body: { error: 'Could not reach draft.', code: 'unreachable' } }));
const post = (serverUrl, path, body) => json(serverUrl, path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const ID_RE = /^erg_[a-f0-9]{8,64}$/;
const viewPath = (id) => `/api/extension/resume/${encodeURIComponent(id)}`;
/** ⭐ T18: the account's base résumé as a PDF (routes/extensionResume.js) — and whether there is one. */
export const BASE_RESUME_PDF = '/api/extension/base-resume/pdf/file';
export const BASE_RESUME_INFO = '/api/extension/base-resume';

async function activeTab() {
  try { return (await chrome.tabs.query({ active: true, currentWindow: true }))[0] || null; } catch { return null; }
}

/** The tab's job: its released packet, else its binding (answerMemory.js tabJob — one rule), with the binding's words. */
async function jobOfTab(tab) {
  const j = await tabJob(tab).catch(() => ({ jobId: null }));
  if (j?.jobId == null) return null;
  const b = await bindingForTab(tab).catch(() => null);
  const same = b && String(b.jobId) === String(j.jobId);
  return { jobId: String(j.jobId), title: same ? b.title : null, company: (same ? b.company : null) || j.company || null };
}

async function allowanceNow(serverUrl) {
  const r = await json(serverUrl, '/api/draft/slots');
  return r.ok ? { used: r.body.used, limit: r.body.limit, remaining: r.body.remaining } : null;
}

/** The view of THIS tab's job's generation, or null — the id is the tab's own record's, never the message's alone. */
async function currentView(serverUrl, job) {
  const rec = await resumeFor(job?.jobId);
  if (!rec?.id) return { rec: null, view: null };
  const r = await json(serverUrl, viewPath(rec.id));
  if (r.ok && r.body?.id === rec.id) { if (r.body.status !== rec.status) await noteResume(job.jobId, { status: r.body.status }); return { rec, view: r.body }; }
  return { rec, view: null, error: r.status === 404 ? null : r.body };
}

/**
 * ⭐ T9 · the web app's ATS component (extension/atsReport.js — shared/atsReportElement.js, bundled) goes into the
 * page's isolated world before a model that carries a report is drawn. A file of the extension's own (no remote code),
 * injected only when there is a report to draw; if it cannot be, the panel shows the summary lines, as before.
 */
async function withAtsComponent(tab, model) {
  if (model?.report?.report && tab?.id != null) {
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['atsReport.js'] }); } catch { /* the summary stands */ }
  }
  return model;
}

/** ⭐ T18: the upload a review row names — its id / name and type, nothing else of the message is trusted. */
const targetOf = (msg) => {
  const t = msg?.target;
  if (!t || typeof t !== 'object') return null;
  const s = (v) => (typeof v === 'string' && v.length <= 200 ? v : null);
  return { id: s(t.id), name: s(t.name), kind: ['resume', 'cover_letter', 'other'].includes(t.kind) ? t.kind : 'resume' };
};
/** attachResumeFile, injected into the tab's FORM frame (the top frame until a fill found the form elsewhere). */
async function injectAttach(tabId, args) {
  return (await chrome.scripting.executeScript({ target: { tabId, frameIds: [formFrameOf(tabId)] }, func: attachResumeFile, args: [args] }))?.[0]?.result || null;
}

const meta = async () => ({ theme: await overlayTheme(), paper: { bg: C_LIGHT.SURFACE_SOLID, ink: C_LIGHT.INK },
  pollMs: POLL_MS, editNote: EDIT_NOT_RECHECKED, dragHint: DRAG_HINT });

/** The router's handlers. `serverUrl` defaults to the one configureResumePanel set. */
export function handlersFor(serverUrl = null) {
  const url = () => serverUrl || SERVER_URL;
  // The PAGE a panel message came from — a web page's tab. The popup has no tab; the extension's own pages (Options)
  // have one, but it is not an application page, so neither counts as "the panel's click".
  const tabOf = (sender) => (sender?.tab?.id != null && /^https?:/.test(String(sender.tab.url || '')) ? sender.tab : null);
  const refuse = (message, extra = {}) => ({ ok: false, message, ...extra });
  /** D99 J12: draft's report for the tab's job — asked of draft's server each time the panel opens, never stored. */
  const reportFor = async (job) => {
    if (!job?.jobId || !url()) return null;
    const found = await lookupBoardJob(url(), job.jobId).catch(() => null);
    return found?.ok ? found.ats : null;
  };

  /** The tab's job and the generation the message names — which must be the tab's own job's current one. */
  async function scope(msg, sender) {
    const tab = tabOf(sender);
    if (!tab) return { error: refuse('Open the résumé panel on the application page.') };
    if (!url()) return { error: refuse('Not configured.') };
    const job = await jobOfTab(tab);
    if (!job) return { error: { ok: false, message: 'This tab is not linked to a job.', model: resumePanelModel({}) } };
    const { rec, view, error } = await currentView(url(), job);
    if (msg?.id != null && (!ID_RE.test(String(msg.id)) || rec?.id !== msg.id)) return { error: refuse('That is not this job’s résumé.', { model: resumePanelModel({ job, view, error }) }) };
    return { tab, job, rec, view, error };
  }

  return {
    /** Open (or refresh) the ATS and Résumé tabs — from Open dock / the context menu (the active tab), the dock's own tab
     *  press, or the review row's "See the Résumé tab". Starts nothing. */
    // ⭐ T17: the dock's ATS and Résumé tabs (`msg.tab`: 'ats' | 'resume' — which one to show), drawn in the TOP frame.
    RESUME_PANEL_OPEN: async (msg, sender) => {
      if (!url()) return refuse('Not configured.');
      const tab = tabOf(sender) || await activeTab();
      if (!tab?.id) return refuse('Open the application page first.');
      const job = await jobOfTab(tab);
      const { view, error } = job ? await currentView(url(), job) : { view: null };
      const allowance = job && !view ? await allowanceNow(url()) : null;
      const model = resumePanelModel({ job, view, allowance, error, report: await reportFor(job) });
      await withAtsComponent(tab, model);
      try {
        const r = await drawInDock(tab.id, renderResumePanel, [model, { ...(await meta()), dock: await dockMeta(tab), tab: msg?.tab === 'ats' ? 'ats' : 'resume' }]);
        return { ok: !!r?.rendered, state: model.state };
      } catch (e) {
        // No grant for this tab (the popup was not opened on it), or a page that takes no script (chrome://, a PDF).
        return refuse("draft can't draw the résumé panel on this page.", { reason: String(e?.message || e).slice(0, 160) });
      }
    },

    /**
     * ⛔ The ONE start — a click from the page's tab, never the popup. ⭐ T22 REVISED: no control sends it yet; T24 (the
     * Draft button) and T18 (the résumé row's "Generate and attach") are the two that will.
     */
    RESUME_GENERATE: async (msg, sender) => {
      if (msg?.trigger !== 'click') return refuse('A résumé is generated only from its button.');
      const tab = tabOf(sender);
      if (!tab) return refuse('Generate from the résumé panel on the application page.');
      if (!url()) return refuse('Not configured.');
      const job = await jobOfTab(tab);
      if (!job) return { ok: false, model: resumePanelModel({}) };
      const regenerate = msg.regenerate === true;
      const r = await post(url(), '/api/extension/resume', { boundJobId: job.jobId, trigger: 'click', ...(regenerate ? { regenerate: true } : {}) });
      if (!r.ok || !ID_RE.test(String(r.body?.id || ''))) {
        return { ok: false, message: r.body?.error || 'Résumé generation is unavailable right now.', model: resumePanelModel({ job, error: r.body, allowance: r.body?.allowance || null }) };
      }
      await noteResume(job.jobId, { id: r.body.id, status: r.body.status, title: job.title, company: job.company });
      return { ok: true, model: resumePanelModel({ job, view: r.body, warning: r.body.warning || null }) };
    },

    /** The panel's poll while it generates. */
    RESUME_STATUS: async (msg, sender) => {
      const s = await scope(msg, sender);
      if (s.error) return s.error;
      return { ok: !!s.view, model: resumePanelModel({ job: s.job, view: s.view, error: s.error }) };
    },

    RESUME_CANCEL: async (msg, sender) => {
      const s = await scope(msg, sender);
      if (s.error) return s.error;
      const r = await post(url(), `${viewPath(s.rec.id)}/cancel`);
      const view = r.ok ? r.body : r.body?.generation || s.view;
      if (view?.status) await noteResume(s.job.jobId, { status: view.status });
      return { ok: r.ok, message: r.ok ? null : r.body?.error, model: resumePanelModel({ job: s.job, view }) };
    },

    /**
     * Attach: ⛔ only a generation the server says is READY (asked now). The page is probed for a résumé upload first;
     * then the server stores the PDF as this application's (attach: true), the bytes come from draft's server, and the
     * page's control is set and VERIFIED. Not verified → the fallback, with the bytes for Download PDF.
     */
    RESUME_ATTACH: async (msg, sender) => {
      const s = await scope(msg, sender);
      if (s.error) return s.error;
      if (s.view?.status !== 'ready') return { ok: false, message: 'Only a ready résumé can be attached.', model: resumePanelModel({ job: s.job, view: s.view }) };
      // ⭐ T18: into the FORM's frame (T11 — Greenhouse's iframe on a company's page), and into the upload the review
      // row names when it was pressed there (`msg.target`).
      const inject = (args) => injectAttach(s.tab.id, { ...args, target: targetOf(msg) });
      let probe;
      try { probe = await inject({ probe: true }); } catch { probe = null; }
      const r = await post(url(), `${viewPath(s.rec.id)}/pdf`, probe?.target ? { attach: true } : {});
      const pdfUrl = r.body?.pdf?.url;
      if (!r.ok || typeof pdfUrl !== 'string' || !pdfUrl.startsWith('/api/extension/resume/')) {
        return { ok: false, message: r.body?.error || 'The PDF could not be made right now.', model: resumePanelModel({ job: s.job, view: s.view }) };
      }
      const fileName = r.body.pdf.fileName;
      const pdf = await fetchPdf(url(), pdfUrl, fileName);
      if (!pdf) return { ok: false, message: 'The PDF could not be fetched right now.', model: resumePanelModel({ job: s.job, view: s.view }) };
      if (!probe?.target) {
        // No upload box on this step (or the page could not be reached): nothing is set — said, with the file to download.
        return { ok: true, model: resumePanelModel({ job: s.job, view: s.view, attach: { outcome: probe ? 'noinput' : 'fallback', fileName: pdf.fileName, base64: pdf.base64, reason: probe?.reason || 'no_access' } }) };
      }
      let set;
      try { set = await inject({ base64: pdf.base64, fileName: pdf.fileName, mimeType: 'application/pdf' }); } catch { set = { verified: false, reason: 'not_set' }; }
      await noteResume(s.job.jobId, { attached: Date.now() });
      const outcome = set?.verified ? 'attached' : 'fallback';
      const view = { ...s.view, pdf: { ...(s.view.pdf || {}), fileName: pdf.fileName, attached: true } };
      return { ok: true, attached: outcome === 'attached', how: set?.how || null,
        model: resumePanelModel({ job: s.job, view, attach: { outcome, fileName: pdf.fileName, reason: set?.reason || null, ...(outcome === 'fallback' ? { base64: pdf.base64 } : {}) } }) };
    },

    /**
     * ⭐ T18 · "Attach my résumé" on the review row's résumé upload: the account's BASE résumé, as draft renders it
     * (GET /api/extension/base-resume/pdf/file — no model, no Draft slot), set on THAT upload in the form's frame by the
     * same attachResumeFile and VERIFIED; when the page does not show its name, the bytes come back for Download PDF.
     * ⛔ The click's own message only (`trigger: 'click'`, from the page's tab). `which: 'letter'` — draft keeps no cover
     * letter the extension can reach yet, so it is said, and nothing is attached.
     */
    RESUME_ATTACH_FILE: async (msg, sender) => {
      if (msg?.trigger !== 'click') return refuse('A file is attached only from its button.');
      const tab = tabOf(sender);
      if (!tab) return refuse('Attach it from the review panel on the application page.');
      if (!url()) return refuse('Not configured.');
      if (msg.which !== 'base') return refuse('draft holds no cover letter for this job — attach one on the page.');
      const target = targetOf(msg);
      let probe;
      try { probe = await injectAttach(tab.id, { probe: true, target }); } catch { probe = null; }
      const pdf = await fetchPdf(url(), BASE_RESUME_PDF, 'Resume.pdf');
      if (!pdf) return refuse('Your résumé could not be fetched — add one in draft, or attach it on the page yourself.');
      if (!probe?.target) return { ok: true, attached: false, attach: { outcome: 'fallback', fileName: pdf.fileName, base64: pdf.base64, reason: probe?.reason || 'no_access' } };
      let set;
      try { set = await injectAttach(tab.id, { base64: pdf.base64, fileName: pdf.fileName, mimeType: 'application/pdf', target }); } catch { set = { verified: false, reason: 'not_set' }; }
      const outcome = set?.verified ? 'attached' : 'fallback';
      return { ok: true, attached: outcome === 'attached', how: set?.how || null,
        attach: { outcome, fileName: pdf.fileName, reason: set?.reason || null, ...(outcome === 'fallback' ? { base64: pdf.base64 } : {}) } };
    },

    /** Download PDF (the fallback, or any time once ready): the stored PDF's bytes and name. */
    RESUME_DOWNLOAD: async (msg, sender) => {
      const s = await scope(msg, sender);
      if (s.error) return s.error;
      if (s.view?.status !== 'ready') return refuse('Only a ready résumé can be downloaded.');
      const r = await post(url(), `${viewPath(s.rec.id)}/pdf`, {});
      const pdfUrl = r.body?.pdf?.url;
      if (!r.ok || typeof pdfUrl !== 'string' || !pdfUrl.startsWith('/api/extension/resume/')) return refuse(r.body?.error || 'The PDF could not be made right now.');
      const pdf = await fetchPdf(url(), pdfUrl, r.body.pdf.fileName);
      return pdf ? { ok: true, base64: pdf.base64, fileName: pdf.fileName } : refuse('The PDF could not be fetched right now.');
    },

    /**
     * ⭐ D99 · "Read this page now" — the unlinked panel's button (a trusted click on the page). ⭐ BINDING FIRST (owner
     * 10-15): the same IDENTIFY → BIND every press runs (identify.js identifyAndBind — the address, the embedded ATS form's
     * address, then the page's text through the capture's matcher), and only then is the panel drawn for the job it
     * found. A page that names no job of yours binds nothing and says which case it is, in that outcome's own sentence.
     */
    RESUME_READ_PAGE: async (msg, sender) => {
      if (msg?.trigger !== 'click') return refuse('The page is read only from its button.');
      const tab = tabOf(sender);
      if (!tab) return refuse('Read the page from the panel on it.');
      if (!url()) return refuse('Not configured.');
      const pageUrl = String(tab.url || '').slice(0, 2048);
      const id = await identifyAndBind(tab, { serverUrl: url() }).catch(() => null);
      const page = id?.lookup || null;
      const job = await jobOfTab(tab);
      notePageRead(tab.id, { url: pageUrl, known: !!job, jobId: job?.jobId ?? null, how: page?.posting?.how || null,
        pageKey: null, basis: page?.basis || null, atsState: page?.ats?.state || null });
      if (!job) {
        const report = page?.basis === 'page' && page.ats ? { ...page.ats, basis: 'page' } : null;
        return { ok: false, message: id?.message || "draft couldn't tell which job this is.", model: await withAtsComponent(tab, resumePanelModel({ report })) };
      }
      const { view, error } = await currentView(url(), job);
      const allowance = !view ? await allowanceNow(url()) : null;
      return { ok: true, model: await withAtsComponent(tab, resumePanelModel({ job, view, allowance, error, report: await reportFor(job) })) };
    },

    /** The report's "Full report in draft" (the job in the web app) or "Add your résumé in draft" (job profiles). */
    RESUME_OPEN_REPORT: async (msg, sender) => {
      const tab = tabOf(sender);
      if (!tab) return refuse('Open the résumé panel on the application page.');
      if (!url()) return refuse('Not configured.');
      let path = '/app/job-profiles';
      if (msg?.to === 'report') {
        const job = await jobOfTab(tab);
        if (!job) return refuse('This tab is not linked to a job.');
        const found = await lookupBoardJob(url(), job.jobId);
        path = found.ok && found.job.reportPath ? found.job.reportPath : `/app/jobs?job=${encodeURIComponent(job.jobId)}`;
      }
      try { await chrome.tabs.create({ url: `${url()}${path}` }); return { ok: true }; } catch { return refuse('Could not open draft.'); }
    },

    /** Edit in a full page: the server's openUrl for this job, on draft's own site, in a new tab. */
    RESUME_OPEN_EDITOR: async (msg, sender) => {
      const s = await scope(msg, sender);
      if (s.error) return s.error;
      const path = s.view?.openUrl;
      if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return refuse('Could not open draft.');
      try { await chrome.tabs.create({ url: `${url()}${path}` }); return { ok: true }; } catch { return refuse('Could not open draft.'); }
    },
  };
}

/** The contract the wiring guide names: one object of handlers, bound to the configured server URL. */
export const handlers = handlersFor();
