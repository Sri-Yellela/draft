// D33 part 2 — ONE CAPTURED JOB, traced: extension -> POST /api/import/job -> importJob ->
// ingestJob (jobGateway.js) -> job_captures (migration 122) -> user_jobs -> the ★ Saved tab.
//
// The owner captured a US remote posting and it was not on the board. The three outcomes the D33
// row names, plus the one the trace found, each pinned here against a real migrated database:
//
//   attached       the freshness fast path (same URL, updated inside 24h — every crawl touches
//                  updated_at, so a crawled posting is nearly always "fresh") wrote NO job_captures
//                  row, so the table built to answer "where did my capture go" had nothing to say
//   out_of_market  a bare "Remote" with no positive US evidence is held off the shared board by
//                  D29's gate (remote_region_unstated) — kept, starred, and the state is readable
//   missing from ★ the star upsert never moved domain_profile_id or cleared a pass, and the ★ Saved
//                  tab reads `uj.domain_profile_id = <active>` AND `disliked = 0` — so a job touched
//                  before under another profile, or passed on, was starred and still not in ★
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { ingestJob, boardStateOf, recordExistingCapture } from "../services/jobs/jobGateway.js";
import { importJob } from "../services/jobs/importJob.js";

const SERVER = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");

function db() {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  d.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  d.prepare(`INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active)
             VALUES (5,1,'Old','engineering','general',0), (7,1,'Current','engineering','general',1)`).run();
  return d;
}

// The ★ Saved tab's own predicate, as server.js's board query writes it (pinned below).
const inSaved = (d, jobId) => !!d.prepare(`
  SELECT 1 FROM scraped_jobs sj
  LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = 1 AND uj.domain_profile_id = 7
  WHERE sj.job_id = ? AND uj.starred = 1 AND (uj.disliked IS NULL OR uj.disliked = 0)
`).get(jobId);

const seedCrawled = (d, { id, location = "Austin, TX", active = 1 } = {}) => {
  const now = Math.floor(Date.now() / 1000);
  d.prepare(`INSERT INTO scraped_jobs (job_id,search_query,_hash,title,company,url,source,location,updated_at,is_active,description)
             VALUES (?,'crawl','h',?,?,?,?,?,?,?,?)`).run(id, "Backend Engineer", "Northwind", `https://boards.greenhouse.io/northwind/jobs/${id.split(":").pop()}`,
    "greenhouse", location, now, active, "Build things.");
  return d.prepare("SELECT * FROM scraped_jobs WHERE job_id = ?").get(id);
};

test("the ★ Saved predicate this file models is still the board's own", () => {
  assert.match(SERVER, /LEFT JOIN user_jobs uj\s+ON uj\.job_id = sj\.job_id AND uj\.user_id = \? AND uj\.domain_profile_id = \?/);
  assert.match(SERVER, /const starredSql = savedTab \? `AND uj\.starred = 1` : '';/);
  assert.match(SERVER, /AND \(uj\.disliked IS NULL OR uj\.disliked = 0\)/);
});

test("attached: a capture of a posting already on the board writes a job_captures row (the fast path wrote none)", async () => {
  const d = db();
  const row = seedCrawled(d, { id: "greenhouse:northwind:101" });
  const res = await importJob({ url: row.url, text: "Title: Backend Engineer\nCompany: Northwind\nBuild things." },
    { db: d, anthropic: null, userId: 1 });
  assert.equal(res.job.id, row.job_id);
  const cap = d.prepare("SELECT * FROM job_captures WHERE user_id = 1").all();
  assert.equal(cap.length, 1, "the capture must leave a record");
  assert.equal(cap[0].job_id, row.job_id);
  assert.equal(cap[0].action, "attached");
  assert.equal(cap[0].origin, "capture");
  assert.equal(cap[0].ats_type, "greenhouse");
  assert.equal(cap[0].ats_slug, "northwind");
  assert.equal(cap[0].out_of_market, 0);
  // ⛔ D41(a) (owner, 10-06): a capture no longer STARS — it is the user's through job_captures (the
  // + view) and a user_jobs row on the active profile, and ★ is left to what they save.
  assert.equal(inSaved(d, row.job_id), false, "a capture must not star the job");
  assert.ok(d.prepare("SELECT 1 FROM user_jobs WHERE user_id = 1 AND job_id = ? AND domain_profile_id = 7").get(row.job_id),
    "and it is on the active profile, so ALL admits it as the user's own");
  d.close();
});

test("a job the user touched under ANOTHER profile is moved to the active one by a capture (D41: not starred)", async () => {
  const d = db();
  const row = seedCrawled(d, { id: "greenhouse:northwind:102" });
  d.prepare("INSERT INTO user_jobs (user_id,job_id,domain_profile_id,starred) VALUES (1,?,5,0)").run(row.job_id);
  assert.equal(inSaved(d, row.job_id), false);
  await importJob({ url: row.url }, { db: d, anthropic: null, userId: 1 });
  const uj = d.prepare("SELECT * FROM user_jobs WHERE user_id = 1 AND job_id = ?").get(row.job_id);
  assert.equal(uj.starred, 0, "D41(a): a capture does not star");
  assert.equal(uj.domain_profile_id, 7, "a row under profile 5 is invisible to profile 7's board");
  d.close();
});

test("a job the user passed on is un-passed by a capture — a pass hides it everywhere (D41: not starred)", async () => {
  const d = db();
  const row = seedCrawled(d, { id: "greenhouse:northwind:103" });
  d.prepare("INSERT INTO user_jobs (user_id,job_id,domain_profile_id,starred,disliked) VALUES (1,?,7,0,1)").run(row.job_id);
  await importJob({ url: row.url }, { db: d, anthropic: null, userId: 1 });
  const uj = d.prepare("SELECT * FROM user_jobs WHERE user_id = 1 AND job_id = ?").get(row.job_id);
  assert.equal(uj.disliked, 0, "a pass hides the row from every view; capturing it is the newer act");
  assert.equal(uj.starred, 0, "D41(a): a capture does not star");
  d.close();
});

test("out_of_market: a bare 'Remote' with a silent description is HELD, recorded, and still the user's", () => {
  const d = db();
  const job = { id: "import:remote-1", title: "Platform Engineer", company: "Northwind", location: "Remote",
                url: "https://northwind.example.com/careers/platform", source: "import", description: "Ship platform work. Competitive pay." };
  const r = ingestJob(d, { job, origin: "capture", userId: 1 });
  assert.equal(r.action, "inserted");
  assert.equal(r.outOfMarket, true, "D29: 'Remote' alone carries no POSITIVE US evidence");
  assert.deepEqual(boardStateOf(d, job.id), { state: "held", reason: "remote_region_unstated" });
  const cap = d.prepare("SELECT action, out_of_market FROM job_captures WHERE job_id = ?").get(job.id);
  assert.deepEqual({ ...cap }, { action: "inserted", out_of_market: 1 });
  assert.match(d.prepare("SELECT reason FROM rejected_jobs WHERE job_id = ?").get(job.id).reason, /^out_of_market:remote_region_unstated$/);
  d.close();
});

test("out_of_market: the same posting saying 'must be based in the United States' is admitted", () => {
  const d = db();
  const job = { id: "import:remote-2", title: "Platform Engineer", company: "Northwind", location: "Remote",
                url: "https://northwind.example.com/careers/platform-2", source: "import",
                description: "Ship platform work. You must be based in the United States." };
  assert.equal(ingestJob(d, { job, origin: "capture", userId: 1 }).outOfMarket, false);
  assert.deepEqual(boardStateOf(d, job.id), { state: "on_board", reason: null });
  d.close();
});

test("boardStateOf tells held from closed from missing, and recordExistingCapture records a held attach as held", () => {
  const d = db();
  seedCrawled(d, { id: "greenhouse:northwind:104", active: 0 });
  assert.deepEqual(boardStateOf(d, "greenhouse:northwind:104"), { state: "closed", reason: null });
  d.prepare("INSERT INTO rejected_jobs (job_id,title,company,source,reason,rejected_at) VALUES (?,?,?,?,?,0)")
    .run("greenhouse:northwind:104", "", "", "", "out_of_market:non_us_location");
  assert.deepEqual(boardStateOf(d, "greenhouse:northwind:104"), { state: "held", reason: "non_us_location" });
  assert.deepEqual(boardStateOf(d, "nope"), { state: "missing", reason: null });
  recordExistingCapture(d, { jobId: "greenhouse:northwind:104", url: "https://boards.greenhouse.io/northwind/jobs/104", origin: "capture", userId: 1 });
  assert.equal(d.prepare("SELECT out_of_market FROM job_captures WHERE job_id = ?").get("greenhouse:northwind:104").out_of_market, 1);
  assert.throws(() => recordExistingCapture(d, { jobId: "x", origin: "nonsense" }), /unknown capture origin/);
  d.close();
});
