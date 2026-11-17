#!/usr/bin/env node
/**
 * Fake ATS — a local test target for services/applyAutomation.js
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 * autoApply() can only be exercised against a real employer's form, which means
 * every test costs a real application under a real candidate's name and cannot be
 * undone. This serves ATS-shaped forms locally so the pipeline can be run end to
 * end, including the submit click, with no outbound traffic.
 *
 * This is deliberately NOT a friendly mock. Every form below contains at least one
 * TRAP reproducing a specific weakness found in the buildAnswers() audit. A run that
 * "succeeds" against these forms while answering the traps wrongly is exactly the
 * failure we cannot detect in production — so assert on the RECORDED ANSWERS, never
 * merely on status === 'submitted'.
 *
 * USAGE
 *   node scripts/fakeAts.js               # serves on :4599
 *   PORT=5000 node scripts/fakeAts.js
 *
 *   GET  /                     index of available forms
 *   GET  /greenhouse           2-step form (traps: sponsorship inversion, name ambiguity)
 *   GET  /lever                1-step form (traps: lowercase yes/no, "Review and Submit")
 *   GET  /ashby                1-step form (traps: required typeahead, date format)
 *   GET  /ashby-spa            THE LIVE POSTING'S MEASURED SHAPE — React-rendered in two chunks,
 *                              transcribed from ae1Diagnose.mjs's reading of a real Ashby form:
 *                              nameless required date picker, UUID field names, checkboxes named
 *                              with their own question, EEOC radio groups. This is the target the
 *                              submit path had never been exercised against; /ashby is a native-
 *                              control replica and that gap is what AE1/AE2 came out of.
 *                              ?answerable=1  ?autofilltrap=1  ?deadsubmit=1  ?delay=ms
 *   GET  /multistep            2-step form offering BOTH navigation styles from one step 1
 *                              (real POST -> new document, history.pushState -> same document)
 *                              plus a cross-origin control. Built for TASK G0: whether an
 *                              activeTab grant survives a step transition.
 *   GET  /spa                  JS-RENDERED form — fields injected in two chunks after a delay
 *                              (?delay=ms, default 2500; ?delay=0 renders synchronously).
 *                              Reproduces the hydration timing every real ATS has and that
 *                              static HTML cannot: a discovery pass that does not wait for a
 *                              readiness condition walks an empty DOM here, exactly as it did
 *                              against a real Ashby posting.
 *   GET  /workday-replica      D55: a WORKDAY-SHAPED six-step wizard (dropdown listboxes in a portal,
 *                              typeaheads, skill chips, Add Another sections, a drop zone behind a
 *                              cover-letter decoy, Save and Continue, Review, a RECORDED Submit).
 *                              GET /_workday-replica/state reads what it saved and whether Submit
 *                              was ever pressed.
 *   GET  /_submissions         JSON of everything submitted so far (for assertions)
 *   POST /_reset               clear recorded submissions
 *
 * FILE UPLOADS ARE REAL. Every form carrying a file input declares
 * enctype="multipart/form-data" and the recorder parses it. Each submission records:
 *   fields     text parts only, name -> value (same shape urlencoded produced)
 *   files      name -> { filename, contentType, size }, or NULL when the input was
 *              present but no file was chosen — that is the distinction between
 *              "resume uploaded" and "resume field skipped", and it is the whole point
 *   partCount  parts in THIS post. A multi-step flow can report 0 here and still list uploads in
 *              `files` — greenhouse takes the resume at step 1 and posts step 2 urlencoded, so
 *              assert on `files`, never on partCount, to decide whether a resume arrived.
 * A file field appears in `files`, never in `fields`, so the two can never be confused.
 *
 * NO EXTERNAL DEPENDENCIES — node:http only.
 */

import http from 'node:http';
import { parse as parseQuery } from 'node:querystring';
// ⭐ T18 / T23: a standard Greenhouse application (job-boards.greenhouse.io's shape) — GET /greenhouse-standard[?nameless=1]
import { greenhouseStandardForm } from './fakeAtsGreenhouseStandard.js';
import { leverLiveForm, workableLiveForm } from './fakeAtsLiveShapes.js';   // T10 rows 5 and 7: the MEASURED structures

const PORT = Number(process.env.PORT || 4599);

/** In-memory submission log. Reset between test cases via POST /_reset. */
const submissions = [];

// ── Trap registry ────────────────────────────────────────────────────────────
// Each trap names the audit finding it reproduces. Tests should assert the
// EXPECTED value, not just that a value was supplied.
const TRAPS = {
  sponsorship_inversion: {
    finding: 'buildAnswers step 3 fuzzy match: a `work_authorization` key substring-matches a ' +
             'SPONSORSHIP question, producing a semantically inverted, legally material answer.',
    field:   'requires_sponsorship',
    expect:  'a sponsorship yes/no — NOT a work-authorization status string',
  },
  name_ambiguity: {
    finding: 'A short field_map key like `name` substring-matches several labels; first match ' +
             'wins and Object.entries order is arbitrary.',
    fields:  ['legal_name', 'preferred_name', 'referrer_name'],
    expect:  'each name field gets ITS OWN value; referrer_name must not receive the candidate name',
  },
  // A `finding` is written in the PAST TENSE once it is fixed, and says what the behaviour is now.
  // This registry is served as JSON on the index page, so it is where a reader forms their
  // expectation before writing an assertion — and a fixed defect described in the present tense is
  // how a7's case 3 came to assert the broken behaviour as though it were the guarantee. The trap
  // stays: it is still the regression target. Only the tense and the "now" line are new.
  lowercase_yes: {
    finding: "WAS: buildAnswers checked value === 'Yes' (capital Y only), so 'yes' coerced to " +
             "'false' — silently answering No.",
    now:     'FIXED. coerceAffirmative() accepts an enumerated affirmative list and is fail-safe in ' +
             'the other direction: anything unrecognised stays false, because an affirmative is ' +
             'what attests something to an employer. booleanPolarity() resolves the DIRECTION ' +
             'first, so an inverted question cannot be answered backwards.',
    field:   'authorized_to_work',
    expect:  "'yes' must be submitted as an affirmative, not 'false'",
  },
  submit_label: {
    finding: 'WAS: SUBMIT_RE was anchored at ^, so a button labelled "Review and Submit" never ' +
             'matched and the run silently ended as filled_not_submitted.',
    now:     'FIXED. classifySubmitLabel() scores labels instead of first-matching: ' +
             'STRONG_SUBMIT_RE is /\\b(?:submit|send)\\b/, so a qualifier may precede the verb and ' +
             '"Review and Submit" scores 2, while NOT_SUBMIT_RE still excludes "Save and Continue" ' +
             'and "Submit Draft". The /lever form MUST therefore reach a real submission. Asserting ' +
             'filled_not_submitted here is asserting the old bug — a7 case 3 did exactly that.',
    expect:  'the run either submits or reports filled_not_submitted — never a false "submitted", ' +
             'which is what the recorded submission count decides',
  },
  required_unmapped: {
    finding: 'buildAnswers skips unresolvable fields; the completeness gate must then HOLD ' +
             'rather than submit an incomplete form.',
    field:   'hear_about_us',
    expect:  "status === 'held_review' with this label in missingRequired",
  },
  // ── /ashby-spa, transcribed from the live posting (AE1/AE2 follow-up) ──────
  nameless_required: {
    finding: 'A required control with NO name and NO associated <label> takes its label from ' +
             '`placeholder` via getLabel()\'s last resort. Nothing can resolve "Pick date..." — the ' +
             'form has not said what it wants. Every fixture before this one labelled everything, ' +
             'so the case that actually stops a live Ashby run had no local target.',
    field:   '(nameless, placeholder "Pick date...")',
    expect:  "held_review/incomplete_form with 'Pick date...' in missingRequired — never a submit",
  },
  uuid_field_names: {
    finding: 'Three controls are named with a bare GUID, so the ONLY signal is the label. This is ' +
             'why a canonical-profile gate packet (keyed on `email`, `first_name`) fills nothing ' +
             'here, which is what AE2 observed as "Open & fill filled an empty form".',
    fields:  ['09a328e0-…', '20f8883c-…', 'f189fed2-…'],
    expect:  'resolved by LABEL, and the packet source reported as discovered_form not canonical_profile',
  },
  autofill_slot_theft: {
    finding: 'The live page puts an unlabelled file input behind the copy "Upload your resume here ' +
             'to autofill key application fields". uploadIntoContext classifies file inputs on ' +
             'label+name+id, so if that copy ever reaches the input as an aria-label the resume ' +
             'lands in the WRONG slot and the required one stays empty — a hold that reads as ' +
             '"no resume" when the resume was uploaded.',
    field:   '_systemfield_resume',
    expect:  "?autofilltrap=1 -> held_review with 'Resume' in missingRequired, resume NOT recorded",
  },
  dead_submit: {
    finding: 'A1 finding N1: `submitted` was once set by the CLICK ALONE. A submit-shaped button ' +
             'that changes nothing must report clicked_no_evidence — the false positive is ' +
             'self-concealing, because the duplicate guard then never retries the job.',
    expect:  "?deadsubmit=1 -> filled_not_submitted/submit_unverified, and /_submissions stays EMPTY",
  },
};

// ── HTML helpers ─────────────────────────────────────────────────────────────
const page = (title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5}
 label{display:block;margin:14px 0 4px;font-weight:600;font-size:14px}
 input,select,textarea{width:100%;padding:8px;font-size:14px;box-sizing:border-box}
 .req::after{content:" *";color:#c00}
 button{margin-top:20px;padding:10px 18px;font-size:15px;cursor:pointer}
 fieldset{border:1px solid #ddd;margin:20px 0;padding:12px 16px}
</style></head><body>${body}</body></html>`;

// Labels MUST be associated with their control via for/id.
//
// The first version emitted `<label>Text</label><input>` — adjacent, no `for`, input not nested.
// discoverFields' getLabel() looks for label[for=id], then el.closest('label'), then
// aria-label/placeholder; none of those match that markup, so every field came back with
// label:"" and the harness silently exercised only attribute-based resolution. buildAnswers
// steps 3 (fuzzy label) and 4 (custom_answers) were unreachable, which is most of what the
// traps exist to test. Real Greenhouse/Lever/Ashby markup associates labels, so this is the
// fixture matching reality, not a concession to the code.
//
// for/id is used rather than wrapping the input in the label because getLabel() returns
// closest.textContent — a wrapping label around a <select> would fold every option's text into
// the label ("...require sponsorship?Select...YesNo") and corrupt the very matching under test.
// The id is derived from `name` so no call site has to pass one.
const field = (label, input, required = false) => {
  const existingId = input.match(/\bid="([^"]+)"/)?.[1];
  const name = input.match(/\bname="([^"]+)"/)?.[1];
  let id = existingId;
  if (!id && name) {
    id = 'f_' + name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
    input = input.replace(/<(input|select|textarea)\b/, `<$1 id="${id}"`);
  }
  return `<label class="${required ? 'req' : ''}"${id ? ` for="${id}"` : ''}>${label}</label>${input}`;
};

// ── Greenhouse-flavoured 2-step form ─────────────────────────────────────────
// Realistic Greenhouse naming: job_application[<field>]
function greenhouseStep1() {
  return page('Senior Engineer — Application', `
  <h1>Senior Engineer</h1><p>Step 1 of 2 — About you</p>
  <form method="POST" action="/greenhouse/step2" enctype="multipart/form-data">
    ${field('First Name', `<input id="first_name" name="job_application[first_name]" required>`, true)}
    ${field('Last Name',  `<input id="last_name"  name="job_application[last_name]"  required>`, true)}
    ${field('Email',      `<input id="email" type="email" name="job_application[email]" required>`, true)}
    ${field('Phone',      `<input id="phone" type="tel" name="job_application[phone]">`)}

    <fieldset><legend>TRAP: name_ambiguity</legend>
      ${field('Legal Name',        `<input name="job_application[legal_name]" required>`, true)}
      ${field('Preferred Name',    `<input name="job_application[preferred_name]">`)}
      ${field('Name of Referrer',  `<input name="job_application[referrer_name]">`)}
    </fieldset>

    ${field('Resume', `<input type="file" name="job_application[resume]" accept=".pdf,.doc,.docx" required>`, true)}
    ${field('Cover Letter', `<input type="file" name="job_application[cover_letter]" accept=".pdf,.doc,.docx">`)}
    <button type="submit">Next</button>
  </form>`);
}

// Greenhouse uploads the resume at step 1, which POSTs to /greenhouse/step2 and is not itself a
// recorded submission — so without carrying it, the one form that exercises a two-step upload would
// leave no evidence the resume ever arrived. Step-1 uploads travel forward as a hidden `_step1_files`
// summary, so the final /_submit/greenhouse record is self-contained. (This step has no file input
// of its own, so it stays urlencoded — real ATS flows mix the two, and it keeps that path covered.)
function greenhouseStep2(carry, files = {}) {
  const hidden = Object.entries(carry)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(String(v))}">`).join('');
  const uploads = `<input type="hidden" name="_step1_files" value="${escapeHtml(JSON.stringify(files))}">`;
  return page('Senior Engineer — Step 2', `
  <h1>Senior Engineer</h1><p>Step 2 of 2 — Eligibility</p>
  <form method="POST" action="/_submit/greenhouse">
    ${hidden}${uploads}
    <fieldset><legend>TRAP: sponsorship_inversion</legend>
      ${field('Do you now or in the future require sponsorship for work authorization?',
        `<select name="job_application[requires_sponsorship]" aria-required="true">
           <option value="">Select...</option>
           <option value="Yes">Yes</option>
           <option value="No">No</option>
         </select>`, true)}
      ${field('Are you legally authorized to work in the country of employment?',
        `<select name="job_application[legally_authorized]" aria-required="true">
           <option value="">Select...</option>
           <option value="Yes">Yes</option>
           <option value="No">No</option>
         </select>`, true)}
    </fieldset>

    ${field('Years of professional experience',
      `<input type="number" name="job_application[years_experience]" min="0" required>`, true)}
    ${field('Earliest start date',
      `<input type="date" name="job_application[start_date]">`)}
    ${field('LinkedIn Profile', `<input type="url" name="job_application[linkedin]">`)}

    <fieldset><legend>TRAP: required_unmapped</legend>
      ${field('How did you hear about us? (free text, no standard mapping)',
        `<textarea name="job_application[hear_about_us]" required rows="3"></textarea>`, true)}
    </fieldset>

    <button type="submit">Submit Application</button>
  </form>`);
}

// ── Lever-flavoured single-step form ─────────────────────────────────────────
function leverForm() {
  return page('Backend Engineer — Apply', `
  <h1>Backend Engineer</h1>
  <form method="POST" action="/_submit/lever" enctype="multipart/form-data">
    ${field('Full name', `<input name="name" required>`, true)}
    ${field('Email',     `<input name="email" type="email" required>`, true)}
    ${field('Current company', `<input name="org">`)}
    ${field('Resume', `<input type="file" name="resume" required>`, true)}

    <fieldset><legend>TRAP: lowercase_yes</legend>
      ${field('Are you authorized to work without sponsorship?',
        `<select name="cards[authorized_to_work]" aria-required="true">
           <option value="">Select...</option>
           <option value="yes">yes</option>
           <option value="no">no</option>
         </select>`, true)}
    </fieldset>

    ${field('Location', `<input name="location" placeholder="City, State">`)}
    <fieldset><legend>TRAP: submit_label</legend>
      <p style="font-size:13px;color:#666">Button reads "Review and Submit" — the qualifier sits
      BEFORE the verb, which the old ^-anchored SUBMIT_RE could never match. Now handled by
      classifySubmitLabel; this form must reach an actual submission, not filled_not_submitted.</p>
    </fieldset>
    <button type="submit">Review and Submit</button>
  </form>`);
}

// ── ⭐ A211 (1a) · a plain two-field form: everything on it is answerable from a saved profile, so the runner's
// background fill can reach Ready on its own (the walk's ready → Send all → sent path).
function plainForm() {
  return page('Support Engineer — Apply', `
  <h1>Support Engineer</h1>
  <form method="POST" action="/_submit/plain">
    ${field('Full name', `<input name="name" required>`, true)}
    ${field('Email',     `<input name="email" type="email" required>`, true)}
    <button type="submit">Submit application</button>
  </form>`);
}

// ── Ashby-flavoured single-step form ─────────────────────────────────────────
function ashbyForm() {
  return page('Platform Engineer — Application', `
  <h1>Platform Engineer</h1>
  <form method="POST" action="/_submit/ashby" enctype="multipart/form-data">
    ${field('Name',  `<input name="_systemfield_name" required>`, true)}
    ${field('Email', `<input name="_systemfield_email" type="email" required>`, true)}
    ${field('Resume', `<input type="file" name="_systemfield_resume" required>`, true)}
    ${field('Location (start typing)',
      `<input name="_systemfield_location" role="combobox" aria-autocomplete="list" aria-required="true" required>`, true)}
    ${field('Available from (MM/DD/YYYY)',
      `<input name="start_date" placeholder="MM/DD/YYYY" required>`, true)}
    ${field('Website', `<input name="_systemfield_website" type="url">`)}

    <fieldset><legend>TRAP: lowercase_yes</legend>
      <p style="font-size:13px;color:#666">A1 found the harness had no checkbox or toggle anywhere,
      so buildAnswers' <code>value === 'Yes'</code> coercion (which only runs for
      checkbox/toggle) was never exercised. This is that field. A stored <code>'yes'</code> must
      arrive checked; anything unrecognised must stay unchecked.</p>
      ${field('I am authorized to work without sponsorship',
        `<input type="checkbox" name="authorized_no_sponsorship" required>`, true)}
    </fieldset>

    <button type="submit">Submit</button>
  </form>`);
}

// ── /ashby-spa: THE REAL FORM'S SHAPE, MEASURED ──────────────────────────────
//
// WHY THIS EXISTS AND /ashby DOES NOT SUFFICE
// `/ashby` above is static HTML with native controls. That is what AE1/AE2 turned out to have been
// verified against, while the live posting is a React SPA whose controls do not resemble it — and the
// docs said so explicitly ("everything was verified against a replica with native <select>s").
//
// So this is not invented. Every field below is transcribed from `scripts/ae1Diagnose.mjs`'s reading
// of `jobs.ashbyhq.com/openai/0432731c-…/application`, which reported 15 fields across 3 frames and
// 32 raw controls. The four things the old fixture could not reproduce, and which are the whole
// reason a live run behaved differently:
//
//   1. NAMELESS REQUIRED CONTROLS. The date picker and the typeahead carry NO `name` and NO
//      associated <label> — their label comes from `placeholder` via getLabel()'s last resort, which
//      is why they read as "Pick date..." and "Start typing...". A required field whose only
//      identity is the word "Pick date..." cannot be resolved by any map, and that is not a bug in
//      the resolver: it is the form declining to say what it wants. The completeness gate holding on
//      it is the correct outcome, and this fixture is where that can be asserted.
//   2. UUID FIELD NAMES. Three fields are named with a bare GUID, so the ONLY signal is the label.
//      This is what made AE2's canonical-profile packet fill nothing: it is keyed on `email` and
//      `first_name`, which match no control here.
//   3. CHECKBOXES WHOSE `name` IS THE ENTIRE LABEL TEXT. Measured, not stylised — the arbitration
//      checkbox really is named with its own 180-character question.
//   4. RADIO GROUPS LABELLED BY THEIR FIRST OPTION. discoverFields dedupes a group to one field and
//      takes getLabel() of the first radio, so the four EEOC groups present as "Male",
//      "Hispanic or Latino", and so on — which is what a resolver actually has to cope with.
//
// It renders client-side in two chunks like `/spa`, because that is the other half of the reality:
// the readiness condition has to be exercised, not bypassed.
//
// SUBMISSION IS RECORDED THE WAY THE REAL ONE HAPPENS. Real Ashby does not do a native form POST; it
// collects state in JS and sends it. So does this — an intercepted submit builds a real multipart
// FormData (so `files` records the resume for real, through the existing parser), POSTs it to
// /_submit/ashby-spa, and then NAVIGATES to a confirmation page. That last step matters: it is what
// gives the post-click evidence check something honest to find (`url_changed` plus the confirmation
// text `classifyFlowState` matches on) instead of a status nobody verified.
//
// Query params, each one a case worth being able to reach:
//   ?delay=ms      hydration delay (default 2500; 0 renders synchronously)
//   ?answerable=1  gives the date field a real <label> and a name, so a run CAN complete it and the
//                  submit click is reachable. The difference between this and the default IS the
//                  finding: the form is unsubmittable because of how it labels one control.
//   ?autofilltrap=1  gives the unnamed "autofill from resume" file input the real page's own copy
//                  ("Upload your resume here to autofill…") as an aria-label. uploadIntoContext
//                  classifies file inputs on label+name+id, so the resume then lands in the WRONG
//                  slot and `_systemfield_resume` stays empty — a hold that looks like a missing
//                  resume when the resume was in fact uploaded, to the wrong input.
//   ?deadsubmit=1  the submit button posts nothing and navigates nowhere. This is A1 finding N1's
//                  case: a submit-shaped button that changes nothing must report
//                  `clicked_no_evidence`, never `submitted`.
//   ?fuzzylabel=1  adds ONE required free-text question whose label only TOKEN-matches a profile key
//                  ("Which team interests you most" against `team`). The resolver can produce a
//                  value for it, at label_fuzzy / 0.3 — a guess. Every required field then has a
//                  value, so the completeness gate passes and the LOW-CONFIDENCE gate is the only
//                  thing left standing between a guess and a real employer. That gate had no live
//                  coverage: this is what reaches it (AF3 requirement 4).
const EEOC_PREFIX = '41056061-f039-4b0f-8310-713131d11bda';
// AI2: `presentation` replaces the real employer's brand and the harness caption, and nothing else.
//
// The shape here was transcribed from a LIVE Ashby posting, so the fixture inherited that
// employer's company name and role title. That is fine for a harness and wrong for a Chrome Web
// Store listing twice over: it puts another company's brand in our marketing material, and the
// caption underneath ("Shape transcribed from a live Ashby posting … Rendered by JavaScript 0ms
// after load") tells a reviewer they are looking at a test rig. Every field, name, id, label and
// EEOC option is untouched — only the two lines a human reads at the top.
function ashbySpaForm({ delayMs, answerable = false, autofillTrap = false, deadSubmit = false, fuzzyLabel = false, presentation = false } = {}) {
  const d = Number.isFinite(delayMs) ? delayMs : 2500;
  // Kept as data so the radio groups below are one loop rather than four hand-written blocks, and so
  // the option labels stay exactly as measured.
  const eeoc = [
    ['gender',            ['Male', 'Female', 'Decline to self identify']],
    ['race',              ['Hispanic or Latino', 'White', 'Black or African American', 'Asian', 'Decline to self identify']],
    ['veteran_status',    ['I identify as one or more of the classifications of protected veteran listed above',
                           'I am not a protected veteran', 'I decline to self identify']],
    ['disability_status', ['Yes, I have a disability, or have had one in the past',
                           'No, I do not have a disability', 'I do not want to answer']],
  ];
  const radioHtml = eeoc.map(([key, opts]) => {
    const name = `${EEOC_PREFIX}__systemfield_eeoc_${key}`;
    return opts.map((opt, i) => {
      const id = `f_eeoc_${key}_${i}`;
      return `<label for="${id}" style="font-weight:400">` +
             `<input type="radio" id="${id}" name="${name}" value="${escapeHtml(opt)}" ` +
             `style="width:auto;margin-right:6px"> ${escapeHtml(opt)}</label>`;
    }).join('');
  }).join('<hr style="border:0;border-top:1px solid #eee;margin:14px 0">');

  // Measured: the `name` attribute IS the question, verbatim, for both of these. Built here in Node
  // rather than assembled in the page, so the attribute quoting is done once and visibly.
  const ARBITRATION = 'I acknowledge that I have opened, read, and understood the Arbitration ' +
    'Agreement. I understand that by submitting my application, I am agreeing to be bound by the ' +
    'terms of the Arbitration Agreement.';
  const CONFIRM = 'I confirm I have read the above.';
  const checkbox = (id, text) =>
    `<label for="${id}" style="font-weight:400">` +
    `<input type="checkbox" id="${id}" name="${escapeHtml(text)}" ` +
    `style="width:auto;margin-right:6px"> ${escapeHtml(text)}</label>`;
  const checkboxHtml =
    '<fieldset><legend>Arbitration Agreement</legend>' +
    checkbox('f_arb', ARBITRATION) + checkbox('f_conf', CONFIRM) +
    '</fieldset>';

  // The date field, in its two forms. The default is the measured one: no name, no label, required.
  const dateField = answerable
    ? `<label class="req" for="f_start">Earliest start date</label>` +
      `<input id="f_start" name="start_date" placeholder="Pick date..." required>`
    : `<input placeholder="Pick date..." required style="margin-top:14px">`;

  // Deliberately NOT resolvable by any handler or exact key: a free-text question whose only
  // relation to the profile is that the word "team" appears in both. That is the definition of a
  // fuzzy match, and the definition of something that must not be submitted unread.
  const fuzzyField = fuzzyLabel
    ? `<label class="req" for="f_team">Which team interests you most</label>` +
      `<input id="f_team" name="team_pref" required>`
    : '';

  const autofillAria = autofillTrap
    ? ` aria-label="Upload your resume here to autofill key application fields"`
    : '';

  return page(
    presentation ? 'Senior Backend Engineer — Northwind Systems'
                 : 'Software Engineer, Agent Productivity — OpenAI', `
  <h1>${presentation ? 'Senior Backend Engineer' : 'Software Engineer, Agent Productivity'}</h1>
  <p style="font-size:13px;color:#666">${presentation
    ? 'Northwind Systems &middot; Remote &mdash; United States &middot; Full-time'
    : `Shape transcribed from a live Ashby posting
  (scripts/ae1Diagnose.mjs). Rendered by JavaScript ${d}ms after load, in two chunks.`}</p>
  <div id="app"><p id="boot">Loading application form…</p></div>
  <script>
  (function(){
    var DELAY = ${d};
    var DEAD  = ${deadSubmit ? 'true' : 'false'};

    // CHUNK 1 — the identity block. Note _systemfield_* beside bare GUIDs: that mix is the real
    // form's, and it is why label-based resolution is not optional here.
    var chunk1 =
      // enctype declared even though the submit is intercepted and posts a hand-built FormData: if
      // the interception is ever removed, a native POST of a file input WITHOUT it sends a filename
      // and no bytes, and the resume path silently stops being exercised. Pinned by
      // formReadiness.test.js for every form in this harness.
      '<form id="ashbyform" enctype="multipart/form-data">' +
      '<fieldset><legend>Autofill from resume</legend>' +
        '<p style="font-size:13px;color:#666">Upload your resume here to autofill key application fields.</p>' +
        '<input type="file"${autofillAria}>' +
      '</fieldset>' +
      '<label class="req" for="f_legal">Legal Name</label>' +
      '<input id="f_legal" name="_systemfield_name" required>' +
      '<label for="f_pref">Preferred Name (if applicable)</label>' +
      '<input id="f_pref" name="09a328e0-8d57-4f88-86ab-688de1657b17">' +
      '<label class="req" for="f_email">Email</label>' +
      '<input id="f_email" name="_systemfield_email" required>' +
      '<label class="req" for="f_resume">Resume</label>' +
      '<input id="f_resume" type="file" name="_systemfield_resume" required>' +
      '<label class="req" for="f_phone">Phone Number</label>' +
      '<input id="f_phone" name="20f8883c-d278-427c-9465-dc614f612e1f" required>' +
      '<div id="chunk2"></div>' +
      '<button id="f_submit" type="' + (DEAD ? 'button' : 'submit') + '">Submit Application</button>' +
      '</form>';

    // CHUNK 2 — everything with no name, no label, or a label that is really an option. The half of
    // the form that a resolver cannot map, arriving late enough that a readiness check which fires
    // on "any field" would miss all of it.
    var chunk2 =
      '<div role="combobox" aria-autocomplete="list" style="display:none"></div>' +
      '<input placeholder="Start typing..." role="combobox" aria-autocomplete="list">' +
      ${JSON.stringify(dateField)} +
      ${JSON.stringify(fuzzyField)} +
      '<label for="f_addl">Additional Information</label>' +
      '<textarea id="f_addl" name="f189fed2-624b-41a1-a76f-0c67a2611d1a" rows="3"></textarea>' +
      ${JSON.stringify(checkboxHtml)} +
      '<fieldset><legend>Voluntary self-identification</legend>' +
        ${JSON.stringify(radioHtml)} +
      '</fieldset>';

    setTimeout(function(){
      var b = document.getElementById('boot'); if (b) b.remove();
      document.getElementById('app').innerHTML = chunk1;
      setTimeout(function(){
        document.getElementById('chunk2').innerHTML = chunk2;
        wire();
      }, 400);
    }, DELAY);

    // The submit path. Real Ashby collects state and sends it, so this does too — and it includes
    // the NAMELESS controls, keyed by the label a human reads, because otherwise the one thing this
    // fixture exists to reproduce would be invisible in the recorded submission.
    function wire() {
      var form = document.getElementById('ashbyform');
      var btn  = document.getElementById('f_submit');
      if (!form || !btn) return;
      var handler = function(ev){
        if (ev) ev.preventDefault();
        if (DEAD) return;                       // clicked, nothing happens, nothing changes
        var fd = new FormData();
        var seen = 0;
        Array.prototype.forEach.call(
          form.querySelectorAll('input,textarea,select,[role=combobox]'), function(el){
          if (el.type === 'submit' || el.type === 'button') return;
          var key = el.getAttribute('name');
          if (!key) {
            // Nameless control: record it under the label a human sees, which for these IS the
            // placeholder. Prefixed so an assertion cannot confuse it with a real field name.
            var lbl = el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
            if (!lbl) return;
            key = 'unnamed:' + lbl;
          }
          if (el.type === 'file') {
            if (el.files && el.files[0]) { fd.append(key, el.files[0], el.files[0].name); seen++; }
            return;
          }
          if (el.type === 'checkbox') { if (el.checked) { fd.append(key, 'true'); seen++; } return; }
          if (el.type === 'radio')    { if (el.checked) { fd.append(key, el.value); seen++; } return; }
          if (el.value) { fd.append(key, el.value); seen++; }
        });
        fd.append('_controlsRecorded', String(seen));
        fetch('/_submit/ashby-spa', { method: 'POST', body: fd })
          .then(function(){ location.assign('/ashby-spa/thanks'); })
          .catch(function(){ location.assign('/ashby-spa/thanks'); });
      };
      form.addEventListener('submit', handler);
      if (DEAD) btn.addEventListener('click', handler);
    }
  })();
  </script>`);
}

// T31 · the store screenshot's POSTING — a job description page, not an application form. The
// toolbar press asks "Add this job to draft?" only on a page the capture's own matcher reads as a
// posting (routes/extensionJob.js), and /ashby-spa is an application form with no description:
// the press there rightly asks nothing. A SYNTHETIC employer only (the screenshot harness refuses a
// real one), published the way most boards publish one — a JSON-LD JobPosting — so the extractor
// names the company the way it does on a live board, not from the fixture's host.
function postingPage() {
  const ld = {
    '@context': 'https://schema.org', '@type': 'JobPosting',
    title: 'Senior Backend Engineer',
    hiringOrganization: { '@type': 'Organization', name: 'Northwind Systems' },
    jobLocationType: 'TELECOMMUTE', applicantLocationRequirements: { '@type': 'Country', name: 'United States' },
    employmentType: 'FULL_TIME', datePosted: '2026-10-20',
    // the full description, as boards publish it — the extractor files a page as a posting only when
    // it carries one (extractor.js: a title alone is not a job)
    description: '<p>Northwind Systems moves freight for ten thousand small businesses. You will build and run the ' +
      'services behind our logistics platform: the APIs our customers integrate with, the pipelines that price a ' +
      'shipment, and the tooling the rest of engineering depends on.</p><ul><li>5+ years building production backend ' +
      'systems.</li><li>Relational databases, queues and cloud infrastructure.</li></ul>',
  };
  return page('Senior Backend Engineer — Northwind Systems', `
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <h1>Senior Backend Engineer</h1>
  <p style="font-size:13px;color:#666">Northwind Systems &middot; Remote &mdash; United States &middot; Full-time</p>
  <h2>About the role</h2>
  <p>Northwind Systems moves freight for ten thousand small businesses. You will build and run the
  services behind our logistics platform: the APIs our customers integrate with, the pipelines that
  price a shipment, and the tooling the rest of engineering depends on.</p>
  <h2>What you will do</h2>
  <ul>
    <li>Design, build and operate backend services in a modern, typed language.</li>
    <li>Own a service end to end — its data model, its on-call and its roadmap.</li>
    <li>Work with product and design on the features customers ask for most.</li>
  </ul>
  <h2>What we look for</h2>
  <ul>
    <li>5+ years building production backend systems.</li>
    <li>Experience with relational databases, queues and cloud infrastructure.</li>
    <li>Clear writing, and care for the people who use what you build.</li>
  </ul>
  <p><a href="/ashby-spa?delay=0&amp;presentation=1">Apply for this job</a></p>`);
}

// The confirmation the submit navigates to. Separate page, real navigation — so `url_changed` and
// the confirmation text are both genuinely earned rather than asserted by the fixture.
function ashbySpaThanks() {
  return page('Application received — OpenAI', `
  <h1>Thank you for your application</h1>
  <p>Your application has been submitted successfully. We'll be in touch.</p>
  <p style="font-size:12px;color:#666">Reached by a real navigation from /ashby-spa, so a run that
  claims <code>submitted</code> here has both <code>url_changed</code> and a confirmation page —
  the two independent signals A1 finding N1 requires. Assert against
  <a href="/_submissions">/_submissions</a>, never on the status.</p>`);
}

// ── JS-RENDERED (SPA) form ───────────────────────────────────────────────────
// The characteristic every live target shares and this harness could not reproduce: Ashby,
// Greenhouse and Lever all build their form client-side, AFTER the document is parsed. Because
// every form above was static HTML, a discovery pass that walks the DOM too early found all the
// fields here and none of them in production — a real Ashby run discovered nothing, filled
// nothing, and reported "Autofilled 0 fields" as a clean autofill_done in 9 seconds.
//
// The delay is deliberately longer than the fixed 1500ms sleep autoApply used to use, so a run
// that does not WAIT on a readiness condition reliably sees an empty DOM. ?delay= overrides it,
// and ?delay=0 renders synchronously for a control case.
//
// Fields are injected in TWO chunks so the control count climbs rather than jumping straight to
// its final value: a readiness check that merely waits for "any field" would fire on the first
// chunk and still miss half the form. Only waiting for the count to STOP CHANGING is correct.
//
// ?variant=2 serves a CHANGED form — one question added, one removed, one made required. Forms
// change, and a schema captured once and trusted forever is worse than no schema (TASK G4
// requirement 3), so the store has to be able to observe the change rather than assume stability.
function spaForm(delayMs, variant = 1) {
  const d = Number.isFinite(delayMs) ? delayMs : 2500;
  return page('SPA ATS — Apply', `
  <h1>Senior Data Engineer</h1>
  <p>Form is rendered by JavaScript ${d}ms after load, in two chunks — as every real ATS does.</p>
  <div id="app"><p id="boot">Loading application form…</p></div>
  <script>
  (function(){
    var DELAY = ${d};
    var chunk1 =
      '<form id="spaform" method="POST" action="/_submit/spa" enctype="multipart/form-data">' +
      '<label class="req" for="f_name">Full name</label><input id="f_name" name="name" required>' +
      '<label class="req" for="f_email">Email</label><input id="f_email" name="email" type="email" required>' +
      '<label for="f_phone">Phone</label><input id="f_phone" name="phone">' +
      '<div id="chunk2"></div>' +
      '<button type="submit">Submit application</button></form>';
    var chunk2 = ${variant === 2 ? `
      '<label class="req" for="f_resume">Resume</label>' +
      '<input id="f_resume" type="file" name="resume" required>' +
      '<label for="f_linkedin">LinkedIn</label><input id="f_linkedin" name="linkedin">' +
      '<label for="f_addr">Address</label><input id="f_addr" name="address1">' +
      '<label class="req" for="f_portfolio">Portfolio URL</label>' +
      '<input id="f_portfolio" name="portfolio" required>' +
      '<label class="req" for="f_auth">I am authorized to work without sponsorship</label>' +
      '<input id="f_auth" type="checkbox" name="authorized_no_sponsorship" required>'` : `
      '<label class="req" for="f_resume">Resume</label>' +
      '<input id="f_resume" type="file" name="resume" required>' +
      '<label for="f_linkedin">LinkedIn</label><input id="f_linkedin" name="linkedin">' +
      '<label for="f_github">GitHub</label><input id="f_github" name="github">' +
      '<label for="f_addr">Address</label><input id="f_addr" name="address1">' +
      '<label class="req" for="f_auth">I am authorized to work without sponsorship</label>' +
      '<input id="f_auth" type="checkbox" name="authorized_no_sponsorship" required>'`};
    setTimeout(function(){
      var b = document.getElementById('boot'); if (b) b.remove();
      document.getElementById('app').innerHTML = chunk1;
      // Second chunk lands a further 400ms later, so the count is briefly non-zero but not final.
      setTimeout(function(){ document.getElementById('chunk2').innerHTML = chunk2; }, 400);
    }, DELAY);
  })();
  </script>`);
}

// ── G1: a portal that demands an account before it will show the form ────────
// The gated case, which nothing here could reproduce: Meta, Amazon, Google and per-tenant Workday
// all want a session before an application exists. classifyFlowState already detects it
// (login_required / captcha_required) but there was no local target to detect it ON, so the gate
// branch of autoApply had never been exercised end to end.
//
// /gated 302s to /gated/signin, which carries a password field and a /signin URL — the two signals
// classifyFlowState reads. There is deliberately NO application form on the sign-in page: that is the
// whole point of the case, and it is what makes the packet fall back to the canonical profile
// resolution rather than to discovered fields.
//
// NOTHING HERE CAN BE AUTOMATED PAST. There is no valid credential, by design — the hard boundary is
// that a human crosses every gate. The form posts nowhere and the harness must never try.
function gatedSignin() {
  return page('Sign in to continue — Careers', `
  <h1>Sign in to apply</h1>
  <p>You need an account with us before you can apply to this role.</p>
  <form method="POST" action="/gated/signin">
    ${field('Email', `<input name="login_email" type="email" required>`, true)}
    ${field('Password', `<input name="login_password" type="password" required>`, true)}
    <button type="submit">Sign in</button>
  </form>
  <p style="font-size:12px;color:#666">There is no valid credential here on purpose. This route exists
  so the gate can be OBSERVED, not crossed — see the hard boundary in
  docs/GATED_HANDOFF_PROMPTS.md. A run reaching this page must end held_gate with a packet.</p>`);
}

// A sign-in form and an application form on ONE page — the case where classifying the page is not
// enough and only a per-CONTROL rule protects the candidate.
//
// The two forms both have a control named `email`, which is the whole difficulty: name and label are
// identical, and the only thing distinguishing them is which form they belong to. The login side also
// uses the shapes the legacy in-page sweep matches on (a bare `name="email"`, a placeholder, an
// autocomplete token), so a run that fills this page wrongly does so through that sweep rather than
// through the resolver.
function gatedMixed() {
  return page('G-CRED Senior Engineer — Apply or sign in', `
  <h1>Senior Engineer</h1>
  <p>Returning candidate? Sign in. Otherwise apply below.</p>

  <form id="loginform" method="POST" action="/gated/signin">
    <fieldset><legend>Sign in — NOTHING here may ever be filled</legend>
      ${field('Email', `<input name="email" id="login_email" type="email" placeholder="Email" autocomplete="username" required>`, true)}
      ${field('Password', `<input name="password" id="login_password" type="password" autocomplete="current-password" required>`, true)}
      <button type="submit">Sign in</button>
    </fieldset>
  </form>

  <form id="applyform" method="POST" action="/_submit/mixed" enctype="multipart/form-data">
    <fieldset><legend>Apply — this is the application</legend>
      ${field('First Name', `<input name="first_name" required>`, true)}
      ${field('Last Name',  `<input name="last_name" required>`, true)}
      ${field('Email Address', `<input name="applicant_email" type="email" placeholder="Email" required>`, true)}
      ${field('Phone', `<input name="phone" type="tel">`)}
      <button type="submit">Submit Application</button>
    </fieldset>
  </form>`);
}

function gatedCaptcha() {
  return page('Verify you are human — Careers', `
  <h1>Verify you are human</h1>
  <p>Complete the challenge to continue to the application.</p>
  <div class="g-recaptcha" data-sitekey="fake-site-key-not-real">
    <iframe title="reCAPTCHA" src="about:blank" style="width:300px;height:74px;border:1px solid #ccc"></iframe>
  </div>
  <p style="font-size:12px;color:#666">A fixture, not a real challenge, and not solvable — solving one
  is permanently out of scope. It exists so captcha_required can be observed.</p>`);
}

// ── G1/G3: the application form BEHIND the gate ──────────────────────────────
// What the candidate reaches after signing in themselves — the page the extension hands off onto.
// Nothing here is reachable by the server; it exists so G2's fill and G3's review overlay have a
// realistic target, and it carries the traps that make the review worth reading:
//
//   job_application[requires_sponsorship]  Greenhouse's real naming. An eligibility answer must
//                                          still be matched here, by unwrapping the namespace —
//                                          exact-name-only would never fill it on any real ATS.
//   work_authorization                     bare canonical name, the easy case
//   org / "Current Company"                no name match; only a LABEL match can fill it, which is
//                                          what makes it a guess the overlay must ask about
//   authorized_no_sponsorship              the INVERSION trap: same words, opposite sense. Nothing
//                                          may fill this from a `requires_sponsorship` answer.
//
// AI2: `presentation` strips the DIDACTIC CAPTIONS, and NOTHING ELSE.
//
// The Chrome Web Store listing screenshots are taken over this form. A store reviewer reading
// "TRAP: sponsorship_inversion" above a checkbox sees a page that looks like a test rig, which is a
// rejection risk and reads as unserious. But the traps are the reason the review overlay is worth
// looking at, and store policy requires a screenshot to depict ACTUAL functionality — so the traps
// themselves stay, byte for byte.
//
// What changes is only what a human reads: the legends become the section names a real ATS uses,
// the explanatory paragraph goes, and the page title loses its harness prefix. Every `name`, `id`,
// label, option and `required` is IDENTICAL in both variants, so the extension discovers the same
// fields, fills the same ones, and still refuses the inversion trap. The screenshot shows the real
// behaviour on a page that does not announce the test.
//
// The presentation location is deliberately NOT a city. The screenshot harness refuses to write an
// image containing any value from the developer's own user_profile, and `location` is one of those
// columns — so a fixture naming a real city fails the run on a coincidence and teaches nothing.
function gatedForm({ presentation = false } = {}) {
  const legend = (teaching, neutral) => presentation ? neutral : teaching;
  return page(
    presentation ? 'Senior Engineer — Application — Northwind Systems'
                 : 'G3-TRAPS Senior Engineer — Application', `
  <h1>Senior Engineer</h1>
  <p>${presentation ? 'Northwind Systems · Remote — United States · Complete your application.' : 'Signed in. Complete your application.'}</p>
  <form method="POST" action="/_submit/gated" enctype="multipart/form-data">
    ${field('First Name', `<input name="first_name" required>`, true)}
    ${field('Last Name',  `<input name="last_name" required>`, true)}
    ${field('Email',      `<input name="email" type="email" required>`, true)}
    ${field('Phone',      `<input name="phone" type="tel">`)}
    ${field('Resume', `<input type="file" name="resume" accept=".pdf" required>`, true)}

    <fieldset><legend>${legend('TRAP: label-only match', 'Employment')}</legend>
      ${field('Current Company', `<input name="org">`)}
    </fieldset>

    <fieldset><legend>Eligibility</legend>
      ${field('Do you now or in the future require sponsorship for work authorization?',
        `<select name="job_application[requires_sponsorship]" aria-required="true">
           <option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option>
         </select>`, true)}
      ${field('Are you legally authorized to work in the country of employment?',
        `<select name="work_authorization" aria-required="true">
           <option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option>
         </select>`, true)}
    </fieldset>

    <fieldset><legend>${legend('TRAP: sponsorship_inversion', 'Voluntary Disclosures')}</legend>
      ${presentation ? '' : `<p style="font-size:13px;color:#666">Same words as the question above, opposite sense. A
      <code>requires_sponsorship: "No"</code> answer placed here would attest the opposite of the
      truth. Nothing may fill it.</p>`}
      ${field('I am authorized to work without sponsorship',
        `<input type="checkbox" name="authorized_no_sponsorship">`)}
    </fieldset>

    <button type="submit">Submit Application</button>
  </form>`);
}

// ── G0: multi-step form carrying BOTH navigation styles ──────────────────────
// Exists for TASK G0 in docs/GATED_HANDOFF_PROMPTS.md. Chrome revokes an activeTab grant when
// the tab "navigates away", and the entire interaction model of the gated handoff turns on
// whether a portal's own step transition counts as navigating away. Workday and Amazon paginate
// both ways — sometimes a real document load, sometimes an SPA route change — and there is no
// reason to assume the two behave alike.
//
// So one step 1 carries THREE advance controls, identical in outcome and different only in
// mechanism:
//   #adv-post    real form POST -> a NEW document at the same origin
//   #adv-spa     history.pushState + DOM rewrite -> SAME document, new URL, no load
//   #adv-cross   a DIFFERENT origin (127.0.0.1 instead of localhost, same server) — the CONTROL.
//                A probe reporting "grant survived" here is broken; without this case a passing
//                result cannot be told apart from a probe that never observes a revocation.
//
// Every page stamps window.__g0DocId at parse time. A probe reading the same id before and after
// an advance proves the document was never replaced, so "same-document" is observed rather than
// asserted from the mechanism's name. Both advance paths render a byte-identical field set from
// step2FieldsHtml(), because the probe counts controls and a differing count would be read as a
// grant difference.
//
// G0-SPIKE is in every title on purpose: a chrome.commands hotkey can only be delivered as real
// keyboard input to a focused OS window, so the harness has to locate this window by title.
const g0DocStamp =
  `<script>window.__g0DocId='doc-'+Math.random().toString(36).slice(2,10);</script>`;

function step2FieldsHtml() {
  return `
    ${field('Years of professional experience',
      `<input type="number" name="years_experience" min="0" required>`, true)}
    ${field('Earliest start date', `<input type="date" name="start_date">`)}
    ${field('LinkedIn Profile', `<input type="url" name="linkedin">`)}
    ${field('Are you legally authorized to work in the country of employment?',
      `<select name="legally_authorized" aria-required="true">
         <option value="">Select...</option>
         <option value="Yes">Yes</option>
         <option value="No">No</option>
       </select>`, true)}`;
}

function multistepStep1() {
  const step2 = step2FieldsHtml();
  return page('G0-SPIKE Multi-step — Step 1', `
  ${g0DocStamp}
  <h1>Multi-step application — Step 1</h1>
  <p>Three ways to reach step 2. Only the mechanism differs.</p>
  <!-- novalidate: the G0 probe is read-only — it counts controls and never types into one — so
       constraint validation would block the real-POST advance and the trial would time out instead
       of measuring anything. The required flags stay for anything else reading this fixture. -->
  <form id="step1form" method="POST" action="/multistep/step2" novalidate>
    ${field('First Name', `<input name="first_name" required>`, true)}
    ${field('Last Name',  `<input name="last_name" required>`, true)}
    ${field('Email',      `<input name="email" type="email" required>`, true)}
    <button id="adv-post" type="submit">Next — real POST (new document)</button>
  </form>
  <div id="app"></div>
  <button id="adv-spa" type="button">Next — pushState (same document)</button>
  <p><a id="adv-cross" href="http://127.0.0.1:${PORT}/multistep">Different origin (control)</a></p>
  <script>
  (function(){
    var STEP2 = ${JSON.stringify(step2)};
    document.getElementById('adv-spa').addEventListener('click', function(){
      // Order matters: rewrite first, then push. A grant revoked by the URL change would
      // otherwise be indistinguishable from one revoked by the DOM replacement.
      document.getElementById('step1form').remove();
      this.remove();
      document.getElementById('app').innerHTML =
        '<h2>Step 2 of 2 — Eligibility (SPA)</h2>' + STEP2;
      history.pushState({ step: 2 }, '', '/multistep/step2?spa=1');
    });
  })();
  </script>`);
}

function multistepStep2(carry = {}) {
  const hidden = Object.entries(carry)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(String(v))}">`).join('');
  return page('G0-SPIKE Multi-step — Step 2', `
  ${g0DocStamp}
  <h1>Multi-step application — Step 2</h1>
  <p>Reached by a real document load.</p>
  <form method="POST" action="/_submit/multistep">
    ${hidden}
    ${step2FieldsHtml()}
    <button type="submit">Submit Application</button>
  </form>`);
}

// ── Workday-flavoured IFRAME form ────────────────────────────────────────────
// The non-greenhouse coverage case. platformDetector.usesIframe() is true for workday, icims and
// taleo — three of the nine providers outside the v1 full-auto allowlist — yet nothing in this
// harness had an iframe, so the multi-frame path had never been exercised at all. Everything real
// lives in the inner document; the outer page only hosts it.
function workdayShell() {
  return page('Workday — Apply', `
  <h1>Staff Engineer</h1>
  <p>Application hosted in an iframe, as workday/icims/taleo do.</p>
  <!-- DECOY, deliberately FIRST in the DOM so a naive walk over every frame reaches it before the
       real form. It has a visible "Submit" button and no field we would ever fill, standing in for
       the third-party frames a real posting carries (ads, captcha, analytics). Clicking it must be
       impossible: the submit scan only considers frames that received an approved answer. If it is
       ever posted, /_submissions records provider "decoy" and the test fails. -->
  <iframe src="/workday/decoy" title="Sponsored" style="width:100%;height:80px;border:1px dashed #f00"></iframe>
  <iframe src="/workday/inner" title="Application" style="width:100%;height:900px;border:1px solid #ccc"></iframe>`);
}

function workdayDecoy() {
  return page('Sponsored', `
  <form method="POST" action="/_submit/decoy">
    <p style="font-size:12px;color:#900">Third-party widget — nothing here belongs to the application.</p>
    <button type="submit">Submit</button>
  </form>`);
}

function workdayInner() {
  return page('Workday — Application', `
  <form method="POST" action="/_submit/workday" enctype="multipart/form-data">
    ${field('First Name', `<input name="firstName" required>`, true)}
    ${field('Last Name',  `<input name="lastName" required>`, true)}
    ${field('Email',      `<input name="email" type="email" required>`, true)}
    ${field('Phone Number', `<input name="phoneNumber" type="tel">`)}
    ${field('Name',       `<input name="candidateName">`)}
    ${field('Resume', `<input type="file" name="resumeUpload" required>`, true)}
    ${field('Are you legally authorized to work in the country of employment?',
      `<select name="workAuthorization" aria-required="true">
         <option value="">Select...</option>
         <option value="Yes">Yes</option>
         <option value="No">No</option>
       </select>`, true)}
    <button type="submit">Submit Application</button>
  </form>`);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function indexPage() {
  return page('Fake ATS', `
  <h1>Fake ATS</h1>
  <p>Local test target for <code>applyAutomation.js</code>. No outbound traffic; nothing reaches an employer.</p>
  <ul>
    <li><a href="/greenhouse">/greenhouse</a> — 2-step (sponsorship inversion, name ambiguity, required unmapped)</li>
    <li><a href="/lever">/lever</a> — 1-step (lowercase yes/no, "Review and Submit" button)</li>
    <li><a href="/spa">/spa</a> — JS-rendered, fields appear after a delay (SPA hydration)</li>
    <li><a href="/ashby">/ashby</a> — 1-step (required typeahead, non-ISO date)</li>
    <li><a href="/ashby-spa">/ashby-spa</a> — <strong>the live posting's measured shape</strong>:
      React-rendered in two chunks, nameless required date picker, UUID field names, checkboxes
      named with their own question text, four EEOC radio groups labelled by their first option.
      <code>?answerable=1</code> makes the date resolvable so the submit click is reachable;
      <code>?autofilltrap=1</code> sends the resume to the wrong file input;
      <code>?deadsubmit=1</code> clicks and changes nothing.</li>
    <li><a href="/multistep">/multistep</a> — 2-step offering a real POST, a pushState advance and
      a cross-origin control from one step 1 (TASK G0: activeTab grant lifetime)</li>
    <li><a href="/gated">/gated</a> — 302 to a sign-in wall, no form behind it
      (TASK G1: login_required → held_gate + packet). <a href="/gated/captcha">/gated/captcha</a>
      is the captcha_required variant. Neither is crossable, by design.
      <a href="/gated/form">/gated/form</a> is what waits behind it — the handoff target for G2/G3,
      carrying the sponsorship-inversion and label-only-match traps.
      <a href="/gated/mixed">/gated/mixed</a> puts a sign-in form and an application form on ONE page,
      both with a control named <code>email</code>: the case where only a per-control rule protects
      the candidate's details from the login box.</li>
    <li><a href="/workday-replica">/workday-replica</a> — D55: a Workday-shaped six-step wizard
      (My Information → My Experience → Application Questions → Voluntary Disclosures → Self Identify
      → Review). Its Submit is recorded at <a href="/_workday-replica/state">/_workday-replica/state</a>.</li>
  </ul>
  <p><a href="/_submissions">/_submissions</a> — recorded submissions (JSON). Each record carries
  <code>fields</code> (text parts), <code>files</code> (uploads — <code>null</code> where the input
  was present but empty) and <code>partCount</code>. Every form with a file input posts as
  <code>multipart/form-data</code>, so an upload is observable rather than assumed.</p>
  <h2>Traps</h2>
  <pre style="white-space:pre-wrap;font-size:12px">${escapeHtml(JSON.stringify(TRAPS, null, 2))}</pre>`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// ── D55 · THE WORKDAY-SHAPED REPLICA — /workday-replica ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════════════════════
// docs/AUTOFILL_TARGET.md §7.7: "(d) needs a Workday replica added there first". The /workday route
// above is a cross-origin IFRAME fixture for discovery; it is not a wizard. This is: one document,
// re-rendered step by step the way Workday's own SPA is, carrying every widget the reference video
// shows the extension driving and that draft's fill could not —
//
//   · a SIX-STEP WIZARD  My Information → My Experience → Application Questions → Voluntary
//                        Disclosures → Self Identify → Review, advanced by the portal's own
//                        "Save and Continue" (data-automation-id="bottom-navigation-next-button"),
//                        which VALIDATES the step and refuses to advance over an empty required field.
//   · DROPDOWN BUTTONS   <button aria-haspopup="listbox"> whose listbox is rendered into a PORTAL at
//                        the end of <body>, after a delay — not a sibling, not there on click.
//   · TYPEAHEADS         type → "Searching…" → results after a delay → click one → a chip. The search
//                        is a plain SUBSTRING match, so a profile value that is not the ATS's own
//                        wording ("Computer Science") finds nothing until a shorter query is tried.
//   · MULTI-SELECT CHIPS Skills: one chip per pick, each confirmed.
//   · ADD / ADD ANOTHER  Work Experience, Education, Languages, Websites: the panel appears a beat
//                        AFTER the click, and the button relabels itself "Add Another".
//   · A FILE DROP ZONE   over an input[type=file] — and a COVER LETTER drop zone placed BEFORE the
//                        résumé's, so "the first file input on the page" is the wrong one.
//   · REQUIRED, THREE WAYS  aria-required="true" on some controls; on others ONLY the label's
//                        asterisk (<abbr title="required">*</abbr>), which is all many forms give.
//   · THE STOPS          work authorisation and sponsorship, a screening question that rules the
//                        candidate out ("7+ years?"), a marketing opt-in, EEO, a required Terms
//                        checkbox and the disability self-identification.
//   · A REVIEW PAGE      whose bottom button is the SAME control as Save and Continue, relabelled
//                        "Submit" — exactly as Workday does it. Pressing it is RECORDED
//                        (submitPressed), so a test can prove the extension never did.
//
// Markup follows Workday's data-automation-id conventions as far as they are known
// (legalNameSection_firstName, addressSection_city, phone-number, file-upload-input-ref,
// selectedItem, promptOption …). ⚠ Not re-measured against a live tenant: this is a replica for
// measuring the fill, and it cannot prove a real tenant still uses these ids.
//
// State lives on the server only as a RECORD of what the page did: every Save and Continue posts the
// step's values to /_workday-replica/save, and Submit posts to /_submit/workday-replica. Read both
// at GET /_workday-replica/state; POST /_reset clears them.

const workdayReplica = { saves: [], submitPressed: 0, submitted: [] };
function resetWorkdayReplica() {
  workdayReplica.saves.length = 0;
  workdayReplica.submitted.length = 0;
  workdayReplica.submitPressed = 0;
}

const WD_REPLICA_CONFIG = {
  // Long enough that a fill which reads the listbox synchronously after its click finds nothing,
  // which is the defect (a) exists to fix; short enough that a run stays quick.
  listboxDelayMs: 120,
  searchDelayMs: 450,
  steps: ['My Information', 'My Experience', 'Application Questions', 'Voluntary Disclosures', 'Self Identify', 'Review'],
  vocab: {
    source: ['Career Fair', 'STEM Women Graduate Career Event', 'Company Careers Website', 'LinkedIn',
             'Employee Referral', 'Job Board', 'Other'],
    countries: ['Canada', 'India', 'United Kingdom', 'United States of America'],
    states: ['California', 'Illinois', 'Massachusetts', 'New York', 'Texas', 'Washington'],
    schools: ['Example State University', 'Example State University - Online', 'Example Technical College',
              'Northfield College', 'Riverside Institute of Technology'],
    degrees: ['High School Diploma', 'Associate', "Bachelor's Degree", "Master's Degree", 'Doctorate (PhD)'],
    fields: ['Computer and Information Sciences', 'Computer Engineering', 'Computational Biology',
             'Electrical Engineering', 'Mathematics'],
    languages: ['English', 'French', 'German', 'Hindi', 'Spanish'],
    proficiency: ['Beginner', 'Intermediate', 'Advanced', 'Fluent'],
    skills: ['Agile', 'Amazon Web Services (AWS)', 'C++', 'CSS', 'Docker', 'GraphQL', 'HTML', 'Java',
             'JavaScript', 'Kotlin', 'Node.js', 'PostgreSQL', 'Python (Programming Language)', 'React.js',
             'REST APIs', 'SQL', 'TypeScript'],
    ethnicity: ['Hispanic or Latino', 'White', 'Black or African American', 'Asian',
                'Two or More Races', 'I do not wish to answer'],
  },
};

// Runs IN THE PAGE. Serialised with toString(), so it closes over nothing but its argument.
function workdayReplicaClient(cfg) {
  const root = document.getElementById('wd-root');
  const state = { step: 0, values: {}, chips: {}, files: {}, sections: {} };
  let reg = [];               // the current step's fields: { key, label, required, get, wrap }
  let uid = 0;

  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) if (kid) el.append(kid);
    return el;
  };
  const closeLists = () => {
    document.querySelectorAll('.wd-pop').forEach(p => p.remove());
    document.querySelectorAll('[aria-expanded="true"]').forEach(a => a.setAttribute('aria-expanded', 'false'));
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.wd-pop, [aria-haspopup="listbox"], [role="combobox"]')) closeLists();
  });
  const position = (pop, anchor) => {
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${r.bottom + window.scrollY + 2}px`;
    pop.style.left = `${r.left + window.scrollX}px`;
    pop.style.minWidth = `${Math.max(220, r.width)}px`;
  };
  const register = (key, label, required, get, wrap) => reg.push({ key, label, required: !!required, get, wrap });
  const clearError = (key) => { const w = reg.find(f => f.key === key)?.wrap; w?.querySelector('[data-automation-id="errorMessage"]')?.remove(); };

  // A labelled form field the way Workday wraps one: formField-<key>, the label, an asterisk for a
  // required field, the control, and a slot its validation error is written into.
  const wrap = (key, label, required, forId, ...controls) => {
    const w = h('div', { 'data-automation-id': `formField-${key}`, class: 'wd-field' },
      h('label', { for: forId, id: `${forId}-label` }, label,
        required ? h('abbr', { title: 'required', 'aria-hidden': 'true', text: '*' }) : null),
      ...controls);
    return w;
  };

  function text(key, label, o = {}) {
    const id = `input-${key}`;
    const input = h('input', { type: o.type || 'text', id, 'data-automation-id': o.aid || key,
      'aria-required': o.aria ? 'true' : null, placeholder: o.placeholder || null, autocomplete: 'off' });
    input.value = state.values[key] || '';
    input.addEventListener('input', () => { state.values[key] = input.value; clearError(key); });
    const w = wrap(key, label, o.required, id, input);
    register(key, label, o.required, () => state.values[key] || '', w);
    return w;
  }
  function textarea(key, label, o = {}) {
    const id = `input-${key}`;
    const ta = h('textarea', { id, 'data-automation-id': o.aid || key, rows: 4 });
    ta.value = state.values[key] || '';
    ta.addEventListener('input', () => { state.values[key] = ta.value; clearError(key); });
    const w = wrap(key, label, o.required, id, ta);
    register(key, label, o.required, () => state.values[key] || '', w);
    return w;
  }
  function checkbox(key, label, o = {}) {
    const id = `input-${key}`;
    const cb = h('input', { type: 'checkbox', id, 'data-automation-id': o.aid || key, 'aria-required': o.aria ? 'true' : null });
    cb.checked = state.values[key] === true;
    cb.addEventListener('change', () => { state.values[key] = cb.checked; clearError(key); });
    const w = h('div', { 'data-automation-id': `formField-${key}`, class: 'wd-field wd-check' }, cb,
      h('label', { for: id }, label, o.required ? h('abbr', { title: 'required', 'aria-hidden': 'true', text: '*' }) : null));
    register(key, label, o.required, () => (state.values[key] === true ? 'checked' : ''), w);
    return w;
  }
  function radios(key, label, options, o = {}) {
    const legendId = `legend-${key}`;
    const fs = h('fieldset', { role: 'radiogroup', 'data-automation-id': `formField-${key}`, class: 'wd-field',
      'aria-labelledby': legendId, 'aria-required': o.required ? 'true' : null },
      h('legend', { id: legendId }, label, o.required ? h('abbr', { title: 'required', 'aria-hidden': 'true', text: '*' }) : null));
    options.forEach((opt, i) => {
      const id = `radio-${key}-${i}`;
      const r = h('input', { type: 'radio', name: key, id, value: opt });
      r.checked = state.values[key] === opt;
      r.addEventListener('change', () => { if (r.checked) { state.values[key] = opt; clearError(key); } });
      fs.append(h('div', { class: 'wd-check' }, r, h('label', { for: id, text: opt })));
    });
    register(key, label, o.required, () => state.values[key] || '', fs);
    return fs;
  }
  function dropdown(key, label, options, o = {}) {
    const id = `dropdown-${key}`;
    const btn = h('button', { type: 'button', id, 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
      'data-automation-id': o.aid || key, 'aria-required': o.aria ? 'true' : null,
      'aria-labelledby': `${id}-label ${id}`, value: state.values[key] || '', class: 'wd-dd',
      text: state.values[key] || 'Select One' });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      closeLists();
      const lbId = `listbox-${++uid}`;
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-controls', lbId);
      // The listbox arrives LATER, at the end of <body>. A fill that clicks and reads the list in the
      // same breath finds nothing — the defect that made setCombobox pick only pre-rendered options.
      setTimeout(() => {
        if (btn.getAttribute('aria-controls') !== lbId) return;
        const lb = h('div', { role: 'listbox', id: lbId, class: 'wd-pop', 'data-automation-id': 'activeListContainer' });
        for (const opt of options) {
          lb.append(h('div', { role: 'option', 'data-automation-id': 'promptOption', 'aria-selected': state.values[key] === opt ? 'true' : 'false',
            text: opt, onclick: (ev) => {
              ev.stopPropagation();
              state.values[key] = opt; btn.textContent = opt; btn.setAttribute('value', opt);
              clearError(key); closeLists();
            } }));
        }
        position(lb, btn);
        document.body.append(lb);
      }, cfg.listboxDelayMs);
    });
    const w = wrap(key, label, o.required, id, btn);
    register(key, label, o.required, () => state.values[key] || '', w);
    return w;
  }
  function typeahead(key, label, vocab, o = {}) {
    const id = `typeahead-${key}`;
    state.chips[key] = state.chips[key] || [];
    const input = h('input', { type: 'text', id, role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
      'data-automation-id': 'searchBox', placeholder: 'Search', autocomplete: 'off',
      'aria-required': o.aria ? 'true' : null, 'data-multiselect': o.multi ? 'true' : null });
    const list = h('ul', { 'data-automation-id': 'selectedItemList', role: 'list', class: 'wd-chips' });
    const renderChips = () => {
      list.replaceChildren(...state.chips[key].map(c => h('li', { 'data-automation-id': 'selectedItem', role: 'listitem', title: c },
        h('span', { text: c }),
        h('button', { type: 'button', 'data-automation-id': 'DELETE_charm', 'aria-label': `Remove ${c}`, text: '×',
          onclick: () => { state.chips[key] = state.chips[key].filter(x => x !== c); renderChips(); } }))));
      state.values[key] = o.multi ? state.chips[key].slice() : (state.chips[key][0] || '');
    };
    let timer = null;
    const search = () => {
      const q = input.value.trim().toLowerCase();
      closeLists();
      if (!q) return;
      const lbId = `listbox-${++uid}`;
      input.setAttribute('aria-controls', lbId);
      input.setAttribute('aria-expanded', 'true');
      const lb = h('div', { role: 'listbox', id: lbId, class: 'wd-pop', 'data-automation-id': 'activeListContainer', 'aria-busy': 'true' },
        h('div', { 'data-automation-id': 'searching', text: 'Searching…' }));
      position(lb, input);
      document.body.append(lb);
      setTimeout(() => {
        if (!lb.isConnected) return;
        // A plain substring search, like most ATS prompts: the ATS's vocabulary, not the profile's.
        const hits = vocab.filter(v => v.toLowerCase().includes(q));
        lb.removeAttribute('aria-busy');
        lb.replaceChildren(...(hits.length
          ? hits.map(v => h('div', { role: 'option', 'data-automation-id': 'promptOption',
              'aria-selected': state.chips[key].includes(v) ? 'true' : 'false', text: v,
              onclick: (ev) => {
                ev.stopPropagation();
                if (o.multi) { if (!state.chips[key].includes(v)) state.chips[key].push(v); }
                else state.chips[key] = [v];
                input.value = '';
                renderChips(); clearError(key); closeLists();
              } }))
          : [h('div', { 'data-automation-id': 'noItems', text: 'No Items.' })]));
      }, cfg.searchDelayMs);
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 150); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); search(); } });
    renderChips();
    const w = wrap(key, label, o.required, id, h('div', { 'data-automation-id': 'multiselectInputContainer' }, input), list);
    register(key, label, o.required, () => (state.chips[key].length ? state.chips[key].join(', ') : ''), w);
    return w;
  }
  function monthYear(key, label, o = {}) {
    const lblId = `group-${key}`;
    const mk = (part, ph, aid) => {
      const k = `${key}-${part}`;
      const i = h('input', { type: 'text', id: `input-${k}`, 'aria-label': part === 'month' ? 'Month' : 'Year',
        'data-automation-id': aid, placeholder: ph, inputmode: 'numeric', size: ph.length + 1 });
      i.value = state.values[k] || '';
      i.addEventListener('input', () => { state.values[k] = i.value; clearError(key); });
      return i;
    };
    const g = h('div', { role: 'group', 'aria-labelledby': lblId, 'data-automation-id': `formField-${key}`, class: 'wd-field' },
      h('span', { id: lblId, class: 'wd-glabel' }, label, o.required ? h('abbr', { title: 'required', 'aria-hidden': 'true', text: '*' }) : null),
      h('div', { class: 'wd-date' }, mk('month', 'MM', 'dateSectionMonth-input'), mk('year', 'YYYY', 'dateSectionYear-input')));
    register(key, label, o.required,
      () => (state.values[`${key}-month`] && state.values[`${key}-year`] ? `${state.values[`${key}-month`]}/${state.values[`${key}-year`]}` : ''), g);
    return g;
  }
  function yearOnly(key, label, o = {}) {
    const lblId = `group-${key}`;
    const i = h('input', { type: 'text', id: `input-${key}`, 'aria-label': 'Year', 'data-automation-id': 'dateSectionYear-input',
      placeholder: 'YYYY', inputmode: 'numeric', size: 5 });
    i.value = state.values[key] || '';
    i.addEventListener('input', () => { state.values[key] = i.value; clearError(key); });
    const g = h('div', { role: 'group', 'aria-labelledby': lblId, 'data-automation-id': `formField-${key}`, class: 'wd-field' },
      h('span', { id: lblId, class: 'wd-glabel' }, label, o.required ? h('abbr', { title: 'required', 'aria-hidden': 'true', text: '*' }) : null),
      h('div', { class: 'wd-date' }, i));
    register(key, label, o.required, () => state.values[key] || '', g);
    return g;
  }
  function dropZone(key, label, o = {}) {
    const id = `file-${key}`;
    const status = h('div', { 'data-automation-id': state.files[key] ? 'file-upload-successful' : 'file-upload-status',
      text: state.files[key] ? `${state.files[key].name} · ${(state.files[key].size / 1024).toFixed(2)} KB · Successfully Uploaded!` : 'Drop file here or Select files' });
    const input = h('input', { type: 'file', id, 'data-automation-id': 'file-upload-input-ref', accept: '.pdf,.doc,.docx', class: 'wd-file' });
    const take = (f) => {
      if (!f) return;
      state.files[key] = { name: f.name, size: f.size, type: f.type };
      status.setAttribute('data-automation-id', 'file-upload-successful');
      status.textContent = `${f.name} · ${(f.size / 1024).toFixed(2)} KB · Successfully Uploaded!`;
      clearError(key);
    };
    input.addEventListener('change', () => take(input.files[0]));
    const zone = h('div', { 'data-automation-id': 'file-upload-drop-zone', class: 'wd-drop' }, status, input);
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('drop', (e) => { e.preventDefault(); take(e.dataTransfer?.files?.[0]); });
    const w = wrap(key, label, o.required, id, zone);
    register(key, label, o.required, () => state.files[key]?.name || '', w);
    return w;
  }
  // A repeating section. "Add" until there is one entry, "Add Another" after; the new panel appears a
  // beat after the click, so a fill has to wait for it rather than assume it is there.
  function section(kind, title, buildPanel) {
    state.sections[kind] = state.sections[kind] || 0;
    const headId = `section-${kind}`;
    const panels = h('div', { class: 'wd-panels' });
    const btn = h('button', { type: 'button', 'data-automation-id': 'add-button', class: 'wd-add' });
    const relabel = () => {
      const n = state.sections[kind];
      btn.textContent = n ? 'Add Another' : 'Add';
      btn.setAttribute('aria-label', `${n ? 'Add Another' : 'Add'} ${title}`);
    };
    const addPanel = (n) => {
      const p = h('div', { role: 'group', 'data-automation-id': `${kind}-${n}`, 'aria-labelledby': `${headId}-${n}`, class: 'wd-panel' },
        h('h4', { id: `${headId}-${n}`, text: `${title} ${n}` }));
      buildPanel(p, n);
      panels.append(p);
    };
    btn.addEventListener('click', () => {
      setTimeout(() => { state.sections[kind] += 1; addPanel(state.sections[kind]); relabel(); }, cfg.listboxDelayMs);
    });
    for (let n = 1; n <= state.sections[kind]; n++) addPanel(n);
    relabel();
    return h('div', { role: 'group', 'data-automation-id': `${kind}Section`, 'aria-labelledby': headId, class: 'wd-section' },
      h('h3', { id: headId, text: title }), panels, btn);
  }

  const STEPS = [
    (body) => body.append(
      typeahead('source', 'How Did You Hear About Us?', cfg.vocab.source, {}),
      radios('previousWorker', 'Have you previously worked for this company?', ['Yes', 'No'], {}),
      dropdown('country', 'Country', cfg.vocab.countries, { required: true, aria: true, aid: 'countryDropdown' }),
      text('legalNameSection_firstName', 'First Name', { required: true, aria: true }),
      // Asterisk ONLY — no required, no aria-required. A pre-check that reads attributes alone misses it.
      text('legalNameSection_lastName', 'Last Name', { required: true }),
      text('addressSection_addressLine1', 'Address Line 1', {}),
      text('addressSection_city', 'City', { required: true }),
      dropdown('addressSection_countryRegion', 'State', cfg.vocab.states, {}),
      text('addressSection_postalCode', 'Postal Code', {}),
      text('email', 'Email Address', { required: true, aria: true, type: 'email' }),
      dropdown('phone-device-type', 'Phone Device Type', ['Home Cellular', 'Mobile', 'Landline'], {}),
      text('phone-number', 'Phone Number', { required: true }),
    ),
    (body) => body.append(
      section('workExperience', 'Work Experience', (p, n) => p.append(
        text(`workExperience-${n}-jobTitle`, 'Job Title', { required: true, aid: 'jobTitle' }),
        text(`workExperience-${n}-company`, 'Company', { required: true, aid: 'company' }),
        text(`workExperience-${n}-location`, 'Location', { aid: 'location' }),
        checkbox(`workExperience-${n}-currentlyWorkHere`, 'I currently work here', { aid: 'currentlyWorkHere' }),
        monthYear(`workExperience-${n}-startDate`, 'From', { required: true }),
        monthYear(`workExperience-${n}-endDate`, 'To', {}),
        textarea(`workExperience-${n}-roleDescription`, 'Role Description', { aid: 'description' }),
      )),
      section('education', 'Education', (p, n) => p.append(
        typeahead(`education-${n}-school`, 'School or University', cfg.vocab.schools, { required: true }),
        dropdown(`education-${n}-degree`, 'Degree', cfg.vocab.degrees, { required: true, aria: true, aid: 'degree' }),
        typeahead(`education-${n}-fieldOfStudy`, 'Field of Study', cfg.vocab.fields, {}),
        text(`education-${n}-gradeAverage`, 'Overall Result (GPA)', { aid: 'gradeAverage' }),
        yearOnly(`education-${n}-firstYearAttended`, 'From', {}),
        yearOnly(`education-${n}-lastYearAttended`, 'To (Actual or Expected)', {}),
      )),
      section('language', 'Languages', (p, n) => p.append(
        dropdown(`language-${n}-language`, 'Language', cfg.vocab.languages, { required: true, aid: 'language' }),
        checkbox(`language-${n}-native`, 'I am fluent in this language.', { aid: 'nativeLanguage' }),
        dropdown(`language-${n}-reading`, 'Reading', cfg.vocab.proficiency, { aid: 'languageProficiency-reading' }),
        dropdown(`language-${n}-speaking`, 'Speaking', cfg.vocab.proficiency, { aid: 'languageProficiency-speaking' }),
        dropdown(`language-${n}-writing`, 'Writing', cfg.vocab.proficiency, { aid: 'languageProficiency-writing' }),
      )),
      typeahead('skills', 'Type to Add Skills', cfg.vocab.skills, { multi: true }),
      // THE (e) TRAP: the cover letter's drop zone comes FIRST in document order.
      dropZone('coverLetter', 'Cover Letter', {}),
      dropZone('resume', 'Resume/CV', { required: true }),
      section('websites', 'Websites', (p, n) => p.append(
        text(`websites-${n}-url`, 'URL', { required: true, aid: 'website' }),
      )),
    ),
    (body) => body.append(
      dropdown('q-authorized', 'Are you legally authorized to work in the United States?', ['Yes', 'No'], { required: true, aria: true }),
      dropdown('q-sponsorship', 'Will you now or in the future require sponsorship for employment visa status (e.g., H-1B visa status)?',
        ['Yes', 'No'], { required: true, aria: true }),
      // Rules the candidate out if answered "No" for them — §7.3: stop and ask.
      dropdown('q-seven-years', 'Do you have 7+ years of professional software engineering experience?', ['Yes', 'No'], { required: true, aria: true }),
      // §7.4: never opt the candidate in.
      checkbox('q-marketing', 'Yes, I would like to receive text messages and marketing communications about future opportunities.', {}),
    ),
    (body) => body.append(
      dropdown('gender', 'Gender', ['Male', 'Female', 'Non-binary', 'I do not wish to answer'], { required: true }),
      dropdown('ethnicity', 'Ethnicity', cfg.vocab.ethnicity, { required: true }),
      dropdown('veteranStatus', 'Veteran Status', ['I am not a protected veteran',
        'I identify as one or more of the classifications of protected veteran', 'I do not wish to answer'], { required: true }),
      checkbox('agreementCheckbox', 'I have read and consent to the Terms and Conditions', { required: true }),
    ),
    (body) => body.append(
      text('selfIdentifiedDisabilityData--name', 'Name', { required: true }),
      text('selfIdentifiedDisabilityData--dateSignedOn', 'Date', { required: true, placeholder: 'MM/DD/YYYY' }),
      radios('disabilityStatus', 'Please check one of the boxes below:', [
        'Yes, I have a disability (or previously had a disability)',
        'No, I do not have a disability and have not had one in the past',
        'I do not want to answer'], { required: true }),
    ),
    (body) => {
      const sec = h('section', { 'data-automation-id': 'reviewJobApplicationPage' });
      const dl = h('dl', { class: 'wd-review' });
      for (const [k, v] of Object.entries(state.values)) {
        const shown = Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : v === false ? 'No' : String(v ?? '');
        if (!shown) continue;
        dl.append(h('dt', { text: k }), h('dd', { 'data-key': k, text: shown }));
      }
      for (const [k, f] of Object.entries(state.files)) dl.append(h('dt', { text: k }), h('dd', { 'data-key': k, text: f.name }));
      sec.append(h('p', { text: 'Review your application before you submit it.' }), dl);
      body.append(sec);
    },
  ];

  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  function render() {
    closeLists();
    reg = [];
    const isReview = state.step === cfg.steps.length - 1;
    const progress = h('ol', { 'data-automation-id': 'progressBar', class: 'wd-progress' },
      cfg.steps.map((s, i) => h('li', {
        'data-automation-id': i === state.step ? 'progressBarActiveStep' : i < state.step ? 'progressBarCompletedStep' : 'progressBarInactiveStep',
        'aria-current': i === state.step ? 'step' : null, text: s })));
    const body = h('div', { 'data-automation-id': 'applyFlowStepBody', class: 'wd-body' });
    STEPS[state.step](body);
    const banner = h('div', { 'data-automation-id': 'errorBanner', role: 'alert', class: 'wd-banner', hidden: true });
    const back = state.step > 0 && !isReview
      ? h('button', { type: 'button', 'data-automation-id': 'bottom-navigation-back-button', class: 'wd-back', text: 'Back',
          onclick: () => { state.step -= 1; render(); } })
      : null;
    // ⛔ ONE control, two meanings — Workday's own design. On every step it reads "Save and Continue";
    // on Review the SAME automation id reads "Submit". An advance that keys on the id alone submits.
    const next = h('button', { type: 'button', 'data-automation-id': 'bottom-navigation-next-button', class: 'wd-next',
      text: isReview ? 'Submit' : 'Save and Continue' });
    next.addEventListener('click', async () => {
      if (isReview) {
        next.disabled = true;
        await post('/_submit/workday-replica', { values: state.values, files: state.files });
        root.replaceChildren(h('h2', { 'data-automation-id': 'applicationSubmitted', text: 'Application Submitted' }),
          h('p', { text: 'Thank you for your application.' }));
        return;
      }
      const missing = reg.filter(f => f.required && !f.get());
      for (const f of reg) f.wrap.querySelector('[data-automation-id="errorMessage"]')?.remove();
      if (missing.length) {
        for (const f of missing) {
          f.wrap.append(h('p', { 'data-automation-id': 'errorMessage', role: 'alert', class: 'wd-err',
            text: `Error: The field ${f.label} is required and must have a value.` }));
        }
        banner.hidden = false;
        banner.textContent = `Errors Found: ${missing.length}`;
        return;
      }
      next.disabled = true;          // greys out on the transition, as the video shows
      const values = {};
      for (const f of reg) values[f.key] = f.get();
      await post('/_workday-replica/save', { step: cfg.steps[state.step], values });
      setTimeout(() => { state.step += 1; render(); window.scrollTo(0, 0); }, 300);
    });
    root.replaceChildren(
      h('div', { class: 'wd-top' }, h('span', { class: 'wd-brand', text: 'Northwind Systems' }), h('span', { text: 'Senior Engineer' })),
      progress,
      h('h2', { 'data-automation-id': 'pageHeader', text: cfg.steps[state.step] }),
      banner, body,
      h('div', { 'data-automation-id': 'pageFooter', class: 'wd-foot' }, back, next));
  }
  render();
}

function workdayReplicaPage() {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Senior Engineer — Apply — Workday replica</title>
<style>
 body{font-family:system-ui,sans-serif;margin:0;background:#f4f5f7;color:#1d2433}
 #wd-root{max-width:760px;margin:24px auto;background:#fff;border-radius:8px;padding:20px 28px;box-shadow:0 1px 3px #0002}
 .wd-top{display:flex;gap:12px;align-items:baseline;border-bottom:1px solid #e3e5e8;padding-bottom:10px}
 .wd-brand{font-weight:800}
 .wd-progress{display:flex;gap:6px;list-style:none;padding:0;margin:14px 0;font-size:12px}
 .wd-progress li{flex:1;padding:6px 4px;border-top:4px solid #d5d8dd;color:#68707d}
 .wd-progress li[aria-current]{border-color:#0875e1;color:#0875e1;font-weight:700}
 .wd-progress li[data-automation-id="progressBarCompletedStep"]{border-color:#43a047}
 .wd-field{margin:14px 0;display:block}
 .wd-field > label, .wd-glabel, legend{display:block;font-weight:600;font-size:14px;margin-bottom:4px}
 abbr[title="required"]{color:#de2e21;text-decoration:none;margin-left:2px}
 input[type=text],input[type=email],textarea{width:100%;padding:8px;font-size:14px;box-sizing:border-box;border:1px solid #a1a8b3;border-radius:4px}
 .wd-date input{width:auto;margin-right:6px}
 .wd-dd{min-width:260px;text-align:left;padding:8px;border:1px solid #a1a8b3;border-radius:4px;background:#fff;font-size:14px;cursor:pointer}
 .wd-pop{position:absolute;z-index:50;background:#fff;border:1px solid #a1a8b3;border-radius:4px;box-shadow:0 4px 12px #0003;max-height:260px;overflow:auto}
 .wd-pop [role=option],.wd-pop div{padding:7px 10px;font-size:14px}
 .wd-pop [role=option]:hover{background:#e8f1fc;cursor:pointer}
 .wd-chips{list-style:none;padding:0;margin:6px 0 0;display:flex;flex-wrap:wrap;gap:6px}
 .wd-chips li{background:#e8f1fc;border-radius:12px;padding:3px 6px 3px 10px;font-size:13px}
 .wd-chips button{border:0;background:none;cursor:pointer}
 .wd-check{display:flex;gap:8px;align-items:center;margin:8px 0}
 .wd-check label{font-weight:400}
 fieldset{border:0;padding:0}
 .wd-section{border-top:1px solid #e3e5e8;margin-top:18px;padding-top:6px}
 .wd-panel{border:1px solid #e3e5e8;border-radius:6px;padding:4px 14px;margin:10px 0}
 .wd-add,.wd-back{padding:7px 14px;border:1px solid #0875e1;color:#0875e1;background:#fff;border-radius:16px;cursor:pointer}
 .wd-drop{position:relative;border:2px dashed #a1a8b3;border-radius:6px;padding:22px;text-align:center;color:#68707d}
 .wd-file{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%}
 [data-automation-id="file-upload-successful"]{color:#2e7d32;font-weight:600}
 .wd-err{color:#de2e21;font-size:13px;margin:4px 0}
 .wd-banner{background:#fdecea;color:#de2e21;padding:8px 12px;border-radius:4px}
 .wd-foot{display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #e3e5e8;margin-top:24px;padding-top:14px}
 .wd-next{padding:9px 20px;border:0;border-radius:16px;background:#0875e1;color:#fff;font-weight:700;cursor:pointer}
 .wd-next:disabled{background:#a1a8b3}
 .wd-review dt{font-size:12px;color:#68707d;margin-top:8px}
 .wd-review dd{margin:0;font-weight:600}
</style></head><body>
<div data-automation-id="applyFlowPage" id="wd-root"></div>
<script>(${workdayReplicaClient.toString()})(${JSON.stringify(WD_REPLICA_CONFIG)});</script>
</body></html>`;
}

/**
 * The replica's routes, in one place so the server dispatch below carries one line per method.
 * Returns true when it answered.
 */
function workdayReplicaRoute(req, res, path, raw, send) {
  if (req.method === 'GET' && path === '/workday-replica') { send(200, workdayReplicaPage()); return true; }
  if (req.method === 'GET' && path === '/_workday-replica/state') {
    send(200, JSON.stringify(workdayReplica, null, 2), 'application/json; charset=utf-8');
    return true;
  }
  if (req.method !== 'POST') return false;
  const json = () => { try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { return {}; } };
  if (path === '/_workday-replica/save') {
    const body = json();
    workdayReplica.saves.push({ step: String(body.step || ''), at: new Date().toISOString(), values: body.values || {} });
    send(200, JSON.stringify({ ok: true }), 'application/json');
    return true;
  }
  if (path === '/_submit/workday-replica') {
    // RECORDED, never assumed: the extension must never press this, and this counter is how a run
    // proves it did not.
    workdayReplica.submitPressed += 1;
    const body = json();
    const record = { provider: 'workday-replica', at: new Date().toISOString(), fields: body.values || {}, files: body.files || {}, partCount: 0 };
    workdayReplica.submitted.push(record);
    submissions.push(record);
    console.log('[fakeAts] SUBMITTED via workday-replica');
    send(200, JSON.stringify({ ok: true }), 'application/json');
    return true;
  }
  return false;
}
// ══ end of the D55 Workday replica ═════════════════════════════════════════════════════════════

// ── Server ───────────────────────────────────────────────────────────────────
// Buffers, not a string: a multipart body carries raw PDF bytes, and `raw += chunk` would decode
// them as UTF-8 and corrupt every part boundary offset. The cap is 20MB rather than the old 2MB
// because file content now actually crosses the wire.
function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    let len = 0;
    req.on('data', c => { chunks.push(c); len += c.length; if (len > 2e7) req.destroy(); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

const CRLF2 = Buffer.from('\r\n\r\n');

/**
 * Minimal multipart/form-data parser — enough to record what a browser actually sent.
 *
 * File bodies are measured and discarded, never stored: the harness needs to prove the resume
 * arrived, not keep a copy of the candidate's resume in memory.
 */
function parseMultipart(buf, boundary) {
  const fields = Object.create(null);
  const files = Object.create(null);
  const delim = Buffer.from(`--${boundary}`);
  const parts = [];

  let pos = buf.indexOf(delim);
  if (pos < 0) return { fields, files, partCount: 0 };
  pos += delim.length;
  while (pos < buf.length) {
    if (buf[pos] === 0x2d && buf[pos + 1] === 0x2d) break;          // closing "--"
    if (buf[pos] === 0x0d && buf[pos + 1] === 0x0a) pos += 2;       // CRLF after the boundary
    const next = buf.indexOf(delim, pos);
    if (next < 0) break;
    let end = next;
    if (buf[end - 2] === 0x0d && buf[end - 1] === 0x0a) end -= 2;   // trailing CRLF belongs to the delimiter
    parts.push(buf.subarray(pos, end));
    pos = next + delim.length;
  }

  for (const part of parts) {
    const sep = part.indexOf(CRLF2);
    if (sep < 0) continue;
    const headers = part.subarray(0, sep).toString('utf8');
    const body = part.subarray(sep + CRLF2.length);
    const name = headers.match(/\bname="([^"]*)"/i)?.[1];
    if (name == null) continue;
    const filename = headers.match(/\bfilename="([^"]*)"/i)?.[1];

    if (filename == null) {
      const val = body.toString('utf8');
      // Mirror querystring.parse: a repeated key collects into an array.
      fields[name] = name in fields ? [].concat(fields[name], val) : val;
      continue;
    }
    // A file input with nothing chosen still sends a part, with filename="" and an empty body.
    // Recording null rather than omitting it is what separates "the resolver skipped this field"
    // from "the resolver filled it and the upload failed" — indistinguishable under urlencoded.
    files[name] = filename === ''
      ? null
      : { filename, contentType: headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim()
            || 'application/octet-stream', size: body.length };
  }
  return { fields, files, partCount: parts.length };
}

// ── THE CONTROL TYPES applyPlan COULD NOT FILL, PLUS THE ONE IT LIED ABOUT (task D) ───────────
//
// Every field here is a shape a real ATS uses and the old fill path either skipped or misreported:
//
//   reverting_text  A REACT-CONTROLLED INPUT. Its component state is the source of truth, so a
//                   programmatic `value =` that never went through setState is discarded on the
//                   next render. The old applyPlan pushed to `filled` the instant after the setter
//                   ran, so this field was REPORTED AS FILLED over a form the candidate could see
//                   was empty. This is the single most important fixture on the page.
//   combo_country   A Workday/react-select combobox: a div with role=combobox and a popup listbox.
//                   Invisible to the old probe, which only enumerated input/select/textarea.
//   bio             contenteditable — same invisibility.
//   skills_multi    select[multiple]: the one control where "the value" is a set.
//   start_date      input[type=date], to pin that the date format survives a round trip.
//   plain_text      A control that simply works, so a run where EVERYTHING fails is distinguishable
//                   from one where only the hard cases do.
function widgetsForm() {
  return page('Widgets — Application', `
    <h1>Widgets — Application</h1>
    <form id="widgets-form">
      <label for="plain_text">Full name</label>
      <input id="plain_text" name="plain_text" type="text">

      <label for="reverting_text">Preferred name (React-controlled, reverts)</label>
      <input id="reverting_text" name="reverting_text" type="text">

      <label for="start_date">Earliest start date</label>
      <input id="start_date" name="start_date" type="date">

      <label for="skills_multi">Skills (multi-select)</label>
      <select id="skills_multi" name="skills_multi" multiple size="4">
        <option value="go">Go</option>
        <option value="node">Node.js</option>
        <option value="postgres">Postgres</option>
        <option value="rust">Rust</option>
      </select>

      <label id="combo_country_label">Country</label>
      <div id="combo_country" role="combobox" aria-controls="combo_country_list"
           aria-label="Country" tabindex="0"
           style="border:1px solid #999;padding:8px;cursor:pointer">Select…</div>
      <ul id="combo_country_list" role="listbox" style="display:none;border:1px solid #ccc;margin:0;padding:0;list-style:none">
        <li role="option" style="padding:6px">United States</li>
        <li role="option" style="padding:6px">United Kingdom</li>
        <li role="option" style="padding:6px">Germany</li>
      </ul>

      <label for="bio">Short bio (contenteditable)</label>
      <div id="bio" contenteditable="true" aria-label="Short bio"
           style="border:1px solid #999;min-height:60px;padding:8px"></div>

      <button type="submit">Submit</button>
    </form>
    <script>
      // A React-controlled input, reproduced honestly: the component's state is authoritative and
      // a value it did not set is thrown away on the next frame. requestAnimationFrame, not a
      // microtask, because that is when a real render commits — and it is exactly the window a
      // synchronous read-back would miss.
      (function () {
        var rev = document.getElementById('reverting_text');
        var state = '';
        rev.addEventListener('input', function () {
          requestAnimationFrame(function () { rev.value = state; });
        });
      })();

      // A custom combobox. There is no value to assign — it only changes when its own option is
      // clicked, which is what applyPlan's setCombobox drives.
      (function () {
        var box  = document.getElementById('combo_country');
        var list = document.getElementById('combo_country_list');
        box.addEventListener('click', function () {
          list.style.display = list.style.display === 'none' ? 'block' : 'none';
        });
        list.addEventListener('click', function (e) {
          var opt = e.target.closest('[role="option"]');
          if (!opt) return;
          box.textContent = opt.textContent;
          list.style.display = 'none';
        });
      })();
    </script>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const send = (code, body, type = 'text/html; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type': type }); res.end(body);
  };

  // D55: the Workday-shaped replica answers its own routes (see workdayReplicaRoute).
  if (req.method === 'GET' && workdayReplicaRoute(req, res, path, null, send)) return;

  if (req.method === 'GET') {
    if (path === '/')           return send(200, indexPage());
    if (path === '/greenhouse') return send(200, greenhouseStep1());
    if (path === '/greenhouse-standard') return send(200, greenhouseStandardForm({ nameless: url.searchParams.get('nameless') === '1' }));
    if (path === '/lever')      return send(200, leverForm());
    if (path === '/plain')      return send(200, plainForm());   // ⭐ A211 (1a)
    if (path === '/lever-live')    return send(200, leverLiveForm());
    if (path === '/workable-live') return send(200, workableLiveForm());
    if (path === '/ashby')      return send(200, ashbyForm());
    // The measured replica of the live posting. See ashbySpaForm for what each param reaches.
    if (path === '/ashby-spa') {
      const q = url.searchParams.get('delay');
      return send(200, ashbySpaForm({
        delayMs:      q === null ? undefined : Number(q),
        // ?presentation=1 — neutral brand and caption, for the store screenshots. See ashbySpaForm.
        presentation: url.searchParams.get('presentation') === '1',
        answerable:   url.searchParams.get('answerable') === '1',
        autofillTrap: url.searchParams.get('autofilltrap') === '1',
        deadSubmit:   url.searchParams.get('deadsubmit') === '1',
        fuzzyLabel:   url.searchParams.get('fuzzylabel') === '1',
      }));
    }
    if (path === '/ashby-spa/thanks') return send(200, ashbySpaThanks());
    if (path === '/posting')          return send(200, postingPage());
    if (path === '/spa') {
      // ?delay=<ms> overrides the hydration delay; ?delay=0 renders synchronously.
      // ?variant=2 serves a CHANGED form, for the schema-reconciliation case.
      const q = url.searchParams.get('delay');
      const variant = Number(url.searchParams.get('variant') || 1);
      return send(200, spaForm(q === null ? undefined : Number(q), variant));
    }
    // A 302 rather than serving the sign-in directly, because that is what a real portal does and it
    // is what makes the run's final URL differ from the URL it was queued with — the reason the gate
    // packet stores the URL the gate was OBSERVED at.
    if (path === '/gated') {
      res.writeHead(302, { Location: '/gated/signin' });
      return res.end();
    }
    if (path === '/gated/signin')  return send(200, gatedSignin());
    // The form the candidate reaches after crossing the gate themselves — G2 fills it, G3 reviews it.
    // ?presentation=1 serves the SAME form with the didactic trap captions removed, for the Chrome
    // Web Store listing screenshots. Same fields, same names, same behaviour — see gatedForm().
    if (path === '/gated/form')    return send(200, gatedForm({ presentation: url.searchParams.get('presentation') === '1' }));
    if (path === '/gated/captcha') return send(200, gatedCaptcha());
    if (path === '/gated/mixed')   return send(200, gatedMixed());
    if (path === '/widgets')         return send(200, widgetsForm());
    if (path === '/multistep')       return send(200, multistepStep1());
    // Also GET-able so the pushState URL is a real address — a reload after an SPA advance must
    // land on the same step rather than a 404, as it does on a real portal.
    if (path === '/multistep/step2') return send(200, multistepStep2());
    if (path === '/workday')       return send(200, workdayShell());
    if (path === '/workday/inner') return send(200, workdayInner());
    if (path === '/workday/decoy') return send(200, workdayDecoy());
    // D56: the two-origin application (posting host ≠ apply host). See the section at the end of the file.
    if (path.startsWith('/twoorigin/')) return twoOriginRoute(req, res, url, send);
    if (workdayShapedRoute(path, send)) return;   // the owner's Zoom URL shape: the posting and its apply stages
    // D75: the crawler worker's fake careers sites, and the robots.txt that forbids one of them.
    if (path === '/robots.txt') return send(200, CRAWLER_ROBOTS, 'text/plain; charset=utf-8');
    if (path.startsWith('/crawler-fixtures/')) return crawlerFixtureRoute(req, res, url, send);
    if (path === '/_submissions')
      return send(200, JSON.stringify({ count: submissions.length, submissions }, null, 2),
                  'application/json; charset=utf-8');
  }

  if (req.method === 'POST') {
    const raw = await readBody(req);
    const ctype = req.headers['content-type'] || '';
    const boundary = ctype.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const { fields, files, partCount } = ctype.includes('multipart/form-data') && boundary
      ? parseMultipart(raw, (boundary[1] || boundary[2]).trim())
      : { fields: parseQuery(raw.toString('utf8')), files: {}, partCount: 0 };

    if (workdayReplicaRoute(req, res, path, raw, send)) return;   // D55: JSON-bodied, so before the generic /_submit/

    if (path === '/_reset') {
      submissions.length = 0;
      resetWorkdayReplica();
      return send(200, JSON.stringify({ ok: true }), 'application/json');
    }

    if (path === '/greenhouse/step2') {
      return send(200, greenhouseStep2(fields, files));
    }

    if (path === '/multistep/step2') {
      return send(200, multistepStep2(fields));
    }

    if (path.startsWith('/_submit/')) {
      const provider = path.split('/')[2];
      // Uploads from an earlier step of a multi-step flow, carried in as a hidden field.
      const carried = fields._step1_files ? JSON.parse(fields._step1_files) : null;
      if (carried) { delete fields._step1_files; Object.assign(files, carried); }
      const record = { provider, at: new Date().toISOString(), fields, files, partCount };
      submissions.push(record);
      console.log(`[fakeAts] SUBMITTED via ${provider}:`);
      console.log(JSON.stringify(fields, null, 2));
      console.log(`[fakeAts] files (${partCount} parts):`, JSON.stringify(files, null, 2));
      return send(200, page('Application received', `
        <h1>Thank you for your application</h1>
        <p>Your application has been submitted successfully. We'll be in touch.</p>
        <p style="font-size:12px;color:#666">Recorded as submission #${submissions.length}.
        This phrasing is intentional: it is what <code>classifyFlowState</code> matches on to
        return <code>'submitted'</code>.</p>`));
    }
  }

  send(404, page('Not found', '<h1>404</h1>'));
});

server.listen(PORT, () => {
  console.log(`[fakeAts] listening on http://localhost:${PORT}`);
  console.log('[fakeAts] forms: /greenhouse  /lever  /ashby');
  console.log('[fakeAts] assert against GET /_submissions — never on status alone.');
  console.log('[fakeAts] uploads are real multipart; check record.files, not record.fields.');
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// ── D56 · A TWO-ORIGIN APPLICATION — the posting on one origin, the application on another ─────────
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Amazon's shape: the POSTING on www.amazon.jobs, the APPLICATION on account.amazon.jobs. A packet
// keyed to one origin could never match the other — the defect behind the owner's "Nothing is
// prepared for https://account.amazon.jobs" (10-07). The Workday replica D55 adds is single-origin and
// would never have caught it.
//
// Locally the two origins are the same process under two names: the POSTING is served on
// http://localhost:<PORT> and the APPLICATION on http://127.0.0.1:<PORT> — different origins to the
// browser and to the extension. The job id is in the path on both, as Amazon's is:
//
//   GET /twoorigin/jobs/<id>        the posting (meant for the localhost origin), "Apply now" →
//   GET /twoorigin/apply/<id>       on the POSTING host: 302 to the apply host, as www.amazon.jobs's
//                                   /applicant/jobs/<id>/apply redirects to account.amazon.jobs
//                                   on the APPLY host: the application form (name, email, phone,
//                                   résumé, the two eligibility selects) → POST /_submit/twoorigin
//
// The adapter family a test registers for it (routes/apply.js's applyOriginFamilies seam):
//   { ats: "fake-two-origin", origins: [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`],
//     jobIdPattern: /\/twoorigin\/(?:jobs|apply)\/(\d+)/ }
const TWO_ORIGIN_POSTING_HOST = 'localhost';
const TWO_ORIGIN_APPLY_HOST = '127.0.0.1';

// ── Workday-SHAPED — the owner's Zoom URL (10-12), its stages only ──────────────────────────────────────
// The posting and /apply, /apply/applyManually, /apply/useMyLastApplication, each with or without the en-US locale
// and ?source=linkedin — ONE job (services/jobPageKey.js: workday|zoom|zoom|R19749). The paths are the owner's;
// the host is localhost (a real tenant host is mapped onto it by the browser run's resolver rule). ⛔ No sign-in or
// create-account page is drawn: those URLs are added only from what the owner pastes, never invented.
const WORKDAY_SHAPED = /^(?:\/en-US)?\/Zoom\/job\/Remote--\(US\)\/Software-Engineer_R19749-1(?:\/apply(?:\/(applyManually|useMyLastApplication))?)?$/;
function workdayShapedRoute(path, send) {
  let p = path;
  try { p = decodeURIComponent(path); } catch { /* keep it */ }
  const m = p.match(WORKDAY_SHAPED);
  if (!m) return false;
  const stage = p.includes('/apply') ? (m[1] || 'apply') : null;
  // Workday's own automation ids for the header, the location and the description (as on the owner's posting).
  const header = `<h2 data-automation-id="jobPostingHeader">Software Engineer</h2>
  <p data-automation-id="locations">Remote (US) · R19749-1</p>`;
  const description = `<div data-automation-id="jobPostingDescription"><p>Build Zoom's next video platform in TypeScript and Go.
  You will design services, review code and ship weekly with a small team. Requirements: three or more years building
  distributed systems. This role is remote within the United States.</p></div>`;
  if (!stage) {
    send(200, page('Software Engineer — Zoom Careers', `${header}${description}
  <a data-automation-id="adventureButton" href="${p.replace(/\/$/, '')}/apply">Apply</a>`));
    return true;
  }
  send(200, page('Software Engineer — Apply', `${header}
  <p data-stage="${stage}" data-ws-step="${WS_FIRST_STEP}">Step: ${WS_STEPS.find(s => s.id === WS_FIRST_STEP).title.toLowerCase()}</p>
  <aside>${description}</aside>
  ${workdayShapedStyle()}
  <form data-automation-id="applyFlowPage" id="ws-root" onsubmit="return false">
    <ol data-automation-id="progressBar" class="ws-progress"></ol>
    <h2 data-automation-id="pageHeader"></h2>
    <div data-automation-id="applyFlowStepBody" id="ws-body"></div>
    <div data-automation-id="pageFooter" class="ws-foot">
      <button type="button" id="back-step" data-automation-id="bottom-navigation-back-button">Back</button>
      <button type="button" id="next-step" data-automation-id="bottom-navigation-next-button">Save and Continue</button>
    </div>
  </form>
  ${WS_STEPS.map(s => `<template data-ws-step="${s.id}" data-ws-title="${escapeHtml(s.title)}"${s.onPath ? ' data-ws-on-path=""' : ''}>${s.body()}</template>`).join('\n  ')}
  <script>(${workdayShapedClient.toString()})(${JSON.stringify(WS_CONFIG)});</script>`));
  return true;
}

// ── J2 · THE STAGES INSIDE THE WORKDAY-SHAPED APPLICATION (D96 §5–§8, D98 §5) ───────────────────────────────────
// One document per URL, its STEP changing without the URL changing — Workday's own single-page navigation. Each step
// is a <template data-ws-step="…"> (inert: no fill, no extractor and no querySelector sees it) cloned into
// #ws-body by workdayShapedClient; the values a step held are kept in the page and shown on Review.
//
//   ON THE PATH (Save and Continue, #next-step):
//     myInformation → myExperience → applicationQuestions → voluntaryDisclosures → selfIdentify → review
//   OFF THE PATH (reached with window.__wd.go(id), the harness's goStep — the URL never changes):
//     signIn        — sign-in on the SAME applyManually URL (56cbfb4: there is no separate sign-in address), with a
//                     PASSWORD input pre-filled with WS_CONFIG.passwordSentinel, so a run can prove it never left
//                     the page (test-support/extensionBrowser.mjs: leaked()).
//     unrecognised  — no control draft can recognise: the "Nothing was filled" case (D96 §5).
//
// What the SPEC states (D96 §1, §5, §7; D98 §5) and this draws: labels carrying a trailing required asterisk
// ("First Name*"); My Information with address line 1, city, state (a dropdown), postal code, country (a dropdown),
// phone device type (a dropdown), phone number and country phone code (a typeahead); Application Questions with radio
// and checkbox groups; Voluntary Disclosures with EEO dropdowns AND an "I have read and consent" checkbox; a
// self-identification step with a NAME + DATE signature; Review; a hidden input[type=file] behind a drop zone.
//
// ⚠ shape assumed, re-measure on a live tenant (O73): EVERY data-automation-id below follows D55's replica
// conventions (themselves "not re-measured against a live tenant"), and each control marked ⚠ further down is a
// shape nobody has measured on Zoom's tenant. A test may rely on the controls existing; it may not cite this markup
// as evidence of what Workday renders.
//
// ⛔ Save and Continue does NOT validate here (D55's /workday-replica does): a lane's run must be able to walk every
// step with only what draft filled. On Review the SAME button reads "Submit"; pressing it posts to
// /_submit/workday-shaped and is RECORDED in GET /_submissions, so a run can prove the extension never pressed it.
// ⛔ D60: no capsule in this CSS — every radius is 6px or less.
const WS_FIRST_STEP = 'myInformation';
const WS_CONFIG = {
  listboxDelayMs: 120,      // the listbox arrives LATER, in a portal at the end of <body> (as D55's replica)
  searchDelayMs: 450,       // a typeahead answers after "Searching…"
  passwordSentinel: 'ws-PASSWORD-SENTINEL-7d1c0e',
};
const WS_REQ = '<abbr title="required" aria-hidden="true">*</abbr>';
const wsAttrJson = (v) => escapeHtml(JSON.stringify(v));
const wsLabel = (id, text, req) => `<label for="${id}" id="${id}-label">${text}${req ? WS_REQ : ''}</label>`;
const wsField = (aid, inner) => `<div data-automation-id="formField-${aid}" class="ws-field">${inner}</div>`;
function wsText(id, aid, label, o = {}) {
  const tag = o.textarea ? 'textarea' : 'input';
  const attrs = [`id="${id}"`, `data-automation-id="${aid}"`, o.textarea ? 'rows="3"' : `type="${o.type || 'text'}"`,
    o.name ? `name="${o.name}"` : '', o.aria ? 'aria-required="true"' : '', o.placeholder ? `placeholder="${o.placeholder}"` : '',
    o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''].filter(Boolean).join(' ');
  return wsField(aid, `${wsLabel(id, label, o.req)}<${tag} ${attrs}>${o.textarea ? '</textarea>' : ''}`);
}
// The combobox: a BUTTON that opens a listbox (role=option, promptOption) rendered into a portal after a delay.
function wsDropdown(id, aid, label, options, o = {}) {
  return wsField(aid, `${wsLabel(id, label, o.req)}<button type="button" id="${id}" class="ws-dd" data-automation-id="${aid}"
    aria-haspopup="listbox" aria-expanded="false" aria-labelledby="${id}-label ${id}" value=""${o.req ? ' aria-required="true"' : ''}
    data-ws-options="${wsAttrJson(options)}">Select One</button>`);
}
// The typeahead: type → "Searching…" → options → a selectedItem chip (a rectangle, never a capsule).
function wsTypeahead(id, aid, label, vocab, o = {}) {
  return wsField(aid, `${wsLabel(id, label, o.req)}<div data-automation-id="multiselectInputContainer">
    <input type="text" id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off"
      data-automation-id="searchBox" data-ws-for="${aid}" placeholder="Search"${o.req ? ' aria-required="true"' : ''}
      data-ws-vocab="${wsAttrJson(vocab)}"></div>
    <ul data-automation-id="selectedItemList" role="list" class="ws-chips" data-ws-chips="${id}"></ul>`);
}
function wsGroup(kind, id, aid, legend, options, o = {}) {
  const role = kind === 'radio' ? 'radiogroup' : 'group';
  const items = options.map((opt, i) => `<div class="ws-check"><input type="${kind}" id="${id}-${i}" name="${id}" value="${escapeHtml(opt)}">` +
    `<label for="${id}-${i}">${escapeHtml(opt)}</label></div>`).join('');
  return `<fieldset role="${role}" data-automation-id="formField-${aid}" class="ws-field" aria-labelledby="${id}-legend"${o.req ? ' aria-required="true"' : ''}>` +
    `<legend id="${id}-legend">${legend}${o.req ? WS_REQ : ''}</legend>${items}</fieldset>`;
}
function wsDate(id, aid, label, parts, o = {}) {
  const PART = { month: ['MM', 'Month', 'dateSectionMonth-input'], day: ['DD', 'Day', 'dateSectionDay-input'], year: ['YYYY', 'Year', 'dateSectionYear-input'] };
  const inputs = parts.map(p => `<input type="text" id="${id}-${p}" aria-label="${PART[p][1]}" data-automation-id="${PART[p][2]}"
    placeholder="${PART[p][0]}" inputmode="numeric" size="${PART[p][0].length + 1}">`).join('');
  return `<div role="group" data-automation-id="formField-${aid}" class="ws-field" aria-labelledby="${id}-label">` +
    `<span id="${id}-label" class="ws-glabel">${label}${o.req ? WS_REQ : ''}</span><div class="ws-date">${inputs}</div></div>`;
}
const WS_COUNTRIES = ['Canada', 'India', 'United Kingdom', 'United States of America'];
const WS_STATES = ['California', 'Illinois', 'Massachusetts', 'New York', 'Texas', 'Washington'];
const WS_PHONE_CODES = ['Canada (+1)', 'India (+91)', 'United Kingdom (+44)', 'United States of America (+1)'];
const WS_STEPS = [
  { id: 'signIn', title: 'Sign In', onPath: false, body: () => [
    // ⚠ shape assumed, re-measure on a live tenant (O73): Workday's sign-in panel on the applyManually URL — the
    // owner saw sign-in there (56cbfb4); its markup and automation ids were never measured.
    wsText('ws-signIn-email', 'email', 'Email Address', { req: true, type: 'email', autocomplete: 'username' }),
    wsText('ws-signIn-password', 'password', 'Password', { req: true, type: 'password', autocomplete: 'current-password' }),
    `<button type="button" data-automation-id="signInSubmitButton" data-ws-go="myInformation">Sign In</button>`,
  ].join('\n') },
  { id: 'myInformation', title: 'My Information', onPath: true, body: () => [
    wsTypeahead('ws-source', 'source', 'How Did You Hear About Us?', ['Company Careers Website', 'Employee Referral', 'Job Board', 'LinkedIn', 'Other'], { req: true }),
    wsGroup('radio', 'ws-previousWorker', 'previousWorker', 'Have you previously worked for Zoom?', ['Yes', 'No'], { req: true }),
    wsDropdown('ws-country', 'countryDropdown', 'Country', WS_COUNTRIES, { req: true }),
    // The owner's symptom 4: "First Name*" — the label's text ends in the asterisk. name= kept for the walk's checks.
    wsText('ws-firstName', 'legalNameSection_firstName', 'First Name', { req: true, aria: true, name: 'firstName' }),
    // Asterisk ONLY — no aria-required (D55: "all many forms give").
    wsText('ws-lastName', 'legalNameSection_lastName', 'Last Name', { req: true, name: 'lastName' }),
    wsText('ws-addressLine1', 'addressSection_addressLine1', 'Address Line 1', { req: true }),
    wsText('ws-city', 'addressSection_city', 'City', { req: true }),
    wsDropdown('ws-state', 'addressSection_countryRegion', 'State', WS_STATES, { req: true }),
    wsText('ws-postalCode', 'addressSection_postalCode', 'Postal Code', { req: true }),
    wsText('ws-email', 'email', 'Email Address', { req: true, aria: true, type: 'email', name: 'email' }),
    wsDropdown('ws-phoneDeviceType', 'phone-device-type', 'Phone Device Type', ['Home Cellular', 'Landline', 'Mobile'], { req: true }),
    wsTypeahead('ws-phoneCode', 'country-phone-code', 'Country Phone Code', WS_PHONE_CODES, { req: true }),
    wsText('ws-phoneNumber', 'phone-number', 'Phone Number', { req: true, type: 'tel' }),
  ].join('\n') },
  { id: 'myExperience', title: 'My Experience', onPath: true, body: () => [
    `<div role="group" data-automation-id="workExperience-1" class="ws-panel" aria-labelledby="ws-we1-h"><h4 id="ws-we1-h">Work Experience 1</h4>`,
    wsText('ws-we1-jobTitle', 'jobTitle', 'Job Title', { req: true }),
    wsText('ws-we1-company', 'company', 'Company', { req: true }),
    wsText('ws-we1-location', 'location', 'Location'),
    `<div data-automation-id="formField-currentlyWorkHere" class="ws-field ws-check"><input type="checkbox" id="ws-we1-current" data-automation-id="currentlyWorkHere"><label for="ws-we1-current">I currently work here</label></div>`,
    wsDate('ws-we1-from', 'startDate', 'From', ['month', 'year'], { req: true }),
    wsDate('ws-we1-to', 'endDate', 'To', ['month', 'year']),
    wsText('ws-we1-description', 'description', 'Role Description', { textarea: true }),
    `</div>`,
    `<div role="group" data-automation-id="education-1" class="ws-panel" aria-labelledby="ws-ed1-h"><h4 id="ws-ed1-h">Education 1</h4>`,
    wsTypeahead('ws-ed1-school', 'school', 'School or University', ['Example State University', 'Northfield College', 'Riverside Institute of Technology'], { req: true }),
    wsDropdown('ws-ed1-degree', 'degree', 'Degree', ["Associate", "Bachelor's Degree", "Master's Degree", 'Doctorate (PhD)'], { req: true }),
    `</div>`,
    // The résumé: a HIDDEN input[type=file] inside a custom drop zone (D98 §5's "likely case"). The file name shows in
    // file-upload-successful when the input's change fires, so a run can verify an attach took.
    // ⚠ shape assumed, re-measure on a live tenant (O73): how the input is hidden, and the status text.
    wsField('resumeUpload', `<span class="ws-glabel" id="ws-resume-label">Resume/CV${WS_REQ}</span>
      <div data-automation-id="file-upload-drop-zone" class="ws-drop" aria-labelledby="ws-resume-label">
        <div data-automation-id="file-upload-status" id="ws-resume-status">Drop file here</div>
        <button type="button" data-automation-id="select-files" data-ws-pick="ws-resume">Select files</button>
        <input type="file" id="ws-resume" data-automation-id="file-upload-input-ref" accept=".pdf,.doc,.docx" class="ws-hidden-file" tabindex="-1">
      </div>`),
  ].join('\n') },
  { id: 'applicationQuestions', title: 'Application Questions', onPath: true, body: () => [
    wsGroup('radio', 'ws-q-authorized', 'q-authorized', 'Are you legally authorized to work in the United States?', ['Yes', 'No'], { req: true }),
    wsGroup('radio', 'ws-q-sponsorship', 'q-sponsorship',
      'Will you now or in the future require sponsorship for employment visa status (e.g., H-1B visa status)?', ['Yes', 'No'], { req: true }),
    // ⚠ shape assumed, re-measure on a live tenant (O73): a multi-answer checkbox group on Application Questions.
    wsGroup('checkbox', 'ws-q-locations', 'q-locations', 'Which locations would you consider? (select all that apply)',
      ['Remote (US)', 'San Jose, CA', 'Seattle, WA'], { req: true }),
  ].join('\n') },
  { id: 'voluntaryDisclosures', title: 'Voluntary Disclosures', onPath: true, body: () => [
    wsDropdown('ws-gender', 'gender', 'Gender', ['Female', 'Male', 'Non-binary', 'I do not wish to answer'], { req: true }),
    wsDropdown('ws-ethnicity', 'ethnicity', 'Ethnicity', ['Asian', 'Black or African American', 'Hispanic or Latino', 'Two or More Races', 'White', 'I do not wish to answer'], { req: true }),
    wsDropdown('ws-veteranStatus', 'veteranStatus', 'Veteran Status', ['I am not a protected veteran',
      'I identify as one or more of the classifications of protected veteran', 'I do not wish to answer'], { req: true }),
    // ⛔ D96 §4 safeguard 1: a terms / consent control — ALWAYS the user's own click, never draft's.
    `<div data-automation-id="formField-agreementCheckbox" class="ws-field ws-check"><input type="checkbox" id="ws-consent" data-automation-id="agreementCheckbox" aria-required="true">` +
      `<label for="ws-consent">I have read and consent to the Terms and Conditions${WS_REQ}</label></div>`,
  ].join('\n') },
  { id: 'selfIdentify', title: 'Self Identify', onPath: true, body: () => [
    `<p>Voluntary Self-Identification of Disability</p>`,
    wsGroup('radio', 'ws-disability', 'disabilityStatus', 'Please check one of the boxes below:', [
      'Yes, I have a disability (or previously had a disability)',
      'No, I do not have a disability and have not had one in the past',
      'I do not want to answer'], { req: true }),
    // ⛔ D96 §4 safeguard 1: the SIGNATURE — a name and a date the candidate signs. Never filled by draft.
    wsText('ws-sig-name', 'selfIdentifiedDisabilityData--name', 'Name', { req: true }),
    // ⚠ shape assumed, re-measure on a live tenant (O73): the signature date as month / day / year inputs.
    wsDate('ws-sig-date', 'selfIdentifiedDisabilityData--dateSignedOn', 'Date', ['month', 'day', 'year'], { req: true }),
  ].join('\n') },
  { id: 'unrecognised', title: 'Questionnaire', onPath: false, body: () => [
    // ⚠ SYNTHETIC, not a Workday shape: three controls with no label, no name, no aria-label and no placeholder —
    // nothing a matcher can recognise, so a fill fills NOTHING ("Nothing was filled", D96 §5). The first is
    // aria-required, so the wizard stops here for the candidate instead of advancing — D96 §1 symptom 3's page.
    `<div class="ws-field"><input type="text" id="ws-u1" data-automation-id="q-7f3a2c" aria-required="true"></div>`,
    `<div class="ws-field"><textarea id="ws-u2" data-automation-id="q-9b1e04" rows="2"></textarea></div>`,
    `<div class="ws-field"><button type="button" id="ws-u3" class="ws-dd" data-automation-id="q-c40d11" aria-haspopup="listbox"
      aria-expanded="false" value="" data-ws-options="${wsAttrJson(['7', '8', '9'])}">Select One</button></div>`,
  ].join('\n') },
  { id: 'review', title: 'Review', onPath: true, body: () =>
    `<section data-automation-id="reviewJobApplicationPage"><p>Review your application before you submit it.</p><dl class="ws-review" id="ws-review"></dl></section>` },
];
function workdayShapedStyle() {
  // ⛔ D60: rectangles only — the largest radius here is 6px.
  return `<style>
 #ws-root{border:1px solid #d5d8dd;border-radius:6px;padding:12px 18px;margin-top:16px}
 .ws-progress{display:flex;gap:6px;list-style:none;padding:0;margin:4px 0 10px;font-size:12px}
 .ws-progress li{flex:1;padding:4px;border-top:4px solid #d5d8dd;color:#68707d}
 .ws-progress li[aria-current]{border-color:#0875e1;color:#0875e1;font-weight:700}
 .ws-field{margin:12px 0;display:block}
 .ws-glabel,legend{display:block;font-weight:600;font-size:14px;margin-bottom:4px}
 abbr[title="required"]{color:#c00;text-decoration:none;margin-left:2px}
 fieldset{border:0;padding:0;margin:12px 0}
 .ws-check{display:flex;gap:8px;align-items:center;margin:6px 0}
 .ws-check input{width:auto}
 .ws-check label{font-weight:400;margin:0}
 .ws-date{display:flex;gap:6px}
 .ws-date input{width:auto}
 .ws-dd{margin:0;min-width:260px;text-align:left;padding:8px;border:1px solid #a1a8b3;border-radius:4px;background:#fff;font-size:14px}
 .ws-pop{position:absolute;z-index:50;background:#fff;border:1px solid #a1a8b3;border-radius:4px;max-height:240px;overflow:auto}
 .ws-pop div{padding:6px 10px;font-size:14px;cursor:pointer}
 .ws-chips{list-style:none;padding:0;margin:6px 0 0;display:flex;flex-wrap:wrap;gap:6px}
 .ws-chips li{background:#e8f1fc;border-radius:4px;padding:2px 8px;font-size:13px}
 .ws-panel{border:1px solid #e3e5e8;border-radius:6px;padding:4px 12px;margin:10px 0}
 .ws-drop{position:relative;border:2px dashed #a1a8b3;border-radius:6px;padding:16px;text-align:center;color:#68707d}
 .ws-hidden-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none}
 [data-automation-id="file-upload-successful"]{color:#2e7d32;font-weight:600}
 .ws-foot{display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #e3e5e8;margin-top:16px}
 .ws-foot button{border-radius:6px}
 .ws-review dt{font-size:12px;color:#68707d;margin-top:6px}
 .ws-review dd{margin:0;font-weight:600}
</style>`;
}
// Runs IN THE PAGE. Serialised with toString(), so it closes over nothing but its argument.
function workdayShapedClient(cfg) {
  const body = document.getElementById('ws-body');
  const stageLine = document.querySelector('[data-stage]');
  const header = document.querySelector('#ws-root [data-automation-id="pageHeader"]');
  const progress = document.querySelector('#ws-root [data-automation-id="progressBar"]');
  const next = document.getElementById('next-step');
  const back = document.getElementById('back-step');
  const steps = [...document.querySelectorAll('template[data-ws-step]')].map(t => ({ id: t.dataset.wsStep, title: t.dataset.wsTitle, onPath: t.hasAttribute('data-ws-on-path'), t }));
  const path = steps.filter(s => s.onPath);
  const state = { step: null, values: {}, chips: {}, files: {}, submitPressed: 0, history: [] };
  let uid = 0;
  const el = (tag, attrs, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
  const closeLists = () => {
    document.querySelectorAll('.ws-pop').forEach(p => p.remove());
    document.querySelectorAll('#ws-body [aria-expanded="true"]').forEach(a => a.setAttribute('aria-expanded', 'false'));
  };
  const position = (pop, anchor) => {
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${r.bottom + window.scrollY + 2}px`; pop.style.left = `${r.left + window.scrollX}px`; pop.style.minWidth = `${Math.max(220, r.width)}px`;
  };
  const renderChips = (id) => {
    const list = body.querySelector(`[data-ws-chips="${id}"]`);
    if (!list) return;
    list.replaceChildren(...(state.chips[id] || []).map(c => { const li = el('li', { 'data-automation-id': 'selectedItem', role: 'listitem', title: c }); li.append(el('span', {}, c)); return li; }));
  };
  // Keep what the step held — by element id — when it is left, and put it back when it is shown again.
  const save = () => {
    for (const c of body.querySelectorAll('input, textarea, button[aria-haspopup="listbox"]')) {
      if (!c.id) continue;
      if (c.matches('button')) { state.values[c.id] = c.getAttribute('value') || ''; continue; }
      if (c.type === 'file' || c.getAttribute('role') === 'combobox') continue;   // kept as they happen
      if (c.type === 'radio') { if (c.checked) state.values[c.name] = c.value; continue; }
      if (c.type === 'checkbox') { state.values[c.id] = c.checked; continue; }
      state.values[c.id] = c.value;
    }
  };
  const restore = () => {
    for (const c of body.querySelectorAll('input, textarea, button[aria-haspopup="listbox"]')) {
      if (c.type === 'password' && !(c.id in state.values)) { c.value = cfg.passwordSentinel; continue; }   // as a password manager would
      if (c.matches('button')) { const v = state.values[c.id]; if (v) { c.setAttribute('value', v); c.textContent = v; } continue; }
      if (c.type === 'radio') { c.checked = state.values[c.name] === c.value; continue; }
      if (c.type === 'checkbox') { c.checked = state.values[c.id] === true; continue; }
      if (c.type === 'file' || c.getAttribute('role') === 'combobox') continue;
      if (c.id in state.values) c.value = state.values[c.id];
    }
    for (const id of Object.keys(state.chips)) renderChips(id);
    for (const [id, f] of Object.entries(state.files)) {
      const status = document.getElementById(`${id}-status`);
      if (status) { status.setAttribute('data-automation-id', 'file-upload-successful'); status.textContent = `${f.name} · Successfully Uploaded!`; }
    }
  };
  const fillReview = () => {
    const dl = document.getElementById('ws-review');
    if (!dl) return;
    const rows = [];
    for (const [k, v] of Object.entries(state.values)) if (v !== '' && v !== false && !/password/i.test(k)) rows.push([k, v === true ? 'Yes' : String(v)]);
    for (const [k, v] of Object.entries(state.chips)) if (v.length) rows.push([k, v.join(', ')]);
    for (const [k, f] of Object.entries(state.files)) rows.push([k, f.name]);
    dl.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', { 'data-key': k }, v)]));
  };
  function go(id) {
    const s = steps.find(x => x.id === id);
    if (!s) throw new Error(`no step ${id}`);
    if (state.step) save();
    closeLists();
    state.step = id;
    state.history.push(id);
    body.replaceChildren(s.t.content.cloneNode(true));
    restore();
    if (id === 'review') fillReview();
    header.textContent = s.title;
    stageLine.textContent = `Step: ${s.title.toLowerCase()}`;
    stageLine.dataset.wsStep = id;
    progress.replaceChildren(...path.map(p => { const li = el('li', { 'data-automation-id': p.id === id ? 'progressBarActiveStep' : 'progressBarInactiveStep' }, p.title); if (p.id === id) li.setAttribute('aria-current', 'step'); return li; }));
    next.textContent = id === 'review' ? 'Submit' : 'Save and Continue';
    // Sign-in has its own "Sign In" button and no Save and Continue footer (⚠ shape assumed, re-measure on a live tenant (O73)).
    next.hidden = id === 'signIn';
    back.hidden = id === 'signIn' || path.indexOf(s) <= 0;
  }
  next.addEventListener('click', async () => {
    if (state.step === 'review') {
      // ⛔ Recorded, never assumed: the extension must never press this (GET /_submissions, provider workday-shaped).
      state.submitPressed += 1;
      save();
      await fetch('/_submit/workday-shaped', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(Object.entries(state.values).map(([k, v]) => [k, String(v)])).toString() }).catch(() => {});
      return;
    }
    const i = path.findIndex(p => p.id === state.step);
    go(i < 0 ? path[0].id : path[Math.min(i + 1, path.length - 1)].id);
  });
  back.addEventListener('click', () => { const i = path.findIndex(p => p.id === state.step); if (i > 0) go(path[i - 1].id); });
  document.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const goBtn = t.closest('[data-ws-go]');
    if (goBtn) { go(goBtn.dataset.wsGo); return; }
    const pick = t.closest('[data-ws-pick]');
    if (pick) { document.getElementById(pick.dataset.wsPick)?.click(); return; }
    const opt = t.closest('.ws-pop [role="option"]');
    if (opt) {
      const pop = opt.closest('.ws-pop');
      const owner = document.getElementById(pop.dataset.owner);
      if (owner?.matches('button')) { owner.setAttribute('value', opt.textContent); owner.textContent = opt.textContent; state.values[owner.id] = opt.textContent; }
      else if (owner) { state.chips[owner.id] = [opt.textContent]; owner.value = ''; renderChips(owner.id); }
      closeLists();
      return;
    }
    const dd = t.closest('#ws-body button[aria-haspopup="listbox"]');
    if (dd) {
      closeLists();
      const lbId = `ws-listbox-${++uid}`;
      dd.setAttribute('aria-expanded', 'true'); dd.setAttribute('aria-controls', lbId);
      setTimeout(() => {
        if (dd.getAttribute('aria-controls') !== lbId || !dd.isConnected) return;
        const lb = el('div', { role: 'listbox', id: lbId, class: 'ws-pop', 'data-automation-id': 'activeListContainer', 'data-owner': dd.id });
        for (const o of JSON.parse(dd.dataset.wsOptions || '[]')) lb.append(el('div', { role: 'option', 'data-automation-id': 'promptOption', 'aria-selected': String(dd.getAttribute('value') === o) }, o));
        position(lb, dd); document.body.append(lb);
      }, cfg.listboxDelayMs);
      return;
    }
    if (!t.closest('.ws-pop, [role="combobox"]')) closeLists();
  });
  let timer = null;
  const search = (input) => {
    const q = input.value.trim().toLowerCase();
    closeLists();
    if (!q) return;
    const lbId = `ws-listbox-${++uid}`;
    input.setAttribute('aria-controls', lbId); input.setAttribute('aria-expanded', 'true');
    const lb = el('div', { role: 'listbox', id: lbId, class: 'ws-pop', 'data-automation-id': 'activeListContainer', 'data-owner': input.id, 'aria-busy': 'true' });
    lb.append(el('div', { 'data-automation-id': 'searching' }, 'Searching…'));
    position(lb, input); document.body.append(lb);
    setTimeout(() => {
      if (!lb.isConnected) return;
      const hits = JSON.parse(input.dataset.wsVocab || '[]').filter(v => v.toLowerCase().includes(q));
      lb.removeAttribute('aria-busy');
      lb.replaceChildren(...(hits.length ? hits.map(v => el('div', { role: 'option', 'data-automation-id': 'promptOption', 'aria-selected': 'false' }, v))
        : [el('div', { 'data-automation-id': 'noItems' }, 'No Items.')]));
    }, cfg.searchDelayMs);
  };
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.closest('#ws-body') && t.getAttribute('role') === 'combobox') { clearTimeout(timer); timer = setTimeout(() => search(t), 150); }
  });
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Enter' && t instanceof HTMLInputElement && t.getAttribute('role') === 'combobox') { e.preventDefault(); clearTimeout(timer); search(t); }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'file' || !t.closest('#ws-body')) return;
    const f = t.files && t.files[0];
    if (!f) return;
    state.files[t.id] = { name: f.name, size: f.size, type: f.type };
    const status = document.getElementById(`${t.id}-status`);
    if (status) { status.setAttribute('data-automation-id', 'file-upload-successful'); status.textContent = `${f.name} · Successfully Uploaded!`; }
  });
  // The harness's hook (test-support/extensionBrowser.mjs). Main world only — the extension's isolated world never sees it.
  window.__wd = {
    steps: steps.map(s => ({ id: s.id, title: s.title, onPath: s.onPath })),
    go, step: () => state.step, history: () => state.history.slice(),
    values: () => { save(); return JSON.parse(JSON.stringify({ values: state.values, chips: state.chips, files: state.files })); },
    submitPressed: () => state.submitPressed,
    passwordSentinel: cfg.passwordSentinel,
  };
  go(stageLine.dataset.wsStep || path[0].id);
}

function twoOriginPosting(id) {
  return page(`D56 Two-origin Engineer ${id} — Careers`, `
  <h1>Platform Engineer</h1>
  <p>Contoso Logistics · Remote — United States · Job ID ${id}</p>
  <p>The posting lives on this origin; the application lives on another. That is the case under test.</p>
  <a id="apply" href="http://${TWO_ORIGIN_APPLY_HOST}:${PORT}/twoorigin/apply/${id}">Apply now</a>`);
}

function twoOriginForm(id) {
  return page(`D56 Two-origin application ${id}`, `
  <h1>Apply — Platform Engineer (Job ID ${id})</h1>
  <form method="POST" action="/_submit/twoorigin" enctype="multipart/form-data">
    <input type="hidden" name="job_id" value="${escapeHtml(id)}">
    ${field('First Name', `<input name="first_name" required>`, true)}
    ${field('Last Name',  `<input name="last_name" required>`, true)}
    ${field('Email',      `<input name="email" type="email" required>`, true)}
    ${field('Phone',      `<input name="phone" type="tel">`)}
    ${field('Resume', `<input type="file" name="resume" accept=".pdf" required>`, true)}
    ${field('Are you legally authorized to work in the country of employment?',
      `<select name="work_authorization" aria-required="true">
         <option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option>
       </select>`, true)}
    ${field('Do you now or in the future require sponsorship for work authorization?',
      `<select name="requires_sponsorship" aria-required="true">
         <option value="">Select...</option><option value="Yes">Yes</option><option value="No">No</option>
       </select>`, true)}
    <button type="submit">Submit Application</button>
  </form>`);
}

function twoOriginRoute(req, res, url, send) {
  const host = String(req.headers.host || '').split(':')[0];
  const m = url.pathname.match(/^\/twoorigin\/(jobs|apply)\/(\d+)\/?$/);
  if (!m) return send(404, page('Not found', '<h1>404</h1>'));
  const [, kind, id] = m;
  if (kind === 'jobs') return send(200, twoOriginPosting(id));
  // The application is only ever served on the APPLY origin; on the posting origin it redirects there.
  if (host !== TWO_ORIGIN_APPLY_HOST) {
    res.writeHead(302, { Location: `http://${TWO_ORIGIN_APPLY_HOST}:${PORT}/twoorigin/apply/${id}` });
    return res.end();
  }
  return send(200, twoOriginForm(id));
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════
// ── D75 · FAKE CAREERS SITES — the crawler worker's fixtures (docs/CRAWLER_WORKER.md §6) ──────────────
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// Each is a company's careers site in one of the shapes the worker must read — or must refuse:
//   /crawler-fixtures/static/careers     a plain link to a Greenhouse board                → J1 found (link)
//   /crawler-fixtures/deep/careers       a careers link to an openings page, which links Lever → found at depth 2
//   /crawler-fixtures/iframe/careers     an Ashby board in an iframe (with a query string)  → found (iframe), no query kept
//   /crawler-fixtures/embed/careers      a Greenhouse embed iframe ?for=<slug>&token=…      → found; `for` kept, `token` dropped
//   /crawler-fixtures/spa/careers        an empty shell whose script FETCHES the board API  → found only by the browser (network)
//   /crawler-fixtures/challenge/careers  a 403 bot challenge                                 → blocked, never retried
//   /crawler-fixtures/forbidden/…        disallowed by /robots.txt for DraftCrawler          → NEVER requested
//   /crawler-fixtures/ssrf/careers       a 302 into the cloud-metadata address              → refused before the hop
//   /crawler-fixtures/ssrf10/careers     a 302 into a private range                          → refused before the hop
//   /crawler-fixtures/budget/<n>         an endless chain of careers links                   → error: budget
//   /crawler-fixtures/j2/posting/<id>    a posting whose Apply goes via /twoorigin/apply/<id> → a two-origin hop (Amazon's shape)
//   /crawler-fixtures/j2login/posting    a posting whose Apply lands on a sign-in page       → login-wall
// The ATS URLs are external and are never fetched: the worker only RECOGNISES them.
const CRAWLER_ROBOTS = 'User-agent: DraftCrawler\nDisallow: /crawler-fixtures/forbidden/\n\nUser-agent: *\nDisallow:\n';

function crawlerFixtureRoute(req, res, url, send) {
  const p = url.pathname;
  const site = (title, body) => send(200, page(title, body));
  if (p === '/crawler-fixtures/static/careers')
    return site('Acme Static — Careers', '<h1>Careers</h1><p><a href="https://boards.greenhouse.io/acmestatic">See open roles</a></p><p><a href="/about">About</a></p>');
  if (p === '/crawler-fixtures/deep/careers')
    return site('Acme Deep — Careers', '<h1>Life at Acme</h1><p><a href="/crawler-fixtures/deep/openings">Current openings</a></p><p><a href="/crawler-fixtures/deep/blog">Blog</a></p>');
  if (p === '/crawler-fixtures/deep/openings')
    return site('Acme Deep — Openings', '<h1>Openings</h1><a href="https://jobs.lever.co/acmedeep">View all jobs</a><a href="/">Home</a><a href="/x">X</a>');
  if (p === '/crawler-fixtures/iframe/careers')
    return site('Acme Frame — Careers', '<h1>Join us</h1><iframe src="https://jobs.ashbyhq.com/acmeframe/embed?version=2&utm_source=site"></iframe><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>');
  if (p === '/crawler-fixtures/embed/careers')
    return site('Acme Embed — Careers', '<h1>Jobs</h1><iframe src="https://boards.greenhouse.io/embed/job_app?for=acmeembed&amp;token=12345"></iframe><a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>');
  if (p === '/crawler-fixtures/spa/careers')
    return site('Acme SPA', '<div id="root"></div><script>fetch("https://boards-api.greenhouse.io/v1/boards/acmespa/jobs").catch(function(){});</script>');
  if (p === '/crawler-fixtures/challenge/careers') {
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<html><head><title>Just a moment...</title></head><body><div id="cf-chl-widget">Checking your browser — verify you are human</div></body></html>');
  }
  if (p.startsWith('/crawler-fixtures/forbidden/'))
    return site('FORBIDDEN', '<a href="https://boards.greenhouse.io/mustnotbeseen">jobs</a>');
  if (p === '/crawler-fixtures/ssrf/careers') { res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }); return res.end(); }
  if (p === '/crawler-fixtures/ssrf10/careers') { res.writeHead(302, { Location: 'http://10.0.0.5/careers' }); return res.end(); }
  const b = p.match(/^\/crawler-fixtures\/budget\/(?:careers|(\d+))$/);
  if (b) { const n = Number(b[1] || 0) + 1; return site(`Budget ${n}`, `<a href="/crawler-fixtures/budget/${n}">More careers</a><a href="/x">x</a><a href="/y">y</a>`); }
  const j2 = p.match(/^\/crawler-fixtures\/j2\/posting\/(\d+)$/);
  if (j2) return site('Platform Engineer', `<h1>Platform Engineer</h1><p>Job ID ${j2[1]}</p><a href="/twoorigin/apply/${j2[1]}">Apply for this job</a><a href="/">Home</a>`);
  if (p === '/crawler-fixtures/j2login/posting')
    return site('Data Engineer', '<h1>Data Engineer</h1><a href="/crawler-fixtures/j2login/apply">Apply now</a><a href="/">Home</a>');
  if (p === '/crawler-fixtures/j2login/apply')
    return site('Sign in', '<h1>Sign in to apply</h1><form method="post" action="/x"><input name="email"><input type="password" name="password"><button>Sign in</button></form>');
  return send(404, page('Not found', '<h1>404</h1>'));
}
