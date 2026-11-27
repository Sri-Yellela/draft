// ⭐ THE ATS CARD — the owner's pick, 11-19: option C (https://claude.ai/artifact/Fx8EDAEByAkLuBcADt7v2W): the number, the four
// parts as one bar and one plain line each, the single biggest gain; and "ditch the whole prove it and claim it gimmick and
// definitely ditch it from the jd panel". shared/contextualView.js atsCardView words it (pure); client/src/components/AtsCard.jsx
// draws it; ATSPanel draws only the card. Numbers are painted by band (AtsInk), never a band word.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { scoreContextual } from "@draft/ats-scorer";
import { atsCardView } from "../shared/contextualView.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8").replace(/\r\n/g, "\n");

const POSTING = "Senior Backend Engineer\nWhat you'll do\n- Build payment infrastructure for merchants\n- Lead a team of 5 engineers through design reviews\n- Own on-call for the ledger service\nfintech";
const RESUME = "Experience\n- Built payment infrastructure for merchants in fintech on Kafka\n- Ran on-call for the ledger service\nSkills: Airflow, Kafka, Go";
const SB = { category: "software-engineering", subcategory: "swe.backend", level: "senior" };
const REPORT = { score: 64, tier1_matched: ["Go", "Kafka", "PostgreSQL", "AWS", "Docker"], tier1_missing: ["Terraform", "Kubernetes", "gRPC"] };
const block = scoreContextual({ skillMatch: 64, skillsBoth: REPORT.tier1_matched, posting: { ...SB, text: POSTING }, resume: { ...SB, text: RESUME },
  company: { industry: "healthcare", techStack: [{ name: "Apache Kafka", postingShare: 0.64 }, { name: "Go", postingShare: 0.55 }, { name: "Terraform", postingShare: 0.41 }, { name: "Prefect", postingShare: 0.27 }] } });

test("option C's content: the number, Skills · Role · The work · Their stack — one line each — and the biggest gain", () => {
  const v = atsCardView({ report: REPORT, contextual: block });
  assert.equal(v.declined, false);
  assert.equal(v.score, block.score, "the contextual number");
  assert.deepEqual(v.parts.map(p => p.name), ["Skills", "Role", "The work", "Their stack"]);
  const line = Object.fromEntries(v.parts.map(p => [p.name, p.line]));
  assert.equal(line.Skills, "Go, Kafka, PostgreSQL, AWS, Docker — missing Terraform, Kubernetes, gRPC");
  assert.equal(line.Role, "Backend, senior — the same as the job");
  assert.match(line["The work"], /^You have done 2 of 3 — not “Lead a team of 5 engineers through design…”$/);
  assert.equal(line["Their stack"], "Kafka and Go yes · Airflow ≈ their Prefect · Terraform no", "the vendor prefix dropped where the line is short");
  assert.equal(atsCardView({ report: { score: 50, tier1_matched: ["aws", "postgresql", "docker"], tier1_missing: ["grpc"] } }).parts[0].line, "AWS, PostgreSQL, Docker — missing gRPC", "names as people write them");
  assert.deepEqual(v.gain, { tech: "Terraform", text: "Terraform — in 41% of their jobs" });
});

test("no band word, no claim, no term lists beyond one line; a declined score is said in words; no block → the skill match alone", () => {
  const v = atsCardView({ report: REPORT, contextual: block });
  assert.doesNotMatch(JSON.stringify(v), /\b(Strong|Moderate|Weak)\b|true of me|claim/i);
  const alone = atsCardView({ report: REPORT, contextual: null });
  assert.deepEqual([alone.score, alone.parts.map(p => p.id)], [64, ["skill_match"]]);
  assert.deepEqual(alone.gain, { tech: "Terraform", text: "Terraform — the posting asks for it" });
  const declined = atsCardView({ report: { score: null, decline_reasons: ["The posting names too few skills."] } });
  assert.deepEqual(declined, { declined: true, reason: "The posting names too few skills." });
  assert.equal(atsCardView({}), null);
  const other = atsCardView({ report: REPORT, contextual: scoreContextual({ skillMatch: 64, posting: { ...SB, text: "x" }, resume: { category: "data", subcategory: "data.analyst", level: "mid", text: "x" } }) });
  assert.equal(other.parts.find(p => p.id === "role_fit").line, "The job is Backend, senior; your résumé reads Analyst, mid level");
});

// ⛔ 47m (changed on purpose): "the panel draws ONE card: no claims, no quick check, no old report, no In contex" retired — ATSPanel (the posting's report loader) is deleted with the posting: the sheet's 02 draws FitCard, which reads its own report (D202).

test("Home's held rows (owner 11-19: \"switch the held panel rows to colour too\"): the résumé's number in its band's colour, no band word", () => {
  const p = read("client/src/panels/AutoApplyPanel.jsx");
  assert.doesNotMatch(p, /atsBandLabel\(/, "no band word on a held row");
  assert.ok(p.includes("Base résumé: <AtsInk score={node.ref.baseAts?.score ?? null} band={node.ref.baseAts?.band ?? null} />."));
  assert.ok(p.includes("Résumé: <AtsInk score={node.ref.resume?.atsScore ?? null} />."));
  assert.ok(p.includes(" · <AtsInk score={p.baseAts?.score ?? null} band={p.baseAts?.band ?? null} /> (base resume)"));
  const ink = read("client/src/components/AtsInk.jsx");
  assert.match(ink, /export const atsInk = \(score\) => bandStyle\(atsBandFor\(Number\.isFinite\(score\) \? score : null\)\)\.fg;/);
  assert.match(ink, /aria-label=\{atsBandLabel\(band\)\.label\}/, "a legacy row with only a band: a dot, the word only as its accessible name");
  assert.doesNotMatch(ink.replace(/^\s*\/\/.*$/gm, ""), /#[0-9a-fA-F]{3,6}\b|rgba?\(/, "no colour literal");
});

test("46z (owner 11-20: 'can definitely put more stats out … just state more to add context'): every part states its figures, and the card one row", async () => {
  const { scoreAtsLocally, scoreContextual } = await import("../services/localAtsScorer.js");
  const resumeText = "Ada Synthetic\nSenior Software Engineer, Northwind, 2018 – 2024\n- Built React and TypeScript front ends\n- Led a Spring Boot service migration\nSkills: TypeScript, React, Java, Spring, PostgreSQL, AWS";
  const jd = "Senior Software Engineer\nWhat you'll do\n- Design and build TypeScript and React features for patients\n- Own backend services in Node.js and PostgreSQL on AWS\n- Build dashboards in Looker\nRequirements\n- TypeScript, React, Node.js, PostgreSQL, AWS, Looker";
  const report = scoreAtsLocally({ resumeText, job: { title: "Senior Software Engineer", description: jd } });
  const contextual = scoreContextual({ skillMatch: report.score, skillsBoth: report.tier1_matched,
    posting: { category: "software-engineering", subcategory: "swe.backend", level: "senior", text: jd },
    resume: { category: "software-engineering", subcategory: "swe.fullstack", level: "mid", text: resumeText, tech: ["TypeScript", "React", "Spring"] },
    company: { techStack: [{ name: "TypeScript", postingShare: 0.9 }, { name: "Node.js", postingShare: 0.7 }, { name: "Looker", postingShare: 0.4 }] } });
  const v = atsCardView({ report, contextual });
  const f = Object.fromEntries(v.parts.map(p => [p.name, p.facts.join(" · ")]));
  assert.match(f.Skills, /^\d+ of \d+ skills/);
  assert.match(f.Skills, /weighs 50%/);
  assert.match(f.Role, /1 level apart/);
  assert.match(f["The work"], /dut(y|ies) to show · weighs 15%/);
  assert.match(f["Their stack"], /TypeScript 90%, Node\.js 70%, Looker 40% of their jobs/);
  assert.match(f["Their stack"], /\d of 3 of their tools exact/);
  assert.match(v.facts.join(" · "), /skill match \d+ · in context \d+/);
  // a report alone (no contextual block) still states its counts, with no weight to state
  const alone = atsCardView({ report: { score: 50, tier1_matched: ["aws", "go"], tier1_missing: ["grpc"], action_verbs_matched: ["Built"], action_verbs_missing: [] } });
  assert.deepEqual(alone.parts[0].facts, ["2 of 3 skills", "1 of 1 action verbs"]);
  assert.deepEqual(alone.facts, []);
});
