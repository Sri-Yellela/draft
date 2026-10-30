// services/kb/sponsorshipFacts.js — ⭐ D108 · SPONSORSHIP FACTS PER COMPANY, AND A DATED "WHAT CHANGED" (owner 10-30).
//
// P1 · a fact per company from PUBLIC data, with its source and its date — never advice, never a guess:
//   "Filed 290 certified LCAs in FY2025" · source: U.S. Department of Labor, OFLC LCA disclosure data · through FY2026 Q1
// ⛔ ONE LCA MATCHER: the number is company_lca_sponsorship's, written by the board's existing identity resolution
// (services/kb/lcaLayer.js reconcileCompanyLca + lcaMatch + the owner's lca_company_resolutions). Nothing here matches
// a name. A company the layer could not resolve safely (`presentable` false) gets NO line — not a zero.
// The year said is the latest COMPLETE fiscal year the corpus covers (a partial year's count would read as a drop).
// ⚠ Not yet: the median wage (the ingest keeps no wages), the USCIS H-1B Employer Data Hub, E-Verify participation —
// public files still to be imported; until then nothing is said about them.
//
// P2 · "What changed": a short, dated list of rule changes that affect students and workers. ⛔ Each line is a FACT with
// an OFFICIAL source link (a .gov host or a federal court's docket) — addWhatChanged refuses anything else. No advice,
// no opinion, and the list always carries NOT_LEGAL_ADVICE.

import { getCompanyLca } from "./lcaLayer.js";

export const LCA_SOURCE_NAME = "U.S. Department of Labor, OFLC LCA disclosure data";
export const NOT_LEGAL_ADVICE = "Not legal advice — confirm with your DSO or an immigration attorney.";

const fyOf = (period) => { const m = /^FY(\d{4})Q([1-4])$/.exec(String(period || "")); return m ? { year: Number(m[1]), q: Number(m[2]) } : null; };

/** The latest fiscal year whose four quarters the corpus covers, given its newest period ("FY2026Q1" → 2025). */
export function latestCompleteYear(latestCorpusPeriod) {
  const p = fyOf(latestCorpusPeriod);
  if (!p) return null;
  return p.q === 4 ? p.year : p.year - 1;
}

/**
 * One company's sponsorship fact, or null.
 * @returns {{ text, filings, fiscalYear, source: { name, url, through } } | null}
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
  return {
    text: filings > 0 ? `Filed ${filings.toLocaleString("en-US")} certified LCA${filings === 1 ? "" : "s"} in FY${year}` : `No certified LCAs found in FY${year}`,
    filings, fiscalYear: year,
    source: { name: LCA_SOURCE_NAME, url, through },
  };
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
