// shared/contextualView.js — ⭐ D192 (4d) · WHAT THE CONTEXTUAL ATS BLOCK SAYS, pure. The owner's pick (11-19): option A of
// https://claude.ai/artifact/TVySAZbL7s7jXD5XEDFpcQ — the two numbers, the four parts, then "What fits" and "What to do" —
// and "the font color on the ats number should do it no need for the words": every number is painted by its band, and no
// band word ("Strong", "Moderate") is written anywhere (D182: no label restates a number).
//
// contextualView(block) → null | {
//   score, skill,                         the contextual and the skill-match numbers (each null when unknown)
//   parts: [{ id, name, score, why }],    the four, in the contract's order — only those with data (no_data is left out)
//   fits:  [{ label, value }],            skills both have · same purpose · their stack · domain · role and level · done
//   todo:  [{ kind, text, tech?, phrase? }], a stack gap ("learn") or a responsibility not shown ("evidence")
//   notes: [text]                          neutral differences (another industry) — never a penalty, said as such
// }
// ⛔ No model (D190): every word below is a template over the block's own fields.

const ORDER = ["skill_match", "role_fit", "responsibility_overlap", "tech_stack"];
const NAMES = { skill_match: "Skill match", role_fit: "Role fit", responsibility_overlap: "What you have done", tech_stack: "Their stack" };
const ROLE = { same_role: "the same role", also_fits: "a role your résumé also fits", same_family: "the same family, another role", other_family: "another family" };
const LEVEL = (l) => String(l || "").replace(/^entry$/, "entry level").replace(/^early$/, "early career");
const clean = (s, n = 120) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");
const list = (xs, n = 6, max = 60) => (Array.isArray(xs) ? xs.map(x => clean(String(x ?? ""), max)).filter(Boolean).slice(0, n) : []);
const num = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null);
const shareWords = (d) => (Number.isFinite(d?.postings) && Number.isFinite(d?.of) ? `in ${d.postings} of their ${d.of} postings`
  : Number.isFinite(d?.share) ? `in ${Math.round(d.share * 100)}% of their postings` : "");

function why(id, p) {
  if (id === "skill_match") return "the terms you both use";
  if (id === "role_fit") {
    const rel = ROLE[p.relation] || "";
    const gap = Number.isFinite(p.level_gap) && p.level_gap !== 0
      ? `, ${Math.abs(p.level_gap)} level${Math.abs(p.level_gap) === 1 ? "" : "s"} ${p.level_gap > 0 ? "below" : "above"} the posting` : "";
    return `${rel}${gap}`.replace(/^,\s*/, "");
  }
  if (id === "responsibility_overlap") return Number.isFinite(p.phrases) ? `${(p.matched || []).length} of the ${p.phrases} things the role does` : "";
  if (id === "tech_stack") {
    // the gaps counted are the ones What to do lists — at least 10 % of their postings (the package's GAP_MIN_SHARE)
    const share = (x) => (Number.isFinite(x?.share) ? x.share : Number.isFinite(x?.postings) && x?.of ? x.postings / x.of : 0);
    const n = (p.exact || []).length, e = (p.ecosystem || []).length, g = (p.gaps || []).filter(x => share(x) >= 0.1).length;
    return [n ? `${n} you share` : "", e ? `${e} close` : "", g ? `${g} you don't show` : ""].filter(Boolean).join(" · ");
  }
  return "";
}

export function contextualView(block) {
  if (!block || typeof block !== "object" || !block.parts) return null;
  const parts = ORDER.map(id => ({ id, p: block.parts[id] })).filter(({ p }) => p && p.status === "ok" && num(p.score) != null)
    .map(({ id, p }) => ({ id, name: NAMES[id], score: num(p.score), why: why(id, p) }));
  const s = block.similarities || {};
  const fits = [];
  const add = (label, value) => { if (value) fits.push({ label, value }); };
  add("Skills you both have", list(s.skills).join(" · "));
  add("Same purpose", (s.ecosystem || []).slice(0, 4).map(e => `you: ${clean(e.yours, 40)} → they: ${clean(e.theirs, 40)}`).join(" · "));
  add("Their stack, yours too", list(s.stack).join(" · "));
  add("Both in", list(s.domains).join(" · "));
  const role = block.parts?.role_fit;
  if (role?.status === "ok" && (s.role || []).length) {
    const sub = clean(String(role.posting?.subcategory || "").split(".").pop().replace(/-/g, " "), 40);
    add("Role and level", [sub, LEVEL(role.posting?.level)].filter(Boolean).join(" · "));
  }
  add("You've done", list(s.responsibilities, 3, 120).map(r => `“${r}”`).join(" · "));   // the whole phrase (the package cuts it on a word)
  const todo = [], notes = [];
  for (const d of block.dissimilarities || []) {
    if (d?.kind === "stack_gap" && clean(d.tech, 60)) todo.push({ kind: "learn", tech: clean(d.tech, 60), text: `They use ${clean(d.tech, 60)}${shareWords(d) ? ` (${shareWords(d)})` : ""}` });
    else if (d?.kind === "responsibility" && clean(d.phrase)) todo.push({ kind: "evidence", phrase: clean(d.phrase), text: `“${clean(d.phrase)}” — your résumé doesn't show it` });
    else if (d?.kind === "domain" && clean(d.theirs, 40)) {
      const yours = list(d.yours, 3);
      notes.push(`They're in ${clean(d.theirs, 40)}${yours.length ? `; your experience is ${yours.join(", ")}` : " — your résumé doesn't name it"}. Not counted against you.`);
    }
  }
  return { score: num(block.score), skill: num(block.parts?.skill_match?.score), parts, fits, todo: todo.slice(0, 6), notes: notes.slice(0, 2) };
}
