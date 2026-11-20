// ⭐ A232 R5 (46y, owner 11-19 "all four approved"): what test/t9AtsReportComponent.test.js (pure) and test/t9AtsReportChrome.test.js
// (its real-Chrome half) both use — ONE synthetic report, not two copies of it.
import fs from "node:fs";

export const read = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
export const stripJs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

// A SYNTHETIC report in the scorer's own shape — every section the card draws.
export const RAW = Object.freeze({
  source: "local_ats_v5", score: 61.4, scorable: true,
  tier1_matched: ["Go", "PostgreSQL"], tier1_missing: ["Kafka", "<img src=x onerror=alert(1)>"],
  competencies_matched: ["ownership"], competencies_missing: ["mentoring"],
  action_verbs_matched: ["Shipped"], action_verbs_missing: ["Scaled"], action_verbs_generic: ["Managed", "Partnered"],
  decline_reasons: [], hard_constraint_misses: ["Security clearance"],
  experience: { summary: "Résumé experience (6 years) meets 4+ year requirement.", requiredYears: 4, candidateYears: 6, fit: true },
  seniority_cap: { applied: false }, resume_depth: null, internal_debug: { not: "for the card" },
});
