// AI1 — the summary section is opt-in, and turning it off must not turn the AF2 guard off with it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
// A4: the prompt-conditional and assembler tests moved to resume-master with the prompt.
import {
  checkResumeClaims, assertResumeClaims, ResumeClaimError, ResumeClaimNotInspectedError,
  extractHeadlineRegion,
} from "../services/resumeClaimGuard.js";
import { normalizeResumeHtml, renderStructuredResume } from "../services/resumeFormatter.js";
import { scoreAtsLocally } from "../services/localAtsScorer.js";
import { at } from "../test-support/sourceAnchors.js";
import { generateRequest } from "../services/toolsServiceRequests.js";


test("a resume with no summary renders no heading and no rule line for one", () => {
  const html = normalizeResumeHtml(`<html><body>
    <div class="header"><div class="name">Ada Byron</div><div class="tagline">Software Engineer</div></div>
    <div class="section-title">TECHNICAL SKILLS</div><ul><li><strong>Languages</strong> Python, Go</li></ul>
    <div class="section-title">EXPERIENCE</div>
    <div class="entry"><div class="entry-org">Acme</div><ul class="bullets"><li>Built things.</li></ul></div>
  </body></html>`);
  assert.doesNotMatch(html, />SUMMARY</);
  // The section beneath is the FIRST one, immediately after the header — nothing is reserved and
  // nothing reflows around a gap. Asserted on the first section heading in the document rather
  // than on the absence of the word, so a blank heading of any name would fail here too.
  const headings = [...html.matchAll(/<div class="section-title">([^<]*)<\/div>/g)].map(m => m[1].trim());
  assert.deepEqual(headings, ["TECHNICAL SKILLS", "EXPERIENCE"]);
  assert.ok(html.indexOf("Ada Byron") < html.indexOf("TECHNICAL SKILLS"),
    "TECHNICAL SKILLS must follow the header");
});

test("an EMPTY summary is dropped rather than rendered as a heading over nothing", () => {
  const out = renderStructuredResume({
    header: { name: "Ada Byron", tagline: "Software Engineer", contact: "ada@example.com" },
    sections: [
      { type: "summary", title: "SUMMARY", text: "   " },
      { type: "skills", title: "TECHNICAL SKILLS", rows: [{ label: "Languages", values: "Python" }] },
    ],
  });
  assert.doesNotMatch(out, />SUMMARY</, "a heading with no body is worse than no section");
  assert.match(out, />TECHNICAL SKILLS</);
});

test("a summary WITH text still renders, so the drop is of empties and not of summaries", () => {
  const out = renderStructuredResume({
    header: { name: "Ada Byron", tagline: "Software Engineer", contact: "ada@example.com" },
    sections: [
      { type: "summary", title: "SUMMARY", text: "Software Engineer with 4 years of experience." },
      { type: "skills", title: "TECHNICAL SKILLS", rows: [{ label: "Languages", values: "Python" }] },
    ],
  });
  assert.match(out, />SUMMARY</);
  assert.match(out, /4 years of experience/);
});

// ── AF2'S ASSERTION MUST SURVIVE (requirement 4) ────────────────────────────────────────────────

const PROFILE = { years_of_experience: 4 };
const BASE = "Sri Balaji Yellela\nSoftware Engineer\nBuilt services at Acme.";

const noSummaryResume = (bullet, tagline = "Software Engineer") => `<html><body>
<div class="header"><div class="name">SRI BALAJI YELLELA</div><div class="tagline">${tagline}</div>
<div class="contact">sri@example.com</div></div>
<div class="section-title">TECHNICAL SKILLS</div><ul class="bullets"><li>Python, Go</li></ul>
<div class="section-title">EXPERIENCE</div>
<div class="entry"><div class="entry-org">Acme</div><ul class="bullets"><li>${bullet}</li></ul></div>
</body></html>`;

test("the INFLATION check still fires on a document with no summary", () => {
  // This is the check AF2 exists for, and it reads the whole document — the summary was only ever
  // where the figure usually sat, never the limit of what was inspected.
  const html = noSummaryResume("Delivered platform work over 9 years of professional engineering.");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].kind, "years_exceed_profile");
  assert.throws(() => assertResumeClaims({ html, profile: PROFILE, baseResumeText: BASE }),
    e => e instanceof ResumeClaimError);
});

test("the inflation check reports that it INSPECTED something, not merely that it found nothing", () => {
  // A pass with documentChars 0 would read exactly like an honest resume. This is the assertion
  // that tells the two apart.
  const html = noSummaryResume("Built and shipped internal services.");
  const r = assertResumeClaims({ html, profile: PROFILE, baseResumeText: BASE });
  assert.equal(r.ok, true, r.violations.map(v => v.message).join(" | "));
  assert.ok(r.checked.inspected.documentChars > 100,
    `the guard read only ${r.checked.inspected.documentChars} characters`);
  assert.ok(r.checked.inspected.headlineChars > 0, "the headline region must not be empty");
  assert.equal(r.checked.inspected.seniorityCeilingKnown, true);
});

test("the guard REFUSES a document it cannot read, rather than passing it", () => {
  assert.throws(() => assertResumeClaims({ html: "", profile: PROFILE, baseResumeText: BASE }),
    e => e instanceof ResumeClaimNotInspectedError && e.code === "resume_claim_not_inspected");
  assert.throws(() => assertResumeClaims({ html: "<html><body></body></html>", profile: PROFILE }),
    e => e instanceof ResumeClaimNotInspectedError);
});

test("with no summary the headline region is the HEADER, and it is named", () => {
  const r = checkResumeClaims({ html: noSummaryResume("Built services."), profile: PROFILE, baseResumeText: BASE });
  assert.equal(r.checked.inspected.headlineRegion, "header");
  assert.equal(r.checked.summaryYears, null, "there is no summary, so no summary figure");
});

test("with a summary the headline region is still the SUMMARY — unchanged behaviour", () => {
  const html = `<html><body><div class="header"><div class="name">A B</div></div>
<div class="section-title">SUMMARY</div><p>Software Engineer with 4 years of experience.</p>
<div class="section-title">EXPERIENCE</div><p>Acme</p></body></html>`;
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE });
  assert.equal(r.checked.inspected.headlineRegion, "summary");
  assert.equal(r.checked.summaryYears, 4);
  assert.equal(r.checked.headlineYears, 4);
});

test("the UNDER-claim check follows the figure into the header when there is no summary", () => {
  // The AG3 drift, on a document shaped by AI1. Before the headline region existed this returned
  // ok with nothing read — the exact silent pass requirement 4 calls a regression.
  const html = noSummaryResume("Built services.", "Software Engineer | 2 Years Experience");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].kind, "years_below_profile");
  assert.match(r.violations[0].message, /header claims 2 years/);
});

test("a scoped figure in a bullet is still not read as the document's total", () => {
  const html = noSummaryResume("Maintained a Python service (3 years of Python across two teams).");
  const r = checkResumeClaims({ html, profile: PROFILE, baseResumeText: BASE });
  assert.equal(r.ok, true, r.violations.map(v => v.message).join(" | "));
});

test("extractHeadlineRegion stops at the first section heading", () => {
  const { text, region } = extractHeadlineRegion(noSummaryResume("Built services."));
  assert.equal(region, "header");
  assert.match(text, /SRI BALAJI YELLELA/);
  assert.doesNotMatch(text, /Built services/, "the header stops where the first section starts");
  assert.deepEqual(extractHeadlineRegion(""), { text: "", region: "none" });
});

// ── The ATS scorer ──────────────────────────────────────────────────────────────────────────────

test("the ATS scorer has no structural dependency on a summary section", () => {
  // The question requirement 4's regression list asks: does a document score worse simply for not
  // having a summary? It does not — the scorer never looks for the section. It reads keyword
  // coverage over the whole document, so a resume with no summary is scored on the same terms as
  // one with a summary, and identical text scores identically whichever section carries it.
  const scorer = fs.readFileSync("packages/ats-scorer/src/scorer.js", "utf8");
  assert.doesNotMatch(scorer, /SUMMARY|section_title|hasSummary/,
    "the scorer must not read, require or reward a summary section");

  const job = {
    title: "Backend Engineer", company: "Northwind",
    description: "Backend engineer. Java, distributed systems, Kubernetes.",
  };
  const basis = t => ({ resumeText: t, skills: [], titles: [], actionVerbs: [] });
  const terms = "Java distributed systems Kubernetes";
  const inSummary = `SUMMARY Engineer skilled in ${terms}. EXPERIENCE Acme. Built services.`;
  const inBullets = `TECHNICAL SKILLS ${terms} EXPERIENCE Acme. Built services.`;
  assert.equal(scoreAtsLocally({ job, runtimeBasis: basis(inSummary) }).score,
               scoreAtsLocally({ job, runtimeBasis: basis(inBullets) }).score,
    "the same terms must score the same wherever in the document they sit");
});

// ── The wiring (requirements 1, 5, 6) ───────────────────────────────────────────────────────────

test("the migration is byte-identical in both runners, and defaults to OFF", () => {
  const slice = (file) => {
    const t = fs.readFileSync(file, "utf8");
    const i = t.indexOf("      // AI1. The summary section");
    const j = t.indexOf("},", t.indexOf("092_profile_summary_opt_in")) + 3;
    assert.ok(i > 0 && j > i, `${file} is missing migration 092`);
    return t.slice(i, j);
  };
  const a = slice("server.js"), b = slice("scripts/migrations.js");
  assert.equal(a, b, "the two migration lists must not drift");
  assert.match(a, /ALTER TABLE domain_profiles ADD COLUMN include_summary INTEGER NOT NULL DEFAULT 0;/);
  // Additive only — a migration that rewrites the table would take the existing rows with it.
  assert.doesNotMatch(a, /DROP|DELETE FROM|UPDATE domain_profiles/);
});

test("coreGenerateResume reads the per-profile preference and passes it to the tools service", () => {
  // A4: the flag reaches the PROMPT inside the tools service now (its promptAssembler resolves the
  // conditionals; its test/summaryOptIn.test.js pins that). draft's half is that the per-profile
  // column is read and sent, with the documented default.
  const server = fs.readFileSync("server.js", "utf8");
  const body = server.slice(at(server, "async function coreGenerateResume"),
                            at(server, "function generateResumeForApply(userId, jobId, toolType)"));
  assert.ok(body.length > 500, "coreGenerateResume was not located");
  assert.match(body, /const includeSummary = activeDomainProfile\?\.include_summary === 1;/);
  assert.match(body, /toolsGenerateRequest\(\{[\s\S]{0,300}?includeSummary,/);
  // What the guard inspected is still recorded next to the generation.
  assert.match(body, /generated\.claimCheck\.inspected\.documentChars/);
  // Requirement 3, asserted structurally: nothing removes a summary after the fact.
  assert.doesNotMatch(body, /stripSummary|removeSummary/);
  // And the mapping carries it strictly: only an explicit true turns the section on.
  const on = generateRequest({ profile: {}, job: { title: "E" }, baseResumeText: "x", mode: "GENERATE", includeSummary: true });
  const off = generateRequest({ profile: {}, job: { title: "E" }, baseResumeText: "x", mode: "GENERATE", includeSummary: 1 });
  assert.deepEqual(on.options, { includeSummary: true });
  assert.deepEqual(off.options, { includeSummary: false }, "a truthy non-boolean must land on the default");
});

test("the standalone path honours it, with the same default", () => {
  const server = fs.readFileSync("server.js", "utf8");
  const body = server.slice(at(server, 'app.post("/api/standalone/generate"'),
                            at(server, 'app.post("/api/standalone/apply"'));
  assert.ok(body.length > 500, "the standalone generate route was not located");
  assert.match(body, /req\.body\?\.include_summary === true/);
  assert.match(body, /options: \{ includeSummary \}/);
});

test("the API accepts the field, coerces it, and returns it as a boolean", () => {
  const routes = fs.readFileSync("routes/domainProfiles.js", "utf8");
  assert.match(routes, /include_summary: row\.include_summary === 1,/);
  // Anchored on the field, not on it being LAST in the allow-list — AL2 appended
  // generate_at_queue after it, and pinning "is the final entry" makes every future addition to
  // this list look like a regression in the summary feature.
  assert.match(routes, /"include_summary",? ?/, "PUT must allow the field");
  assert.match(routes, /updates\.include_summary === true \|\| updates\.include_summary === 1 \|\| updates\.include_summary === "true"\) \? 1 : 0/);
});

test("the toggle sits with the per-profile resume settings and says what it does", () => {
  const panel = fs.readFileSync("client/src/panels/JobProfilesPanel.jsx", "utf8");
  assert.match(panel, /Include a summary section/);
  // Beside the base resume block, not in a general settings page.
  assert.ok(panel.indexOf("Base Resume") < panel.indexOf("Include a summary section"),
    "the toggle belongs in the profile's resume settings");
  assert.match(panel, /resumes generated before this setting existed did/,
    "the default changed under existing users; the UI has to say so");
  assert.match(panel, /include_summary: next/);
  // The copy states the effect, not a pitch for the section.
  assert.doesNotMatch(panel, /recruiters (love|prefer)|stand out|boost your/i);
});
