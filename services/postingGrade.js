/**
 * R1 — grade the EMPLOYER'S posting (RECRUITER_LAYER_EXECUTION.md §R1).
 *
 * Everyone grades candidates; nobody grades the employer. This reads a job posting with the
 * machinery that already reads postings for the ATS score, and says how it compares with the
 * postings on this board.
 *
 * ⛔ ZERO MODEL CALLS. The same property as scoreAtsLocally — deterministic, local, free, instant —
 *    and the only thing that would let this be a free public tool.
 * ⛔ COMPARATIVE, NEVER ABSOLUTE. Every measure is returned beside the board's median and the
 *    posting's percentile among N peers, never as a score out of 100. "58" beside "Strong match" was
 *    the ATS panel's defect: a bare number reads as a grade whatever it means. There is NO overall
 *    score, on purpose, and nothing here ranks one employer against another.
 * ⛔ NEVER A LEAGUE TABLE. `boardBaseline` aggregates; it never returns a per-company figure.
 *
 * ⚠ THE BOARD'S TEXT IS CAPPED, so the posting is too. scraped_jobs.description keeps the first
 * ~3,000 and last 2,000 characters of a long posting with an elided middle (htmlToText,
 * JOB_DESCRIPTION_MAX_LENGTH). 1,853 of the 2,613 local postings are capped. A full posting compared
 * with capped peers would name more technologies merely by being longer, so the submitted text is
 * capped THE SAME WAY before it is measured, and the result says so (`comparedOn`).
 *
 * WHAT IS DELIBERATELY NOT HERE: "narrowing language" (rockstar, ninja…). §R1 allows an
 * evidence-based list only, and no list was verified against its source in this session. Leaving it
 * out is the rule, not an omission.
 */
import fs from "node:fs";
import path from "node:path";
import { scoreAtsLocally, isJuniorPosting, REGISTRY_DIR } from "./localAtsScorer.js";
import { truncateWithTail, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH } from "./jobs/htmlToText.js";

// ── requirements sections ─────────────────────────────────────────────────────────────────────
//
// A HEADING is a short line that is not a bullet and does not end a sentence. The phrasings are the
// ones the board actually uses — read off 20 sampled postings before this was written: Stripe's
// "Minimum requirements" / "Preferred qualifications", Anthropic's "You may be a good fit if you",
// OpenAI's "You might thrive in this role if you", Notion's "Skills you'll need to bring" / "Nice to
// haves", Vercel's "About You", Figma's "We'd love to hear from you if you have", Brex's
// "Requirements".
const APOS = "['’]";
const REQUIRED_HEADING = new RegExp([
  `^(minimum|basic|required|key|core)?\\s*(qualifications|requirements)\\b`,
  `^what you${APOS}?ll need`, `^what we${APOS}?re looking for`, `^we${APOS}?re looking for`,
  `^you (might|may|will|would|could)( also)? (thrive|be a (good|great|strong) (fit|match))`,
  `^you${APOS}?ll thrive`, `^who you are`, `^about you\\b`, `^skills you${APOS}?ll need`,
  `^you (have|bring|should have)\\b`, `^what you (bring|have)`, `^must[- ]haves?\\b`,
  `^we${APOS}?d love to hear from you if`, `^ideal candidate`, `^is this you`,
  // Added after reading 20 of the board's NEGATIVES: four were visible sections this missed.
  `^we${APOS}?re seeking`, `^your background`, `might make you successful`, `^your expertise`,
  `^what (you${APOS}?ll|you will) bring`, `^(the )?(skills|experience) (we|you)`,
  // …and three more from 12 uncapped engineering/data negatives (Ramp, Mercury, Duolingo).
  `^what you need`, `^(the )?ideal candidate`,
].join("|"), "i");
const EXPLICIT_REQUIRED = /qualifications|requirements|must[- ]have|what you(['’]ll)? need/i;
const PREFERRED_HEADING = new RegExp([
  `^(preferred|desired|bonus|additional) (qualifications|requirements|skills|points)`,
  `^nice[- ]to[- ]haves?`, `^bonus( points)?\\b`, `^it${APOS}?s a plus`, `^(even )?better if`,
  `^ideally\\b`, `^preferred\\b`, `^plus(es)?\\b`,
].join("|"), "i");

function headings(text) {
  return String(text || "").split(/\n+/).map(l => l.trim())
    .filter(l => l && l.length <= 80 && !/^[•\-*–·▪]/.test(l))
    // Duolingo writes "✅ You have..." — an emoji in front and an ellipsis behind. Neither makes it a
    // sentence; a single closing . ! or ? does.
    .map(l => l.replace(/^[^\p{L}\p{N}]+/u, "").replace(/(\.\.\.|…|:)\s*$/u, "").trim())
    .filter(l => l && !/[.!?]$/.test(l));
}

/** Does the posting STATE what it requires, and does it separate required from preferred? */
export function requirementsSections(text) {
  const hs = headings(text);
  // An explicit "Minimum requirements" beats the "Who you are" that introduces it on Stripe's
  // postings — both count as detection; the explicit one is the better thing to quote back.
  const candidates = hs.filter(h => REQUIRED_HEADING.test(h) && !PREFERRED_HEADING.test(h));
  const required = candidates.find(h => EXPLICIT_REQUIRED.test(h)) || candidates[0] || null;
  const preferred = hs.find(h => PREFERRED_HEADING.test(h)) || null;
  return { required, preferred, hasRequirements: !!(required || preferred), separatesPreferred: !!(required && preferred) };
}

// ── the tools vocabulary — the registry's `tools`, never its `keywords` ─────────────────────
let _tools = null;
function toolVocabulary() {
  if (_tools) return _tools;
  _tools = new Map();
  const registry = JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, "DOMAIN_METADATA_REGISTRY.json"), "utf8"));
  for (const domain of Object.values(registry || {})) {
    for (const t of domain?.tools || []) {
      const name = String(t).trim();
      if (name.length >= 2 && !_tools.has(name.toLowerCase())) _tools.set(name.toLowerCase(), name);
    }
  }
  return _tools;
}

/** Distinct registry tools the text names. Short names ("Go", "R") are matched case-sensitively. */
export function namedTools(text) {
  const found = [];
  for (const name of toolVocabulary().values()) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9+#])${esc}(?=$|[^A-Za-z0-9+#])`, name.length <= 3 ? "" : "i");
    if (re.test(text)) found.push(name);
  }
  return found;
}

// ── boilerplate ───────────────────────────────────────────────────────────────────────────────

function sentences(text) {
  return String(text || "").replace(/\n?\[…\]\n?/g, "\n").split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim().toLowerCase().replace(/\s+/g, " ")).filter(s => s.length >= 40);
}

/**
 * The share of a posting that is company copy rather than role content — text that recurs across
 * this company's OTHER postings is boilerplate by construction. Null when the board holds fewer than
 * MIN_PEERS other postings from the company: no corpus, no claim.
 */
const MIN_PEERS = 5;
const RECUR_MIN = 3;
function boilerplateShare(text, company, peerSentenceCounts) {
  const counts = peerSentenceCounts.get(String(company || "").toLowerCase());
  if (!counts || counts.peers < MIN_PEERS) return null;
  const mine = [...new Set(sentences(text))];
  if (!mine.length) return null;
  const chars = mine.reduce((n, s) => n + s.length, 0);
  const boiler = mine.filter(s => (counts.map.get(s) || 0) >= RECUR_MIN).reduce((n, s) => n + s.length, 0);
  return boiler / chars;
}

// ── the measures, for one posting ─────────────────────────────────────────────────────────────

/** What one posting says, measured. No comparison yet — see gradePosting. */
export function measurePosting({ title = "", company = "", description = "" }, { peerSentenceCounts = new Map() } = {}) {
  const full = String(description || "");
  const text = truncateWithTail(full, JOB_DESCRIPTION_MAX_LENGTH, JOB_DESCRIPTION_TAIL_LENGTH);
  const tools = namedTools(text);
  // The existing extractor, pointed at the posting: an empty résumé, so every term it reads from the
  // posting lands in a "missing" bucket and the buckets ARE the posting's vocabulary.
  const r = scoreAtsLocally({ job: { title, company, description: text }, runtimeBasis: {
    resumeText: "", titles: [], skills: [], actionVerbs: [], yearsExperience: null, structuredFacts: {},
  } });
  const specific = (r.tier1_missing || []).length + (r.action_verbs_missing || []).length;
  const generic = (r.competencies_missing || []).length + (r.action_verbs_generic || []).length;
  // ⛔ Requirements are read from the FULL text. Capping it first would elide the very section being
  // looked for — the board loses OpenAI's and Scale's that way — and report a posting that has one
  // as having none. The board side of this comparison is restricted to UNCAPPED postings instead.
  const req = requirementsSections(full);
  const requiredYears = r.experience?.requiredYears ?? null;
  // The seniority guard's own title test, plus "Junior": the guard leaves Junior out on purpose
  // (it caps SCORES, and a junior role is not an intern one), but a "Junior" title asking 5+ years
  // is exactly the incoherence §R1 names.
  const juniorTitle = isJuniorPosting(title) || /\b(junior|jr\.?)(?=\s|$)/i.test(title);
  return {
    tools: tools.length,
    toolNames: tools,
    genericShare: specific + generic ? generic / (specific + generic) : null,
    boilerplateShare: boilerplateShare(text, company, peerSentenceCounts),
    requirements: req,
    seniority: {
      juniorTitle,
      requiredYears,
      // "5+ years" on a posting titled Junior or Intern. Three is the line: two years is a common,
      // defensible ask for an early-career role; three is the floor of a mid-level one.
      incoherent: juniorTitle && requiredYears != null && requiredYears >= 3,
    },
    capped: text.length < full.length || text.includes("[…]"),
  };
}

// ── the board baseline ────────────────────────────────────────────────────────────────────────

/** Per-company sentence recurrence across the board — the input to the boilerplate measure. */
export function peerSentenceIndex(rows) {
  const byCompany = new Map();
  for (const row of rows) {
    const key = String(row.company || "").toLowerCase();
    let entry = byCompany.get(key);
    if (!entry) { entry = { peers: 0, map: new Map() }; byCompany.set(key, entry); }
    entry.peers++;
    for (const s of new Set(sentences(row.description))) entry.map.set(s, (entry.map.get(s) || 0) + 1);
  }
  return byCompany;
}

function percentileOf(sorted, value) {
  if (!sorted.length || value == null) return null;
  let below = 0, equal = 0;
  for (const v of sorted) { if (v < value) below++; else if (v === value) equal++; }
  return Math.round(100 * (below + equal / 2) / sorted.length);
}
const median = (sorted) => (sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null);

/**
 * The board's distribution of each measure, aggregated across every posting — ⛔ never per company.
 * `rows`: { job_id, title, company, category, description }.
 */
const MIN_ROLE_PEERS = 30;

function distributions(measured) {
  const dist = (pick) => measured.map(({ m }) => pick(m)).filter(v => v != null).sort((a, b) => a - b);
  // Only postings the board stored WHOLE can say how often a requirements section appears: in a
  // capped one the section may simply have been cut out (see measurePosting).
  const whole = measured.filter(({ row }) => !String(row.description || "").includes("[…]"));
  return {
    n: measured.length,
    tools: dist(m => m.tools),
    genericShare: dist(m => m.genericShare),
    boilerplateShare: dist(m => m.boilerplateShare),
    requirementsN: whole.length,
    requirementsRate: whole.filter(({ m }) => m.requirements.hasRequirements).length / (whole.length || 1),
    separatesPreferredRate: whole.filter(({ m }) => m.requirements.separatesPreferred).length / (whole.length || 1),
  };
}

/**
 * The board's distribution of each measure, overall and per ROLE FAMILY (scraped_jobs.bucket_role)
 * — a sales posting naming no technologies is not under-specified, and "the median posting" across
 * sales and engineering together describes neither. ⛔ Never per company.
 * `rows`: { job_id, title, company, bucket_role, description }.
 */
export function boardBaseline(rows) {
  const peerSentenceCounts = peerSentenceIndex(rows);
  const measured = rows.map(row => ({ row, m: measurePosting(row, { peerSentenceCounts }) }));
  const groups = new Map();
  for (const x of measured) {
    const key = x.row.bucket_role || null;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }
  const byRole = new Map();
  for (const [key, xs] of groups) if (xs.length >= MIN_ROLE_PEERS) byRole.set(key, distributions(xs));
  return { ...distributions(measured), peerSentenceCounts, byRole, measured };
}

const pct = (x) => `${Math.round(100 * x)}%`;

/**
 * Grade one posting AGAINST the board. Every line is a comparison a reader can check; there is no
 * total, and nothing names another employer.
 */
export function gradePosting(posting, board, { roleFamily = posting?.bucket_role ?? null } = {}) {
  const m = measurePosting(posting, { peerSentenceCounts: board.peerSentenceCounts });
  // Peers: the posting's role family when the board holds enough of them, else the whole board —
  // and the sentence says which, so "the median" is never ambiguous.
  const baseline = (roleFamily && board.byRole?.get(roleFamily)) || board;
  const peers = baseline === board ? "posting on this board" : `${roleFamily} posting on this board`;
  const peersPlural = baseline === board ? "postings on this board" : `${roleFamily} postings on this board`;
  const lines = [];
  const medTools = median(baseline.tools);
  lines.push({
    measure: "specificity", value: m.tools, boardMedian: medTools, percentile: percentileOf(baseline.tools, m.tools), n: baseline.tools.length,
    sentence: `Names ${m.tools} specific technolog${m.tools === 1 ? "y" : "ies"}; the median ${peers} names ${medTools}.`,
  });
  if (m.genericShare != null) {
    const med = median(baseline.genericShare);
    lines.push({
      measure: "generic_language", value: m.genericShare, boardMedian: med, percentile: percentileOf(baseline.genericShare, m.genericShare), n: baseline.genericShare.length,
      sentence: `${pct(m.genericShare)} of the terms it asks for are generic language (claimable by almost anyone); the median ${peers} is at ${pct(med)}.`,
    });
  }
  if (m.boilerplateShare != null) {
    const med = median(baseline.boilerplateShare);
    lines.push({
      measure: "boilerplate", value: m.boilerplateShare, boardMedian: med, percentile: percentileOf(baseline.boilerplateShare, m.boilerplateShare), n: baseline.boilerplateShare.length,
      sentence: `${pct(m.boilerplateShare)} of its text recurs across the company's other postings; the median ${peers} is at ${pct(med)}.`,
    });
  }
  lines.push({
    measure: "requirements", value: m.requirements, boardRate: baseline.requirementsRate, boardSeparatesRate: baseline.separatesPreferredRate,
    sentence: !m.requirements.hasRequirements
      ? `No requirements section was found; ${pct(baseline.requirementsRate)} of ${peersPlural} have one.`
      : m.requirements.separatesPreferred
        ? `States required and preferred separately ("${m.requirements.required}" / "${m.requirements.preferred}"); ${pct(baseline.separatesPreferredRate)} of ${peersPlural} do.`
        : `Has a requirements section ("${m.requirements.required || m.requirements.preferred}") but does not separate required from preferred; ${pct(baseline.separatesPreferredRate)} of ${peersPlural} do.`,
  });
  if (m.seniority.incoherent) {
    lines.push({ measure: "seniority", value: m.seniority, sentence: `The title reads as junior, and the posting asks for ${m.seniority.requiredYears}+ years.` });
  }
  return {
    lines, peers: baseline === board ? "board" : roleFamily, modelCalls: 0,
    comparedOn: m.capped
      ? "counts on the first ~3,000 and last 2,000 characters, as the board stores its own postings; requirements on the full text"
      : "the full text",
  };
}
