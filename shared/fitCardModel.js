// shared/fitCardModel.js — ⭐ D202 · THE FIELD CARD ⇄ THE ATS CARD, the words and the counts, pure.
//
// Owner 11-25 (D202): "find a way to not lose the design on the field card but make way for it to lead to the format and
// facts that the current one can give, and also the current one needs to expand more to give all listed words and
// contextuality match related things". ONE card, two faces (client/src/plate/FitCard.jsx): the front is the field card
// (fieldCardView, shared/contextualView.js), now opening on the ATS card's count; the back is the ATS card — the count,
// the bar, the tabs. This file is the back's model: every ask the scorer read, grouped, marked, counted.
//
//   fitCardModel({ report, where, claimed }) → {
//     total, on, claimed, missing, pct,                 the count: "N of M things this posting asks for" (N = on + claimed)
//     onShare, clShare,                                 the bar's two filled segments (0–100)
//     words: [{ key, term, label, kind, group, state, where, claimable }],   state: on | claimed | missing
//     groups: [{ id, name, total, have, words }],       the five groups, in order, each with its "N OF M"
//     generic: [label],                                 the posting's general language — read and set aside (never an ask)
//     facts: [{ group, text, state }],                  years / must-haves — said in the Level group, never counted
//   }
//
// ⛔ THE ASKS ARE THE SCORER'S (reportAsks): skills (tier1_*), qualities (competencies_*), job-specific verbs
// (action_verbs_*). None is dropped (test/d202EveryWordListed); generic verbs are not asks (D32) — they are listed apart.
// ⛔ A CLAIM (AG2's reversible call, `That's true of me`): a term the scorer matched only because the person claimed it
// (report.claimed_matches) reads CLAIMED, not on your résumé. `claimed` is the live set (keys) — toggling a key moves its
// word between missing and claimed, and every count here follows at once.
// ⛔ No model (D190): the groups are lookups (shared/techVocabulary.js's groups), the words the scorer's own.
import { reportAsks } from "./atsReportModel.js";
import { profileSignalKey } from "./profileSignals.js";
import { technologiesIn, TECHNOLOGIES } from "./techVocabulary.js";
import { termDisplay } from "./contextualView.js";
import { experienceState, EXPERIENCE_MARK } from "./atsReportModel.js";

/** The five groups of the board's Every word tab, in its order. */
export const FIT_GROUPS = Object.freeze([
  { id: "lang", name: "Languages & frameworks" },
  { id: "tools", name: "Tools & platforms" },
  { id: "duties", name: "Duties" },
  { id: "domain", name: "Domain" },
  { id: "level", name: "Level, years & education" },
]);

/** Which group a scorer term belongs to. A verb is a duty, a quality sits with level and the like; a skill is a
 *  technology when the vocabulary knows it (languages / frameworks, else tools & platforms), else domain knowledge. */
// The stack vocabulary leaves out what nearly every posting names (HTML, CSS) and some tools no company stack is read for;
// a posting's ask still has a group. Keys are lower case.
const FIT_EXTRA = Object.freeze({ html: "lang", css: "lang", html5: "lang", css3: "lang", sass: "lang", webassembly: "lang", wasm: "lang",
  storybook: "tools", launchdarkly: "tools", figma: "tools", jira: "tools", sentry: "tools", "datadog rum": "tools", vercel: "tools", netlify: "tools" });
let byName = null;
function nameGroups() {
  if (byName) return byName;
  byName = new Map();
  for (const [name, group, ...aliases] of TECHNOLOGIES) for (const n of [name, ...aliases]) if (typeof n === "string") byName.set(n.toLowerCase(), group);
  return byName;
}
const asFit = (g) => (g === "languages" || g === "frameworks" || g === "lang" ? "lang" : "tools");
export function fitGroupOf({ term, kind }) {
  if (kind === "verb") return "duties";
  if (kind === "quality") return "level";
  const t = String(term || "").toLowerCase().trim();
  // the term, then its parts ("HTML & CSS", "Rust (WebAssembly)") — a skill the scorer read is a skill, so a context-only
  // name ("Rust", "Go") counts as the technology here
  for (const k of [t, ...t.split(/\s*(?:&|\/|,|\(|\)|\band\b)\s*/).filter(Boolean)]) {
    if (FIT_EXTRA[k]) return FIT_EXTRA[k];
    const g = nameGroups().get(k);
    if (g) return asFit(g);
  }
  const hit = technologiesIn(String(term || ""))[0];
  return hit ? asFit(hit.group) : "domain";
}

export const termKey = (t) => profileSignalKey(t) || String(t || "").toLowerCase().trim();

/** The claimed keys a report starts from: what the scorer matched only on the person's word. */
export function initialClaims(report) {
  return new Set((Array.isArray(report?.claimed_matches) ? report.claimed_matches : []).map(termKey).filter(Boolean));
}

/** The words a verb or a skill shows as (the scorer hands them normalised: "postgresql", "design"). */
const label = (t, kind) => (kind === "verb" ? String(t).charAt(0).toUpperCase() + String(t).slice(1) : termDisplay(t));

export function fitCardModel({ report = null, where = {}, claimed = null } = {}) {
  if (!report) return null;
  const cl = claimed instanceof Set ? claimed : initialClaims(report);
  const asks = reportAsks(report);
  const seen = new Set();
  const words = [];
  const add = (t, onResume) => {
    const key = termKey(t.term);
    if (!key || seen.has(key)) return;
    seen.add(key);
    const isClaimed = cl.has(key);
    const state = isClaimed ? "claimed" : onResume ? "on" : "missing";
    words.push({ key, term: t.term, label: label(t.term, t.kind), kind: t.kind, group: fitGroupOf(t), state,
      where: state === "on" ? (where?.[t.term] || where?.[key] || null) : null,
      // claimable: not on the résumé (a word the résumé evidences needs no claim, and is never "withdrawn" from here)
      claimable: state !== "on" });
  };
  for (const t of asks.onResume) add(t, true);
  for (const t of asks.notOnResume) add(t, false);
  const total = words.length;
  const on = words.filter((w) => w.state === "on").length;
  const nCl = words.filter((w) => w.state === "claimed").length;
  const share = (n) => (total ? +((n / total) * 100).toFixed(1) : 0);
  const groups = FIT_GROUPS.map((g) => {
    const ws = words.filter((w) => w.group === g.id);
    return { ...g, words: ws, total: ws.length, have: ws.filter((w) => w.state !== "missing").length };
  });
  const facts = [];
  const exp = report.experience;
  const st = experienceState(exp);
  if (exp?.summary) facts.push({ group: "level", text: exp.summary, state: st, mark: st ? EXPERIENCE_MARK[st] : null });
  for (const h of report.hard_constraint_misses || []) if (typeof h === "string" && h) facts.push({ group: "level", text: `Must have: ${h}`, state: "short", mark: EXPERIENCE_MARK.short });
  if (report.seniority_cap?.applied && report.seniority_cap.reason) facts.push({ group: "level", text: report.seniority_cap.reason, state: null, mark: null });
  return {
    total, on, claimed: nCl, missing: total - on - nCl,
    pct: Number.isFinite(report.score) ? Math.round(report.score) : null,
    onShare: share(on), clShare: share(nCl),
    words, groups, facts,
    generic: (asks.generic || []).map((g) => label(g.term, "verb")),
  };
}

/** The board's four filters (All · Missing · On your résumé · Claimed) — which words each keeps. */
export const FIT_FILTERS = Object.freeze([
  { id: "all", name: "All", keep: () => true },
  { id: "missing", name: "Missing", keep: (w) => w.state === "missing" },
  { id: "on", name: "On your résumé", keep: (w) => w.state === "on" },
  { id: "claimed", name: "Claimed", keep: (w) => w.state === "claimed" },
]);
export function filterCount(model, id) {
  if (!model) return 0;
  return id === "all" ? model.total : id === "missing" ? model.missing : id === "on" ? model.on : model.claimed;
}

/** Toggle one key in a claim set (a new Set — React state). */
export function toggleClaim(set, key) {
  const n = new Set(set);
  if (n.has(key)) n.delete(key); else n.add(key);
  return n;
}

// ── the Context tab (D192: the contextual score, its parts and weights; similarities / dissimilarities; their stack) ──
const PART_NAMES = Object.freeze([["skill_match", "Skill match"], ["role_fit", "Role fit"], ["tech_stack", "Stack"], ["responsibility_overlap", "Duties"]]);
const pctW = (w) => (Number.isFinite(w) ? `${Math.round(w * 100)} %` : "");
const shareOf = (g) => (Number.isFinite(g?.share) ? g.share : Number.isFinite(g?.postings) && g?.of ? g.postings / g.of : 0);
const bare = (t) => termDisplay(String(t || "").replace(/^(Apache|Amazon|Google|Microsoft)\s+/, ""));
const LEVEL = { entry: "entry", early: "early career", junior: "junior", mid: "mid", senior: "senior", staff: "staff", executive: "executive" };
const cap = (t) => { const x = String(t || ""); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
const sub = (id) => { const t = String(id || "").split(".").pop().replace(/-/g, " "); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
const of = (x) => (Number.isFinite(x?.postings) && x?.of ? `in ${x.postings} of ${x.of}` : shareOf(x) ? `in ${Math.round(shareOf(x) * 100)} % of their postings` : "");

/**
 * contextView(contextual) → null | { score, parts: [{ id, name, weight, score }], similar: [string], different: [string],
 *   stack: [{ kind: exact | ecosystem | gap | extra, name, line, tech? }], ofPostings }
 * A part with no data shows no number and says why (never a dash read as a zero).
 */
export function contextView(contextual, { resumeTech = [] } = {}) {
  const c = contextual && contextual.parts ? contextual : null;
  if (!c) return null;
  const weights = c.weights || {};
  const parts = PART_NAMES.map(([id, name]) => {
    const p = c.parts[id] || {};
    const w = Number.isFinite(p.weight) && p.weight > 0 ? p.weight : weights[id];
    return { id, name, weight: pctW(w), score: p.status === "ok" && Number.isFinite(p.score) ? Math.round(p.score) : null,
      reason: p.status === "ok" ? null : (p.reason || "no_data") };
  });
  const s = c.similarities || {};
  const similar = [];
  const role = c.parts.role_fit;
  if (role?.status === "ok" && (s.role || []).length) similar.push(`Same role and level: ${[sub(role.posting?.subcategory).toLowerCase(), LEVEL[role.posting?.level] || ""].filter(Boolean).join(", ")}`);
  for (const d of s.domains || []) similar.push(`Same domain signal: ${String(d)}`);
  for (const e of s.ecosystem || []) similar.push(`Ecosystem: you use ${bare(e.yours)}, they use ${bare(e.theirs)}`);
  for (const r of (s.responsibilities || []).slice(0, 3)) similar.push(`Duty you've done: “${String(r).slice(0, 80)}”`);
  const different = [];
  for (const d of c.dissimilarities || []) {
    if (d.kind === "domain") different.push(`${cap(d.theirs)} domain${d.yours?.length ? `: yours was ${d.yours.join(" and ")}` : ""}`);
    else if (d.kind === "level") different.push(`Level: the job is ${LEVEL[d.posting] || d.posting}, your résumé reads ${LEVEL[d.resume] || d.resume}`);
    else if (d.kind === "role") different.push(`Role: the job is ${sub(d.posting) || "another role"}, your résumé reads ${sub(d.resume) || "another role"}`);
    else if (d.kind === "responsibility") different.push(`Not on your résumé yet: “${String(d.phrase).slice(0, 80)}”`);
  }
  const t = c.parts.tech_stack || {};
  const stack = [];
  for (const x of t.exact || []) stack.push({ kind: "exact", name: bare(x.tech), line: of(x) });
  for (const e of t.ecosystem || []) stack.push({ kind: "ecosystem", name: `${bare(e.theirs)} ← ${bare(e.yours)}`, line: "same job, different tool" });
  for (const g of [...(t.gaps || [])].sort((a, b) => shareOf(b) - shareOf(a))) stack.push({ kind: "gap", name: bare(g.tech), line: of(g), tech: g.tech });
  const theirs = new Set([...(t.exact || []).map((x) => x.tech), ...(t.ecosystem || []).flatMap((e) => [e.theirs, e.yours]), ...(t.gaps || []).map((g) => g.tech)].map((x) => String(x).toLowerCase()));
  for (const r of resumeTech) if (!theirs.has(String(r).toLowerCase())) stack.push({ kind: "extra", name: bare(r), line: "yours, not theirs — no penalty" });
  return { score: Number.isFinite(c.score) ? Math.round(c.score) : null, parts, similar, different, stack, ofPostings: Number.isFinite(t.of) ? t.of : null,
    stackStatus: t.status || "no_data" };
}
