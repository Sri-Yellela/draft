// services/jobs/taxonomyClassify.js — ⭐ D179 P2 (45l) · CATEGORY → SUBCATEGORY, FROM THE APPROVED TAXONOMY.
//
// The one taxonomy (content/taxonomy/roles-v1.json, APPROVED by the owner 11-07): 23 categories, 162 subcategories,
// each subcategory with title aliases and the signals that tell it apart. Pure: (posting) → { category, subcategory,
// confidence, reason }. The taxonomy's own rules, applied here:
//   · D127's hold applies to the CATEGORY only — a posting D127 held stays held (this never un-holds one), and a held
//     taxonomy category (healthcare, education) is never assigned;
//   · category clear, specialisation unsure → `<category>.general` ("Software engineering · general"), never held;
//   · classification reads the posting's CONTENT, not only its title: aliases in the title decide first, the
//     subcategory's name in the title next, its signals in the description break ties;
//   · level is a separate facet — "Senior", "Staff", "Manager" in a title never pick a subcategory.
// D127's stored category is a HINT (its SOC major group narrows the candidates; "management" in D127 holds both product
// and project managers, so it hints at both taxonomy groups) — the title's evidence outranks it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const TAXONOMY_FILE = path.join(ROOT, "content", "taxonomy", "roles-v1.json");

// D127's category names → the taxonomy's `d127` codes they may land in.
const D127_HINT = Object.freeze({
  computing: ["15"], engineering: ["17"], management: ["11", "13"], business: ["13"], legal: ["23"],
  marketing: ["marketing", "11"], sales: ["41"], science: ["19", "17"], arts_media: ["27"],
});
const HELD = "held";
// Words that name a CATEGORY plainly in a title — weak evidence, so they land a posting at `<category>.general`, never
// at a guessed subcategory. (From the 11-08 labelled set's misses: "Head of Revenue Accounting", "Sourcing Supervisor".)
const CATEGORY_WORDS = Object.freeze({
  "sales-cs": ["sales", "business development", "account executive", "account manager", "bdr", "sdr", "key account", "customer success"],
  "business-finance": ["accounting", "accountant", "finance", "financial", "billing", "collections", "investment", "portfolio manager",
    "audit", "tax", "treasury", "valuations", "insights and analytics", "business director", "transformation"],
  "people-hr": ["human resources", "hr", "recruitment", "recruiting", "recruiter", "talent", "employee relations", "people operations"],
  "operations-supply-chain": ["sourcing", "purchase", "purchasing", "procurement", "warehouse", "logistics", "supply chain", "planning coordinator", "deployment strategy"],
  "writing-communications": ["communications", "copywriter", "editor"],
  "marketing": ["events", "creative strategist", "brand", "website manager", "growth"],
  "design": ["user experience", "ux", "ui designer"],
  "electrical-hardware": ["battery", "dft", "electrical", "hardware", "asic", "fpga"],
  "mechanical-manufacturing": ["mechatronics", "robotics", "quality engineering", "quality assurance", "manufacturing", "mechanical", "application engineer"],
  "civil-construction": ["civil", "construction", "structural", "land development"],
  "software-engineering": ["forward deployed engineer", "integration test", "member of technical staff"],
  "science-research": ["research scientist", "laboratory", "theranostics"],
});
// Seniority only — "manager", "director", "lead", "executive" stay: they are part of aliases ("product manager",
// "account executive"); stripping them made "Senior Product Manager" miss its alias.
const LEVEL_WORDS = /\b(?:junior|jr\.?|mid(?:-level)?|senior|sr\.?|principal|i{1,3}|iv)\b/gi;

const norm = (s) => ` ${String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#./]+/g, " ").replace(/\s+/g, " ").trim()} `;
const has = (hay, needle) => { const n = norm(needle).trim(); return n.length > 1 && hay.includes(` ${n} `); };

let _tax = null;
/** The taxonomy, indexed. Throws when the file is missing or not approved (nothing is classified on a draft). */
export function taxonomy(file = TAXONOMY_FILE) {
  if (_tax && _tax.file === file) return _tax;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!/^APPROVED/i.test(String(raw.status || ""))) throw new Error(`taxonomy ${raw.version}: not approved — nothing is classified to subcategories`);
  const categories = raw.categories.map(c => ({ id: c.id, name: c.name, d127: String(c.d127), held: !!c.held,
    general: c.subcategories.find(s => /\.general$/.test(s.id))?.id || null,
    subs: c.subcategories.map(s => ({ id: s.id, name: s.name, aliases: s.aliases || [], signals: s.signals || [], general: /\.general$/.test(s.id) })) }));
  // ⭐ B-1 (45o): the D101 registry onto taxonomy ids travels with the taxonomy (services/placement.js registryKeyFor).
  _tax = { file, version: String(raw.version), categories, byId: new Map(categories.map(c => [c.id, c])), registryMap: raw.registryMap || null };
  return _tax;
}

export const TITLE_ALIAS = 6, TITLE_NAME = 4, SIGNAL = 1, SIGNAL_CAP = 4, HINT = 2, SURE = 6, CATEGORY_CLEAR = 3;

/**
 * Classify one posting. `boardCategory` = D127's stored category ('held' keeps it held). Returns
 * { category, subcategory, confidence (0–1), reason, version } — category / subcategory null when nothing is clear.
 */
export function classifyPosting(posting, tax = taxonomy()) {
  const r = classifyTitle(posting, tax);
  // ⭐ A141 (45q): a posting that reached only its category's GENERAL bucket ("Software Engineer") is placed in a specific
  // subcategory when the DESCRIPTION clearly says which — that sub's own signal terms, at least DESC_MIN distinct ones and
  // DESC_MARGIN more than any sibling. Same category only (the title already decided that); a close race stays general.
  if (r.category && r.subcategory && /\.general$/.test(r.subcategory) && posting?.description) {
    const pick = descriptionPick(tax.byId.get(r.category), norm(String(posting.description).slice(0, 6000)));
    if (pick) return { ...r, subcategory: pick.id, confidence: 0.55, reason: `${r.reason},desc-signals:${pick.id}:${pick.n}` };
  }
  return r;
}

export const DESC_MIN = 4, DESC_MARGIN = 3;   // measured 45q: 3 / 2 placed "Software Engineer - C++" in frontend
/** A signal like "React / Vue" or "frontend + backend in one role" is several terms; each counts once when present. */
const signalTerms = (s) => String(s || "").split(/\s*(?:\/|\+|,)\s*/).map(x => x.trim()).filter(x => x.length > 1);
export function descriptionPick(cat, d) {
  if (!cat || !d.trim()) return null;
  const scored = cat.subs.filter(s => !s.general).map(s => {
    const terms = new Set(s.signals.flatMap(signalTerms).map(x => x.toLowerCase()));
    return { id: s.id, n: [...terms].filter(x => has(d, x)).length };
  }).sort((a, b) => b.n - a.n);
  const [a, b2] = scored;
  if (!a || a.n < DESC_MIN || (b2 && a.n - b2.n < DESC_MARGIN)) return null;
  return a;
}

function classifyTitle({ title, description = "", boardCategory = null }, tax = taxonomy()) {
  const out = (category, subcategory, confidence, reason) => ({ category, subcategory, confidence, reason, version: tax.version });
  if (boardCategory === HELD) return out(null, null, 0, "held:d127");
  const t = norm(String(title || "").replace(LEVEL_WORDS, " "));
  if (!t.trim()) return out(null, null, 0, "no_title");
  const d = norm(String(description || "").slice(0, 6000));
  const hint = new Set(D127_HINT[boardCategory] || []);

  let best = null, second = null;
  const catScore = new Map();
  const cands = [];
  for (const c of tax.categories) {
    if (c.held) continue;
    for (const s of c.subs) {
      let score = 0, why = [];
      const alias = s.aliases.filter(a => has(t, a)).sort((a, b) => b.length - a.length)[0];
      if (alias) { score += TITLE_ALIAS + Math.min(2, Math.floor(alias.length / 12)); why.push(`alias:${alias}`); }
      else if (!s.general && has(t, s.name)) { score += TITLE_NAME; why.push(`name:${s.name}`); }
      if (score && d.trim()) {
        const sig = s.signals.filter(x => has(d, x)).length;
        if (sig) { score += Math.min(SIGNAL_CAP, sig) * SIGNAL; why.push(`signals:${sig}`); }
      }
      if (score && hint.has(c.d127)) { score += HINT; why.push("d127"); }
      if (!score) continue;
      catScore.set(c.id, Math.max(catScore.get(c.id) || 0, score));
      const cand = { c, s, score, why };
      cands.push(cand);
      if (!best || score > best.score) { second = best; best = cand; }
      else if (!second || score > second.score) second = cand;
    }
  }

  // ⭐ D184 (45p): "Frontend Software Engineer" / "Software Engineer II, Frontend" — the category's GENERAL subcategory won on
  // its generic alias ("software engineer") while a SPECIFIC sibling's own name ("Frontend") was in the title too. The
  // specific one is what the title says; it wins when it is sure on its own.
  if (best?.s.general) {
    // ⭐ A141 (45q): the sibling's own NAME in the title is enough ("Software Engineer, Android" · "Staff Software Engineer, iOS")
    // — it scored TITLE_NAME (4) under SURE, so the general alias kept winning; the title says which, so it wins.
    const spec = cands.filter(x => x.c.id === best.c.id && !x.s.general && x.why.some(w => w.startsWith("name:")) && x.score >= TITLE_NAME)
      .sort((a, b) => b.score - a.score)[0];
    if (spec) { best = { ...spec, score: Math.max(spec.score, SURE), why: [...spec.why, `over-general:${best.s.id}`] }; second = null; }
  }
  if (best && best.score >= SURE) {
    // Two subcategories in two categories tied on the title: the category is unsure — hint decides, else unclassified.
    if (second && second.score === best.score && second.c.id !== best.c.id) {
      const pick = [best, second].find(x => hint.has(x.c.d127));
      if (!pick) return out(null, null, 0.3, `tie:${best.s.id}|${second.s.id}`);
      return out(pick.c.id, pick.s.id, 0.7, pick.why.join(","));
    }
    if (second && second.score === best.score && second.s.id !== best.s.id) {
      return out(best.c.id, best.c.general, 0.6, `tie-within:${best.s.id}|${second.s.id}`);   // category clear, sub unsure
    }
    return out(best.c.id, best.s.id, Math.min(0.95, 0.6 + best.score / 30), best.why.join(","));
  }
  // No sure subcategory: the category when one is clear (title evidence, or D127's hint naming exactly one category).
  if (best && best.score >= CATEGORY_CLEAR) return out(best.c.id, best.c.general, 0.5, `category-only:${best.why.join(",")}`);
  const named = tax.categories.filter(c => !c.held && has(t, c.name));
  if (named.length === 1) return out(named[0].id, named[0].general, 0.45, `category-name:${named[0].name}`);
  // A category's plain words in the title: the category whose words match most (one clear winner), at its general.
  const byWords = Object.entries(CATEGORY_WORDS).map(([id, ws]) => [id, ws.filter(w => has(t, w)).length]).filter(([, n]) => n)
    .sort((a, b) => b[1] - a[1]);
  if (byWords.length && (byWords.length === 1 || byWords[0][1] > byWords[1][1]) && tax.byId.get(byWords[0][0]) && !tax.byId.get(byWords[0][0]).held) {
    const c = tax.byId.get(byWords[0][0]);
    return out(c.id, c.general, 0.4, `category-words:${c.id}`);
  }
  // D127's PRIMARY group only (the first listed): "marketing" names the marketing category, not product management.
  // ⛔ A171 (46b): NOT "management". D127's management is SOC 11 — every kind of manager and director — and product
  // management is the taxonomy's only code-11 category, so this line filed 10,139 production postings (13 % of the board:
  // a hotel duty manager, a transfer-pricing manager, city deputy directors …) as "Product management · general". A
  // manager with no other title evidence is left unclassified, never guessed into product management.
  const primary = boardCategory === "management" ? null : (D127_HINT[boardCategory] || [])[0];
  const hinted = tax.categories.filter(c => !c.held && c.d127 === primary);
  if (hinted.length === 1) return out(hinted[0].id, hinted[0].general, 0.4, `d127-only:${boardCategory}`);
  return out(null, null, 0, boardCategory ? `unsure:d127=${boardCategory}` : "unsure");
}
