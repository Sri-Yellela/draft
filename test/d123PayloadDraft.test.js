// D123 P6a / P6d / P6g + the owner's model choice (11-01) — draft's half: the admin's tailoring switch, the person's
// model, the payload's job block, the gists store and the request on the wire (contract 1.8.0).
// Synthetic people and companies; an in-memory database.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { tailoringFor, tailoringState, modelFor, modelSettings, payloadJobKeywords, broaderTerms, TAILORING_KEY,
         MODEL_DEFAULT_KEY, MODELS_OFFERED_KEY } from "../services/leanTailoring.js";
import { generateRequest, RESUME_MASTER_ACCEPTS_PAYLOAD } from "../services/toolsServiceRequests.js";
import { ensureGists, readGists, saveEditedGists, resumeHash, saveCoursework, readCoursework, validateGists } from "../services/resumeGists.js";
import { setSetting, clearSetting } from "../services/appSettings.js";
import { validate } from "../test-support/contractSchema.js";

const lf = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const contract = JSON.parse(lf("contract/resume-master/resume-master-api.v1.json"));
const schemas = contract.components.schemas;

const RESUME = `Alex Rivers
EXPERIENCE
Software Engineer, Quillmark Freight, Denver, CO | Jan 2023 - Present
- Built a REST API in Java serving 40,000 requests a day
- Ran PostgreSQL databases for the booking service
SKILLS
Tools: PostgreSQL, Docker`;

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (7, 'alex', 'x')").run();
  return db;
}

test("d123AdminSwitchWinsOverDeploy: the admin's mode beats DRAFT_TAILORING for everyone; clearing follows the deploy again", () => {
  const db = freshDb();
  assert.equal(tailoringFor({ db, env: { DRAFT_TAILORING: "lean" } }), "lean");
  setSetting(db, TAILORING_KEY, "payload");
  assert.equal(tailoringFor({ db, env: { DRAFT_TAILORING: "lean" } }), "payload");
  assert.equal(tailoringFor({ db, env: {}, isTrial: true }), "payload", "trial accounts follow the admin too");
  assert.equal(tailoringState(db, { DRAFT_TAILORING: "lean" }).source, "override");
  setSetting(db, TAILORING_KEY, "nonsense");
  assert.equal(tailoringFor({ db, env: { DRAFT_TAILORING: "code" } }), "code", "an unknown row is ignored");
  clearSetting(db, TAILORING_KEY);
  assert.equal(tailoringState(db, {}).source, "default");
  assert.equal(tailoringFor({ db, env: {} }), "lean", "owner 11-07: lean when nothing is set");
});

test("d123ModelFromTheUsersSide: a person's pick wins while offered; else the admin's default; none for full / code", () => {
  const db = freshDb();
  assert.deepEqual(modelSettings(db), { default: "service", offered: ["haiku", "sonnet"] });
  assert.equal(modelFor(db, { userId: 7, tailoring: "payload" }), null, "service default: send no model");
  db.prepare("UPDATE users SET tailoring_model='sonnet' WHERE id=7").run();
  assert.equal(modelFor(db, { userId: 7, tailoring: "payload" }), "sonnet");
  assert.equal(modelFor(db, { userId: 7, tailoring: "code" }), null);
  assert.equal(modelFor(db, { userId: 7, tailoring: "full" }), null);
  setSetting(db, MODELS_OFFERED_KEY, "haiku");
  setSetting(db, MODEL_DEFAULT_KEY, "haiku");
  assert.equal(modelFor(db, { userId: 7, tailoring: "lean" }), "haiku", "a pick the admin no longer offers falls to the default");
});

test("d123PayloadJobBlock: must / nice split by the posting's Preferred section, verbs ranked by use, broader terms from part_of edges — valid against 1.8.0", () => {
  const db = freshDb();
  const node = db.prepare("INSERT INTO atlas_nodes (slug, kind, name, term, source) VALUES (?, 'skill', ?, ?, 'owner')");
  const pg = node.run("postgresql", "PostgreSQL", "postgresql").lastInsertRowid;
  const sql = node.run("sql-databases", "SQL databases", "sql databases").lastInsertRowid;
  db.prepare("INSERT INTO atlas_edges (from_id, to_id, type, source) VALUES (?, ?, 'part_of', 'owner')").run(pg, sql);
  const job = { title: "Backend Engineer", company: "Acme", category: "Software", description: "cut",
                description_full: "Requirements\n- Design APIs in Java. Design and build services.\n- SQL databases\nPreferred qualifications\n- Kubernetes" };
  const report = { tier1_matched: ["Java"], tier1_missing: ["SQL databases", "Kubernetes"], claimed_matches: [],
                   action_verbs_matched: ["Build"], action_verbs_missing: ["Design"] };
  const kw = payloadJobKeywords(db, { job, report, resumeText: RESUME });
  assert.deepEqual(kw.mustHave, ["Java", "SQL databases"]);
  assert.deepEqual(kw.niceToHave, ["Kubernetes"]);
  assert.deepEqual(kw.verbs.slice(0, 2), ["Design", "Build"], "the posting's most-used verb first");
  assert.deepEqual(kw.broader, [{ term: "SQL databases", from: "PostgreSQL" }]);
  assert.deepEqual(broaderTerms(db, { resumeText: "no postgres here", missing: ["SQL databases"] }), []);
  assert.equal(RESUME_MASTER_ACCEPTS_PAYLOAD, true);
  assert.equal(contract.info.version, "1.8.0");
  const gists = [{ employer: "Quillmark Freight", text: "Backend engineer on a freight platform." }];
  const body = generateRequest({ profile: {}, job, baseResumeText: RESUME, mode: "GENERATE", tailoring: "payload", keywords: kw,
                                 model: "sonnet", gists, coursework: ["Databases"] });
  assert.equal(body.options.tailoring, "payload");
  assert.equal(body.options.model, "sonnet");
  assert.deepEqual(body.gists, gists);
  assert.deepEqual(body.coursework, ["Databases"]);
  assert.equal(body.job.description, undefined);
  assert.deepEqual(validate(JSON.parse(JSON.stringify(body)), schemas.GenerateRequest, schemas, { strict: true }), []);
  const lean = generateRequest({ profile: {}, job, baseResumeText: RESUME, mode: "GENERATE", tailoring: "lean", keywords: kw, model: "haiku", gists, coursework: ["x"] });
  assert.equal(lean.job.keywords.mustHave, undefined, "lean stays 1.7.0's request");
  assert.equal(lean.gists, undefined);
  assert.equal(lean.coursework, undefined);
  assert.equal(lean.options.model, "haiku");
  const code = generateRequest({ profile: {}, job, baseResumeText: RESUME, mode: "GENERATE", tailoring: "code", keywords: kw, model: "haiku" });
  assert.equal(code.options.model, undefined, "code calls no model");
  assert.deepEqual(validate(JSON.parse(JSON.stringify(code)), schemas.GenerateRequest, schemas, { strict: true }), []);
});

test("p6gGistBuiltOnceStored: one tools-service call per résumé, metered, reused; the person's edit wins; a failure tailors without", async () => {
  const db = freshDb();
  let calls = 0;
  const tools = { configured: true, gists: async () => { calls++; return { gists: [{ employer: "Software Engineer | Quillmark Freight", text: "Backend work." }],
    numberless: [{ employer: "Software Engineer | Quillmark Freight", bullet: "Ran PostgreSQL databases for the booking service" }],
    usage: [{ purpose: "resume_gist", model: "claude-sonnet-5", input_tokens: 10, output_tokens: 5 }] }; } };
  const a = await ensureGists(db, tools, { userId: 7, resumeText: RESUME });
  const b = await ensureGists(db, tools, { userId: 7, resumeText: RESUME });
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  assert.equal(readGists(db, 7, RESUME).numberless.length, 1);
  assert.deepEqual(saveEditedGists(db, 7, resumeHash(RESUME), [{ employer: a[0].employer, text: "My own words." }]), [{ employer: a[0].employer, text: "My own words." }]);
  assert.equal((await ensureGists(db, tools, { userId: 7, resumeText: RESUME }))[0].text, "My own words.");
  assert.match(validateGists([{ employer: "X", text: "y".repeat(401) }]), /at most 400/);
  const broken = { configured: true, gists: async () => { throw Object.assign(new Error("down"), { code: "tools_service_unreachable" }); } };
  assert.deepEqual(await ensureGists(db, broken, { userId: 7, resumeText: RESUME + "\n- changed" }), []);
  assert.deepEqual(saveCoursework(db, 7, ["Databases", "databases", " Operating Systems "]), ["Databases", "Operating Systems"]);
  assert.deepEqual(readCoursework(db, 7), ["Databases", "Operating Systems"]);
  assert.equal(saveCoursework(db, 7, "Databases"), null);
});

test("d123SwitchesWired: the generation reads the admin switch and the model; the routes and both panels exist", () => {
  const server = lf("server.js");
  assert.match(server, /tailoringFor\(\{ db, env: process\.env, isTrial/);
  assert.match(server, /model: leanKeywords \? modelFor\(db, \{ userId, tailoring \}\) : null/);
  for (const r of ['app.get("/api/admin/tailoring"', 'app.put("/api/admin/tailoring"', 'app.delete("/api/admin/tailoring"',
                   'app.get("/api/settings/tailoring-model"', 'app.put("/api/settings/tailoring-model"', 'app.put("/api/profile/gists"',
                   'app.put("/api/profile/coursework"']) assert.ok(server.includes(r), r);
  assert.match(lf("client/src/panels/adminOps.jsx"), /export function TailoringAdminSection/);
  assert.match(lf("client/src/panels/AdminPanel.jsx"), /<TailoringAdminSection theme=\{theme\}\/>/);
  assert.match(lf("client/src/panels/AccountPanel.jsx"), /function TailoringSection\(\)/);
});
