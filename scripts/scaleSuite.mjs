#!/usr/bin/env node
// ⭐ D151 RULE 5 · THE SCALE SUITE — boots the real server on a COPY of a scale fixture (scripts/scaleFixture.mjs) and
// holds it to the budgets; any breach exits 1.
//
//   node scripts/scaleSuite.mjs --fixture tmp/scale-100k [--users 20] [--seconds 60] [--json out.json]
//   npm run test:scale            (builds tmp/scale-100k first when it is missing)
//
// BUDGETS (D151 Rule 5): boot → listening ≤ 3 s and → ready ≤ 30 s · p95 ≤ 300 ms for the deck, the board (Full House),
// the posting, the tracker, Your map, the résumé check and Admin → Testers · event-loop p99 ≤ 100 ms under N concurrent
// users · the read pool never falls back · every background slice the server reports stays under 100 ms.
// The load starts after ready AND after the boot passes settle (the server's own background work is measured by the
// slice budget, not mixed into the request budget); --load-during-warmup measures the other case.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(k);
const FIXTURE = path.resolve(arg("--fixture", "tmp/scale-100k"));
const USERS = Number(arg("--users", 20));
const SECONDS = Number(arg("--seconds", 60));
const PORT = Number(arg("--port", 3991));
const SETTLE_MS = Number(arg("--settle-ms", 600000));
const JSON_OUT = arg("--json", null);
const PASSWORD = "Scale-Fixture-2026!x";
const ADMIN_EMAIL = "scale-admin@example.com";
export const BUDGETS = { listenMs: 3000, readyMs: 30000, p95Ms: 300, loopP99Ms: 100, sliceMs: 100 };

if (!fs.existsSync(path.join(FIXTURE, "resume_master.db"))) {
  const build = arg("--build-if-missing", null);
  if (!build) { console.error(`no fixture at ${FIXTURE} — run scripts/scaleFixture.mjs`); process.exit(2); }
  console.log(`building the ${build}-posting fixture at ${FIXTURE} (once)…`);
  const r = spawnSync(process.execPath, ["scripts/scaleFixture.mjs", "--postings", String(build), "--users", String(USERS), "--out", FIXTURE], { stdio: "inherit" });
  if (r.status !== 0) process.exit(2);
}

// ── a throwaway copy, so the fixture stays as built ──
const RUN = fs.mkdtempSync(path.join(os.tmpdir(), "draft-scale-"));
fs.copyFileSync(path.join(FIXTURE, "resume_master.db"), path.join(RUN, "resume_master.db"));
const LOOP = path.join(RUN, "loop.json");
const base = `http://127.0.0.1:${PORT}`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const failures = [];
const check = (name, ok, detail) => { if (!ok) failures.push(name); console.log(`${ok ? "ok  " : "FAIL"} ${name} — ${detail}`); };

const env = { ...process.env, RM_DATA_DIR: RUN, PORT: String(PORT), ANTHROPIC_KEY: "", NODE_ENV: "development",
  COOKIE_ENCRYPTION_KEY: crypto.randomBytes(32).toString("hex"), SCALE_LOOP_FILE: LOOP };
const t0 = Date.now();
const child = spawn(process.execPath, ["--import", "./test-support/scaleLoopProbe.mjs", "server.js"], { env, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; const keep = (d) => { log += d; if (log.length > 4e6) log = log.slice(-2e6); };
child.stdout.on("data", keep); child.stderr.on("data", keep);
const stop = async () => { if (child.exitCode == null) { child.kill("SIGTERM"); await Promise.race([new Promise(r => child.once("exit", r)), wait(10000)]); if (child.exitCode == null) child.kill("SIGKILL"); } };

try {
  // ── boot ──
  let listenMs = null, readyMs = null;
  for (;;) {
    if (child.exitCode != null) throw new Error(`server exited:\n${log.slice(-3000)}`);
    const r = await fetch(`${base}/api/health/ready`).then(x => x.status).catch(() => 0);
    if (r && listenMs == null) listenMs = Date.now() - t0;
    if (r === 200) { readyMs = Date.now() - t0; break; }
    if (Date.now() - t0 > 600000) throw new Error("not ready in 10 minutes");
    await wait(100);
  }
  const version = async () => fetch(`${base}/api/version`).then(r => r.json());
  const v0 = await version();
  // The server's own figures beside ours (ours include node's start-up).
  check("boot: listening ≤ 3 s", listenMs <= BUDGETS.listenMs, `${listenMs} ms (server's listenMs ${v0.boot?.listenMs})`);
  check("boot: ready ≤ 30 s", readyMs <= BUDGETS.readyMs, `${readyMs} ms (server's readyMs ${v0.boot?.readyMs})`);

  // ── sign in (before the settle, so the board-fit's "board" trigger is in the warm-up, as production's is) ──
  const sessions = [];
  for (let i = 0; i < USERS; i++) {
    const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `scale${i}`, password: PASSWORD }) });
    const j = await r.json().catch(() => ({}));
    if (r.status !== 200) throw new Error(`login scale${i}: ${r.status} ${JSON.stringify(j)}`);
    const cookie = (r.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
    sessions.push({ name: `scale${i}`, headers: { cookie, Authorization: `Bearer ${j.authContext}`, "Content-Type": "application/json" } });
  }
  const ar = await fetch(`${base}/api/admin/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD }) });
  const adminHeaders = { cookie: (ar.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ") };
  check("admin sign-in", ar.status === 200, String(ar.status));

  // ── settle: the boot passes (classify, tag, board-fit, Atlas) finish before the request budget is measured ──
  if (!has("--load-during-warmup")) {
    const s0 = Date.now();
    for (;;) {
      const v = await version();
      const busy = (v.classify && !["done", "idle"].includes(v.classify.state)) || (v.atlasQueue || 0) > 0 || (v.boot?.pending || []).length > 0;
      if (!busy && Date.now() - s0 > 5000) break;
      if (Date.now() - s0 > SETTLE_MS) { console.log(`(settle: still busy after ${SETTLE_MS} ms — measuring anyway)`); break; }
      await wait(2000);
    }
    console.log(`settled after ${Math.round((Date.now() - s0) / 1000)} s`);
  }

  // ── the load: N users, each going round the screens for SECONDS ──
  // A posting reaches a person's board only after their board-fit match (44w), so wait for the board to fill.
  let jobIds = [];
  for (const s0 = Date.now(); Date.now() - s0 < 180000; await wait(2000)) {
    jobIds = await fetch(`${base}/api/jobs?page=1&pageSize=50`, { headers: sessions[0].headers }).then(r => r.json())
      .then(j => (j.jobs || []).map(x => x.job_id ?? x.jobId ?? x.id).filter(x => x != null)).catch(() => []);
    if (jobIds.length) break;
  }
  check("the board returns postings", jobIds.length > 0, `${jobIds.length} on page 1`);
  if (!jobIds.length) throw new Error("the board never filled — nothing to load");
  const resumeText = "Synthetic Person\nEXPERIENCE\nSoftware Engineer (2021 - present)\n- Built Python, Go and PostgreSQL services on AWS.\nSKILLS\nPython, Go, TypeScript, React, Kubernetes, PostgreSQL, AWS";
  const today = new Date().toISOString().slice(0, 10);
  const SCREENS = [
    ["deck", (h) => fetch(`${base}/api/draft/today?date=${today}&order=best`, { headers: h })],
    ["board (Full House)", (h) => fetch(`${base}/api/jobs?page=1&pageSize=50&include_facets=work_model,experience_level,employment_type,sources,automation_tier`, { headers: h })],
    ["board facets", (h) => fetch(`${base}/api/jobs/facets`, { headers: h })],
    ["posting", (h, k) => fetch(`${base}/api/jobs/by-id/${encodeURIComponent(jobIds[k % jobIds.length])}`, { headers: h })],
    ["tracker", (h) => fetch(`${base}/api/applications/history`, { headers: h })],
    ["tracker (held)", (h) => fetch(`${base}/api/apply/review`, { headers: h })],
    ["Your map", (h) => fetch(`${base}/api/your-skills/map`, { headers: h })],
    ["résumé check", (h, k) => fetch(`${base}/api/jobs/${encodeURIComponent(jobIds[k % jobIds.length])}/keywords`, { method: "POST", headers: h, body: JSON.stringify({ resumeText }) })],
  ];
  const times = Object.fromEntries([...SCREENS.map(s => s[0]), "Admin → Testers"].map(n => [n, []]));
  const statuses = {};
  const time = async (name, f) => { const a = performance.now(); const r = await f().catch(e => ({ status: 0, e })); const ms = performance.now() - a;
    try { await r.arrayBuffer?.(); } catch {} times[name].push(ms); statuses[`${name} ${r.status}`] = (statuses[`${name} ${r.status}`] || 0) + 1; };
  fs.writeFileSync(`${LOOP}.reset`, "1"); await wait(800);
  const end = Date.now() + SECONDS * 1000;
  await Promise.all([
    ...sessions.map(async (s, u) => { let k = u; while (Date.now() < end) for (const [name, f] of SCREENS) { if (Date.now() >= end) break; await time(name, () => f(s.headers, k++)); } }),
    (async () => { while (Date.now() < end) { await time("Admin → Testers", () => fetch(`${base}/api/admin/testers/people`, { headers: adminHeaders })); await wait(1000); } })(),
  ]);
  await wait(700);
  const loop = JSON.parse(fs.readFileSync(LOOP, "utf8"));
  const pct = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]); };
  const table = {};
  for (const [name, a] of Object.entries(times)) {
    table[name] = { n: a.length, p50: pct(a, 50), p95: pct(a, 95), max: a.length ? Math.round(Math.max(...a)) : null };
    check(`p95 ≤ 300 ms: ${name}`, a.length > 0 && table[name].p95 <= BUDGETS.p95Ms, `p95 ${table[name].p95} ms (p50 ${table[name].p50}, max ${table[name].max}, n ${a.length})`);
  }
  const bad = Object.entries(statuses).filter(([k]) => !/ 200$/.test(k));
  check("every request answered 200", bad.length === 0, bad.length ? JSON.stringify(Object.fromEntries(bad)) : `${Object.values(statuses).reduce((a, b) => a + b, 0)} requests`);
  check(`event-loop p99 ≤ 100 ms under ${USERS} users`, loop.p99 <= BUDGETS.loopP99Ms, `p99 ${loop.p99} ms, p50 ${loop.p50}, max ${loop.max}`);
  const v1 = await version();
  check("the read pool never fell back", (v1.readPool?.fallback || 0) === 0, JSON.stringify({ served: v1.readPool?.served, fallback: v1.readPool?.fallback }));
  const slices = { "classify page": v1.classify?.maxPageMs, "classify write": v1.classify?.maxWriteMs, "classify read": v1.classify?.maxReadMs };
  for (const [n, ms] of Object.entries(slices)) if (ms != null) check(`background slice ≤ 100 ms: ${n}`, ms <= BUDGETS.sliceMs, `${ms} ms`);
  const longest = [...log.matchAll(/"longest(?:Slice|PlanPage|Commit)Ms":(\d+)/g)].map(m => Number(m[1]));
  if (longest.length) check("background slice ≤ 100 ms: board-fit (slice / plan page / commit)", Math.max(...longest) <= BUDGETS.sliceMs, `max ${Math.max(...longest)} ms over ${longest.length} readings`);
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ fixture: FIXTURE, users: USERS, seconds: SECONDS, listenMs, readyMs, boot: v0.boot, table, loop, statuses, readPool: v1.readPool, classify: v1.classify, failures }, null, 2));
} catch (e) {
  failures.push(`error: ${e.message}`); console.error(e.message);
} finally {
  await stop();
  try { fs.rmSync(RUN, { recursive: true, force: true }); } catch {}
}
console.log(failures.length ? `\n${failures.length} budget(s) FAILED: ${failures.join(" · ")}` : "\nall budgets met");
process.exit(failures.length ? 1 : 0);
