// services/jobs/jobTags.js — D29: the board's OWN tags, which every filter queries instead of free text.
//
// ⛔ WHY THIS EXISTS (D27, measured): the location filter was `sj.location LIKE %x%` over strings from a
// dozen ATS vendors, so "IN" matched Wash-in-gton and Berl-in, "MA" matched O-ma-ha, "CA" matched
// Canada, and "Bay Area" found none of 370 San Francisco rows. Level was 0% NULL only because
// normalizeExperienceLevel files every title without a seniority word under 'mid' — 592 of 868
// active "mid" rows had never been looked at by anything else. That is CC2's disease (whole-value
// matching against an uncontrolled vocabulary), one column over.
//
// ── WHAT A TAG IS ────────────────────────────────────────────────────────────────────────────────
//   places      a SET of { country, state, metro } — one posting can be in several places
//   remote      1 = remote work is offered · 0 = stated hybrid/on-site and no remote · NULL = unknown
//   workplace   remote | hybrid | onsite | NULL
//   level       intern | entry | mid | senior | lead | executive | NULL   (shared EXPERIENCE_LEVELS)
//   job_function engineering | data | design | product | sales | marketing | people | legal |
//               operations | finance | NULL                                (JOB_FUNCTIONS below)
//   employment  full-time | contract | internship | part-time | NULL      (shared EMPLOYMENT_TYPES)
//   us          us | non_us | remote_unqualified | unknown — the US-only verdict, from the places
//
// ⛔ NULL MEANS UNKNOWN, NEVER NO. Every predicate over these columns is soft-null — `(col IS NULL OR
// col <predicate>)` — and the board orders known matches first (A73). Nothing here ever invents a
// value to avoid a NULL: no 'mid' fallback, no 'full-time' default, no 'general' function.
//
// ⛔ DETERMINISTIC ONLY (D17). Regex and lookup tables over what the posting already says. No model
// call is made here or on behalf of anything here. What the rules cannot tag stays NULL, and the owner
// fills it through export → tag → import (routes/jobTags.js); an owner tag is never overwritten by a
// re-tag.
//
// Pure except tagStaleJobs / applyOwnerTags at the bottom, which read and write the database.
import crypto from "node:crypto";
import { segments, classifySegment, remoteRegionFromText, US_STATES } from "./usLocation.js";
import { EXPERIENCE_LEVELS, EMPLOYMENT_TYPES, WORK_MODELS, valueSet } from "../../shared/jobFilterOptions.js";
import { METROS, JOB_FUNCTIONS, functionForRole } from "../../shared/jobTagVocabulary.js";
import { parseCodedLocation } from "../../shared/postingNormalize.js";
import { rangeSql, rangeParams } from "./rowidWalk.js";
import { functionFromTitle } from "./categoryFunction.js";

/** Bump when a rule changes: every row is re-tagged on the next pass (owner tags survive). */
// 3 (D59): coded locations ("US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd") and the label block's
// location and workstyle ("Position Role Type: Onsite").
export const TAGGER_VERSION = 3;

const LEVELS = valueSet(EXPERIENCE_LEVELS);
const EMPLOYMENTS = valueSet(EMPLOYMENT_TYPES);
const WORKPLACES = valueSet(WORK_MODELS);
const FUNCTIONS = new Set(JOB_FUNCTIONS.options.map(o => o.value));
const METRO_KEYS = new Set(METROS.map(m => m.value));

// ── LOCATION ─────────────────────────────────────────────────────────────────────────────────────

const STATE_BY_NAME = Object.fromEntries(Object.entries(US_STATES).map(([code, name]) => [name, code]));
// "city|ST" -> metro, and bare city -> [metro, ST] for the cities that are unambiguous on this board.
const CITY_STATE_METRO = new Map();
const BARE_CITY = new Map();
for (const m of METROS) {
  for (const [city, st] of m.cities) {
    CITY_STATE_METRO.set(`${city}|${st}`, m.value);
    if (!m.qualifiedOnly?.includes(city)) BARE_CITY.set(city, [m.value, st]);
  }
  for (const alias of m.aliases || []) BARE_CITY.set(alias, [m.value, m.state]);
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BARE_CITY_RE = new RegExp(`(?:^|[^\\p{L}])(${[...BARE_CITY.keys()].sort((a, b) => b.length - a.length).map(esc).join("|")})(?![\\p{L}])`, "giu");
const STATE_NAME_RE = new RegExp(`(?:^|[^\\p{L}])(${Object.keys(STATE_BY_NAME).sort((a, b) => b.length - a.length).map(esc).join("|")})(?![\\p{L}])`, "giu");
const US_COUNTRY_RE = /(?:^|[^A-Za-z])(US|USA|U\.S\.A?\.?)(?![A-Za-z])|united states|\bamericas?\b|north america/i;
const REMOTE_RE = /\b(remote|remote-first|remote-friendly|anywhere|distributed|work from home|wfh)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const ONSITE_RE = /\b(on-?site|in[- ]office|in[- ]person)\b/i;
const NOT_A_PLACE = /^(n\/?a|na|none|null|tbd|tba|location|locations|not specified|location not specified|unspecified|various|multiple( locations)?|flexible|-+|\.+)$/i;
// Prefixes and filler that wrap a place without being one: "Hybrid - San Francisco", "US - Remote".
const WRAPPER_RE = /^(?:or|and|hybrid|remote|on-?site|in[- ]office|hq|headquarters)\b\s*[-–:,]?\s*/i;

function cleanToken(t) {
  let s = String(t || "").trim().replace(/\s+/g, " ");
  for (let i = 0; i < 3; i++) s = s.replace(WRAPPER_RE, "").trim();
  return s.replace(/[.,;:]+$/, "").trim();
}

function metroFor(city, st) {
  const c = city.toLowerCase().trim();
  if (st) return CITY_STATE_METRO.get(`${c}|${st}`) || null;
  return BARE_CITY.get(c)?.[0] || null;
}

const placeKey = (p) => `${p.country}|${p.state || ""}|${p.metro || ""}`;

/**
 * The places a location field names, as a de-duplicated set.
 * @returns {{ country: "US"|"NON_US", state: string|null, metro: string|null }[]}
 */
export function parsePlaces(raw) {
  if (raw == null) return [];
  const out = new Map();
  const add = (p) => {
    const place = { country: p.country, state: p.state || null, metro: p.metro || null };
    out.set(placeKey(place), place);
  };
  for (const seg of segments(raw)) {
    if (!seg || NOT_A_PLACE.test(seg.trim())) continue;
    // Commas join a city to its state AND separate places ("San Francisco, CA, New York, NY"), so the
    // segment is read as tokens and a state after a city is taken as that city's state.
    const tokens = seg.split(",").map(cleanToken).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      // ⭐ D59 · a CODED location — "US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd BLDG 2" is country-state-
      // CITY-site + a street. ⛔ The street is never read for a city: "Boston Post Rd" is a road in
      // Marlborough, and the bare-city matcher below would tag it "in Boston" (D42's exact bug). The
      // metro comes from the CITY's own vocabulary row, or none — membership is not decided here.
      const coded = parseCodedLocation(tok);
      if (coded) { add({ country: "US", state: coded.state, metro: metroFor(coded.city, coded.state) }); continue; }
      // D42 · "Seattle WA" — a known city and its state with no comma between ("San Francisco, CA,
      // Seattle WA, New York, NY" lost Seattle, and the city-state pairing below then read "Seattle WA,
      // New York" as one place). Only a city the vocabulary pairs with that state; checked first.
      const spaced = /^(.+?)\s+([A-Z]{2})$/.exec(tok);
      if (spaced && US_STATES[spaced[2]] && CITY_STATE_METRO.has(`${spaced[1].toLowerCase()}|${spaced[2]}`)) {
        add({ country: "US", state: spaced[2], metro: CITY_STATE_METRO.get(`${spaced[1].toLowerCase()}|${spaced[2]}`) });
        continue;
      }
      const next = tokens[i + 1] || "";
      const nextCode = /^[A-Z]{2}$/.test(next) && US_STATES[next] ? next : null;
      const nextName = STATE_BY_NAME[next.toLowerCase()] || null;
      const st = nextCode || nextName;
      if (st) {
        const lower = tok.toLowerCase();
        const known = BARE_CITY.get(lower);
        const exact = CITY_STATE_METRO.has(`${lower}|${st}`);
        const tokIsState = /^[A-Z]{2}$/.test(tok) || !!STATE_BY_NAME[lower];
        // "City, ST" — unless the city is one we know to be in ANOTHER state, in which case the next
        // token is a second place ("San Francisco, Seattle, New York"), not this city's state.
        const pair = exact || (!tokIsState && !(known && known[1] !== st));
        // The location gate decides whether ST is the state or a country code that collides with one
        // ("Toronto, CA", "Bangalore, IN").
        if (pair && classifySegment(`${tok}, ${nextCode || next}`) === "us") {
          add({ country: "US", state: st, metro: metroFor(tok, st) });
          i++;
          continue;
        }
      }
      const verdict = classifySegment(tok);
      if (verdict === "non_us") { add({ country: "NON_US" }); continue; }
      let found = false;
      // Known cities inside the token ("Hybrid - San Francisco", "NYC-Privy").
      for (const m of tok.matchAll(BARE_CITY_RE)) {
        const [metro, mst] = BARE_CITY.get(m[1].toLowerCase());
        add({ country: "US", state: mst, metro });
        found = true;
      }
      if (!found) {
        // A state named on its own ("California", "Texas"). "Washington" alone stays a country-level
        // US place: the state and DC are both "Washington" on this board.
        for (const m of tok.matchAll(STATE_NAME_RE)) {
          const name = m[1].toLowerCase();
          if (name === "washington") { add({ country: "US" }); found = true; continue; }
          add({ country: "US", state: STATE_BY_NAME[name] });
          found = true;
        }
      }
      if (!found && /^[A-Z]{2}$/.test(tok) && US_STATES[tok] && tok !== "CA" && tok !== "IN") {
        add({ country: "US", state: tok }); found = true;
      }
      if (!found && (US_COUNTRY_RE.test(tok) || verdict === "us")) add({ country: "US" });
    }
  }
  // A country-level row says nothing a more specific row in the same country does not.
  // Likewise a state-only row in a state a metro row already places it in ("New York, NY" is one place).
  const places = [...out.values()];
  const specificUs = places.some(p => p.country === "US" && (p.state || p.metro));
  const metroStates = new Set(places.filter(p => p.metro).map(p => p.state));
  return places.filter(p => !(specificUs && p.country === "US" && !p.state && !p.metro)
    && !(p.state && !p.metro && metroStates.has(p.state)));
}

/**
 * Remote / workplace from the location field and the stored workplace_type (which is the source's
 * own statement or enrichment's, never a fallback — schema.js returns null when nothing says).
 */
// Only phrases that STATE this role's arrangement. "Remote work stipend" in a benefits list says
// nothing about the role, so a bare "remote" in a description counts for nothing.
// ⛔ "fully remote" alone is NOT one: Stripe's postings say "up to four weeks per year of fully remote
// work" about hybrid roles (measured on this board). Hybrid is tested first for the same reason.
const DESC_REMOTE = /\b(?:this|the)\s+(?:role|position|job|opportunity)\s+(?:is|can be)\s+(?:a\s+)?(?:fully\s+|100%\s+)?remote\b|\bthis\s+is\s+a\s+(?:fully\s+|100%\s+)?remote\s+(?:role|position)\b/i;
const DESC_HYBRID = /\b(?:this|the)\s+(?:role|position|job)\s+is\s+(?:a\s+)?hybrid\b|\bhybrid\s+(?:role|position|schedule|work(?:ing)?\s+(?:model|arrangement|schedule))\b|\b(?:\d|two|three|four)\s+days\s+(?:a|per)\s+week\s+(?:in|at)\s+(?:the\s+|our\s+)?(?:office|hq)\b|\b(?:\d|two|three|four)\s+days\s+in\s+(?:the\s+)?office\s+(?:a|per)\s+week\b/i;
const DESC_ONSITE = /\b(?:this|the)\s+(?:role|position|job)\s+is\s+(?:a\s+)?(?:fully\s+)?(?:on-?site|in[- ]office|in[- ]person)\b|\b(?:5|five)\s+days\s+(?:a|per)\s+week\s+(?:in|at)\s+(?:the\s+|our\s+)?office\b/i;

export function tagWorkplace({ location, title, workplace_type, description, label_workplace = null }) {
  const head = String(description || "").slice(0, 20000);
  const text = `${location || ""} ${title || ""}`;
  // D59: the label block's "Position Role Type: Onsite" is the employer's own statement, like the
  // source's workplace_type — read before any phrase in the prose.
  const stored = WORKPLACES.has(workplace_type) ? workplace_type
    : WORKPLACES.has(label_workplace) ? label_workplace
    : DESC_HYBRID.test(head) ? "hybrid" : DESC_REMOTE.test(head) ? "remote" : DESC_ONSITE.test(head) ? "onsite" : null;
  const remote = REMOTE_RE.test(text) || stored === "remote" ? 1
    : (stored === "hybrid" || stored === "onsite" || HYBRID_RE.test(text) || ONSITE_RE.test(text)) ? 0
    : null;
  const workplace = remote === 1 ? "remote"
    : (stored === "hybrid" || HYBRID_RE.test(text)) ? "hybrid"
    : (stored === "onsite" || ONSITE_RE.test(text)) ? "onsite"
    : null;
  return { remote, workplace };
}

/** The US-only verdict from the tags (and, for a bare Remote, the description). */
export function usVerdict(places, remote, description) {
  if (places.some(p => p.country === "US")) return "us";
  if (places.some(p => p.country === "NON_US")) return "non_us";
  if (remote === 1) {
    const region = remoteRegionFromText(description);
    return region === "us" ? "us" : region === "non_us" ? "non_us" : "remote_unqualified";
  }
  return "unknown";
}

// ── LEVEL ────────────────────────────────────────────────────────────────────────────────────────
//
// From the TITLE, and NULL when the title carries no seniority signal. ⛔ No 'mid' fall-through:
// that fallback is the reason the column could not say "unknown".
export function levelFromTitle(title) {
  const t = String(title || "").toLowerCase();
  if (!t) return null;
  if (/\b(intern(?:ship)?|co-?op)\b/.test(t)) return "intern";
  if (/\b(chief\s+\w+\s+officer|ceo|cto|cfo|coo|cpo|ciso|vice\s+president|svp|evp|vp)\b/.test(t)) return "executive";
  if (/\b(director|head\s+of|lead|tech\s+lead)\b/.test(t)) return "lead";
  if (/\b(engineering|software|data|design|people|team|group)\s+manager\b|\bmanager,\s*(engineering|software)\b|\bsenior\s+manager\b/.test(t)) return "lead";
  if (/\b(senior|sr\.?|staff|principal)\b/.test(t) || /\b(iii|iv|v)\s*$/.test(t)) return "senior";
  if (/\b(junior|jr\.?|entry[- ]level|new\s+grad(?:uate)?|graduate|early[- ]career|associate)\b/.test(t) || /\bi\s*$/.test(t)) return "entry";
  if (/\b(mid[- ]level|intermediate)\b/.test(t) || /\bii\s*$/.test(t)) return "mid";
  return null;
}

/**
 * The level a posting's stated experience requirement implies — "5+ years of experience" — from the
 * SMALLEST requirement it states (a range's floor, and the lowest of several: "3+ years, 5+
 * preferred" is open at 3). null when it states none. 0–1 years -> entry · 2–4 -> mid · 5+ -> senior.
 */
const YEARS_RE = /\b(\d{1,2})\s*(?:\+|[-–]\s*\d{1,2}|to\s+\d{1,2})?\s*\+?\s*(?:years?|yrs?)['’]?\s+(?:of\s+)?(?:[\w/-]+\s+){0,4}?(?:experience|exp\b)/gi;
export function levelFromYears(description) {
  const text = String(description || "").slice(0, 20000);
  let min = null;
  for (const m of text.matchAll(YEARS_RE)) {
    const n = Number(m[1]);
    if (n > 25) continue;
    if (min == null || n < min) min = n;
  }
  if (min == null) return null;
  return min <= 1 ? "entry" : min <= 4 ? "mid" : "senior";
}

/**
 * The level tag. The title rule first, then the stated years of experience; if both are silent, a
 * stored level is trusted ONLY when it could
 * not be the ingest fallback — i.e. it is not 'mid' and the row was enriched (enrichment read the
 * description). A stored 'mid' cannot be told apart from the fallback and stays NULL.
 */
export function tagLevel({ title, experience_level, enriched_at, description }) {
  const fromTitle = levelFromTitle(title);
  if (fromTitle) return fromTitle;
  const fromYears = levelFromYears(description);
  if (fromYears) return fromYears;
  if (enriched_at && LEVELS.has(experience_level) && experience_level !== "mid") return experience_level;
  return null;
}

// ── FUNCTION ("domain" in the sentence) ─────────────────────────────────────────────────────────
//
// From the classifier's bucket (job_role_map, written from the title at ingest). 'general' is the
// classifier's "matched nothing" and is not a function.
// ⛔⛔ D153 (3): for a bucket that names no function ('general'), the title's D127 verdict decides
// (categoryFunction.js) — only when it is IN SCOPE; a held or unknown title stays NULL (D127's leak
// rule). Without a title (the bucket alone) it is exactly the bucket's function, as before.
export function tagFunction(roleKey, title = null) {
  return functionForRole(roleKey) ?? (title ? functionFromTitle(title, roleKey) : null);
}

// ── EMPLOYMENT TYPE ──────────────────────────────────────────────────────────────────────────────
//
// The stored value when the source stated one; else only what the title says outright. ⛔ Never a
// 'full-time' default — 2,609 of 2,616 rows have no stated type, and calling them full-time would be
// the 'mid' fallback again.
export function tagEmployment({ title, employment_type, description }) {
  if (EMPLOYMENTS.has(employment_type)) return employment_type;
  const t = String(title || "").toLowerCase();
  if (/\b(intern(?:ship)?|co-?op)\b/.test(t)) return "internship";
  if (/\b(contract(?:or)?|freelance|temporary|temp)\b/.test(t)) return "contract";
  if (/\bpart[- ]time\b/.test(t)) return "part-time";
  if (/\bfull[- ]time\b/.test(t)) return "full-time";
  // The description, only where it states the arrangement of THIS role.
  const d = String(description || "").slice(0, 20000).toLowerCase();
  if (/\b(?:role|position|job)\s+is\s+(?:a\s+)?contract\b|\b\d{1,2}[- ]month\s+contract\b|\bcontract\s+(?:role|position)\b/.test(d)) return "contract";
  if (/\bpart[- ]time\s+(?:role|position|job)\b/.test(d)) return "part-time";
  if (/\bfull[- ]time\b/.test(d)) return "full-time";
  return null;
}

// ── ONE ROW ──────────────────────────────────────────────────────────────────────────────────────

/** The inputs a tag depends on, hashed. A change to any of them re-tags the row. */
export function tagBasis(row) {
  const parts = [TAGGER_VERSION, row.title, row.location, row.workplace_type, row.employment_type,
    row.experience_level, row.enriched_at ? 1 : 0, row.role_key, row.description_length ?? 0,
    row.description_basis ?? null];
  return crypto.createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
}

/** Every derived tag for one posting. Pure. */
/** D59 · the label block's location and workstyle, from description_fields (JSON or object). */
function labelFieldsOf(row) {
  const raw = row.description_fields;
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export function deriveTags(row) {
  const labels = labelFieldsOf(row);
  const places = parsePlaces(row.location);
  // A label-block location ("Location: US-MA-MARLBOROUGH-MA2 …") is a place the posting names too.
  if (labels.location && labels.location !== row.location) {
    for (const p of parsePlaces(labels.location)) {
      if (!places.some(q => q.country === p.country && q.state === p.state && q.metro === p.metro)) places.push(p);
    }
    const specificUs = places.some(p => p.country === "US" && (p.state || p.metro));
    if (specificUs) for (let i = places.length - 1; i >= 0; i--) if (places[i].country === "US" && !places[i].state && !places[i].metro) places.splice(i, 1);
  }
  // ⭐ D71: the place on a pay line ("USA, MA, Boston - 143,700.00 - …") is a place the posting names.
  for (const l of labels.pay?.locations || []) {
    for (const p of parsePlaces(l.city ? `${l.city}, ${l.state}` : l.state)) {
      if (!places.some(q => q.country === p.country && q.state === p.state && q.metro === p.metro)) places.push(p);
    }
  }
  if (places.some(p => p.country === "US" && (p.state || p.metro))) {
    for (let i = places.length - 1; i >= 0; i--) if (places[i].country === "US" && !places[i].state && !places[i].metro) places.splice(i, 1);
  }
  // ⭐ D41(d): "Country: United States of America" is positive US evidence for a posting with no place.
  if (labels.countryIsUs && !places.length) places.push({ country: "US", state: null, metro: null });
  const { remote, workplace } = tagWorkplace({ ...row, label_workplace: labels.workplace || null });
  const us = usVerdict(places, remote, row.description);
  // A remote role whose description establishes the US is a US place at country level.
  if (us === "us" && !places.some(p => p.country === "US")) places.push({ country: "US", state: null, metro: null });
  return {
    places, remote, workplace, us,
    level: tagLevel(row),
    job_function: tagFunction(row.role_key, row.title),
    employment: tagEmployment(row),
  };
}

// ── OWNER TAGS (export → tag → import) ───────────────────────────────────────────────────────────

/** The columns an owner may set, with each one's validator. `places` is a set, written "metro:boston;state:MA;us". */
export const OWNER_FIELDS = {
  level:        (v) => LEVELS.has(v),
  job_function: (v) => FUNCTIONS.has(v),
  employment:   (v) => EMPLOYMENTS.has(v),
  workplace:    (v) => WORKPLACES.has(v),
  places:       (v) => parsePlaceList(v) != null,
};

/** "metro:boston;state:MA;us" -> places, or null when any entry is not in the vocabulary. */
export function parsePlaceList(text) {
  const out = [];
  for (const raw of String(text || "").split(/[;|]/).map(s => s.trim()).filter(Boolean)) {
    const [kind, value] = raw.includes(":") ? raw.split(":").map(s => s.trim()) : [raw.toLowerCase(), ""];
    if (kind === "us") out.push({ country: "US", state: null, metro: null });
    else if (kind === "non_us") out.push({ country: "NON_US", state: null, metro: null });
    else if (kind === "state" && US_STATES[value.toUpperCase()]) out.push({ country: "US", state: value.toUpperCase(), metro: null });
    else if (kind === "metro" && METRO_KEYS.has(value)) {
      const m = METROS.find(x => x.value === value);
      out.push({ country: "US", state: m.state, metro: value });
    } else return null;
  }
  return out.length ? out : null;
}

export function formatPlaceList(places) {
  return (places || []).map(p => p.country === "NON_US" ? "non_us"
    : p.metro ? `metro:${p.metro}` : p.state ? `state:${p.state}` : "us").join(";");
}

// ── THE DATABASE PASS ────────────────────────────────────────────────────────────────────────────

const ROWS_SQL = `
  SELECT sj.job_id, sj.title, sj.location, sj.workplace_type, sj.employment_type, sj.experience_level,
         sj.enriched_at, LENGTH(COALESCE(sj.description_text, sj.description)) AS description_length,
         sj.description_basis, sj.description_fields,
         sj.tag_basis, sj.tag_version, sj.tag_owner_json,
         (SELECT m.role_key FROM job_role_map m WHERE m.job_id = sj.job_id AND m.source_profile_id IS NULL
           ORDER BY m.rowid LIMIT 1) AS role_key
    FROM scraped_jobs sj
   WHERE sj.is_active = 1 OR sj.tag_basis IS NULL`;

function ownerOf(row) {
  try { return row.tag_owner_json ? JSON.parse(row.tag_owner_json) : {}; } catch { return {}; }
}

/** Derived tags with the owner's on top. `owner.places` replaces the derived set entirely. */
export function mergeOwner(derived, owner = {}) {
  const t = { ...derived };
  for (const k of ["level", "job_function", "employment", "workplace"]) if (owner[k] != null) t[k] = owner[k];
  if (owner.workplace != null) t.remote = owner.workplace === "remote" ? 1 : 0;
  if (owner.places) {
    t.places = parsePlaceList(owner.places) || t.places;
    t.us = usVerdict(t.places, t.remote, null) === "us" ? "us" : t.us;
  }
  return t;
}

export function writeTags(db, jobId, tags, basis) {
  db.prepare(`UPDATE scraped_jobs SET tag_level = ?, tag_function = ?, tag_employment = ?, tag_workplace = ?,
      tag_remote = ?, tag_us = ?, tag_basis = ?, tag_version = ?, tagged_at = unixepoch() WHERE job_id = ?`)
    .run(tags.level, tags.job_function, tags.employment, tags.workplace, tags.remote, tags.us,
      basis, TAGGER_VERSION, jobId);
  db.prepare("DELETE FROM job_tag_places WHERE job_id = ?").run(jobId);
  const ins = db.prepare("INSERT INTO job_tag_places (job_id, country, state, metro) VALUES (?, ?, ?, ?)");
  for (const p of tags.places) ins.run(jobId, p.country, p.state, p.metro);
}

/**
 * Tag every posting whose inputs changed since it was last tagged (or that never was). Idempotent:
 * a second pass over an unchanged board touches nothing. Never fatal to a caller — it returns counts.
 * @returns {{ scanned: number, tagged: number }}
 */
export function tagStaleJobs(db, { all = false, limit = Infinity, range = null } = {}) {
  // ⭐ 44p: iterate and stop at `limit` stale rows (the 10-minute pass's slices, server.js) — at 81k postings a scan that
  // materialised and re-tagged the whole backlog held the event loop for minutes. The writes wait for the scan to end
  // (better-sqlite3 allows no write while a statement is iterating). `scanned` = the rows read before it stopped.
  // ⛔ A123 (8): on a SETTLED board the limit is never reached, so the scan read every active row (22.5 s of the 66297c3
  // boot, cold). `range` ({ from, to }, rowidWalk.js) bounds it to a rowid range — the server walks the board in them.
  const rows = [];
  let scanned = 0;
  const sql = range ? `${ROWS_SQL.replace("WHERE sj.is_active = 1 OR sj.tag_basis IS NULL", "WHERE (sj.is_active = 1 OR sj.tag_basis IS NULL)")}${rangeSql(range, "sj.")}` : ROWS_SQL;
  for (const row of db.prepare(sql).iterate(...rangeParams(range))) {
    scanned++;
    const basis = tagBasis(row);
    if (!all && row.tag_basis === basis && row.tag_version === TAGGER_VERSION) continue;
    rows.push({ row, basis });
    if (rows.length >= limit) break;
  }
  // D59: the normalised text when there is one — raw HTML's `text-align` is not a phrase about the role.
  const descStmt = db.prepare("SELECT COALESCE(description_text, description) AS description FROM scraped_jobs WHERE job_id = ?");
  let tagged = 0;
  db.transaction(() => {
    for (const { row, basis } of rows) {
      const description = descStmt.get(row.job_id)?.description || "";
      const tags = mergeOwner(deriveTags({ ...row, description }), ownerOf(row));
      writeTags(db, row.job_id, tags, basis);
      tagged++;
    }
  })();
  return { scanned, tagged };
}

/**
 * Coverage per tag over the active board — "a filter is only as good as the share of rows carrying
 * the tag" (D29). Each entry: { tag, known, total, share }.
 */
export function tagCoverage(db) {
  const total = db.prepare("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1").get().n;
  const one = (sql) => db.prepare(sql).get().n;
  const placeHas = (cond) => one(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE sj.is_active = 1 AND EXISTS
      (SELECT 1 FROM job_tag_places p WHERE p.job_id = sj.job_id AND ${cond})`);
  const rows = [
    ["country", placeHas("1 = 1")],
    ["state", placeHas("p.state IS NOT NULL")],
    ["metro", placeHas("p.metro IS NOT NULL")],
    ["remote", one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_remote IS NOT NULL")],
    ["workplace", one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_workplace IS NOT NULL")],
    ["level", one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_level IS NOT NULL")],
    ["job_function", one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_function IS NOT NULL")],
    ["employment", one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_employment IS NOT NULL")],
  ];
  return {
    total,
    tags: rows.map(([tag, known]) => ({ tag, known, total, share: total ? Math.round((known / total) * 1000) / 10 : 0 })),
    untagged: one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_basis IS NULL"),
  };
}
