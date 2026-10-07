// A4 — draft as a CLIENT of the résumé tools service, checked against the vendored contract.
//
// ⚠ No test here reaches the real service. The fake server below answers with bodies shaped by
// the vendored contract; the service's own envelope harness is what proves the real responses have
// that shape (resume-master: test/contractEnvelope.test.js, scripts/verifyContract.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import Database from "better-sqlite3";
import { createToolsServiceClient, ToolsServiceError, httpErrorFor, recordToolsServiceUsage } from "../services/toolsService.js";
import { generateRequest, candidateFromProfile, jobProfileFromDomainProfile } from "../services/toolsServiceRequests.js";
import { classifyGenerationError } from "../shared/failureAttribution.js";
import { validate } from "../test-support/contractSchema.js";

const DIR = "contract/resume-master";
const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const contract = JSON.parse(lf(`${DIR}/resume-master-api.v1.json`));
const schemas = contract.components.schemas;

// ── the vendored contract ───────────────────────────────────────────────────────────────────────

test("⛔ the vendored contract matches its checksums (LF-normalised) — it has not been hand-edited", () => {
  const sums = JSON.parse(lf(`${DIR}/CHECKSUMS.json`));
  for (const [file, sum] of Object.entries(sums.files)) {
    assert.equal(crypto.createHash("sha256").update(lf(`${DIR}/${file}`), "utf8").digest("hex"), sum,
      `${DIR}/${file} differs from its checksum — re-copy contract/ from resume-master rather than editing it here`);
  }
  const versions = JSON.parse(lf(`${DIR}/VERSIONS.json`));
  assert.equal(versions[sums.contractVersion], sums.shapeHash, "the version ledger does not match the checksums");
  assert.equal(contract.info.version, sums.contractVersion);
});

// ── the requests draft sends ────────────────────────────────────────────────────────────────────

const PROFILE_ROW = { full_name: "Jane Q Doe", phone: "555-0100", email: "jane@example.com", linkedin_url: "li/jane",
  github_url: "gh/jane", location: "Austin, TX", years_of_experience: 4 };
const DOMAIN_ROW = { profile_name: "Backend", seniority: "mid", role_family: "engineering", domain: "it_digital",
  selected_keywords: '["distributed systems"]', selected_tools: '["Go","Kafka"]', selected_verbs: "[]" };
const JOB = { title: "Senior Backend Engineer", company: "Acme", category: "Software Engineering", description: "Build.", stack: "Go" };

test("the generate request conforms to the contract — every required key, nothing undeclared", () => {
  for (const [label, body] of [
    ["with a profile and claims", generateRequest({ profile: PROFILE_ROW, job: JOB, baseResumeText: "JANE", mode: "GENERATE",
      employers: ["Stripe", "Amazon"], domainProfile: DOMAIN_ROW, claims: { skills: ["Rust"], actionVerbs: [] }, includeSummary: true })],
    ["A+ with no profile", generateRequest({ profile: {}, job: { title: "Analyst" }, baseResumeText: "SAM", mode: "A_PLUS" })],
    ["standalone shape", { mode: "GENERATE", candidate: {}, profile: null, claims: null, employers: [],
      job: { title: "Role", company: "Company", description: "JD", category: "", stack: "" }, baseResumeText: "x", options: { includeSummary: false } }],
  ]) {
    assert.deepEqual(validate(JSON.parse(JSON.stringify(body)), schemas.GenerateRequest, schemas, { strict: true }), [], label);
  }
});

test("the mapping carries the authorities the claim guard enforces, RAW", () => {
  const c = candidateFromProfile({ ...PROFILE_ROW, years_of_experience: "4" });
  assert.equal(c.yearsOfExperience, "4", "normalising here would move the guard's ceiling");
  assert.equal(candidateFromProfile({ first_name: "Sam", last_name: "Lee" }).fullName, "Sam Lee",
    "draft's prompt builder fell back to first + last; so must the mapping");
  assert.deepEqual(jobProfileFromDomainProfile(DOMAIN_ROW),
    { name: "Backend", seniority: "mid", keywords: ["distributed systems"], tools: ["Go", "Kafka"], actionVerbs: [] });
  assert.equal(jobProfileFromDomainProfile(null), null);
});

test("with a profile, the role family is always sent — draft never classified on that path", () => {
  const withFamily = generateRequest({ profile: {}, job: JOB, baseResumeText: "x", mode: "GENERATE", domainProfile: DOMAIN_ROW });
  assert.equal(withFamily.roleFamily, "engineering");
  // A profile with no role_family resolved to "general" in draft; sending nothing would make the
  // service classify (a model call), which draft never did here.
  const noFamily = generateRequest({ profile: {}, job: JOB, baseResumeText: "x", mode: "GENERATE", domainProfile: { ...DOMAIN_ROW, role_family: null } });
  assert.equal(noFamily.roleFamily, "general");
  const noProfile = generateRequest({ profile: {}, job: JOB, baseResumeText: "x", mode: "GENERATE" });
  assert.equal("roleFamily" in noProfile, false, "without a profile the service classifies, as draft did");
});

// ── the client against a fake service ───────────────────────────────────────────────────────────

async function fakeService(handler) {
  const seen = [];
  const server = http.createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    const { status = 200, json, raw, type = "application/json" } = await handler(req, body);
    res.writeHead(status, { "content-type": type }); res.end(raw ?? JSON.stringify(json));
  });
  await new Promise(r => server.listen(0, r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => new Promise(r => server.close(r)) };
}

const USAGE = [{ purpose: "resume_generate", model: "claude-sonnet-5", success: true, input_tokens: 100, output_tokens: 50,
  cache_creation_input_tokens: 6704, cache_read_input_tokens: 0, duration_ms: 900 }];

test("success: the token is sent as a bearer, and the contract's response comes back", async () => {
  const body = { html: "<html></html>", domainModuleKey: "engineering",
    claimCheck: { ok: true, inspected: { documentChars: 10, headlineRegion: "summary", headlineChars: 5, seniorityCeilingKnown: true } }, usage: USAGE };
  assert.deepEqual(validate(body, schemas.GenerateResponse, schemas), [], "fixture must itself conform");
  const svc = await fakeService(() => ({ json: body }));
  try {
    const client = createToolsServiceClient({ baseUrl: svc.url + "/", token: "rmk_draft.secret" });
    assert.deepEqual(await client.generate({ baseResumeText: "x", job: { title: "E" } }), body);
    assert.equal(svc.seen[0].auth, "Bearer rmk_draft.secret");
    assert.equal(svc.seen[0].url, "/v1/resumes/generate");
  } finally { await svc.close(); }
});

test("⛔ a withheld résumé (422) keeps failureAttribution's meaning: our refusal, retryable, violations attached", async () => {
  const violations = [{ kind: "years_exceed_profile", claimed: 9, allowed: 4, evidence: ["9 years"], message: "claims 9 years; the profile states 4." }];
  const svc = await fakeService(() => ({ status: 422, json: { error: "resume_claim_violation", retryable: true, violations, usage: USAGE } }));
  try {
    const client = createToolsServiceClient({ baseUrl: svc.url, token: "t" });
    const e = await client.generate({}).catch(x => x);
    assert.ok(e instanceof ToolsServiceError);
    assert.equal(e.code, "resume_claim_violation");
    assert.deepEqual(e.violations, violations);
    assert.deepEqual(e.usage, USAGE, "the spend is still reported for metering");
    const f = classifyGenerationError(e);
    assert.equal(f.code, "resume_claim_violation", "must not become generation_failed");
    assert.equal(f.permanent, false);
    assert.match(f.detail, /NOT saved or sent/);
    const h = httpErrorFor(e);
    assert.equal(h.status, 422);
    assert.equal(h.body.retryable, true);
    assert.equal(h.body.html, undefined);
  } finally { await svc.close(); }
});

test("⛔ an exhausted balance arrives as 502 permanent:true — and is NOT reported retryable", async () => {
  const svc = await fakeService(() => ({ status: 502, json: { error: "upstream_model_failure", retryable: false, permanent: true,
    message: "400 Your credit balance is too low", usage: [] } }));
  try {
    const e = await createToolsServiceClient({ baseUrl: svc.url, token: "t" }).generate({}).catch(x => x);
    assert.equal(e.permanent, true);
    assert.equal(e.retryable, false);
    // 502 is in TRANSIENT_HTTP — without the explicit verdict this would say "retry".
    assert.equal(classifyGenerationError(e).permanent, true);
    const h = httpErrorFor(e);
    assert.equal(h.body.retryable, false);
    assert.match(h.body.detail, /Retrying will not help/);
  } finally { await svc.close(); }
});

test("a transient upstream failure is retryable", async () => {
  const svc = await fakeService(() => ({ status: 502, json: { error: "upstream_model_failure", retryable: true, permanent: false, usage: [] } }));
  try {
    const e = await createToolsServiceClient({ baseUrl: svc.url, token: "t" }).enhance({}).catch(x => x);
    assert.equal(e.retryable, true);
    assert.equal(classifyGenerationError(e).permanent, false);
    assert.equal(httpErrorFor(e).body.retryable, true);
  } finally { await svc.close(); }
});

test("unreachable fails fast, retryable, and names the service rather than a stack", async () => {
  const svc = await fakeService(() => ({ json: {} })); const url = svc.url; await svc.close();
  const e = await createToolsServiceClient({ baseUrl: url, token: "t" }).generate({}).catch(x => x);
  assert.equal(e.code, "tools_service_unreachable");
  assert.equal(e.retryable, true);
  assert.match(e.message, /tools service is unreachable/);
});

test("⛔ a 200 HTML page is a misconfiguration, not an answer — the SPA shell the old domain serves today", async () => {
  const svc = await fakeService(() => ({ raw: "<!DOCTYPE html><html></html>", type: "text/html; charset=UTF-8" }));
  try {
    const e = await createToolsServiceClient({ baseUrl: svc.url, token: "t" }).generate({}).catch(x => x);
    assert.equal(e.code, "tools_service_bad_response");
    assert.equal(e.permanent, true);
    assert.match(e.message, /not JSON/);
  } finally { await svc.close(); }
});

test("unconfigured is permanent and makes no request", async () => {
  const client = createToolsServiceClient({ baseUrl: "", token: "" });
  assert.equal(client.configured, false);
  const e = await client.parsePdf({}).catch(x => x);
  assert.equal(e.code, "tools_service_unconfigured");
  assert.equal(httpErrorFor(e).body.retryable, false);
});

test("no user-facing message names the other product — users see 'the résumé tools service'", async () => {
  const messages = [];
  messages.push((await createToolsServiceClient({ baseUrl: "", token: "" }).generate({}).catch(e => e)).message);
  const svc = await fakeService(() => ({ raw: "<html>", type: "text/html" }));
  try { messages.push((await createToolsServiceClient({ baseUrl: svc.url, token: "t" }).generate({}).catch(e => e)).message); }
  finally { await svc.close(); }
  for (const m of messages) assert.doesNotMatch(m, /resume[\s_-]?master/i, m);
});

// ── usage recorded in draft's usage_events ──────────────────────────────────────────────────────

function usageDb() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE usage_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, event_type TEXT, event_subtype TEXT,
    input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_creation_tokens INTEGER, cached INTEGER,
    model TEXT, cost_usd REAL, ats_score_before INTEGER, ats_score_after INTEGER, duration_ms INTEGER, job_id TEXT, company TEXT,
    success INTEGER, error_text TEXT, purpose TEXT, provider TEXT)`);
  return db;
}

test("usage records land in usage_events with the same purpose/event_type draft's own calls used", () => {
  const db = usageDb();
  const usage = [{ ...USAGE[0], purpose: "classifier", model: "claude-haiku-4-5-20251001" }, USAGE[0],
                 { ...USAGE[0], purpose: "resume_format", success: false }];
  const id = recordToolsServiceUsage(db, usage, { userId: 7, jobId: "j1", company: "Acme", atsScoreBefore: 40, idFor: "resume_generate" });
  const rows = db.prepare("SELECT * FROM usage_events ORDER BY id").all();
  assert.deepEqual(rows.map(r => [r.purpose, r.event_type, r.success]), [["classifier", "classifier", 1], ["resume_generate", "resume_generate", 1], ["resume_format", "resume_format", 0]]);
  assert.equal(id, rows[1].id, "the resume_generate row id comes back for recordAtsOutcome");
  assert.equal(rows[1].ats_score_before, 40);
  assert.equal(rows[1].cache_creation_tokens, 6704, "the API's own field name, read as such");
  assert.ok(rows[1].cost_usd > 0, "costed from the model, as before");
});

test("A94: a claim-guard refusal's billed call says the request was refused — a delivery's does not", () => {
  const db = usageDb();
  recordToolsServiceUsage(db, USAGE, { userId: 7, jobId: "j1", requestError: "resume_claim_violation" });
  recordToolsServiceUsage(db, USAGE, { userId: 7, jobId: "j2", idFor: "resume_generate" });
  recordToolsServiceUsage(db, [{ ...USAGE[0], success: false }], { userId: 7, jobId: "j3", requestError: "upstream_model_failure" });
  const rows = db.prepare("SELECT job_id, success, error_text FROM usage_events ORDER BY id").all();
  assert.deepEqual(rows.slice(0, 2), [
    { job_id: "j1", success: 1, error_text: "request failed: resume_claim_violation" },  // billed, then withheld
    { job_id: "j2", success: 1, error_text: null },                                       // delivered
  ]);
  // The call itself failed: its own marker wins, and the request's code does not replace it.
  assert.equal(rows[2].success, 0);
  assert.match(rows[2].error_text, /^failed inside /);
});

test("A94: every catch that meters a failed tools-service request passes its code", () => {
  const src = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const catches = src.match(/recordToolsServiceUsage\(db, e\?\.usage, .*$/gm) || [];
  assert.equal(catches.length, 3, "generate, standalone generate and enhance");
  for (const c of catches) assert.match(c, /requestError: e\?\.code/, c);
});

test("a surface keeps its attribution — the standalone generator's spend is not blended into signed-in generation", () => {
  const db = usageDb();
  recordToolsServiceUsage(db, USAGE, { userId: 0, eventSubtype: "standalone", renamePurpose: { resume_generate: "standalone_generate" } });
  assert.equal(db.prepare("SELECT purpose FROM usage_events").get().purpose, "standalone_generate");
});
