// ⛔ D126 + D127 (owner 11-01) · ALL PROFESSIONAL ROLES, EACH IN ONE CATEGORY — AND NOTHING SHOWN FROM AN UNKNOWN ONE.
//
// A recorded reversal of D78 B ("computer science only"; CORRECTIONS_REGISTER.md). D78's 120-day age limit and its
// source rules stay. This is the board's scope rule now: a PURE function over the classifier's family and the title
// (like csScope.js, which it keeps as the computing rule — today's board is category `computing`, unchanged).
//
// Every posting gets ONE category (on the US SOC major groups, O*NET), an occupation code where the rule knows one,
// a discipline for engineering, and a confidence. ⛔ THE RED-FLAG RULE (D127 P2): below CATEGORY_CONFIDENCE_FLOOR, in
// a held group, or matching no category, the posting is HELD — `inScope: false` with the reason — and the board's
// gate (boardScope.js) never writes it, exactly as it refused out-of-scope postings before. A category is only ever
// given on a TITLE signal: the classifier's family alone (e.g. 'finance' for "Associate") is not enough, because a
// family-only verdict is how roles leak into the wrong board.
//
// Held until the owner decides (D127 P1, D126): healthcare practitioners (29), education (25), office and
// administrative support (43), community and social service (21); engineering technicians, drafters / CAD,
// field-service and sales / solutions engineers; and D78's IT support / support engineering (not in any category).
// Bump CATEGORY_SCOPE_VERSION when a rule changes.
import { csScopeOf } from './csScope.js';

export const CATEGORY_SCOPE_VERSION = 1;
export const CATEGORY_CONFIDENCE_FLOOR = 0.75;

/** The board's categories, with their SOC major group. Marketing spans 11 / 13 / 27 and is its own category. */
export const CATEGORIES = Object.freeze({
  computing:   { label: 'Computing and data',            soc: '15' },
  engineering: { label: 'Engineering',                   soc: '17' },
  management:  { label: 'Management',                    soc: '11' },
  business:    { label: 'Business and finance',          soc: '13' },
  science:     { label: 'Science and research',          soc: '19' },
  legal:       { label: 'Legal',                         soc: '23' },
  arts_media:  { label: 'Design, media and communications', soc: '27' },
  sales:       { label: 'Sales',                         soc: '41' },
  marketing:   { label: 'Marketing',                     soc: '11-2021' },
});

const TITLE_CONFIDENCE = 0.9;
const FAMILY_ONLY_CONFIDENCE = 0.6;

// ── HELD, whatever the family (checked first) ─────────────────────────────────────────────────
const HELD = [
  { reason: 'held:pending_engineering_role', re: /\btechnicians?\b/i },
  { reason: 'held:pending_engineering_role', re: /\b(?:drafters?|drafting|draftsman|CAD\s+(?:technician|designer|operator|drafter|specialist))\b/i },
  { reason: 'held:pending_engineering_role', re: /\bfield\s+(?:service\s+|application\s+)?engineer(?:ing)?s?\b/i },
  { reason: 'held:pending_engineering_role',
    re: /\b(?:solutions?|sales|pre-?\s?sales|customer\s+success)\s+(?:engineer(?:ing)?|architect|consultant)s?\b/i },
  { reason: 'held:healthcare',
    re: /\b(?:nurse|nursing|RN|LPN|CNA|physicians?|doctor|surgeon|pharmacist|therapist|dentist|hygienist|medical\s+assistant|clinician|psychiatrist|psychologist|radiolog\w*|sonographer|paramedic|EMT|veterinar\w*|optometrist|dietitian|phlebotom\w*|caregiver|midwife|anesthesi\w*)\b/i },
  { reason: 'held:education',
    re: /\b(?:teachers?|teaching|tutors?|instructors?|professors?|lecturers?|educators?|faculty|curriculum|school)\b/i },
  { reason: 'held:office_admin',
    re: /\b(?:administrative\s+(?:assistant|coordinator|specialist)|executive\s+assistant|receptionist|office\s+(?:manager|assistant|coordinator|administrator)|data\s+entry|clerk|secretary|front\s+desk|mailroom)\b/i },
  { reason: 'held:community_service',
    re: /\b(?:social\s+worker|case\s+manager|counsell?or|community\s+health|chaplain|youth\s+(?:worker|coordinator))\b/i },
  { reason: 'held:non_professional',
    re: /\b(?:cashier|barista|store\s+associate|retail\s+(?:sales\s+)?associate|sales\s+associate)\b/i },
];

// csScope's refusals that are not a category of their own: held, never re-filed elsewhere.
const CS_OUT_HELD = new Map([
  ['out:it_support', 'held:it_support'],
  ['out:support_engineering', 'held:it_support'],
  ['out:solutions_engineering', 'held:pending_engineering_role'],
]);

// ── ENGINEERING (17), by discipline ───────────────────────────────────────────────────────────
const DISCIPLINES = [
  ['mechanical', /\b(?:mechanical|mechatronics?|HVAC|thermal|MEP)\b/i],
  ['electrical', /\b(?:electrical|electronics?|power\s+(?:systems?|electronics)|PCBA?|RF|analog|mixed[-\s]signal|signal\s+integrity)\b/i],
  ['hardware', /\b(?:hardware|ASIC|RTL|silicon|semiconductor|chip\s+design|design\s+verification|physical\s+design|photonics?|optical)\b/i],
  ['civil', /\b(?:civil|structural|geotechnical|transportation|construction|water\s+resources)\b/i],
  ['chemical', /\b(?:chemical|polymer)\b/i],
  ['industrial', /\b(?:industrial|manufacturing|production|process|packaging|lean|continuous\s+improvement)\b/i],
  ['aerospace', /\b(?:aerospace|avionics|propulsion|aeronautical|spacecraft|flight\s+(?:test|systems?))\b/i],
  ['automotive', /\b(?:automotive|vehicle|powertrain|battery)\b/i],
  ['biomedical', /\b(?:biomedical|medical\s+devices?|bioengineering)\b/i],
  ['materials', /\b(?:materials|metallurg\w*|ceramics?|composites?)\b/i],
  ['environmental', /\b(?:environmental|sustainability|energy|petroleum|reservoir|drilling|nuclear|renewables?|solar|wind)\b/i],
  ['controls', /\b(?:controls?|robotics?|automation|instrumentation|PLC)\b/i],
  ['quality', /\b(?:quality|reliability|validation|test|compliance)\b/i],
];
// "Systems" / "integration" are not a discipline here: on this board they are business-systems and services roles
// (spot-check 11-01: "Finance Systems Engineer", "Integration Engineer, Professional Services"). Held, not guessed.
const ENGINEER_WORD = /\bengineer(?:ing|s)?\b/i;
// An architect is engineering only in hardware ("Hardware Systems Architect"); "GTM Operations Process Architect" is not.
const HARDWARE_ARCHITECT = /\b(?:hardware|silicon|SoC|chip|ASIC|electrical|mechanical)\b.*\barchitect\b/i;
const ARCHITECT_BUILDING = /\b(?:project|licensed|registered|design)\s+architect\b|\barchitectural\s+(?:designer|engineer)\b/i;
const PROJECT_ENGINEER = /\bproject\s+engineer\b/i;
const SOFTWARE_WORD = /\bsoftware\b/i;

// ── The other categories, most specific first ─────────────────────────────────────────────────
// A product / program / project manager is management before any subject word in the title ("Staff Product
// Manager, Growth", "… Stripe Tax"); "Product Marketing Manager" does not match it and stays marketing.
const TITLE_RULES = [
  { category: 'management', soc: '11-2021',
    re: /\b(?:(?:product|program|project|programme)\s+(?:manager|management|director|lead|owner)|director\s+of\s+product|(?:VP|head)\s+of\s+product)\b/i },
  { category: 'legal', soc: '23-1011',
    re: /\b(?:lawyer|attorney|counsel|paralegal|legal\s+(?:assistant|analyst|specialist|operations|counsel)|contracts?\s+(?:manager|specialist|administrator)|general\s+counsel)\b/i },
  { category: 'sales', soc: '41-4011',
    re: /\b(?:account\s+(?:executive|manager|director)|sales|SDR|BDR|business\s+development|partnerships?\s+(?:manager|lead|director)|customer\s+success)\b/i },
  { category: 'marketing', soc: '11-2021',
    re: /\b(?:marketing|marketer|growth\s+market\w*|SEO|SEM|demand\s+gen(?:eration)?|brand\s+(?:manager|strategist|marketing)|lifecycle\s+market\w*|social\s+media)\b/i },
  { category: 'arts_media', soc: '27-1024',
    re: /\b(?:designer|design\s+(?:lead|manager|director)|UX|UI|user\s+experience|user\s+research(?:er)?|writer|editor|copywriter|content\s+(?:designer|strategist|producer|creator)|communications\s+(?:manager|specialist|lead|director|associate)|public\s+relations|PR\s+(?:manager|specialist|lead)|journalist|producer|videographer|video\s+editor|photographer|illustrator|animator|art\s+director|creative\s+director)\b/i },
  { category: 'science', soc: '19-1029',
    re: /\b(?:scientist|economist|chemist|biologist|physicist|geologist|epidemiologist|neuroscientist|researcher|research\s+(?:associate|fellow)|postdoc\w*|clinical\s+research)\b/i },
  { category: 'computing', soc: '15-2041',
    re: /\b(?:statistician|actuary|actuarial|mathematician|quantitative\s+(?:analyst|researcher|developer)|quant)\b/i },
  // Any other manager title before the business subject words: "Credit Operations Manager" manages.
  { category: 'management', soc: '11-1021',
    re: /\b(?:manager|management|director|head\s+of|vice\s+president|VP|chief|general\s+manager|operations\s+lead|chief\s+of\s+staff)\b/i },
  { category: 'business', soc: '13-2051',
    re: /\b(?:analyst|accountant|accounting|auditor|audit|consultant|buyer|purchasing|procurement|sourcer|sourcing|compliance|recruiter|recruiting|talent\s+(?:acquisition|partner)|HRBP|HR\s+(?:generalist|specialist|business\s+partner|coordinator)|human\s+resources|employee\s+relations|business\s+partner|people\s+(?:partner|operations)|payroll|tax|underwriter|treasury|FP&A|controller|bookkeeper|credit|loan\s+officer|claims|logistics|supply\s+chain|planner|strategist)\b/i },
  { category: 'business', soc: '13-1199', re: /\b(?:coordinator|specialist|associate)\b/i },
];
// What may still place a title csScope refused as IT support ("Product Marketing Manager, IT Admin and Governance").
const OVERRIDES_IT_SUPPORT = new Set(['legal', 'sales', 'marketing', 'management']);

// A family that names a category on its own — used ONLY to report a family-only verdict as low confidence.
const FAMILY_CATEGORY = {
  engineering: 'computing', engineering_embedded_firmware: 'computing', data: 'computing',
  pm: 'management', operations: 'business', finance: 'business', hr: 'business',
  design: 'arts_media', marketing: 'marketing', legal: 'legal', sales: 'sales',
};

const matches = (rule, t) => (rule.test ? rule.test(t) : rule.re.test(t));
const held = (reason, confidence = 0) => ({ inScope: false, category: null, soc: null, discipline: null, confidence, reason });
const placed = (category, soc, reason, { discipline = null, confidence = TITLE_CONFIDENCE } = {}) =>
  confidence >= CATEGORY_CONFIDENCE_FLOOR
    ? { inScope: true, category, soc, discipline, confidence, reason }
    : held('held:low_confidence', confidence);

/**
 * @param {{ title?: string|null, roleKey?: string|null }} job
 * @returns {{ inScope: boolean, category: string|null, soc: string|null, discipline: string|null, confidence: number, reason: string }}
 */
export function categoryOf({ title, roleKey } = {}) {
  const t = String(title || '').trim();
  const family = roleKey == null || roleKey === '' ? null : String(roleKey);
  if (!t) return held('held:no_title');

  for (const rule of HELD) if (matches(rule, t)) return held(rule.reason);

  // Computing (15) is today's board, decided by D78's own rule.
  const cs = csScopeOf({ title: t, roleKey: family });
  if (cs.inScope) return placed('computing', '15-1252', `computing:${cs.reason}`, { confidence: cs.reason.startsWith('family:') ? 0.85 : TITLE_CONFIDENCE });
  const titleRule = TITLE_RULES.find(rule => rule.re.test(t)) || null;
  if (CS_OUT_HELD.has(cs.reason)) {
    if (cs.reason === 'out:it_support' && titleRule && OVERRIDES_IT_SUPPORT.has(titleRule.category)) {
      return placed(titleRule.category, titleRule.soc, `title:${titleRule.category}`);
    }
    return held(CS_OUT_HELD.get(cs.reason));
  }
  // A software title csScope did not list ("Software Quality Assurance Engineer") is still computing.
  if (SOFTWARE_WORD.test(t) && ENGINEER_WORD.test(t) && !/\b(?:silicon|ASIC|RTL|hardware)\b/i.test(t)) {
    return placed('computing', '15-1252', 'computing:software_title');
  }

  // Engineering (17): an engineer title with a discipline word, a building architect, a project engineer.
  if (ARCHITECT_BUILDING.test(t)) return placed('engineering', '17-1011', 'engineering:architect', { discipline: 'architecture' });
  if (ENGINEER_WORD.test(t) || HARDWARE_ARCHITECT.test(t)) {
    for (const [discipline, re] of DISCIPLINES) {
      if (re.test(t)) return placed('engineering', '17-2000', `engineering:${discipline}`, { discipline });
    }
    if (PROJECT_ENGINEER.test(t)) return placed('engineering', '17-2051', 'engineering:project', { discipline: 'civil' });
  }

  if (titleRule) return placed(titleRule.category, titleRule.soc, `title:${titleRule.category}`);

  const fam = family && FAMILY_CATEGORY[family];
  if (fam) return held('held:low_confidence', FAMILY_ONLY_CONFIDENCE);
  return held('held:unknown');
}

/** The category a JOB PROFILE belongs to: its target titles first, then its name — the same rule as a posting. */
export function profileCategory({ role_family = null, target_titles = [], profile_name = '' } = {}) {
  const titles = Array.isArray(target_titles) ? target_titles : (() => { try { return JSON.parse(target_titles || '[]'); } catch { return []; } })();
  for (const title of [...titles, profile_name]) {
    const v = categoryOf({ title, roleKey: role_family });
    if (v.inScope) return v.category;
  }
  return role_family ? (FAMILY_CATEGORY[role_family] || null) : null;
}

/** Counts for Admin and the crawl report. rows: [{ title, roleKey }]. */
export function categoryReport(rows = []) {
  const report = { version: CATEGORY_SCOPE_VERSION, total: 0, shown: 0, held: 0, byCategory: {}, byDiscipline: {}, heldByReason: {} };
  for (const row of rows) {
    const v = categoryOf(row);
    report.total++;
    if (v.inScope) {
      report.shown++;
      report.byCategory[v.category] = (report.byCategory[v.category] || 0) + 1;
      if (v.discipline) report.byDiscipline[v.discipline] = (report.byDiscipline[v.discipline] || 0) + 1;
    } else {
      report.held++;
      report.heldByReason[v.reason] = (report.heldByReason[v.reason] || 0) + 1;
    }
  }
  return report;
}
