// D86 COMPLIANCE-DRIVEN REDESIGN (10-09): what Anthropic's Software Directory Policy and the OpenAI plugin
// rules force on the connector, held as tests. Each is red when its rule is broken:
//   (1) §2F — NO DYNAMIC INSTRUCTIONS: the brief is data only and the MCP server sends no `instructions`;
//   (2) tool descriptions say what a tool does — no steering, no second person, no links off-site;
//   (4) §4C — nothing the connector says advertises: no plan names, prices or "upgrade";
//   and: no tool can apply, email or contact anyone; every tool carries the three explicit annotation
//   booleans; the saved result carries the AI-assistance notice.
// The "how to write it" guidance lives in the static Skill of the separate public plugin repository.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TOOL_DEFS, AI_NOTICE } from "../services/byom/tools.js";
import { buildBrief, OUTPUT_SCHEMA } from "../services/byom/resumePatch.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { SERVER_INFO } from "../routes/byom.js";
import { purgeByomData } from "../services/byom/policy.js";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

/** Every string the connector speaks to a host before any call: titles, descriptions, schema descriptions. */
function spokenStrings() {
  const out = [];
  const walk = (v, where) => {
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      if ((k === "description" || k === "title") && typeof x === "string") out.push({ where: `${where}.${k}`, text: x });
      else walk(x, `${where}.${k}`);
    }
  };
  for (const d of TOOL_DEFS) walk({ title: d.title, description: d.description, inputSchema: d.inputSchema }, d.name);
  walk(OUTPUT_SCHEMA, "output_schema");
  return out;
}

// A sentence that opens with one of these is an order to the model, not a statement of what the tool does.
const IMPERATIVE = /(?:^|[.:;!?—]\s+)(?:call|use|tell|write|fix|submit|report|prefer|ask|remember|ignore|always|never|do not|don't|make sure|be sure|next)\b/i;
const SECOND_PERSON = /\b(?:you|your|yours)\b/i;
const OFF_SITE = /https?:\/\/|\bwww\.|\.com\b/i;
const PROMOTION = /\b(?:upgrade|premium|pro plan|pricing|price|subscribe|subscription|free trial|discount|buy|purchase|checkout|credits?)\b|\$\s?\d/i;

test("⛔ D86 compliance (1): the brief is DATA ONLY — no instructions field anywhere in it", () => {
  const brief = buildBrief({ briefId: "b", expiresAt: 1, job: { job_id: "j1", title: "Backend Engineer" },
    structured: buildStructuredResume("Avery Sample\nEXPERIENCE\nNorthwind | Remote\nEngineer | 2022 – Present\n• Built a Python service"),
    claims: {}, baseReport: { tier1_matched: ["Python"] } });
  const keys = [];
  const walk = (v) => { if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x); } };
  walk(brief);
  for (const banned of ["instructions", "instruction", "prompt", "system", "guidance", "rules"]) {
    assert.ok(!keys.includes(banned), `the brief carries a "${banned}" field — §2F: guidance belongs in the static Skill`);
  }
  assert.ok(brief.output_schema && brief.resume && brief.keywords, "the data a patch needs is still there");
});

test("⛔ D86 compliance (1): the MCP server sends no `instructions` at initialize", () => {
  const src = read("routes/byom.js");
  assert.doesNotMatch(src, /new Server\([^)]*instructions/s, "new Server(…) is given instructions");
  assert.doesNotMatch(src, /\binstructions\s*:/, "an `instructions:` key in the connector's route");
  for (const f of fs.readdirSync(path.join(root, "services/byom"))) {
    assert.doesNotMatch(read(`services/byom/${f}`), /\binstructions\s*:/, `services/byom/${f} carries an instructions key`);
  }
  assert.deepEqual(Object.keys(SERVER_INFO).sort(), ["name", "version"]);
});

test("⛔ D86 compliance (2): every description says what the tool does — no orders, no second person, no links", () => {
  const spoken = spokenStrings();
  assert.ok(spoken.length >= TOOL_DEFS.length * 2, "the lint sees every tool's title and description");
  for (const { where, text } of spoken) {
    assert.doesNotMatch(text, IMPERATIVE, `${where} steers the model: "${text}"`);
    assert.doesNotMatch(text, SECOND_PERSON, `${where} addresses the model: "${text}"`);
    assert.doesNotMatch(text, OFF_SITE, `${where} links off-site: "${text}"`);
  }
});

test("⛔ D86 compliance (4): nothing the connector says advertises — descriptions, results or refusals", () => {
  for (const { where, text } of spokenStrings()) assert.doesNotMatch(text, PROMOTION, `${where} promotes: "${text}"`);
  // Results and refusals are string literals in these two files; the admin and settings routes are not the connector.
  const tools = read("services/byom/tools.js");
  const leads = read("routes/byom.js").match(/const LEADS = \{[\s\S]*?\n\};/)?.[0];
  assert.ok(leads, "the result lines are found");
  for (const [name, src] of [["services/byom/tools.js", tools], ["routes/byom.js LEADS", leads]]) {
    for (const lit of src.match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []) {
      assert.doesNotMatch(lit, PROMOTION, `${name} promotes: ${lit}`);
    }
  }
});

test("⛔ D86 compliance: no tool can apply, email or contact an employer or anyone else", () => {
  for (const d of TOOL_DEFS) {
    assert.doesNotMatch(d.name, /apply|application|email|mail|contact|message|send|employer|recruiter/i, `tool ${d.name}`);
    assert.equal(d.annotations.openWorldHint, false, `${d.name} reaches outside draft`);
  }
});

test("⛔ D86 compliance: every tool states readOnlyHint, destructiveHint and openWorldHint as explicit booleans", () => {
  for (const d of TOOL_DEFS) {
    for (const k of ["readOnlyHint", "destructiveHint", "openWorldHint"]) {
      assert.equal(typeof d.annotations?.[k], "boolean", `${d.name}.${k}`);
    }
    assert.ok(d.justification?.length > 20, `${d.name} has a written justification`);
  }
});

test("⛔ D86 compliance (3): a finished brief's résumé copy is emptied a day later; the audit is kept 12 months", () => {
  const db = new Database(":memory:");
  db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);");
  db.exec(MIGRATIONS.find(m => m.id === "152_byom_oauth").sql);
  db.prepare("INSERT INTO users (id, username) VALUES (1, 'avery')").run();
  const now = 2_000_000_000, day = 86400;
  const brief = db.prepare(`INSERT INTO byom_briefs (id, user_id, job_id, base_hash, base_json, status, created_at, expires_at, used_at, last_refusal)
    VALUES (?, 1, 'j1', 'h', '{"sections":[1]}', ?, ?, ?, ?, ?)`);
  brief.run("used-old", "used", now - 3 * day, now - 3 * day + 1800, now - 2 * day, null);
  brief.run("used-new", "used", now - 3600, now + 1800, now - 3600, null);
  brief.run("closed-old", "exhausted", now - 2 * day, now - 2 * day + 1800, null, '[{"code":"new_term"}]');
  brief.run("open-live", "open", now - 600, now + 1200, null, '[{"code":"new_term"}]');
  brief.run("open-expired", "open", now - 3 * day, now - 3 * day + 1800, null, '[{"code":"new_term"}]');
  const audit = db.prepare("INSERT INTO mcp_audit (user_id, tool, outcome, at) VALUES (1, 'submit_resume', 'ok', ?)");
  audit.run(now - 400 * day); audit.run(now - 10 * day);

  assert.deepEqual(purgeByomData(db, now), { briefs: 3, audit: 1 });
  const rows = Object.fromEntries(db.prepare("SELECT id, base_json, last_refusal FROM byom_briefs").all().map(r => [r.id, r]));
  for (const id of ["used-old", "closed-old", "open-expired"]) {
    assert.equal(rows[id].base_json, "{}", `${id} keeps its résumé copy`);
    assert.equal(rows[id].last_refusal, null, `${id} keeps its refusal text`);
  }
  assert.notEqual(rows["used-new"].base_json, "{}", "within a day a finished brief is left alone");
  assert.notEqual(rows["open-live"].base_json, "{}", "an open brief still needs its base to check a submission");
  assert.equal(db.prepare("SELECT COUNT(*) FROM byom_briefs").pluck().get(), 5, "rows stay — ids and counts only");
  assert.equal(db.prepare("SELECT COUNT(*) FROM mcp_audit").pluck().get(), 1);
  assert.match(read("server.js"), /purgeByomData\(db\)/, "the sweep is scheduled");
  assert.match(read("client/src/pages/marketing/PrivacyPage.jsx"), /12 months/, "the privacy policy states the retention");
});

test("⛔ D86 compliance: a saved résumé carries the AI-assistance notice", () => {
  assert.match(AI_NOTICE, /AI assistance/);
  assert.match(read("services/byom/tools.js"), /notice: AI_NOTICE/, "submit_resume's result returns the notice");
  assert.match(read("client/src/components/ByomResumeChoice.jsx"), /data-byom-ai-notice/, "draft's own panel says it too");
});
