/**
 * Provenance overlay (TASK G3).
 * ---------------------------------------------------------------------------------------------
 * Replaces "read the whole form and check it" with "approve three uncertain fields."
 *
 * The resolver already knows whether each value came from an exact handler hit or a fuzzy label
 * guess (services/applyAutomation.js PROVENANCE). That distinction was never shown to anyone. Here
 * it becomes the ordering, and the ordering is the entire feature: two minutes reading thirty
 * certain fields becomes ten seconds checking three uncertain ones, and the audit trail falls out
 * for free.
 *
 * WHAT GOES FIRST, AND WHY IT IS NOT CONFIDENCE
 * Eligibility answers pin to the top REGARDLESS of confidence. A work-authorization answer that the
 * resolver is completely certain about is still an attestation to an employer — the candidate is the
 * only one who can make it, and being sure is not the same as being entitled to make it for them
 * (§6). Everything else sorts by how much doubt there is.
 *
 * The overlay never submits. It hands back to the candidate, who does.
 */

// Mirrors services/applyAutomation.js. Duplicated because an extension cannot import from the
// server, and asserted equal to the server's table by test/reviewOverlay.test.js so the two cannot
// drift into disagreeing about what a provenance tier is worth.
export const CONFIDENCE_BY_PROVENANCE = {
  handler_exact:   1.0,
  field_map_exact: 0.9,
  label_exact:     0.85,
  custom_answer:   0.85,
  label_fuzzy:     0.3,
  default:         0.1,
  // Sponsorship answers are computed for the tense the question asks about, never read off a
  // stored yes/no. 'derived' had an explicit tense to read; 'assumed_future' did not, and took the
  // disclosing reading — which is a judgement, so it sits below LOW_CONFIDENCE deliberately.
  sponsorship_derived:        1.0,
  sponsorship_assumed_future: 0.75,
};

/** Below this an answer may not be auto-submitted; here, it is what "uncertain" means. */
export const LOW_CONFIDENCE = 0.8;

/** A guess, not a resolution. Requires an explicit acknowledgement (requirement 4). */
// `sponsorship_assumed_future` is here because the question named no tense, so the reading — not
// the candidate's situation — was inferred. That is an attestation about the right to work, and it
// should not be submitted without the candidate saying yes to it.
export const GUESS_PROVENANCE = new Set(['label_fuzzy', 'default', 'sponsorship_assumed_future']);

export const TIER_LABEL = {
  handler_exact:   'exact',
  field_map_exact: 'exact',
  label_exact:     'label',
  custom_answer:   'your answer',
  label_fuzzy:     'guess',
  default:         'guess',
  sponsorship_derived:        'derived',
  sponsorship_assumed_future: 'assumed',
};

/**
 * How sure we are that this value belongs in THIS control.
 *
 * Separate from provenance, which is about where the VALUE came from. The two are independent and
 * the review needs both: a value the resolver is certain of, dropped into a field matched only
 * because its label looked similar, is exactly the kind of uncertainty this overlay exists to
 * surface — and showing it as "resolved exactly" because the value was, is the more dangerous half
 * of the truth. The first version did precisely that, and the trap form's "Current Company" sat in
 * the collapsed section with nothing to acknowledge.
 */
export const MATCH_CONFIDENCE = { exact: 1.0, label: 0.5 };

/**
 * Normalise one filled field into what the overlay renders. The single place the two kinds of
 * uncertainty are combined, so ordering and readiness cannot disagree about what counts as a guess.
 */
export function toReviewItem(step) {
  const valueConfidence = typeof step.confidence === 'number'
    ? step.confidence
    : (CONFIDENCE_BY_PROVENANCE[step.provenance] ?? 0);
  const matchConfidence = MATCH_CONFIDENCE[step.matchedBy] ?? MATCH_CONFIDENCE.label;

  const valueIsGuess = GUESS_PROVENANCE.has(step.provenance);
  const fieldIsGuess = step.matchedBy !== undefined && step.matchedBy !== 'exact';

  return {
    ...step,
    valueConfidence,
    matchConfidence,
    // The weaker of the two. A chain is not stronger than the link that placed it.
    confidence: Math.min(valueConfidence, matchConfidence),
    isGuess: valueIsGuess || fieldIsGuess,
    // Names WHICH half is uncertain, because the candidate's next move differs: a guessed value is
    // checked against what they know about themselves, a guessed field against the form.
    tierLabel: valueIsGuess ? 'guessed value'
             : fieldIsGuess ? 'guessed field'
             : (TIER_LABEL[step.provenance] || step.provenance),
  };
}

/**
 * Group the filled fields into the three bands the overlay renders.
 *
 * @param {Array} items  { field, name, value, provenance, confidence, eligibility, matchedBy }
 * @returns {{ eligibility: Array, uncertain: Array, settled: Array }}
 */
export function orderForReview(items = []) {
  const normalised = items.map(toReviewItem);

  const eligibility = normalised.filter(i => i.eligibility);
  const rest = normalised.filter(i => !i.eligibility);

  // Least certain first inside each band, so the first thing read is the thing most worth reading.
  const byDoubt = (a, b) => a.confidence - b.confidence;

  return {
    eligibility: eligibility.sort(byDoubt),
    uncertain: rest.filter(i => i.isGuess || i.confidence < LOW_CONFIDENCE).sort(byDoubt),
    // Collapsed behind a disclosure. Not hidden — a candidate who wants to read thirty certain
    // fields still can; they are simply not what the overlay is FOR.
    settled: rest.filter(i => !i.isGuess && i.confidence >= LOW_CONFIDENCE).sort(byDoubt),
  };
}

/**
 * Is this review complete?
 *
 * Every guess must be individually acknowledged. Approving in bulk would recreate exactly what the
 * overlay exists to replace — a single gesture that means "I did not read any of this".
 *
 * A fuzzy match on an ELIGIBILITY field is not something to ask the candidate to rubber-stamp. G2's
 * matcher refuses to place one, so its appearance here means the resolver produced it, and that is a
 * bug to surface rather than a decision to delegate (requirement 4).
 */
export function readinessOf(items = [], acknowledged = new Set()) {
  const normalised = items.map(toReviewItem);
  const guesses = normalised.filter(i => i.isGuess);
  const fuzzyEligibility = guesses.filter(i => i.eligibility);
  const unacknowledged = guesses.filter(i => !acknowledged.has(keyOf(i)));

  return {
    ready: fuzzyEligibility.length === 0 && unacknowledged.length === 0,
    guessCount: guesses.length,
    unacknowledged,
    // Never merely "unacknowledged". This is a defect report about the resolver, and it says so.
    resolverBug: fuzzyEligibility.length > 0 ? fuzzyEligibility : null,
  };
}

export const keyOf = (i) => `${i.name || ''}::${i.field || ''}`;

// ── The injected renderer ────────────────────────────────────────────────────
// Runs in the ISOLATED world: it needs chrome.runtime to send edits back, and the isolated world is
// the one that has it. The DOM is shared, so the overlay is a real element on the real page.
//
// Self-contained by necessity — executeScript serialises this function, so it closes over nothing
// and the ordering rules are passed in already applied.
//
// ⛔ D23: THE VISUAL LANGUAGE IS EXACTLY THE SITE'S — it is what a Web Store reviewer sees, and what
// proves fill-and-review rather than auto-submit. Every colour is a var(--c-*) declared on the overlay
// itself from `meta.theme` ({ light, dark } — the generated extension/tokens.js, i.e. the site's
// client/src/styles/colorTokens.js), light by default and dark under the page's
// prefers-color-scheme. ⛔ No colour literal (test/colorLiteralGuard.test.js scans extension/).
// The controls are the job card's: radius 11-12, the D1 depth at rest / hover / press, the orange
// primary with its own tinted shadow. The mark is "/draft" set in the logo face, whose bytes arrive
// as `meta.theme.logoFont` (base64) and are loaded with the FontFace API — no URL is fetched, so no
// web_accessible_resources entry and nothing for the page's CSP to refuse; without it, the fallback
// face renders the same words.
export function renderOverlay(bands, meta) {
  const ID = 'rm-gate-review-overlay';
  document.getElementById(ID)?.remove();

  const theme = meta.theme || {};
  const varsOf = (pal) => Object.entries(pal || {})
    .map(([k, v]) => `--c-${k.toLowerCase().replace(/_/g, '-')}: ${v};`).join(' ');
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

  const css = `
    #${ID} { ${varsOf(theme.light)} }
    @media (prefers-color-scheme: dark) { #${ID} { ${varsOf(theme.dark)} } }
    #${ID} { position: fixed; top: 16px; right: 16px; width: 380px; max-height: calc(100vh - 32px);
      overflow: auto; z-index: 2147483647;
      font: 13px/1.45 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: var(--c-ink); background: var(--c-surface-menu); backdrop-filter: blur(12px);
      border: 1px solid var(--c-glass-edge); border-radius: 18px;
      box-shadow: var(--c-shadow-lg); text-align: left; }
    #${ID} * { box-sizing: border-box; }
    #${ID} .rm-hd { padding: 14px 16px 12px; border-bottom: 1px solid var(--c-border); }
    #${ID} .rm-mark { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 20px;
      letter-spacing: -.02em; line-height: 1; color: var(--c-logo-word); forced-color-adjust: none; }
    #${ID} .rm-mark .rm-slash { color: var(--c-logo-slash); }
    #${ID} .rm-t { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 15px;
      letter-spacing: -.01em; margin-top: 8px; }
    #${ID} .rm-s { font-size: 11px; color: var(--c-ink-muted); margin-top: 2px; }
    #${ID} .rm-sec { padding: 10px 16px; }
    #${ID} .rm-lbl { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
      color: var(--c-ink-faint); margin-bottom: 8px; }
    #${ID} .rm-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0;
      border-top: 1px solid var(--c-border); }
    #${ID} .rm-row:first-of-type { border-top: none; }
    #${ID} .rm-bar { width: 3px; align-self: stretch; border-radius: 2px; background: var(--c-border-strong); flex: none; }
    #${ID} .rm-bar.ok { background: var(--c-success); }
    #${ID} .rm-bar.guess { background: var(--c-warning); }
    #${ID} .rm-main { flex: 1; min-width: 0; }
    #${ID} .rm-f { font-size: 11px; color: var(--c-ink-muted); }
    #${ID} .rm-v { font-size: 12.5px; font-weight: 700; word-break: break-word; }
    #${ID} .rm-side { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }
    /* ⛔ D60 / D63: a provenance chip is a MARK — a rectangle with a 3px leading bar, never a capsule. */
    #${ID} .rm-pill { --mk: var(--c-ink-faint); font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 10.5px;
      line-height: 1; padding: 4px 8px 4px 7px; border-radius: 6px; white-space: nowrap; color: var(--mk);
      border-left: 3px solid var(--mk); background: color-mix(in srgb, var(--mk) 12%, transparent); }
    #${ID} .rm-pill.ok { --mk: var(--c-success); }
    #${ID} .rm-pill.guess { --mk: var(--c-warning); }
    #${ID} .rm-pill.elig { --mk: var(--c-info); }
    /* ⛔ D60: a 28px control at radius 11 read as a capsule (39%); 8 is the client's compact depth box (9 on 30). */
    #${ID} .rm-btn { font: inherit; font-size: 11px; font-weight: 700; padding: 5px 11px; min-height: 28px;
      border-radius: 8px; border: 0; background: var(--c-surface-solid); color: var(--c-ink);
      box-shadow: var(--c-depth-rest); cursor: pointer; transition: box-shadow .2s ease, transform .2s ease; }
    #${ID} .rm-btn:hover:not(:disabled), #${ID} .rm-btn:focus-visible { box-shadow: var(--c-depth-hover); transform: translateY(-2px); }
    #${ID} .rm-btn:active:not(:disabled) { transform: translateY(0); box-shadow: var(--c-depth-press); }
    #${ID} .rm-btn:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    #${ID} .rm-btn:disabled { cursor: default; }
    #${ID} .rm-btn.ack { background: var(--c-warning-quiet); color: var(--c-warning); }
    #${ID} .rm-btn.done { background: var(--c-success-quiet); color: var(--c-success); box-shadow: none; }
    #${ID} .rm-btn.primary { background: var(--c-accent); color: var(--c-on-accent); box-shadow: var(--c-depth-accent);
      margin-top: 8px; }
    #${ID} .rm-btn.primary:hover:not(:disabled), #${ID} .rm-btn.primary:focus-visible { box-shadow: var(--c-depth-accent); }
    #${ID} .rm-edit { width: 100%; font: inherit; font-size: 12px; padding: 5px 8px; margin-top: 4px;
      color: var(--c-ink); background: var(--c-surface-input); border: 1px solid var(--c-border-control); border-radius: 6px; }
    #${ID} .rm-edit:focus { outline: 2px solid var(--c-accent-ink); outline-offset: 1px; }
    #${ID} .rm-ft { position: sticky; bottom: 0; padding: 12px 16px; background: var(--c-surface-modal);
      border-top: 1px solid var(--c-border); }
    #${ID} .rm-state { font-size: 11px; font-weight: 700; }
    #${ID} .rm-state.ready { color: var(--c-success); }
    #${ID} .rm-state.block { color: var(--c-warning); }
    #${ID} .rm-bug { margin: 8px 16px; padding: 9px 11px; border-radius: 12px; background: var(--c-danger-quiet);
      color: var(--c-danger); font-size: 11px; }
    #${ID} details > summary { cursor: pointer; font-size: 11px; color: var(--c-ink-muted); padding: 6px 0; }
    #${ID} .rm-next { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--c-info-quiet);
      color: var(--c-info); font-size: 11px; }
    @media (prefers-reduced-motion: reduce) { #${ID} .rm-btn { transition: none; } }
  `;

  const root = document.createElement('div');
  root.id = ID;
  root.setAttribute('role', 'complementary');
  root.setAttribute('aria-label', 'draft — review before you submit');
  const style = document.createElement('style');
  style.textContent = css;
  root.appendChild(style);

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const acknowledged = new Set();
  const edits = new Map();

  const rowHtml = (i, idx, band) => {
    const conf = typeof i.confidence === 'number' ? i.confidence : 0;
    const guess = i.isGuess;
    const pill = i.eligibility ? 'elig' : guess ? 'guess' : conf >= 0.8 ? 'ok' : '';
    const tier = i.tierLabel || (guess ? 'guess' : 'exact');
    return `
      <div class="rm-row" data-band="${band}" data-idx="${idx}">
        <div class="rm-bar ${guess ? 'guess' : conf >= 0.8 ? 'ok' : ''}"></div>
        <div class="rm-main">
          <div class="rm-f">${esc(i.field)}</div>
          <div class="rm-v" data-role="value">${esc(i.value)}</div>
          <input class="rm-edit" data-role="input" value="${esc(i.value)}" hidden>
        </div>
        <div class="rm-side">
          <span class="rm-pill ${pill}">${esc(i.eligibility ? 'eligibility' : tier)}</span>
          <button class="rm-btn" data-role="edit">edit</button>
          ${guess ? `<button class="rm-btn ack" data-role="ack">acknowledge</button>` : ''}
        </div>
      </div>`;
  };

  const section = (title, items, band) => items.length ? `
    <div class="rm-sec">
      <div class="rm-lbl">${title}</div>
      ${items.map((i, n) => rowHtml(i, n, band)).join('')}
    </div>` : '';

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="rm-hd">
      <div class="rm-mark" aria-hidden="true"><span class="rm-slash">/</span>draft</div>
      <div class="rm-t">Review before you submit</div>
      <div class="rm-s">${meta.filledCount} field(s) filled${meta.resumeAttached ? ' · resume attached' : ''}.
        Draft never submits for you.</div>
    </div>
    ${meta.resolverBug ? `<div class="rm-bug"><b>Resolver bug.</b> An eligibility answer was matched by a
      guess: ${esc(meta.resolverBug.map(b => b.field).join(', '))}. This should be unreachable — do not
      rubber-stamp it. Answer it yourself.</div>` : ''}
    ${section('Eligibility — you are attesting to these', bands.eligibility, 'eligibility')}
    ${section('Worth checking', bands.uncertain, 'uncertain')}
    ${bands.settled.length ? `<div class="rm-sec"><details><summary>${bands.settled.length} more,
      resolved exactly</summary>${bands.settled.map((i, n) => rowHtml(i, n, 'settled')).join('')}</details></div>` : ''}
    <div class="rm-ft">
      <div class="rm-state" data-role="state"></div>
      <div class="rm-s" style="margin-top:6px">Submit the form yourself when you are happy with it.</div>
      <!-- D56: once YOU have submitted, one click records it — from this page, which is the evidence. -->
      <button class="rm-btn" data-role="submitted" style="margin-top:8px">I submitted it</button>
      <div class="rm-s" data-role="submitted-msg"></div>
      ${meta.portal && meta.portal.remaining > 0 ? `
        <div class="rm-next">
          <div><b>${meta.portal.remaining}</b> more ready at ${esc(meta.portal.host)}${
            // The sign-in reassurance belongs to a GATE crossing, where crossing once really did
            // release the batch. Held reviews also queue up per origin, and telling the candidate a
            // sign-in cleared them would be a claim about work nobody did.
            meta.portal.gateCrossing ? ' — you are already signed in.' : ', prepared and waiting.'
          }</div>
          ${meta.portal.next ? `<div class="rm-s" style="margin-top:2px">Next:
            ${esc(meta.portal.next.title || meta.portal.next.company || 'application')}</div>` : ''}
          <button class="rm-btn primary" data-role="next">Submit this one first, then go to the next</button>
        </div>` : ''}
    </div>`;
  root.appendChild(body);
  document.documentElement.appendChild(root);

  const all = [...bands.eligibility, ...bands.uncertain, ...bands.settled];
  const guesses = all.filter(i => i.isGuess);
  const stateEl = root.querySelector('[data-role="state"]');

  const refresh = () => {
    const left = guesses.filter(i => !acknowledged.has(`${i.name || ''}::${i.field || ''}`));
    const blocked = meta.resolverBug || left.length > 0;
    stateEl.className = `rm-state ${blocked ? 'block' : 'ready'}`;
    stateEl.textContent = meta.resolverBug
      ? 'Not ready — an eligibility answer was guessed. Answer it yourself.'
      : left.length
        ? `Not ready — ${left.length} guess(es) still to acknowledge.`
        : 'Ready. Everything uncertain has been checked.';
    // Reported, never acted on: the overlay does not submit and does not enable a submit control.
    try {
      chrome.runtime.sendMessage({
        type: 'GATE_REVIEW_STATE',
        ready: !blocked,
        acknowledged: [...acknowledged],
        edits: [...edits.entries()].map(([k, v]) => ({ key: k, value: v })),
      });
    } catch { /* the worker may be asleep; the next message wakes it */ }
  };

  const bandOf = (name) => bands[name] || [];

  root.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;

    // Role first, row second. The batch button lives in the FOOTER, not in a field row, so looking
    // up `.rm-row` before checking the role threw on a null row and killed the handler — the button
    // did nothing at all, silently, because the throw happened inside the listener.
    if (btn.dataset.role === 'next') {
      btn.disabled = true;
      btn.textContent = 'opening the next one…';
      try {
        // The reply is read, not discarded. A batch that cannot advance used to leave this button
        // sitting on "opening…" forever, which is indistinguishable from slow.
        chrome.runtime.sendMessage({ type: 'GATE_BATCH_NEXT' }, (reply) => {
          if (chrome.runtime.lastError || !reply?.ok) {
            btn.disabled = false;
            btn.textContent = 'Could not open the next one — try again';
            btn.dataset.error = chrome.runtime.lastError?.message || reply?.reason || 'no_reply';
          }
        });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Could not open the next one — try again';
        btn.dataset.error = e.message;
      }
      return;
    }

    // D56: "I submitted it" — recorded by the service worker against this page; the reply is shown, so a
    // record that did not verify says what is missing rather than reading as done.
    if (btn.dataset.role === 'submitted') {
      const msg = root.querySelector('[data-role="submitted-msg"]');
      btn.disabled = true;
      btn.textContent = 'recording…';
      try {
        chrome.runtime.sendMessage({ type: 'GATE_SUBMITTED' }, (reply) => {
          const ok = !chrome.runtime.lastError && reply?.ok;
          btn.textContent = ok ? 'recorded' : 'I submitted it';
          btn.className = ok ? 'rm-btn done' : 'rm-btn';
          btn.disabled = !!ok;
          if (msg) msg.textContent = reply?.message || chrome.runtime.lastError?.message || 'Could not record it — try again.';
        });
      } catch (e) {
        btn.disabled = false;
        btn.textContent = 'I submitted it';
        if (msg) msg.textContent = 'Could not record it — try again.';
      }
      return;
    }

    const row = btn.closest('.rm-row');
    if (!row) return;
    const item = bandOf(row.dataset.band)[Number(row.dataset.idx)];
    if (!item) return;
    const key = `${item.name || ''}::${item.field || ''}`;

    if (btn.dataset.role === 'ack') {
      acknowledged.add(key);
      btn.className = 'rm-btn done';
      btn.textContent = 'acknowledged';
      btn.disabled = true;
      refresh();
      return;
    }

    if (btn.dataset.role === 'edit') {
      const input = row.querySelector('[data-role="input"]');
      const valueEl = row.querySelector('[data-role="value"]');
      if (input.hidden) {
        input.hidden = false; input.focus(); btn.textContent = 'save';
      } else {
        const next = input.value;
        input.hidden = true; btn.textContent = 'edit';
        valueEl.textContent = next;
        edits.set(key, next);
        // An edit is a correction to the real input, not to this card. It goes back through the
        // service worker so it is written with the SAME native-setter path the fill used — a value
        // set any other way is reverted by the page's next render.
        try {
          chrome.runtime.sendMessage({
            type: 'GATE_REVIEW_EDIT',
            field: { name: item.name, id: item.id ?? null, index: item.index, label: item.field },
            value: next,
          });
        } catch { /* reported in the state message on the next refresh */ }
        // An edited value is the candidate's own, so it is no longer a guess to acknowledge.
        acknowledged.add(key);
        const ack = row.querySelector('[data-role="ack"]');
        if (ack) { ack.className = 'rm-btn done'; ack.textContent = 'yours'; ack.disabled = true; }
        refresh();
      }
    }
  });

  refresh();
  return { ok: true, rendered: all.length };
}
