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
export const MATCH_CONFIDENCE = { exact: 1.0, label_exact: 1.0, saved_answer: 1.0, work_history: 1.0, eeo_decline: 1.0, label: 0.5 };

/**
 * ⭐ D96 §4 / §5: how a control was matched that is NOT a guess about the field — a structural id ('exact'), the
 * page's label equal to the answer's once the "*" and punctuation are set aside ('label_exact': "First Name*" IS
 * "First Name"), or the candidate's own saved answer / work history / EEO decline placed by exact question equality.
 * Only 'label' — the control's NAME resembling the answer's — is still "matched loosely".
 */
export const EXACT_MATCHES = new Set(['exact', 'label_exact', 'saved_answer', 'work_history', 'eeo_decline']);

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
  const fieldIsGuess = step.matchedBy !== undefined && !EXACT_MATCHES.has(step.matchedBy);

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

// ── D96 §5 · THE PANEL'S ROWS — every field on the step, in three groups (lane J4) ───────────────────────────────
//
// The panel used to be handed only what was FILLED, so a field draft could not fill was not on it at all, and "Ready"
// could be said over a page where nothing was filled (D96 §1 symptoms 3 and 5). Now every question on the step is a
// row — one per control, a radio group, a checkbox group or a date being one question — in one of three groups:
//
//   need   Needs you   draft could not fill it, the fill did not take, it is yours to decide (a consent, a signature,
//                      a screening question), or there was nothing to fill it with — with a place to type it and the
//                      value ready to copy where draft has one. Nothing is silent.
//   check  Check       filled, but matched loosely (or the value was a guess) — acknowledge it once and it is
//                      remembered.
//   ok     Filled      filled exactly, from your profile or a saved answer (with when you acknowledged it), or already
//                      holding something on the page.
//
// ⛔ Password and payment fields are not rows: the probe never enumerates them and the guard drops any that slip by.
// ⛔ A terms / consent / attestation / signature control is a Needs-you row with NO place to type — yours to tick.

import { questionUnits, unitFields, unitOptions, unitWidgetKind } from './savedAnswerMatch.js';
import { neverFillReasonOfField, questionLabelKey } from './answerKey.js';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const keyText = (s) => norm(questionLabelKey(s));

/** The page's words without the required asterisk — "First Name*" is shown as "First Name". */
export const shownLabel = (s) => String(s ?? '').replace(/\s+/g, ' ').replace(/\s*\*+\s*$/, '').replace(/^\s*\*+\s*/, '').trim();

/** Where a filled value came from, in the panel's words (D96 §5: profile · saved · you typed · matched loosely). */
export function sourceOf(step = {}) {
  const p = step.provenance;
  if (p === 'saved_answer') {
    const s = step.saved?.source;
    return s === 'you_typed' ? 'you typed' : s === 'you_acknowledged' ? 'you acknowledged' : 'saved';
  }
  if (p === 'custom_answer') return 'saved';
  if (p === 'work_history') return 'your work history';
  if (p === 'eeo_decline') return 'your choice';
  if (GUESS_PROVENANCE.has(p) || step.matchedBy === 'label') return 'matched loosely';
  if (p === 'resume') return 'your résumé';
  return 'profile';
}

/** Why a field is the candidate's — one plain sentence per reason the fill or the matcher gives. */
export const NEED_WORDS = Object.freeze({
  reverted_after_set: 'The page did not keep it — copy it in.',
  value_not_in_options: "None of the page's choices is this — pick it yourself.",
  no_close_option: "None of the page's choices is close — pick it yourself.",
  field_moved: 'The page changed before draft could fill it — copy it in.',
  options_changed: 'The choices changed since you answered — answer it again.',
  decline_option_absent: "This form has no 'prefer not to say' choice — answer it yourself.",
  never_filled_yours_to_do: 'Yours to tick — draft never ticks or signs this.',
  consent_left_for_you: 'Yours to tick — draft never ticks or signs this.',
  opt_in_left_for_you: 'A sign-up choice — yours to make.',
  screening_left_for_you: 'A screening question — answer it yourself.',
  eeo_left_for_you: 'A voluntary disclosure — yours to answer.',
  saved_answer_not_an_option: "Your saved answer is not one of this form's choices — answer it here.",
  worked_here_left_for_you: 'Answer this one yourself.',
  worked_here_not_an_option: 'Answer this one yourself.',
  error: 'draft could not fill this — copy it in.',
  required: 'Nothing in your profile for this yet.',
  optional: 'Optional — type it, or leave it.',
  file: 'Attach it on the page.',
});

const valueOfUnit = (u, fields, done, filled) => {
  const placed = (p) => filled.find(f => (f.index !== undefined ? f.index === p.index : f.field === p.label))?.placed;
  if (u.kind === 'radio') return fields.find(f => f.index === done[0].index)?.label ?? String(done[0].value);
  if (u.kind === 'checkbox-group') return done.filter(p => String(p.value) === 'true').map(p => fields.find(f => f.index === p.index)?.label).filter(Boolean).join(', ');
  if (u.kind === 'date') {
    const by = Object.fromEntries(done.map(p => [fields.find(f => f.index === p.index)?.dateGroup?.part, String(p.value)]));
    return ['month', 'day', 'year'].map(k => by[k]).filter(Boolean).join('/');
  }
  if (u.kind === 'checkbox') return String(done[0].value) === 'true' ? 'ticked' : 'left unticked';
  const v = placed(done[0]) ?? done[0].value;
  return Array.isArray(v) ? v.join(', ') : String(v ?? '');
};

/**
 * Every question on one step as a panel row.
 * @param {object} a
 *   stepName  the wizard step's name ('' on a single page)
 *   fields    probeFormShape().fields AFTER the fill (so `hasValue` says what the page holds now)
 *   plan      the step's plan (matchAnswersToFields + placeStatedAnswers, never-fill removed)
 *   filled / skipped   applyPlan's result
 *   unmatched the matcher's notes (refusals name the page's question)
 *   resume    applyPlan's résumé result
 *   kindOf    gated-handoff.js questionKind
 */
export function panelRowsForStep({ stepName = '', fields = [], plan = [], filled = [], skipped = [], unmatched = [], resume = null, kindOf = () => 'other' } = {}) {
  const rows = [];
  const units = questionUnits((fields || []).filter(f => f.visible !== false || f.type === 'file'));
  let unlabelled = 0;
  const isFilled = (p) => filled.some(f => (f.index !== undefined ? f.index === p.index : (f.field === p.label && (f.name ?? null) === (p.name ?? null))));
  for (const u of units) {
    const fs = unitFields(u);
    if (!fs.length) continue;
    const first = fs[0];
    const never = fs.map(f => neverFillReasonOfField(f, fields)).find(Boolean) || null;
    if (first.type === 'password' || never === 'secret') continue;            // ⛔ never listed
    const idx = fs.map(f => f.index);
    const question = u.question || first.label || '';
    const shown = shownLabel(question);
    const label = shown || `Unlabelled field ${++unlabelled}`;
    const steps = plan.filter(p => idx.includes(p.index));
    const done = steps.filter(isFilled);
    const failed = steps.filter(p => !isFilled(p));
    const skip = failed.length ? (skipped.find(s => s.field === failed[0].label && (s.name ?? null) === (failed[0].name ?? null))
      || skipped.find(s => s.field === failed[0].label)) : null;
    // Required by the control, its group, or the asterisk on the question itself (a date's "Date*").
    const required = fs.some(f => f.required) || /\*\s*$/.test(String(question));
    const hasValue = u.kind === 'date' ? fs.every(f => f.hasValue) : fs.some(f => f.hasValue);
    const kind = kindOf(question);
    const choices = unitOptions(u);
    const row = {
      key: `${stepName}::${idx[0]}::${keyText(question) || `#${idx[0]}`}`,
      step: stepName, label, question, widgetKind: unitWidgetKind(u), unitKind: u.kind,
      choices, options: choices, required, eligibility: steps.some(p => p.eligibility) || kind === 'eligibility',
      locator: fs.map(f => ({ index: f.index, name: f.name ?? null, id: f.id ?? null, label: f.label ?? '',
        choice: u.kind === 'radio' || u.kind === 'checkbox-group' ? f.label : null, part: f.dateGroup?.part || null })),
      group: 'need', value: '', copyValue: null, source: null, note: null, canType: !never && first.type !== 'file',
      byDraft: false, neverFill: never, acknowledgedAt: null, attesting: false, savedId: null,
      // A question with no words of its own cannot be keyed — it is typed for this page only, never remembered.
      ...(shown ? {} : { noRemember: true }),
    };
    if (first.type === 'file') {
      // ⭐ D98 §5 (J6): the résumé generated in the on-page panel reads "Résumé — attached ✓", its file named under it.
      if (resume?.attached && resume.fromPanel) Object.assign(row, { group: 'ok', value: 'Résumé — attached ✓', note: resume.filename || null, source: 'draft', byDraft: true });
      else if (resume?.attached) Object.assign(row, { group: 'ok', value: resume.filename || 'your résumé', source: 'draft', byDraft: true });
      else if (hasValue) Object.assign(row, { group: 'ok', source: 'on the page', note: 'already attached on the page' });
      else Object.assign(row, { note: NEED_WORDS.file, ...(/r[ée]sum[ée]|\bcv\b|curriculum vitae/i.test(question) ? { resumeOffer: true } : {}) });
    } else if (done.length && !failed.length) {
      const head = done[0];
      const item = toReviewItem({ ...head, field: label });
      const placedOptions = filled.find(f => f.index === head.index)?.options || null;
      Object.assign(row, {
        group: item.isGuess ? 'check' : 'ok', value: valueOfUnit(u, fields, done, filled), source: sourceOf(head), byDraft: true,
        acknowledgedAt: head.saved?.acknowledgedAt || null, attesting: !!(head.saved?.attesting || row.eligibility),
        savedId: head.saved?.id ?? null, remembered: head.provenance === 'saved_answer',
        ...(placedOptions ? { options: placedOptions } : {}),
      });
    } else if (failed.length) {
      const why = skip?.reason?.startsWith('error') ? 'error' : skip?.reason;
      const wanted = skip?.wanted ?? (Array.isArray(failed[0].value) ? failed[0].value.join(', ') : failed[0].value);
      Object.assign(row, { note: NEED_WORDS[why] || NEED_WORDS.error, copyValue: wanted == null ? null : String(wanted),
        ...(skip?.options ? { options: skip.options } : {}),
        ...(why === 'never_filled_yours_to_do' ? { canType: false, neverFill: 'consent_or_attestation' } : {}) });
    } else if (never) {
      if (hasValue) Object.assign(row, { group: 'ok', source: 'on the page', note: 'you did this on the page' });
      else Object.assign(row, { note: NEED_WORDS.consent_left_for_you, canType: false });
    } else if (hasValue) {
      Object.assign(row, { group: 'ok', source: 'on the page', note: 'already filled on the page' });
    } else {
      const refusal = (unmatched || []).find(n => n?.reason && keyText(n.field) === keyText(question));
      Object.assign(row, { note: (refusal && NEED_WORDS[refusal.reason]) || (required ? NEED_WORDS.required : NEED_WORDS.optional),
        optional: !required });
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Rows for answers that are not one control on the page — the repeating-section entries (D55 b: one row per job,
 * degree, website) and the legacy review items the screenshot script draws. Through the same toReviewItem rule.
 */
export function panelRowsFromItems(items = [], stepName = '') {
  return items.map((i, n) => {
    const item = toReviewItem(i);
    return {
      key: `${stepName}::item:${i.name || n}::${keyText(i.field)}`, step: stepName, label: shownLabel(i.field), question: i.field,
      widgetKind: 'text', unitKind: 'item', choices: null, options: null, required: false, eligibility: !!i.eligibility,
      locator: i.index !== undefined ? [{ index: i.index, name: i.name ?? null, id: i.id ?? null, label: i.field }] : [],
      group: item.resolverBug || (item.eligibility && item.isGuess) ? 'need' : item.isGuess ? 'check' : 'ok',
      value: String(i.value ?? ''), copyValue: null, source: sourceOf(i), note: item.eligibility && item.isGuess
        ? 'An eligibility answer placed by a guess — answer it yourself.' : null,
      canType: false, byDraft: true, neverFill: null, acknowledgedAt: null, attesting: !!i.eligibility, savedId: null,
      noRemember: true,
    };
  });
}

/**
 * When the wizard moves on, the step it left is the candidate's: the portal took it. Its Needs-you rows become
 * "answered on the page" (a required one was answered — the wizard only moves when none is empty); its Check rows
 * still wait for an acknowledgement.
 */
export function settleStepRows(rows = []) {
  return rows.map(r => (r.group === 'need'
    ? { ...r, group: 'ok', source: 'on the page', note: r.required ? 'answered on the page' : 'left as it was', canType: false, copyValue: null, settled: true }
    : r));
}

/**
 * ⛔ "READY" MEANS READY (D96 §5): nothing needs you AND at least one field was filled — by draft, or by you in this
 * panel. A page that merely already held values is not "filled by draft". With nothing filled it says so.
 * ⛔ renderOverlay carries a BYTE-IDENTICAL copy (modulo indentation) — it is serialised into the page; a test
 * asserts the two are the same text.
 */
export function panelSummary(rows) {
  const need = rows.filter(r => r.group === 'need').length;
  const check = rows.filter(r => r.group === 'check').length;
  const filled = rows.filter(r => r.group === 'ok' || r.group === 'check').length;
  const byYou = rows.filter(r => r.byDraft && (r.group === 'ok' || r.group === 'check')).length;
  const ready = need === 0 && check === 0 && byYou >= 1;
  const state = ready ? 'Ready. Everything uncertain has been checked.'
    : byYou === 0 ? 'Nothing was filled — the page has no fields draft recognises yet.'
      : need ? `Not ready — ${need} need${need === 1 ? 's' : ''} you.`
        : `Not ready — ${check} to acknowledge.`;
  return { total: rows.length, filled, need, check, byDraft: byYou, ready, state,
    line: `${filled} of ${rows.length} filled · ${need} need${need === 1 ? 's' : ''} you · ${check} to check` };
}

// ── The injected renderer ────────────────────────────────────────────────────
// Runs in the ISOLATED world: it needs chrome.runtime to send edits back, and the isolated world is
// the one that has it. The DOM is shared, so the overlay is a real element on the real page — drawn in its OWN
// shadow root (D96 §6: "the same family" as the Copy sheet), so the page's CSS cannot restyle its inputs and the
// form probe and the required-field pre-check never see them.
//
// Self-contained by necessity — executeScript serialises this function, so it closes over nothing
// and the rows arrive already built (panelRowsForStep).
//
// ⛔ D23: THE VISUAL LANGUAGE IS EXACTLY THE SITE'S — it is what a Web Store reviewer sees, and what
// proves fill-and-review rather than auto-submit. Every colour is a var(--c-*) declared on the overlay
// itself from `meta.theme` ({ light, dark } — the generated extension/tokens.js, i.e. the site's
// client/src/styles/colorTokens.js), light by default and dark under the page's
// prefers-color-scheme. ⛔ No colour literal (test/colorLiteralGuard.test.js scans extension/).
// The controls are the job card's: the D1 depth at rest / hover / press, the orange primary with its own tinted
// shadow. The mark is "/draft" set in the logo face, whose bytes arrive
// as `meta.theme.logoFont` (base64) and are loaded with the FontFace API — no URL is fetched, so no
// web_accessible_resources entry and nothing for the page's CSP to refuse; without it, the fallback
// face renders the same words.
//
// D96 §5: Collapse (a slim bar that still says "2 need you · 14 of 18 filled"), Close and Esc; it docks left or right
// (remembered with the tab's binding — PANEL_DOCK), can be dragged by its header, and moves to the other side when
// the field you are typing in is under it. Its own state — what you acknowledged, typed or changed, collapsed or not,
// where it sits — survives the re-draw at each wizard step (a page-local object in this isolated world; nothing is
// stored). ⛔ It never submits, and every press that writes to the server must be a TRUSTED click (ev.isTrusted).
export function renderOverlay(model, meta) {
  const ID = 'rm-gate-review-overlay';
  const G = (globalThis.__draftReviewPanel = globalThis.__draftReviewPanel || { runs: {}, side: null, top: null });
  const runId = String(meta.runId || 'run');
  const run = (G.runs[runId] = G.runs[runId] || { rows: {}, collapsed: false, closed: false, open: { need: true, check: true, ok: false } });
  const prior = document.getElementById(ID);
  if (prior) { try { prior.__draftCleanup?.(); } catch { /* gone */ } prior.remove(); }
  if (run.closed) return { ok: true, rendered: 0, closed: true };

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

  // ⛔ D60: rectangles. Controls radius 8 on 28 (the near-capsule guard's 30%); marks radius 6 with a 3px leading bar;
  // the progress bar is square-ended (radius 1 on 6). Only perfect circles may be round — there are none here.
  const css = `
    #${ID} { ${varsOf(theme.light)} }
    @media (prefers-color-scheme: dark) { #${ID} { ${varsOf(theme.dark)} } }
    #${ID} { max-height: calc(100vh - 32px); display: flex; flex-direction: column; overflow: hidden;
      font: 13px/1.45 'DM Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: var(--c-ink); background: var(--c-surface-menu); backdrop-filter: blur(12px);
      border: 1px solid var(--c-glass-edge); border-radius: 10px;
      box-shadow: var(--c-shadow-lg); text-align: left; }
    #${ID} * { box-sizing: border-box; }
    #${ID} .rm-hd { padding: 12px 14px 8px; border-bottom: 1px solid var(--c-border); cursor: grab; user-select: none; }
    #${ID} .rm-top { display: flex; align-items: center; gap: 6px; }
    #${ID} .rm-sp { flex: 1; }
    #${ID} .rm-mark { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 20px;
      letter-spacing: -.02em; line-height: 1; color: var(--c-logo-word); forced-color-adjust: none; }
    #${ID} .rm-mark .rm-slash { color: var(--c-logo-slash); }
    #${ID} .rm-t { font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 15px;
      letter-spacing: -.01em; margin-top: 8px; }
    #${ID} .rm-s { font-size: 11px; color: var(--c-ink-muted); margin-top: 2px; }
    #${ID} .rm-prog { margin-top: 6px; font-size: 11.5px; color: var(--c-ink-muted); }
    #${ID} .rm-pb { height: 6px; border-radius: 1px; background: var(--c-border); margin-top: 6px; overflow: hidden; }
    #${ID} .rm-pb i { display: block; height: 100%; background: var(--c-success); }
    #${ID} .rm-ib { width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-surface-solid);
      color: var(--c-ink-muted); font: 800 13px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; padding: 0; }
    #${ID} .rm-ib:hover, #${ID} .rm-ib:focus-visible { color: var(--c-ink); }
    #${ID} .rm-ib:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    #${ID} .rm-sc { overflow: auto; padding: 0 6px 6px; flex: 1; min-height: 0; }
    #${ID} .rm-sec { padding: 0; }
    #${ID} .rm-lbl { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 8px; font-size: 10.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
      color: var(--c-ink-faint); border-top: 1px solid var(--c-border); }
    #${ID} .rm-lbl:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: -2px; }
    #${ID} .rm-n { font-size: 11px; color: var(--c-ink); background: var(--c-border); border-radius: 5px; padding: 1px 7px; letter-spacing: 0; }
    #${ID} .rm-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; margin: 0 4px 4px;
      border-left: 3px solid var(--c-border-strong); border-radius: 0 8px 8px 0; background: var(--c-surface-solid); }
    #${ID} .rm-row[data-group="need"] { border-left-color: var(--c-danger); }
    #${ID} .rm-row[data-group="check"] { border-left-color: var(--c-warning); }
    #${ID} .rm-row[data-group="ok"] { border-left-color: var(--c-success); }
    #${ID} .rm-bar { display: none; border-radius: 2px; }
    #${ID} .rm-main { flex: 1; min-width: 0; }
    #${ID} .rm-f { font-size: 11px; color: var(--c-ink-muted); }
    #${ID} .rm-v { font-size: 12.5px; font-weight: 700; word-break: break-word; }
    #${ID} .rm-note { font-size: 11px; color: var(--c-ink-muted); margin-top: 3px; }
    #${ID} .rm-note.warn { color: var(--c-warning); }
    #${ID} .rm-acts { display: flex; gap: 6px; margin-top: 6px; align-items: center; flex-wrap: wrap; }
    /* ⛔ D60 / D63: a provenance chip is a MARK — a rectangle with a 3px leading bar, never a capsule. */
    #${ID} .rm-pill { --mk: var(--c-ink-faint); font-family: ${logo}; font-style: italic; font-weight: 800; font-size: 10.5px;
      line-height: 1; padding: 3px 7px 3px 6px; border-radius: 6px; white-space: nowrap; color: var(--mk);
      border-left: 3px solid var(--mk); background: color-mix(in srgb, var(--mk) 12%, transparent); margin-left: 6px; }
    #${ID} .rm-pill.ok { --mk: var(--c-success); }
    #${ID} .rm-pill.guess { --mk: var(--c-warning); }
    #${ID} .rm-pill.elig { --mk: var(--c-info); }
    #${ID} .rm-pill.you { --mk: var(--c-accent-ink); }
    #${ID} .rm-pill.need { --mk: var(--c-danger); }
    /* ⛔ D60: a 28px control at radius 11 read as a capsule (39%); 8 is the client's compact depth box (9 on 30). */
    #${ID} .rm-btn { font: inherit; font-size: 11px; font-weight: 700; padding: 5px 11px; min-height: 28px;
      border-radius: 8px; border: 0; background: var(--c-surface-solid); color: var(--c-ink);
      box-shadow: var(--c-depth-rest); cursor: pointer; transition: box-shadow .2s ease, transform .2s ease; }
    #${ID} .rm-btn:hover:not(:disabled), #${ID} .rm-btn:focus-visible { box-shadow: var(--c-depth-hover); transform: translateY(-2px); }
    #${ID} .rm-btn:active:not(:disabled) { transform: translateY(0); box-shadow: var(--c-depth-press); }
    #${ID} .rm-btn:focus-visible { outline: 2px solid var(--c-accent-ink); outline-offset: 2px; }
    #${ID} .rm-btn:disabled { cursor: default; opacity: .55; box-shadow: none; }
    #${ID} .rm-btn.ack { background: var(--c-warning-quiet); color: var(--c-warning); }
    #${ID} .rm-btn.done { background: var(--c-success-quiet); color: var(--c-success); box-shadow: none; }
    #${ID} .rm-btn.primary { background: var(--c-accent); color: var(--c-on-accent); box-shadow: var(--c-depth-accent); }
    #${ID} .rm-btn.primary:hover:not(:disabled), #${ID} .rm-btn.primary:focus-visible { box-shadow: var(--c-depth-accent); }
    #${ID} .rm-edit { flex: 1; min-width: 110px; font: inherit; font-size: 12px; padding: 5px 8px;
      color: var(--c-ink); background: var(--c-surface-input); border: 1px solid var(--c-border-control); border-radius: 6px; }
    #${ID} .rm-edit:focus { outline: 2px solid var(--c-accent-ink); outline-offset: 1px; }
    #${ID} .rm-mem { display: flex; gap: 6px; align-items: center; font-size: 11px; color: var(--c-ink-muted); }
    #${ID} .rm-mem input { accent-color: var(--c-accent); margin: 0; }
    #${ID} .rm-ft { padding: 10px 14px; background: var(--c-surface-modal); border-top: 1px solid var(--c-border); }
    #${ID} .rm-state { font-size: 11.5px; font-weight: 700; }
    #${ID} .rm-state.ready { color: var(--c-success); }
    #${ID} .rm-state.block { color: var(--c-warning); }
    #${ID} .rm-bug { margin: 8px 12px; padding: 9px 11px; border-radius: 8px; background: var(--c-danger-quiet);
      color: var(--c-danger); font-size: 11px; }
    #${ID} .rm-next { margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: var(--c-info-quiet);
      color: var(--c-info); font-size: 11px; }
    #${ID} .rm-remind { margin: 8px 12px 0; padding: 7px 9px; border-left: 3px solid var(--c-info); border-radius: 0 6px 6px 0;
      background: var(--c-info-quiet); color: var(--c-info); font-size: 11px; }
    #${ID}.rm-slim { flex-direction: row; align-items: center; gap: 10px; padding: 8px 12px; }
    #${ID}.rm-slim .rm-mark { font-size: 16px; }
    #${ID} .rm-slimtxt b { color: var(--c-warning); }
    @media (prefers-reduced-motion: reduce) { #${ID} .rm-btn { transition: none; } }
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const send = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (reply) => { void chrome.runtime.lastError; resolve(reply ?? null); });
    } catch { resolve(null); }
  });

  // The rows, with what you already did in this panel carried over from the last draw.
  const rows = (model.rows || []).map(r => ({ ...r }));
  for (const r of rows) {
    const c = run.rows[r.key];
    if (!c) continue;
    if (c.action === 'ack') Object.assign(r, { group: 'ok', source: 'you acknowledged', remembered: c.remembered, note: c.note });
    if (c.action === 'typed') Object.assign(r, { group: 'ok', source: 'you typed', value: c.value, byDraft: true, remembered: c.remembered, note: c.note, copyValue: null });
    if (c.action === 'edited') Object.assign(r, { value: c.value, changed: c.changed, note: c.note, remembered: c.remembered });
    if (c.action === 'left') Object.assign(r, { group: 'ok', source: 'left blank by you', note: null, copyValue: null });
    if (c.action === 'page') Object.assign(r, { group: 'ok', source: 'on the page', note: c.note, copyValue: null, canType: false });
  }

  // ⛔ BYTE-IDENTICAL (modulo indentation) TO THE EXPORTED panelSummary — asserted by test.
  function panelSummary(rows) {
    const need = rows.filter(r => r.group === 'need').length;
    const check = rows.filter(r => r.group === 'check').length;
    const filled = rows.filter(r => r.group === 'ok' || r.group === 'check').length;
    const byYou = rows.filter(r => r.byDraft && (r.group === 'ok' || r.group === 'check')).length;
    const ready = need === 0 && check === 0 && byYou >= 1;
    const state = ready ? 'Ready. Everything uncertain has been checked.'
      : byYou === 0 ? 'Nothing was filled — the page has no fields draft recognises yet.'
        : need ? `Not ready — ${need} need${need === 1 ? 's' : ''} you.`
          : `Not ready — ${check} to acknowledge.`;
    return { total: rows.length, filled, need, check, byDraft: byYou, ready, state,
      line: `${filled} of ${rows.length} filled · ${need} need${need === 1 ? 's' : ''} you · ${check} to check` };
  }

  const host = document.createElement('div');
  host.id = ID;
  host.setAttribute('data-draft-review-panel', '');
  host.dataset.run = runId;   // which fill drew it (a test reads it; the page learns nothing it could not see)
  const side = G.side || (meta.dock === 'left' ? 'left' : 'right');
  const place = (s, top) => {
    host.style.cssText = `position:fixed;z-index:2147483647;width:min(380px, calc(100vw - 32px));top:${Math.max(8, top ?? 16)}px;${s}:16px;`;
    host.dataset.side = s;
  };
  place(side, G.top);
  const root = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = css;
  const panel = document.createElement('div');
  panel.id = ID;
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'draft — review before you submit');
  root.append(style, panel);
  document.documentElement.appendChild(host);

  const GROUPS = [['need', 'Needs you'], ['check', 'Check'], ['ok', 'Filled']];
  const multiStep = new Set(rows.map(r => r.step).filter(Boolean)).size > 1;
  const markOf = (r) => r.group === 'need' ? 'need' : r.source === 'matched loosely' ? 'guess'
    : /^you /.test(r.source || '') ? 'you' : r.group === 'ok' ? 'ok' : 'guess';
  const day = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; } };

  const rowHtml = (r, i) => {
    const notes = [];
    if (r.note) notes.push(`<div class="rm-note${r.group === 'need' ? ' warn' : ''}">${esc(r.note)}</div>`);
    if (r.group !== 'need' && r.acknowledgedAt && !r.changed) notes.push(`<div class="rm-note">you acknowledged this on ${esc(day(r.acknowledgedAt))}</div>`);
    if (r.attesting && r.group !== 'need') notes.push('<div class="rm-note">you are attesting to this</div>');
    if (r.changed) notes.push('<div class="rm-note warn" data-role="changed">You changed this — acknowledge to remember it.</div>');
    if (r.remembered && !r.changed && !r.acknowledgedAt) notes.push('<div class="rm-note" data-role="remembered">✓ remembered for next time</div>');
    const input = (val) => r.choices && r.choices.length
      ? `<select class="rm-edit" data-role="input" aria-label="${esc(r.label)}"${r.unitKind === "checkbox-group" ? " multiple" : ""}>${r.unitKind === 'checkbox-group' ? '' : '<option value="">Choose…</option>'}${
          r.choices.map(c => `<option${String(c) === String(val) ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>`
      : `<input class="rm-edit" data-role="input" aria-label="${esc(r.label)}" value="${esc(val ?? '')}" placeholder="${r.unitKind === 'date' ? 'MM/DD/YYYY' : 'type it here'}">`;
    let acts = '';
    if (r.group === 'need') {
      if (r.canType) {
        acts += `<div class="rm-acts">${input(r.copyValue ?? '')}<button class="rm-btn primary" data-role="use">use it</button></div>`;
        acts += `<div class="rm-acts">${r.noRemember || r.neverFill ? '' : `<label class="rm-mem"><input type="checkbox" data-role="remember" ${r.rememberOff ? '' : 'checked'}> Remember for next time</label>`}${
          r.copyValue ? '<button class="rm-btn" data-role="copy">copy</button>' : ''}${r.optional ? '<button class="rm-btn" data-role="leave">leave blank</button>' : ''}</div>`;
      } else if (r.copyValue) acts += '<div class="rm-acts"><button class="rm-btn" data-role="copy">copy</button></div>';
      // D98 (J6): the résumé upload opens the on-page résumé panel — it generates only on that panel's own button.
      if (r.resumeOffer) acts += '<div class="rm-acts"><button class="rm-btn" data-role="resume">Make a résumé for this job</button></div>';
    } else if (r.group === 'check') {
      acts += `<div class="rm-acts">${r.canEdit === false ? '' : '<button class="rm-btn" data-role="edit">edit</button>'}<button class="rm-btn ack" data-role="ack">acknowledge</button></div>`;
    } else if (r.changed) {
      acts += '<div class="rm-acts"><button class="rm-btn" data-role="edit">edit</button><button class="rm-btn ack" data-role="ack">acknowledge</button></div>';
    } else if (r.byDraft && !r.settled && r.unitKind !== 'item' && r.source !== 'draft') {
      acts += '<div class="rm-acts"><button class="rm-btn" data-role="edit">edit</button></div>';
    }
    const editor = `<div class="rm-acts" data-role="editor" hidden>${input(r.value)}<button class="rm-btn primary" data-role="save">save</button></div>`;
    return `
      <div class="rm-row" data-group="${r.group}" data-band="${r.group}" data-idx="${i}">
        <div class="rm-bar"></div>
        <div class="rm-main">
          <div class="rm-f"><span class="rm-fl" data-role="label">${esc(r.label)}</span>${multiStep && r.step ? `<span class="rm-step"> · ${esc(r.step)}</span>` : ''}${r.source ? `<span class="rm-pill ${markOf(r)}">${esc(r.source)}</span>` : ''}${
            r.eligibility ? '<span class="rm-pill elig">eligibility</span>' : ''}</div>
          ${r.value ? `<div class="rm-v" data-role="value">${esc(r.value)}</div>` : r.copyValue ? `<div class="rm-v" data-role="value">${esc(r.copyValue)}</div>` : ''}
          ${notes.join('')}${acts}${r.group !== 'need' ? editor : ''}
        </div>
      </div>`;
  };

  const draw = () => {
    const s = panelSummary(rows);
    if (run.collapsed) {
      panel.className = 'rm-slim';
      panel.innerHTML = `<div class="rm-mark" aria-hidden="true"><span class="rm-slash">/</span>draft</div>
        <span class="rm-slimtxt" data-role="slim">${s.need ? `<b>${s.need} need${s.need === 1 ? 's' : ''} you</b>` : 'nothing needs you'} · ${s.filled} of ${s.total} filled</span>
        <span class="rm-sp"></span>
        <button class="rm-ib" data-role="expand" aria-label="Expand the panel" title="Expand">▢</button>
        <button class="rm-ib" data-role="close" aria-label="Close the panel" title="Close (Esc)">×</button>`;
    } else {
      panel.className = '';
      const groups = GROUPS.map(([g, title]) => {
        const items = rows.map((r, i) => [r, i]).filter(([r]) => r.group === g);
        if (!items.length) return '';
        const open = run.open[g] !== false;
        return `<div class="rm-sec" data-group="${g}">
          <button class="rm-lbl" data-role="group" data-g="${g}" aria-expanded="${open}">${open ? '▾' : '▸'} ${title} <span class="rm-n">${items.length}</span></button>
          <div class="rm-rows" data-role="rows"${open ? '' : ' hidden'}>${items.map(([r, i]) => rowHtml(r, i)).join('')}</div></div>`;
      }).join('');
      panel.innerHTML = `
        <div class="rm-hd" data-role="drag">
          <div class="rm-top">
            <div class="rm-mark" aria-hidden="true"><span class="rm-slash">/</span>draft</div><span class="rm-sp"></span>
            <button class="rm-ib" data-role="dock" aria-label="${host.dataset.side === 'right' ? 'Dock on the left' : 'Dock on the right'}" title="Dock">${host.dataset.side === 'right' ? '⇤' : '⇥'}</button>
            <button class="rm-ib" data-role="collapse" aria-label="Collapse the panel" title="Collapse">–</button>
            <button class="rm-ib" data-role="close" aria-label="Close the panel" title="Close (Esc)">×</button>
          </div>
          <div class="rm-t">Review before you submit</div>
          <div class="rm-prog" data-role="progress">${esc(s.line)}${meta.resumeAttached ? ' · résumé attached' : ''}
            <div class="rm-pb" aria-hidden="true"><i style="width:${s.total ? Math.round(s.filled / s.total * 100) : 0}%"></i></div></div>
          <div class="rm-s">Draft never submits for you.${meta.waiting ? ' draft is waiting for you on this step.' : ''}</div>
        </div>
        ${meta.review?.showInPanel ? `<div class="rm-remind" data-role="review">${esc(meta.review.text || 'Time to review your eligibility and disclosure answers — in draft Settings → Saved answers.')}</div>` : ''}
        ${meta.resolverBug ? `<div class="rm-bug"><b>Resolver bug.</b> An eligibility answer was matched by a
          guess: ${esc(meta.resolverBug.map(b => b.field).join(', '))}. This should be unreachable — do not
          rubber-stamp it. Answer it yourself.</div>` : ''}
        <div class="rm-sc">${groups}</div>
        <div class="rm-ft">
          <div class="rm-state ${s.ready ? 'ready' : 'block'}" data-role="state">${esc(s.state)}</div>
          <div class="rm-s" style="margin-top:6px">Submit the form yourself when you are happy with it.</div>
          <!-- D56: once YOU have submitted, one click records it — from this page, which is the evidence. -->
          <button class="rm-btn" data-role="submitted" style="margin-top:8px" ${s.ready ? '' : 'disabled aria-disabled="true"'}>I submitted it</button>
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
    }
    host.dataset.ready = String(s.ready);
    host.dataset.need = String(s.need);
    host.dataset.filled = String(s.filled);
    return s;
  };

  // Reported, never acted on: the overlay does not submit and does not enable a submit control.
  const report = () => {
    const s = panelSummary(rows);
    void send({
      type: 'GATE_REVIEW_STATE', ready: s.ready,
      acknowledged: rows.filter(r => run.rows[r.key]?.action === 'ack').map(r => r.key),
      edits: rows.filter(r => run.rows[r.key]?.action === 'edited' || run.rows[r.key]?.action === 'typed').map(r => ({ key: r.key, value: run.rows[r.key].value })),
      counts: { filled: s.filled, of: s.total, needYou: s.need, check: s.check },
    });
  };
  const redraw = () => { draw(); report(); };

  // The question as the page shows it, without its required "*" (the server's key ignores it; the Copy sheet shows it).
  const keyFields = (r, value) => ({ question: r.label, widgetKind: r.widgetKind || 'text', options: r.options || null, answer: value });
  const applyToPage = (r, value) => send({
    type: 'GATE_REVIEW_EDIT',
    field: { ...(r.locator?.[0] || {}), label: r.locator?.[0]?.label || r.label, unitKind: r.unitKind, question: r.question, locator: r.locator || [] },
    value,
  });
  const tookOnPage = (reply) => !!(reply?.ok && reply.result && (reply.result.filled || []).length && !(reply.result.skipped || []).some(x => x.reason !== 'kept_existing'));

  const close = () => {
    run.closed = true;
    cleanup();
    host.remove();
  };

  const onClick = async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const role = btn.dataset.role;
    if (role === 'close') return close();
    if (role === 'collapse') { run.collapsed = true; return redraw(); }
    if (role === 'expand') { run.collapsed = false; return redraw(); }
    if (role === 'group') { const g = btn.dataset.g; run.open[g] = run.open[g] === false; return draw(); }
    if (role === 'dock') {
      const next = host.dataset.side === 'right' ? 'left' : 'right';
      G.side = next; place(next, G.top); draw();
      void send({ type: 'PANEL_DOCK', side: next });
      return;
    }

    // Role first, row second. The batch button lives in the FOOTER, not in a field row.
    if (role === 'next') {
      btn.disabled = true;
      btn.textContent = 'opening the next one…';
      // The reply is read, not discarded. A batch that cannot advance used to leave this button
      // sitting on "opening…" forever, which is indistinguishable from slow.
      const reply = await send({ type: 'GATE_BATCH_NEXT' });
      if (!reply?.ok) {
        btn.disabled = false;
        btn.textContent = 'Could not open the next one — try again';
        btn.dataset.error = reply?.reason || 'no_reply';
      }
      return;
    }

    // D56: "I submitted it" — recorded by the service worker against this page; disabled until Ready (D96 §5).
    if (role === 'submitted') {
      if (!panelSummary(rows).ready) return;
      const msg = root.querySelector('[data-role="submitted-msg"]');
      btn.disabled = true;
      btn.textContent = 'recording…';
      const reply = await send({ type: 'GATE_SUBMITTED' });
      const ok = !!reply?.ok;
      btn.textContent = ok ? 'recorded' : 'I submitted it';
      btn.className = ok ? 'rm-btn done' : 'rm-btn';
      btn.disabled = ok;
      if (msg) msg.textContent = reply?.message || (ok ? '' : 'Could not record it — try again.');
      return;
    }

    const rowEl = btn.closest('.rm-row');
    if (!rowEl) return;
    const r = rows[Number(rowEl.dataset.idx)];
    if (!r) return;
    const input = () => rowEl.querySelector('[data-role="input"]');
    const valueOf = (el) => (el ? (el.tagName === 'SELECT' && el.multiple ? [...el.selectedOptions].map(o => o.value).join(', ') : el.value) : '').trim();
    const say = (text, warn = false) => {
      let n = rowEl.querySelector('[data-role="say"]');
      if (!n) { n = document.createElement('div'); n.dataset.role = 'say'; rowEl.querySelector('.rm-main').append(n); }
      n.className = `rm-note${warn ? ' warn' : ''}`;
      n.textContent = text;
    };

    if (role === 'copy') {
      const v = r.copyValue ?? r.value ?? '';
      try { await navigator.clipboard.writeText(String(v)); btn.textContent = 'copied'; } catch { btn.textContent = 'select it and copy'; }
      return;
    }
    if (role === 'leave') { run.rows[r.key] = { action: 'left' }; Object.assign(r, { group: 'ok', source: 'left blank by you', note: null, copyValue: null }); return redraw(); }

    // Everything below writes to the page or to the server: a page script's synthetic click is never enough.
    if (!ev.isTrusted) return;

    if (role === 'resume') { void send({ type: 'RESUME_PANEL_OPEN' }); return; }

    if (role === 'edit') {
      const ed = rowEl.querySelector('[data-role="editor"]');
      if (ed) { ed.hidden = false; ed.querySelector('[data-role="input"]')?.focus(); }
      return;
    }

    if (role === 'use' || role === 'save') {
      const el = role === 'use' ? input() : rowEl.querySelector('[data-role="editor"] [data-role="input"]');
      const value = valueOf(el);
      if (!value) { say('Type it first.', true); return; }
      btn.disabled = true;
      r.pending = true;
      // The value goes into the page's own control through the service worker, by the SAME native-setter path the
      // fill used — and is read back. A value that did not take stays under Needs you, ready to copy.
      const reply = await applyToPage(r, value);
      btn.disabled = false;
      try {
      if (!tookOnPage(reply)) {
        Object.assign(r, { group: r.group === 'need' ? 'need' : r.group, copyValue: value });
        say("The page did not take it — copy it in yourself.", true);
        if (role === 'use') { const c = rowEl.querySelector('[data-role="copy"]'); if (!c) { const b = document.createElement('button'); b.className = 'rm-btn'; b.dataset.role = 'copy'; b.textContent = 'copy'; btn.after(b); } }
        return;
      }
      if (role === 'use') {
        const remember = !!rowEl.querySelector('[data-role="remember"]')?.checked && !r.noRemember;
        let note = null;
        if (remember) {
          const ack = await send({ type: 'ANSWER_ACKNOWLEDGE', ...keyFields(r, value), source: 'you_typed' });
          note = ack?.ok ? '✓ remembered for next time' : ack?.error === 'never_remembered' ? 'draft does not remember this kind of answer.' : 'Could not remember it — it is used for this application only.';
          run.rows[r.key] = { action: 'typed', value, remembered: !!ack?.ok, note };
        } else run.rows[r.key] = { action: 'typed', value, remembered: false, note: 'used for this application only' };
        Object.assign(r, { group: 'ok', source: 'you typed', value, byDraft: true, copyValue: null, remembered: run.rows[r.key].remembered, note: run.rows[r.key].note });
        return redraw();
      }
      // An EDIT of a filled value: recorded as a CHANGE — the new value serves this application only, the old one is
      // no longer auto-used, and nothing is stored until it is acknowledged again (D96 §4).
      const ch = await send({ type: 'ANSWER_CHANGE', ...keyFields(r, value) });
      run.rows[r.key] = { action: 'edited', value, changed: true, remembered: false,
        note: ch && !ch.ok && ch.error !== 'never_remembered' ? 'Could not record the change — it is used for this application only.' : null };
      Object.assign(r, { value, changed: true, remembered: false, acknowledgedAt: null, note: run.rows[r.key].note });
      return redraw();
      } finally { r.pending = false; }
    }

    if (role === 'ack') {
      btn.disabled = true;
      const ack = await send({ type: 'ANSWER_ACKNOWLEDGE', ...keyFields(r, r.value), source: r.changed ? 'you_typed' : 'you_acknowledged' });
      const note = ack?.ok ? '✓ remembered for next time'
        : ack?.error === 'never_remembered' ? 'Checked. draft does not remember this kind of answer.' : 'Checked — but it could not be remembered; it is used for this application only.';
      run.rows[r.key] = { action: 'ack', remembered: !!ack?.ok, note };
      Object.assign(r, { group: 'ok', source: 'you acknowledged', changed: false, remembered: !!ack?.ok, note });
      return redraw();
    }
  };

  // ── Keys: Esc closes (when the focus is in the panel, or nowhere in particular — never while you are in a field
  // of the page, where Esc belongs to the page's own dropdown).
  const onKey = (ev) => {
    if (ev.key !== 'Escape' || ev.isComposing) return;
    const inPanel = ev.composedPath?.().includes(host);
    const t = ev.target;
    const inPageField = !inPanel && t && t !== document.body && t !== document.documentElement && t.matches?.('input, select, textarea, [role="combobox"], [contenteditable="true"], [aria-haspopup="listbox"]');
    if (inPanel || !inPageField) close();
  };

  // ── Drag by the header; snap to the nearer side, remembered for the tab (PANEL_DOCK).
  let drag = null;
  const onDown = (ev) => {
    if (ev.button !== 0 || !ev.target.closest('[data-role="drag"]') || ev.target.closest('button')) return;
    const r = host.getBoundingClientRect();
    drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
    ev.preventDefault();
  };
  const onMove = (ev) => {
    if (!drag) return;
    host.style.left = `${Math.max(0, ev.clientX - drag.dx)}px`;
    host.style.right = '';
    host.style.top = `${Math.max(0, ev.clientY - drag.dy)}px`;
  };
  const onUp = () => {
    if (!drag) return;
    drag = null;
    const r = host.getBoundingClientRect();
    const next = r.left + r.width / 2 < innerWidth / 2 ? 'left' : 'right';
    G.side = next; G.top = r.top;
    place(next, r.top);
    draw();
    void send({ type: 'PANEL_DOCK', side: next });
  };

  // ── Never over the field being filled: when a page control takes focus under the panel, the panel moves to the
  // other side (and, on a page too narrow for that, collapses to its slim bar).
  const overlaps = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
  const onFocus = (ev) => {
    const t = ev.target;
    if (!t || t === host || ev.composedPath?.().includes(host) || !t.getBoundingClientRect) return;
    const f = t.getBoundingClientRect();
    if (!overlaps(host.getBoundingClientRect(), f)) return;
    const other = host.dataset.side === 'right' ? 'left' : 'right';
    place(other, G.top);
    if (overlaps(host.getBoundingClientRect(), f)) { run.collapsed = true; draw(); }
  };

  // ── Live: a Needs-you row whose field you answer ON THE PAGE moves to Filled (emptiness only — never the value).
  const holds = (loc) => {
    const el = (loc.id && document.getElementById(loc.id)) || (loc.name && document.getElementsByName(loc.name)[0]) || null;
    if (!el) return null;
    const t = String(el.type || '').toLowerCase();
    if (t === 'radio' || t === 'checkbox') {
      return el.name ? !!document.querySelector(`input[name="${CSS.escape(el.name)}"]:checked`) : el.checked === true;
    }
    if (t === 'file') return !!(el.files && el.files.length);
    if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT' && el.tagName !== 'TEXTAREA') {
      const tx = String(el.textContent || '').trim();
      return !!tx && !/^(select|choose|please|--)/i.test(tx);
    }
    if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list') {
      const box = el.closest('[data-automation-id^="formField"], [role="group"], fieldset') || el.parentElement;
      return !!box?.querySelector('[data-automation-id="selectedItem"], [role="listitem"], li');
    }
    return String(el.value ?? '').trim() !== '';
  };
  // Never re-drawn under the person's hands: while they type in the panel (or a row is being saved) it waits.
  const busy = () => !!root.activeElement || [...root.querySelectorAll('[data-role="editor"]')].some(e => !e.hidden);
  const watch = () => {
    if (busy()) return;
    let moved = false;
    for (const r of rows) {
      if (r.pending || r.group !== 'need' || r.step !== (meta.currentStep ?? r.step) || !r.locator?.length) continue;
      const states = r.locator.map(holds).filter(v => v !== null);
      const answered = r.unitKind === 'date' ? states.length && states.every(Boolean) : states.some(Boolean);
      if (!answered) continue;
      run.rows[r.key] = { action: 'page', note: r.neverFill ? 'you did this on the page' : 'answered on the page' };
      Object.assign(r, { group: 'ok', source: 'on the page', note: run.rows[r.key].note, copyValue: null, canType: false });
      moved = true;
    }
    if (moved) redraw();
  };
  const onPageInput = (ev) => { if (!ev.composedPath?.().includes(host)) setTimeout(watch, 50); };
  const timer = setInterval(watch, 1500);

  function cleanup() {
    clearInterval(timer);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('input', onPageInput, true);
    document.removeEventListener('change', onPageInput, true);
    removeEventListener('mousemove', onMove, true);
    removeEventListener('mouseup', onUp, true);
  }
  host.__draftCleanup = cleanup;
  root.addEventListener('click', (ev) => { void onClick(ev); });
  root.addEventListener('mousedown', onDown);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocus, true);
  document.addEventListener('input', onPageInput, true);
  document.addEventListener('change', onPageInput, true);
  addEventListener('mousemove', onMove, true);
  addEventListener('mouseup', onUp, true);

  const s = draw();
  report();
  return { ok: true, rendered: rows.length, ready: s.ready, counts: { filled: s.filled, of: s.total, needYou: s.need, check: s.check } };
}

/** Injected, ISOLATED world: take the review panel off the page (a refused fill must not leave another step's panel). */
export function removeReviewPanel() {
  const host = document.getElementById('rm-gate-review-overlay');
  if (!host) return false;
  try { host.__draftCleanup?.(); } catch { /* gone */ }
  host.remove();
  return true;
}
