// extension/jobPanelModel.js — ⭐ D191 sketch 2 (owner 11-18: "alright go") · WHAT THE ONE PANEL SAYS, pure.
//
// The panel is Tsenta's shape in draft's colours: one status line, the job, ONE button, at most one line under it, and
// "How I apply" at the bottom (https://claude.ai/artifact/4HugMVyxHnjysbCC23okZj, version 2). The owner's 11-18 answers:
// the fit is a PERCENTAGE, "Review before I submit" is a checkbox, the panel opens by itself on job boards.
// ⛔ Few words, no jargon (owner: "too much text jargon … their stack and ats telling the same story") — no stack line,
//   no ATS line, no keywords here; the dock's other tabs carry those when the person goes looking.
// ⛔ Nothing here calls a model: every word comes from the press's read of draft's own data (services/extensionJobFacts.js).
//
// panelModel({ signedIn, page, ctx, pending, settings }) →
//   { kind, status: { text, tone }, job: { title, sub, logo, letter } | null, button: { label, act, disabled },
//     note: { text, act } | null, how: { review, autoOpen } | null }
//   page — the first frame's read of the page itself (no network): { title, company, location }
//   ctx  — the press's read (background.js rememberPressContext): { job, company, prepared }
//   pending — draft's answer has not arrived yet (the panel is drawn from the page first)
// The `act`s are DOCK_ACT's names (background.js), so the panel's buttons are the dock's own actions.

const clean = (s, n = 140) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const pct = (n) => (Number.isFinite(n) ? `${Math.max(0, Math.min(100, Math.round(n)))}% match` : '');
// ⭐ 46x (owner 11-19: "the font color on the ats number should do it no need for the words"): the % alone; its band
// (strong · moderate · weak, the board's) is the number's COLOUR in the panel — "not enough signal" paints it plain.
const BANDS = new Set(['strong', 'moderate', 'weak']);
export const matchWords = (j) => pct(j?.score);
export const matchBand = (j) => (Number.isFinite(j?.score) && BANDS.has(j?.band) ? j.band : null);

/** "sponsors visas" when draft's record shows the employer sponsored; '' otherwise (never a guess). Pure. */
export function sponsorWords(company) {
  const s = clean(company?.sponsorship, 200);
  if (!s) return '';
  return /\bno\b|never|not\b|none/i.test(s) ? '' : 'sponsors visas';
}

/** The job lines: the page's own words first, draft's record over them once it answers. Pure. */
export function jobOf(page, ctx) {
  const j = ctx?.job || null;
  const title = clean(j?.title) || clean(page?.title);
  const company = clean(j?.company) || clean(ctx?.company?.name) || clean(page?.company, 80);
  if (!title && !company) return null;
  const sub = [company, clean(page?.location, 60)].filter(Boolean).join(' · ');
  const logo = typeof ctx?.company?.logo === 'string' && /^https:\/\//.test(ctx.company.logo) ? ctx.company.logo.slice(0, 500) : null;
  return { title: title || company, sub: title ? sub : clean(page?.location, 60), logo, letter: (company || title).charAt(0).toUpperCase() };
}

/**
 * ⭐ D197 #19 (47n) · THE SKILL SQUARES behind More (docs/revamp/extension.md M2: the section's one drawing — the match as lit
 * squares, "4 of your 5 top skills"; green only for proven = on your résumé). From the fit card's own words, in the scorer's
 * order (the résumé's matches first, then the rest), the first five; a claimed word counts as yours (the web's FitCard does).
 * `fit` is fitCardModel's result; null → no squares (no report, or an older worker). Pure.
 */
export function skillSquares(fit, n = 5) {
  const words = Array.isArray(fit?.words) ? fit.words : [];
  const top = words.filter(w => w && typeof w.label === 'string' && w.label.trim()).slice(0, n)
    .map(w => ({ label: clean(w.label, 60), on: w.state === 'on' || w.state === 'claimed' }));
  if (!top.length) return null;
  const have = top.filter(s => s.on).length;
  return { squares: top, words: `${have} of your ${top.length} top skill${top.length === 1 ? '' : 's'}` };
}

export function panelModel({ signedIn = false, page = null, ctx = null, pending = false, settings = {}, home = null, other = false, profile = null, applyMode = null } = {}) {
  const job = jobOf(page, ctx);
  // ⭐ B4 · How I apply: the résumé = the account's active job profile (its name; ▾ lists the others). ⭐ 46x (owner 11-19:
  // "unlock apply for me"): Review before I submit = the account's mode (D100 users.send_mode) — ON = Ask me first (semi),
  // OFF = Apply for me (auto). Unknown (no answer) reads ON, the safe side; `reviewLocked` while the operator paused sending.
  const how = { review: applyMode?.current !== 'auto', reviewLocked: !!applyMode?.locked && applyMode?.current !== 'auto',
    autoOpen: settings.autoOpen !== false, resume: clean(profile?.name, 60) || null };
  const said = (text, tone = 'quiet') => ({ text, tone });

  // ⭐ D191 (5): signed out — the employer's facts from draft's public record, and the way in
  if (!signedIn) {
    const c = ctx?.company || null;
    const facts = [sponsorWords(c), Number(c?.openJobs) > 0 ? `${c.openJobs} open job${c.openJobs === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
    return { kind: 'signed-out', status: said(facts || 'Not signed in'), job,
      button: { label: job ? 'Sign in to see your match' : 'Sign in to draft', act: 'sign-in', disabled: false },
      note: { text: 'New here? Get started', act: 'sign-up' }, how: null };
  }

  if (pending) {
    return { kind: 'arriving', status: said('Checking draft…'), job,
      button: { label: 'Draft this job', act: 'add-draft', disabled: !job }, note: null, how };
  }

  if (!job || other) {
    // ⭐ B3 · any other page (the press, the shortcut, "Ask draft…"): the day, and ONE box — search jobs, or ask draft
    const n = (k) => Math.max(0, Number(home?.[k]) || 0);
    const waiting = n('toSend');
    return { kind: 'other', status: said('Your day'), job: null, button: null,
      day: home ? [{ n: n('newMatches'), label: 'new matches', act: 'open-draft' }, { n: n('needsYou'), label: 'need you', act: 'open-needs' },
        { n: n('drafted'), label: 'drafted', act: 'open-needs' }] : null,
      note: waiting ? { text: `${waiting} waiting to send from this browser`, act: 'open-runner' } : null, ask: true, how };
  }

  const j = ctx?.job || {};
  const state = j.application?.state || null;
  const match = Number.isFinite(j.score) ? matchWords(j) : '';
  const band = matchBand(j);
  const sponsor = sponsorWords(ctx?.company);
  const facts = [match, sponsor].filter(Boolean).join(' · ');

  // On the application form with answers draft prepared for it: the fill (D36 — draft fills, the person submits)
  if (ctx?.prepared && state !== 'Sent') {
    return { kind: 'form', status: said('Your answers are ready', 'busy'), job,
      button: { label: 'Fill this form', act: 'fill', disabled: false },
      note: { text: "Then press the employer's Submit.", act: null }, how };
  }
  switch (state) {
    case 'In progress':
      return { kind: 'drafting', status: said('Tailoring your résumé…', 'busy'), job,
        button: { label: 'Drafting…', act: null, disabled: true }, note: null, how };
    case 'Needs you':
      return { kind: 'needs', status: said('Needs you', 'busy'), job,
        button: { label: 'Answer in draft', act: 'open-needs', disabled: false }, note: null, how };
    case 'Sent':
      return { kind: 'sent', status: said('Sent', 'ok'), job,
        button: { label: 'Open in draft', act: 'open-draft', disabled: false }, note: null, how };
    case 'Failed':
      return { kind: 'failed', status: said("Didn't go through", 'busy'), job,
        button: { label: 'Open in draft', act: 'open-needs', disabled: false }, note: null, how };
    case 'Drafted':
      return j.application?.sendFromHere
        ? { kind: 'ready', status: { ...said(['Résumé ready', match].filter(Boolean).join(' · '), 'ok'), ...(match ? { match, band } : {}) }, job,
            button: { label: 'Apply from here', act: 'fill', disabled: false },
            note: { text: 'Fills the form. You press Submit.', act: null }, how }
        : { kind: 'drafted', status: said('Drafted · waits for your approval', 'ok'), job,
            button: { label: 'Open in draft', act: 'open-needs', disabled: false }, note: null, how };
    default:
      return { kind: 'job', status: { ...said(facts || (j.known ? 'On your board' : 'New to draft'), facts ? 'ok' : 'quiet'), ...(match ? { match, band } : {}) }, job,
        // a posting draft does not hold yet: add it, then draft it (DOCK_ACT 'add-draft'), in ONE press
        button: { label: 'Draft this job', act: j.known ? 'draft' : 'add-draft', disabled: false }, note: null, how };
  }
}
