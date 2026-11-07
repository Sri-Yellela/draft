// ⛔ D175 FA4 · SAY WHAT CAN FINISH UNATTENDED, BEFORE SPENDING A PICK ON IT. Each pick is marked *will finish on its
// own* (automation tier `direct` — Greenhouse / Lever / Ashby) or *will need you*; Apply for me fills the day's cap only
// with the first kind and counts the rest ("3 more need you to sign in"); Ask me first offers both, marked.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { choosePicks, finishKind, FINISH_LABELS, countLeftOut, LEFT_OUT_REASONS } from "../services/picks.js";
import { withFinish } from "../services/autoScheduler.js";
import { eventText } from "../services/notify.js";

const settings = { pauseCompanyAfterReply: false, perCompanyLimit30d: null };
const C = (jobId, tier, score) => ({ jobId, company: `Co ${jobId}`, score, automationTier: tier });
const cands = [C("wd1", "account", 95), C("gh1", "direct", 80), C("ic1", "account", 90), C("lv1", "direct", 70), C("un1", null, 85), C("gh2", "direct", 60)];

test("d175PicksPreferUnattendedFamilies: only `direct` finishes on its own; no tier field = no claim", () => {
  assert.equal(finishKind({ automationTier: "direct" }), "own");
  for (const t of ["guest", "account", "gated", null]) assert.equal(finishKind({ automationTier: t }), "needs_you", String(t));
  assert.equal(finishKind({ jobId: "x" }), null, "an older caller's candidate is not judged");
});

test("d175PicksPreferUnattendedFamilies: Apply for me fills the cap with unattended postings and counts the rest", () => {
  const { take, leftOut } = choosePicks(cands, { remaining: 2, settings, preferUnattended: true });
  assert.deepEqual(take.map(c => c.jobId), ["gh1", "lv1"], "the two best that can finish alone — not the 95 Workday one");
  const counts = countLeftOut(leftOut);
  assert.equal(counts.needs_you, 3, "wd1, ic1, un1");
  assert.equal(counts.daily_cap, 1, "gh2 — unattended, but over the cap");
  assert.ok(LEFT_OUT_REASONS.needs_you);
});

test("d175PicksPreferUnattendedFamilies: Ask me first offers both kinds, ranked as before", () => {
  const { take } = choosePicks(cands, { remaining: 3, settings });
  assert.deepEqual(take.map(c => c.jobId), ["wd1", "ic1", "un1"]);
});

test("d175PicksPreferUnattendedFamilies: each pick's line says which it is", () => {
  assert.equal(withFinish(C("gh1", "direct"), { text: "Strong match" }).text, `Strong match · ${FINISH_LABELS.own}`);
  assert.equal(withFinish(C("wd1", "account"), null).text, FINISH_LABELS.needs_you);
  assert.deepEqual(withFinish({ jobId: "x" }, { text: "a" }), { text: "a" });
});

test("d175PicksPreferUnattendedFamilies: the run's summary names them", () => {
  assert.equal(eventText("picks_summary", { sent: 2, waiting: 0, needYou: 3 }).body, "This run sent 2 applications. 3 more need you to sign in.");
  assert.equal(eventText("picks_summary", { sent: 1, waiting: 0, needYou: 0 }).body, "This run sent 1 application.");
});

test("d175PicksPreferUnattendedFamilies: wired — the board's candidates carry their tier; Apply for me asks for the preference", () => {
  assert.match(fs.readFileSync(new URL("../server.js", import.meta.url), "utf8"), /automationTier: j\.automationTier \?\? null \}/);
  assert.match(fs.readFileSync(new URL("../services/autoScheduler.js", import.meta.url), "utf8"), /preferUnattended: mode === "apply"/);
});
