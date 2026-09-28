import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  htmlToText, extractYearsClaims, maxYearsClaim, extractSeniorityClaims, maxSeniority,
  checkResumeClaims, assertResumeClaims, ResumeClaimError, profileContradictionFindings,
  extractSummaryText,
} from "../services/resumeClaimGuard.js";
import { at, lastAt } from "../test-support/sourceAnchors.js";

// The real base resume's shape: two SDE roles, no seniority word anywhere, summary says 4 years.
const BASE_RESUME = `SRI BALAJI YELLELA
Fullstack Software Engineer

SUMMARY
Fullstack Software Engineer with 4 years building scalable, high-performance systems.

EXPERIENCE
Stripe — Software Development Engineer
Aug 2022 – Dec 2023
- Built scalable microservices for real-time payment processing
- Designed fault-tolerant distributed systems using GCP Pub/Sub

Amazon — Software Development Engineer
Jan 2021 – Jul 2022
- Built and operated cloud-native microservices on AWS
- Applied object-oriented programming and design patterns across core services`;

const PROFILE = { years_of_experience: 4 };

const resume = (summary, extra = "") => `<html><head><style>.header{}</style></head><body>
<div class="header"><div class="name">SRI BALAJI YELLELA</div></div>
<div class="section-title">SUMMARY</div><p>${summary}</p>
<div class="section-title">EXPERIENCE</div>
<div class="entry"><div class="entry-org">Stripe</div><div class="entry-role">${extra || "Software Development Engineer"}</div>
<ul class="bullets"><li>Built scalable microservices for payment processing</li></ul></div>
</body></html>`;

// ── Text extraction ──────────────────────────────────────────────────────────

test("htmlToText strips tags, style blocks and the trailing PDF comment", () => {
  const t = htmlToText(resume("Engineer with 4 years of experience.") +
    "<!-- Save and submit as PDF (print to PDF from browser). -->");
  assert.doesNotMatch(t, /<|>/);
  assert.doesNotMatch(t, /\.header/, "CSS must not be read as resume prose");
  assert.doesNotMatch(t, /Save and submit as PDF/, "the instruction comment is not a claim");
  assert.match(t, /Engineer with 4 years of experience/);
});

// ── Years ────────────────────────────────────────────────────────────────────

test("years claims are found in every phrasing a model actually writes", () => {
  const cases = [
    ["8 years of experience", 8],
    ["8+ years", 8],
    ["over 10 years building systems", 10],
    ["5-7 years", 7],
    ["5 to 7 years", 7],
    ["4.5 years", 4.5],
    ["eight years of backend work", 8],
    ["half a decade", 5],
    ["a decade of experience", 10],
    ["12 yrs", 12],
  ];
  for (const [text, expected] of cases) {
    assert.equal(maxYearsClaim(text), expected, text);
  }
});

test("A RANGE CLAIMS ITS TOP — that is the figure an employer reads", () => {
  assert.equal(maxYearsClaim("5-7 years of experience"), 7);
});

test("text with no years figure claims nothing, rather than zero", () => {
  assert.equal(maxYearsClaim("Software Engineer building distributed systems."), null);
  assert.equal(maxYearsClaim(""), null);
});

test("a year NUMBER is not a years-of-experience claim", () => {
  // Dates and quantities are everywhere in a resume; only a "N years" phrase is a claim.
  assert.equal(maxYearsClaim("Aug 2022 - Dec 2023"), null);
  assert.equal(maxYearsClaim("processing 1M+ daily transactions at 99.9% uptime"), null);
  assert.equal(maxYearsClaim("reducing deployment cycle time by 40% across 50+ releases"), null);
});

// ── Seniority ────────────────────────────────────────────────────────────────

test("a seniority claim is only counted when it qualifies a ROLE", () => {
  assert.equal(maxSeniority("Senior Software Engineer")?.word, "senior");
  assert.equal(maxSeniority("Staff Backend Developer")?.word, "staff");
  assert.equal(maxSeniority("Principal Engineer")?.word, "principal");
  assert.equal(maxSeniority("Director of Engineering")?.word, "director");
});

test("PROSE IS NOT A TITLE — the cases that would refuse a correct resume", () => {
  // Each of these contains a seniority word and claims no seniority. A false positive here does not
  // log a warning; it throws away a correct resume.
  for (const prose of [
    "Lead the migration of 12 downstream services",
    "Led the migration of 12 downstream services",
    "Leading indicator dashboards for reconciliation failures",
    "Built headless CMS integrations",
    "Went ahead of schedule on the platform rewrite",
    "Demonstrated seniority in technical design reviews",
    "Staffed the on-call rotation",
    "Associated the payment records with merchant accounts",
    "Reduced mid-tier latency",
    "Wrote the header parsing layer",
  ]) {
    assert.equal(maxSeniority(prose), null, prose);
  }
});

test("the real base resume asserts no seniority at all", () => {
  assert.equal(maxSeniority(BASE_RESUME), null,
    "'Software Development Engineer' is a title with no level word");
});

// ── The assertion ────────────────────────────────────────────────────────────

test("VERIFY: a JD demanding 8 years cannot make a 4-year profile claim 8", () => {
  const html = resume("Senior Software Engineer with 8 years building scalable payment systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(r.ok, false);

  const years = r.violations.find(v => v.kind === "years_exceed_profile");
  assert.ok(years, "the years claim must be caught");
  assert.equal(years.claimed, 8);
  assert.equal(years.allowed, 4);

  // And the seniority the JD's title dragged in with it.
  const sen = r.violations.find(v => v.kind === "seniority_unsupported");
  assert.ok(sen, "the seniority claim must be caught too");
  assert.equal(sen.claimed, "senior");

  // It is a FAILURE, not a warning.
  assert.throws(() => assertResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME }),
    (e) => e instanceof ResumeClaimError && e.code === "resume_claim_violation");
});

test("the honest resume passes untouched", () => {
  const html = resume("Fullstack Software Engineer with 4 years building scalable, high-performance systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(r.ok, true, JSON.stringify(r.violations));
  assert.equal(r.checked.claimedYears, 4);
  assert.equal(r.checked.profileYears, 4);
  assert.doesNotThrow(() => assertResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME }));
});

// ── AG3: the opposite drift ─────────────────────────────────────────────────────────────────────
//
// This used to assert the reverse — that under-claiming was the candidate's business and silent.
// AG3 reverses that call: both directions are the profile disagreeing with itself, and a summary
// that quietly says three when the profile says four costs the candidate a screen they qualified
// for, on an unattended run they never read.
test("AG3: a summary claiming FEWER years than the profile is a violation too", () => {
  const html = resume("Software Engineer with 3 years building distributed systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(r.ok, false);
  const v = r.violations.find(x => x.kind === "years_below_profile");
  assert.ok(v, "the under-claim must be reported by its own kind");
  assert.equal(v.claimed, 3);
  assert.equal(v.allowed, 4);
  assert.deepEqual(v.evidence, ["3 years"]);
  assert.equal(r.checked.summaryYears, 3);
});

test("AG3: the under-claim refuses the artifact, it does not merely warn", () => {
  const html = resume("Software Engineer with 2 years building distributed systems.");
  assert.throws(() => assertResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME }),
    e => e instanceof ResumeClaimError && e.code === "resume_claim_violation");
});

test("AG3: a SCOPED years figure outside the summary is not an under-claim", () => {
  // "3 years of Python" inside a skills line is a narrower, honest statement — not the document's
  // total. Reading it as one would refuse an honest resume, which is the failure mode that kept
  // this check off in the first place.
  const html = resume(
    "Fullstack Software Engineer with 4 years building scalable systems.",
  ).replace("</body>", '<div class="section-title">TECHNICAL SKILLS</div><p>Python (3 years), Go (2 years)</p></body>');
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(r.ok, true, r.violations.map(v => v.message).join(" | "));
});

test("AG3: a summary that matches the profile passes in both directions", () => {
  const html = resume("Fullstack Software Engineer with 4 years building scalable systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(r.ok, true, r.violations.map(v => v.message).join(" | "));
  assert.equal(r.checked.summaryYears, 4);
});

test("AG3: extractSummaryText reads the summary and stops at the next section", () => {
  const html = resume("Engineer with 4 years of experience.");
  const summary = extractSummaryText(html);
  assert.match(summary, /Engineer with 4 years of experience/);
  assert.doesNotMatch(summary, /Built scalable microservices/, "the summary must stop at EXPERIENCE");
  assert.doesNotMatch(summary, /SUMMARY/, "the heading is not part of the summary");
  assert.equal(extractSummaryText("<p>no headings anywhere</p>"), "",
    "no summary section means no under-claim check, rather than a guessed one");
});

test("a resume that states no years figure is not a violation", () => {
  const html = resume("Fullstack Software Engineer building scalable, high-performance systems.");
  assert.equal(checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME }).ok, true);
});

test("with no profile years stated, the years check is SKIPPED rather than assumed", () => {
  // Guessing a ceiling would be the same fault the guard exists to prevent.
  const html = resume("Engineer with 12 years of experience.");
  for (const profile of [{}, { years_of_experience: null }, { years_of_experience: 0 }, { years_of_experience: "" }]) {
    const r = checkResumeClaims({ html, profile, baseResumeText: BASE_RESUME });
    assert.equal(r.violations.some(v => v.kind === "years_exceed_profile"), false, JSON.stringify(profile));
    assert.equal(r.checked.profileYears, null);
  }
});

test("with no base resume, the seniority check is SKIPPED rather than assumed", () => {
  const html = resume("Principal Engineer with 4 years of experience.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: "" });
  assert.equal(r.violations.some(v => v.kind === "seniority_unsupported"), false);
  assert.equal(r.ok, true);
});

test("a seniority claim the base resume DOES support is allowed", () => {
  const senior = BASE_RESUME.replace(/Software Development Engineer/g, "Senior Software Engineer");
  const html = resume("Senior Software Engineer with 4 years building payment systems.");
  assert.equal(checkResumeClaims({ html, profile: PROFILE, baseResumeText: senior }).ok, true);
});

test("a seniority claim ABOVE what the base resume supports is not", () => {
  const senior = BASE_RESUME.replace(/Software Development Engineer/g, "Senior Software Engineer");
  const html = resume("Principal Software Engineer with 4 years building payment systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: senior });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].kind, "seniority_unsupported");
  assert.equal(r.violations[0].claimed, "principal");
  assert.equal(r.violations[0].allowed, "senior");
});

// ── The candidate's declared level is the authority ─────────────────────────────────────────────
//
// The base resume was the only authority before, and most resumes never write a level down — this
// fixture's two roles are both "Software Development Engineer", which states none. So the ceiling
// was rank 0 and NO seniority word was permitted anywhere in the output, however the candidate
// described themselves on their own profile. Measured against a JD titled "Senior Platform
// Engineer": six of eight real generations refused. Choosing a level is a deliberate act in the
// profile wizard, and it is the candidate's to make.
const DECLARED = level => ({ seniority: level });

test("SENIORITY: the level the candidate chose on their profile is allowed", () => {
  const html = resume("Senior Software Engineer with 4 years building payment systems.");
  // Without the declaration this is refused — the base resume states no level at all.
  assert.equal(checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME }).ok, false);
  // With it, it is the candidate's own word for themselves.
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME, domainProfile: DECLARED("senior") });
  assert.equal(r.ok, true, r.violations.map(v => v.message).join(" | "));
});

test("SENIORITY: the generator may not reach ABOVE the declared level", () => {
  const html = resume("Principal Software Engineer with 4 years building payment systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME, domainProfile: DECLARED("senior") });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].kind, "seniority_unsupported");
  assert.equal(r.violations[0].claimed, "principal");
  assert.equal(r.violations[0].allowed, "senior");
  assert.match(r.violations[0].message, /change the level on your profile/);
});

test("SENIORITY: declaring 'mid' still refuses a JD's senior title", () => {
  // The exact case that was refusing six of eight generations — and it should still refuse, because
  // this candidate chose mid. "Up to the candidate" is not "up to the job description".
  const html = resume("Senior Platform Engineer with 4 years building scalable systems.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME, domainProfile: DECLARED("mid") });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].claimed, "senior");
  assert.equal(r.violations[0].allowed, "mid");
});

test("SENIORITY: the ceiling is the HIGHER of the declaration and the base resume", () => {
  const staffResume = BASE_RESUME.replace(/Software Development Engineer/g, "Staff Software Engineer");
  // Declared mid, but the base resume evidences staff — a real promotion the profile is stale about.
  // Evidence must not be thrown away by a lower declaration.
  const html = resume("Staff Software Engineer with 4 years building payment systems.");
  assert.equal(
    checkResumeClaims({ html, profile: PROFILE, baseResumeText: staffResume, domainProfile: DECLARED("mid") }).ok,
    true,
  );
  // And the declaration lifts the ceiling when the base resume is the silent one.
  assert.equal(
    checkResumeClaims({
      html: resume("Senior Software Engineer with 4 years."),
      profile: PROFILE, baseResumeText: BASE_RESUME, domainProfile: DECLARED("senior"),
    }).ok,
    true,
  );
});

test("SENIORITY: every value the profile can hold has a rank", async () => {
  // shared/jobFilterOptions.js owns the enum. A fifth option added there and not here would fall
  // through to "no declaration" and silently restore the over-refusal this fixed.
  const { PROFILE_SENIORITY } = await import("../shared/jobFilterOptions.js");
  const html = resume("Senior Software Engineer with 4 years.");
  for (const opt of PROFILE_SENIORITY.options) {
    const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME, domainProfile: { seniority: opt.value } });
    // "senior" and above allow it; "junior"/"mid" do not. Either way the value must be RECOGNISED —
    // an unknown value would behave exactly like junior, which is the failure being guarded.
    const expectAllowed = ["senior", "executive"].includes(opt.value);
    assert.equal(r.ok, expectAllowed, `${opt.value} (${opt.label}) behaved unexpectedly`);
  }
});

test("SENIORITY: an unrecognised or empty declaration falls back to the base resume", () => {
  const html = resume("Senior Software Engineer with 4 years.");
  for (const seniority of [null, "", "  ", "wizard", undefined]) {
    const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME, domainProfile: { seniority } });
    assert.equal(r.ok, false, `${JSON.stringify(seniority)} must not be read as a declaration`);
  }
});

test("SENIORITY: with a declaration but no base resume, the declaration still governs", () => {
  const html = resume("Senior Software Engineer with 4 years.");
  assert.equal(checkResumeClaims({ html, profile: PROFILE, baseResumeText: "", domainProfile: DECLARED("senior") }).ok, true);
  assert.equal(checkResumeClaims({ html, profile: PROFILE, baseResumeText: "", domainProfile: DECLARED("junior") }).ok, false);
});

test("the claim is caught wherever it appears, not only in the summary", () => {
  // The summary is the usual place, but an inflated EXPERIENCE title is the same lie.
  const html = resume("Fullstack Software Engineer with 4 years of experience.", "Staff Software Engineer");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].kind, "seniority_unsupported");
  assert.equal(r.violations[0].claimed, "staff");
});

test("the guard never rewrites — it reports and refuses", () => {
  const html = resume("Senior Software Engineer with 8 years of experience.");
  const before = html;
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(html, before, "the input must not be mutated");
  for (const v of r.violations) {
    assert.ok(!("corrected" in v) && !("rewrite" in v) && !("to" in v),
      "rewriting an implausible claim into a plausible one is the same fabrication");
  }
});

// ── kbFindings shape ─────────────────────────────────────────────────────────

test("violations are expressible as kbFindings the review surface already renders", () => {
  const html = resume("Senior Software Engineer with 8 years of experience.");
  const findings = profileContradictionFindings({ html, profile: PROFILE, baseResumeText: BASE_RESUME });
  assert.equal(findings.length, 2);
  for (const f of findings) {
    // The shape validateResumeClaims already returns, so no consumer needs to change.
    for (const key of ["type", "severity", "message", "evidence"]) assert.ok(key in f, key);
    assert.equal(f.type, "flag");
    assert.equal(f.severity, "review");
    assert.equal(f.scope, "profile", "distinguishable from a company-KB finding");
  }
});

test("an honest resume produces no findings", () => {
  const html = resume("Fullstack Software Engineer with 4 years of experience.");
  assert.deepEqual(profileContradictionFindings({ html, profile: PROFILE, baseResumeText: BASE_RESUME }), []);
});

// ── Robustness ───────────────────────────────────────────────────────────────

test("malformed or empty input never throws inside a live run", () => {
  for (const html of ["", null, undefined, "<html>", "not html at all", "<p>4 years</p>"]) {
    assert.doesNotThrow(() => checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE_RESUME }));
  }
  assert.doesNotThrow(() => checkResumeClaims({ html: resume("x"), profile: null, baseResumeText: null }));
});

test("extractYearsClaims reports every claim, largest first, with its evidence", () => {
  const claims = extractYearsClaims("4 years here, 8 years there, and 6 years elsewhere");
  assert.deepEqual(claims.map(c => c.years), [8, 6, 4]);
  assert.match(claims[0].text, /8 years/);
});

test("extractSeniorityClaims reports the phrase it matched, for a reviewable message", () => {
  const [top] = extractSeniorityClaims("Principal Software Engineer and Senior Data Scientist");
  assert.equal(top.word, "principal");
  assert.match(top.phrase, /principal software engineer/i);
});

// ── The wiring, since A4 ────────────────────────────────────────────────────────────────────────
//
// The guard now runs in the tools service, on EVERY document it returns, and a violation there
// returns 422 with NO document (resume-master docs/API.md; its test/generate.test.js). The prompt
// rules and the runtime-inputs wording these tests used to pin moved with the prompt and are tested
// there (test/resumeClaimGuard.test.js, test/runtimeInputs.test.js). What is draft's to guarantee:
// no résumé is built any other way, and a refusal is never persisted.

test("⛔ no draft code builds a résumé with its own model call — every path goes through the guarded service", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const apply = fs.readFileSync("routes/apply.js", "utf8");
  // The earlier version of this test counted coreGenerateResume's callers and concluded every path
  // was guarded. /api/standalone/generate assembled its own prompt and called the model directly,
  // with no claim guard at all, and that count could not see it. So assert the CAUSE instead: there
  // is no prompt assembly and no generation call left in draft.
  assert.doesNotMatch(server, /assemblePrompt\(|buildRuntimeInputs\(|purpose: "resume_generate"|purpose: "standalone_generate"/,
    "draft must not build a résumé itself — that path would bypass the claim guard");
  assert.equal(fs.existsSync("services/promptAssembler.js"), false);
  assert.equal(fs.existsSync("prompts"), false, "a second copy of the prompt is how the CSS drifted three ways");
  // Both résumé-producing routes call the service.
  const kernel = server.slice(at(server, "async function coreGenerateResume("), at(server, "function scoreBaseResumeForApply("));
  assert.match(kernel, /await toolsService\.generate\(generateBody\)/);
  const standalone = server.slice(at(server, 'app.post("/api/standalone/generate"'), at(server, 'app.post("/api/standalone/apply"'));
  assert.match(standalone, /await toolsService\.generate\(\{/);
  // The UNATTENDED path still funnels through the kernel.
  assert.match(apply, /generateResumeForApply\(userId, jobId, toolType\)/);
  const wrapper = server.slice(at(server, "function generateResumeForApply"), at(server, 'app.post("/api/resumes/:jobId/html"'));
  assert.match(wrapper, /coreGenerateResume\(/);
});

test("⛔ a withheld résumé is never persisted, and the refusal reaches the caller", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const body = server.slice(at(server, "async function coreGenerateResume("), at(server, "function generateResumeForApply"));
  const callAt = body.indexOf("await toolsService.generate(generateBody)");
  assert.ok(callAt > 0);
  // The service call precedes every write, so a 422 (thrown as code "resume_claim_violation") leaves
  // nothing behind.
  for (const write of ["INSERT INTO resume_versions", "INSERT INTO resumes", "INSERT INTO user_jobs", "emitToUser(", "insertNotification("]) {
    const at_ = body.indexOf(write);
    assert.ok(at_ > callAt, `${write} must come after the guarded call`);
  }
  // The only catch around the call meters spend and RETHROWS — it must not swallow the refusal.
  const guarded = body.slice(lastAt(body, "try {", callAt), at(body, "usageEventId = ", callAt));
  assert.match(guarded, /catch \(e\) \{[\s\S]*?throw e;\s*\}/, "the catch must rethrow");
  // Attributed to US, not to the provider, with its own code.
  const wrapper = server.slice(at(server, "function generateResumeForApply"), at(server, 'app.post("/api/resumes/:jobId/html"'));
  assert.match(wrapper, /classifyGenerationError\(e\)/);
  const attribution = fs.readFileSync("shared/failureAttribution.js", "utf8");
  assert.match(attribution, /e\?\.code === "resume_claim_violation"/);
  // The interactive route answers 422 with the reasons — not 500.
  const route = server.slice(at(server, 'app.post("/api/generate"'), at(server, "// SANDBOX + PDF"));
  assert.match(route, /httpErrorFor\(e, "Resume generation failed"\)/);
});

test("kbFindings reports a profile contradiction alongside a company-KB one", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const start = server.indexOf("const kbFindingsFor =");
  const body = server.slice(start, start + 1200);
  assert.match(body, /validateResumeClaims\(db, html\)/, "the 9.6 check must stay");
  assert.match(body, /profileContradictionFindings\(/, "and the inward-facing one is added");
  // A validator bug must not break a real generate response — the existing contract.
  assert.match(body, /catch \(e\)/);
});

// ── How the refusal reaches the candidate ────────────────────────────────────

test("a claim violation is attributed to US, not to the model provider", async () => {
  const { classifyGenerationError } = await import("../shared/failureAttribution.js");
  const err = new ResumeClaimError({
    violations: [{ kind: "years_exceed_profile", message: "claims 8 years; the profile states 4." }],
    checked: {},
  });
  const f = classifyGenerationError(err);
  assert.equal(f.code, "resume_claim_violation",
    "'generation_failed' would blame the API for our own refusal");
  assert.doesNotMatch(f.detail, /upstream/i);
  assert.match(f.detail, /NOT saved or sent/);
  assert.match(f.detail, /claims 8 years/, "the specific violation must survive into reason_detail");
  // Retryable: the generator is stochastic, so the next attempt may come back honest. It is the
  // SUBMISSION that must never happen, not the retry.
  assert.equal(f.permanent, false);
});

test("an ordinary upstream failure is still classified as before", async () => {
  const { classifyGenerationError } = await import("../shared/failureAttribution.js");
  const e = Object.assign(new Error("overloaded_error"), { status: 529 });
  const f = classifyGenerationError(e);
  assert.equal(f.code, "generation_failed");
  assert.match(f.detail, /upstream generation error/);
});

test("the reason code renders as a sentence, not as a raw code", () => {
  // An unmapped reason code falls through to a fallback that prints the code with its underscores
  // swapped out — which this codebase treats as a bug, not a rendering.
  const src = fs.readFileSync("client/src/lib/applyObstacles.js", "utf8");
  assert.match(src, /resume_claim_violation: \{/);
  const entry = src.slice(at(src, "resume_claim_violation: {"), at(src, "resume_claim_violation: {") + 400);
  assert.match(entry, /obstacle:/);
  assert.match(entry, /action:/);
  // Protective: the guard did its job. Filing it under "these broke" would be the wrong story.
  assert.match(entry, /protective: true/);
  assert.match(entry, /resumeBlocked: true/);
});
