// D185-6 (45q, owner 11-09) · the beachhead's landing pages: "<role> jobs at companies that sponsor H-1B (in <city>)" —
// only employers with certified H-1B filings (D121's one signal), their DOL history on the page, a real 404 under MIN_JOBS.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { renderLandingPage, landingData, landingSitemapRoutes, MIN_JOBS } from "../services/jobs/landingPages.js";

function world() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare(`INSERT INTO lca_source_files (file_name, fiscal_period, fiscal_year, fiscal_quarter, ingested_at, source_url) VALUES (?,?,?,?,1,?)`)
    .run("LCA_FY2025_Q4.xlsx", "FY2025Q4", 2025, 4, "https://www.dol.gov/x/LCA_Disclosure_Data_FY2025_Q4.xlsx");
  const years = JSON.stringify(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(2015 + i), 40])));
  db.prepare(`INSERT INTO company_lca_sponsorship (company, match_status, match_confidence, by_fiscal_year_json, certified_total, latest_period, first_seen, last_seen)
    VALUES ('Sponsorco', 'matched', 0.95, ?, 812, 'FY2025Q4', 1, 1)`).run(years);
  return db;
}
let id = 0;
function post(db, { company, metro = null, sub = "swe.backend" }) {
  const jobId = `j${++id}`;
  db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, board_category, discovered_at)
    VALUES (?, 'q', ?, 'Backend Engineer', ?, 1, 'software-engineering', 1)`).run(jobId, company, jobId);
  db.prepare("INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, 'software-engineering', ?, 'v1', 1)").run(jobId, sub);
  if (metro) db.prepare("INSERT INTO job_tag_places (job_id, country, metro) VALUES (?, 'US', ?)").run(jobId, metro);
}

test("d185SponsorPagesMinimumCount: under MIN_JOBS sponsor postings the page is a real 404 (noindex), however many others exist", () => {
  const db = world();
  for (let i = 0; i < MIN_JOBS - 1; i++) post(db, { company: "Sponsorco" });
  for (let i = 0; i < 30; i++) post(db, { company: "Plainco" });          // no filing record — never counted
  const page = renderLandingPage(db, "sponsor", { role: "swe.backend" }, { base: "https://draft.example" });
  assert.equal(page.status, 404);
  assert.match(page.html, /noindex/);
  assert.ok(!landingSitemapRoutes(db).some(r => r.path.startsWith("/jobs/sponsor-h1b/")), "a thin page is not in the sitemap");
});

test("d185SponsorPagesMinimumCount: at MIN_JOBS it renders — only sponsors' postings, their DOL history, not legal advice, in the sitemap", () => {
  const db = world();
  for (let i = 0; i < MIN_JOBS; i++) post(db, { company: "Sponsorco", metro: "boston" });
  for (let i = 0; i < 5; i++) post(db, { company: "Plainco", metro: "boston" });
  const d = landingData(db, "sponsor", { role: "swe.backend" });
  assert.equal(d.total, MIN_JOBS);
  assert.ok(d.rows.every(r => r.company === "Sponsorco"));
  const page = renderLandingPage(db, "sponsor", { role: "swe.backend" }, { base: "https://draft.example" });
  assert.equal(page.status, 200);
  assert.match(page.html, /Backend[^<]* jobs at companies that sponsor H-1B/);
  assert.match(page.html, /Their H-1B filing history/);
  assert.match(page.html, /812 certified H-1B filings/);
  assert.match(page.html, /Department of Labor/);
  assert.match(page.html, /Not legal advice/);
  assert.ok(!page.html.includes("Plainco"));
  assert.match(page.html, /company_sponsorship=filed/, "Browse all opens the board with its own sponsorship filter");
  const metro = renderLandingPage(db, "sponsor-metro", { role: "swe.backend", metro: "boston" }, { base: "https://draft.example" });
  assert.equal(metro.status, 200);
  assert.match(metro.html, /sponsor H-1B in Boston/i);
  const paths = landingSitemapRoutes(db).map(r => r.path);
  assert.ok(paths.includes("/jobs/sponsor-h1b/swe.backend"));
  assert.ok(paths.includes("/jobs/sponsor-h1b/swe.backend/in/boston"));
  assert.equal(renderLandingPage(db, "sponsor", { role: "not-a-role" }, { base: "x" }).status, 404);
});

test("d185SponsorPagesMinimumCount: routed before the posting pages", () => {
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const a = server.indexOf('app.get("/jobs/sponsor-h1b/:id"'), b = server.indexOf('app.get("/jobs/:slug"');
  assert.ok(a > 0 && b > 0 && a < b);
  assert.ok(server.includes('app.get("/jobs/sponsor-h1b/:id/in/:metro"'));
});
