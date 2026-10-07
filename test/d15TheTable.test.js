// D15 · THE TABLE — the user's application history. The rule (shared/applicationHistory.js), the
// route on the REAL migrations, and the panel's wiring.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import express from "express";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import applyRoutes, { capturedAtsAtApply } from "../routes/apply.js";
import applicationRecordRoutes from "../routes/applicationRecords.js";
import {
  historyStatus, historyTimeline, buildHistory, applyHistoryView, chipCounts, oldestUnanswered,
  matchesSearch, HISTORY_CHIPS, REPLY_ASK,
} from "../shared/applicationHistory.js";
import { RESPONSE_OUTCOME, MATURITY_DAYS } from "../shared/applicationResponse.js";

const DAY = 86400;
const NOW = 1_800_000_000;
const sent = (over = {}) => ({ applicationId: 1, sentAt: NOW - 3 * DAY, ...over });

// ── The status rule ─────────────────────────────────────────────────────────────────────────────

test("D15: a rejection is a REPLY, not a closed or silent application", () => {
  const s = historyStatus(sent({ responseOutcome: RESPONSE_OUTCOME.REJECTED, firstResponseAt: NOW - DAY }), { now: NOW });
  assert.equal(s.status, "replied");
  assert.equal(s.label, "Rejected");
});

test("D15: NULL is not 'no response' — a matured, unanswered application ASKS, and stays Sent", () => {
  const young = historyStatus(sent({ sentAt: NOW - (MATURITY_DAYS - 1) * DAY }), { now: NOW });
  assert.deepEqual([young.status, young.ask], ["sent", false]);
  const old = historyStatus(sent({ sentAt: NOW - (MATURITY_DAYS + 1) * DAY }), { now: NOW });
  assert.deepEqual([old.status, old.label, old.ask], ["sent", "Did they reply?", true]);
  // Only the user saying "Still nothing" makes it no_reply.
  const said = historyStatus(sent({ sentAt: NOW - 60 * DAY, responseOutcome: RESPONSE_OUTCOME.NO_RESPONSE }), { now: NOW });
  assert.equal(said.status, "no_reply");
});

test("D15: in play, closed, and the furthest stage survives a later rejection's label source", () => {
  assert.equal(historyStatus({ recordState: "pending" }).status, "in_play");
  assert.equal(historyStatus({ recordState: "recorded" }).label, "Recorded — not verified yet");
  assert.equal(historyStatus({ recordState: "withdrawn" }).status, "closed");
  assert.equal(historyStatus(sent({ responseOutcome: RESPONSE_OUTCOME.WITHDRAWN })).status, "closed");
  assert.equal(historyStatus(sent({ firstResponseAt: NOW - DAY, furthestStage: "interview" }), { now: NOW }).label, "Interview");
});

test("D15: the three answers on the ask are stored values of the shared vocabulary", () => {
  // D55 F added the screen to the ask, and split the Replied chip into the funnel stages.
  assert.deepEqual(REPLY_ASK.map(a => a.outcome), ["screen", "interview", "rejected", "no_response"]);
  assert.deepEqual(HISTORY_CHIPS.map(c => c.label),
    ["In play", "Sent", "Screen", "Interviewing", "Offer", "Rejected", "Replied", "No reply", "Closed"]);
});

test("D15: the timeline counts days between steps and never invents an unreached one", () => {
  const t = historyTimeline({ draftedAt: NOW - 10 * DAY, resumeAt: NOW - 9 * DAY, sentAt: NOW - 7 * DAY, method: "company_site" }, { now: NOW });
  assert.deepEqual(t.map(s => s.key), ["drafted", "resume", "approved", "sent", "waiting"]);
  assert.equal(t[1].days, 1);
  assert.equal(t[2].skipped, true, "a manual application never passes through approval");
  assert.equal(t[3].days, 2);
  assert.deepEqual([t[4].ongoing, t[4].days], [true, 7]);
  const pending = historyTimeline({ draftedAt: NOW - DAY }, { now: NOW });
  assert.equal(pending[3].at, null);
  assert.equal(pending[4].days, null);
  const replied = historyTimeline({ sentAt: NOW - 7 * DAY, firstResponseAt: NOW - 2 * DAY }, { now: NOW });
  assert.deepEqual([replied[4].label, replied[4].days], ["Replied", 5]);
});

test("D15: chips count AFTER the date range and BEFORE the chip; the awaiting sort puts the longest wait first", () => {
  const rows = buildHistory({
    records: [
      { id: 1, job_id: "a", state: "pending", created_at: NOW - 2 * DAY },
      { id: 2, job_id: "b", state: "verified", created_at: NOW - 50 * DAY },
      { id: 3, job_id: "c", state: "verified", created_at: NOW - 20 * DAY },
    ],
    applications: [
      { id: 10, job_id: "b", company: "Beta", role: "SRE", applied_at: NOW - 45 * DAY },
      { id: 11, job_id: "c", company: "Gamma", role: "PM", applied_at: NOW - 15 * DAY },
    ],
    jobs: [{ job_id: "a", company: "Alpha", title: "Eng" }],
  }, { now: NOW });
  assert.deepEqual(chipCounts(rows), { in_play: 1, sent: 2, screen: 0, interviewing: 0, offer: 0, rejected: 0, replied: 0, no_reply: 0, closed: 0 });
  const v = applyHistoryView(rows, { chip: "sent", sort: "awaiting" });
  assert.deepEqual(v.rows.map(r => r.jobId), ["b", "c"]);
  assert.equal(v.counts.in_play, 1, "the chip does not shrink its own neighbours' counts");
  const ranged = applyHistoryView(rows, { from: NOW - 20 * DAY });
  assert.deepEqual(ranged.counts, { in_play: 1, sent: 1, screen: 0, interviewing: 0, offer: 0, rejected: 0, replied: 0, no_reply: 0, closed: 0 });
  assert.deepEqual(applyHistoryView(rows, { sort: "az" }).rows.map(r => r.company), ["Alpha", "Beta", "Gamma"]);
  assert.equal(oldestUnanswered(rows).jobId, "b");
});

test("D15: search covers company, title and the posting text — every word", () => {
  const row = { company: "Northwind", title: "Data Engineer" };
  assert.ok(matchesSearch(row, "We use Kafka and Spark.", "northwind kafka"));
  assert.ok(!matchesSearch(row, "We use Kafka.", "northwind rust"));
  assert.ok(matchesSearch(row, null, ""));
});

// ── The route, on the real migrations ──────────────────────────────────────────────────────────

function mount(userId = 1) {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (1,'ada','x','PRO')").run();
  db.prepare("INSERT INTO users (id,username,password_hash,plan_tier) VALUES (2,'bob','x','PRO')").run();
  db.prepare(`INSERT INTO scraped_jobs (job_id,title,company,apply_url,description,search_query,_hash)
              VALUES ('j1','Backend Engineer','Northwind','https://northwind.example/1','Kafka pipelines at scale','t','h1'),
                     ('j2','Designer','Contoso','https://contoso.example/2','Figma systems','t','h2')`).run();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId, planTier: "PRO" }; next(); });
  const noop = async () => ({});
  applyRoutes(app, db, (req, _res, next) => next(), noop, noop, noop, noop);
  applicationRecordRoutes(app, db, (req, _res, next) => next(), { capturedAtsAtApply });
  const server = app.listen(0);
  return { db, base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}

test("D15: GET /api/applications/history — one row per application, searched on the posting, scoped to the user", async () => {
  const { db, base, stop } = mount();
  try {
    const now = Math.floor(Date.now() / 1000);
    db.prepare("INSERT INTO application_records (user_id,job_id,state,origin,created_at) VALUES (1,'j1','verified','manual',?)").run(now - 40 * DAY);
    db.prepare(`INSERT INTO job_applications (user_id,job_id,company,role,applied_at) VALUES (1,'j1','Northwind','Backend Engineer',?)`).run(now - 35 * DAY);
    db.prepare("INSERT INTO application_records (user_id,job_id,state,origin) VALUES (1,'j2','pending','opened_posting')").run();
    db.prepare("INSERT INTO resumes (user_id,job_id,company,role,html,created_at) VALUES (1,'j1','Northwind','Backend Engineer','<p>x</p>',?)").run(now - 38 * DAY);
    db.prepare("INSERT INTO application_records (user_id,job_id,state,origin) VALUES (2,'j2','pending','manual')").run();

    const all = await (await fetch(`${base}/api/applications/history`)).json();
    assert.equal(all.rows.length, 2, "user 2's record is not in user 1's history");
    const j1 = all.rows.find(r => r.jobId === "j1");
    assert.deepEqual([j1.status, j1.ask, j1.hasResume], ["sent", true, true]);
    assert.ok(j1.recordId > 0, "the record id the résumé download is keyed on");
    assert.equal(all.rows.find(r => r.jobId === "j2").status, "in_play");
    assert.ok(!JSON.stringify(all).includes("Kafka pipelines"), "the posting text is searched, never returned");

    const hit = await (await fetch(`${base}/api/applications/history?q=kafka`)).json();
    assert.deepEqual(hit.rows.map(r => r.jobId), ["j1"], "a word only the posting text holds finds it");

    // The capture: "Still nothing" -> no_reply; then an interview -> replied. Through the MERGE endpoint.
    const patch = (outcome) => fetch(`${base}/api/apply/applications/j1/response`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome }) });
    assert.equal((await patch("no_response")).status, 200);
    let r = (await (await fetch(`${base}/api/applications/history`)).json()).rows.find(x => x.jobId === "j1");
    assert.equal(r.status, "no_reply");
    await patch("interview");
    r = (await (await fetch(`${base}/api/applications/history`)).json()).rows.find(x => x.jobId === "j1");
    assert.deepEqual([r.status, r.label], ["replied", "Interview"]);
    assert.equal(db.prepare("SELECT response_outcome FROM job_applications WHERE job_id='j1'").pluck().get(), "interview",
      "the answer is written to the real application row");
  } finally { stop(); }
});

// ── The panel ──────────────────────────────────────────────────────────────────────────────────

const read = (p) => fs.readFileSync(p, "utf8");

test("D15: The Table opens on the history; no summary strip survives", () => {
  const db = read("client/src/panels/DatabasePanel.jsx");
  assert.match(db, /<ApplicationHistory /);
  assert.match(db, /=== "pending" \? "pending" : "history"/, "the default sheet is the history");
  assert.doesNotMatch(db, /ResponseSummary/, "⛔ no status bar — the chips carry the counts");
});

test("D15: the panel records replies through the MERGE endpoint and reuses the shared rules", () => {
  const src = read("client/src/components/ApplicationHistory.jsx");
  assert.match(src, /\/api\/apply\/applications\/\$\{encodeURIComponent\(row\.jobId\)\}\/response/);
  assert.match(src, /from "\.\.\/\.\.\/\.\.\/shared\/applicationHistory\.js"/);
  assert.match(src, /RESPONSE_OUTCOMES\.map/);
  assert.doesNotMatch(src, /response_outcome/, "no response column goes through a field PATCH");
});

test("D15: a résumé download that fails SAYS so — never a silent or empty file", () => {
  const src = read("client/src/components/ApplicationHistory.jsx");
  assert.match(src, /\/api\/applications\/\$\{encodeURIComponent\(row\.recordId\)\}\/resume/);
  assert.match(src, /if \(!r\.ok\)/);
  assert.match(src, /artifact_corrupt:/);
  assert.match(src, /artifact_missing:/);
  assert.match(src, /if \(!blob\.size\)/, "a 200 with an empty body is a corrupt artifact, not a download");
});

test("D15: D1's rail — revealed on hover AND keyboard focus, always shown on touch; depth tokens only", () => {
  const css = read("client/src/components/ApplicationHistory.css");
  assert.match(css, /\.ah__row:hover \.ah__rail, \.ah__row:focus-within \.ah__rail/);
  assert.match(css, /@media \(hover: none\) \{ \.ah__rail/);
  assert.match(css, /var\(--c-depth-rest\)/);
  assert.match(css, /var\(--c-depth-hover\)/);
});
