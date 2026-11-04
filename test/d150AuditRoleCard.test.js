// ⭐ D150 T04 · THE AUDIT'S ROLE CARD FROM OUR DATA — pay p25–p75 only over ≥ 20 postings that state it, the most-asked
// must-haves by D123's job-block rule (a skill named only under nice-to-have is not a must-have), counted and dated, the
// roles offered only with live questions AND ≥ 30 open postings. Synthetic companies and postings; an in-memory database
// built from the migrations.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { upsertNode, setStatus } from "../services/atlas/atlasStore.js";
import { computeAtlasStats } from "../services/atlas/atlasStats.js";
import { syncAtlasPostings } from "../services/atlas/atlasLive.js";
import { importQuestions, reviewQuestion } from "../services/learn/learnQuestions.js";
import { auditRoles, roleCard, AUDIT_CARD, MARKET_SAID } from "../services/audit/auditRoleCard.js";

const NOW = 1_800_000_000;
let seq = 0;
function board({ postings = 40, withPay = 25, niceOnlyDocker = true, level = "mid" } = {}) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  for (const [kind, name] of [["role", "Data Engineer"], ["skill", "Python"], ["skill", "SQL"], ["tool", "Docker"], ["tool", "Airflow"]]) {
    upsertNode(db, { kind, name, source: "registry" });
    setStatus(db, db.prepare(`SELECT slug FROM atlas_nodes WHERE name = ?`).pluck().get(name), "published");
  }
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, _hash, title, company, url, description, is_active, level_read,
    salary_min_usd, salary_max_usd, discovered_at) VALUES (?,?,?,?,?,?,?,1,?,?,?,?)`);
  for (let i = 0; i < postings; i++) {
    const id = `a${++seq}`;
    // Every posting asks for Python and SQL; Airflow in half; Docker in every one, but (niceOnlyDocker) ONLY under "Nice to have".
    // Distinct sentences per posting: the matcher discounts a company's repeated sentences as boilerplate.
    // Headings on their own lines, as real postings have them (postingMatcher.js reads skills from the sections).
    const text = `Requirements:\nPython and SQL for pipeline number ${i}.${i % 2 ? ` You will run Airflow job ${i}.` : ""}${niceOnlyDocker ? "" : ` Docker is required for role ${i}.`}\n\nNice to have:\nDocker streaming experience on team ${i}.`;
    const pay = i < withPay ? 100000 + i * 2000 : null;
    ins.run(id, "q", `h${id}`, "Data Engineer", "Co", `https://x.test/${id}`,
      text, level, pay, pay ? pay + 20000 : null, i < 5 ? NOW - 86400 : NOW - 30 * 86400);
  }
  computeAtlasStats(db, { now: 1000 });
  syncAtlasPostings(db);
  const slug = db.prepare(`SELECT slug FROM atlas_nodes WHERE name = 'Data Engineer'`).pluck().get();
  return { db, slug };
}
const liveItem = (db) => {
  importQuestions(db, { version: 1, note: "t", items: [{ id: "de-1", role: "Data Engineer", level: "mid", type: "scenario", skills: [], pieces: [],
    stem: "A synthetic data pipeline scenario question?", choices: ["a", "b"], correct: 0, why: ["yes", "no"] }] }, { apply: true });
  reviewQuestion(db, "de-1", { action: "approve", reviewer: "owner" });
};

test("D150 · t04PayHiddenUnderTwenty — p25–p75 over the postings that state pay; hidden, with the reason, under 20", () => {
  const shown = board({ withPay: 25 });
  const c = roleCard(shown.db, shown.slug, { now: NOW });
  assert.equal(c.payRange.n, 25);
  assert.ok(c.payRange.p25Usd < c.payRange.p75Usd);
  assert.equal(c.payRange.hidden, undefined);
  const hidden = board({ withPay: AUDIT_CARD.MIN_PAY - 1 });
  const h = roleCard(hidden.db, hidden.slug, { now: NOW });
  assert.equal(h.payRange.hidden, true);
  assert.equal(h.payRange.p25Usd, undefined, "no figure at all under 20");
  assert.match(h.payRange.why, /at least 20/);
});

test("D150 · t04RequirementsFromJobBlock — a skill named only as nice-to-have is not a must-have", () => {
  const { db, slug } = board();
  const req = roleCard(db, slug, { now: NOW }).topRequirements;
  assert.deepEqual(req.map(r => r.name), ["Python", "SQL", "Airflow"], JSON.stringify(req));
  assert.equal(req[0].share, 100);
  assert.equal(req[2].share, 50);
  const required = board({ niceOnlyDocker: false });
  const reqd = roleCard(required.db, required.slug, { now: NOW }).topRequirements;
  assert.ok(reqd.some(r => r.name === "Docker"), `required in the body → a must-have: ${JSON.stringify(reqd)}`);
});

test("D150 · t04DatedAndCounted — open postings, new this week, the date, and the market sentence", () => {
  const { db, slug } = board({ postings: 40 });
  const c = roleCard(db, slug, { now: NOW });
  assert.equal(c.openThisWeek, 40);
  assert.equal(c.newThisWeek, 5);
  assert.equal(c.asOf, new Date(NOW * 1000).toISOString().slice(0, 10));
  assert.equal(c.said, MARKET_SAID(40));
  assert.match(c.said, /not a promise/);
  assert.equal(roleCard(db, slug, { level: "senior", now: NOW }).openThisWeek, 0, "the level filter reads the posting's own level");
  assert.equal(roleCard(db, "no-such-role", { now: NOW }), null);
});

test("D150 T04 · auditRoles — only roles with LIVE questions and ≥ 30 open postings", () => {
  const { db } = board({ postings: 40 });
  assert.deepEqual(auditRoles(db), [], "no live question yet");
  liveItem(db);
  const r = auditRoles(db);
  assert.equal(r.length, 1);
  assert.equal(r[0].title, "Data Engineer");
  assert.equal(r[0].openPostings, 40);
  const thin = board({ postings: AUDIT_CARD.MIN_POSTINGS - 1 });
  liveItem(thin.db);
  assert.deepEqual(auditRoles(thin.db), [], "under 30 open postings — not offered");
  const s = fs.readFileSync("server.js", "utf8");
  assert.match(s, /app\.get\("\/api\/audit\/roles", \(req, res\)/);
  assert.match(s, /app\.get\("\/api\/audit\/role\/:slug", \(req, res\)/);
});
