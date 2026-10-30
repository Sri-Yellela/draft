// ⭐ D112 item 9 a1 (owner 10-30 night) — BOARD MULTI-SELECT, "Draft selected": A NOTICE FOR EACH DUPLICATE.
//
// Shift-click or a card's tick picks jobs on the board; "Draft selected (N)" drafts them one at a time through
// the single Draft's own call (commitDecision → POST /api/apply/runs). Every pick at a company where the user
// already has an application shows D54's per-company notice — one after another, each Draft it / Skip — and the
// others draft without a stop (not the combined notice the assistant recommended: the owner's call). The
// sequence is client/src/lib/draftSelected.js (pure, driven here with fakes); the board's wiring is pinned from
// source. Esc clears the selection.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import {
  DRAFT_IT, SKIP, planDraftSelected, runDraftSelected, draftSelectedSummary, stopsBatch,
} from "../client/src/lib/draftSelected.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Three picks; two at Scale AI, where the user already has a draft (D54's notice), one at Notion (no notice).
const PICKS = [
  { jobId: "s1", company: "Scale AI", title: "ML Engineer" },
  { jobId: "n1", company: "Notion", title: "Frontend Engineer" },
  { jobId: "s2", company: "Scale AI", title: "Data Engineer" },
];
const noticeFor = (job) => (job.company === "Scale AI"
  ? "You already have 1 role at Scale AI — 1 queued. Draft this one too?" : null);

function harness(answers) {
  const events = [];
  const posted = [];
  return {
    events, posted,
    ask: async (step) => { events.push(["notice", step.job.jobId, step.index, step.of]); return answers[step.job.jobId]; },
    draft: async (job) => { events.push(["draft", job.jobId]); posted.push(job.jobId); return { runId: 1 }; },
  };
}

test("d112aOneNoticePerDuplicate · 3 selected, 2 at a drafted company → exactly 2 notices, in order; Skip drafts neither of that one", async () => {
  const h = harness({ s1: DRAFT_IT, s2: SKIP });
  const r = await runDraftSelected({ jobs: PICKS, noticeFor, ask: h.ask, draft: h.draft });
  assert.equal(r.notices, 2, "one notice per duplicate — never one combined notice, never one for the third");
  assert.deepEqual(h.events, [
    ["notice", "s1", 1, 2],
    ["draft", "s1"],
    ["draft", "n1"],             // the job with no duplicate drafts without a stop
    ["notice", "s2", 2, 2],      // the second notice comes after, in the order picked
  ]);
  assert.deepEqual(h.posted, ["s1", "n1"], "Skip: the skipped job is never posted");
  assert.deepEqual(r.skipped.map(j => j.jobId), ["s2"]);
  assert.deepEqual(r.drafted.map(j => j.jobId), ["s1", "n1"]);

  // Skip on both → neither Scale AI job is drafted; Notion still drafts.
  const h2 = harness({ s1: SKIP, s2: SKIP });
  const r2 = await runDraftSelected({ jobs: PICKS, noticeFor, ask: h2.ask, draft: h2.draft });
  assert.equal(r2.notices, 2);
  assert.deepEqual(h2.posted, ["n1"]);
  assert.match(draftSelectedSummary(r2), /^Drafted 1 of 3 — 2 skipped\./);
});

test("d112a · notices come from the company index as it stood at the press; a drafted or repeated pick is dropped", async () => {
  // The batch drafting Notion's first role does not make Notion's second a "duplicate" — both were picked together.
  let snapshotCalls = 0;
  const plan = planDraftSelected([...PICKS, PICKS[0], { jobId: "d1", company: "Done" }, { company: "No id" }], {
    noticeFor: (j) => { snapshotCalls += 1; return noticeFor(j); },
    alreadyDrafted: (j) => j.jobId === "d1",
  });
  assert.deepEqual(plan.map(s => [s.job.jobId, !!s.notice]), [["s1", true], ["n1", false], ["s2", true]]);
  assert.equal(snapshotCalls, 3, "every notice is decided up front, before any Draft");
});

test("d112a · the server's refusals: 429 / 409 stop the batch with its sentence; already-drafted goes on", async () => {
  const fail = (status, message, payload = {}) => Object.assign(new Error(message), { status, payload });
  assert.equal(stopsBatch(fail(429, "x")), true);
  assert.equal(stopsBatch(fail(409, "x")), true);
  assert.equal(stopsBatch(fail(400, "x", { code: "already_drafted" })), false);

  const posted = [];
  const cap = "Out of drafts — all 10 used in the last 24 hours.";
  const r = await runDraftSelected({
    jobs: [{ jobId: "a", company: "A" }, { jobId: "b", company: "B" }, { jobId: "c", company: "C" }, { jobId: "d", company: "D" }],
    noticeFor: () => null, ask: async () => DRAFT_IT,
    draft: async (job) => {
      posted.push(job.jobId);
      if (job.jobId === "a") throw fail(400, "Already drafted", { code: "already_drafted" });
      if (job.jobId === "c") throw fail(429, cap);
      return {};
    },
  });
  assert.deepEqual(posted, ["a", "b", "c"], "nothing is posted after a refusal that would refuse every later job");
  assert.deepEqual(r.drafted.map(j => j.jobId), ["a", "b"], "already drafted IS the drafted state");
  assert.equal(r.stopped.error, cap);
  const line = draftSelectedSummary(r);
  assert.match(line, /Drafted 2 of 4\. Stopped at C — Out of drafts — all 10 used in the last 24 hours\. 1 not tried\./, "the server's own sentence is said");
});

test("d112a · the board's wiring: the shared Draft call, D54's notice per pick, Draft it / Skip, Esc clears", () => {
  const panel = read("client/src/panels/JobsPanel.jsx");
  const batch = panel.slice(at(panel, "const draftSelected = useCallback("), at(panel, "const draftSelected = useCallback(") + 4000);
  assert.match(panel, /import \{ runDraftSelected, draftSelectedSummary \} from "\.\.\/lib\/draftSelected\.js";/);
  assert.match(batch, /noticeFor: companyNoticeFor,/, "D54's own per-company notice, the single Draft's");
  assert.match(batch, /commitDecision\(\{ jobId, decision: DECISIONS\.DRAFTED, tool: draftTool, surface: DECISION_SURFACES\.BOARD \}\)/,
    "the same POST /api/apply/runs path as one Draft");
  assert.doesNotMatch(batch, /jobIds:/, "never one combined POST");
  assert.match(batch, /batch: true/);
  assert.match(batch, /summary: draftSelectedSummary\(result\)/);
  assert.match(panel, /<DecisionToast toast=\{batchNotice \|\| decisionToast\}/);
  assert.match(panel, /onAnswerNotice=\{answerBatchNotice\}/);
  // D54 / A105 (12) keep their single-job path.
  assert.match(panel, /onConfirmNotice=\{\(t\) => decideJob\(t\.job, t\.decision, \{ companyOk: true \}\)\}/);
  // Esc clears the selection — not while typing, not while a notice waits.
  const esc = panel.slice(at(panel, "// Esc clears the selection"), at(panel, "// Esc clears the selection") + 900);
  assert.match(esc, /if \(e\.key !== "Escape" \|\| batchRunning \|\| selectedJob\) return;/);
  assert.match(esc, /setPicked\(\[\]\);/);
  // The bar: "Draft selected (N)" — a depth box, a .mark-count (D60).
  assert.match(panel, /`Draft selected \(\$\{pickedCount\}\)`/);
  assert.match(panel, /data-draft-selected-bar=""/);
  assert.match(panel, /className="mark-count">\{pickedCount\}</);
  assert.match(panel, /onPick=\{onPick \? \(\) => onPick\(job\) : null\}/);

  const toast = read("client/src/components/DecisionToast.jsx");
  assert.match(toast, /onAnswerNotice\(DRAFT_IT\)\} [^>]*>Draft it</);
  assert.match(toast, /onAnswerNotice\(SKIP\)\} [^>]*>Skip</);
  assert.match(toast, />Draft anyway</, "the single-job notice is unchanged");

  const bubble = read("client/src/components/JobBubble.jsx");
  assert.match(bubble, /if \(e\.shiftKey && onPick\) \{ e\.preventDefault\(\); onPick\(\); return; \}/, "shift-click picks");
  assert.match(bubble, /className="jb__tick" data-pick-tick="" aria-pressed=\{picked\}/, "the tick");
  const css = read("client/src/components/JobBubble.css");
  const tick = css.slice(at(css, ".jb__tick {"), at(css, "}", at(css, ".jb__tick {")));
  assert.match(tick, /border-radius: 6px;/, "D60: the tick is a box, never round");
});
