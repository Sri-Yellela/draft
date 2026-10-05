/**
 * D29 — THE CLOSED VOCABULARIES OF THE BOARD'S OWN TAGS (services/jobs/jobTags.js).
 *
 * Shared, because the tagger writes these values, GET /api/jobs validates against them, and the
 * sentence's dials render them — three readers, one list, the rule shared/jobFilterOptions.js states:
 * `value` IS THE DATABASE VALUE, labels are derived.
 *
 * A tag that can be anything filters nothing (D29). So a metro is one of these keys or it is not
 * tagged; a function is one of these values or it is NULL.
 */

// ── Job function ("domain" in the sentence) ─────────────────────────────────────────────────────
//
// ⚠ NOT the old "Any Domain" select, which filtered INDUSTRY (sj.bucket_domain: fintech, edtech…).
// D30's domain dial is the kind of work — design · engineering · data · product — which is what
// the classifier's role bucket (job_role_map) already records. `sentence` is the word the sentence
// uses ("Now showing design jobs").
export const JOB_FUNCTIONS = {
  param: "job_functions",
  column: "sj.tag_function",
  multi: true,
  options: [
    { value: "engineering", label: "Engineering", sentence: "engineering" },
    { value: "data",        label: "Data",        sentence: "data" },
    { value: "design",      label: "Design",      sentence: "design" },
    { value: "product",     label: "Product",     sentence: "product" },
    { value: "marketing",   label: "Marketing",   sentence: "marketing" },
    { value: "sales",       label: "Sales",       sentence: "sales" },
    { value: "operations",  label: "Operations",  sentence: "operations" },
    { value: "finance",     label: "Finance",     sentence: "finance" },
    { value: "people",      label: "People",      sentence: "people" },
    { value: "legal",       label: "Legal",       sentence: "legal" },
  ],
  dbOnly: [],
};

// ── Metros ──────────────────────────────────────────────────────────────────────────────────────
//
// `cities` are [city, state] pairs the tagger recognises after a comma ("Cambridge, MA"). A city in
// `qualifiedOnly` is recognised ONLY with its state, because bare it is somewhere else on this board
// (Cambridge UK, Dublin IE, Arlington TX, Burlington VT). `aliases` are bare spellings ("SF", "NYC").
export const METROS = [
  { value: "sf_bay_area", label: "the Bay Area", state: "CA", aliases: ["sf", "bay area", "sf bay area", "silicon valley"],
    qualifiedOnly: ["dublin", "alameda", "san ramon", "pleasanton"],
    cities: [["san francisco", "CA"], ["south san francisco", "CA"], ["oakland", "CA"], ["berkeley", "CA"],
      ["emeryville", "CA"], ["san jose", "CA"], ["palo alto", "CA"], ["mountain view", "CA"], ["sunnyvale", "CA"],
      ["menlo park", "CA"], ["redwood city", "CA"], ["santa clara", "CA"], ["san mateo", "CA"], ["foster city", "CA"],
      ["cupertino", "CA"], ["fremont", "CA"], ["milpitas", "CA"], ["los gatos", "CA"], ["san bruno", "CA"],
      ["burlingame", "CA"], ["san carlos", "CA"], ["dublin", "CA"], ["alameda", "CA"], ["san ramon", "CA"],
      ["pleasanton", "CA"]] },
  { value: "nyc", label: "New York City", state: "NY", aliases: ["nyc", "new york city", "manhattan", "brooklyn"],
    qualifiedOnly: [],
    cities: [["new york", "NY"], ["new york city", "NY"], ["brooklyn", "NY"], ["manhattan", "NY"], ["queens", "NY"],
      ["long island city", "NY"], ["jersey city", "NJ"], ["hoboken", "NJ"]] },
  { value: "boston", label: "Boston", state: "MA", aliases: ["greater boston"],
    qualifiedOnly: ["cambridge", "burlington", "lexington", "somerville", "waltham", "watertown"],
    cities: [["boston", "MA"], ["cambridge", "MA"], ["somerville", "MA"], ["waltham", "MA"], ["burlington", "MA"],
      ["lexington", "MA"], ["watertown", "MA"], ["needham", "MA"], ["woburn", "MA"]] },
  { value: "seattle", label: "Seattle", state: "WA", aliases: ["sea"], qualifiedOnly: [],
    cities: [["seattle", "WA"], ["bellevue", "WA"], ["redmond", "WA"], ["kirkland", "WA"]] },
  { value: "los_angeles", label: "Los Angeles", state: "CA", aliases: [], qualifiedOnly: ["burbank", "pasadena", "irvine", "venice"],
    cities: [["los angeles", "CA"], ["santa monica", "CA"], ["west hollywood", "CA"], ["culver city", "CA"],
      ["pasadena", "CA"], ["burbank", "CA"], ["irvine", "CA"], ["el segundo", "CA"], ["venice", "CA"]] },
  { value: "san_diego", label: "San Diego", state: "CA", aliases: [], qualifiedOnly: [], cities: [["san diego", "CA"]] },
  { value: "dc", label: "Washington, DC", state: "DC", aliases: ["washington dc", "washington d.c", "washington d.c."],
    qualifiedOnly: ["washington", "arlington", "bethesda"],
    cities: [["washington", "DC"], ["arlington", "VA"], ["reston", "VA"], ["mclean", "VA"], ["herndon", "VA"],
      ["bethesda", "MD"]] },
  { value: "chicago", label: "Chicago", state: "IL", aliases: [], qualifiedOnly: [], cities: [["chicago", "IL"]] },
  { value: "austin", label: "Austin", state: "TX", aliases: [], qualifiedOnly: [], cities: [["austin", "TX"]] },
  { value: "dallas", label: "Dallas", state: "TX", aliases: [], qualifiedOnly: [], cities: [["dallas", "TX"], ["plano", "TX"]] },
  { value: "houston", label: "Houston", state: "TX", aliases: [], qualifiedOnly: [], cities: [["houston", "TX"]] },
  { value: "denver", label: "Denver", state: "CO", aliases: [], qualifiedOnly: [], cities: [["denver", "CO"], ["boulder", "CO"]] },
  { value: "atlanta", label: "Atlanta", state: "GA", aliases: [], qualifiedOnly: [], cities: [["atlanta", "GA"]] },
  { value: "miami", label: "Miami", state: "FL", aliases: [], qualifiedOnly: [], cities: [["miami", "FL"]] },
  { value: "philadelphia", label: "Philadelphia", state: "PA", aliases: [], qualifiedOnly: [], cities: [["philadelphia", "PA"]] },
  { value: "pittsburgh", label: "Pittsburgh", state: "PA", aliases: [], qualifiedOnly: [], cities: [["pittsburgh", "PA"]] },
  { value: "portland", label: "Portland", state: "OR", aliases: [], qualifiedOnly: [], cities: [["portland", "OR"]] },
  { value: "salt_lake", label: "Salt Lake City", state: "UT", aliases: [], qualifiedOnly: [],
    cities: [["salt lake city", "UT"], ["lehi", "UT"], ["provo", "UT"]] },
  { value: "phoenix", label: "Phoenix", state: "AZ", aliases: [], qualifiedOnly: [],
    cities: [["phoenix", "AZ"], ["scottsdale", "AZ"], ["tempe", "AZ"]] },
  { value: "minneapolis", label: "Minneapolis", state: "MN", aliases: [], qualifiedOnly: [], cities: [["minneapolis", "MN"]] },
  { value: "detroit", label: "Detroit", state: "MI", aliases: [], qualifiedOnly: [], cities: [["detroit", "MI"], ["ann arbor", "MI"]] },
  { value: "raleigh", label: "Raleigh–Durham", state: "NC", aliases: [], qualifiedOnly: ["durham"],
    cities: [["raleigh", "NC"], ["durham", "NC"]] },
  { value: "nashville", label: "Nashville", state: "TN", aliases: [], qualifiedOnly: [], cities: [["nashville", "TN"]] },
];

// ── US states, as the dial offers them ──────────────────────────────────────────────────────────
export const STATE_LABELS = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "the District of Columbia",
};

/**
 * The location dimension: `places=metro:boston,state:CA`. Its floor is the United States and cannot be
 * cleared (D30) — an empty value IS "in the United States", because the board is US-only.
 */
export const PLACES = {
  param: "places",
  multi: true,
  options: [
    ...METROS.map(m => ({ value: `metro:${m.value}`, label: m.label, sentence: `in ${m.label}` })),
    ...Object.entries(STATE_LABELS).map(([code, name]) => ({ value: `state:${code}`, label: name, sentence: `in ${name}` })),
  ],
  dbOnly: [],
};

/** "metro:boston" -> { kind: "metro", key: "boston" }; null when not in the vocabulary. */
export function parsePlaceValue(v) {
  const m = /^(metro|state):(.+)$/.exec(String(v || "").trim());
  if (!m) return null;
  if (m[1] === "metro" && METROS.some(x => x.value === m[2])) return { kind: "metro", key: m[2] };
  if (m[1] === "state" && STATE_LABELS[m[2]]) return { kind: "state", key: m[2] };
  return null;
}

/**
 * Free text -> a vocabulary value, for the LEGACY `location=` param (saved searches and API callers
 * still send it). "Boston" -> metro:boston, "CA" / "California" -> state:CA, "Bay Area" ->
 * metro:sf_bay_area. null when the text names nothing in the vocabulary — the caller then says so
 * rather than falling back to a substring match.
 */
export function resolvePlaceText(text) {
  const t = String(text || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]+$/, "");
  if (!t) return null;
  for (const m of METROS) {
    if (m.value === t || m.label.toLowerCase() === t || (m.aliases || []).includes(t)) return `metro:${m.value}`;
    if (m.cities.some(([c]) => c === t) && !(m.qualifiedOnly || []).includes(t)) return `metro:${m.value}`;
  }
  const code = t.toUpperCase();
  if (/^[a-z]{2}$/.test(t) && STATE_LABELS[code]) return `state:${code}`;
  for (const [c, name] of Object.entries(STATE_LABELS)) if (name.toLowerCase() === t) return `state:${c}`;
  return null;
}
