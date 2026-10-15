// ── ⭐ T18 · FIELD SEMANTICS — what a field on an application form IS (owner, field report 4, 10-15) ─────────────────
//
// The owner's Stripe / Greenhouse panel read "5 of 43 filled · 38 need you": Location (City) "Nothing in your profile
// yet", School the same, the résumé and cover-letter uploads shown only as "Attach", and an "Unlabelled field 1". The
// profile and the base résumé held most of those answers — the extension could not tell which field was which. This
// module is that classification, in ONE place:
//
//   semanticKeyOf(field)      the field's vocabulary key — the SAME string as the packet answer's `handler_type`
//                             (services/applyGatePacket.js CANONICAL_GATE_FIELDS), so a field and an answer meet by key
//   classifyFields(fields)    every field's key, with the one context rule (an "End date year" in the education block is
//                             the graduation year; in an employment block it is nothing we answer)
//   fileTypeOf(field)         an upload is a `resume`, a `cover_letter`, or `other`
//   guessLabelOf(attrs)       a best-guess label from name / id / data-* tokens — the LAST resort before "Unlabelled"
//
// ⛔ THE VOCABULARY NEVER COVERS AN ATTESTATION. Eligibility, sponsorship, EEO, consent, opt-in and screening questions
//   have no key here — whatever their words — so nothing in this module can place a value on one. Those are answered by
//   an exact control match or the candidate's own saved answer (gated-handoff.js matchAnswersToFields, D55 / D96), or
//   they are the candidate's. A label the caller's questionKind() reads as anything but 'other' gets null.
// ⛔ ANCHORED, NOT KEYWORDS. A label is matched WHOLE (after the "*", "(required)" and punctuation are set aside): "City"
//   and "Location (City)" are the city; "City of birth" is not; "Will you relocate to this city?" is not.
// ⛔ Pure — no DOM, no storage, no network. The page is read by probeFormShape (gated-handoff.js), which reports the
//   label it resolved, where it came from, and the raw attributes; this module only reads those.

/** Normalised text: lower case, "(required)" / "(optional)" and every non-alphanumeric run to one space. */
export const normText = (s) => String(s ?? '').toLowerCase()
  .replace(/\(\s*(?:required|optional)\s*\)/g, ' ').replace(/[’']/g, '').replace(/[^a-z0-9+]+/g, ' ').trim();

/**
 * The vocabulary. `label` is tested against the WHOLE normalised label; `attr` against each normalised attribute token
 * (a name's last bracket segment, an id, a data-automation-id — with Greenhouse's "--0" entry suffix removed);
 * `auto` lists the HTML autocomplete tokens that name the key. `choiceOnly`: placed only on a control with choices.
 */
export const FIELD_VOCABULARY = Object.freeze([
  { key: 'first-name', label: /^(legal )?first( name)?$|^given name$|^forename$|^first name legal$/, attr: /^(first ?name|fname|given ?name|firstname)$/, auto: ['given-name'] },
  { key: 'last-name', label: /^(legal )?(last name|surname|family name)$|^last name legal$/, attr: /^(last ?name|lname|surname|family ?name|lastname)$/, auto: ['family-name'] },
  { key: 'full-name', label: /^(your |full |legal |full legal )?name$/, attr: /^(full ?name|fullname)$/, auto: ['name'] },
  { key: 'email', label: /^(your )?e ?mail( address)?$/, attr: /^(e ?mail|email ?address)$/, auto: ['email'] },
  { key: 'phone', label: /^(your )?(phone|mobile|cell|telephone|mobile phone|cell phone)( number| no)?$/, attr: /^(phone|phone ?number|mobile|telephone|tel)$/, auto: ['tel', 'tel-national'] },
  { key: 'phone-country', label: /^(phone )?country ?code$|^(phone )?dial(l)?ing code$|^country phone code$/, attr: /^(country ?phone ?code|phone ?country( ?code)?|dial ?code)$/, auto: ['tel-country-code'] },
  { key: 'address1', label: /^(street |home |mailing )?address( line)?( 1)?$|^street$/, attr: /^(address ?1|address ?line ?1|street ?address)$/, auto: ['address-line1', 'street-address'] },
  { key: 'address2', label: /^address( line)? 2$|^(apt|apartment|suite|unit)( suite| number| no)?$/, attr: /^(address ?2|address ?line ?2)$/, auto: ['address-line2'] },
  { key: 'city', label: /^(current )?city$|^location city$|^city town$|^town city$|^city of residence$|^current location city$/, attr: /^(city|address ?city|addresssection ?city)$/, auto: ['address-level2'] },
  { key: 'state', label: /^(state|province|state province|province state|state region|region)( of residence)?$/, attr: /^(state|province|region)$/, auto: ['address-level1'] },
  { key: 'zip', label: /^(zip|postal|zip postal|postal zip)( code)?$|^postcode$/, attr: /^(zip|zip ?code|postal ?code|postcode)$/, auto: ['postal-code'] },
  { key: 'country', label: /^country( of residence| region)?$/, attr: /^(country|country ?region)$/, auto: ['country', 'country-name'] },
  { key: 'location', label: /^(current )?location$|^where are you (currently )?(located|based)$|^city (and|) ?state$|^current (city|location) and state$|^location city state$/, attr: /^(location|current ?location)$/, auto: [] },
  { key: 'linkedin', label: /^(your )?linked ?in( profile)?( url| link| profile url| profile link)?$/, attr: /^linked ?in( ?url| ?profile)?$/, auto: [] },
  { key: 'github', label: /^(your )?git ?hub( profile)?( url| link| profile url)?$/, attr: /^git ?hub( ?url| ?profile)?$/, auto: [] },
  { key: 'website', label: /^(your |personal )?(website|web site|homepage|personal site|blog)( url| link)?$/, attr: /^(website|web ?site|website ?url|homepage)$/, auto: ['url'] },
  { key: 'portfolio', label: /^(your )?portfolio( url| link| website)?$/, attr: /^portfolio( ?url)?$/, auto: [] },
  { key: 'current-company', label: /^(current|most recent|present)( company| employer)( name)?$|^current company name$/, attr: /^current ?(company|employer)$/, auto: ['organization'] },
  { key: 'current-title', label: /^(current|most recent|present)( job)? (title|position|role)$/, attr: /^current ?(job ?)?title$/, auto: ['organization-title'] },
  { key: 'school', label: /^(school|university|college|institution|school name|name of school|school or university|university name|college university|educational institution)$/, attr: /^(school|university|college|school ?name)$/, auto: [] },
  { key: 'degree', label: /^(degree|degree type|type of degree|highest degree( earned| obtained)?|degree level|education level|level of education|highest level of education( completed)?)$/, attr: /^(degree|degree ?type)$/, auto: [] },
  { key: 'field-of-study', label: /^(discipline|major|field of study|area of study|study field|concentration|major field of study)$/, attr: /^(discipline|major|field ?of ?study)$/, auto: [] },
  { key: 'grad-year', label: /^(graduation year|year of graduation|grad year|expected graduation year|graduation date year)$/, attr: /^(grad(uation)? ?year)$/, auto: [] },
  { key: 'how-heard', label: /^how did you (hear|learn|find out) about (us|this (job|role|position|opportunity)|the (job|role|position|opportunity)|[a-z0-9 ]{1,40})$|^how did you find (us|this (job|role|position))$|^(referral )?source$|^where did you (hear|learn) about (us|this (job|role|position))$/, attr: /^(source|how ?did ?you ?hear|referral ?source)$/, auto: [] },
  { key: 'preferred-name', label: /^preferred( first)? name$|^nickname$/, attr: /^preferred ?(first ?)?name$/, auto: ['nickname'] },
]);

/**
 * A packet answer's key when it carries no `handler_type` (a packet prepared before T18 stored none): the canonical
 * answer NAMES (services/applyGatePacket.js CANONICAL_GATE_FIELDS) → vocabulary keys. ⛔ No eligibility name is here.
 */
export const CANONICAL_NAME_KEYS = Object.freeze({
  first_name: 'first-name', last_name: 'last-name', full_name: 'full-name', email: 'email', phone: 'phone', address1: 'address1',
  city: 'city', state: 'state', zip: 'zip', country: 'country', location: 'location', linkedin: 'linkedin', website: 'website',
  github: 'github', portfolio: 'portfolio', current_company: 'current-company', current_title: 'current-title', school: 'school',
  degree: 'degree', discipline: 'field-of-study', graduation_year: 'grad-year',
});

// The education block's dates — keyed only where the block they sit in is the education block (classifyFields).
const DATE_PART = /^(start|end|from|to)( date)? (year|month)$|^(start|end) (year|month)$/;
const EDUCATION_KEYS = new Set(['school', 'degree', 'field-of-study']);
const EMPLOYMENT_KEYS = new Set(['current-company', 'current-title']);
const EMPLOYMENT_LABEL = /^(company( name)?|employer|title|job title|position)$/;

/** The attribute tokens of a field: a name's last bracket segment, the id, the automation id — "--0" removed. */
export function attrTokens(f = {}) {
  const segs = (n) => String(n || '').split(/[[\]]+/).map(s => s.trim()).filter(Boolean);
  const raw = [segs(f.name).pop(), f.id, f.automationId].filter(Boolean);
  return raw.map(t => normText(String(t).replace(/--\d+$/, '').replace(/[-_]\d+$/, '').replace(/([a-z])([A-Z])/g, '$1 $2')))
    .filter(t => t && !/^(question|field|input|q|job application)( [0-9a-f]+)*$/.test(t));
}

/**
 * The field's vocabulary key, or null. `kindOf` is gated-handoff.js questionKind — a label it reads as eligibility,
 * EEO, consent, opt-in or screening is never given a key.
 */
export function semanticKeyOf(f = {}, { kindOf = () => 'other' } = {}) {
  if (!f || f.type === 'file' || f.type === 'password' || f.type === 'hidden') return null;
  const label = f.label || '';
  // A radio or checkbox's own label is its OPTION ("Yes"); the question is its group — and those are never vocabulary.
  if (f.type === 'radio' || f.type === 'checkbox') return null;
  if (label && kindOf(label) !== 'other') return null;
  const t = normText(label);
  if (t) {
    const hit = FIELD_VOCABULARY.find(v => v.label.test(t));
    if (hit) return hit.key;
  }
  const auto = String(f.autocomplete || '').toLowerCase().split(/\s+/).filter(Boolean);
  const byAuto = FIELD_VOCABULARY.find(v => v.auto.some(a => auto.includes(a)));
  if (byAuto) return byAuto.key;
  // The attributes speak only when the page wrote no words of its own — a label it DID write wins, even unmatched.
  if (!t) {
    for (const tok of attrTokens(f)) {
      const hit = FIELD_VOCABULARY.find(v => v.attr.test(tok));
      if (hit) return hit.key;
    }
  }
  return null;
}

/**
 * Every field's key (an array parallel to `fields`). One context rule beyond semanticKeyOf: a bare "Start date year" /
 * "End date year" is the education block's when the nearest keyed field above it is School / Degree / Discipline —
 * then the end year is the graduation year ('grad-year') and the start year 'start-year'; under an employer it is
 * left alone (nothing here answers an employment date on a flat form).
 */
export function classifyFields(fields = [], opts = {}) {
  let block = null;
  return (fields || []).map((f) => {
    const key = semanticKeyOf(f, opts);
    if (key) {
      if (EDUCATION_KEYS.has(key)) block = 'education';
      else if (EMPLOYMENT_KEYS.has(key)) block = 'employment';
      return key;
    }
    const t = normText(f?.label || '');
    if (EMPLOYMENT_LABEL.test(t)) { block = 'employment'; return null; }
    const m = DATE_PART.exec(t);
    if (m && block === 'education') {
      const end = /^(end|to)/.test(t);
      const year = /year$/.test(t);
      return end ? (year ? 'grad-year' : 'grad-month') : (year ? 'start-year' : 'start-month');
    }
    return null;
  });
}

// ⛔ BYTE-IDENTICAL to gated-handoff.js resumeInputScore (and so to applyPlan's and resumePanel.js's copies): what names
// an upload as a résumé. A test asserts the copies agree.
function resumeInputScore(context) {
  const t = String(context || '').toLowerCase();
  if (/cover[\s_-]*letter|motivation|transcript|portfolio|writing sample|photo|headshot|certificat|reference|supporting|additional/.test(t)) return -1;
  if (/r[ée]sum[ée]|\bcv\b|curriculum vitae/.test(t)) return 2;
  return 0;
}

/** An upload's type: 'resume' · 'cover_letter' · 'other' — from its label (the group's heading included), then its attributes. */
export function fileTypeOf(f = {}) {
  if (f?.type !== 'file') return null;
  // ⛔ Not raw.near — the nearest words of an unnamed box can be a NEIGHBOUR's heading; they are for Show details only.
  const ctx = [f.label, f.guess, f.name, f.id, f.automationId, f.raw?.aria].filter(Boolean).join(' ');
  if (/cover[\s_-]*letter|letter of motivation|motivation letter|coverletter/i.test(ctx)) return 'cover_letter';
  return resumeInputScore(ctx) === 2 ? 'resume' : 'other';
}

/**
 * The best-guess label from attribute tokens, for a field the page wrote no words for: "candidate-location" →
 * "Candidate location", "job_application[phone]" → "Phone". '' when the tokens say nothing (a generated id).
 */
export function guessLabelOf(f = {}) {
  for (const tok of attrTokens(f)) {
    if (!/[a-z]{3,}/.test(tok) || /^[0-9a-f ]{6,}$/.test(tok) || tok.length > 40) continue;
    const words = tok.split(' ').filter(Boolean);
    if (words.some(w => /\d{3,}/.test(w))) continue;
    const s = words.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return '';
}

/**
 * ⭐ T24's gate for the résumé row's "Generate and attach" — the account's setting (intentSettings.js, read by the fill):
 * "In a manual fill: offer a résumé on cue (default) / never". Never offered when a tailored résumé is already ready
 * for this job, or one is being made (join it, never start a second).
 */
export function offerGenerateOnCue({ setting = 'on_cue', tailoredReady = false, inFlight = false } = {}) {
  if (setting === 'never') return false;
  return !tailoredReady && !inFlight;
}
