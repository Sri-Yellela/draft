// 47c (owner 11-24: "implement proposed fixes") · three readings the ATS card showed wrong, from the owner's paste: a company's
// pitch counted as a duty, "SAFE" (a civil-engineering program) read from the word "safe", "Planning" listed as a missing skill.
import test from "node:test";
import assert from "node:assert/strict";
import { responsibilityPhrases, scoreAtsLocally, buildRuntimeAtsBasis } from "../src/index.js";

const PITCH = [
  "About the role",
  "At Rula, exceptional patient outcomes are at the heart of everything we do, and every clinician is supported.",
  "We're growing fast across 40 states.",
  "You will keep our members safe and lead care planning across teams.",
  "- Partner with clinical leaders on weekly operating reviews",
  "Requirements",
  "- 3+ years in healthcare operations",
].join("\n");

test("cardReadings47c: under 'About the role' the pitch is not a duty; a sentence to the reader and a bullet are", () => {
  const texts = responsibilityPhrases(PITCH).map(p => p.text);
  assert.ok(!texts.some(t => /^At Rula/.test(t)), JSON.stringify(texts));
  assert.ok(!texts.some(t => /growing fast/.test(t)), "a pitch sentence with no 'you'");
  assert.ok(texts.some(t => /^You will keep our members safe/.test(t)));
  assert.ok(texts.some(t => /^Partner with clinical leaders/.test(t)), "a bullet still counts");
});

test("cardReadings47c: a strong heading keeps its prose; an 'At <Company>,' opener is skipped anywhere", () => {
  const texts = responsibilityPhrases("Responsibilities\nAt Northwind, we ship weekly.\nBuild payment infrastructure that moves money safely.").map(p => p.text);
  assert.deepEqual(texts, ["Build payment infrastructure that moves money safely"]);
});

const basis = buildRuntimeAtsBasis({ resumeText: "Operations analyst. Improved reliability of scheduling systems.", domainProfile: {}, signalProfile: {} });

test("cardReadings47c: 'safe' the word never admits SAFE the program; the posting's enrichment still can", () => {
  const plain = scoreAtsLocally({ job: { title: "Clinical Operations Manager", description: PITCH }, runtimeBasis: basis });
  assert.ok(![...plain.tier1_missing, ...plain.tier1_matched].some(t => /^safe$/i.test(t)), JSON.stringify(plain.tier1_missing));
  const civil = scoreAtsLocally({ job: { title: "Structural Engineer", description: "Design slabs in SAFE and ETABS.",
    skills_json: [{ skill: "SAFE", type: "hard" }, { skill: "ETABS", type: "hard" }] }, runtimeBasis: basis });
  assert.ok(civil.tier1_missing.includes("SAFE"), JSON.stringify(civil.tier1_missing));
});

test("cardReadings47c: planning is a competency, never a missing skill", () => {
  const r = scoreAtsLocally({ job: { title: "Operations Manager", description: "Lead care planning and reporting across teams." }, runtimeBasis: basis });
  assert.ok(!r.tier1_missing.some(t => /^(planning|reporting)$/i.test(t)), JSON.stringify(r.tier1_missing));
});
