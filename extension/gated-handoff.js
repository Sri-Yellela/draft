/**
 * Gated portal handoff — the browser half (TASK G2).
 * ---------------------------------------------------------------------------------------------
 * The candidate has crossed a gate we are not allowed to cross for them: they signed in, or they
 * solved a CAPTCHA. They are standing on the application form. They invoke the extension, and
 * everything the server prepared before they arrived lands in the form in front of them.
 *
 * See docs/GATED_HANDOFF_ARCHITECTURE.md. Three properties hold this together:
 *
 * 1. ACCESS IS GRANTED PER TAB, PER GESTURE. The manifest asks for no portal host permission and
 *    never will. `activeTab` is granted because the user invoked the extension, and G0 measured what
 *    that grant survives (§9): every same-origin navigation, including full page loads. It does NOT
 *    survive leaving the origin, or the portal opening a step in a new tab.
 *
 * 2. NOTHING PUSHES INWARD. `externally_connectable` is absent from the manifest and must stay
 *    absent. The extension PULLS the packet from our server, authenticated by its OWN sessionLess
 *    token (extension/auth.js) — never by the ambient browser cookie, which is what let it act as
 *    whoever happened to be signed in. The authorisation is a credential the extension deliberately
 *    holds, and the popup names the identity it belongs to.
 *
 * 3. TARGET MATCH BEFORE RELEASE. The packet carries a home address and work-authorization answers.
 *    It is released only onto an origin the server nominated, with a form actually present, and the
 *    match happens BEFORE the single-use token is spent — a mismatch must cost nothing, not burn the
 *    one token the packet has.
 *
 * WHAT THIS FILE NEVER DOES: cross a gate, solve a challenge, create an account, or submit. The last
 * click is the candidate's, always.
 */

import {
  orderForReview, readinessOf, renderOverlay, panelRowsForStep, panelRowsFromItems, settleStepRows, panelSummary, removeReviewPanel,
} from './review-overlay.js';
import { renderBadge, findMissingRequired, badgeDismissed } from './autofill-badge.js';
import { C_LIGHT, C_DARK } from './tokens.js';
// D55 (f): saved answers, worked-here and the EEO decline — placed by exact question equality only.
import { placeStatedAnswers, normaliseQuestion, dateParts } from './savedAnswerMatch.js';
// ⭐ D96 §4: the saved-answer key and the never-fillable guard — a byte-identical copy of shared/answerKey.js.
import { questionLabelKey, NEVER_FILL_RE, neverFillReasonOfField, isSignatureField, withoutNeverFill } from './answerKey.js';
export { neverFillReasonOfField, isSignatureField, withoutNeverFill };

// D23 — what the review overlay is painted with: the site's tokens (extension/tokens.js, generated
// from client/src/styles/colorTokens.js) and the logo face's bytes, read from the extension's own
// package (fonts/, the same file tokens.css declares). renderOverlay is serialised into the page and
// closes over nothing, so all of it travels as an argument. The font is a courtesy: if it cannot be
// read the overlay renders the same words in the fallback face.
export async function overlayTheme() {
  let logoFont = null;
  try {
    const res = await fetch(chrome.runtime.getURL('fonts/poppins-latin-800-italic.woff2'));
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      logoFont = btoa(bin);
    }
  } catch { /* fallback face */ }
  return { light: C_LIGHT, dark: C_DARK, logoFont };
}
import { authedFetch } from './auth.js';
// The tab binding: the job this tab captured or recognised, sent as a HINT the server checks (tabBinding.js).
import { bindingForTab, boundMissMessage } from './tabBinding.js';
// ⭐ D96 §3: where each application stands, remembered — counts and times only, never an answer (progress.js).
import { noteFill, notePrepared, noteSubmitted, resumeFor } from './progress.js';

/** Matches the server's token TTL. A packet outlives its grant (G0 §9), so it is cleared on purpose. */
export const PACKET_TTL_MS = 10 * 60 * 1000;

/**
 * ⛔ D56 · EVERY ADDRESS A PACKET MAY BE FILLED ON. The server states the list (the packet's expected
 * origin plus its ATS's known apply origins — www.amazon.jobs → account.amazon.jobs — from the adapter
 * table in code, never from the user). A server that predates D56 sends no list, and then the one
 * expected origin IS the list, exactly as before. This is the check that keeps a home address on the
 * application's own addresses: it is applied to the choice AND to the release.
 */
export function originsOf(p) {
  return Array.isArray(p?.origins) && p.origins.length ? p.origins : (p?.expectedOrigin ? [p.expectedOrigin] : []);
}

/** May this packet be filled on this origin? Origin in its list — nothing else widens it. */
export function packetFillsOrigin(p, origin) {
  return !!origin && originsOf(p).includes(origin);
}

const sessionKey = (tabId) => `gate:${tabId}`;

// ── Injected: phase 1, READ ONLY, isolated world ─────────────────────────────
// Runs in the default isolated world because it only needs the DOM, and the isolated world is the
// smaller blast radius. It reports the form's SHAPE and no values — deciding whether to release
// anything must not itself require handing anything over.
//
// Must be self-contained: executeScript serialises this function, so it can close over nothing.
function probeFormShape() {
  // D55 (d): Workday's application is not a <form>; its root is the apply-flow page. Looked for
  // FIRST, because a Workday page may carry an unrelated <form> (a header search) ahead of it.
  // ⛔ This line, too, must stay identical to applyPlan's.
  const form = document.querySelector('[data-automation-id="applyFlowPage"]') || document.querySelector('form');
  const scope = form || document;
  // ⛔ THIS SELECTOR AND THE FILTER BELOW MUST STAY BYTE-IDENTICAL TO applyPlan'S.
  // The plan addresses controls by POSITION, so the two functions have to enumerate the same list
  // in the same order or every step lands on the wrong element. They cannot share a constant —
  // each is serialised separately into the page by executeScript — so the duplication is
  // deliberate and has to be maintained by hand. applyPlan re-verifies identity by name/id before
  // writing, so a divergence shows up as every field reporting `field_moved` rather than as a
  // stray value, which is the safe direction to fail.
  //
  // `[role=combobox]` and `[contenteditable]` are here because Workday and react-select render a
  // div, not a <select>: those fields were invisible to the probe and so could never be filled.
  // Adding them does NOT widen what an attestation can match — matchAnswersToFields applies the
  // eligibility exact-match rule to every field uniformly, whatever its type.
  //
  // D55 (a): `button[aria-haspopup="listbox"]` is Workday's dropdown — a BUTTON, so the type filter
  // below dropped it along with every real button. It is let back in by that attribute alone; a
  // plain button (Save and Continue, Submit, Add) carries no aria-haspopup=listbox and stays out.
  const controls = [...scope.querySelectorAll(
    'input, select, textarea, [role="combobox"], [contenteditable=""], [contenteditable="true"], button[aria-haspopup="listbox"]'
  )].filter(
    el => (el.getAttribute('aria-haspopup') === 'listbox' ||
      !['hidden', 'submit', 'button', 'image', 'reset', 'password'].includes((el.type || '').toLowerCase())) &&
      !/^cc-|one-time-code|-password$/i.test(el.getAttribute('autocomplete') || '')
  );

  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return (l.textContent || '').trim();
    }
    const closest = el.closest('label');
    if (closest) return (closest.textContent || '').trim();
    return (el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
  };

  // D55 (d): is this a step of a WIZARD? Only when the page says so — a progress bar, or Workday's
  // own next-button id — so a single-page form with a stray "Next" link is never advanced. Reports
  // the step's name and whether it is the Review step: there the same button reads "Submit", and the
  // run stops.
  const nextBtn = document.querySelector('[data-automation-id="bottom-navigation-next-button"], [data-automation-id="pageFooterNextButton"]');
  const progress = document.querySelector('[data-automation-id="progressBar"], [role="progressbar"]');
  const stepName = String(
    document.querySelector('[data-automation-id="progressBarActiveStep"], [aria-current="step"]')?.textContent
    || document.querySelector('[data-automation-id="pageHeader"]')?.textContent || '').replace(/\s+/g, ' ').trim();
  const nextText = String(nextBtn?.textContent || '').replace(/\s+/g, ' ').trim();
  const wizard = nextBtn || (progress && stepName) ? {
    step: stepName.slice(0, 80),
    nextText: nextText.slice(0, 40),
    isReview: /submit/i.test(nextText) || /^review$/i.test(stepName)
      || !!document.querySelector('[data-automation-id="reviewJobApplicationPage"]'),
  } : null;

  // ⛔ D96 §7: password and payment controls are NOT in `controls` (the filter above, the same in applyPlan) — never
  // read, filled or listed. Only their PRESENCE is reported: a page with a password box is a sign-in or an account
  // page, never an application step, and the fill and the wizard both stop there (formRecognition, advanceWizard).
  const visibleEl = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const hasPassword = [...scope.querySelectorAll('input[type="password"]')].some(visibleEl);
  // D96 §7: whether a control HOLDS something — emptiness only, never the value (as findMissingRequired reads it).
  const holdsSomething = (el) => {
    const t = (el.type || '').toLowerCase();
    if (t === 'radio') return !!(el.name && scope.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`));
    if (t === 'checkbox') return el.checked === true;
    if (t === 'file') {
      const wrap = el.closest('[data-automation-id^="formField"], .field') || el.parentElement;
      return !!(el.files && el.files.length) || !!wrap?.querySelector('[data-automation-id="file-upload-successful"]');
    }
    if (el.tagName === 'INPUT' && (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list')) {
      const box = el.closest('[data-automation-id^="formField"], [role="group"], fieldset') || el.parentElement;
      return !!box?.querySelector('[data-automation-id="selectedItem"], [role="listitem"], li') || String(el.value || '').trim() !== '';
    }
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') {
      const tx = String(el.textContent || '').trim();
      return !!tx && !/^(select|choose|please|--)/i.test(tx);
    }
    return String(el.value ?? '').trim() !== '';
  };
  const groupText = (g) => {
    if (!g) return '';
    const lid = (g.getAttribute('aria-labelledby') || '').split(/\s+/)[0];
    return String((lid && document.getElementById(lid)?.textContent) || g.querySelector('legend')?.textContent
      || g.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  };
  // D96 §7: Workday's date — month / day / year inputs under one group label — is ONE question. ⚠ The part is read
  // off the automation id (D55 replica conventions, not re-measured on a live tenant), the placeholder or the label.
  const allGroups = [...scope.querySelectorAll('[role="group"], fieldset')];
  const dateGroupOf = (el) => {
    if (el.tagName !== 'INPUT' || !['text', 'tel', 'number', ''].includes((el.type || '').toLowerCase())) return null;
    const aid = el.getAttribute('data-automation-id') || '';
    const ph = (el.getAttribute('placeholder') || '').trim().toUpperCase();
    const al = (el.getAttribute('aria-label') || '').trim().toLowerCase();
    const part = /dateSectionMonth/i.test(aid) || ph === 'MM' || al === 'month' ? 'month'
      : /dateSectionDay/i.test(aid) || ph === 'DD' || al === 'day' ? 'day'
      : /dateSectionYear/i.test(aid) || ph === 'YYYY' || al === 'year' ? 'year' : null;
    if (!part) return null;
    const g = el.closest('[role="group"], fieldset');
    if (!g) return null;
    return { id: g.id || g.getAttribute('aria-labelledby') || `g${allGroups.indexOf(g)}`, label: groupText(g), part,
      aid: g.getAttribute('data-automation-id') || null };
  };

  return {
    hasForm: !!form,
    url: location.href,
    origin: location.origin,
    wizard,
    hasPassword,
    fields: controls.map((el, index) => ({
      index,
      name: el.name || null,
      id: el.id || null,
      type: (el.type || el.tagName).toLowerCase(),
      label: labelFor(el).slice(0, 200),
      // D55 (g): an asterisked label is "required" too — on many forms it is the only signal.
      required: el.required === true || el.getAttribute('aria-required') === 'true' ||
        /\*\s*$/.test(labelFor(el)) ||
        // D96 §5: a radio / checkbox GROUP says it is required on the group itself (Workday: the fieldset).
        (['radio', 'checkbox'].includes((el.type || '').toLowerCase()) &&
          el.closest('fieldset, [role="radiogroup"], [role="group"]')?.getAttribute('aria-required') === 'true') ||
        !!(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"] abbr[title="required" i]`)),
      options: el.tagName === 'SELECT'
        ? [...el.options].map(o => ({ value: o.value, text: (o.text || '').trim() })) : null,
      // D55 (f): a radio's label is its OPTION ("No"); the QUESTION is its group's legend or
      // aria-labelledby. Saved answers and worked-here are matched on the question, so it is read here.
      group: el.type === 'radio' ? (() => {
        const g = el.closest('fieldset, [role="radiogroup"]');
        if (!g) return null;
        const lid = (g.getAttribute('aria-labelledby') || '').split(/\s+/)[0];
        const t = (lid && document.getElementById(lid)?.textContent) || g.querySelector('legend')?.textContent || '';
        return t.replace(/\s+/g, ' ').trim().slice(0, 200) || null;
      })() : el.type === 'checkbox' ? (() => {
        // D96 §7: a checkbox GROUP — two or more boxes under one legend — is one question; a lone box is its label.
        const g = el.closest('fieldset, [role="group"]');
        if (!g || g.querySelectorAll('input[type="checkbox"]').length < 2) return null;
        return groupText(g) || null;
      })() : null,
      dateGroup: dateGroupOf(el),
      hasValue: holdsSomething(el),
      visible: visibleEl(el),
      // D55 (a): which custom widget this is, so the plan and the review can say "typed and picked"
      // rather than "set". A typeahead is an <input> that announces a popup list; a dropdown is a
      // non-input that does. Neither has options to report — they exist only once it is opened.
      // D55 (d): Workday names its controls by data-automation-id, not name/id — the matcher reads
      // that convention structurally (WORKDAY_FIELD_IDS), as it unwraps Greenhouse's namespacing.
      automationId: el.getAttribute('data-automation-id') || null,
      widget: el.tagName === 'INPUT' && (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list')
        ? 'typeahead'
        : (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox') && el.tagName !== 'SELECT'
          ? 'dropdown' : null,
    })),
  };
}

// ── Injected: phase 3, MAIN world ────────────────────────────────────────────
// Receives ONLY the values that already matched a field. The unmatched remainder of the packet never
// enters the page's context.
//
// MAIN rather than isolated because of the React problem: these portals track an input's value on the
// node itself, and a plain `el.value = x` from any world leaves that tracker believing nothing
// changed, so the next render puts the old value back. Assigning through the prototype's NATIVE
// setter and then dispatching input/change is what makes the change real to the framework. G0
// confirmed activeTab alone reaches the MAIN world.
async function applyPlan(plan, resume, opts) {
  const form = document.querySelector('[data-automation-id="applyFlowPage"]') || document.querySelector('form');
  const scope = form || document;
  // ⛔ MUST STAY BYTE-IDENTICAL TO probeFormShape'S. See the note there — the plan addresses
  // controls by position, so the two enumerations have to agree.
  const controls = [...scope.querySelectorAll(
    'input, select, textarea, [role="combobox"], [contenteditable=""], [contenteditable="true"], button[aria-haspopup="listbox"]'
  )].filter(
    el => (el.getAttribute('aria-haspopup') === 'listbox' ||
      !['hidden', 'submit', 'button', 'image', 'reset', 'password'].includes((el.type || '').toLowerCase())) &&
      !/^cc-|one-time-code|-password$/i.test(el.getAttribute('autocomplete') || '')
  );

  const isEditable = (el) => el.isContentEditable === true;
  // D55 (a): a TYPEAHEAD is an <input> announcing a popup list — its options do not exist until a
  // query has been typed. Checked BEFORE isCombo, which it would otherwise match.
  const isTypeahead = (el) => el.tagName === 'INPUT' &&
    (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list');
  const isCombo    = (el) => (el.getAttribute?.('role') === 'combobox' || el.getAttribute?.('aria-haspopup') === 'listbox') &&
    !('options' in el);
  const same       = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
  const sleep      = (ms) => new Promise(r => setTimeout(r, ms));
  // Polls rather than observes: a MutationObserver would need tearing down on every exit path, and
  // a listbox that never arrives must end in a bounded "no option", not a fill that hangs.
  const waitFor    = async (fn, ms = 2500, every = 50) => {
    const t0 = Date.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() - t0 > ms) return null;
      await sleep(every);
    }
  };

  // ⛔ BYTE-IDENTICAL (modulo indentation) TO THE EXPORTED closestOption BELOW. This function is
  // serialised into the page and can close over nothing, so it cannot import the tested copy;
  // test/d55Autofill.test.js asserts the two texts are the same, so the copy the page runs is the
  // copy the tests ran.
  function closestOption(want, options) {
    const STOP = new Set(['and', 'of', 'the', 'in', 'for', 'a', 'an', 'or', 'to', 'with']);
    const norm = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+#]+/g, ' ').trim();
    const toks = (s) => norm(s).split(' ')
      .filter(t => t.length > 1 && !STOP.has(t))
      .map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
    const w = norm(want);
    if (!w) return -1;
    const wt = toks(want);
    let best = -1, bestScore = 0;
    options.forEach((opt, i) => {
      const o = norm(opt);
      if (!o) return;
      let score = 0;
      if (o === w) score = 1;
      else if ((' ' + o + ' ').includes(' ' + w + ' ')) score = 0.9 - Math.min(0.2, (o.length - w.length) / 200);
      else if ((' ' + w + ' ').includes(' ' + o + ' ')) score = 0.8;
      else {
        const ot = toks(opt);
        const inter = wt.filter(t => ot.includes(t)).length;
        const union = new Set([...wt, ...ot]).size || 1;
        if (inter * 2 >= wt.length) score = 0.8 * (inter / union);
      }
      if (score > bestScore) { best = i; bestScore = score; }
    });
    if (bestScore >= 0.5) return best;
    // The last resort, and a narrow one: the want's FIRST significant word names exactly one option's
    // first word ("Bachelor of Science" -> "Bachelor's Degree"). Two candidates is a guess; refuse.
    const first = wt[0];
    if (!first) return -1;
    const hits = options.map((opt, i) => (toks(opt)[0] === first ? i : -1)).filter(i => i >= 0);
    return hits.length === 1 ? hits[0] : -1;
  }

  // The listbox a widget owns: by aria-controls / aria-owns first, then a sibling. A Workday popup is
  // rendered into a portal at the end of <body>, so the id is the only reliable way to it.
  const listFor = (el) => {
    const id = el.getAttribute('aria-controls') || el.getAttribute('aria-owns');
    return (id && document.getElementById(id))
      || el.parentElement?.querySelector('[role="listbox"]')
      || document.querySelector('[role="listbox"]');
  };
  const readyOptions = (el) => {
    const list = listFor(el);
    if (!list || list.getAttribute('aria-busy') === 'true') return null;
    const opts = [...list.querySelectorAll('[role="option"]')];
    return opts.length ? opts : null;
  };
  const dismiss = (el) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    el.blur?.();
  };

  const nativeSetter = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
                : el instanceof HTMLSelectElement   ? HTMLSelectElement.prototype
                : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;                                  // last resort, still better than nothing
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // A custom combobox (Workday, react-select) is a div — or Workday's button — with a popup listbox.
  // There is no value to assign — the widget only changes when its own option is clicked, so this
  // drives it the way a person would and then reads back what it is displaying.
  //
  // D55 (a): it WAITS for the listbox. Workday renders it into a portal a beat after the click, and
  // the old version read the list in the same breath, found nothing, and reported "not in options"
  // for a value that was there. Returns the option's own text — the ATS's wording, which is what the
  // read-back must look for — or null.
  //
  // D55 (f): two stricter modes. 'exact' — an eligibility, EEO or opt-in answer from the candidate's
  // saved answers takes only an option whose text IS the answer, never the closest one. 'decline' —
  // an EEO field the candidate declined takes the form's OWN decline option, however it is worded,
  // and nothing else; a form with none is left blank.
  // ⛔ BYTE-IDENTICAL to shared/savedAnswers.js DECLINE_OPTION_RE (serialised; cannot import it).
  const DECLINE_OPTION_RE =
    /\b(?:declin(?:e|ed|es|ing)|prefer\s+not|rather\s+not|choose\s+not|wish\s+not\s+to|(?:do\s+not|don'?t|does\s+not|doesn'?t)\s+(?:wish|want|care)\s+to|not\s+(?:to\s+)?(?:disclose|answer|say|specify|identify|self[\s-]?identify|state)|no\s+answer|undisclosed)\b/i;
  // ⭐ D96 §4 safeguard 2, for a widget whose options exist only once it is opened: the saved answer's option
  // wording (`expectNow`, set by place() from step.expectOptions) must be the wording this list shows, or it is a NEW
  // question — nothing is picked and the row asks again. ⚠ The page-side wording key approximates
  // shared/answerKey.js optionsKey (this function can import nothing); a near miss ASKS again, which is the safe way
  // to be wrong. `lastOptions` is what the list offered, so the panel can key an acknowledgement by it.
  let expectNow = null, lastOptions = null, optionsChanged = false;
  const optWord = (s) => String(s ?? '').normalize('NFKC').replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/\(\s*(?:required|optional)\s*\)/gi, ' ').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
    .replace(/^[\s*:;,.!?¿¡…–—_"'`|-]+|[\s*:;,.!?¿¡…–—_"'`|-]+$/g, '').trim();
  const PLACEHOLDER_OPT = /^(?:select(?: one| an option| an answer)?|choose(?: one| an option)?|please (?:select|choose)(?: one| an option)?|none selected|-+)$/;
  const wordingOf = (list) => JSON.stringify([...new Set(list.map(optWord).filter(w => w && !PLACEHOLDER_OPT.test(w)))].sort());
  const setCombobox = async (el, want, mode = null) => {
    el.click();
    const options = (await waitFor(() => readyOptions(el), 2500)) || [];
    const texts = options.map(o => String(o.textContent || '').replace(/[‘’ʼ]/g, "'"));
    lastOptions = texts.map(t => t.trim()).filter(Boolean).slice(0, 100);
    if (expectNow && wordingOf(texts) !== wordingOf(expectNow)) { optionsChanged = true; dismiss(el); return null; }
    const idx = mode === 'decline' ? texts.findIndex(t => DECLINE_OPTION_RE.test(t))
      : mode === 'exact' ? texts.findIndex(t => same(t, want))
      : closestOption(want, options.map(o => o.textContent || ''));
    if (idx < 0) { dismiss(el); return null; }
    const text = String(options[idx].textContent || '').trim();
    options[idx].click();
    return text;
  };

  // D55 (a): a TYPEAHEAD — type a query, wait for the portal's own results, pick the closest REAL
  // option. The ATS's vocabulary wins: a profile's "Computer Science" may only exist there as
  // "Computer and Information Sciences", and that is what gets picked and reported, never typed in.
  // Queries narrow when the full value finds nothing (most prompts search by substring): the value,
  // then its longest word, then its first.
  //
  // One want per chip for a multi-select (Skills): each is typed, confirmed and read back on its own.
  // Synthetic Enter is deliberately NOT sent — an untrusted key event submits nothing, but a page's
  // own keydown handler could, and the search runs on input anyway.
  const setTypeahead = async (el, wants) => {
    const picked = [], missed = [];
    for (const want of wants) {
      const words = String(want).split(/[\s,/]+/).filter(t => t.length > 1);
      const queries = [...new Set([String(want).trim(),
        [...words].sort((a, b) => b.length - a.length)[0], words[0]].filter(q => q && q.length > 1))];
      let got = null;
      for (const q of queries) {
        el.focus?.();
        nativeSetter(el, q);
        await sleep(200);
        const options = (await waitFor(() => readyOptions(el), 4000)) || [];
        const idx = closestOption(want, options.map(o => o.textContent || ''));
        if (idx >= 0) {
          got = String(options[idx].textContent || '').trim();
          options[idx].click();
          break;
        }
      }
      if (got) picked.push({ want: String(want), got });
      else { missed.push(String(want)); nativeSetter(el, ''); dismiss(el); }
      await sleep(80);
    }
    return { picked, missed };
  };
  // Where a typeahead shows what it holds: chips, or a single-value label, in its field's container.
  const shownNear = (el) => {
    const box = el.closest('[data-automation-id^="formField"], [role="group"], fieldset')
      || el.parentElement?.parentElement || el.parentElement;
    return String(box?.textContent || '').replace(String(el.value || ''), '').toLowerCase();
  };

  const filled = [], skipped = [], pending = [];

  // D55 (d): on a wizard step the extension may come back to — after the candidate answered a stop,
  // or on a re-invoke — a control that already holds something is LEFT ALONE. The candidate's own
  // answer, or the portal's own prefill, outranks the packet. (The overlay's edit path does not set
  // this: a correction is meant to overwrite.)
  const keepExisting = opts?.keepExisting === true;
  const holds = (el) => {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked === true;
    if (isTypeahead(el)) {
      const box = el.closest('[data-automation-id^="formField"], [role="group"], fieldset') || el.parentElement;
      return !!box?.querySelector('[data-automation-id="selectedItem"], [role="listitem"]');
    }
    if (isCombo(el)) {
      const t = String(el.textContent || '').trim();
      return !!t && !/^(select|choose|please|--)/i.test(t);
    }
    if (isEditable(el)) return String(el.textContent || '').trim() !== '';
    return String(el.value ?? '').trim() !== '';
  };

  // ⛔ D96 §4 safeguard 1, THE LAST LINE: whatever the plan says — a stored answer, an edit typed in the panel — a
  // terms / consent / privacy-notice / attestation / signature control is never ticked or filled. The rule's text
  // arrives as opts.neverFillSource (extension/answerKey.js NEVER_FILL_RE); fillFromPacket and applyOverlayEdit have
  // already refused these, and this refuses again on the control's own label inside the page.
  const neverFill = opts?.neverFillSource ? new RegExp(opts.neverFillSource, 'i') : null;
  const ownText = (el) => {
    const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
    const g = el.closest('fieldset, [role="radiogroup"], [role="group"]');
    const lid = (g?.getAttribute('aria-labelledby') || '').split(/\s+/)[0];
    return [byFor, el.closest('label')?.textContent, el.getAttribute('aria-label'),
      (el.type === 'checkbox' || el.type === 'radio') ? ((lid && document.getElementById(lid)?.textContent) || g?.querySelector('legend')?.textContent) : '']
      .filter(Boolean).join(' • ').replace(/[‘’ʼ]/g, "'");
  };
  const isSignatureId = (el) => /signature|signedOn|dateSigned|e-?sign/i.test(`${el.getAttribute('data-automation-id') || ''} ${el.name || ''} ${el.id || ''} ${
    el.closest('[role="group"], fieldset')?.getAttribute('data-automation-id') || ''}`);
  const inSignatureBlock = (el) => {
    const aid = el.getAttribute('data-automation-id') || '';
    const pre = aid.split('--')[0];
    if (!pre || pre === aid) return false;
    return [...document.querySelectorAll(`[data-automation-id*="${CSS.escape(pre)}--"]`)]
      .some(o => o !== el && /signature|signedOn|dateSigned|e-?sign/i.test(o.getAttribute('data-automation-id') || ''));
  };

  // One control, one value — the body of the plan loop, shared with the repeating sections below so
  // an entry's field is placed and read back by exactly the same rules as a flat answer.
  const place = async (step, el) => {
    if ((neverFill && neverFill.test(ownText(el))) || isSignatureId(el) || inSignatureBlock(el)) {
      skipped.push({ field: step.label, name: step.name, reason: 'never_filled_yours_to_do' });
      return;
    }
    if (keepExisting && holds(el)) { skipped.push({ field: step.label, reason: 'kept_existing' }); return; }
    try {
      if (el.type === 'checkbox' || el.type === 'radio') {
        const want = step.value === 'true' || step.value === true;
        if (el.checked !== want) {
          el.checked = want;
          el.dispatchEvent(new Event('input',  { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        pending.push({ step, el, kind: 'toggle', want });
      } else if (el.tagName === 'SELECT' && el.multiple) {
        // One answer may carry several values; a multi-select is the only control where "the
        // value" is a set. Accepts an array or a comma-separated string.
        const wants = (Array.isArray(step.value) ? step.value : String(step.value).split(','))
          .map(v => String(v).trim()).filter(Boolean);
        const hits = wants.map(w =>
          [...el.options].find(o => o.value === w || same(o.text, w))).filter(Boolean);
        if (!hits.length) { skipped.push({ field: step.label, reason: 'value_not_in_options' }); return; }
        for (const o of el.options) o.selected = hits.includes(o);
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        pending.push({ step, el, kind: 'multi', want: hits.map(o => o.value) });
      } else if (el.tagName === 'SELECT') {
        const match = [...el.options].find(
          o => o.value === step.value ||
               (o.text || '').trim().toLowerCase() === String(step.value).trim().toLowerCase()
        );
        // No option holds this value. Filling nothing is correct: the old behaviour of assigning
        // anyway left the select on its blank first option while the run recorded it as answered.
        if (!match) { skipped.push({ field: step.label, reason: 'value_not_in_options' }); return; }
        nativeSetter(el, match.value);
        pending.push({ step, el, kind: 'value', want: match.value });
      } else if (isTypeahead(el)) {
        // An array is a multi-select (one chip per value); a string is one pick.
        const wants = (Array.isArray(step.value) ? step.value : [step.value])
          .map(v => String(v ?? '').trim()).filter(Boolean);
        const { picked, missed } = await setTypeahead(el, wants);
        for (const m of missed) skipped.push({ field: step.label, reason: 'no_close_option', wanted: m.slice(0, 80) });
        if (!picked.length) return;
        pending.push({ step, el, kind: 'typeahead', want: picked.map(p => p.got) });
      } else if (isCombo(el)) {
        expectNow = Array.isArray(step.expectOptions) && step.expectOptions.length ? step.expectOptions : null;
        optionsChanged = false;
        const got = await setCombobox(el, step.value, step.declineOption ? 'decline' : step.exactOption ? 'exact' : null);
        expectNow = null;
        if (!got) {
          skipped.push({ field: step.label, name: step.name, reason: optionsChanged ? 'options_changed' : step.declineOption ? 'decline_option_absent' : 'value_not_in_options',
            wanted: String(step.value ?? '').slice(0, 80), ...(lastOptions ? { options: lastOptions } : {}) });
          return;
        }
        pending.push({ step, el, kind: 'combo', want: got, options: lastOptions });
      } else if (isEditable(el)) {
        el.focus?.();
        el.textContent = String(step.value);
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        pending.push({ step, el, kind: 'editable', want: String(step.value) });
      } else {
        nativeSetter(el, String(step.value));
        pending.push({ step, el, kind: 'value', want: String(step.value) });
      }
    } catch (e) {
      skipped.push({ field: step.label, reason: `error:${e.message}` });
    }
  };

  for (const step of plan) {
    const el = controls[step.index];
    // The DOM can move between the probe and the fill on an SPA. Re-verify identity rather than
    // trusting an index: writing a home address into whatever happens to be at position 7 is exactly
    // the stray release this design refuses to make.
    //
    // A combobox or contenteditable often carries NEITHER name NOR id, so those two checks pass
    // vacuously for them — the label is the only identity left, and it is checked for exactly that
    // case rather than for everything, because a label is the weaker signal of the three.
    const labelless = !step.name && !step.id;
    if (!el || (step.name && el.name !== step.name) || (step.id && el.id !== step.id)) {
      skipped.push({ field: step.label, reason: 'field_moved' });
      continue;
    }
    if (labelless && step.label) {
      const shown = (el.getAttribute?.('aria-label') || el.closest?.('label')?.textContent || '').trim();
      if (shown && !same(shown.slice(0, 200), step.label)) {
        skipped.push({ field: step.label, reason: 'field_moved' });
        continue;
      }
    }
    await place(step, el);
  }

  // ── D55 (b): REPEATING SECTIONS ─────────────────────────────────────────────────────────────
  // Work Experience / Education / Languages / Websites are sections, not questions: "Add" (then
  // "Add Another") creates a panel of fields. For each entry the packet carries, the section's own
  // Add button is pressed, the fill WAITS for the new panel's controls to appear (they arrive a beat
  // later), and only those new controls are filled — by their labels, inside that one panel, so a
  // second job's dates can never land in the first job's fields.
  //
  // A section is recognised by its Add button and its heading; a section the packet has nothing for
  // is never opened. Skills (a chip set) is one typeahead, not a section.
  const sections = {};
  const textOfIds = (ids) => String(ids || '').split(/\s+/).filter(Boolean)
    .map(id => document.getElementById(id)?.textContent || '').join(' ');
  const ownLabel = (el) => {
    const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
    return String(byFor || el.closest('label')?.textContent || el.getAttribute('aria-label')
      || textOfIds(el.getAttribute('aria-labelledby')) || el.getAttribute('placeholder') || '')
      .replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  };
  // A small group around a control (From: Month / Year) is context; a panel-sized group is not.
  const groupLabel = (el) => {
    const g = el.parentElement?.closest('[role="group"], fieldset');
    if (!g || g.querySelectorAll('input, select, textarea, button[aria-haspopup="listbox"]').length > 3) return '';
    return String(textOfIds(g.getAttribute('aria-labelledby')) || g.querySelector('legend')?.textContent
      || g.getAttribute('aria-label') || '').replace(/\*/g, '').trim();
  };
  const two = (n) => (n === null || n === undefined || n === '' ? null : String(n).padStart(2, '0'));
  const RULES = {
    work: (e) => [
      [/(from|start)\b.*month/, two(e.from?.month)], [/(from|start)\b.*year/, e.from?.year],
      [/(^|\s)(to|end)\b.*month/, e.current ? null : two(e.to?.month)], [/(^|\s)(to|end)\b.*year/, e.current ? null : e.to?.year],
      [/job title|position|(^|\s)title\b/, e.title], [/company|employer|organi[sz]ation/, e.company],
      [/location/, e.location], [/currently work|i currently|current (job|role|position)/, e.current ? true : null],
      [/description|responsibilit|summary|duties/, e.description],
    ],
    education: (e) => [
      [/(from|start)\b.*year/, e.from?.year], [/(^|\s)(to|end)\b.*year|graduat.*year|expected.*year/, e.to?.year],
      [/school|university|college|institution/, e.school], [/degree/, e.degree],
      [/field of study|major|discipline|area of study/, e.field], [/gpa|overall result|grade/, e.gpa],
    ],
    languages: (e) => [
      [/^language$|(^|\s)language(\s|$)/, e.language], [/fluent|native/, e.fluent ? true : null],
      [/reading/, e.reading], [/speaking/, e.speaking], [/writing/, e.writing],
    ],
    websites: (e) => [[/url|website|link/, e.url]],
  };
  const KINDS = [['education', /education/i], ['languages', /language/i], ['websites', /website|(^|\s)links?\b/i],
                 ['work', /work experience|employment|experience/i]];
  const panelControls = (box) => [...box.querySelectorAll(
    'input, select, textarea, [role="combobox"], button[aria-haspopup="listbox"]'
  )].filter(el => el.getAttribute('aria-haspopup') === 'listbox' ||
    !['hidden', 'submit', 'button', 'image', 'reset', 'file'].includes((el.type || '').toLowerCase()));

  const entries = opts?.entries || null;
  if (entries) {
    const addRe = /^\s*add(\s+another)?\b/i;
    const addButtons = [...scope.querySelectorAll('button, [role="button"]')]
      .filter(b => addRe.test(b.getAttribute('aria-label') || '') || addRe.test(b.textContent || ''));
    for (const btn of addButtons) {
      const box = btn.closest('[role="group"], section, fieldset') || btn.parentElement;
      const heading = String(box?.querySelector('h1, h2, h3, h4, legend, [role="heading"]')?.textContent || '').trim();
      const kind = KINDS.find(([, re]) => re.test(`${btn.getAttribute('aria-label') || ''} ${heading}`))?.[0];
      if (!kind || sections[kind]) continue;
      const list = Array.isArray(entries[kind]) ? entries[kind] : [];
      sections[kind] = { wanted: list.length, added: 0, fields: 0 };
      for (let i = 0; i < list.length; i++) {
        const before = new Set(panelControls(box));
        btn.click();
        const opened = await waitFor(() => panelControls(box).some(el => !before.has(el)), 3000);
        if (!opened) { skipped.push({ field: `${heading || kind} ${i + 1}`, reason: 'section_did_not_open' }); break; }
        await sleep(80);
        sections[kind].added += 1;
        const fresh = panelControls(box).filter(el => !before.has(el));
        const rules = RULES[kind](list[i] || {});
        const used = new Set();
        for (const el of fresh) {
          const label = ownLabel(el);
          const said = `${groupLabel(el)} ${label}`.toLowerCase().trim();
          const r = rules.findIndex(([re, v], k) => !used.has(k) && v !== null && v !== undefined && v !== '' && re.test(said));
          if (r < 0) continue;
          used.add(r);
          sections[kind].fields += 1;
          await place({
            label: `${heading || kind} ${i + 1} · ${[groupLabel(el), label].filter(Boolean).join(' ')}`,
            name: null, value: rules[r][1], provenance: list[i]?.source === 'resume' ? 'resume' : 'profile',
            entry: `${kind}:${i}`,
          }, el);
        }
      }
    }
    // Skills: one chip per confirmed skill, into the typeahead labelled as a skills field.
    if (Array.isArray(entries.skills) && entries.skills.length) {
      const box = controls.find(el => isTypeahead(el) && /skill/i.test(ownLabel(el)));
      if (box) {
        sections.skills = { wanted: entries.skills.length, added: 0, fields: 1 };
        await place({ label: ownLabel(box) || 'Skills', name: null, value: entries.skills, provenance: 'profile', entry: 'skills' }, box);
      }
    }
  }

  // ── READ BACK, AFTER GIVING THE PAGE A CHANCE TO DISAGREE ────────────────────────────────────
  //
  // ⛔ THIS IS THE POINT OF THE WHOLE FUNCTION'S ASYNC SHAPE. Before this, a step was recorded as
  // `filled` the instant after the setter ran — so a React-controlled input that reverts on its
  // next render was reported as filled, and the run told the candidate a field was answered while
  // the form in front of them was empty. Reporting a value we did not place is worse than failing
  // to place it, because only one of those is visible to the person about to submit.
  //
  // A synchronous re-read would NOT catch it: the revert happens when the framework re-renders,
  // which is a task or two away. Two animation frames puts this after the next paint, which is
  // after React has committed. The setTimeout is the fallback for a backgrounded tab, where
  // requestAnimationFrame may never fire and the whole handoff would otherwise hang.
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, 400);
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(finish));
    }
  });

  for (const { step, el, kind, want, options: shownOptions } of pending) {
    let ok = false, got = '';
    try {
      if (kind === 'toggle')        { ok = el.checked === want; got = String(el.checked); }
      else if (kind === 'multi')    { const sel = [...el.selectedOptions].map(o => o.value);
                                      ok = want.every(w => sel.includes(w)); got = sel.join(','); }
      else if (kind === 'editable') { got = (el.textContent || '').trim(); ok = same(got, want); }
      else if (kind === 'combo')    { got = (el.textContent || el.value || '').trim();
                                      // The widget renders its own label, so containment is the
                                      // honest test — an exact match would fail on "Yes ✓".
                                      ok = got.toLowerCase().includes(String(want).trim().toLowerCase()); }
      else if (kind === 'typeahead') { const shown = shownNear(el);
                                      // Every pick must be visible as a chip or a selected label.
                                      ok = want.every(w => shown.includes(String(w).toLowerCase()));
                                      got = want.join(', '); }
      else                          { got = el.value; ok = same(got, want); }
    } catch (e) {
      skipped.push({ field: step.label, reason: `verify_failed:${e.message}` });
      continue;
    }
    if (ok) {
      // `placed` is the ATS's own wording when a picker chose it ("Computer and Information
      // Sciences" for "Computer Science") — what the employer will read, so what the review shows.
      filled.push({ field: step.label, name: step.name, provenance: step.provenance, verified: true,
                    ...(kind === 'combo' || kind === 'typeahead' ? { placed: got } : {}),
                    ...(step.entry ? { entry: step.entry } : {}),
                    ...(step.index !== undefined ? { index: step.index } : {}),
                    ...(Array.isArray(shownOptions) && shownOptions.length ? { options: shownOptions } : {}) });
    } else {
      // The value did not stick. Named distinctly from `field_moved` because the remedy differs:
      // this one means the page actively rejected or overwrote what we wrote.
      skipped.push({
        field: step.label, name: step.name, reason: 'reverted_after_set',
        wanted: String(want).slice(0, 80), got: String(got).slice(0, 80),
      });
    }
  }

  // ── The resume ─────────────────────────────────────────────────────────────
  // The piece usually assumed impossible (§5): a File can be constructed and handed to a real file
  // input through a DataTransfer. Without this the candidate still has to attach the resume by hand,
  // which is most of the work the handoff was supposed to remove.
  //
  // D55 (e): INTO THE RÉSUMÉ'S INPUT, not "the first input[type=file]". A form with a cover-letter
  // upload ahead of the résumé's (fakeAts /workday-replica, and plenty of real ones) received the
  // résumé as a cover letter, and the required résumé stayed empty. Each file input is scored on
  // what names IT — its label, aria-label, name, id, automation id, and its own field wrapper's label
  // (never a whole step's text, which names every upload on it): a résumé / CV wins, a cover letter,
  // transcript, portfolio or photo is never chosen, and a lone unnamed upload is taken only when it
  // is the only candidate. Two unnamed uploads is a guess — nothing is attached, and it says so.
  //
  // ⛔ BYTE-IDENTICAL (modulo indentation) TO THE EXPORTED resumeInputScore — asserted by test.
  function resumeInputScore(context) {
    const t = String(context || '').toLowerCase();
    if (/cover[\s_-]*letter|motivation|transcript|portfolio|writing sample|photo|headshot|certificat|reference|supporting|additional/.test(t)) return -1;
    if (/r[ée]sum[ée]|\bcv\b|curriculum vitae/.test(t)) return 2;
    return 0;
  }
  const fileContext = (el) => {
    const own = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : '';
    const wrap = el.closest('[data-automation-id^="formField"], .field, .application-question');
    const wrapLabel = wrap?.querySelector('label, legend, h3, h4')?.textContent || '';
    return [own, el.closest('label')?.textContent, el.getAttribute('aria-label'), el.name, el.id,
      el.getAttribute('data-automation-id'), wrapLabel].filter(Boolean).join(' ');
  };
  const pickResumeInput = () => {
    const inputs = [...scope.querySelectorAll('input[type="file"]')]
      .map(el => ({ el, score: resumeInputScore(fileContext(el)) }));
    if (!inputs.length) return { el: null, reason: 'no_file_input' };
    const named = inputs.filter(i => i.score === 2);
    if (named.length) return { el: named[0].el, by: 'named' };
    const neutral = inputs.filter(i => i.score === 0);
    if (neutral.length === 1) return { el: neutral[0].el, by: 'only_unnamed_upload' };
    return { el: null, reason: neutral.length ? 'ambiguous_file_inputs' : 'no_resume_input' };
  };

  let resumeResult = null;
  if (resume && resume.base64) {
    const target = pickResumeInput();
    const fileInput = target.el;
    if (!fileInput) {
      resumeResult = { attached: false, reason: target.reason };
    } else {
      try {
        const bin = atob(resume.base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const file = new File([bytes], resume.filename, { type: resume.mimeType || 'application/pdf' });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('input',  { bubbles: true }));
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        // The page's own confirmation (G2 requirement 5): its uploader rendering the filename — a
        // Workday drop zone's "… Successfully Uploaded!", a Greenhouse filename chip. Absent on a
        // bare native input, which is why it is reported beside `attached`, never instead of it.
        const wrap = fileInput.closest('[data-automation-id^="formField"], .field') || fileInput.parentElement;
        const confirmedByPage = !!(await waitFor(() => String(wrap?.textContent || '').includes(resume.filename), 1500));
        resumeResult = {
          // Reported separately from `attached` on purpose. The property being set is not evidence
          // the page noticed; only the page's own rendering of the filename is (G2 requirement 5).
          attached: fileInput.files.length === 1 && fileInput.files[0].name === resume.filename,
          filename: resume.filename,
          size: file.size,
          target: target.by,
          field: fileContext(fileInput).replace(/\s+/g, ' ').trim().slice(0, 80),
          confirmedByPage,
          // D98 §5 (J6): the résumé the on-page panel attached, attached again — the review panel says so.
          fromPanel: resume.fromPanel === true,
        };
      } catch (e) {
        resumeResult = { attached: false, reason: `error:${e.message}` };
      }
    }
  }

  return { filled, skipped, resume: resumeResult, fieldCount: controls.length, sections };
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * D55 (e) — how strongly the text that names a file input says "résumé": 2 a résumé / CV, -1 an
 * upload that is something else (cover letter, transcript, portfolio, photo …), 0 unnamed.
 * ⛔ applyPlan carries a byte-identical copy (it is serialised into the page); a test asserts it.
 */
export function resumeInputScore(context) {
  const t = String(context || '').toLowerCase();
  if (/cover[\s_-]*letter|motivation|transcript|portfolio|writing sample|photo|headshot|certificat|reference|supporting|additional/.test(t)) return -1;
  if (/r[ée]sum[ée]|\bcv\b|curriculum vitae/.test(t)) return 2;
  return 0;
}

const normalise = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** ⭐ D96 §4: a label as it is COMPARED — the trailing "*", "(required)" and end punctuation set aside (answerKey.js). */
export const labelKey = (s) => normalise(questionLabelKey(s));

/**
 * D55 (a) — which of a picker's REAL options is closest to the value we hold. Returns its index, or -1.
 *
 * The ATS's vocabulary wins: the option picked is one the portal offered, never the profile's own
 * string typed in. Exact, then whole-phrase containment ("United States" in "United States of
 * America", the shortest such option preferred), then word overlap that covers at least half the
 * value ("Computer Science" -> "Computer and Information Sciences"), then — narrowly — a unique
 * first-word match. Below that it refuses: a picker filled with a guess reads to the employer as
 * the candidate's answer.
 *
 * ⛔ Exported so it can be tested; applyPlan carries a BYTE-IDENTICAL copy (it is serialised into
 * the page and can import nothing). test/d55Autofill.test.js asserts the two are the same text.
 */
export function closestOption(want, options) {
  const STOP = new Set(['and', 'of', 'the', 'in', 'for', 'a', 'an', 'or', 'to', 'with']);
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9+#]+/g, ' ').trim();
  const toks = (s) => norm(s).split(' ')
    .filter(t => t.length > 1 && !STOP.has(t))
    .map(t => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
  const w = norm(want);
  if (!w) return -1;
  const wt = toks(want);
  let best = -1, bestScore = 0;
  options.forEach((opt, i) => {
    const o = norm(opt);
    if (!o) return;
    let score = 0;
    if (o === w) score = 1;
    else if ((' ' + o + ' ').includes(' ' + w + ' ')) score = 0.9 - Math.min(0.2, (o.length - w.length) / 200);
    else if ((' ' + w + ' ').includes(' ' + o + ' ')) score = 0.8;
    else {
      const ot = toks(opt);
      const inter = wt.filter(t => ot.includes(t)).length;
      const union = new Set([...wt, ...ot]).size || 1;
      if (inter * 2 >= wt.length) score = 0.8 * (inter / union);
    }
    if (score > bestScore) { best = i; bestScore = score; }
  });
  if (bestScore >= 0.5) return best;
  // The last resort, and a narrow one: the want's FIRST significant word names exactly one option's
  // first word ("Bachelor of Science" -> "Bachelor's Degree"). Two candidates is a guess; refuse.
  const first = wt[0];
  if (!first) return -1;
  const hits = options.map((opt, i) => (toks(opt)[0] === first ? i : -1)).filter(i => i >= 0);
  return hits.length === 1 ? hits[0] : -1;
}

/**
 * D55 (d) — Workday's data-automation-id for each canonical contact field (CANONICAL_GATE_FIELDS
 * names). Structural, like the namespace unwrap: it reads the portal's own naming convention, never
 * a label. ⚠ Known from Workday's markup as far as it is known; re-measure on a live tenant (O73).
 */
export const WORKDAY_FIELD_IDS = Object.freeze({
  'legalNameSection_firstName': 'first_name',
  'legalNameSection_lastName': 'last_name',
  'email': 'email',
  'phone-number': 'phone',
  'addressSection_addressLine1': 'address1',
  'addressSection_city': 'city',
  'addressSection_countryRegion': 'state',
  'addressSection_postalCode': 'zip',
  'countryDropdown': 'country',
});

/**
 * Match the packet's answers to the controls actually on this page.
 *
 * ELIGIBILITY ANSWERS ARE MATCHED EXACTLY OR NOT AT ALL. A sponsorship answer dropped into a field
 * by a fuzzy label match is the A1 inversion trap: "do you require sponsorship" and "are you
 * authorized to work without sponsorship" are the same words and opposite questions, and getting it
 * wrong is a false attestation to an employer, not a filling error. When one cannot be matched
 * exactly it is left for the human and reported — §6, and the reason G3 pins these to the top.
 */
export function matchAnswersToFields(answers, fields) {
  const plan = [], unmatched = [];
  const taken = new Set();

  // An ATS namespaces its controls: Greenhouse serves `job_application[requires_sponsorship]`, not
  // `requires_sponsorship`. Unwrapping that is STRUCTURAL — it reads the form's own naming
  // convention — and is not the same thing as guessing from a label. Without it, eligibility answers
  // would be exact-matched against a name no real ATS emits and would therefore never be filled on
  // any of them, which is a different failure from the one the exact-match rule exists to prevent.
  const segments = (n) => String(n || '')
    .split(/[[\].]+/).map(s => s.trim()).filter(Boolean);

  const nameMatches = (fieldName, answerName) => {
    if (!fieldName || !answerName) return false;
    if (fieldName === answerName) return true;
    const segs = segments(fieldName);
    return segs.length > 1 && segs[segs.length - 1] === answerName;
  };

  const byExact = (a) => fields.find(f =>
    !taken.has(f.index) && (
      nameMatches(f.name, a.name) ||
      nameMatches(f.id, a.name) ||
      (a.field_id && f.id && f.id === a.field_id) ||
      // D55 (d): the Workday adapter — its own stable automation ids for the contact fields. ⛔ No
      // eligibility question is in that table: Workday generates those ids per tenant, so work
      // authorisation and sponsorship still match exactly or not at all, and on Workday that is NOT.
      (!!f.automationId && WORKDAY_FIELD_IDS[f.automationId] === a.name)
    ));

  // ⭐ D96 §4 / §5 (owner 10-13, symptom 4): a label EQUAL to the answer's once the trailing "*", "(required)" and
  // the punctuation are set aside — "First Name*", "First Name *" for "First Name" — is an EXACT match, not a guess
  // ('label_exact'). Only the looser fallback (the control's NAME resembling the answer's) is still a guess ('label').
  // ⛔ Eligibility is unchanged: it never takes a label match of either kind (below).
  const byLabel = (a) => {
    const want = labelKey(a.field);
    if (!want) return null;
    const exact = fields.find(f => !taken.has(f.index) && labelKey(f.label) === want);
    if (exact) return { field: exact, how: 'label_exact' };
    const loose = fields.find(f => !taken.has(f.index) && f.name && normalise(f.name) === normalise(a.name));
    return loose ? { field: loose, how: 'label' } : null;
  };

  for (const a of answers) {
    if (a.value === null || a.value === undefined || a.value === '') continue;
    if (Array.isArray(a.value) && a.value.length === 0) continue;   // D55: an empty chip set says nothing

    let field = byExact(a);
    let how = field ? 'exact' : null;

    if (!field && !a.eligibility) { const hit = byLabel(a); field = hit?.field || null; how = hit?.how || null; }
    if (!field && a.eligibility) {
      unmatched.push({
        field: a.field, name: a.name, eligibility: true,
        reason: 'eligibility_requires_exact_match',
      });
      continue;
    }
    if (!field) { unmatched.push({ field: a.field, name: a.name, reason: 'no_matching_control' }); continue; }

    // ── D55: the DECIDED rules (AUTOFILL_TARGET.md §7.3–§7.5), applied to the QUESTION ON THE PAGE ──
    // Read off the field's own label, whatever the answer's name claims, because the page's
    // question is what the employer will read the answer as.
    //   §7.4 never opt the candidate in — a "yes" to marketing / WhatsApp / text messages is never
    //        placed; a "no" only when it is the candidate's own stored answer.
    //   §7.3 a screening question that can rule them out ("7+ years?") is answered only where they
    //        STATED it — their own answer, or an exact control match — never by a label guess. Left
    //        empty, it is a required stop on the badge, like work authorisation.
    //   §7.5 EEO is stated or blank — never a guessed or defaulted value.
    const kind = questionKind(field.label);
    const guessed = ['label_fuzzy', 'default', 'sponsorship_assumed_future'].includes(a.provenance);
    const yes = a.value === true || /^(yes|true|y|i agree|opt in|subscribe)\b/i.test(String(a.value).trim());
    let refusal = null;
    // ⛔ D96 §4 safeguard 1 / §7: a terms / consent / attestation / signature control, or a password / payment one, is
    // never given a value — whatever the packet holds. First, so no other rule can let one through.
    const never = neverFillReasonOfField(field, fields);
    if (never) refusal = never === 'secret' ? 'secret_never_filled' : 'consent_left_for_you';
    else if (kind === 'opt_in' && (yes || a.provenance !== 'custom_answer')) refusal = 'opt_in_left_for_you';
    else if (kind === 'screening' && (guessed || (how !== 'exact' && a.provenance !== 'custom_answer'))) refusal = 'screening_left_for_you';
    else if (kind === 'eeo' && guessed) refusal = 'eeo_left_for_you';
    if (refusal) {
      unmatched.push({ field: field.label || a.field, name: a.name, reason: refusal, kind });
      continue;
    }

    taken.add(field.index);
    plan.push({
      index: field.index, name: field.name, id: field.id,
      label: field.label || a.field,
      value: a.value,
      provenance: a.provenance,
      confidence: a.confidence,
      eligibility: !!a.eligibility,
      matchedBy: how,
    });
  }
  return { plan, unmatched };
}

// ── Session state ────────────────────────────────────────────────────────────
// chrome.storage.session, not memory: an MV3 service worker is torn down without warning (§5). G0
// also measured that session storage OUTLIVES the activeTab grant — so a re-invoke after the grant
// lapses can resume without spending another token, and nothing else will ever clear this. It has to
// be cleared deliberately.

export async function savePacketForTab(tabId, payload, { keepExpiry = false } = {}) {
  // ONE write site for gate:{tabId} (test/privacyReconciliation.test.js counts them). A patch keeps the packet's
  // own expiry: refreshing its saved answers must never extend how long a released packet lives.
  const at = Date.now();
  await chrome.storage.session.set({
    [sessionKey(tabId)]: keepExpiry && payload?.expiresAt
      ? payload
      : { ...payload, storedAt: at, expiresAt: at + PACKET_TTL_MS },
  });
}

/**
 * ⭐ D96 §4 · after an acknowledgement or a change in the panel, the packet already released into this tab carries the
 * saved answers AS THEY STAND NOW (GET /api/saved-answers/fillable) — so the NEXT fill on this tab uses a just-
 * acknowledged answer and no longer uses a just-changed one, without re-preparing and without a second token.
 * Nothing else in the packet changes; its expiry is kept.
 */
export async function patchPacketSavedAnswers(tabId, savedAnswers) {
  if (tabId == null || !Array.isArray(savedAnswers)) return false;
  const held = await loadPacketForTab(tabId);
  if (!held?.packet) return false;
  const packet = { ...held.packet };
  if (savedAnswers.length) packet.savedAnswers = savedAnswers; else delete packet.savedAnswers;
  await savePacketForTab(tabId, { ...held, packet }, { keepExpiry: true });
  return true;
}

export async function loadPacketForTab(tabId) {
  const key = sessionKey(tabId);
  const got = await chrome.storage.session.get(key);
  const entry = got?.[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { await chrome.storage.session.remove(key); return null; }
  return entry;
}

export async function clearPacketForTab(tabId) {
  await chrome.storage.session.remove(sessionKey(tabId));
}

/** Drop anything past its TTL. Cheap, and the only thing that collects abandoned handoffs. */
export async function sweepExpiredPackets(now = Date.now()) {
  const all = await chrome.storage.session.get(null);
  const dead = Object.entries(all)
    .filter(([k, v]) => k.startsWith('gate:') && v && now > v.expiresAt)
    .map(([k]) => k);
  if (dead.length) await chrome.storage.session.remove(dead);
  return dead.length;
}

// ── Per-portal batching (TASK G5) ────────────────────────────────────────────
// The gate is amortised per PORTAL, not per application: once the candidate is authenticated at
// Amazon, that session serves every queued Amazon job. G0 is what makes this more than a list —
// the activeTab grant survives every same-origin navigation, so moving the SAME TAB to the next
// application keeps the grant alive and no second gesture is needed.
//
// Batching the GATE must not batch the REVIEW. Each application is still target-matched on its own
// and still gets its own overlay to approve; what is shared is the sign-in, not the attestation.

const batchKey = (tabId) => `batch:${tabId}`;

export async function saveBatchForTab(tabId, batch) {
  await chrome.storage.session.set({ [batchKey(tabId)]: { ...batch, updatedAt: Date.now() } });
}

export async function loadBatchForTab(tabId) {
  const got = await chrome.storage.session.get(batchKey(tabId));
  return got?.[batchKey(tabId)] || null;
}

export async function clearBatchForTab(tabId) {
  await chrome.storage.session.remove(batchKey(tabId));
}

// ⭐ J11 · G5 fills on the ADVANCE, never on a reload. "The next application in a batch fills without another
// keypress" means the load the candidate's own "Next application" caused — not every load of a batched tab. Before
// this, a plain reload of the application already filled (or a same-URL re-navigation) re-ran a fill nobody asked
// for. advanceBatch arms a one-shot mark just before it moves the tab; the next complete load on the batch's origin
// takes it, and only that load fills. Bounded in time, so a navigation that never completed cannot leave a mark for
// a reload much later to inherit. The target URL is recorded but NOT required to match: a portal may redirect.
export const BATCH_ADVANCE_TTL_MS = 2 * 60 * 1000;

export async function armBatchAdvance(tabId, applyUrl) {
  const batch = await loadBatchForTab(tabId);
  if (!batch) return false;
  await saveBatchForTab(tabId, { ...batch, advance: { applyUrl, at: Date.now() } });   // the ONE batch:{tabId} write site
  return true;
}

/** True once per advance: the mark is cleared as it is read, whether it was still fresh or not. */
export async function takeBatchAdvance(tabId, now = Date.now()) {
  const batch = await loadBatchForTab(tabId);
  if (!batch?.advance) return false;
  const { advance, ...rest } = batch;
  await saveBatchForTab(tabId, rest);
  return now - (advance.at || 0) <= BATCH_ADVANCE_TTL_MS;
}

/**
 * What else is waiting at this origin, newest first, excluding one already in hand.
 *
 * "READY" HAS TO MEAN READY. A stale packet cannot be released — the server refuses to mint for it —
 * so counting one here would offer the candidate "3 more ready" and then refuse the third. Now that
 * held reviews carry packets too, several packets routinely share one origin and that overcount
 * stopped being hypothetical.
 *
 * `gateCrossing` reports whether any of them is a sign-in or CAPTCHA. It exists because the offer
 * reads differently for the two kinds: crossing a gate once genuinely releases the whole batch, so
 * "you are already signed in" is the point. For held reviews the batch is just proximity — you are
 * on the site, so the next one is cheap — and claiming a sign-in cleared them would be untrue.
 */
export async function portalQueueFor(serverUrl, origin, excludePacketId = null) {
  try {
    // ?origin= asks the server the question this function actually has. It used to fetch every
    // unconsumed packet and discard the ones for other portals — which was wrong, not just wasteful:
    // the list is capped at 100, so a candidate with a long queue could have this portal's packets
    // fall entirely outside the newest 100 and be told the batch was empty.
    const res = await api(serverUrl, `/api/apply/gate-packets?origin=${encodeURIComponent(origin)}`);
    if (!res.ok) return { remaining: 0, next: null, packets: [], gateCrossing: false };
    const body = await res.json();
    // The origin filter is ALSO kept client-side, deliberately. An extension ships and updates
    // independently of the server it talks to, so this build must stay correct against a server
    // that predates ?origin= and ignores it. Filtering twice costs nothing; assuming the server is
    // new enough is how a version skew becomes a wrong-portal fill.
    const mine = (body.packets || [])
      .filter(p => packetFillsOrigin(p, origin) && p.packetId !== excludePacketId && !p.stale)
      .sort((a, b) => b.createdAt - a.createdAt);
    const portal = (body.portals || []).find(g => g.origin === origin) || null;
    return {
      remaining: mine.length,
      host: portal?.host || origin,
      gateCrossing: mine.some(p => p.kind === 'gate'),
      next: mine[0] ? {
        packetId: mine[0].packetId, applyUrl: mine[0].applyUrl,
        title: mine[0].title, company: mine[0].company,
      } : null,
      packets: mine,
    };
  } catch {
    return { remaining: 0, next: null, packets: [], gateCrossing: false };
  }
}

// ── The handoff ──────────────────────────────────────────────────────────────

// Routed through authedFetch so the handoff uses the SAME deliberately-chosen credential as
// everything else, and never the ambient browser cookie. `init` is spread first so a caller can
// still override the method or body, but the credential is not a caller's to choose.
//
// Returns a Response-shaped refusal rather than null when there is no credential, so the existing
// `res.status === 401` and `!res.ok` branches below keep working unchanged — a null here would
// have turned "not signed in" into a TypeError inside the handoff.
const api = async (serverUrl, path, init = {}) => {
  const res = await authedFetch(serverUrl, path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  return res || new Response(null, { status: 401 });
};

/**
 * Run the handoff on the active tab. Returns a result object; never throws at the caller.
 *
 * The ORDER here is the security design, not an implementation detail:
 *   origin read -> packet located by origin -> form confirmed present -> ONLY THEN token minted and
 *   spent. Every refusal above happens before a token exists, so a mismatch costs nothing.
 */
export async function runGatedHandoff({ serverUrl, tab, ...opts }) {
  // `opts`: the fill's own options (lane J5's auto mode travels here) — none of them widens what may be filled.
  // ⭐ ONE fill per tab, from the moment it is asked for: any earlier fill still waiting here stops (ACTIVE_FILL).
  const runId = `${tab?.id ?? 't'}-${Date.now()}-${++FILL_SEQ}`;
  if (tab?.id != null) ACTIVE_FILL.set(tab.id, runId);
  const result = await handoffOnce({ serverUrl, tab, opts: { ...opts, runId } });
  // ⭐ D96 §3: the fill's outcome is remembered for the job — how many filled of how many, how many need you. The job
  // is the released packet's, else the tab's binding. Counts only; a failure here never changes the result.
  const held = tab?.id ? await loadPacketForTab(tab.id).catch(() => null) : null;
  const bound = await bindingForTab(tab).catch(() => null);
  await noteFill(result, { jobId: held?.packet?.jobId ?? null, bound });
  return result;
}

async function handoffOnce({ serverUrl, tab, opts = {} }) {
  if (!tab?.id) return { ok: false, reason: 'no_active_tab', message: 'No active tab.' };

  let origin;
  try { origin = new URL(tab.url).origin; }
  catch { return { ok: false, reason: 'unreadable_tab_url', message: 'This page cannot be read.' }; }

  if (!/^https?:$/.test(new URL(tab.url).protocol)) {
    return { ok: false, reason: 'unsupported_scheme', message: 'Only http(s) pages are supported.' };
  }

  // A packet already released into this tab — a re-invoke after the grant lapsed, or after the portal
  // moved to another step. Reuse it rather than spending a second token.
  const cached = await loadPacketForTab(tab.id);
  if (cached && packetFillsOrigin(cached, origin)) {
    return fillFromPacket({ tab, origin, released: cached, serverUrl, reused: true, opts });
  }

  let list;
  const bound = await bindingForTab(tab).catch(() => null);
  try {
    // ⛔ D56: the page's URL goes in the BODY of one question — "which packets may fill THIS page, and
    // if none, why?" The server matches on the packet's ORIGIN LIST and, where the URL carries one, the
    // JOB ID (one URL parser, the server's), and says which of the three truthful cases this is.
    // ⭐ The tab binding rides along: on a stage whose address names no job (a sign-in page, a step that changed
    // without changing the URL), the server can still say which of YOUR jobs this is.
    let res = await api(serverUrl, '/api/apply/handoff/match', {
      method: 'POST', body: JSON.stringify({ url: tab.url, boundJobId: bound?.jobId ?? null }),
    });
    if (res.status === 404) {
      // A server that predates D56: the origin-scoped list, as before. See portalQueueFor's note.
      res = await api(serverUrl, `/api/apply/gate-packets?origin=${encodeURIComponent(origin)}`);
    }
    if (res.status === 401) {
      return { ok: false, reason: 'not_signed_in', message: 'Sign in to Draft first.' };
    }
    if (!res.ok) return { ok: false, reason: 'server_error', message: `Server returned ${res.status}.` };
    list = await res.json();
  } catch (e) {
    // The underlying message is carried through: "could not reach" covers a dead server, a blocked
    // request and a bad URL, and troubleshooting any of them without it is guesswork.
    return { ok: false, reason: 'network_error', message: 'Could not reach Draft.', detail: e.message };
  }

  // TARGET MATCH, first half. The server nominated the addresses for each packet; this page has to be
  // one of them — checked HERE too, whatever the server said. Nothing has been fetched but counts.
  const forOrigin = (list.packets || []).filter(p => packetFillsOrigin(p, origin));
  if (forOrigin.length === 0) {
    // ⛔ D56: never "from your Draft queue" to someone on the manual route. The server says which case
    // this is; an old server says nothing, and then the honest sentence is the plain one.
    const reason = list.state && list.state !== 'ready' ? list.state : 'origin_mismatch';
    return {
      ok: false, reason,
      // ⭐ D96 §2: on a bound tab the job is named — "capture it first" only with no binding and no match.
      message: boundMissMessage(bound, reason, list.message)
        || "Nothing is prepared for this page. If draft knows this job, press \"Prepare this application\" in the draft popup; if not, capture it first.",
      canPrepare: !!list.canPrepare, job: list.job || null, addresses: list.addresses || null,
    };
  }

  // A STALE PACKET CANNOT BE RELEASED, so it must not be chosen.
  //
  // The server refuses to mint one (410 packet_stale), which is correct — three-day-old answers must
  // not be filled into a form that may have moved on. But this list is sorted by recency, and once
  // held reviews carry packets too, MANY packets share one origin: an employer with several roles,
  // or the same role attempted twice. Picking the newest without checking would fail an entire
  // handoff on an expired packet while a perfectly usable one sat directly behind it.
  const fresh = forOrigin.filter(p => !p.stale);
  if (fresh.length === 0) {
    return {
      ok: false, reason: 'packet_stale',
      // D56: an expired packet is never a dead end — "Prepare this application" makes a fresh one.
      message: list.message || 'The answers prepared for this page have expired. Run it again in Draft to prepare fresh ones.',
      canPrepare: !!list.canPrepare, job: list.job || null,
    };
  }
  // Newest first, but a packet whose POSTING is gone goes last. It is deprioritised rather than
  // excluded: our record of the listing being cleaned up says nothing about the form the candidate
  // is actually standing on, so it stays usable — just never in preference to a live one.
  const chosen = fresh.sort((a, b) =>
    (a.postingGone ? 1 : 0) - (b.postingGone ? 1 : 0) || b.createdAt - a.createdAt)[0];

  // TARGET MATCH, second half: a form has to be here. Read-only, isolated world.
  let shape;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probeFormShape });
    shape = r?.result;
  } catch (e) {
    return { ok: false, reason: 'no_access', message: 'Invoke the extension on the application tab.' };
  }
  if (!shape?.hasForm || shape.fields.length === 0) {
    return {
      ok: false, reason: 'no_form',
      message: 'No application form found on this page. Nothing was released.',
    };
  }
  // The probe reports the origin from inside the page. If it disagrees with the tab's, the tab moved
  // between the two reads and the match no longer means anything.
  if (shape.origin !== origin) {
    return { ok: false, reason: 'origin_moved', message: 'The page changed. Nothing was released.' };
  }

  // Only now is a token worth spending.
  let released;
  try {
    // D56: the page's URL travels with the mint, so the server refuses — before a token exists — a
    // page that is not one of this application's addresses (origin list + job id).
    const mintRes = await api(serverUrl, `/api/apply/gate-packets/${chosen.packetId}/token`, {
      method: 'POST', body: JSON.stringify({ url: tab.url }),
    });
    if (!mintRes.ok) {
      const err = await mintRes.json().catch(() => ({}));
      return { ok: false, reason: err.error || 'mint_failed', message: err.message || 'Could not prepare the handoff.' };
    }
    const minted = await mintRes.json();

    const exRes = await api(serverUrl, '/api/apply/gate-packet/exchange', {
      method: 'POST', body: JSON.stringify({ token: minted.token }),
    });
    if (!exRes.ok) {
      const err = await exRes.json().catch(() => ({}));
      return { ok: false, reason: err.error || 'exchange_failed', message: `Handoff refused: ${err.error || exRes.status}.` };
    }
    released = await exRes.json();
  } catch (e) {
    return { ok: false, reason: 'network_error', message: 'Could not reach Draft.', detail: e.message };
  }

  // Defence in depth: the server states the expected origin in the release too. If that disagrees
  // with the page, nothing is filled even though the token has already been spent — a burnt token is
  // cheap and a misplaced home address is not.
  // ⛔ D56: against the packet's ORIGIN LIST — never wider, and never filled outside it.
  if (!packetFillsOrigin(released, origin)) {
    await clearPacketForTab(tab.id);
    return { ok: false, reason: 'origin_mismatch_after_release', message: 'Origin mismatch. Nothing was filled.' };
  }

  await savePacketForTab(tab.id, released);
  return fillFromPacket({ tab, origin, released, serverUrl, reused: false, opts });
}

/**
 * D55 (c) — paint the one-line badge (extension/autofill-badge.js). A courtesy: a page that refuses
 * the injection still gets its fill and its overlay, so a failure here is reported, never raised.
 */
async function showBadge(tabId, state, meta = {}) {
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId }, func: renderBadge,
      args: [state, { ...meta, theme: { light: C_LIGHT, dark: C_DARK } }],
    });
    return r?.result || null;
  } catch (e) {
    return { rendered: false, error: e.message };
  }
}

// ── D55 (d): the wizard advance ──────────────────────────────────────────────────────────────

/**
 * What kind of question a label asks — used to say WHY the fill stopped, and (D55 rules) to refuse
 * to place a value where the candidate must decide. Order matters: an eligibility question that
 * mentions years ("authorized to work for the next 2 years") is eligibility first.
 */
export function questionKind(label) {
  const t = String(label || '').toLowerCase();
  if (/authori[sz]ed to work|eligib\w* to work|right to work|work permit|sponsor|visa|immigration|i-9|citizen/.test(t)) return 'eligibility';
  if (/marketing|newsletter|text messages|sms|whatsapp|promotional|opt[ -]?in|receive (?:\w+ ){0,3}(?:communications|updates|messages|emails|alerts)|talent (?:community|network)|job alerts/.test(t)) return 'opt_in';
  if (/\bgender\b|\bsex\b|ethnic|\brace\b|racial|hispanic|latino|veteran|disabilit|self[- ]?identif|pronoun|sexual orientation/.test(t)) return 'eeo';
  if (/terms and conditions|privacy (?:policy|notice)|i (?:have read|consent|agree|acknowledge|certify)|attest/.test(t)) return 'consent';
  if (/\d+\s*\+?\s*years|years of (?:\w+ ){0,3}experience|do you have (?:\w+ ){0,4}(?:experience|degree|certification|license)|are you (?:able|willing) to|willing to relocate|relocat|on-?site|in[- ]office|travel|security clearance|\bclearance\b|salary|compensation|notice period|previously (?:worked|been employed)|non-?compete|criminal|background check|drug (?:test|screen)/.test(t)) return 'screening';
  return 'other';
}

// Injected, ISOLATED world. Presses the portal's own Save and Continue — and nothing else.
// ⛔ ALLOWLIST, not a denylist: the control's text must READ "Save and Continue", "Continue" or
// "Next". Workday's Review step renders the SAME control (same automation id) reading "Submit"; a
// check keyed on the id, or one that merely refused the word "submit", would be one translation or
// one relabel ("Apply", "Send", "Finish") away from submitting. A control that would submit a
// <form> by its type is refused whatever it says.
function advanceWizard() {
  const continueText = /^(save and continue|save & continue|continue|next)$/i;
  // ⛔ D96 (J2 measured, 10-13): it pressed a HIDDEN Save and Continue on the sign-in step. Only a control the
  // candidate can SEE, enabled, is ever pressed — and never on a page with a password box (a sign-in or account page).
  const seen = (el) => {
    if (!el || !(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0;
  };
  if ([...document.querySelectorAll('input[type="password"]')].some(seen)) return { ok: false, reason: 'sign_in_page' };
  const btn = [...document.querySelectorAll('[data-automation-id="bottom-navigation-next-button"], [data-automation-id="pageFooterNextButton"]')].find(seen)
    || [...document.querySelectorAll('button, [role="button"]')].find(b => seen(b) && continueText.test(String(b.textContent || '').replace(/\s+/g, ' ').trim()));
  if (!btn) return { ok: false, reason: 'no_next_button' };
  const text = String(btn.textContent || '').replace(/\s+/g, ' ').trim();
  if (!continueText.test(text)) return { ok: false, reason: 'next_is_not_continue', text: text.slice(0, 40) };
  if (String(btn.getAttribute('type') || btn.type || '').toLowerCase() === 'submit' && btn.form) {
    return { ok: false, reason: 'next_would_submit_a_form', text };
  }
  if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return { ok: false, reason: 'next_disabled', text };
  btn.click();
  return { ok: true, text };
}

// Injected, ISOLATED world. Which step is showing, and whether the portal wrote its own errors.
function wizardState() {
  const step = String(
    document.querySelector('[data-automation-id="progressBarActiveStep"], [aria-current="step"]')?.textContent
    || document.querySelector('[data-automation-id="pageHeader"]')?.textContent || '').replace(/\s+/g, ' ').trim();
  const errors = document.querySelectorAll('[data-automation-id="errorMessage"], [data-automation-id="errorBanner"]:not([hidden])').length;
  return { step, errors };
}

const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * The candidate's turn. If a required field on this step is still empty — work authorisation, a
 * question that would rule them out, an EEO answer the profile does not state — say so on the badge
 * and wait, re-checking every 1.5 s, and carry on BY ITSELF once it is answered (the video's badge
 * flipping back to "in progress"). Bounded by the packet's lifetime; ended by the ×, by the tab
 * leaving the application, or by the grant lapsing.
 */
export const CANDIDATE_WAIT_MS = 9 * 60 * 1000;
async function waitForCandidate(tabId, origin, stepName, wizard, isCurrent = () => true) {
  const deadline = Date.now() + CANDIDATE_WAIT_MS;
  let recorded = false, lastCount = -1;
  for (;;) {
    if (!isCurrent()) return { ok: false, reason: 'superseded' };
    let missing;
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: findMissingRequired });
      missing = r?.result || [];
    } catch { return { ok: false, reason: 'grant_lost' }; }
    if (!missing.length) return { ok: true, waited: recorded };
    if (!recorded) {
      recorded = true;
      wizard.stops.push({ step: stepName, fields: missing.map(m => ({ label: m.label, kind: questionKind(m.label) })) });
    }
    if (missing.length !== lastCount) {
      lastCount = missing.length;
      const b = await showBadge(tabId, 'required', { missing });
      if (b?.dismissed) return { ok: false, reason: 'dismissed' };
    }
    try {
      const [d] = await chrome.scripting.executeScript({ target: { tabId }, func: badgeDismissed });
      if (d?.result === true) return { ok: false, reason: 'dismissed' };
      const t = await chrome.tabs.get(tabId);
      if (!t?.url || new URL(t.url).origin !== origin) return { ok: false, reason: 'left_the_application' };
    } catch { return { ok: false, reason: 'grant_lost' }; }
    if (Date.now() > deadline) return { ok: false, reason: 'waiting_for_you' };
    await sleepMs(1500);
  }
}

/**
 * D55 (l) — is this a form we recognise well enough to fill? Pure; decided before anything is typed.
 *   · a known adapter (a wizard the page announces, or Workday's own field ids) — yes;
 *   · nothing in the packet matches anything here — no;
 *   · a SIGN-IN form (a password box) the packet barely matches — no: the extension never signs in,
 *     and the email box of a login form is exactly where a home-address-carrying packet must not go;
 *   · two or more matches — yes; a single match is enough only when it is the page's only field.
 */
export function formRecognition(shape, plan = []) {
  const fields = shape?.fields || [];
  // ⛔ D96 (J2 measured, 10-13): on Workday's sign-in step the fill typed the candidate's email into the sign-in box —
  // the wizard shortcut below said "recognised" before the password rule could speak. A page with a password box is a
  // sign-in or account page whatever else it is: never filled, and the wizard never advances from it.
  if (shape?.hasPassword || fields.some(f => f.type === 'password')) {
    return { recognised: false, why: 'this looks like a sign-in form, not the application — draft never signs in for you' };
  }
  if (shape?.wizard || fields.some(f => f.automationId && WORKDAY_FIELD_IDS[f.automationId])) {
    return { recognised: true, adapter: 'workday' };
  }
  if (!plan.length) return { recognised: false, why: 'nothing in your prepared answers matches a field on this page' };
  const fillable = fields.filter(f => f.type !== 'file' && f.type !== 'password');
  if (fields.some(f => f.type === 'password') && plan.length < 3) {
    return { recognised: false, why: 'this looks like a sign-in form, not the application' };
  }
  if (plan.length >= 2 || fillable.length <= 1) return { recognised: true };
  return { recognised: false, why: `only ${plan.length} of ${fillable.length} fields matched` };
}

/** The sentence for a wizard run — where it stopped is the thing the candidate needs to know. */
export function wizardMessage(filledCount, wizard) {
  const steps = wizard?.steps?.length || 0;
  const head = `Filled ${filledCount} field(s) across ${steps} step(s)`;
  switch (wizard?.stoppedAt) {
    case 'review': return `${head} and stopped at Review. Check it, then submit yourself.`;
    case 'dismissed': return `${head}. Stopped — you closed the autofill badge.`;
    case 'waiting_for_you': return `${head}. Stopped waiting for the required fields on this step — answer them and press the shortcut again.`;
    case 'left_the_application':
    case 'grant_lost': return `${head}. Stopped — this tab left the application. Press the shortcut on the application to carry on.`;
    default: return `${head}. Could not move to the next step — check this one, then press Save and Continue yourself.`;
  }
}

/** Press Save and Continue, then wait for the next step to show — or for the portal to refuse. */
async function advanceAndWait(tabId, fromStep) {
  let pressed;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: advanceWizard });
    pressed = r?.result;
  } catch { return { ok: false, reason: 'grant_lost' }; }
  if (!pressed?.ok) return { ok: false, reason: pressed?.reason || 'no_next_button', text: pressed?.text };
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await sleepMs(250);
    let s;
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: wizardState });
      s = r?.result;
    } catch { return { ok: false, reason: 'grant_lost' }; }
    if (s?.step && s.step !== fromStep) { await sleepMs(250); return { ok: true, step: s.step }; }
    if (s?.errors) return { ok: false, reason: 'portal_refused' };
  }
  return { ok: false, reason: 'step_did_not_change' };
}

/**
 * D55 (b) — one review row per repeating-section entry that was actually placed, not one per field.
 *
 * Each panel's fields were matched by their LABELS inside a panel the extension opened, so the row
 * is a guess about the FIELD (matchedBy 'label') even though the value is the candidate's own: it
 * asks for one acknowledgement per job / degree / website, which is the unit the candidate checks,
 * instead of fifteen. Skills are one row. Nothing here is an attestation.
 */
export function entryReviewItems(entries, filled = []) {
  if (!entries) return [];
  const placed = new Map();
  for (const f of filled || []) if (f?.entry) placed.set(f.entry, (placed.get(f.entry) || 0) + 1);
  const year = (d) => (d?.year ? `${d.month ? String(d.month).padStart(2, '0') + '/' : ''}${d.year}` : '');
  const rows = [];
  const add = (kind, label, list, describe) => (list || []).forEach((e, i) => {
    const n = placed.get(`${kind}:${i}`) || 0;
    if (!n) return;
    rows.push({ field: `${label} ${i + 1}`, name: `entry:${kind}:${i}`, value: describe(e) || '—',
                provenance: 'field_map_exact', matchedBy: 'label', eligibility: false, entryFields: n });
  });
  add('work', 'Work experience', entries.work, (e) => [e.title, e.company,
    [year(e.from), e.current ? 'present' : year(e.to)].filter(Boolean).join('–')].filter(Boolean).join(' · '));
  add('education', 'Education', entries.education, (e) => [e.degree, e.field, e.school, year(e.to)].filter(Boolean).join(' · '));
  add('languages', 'Language', entries.languages, (e) => e.language);
  add('websites', 'Website', entries.websites, (e) => e.url);
  if (placed.get('skills')) {
    rows.push({ field: 'Skills', name: 'entry:skills', value: (entries.skills || []).join(', '),
                provenance: 'field_map_exact', matchedBy: 'label', eligibility: false });
  }
  return rows;
}

/**
 * A PDF from draft's server, as base64 (executeScript arguments must be JSON — a Blob cannot cross) and its name: the
 * server's Content-Disposition filename when it names one, else `fallbackName`. null on any failure. ⛔ draft's own
 * server only (authedFetch); the ONE place the extension turns a PDF response into bytes (the fill and the résumé panel).
 */
export async function fetchPdf(serverUrl, path, fallbackName = 'resume.pdf') {
  try {
    const res = await authedFetch(serverUrl, path);
    if (!res?.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const named = /filename="([^"]+)"/.exec(res.headers?.get?.('content-disposition') || '')?.[1] || null;
    return { base64: btoa(bin), fileName: named && /^[A-Za-z0-9_.-]{1,120}\.pdf$/.test(named) ? named : fallbackName, bytes: bytes.length };
  } catch { return null; /* the fill is still worth doing without it; reported by the caller */ }
}

async function fillFromPacket({ tab, origin, released, serverUrl, reused, opts = {} }) {
  let shape;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probeFormShape });
    shape = r?.result;
  } catch {
    return { ok: false, reason: 'no_access', message: 'Invoke the extension on the application tab.' };
  }
  if (!shape?.hasForm) return { ok: false, reason: 'no_form', message: 'No form on this page. Nothing was released.' };
  if (shape.origin !== origin) return { ok: false, reason: 'origin_moved', message: 'The page changed. Nothing was released.' };

  const answers = released.packet?.answers || [];

  // The resume travels as base64 because executeScript arguments must be JSON-serialisable — a Blob
  // cannot cross that boundary. Fetched HERE, in the extension, so the page never sees a credentialed
  // request to our server.
  //
  // ⭐ D98 §5 (J6): when the on-page résumé panel ATTACHED a résumé to this job, the fill attaches THAT file — the same
  // stored PDF, by the same name — and never generates another (progress.js resume.attached → the generation's
  // /pdf/file). Otherwise the packet's own résumé, as before.
  let resume = null;
  const panelResume = serverUrl ? await resumeFor(released.packet?.jobId).catch(() => null) : null;
  const resumePath = panelResume?.attached ? `/api/extension/resume/${encodeURIComponent(panelResume.id)}/pdf/file` : released.resumeUrl;
  if (resumePath && serverUrl) {
    const packetName = `resume-${released.packet?.jobId || 'application'}.pdf`;
    const pdf = await fetchPdf(serverUrl, resumePath, packetName);
    if (pdf) {
      resume = panelResume?.attached
        ? { base64: pdf.base64, filename: pdf.fileName, mimeType: 'application/pdf', fromPanel: true }
        : { base64: pdf.base64, filename: packetName, mimeType: 'application/pdf' };
    }
  }

  // ── D55 (l): A FORM WE DO NOT RECOGNISE IS SAID, AND LEFT ALONE ────────────────────────────
  // §8.3: "a visible 'this form isn't recognised' state — the extension says so and stops, rather
  // than half-filling." A page where the packet matches one box (the email field of a sign-in form)
  // is not an application we know, and typing the candidate's email into it is the half-fill that
  // reads as the extension working. Checked BEFORE anything is typed. The released packet stays
  // cached for this tab, so pressing the shortcut again on the real form costs no second token.
  const recognition = formRecognition(shape, matchAnswersToFields(answers, shape.fields).plan);
  if (!recognition.recognised) {
    // A panel an earlier fill drew for another step (measured on the fixture: G5's batch re-run on a reload painted
    // My Information's panel, then the step became Sign In) would describe a page that is not this one — it goes.
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: removeReviewPanel }); } catch { /* none there */ }
    const badgeNow = await showBadge(tab.id, 'unrecognised', { note: recognition.why });
    return {
      ok: false, reason: 'form_not_recognised', reused: !!reused, packetId: released.packetId,
      filled: [], why: recognition.why, badge: badgeNow,
      message: "This form isn't recognised — nothing was filled. Fill it yourself, or copy your answers " +
        'from the Copy sheet in the draft popup.',
    };
  }

  // D55 (c): the one-line badge says what the page is doing while the fill runs.
  await showBadge(tab.id, 'progress');

  // ── D55 (d): ONE PAGE, OR A WIZARD STEP BY STEP ─────────────────────────────────────────────
  // A single-page form is filled once, as it always was. A wizard (Workday) is filled one step at a
  // time: fill the step → if a REQUIRED field is still empty, stop and wait for the candidate
  // (badge: "Complete required fields") and carry on by itself once they have answered → press the
  // portal's OWN Save and Continue → re-probe the next step → repeat — and STOP AT REVIEW.
  // ⛔ Submit is never pressed (§7.1): advanceWizard presses only a control that reads Save and
  // Continue / Continue / Next, and Workday's Review button is that same control reading "Submit".
  //
  // On a wizard nothing already holding a value is overwritten (keepExisting): the candidate's own
  // answer, and the portal's prefill, outrank the packet on a step the fill comes back to.
  const plan = [], unmatched = [];
  const outcome = { filled: [], skipped: [], resume: null, sections: {} };
  const wizard = { steps: [], stops: [], advanced: 0, stoppedAt: null };
  let entriesLeft = released.packet?.entries || null;
  let step = shape;
  // ⭐ D96 §5 · THE PANEL IS DRAWN AT EVERY STEP, BEFORE THE WAIT. The wizard waits up to nine minutes for the
  // candidate on a step with an empty required field (J2 measured: the panel only appeared after that wait) — so the
  // step's rows are drawn first, and the candidate sees what needs them while draft waits. Rows of a step the wizard
  // has left are settled (settleStepRows); `panelRows` is the whole run's.
  let settledRows = [], stepRows = [];
  const panelMeta = await panelMetaFor({ tab, released, serverUrl, runId: opts.runId });
  // ⭐ ONE fill per tab: this run supersedes any earlier one still waiting here (ACTIVE_FILL, below).
  if (!opts.runId) ACTIVE_FILL.set(tab.id, panelMeta.runId);
  const isCurrent = () => ACTIVE_FILL.get(tab.id) === panelMeta.runId;
  for (let guard = 0; guard < 12; guard++) {
    if (step.wizard?.isReview) { wizard.stoppedAt = 'review'; break; }
    if (!isCurrent()) { wizard.stoppedAt = 'superseded'; break; }
    const matched = matchAnswersToFields(answers, step.fields);
    // D55 (f): then the packet's saved answers, worked-here answer and EEO declines, on the
    // questions the answers above did not take — by exact question equality (savedAnswerMatch.js).
    const stated = placeStatedAnswers(released.packet, step.fields, matched.plan, questionKind);
    matched.plan.push(...stated.plan);
    matched.unmatched.push(...stated.notes);
    // ⛔ D96 §4 safeguard 1, ENFORCED on the whole step's plan: no terms / consent / attestation / signature control,
    // and no password / payment one, is ever given a value — from the packet, a saved answer, or anything else.
    const guarded = withoutNeverFill(matched.plan, step.fields);
    matched.plan = guarded.plan;
    matched.unmatched.push(...guarded.refused);
    plan.push(...matched.plan);
    for (const u of matched.unmatched) if (!unmatched.some(x => x.name === u.name && x.field === u.field)) unmatched.push(u);
    let r;
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: applyPlan,
        // D55 (b): the packet's repeating-section entries travel with the plan; applyPlan opens one
        // panel per entry with the section's own Add / Add Another.
        args: [matched.plan, outcome.resume?.attached ? null : resume, Object.assign({ entries: entriesLeft, keepExisting: !!step.wizard }, fillOptions(opts))],
      });
      r = res?.result || {};
    } catch (e) {
      return { ok: false, reason: 'inject_failed', message: `Could not fill the form: ${e.message}` };
    }
    outcome.filled.push(...(r.filled || []));
    outcome.skipped.push(...(r.skipped || []));
    if (r.resume && !outcome.resume?.attached) outcome.resume = r.resume;
    Object.assign(outcome.sections, r.sections || {});
    // A section is filled once: the kinds this step opened are not offered again on later steps.
    if (entriesLeft && r.sections) {
      entriesLeft = { ...entriesLeft };
      for (const k of Object.keys(r.sections)) entriesLeft[k] = [];
    }
    // The step as it stands AFTER the fill — what each control holds now (emptiness only, never a value).
    const after = await probeAgain(tab.id);
    const stepName = step.wizard?.step || '';
    stepRows = panelRowsForStep({
      stepName, fields: withHoldsFrom(step.fields, after?.fields), plan: matched.plan,
      filled: r.filled || [], skipped: r.skipped || [], unmatched: matched.unmatched, resume: r.resume || null, kindOf: questionKind,
    }).concat(panelRowsFromItems(entryReviewItems(released.packet?.entries, r.filled || []), stepName));
    if (!step.wizard) break;
    wizard.steps.push({ step: step.wizard.step, filled: (r.filled || []).length });
    if (isCurrent()) await drawReviewPanel(tab.id, [...settledRows, ...stepRows], { ...panelMeta, currentStep: stepName, waiting: true,
      resumeAttached: outcome.resume?.attached === true });

    // Stop and wait — then advance. Up to three attempts per step: a portal that writes its own
    // "is required" error on Save and Continue sends the loop back to waiting.
    let advanced = null;
    for (let attempt = 0; attempt < 3 && !advanced; attempt++) {
      const waited = await waitForCandidate(tab.id, origin, step.wizard.step, wizard, isCurrent);
      if (!waited.ok) { wizard.stoppedAt = waited.reason; break; }
      if (!isCurrent()) { wizard.stoppedAt = 'superseded'; break; }
      await showBadge(tab.id, 'progress');
      const moved = await advanceAndWait(tab.id, step.wizard.step);
      if (moved.ok) advanced = moved;
      else if (moved.reason !== 'portal_refused') { wizard.stoppedAt = moved.reason; break; }
    }
    if (!advanced) { wizard.stoppedAt = wizard.stoppedAt || 'could_not_advance'; break; }
    wizard.advanced += 1;
    settledRows = settleStepRows([...settledRows, ...stepRows]);
    stepRows = [];
    try {
      const [p] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: probeFormShape });
      step = p?.result;
    } catch {
      wizard.stoppedAt = 'grant_lost';
      break;
    }
    // Same-origin is the whole permission (G0 §9): a wizard that wanders off the application's
    // addresses ends the run, and nothing more is filled.
    if (!step?.hasForm || !packetFillsOrigin(released, step.origin)) { wizard.stoppedAt = 'left_the_application'; break; }
  }
  const isWizard = wizard.steps.length > 0 || wizard.stoppedAt === 'review';
  const panelRows = [...settledRows, ...stepRows];
  const panel = panelSummary(panelRows);

  // ── The review overlay (TASK G3) ────────────────────────────────────────────
  // What was actually written, with the rule that produced each value, ordered so the candidate
  // reads the three uncertain fields instead of the thirty certain ones.
  // matchedBy travels with each item: the overlay combines it with the value's provenance, because
  // a certain value placed into a field matched only by its label is uncertain overall, and showing
  // it as "resolved exactly" would be the more dangerous half of the truth.
  // ⭐ D96 §5: the PANEL lists every field (panelRows, above); these items remain the audit's and the result's.
  const reviewItems = plan
    .filter(step => (outcome?.filled || []).some(f => f.name === step.name && f.field === step.label))
    .map(step => ({
      field: step.label, name: step.name, id: step.id, index: step.index,
      // D55 (a): a picker's value is the option it chose — the ATS's wording, what the employer reads.
      value: (outcome?.filled || []).find(f => f.name === step.name && f.field === step.label)?.placed ?? step.value,
      provenance: step.provenance, confidence: step.confidence,
      eligibility: step.eligibility, matchedBy: step.matchedBy,
    }))
    .concat(entryReviewItems(released.packet?.entries, outcome?.filled));

  const bands = orderForReview(reviewItems);
  const readiness = readinessOf(reviewItems);

  // Fetched before the overlay renders, because "3 more ready at amazon.jobs" is part of what the
  // candidate is deciding about — finding out after they have closed the tab is finding out too late.
  const portalForOverlay = serverUrl
    ? await portalQueueFor(serverUrl, origin, released.packetId)
    : { remaining: 0, next: null, packets: [] };

  // A newer fill took this tab over while this one waited: it draws nothing over the newer one's panel.
  if (!isCurrent()) {
    return { ok: false, reason: 'superseded', reused: !!reused, packetId: released.packetId, filled: outcome.filled, skipped: outcome.skipped,
      message: 'A newer fill on this page took over from this one.' };
  }
  ACTIVE_FILL.delete(tab.id);

  try {
    const [drawn] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // ISOLATED, unlike the fill: the overlay needs chrome.runtime to send edits back, and only the
      // isolated world has it. The DOM is shared either way, so it is still a real element on the
      // real page.
      func: renderOverlay,
      args: [{ rows: panelRows }, {
        ...panelMeta,
        currentStep: wizard.stoppedAt === 'review' ? null : (step?.wizard?.step || ''),
        filledCount: panel.filled,
        resumeAttached: outcome?.resume?.attached === true,
        resolverBug: readiness.resolverBug,
        portal: portalForOverlay,
        theme: await overlayTheme(),
      }],
    });
    if (drawn?.result?.ok === false) throw new Error(drawn.result.error || 'not drawn');
  } catch (e) {
    // A form filled without an overlay is degraded, not broken — the values are in the page and the
    // candidate can still read them. Reported rather than swallowed.
    return {
      ok: true, reused: !!reused, packetId: released.packetId,
      filled: outcome?.filled || [], skipped: outcome?.skipped || [], unmatched,
      resume: outcome?.resume || null,
      overlay: { rendered: false, error: e.message },
      fieldCount: shape.fields.length,
      panel: { filled: panel.filled, of: panel.total, needYou: panel.need, check: panel.check, ready: panel.ready },
      review: { ready: panel.ready, guessCount: readiness.guessCount },
      // D36: this used to be the SUCCESS sentence, word for word — so a fill whose review panel never
      // appeared (no eligibility pinned to the top, no guess to acknowledge) read exactly like one
      // that did, and the popup closed itself 1.2 s later. The overlay is what makes this
      // fill-and-review; without it the candidate has to be told to do the reviewing themselves.
      message: `Filled ${outcome?.filled?.length || 0} field(s), but the review panel could not open. ` +
        "Check every answer on the page yourself — especially work authorisation and sponsorship — before you submit.",
    };
  }
  // The 90-day reminder is shown in the panel ONCE per due period: reported shown (J8: POST review 'dismissed').
  if (panelMeta.review?.showInPanel) await dismissReviewReminder(serverUrl);

  // D55 (c)·(g): painted AFTER the overlay so it sits beside it rather than under it. "Filled —
  // review and submit" only when no required field is left empty; otherwise "Complete required
  // fields" — and on a single page it re-counts live and flips itself once the candidate has
  // answered, because Greenhouse validates only on Submit, which is never pressed for them.
  let missingAtEnd = [];
  try {
    const [m] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: findMissingRequired });
    missingAtEnd = m?.result || [];
  } catch { /* the badge then says done; the overlay still lists what was filled */ }
  const badge = await showBadge(tab.id, missingAtEnd.length ? 'required' : 'done',
    { missing: missingAtEnd, live: !isWizard || wizard.stoppedAt === 'review' });

  // ── Schema capture (TASK G4) ────────────────────────────────────────────────
  // The extension is standing inside a place the server can never reach. What goes back is the
  // form's SHAPE — labels, types, required flags, option lists, order — so the next candidate
  // through this portal arrives pre-mapped.
  //
  // The probe output from the target match is reused rather than the page being read a second time.
  // It already contains no values: probeFormShape reports what the form ASKS, never what is in it.
  // The server whitelists again on arrival, because a client-side promise is not an enforcement.
  //
  // Opt-in and default off. Asked every time rather than cached: consent that cannot be withdrawn
  // until a cache expires is not consent, and this is one request against our own server.
  // ⛔ D97 (J5): an AUTOMATIC fill never sends the form's structure — it runs without a click, so the opt-in capture
  // (which is for the next candidate, not this one) stays a thing only a fill the user started can do.
  const capture = opts.auto
    ? { attempted: false, reason: 'automatic_fill' }
    : await captureFormSchema({ serverUrl, origin, shape, released }).catch(() => null);

  const portal = portalForOverlay;
  if (portal.remaining > 0) {
    await saveBatchForTab(tab.id, { origin, host: portal.host, remaining: portal.remaining });
  } else {
    await clearBatchForTab(tab.id);
  }

  return {
    ok: true,
    reused: !!reused,
    packetId: released.packetId,
    runJobId: released.packet?.runJobId ?? null,
    portal,
    filled: outcome?.filled || [],
    skipped: outcome?.skipped || [],
    unmatched,
    // ⭐ D96 §3: "Filled 14 of 18 · 2 need you" — the form's field count and the required fields still empty.
    fieldCount: shape.fields.length,
    missingCount: missingAtEnd.length,
    // ⭐ D96 §3 / §5: the PANEL's own counts — what progress.js remembers, so the popup and the panel agree.
    panel: { filled: panel.filled, of: panel.total, needYou: panel.need, check: panel.check, ready: panel.ready },
    resume: outcome?.resume || (released.resumeUrl ? { attached: false, reason: 'fetch_failed' } : null),
    overlay: { rendered: true, rows: reviewItems.length },
    badge,
    capture,
    review: {
      // ⛔ D96 §5: "Ready" only when nothing needs you AND at least one field was filled — the panel's rule.
      ready: panel.ready,
      guessCount: readiness.guessCount,
      eligibilityCount: bands.eligibility.length,
      uncertainCount: bands.uncertain.length,
      settledCount: bands.settled.length,
      // A fuzzy eligibility match is a resolver defect, not something to ask the candidate about.
      resolverBug: readiness.resolverBug,
    },
    // D55 (d): which steps were filled and advanced, where the candidate was asked, and where it stopped.
    wizard: isWizard ? wizard : null,
    sections: outcome.sections,
    // Never auto-submitted. The last action is the candidate's — §6, without exception.
    message: isWizard
      ? wizardMessage(outcome?.filled?.length || 0, wizard)
      : `Filled ${outcome?.filled?.length || 0} field(s). Review and submit yourself.`,
  };
}

/**
 * ⭐ D96 §5 (J4) · ONE FILL PER TAB. A fill started on a tab supersedes an earlier one still waiting there for the
 * candidate: the older stops, never presses Save and Continue, and draws nothing more. Measured on the fixture (10-13):
 * a fill left waiting kept polling after the page was reloaded, and later painted its stale panel over the new one.
 * Service-worker memory only — nothing stored.
 */
const ACTIVE_FILL = new Map();
let FILL_SEQ = 0;

// ── D96 §5 · the panel's helpers ─────────────────────────────────────────────────────────────────────────────────

/** applyPlan's options that every fill passes — the never-fill rule's text, for the page-side last line. */
function fillOptions(opts = {}) {
  // `opts` is the fill's own options object; none of it widens what is filled. D97 (J5): `auto` marks a fill draft started
  // by itself (Options → Fill automatically) — applyPlan's never-fill rule is the same either way.
  if (opts.auto) return { neverFillSource: NEVER_FILL_RE.source, auto: true };
  return { neverFillSource: NEVER_FILL_RE.source };
}

/** A re-read of the step after the fill — the probe again (labels and emptiness only). null when it cannot. */
async function probeAgain(tabId) {
  try {
    const [p] = await chrome.scripting.executeScript({ target: { tabId }, func: probeFormShape });
    return p?.result || null;
  } catch { return null; }
}

/**
 * The step's fields with `hasValue` as the page holds it AFTER the fill. Matched by id, else by name and label — a
 * section the fill opened adds controls, so positions after the fill are not positions before it.
 */
export function withHoldsFrom(before = [], after = null) {
  if (!Array.isArray(after) || !after.length) return before;
  const byId = new Map(after.filter(f => f.id).map(f => [f.id, f]));
  return before.map(f => {
    const a = (f.id && byId.get(f.id)) || after.find(x => !x.id && x.name === f.name && x.label === f.label && x.type === f.type);
    return a ? { ...f, hasValue: !!a.hasValue } : f;
  });
}

/** What every draw of the panel shares: one run id, the remembered dock side, the review reminder. */
async function panelMetaFor({ tab, released, serverUrl, runId = null }) {
  const bound = await bindingForTab(tab).catch(() => null);
  const review = await reviewReminderFor(serverUrl);
  return {
    runId: runId || `${released?.packetId ?? 'p'}-${Date.now()}`,
    dock: bound?.panelDock === 'left' ? 'left' : 'right',
    review,
    theme: await overlayTheme(),
  };
}

/** One draw of the panel at a wizard step. A failure here never stops the fill — the final draw reports. */
async function drawReviewPanel(tabId, rows, meta) {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: renderOverlay, args: [{ rows }, meta] });
    return r?.result || null;
  } catch (e) { return { ok: false, error: e.message }; }
}

/**
 * ⭐ D96 §4 safeguard 4 · the quiet 90-day reminder for eligibility and disclosure answers (J8: GET
 * /api/saved-answers/review). The panel shows it once per due period; never blocking. null when there is none.
 */
export function reviewReminderText(reviewDue) {
  if (!reviewDue?.due) return null;
  let when = '';
  try { when = new Date(reviewDue.lastReviewedAt).toLocaleDateString('en-US', { month: 'long' }); } catch { /* no date */ }
  return `You last reviewed your eligibility and disclosure answers${when ? ` in ${when}` : ''} — check them in draft Settings → Saved answers.`;
}
async function reviewReminderFor(serverUrl) {
  if (!serverUrl) return null;
  try {
    const res = await api(serverUrl, '/api/saved-answers/review');
    if (!res.ok) return null;
    const body = await res.json();
    const d = body?.reviewDue;
    return d?.showInPanel ? { showInPanel: true, text: reviewReminderText(d) } : null;
  } catch { return null; }
}
async function dismissReviewReminder(serverUrl) {
  try { await api(serverUrl, '/api/saved-answers/review', { method: 'POST', body: JSON.stringify({ action: 'dismissed' }) }); } catch { /* shown again next time */ }
}

/**
 * Send the form's structure back, if this candidate has turned capture on.
 *
 * STRUCTURE ONLY, and the shape passed in is the same one used to decide whether to release the
 * packet at all — so there is no second read of the page and no opportunity for a value to be picked
 * up on the way. `current_value` does not exist in probeFormShape's output; the server's whitelist
 * is what makes that hold for every other producer too.
 *
 * Never allowed to affect the fill. A candidate's application does not depend on our bookkeeping, so
 * every failure here is swallowed and reported as a result field rather than raised.
 */
async function captureFormSchema({ serverUrl, origin, shape, released }) {
  if (!serverUrl || !shape?.fields?.length) return { attempted: false, reason: 'nothing_to_capture' };

  try {
    const consentRes = await api(serverUrl, '/api/apply/form-schema/consent');
    if (!consentRes.ok) return { attempted: false, reason: 'consent_unreadable' };
    const { enabled } = await consentRes.json();
    if (!enabled) return { attempted: false, reason: 'not_enabled' };
  } catch {
    return { attempted: false, reason: 'consent_unreadable' };
  }

  try {
    const res = await api(serverUrl, '/api/apply/form-schema', {
      method: 'POST',
      body: JSON.stringify({
        applyUrl: shape.url || origin,
        jobId: released.packet?.jobId ?? null,
        // Deliberately NOT the packet's answers, and deliberately not the filled DOM: the fields as
        // the form presented them, before anything was written into it.
        fields: shape.fields.map(f => ({
          order: f.index, label: f.label, type: f.type, required: f.required,
          options: f.options || [], name: f.name || f.id,
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { attempted: true, ok: false, reason: err.error || `http_${res.status}` };
    }
    const body = await res.json();
    return { attempted: true, ok: true, changed: body.changed, fieldCount: body.fieldCount,
             unmappedCount: body.unmappedCount, status: body.status };
  } catch (e) {
    return { attempted: true, ok: false, reason: 'network_error' };
  }
}

// ── Edits from the overlay ───────────────────────────────────────────────────

/**
 * Write one corrected value into the real input.
 *
 * Goes through the same MAIN-world native-setter path the fill uses (G2 requirement 4, which G3
 * requirement 3 explicitly requires it reuse). A correction written any other way is reverted by the
 * page's next render, and the candidate would be looking at their own value on a form that no longer
 * holds it.
 */
// ── D56 · the manual route, from the extension ───────────────────────────────

const pageUrlOf = (tab) => {
  try { const u = new URL(tab?.url || ''); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; }
};

/**
 * ⭐ "Prepare this application" — ONE click: the server maps this page to the user's job and builds the
 * packet on demand, then the SAME handoff runs straight away under the same gesture's grant. Every
 * check of the ordinary handoff still applies to the fill; nothing here is a second release path.
 */
export async function prepareAndFill({ serverUrl, tab, ...opts }) {
  const url = pageUrlOf(tab);
  if (!tab?.id || !url) return { ok: false, reason: 'unsupported_scheme', message: 'Only http(s) pages can be filled.' };
  let body;
  try {
    const bound = await bindingForTab(tab);
    const res = await api(serverUrl, '/api/apply/prepare', { method: 'POST', body: JSON.stringify({ url, boundJobId: bound?.jobId ?? null }) });
    if (res.status === 401) return { ok: false, reason: 'not_signed_in', message: 'Sign in to Draft first.' };
    body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: body.error || 'prepare_failed', message: body.message || 'Could not prepare this application.' };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: 'Could not reach Draft.', detail: e.message };
  }
  await notePrepared(body);   // ⭐ D96 §3: "Answers prepared" — the packet's id, the packet itself stays on the server
  // Prepared, but this page is not one of its addresses: say so — never fill it anyway.
  if (!packetFillsOrigin(body, new URL(url).origin)) {
    return { ok: false, reason: 'not_this_address', message: body.message, prepared: true, addresses: body.origins || null };
  }
  // D97 (J5): "Prepare automatically" builds the packet and stops — the fill is its own switch (`fill: false`).
  if (opts.fill === false) return { ok: true, prepared: true, packetId: body.packetId ?? null, job: body.job || null, message: body.message || null };
  const { fill: _fill, ...fillOpts } = opts;
  const filled = await runGatedHandoff({ serverUrl, tab, ...fillOpts });
  return { ...filled, prepared: true, resume: body.resume || null };
}

/**
 * ⭐ "I submitted" — from the popup and the review overlay. The job is the released packet's when this
 * tab holds one, else whatever the server maps the page to; the page's own URL is the evidence. The
 * server writes job_applications only when that evidence verifies (A63) — with the tailored score.
 */
export async function recordSubmitted({ serverUrl, tab }) {
  const url = pageUrlOf(tab);
  if (!url) return { ok: false, message: 'Only http(s) pages can be recorded.' };
  const held = tab?.id ? await loadPacketForTab(tab.id).catch(() => null) : null;
  const bound = await bindingForTab(tab);
  try {
    const res = await api(serverUrl, '/api/apply/handoff/submitted', {
      method: 'POST', body: JSON.stringify({ url, jobId: held?.packet?.jobId ?? null, boundJobId: bound?.jobId ?? null }),
    });
    const body = await res.json().catch(() => ({}));
    const result = { ok: res.ok && !!body.ok, ...body, message: body.message || `Server returned ${res.status}.` };
    await noteSubmitted(result, { jobId: held?.packet?.jobId ?? bound?.jobId ?? null });   // ⭐ D96 §3: "Submitted"
    return result;
  } catch (e) {
    return { ok: false, message: 'Could not reach Draft.' };
  }
}

/** ⭐ §8 row 17 — the Copy sheet's rows: the bound job's PREPARED answers when the tab is bound. Nothing enters a field. */
export async function copySheetFor({ serverUrl, tab }) {
  const bound = await bindingForTab(tab);
  try {
    const res = await api(serverUrl, '/api/apply/copy-sheet', {
      method: 'POST', body: JSON.stringify({ url: pageUrlOf(tab), boundJobId: bound?.jobId ?? null }),
    });
    if (!res.ok) return { ok: false, rows: [], message: `Server returned ${res.status}.` };
    const sheet = { ok: true, ...(await res.json()) };
    // ⭐ D98 §5 (J6): the résumé the on-page panel attached is part of the payload — "Résumé — attached ✓", its file
    // named (the server's name for it; nothing about it is stored in the browser but the generation's id).
    const panel = await resumeFor(sheet.job?.jobId ?? bound?.jobId).catch(() => null);
    if (panel?.attached) {
      const view = await api(serverUrl, `/api/extension/resume/${encodeURIComponent(panel.id)}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (view?.pdf?.fileName) sheet.rows = [{ label: 'Résumé — attached ✓', value: view.pdf.fileName, resume: true }, ...(sheet.rows || [])];
    }
    return sheet;
  } catch {
    return { ok: false, rows: [], message: 'Could not reach Draft.' };
  }
}

/** The D56 answer for the popup's companion — packets for this page, or which case it is, and the notice. */
export async function pageMatchFor(serverUrl, tab) {
  const url = pageUrlOf(tab);
  if (!url) return null;
  const bound = await bindingForTab(tab);
  try {
    const res = await api(serverUrl, '/api/apply/handoff/match', { method: 'POST', body: JSON.stringify({ url, boundJobId: bound?.jobId ?? null }) });
    if (!res.ok) return null;
    const body = await res.json();
    const origin = new URL(url).origin;
    // The same origin check as the handoff: a packet is offered only where it may be filled.
    return { ...body, packets: (body.packets || []).filter(p => packetFillsOrigin(p, origin)) };
  } catch { return null; }
}

/**
 * ⭐ D96 §5 · the steps that put ONE panel value into the page's control(s): a radio group picks the option whose
 * label IS the value; a checkbox group ticks exactly the named boxes and unticks the rest; a date types each part in
 * the page's own order (month / day / year); anything else is one value. [] when the value is not one the control
 * can hold — never a nearest guess. ⛔ A never-fillable control yields no step at all.
 */
export function overlayEditSteps(field = {}, value = '') {
  const loc = Array.isArray(field.locator) && field.locator.length ? field.locator : [field];
  const asStep = (l, v) => ({ index: l.index, name: l.name ?? null, id: l.id ?? null, label: l.label ?? field.label ?? '', value: v });
  const n = (s) => normaliseQuestion(s);
  if (neverFillReasonOfField({ label: field.question || field.label, name: field.name, id: field.id, automationId: field.automationId })) return [];
  if (field.unitKind === 'radio') {
    const t = loc.find(l => n(l.choice ?? l.label) === n(value));
    return t ? [asStep(t, 'true')] : [];
  }
  if (field.unitKind === 'checkbox-group') {
    const want = String(value).split(/s*,s*/).map(n).filter(Boolean);
    const choices = loc.map(l => n(l.choice ?? l.label));
    if (!want.length || want.some(w => !choices.includes(w))) return [];
    return loc.map(l => asStep(l, want.includes(n(l.choice ?? l.label)) ? 'true' : 'false'));
  }
  if (field.unitKind === 'date') {
    const d = dateParts(value);
    if (!d) return [];
    const two = (x) => String(Number(x)).padStart(2, '0');
    const out = [];
    for (const l of loc) {
      const v = l.part === 'year' ? d.year : l.part === 'month' ? d.month : l.part === 'day' ? d.day : null;
      if (v == null) return [];
      out.push(asStep(l, l.part === 'year' ? String(v) : two(v)));
    }
    return out;
  }
  return [asStep(loc[0], String(value))];
}

export async function applyOverlayEdit({ tabId, field, value }) {
  const steps = overlayEditSteps(field, value);
  if (!steps.length) return { filled: [], skipped: [{ field: field?.label ?? null, reason: 'value_not_in_options' }] };
  const [r] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: applyPlan, args: [steps, null, { neverFillSource: NEVER_FILL_RE.source }],
  });
  return r?.result || null;
}

// For the real-Chrome tests only (test/j4PanelBrowser.test.js): the page-side functions as the fill serialises them.
export const __probeSource = probeFormShape.toString();
export const __applyPlanSource = applyPlan.toString();
export const __advanceWizardSource = advanceWizard.toString();
export const NEVER_FILL_SOURCE = NEVER_FILL_RE.source;
