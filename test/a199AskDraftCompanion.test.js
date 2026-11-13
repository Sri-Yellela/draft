import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildAnswerDraftRequest } from "../services/applicationAnswerDraft.js";

// ⭐ A199 (46j, owner 11-13: "the ask draft can be opened beside the answers section in home as a companion chat … the agent
// would write into the ask draft chat for each question, which appear in the ask draft chat instead of the home section").
const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

test("a199: Home's stepper sends a free-text question to Ask draft; Ask draft writes it, 'Use as my answer' fills the box", () => {
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /window\.addEventListener\("draft:use-answer", onUse\)/, "the box is filled only when the person presses Use as my answer");
  const nav = read("client/src/components/AppNav.jsx");
  assert.match(nav, /window\.addEventListener\("draft:ask-question", onAsk\)/, "Ask draft takes the question");
  assert.match(nav, /window\.addEventListener\("draft:ask-question", open\)/, "and opens beside Home");
  assert.match(nav, /new CustomEvent\("draft:use-answer", \{ detail: \{ jobId: t\.app\.jobId, question: t\.app\.question, text: t\.text \} \}\)/);
  assert.match(nav, /if \(app\) \{ setQ\(""\); setTurns\(t => \[\.\.\.t, \{ who: "you", text: question \}\]\); return draftFor\(app, question\); \}/,
    "what the person types for an open question is their words for it");
  assert.match(nav, /\(status\?\.available \|\| app \|\| turns\.some\(t => t\.app\)\)/, "it works whether or not the general assistant is open");
});

test("a199: the person's own words go into the draft as their facts; the route checks against résumé + note", () => {
  const r = buildAnswerDraftRequest({ resumeText: "Backend engineer, Python.", question: "What SIEMs have you integrated?", forRun: true, note: "I set up Splunk alerts for the payments team." });
  assert.match(r.messages[0].content, /WHAT THE CANDIDATE SAYS ABOUT THIS QUESTION[\s\S]*Splunk alerts/);
  assert.match(r.messages[0].content, /Use only facts in the résumé and in what the candidate says/);
  const plain = buildAnswerDraftRequest({ resumeText: "Backend engineer, Python.", question: "Why us?", forRun: true });
  assert.doesNotMatch(plain.messages[0].content, /WHAT THE CANDIDATE SAYS/);
  const server = read("server.js");
  assert.match(server, /const note = typeof req\.body\?\.note === "string" \? req\.body\.note\.trim\(\)\.slice\(0, 1500\) : "";/);
  assert.match(server, /checkAnswerDraft\(text, \{ resumeText: note \? `\$\{resumeText\}\n\$\{note\}` : resumeText, untrusted: r\.untrusted \}\)/);
});

// ⭐ A199 (2) (46j, owner 11-13: "these questions in general can move there as its own thread with the dropzone id or as a
// linked local chat to that draft" · "it need not use llm calls").
test("a199QuestionsThread: a held application's questions open as a thread in Ask draft; choices need no model call; Finish saves to that job and re-runs it", () => {
  const thread = read("client/src/components/AskDraftThread.jsx");
  assert.match(thread, /q\.kind === "yesno" \|\| q\.kind === "choice" \? \(/, "a choice is buttons");
  assert.match(thread, /if \(!q \|\| q\.kind !== "draft" \|\| sugg\[q\.question\]\) return;/, "only a written answer asks the model");
  assert.match(thread, /body: JSON\.stringify\(\{ answers, remember, retryJobIds: \[String\(jobId\)\], mode: "auto" \}\)/, "Finish saves to THIS job and re-runs it");
  assert.match(thread, /data-ask-redraft=""/, "the person's own words can be written in");
  const nav = read("client/src/components/AppNav.jsx");
  assert.match(nav, /window\.addEventListener\("draft:open-questions", onOpen\)/);
  assert.match(nav, /window\.addEventListener\("draft:open-questions", open\)/, "Ask draft opens beside Home");
  assert.match(nav, /<AskDraftThread thread=\{thread\}/);
  const panel = read("client/src/panels/AutoApplyPanel.jsx");
  assert.match(panel, /<QuestionsInAskDraft node=\{node\}/, "the row points at Ask draft");
  assert.match(panel, /new CustomEvent\("draft:open-questions",/);
  assert.match(panel, /data-action="answer-here"/, "the stepper stays one press away");
  assert.match(read("client/src/modules.manifest.js"), /"components\/AskDraftThread\.jsx":/);
});
