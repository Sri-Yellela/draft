// D51 (owner, 10-07) — A DRAFTED JOB IS SEEN NOWHERE, AND ITS BUTTON IS JUST GREYED OUT.
//
// Measured on a throwaway server (synthetic account, every posting pointed at the local fake ATS): a
// Draft wrote apply_runs / apply_run_jobs ONLY. Draft House read those; /d read résumés and
// application_records; The Table read application_records — so the job was in Draft House (under
// Stopped, as held_review) and absent from /d and The Table, while every Draft button for it went grey
// with no word of why. Also found: /d's record half keyed on `uj.user_id`, which is NULL under the
// board's LEFT JOIN when the user has no user_jobs row for the active profile, so even a record could not
// reach /d; a refused Draft rendered the SUCCESS toast ("Drafted … · Undo"); and `jobIds:[null]` was
// admitted as the job "null", spending a slot.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes from "../routes/apply.js";
import { listHistory, markPending, releaseDraftRecord } from "../services/applicationRecords.js";
import { draftSlots } from "../services/draftSlots.js";
import { historyStatus } from "../shared/applicationHistory.js";
import { draftBlock, draftButtonState, untilLabel } from "../client/src/lib/jobDecisions.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

function mount() {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO domain_profiles (id,user_id,profile_name,role_family,domain,is_active) VALUES (10,1,'SWE','engineering','software',1)").run();
  db.prepare("INSERT INTO user_profile (user_id,first_name,last_name,email) VALUES (1,'Ada','Synthetic','ada@example.test')").run();
  db.prepare("INSERT INTO profile_base_resumes (profile_id,user_id,name,content,updated_at) VALUES (10,1,'r.txt','synthetic resume text',unixepoch())").run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(),
    () => ({ field_map: {}, handler_map: {}, custom_answers: {} }), noop, noop, noop, () => null);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, p, body) => fetch(base + p, { method, headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined });
  return { db, call, stop: () => server.close() };
}
const record = (db, job) => db.prepare("SELECT state, origin FROM application_records WHERE user_id=1 AND job_id=?").get(job) || null;
const runJob = (db, job) => db.prepare("SELECT id, status FROM apply_run_jobs WHERE user_id=1 AND job_id=? ORDER BY id DESC").get(job);

// /d's membership, exactly as the board runs it: ALL's statement (LEFT JOIN user_jobs per profile) plus
// the one predicate. Evaluated from the shipping source.
const server = read("server.js");
const OPEN = "const pendingMembershipSql = (uid) => `";
const PREDICATE = server.slice(at(server, OPEN) + OPEN.length, at(server, "`;", at(server, OPEN))).replaceAll("$" + "{uid}", "1");
const inSlashD = (db, job) => db.prepare(`SELECT sj.job_id FROM scraped_jobs sj
    LEFT JOIN user_jobs uj ON uj.job_id = sj.job_id AND uj.user_id = 1 AND uj.domain_profile_id = 10
    WHERE sj.is_active = 1 AND ${PREDICATE}`).all().some(r => r.job_id === job);
const addPosting = (db, job) => db.prepare(`INSERT OR IGNORE INTO scraped_jobs (job_id,title,company,url,search_query,_hash,is_active)
    VALUES (?, 'Engineer', 'Northwind', 'http://127.0.0.1:9/x', 't', ?, 1)`).run(job, `h-${job}`);

test("D51 · ONE WRITE, THREE READERS — a Draft is in Draft House, /d and The Table at once", async () => {
  const t = mount();
  try {
    // No posting row, so the run fails fast without a browser; the Draft itself is what is measured.
    const r = await t.call("POST", "/api/apply/runs", { jobIds: ["gh::d51"], mode: "auto", surface: "board" });
    assert.equal(r.status, 202);
    assert.ok(runJob(t.db, "gh::d51"), "Home's row");
    assert.deepEqual(record(t.db, "gh::d51"), { state: "pending", origin: "drafted" }, "the record, written with the run-job");
    // /d — with NO user_jobs row for the active profile: the case that could never match before.
    addPosting(t.db, "gh::d51");
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM user_jobs WHERE job_id='gh::d51'").pluck().get(), 0);
    assert.ok(inSlashD(t.db, "gh::d51"), "/d reads the Draft");
    // The Table — In play, labelled as a Draft.
    const row = listHistory(t.db, 1).find(x => x.jobId === "gh::d51");
    assert.equal(row?.status, "in_play");
    assert.equal(row?.label, "Drafted — in Home");
  } finally { t.stop(); }
});

test("D51 · the record is written in the run-job's own transaction — both or neither", () => {
  const src = read("routes/apply.js");
  const tx = src.slice(at(src, "    db.transaction(() => {\n      for (const id of filtered) {"), at(src, "let run = db.prepare(\"SELECT * FROM apply_runs WHERE id=?\")"));
  assert.match(tx, /insertJob\.run\(runId, userId, id, approvedFrom\?\.\[id\] \?\? null\);\n\s+if \(tagDrafted\) markPending\(db, userId, id, "drafted"\);/);
  // An approval or an answers retry continues a Draft that already wrote one.
  assert.match(src, /const tagDrafted = resolvedApproval !== "approved" && !retryOfHeld &&/);
});

test("D51 · undoing the Draft releases it everywhere — abort, and removal from the line", async () => {
  const t = mount();
  try {
    await t.call("POST", "/api/apply/runs", { jobIds: ["gh::undo"], mode: "auto", surface: "board" });
    const rj = runJob(t.db, "gh::undo");
    // Claim it back to a pending status so the abort endpoint (Undo) can cancel it.
    t.db.prepare("UPDATE apply_run_jobs SET status='queued' WHERE id=?").run(rj.id);
    const ab = await t.call("POST", `/api/apply/run-jobs/${rj.id}/abort`);
    assert.equal(ab.status, 200);
    assert.equal(record(t.db, "gh::undo"), null, "released: out of /d and The Table");
    addPosting(t.db, "gh::undo");
    assert.equal(inSlashD(t.db, "gh::undo"), false);
    // The line: a waiting run removed whole.
    const run = t.db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode,line_position) VALUES (1,'auto','waiting',1,'required',1)").run().lastInsertRowid;
    t.db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,'gh::line','queued')").run(run);
    markPending(t.db, 1, "gh::line", "drafted");
    const del = await t.call("DELETE", `/api/apply/line/${run}`);
    assert.equal(del.status, 200);
    assert.equal(record(t.db, "gh::line"), null);
  } finally { t.stop(); }
});

test("D51 · release touches ONLY the Draft's own pending record — opened, recorded, re-drafted ones stay", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  // One run per attempt — (run_id, job_id) is unique.
  const rj = (job, status) => {
    const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs) VALUES (1,'auto','completed',1)").run().lastInsertRowid;
    db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status) VALUES (?,1,?,?)").run(run, job, status);
  };
  // Opened after drafting: the stronger origin replaces 'drafted', so Undo leaves it.
  markPending(db, 1, "opened", "drafted"); markPending(db, 1, "opened", "opened_posting"); rj("opened", "cancelled");
  assert.equal(releaseDraftRecord(db, 1, "opened"), false);
  assert.equal(record(db, "opened").origin, "opened_posting");
  // Drafted again: one live attempt is enough to keep it.
  markPending(db, 1, "again", "drafted"); rj("again", "cancelled"); rj("again", "held_review");
  assert.equal(releaseDraftRecord(db, 1, "again"), false);
  // Recorded: never released.
  markPending(db, 1, "rec", "drafted"); db.prepare("UPDATE application_records SET state='recorded' WHERE job_id='rec'").run(); rj("rec", "cancelled");
  assert.equal(releaseDraftRecord(db, 1, "rec"), false);
  // The plain case.
  markPending(db, 1, "plain", "drafted"); rj("plain", "cancelled");
  assert.equal(releaseDraftRecord(db, 1, "plain"), true);
  assert.equal(record(db, "plain"), null);
});

test("D51 · a null or empty job id is refused — nothing queued, no slot spent", async () => {
  const t = mount();
  try {
    for (const bad of [[null], [""], ["  "], [{}]]) {
      const r = await t.call("POST", "/api/apply/runs", { jobIds: bad, mode: "auto", surface: "board" });
      assert.equal(r.status, 400, JSON.stringify(bad));
      assert.equal((await r.json()).error, "bad_job_id");
    }
    assert.equal(t.db.prepare("SELECT COUNT(*) FROM apply_run_jobs").pluck().get(), 0);
    assert.equal(draftSlots(t.db, 1).used, 0);
  } finally { t.stop(); }
});

test("D51 · the button is NEVER disabled without a reason — every state, every combination", () => {
  const blocks = [null, draftBlock({ paused: true }), draftBlock({ prereqMissing: ["base_resume"],
    prereqLabels: { base_resume: { obstacle: "No base resume on this profile" } } }),
    draftBlock({ slots: { limit: 10, remaining: 0, nextFreeAt: Date.now() + 3 * 3600e3 } })];
  const idleTitle = draftButtonState({}).title;
  for (const drafted of [false, true]) for (const drafting of [false, true]) for (const block of blocks) for (const canView of [false, true]) {
    const s = draftButtonState({ drafted, drafting, block, canView });
    if (s.disabled || s.ariaDisabled) {
      assert.ok(s.title && s.title !== idleTitle, `${s.kind}: refused without a reason`);
      assert.notEqual(s.action, "draft", `${s.kind}: a refused button must not fire a Draft`);
    }
    if (s.disabled) assert.equal(s.kind, "drafting", "only a Draft on the wire is truly disabled");
  }
  // Drafted is not refused: it opens Draft House.
  const d = draftButtonState({ drafted: true, canView: true });
  assert.equal(d.action, "view");
  assert.equal(d.disabled, false);
  assert.match(d.label, /Drafted ✓/);
  assert.match(d.title, /Home/);
});

test("D51 · each refusal says the server's own reason, with when it ends", () => {
  const now = Date.UTC(2026, 9, 7, 12);
  const out = draftBlock({ slots: { limit: 10, remaining: 0, nextFreeAt: now + 3 * 3600e3 - 60e3 }, now });
  assert.equal(out.label, "Out of drafts");
  assert.match(out.reason, /all 10 used in the last 24 hours/);
  assert.match(out.reason, /Resets in 3h\./);
  assert.equal(untilLabel(now + 20 * 60e3, now), "20 min");
  assert.match(draftBlock({ paused: true }).reason, /paused by the operator/);
  assert.match(draftBlock({ prereqMissing: ["profile_email"], prereqLabels: { profile_email: { obstacle: "Your profile has no email address" } } }).reason,
    /Can't be drafted yet — Your profile has no email address\./);
  assert.equal(draftBlock({ slots: { limit: 10, remaining: 3 } }), null, "slots left: nothing to refuse");
});

test("D51 · the slots say when the next one frees — the oldest use plus 24 hours", () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash) VALUES (1,'ada','x')").run();
  const now = 1_800_000_000;
  assert.equal(draftSlots(db, 1, { now }).nextFreeAt, null, "nothing used");
  const run = db.prepare("INSERT INTO apply_runs (user_id,mode,status,total_jobs,approval_mode) VALUES (1,'auto','completed',2,'required')").run().lastInsertRowid;
  db.prepare("INSERT INTO apply_run_jobs (run_id,user_id,job_id,status,created_at) VALUES (?,1,'a','held_review',?)").run(run, now - 3600);
  db.prepare("INSERT INTO draft_slot_uses (user_id,kind,job_id,created_at) VALUES (1,'generate','b',?)").run(now - 7200);
  assert.equal(draftSlots(db, 1, { now }).nextFreeAt, (now - 7200 + 86400) * 1000);
});

test("D51 · a refused Draft says why — never the success toast with an Undo", () => {
  const toast = read("client/src/components/DecisionToast.jsx");
  assert.match(toast, /\{toast\.error \? \(\n\s+<span data-decision-refused="">/);
  const refused = toast.slice(at(toast, "{toast.error ? ("), at(toast, ") : ("));
  assert.doesNotMatch(refused, /Undo|DECISION_AFTER/, "a refusal offers no Undo and no success sentence");
});

test("D51 · every Draft control takes its state from the one function, and the board moves without a reload", () => {
  // 47j A248 (changed on purpose): the board's Draft is the Index row's (RowBubble) — the same one function
  const bubble = read("client/src/plate/MarketIndex.jsx");
  assert.match(bubble, /const draft = draftButtonState\(\{ drafted, drafting, block: draftBlocked, canView: !!onViewDraft, slots: draftSlots \}\);/);
  assert.doesNotMatch(bubble, /disabled=\{drafted \|\| drafting\}/, "the grey dead end is gone");
  const buttons = read("client/src/components/DecisionButtons.jsx");
  assert.match(buttons, /const s = draftButtonState\(\{ drafted, drafting, block, canView: !!onView, slots \}\);/);
  const panel = read("client/src/panels/JobsPanel.jsx");
  const decide = panel.slice(at(panel, "const decideJob = useCallback("), at(panel, "const undoLastDecision = useCallback("));
  assert.match(decide, /if \(r\.slots\) setDraftSlots\(r\.slots\);\n\s+setFacetsNonce\(n => n \+ 1\);/, "the quota and the /d count move");
  assert.match(panel, /onView: \(\) => navigate\("\/app\/auto-apply"\)/, "Drafted ✓ opens Home");
  assert.match(read("client/src/panels/DatabasePanel.jsx"), /onOpenDraftHouse=\{\(\) => navigate\("\/app\/auto-apply"\)\}/);
  // A drafted row is done, not greyed out: it says "Drafted" (RowBubble's word), never a disabled grey square.
  assert.match(bubble, /\{draft\.kind === "drafted" \? "Drafted" :/);
});

test("D51 · The Table labels a Draft — and only a Draft — as in Draft House", () => {
  assert.deepEqual(historyStatus({ recordState: "pending", origin: "drafted" }),
    // D55 F added the funnel stage (= the status here) and how far it got (nothing: it is unsent).
    { status: "in_play", label: "Drafted — in Home", ask: false, stage: "in_play", reached: null });
  assert.equal(historyStatus({ recordState: "pending", origin: "opened_posting" }).label, "Pending");
});
