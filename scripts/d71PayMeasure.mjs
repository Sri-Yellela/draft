#!/usr/bin/env node
// D71 — MEASURE FIRST: how many active postings state pay (or a place) in their text while the row's
// salary (or location) is empty. READ-ONLY; counts only, no posting text printed.
//
// ⚠ This is a MEASUREMENT detector, deliberately simple, not the D71 parser: a numeric range
// with a pay word in the same line or the line before. It will over-count slightly (the parser's
// trap list exists for exactly that), and the report says so.
//
// Usage: node scripts/d71PayMeasure.mjs [--db <path>] [--json]
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const argv = process.argv.slice(2);
const at = argv.indexOf("--db");
const dataDir = process.env.RM_DATA_DIR || path.join(process.cwd(), "data");
const dbPath = at >= 0 ? argv[at + 1] : path.join(dataDir, "resume_master.db");
if (!fs.existsSync(dbPath)) { console.error(`no database at ${dbPath}`); process.exit(2); }
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

const NUM = String.raw`(?:\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{2,3}(?:\.\d+)?\s?[kK]|\d{2,3}(?:\.\d{2})?)`;
const RANGE = new RegExp(String.raw`(?:[$€£]|USD\s?)?\s?${NUM}\s*(?:-|–|—|to|and)\s*(?:[$€£]|USD\s?)?\s?${NUM}`);
const PAY_WORD = /salary|compensation|pay range|base pay|pay scale|annual(?:ly)?|per (?:year|hour|annum)|hourly|\/\s?(?:yr|hr|year|hour)\b|\bUSD\b|wage/i;
const TRAILING_LINE = /^.{0,80}\b[A-Z]{2,3}\b.{0,60}\s-\s[\d,.]+\s-\s[\d,.]+\s+[A-Z]{3}\b/m; // "USA, MA, Boston - 143,700.00 - 194,400.00 USD"

function payInText(text) {
  const lines = String(text || "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!RANGE.test(lines[i])) continue;
    if (PAY_WORD.test(lines[i]) || PAY_WORD.test(lines[i - 1] || "")) return true;
  }
  return false;
}

const hasCaptures = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_captures'").get();
const hasPlaces = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_tag_places'").get();
const hasText = db.prepare("PRAGMA table_info(scraped_jobs)").all().some(c => c.name === "description_text");
const rows = db.prepare(`
  SELECT s.job_id, s.source, s.location, s.salary_min, s.salary_max,
         ${hasText ? "COALESCE(s.description_text, s.description)" : "s.description"} AS text,
         length(s.description) AS dlen,
         ${hasCaptures ? "(SELECT COUNT(*) FROM job_captures c WHERE c.job_id = s.job_id)" : "0"} AS captured,
         ${hasPlaces ? "(SELECT COUNT(*) FROM job_tag_places p WHERE p.job_id = s.job_id)" : "NULL"} AS places
  FROM scraped_jobs s WHERE s.is_active = 1 AND s.description IS NOT NULL`).all();

const by = {};
const bump = (k, f) => { by[k] ??= { active: 0, salaryEmpty: 0, payInTextSalaryEmpty: 0, trailingLocLine: 0, atCap: 0, locationEmpty: 0, noPlaces: 0 }; by[k][f]++; };
let capturedPay = 0, captured = 0;
for (const r of rows) {
  const k = r.source || "(none)";
  bump(k, "active");
  if (r.dlen >= 4990) bump(k, "atCap");
  if (!String(r.location || "").trim()) bump(k, "locationEmpty");
  if (r.places === 0) bump(k, "noPlaces");
  const empty = r.salary_min == null && r.salary_max == null;
  if (!empty) continue;
  bump(k, "salaryEmpty");
  if (payInText(r.text)) { bump(k, "payInTextSalaryEmpty"); if (r.captured) capturedPay++; }
  if (TRAILING_LINE.test(r.text || "")) bump(k, "trailingLocLine");
  if (r.captured) captured++;
}
const total = Object.values(by).reduce((a, v) => { for (const [f, n] of Object.entries(v)) a[f] = (a[f] || 0) + n; return a; }, {});
const report = { db: dbPath, active: rows.length, bySource: by, total,
                 captured: { salaryEmpty: captured, payInText: capturedPay },
                 note: "measurement detector — a range with a pay word on its line or the line before; over-counts traps slightly" };
if (argv.includes("--json")) { console.log(JSON.stringify(report)); process.exit(0); }
console.log(`D71 measure — ${dbPath}, ${rows.length} active rows with a description`);
console.table({ ...by, TOTAL: total });
console.log("captured rows with salary empty:", captured, "· of those, pay in text:", capturedPay);
console.log(report.note);
