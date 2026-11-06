// 44x (agenda step 2, the e2e walk on the 18k copy, 11-05) — a tailored résumé that came back without most of the base
// is withheld. Measured: the tools service's text parser did not read "Education:" (a heading with a trailing colon)
// as a heading, so its lean / payload / code tailorings returned the header alone (80 of 1,466 characters), and draft
// stored it, took a Draft slot, marked the job Pending and prepared the apply packet with it.
// Synthetic person only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resumeContentLoss, CONTENT_LOSS_MIN_RATIO, CONTENT_LOSS_MIN_BASE_CHARS } from "../services/generatedResumes.js";
import { httpErrorFor, ToolsServiceError, USER_GENERATION_MESSAGES } from "../services/toolsService.js";
import { at } from "../test-support/sourceAnchors.js";

const SERVER = fs.readFileSync("server.js", "utf8").replace(/\r\n/g, "\n");

const BASE = [
  "Avery Sample", "avery.sample@example.test | (000) 555-0100 | Springfield",
  "Education:", "Bachelor of Science in Computer Science, Spring 2020", "Example State University",
  "Technical Skills:", "Experience In: C++ Java Visual Studio", "Familiar With: HTML CSS JavaScript",
  "Work Experience:", "Technical Assistant July 2016 – Current", "College of Engineering – Example State University",
  "• Provided technical support for campus events every summer", "• Managed and directed tasks of new student workers",
  "• Updated the college IT support website to current university standards", "• Rebuilt computers for reuse",
  "Volunteer Intern, Assistant Systems Administrator Jan 2016 – July 2016", "• Managed and sustained a file server",
  "• Collaborated with team members to divide jobs and accomplish tasks",
].join("\n");

test("44x: the header-only résumé the walk measured is a content loss", () => {
  // What the tools service returned for an "Education:"-style base: name, contact line, the word "Education:".
  const headerOnly = "Avery Sample avery.sample@example.test | (000) 555-0100 | Springfield Education:";
  const loss = resumeContentLoss(BASE, headerOnly);
  assert.ok(BASE.replace(/\s+/g, " ").length >= CONTENT_LOSS_MIN_BASE_CHARS, "the fixture is a base of real length");
  assert.ok(loss, "withheld");
  assert.ok(loss.ratio < CONTENT_LOSS_MIN_RATIO);
  assert.equal(loss.baseChars, BASE.replace(/\s+/g, " ").trim().length);
});

test("44x: a tailoring that shortens, rewords or re-tags the résumé is NOT a loss; a short base is never judged", () => {
  const half = BASE.split("\n").slice(0, 12).join(" ");
  assert.equal(resumeContentLoss(BASE, half), null, "half the base is a plausible one-page tailoring");
  assert.equal(resumeContentLoss(BASE, `<div class="name">Avery Sample</div>${BASE.toUpperCase()}`), null, "HTML around it is not counted");
  assert.equal(resumeContentLoss("Avery Sample\nEducation:\nBSc", "Avery Sample"), null, "a base under the minimum is not judged");
  assert.equal(resumeContentLoss("", ""), null);
});

test("44x: the route answers a withheld résumé as what happened — not 'try again', no vendor words", () => {
  const e = new ToolsServiceError("The tailored résumé came back missing most of the base résumé",
    { code: "resume_incomplete", status: 502, retryable: false, permanent: true });
  const { status, body } = httpErrorFor(e, "Resume generation failed");
  assert.equal(status, 422);
  assert.equal(body.code, "resume_incomplete");
  assert.equal(body.retryable, false);
  assert.equal(body.error, USER_GENERATION_MESSAGES.incomplete);
  assert.match(body.error, /withheld/);
  assert.doesNotMatch(body.error, /try again shortly|model|key|credit|Anthropic/i);
});

test("44x: coreGenerateResume checks the content BEFORE it scores, stores, debits or packs anything", () => {
  const fn = SERVER.slice(at(SERVER, "async function coreGenerateResume("), at(SERVER, "async function coreGenerateResume(") + 40000);
  const check = at(fn, "const contentLoss = resumeContentLoss(authoritativeResumeText, resumeStripped);");
  assert.ok(check > at(fn, "const resumeStripped = stripResumeHtml(formattedHtml);"));
  assert.ok(check < at(fn, "const atsReport = scoreAtsLocally("), "before the after-score");
  assert.ok(check < at(fn, "stored = storeGeneratedResume(db, {"), "before the store");
  const branch = fn.slice(check, check + 900);
  assert.match(branch, /refundGeneration\(db, usageEventId,/);
  assert.match(branch, /code: "resume_incomplete", status: 502, retryable: false, permanent: true/);
  // the slot is debited by the route only after coreGenerateResume returns
  const route = SERVER.slice(at(SERVER, 'app.post("/api/generate", requireAuth'));
  assert.ok(at(route, "const result = await coreGenerateResume(") < at(route, "recordGenerationSlot(db, req.user.id, jobId);"));
});
