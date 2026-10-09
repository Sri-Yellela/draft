#!/usr/bin/env node
// D70 Phase 1 PRE-CHECK — "our ATS only gets better" is an assumption: how many of a posting's real
// requirement terms reach the keyword list the generation would receive instead of the posting?
//
// ⚠ THE TRUTH IS A PROXY, and the output says so. No graded set records requirement TERMS: the ATS corpus
// grades are fit scores (1–5) and data/d72-gold/ labels tags. The closest honest reference is
// scraped_jobs.skills_json — the skills a reader extracted from the posting in the enrichment sweep (D17's
// manual export → model → import; written by an import, never by this script). Recall here is: of those
// skills, how many does the deterministic extractor (scoreAtsLocally's posting terms, matched + missing
// against an empty résumé) pick up — and how many sit outside its vocabulary, so can never reach the model.
//
// READ-ONLY: opens the database with { readonly: true }. No model call, no network.
//   node scripts/d70KeywordRecall.mjs [--db data/resume_master.db] [--limit 400] [--json]
import Database from "better-sqlite3";
import { scoreAtsLocally, normaliseAtsTerm, skillVocabularyTerms } from "../services/localAtsScorer.js";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DB = arg("--db", "data/resume_master.db");
const LIMIT = Number(arg("--limit", 400));
const db = new Database(DB, { readonly: true, fileMustExist: true });

// The normalised text (migration 137) when this database has it, else the raw description.
const cols = new Set(db.prepare("PRAGMA table_info(scraped_jobs)").all().map(c => c.name));
const TEXT = cols.has("description_text") ? "COALESCE(description_text, description)" : "description";
const rows = db.prepare(`SELECT job_id, title, company, ${TEXT} AS text, skills_json
  FROM scraped_jobs WHERE skills_json IS NOT NULL AND skills_json NOT IN ('', '[]', 'null') AND LENGTH(COALESCE(${TEXT}, '')) > 200
  ORDER BY job_id LIMIT ?`).all(LIMIT);

const vocab = new Set(Array.from(skillVocabularyTerms()).map(normaliseAtsTerm));
const skillsOf = (raw) => {
  try {
    const v = JSON.parse(raw);
    // Stored as [{ skill, type: "hard" | "soft" }]. Only HARD skills count: soft skills are the "generic
    // language" the keyword context never sends.
    const list = (Array.isArray(v) ? v : []).filter(s => typeof s === "string" || (s?.type ?? "hard") === "hard");
    return [...new Set(list.map(s => normaliseAtsTerm(typeof s === "string" ? s : s?.skill ?? s?.name ?? "")).filter(Boolean))];
  } catch { return []; }
};

const per = [];
const outside = new Map();
for (const r of rows) {
  const truth = skillsOf(r.skills_json);
  if (!truth.length) continue;
  const report = scoreAtsLocally({ job: { title: r.title, description: r.text }, resumeText: "" });
  const found = new Set([...(report.tier1_matched || []), ...(report.tier1_missing || []), ...(report.competencies_missing || []),
    ...(report.competencies_matched || [])].map(normaliseAtsTerm));
  const hit = truth.filter(t => found.has(t));
  for (const t of truth) if (!vocab.has(t)) outside.set(t, (outside.get(t) || 0) + 1);
  per.push({ job_id: r.job_id, title: r.title, company: r.company, truth: truth.length, found: hit.length,
    recall: hit.length / truth.length, outsideVocab: truth.filter(t => !vocab.has(t)).length });
}

const recalls = per.map(p => p.recall).sort((a, b) => a - b);
const mean = recalls.reduce((s, x) => s + x, 0) / (recalls.length || 1);
const median = recalls.length ? recalls[Math.floor(recalls.length / 2)] : 0;
const truthTotal = per.reduce((s, p) => s + p.truth, 0);
const outsideTotal = per.reduce((s, p) => s + p.outsideVocab, 0);
const summary = {
  reference: "PROXY — scraped_jobs.skills_json (the enrichment sweep's extracted skills), not graded requirement terms",
  database: DB, postings: per.length, requirementTerms: truthTotal,
  meanRecall: Number(mean.toFixed(3)), medianRecall: Number(median.toFixed(3)),
  outsideVocabulary: { terms: outsideTotal, share: Number((outsideTotal / (truthTotal || 1)).toFixed(3)), distinct: outside.size,
    top20: [...outside.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20) },
};
if (process.argv.includes("--json")) { console.log(JSON.stringify({ summary, per }, null, 2)); process.exit(0); }
console.log(JSON.stringify(summary, null, 2));
console.log("\nlowest recall:");
for (const p of [...per].sort((a, b) => a.recall - b.recall).slice(0, 10)) {
  console.log(`  ${(p.recall * 100).toFixed(0).padStart(3)}%  ${p.found}/${p.truth}  ${p.company} — ${String(p.title).slice(0, 60)}`);
}
