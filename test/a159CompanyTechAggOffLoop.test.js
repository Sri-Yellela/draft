// ⛔ A159 (45r) · companyTech's aggregate (company_tech per company from job_tech × job_company × scraped_jobs) read on the
// offload worker; only the small DELETE + INSERT per range runs on the main thread. On an 80k copy the one-call aggregate
// held the loop for 6.3 s. Same rows as the main-thread walk; a worker failure reads that range here (never stops).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createCompanyTech } from "../services/companies/companyTech.js";
import { createOffload } from "../services/db/offloadWorker.js";

function world() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a159-"));
  const file = path.join(dir, "resume_master.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO companies (id, name, slug) VALUES (1, 'Acme', 'acme'), (2, 'Globex', 'globex')").run();
  const ins = db.prepare(`INSERT INTO scraped_jobs (job_id, search_query, company, title, _hash, is_active, board_category, description, discovered_at)
    VALUES (?, 'q', ?, 'Software Engineer', ?, 1, 'computing', ?, unixepoch())`);
  for (let i = 0; i < 60; i++) {
    const co = i % 2 ? "Acme" : "Globex";
    ins.run(`j${i}`, co, `h${i}`, i % 3 ? "We use React, TypeScript and Kubernetes." : "We use Python, PostgreSQL and Kafka.");
    db.prepare("INSERT INTO job_company (job_id, company_id) VALUES (?, ?)").run(`j${i}`, co === "Acme" ? 1 : 2);
  }
  return { db, file };
}
const quiet = { log() {}, warn() {}, error() {} };
const snap = (db) => db.prepare("SELECT company_id, tech, postings FROM company_tech ORDER BY company_id, tech").all();

test("a159CompanyTechAggOffLoop: the aggregate read on the worker gives the same company_tech as the main-thread walk", async () => {
  const a = world(), b = world();
  const off = createOffload({ dbPath: a.file });
  try {
    const sa = await createCompanyTech(a.db, { log: quiet, offloadAgg: (x) => off.run("companyTechAgg", x) }).run("test");
    const sb = await createCompanyTech(b.db, { log: quiet }).run("test");
    assert.equal(sa.state, "done"); assert.equal(sb.state, "done");
    assert.ok(snap(a.db).length > 0, "stack rows written");
    assert.deepEqual(snap(a.db), snap(b.db));
    assert.ok(off.status().served > 0, "the aggregate ran on the worker");
  } finally { await off.close(); a.db.close(); b.db.close(); }
});

test("a159CompanyTechAggOffLoop: a worker failure reads the range on the main thread — the walk finishes", async () => {
  const a = world();
  const s = await createCompanyTech(a.db, { log: quiet, offloadAgg: () => Promise.reject(new Error("offload worker not ready")) }).run("test");
  assert.equal(s.state, "done");
  assert.ok(snap(a.db).length > 0);
  a.db.close();
});

test("a159CompanyTechAggOffLoop: server.js gives the walk the offload worker", () => {
  const src = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");
  assert.match(src, /createCompanyTech\(db, \{ offloadAgg: \(args\) => offload\.run\("companyTechAgg", args\) \}\)/);
});

// A193 (46j): production's boot wrote one 200-company range in 879 ms — the aggregate range now starts small and adapts.
test("a193CompanyTechRangeAdapts: the aggregate's company range starts at MIN_COMPANY_RANGE and halves / grows on the write's time", async () => {
  const { COMPANY_RANGE, MIN_COMPANY_RANGE, WRITE_BUDGET_MS } = await import("../services/companies/companyTech.js");
  assert.ok(MIN_COMPANY_RANGE < COMPANY_RANGE && WRITE_BUDGET_MS <= 100);
  const src = fs.readFileSync("services/companies/companyTech.js", "utf8");
  assert.match(src, /let cFrom = 0, cMax = 0, cRange = MIN_COMPANY_RANGE;/);
  assert.match(src, /const to = cFrom \+ cRange,/);
  assert.match(src, /if \(wMs > WRITE_BUDGET_MS && cRange > MIN_COMPANY_RANGE\) cRange = Math\.max\(MIN_COMPANY_RANGE, Math\.floor\(cRange \/ 2\)\);/);
});
