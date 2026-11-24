// shared/contextualView.js — ⭐ THE ATS CARD's words, pure. The owner's pick, 11-19: option C of
// https://claude.ai/artifact/Fx8EDAEByAkLuBcADt7v2W — "the number, then the four things it is made of — one bar and one
// plain line each — and the single most useful next step. No lists of terms." It REPLACES the old report's claims ("That's
// true of me", owner: "ditch the whole prove it and claim it gimmick") and the In context section in the posting's panel.
// Every number is painted by its band (owner 11-19: "the font color on the ats number should do it no need for the words").
//
// atsCardView({ report, contextual }) → null | {
//   declined: false, score,                         the number: the contextual one, else the skill match
//   parts: [{ id, name, score, line, facts }],      Skills · Role · The work · Their stack — those with data, in that order
//   facts: [string],                                 ⭐ 46z (owner 11-20: "can definitely put more stats out … just state more to
//                                                    add context"): short figures the scorer already computed — counts, years,
//                                                    each part's weight, their stack's shares, a shared field. Stated, never
//                                                    explained; under each part's line, and one row for the whole card.
//   gain: { text, tech? } | null,                    the single biggest gain (a stack gap → its Atlas page when one exists)
// } | { declined: true, reason }                      the scorer declined: said in words, never a number
// ⛔ No model (D190): every word is a template over the report's and the block's own fields.

const clean = (s, n = 120) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");
const num = (n) => (typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null);
// The scorer hands its terms normalised ("postgresql", "aws"); a name is shown as people write it. A known name takes its
// casing; another lower-case word takes a capital; a vendor prefix ("Apache Kafka") is dropped where the line is short.
const CASING = Object.fromEntries(["AWS", "GCP", "Azure", "SQL", "NoSQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Kafka", "Docker", "Kubernetes",
  "gRPC", "GraphQL", "REST", "TypeScript", "JavaScript", "Node.js", "React", "Terraform", "Python", "Java", "Go", "Ruby", "Rust",
  "C++", "C#", "Scala", "Kotlin", "Swift", "Spark", "Airflow", "Snowflake", "dbt", "Linux", "CI/CD", "API", "APIs", "HTML", "CSS",
  "Elasticsearch", "DynamoDB", "BigQuery", "Databricks", "Tableau", "Excel", "PyTorch", "TensorFlow", "Jenkins", "Git", "iOS", "Android"]
  .map(n => [n.toLowerCase(), n]));
const display = (t) => { const k = String(t).toLowerCase(); return CASING[k] || (t === k && /^[a-z]/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : t); };
const bare = (t) => String(t || "").replace(/^(Apache|Amazon|Google|Microsoft)\s+/, "");
const words = (xs, n) => (Array.isArray(xs) ? xs.map(x => display(clean(String(x?.term ?? x ?? ""), 40))).filter(Boolean).slice(0, n) : []);
const join = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const short = (s, n = 60) => { const t = clean(s, 200); return t.length <= n ? t : `${t.slice(0, n).replace(/\s+\S*$/, "")}…`; };
const subName = (id) => { const t = String(id || "").split(".").pop().replace(/-/g, " "); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""; };
const LEVEL = { entry: "entry level", early: "early career", junior: "junior", mid: "mid level", senior: "senior", executive: "executive" };
const shareOf = (g) => (Number.isFinite(g?.share) ? g.share : Number.isFinite(g?.postings) && g?.of ? g.postings / g.of : 0);

function skillsLine(report) {
  const have = words(report?.tier1_matched, 5), miss = words(report?.tier1_missing, 3);
  if (!have.length && !miss.length) return "";
  if (!miss.length) return `${have.join(", ")} — everything it asks for`;
  return `${have.length ? `${have.join(", ")} — ` : ""}missing ${miss.join(", ")}`;
}
function roleLine(p) {
  const job = [subName(p.posting?.subcategory), LEVEL[p.posting?.level] || ""].filter(Boolean).join(", ");
  const yours = [subName(p.resume?.subcategory), LEVEL[p.resume?.level] || ""].filter(Boolean).join(", ");
  if (p.relation === "same_role" && !p.level_gap) return `${job || "Your role"} — the same as the job`;
  if (p.relation === "same_role" || p.relation === "also_fits") {
    const g = Math.abs(p.level_gap || 0);
    return g ? `${job} — your résumé reads ${g} level${g === 1 ? "" : "s"} ${p.level_gap > 0 ? "below" : "above"} it` : `${job} — a role your résumé also fits`;
  }
  return `The job is ${job || "another role"}; your résumé reads ${yours || "another role"}`;
}
function workLine(p) {
  const done = p.matched || [], miss = p.missing || [];
  if (!miss.length) return `You have done all ${p.phrases} things it describes`;
  if (!done.length) return `Not on your résumé yet: “${short(miss[0])}”`;
  return `You have done ${done.length} of ${p.phrases} — not “${short(miss[0], 48)}”`;
}
function stackLine(p) {
  const bits = [];
  const yes = (p.exact || []).slice(0, 2).map(x => bare(x.tech));
  if (yes.length) bits.push(`${join(yes)} yes`);
  const eco = (p.ecosystem || []).find(e => !(p.exact || []).some(x => x.tech === e.yours));
  if (eco) bits.push(`${bare(eco.yours)} ≈ their ${bare(eco.theirs)}`);
  const gap = [...(p.gaps || [])].sort((a, b) => shareOf(b) - shareOf(a))[0];
  if (gap && shareOf(gap) >= 0.1) bits.push(`${bare(gap.tech)} no`);
  return bits.join(" · ");
}

const pct = (x) => `${Math.round(x * 100)}%`;
const count = (xs) => (Array.isArray(xs) ? xs.length : 0);
const weighs = (part) => (Number.isFinite(part?.weight) && part.weight > 0 && part.weight < 1 ? `weighs ${pct(part.weight)}` : "");   // the whole score: nothing to say
function skillFacts(report, part) {
  const have = count(report?.tier1_matched), miss = count(report?.tier1_missing);
  const out = [];
  if (have + miss) out.push(`${have} of ${have + miss} skills`);
  const ex = report?.experience || {};
  if (Number.isFinite(ex.requiredYears)) out.push(`${ex.requiredYears}+ yrs asked${Number.isFinite(ex.candidateYears) ? ` · you show ${ex.candidateYears}` : ""}`);
  else if (Number.isFinite(ex.candidateYears)) out.push(`you show ${ex.candidateYears} yrs`);
  const hard = count(report?.hard_constraint_misses);
  if (hard) out.push(`${hard} must-have${hard === 1 ? "" : "s"} missing`);
  const v = count(report?.action_verbs_matched), vm = count(report?.action_verbs_missing);
  if (v + vm) out.push(`${v} of ${v + vm} action verbs`);
  if (report?.seniority_cap?.applied) out.push("capped for seniority");
  const w = weighs(part); if (w) out.push(w);
  return out;
}
function roleFacts(p) {
  const out = [];
  const g = Math.abs(p.level_gap || 0);
  if (g) out.push(`${g} level${g === 1 ? "" : "s"} apart`);
  else if (p.posting?.level && p.posting.level === p.resume?.level) out.push("same level");
  if (p.domain_lift) out.push(`+${p.domain_lift} for a shared field`);
  const w = weighs(p); if (w) out.push(w);
  return out;
}
function workFacts(p) {
  const out = [];
  const left = count(p.missing);   // the line already says "n of m"; the figure here is what's left to show
  if (left) out.push(`${left} dut${left === 1 ? "y" : "ies"} to show`);
  const w = weighs(p); if (w) out.push(w);
  return out;
}
function stackFacts(p) {
  const out = [];
  const shares = [...(p.exact || []), ...(p.ecosystem || []).map(e => ({ tech: e.theirs, share: e.share })), ...(p.gaps || [])]
    .filter(x => x.tech && shareOf(x) > 0).sort((a, b) => shareOf(b) - shareOf(a)).slice(0, 3);
  if (shares.length) out.push(`${shares.map(x => `${bare(x.tech)} ${pct(shareOf(x))}`).join(", ")} of their jobs`);
  const n = count(p.exact) + count(p.ecosystem) + count(p.gaps);
  if (n) out.push(`${count(p.exact)} of ${n} of their tools exact${count(p.ecosystem) ? ` · ${count(p.ecosystem)} close` : ""}`);
  const w = weighs(p); if (w) out.push(w);
  return out;
}
function cardFacts(report, c, skill) {
  const out = [];
  if (c && Number.isFinite(c.score) && c.score !== skill) out.push(`skill match ${skill} · in context ${c.score}`);
  const domains = (c?.similarities?.domains || []).map(d => clean(String(d), 30)).filter(Boolean);
  if (domains.length) out.push(`${join(domains)} in common`);
  const theirs = (c?.dissimilarities || []).filter(d => d.kind === "domain").map(d => clean(String(d.theirs), 30)).filter(Boolean);
  if (theirs.length) out.push(`their field: ${join(theirs.slice(0, 2))}`);
  if (report?.resume_depth?.reason === "short_resume") out.push("your résumé is short");
  return out;
}

export function atsCardView({ report = null, contextual = null } = {}) {
  if (!report && !contextual) return null;
  const skill = num(report?.score ?? contextual?.parts?.skill_match?.score);
  if (skill == null) {
    const why = clean((report?.decline_reasons || [])[0] || "", 140);
    return { declined: true, reason: why || "The posting or your résumé says too little to judge the fit." };
  }
  const c = contextual && contextual.parts ? contextual : null;
  const parts = [];
  const line = skillsLine(report);
  parts.push({ id: "skill_match", name: "Skills", score: skill, line, facts: skillFacts(report, c?.parts?.skill_match) });
  const role = c?.parts?.role_fit, work = c?.parts?.responsibility_overlap, stack = c?.parts?.tech_stack;
  if (role?.status === "ok" && num(role.score) != null) parts.push({ id: "role_fit", name: "Role", score: num(role.score), line: roleLine(role), facts: roleFacts(role) });
  // ⭐ 47c (owner 11-24): a résumé with no role placed left Role off the card (weights read 63 / 19 / 19 with no word why).
  // It stays on the card, with no number and the one step that gives it one; it never counts in the score.
  else if (role?.status === "no_data" && role.reason === "resume_not_placed") parts.push({ id: "role_fit", name: "Role", score: null, pending: true, line: "Pick your role in Your profile to compare", facts: [] });
  if (work?.status === "ok" && num(work.score) != null) parts.push({ id: "responsibility_overlap", name: "The work", score: num(work.score), line: workLine(work), facts: workFacts(work) });
  if (stack?.status === "ok" && num(stack.score) != null) parts.push({ id: "tech_stack", name: "Their stack", score: num(stack.score), line: stackLine(stack), facts: stackFacts(stack) });

  // the single biggest gain: their most-used technology you don't show, else the skill the posting asks for most, else the work
  let gain = null;
  const gap = (c?.dissimilarities || []).find(d => d.kind === "stack_gap");
  if (gap) gain = { tech: clean(gap.tech, 60), text: `${clean(gap.tech, 60)}${shareOf(gap) ? ` — in ${Math.round(shareOf(gap) * 100)}% of their jobs` : ""}` };
  else if (words(report?.tier1_missing, 1).length) { const t = words(report.tier1_missing, 1)[0]; gain = { tech: t, text: `${t} — the posting asks for it` }; }
  else if ((work?.missing || []).length) gain = { text: `Show “${short(work.missing[0])}” on your résumé` };
  return { declined: false, score: num(c?.score) ?? skill, parts, gain, facts: cardFacts(report, c, skill) };
}
