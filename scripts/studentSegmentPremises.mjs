#!/usr/bin/env node
/**
 * Queue 26's premises, measured before anything is built (2026-09-30). Read-only, zero model calls.
 *
 *  1. Is the résumé-side SKILL_HINTS list (services/simpleApplyProfile.js) the gate on what a
 *     student résumé can match? Scores a student-shaped résumé against every entry/intern posting
 *     with and without the SKILL_HINTS-derived skills.
 *  2. Which student vocabulary exists on the POSTING side (the registries the scorer extracts with)?
 *  3. Is the seniority guard profile-relative in both directions? Scores senior/lead postings for a
 *     STUDENT profile and counts caps.
 *
 * Usage: node scripts/studentSegmentPremises.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "resume_master.db"), { readonly: true, fileMustExist: true });
const A = await import("../services/localAtsScorer.js");
const S = await import("../services/simpleApplyProfile.js");
const STUDENT = `ALEX STUDENT
B.S. Computer Science, State University, expected May 2027. GPA 3.8.
Relevant coursework: Data Structures, Algorithms, Operating Systems, Computer Networks, Databases, Distributed Systems, Machine Learning.
PROJECTS
Campus Ride-Share App — React, Node.js, PostgreSQL; built a REST API and deployed on AWS.
Compiler for a toy language — C++, LLVM; wrote a lexer, parser and code generator.
EXPERIENCE
Teaching Assistant, CS 201 Data Structures — held office hours for 120 students, graded assignments in Java.
Software Engineering Intern, Small Startup (Summer 2026) — Python, Django, Docker; wrote unit tests with pytest.
ACTIVITIES
ACM chapter vice-president; hackathon organiser (HackState 2026, 300 participants).`;
const sp = S.deriveSimpleApplyProfile(STUDENT);
console.log("SKILL_HINTS-derived skills:", sp.skills.join(", "));
const rows = db.prepare(`SELECT title, company, description, skills_json FROM scraped_jobs WHERE experience_level IN ('intern','entry') AND length(description) > 400`).all();
const withHints = A.buildRuntimeAtsBasis({ resumeText: STUDENT, signalProfile: { skills: sp.skills, titles: sp.titles }, domainProfile: { seniority: "student" } });
const textOnly = A.buildRuntimeAtsBasis({ resumeText: STUDENT, signalProfile: {}, domainProfile: { seniority: "student" } });
let same = 0; const terms = new Map(); const matched = new Map();
for (const job of rows) {
  const a = A.scoreAtsLocally({ job, runtimeBasis: withHints }); const b = A.scoreAtsLocally({ job, runtimeBasis: textOnly });
  if (a.score === b.score) same++;
  for (const t of [...a.tier1_missing, ...a.tier1_matched]) terms.set(t, (terms.get(t) || 0) + 1);
  for (const t of a.tier1_matched) matched.set(t, (matched.get(t) || 0) + 1);
}
console.log(`entry/intern postings: ${rows.length}; score identical with vs without SKILL_HINTS skills: ${same}/${rows.length}`);
const top = (m) => [...m].sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => `${k} ${v}`).join(" · ");
console.log("terms the postings are scored on (top):", top(terms));
console.log("matched for the student résumé (top):", top(matched));
const vocab = new Set(A.skillVocabularyTerms().map(t => String(t).toLowerCase()));
for (const t of ["data structures", "algorithms", "operating systems", "computer networks", "coursework", "teaching assistant", "gpa", "hackathon", "compilers", "llvm", "django", "pytest", "object-oriented programming"]) console.log(`  in the posting-side vocabulary: ${t.padEnd(28)} ${vocab.has(t)}`);
const sr = db.prepare(`SELECT title, company, description, skills_json FROM scraped_jobs WHERE experience_level IN ('senior','lead') AND length(description) > 400 LIMIT 300`).all();
const caps = sr.map(job => A.scoreAtsLocally({ job, runtimeBasis: withHints })).filter(r => r.seniority_cap?.applied).length;
console.log(`senior/lead postings scored for a STUDENT profile: ${sr.length}; capped: ${caps}`);
