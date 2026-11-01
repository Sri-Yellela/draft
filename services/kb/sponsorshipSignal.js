// services/kb/sponsorshipSignal.js — ⭐ D121 · H-1B SPONSORSHIP SIGNALS, EVERYWHERE A DECISION IS MADE (owner 10-31).
//
// ONE MODULE: sponsorshipSignal(db, company, { title?, posting? }) → { level, label, line, facts[], sources[],
// confidence, fiscalYear, notice }. Every surface (the board card's chip, the job page's block, D106's line, the board
// filter, picks, Draft House's "why this pick", Atlas role pages, the Profile) reads THIS — nothing re-derives a level.
//
//   company level  from the ONE LCA matcher's output (lcaLayer.js company_lca_sponsorship, via sponsorshipFactFor):
//                  often      ≥ SIGNAL.OFTEN_MIN certified LCAs in the latest COMPLETE fiscal year
//                  sometimes  1 … OFTEN_MIN − 1 that year (or none that year but some the year before)
//                  no_record  0 in the last SIGNAL.NO_RECORD_YEARS fiscal years, under a name matched safely
//                  unknown    no confident employer match — ⛔ shown as UNKNOWN, never as "no"
//   says_no        ⛔ the posting's own words override the company (D104's reader, shared/postingRequirements.js):
//                  "no sponsorship", "must be authorised to work without sponsorship" … → "This posting says it won't sponsor"
//   title level    lca_employer_titles (migration 203, written by scripts/ingestLca.mjs): the certified cases of the
//                  posting's TITLE FAMILY (shared/lcaTitleKey.js) at the same matched employer, that fiscal year —
//                  "37 certified LCAs for Software Engineer titles in FY2025 · median $162k · mostly Level II"
//   USCIS          a labelled extra with its own year ("FY2023: 410 approved, 12 denied (USCIS)")
//   E-Verify       ⛔ only when KNOWN — the posting says it; never guessed (no bulk source: sponsorshipFacts.EVERIFY)
// ⛔ WORDING: "filed" / "certified", never "will sponsor you" — an LCA shows the company sponsored someone, not that it
// will sponsor this role. Every fact carries its fiscal year; every block ends with NOT_LEGAL_ADVICE.
// No model (D17); public data only; nothing about the user is read here.

import { getCompanyLca } from "./lcaLayer.js";
import { sponsorshipFactFor, latestCompleteYear, WAGE_MIN_CASES, LCA_SOURCE_NAME } from "./sponsorshipFacts.js";
import { mergeHistogram, histogramMedian, formatWageK } from "./lcaWages.js";
import { lcaTitleKey } from "../../shared/lcaTitleKey.js";
import { postingRequirements } from "../../shared/postingRequirements.js";
import { normalizePosting } from "../../shared/postingNormalize.js";

/** Every threshold of the signal — here and nowhere else. */
export const SIGNAL = Object.freeze({
  /** certified LCAs in the latest complete FY for "Sponsors often" */
  OFTEN_MIN: 10,
  /** "No record" needs zero filings in this many fiscal years, back from the latest complete one */
  NO_RECORD_YEARS: 2,
  /** a title family's line needs at least this many certified cases */
  TITLE_MIN_CASES: 1,
  /** "mostly Level II" when one level holds more than this share of the family's cases that state a level */
  MOSTLY_SHARE: 0.5,
});
export const LEVELS = Object.freeze(["says_no", "often", "sometimes", "no_record", "unknown"]);
export const LABELS = Object.freeze({
  often: "Sponsors often", sometimes: "Sponsors sometimes", no_record: "No sponsorship record",
  unknown: "Sponsorship unknown", says_no: "Says no sponsorship",
});
export const NOT_LEGAL_ADVICE = "Not legal advice — confirm with the employer, your DSO or an immigration attorney.";
const EVERIFY_WORDS = /\bE-?Verify\b/i;

const titleCase = (s) => s.replace(/\b[a-z]/g, c => c.toUpperCase());

/** The posting's own words: { saysNo, everify } read from its text (D104's reader — the one rule). */
export function postingSponsorshipWords(posting) {
  const text = posting?.description_full ?? posting?.description ?? posting?.text ?? "";
  if (!String(text).trim()) return { saysNo: false, everify: false };
  let saysNo = false;
  try { saysNo = postingRequirements(normalizePosting(text)).sponsorship === "no_sponsorship"; } catch { saysNo = false; }
  return { saysNo, everify: EVERIFY_WORDS.test(String(text)) };
}

/** The title family's certified cases at the matched employer in one fiscal year, or null. */
export function titleFacts(db, lca, title, fiscalYear) {
  const key = lcaTitleKey(title);
  if (!key || !fiscalYear || !(lca?.matchedEntities || []).length) return null;
  // The stored match names its entities (name · FEIN, de-duplicated for the screen); their keys on disk are read back
  // from lca_employer_periods by name — every FEIN under that name, as the company's totals were summed.
  const names = [...new Set(lca.matchedEntities.map(e => e.name ?? e.employerName).filter(Boolean))];
  let pairs = [];
  try {
    pairs = names.length ? db.prepare(`SELECT DISTINCT employer_key AS key, fein FROM lca_employer_periods WHERE employer_name IN (${names.map(() => "?").join(",")})`).all(...names) : [];
  } catch { pairs = []; }
  if (!pairs.length) return null;
  let rows = [];
  try {
    rows = db.prepare(`SELECT certified, wage_hist_json, level_json FROM lca_employer_titles
      WHERE title_key = ? AND fiscal_period LIKE ? AND (${pairs.map(() => "(employer_key = ? AND fein = ?)").join(" OR ")})`)
      .all(key, `FY${fiscalYear}Q%`, ...pairs.flatMap(p => [p.key, p.fein]));
  } catch { return null; }   // a database before migration 203
  let certified = 0;
  const hist = new Map(), levels = {};
  for (const r of rows) {
    certified += Number(r.certified) || 0;
    mergeHistogram(hist, r.wage_hist_json);
    let l = {}; try { l = JSON.parse(r.level_json || "{}") || {}; } catch { l = {}; }
    for (const [k, n] of Object.entries(l)) levels[k] = (levels[k] || 0) + (Number(n) || 0);
  }
  if (certified < SIGNAL.TITLE_MIN_CASES) return null;
  const med = histogramMedian(hist);
  const stated = Object.values(levels).reduce((a, b) => a + b, 0);
  const [topLevel, topN] = Object.entries(levels).sort((a, b) => b[1] - a[1])[0] || [];
  const mostly = topLevel && stated && topN / stated > SIGNAL.MOSTLY_SHARE ? topLevel : null;
  const name = titleCase(key);
  const parts = [`${certified.toLocaleString("en-US")} certified LCA${certified === 1 ? "" : "s"} for ${name} titles in FY${fiscalYear}`];
  if (med && med.cases >= WAGE_MIN_CASES) parts.push(`median ${formatWageK(med.median)}`);
  if (mostly) parts.push(`mostly Level ${mostly}`);
  return { titleFamily: name, certified, fiscalYear, medianUsd: med && med.cases >= WAGE_MIN_CASES ? med.median : null,
    wageCases: med?.cases ?? 0, levels, mostlyLevel: mostly, text: parts.join(" · ") };
}

/**
 * ⭐ D121 · the ONE signal.
 * @param company  the posting's company string (as the board stores it)
 * @param opts     { title — the posting's title (the title level) · posting — a scraped_jobs row or { description } }
 */
export function sponsorshipSignal(db, company, { title = null, posting = null } = {}) {
  const words = postingSponsorshipWords(posting);
  const facts = [];
  const sources = [];
  const addSource = (s) => { if (s && !sources.some(x => x.name === s.name && x.url === s.url)) sources.push(s); };
  let lca = null;
  try { lca = company ? getCompanyLca(db, company) : null; } catch { lca = null; }
  let fact = null;
  try { fact = lca?.presentable ? sponsorshipFactFor(db, company) : null; } catch { fact = null; }

  let level = "unknown", fiscalYear = null;
  if (fact) {
    fiscalYear = fact.fiscalYear;
    const earlier = [];
    for (let y = fiscalYear - 1; y > fiscalYear - SIGNAL.NO_RECORD_YEARS; y--) earlier.push(Number(lca.byFiscalYear?.[String(y)] ?? 0));
    // "No record" pushes a posting down, so it takes the higher confidence (signalSql's noRecord floor); below it, unknown.
    const sure = Number(lca.matchConfidence) >= SIGNAL_MIN_CONFIDENCE.noRecord;
    level = fact.filings >= SIGNAL.OFTEN_MIN ? "often" : fact.filings > 0 ? "sometimes" : earlier.some(n => n > 0) ? "sometimes" : sure ? "no_record" : "unknown";
    // The filing count and its median wage are one fact (same files, same year); USCIS is its own, with its own year.
    const same = fact.parts.filter(p => p.kind !== "uscis");
    facts.push({ kind: "lca", text: same.map(p => p.text).join(" · "), fiscalYear, source: fact.source });
    for (const p of fact.parts.filter(p => p.kind === "uscis")) facts.push({ kind: "uscis", text: p.text, fiscalYear: fact.uscis?.fiscalYear, source: p.source });
    for (const p of fact.parts) addSource(p.source);
    if (fact.filings === 0 && level === "sometimes") {
      const y = fiscalYear - 1, n = Number(lca.byFiscalYear?.[String(y)] ?? 0);
      facts.push({ kind: "lca_prior", text: `${n.toLocaleString("en-US")} certified LCA${n === 1 ? "" : "s"} in FY${y}`, fiscalYear: y, source: fact.source });
    }
    const t = title ? titleFacts(db, lca, title, fiscalYear) : null;
    if (t) facts.push({ kind: "title", text: t.text, fiscalYear, source: fact.source, title: t });
  }
  if (words.everify) facts.push({ kind: "everify", text: "The posting says the employer uses E-Verify", fiscalYear: null, source: { name: "the posting" } });
  const companyLevel = level;
  if (words.saysNo) level = "says_no";

  const lead = level === "says_no" ? "This posting says it won't sponsor"
    : level === "unknown" ? "No confident match to a public LCA record — unknown, not a no"
    : facts.find(f => f.kind === "lca")?.text;
  const line = [LABELS[level], level === "says_no" || level === "unknown" ? lead : null, ...facts.filter(f => f.kind === "lca" || f.kind === "lca_prior" || f.kind === "title").map(f => f.text)]
    .filter(Boolean).join(" · ");
  if (!sources.length && fact?.source) addSource(fact.source);
  return {
    level, label: LABELS[level], companyLevel, line, facts, sources,
    confidence: lca?.presentable ? Number(lca.matchConfidence) || 0 : 0,
    fiscalYear, notice: NOT_LEGAL_ADVICE,
    sourceName: fact ? LCA_SOURCE_NAME : null,
  };
}

/** A page of board rows → Map(job_id → signal), one company read per company (the title level per row). */
export function sponsorshipSignalsForRows(db, rows) {
  const out = new Map();
  for (const r of rows || []) {
    if (!r) continue;
    let s = null;
    try { s = sponsorshipSignal(db, r.company, { title: r.title, posting: r }); } catch { s = null; }
    out.set(r.job_id ?? r.jobId ?? r.id, s);
  }
  return out;
}

// ── D121 P3 · the board filter reads THIS rule, as SQL ─────────────────────────────────────────────
// The company half of the signal, said in SQL so the board's WHERE / ORDER BY (services/jobs/jobQuery.js) and this
// module cannot disagree: the latest COMPLETE fiscal year from the ingest ledger (FY2026Q1 → 2025; a Q4 period → its own
// year), the company's certified count that year and the year before from by_fiscal_year_json. The confidence floors
// are lcaMatch.js's (presentable 0.60 to say "filed"; 0.80 to say "no record" — pushing a row down costs the user a job).
// ⚠ The posting's own words are not SQL: a "says no" row is demoted within the page by the board route.
const LATEST_FY_SQL = `(SELECT CAST(substr(MAX(fiscal_period), 3, 4) AS INTEGER) - (CASE substr(MAX(fiscal_period), 8, 1) WHEN '4' THEN 0 ELSE 1 END) FROM lca_source_files)`;
const fySql = (offset) => `COALESCE(json_extract(cl.by_fiscal_year_json, '$."' || (${LATEST_FY_SQL} - ${offset}) || '"'), 0)`;
export const SIGNAL_MIN_CONFIDENCE = Object.freeze({ filed: 0.60, noRecord: 0.80 });
/** @returns {{ filed: string, noRecord: string }} EXISTS(...) fragments over `alias`.company */
export function signalSql(alias = "sj") {
  const years = Array.from({ length: SIGNAL.NO_RECORD_YEARS }, (_, i) => i);
  const base = `FROM company_lca_sponsorship cl WHERE cl.company = ${alias}.company AND cl.match_status = 'matched'`;
  return {
    filed: `EXISTS (SELECT 1 ${base} AND cl.match_confidence >= ${SIGNAL_MIN_CONFIDENCE.filed} AND (${years.map(y => `${fySql(y)} > 0`).join(" OR ")}))`,
    noRecord: `EXISTS (SELECT 1 ${base} AND cl.match_confidence >= ${SIGNAL_MIN_CONFIDENCE.noRecord} AND ${years.map(y => `${fySql(y)} = 0`).join(" AND ")})`,
  };
}

/** D121 P3 · picks: sponsors first for a user who needs sponsorship (a sort key; lower is earlier). */
export const PICK_RANK = Object.freeze({ often: 0, sometimes: 1, unknown: 2, no_record: 3, says_no: 4 });

export { latestCompleteYear };
