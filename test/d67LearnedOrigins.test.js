// ⭐ D67 (2) · THE SELF-LEARNING ORIGIN TABLE (services/learnedOrigins.js, migration 140, routes/apply.js
// familiesFor + the "I submitted" sighting, the admin revoke).
//
// ⛔ The row's tests: the fill never runs outside the family list · a single user's pair is not shared
// until N · an admin can revoke a learned pair. Synthetic hosts and people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { APPLY_ORIGIN_FAMILIES, pageMatchesPacket, packetOrigins } from "../services/applyOrigins.js";
import { recordSighting, learnedFamilies, setPairRevoked, listPairs, learnableHost, PROMOTE_AT_USERS } from "../services/learnedOrigins.js";
import { at } from "../test-support/sourceAnchors.js";

const POSTING = "https://jobs.northwind-example.com/careers/jobs/4012";
const FORM = "https://apply.northwind-hire.example/jobs/4012/application";

function db(users = 5) {
  const d = new Database(":memory:");
  for (const m of MIGRATIONS) d.exec(m.sql);
  for (let i = 1; i <= users; i++) d.prepare("INSERT INTO users (id,username,password_hash) VALUES (?,?,'x')").run(i, `u${i}`);
  return d;
}
const familiesFor = (d, u) => [...APPLY_ORIGIN_FAMILIES, ...learnedFamilies(d, u)];
const fillsFor = (d, u) => pageMatchesPacket({
  url: FORM, origins: packetOrigins({ expectedOrigin: new URL(POSTING).origin, urls: [POSTING] }, familiesFor(d, u)), jobIds: [],
}, familiesFor(d, u)).ok;

test("⛔ D67 · the fill never runs outside the family list — an unknown host is refused until it is learned", () => {
  const d = db();
  assert.equal(fillsFor(d, 1), false);
});

test("⛔ D67 · one user's pair is offered to THAT user only — shared with everyone only at N distinct users", () => {
  const d = db();
  assert.equal(PROMOTE_AT_USERS, 3);
  recordSighting(d, { userId: 1, postingUrl: POSTING, pageUrl: FORM });
  assert.equal(fillsFor(d, 1), true, "the user who saw it");
  assert.equal(fillsFor(d, 4), false, "nobody else, yet");
  recordSighting(d, { userId: 1, postingUrl: POSTING, pageUrl: FORM });           // the same user again counts once
  recordSighting(d, { userId: 2, postingUrl: POSTING, pageUrl: FORM });
  assert.equal(fillsFor(d, 4), false, "two distinct users is not three");
  const third = recordSighting(d, { userId: 3, postingUrl: POSTING, pageUrl: FORM });
  assert.deepEqual([third.users, third.promoted], [3, true]);
  assert.equal(fillsFor(d, 4), true, "promoted: every user's packets may fill there");
});

test("⛔ D67 · an admin can REVOKE a learned pair — then nobody gets it, not even the users who saw it", () => {
  const d = db();
  for (const u of [1, 2, 3]) recordSighting(d, { userId: u, postingUrl: POSTING, pageUrl: FORM });
  const [pair] = listPairs(d);
  assert.ok(setPairRevoked(d, pair.id, true));
  for (const u of [1, 4]) assert.equal(fillsFor(d, u), false, `user ${u}`);
  recordSighting(d, { userId: 5, postingUrl: POSTING, pageUrl: FORM });
  assert.equal(fillsFor(d, 5), false, "a new sighting does not undo a revoke");
  setPairRevoked(d, pair.id, false);
  assert.equal(fillsFor(d, 4), true, "restored");
});

test("⛔ D67 · only HOSTNAMES are stored, and the shared row carries no user identity", () => {
  const d = db();
  recordSighting(d, { userId: 1, postingUrl: POSTING + "?gh_src=abc&email=ada@example.invalid", pageUrl: FORM + "?session=tok" });
  const cols = d.prepare("PRAGMA table_info(apply_origin_pairs)").all().map(c => c.name);
  assert.ok(!cols.some(c => /user/i.test(c) && c !== "users_seen"), `shared columns: ${cols}`);
  const row = d.prepare("SELECT posting_host, apply_host FROM apply_origin_pairs").get();
  assert.deepEqual(row, { posting_host: "jobs.northwind-example.com", apply_host: "apply.northwind-hire.example" });
  const everything = JSON.stringify(d.prepare("SELECT * FROM apply_origin_pairs").all()) + JSON.stringify(d.prepare("SELECT * FROM apply_origin_sightings").all());
  assert.doesNotMatch(everything, /careers|application|gh_src|email|session|tok/, "no path, no query");
});

test("⛔ D67 · what is never learned — http, an IP, localhost, our own host, the same host twice", () => {
  assert.equal(learnableHost("http://apply.example.com/x"), null);
  assert.equal(learnableHost("https://10.0.0.5/apply"), null);
  assert.equal(learnableHost("https://localhost/apply"), null);
  assert.equal(learnableHost("https://jobsviadraft.com/app"), null);
  const d = db();
  assert.equal(recordSighting(d, { userId: 1, postingUrl: POSTING, pageUrl: "https://jobs.northwind-example.com/apply" }).reason, "same_host");
  assert.equal(listPairs(d).length, 0);
});

test("⭐ D67 · the trigger, end to end: 'I submitted' on a page outside the job's addresses, for a job the user holds a packet for", async () => {
  const d = db(1);
  d.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  d.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Synthetic','ada@example.invalid')").run();
  d.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,discovered_at)
             VALUES ('nw::4012','Platform Engineer','Northwind',?,?,'t','h',unixepoch()-86400)`).run(POSTING, POSTING);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const hooks = applyRoutes(app, d, (q, r, n) => n(), () => ({ field_map: { first_name: "Ada", last_name: "Synthetic", email: "ada@example.invalid" }, handler_map: {}, custom_answers: {} }),
    async () => ({ error: "no model" }), async () => Buffer.from("%PDF"), async () => ({}), () => null, {});
  const server = app.listen(0);
  try {
    const p = hooks.prepareManualPacket({ userId: 1, jobId: "nw::4012" });
    assert.equal(p.ok, true, JSON.stringify(p));
    const base = `http://127.0.0.1:${server.address().port}`;
    const r = await fetch(`${base}/api/apply/handoff/submitted`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: FORM + "/thanks", jobId: "nw::4012" }) });
    assert.equal(r.status, 200, await r.text());
    assert.deepEqual(listPairs(d).map(x => [x.postingHost, x.applyHost, x.usersSeen]), [["jobs.northwind-example.com", "apply.northwind-hire.example", 1]]);
    // On the posting's own host, nothing is learned.
    await fetch(`${base}/api/apply/handoff/submitted`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: POSTING + "/done", jobId: "nw::4012" }) });
    assert.equal(listPairs(d).length, 1);
  } finally { server.close(); d.close(); }
});

test("D67 · every packet-address check reads the per-user families, and the admin routes are guarded and logged", () => {
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.doesNotMatch(src, /,\s*FAMILIES\)/, "no check reads the static table alone any more");
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  const block = server.slice(at(server, 'app.get("/api/admin/apply-origins", requireAdmin'), at(server, "res.json({ ok: true, pair: after });"));
  assert.match(block, /app\.post\("\/api\/admin\/apply-origins\/:id\/revoke", requireAdmin/);
  assert.match(block, /INSERT INTO admin_audit_log/);
});

test("D67 · migration 140 is byte-identical in both runners", () => {
  const blk = (f) => { const s = fs.readFileSync(f, "utf8"); const i = at(s, 'id: "140_apply_origin_pairs"'); return s.slice(i, at(s, "`,", i)); };
  assert.equal(blk("server.js"), blk("scripts/migrations.js"));
});

// ── D67 (1) · THE MANUAL SWEEP (10-07): observed rows only, and on a shared host they TIGHTEN ─────────
test("⭐ D67 (1) · the swept ATSs: one shared origin each, and a page naming ANOTHER job is refused", async () => {
  const { APPLY_ORIGIN_FAMILIES, packetJobIds, pageMatchesPacket, packetOrigins } = await import("../services/applyOrigins.js");
  const by = Object.fromEntries(APPLY_ORIGIN_FAMILIES.map(f => [f.ats, f]));
  assert.deepEqual(Object.keys(by).sort(), ["amazon", "ashby", "greenhouse", "lever", "workable"]);
  assert.equal(by.workday, undefined, "⛔ no Workday row (owner, O84 c)");
  const cases = [
    ["lever", "https://jobs.lever.co/matchgroup/d28a3de6-cd04-483a-9aed-5ba1d2f8c57c",
      "https://jobs.lever.co/matchgroup/d28a3de6-cd04-483a-9aed-5ba1d2f8c57c/apply",
      "https://jobs.lever.co/othercorp/be908eda-1ae9-4563-9252-fe9b35df61d4/apply"],
    ["ashby", "https://jobs.ashbyhq.com/ramp/d2beca4a-7409-404b-8382-761e5db6e917",
      "https://jobs.ashbyhq.com/ramp/d2beca4a-7409-404b-8382-761e5db6e917/application",
      "https://jobs.ashbyhq.com/openai/872ca3d0-c8c0-4585-9a34-7f9ed6b4dbf9/application"],
    ["workable", "https://apply.workable.com/j/B0D0ACB369",
      "https://apply.workable.com/blueground/j/B0D0ACB369/apply",
      "https://apply.workable.com/othercorp/j/D6FB457899/apply"],
  ];
  for (const [ats, posting, applyPage, otherJob] of cases) {
    const origins = packetOrigins({ expectedOrigin: new URL(posting).origin, urls: [posting] });
    assert.deepEqual(origins, [new URL(posting).origin], `${ats}: widens nothing — one origin`);
    const jobIds = packetJobIds([posting]);
    assert.equal(jobIds.length, 1, `${ats}: the posting's job id is read`);
    assert.deepEqual(pageMatchesPacket({ url: applyPage, origins, jobIds }), { ok: true, reason: "match" }, `${ats}: its own form`);
    assert.deepEqual(pageMatchesPacket({ url: otherJob, origins, jobIds }), { ok: false, reason: "other_job" },
      `${ats}: ANOTHER employer's job on the same shared host is refused`);
  }
  // Each new row states the redirect it was taken from (the rule at the top of the table).
  const src = fs.readFileSync("services/applyOrigins.js", "utf8");
  for (const seen of ["jobs.lever.co/matchgroup/d28a3de6", "jobs.ashbyhq.com/ramp/d2beca4a", "apply.workable.com/j/B0D0ACB369 → 301"]) assert.ok(src.includes(seen), seen);
});
