// shared/atlasSearchNormalize.js — ⭐ BUG 10-31 (owner: "the search is not normalised") · THE ONE NORMALISER for looking
// words up in the Atlas: the Atlas search (services/atlas/atlasStore.js searchNodes), the Learn concept search (D115)
// and D114's matcher in a posting's text (shared/atlasLinks.js).
//
// ⛔ It is NOT the scorer's normaliser (normaliseAtsTerm): node terms and skill_synonyms are keyed by that one, and
// changing it would move ATS scores. This one only decides whether two spellings are the same word for a reader:
//   · case and accents: "Résumé" = "resume" (Unicode NFKD, marks stripped)
//   · the meaningful symbols kept as tokens: c++ → cpp · c# → csharp · f# → fsharp · .net → dotnet
//   · separators folded: "node.js" = "nodejs" = "node js" · "ci/cd" = "cicd" = "ci cd"
//   · simple plurals: "apis" → "api" · "databases" → "database" (applied to BOTH sides, so it only has to be consistent)
//   · typo tolerance: edit distance 1 for 5–8 characters, 2 above; never under 5 ("go" never fuzzes)

const MARKS = /[̀-ͯ]/g;

/** One character, folded for comparison (case + accents) — length-preserving, so a match maps back onto the text. */
export function foldChar(c) {
  const f = String(c).normalize("NFKD").replace(MARKS, "").toLowerCase();
  return f.length === 1 ? f : String(c).toLowerCase().slice(0, 1) || c;
}
/** A string folded char by char (same length as the input). */
export const foldChars = (s) => Array.from(String(s ?? ""), foldChar).join("");

const SYMBOLS = [[/c\+\+/g, " cpp "], [/c#/g, " csharp "], [/f#/g, " fsharp "], [/(^|[^a-z0-9])\.net\b/g, "$1 dotnet "]];

function singular(w) {
  if (w.length <= 3 || /(ss|us|sis|xis)$/.test(w)) return w;   // class, bus, analysis, axis are not plurals
  if (/ies$/.test(w) && w.length > 4) return w.slice(0, -3) + "y";
  return w.endsWith("s") ? w.slice(0, -1) : w;
}

/** The words of a string, normalised: ["node", "js"], ["ci", "cd"], ["cpp"], ["api"]. */
export function searchWords(s) {
  let t = String(s ?? "").normalize("NFKD").replace(MARKS, "").toLowerCase();
  for (const [re, to] of SYMBOLS) t = t.replace(re, to);
  return rawWords(t).map(singular);
}
const rawWords = (t) => t.split(/[^a-z0-9]+/).filter(Boolean);
/**
 * The compact key: the words with no separators at all — "nodej", "cicd", "kubernete". Equal keys = the same word.
 * The plural comes off the END of the joined key, not each word: "node js" and "nodejs" must agree.
 */
export function searchKey(s) {
  let t = String(s ?? "").normalize("NFKD").replace(MARKS, "").toLowerCase();
  for (const [re, to] of SYMBOLS) t = t.replace(re, to);
  return singular(rawWords(t).join(""));
}

/** Edit distance with a swapped pair as ONE edit ("kafak" → "kafka"; optimal string alignment), capped past `max`. */
export function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
/** How many typos a query of this length may carry: 0 under 5 characters, 1 for 5–8, 2 above. */
export const typoAllowance = (key) => (key.length < 5 ? 0 : key.length <= 8 ? 1 : 2);

/** The other spellings a reader may write for a name with separators — for D114's matcher in raw text. */
export function spellings(name) {
  const n = String(name ?? "").trim();
  const out = new Set([n]);
  if (/[.\/\-_]/.test(n) && /^[\w.\/\-_ +#]+$/.test(n)) {
    out.add(n.replace(/[.\/\-_]/g, ""));       // "Node.js" → "Nodejs", "CI/CD" → "CICD"
    out.add(n.replace(/[.\/\-_]/g, " "));      // → "Node js", "CI CD"
  }
  return [...out].filter(Boolean);
}

export const SEARCH_RANK = Object.freeze({ name: 0, alias: 1, prefix: 2, typo: 3, definition: 4 });

/**
 * Rank ONE candidate against a query. `aliases` are the candidate's confirmed alias spellings (skill_synonyms).
 * @returns {{ via: "name"|"alias"|"prefix"|"typo"|"definition", rank, why } | null}
 */
export function matchCandidate(query, { name, term = null, aliases = [], definition = null }) {
  const q = searchKey(query);
  if (!q) return null;
  const qWords = searchWords(query);
  const keys = [searchKey(name), term ? searchKey(term) : null].filter(Boolean);
  if (keys.includes(q)) return { via: "name", rank: SEARCH_RANK.name, why: null };
  const alias = aliases.find(a => searchKey(a) === q);
  if (alias) return { via: "alias", rank: SEARCH_RANK.alias, why: `${alias} → ${name}` };
  if (q.length >= 2) {
    const nameWords = searchWords(name);
    const starts = keys.some(k => k.startsWith(q)) || nameWords.some(w => w.startsWith(q))
      || (qWords.length > 1 && nameWords.join(" ").startsWith(qWords.join(" ")));
    if (starts) return { via: "prefix", rank: SEARCH_RANK.prefix, why: null };
    const a = aliases.find(x => searchKey(x).startsWith(q));
    if (a) return { via: "prefix", rank: SEARCH_RANK.prefix, why: `${a} → ${name}` };
  }
  const k = typoAllowance(q);
  if (k > 0) {
    if (keys.some(key => editDistance(q, key, k) <= k)) return { via: "typo", rank: SEARCH_RANK.typo, why: `${String(query).trim()} → ${name}` };
    const a = aliases.find(x => editDistance(q, searchKey(x), k) <= k);
    if (a) return { via: "typo", rank: SEARCH_RANK.typo, why: `${String(query).trim()} → ${name}` };
  }
  if (definition && q.length >= 3) {
    const d = searchWords(definition);
    const hit = qWords.length > 1 ? d.join(" ").includes(qWords.join(" ")) : d.some(w => w === q || (q.length >= 4 && w.startsWith(q)));
    if (hit) return { via: "definition", rank: SEARCH_RANK.definition, why: "in its definition" };
  }
  return null;
}
