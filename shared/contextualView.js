// shared/contextualView.js — ⭐ THE ATS CARD's words, pure. The owner's pick, 11-19: option C of
// https://claude.ai/artifact/Fx8EDAEByAkLuBcADt7v2W — "the number, then the four things it is made of — one bar and one
// plain line each — and the single most useful next step. No lists of terms." It REPLACES the old report's claims ("That's
// true of me", owner: "ditch the whole prove it and claim it gimmick") and the In context section in the posting's panel.
// Every number is painted by its band (owner 11-19: "the font color on the ats number should do it no need for the words").
//
// atsCardView({ report, contextual }) → null | {
//   declined: false, score,                         the number: the contextual one, else the skill match
//   parts: [{ id, name, score, line }],             Skills · Role · The work · Their stack — those with data, in that order
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
  parts.push({ id: "skill_match", name: "Skills", score: skill, line });
  const role = c?.parts?.role_fit, work = c?.parts?.responsibility_overlap, stack = c?.parts?.tech_stack;
  if (role?.status === "ok" && num(role.score) != null) parts.push({ id: "role_fit", name: "Role", score: num(role.score), line: roleLine(role) });
  if (work?.status === "ok" && num(work.score) != null) parts.push({ id: "responsibility_overlap", name: "The work", score: num(work.score), line: workLine(work) });
  if (stack?.status === "ok" && num(stack.score) != null) parts.push({ id: "tech_stack", name: "Their stack", score: num(stack.score), line: stackLine(stack) });

  // the single biggest gain: their most-used technology you don't show, else the skill the posting asks for most, else the work
  let gain = null;
  const gap = (c?.dissimilarities || []).find(d => d.kind === "stack_gap");
  if (gap) gain = { tech: clean(gap.tech, 60), text: `${clean(gap.tech, 60)}${shareOf(gap) ? ` — in ${Math.round(shareOf(gap) * 100)}% of their jobs` : ""}` };
  else if (words(report?.tier1_missing, 1).length) { const t = words(report.tier1_missing, 1)[0]; gain = { tech: t, text: `${t} — the posting asks for it` }; }
  else if ((work?.missing || []).length) gain = { text: `Show “${short(work.missing[0])}” on your résumé` };
  return { declined: false, score: num(c?.score) ?? skill, parts, gain };
}
