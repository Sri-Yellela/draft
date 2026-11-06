// ── ⭐ T24 · THE INTENT MODEL — which path the user is on in THIS tab, from the strongest tell present ────────────────────
//
// Owner, 10-15: "what other tells do we have to do this accurately?" The résumé starts from exactly two places (T22
// REVISED): the Draft button pressed before any autofill → the job is DRAFTED (the board's queue) and its résumé is QUEUED
// in that pipeline; and, in a manual fill, the résumé field's own row ("Generate and attach", T18). So the extension must
// know which path a tab is on:
//
//   mode   'drafted' — the job is drafted (Draft House holds it); the résumé is queued, joined or attached
//          'manual'  — the user is filling it by hand; a résumé is offered ON CUE at the résumé field (or never)
//          'view'    — a posting with no form; only Draft applies here
//          null      — not enough to say (the popup shows nothing about the path)
//   intent the board's: 'apply' (its Draft / Apply) · 'view' (Open posting) · null (the board did not open this tab)
//
// THE TELLS, IN THIS ORDER OF AUTHORITY (the WORKLOG's T24 text governs):
//   (1) the CONTROL pressed — Draft · Fill · the résumé row · a choice in the dock — explicit, always wins
//   (2) the BOARD'S INTENT — openPosting(job, { intent }) → the bridge → the tab binding's board.intent
//   (3) SEQUENCE on this tab — Draft before any fill → drafted; a fill started or filled > 0 → manual; Draft AFTER a fill
//       TRACKS the application and never regenerates a résumé already attached
//   (4) PAGE TYPE — a posting with no form allows only Draft ('view'); an application form allows both
//   (5) the JOB'S SERVER STATE — already drafted → never queued twice (its state is said); the account's apply mode; a
//       portal sign-in wall is SEMI only (D36's gated hand-off); ⛔ full auto stays locked whatever any tell says
//   (6) a RÉSUMÉ already known for (job, base) → attach, never regenerate; one in flight → join it, never a second
//   (7) the RÉSUMÉ FIELD — already holding a file → skip
//   (8) the ALLOWANCE — 0 of 10 Draft slots → said BEFORE anything is queued
//   (9) the USER'S SETTINGS — onDraft 'queue' / 'ask'; manualResume 'on_cue' / 'never' (intentSettings.js)
// When the tells disagree or are absent on an application form: ASK ONCE — "Draft this job and queue its résumé, or just
// fill this form yourself?" — with Remember my choice.
//
// ⛔ DETERMINISTIC. decidePath is a pure function of the tells it is given: no clock, no randomness, no history of what
//    the user did on other jobs. The same tells always give the same path. "Remember my choice" is the user's own tick,
//    stored with the account — never learned.
// ⛔ NOTHING GENERATES BY ITSELF (D17). A remembered 'drafted' never drafts on its own: without a press it only offers
//    the one button.
//
// No imports: the popup's TabState (tabState.js) and the worker (intent.js) both read it, and node tests drive it bare.

export const MODES = Object.freeze(['drafted', 'manual', 'view']);
export const CONTROLS = Object.freeze(['draft', 'fill', 'resume_row', 'choose_drafted', 'choose_manual']);
/** The owner's sentence. ⚠ The one generation measured in production took 24.3 s (WORKLOG 43k); 40 s is said, not promised. */
export const READY_IN_SECONDS = 40;
export const PATH_QUESTION = 'Draft this job and queue its résumé, or just fill this form yourself?';
export const RESUME_QUESTION = 'Drafted? Queue its résumé too — it uses one of your Draft slots.';

const DEFAULTS = Object.freeze({ onDraft: 'queue', manualResume: 'on_cue', remembered: null });
const settingsOf = (s) => ({
  onDraft: s?.onDraft === 'ask' ? 'ask' : DEFAULTS.onDraft,
  manualResume: s?.manualResume === 'never' ? 'never' : DEFAULTS.manualResume,
  remembered: s?.remembered === 'drafted' || s?.remembered === 'manual' ? s.remembered : null,
});

/**
 * The tells the extension holds LOCALLY for a tab — its binding (tabBinding.js) and its job's progress record
 * (progress.js). No page read, no request: what the popup may know on open (D23). Pure.
 */
export function localTells({ binding = null, record = null } = {}) {
  const intent = binding?.board?.intent === 'apply' || binding?.board?.intent === 'view' ? binding.board.intent
    : binding?.via === 'board' ? 'view' : null;
  return {
    boardIntent: intent,
    pathChoice: binding?.path === 'drafted' || binding?.path === 'manual' ? binding.path : null,
    sequence: { draftedHere: !!record?.drafted?.at, fillStarted: !!record?.filled, filled: Number(record?.filled?.n) || 0 },
    resume: { attachedOnPage: !!record?.resume?.attached },
  };
}

const RESUME_KNOWN = (state) => (state === 'ready' ? 'attach' : state === 'in_flight' ? 'join' : null);

/**
 * THE decision. `t`:
 *   control       one of CONTROLS, or null (nothing pressed — the dock opened, the popup drew the tab)
 *   boardIntent   'apply' | 'view' | null
 *   pathChoice    'drafted' | 'manual' | null — what the user chose on this tab (the dock's switch / the question)
 *   sequence      { draftedHere, fillStarted, filled }
 *   page          { hasForm: true | false | null, signInWall }
 *   server        null | { drafted, status, applyMode, autoLocked, held }
 *   resume        { state: 'ready' | 'in_flight' | 'made' | 'none' | 'no_base' | null, attachedOnPage }
 *   field         { present, required, holdsFile } (the résumé upload on this step)
 *   slots         null | { remaining, limit }
 *   settings      { onDraft, manualResume, remembered }
 *   resumeAnswer  'queue' | 'skip' — the answer to "queue its résumé too?" (onDraft 'ask'), or "without the résumé"
 *   asked         true when the path question was already put on this tab
 * → { mode, intent, by, applyMode, draft, resume, need, ask, refuse }
 *   draft   'queue' (draft it now) · 'track' (draft it after a fill — the application is tracked) · 'already' · 'none'
 *   resume  'queue' · 'join' · 'attach' · 'skip_attached' · 'skip_no_base' · 'skip_chosen' · 'ask' · 'on_cue' · 'never' · 'none'
 */
export function decidePath(t = {}) {
  const s = settingsOf(t.settings);
  const seq = t.sequence || {};
  const page = t.page || {};
  const server = t.server || null;
  const known = t.resume?.state ?? null;
  const attached = !!(t.resume?.attachedOnPage || t.field?.holdsFile);
  const filledBefore = !!(seq.fillStarted || (Number(seq.filled) || 0) > 0);
  const draftedAlready = !!server?.drafted;
  // (5) ⛔ full auto only if the SERVER says it is unlocked AND the account's mode is full AND no sign-in wall — today
  // FULL_AUTO_PROVEN = false keeps it locked, so this is 'semi'. A sign-in wall is semi whatever the rest says (D36).
  const applyMode = server?.applyMode === 'full' && server?.autoLocked === false && !page.signInWall ? 'full' : 'semi';
  const base = { intent: t.boardIntent ?? null, applyMode, signInWall: !!page.signInWall, draft: 'none', resume: 'none', need: 0, ask: null, refuse: null };

  const resumeWhenDrafting = () => {
    if (attached) return 'skip_attached';                       // (3)/(7) Draft after a fill: never regenerate what is attached
    const k = RESUME_KNOWN(known);                              // (6)
    if (k) return k;
    if (known === 'no_base') return 'skip_no_base';
    if (t.resumeAnswer === 'skip') return 'skip_chosen';
    if (t.resumeAnswer === 'queue') return 'queue';
    return s.onDraft === 'ask' ? 'ask' : 'queue';               // (9)
  };
  const manualResume = () => RESUME_KNOWN(known) || (s.manualResume === 'never' ? 'never' : 'on_cue');
  const modeNow = () => (draftedAlready || seq.draftedHere || t.pathChoice === 'drafted' ? 'drafted'
    : t.pathChoice === 'manual' || filledBefore ? 'manual' : null);

  const drafting = (by) => {
    if (draftedAlready) return { ...base, mode: 'drafted', by, draft: 'already', resume: RESUME_KNOWN(known) || 'none' };
    const draft = filledBefore ? 'track' : 'queue';
    const resume = resumeWhenDrafting();
    if (resume === 'ask') {
      return { ...base, mode: modeNow(), by, draft: 'none', resume, ask: { kind: 'resume', question: RESUME_QUESTION,
        choices: [{ choice: 'drafted', resume: 'queue', label: 'Draft it and queue its résumé', primary: true },
                  { choice: 'drafted', resume: 'skip', label: 'Draft it without the résumé' }] } };
    }
    // (8) a NEW generation spends a second slot; a ready, in-flight or already-made one does not
    const need = 1 + (resume === 'queue' && known === 'none' ? 1 : 0);
    const slots = t.slots;
    if (slots && Number.isFinite(slots.remaining) && slots.remaining < need) {
      const limit = Number.isFinite(slots.limit) ? slots.limit : 10;
      return { ...base, mode: modeNow(), by, need, refuse: slots.remaining <= 0
        ? { reason: 'slots', message: `You have 0 of your ${limit} drafts left in the last 24 hours — nothing was queued.` }
        : { reason: 'slots_short', canDraftOnly: true,
            message: `Drafting this job and queuing its résumé uses ${need} of your drafts; you have ${slots.remaining} of ${limit} left — nothing was queued.` } };
    }
    return { ...base, mode: 'drafted', by, draft, resume, need };
  };

  // (1) the control pressed — always wins
  switch (t.control) {
    case 'draft':
    case 'choose_drafted':
      return drafting('control');
    case 'choose_manual':
      return { ...base, mode: 'manual', by: 'control', resume: manualResume() };
    case 'fill':
      // a fill on a drafted tab fills THAT application; anywhere else it is the manual path. ⛔ A fill never generates.
      return modeNow() === 'drafted'
        ? { ...base, mode: 'drafted', by: 'sequence', draft: draftedAlready || seq.draftedHere ? 'already' : 'none', resume: RESUME_KNOWN(known) || 'none' }
        : { ...base, mode: 'manual', by: 'control', resume: manualResume() };
    case 'resume_row':
      // the user's own press at the résumé field: join or attach what exists, else start it (the row is shown only when offered)
      return { ...base, mode: modeNow() === 'drafted' ? 'drafted' : 'manual', by: 'control', resume: RESUME_KNOWN(known) || 'queue' };
    default: break;
  }

  // nothing pressed: the tab's own record of what the user did, in order
  if (t.pathChoice === 'drafted' || draftedAlready || seq.draftedHere) {
    const by = t.pathChoice === 'drafted' ? 'choice' : draftedAlready ? 'server' : 'sequence';
    if (t.pathChoice !== 'manual') return { ...base, mode: 'drafted', by, draft: draftedAlready || seq.draftedHere ? 'already' : 'none', resume: RESUME_KNOWN(known) || 'none' };
  }
  if (t.pathChoice === 'manual') return { ...base, mode: 'manual', by: 'choice', resume: manualResume() };
  if (filledBefore) return { ...base, mode: 'manual', by: 'sequence', resume: manualResume() };
  // (4) a posting with no form: only Draft
  if (page.hasForm === false) return { ...base, mode: 'view', by: t.boardIntent === 'view' ? 'board' : 'page' };
  if (page.hasForm !== true) return { ...base, mode: t.boardIntent === 'view' ? 'view' : null, by: t.boardIntent ? 'board' : null };
  // an application form, nothing done here yet — the remembered answer, else ASK ONCE (the board's 'apply' is not enough:
  // it says the user means to apply, not which path; its 'view' disagrees with a form being here)
  if (s.remembered === 'manual') return { ...base, mode: 'manual', by: 'remembered', resume: manualResume() };
  if (s.remembered === 'drafted') return { ...base, mode: null, by: 'remembered', offer: 'drafted' };   // ⛔ D17: offered, never done
  if (t.asked) return { ...base, mode: null, by: null };
  return { ...base, mode: null, by: 'ask', ask: { kind: 'path', question: PATH_QUESTION, remember: true,
    choices: [{ choice: 'drafted', label: 'Draft it and queue its résumé', primary: true }, { choice: 'manual', label: 'Just fill it myself' }] } };
}

/**
 * What the dock says, in words, and the one-press switch. Pure.
 * → { line, buttons: [{ choice, resume?, label, primary? }], remember, tone: 'ask' | 'refuse' | 'path' }
 */
export function pathWords(d = {}, { readyIn = READY_IN_SECONDS } = {}) {
  if (d.refuse) {
    return { tone: 'refuse', line: d.refuse.message, remember: false,
      buttons: d.refuse.canDraftOnly ? [{ choice: 'drafted', resume: 'skip', label: 'Draft it without the résumé' }] : [] };
  }
  if (d.ask) return { tone: 'ask', line: d.ask.question, buttons: d.ask.choices, remember: !!d.ask.remember };
  const wall = d.signInWall ? ' This site wants you signed in — sign in yourself; draft never does.' : '';
  if (d.mode === 'drafted') {
    const lead = d.draft === 'already' ? 'Drafted — in Home' : d.draft === 'track' ? 'Drafted — tracking this application' : 'Drafted';
    const tail = {
      queue: `résumé queued, ready in about ${readyIn} s`,
      join: `its résumé is being made, ready in about ${readyIn} s`,
      attach: 'its résumé is ready to attach',
      skip_attached: 'the résumé already attached stays; nothing regenerated',
      skip_no_base: 'add your résumé in draft to have one made',
      skip_chosen: 'no résumé queued',
    }[d.resume];
    return { tone: 'path', line: `${tail ? `${lead} — ${tail}` : lead}.${wall}`, remember: false,
      buttons: [{ choice: 'manual', label: 'Fill it myself instead' }] };
  }
  if (d.mode === 'manual') {
    const tail = { on_cue: 'a résumé on cue', never: 'no résumé offered (your setting)', attach: 'your résumé for this job is ready to attach',
      join: 'its résumé is being made' }[d.resume] || 'a résumé on cue';
    return { tone: 'path', line: `Filling by hand — ${tail}.${wall}`, remember: false, buttons: [{ choice: 'drafted', label: 'Draft it instead' }] };
  }
  if (d.mode === 'view') {
    return { tone: 'path', line: 'Viewing this posting — Draft it to apply with draft.', remember: false, buttons: [{ choice: 'drafted', label: 'Draft it' }] };
  }
  if (d.offer === 'drafted') {
    return { tone: 'path', line: 'Not drafted yet — you chose to draft jobs like this.', remember: false,
      buttons: [{ choice: 'drafted', label: 'Draft it and queue its résumé', primary: true }, { choice: 'manual', label: 'Just fill it myself' }] };
  }
  return { tone: 'path', line: 'Draft it, or fill it yourself.', remember: false,
    buttons: [{ choice: 'drafted', label: 'Draft it' }, { choice: 'manual', label: 'Just fill it myself' }] };
}
