// services/kb/sponsorshipFacts.js — ⭐ D108 · SPONSORSHIP FACTS PER COMPANY, AND A DATED "WHAT CHANGED" (owner 10-30).
//
// P1 · a fact per company from PUBLIC data, with its source and its date — never advice, never a guess:
//   "Filed 290 certified LCAs in FY2025" · source: U.S. Department of Labor, OFLC LCA disclosure data · through FY2026 Q1
// ⛔ ONE LCA MATCHER: the number is company_lca_sponsorship's, written by the board's existing identity resolution
// (services/kb/lcaLayer.js reconcileCompanyLca + lcaMatch + the owner's lca_company_resolutions). Nothing here matches
// a name. A company the layer could not resolve safely (`presentable` false) gets NO line — not a zero.
// The year said is the latest COMPLETE fiscal year the corpus covers (a partial year's count would read as a drop).
// ⭐ The line gains, each only when present and each with ITS OWN source and date (`parts`):
//   "· median $162k"   the annualised median offered wage on that fiscal year's certified LCAs (services/kb/lcaWages.js),
//                      said only over ≥ WAGE_MIN_CASES cases — same source and date as the filing count
//   "· 1,204 H-1B approvals FY2022 (USCIS)"   the USCIS H-1B Employer Data Hub, joined through the SAME LCA match
//                      (lcaLayer.js aggregateHubForEntities); the year is the latest one a hub file covers COMPLETELY
//                      (its file date after that fiscal year's 30 September), dated by that file
// ⛔ E-VERIFY IS NOT BUILT (EVERIFY below): e-verify.gov publishes only a search tool, no downloadable list, and the
// search page is not scraped. Nothing is said about E-Verify.
//
// P2 · "What changed": a short, dated list of rule changes that affect students and workers. ⛔ Each line is a FACT with
// an OFFICIAL source link (a .gov host or a federal court's docket) — addWhatChanged refuses anything else. No advice,
// no opinion, and the list always carries NOT_LEGAL_ADVICE.

import { getCompanyLca, getUscisHubCoverage } from "./lcaLayer.js";
import { formatWageK } from "./lcaWages.js";
import { HUB_SOURCE_NAME, HUB_PAGE_URL } from "./uscisHub.js";

export const LCA_SOURCE_NAME = "U.S. Department of Labor, OFLC LCA disclosure data";
// A median over one or two cases is one person's wage, not a pattern.
export const WAGE_MIN_CASES = 3;
/** ⛔ E-Verify participation: verified 2026-10-30 that no bulk source exists — so it is not built and never said. */
export const EVERIFY = Object.freeze({
  built: false,
  checked: "2026-10-30",
  source: "https://www.e-verify.gov/about-e-verify/e-verify-data/participating-employers",
  reason: "E-Verify publishes a search tool only (updated daily), no downloadable participating-employer list; the search page is not scraped.",
});
export const NOT_LEGAL_ADVICE = "Not legal advice — confirm with your DSO or an immigration attorney.";

const fyOf = (period) => { const m = /^FY(\d{4})Q([1-4])$/.exec(String(period || "")); return m ? { year: Number(m[1]), q: Number(m[2]) } : null; };

/** The latest fiscal year whose four quarters the corpus covers, given its newest period ("FY2026Q1" → 2025). */
export function latestCompleteYear(latestCorpusPeriod) {
  const p = fyOf(latestCorpusPeriod);
  if (!p) return null;
  return p.q === 4 ? p.year : p.year - 1;
}

/**
 * The latest fiscal year a hub file covers completely: its file date falls after that year's 30 September. A file dated
 * mid-year (the archive's FY2023, dated 2023-05-31) is a partial year, and its count would read as a drop.
 * @returns {{ fiscalYear, fileDate, sourceUrl } | null}
 */
export function latestCompleteHubYear(coverage) {
  let best = null;
  for (const f of coverage || []) {
    for (const fy of f.fiscalYears || []) {
      if (!f.fileDate || f.fileDate <= `${fy}-09-30`) continue;
      if (!best || fy > best.fiscalYear || (fy === best.fiscalYear && f.fileDate > best.fileDate)) best = { fiscalYear: fy, fileDate: f.fileDate, sourceUrl: f.sourceUrl };
    }
  }
  return best;
}

/**
 * One company's sponsorship fact, or null.
 * @returns {{ text, filings, fiscalYear, source: { name, url, through }, parts: [{ kind, text, source }], wage?, uscis? } | null}
 */
export function sponsorshipFactFor(db, company) {
  if (!company) return null;
  const lca = getCompanyLca(db, company);
  if (!lca?.presentable) return null;
  const year = latestCompleteYear(lca.latestCorpusPeriod);
  if (!year) return null;
  const filings = Number(lca.byFiscalYear?.[String(year)] ?? 0);
  let url = null;
  try {
    url = db.prepare(`SELECT source_url FROM lca_source_files WHERE fiscal_period = ? ORDER BY file_name DESC LIMIT 1`).pluck().get(lca.latestCorpusPeriod) || null;
  } catch { url = null; }
  const p = fyOf(lca.latestCorpusPeriod);
  const through = `FY${p.year} Q${p.q}`;
  const source = { name: LCA_SOURCE_NAME, url, through };
  const lead = filings > 0 ? `Filed ${filings.toLocaleString("en-US")} certified LCA${filings === 1 ? "" : "s"} in FY${year}` : `No certified LCAs found in FY${year}`;
  const parts = [{ kind: "lca", text: lead, source }];
  const out = { filings, fiscalYear: year, source };
  // The median wage — the same fiscal year and the same files as the count.
  const w = lca.wageByFiscalYear?.[String(year)];
  if (filings > 0 && w && Number(w.cases) >= WAGE_MIN_CASES && Number.isFinite(w.median)) {
    out.wage = { medianUsd: w.median, cases: w.cases, fiscalYear: year };
    parts.push({ kind: "wage", text: `median ${formatWageK(w.median)}`, source });
  }
  // USCIS approvals — the latest year a hub file covers completely, dated by that file.
  const hubYear = latestCompleteHubYear(getUscisHubCoverage(db));
  const h = hubYear ? lca.uscisByFiscalYear?.[String(hubYear.fiscalYear)] : null;
  if (h && Number(h.approvals) > 0) {
    out.uscis = { approvals: h.approvals, denials: h.denials ?? 0, fiscalYear: hubYear.fiscalYear };
    parts.push({ kind: "uscis", text: `${Number(h.approvals).toLocaleString("en-US")} H-1B approval${h.approvals === 1 ? "" : "s"} FY${hubYear.fiscalYear} (USCIS)`,
      source: { name: HUB_SOURCE_NAME, url: hubYear.sourceUrl || HUB_PAGE_URL, asOf: hubYear.fileDate } });
  }
  return { text: parts.map(x => x.text).join(" · "), ...out, parts };
}

/** A board page's rows → Map(company → fact), one read per company. */
export function sponsorshipFactsForRows(db, rows) {
  const out = new Map();
  for (const r of rows) {
    const c = r?.company;
    if (!c || out.has(c)) continue;
    let f = null;
    try { f = sponsorshipFactFor(db, c); } catch { f = null; }
    out.set(c, f);
  }
  return out;
}

// ── P2 · WHAT CHANGED ─────────────────────────────────────────────────────────────────────────

/** Official sources only: a U.S. government host, or a federal court's records. */
export function isOfficialSource(url) {
  let u; try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return /(^|\.)[a-z0-9-]+\.gov$/.test(h) || h === "www.courtlistener.com" || h === "courtlistener.com";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** @returns {{ ok: true, id } | { ok: false, error, message }} */
export function addWhatChanged(db, { happenedOn, text, sourceUrl, sourceName, addedBy = "owner" } = {}) {
  const fail = (error, message) => ({ ok: false, error, message });
  if (!DATE.test(String(happenedOn || "")) || Number.isNaN(Date.parse(happenedOn))) return fail("bad_date", "The date is YYYY-MM-DD.");
  const t = String(text ?? "").trim();
  if (t.length < 10 || t.length > 400) return fail("bad_text", "One factual sentence, 10 to 400 characters.");
  if (!isOfficialSource(sourceUrl)) return fail("not_official", "The source must be an official link — a .gov page or a federal court docket.");
  const name = String(sourceName ?? "").trim().slice(0, 80) || new URL(sourceUrl).hostname;
  const id = Number(db.prepare(`INSERT INTO what_changed (happened_on, text, source_url, source_name, added_by) VALUES (?,?,?,?,?)`)
    .run(happenedOn, t, String(sourceUrl), name, String(addedBy)).lastInsertRowid);
  return { ok: true, id };
}

export function listWhatChanged(db, { limit = 30 } = {}) {
  let items = [];
  try {
    items = db.prepare(`SELECT id, happened_on AS happenedOn, text, source_url AS sourceUrl, source_name AS sourceName
      FROM what_changed WHERE removed_at IS NULL ORDER BY happened_on DESC, id DESC LIMIT ?`).all(limit);
  } catch { items = []; }
  return { items, notice: NOT_LEGAL_ADVICE };
}

export function removeWhatChanged(db, id) {
  return db.prepare(`UPDATE what_changed SET removed_at = unixepoch() WHERE id = ? AND removed_at IS NULL`).run(Number(id)).changes > 0;
}
