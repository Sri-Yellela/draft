// services/resumeChanges.js — ⭐ D90 P1 · "WHAT WE CHANGED": one résumé against another, deterministically.
//
// Spec: docs/WHAT_WE_CHANGED_SPEC.md §4. ⛔ PURE — no database, no network, no model (D17). Two résumés in, the
// changes out. Either side may be the user's uploaded base, a tailored version or the résumé as sent: the caller
// picks the pair (owner, 10-10: "or we can have a compare that lets them select which two to compare").
//
//   · ROLES are aligned by employer + title + dates (the claim guard keeps them unchanged). A role that matches
//     only by employer is reported in `roleChanges` — it should never happen, and it is shown, not hidden.
//   · BULLETS within a role: an identical bullet is Unchanged; otherwise by word overlap (Jaccard over word
//     sets, ≥ MATCH_THRESHOLD), greedy best match with a deterministic tie-break by position; what is left over
//     is Added (after) or Removed (before). Inside a rewritten bullet, a word-level diff (longest common
//     subsequence) marks exactly what changed.
//   · TERMS GAINED are the scorer's matched posting terms present in the after side and absent from the before
//     side, each with its SOURCE: "resume" (the base upload the version was made from contains it), "claims"
//     (the user claimed it), or "untraced" — which the guard should make impossible, and which is counted and
//     made the loudest thing in the view when it occurs.
import { buildStructuredResume } from "./resumeFormatter.js";
import { normaliseAtsTerm } from "@draft/ats-scorer";

export const MATCH_THRESHOLD = 0.3;

const norm = (s) => String(s ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const key = (s) => norm(s).toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9+#.\- ]/g, "").replace(/\s+/g, " ").trim();
const words = (s) => new Set(key(s).split(" ").filter(w => w.length > 1));
function jaccard(a, b) {
  const A = words(a), B = words(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Word-level diff: [{ op: "same" | "del" | "add", text }], adjacent runs merged. */
export function wordDiff(before, after) {
  const a = norm(before).split(" ").filter(Boolean), b = norm(after).split(" ").filter(Boolean);
  const n = a.length, m = b.length;
  // Words compare without case or trailing punctuation ("regions" and "regions," are the same word); the after side's spelling is shown.
  const eq = (x, y) => x.toLowerCase().replace(/[.,;:!?]+$/, "") === y.toLowerCase().replace(/[.,;:!?]+$/, "");
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    L[i][j] = eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const out = [];
  // A "same" run keeps the BEFORE side's spelling too (`was`) when punctuation or case differs, so each side shows its own words.
  const push = (op, w, was = w) => {
    const last = out[out.length - 1];
    if (last?.op === op) { last.text += ` ${w}`; if (op === "same") last.was += ` ${was}`; }
    else out.push(op === "same" ? { op, text: w, was } : { op, text: w });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { push("same", b[j], a[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push("del", a[i++]);
    else push("add", b[j++]);
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);
  for (const o of out) if (o.op === "same" && o.was === o.text) delete o.was;
  return out;
}

// A term is "in" a text on word edges of the normalised form; a short term ("go", "r") only as written.
function hasTerm(text, term) {
  const t = normaliseAtsTerm(term);
  if (!t) return false;
  if (t.length <= 2) {
    const esc = String(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![A-Za-z0-9+#])${esc}(?![A-Za-z0-9+#])`).test(String(text ?? ""));
  }
  return ` ${normaliseAtsTerm(text)} `.includes(` ${t} `);
}

const asStructure = (content) => (content && typeof content === "object" && content.sections) ? content : buildStructuredResume(String(content ?? ""));
const roleKey = (e) => `${key(e.company)}|${key(e.role)}|${key(e.date)}`;
const skillValues = (sec) => (sec.rows || []).flatMap(r => String(r.values ?? "").split(/\s*(?:,|;|\||•|·)\s*/).map(v => v.trim()).filter(Boolean));
const plainText = (structure) => (structure.sections || []).map(s => [s.text, ...(s.entries || []).flatMap(e => [e.company, e.role, e.date, e.meta, e.text, ...(e.bullets || [])]),
  ...(s.rows || []).map(r => `${r.label} ${r.values}`)].filter(Boolean).join("\n")).join("\n");

/** Aligns two bullet lists. Returns [{ status, before, after, score }] in the after side's order, removed last. */
export function alignBullets(beforeList = [], afterList = []) {
  const A = beforeList.map(norm), B = afterList.map(norm);
  const usedA = new Set(), usedB = new Set(), pairs = new Map();
  // 1. identical bullets
  B.forEach((b, j) => { const i = A.findIndex((a, k) => !usedA.has(k) && key(a) === key(b)); if (i >= 0) { usedA.add(i); usedB.add(j); pairs.set(j, { i, score: 1, same: true }); } });
  // 2. greedy best overlap, ties by position
  const cand = [];
  B.forEach((b, j) => { if (usedB.has(j)) return; A.forEach((a, i) => { if (usedA.has(i)) return; const s = jaccard(a, b); if (s >= MATCH_THRESHOLD) cand.push({ i, j, s }); }); });
  cand.sort((x, y) => y.s - x.s || x.j - y.j || x.i - y.i);
  for (const c of cand) if (!usedA.has(c.i) && !usedB.has(c.j)) { usedA.add(c.i); usedB.add(c.j); pairs.set(c.j, { i: c.i, score: c.s, same: false }); }
  const out = B.map((b, j) => {
    const p = pairs.get(j);
    if (!p) return { status: "added", before: null, after: b };
    if (p.same) return { status: "unchanged", before: A[p.i], after: b };
    return { status: "rewritten", before: A[p.i], after: b, score: Math.round(p.score * 100) / 100, wordDiff: wordDiff(A[p.i], b) };
  });
  A.forEach((a, i) => { if (!usedA.has(i)) out.push({ status: "removed", before: a, after: null }); });
  return out;
}

/**
 * @param {{ before, after, base?, claims?: { skills?: string[] }, afterReport?: { tier1_matched?: string[], tier1_missing?: string[] } }} args
 *   before / after / base — résumé text, résumé HTML or a buildStructuredResume structure. `base` is the upload the
 *   after side was made from (for each term's source); it defaults to `before`.
 */
export function compareResumes({ before, after, base = before, claims = {}, afterReport = null }) {
  const B = asStructure(before), Aft = asStructure(after), Base = asStructure(base);
  const beforeText = plainText(B), baseText = plainText(Base);
  const claimed = (claims?.skills || []).map(String);
  const matched = [...new Set((afterReport?.tier1_matched || []).map(String))];
  const sourceOf = (term) => hasTerm(baseText, term) ? "resume" : claimed.some(c => normaliseAtsTerm(c) === normaliseAtsTerm(term)) ? "claims" : "untraced";
  const gainedIn = (beforeS, afterS) => matched.filter(t => hasTerm(afterS, t) && !hasTerm(beforeS, t)).map(t => ({ term: t, source: sourceOf(t) }));

  const counts = { rewritten: 0, added: 0, removed: 0, unchanged: 0 };
  const sections = [];
  const roleChanges = [];
  const secKey = (s) => `${s.type}|${key(s.title)}`;
  const beforeSecs = new Map((B.sections || []).map(s => [secKey(s), s]));
  const seen = new Set();

  for (const s of Aft.sections || []) {
    const k = secKey(s); seen.add(k);
    const prev = beforeSecs.get(k);
    if (s.type === "summary") {
      const status = !prev ? "added" : key(prev.text) === key(s.text) ? "unchanged" : "rewritten";
      if (status !== "unchanged") counts[status]++; else counts.unchanged++;
      sections.push({ type: "summary", title: s.title, status, before: prev?.text ?? null, after: s.text ?? null,
        ...(status === "rewritten" ? { wordDiff: wordDiff(prev.text, s.text) } : {}), termsGained: gainedIn(prev?.text ?? "", s.text ?? "") });
    } else if (s.type === "skills") {
      const a = skillValues(prev || {}), b = skillValues(s);
      const ak = a.map(key), bk = b.map(key);
      const added = b.filter((v, i) => !ak.includes(bk[i])), removed = a.filter((v, i) => !bk.includes(ak[i]));
      const common = bk.filter(x => ak.includes(x));
      const reordered = common.join("|") !== ak.filter(x => bk.includes(x)).join("|");
      sections.push({ type: "skills", title: s.title, status: added.length || removed.length || reordered ? "changed" : "unchanged", added, removed, reordered, before: a, after: b,
        termsGained: gainedIn(a.join(", "), b.join(", ")) });
    } else {
      const prevEntries = [...(prev?.entries || [])];
      const usedPrev = new Set();
      const entries = (s.entries || []).map(e => {
        let i = prevEntries.findIndex((p, x) => !usedPrev.has(x) && roleKey(p) === roleKey(e));
        if (i < 0) {
          i = prevEntries.findIndex((p, x) => !usedPrev.has(x) && key(p.company) === key(e.company) && key(p.company));
          if (i >= 0) roleChanges.push({ section: s.title, before: { company: prevEntries[i].company, role: prevEntries[i].role, date: prevEntries[i].date },
            after: { company: e.company, role: e.role, date: e.date } });
        }
        const p = i >= 0 ? prevEntries[i] : null;
        if (i >= 0) usedPrev.add(i);
        const bullets = alignBullets(p?.bullets || [], e.bullets || []).map(b => ({ ...b, termsGained: b.status === "unchanged" || b.status === "removed" ? [] : gainedIn(b.before ?? "", b.after ?? "") }));
        for (const b of bullets) counts[b.status]++;
        const sameDetail = p && key(p.meta) === key(e.meta) && key(p.text) === key(e.text);
        return { company: e.company, role: e.role, date: e.date, status: !p ? "added" : bullets.every(b => b.status === "unchanged") && sameDetail ? "unchanged" : "changed", bullets };
      });
      prevEntries.forEach((p, x) => {
        if (usedPrev.has(x)) return;
        const bullets = (p.bullets || []).map(b => ({ status: "removed", before: norm(b), after: null, termsGained: [] }));
        counts.removed += bullets.length;
        entries.push({ company: p.company, role: p.role, date: p.date, status: "removed", bullets });
      });
      const status = entries.every(e => e.status === "unchanged") ? "unchanged" : "changed";
      sections.push({ type: s.type, title: s.title, status, entries });
    }
  }
  for (const [k, s] of beforeSecs) if (!seen.has(k)) sections.push({ type: s.type, title: s.title, status: "removed" });

  const termsGained = gainedIn(beforeText, plainText(Aft));
  return {
    summary: {
      ...counts,
      termsGained,
      untraced: termsGained.filter(t => t.source === "untraced").length,
      requirementsMissing: [...(afterReport?.tier1_missing || [])],
      roleChanges: roleChanges.length,
      identical: counts.rewritten + counts.added + counts.removed === 0 && !roleChanges.length && sections.every(s => s.status === "unchanged"),
    },
    roleChanges,
    sections,
  };
}
