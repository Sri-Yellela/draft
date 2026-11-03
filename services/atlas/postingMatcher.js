// services/atlas/postingMatcher.js — ⭐ THE ONE MATCHER: how a posting asks for an Atlas node.
//
// Read by every count and link of the Atlas, so they never disagree about what "asked for in N postings" means:
//   · the nightly board stats and board edges (atlasStats.js computeAtlasStats)
//   · YOUR MAP and the role / level maps (atlasMe.js, through atlasStats.js roleLevelsOfBoard)
//   · D114's linkable terms in one posting (atlasLinks.js atlasTermsFor)
//   · ⭐ D118 P1: the per-ingest pass (atlasLive.js) — one posting re-read when it is ingested, changed or closed
// ⛔ Nothing else matches a posting's text against the Atlas (matcherOneCopy).
//
// A posting's TITLE names a role (longest role first, so "Senior Backend Engineer" is not also "Engineer"); its title
// and the COUNTED part of its text ask for a skill / tool / concept / … when the node's term or a confirmed alias is a
// 1–4-word run of that text, through the scorer's own normalisation (normaliseAtsTerm), so "REST APIs" in a posting is
// "rest api" here exactly as it is for the score. A word that is also English (AMBIGUOUS_TERMS) counts only when the
// posting's own skills list names it.
//
// ⭐ BUG 10-31 — BOILERPLATE COUNTS AS SKILLS (owner: "yes to the boilerplate"). Measured on a copy of the local board:
// "CDN" 570 postings (OpenAI's EEO-policy URL, cdn.openai.com, in every OpenAI posting), "Interpretability" 446
// (Anthropic's about-us "reliable, interpretable, and steerable AI systems"), "Attention" 115 ("attention to detail").
// The text a posting's skills are read from is now:
//   (1) WITHOUT THE COMPANY'S BOILERPLATE — a sentence (normalised) in ≥ 30 % of a company's active postings, and in
//       ≥ 3 of them, is that company's boilerplate and is not matched. Kept per company in memory as sentence COUNTS
//       (hashed). ⭐ D118 P1: once the live store has a baseline the cache is keyed on its version, and the per-ingest
//       pass (atlasLive.js) adjusts only the company of the posting that changed — no other company is rebuilt. The
//       nightly pass fills every company in one pass. (Before a baseline: keyed on the active board, as before.)
//   (2) THE REQUIREMENTS, when the posting has them — when the text has a requirements / qualifications / "what you'll
//       bring" / "you have" heading, skills are counted from the requirements sections and the responsibilities
//       sections only; the text before the first such heading (except a responsibilities section), and benefits /
//       EEO / "about us" sections, are not counted. No such heading → (1) only.
//   (3) CONCEPTS (D115's tracker terms — single technical words English also uses) shorter than 5 characters match
//       only as the whole term in their exact casing ("CDN", "CDNs" — never "cdn.openai.com"), and no concept is
//       matched inside a common phrase of the one list (shared/atlasCommonPhrases.js: "attention to detail" …).
// Every threshold is in POSTING_MATCH below, and only there.

import { normaliseAtsTerm } from "../localAtsScorer.js";
import { aliasesOf } from "./atlasStore.js";
import { roleTitles } from "./atlasRoles.js";
import { maskCommonPhrases, COMMON_PHRASE_RE } from "../../shared/atlasCommonPhrases.js";

export const POSTING_MATCH = Object.freeze({
  /** a run of the text is at most this many words (the longest node term the matcher needs, up to this) */
  MAX_GRAM: 4,
  /** a posting's text is read up to this many characters */
  TEXT_CHARS: 30000,
  /** (1) a sentence in at least this share of a company's active postings is the company's boilerplate… */
  BOILERPLATE_SHARE: 0.30,
  /** (1) …and in at least this many of them (one posting's sentence is never "repeated") */
  BOILERPLATE_MIN_POSTINGS: 3,
  /** (1) …and at least this many words long: a short line ("Python", "Experience with Go") repeated across one
   *  company's similar roles is a requirement, not boilerplate. Boilerplate is prose (EEO, about us, benefits). */
  BOILERPLATE_MIN_WORDS: 6,
  /** (3) a concept whose name is shorter than this matches only as the whole term in its exact casing */
  SHORT_CONCEPT_CHARS: 5,
});

// ⛔ The scorer's rule for words that are also English (packages/ats-scorer/src/scorer.js AMBIGUOUS_SKILL_WORDS — not
// exported by the package, so mirrored here; "can" added: the embedded registry's CAN bus): such a term counts for a
// posting only when the posting's own skills list names it. "Trust the reader, not the substring."
export const AMBIGUOUS_TERMS = new Set([
  "go", "r", "c", "swift", "rust", "dart", "ruby", "scratch", "processing", "spring", "struts",
  "unity", "shell", "bash", "spark", "hive", "pig", "storm", "kafka", "flink", "beam", "arrow", "can",
]);

// ⭐ D116 · the board's postings — defined once, read by the stats pass, YOUR MAP and the boilerplate index.
export const ACTIVE_POSTINGS_WHERE = "is_active = 1 AND duplicate_of IS NULL";
export const POSTING_TEXT_SQL = "title, company, COALESCE(description_text, description) AS text, skills_json";

export function skillKeysOf(json) {
  try {
    const arr = JSON.parse(json || "[]");
    return new Set((Array.isArray(arr) ? arr : []).map(e => normaliseAtsTerm(typeof e === "string" ? e : e?.skill)).filter(Boolean));
  } catch { return new Set(); }
}

function addGrams(set, text, maxGram) {
  const words = normaliseAtsTerm(text).split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    let g = "";
    for (let k = 0; k < maxGram && i + k < words.length; k++) { g = k ? `${g} ${words[i + k]}` : words[i]; set.add(g); }
  }
  return set;
}

// ── (2) the sections ─────────────────────────────────────────────────────────────────────────────

// Measured 10-31 on the local board: "Ideally you'd have:" (Scale AI) and "Preferred skills" are requirements too.
const REQUIREMENTS = [
  /^(minimum|basic|preferred|required|key|desired|additional|technical|bonus|ideal|core|job)? ?(qualifications?|requirements?)\b/,
  /\b(qualifications|requirements)$/,
  /^(skills|experience|skills (and|&) experience|experience (and|&) (skills|qualifications)|what we look for|must[- ]haves?|nice[- ]to[- ]haves?|bonus points|preferred|desired|pluses|bonus)$/,
  /^(minimum|basic|preferred|required|desired|additional|technical|bonus|key|relevant) (skills|experience)\b/,
  /^ideally\b/,
  /^(you|you'd|you would|you should|you'll|you will) (ideally )?(have|bring|need)\b/,
  /^what (you'll|you will|you'd|you) (bring|need|have)\b/,
  /^what (we're|we are|we) (looking for|look for|need|want)\b/,
  /^you('ll| will| would|'d) (need|thrive|be a (great|good|strong) fit)\b/,
  /^(you have|you bring|you are|you might thrive|you may be a good fit|you could be|you should have|who you are|about you|is this you|ideal candidate|the ideal candidate|strong candidates|we'd love to hear from you|we would love to hear from you|your (background|experience|skills|qualifications|profile|toolkit)|who we're looking for|who we are looking for)\b/,
];
const RESPONSIBILITIES = [
  /^(key |core |primary |main |your |job |role )?(responsibilities|duties)\b/,
  /\bresponsibilities$/,
  /^what (you'll|you will|you'd|you) (do|be doing|work on|own|achieve|accomplish)\b/,
  /^(in this role|in the role|day[- ]to[- ]day|your (impact|role|day|mission)|the role you('ll| will) play|you will|you'll|what the (role|job) involves|what this role involves)\b/,
];
const NOT_COUNTED = [
  /^(benefits|perks|compensation|pay|salary|total rewards|rewards)\b/,
  /^(what we offer|we offer|our offer|why join|why work|why you'll love|what's in it for you|equal (employment )?opportunity|eeo|diversity|accommodations?|privacy|disclaimer|legal|e-verify|everify|export control|background check|logistics|locations?|work location|visa|how we're different|come work with us|our (mission|values|culture|benefits|story|commitment)|life at|working at|who we are|culture)\b/,
  /^about\b/,
  /\b(compensation|salary|pay) (range|transparency|and benefits)\b/,
  /^(the )?(annual|base|expected) (salary|compensation|pay|base)\b/,
];

/**
 * A line's heading kind: 'requirements' | 'responsibilities' | 'skip' (benefits, EEO, about us…) | 'other' (an
 * unknown "Something:" heading) | null (not a heading).
 */
export function headingKind(line) {
  const raw = String(line ?? "").trim();
  if (!raw || raw.length > 90 || /^([•·▪◦‣–—-]|\*\s)/.test(raw)) return null;
  const h = raw.replace(/^[#*_\s]+/, "").replace(/[*_\s]+$/, "").replace(/[’‘]/g, "'");
  const colon = /:$/.test(h);
  const t = h.replace(/:$/, "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || /[.!?;,]$/.test(t) || t.split(" ").length > 10) return null;
  if (REQUIREMENTS.some(r => r.test(t))) return "requirements";
  if (RESPONSIBILITIES.some(r => r.test(t))) return "responsibilities";
  if (NOT_COUNTED.some(r => r.test(t))) return "skip";
  return colon ? "other" : null;
}

/** The lines a posting's skills are read from — (2): all of them when the text has no requirements heading. */
export function countedLines(text) {
  const lines = String(text ?? "").slice(0, POSTING_MATCH.TEXT_CHARS).split(/\r?\n/);
  const kinds = lines.map(headingKind);
  const firstReq = kinds.indexOf("requirements");
  if (firstReq === -1) return lines;
  const out = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    if (kinds[i]) cur = kinds[i];
    // A requirements / responsibilities heading is read with its section ("Experience with Python:" is a requirement).
    if (cur === "responsibilities" || (i >= firstReq && cur !== "skip")) out.push(lines[i]);
  }
  return out;
}

// ── (1) the company's boilerplate ────────────────────────────────────────────────────────────────

/** The sentences of some lines (a line, split after . ! ?). */
export function sentencesOf(lines) {
  const out = [];
  for (const line of lines) for (const s of line.split(/(?<=[.!?])\s+/)) if (s.trim()) out.push(s);
  return out;
}
/** A sentence's key: lower case, letters and digits only. Too short to be boilerplate → null. */
export function sentenceKey(s) {
  const k = String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!k) return null;
  // The words counted without building them (one space between words after the replace) — this runs on every sentence.
  let words = 1;
  for (let i = k.indexOf(" "); i !== -1 && words < POSTING_MATCH.BOILERPLATE_MIN_WORDS; i = k.indexOf(" ", i + 1)) words++;
  return words >= POSTING_MATCH.BOILERPLATE_MIN_WORDS ? k : null;
}
const keysOfText = (text) => new Set(sentencesOf(String(text ?? "").slice(0, POSTING_MATCH.TEXT_CHARS).split(/\r?\n/)).map(sentenceKey).filter(Boolean));

/**
 * ⭐ D118 P1 · a sentence key's 53-bit hash (two FNV-1a lanes). The company counts and the live store keep sentences as
 * these hashes — the nightly pass and the per-ingest pass judge boilerplate from the SAME numbers, so they cannot
 * disagree (d118NightlyDriftZero).
 */
export function sentenceHash(key) {
  let a = 0x811c9dc5, b = 0x050c5d1f;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619);
    b = Math.imul(b ^ c, 2246822507);
  }
  return (a >>> 0) * 2097152 + ((b >>> 0) & 0x1fffff);
}
/** A posting's distinct sentence hashes (the sentences long enough to be boilerplate). */
export const sentenceHashesOf = (text) => [...new Set([...keysOfText(text)].map(sentenceHash))];

/** The rule itself: a sentence in `c` of a company's `n` active postings is its boilerplate. */
export const isBoilerplateCount = (c, n) => c >= POSTING_MATCH.BOILERPLATE_MIN_POSTINGS && c >= POSTING_MATCH.BOILERPLATE_SHARE * n;

const EMPTY = Object.freeze(new Set());

/** A company's counts → its boilerplate, as the matcher reads it: { size, has(sentenceKey) }. */
export function boilerplateJudge(cc) {
  if (!cc || !cc.n || !cc.counts.size) return EMPTY;
  return { size: cc.counts.size, has: (k) => isBoilerplateCount(cc.counts.get(sentenceHash(k)) || 0, cc.n) };
}

/** A company's sentence counts from its postings' hash lists. byPosting: Map(postingId → hashes) when ids are given. */
export function companyCountsOf(hashLists, ids = null) {
  const counts = new Map();
  const byPosting = new Map();
  hashLists.forEach((hs, i) => {
    for (const h of hs) counts.set(h, (counts.get(h) || 0) + 1);
    if (ids) byPosting.set(ids[i], hs);
  });
  return { n: hashLists.length, counts, byPosting };
}

/** A company's boilerplate from its active postings' texts (pure — the rule itself). @returns { size, has(key) } */
export function boilerplateOfTexts(texts) {
  return boilerplateJudge(companyCountsOf(texts.map(sentenceHashesOf)));
}

export const companyKey = (c) => String(c ?? "").trim().toLowerCase();

// ⭐ D118 P1 · THE PER-COMPANY CACHE. db → { key, companies: Map(companyKey → { n, counts, byPosting }) }.
// Keyed on the LIVE STORE's version once the store has a baseline (atlasLive.js): one ingest moves the version, and the
// per-ingest pass re-keys this cache after adjusting ONLY the companies it touched — every other company's counts are
// kept, never rebuilt. Before the first full pass (no baseline), keyed on the active board as before.
const boilerplateCache = new WeakMap();

/** The live store's version, or null (no store, or no baseline yet). */
export function liveVersion(db) {
  try { return db.prepare(`SELECT v FROM atlas_live_state WHERE k = 'version'`).pluck().get() ?? null; } catch { return null; }
}
/** The active board's version: any crawl that adds, changes or retires a posting changes it. */
function boardKey(db) {
  try {
    return db.prepare(`SELECT COUNT(*) || ':' || COALESCE(SUM(id), 0) || ':' || COALESCE(MAX(updated_at), 0) FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE}`).pluck().get();
  } catch { return null; }
}
function cacheKeyOf(db) {
  const v = liveVersion(db);
  if (v != null) return `live:${v}`;
  const b = boardKey(db);
  return b == null ? null : `board:${b}`;
}
function cacheFor(db, key) {
  let c = boilerplateCache.get(db);
  if (!c || c.key !== key) boilerplateCache.set(db, c = { key, companies: new Map() });
  return c;
}

/** One company's counts — from the live store's rows, else (no baseline) from its active postings' texts. */
export function companyCounts(db, company, key = cacheKeyOf(db)) {
  const ck = companyKey(company);
  if (!ck || key == null) return null;
  const c = cacheFor(db, key);
  let cc = c.companies.get(ck);
  if (!cc) {
    if (key.startsWith("live:")) {
      const rows = db.prepare(`SELECT posting_id, sentences FROM atlas_posting_match WHERE company_key = ?`).all(ck);
      cc = companyCountsOf(rows.map(r => (r.sentences ? r.sentences.split(" ").map(s => parseInt(s, 36)) : [])), rows.map(r => r.posting_id));
    } else {
      const rows = db.prepare(`SELECT id, COALESCE(description_text, description) AS text FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE} AND lower(trim(company)) = ?`).all(ck);
      cc = companyCountsOf(rows.map(r => sentenceHashesOf(r.text)), rows.map(r => r.id));
    }
    c.companies.set(ck, cc);
  }
  return cc;
}

/** One company's boilerplate (its counts, judged). */
export function companyBoilerplate(db, company, key = cacheKeyOf(db)) {
  return boilerplateJudge(companyCounts(db, company, key));
}

/** The live pass adjusted the companies it touched in place and wrote `version`: the cache follows, nothing rebuilt. */
export function companyCacheMoved(db, version) {
  const c = boilerplateCache.get(db);
  if (c) c.key = `live:${version}`;
}
/** Forget every company (a failed live pass, whose in-place changes were rolled back). */
export function companyCacheDrop(db) { boilerplateCache.delete(db); }

/**
 * Every company's counts in one pass over the active board (the nightly stats pass).
 * @returns {{ key, hashes: Map(postingId → hashes) }} the cache key the counts are filed under, and each posting's hashes
 */
export function refreshBoilerplate(db) {
  const key = cacheKeyOf(db);
  if (key == null) return { key: null, hashes: new Map() };
  const byCompany = new Map();
  const hashes = new Map();
  for (const r of db.prepare(`SELECT id, company, COALESCE(description_text, description) AS text FROM scraped_jobs WHERE ${ACTIVE_POSTINGS_WHERE}`).iterate()) {
    const hs = sentenceHashesOf(r.text);
    hashes.set(r.id, hs);
    const ck = companyKey(r.company);
    if (!ck) continue;
    let a = byCompany.get(ck);
    if (!a) byCompany.set(ck, a = { ids: [], lists: [] });
    a.ids.push(r.id);
    a.lists.push(hs);
  }
  const c = cacheFor(db, key);
  c.companies.clear();
  for (const [ck, a] of byCompany) c.companies.set(ck, companyCountsOf(a.lists, a.ids));
  return { key, hashes };
}

/** The sentences of a posting's text that count: (2) the counted sections, then (1) without the company's boilerplate. */
export function countedSentences(text, boilerplate = EMPTY) {
  const out = [];
  for (const s of sentencesOf(countedLines(text))) {
    const k = boilerplate.size ? sentenceKey(s) : null;
    if (!k || !boilerplate.has(k)) out.push(s);
  }
  return out;
}

// ── (3) concepts ─────────────────────────────────────────────────────────────────────────────────

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A short concept's own test: the whole term in its exact casing, a plural "s" allowed ("CDNs"), never part of a
 *  dotted name ("cdn.openai.com" is lower case anyway; "CDN.js" and "ASP.NET" are not the concept). */
function exactMatcher(name) {
  const re = new RegExp(`(?<![A-Za-z0-9+#]|[A-Za-z0-9]\\.)${escapeRe(name)}s?(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])`);
  return (text) => re.test(text);
}

// ── the matcher ──────────────────────────────────────────────────────────────────────────────────

/**
 * The matcher for these nodes.
 * @param nodes [{ id, kind, term, name? }]
 * @param opts.listOnly  D114: a posting that HAS a skills list asks only for what is on it (the stats count any
 *                       non-ambiguous term in the text; an ambiguous one in both only when the list names it)
 * @param opts.bulk      one pass over the whole board: every company's boilerplate is read once, up front
 * @param opts.rolesAsTerms  D114: a role is also asked for by its term in the text (it links like a skill)
 * @param opts.live      ⭐ D118 P1: `read(p)` answers BOTH readings of one posting in one pass over its words — what it
 *                       is counted for (the stats' rule) and what it links (D114's rule, roles by term included)
 * @returns {{ roleOf(title) → id | null, askedBy(posting { title, company, text, skills_json }) → id[],
 *   read(posting, { boilerplate? }) → { asked: id[], linked: id[], roleId }, bulkHashes: Map | null }}
 */
export function postingMatcher(db, nodes, { listOnly = false, bulk = false, rolesAsTerms = false, live = false } = {}) {
  const SHORT = POSTING_MATCH.SHORT_CONCEPT_CHARS;
  // Each asked-for node's terms: its own and its confirmed aliases (the one thesaurus).
  const asks = nodes.filter(n => rolesAsTerms || live || n.kind !== "role").map(n => {
    const concept = n.kind === "concept";
    const name = String(n.name ?? n.term ?? "").trim();
    const short = concept && name.length > 0 && name.length < SHORT;
    let terms = [n.term, ...aliasesOf(db, n.term)].filter(Boolean);
    // (3) a short concept's short spellings are matched only by its exact name; longer aliases still count.
    if (short) terms = terms.filter(t => t.length >= SHORT);
    return { id: n.id, role: n.kind === "role", concept, terms, exact: short ? exactMatcher(name) : null, exactKey: short ? normaliseAtsTerm(name) : null };
  });
  // ⭐ A112/Atlas: a role is found by its own term and by its alternate titles (content/atlas/roles.json, atlasRoles.js).
  const titles = roleTitles();
  const roles = nodes.filter(n => n.kind === "role")
    .flatMap(n => [n.term, ...(titles.get(n.slug) || [])].filter(Boolean).map(term => ({ id: n.id, term })))
    .sort((a, b) => b.term.length - a.term.length);
  // The runs only need to be as long as the longest term.
  const words = (t) => t.split(" ").length;
  const maxGram = Math.min(POSTING_MATCH.MAX_GRAM, Math.max(1, ...asks.flatMap(a => a.terms.map(words))));
  const anyConcept = asks.some(a => a.concept);
  const board = bulk ? refreshBoilerplate(db) : null;

  const roleOf = (title) => {
    const tk = ` ${normaliseAtsTerm(title ?? "")} `;
    return roles.find(r => tk.includes(` ${r.term} `))?.id ?? null;
  };
  // One pass over the posting's counted words, answered in each reading asked for.
  //   reading.listOnly   D114's rule (the posting's own list, when it has one) — else the stats' rule
  //   reading.skipRoles  a role is not asked for by its term (the stats: a role is the posting's TITLE, roleOf)
  const evaluate = (p, boilerplate, readings) => {
    const title = String(p.title ?? "");
    const sentences = countedSentences(p.text, boilerplate);
    const grams = addGrams(new Set(), title, maxGram);
    for (const s of sentences) addGrams(grams, s, maxGram);
    // (3) concepts read the same text with the common phrases blanked out — built only when a phrase is there.
    let conceptView = null;
    const forConcepts = () => {
      if (conceptView) return conceptView;
      const raw = `${title}\n${sentences.join("\n")}`;
      COMMON_PHRASE_RE.lastIndex = 0;
      if (!anyConcept || !COMMON_PHRASE_RE.test(raw)) return (conceptView = { grams, text: raw });
      const masked = [title, ...sentences].map(maskCommonPhrases);
      const g = new Set();
      for (const s of masked) addGrams(g, s, maxGram);
      return (conceptView = { grams: g, text: masked.join("\n") });
    };
    let named = null;
    const listed = () => (named ??= skillKeysOf(p.skills_json));
    const counted = (t) => !AMBIGUOUS_TERMS.has(t) || listed().has(t);
    const linkable = (t) => (listed().size ? listed().has(t) : counted(t));
    const plain = { grams };
    const outs = readings.map(() => []);
    for (const a of asks) {
      const view = a.concept ? forConcepts() : plain;
      readings.forEach((r, i) => {
        if (r.skipRoles && a.role) return;
        const allowed = r.listOnly ? linkable : counted;
        if (a.terms.some(t => view.grams.has(t) && allowed(t)) || (a.exact && a.exact(view.text) && allowed(a.exactKey))) outs[i].push(a.id);
      });
    }
    return outs;
  };
  const boilerplateOf = (p) => companyBoilerplate(db, p.company, board ? board.key : undefined);

  return {
    roleOf,
    askedBy(p) {
      return evaluate(p, boilerplateOf(p), [{ listOnly, skipRoles: !rolesAsTerms }])[0];
    },
    read(p, { boilerplate } = {}) {
      const [asked, linked] = evaluate(p, boilerplate ?? boilerplateOf(p), [{ listOnly: false, skipRoles: true }, { listOnly: true, skipRoles: false }]);
      return { asked, linked, roleId: roleOf(p.title) };
    },
    /** bulk: each active posting's sentence hashes, read once with the companies' counts (the live store keeps them) */
    bulkHashes: board ? board.hashes : null,
  };
}
