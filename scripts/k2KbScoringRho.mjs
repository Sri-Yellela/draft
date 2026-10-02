#!/usr/bin/env node
/**
 * K2 — DOES THE COMPANY KB IN ATS SCORING MOVE RHO? Measure before shipping (RECRUITER_LAYER_EXECUTION §K2).
 *
 * The idea: a candidate at a company whose stack the KB knows gets credit for technologies that
 * company demonstrably uses but the résumé did not spell out. The constraint: scoreAtsLocally stays
 * deterministic, local, free, zero model calls — so the KB is PRECOMPUTED INTO THE SCORING INPUT
 * (the candidate basis's claimed skills), never queried per score. That is exactly what this does:
 * the employers named in the résumé are matched to company_technographics once, their top-N skills
 * are appended to the basis, and the graded 30 are re-scored with the unchanged scorer.
 *
 * ⛔ "It should help" is not evidence (G1's synonym table: wired to 8 call sites, rho +0.000).
 * This prints rho for the baseline and for each N; it ships nothing.
 *
 * Read-only. Usage: node scripts/k2KbScoringRho.mjs [--db <path>]
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreAtsLocally, buildRuntimeAtsBasis, skillVocabularyTerms, companyStackTerms } from "@draft/ats-scorer";
import { loadTermWeights } from "../services/atsTermWeights.js";
import { roleFamilyForTitle } from "../services/searchQueryBuilder.js";
import { loadSimpleApplyProfile } from "../services/simpleApplyProfile.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dbPath = (() => { const i = args.indexOf("--db"); return i >= 0 ? args[i + 1] : path.join(ROOT, "data", "resume_master.db"); })();
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "am1-ats-graded-corpus.json"), "utf8"));
const db = new Database(dbPath, { readonly: true });

function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length); let i = 0;
    while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1; i = j + 1; }
    return r;
  };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; }
  return num / Math.sqrt(dx * dy);
}

const profile = db.prepare("SELECT * FROM domain_profiles WHERE id=?").get(fixture.provenance.profile_id);
const resumeText = db.prepare("SELECT content FROM profile_base_resumes WHERE profile_id=?").get(profile.id)?.content;
const signalProfile = loadSimpleApplyProfile(db, { userId: profile.user_id, profileId: profile.id });

// The precompute: which KB companies does the résumé name as employers, and what do they use?
const kbCompanies = db.prepare("SELECT DISTINCT company FROM company_technographics").pluck().all();
const named = kbCompanies.filter(c => new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(resumeText));
const stackFor = (n) => named.length ? db.prepare(`
  SELECT skill FROM company_technographics WHERE company IN (${named.map(() => "?").join(",")})
  GROUP BY skill ORDER BY MAX(weight) DESC LIMIT ?`).pluck().all(...named, n) : [];

function rhoWith(extraSkills) {
  const claims = extraSkills.length ? { skills: extraSkills, actionVerbs: [] } : null;
  const basis = buildRuntimeAtsBasis({ resumeText, signalProfile, domainProfile: profile, claims });
  const rows = fixture.postings.filter(p => Number.isFinite(p.human_fit)).map(p => {
    const rep = scoreAtsLocally({ job: p, runtimeBasis: basis, termWeights: loadTermWeights(db, roleFamilyForTitle(p.title)), synonyms: null });
    return { human: p.human_fit, score: rep.score ?? -1 };
  });
  return { rho: spearman(rows.map(r => r.human), rows.map(r => r.score)), n: rows.length };
}

const base = rhoWith([]);
console.log(`K2 — employers named in the résumé that the KB knows: ${named.join(", ") || "(none)"}`);
console.log(`baseline                         rho ${base.rho.toFixed(3)}  n=${base.n}`);
for (const n of [5, 10, 20, 40, 80]) {
  const s = stackFor(n);
  const r = rhoWith(s);
  const d = r.rho - base.rho;
  console.log(`+ employer stack, top ${String(n).padStart(2)} skills  rho ${r.rho.toFixed(3)}  (${d >= 0 ? "+" : ""}${d.toFixed(3)})  e.g. ${s.slice(0, 6).join(", ")}`);
}

// Variant B: the KB's skills restricted to TECHNICAL terms (the scorer's own skill vocabulary) — the
// raw technographics are dominated by soft skills, which is not "the stack".
const tech = new Set(skillVocabularyTerms().map(t => t.toLowerCase()));
const techStack = (n) => named.length ? db.prepare(`
  SELECT skill FROM company_technographics WHERE company IN (${named.map(() => "?").join(",")})
  GROUP BY skill ORDER BY MAX(weight) DESC`).pluck().all(...named).filter(k => tech.has(String(k).toLowerCase())).slice(0, n) : [];
for (const n of [5, 10, 20, 40]) {
  const s = techStack(n); const r = rhoWith(s); const d = r.rho - base.rho;
  console.log(`+ technical KB skills, top ${String(n).padStart(2)}    rho ${r.rho.toFixed(3)}  (${d >= 0 ? "+" : ""}${d.toFixed(3)})  e.g. ${s.slice(0, 6).join(", ")}`);
}
// Variant C: the curated per-company stack in DOMAIN_TOOL_REGISTRY (a fact about the employer).
const curated = [...new Set(named.flatMap(c => companyStackTerms(c)))];
const rc = rhoWith(curated);
console.log(`+ curated registry stack (${curated.length})     rho ${rc.rho.toFixed(3)}  (${rc.rho - base.rho >= 0 ? "+" : ""}${(rc.rho - base.rho).toFixed(3)})  e.g. ${curated.slice(0, 6).join(", ")}`);
