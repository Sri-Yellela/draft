// ── D33: WHAT A CAPTURE TELLS YOU — the server's words, shown as given ───────────────────────────
//
// The owner captured a posting, this extension said "Captured", and the job was not on the board.
// The server HAD said why (attachedToExisting, outOfMarket) and the extension read neither: it
// worded every 200 as "Captured: <title>". That is silence reported as success.
//
// Since v1.4.0 the server answers one `capture` object worded in one place
// (services/jobs/captureOutcome.js): inserted · attached to a posting draft already had (with a
// link to it) · held off the board, and why · closed. This turns the HTTP answer into the result
// the toast and the popup show, and it does not word the outcome itself.
//
//   ⛔ A 2xx that does not say where the job went is NOT reported as a capture.
//
// Pure: no chrome.*, no DOM, no network — imported by background.js and by the tests.

export const OUTCOMES_ON_BOARD = Object.freeze(['inserted', 'attached']);

/**
 * @param {number} status   the HTTP status
 * @param {object} json     the parsed body ({} when it did not parse)
 * @param {string} serverUrl the site, to make the job's link absolute
 * @returns {{ success: boolean, outcome: string|null, onBoard: boolean, message: string,
 *             link: string|null, jobId: string|null }}
 */
export function captureResultFrom(status, json, serverUrl) {
  const body = json && typeof json === 'object' ? json : {};
  const fail = (message) => ({ success: false, outcome: null, onBoard: false, message, link: null, jobId: null });

  if (status === 401) return fail('Sign in to draft first');
  if (body.needsClientCapture) return fail(body.message || 'Could not read this job automatically');
  if (status < 200 || status >= 300) return fail(body.error || `Capture failed (${status})`);

  const c = body.capture;
  if (!c || typeof c.message !== 'string' || !c.jobId) {
    // ⛔ Never silence as success: the server answered 2xx without saying where the job went.
    return fail(body.message
      ? `draft answered: ${body.message}`
      : 'draft answered without saying where this job went — check ★ Saved on your jobs board.');
  }
  return {
    success: true,
    outcome: c.outcome || null,
    onBoard: c.onBoard === true,
    message: c.message,
    // Only ever a path on draft itself: a protocol-relative "//host" would leave the site.
    link: typeof c.link === 'string' && /^\/(?!\/)/.test(c.link) ? `${serverUrl}${c.link}` : null,
    jobId: c.jobId,
  };
}
