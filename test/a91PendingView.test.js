// A91 (10-06 (33)) — /d IS ALL RESTRICTED BY ONE PREDICATE.
//
// D41(a) asked for "one query, one card list, one predicate per chip". ALL, ★ and + already were;
// /d was GET /api/jobs/pending — a query of its own that took none of the board's search, sentence or
// drawer filters, so a filter that hid a row in ALL left it in /d, and its rows were raw database rows
// rather than the board's job objects. Now /d is GET /api/jobs?pending=1.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const server = read("server.js");
const panel = read("client/src/panels/JobsPanel.jsx");
// D51: the membership is a function of the user id (the record half keys on the user, never on uj).
const OPEN = "const pendingMembershipSql = (uid) => `";
const PREDICATE_OF = (uid) => server.slice(at(server, OPEN) + OPEN.length, at(server, "`;", at(server, OPEN)))
  .replaceAll("$" + "{uid}", String(uid));
const PREDICATE = PREDICATE_OF(1);

test("A91 · /d is the board's statement plus ONE predicate, shared with the legacy route", () => {
  assert.match(server, /const pendingSql = pendingTab \? `AND \$\{pendingMembershipSql\(ownUid\)\}\s+AND sj\.job_id IN \(SELECT pr\.job_id FROM resumes pr WHERE pr\.user_id = \$\{ownUid\} UNION SELECT ar\.job_id FROM application_records ar WHERE ar\.user_id = \$\{ownUid\}\)` : '';/ /* ⭐ D151 Rule 4 (11-08, changed on purpose): + a driving IN-list, the same rows */);
  assert.match(server, /\$\{importedSql\}\s+\$\{pendingSql\}/, "beside ★'s and +'s predicates, in the one WHERE");
  const legacy = server.slice(at(server, "function pendingJobsQuery"), at(server, 'app.get("/api/categories"'));
  assert.match(legacy, /AND \$\{pendingMembershipSql\(/, "the legacy route reads the same membership");
});

test("A91 · the client fetches /d like every other view and renders the one list", () => {
  assert.match(panel, /if \(boardTab === "pending"\) p\.set\("pending", "1"\);/);
  assert.match(panel, /const displayJobs = useMemo\(\(\) => jobs, \[jobs\]\);/);
  assert.doesNotMatch(panel, /api\("\/api\/jobs\/pending"\)/, "the client still asks the separate query");
  assert.match(server, /\.\.\.\(pendingTab && resumeBy\.has\(j\.job_id\) \?/, "the /d card keeps its résumé fields");
});

test("A91 · the membership: a generated résumé or an open record — not applied, withdrawn or verified", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  db.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (7,1,'P','engineering','general',1)`).run();
  for (const id of ["gen", "rec", "applied", "withdrawn", "none", "nohtml"]) {
    db.prepare("INSERT INTO scraped_jobs (job_id,title,company,url,search_query,_hash,is_active) VALUES (?,?,?,?,'t',?,1)")
      .run(id, "Engineer", "Northwind", `https://x.example/${id}`, `h-${id}`);
  }
  const uj = db.prepare("INSERT INTO user_jobs (user_id,job_id,domain_profile_id,resume_generated,applied) VALUES (1,?,7,?,?)");
  uj.run("gen", 1, 0); uj.run("rec", 0, 0); uj.run("applied", 1, 1); uj.run("withdrawn", 0, 0); uj.run("none", 0, 0); uj.run("nohtml", 1, 0);
  const res = db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,updated_at) VALUES (1,?,'Northwind','Engineer',?,unixepoch())");
  res.run("gen", "<p>r</p>"); res.run("applied", "<p>r</p>");   // "nohtml": flagged generated, no résumé row
  const ar = db.prepare("INSERT INTO application_records (user_id,job_id,state,origin) VALUES (1,?,?,'manual')");
  ar.run("rec", "pending"); ar.run("withdrawn", "withdrawn");
  const ids = db.prepare(`SELECT sj.job_id FROM scraped_jobs sj
      LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = 1 AND uj.domain_profile_id = 7
      WHERE sj.is_active = 1 AND ${PREDICATE} ORDER BY sj.job_id`).all().map(r => r.job_id);
  assert.deepEqual(ids, ["gen", "rec"]);
});
