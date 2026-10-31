import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";
import { annualiseWage, addToHistogram, mergeHistogram, histogramMedian, histogramToJson, formatWageK } from "../services/kb/lcaWages.js";
import { parseHubFile, writeHubFile, downloadHubYear, HUB_SOURCE_NAME } from "../services/kb/uscisHub.js";
import { reconcileCompanyLca, getCompanyLca } from "../services/kb/lcaLayer.js";
import { sponsorshipFactFor, latestCompleteHubYear, EVERIFY, LCA_SOURCE_NAME } from "../services/kb/sponsorshipFacts.js";
import { parseQuarter, writeQuarter } from "../scripts/ingestLca.mjs";
import { eligibilityForJob } from "../services/jobEligibility.js";
import { sponsorsForRole } from "../services/atlas/atlasSponsors.js";

// ⭐ D108 (owner 10-30) · the median wage, the USCIS H-1B Employer Data Hub, E-Verify's absence, and P3. Synthetic
// employers only; every file is a tiny fixture written to a temp dir; the network is an injected fetcher.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "d108-"));

function baseDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const q of [1, 2, 3, 4]) {
    db.prepare(`INSERT INTO lca_source_files (file_name, fiscal_period, fiscal_year, fiscal_quarter, ingested_at, source_url) VALUES (?,?,?,?,1,?)`)
      .run(`LCA_FY2025_Q${q}.xlsx`, `FY2025Q${q}`, 2025, q, `https://www.dol.gov/x/LCA_Disclosure_Data_FY2025_Q${q}.xlsx`);
  }
  db.prepare(`INSERT INTO lca_source_files (file_name, fiscal_period, fiscal_year, fiscal_quarter, ingested_at, source_url) VALUES (?,?,?,?,1,?)`)
    .run("LCA_FY2026_Q1.xlsx", "FY2026Q1", 2026, 1, "https://www.dol.gov/x/LCA_Disclosure_Data_FY2026_Q1.xlsx");
  return db;
}
function lcaRow(db, { key, fein = "", period, name, certified, hist = null }) {
  db.prepare(`INSERT INTO lca_employer_periods (employer_key, fein, fiscal_period, employer_name, certified, wage_cases, wage_hist_json)
    VALUES (?,?,?,?,?,?,?)`).run(key, fein, period, name, certified, hist ? Object.values(hist).reduce((a, b) => a + b, 0) : 0, hist ? JSON.stringify(hist) : null);
}

test("D108 · d108EVerifyFlag — E-Verify is NOT built: no bulk list exists (search tool only), and nothing is ever said", () => {
  assert.equal(EVERIFY.built, false);
  assert.match(EVERIFY.reason, /search tool only/);
  assert.match(EVERIFY.reason, /not scraped/);
  assert.equal(EVERIFY.source, "https://www.e-verify.gov/about-e-verify/e-verify-data/participating-employers");
  const src = read("services/kb/sponsorshipFacts.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src.slice(at(src, "export function sponsorshipFactFor")), /E-Verify/i, "the fact line never says E-Verify");
  assert.ok(!fs.existsSync("scripts/ingestEVerify.mjs"), "no E-Verify scraper");
});

test("D108 · wages annualised by the unit — Hour × 2080, Week × 52, Bi-Weekly × 26, Month × 12, Year × 1; slips dropped", () => {
  assert.equal(annualiseWage(50, "Hour"), 104000);
  assert.equal(annualiseWage("2,000", "Week"), 104000);
  assert.equal(annualiseWage(4000, "Bi-Weekly"), 104000);
  assert.equal(annualiseWage("$10,000.00", "Month"), 120000);
  assert.equal(annualiseWage(162000, "Year"), 162000);
  assert.equal(annualiseWage(150000, "Hour"), null, "an annual figure filed as Hour ($312M) is a slip — dropped, not clamped");
  assert.equal(annualiseWage(5, "Year"), null);
  assert.equal(annualiseWage(100000, "Fortnight"), null, "an unknown unit is not guessed");
  assert.equal(annualiseWage("", "Year"), null);
  // A company median is taken over the MERGED histogram (exact to the $1k bucket), never a median of medians.
  const a = new Map(); [100000, 101000, 300000].forEach(v => addToHistogram(a, v));          // median alone: 101k
  const b = new Map(); [160000, 162000, 162400, 170000].forEach(v => addToHistogram(b, v));  // median alone: 162k
  const merged = mergeHistogram(mergeHistogram(new Map(), histogramToJson(a)), histogramToJson(b));
  assert.deepEqual(histogramMedian(merged), { median: 162000, cases: 7 });
  assert.equal(formatWageK(162000), "$162k");
  assert.equal(histogramMedian(new Map()), null);
});

test("D108 · the LCA ingest keeps per-employer wage histograms from a (synthetic) disclosure sheet, certified cases only", async () => {
  const dir = tmp();
  const file = path.join(dir, "LCA_Disclosure_Data_FY2025_Q1.xlsx");
  // The STREAMING writer, which puts workbook.xml before the sheet as the DOL files do (the reader needs that order).
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: file, useSharedStrings: false });
  const ws = wb.addWorksheet("s");
  const add = (r) => ws.addRow(r).commit();
  add(["CASE_NUMBER", "CASE_STATUS", "DECISION_DATE", "JOB_TITLE", "TOTAL_WORKER_POSITIONS", "EMPLOYER_NAME", "TRADE_NAME_DBA",
    "EMPLOYER_STATE", "EMPLOYER_FEIN", "WAGE_RATE_OF_PAY_FROM", "WAGE_RATE_OF_PAY_TO", "WAGE_UNIT_OF_PAY", "PREVAILING_WAGE", "PW_UNIT_OF_PAY"]);
  const d = 45600; // an Excel serial in FY2025 Q1
  add(["I-1", "Certified", d, "Software Engineer", 1, "Zentrix Labs, Inc.", null, "CA", "12-3454321", 75, null, "Hour", 60, "Hour"]);      // 156k
  add(["I-2", "Certified", d, "Software Engineer", 1, "Zentrix Labs, Inc.", null, "CA", "12-3454321", 162000, 180000, "Year", 1, "Year"]); // 162k
  add(["I-3", "Certified - Withdrawn", d, "Data Engineer", 1, "Zentrix Labs, Inc.", null, "CA", "12-3454321", 3200, null, "Week", 1, "Year"]); // 166.4k
  add(["I-4", "Denied", d, "Software Engineer", 1, "Zentrix Labs, Inc.", null, "CA", "12-3454321", 999000, null, "Year", 1, "Year"]);   // not certified
  add([null, null, null, null, null, null, null, null, null, null, null, null, null, null]);                                         // phantom row
  ws.commit();
  await wb.commit();
  const parsed = await parseQuarter(file);
  assert.equal(parsed.caseRows, 4);
  const db = baseDb();
  writeQuarter(db, { period: "FY2025Q1", year: 2025, quarter: 1, fileName: path.basename(file), byteSize: 1, parsed });
  const row = db.prepare(`SELECT certified, denied, wage_cases, wage_hist_json FROM lca_employer_periods WHERE fiscal_period = 'FY2025Q1'`).get();
  assert.equal(row.certified, 3);
  assert.equal(row.denied, 1);
  assert.equal(row.wage_cases, 3, "the denied case's wage is not counted");
  assert.deepEqual(JSON.parse(row.wage_hist_json), { 156: 1, 162: 1, 166: 1 });
  reconcileCompanyLca(db, { companies: ["Zentrix Labs"] });
  assert.deepEqual(getCompanyLca(db, "Zentrix Labs").wageByFiscalYear, { 2025: { median: 162000, cases: 3 } });
  const src = read("scripts/ingestLca.mjs");
  // D121 added PW_WAGE_LEVEL (the title families' prevailing-wage level) — optional, like the wage.
  assert.match(src, /OPTIONAL_COLUMNS = \["EMPLOYER_FEIN", "WAGE_RATE_OF_PAY_FROM", "WAGE_UNIT_OF_PAY", "PW_WAGE_LEVEL"\]/);
  assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ""), /PREVAILING_WAGE/, "the prevailing wage is a different claim — not read");
});

const ARCHIVE_CSV = [
  `"Fiscal Year",Employer,"Initial Approval","Initial Denial","Continuing Approval","Continuing Denial",NAICS,"Tax ID",State,City,ZIP`,
  `2022,"ZENTRIX LABS INC",10,1,20,2,54,4321,CA,PALO ALTO,94301`,
  `2022,"ZENTRIX LABS INC",5,0,"1,000",0,54,4321,NY,NEW YORK,10001`,
  `2022,"ZENTRIX LABS LLC",7,0,0,0,54,9999,TX,AUSTIN,73301`,
  `2022,,3,0,0,0,51,8070,DE,WILMINGTON,19801`,
  `2022,"QUILLFEATHER CO",4,0,0,0,51,1111,WA,SEATTLE,98101`,
].join("\r\n");

test("D108 · the hub aggregation on a tiny synthetic CSV — summed per (employer key, tax ID, FY); unnamed rows reach nobody", async () => {
  const dir = tmp();
  const f = path.join(dir, "h1b_datahubexport-2022.csv");
  fs.writeFileSync(f, ARCHIVE_CSV);
  const p = await parseHubFile(f);
  assert.equal(p.layout, "archive");
  assert.equal(p.rows, 5);
  assert.equal(p.unnamed, 1);
  assert.deepEqual(p.fiscalYears, [2022]);
  const z = p.employers.find(e => e.tax_id4 === "4321");
  assert.equal(z.approvals, 10 + 20 + 5 + 1000, "both addresses summed; '1,000' read as a number");
  assert.equal(z.denials, 3);
  assert.deepEqual([z.initial_approvals, z.initial_denials, z.continuing_approvals, z.continuing_denials], [15, 1, 1020, 2]);
  // The current layout (six categories), as a UTF-16 tab-separated crosstab export — no initial/continuing invented.
  const g = path.join(dir, "crosstab-fy2025.csv");
  const tsv = ["Fiscal Year\tEmployer (Petitioner) Name\tTax ID\tState\tNew Employment Approval\tNew Employment Denial\tContinuation Approval\tContinuation Denial\tChange of Employer Approval\tChange of Employer Denial",
    "2025\tZentrix Labs Inc\t4321\tCA\t30\t2\t40\t1\t5\t0"].join("\r\n");
  fs.writeFileSync(g, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(tsv, "utf16le")]));
  const c = await parseHubFile(g);
  assert.equal(c.layout, "current");
  const e = c.employers[0];
  assert.deepEqual([e.approvals, e.denials, e.initial_approvals, e.continuing_approvals], [75, 3, null, 40]);
  assert.deepEqual(e.categories["new employment"], { approvals: 30, denials: 2 });
  // Writing replaces the fiscal year: a re-import converges, it does not double.
  const db = baseDb();
  writeHubFile(db, { fileName: "h1b_datahubexport-2022.csv", sourceUrl: "https://www.uscis.gov/x.csv", fileDate: "2023-01-15", parsed: p });
  writeHubFile(db, { fileName: "h1b_datahubexport-2022.csv", sourceUrl: "https://www.uscis.gov/x.csv", fileDate: "2023-01-15", parsed: p });
  assert.equal(db.prepare(`SELECT SUM(approvals) FROM uscis_hub_employer_years WHERE fiscal_year = 2022`).pluck().get(), 1035 + 7 + 4);
  assert.deepEqual(db.prepare(`SELECT file_date, layout, data_rows FROM uscis_hub_source_files`).get(), { file_date: "2023-01-15", layout: "archive", data_rows: 5 });
});

test("D108 · the hub download streams to disk through an injected fetcher, and takes the file date from Last-Modified", async () => {
  const dir = tmp();
  const seen = [];
  const fetcher = async (url) => {
    seen.push(url);
    return { ok: true, status: 200, headers: new Map([["content-length", String(ARCHIVE_CSV.length)], ["last-modified", "Wed, 31 May 2023 17:40:18 GMT"]]),
      body: (async function* () { yield Buffer.from(ARCHIVE_CSV); })() };
  };
  const d = await downloadHubYear(2023, dir, { fetcher });
  assert.deepEqual(seen, ["https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2023.csv"]);
  assert.equal(d.fileDate, "2023-05-31");
  assert.equal(fs.readFileSync(d.file, "utf8"), ARCHIVE_CSV);
  const big = async () => ({ ok: true, headers: new Map([["content-length", String(300 * 1048576)]]), body: [] });
  await assert.rejects(downloadHubYear(2023, dir, { fetcher: big }), /over the 200 MB limit/);
});

async function factDb() {
  const db = baseDb();
  // Zentrix: an exact legal-name match (tier A) with a FEIN ending 4321, certified LCAs with wages in FY2025.
  lcaRow(db, { key: "zentrix labs", fein: "12-3454321", period: "FY2025Q2", name: "Zentrix Labs, Inc.", certified: 200, hist: { 150: 50, 162: 120, 190: 30 } });
  lcaRow(db, { key: "zentrix labs", fein: "12-3454321", period: "FY2025Q3", name: "Zentrix Labs, Inc.", certified: 90, hist: { 162: 40, 170: 10 } });
  lcaRow(db, { key: "zentrix labs", fein: "12-3454321", period: "FY2026Q1", name: "Zentrix Labs, Inc.", certified: 41 });
  // Tinyco: two certified cases — a median over two is one person's wage, so none is said.
  lcaRow(db, { key: "tinyco", fein: "98-7650001", period: "FY2025Q2", name: "Tinyco LLC", certified: 2, hist: { 120: 2 } });
  const dir = tmp();
  const f = path.join(dir, "h1b_datahubexport-2022.csv");
  fs.writeFileSync(f, ARCHIVE_CSV);
  writeHubFile(db, { fileName: path.basename(f), sourceUrl: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2022.csv",
    fileDate: "2023-01-15", parsed: await parseHubFile(f) });
  // A PARTIAL year: FY2023's archive file is dated 2023-05-31 — it must not become the year said.
  const g = path.join(dir, "h1b_datahubexport-2023.csv");
  fs.writeFileSync(g, ARCHIVE_CSV.replace(/\n2022,/g, "\n2023,"));
  writeHubFile(db, { fileName: path.basename(g), sourceUrl: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2023.csv",
    fileDate: "2023-05-31", parsed: await parseHubFile(g) });
  reconcileCompanyLca(db, { companies: ["Zentrix Labs", "Tinyco", "Quillfeather"] });
  return db;
}

test("D108 · d108OneLcaMatcher holds for the hub — it joins through the LCA match; tax IDs only narrow; a hub-only employer reaches nobody", async () => {
  const db = await factDb();
  const z = getCompanyLca(db, "Zentrix Labs");
  assert.equal(z.uscisByFiscalYear["2022"].approvals, 1035, "ZENTRIX LABS INC (…4321) counted; ZENTRIX LABS LLC (…9999) is another tax ID → excluded");
  assert.equal(z.uscisByFiscalYear["2022"].initialApprovals, 15);
  assert.equal(getCompanyLca(db, "Quillfeather").matchStatus, "unmatched");
  assert.deepEqual(getCompanyLca(db, "Quillfeather").uscisByFiscalYear, {}, "in the hub but not in the LCA corpus → no company gets it");
  // The hub module has no matcher of its own: it stores under companyMatchKey and lcaLayer joins on matched entities.
  const hub = read("services/kb/uscisHub.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(hub, /matchCompanyToEntities|buildEntityIndex|company_lca_sponsorship|lca_company_resolutions/);
  const layer = read("services/kb/lcaLayer.js");
  const join = layer.slice(at(layer, "function aggregateHubForEntities"), at(layer, "function getUscisHubCoverage"));
  assert.doesNotMatch(join.replace(/^\s*(\/\/|\*).*$/gm, ""), /companyMatchKey|LIKE|normalizeEmployerName/, "a join on the matched keys, never a name comparison");
  assert.match(layer, /aggregateHubForEntities\(db, m\.entities\)/, "fed by the ONE match");
  const facts = read("services/kb/sponsorshipFacts.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(facts, /matchCompanyToEntities|companyMatchKey|normalizeEmployerName|lca_employer_periods|uscis_hub_employer_years/);
});

test("D108 · d108SourceAndDateShown for the new facts — '· median $162k' and '· N H-1B approvals FYyyyy (USCIS)', each sourced and dated", async () => {
  const db = await factDb();
  assert.deepEqual(latestCompleteHubYear([{ fiscalYears: [2023], fileDate: "2023-05-31" }, { fiscalYears: [2022], fileDate: "2023-01-15", sourceUrl: "u" }]),
    { fiscalYear: 2022, fileDate: "2023-01-15", sourceUrl: "u" }, "a file dated before its year's 30 September is a partial year");
  const f = sponsorshipFactFor(db, "Zentrix Labs");
  assert.equal(f.text, "Filed 290 certified LCAs in FY2025 · median $162k · 1,035 H-1B approvals FY2022 (USCIS)");
  assert.deepEqual(f.wage, { medianUsd: 162000, cases: 250, fiscalYear: 2025 });
  assert.deepEqual(f.parts.map(p => [p.kind, p.source.name]), [["lca", LCA_SOURCE_NAME], ["wage", LCA_SOURCE_NAME], ["uscis", HUB_SOURCE_NAME]]);
  assert.equal(f.parts[1].source.through, "FY2026 Q1", "the wage carries the LCA files' date");
  assert.deepEqual(f.parts[2].source, { name: HUB_SOURCE_NAME, url: "https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-2022.csv", asOf: "2023-01-15" });
  // Absent → nothing said: two cases give no median, and no hub rows give no USCIS clause.
  assert.equal(sponsorshipFactFor(db, "Tinyco").text, "Filed 2 certified LCAs in FY2025", "no median over two cases, no hub clause");
  assert.equal(sponsorshipFactFor(db, "Tinyco").parts.length, 1);
  assert.equal(sponsorshipFactFor(db, "Quillfeather"), null);
  // The posting panel says each run of facts with ITS source and date.
  const panel = read("client/src/components/PostingPanel.jsx");
  const fn = panel.slice(at(panel, "export function PostingSponsorship"), at(panel, "/** D59 · the label block"));
  assert.match(fn, /fact\.parts/);
  assert.match(fn, /g\.source\.through \? `, through \$\{g\.source\.through\}` : g\.source\.asOf \? `, file dated \$\{g\.source\.asOf\}`/);
});

test("D108 P3 · the facts feed D104's eligibility as CONTEXT only — the verdict is identical with and without them", async () => {
  const db = await factDb();
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'synthetic','x')").run();
  db.prepare("INSERT INTO application_defaults (user_id, key, value, source) VALUES (1,'sponsorship_now','yes','user')").run();
  const job = (id, company, description) => db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,description)
    VALUES (?,?,?,?,?,?,?,?)`).run(id, "Software Engineer", company, `https://x.test/${id}`, `https://x.test/${id}`, "t", `h${id}`, description);
  job("nos", "Zentrix Labs", "We are unable to sponsor visas for this role. Python.");
  job("ok", "Zentrix Labs", "Build things with us. Python and SQL.");
  job("unk", "Quillfeather", "We are unable to sponsor visas for this role.");
  const nos = eligibilityForJob(db, 1, "nos");
  assert.equal(nos.status, "ineligible", "a posting's 'no sponsorship' stays ineligible even for a company with 290 filings");
  assert.deepEqual(nos.reasons, ["no visa sponsorship"]);
  assert.match(nos.context.sponsorship.text, /^Filed 290 certified LCAs/);
  assert.equal(eligibilityForJob(db, 1, "ok").status, "eligible");
  assert.equal(eligibilityForJob(db, 1, "unk").status, "ineligible");
  assert.equal(eligibilityForJob(db, 1, "unk").context, undefined, "no safe fact → no context, and the verdict unchanged");
  // Without the facts at all, the same verdicts.
  db.exec(`DELETE FROM company_lca_sponsorship`);
  assert.deepEqual(["nos", "ok", "unk"].map(id => eligibilityForJob(db, 1, id).status), ["ineligible", "eligible", "ineligible"]);
  const src = read("services/jobEligibility.js");
  assert.doesNotMatch(read("shared/eligibility.js"), /sponsorshipFact|company_lca/, "the verdict function never sees the facts");
  assert.match(src, /const verdict = eligibilityOf\(req, defaults, degrees\);/);
});

test("D108 P3 · Atlas role pages: 'Sponsors who hire this role' — computed from active postings + LCA facts, published roles only", async () => {
  const db = await factDb();
  const node = (slug, name, term, status) => db.prepare(`INSERT INTO atlas_nodes (slug, kind, name, term, status, source) VALUES (?, 'role', ?, ?, ?, 'test')`).run(slug, name, term, status);
  node("software-engineer", "Software Engineer", "software engineer", "published");
  node("senior-software-engineer", "Senior Software Engineer", "senior software engineer", "published");
  node("data-engineer", "Data Engineer", "data engineer", "draft");
  const job = (id, title, company, active = 1) => db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,description,is_active)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, title, company, `https://x.test/${id}`, `https://x.test/${id}`, "t", `h${id}`, "x", active);
  job("1", "Software Engineer, Payments", "Zentrix Labs");
  job("2", "Software Engineer II", "Zentrix Labs");
  job("3", "Senior Software Engineer", "Tinyco");            // the longer role wins — not this page's
  job("4", "Software Engineer", "Quillfeather");             // no safe LCA match → not listed
  job("5", "Software Engineer", "Tinyco", 0);                // inactive
  job("6", "Data Engineer", "Zentrix Labs");
  const s = sponsorsForRole(db, "software-engineer");
  assert.deepEqual(s.map(x => [x.company, x.postings, x.filings]), [["Zentrix Labs", 2, 290]]);
  assert.equal(s[0].source.name, LCA_SOURCE_NAME);
  assert.deepEqual(sponsorsForRole(db, "senior-software-engineer").map(x => x.company), ["Tinyco"]);
  assert.deepEqual(sponsorsForRole(db, "data-engineer"), [], "a draft node shows nothing");
  assert.match(read("routes/atlas.js"), /node\.kind === "role" \? \(\(\) => \{ try \{ return sponsorsForRole\(db, node\.slug\);/);
  assert.match(read("client/src/pages/atlas/AtlasPage.jsx"), /Sponsors who hire this role/);
});

test("D108 · migration 187 is byte-identical in server.js and scripts/migrations.js, appended, additive", () => {
  const id = "187_sponsorship_facts";
  const block = (src) => { const i = src.indexOf(`id: "${id}"`); assert.ok(i > 0); return src.slice(i, at(src, "\n    },", i)); };
  assert.equal(block(fs.readFileSync("server.js", "utf8")), block(fs.readFileSync("scripts/migrations.js", "utf8")));
  const m = MIGRATIONS.find(x => x.id === id);
  assert.doesNotMatch(m.sql, /DROP|RENAME|scraped_jobs/i);
  const ids = MIGRATIONS.map(x => x.id);
  assert.ok(ids.indexOf(id) > ids.indexOf("184_proof_links"));
});
