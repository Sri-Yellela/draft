// ── ⭐ BINDING FIRST (owner 10-15) · WHICH JOB IS THIS PAGE — asked, and bound, BEFORE anything else ─────────────────
//
// The owner: "manual read on a new job seems logical but how would we even know if it's on the board if it is manual,
// so that has to be the first thing, binding and then the rest. and it has to work flawlessly."
//
// Every press on a page draft has not seen — Read this page (background.js popupContext) and Fill (tabState.js
// runFillChain, on an address the bound job is not known at) — runs THIS first:
//   IDENTIFY  the page's address → the address of the ATS form it embeds (T11's frame; ≤ 3, ATS hosts only) → only when
//             neither names a job, the page's text through the capture's own matcher (POST /api/extension/page)
//   BIND      the tab (tabBinding.js, via 'recognised') and the job's progress record: "Page read" and this address, so
//             a new tab on it binds at once (T14)
// and ONLY THEN may anything prepare, score or fill. Each outcome has its own sentence and its next action:
//   mine          on your board                         → bind · go on
//   on_board      a live board job, not yet yours       → bind · go on (Prepare honours the bound board job — D99)
//   not_on_board  a posting draft does not hold (or one no longer live) → nothing bound · ONE button: Capture
//   not_a_job     the page was read and is no posting   → nothing bound · nothing prepared
//   unread        nothing could be read, the address names nothing → nothing bound · nothing prepared
//   signed_out · unavailable                            → nothing bound · nothing prepared
// ⛔ A failed identify binds nothing and prepares nothing. ⛔ Consent is unchanged: this runs only inside a press (the
// press's activeTab grant reads the page); opening the popup never calls it (D23). The text is sent only when the
// address and the frame name nothing — no wider than "Read this page" sent before.

import { lookupPage } from './boardJob.js';
import { bindTab, bindingLabel } from './tabBinding.js';
import { noteContext } from './progress.js';
import { extractJobPayload } from './extractor.js';
import { atsFramesOf } from './gated-handoff.js';

export const OUTCOMES = Object.freeze(['mine', 'on_board', 'not_on_board', 'not_a_job', 'unread', 'signed_out', 'unavailable']);
/** The outcomes that bind the tab — every other one binds nothing and prepares nothing. */
export const BINDS = Object.freeze(['mine', 'on_board']);
/** The outcomes that mean "draft could not ask" — they stop a press even on a bound tab. */
export const STOPS = Object.freeze(['signed_out', 'unavailable']);

const labelOf = (j) => bindingLabel(j);

/**
 * The server's answer → the outcome, its one sentence and its one next action — pure.
 * → { outcome, bind, job: { jobId?, title, company } | null, message, action: 'fill' | 'capture' | 'sign_in' | 'retry' | null }
 */
export function identityOutcome(lookup) {
  if (!lookup || lookup.ok !== true) {
    if (lookup?.error === 'signed_out') {
      return { outcome: 'signed_out', bind: false, job: null, action: 'sign_in',
               message: 'Sign in to draft to use it on this page — nothing was read or filled.' };
    }
    if (lookup?.error === 'bad_page') {
      return { outcome: 'not_a_job', bind: false, job: null, action: null, message: 'draft works on web pages only — nothing was filled.' };
    }
    return { outcome: 'unavailable', bind: false, job: null, action: 'retry',
             message: "draft couldn't be reached, so it doesn't know which job this is — nothing was filled. Try again in a moment." };
  }
  const p = lookup.posting;
  if (p?.known && (p.mine || p.onBoard)) {
    const job = { jobId: p.jobId, title: p.title, company: p.company };
    return p.mine
      ? { outcome: 'mine', bind: true, job, action: 'fill', message: `On your board — ${labelOf(job)}.` }
      : { outcome: 'on_board', bind: true, job, action: 'fill', message: `On the draft board — ${labelOf(job)}.` };
  }
  if (p?.known) {
    // (c) a job draft once held that is no longer live and was never yours: "not on the board" — Capture links the record
    const job = { jobId: p.jobId, title: p.title, company: p.company };
    return { outcome: 'not_on_board', bind: false, job, action: 'capture',
             message: `${labelOf(job)} is no longer on the draft board — Capture adds it to your jobs.` };
  }
  if (p) {
    const job = { title: p.title, company: p.company };
    return { outcome: 'not_on_board', bind: false, job, action: 'capture',
             message: `${p.title || p.company ? labelOf(job) : 'This job'} isn't on draft yet — Capture adds it to your jobs.` };
  }
  // ⭐ T32: the page could not be read at all — no grant on this site (executeScript refused). Not "not a job": said as
  // what it is, with the one thing that fixes it.
  if (lookup.kind === 'no_access') {
    return { outcome: 'no_access', bind: false, job: null, action: 'allow',
             message: "draft isn't allowed to read this site yet — nothing was read." };
  }
  if (lookup.kind === 'not_a_job') {
    return { outcome: 'not_a_job', bind: false, job: null, action: null,
             message: "This page doesn't look like a job posting or an application — nothing was filled." };
  }
  return { outcome: 'unread', bind: false, job: null, action: null, message: "draft couldn't read this page — nothing was filled." };
}

/**
 * ⭐ T32 · A READ THAT DID NOT FIND YOUR JOB IS A POPUP WITH ITS REASON — never a silent "!" (T26 removed the words from
 * the dock; it must never remove the reason). ONE line (the outcome's sentence and its code), at most two buttons —
 * the one thing that fixes it, and Details (Settings → Developer details, T6). Pure: the service worker builds it and the
 * panel shows it (popup-layer.js). null for an outcome that bound a job — nothing failed.
 *   no_access     Allow on this site · Details        not_on_board  Capture · Draft (the toolbar press's own question)
 *   signed_out    Sign in                             not_a_job / unread / unavailable / script_error  Retry · Details
 */
export const READ_FAILURE_CODES = Object.freeze(['no_access', 'not_a_job', 'unread', 'unavailable', 'signed_out', 'script_error', 'not_on_board']);
export function readFailurePopup(id) {
  if (!id || id.bind) return null;
  const code = READ_FAILURE_CODES.includes(id.outcome) ? id.outcome : 'script_error';
  const text = `${id.message || "draft couldn't read this page."} (${code})`;
  const details = { id: 'details', label: 'Details — open Settings at Developer details', icon: 'info' };
  const base = { id: 'rm-draft-read', kind: 'question', icon: 'need', tone: 'need', text, data: { code } };
  if (code === 'no_access') return { ...base, actions: [{ id: 'allow-site', label: 'Allow on this site — a small window asks', word: 'Allow', primary: true }, details] };
  if (code === 'signed_out') return { ...base, icon: 'info', tone: '', actions: [{ id: 'sign-in', label: 'Sign in to draft', word: 'Sign in', primary: true }] };
  if (code === 'not_on_board') return { ...base, icon: 'info', tone: '', text: `${id.message} (${code})`,
    actions: [{ id: 'capture', label: 'Capture it — add it to your board', word: 'Capture', primary: true },
      { id: 'draft', label: 'Draft it — add it and queue its résumé', word: 'Draft' }] };
  return { ...base, actions: [{ id: 'retry', label: 'Read this page again', icon: 'read', primary: true }, details] };
}

/** What a caller may pass on (to the popup): the outcome, its sentence and its action — no page text, no address. */
export function identityView(id) {
  if (!id) return null;
  return { outcome: id.outcome, bind: !!id.bind, message: id.message || null, action: id.action || null,
           job: id.job ? { jobId: id.job.jobId ?? null, title: id.job.title ?? null, company: id.job.company ?? null } : null };
}

/** The top frame's iframes — their src only (injected; closes over nothing). */
function frameSrcsInPage() {
  return [...document.querySelectorAll('iframe[src]')].map(f => f.src).filter(s => /^https?:/i.test(s)).slice(0, 20);
}

/** The ATS frames this page embeds (≤ 3 addresses), under the press's grant — [] without one. */
async function frameUrlsOf(tab) {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: frameSrcsInPage });
    return atsFramesOf(r?.result || [], tab.url).map(f => f.url).slice(0, 3);
  } catch { return []; }
}

/**
 * The page's text, by the capture's own extractor, under the press's grant → { ran, text }: `ran` false without a grant
 * (the page could not be read); `ran` true and no text — the page was read and holds no posting.
 */
async function pageTextOf(tab) {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPayload });
    return { ran: true, text: r?.result?.ok ? r.result.text || '' : '' };
  } catch { return { ran: false, text: '' }; }
}

const webUrl = (u) => { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };

/**
 * IDENTIFY → BIND, for one press on one tab. Steps are injectable for the tests (`lookup`, `frames`, `text`).
 * → identityOutcome(…) plus `binding` (the tab's new binding, or null) and `lookup` (the server's answer, for the
 *   popup's ATS report — named fields only).
 */
export async function identifyAndBind(tab, { serverUrl, lookup = lookupPage, frames = frameUrlsOf, text = pageTextOf } = {}) {
  const url = webUrl(tab?.url);
  if (!tab?.id || !url) return { ...identityOutcome({ ok: false, error: 'bad_page' }), binding: null, lookup: null };
  const frameUrls = await frames(tab).catch(() => []);
  let answer = await lookup(serverUrl, { url, frameUrls }).catch(() => ({ ok: false, error: 'unavailable' }));
  // The address and the frame named no job: the page's own text, through the capture's matcher — read only now.
  if (answer?.ok && !answer.posting?.known) {
    const got = await Promise.resolve().then(() => text(tab)).catch(() => null);
    const read = typeof got === 'string' ? { ran: !!got, text: got } : { ran: !!got?.ran, text: got?.text || '' };
    if (read.text) answer = await lookup(serverUrl, { url, frameUrls, text: read.text }).catch(() => answer);
    // read, and the extractor found no posting on it: "not a job" — known here, so nothing more is sent
    else if (read.ran && !answer.posting) answer = { ...answer, kind: 'not_a_job' };
    // ⭐ T32: the page could not be read (no grant here) — its own code, never folded into "unread"
    else if (!read.ran && !answer.posting) answer = { ...answer, kind: 'no_access' };
  }
  const out = identityOutcome(answer);
  if (!out.bind) return { ...out, binding: null, lookup: answer?.ok ? answer : null };
  const ats = answer.ats?.state === 'ready' && Number.isFinite(answer.ats.score) ? { score: answer.ats.score, band: answer.ats.band ?? null } : null;
  const binding = await bindTab(tab, { jobId: out.job.jobId, title: out.job.title, company: out.job.company, via: 'recognised', ats })
    .catch(() => null);
  // "Page read", and this address — the job is known here now (T14: a new tab on it binds with no read).
  await noteContext({ posting: { known: true, jobId: out.job.jobId, title: out.job.title, company: out.job.company } }, binding, { url, ats });
  return { ...out, binding, lookup: answer };
}
