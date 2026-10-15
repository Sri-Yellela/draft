/**
 * ⭐ T18 / T23 · A STANDARD GREENHOUSE APPLICATION — the shape of job-boards.greenhouse.io's own form, for the fake ATS
 * (scripts/fakeAts.js serves it at /greenhouse-standard).
 *
 * Why it exists: the owner's Stripe panel (field report 4, 10-15) read "5 of 43 filled · 38 need you", the résumé and
 * cover-letter uploads shown only as "Attach". The cause is in this markup: Greenhouse's upload is a group whose heading
 * ("Resume/CV *") is a <div> the group names by aria-labelledby, while the input's own <label for> says "Attach". Its
 * pickers are inputs announcing a listbox (role=combobox), not <select>s; its custom questions are `question_<id>`.
 *
 * ⭐ MEASURED 10-15 (docs/LIVE_FORM_MEASUREMENT.md) — read-only, in a real headless Chrome, on Stripe's embedded form
 * (job-boards.greenhouse.io/embed/job_app) and two job-boards.greenhouse.io forms (Discord, Figma). What this file now
 * copies from the live markup, structure only:
 *   · every react-select picker — Country, Location (City), School, Degree, the Yes/No custom questions and the EEO
 *     questions — is `input.select__input[role=combobox][aria-haspopup=true][aria-labelledby=<id>-label]`, and a
 *     REQUIRED one is followed by react-select's backing `<input required tabindex="-1" aria-hidden="true">` (no id, no
 *     name). Those twins were 14 of the 45 fields the probe counted on Stripe; probeFormShape now drops them.
 *   · Degree, the eligibility / sponsorship questions and Gender / Veteran Status are PICKERS, not <select>s;
 *   · a text field has its `<label id="<id>-label" for>` AND an aria-label of the same words without the asterisk;
 *     Phone carries NO autocomplete token (First / Last / Email do); Country is required ("Country*") and sits with
 *     Phone in `<fieldset class="phone-input">` under a visually-hidden legend "Phone";
 *   · the upload: the group's heading div, the "Attach" button and its visually-hidden `<label for>` "Attach", Dropbox,
 *     "Enter manually" (whose `<label for="<id>_text">` names no input), "Accepted file types: …";
 *   · education: `.education--header` is a <p>, not a heading, and the block ends with "Add another";
 *   · the custom questions are a second `.application--questions`; the EEO block is `.eeoc__container` under an <h2>,
 *     not a fieldset; "Locate me" follows the location picker.
 * ⚠ STILL TRANSCRIBED, NOT SEEN LIVE: Discipline and the start / end month and year (none of the three measured forms
 *   asked them — the employer configures the education block); the file name Greenhouse shows after an attach (nothing
 *   was attached to a live form); the options of any live picker (no list was opened). Synthetic employer, synthetic
 *   options; nothing is submitted.
 *
 * Variants (query string):
 *   ?nameless=1   the upload never shows the chosen file's name, and the input is display:none — a custom drop zone,
 *                 so an attach cannot be VERIFIED and the panel must fall back to Download PDF + the name copied.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAR = '<span aria-hidden="true">*</span>';

const label = (id, text, req) => `<label id="${id}-label" for="${id}" class="label">${esc(text)}${req ? STAR : ''}</label>`;
const text = (id, words, { req = false, type = 'text', auto = null } = {}) =>
  `<div class="field-wrapper"><div class="input-wrapper">${label(id, words, req)}<input id="${id}" class="input" aria-label="${esc(words)}" type="${type}"` +
  `${req ? ' aria-required="true"' : ''} maxlength="255"${auto ? ` autocomplete="${auto}"` : ''}></div></div>`;
const select = (id, words, options, { req = false } = {}) =>
  `<div class="select">${label(id, words, req)}<select id="${id}"${req ? ' aria-required="true"' : ''}><option value="">Select...</option>${
    options.map(o => `<option>${esc(o)}</option>`).join('')}</select></div>`;
// The picker: react-select's shape as measured — an input that announces a popup list, then (when required) the
// backing input react-select keeps for the browser's own validation. Options appear as the query is typed; picking one
// shows it as the single value. data-options carries the synthetic list (the live page loads its own).
const picker = (id, words, options, { req = false } = {}) =>
  `<div class="select"><div class="select__container">${label(id, words, req)}<div class="select-shell"><div class="select__control">` +
  `<div class="select__value-container"><div class="select__placeholder" id="react-select-${id}-placeholder">Select...</div>` +
  `<div class="select__single-value" data-value-of="${id}"></div><div class="select__input-container">` +
  `<input class="select__input" id="${id}" type="text" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-haspopup="true"` +
  ` aria-controls="${id}-listbox" aria-labelledby="${id}-label" aria-required="${req ? 'true' : 'false'}" aria-describedby="react-select-${id}-placeholder"` +
  ` data-options="${esc(JSON.stringify(options))}" value=""></div></div>` +
  `<div class="select__indicators"><button type="button" class="icon-button" aria-label="Toggle flyout" tabindex="-1"></button></div></div>` +
  `<div role="listbox" id="${id}-listbox" class="select__menu" hidden></div>` +
  `${req ? '<input required="" tabindex="-1" aria-hidden="true" class="requiredInput" value="">' : ''}</div></div></div>`;
const upload = (id, heading, { req = false, nameless = false } = {}) =>
  `<div class="field-wrapper"><div class="file-upload" role="group" aria-labelledby="upload-label-${id}" aria-required="${req ? 'true' : 'false'}">` +
  `<div id="upload-label-${id}" class="label upload-label">${esc(heading)}${req ? '<span class="required">*</span>' : ''}</div>` +
  `<div class="file-upload__wrapper"><div class="button-container">` +
  `<div class="secondary-button"><div><button type="button" class="btn" data-pick="${id}">Attach</button>` +
  `<label class="visually-hidden" for="${id}">Attach</label><input id="${id}" class="visually-hidden${nameless ? ' gone' : ''}" type="file" accept=".pdf,.doc,.docx,.txt,.rtf"></div></div>` +
  `<div class="secondary-button"><button type="button" class="btn" data-testid="${id}-dropbox">Dropbox</button></div>` +
  `<div class="secondary-button"><div><button type="button" class="btn" data-testid="${id}-text">Enter manually</button><label class="visually-hidden" for="${id}_text">Enter manually</label></div></div>` +
  `<p class="file-upload__filetypes">Accepted file types: pdf, doc, docx, txt, rtf</p></div></div>` +
  `<p class="file-upload__filename" data-filename-of="${nameless ? '' : id}"></p></div></div>`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The fields a standard Greenhouse form asks — T23's denominator (the owner's list: First / Last / Email / Phone /
 *  Location / Résumé / Cover letter / LinkedIn / Website / education). Ids as the page writes them. */
export const STANDARD_FIELD_IDS = Object.freeze(['first_name', 'last_name', 'email', 'country', 'phone', 'candidate-location', 'resume',
  'cover_letter', 'question_30001', 'question_30002', 'school--0', 'degree--0', 'discipline--0', 'start-month--0', 'start-year--0',
  'end-month--0', 'end-year--0']);

export function greenhouseStandardForm({ nameless = false } = {}) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Job Application for Software Engineer at Example Robotics</title>
<style>
 body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;line-height:1.45}
 .label{display:block;margin:14px 0 4px;font-weight:600;font-size:14px}
 .input,select,.select__control input{width:100%;padding:8px;font-size:14px;box-sizing:border-box}
 .visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
 .requiredInput{opacity:0;width:100%;height:1px;position:absolute;pointer-events:none}
 .select{position:relative}
 .gone{display:none}
 .btn{margin:6px 6px 0 0;padding:6px 12px;font-size:13px;border-radius:4px}
 .select__menu{border:1px solid #ccc;margin-top:2px}
 [role="option"]{padding:6px 8px;cursor:pointer}
 fieldset{border:0;padding:0;margin:0}
</style></head><body>
<h1>Software Engineer</h1><p>Example Robotics · Remote (US)</p>
<form id="application-form" class="application--form">
 <div class="application--questions">
  ${text('first_name', 'First Name', { req: true, auto: 'given-name' })}
  ${text('last_name', 'Last Name', { req: true, auto: 'family-name' })}
  ${text('preferred_name', 'Preferred First Name')}
  ${text('email', 'Email', { req: true, auto: 'email' })}
  <div><fieldset class="phone-input"><legend class="visually-hidden">Phone</legend>
   <div class="phone-input__country">${picker('country', 'Country', ['Canada +1', 'India +91', 'United Kingdom +44', 'United States +1'], { req: true })}</div>
   <div class="phone-input__phone">${text('phone', 'Phone', { req: true, type: 'tel' })}</div>
  </fieldset></div>
  <div class="field-wrapper">${picker('candidate-location', 'Location (City)', ['Austin, Texas, United States', 'Boston, Massachusetts, United States',
    'Springfield, Illinois, United States', 'Springfield, Massachusetts, United States', 'Toronto, Ontario, Canada'], { req: true })}<button type="button" class="btn--tertiary">Locate me</button></div>
  ${upload('resume', 'Resume/CV', { req: true, nameless })}
  ${upload('cover_letter', 'Cover Letter', { nameless })}
 </div>
 <div class="education--container"><div class="education--form"><hr><div class="education--header"><p class="body body--medium">Education</p></div>
  ${picker('school--0', 'School', ['Northfield College', 'Riverside Institute of Technology', 'State University of Examples'], { req: true })}
  ${picker('degree--0', 'Degree', ["Associate's Degree", "Bachelor's Degree", "Master's Degree", 'Master of Business Administration (M.B.A.)', 'Doctor of Philosophy (Ph.D.)', 'Other'], { req: true })}
  ${select('discipline--0', 'Discipline', ['Computer Science', 'Economics', 'Electrical Engineering', 'Mathematics', 'Physics'], { req: true })}
  ${select('start-month--0', 'Start date month', MONTHS)}
  ${text('start-year--0', 'Start date year', { type: 'number' })}
  ${select('end-month--0', 'End date month', MONTHS)}
  ${text('end-year--0', 'End date year', { type: 'number' })}
 </div><button class="add-another-button" type="button">Add another</button></div>
 <div class="application--questions"><hr>
  ${text('question_30001', 'LinkedIn Profile')}
  ${text('question_30002', 'Website')}
  ${text('question_30003', 'How did you hear about this job?', { req: true })}
  <div class="field-wrapper"><div class="input-wrapper">${label('question_30004', 'Why do you want to work at Example Robotics?', false)}<textarea id="question_30004" class="input" aria-label="Why do you want to work at Example Robotics?" rows="3"></textarea></div></div>
  <div class="field-wrapper">${picker('question_30005', 'Are you legally authorized to work in the United States?', ['Yes', 'No'], { req: true })}</div>
  <div class="field-wrapper">${picker('question_30006', 'Will you now or in the future require sponsorship for employment visa status?', ['Yes', 'No'], { req: true })}</div>
 </div>
 <div class="eeoc__container body"><div class="divider" role="separator"></div><div><h2 class="section-header">Voluntary Self-Identification</h2>
  <p>For government reporting purposes, we ask candidates to respond to the below self-identification survey. Completion of the form is entirely voluntary.</p></div>
  <div class="eeoc__question__wrapper">${picker('gender', 'Gender', ['Male', 'Female', 'Decline To Self Identify'])}</div>
  <div class="eeoc__question__wrapper">${picker('veteran_status', 'Veteran Status', ['I am not a protected veteran', 'I identify as one or more of the classifications of protected veteran', "I don't wish to answer"])}</div>
 </div>
 <div class="application--submit"><button type="submit" id="submit_app" class="btn">Submit application</button></div>
</form>
<script>
(function () {
  // the picker: options from data-options, filtered by the typed text. Picking behaves as react-select does: the
  // single value shows the option, the typed query is CLEARED, the placeholder goes, and the menu unmounts.
  document.querySelectorAll('input[role="combobox"]').forEach(function (el) {
    var list = document.getElementById(el.getAttribute('aria-controls'));
    var shown = document.querySelector('[data-value-of="' + el.id + '"]');
    var placeholder = document.getElementById('react-select-' + el.id + '-placeholder');
    var all = JSON.parse(el.getAttribute('data-options'));
    function draw() {
      var q = el.value.trim().toLowerCase();
      list.innerHTML = '';
      all.filter(function (o) { return !q || o.toLowerCase().indexOf(q) >= 0; }).forEach(function (o) {
        var li = document.createElement('div'); li.setAttribute('role', 'option'); li.textContent = o;
        li.addEventListener('click', function () {
          shown.textContent = o; el.value = ''; if (placeholder) placeholder.textContent = '';
          list.innerHTML = ''; list.hidden = true; el.setAttribute('aria-expanded', 'false');
        });
        list.appendChild(li);
      });
      list.hidden = false; el.setAttribute('aria-expanded', 'true');
    }
    el.addEventListener('input', function () { setTimeout(draw, 60); });
    el.addEventListener('focus', draw);
  });
  // the upload: Greenhouse writes the chosen file's name under the group (not in the nameless variant)
  document.querySelectorAll('input[type="file"]').forEach(function (el) {
    el.addEventListener('change', function () {
      var p = document.querySelector('[data-filename-of="' + el.id + '"]');
      if (p && el.files && el.files[0]) p.textContent = el.files[0].name;
    });
  });
  document.getElementById('application-form').addEventListener('submit', function (e) { e.preventDefault(); window.__submitted = true; });
})();
</script>
</body></html>`;
}
