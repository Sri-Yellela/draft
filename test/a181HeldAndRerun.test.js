// ⭐ A181 (owner 11-10): "is this how its supposed to be … we should have options to cancel or rerun drafts cause my limit
// exhausted for the day." Synthetic people only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../scripts/migrations.js";
import { completeProfileForApply, _resetApplyProfileFill } from "../services/applyProfileFill.js";
import { heldQuestionsOf } from "../services/heldQuestions.js";
import { heldQuestionsFor, heldHeadline, heldCounts, questionKind } from "../client/src/lib/heldApplication.js";
import { answersWord } from "../client/src/lib/trackerRows.js";
import { draftSlots, newJobsAmong, OUR_FAULT_CODES } from "../services/draftSlots.js";
import { at } from "../test-support/sourceAnchors.js";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const db0 = () => {
  const db = new Database(":memory:");
  for (const m of MIGRATIONS) db.exec(m.sql);
  db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'maya.chen.sample@example.com', 'x')").run();
  return db;
};
const now = Math.floor(Date.now() / 1000);
let runSeq = 0;
const draft = (db, jobId, { status = "held_review", reason = null, ago = 600, hidden = false } = {}) => {
  const run = db.prepare("INSERT INTO apply_runs (user_id, mode, status, total_jobs, approval_mode) VALUES (1, 'auto', 'done', 1, 'required')").run().lastInsertRowid;
  runSeq++;
  return db.prepare("INSERT INTO apply_run_jobs (run_id, user_id, job_id, status, reason_code, created_at, hidden_at) VALUES (?, 1, ?, ?, ?, ?, ?)")
    .run(run, jobId, status, reason, now - ago, hidden ? now : null).lastInsertRowid;
};
const SAILOR = { kind: "held", why: "question", company: "Sample Health", ref: { primary: { row: { heldQuestions: [
  { question: "Please describe your proficiency across programming languages", required: true, from: "form", type: "text_area" },
  { question: "Why are you interested in this role?", required: true, from: "form" },
  { question: "Are you legally authorized to work in the United States?", required: true, from: "form", eligibility: "work_authorization" },
  { question: "Will you now or in the future require sponsorship?", required: true, from: "form", eligibility: "sponsorship" },
] } } } };

test("a181CurrentCompanyRoleSchoolFilled: an empty company / role / school comes from the person's own Profile sections", () => {
  _resetApplyProfileFill();
  const db = db0();
  db.prepare("INSERT INTO user_profile (user_id, full_name, email, current_job_title) VALUES (1, 'Maya Chen', 'maya.chen.sample@example.com', 'Frontend Engineer')").run();
  db.prepare("INSERT INTO profile_experience (user_id, company, title, is_current, position) VALUES (1, 'Sample Co', 'Frontend Engineer', 1, 0)").run();
  db.prepare("INSERT INTO profile_education (user_id, school, degree, field, position) VALUES (1, 'Sample University', 'BS', 'Computer Science', 0)").run();
  const row = completeProfileForApply(db, db.prepare("SELECT * FROM user_profile WHERE user_id = 1").get());
  assert.equal(row.current_company, "Sample Co");
  assert.equal(row.current_job_title, "Frontend Engineer", "a typed title is never replaced");
  assert.equal(row.university, "Sample University");
  assert.equal(db.prepare("SELECT current_company FROM user_profile WHERE user_id = 1").pluck().get(), null, "payload only — nothing written");
  assert.match(read("services/applyProfileFill.js"), /"current_job_title", "current_company", "university"\]/, "current_company now triggers the backfill");
});

test("a181OneInputPerQuestionTyped: the server keeps each question's type / options; the client names its kind", () => {
  const qs = heldQuestionsOf({ openQuestionsJson: JSON.stringify([
    { question: "Are you legally authorized to work in the US?", required: true, type: "radio", options: [{ label: "Yes" }, { label: "No" }], eligibility: "work_authorization" },
    { question: "Why this role?", required: true, type: "text_area" },
    { question: "Pronouns", required: true, type: "select", options: ["she/her", "he/him", "they/them", "Prefer not to say"] } ]) });
  assert.deepEqual(qs.map(q => [q.type, q.options?.length ?? 0]), [["radio", 2], ["text_area", 0], ["select", 4]]);
  assert.deepEqual(qs.map(questionKind), ["yesno", "draft", "choice"]);
  assert.equal(questionKind({ question: "Will you require visa sponsorship?" }), "yesno");
  assert.equal(questionKind({ question: "Current Company" }), "text");
});

test("a181RowAndPanelCountsMatch + a181FreeTextArrivesAsDraft: one count; the heading splits yours from draft's drafts", () => {
  assert.deepEqual(heldCounts(SAILOR), { total: 4, yours: 2, drafts: 2 });
  assert.equal(heldHeadline(SAILOR).title, "2 answers only you can give · 2 written answers to check");
  assert.equal(answersWord(SAILOR), "4 need you", "the row says what the panel says (was a hard-coded 1)");
  assert.deepEqual(heldQuestionsFor(SAILOR).map(q => q.kind), ["draft", "draft", "yesno", "yesno"]);
});

test("a181OneQuestionAtATime + a181QuestionLargeType + a181ReduceMotionNoSlide: the stepper (source)", () => {
  const src = read("client/src/panels/AutoApplyPanel.jsx");
  const i = at(src, "function HeldQuestionStepper(");
  const body = src.slice(i, at(src, "export function AutoApplyPanel(", i));
  assert.match(body, /const q = questions\[Math\.min\(i, total - 1\)\];/, "only the current question is drawn");
  assert.match(body, /data-held-progress="">\{i \+ 1\} of \{total\}/);
  assert.match(body, /data-action="back-question"/); assert.match(body, /`See all \$\{total\}`/);
  assert.match(body, /data-yes-no=\{o\}/, "Yes / No as their own buttons");
  // A199 (46j, owner, changed on purpose): the draft is asked for in ASK DRAFT (the companion), never written into this box.
  assert.match(body, /new CustomEvent\("draft:ask-question", \{ detail: \{ jobId, question \} \}\)/, "a free-text question asks Ask draft for its draft");
  assert.doesNotMatch(body, /\/api\/apply\/questions\/\$\{encodeURIComponent\(jobId\)\}\/draft/, "the stepper never fetches a draft into the person's box");
  assert.match(read("client/src/components/AppNav.jsx"), /\/api\/apply\/questions\/\$\{encodeURIComponent\(target\.jobId\)\}\/draft/, "Ask draft fetches it");
  assert.match(body, /All answered/);
  const css = read("client/src/components/DraftHouse.css");
  assert.match(css, /\.dht-step__q \{ margin: 0; font-size: calc\(24px \* var\(--type-scale, 1\)\);/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.dht-step__card, \.dht-step__done \{ animation: none; \} \}/);
  // A199 (2) (46j, owner, changed on purpose): the questions are answered in Ask draft's thread by default; the stepper is
  // the row's "answer here instead".
  assert.match(src, /heldQuestionsFor\(node\)\.length > 0 && answerHere\[node\.jobId\] && \(\s*<HeldQuestionStepper/);
  assert.match(src, /heldQuestionsFor\(node\)\.length > 0 && !answerHere\[node\.jobId\] && \(\s*<QuestionsInAskDraft/);
});

test("a181RerunFree: a job counts once, from its first draft — Run again (today or tomorrow) is free", () => {
  const db = db0();
  draft(db, "gh::1", { ago: 3 * 86400 });             // drafted 3 days ago
  draft(db, "gh::1", { ago: 600 });                   // re-run today
  draft(db, "gh::2", { ago: 900 });                   // new today
  draft(db, "gh::2", { ago: 300 });                   // re-run today
  assert.equal(draftSlots(db, 1).drafts, 1, "only gh::2 is a new job today");
  assert.deepEqual(newJobsAmong(db, 1, ["gh::1", "gh::2", "gh::3"]), ["gh::3"]);
  const src = read("routes/apply.js");
  assert.match(src, /const charged = newJobsAmong\(db, userId, filtered\)\.length;\s*if \(charged > 0 && slots\.used \+ charged > slots\.limit\)/);
});

test("a181OurFaultRefunds + a181CancelToStoppedRestorable: our-fault failures and cancelled unsent drafts give the credit back", () => {
  const db = db0();
  assert.ok(OUR_FAULT_CODES.includes("browser_error") && OUR_FAULT_CODES.includes("resume_pdf_failed"));
  draft(db, "gh::1", { status: "failed", reason: "browser_error" });
  draft(db, "gh::2", { status: "held_review", reason: "manual_review" });
  const id3 = draft(db, "gh::3", { status: "held_review", reason: "manual_review" });
  draft(db, "gh::4", { status: "submitted", hidden: true });
  assert.equal(draftSlots(db, 1).drafts, 4 - 1, "the browser failure is ours: free");
  db.prepare("UPDATE apply_run_jobs SET hidden_at = ? WHERE id = ?").run(now, id3);
  assert.equal(draftSlots(db, 1).drafts, 2, "cancelled and never sent: refunded; a SENT one stays counted even when cleared");
  db.prepare("UPDATE apply_run_jobs SET hidden_at = NULL WHERE id = ?").run(id3);
  assert.equal(draftSlots(db, 1).drafts, 3, "Restore counts it again");
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /label: "Cancel this draft"/);
});

test("a181BulkRerunCancel + a181LimitVisibleAndExplained + a181RerunUsesCurrentCode (source)", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /data-rerun-held=""/); assert.match(panel, /data-cancel-held=""/);
  assert.match(panel, /data-held-before-update=""/, "the once-after-an-update offer");
  assert.match(read("routes/apply.js"), /heldBeforeUpdate: \(\(\) => \{ const bootAt = Math\.floor\(Date\.now\(\) \/ 1000 - process\.uptime\(\)\);/);
  assert.match(panel, /new drafts left in the last 24 hours · running a draft again is free/);
  assert.match(panel, /: "Draft this job again now with draft's current fixes — free: running a draft again never uses a new one\."/);
  assert.match(read("services/draftSlots.js"), /running a draft again is free/, "the refusal says so too");
  // a re-run is a NEW run through startRun (the current fill / matcher / tailoring), never a replay of the old result
  assert.match(panel, /const retryJob = async \(job\) => \{[\s\S]{0,200}?const r = await draftJob\?\.\(job, companyLabel\(job\.company\)\);/);
});

// ⭐ 46f · A181 (5c) "Re-run selected" (the acceptance's "bulk Re-run selected on 3 held rows"): Choose which lists the held
// drafts with a tick each (all ticked by default); Re-run / Cancel act on the ticked ones and say "selected" when it isn't
// every one; none ticked = both off. ⛔ D113 U9: no select mode on the tree — the ticks live in the bulk block.
test("a181RerunSelected: the bulk acts on the ticked held drafts, all by default, never a select mode on the tree", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /const \[heldPick, setHeldPick\] = useState\(null\);/, "null = every held draft");
  assert.match(panel, /const chosenHeldFrom = \(ns\) => \{ const all = heldRerunnableFrom\(ns\); return heldPick \? all\.filter\(h => heldPick\.has\(h\.jobId\)\) : all; \};/);
  assert.match(panel, /onClick=\{\(\) => rerunHeld\(chosen\)\}>\{bulkBusy \? "Starting…" : `Try \$\{chosen\.length\} \$\{some \? "selected" : "waiting"\} again \(free\)`\}/);   // A233 (46v): plain words — changed on purpose
  assert.match(panel, /clearRunJobs\(\{ runJobIds: chosen\.map\(h => h\.runJobId\)\.filter\(Boolean\) \}\)/, "Cancel acts on the chosen ones");
  assert.match(panel, /disabled=\{bulkBusy \|\| chosen\.length === 0\}/, "none ticked: nothing to run");
  assert.match(panel, /data-held-pick=""/); assert.match(panel, /data-choose-held=""/);
  assert.doesNotMatch(read("client/src/components/DraftHouseTree.jsx"), /type="checkbox"/, "D113 U9: the tree has no select mode");
});

// ⭐ 46f · D165's "not done": a FAILED (or otherwise stopped) earlier attempt joins the held application's earlier-attempts
// line — the held rows come from held_review only. The held row stays first; only the quiet line reads the extra rows.
test("a181EarlierFailedAttemptJoinsTheHeld: the stopped attempts of the same job are the held view's earlier attempts", async () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /earlier: earlierAttempts\(attemptsOf\(node\)\)/);
  assert.match(panel, /const failed = \(applyStopped \|\| \[\]\)\.filter\(j => String\(j\?\.jobId\) === String\(node\.jobId\) && !ids\.has\(j\.id\)\);/);
  assert.match(panel, /return \[own\[0\], \.\.\.\[\.\.\.own\.slice\(1\), \.\.\.failed\]\.sort\(\(a, b\) => when\(b\) - when\(a\)\)\];/, "the held row stays first");
  const { earlierAttempts } = await import("../client/src/lib/heldApplication.js");
  const e = earlierAttempts([{ id: 2, status: "held_review" }, { id: 1, status: "failed", reasonCode: "browser_crashed", finishedAt: 1_800_000_000 }]);
  assert.equal(e.count, 1);
  assert.match(e.line, /^1 earlier attempt · .* · stopped$/);
});
