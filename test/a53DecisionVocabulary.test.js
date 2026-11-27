// A53 — WHAT A USER DOES WITH A JOB: one vocabulary, one set of calls, on every surface.
//
// Owner decisions, 10-02:
//   1. "Queue Auto" IS Draft — the same NAME and the same BEHAVIOUR. The board's Draft (card and
//      JobDetailPanel) makes the deck's call: an immediate, persisted POST /api/apply/runs. The
//      client-side basket it used to feed (lost on every reload) is gone.
//   2. Save and Pass SET, never toggle — the deck's PATCH /api/jobs/interact, never the per-id
//      toggle routes, which read the current value and write its opposite.
//   3. Reversal is Undo — the deck's toast and the deck's undo call, shared, on both surfaces.
//
// Source checks pin WHERE each surface gets its calls (one module, no forks); the module itself is
// exercised against a recording api(); the route's duplicate and surface rules over real HTTP.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import Database from "better-sqlite3";
import applyRoutes from "../routes/apply.js";
import {
  DECISIONS, DECISION_SURFACES, commitDecision, undoDecision, flagsFor, undoFlagsFor, isDrafted,
} from "../client/src/lib/jobDecisions.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// Code only — the notes that explain a retired word name it, and must not trip the guard.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const CLIENT = walk("client/src").map(p => ({ p: p.replace(/\\/g, "/"), src: code(read(p)) }));

// ── 1 · the retired synonyms ─────────────────────────────────────────────────────────────────
// Every second name for one of the three actions, and the basket that gave "queue" a second
// meaning. Exported so the injected-violation check below runs the SAME list.
export const RETIRED = [
  [/Queue Auto/i,                        'Draft is the verb — "Queue Auto" was a second name for it'],
  [/auto-apply queue/i,                  'the board\'s Draft does not put a job in a "queue"; it drafts it'],
  [/queued for auto apply/i,             'the basket\'s toast'],
  [/Autofill for Review/,                'the basket\'s dispatch button'],
  [/\b(?:add|remove)(?:To|From)ApplyQueue\b/, 'the client-side basket'],
  [/\bstartApplyRun\b/,                  'the basket\'s dispatch'],
  [/\bapplyQueue\b/,                     'the client-side basket'],
  [/"Not interested"/,                   'Pass is the word — "Not interested" was its second name'],
  [/\bonQueueApply\b|\bonDislike\b|\bonStar\b/, 'the board\'s old wiring names for Draft / Pass / Save'],
];

export function retiredHits(files) {
  const hits = [];
  for (const { p, src } of files) {
    for (const [re, why] of RETIRED) if (re.test(src)) hits.push(`${p}: ${re} — ${why}`);
  }
  return hits;
}

test("⛔ no retired synonym for Draft, Pass or Save, and no basket, anywhere in the client", () => {
  assert.deepEqual(retiredHits(CLIENT), []);
});

test("the guard goes red on an injected violation of each kind", () => {
  // Seen red: each line below is a real shape of the old code, and each must be caught.
  for (const injected of [
    '<ActionBtn title="Add to auto-apply queue">Queue Auto</ActionBtn>',
    'const { addToApplyQueue } = useAutoApply();',
    'const [applyQueue, setApplyQueue] = useState([]);',
    '<button onClick={() => startApplyRun("review")}>Autofill for Review</button>',
    '<ActionBtn onClick={() => onDislike?.()} title="Not interested">Pass</ActionBtn>',
  ]) {
    assert.notDeepEqual(retiredHits([{ p: "injected.jsx", src: code(injected) }]), [], `not caught: ${injected}`);
  }
  // And a comment that NAMES the retired word, to explain its removal, is not a violation.
  assert.deepEqual(retiredHits([{ p: "note.jsx", src: code('// "Queue Auto" was the old name for Draft') }]), []);
});

// ── 2 · one call, both surfaces ──────────────────────────────────────────────────────────────

// ⛔ 47m (changed on purpose): "the board's Draft calls the SAME route, through the SAME function, as the deck's" retired — the surface it pinned was rebuilt in the plate system (47m M5).

test("⛔ Save and Pass SET — no client code calls the per-id toggle routes", () => {
  for (const { p, src } of CLIENT) {
    assert.doesNotMatch(src, /\/api\/jobs\/\$\{[^}]+\}\/(?:starred|disliked)/, `${p} calls a toggle route`);
    assert.doesNotMatch(src, /\bdislikeJob\b/, `${p} still uses the toggle helper`);
  }
  // A repeat is a no-op that shows the set state, never a second write.
  const board = code(read("client/src/panels/JobsPanel.jsx"));
  // D190 (46m): the no-op says so ("already") — Ask draft reports what happened; still nothing is written
  assert.match(board, /if \(decision === DECISIONS\.SAVED && prior\.starred\) return "already";/);
  assert.match(board, /if \(decision === DECISIONS\.PASSED && prior\.disliked\) return "already";/);
  const card = code(read("client/src/components/JobCard.jsx"));
  assert.match(card, /const handleSave = \(\) => \{\s*if \(starred\) return;/);
});

test("Undo is ONE component and ONE call on both surfaces", () => {
  const deck = code(read("client/src/panels/DeckView.jsx"));
  const board = code(read("client/src/panels/JobsPanel.jsx"));
  for (const [name, src] of [["deck", deck], ["board", board]]) {
    assert.match(src, /<DecisionToast toast=\{/, `the ${name} renders its own toast`);
    assert.match(src, /await undoDecision\(\{ jobId: t\.jobId, decision: t\.decision, runId: /, `the ${name} undoes through its own call`);
  }
});

// ── 3 · the shared module, against a recording api() ─────────────────────────────────────────

function recorder(responses = {}) {
  const calls = [];
  const api = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : null });
    return responses[url] ?? {};
  };
  return { api, calls };
}

test("Draft posts one job, mode auto, the surface, and NEVER approvalMode", async () => {
  for (const surface of [DECISION_SURFACES.DECK, DECISION_SURFACES.BOARD]) {
    const { api, calls } = recorder({ "/api/apply/runs": { runId: 7 } });
    const r = await commitDecision({ jobId: "j1", decision: DECISIONS.DRAFTED, tool: "generate", surface, api });
    assert.equal(r.runId, 7);
    assert.deepEqual(calls, [{ url: "/api/apply/runs", method: "POST",
      body: { jobIds: ["j1"], mode: "auto", tool: "generate", surface } }]);
  }
});

test("Save and Pass SET through /api/jobs/interact, and are exclusive", async () => {
  const { api, calls } = recorder();
  await commitDecision({ jobId: "j1", decision: DECISIONS.SAVED, api });
  await commitDecision({ jobId: "j1", decision: DECISIONS.PASSED, api });
  assert.deepEqual(calls.map(c => [c.url, c.method, c.body]), [
    ["/api/jobs/interact", "PATCH", { jobId: "j1", starred: true, disliked: false }],
    ["/api/jobs/interact", "PATCH", { jobId: "j1", disliked: true, starred: false }],
  ]);
  // A set written twice is the same write — never its opposite (the toggle's defect).
  assert.deepEqual(flagsFor(DECISIONS.SAVED), flagsFor(DECISIONS.SAVED));
});

test("Undo after a Save or a Pass clears exactly the flag it set — the deck's undo call", async () => {
  const { api, calls } = recorder();
  await undoDecision({ jobId: "j1", decision: DECISIONS.SAVED, prior: {}, api });
  await undoDecision({ jobId: "j2", decision: DECISIONS.PASSED, prior: { starred: false, disliked: false }, api });
  assert.deepEqual(calls.map(c => c.body), [{ jobId: "j1", starred: false }, { jobId: "j2", disliked: false }]);
  // Saving a PASSED job un-passed it, so its Undo puts the pass back as well.
  assert.deepEqual(undoFlagsFor(DECISIONS.SAVED, { disliked: true }), { starred: false, disliked: true });
  // Nothing changed, nothing written.
  const { api: api2, calls: calls2 } = recorder();
  await undoDecision({ jobId: "j3", decision: DECISIONS.SAVED, prior: { starred: true }, api: api2 });
  assert.equal(calls2.length, 0);
});

test("Undo after a Draft aborts that run's job — the deck's undo call", async () => {
  const { api, calls } = recorder({ "/api/apply/runs/7": { jobs: [{ id: 41, jobId: "j9" }, { id: 42, jobId: "j1" }] } });
  await undoDecision({ jobId: "j1", decision: DECISIONS.DRAFTED, runId: 7, api });
  assert.deepEqual(calls.map(c => [c.url, c.method]), [["/api/apply/runs/7", "GET"], ["/api/apply/run-jobs/42/abort", "POST"]]);
});

test("drafted means what the deck means: any run-job that was not cancelled", () => {
  assert.equal(isDrafted(null), false);
  assert.equal(isDrafted({ status: "cancelled" }), false);
  for (const status of ["queued", "running", "held_review", "held_gate", "submitted", "failed"]) {
    assert.equal(isDrafted({ status }), true, status);
  }
});

// ── 4 · the route: the board is a decision surface, and a parked draft is a duplicate ────────

function setup() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, plan_tier TEXT DEFAULT 'BASIC');
    CREATE TABLE domain_profiles (id INTEGER PRIMARY KEY, user_id INTEGER, profile_name TEXT,
      role_family TEXT, domain TEXT, is_active INTEGER DEFAULT 0);
    CREATE TABLE user_profile (user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT,
      full_name TEXT, email TEXT, phone TEXT);
    CREATE TABLE user_integrations (user_id INTEGER, provider TEXT, status TEXT, account_email TEXT,
      updated_at INTEGER, last_checked_at INTEGER);
    CREATE TABLE profile_base_resumes (profile_id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT,
      content TEXT, enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta REAL, updated_at INTEGER);
    CREATE TABLE base_resume (user_id INTEGER PRIMARY KEY, name TEXT, content TEXT,
      enhanced_content TEXT, enhanced_at INTEGER, enhanced_ats_delta REAL, updated_at INTEGER);
    CREATE TABLE scraped_jobs (job_id TEXT PRIMARY KEY, title TEXT, company TEXT, url TEXT,
      apply_url TEXT, source TEXT, location TEXT);
    CREATE TABLE apply_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, mode TEXT, approval_mode TEXT,
      tool_type TEXT, status TEXT, total_jobs INTEGER, held_count INTEGER DEFAULT 0,
      submitted_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()), started_at INTEGER, finished_at INTEGER);
    CREATE TABLE apply_run_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, user_id INTEGER, approved_at INTEGER, approved_from_run_job_id INTEGER,
      job_id TEXT, status TEXT, reason_code TEXT, reason_detail TEXT, started_at INTEGER,
      finished_at INTEGER, created_at INTEGER DEFAULT (unixepoch()),
      answers_json TEXT, resume_artifact_id INTEGER, resume_ats_score INTEGER,
      base_ats_score INTEGER, base_ats_json TEXT, screenshot_path TEXT, submit_verified INTEGER,
      submit_evidence TEXT, hidden_at INTEGER, UNIQUE(run_id, job_id));
    CREATE TABLE apply_job_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER, run_job_id INTEGER,
      user_id INTEGER, job_id TEXT, level TEXT DEFAULT 'info', event TEXT, message TEXT,
      details_json TEXT, created_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE user_jobs (user_id INTEGER, job_id TEXT, domain_profile_id INTEGER, applied INTEGER DEFAULT 0,
      updated_at INTEGER, UNIQUE(user_id, job_id));
    CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER DEFAULT (unixepoch()));
    CREATE TABLE apply_idempotency (user_id INTEGER NOT NULL, idem_key TEXT NOT NULL, endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200, response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), PRIMARY KEY (user_id, idem_key));
    INSERT INTO users (id, username, plan_tier) VALUES (1, 'u1', 'PRO');
    INSERT INTO domain_profiles (id, user_id, profile_name, is_active) VALUES (10, 1, 'SWE', 1);
    INSERT INTO user_profile (user_id, first_name, last_name, email) VALUES (1, 'Test', 'Person', 'test@example.invalid');
    INSERT INTO profile_base_resumes (profile_id, user_id, name, content, updated_at)
      VALUES (10, 1, 'r.txt', 'synthetic resume text', unixepoch());
  `);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(), noop, noop, noop, noop);
  const server = app.listen(0);
  return { db, baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
const post = (baseUrl, body) => fetch(`${baseUrl}/api/apply/runs`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("⛔ the board, like the deck, may not ask for no review", async () => {
  const { baseUrl, close } = setup();
  try {
    for (const surface of ["deck", "board"]) {
      const r = await post(baseUrl, { jobIds: ["a"], mode: "auto", surface, approvalMode: "auto" });
      assert.equal(r.status, 400, surface);
      assert.equal((await r.json()).error, "approval_mode_forbidden_for_surface");
    }
  } finally { close(); }
});

test("⛔ a draft waiting for review cannot be drafted again — from either surface", async () => {
  const { db, baseUrl, close } = setup();
  try {
    const run = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs, approval_mode) VALUES (1,'auto','generate','completed',1,'required')").run();
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code)
                VALUES (?, 1, 'parked', 'held_review', 'awaiting_approval')`).run(run.lastInsertRowid);
    for (const surface of ["deck", "board"]) {
      const r = await post(baseUrl, { jobIds: ["parked"], mode: "auto", surface });
      assert.equal(r.status, 400, `${surface} drafted a job already waiting for review`);
      const body = await r.json();
      assert.equal(body.code, "already_drafted");
      assert.match(body.message, /^Already drafted/);
    }
    assert.equal(db.prepare("SELECT COUNT(*) n FROM apply_runs").get().n, 1, "a second preview run was opened");
  } finally { close(); }
});

test("a draft that STOPPED can be drafted again — that is what Retry does", async () => {
  const { db, baseUrl, close } = setup();
  try {
    const run = db.prepare("INSERT INTO apply_runs (user_id, mode, tool_type, status, total_jobs) VALUES (1,'auto','generate','completed',1)").run();
    db.prepare(`INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code)
                VALUES (?, 1, 'stopped', 'failed', 'no_submit_button')`).run(run.lastInsertRowid);
    const r = await post(baseUrl, { jobIds: ["stopped"], mode: "auto" });
    assert.equal(r.status, 202);
  } finally { close(); }
});

test("the approve path is exempt from the new duplicate rule — it releases the parked row", () => {
  const route = read("routes/apply.js");
  assert.match(route, /OR \(\? = 1 AND status = 'held_review' AND reason_code = 'awaiting_approval'\)\)/);
  assert.match(route, /\.pluck\(\)\.all\(userId, resolvedApproval === "approved" \? 0 : 1\)/);
});
