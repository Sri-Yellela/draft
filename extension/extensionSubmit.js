// extension/extensionSubmit.js — ⭐ A207 (a) (46l, owner 11-13: "Make the extension path the primary submit for ATS boards
// that flag server submissions. Draft fills everything, you press one button in the extension, it submits from your browser.")
//
// Where an ATS flags draft's SERVER submit (A187: Ashby always; any family from its first spam flag, A207 (b)), the run is
// filled and held `server_submit_paused` / `flagged_spam`, and its hand-off packet carries that reason. On such a hand-off
// the review panel offers **Submit application**: the person's ONE press — a trusted click (`ev.isTrusted`) in the dock's
// TOP frame, after the panel reads Ready — presses the form's own submit button in their own browser. Then this reads the
// page the form went to and records Sent only on a confirmation (FA5: evidence, never a guess).
//
// ⛔ D36 was "the extension never submits". A207 changes it to **"the extension never submits WITHOUT the person's press"**:
// no timer, no page script's click, no batch advance, no fill ever sends. The press is checked twice — the panel drops an
// untrusted event (a page script's dispatched click is never trusted), and the service worker refuses a message that is not
// the panel's own press from the top frame of a tab holding an extension-submit packet.

export const EXTENSION_SUBMIT_REASONS = Object.freeze(['server_submit_paused', 'flagged_spam']);

/** Is this released packet one the extension sends with the person's press? */
export function isExtensionSubmitPacket(packet) {
  return EXTENSION_SUBMIT_REASONS.includes(String(packet?.gateReason ?? ''));
}

// The same words services/submitFamilies.js and services/applyAutomation.js read (kept in step by a207 tests).
export const SPAM_FLAG_SOURCE = 'flagged as (possible |potential )?spam|submission (was|has been) flagged|(marked|detected) as (possible |potential )?spam|suspicious (activity|submission)';
export const CONFIRMATION_SOURCE = "thank you|application (received|submitted|complete)|successfully (applied|submitted)|we.{0,10}ll be in touch";

/**
 * What the page says after the press. → 'flagged' · 'sent' · 'on_form' · 'unknown'
 *   flagged   the ATS's spam refusal (read FIRST — a refusal page can also say "thank you")
 *   sent      confirmation words AND the form is gone or the address moved (FA5: a form page that merely says "thank you
 *             for your interest" above its fields is not a confirmation)
 *   on_form   the submit button is still there (a required field the site wants, an error) — nothing recorded
 *   unknown   none of these (a cross-origin page the extension may not read) — the person records it with "I submitted it"
 */
export function classifyAfterPress({ before = {}, after = null } = {}) {
  if (!after) return 'unknown';
  const text = String(after.text || '');
  if (new RegExp(SPAM_FLAG_SOURCE, 'i').test(text)) return 'flagged';
  const moved = !!(before.url && after.url && stripHash(before.url) !== stripHash(after.url));
  if (new RegExp(CONFIRMATION_SOURCE, 'i').test(text) && (moved || !after.hasSubmit)) return 'sent';
  if (after.hasSubmit) return 'on_form';
  return 'unknown';
}
const stripHash = (u) => String(u).split('#')[0];

// ── page-side functions (serialised by chrome.scripting — self-contained, no closure) ────────────────────────────────

/** In the form's frame: find the strongest visible submit control (the server's classifySubmitLabel rule) and click it. */
export function pressSubmitInPage(opts) {
  const NOT = new RegExp(opts.not, 'i'), STRONG = new RegExp(opts.strong, 'i'), WEAK = new RegExp(opts.weak, 'i');
  const score = (t) => { t = String(t || '').trim(); if (!t || NOT.test(t)) return 0; if (STRONG.test(t)) return 2; if (WEAK.test(t)) return 1; return 0; };
  const seen = [];
  for (const el of document.querySelectorAll("button,input[type='submit']")) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0) || el.disabled) continue;
    const s = score(el.textContent || el.value || '');
    if (s) seen.push({ el, s, label: (el.textContent || el.value || '').trim().slice(0, 80) });
  }
  seen.sort((a, b) => b.s - a.s);
  const best = seen[0];
  if (!best) return { clicked: false, url: location.href };
  best.el.click();
  return { clicked: true, label: best.label, url: location.href, candidates: seen.length };
}
export const SUBMIT_LABEL_RULE = Object.freeze({
  not: '\\b(?:feedback|question|comment|inquiry|enquiry|filter|filters|coupon|promo|search|newsletter|subscribe|referral|refer|later|draft|withdraw|cancel|delete|remove|report)\\b',
  strong: '\\b(?:submit|send)\\b',
  weak: '^apply(?:\\s+now)?[\\s.!]*$',
});

/** In a frame: its address, its words, and whether a submit control is still showing. */
export function readResultInPage(opts) {
  const STRONG = new RegExp(opts.strong, 'i');
  let hasSubmit = false;
  for (const el of document.querySelectorAll("button,input[type='submit']")) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && STRONG.test(el.textContent || el.value || '')) { hasSubmit = true; break; }
  }
  return { url: location.href, text: String(document.body?.innerText || '').slice(0, 6000), hasSubmit };
}

// ── the orchestration (service worker) — every side effect handed in, so the tests prove what it never does ──────────

/**
 * deps: executeScript({ tabId, frameId, func, args }) → result · recordSubmitted() → { ok, message } · sleep(ms) ·
 *       waitMs (total, default 15 s) · stepMs (default 750)
 * → { ok, outcome: 'sent' | 'flagged' | 'on_form' | 'unknown' | 'no_button', message, recorded? }
 */
export async function sendWithPress({ tabId, frameId = 0, executeScript, recordSubmitted, sleep = (ms) => new Promise(r => setTimeout(r, ms)),
  waitMs = 15000, stepMs = 750 }) {
  const pressed = await executeScript({ tabId, frameId, func: pressSubmitInPage, args: [SUBMIT_LABEL_RULE] }).catch(() => null);
  if (!pressed?.clicked) {
    return { ok: false, outcome: 'no_button', message: "draft couldn't find this form's Submit button — press it on the page, then I submitted it." };
  }
  const before = { url: pressed.url };
  let outcome = 'unknown';
  for (let waited = 0; waited < waitMs; waited += stepMs) {
    await sleep(stepMs);
    // the form's frame first; after a navigation that frame may be gone, so the top frame too
    const reads = [];
    for (const f of [...new Set([frameId, 0])]) {
      const r = await executeScript({ tabId, frameId: f, func: readResultInPage, args: [SUBMIT_LABEL_RULE] }).catch(() => null);
      if (r) reads.push(r);
    }
    const verdicts = reads.map(after => classifyAfterPress({ before, after }));
    outcome = verdicts.includes('flagged') ? 'flagged' : verdicts.includes('sent') ? 'sent' : verdicts.includes('on_form') ? 'on_form' : 'unknown';
    if (outcome === 'flagged' || outcome === 'sent') break;
  }
  if (outcome === 'sent') {
    const rec = await recordSubmitted().catch(() => null);
    return { ok: true, outcome, recorded: !!rec?.ok, message: rec?.ok ? (rec.message || 'Sent — it\'s in your Submitted applications.')
      : 'Sent from your browser — the confirmation is on the page. draft could not record it; press I submitted it.' };
  }
  if (outcome === 'flagged') {
    return { ok: false, outcome, message: "The site refused this submit as possible spam, even from your browser. Nothing was recorded — try another browser or network, then press Submit on the page." };
  }
  if (outcome === 'on_form') {
    return { ok: false, outcome, message: 'The form is still open — the site may want something more. Check the page, press its Submit, then I submitted it.' };
  }
  return { ok: false, outcome, message: "Pressed. draft can't read the page it went to — if it shows a confirmation, press I submitted it." };
}
