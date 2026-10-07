// D55 decision F · THE OUTCOME STATUSES WIDENED TO THE FUNNEL — screen · interviewing · offer, beside
// rejected / no response / withdrawn. docs/AUTOFILL_TARGET.md §8.1 row 11, §8.4 F.
//
// What this file pins, each red when what it holds is removed:
//   · the funnel's words are ALIASES normalised onto the stored vocabulary (no second spelling stored)
//   · every outcome a row could carry BEFORE D55 reads exactly as it did — status and label
//   · `stage` splits `replied` into the funnel's steps and nothing else; `reached` keeps an interview
//     a later rejection ended
//   · the chips partition the rows: stage counts sum to the rows, and each status's D15 count is the
//     sum of its stages
//   · the merge endpoint takes "interviewing" and writes "interview"
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes, { capturedAtsAtApply } from "../routes/apply.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import {
  RESPONSE_OUTCOME, RESPONSE_OUTCOMES, normaliseOutcome, mergeResponse,
} from "../shared/applicationResponse.js";
import {
  historyStatus, buildHistory, chipCounts, applyHistoryView,
  HISTORY_STAGES, HISTORY_STATUSES, HISTORY_CHIPS, STAGE_STATUS, REPLY_ASK,
} from "../shared/applicationHistory.js";

const DAY = 86400;
const NOW = 1_800_000_000;
const sent = (over = {}) => ({ applicationId: 1, sentAt: NOW - 3 * DAY, ...over });

test("D55 F: the funnel's words normalise onto the STORED vocabulary — never a second spelling", () => {
  assert.equal(normaliseOutcome("interviewing"), "interview");
  assert.equal(normaliseOutcome("Interviewing"), "interview");
  assert.equal(normaliseOutcome("Phone screen"), "screen");
  assert.equal(normaliseOutcome("phone-screen"), "screen");
  assert.equal(normaliseOutcome("no reply"), "no_response");
  for (const o of RESPONSE_OUTCOMES) assert.equal(normaliseOutcome(o), o, `${o} is already stored as itself`);
  assert.equal(normaliseOutcome(null), null);
  assert.equal(normaliseOutcome("  "), null);
  assert.equal(normaliseOutcome("hired-on-the-spot"), undefined, "an unknown word is refused, not guessed");
  // The merge folds the alias, so furthest_stage still ranks it.
  const m = mergeResponse({}, { outcome: "interviewing" }, { now: NOW });
  assert.deepEqual([m.response_outcome, m.furthest_stage], ["interview", "interview"]);
  assert.throws(() => mergeResponse({}, { outcome: "bogus" }), /unknown response outcome/);
});

test("D55 F: every outcome stored before the funnel reads EXACTLY as it did — status and label", () => {
  // The pre-D55 reading, written out by hand (D15's rule) — not computed from the code under test.
  const before = [
    [{ responseOutcome: "rejected", firstResponseAt: NOW - DAY },  "replied",  "Rejected"],
    [{ responseOutcome: "screen", firstResponseAt: NOW - DAY },    "replied",  "Screen"],
    [{ responseOutcome: "interview", firstResponseAt: NOW - DAY }, "replied",  "Interview"],
    [{ responseOutcome: "offer", firstResponseAt: NOW - DAY },     "replied",  "Offer"],
    [{ responseOutcome: "no_response" },                           "no_reply", "No response"],
    [{ responseOutcome: "withdrawn" },                             "closed",   "Withdrawn"],
    [{},                                                           "sent",     "Sent · waiting"],
    [{ sentAt: NOW - 40 * DAY },                                   "sent",     "Did they reply?"],
    [{ firstResponseAt: NOW - DAY, furthestStage: "interview" },   "replied",  "Interview"],
  ];
  for (const [over, status, label] of before) {
    const s = historyStatus(sent(over), { now: NOW });
    assert.deepEqual([s.status, s.label], [status, label], JSON.stringify(over));
  }
  assert.deepEqual([...HISTORY_STATUSES], ["in_play", "sent", "replied", "no_reply", "closed"],
    "the five statuses D54's By company reads are unchanged");
});

test("D55 F: `stage` splits replied into the funnel; `reached` keeps the interview a rejection ended", () => {
  const st = (over) => historyStatus(sent({ firstResponseAt: NOW - DAY, ...over }), { now: NOW });
  assert.equal(st({ responseOutcome: "screen" }).stage, "screen");
  assert.equal(st({ responseOutcome: "interview" }).stage, "interviewing");
  assert.equal(st({ responseOutcome: "offer" }).stage, "offer");
  assert.equal(st({ responseOutcome: "rejected" }).stage, "rejected");
  assert.equal(st({ furthestStage: "screen" }).stage, "screen", "a cleared outcome falls back to the furthest stage");
  assert.equal(st({}).stage, "replied", "a reply with no stage is NOT guessed into one");
  // screen -> interview -> rejected: the current column is Rejected, but it reached Interviewing.
  const ended = st({ responseOutcome: "rejected", furthestStage: "interview" });
  assert.deepEqual([ended.stage, ended.reached], ["rejected", "interviewing"]);
  assert.equal(st({ responseOutcome: "rejected" }).reached, "applied", "rejected off the résumé reached nothing past applied");
  assert.equal(historyStatus({ recordState: "pending" }).reached, null, "an unsent row is in no funnel step");
  for (const s of HISTORY_STAGES) assert.ok(HISTORY_STATUSES.includes(STAGE_STATUS[s]), `${s} belongs to a status`);
  assert.deepEqual(HISTORY_CHIPS.map(c => c.id), [...HISTORY_STAGES], "one chip per stage, in funnel order");
  assert.ok(REPLY_ASK.some(a => a.outcome === RESPONSE_OUTCOME.SCREEN), "the ask offers the screen");
});

test("D55 F: the chips partition the rows — each status's count is the sum of its stages", () => {
  const apps = ["rejected", "screen", "interview", "interview", "offer", "no_response", "withdrawn", null, null]
    .map((o, i) => ({ id: i + 1, job_id: `j${i}`, company: `C${i}`, role: "R", applied_at: NOW - 10 * DAY,
      response_outcome: o, first_response_at: o && !["no_response", "withdrawn"].includes(o) ? NOW - 2 * DAY : null }));
  const records = [
    { id: 90, job_id: "p1", state: "pending" },
    { id: 91, job_id: "p2", state: "withdrawn" },
  ];
  const rows = buildHistory({ records, applications: apps }, { now: NOW });
  const c = chipCounts(rows);
  assert.equal(Object.values(c).reduce((a, b) => a + b, 0), rows.length, "every row in exactly one chip");
  assert.deepEqual(
    { screen: c.screen, interviewing: c.interviewing, offer: c.offer, rejected: c.rejected },
    { screen: 1, interviewing: 2, offer: 1, rejected: 1 });
  for (const status of HISTORY_STATUSES) {
    const byStatus = rows.filter(r => r.status === status).length;
    const byStages = HISTORY_STAGES.filter(s => STAGE_STATUS[s] === status).reduce((n, s) => n + c[s], 0);
    assert.equal(byStages, byStatus, `${status}: its stages add up to its D15 count`);
  }
  assert.deepEqual(applyHistoryView(rows, { chip: "interviewing" }).rows.map(r => r.jobId).sort(), ["j2", "j3"]);
});

// ── The merge endpoint, on the real migrations ───────────────────────────────────────────────────

function mount() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(), noop, noop, noop, noop);
  applicationRecordRoutes(app, db, (req, _res, next) => next(), { capturedAtsAtApply });
  const server = app.listen(0);
  return { db, base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}

test("D55 F: PATCH …/response takes the funnel's 'interviewing' and STORES 'interview'", async () => {
  const { db, base, stop } = mount();
  try {
    db.prepare("INSERT INTO job_applications (user_id,job_id,company,role,applied_at) VALUES (1,'j1','Northwind','Eng',?)")
      .run(Math.floor(Date.now() / 1000) - 5 * DAY);
    const patch = (outcome) => fetch(`${base}/api/apply/applications/j1/response`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome }) });
    assert.equal((await patch("screen")).status, 200);
    assert.equal((await patch("interviewing")).status, 200);
    assert.deepEqual(db.prepare("SELECT response_outcome, furthest_stage FROM job_applications WHERE job_id='j1'").get(),
      { response_outcome: "interview", furthest_stage: "interview" });
    assert.equal((await patch("bogus")).status, 400, "anything outside the vocabulary is still refused");
    await patch("rejected");
    const r = (await (await fetch(`${base}/api/applications/history`)).json()).rows.find(x => x.jobId === "j1");
    assert.deepEqual([r.status, r.stage, r.reached, r.label], ["replied", "rejected", "interviewing", "Rejected"]);
  } finally { stop(); }
});
