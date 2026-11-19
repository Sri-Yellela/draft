import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { scoreAtsLocally, normaliseAtsTerm } from "../services/localAtsScorer.js";
import { samples } from "../services/sampleResumes.js";
import { BUILTIN_REGISTRY } from "../routes/domainProfiles.js";
import { categoryOf, profileCategory } from "../services/jobs/professionalScope.js";
import { inferProfileFromResume } from "../services/resumeOnboarding.js";
import { PAIRS } from "./fixtures/a111Professional.js";

// ⭐ A111 P2 (owner 11-02): THE ATS FOR EVERY PROFESSIONAL FIELD. The trial's own-résumé pathway maps a business, legal,
// marketing, sales, design / media or science résumé against postings of its own field, so the local scorer must READ
// those postings. Measured 11-02 on 23 synthetic posting / résumé pairs (test/fixtures/a111Professional.js, invented
// people): 9 of 23 were declined (< 4 scorable terms — accountant, business analyst, compliance, general manager, both
// sales roles, content writer, research scientist, economist) and the rest scored on 1-10 terms. Twenty registry domains
// (O*NET 30.0 Technology Skills per SOC group + named practices) bring every pair to 6-17 terms, scored 66-94;
// @draft/ats-scorer 1.4.0.
//
// ⛔ The vocabulary is ONE pooled set: a new term a software posting also uses would join that posting's report and move
// its score. Every new term was measured against 1,241 real computing postings, 43 engineering postings and the graded
// 30 (the local board, 11-02) and kept only when it occurs in none of them; every new verb is a verb the registry already
// had. Result: 0 of 1,284 computing / engineering reports changed in ANY field. The guards below keep that true.

const REG = JSON.parse(fs.readFileSync("registry/DOMAIN_METADATA_REGISTRY.json", "utf8"));
const A111_DOMAINS = ["accounting_audit", "financial_analysis", "consulting_strategy", "business_analysis",
  "procurement_purchasing", "compliance_risk", "hr_generalist_talent", "operations_management", "project_management",
  "general_management", "digital_marketing", "sales", "legal_practice", "contracts_management", "graphic_visual_design",
  "writing_content", "public_relations_communications", "life_sciences_research", "laboratory_chemistry_qc", "economics_research"];
const BEFORE = Object.entries(REG).filter(([k]) => !A111_DOMAINS.includes(k));
const GRADED = JSON.parse(fs.readFileSync("docs/am1-ats-graded-corpus.json", "utf8")).postings;
const SWE = { title: "Software Engineer", description: "We are hiring a Software Engineer. You will build backend services in Java, Go and TypeScript, using PostgreSQL, Redis, Docker, Kubernetes and AWS. Requirements: 3+ years with REST APIs, SQL, CI/CD, unit testing." };

test("a111ProfessionalVocabularyScores: a posting of every professional category is SCORED against its own field's résumé — not declined, on real terms, above the floor, and above every other field's résumé", () => {
  const cats = new Set();
  for (const p of PAIRS) {
    const r = scoreAtsLocally({ job: p.posting, resumeText: p.resume });
    const label = `${p.category} / ${p.role}`;
    assert.ok(r.score != null && r.decline_reasons.length === 0, `${label}: declined — ${r.decline_reasons}`);
    const terms = r.tier1_matched.length + r.tier1_missing.length;
    assert.ok(terms >= 6, `${label}: only ${terms} skill terms (${r.tier1_matched.join(", ")})`);
    assert.ok(r.score >= 60, `${label}: ${r.score}`);
    // The number discriminates: the posting's own field outscores the software sample and every other field's résumé.
    assert.ok(r.score > scoreAtsLocally({ job: p.posting, resumeText: samples().A.resumeText }).score, `${label}: below sample A`);
    for (const q of PAIRS) if (q !== p) {
      const other = scoreAtsLocally({ job: p.posting, resumeText: q.resume }).score ?? 0;
      assert.ok(r.score > other, `${label}: ${q.role}'s résumé scores ${other} >= ${r.score}`);
    }
    // The fixture's category is the board's category for that title (D127's rule), so the pairs are what the trial deals.
    assert.equal(categoryOf({ title: p.posting.title }).category, p.category, label);
    cats.add(p.category);
  }
  assert.deepEqual([...cats].sort(), ["arts_media", "business", "legal", "management", "marketing", "sales", "science"]);
  // Named practices land where a reader expects them.
  const named = (role) => { const p = PAIRS.find(x => x.role === role); return scoreAtsLocally({ job: p.posting, resumeText: p.resume }).tier1_matched; };
  for (const [role, t] of [["accountant / auditor", "ASC 842"], ["compliance analyst", "BSA/AML"], ["account executive", "MEDDIC"],
    ["paralegal", "privilege logs"], ["content writer", "AP style"], ["research scientist", "qPCR"], ["lab scientist", "HPLC"], ["economist", "Stata"]]) {
    assert.ok(named(role).includes(t), `${role}: ${t}`);
  }
});

test("a111ComputingScoresUnchanged: no new term occurs in the graded 30, every new verb was already a verb, and the graded 30 score exactly what they scored before A111", () => {
  const oldKeys = new Set(BEFORE.flatMap(([, v]) => [...(v.keywords || []), ...(v.tools || [])]).map(normaliseAtsTerm));
  const oldVerbs = new Set(BEFORE.flatMap(([, v]) => v.actionVerbs || []).map(v => v.toLowerCase()));
  const newKeys = new Set(A111_DOMAINS.flatMap(d => [...REG[d].keywords, ...REG[d].tools]).map(normaliseAtsTerm).filter(k => !oldKeys.has(k)));
  assert.ok(newKeys.size > 400, `${newKeys.size} new terms`);
  for (const d of A111_DOMAINS) for (const v of REG[d].actionVerbs) assert.ok(oldVerbs.has(v.toLowerCase()), `${d}: new verb "${v}" would join every software posting's verb list`);
  for (const p of [...GRADED, SWE]) {
    const text = ` ${normaliseAtsTerm(`${p.title}\n${p.description || ""}`)} `;
    const hit = [...newKeys].filter(k => text.includes(` ${k} `));
    assert.deepEqual(hit, [], `${p.company || ""} ${p.title}`);
  }
  // Recorded 11-02 on the pre-A111 registry (1.3.0): each graded posting against sample A (software) and sample B (data).
  const before = {
    A: [20, 25, 26, 5, 34, 31, 20, 42, 40, 26, 20, 51, 32, 16, 13, 20, 51, 33, 36, 14, 30, 20, 13, 33, 41, 30, 25, 13, 5, 39],
    B: [20, 20, 33, 5, 22, 20, 19, 25, 29, 17, 19, 24, 20, 25, 14, 19, 50, 26, 24, 14, 25, 20, 14, 33, 34, 25, 25, 13, 5, 26],
  };
  for (const id of ["A", "B"]) {
    assert.deepEqual(GRADED.map(p => scoreAtsLocally({ job: p, resumeText: samples()[id].resumeText }).score), before[id], `sample ${id}`);
  }
  assert.equal(scoreAtsLocally({ job: SWE, resumeText: samples().A.resumeText }).score, 76, "D126's software control");
});

test("a111: twenty domains in the registry's own schema, each title placed in a live non-computing category; a résumé of each field starts a profile in that field", () => {
  const families = new Set(BEFORE.map(([, v]) => v.roleFamily));
  for (const d of A111_DOMAINS) {
    const v = REG[d];
    assert.deepEqual(Object.keys(v), ["label", "roleFamily", "suggestedTitles", "keywords", "actionVerbs", "tools"], d);
    assert.ok(families.has(v.roleFamily) || ["sales", "science"].includes(v.roleFamily), `${d}: ${v.roleFamily}`);
    assert.ok(v.suggestedTitles.length >= 6 && v.keywords.length >= 14 && v.tools.length >= 4 && v.actionVerbs.length === 15, d);
    for (const t of v.suggestedTitles) {
      const c = categoryOf({ title: t });
      assert.ok(c.inScope && !["computing", "engineering"].includes(c.category), `${d}: "${t}" → ${c.category || c.reason}`);
    }
  }
  for (const p of PAIRS) {
    const inf = inferProfileFromResume(p.resume, REG, 2026);
    assert.ok(A111_DOMAINS.includes(inf.domain) || inf.domain === "pm_general", `${p.role}: ${inf.domain}`);
    const cat = profileCategory({ role_family: inf.roleFamily, target_titles: inf.titles, profile_name: inf.profileName });
    // A consultant's titles are management by D127's rule; every other field lands in its own category.
    assert.ok(cat === p.category || (p.role === "management consultant" && cat === "management"), `${p.role}: ${cat}`);
  }
});

test("a111: the three copies agree — registry/, the scorer package, and the domain picker's fallback; the package is 1.4.0 or later", () => {
  assert.equal(fs.readFileSync("registry/DOMAIN_METADATA_REGISTRY.json", "utf8"), fs.readFileSync("packages/ats-scorer/data/DOMAIN_METADATA_REGISTRY.json", "utf8"));
  for (const d of A111_DOMAINS) assert.deepEqual(BUILTIN_REGISTRY[d], REG[d], d);
  // D192 (46x): 1.5.0 added the contextual score (additive); A111's vocabulary is unchanged, so the pin is "at least 1.4.0".
  const [maj, min] = JSON.parse(fs.readFileSync("packages/ats-scorer/package.json", "utf8")).version.split(".").map(Number);
  assert.ok(maj > 1 || (maj === 1 && min >= 4));
});
