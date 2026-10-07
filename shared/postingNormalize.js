/**
 * ⛔ D59 · POSTINGS THAT ARRIVE AS RAW HTML AND LABEL BLOCKS — ONE NORMALISER, EVERY SOURCE.
 *
 * The owner pasted an imported RTX posting whose stored text was RAW HTML —
 * `<p style=\"text-align:left\"><b>Date Posted:</b></p>2026-08-26…` — with backslash-escaped quotes,
 * opening with a block of `Label: value` lines. The posting panel ESCAPES the description (React text),
 * so the tags showed as literal text. ⛔ The tempting fix — render the HTML — would be a STORED-XSS hole:
 * captured and crawled descriptions are third-party content, and a capture lands in the SHARED pool, so
 * a hostile page would run its markup in every user's browser.
 *
 * So markup is converted to TEXT here, through an allow-list, and the panel renders that text as React
 * elements (shared/postingFormat.js → components/PostingPanel.jsx) — never as injected HTML:
 *
 *   ALLOWED   p br ul ol li b strong i em h1–h6 a — their STRUCTURE survives as paragraphs, "• " bullets
 *             and standalone heading lines; their attributes never do (no style, no on*, no href).
 *   DROPPED   everything else. script / style / iframe / noscript / template / svg / object / embed are
 *             dropped WITH their contents; any other tag is dropped and its words kept.
 *   DECODED   entities, including `&lt;p&gt;`-escaped HTML (Greenhouse ships that), repeated until no
 *             markup remains — a doubly-encoded `&amp;lt;script&amp;gt;` cannot come back as a tag.
 *   UNESCAPED a stray `\"` (and `\'`, `\/`) — JSON escaping that leaked into the stored text.
 *
 * ⛔ A PLAIN-TEXT DESCRIPTION IS LEFT ALONE. Greenhouse, Lever and Ashby already store plain text
 * (services/jobs/htmlToText.js at ingest); on such text this changes nothing but entities, stray `\"`
 * and a leading label block — no whitespace is touched — so a posting's ATS score moves only where its
 * text really changed (D59 part 5).
 *
 * Then the LABEL BLOCK (part 2): a leading run of `Label: value` lines is structured data in prose
 * clothing. Known labels (LABEL_VOCABULARY) become fields and leave the body, so they are not shown
 * twice; unknown labels stay in the text. And CODED LOCATIONS (part 3):
 * `US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd BLDG 2` is country-state-CITY-site + a street — the street
 * kept apart, because "Boston Post Rd" is a road, not the city of Boston.
 *
 * ⛔ D17: deterministic string handling, no model call. Shared (server + client) so the ingest pass and
 * the panel's render-time re-check run the SAME code.
 */

/** Bump when a rule here changes: every stored description_text is recomputed on the next pass. */
export const NORMALIZER_VERSION = 1;

// ── ENTITIES ─────────────────────────────────────────────────────────────────────────────────────
const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ", thinsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„",
  hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", laquo: "«", raquo: "»",
  shy: "", zwj: "", zwnj: "", lrm: "", rlm: "", deg: "°", plusmn: "±", times: "×", divide: "÷",
  cent: "¢", pound: "£", euro: "€", yen: "¥", sect: "§", para: "¶", frac12: "½", frac14: "¼", frac34: "¾",
  rarr: "→", larr: "←", eacute: "é", egrave: "è", aacute: "á", oacute: "ó", iacute: "í", uacute: "ú",
  ntilde: "ñ", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
};

export function decodeEntities(str) {
  return String(str).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10FFFF && !(code >= 0xD800 && code <= 0xDFFF)
        ? String.fromCodePoint(code) : match;
    }
    const v = NAMED[body.toLowerCase()];
    return v !== undefined ? v : match;
  });
}

/** `\"` → `"` (and `\'`, `\/`): JSON escaping that leaked into a stored description. */
export function unescapeStray(str) {
  return String(str).replace(/\\(["'/])/g, "$1");
}

// ── MARKUP ───────────────────────────────────────────────────────────────────────────────────────
// A real tag name, so "salary < $100k" or "a <-> b" in plain text is never read as markup.
const TAG_NAMES = "p|br|ul|ol|li|b|strong|i|em|h[1-6]|a|div|span|font|u|s|strike|table|tbody|thead|tfoot|tr|td|th|" +
  "section|article|header|footer|main|nav|aside|script|style|iframe|img|noscript|svg|object|embed|hr|blockquote|" +
  "pre|code|sup|sub|small|big|center|label|input|form|button|select|option|textarea|meta|link|template|title|" +
  "head|body|html|dl|dt|dd|figure|figcaption|picture|source|video|audio|base|frame|frameset|applet|math|details|summary";
const MARKUP_RE = new RegExp(`<\\/?(?:${TAG_NAMES})(?=[\\s/>])[^>]*>`, "i");
const ENCODED_MARKUP_RE = new RegExp(`&(?:amp;)*lt;\\s*\\/?(?:${TAG_NAMES})(?=[\\s/&])`, "i");

/** Does this text carry HTML (literal, entity-encoded, or with JSON-escaped quotes)? */
export function looksLikeMarkup(text) {
  const s = String(text || "");
  return MARKUP_RE.test(s) || ENCODED_MARKUP_RE.test(s) || /\\"/.test(s);
}

// Containers whose CONTENTS are code or chrome, never posting prose — dropped whole.
const DROP_WHOLE = ["script", "style", "iframe", "noscript", "template", "svg", "object", "embed", "applet",
  "textarea", "select", "button", "head", "title", "math", "frameset", "frame", "audio", "video"];
const DROP_WHOLE_RE = new RegExp(`<(${DROP_WHOLE.join("|")})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi");
// An opening tag of one of those with no close: everything after it is the container's.
const DROP_UNCLOSED_RE = new RegExp(`<(?:${DROP_WHOLE.join("|")})\\b[^>]*>[\\s\\S]*$`, "i");
const BLOCK_TAGS = new Set(["div", "section", "article", "header", "footer", "main", "nav", "aside", "table", "tbody",
  "thead", "tfoot", "tr", "blockquote", "pre", "hr", "dl", "dt", "dd", "figure", "figcaption", "center", "form",
  "details", "summary", "body", "html"]);

/**
 * HTML → structured plain text, through the allow-list. Paragraphs become blank-line breaks, list items
 * "• " lines, headings standalone lines; every attribute is discarded; text nodes are entity-decoded and
 * their whitespace collapsed (HTML semantics: a newline in source is a space).
 */
function markupToText(html) {
  let s = String(html)
    .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
    .replace(/<!\[CDATA\[[\s\S]*?(?:\]\]>|$)/gi, " ")
    .replace(/<![^>]*>/g, " ")
    .replace(DROP_WHOLE_RE, " ")
    .replace(DROP_UNCLOSED_RE, " ");
  const out = [];
  const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|<\/?[a-zA-Z][^>]*$/g;
  let at = 0;
  const text = (chunk) => {
    // A stray "<" or ">" left in a text node is a character, not a tag; React renders it inert.
    const t = decodeEntities(chunk).replace(/[\s ]+/g, " ");
    if (t) out.push(t);
  };
  for (const m of s.matchAll(TAG)) {
    text(s.slice(at, m.index));
    at = m.index + m[0].length;
    const name = (m[1] || "").toLowerCase();
    const closing = m[0][1] === "/";
    if (name === "br") out.push("\n");
    else if (name === "p" || /^h[1-6]$/.test(name) || name === "ul" || name === "ol") out.push("\n\n");
    else if (name === "li") out.push(closing ? "\n" : "\n• ");
    else if (BLOCK_TAGS.has(name)) out.push("\n");
    else if (name === "td" || name === "th") out.push(" ");
    // b strong i em a span font … : inline — the words stay, the tag (and every attribute) goes.
  }
  text(s.slice(at));
  return out.join("")
    .split("\n").map(l => l.replace(/ {2,}/g, " ").replace(/^ +| +$/g, "")).join("\n")
    .replace(/^•\s*$/gm, "")          // an empty list item carries no words
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The posting's TEXT, markup-free. Plain text in → the same text out, except entities and stray `\"`.
 * Repeats while markup remains (encoded-inside-encoded), at most four rounds.
 */
export function postingPlainText(raw) {
  if (raw == null) return "";
  let s = unescapeStray(String(raw));
  for (let round = 0; round < 4; round++) {
    if (ENCODED_MARKUP_RE.test(s) && !MARKUP_RE.test(s)) s = decodeEntities(s);
    if (MARKUP_RE.test(s)) { s = markupToText(s); continue; }
    break;
  }
  // Plain text: entities only. A decode that would MAKE a tag (`&lt;b&gt;` in prose) goes round again.
  if (/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/i.test(s)) {
    const d = decodeEntities(s);
    s = MARKUP_RE.test(d) ? markupToText(d) : d;
  }
  // ⛔ Belt and braces: whatever survived is shown as TEXT, but no tag-shaped string is ever left in
  // the stored text — a `<script` that slipped every rule above is removed here, not rendered.
  return MARKUP_RE.test(s) ? s.replace(new RegExp(MARKUP_RE.source, "gi"), " ").replace(/[ \t]{2,}/g, " ") : s;
}

// ── LABEL BLOCKS ─────────────────────────────────────────────────────────────────────────────────
//
// Each known label, as a normalised key ("Position Role Type" → "position role type") matched by one
// rule. Unknown labels stay in the text. ⚠ "Position Type: Full-time" is an EMPLOYMENT type, not a
// workstyle — readFields moves a role-type value that names one.
export const LABEL_VOCABULARY = Object.freeze([
  { key: "datePosted",     re: /^(?:date posted|posted date|posting date|posted on|date of posting|job posted|posted)$/ },
  { key: "country",        re: /^(?:country|country region|job country|country of work)$/ },
  { key: "location",       re: /^(?:location|locations|job location|work location|primary location|office location|work site|worksite|job site)$/ },
  { key: "roleType",       re: /^(?:position role type|role type|position type|work type|workplace type|work arrangement|work model|work style|workstyle|work location type|remote type|on site remote|onsite remote|work mode)$/ },
  { key: "citizenship",    re: /citizen|immigration status|export control|^u s persons?$|^us persons?$/ },
  { key: "clearanceType",  re: /^(?:(?:security|dod|government|federal)\s+)?clearance(?:\s+(?:type|level|required|requirement|requirements))?$|^(?:security|dod|government)\s+clearance(?:\s+type)?$|^type of clearance$|^clearance type required$/ },
  { key: "clearanceStatus", re: /^(?:security\s+)?clearance status$/ },
  { key: "clearanceAtStart", re: /^clearance required (?:for|at|prior to|before) start$/ },
  { key: "relocation",     re: /^relocation(?: assistance| available| eligible| assistance available| package| offered| provided)?$/ },
  { key: "travel",         re: /^travel(?: required| requirements?| percentage| percent| expectations?)?$|^(?:percent|percentage|amount) (?:of )?travel(?: required)?$/ },
  { key: "requisitionId",  re: /^(?:req|requisition|job requisition)(?: id| number| no)?$|^(?:job|posting|position) (?:id|number|no)$/ },
  { key: "employmentType", re: /^(?:employment type|job type|worker type|employee type|time type|schedule type|position schedule|full part time|full time part time|employment status)$/ },
  { key: "payRange",       re: /^(?:pay range|salary range|compensation range|base pay range|base salary range|hiring range|pay rate|salary|pay|compensation|base pay|base salary|pay grade range|annual salary range)$/ },
]);

const labelKey = (label) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function knownLabel(label) {
  const k = labelKey(label);
  return LABEL_VOCABULARY.find(v => v.re.test(k))?.key || null;
}

// "Label: value" — a short label that starts with a capital, then a colon.
const LABEL_LINE = /^([A-Z][A-Za-z0-9 .,/&()'’-]{0,90}?)\s*:\s*(.*)$/;
const BULLET_LINE = /^\s*(?:[•·▪◦‣●○■□*–—-]|\d{1,2}[.)])\s+/;
const MAX_SAME_LINE_VALUE = 300;
const MAX_NEXT_LINE_VALUE = 160;

function labelLine(line) {
  const m = LABEL_LINE.exec(line.trim());
  if (!m) return null;
  const label = m[1].trim();
  if (label.split(/\s+/).length > 10 || /https?$/i.test(label)) return null;
  return { label, value: m[2].trim() };
}

/**
 * The leading label block → { fields, body }. Known labels are taken (first value wins) and their lines
 * removed; unknown ones stay where they are; the block ends at the first line that is not a label.
 */
export function extractLabelBlock(text) {
  const lines = String(text || "").split("\n");
  const drop = new Set();
  const raw = {};
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }
    const ll = labelLine(lines[i]);
    if (!ll) break;
    let { value } = ll;
    let end = i;
    if (!value) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const next = j < lines.length ? lines[j].trim() : "";
      // A lone "Responsibilities:" over bullets, or over another empty label, is a heading — the block
      // is over. A value that itself has a colon ("Security Clearance Type:" / "DoD Clearance: Secret")
      // is still this label's value.
      if (!next || next.length > MAX_NEXT_LINE_VALUE || BULLET_LINE.test(next) || labelLine(next)?.value === "") break;
      value = next; end = j;
    }
    if (value.length > MAX_SAME_LINE_VALUE) break;
    const key = knownLabel(ll.label);
    if (key) {
      if (raw[key] == null) raw[key] = value;
      for (let k = i; k <= end; k++) drop.add(k);
      // The blank lines that only separated this field from the next one go with it.
      let k = end + 1;
      while (k < lines.length && !lines[k].trim()) { drop.add(k); k++; }
    }
    i = end + 1;
  }
  if (!drop.size) return { fields: {}, body: String(text || "") };
  // The unknown labels the block kept, then ONE blank line, then the body — so a kept "Telecommute: No"
  // never runs into the first line of the description.
  const kept = lines.slice(0, i).filter((_, k) => !drop.has(k)).join("\n").trim();
  const rest = lines.slice(i).join("\n").replace(/^\n+/, "");
  const body = [kept, rest].filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n");
  return { fields: raw, body };
}

// ── FIELD VALUES ─────────────────────────────────────────────────────────────────────────────────
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
function isoDate(y, m, d) {
  if (!(y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  return back.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}
/** "2026-08-26" · "08/26/2026" · "August 26, 2026" · "26 Aug 2026" → "2026-08-26", else null. */
export function parsePostedDate(value) {
  const v = String(value || "").trim();
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(v))) return isoDate(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(v))) return isoDate(+m[3], +m[1], +m[2]);
  const month = (w) => MONTHS[String(w).slice(0, 3).toLowerCase()] ?? null;
  if ((m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/.exec(v)) && month(m[1])) return isoDate(+m[3], month(m[1]), +m[2]);
  if ((m = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(v)) && month(m[2])) return isoDate(+m[3], month(m[2]), +m[1]);
  return null;
}

/** ⭐ D41(d): `Country: United States of America` is POSITIVE US evidence. */
export function isUsCountry(value) {
  return /^(?:the\s+)?(?:united states(?: of america)?|u\.?s\.?a?\.?|usa|us|america)$/i.test(String(value || "").trim());
}

export function workplaceOf(value) {
  const v = String(value || "").toLowerCase();
  if (/\bhybrid\b/.test(v)) return "hybrid";
  if (/\bremote\b|\btelecommut|\bwork from home\b/.test(v)) return "remote";
  if (/\bon-?\s?site\b|\bin[- ]office\b|\bin[- ]person\b/.test(v)) return "onsite";
  return null;
}

export function employmentOf(value) {
  const v = String(value || "").toLowerCase();
  if (/\bintern(ship)?\b|\bco-?op\b/.test(v)) return "internship";
  if (/\bpart[- ]?time\b/.test(v)) return "part-time";
  if (/\bcontract(or)?\b|\btemporary\b|\btemp\b/.test(v)) return "contract";
  if (/\bfull[- ]?time\b|\bregular\b|\bpermanent\b/.test(v)) return "full-time";
  return null;
}

// US state codes and names, for the coded-location reader. (A copy of the 51 — shared/ cannot import
// services/jobs/usLocation.js, and the client must run this too.)
const STATE_CODES = new Set("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "));
const STATE_NAMES = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

/**
 * ⭐ D59 part 3 · A CODED LOCATION — `country-state-CITY[-site] [street]`.
 *   "US-MA-MARLBOROUGH-MA2 1001 Boston Post Rd BLDG 2" → { country: "US", state: "MA", city: "Marlborough",
 *     site: "MA2", street: "1001 Boston Post Rd BLDG 2" }
 *   "United States-Virginia-Chantilly"                  → { country: "US", state: "VA", city: "Chantilly" }
 * ⛔ The street is kept APART: "Boston Post Rd" is a road in Marlborough, and a substring matcher reading
 * it tags the job "in Boston" (D42's exact bug). Whether Marlborough is Greater Boston is a METRO
 * question this does not answer. null when the string is not one of these shapes.
 */
export function parseCodedLocation(raw) {
  const s = String(raw || "").trim().replace(/\s+/g, " ");
  let m = /^(US|USA)-([A-Z]{2})-([A-Za-z][A-Za-z .'’]*?[A-Za-z])(?:-([A-Za-z0-9]{1,8}))?(?:\s+(\d[\s\S]*))?$/.exec(s);
  if (m && STATE_CODES.has(m[2].toUpperCase())) {
    return { country: "US", state: m[2].toUpperCase(), city: titleCase(m[3]), site: m[4] ? m[4].toUpperCase() : null,
      street: m[5] ? m[5].trim() : null };
  }
  m = /^(United States(?: of America)?|USA|US)\s*-\s*([A-Za-z .]+?)\s*-\s*([A-Za-z][A-Za-z .'’]*[A-Za-z])(?:\s*-\s*([A-Za-z0-9]{1,8}))?$/i.exec(s);
  if (m) {
    const st = STATE_NAMES[m[2].trim().toLowerCase()] || (STATE_CODES.has(m[2].trim().toUpperCase()) ? m[2].trim().toUpperCase() : null);
    if (st) return { country: "US", state: st, city: titleCase(m[3].trim()), site: m[4] ? m[4].toUpperCase() : null, street: null };
  }
  return null;
}

/** "Marlborough, MA" for a coded location; the value as written otherwise. */
export function locationLabel(raw) {
  const c = parseCodedLocation(raw);
  return c ? `${c.city}, ${c.state}` : (String(raw || "").trim() || null);
}

/** The label block's raw values → the posting's fields, each read deterministically or left null. */
export function readFields(raw) {
  const f = {};
  if (raw.datePosted) { f.datePosted = raw.datePosted; f.postedAt = parsePostedDate(raw.datePosted); }
  if (raw.country) { f.country = raw.country; f.countryIsUs = isUsCountry(raw.country); }
  if (raw.location) {
    f.location = raw.location;
    const coded = parseCodedLocation(raw.location);
    if (coded) f.codedLocation = coded;
    f.locationLabel = locationLabel(raw.location);
  }
  if (raw.roleType) {
    f.roleType = raw.roleType;
    f.workplace = workplaceOf(raw.roleType);
    if (!f.workplace && employmentOf(raw.roleType) && !raw.employmentType) raw = { ...raw, employmentType: raw.roleType };
  }
  if (raw.employmentType) { f.employmentType = raw.employmentType; f.employment = employmentOf(raw.employmentType); }
  for (const k of ["citizenship", "clearanceType", "clearanceStatus", "clearanceAtStart", "relocation", "travel", "requisitionId", "payRange"]) {
    if (raw[k]) f[k] = raw[k];
  }
  return f;
}

/**
 * THE ONE NORMALISER. `raw` is the stored description, whatever its source.
 * @returns {{ text: string, fields: object, changed: boolean, hadMarkup: boolean }}
 *   text     the body to show and score — markup-free, the known label lines removed
 *   fields   readFields' output ({} when there is no label block)
 *   changed  text !== raw (false: description_text need not be stored — it IS the description)
 */
export function normalizePosting(raw) {
  const source = raw == null ? "" : String(raw);
  const hadMarkup = looksLikeMarkup(source);
  const plain = postingPlainText(source);
  const { fields: labels, body } = extractLabelBlock(plain);
  const text = body.trim() === "" && plain.trim() !== "" && !Object.keys(labels).length ? plain : body;
  return { text, fields: readFields(labels), changed: text !== source, hadMarkup };
}

/** The panel's render-time re-check: text that still carries markup is normalised before it is drawn. */
export function textForRender(text) {
  const s = String(text || "");
  return looksLikeMarkup(s) || /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/i.test(s) ? postingPlainText(s) : s;
}
