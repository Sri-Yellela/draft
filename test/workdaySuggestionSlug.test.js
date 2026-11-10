// 46a (owner 11-10: Admin → Companies → "workday · zoom" from captures → Use → Probe → "The board could not be read (network
// error)"). WHY: a capture records Workday's TENANT; a Workday board is "wdN|tenant|site", so the probe built
// zoom.wdundefined.myworkdayjobs.com and DNS failing read as a network error. SYNTHETIC captures; no network.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { harvestedSuggestions, validateBoard } from "../services/companyList.js";
import { createCompaniesRouter } from "../routes/companies.js";

function db0() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.exec("DELETE FROM company_ats_list");
  return db;
}
const capture = (db, type, slug, url) => db.prepare("INSERT INTO job_captures (job_id, url, ats_type, ats_slug, origin, action) VALUES (?, ?, ?, ?, 'extension', 'import')")
  .run(`j${Math.random()}`, url, type, slug);

test("a Workday suggestion carries its FULL board, read from a captured posting's own URL", () => {
  const db = db0();
  capture(db, "workday", "zoom", "https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/San-Jose-CA/Software-Engineer_R123");
  capture(db, "workday", "zoom", "https://zoom.wd5.myworkdayjobs.com/en-US/Zoom/job/Remote/Designer_R124");
  capture(db, "workday", "nourl", null);
  capture(db, "greenhouse", "stripe", "https://boards.greenhouse.io/stripe/jobs/1");
  const s = Object.fromEntries(harvestedSuggestions(db).map(r => [`${r.ats_type}:${String(r.ats_slug).split("|")[1] || r.ats_slug}`, r]));
  assert.equal(s["workday:zoom"].ats_slug, "5|zoom|Zoom");
  assert.equal(s["workday:zoom"].captures, 2);
  assert.equal(s["workday:nourl"].needsUrl, true, "no URL to complete it from → the panel says to paste the careers URL");
  assert.equal(s["greenhouse:stripe"].ats_slug, "stripe", "a one-part slug is unchanged");
  db.prepare("INSERT INTO company_ats_list (company, ats_type, ats_slug, active, evidence) VALUES ('Zoom', 'workday', '5|zoom|Zoom', 1, 't')").run();
  assert.ok(!harvestedSuggestions(db).some(r => r.ats_slug === "5|zoom|Zoom"), "a configured full board is no longer suggested (the tenant-only check never matched it)");
});

test("an incomplete multi-part slug is refused plainly before any fetch — never 'network error'", async () => {
  let fetched = 0;
  const fetchers = { workday: async () => { fetched++; return []; }, oracle: async () => { fetched++; return []; }, taleo: async () => { fetched++; return []; } };
  for (const [t, slug, re] of [["workday", "zoom", /wdN\|tenant\|site/], ["oracle", "fa-x.fa.ocs.oraclecloud.com", /<host>\|<site>/], ["taleo", "hdr", /<tenant>\|<section>/]]) {
    const v = await validateBoard({ atsType: t, slug, company: "X", fetchers });
    assert.equal(v.state, "invalid", t); assert.match(v.message, re, t); assert.match(v.message, /Paste the careers page URL/);
  }
  assert.equal(fetched, 0, "nothing was fetched");
  assert.equal((await validateBoard({ atsType: "workday", slug: "5|zoom|Zoom", company: "Zoom", fetchers })).state, "empty", "a full slug is probed");
});

test("a careers page URL in the slug field is read into its board type and slug (probe and add)", async () => {
  const db = db0();
  const seen = [];
  const fetchers = { workday: async (slug) => { seen.push(slug); return []; }, greenhouse: async () => [] };
  const app = express(); app.use(express.json());
  app.use("/c", createCompaniesRouter(db, (_q, _s, n) => n(), { fetchers, gate: () => ({ ok: true }) }));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (p, b) => fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());
    const v = await post("/c/validate", { atsType: "greenhouse", slug: "https://zoom.wd5.myworkdayjobs.com/Zoom", company: "Zoom" });
    assert.deepEqual(v.board, { atsType: "workday", slug: "5|zoom|Zoom" });
    const dry = await post("/c", { company: "Zoom", atsType: "greenhouse", slug: "https://zoom.wd5.myworkdayjobs.com/en-US/Zoom" });
    assert.deepEqual(dry.board, { atsType: "workday", slug: "5|zoom|Zoom" });
    assert.deepEqual(seen, ["5|zoom|Zoom", "5|zoom|Zoom"]);
  } finally { server.close(); }
});
