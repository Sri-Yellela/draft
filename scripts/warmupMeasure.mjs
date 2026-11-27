#!/usr/bin/env node
// ⭐ 47k (the zero-downtime lane, owner 11-26 decision 6, lever (1)) · WHAT DOES WARMUP_DEFER_TAGS=1 BUY, AND WHAT DOES A
// REQUEST READ IN THE GAP?
//
// Boots server.js twice against the same starting data — flag OFF (today's gate) then flag ON (job_role_map and the
// tags' first slice run after ready) — and prints, for each:
//   · the boot timeline: listening at, ready at, job_role_map done at, the tags' first slice done at, the deferred
//     warm-up done at, the boot tag walk done at (ms since process start — the boot log's own clock);
//   · what the signed-out board reads return the moment ready answers (/api/public/jobs, /api/public/jobs/facets),
//     with their latency, and again once the deferred work is done;
//   · the database's own state at those two moments (active postings, active with no role bucket, active untagged,
//     active tagged by an older tagger) — what any reader sees in the gap.
//
// HARNESS-SAFE (test/harnessNoLiveKey): the model key blanked, the checkout's .env kept out, a throwaway RM_DATA_DIR
// under tmp/l47k-warmup-*, background jobs that reach the network off. Run it through the heavy-job lock:
//   bash C:/Users/duggi/WebstormProjects/draft/tmp/heavy.sh warmup node scripts/warmupMeasure.mjs [--data <dir>]
//
//   --data <dir>   a data directory holding resume_master.db (its -wal / -shm too). Each mode boots a FRESH COPY of it
//                  (copied into tmp/l47k-warmup-<mode>-*), so the source is never written and both modes start equal.
//                  Omitted: each mode boots an empty throwaway directory (schema only — it says nothing about scale).
//   --keep         keep the copies (default: removed after each mode).
//   --no-census    skip the database counts (on a production-size copy each is a read of every active row).
//   --port <n>     first port (default 3971; the second mode uses n + 1).
//
// ⚠ Production-scale numbers come from a production-size copy (staging), not from an empty directory.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { TAGGER_VERSION } from "../services/jobs/jobTags.js";

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SOURCE = opt("--data", null);
const KEEP = flag("--keep");
const CENSUS = !flag("--no-census");
const PORT0 = Number(opt("--port", 3971));
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const TMP = path.join(ROOT, "tmp");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DB_FILES = ["resume_master.db", "resume_master.db-wal", "resume_master.db-shm"];

function freshDir(mode) {
  const dir = path.join(TMP, `l47k-warmup-${mode}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  if (SOURCE) {
    if (!fs.existsSync(path.join(SOURCE, DB_FILES[0]))) throw new Error(`${SOURCE} has no ${DB_FILES[0]}`);
    for (const f of DB_FILES) if (fs.existsSync(path.join(SOURCE, f))) fs.copyFileSync(path.join(SOURCE, f), path.join(dir, f));
  }
  return dir;
}

function census(dir) {
  if (!CENSUS) return null;
  const file = path.join(dir, DB_FILES[0]);
  if (!fs.existsSync(file)) return null;
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    db.pragma("busy_timeout = 5000");
    const one = (sql, ...a) => db.prepare(sql).get(...a)?.n ?? null;
    return {
      active: one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1"),
      noRoleBucket: one(`SELECT COUNT(*) AS n FROM scraped_jobs sj WHERE sj.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM job_role_map m WHERE m.job_id = sj.job_id)`),
      untagged: one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_basis IS NULL"),
      olderTagger: one("SELECT COUNT(*) AS n FROM scraped_jobs WHERE is_active = 1 AND tag_basis IS NOT NULL AND COALESCE(tag_version, 0) <> ?", TAGGER_VERSION),
    };
  } catch (e) { return { error: e.message }; }
  finally { db.close(); }
}

async function timedGet(base, p) {
  const s = performance.now();
  try {
    const r = await fetch(base + p);
    const body = await r.json().catch(() => null);
    const ms = Math.round(performance.now() - s);
    const summary = body && typeof body === "object"
      ? { total: body.total ?? null, jobs: Array.isArray(body.jobs) ? body.jobs.length : undefined,
          keys: Object.keys(body).slice(0, 8), withWorkplace: Array.isArray(body.jobs) ? body.jobs.filter(j => j.workplace != null).length : undefined }
      : null;
    return { path: p, status: r.status, ms, ...summary };
  } catch (e) { return { path: p, error: e.message, ms: Math.round(performance.now() - s) }; }
}

const READS = ["/api/public/jobs", "/api/public/jobs/facets"];

async function bootOnce(mode, port) {
  const dir = freshDir(mode);
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    RM_DATA_DIR: dir, PORT: String(port), NODE_ENV: "development", SESSION_SECRET: "l47k-warmup-secret",
    ANTHROPIC_KEY: "", ANTHROPIC_API_KEY: "", RESEND_API_KEY: "", DOTENV_CONFIG_PATH: "tmp/no.env",
    DISCOVERY_PAUSED: "1", COMPANY_LOGOS: "off", COMPANY_FACTS: "off", COMPANY_GITHUB: "off", COMPANY_WEB_SIGNALS: "off",
    MATCH_ALERTS: "off", NETWORK_DIGEST: "off", DAILY_REMINDERS: "off", DRAFT_SCHEMA_READER: "off",
    WARMUP_DEFER_TAGS: mode === "on" ? "1" : "",
  };
  const t0 = performance.now();
  const child = spawn(process.execPath, ["server.js"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  const marks = {};
  const onLine = (line) => {
    let m;
    if ((m = line.match(/\[boot\] ready at (\d+) ms \(listening at (\d+) ms\)/))) { marks.readyMs = +m[1]; marks.listenMs = +m[2]; }
    if ((m = line.match(/\[boot\] deferred step "job_role_map" done at (\d+) ms \(took (\d+) ms\)/))) { marks.roleMapDoneMs = +m[1]; marks.roleMapTookMs = +m[2]; }
    if ((m = line.match(/\[boot\] deferred step "job tags \(first slice\)" done at (\d+) ms \(took (\d+) ms\)/))) { marks.tagsDoneMs = +m[1]; marks.tagsTookMs = +m[2]; }
    if ((m = line.match(/\[boot\] deferred warm-up done at (\d+) ms/))) marks.settledMs = +m[1];
    if ((m = line.match(/\[boot\] job tags boot walk done at (\d+) ms/))) marks.tagWalkDoneMs = +m[1];
  };
  let carry = "";
  const feed = (buf) => { const s = carry + buf.toString(); log += buf.toString(); const lines = s.split(/\r?\n/); carry = lines.pop(); lines.forEach(onLine); };
  child.stdout.on("data", feed);
  child.stderr.on("data", feed);
  let exited = false;
  child.on("exit", () => { exited = true; });

  // Ready: poll fast, so the first read lands as close to the flip as a healthcheck-switched request would.
  let readyClientMs = null;
  for (let i = 0; i < 6000 && !exited; i++) {
    try { if ((await fetch(`${base}/api/health/ready`)).ok) { readyClientMs = Math.round(performance.now() - t0); break; } } catch { /* not bound yet */ }
    await sleep(20);
  }
  const result = { mode, dir: path.relative(ROOT, dir), readyClientMs };
  if (readyClientMs == null) {
    result.error = exited ? "server exited before ready" : "never ready";
    result.logTail = log.slice(-3000);
  } else {
    // In the gap (with the flag on): the reads first, in parallel as a deploy's first requests would be, then the census.
    result.atReady = { reads: await Promise.all(READS.map(p => timedGet(base, p))), db: census(dir) };
    // Settled: the deferred work done (flag on), or at once (flag off — nothing is deferred).
    let version = null;
    for (let i = 0; i < 3000; i++) {
      try { version = await (await fetch(`${base}/api/version`)).json(); } catch { version = null; }
      const b = version?.boot;
      if (b && (b.deferred == null || (b.deferred.length === 0 && b.settledMs != null))) break;
      await sleep(50);
    }
    result.atSettled = { reads: await Promise.all(READS.map(p => timedGet(base, `${p}?_=settled`))), db: census(dir) };
    // Give the boot tag walk a moment to log its end (it continues in 50 ms slices after the first).
    for (let i = 0; i < 200 && marks.tagWalkDoneMs == null; i++) await sleep(50);
    const tl = version?.boot?.timeline || [];
    const step = (name) => tl.find(t => t.name === name) || null;
    result.boot = {
      listenMs: version?.boot?.listenMs ?? marks.listenMs ?? null,
      readyMs: version?.boot?.readyMs ?? marks.readyMs ?? null,
      settledMs: version?.boot?.settledMs ?? null,
      roleMap: step("job_role_map"), tagsFirstSlice: step("job tags (first slice)"),
      tagWalkDoneMs: marks.tagWalkDoneMs ?? null, logMarks: marks,
      slowSteps: tl.filter(t => t.ms >= 50).map(t => `${t.phase}:${t.name} ${t.ms}ms@${t.at}`),
    };
  }
  child.kill("SIGKILL");   // a boot child can ignore SIGTERM (memory: scale fixture traps)
  for (let i = 0; i < 100 && !exited; i++) await sleep(50);
  if (!KEEP) { await sleep(200); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { result.cleanup = e.message; } }
  return result;
}

fs.mkdirSync(TMP, { recursive: true });
console.log(`[warmupMeasure] source: ${SOURCE || "(empty throwaway data dir — schema only, NOT a scale measurement)"}`);
const runs = [];
runs.push(await bootOnce("off", PORT0));
runs.push(await bootOnce("on", PORT0 + 1));

for (const r of runs) {
  console.log(`\n── WARMUP_DEFER_TAGS ${r.mode === "on" ? "=1" : "off"} ──`);
  if (r.error) { console.log(`  ${r.error}\n${r.logTail}`); continue; }
  const b = r.boot;
  const at = (s) => (s ? `${s.phase} ${s.ms} ms, done at ${s.at} ms` : "not run (ROLE_MAP_BACKFILL=off?)");
  console.log(`  listening at ${b.listenMs} ms · ready at ${b.readyMs} ms (client saw ready at ${r.readyClientMs} ms after spawn)`);
  console.log(`  job_role_map: ${at(b.roleMap)}`);
  console.log(`  job tags (first slice): ${at(b.tagsFirstSlice)}`);
  if (b.settledMs != null) console.log(`  deferred warm-up done at ${b.settledMs} ms (${b.settledMs - b.readyMs} ms after ready)`);
  console.log(`  boot tag walk done at ${b.tagWalkDoneMs ?? "(not seen)"} ms`);
  for (const [label, snap] of [["at ready", r.atReady], ["settled", r.atSettled]]) {
    console.log(`  ${label}: db ${JSON.stringify(snap.db)}`);
    for (const q of snap.reads) console.log(`    ${q.path} → ${q.status ?? "ERR"} in ${q.ms} ms` + (q.error ? ` (${q.error})` : ` total=${q.total} jobs=${q.jobs ?? "-"} withWorkplace=${q.withWorkplace ?? "-"}`));
  }
  if (b.slowSteps.length) console.log(`  steps ≥ 50 ms: ${b.slowSteps.join(" · ")}`);
}
console.log("\n" + JSON.stringify({ source: SOURCE, runs }, null, 2));
