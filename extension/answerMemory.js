// ── D96 §4 · THE ANSWER LIFECYCLE, the extension's half (lane J4) ──────────────────────────────────────────────────
//
// The review panel (review-overlay.js) is where the candidate acknowledges a value, types one with "Remember for next
// time" ticked, or changes a remembered one. This module is the ONLY place those choices reach the server — J8's
// routes (routes/savedAnswers.js, migration 164), authenticated by the extension's own token (auth.js authedFetch):
//
//   POST /api/saved-answers/acknowledge  { question, widgetKind, options?, answer, source: you_typed | you_acknowledged, jobId? }
//        → 200 { ok, answer: row } · 422 { error: 'never_remembered', reason: consent_or_attestation | secret } · 400 / 503
//   POST /api/saved-answers/change       { question, widgetKind, options?, answer (the NEW value), jobId? }
//        → 200 { ok, stored: false, servesThisApplicationOnly: true, state: changed | unremembered, … }
//        A history row; the new value serves THIS application only; the old one stops being auto-used; storing it
//        needs a fresh acknowledge.
//   GET  /api/saved-answers/fillable?company=  → { savedAnswers: [Entry] }   (the packet's savedAnswers shape)
//
// After either write, the packet already released into the tab is given the saved answers as they stand now
// (gated-handoff.js patchPacketSavedAnswers), so the NEXT fill on this tab uses what was just acknowledged and no
// longer uses what was just changed.
//
// ⛔ Never sent: a terms / consent / privacy-notice / attestation / signature question, or a password / payment /
//   national-id one (answerKey.js neverFillableReason — the server refuses them too, 422). The job id is taken from
//   the TAB (its released packet, else its binding), never from the message. A value is sent only when the person
//   asked for it to be remembered — the panel's acknowledge, or its "Remember for next time" tick.
//
// Message handlers for the router (background.js — the coordinator wires them):
//   export const handlers = { ANSWER_ACKNOWLEDGE, ANSWER_CHANGE } — each async (msg, sender) => reply.
// The server URL is the router's (background.js RESUME_MASTER_URL); configureAnswerMemory({ serverUrl }) sets it once.

import { authedFetch } from './auth.js';
import { neverFillableReason, widgetKindOf } from './answerKey.js';
import { loadPacketForTab, patchPacketSavedAnswers } from './gated-handoff.js';
import { bindingForTab } from './tabBinding.js';

const MAX_QUESTION = 500;
const MAX_ANSWER = 2000;

let SERVER_URL = null;
/** The router's server URL — set once, at import, by background.js. */
export function configureAnswerMemory({ serverUrl } = {}) { SERVER_URL = serverUrl || null; }

const post = (serverUrl, path, body) => authedFetch(serverUrl, path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/**
 * The key fields of one question as the page shows it — what J8's key is computed from (shared/answerKey.js).
 * null when the question cannot be keyed, or is one that is never remembered.
 */
export function keyFieldsOf({ question, widgetKind, options = null } = {}) {
  const q = String(question ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION);
  const kind = widgetKindOf(widgetKind);
  if (!q || !kind) return { error: 'question_invalid' };
  const opts = Array.isArray(options)
    ? options.map(o => (o && typeof o === 'object' ? String(o.label ?? o.text ?? o.value ?? '') : String(o ?? ''))).filter(Boolean).slice(0, 100)
    : null;
  const never = neverFillableReason(q, opts);
  if (never) return { error: 'never_remembered', reason: never };
  return { question: q, widgetKind: kind, ...(opts && opts.length ? { options: opts } : {}) };
}

const answerOf = (a) => {
  const s = Array.isArray(a) ? a.join(', ') : String(a ?? '');
  return s.trim() ? s.slice(0, MAX_ANSWER) : null;
};

/** POST acknowledge. Returns the server's body ({ ok, answer } or { ok: false, error, reason? }). */
export async function acknowledgeAnswer(serverUrl, { question, widgetKind, options, answer, source = 'you_acknowledged', jobId = null }) {
  const key = keyFieldsOf({ question, widgetKind, options });
  if (key.error) return { ok: false, ...key };
  const value = answerOf(answer);
  if (value == null) return { ok: false, error: 'answer_required' };
  const res = await post(serverUrl, '/api/saved-answers/acknowledge', {
    ...key, answer: value, source: source === 'you_typed' ? 'you_typed' : 'you_acknowledged',
    ...(jobId != null ? { jobId: String(jobId) } : {}),
  }).catch(() => null);
  if (!res) return { ok: false, error: 'not_signed_in' };
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, ...body } : { ok: false, status: res.status, ...body };
}

/** POST change — the new value serves this application only; nothing is stored. */
export async function changeAnswer(serverUrl, { question, widgetKind, options, answer, jobId = null }) {
  const key = keyFieldsOf({ question, widgetKind, options });
  if (key.error) return { ok: false, ...key };
  const value = answerOf(answer);
  if (value == null) return { ok: false, error: 'answer_required' };
  const res = await post(serverUrl, '/api/saved-answers/change', {
    ...key, answer: value, ...(jobId != null ? { jobId: String(jobId) } : {}),
  }).catch(() => null);
  if (!res) return { ok: false, error: 'not_signed_in' };
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, ...body } : { ok: false, status: res.status, ...body };
}

/** GET fillable — the saved answers a fill may use now, {company} expanded for this employer. null on failure. */
export async function fillableAnswers(serverUrl, company = null) {
  const q = company ? `?company=${encodeURIComponent(company)}` : '';
  const res = await authedFetch(serverUrl, `/api/saved-answers/fillable${q}`).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null);
  return Array.isArray(body?.savedAnswers) ? body.savedAnswers : null;
}

/**
 * The job and employer for the tab a panel message came from — its released packet first, else its binding.
 * Exported for the résumé panel (extension/resumePanel.js, D98): one rule for "which job is this tab on".
 */
export async function tabJob(tab) {
  const held = tab?.id != null ? await loadPacketForTab(tab.id).catch(() => null) : null;
  const bound = tab ? await bindingForTab(tab).catch(() => null) : null;
  return {
    jobId: held?.packet?.jobId ?? bound?.jobId ?? null,
    company: held?.packet?.workedHere?.company ?? bound?.company ?? null,
    held: !!held,
  };
}

async function refreshTab(serverUrl, tab, company) {
  if (tab?.id == null) return false;
  const saved = await fillableAnswers(serverUrl, company);
  return saved ? patchPacketSavedAnswers(tab.id, saved) : false;
}

/** The router's handlers. `serverUrl` defaults to the one configureAnswerMemory set. */
export function handlersFor(serverUrl = null) {
  const url = () => serverUrl || SERVER_URL;
  return {
    /** The panel's acknowledge, or a typed answer with "Remember for next time" ticked. */
    ANSWER_ACKNOWLEDGE: async (msg, sender) => {
      if (!sender?.tab?.id) return { ok: false, error: 'no_tab' };
      if (!url()) return { ok: false, error: 'not_configured' };
      const job = await tabJob(sender.tab);
      const r = await acknowledgeAnswer(url(), { ...msg, jobId: job.jobId });
      if (r.ok) r.refreshed = await refreshTab(url(), sender.tab, job.company);
      return r;
    },
    /** An edit of a filled value in the panel. Recorded as a change; the new value is not stored. */
    ANSWER_CHANGE: async (msg, sender) => {
      if (!sender?.tab?.id) return { ok: false, error: 'no_tab' };
      if (!url()) return { ok: false, error: 'not_configured' };
      const job = await tabJob(sender.tab);
      const r = await changeAnswer(url(), { ...msg, jobId: job.jobId });
      if (r.ok) r.refreshed = await refreshTab(url(), sender.tab, job.company);
      return r;
    },
    // ⭐ T17: PANEL_DOCK is gone — the review panel is the dock's Fill tab, and the dock remembers where it sits per site
    // (dockHost.js DOCK_PLACE).
  };
}

/** The contract the wiring guide names: one object of handlers, bound to the configured server URL. */
export const handlers = handlersFor();
