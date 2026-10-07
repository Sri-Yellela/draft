/**
 * ⛔ D59 part 4 · CITIZENSHIP AND CLEARANCE ARE FIRST-CLASS FACTS — SURFACED, NEVER DECIDED.
 *
 * Postings state hard eligibility constraints that no score captures. This reads them out of the
 * posting's own words (the label block's values first, then its prose) into a closed vocabulary:
 *
 *   citizenship   citizen_only  "U.S. citizenship is required, as only U.S. citizens are eligible…"
 *                 us_person     "U.S. citizen or national, permanent resident, refugee or asylee"
 *                               (export-control wording — ITAR / EAR)
 *                 none_stated   the posting says neither
 *                 ⛔ citizen_only and us_person are DIFFERENT facts and are never collapsed — and BOTH
 *                    exclude F-1 / OPT and H-1B holders.
 *   clearance     none · public_trust · secret · top_secret · ts_sci       (+ polygraph, a flag)
 *   status        active_required · interim_ok · ability_to_obtain · null
 *
 * WHERE IT SHOWS: a muted Requirements row of status pills under the posting's deck strip (D48's rule:
 * non-interactive), a board filter that hides these roles, and a notice at Draft. ⛔ NEVER folded into
 * the ATS score, and ⛔ the product NEVER answers or infers the CANDIDATE's eligibility — the apply
 * resolver stays exact-or-blank (D36). `statedEligibility` below only says whether the user's profile
 * STATES an answer; it never says what the answer means for this role.
 *
 * ⛔ D17: regex over the posting's own text. Shared so the ingest pass and the panel agree.
 */

export const CITIZENSHIP = Object.freeze(["citizen_only", "us_person", "none_stated"]);
// `unspecified`: the posting says a clearance is required ("CLEARANCE TYPE: Polygraph", "must be able
// to obtain a security clearance") and names no level — said as "Clearance required", never guessed.
export const CLEARANCE_LEVELS = Object.freeze(["none", "unspecified", "public_trust", "secret", "top_secret", "ts_sci"]);
export const CLEARANCE_STATUSES = Object.freeze(["active_required", "interim_ok", "ability_to_obtain"]);

// Sentences — without splitting "U.S." or "e.g." in two.
function sentences(text) {
  return String(text || "")
    .split(/(?<=[.!?;])(?<!\b[A-Z]\.)(?<!\b(?:e\.g|i\.e|etc|vs|Inc|Jr|Sr|St|Mr|Mrs|Ms|Dr|No|approx)\.)\s+(?=[A-Z(•])|\n+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// ── CITIZENSHIP ──────────────────────────────────────────────────────────────────────────────────
const MENTIONS_CITIZEN = /\bcitizen(?:s|ship)?\b|\bU\.?\s?S\.?\s+persons?\b|\bpermanent residen|\bgreen card\b|\basylee|\brefugee/i;
const REQUIREMENT_WORDS = /\b(?:must|required?|requires|requirement|only|eligib\w*|need(?:ed|s)?|mandatory|necessary|limited to|restricted to|open to)\b/i;
// EEO and anti-discrimination boilerplate names citizenship as a protected status, not a requirement.
const BOILERPLATE = /without regard|regardless of|discriminat|protected (?:class|characteristic|status|veteran)|equal (?:employment )?opportunit|affirmative action|\bE-?Verify\b/i;
// The export-control "U.S. person" set — any of these beside citizenship widens it past citizens only.
const US_PERSON_MARKERS = /\bpermanent residen|\bgreen card\b|\basylee|\basylum\b|\brefugee|\bU\.?\s?S\.?\s+persons?\b|\b(?:citizen|citizens)\s+(?:or|and|\/)\s+(?:a\s+)?(?:U\.?\s?S\.?\s+)?nationals?\b|\bnationals?\b|\blawful(?:ly)?\s+(?:admitted|permanent)|\bITAR\b|\bEAR\b|\bexport[- ]control/i;
const CITIZEN_REQ = /\b(?:U\.?\s?S\.?|United States|American)\s+citizen(?:s|ship)?\b|\bcitizen(?:s|ship)?\s+of\s+the\s+(?:U\.?\s?S\.?|United States)\b|\bcitizenship\b/i;

/** One sentence's verdict, or null when it states nothing about citizenship. */
function citizenshipOfSentence(s) {
  if (!MENTIONS_CITIZEN.test(s) || BOILERPLATE.test(s) || !REQUIREMENT_WORDS.test(s)) return null;
  if (US_PERSON_MARKERS.test(s) && (/\bcitizen/i.test(s) || /\bU\.?\s?S\.?\s+persons?\b/i.test(s))) return "us_person";
  if (CITIZEN_REQ.test(s)) return "citizen_only";
  return null;
}

/** The strictest stated requirement: citizen_only over us_person over none_stated. */
export function classifyCitizenship(...texts) {
  let best = "none_stated";
  for (const t of texts) {
    for (const s of sentences(t)) {
      const v = citizenshipOfSentence(s);
      if (v === "citizen_only") return "citizen_only";
      if (v === "us_person") best = "us_person";
    }
  }
  return best;
}

// ── CLEARANCE ────────────────────────────────────────────────────────────────────────────────────
const CLEARANCE_CONTEXT = /\bclearance\b|\bpolygraph\b|\bpublic trust\b|\bTS\s*\/\s*SCI\b|\bsecret\b/i;
const NOT_REQUIRED = /\bno\s+(?:security\s+)?clearance\b|\bclearance\s*(?::|is)?\s*(?:not\s+(?:required|applicable|needed)|none|n\/?a)\b|^(?:none|n\/?a|not applicable|not required|no)\.?$/i;
const PREFERRED = /\bprefer|\bdesir|\ba plus\b|\bnice[- ]to[- ]haves?\b|\bbonus\b|\bhighly regarded\b/i;
// A run-on bullet list ("…an active TS security clearance Ideally You'd Have: • 2+ years…") carries the
// requirement and the wish list in one "sentence". A header that opens the wish list cuts it: only the
// words BEFORE it are read as required (10-07, found by the local backfill).
// It is a header only when a colon follows closely: "experience, ideally in government environments" is
// an ordinary word, and reading it as a header hid every requirement after it (10-07, the backfill).
const PREFERRED_HEADER = /\b(?:ideally|nice[- ]to[- ]haves?|preferred\s+(?:qualifications|skills|experience)|bonus(?:\s+points)?|plus(?:es)?|(?:may|might) also have)\b(?=[^.:;]{0,40}:)/i;
// A heading line that opens a wish list ("Nice to haves:", "Bonus", "Strong candidates may also have:").
const WISH_HEADING = /^[\s•*-]*(?:nice[- ]to[- ]haves?|ideally|preferred|bonus|plus(?:es)?)\b|\b(?:may|might) also have\b/i;
// "(Top Secret preferred)" — a preference in parentheses qualifies only itself, not the requirement beside it.
const PREFERRED_ASIDE = /\([^)]*\b(?:prefer\w*|nice[- ]to[- ]haves?|a plus|desir\w*|bonus)\b[^)]*\)/gi;
// "public trust" is also ordinary English ("…strengthen model reliability and public trust"). It is a
// clearance only beside the words that make it one — a clearance, a background investigation, a tier,
// a position of public trust (10-07, a false positive on the local board).
// A short line that is only a heading ("Nice to haves:", "Must Haves:", "What You'll Do") — and a
// sentence that opens a requirements section, which ends any wish list before it.
const HEADING_LINE = /^[\s•*-]*[A-Za-z][\w'’ ,&/()-]{0,50}:\s*$|^[\s•*-]*(?:nice[- ]to[- ]haves?|ideally[\w'’ ]{0,30}|preferred(?: qualifications| skills| experience)?|bonus(?: points)?|[\w ]{0,30}(?:may|might) also have)\s*$/i;
const REQUIRED_LEAD = /^[\s•*-]*(?:must[- ]haves?|requirements?|required|minimum|basic qualifications|what you(?:'|’)?ll need|you (?:have|bring|will need))\b/i;
const POLYGRAPH_WISHED = /\b(?:polygraph|poly)\b[^.;•]{0,30}\b(?:nice[- ]to[- ]have|prefer\w*|a plus|desir\w*|bonus)\b/i;
const PUBLIC_TRUST_CLEARANCE =/\bpublic trust\b\W*(?:\w+\W+){0,3}?(?:clearance|background|investigation|position|suitability|eligib)|\b(?:tier\s*\d|high[- ]risk|moderate[- ]risk|position of)\W+(?:\w+\W+){0,2}?public trust\b/i;
const LEVEL_RULES = [
  ["ts_sci",       /\bTS\s*\/\s*SCI\b|\btop[- ]secret\s*\/\s*(?:SCI|sensitive compartmented)|\bSCI\b/i],
  ["top_secret",   /\btop[- ]secret\b|\bTS\b(?=\s*(?:clearance|security|level|\/|\(|,|$))/i],
  ["secret",       /\bsecret\b/i],
  ["public_trust", /\bpublic trust\b/i],
];
const RANK = { none: 0, unspecified: 0.5, public_trust: 1, secret: 2, top_secret: 3, ts_sci: 4 };
const POLYGRAPH = /\bpolygraph\b|\b(?:CI|FS|full[- ]scope|lifestyle)\s*poly\b|\bpoly(?:graph)?\s*(?:required|exam)/i;

function levelOf(s) {
  for (const [level, re] of LEVEL_RULES) if (re.test(s)) return level;
  return null;
}

/**
 * The level ONE sentence requires. When it names several — "at least an active Secret clearance and the
 * willingness to up-level to TS/SCI", "an active Secret or TS/SCI clearance" — the requirement is the
 * LOWEST: the others are what it may grow into, or alternatives that also satisfy it. Each match is cut
 * out before the next rule runs, so "Top Secret" is not also read as "Secret".
 */
function requiredLevelOf(s) {
  let rest = String(s), lowest = null;
  for (const [level, re] of LEVEL_RULES) {
    if (!re.test(rest)) continue;
    if (level === "public_trust" && !PUBLIC_TRUST_CLEARANCE.test(rest)) continue;
    rest = rest.replace(new RegExp(re.source, "gi"), " ");
    lowest = level;
  }
  return lowest;
}

/** The status, most permissive mention first: the ability to obtain, then interim, then active. */
export function clearanceStatusOf(...texts) {
  const t = texts.filter(Boolean).join(" \n ");
  if (!t.trim()) return null;
  if (/\b(?:ability|able|eligib\w*)\s+to\s+(?:obtain|acquire|get|be granted)\b|\bobtain\s+and\s+maintain\b|\beligible\s+for\s+(?:a\s+)?(?:\w+\s+){0,3}clearance\b|\bclearance\s+(?:is\s+)?not required (?:to|at|for) start\b/i.test(t)) return "ability_to_obtain";
  if (/\binterim\b/i.test(t)) return "interim_ok";
  if (/\bactive\b|\bcurrent(?:ly)?\b|\bexisting\b|\bmust\s+(?:have|possess|hold)\b|\b(?:possess|hold)\s+(?:an?\s+)?(?:active\s+)?(?:\w+\s+){0,3}clearance\b|\brequired\s+(?:on|at|by|prior to|before)\s+(?:day\s*(?:1|one)|start)\b|\bday\s*(?:1|one)\b|^yes\b/i.test(t)) return "active_required";
  return null;
}

/**
 * The posting's clearance: the label values when the posting gave them, else its prose.
 * @returns {{ level: string, status: string|null, polygraph: boolean }}
 */
export function classifyClearance({ typeValue = null, statusValue = null, atStartValue = null, text = "" } = {}) {
  let level = null, polygraph = false;
  // The label's type wins over the prose — it is the employer's own field.
  const typed = typeValue ? String(typeValue).trim() : "";
  if (typed && !NOT_REQUIRED.test(typed)) {
    level = levelOf(typed);
    if (POLYGRAPH.test(typed)) polygraph = true;
    // "CLEARANCE TYPE: Polygraph" says a clearance IS required without naming its level. ⛔ The level
    // is not guessed (a polygraph usually rides on TS/SCI — "usually" is not a fact about this posting).
    if (!level) level = "unspecified";
  }
  let status = statusValue && !NOT_REQUIRED.test(String(statusValue).trim()) ? clearanceStatusOf(statusValue) : null;
  // "CLEARANCE REQUIRED FOR START: Yes" — it must be held at the start; "No" — it can follow.
  if (atStartValue) {
    if (/^\s*yes\b/i.test(atStartValue)) { status = status ?? "active_required"; if (!level && !typed) level = "unspecified"; }
    else if (/^\s*no\b/i.test(atStartValue)) status = status ?? "ability_to_obtain";
  }
  const proseStatus = [];
  // A wish-list heading on its own line ("Nice to haves:") covers the bullets beneath it, until the next
  // heading — those bullets are separate "sentences" and would otherwise be read as required.
  let inWishList = false;
  for (const whole of sentences(text)) {
    if (HEADING_LINE.test(whole)) { inWishList = WISH_HEADING.test(whole); continue; }
    if (REQUIRED_LEAD.test(whole)) inWishList = false;
    if (inWishList) continue;
    const cut = whole.search(PREFERRED_HEADER);
    const s = (cut >= 0 ? whole.slice(0, cut) : whole).replace(PREFERRED_ASIDE, " ");
    if (cut >= 0) inWishList = true;
    if (!CLEARANCE_CONTEXT.test(s) || PREFERRED.test(s) || BOILERPLATE.test(s)) continue;
    // A bare "secret" is not a clearance ("our secret sauce"): the sentence has to name one.
    if (!/\bclearance\b|\bTS\s*\/\s*SCI\b|\bpolygraph\b/i.test(s) && !PUBLIC_TRUST_CLEARANCE.test(s)) continue;
    if (NOT_REQUIRED.test(s)) continue;
    // "(Full Scope Polygraph is a nice to have)" — the clearance is required, the polygraph is not.
    if (POLYGRAPH.test(s) && !POLYGRAPH_WISHED.test(whole)) polygraph = true;
    const l = requiredLevelOf(s);
    if (!typed && l && (level == null || RANK[l] > RANK[level])) level = l;
    // "An active US security clearance." — a requirement bullet with no level named.
    else if (!typed && !l && !level && /\bsecurity clearance\b/i.test(s) && (REQUIREMENT_WORDS.test(s) || /\b(?:active|hold|possess|maintain)\b/i.test(s))) level = "unspecified";
    if (l || /\bsecurity clearance\b/i.test(s)) proseStatus.push(s);
  }
  if (polygraph && !level) level = "unspecified";
  if (!level) level = "none";
  if (!status && level !== "none") status = clearanceStatusOf(...proseStatus);
  return { level, status: level !== "none" ? status : null, polygraph };
}

/**
 * Everything part 4 reads off one normalised posting.
 * @param {{ text: string, fields: object }} posting  normalizePosting's output
 */
export function postingRequirements({ text = "", fields = {} } = {}) {
  const citizenship = classifyCitizenship(fields.citizenship || "", text);
  const clearance = classifyClearance({
    typeValue: fields.clearanceType || null, statusValue: fields.clearanceStatus || null,
    atStartValue: fields.clearanceAtStart || null, text,
  });
  return { citizenship, clearance: clearance.level, clearanceStatus: clearance.status, polygraph: clearance.polygraph };
}

/** Does this posting state a citizenship or clearance requirement at all? (the filter's question) */
export function requiresEligibility(req) {
  if (!req) return false;
  return req.citizenship === "citizen_only" || req.citizenship === "us_person"
    || (req.clearance && req.clearance !== "none") || !!req.polygraph;
}

const LEVEL_WORDS = { public_trust: "Public Trust", secret: "Secret", top_secret: "Top Secret", ts_sci: "TS/SCI" };
const STATUS_WORDS = { active_required: "active required", interim_ok: "interim OK", ability_to_obtain: "ability to obtain" };

/**
 * The Requirements row: "U.S. citizens only · Secret clearance · interim OK". Each pill is a statement
 * about the POSTING; none is about the candidate. [] when the posting states none.
 * @returns {{ key: string, label: string, title: string }[]}
 */
export function requirementPills(req) {
  if (!req) return [];
  const pills = [];
  if (req.citizenship === "citizen_only") pills.push({ key: "citizenship", label: "U.S. citizens only", title: "The posting requires U.S. citizenship." });
  if (req.citizenship === "us_person") pills.push({ key: "citizenship", label: "U.S. persons only", title: "Export control: U.S. citizen or national, permanent resident, refugee or asylee." });
  if (req.clearance && LEVEL_WORDS[req.clearance]) {
    pills.push({ key: "clearance", label: req.clearance === "public_trust" ? "Public Trust" : `${LEVEL_WORDS[req.clearance]} clearance`, title: "The security clearance the posting asks for." });
  } else if (req.clearance === "unspecified") {
    pills.push({ key: "clearance", label: "Clearance required", title: "The posting asks for a security clearance and does not name its level." });
  }
  if (req.polygraph) pills.push({ key: "polygraph", label: "Polygraph", title: "The posting asks for a polygraph." });
  if (req.clearanceStatus && STATUS_WORDS[req.clearanceStatus] && req.clearance && req.clearance !== "none") {
    pills.push({ key: "status", label: STATUS_WORDS[req.clearanceStatus], title: "When the clearance must be held." });
  }
  return pills;
}

// ── THE NOTICE AT DRAFT ──────────────────────────────────────────────────────────────────────────
const CITIZEN_RE = /\bcitizen(?:ship)?\b|\bU\.?\s?S\.?\s+person\b|\bnationality\b/i;
const CLEARANCE_RE = /\bclearance\b/i;

/**
 * Whether the user's profile STATES an answer — never what it is, and never whether it qualifies.
 * The apply resolver answers citizenship only from an exact saved answer (D36), and clearance from a
 * saved answer or the profile's stated clearance level, so those are what count as "stated".
 * @param profile  the user_profile row (GET /api/profile): custom_answers, clearance_level
 */
export function statedEligibility(profile) {
  let answers = {};
  try {
    const raw = profile?.custom_answers;
    answers = raw && typeof raw === "object" ? raw : JSON.parse(raw || "{}");
  } catch { answers = {}; }
  const saved = Object.entries(answers || {}).filter(([, a]) => typeof a === "string" && a.trim());
  return {
    citizenship: saved.some(([q]) => CITIZEN_RE.test(q)),
    clearance: saved.some(([q]) => CLEARANCE_RE.test(q)) || !!String(profile?.clearance_level || "").trim(),
  };
}

const CLEARANCE_PHRASE = (req) => {
  const lvl = LEVEL_WORDS[req.clearance] || (req.clearance === "unspecified" ? "security" : null);
  const poly = req.polygraph ? " with a polygraph" : "";
  if (!lvl) return null;
  const name = req.clearance === "public_trust" ? "Public Trust clearance" : `${lvl} clearance`;
  if (req.clearanceStatus === "active_required") return `an active ${name}${poly}`;
  if (req.clearanceStatus === "interim_ok") return `a ${name}${poly} (interim acceptable)`;
  if (req.clearanceStatus === "ability_to_obtain") return `the ability to obtain a ${name}${poly}`;
  return `a ${name}${poly}`;
};

/**
 * ⛔ D59 · THE NOTICE AT DRAFT (D51 / D54's pattern — never a block):
 *   "This role requires U.S. citizenship and an active Secret clearance. Your profile doesn't state
 *    either — draft will stop and ask."
 * It says what the POSTING asks and whether the profile STATES an answer. ⛔ It never says whether the
 * candidate qualifies. null when the posting states no requirement.
 */
export function eligibilityNotice(req, stated = { citizenship: false, clearance: false }) {
  if (!requiresEligibility(req)) return null;
  const parts = [];
  const asksCitizenship = req.citizenship === "citizen_only" || req.citizenship === "us_person";
  if (req.citizenship === "citizen_only") parts.push("U.S. citizenship");
  if (req.citizenship === "us_person") parts.push("U.S. person status (citizen, national, permanent resident, refugee or asylee)");
  const cl = CLEARANCE_PHRASE(req);
  const asksClearance = !!cl;
  if (cl) parts.push(cl);
  const first = `This role requires ${parts.join(" and ")}.`;
  const missing = [asksCitizenship && !stated?.citizenship ? "citizenship" : null, asksClearance && !stated?.clearance ? "clearance" : null].filter(Boolean);
  if (!missing.length) return `${first} Draft uses only the answers you saved — it never fills these in for you.`;
  const which = missing.length === 2 ? "either" : missing[0] === "citizenship" ? "your citizenship" : "a clearance";
  return `${first} Your profile doesn't state ${which} — draft will stop and ask.`;
}
