// ⭐ D70 Phase 3 · the cheap levers — the prompt cache per caller, retries capped and explained, and the
// cost of a résumé (A+ above all) said before it runs. Each test below was mutated red and restored
// (the commit message lists the mutations).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { generateRequest, RESUME_MASTER_ACCEPTS_CACHE_OPTION } from "../services/toolsServiceRequests.js";
import { recordToolsServiceUsage } from "../services/toolsService.js";
import { AUTOMATIC_RETRY_CAP, AUTOMATIC_RETRIES_MADE, retryReasonFor, retryLedgerText, RETRY_WINDOW_SEC } from "../services/generationRetry.js";
import { generationCostSummary, costEstimateFor, MEASURED_CENTS, centsLabel } from "../services/generationCost.js";
import { validate } from "../test-support/contractSchema.js";
import { at } from "../test-support/sourceAnchors.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const SERVER = lf("server.js");
const contract = JSON.parse(lf("contract/resume-master/resume-master-api.v1.json"));
const schemas = contract.components.schemas;

/** The body of a top-level `function name(` / `async function name(` in server.js, up to the next top-level one. */
function fnBody(name) {
  const start = SERVER.search(new RegExp(`\\n(async )?function ${name}\\(`));
  assert.ok(start > 0, `${name} not found in server.js`);
  const rest = SERVER.slice(start + 1);
  const end = rest.slice(1).search(/\n(async )?function \w+\(|\napp\.(get|post)\(/);
  return end > 0 ? rest.slice(0, end + 1) : rest;
}

const ARGS = { profile: {}, job: { title: "Engineer" }, baseResumeText: "x", mode: "GENERATE" };

// ── (a) the prompt cache, per caller ────────────────────────────────────────────────────────────

test("D70 P3 (a): the cache gate equals what the VENDORED contract declares — re-vendoring flips it red", () => {
  const declared = !!schemas.GenerateRequest?.properties?.options?.properties?.cache;
  assert.equal(RESUME_MASTER_ACCEPTS_CACHE_OPTION, declared,
    declared ? "The tools service now declares options.cache — set RESUME_MASTER_ACCEPTS_CACHE_OPTION = true so the interactive caller's false reaches it"
             : "options.cache is not in the vendored contract — sending it would be an undeclared key");
});

test("D70 P3 (a): a one-shot caller's cache:false goes on the wire once accepted; a batch caller's body is unchanged", () => {
  const oneShot = generateRequest({ ...ARGS, cache: false }, { cacheOptionAccepted: true });
  assert.deepEqual(oneShot.options, { includeSummary: false, cache: false });
  const batch = generateRequest({ ...ARGS }, { cacheOptionAccepted: true });
  assert.deepEqual(batch.options, { includeSummary: false }, "a caller that did not choose keeps the default (cache on)");
  assert.deepEqual(generateRequest({ ...ARGS, cache: true }, { cacheOptionAccepted: true }).options, { includeSummary: false },
    "true is the default and is never spelled out — the body stays byte-for-byte what it was");
  // Withheld while the contract does not declare it — and today's bodies still pass the STRICT contract.
  const today = generateRequest({ ...ARGS, cache: false });
  assert.deepEqual(validate(JSON.parse(JSON.stringify(today)), schemas.GenerateRequest, schemas, { strict: true }), []);
  if (!RESUME_MASTER_ACCEPTS_CACHE_OPTION) assert.equal("cache" in today.options, false);
});

test("D70 P3 (a): the interactive route asks for cache:false, the apply worker does not, and the kernel forwards it", () => {
  const route = SERVER.slice(at(SERVER, 'app.post("/api/generate"'), at(SERVER, 'app.post("/api/generate"') + 12000);
  assert.match(route, /coreGenerateResume\(\{[^}]*\bcache: false\b[^}]*\}\)/, "the interactive /api/generate is a one-shot");
  const apply = fnBody("generateResumeForApply");
  const call = /coreGenerateResume\(\{[^}]*\}\)/.exec(apply)?.[0];
  assert.ok(call, "generateResumeForApply calls coreGenerateResume");
  assert.doesNotMatch(call, /cache/, "the apply worker (bursts) keeps the default — caching is where AL6 measured it paying");
  const kernel = fnBody("coreGenerateResume");
  assert.match(kernel, /async function coreGenerateResume\(\{[^}]*cache = undefined[^}]*\}\)/);
  assert.match(kernel, /toolsGenerateRequest\(\{[\s\S]{0,300}?\bcache,/, "the caller's choice reaches the request builder");
});

// ── (b) retries: capped at one, and every retry says why ────────────────────────────────────────

test("D70 P3 (b): automatic retries are capped at ONE, and coreGenerateResume makes one call with no loop", () => {
  assert.equal(AUTOMATIC_RETRY_CAP, 1);
  assert.ok(AUTOMATIC_RETRIES_MADE <= AUTOMATIC_RETRY_CAP, "draft may not make more automatic retries than the cap");
  const kernel = fnBody("coreGenerateResume");
  const calls = kernel.match(/toolsService\.generate\(/g) || [];
  assert.equal(calls.length, 1 + AUTOMATIC_RETRIES_MADE,
    "one tools-service call per request (plus AUTOMATIC_RETRIES_MADE) — an automatic retry must change the constants");
  assert.doesNotMatch(kernel, /\b(for|while)\s*\(|\bdo\s*\{/, "no loop around the generation call");
});

function ledger() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL, event_subtype TEXT,
    input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, cache_read_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0, cached INTEGER NOT NULL DEFAULT 0, model TEXT, cost_usd REAL DEFAULT 0,
    ats_score_before INTEGER, ats_score_after INTEGER, duration_ms INTEGER, job_id TEXT, company TEXT,
    success INTEGER NOT NULL DEFAULT 1, error_text TEXT, purpose TEXT, provider TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE cache_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      layer TEXT, domain_module TEXT, tokens_in_cache INTEGER DEFAULT 0, tokens_saved INTEGER DEFAULT 0,
      cost_saved_usd REAL DEFAULT 0, model TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()));`);
  return db;
}
const row = (db, r) => db.prepare(`INSERT INTO usage_events (user_id, event_type, event_subtype, purpose, job_id, success,
  error_text, output_tokens, cost_usd, created_at) VALUES (@user_id, 'resume_generate', @sub, 'resume_generate', @job_id,
  @success, @error_text, @out, @cost, @at)`).run({ user_id: 1, sub: "GENERATE", job_id: "j1", success: 1, error_text: null,
  out: 3000, cost: 0.0667, at: Math.floor(Date.now() / 1000), ...r });

test("D70 P3 (b): a generation after a FAILED one for the same job is a retry, with the failure's code as its reason", () => {
  const now = Math.floor(Date.now() / 1000);
  const db = ledger();
  assert.equal(retryReasonFor(db, { userId: 1, jobId: "j1", now }), null, "no history: not a retry");
  row(db, { error_text: "request failed: resume_claim_violation", at: now - 60 });
  assert.equal(retryReasonFor(db, { userId: 1, jobId: "j1", now }), "resume_claim_violation", "a withheld résumé (A94's marker)");
  assert.equal(retryReasonFor(db, { userId: 1, jobId: "j2", now }), null, "another job is not this one's retry");
  assert.equal(retryReasonFor(db, { userId: 2, jobId: "j1", now }), null, "another person's failure is not this one's");
  assert.equal(retryReasonFor(db, { userId: 1, jobId: "j1", now: now + RETRY_WINDOW_SEC + 120 }), null, "outside the window");
  row(db, { success: 0, error_text: "failed inside the tools service", out: 0, cost: 0, at: now - 30 });
  assert.equal(retryReasonFor(db, { userId: 1, jobId: "j1", now }), "model_call_failed", "the model call itself failed");
  row(db, { at: now - 10 });
  assert.equal(retryReasonFor(db, { userId: 1, jobId: "j1", now }), null, "after a DELIVERED résumé the next one is a regeneration");
});

test("D70 P3 (b): the ledger row says why — `retry after: <code>`, beside A94's `request failed:`", () => {
  const db = ledger();
  const usage = [{ purpose: "resume_generate", model: "claude-sonnet-5", success: true, input_tokens: 10, output_tokens: 10,
    cache_creation_input_tokens: 0, cache_read_input_tokens: 0, duration_ms: 1 }];
  recordToolsServiceUsage(db, usage, { userId: 1, jobId: "j1", retryReason: "resume_claim_violation" });
  recordToolsServiceUsage(db, usage, { userId: 1, jobId: "j1", requestError: "resume_claim_violation", retryReason: "model_call_failed" });
  recordToolsServiceUsage(db, usage, { userId: 1, jobId: "j1" });
  const texts = db.prepare("SELECT error_text FROM usage_events ORDER BY id").all().map(r => r.error_text);
  assert.deepEqual(texts, ["retry after: resume_claim_violation",
    "request failed: resume_claim_violation; retry after: model_call_failed", null]);
  assert.ok(texts[1].startsWith("request failed:"), "scripts/d70LedgerRead.mjs reads a withheld row by this prefix");
  assert.equal(retryLedgerText(null), null);
  // Retries are countable by purpose without a migration.
  assert.equal(db.prepare("SELECT COUNT(*) c FROM usage_events WHERE purpose='resume_generate' AND error_text LIKE '%retry after:%'").get().c, 2);
});

test("D70 P3 (b): the kernel reads the reason BEFORE the call, records it on both outcomes, and the route returns it", () => {
  const kernel = fnBody("coreGenerateResume");
  const reasonAt = kernel.indexOf("retryReasonFor(db,");
  assert.ok(reasonAt > 0 && reasonAt < kernel.indexOf("toolsService.generate("), "read before this call writes its own row");
  assert.match(kernel, /requestError: e\?\.code, retryReason \}\)/, "a failed request's row says it was a retry");
  assert.match(kernel, /idFor: "resume_generate", retryReason,/, "a delivered row says it was a retry");
  assert.match(kernel, /retry: retryReason \? \{ reason: retryReason \} : null/);
  assert.match(SERVER, /retry: result\.retry \?\? null \}\);/, "the /api/generate response says why");
});

// ── (c) the cost, before it runs ────────────────────────────────────────────────────────────────

test("D70 P3 (c): the estimate is the ledger's median of DELIVERED rows, else Phase 0's measurement — and says which", () => {
  const db = ledger();
  assert.deepEqual(costEstimateFor(db, "A_PLUS"), { cents: MEASURED_CENTS.A_PLUS, basis: "measured", samples: 0 });
  for (const c of [0.06, 0.07, 0.08]) row(db, { sub: "A_PLUS", cost: c });
  row(db, { sub: "A_PLUS", cost: 0.5, error_text: "request failed: resume_claim_violation" });  // withheld — billed, not delivered
  row(db, { sub: "A_PLUS", cost: 0.4, success: 0 });
  row(db, { sub: "A_PLUS", cost: 0.3, out: 0 });
  assert.deepEqual(costEstimateFor(db, "A_PLUS"), { cents: 7, basis: "ledger", samples: 3 });
  assert.equal(costEstimateFor(db, "GENERATE").basis, "measured", "kinds are not mixed");
  assert.equal(centsLabel(6.67), "about 7¢");
  assert.equal(centsLabel(0.2), "about 1¢");
});

test("D70 P3 (c): the summary says which tool the button RUNS — the admin A+ flag is a silent upgrade — and its cost", () => {
  const db = ledger();
  const plain = generationCostSummary(db, { aplusFlag: false });
  assert.equal(plain.runs, "generate");
  assert.match(plain.sentence, /one model call — about 7¢/);
  const aplus = generationCostSummary(db, { aplusFlag: true });
  assert.equal(aplus.runs, "a_plus_resume");
  assert.match(aplus.sentence, /This runs A\+/);
  assert.match(aplus.sentence, /a plain Generate is about 7¢/);
  const route = SERVER.slice(at(SERVER, 'app.get("/api/generate/cost"'), at(SERVER, 'app.post("/api/generate"'));
  assert.match(route, /requireAuth/);
  assert.match(route, /SELECT aplus_resume FROM users WHERE id=\?/, "the same flag /api/generate upgrades with");
  assert.match(route, /generationCostSummary\(db, \{ aplusFlag \}\)/);
});

test("D70 P3 (c): the posting panel shows the cost BEFORE Generate / Regenerate is pressed — a line, never a capsule", () => {
  const panel = lf("client/src/components/JobDetailPanel.jsx");
  assert.match(panel, /api\("\/api\/generate\/cost"\)\.then\(d => \{ if \(!cancelled\) setGenCost\(d\); \}\)/);
  assert.match(panel, /<PostingActions [^>]*cost=\{genCost\}/);
  assert.match(panel, /\{costLine && canGen && onGenerate && <p className="pp__quota" data-generate-cost=\{cost\.runs\}>\{costLine\}<\/p>\}/);
  assert.match(panel, /\(costLabel \? `; one model call, \$\{costLabel\}` : ""\)/, "the button's own title carries it too");
  const line = panel.slice(at(panel, "data-generate-cost"), at(panel, "data-generate-cost") + 200);
  assert.doesNotMatch(line, /999px|rounded-full|borderRadius/, "D60: no pill");
});
