// D185-7 (45q, owner 11-09) · ATS source attribution on apply links — documented parameters only — and the truthful
// "How did you hear about us?" answer, only when it is true and the person agreed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { attributeApplyUrl, attributionFamily, tokenFor, howHeardAnswers, HOW_HEARD_QUESTIONS, DOCUMENTED_SOURCE_PARAMS } from "../shared/sourceAttribution.js";
import { packetSavedAnswers } from "../services/applyGatePacket.js";

test("d185SourceParamDocumentedOnly: Lever's job-board parameters by default; Greenhouse / Ashby only with the employer's token; nothing else", () => {
  assert.deepEqual(Object.keys(DOCUMENTED_SOURCE_PARAMS).sort(), ["ashby", "greenhouse", "lever"]);
  const lever = new URL(attributeApplyUrl("https://jobs.lever.co/acme/1b2c3d4e-0000-4000-8000-000000000000/apply"));
  assert.equal(lever.searchParams.get("lever-origin"), "applied");
  assert.equal(lever.searchParams.get("lever-source[]"), "draft");
  // An employer's own tracking link wins — never overwritten.
  const own = "https://jobs.lever.co/acme/x?lever-source%5B%5D=Company+Site";
  assert.equal(attributeApplyUrl(own), own);
  // Greenhouse and Ashby credit only an EMPLOYER-ISSUED token — without one the link is untouched.
  const gh = "https://boards.greenhouse.io/acme/jobs/123";
  assert.equal(attributeApplyUrl(gh), gh);
  assert.equal(new URL(attributeApplyUrl(gh, { token: "a1b2c3" })).searchParams.get("gh_src"), "a1b2c3");
  assert.equal(attributeApplyUrl("https://acme.com/careers?gh_jid=123&gh_src=theirs", { token: "mine" }), "https://acme.com/careers?gh_jid=123&gh_src=theirs");
  const ash = "https://jobs.ashbyhq.com/acme/1b2c3d4e-0000-4000-8000-000000000000";
  assert.equal(attributeApplyUrl(ash), ash);
  assert.equal(new URL(attributeApplyUrl(ash, { token: "draft" })).searchParams.get("utm_source"), "draft");
  assert.equal(attributeApplyUrl(gh, { token: "bad token!" }), gh, "a malformed token is refused");
  // Every other ATS: no documented mechanism → unchanged.
  for (const u of ["https://acme.wd5.myworkdayjobs.com/en-US/careers/job/x", "https://apply.workable.com/acme/j/ABC123/", "https://jobs.smartrecruiters.com/Acme/123-x", "https://acme.com/jobs/1"]) {
    assert.equal(attributeApplyUrl(u, { token: "t" }), u, u);
    assert.equal(attributionFamily(u), null);
  }
  assert.equal(tokenFor({ acme: { greenhouse: "tok" } }, "Acme", "greenhouse"), "tok");
  assert.equal(tokenFor(null, "Acme", "greenhouse"), null);
  const routes = fs.readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8");
  assert.ok(routes.includes("practiceUrl || attributedUrl(job, job.apply_url || job.url)"), "the run's link, never a practice form");
});

test("d185HowHeardOnlyIfTrue: 'draft' only when the person agreed AND found the job on draft; their own answer wins", () => {
  assert.deepEqual(howHeardAnswers({ agreed: false, foundOnDraft: true }), []);
  assert.deepEqual(howHeardAnswers({ agreed: true, foundOnDraft: false }), [], "a job they brought in themselves is never credited");
  assert.deepEqual(howHeardAnswers({}), [], "off by default");
  const yes = howHeardAnswers({ agreed: true, foundOnDraft: true });
  assert.equal(yes.length, HOW_HEARD_QUESTIONS.length);
  assert.ok(yes.every(a => a.answer === "draft" && a.eligibility === false));
  // In the packet: joined to the saved answers; a question the person answered keeps THEIR answer.
  const p = packetSavedAnswers({ how_heard: yes,
    saved_answer_records: [{ state: "acknowledged", question: "How did you hear about us?", answer: "A friend", question_key: "how did you hear about us", source: "user", acknowledged_at: 1, widget_kind: "text" }] });
  const us = p.savedAnswers.filter(s => /hear about us/i.test(s.question));
  assert.equal(us.length, 1);
  assert.equal(us[0].answer, "A friend");
  assert.ok(p.savedAnswers.some(s => s.question === "How did you hear about this job?" && s.answer === "draft"));
  assert.equal(packetSavedAnswers({}).savedAnswers, undefined);
  const routes = fs.readFileSync(new URL("../routes/apply.js", import.meta.url), "utf8");
  assert.ok(routes.includes("credit_draft FROM user_profile"), "the person's own switch");
  assert.ok(routes.includes("FROM job_captures WHERE user_id=? AND job_id=?"), "true only when they did not bring the job in themselves");
});
