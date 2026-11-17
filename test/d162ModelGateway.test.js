// ⛔⛔ D162 G1–G4 · THE MODEL GATEWAY — routing by config, the switch and the rollback without a deploy, shadow before
// default, the pass rule before a takeover, telemetry per task × model, source-tagged outputs, and the training gate.
// No real model is called: a stub client stands in for the provider. Synthetic data only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";

import { MIGRATIONS } from "../scripts/migrations.js";
import { TASKS, TASK_IDS, taskOf, taskForPurpose, pinnedModelIds, isIncumbent } from "../shared/modelTasks.js";
import { MODEL_HAIKU, MODEL_SONNET } from "../shared/anthropicModels.js";
import { callTask, resolveRoute, effectiveRoute, applyRouteChange, rollbackRoute, routeHistory, taskTelemetry,
         settleShadows, sourceOf, cohortBucket, ROUTE_KEY_PREFIX, SHADOW_EVENT_TYPE } from "../services/modelGateway.js";
import { recordEval, passRule, canTakeTask, EVAL_SETS } from "../services/modelEvals.js";
import { assertTrainingRows, trainingRefusal } from "../services/trainingData.js";
import { recordToolsServiceUsage, TOOLS_SERVICE_TASKS } from "../services/toolsService.js";
import { fenceUntrusted } from "../services/untrustedText.js";

const TASK = "cover_letter.write";
const ADMIN = { kind: "admin", ref: "admin:adm_test", userId: null, adminId: 1 };

function makeDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY);
    INSERT INTO users (id) VALUES (0), (1), (2);
    CREATE TABLE usage_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, event_type TEXT NOT NULL,
      event_subtype TEXT, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0, cache_creation_tokens INTEGER DEFAULT 0,
      cached INTEGER NOT NULL DEFAULT 0, model TEXT, cost_usd REAL DEFAULT 0,
      ats_score_before INTEGER, ats_score_after INTEGER, duration_ms INTEGER, job_id TEXT,
      company TEXT, success INTEGER NOT NULL DEFAULT 1, error_text TEXT, purpose TEXT, provider TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE cache_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, event_type TEXT, layer TEXT,
      domain_module TEXT, tokens_in_cache INTEGER, tokens_saved INTEGER, cost_saved_usd REAL, model TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE usage_tracking_failures (id INTEGER PRIMARY KEY AUTOINCREMENT, model TEXT, purpose TEXT, user_id INTEGER,
      error_text TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL DEFAULT (unixepoch()));
    CREATE TABLE admin_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL DEFAULT (unixepoch()),
      admin_user_id INTEGER, action TEXT NOT NULL, target TEXT, before_json TEXT, after_json TEXT, undone_at INTEGER,
      reason TEXT, actor_kind TEXT, actor TEXT);
  `);
  // The REAL migration 221, so the test runs against the schema production gets.
  db.exec(MIGRATIONS.find(m => m.id === "221_model_gateway").sql);
  return db;
}

function stubAnthropic({ failModels = [], failWith = "overloaded_error" } = {}) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (params) => {
        calls.push(params);
        if (failModels.includes(params.model)) throw Object.assign(new Error(failWith), { status: 529 });
        return { content: [{ type: "text", text: `letter from ${params.model}` }], usage: { input_tokens: 100, output_tokens: 50 } };
      },
    },
  };
}

// 45n D173 (1) tail (a0b18362): cover_letter.write declares the posting untrusted, and callTask refuses it unfenced — the
// fixture now sends its posting fenced, as the real call sites do (fixture moved on purpose; the refusal is the gateway's).
const msgs = [{ role: "user", content: `Write a cover letter for Pat Example.\n${fenceUntrusted("posting", "Data Engineer at Northwind.")}` }];
const passingMetrics = { sampleSize: 25, errorRate: 0, blindWinOrTieRate: 0.6, costPerCallUsd: 0.004, latencyP50Ms: 3000, latencyP95Ms: 9000 };
const NOENV = {};

// ── G1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("D162 G1: the registry holds every task the spec names, plus today's call sites, each with an eval set", () => {
  for (const id of ["resume.gist", "resume.bullets", "resume.summary", "answers.routine", "assistant.chat", "assistant.plan_action",
                    "interview.mock", "interview.feedback", "interview.example_answer", "learn.explain", "content.draft_for_review",
                    "cover_letter.write", "profile.domain_chips", "resume.generate", "resume.enhance"]) {
    assert.ok(TASKS[id], `missing task ${id}`);
    assert.ok(EVAL_SETS[TASKS[id].evalSet], `${id}: unknown eval set ${TASKS[id].evalSet}`);
  }
  for (const id of TASK_IDS) {
    const t = TASKS[id];
    if (t.runsIn === "draft") assert.ok(t.defaultRoute?.budget, `${id}: a draft task needs a default route with a budget`);
  }
  assert.throws(() => taskOf("cover_letter"), /unknown model task/);
  assert.equal(taskForPurpose("cover_letter_apply"), "cover_letter.write");
  assert.equal(taskForPurpose("resume_tailor"), "resume.bullets");
  assert.equal(taskForPurpose("never_heard_of_it"), null);
});

test("D162 G1: behaviour is unchanged by default — the defaults are today's model and max_tokens, no fallback", () => {
  assert.deepEqual({ ...TASKS["cover_letter.write"].defaultRoute.params }, { max_tokens: 800 });
  assert.equal(TASKS["cover_letter.write"].defaultRoute.model, MODEL_HAIKU);
  assert.equal(TASKS["cover_letter.write"].defaultRoute.fallback, null);
  assert.deepEqual({ ...TASKS["profile.domain_chips"].defaultRoute.params }, { max_tokens: 600 });
  assert.equal(TASKS["profile.domain_chips"].defaultRoute.model, MODEL_HAIKU);
  assert.deepEqual(pinnedModelIds(), [MODEL_HAIKU, MODEL_SONNET], "the boot catalogue check asks about the same two models");
});

test("D162 G1: today's call sites name a task, and the tools-service client names its tasks", () => {
  const server = fs.readFileSync("server.js", "utf8");
  assert.equal((server.match(/callTask\(\{\s*task: "cover_letter\.write"/g) || []).length, 2);
  assert.match(fs.readFileSync("routes/domainProfiles.js", "utf8"), /callTask\(\{\s*task: "profile\.domain_chips"/);
  for (const t of Object.values(TOOLS_SERVICE_TASKS)) assert.equal(TASKS[t]?.runsIn, "tools-service", t);
});

test("D162 G1: callTask refuses a model named by the feature, an unknown task, and a tools-service task", async () => {
  const db = makeDb(); const anthropic = stubAnthropic();
  await assert.rejects(() => callTask({ task: TASK, anthropic, db, model: MODEL_SONNET, messages: msgs, env: NOENV }), /does not name a model/);
  await assert.rejects(() => callTask({ task: "nope", anthropic, db, messages: msgs, env: NOENV }), /unknown model task/);
  await assert.rejects(() => callTask({ task: "resume.gist", anthropic, db, messages: msgs, env: NOENV }), /runs in the tools-service/);
  await assert.rejects(() => callTask({ task: TASK, purpose: "domain_chips", anthropic, db, messages: msgs, env: NOENV }), /not one of the task's/);
  assert.equal(anthropic.calls.length, 0);
});

// ── G2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("D162 d162RoutingByConfig: registry default, then the environment's MODEL_ROUTES, then the runtime row", async () => {
  const db = makeDb(); const anthropic = stubAnthropic();
  await callTask({ task: TASK, anthropic, db, userId: 1, messages: msgs, env: NOENV });
  assert.equal(anthropic.calls[0].model, MODEL_HAIKU);
  assert.equal(anthropic.calls[0].max_tokens, 800);

  // Per environment: a staging deploy sets MODEL_ROUTES. Sonnet is unproven for this task until an eval passes.
  const env = { MODEL_ROUTES: JSON.stringify({ [TASK]: { model: MODEL_SONNET, params: { max_tokens: 900 } } }) };
  await assert.rejects(() => callTask({ task: TASK, anthropic, db, userId: 1, messages: msgs, env }), /no passing evaluation/);
  recordEval(db, { task: TASK, provider: "anthropic", model: MODEL_SONNET, metrics: { ...passingMetrics, costPerCallUsd: 0.009 }, reason: "synthetic run", actor: "admin:adm_test" });
  await callTask({ task: TASK, anthropic, db, userId: 1, messages: msgs, env });
  assert.equal(anthropic.calls.at(-1).model, MODEL_SONNET);
  assert.equal(anthropic.calls.at(-1).max_tokens, 900);
  assert.equal(effectiveRoute(db, TASK, { env }).layer, "env");

  // A provider draft cannot call is refused, never swapped for another (D123 P3's rule).
  const open = { MODEL_ROUTES: JSON.stringify({ [TASK]: { provider: "openai-compatible", model: "some-open-model" } }) };
  await assert.rejects(() => callTask({ task: TASK, anthropic, db, messages: msgs, env: open }), /cannot serve a draft task/);
  await assert.rejects(() => callTask({ task: TASK, anthropic, db, messages: msgs, env: { MODEL_ROUTES: "{not json" } }), /not JSON/);
  await assert.rejects(() => callTask({ task: TASK, anthropic, db, messages: msgs, env: { MODEL_ROUTES: '{"no.such":{}}' } }), /unknown task/);
});

test("D162 d162SwitchWithoutDeploy: a runtime change takes effect on the next call, recorded with who / when / why", async () => {
  const db = makeDb(); const anthropic = stubAnthropic();
  assert.throws(() => applyRouteChange(db, TASK, { op: "params", params: { max_tokens: 700 }, actor: ADMIN, env: NOENV }), /say why/);
  applyRouteChange(db, TASK, { op: "params", params: { max_tokens: 700 }, reason: "letters run long", actor: ADMIN, env: NOENV });
  await callTask({ task: TASK, anthropic, db, userId: 1, messages: msgs, env: NOENV });
  assert.equal(anthropic.calls[0].max_tokens, 700, "no restart, no deploy: the row is read at call time");
  const [h] = routeHistory(db, TASK);
  assert.equal(h.op, "params"); assert.equal(h.actor, "admin:adm_test"); assert.equal(h.reason, "letters run long");
  assert.ok(h.at > 0); assert.equal(h.before, null); assert.deepEqual(h.after, { params: { max_tokens: 700 } });
  assert.throws(() => applyRouteChange(db, TASK, { op: "params", params: { max_tokens: 700, seed: 1 }, reason: "x", actor: ADMIN, env: NOENV }), /not one a route may set/);
  assert.throws(() => applyRouteChange(db, "resume.gist", { op: "params", params: {}, reason: "x", actor: ADMIN, env: NOENV }), /switch it there/);
});

test("D162 d162RollbackInstant: one call puts the route back, and repeated rollbacks walk back", async () => {
  const db = makeDb(); const anthropic = stubAnthropic();
  applyRouteChange(db, TASK, { op: "params", params: { max_tokens: 700 }, reason: "one", actor: ADMIN, env: NOENV });
  applyRouteChange(db, TASK, { op: "params", params: { max_tokens: 650 }, reason: "two", actor: ADMIN, env: NOENV });
  rollbackRoute(db, TASK, { reason: "two was worse", actor: ADMIN, env: NOENV });
  await callTask({ task: TASK, anthropic, db, messages: msgs, env: NOENV });
  assert.equal(anthropic.calls.at(-1).max_tokens, 700);
  rollbackRoute(db, TASK, { reason: "back to the default", actor: ADMIN, env: NOENV });
  assert.equal(db.prepare("SELECT value FROM app_settings WHERE key = ?").get(ROUTE_KEY_PREFIX + TASK), undefined);
  await callTask({ task: TASK, anthropic, db, messages: msgs, env: NOENV });
  assert.equal(anthropic.calls.at(-1).max_tokens, 800);
  assert.throws(() => rollbackRoute(db, TASK, { reason: "again", actor: ADMIN, env: NOENV }), /nothing to roll back/);
  const ops = routeHistory(db, TASK).map(h => h.op);
  assert.deepEqual(ops, ["rollback", "rollback", "params", "params"]);
});

test("D162 d162ShadowBeforeDefault: shadow → a % → default → promote, one stage at a time; shadow output is discarded", async () => {
  const db = makeDb(); const anthropic = stubAnthropic();
  const change = (op, extra = {}) => applyRouteChange(db, TASK, { op, reason: `synthetic ${op}`, actor: ADMIN, env: NOENV, ...extra });
  // Out of order is refused.
  assert.throws(() => change("default"), /only after a cohort/);
  assert.throws(() => change("cohort", { percent: 10 }), /starts from a shadow/);

  change("shadow", { provider: "anthropic", model: MODEL_SONNET });
  const out = await callTask({ task: TASK, anthropic, db, userId: 1, messages: msgs, env: NOENV });
  await settleShadows();
  assert.equal(out.content[0].text, `letter from ${MODEL_HAIKU}`, "the user sees the serving model's output");
  assert.deepEqual(anthropic.calls.map(c => c.model), [MODEL_HAIKU, MODEL_SONNET], "the candidate ran beside it");
  const shadowRow = db.prepare("SELECT * FROM usage_events WHERE route = 'shadow'").get();
  assert.equal(shadowRow.model, MODEL_SONNET);
  assert.equal(shadowRow.event_type, SHADOW_EVENT_TYPE, "a shadow call never counts against the person's allowance");

  assert.throws(() => change("cohort", { percent: 10 }), /no passing evaluation/, "a cohort serves users: it needs a pass");
  recordEval(db, { task: TASK, provider: "anthropic", model: MODEL_SONNET, metrics: { ...passingMetrics, costPerCallUsd: 0.009 }, reason: "synthetic run", actor: "admin:adm_test" });
  assert.throws(() => change("cohort", { percent: 100 }), /1–99/);
  change("cohort", { percent: 50 });
  for (const uid of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const r = resolveRoute(db, TASK, { userId: uid, env: NOENV });
    assert.equal(r.serve.model, cohortBucket(TASK, uid) < 50 ? MODEL_SONNET : MODEL_HAIKU, `user ${uid}: a stable bucket`);
  }
  change("default");
  assert.equal(resolveRoute(db, TASK, { userId: 1, env: NOENV }).serve.model, MODEL_SONNET);
  change("promote");
  const eff = effectiveRoute(db, TASK, { env: NOENV });
  assert.equal(eff.model, MODEL_SONNET); assert.equal(eff.candidate, null);
  // And one rollback undoes the promotion.
  rollbackRoute(db, TASK, { reason: "undo promote", actor: ADMIN, env: NOENV });
  assert.equal(effectiveRoute(db, TASK, { env: NOENV }).candidate.stage, "default");
});

test("D162 G2: a fallback serves only when the model is down — never for a billing or key failure", async () => {
  const db = makeDb();
  recordEval(db, { task: TASK, provider: "anthropic", model: MODEL_SONNET, metrics: { ...passingMetrics, costPerCallUsd: 0.009 }, reason: "synthetic run", actor: "admin:adm_test" });
  applyRouteChange(db, TASK, { op: "fallback", fallback: { provider: "anthropic", model: MODEL_SONNET }, reason: "Haiku outages", actor: ADMIN, env: NOENV });
  const down = stubAnthropic({ failModels: [MODEL_HAIKU] });
  const out = await callTask({ task: TASK, anthropic: down, db, userId: 1, messages: msgs, env: NOENV });
  assert.equal(sourceOf(out).model, MODEL_SONNET); assert.equal(sourceOf(out).route, "fallback");
  const unfunded = stubAnthropic({ failModels: [MODEL_HAIKU], failWith: "Your credit balance is too low" });
  await assert.rejects(() => callTask({ task: TASK, anthropic: unfunded, db, userId: 1, messages: msgs, env: NOENV }), /credit balance/);
  assert.equal(unfunded.calls.length, 1, "no second call for a failure the fallback would repeat");
});

test("46q: a DEFAULT route's un-evaluated fallback is dropped, not fatal — assistant.chat serves its evaluated primary", async () => {
  const db = makeDb();
  assert.ok(TASKS["assistant.chat"].defaultRoute.fallback, "the registry names a fallback for assistant.chat");
  assert.equal(canTakeTask(db, "assistant.chat", "anthropic", MODEL_SONNET), false, "no eval recorded for the fallback");
  const amsgs = [{ role: "user", content: `${fenceUntrusted("question", "rewrite this bullet")}
${fenceUntrusted("retrieved", "(nothing found)")}` }];
  const r = resolveRoute(db, "assistant.chat", { userId: 1, env: NOENV });
  assert.equal(r.serve.model, MODEL_HAIKU); assert.equal(r.fallback, null, "the un-evaluated fallback is never served");
  const up = stubAnthropic();
  const out = await callTask({ task: "assistant.chat", anthropic: up, db, userId: 1, messages: amsgs, env: NOENV });
  assert.equal(sourceOf(out).model, MODEL_HAIKU); assert.equal(up.calls.length, 1);
  const down = stubAnthropic({ failModels: [MODEL_HAIKU] });
  await assert.rejects(() => callTask({ task: "assistant.chat", anthropic: down, db, userId: 1, messages: amsgs, env: NOENV }));
  assert.equal(down.calls.length, 1, "no call to the un-evaluated fallback when the primary is down");
  recordEval(db, { task: "assistant.chat", provider: "anthropic", model: MODEL_SONNET, reason: "synthetic run", actor: "admin:adm_test",
    metrics: { answerCorrectness: 0.95, unconfirmedActions: 0, outOfScopeActions: 0, cases: 60, costPerCallUsd: 0.009 } });
  if (canTakeTask(db, "assistant.chat", "anthropic", MODEL_SONNET)) assert.equal(resolveRoute(db, "assistant.chat", { userId: 1, env: NOENV }).fallback.model, MODEL_SONNET, "once evaluated, the fallback is back");
});

// ── G3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("D162 d162PassRuleBeforeTakeover: the server applies the pass rule; a failing or stale record does not open the gate", () => {
  const db = makeDb();
  assert.equal(canTakeTask(db, TASK, "anthropic", MODEL_HAIKU), true, "the incumbent needs no record");
  assert.equal(isIncumbent(TASK, "anthropic", MODEL_SONNET), false);
  assert.equal(canTakeTask(db, TASK, "anthropic", MODEL_SONNET), false);

  const failing = recordEval(db, { task: TASK, provider: "anthropic", model: MODEL_SONNET, reason: "synthetic run", actor: "admin:adm_test",
    metrics: { ...passingMetrics, blindWinOrTieRate: 0.3, latencyP95Ms: 40_000, passed: true } });
  assert.equal(failing.passed, false, "`passed: true` in the metrics is ignored");
  assert.ok(failing.reasons.some(r => /blindWinOrTieRate/.test(r)) && failing.reasons.some(r => /p95/.test(r)));
  assert.equal(canTakeTask(db, TASK, "anthropic", MODEL_SONNET), false);
  assert.throws(() => applyRouteChange(db, TASK, { op: "fallback", fallback: { provider: "anthropic", model: MODEL_SONNET }, reason: "x", actor: ADMIN, env: NOENV }), /no passing evaluation/);

  assert.throws(() => recordEval(db, { task: TASK, provider: "anthropic", model: MODEL_SONNET, metrics: passingMetrics }), /say why/);
  recordEval(db, { task: TASK, provider: "anthropic", model: MODEL_SONNET, metrics: { ...passingMetrics, costPerCallUsd: 0.009 }, reason: "synthetic run 2", actor: "admin:adm_test" });
  assert.equal(canTakeTask(db, TASK, "anthropic", MODEL_SONNET), true);

  // A record for an older version of the set does not count.
  db.prepare("UPDATE model_eval_records SET eval_set_version = 0").run();
  assert.equal(canTakeTask(db, TASK, "anthropic", MODEL_SONNET), false);
});

test("D162 G3: each eval set's rule — résumé needs the incumbent's numbers and a lower cost; the assistant needs zero unsafe actions", () => {
  const harness = { sampleSize: 40, errorRate: 0.01, blindWinOrTieRate: 0.55, guardPassRate: 0.97, atsLift: 9, costPerCallUsd: 0.01 };
  assert.equal(passRule("resume.bullets", harness).passed, false, "no baseline, no verdict");
  assert.equal(passRule("resume.bullets", harness, { guardPassRate: 0.96, atsLift: 9.5, costPerCallUsd: 0.02 }).passed, true);
  const pricier = passRule("resume.bullets", harness, { guardPassRate: 0.96, atsLift: 9.5, costPerCallUsd: 0.005 });
  assert.equal(pricier.passed, false); assert.ok(pricier.reasons.some(r => /not below the incumbent/.test(r)));
  const assistant = { sampleSize: 60, errorRate: 0, answerCorrectness: 0.95, unconfirmedActions: 0, outOfScopeActions: 0,
                      costPerCallUsd: 0.005, latencyP50Ms: 2000, latencyP95Ms: 8000 };
  assert.equal(passRule("assistant.plan_action", assistant).passed, true);
  assert.equal(passRule("assistant.plan_action", { ...assistant, unconfirmedActions: 1 }).passed, false);
  assert.equal(passRule("interview.mock", { sampleSize: 20, errorRate: 0, ownerRubricMean: 3.9, costPerCallUsd: 0.001, latencyP50Ms: 1000, latencyP95Ms: 3000 }).passed, false);
});

// ── G4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("D162 d162TelemetryPerTaskModel: every call records task, provider, model, tokens, latency and outcome; summed per task × model", async () => {
  const db = makeDb();
  await callTask({ task: TASK, anthropic: stubAnthropic(), db, userId: 1, purpose: "cover_letter_apply", jobId: "j-1", messages: msgs, env: NOENV });
  await callTask({ task: "profile.domain_chips", anthropic: stubAnthropic(), db, userId: 2, messages: msgs, env: NOENV });
  await assert.rejects(() => callTask({ task: TASK, anthropic: stubAnthropic({ failModels: [MODEL_HAIKU] }), db, userId: 1, messages: msgs, env: NOENV }));
  const rows = db.prepare("SELECT task, route, provider, model, purpose, event_type, input_tokens, output_tokens, success, duration_ms FROM usage_events ORDER BY id").all();
  assert.deepEqual(rows.map(r => [r.task, r.route, r.provider, r.model, r.purpose, r.success]), [
    [TASK, "default", "anthropic", MODEL_HAIKU, "cover_letter_apply", 1],
    ["profile.domain_chips", "default", "anthropic", MODEL_HAIKU, "domain_chips", 1],
    [TASK, "default", "anthropic", MODEL_HAIKU, "cover_letter", 0],
  ]);
  assert.equal(rows[0].event_type, "cover_letter_apply", "event_type keeps its vocabulary: limitEnforcer keys on it");
  assert.equal(rows[0].input_tokens, 100); assert.ok(rows[0].duration_ms !== undefined);

  // A tools-service usage record is tagged with its task and the provider the service reports.
  recordToolsServiceUsage(db, [{ purpose: "resume_tailor", model: MODEL_HAIKU, input_tokens: 10, output_tokens: 5, duration_ms: 1200 }], { userId: 1 });
  recordToolsServiceUsage(db, [{ purpose: "resume_gist", provider: "openai-compatible", model: "an-open-model", input_tokens: 9, output_tokens: 3 }], { userId: 1 });
  const tools = db.prepare("SELECT task, route, provider FROM usage_events WHERE route = 'tools-service' ORDER BY id").all();
  assert.deepEqual(tools.map(r => [r.task, r.provider]), [["resume.bullets", "anthropic"], ["resume.gist", "openai-compatible"]]);

  // A row from before migration 221 is attributed by its purpose.
  db.prepare("INSERT INTO usage_events (user_id, event_type, purpose, model, provider, duration_ms) VALUES (1, 'cover_letter', 'cover_letter', ?, 'anthropic', 4000)").run(MODEL_HAIKU);
  const t = taskTelemetry(db);
  const cl = t.find(g => g.task === TASK && g.model === MODEL_HAIKU);
  assert.equal(cl.calls, 3); assert.equal(cl.errors, 1);
  assert.ok(cl.latencyP50Ms !== null && cl.latencyP95Ms >= cl.latencyP50Ms);
  assert.ok(t.find(g => g.task === "resume.gist" && g.provider === "openai-compatible"));
  assert.ok(cl.overBudget && typeof cl.overBudget.cost === "boolean");
});

test("D162 d162SourceTaggedOutputs: every gateway output carries its source; the message's own shape is unchanged", async () => {
  const db = makeDb();
  const out = await callTask({ task: TASK, anthropic: stubAnthropic(), db, userId: 1, messages: msgs, env: NOENV });
  assert.deepEqual({ ...sourceOf(out) }, { provider: "anthropic", model: MODEL_HAIKU, task: TASK, route: "default", claude: true });
  assert.deepEqual(Object.keys(out).sort(), ["content", "usage"], "non-enumerable: res.json(message) and callers see what they saw before");
  assert.equal(JSON.stringify(out).includes("source"), false);
});

test("D162 d162TrainingRefusesClaudeRows: a dataset build refuses Claude-sourced and untagged rows, loudly", async () => {
  const db = makeDb();
  const out = await callTask({ task: TASK, anthropic: stubAnthropic(), db, userId: 1, messages: msgs, env: NOENV });
  const rows = [
    { text: "a curator's example", source: { provider: "human" } },
    { text: out.content[0].text, source: sourceOf(out) },
    { text: "no idea who wrote this" },
    { text: "an open model's output", source: { provider: "openai-compatible", model: "an-open-model", claude: false } },
    { text: "mislabelled", source: { provider: "openai-compatible", model: "claude-imitation", claude: false } },
  ];
  assert.throws(() => assertTrainingRows(rows), (e) => e.code === "training_refuses_claude_rows" && e.refused.length === 3);
  const { rows: ok, refused } = assertTrainingRows(rows, { dropRefused: true });
  assert.deepEqual(ok.map(r => r.text), ["a curator's example", "an open model's output"]);
  assert.match(refused[0].why, /Claude call/);
  assert.match(trainingRefusal({ source: { provider: "unknown-co", model: "m" } }), /unknown provider/);
});
