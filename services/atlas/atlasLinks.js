// services/atlas/atlasLinks.js — ⭐ D114 · ATLAS TERMS IN THE POSTINGS: which words of ONE posting link to a published
// Atlas page, the popup's small read (peek), and an anonymous count of its use.
//
// Owner 10-31: "embeddings throughout the job postings wherever these words are … hovering needs to give a small popup
// to its meaning and signaling it is a learning resource link." ("Embeddings" = links embedded in the text: plain text
// matching against the Atlas and its one thesaurus — no vectors, no model, D17.)
//
// P1 · WHICH WORDS. A published node is linkable in a posting when its term or a confirmed alias (skill_synonyms) is in
// the posting's text, and —
//   · the posting has the scorer's own skill list (scraped_jobs.skills_json): the node must be ON that list. So "go to
//     market" never links Go and "react to incidents" never links React (d114OnlyPostingsOwnSkills).
//   · the posting has no list (measured 10-31 on the local board: 801 of 2,616 postings have one, so a strict list-only
//     rule would leave two thirds of the board with no links): the Atlas's OWN counting rule (atlasStats.js) — the
//     words in the text, the scorer's ambiguous words (Go, Rust, Spark…) never — the same postings the popup's "asked
//     for in N open postings" counts. A single-word name with a capital ("React", "Kubernetes") then links only in its
//     own case, so a lowercase verb never does.
// The answer is a list of FORMS per node; the posting's text is matched where it is drawn (shared/atlasLinks.js —
// longest form first, whole words, the first occurrence of each node only). ⛔ The text itself is never changed.
// Computed per request (≈ 200 set look-ups over the posting's words); the published node list is cached and rebuilt
// when a node is published, unpublished or renamed, or an alias is confirmed (the version key below).
// ⛔ Only PUBLISHED nodes: a draft is never linked (d114OnlyPublishedNodes), and unpublishing removes its links at once.

import { normaliseAtsTerm } from "../localAtsScorer.js";
import { AMBIGUOUS_TERMS } from "./atlasStats.js";
import { aliasesOf, readNode, profileTerms } from "./atlasStore.js";

const MAX_GRAM = 4;
const TEXT_CHARS = 30000;
export const PEEK_MEANING_CHARS = 240;
export const LINK_EVENTS = Object.freeze(["open", "visit"]);

function gramsOf(text) {
  const words = normaliseAtsTerm(String(text ?? "").slice(0, TEXT_CHARS)).split(" ").filter(Boolean);
  const set = new Set();
  for (let i = 0; i < words.length; i++) {
    let g = "";
    for (let k = 0; k < MAX_GRAM && i + k < words.length; k++) { g = k ? `${g} ${words[i + k]}` : words[i]; set.add(g); }
  }
  return set;
}
function skillKeysOf(json) {
  try {
    const arr = JSON.parse(json || "[]");
    return new Set((Array.isArray(arr) ? arr : []).map(e => normaliseAtsTerm(typeof e === "string" ? e : e?.skill)).filter(Boolean));
  } catch { return new Set(); }
}

/** How a node's words are matched in the drawn text. Exported for the tests. */
export function formsOf(node, aliases = []) {
  const ambiguous = AMBIGUOUS_TERMS.has(node.term);
  const name = String(node.name ?? "").trim();
  const single = !/\s/.test(name);
  const out = [{ text: name, exactCase: ambiguous || name.length <= 2 || (single && /[A-Z]/.test(name)) }];
  for (const a of [node.term, ...aliases]) {
    const t = String(a ?? "").trim();
    if (!t || t.length <= 2 || AMBIGUOUS_TERMS.has(t)) continue;   // a lowercase alias has no case to match: short or ambiguous ones are left out
    if (out.some(f => f.text.toLowerCase() === t.toLowerCase())) continue;
    out.push({ text: t, exactCase: false });
  }
  return out;
}

let cache = { key: null, nodes: [] };
function linkableNodes(db) {
  const key = db.prepare(`SELECT COUNT(*) || ':' || COALESCE(MAX(updated_at), 0) || ':' || COALESCE(MAX(published_at), 0) FROM atlas_nodes WHERE status = 'published'`).pluck().get()
    + ":" + db.prepare(`SELECT COUNT(*) FROM skill_synonyms WHERE status = 'confirmed' AND relation = 'alias'`).pluck().get();
  if (cache.key === key && cache.db === db) return cache.nodes;
  const nodes = db.prepare(`SELECT slug, kind, name, term FROM atlas_nodes WHERE status = 'published' ORDER BY id`).all()
    .map(n => { const aliases = aliasesOf(db, n.term); return { ...n, terms: [n.term, ...aliases], forms: formsOf(n, aliases) }; });
  cache = { key, db, nodes };
  return nodes;
}

/**
 * The linkable Atlas nodes of ONE posting.
 * @param job { title?, description, skills_json? }
 * @returns {{ slug, name, kind, forms: { text, exactCase }[] }[]}
 */
export function atlasTermsFor(db, job) {
  if (!job) return [];
  const grams = gramsOf(`${job.title ?? ""} . ${job.description ?? ""}`);
  const named = skillKeysOf(job.skills_json);
  const out = [];
  for (const n of linkableNodes(db)) {
    const inText = n.terms.filter(t => grams.has(t));
    if (!inText.length) continue;
    const ok = named.size ? inText.some(t => named.has(t)) : inText.some(t => !AMBIGUOUS_TERMS.has(t));
    if (ok) out.push({ slug: n.slug, name: n.name, kind: n.kind, forms: n.forms });
  }
  return out;
}

/** The posting by its board id → its linkable terms (null when there is no such posting). */
export function atlasTermsForPosting(db, jobId) {
  const job = db.prepare(`SELECT title, COALESCE(description_text, description) AS description, skills_json FROM scraped_jobs WHERE job_id = ?`).get(String(jobId));
  return job ? atlasTermsFor(db, job) : null;
}

const firstSentence = (s) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  return (m ? m[0] : t).slice(0, PEEK_MEANING_CHARS);
};

/**
 * P4 · the popup's read: name, kind, one line of meaning (the node's own definition, else the first sentence of its
 * Wikipedia summary, marked so), how many open postings ask for it, its first resource, and — signed in only — whether
 * it is on the reader's profile (D101). Published nodes only.
 */
export function peekNode(db, slug, userId = null) {
  const n = readNode(db, slug);
  if (!n) return null;
  const own = String(n.definition ?? "").trim();
  const wiki = n.wikipedia?.extract ? firstSentence(n.wikipedia.extract) : "";
  const first = (n.resources || [])[0] || null;
  const out = {
    slug: n.slug, name: n.name, kind: n.kind,
    meaning: own ? own.slice(0, PEEK_MEANING_CHARS) : wiki || null,   // a definition is one or two sentences already (P11)
    fromWikipedia: !own && !!wiki,
    wikipediaUrl: !own && wiki ? n.wikipedia.pageUrl || null : null,
    postings: n.onTheBoard?.postings ?? 0,
    firstResource: first ? { title: first.title, url: first.url, format: first.format || null } : null,
  };
  if (userId != null) {
    const term = db.prepare(`SELECT term FROM atlas_nodes WHERE slug = ?`).pluck().get(n.slug);
    const mine = profileTerms(db, userId);
    out.you = mine.has(term) || (n.aliases || []).some(a => mine.has(a)) ? "have" : "missing";
  }
  return out;
}

/** P5 · one more popup open or Atlas visit from a posting, today. No user, no term, no posting — a count. */
export function countLinkEvent(db, event, now = new Date()) {
  if (!LINK_EVENTS.includes(event)) return false;
  const day = now.toISOString().slice(0, 10);
  db.prepare(`INSERT INTO atlas_link_counts (day, event, n) VALUES (?, ?, 1) ON CONFLICT(day, event) DO UPDATE SET n = n + 1`).run(day, event);
  return true;
}
