// D86 (owner, 10-09): bring-your-own-model résumés — the row's ⛔ TESTS, each red when its guard is removed.
// The router is the real one (routes/byom.js) on a real port; the schema is migration 152 itself; the
// server.js closure (scorer, store, claim guard) is replaced by small fakes, so what is tested is the door,
// the brief, the patch, the guards and the switches.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createByomRouters } from "../routes/byom.js";
import { buildStructuredResume } from "../services/resumeFormatter.js";
import { buildBrief, applyPatch, termGuard, immutablesChanged, scrubContact, idsFor } from "../services/byom/resumePatch.js";
import { registerClient, issueCode, tokenGrant, getClient, hostForRedirect } from "../services/byom/oauthServer.js";
import { renderConsentPage, NEVER_LIST } from "../services/byom/consentPage.js";

const RESUME = `Avery Sample
avery@example.com | 555-010-0199 | linkedin.com/in/avery-sample
TECHNICAL SKILLS
Languages: Python, Go, SQL
Tools: PostgreSQL, Docker
EXPERIENCE
Northwind Logistics | Remote
Software Engineer | Jan 2022 – Present
• Built a Python service that routes 40,000 shipments a day
• Cut PostgreSQL query time by 60% by redesigning indexes
Contoso Retail | Boston, MA
Junior Developer | Jun 2020 – Dec 2021
• Maintained Go microservices for checkout
EDUCATION
State University | B.S. Computer Science | 2020`;

function setup({ base = RESUME } = {}) {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, location TEXT, description TEXT);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY, user_id INTEGER, job_id TEXT, status TEXT, hidden_at INTEGER, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE resumes (user_id INTEGER, job_id TEXT, company TEXT, role TEXT, ats_score INTEGER, base_ats_score INTEGER, html TEXT, updated_at INTEGER);
    CREATE TABLE resume_versions (user_id INTEGER, job_id TEXT, version INTEGER, ats_score INTEGER);
  `);
  db.exec(MIGRATIONS.find(m => m.id === "152_byom_oauth").sql);
  db.prepare("INSERT INTO users (id, username) VALUES (1, 'avery'), (2, 'blake')").run();
  db.prepare("INSERT INTO scraped_jobs VALUES ('j1', 'Backend Engineer', 'Fabrikam', 'Remote', 'Python, PostgreSQL and Kafka.')").run();
  db.prepare("INSERT INTO apply_run_jobs (user_id, job_id, status) VALUES (1, 'j1', 'queued')").run();
  const state = { base, stored: [], modelCalls: 0 };
  const deps = {
    db, appUrl: "http://draft.test",
    jobFor: (id) => db.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(id) || null,
    baseFor: () => state.base ? { text: state.base, structured: buildStructuredResume(state.base), domainProfile: { id: 7 },
      userProfile: { years_of_experience: 4 }, claims: { skills: ["Terraform"], actionVerbs: [] }, allowSummary: false } : null,
    scoreText: (_u, _j, text) => ({ score: /PostgreSQL/.test(text) ? 70 : 50, tier1_matched: ["Python", "PostgreSQL"], tier1_missing: ["Kafka"], action_verbs_matched: ["Built"] }),
    claimCheck: ({ html }) => ({ violations: /\b9 years\b/.test(html) ? [{ kind: "years_exceed_profile", message: "The résumé claims 9 years; the profile states 4." }] : [] }),
    vocabulary: (_j, r) => ["Python", "Go", "PostgreSQL", "Docker", "Kafka", "Kubernetes", "Terraform", ...(r?.tier1_missing || [])],
    storeResume: (args) => {
      const version = state.stored.length + 1;
      state.stored.push(args);
      db.prepare("INSERT INTO resume_versions VALUES (?,?,?,?)").run(args.userId, args.jobId, version, args.atsScore);
      return { version, resumeId: version };
    },
    notify: () => {},
  };
  return { db, deps, state };
}

async function serve(t, { db, deps }) {
  const app = express();
  let sessionUser = 1;
  const { tokenRouter, sessionRouter } = createByomRouters({ db, deps, production: false, issuerFor: (req) => `http://${req.get("host")}`,
    requireAuth: (req, _res, next) => { req.user = { id: sessionUser }; next(); },
    requireAdmin: (_req, _res, next) => next(), log: { error() {} } });
  app.use(tokenRouter);
  app.use((req, _res, next) => { req.user = { id: sessionUser, username: "avery" }; req.isAuthenticated = () => true; req.session = req.session || {}; next(); });
  app.use(sessionRouter);
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, asUser: (id) => { sessionUser = id; } };
}

/** A token for user 1 with the given scope, minted through the real code exchange. */
function mint(db, base, { scope = "resume:read resume:write", userId = 1 } = {}) {
  const reg = registerClient(db, { redirect_uris: ["http://localhost:9/cb"] }, { production: false });
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const { code, connectionId } = issueCode(db, { userId, client: getClient(db, reg.client_id), redirectUri: "http://localhost:9/cb", scope,
    codeChallenge: challenge, resource: `${base}/mcp` });
  const tok = tokenGrant(db, { grant_type: "authorization_code", code, redirect_uri: "http://localhost:9/cb", client_id: reg.client_id, code_verifier: verifier }, { resource: `${base}/mcp` });
  return { ...tok, connectionId, clientId: reg.client_id };
}

let rpcId = 0;
async function callTool(base, token, name, args = {}) {
  const r = await fetch(`${base}/mcp`, { method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }) });
  if (r.status !== 200) return { status: r.status };
  const body = await r.json();
  return { status: 200, ...body.result };
}

const on = (db) => db.prepare("INSERT INTO app_settings (key, value) VALUES ('byom_enabled', '1')").run();
const userOn = (db, id = 1) => db.prepare("UPDATE users SET byom_enabled = 1 WHERE id = ?").run(id);

test("⛔ D86: a brief contains no contact detail — even one a parse put inside a section", () => {
  const structured = buildStructuredResume(RESUME);
  structured.sections[0].rows?.push({ label: "Contact", values: "reach me at avery@example.com or +1 (555) 010-0199, github.com/avery" });
  const brief = JSON.stringify(buildBrief({ briefId: "b", expiresAt: 1, job: { job_id: "j1" }, structured, claims: {}, baseReport: null }));
  assert.doesNotMatch(brief, /avery@example\.com|555|010-0199|linkedin\.com|github\.com/);
  assert.doesNotMatch(brief, /"header"/, "the header is not in the brief at all");
  assert.equal(scrubContact("call 555-010-0199"), "call [removed]");
});

test("⛔ D86: a patch cannot carry an employer, title or date — and a changed one is caught if it ever could", () => {
  const structured = buildStructuredResume(RESUME);
  const r = applyPatch(structured, { company: "Google", bullets: [] });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some(x => x.code === "unknown_field"));
  const changed = JSON.parse(JSON.stringify(structured));
  changed.sections.find(s => s.type === "entries").entries[0].date = "Jan 2015 – Present";
  assert.equal(immutablesChanged(structured, changed), true);
  assert.equal(immutablesChanged(structured, structured), false);
});

test("⛔ D86: the term guard refuses a term in neither the base résumé nor the claims; a claimed one passes", () => {
  const vocabulary = ["Python", "Kafka", "Terraform", "Go"];
  const claims = { skills: ["Terraform"] };
  const refused = termGuard({ changedText: [{ id: "x", text: "Built a Python and Kafka pipeline" }], baseText: RESUME, claims, vocabulary });
  assert.deepEqual(refused.map(r => r.code), ["new_term"]);
  assert.match(refused[0].message, /Kafka/);
  assert.deepEqual(termGuard({ changedText: [{ id: "x", text: "Provisioned infrastructure with Terraform in Python" }], baseText: RESUME, claims, vocabulary }), []);
  assert.deepEqual(termGuard({ changedText: [{ id: "x", text: "Go live in two weeks" }], baseText: "no go here", claims: {}, vocabulary: ["Go"] }), [],
    "a bullet's first word is English, not the language");
});

test("⛔ D86: a skills row can be reordered or trimmed, never added to", () => {
  const structured = buildStructuredResume(RESUME);
  const ids = idsFor(structured);
  const row = ids.sections.find(s => s.type === "skills").rows[0];
  assert.equal(applyPatch(structured, { skills: [{ id: row.id, values: ["SQL", "Python"] }] }).ok, true);
  const r = applyPatch(structured, { skills: [{ id: row.id, values: ["Python", "Rust"] }] });
  assert.equal(r.ok, false);
  assert.match(r.reasons[0].message, /Rust/);
});

test("⛔ D86: submit — a new term is refused, a clean patch saves, a second use of the brief is refused, the same patch is idempotent", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base);
  const brief = (await callTool(base, access_token, "get_generation_brief", { job_id: "j1" })).structuredContent;
  const b0 = brief.resume.sections.find(s => s.type === "entries").entries[0].bullets[0].id;

  const refused = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: b0, text: "Built a Kafka service" }] } });
  assert.equal(refused.isError, true);
  assert.match(JSON.stringify(refused.structuredContent.reasons), /Kafka/);
  assert.equal(env.state.stored.length, 0, "nothing is saved on a refusal");

  const patch = { bullets: [{ id: b0, text: "Built a Python service on PostgreSQL routing 40,000 shipments a day" }] };
  const saved = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch });
  assert.equal(saved.structuredContent.saved, true);
  assert.equal(saved.structuredContent.base_ats_score, 70);
  assert.equal(env.state.stored.length, 1);
  assert.match(env.state.stored[0].html, /avery@example\.com/, "the server writes the header back");

  const again = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch });
  assert.equal(again.structuredContent.repeated, true);
  assert.equal(env.state.stored.length, 1);
  const other = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: b0, text: "Built a Python service" }] } });
  assert.equal(other.structuredContent.error, "brief_used");
});

test("⛔ D86: the claim guard's refusal (years) reaches the model in plain words", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base);
  const brief = (await callTool(base, access_token, "get_generation_brief", { job_id: "j1" })).structuredContent;
  const b0 = brief.resume.sections.find(s => s.type === "entries").entries[0].bullets[0].id;
  const r = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: b0, text: "Brought 9 years of Python to a service routing shipments" }] } });
  assert.equal(r.isError, true);
  assert.match(r.structuredContent.reasons[0].message, /9 years/);
});

test("⛔ D86: a third failed attempt ends the brief", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base);
  const brief = (await callTool(base, access_token, "get_generation_brief", { job_id: "j1" })).structuredContent;
  for (let i = 0; i < 3; i++) await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: "s9.e9.b9", text: "x" }] } });
  const b0 = brief.resume.sections.find(s => s.type === "entries").entries[0].bullets[0].id;
  const r = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: b0, text: "Built a Python service" }] } });
  assert.equal(r.structuredContent.error, "brief_exhausted");
  assert.equal(env.state.stored.length, 0);
});

test("⛔ D86: a token without resume:write cannot submit", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base, { scope: "resume:read" });
  const brief = (await callTool(base, access_token, "get_generation_brief", { job_id: "j1" })).structuredContent;
  assert.ok(brief.brief_id, "reading is allowed");
  const r = await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: {} });
  assert.equal(r.structuredContent.error, "insufficient_scope");
});

test("⛔ D86: revoking a connection stops its next call", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token, connectionId } = mint(env.db, base);
  assert.equal((await callTool(base, access_token, "list_my_drafts")).status, 200);
  const del = await fetch(`${base}/api/byom/connections/${connectionId}`, { method: "DELETE" });
  assert.equal(del.status, 200);
  assert.equal((await callTool(base, access_token, "list_my_drafts")).status, 401);
});

test("⛔ D86: a revoked CONNECTION stops its tokens even when the tokens themselves were not revoked (a merge drops connections)", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token, connectionId } = mint(env.db, base);
  env.db.prepare("UPDATE oauth_connections SET revoked_at = unixepoch() WHERE id = ?").run(connectionId);
  assert.equal((await callTool(base, access_token, "list_my_drafts")).status, 401);
});

test("⛔ D86: the global switch is OFF by default and refuses every tool call; the user's switch is OFF by default", async (t) => {
  const env = setup();
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base);
  assert.equal(env.db.prepare("SELECT byom_enabled FROM users WHERE id = 1").pluck().get(), 0);
  const r = await callTool(base, access_token, "list_my_drafts");
  assert.equal(r.structuredContent.error, "feature_off");
  on(env.db);
  assert.equal((await callTool(base, access_token, "list_my_drafts")).structuredContent.error, "user_off");
  const settings = await (await fetch(`${base}/api/byom`)).json();
  assert.equal(settings.enabled, false);
});

test("⛔ D86: a disabled host cannot connect, and an unknown host cannot even register", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  assert.equal(hostForRedirect("https://claude.ai/api/mcp/auth_callback"), "claude");
  assert.equal(hostForRedirect("https://chatgpt.com/connector_platform_oauth_redirect"), "chatgpt");
  assert.equal(hostForRedirect("https://evil.example/cb"), null);
  assert.throws(() => registerClient(env.db, { redirect_uris: ["https://evil.example/cb"] }), /Claude and ChatGPT/);
  const reg = registerClient(env.db, { redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] });
  env.db.prepare("INSERT INTO app_settings (key, value) VALUES ('byom_host_claude', '0')").run();
  const { base } = await serve(t, env);
  const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    code_challenge: "a".repeat(43), code_challenge_method: "S256" });
  const page = await (await fetch(`${base}/oauth/authorize?${q}`)).text();
  assert.match(page, /cannot connect right now/);
  assert.doesNotMatch(page, /name="decision" value="allow"/, "no Allow is offered");
});

test("⛔ D86: the consent screen shows the Never list and the privacy sentence, and offers the switch when it is off", () => {
  const html = renderConsentPage({ host: "claude", hostLabel: "Claude", who: "avery@example.com", username: "avery", scopes: ["resume:read", "resume:write"], userOn: false, unavailable: null, nonce: "n" });
  for (const n of NEVER_LIST) assert.ok(html.includes(n), n);
  assert.match(html, /processed by Anthropic under your own Claude account and its terms/);
  assert.match(html, /Signed in as <b>avery@example\.com<\/b>/);
  assert.match(html, /Not you\?/);
  assert.match(html, /name="turn_on" value="1" required/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /999px|border-radius:\s*50%/, "no pills (D60)");
});

test("⛔ D86: the per-user daily cap holds", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  env.db.prepare("INSERT INTO app_settings (key, value) VALUES ('byom_daily_cap', '1')").run();
  env.db.prepare("INSERT INTO byom_briefs (id, user_id, job_id, base_hash, base_json, status, used_at, expires_at) VALUES ('old', 1, 'j1', 'h', '{}', 'used', unixepoch(), 0)").run();
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base);
  const r = await callTool(base, access_token, "get_generation_brief", { job_id: "j1" });
  assert.equal(r.structuredContent.error, "daily_cap");
});

test("⛔ D86: no résumé content appears in the activity list or the admin log", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const { access_token } = mint(env.db, base);
  const brief = (await callTool(base, access_token, "get_generation_brief", { job_id: "j1" })).structuredContent;
  const b0 = brief.resume.sections.find(s => s.type === "entries").entries[0].bullets[0].id;
  await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: b0, text: "Built a Kafka service" }] } });
  await callTool(base, access_token, "submit_resume", { brief_id: brief.brief_id, patch: { bullets: [{ id: b0, text: "Built a Python service on PostgreSQL" }] } });
  const both = JSON.stringify([await (await fetch(`${base}/api/byom`)).json(), await (await fetch(`${base}/api/admin/byom`)).json()]);
  assert.doesNotMatch(both, /shipments|Python service|Kafka service|avery@example/);
  assert.match(both, /submit_resume/);
  const activity = (await (await fetch(`${base}/api/byom`)).json()).activity;
  const refusedRow = activity.find(a => a.tool === "submit_resume" && a.outcome === "refused");
  assert.equal(refusedRow.fixed, true, "a refusal a later submit saved reads Fixed and resent");
  assert.equal(refusedRow.detail, "new_term");
  assert.equal(activity.find(a => a.tool === "submit_resume" && a.outcome === "ok").title, "Backend Engineer", "the activity names the job");
});

test("⛔ D86: a replayed authorization code revokes the tokens it issued", async (t) => {
  const env = setup(); on(env.db); userOn(env.db);
  const { base } = await serve(t, env);
  const reg = registerClient(env.db, { redirect_uris: ["http://localhost:9/cb"] }, { production: false });
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const { code } = issueCode(env.db, { userId: 1, client: getClient(env.db, reg.client_id), redirectUri: "http://localhost:9/cb", scope: "resume:read", codeChallenge: challenge, resource: `${base}/mcp` });
  const body = { grant_type: "authorization_code", code, redirect_uri: "http://localhost:9/cb", client_id: reg.client_id, code_verifier: verifier };
  const first = tokenGrant(env.db, body, { resource: `${base}/mcp` });
  assert.throws(() => tokenGrant(env.db, body, { resource: `${base}/mcp` }), /already used/);
  assert.equal((await callTool(base, first.access_token, "list_my_drafts")).status, 401);
});

test("⛔ D86: no model call is made by draft anywhere in this path", () => {
  const files = ["routes/byom.js", ...fs.readdirSync("services/byom").map(f => path.join("services/byom", f))];
  const banned = /modelCall|toolsService|anthropic|openai|generativeai|@anthropic-ai|anthropicModels|fetch\(/i;
  for (const f of files) {
    const imports = fs.readFileSync(f, "utf8").split(/\r?\n/).filter(l => /^\s*import\b|\bimport\(|require\(/.test(l) || /\bfetch\(/.test(l));
    for (const l of imports) assert.doesNotMatch(l, banned, `${f}: ${l.trim()}`);
  }
});

// ── THE UI (D86 addendum) — source-level, as the client's other guards are.
const src = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");

test("⛔ D86 UI: the Résumé button's one click is unchanged, and the caret renders nothing while the operator's switch is off", () => {
  const panel = src("client/src/components/JobDetailPanel.jsx");
  assert.match(panel, /<DepthButton icon=\{ICONS\.resume\} onClick=\{\(\) => onGenerate\(false\)\}/, "the wide Résumé button still calls Generate");
  assert.match(panel, /<DepthButton size="square" icon=\{ICONS\.resume\} onClick=\{\(\) => onGenerate\(false\)\}/, "the square one too");
  const choice = src("client/src/components/ByomResumeChoice.jsx");
  assert.match(choice, /if \(!byom\?\.available\) return null;/, "no caret while the feature is off");
  assert.match(choice, /available: !!settings\?\.available/);
  assert.match(choice, /localStorage\.getItem\(METHOD_KEY\) \|\| "draft"/, "the default method is draft");
  assert.match(choice, /const method = usable\(chosen\) \? chosen : "draft";/, "a remembered host that is off falls back to draft");
  assert.match(panel, /!byom\.available && \(\s*<DepthButton icon=\{ICONS\.resume\} onClick=\{\(\) => onGenerate\(false\)\}/, "the plain button is drawn while the feature is off");
});

test("⛔ D86 UI: Settings reads \"unavailable\" when the operator's switch is off, and its switch starts from the server's value", () => {
  const p = src("client/src/panels/IntegrationsPanel.jsx");
  assert.match(p, /const unavailable = s\.error \|\| !s\.available;/);
  assert.match(p, /This is unavailable right now/);
  assert.match(p, /<ConsentSwitch checked=\{s\.enabled\}/);
});

test("⛔ D86 UI: after sign-in only an /oauth/authorize return is honoured", async () => {
  const { oauthNext } = await import("../client/src/lib/oauthNext.js");
  assert.equal(oauthNext("?next=%2Foauth%2Fauthorize%3Fclient_id%3Dx"), "/oauth/authorize?client_id=x");
  for (const bad of ["?next=https%3A%2F%2Fevil.example", "?next=%2F%2Fevil.example%2Foauth%2Fauthorize%3F", "?next=%2Fapp", "?next=%2Foauth%2Fauthorize%5C%3F", ""]) {
    assert.equal(oauthNext(bad), null, bad);
  }
});

test("⛔ D86 UI: an externally saved résumé is marked stored, so View reads the store and never generates", () => {
  const p = src("client/src/panels/JobsPanel.jsx");
  assert.match(p, /resume_generated: \(\{ jobId, atsScore \} = \{\}\) => \{[\s\S]{0,400}html: "__exists__"/);
});
