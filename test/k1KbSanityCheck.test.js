import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { at } from "../test-support/sourceAnchors.js";
import { kbSanityCheck, validateResumeClaims, resetLocationVocabulary, K1_CANNOT_CATCH } from "../services/kb/failsafe.js";

/**
 * K1 — the KB sanity check on generated output (RECRUITER_LAYER_EXECUTION.md §K1).
 *
 * ACCEPTANCE IS BOTH DIRECTIONS, and the second is the one that costs trust:
 *   1. the G1 document — teams invented at Stripe — must flag;
 *   2. a TRUE résumé — Stripe, Payments Infrastructure, Bangalore, GCP Pub/Sub — must flag NOTHING,
 *      on an entry the KB actually holds (a clean result over an employer it does not know proves
 *      nothing). The Bangalore precedent is exactly this failure.
 * The real-KB version of both is `node scripts/k1KbSanityCheck.mjs --verify`.
 *
 * The KB here mirrors what Stripe's real rows hold where it matters: Risk units exist, Kafka is in
 * the technographics, GCP Pub/Sub is NOT, and some technographics rows are not technologies at all.
 */
function kb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE company_org_units (company TEXT, org_unit TEXT, confidence REAL, status TEXT);
    CREATE TABLE company_technographics (company TEXT, skill TEXT, weight REAL, last_seen INTEGER, posting_count INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, location TEXT, workplace_type TEXT);
  `);
  const unit = db.prepare("INSERT INTO company_org_units VALUES (?,?,?,?)");
  for (const [u, c] of [["Payments", 0.9], ["Risk Operations", 0.8], ["Payments and Risk", 0.7], ["Infrastructure", 0.2]]) {
    unit.run("Stripe", u, c, c >= 0.5 ? "confirmed" : "proposed");
  }
  const tech = db.prepare("INSERT INTO company_technographics VALUES (?,?,?,?,?)");
  for (const [s, n] of [["Kafka", 12], ["Go", 23], ["Python", 33], ["Java", 33], ["AWS", 24], ["financial reporting", 2], ["APIs", 7]]) {
    tech.run("Stripe", s, n, 0, n);
  }
  db.prepare("INSERT INTO scraped_jobs VALUES (?,?,?)").run("j1", "Bangalore", "onsite");
  return db;
}

test.beforeEach(() => resetLocationVocabulary());

const SOURCE = "JANE Q SAMPLE\nEXPERIENCE\nStripe — Software Engineer, 2021–2025\n- Built payment services in Go handling 2k requests/second\n- Designed PostgreSQL schemas for ledger reconciliation\nTECHNICAL SKILLS\nGo, PostgreSQL, Docker, AWS";

const generated = (bullets, { meta = "Austin, TX", skills = "" } = {}) => `<html><body>
${skills ? `<div class="section-title">TECHNICAL SKILLS</div><ul class="bullets"><li><strong>Tools</strong> ${skills}</li></ul>` : ""}
<div class="section-title">EXPERIENCE</div>
<div class="entry"><div class="entry-header"><div><span class="entry-org">Stripe</span> <span class="entry-meta"><span class="sep">|</span> ${meta}</span></div><div class="entry-date">2021 - 2025</div></div>
<div class="entry-role">Software Engineer</div>
<ul class="bullets">${bullets.map(b => `<li>${b}</li>`).join("")}</ul></div></body></html>`;

test("K1 direction 1: the G1 document's invented teams at Stripe are flagged", () => {
  // The second G1 document's bullet, verbatim.
  const r = kbSanityCheck(kb(), generated([
    "Built payment processing services in Go that sustained 2,000 requests/second",
    "Collaborated with risk and infrastructure teams to align service APIs with fraud-detection data requirements",
  ]), { baseResumeText: SOURCE });
  const claims = r.findings.map(f => f.claim.toLowerCase());
  assert.deepEqual(claims.sort(), ["infrastructure", "risk"], JSON.stringify(r.findings));
  // ⭐ The KB's part: it does NOT say "no such team" — Stripe has a Risk team. It says plausible,
  // and unsourced. A KB-only check would have had nothing to say about this line at all.
  const risk = r.findings.find(f => f.claim === "risk");
  assert.equal(risk.kb.plausible, true);
  assert.match(risk.message, /not in your source résumé/);
});

test("K1 direction 1: a technology the employer uses, claimed AT it, unsourced, is flagged", () => {
  const r = kbSanityCheck(kb(), generated(["Built event pipelines on Kafka for ledger reconciliation"]), { baseResumeText: SOURCE });
  assert.deepEqual(r.findings.map(f => [f.kind, f.claim]), [["technology", "Kafka"]]);
});

test("K1 direction 2: a TRUE résumé flags NOTHING — Stripe, Payments Infrastructure, Bangalore, GCP Pub/Sub", () => {
  // The owner's shape. GCP Pub/Sub is NOT in the KB's Stripe rows, and "Payments Infrastructure" is
  // not a unit — an absence check would flag both, against claims that are true.
  const source = "SRI\nEXPERIENCE\nStripe — Software Development Engineer\nPayments Infrastructure, Bangalore\nAug 2022 – Dec 2023\n" +
    "- Developed RESTful web services using Python and Go\n- Designed fault-tolerant distributed systems using GCP Pub/Sub\n";
  const r = kbSanityCheck(kb(), generated([
    "Developed and maintained RESTful web services using <b>Python</b> and <b>Go</b>",
    "Designed fault-tolerant distributed systems using GCP Pub/Sub for event streaming",
  ], { meta: "Payments Infrastructure, Bangalore" }), { baseResumeText: source });
  assert.deepEqual(r.findings, []);
  assert.ok(r.checked.entriesWithKb > 0 && r.checked.teams > 0 && r.checked.technologies > 0,
    `a clean result must come from claims that were CHECKED: ${JSON.stringify(r.checked)}`);
  // And the same résumé run as its own generation — the text form, where the team line is the role.
  const asItself = kbSanityCheck(kb(), source, { baseResumeText: source });
  assert.deepEqual(asItself.findings, []);
  assert.ok(asItself.checked.teams > 0, JSON.stringify(asItself.checked));
});

test("K1: Bangalore is a place — never a team claim, sourced or not", () => {
  const r = kbSanityCheck(kb(), generated(["Built payment services in Go"], { meta: "Payments, Bangalore" }), { baseResumeText: SOURCE });
  assert.ok(!r.findings.some(f => /bangalore/i.test(f.claim)), JSON.stringify(r.findings));
});

test("K1: a technographics row that is not a TOOL is never called a technology", () => {
  // Stripe's real rows include "financial reporting" and "APIs"; the first run flagged both.
  const r = kbSanityCheck(kb(), generated(["Kept financial reporting accurate across service APIs"]), { baseResumeText: SOURCE });
  assert.deepEqual(r.findings, []);
});

test("K1 LIMIT: Kafka in the skills list is not a company claim, and is not flagged", () => {
  // Stated, not hidden: the owner's own words — "Kafka" is not a company fact.
  const r = kbSanityCheck(kb(), generated(["Built payment services in Go"], { skills: "Go · Kafka" }), { baseResumeText: SOURCE });
  assert.deepEqual(r.findings, []);
  assert.ok(r.cannotCatch.some(l => /skills section/.test(l)));
  assert.equal(r.cannotCatch, K1_CANNOT_CATCH, "every result carries what it cannot catch");
});

test("K1: no source résumé, no verdict — it declines rather than flag every claim", () => {
  const r = kbSanityCheck(kb(), generated(["Collaborated with risk teams on Kafka"]), { baseResumeText: "" });
  assert.equal(r.declined, "no_source_resume");
  assert.deepEqual(r.findings, []);
});

test("K1: an employer the KB does not hold is silent", () => {
  const html = generated(["Collaborated with risk teams on Kafka"]).replace(">Stripe<", ">Acme Corp<");
  const r = kbSanityCheck(kb(), html, { baseResumeText: SOURCE });
  assert.deepEqual(r.findings, []);
  assert.equal(r.checked.entriesWithKb, 0);
});

test("K1 is DECOUPLED (OWNER 30): nothing on the generation path calls it, and the 9.6 check is unchanged", () => {
  const server = fs.readFileSync("server.js", "utf8");
  assert.doesNotMatch(server, /kbSanityCheck/, "wiring K1 into generation is a separate, later decision");
  for (const dir of ["routes", "services"]) {
    for (const f of fs.readdirSync(dir, { recursive: true }).filter(n => String(n).endsWith(".js"))) {
      const p = `${dir}/${f}`.replace(/\\/g, "/");
      if (p === "services/kb/failsafe.js") continue;
      assert.doesNotMatch(fs.readFileSync(p, "utf8"), /kbSanityCheck/, `${p} must not call K1`);
    }
  }
  // The generation path's own check says nothing new about the G1 line — K1 did not change it.
  const before = validateResumeClaims(kb(), generated(["Collaborated with risk and infrastructure teams"]));
  assert.deepEqual(before, []);
});

test("K1 never writes: the KB grows from company-emitted data only", () => {
  const src = fs.readFileSync("services/kb/failsafe.js", "utf8");
  const k1 = src.slice(at(src, "K1 — THE KB SANITY CHECK"));
  assert.doesNotMatch(k1, /\b(INSERT|UPDATE|DELETE|REPLACE)\b/);
});
