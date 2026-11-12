// ⛔ D171 FIX 1 + FIX 2 (owner 11-06: "the prophetic job run took place, which i suppose the agent triggered" ·
// "theres also an unknown run at 6am utc … 146,348, costing 0.56$") — every run and every model call says WHO started
// it and WHICH KEY paid (migration 224); an agent / test run is refused on a real account in production; Admin → System
// → Model usage shows the spend by hour × event × model × service × key × who; a daily cost alarm; a production key on
// a process that is not production is said at boot.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { trackApiCall } from "../services/usageTracker.js";
import { recordToolsServiceUsage } from "../services/toolsService.js";
import {
  withStartedBy, startedByMiddleware, currentStartedBy, startedByOfRun, agentRunRefusal, SCHEDULER_STARTED, startedByValue,
} from "../services/startedByContext.js";
import {
  usageTable, costAlarmStatus, costAlarmThreshold, setCostAlarmThreshold, checkCostAlarm, resetCostAlarmLog,
  prodKeyOutsideProduction, toolsKeyLabel, draftKeyLabel, COST_ALARM_ENV,
} from "../services/modelUsage.js";
import { startedByPhrase, STARTED_BY_HEADER } from "../shared/startedBy.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
function migrated() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  // Synthetic people (usage_events.user_id is a foreign key).
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'person', 'x'), (2, 'checks', 'x'), (3, 'another', 'x')").run();
  return db;
}
const usage = (i = 1000, o = 200) => ({ input_tokens: i, output_tokens: o });
const lastEvent = (db) => db.prepare("SELECT * FROM usage_events ORDER BY id DESC LIMIT 1").get();
const fakeReq = (over = {}) => ({ headers: {}, get(h) { return this.headers[h.toLowerCase()]; }, ...over });

test("d171StartedByRecorded: a model call records who started it and which key paid — request, daily run, run, header, background", async () => {
  const db = migrated();
  const prev = process.env.ANTHROPIC_KEY_LABEL;
  process.env.ANTHROPIC_KEY_LABEL = "local-dev";
  try {
    const call = () => trackApiCall(db, { userId: 3, eventType: "cover_letter", model: "claude-sonnet-5", usage: usage() });

    call();   // no context: draft itself
    assert.equal(lastEvent(db).started_by, "system");
    assert.equal(lastEvent(db).key_label, "local-dev");

    await withStartedBy(SCHEDULER_STARTED, async () => { await Promise.resolve(); call(); });
    assert.equal(lastEvent(db).started_by, "scheduler", "the daily run's tick, through an await");

    // A request: the middleware opens the context first; the session sets req.user LATER — read lazily.
    const req = fakeReq();
    await new Promise((done) => startedByMiddleware(req, {}, () => { req.user = { id: 3 }; setImmediate(() => { call(); done(); }); }));
    assert.equal(lastEvent(db).started_by, "user");

    // A script says so: the header may DOWNGRADE to agent / test, never claim scheduler / admin / system.
    for (const [header, want] of [["agent:a59LineShots", "agent"], ["test", "test"], ["scheduler", "user"], ["admin", "user"], ["system", "user"]]) {
      const r = fakeReq({ headers: { [STARTED_BY_HEADER]: header }, user: { id: 3 } });
      await new Promise((done) => startedByMiddleware(r, {}, () => { call(); done(); }));
      assert.equal(lastEvent(db).started_by, want, `header ${header}`);
    }
    const agentReq = fakeReq({ headers: { [STARTED_BY_HEADER]: "agent:a59LineShots" }, user: { id: 3 } });
    await new Promise((done) => startedByMiddleware(agentReq, {}, () => { assert.equal(currentStartedBy().ref, "agent:a59LineShots:as user:3"); done(); }));
    // The admin console's session is an admin, whatever the header says.
    const adm = fakeReq({ actor: { kind: "admin", ref: "admin:adm_1" }, headers: { [STARTED_BY_HEADER]: "agent" } });
    await new Promise((done) => startedByMiddleware(adm, {}, () => { call(); done(); }));
    assert.equal(lastEvent(db).started_by, "admin");

    // A run's jobs run as the run's own starter, long after the request.
    await withStartedBy(startedByOfRun({ started_by: "scheduler", started_by_ref: "scheduler" }), async () => call());
    assert.equal(lastEvent(db).started_by, "scheduler");
    assert.equal(startedByOfRun({}).kind, "system", "a run from before 224 reads as system, never a guess at a person");

    // A database before 224 still records the spend.
    const old = new Database(":memory:");
    for (const m of MIGRATIONS) { if (m.id.startsWith("224_")) break; old.exec(m.sql); }
    old.prepare("INSERT INTO users (id, username, password_hash) VALUES (3, 'another', 'x')").run();
    const before = old.prepare("SELECT COUNT(*) FROM usage_events").pluck().get();
    trackApiCall(old, { userId: 3, eventType: "cover_letter", model: "claude-sonnet-5", usage: usage() });
    assert.equal(old.prepare("SELECT COUNT(*) FROM usage_events").pluck().get(), before + 1);
  } finally {
    if (prev === undefined) delete process.env.ANTHROPIC_KEY_LABEL; else process.env.ANTHROPIC_KEY_LABEL = prev;
  }

  // The wiring: middleware first, the tick as the daily run, the run's row and its jobs, the tracker's words.
  const server = read("server.js");
  assert.ok(at(server, "app.use(startedByMiddleware);") < at(server, "app.use(cors({ origin:corsOrigin, credentials:true }));"),
    "the context opens before every router");
  assert.match(server, /setInterval\(\(\) => withStartedBy\(SCHEDULER_STARTED, async \(\) => \{/);
  const apply = read("routes/apply.js");
  assert.match(apply, /UPDATE apply_runs SET started_by = \?, started_by_ref = \? WHERE id = \?"\)\.run\(who\.kind, who\.ref, runId\)/);
  assert.match(apply, /withStartedBy\(startedByOfRun\(run\), \(\) => processRunJob\(job, run\)\)/);
  assert.match(apply, /startedBy: r\.started_by \?\? null/);
  assert.match(apply, /jobs: jobs\.map\(j => \(\{ \.\.\.publicRunJob\(j\), startedBy: run\.started_by \?\? null \}\)\)/);
  assert.match(read("client/src/panels/AutoApplyPanelSections.jsx"), /startedByPhrase\(\{ startedBy: job\.startedBy, at: job\.startedAt \}\)/);
  const at635 = new Date(2026, 10, 6, 6, 35).getTime();
  assert.match(startedByPhrase({ startedBy: "scheduler", at: at635 }), /^Started by the daily run at /);
  assert.match(startedByPhrase({ startedBy: "user", at: at635 }), /^Started by you at /);
  assert.match(startedByPhrase({ startedBy: null, at: at635 }), /^Started at /, "before 224: when, never a guessed who");
});

test("d171NoAgentRunsOnRealAccounts: in production an agent / test run is refused unless the account is a test account", () => {
  const db = migrated();
  db.prepare("UPDATE users SET test_account = 1 WHERE id = 2").run();
  const agent = startedByValue("agent", "agent:walk");
  const refused = agentRunRefusal(db, 1, agent, { production: true });
  assert.equal(refused?.error, "agent_run_refused");
  assert.match(refused.message, /refused on a real account in production/);
  assert.equal(agentRunRefusal(db, 1, startedByValue("test"), { production: true })?.error, "agent_run_refused");
  assert.equal(agentRunRefusal(db, 2, agent, { production: true }), null, "a marked test account takes checks");
  assert.equal(agentRunRefusal(db, 1, agent, { production: false }), null, "a local copy is where agents belong");
  for (const k of ["user", "scheduler", "admin", "system"]) assert.equal(agentRunRefusal(db, 1, startedByValue(k), { production: true }), null, k);
  // The guard runs in startRun BEFORE the run's row is written, and answers 403.
  const apply = read("routes/apply.js");
  const start = apply.slice(at(apply, "function startRun("), at(apply, "INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode)"));
  assert.match(start, /const refusal = agentRunRefusal\(db, userId, who, \{ production: isProductionProcess\(\) \}\);/);
  assert.match(start, /return respond\(403, refusal\);/);
});

test("d171UsageTableByHourEventModelKey: the spend grouped per hour × event × model × service × key × who", () => {
  const db = migrated();
  const now = 1_762_400_000;   // a fixed clock
  const ins = db.prepare(`INSERT INTO usage_events (user_id, event_type, model, input_tokens, output_tokens, cost_usd, success, created_at, route, key_label, started_by)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const hour = Math.floor(now / 3600) * 3600;
  ins.run("resume_generate", "claude-sonnet-5", 6858, 1737, 0.05, 1, hour + 60, "tools-service", "tools-prod", "user");
  ins.run("resume_generate", "claude-sonnet-5", 7000, 1800, 0.06, 0, hour + 120, "tools-service", "tools-prod", "user");
  ins.run("cover_letter", "claude-haiku-4-5", 1000, 200, 0.002, 1, hour + 180, "default", "draft-prod", "scheduler");
  ins.run("cover_letter", "claude-haiku-4-5", 1000, 200, 0.002, 1, hour - 3600 + 10, null, null, null);   // before 224
  ins.run("cover_letter", "claude-haiku-4-5", 1, 1, 9, 1, now - 49 * 3600, null, null, null);              // outside 48 h
  const t = usageTable(db, { hours: 48, now });
  assert.equal(t.totals.calls, 4);
  assert.equal(t.rows.length, 3);
  const gen = t.rows.find(r => r.eventType === "resume_generate");
  assert.deepEqual({ service: gen.service, keyLabel: gen.keyLabel, startedBy: gen.startedBy, calls: gen.calls, failed: gen.failed, tokens: gen.tokens },
    { service: "tools", keyLabel: "tools-prod", startedBy: "user", calls: 2, failed: 1, tokens: 6858 + 1737 + 7000 + 1800 });
  const old = t.rows.find(r => r.keyLabel === "(not recorded)");
  assert.equal(old.startedBy, "(not recorded)", "an older row is never guessed");
  assert.equal(old.service, "draft");
  assert.ok(t.rows[0].hour >= t.rows[t.rows.length - 1].hour, "newest hour first");
  // Served to Admin → System → Model usage.
  assert.match(read("routes/modelGateway.js"), /router\.get\("\/usage",/);
  assert.match(read("client/src/panels/adminMap.js"), /\["usage", "Model usage"\]/);
  // 46f (on purpose): D162 G4's gateway card sits beside the usage table on the same tab.
  assert.match(read("client/src/panels/AdminPanel.jsx"), /\{at\("system", "usage"\) && <><ModelUsageTab\/><ModelGatewaySection\/><FlagsSection\/><\/>\}/);   // A187 (46i): + the runtime flags card
});

test("d171CostAlarm: the admin's threshold › the env var › off; over it — pipeline health, the panel, one log line a day; set with an audit row", () => {
  const db = migrated();
  const env = {};
  assert.deepEqual(costAlarmThreshold(db, env), { usd: null, source: "off" });
  assert.deepEqual(costAlarmThreshold(db, { [COST_ALARM_ENV]: "2" }), { usd: 2, source: "env" });
  setCostAlarmThreshold(db, 0.5, { actor: { kind: "admin", ref: "admin:adm_1" }, reason: "the 11-06 spend" });
  assert.deepEqual(costAlarmThreshold(db, { [COST_ALARM_ENV]: "2" }), { usd: 0.5, source: "admin" }, "the admin's setting wins");
  const audit = db.prepare("SELECT action, reason FROM admin_audit_log ORDER BY id DESC LIMIT 1").get();
  assert.deepEqual(audit, { action: "model_cost_alarm.set", reason: "the 11-06 spend" });
  assert.throws(() => setCostAlarmThreshold(db, -1, {}), /positive number/);

  const now = 1_762_400_000;
  const day = Math.floor(now / 86400) * 86400;
  const ins = db.prepare("INSERT INTO usage_events (user_id, event_type, model, cost_usd, created_at, key_label) VALUES (1, 'x', 'm', ?, ?, ?)");
  ins.run(0.3, day + 10, "draft-prod");
  ins.run(5, day - 10, "draft-prod");   // yesterday: not today's spend
  assert.equal(costAlarmStatus(db, { env, now }).over, false);
  ins.run(0.3, day + 20, "local-dev");
  const st = costAlarmStatus(db, { env, now });
  assert.equal(st.over, true);
  assert.equal(st.spentUsd, 0.6);
  assert.deepEqual(st.byKey.map(k => k.keyLabel).sort(), ["draft-prod", "local-dev"]);

  const lines = [];
  resetCostAlarmLog();
  checkCostAlarm(db, { env, now, force: true, log: (l) => lines.push(l) });
  checkCostAlarm(db, { env, now: now + 120, force: true, log: (l) => lines.push(l) });
  assert.equal(lines.length, 1, "once a day");
  assert.match(lines[0], /\[usage\] COST ALARM .*\$0\.60 .*over the \$0\.50 alarm/);
  setCostAlarmThreshold(db, null, { reason: "off again" });
  assert.equal(costAlarmThreshold(db, env).source, "off");

  // Raised by pipeline health and served to the panel; the recorder checks it after each call.
  assert.match(read("routes/adminDb.js"), /const c = costAlarmStatus\(db, \{ now \}\);\n\s+if \(c\.over\) push\("warn", "model_cost"/);
  assert.match(read("routes/modelGateway.js"), /router\.post\("\/cost-alarm",/);
  assert.match(read("services/usageTracker.js"), /try \{ checkCostAlarm\(db\); \} catch/);
});

test("d171UsageCoversToolsService: the tools service's records land with ITS key label and read as the tools service", () => {
  const db = migrated();
  const prev = process.env.TOOLS_SERVICE_KEY_LABEL;
  delete process.env.TOOLS_SERVICE_KEY_LABEL;
  try {
    recordToolsServiceUsage(db, [{ purpose: "resume_generate", model: "claude-sonnet-5", input_tokens: 6858, output_tokens: 1737, key_label: "tools-prod" }], { userId: 1 });
    assert.equal(lastEvent(db).key_label, "tools-prod");
    assert.equal(lastEvent(db).route, "tools-service");
    process.env.TOOLS_SERVICE_KEY_LABEL = "rm-railway";
    recordToolsServiceUsage(db, [{ purpose: "resume_generate", model: "claude-sonnet-5", input_tokens: 10, output_tokens: 1 }], { userId: 1 });
    assert.equal(lastEvent(db).key_label, "rm-railway", "this deploy's name for the tools service's key");
    delete process.env.TOOLS_SERVICE_KEY_LABEL;
    assert.equal(toolsKeyLabel({}, {}), "tools-service (unlabelled)", "never draft's own label");
    const t = usageTable(db, { hours: 1 });
    assert.ok(t.rows.every(r => r.service === "tools"));
  } finally {
    if (prev === undefined) delete process.env.TOOLS_SERVICE_KEY_LABEL; else process.env.TOOLS_SERVICE_KEY_LABEL = prev;
  }
});

test("d171NoProdKeyOutsideProduction: a production-labelled key on a process that is not production is said at boot", () => {
  assert.equal(prodKeyOutsideProduction({ ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: "local-dev" }), null);
  assert.equal(prodKeyOutsideProduction({ ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: "draft-prod", NODE_ENV: "production" }), null);
  assert.equal(prodKeyOutsideProduction({ ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: "draft-prod", RAILWAY_ENVIRONMENT_NAME: "production" }), null);
  assert.equal(prodKeyOutsideProduction({ ANTHROPIC_KEY: "", ANTHROPIC_KEY_LABEL: "draft-prod" }), null, "no key, nothing to spend");
  assert.match(prodKeyOutsideProduction({ ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: "draft-prod", NODE_ENV: "development" }),
    /\[boot\] ⛔ MODEL KEY: this process is not production .* labelled "draft-prod"/);
  assert.equal(prodKeyOutsideProduction({ ANTHROPIC_KEY: "k", ANTHROPIC_KEY_LABEL: "reproduce" }), null, "a word that merely contains 'prod' is not a label");
  assert.equal(draftKeyLabel({}), "(unlabelled)");
  const server = read("server.js");
  const boot = server.slice(at(server, "console.log(`[boot] model key: label="), at(server, "const toolsService = createToolsServiceClient();"));
  assert.match(boot, /const prodKeyWarning = prodKeyOutsideProduction\(process\.env\);\n\s+if \(prodKeyWarning\) console\.error\(prodKeyWarning\);/);
});
