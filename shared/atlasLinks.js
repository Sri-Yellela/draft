// shared/atlasLinks.js — ⭐ D114 P1 · where a posting's Atlas terms sit IN THE DRAWN TEXT. Pure: text in, segments out.
//
// The server says WHICH published nodes a posting may link (services/atlas/atlasLinks.js atlasTermsFor — the posting's
// own skill list, the thesaurus, the ambiguous words); this finds WHERE, in the text exactly as a surface draws it (a
// formatted block, a bullet, a plain paragraph), so the spans can never drift from what is on screen.
//   · longest first: "machine learning engineer" claims its words before "machine learning" can
//   · whole words only: "Go" is not in "Google", "Java" is not in "JavaScript", "Node" is not in "Node.js"
//   · a form marked exactCase matches only in its own case ("React" — never the verb "react")
//   · the FIRST occurrence of each node in the whole posting only — `used` is carried across the posting's blocks
// ⛔ The text is never changed: the segments, joined, are the input exactly (d114TextUnchanged).
// ⭐ BUG 10-31: case and accents fold through the ONE normaliser (shared/atlasSearchNormalize.js foldChars — the same
// module as the Atlas search); the server adds each name's separator spellings (spellings: "Node.js" / "Nodejs").
// ⭐ BUG 10-31: a CONCEPT never links inside a common phrase ("Attention" in "attention to detail") — the one list,
// shared/atlasCommonPhrases.js, the same the server's matcher counts by.
import { foldChars } from "./atlasSearchNormalize.js";
import { commonPhraseSpans } from "./atlasCommonPhrases.js";

const WORD = /[A-Za-z0-9+#]/;
const isWordAt = (s, i) => i >= 0 && i < s.length && WORD.test(s[i]);

function boundaryOk(text, start, end) {
  if (isWordAt(text, start - 1)) return false;
  if (text[start - 1] === "." && isWordAt(text, start - 2)) return false;   // ".NET" inside "ASP.NET"
  if (isWordAt(text, end)) return false;
  if (text[end] === "." && isWordAt(text, end + 1)) return false;           // "Node" in "Node.js"
  return true;
}

/** The earliest whole-word occurrence of `form` at or after nothing it overlaps; -1 when none. */
function find(text, lower, form, taken) {
  const needle = form.exactCase ? form.text : foldChars(form.text);
  const hay = form.exactCase ? text : lower;
  if (!needle) return -1;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + 1)) {
    const end = i + needle.length;
    if (boundaryOk(text, i, end) && !taken.some(([a, b]) => i < b && end > a)) return i;
  }
  return -1;
}

/**
 * @param text  the text as drawn
 * @param terms [{ slug, kind?, forms: [{ text, exactCase }] }] — from GET /api/atlas/terms/:jobId
 * @param used  a Set of slugs already linked earlier in this posting (mutated: the ones linked here are added)
 * @returns [{ text, slug? }] — joined, exactly `text`
 */
export function linkSegments(text, terms, used = new Set()) {
  const s = String(text ?? "");
  if (!s || !Array.isArray(terms) || !terms.length) return [{ text: s }];
  const lower = foldChars(s);   // case + accents folded, one char for one char — the one normaliser's fold
  const longest = (t) => Math.max(0, ...(t.forms || []).map(f => String(f.text || "").length));
  const order = terms.filter(t => t?.slug && !used.has(t.slug)).sort((a, b) => longest(b) - longest(a));
  const spans = [];
  let phrases = null;
  for (const t of order) {
    let best = null;
    for (const f of [...(t.forms || [])].sort((a, b) => String(b.text).length - String(a.text).length)) {
      const taken = t.kind === "concept" ? spans.concat(phrases ??= commonPhraseSpans(s)) : spans;
      const at = find(s, lower, { text: String(f.text || ""), exactCase: !!f.exactCase }, taken);
      if (at !== -1 && (best === null || at < best[0])) best = [at, at + String(f.text).length];
    }
    if (best) { spans.push([best[0], best[1], t.slug]); used.add(t.slug); }
  }
  if (!spans.length) return [{ text: s }];
  spans.sort((a, b) => a[0] - b[0]);
  const out = [];
  let at = 0;
  for (const [a, b, slug] of spans) {
    if (a > at) out.push({ text: s.slice(at, a) });
    out.push({ text: s.slice(a, b), slug });
    at = b;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
}
