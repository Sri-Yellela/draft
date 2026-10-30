import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  sponsorshipFactFor, latestCompleteYear, isOfficialSource, addWhatChanged, listWhatChanged, removeWhatChanged,
  NOT_LEGAL_ADVICE, LCA_SOURCE_NAME,
} from "../services/kb/sponsorshipFacts.js";

// ⭐ D108 (owner 10-30) · sponsorship facts per company, and a dated "What changed". Synthetic companies.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function fixtureDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const q of [1, 2, 3, 4]) {
    db.prepare(`INSERT INTO lca_source_files (file_name, fiscal_period, fiscal_year, fiscal_quarter, ingested_at, source_url) VALUES (?,?,?,?,1,?)`)
      .run(`LCA_FY2025_Q${q}.xlsx`, `FY2025Q${q}`, 2025, q, `https://www.dol.gov/x/LCA_Disclosure_Data_FY2025_Q${q}.xlsx`);
  }
  db.prepare(`INSERT INTO lca_source_files (file_name, fiscal_period, fiscal_year, fiscal_quarter, ingested_at, source_url) VALUES (?,?,?,?,1,?)`)
    .run("LCA_FY2026_Q1.xlsx", "FY2026Q1", 2026, 1, "https://www.dol.gov/x/LCA_Disclosure_Data_FY2026_Q1.xlsx");
  const co = (company, status, conf, byYear) => db.prepare(`INSERT INTO company_lca_sponsorship
      (company, match_status, match_confidence, certified_total, by_fiscal_year_json, latest_period, first_seen, last_seen)
      VALUES (?,?,?,?,?,?,1,1)`).run(company, status, conf, Object.values(byYear).reduce((a, b) => a + b, 0), JSON.stringify(byYear), "FY2026Q1");
  co("Acme Payments", "matched", 0.95, { 2024: 120, 2025: 290, 2026: 41 });
  co("Unsure Co", "ambiguous", 0.4, { 2025: 50 });
  co("Quiet Co", "matched", 0.95, { 2023: 3 });
  return db;
}

test("D108 · d108SourceAndDateShown — the latest COMPLETE year, the source named and linked, the data's date", () => {
  const db = fixtureDb();
  assert.equal(latestCompleteYear("FY2026Q1"), 2025);
  assert.equal(latestCompleteYear("FY2025Q4"), 2025);
  const f = sponsorshipFactFor(db, "Acme Payments");
  assert.equal(f.text, "Filed 290 certified LCAs in FY2025", "not FY2026's partial 41");
  assert.deepEqual(f.source, { name: LCA_SOURCE_NAME, url: "https://www.dol.gov/x/LCA_Disclosure_Data_FY2026_Q1.xlsx", through: "FY2026 Q1" });
  assert.equal(sponsorshipFactFor(db, "Quiet Co").text, "No certified LCAs found in FY2025");
  assert.match(read("client/src/components/PostingPanel.jsx"), /<PostingSponsorship fact=\{job\.sponsorshipFact\} \/>/);
  assert.match(read("server.js"), /sponsorshipFact: sponsorship\.get\(j\.company\)/);
});

test("D108 · d108OneLcaMatcher — no name matching here: an unsafe match says nothing; an unknown company says nothing", () => {
  const db = fixtureDb();
  assert.equal(sponsorshipFactFor(db, "Unsure Co"), null, "not presentable — no line, not a zero");
  assert.equal(sponsorshipFactFor(db, "acme payments"), null, "only the layer's own resolved company key");
  assert.equal(sponsorshipFactFor(db, "Nobody"), null);
  const src = read("services/kb/sponsorshipFacts.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(src, /matchCompanyToEntities|companyMatchKey|normalizeEmployerName|lca_employer_periods/, "the one matcher is lcaLayer's");
});

test("D108 · d108WhatChangedHasSourceLinks — official links only, dated, with the notice; removed lines leave the list", () => {
  const db = fixtureDb();
  assert.equal(isOfficialSource("https://www.uscis.gov/newsroom/alerts/x"), true);
  assert.equal(isOfficialSource("https://www.federalregister.gov/d/2026-0001"), true);
  assert.equal(isOfficialSource("https://www.courtlistener.com/docket/1/x/"), true);
  assert.equal(isOfficialSource("https://immigration-blog.example/news"), false);
  assert.equal(isOfficialSource("http://www.uscis.gov/x"), false, "https only");
  assert.equal(isOfficialSource("https://uscis.gov.example.com/x"), false);
  assert.equal(addWhatChanged(db, { happenedOn: "2026-10-01", text: "A synthetic rule took effect for testing only.", sourceUrl: "https://blog.example/x" }).error, "not_official");
  assert.equal(addWhatChanged(db, { happenedOn: "10/01/2026", text: "A synthetic rule took effect.", sourceUrl: "https://www.uscis.gov/x" }).error, "bad_date");
  const a = addWhatChanged(db, { happenedOn: "2026-09-01", text: "Synthetic fact one, for the test.", sourceUrl: "https://www.uscis.gov/a", sourceName: "USCIS" });
  const b = addWhatChanged(db, { happenedOn: "2026-10-01", text: "Synthetic fact two, for the test.", sourceUrl: "https://www.dol.gov/b" });
  assert.ok(a.ok && b.ok);
  const l = listWhatChanged(db);
  assert.deepEqual(l.items.map(i => [i.happenedOn, i.sourceName]), [["2026-10-01", "www.dol.gov"], ["2026-09-01", "USCIS"]]);
  assert.equal(l.notice, NOT_LEGAL_ADVICE);
  assert.equal(NOT_LEGAL_ADVICE, "Not legal advice — confirm with your DSO or an immigration attorney.");
  assert.equal(removeWhatChanged(db, b.id), true);
  assert.equal(listWhatChanged(db).items.length, 1);
});
