// D55 (d) — the Workday wizard advance: fill the step, press the portal's own Save and Continue,
// re-probe, repeat; wait for the candidate on a required stop and carry on by itself; STOP AT REVIEW;
// NEVER press Submit. Exercised for real by scripts/d55AutofillWorkday.mjs (headless Chrome).

import { test } from "node:test";
import assert from "node:assert/strict";
import { at, lastAt } from "../test-support/sourceAnchors.js";
import fs from "node:fs";

import { questionKind, wizardMessage, WORKDAY_FIELD_IDS, matchAnswersToFields, CANDIDATE_WAIT_MS, PACKET_TTL_MS }
  from "../extension/gated-handoff.js";

const src = fs.readFileSync("extension/gated-handoff.js", "utf8").replace(/\r\n/g, "\n");
const anchor = (s, needle) => { const i = s.indexOf(needle); assert.ok(i >= 0, `missing: ${needle}`); return i; };
const fnText = (name) => { const s = src.slice(anchor(src, `function ${name}(`)); return s.slice(0, at(s, "\n}\n") + 2); };

test("(d) ⛔ the advance presses ONLY a control that reads Save and Continue / Continue / Next", () => {
  const adv = fnText("advanceWizard");
  assert.match(adv, /const continueText = \/\^\(save and continue\|save & continue\|continue\|next\)\$\/i;/);
  assert.match(adv, /if \(!continueText\.test\(text\)\) return \{ ok: false, reason: 'next_is_not_continue'/,
    "Workday's Review renders the SAME control reading 'Submit' — an allowlist, never an id-only press");
  assert.match(adv, /=== 'submit' && btn\.form\) \{\n\s+return \{ ok: false, reason: 'next_would_submit_a_form'/);
  assert.ok(adv.indexOf("next_is_not_continue") < adv.indexOf("btn.click()"), "every refusal is checked before the click");
  assert.equal((adv.match(/\.click\(\)/g) || []).length, 1, "exactly one click, after every check");
});

test("(d) ⛔ nothing in the handoff submits", () => {
  const code = src.replace(/^\s*(\/\/|\*).*$/gm, "");
  assert.doesNotMatch(code, /\.requestSubmit\s*\(|\.submit\s*\(\s*\)/);
  assert.doesNotMatch(code, /\[type=["']?submit["']?\][^;\n]*\.click\(/);
});

test("(d) the run STOPS AT REVIEW — detected by the step and by the next control reading Submit", () => {
  assert.match(src, /isReview: \/submit\/i\.test\(nextText\) \|\| \/\^review\$\/i\.test\(stepName\)/);
  const fill = src.slice(anchor(src, "async function fillFromPacket("), anchor(src, "async function captureFormSchema("));
  assert.match(fill, /if \(step\.wizard\?\.isReview\) \{ wizard\.stoppedAt = 'review'; break; \}/);
  assert.ok(anchor(fill, "if (step.wizard?.isReview)") < anchor(fill, "func: applyPlan,"),
    "Review is checked BEFORE anything is filled or pressed on a step");
});

test("(d) a wizard is only what the page SAYS is one — a progress bar or Workday's next-button id", () => {
  assert.match(src, /const wizard = nextBtn \|\| \(progress && stepName\) \? \{/);
});

test("(d) a required stop waits for the candidate and carries on by itself — bounded by the packet's life", () => {
  const wait = src.slice(anchor(src, "async function waitForCandidate("), anchor(src, "export function wizardMessage("));
  assert.match(wait, /func: findMissingRequired/);
  assert.match(wait, /if \(!missing\.length\) return \{ ok: true/);
  assert.match(wait, /showBadge\(tabId, 'required', \{ missing \}\)/);
  assert.match(wait, /func: badgeDismissed/, "the × stops the run");
  assert.match(wait, /new URL\(t\.url\)\.origin !== origin\) return \{ ok: false, reason: 'left_the_application' \}/);
  assert.ok(CANDIDATE_WAIT_MS < PACKET_TTL_MS, "the wait must end before the released packet's lifetime does");
});

test("(d) on a wizard nothing already holding a value is overwritten; the overlay's edit still is", () => {
  assert.match(src, /\{ entries: entriesLeft, keepExisting: !!step\.wizard \}/);
  assert.match(src, /if \(keepExisting && holds\(el\)\) \{ skipped\.push\(\{ field: step\.label, reason: 'kept_existing' \}\); return; \}/);
  assert.match(src, /func: applyPlan, args: \[\[step\], null\]/, "applyOverlayEdit passes no opts — a correction overwrites");
});

test("(d) every re-probed step is checked against the application's addresses before it is filled", () => {
  const fill = src.slice(anchor(src, "async function fillFromPacket("), anchor(src, "async function captureFormSchema("));
  assert.match(fill, /if \(!step\?\.hasForm \|\| !packetFillsOrigin\(released, step\.origin\)\) \{ wizard\.stoppedAt = 'left_the_application'; break; \}/);
});

test("(d) Workday's root is the scope, identically in the probe and the fill", () => {
  const roots = [...src.matchAll(/const form = (document\.querySelector\('\[data-automation-id="applyFlowPage"\]'\) \|\| document\.querySelector\('form'\));/g)];
  assert.equal(roots.length, 2, "probeFormShape and applyPlan must scope to the same root");
});

test("(d) the Workday adapter names contact fields by automation id — and NO eligibility question", () => {
  assert.equal(WORKDAY_FIELD_IDS["legalNameSection_firstName"], "first_name");
  assert.equal(WORKDAY_FIELD_IDS["phone-number"], "phone");
  for (const v of Object.values(WORKDAY_FIELD_IDS)) assert.doesNotMatch(v, /sponsor|work_auth|authori/);
  const { plan } = matchAnswersToFields(
    [{ name: "email", field: "Email", value: "ada@example.com", provenance: "field_map_exact" },
     { name: "work_authorization", field: "Are you legally authorized to work?", value: "Yes", provenance: "field_map_exact", eligibility: true }],
    [{ index: 0, name: null, id: "input-email", type: "email", label: "Email Address", required: true, options: null, automationId: "email" },
     { index: 1, name: null, id: "dropdown-q", type: "button", label: "Are you legally authorized to work in the United States?", required: true, options: null, automationId: "q-authorized", widget: "dropdown" }]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].matchedBy, "exact");
  assert.equal(plan[0].index, 0);
  assert.equal(plan[0].value, "ada@example.com");
});

test("(d) questionKind says WHY a stop happened", () => {
  assert.equal(questionKind("Are you legally authorized to work in the United States?"), "eligibility");
  assert.equal(questionKind("Will you now or in the future require sponsorship?"), "eligibility");
  assert.equal(questionKind("Do you have 7+ years of professional software engineering experience?"), "screening");
  assert.equal(questionKind("Do you have experience running Kubernetes clusters?"), "screening");
  assert.equal(questionKind("Yes, I would like to receive text messages and marketing communications"), "opt_in");
  assert.equal(questionKind("Would you like to receive WhatsApp messages from our recruiting team?"), "opt_in");
  assert.equal(questionKind("Veteran Status"), "eeo");
  assert.equal(questionKind("Gender"), "eeo");
  assert.equal(questionKind("I have read and consent to the Terms and Conditions"), "consent");
  assert.equal(questionKind("Phone Number"), "other");
});

test("(d) the run's sentence names where it stopped, and never claims a submission", () => {
  assert.match(wizardMessage(30, { steps: [1, 2, 3, 4, 5], stoppedAt: "review" }), /across 5 step\(s\) and stopped at Review\. Check it, then submit yourself\./);
  assert.match(wizardMessage(3, { steps: [1], stoppedAt: "dismissed" }), /you closed the autofill badge/);
  assert.match(wizardMessage(3, { steps: [1], stoppedAt: "waiting_for_you" }), /press the shortcut again/);
  for (const r of ["review", "dismissed", "waiting_for_you", "grant_lost", "could_not_advance"]) {
    assert.doesNotMatch(wizardMessage(1, { steps: [1], stoppedAt: r }), /\bsubmitted\b/i);
  }
});
