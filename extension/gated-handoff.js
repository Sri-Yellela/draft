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

import { orderForReview, readinessOf, renderOverlay } from './review-overlay.js';
import { C_LIGHT, C_DARK } from './tokens.js';

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
  const form = document.querySelector('form');
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
    el => el.getAttribute('aria-haspopup') === 'listbox' ||
      !['hidden', 'submit', 'button', 'image', 'reset'].includes((el.type || '').toLowerCase())
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

  return {
    hasForm: !!form,
    url: location.href,
    origin: location.origin,
    fields: controls.map((el, index) => ({
      index,
      name: el.name || null,
      id: el.id || null,
      type: (el.type || el.tagName).toLowerCase(),
      label: labelFor(el).slice(0, 200),
      required: el.required === true || el.getAttribute('aria-required') === 'true',
      options: el.tagName === 'SELECT'
        ? [...el.options].map(o => ({ value: o.value, text: (o.text || '').trim() })) : null,
      // D55 (a): which custom widget this is, so the plan and the review can say "typed and picked"
      // rather than "set". A typeahead is an <input> that announces a popup list; a dropdown is a
      // non-input that does. Neither has options to report — they exist only once it is opened.
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
async function applyPlan(plan, resume) {
  const form = document.querySelector('form');
  const scope = form || document;
  // ⛔ MUST STAY BYTE-IDENTICAL TO probeFormShape'S. See the note there — the plan addresses
  // controls by position, so the two enumerations have to agree.
  const controls = [...scope.querySelectorAll(
    'input, select, textarea, [role="combobox"], [contenteditable=""], [contenteditable="true"], button[aria-haspopup="listbox"]'
  )].filter(
    el => el.getAttribute('aria-haspopup') === 'listbox' ||
      !['hidden', 'submit', 'button', 'image', 'reset'].includes((el.type || '').toLowerCase())
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
  const setCombobox = async (el, want) => {
    el.click();
    const options = (await waitFor(() => readyOptions(el), 2500)) || [];
    const idx = closestOption(want, options.map(o => o.textContent || ''));
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
        if (!hits.length) { skipped.push({ field: step.label, reason: 'value_not_in_options' }); continue; }
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
        if (!match) { skipped.push({ field: step.label, reason: 'value_not_in_options' }); continue; }
        nativeSetter(el, match.value);
        pending.push({ step, el, kind: 'value', want: match.value });
      } else if (isTypeahead(el)) {
        // An array is a multi-select (one chip per value); a string is one pick.
        const wants = (Array.isArray(step.value) ? step.value : [step.value])
          .map(v => String(v ?? '').trim()).filter(Boolean);
        const { picked, missed } = await setTypeahead(el, wants);
        for (const m of missed) skipped.push({ field: step.label, reason: 'no_close_option', wanted: m.slice(0, 80) });
        if (!picked.length) continue;
        pending.push({ step, el, kind: 'typeahead', want: picked.map(p => p.got) });
      } else if (isCombo(el)) {
        const got = await setCombobox(el, step.value);
        if (!got) {
          skipped.push({ field: step.label, reason: 'value_not_in_options' });
          continue;
        }
        pending.push({ step, el, kind: 'combo', want: got });
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

  for (const { step, el, kind, want } of pending) {
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
                    ...(kind === 'combo' || kind === 'typeahead' ? { placed: got } : {}) });
    } else {
      // The value did not stick. Named distinctly from `field_moved` because the remedy differs:
      // this one means the page actively rejected or overwrote what we wrote.
      skipped.push({
        field: step.label, reason: 'reverted_after_set',
        wanted: String(want).slice(0, 80), got: String(got).slice(0, 80),
      });
    }
  }

  // ── The resume ─────────────────────────────────────────────────────────────
  // The piece usually assumed impossible (§5): a File can be constructed and handed to a real file
  // input through a DataTransfer. Without this the candidate still has to attach the resume by hand,
  // which is most of the work the handoff was supposed to remove.
  let resumeResult = null;
  if (resume && resume.base64) {
    const fileInput = [...scope.querySelectorAll('input[type="file"]')][0];
    if (!fileInput) {
      resumeResult = { attached: false, reason: 'no_file_input' };
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
        resumeResult = {
          // Reported separately from `attached` on purpose. The property being set is not evidence
          // the page noticed; only the page's own rendering of the filename is (G2 requirement 5).
          attached: fileInput.files.length === 1 && fileInput.files[0].name === resume.filename,
          filename: resume.filename,
          size: file.size,
        };
      } catch (e) {
        resumeResult = { attached: false, reason: `error:${e.message}` };
      }
    }
  }

  return { filled, skipped, resume: resumeResult, fieldCount: controls.length };
}

// ── Matching ─────────────────────────────────────────────────────────────────

const normalise = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

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
      (a.field_id && f.id && f.id === a.field_id)
    ));

  const byLabel = (a) => {
    const want = normalise(a.field);
    if (!want) return null;
    return fields.find(f => !taken.has(f.index) && normalise(f.label) === want)
        || fields.find(f => !taken.has(f.index) && f.name && normalise(f.name) === normalise(a.name));
  };

  for (const a of answers) {
    if (a.value === null || a.value === undefined || a.value === '') continue;
    if (Array.isArray(a.value) && a.value.length === 0) continue;   // D55: an empty chip set says nothing

    let field = byExact(a);
    let how = field ? 'exact' : null;

    if (!field && !a.eligibility) { field = byLabel(a); how = field ? 'label' : null; }
    if (!field && a.eligibility) {
      unmatched.push({
        field: a.field, name: a.name, eligibility: true,
        reason: 'eligibility_requires_exact_match',
      });
      continue;
    }
    if (!field) { unmatched.push({ field: a.field, name: a.name, reason: 'no_matching_control' }); continue; }

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

export async function savePacketForTab(tabId, payload) {
  await chrome.storage.session.set({
    [sessionKey(tabId)]: { ...payload, storedAt: Date.now(), expiresAt: Date.now() + PACKET_TTL_MS },
  });
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
export async function runGatedHandoff({ serverUrl, tab }) {
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
    return fillFromPacket({ tab, origin, released: cached, serverUrl, reused: true });
  }

  let list;
  try {
    // ⛔ D56: the page's URL goes in the BODY of one question — "which packets may fill THIS page, and
    // if none, why?" The server matches on the packet's ORIGIN LIST and, where the URL carries one, the
    // JOB ID (one URL parser, the server's), and says which of the three truthful cases this is.
    let res = await api(serverUrl, '/api/apply/handoff/match', {
      method: 'POST', body: JSON.stringify({ url: tab.url }),
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
      message: list.message || "Nothing is prepared for this page. If draft knows this job, press \"Prepare this application\" in the draft popup; if not, capture it first.",
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
  return fillFromPacket({ tab, origin, released, serverUrl, reused: false });
}

async function fillFromPacket({ tab, origin, released, serverUrl, reused }) {
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
  const { plan, unmatched } = matchAnswersToFields(answers, shape.fields);

  // The resume travels as base64 because executeScript arguments must be JSON-serialisable — a Blob
  // cannot cross that boundary. Fetched HERE, in the extension, so the page never sees a credentialed
  // request to our server.
  let resume = null;
  if (released.resumeUrl && serverUrl) {
    try {
      const res = await authedFetch(serverUrl, released.resumeUrl);
      if (res?.ok) {
        const buf = await res.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        resume = {
          base64: btoa(bin),
          filename: `resume-${released.packet?.jobId || 'application'}.pdf`,
          mimeType: 'application/pdf',
        };
      }
    } catch { /* the fill is still worth doing without it; reported below */ }
  }

  let outcome;
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: applyPlan,
      args: [plan, resume],
    });
    outcome = r?.result;
  } catch (e) {
    return { ok: false, reason: 'inject_failed', message: `Could not fill the form: ${e.message}` };
  }

  // ── The review overlay (TASK G3) ────────────────────────────────────────────
  // What was actually written, with the rule that produced each value, ordered so the candidate
  // reads the three uncertain fields instead of the thirty certain ones.
  // matchedBy travels with each item: the overlay combines it with the value's provenance, because
  // a certain value placed into a field matched only by its label is uncertain overall, and showing
  // it as "resolved exactly" would be the more dangerous half of the truth.
  const reviewItems = plan
    .filter(step => (outcome?.filled || []).some(f => f.name === step.name && f.field === step.label))
    .map(step => ({
      field: step.label, name: step.name, id: step.id, index: step.index,
      value: step.value, provenance: step.provenance, confidence: step.confidence,
      eligibility: step.eligibility, matchedBy: step.matchedBy,
    }));

  const bands = orderForReview(reviewItems);
  const readiness = readinessOf(reviewItems);

  // Fetched before the overlay renders, because "3 more ready at amazon.jobs" is part of what the
  // candidate is deciding about — finding out after they have closed the tab is finding out too late.
  const portalForOverlay = serverUrl
    ? await portalQueueFor(serverUrl, origin, released.packetId)
    : { remaining: 0, next: null, packets: [] };

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      // ISOLATED, unlike the fill: the overlay needs chrome.runtime to send edits back, and only the
      // isolated world has it. The DOM is shared either way, so it is still a real element on the
      // real page.
      func: renderOverlay,
      args: [bands, {
        filledCount: outcome?.filled?.length || 0,
        resumeAttached: outcome?.resume?.attached === true,
        resolverBug: readiness.resolverBug,
        portal: portalForOverlay,
        theme: await overlayTheme(),
      }],
    });
  } catch (e) {
    // A form filled without an overlay is degraded, not broken — the values are in the page and the
    // candidate can still read them. Reported rather than swallowed.
    return {
      ok: true, reused: !!reused, packetId: released.packetId,
      filled: outcome?.filled || [], skipped: outcome?.skipped || [], unmatched,
      resume: outcome?.resume || null,
      overlay: { rendered: false, error: e.message },
      review: { ready: readiness.ready, guessCount: readiness.guessCount },
      // D36: this used to be the SUCCESS sentence, word for word — so a fill whose review panel never
      // appeared (no eligibility pinned to the top, no guess to acknowledge) read exactly like one
      // that did, and the popup closed itself 1.2 s later. The overlay is what makes this
      // fill-and-review; without it the candidate has to be told to do the reviewing themselves.
      message: `Filled ${outcome?.filled?.length || 0} field(s), but the review panel could not open. ` +
        "Check every answer on the page yourself — especially work authorisation and sponsorship — before you submit.",
    };
  }

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
  const capture = await captureFormSchema({
    serverUrl, origin, shape, released,
  }).catch(() => null);

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
    resume: outcome?.resume || (released.resumeUrl ? { attached: false, reason: 'fetch_failed' } : null),
    overlay: { rendered: true, rows: reviewItems.length },
    capture,
    review: {
      ready: readiness.ready,
      guessCount: readiness.guessCount,
      eligibilityCount: bands.eligibility.length,
      uncertainCount: bands.uncertain.length,
      settledCount: bands.settled.length,
      // A fuzzy eligibility match is a resolver defect, not something to ask the candidate about.
      resolverBug: readiness.resolverBug,
    },
    // Never auto-submitted. The last action is the candidate's — §6, without exception.
    message: `Filled ${outcome?.filled?.length || 0} field(s). Review and submit yourself.`,
  };
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
export async function prepareAndFill({ serverUrl, tab }) {
  const url = pageUrlOf(tab);
  if (!tab?.id || !url) return { ok: false, reason: 'unsupported_scheme', message: 'Only http(s) pages can be filled.' };
  let body;
  try {
    const res = await api(serverUrl, '/api/apply/prepare', { method: 'POST', body: JSON.stringify({ url }) });
    if (res.status === 401) return { ok: false, reason: 'not_signed_in', message: 'Sign in to Draft first.' };
    body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: body.error || 'prepare_failed', message: body.message || 'Could not prepare this application.' };
  } catch (e) {
    return { ok: false, reason: 'network_error', message: 'Could not reach Draft.', detail: e.message };
  }
  // Prepared, but this page is not one of its addresses: say so — never fill it anyway.
  if (!packetFillsOrigin(body, new URL(url).origin)) {
    return { ok: false, reason: 'not_this_address', message: body.message, prepared: true, addresses: body.origins || null };
  }
  const filled = await runGatedHandoff({ serverUrl, tab });
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
  try {
    const res = await api(serverUrl, '/api/apply/handoff/submitted', {
      method: 'POST', body: JSON.stringify({ url, jobId: held?.packet?.jobId ?? null }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && !!body.ok, ...body, message: body.message || `Server returned ${res.status}.` };
  } catch (e) {
    return { ok: false, message: 'Could not reach Draft.' };
  }
}

/** ⭐ §8 row 17 — the Copy sheet's rows. Shown in the popup only; nothing enters the page. */
export async function copySheetFor({ serverUrl, tab }) {
  try {
    const res = await api(serverUrl, '/api/apply/copy-sheet', {
      method: 'POST', body: JSON.stringify({ url: pageUrlOf(tab) }),
    });
    if (!res.ok) return { ok: false, rows: [], message: `Server returned ${res.status}.` };
    return { ok: true, ...(await res.json()) };
  } catch {
    return { ok: false, rows: [], message: 'Could not reach Draft.' };
  }
}

/** The D56 answer for the popup's companion — packets for this page, or which case it is, and the notice. */
export async function pageMatchFor(serverUrl, tab) {
  const url = pageUrlOf(tab);
  if (!url) return null;
  try {
    const res = await api(serverUrl, '/api/apply/handoff/match', { method: 'POST', body: JSON.stringify({ url }) });
    if (!res.ok) return null;
    const body = await res.json();
    const origin = new URL(url).origin;
    // The same origin check as the handoff: a packet is offered only where it may be filled.
    return { ...body, packets: (body.packets || []).filter(p => packetFillsOrigin(p, origin)) };
  } catch { return null; }
}

export async function applyOverlayEdit({ tabId, field, value }) {
  const step = { index: field.index, name: field.name, id: field.id, label: field.label, value };
  const [r] = await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', func: applyPlan, args: [[step], null],
  });
  return r?.result || null;
}
