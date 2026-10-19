/**
 * T10 rows 5 and 7 (open item 4) · LEVER'S AND WORKABLE'S APPLICATION FORMS, as MEASURED — for the fake ATS
 * (scripts/fakeAts.js serves them at /lever-live and /workable-live), so a real-Chrome walk can FILL each family's real
 * structure (test-support/walks/atsFamilies.mjs). The old /lever form is "Lever-flavoured" plain HTML; these copy what
 * docs/LIVE_FORM_MEASUREMENT.md measured, read-only, on 10-15 (form 4, Palantir on jobs.lever.co; form 6, Hugging Face on
 * apply.workable.com), the same structures test/liveFormMarkup.test.js reproduces in miniature.
 *
 * MEASURED (structure only):
 *   Lever — every question is a WRAPPING <label>: `.application-label` (the words, `✱` when required) then
 *     `.application-field` (the control); the location input carries its dropdown's status text ("No location found…")
 *     inside the same label, beside a hidden `selectedLocation`; the résumé is `input#resume-upload-input[name=resume]
 *     [tabindex=-1]` inside a link whose words are "ATTACH RESUME/CV" with "Couldn't auto-read resume." after it; a select
 *     wrapped in its label; a checkbox group (one box per language); "Name Pronunciation" (NOT an EEO question); "Please
 *     tell us how you heard about this opportunity."; two hCaptcha frames (not reproduced — nothing reads them).
 *   Workable — words in `<span id="…_label"><strong>…</strong></span>` tied by aria-labelledby; the résumé upload: the
 *     svg preview's <label for>, the "Choose file" button-label, `input[data-ui=resume][tabindex=-1]` with
 *     aria-labelledby "<heading> <button>"; questions answered by `role=radio` wrappers over aria-hidden radios; a
 *     select-style combobox followed by its backing `<input name tabindex=-1 aria-hidden=true>`; one required question
 *     of ≈ 330 characters tied by aria-labelledby.
 * ⚠ TRANSCRIBED, NOT SEEN LIVE: the exact order and the field names of the identity block (Lever's `name`, `email`,
 *   `phone`, `org`, `urls[…]`; Workable's `firstname`, `lastname`, …) follow each ATS's public form conventions; the EEO
 *   options; what either page shows after a file is chosen (nothing was attached live). Synthetic employer, synthetic
 *   words; the forms POST to /_submit/<family> and draft never submits.
 */

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STYLE = `<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#222}
label,.q{display:block;margin:14px 0 4px}input,select,textarea{display:block;width:100%;padding:6px;border:1px solid #bbb;border-radius:4px;box-sizing:border-box}
input[type=checkbox],input[type=radio]{display:inline;width:auto}ul{list-style:none;padding:0}button{padding:8px 14px;border-radius:4px}</style>`;
const doc = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${STYLE}</head><body>${body}</body></html>`;

// ── Lever ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const lvText = (name, words, { req = false, type = 'text' } = {}) =>
  `<li class="application-question"><label><div class="application-label">${esc(words)}${req ? ' <span class="required">✱</span>' : ''}</div>` +
  `<div class="application-field"><input type="${type}" name="${esc(name)}"${req ? ' required' : ''}></div></label></li>`;

export function leverLiveForm() {
  return doc('Backend Engineer — Example Labs', `
<div class="posting-headline"><h2>Backend Engineer</h2><div class="sort-by-time posting-category">Remote</div></div>
<form id="application-form" method="POST" action="/_submit/lever-live" enctype="multipart/form-data">
<h4>Submit your application</h4>
<ul>
  <li class="application-question resume"><label><div class="application-label">Resume/CV <span class="required">✱</span></div><div class="application-field">
    <a href="#" class="postings-btn template-btn-utility visible-resume-upload"><span class="filename"></span><span class="default-label">ATTACH RESUME/CV</span>
    <input id="resume-upload-input" name="resume" tabindex="-1" type="file" required></a>
    <span class="resume-upload-failure"><div class="resume-upload-label">Couldn't auto-read resume.</div></span>
    <span class="resume-upload-working"><div class="resume-upload-label">Analyzing resume…</div></span></div></label></li>
  ${lvText('name', 'Full name', { req: true })}
  ${lvText('email', 'Email', { req: true, type: 'email' })}
  ${lvText('phone', 'Phone')}
  <li class="application-question"><label><div class="application-label">Current location <span class="required">✱</span></div><div class="application-field">
    <input class="location-input" id="location-input" type="text" name="location" required><input type="hidden" name="selectedLocation">
    <div class="dropdown-container"><div class="dropdown-results"></div><div class="dropdown-no-results">No location found. Try entering a different location</div></div></div></label></li>
  ${lvText('org', 'Current company')}
</ul>
<h4>Links</h4>
<ul>
  ${lvText('urls[LinkedIn]', 'LinkedIn URL')}
  ${lvText('urls[GitHub]', 'GitHub URL')}
  ${lvText('urls[Portfolio]', 'Portfolio URL')}
</ul>
<h4>Additional questions</h4>
<ul>
  <li class="application-question custom-question"><label><div class="application-label">Please tell us how you heard about this opportunity. <span class="required">✱</span></div>
    <div class="application-field"><textarea name="cards[a1][field0]" required></textarea></div></label></li>
  <li class="application-question custom-question"><label><div class="application-label">Name Pronunciation</div>
    <div class="application-field"><input type="text" name="cards[a1][field1]"></div></label></li>
  <li class="application-question custom-question"><label><div class="application-label">Country of residence</div>
    <div class="application-field"><select name="cards[a1][field2]"><option value="">Select…</option><option>Canada</option><option>United States</option></select></div></label></li>
  <li class="application-question custom-question"><div class="application-label">Which languages do you speak?</div><div class="application-field">
    <label><input type="checkbox" name="cards[a1][field3]" value="English">English</label>
    <label><input type="checkbox" name="cards[a1][field3]" value="Spanish">Spanish</label></div></li>
</ul>
<h4>U.S. Equal Employment Opportunity information</h4>
<p>Completion of this form is voluntary.</p>
<ul>
  <li class="application-question"><label><div class="application-label">Gender</div><div class="application-field"><select name="eeo[gender]"><option value="">Select…</option><option>Female</option><option>Male</option><option>Decline to self-identify</option></select></div></label></li>
  <li class="application-question"><label><div class="application-label">Veteran status</div><div class="application-field"><select name="eeo[veteran]"><option value="">Select…</option><option>I am a veteran</option><option>I am not a veteran</option><option>Decline to self-identify</option></select></div></label></li>
</ul>
<button type="submit" class="postings-btn template-btn-submit">Submit application</button>
</form>
<style>.dropdown-container{display:none}.dropdown-container.open{display:block}.dropdown-no-results{display:none}
.dropdown-container.none .dropdown-no-results{display:block}.dropdown-location{padding:4px 6px;cursor:pointer}</style>
<script>
// ⚠ TRANSCRIBED, NOT SEEN LIVE (no list was opened on 10-15): Lever's location box BEHAVES as a picker — typing shows
// suggestions, and only a PICKED one counts (it lands in the hidden selectedLocation); typing again un-picks it. The
// suggestion wording here is synthetic.
(function () {
  var PLACES = ['Springfield, IL, United States', 'Springfield, MA, United States', 'Springfield, MO, United States',
    'Boston, MA, United States', 'Austin, TX, United States'];
  var input = document.getElementById('location-input'), hidden = document.querySelector('input[name="selectedLocation"]');
  var box = input.parentNode.querySelector('.dropdown-container'), results = box.querySelector('.dropdown-results');
  input.addEventListener('input', function () {
    hidden.value = '';
    var q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { box.className = 'dropdown-container'; return; }
    setTimeout(function () {                                   // the lookup answers a beat later, as a server would
      var hits = PLACES.filter(function (p) { return p.toLowerCase().indexOf(q) === 0; });
      results.innerHTML = '';
      hits.forEach(function (p) {
        var d = document.createElement('div'); d.className = 'dropdown-location'; d.textContent = p;
        d.addEventListener('mousedown', function (e) {
          e.preventDefault();
          input.value = p; hidden.value = JSON.stringify({ name: p }); box.className = 'dropdown-container';
        });
        results.appendChild(d);
      });
      box.className = 'dropdown-container open' + (hits.length ? '' : ' none');
    }, 150);
  });
})();
</script>`);
}

// ── Workable ────────────────────────────────────────────────────────────────────────────────────────────────────────
const wkText = (id, words, { req = false, type = 'text', tag = 'input' } = {}) =>
  `<div class="field" data-ui="${id}"><label for="${id}" id="${id}_label"><span><strong>${esc(words)}</strong></span>${req ? '<span><strong>*</strong></span>' : ''}</label>` +
  (tag === 'textarea'
    ? `<textarea id="${id}" name="${id}" aria-labelledby="${id}_label"${req ? ' required aria-required="true"' : ''}></textarea>`
    : `<input id="${id}" name="${id}" type="${type}" aria-labelledby="${id}_label"${req ? ' required aria-required="true"' : ''}>`) + '</div>';
const LONG_Q = 'Tell us about a system you designed end to end — the problem it solved, the constraints you worked within, the ' +
  'trade-offs you made between consistency, latency and cost, how you measured whether it worked once it was in front of ' +
  'real users, and what you would change about it if you were to build it again today with what you know now.';

export function workableLiveForm() {
  return doc('Backend Engineer — Example Labs', `
<h2>Backend Engineer</h2>
<form id="workable-form" method="POST" action="/_submit/workable-live" enctype="multipart/form-data">
<section><h3>Personal information</h3>
  ${wkText('firstname', 'First name', { req: true })}
  ${wkText('lastname', 'Last name', { req: true })}
  ${wkText('email', 'Email', { req: true, type: 'email' })}
  ${wkText('headline', 'Headline')}
  ${wkText('phone', 'Phone', { type: 'tel' })}
  ${wkText('address', 'Address')}
</section>
<section><h3>Profile</h3>
  <div class="field"><span><strong>*</strong></span><span id="up_label"><strong>Resume</strong></span>
    <div data-role="dropzone"><div data-role="preview"><label for="input_files_input_r1"><svg width="10" height="10"><text>SVGs not supported by this browser.</text></svg></label></div>
    <div><label tabindex="0" role="button" for="input_files_input_r1" id="description_input_r1" aria-describedby="up_label">Choose file</label> <span>or drag and drop here</span></div>
    <input data-ui="resume" tabindex="-1" id="input_files_input_r1" name="resume" type="file" aria-labelledby="up_label description_input_r1" required></div></div>
  ${wkText('cover_letter', 'Cover letter', { tag: 'textarea' })}
</section>
<section><h3>Details</h3>
  <div class="field"><span id="qa_start_label"><strong>Can you start within a month?</strong></span>
    <fieldset role="radiogroup" aria-labelledby="qa_start_label">
      <div role="radio" aria-checked="false" tabindex="0"><label><input id="qa_start_y" tabindex="-1" aria-hidden="true" type="radio" name="QA_start" value="true"><div><span>YES</span></div></label></div>
      <div role="radio" aria-checked="false" tabindex="-1"><label><input id="qa_start_n" tabindex="-1" aria-hidden="true" type="radio" name="QA_start" value="false"><div><span>NO</span></div></label></div>
    </fieldset></div>
  <div class="field"><span id="qa_long_label"><strong>${esc(LONG_Q)}</strong></span><span><strong>*</strong></span>
    <textarea id="qa_long" name="QA_long" aria-labelledby="qa_long_label" required aria-required="true"></textarea></div>
  <div class="field"><span id="qa_src_label"><strong>How did you hear about us?</strong></span>
    <div class="select-wrapper"><input id="qa_src" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-labelledby="qa_src_label" autocomplete="off"></div>
    <input name="QA_src" tabindex="-1" aria-hidden="true" value=""></div>
</section>
<button type="submit" data-ui="apply-button">Submit application</button>
</form>`);
}
