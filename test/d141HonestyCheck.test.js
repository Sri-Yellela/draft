import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { at } from "../test-support/sourceAnchors.js";
import { honestyCheck, resumeLines, skillItems } from "../services/honestyCheck.js";
import { standaloneAtsResult } from "../services/standaloneAts.js";

// ⭐ D141 (owner 11-02) · THE RÉSUMÉ HONESTY CHECK. The fixture is SYNTHETIC (test/fixtures/d141): a fictional engineer's
// original, a competitor-style "aggressive tailoring" of it toward a sales-operations job (the pattern of the owner's
// 11-02 test — sales skills added to the AI skills row, ML work rewritten in sales words), and that job.

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const F = (f) => read(`test/fixtures/d141/${f}`);
const ORIGINAL = F("original.txt"), TAILORED = F("tailored.txt"), JOB = F("job.txt");
const keywordsFor = (text) => {
  const a = standaloneAtsResult({ resumeText: text, jdText: JOB, jobTitle: "Sales Operations Analyst" });
  return { matched: a.matched_skills, missing: a.missing_skills };
};
const run = (o = {}) => honestyCheck({ resumeText: TAILORED, originalText: ORIGINAL, jdText: JOB, keywordsFor, ...o });
const line = (r, start) => r.lines.find(l => l.text.startsWith(start));

test("D141 · lines: skills rows, bullets and headings are told apart", () => {
  const kinds = resumeLines(TAILORED).map(l => l.kind);
  assert.equal(kinds.filter(k => k === "skills").length, 2);
  assert.equal(kinds.filter(k => k === "bullet").length, 6);
  assert.deepEqual(skillItems("AI skills: Python, PyTorch (2 yrs) | CUDA"), ["Python", "PyTorch", "CUDA"]);
});

test("D141 · d141FlagsUnsupportedClaims — every inserted skill, the invented phrases, numbers, scope and the raised title", () => {
  const r = run();
  assert.equal(r.comparedTo, "original");
  assert.deepEqual(r.summary.unsupportedSkills,
    ["Salesforce", "CRM", "pipeline management", "forecasting", "quota attainment", "territory planning", "account management", "negotiation"]);
  const comp = line(r, "Led incentive compensation");
  assert.equal(comp.risk, "high");
  assert.ok(comp.flags.find(f => f.kind === "phrase").terms.some(t => /incentive compensation plan design/.test(t)), "the invented rewrite, in its own words");
  assert.ok(comp.flags.some(f => f.kind === "scope" && f.terms.includes("led")));
  const harness = line(r, "Spearheaded a PyTorch");
  assert.deepEqual(harness.flags.find(f => f.kind === "number").terms, ["12"], "4 teams became 12");
  assert.ok(line(r, "Owned Salesforce").flags.some(f => f.kind === "number" && f.terms.includes("25%")));
  assert.ok(line(r, "Delivered executive presentations").flags.some(f => f.kind === "phrase"));
  assert.equal(line(r, "Senior Machine Learning Engineer").flags[0].kind, "title");
  assert.deepEqual(r.summary.seniority, { claimed: "senior machine learning engineer", original: null });
  // The untouched lines are not flagged.
  assert.equal(line(r, "Profiled GPU memory use").risk, "low");
  assert.equal(line(r, "Wrote SQL reports").risk, "low");
  assert.equal(line(r, "Data: SQL, Spark, Airflow").risk, "low");
});

test("D141 · honest rewording passes; the original against itself flags nothing", () => {
  assert.equal(honestyCheck({ resumeText: ORIGINAL, originalText: ORIGINAL }).flagged, 0);
  const honest = ORIGINAL.replace("• Optimized LLM inference kernels in CUDA and C++, cutting p99 latency by 38%",
    "• Cut p99 latency by 38% by optimizing CUDA and C++ kernels for LLM inference");
  const r = honestyCheck({ resumeText: honest, originalText: ORIGINAL });
  assert.equal(line(r, "Cut p99 latency").risk, "low", "the same facts in a new order are not a claim");
});

test("D141 · interview risk and the probe; the fix rewords from the original or links to earn it", () => {
  const r = run();
  const harness = line(r, "Spearheaded a PyTorch");
  assert.match(harness.probe, /^Likely to be probed: .*your original has no evidence of it\.$/);
  assert.equal(harness.fix.reword, "Built a PyTorch benchmarking harness used by 4 model teams to compare quantization schemes");
  const skills = r.lines.find(l => l.kind === "skills" && l.flags.length);
  assert.match(skills.probe, /tell me about a time you used Salesforce/);
});

test("D141 · d141FixLinksToBuild — an unsupported skill links to where it can be learned and earned", () => {
  const skills = run().lines.find(l => l.kind === "skills" && l.flags.length);
  assert.deepEqual(skills.fix.earn[0], { term: "Salesforce", href: "/atlas?q=Salesforce" });
  assert.equal(skills.fix.earn.length, 8);
  assert.match(read("client/src/pages/tools/HonestyToolPage.jsx"), /<a href=\{e\.href\}[^>]*>learn \{e\.term\}<\/a>/);
});

test("D141 · the keyword picture — the job's terms before and after, and which were added without support", () => {
  const k = run().keywords;
  assert.ok(k.inResume > k.inOriginal, `${k.inOriginal} → ${k.inResume} of ${k.total}`);
  assert.ok(k.addedUnsupported.includes("Salesforce"));
  assert.ok(k.addedUnsupported.every(t => k.added.includes(t)));
  assert.equal(honestyCheck({ resumeText: TAILORED, originalText: ORIGINAL }).keywords, null, "no job, no keyword picture");
});

test("D141 · without an original, every number is a claim to back; nothing is called unsupported", () => {
  const r = honestyCheck({ resumeText: TAILORED });
  assert.equal(r.comparedTo, "none");
  assert.deepEqual(r.summary.unsupportedSkills, []);
  assert.ok(line(r, "Spearheaded a PyTorch").flags.some(f => f.kind === "number" && /you will be asked to back/.test(f.text)));
});

test("D141 · d141NoStorageWithoutSignup — the route is public, parses in memory, and writes nothing", () => {
  const server = read("server.js");
  const from = at(server, 'app.post("/api/standalone/honesty", standaloneUpload.fields(', 0, "the route");
  const body = server.slice(from, at(server, "// POST /api/standalone/generate", from, "the next route"));
  assert.doesNotMatch(body, /requireAuth|db\.prepare|INSERT|UPDATE|writeFile|console\.(log|info|warn|error)\(/, "no account, no row, no file, no log line");
  assert.match(server, /const standaloneUpload = multer\(\{ storage: multer\.memoryStorage\(\)/, "uploads stay in memory");
  const svc = read("services/honestyCheck.js").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(svc, /db\.|prepare\(|fs\.|fetch\(|anthropic|toolsService/i, "the check reads text and returns — nothing else");
  assert.match(read("test/authRouteGuardManifest.test.js"), /"POST \/api\/standalone\/honesty",/);
  assert.match(read("client/src/App.jsx"), /<Route path="\/tools\/honesty"\s+element=\{<HonestyToolPage\/>\}\/>/);
});
