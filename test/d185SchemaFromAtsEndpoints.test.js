// D185-1 (45q, owner 11-09) · the application-schema reader: a posting's real questions from its ATS's DOCUMENTED public
// endpoint, cached per posting, handed to the gate packet. No live network: every read goes through a fake http.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import {
  postingRef, readApplicationSchema, normalizeGreenhouseQuestions, getApplicationSchema, cachedApplicationSchema,
  schemaFieldsForFill, schemaQuestionsForTailoring, DOCUMENTED_SCHEMA_ATS, SCHEMA_MAX_AGE_SEC,
} from "../services/jobs/applicationSchema.js";
import { buildGatePacket } from "../services/applyGatePacket.js";

const GH_BODY = {
  id: 4012345, title: "Backend Engineer",
  questions: [
    { label: "First Name", required: true, fields: [{ name: "first_name", type: "input_text", values: [] }] },
    { label: "Last Name", required: true, fields: [{ name: "last_name", type: "input_text", values: [] }] },
    { label: "Email", required: true, fields: [{ name: "email", type: "input_text", values: [] }] },
    { label: "Resume/CV", required: true, fields: [{ name: "resume", type: "input_file", values: [] }, { name: "resume_text", type: "textarea", values: [] }] },
    { label: "Why do you want to work at Northwind?", required: true, fields: [{ name: "question_7001", type: "textarea", values: [] }] },
    { label: "Will you now or in the future require sponsorship?", required: true,
      fields: [{ name: "question_7002", type: "multi_value_single_select", values: [{ label: "Yes", value: 1 }, { label: "No", value: 0 }] }] },
  ],
  location_questions: [],
  compliance: [{ type: "eeoc", questions: [{ label: "Gender", required: false, fields: [{ name: "gender", type: "multi_value_single_select", values: [{ label: "Decline", value: 3 }] }] }] }],
};

function fakeHttp(map) {
  const calls = [];
  return { calls, get: async (url) => { calls.push(url); const r = map(url); if (r instanceof Error) throw r; return r; } };
}

function freshDb() {
  const db = new Database(":memory:");
  const m = MIGRATIONS.find(x => x.id === "257_posting_application_schemas");
  assert.ok(m, "migration 257 exists");
  db.exec(m.sql);
  db.exec("CREATE TABLE company_ats_list (company TEXT, ats_type TEXT, ats_slug TEXT)");
  db.prepare("INSERT INTO company_ats_list VALUES ('Northwind', 'greenhouse', 'northwind')").run();
  return db;
}

const JOB = { job_id: "greenhouse-4012345", source: "greenhouse", company: "Northwind",
  url: "https://northwind.example.com/careers?gh_jid=4012345", req_uid: "greenhouse:northwind:4012345" };

test("d185SchemaFromAtsEndpoints: Greenhouse is read from its documented ?questions=true endpoint, board from company_ats_list", async () => {
  const db = freshDb();
  const ref = postingRef(db, JOB);
  assert.deepEqual(ref, { ats: "greenhouse", board: "northwind", externalId: "4012345" });
  const http = fakeHttp(() => ({ status: 200, data: GH_BODY }));
  const s = await readApplicationSchema(ref, { http });
  assert.equal(http.calls[0], "https://boards-api.greenhouse.io/v1/boards/northwind/jobs/4012345?questions=true");
  assert.equal(s.status, "ok");
  const byName = Object.fromEntries(s.fields.map(f => [f.name, f]));
  assert.equal(byName.first_name.handler_type, "first-name");
  assert.equal(byName.resume.type, "file");
  assert.equal(byName.question_7001.custom, true);
  assert.equal(byName.question_7002.type, "select");
  assert.deepEqual(byName.question_7002.options.map(o => o.label), ["Yes", "No"]);
  assert.equal(byName.gender.group, "compliance");
  assert.equal(byName.gender.handler_type, null, "a compliance question never gets a handler that could answer it");
});

test("d185SchemaFromAtsEndpoints: ATS families with no documented questions endpoint are 'unsupported' — no request is made", async () => {
  assert.deepEqual([...DOCUMENTED_SCHEMA_ATS], ["greenhouse"]);
  for (const ats of ["lever", "ashby", "smartrecruiters", "workable", "workday"]) {
    const http = fakeHttp(() => { throw new Error("must not fetch"); });
    const s = await readApplicationSchema({ ats, board: "x", externalId: "1" }, { http });
    assert.equal(s.status, "unsupported", ats);
    assert.equal(http.calls.length, 0, ats);
  }
});

test("d185SchemaFromAtsEndpoints: a bad board token or id is refused before any request (no URL built from junk)", async () => {
  const http = fakeHttp(() => ({ status: 200, data: GH_BODY }));
  assert.equal((await readApplicationSchema({ ats: "greenhouse", board: "../etc", externalId: "1" }, { http })).status, "not_found");
  assert.equal((await readApplicationSchema({ ats: "greenhouse", board: "ok", externalId: "abc" }, { http })).status, "not_found");
  assert.equal(http.calls.length, 0);
});

test("d185SchemaFromAtsEndpoints: cached per posting — a fresh read is reused, a stale one re-read, errors retried sooner", async () => {
  const db = freshDb();
  let t = 1_000_000;
  const http = fakeHttp(() => ({ status: 200, data: GH_BODY }));
  await getApplicationSchema(db, JOB, { http, now: () => t });
  await getApplicationSchema(db, JOB, { http, now: () => t + 60 });
  assert.equal(http.calls.length, 1, "the cache answered the second read");
  await getApplicationSchema(db, JOB, { http, now: () => t + SCHEMA_MAX_AGE_SEC + 1 });
  assert.equal(http.calls.length, 2, "a day-old read is refreshed");
  const cached = cachedApplicationSchema(db, JOB.job_id);
  assert.equal(cached.status, "ok");
  assert.ok(cached.fields.length >= 6);

  const db2 = freshDb();
  const down = fakeHttp(() => ({ status: 503, data: "" }));
  const e = await getApplicationSchema(db2, JOB, { http: down, now: () => t });
  assert.equal(e.status, "error");
  await getApplicationSchema(db2, JOB, { http: down, now: () => t + 2 * 60 * 60 });
  assert.equal(down.calls.length, 2, "an error is retried after an hour, not a day");
});

test("d185SchemaFromAtsEndpoints: the gate packet answers the ATS's own questions and names the ones nobody answered", () => {
  const schema = { status: "ok", fields: normalizeGreenhouseQuestions(GH_BODY) };
  const payload = {
    field_map: { first_name: "Maya", last_name: "Chen", email: "maya@example.com" },
    handler_map: { "first-name": "Maya", "last-name": "Chen", email: "maya@example.com" },
    custom_answers: {},
  };
  const without = buildGatePacket({ autofillPayload: payload, applyUrl: "https://boards.greenhouse.io/northwind/jobs/4012345", jobId: "j1" });
  const withSchema = buildGatePacket({ autofillPayload: payload, applyUrl: "https://boards.greenhouse.io/northwind/jobs/4012345", jobId: "j1",
    atsQuestions: schemaFieldsForFill(schema) });
  assert.ok(withSchema.answers.length >= without.answers.length, "a schema never makes a packet smaller");
  assert.deepEqual(withSchema.atsSchema, { questions: schemaFieldsForFill(schema).filter(f => f.group !== "compliance").length });
  const why = withSchema.unresolved.find(u => u.name === "question_7001");
  assert.ok(why && why.from_schema && why.is_required, "the employer's own unanswered question is named, in its wording");
  assert.equal(why.field, "Why do you want to work at Northwind?");
  assert.ok(!withSchema.unresolved.some(u => u.name === "resume"), "files are the run's to attach, not unresolved");
  assert.ok(!withSchema.unresolved.some(u => u.name === "gender"), "compliance questions are not listed as the fill's to answer");
  assert.equal(without.atsSchema, undefined);
});

test("d185SchemaFromAtsEndpoints: tailoring gets the free-text custom questions only", () => {
  const qs = schemaQuestionsForTailoring({ status: "ok", fields: normalizeGreenhouseQuestions(GH_BODY) });
  assert.deepEqual(qs.map(q => q.name), ["question_7001"]);
  assert.deepEqual(schemaQuestionsForTailoring({ status: "unsupported", fields: [] }), []);
});

test("d185SchemaFromAtsEndpoints: migration 257 is byte-identical in server.js and scripts/migrations.js; the suite never warms live", () => {
  const server = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const mig = fs.readFileSync(new URL("../scripts/migrations.js", import.meta.url), "utf8");
  const BLOCK = /id: "257_posting_application_schemas",[\s\S]*?\r?\n    \},/;
  const carve = (src) => { const m = src.match(BLOCK); assert.ok(m, "migration 257 block found"); return m[0]; };
  assert.equal(carve(server), carve(mig));
  assert.equal(process.env.DRAFT_SCHEMA_READER, "off");
  const routes = fs.readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8");
  assert.ok(routes.includes("atsQuestions: schemaFieldsForFill(cachedApplicationSchema(db, jobId))"), "both packet builders read the cache");
});
