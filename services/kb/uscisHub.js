// services/kb/uscisHub.js — ⭐ D108 P1 · the USCIS H-1B Employer Data Hub, imported (owner 10-30).
//
// THE SOURCE, verified 2026-10-30:
//   https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub — FY2009 through FY2026 Q4; downloadable "in
//   Excel or .csv format" from the hub's Crosstab View ("Download to Excel", a person's own export).
//   https://www.uscis.gov/archive/h-1b-employer-data-hub-files — ONE CSV PER FISCAL YEAR, FY2009–FY2023, at
//   https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-<FY>.csv (FY2024+ are not there — 404).
//   ⚠ The FY2023 file is dated 2023-05-31 (its Last-Modified), i.e. a PARTIAL fiscal year; see completeness below.
//
// WHAT A ROW IS ("Understanding Our H-1B Employer Data Hub", updated 2025-07-07): USCIS's FIRST decision on a petition
// (appeals and revocations excluded), counted in WORKERS, grouped by fiscal year (the year USCIS first recorded the
// decision), two-digit NAICS, the LAST FOUR digits of the petitioner's tax ID, and the mailing address's state, city
// and ZIP — so one employer can be several rows a year. The name is the petitioner's most common spelling per tax ID.
//
// TWO LAYOUTS, both read by header name, never by position:
//   archive  "Fiscal Year",Employer,"Initial Approval","Initial Denial","Continuing Approval","Continuing Denial",
//            NAICS,"Tax ID",State,City,ZIP
//   current  Fiscal Year, Employer Name, NAICS, Tax ID, State, City, ZIP, then an Approval and a Denial column for each
//            of New Employment, Continuation, Change with Same Employer, New Concurrent, Change of Employer, Amended
// Every "… Approval" column sums into `approvals` and every "… Denial" into `denials`; the file's own categories are kept
// as categories_json. initial_* / continuing_* are filled only where the file SAYS "Initial" / "Continuing" (or
// "Continuation") — the current layout's six categories are not re-mapped onto the old two, because USCIS does not
// publish that mapping and guessing it would be a number nobody stated.
// A Tableau crosstab export is often UTF-16 and tab-separated; both are detected from the bytes / the header.
//
// ⛔ ONE LCA MATCHER: rows are stored under the SAME companyMatchKey the LCA ingest uses; which company a key belongs
// to is decided only by the LCA resolution (lcaLayer.js aggregateHubForEntities joins on the matched entities).
//
// Streaming: a file is read line by line (readline), never whole; only the per-(key, tax ID, FY) sums are held.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { companyMatchKey } from "./lcaMatch.js";

export const HUB_SOURCE_NAME = "USCIS H-1B Employer Data Hub";
export const HUB_PAGE_URL = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub";
export const HUB_ARCHIVE_URL = (fy) => `https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-${fy}.csv`;

/** One CSV / TSV line → fields (RFC 4180 quotes; a line is one record — the hub has no embedded newlines). */
export function splitDelimited(line, delim = ",") {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const norm = (h) => String(h ?? "").replace(/^﻿/, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Header fields → where each needed column is, and the approval / denial columns by category. */
export function mapHubHeader(fields) {
  const h = fields.map(norm);
  const find = (re) => h.findIndex(x => re.test(x));
  const idx = {
    fy: find(/^fiscal year$/),
    employer: find(/^employer( petitioner)?( name)?$/),
    taxId: find(/^(petitioner )?tax id$/),
    state: find(/^(petitioner )?state$/),
  };
  if (idx.fy < 0 || idx.employer < 0) return null;
  const approvals = [], denials = [];
  h.forEach((x, i) => {
    const m = /^(.*?)\s*(approval|denial)s?$/.exec(x);
    if (!m || !m[1]) return;
    (m[2] === "approval" ? approvals : denials).push({ i, category: m[1] });
  });
  if (!approvals.length && !denials.length) return null;
  const layout = h.includes("initial approval") ? "archive" : "current";
  return { ...idx, approvals, denials, layout };
}

const num = (v) => { const n = Number(String(v ?? "").replace(/[,\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
const tax4 = (v) => { const d = String(v ?? "").replace(/\D/g, ""); return d ? d.slice(-4).padStart(4, "0") : ""; };

/** Sniffs a file's encoding from its first bytes: a UTF-16 LE BOM (Tableau's crosstab) or UTF-8. */
function encodingOf(file) {
  const fd = fs.openSync(file, "r");
  try {
    const b = Buffer.alloc(2);
    fs.readSync(fd, b, 0, 2, 0);
    return b[0] === 0xff && b[1] === 0xfe ? "utf16le" : "utf8";
  } finally { fs.closeSync(fd); }
}

/**
 * Streams one hub file into per-(employer key, tax-ID last four, fiscal year) sums.
 * @returns {{ layout, rows: number, unnamed: number, employers: object[], fiscalYears: number[] }}
 */
export async function parseHubFile(file) {
  const input = fs.createReadStream(file, { encoding: encodingOf(file) });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let header = null, delim = ",";
  let rows = 0, unnamed = 0;
  const agg = new Map();
  const years = new Set();
  for await (const raw of rl) {
    const line = raw.replace(/^﻿/, "");
    if (!line.trim()) continue;
    if (!header) {
      delim = line.includes("\t") && !line.includes(",") ? "\t" : ",";
      header = mapHubHeader(splitDelimited(line, delim));
      if (!header) throw new Error(`${path.basename(file)}: not an H-1B Employer Data Hub export (no Fiscal Year / Employer / Approval columns)`);
      continue;
    }
    const f = splitDelimited(line, delim);
    const fy = Number(f[header.fy]);
    if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) continue; // a totals or footer line
    rows++;
    const name = f[header.employer];
    const key = name ? companyMatchKey(name) : "";
    if (!key) { unnamed++; continue; } // the hub warns names can be missing — such a row cannot reach any company
    const tid = header.taxId >= 0 ? tax4(f[header.taxId]) : "";
    const id = `${key}|${tid}|${fy}`;
    let e = agg.get(id);
    if (!e) {
      e = { employer_key: key, tax_id4: tid, fiscal_year: fy, employer_name: name, state: header.state >= 0 ? f[header.state] || null : null,
        approvals: 0, denials: 0, initial_approvals: null, initial_denials: null, continuing_approvals: null, continuing_denials: null,
        categories: {} };
      agg.set(id, e);
    }
    years.add(fy);
    for (const [list, field] of [[header.approvals, "approvals"], [header.denials, "denials"]]) {
      for (const { i, category } of list) {
        const n = num(f[i]);
        e[field] += n;
        const c = (e.categories[category] ||= { approvals: 0, denials: 0 });
        c[field] += n;
        if (category === "initial") e[`initial_${field}`] = (e[`initial_${field}`] ?? 0) + n;
        if (category === "continuing" || category === "continuation") e[`continuing_${field}`] = (e[`continuing_${field}`] ?? 0) + n;
      }
    }
  }
  if (!header) throw new Error(`${path.basename(file)}: empty file`);
  return { layout: header.layout, rows, unnamed, employers: [...agg.values()], fiscalYears: [...years].sort() };
}

/**
 * Writes one parsed file: each fiscal year it holds is REPLACED (delete then insert, one transaction), so re-importing a
 * newer export of the same year converges instead of doubling. One file per fiscal year is the expected shape.
 */
export function writeHubFile(db, { fileName, sourceUrl = null, fileDate = null, byteSize = null, parsed, now = Math.floor(Date.now() / 1000) }) {
  const delYear = db.prepare(`DELETE FROM uscis_hub_employer_years WHERE fiscal_year = ?`);
  const ins = db.prepare(`INSERT INTO uscis_hub_employer_years (employer_key, tax_id4, fiscal_year, employer_name, state, approvals, denials,
      initial_approvals, initial_denials, continuing_approvals, continuing_denials, categories_json, file_name)
    VALUES (@employer_key, @tax_id4, @fiscal_year, @employer_name, @state, @approvals, @denials,
      @initial_approvals, @initial_denials, @continuing_approvals, @continuing_denials, @categories_json, @file_name)`);
  const ledger = db.prepare(`INSERT INTO uscis_hub_source_files (file_name, fiscal_years, source_url, file_date, layout, data_rows, employer_rows, byte_size, ingested_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(file_name) DO UPDATE SET fiscal_years = excluded.fiscal_years, source_url = excluded.source_url, file_date = excluded.file_date,
      layout = excluded.layout, data_rows = excluded.data_rows, employer_rows = excluded.employer_rows, byte_size = excluded.byte_size,
      ingested_at = excluded.ingested_at`);
  const kept = parsed.employers.filter(e => e.approvals || e.denials);
  db.transaction(() => {
    for (const fy of parsed.fiscalYears) delYear.run(fy);
    // Another file's ledger row that claimed only these years is now stale — its rows were just replaced.
    for (const r of db.prepare(`SELECT file_name, fiscal_years FROM uscis_hub_source_files WHERE file_name != ?`).all(fileName)) {
      let ys = []; try { ys = JSON.parse(r.fiscal_years); } catch { ys = []; }
      if (ys.length && ys.every(y => parsed.fiscalYears.includes(y))) db.prepare(`DELETE FROM uscis_hub_source_files WHERE file_name = ?`).run(r.file_name);
    }
    for (const e of kept) {
      ins.run({ ...e, categories_json: JSON.stringify(e.categories), file_name: fileName });
    }
    ledger.run(fileName, JSON.stringify(parsed.fiscalYears), sourceUrl, fileDate, parsed.layout, parsed.rows, kept.length, byteSize, now);
  })();
  return { employerRows: kept.length };
}

/** "Wed, 31 May 2023 17:40:18 GMT" → "2023-05-31"; anything unparseable → null. */
export function isoDateOf(httpDate) {
  const t = Date.parse(String(httpDate ?? ""));
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/**
 * Downloads one archive year to `dir` (outside the repository), streaming to disk. `fetcher` is injectable for tests.
 * @returns {{ file, sourceUrl, fileDate, bytes }}
 */
export async function downloadHubYear(fy, dir, { fetcher = globalThis.fetch, maxBytes = 200 * 1048576 } = {}) {
  const sourceUrl = HUB_ARCHIVE_URL(fy);
  const res = await fetcher(sourceUrl, { headers: { "User-Agent": "curl/8.0 (draft uscis-hub-ingest)" } });
  if (!res.ok) throw new Error(`${res.status} for ${sourceUrl}`);
  const len = Number(res.headers.get("content-length")) || 0;
  if (len > maxBytes) throw new Error(`${sourceUrl} is ${(len / 1048576).toFixed(0)} MB — over the ${maxBytes / 1048576} MB limit`);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, path.basename(new URL(sourceUrl).pathname));
  const out = fs.createWriteStream(file);
  let bytes = 0;
  for await (const chunk of res.body) {
    bytes += chunk.length;
    if (bytes > maxBytes) { out.destroy(); fs.rmSync(file, { force: true }); throw new Error(`${sourceUrl} exceeded ${maxBytes} bytes`); }
    if (!out.write(chunk)) await new Promise(r => out.once("drain", r));
  }
  await new Promise((r, j) => out.end(err => (err ? j(err) : r())));
  return { file, sourceUrl, fileDate: isoDateOf(res.headers.get("last-modified")), bytes };
}
