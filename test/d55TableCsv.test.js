// D55 (i) · THE TABLE IN AND OUT AS CSV — docs/AUTOFILL_TARGET.md §8.1 row 12, §8.5 (i).
//
// Pinned, each red when what it holds is removed:
//   · export → import round-trips company, title, the sent date and the outcome (quotes, commas and a
//     formula-looking cell included)
//   · duplicates are skipped by the D54 COMPANY KEY + title — "STRIPE" against "Stripe, Inc.", "Scale AI"
//     on Greenhouse against "Scale" on Ashby — and two same-named companies with different websites are
//     NOT duplicates, on the first import and on every later one (migration 135 keeps the website)
//   · imported rows are SENT job_applications with NO ATS score, never Drafts or pending records, and
//     their first reply is the file's date or nothing — never the moment of import
//   · validation and size limits refuse per row or per file, and a dry run writes nothing
// All people and companies here are synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import { capturedAtsAtApply } from "../routes/apply.js";
import { importApplications } from "../services/applicationImport.js";
import { listHistory } from "../services/applicationRecords.js";
import {
  historyToCsv, parseCsv, guessMapping, readImport, parseDay, csvCell, IMPORT_LIMITS, EXPORT_COLUMNS,
} from "../shared/applicationCsv.js";
import { historyFunnel } from "../shared/applicationHistory.js";

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 9, 6, 12) / 1000);
const MAP = { company: "Company", title: "Title", applied: "Applied on", outcome: "Outcome", replied: "First reply", url: "Posting URL", website: "Website" };

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO'),(2,'bob','x','PRO')").run();
  return db;
}
const csv = (rows) => [Object.values(MAP).join(","), ...rows.map(r => r.map(csvCell).join(","))].join("\r\n");
const counts = (db) => ({
  runJobs: db.prepare("SELECT COUNT(*) FROM apply_run_jobs").pluck().get(),
  records: db.prepare("SELECT COUNT(*) FROM application_records").pluck().get(),
});

test("D55 CSV: the parser reads quotes, commas, newlines in a cell and a BOM; the formula guard round-trips", () => {
  const rows = parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n' + csvCell("=SUM(A1)") + ",z\r\n");
  assert.deepEqual(rows, [["a", "b"], ['x, "y"', "line1\nline2"], ["=SUM(A1)", "z"]]);
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)", "a spreadsheet opening the export runs nothing");
  assert.equal(parseDay("2026-03-04"), Date.UTC(2026, 2, 4, 12) / 1000);
  assert.equal(parseDay("3/4/2026"), Date.UTC(2026, 2, 4, 12) / 1000, "US month/day/year");
  assert.equal(parseDay("2026-02-30"), null, "an impossible date is refused, not rolled over");
  assert.deepEqual(guessMapping(["Employer", "Job Title", "Date Applied", "Status", "Stage"]),
    { company: "Employer", title: "Job Title", applied: "Date Applied", outcome: "Status" });
  assert.equal(guessMapping(EXPORT_COLUMNS).outcome, "Outcome", "an export maps its own STORED outcome column, not the Stage label");
});

test("D55 CSV: export → import round-trips company, title, the sent date and the outcome", () => {
  const src = freshDb();
  const rows = [
    ["j1", "=Acme, \"Labs\"", "Data Engineer", 40, "interview", 30],
    ["j2", "Northwind", "SRE, Platform", 20, "rejected", null],
    ["j3", "Contoso", "Designer", 5, null, null],
  ];
  for (const [id, co, role, ago, outcome, replyAgo] of rows) {
    src.prepare(`INSERT INTO job_applications (user_id,job_id,company,role,applied_at,response_outcome,furthest_stage,first_response_at)
                 VALUES (1,?,?,?,?,?,?,?)`).run(id, co, role, NOW - ago * DAY, outcome, outcome === "interview" ? "interview" : null,
      replyAgo == null ? null : NOW - replyAgo * DAY);
  }
  const before = listHistory(src, 1, { now: NOW });
  const text = historyToCsv(before);
  const map = guessMapping(parseCsv(text)[0]);
  const dst = freshDb();
  const out = importApplications(dst, 1, { csv: text, mapping: map, apply: true, now: NOW });
  assert.equal(out.written, 3, JSON.stringify(out.invalid));
  const after = listHistory(dst, 1, { now: NOW });
  const day = (s) => (s == null ? null : new Date(s * 1000).toISOString().slice(0, 10));
  const shape = (r) => [r.company, r.title, day(r.sentAt), r.responseOutcome, r.stage, day(r.firstResponseAt)];
  assert.deepEqual(after.map(shape).sort(), before.map(shape).sort());
  // And exporting what was imported gives the same file, but for the URL column (none was stored).
  assert.equal(historyToCsv(after.sort((a, b) => (b.date ?? 0) - (a.date ?? 0))),
    historyToCsv(before.sort((a, b) => (b.date ?? 0) - (a.date ?? 0))));
});

test("D55 CSV: duplicates are the COMPANY KEY + title — never the display name", () => {
  const db = freshDb();
  db.prepare("INSERT INTO job_applications (user_id,job_id,company,role,job_url,applied_at) VALUES (1,'s1','Stripe, Inc.','Backend Engineer','https://stripe.example/1',?)").run(NOW - 50 * DAY);
  db.prepare("INSERT INTO job_applications (user_id,job_id,company,role,job_url,applied_at) VALUES (1,'s2','Scale','ML Engineer','https://jobs.ashbyhq.com/scaleai/123',?)").run(NOW - 50 * DAY);
  const file = csv([
    ["STRIPE", "backend engineer", "2026-08-01", "", "", "", ""],                                   // = Stripe, Inc.
    ["Scale AI", "ML Engineer", "2026-08-02", "", "", "https://boards.greenhouse.io/scaleai/jobs/9", ""], // same slug, names agree
    ["Stripe", "Product Designer", "2026-08-03", "", "", "", ""],                                    // same company, other role
    ["Mercury", "Analyst", "2026-08-04", "", "", "", "mercury.com"],
    ["Mercury", "Analyst", "2026-08-05", "", "", "", "https://www.mercury.co.uk"],                    // same name, another company
    ["Mercury", "analyst!", "2026-08-06", "", "", "", "mercury.com"],                                 // repeats row 5
  ]);
  const out = importApplications(db, 1, { csv: file, mapping: MAP, apply: true, now: NOW });
  assert.deepEqual(out.duplicates.map(d => [d.row, d.reason]),
    [[2, "duplicate_existing"], [3, "duplicate_existing"], [7, "duplicate_in_file"]]);
  assert.deepEqual(out.imported.map(r => r.row), [4, 5, 6], "a new role at a known company, and BOTH Mercurys");
  assert.equal(db.prepare("SELECT COUNT(*) FROM job_applications WHERE company='Mercury'").pluck().get(), 2);
  // Migration 135 keeps the websites, so the two Mercurys stay two in The Table and on the next import.
  const keys = new Set(listHistory(db, 1, { now: NOW }).filter(r => r.company === "Mercury").map(r => r.companyKey));
  assert.equal(keys.size, 2, "two same-named companies stay separate once stored");
  const again = importApplications(db, 1, { csv: file, mapping: MAP, apply: true, now: NOW });
  assert.equal(again.written ?? 0, 0, "re-importing the same file adds nothing");
  assert.ok(again.duplicates.every(d => d.reason === "duplicate_existing" || d.reason === "duplicate_in_file"));
  assert.equal(again.duplicates.length, 6);
});

test("D55 CSV: imported rows are SENT, never Drafts, never scored — and their reply date is the file's or none", () => {
  const db = freshDb();
  const before = counts(db);
  const file = csv([
    ["Northwind", "Data Engineer", "2026-07-01", "Interviewing", "2026-07-10", "https://northwind.example/jobs/1", ""],
    ["Contoso", "PM", "2026-07-02", "screen", "", "", ""],
    ["Fabrikam", "SRE", "2026-07-03", "applied", "", "", ""],
  ]);
  const out = importApplications(db, 1, { csv: file, mapping: MAP, apply: true, now: NOW });
  assert.equal(out.written, 3);
  assert.deepEqual(counts(db), before, "no apply_run_jobs (Drafts) and no application_records were written");
  const rows = db.prepare("SELECT * FROM job_applications ORDER BY company").all();
  for (const r of rows) {
    assert.equal(r.ats_score_at_apply, null, `${r.company}: no score — none was measured`);
    assert.equal(r.ats_scorer_version, null);
    assert.equal(r.ats_report_at_apply, null);
    assert.deepEqual([r.auto_status, r.source, r.user_id], ["imported", "csv_import", 1]);
    assert.ok(r.applied_at > 0);
  }
  const by = Object.fromEntries(rows.map(r => [r.company, r]));
  assert.deepEqual([by.Northwind.response_outcome, by.Northwind.furthest_stage, by.Northwind.first_response_at],
    ["interview", "interview", Date.UTC(2026, 6, 10, 12) / 1000], "'Interviewing' stored as the vocabulary's 'interview'");
  assert.deepEqual([by.Contoso.response_outcome, by.Contoso.first_response_at], ["screen", null],
    "no reply date in the file → none stored, not the import time");
  assert.equal(by.Fabrikam.response_outcome, null, "'applied' is sent with nothing back");
  const hist = listHistory(db, 1, { now: NOW });
  assert.ok(hist.every(r => r.imported && r.applicationId != null && r.recordId == null && !r.hasResume));
  assert.deepEqual(hist.map(r => r.stage).sort(), ["interviewing", "screen", "sent"]);
  assert.equal(historyFunnel(hist).sent, 3, "imported rows are in the funnel as sent applications");
  assert.equal(listHistory(db, 2, { now: NOW }).length, 0, "another user sees none of them");
});

test("D55 CSV: validation refuses per row; limits and mapping refuse the file; a dry run writes nothing", () => {
  const db = freshDb();
  const file = csv([
    ["", "Engineer", "2026-07-01", "", "", "", ""],
    ["Acme", "Engineer", "2099-01-01", "", "", "", ""],
    ["Acme", "Engineer", "2026-07-01", "hired on the spot", "", "", ""],
    ["Acme", "Engineer", "not a date", "", "", "", ""],
    ["Acme", "Engineer", "2026-07-01", "", "2026-06-01", "", ""],
    ["Acme", "Engineer", "2026-07-01", "", "", "javascript:alert(1)", ""],
    ["Acme", "x".repeat(IMPORT_LIMITS.maxCell + 1), "2026-07-01", "", "", "", ""],
    ["Acme", "Engineer", "2026-07-01", "Closed", "", "", ""],
    ["Acme", "Engineer", "2026-07-01", "rejected", "", "", ""],
  ]);
  const dry = importApplications(db, 1, { csv: file, mapping: MAP, now: NOW });
  assert.equal(dry.applied, false);
  assert.deepEqual(dry.invalid.map(i => i.reason), [
    "company_missing", "applied_date_in_future", "outcome_unknown", "applied_date_unreadable",
    "reply_before_applied", "url_not_a_web_address", "title_too_long", "not_sent",
  ]);
  assert.deepEqual(dry.imported.map(r => r.row), [10]);
  assert.equal(db.prepare("SELECT COUNT(*) FROM job_applications").pluck().get(), 0, "a dry run writes nothing");
  assert.equal(readImport(file, { company: "Company", title: "Title" }).error, "mapping_incomplete");
  assert.equal(readImport(file, { ...MAP, company: "Employer" }).error, "mapping_unknown_column");
  assert.equal(readImport("x".repeat(IMPORT_LIMITS.maxBytes + 1), MAP).error, "too_large");
  const many = csv(Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, (_, i) => [`Co${i}`, "R", "2026-01-01", "", "", "", ""]));
  assert.equal(readImport(many, MAP).error, "too_many_rows");
  assert.equal(readImport("Company,Title,Applied on\r\n", MAP).error, "empty");
});

test("D55 CSV: POST /api/applications/import — dry run, apply, limits, scoped to the caller", async () => {
  const db = freshDb();
  const app = express();
  app.use(express.json({ limit: "4mb" }));
  app.use((req, _res, next) => { req.user = { id: Number(req.headers["x-user"] || 1) }; next(); });
  applicationRecordRoutes(app, db, (req, _res, next) => next(), { capturedAtsAtApply });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, user = 1) => fetch(`${base}/api/applications/import`, {
    method: "POST", headers: { "content-type": "application/json", "x-user": String(user) }, body: JSON.stringify(body) });
  try {
    const file = csv([["Northwind", "Data Engineer", "2026-07-01", "", "", "", ""]]);
    const dry = await (await post({ csv: file, mapping: MAP })).json();
    assert.deepEqual([dry.applied, dry.imported.length], [false, 1]);
    assert.equal(db.prepare("SELECT COUNT(*) FROM job_applications").pluck().get(), 0);
    const done = await (await post({ csv: file, mapping: MAP, apply: true }, 2)).json();
    assert.deepEqual([done.applied, done.written], [true, 1]);
    assert.equal(db.prepare("SELECT user_id FROM job_applications").pluck().get(), 2, "written to the caller only");
    assert.equal((await post({ csv: "x".repeat(IMPORT_LIMITS.maxBytes + 1), mapping: MAP })).status, 413);
    assert.equal((await post({ mapping: MAP })).status, 400);
    assert.equal((await post({ csv: file, mapping: { company: "Company" } })).status, 400);
  } finally { server.close(); }
});

test("D55 CSV: the panel exports exactly the rows it shows, and imports through the dry run first", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync("client/src/components/ApplicationHistory.jsx", "utf8");
  assert.match(src, /historyToCsv\(view\.rows\)/, "the export is The Table's rows as shown, not a second query");
  assert.match(src, /\/api\/applications\/import/);
  assert.match(src, /onClick=\{\(\) => run\(false\)\}>/, "Preview is a dry run");
  assert.match(src, /preview && preview\.imported\.length > 0 && \(/, "Import appears only after a preview");
});
