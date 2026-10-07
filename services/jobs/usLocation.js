// services/jobs/usLocation.js — is this posting somewhere a draft user can work? (queue 37)
//
// ⛔ draft is strictly US-based. A Dublin or Bangalore posting is not noise to be ranked low — it is
// a row nobody on the platform can ever act on, and every curation figure taken over a board that
// contains it is diluted by it. Measured 10-01 on the local board before this existed: see the
// queue 37 SESSION LOG entry.
//
// ⛔ THE RULE THIS FILE EXISTS TO KEEP: AN UNPARSEABLE LOCATION IS NOT INCLUDED.
// This board went to zero four times through NULLs propagating into a filter that read "unknown" as
// "drop". The opposite mistake is the same shape pointed the other way: a gate that reads "unknown"
// as "keep" lets every row with a blank, "N/A" or "LOCATION" field straight through and the gate
// measures nothing. So there are FOUR verdicts, and only "us" is admitted:
//
//   us                  a US place is named — a state, a code after a city, a US city, "US",
//                       "United States", "North America"/"Americas" (which contain the US).
//                       ⭐ A multi-location posting with ANY US location is US: the user can apply
//                       for that location.
//   non_us              only places outside the US are named
//   remote_unqualified  "Remote" and nothing to say from where (see remoteRegionFromText)
//   unknown             null, blank, "N/A", "Not specified", a token we cannot read
//
// Pure: no DB, no I/O. The ingestion gate (aggregator.js), the two server.js write paths and the
// retirement script (scripts/q37RetireOutOfMarket.mjs) all call usEligibility.

/** A source's STRUCTURED locations, as strings: Greenhouse's `offices` (boards fetched with
 *  `?content=true`) and Jobo's `locations` (city/region/country — the flat field keeps only the
 *  label, so "Alameda HQ" would otherwise lose its "CA, US"). */
export function officeLocations(raw) {
  const list = [
    ...(Array.isArray(raw?.offices) ? raw.offices : []),
    ...(Array.isArray(raw?.locations) ? raw.locations : []),
  ];
  return list.map((o) => (typeof o === "string" ? o
    : [o?.location || o?.name, o?.city, o?.region || o?.state, o?.country].filter(Boolean).join(", ") || null))
    .filter(Boolean);
}

// ── US vocabulary ────────────────────────────────────────────────────────────────────────────
const STATES = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas", CA: "california", CO: "colorado",
  CT: "connecticut", DE: "delaware", FL: "florida", GA: "georgia", HI: "hawaii", ID: "idaho",
  IL: "illinois", IN: "indiana", IA: "iowa", KS: "kansas", KY: "kentucky", LA: "louisiana",
  ME: "maine", MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota",
  MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska", NV: "nevada",
  NH: "new hampshire", NJ: "new jersey", NM: "new mexico", NY: "new york", NC: "north carolina",
  ND: "north dakota", OH: "ohio", OK: "oklahoma", OR: "oregon", PA: "pennsylvania",
  RI: "rhode island", SC: "south carolina", SD: "south dakota", TN: "tennessee", TX: "texas",
  UT: "utah", VT: "vermont", VA: "virginia", WA: "washington", WV: "west virginia",
  WI: "wisconsin", WY: "wyoming", DC: "district of columbia",
};
const STATE_NAMES = Object.values(STATES);
// ⚠ Only names that are unambiguous on this board. Dublin (CA/OH), Cambridge (MA), London (ON),
// Vancouver (WA), Paris (TX) and Birmingham (AL) are all US places too — a bare one is read as the
// foreign city it almost always is here, and a qualified one ("Dublin, CA") is caught by the code.
const US_CITIES = [
  "san francisco", "sf", "bay area", "chi", "atl", "new york", "nyc", "manhattan", "brooklyn", "seattle",
  "chicago", "austin", "boston", "pittsburgh", "washington dc", "washington, dc", "washington d.c",
  "palo alto", "los angeles", "salt lake city", "denver", "boulder", "atlanta", "miami",
  "san jose", "san diego", "mountain view", "sunnyvale", "menlo park", "redwood city", "oakland",
  "berkeley", "santa clara", "san mateo", "foster city", "south san francisco", "west hollywood",
  "santa monica", "irvine", "philadelphia", "houston", "dallas", "phoenix", "minneapolis",
  "detroit", "nashville", "raleigh", "durham", "charlotte", "st. louis", "st louis", "kansas city",
  "columbus", "cincinnati", "cleveland", "baltimore", "arlington", "reston", "mclean", "herndon",
  "bellevue", "redmond", "kirkland", "portland", "sacramento", "las vegas", "honolulu",
  "new jersey", "jersey city", "hoboken", "princeton", "stamford", "new haven", "providence",
  "ann arbor", "madison", "milwaukee", "indianapolis", "tampa", "orlando", "jacksonville",
  "lehi", "provo", "scottsdale", "tempe", "albuquerque", "boise", "omaha", "des moines",
];
// Regions that CONTAIN the US — a role open across them is open to a US resident.
const US_REGIONS = ["north america", "americas", "amer", "us/canada", "us / canada", "usa/canada"];

// ── outside the US ───────────────────────────────────────────────────────────────────────────
const FOREIGN = [
  // countries
  "canada", "mexico", "brazil", "argentina", "chile", "colombia", "peru", "uruguay", "costa rica",
  "united kingdom", "uk", "england", "scotland", "wales", "ireland", "france", "germany", "spain",
  "portugal", "italy", "netherlands", "belgium", "switzerland", "austria", "sweden", "norway",
  "denmark", "finland", "poland", "czech republic", "czechia", "romania", "hungary", "greece",
  "estonia", "lithuania", "latvia", "ukraine", "serbia", "croatia", "bulgaria", "turkey", "türkiye",
  "israel", "india", "pakistan", "bangladesh", "sri lanka", "china", "hong kong", "taiwan",
  "japan", "south korea", "korea", "singapore", "malaysia", "indonesia", "philippines", "vietnam",
  "thailand", "australia", "new zealand", "south africa", "nigeria", "kenya", "egypt", "morocco",
  "uae", "united arab emirates", "saudi arabia", "qatar", "luxembourg", "cyprus", "malta",
  // regions that do NOT contain the US
  "europe", "emea", "apac", "asia", "latam", "latin america", "south america", "eu", "dach",
  "nordics", "middle east", "anz", "oceania", "africa",
  // provinces and codes that read as places, never as US states
  "ontario", "quebec", "british columbia", "alberta", "manitoba", "nova scotia",
  // cities
  "london", "dublin", "paris", "berlin", "munich", "hamburg", "frankfurt", "amsterdam", "zurich",
  "zürich", "geneva", "stockholm", "copenhagen", "oslo", "helsinki", "madrid", "barcelona",
  "lisbon", "milan", "rome", "warsaw", "krakow", "kraków", "prague", "vienna", "budapest",
  "bucharest", "athens", "brussels", "edinburgh", "manchester", "cambridge", "oxford", "belfast",
  "toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary", "waterloo", "mexico city",
  "guadalajara", "são paulo", "sao paulo", "rio de janeiro", "buenos aires", "bogotá", "bogota",
  "santiago", "tel aviv", "jerusalem", "haifa", "bangalore", "bengaluru", "hyderabad", "mumbai",
  "pune", "chennai", "delhi", "new delhi", "gurgaon", "gurugram", "noida", "tokyo", "osaka",
  "seoul", "beijing", "shanghai", "shenzhen", "taipei", "sydney", "melbourne", "brisbane",
  "auckland", "dubai", "abu dhabi", "riyadh", "doha", "istanbul", "cairo", "lagos", "nairobi",
  "cape town", "johannesburg", "kuala lumpur", "jakarta", "manila", "ho chi minh", "hanoi",
  "bangkok", "cdmx", "utrecht", "rotterdam", "eindhoven", "tallinn", "vilnius", "riga", "kyiv", "lyon",
];

const REMOTE_WORDS = /\b(remote|remote-first|remote-friendly|anywhere|distributed|work from home|wfh|virtual)\b/i;
const NOT_A_PLACE = /^(n\/?a|na|none|null|tbd|tba|location|locations|not specified|location not specified|unspecified|various|multiple( locations)?|flexible|-+|\.+)$/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const phrase = (list) => new RegExp(`(?:^|[^\\p{L}])(?:${list.map(esc).sort((a, b) => b.length - a.length).join("|")})(?![\\p{L}])`, "iu");
const US_CITY_RE = phrase(US_CITIES);
const US_REGION_RE = phrase(US_REGIONS);
const STATE_NAME_RE = phrase(STATE_NAMES);
const FOREIGN_RE = phrase(FOREIGN);
// Two-letter codes that are a US state AND a country, with the cities that make them the country.
const CODE_COLLISIONS = {
  CA: phrase(["toronto", "vancouver", "montreal", "montréal", "ottawa", "calgary", "waterloo", "edmonton", "winnipeg", "halifax", "victoria", "quebec"]),
  IN: phrase(["bangalore", "bengaluru", "hyderabad", "mumbai", "pune", "chennai", "delhi", "new delhi", "gurgaon", "gurugram", "noida", "kolkata", "ahmedabad"]),
  DE: phrase(["berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln", "stuttgart", "düsseldorf"]),
  AR: phrase(["buenos aires", "córdoba", "cordoba", "rosario"]),
};
// "US", "USA", "U.S.", "U.S.A.". "US" is CASE-SENSITIVE: in a location field it is the country,
// and the pronoun never appears in one in capitals.
const US_COUNTRY_CS = /(?:^|[^A-Za-z])(US|USA|U\.S\.A?\.?)(?![A-Za-z])/;
// "City, ST" — a two-letter code after a comma, as the code and nothing more.
const CITY_CODE_RE = /([\p{L}.' -]+?)\s*,\s*([A-Z]{2})(?![A-Za-z])/gu;
// "US-Remote", "US - San Francisco", "USA-NY": a US prefix.
const US_PREFIX_RE = /(?:^|[^A-Za-z])(US|USA)\s*[-–:]\s*/;

/** Split a location field into the places it lists. Commas are NOT separators: they join a city
 *  to its state ("Austin, TX"), so a comma list is read as one segment and the code rule handles it. */
export function segments(raw) {
  return String(raw)
    // "or"/"and" only lower-case, between spaces: "Portland, OR" is Oregon, not a separator.
    .split(/\s*(?:\||;|•|·|\n|\/(?=\s)|\s\/|\s(?:or|and)\s|\(|\))\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** One segment's verdict: "us" | "non_us" | "remote" | null (nothing readable). */
export function classifySegment(seg) {
  const s = String(seg || "").trim();
  if (!s || NOT_A_PLACE.test(s)) return null;
  const lower = s.toLowerCase();
  // A city followed by a code: US when the code is a state — UNLESS the code is also that city's
  // country ("Bangalore, IN" is India, not Indiana; "Toronto, CA" is Canada). "Dublin, CA" is
  // California: Dublin is not a Canadian city, so the state reading stands.
  for (const m of s.matchAll(CITY_CODE_RE)) {
    const city = m[1].trim().toLowerCase();
    if (STATES[m[2]] && !CODE_COLLISIONS[m[2]]?.test(city)) return "us";
  }
  if (US_COUNTRY_CS.test(s) || /united states|\bu\.s\.a?\b/i.test(lower)) return "us";
  if (US_PREFIX_RE.test(s)) return "us";
  if (US_REGION_RE.test(lower)) return "us";
  if (/(?:^|[^\p{L}])(latin|south|central) america/iu.test(lower)) return "non_us";
  if (/(?:^|[^\p{L}])america(?![\p{L}])/iu.test(lower)) return "us";
  // A US state's NAME — after the foreign check would let "New Mexico" read as Mexico, so before it,
  // but "Georgia" (the country) and "Washington" are both US on this board.
  if (STATE_NAME_RE.test(lower)) return "us";
  if (US_CITY_RE.test(lower)) return "us";
  if (FOREIGN_RE.test(lower)) return "non_us";
  // A bare foreign country/region CODE after a comma or alone ("Zürich, CH", "Dublin, IE", "MX").
  if (/(?:^|,\s*)(UK|GB|IE|DE|FR|ES|NL|CH|SE|NO|DK|FI|PL|IT|PT|AT|BE|IL|IN|JP|KR|SG|AU|NZ|BR|MX|CN|HK|TW|AE|PH|CA)$/.test(s.replace(/\s*-?\s*remote$/i, ""))
      && !/,\s*CA$/.test(s)) return "non_us";
  if (REMOTE_WORDS.test(lower)) return "remote";
  return null;
}

/**
 * The posting's verdict from its location field alone.
 * @returns {{ verdict: "us"|"non_us"|"remote_unqualified"|"unknown", segments: string[] }}
 */
export function classifyLocation(raw) {
  if (raw === null || raw === undefined) return { verdict: "unknown", segments: [] };
  const segs = segments(raw);
  const verdicts = segs.map(classifySegment);
  if (verdicts.includes("us")) return { verdict: "us", segments: segs };
  if (verdicts.includes("non_us")) return { verdict: "non_us", segments: segs };
  if (verdicts.includes("remote")) return { verdict: "remote_unqualified", segments: segs };
  return { verdict: "unknown", segments: segs };
}

// ── "Remote" — remote from WHERE? ────────────────────────────────────────────────────────────
// workplace_type says HOW (remote/hybrid/onsite), never WHERE. A bare "Remote" location is read
// against the description, and only POSITIVE US evidence admits it:
//   - a US pay-transparency range, which state law requires only for work performed in that state
//   - an explicit residency/eligibility line naming the US ("must be based in the US", "US time zones")
// and only if the description does not also restrict the role to somewhere else.
const US_REMOTE_EVIDENCE = [
  /\b(?:based|located|reside|residing|live|living)\s+(?:in|within)\s+(?:the\s+)?(?:U\.?S\.?A?\.?|united states)\b/i,
  /\b(?:U\.?S\.?|united states)[- ]based\b/i,
  /\bremote\s*(?:\(|-|–|—|,|within|in)?\s*(?:the\s+)?(?:U\.?S\.?A?\.?|united states)\b/i,
  /\b(?:anywhere|any(?:where)? location)\s+in\s+(?:the\s+)?(?:U\.?S\.?|united states)\b/i,
  /\b(?:US|U\.S\.)\s+time\s*zones?\b/i,
  /\b(?:pacific|eastern|central|mountain)\s+time\b/i,
  /\b(?:PST|PDT|EST|EDT|CST|CDT|MST)\b/,
  /\b(?:california|colorado|new york|washington|illinois|maryland|nevada|hawaii|minnesota|vermont|massachusetts|new jersey)(?:\s+state)?\s+(?:pay|salary|compensation)\b/i,
  /\b(?:pay|salary|compensation|base)\s+(?:transparency|range)[^.]{0,80}\b(?:california|colorado|new york|washington|united states|U\.S\.)/i,
  /\bU\.?S\.?\s+(?:pay|salary|base salary|compensation)\s+range/i,
];
const FOREIGN_REMOTE_EVIDENCE = [
  /\b(?:based|located|reside|residing|live|living)\s+(?:in|within)\s+(?:the\s+)?(?:EMEA|europe|EU|UK|united kingdom|india|canada|APAC|LATAM|germany|ireland|brazil|mexico|australia|japan|singapore)\b/i,
  /\bremote\s*(?:\(|-|–|—|,|within|in)?\s*(?:EMEA|europe|EU|UK|united kingdom|india|canada|APAC|LATAM|germany|ireland|brazil|mexico|australia|japan|singapore)\b/i,
  /\b(?:CET|CEST|GMT|BST|IST|AEST|JST|SGT)\s+time\s*zones?\b/i,
];

/** "us" | "non_us" | null — what a description says about where a remote role may be worked from. */
export function remoteRegionFromText(text) {
  const t = String(text || "");
  if (!t) return null;
  const us = US_REMOTE_EVIDENCE.some((re) => re.test(t));
  const foreign = FOREIGN_REMOTE_EVIDENCE.some((re) => re.test(t));
  if (us && !foreign) return "us";
  if (foreign && !us) return "non_us";
  return null;   // silent, or both — not evidence either way
}

/**
 * The gate. ⛔ Returns true ONLY on positive US evidence; every other outcome — non-US, unknown,
 * a NULL location, an unqualified Remote with a silent description — is false.
 * @returns {{ admit: boolean, verdict: string, reason: string }}
 */
export function usEligibility({ location, description, offices = [] } = {}) {
  const { verdict } = classifyLocation(location);
  if (verdict === "us") return { admit: true, verdict, reason: "us_location" };
  // The source's structured office list, when it has one (Greenhouse's `offices`): a posting whose
  // location field says "N/A" but whose office is "San Francisco, CA" is a US posting. It only ever
  // ADMITS on a US office; it is never a reason to refuse.
  const officeList = (Array.isArray(offices) ? offices : []).filter(Boolean);
  if (officeList.length && classifyLocation(officeList.join(" | ")).verdict === "us") {
    return { admit: true, verdict, reason: "us_office" };
  }
  if (verdict === "remote_unqualified") {
    const region = remoteRegionFromText(description);
    if (region === "us") return { admit: true, verdict, reason: "remote_us_by_description" };
    return { admit: false, verdict, reason: region === "non_us" ? "remote_non_us_by_description" : "remote_region_unstated" };
  }
  return { admit: false, verdict, reason: verdict === "non_us" ? "non_us_location" : "location_unparseable" };
}

// The state table, for the cross-source fingerprint (schema.js) — one copy, not two.
export { STATES as US_STATES };

// ── D41(d) · A CAPTURE HAS THE WHOLE PAGE ─────────────────────────────────────────────────────────
//
// ✅ Owner, 10-06: "if it lacks US evidence it shouldn't be captured at all." A crawl has a location
// string; a capture has the page — so a bare "Remote" is no longer a dead end when the page says
// "US-based", names a US city, states a USD range or a US work-authorisation line.
//
// ⛔ TWO DIFFERENT REFUSALS, because they are different facts:
//   non_us       the location (or a remote line) names somewhere outside the US — "based outside the US"
//   unconfirmed  nothing either way — "we couldn't confirm"; ⛔ calling a US remote role "not in the
//                US" would be false, and a false refusal of the owner's own capture is the worst outcome
const US_TEXT_RE = /\bUnited States\b|\bU\.S\.A?\.?(?![a-z])|\bUS[- ]based\b|\bbased in the (?:US|U\.S\.)\b|\b(?:within|in|across) the (?:US|U\.S\.)\b|\bUSA\b/;
// A "$" with a letter before it is another dollar (C$, CA$, A$…), so it is not USD evidence.
const USD_RE = /\bUSD\b|(?<![A-Za-z])\$\s?\d{2,3}(?:,\d{3}|\s?[kK]\b)/;
const OTHER_DOLLAR_RE = /\b(?:CAD|AUD|NZD|SGD|MXN|HKD)\b|\b(?:C|CA|A|AU|NZ|S|MX)\$/;
const CITY_ST_RE = /\b([A-Z][a-zA-Z.'-]+(?: [A-Z][a-zA-Z.'-]+){0,2}), ([A-Z]{2})\b/g;

/** The first piece of US evidence in a page's text, as a short code — or null. */
export function usEvidenceInText(text) {
  const t = String(text || "").slice(0, 60000);
  if (!t.trim()) return null;
  if (US_TEXT_RE.test(t)) return "us_named";
  for (const m of t.matchAll(CITY_ST_RE)) {
    if (STATES[m[2]] && classifyLocation(`${m[1]}, ${m[2]}`).verdict === "us") return "us_city";
  }
  if (USD_RE.test(t) && !OTHER_DOLLAR_RE.test(t)) return "usd_pay";
  return null;
}

/**
 * The capture's market verdict: the crawl's own test first (usEligibility), then — only when that
 * found NO positive non-US evidence — the page's text.
 * @returns {{ admit: boolean, kind: 'us'|'non_us'|'unconfirmed', reason: string }}
 */
export function captureMarket({ location, description, offices = [], pageText = "", statedCountryUs = false } = {}) {
  const base = usEligibility({ location, description, offices });
  if (base.admit) return { admit: true, kind: "us", reason: base.reason };
  // ⭐ D59 · "Country: United States of America" in the posting's own label block is POSITIVE US
  // evidence — the employer's field, read by shared/postingNormalize.js. A capture carrying it is
  // accepted, never refused or called unconfirmed (like a US office, it only ever admits).
  if (statedCountryUs) return { admit: true, kind: "us", reason: "capture_country_label" };
  if (base.reason === "non_us_location" || base.reason === "remote_non_us_by_description") {
    return { admit: false, kind: "non_us", reason: base.reason };
  }
  const evidence = usEvidenceInText(`${description || ""}\n${pageText || ""}`);
  if (evidence) return { admit: true, kind: "us", reason: `capture_${evidence}` };
  return { admit: false, kind: "unconfirmed", reason: base.reason };
}
