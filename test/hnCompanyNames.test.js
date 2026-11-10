// 46a (owner 11-10: a candidate named "Location: Seattle OR Arlington, United States. Hybrid" on board
// workday:5|remitly|Remitly_Careers — "rectify this, probe why this happened, add a test … and probe if there are others").
// WHY: HN discovery took the post header's first "|" segment as the company. The audit (scripts/hnNameAudit46a.mjs, the 12
// monthly threads + the jobs feed, 1,465 candidates) found 89 names that were a field label, a role, a sentence or a
// place — 9 of them with an ATS board, so pooled. The cases below are those real headers (public HN posts).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { companyFromHeader, looksLikeCompany, companyFromSlug, parsePost } from "../services/jobs/hnDiscovery.js";
import { repairCandidateNames, runCandidateProbe, planApproval, PROBE_FRESH_DAYS } from "../services/companyCandidates.js";

test("the reported case: a 'Location:' first segment is never the company; the board names it", () => {
  assert.equal(companyFromHeader("Location: Seattle OR Arlington, United States. Hybrid", { atsType: "workday", slug: "5|remitly|Remitly_Careers" }), "Remitly");
  assert.equal(companyFromHeader("Location: Dallas, TX"), null, "no board → no name → the post is dropped, never pooled under a place");
  const post = parsePost("Location: Seattle OR Arlington, United States. Hybrid | Senior Software Engineer | Full-time<p>Apply: https://remitly.wd5.myworkdayjobs.com/Remitly_Careers/job/1");
  assert.equal(post.company, "Remitly");
});

test("the 9 pooled bad names from the 11-10 audit become their employers", () => {
  const cases = [
    ["NYC", { atsType: "ashby", slug: "norm-ai" }, "Norm AI"],
    ["We’re hiring at Langfuse", { atsType: "ashby", slug: "langfuse" }, "Langfuse"],
    ["Addepar/ Softare Engineering Manager/ NYC-Hybrid/ Full-time", { atsType: "greenhouse", slug: "addepar1" }, "Addepar"],
    ["Engineering Director, Developer Experience", { atsType: "greenhouse", slug: "adyen" }, "Adyen"],
    ["Senior / Staff Engineer @ Titan", { atsType: "ashby", slug: "titan" }, "Titan"],
    ["SF or Shenzhen, remote possible for exceptional candidates", { atsType: "ashby", slug: "dimensional" }, "Dimensional"],
    ["Trigger.dev , we are currently hiring for 3 roles", { atsType: "ashby", slug: "triggerdev" }, "Trigger.dev"],
    ["We are hiring at SentiLink! Fraud and identity space", { atsType: "ashby", slug: "sentilink" }, "SentiLink"],
    ["[BOTH FILLED] Brave Software", { atsType: "greenhouse", slug: "brave" }, "Brave Software"],
  ];
  for (const [h, ats, want] of cases) assert.equal(companyFromHeader(h, ats), want, h);
});

test("labels, sentences and joined parts: the name is extracted; a role, a place or a greeting is never one", () => {
  const named = [["Company: AMD", "AMD"], ["COMPANY: Tvrtle", "Tvrtle"], ["Who is hiring: BuilderBase", "BuilderBase"],
    ["Mobian is hiring Senior / Staff Engineers", "Mobian"], ["Hey HN, this is Louis, co-founder at SightlineOS", "SightlineOS"],
    ["I'm Paula, Technical Recruiter @ Modular", "Modular"], ["Founding Engineer @ Conductor", "Conductor"],
    ["Qualcomm -- Staff Kubernetes Platform Engineer -- $116,800", "Qualcomm"], ["Krea; Fulltime; Onsite, San Francisco, CA, USA", "Krea"],
    ["Docker Inc, Remote", "Docker Inc"], ["Thunder Compute, YC S24", "Thunder Compute"], ["Elide: It’s like node but reimagined on top of GraalVM", "Elide"],
    ["[LiveKit]", "LiveKit"], ["At Tether we're hiring!", "Tether"], ["CloudX we’re building a", "CloudX"]];
  for (const [h, want] of named) assert.equal(companyFromHeader(h), want, h);
  for (const h of ["Role: Engineering Manager", "Senior Software Engineer", "Founding Engineer", "Hiring: Senior Software Engineers",
    "Edit: APPLICATIONS CLOSED", "[THIS POSITION HAS BEEN FILLED]", "Pinehurst, TX", "Santa Clara, CA", "Hey HN", "Hello",
    "Audio/Video Collaboration company, worldwide", "Looking for a CTO / Tech Lead", "NYC", "Remote", "This is the team at Foo"]) {
    assert.equal(companyFromHeader(h), null, h);
  }
});

test("real names the new rule must keep — lower-case, 'The …', 'Company', domains, joined orgs", () => {
  for (const n of ["xAI", "alias", "vvd", "pod network", "The Allen Institute for AI", "Artificial Intelligence Underwriting Company",
    "This Dot Labs", "SF Sauna", "esumry.com", "Treatment Technologies & Insights", "Stripe"]) {
    assert.equal(companyFromHeader(n), n, n);
    assert.ok(looksLikeCompany(n), n);
  }
  assert.equal(companyFromHeader("Ai2 / Allen Institute for AI"), "Ai2");
  assert.equal(companyFromSlug({ atsType: "icims", slug: "careers-examplebuild" }), "Examplebuild");
  assert.equal(companyFromSlug({ atsType: "oracle", slug: "fa-x.fa.ocs.oraclecloud.com|CX_1" }), null, "an Oracle host is not a name");
});

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  return db;
}
const cand = (db, company, atsType, slug, header, status = "probed", probedAt = null) => db.prepare(`INSERT INTO company_candidates
  (company, ats_type, ats_slug, source, source_json, status, first_seen, last_seen, probed_at) VALUES (?, ?, ?, 'hn', ?, ?, unixepoch(), unixepoch(), ?)`)
  .run(company, atsType, slug, JSON.stringify({ header }), status, probedAt).lastInsertRowid;

test("the boot repair renames pooled bad names from their own header and board, rejects the rest, never touches decided rows", () => {
  const db = db0();
  const remitly = cand(db, "Location: Seattle OR Arlington, United States. Hybrid", "workday", "5|remitly|Remitly_Careers", "Location: Seattle OR Arlington, United States. Hybrid | SWE");
  const label = cand(db, "Role: Engineering Manager", "oracle", "fa-x.fa.ocs.oraclecloud.com|CX_1", "Role: Engineering Manager | Remote");   // no usable name anywhere
  const bySlug = cand(db, "Senior Software Engineer", "lever", "acme", "Senior Software Engineer | Remote");   // the board names it
  const good = cand(db, "Stripe", "greenhouse", "stripe", "Stripe | SWE");
  const decided = cand(db, "Senior Software Engineer", "ashby", "someco", "Senior Software Engineer | x", "rejected");
  const r = repairCandidateNames(db);
  const row = (id) => db.prepare("SELECT company, status, status_reason FROM company_candidates WHERE id = ?").get(id);
  assert.deepEqual([row(remitly).company, row(remitly).status], ["Remitly", "probed"]);
  assert.equal(row(label).status, "rejected"); assert.equal(row(label).status_reason, "not_a_company_name");
  assert.equal(row(good).company, "Stripe");
  assert.equal(row(decided).company, "Senior Software Engineer", "a decided row is left as it is");
  assert.equal(row(bySlug).company, "Acme");
  assert.equal(r.renamed.length, 2); assert.equal(r.rejected.length, 1);
  assert.deepEqual(repairCandidateNames(db), { renamed: [], rejected: [], configuredSuspect: r.configuredSuspect }, "idempotent");
  assert.match(fs.readFileSync("server.js", "utf8"), /const n = repairCandidateNames\(db\);/, "it runs at boot");
});

test("Approve all's 'probe_stale': the probe now refreshes probed rows about to go stale (only 'new' rows were ever probed)", async () => {
  const db = db0();
  const now = Math.floor(Date.now() / 1000);
  const stale = cand(db, "Stale Co", "greenhouse", "staleco", "Stale Co | SWE", "probed", now - (PROBE_FRESH_DAYS + 3) * 86400);
  db.prepare("UPDATE company_candidates SET evidence_json = ? WHERE id = ?").run(JSON.stringify({ state: "live", cs: 9, csOpen: 9, probedAt: now - 20 * 86400 }), stale);
  const fresh = cand(db, "Fresh Co", "greenhouse", "freshco", "Fresh Co | SWE", "probed", now - 86400);
  assert.equal(planApproval(db, [stale]).refused[0].reason, "probe_stale");
  const seen = [];
  const probe = async (b) => { seen.push(b.slug); return { state: "live", jobs: 20, us: 20, cs: 7, csOpen: 9, cs30: 3, pct30: 40, pct120: 80 }; };
  const r = await runCandidateProbe(db, { env: {}, probe, sleep: async () => {}, gapMs: 0, now });
  assert.deepEqual(seen, ["staleco"], "the stale row is re-probed; the fresh one is not");
  assert.equal(r.probed, 1);
  assert.equal(planApproval(db, [stale], { now }).eligible.length, 1, "after the re-probe Approve accepts it");
  // a transient error on a re-probe keeps the probed row and its evidence
  db.prepare("UPDATE company_candidates SET probed_at = ? WHERE id = ?").run(now - 30 * 86400, fresh);
  await runCandidateProbe(db, { env: {}, probe: async () => ({ state: "error", message: "timeout" }), sleep: async () => {}, gapMs: 0, now });
  assert.equal(db.prepare("SELECT status FROM company_candidates WHERE id = ?").pluck().get(fresh), "probed");
});

test("the approve dialog stays on screen: refusals counted by reason, names in a closed scrolling list; Re-probe stale exists", () => {
  const src = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(src, /data-approve-eligible="" style=\{\{ \.\.\.scroll/);
  assert.match(src, /<details data-approve-refused="" /);
  assert.match(src, /maxHeight: "32vh", overflowY: "auto"/);
  assert.doesNotMatch(src, /\{refused && <div>Refused: \{refused\}<\/div>\}/, "the inline list of every refusal is gone");
  assert.match(src, /data-reprobe="" /);
  assert.match(fs.readFileSync("routes/companies.js", "utf8"), /router\.post\("\/candidates\/probe"/);
});
