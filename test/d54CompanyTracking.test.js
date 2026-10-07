// D54 (owner, 10-07) — COMPANY-WISE TRACKING: never apply into the same company twice without knowing.
//
// Keyed by a stable identity, never the display string (shared/companyIdentity.js): the same ATS board,
// the same domain, the same normalised name (unless two known domains differ), or the same slug on a
// different ATS with agreeing names. Measured before building on the local board: no cross-board name
// collisions, and Workable's /j/ URLs carry no company slug — so they never act as a board key.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { listHistory, markPending, releaseDraftRecord } from "../services/applicationRecords.js";
import { companyBoardOf, companyNameKey, companyNotice, companyRows, companySummary, groupCompanies, matchCompany }
  from "../shared/companyIdentity.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function fixture() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  const post = db.prepare("INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,is_active) VALUES (?,?,?,?,?,'t',?,1)");
  return { db, post: (id, title, company, url) => post.run(id, title, company, url, url, `h-${id}`) };
}

test("D54 · the board key is the URL's own company slug — and Workable's /j/ links have none", () => {
  assert.equal(companyBoardOf("https://boards.greenhouse.io/stripe/jobs/1"), "greenhouse:stripe");
  assert.equal(companyBoardOf("https://boards.greenhouse.io/embed/job_app?for=stripe&token=1"), "greenhouse:stripe");
  assert.equal(companyBoardOf("https://jobs.lever.co/spotify/abc"), "lever:spotify");
  assert.equal(companyBoardOf("https://jobs.ashbyhq.com/notion/x"), "ashby:notion");
  assert.equal(companyBoardOf("https://apply.workable.com/j/B0D0ACB369"), null, "measured: three companies shared `workable:j`");
  assert.equal(companyBoardOf("http://127.0.0.1:4599/greenhouse"), null);
  assert.equal(companyNameKey("Stripe, Inc."), "stripe");
  assert.equal(companyNameKey("Scale AI"), "scaleai", "AI is part of a name, not a suffix");
});

test("D54 · two jobs at one company on DIFFERENT boards are ONE company row", () => {
  const t = fixture();
  t.post("gh::1", "Backend Engineer", "Scale AI", "https://boards.greenhouse.io/scaleai/jobs/1");
  t.post("ashby::2", "ML Engineer", "Scale", "https://jobs.ashbyhq.com/scaleai/2");
  t.post("lever::3", "Data Engineer", "Scale AI", "https://jobs.lever.co/scaleai-careers/3");
  for (const id of ["gh::1", "ashby::2", "lever::3"]) markPending(t.db, 1, id, "drafted");
  const groups = companyRows(listHistory(t.db, 1));
  assert.equal(groups.length, 1, JSON.stringify(groups.map(g => [g.key, g.roles.map(r => r.jobId)])));
  assert.equal(groups[0].name, "Scale AI");
  assert.equal(companySummary(groups[0]), "3 roles: 3 in play");
});

test("D54 · two DIFFERENT companies that share a name stay separate", () => {
  const t = fixture();
  t.post("gh::m1", "Engineer", "Mercury", "https://boards.greenhouse.io/mercury/jobs/1");
  t.post("lever::m2", "Engineer", "Mercury", "https://jobs.lever.co/mercurysystems/2");
  t.db.prepare("INSERT INTO company_logos (company_key, company, domain, status, checked_at) VALUES ('mercury','Mercury','mercury.com','ok',1)").run();
  // The logo store knows one domain for the name; the second employer is told apart by its own domain.
  const { groups } = groupCompanies([
    { id: "gh::m1", company: "Mercury", url: "https://boards.greenhouse.io/mercury/jobs/1", domain: "mercury.com" },
    { id: "lever::m2", company: "Mercury", url: "https://jobs.lever.co/mercurysystems/2", domain: "mrcy.com" },
  ]);
  assert.equal(groups.length, 2);
  // And a shared slug alone does not merge two employers whose names disagree.
  assert.equal(groupCompanies([
    { id: 1, company: "Mercury", url: "https://boards.greenhouse.io/acme/jobs/1" },
    { id: 2, company: "Notion", url: "https://jobs.lever.co/acme/2" },
  ]).groups.length, 2);
});

test("D54 · drafting a second role at a company SHOWS THE NOTICE — never silent, never a block", () => {
  const rows = [
    { jobId: "a", company: "Scale AI", applyUrl: "https://boards.greenhouse.io/scaleai/jobs/1", status: "sent", sentAt: Date.UTC(2026, 8, 28) / 1000, companyKey: "n:scaleai", companyName: "Scale AI" },
    { jobId: "b", company: "Scale AI", applyUrl: "https://jobs.lever.co/scaleai/2", status: "in_play", origin: "drafted", companyKey: "n:scaleai", companyName: "Scale AI" },
  ];
  const groups = companyRows(rows);
  const members = new Map(groups.map(g => [g.key, g.roles.map(r => ({ company: r.company, url: r.applyUrl }))]));
  const key = matchCompany({ company: "Scale", url: "https://jobs.ashbyhq.com/scaleai/9" }, members);
  assert.equal(key, "n:scaleai", "matched by the slug on another ATS, the names agreeing");
  assert.equal(companyNotice(groups[0], "Scale"),
    "You already have 2 roles at Scale AI — 1 sent 28 Sep, 1 queued. Draft this one too?");
  assert.equal(companyNotice({ name: "X", roles: [{ status: "closed" }] }), null, "nothing active or sent: no notice");
  // The board asks, and goes on if the user says yes — the confirm is the whole gate.
  const panel = read("client/src/panels/JobsPanel.jsx");
  const decide = panel.slice(at(panel, "const decideJob = useCallback("), at(panel, "const undoLastDecision = useCallback("));
  assert.match(decide, /const notice = companyNoticeFor\(job\);\n\s+if \(notice && !window\.confirm\(notice\)\) return;/);
  assert.match(read("client/src/components/JobDetailPanel.jsx"), /data-company-notice=""/, "the panel says it before the click");
});

test("D54 · the By-company counts equal the List view's rows, grouped", () => {
  const t = fixture();
  t.post("gh::s1", "A", "Stripe", "https://boards.greenhouse.io/stripe/jobs/1");
  t.post("gh::s2", "B", "Stripe, Inc.", "https://boards.greenhouse.io/stripe/jobs/2");
  t.post("lever::n1", "C", "Notion", "https://jobs.lever.co/notion/1");
  for (const id of ["gh::s1", "gh::s2", "lever::n1"]) markPending(t.db, 1, id, "drafted");
  const list = listHistory(t.db, 1);
  const groups = companyRows(list);
  assert.equal(groups.reduce((n, g) => n + g.roles.length, 0), list.length);
  const byKey = new Map(); for (const r of list) byKey.set(r.companyKey, (byKey.get(r.companyKey) || 0) + 1);
  for (const g of groups) assert.equal(g.roles.length, byKey.get(g.key));
  assert.equal(groups.length, 2, "Stripe and Stripe, Inc. are one");
});

test("D54 · a deleted posting's application STILL appears, under its company (D43)", () => {
  const t = fixture();
  t.db.prepare(`INSERT INTO job_applications (user_id, job_id, company, role, job_url, applied_at)
    VALUES (1, 'gh::gone', 'Northwind', 'Engineer', 'https://boards.greenhouse.io/northwind/jobs/9', 1790000000)`).run();
  const row = listHistory(t.db, 1).find(r => r.jobId === "gh::gone");
  assert.ok(row, "the sent application vanished with its posting");
  assert.equal(row.postingListed, false);
  assert.equal(row.companyName, "Northwind");
  assert.equal(companyRows([row])[0].counts.sent, 1);
  // A drafted one whose posting is gone keeps its company from the run-job's own snapshot.
  const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (1,'auto','completed',1)").run().lastInsertRowid;
  t.db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,posting_company,posting_title) VALUES (?,1,'ashby::gone','held_review','Acme','PM')").run(run);
  markPending(t.db, 1, "ashby::gone", "drafted");
  assert.equal(listHistory(t.db, 1).find(r => r.jobId === "ashby::gone")?.companyName, "Acme");
});

test("D54 · clearing a queued item removes it from its company's row", () => {
  const t = fixture();
  t.post("gh::q1", "A", "Stripe", "https://boards.greenhouse.io/stripe/jobs/1");
  t.post("gh::q2", "B", "Stripe", "https://boards.greenhouse.io/stripe/jobs/2");
  const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (1,'auto','completed',1)").run().lastInsertRowid;
  const rj = t.db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'gh::q2','held_review')").run(run).lastInsertRowid;
  markPending(t.db, 1, "gh::q1", "drafted"); markPending(t.db, 1, "gh::q2", "drafted");
  assert.equal(companyRows(listHistory(t.db, 1))[0].roles.length, 2);
  // Cleared (D53): hidden, and its Draft record released.
  t.db.prepare("UPDATE apply_run_jobs SET hidden_at=unixepoch(), purge_after=unixepoch()+604800 WHERE id=?").run(rj);
  releaseDraftRecord(t.db, 1, "gh::q2");
  assert.equal(companyRows(listHistory(t.db, 1))[0].roles.length, 1);
});

test("D54 · The Table has List | By company, and a stopped card names the company's other applications", () => {
  const table = read("client/src/components/ApplicationHistory.jsx");
  // D55 added Board and Funnel after these two; List | By company still lead the toggle.
  assert.match(table, /\[\["list", "List"\], \["company", "By company"\],/);
  assert.match(table, /companyRows\(view\.rows\)\.map\(g =>/, "the same rows the List shows, grouped");
  const house = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(house, /return `Also at \$\{g\.name \|\| companyLabel\(row\.company\)\}: `/);
  assert.ok((house.match(/\{othersLine\(/g) || []).length >= 3, "approval, held and broke folds");
});
