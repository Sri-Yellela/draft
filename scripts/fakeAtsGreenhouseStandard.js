/**
 * ⭐ T18 / T23 · A STANDARD GREENHOUSE APPLICATION — the shape of job-boards.greenhouse.io's own form, for the fake ATS
 * (scripts/fakeAts.js serves it at /greenhouse-standard).
 *
 * Why it exists: the owner's Stripe panel (field report 4, 10-15) read "5 of 43 filled · 38 need you", the résumé and
 * cover-letter uploads shown only as "Attach". The cause is in this markup: Greenhouse's upload is a group whose heading
 * ("Resume/CV *") is a <div> the group names by aria-labelledby, while the input's own <label for> says "Attach". Its
 * pickers are inputs announcing a listbox (role=combobox), not <select>s; its custom questions are `question_<id>`.
 *
 * ⚠ SHAPE TRANSCRIBED, NOT MEASURED HERE: the ids (first_name, candidate-location, resume, cover_letter, school--0,
 * degree--0, discipline--0, start-month--0 …, question_<n>) and the upload's group / "Attach" label follow the public
 * job-boards.greenhouse.io form as the field report describes it; re-measure on a live posting (read-only) before
 * treating any one of them as Greenhouse's contract. Synthetic employer, synthetic options; nothing is submitted.
 *
 * Variants (query string):
 *   ?nameless=1   the upload never shows the chosen file's name, and the input is display:none — a custom drop zone,
 *                 so an attach cannot be VERIFIED and the panel must fall back to Download PDF + the name copied.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STAR = '<span aria-hidden="true">*</span>';

const label = (id, text, req) => `<label id="${id}-label" for="${id}" class="label">${esc(text)}${req ? STAR : ''}</label>`;
const text = (id, words, { req = false, type = 'text', auto = null } = {}) =>
  `<div class="input-wrapper">${label(id, words, req)}<input id="${id}" class="input" type="${type}"${req ? ' aria-required="true"' : ''}${auto ? ` autocomplete="${auto}"` : ''}></div>`;
const select = (id, words, options, { req = false } = {}) =>
  `<div class="select">${label(id, words, req)}<select id="${id}"${req ? ' aria-required="true"' : ''}><option value="">Select...</option>${
    options.map(o => `<option>${esc(o)}</option>`).join('')}</select></div>`;
// The picker: an input that announces a listbox (react-select's shape). Options appear as the query is typed; picking
// one shows it as the single value. data-options carries the synthetic list.
const picker = (id, words, options, { req = false } = {}) =>
  `<div class="select__container">${label(id, words, req)}<div class="select__control"><div class="select__single-value" data-value-of="${id}"></div>` +
  `<input id="${id}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-listbox" aria-labelledby="${id}-label"` +
  `${req ? ' aria-required="true"' : ''} data-options="${esc(JSON.stringify(options))}" autocomplete="off"></div>` +
  `<div role="listbox" id="${id}-listbox" class="select__menu" hidden></div></div>`;
const upload = (id, heading, { req = false, nameless = false } = {}) =>
  `<div class="file-upload" role="group" aria-labelledby="upload-label-${id}">` +
  `<div id="upload-label-${id}" class="label upload-label">${esc(heading)}${req ? STAR : ''}</div>` +
  `<div class="file-upload__wrapper"><div class="button-container"><button type="button" class="btn" data-pick="${id}">Attach</button>` +
  `<label for="${id}" class="visually-hidden">Attach</label><input id="${id}" class="visually-hidden${nameless ? ' gone' : ''}" type="file" accept=".pdf,.doc,.docx,.txt,.rtf"${req ? ' aria-required="true"' : ''}></div>` +
  `<button type="button" class="btn">Dropbox</button><button type="button" class="btn">Google Drive</button><button type="button" class="btn">Enter manually</button></div>` +
  `<p class="file-upload__filename" data-filename-of="${nameless ? '' : id}"></p></div>`;

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
 .gone{display:none}
 .btn{margin:6px 6px 0 0;padding:6px 12px;font-size:13px;border-radius:4px}
 .select__menu{border:1px solid #ccc;margin-top:2px}
 [role="option"]{padding:6px 8px;cursor:pointer}
 fieldset{border:0;padding:0;margin:20px 0}
</style></head><body>
<h1>Software Engineer</h1><p>Example Robotics · Remote (US)</p>
<form id="application-form" class="application--form">
 <div class="application--questions">
  ${text('first_name', 'First Name', { req: true, auto: 'given-name' })}
  ${text('last_name', 'Last Name', { req: true, auto: 'family-name' })}
  ${text('preferred_name', 'Preferred First Name')}
  ${text('email', 'Email', { req: true, auto: 'email' })}
  <div class="phone-input">
   ${picker('country', 'Country', ['Canada +1', 'India +91', 'United Kingdom +44', 'United States +1'])}
   ${text('phone', 'Phone', { req: true, type: 'tel', auto: 'tel' })}
  </div>
  ${picker('candidate-location', 'Location (City)', ['Austin, Texas, United States', 'Boston, Massachusetts, United States',
    'Springfield, Illinois, United States', 'Springfield, Massachusetts, United States', 'Toronto, Ontario, Canada'], { req: true })}
  ${upload('resume', 'Resume/CV', { req: true, nameless })}
  ${upload('cover_letter', 'Cover Letter', { nameless })}
 </div>
 <div class="education--container"><h3 class="section-header">Education</h3>
  ${picker('school--0', 'School', ['Northfield College', 'Riverside Institute of Technology', 'State University of Examples'], { req: true })}
  ${select('degree--0', 'Degree', ["Associate's Degree", "Bachelor's Degree", "Master's Degree", 'Master of Business Administration (M.B.A.)', 'Doctor of Philosophy (Ph.D.)', 'Other'], { req: true })}
  ${select('discipline--0', 'Discipline', ['Computer Science', 'Economics', 'Electrical Engineering', 'Mathematics', 'Physics'], { req: true })}
  ${select('start-month--0', 'Start date month', MONTHS)}
  ${text('start-year--0', 'Start date year', { type: 'number' })}
  ${select('end-month--0', 'End date month', MONTHS)}
  ${text('end-year--0', 'End date year', { type: 'number' })}
 </div>
 <div class="custom-questions">
  ${text('question_30001', 'LinkedIn Profile')}
  ${text('question_30002', 'Website')}
  <div class="input-wrapper">${label('question_30003', 'How did you hear about this job?', true)}<input id="question_30003" class="input" type="text" aria-required="true"></div>
  <div class="input-wrapper">${label('question_30004', 'Why do you want to work at Example Robotics?', false)}<textarea id="question_30004" class="input" rows="3"></textarea></div>
  ${select('question_30005', 'Are you legally authorized to work in the United States?', ['Yes', 'No'], { req: true })}
  ${select('question_30006', 'Will you now or in the future require sponsorship for employment visa status?', ['Yes', 'No'], { req: true })}
 </div>
 <fieldset class="eeoc"><legend>Voluntary Self-Identification</legend>
  ${select('gender', 'Gender', ['Male', 'Female', 'Decline To Self Identify'])}
  ${select('veteran_status', 'Veteran Status', ['I am not a protected veteran', 'I identify as one or more of the classifications of protected veteran', "I don't wish to answer"])}
 </fieldset>
 <button type="submit" id="submit_app">Submit application</button>
</form>
<script>
(function () {
  // the picker: options from data-options, filtered by the typed text; picking shows the single value
  document.querySelectorAll('input[role="combobox"]').forEach(function (el) {
    var list = document.getElementById(el.getAttribute('aria-controls'));
    var shown = document.querySelector('[data-value-of="' + el.id + '"]');
    var all = JSON.parse(el.getAttribute('data-options'));
    function draw() {
      var q = el.value.trim().toLowerCase();
      list.innerHTML = '';
      all.filter(function (o) { return !q || o.toLowerCase().indexOf(q) >= 0; }).forEach(function (o) {
        var li = document.createElement('div'); li.setAttribute('role', 'option'); li.textContent = o;
        li.addEventListener('click', function () { shown.textContent = o; el.value = o; list.hidden = true; el.setAttribute('aria-expanded', 'false'); });
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
