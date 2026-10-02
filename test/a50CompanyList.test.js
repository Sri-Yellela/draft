import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { createCompaniesRouter } from "../routes/companies.js";
import { validateBoard } from "../services/companyList.js";

// A50 step 4 (docs/ADMIN_PANEL_REVAMP.md §3): the company list as a surface. Fake fetchers — no
// board is contacted — standing in for a live board, an empty one, and a dead slug.
const live = async () => [
  { title: "Backend Engineer", location: "Austin, TX", description: "Austin, TX", company: "Contoso" },
  { title: "SRE", location: "Dublin, Ireland", description: "Dublin office", company: "Contoso" },
];
const empty = async () => [];
const dead = async () => { throw Object.assign(new Error("404"), { response: { status: 404 } }); };

function mount(fetchers) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  const app = express();
  app.use((req, _res, next) => { req.user = { id: 1 }; next(); });
  app.use("/api/admin/companies", createCompaniesRouter(db, (_q, _s, n) => n(), { fetchers }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/admin/companies`;
  const call = (method, path, body) => fetch(base + path, { method, headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, body: await r.json() }));
  return { db, call, stop: () => server.close() };
}

test("a probe tells dead, empty and live apart — and counts the postings with US evidence", async () => {
  assert.equal((await validateBoard({ atsType: "greenhouse", slug: "x", fetchers: { greenhouse: dead } })).state, "dead");
  assert.equal((await validateBoard({ atsType: "greenhouse", slug: "x", fetchers: { greenhouse: empty } })).state, "empty");
  const l = await validateBoard({ atsType: "greenhouse", slug: "contoso", fetchers: { greenhouse: live } });
  assert.deepEqual([l.state, l.jobs, l.us], ["live", 2, 1]);
  assert.equal((await validateBoard({ atsType: "nope", slug: "x", fetchers: {} })).state, "unsupported");
  assert.equal((await validateBoard({ atsType: "greenhouse", slug: "../etc", fetchers: { greenhouse: live } })).state, "invalid");
});

test("adding is dry by default, needs the state the operator saw, refuses a dead board, and is logged", async () => {
  const s = mount({ greenhouse: live, lever: dead });
  try {
    const before = s.db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get();
    const dry = await s.call("POST", "/", { company: "Contoso", atsType: "greenhouse", slug: "contoso" });
    assert.equal(dry.body.dryRun, true);
    assert.equal(s.db.prepare("SELECT COUNT(*) FROM company_ats_list").pluck().get(), before, "nothing added");
    assert.equal((await s.call("POST", "/", { company: "Contoso", atsType: "greenhouse", slug: "contoso", confirm: true, expectState: "empty" })).status, 409);
    const added = await s.call("POST", "/", { company: "Contoso", atsType: "greenhouse", slug: "contoso", confirm: true, expectState: "live" });
    assert.equal(added.status, 201);
    assert.equal(added.body.company.active, 1);
    assert.equal((await s.call("POST", "/", { company: "Contoso", atsType: "greenhouse", slug: "CONTOSO", confirm: true, expectState: "live" })).status, 409, "already configured");
    assert.equal((await s.call("POST", "/", { company: "Gone", atsType: "lever", slug: "gone", confirm: true, expectState: "dead" })).status, 409, "a dead board is never added");
    const id = added.body.company.id;
    const off = await s.call("PATCH", `/${id}`, { active: false });
    assert.equal(off.body.company.active, 0);
    const log = s.db.prepare("SELECT action, before_json, after_json FROM admin_audit_log ORDER BY id").all();
    assert.deepEqual(log.map(l => l.action), ["company_add", "company_active"]);
    assert.equal(JSON.parse(log[1].before_json).active, 1, "the value it replaced is kept");
  } finally { s.stop(); }
});

test("suggestions are slugs captures named that are not configured", async () => {
  const s = mount({ greenhouse: live });
  try {
    s.db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'a','x'),(2,'b','x')").run();
    for (const [u, slug] of [[1, "fabrikam"], [2, "fabrikam"], [1, "stripe"]]) {
      s.db.prepare("INSERT INTO job_captures (user_id, job_id, ats_type, ats_slug, origin, action) VALUES (?, 'j', 'greenhouse', ?, 'capture', 'inserted')").run(u, slug);
    }
    const list = await s.call("GET", "/");
    const sug = list.body.suggestions.map(x => [x.ats_slug, x.people]);
    assert.deepEqual(sug, [["fabrikam", 2]], "stripe is already configured (seeded by migration 056)");
  } finally { s.stop(); }
});

test("the Operations tab draws it, with Add gated on a probe of exactly the typed board", () => {
  const ops = fs.readFileSync("client/src/panels/adminOps.jsx", "utf8");
  assert.match(ops, /<CompaniesSection theme=\{theme\}\/>/);
  assert.match(ops, /const seen = probe && probe\.key === key \? probe\.body\.validation : null;/);
  assert.match(ops, /disabled=\{!seen\?\.ok \|\| !!busy\} onClick=\{add\}/);
  assert.match(ops, /confirm: true, expectState: seen\.state/);
});
