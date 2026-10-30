import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import profileSectionRoutes from "../routes/profileSections.js";
import proofPageRoutes, { renderProofPage } from "../routes/proofPage.js";
import { readProfile, saveSection } from "../services/structuredProfile.js";
import {
  setEvidence, checkEvidence, evidenceKey, chooseBullets, evidenceForRequest, backedBulletKeys,
  readProofPage, setProofPage, proofPageFor, PROOF_PAGE_NOTE,
} from "../services/proofLinks.js";
import { markBacking, BACKING_MARKS } from "../services/resumeClaimGuard.js";
import { generateRequest, RESUME_MASTER_ACCEPTS_EVIDENCE } from "../services/toolsServiceRequests.js";
import { buildBrief } from "../services/byom/resumePatch.js";
import { MERGE_PLAN } from "../services/accountService.js";
import { validate } from "../test-support/contractSchema.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D109 (owner 10-30) · PROOF — every claim on the résumé can carry its evidence. Synthetic person and companies.

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const schemas = JSON.parse(lf("contract/resume-master/resume-master-api.v1.json")).components.schemas;
const SERVER = lf("server.js");
const UI = lf("client/src/components/ProfileSections.jsx");
const PAGE_SRC = lf("routes/proofPage.js");

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'dana','x'), (2,'eli','x')").run();
  db.prepare(`INSERT INTO user_profile (user_id,first_name,last_name,full_name,email,phone,location,linkedin_url)
    VALUES (1,'Dana','Example','Dana Example','dana@example.test','617-555-0142','12 Elm St, Boston, MA','linkedin.com/in/dana-example')`).run();
  db.prepare("INSERT INTO profile_sections (user_id) VALUES (1)").run();   // not a first open — no résumé fill
  saveSection(db, 1, "experience", { items: [
    { company: "Northwind", title: "Software Engineer", start: "2022-01", current: true, bullets: ["Built a queue service", "Cut latency 30%", "Ran the on-call rota"] },
    { company: "Contoso", title: "Intern", start: "2021-05", end: "2021-08", bullets: ["Wrote integration tests"] },
  ] });
  saveSection(db, 1, "projects", { items: [{ name: "Tidewatch", description: "A tide-table app. Contact dana@example.test" }, { name: "Ledgerline" }] });
  return db;
}

test("D109 · migration 184 is in BOTH lists, after 182, with 183 left to its lane", () => {
  const ids = MIGRATIONS.map(m => m.id);
  assert.ok(ids.includes("184_proof_links"));
  assert.ok(ids.indexOf("184_proof_links") > ids.indexOf("182_portal_reset_existing"));
  assert.ok(SERVER.includes('id: "184_proof_links"'), "server.js carries the same migration");
  for (const t of ["profile_projects", "profile_evidence", "proof_pages"]) assert.ok(t in MERGE_PLAN, `${t} has a merge plan`);
  const acct = lf("services/accountService.js");
  const exp = acct.slice(at(acct, "const EXPORT_TABLES"), at(acct, "export function exportAccount"));
  for (const t of ["profile_projects", "profile_evidence", "proof_pages"]) assert.ok(exp.includes(`"${t}"`), `${t} is exported`);
});

test("D109 · d109EvidenceLinked — a bullet and a project link evidence; https only, a kind, a short label; validated", () => {
  const db = freshDb();
  setEvidence(db, 1, { target: "bullet", claim: "Built a queue service", items: [
    { kind: "repository", label: "queue-svc on GitHub", url: "https://github.example/dana/queue-svc" },
    { kind: "writeup", label: "", url: "https://blog.example/queue" },
  ] });
  setEvidence(db, 1, { target: "project", claim: "Tidewatch", items: [{ kind: "demo", label: "Live", url: "https://tidewatch.example" }] });
  const s = readProfile(db, 1).sections;
  const nw = s.experience.find(x => x.company === "Northwind");
  assert.deepEqual(nw.evidence[0].map(e => [e.kind, e.label]), [["repository", "queue-svc on GitHub"], ["writeup", "Write-up"]],
    "an empty label becomes the kind's own word");
  assert.deepEqual(nw.evidence[1], []);
  assert.deepEqual(s.projects.find(p => p.name === "Tidewatch").evidence.map(e => e.url), ["https://tidewatch.example/"]);

  // refused: http, javascript:, credentials, a bad kind, a long label, too many, a claim that is not on the profile
  const code = (fn) => { try { fn(); } catch (e) { return [e.status, e.code]; } return null; };
  assert.deepEqual(code(() => checkEvidence({ kind: "repository", url: "http://github.example/x" })), [400, "bad_evidence"]);
  assert.deepEqual(code(() => checkEvidence({ kind: "repository", url: "javascript:alert(1)" })), [400, "bad_evidence"]);
  assert.deepEqual(code(() => checkEvidence({ kind: "repository", url: "https://u:p@github.example/x" })), [400, "bad_evidence"]);
  assert.deepEqual(code(() => checkEvidence({ kind: "tweet", url: "https://x.example/1" })), [400, "bad_evidence"]);
  assert.deepEqual(code(() => checkEvidence({ kind: "paper", label: "x".repeat(61), url: "https://arxiv.example/1" })), [400, "bad_evidence"]);
  assert.deepEqual(code(() => setEvidence(db, 1, { target: "bullet", claim: "Cut latency 30%",
    items: Array.from({ length: 6 }, () => ({ kind: "paper", url: "https://arxiv.example/1" })) })), [400, "bad_evidence"]);
  assert.deepEqual(code(() => setEvidence(db, 1, { target: "bullet", claim: "Invented the internet", items: [] })), [404, "no_such_claim"]);
  assert.deepEqual(code(() => setEvidence(db, 2, { target: "project", claim: "Tidewatch", items: [] })), [404, "no_such_claim"],
    "another user's project is not yours to link");
  // a refused save stored nothing
  assert.equal(db.prepare("SELECT COUNT(*) FROM profile_evidence WHERE target_key = ?").pluck().get(evidenceKey("Cut latency 30%")), 0);

  // an EDITED bullet keeps its evidence; a REMOVED one loses it; a reorder keeps it
  saveSection(db, 1, "experience", { items: [
    { company: "Contoso", title: "Intern", start: "2021-05", end: "2021-08", bullets: ["Wrote integration tests"] },
    { company: "Northwind", title: "Software Engineer", start: "2022-01", current: true, bullets: ["Built a queue service", "Cut latency 30%", "Ran the on-call rota"] },
  ] });
  assert.equal(readProfile(db, 1).sections.experience[1].evidence[0].length, 2, "a reorder keeps the links");
  saveSection(db, 1, "experience", { items: [
    { company: "Northwind", title: "Software Engineer", start: "2022-01", current: true, bullets: ["Built a durable queue service in Go", "Cut latency 30%"] },
  ] });
  assert.equal(readProfile(db, 1).sections.experience[0].evidence[0].length, 2, "an edited bullet keeps its links");
  saveSection(db, 1, "experience", { items: [{ company: "Northwind", start: "2022-01", current: true, bullets: ["Cut latency 30%"] }] });
  assert.equal(db.prepare("SELECT COUNT(*) FROM profile_evidence WHERE user_id = 1 AND target = 'bullet'").pluck().get(), 0,
    "a removed bullet's links go with it");
  // a renamed project keeps its links
  saveSection(db, 1, "projects", { items: [{ name: "Tidewatch 2" }, { name: "Ledgerline" }] });
  assert.equal(readProfile(db, 1).sections.projects[0].evidence.length, 1);
  // the UI edits them
  assert.match(UI, /\/api\/profile\/evidence/);
  assert.match(UI, /\+ Link evidence/);
});

test("D109 · d109EvidenceLinked — the routes: link, refuse, read back", async () => {
  const db = freshDb();
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.user = { id: 1 }; n(); });
  profileSectionRoutes(app, db, (_q, _r, n) => n());
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body) => { const r = await fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };
  try {
    const ok = await call("PUT", "/api/profile/evidence", { target: "bullet", claim: "Cut latency 30%", items: [{ kind: "paper", label: "Latency study", url: "https://papers.example/lat" }] });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.sections.experience[0].marks[1].mark, "backed");
    assert.equal((await call("PUT", "/api/profile/evidence", { target: "bullet", claim: "Cut latency 30%", items: [{ kind: "paper", url: "ftp://x.example" }] })).status, 400);
    assert.equal((await call("PUT", "/api/profile/evidence", { target: "skill", claim: "Go", items: [] })).status, 400);
    assert.equal((await call("GET", "/api/profile/proof-page")).body.enabled, false);
  } finally { server.close(); }
});

test("D109 · d109TailoringPrefersBacked — the guard marks backed / unbacked, and choosing keeps backed bullets first", () => {
  const db = freshDb();
  setEvidence(db, 1, { target: "bullet", claim: "Ran the on-call rota", items: [{ kind: "writeup", url: "https://blog.example/oncall" }] });
  const nw = readProfile(db, 1).sections.experience.find(x => x.company === "Northwind");
  assert.deepEqual(nw.marks.map(m => m.mark), ["unbacked", "unbacked", "backed"]);
  assert.deepEqual(markBacking(["a", { text: "b" }], t => (t === "b" ? 2 : 0)).map(m => [m.text, m.backed, m.links]), [["a", false, 0], ["b", true, 2]]);

  // the choosing rule: two of three fit → the backed one survives; kept bullets stay in the candidate's order
  const role = nw.marks.map(m => ({ text: m.text, backed: m.backed }));
  assert.deepEqual(chooseBullets(role, 2).map(b => b.text), ["Built a queue service", "Ran the on-call rota"]);
  assert.deepEqual(chooseBullets(role, 1).map(b => b.text), ["Ran the on-call rota"]);
  assert.deepEqual(chooseBullets(role).map(b => b.text), role.map(b => b.text), "no limit → every bullet, unchanged");
  assert.deepEqual(chooseBullets(["x", "y"], 1).map(b => b.text), ["x"], "nothing backed → the candidate's order");

  // the tools service's Generate: the marks travel as `evidence`, withheld until the contract declares it
  const evidence = evidenceForRequest(db, 1);
  assert.deepEqual(evidence.roles[0].bullets.map(b => b.backed), [false, false, true]);
  const ARGS = { profile: { full_name: "Dana Example" }, job: { title: "SWE", company: "Fabrikam", description: "x" }, baseResumeText: "r", mode: "GENERATE", evidence };
  assert.deepEqual(generateRequest(ARGS, { evidenceAccepted: true }).evidence, evidence);
  const today = generateRequest(ARGS);
  const declared = !!schemas.GenerateRequest?.properties?.evidence;
  assert.equal(RESUME_MASTER_ACCEPTS_EVIDENCE, declared,
    declared ? "the tools service now declares GenerateRequest.evidence — set RESUME_MASTER_ACCEPTS_EVIDENCE = true"
             : "evidence is not in the vendored contract — sending it would be an undeclared key");
  if (!declared) assert.equal("evidence" in today, false);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(today)), schemas.GenerateRequest, schemas, { strict: true }), [], "today's body is strict-valid");
  const kernel = SERVER.slice(at(SERVER, "const generateBody = toolsGenerateRequest({"), at(SERVER, "// ── AK1: measure the LIFT"));
  assert.match(kernel, /evidence: evidenceForRequest\(db, userId\)/, "the Generate kernel computes the marks");

  // draft's own tailoring path (the user's model, D86): each brief bullet carries `backed`
  const keys = backedBulletKeys(db, 1);
  const structured = { sections: [{ type: "experience", title: "EXPERIENCE", entries: [{ company: "Northwind", role: "SWE", bullets: ["Built a queue service", "Ran the on-call rota"] }] }] };
  const brief = buildBrief({ briefId: "b", expiresAt: 1, job: { id: 1 }, structured, backedFor: (t) => keys.has(evidenceKey(t)) });
  assert.deepEqual(brief.resume.sections[0].entries[0].bullets.map(b => b.backed), [false, true]);
  const plain = buildBrief({ briefId: "b", expiresAt: 1, job: { id: 1 }, structured });
  assert.equal("backed" in plain.resume.sections[0].entries[0].bullets[0], false, "no evidence known → the brief is unchanged");
  const baseFor = SERVER.slice(at(SERVER, "    baseFor(userId) {"), at(SERVER, "    scoreText(userId, job, text) {"));
  assert.match(baseFor, /backedFor:/, "the connector's base carries the marks");
});

test("D109 · d109ProofPageOffByDefault — no page until turned on; then projects and links only, nothing private", async () => {
  const db = freshDb();
  setEvidence(db, 1, { target: "project", claim: "Tidewatch", items: [{ kind: "repository", label: "Source", url: "https://code.example/dana/tidewatch" }] });
  assert.deepEqual(readProofPage(db, 1), { enabled: false, handle: null }, "OFF by default");
  assert.equal(db.prepare("SELECT dflt_value FROM pragma_table_info('proof_pages') WHERE name = 'enabled'").pluck().get(), "0");

  const app = express();
  proofPageRoutes(app, db);
  const server = app.listen(0);
  const get = (h) => fetch(`http://127.0.0.1:${server.address().port}/p/${h}`).then(async r => ({ status: r.status, text: await r.text() }));
  try {
    assert.equal((await get("dana-example")).status, 404, "no row → no page");
    setProofPage(db, 1, { enabled: false, handle: "dana-example" });
    const off = await get("dana-example");
    assert.equal(off.status, 404, "a handle that is turned off is not shown");
    assert.equal(off.text, (await get("nobody-here")).text, "off and absent answer the same");

    setProofPage(db, 1, { enabled: true, handle: "Dana-Example" });
    const on = await get("dana-example");
    assert.equal(on.status, 200);
    assert.match(on.text, /Tidewatch/);
    assert.match(on.text, /https:\/\/code\.example\/dana\/tidewatch/);
    assert.match(on.text, /Links supplied by the candidate/);
    for (const priv of ["dana@example.test", "617-555-0142", "Elm St", "Boston", "linkedin.com", "Northwind", "Built a queue"]) {
      assert.ok(!on.text.includes(priv), `the page shows nothing private or off-topic: ${priv}`);
    }
    // a handle cannot be taken twice; a bad or reserved one is refused
    const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
    assert.equal(code(() => setProofPage(db, 2, { enabled: true, handle: "dana-example" })), "handle_taken");
    assert.equal(code(() => setProofPage(db, 2, { enabled: true, handle: "admin" })), "handle_taken");
    assert.equal(code(() => setProofPage(db, 2, { enabled: true, handle: "a b" })), "bad_handle");
    assert.equal(code(() => setProofPage(db, 2, { enabled: true })), "bad_handle", "on needs an address");
    // escaped: a project named like markup renders as text
    saveSection(db, 1, "projects", { items: [{ name: "<script>x</script>" }] });
    assert.ok(!(await get("dana-example")).text.includes("<script>x"));
    setProofPage(db, 1, { enabled: false });
    assert.equal((await get("dana-example")).status, 404, "turned off again → gone");
  } finally { server.close(); }
  assert.match(SERVER, /proofPageRoutes\(app, db\);/, "the page is mounted");
  const mount = at(SERVER, "proofPageRoutes(app, db);");
  assert.ok(mount < at(SERVER, 'app.get("*", (_req, res) => {'), "before the client's catch-all");
});

test("D109 · d109NoCertifyWording — no 'verified' / 'certified' on the page or the marks", () => {
  const db = freshDb();
  setProofPage(db, 1, { enabled: true, handle: "dana-example" });
  const html = renderProofPage(proofPageFor(db, "dana-example"));
  const CERTIFY = /\b(verif\w*|certif\w*|vouched|authenticated|validated|confirmed|guaranteed?)\b/i;
  const visible = html.replace(/<style>[\s\S]*?<\/style>/, "");
  assert.doesNotMatch(visible, CERTIFY, "the rendered page claims nothing");
  assert.match(visible, /supplied by the candidate/);
  assert.match(PROOF_PAGE_NOTE, /does not open, check or vouch/);
  for (const m of Object.values(BACKING_MARKS)) assert.doesNotMatch(m.words, CERTIFY, `the mark "${m.words}"`);
  assert.doesNotMatch(PAGE_SRC.replace(/^\s*\/\/.*$/gm, ""), CERTIFY, "nothing in the page's template either");
  // the Profile's own words for the marks and the page
  const ui = UI.replace(/^\s*\/\/.*$/gm, "");
  const uiStart = at(ui, "const EVIDENCE_KINDS");
  assert.doesNotMatch(ui.slice(uiStart, at(ui, "const ymLabel")), CERTIFY);
});
