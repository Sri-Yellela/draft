// ⭐ D121 (owner 10-31) · H-1B SPONSORSHIP SIGNALS — the ONE module (services/kb/sponsorshipSignal.js), the title
// family key (shared/lcaTitleKey.js) and the ingest's title families (migration 203). Synthetic employers only; every
// disclosure sheet is a tiny fixture written to a temp dir. No network, no model.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { MIGRATIONS } from "../scripts/migrations.js";
import { reconcileCompanyLca } from "../services/kb/lcaLayer.js";
import { parseQuarter, writeQuarter, pwLevel } from "../scripts/ingestLca.mjs";
import { lcaTitleKey } from "../shared/lcaTitleKey.js";
import { sponsorshipSignal, sponsorshipSignalsForRows, SIGNAL, LABELS, NOT_LEGAL_ADVICE } from "../services/kb/sponsorshipSignal.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

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
const period = (db, { key, fein = "", p, name, certified }) =>
  db.prepare(`INSERT INTO lca_employer_periods (employer_key, fein, fiscal_period, employer_name, certified) VALUES (?,?,?,?,?)`).run(key, fein, p, name, certified);

/** A synthetic disclosure sheet: n certified Software Engineer cases at Zentrix (levels and wages varied) + others. */
async function ingested() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "d121-"));
  const file = path.join(dir, "LCA_Disclosure_Data_FY2025_Q2.xlsx");
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: file, useSharedStrings: false });
  const ws = wb.addWorksheet("s");
  const add = (r) => ws.addRow(r).commit();
  add(["CASE_NUMBER", "CASE_STATUS", "DECISION_DATE", "JOB_TITLE", "TOTAL_WORKER_POSITIONS", "EMPLOYER_NAME", "TRADE_NAME_DBA",
    "EMPLOYER_STATE", "EMPLOYER_FEIN", "WAGE_RATE_OF_PAY_FROM", "WAGE_UNIT_OF_PAY", "PW_WAGE_LEVEL"]);
  const d = 45700; // FY2025 Q2
  const z = (title, wage, lvl, status = "Certified") => add([`I-${Math.random()}`, status, d, title, 1, "Zentrix Labs, Inc.", null, "CA", "12-3454321", wage, "Year", lvl]);
  z("Software Engineer", 150000, "II"); z("Senior Software Engineer", 162000, "II"); z("SOFTWARE ENGINEER II", 170000, "II");
  z("Sr. Software Engineer, Payments", 180000, "III"); z("Software Engineer", 155000, "Level II");
  z("Data Engineer", 140000, "I"); z("Software Engineer", 400000, "IV", "Denied");
  for (let i = 0; i < 9; i++) z("Product Manager", 150000, "II");   // Zentrix: 14 certified → often
  ws.commit();
  await wb.commit();
  const db = baseDb();
  writeQuarter(db, { period: "FY2025Q2", year: 2025, quarter: 2, fileName: path.basename(file), byteSize: 1, parsed: await parseQuarter(file) });
  // Tinyco: 3 certified in FY2025 → sometimes · Oldco: none in FY2025 but 4 in FY2024 → sometimes · Quietco: none in 2 FYs
  period(db, { key: "tinyco", fein: "98-7650001", p: "FY2025Q3", name: "Tinyco LLC", certified: 3 });
  period(db, { key: "oldco", fein: "98-7650002", p: "FY2024Q4", name: "Oldco LLC", certified: 4 });
  period(db, { key: "quietco", fein: "98-7650003", p: "FY2025Q1", name: "Quietco LLC", certified: 0 });
  db.prepare(`UPDATE lca_employer_periods SET denied = 1 WHERE employer_key = 'quietco'`).run();
  reconcileCompanyLca(db, { companies: ["Zentrix Labs", "Tinyco", "Oldco", "Quietco", "Nobody Matches Inc"] });
  return db;
}

test("D121 · lcaTitleKey — one family for the LCA's JOB_TITLE and the board's title (level words, punctuation, team tails removed)", () => {
  for (const t of ["Software Engineer", "Senior Software Engineer", "SOFTWARE ENGINEER II", "Sr. Software Engineer, Payments",
    "Staff Software Engineer (L6)", "Software Engineer - Remote", "Software Engineer 3"]) assert.equal(lcaTitleKey(t), "software engineer", t);
  assert.equal(lcaTitleKey("Data Engineer"), "data engineer");
  assert.equal(lcaTitleKey("Senior"), null);
  assert.equal(lcaTitleKey(""), null);
  assert.deepEqual(["II", "Level II", "2", "iv", "N/A", ""].map(pwLevel), ["II", "II", "II", "IV", null, null]);
});

test("D121 · the ingest writes title families (certified cases only) with wage histograms and prevailing-wage levels", async () => {
  const db = await ingested();
  const r = db.prepare(`SELECT certified, wage_cases, level_json FROM lca_employer_titles WHERE title_key = 'software engineer'`).get();
  assert.equal(r.certified, 5, "the denied case is not counted");
  assert.equal(r.wage_cases, 5);
  assert.deepEqual(JSON.parse(r.level_json), { II: 4, III: 1 });
  // a re-import of the period replaces, never doubles
  const before = db.prepare(`SELECT COUNT(*) FROM lca_employer_titles`).pluck().get();
  assert.ok(before >= 3);
  assert.match(read("scripts/ingestLca.mjs"), /delFam\?\.run\(period\);/);
});

test("D121 · d121OneSignalModule — company levels: often · sometimes · no record · unknown; one function every surface reads", async () => {
  const db = await ingested();
  const lv = (c) => sponsorshipSignal(db, c).level;
  assert.equal(lv("Zentrix Labs"), "often");
  assert.equal(lv("Tinyco"), "sometimes");
  assert.equal(lv("Oldco"), "sometimes", "none in the latest complete year, but filings the year before");
  assert.equal(lv("Quietco"), "no_record");
  assert.equal(lv("Nobody Matches Inc"), "unknown");
  assert.equal(SIGNAL.OFTEN_MIN, 10);
  const s = sponsorshipSignal(db, "Zentrix Labs");
  assert.equal(s.label, LABELS.often);
  assert.ok(s.confidence > 0);
  assert.equal(s.fiscalYear, 2025);
  assert.ok(s.sources.some(x => /OFLC LCA/.test(x.name)));
  const m = sponsorshipSignalsForRows(db, [{ job_id: "a", company: "Tinyco", title: "Engineer" }, { job_id: "b", company: "Zentrix Labs" }]);
  assert.deepEqual([m.get("a").level, m.get("b").level], ["sometimes", "often"]);
});

test("D121 · d121PostingWordsOverrideCompany — a posting that says it won't sponsor is 'says no', even at a company that files often", async () => {
  const db = await ingested();
  const s = sponsorshipSignal(db, "Zentrix Labs", { posting: { description: "We are unable to sponsor visas for this role. You must be authorized to work in the US." } });
  assert.equal(s.level, "says_no");
  assert.equal(s.companyLevel, "often", "the company's record is still there, beside the posting's words");
  assert.match(s.line, /^Says no sponsorship · This posting says it won't sponsor/);
  const fine = sponsorshipSignal(db, "Zentrix Labs", { posting: { description: "Visa sponsorship is available for this role." } });
  assert.equal(fine.level, "often");
});

test("D121 · d121UnknownNeverNo — an unmatched employer reads 'unknown', never 'no record' or 'says no'", async () => {
  const db = await ingested();
  const s = sponsorshipSignal(db, "Nobody Matches Inc");
  assert.equal(s.level, "unknown");
  assert.equal(s.label, "Sponsorship unknown");
  assert.match(s.line, /unknown, not a no/);
  assert.equal(s.confidence, 0);
  assert.equal(sponsorshipSignal(db, null).level, "unknown");
});

test("D121 · d121WordingFiledNotWill — no signal says 'will sponsor'; the words are filed / certified", async () => {
  const db = await ingested();
  const src = read("services/kb/sponsorshipSignal.js").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(src, /will sponsor|sponsors you|will be sponsored/i);
  for (const c of ["Zentrix Labs", "Tinyco", "Oldco", "Quietco", "Nobody Matches Inc"]) {
    const s = sponsorshipSignal(db, c, { title: "Software Engineer" });
    assert.doesNotMatch(JSON.stringify(s), /will sponsor|sponsors you/i, c);
  }
  assert.match(sponsorshipSignal(db, "Zentrix Labs").line, /Filed 15 certified LCAs in FY2025/);
});

test("D121 · d121YearAlwaysShown — every count says its fiscal year", async () => {
  const db = await ingested();
  for (const c of ["Zentrix Labs", "Tinyco", "Oldco", "Quietco"]) {
    const s = sponsorshipSignal(db, c, { title: "Software Engineer" });
    for (const f of s.facts.filter(f => f.kind !== "everify")) {
      assert.match(f.text, /FY\d{4}/, `${c}: ${f.text}`);
      assert.ok(f.fiscalYear >= 2000, `${c}: ${f.kind} carries its year`);
    }
  }
  assert.match(sponsorshipSignal(db, "Oldco").line, /No certified LCAs found in FY2025 · 4 certified LCAs in FY2024/);
});

test("D121 · d121TitleLevelMedianWage — '5 certified LCAs for Software Engineer titles in FY2025 · median $162k · mostly Level II'", async () => {
  const db = await ingested();
  const s = sponsorshipSignal(db, "Zentrix Labs", { title: "Senior Software Engineer, Platform" });
  const t = s.facts.find(f => f.kind === "title");
  assert.equal(t.text, "5 certified LCAs for Software Engineer titles in FY2025 · median $162k · mostly Level II");
  assert.equal(t.title.medianUsd, 162000);
  assert.ok(s.line.includes(t.text));
  assert.equal(sponsorshipSignal(db, "Zentrix Labs", { title: "Astronaut" }).facts.some(f => f.kind === "title"), false, "no family filed → no title line");
  assert.equal(sponsorshipSignal(db, "Tinyco", { title: "Software Engineer" }).facts.some(f => f.kind === "title"), false);
});

test("D121 · d121EVerifyOnlyWhenKnown — E-Verify is said only when the posting says it; never guessed", async () => {
  const db = await ingested();
  assert.equal(sponsorshipSignal(db, "Zentrix Labs").facts.some(f => f.kind === "everify"), false);
  const s = sponsorshipSignal(db, "Nobody Matches Inc", { posting: { description: "This employer participates in E-Verify." } });
  assert.deepEqual(s.facts.filter(f => f.kind === "everify").map(f => f.text), ["The posting says the employer uses E-Verify"]);
});

test("D121 · d121NotLegalAdviceLine — every signal carries the not-legal-advice line, naming the employer, the DSO and an attorney", async () => {
  const db = await ingested();
  assert.equal(NOT_LEGAL_ADVICE, "Not legal advice — confirm with the employer, your DSO or an immigration attorney.");
  for (const c of ["Zentrix Labs", "Quietco", "Nobody Matches Inc"]) assert.equal(sponsorshipSignal(db, c).notice, NOT_LEGAL_ADVICE);
});
