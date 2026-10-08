// ⛔ D78 B (owner 10-09) · THE BOARD SERVES COMPUTER SCIENCE ONLY.
//
// A PURE rule over the classifier's verdict: given a title and the roleKey classifyJob
// (services/jobs/classifyJob.js) already produced, say whether the posting is in the board's
// scope and NAME the rule that decided. It classifies nothing itself — the family comes from the
// one classifier (A93: built once); this file only reads the title for the distinctions the
// families do not draw (a "Solutions Architect" is filed under engineering, a "Technical Program
// Manager" under pm, a "Mechanical Engineer" or an OpenAI "Researcher, Alignment" under general).
//
// ⛔ APPLIED by boardScope.js (the crawl's gate and the sweep) — and only REPORTED until the owner
// switches board_policy.scope_enforce on (production dry run 10-08: 945 of 1,942 out). The dry run
// is scripts/d78ScopeDryRun.mjs and Admin → Ops. Bump CS_SCOPE_VERSION when a rule changes, so a
// sweep's audit line says which rule set produced it.
//
// The owner's decision (WORKLOG D78 B):
//   IN  — software engineering (backend, frontend, full-stack, mobile) · data engineering, data
//         science, ML / AI · data analyst / BI · security · DevOps / SRE / platform / infrastructure ·
//         QA automation / SDET · embedded / firmware · technical program manager · engineering
//         manager (not answered → DEFAULT IN: including is the reversible choice).
//   OUT — product management · design / UX · sales or solutions engineering · IT support /
//         sysadmin / help desk · hardware, mechanical, electrical, civil and other non-CS
//         engineering · hardware-adjacent software (ASIC tooling) · every non-engineering family.
//
// Order: the title's OUT patterns first (they override every family — a "Systems Administrator"
// and a "Solutions Architect" are filed under engineering), then the CS families, then TPM /
// engineering-manager titles (pm, general, unclassified), then a clear CS title in an unplaced
// posting. Everything else is OUT.
//
// Every pattern is word-bounded. Two traps are pinned by tests: "IT" is matched CASE-SENSITIVELY
// (the word "it" is not IT), and "ML" / "AI" are whole words ("HTML" is not ML, "Email" not AI).

export const CS_SCOPE_VERSION = 1;

/** Families that are computer science by construction. */
const CS_FAMILIES = new Set(['engineering', 'engineering_embedded_firmware', 'data']);
/** Families whose title may still carry a TPM / engineering-manager signal. */
const TPM_FAMILIES = new Set(['pm', 'general', null]);
/** Families with no confident placement — only a clear CS title brings them in. */
const UNPLACED = new Set(['general', null]);

// "IT" is matched CASE-SENSITIVELY; the word after it is not ("IT Support", "IT Ops Engineer").
const IT_WORD = /\bIT\s+([A-Za-z][A-Za-z-]*)/g;
const IT_ROLE = /^(?:support|help-?desk|helpdesk|service|technician|specialist|administrator|admin|operations|ops|systems?|engineer(?:ing)?|analyst|manager|audiovisual)$/i;
const itTitle = (t) => [...t.matchAll(IT_WORD)].some(m => IT_ROLE.test(m[1]));

// Data-centre facilities work ("Data Center Mechanical Engineer", "Data Center Design Engineer,
// Electrical", "Datacenter Networking Technician") — unless the title is plainly software.
const dataCenterFacilities = (t) =>
  /\bdata\s?cent(?:er|re)s?\b/i.test(t) && /\b(?:engineer|technician)\b/i.test(t) && !/\b(?:software|developer)\b/i.test(t);

// ── OUT, whatever the family ────────────────────────────────────────────────────────────────
const OUT_TITLE = [
  // Sales / solutions engineering — customer-facing, filed under sales or engineering.
  { reason: 'out:solutions_engineering',
    re: /\b(?:solutions?|sales|pre-?\s?sales|customer\s+success)\s+(?:engineer(?:ing)?|architect|consultant)s?\b/i },
  { reason: 'out:solutions_engineering', re: /\bpre-?\s?sales\b/i },
  // IT support / sysadmin / help desk.
  { reason: 'out:it_support', test: itTitle },
  { reason: 'out:it_support',
    re: /\b(?:help\s?desk|service\s?desk|desktop\s+support|technical\s+support\s+(?:specialist|technician|analyst)|sys\s?admin|systems?\s+administrator)\b/i },
  // Customer technical support ("Support Engineer", "AI Support Engineer") — support, not engineering.
  { reason: 'out:support_engineering', re: /\bsupport\s+engineer(?:ing)?s?\b/i },
  // Hardware-adjacent: the chip itself, or tooling for it. A word anywhere in the title.
  { reason: 'out:hardware_engineering',
    re: /\b(?:ASIC|PCBA?|RF|RTL|analog|mixed[-\s]signal|signal\s+integrity|chip\s+design|design\s+verification|physical\s+design|silicon\s+(?:design|validation|verification|engineer(?:ing)?))\b/i },
  // Non-CS engineering disciplines, as "<discipline> [design|test|...] engineer(ing)".
  { reason: 'out:hardware_engineering',
    re: /\b(?:hardware|mechanical|electrical|civil|structural|manufacturing|chemical|industrial|aerospace|process|optical|thermal|power\s+electronics)\s+(?:(?:design|test|validation|verification|systems?|reliability|quality|layout|integration)\s+)?engineer(?:ing|s)?\b/i },
  { reason: 'out:hardware_engineering', test: dataCenterFacilities },
];

// ── IN: technical program manager, engineering manager / director / head of engineering ──────
const TPM_TITLE = [
  { reason: 'in:tpm',
    re: /\b(?:technical\s+(?:\w+\s+)?program\s+(?:manag(?:er|ement)|lead)|TPMs?|engineering\s+program\s+manager)\b/i },
  { reason: 'in:engineering_manager',
    re: /\b(?:(?:software\s+)?engineering\s+manager|manager,?\s+(?:of\s+)?(?:software\s+)?engineering)\b/i },
  { reason: 'in:engineering_manager',
    re: /\b(?:director|head|vp|vice\s+president)\b(?:\s+of)?,?\s+(?:software\s+)?engineering\b/i },
];

// ── IN: a clear CS title in a posting the classifier could not place ─────────────────────────
// Extended from the frozen fetch's unplaced titles (scripts/d78ScopeDryRun.mjs): OpenAI's
// "Operating Systems Engineer", "Performance Engineer", "Release Engineer", "Researcher, Alignment";
// Linear's "Product Engineer"; Vercel's "Design Engineer" — software roles the classifier leaves
// under 'general' or drops.
const CS_TITLE = [
  { reason: 'in:title:software',
    re: /\b(?:software\s+(?:engineer(?:ing)?|developer|development|architect)|SWE|developer|programmer)\b/i },
  { reason: 'in:title:data_analyst',
    re: /\b(?:data\s+analyst|business\s+intelligence|BI\s+(?:analyst|engineer|developer)|analytics\s+engineer)\b/i },
  { reason: 'in:title:data',
    re: /\b(?:data\s+(?:scientist|science|engineer(?:ing)?)|machine\s+learning|deep\s+learning|computer\s+vision|NLP|LLMs?)\b/i },
  { reason: 'in:title:ml_ai',
    re: /\b(?:ML|AI)\s+(?:\w+\s+)?(?:engineer(?:ing)?|researcher|research|scientist|developer|architect|infrastructure)\b/i },
  { reason: 'in:title:ml_research',
    re: /\bresearch(?:er|\s+scientist|\s+manager)?\b.*\b(?:alignment|interpretability|reinforcement\s+learning|RL|post-?training|pre-?training|multimodal|robustness|evals?|reasoning|safety\s+(?:training|oversight)|agent\s+safety)\b/i },
  { reason: 'in:title:security',
    re: /\b(?:security\s+(?:operations\s+)?(?:engineer(?:ing)?|architect|researcher|analyst|scientist)|threat\s+(?:intelligence|intel|detection)\s+engineer(?:ing)?|detection\s+engineer|application\s+security|appsec|infosec|cyber\s?security|cyber\s+(?:\w+\s+)?engineer)\b/i },
  { reason: 'in:title:sre_devops',
    re: /\b(?:SRE|site\s+reliability|dev\s?ops|dev\s?sec\s?ops|(?:platform|infrastructure|cloud|reliability|release|build|network(?:ing)?)\s+engineer(?:ing)?)\b/i },
  { reason: 'in:title:qa_automation',
    re: /\b(?:SDETs?|software\s+development\s+engineer\s+in\s+test|test\s+automation|automation\s+engineer|QA\s+(?:engineer|automation))\b/i },
  { reason: 'in:title:engineer',
    re: /\b(?:back[-\s]?end|front[-\s]?end|full[-\s]?stack|mobile|ios|android|web|embedded|firmware|compiler|kernel|graphics|distributed\s+systems|operating\s+systems?|forward[-\s]deployed|product|performance|inference|agents?)\s+(?:(?:software|systems?|modeling)\s+)?engineer(?:ing)?\b/i },
  // "Design Engineer" only as the role itself (Linear, Vercel, Stripe) — not "Actuator Design Engineer".
  { reason: 'in:title:engineer', re: /^(?:(?:senior|staff|lead|principal)\s+)?design\s+engineer\b/i },
  { reason: 'in:title:engineer', re: /\b(?:staff|principal)\s+engineer\b/i },
  { reason: 'in:title:research_engineer',
    re: /\b(?:research\s+engineer|member\s+of\s+(?:the\s+)?technical\s+staff|MTS)\b/i },
];

const matches = (rule, t) => (rule.test ? rule.test(t) : rule.re.test(t));

/**
 * @param {{ title?: string|null, roleKey?: string|null }} job
 * @returns {{ inScope: boolean, reason: string }}
 */
export function csScopeOf({ title, roleKey } = {}) {
  const t = String(title || '');
  const family = roleKey == null || roleKey === '' ? null : String(roleKey);

  for (const rule of OUT_TITLE) if (matches(rule, t)) return { inScope: false, reason: rule.reason };

  if (CS_FAMILIES.has(family)) return { inScope: true, reason: `family:${family}` };

  if (TPM_FAMILIES.has(family)) {
    for (const rule of TPM_TITLE) if (matches(rule, t)) return { inScope: true, reason: rule.reason };
  }

  if (UNPLACED.has(family)) {
    for (const rule of CS_TITLE) if (matches(rule, t)) return { inScope: true, reason: rule.reason };
    return { inScope: false, reason: family === null ? 'out:unclassified_no_cs_signal' : 'out:general_no_cs_signal' };
  }

  return { inScope: false, reason: `out:family:${family}` };
}

/**
 * Counts for a dry run. rows: [{ title, roleKey, company }].
 * @returns {{ version:number, total:number, in:number, out:number,
 *   byReason:Record<string,number>, byFamily:Record<string,{in:number,out:number}>,
 *   byCompany:Record<string,{in:number,out:number}> }}
 */
export function scopeReport(rows = []) {
  const report = { version: CS_SCOPE_VERSION, total: 0, in: 0, out: 0, byReason: {}, byFamily: {}, byCompany: {} };
  for (const row of rows) {
    const { inScope, reason } = csScopeOf(row);
    const side = inScope ? 'in' : 'out';
    report.total += 1;
    report[side] += 1;
    report.byReason[reason] = (report.byReason[reason] || 0) + 1;
    const fam = row.roleKey == null || row.roleKey === '' ? '(none)' : String(row.roleKey);
    (report.byFamily[fam] ??= { in: 0, out: 0 })[side] += 1;
    const co = String(row.company || '(unknown)');
    (report.byCompany[co] ??= { in: 0, out: 0 })[side] += 1;
  }
  return report;
}
