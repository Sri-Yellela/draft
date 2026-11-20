// services/honestyCheck.js — ⭐ D141 · THE RÉSUMÉ HONESTY CHECK (owner 11-02): which lines you can't defend, and how to
// make them true.
//
// From the owner's test of a competitor's "aggressive tailoring": it added sales skills he does not have to his skills
// row and rewrote his work in another field's words, and the job's key terms in his résumé went from 2 to 18 of 38.
// This reads ANY résumé — one another AI tool wrote included — line by line, against the ORIGINAL it came from:
//
//   · UNSUPPORTED CLAIMS — a skill on a skills row that the original never names; a number (%, $, ×, counts) a bullet
//     states that the original does not; a phrase a bullet says in words the original never used (the "invented"
//     rewrite); a scope word (led, owned, spearheaded …) the closest original line does not have; more years or a higher
//     title than the original claims (the claim guard's own readers, services/resumeClaimGuard.js).
//   · INTERVIEW RISK per line — high / medium / low, and the probe an interviewer would make.
//   · THE FIX — the closest line of the original (what is true, to reword from), or EARN IT: a link to learn the term
//     (the Atlas today; D142's Close builds when they exist).
//   · THE KEYWORD PICTURE — with a job: the job's key terms in the résumé and in the original (the same scorer as the
//     board and the public ATS tool), and which were ADDED without support.
//
// ⛔ D17: rules and arithmetic, no model. ⛔ Nothing here stores anything — the route keeps no text (no sign-up = not kept).

import { maxYearsClaim, maxSeniority } from "./resumeClaimGuard.js";

const STOP = new Set(("a an and the of for to in on at by with from into over under via per as is are was were be been being " +
  "this that these those it its our your their my we you they i he she them us or nor but so than then also more most such " +
  "across using used use within while which who whom whose what when where how all any each every both few many much other some " +
  "new key high large based including include includes included through about after before during between up down out off").split(" "));
const SCOPE_RE = /\b(led|lead|leading|spearheaded|owned|own|headed|directed|single[- ]handedly|sole(ly)?|architected|managed\s+a\s+team|executive|oversaw|championed)\b/gi;
const NUMBER_RE = /(?:[$€£]\s?)?\d[\d,]*(?:\.\d+)?\s?(?:%|percent|x\b|×|[kmb]\b|\+)?/gi;
const BULLET_RE = /^\s*(?:[•●▪◦‣∙·\-*–—]|\d+[.)])\s+/;
const SKILLS_HEAD_RE = /^\s*(technical\s+)?(skills|technologies|tools|tech\s+stack|competencies|core\s+competencies)\b\s*:?/i;
const SECTION_HEAD_RE = /^\s*[A-Z][A-Z &/]{2,40}\s*:?\s*$/;

const norm = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
/** A light stem, so "cutting" / "cut" and "optimized" / "optimizing" are one word — rewording is not a new claim. */
const stem = (w) => {
  if (w.length <= 4 || /\d/.test(w)) return w;
  const s = w.replace(/(ing|ed|es|s)$/, "");
  return s.length >= 3 && /([b-df-hj-np-tv-z])\1$/.test(s) ? s.slice(0, -1) : s;
};
const words = (s) => norm(s).split(/[^a-z0-9+#.]+/).map(w => w.replace(/^\.+|\.+$/g, "")).filter(w => w.length >= 2 && !STOP.has(w)).map(stem);
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const names = (text, term) => new RegExp(`(?<![\\w+#.])${esc(norm(term))}(?![\\w+#])`, "i").test(norm(text));
const numKey = (n) => norm(n).replace(/[\s,]/g, "").replace(/percent$/, "%");

/** A résumé's lines, each with what it is: a skills row, a bullet, or a heading / other. */
export function resumeLines(text) {
  const out = [];
  let inSkills = false;
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const skillsHead = SKILLS_HEAD_RE.test(line);
    if (SECTION_HEAD_RE.test(line) && !skillsHead) { inSkills = false; out.push({ text: line, kind: "heading" }); continue; }
    if (skillsHead) inSkills = true;
    const listy = (line.match(/[,;|•]/g) || []).length >= 2;
    if ((skillsHead || inSkills) && listy) { out.push({ text: line, kind: "skills" }); continue; }
    // A bullet has a bullet mark, or is a sentence (12+ words); "Senior Engineer, Acme — Boston, MA" is a heading.
    if (BULLET_RE.test(line) || words(line).length >= 12) { inSkills = false; out.push({ text: line.replace(BULLET_RE, ""), kind: "bullet" }); continue; }
    out.push({ text: line, kind: "heading" });
  }
  return out;
}

/** The items of a skills row: "AI skills: Python, PyTorch | Salesforce" → ["Python", "PyTorch", "Salesforce"]. */
export function skillItems(line) {
  return String(line).replace(SKILLS_HEAD_RE, "").replace(/^[^:]{0,40}:\s*/, "")
    .split(/[,;|•·]/).map(s => s.replace(/\(.*?\)/g, "").trim()).filter(s => s && s.length <= 60);
}

const bigrams = (ws) => ws.slice(0, -1).map((w, i) => `${w} ${ws[i + 1]}`);
const SCOPE_WORDS = new Set(["led", "lead", "leading", "spearheaded", "owned", "own", "headed", "directed", "oversaw", "championed", "delivered"]);

/** The runs of a bullet's words the original never says together, in the résumé's own words —
 *  "incentive compensation plan design". */
function inventedPhrases(text, originalBigrams, originalWords) {
  const toks = [...String(text).matchAll(/[A-Za-z0-9][A-Za-z0-9+#.]*/g)]
    .map(m => { const t = m[0].replace(/\.+$/, ""); return { w: t.toLowerCase(), start: m.index, end: m.index + t.length }; })
    .filter(t => t.w.length >= 2 && !STOP.has(t.w)).map(t => ({ ...t, w: stem(t.w) }));
  const ws = toks.map(t => t.w);
  const spans = [];
  let cur = [];
  const close = () => {
    const run = cur.filter(i => !SCOPE_WORDS.has(ws[i]));
    if (run.length >= 2) spans.push(String(text).slice(toks[run[0]].start, toks[run[run.length - 1]].end));
    cur = [];
  };
  for (let i = 0; i < ws.length - 1; i++) {
    // A pair the original never says together, with at least one word it never says at all — rewording the
    // original's own words is honest; bringing in words it never used is the claim.
    const novel = !originalBigrams.has(`${ws[i]} ${ws[i + 1]}`);
    const fresh = !originalWords.has(ws[i]) || !originalWords.has(ws[i + 1]);
    if (novel && fresh) { if (!cur.length) cur.push(i); cur.push(i + 1); }
    else if (cur.length) close();
  }
  if (cur.length) close();
  return spans;
}

function closestOriginal(text, originalLines) {
  const a = new Set(words(text));
  let best = null, bestScore = 0;
  for (const o of originalLines) {
    const b = new Set(words(o.text));
    if (!a.size || !b.size) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    const j = inter / (a.size + b.size - inter);
    if (j > bestScore) { bestScore = j; best = o.text; }
  }
  return bestScore >= 0.12 ? best : null;
}

const learnHref = (term) => `/atlas?q=${encodeURIComponent(term)}`;

/** ⭐ D142 Defend (46y) · the scope words a line uses (led, owned, spearheaded …) — the check's own SCOPE_RE, lower-cased, once
 *  each. With an original the check flags only the NEW ones; Defend asks about every one, because each will be probed. */
export function scopeWordsIn(text) {
  return [...new Set([...String(text ?? "").matchAll(SCOPE_RE)].map(m => m[0].toLowerCase().replace(/\s+/g, " ")))];
}

/**
 * The check.
 * @param {object} o { resumeText, originalText?, jdText?, keywordsFor?(text) → { matched: string[], missing: string[] } }
 */
export function honestyCheck({ resumeText, originalText = "", jdText = "", keywordsFor = null }) {
  const lines = resumeLines(resumeText);
  const hasOriginal = String(originalText ?? "").trim().length >= 50;
  const origLines = hasOriginal ? resumeLines(originalText) : [];
  const origText = hasOriginal ? norm(originalText) : "";
  const origWords = new Set(words(originalText));
  const origBigrams = new Set(origLines.flatMap(l => bigrams(words(l.text))));
  const origNumbers = new Set([...String(originalText).matchAll(NUMBER_RE)].map(m => numKey(m[0])).filter(k => /\d/.test(k)));

  const out = [];
  const summary = { unsupportedSkills: [], inventedPhrases: 0, numbers: 0, scope: 0, years: null, seniority: null };
  for (const l of lines) {
    const flags = [];
    let earn = [];
    if (l.kind === "skills" && hasOriginal) {
      const missing = skillItems(l.text).filter(s => !names(originalText, s));
      if (missing.length) {
        flags.push({ kind: "skills", text: `Not in your original: ${missing.join(", ")}`, terms: missing });
        summary.unsupportedSkills.push(...missing);
        earn = missing.map(term => ({ term, href: learnHref(term) }));
      }
    }
    if (l.kind === "heading" && hasOriginal) {
      const s = maxSeniority(l.text);
      const closest = closestOriginal(l.text, origLines.filter(o => o.kind === "heading"));
      const was = closest ? maxSeniority(closest) : null;
      if (s && (!was || s.rank > was.rank) && !(maxSeniority(originalText)?.rank >= s.rank)) {
        flags.push({ kind: "title", text: `A higher title than your original: "${s.word}"`, terms: [s.phrase] });
        l.closest = closest;
      }
    }
    if (l.kind === "bullet") {
      const nums = [...l.text.matchAll(NUMBER_RE)].map(m => m[0].trim()).filter(n => /\d/.test(n) && !/^(19|20)\d\d$/.test(n.replace(/\D/g, "")));
      const unbacked = hasOriginal ? nums.filter(n => !origNumbers.has(numKey(n))) : nums;
      if (unbacked.length) {
        flags.push({ kind: "number", text: hasOriginal ? `A number your original does not state: ${unbacked.join(", ")}` : `A number you will be asked to back: ${unbacked.join(", ")}`, terms: unbacked });
        summary.numbers += unbacked.length;
      }
      if (hasOriginal) {
        const invented = inventedPhrases(l.text, origBigrams, origWords);
        if (invented.length) {
          flags.push({ kind: "phrase", text: `Words your original never used: "${invented.slice(0, 3).join('", "')}"`, terms: invented });
          summary.inventedPhrases += invented.length;
        }
        const closest = closestOriginal(l.text, origLines.filter(o => o.kind === "bullet"));
        const scope = [...new Set([...l.text.matchAll(SCOPE_RE)].map(m => m[0].toLowerCase()))]
          .filter(w => !(closest && new RegExp(`\\b${esc(w)}\\b`, "i").test(closest)) && !names(origText, w));
        if (scope.length) { flags.push({ kind: "scope", text: `A bigger role than your original says: ${scope.join(", ")}`, terms: scope }); summary.scope += scope.length; }
        l.closest = closest;
      }
    }
    const high = flags.some(f => f.kind === "number" && hasOriginal) || flags.some(f => f.kind === "scope" || f.kind === "title")
      || flags.some(f => f.kind === "phrase" && f.terms.some(t => t.split(/s+/).length >= 3)) || flags.some(f => f.kind === "skills" && f.terms.length >= 3);
    const risk = !flags.length ? "low" : high ? "high" : "medium";
    const probe = !flags.length ? null : `Likely to be probed: ${flags[0].kind === "skills"
      ? `you list ${flags[0].terms.slice(0, 3).join(", ")} — expect "tell me about a time you used ${flags[0].terms[0]}"`
      : flags[0].kind === "number" ? `"how did you measure ${flags[0].terms[0]}?"`
      : flags[0].kind === "scope" ? `you say "${flags[0].terms[0]}" — expect "what exactly was your part, and who else was on it?"`
      : flags[0].kind === "title" ? `"what made the role ${flags[0].terms[0]} — what did you own that others didn't?"`
      : `"walk me through ${flags[0].terms[0]}"`}${hasOriginal ? "; your original has no evidence of it" : ""}.`;
    out.push({ text: l.text, kind: l.kind, risk, flags, probe,
      fix: flags.length ? { reword: l.closest ?? null, earn } : null });
    delete l.closest;
  }

  if (hasOriginal) {
    const y = maxYearsClaim(resumeText), yo = maxYearsClaim(originalText);
    if (y != null && (yo == null || y > yo)) summary.years = { claimed: y, original: yo };
    const s = maxSeniority(resumeText), so = maxSeniority(originalText);
    if (s && (!so || s.rank > so.rank)) summary.seniority = { claimed: s.phrase, original: so?.phrase ?? null };
  }

  let keywords = null;
  if (String(jdText ?? "").trim() && keywordsFor) {
    const now = keywordsFor(resumeText);
    const total = new Set([...now.matched, ...now.missing].map(norm)).size;
    const before = hasOriginal ? keywordsFor(originalText) : null;
    const was = new Set((before?.matched || []).map(norm));
    const added = now.matched.filter(t => !was.has(norm(t)));
    keywords = { total, inResume: now.matched.length, inOriginal: before ? before.matched.length : null,
      added: hasOriginal ? added : [], addedUnsupported: hasOriginal ? added.filter(t => !names(originalText, t)) : [] };
  }

  const flagged = out.filter(l => l.risk !== "low").length;
  return { comparedTo: hasOriginal ? "original" : "none", lines: out, flagged, high: out.filter(l => l.risk === "high").length,
    summary: { ...summary, unsupportedSkills: [...new Set(summary.unsupportedSkills)] }, keywords };
}
