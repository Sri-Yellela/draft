import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { runAutoTick, runPicksFollowUps, userContext } from "../services/autoScheduler.js";
import { AUTO_DEFAULTS, normaliseAutoSettings, readAutoSettings } from "../shared/autoSettings.js";
import {
  choosePicks, storeRun, deliverRun, signPickToken, readPickToken, pickSecret, pickAuthorisesSend, sweepLeftOut, levelOutOfReach,
  LEFT_OUT_REASONS, LEFT_OUT_KEEP_DAYS,
} from "../services/picks.js";
import { configureNotify, notifyEvent, saveSubscription, eventText, eventEmail, NOTIFY_EVENTS } from "../services/notify.js";
import { fromB64u } from "../services/webPush.js";
import picksConfirmRoutes from "../routes/picksConfirm.js";
import applyRoutes from "../routes/apply.js";
import { exportAccount, MERGE_PLAN } from "../services/accountService.js";
import { at } from "../test-support/sourceAnchors.js";

// ⭐ D113 (owner 10-31) · REMOTE AUTO-APPLY: picks arrive by message, one tap sends. Synthetic people, companies and postings.

const DAY = 86400;
const NOW = Math.floor(Date.UTC(2026, 10, 2, 14, 30) / 1000); // 09:30 in New York (EST) — the 09:00 run is due
const SECRET = pickSecret("test-session-secret");
const quiet = { warn() {}, log() {} };
const CITIZEN_ONLY = "MUST BE A US CITIZEN. NO H1B or Green card holders. Active TS clearance required.\nAbout the role: build mission software.";

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO'), (2,'eli','x','PRO')").run();
  return db;
}
/** mode 'ask' = SEMI + picks on ("Ask me first"); 'apply' = FULL AUTO ("Apply for me"). */
function setUser(db, mode, settings = {}, id = 1) {
  db.prepare("UPDATE users SET send_mode = ?, auto_settings = ?, auto_last_run_at = NULL WHERE id = ?")
    .run(mode === "apply" ? "auto" : "semi", JSON.stringify({ timeZone: "America/New_York", ...settings, ...(mode === "ask" ? { picks: true } : {}), savedAt: 0 }), id);
}
const job = (db, id, { company = `Co ${id}`, title = "Backend Engineer", text = "Build services in Go and Postgres." } = {}) =>
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,url,apply_url,search_query,_hash,description) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, title, company, `https://x.test/${id}`, `https://x.test/${id}`, "t", `h${id}`, text);
const cand = (id, score = null, extra = {}) => ({ jobId: id, company: `Co ${id}`, title: `Engineer ${id}`, score, postedAt: null, ...extra });
const tick = (db, board, extra = {}) => runAutoTick(db, { nowSec: NOW, env: {}, fetchBoard: async (_u, f) => (typeof board === "function" ? board(f) : board),
  startAutoRun: () => ({ status: 202, body: {} }), secret: SECRET, appUrl: "https://app.example.test", ...extra });
const picksOf = (db, userId = 1) => db.prepare("SELECT * FROM picks WHERE user_id = ? ORDER BY run_id, rank").all(userId);
const runsOf = (db, userId = 1) => db.prepare("SELECT * FROM picks_runs WHERE user_id = ? ORDER BY slot_at").all(userId);

function mount(db, deps) {
  const app = express();
  app.use(express.json());
  picksConfirmRoutes(app, db, (req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); }, { secret: SECRET, env: {}, ...deps });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    get: (p) => fetch(base + p).then(async r => ({ status: r.status, headers: r.headers, text: await r.text() })),
    post: (p, body = "") => fetch(base + p, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body })
      .then(async r => ({ status: r.status, text: await r.text() })),
    api: (p, method = "GET", body) => fetch(base + p, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .then(async r => ({ status: r.status, body: await r.json() })),
  };
}
const tokenFor = (k, pick) => signPickToken(SECRET, { k, id: pick.id, u: pick.user_id, exp: pick.expires_at });

// ── settings ─────────────────────────────────────────────────────────────────────────────────

test("D113 · the two new Auto settings — Ask me first's picks and Show me the form before sending — off by default, validated like the others", () => {
  assert.equal(AUTO_DEFAULTS.picks, false);
  assert.equal(AUTO_DEFAULTS.showFormBeforeSending, false);
  assert.equal(normaliseAutoSettings({ showFormBeforeSending: true }).value.showFormBeforeSending, true);
  assert.equal(normaliseAutoSettings({ showFormBeforeSending: "yes" }).error, "bad_show_form");
  assert.equal(normaliseAutoSettings({ picks: 1 }).error, "bad_picks");
  assert.equal(readAutoSettings(JSON.stringify({ picks: true })).picks, true);
});

// ── P1 · the scheduler ───────────────────────────────────────────────────────────────────────

test("D113 · d113PicksRespectCap — ranked by the ATS match, cut to what the daily cap leaves; a second run that day picks nothing", async () => {
  const db = freshDb();
  setUser(db, "ask", { dailyCap: 3, runTimes: ["09:00", "09:15"] });
  const board = [cand("a", 40), cand("b", 92), cand("c", 75), cand("d", 88), cand("e", null), cand("f", 60)];
  const r = await runAutoTick(db, { nowSec: NOW - 20 * 60, env: {}, fetchBoard: async () => board, startAutoRun: () => ({ status: 202, body: {} }), secret: SECRET });
  assert.equal(r[0].picked, 3);
  assert.deepEqual(picksOf(db).map(p => [p.job_id, p.rank]), [["b", 1], ["d", 2], ["c", 3]], "the three best matches, best first");
  const [run] = runsOf(db);
  assert.equal(run.seen, 6);
  assert.equal(JSON.parse(run.left_out_json).daily_cap, 3);
  // 09:15 the same day: the cap is used by the three offers — nothing more is picked; the run still records what it saw.
  const r2 = await tick(db, [...board, cand("g", 99)]);
  assert.equal(r2[0].skipped, "daily_cap", JSON.stringify(r2));
  assert.equal(picksOf(db).length, 3);
  assert.equal(JSON.parse(runsOf(db)[1].left_out_json).daily_cap, 4, "a, e, f (only over the limit before) and g — b, c, d are never offered twice");
  // A pure check of the cut: never more than the cap leaves.
  const p = choosePicks(board, { remaining: 2, settings: AUTO_DEFAULTS });
  assert.deepEqual(p.take.map(c => c.jobId), ["b", "d"]);
  assert.equal(p.leftOut.filter(l => l.reason === "daily_cap").length, 4);
});

test("D113 · d113PicksSkipIneligibleSetOnly — a requirement contradicting what the user SET leaves a posting out; an unset answer does not", async () => {
  const db = freshDb();
  job(db, "cit", { text: CITIZEN_ONLY });
  job(db, "open");
  setUser(db, "ask", {}, 1);
  setUser(db, "ask", {}, 2);
  db.prepare("INSERT INTO application_defaults (user_id, key, value, source) VALUES (1,'citizenship','India','user'), (1,'sponsorship_now','yes','user')").run();
  await tick(db, [cand("cit", 90), cand("open", 50)]);
  assert.deepEqual(picksOf(db, 1).map(p => p.job_id), ["open"], "user 1 set citizenship: the citizens-only posting is left out");
  assert.equal(JSON.parse(runsOf(db, 1)[0].left_out_json).ineligible, 1);
  assert.deepEqual(picksOf(db, 2).map(p => p.job_id), ["cit", "open"], "user 2 set nothing: nothing is excluded for an unset answer");
  assert.equal(picksOf(db, 1)[0].line !== null, true, "each pick carries the one line");
});

test("D113 · d113PicksSkipStale — a posting past the user's staleness threshold (D107) is left out and counted as stale", async () => {
  const db = freshDb();
  job(db, "old"); job(db, "fresh");
  db.prepare(`INSERT INTO job_history (job_id, company_key, title_key, first_seen, last_seen) VALUES ('old', 'co old', 'backend engineer', ?, ?)`)
    .run(NOW - 200 * DAY, NOW);
  setUser(db, "ask", { staleOpenDays: 90 });
  const ctx = userContext(db, 1, NOW, readAutoSettings(JSON.stringify({ staleOpenDays: 90 })));
  assert.equal(ctx.isStalePosting("old"), true, "open 200 days");
  await tick(db, [cand("old", 95), cand("fresh", 60)]);
  assert.deepEqual(picksOf(db).map(p => p.job_id), ["fresh"]);
  assert.equal(JSON.parse(runsOf(db)[0].left_out_json).stale, 1);
});

test("D113 · the level rule (D106) — only when the user's level is known, and only two steps above it", async () => {
  const senior = { levelRead: { read: "senior" } }, mid = { levelRead: { read: "mid" } };
  assert.equal(levelOutOfReach(null, senior), false, "unknown level never excludes");
  assert.equal(levelOutOfReach(0, senior), true);
  assert.equal(levelOutOfReach(0, mid), true);
  assert.equal(levelOutOfReach(1, mid), false, "one step is not news");
  assert.equal(levelOutOfReach(0, {}), false, "no read never excludes");
  const db = freshDb();
  db.prepare("INSERT INTO user_profile (user_id, years_of_experience) VALUES (1, 1)").run();
  setUser(db, "ask");
  await tick(db, [cand("s", 99, senior), cand("e", 50, { levelRead: { read: "entry" } })]);
  assert.deepEqual(picksOf(db).map(p => p.job_id), ["e"]);
  assert.equal(JSON.parse(runsOf(db)[0].left_out_json).level, 1);
});

test("D113 · per-run left-out counts BY REASON are stored, the left-out ids for 14 days, and the API returns both", async () => {
  const db = freshDb();
  job(db, "cit", { text: CITIZEN_ONLY });
  db.prepare("INSERT INTO application_defaults (user_id, key, value, source) VALUES (1,'citizenship','India','user'), (1,'sponsorship_now','yes','user')").run();
  db.prepare("INSERT INTO user_profile (user_id, years_of_experience) VALUES (1, 0)").run();
  db.prepare("INSERT INTO job_applications (user_id, job_id, company, role, response_outcome, outcome_at) VALUES (1,'old::1','Co paused','SWE','interview',?)").run(NOW - 5 * DAY);
  setUser(db, "ask", { dailyCap: 1, filters: { workType: "remote" } });
  const filtered = [cand("cit", 90), cand("s", 80, { levelRead: { read: "senior" } }), { ...cand("p", 70), company: "Co paused" }, cand("ok1", 60), cand("ok2", 50)];
  const unfiltered = [...filtered, cand("onsite1", 99), cand("onsite2", 99)];
  await tick(db, (f) => (Object.keys(f).length ? filtered : unfiltered));
  const [run] = runsOf(db);
  assert.equal(run.seen, 7, "the five in the filters and the two outside them");
  assert.equal(run.picked, 1);
  assert.deepEqual(JSON.parse(run.left_out_json), { outside_filters: 2, ineligible: 1, stale: 0, daily_cap: 1, company: 1, level: 1, sponsorship: 0 });
  assert.deepEqual(Object.keys(LEFT_OUT_REASONS), ["outside_filters", "ineligible", "stale", "daily_cap", "company", "level", "sponsorship"]);   // D121: the sponsorship switch / "says no" for a needer
  const t = mount(db, { startPickRun: () => ({ status: 202, body: {} }) });
  try {
    const runs = await t.api("/api/picks/runs");
    assert.equal(runs.status, 200);
    assert.equal(runs.body.runs[0].leftOutTotal, 6);
    assert.equal(runs.body.runs[0].picks[0].jobId, "ok1");
    assert.equal(runs.body.state.mode, "ask");
    const lo = await t.api(`/api/picks/runs/${run.id}/left-out`);
    assert.deepEqual(lo.body.jobs.map(j => [j.jobId, j.reason]).sort(), [["cit", "ineligible"], ["ok2", "daily_cap"], ["p", "company"], ["s", "level"]]);
    assert.equal((await t.api(`/api/picks/runs/999/left-out`)).status, 404);
  } finally { t.server.close(); }
  // 14 days: the ids go, the counts stay.
  assert.equal(sweepLeftOut(db, NOW + (LEFT_OUT_KEEP_DAYS + 1) * DAY), 4);
  assert.equal(JSON.parse(runsOf(db)[0].left_out_json).level, 1);
});

// ── idempotency ──────────────────────────────────────────────────────────────────────────────

test("D113 · d113IdempotentRun — one run per (user, run time): a second tick, a concurrent tick or a restart never creates or sends twice", async () => {
  const db = freshDb();
  setUser(db, "ask");
  const sent = [];
  const notify = async (u, e, d) => { sent.push([u, e, d.count]); return {}; };
  await Promise.all([tick(db, [cand("a", 80)], { notify }), tick(db, [cand("a", 80)], { notify })]);
  await tick(db, [cand("a", 80)], { notify });
  assert.equal(runsOf(db).length, 1);
  assert.equal(picksOf(db).length, 1);
  assert.deepEqual(sent, [[1, "picks", 1]]);
  // The same (user, run time) stored again — a restarted process that lost auto_last_run_at — writes nothing.
  const again = storeRun(db, { userId: 1, slotAt: runsOf(db)[0].slot_at, mode: "ask", expiresAt: NOW + DAY, seen: 1, take: [cand("z", 1)], leftOut: [], nowSec: NOW });
  assert.equal(again.created, false);
  assert.equal(picksOf(db).length, 1);
  // A crash between storing and delivering: the next tick delivers it — once.
  const lost = storeRun(db, { userId: 1, slotAt: NOW + 3600, mode: "ask", expiresAt: NOW + DAY, seen: 1, take: [cand("y", 1)], leftOut: [], nowSec: NOW });
  assert.equal(lost.created, true);
  await tick(db, [], { notify });
  await tick(db, [], { notify });
  assert.deepEqual(sent.map(s => s[1]), ["picks", "picks"]);
  assert.deepEqual((await deliverRun(db, db.prepare("SELECT * FROM picks_runs WHERE id = ?").get(lost.run.id), { notify })), { skipped: "already_delivered" });
  // Two deliveries racing on the same unclaimed row: the claim lets exactly one through.
  const race = storeRun(db, { userId: 1, slotAt: NOW + 7200, mode: "ask", expiresAt: NOW + DAY, seen: 1, take: [cand("x", 1)], leftOut: [], nowSec: NOW });
  const stale = db.prepare("SELECT * FROM picks_runs WHERE id = ?").get(race.run.id);
  await Promise.all([deliverRun(db, stale, { notify, secret: SECRET }), deliverRun(db, stale, { notify, secret: SECRET })]);
  assert.equal(sent.length, 3, "one message for the raced run");
});

// ── P2 · one message per run ─────────────────────────────────────────────────────────────────

const b64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function vapidEnv() {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  return { VAPID_PUBLIC_KEY: b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)])), VAPID_PRIVATE_KEY: jwk.d,
    VAPID_SUBJECT: "mailto:support@jobsviadraft.com", RESEND_API_KEY: "re_test", NODE_ENV: "test" };
}
function browser() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return { ecdh, auth, sub: { endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-d113", keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(auth) } } };
}
function decrypt(body, br) {
  const salt = body.subarray(0, 16), idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen), ct = body.subarray(21 + idlen);
  const secret = br.ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, br.auth, Buffer.concat([Buffer.from("WebPush: info\0"), br.ecdh.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const plain = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = plain.length - 1;
  while (end >= 0 && plain[end] === 0) end--;
  return plain.subarray(0, end).toString("utf8");
}

test("D113 · d113OneMessagePerRun — ONE email (names the jobs, with Apply / Pass) + ONE push (no company) per run, never more", async () => {
  const db = freshDb();
  setUser(db, "ask", { runTimes: ["09:00", "17:00"] });
  db.prepare("INSERT INTO user_profile (user_id, email) VALUES (1, 'dana@example.test')").run();
  const br = browser();
  saveSubscription(db, 1, br.sub);
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url: String(url), init }); return { ok: true, status: 201 }; };
  const config = configureNotify({ db, fetchImpl, env: vapidEnv(), appUrl: "https://app.example.test", log: quiet });
  try {
    const notify = (u, e, d) => notifyEvent(u, e, d, { config });
    const board = [{ ...cand("n1", 90), company: "Northwind Traders", title: "Platform Engineer" }, { ...cand("n2", 80), company: "Contoso", title: "API Engineer" }];
    await tick(db, board, { notify });
    await tick(db, board, { notify });
    await runAutoTick(db, { nowSec: NOW + 600, env: {}, fetchBoard: async () => board, startAutoRun: () => ({ status: 202, body: {} }), notify, secret: SECRET });
    const emails = calls.filter(c => c.url.includes("api.resend.com")), pushes = calls.filter(c => c.url.includes("fcm.googleapis.com"));
    assert.equal(emails.length, 1, "one email");
    assert.equal(pushes.length, 1, "one push");
    const mail = JSON.parse(emails[0].init.body);
    assert.match(mail.text, /Platform Engineer — Northwind Traders/, "the email names the job and company (the user's own inbox)");
    assert.match(mail.text, /Apply: https:\/\/app\.example\.test\/p\/confirm\//);
    assert.match(mail.text, /Pass: https:\/\/app\.example\.test\/p\/confirm\//);
    assert.match(mail.text, /Apply to all 2: /);
    const push = JSON.parse(decrypt(Buffer.from(pushes[0].init.body), br));
    assert.doesNotMatch(JSON.stringify(push), /Northwind|Contoso|Engineer/, "the push names no company and no job (notify.js' rule)");
    assert.match(push.body, /2 new picks are ready/);
    // The in-app row carries no link and no company either.
    const row = db.prepare("SELECT message, payload FROM notifications WHERE type = 'picks'").get();
    assert.doesNotMatch(row.message + row.payload, /Northwind|confirm/);
    // The next run time: one more message, for that run.
    db.prepare("UPDATE users SET auto_last_run_at = ? WHERE id = 1").run(NOW);
    await runAutoTick(db, { nowSec: NOW + 8 * 3600, env: {}, fetchBoard: async () => [cand("n3", 70)], startAutoRun: () => ({ status: 202, body: {} }), notify, secret: SECRET });
    assert.equal(calls.filter(c => c.url.includes("api.resend.com")).length, 2);
    assert.equal(picksOf(db).filter(p => p.state === "expired").length, 2, "the morning's untouched offers expired at the next run");
  } finally { configureNotify({}); }
  for (const ev of ["picks", "picks_summary", "pick_question"]) {
    assert.ok(NOTIFY_EVENTS[ev], ev);
    const t = eventText(ev, { count: 2, title: "Platform Engineer", company: "Northwind", sent: 1, waiting: 1 });
    assert.doesNotMatch(`${t.title} ${t.body}`, /Northwind|Platform/);
  }
  assert.equal(eventEmail("needs_you", {}), null, "every other event mails its in-app line, as before");
});

// ── P3 · the confirm page ────────────────────────────────────────────────────────────────────

async function askRun(db, board = [cand("a", 90), cand("b", 80)]) {
  setUser(db, "ask");
  await tick(db, board);
  return picksOf(db);
}

test("D113 · d113LinkGetNeverActs — GET shows the pick and ONE Confirm (a POST form); nothing changes, nothing starts", async () => {
  const db = freshDb();
  const [a] = await askRun(db);
  const starts = [];
  const t = mount(db, { startPickRun: (...x) => { starts.push(x); return { status: 202, body: {} }; } });
  try {
    for (const k of ["apply", "apply", "pass"]) {
      const r = await t.get(`/p/confirm/${tokenFor(k, a)}`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("cache-control"), "no-store");
      assert.match(r.headers.get("x-robots-tag"), /noindex/);
      assert.equal(r.headers.get("referrer-policy"), "no-referrer");
      assert.match(r.text, /<form method="post"><button class="primary" type="submit">Confirm: /);
      assert.match(r.text, /Engineer a/);
      assert.doesNotMatch(r.text, /Engineer b/, "only that pick");
    }
    assert.equal(starts.length, 0);
    assert.equal(db.prepare("SELECT state FROM picks WHERE id = ?").pluck().get(a.id), "offered");
    assert.equal(db.prepare("SELECT token_used_at FROM picks WHERE id = ?").pluck().get(a.id), null);
  } finally { t.server.close(); }
  const src = fs.readFileSync("routes/picksConfirm.js", "utf8");
  const get = src.slice(at(src, 'app.get("/p/confirm/:token"', 0, "picksConfirm.js"), at(src, 'app.post("/p/confirm/:token"', 0, "picksConfirm.js"));
  assert.doesNotMatch(get, /applyPicks|passPick|applyAll|saveAnswers|UPDATE /, "the GET handler calls no action");
});

test("D113 · d113TokenSingleUseExpires — signed, bound to (user, pick), works once, expires at the next run", async () => {
  const db = freshDb();
  const [a, b] = await askRun(db);
  const starts = [];
  const t = mount(db, { startPickRun: (...x) => { starts.push(x); return { status: 202, body: {} }; } });
  try {
    const first = await t.post(`/p/confirm/${tokenFor("apply", a)}`);
    assert.equal(first.status, 200);
    assert.match(first.text, /Sending it now/);
    assert.equal((await t.post(`/p/confirm/${tokenFor("apply", a)}`)).status, 409, "a second press does nothing");
    assert.equal((await t.post(`/p/confirm/${tokenFor("pass", a)}`)).status, 409, "a Pass after the Apply does nothing");
    assert.equal(starts.length, 1);
    assert.equal(db.prepare("SELECT state FROM picks WHERE id = ?").pluck().get(a.id), "applied");
    // Tampered, another user's binding, expired.
    const tok = tokenFor("apply", b);
    assert.equal((await t.post(`/p/confirm/${tok.slice(0, -2)}xx`)).status, 404);
    assert.equal((await t.get(`/p/confirm/${signPickToken(SECRET, { k: "apply", id: b.id, u: 2, exp: b.expires_at })}`)).status, 404, "bound to the user");
    assert.equal((await t.post(`/p/confirm/${signPickToken(pickSecret("another-secret"), { k: "apply", id: b.id, u: 1, exp: b.expires_at })}`)).status, 404);
    assert.equal(b.expires_at, runsOf(db)[0].expires_at);
    assert.equal(b.expires_at, runsOf(db)[0].slot_at + DAY, "the next run time (one run a day → tomorrow 09:00)");
    const expired = signPickToken(SECRET, { k: "apply", id: b.id, u: 1, exp: Math.floor(Date.now() / 1000) - 1 });
    assert.equal((await t.post(`/p/confirm/${expired}`)).status, 410);
    assert.equal(readPickToken(SECRET, tok, b.expires_at).error, "expired");
    assert.equal(starts.length, 1);
    // Pass works once too.
    assert.equal((await t.post(`/p/confirm/${tokenFor("pass", b)}`)).status, 200);
    assert.equal(db.prepare("SELECT state FROM picks WHERE id = ?").pluck().get(b.id), "passed");
  } finally { t.server.close(); }
});

test("D113 · Apply all for the run — once; the API's apply / pass are the same actions", async () => {
  const db = freshDb();
  const [a, b, c] = await askRun(db, [cand("a", 90), cand("b", 80), cand("c", 70)]);
  const starts = [];
  const t = mount(db, { startPickRun: (u, jobs, o) => { starts.push(jobs); return { status: 202, body: {} }; } });
  try {
    assert.equal((await t.api(`/api/picks/${c.id}/pass`, "POST")).body.pick.state, "passed");
    const all = signPickToken(SECRET, { k: "all", id: a.run_id, u: 1, exp: a.expires_at });
    assert.match((await t.get(`/p/confirm/${all}`)).text, /Apply to all 2 picks/);
    assert.equal((await t.post(`/p/confirm/${all}`)).status, 200);
    assert.deepEqual(starts, [["a", "b"]]);
    assert.equal((await t.post(`/p/confirm/${all}`)).status, 409);
    assert.equal((await t.api(`/api/picks/${a.id}/apply`, "POST")).status, 409);
  } finally { t.server.close(); }
});

// ── P4 · after the tap ───────────────────────────────────────────────────────────────────────

function applyFixture(db) {
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Dana','Example','dana@example.test')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  const generated = [];
  const app = express();
  const line = applyRoutes(app, db, (_q, _r, n) => n(), () => ({ field_map: {}, handler_map: {}, custom_answers: {} }),
    async (u, j) => { generated.push(j); return {}; }, async () => null, async () => ({}), () => null);
  // Stop everything (after the tick): a run is ADMITTED (every check runs) but waits in line — nothing opens a browser here.
  const hold = () => db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('apply_user_hold:1', '1')").run();
  return { line, generated, hold };
}
const runFor = (db, jobId) => db.prepare(`SELECT r.approval_mode, r.status FROM apply_run_jobs rj JOIN apply_runs r ON r.id = rj.run_id
  WHERE rj.job_id = ? ORDER BY rj.id DESC LIMIT 1`).get(jobId);

test("D113 · d113TailorOnlyAfterApply — building picks starts no run and generates nothing; Apply starts the run that tailors", async () => {
  const db = freshDb();
  job(db, "a"); job(db, "b");
  const { line, generated, hold } = applyFixture(db);
  setUser(db, "ask");
  const startCalls = [];
  await runAutoTick(db, { nowSec: NOW, env: {}, fetchBoard: async () => [cand("a", 90), cand("b", 80)],
    startAutoRun: (...x) => { startCalls.push(x); return line.startAutoRun(...x); }, secret: SECRET });
  assert.equal(picksOf(db).length, 2);
  assert.equal(startCalls.length, 0, "Ask me first never starts a run at the run time");
  assert.equal(db.prepare("SELECT COUNT(*) FROM apply_runs").pluck().get(), 0, "no run before the tap");
  assert.equal(generated.length, 0, "no résumé before the tap");
  hold();
  const t = mount(db, { startPickRun: line.startPickRun });
  try {
    assert.equal((await t.post(`/p/confirm/${tokenFor("apply", picksOf(db)[0])}`)).status, 200);
  } finally { t.server.close(); }
  assert.deepEqual(runFor(db, "a"), { approval_mode: "auto", status: "waiting" }, "the tap's run — not a deferred preview, so it tailors in the run");
  assert.equal(runFor(db, "b"), undefined, "b was not tapped");
  for (const f of ["services/picks.js", "services/autoScheduler.js"]) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), /generateResume|resumeForApply|coreGenerateResume/, `${f} never generates`);
  }
});

test("D113 · d113TapSendsUnlessReviewSetting — a SEMI user's tap is the send for THAT job (admission, the worker's lease); review on → a preview", async () => {
  const db = freshDb();
  job(db, "a"); job(db, "b"); job(db, "c");
  const { line, hold } = applyFixture(db);
  setUser(db, "ask");
  await runAutoTick(db, { nowSec: NOW, env: {}, fetchBoard: async () => [cand("a", 90), cand("b", 80), cand("c", 70)], startAutoRun: line.startAutoRun, secret: SECRET });
  const [a, b] = picksOf(db);
  hold();
  // No tap: a SEMI user cannot be sent for — FULL AUTO's rule is untouched.
  assert.equal(line.startAutoRun(1, ["c"]).body.error, "full_auto_not_chosen");
  const t = mount(db, { startPickRun: line.startPickRun });
  try {
    await t.post(`/p/confirm/${tokenFor("apply", a)}`);
    assert.equal(runFor(db, "a").approval_mode, "auto", "the tap sends");
    assert.equal(pickAuthorisesSend(db, 1, "a"), true);
    assert.equal(pickAuthorisesSend(db, 1, "c"), false, "only the tapped job");
    // "Show me the form before sending" on: the tap fills and stops at review.
    db.prepare("UPDATE users SET auto_settings = ? WHERE id = 1").run(JSON.stringify({ picks: true, timeZone: "America/New_York", showFormBeforeSending: true, savedAt: 0 }));
    await t.post(`/p/confirm/${tokenFor("apply", b)}`);
    assert.equal(runFor(db, "b").approval_mode, "required", "a preview, waiting for review");
    assert.equal(pickAuthorisesSend(db, 1, "b"), false, "a review tap carries no send authority");
  } finally { t.server.close(); }
  // The apply worker's lease: an unattended submit for a SEMI user goes only for a tapped job.
  const { enqueueRemoteRun, storeSession, leaseRemoteRun } = await import("../services/applyWorker.js");
  db.prepare("DELETE FROM app_settings").run();
  storeSession(db, 1, { portalFamily: "exampleportal", originHost: "portal.example.test", keyId: "key_abcdef123456",
    ciphertext: "c2VhbGVkLWNpcGhlcnRleHQtbm90LXJlYWRhYmxlLWJ5LWRyYWZ0LWF0LWFsbA==", consent: true });
  const remote = (jobId) => {
    const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','running',1,'auto')").run().lastInsertRowid;
    const rj = Number(db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,?,'held_gate')").run(run, jobId).lastInsertRowid);
    const pk = Number(db.prepare(`INSERT INTO apply_gate_packets (user_id, run_id, run_job_id, job_id, apply_url, expected_origin, gate_reason, answers_json, token_hash, expires_at)
      VALUES (1,?,?,?,'https://a.portal.example.test/x','https://a.portal.example.test','login_required','{"answers":[]}',?,0)`).run(run, rj, jobId, `t-${jobId}`).lastInsertRowid);
    enqueueRemoteRun(db, { userId: 1, runJobId: rj, packetId: pk, applyUrl: "https://a.portal.example.test/x", approvalMode: "auto" });
    return rj;
  };
  const untapped = remote("c");
  const tapped = remote("a");
  const lease = leaseRemoteRun(db, { workerId: "w", env: {} });
  assert.equal(lease.run.runJobId, tapped, "the tapped job is leased");
  assert.equal(db.prepare("SELECT outcome FROM apply_remote_runs WHERE run_job_id = ?").pluck().get(untapped), "full_auto_not_chosen", "the untapped one is stopped");
  const src = fs.readFileSync("routes/apply.js", "utf8");
  assert.match(src, /userApplyMode\(userId\) !== "auto" && !pickAuthorisesSend\(db, userId, jobId\)\)/, "processRunJob's hold reads the tap");
});

test("D113 · d113ApplyForMeSummaryOnly — FULL AUTO: no picks message, straight to the run, ONE summary after it", async () => {
  const db = freshDb();
  setUser(db, "apply");
  const events = [], starts = [];
  const notify = async (u, e, d) => { events.push([e, d]); return {}; };
  const startAutoRun = (u, jobs, opts) => {
    starts.push([jobs, opts]);
    const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','running',?,'auto')").run(jobs.length).lastInsertRowid;
    for (const j of jobs) db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,created_at) VALUES (?,1,?,'queued',?)").run(run, j, NOW);
    return { status: 202, body: { runId: Number(run) } };
  };
  const r = await tick(db, [cand("a", 90), cand("b", 80)], { notify, startAutoRun });
  assert.equal(r[0].started, 2);
  assert.deepEqual(starts, [[["a", "b"], { review: false }]]);
  assert.equal(events.length, 0, "no picks message in Apply for me");
  assert.deepEqual(picksOf(db).map(p => p.state), ["auto", "auto"]);
  assert.deepEqual((await runPicksFollowUps(db, { nowSec: NOW + 60, notify, secret: SECRET })).summaries, [], "still working: no summary yet");
  db.prepare("UPDATE apply_run_jobs SET status = 'submitted' WHERE job_id = 'a'").run();
  db.prepare("UPDATE apply_run_jobs SET status = 'held_review', reason_code = 'needs_you_eligibility' WHERE job_id = 'b'").run();
  await runPicksFollowUps(db, { nowSec: NOW + 120, notify, secret: SECRET });
  await runPicksFollowUps(db, { nowSec: NOW + 180, notify, secret: SECRET });
  assert.deepEqual(events.map(e => e[0]), ["picks_summary"], "one summary, once");
  assert.equal(events[0][1].sent, 1);
  assert.equal(events[0][1].waiting, 1);
  assert.equal(eventText("picks_summary", events[0][1]).body, "This run sent 1 application. 1 needs you.");
});

test("D113 · d113QuestionComesBack — a tapped job stopped on a question → ONE message with an answer link; GET shows it, POST answers once", async () => {
  const db = freshDb();
  const [a] = await askRun(db, [cand("a", 90)]);
  db.prepare("UPDATE picks SET state = 'applied', acted_at = ?, token_used_at = ? WHERE id = ?").run(NOW, NOW, a.id);
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',1,'auto')").run().lastInsertRowid;
  db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,reason_code,open_questions_json,created_at) VALUES (?,1,'a','held_review','unanswered_questions',?,?)")
    .run(run, JSON.stringify([{ question: "Why do you want to work here?" }]), NOW + 60);
  const events = [];
  const notify = async (u, e, d) => { events.push([e, d]); return {}; };
  await runPicksFollowUps(db, { nowSec: NOW + 120, notify, secret: SECRET, appUrl: "https://app.example.test" });
  await runPicksFollowUps(db, { nowSec: NOW + 180, notify, secret: SECRET, appUrl: "https://app.example.test" });
  assert.deepEqual(events.map(e => e[0]), ["pick_question"], "one message per round");
  assert.deepEqual(events[0][1].questions, ["Why do you want to work here?"]);
  assert.match(eventEmail("pick_question", events[0][1]).text, /Answer here: https:\/\/app\.example\.test\/p\/confirm\//);
  const path = events[0][1].answer.replace("https://app.example.test", "");
  const saved = [];
  const t = mount(db, { startPickRun: () => ({ status: 202, body: {} }), saveAnswers: (...x) => { saved.push(x); return { status: 202, body: {} }; } });
  try {
    const g = await t.get(path);
    assert.equal(g.status, 200);
    assert.match(g.text, /Why do you want to work here\?/);
    assert.equal(saved.length, 0, "the GET answers nothing");
    const p = await t.post(path, "q0=" + encodeURIComponent("Why do you want to work here?") + "&a0=" + encodeURIComponent("The payments work."));
    assert.equal(p.status, 200);
    assert.deepEqual(saved[0].slice(2), [{ answers: { "Why do you want to work here?": "The payments work." }, retryJobIds: ["a"], approvalMode: "auto" }]);
    assert.equal((await t.post(path, "q0=x&a0=y")).status, 409, "the answer link works once");
  } finally { t.server.close(); }
});

// ── account, privacy, wiring ─────────────────────────────────────────────────────────────────

test("D113 · the new user tables have a merge plan and are exported; deleting the account removes them (cascade)", async () => {
  for (const tbl of ["picks_runs", "picks", "picks_left_out"]) assert.ok(tbl in MERGE_PLAN, tbl);
  const db = freshDb();
  await askRun(db);
  const out = exportAccount(db, 1);
  assert.equal(out.data.picks.length, 2);
  assert.equal(out.data.picks_runs.length, 1);
  db.pragma("foreign_keys = ON");
  db.prepare("DELETE FROM users WHERE id = 1").run();
  assert.equal(db.prepare("SELECT COUNT(*) FROM picks").pluck().get(), 0);
  assert.equal(db.prepare("SELECT COUNT(*) FROM picks_runs").pluck().get(), 0);
});

test("D113 P6 · the privacy page discloses the picks messages and that a tap sends the application; the reconciliation has the rows", () => {
  const src = fs.readFileSync("client/src/pages/marketing/PrivacyPage.jsx", "utf8").replace(/\r\n/g, "\n");
  const prose = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/<[^>]+>/g, "").replace(/\{' '\}/g, " ").replace(/\s+/g, " ");
  assert.match(prose, /Picks by Message \(optional\)/);
  assert.match(prose, /sends you one picks message per run/);
  assert.match(prose, /A tap on Apply, then Confirm, sends the application/);
  assert.match(prose, /Opening a link never does anything by itself/);
  assert.match(prose, /Links are signed, work once and expire at your next run time/);
  assert.match(prose, /the list of left-out postings is deleted after 14 days/);
  assert.match(prose, /the picks email \(Picks by Message, above\) is the one message that names jobs and companies/);
  const recon = fs.readFileSync("extension/submission/PRIVACY_RECONCILIATION.md", "utf8");
  assert.match(recon, /## ⭐ D113 · PICKS BY MESSAGE — a tap sends the application/);
  assert.match(recon, /\| \*\*A tap sends\*\*/);
  assert.match(recon, /SMS \(D113 P5\) is NOT built/);
});

test("D113 · wired: the tick passes notify / the secret / the app URL; the confirm page and the API are mounted; the board carries the score", () => {
  const server = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");
  assert.match(server, /const PICKS_SECRET = pickSecret\(SESSION_SECRET\);/);
  assert.match(server, /runAutoTick\(db, \{ fetchBoard: autoFetchBoard, startAutoRun: applyLine\.startAutoRun,\n\s+notify: /);
  assert.match(server, /runPicksFollowUps\(db, /);
  // D113 UI U4 (Make it now) adds the apply path's own generation to the deps.
  assert.match(server, /picksConfirmRoutes\(app, db, requireAuth, \{ secret: PICKS_SECRET, startPickRun: applyLine\.startPickRun, saveAnswers: applyLine\.saveAnswers,\n\s+generateResume: generateResumeForApply \}\);/);
  assert.match(server, /score: Number\.isFinite\(j\.matchScore\) \? j\.matchScore : null/);
  const mig = MIGRATIONS.map(m => m.id);
  // 43t: 189_atlas_publish was merged beside it — 188 is present and the list stays ascending.
  assert.ok(mig.includes("188_picks"), "migration 188 is in the list");
  assert.ok(mig.indexOf("188_picks") < mig.indexOf("189_atlas_publish"), "188 runs before 189");
});
