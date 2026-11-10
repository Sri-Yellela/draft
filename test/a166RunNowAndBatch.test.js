// ⭐ A166 (owner 11-10): when does an application run, Run now, and a run's résumés as ONE batch. Synthetic people.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { runAutoNow, runAutoTick } from "../services/autoScheduler.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// 03:00 in New York — well away from the 09:00 run time, so a scheduled tick is NOT due.
const NOW = (() => {
  const ny = (t) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(t * 1000)));
  let t = Math.floor(Date.now() / 1000) - 86400; t -= t % 3600;
  while (ny(t) !== 3) t -= 3600;
  return t;
})();

function freshDb() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'dana','x','PRO')").run();
  return db;
}
const setUser = (db, sendMode, settings = {}, lastRunAt = null) =>
  db.prepare("UPDATE users SET send_mode = ?, auto_settings = ?, auto_last_run_at = ? WHERE id = 1")
    .run(sendMode, JSON.stringify({ timeZone: "America/New_York", runTimes: ["09:00"], ...settings, savedAt: NOW - 3 * 86400 }), lastRunAt);
const cand = (id, score) => ({ jobId: id, company: `Co ${id}`, title: `Engineer ${id}`, score, postedAt: null });
const deps = (board, started = []) => ({ fetchBoard: async () => board, startAutoRun: (u, ids) => { started.push(ids); return { status: 202, body: {} }; }, secret: "s", appUrl: "" });

test("a166RunNowStartsTheBatchAtOnce: not due by the clock, Run now runs the same picks path", async () => {
  const db = freshDb();
  setUser(db, "semi", { picks: true }, NOW - 3600 * 6);
  const board = [cand("a", 90), cand("b", 80)];
  const tick = await runAutoTick(db, { nowSec: NOW, env: {}, ...deps(board) });
  assert.ok(tick.some(r => r.skipped === "not_due"), "the scheduled tick waits for 09:00");
  const r = await runAutoNow(db, 1, deps(board), { nowSec: NOW, env: {} });
  assert.equal(r.ok, true);
  assert.ok(r.result.some(x => x.picked === 2), JSON.stringify(r.result));
  const run = db.prepare("SELECT * FROM picks_runs WHERE user_id = 1").get();
  assert.equal(run.slot_at, NOW - (NOW % 60), "Run now's slot is this minute");
  assert.equal(db.prepare("SELECT auto_last_run_at FROM users WHERE id = 1").pluck().get(), NOW, "the slot is spent");
});

test("a166RunNowRefusals: twice within 10 minutes, no auto mode, the kill switch", async () => {
  const db = freshDb();
  setUser(db, "semi", { picks: true }, NOW - 120);
  const again = await runAutoNow(db, 1, deps([]), { nowSec: NOW, env: {} });
  assert.equal(again.ok, false); assert.equal(again.error, "ran_recently"); assert.ok(again.retryAfterSec > 0);
  setUser(db, "semi", {}, null);
  assert.equal((await runAutoNow(db, 1, deps([]), { nowSec: NOW, env: {} })).error, "no_auto_mode");
  setUser(db, "auto", {}, null);
  assert.equal((await runAutoNow(db, 1, deps([]), { nowSec: NOW, env: { APPLY_FULL_AUTO_DISABLED: "1" } })).error, "kill_switch");
});

test("a166Wiring: the endpoint, the timeline's words + Run now, the résumé batch before the fills", () => {
  const server = read("server.js");
  assert.match(server, /app\.post\("\/api\/apply\/run-now", requireAuth, async \(req, res\) => \{\n\s+try \{\n\s+const r = await runAutoNow\(db, req\.user\.id, \{ fetchBoard: autoFetchBoard, startAutoRun: applyLine\.startAutoRun,/);
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /A Draft you press runs right away — these are when draft picks new jobs for you\./);
  assert.match(panel, /data-run-now=""/);
  assert.match(panel, /api\("\/api\/apply\/run-now", \{ method: "POST" \}\)/);
  const route = read("routes/apply.js");
  const prep = route.indexOf("const prep = await prepareRunResumes(run, jobs);");
  const loop = route.indexOf("const runningJobs = [];");
  assert.ok(prep > 0 && prep < loop, "the batch runs before the first job is launched");
  // ⛔ never a résumé a job would not have written
  for (const guard of [/\(run\.approval_mode \|\| "auto"\) !== "auto"/, /userApplyMode\(run\.user_id\) !== "auto"/, /fullAutoDisabled\(\) \|\| fullAutoBlocked\(db\)/,
    /BATCH_PROVIDERS\.has\(detectPlatformFromUrl/, /APPLY_DAILY_CAP - submittedLast24h\(run\.user_id\)/, /artifactCurrency\(db, \{ userId: run\.user_id, jobId: job\.job_id, tool: toolType \}\)\.current/,
    /DRAFT_BATCH_RESUMES/]) assert.match(route, guard);
});
