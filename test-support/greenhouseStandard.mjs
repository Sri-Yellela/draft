/**
 * ⭐ T18 / T23 · the standard Greenhouse form (scripts/fakeAtsGreenhouseStandard.js) as probeFormShape reports it, and a
 * SYNTHETIC candidate whose profile and base résumé hold the answers — shared by the unit tests (no browser) and the
 * real-Chrome test, which asserts the probe of the real page reports exactly these labels.
 *
 * ⛔ SYNTHETIC PEOPLE ONLY: "Avery Testcase" is no one; every value is invented.
 */

/** probeFormShape's fields for /greenhouse-standard — index, id, type, label (as the page names it), widget, options. */
export const GREENHOUSE_FIELDS = Object.freeze([
  { id: 'first_name', type: 'text', label: 'First Name*', required: true, autocomplete: 'given-name' },
  { id: 'last_name', type: 'text', label: 'Last Name*', required: true, autocomplete: 'family-name' },
  { id: 'preferred_name', type: 'text', label: 'Preferred First Name' },
  { id: 'email', type: 'text', label: 'Email*', required: true, autocomplete: 'email' },
  { id: 'country', type: 'text', label: 'Country', widget: 'typeahead' },
  { id: 'phone', type: 'tel', label: 'Phone*', required: true, autocomplete: 'tel' },
  { id: 'candidate-location', type: 'text', label: 'Location (City)*', required: true, widget: 'typeahead' },
  { id: 'resume', type: 'file', label: 'Resume/CV*', required: true },
  { id: 'cover_letter', type: 'file', label: 'Cover Letter' },
  { id: 'school--0', type: 'text', label: 'School*', required: true, widget: 'typeahead' },
  { id: 'degree--0', type: 'select-one', label: 'Degree*', required: true, options: ["Associate's Degree", "Bachelor's Degree", "Master's Degree", 'Master of Business Administration (M.B.A.)', 'Doctor of Philosophy (Ph.D.)', 'Other'] },
  { id: 'discipline--0', type: 'select-one', label: 'Discipline*', required: true, options: ['Computer Science', 'Economics', 'Electrical Engineering', 'Mathematics', 'Physics'] },
  { id: 'start-month--0', type: 'select-one', label: 'Start date month', options: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  { id: 'start-year--0', type: 'number', label: 'Start date year' },
  { id: 'end-month--0', type: 'select-one', label: 'End date month', options: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] },
  { id: 'end-year--0', type: 'number', label: 'End date year' },
  { id: 'question_30001', type: 'text', label: 'LinkedIn Profile' },
  { id: 'question_30002', type: 'text', label: 'Website' },
  { id: 'question_30003', type: 'text', label: 'How did you hear about this job?*', required: true },
  { id: 'question_30004', type: 'textarea', label: 'Why do you want to work at Example Robotics?' },
  { id: 'question_30005', type: 'select-one', label: 'Are you legally authorized to work in the United States?*', required: true, options: ['Yes', 'No'] },
  { id: 'question_30006', type: 'select-one', label: 'Will you now or in the future require sponsorship for employment visa status?*', required: true, options: ['Yes', 'No'] },
  { id: 'gender', type: 'select-one', label: 'Gender', options: ['Male', 'Female', 'Decline To Self Identify'] },
  { id: 'veteran_status', type: 'select-one', label: 'Veteran Status', options: ['I am not a protected veteran', 'I identify as one or more of the classifications of protected veteran', "I don't wish to answer"] },
].map((f, index) => ({ index, name: null, required: false, widget: null, options: null, autocomplete: null, visible: true, hasValue: false, labelSource: 'for', ...f,
  options: f.options ? [{ value: '', text: 'Select...' }, ...f.options.map(o => ({ value: o, text: o }))] : null })));

/** T23's denominator: the standard fields the owner listed (First / Last / Email / Phone / Location / Résumé / Cover
 *  letter / LinkedIn / Website / education). Ids. */
export const STANDARD_IDS = Object.freeze(['first_name', 'last_name', 'email', 'country', 'phone', 'candidate-location', 'resume', 'cover_letter',
  'question_30001', 'question_30002', 'school--0', 'degree--0', 'discipline--0', 'start-month--0', 'start-year--0', 'end-month--0', 'end-year--0']);

/** The synthetic candidate's profile — as server.js buildAutofillPayload shapes it (handler_map / field_map). */
export const SYNTHETIC_PAYLOAD = Object.freeze({
  handler_map: {
    'first-name': 'Avery', 'last-name': 'Testcase', 'full-name': 'Avery Testcase', email: 'avery.testcase@example.com',
    phone: '+1 555 010 0199', city: 'Springfield', state: 'IL', zip: '62701', country: 'United States', location: 'Springfield, IL',
    linkedin: '', github: '', website: '', 'work-auth': '', sponsorship: 'No',
  },
  field_map: { first_name: 'Avery', last_name: 'Testcase', email: 'avery.testcase@example.com', country: 'United States' },
  custom_answers: {},
});

/** The synthetic candidate's base résumé (text, as a user pastes it). */
export const SYNTHETIC_RESUME = `Avery Testcase
Software Engineer
avery.testcase@example.com | (555) 010-0199 | Springfield, IL | linkedin.com/in/avery-testcase | github.com/avery-testcase | averytest.dev

EXPERIENCE
Globex Corporation | Springfield, IL
Senior Software Engineer    Jan 2022 – Present
- Built the scheduling service used by four teams

EDUCATION
State University of Examples | Springfield, IL
B.S. in Computer Science    Aug 2014 – May 2018
`;
