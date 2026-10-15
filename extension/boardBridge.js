// ── D99 J11 · THE BRIDGE — the extension's ONE declared content script, on jobsviadraft.com ONLY ───────────────────
//
// The draft website hands a job from the board to the extension, so the tab the extension opens is already bound to
// that job ("From your board") — no capture, no "Read this page". Owner, 10-14: "build the bridge".
//
//   the board's openPosting(job) ──window.postMessage { source:'draft-board', type:'OPEN_JOB', jobId, nonce }──► here
//   here ──chrome.runtime.sendMessage { type:'OPEN_JOB', jobId, via:'board' }──► boardOpen.js (the worker)
//   here ──window.postMessage { source:'draft-extension', type:'OPEN_JOB_RESULT', nonce, ok, error }──► the page
//
// ⛔ What this script does, and all it does:
//   · marks the page as having the extension (`data-draft-extension` on <html>, a per-load nonce) so the board knows
//     to hand over rather than open the link itself;
//   · forwards a JOB ID (and, ⭐ T24, the board's intent: the word 'apply' or 'view', when the page named one) — nothing
//     else is read from the message or the page, and nothing is sent to any server here.
// ⛔ Accepted only when: the message comes from this window (not a frame, not another window), from draft's own origin,
//    carries this load's nonce and a well-formed job id, and the page is handling a real click (user activation).
//    The worker re-checks the sender and the rate, and the SERVER decides whether the job is on the user's board and
//    which address the tab opens — the page never names the address.
(() => {
  if (window.top !== window || window.__draftBoardBridge) return;
  window.__draftBoardBridge = true;

  const JOB_ID_RE = /^[\w.:|@\-]{1,128}$/;
  const nonce = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2);
  document.documentElement.dataset.draftExtension = nonce;

  const reply = (n, body) => window.postMessage({ source: 'draft-extension', type: 'OPEN_JOB_RESULT', nonce: n, ...body }, location.origin);

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const d = event.data;
    if (!d || typeof d !== 'object' || d.source !== 'draft-board' || d.type !== 'OPEN_JOB') return;
    if (d.nonce !== nonce) return;                                         // not this load's page: say nothing
    if (typeof d.jobId !== 'string' || !JOB_ID_RE.test(d.jobId)) { reply(nonce, { ok: false, error: 'bad_job' }); return; }
    if (navigator.userActivation && !navigator.userActivation.isActive) { reply(nonce, { ok: false, error: 'no_click' }); return; }
    // ⭐ T24: the board's INTENT — 'apply' (its Draft / Apply) or 'view' (Open posting) — one of two words, forwarded only
    // when the page named one; anything else is dropped (the worker reads its absence as 'view').
    const intent = d.intent === 'apply' || d.intent === 'view' ? d.intent : null;
    let answered = false;
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_JOB', jobId: d.jobId, via: 'board', ...(intent ? { intent } : {}) }, (r) => {
        answered = true;
        void chrome.runtime.lastError;                                      // the worker was gone: the page opens its own link
        reply(nonce, r && r.ok ? { ok: true } : { ok: false, error: (r && typeof r.error === 'string' ? r.error : 'unavailable').slice(0, 40) });
      });
    } catch {
      if (!answered) reply(nonce, { ok: false, error: 'unavailable' });   // the extension was reloaded under the page
    }
  });
})();
