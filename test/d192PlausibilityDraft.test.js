// ⭐ D192 (4d) · draft's half of CLAIM PLAUSIBILITY (owner 11-14: "does this add up?"): each employer resolved to its record
// (services/entities.js), what draft knows about it handed to the scorer's checks, the person's dismissals kept across
// re-scores (migration 277), the tailored résumé checked as HTML, and the routes / merge plan wired.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { plausibilityFor, dismissFlag, companyFacts } from "../services/atsPlausibility.js";
import { at } from "../test-support/sourceAnchors.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");
const NOW = Math.floor(Date.now() / 1000);

function fixture() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE companies (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, domain TEXT, parent_id INTEGER);
    CREATE TABLE company_aliases (alias_key TEXT PRIMARY KEY, company_id INTEGER, evidence TEXT, created_at INTEGER);
    CREATE TABLE company_facts (company_id INTEGER PRIMARY KEY, wikidata_id TEXT, industry TEXT, hq TEXT, founded INTEGER, employees INTEGER, status TEXT, fetched_at INTEGER);
    CREATE TABLE company_tech (company_id INTEGER, tech TEXT, grp TEXT, postings INTEGER, first_seen INTEGER, last_seen INTEGER, teams_json TEXT, computed_at INTEGER, PRIMARY KEY (company_id, tech));
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, is_active INTEGER, discovered_at INTEGER, retired_at INTEGER);
    CREATE TABLE job_company (job_id TEXT PRIMARY KEY, company_id INTEGER);
    CREATE TABLE job_taxonomy (job_id TEXT PRIMARY KEY, category TEXT, subcategory TEXT, confidence REAL, reason TEXT, version TEXT, classified_at INTEGER);
    CREATE TABLE ats_flag_dismissals (user_id INTEGER NOT NULL, flag_key TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (user_id, flag_key)) WITHOUT ROWID;
  `);
  db.prepare(`INSERT INTO companies (id, slug, name) VALUES (1, 'kestrel-ml', 'Kestrel ML')`).run();
  db.prepare(`INSERT INTO company_aliases (alias_key, company_id, evidence) VALUES ('name:kestrelml', 1, 'name')`).run();
  db.prepare(`INSERT INTO company_facts (company_id, industry, employees, status, fetched_at) VALUES (1, 'machine learning', 40, 'ok', ?)`).run(NOW);
  for (let i = 0; i < 22; i++) {
    db.prepare(`INSERT INTO scraped_jobs VALUES (?, 1, ?, NULL)`).run(`k${i}`, NOW - 86400);
    db.prepare(`INSERT INTO job_company VALUES (?, 1)`).run(`k${i}`);
    db.prepare(`INSERT INTO job_taxonomy (job_id, category, subcategory, version, classified_at) VALUES (?, ?, ?, '1', ?)`).run(`k${i}`, i % 2 ? "data-ai" : "software-engineering", "x", NOW);
  }
  const tech = db.prepare(`INSERT INTO company_tech VALUES (1, ?, ?, ?, ?, ?, '[]', ?)`);
  for (const [t, g, n] of [["PyTorch", "ml-ai", 18], ["Python", "languages", 20], ["Kubernetes", "devops", 9], ["Go", "languages", 6]]) tech.run(t, g, n, NOW - 86400 * 200, NOW, NOW);
  return db;
}
const RESUME = `Experience
Machine Learning Engineer — Kestrel ML
Jan 2021 – Dec 2023
- Trained models in PyTorch and served them on Kubernetes
- Designed a sales incentive compensation model for the field team
- Integrated Salesforce for the revenue team
Engineer — Unknown Startup
2016 – 2018
- Built services in Go`;

test("draft's facts for an employer: its stack with evidence, the families its postings are in, its industry and size", () => {
  const f = companyFacts(fixture(), 1, NOW);
  assert.equal(f.name, "Kestrel ML");
  assert.deepEqual(f.stack.map(s => s.tech).sort(), ["Go", "Kubernetes", "PyTorch", "Python"]);
  assert.deepEqual(f.families, { "data-ai": 11, "software-engineering": 11 });
  assert.deepEqual([f.industry, f.employees], ["machine learning", 40]);
});

test("the sales-incentive bullet at an ML company — the owner's example — is flagged; PyTorch and Kubernetes are confirmed; the unknown employer is no data", () => {
  const r = plausibilityFor(fixture(), { userId: 7, text: RESUME, asOf: 2026 });
  const k = r.entries.find(e => e.employer === "Kestrel ML");
  assert.deepEqual(k.confirmed.map(c => c.tech).sort(), ["Kubernetes", "PyTorch"]);
  assert.ok(k.flags.some(f => f.kind === "domain" && /describes sales, but Kestrel ML's 22 postings are in other kinds of work/.test(f.reason)));
  assert.ok(k.flags.some(f => f.kind === "tech" && f.tech === "Salesforce"), "Salesforce at an ML company with a known stack");
  assert.equal(r.entries.find(e => /Unknown Startup/.test(e.header)).status, "no_data");
  assert.equal(r.flags, k.flags.length);
});

test("d192DismissedFlagStays — a dismissed flag stays dismissed across re-scores; undo brings it back", () => {
  const db = fixture();
  const first = plausibilityFor(db, { userId: 7, text: RESUME, asOf: 2026 });
  const target = first.entries[0].flags.find(f => f.kind === "domain");
  dismissFlag(db, 7, target.key);
  const again = plausibilityFor(db, { userId: 7, text: RESUME, asOf: 2026 });
  assert.ok(!again.entries[0].flags.some(f => f.key === target.key));
  assert.equal(again.dismissed, 1);
  assert.ok(plausibilityFor(db, { userId: 8, text: RESUME, asOf: 2026 }).entries[0].flags.some(f => f.key === target.key), "another person's dismissal is theirs");
  dismissFlag(db, 7, target.key, { undo: true });
  assert.ok(plausibilityFor(db, { userId: 7, text: RESUME, asOf: 2026 }).entries[0].flags.some(f => f.key === target.key));
  assert.throws(() => dismissFlag(db, 7, ""), /A flag key is required/);
});

test("d192TailoredBulletChecked — a tailored résumé (HTML) is checked on its RESULT, the same way", () => {
  const html = `<div class="section-title">EXPERIENCE</div><div class="entry"><div>Machine Learning Engineer — Kestrel ML</div><div>Jan 2021 – Dec 2023</div>
    <ul class="bullets"><li>Trained models in PyTorch</li><li>Designed a sales incentive compensation model for the field team</li></ul></div>`;
  const r = plausibilityFor(fixture(), { userId: 7, html, asOf: 2026 });
  assert.ok(r.entries[0].flags.some(f => f.kind === "domain"), "the bullet the tailoring wrote is caught before it is sent");
  assert.deepEqual(r.entries[0].confirmed.map(c => c.tech), ["PyTorch"]);
});

test("wired: the routes, the merge plan, migration 277 in both runners, and no score reads it", () => {
  const s = read("server.js");
  assert.match(s, /app\.get\("\/api\/resume\/plausibility", requireAuth,/);
  assert.match(s, /db\.prepare\("SELECT html FROM resumes WHERE id = \? AND user_id = \?"\)\.get\(Number\(req\.params\.id\), req\.user\.id\)/, "only the person's own résumé");
  assert.match(s, /app\.post\("\/api\/resume\/plausibility\/dismiss", requireAuth,/);
  assert.match(read("services/accountService.js"), /ats_flag_dismissals: "keepInto",/);
  for (const f of ["server.js", "scripts/migrations.js"]) assert.match(read(f), /id: "277_ats_flag_dismissals",/);
  for (const f of ["shared/contextualView.js", "services/localAtsScorer.js"]) assert.doesNotMatch(read(f), /plausibility/i, `${f} reads plausibility`);
  const ctx = read("services/atsContextual.js");
  const scoring = ctx.slice(at(ctx, "export function contextualFor("));
  assert.doesNotMatch(scoring, /plausib|companyFacts/i, "the contextual score reads no plausibility (the public stack borrows only companyFacts)");
  const flags = read("client/src/components/PlausibilityFlags.jsx");
  assert.match(flags, /api\("\/api\/resume\/plausibility\/dismiss", \{ method: "POST", body: JSON\.stringify\(\{ key \}\) \}\)/);
  assert.doesNotMatch(flags, /#[0-9a-fA-F]{3,6}\b|rgba?\(/, "tokens only");
  // D202 (47h, the owner's yes — moved on purpose): the classic ATS card (components/AtsCard.jsx) is retired; the match panel draws FitCard — the check sits on its Context tab
  assert.match(read("client/src/plate/FitCard.jsx"), /api\("\/api\/resume\/plausibility"\)/);
  assert.match(read("client/src/plate/FitCard.jsx"), /<PlausibilityFlags data=\{plausibility\}/);
  assert.match(read("client/src/panels/AutoApplyPanel.jsx"), /<PlausibilityFlags src=\{`\/api\/resumes\/\$\{encodeURIComponent\(node\.ref\.resume\.artifactId\)\}\/plausibility`\} title="Does the tailored résumé add up\?" \/>/);
});
